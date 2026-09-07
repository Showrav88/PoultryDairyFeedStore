#!/usr/bin/env bash
# One-time recovery: reset dirty VPS git checkout and install system deploy helpers.
#   sudo bash /var/www/NEWPROJECT/deploy/bootstrap-vps-git.sh
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
APP_USER="newproject"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

git -C "$APP_DIR" fetch origin main
git -C "$APP_DIR" checkout -f main
git -C "$APP_DIR" reset --hard origin/main
git -C "$APP_DIR" clean -fd \
  -e .env -e .env.local -e node_modules -e .next -e logs \
  -e .deploy-sha -e .deploy-status -e .deploy.lock -e src/generated

install -m 755 "${APP_DIR}/deploy/sbin-deploy-newproject" /usr/local/sbin/deploy-newproject
install -m 755 "${APP_DIR}/deploy/sbin-sync-newproject-origin" /usr/local/sbin/sync-newproject-origin
install -m 755 "${APP_DIR}/deploy/fix-newproject-ownership.sh" /usr/local/sbin/fix-newproject-ownership
install -m 755 "${APP_DIR}/deploy/trigger-newproject-deploy.sh" /usr/local/sbin/trigger-newproject-deploy

chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

echo "Bootstrap OK at $(git -C "$APP_DIR" rev-parse --short HEAD)"
echo "Run: sudo bash ${APP_DIR}/deploy/setup-github-actions-deploy.sh  (updates sudoers)"
echo "Then: sudo /usr/local/sbin/deploy-newproject"
