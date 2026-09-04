# Hostinger VPS deployment

This project is a Next.js application with Prisma/PostgreSQL. It does not have a
separate Vite frontend and Express API. One Next.js process serves both pages and
`/api` on `127.0.0.1:5001`; nginx exposes it on port `8081`.

## Allocations

- App: `/var/www/NEWPROJECT`
- Internal process: `127.0.0.1:5001`
- Public nginx: `0.0.0.0:8081`
- Database/user: `newproject`
- Service: `newproject-api.service`
- URL: `http://31.97.50.25:8081`

## Initial VPS setup

Merge the deployment branch into `main` before running this setup. Then connect:

```bash
ssh root@31.97.50.25
```

### 1. Verify ports before changing anything

```bash
sudo ss -ltnp | grep -E ':(80|8080|8081|5000|5001|5284)\b' || true

if sudo ss -ltnH 'sport = :8081' | grep -q .; then
  echo "ABORT: nginx port 8081 is already occupied"
  exit 1
fi

if sudo ss -ltnH 'sport = :5001' | grep -q .; then
  echo "ABORT: internal port 5001 is already occupied"
  exit 1
fi
```

Do not continue if either abort message appears. Pick another unused pair and
update both deployment configuration files first.

### 2. Install required software

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx postgresql-client openssl

if ! command -v node >/dev/null || \
   [ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

node --version
npm --version
```

The PostgreSQL server is already present according to the allocation. Verify it:

```bash
sudo systemctl is-active postgresql
sudo -u postgres psql -c "SELECT version();"
```

### 3. Create an isolated PostgreSQL user and database

The command generates a strong hexadecimal password so it is safe inside the
connection URL without additional URL encoding.

```bash
DB_USER=newproject
DB_NAME=newproject
DB_PASS="$(openssl rand -hex 24)"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER SCHEMA public OWNER TO ${DB_USER};
SQL

PGPASSWORD="$DB_PASS" psql \
  -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;"
```

Keep this shell open until `.env` is created in step 5 because `DB_PASS` exists
only in this shell.

### 4. Create the service user and clone the public repository

```bash
id newproject >/dev/null 2>&1 || \
  sudo useradd --system --create-home --home-dir /home/newproject \
    --shell /bin/bash newproject

sudo install -d -o newproject -g newproject /var/www/NEWPROJECT

if [ ! -d /var/www/NEWPROJECT/.git ]; then
  sudo -u newproject git clone \
    https://github.com/Showrav88/PoultryDairyFeedStore.git \
    /var/www/NEWPROJECT
fi

sudo -u newproject git -C /var/www/NEWPROJECT checkout main
```

### 5. Create the production environment file

`.env` is ignored by Git and must remain only on the VPS.

```bash
JWT_SECRET="$(openssl rand -hex 48)"

sudo tee /var/www/NEWPROJECT/.env >/dev/null <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
JWT_SECRET="${JWT_SECRET}"
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
EOF

sudo chown newproject:newproject /var/www/NEWPROJECT/.env
sudo chmod 600 /var/www/NEWPROJECT/.env
unset DB_PASS JWT_SECRET
```

There is no `VITE_API_URL` in this Next.js app. Browser requests already use
same-origin `/api` routes.

### 6. Install the systemd service and deployment command

```bash
sudo install -m 644 \
  /var/www/NEWPROJECT/deploy/newproject-api.service \
  /etc/systemd/system/newproject-api.service

sudo install -m 750 \
  /var/www/NEWPROJECT/deploy/deploy-newproject.sh \
  /usr/local/sbin/deploy-newproject

sudo systemctl daemon-reload
sudo systemctl enable newproject-api.service
```

### 7. Install exactly one nginx site on port 8081

Check that no existing site already owns this listen/server combination:

```bash
sudo grep -RnsE 'listen[[:space:]]+8081|server_name[[:space:]]+31\.97\.50\.25' \
  /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null || true
```

If a different config already listens on `8081`, stop and resolve the conflict.
Otherwise:

```bash
sudo install -m 644 \
  /var/www/NEWPROJECT/deploy/nginx-newproject.conf \
  /etc/nginx/sites-available/newproject

sudo ln -sfn \
  /etc/nginx/sites-available/newproject \
  /etc/nginx/sites-enabled/newproject

sudo nginx -t
```

This does not change the existing port `80` default server or port `8080`.

### 8. First build, migration and startup

```bash
sudo /usr/local/sbin/deploy-newproject
sudo systemctl reload nginx

sudo systemctl status newproject-api.service --no-pager
curl -fsS http://127.0.0.1:5001/api/health
curl -fsS http://31.97.50.25:8081/api/health
```

If UFW is active:

```bash
sudo ufw allow 8081/tcp
sudo ufw status
```

Open `http://31.97.50.25:8081`.

## Automatic deployment after every push to main

The included GitHub Actions workflow calls the deployment command after each
push to `main`.

### 1. Create an SSH key for GitHub Actions on the VPS

```bash
sudo -u newproject install -m 700 -d /home/newproject/.ssh
sudo -u newproject ssh-keygen -t ed25519 -N '' \
  -C github-actions-newproject \
  -f /home/newproject/.ssh/github_actions

sudo -u newproject sh -c \
  'cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys'
sudo chmod 600 /home/newproject/.ssh/authorized_keys

echo 'newproject ALL=(root) NOPASSWD: /usr/local/sbin/deploy-newproject' \
  | sudo tee /etc/sudoers.d/newproject-deploy
sudo chmod 440 /etc/sudoers.d/newproject-deploy
sudo visudo -cf /etc/sudoers.d/newproject-deploy
```

### 2. Add GitHub repository secrets

In GitHub, open **Settings → Secrets and variables → Actions** and add:

- `VPS_HOST`: `31.97.50.25`
- `VPS_USER`: `newproject`
- `VPS_SSH_KEY`: output of:

  ```bash
  sudo cat /home/newproject/.ssh/github_actions
  ```

- `VPS_KNOWN_HOSTS`: run this on a trusted computer and paste the output:

  ```bash
  ssh-keyscan -H 31.97.50.25
  ```

Every push to `main` will then:

1. serialize deployments with a lock;
2. fetch and fast-forward the VPS checkout;
3. run `npm ci`, tests and the production build;
4. apply pending Prisma migrations;
5. restart only `newproject-api.service`;
6. verify `/api/health`.

## Operations

```bash
# Logs
sudo journalctl -u newproject-api.service -f
sudo tail -f /var/log/nginx/newproject.error.log

# Manual deployment
sudo /usr/local/sbin/deploy-newproject

# Verify occupied ports
sudo ss -ltnp | grep -E ':(8081|5001)\b'

# Rollback
cd /var/www/NEWPROJECT
sudo -u newproject git log --oneline -10
# Revert the bad commit in Git and push the revert to main; automation redeploys it.
```
