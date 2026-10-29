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
        if(outcome==='network')return route.abort('failed');
        if(outcome==='server')return route.fulfill({status:503,json:{message:'private delivery diagnostic'}});
        if(outcome==='validation')return route.fulfill({status:400,json:{fieldErrors:{email:'private email diagnostic'}}});
        if(outcome==='success')await new Promise(resolve=>setTimeout(resolve,250));
        await route.fulfill({status: 200, contentType: 'application/json',
          body: JSON.stringify({success: outcome === 'success' ? 'true' : 'false'})});
      });
      await page.goto(`${process.env.QA_ORIGIN || 'http://127.0.0.1:8000'}${path}`);
      await page.waitForFunction(() => !document.querySelector('[name=service]').disabled);
      assert.equal(await page.locator('[name=service] option').count(), 11);
      await page.locator('.form-submit').click();
      assert.equal(submissions.length, 0, 'Invalid details must not be sent');
      await page.locator('[name=name]').fill('Isolated Browser Test');
      await page.locator('[name=email]').fill('test@example.invalid');
      await page.locator('[name=service]').selectOption({index: 1});
      await page.locator('[name=message]').fill('A browser test intercepted locally; no email is sent.');
      await page.locator('[name=phone]').fill('not a phone');
      await page.locator('.form-submit').click();
      assert.equal(await page.locator('[name=phone]').getAttribute('aria-invalid'),'true');
      assert.equal(submissions.length,0);
      await page.locator('[name=phone]').fill('+91 90000 00000');
      await page.locator('[name=message]').fill('Short');
      await page.locator('.form-submit').click();
      assert.equal(await page.locator('[name=message]').getAttribute('aria-invalid'),'true');
      assert.equal(submissions.length,0);
      await page.locator('[name=message]').fill('A browser test intercepted locally; no email is sent.');
      await page.locator('.form-submit').click();
      await page.waitForFunction(() => document.querySelector('#form-status').dataset.state === 'error');
      assert.equal(await page.locator('[name=name]').inputValue(), 'Isolated Browser Test');
      outcome = 'success';
      await page.locator('.form-submit').click();
      assert(await page.locator('.form-submit').isDisabled());
      await page.waitForFunction(() => document.querySelector('#form-status').dataset.state === 'success');
      assert.equal(await page.locator('[name=name]').inputValue(), '');
      assert.equal(submissions.length, 2);
      const request = submissions[1];
      assert.equal(request.url(), 'https://formsubmit.co/ajax/hello@clarigence.in');
      assert.equal(request.postDataJSON().email, 'test@example.invalid');
      assert.equal(request.postDataJSON()._subject, 'New Clarigence website enquiry');
      assert.equal(request.headers()['idempotency-key'], undefined);
      for(const mode of ['validation','server','network']){
        outcome=mode;
        await page.locator('[name=name]').fill('Retained details');
        await page.locator('[name=email]').fill('test@example.invalid');
        await page.locator('[name=service]').selectOption({index:1});
        await page.locator('[name=message]').fill('An intercepted test of email delivery failure.');
        await page.locator('.form-submit').click();
        await page.waitForFunction(()=>document.querySelector('#form-status').dataset.state==='error');
        assert.equal(await page.locator('[name=name]').inputValue(),'Retained details');
        assert(!(await page.locator('.contact-form').innerText()).includes('private'));
        if(mode==='validation')assert.equal(await page.locator('[name=email]').getAttribute('aria-invalid'),'true');
        assert(await page.locator('.form-submit').isEnabled());
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Both email forms passed: static services, validation, rejected response, retained details, accepted response and payload. No emails sent.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
