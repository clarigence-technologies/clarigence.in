# Clarigence.in

The public website deploys to Vercel as static pages with one Node.js email
function at `/api/contact`. Both enquiry forms send to hello@clarigence.in through
the configured SMTP mailbox. No Railway service, database or running Java backend
is required. Enquiries do not appear in an admin dashboard.

See [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md) for private SMTP configuration and
deployment. Delivery must be confirmed in the recipient mailbox.

## Build and deploy

```text
npm ci
node scripts/build-static.js
vercel --prod
```

Run from the repository root. The existing Vercel project is `clarigence.in`.
The old backend URL environment variables are no longer used. SMTP credentials
must be configured on Vercel before deploying this change.

## Preview locally

```text
npm ci
node scripts/build-static.js
node scripts/serve-static.js
```

Open http://localhost:8000. Public content lives in `content.json`; edit it and
rebuild to publish changes. Existing database-only CMS changes require an export
before they can be brought into this static content file. The Java project in
`backend/` is retained for reference and excluded from public deployments.

## Public design and content

The six existing public HTML pages share a lightweight stylesheet and JavaScript, with no runtime framework or added production dependencies. Existing logo and favicon assets are preserved. Service details live at anchors on `services.html`; links from those details preselect a service on the contact page. Portfolio items are explicitly labeled illustrative concepts.

Edit shared page content in `scripts/generate-pages.py`, then regenerate the six HTML pages with `py scripts/generate-pages.py`. CSS and JavaScript remain independently editable. This optional authoring script is not needed to serve or deploy the website.

The graphic visual layer lives in `visuals.css`. The normal build runs the idempotent `scripts/enhance-visuals.js` step to apply it to all six pages and version the CSS/JavaScript URLs, including after the optional Python generator runs. Original SVG illustrations are in `assets/graphics/`; edit them directly or regenerate them with `node scripts/create-graphics.js`. The existing content, routes, service selection and enquiry integration remain unchanged.

Build locally with `node scripts/build-static.js`. Canonicals and `sitemap.xml` use `https://www.clarigence.in/`; update these together if the primary public domain changes. The public deployment uses no Java backend or MySQL credentials.

Browser checks: `node scripts/verify-frontend.cjs` requires Playwright in the ignored `.qa-tools` directory and the frontend running on port 8000. This is a testing tool only. Results and screenshots are written to ignored `artifacts/qa/`.
