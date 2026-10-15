# Clarigence CMS

This upgrades the existing public HTML/CSS/JavaScript site and existing Spring Boot admin application. It does not create another website/backend or change the existing admin account.

## Start normally

Keep MySQL running. From `C:\Users\prash\Desktop\clarigence.in`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backend\start-local.ps1
```

Enter the existing database password at the private prompt. Do not enable admin bootstrap again. In another terminal:

```powershell
node scripts/build-static.js
py scripts/serve-static.py
```

If port 8000 already has the preview server running, use that server instead of starting a second one.

- Public website: http://localhost:8000/
- Admin: http://localhost:8081/admin/
- Dynamic service example: http://localhost:8000/services?service=website-development

## Database additions

The existing `spring.jpa.hibernate.ddl-auto=update` strategy adds the CMS tables alongside `contacts` and `admin_users`:

| Table | Content |
|---|---|
| `website_services` | Service names, stable slugs, descriptions, capabilities, benefits, image paths, order, publication status and UTC audit fields |
| `portfolio_projects` | Project title (stored as `name`), stable slug, category, descriptions, technologies, image/project URLs, concept/featured flags, order and UTC audit fields |
| `portfolio_images` | Uploaded portfolio photos stored as MEDIUMBLOB with generated filenames |
| `site_documents` | Validated homepage, About, business information and six page-specific SEO documents, with versions and UTC audit fields |

Long descriptions and short ordered lists use TEXT; document JSON uses LONGTEXT to fit MySQL's row-size limits. Lists are small validated ordered values in the same row, avoiding collection-query overhead.

No manual SQL migration is required with the current schema-update configuration and its existing database user's CREATE/ALTER permissions. For installations that restrict DDL, have the database administrator provision the new tables from the entity mappings before starting the application. Do not drop/recreate existing tables. No database credentials were changed.

The first startup seeds the ten reviewed existing services and default page/settings documents in one transaction. Portfolio starts empty. A private `cms-initialized` marker in `site_documents` prevents repeated initialization and prevents deleted services from reappearing. Existing records are never overwritten during initialization; the marker is not exposed through public APIs. Do not delete it to reset content. On the first startup with the enquiry-email update, an existing business contact email is changed to `hello@clarigence.in` only when it still equals the old `clarigence@gmail.com` default. Custom contact addresses are preserved, and a separate marker prevents later CMS edits from being changed again.

## Admin workflow

- **Services:** add/edit; publish/deactivate; change order; edit descriptions, capabilities, benefits and use cases; select an icon; set an image path; delete with confirmation.
- **Portfolio:** add/edit; publish/unpublish; feature on the homepage; edit technologies/category/image/project URL; explicitly label demos/concepts; delete with confirmation. Defaults are unpublished and marked as concepts until you decide otherwise.
- **Homepage:** edit the headline (one to three lines), supporting text, CTA labels/links, About preview and main CTA text. Letter motion applies to the managed headline.
- **About:** edit the heading, introduction, company description, values introduction and optional mission/vision.
- **Site Settings:** manage business name, tagline, email, WhatsApp, address, social links and hours. Direct phone display is disabled by default, respecting the earlier request to remove it. A phone value is omitted from the public settings response unless display is explicitly enabled.
- **SEO:** select a public page and edit its title, description and Open Graph metadata.

Lower display order appears first; equal orders use ID as a stable tiebreaker. Slugs become read-only after creation, including server-side enforcement, to preserve shared URLs. Use deactivate/unpublish instead of deleting content you may need again. Version checks prevent silently overwriting another session's edits; reload if the CMS reports a conflict.

Portfolio's stable internal slug is separate from **Project URL**. Enter `www.abc.com`, `abc.com/work`, `https://www.abc.com`, or an HTTP URL in Project URL; addresses without a scheme are saved with `https://`. Existing local page links remain supported. Edit fetches the latest complete record, and admin reads bypass browser caching. Optional portfolio fields omitted or null in API updates retain their saved values; send an empty string or empty list to clear text/list fields, and explicit `false` to disable a flag. No schema migration or existing-record rewrite is needed.

Changes appear after refreshing the public page. Responses are fetched once per endpoint per page load, with no persistent content cache. Public lists include only active records. The homepage shows up to two active, featured projects.

