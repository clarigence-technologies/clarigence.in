# Clarigence enquiry repair and deployment

## Confirmed production outage

On 21 October 2026, the public `https://www.clarigence.in/api-config.js`
still configured `https://clarigencein-production.up.railway.app`.
Both the public service-list request and OPTIONS `/api/contact` returned Railway
HTTP 404 with `Application not found` and `x-railway-fallback: true`.
The application is unavailable at that address. This is consistent with the
reported expired account; the exact account/billing reason is not visible from
public HTTP checks. CORS, database and SMTP cannot be validated behind that
unavailable application. No production enquiry was created during these checks.

The source `api-config.js` deliberately uses localhost for development. The
existing production build requires an explicit HTTPS backend endpoint and refuses
to deploy with localhost. Do not replace the expired Railway URL with an invented
URL: select a working backend, verify it, then update the frontend environment.

## Hosting choices (no service has been purchased or provisioned)

1. Prefer an always-on Docker-capable host with externally persisted MySQL and
   backups. Reuse the included Java 21 Dockerfile. A small paid instance may be
   needed for predictable availability; select and approve any paid plan yourself.
2. Render Free can run the backend container as a no-cost evaluation option, but
   it sleeps after 15 idle minutes and blocks SMTP ports 25/465/587. Cold starts
   can exceed the form timeout. Use the existing HTTPS email transport on that
   host, within your provider's approved allowance. Free ephemeral disk must
   never hold the production database. This is not the preferred reliability option.
   https://render.com/docs/free
   https://render.com/docs/deploys
3. Oracle Cloud Always Free compute is another candidate for a Docker backend and
   MySQL on a persistent block volume, subject to account eligibility, capacity,
   quotas and idle-instance reclamation rules. You must manage TLS, firewall,
   OS updates and off-machine database backups. Confirm actual availability and
   costs before provisioning. https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

The existing backend Vercel configuration is preserved. Its presence does not
prove container availability or database connectivity for your current account.
Do not move production onto an unverified deployment.

## Preserve and migrate existing data

- First recover and export the existing Railway MySQL database, including
  contacts, admin_users and all CMS tables, through the provider's authenticated
  console. An expired application does not establish whether that data still
  exists. Contact the provider if access has been suspended. Never initialize
  a replacement empty database and assume old enquiries were recovered.
- Take an encrypted backup and test an import into the replacement persistent
  MySQL instance. Retain admin password hashes; existing login needs no reset.
- `spring.jpa.hibernate.ddl-auto=update` already performs additive schema updates.
  This update adds nullable submission_key (unique, varchar(36)),
  notification_status (varchar(20)), notification_attempted_at (timestamp), and
  notification_error (varchar(500)) columns. Historical rows are retained and
  null delivery state displays as NOT_ATTEMPTED.
- Allow IN_PROGRESS in contacts.status. If your existing MySQL column is ENUM,
  extend it to include IN_PROGRESS and retain ALL existing values, including
  CONVERTED, using the provider's migration tools. Validate this on a restored
  backup before production. The application must have ALTER/INDEX privileges
  for Hibernate update, or a DBA must apply the additive migration first.
- Never run create-drop, DROP, TRUNCATE, deleteAll or test fixtures on production.
  Tests use isolated H2 databases; restart persistence uses a temporary file DB.
- MySQL must live outside the application container's ephemeral filesystem.
  Configure backups and retention on the actual persistent database provider.

## Backend environment (private host settings)

Set SPRING_PROFILES_ACTIVE=production, DB_URL (a JDBC MySQL URL using the
provider's verified TLS settings), DB_USERNAME and DB_PASSWORD. Database secrets
belong only on the backend. Configure connectTimeout/socketTimeout according to
provider instructions. DB_CONNECTION_TIMEOUT_MS defaults to 5000 for acquiring a
pool connection. The container accepts PORT; SERVER_PORT overrides it if set.

Set CORS_ALLOWED_ORIGINS=https://www.clarigence.in,https://clarigence.in and
SESSION_COOKIE_SECURE=true. The production profile handles forwarded HTTPS
headers. Serve the admin panel from the backend's own HTTPS /admin/ URL.
Existing BCrypt accounts, session authentication and CSRF protection remain.
Do not enable ADMIN_BOOTSTRAP_ENABLED on a migrated database.

If deploying multiple instances with the existing vercel profile, provision the
existing mysql-session-schema.sql and shared JDBC sessions as documented in
backend/README.md. Otherwise session affinity or shared sessions are required
for reliable login across instances.

For SMTP: set ENQUIRY_EMAIL_ENABLED=true, ENQUIRY_EMAIL_PROVIDER=smtp,
SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, ENQUIRY_EMAIL_FROM and
ENQUIRY_EMAIL_TO=hello@clarigence.in. Defaults use authenticated STARTTLS on
587. Port 465 also requires the provider's SSL settings; changing only the port
is insufficient. Verify the host permits outbound SMTP and the sender is authorized.

For the already implemented HTTPS transport: set ENQUIRY_EMAIL_PROVIDER=resend,
RESEND_API_KEY, ENQUIRY_EMAIL_FROM (verified sender domain),
ENQUIRY_EMAIL_TO=hello@clarigence.in and ENQUIRY_EMAIL_ENABLED=true. Do not
purchase a plan without approval. Keep API keys private and existing mailbox MX
records intact. Domain verification and mailbox delivery are external setup.

## Release and verification

1. Restore the database and deploy backend/Dockerfile with backend as build context.
2. Verify HTTPS startup and MySQL connectivity. Empty JSON POST /api/contact must
   return 400 with validation errors; a preflight from each Clarigence origin
   must allow POST and headers Content-Type, Accept and Idempotency-Key.
3. Confirm unauthenticated /api/admin/enquiries returns 401. Log in with your
   existing account at /admin/. Verify old enquiries and CMS content are present.
4. Set CLARIGENCE_API_BASE_URL=https://YOUR-VERIFIED-BACKEND in the existing
   frontend Vercel project (or CLARIGENCE_API_URL with /api/contact appended).
   Redeploy the frontend. No backend secret belongs in this environment or JS.
   Verify the live /api-config.js points to the verified host.
5. Submit an owner-approved real test enquiry. Confirm HTTP 201, its saved ID,
   all details and newest-first admin visibility. Change status to In Progress.
   Confirm hello@clarigence.in receives the notification, not just provider acceptance.
6. In staging, test a deliberately unavailable email provider: the enquiry must
   still return 201, appear in admin and show FAILED. Restore provider settings
   and use Retry email notification. Unauthorized/CSRF-free retries must fail.
7. Restart/redeploy backend and confirm the test record remains. In staging,
   stop backend/database: the form must show an error and retain all fields.
   Restore service and retry unchanged details; no duplicate record should appear.

Production is NOT fixed until this release checklist passes on the live backend
and persistent MySQL. The old Railway URL cannot be restored through code.
