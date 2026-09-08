#!/usr/bin/env bash
# Clear stale deploy locks/status before webhook (no sudo). Sourced by webhook-deploy and API.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/NEWPROJECT}"

# shellcheck disable=SC1091
source "${APP_DIR}/deploy/deploy-lock.sh" 2>/dev/null || true

if type newproject_clear_stale_deploy_locks >/dev/null 2>&1; then
  newproject_clear_stale_deploy_locks || true
fi

# App-user can always drop duplicate-block status when nothing is deploying.
STATUS_FILE="${APP_DIR}/.deploy-status"
if [[ -f "$STATUS_FILE" ]] && ! newproject_deploy_process_running 2>/dev/null; then
  state="$(grep -o '"state"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATUS_FILE" 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)"
  if [[ "$state" == "running" ]]; then
    rm -f "$STATUS_FILE"
  fi
fi

rm -f "${APP_DIR}/.deploy.lock"
