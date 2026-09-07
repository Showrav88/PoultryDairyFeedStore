#!/usr/bin/env bash
# Sync VPS checkout to origin exactly (discard local edits / stray untracked deploy files).
# Preserves .env, node_modules, .next, logs, and deploy status files.
set -Eeuo pipefail

APP_DIR="${1:-/var/www/NEWPROJECT}"
BRANCH="${2:-main}"

git -C "$APP_DIR" config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

echo "Fetching origin/${BRANCH} ..."
git -C "$APP_DIR" fetch origin "$BRANCH"

echo "Resetting working tree to origin/${BRANCH} (VPS must match GitHub exactly) ..."
git -C "$APP_DIR" checkout -f "$BRANCH"
git -C "$APP_DIR" reset --hard "origin/${BRANCH}"

# Remove untracked files that block future checkouts (keep runtime data).
git -C "$APP_DIR" clean -fd \
  -e .env \
  -e .env.local \
  -e node_modules \
  -e .next \
  -e logs \
  -e .deploy-sha \
  -e .deploy-status \
  -e .deploy.lock \
  -e src/generated

echo "Checkout at $(git -C "$APP_DIR" rev-parse --short HEAD)"
