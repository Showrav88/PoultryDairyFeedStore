#!/usr/bin/env bash
# Clear a stuck deploy lock (safe when no deploy is actually running).
#   sudo bash /var/www/NEWPROJECT/deploy/unlock-deploy.sh
# Force kill + unlock:
#   sudo bash /var/www/NEWPROJECT/deploy/unlock-deploy.sh --force
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
LOCK_FILE="/var/lock/newproject-deploy.lock"
PID_FILE="/var/lock/newproject-deploy.pid"
APP_LOCK_FILE="${APP_DIR}/.deploy.lock"
AUTO_LOCK="/var/lock/newproject-auto-deploy.lock"

FORCE=false
if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

# shellcheck disable=SC1091
source "${APP_DIR}/deploy/deploy-lock.sh" 2>/dev/null || true

running() {
  if type newproject_deploy_process_running >/dev/null 2>&1; then
    newproject_deploy_process_running
    return $?
  fi
  pgrep -af '/usr/local/sbin/deploy-newproject|deploy-newproject.sh|deploy-via-app.sh|scripts/hostinger/deploy.sh' \
    >/dev/null 2>&1
}

if [[ "$FORCE" == true ]]; then
  echo "Force unlock requested."
  if [[ -f "$PID_FILE" ]]; then
    OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$OLD_PID" ]]; then
      echo "Stopping pid $OLD_PID ..."
      kill -TERM "$OLD_PID" 2>/dev/null || true
      sleep 2
      kill -KILL "$OLD_PID" 2>/dev/null || true
    fi
  fi
  pkill -TERM -f 'deploy-newproject.sh|deploy-via-app.sh|scripts/hostinger/deploy.sh' 2>/dev/null || true
  sleep 2
  pkill -KILL -f 'deploy-newproject.sh|deploy-via-app.sh|scripts/hostinger/deploy.sh' 2>/dev/null || true
else
  if running; then
    echo "Deploy process still running:"
    pgrep -af '/usr/local/sbin/deploy-newproject|deploy-newproject.sh|deploy-via-app.sh|scripts/hostinger/deploy.sh|newproject-deploy.service' 2>/dev/null || true
    echo ""
    echo "Wait for it to finish, or run with --force:"
    echo "  sudo bash $0 --force"
    exit 1
  fi
fi

rm -f "$LOCK_FILE" "$PID_FILE" "$APP_LOCK_FILE" "$AUTO_LOCK"
systemctl stop newproject-deploy.service 2>/dev/null || true
systemctl reset-failed newproject-deploy.service 2>/dev/null || true
echo "Deploy lock cleared."
