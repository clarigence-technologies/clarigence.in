# Repository Guidelines

## Project Structure & Module Organization

The public site consists of seven root HTML pages, shared `styles.css`, `visuals.css`, `experience.css`, `script.js`, `cms.js`, and `experience.js`. Public content lives in `content.json`; images and SVG illustrations belong in `assets/`, including `assets/graphics/`. Authoring, build, preview, and browser verification scripts live in `scripts/`. Generated deployment files go to ignored `dist/`.

`backend/` contains the production Java 25/Spring Boot API and admin UI, deployed with MySQL through Docker Compose (see `deploy/`). Java packages under `backend/src/main/java/in/clarigence/contactapi/` separate controllers, services, repositories, entities, DTOs, and configuration. Backend tests live in `backend/src/test/`; admin assets live in `backend/src/main/resources/static/admin/`.

`api/contact.js` and `lib/contact-handler.js` are the former Vercel email function. Production no longer uses them, but the local preview (`scripts/serve-static.js`) and `npm test` still do.

## Build, Test, and Development Commands

Run from the repository root unless specified:

- `npm ci`: install server-side email dependencies.
- `npm test`: verify the Node.js email function with SMTP replaced locally; sends no emails.
- `node scripts/build-static.js`: apply visual enhancements and rebuild `dist/`.
- `node scripts/serve-static.js`: preview the built site at `http://localhost:8000`, including clean URLs.
- `py scripts/generate-pages.py`: regenerate the seven HTML pages after editing shared markup in this script; rebuild afterward.
- `node scripts/verify-frontend.cjs`: check public routes, responsive layouts, and browser behavior.
- `node scripts/verify-email-forms.cjs`: verify form validation and simulated delivery outcomes.
- `node scripts/verify-analytics.cjs`: verify the Google tag in production builds, its absence from local builds, and enquiry tracking; sends nothing to Google and rebuilds `dist/` without the tag.
- `mvn clean verify` from `backend/`: build and run backend tests; requires Java 25 and Maven.

## Coding Style & Naming Conventions

Match nearby formatting; use two-space indentation in expanded JavaScript and four spaces in Java. JavaScript uses single quotes, semicolons, and camelCase identifiers; Java classes use PascalCase. Use descriptive kebab-case CSS classes and script filenames. Keep shared markup changes in the page generator consistent with generated HTML. No repository-wide formatter or linter is configured; avoid unrelated reformatting.

## Testing Guidelines

Browser checks use Playwright installed under ignored `.qa-tools/` and local Chrome. Start the built preview before running frontend, email and analytics checks; screenshots and reports go to `artifacts/qa/`. Intercept form submissions during testing to prevent real emails. Backend tests use JUnit 5, Spring Boot/MockMvc, and isolated H2 databases; follow existing `*Test.java` and `*IntegrationTest.java` naming. No numeric coverage threshold is configured.

## Commit & Pull Request Guidelines

History uses short descriptive subjects such as `services drop down added`; no strict commit prefix convention is evident. Prefer concise imperative messages. Pull requests should explain the behavior changed, list verification performed, link relevant issues, and include desktop/mobile screenshots for visual changes.

## Security & Configuration

Keep secrets in private environment settings and exclude local credentials and generated output from commits. Public forms use `/api/contact`, served by the Java backend behind Nginx, with private settings in `deploy/.env` on the VPS. Pushing to `main` deploys automatically, so treat every push as a production release. The Google tag ID belongs only in `deploy/deploy.sh`, never in source HTML, so previews and test runs stay out of Google Analytics. Consult `README.md` and `HOSTINGER-DEPLOYMENT.md` for deployment; `VERCEL-DEPLOYMENT.md` and `ENQUIRY-DEPLOYMENT.md` are historical.
