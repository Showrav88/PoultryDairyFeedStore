#!/usr/bin/env bash
# Fix "insufficient permission for adding an object to repository database .git/objects"
# after a deploy was interrupted or run as root.
#   sudo bash /var/www/NEWPROJECT/deploy/fix-git-ownership.sh
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
APP_USER="newproject"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

echo "Fixing ownership of ${APP_DIR} for ${APP_USER} ..."
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
echo "Done. Retry deploy:"
echo "  sudo bash ${APP_DIR}/deploy/unlock-deploy.sh --force"
echo "  sudo /usr/local/sbin/deploy-newproject"
