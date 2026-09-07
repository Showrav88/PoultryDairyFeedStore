#!/usr/bin/env bash
# Shared build steps for VPS deploy — source from deploy-newproject.sh, deploy-via-app.sh, repair-service.sh
# Prevents npm ci TAR_ENTRY_ERROR from corrupt/partial node_modules or npm cache.
set -Eeuo pipefail

deploy_write_status() {
  local state="$1"
  local sha="${2:-}"
  local msg="${3:-}"
  local status_file="${DEPLOY_STATUS_FILE:-}"
  [[ -n "$status_file" ]] || return 0
  printf '{"state":"%s","sha":"%s","message":"%s","updatedAt":"%s"}\n' \
    "$state" "$sha" "$msg" "$(date -Is)" > "$status_file"
}

deploy_stop_node_processes() {
  local app_dir="${1:?APP_DIR required}"
  echo "Stopping app processes that may lock node_modules ..."
  if [[ "$(id -u)" -eq 0 ]]; then
    systemctl stop newproject-api.service 2>/dev/null || true
    sleep 2
    if command -v fuser >/dev/null 2>&1; then
      fuser -k 5001/tcp 2>/dev/null || true
    fi
  else
    sudo -n systemctl stop newproject-api.service 2>/dev/null || true
    sleep 1
  fi
  pkill -u "$(whoami)" -f "${app_dir}/node_modules" 2>/dev/null || true
  pkill -u "$(whoami)" -f "next start" 2>/dev/null || true
  pkill -u "$(whoami)" -f "next-server" 2>/dev/null || true
  sleep 1
}

deploy_npm_ci() {
  local app_dir="${1:?APP_DIR required}"
  local attempt
  local npm_cache="/tmp/npm-cache-newproject-$(id -u)-$$"

  export NPM_CONFIG_CACHE="$npm_cache"
  export NPM_CONFIG_FUND=false
  export NPM_CONFIG_AUDIT=false

  rm -rf "$npm_cache"
  mkdir -p "$npm_cache"

  echo "Cleaning npm cache ..."
  npm cache clean --force 2>/dev/null || true

  for attempt in 1 2 3; do
    echo "npm ci (attempt ${attempt}/3) ..."
    if npm ci --include=dev --no-audit --no-fund --maxsockets 1; then
      rm -rf "$npm_cache"
      return 0
    fi
    echo "npm ci attempt ${attempt} failed — removing node_modules and retrying ..."
    rm -rf node_modules "$npm_cache"
    mkdir -p "$npm_cache"
    npm cache clean --force 2>/dev/null || true
    sleep 2
  done

  rm -rf "$npm_cache"
  echo "ERROR: npm ci failed after 3 attempts"
  return 1
}

deploy_build_app() {
  local app_dir="${1:?APP_DIR required}"
  local sha="${DEPLOYING_SHA:-}"

  cd "$app_dir"

  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL missing in .env — cannot migrate or build."
    exit 1
  fi

  deploy_stop_node_processes "$app_dir"

  deploy_write_status "building" "$sha" "Removing old dependencies"

  echo "Removing old node_modules and .next ..."
  rm -rf node_modules .next
  # Drop any partial tree from a failed prior run
  find "$app_dir" -maxdepth 1 -name 'node_modules.*' -type d -exec rm -rf {} + 2>/dev/null || true

  deploy_write_status "building" "$sha" "Running npm ci"
  deploy_npm_ci "$app_dir"

  deploy_write_status "building" "$sha" "Running database migrations"
  echo "prisma migrate deploy ..."
  npx prisma migrate deploy

  deploy_write_status "building" "$sha" "Building Next.js app"
  echo "npm run build ..."
  npm run build
}
