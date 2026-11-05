// Google tag checks. Google's script is stubbed, so no visits reach Google Analytics. Enquiries are intercepted; no emails are sent.
// Builds dist/ with a test tag ID while running, and always rebuilds it without the tag afterwards.
const { chromium } = require('../.qa-tools/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:8000';
const routes = ['/', '/about', '/services', '/solutions', '/portfolio', '/contact', '/privacy'];
const { GOOGLE_TAG_ID: ignored, ...cleanEnv } = process.env;

const build = env => execFileSync(process.execPath, ['scripts/build-static.js'], { cwd: root, env: { ...cleanEnv, ...env }, stdio: 'ignore' });
const builtPages = () => fs.readdirSync(dist).filter(name => name.endsWith('.html'));
const secrets = ['Analytics Check', 'analytics@example.invalid', 'A private analytics test message.'];

async function session(browser, { blockTag = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const seen = { tagRequests: 0, errors: [] };
  page.on('pageerror', error => seen.errors.push(error.message));
  await page.route(/googletagmanager\.com/, route => {
    seen.tagRequests += 1;
    return blockTag ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: '' });
  });
  await page.route(/google-analytics\.com|analytics\.google\.com/, route => route.abort());
  await page.route('**/api/contact', route => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, id: 1, message: 'Your enquiry has been received.', createdAt: '2026-11-05T05:00:00Z' }),
  }));
  return { context, page, seen };
}

async function submitEnquiry(page) {
  await page.goto(`${origin}/contact`, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('[name=service]').disabled);
  await page.locator('[name=name]').fill(secrets[0]);
  await page.locator('[name=email]').fill(secrets[1]);
  await page.locator('[name=service]').selectOption({ index: 1 });
  await page.locator('[name=message]').fill(secrets[2]);
  await page.locator('.contact-form [type=submit]').click();
  await page.waitForFunction(() => ['success', 'error'].includes(document.querySelector('#form-status').dataset.state));
  return page.locator('#form-status').getAttribute('data-state');
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    // The live site's deploy passes the real tag ID, and source pages never contain it.
    assert.match(fs.readFileSync(path.join(root, 'deploy/deploy.sh'), 'utf8'), /GOOGLE_TAG_ID=GTM-PKQFHWQX node scripts\/build-static\.js/);
    for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
      assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /googletagmanager/, `${file} source must not contain the tag`);
    }

    // Production build: Google's snippet comes first in the head of every page.
    build({ GOOGLE_TAG_ID: 'GTM-TEST' });
    assert.equal(builtPages().length, routes.length);
    for (const file of builtPages()) {
      const html = fs.readFileSync(path.join(dist, file), 'utf8');
      assert.match(html, /<head>\s*<script async src="https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=GTM-TEST"><\/script>\s*<script>\s*window\.dataLayer = window\.dataLayer \|\| \[\];\s*function gtag\(\)\{dataLayer\.push\(arguments\);\}\s*gtag\('js', new Date\(\)\);\s*<\/script>/, `${file}: snippet after <head>`);
      assert.equal(html.match(/googletagmanager/g).length, 1, `${file}: one tag`);
    }

    // Every page loads the tag straight away, with no banner and nothing for the visitor to click.
    {
      const { context, page, seen } = await session(browser);
      for (const route of routes) {
        const before = seen.tagRequests;
        await page.goto(origin + route, { waitUntil: 'load' });
        assert.equal(seen.tagRequests, before + 1, `${route}: tag loads once`);
        assert.equal(await page.evaluate(() => Array.isArray(window.dataLayer) && typeof window.gtag === 'function'), true, route);
        assert.equal(await page.locator('.consent-banner,[data-consent],[data-cookie-settings]').count(), 0, `${route}: nothing blocks analytics`);
      }
      assert.deepEqual(seen.errors, []);
      await context.close();
    }

    // A successful enquiry records the service only, never the visitor's details.
    {
      const { context, page, seen } = await session(browser);
      assert.equal(await submitEnquiry(page), 'success');
      const layer = await page.evaluate(() => window.dataLayer.map(entry => Array.from(entry)));
      const leads = layer.filter(entry => entry[0] === 'event' && entry[1] === 'generate_lead');
      assert.equal(leads.length, 1);
      assert.deepEqual(Object.keys(leads[0][2]), ['service']);
      const recorded = JSON.stringify(layer);
      for (const secret of secrets) assert(!recorded.includes(secret));
      assert.deepEqual(seen.errors, []);
      await context.close();
    }

    // An analytics failure or an ad blocker must not turn a saved enquiry into a false error.
    {
      const { context, page } = await session(browser);
      await page.addInitScript(() => {
        Object.defineProperty(window, 'gtag', { configurable: true, get() { return () => { throw new Error('analytics failure'); }; }, set() {} });
      });
      assert.equal(await submitEnquiry(page), 'success');
      await context.close();
    }
    {
      const { context, page, seen } = await session(browser, { blockTag: true });
      assert.equal(await submitEnquiry(page), 'success');
      assert.deepEqual(seen.errors, []);
      await context.close();
    }

    // Local build: no tag, so previews and test runs send nothing, and enquiries still work.
    build({});
    for (const file of builtPages()) {
      assert.doesNotMatch(fs.readFileSync(path.join(dist, file), 'utf8'), /googletagmanager/, `${file}: local build has no tag`);
    }
    {
      const { context, page, seen } = await session(browser);
      assert.equal(await submitEnquiry(page), 'success');
      assert.equal(seen.tagRequests, 0);
      assert.deepEqual(seen.errors, []);

      // The policy is linked where details are collected and from every footer, and is listed for search engines.
      assert.equal(await page.locator('.form-note a[href="/privacy"]').count(), 1);
      for (const route of routes) {
        await page.goto(origin + route, { waitUntil: 'load' });
        assert.equal(await page.locator('.footer-legal a[href="/privacy"]').count(), 1, `${route}: footer privacy link`);
      }
      await page.goto(`${origin}/privacy`, { waitUntil: 'load' });
      assert.equal(await page.locator('h1').count(), 1);
      assert.match(await page.locator('.legal-updated').innerText(), /Last updated/);
      assert.match(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'), /clarigence\.in\/privacy/);
      await context.close();
    }

    console.log('Google tag passed: production pages load it straight away with nothing blocking it, local builds leave it out, enquiry events carry no personal details, and analytics failures cannot break the form. No data sent to Google.');
  } finally {
    await browser.close();
    build({});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
