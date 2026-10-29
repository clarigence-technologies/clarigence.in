# Clarigence public-site upgrade

## Current graphic refresh

Follow-up correction: removed the legacy last-card centering rule that conflicted with the 12-column service grid and squeezed Business Automation into a narrow vertical column. Regression checks now verify minimum service-card widths and final-row alignment. The palette now uses medium-strength blue, violet and teal accents: richer buttons and headings, a more colorful globe, clearer icon fills, and more defined capability, process and final CTA backgrounds.

The current version retains the original six-page layout and content, with a graphic treatment informed by the user-supplied Avimaytech reference. `visuals.css` adds a glossy blue/cyan/violet hero globe with floating capability badges, gradient heading accents, pill-shaped CTAs, a gradient capability strip, soft service cards with existing capability lists, original concept thumbnails, styled process cards and a navy footer with readable text.

Five original SVG illustrations total roughly 16 KB. The existing logo is served in an optimized 400 × 87 derivative. No competitor artwork, client claims, reviews or business statistics were incorporated. Uploaded portfolio images and existing concept flags remain authoritative. No production dependencies were added.

The build runs `scripts/enhance-visuals.js` before copying public files. This enhancement is idempotent, survives the optional page generator, and versions style/script URLs by content hash so browsers request the current visual assets after a rebuild. Enquiry forms, clean URLs, business content and admin source remain compatible with the existing architecture.

## Audit and preservation

The project contains six public HTML pages, a shared stylesheet and script, existing logo/favicon assets, and a Vercel static-copy build. The separate Spring Boot application owns contact persistence, MySQL, admin authentication and its own HTML/CSS/JavaScript. Public-site changes do not touch those backend or admin source files.

The original public design had layered CSS revisions, three broad service categories, a contact dropdown that did not match the requested service offering, and server messages displayed directly in the form. The enquiry endpoint was already correct at port 8081. The backend's general default port is 8080, while its existing local-start script explicitly selects 8081; keep using that script.

The reference was used for its service-led structure, clear primary/secondary actions, scannable capabilities, process and portfolio sections, and contact placement. Clarigence uses its own blue/navy palette, existing branding, original CSS/SVG illustrations and independently written content. No reference assets or source were incorporated. No testimonials, client names, customer counts or awards were added.

## Implementation

- All six existing pages share a sticky header, active navigation, mobile menu, CTA system and responsive footer.
- The homepage follows hero → business value → about → ten services → why Clarigence → process → solutions → concepts → CTA → enquiry form.
- Ten detailed service sections include capabilities, benefits, use cases and project enquiry links that preselect the relevant service.
- Portfolio entries remain illustrative concepts with accessible expandable descriptions.
- The public CSS was consolidated from about 41 KB to about 22 KB. No production library or font download was added.
- Enquiry forms keep the six existing JSON field names. They use inline validation, a disabled loading button, success feedback and safe error messages. Values remain available after failures.
- Both forms use `api-config.js`. The production build continues to validate `CLARIGENCE_API_URL`, now substituting it once into the generated configuration file.
- Pages have unique titles/descriptions, canonicals, Open Graph metadata, semantic headings, visible focus, labeled controls and reduced-motion support. A sitemap was added.

## Verification

Existing Maven suite: 14 tests passed against H2, covering contact persistence/validation/CORS, admin authentication and authorization, CSRF, dashboard/filtering/details, status changes, deletion, logout, sessions and email behavior.

Browser verification covers all six pages at 320, 360, 375, 390, 412, 430, 768, 1024, 1440 and 1920 pixels. It checks document overflow, image loading, unique titles, internal file/anchor links, mobile navigation, form labels, native and custom validation, loading, payload shape, success, server validation, server failures and network failures. Reduced-motion behavior is checked separately. Desktop/mobile screenshots and the machine-readable report are in `artifacts/qa/` (ignored by Git).

A real browser contact POST was also verified against a temporary H2-backed Spring Boot instance on port 8081, without changing MySQL settings or adding records to the user's MySQL database. Existing integration tests exercise authenticated admin workflows; a production/MySQL-backed admin session was not used during this redesign.

## Run and configure

From the project root, serve the frontend with `py -m http.server 8000`. If a preview server is already running on that port, use it or stop it before starting another.

Start the existing MySQL-backed backend with `powershell -NoProfile -ExecutionPolicy Bypass -File .\backend\start-local.ps1` and enter your database password at its private prompt. Do not put credentials in frontend files.

Open `http://localhost:8000/`, each of the five linked pages, and `http://localhost:8081/admin/`. The contact endpoint is `http://localhost:8081/api/contact` (POST).

For deployment, retain your existing private database/admin/SMTP settings. Set the frontend `CLARIGENCE_API_URL` to the deployed HTTPS endpoint, and allow the frontend origin through backend CORS. Canonicals and sitemap use `https://www.clarigence.in/`; update both if you choose another primary domain. No deployment was performed as part of this upgrade.

Shared content can be edited in `scripts/generate-pages.py` and regenerated with `py scripts/generate-pages.py`. Serve/deploy the generated HTML normally; Python is not a production requirement.
