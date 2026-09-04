#!/usr/bin/env bash
# One-time VPS setup so GitHub Actions can auto-deploy on every push to main.
# Run on the VPS as root:
#   sudo bash /var/www/NEWPROJECT/deploy/setup-github-actions-deploy.sh
set -Eeuo pipefail

DEPLOY_USER="newproject"
DEPLOY_CMD="/usr/local/sbin/deploy-newproject"
KEY_PATH="/home/${DEPLOY_USER}/.ssh/github_actions"
SUDOERS_FILE="/etc/sudoers.d/newproject-deploy"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "User '$DEPLOY_USER' does not exist. Complete initial VPS setup first."
  exit 1
fi

install -m 700 -d "/home/${DEPLOY_USER}/.ssh"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"

if [[ ! -f "$KEY_PATH" ]]; then
  sudo -u "$DEPLOY_USER" ssh-keygen -t ed25519 -N '' \
    -C "github-actions-newproject" \
    -f "$KEY_PATH"
fi

AUTH_KEYS="/home/${DEPLOY_USER}/.ssh/authorized_keys"
PUB_KEY="$(cat "${KEY_PATH}.pub")"
if [[ ! -f "$AUTH_KEYS" ]] || ! grep -qF "$PUB_KEY" "$AUTH_KEYS"; then
  sudo -u "$DEPLOY_USER" sh -c "cat '${KEY_PATH}.pub' >> '${AUTH_KEYS}'"
fi
chmod 600 "$AUTH_KEYS"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "$AUTH_KEYS"

if [[ ! -x "$DEPLOY_CMD" ]]; then
  echo "Deploy command missing at $DEPLOY_CMD"
  echo "Install deploy script first (see DEPLOYMENT.md)."
  exit 1
fi

echo "${DEPLOY_USER} ALL=(root) NOPASSWD: ${DEPLOY_CMD}" > "$SUDOERS_FILE"
chmod 440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE"

VPS_HOST="$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"

cat <<EOF

================================================================================
GitHub Actions auto-deploy is ready on this server.
Add these repository secrets (Settings → Secrets and variables → Actions):

  VPS_HOST
$(printf '    %s\n' "$VPS_HOST")

  VPS_USER
    ${DEPLOY_USER}

  VPS_SSH_KEY
$(sed 's/^/    /' "$KEY_PATH")

  VPS_KNOWN_HOSTS
$(ssh-keyscan -H "$VPS_HOST" 2>/dev/null | sed 's/^/    /')

After saving secrets, push to main or re-run the "Deploy to Hostinger VPS" workflow.
================================================================================
EOF
