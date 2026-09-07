#!/usr/bin/env bash
# Poll GitHub main every cron run; deploy only when origin/main changed.
# Logs to /var/log/newproject-auto-deploy.log (newproject only).
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/NEWPROJECT}"
APP_USER="${APP_USER:-newproject}"
BRANCH="${DEPLOY_BRANCH:-main}"
LOG_FILE="/var/log/newproject-auto-deploy.log"
DEPLOY_SCRIPT="${APP_DIR}/scripts/hostinger/deploy.sh"
AUTO_LOCK="/var/lock/newproject-auto-deploy.lock"

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"
chmod 644 "$LOG_FILE" 2>/dev/null || true

exec >>"$LOG_FILE" 2>&1

log() {
  echo "$(date -Is) [newproject/auto-deploy] $*"
}

log "=== run start (branch=${BRANCH}) ==="

# shellcheck disable=SC1091
source "${APP_DIR}/deploy/deploy-lock.sh"

if newproject_deploy_process_running; then
  log "Deploy process active (webhook/systemd/hostinger) — skip"
  exit 0
fi

if newproject_clear_stale_deploy_locks; then
  log "Cleared stale deploy lock files (no active process)"
fi

exec 9>"$AUTO_LOCK"
if ! flock -n 9; then
  log "Another auto-deploy instance running — skip"
  exit 0
fi

if [[ ! -x "$DEPLOY_SCRIPT" ]]; then
  log "ERROR: missing deploy script: $DEPLOY_SCRIPT"
  exit 1
fi

git -C "$APP_DIR" config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

log "git fetch origin/${BRANCH} ..."
sudo -u "$APP_USER" -H git -C "$APP_DIR" fetch origin "$BRANCH"

LOCAL_SHA="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "")"
REMOTE_SHA="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse "origin/${BRANCH}" 2>/dev/null || echo "")"

if [[ -z "$LOCAL_SHA" || -z "$REMOTE_SHA" ]]; then
  log "ERROR: could not resolve git SHAs"
  exit 1
fi

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  log "No change on origin/${BRANCH} (${LOCAL_SHA:0:7}) — skip deploy"
  exit 0
fi

log "Change detected ${LOCAL_SHA:0:7} -> ${REMOTE_SHA:0:7} — syncing repo"

if [[ "$(id -u)" -eq 0 ]]; then
  chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
fi

sudo -u "$APP_USER" -H git -C "$APP_DIR" checkout -f "$BRANCH"
sudo -u "$APP_USER" -H git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
sudo -u "$APP_USER" -H git -C "$APP_DIR" clean -fd \
  -e .env \
  -e .env.local \
  -e node_modules \
  -e .next \
  -e logs \
  -e .deploy-sha \
  -e .deploy-status \
  -e .deploy.lock \
  -e src/generated

if [[ "$(id -u)" -eq 0 ]]; then
  bash "$DEPLOY_SCRIPT"
else
  sudo bash "$DEPLOY_SCRIPT"
fi

log "=== run end ==="
