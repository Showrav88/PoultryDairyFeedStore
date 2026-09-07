#!/usr/bin/env bash
# Shared build steps for VPS deploy — source from deploy-newproject.sh, deploy-via-app.sh, repair-service.sh
# Prevents npm ci TAR_ENTRY_ERROR from installing over a corrupt/partial node_modules tree.
set -Eeuo pipefail

deploy_build_app() {
  local app_dir="${1:?APP_DIR required}"

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

  echo "Removing old node_modules and .next for clean install ..."
  rm -rf node_modules .next

  echo "npm ci ..."
  npm ci --include=dev --no-audit --no-fund

  echo "prisma migrate deploy ..."
  npx prisma migrate deploy

  echo "npm run build ..."
  npm run build
}
