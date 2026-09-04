#!/usr/bin/env bash
# Deploy without root — run by the Next.js app user via /api/deploy webhook.
# Pulls latest code, builds, migrates, then restarts by stopping the app port (systemd Restart=always).
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
LOCK_FILE="${APP_DIR}/.deploy.lock"
LOG_FILE="${APP_DIR}/logs/deploy.log"
STATUS_FILE="${APP_DIR}/.deploy-status"
PORT="${APP_PORT:-5001}"

mkdir -p "${APP_DIR}/logs"

exec >>"$LOG_FILE" 2>&1

write_status() {
  local state="$1"
  local sha="${2:-}"
  local msg="${3:-}"
  printf '{"state":"%s","sha":"%s","message":"%s","updatedAt":"%s"}\n' \
    "$state" "$sha" "$msg" "$(date -Is)" > "$STATUS_FILE"
}

on_error() {
  echo "App deploy failed at line $1 (exit $2)"
  write_status "failed" "$(cat "${APP_DIR}/.deploy-sha" 2>/dev/null || echo "")" "Deploy failed at line $1"
  exit "$2"
}
trap 'on_error $LINENO $?' ERR

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "Another app deploy is already running."
  write_status "running" "" "Deploy already in progress"
  exit 1
fi

cd "$APP_DIR"

echo "=== App deploy started $(date -Is) (user=$(whoami)) ==="
write_status "started" "" "Deploy started"

git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
export GIT_TERMINAL_PROMPT=0

write_status "pulling" "" "Fetching latest code"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

DEPLOYING_SHA="$(git rev-parse --short HEAD)"
echo "$DEPLOYING_SHA" > "$APP_DIR/.deploy-sha"
echo "Building commit $DEPLOYING_SHA ..."
write_status "building" "$DEPLOYING_SHA" "Installing dependencies and building"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

npm ci
npm run build
npx prisma migrate deploy

write_status "restarting" "$DEPLOYING_SHA" "Restarting application"

# Graceful restart via systemd (preferred). Do NOT use fuser -k — it causes site downtime.
if sudo -n systemctl restart newproject-api.service 2>/dev/null; then
  echo "Restarted via sudo systemctl"
elif systemctl restart newproject-api.service 2>/dev/null; then
  echo "Restarted via systemctl"
else
  echo "WARNING: Could not restart service. Run on VPS:"
  echo "  sudo systemctl restart newproject-api.service"
  write_status "failed" "$DEPLOYING_SHA" "Could not restart service — run sudo systemctl restart newproject-api.service"
  exit 1
fi

sleep 5

for attempt in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    SHA="$(git rev-parse --short HEAD)"
    echo "$SHA" > "$APP_DIR/.deploy-sha"
    write_status "ready" "$SHA" "Deployment healthy"
    echo "App deploy healthy: $SHA"
    exit 0
  fi
  echo "Health check attempt ${attempt}/30 ..."
  sleep 4
done

write_status "failed" "$DEPLOYING_SHA" "Health check failed after restart"
exit 1
