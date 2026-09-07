#!/usr/bin/env bash
# Fix root-owned files in the app tree (blocks git pull for newproject user).
# Installed to /usr/local/sbin/fix-newproject-ownership — callable via sudo from webhook deploy.
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
APP_USER="newproject"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
