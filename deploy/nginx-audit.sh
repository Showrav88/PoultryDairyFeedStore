#!/usr/bin/env bash
# Audit nginx + app health for all VPS apps (ports 80, 8080, 8081).
# Run on VPS as root:
#   sudo bash /var/www/NEWPROJECT/deploy/nginx-audit.sh
set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}OK${NC}  $*"; }
warn() { echo -e "${YELLOW}WARN${NC} $*"; }
fail() { echo -e "${RED}FAIL${NC} $*"; }

echo "=== VPS nginx + apps audit ==="
echo "Time: $(date -Is)"
echo

echo "--- Listening ports (80, 8080, 8081, 5001) ---"
ss -ltnp | grep -E ':(80|8080|8081|5001)\b' || warn "No expected ports found"
echo

echo "--- Enabled nginx sites ---"
if [[ -d /etc/nginx/sites-enabled ]]; then
  ls -la /etc/nginx/sites-enabled/
else
  warn "No /etc/nginx/sites-enabled"
fi
echo

echo "--- nginx config test ---"
if nginx -t 2>&1; then
  ok "nginx -t passed"
else
  fail "nginx -t failed"
fi
echo

echo "--- Port → nginx server blocks ---"
grep -RnsE 'listen[[:space:]]+(80|8080|8081)' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null || true
echo

check_url() {
  local label="$1"
  local url="$2"
  local code
  code="$(curl -sS -o /dev/null -m 8 -w '%{http_code}' "$url" 2>/dev/null || echo "000")"
  if [[ "$code" =~ ^(200|301|302|307|308)$ ]]; then
    ok "$label $url → HTTP $code"
  else
    fail "$label $url → HTTP $code"
  fi
}

echo "--- Public HTTP checks ---"
check_url "Port 80"   "http://127.0.0.1/"
check_url "Port 8080" "http://127.0.0.1:8080/"
check_url "Port 8081 login" "http://127.0.0.1:8081/login"
check_url "Port 8081 health" "http://127.0.0.1:8081/api/health"
echo

echo "--- Feed Store (NEWPROJECT) internal ---"
if systemctl is-active --quiet newproject-api.service; then
  ok "newproject-api.service is active"
else
  fail "newproject-api.service is NOT active"
  systemctl status newproject-api.service --no-pager -n 5 || true
fi

if curl -fsS -m 5 http://127.0.0.1:5001/api/health >/tmp/feed-health.json 2>/dev/null; then
  ok "127.0.0.1:5001/api/health → $(tr -d '\n' < /tmp/feed-health.json)"
else
  fail "127.0.0.1:5001/api/health unreachable"
fi
echo

echo "--- Feed Store static chunks (after deploy, must be 200) ---"
HTML="$(curl -fsS -m 8 http://127.0.0.1:8081/login 2>/dev/null || true)"
CHUNK="$(echo "$HTML" | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1)"
if [[ -n "$CHUNK" ]]; then
  check_url "Login chunk" "http://127.0.0.1:8081${CHUNK}"
else
  warn "Could not extract chunk URL from /login HTML"
fi
echo

echo "--- Recent nginx errors (feed store) ---"
if [[ -f /var/log/nginx/newproject.error.log ]]; then
  tail -n 15 /var/log/nginx/newproject.error.log || true
else
  warn "No /var/log/nginx/newproject.error.log"
fi
echo

echo "--- Expected app mapping ---"
cat <<'EOF'
Port 80   → Jewelry MS (default site)
Port 8080 → Your 3rd app
Port 8081 → Feed Store (NEWPROJECT) → proxy 127.0.0.1:5001

Feed Store URL: http://31.97.50.25:8081/login
Do NOT use port 80 for Feed Store.
EOF

echo
echo "=== If browser shows 'This page could not load' on /dashboard ==="
echo "1. Hard refresh: Ctrl+Shift+R (stale JS after deploy)"
echo "2. Or open Incognito → http://31.97.50.25:8081/login"
echo "3. Re-apply feed nginx: sudo install -m 644 /var/www/NEWPROJECT/deploy/nginx-newproject.conf /etc/nginx/sites-available/newproject && sudo nginx -t && sudo systemctl reload nginx"
