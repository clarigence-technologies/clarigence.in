# Vercel website with automatic email enquiries

The six public pages remain static. The **Send enquiry** button on the homepage
and contact page sends JSON to the same-origin Vercel Function `/api/contact`.
That function sends one email to hello@clarigence.in through authenticated SMTP.
It replaces FormSubmit, whose HTTP 521 outage prevented automatic enquiries.
No Railway service, Java backend, application database or mail-app button is used.

## Required private email configuration

Before deploying, add these in Vercel > the existing `clarigence.in` project >
Settings > Environment Variables. Select Production and Preview as appropriate.

| Variable | Value |
| --- | --- |
| `SMTP_HOST` | Your mailbox provider's outgoing SMTP hostname |
| `SMTP_PORT` | `465` for implicit TLS, or `587` for STARTTLS |
| `SMTP_USERNAME` | Your full mailbox login, normally `hello@clarigence.in` |
| `SMTP_PASSWORD` | Mailbox password or provider-issued app password |
| `ENQUIRY_EMAIL_FROM` | Optional authorized sender; defaults to `SMTP_USERNAME` |

The domain's MX records currently point to GoDaddy. For GoDaddy Workspace or
Professional Email, confirm `smtpout.secureserver.net` and port `465` in your
email account's settings. Microsoft 365 uses different SMTP settings and may
require SMTP authentication to be enabled. An email forwarding address without
an SMTP login cannot send through this integration; use a working mailbox or a
transactional provider's SMTP credentials instead.

Do not paste the password into chat, public JavaScript, `content.json`, or Git.
`.env.example` contains names and sample settings only. Public `api-config.js`
contains just `/api/contact`. The API rejects missing credentials with HTTP 503
and never reports a successful send until SMTP accepts the business recipient.
The visitor's email becomes Reply-To; the recipient and subject stay fixed.

References: [Nodemailer SMTP configuration](https://nodemailer.com/smtp),
[Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).

## Deploy

```text
npm ci
node scripts/build-static.js
vercel --prod
```

The static output is `dist/`; Vercel separately builds `api/contact.js` and its
Node.js dependencies. Keep `api/`, `lib/`, `content.json`, `package.json` and
`package-lock.json` in the deployment source. The old `CLARIGENCE_API_URL` and
`CLARIGENCE_API_BASE_URL` variables are unused. Redeploy after setting or changing
SMTP variables so the new function receives them.

## Verification

```text
npm test
node scripts/build-static.js
node scripts/serve-static.js
```

In another terminal, run `node scripts/verify-email-forms.cjs`. It intercepts all
email requests and checks the existing Send enquiry button on both pages without
sending messages. Backend tests replace SMTP locally, including acceptance,
rejection, authentication errors, timeouts, field validation and private config.

The preview at http://localhost:8000 also serves `/api/contact`. To use private
local settings, launch with `node --env-file=.env scripts/serve-static.js` after
creating an ignored `.env` from `.env.example`. The preview does not load `.env`
automatically. Without SMTP configuration, real local submissions return 503.

After configuring and deploying, submit one real enquiry through Send enquiry
and confirm receipt in hello@clarigence.in, including spam. SMTP acceptance is
not proof of inbox delivery. Automated tests do not send real enquiries.

## Content

Edit `content.json` for public services, portfolio and page content, then rebuild.
Do not store enquiries or credentials in this file. No application database or
admin history is used; keep important enquiries in the mailbox. The old Java
backend remains retained source and is excluded from public deployment.