Portfolio Add/Edit includes **Upload photo (optional)**. Choose one PNG, JPEG or GIF up to 5 MB and 16 million pixels, then Save. The authenticated, CSRF-protected upload endpoint stores validated image bytes in MySQL and fills Image URL/path automatically. Leaving the chooser empty keeps the existing URL; a new project can be saved without a photo. The public site resolves uploaded paths against the backend API origin. Uploaded photos survive container restarts and redeploys with the database. Include `portfolio_images` in database backups. Photos are retained when a project is deleted or its image is replaced; automatic removal is not implemented. If the project save fails after upload, the generated URL stays in the form for retry.

Upload API: `POST /api/admin/cms/portfolio/images` with multipart `file`; public image bytes: `GET /api/portfolio/images/{id}`. Deploy the backend and public `cms.js` together to enable this feature on the live site.

## APIs

| Access | Endpoints |
|---|---|
| Public GET | `/api/services`, `/api/services/{slug}` |
| Public GET | `/api/portfolio`, `/api/portfolio/{slug}` |
| Public GET | `/api/content/home`, `/api/content/about`, `/api/content/business`, `/api/content/seo-{page}` |
| Admin GET | `/api/admin/cms/summary`, `/api/admin/cms/{services\|portfolio}`, `/api/admin/cms/{services\|portfolio}/{id}` |
| Admin POST | `/api/admin/cms/{services\|portfolio}` |
| Admin PUT/DELETE | `/api/admin/cms/{services\|portfolio}/{id}` |
| Admin GET | `/api/admin/content/schema`, `/api/admin/content/{key}` |
| Admin PUT | `/api/admin/content/{key}` |
| Preserved | `POST /api/contact`, existing admin auth/dashboard/enquiry endpoints |

Admin item requests use `name` for both service names and portfolio titles, along with the module-specific fields. Public portfolio DTOs expose `title`. Public service lists contain concise summaries; the slug endpoint supplies full capabilities and benefits. Admin update requests include the `version` returned when loading the record. Content updates send `{ "content": { ... }, "version": 0 }` with the current version, not an assumed zero.

## Security and images

Existing BCrypt authentication, session behavior, admin roles and CSRF protection remain intact. Only specified public GET routes are opened. CMS mutations remain admin-only and use the existing CSRF helper. CORS adds GET to the configured exact-origin policy; it does not use wildcard origins, allow credentialed public reads, or allow cross-origin PUT/DELETE.

Content is rendered with DOM text nodes, not raw HTML. Server-side schemas restrict fields and sizes, validate names/slugs/orders/emails/URLs, reject duplicate slugs and block unsafe image paths. There is no upload endpoint. Images accept existing raster paths such as `assets/images/project.png`, `/images/project.jpg`, or `/uploads/project.webp`, including query parameters and uppercase extensions. Local paths resolve from the public website root and must refer to files actually served by the website, rather than a Windows filesystem path. External HTTP/HTTPS raster URLs and extensionless image CDN endpoints with query parameters are supported. Prefer HTTPS for images on the HTTPS public site. SVG, executable schemes, path traversal and credentials in URLs remain rejected. Broken images are removed gracefully. Add local image files through your normal project workflow; the current static build copies `assets/`, so use that directory for images shipped with this project.

## Frontend configuration and deployment

`api-config.js` contains the single `apiBaseUrl`, locally `http://localhost:8081`. The contact endpoint is derived from it. `cms.js` uses the same base for all public CMS requests. Admin requests remain same-origin on the backend.

Set production `CLARIGENCE_API_BASE_URL` to the deployed HTTPS backend base and build with `node scripts/build-static.js`. The existing `CLARIGENCE_API_URL` ending in `/api/contact` remains supported for compatibility; the new base variable takes precedence. Do not include credentials, queries or fragments. Retain the backend's existing production database/session/SMTP environment settings and exact frontend CORS origin.

The public static shell remains available when the API is down, with clear Services/Portfolio errors and retained fallback page/settings copy. Contact submission requires the backend and an active service.

CMS SEO changes update browser metadata. Static source metadata remains a fallback for crawlers that do not execute JavaScript; Open Graph previews from such crawlers need a future build-time metadata export to reflect CMS edits. Canonicals still use the chosen Clarigence primary domain, with service query canonicals updated in the browser.

## Testing

```powershell
cd backend
mvn clean verify
```

The full suite includes ten new CMS integration tests alongside all fourteen existing tests. These use H2 and do not reset MySQL or change existing admin credentials.

Optional real-browser verification uses the guarded, test-only `CmsBrowserFixture`. It forces an in-memory database and disables admin bootstrap/email, then creates a random temporary test admin only in that database. It is not packaged into the production JAR. From `backend`:

