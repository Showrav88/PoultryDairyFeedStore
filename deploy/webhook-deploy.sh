#!/usr/bin/env bash
# Entry point for /api/deploy webhook — prefer root deploy script, fall back to app-user deploy.
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SBIN_DEPLOY="/usr/local/sbin/deploy-newproject"
APP_DEPLOY="${APP_DIR}/deploy/deploy-via-app.sh"

if sudo -n "$SBIN_DEPLOY" 2>/dev/null; then
  exit 0
fi

if [[ -x "$APP_DEPLOY" ]]; then
  exec bash "$APP_DEPLOY"
fi

echo "No deploy method available (need sudo NOPASSWD for $SBIN_DEPLOY or $APP_DEPLOY)"
exit 1
