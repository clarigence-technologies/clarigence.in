const {chromium} = require('../.qa-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const content = require('../content.json');

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    const page = await browser.newPage({reducedMotion: 'reduce'});
    for (const width of [390, 1440]) {
      await page.setViewportSize({width, height: 900});
      await page.goto('http://localhost:8000/');
      await page.waitForSelector('.client-logo');
      await page.locator('.client-logo').evaluateAll(nodes => Promise.all(nodes.map(n => {n.loading = 'eager'; return n.decode();})));
      assert.equal(await page.locator('.client-logo').count(), 4);
      for (const client of content.clients) {
        const logo = page.getByAltText(`${client.name} logo`, {exact: true});
        if (client.websiteUrl) {
          const link = logo.locator('..');
          assert.equal(await link.getAttribute('href'), client.websiteUrl);
          assert.equal(await link.getAttribute('target'), '_blank');
          assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
          // Intercept the destination so the real link can be clicked without visiting a client site.
          await page.context().route(client.websiteUrl, route => route.fulfill({body: '<title>Client website</title>'}));
          const popupPromise = page.waitForEvent('popup');
          await link.click();
          const popup = await popupPromise;
          await popup.waitForLoadState();
          assert.equal(popup.url(), client.websiteUrl);
          await popup.close();
        } else {
          assert.equal(await logo.locator('..').getAttribute('href'), null);
        }
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('[data-clients-section]').screenshot({path: `artifacts/qa/home-clients-${width}.png`});
      await page.goto('http://localhost:8000/portfolio');
      await page.waitForSelector('.project-image');
      assert.equal(await page.locator('.project-image').count(), 4);
      assert.equal(await page.locator('.concept-preview').count(), 4);
      assert.equal(await page.locator('.project-symbol').count(), 0);
      console.log(`${width}px: four client logos loaded; available links open correct websites in new tabs; portfolio images retained.`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exit(1);});
