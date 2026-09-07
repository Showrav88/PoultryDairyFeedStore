#!/usr/bin/env bash
# Clear a stuck "started" deploy status after a successful manual deploy.
#   sudo bash /var/www/NEWPROJECT/deploy/mark-deploy-ready.sh
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
APP_USER="newproject"
STATUS_FILE="${APP_DIR}/.deploy-status"
SHA_FILE="${APP_DIR}/.deploy-sha"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

SHA="$(cat "$SHA_FILE" 2>/dev/null | tr -d '[:space:]')"
if [[ -z "$SHA" ]]; then
  SHA="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "")"
fi

if [[ -z "$SHA" ]]; then
  echo "Could not determine deploy sha"
  exit 1
fi

printf '{"state":"ready","sha":"%s","message":"Marked ready manually","updatedAt":"%s"}\n' \
  "$SHA" "$(date -Is)" > "$STATUS_FILE"
chown "${APP_USER}:${APP_USER}" "$STATUS_FILE"
rm -f "${APP_DIR}/.deploy.lock" /var/lock/newproject-deploy.pid /var/lock/newproject-deploy.lock

echo "Deploy status set to ready (${SHA})"
