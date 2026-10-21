# Enquiry repair verification

The 24 reviewed files listed in enquiry-change-manifest.json were applied to the existing project and verified byte-for-byte against the tested working copy. Original source files are backed up in enquiry-source-backup. No production records, secrets, account settings or deployments were changed.

## Changes

- Public form: script.js now uses submission keys for retries and validates the server's saved-record ID before showing success. Details remain on failure.
- Contact API: ContactRequest, ContactController, ContactService and new ContactSubmissionService normalize and validate input and enforce duplicate protection through a persistent unique key.
- Persistence: Contact and ContactRepository add nullable submission keys, notification state, safe error text, attempt timestamps and database locks for notification retries. Existing records remain intact.
- Notifications: new NotificationDeliveryService and updated EnquiryEmailNotification save delivery results in a separate transaction after the enquiry commits. Any post-commit failure is contained. Admin retry requires the existing authenticated session and CSRF token.
- Admin: AdminEnquiryController, EnquiryDetails and admin HTML/JS/CSS display notification details and retry controls, add In Progress and its count, preserve Converted, and fix mobile table overflow.
- Configuration: CorsConfig allows Idempotency-Key. ApiExceptionHandler reports database outages as HTTP 503. application.properties bounds database pool acquisition at 5 seconds.
- Documentation: backend/README.md and ENQUIRY-DEPLOYMENT.md explain environment variables, non-destructive migration, host options, deployment and live verification.

## Verification

Maven verify: 42 tests, 0 failures, 0 errors, 0 skipped; build successful. Log: fix-work/final-verify.log. Includes existing authentication/CMS tests, saved enquiry/email failure isolation, authorized and unauthorized retry, CSRF protection, sequential and concurrent duplicate requests, database failure, trimmed-input validation, custom-header CORS, and full application restart using a temporary persistent H2 file.

Browser regression: qa/enquiry-reliability.cjs uses the actual public/admin source, a local server and isolated API/service-list fixtures. It tests field validation, HTTP 503 and network failure with retained details, key reuse and replacement, malformed 201 rejection, genuine saved-ID confirmation, notification details and retry, plus admin layouts at 360/768/1440 pixels. It does not establish production connectivity or email inbox delivery. Screenshots: qa/enquiry-admin-360.png, qa/enquiry-admin-768.png, qa/enquiry-admin-1440.png.

Production inspection: the public API configuration still uses Railway; Railway returns HTTP 404 Application not found for service listing and contact preflight. No production submissions were made. The current Vercel CLI account returned no backend deployments in its visible scope. The local MySQL80 service is running, but hosted MySQL connectivity, migration and production SMTP could not be verified through the unavailable backend. No production-fix claim is made.

## Remaining owner steps

Follow ../ENQUIRY-DEPLOYMENT.md: recover and back up the old database, provision an approved backend with persistent MySQL, import all existing data and admin hashes, configure private database/email environment variables, verify backend/CORS/login, update frontend CLARIGENCE_API_BASE_URL to the verified host, redeploy and perform a real approved end-to-end test. Verify the record remains after deployment and the hello@clarigence.in inbox receives the notification. No paid service was introduced.
