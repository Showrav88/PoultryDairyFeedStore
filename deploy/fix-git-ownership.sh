#!/usr/bin/env bash
# Fix root-owned files in the app tree (blocks git pull / cannot create directories).
# Covers .git/objects and working-tree files like src/** after interrupted deploys.
#   sudo bash /var/www/NEWPROJECT/deploy/fix-git-ownership.sh
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
APP_USER="newproject"
FIX_OWNERSHIP="/usr/local/sbin/fix-newproject-ownership"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if [[ -f "${APP_DIR}/deploy/fix-newproject-ownership.sh" ]]; then
  install -m 755 "${APP_DIR}/deploy/fix-newproject-ownership.sh" "$FIX_OWNERSHIP"
fi

echo "Fixing ownership of ${APP_DIR} for ${APP_USER} ..."
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
echo "Done. Retry deploy:"
echo "  sudo bash ${APP_DIR}/deploy/unlock-deploy.sh --force"
echo "  sudo /usr/local/sbin/deploy-newproject"
