#!/usr/bin/env bash
# Entry point for /api/deploy webhook — prefer root deploy script, fall back to app-user deploy.
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SBIN_DEPLOY="/usr/local/sbin/deploy-newproject"
APP_DEPLOY="${APP_DIR}/deploy/deploy-via-app.sh"
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
write_status "started" "${TARGET_SHA:-}" "Webhook deploy starting"

# Clear stale app-user lock (idle > 45 min)
if [[ -f "$APP_LOCK" ]]; then
  lock_age=$(( $(date +%s) - $(stat -c %Y "$APP_LOCK" 2>/dev/null || echo 0) ))
  if [[ "$lock_age" -gt 2700 ]]; then
    echo "Removing stale app deploy lock (${lock_age}s old)"
    rm -f "$APP_LOCK"
  fi
fi

if sudo -n "$SBIN_DEPLOY"; then
  echo "Root deploy finished OK"
  exit 0
fi

echo "Root deploy unavailable or failed (see above), trying app-user deploy..."
if [[ -x "$APP_DEPLOY" ]]; then
  exec env TARGET_SHA="${TARGET_SHA:-}" bash "$APP_DEPLOY"
fi

fail "No deploy method available (need sudo NOPASSWD for $SBIN_DEPLOY or $APP_DEPLOY)"
