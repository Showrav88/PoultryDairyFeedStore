#!/usr/bin/env bash
# ONE-TIME VPS setup: git sync helpers + webhook sudoers + cron auto-deploy.
# Run once as root, then every git merge deploys automatically (webhook + cron).
#
#   sudo bash /var/www/NEWPROJECT/deploy/bootstrap-vps-git.sh
#   sudo bash /var/www/NEWPROJECT/scripts/hostinger/install-auto-deploy-cron.sh
#
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
APP_USER="newproject"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

echo "=== newproject VPS bootstrap (one time) ==="

chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

git -C "$APP_DIR" fetch origin main
git -C "$APP_DIR" checkout -f main
git -C "$APP_DIR" reset --hard origin/main
git -C "$APP_DIR" clean -fd \
  -e .env -e .env.local -e node_modules -e .next -e logs \
  -e .deploy-sha -e .deploy-status -e .deploy.lock -e src/generated

# Re-exec after git sync so this script uses the latest version from GitHub.
if [[ "${BOOTSTRAP_REEXEC:-}" != "1" && -f "${APP_DIR}/deploy/bootstrap-vps-git.sh" ]]; then
  export BOOTSTRAP_REEXEC=1
  exec bash "${APP_DIR}/deploy/bootstrap-vps-git.sh"
fi

install -m 755 "${APP_DIR}/deploy/sbin-deploy-newproject" /usr/local/sbin/deploy-newproject
install -m 755 "${APP_DIR}/deploy/sbin-sync-newproject-origin" /usr/local/sbin/sync-newproject-origin
install -m 755 "${APP_DIR}/deploy/fix-newproject-ownership.sh" /usr/local/sbin/fix-newproject-ownership
install -m 755 "${APP_DIR}/deploy/trigger-newproject-deploy.sh" /usr/local/sbin/trigger-newproject-deploy 2>/dev/null || true

if [[ -f "${APP_DIR}/deploy/ensure-webhook-deploy.sh" ]]; then
  bash "${APP_DIR}/deploy/ensure-webhook-deploy.sh" || {
    echo "WARNING: ensure-webhook-deploy failed — continuing bootstrap deploy as root"
  }
else
  echo "WARNING: ensure-webhook-deploy.sh missing — git pull may be incomplete"
fi

if [[ -f "${APP_DIR}/deploy/unlock-deploy.sh" ]]; then
  bash "${APP_DIR}/deploy/unlock-deploy.sh" --force 2>/dev/null || true
fi

if [[ -f "${APP_DIR}/scripts/hostinger/install-auto-deploy-cron.sh" ]]; then
  bash "${APP_DIR}/scripts/hostinger/install-auto-deploy-cron.sh"
fi

chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

echo ""
echo "Bootstrap OK at $(git -C "$APP_DIR" rev-parse --short HEAD)"
echo ""
echo "Running first deploy ..."
/usr/local/sbin/deploy-newproject

echo ""
echo "=== Done. Future merges deploy automatically via:"
echo "  - GitHub Actions webhook (push to main)"
echo "  - VPS cron every 5 min (backup)"
echo "Log: sudo tail -f /var/log/newproject-auto-deploy.log"
