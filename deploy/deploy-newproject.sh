#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
BRANCH="${DEPLOY_BRANCH:-main}"
APP_USER="newproject"
LOCK_FILE="/var/lock/newproject-deploy.lock"
PID_FILE="/var/lock/newproject-deploy.pid"
LOG_FILE="/var/log/newproject-deploy.log"
STATUS_FILE="${APP_DIR}/.deploy-status"
SBIN_CMD="/usr/local/sbin/deploy-newproject"
REPO_SCRIPT="${APP_DIR}/deploy/deploy-newproject.sh"

exec > >(tee -a "$LOG_FILE") 2>&1

write_status() {
  local state="$1"
  local sha="${2:-}"
  local msg="${3:-}"
  printf '{"state":"%s","sha":"%s","message":"%s","updatedAt":"%s"}\n' \
    "$state" "$sha" "$msg" "$(date -Is)" > "$STATUS_FILE"
  chown newproject:newproject "$STATUS_FILE" 2>/dev/null || true
}

fix_app_ownership() {
  if [[ "$(id -u)" -eq 0 ]]; then
    echo "Ensuring ${APP_DIR} is owned by ${APP_USER} ..."
    chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
  fi
}

git_pull_latest() {
  if [[ "${NEWPROJECT_GIT_SYNCED:-}" == "1" ]]; then
    echo "Git already synced by /usr/local/sbin/deploy-newproject"
    return 0
  fi

  echo "Deploying newproject from origin/$BRANCH..."
  write_status "pulling" "" "Fetching latest code"

  fix_app_ownership

  if [[ -x /usr/local/sbin/sync-newproject-origin ]]; then
    /usr/local/sbin/sync-newproject-origin "$APP_DIR" "$BRANCH"
  elif [[ -f "${APP_DIR}/deploy/sync-to-origin.sh" ]]; then
    bash "${APP_DIR}/deploy/sync-to-origin.sh" "$APP_DIR" "$BRANCH"
  elif [[ "$(id -u)" -eq 0 ]]; then
    git -C "$APP_DIR" fetch origin "$BRANCH"
    git -C "$APP_DIR" checkout -f "$BRANCH"
    git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
    git -C "$APP_DIR" clean -fd \
      -e .env -e .env.local -e node_modules -e .next -e logs \
      -e .deploy-sha -e .deploy-status -e .deploy.lock -e src/generated
  else
    sudo -u "${APP_USER}" -H git -C "$APP_DIR" fetch origin "$BRANCH"
    sudo -u "${APP_USER}" -H git -C "$APP_DIR" checkout -f "$BRANCH"
    sudo -u "${APP_USER}" -H git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
  fi

  fix_app_ownership
}

on_error() {
  echo "Deploy failed at line $1 (exit $2)"
  write_status "failed" "$(cat "${APP_DIR}/.deploy-sha" 2>/dev/null || echo "")" "Deploy failed at line $1"
  rm -f "$PID_FILE"
  exit "$2"
}
trap 'on_error $LINENO $?' ERR

cleanup() {
  rm -f "$PID_FILE"
}
trap cleanup EXIT

# Keep system deploy commands in sync with repo (root only).
if [[ "$(id -u)" -eq 0 && -f "${APP_DIR}/deploy/sbin-deploy-newproject" ]]; then
  install -m 755 "${APP_DIR}/deploy/sbin-deploy-newproject" "$SBIN_CMD"
fi
if [[ "$(id -u)" -eq 0 && -f "${APP_DIR}/deploy/sbin-sync-newproject-origin" ]]; then
  install -m 755 "${APP_DIR}/deploy/sbin-sync-newproject-origin" /usr/local/sbin/sync-newproject-origin
fi
if [[ "$(id -u)" -eq 0 && -f "${APP_DIR}/deploy/fix-newproject-ownership.sh" ]]; then
  install -m 755 "${APP_DIR}/deploy/fix-newproject-ownership.sh" /usr/local/sbin/fix-newproject-ownership
fi
if [[ "$(id -u)" -eq 0 && -f "${APP_DIR}/deploy/newproject-deploy.service" ]]; then
  install -m 644 "${APP_DIR}/deploy/newproject-deploy.service" /etc/systemd/system/newproject-deploy.service
  systemctl daemon-reload 2>/dev/null || true
