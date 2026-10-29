# Repository Guidelines

## Project Structure & Module Organization

The public site consists of six root HTML pages, shared `styles.css`, `visuals.css`, `script.js`, and `cms.js`. Public content lives in `content.json`; images and SVG illustrations belong in `assets/`, including `assets/graphics/`. Authoring, build, preview, and browser verification scripts live in `scripts/`. Generated deployment files go to ignored `dist/`.

`backend/` contains a retained Java 21/Spring Boot API and admin UI, excluded from public deployment. Java packages under `backend/src/main/java/in/clarigence/contactapi/` separate controllers, services, repositories, entities, DTOs, and configuration. Backend tests live in `backend/src/test/`; admin assets live in `backend/src/main/resources/static/admin/`.

## Build, Test, and Development Commands

Run from the repository root unless specified:

- `node scripts/build-static.js`: apply visual enhancements and rebuild `dist/`.
- `node scripts/serve-static.js`: preview the built site at `http://localhost:8000`, including clean URLs.
- `py scripts/generate-pages.py`: regenerate the six HTML pages after editing shared markup in this script; rebuild afterward.
- `node scripts/verify-frontend.cjs`: check public routes, responsive layouts, and browser behavior.
- `node scripts/verify-email-forms.cjs`: verify form validation and simulated delivery outcomes.
- `mvn clean verify` from `backend/`: build and run backend tests; requires Java 21 and Maven.

## Coding Style & Naming Conventions

Match nearby formatting; use two-space indentation in expanded JavaScript and four spaces in Java. JavaScript uses single quotes, semicolons, and camelCase identifiers; Java classes use PascalCase. Use descriptive kebab-case CSS classes and script filenames. Keep shared markup changes in the page generator consistent with generated HTML. No repository-wide formatter or linter is configured; avoid unrelated reformatting.

## Testing Guidelines

Browser checks use Playwright installed under ignored `.qa-tools/` and local Chrome. Start the built preview before running frontend and email checks; screenshots and reports go to `artifacts/qa/`. Intercept form submissions during testing to prevent real emails. Backend tests use JUnit 5, Spring Boot/MockMvc, and isolated H2 databases; follow existing `*Test.java` and `*IntegrationTest.java` naming. No numeric coverage threshold is configured.

## Commit & Pull Request Guidelines

History uses short descriptive subjects such as `services drop down added`; no strict commit prefix convention is evident. Prefer concise imperative messages. Pull requests should explain the behavior changed, list verification performed, link relevant issues, and include desktop/mobile screenshots for visual changes.

## Security & Configuration

Keep secrets in private environment settings and exclude local credentials and generated output from commits. The current public forms use FormSubmit; consult `README.md` and `VERCEL-DEPLOYMENT.md` before applying historical backend deployment instructions.
