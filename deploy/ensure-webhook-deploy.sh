#!/usr/bin/env bash
# Idempotent webhook deploy prerequisites (systemd unit, sudoers, sbin helpers).
# Runs automatically on every root deploy-newproject, or manually:
#   sudo bash /var/www/NEWPROJECT/deploy/ensure-webhook-deploy.sh
set -Eeuo pipefail

DEPLOY_USER="${DEPLOY_USER:-newproject}"
APP_DIR="${APP_DIR:-/var/www/NEWPROJECT}"
DEPLOY_CMD="/usr/local/sbin/deploy-newproject"
SYNC_ORIGIN="/usr/local/sbin/sync-newproject-origin"
FIX_OWNERSHIP="/usr/local/sbin/fix-newproject-ownership"
TRIGGER_DEPLOY="/usr/local/sbin/trigger-newproject-deploy"
DEPLOY_UNIT="newproject-deploy.service"
SUDOERS_FILE="/etc/sudoers.d/newproject-deploy"
QUIET="${QUIET:-0}"

log() {
  if [[ "$QUIET" != "1" ]]; then
    echo "$@"
  fi
}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "User '$DEPLOY_USER' does not exist."
  exit 1
fi

log "Installing webhook deploy helpers ..."
install -m 755 "${APP_DIR}/deploy/sbin-deploy-newproject" "$DEPLOY_CMD"
install -m 755 "${APP_DIR}/deploy/sbin-sync-newproject-origin" "$SYNC_ORIGIN"
install -m 755 "${APP_DIR}/deploy/fix-newproject-ownership.sh" "$FIX_OWNERSHIP"
install -m 755 "${APP_DIR}/deploy/trigger-newproject-deploy.sh" "$TRIGGER_DEPLOY"

log "Installing ${DEPLOY_UNIT} ..."
install -m 644 "${APP_DIR}/deploy/newproject-deploy.service" "/etc/systemd/system/${DEPLOY_UNIT}"
systemctl daemon-reload
systemctl enable "$DEPLOY_UNIT" 2>/dev/null || true

cat > "$SUDOERS_FILE" <<EOF
# Webhook auto-deploy (user ${DEPLOY_USER} triggers via /api/deploy)
${DEPLOY_USER} ALL=(root) NOPASSWD: ${DEPLOY_CMD}
${DEPLOY_USER} ALL=(root) NOPASSWD: ${TRIGGER_DEPLOY}
${DEPLOY_USER} ALL=(root) NOPASSWD: ${SYNC_ORIGIN}
${DEPLOY_USER} ALL=(root) NOPASSWD: ${FIX_OWNERSHIP}
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/bash ${APP_DIR}/deploy/unlock-deploy.sh
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/bash ${APP_DIR}/deploy/unlock-deploy.sh
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/bash ${APP_DIR}/deploy/unlock-deploy.sh --force
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/bash ${APP_DIR}/deploy/unlock-deploy.sh --force
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl start ${DEPLOY_UNIT}
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl start ${DEPLOY_UNIT}
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl stop newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl stop newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl start newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl start newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl restart newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl restart newproject-api.service
EOF
chmod 440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE"

# Verify allowed commands (sudo -n true is NOT in sudoers — that was a false failure).
verify_webhook_sudo() {
  local list
  list="$(sudo -u "$DEPLOY_USER" sudo -n -l 2>/dev/null || true)"
  echo "$list" | grep -Fq "$TRIGGER_DEPLOY" && echo "$list" | grep -Fq "$DEPLOY_CMD"
}

if ! verify_webhook_sudo; then
  echo "ERROR: ${DEPLOY_USER} cannot passwordless sudo deploy commands."
  echo "Check ${SUDOERS_FILE}"
  echo "Debug: sudo -u ${DEPLOY_USER} sudo -n -l"
  sudo -u "$DEPLOY_USER" sudo -n -l 2>&1 || true
  exit 1
fi

log "Webhook deploy prerequisites OK."

if [[ -f "${APP_DIR}/scripts/hostinger/install-auto-deploy-cron.sh" ]]; then
  bash "${APP_DIR}/scripts/hostinger/install-auto-deploy-cron.sh"
fi