fi
if [[ "$(id -u)" -eq 0 && -f "${APP_DIR}/deploy/trigger-newproject-deploy.sh" ]]; then
  install -m 755 "${APP_DIR}/deploy/trigger-newproject-deploy.sh" /usr/local/sbin/trigger-newproject-deploy
fi

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    LOG_AGE_MIN=0
    if [[ -f "$LOG_FILE" ]]; then
      LOG_AGE_MIN=$(( ( $(date +%s) - $(stat -c %Y "$LOG_FILE" 2>/dev/null || echo 0) ) / 60 ))
    fi
    if [[ "$LOG_AGE_MIN" -gt 45 ]]; then
      echo "Stale deploy pid $OLD_PID (log idle ${LOG_AGE_MIN}m) — stopping."
      kill -TERM "$OLD_PID" 2>/dev/null || true
      sleep 2
      kill -KILL "$OLD_PID" 2>/dev/null || true
      rm -f "$PID_FILE" "$LOCK_FILE"
    else
      echo "Another newproject deployment is already running (pid $OLD_PID)."
      write_status "running" "" "Deploy already in progress (pid $OLD_PID)"
      exit 1
    fi
  else
    echo "Removing stale deploy lock (pid ${OLD_PID:-unknown} not running)."
    rm -f "$PID_FILE" "$LOCK_FILE"
  fi
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  if pgrep -af 'deploy-newproject.sh|sbin-deploy-newproject' >/dev/null 2>&1; then
    echo "Another newproject deployment is already running."
    pgrep -af 'deploy-newproject.sh|sbin-deploy-newproject' || true
    write_status "running" "" "Deploy already in progress"
    exit 1
  fi
  echo "Stale flock detected, clearing lock file."
  rm -f "$LOCK_FILE"
  exec 9>"$LOCK_FILE"
  flock -n 9 || { echo "Could not acquire deploy lock."; exit 1; }
fi

echo $$ > "$PID_FILE"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Repository is missing at $APP_DIR"
  write_status "failed" "" "Repository missing"
  exit 1
fi

echo "=== Deploy started $(date -Is) ==="
write_status "started" "" "Deploy started"

fix_app_ownership
git_pull_latest

DEPLOYING_SHA="$(sudo -u "${APP_USER}" git -C "$APP_DIR" rev-parse --short HEAD)"
echo "Building commit $DEPLOYING_SHA ..."
write_status "building" "$DEPLOYING_SHA" "Installing dependencies, migrating DB, and building"

# Stop before overwriting .next — building while next start is running causes 500 errors.
systemctl stop newproject-api.service 2>/dev/null || true
sleep 2

sudo -u "${APP_USER}" -H bash -lc "
  set -Eeuo pipefail
  export DEPLOY_STATUS_FILE='${STATUS_FILE}'
  export DEPLOYING_SHA='${DEPLOYING_SHA}'
  # shellcheck disable=SC1091
  source '${APP_DIR}/deploy/build-app.sh'
  deploy_build_app '${APP_DIR}'
"

write_status "restarting" "$DEPLOYING_SHA" "Starting application service"
systemctl start newproject-api.service

echo "Waiting for newproject-api.service to become healthy..."
sleep 5

for attempt in {1..60}; do
  if systemctl is-active --quiet newproject-api.service && \
     curl --fail --silent http://127.0.0.1:5001/api/health >/dev/null 2>&1; then
    SHA="$(sudo -u "${APP_USER}" git -C "$APP_DIR" rev-parse --short HEAD)"
    echo "$SHA" | sudo -u newproject tee "$APP_DIR/.deploy-sha" >/dev/null
    write_status "ready" "$SHA" "Deployment healthy"
    echo "Deployment healthy: $SHA"
    exit 0
  fi
  echo "Health check attempt ${attempt}/60 ..."
  sleep 5
done

echo "Health check failed. Service status:"
systemctl status newproject-api.service --no-pager || true
echo "Recent service logs:"
journalctl -u newproject-api.service -n 80 --no-pager
write_status "failed" "$DEPLOYING_SHA" "Health check failed after restart"
exit 1
