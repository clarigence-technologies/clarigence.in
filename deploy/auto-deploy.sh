#!/usr/bin/env bash
# Automatic sync from GitHub. Cron runs this every 2 minutes (see setup-server.sh);
# when main has a commit that has not been deployed yet, it runs deploy.sh.
# Log: /var/log/clarigence-deploy.log
set -uo pipefail

APP_DIR=/opt/clarigence
STATE_DIR=/var/lib/clarigence
mkdir -p "$STATE_DIR"

# Only one deploy at a time.
exec 9>/run/clarigence-deploy.lock
flock -n 9 || exit 0

cd "$APP_DIR" || exit 1
git fetch --quiet origin main || { echo "[$(date -Is)] git fetch failed"; exit 1; }
target=$(git rev-parse origin/main)

# Each commit is attempted once; a failed deploy waits for the next push instead of retrying in a loop.
[ "$target" = "$(cat "$STATE_DIR/last-attempted" 2>/dev/null)" ] && exit 0
echo "$target" > "$STATE_DIR/last-attempted"

echo "[$(date -Is)] Deploying ${target:0:7}: $(git log -1 --format=%s "$target")"
if bash "$APP_DIR/deploy/deploy.sh"; then
  echo "$target" > "$STATE_DIR/last-deployed"
  echo "[$(date -Is)] Deployed ${target:0:7} successfully"
else
  echo "[$(date -Is)] Deploy of ${target:0:7} FAILED; the previous version keeps running until the next push"
fi
