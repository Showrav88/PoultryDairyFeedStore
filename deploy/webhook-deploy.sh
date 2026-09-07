#!/usr/bin/env bash
# Entry point for /api/deploy webhook — start root deploy OUTSIDE the app systemd cgroup.
# Manual equivalent: sudo /usr/local/sbin/deploy-newproject
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TRIGGER_DEPLOY="/usr/local/sbin/trigger-newproject-deploy"
SBIN_DEPLOY="/usr/local/sbin/deploy-newproject"
LOG_FILE="${APP_DIR}/logs/deploy.log"
STATUS_FILE="${APP_DIR}/.deploy-status"
APP_LOCK="${APP_DIR}/.deploy.lock"

mkdir -p "${APP_DIR}/logs"
exec >>"$LOG_FILE" 2>&1

write_status() {
  local state="$1"
  local sha="${2:-}"
  local msg="${3:-}"
  printf '{"state":"%s","sha":"%s","message":"%s","updatedAt":"%s"}\n' \
    "$state" "$sha" "$msg" "$(date -Is)" > "$STATUS_FILE"
}

fail() {
  write_status "failed" "${TARGET_SHA:-}" "$1"
  echo "webhook-deploy FAILED: $1"
  exit 1
}

deploy_is_live() {
  # shellcheck disable=SC1091
  source "${APP_DIR}/deploy/deploy-lock.sh" 2>/dev/null || true
  if type newproject_deploy_process_running >/dev/null 2>&1; then
    newproject_deploy_process_running && return 0
  fi
  pgrep -af '/usr/local/sbin/deploy-newproject|deploy/deploy-newproject\.sh|trigger-newproject-deploy' \
    >/dev/null 2>&1
}

launch_root_deploy() {
  local cmd="$1"
  if ! sudo -n true 2>/dev/null; then
    echo "sudo -n true failed for $(whoami) — passwordless sudo not configured"
    return 1
  fi
  echo "Launching: sudo -n $cmd"
  sudo -n "$cmd" >>"$LOG_FILE" 2>&1 &
  local bg=$!
  for _ in 1 2 3 4 5 6; do
    sleep 1
    if deploy_is_live; then
      return 0
    fi
    if ! kill -0 "$bg" 2>/dev/null; then
      wait "$bg" 2>/dev/null || true
      echo "Launch process $bg exited before deploy started"
      return 1
    fi
  done
  deploy_is_live
}

echo "=== webhook-deploy $(date -Is) TARGET_SHA=${TARGET_SHA:-unknown} user=$(whoami) pid=$$ ==="

# shellcheck disable=SC1091
source "${APP_DIR}/deploy/deploy-health.sh" 2>/dev/null || true

if [[ -n "${TARGET_SHA:-}" ]] && type health_deploy_sha >/dev/null 2>&1 && health_deploy_sha "$TARGET_SHA"; then
  write_status "ready" "$TARGET_SHA" "Already deployed at target commit"
  echo "App already serves ${TARGET_SHA} — skipping redeploy"
  exit 0
fi

# Git HEAD can match before npm build finishes — never skip on git alone.
CURRENT_SHA="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "")"
if [[ -n "${TARGET_SHA:-}" && -n "$CURRENT_SHA" && "$CURRENT_SHA" == "$TARGET_SHA" ]]; then
  echo "Git at ${TARGET_SHA} but live app differs — running deploy"
fi

if deploy_is_live; then
  write_status "running" "${TARGET_SHA:-}" "Deploy already in progress"
  echo "Deploy process already active — skip duplicate webhook"
  exit 0
fi

rm -f "$APP_LOCK"

if [[ -x "$TRIGGER_DEPLOY" ]] && launch_root_deploy "$TRIGGER_DEPLOY"; then
  write_status "started" "${TARGET_SHA:-}" "Webhook deploy started via trigger"
  echo "Deploy started via $TRIGGER_DEPLOY"
  exit 0
fi

if [[ -x "$SBIN_DEPLOY" ]] && launch_root_deploy "$SBIN_DEPLOY"; then
  write_status "started" "${TARGET_SHA:-}" "Webhook deploy started via deploy-newproject"
  echo "Deploy started via $SBIN_DEPLOY"
  exit 0
fi

fail "Webhook cannot start deploy. On VPS run once as root: sudo bash ${APP_DIR}/deploy/setup-github-actions-deploy.sh (or sudo /usr/local/sbin/deploy-newproject after git sync)"
