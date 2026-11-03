#!/usr/bin/env bash
# Pull the latest code from GitHub, rebuild the website and restart the backend.
# Run as root on the VPS:  bash /opt/clarigence/deploy/deploy.sh
set -euo pipefail

APP_DIR=/opt/clarigence
WEB_ROOT=/var/www/clarigence/public

cd "$APP_DIR"
echo "==> Updating code"
git fetch --quiet origin main
git reset --hard --quiet origin/main

echo "==> Building website"
node scripts/build-static.js
mkdir -p "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/"
# On the VPS the website reads content from the database through the backend.
cp deploy/api-config.vps.js "$WEB_ROOT/api-config.js"

echo "==> Building and starting backend + database"
cd deploy
docker compose --env-file .env up -d --build

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
