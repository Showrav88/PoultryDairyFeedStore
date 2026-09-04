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

FORCE=false
if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

running() {
  pgrep -af '/usr/local/sbin/deploy-newproject|deploy-newproject.sh|deploy-via-app.sh' 2>/dev/null || true
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
  pkill -TERM -f 'deploy-newproject.sh|deploy-via-app.sh' 2>/dev/null || true
  sleep 2
  pkill -KILL -f 'deploy-newproject.sh|deploy-via-app.sh' 2>/dev/null || true
else
  if running | grep -q .; then
    echo "Deploy process still running:"
    running
    echo ""
    echo "Wait for it to finish, or run with --force:"
    echo "  sudo bash $0 --force"
    exit 1
  fi
fi

rm -f "$LOCK_FILE" "$PID_FILE" "$APP_LOCK_FILE"
echo "Deploy lock cleared."
echo "Restart app:  sudo systemctl restart newproject-api.service"
echo "Run deploy:   sudo /usr/local/sbin/deploy-newproject"
