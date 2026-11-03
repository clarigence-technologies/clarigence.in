#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu (22.04 or newer) Hostinger VPS for clarigence.in.
# deploy.sh (run at the end) installs the Nginx site and starts the containers.
# Run as root:  bash setup-server.sh admin@yourdomain.com
# Safe to run again; existing passwords and data are kept.
set -euo pipefail

ADMIN_EMAIL_ARG="${1:-}"
REPO_URL="${REPO_URL:-https://github.com/clarigence-technologies/clarigence.in.git}"
APP_DIR=/opt/clarigence
ENV_FILE="$APP_DIR/deploy/.env"

[ "$(id -u)" -eq 0 ] || { echo "Run this script as root."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "==> Installing system packages"
apt-get update -y
apt-get install -y ca-certificates curl git rsync nginx certbot python3-certbot-nginx ufw openssl

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js (used to build the static pages)"
  apt-get install -y nodejs
fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "==> Ubuntu's Node.js is too old; installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Firewall: allow SSH, HTTP and HTTPS only"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Fetching the website code"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin main
  git -C "$APP_DIR" reset --hard --quiet origin/main
else
  git clone --quiet "$REPO_URL" "$APP_DIR"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "==> Creating private settings file $ENV_FILE"
  [ -n "$ADMIN_EMAIL_ARG" ] || { echo "Pass the admin login email: bash setup-server.sh you@example.com"; exit 1; }
  cp "$APP_DIR/deploy/.env.example" "$ENV_FILE"
  admin_password="$(openssl rand -base64 18 | tr -d '/+=')Aa1!"
  sed -i \
    -e "s|^DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -hex 24)|" \
    -e "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)|" \
    -e "s|^ADMIN_BOOTSTRAP_ENABLED=.*|ADMIN_BOOTSTRAP_ENABLED=true|" \
    -e "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=$ADMIN_EMAIL_ARG|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$admin_password|" \
    -e "s|^SESSION_COOKIE_SECURE=.*|SESSION_COOKIE_SECURE=false|" \
    "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  umask 077
  printf 'Admin login: %s\nPassword:    %s\n' "$ADMIN_EMAIL_ARG" "$admin_password" > /root/clarigence-admin-login.txt
  echo "    Admin login saved to /root/clarigence-admin-login.txt (readable by root only)."
fi

systemctl enable --now nginx

echo "==> Daily database backup (03:15, keeps 14 days in /var/backups/clarigence)"
install -d -m 700 /var/backups/clarigence
cat > /etc/cron.d/clarigence-backup <<'CRON'
15 3 * * * root cd /opt/clarigence/deploy && docker compose exec -T database sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction clarigence' | gzip > /var/backups/clarigence/clarigence-$(date +\%F).sql.gz && find /var/backups/clarigence -name '*.sql.gz' -mtime +14 -delete
CRON

echo "==> Automatic deploy: checks GitHub main every 2 minutes (log: /var/log/clarigence-deploy.log)"
# The deploy run at the end of this script covers the current commit, so cron starts from the next push.
mkdir -p /var/lib/clarigence
git -C "$APP_DIR" rev-parse HEAD | tee /var/lib/clarigence/last-attempted > /var/lib/clarigence/last-deployed
cat > /etc/cron.d/clarigence-auto-deploy <<'CRON'
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/2 * * * * root bash /opt/clarigence/deploy/auto-deploy.sh >> /var/log/clarigence-deploy.log 2>&1
CRON
cat > /etc/logrotate.d/clarigence-deploy <<'ROTATE'
/var/log/clarigence-deploy.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
ROTATE

bash "$APP_DIR/deploy/deploy.sh"

echo
echo "Setup complete. Test the site at http://$(curl -fsS -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')/"
echo "Admin panel: /admin  (login details: cat /root/clarigence-admin-login.txt)"
