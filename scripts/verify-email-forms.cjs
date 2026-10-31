// Isolated browser checks: never send a real email or enquiry.
const { chromium } = require('../.qa-tools/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    for (const path of ['/', '/contact']) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let outcome = 'failure';
      const submissions = [];
      await page.route('https://formsubmit.co/**', async route => {
        submissions.push(route.request());
        if (outcome === 'offline') return route.abort('failed');
        if (outcome === 'outage') return route.fulfill({status: 521,
          contentType: 'text/plain', body: 'error code: 521'});
        await route.fulfill({status: 200, contentType: 'application/json',
          body: JSON.stringify({success: outcome === 'success' ? 'true' : 'false'})});
      });
      await page.goto(`${process.env.FORM_TEST_BASE_URL || 'http://127.0.0.1:8012'}${path}`);
      await page.waitForFunction(() => !document.querySelector('[name=service]').disabled);
      assert.equal(await page.locator('[name=service] option').count(), 11);
      await page.locator('.form-submit').click();
      assert.equal(submissions.length, 0, 'Invalid details must not be sent');
      await page.locator('[name=name]').fill('Isolated Browser Test');
      await page.locator('[name=email]').fill('test@example.invalid');
      await page.locator('[name=service]').selectOption({index: 1});
      await page.locator('[name=message]').fill('A browser test intercepted locally; no email is sent.');
      await page.locator('.form-submit').click();
      await page.waitForFunction(() => document.querySelector('#form-status').dataset.state === 'error');
      assert.equal(await page.locator('[name=name]').inputValue(), 'Isolated Browser Test');
      for (const failure of ['outage', 'offline']) {
        outcome = failure;
        await page.locator('.form-submit').click();
        await page.waitForFunction(() => document.querySelector('#form-status').dataset.state === 'error');
        const fallback = page.locator('#form-status a');
        const email = new URL(await fallback.getAttribute('href'));
        assert.equal(email.pathname, 'hello@clarigence.in');
        assert.equal(email.searchParams.get('subject'), 'New Clarigence website enquiry');
        assert.ok(email.searchParams.get('body').includes('Name: Isolated Browser Test'));
        assert.ok(email.searchParams.get('body').includes('Email: test@example.invalid'));
        assert.ok(email.searchParams.get('body').includes('A browser test intercepted locally'));
        assert.equal(await page.locator('[name=name]').inputValue(), 'Isolated Browser Test');
        assert.equal(await page.locator('.form-submit').isEnabled(), true);
      }
      outcome = 'success';
      await page.locator('.form-submit').click();
      await page.waitForFunction(() => document.querySelector('#form-status').dataset.state === 'success');
      assert.equal(await page.locator('[name=name]').inputValue(), '');
      assert.equal(await page.locator('#form-status a').count(), 0);
      assert.equal(submissions.length, 4);
      const request = submissions[3];
      assert.equal(request.url(), 'https://formsubmit.co/ajax/hello@clarigence.in');
      assert.equal(request.postDataJSON().email, 'test@example.invalid');
      assert.equal(request.postDataJSON()._subject, 'New Clarigence website enquiry');
      assert.equal(request.headers()['idempotency-key'], undefined);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Both forms passed: validation, rejected response, provider 521 outage, network failure, email draft fallback, retained details, recovery and payload. No emails sent.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
