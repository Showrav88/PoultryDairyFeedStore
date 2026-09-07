#!/usr/bin/env bash
# Shared deploy lock helpers for newproject (webhook + cron). Source from other scripts.
set -Eeuo pipefail

NEWPROJECT_APP_DIR="${NEWPROJECT_APP_DIR:-/var/www/NEWPROJECT}"
NEWPROJECT_ROOT_LOCK="/var/lock/newproject-deploy.lock"
NEWPROJECT_ROOT_PID="/var/lock/newproject-deploy.pid"
NEWPROJECT_APP_LOCK="${NEWPROJECT_APP_DIR}/.deploy.lock"

# True when a webhook/systemd/cron deploy process is actually running.
newproject_deploy_process_running() {
  if systemctl is-active --quiet newproject-deploy.service 2>/dev/null; then
    return 0
  fi

  if [[ -f "$NEWPROJECT_ROOT_PID" ]]; then
    local pid
    pid="$(tr -d '[:space:]' < "$NEWPROJECT_ROOT_PID" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi

  pgrep -af '/usr/local/sbin/deploy-newproject|deploy/deploy-newproject\.sh|deploy-via-app\.sh|scripts/hostinger/deploy\.sh' \
    >/dev/null 2>&1
}

# Remove orphan lock files when nothing is deploying.
newproject_clear_stale_deploy_locks() {
  if newproject_deploy_process_running; then
    return 1
  fi
  rm -f "$NEWPROJECT_ROOT_LOCK" "$NEWPROJECT_ROOT_PID" "$NEWPROJECT_APP_LOCK"
  return 0
}
