#!/usr/bin/env bash
# Poll GitHub main every cron run; deploy only when origin/main changed.
# Uses the same root deploy path as manual/webhook (sync + ensure-webhook + build).
# Logs to /var/log/newproject-auto-deploy.log (newproject only).
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/NEWPROJECT}"
APP_USER="${APP_USER:-newproject}"
BRANCH="${DEPLOY_BRANCH:-main}"
LOG_FILE="/var/log/newproject-auto-deploy.log"
DEPLOY_CMD="/usr/local/sbin/deploy-newproject"
AUTO_LOCK="/var/lock/newproject-auto-deploy.lock"

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"
chmod 644 "$LOG_FILE" 2>/dev/null || true

exec >>"$LOG_FILE" 2>&1

log() {
  echo "$(date -Is) [newproject/auto-deploy] $*"
}

log "=== run start (branch=${BRANCH}) ==="

git -C "$APP_DIR" config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

# Sync deploy scripts from GitHub FIRST so lock helpers self-heal without SSH.
log "git fetch origin/${BRANCH} (refresh deploy scripts) ..."
git -C "$APP_DIR" fetch origin "$BRANCH"
git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
git -C "$APP_DIR" clean -fd \
  -e .env -e .env.local -e node_modules -e .next -e logs \
  -e .deploy-sha -e .deploy-status -e .deploy.lock -e .deploy-in-progress -e src/generated

# shellcheck disable=SC1091
source "${APP_DIR}/deploy/deploy-lock.sh"

if newproject_clear_stale_deploy_locks; then
  log "Cleared stale deploy locks/status (no active process)"
fi

exec 9>"$AUTO_LOCK"
if ! flock -n 9; then
  log "Another auto-deploy instance running — skip"
  exit 0
fi

# Let deploy-newproject handle duplicate deploy detection (do not skip early on pgrep).

LOCAL_SHA="$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "")"
REMOTE_SHA="$(git -C "$APP_DIR" rev-parse "origin/${BRANCH}" 2>/dev/null || echo "")"

if [[ -z "$LOCAL_SHA" || -z "$REMOTE_SHA" ]]; then
  log "ERROR: could not resolve git SHAs"
  exit 1
fi

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  LIVE_SHA=""
  if [[ -f "${APP_DIR}/.deploy-sha" ]]; then
    LIVE_SHA="$(tr -d '[:space:]' < "${APP_DIR}/.deploy-sha" 2>/dev/null || true)"
  fi
  if [[ -n "$LIVE_SHA" && "${LIVE_SHA:0:7}" == "${REMOTE_SHA:0:7}" ]]; then
    log "No change on origin/${BRANCH} and app at ${LIVE_SHA:0:7} — skip deploy"
    exit 0
  fi
  if curl --fail --silent --max-time 8 http://127.0.0.1:5001/api/health >/dev/null 2>&1; then
    SHORT_SHA="$(echo "$REMOTE_SHA" | cut -c1-7)"
    echo "$SHORT_SHA" | sudo -u "$APP_USER" tee "${APP_DIR}/.deploy-sha" >/dev/null
    rm -f "${APP_DIR}/.deploy-in-progress"
    log "App healthy at git ${SHORT_SHA} — repaired .deploy-sha without redeploy"
    exit 0
  fi
  log "Git already at ${REMOTE_SHA:0:7} but app unhealthy — retry deploy"
else
  log "Change detected ${LOCAL_SHA:0:7} -> ${REMOTE_SHA:0:7} — running ${DEPLOY_CMD}"
fi

if [[ ! -x "$DEPLOY_CMD" ]]; then
  log "ERROR: missing ${DEPLOY_CMD} — run once on VPS: sudo bash ${APP_DIR}/deploy/bootstrap-vps-git.sh"
  exit 1
fi

export NEWPROJECT_GIT_SYNCED=1
if [[ "$(id -u)" -eq 0 ]]; then
  "$DEPLOY_CMD"
else
  sudo "$DEPLOY_CMD"
fi

log "=== run end ==="
