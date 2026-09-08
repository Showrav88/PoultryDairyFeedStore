#!/usr/bin/env bash
# Shared deploy lock helpers for newproject (webhook + cron). Source from other scripts.
set -Eeuo pipefail

NEWPROJECT_APP_DIR="${NEWPROJECT_APP_DIR:-/var/www/NEWPROJECT}"
NEWPROJECT_ROOT_LOCK="/var/lock/newproject-deploy.lock"
NEWPROJECT_ROOT_PID="/var/lock/newproject-deploy.pid"
NEWPROJECT_APP_LOCK="${NEWPROJECT_APP_DIR}/.deploy.lock"
STALE_ACTIVE_SEC="${NEWPROJECT_STALE_ACTIVE_SEC:-180}"

# True when a deploy process is actually running (not a stuck systemd unit alone).
newproject_deploy_process_running() {
  if [[ -f "$NEWPROJECT_ROOT_PID" ]]; then
    local pid cmd
    pid="$(tr -d '[:space:]' < "$NEWPROJECT_ROOT_PID" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
      if [[ "$cmd" == *deploy-newproject* || "$cmd" == *deploy-newproject.sh* ]]; then
        return 0
      fi
      rm -f "$NEWPROJECT_ROOT_PID"
    else
      rm -f "$NEWPROJECT_ROOT_PID"
    fi
  fi

  local pid cmd
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    [[ -z "$cmd" ]] && continue
    [[ "$cmd" == *webhook-deploy* ]] && continue
    [[ "$cmd" == *pre-webhook-prepare* ]] && continue
    [[ "$cmd" == *pgrep* ]] && continue
    if [[ "$cmd" == *deploy-newproject* || "$cmd" == *deploy-newproject.sh* || "$cmd" == *trigger-newproject-deploy* ]]; then
      return 0
    fi
  done < <(pgrep -f '/usr/local/sbin/deploy-newproject|deploy/deploy-newproject\.sh|trigger-newproject-deploy' 2>/dev/null || true)

  return 1
}

# Clear stuck .deploy-status (running/started with no live process).
newproject_clear_stale_deploy_status() {
  local status_file="${NEWPROJECT_APP_DIR}/.deploy-status"
  [[ -f "$status_file" ]] || return 0
  if newproject_deploy_process_running; then
    return 1
  fi
  local state updated_at age_sec now
  state="$(grep -o '"state"[[:space:]]*:[[:space:]]*"[^"]*"' "$status_file" 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)"
  case "$state" in
    started|pulling|building|restarting|running)
      updated_at="$(grep -o '"updatedAt"[[:space:]]*:[[:space:]]*"[^"]*"' "$status_file" 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)"
      if [[ -n "$updated_at" ]]; then
        now="$(date +%s)"
        age_sec=$(( now - $(date -d "$updated_at" +%s 2>/dev/null || echo "$now") ))
        if [[ "$age_sec" -lt "$STALE_ACTIVE_SEC" ]]; then
          return 1
        fi
      fi
      rm -f "$status_file"
      ;;
  esac
  return 0
}

# Remove orphan lock files when nothing is deploying.
newproject_clear_stale_deploy_locks() {
  if newproject_deploy_process_running; then
    return 1
  fi
  rm -f "$NEWPROJECT_ROOT_LOCK" "$NEWPROJECT_ROOT_PID" "$NEWPROJECT_APP_LOCK"
  systemctl stop newproject-deploy.service 2>/dev/null || true
  systemctl reset-failed newproject-deploy.service 2>/dev/null || true
  newproject_clear_stale_deploy_status || true
  return 0
}
