#!/usr/bin/env bash
# Entry point for /api/deploy webhook — start root deploy OUTSIDE the app systemd cgroup.
# Manual equivalent: sudo /usr/local/sbin/deploy-newproject
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SBIN_DEPLOY="/usr/local/sbin/deploy-newproject"
DEPLOY_UNIT="newproject-deploy.service"
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

write_status "started" "${TARGET_SHA:-}" "Webhook deploy starting"

rm -f "$APP_LOCK"

# Prefer systemd oneshot — runs in its own cgroup so stopping newproject-api does not kill deploy.
if sudo -n systemctl start --no-block "$DEPLOY_UNIT" 2>/dev/null; then
  echo "Started $DEPLOY_UNIT (detached from app cgroup)"
  exit 0
fi

echo "systemctl start $DEPLOY_UNIT failed — trying direct sudo deploy in new session ..."
if sudo -n setsid "$SBIN_DEPLOY" </dev/null >>"$LOG_FILE" 2>&1 & then
  echo "Direct root deploy launched in new session (pid $!)"
  exit 0
fi

fail "Webhook cannot start deploy. On VPS run once as root: sudo bash ${APP_DIR}/deploy/setup-github-actions-deploy.sh"