```powershell
mvn spring-boot:run "-Dspring-boot.run.main-class=in.clarigence.contactapi.CmsBrowserFixture" "-Dspring-boot.run.useTestClasspath=true" "-Dspring-boot.run.additional-classpath-elements=target/test-classes"
```

With the frontend on port 8000 and Playwright installed only in the ignored `.qa-tools` folder, run from the project root:

```powershell
node scripts/verify-cms.cjs
```

The fixture uses port 18081, leaving the user's MySQL-backed port 8081 free. Test-only credentials stay in the ignored QA folder and are never printed. The browser intercepts the public configuration only within its test context. Screenshots and its report are in `artifacts/qa/cms/` (ignored by Git).

For final MySQL verification, start the normal backend with the private-prompt script, use the existing admin account, and repeat the documented add/edit/deactivate service, publish project, contact submission and enquiry status flow. Do not use the isolated fixture credentials on the normal backend.

## File inventory

### Added

- `backend/src/main/java/in/clarigence/contactapi/controller/AdminCmsController.java`
- `backend/src/main/java/in/clarigence/contactapi/controller/PublicCmsController.java`
- `backend/src/main/java/in/clarigence/contactapi/controller/SiteContentController.java`
- `backend/src/main/java/in/clarigence/contactapi/dto/AdminCmsItem.java`
- `backend/src/main/java/in/clarigence/contactapi/dto/CmsItemRequest.java`
- `backend/src/main/java/in/clarigence/contactapi/dto/PublicProject.java`
- `backend/src/main/java/in/clarigence/contactapi/dto/PublicService.java`
- `backend/src/main/java/in/clarigence/contactapi/dto/ServiceSummary.java`
- `backend/src/main/java/in/clarigence/contactapi/dto/SiteDocumentRequest.java`
- `backend/src/main/java/in/clarigence/contactapi/entity/CmsItem.java`
- `backend/src/main/java/in/clarigence/contactapi/entity/PortfolioProject.java`
- `backend/src/main/java/in/clarigence/contactapi/entity/SiteDocument.java`
- `backend/src/main/java/in/clarigence/contactapi/entity/StringListConverter.java`
- `backend/src/main/java/in/clarigence/contactapi/entity/WebsiteService.java`
- `backend/src/main/java/in/clarigence/contactapi/exception/CmsConflictException.java`
- `backend/src/main/java/in/clarigence/contactapi/exception/CmsValidationException.java`
- `backend/src/main/java/in/clarigence/contactapi/repository/PortfolioProjectRepository.java`
- `backend/src/main/java/in/clarigence/contactapi/repository/SiteDocumentRepository.java`
- `backend/src/main/java/in/clarigence/contactapi/repository/WebsiteServiceRepository.java`
- `backend/src/main/java/in/clarigence/contactapi/service/CmsInitializationService.java`
- `backend/src/main/java/in/clarigence/contactapi/service/CmsSeedRunner.java`
- `backend/src/main/java/in/clarigence/contactapi/service/CmsService.java`
- `backend/src/main/java/in/clarigence/contactapi/service/CmsValidation.java`
- `backend/src/main/java/in/clarigence/contactapi/service/SiteContentService.java`
- `backend/src/main/resources/cms-seed.json`
- `backend/src/main/resources/static/admin/cms-admin.js`
- `backend/src/test/java/in/clarigence/contactapi/CmsBrowserFixture.java`
- `backend/src/test/java/in/clarigence/contactapi/CmsIntegrationTest.java`
- `cms.js`
- `scripts/export-cms-seed.py`
- `scripts/verify-cms.cjs`
- `CMS-GUIDE.md` (this guide)

### Modified

- `README.md`
- `about.html`
- `api-config.js`
- `backend/src/main/java/in/clarigence/contactapi/config/AdminSecurityConfig.java`
- `backend/src/main/java/in/clarigence/contactapi/config/CorsConfig.java`
- `backend/src/main/java/in/clarigence/contactapi/exception/ApiExceptionHandler.java`
- `backend/src/main/resources/static/admin/admin.css`
- `backend/src/main/resources/static/admin/admin.js`
- `backend/src/main/resources/static/admin/index.html`
- `contact.html`
- `index.html`
- `portfolio.html`
- `script.js`
- `scripts/build-static.js`
- `scripts/generate-pages.py`
- `services.html`
- `solutions.html`
- `styles.css`
