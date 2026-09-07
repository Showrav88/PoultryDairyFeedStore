#!/usr/bin/env bash
# Verify no secrets or VPS runtime files are tracked by git.
# Run in CI or locally: bash deploy/check-no-secrets-in-git.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

check_not_tracked() {
  local pattern="$1"
  local desc="$2"
  if git ls-files --cached | grep -qE "$pattern"; then
    echo "FAIL: tracked file matches $desc:"
    git ls-files --cached | grep -E "$pattern" || true
    FAIL=1
  fi
}

check_not_tracked '^\.env$' '.env'
if git ls-files --cached | grep -E '^\.env\.' | grep -qv '^\.env\.example$'; then
  echo "FAIL: tracked .env variant (not .env.example):"
  git ls-files --cached | grep -E '^\.env\.' | grep -v '^\.env\.example$'
  FAIL=1
fi
check_not_tracked '^\.deploy-' 'deploy runtime (.deploy-sha, etc.)'
check_not_tracked '^logs/' 'VPS deploy logs'
check_not_tracked '\.(pem|key)$' 'key files'
check_not_tracked 'id_rsa|id_ed25519|github_actions' 'SSH private keys'

# Scan tracked files for accidental secret literals (exclude examples and docs)
while IFS= read -r file; do
  [[ "$file" == .env.example ]] && continue
  [[ "$file" == DEPLOYMENT.md ]] && continue
  [[ "$file" == deploy/* ]] && continue
  if grep -qE 'postgresql://[^@]+:[^@]+@|JWT_SECRET="[^"]{20,}"|DEPLOY_WEBHOOK_SECRET="[^"]{16,}"' "$file" 2>/dev/null; then
    echo "FAIL: possible hardcoded secret in tracked file: $file"
    FAIL=1
  fi
done < <(git ls-files)

if [[ "$FAIL" -eq 0 ]]; then
  echo "OK: no secrets or VPS runtime files tracked in git."
  exit 0
fi

echo ""
echo "Remove from git: git rm --cached <file>  (keep file on disk)"
exit 1
