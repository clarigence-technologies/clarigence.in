// Isolated browser checks: never send a real email or enquiry.
const { chromium } = require('../.qa-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodePath = require('node:path');
const output = nodePath.resolve(__dirname, '../artifacts/qa');
fs.mkdirSync(output, {recursive: true});

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    for (const path of ['/', '/contact']) {
      const page = await browser.newPage({viewport: {width: path === '/' ? 1440 : 390, height: 900}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let outcome = 'failure';
      const submissions = [];
      await page.route('https://formsubmit.co/**', async route => {
        submissions.push(route.request());
        if(outcome==='network')return route.abort('failed');
        if(outcome==='server')return route.fulfill({status:503,json:{message:'private delivery diagnostic'}});
        if(outcome==='provider')return route.fulfill({status:521,contentType:'text/plain',body:'Web server is down'});
        if(outcome==='html')return route.fulfill({status:200,contentType:'text/html',body:'<html>Service unavailable</html>'});
        if(outcome==='validation')return route.fulfill({status:400,json:{fieldErrors:{email:'private email diagnostic'}}});
        if(outcome==='success')await new Promise(resolve=>setTimeout(resolve,250));
        await route.fulfill({status: 200, contentType: 'application/json',
          body: JSON.stringify({success: outcome === 'success' ? 'true' : 'false'})});
      });
      await page.goto(`${process.env.QA_ORIGIN || 'http://127.0.0.1:8000'}${path}`);
      await page.waitForFunction(() => !document.querySelector('[name=service]').disabled);
      const fallback = page.locator('.form-email-fallback');
      assert.equal(await fallback.isVisible(), false);
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
      assert(await fallback.isVisible());
      outcome = 'success';
      await page.locator('.form-submit').click();
      assert(await page.locator('.form-submit').isDisabled());
      assert.equal(await fallback.isVisible(), false);
      await page.waitForFunction(() => document.querySelector('#form-status').dataset.state === 'success');
      assert.equal(await page.locator('[name=name]').inputValue(), '');
      assert.equal(await fallback.isVisible(), false);
      assert.equal(submissions.length, 2);
      const request = submissions[1];
      assert.equal(request.url(), 'https://formsubmit.co/ajax/hello@clarigence.in');
      assert.equal(request.postDataJSON().email, 'test@example.invalid');
      assert.equal(request.postDataJSON()._subject, 'New Clarigence website enquiry');
      assert.equal(request.headers()['idempotency-key'], undefined);
      for(const mode of ['validation','server','network','provider','html']){
        outcome=mode;
        await page.locator('[name=name]').fill('Retained details');
        await page.locator('[name=email]').fill('test@example.invalid');
        await page.locator('[name=service]').selectOption({index:1});
        const message = 'An intercepted test: R&D + websites? <draft>\nNo email is sent.';
        await page.locator('[name=message]').fill(message);
        const previousCount = submissions.length;
        await page.locator('.form-submit').click();
        await page.waitForFunction(()=>document.querySelector('#form-status').dataset.state==='error');
        assert.equal(await page.locator('[name=name]').inputValue(),'Retained details');
        assert(!(await page.locator('.contact-form').innerText()).includes('private'));
        if(mode==='validation')assert.equal(await page.locator('[name=email]').getAttribute('aria-invalid'),'true');
        assert.equal(await fallback.isVisible(), mode !== 'validation');
        if(mode!=='validation'){
          const draft = new URL(await fallback.locator('a').getAttribute('href'));
          assert.equal(draft.protocol, 'mailto:');
          assert.equal(draft.pathname, 'hello@clarigence.in');
          assert.equal(draft.searchParams.get('subject'), 'Clarigence website enquiry');
          assert(draft.searchParams.get('body').includes('Name: Retained details'));
          assert(draft.searchParams.get('body').includes('Email: test@example.invalid'));
          assert(draft.searchParams.get('body').includes('Service: Website Development'));
          assert(draft.searchParams.get('body').includes(message));
          assert((await fallback.innerText()).includes('Send the email there'));
          await page.locator('[name=name]').fill('Updated enquiry details');
          const updatedDraft = new URL(await fallback.locator('a').getAttribute('href'));
          assert(updatedDraft.searchParams.get('body').includes('Name: Updated enquiry details'));
          assert.equal(await page.locator('[name=message]').inputValue(), message);
        }
        assert.equal(submissions.length, previousCount + 1, 'Failures must not automatically resubmit');
        assert(await page.locator('.form-submit').isEnabled());
        if(mode==='provider'){
          assert((await page.locator('#form-status').innerText()).includes('temporarily unavailable'));
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
          await page.locator('.contact-form').screenshot({path: nodePath.join(output, `form-outage-${path === '/' ? 'home' : 'contact'}.png`)});
        }
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Both email forms passed: validation, success, rejected response, HTTP 521 outage, server/network/invalid JSON failures, retained details, prefilled email fallback and no automatic retries. Desktop/mobile checks passed. No emails sent.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
