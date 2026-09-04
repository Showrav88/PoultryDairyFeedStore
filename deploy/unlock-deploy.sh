#!/usr/bin/env bash
# Clear a stuck deploy lock (safe when no deploy is actually running).
#   sudo bash /var/www/NEWPROJECT/deploy/unlock-deploy.sh
set -Eeuo pipefail

LOCK_FILE="/var/lock/newproject-deploy.lock"
PID_FILE="/var/lock/newproject-deploy.pid"

if pgrep -af '/usr/local/sbin/deploy-newproject|deploy-newproject.sh' >/dev/null 2>&1; then
  echo "Deploy process still running:"
  pgrep -af '/usr/local/sbin/deploy-newproject|deploy-newproject.sh' || true
  echo "Wait for it to finish, or stop it before unlocking."
  exit 1
fi

rm -f "$LOCK_FILE" "$PID_FILE"
echo "Deploy lock cleared. You can run: sudo /usr/local/sbin/deploy-newproject"
