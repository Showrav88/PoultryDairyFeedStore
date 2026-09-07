#!/usr/bin/env bash
# Hostinger VPS deploy for Poultry Feed Store (newproject only — not AnantaOne / jewelryms).
# Run as root:
#   sudo bash /var/www/NEWPROJECT/scripts/hostinger/deploy.sh
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/NEWPROJECT}"
APP_USER="${APP_USER:-newproject}"
SERVICE="newproject-api.service"
NGINX_SITE="newproject"
STATUS_FILE="${APP_DIR}/.deploy-status"
API_PORT="${APP_PORT:-5001}"

log() {
  echo "$(date -Is) [newproject/deploy] $*"
}

write_status() {
  local state="$1"
  local sha="${2:-}"
  local msg="${3:-}"
  printf '{"state":"%s","sha":"%s","message":"%s","updatedAt":"%s"}\n' \
    "$state" "$sha" "$msg" "$(date -Is)" > "$STATUS_FILE"
  chown "${APP_USER}:${APP_USER}" "$STATUS_FILE" 2>/dev/null || true
}

on_error() {
  log "FAILED at line $1 (exit $2)"
  write_status "failed" "$(cat "${APP_DIR}/.deploy-sha" 2>/dev/null || echo "")" "Hostinger deploy failed at line $1"
  exit "$2"
}
trap 'on_error $LINENO $?' ERR

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "ERROR: repo missing at $APP_DIR"
  exit 1
fi

DEPLOYING_SHA="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "")"
log "Deploying commit ${DEPLOYING_SHA:-unknown} ..."
write_status "building" "$DEPLOYING_SHA" "Hostinger cron deploy: npm ci, migrate, build"

chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

sudo -u "${APP_USER}" -H bash -lc "
  set -Eeuo pipefail
  export DEPLOYING_SHA='${DEPLOYING_SHA}'
  export DEPLOY_STATUS_FILE='${STATUS_FILE}'
  # shellcheck disable=SC1091
  source '${APP_DIR}/deploy/build-app.sh'
  deploy_build_app '${APP_DIR}'
"

write_status "restarting" "$DEPLOYING_SHA" "Starting ${SERVICE}"
log "Starting ${SERVICE} ..."
systemctl start "$SERVICE" 2>/dev/null || systemctl restart "$SERVICE"

log "Waiting for API on port ${API_PORT} ..."
sleep 5
for attempt in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
    SHA="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"
    echo "$SHA" | sudo -u "$APP_USER" tee "${APP_DIR}/.deploy-sha" >/dev/null
    write_status "ready" "$SHA" "Hostinger deploy healthy"
    log "App healthy at ${SHA}"
    break
  fi
  sleep 3
done

if [[ -f "/etc/nginx/sites-enabled/${NGINX_SITE}" || -f "/etc/nginx/sites-available/${NGINX_SITE}" ]]; then
  log "Reloading nginx (${NGINX_SITE}, port 8081) ..."
  nginx -t
  systemctl reload nginx
else
  log "Nginx site ${NGINX_SITE} not found — skipping reload"
fi

if ! curl --fail --silent "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
  log "ERROR: health check failed after deploy"
  write_status "failed" "$DEPLOYING_SHA" "Health check failed"
  exit 1
fi

log "Deploy finished OK"
