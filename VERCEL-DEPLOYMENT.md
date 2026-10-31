# Vercel: static website with email enquiries

The current public website needs no Railway service, Java backend or database.
It is linked to the existing `clarigence.in` Vercel project.

## Deploy

Run `vercel --prod` from the repository root. The build is
`node scripts/build-static.js`, with output in `dist`. The old
`CLARIGENCE_API_URL` and `CLARIGENCE_API_BASE_URL` variables are no longer used.
No private credentials or paid upgrades are required by this integration.

## Email activation ? required

Both enquiry forms send directly to
`https://formsubmit.co/ajax/hello@clarigence.in`.
After the first actual form submission, open hello@clarigence.in, check inbox and
spam, and click FormSubmit's activation link. Until activation, inbox delivery
is not verified. Then submit a real enquiry and confirm its email arrives.
An HTTP acceptance response does not prove inbox delivery.

FormSubmit documentation: https://formsubmit.co/documentation
Activation help: https://formsubmit.co/help
FormSubmit is an external processor and may retain submissions according to its
own policy (currently documented as 30 days). No application database or admin
history is used. Keep important enquiries in the mailbox.

## Content

Edit `content.json` for public services, portfolio and page content. This file
contains public content only; never add enquiries or credentials to it. The
initial static content comes from the repository's existing seed and design
concepts; any previous database-only CMS edits are not recovered by this change.
The old Java backend is retained as source but excluded from the public upload.

## Verification

## Prepared Titan SMTP replacement

`api/contact.js` is a Vercel Node function that sends using Titan over TLS on
port 465. The recipient and authenticated sender are hello@clarigence.in;
the visitor's email is Reply-To. SMTP rejection never reports success.
Run `npm test` for isolated endpoint checks; no mail is sent by these tests.

Before switching the frontend:

1. In Titan webmail, Settings > Enable Titan on Other Apps. If Settings shows
   Configure 3rd party apps, access is already enabled.
2. In the existing Vercel project's Settings > Environment Variables, add
   TITAN_SMTP_PASSWORD for Production as a sensitive value. Use a Titan app
   password when two-factor authentication is enabled. Never put it in a
   public file or chat. TITAN_SMTP_HOST is optional; defaults to smtp.titan.email.
3. Once that is configured, change contactApiUrl in api-config.js to
   /api/contact, update browser interception tests to use that endpoint,
   update the form provider note in HTML and generate-pages.py, and redeploy.
4. Confirm an actual enquiry reaches the Titan inbox. The current frontend
   continues using FormSubmit until credentials are available.

Official setup: https://support.titan.email/hc/en-us/articles/4405162224665-Configuring-Titan-on-Email-Scripts

## FormSubmit outage verification

On 29 October 2026, a live check of the FormSubmit enquiry endpoint returned
HTTP 521 from Cloudflare. This is an external provider outage; redeploying the
static website cannot restore that service. Both forms now retain entered
details and offer an email draft addressed to hello@clarigence.in when the
provider rejects a request or cannot be reached. Visitors must send the draft
from their email app. Automatic form delivery still requires FormSubmit to
recover or a replacement email provider to be configured.

Run `node scripts/build-static.js`, then
`python scripts/serve-static.py --port 8012`.
With the existing development Playwright tooling installed, run
`node scripts/verify-email-forms.cjs`. It intercepts all email requests locally
and checks both forms without sending messages.
