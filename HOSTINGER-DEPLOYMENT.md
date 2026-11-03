# Hostinger VPS deployment

The whole site runs on one Hostinger VPS:

- **Nginx** serves the static pages from `/var/www/clarigence/public` and forwards `/api/*` and `/admin` to the backend.
- **Docker Compose** (`deploy/docker-compose.yml`) runs the Java backend and MySQL. Content, uploaded images, client logos and enquiries are stored in MySQL.
- On the VPS the pages read content from the backend (`deploy/api-config.vps.js` sets `contentSource: 'api'`). The repository's default `api-config.js` stays in static mode, so the old Vercel deployment keeps working until DNS moves.

## First-time setup (Ubuntu 22.04/24.04, as root)

```bash
curl -fsSL https://raw.githubusercontent.com/clarigence-technologies/clarigence.in/main/deploy/setup-server.sh -o setup-server.sh
bash setup-server.sh you@example.com     # the admin login email
```

The script installs Docker, Nginx, Node.js 20 and Certbot, enables the firewall (SSH, HTTP, HTTPS), clones the code to `/opt/clarigence`, generates database passwords in `/opt/clarigence/deploy/.env`, creates the first admin account and schedules a daily database backup in `/var/backups/clarigence`.

- Admin login details: `cat /root/clarigence-admin-login.txt` (sign in, then delete the file).
- After the first successful start, set `ADMIN_BOOTSTRAP_ENABLED=false` and clear `ADMIN_PASSWORD` in `deploy/.env`.

A new database is filled from `backend/src/main/resources/cms-seed.json`, which mirrors `content.json`. Run `node scripts/sync-cms-seed.cjs` after changing `content.json` if the seed should follow.

## Enquiry emails

Enquiries are always saved and visible in the admin inbox. To also receive an email, edit `/opt/clarigence/deploy/.env` on the server (never commit it):

```
ENQUIRY_EMAIL_ENABLED=true
SMTP_HOST=smtp.hostinger.com     # your mailbox provider's SMTP host
SMTP_PORT=465                    # 465: SMTP_SSL=true, SMTP_STARTTLS=false; 587: the reverse
SMTP_SSL=true
SMTP_STARTTLS=false
SMTP_USERNAME=hello@clarigence.in
SMTP_PASSWORD=...
```

Then run `bash /opt/clarigence/deploy/deploy.sh`.

## Moving the domain from Vercel

1. Test everything on `http://<VPS-IP>/` and `http://<VPS-IP>/admin`.
2. At the DNS provider, point `A @` and `A www` (or `CNAME www` → `clarigence.in`) to the VPS IP and remove the Vercel records. Keep MX/email records unchanged.
3. When `clarigence.in` resolves to the VPS, issue HTTPS certificates (webroot method, renewed automatically by `certbot.timer`):
   ```bash
   certbot certonly --webroot -w /var/www/html -d clarigence.in -d www.clarigence.in \
     -m you@example.com --agree-tos -n --deploy-hook "systemctl reload nginx"
   ```
4. Set `SESSION_COOKIE_SECURE=true` in `deploy/.env` and run `deploy.sh` (it switches Nginx to the HTTPS site).
5. Once the VPS site is confirmed, disconnect the domain from Vercel and pause the Vercel project.

## Updating the site

Commit and push to `main` on GitHub (for example from VS Code). The VPS checks GitHub every 2 minutes and deploys new commits automatically (`deploy/auto-deploy.sh`, cron file `/etc/cron.d/clarigence-auto-deploy`). A deploy that includes backend changes takes about 2–3 minutes because the backend tests run during the build; if a deploy fails, the previous version keeps running.

```bash
tail -f /var/log/clarigence-deploy.log      # watch automatic deploys
bash /opt/clarigence/deploy/deploy.sh        # deploy immediately by hand
```

Content managed in the admin panel (services, portfolio, clients, page text, SEO) is stored in the database and is never overwritten by a deploy.

## Useful commands

```bash
cd /opt/clarigence/deploy
docker compose ps                    # container status
docker compose logs -f backend       # backend logs
ls /var/backups/clarigence           # database backups
```
