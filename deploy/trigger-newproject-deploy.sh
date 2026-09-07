#!/usr/bin/env bash
# Installed to /usr/local/sbin/trigger-newproject-deploy
# Webhook entry: starts root deploy outside the app cgroup.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/NEWPROJECT}"
UNIT="newproject-deploy.service"
DEPLOY_BIN="/usr/local/sbin/deploy-newproject"
DEPLOY_LOG="/var/log/newproject-deploy.log"
UNIT_FILE="/etc/systemd/system/${UNIT}"

# shellcheck disable=SC1091
source "${APP_DIR}/deploy/deploy-lock.sh" 2>/dev/null || true

reset_stuck_deploy_unit() {
  if [[ ! -f "$UNIT_FILE" ]]; then
    return 0
  fi
  if ! systemctl is-active --quiet "$UNIT" 2>/dev/null; then
    systemctl reset-failed "$UNIT" 2>/dev/null || true
    return 0
  fi

  if type newproject_deploy_process_running >/dev/null 2>&1; then
    if newproject_deploy_process_running; then
      echo "Deploy already running (live process)"
      exit 0
    fi
  elif pgrep -af '/usr/local/sbin/deploy-newproject|deploy/deploy-newproject\.sh' >/dev/null 2>&1; then
    echo "Deploy already running (live process)"
    exit 0
  fi

  echo "Resetting stuck ${UNIT} (active but no deploy process) ..."
  systemctl stop "$UNIT" 2>/dev/null || true
  systemctl reset-failed "$UNIT" 2>/dev/null || true
}

if type newproject_clear_stale_deploy_locks >/dev/null 2>&1; then
  newproject_clear_stale_deploy_locks || true
fi

reset_stuck_deploy_unit

echo "=== trigger-newproject-deploy $(date -Is) pid=$$ ===" >>"$DEPLOY_LOG"

if [[ -f "$UNIT_FILE" ]]; then
  exec systemctl start "$UNIT"
fi

echo "systemd unit missing — running ${DEPLOY_BIN} directly" >>"$DEPLOY_LOG"
exec "$DEPLOY_BIN"
