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

echo "=== webhook-deploy $(date -Is) TARGET_SHA=${TARGET_SHA:-unknown} user=$(whoami) pid=$$ ==="

CURRENT_SHA="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "")"
if [[ -n "${TARGET_SHA:-}" && -n "$CURRENT_SHA" && "$CURRENT_SHA" == "$TARGET_SHA" ]]; then
  if curl --fail --silent http://127.0.0.1:5001/api/health >/dev/null 2>&1; then
    write_status "ready" "$CURRENT_SHA" "Already deployed at target commit"
    echo "Already at ${TARGET_SHA} and healthy — skipping redeploy"
    exit 0
  fi
fi

# shellcheck disable=SC1091
source "${APP_DIR}/deploy/deploy-lock.sh" 2>/dev/null || true
if type newproject_deploy_process_running >/dev/null 2>&1 && newproject_deploy_process_running; then
  write_status "running" "${TARGET_SHA:-}" "Deploy already in progress"
  echo "Deploy process already active — skip duplicate webhook"
  exit 0
fi

write_status "started" "${TARGET_SHA:-}" "Webhook deploy starting"
rm -f "$APP_LOCK"

# Prefer installed trigger (exact sudoers match, resets stuck systemd unit).
if [[ -x "$TRIGGER_DEPLOY" ]]; then
  if sudo -n "$TRIGGER_DEPLOY" </dev/null >>"$LOG_FILE" 2>&1 & then
    echo "Started via $TRIGGER_DEPLOY (pid $!)"
    exit 0
  fi
  echo "sudo $TRIGGER_DEPLOY failed (check /etc/sudoers.d/newproject-deploy)"
fi

# Fallback: direct root deploy (sudoers must allow SBIN_DEPLOY exactly).
if sudo -n "$SBIN_DEPLOY" </dev/null >>"$LOG_FILE" 2>&1 & then
  echo "Started direct root deploy (pid $!)"
  exit 0
fi

fail "Webhook cannot start deploy. On VPS run once as root: sudo bash ${APP_DIR}/deploy/setup-github-actions-deploy.sh"
