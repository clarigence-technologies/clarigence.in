# Clarigence.in

The public website runs on a Hostinger VPS. Nginx serves the static pages, and the
Java 25/Spring Boot backend in `backend/` runs with MySQL through Docker Compose. The
backend provides site content, the admin panel and `/api/contact`. Every enquiry is
saved in the admin inbox and, when email is enabled on the server, also sent to
hello@clarigence.in.

See [HOSTINGER-DEPLOYMENT.md](HOSTINGER-DEPLOYMENT.md) for server setup, email settings
and operations. Vercel is no longer used in production, so `VERCEL-DEPLOYMENT.md` and
`ENQUIRY-DEPLOYMENT.md` are historical.

## Deploy

Pushing to `main` deploys automatically. The server checks GitHub every 2 minutes, then
runs `deploy/deploy.sh`, which rebuilds the website and backend, runs the backend tests
and restarts the services. A failed build or test leaves the live site unchanged.

## Preview locally

```text
npm ci
node scripts/build-static.js
node scripts/serve-static.js
```

Open http://localhost:8000. The preview differs from production: it reads content from
`content.json` instead of the database, and its `/api/contact` runs the older Node.js
function in `api/contact.js` instead of the Java backend. In production, content is
edited in the admin panel.

## Analytics

Google Analytics runs for every visitor on the live site. `deploy/deploy.sh` passes the
tag ID to the build as `GOOGLE_TAG_ID`, and `scripts/build-static.js` adds Google's snippet
directly after `<head>` on each page. Local builds leave it out, so previews and test runs
send no visits to Google. A successful enquiry sends a `generate_lead` event containing
only the chosen service. The privacy policy is the `privacy.html` page, generated from
`scripts/generate-pages.py`; update it if the data collected or the services used change.

## Public design and content

The seven public HTML pages share a lightweight stylesheet and JavaScript, with no runtime framework or added production dependencies. Existing logo and favicon assets are preserved. Service details live at anchors on `services.html`; links from those details preselect a service on the contact page. Portfolio items are explicitly labeled illustrative concepts.

Edit shared page content in `scripts/generate-pages.py`, then regenerate the seven HTML pages with `py scripts/generate-pages.py`. CSS and JavaScript remain independently editable. This optional authoring script is not needed to serve or deploy the website.

The graphic visual layer lives in `visuals.css`. The normal build runs the idempotent `scripts/enhance-visuals.js` step to apply it to all seven pages and version the CSS/JavaScript URLs, including after the optional Python generator runs. The motion and experience layer (dark aurora heroes, floating header, ticker bands, card spotlight/tilt, scroll reveals and cursor effects) lives in `experience.css` and `experience.js`; the same build step injects both plus the Inter/Sora web fonts. Every effect is decorative and respects reduced-motion settings. Original SVG illustrations are in `assets/graphics/`; edit them directly or regenerate them with `node scripts/create-graphics.js`. The existing content, routes, service selection and enquiry integration remain unchanged.

Build locally with `node scripts/build-static.js`. Canonicals and `sitemap.xml` use `https://www.clarigence.in/`; update these together if the primary public domain changes.

Browser checks: `node scripts/verify-frontend.cjs`, `verify-email-forms.cjs` and `verify-analytics.cjs` require Playwright in the ignored `.qa-tools` directory and the frontend running on port 8000. This is a testing tool only. Results and screenshots are written to ignored `artifacts/qa/`.
