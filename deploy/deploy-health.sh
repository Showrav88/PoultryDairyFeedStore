#!/usr/bin/env bash
# Return 0 when the live app serves the given short commit (not just git HEAD).
health_deploy_sha() {
  local health deployed
  health="$(curl -sf --max-time 5 http://127.0.0.1:5001/api/health 2>/dev/null || echo "")"
  [[ -n "$health" ]] || return 1
  if command -v jq >/dev/null 2>&1; then
    deployed="$(echo "$health" | jq -r '.deploySha // empty')"
    [[ "$(echo "$health" | jq -r '.status // empty')" == "ok" ]] || return 1
  else
    deployed="$(echo "$health" | grep -o '"deploySha"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)"
  fi
  [[ -n "$deployed" && "$deployed" == "$1" ]]
}
