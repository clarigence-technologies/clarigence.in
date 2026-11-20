# Server deployment (Oracle Cloud Always Free)

The whole site runs on one Ubuntu server, an Oracle Cloud Always Free ARM instance:

- **Nginx** serves the static pages from `/var/www/clarigence/public` and forwards `/api/*` and `/admin` to the backend.
- **Docker Compose** (`deploy/docker-compose.yml`) runs the Java backend and MySQL. Content, uploaded images, client logos and enquiries are stored in MySQL.
- The pages read content from the backend (`deploy/api-config.vps.js` sets `contentSource: 'api'`).

The scripts work on any Ubuntu 22.04/24.04 server. Oracle needs the extra console steps below.

## 1. Create the Oracle Cloud account

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/). A card is needed for identity checks.
2. Choose **India West (Mumbai)** or **India South (Hyderabad)** as the home region. It cannot be changed later, and Always Free servers only run in the home region.
3. Recommended: upgrade the account to **Pay As You Go** (Billing → Upgrade). Always Free resources stay free, and Oracle does not reclaim idle Always Free servers on Pay As You Go accounts. A small website can look idle to Oracle (under 20% CPU, network and memory for 7 days). Then create a budget with an email alert at a small amount, such as 1 USD, under Billing → Budgets, so any charge is noticed straight away.

## 2. Create the server

In **Compute → Instances → Create instance**:

- **Image:** Canonical Ubuntu 24.04 (not the Minimal variant).
- **Shape:** Ampere `VM.Standard.A1.Flex`, 2 OCPUs and 12 GB memory (the full Always Free allowance).
- **Networking:** create a new virtual cloud network with a public subnet, and assign a public IPv4 address.
- **SSH keys:** upload your public key, or let Oracle generate a pair and save the private key.
- **Boot volume:** the default (about 50 GB) is fine.

If Oracle reports **Out of capacity**, try another availability domain or try again later.

Open the web ports: **Networking → Virtual cloud networks → (your network) → Security → Default security list → Add ingress rules**, with source `0.0.0.0/0`, protocol TCP, destination ports `80` and then `443`.

The public IP stays the same when the server is stopped and started; it is released only if the instance is terminated.

## 3. Install the site

```bash
ssh ubuntu@<SERVER-IP>
curl -fsSL https://raw.githubusercontent.com/clarigence-technologies/clarigence.in/main/deploy/setup-server.sh -o setup-server.sh
sudo bash setup-server.sh you@example.com     # the admin login email
```

The script installs Docker, Nginx, Node.js 20 and Certbot, opens HTTP and HTTPS in Oracle's server firewall (or enables `ufw` on other servers), clones the code to `/opt/clarigence`, generates database passwords in `/opt/clarigence/deploy/.env`, creates the first admin account, schedules a daily database backup and turns on automatic deploys from GitHub.

- Admin login details: `sudo cat /root/clarigence-admin-login.txt` (sign in, then delete the file).
- After the first successful start, set `ADMIN_BOOTSTRAP_ENABLED=false` and clear `ADMIN_PASSWORD` in `deploy/.env`.

A new database is filled from `backend/src/main/resources/cms-seed.json`, which mirrors `content.json`. Run `node scripts/sync-cms-seed.cjs` after changing `content.json` if the seed should follow.

### Restoring a database backup

If you have a backup from a previous server (`clarigence-YYYY-MM-DD.sql.gz`), copy it over and load it before using the admin panel. Loading replaces everything in the new database:

```bash
scp clarigence-YYYY-MM-DD.sql.gz ubuntu@<SERVER-IP>:/tmp/
ssh ubuntu@<SERVER-IP>
cd /opt/clarigence/deploy
gunzip -c /tmp/clarigence-YYYY-MM-DD.sql.gz | sudo docker compose exec -T database sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" clarigence'
sudo docker compose restart backend
```

## 4. Enquiry emails

Enquiries are always saved and visible in the admin inbox. To also receive an email, edit `/opt/clarigence/deploy/.env` on the server (never commit it). For a GoDaddy mailbox the SMTP server is usually `smtpout.secureserver.net`; check your mailbox's settings page.

```
ENQUIRY_EMAIL_ENABLED=true
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465                    # 465: SMTP_SSL=true, SMTP_STARTTLS=false; 587: the reverse
SMTP_SSL=true
SMTP_STARTTLS=false
SMTP_USERNAME=hello@clarigence.in
SMTP_PASSWORD=...
```

Then run `sudo bash /opt/clarigence/deploy/deploy.sh`.

## 5. Point the domain at the server

1. Test everything on `http://<SERVER-IP>/` and `http://<SERVER-IP>/admin`.
2. At GoDaddy (DNS → Manage), point the `A` records for `@` and `www` (or `CNAME www` → `clarigence.in`) to the server IP. Keep the MX and other email records unchanged.
3. When `clarigence.in` resolves to the server, issue HTTPS certificates (webroot method, renewed automatically by `certbot.timer`):
   ```bash
   sudo certbot certonly --webroot -w /var/www/html -d clarigence.in -d www.clarigence.in \
     -m you@example.com --agree-tos -n --deploy-hook "systemctl reload nginx"
   ```
4. Set `SESSION_COOKIE_SECURE=true` in `deploy/.env` and run `sudo bash /opt/clarigence/deploy/deploy.sh` (it switches Nginx to the HTTPS site).

## Updating the site

Commit **and push** to `main` on GitHub. In VS Code: Source Control → **Commit**, then **Sync Changes** (or **Push**); a commit that is not pushed stays on your computer. The server checks GitHub every 2 minutes and deploys new commits automatically (`deploy/auto-deploy.sh`, cron file `/etc/cron.d/clarigence-auto-deploy`), so the live site updates about 2–5 minutes after a push. The website and backend are built and tested before anything goes live; if a build or test fails, the live site stays on the previous version and the next push is tried again.

```bash
tail -n 30 /var/log/clarigence-deploy.log    # recent automatic deploys (success or FAILED)
cat /var/lib/clarigence/last-deployed        # commit currently live
sudo bash /opt/clarigence/deploy/deploy.sh   # deploy immediately by hand
sudo rm /etc/cron.d/clarigence-auto-deploy   # turn automatic deploys off
```

Content managed in the admin panel (services, portfolio, clients, page text, SEO) is stored in the database and is never overwritten by a deploy.

## Backups

A daily backup is written to `/var/backups/clarigence` at 03:15 and kept for 14 days. Those copies live on the same server, so download one regularly, for example monthly, to keep a copy off the server:

```bash
scp ubuntu@<SERVER-IP>:/var/backups/clarigence/clarigence-$(date +%F).sql.gz .
```

The backup folder is readable by root only. If `scp` is refused, first run `sudo cp /var/backups/clarigence/<file> /tmp/ && sudo chown ubuntu /tmp/<file>` on the server, then copy it from `/tmp`.

## Useful commands

```bash
cd /opt/clarigence/deploy
sudo docker compose ps                    # container status
sudo docker compose logs -f backend       # backend logs
sudo ls /var/backups/clarigence           # database backups
```
