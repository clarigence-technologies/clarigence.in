#!/usr/bin/env bash
# Pull the latest code from GitHub, rebuild the website and restart the backend.
# Run as root on the VPS:  bash /opt/clarigence/deploy/deploy.sh
# Everything is built and tested first; the live site only changes once all builds succeed.
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

APP_DIR=/opt/clarigence
WEB_ROOT=/var/www/clarigence/public

cd "$APP_DIR"
echo "==> Updating code"
git fetch --quiet origin main
git reset --hard --quiet origin/main

# Add settings introduced in newer versions of .env.example without touching existing values.
while IFS= read -r line; do
  key="${line%%=*}"
  case "$line" in [A-Z]*=*) grep -q "^$key=" deploy/.env || echo "$line" >> deploy/.env ;; esac
done < deploy/.env.example

echo "==> Building website"
node scripts/build-static.js

echo "==> Building backend (runs the backend tests)"
(cd deploy && docker compose --env-file .env build backend)

echo "==> Publishing website"
mkdir -p "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/"
# On the VPS the website reads content from the database through the backend.
cp deploy/api-config.vps.js "$WEB_ROOT/api-config.js"

echo "==> Updating Nginx"
install -m 644 deploy/nginx-clarigence-locations.conf /etc/nginx/snippets/clarigence-locations.conf
if [ -f /etc/letsencrypt/live/clarigence.in/fullchain.pem ]; then site=nginx-clarigence-ssl.conf; else site=nginx-clarigence.conf; fi
install -m 644 "deploy/$site" /etc/nginx/sites-available/clarigence
ln -sf /etc/nginx/sites-available/clarigence /etc/nginx/sites-enabled/clarigence
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Starting backend + database"
cd deploy
docker compose --env-file .env up -d

echo "==> Waiting for the backend"
for attempt in $(seq 1 60); do
  if curl -fsS -o /dev/null http://127.0.0.1:8080/api/services; then
    echo "    Backend is up."
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 3
done
echo "Backend did not start. Recent logs:"
docker compose logs --tail=80 backend
exit 1
