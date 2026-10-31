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
      await page.route('**/api/contact', async route => {
        submissions.push(route.request());
<<<<<<< HEAD
        if (outcome === 'offline') return route.abort('failed');
        if (outcome === 'outage') return route.fulfill({status: 521,
          contentType: 'text/plain', body: 'error code: 521'});
=======
        if(outcome==='network')return route.abort('failed');
        if(outcome==='server')return route.fulfill({status:503,json:{message:'private delivery diagnostic'}});
        if(outcome==='provider')return route.fulfill({status:521,contentType:'text/plain',body:'Web server is down'});
        if(outcome==='html')return route.fulfill({status:200,contentType:'text/html',body:'<html>Service unavailable</html>'});
        if(outcome==='validation')return route.fulfill({status:400,json:{fieldErrors:{email:'private email diagnostic'}}});
        if(outcome==='success')await new Promise(resolve=>setTimeout(resolve,250));
>>>>>>> aa121380a22126890a726815ea76a6f7c4c22044
        await route.fulfill({status: 200, contentType: 'application/json',
          body: JSON.stringify({success: outcome === 'success'})});
      });
<<<<<<< HEAD
      await page.goto(`${process.env.FORM_TEST_BASE_URL || 'http://127.0.0.1:8012'}${path}`);
=======
      await page.goto(`${process.env.QA_ORIGIN || 'http://127.0.0.1:8000'}${path}`);
>>>>>>> aa121380a22126890a726815ea76a6f7c4c22044
      await page.waitForFunction(() => !document.querySelector('[name=service]').disabled);
      assert.equal(await page.locator('.form-email-fallback').count(), 0);
      assert.equal(await page.locator('.contact-form button').count(), 1);
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
      assert(await page.locator('.form-submit').isDisabled());
      await page.waitForFunction(() => document.querySelector('#form-status').dataset.state === 'success');
      assert.equal(await page.locator('[name=name]').inputValue(), '');
<<<<<<< HEAD
      assert.equal(await page.locator('#form-status a').count(), 0);
      assert.equal(submissions.length, 4);
      const request = submissions[3];
      assert.equal(request.url(), 'https://formsubmit.co/ajax/hello@clarigence.in');
=======
      assert.equal(submissions.length, 2);
      const request = submissions[1];
      assert.equal(new URL(request.url()).pathname, '/api/contact');
>>>>>>> aa121380a22126890a726815ea76a6f7c4c22044
      assert.equal(request.postDataJSON().email, 'test@example.invalid');
      assert.equal(request.postDataJSON().service, 'Website Development');
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
        assert.equal(await page.locator('.form-email-fallback').count(), 0);
        assert.equal(await page.locator('.contact-form a[href^="mailto:"]').count(), 0);
        assert.equal(await page.locator('[name=message]').inputValue(), message);
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
<<<<<<< HEAD
    console.log('Both forms passed: validation, rejected response, provider 521 outage, network failure, email draft fallback, retained details, recovery and payload. No emails sent.');
=======
    console.log('Both Send enquiry forms passed: same-origin API payload, validation, success, rejected response, server/network/invalid JSON failures, retained details, one submit button, no mail-app fallback and no automatic retries. Desktop/mobile checks passed. No emails sent.');
>>>>>>> aa121380a22126890a726815ea76a6f7c4c22044
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
