#!/usr/bin/env bash
# Show whether a deploy is running and recent log lines.
#   sudo bash /var/www/NEWPROJECT/deploy/deploy-status.sh
set -Eeuo pipefail

LOG="/var/log/newproject-deploy.log"
PID_FILE="/var/lock/newproject-deploy.pid"

echo "=== App service ==="
systemctl is-active newproject-api.service && systemctl status newproject-api.service --no-pager -n 0 || true

echo ""
echo "=== Health ==="
curl -sS http://127.0.0.1:5001/api/health 2>/dev/null || echo "health check failed"

echo ""
echo "=== Deploy process ==="
if pgrep -af '/usr/local/sbin/deploy-newproject|deploy-newproject.sh' >/dev/null 2>&1; then
  echo "Deploy RUNNING:"
  pgrep -af '/usr/local/sbin/deploy-newproject|deploy-newproject.sh' || true
elif [[ -f "$PID_FILE" ]]; then
  echo "PID file exists but no deploy process (stale lock?): $(cat "$PID_FILE")"
else
  echo "No deploy running."
fi

echo ""
echo "=== Last deploy log (20 lines) ==="
if [[ -f "$LOG" ]]; then
  tail -20 "$LOG"
else
  echo "No log yet at $LOG"
fi
