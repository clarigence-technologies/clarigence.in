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

If enquiries fail, check the FormSubmit endpoint before changing the website's
validation. HTTP 521 means the delivery service is unavailable; changing the
form fields or reactivating the mailbox will not repair a provider outage.
Both forms preserve entered details and offer **Send by email instead** when
delivery fails or cannot be confirmed. This opens a prefilled draft in the
visitor's email app; the visitor must send it. It does not automatically resend
an enquiry or claim successful delivery. Automatic form delivery still depends
on FormSubmit recovering, or replacing it with a configured email provider.

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

Run `node scripts/build-static.js`, then
`node scripts/serve-static.js` (http://localhost:8000).
With the existing development Playwright tooling installed, run
`node scripts/verify-email-forms.cjs`. It intercepts all email requests locally
and checks both forms without sending messages.
