#!/usr/bin/env bash
# Install 5-minute cron auto-deploy for Poultry Feed Store (newproject only).
# Does NOT modify AnantaOne, jewelryms, or any other app cron.
#
# Run once on VPS as root:
#   sudo bash /var/www/NEWPROJECT/scripts/hostinger/install-auto-deploy-cron.sh
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/NEWPROJECT}"
AUTO_DEPLOY="${APP_DIR}/scripts/hostinger/auto-deploy.sh"
DEPLOY_SCRIPT="${APP_DIR}/scripts/hostinger/deploy.sh"
DEPLOY_CMD="/usr/local/sbin/deploy-newproject"
CRON_FILE="/etc/cron.d/newproject-auto-deploy"
LOG_FILE="/var/log/newproject-auto-deploy.log"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if [[ ! -f "$AUTO_DEPLOY" ]]; then
  echo "Missing $AUTO_DEPLOY — git pull origin main first."
  exit 1
fi

chmod 755 "$AUTO_DEPLOY" "$DEPLOY_SCRIPT"
touch "$LOG_FILE"
chmod 644 "$LOG_FILE"

cat > "$CRON_FILE" <<EOF
# Poultry Feed Store — auto-deploy from origin/main every 5 minutes
# App: newproject-api (127.0.0.1:5001) nginx :8081
# Log: ${LOG_FILE}
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/5 * * * * root ${DEPLOY_CMD} >> ${LOG_FILE} 2>&1
EOF

chmod 644 "$CRON_FILE"

echo "Installed ${CRON_FILE}:"
cat "$CRON_FILE"
echo ""
echo "Log: ${LOG_FILE}"
echo "  sudo tail -f ${LOG_FILE}"
echo ""
echo "Manual deploy:"
echo "  sudo bash ${DEPLOY_SCRIPT}"
echo ""
echo "Uninstall:"
echo "  sudo rm -f ${CRON_FILE}"
echo ""
echo "If git pull fails (local edits on VPS):"
echo "  sudo bash ${APP_DIR}/deploy/fix-git-ownership.sh"
echo "  sudo /usr/local/sbin/deploy-newproject"
