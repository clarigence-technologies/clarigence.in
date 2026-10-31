<<<<<<< HEAD
const {test} = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const handler = require('../api/contact');
const valid = {name: 'Test Visitor', email: 'visitor@example.invalid', phone: '',
  company: '', service: 'Website Development', message: 'Test enquiry details.'};
async function request(body, origin = 'https://www.clarigence.in', method = 'POST') {
  const res = {setHeader() {}, status(code) { this.code = code; return this; },
    json(value) { this.body = value; return this; }};
  await handler({method, headers: {origin}, body}, res);
  return res;
}
test('Titan endpoint validates requests and reports actual SMTP acceptance', async () => {
  const original = nodemailer.createTransport;
  const password = process.env.TITAN_SMTP_PASSWORD;
  let mail, options, closed = false, fail = false, accepted = ['hello@clarigence.in'];
  nodemailer.createTransport = config => {
    options = config;
    return {async sendMail(value) { mail = value; if (fail) throw new Error('SMTP unavailable'); return {accepted}; },
      close() { closed = true; }};
  };
  try {
    delete process.env.TITAN_SMTP_PASSWORD;
    assert.equal((await request(valid)).code, 503);
    process.env.TITAN_SMTP_PASSWORD = 'isolated-test-value';
    assert.equal((await request(valid, 'https://external.invalid')).code, 403);
    assert.equal((await request(valid, undefined, 'GET')).code, 405);
    assert.equal((await request('{broken')).code, 400);
    const invalid = await request({...valid, email: 'a@b.invalid\r\nBcc: attacker@b.invalid', service: 'invalid'});
    assert.equal(invalid.code, 400);
    assert.deepEqual(Object.keys(invalid.body.fieldErrors), ['email', 'service']);
    assert.equal((await request({...valid, to: 'attacker@example.invalid'})).body.success, true);
    assert.equal(mail.to, 'hello@clarigence.in');
    assert.equal(mail.from.address, 'hello@clarigence.in');
    assert.equal(mail.replyTo, valid.email);
    assert.ok(mail.text.includes(valid.message));
    assert.equal(options.secure, true);
    assert.equal(options.port, 465);
    assert.equal(closed, true);
    accepted = [];
    assert.equal((await request(valid)).code, 502);
    fail = true;
    assert.equal((await request(valid)).body.success, false);
  } finally {
    nodemailer.createTransport = original;
    if (password === undefined) delete process.env.TITAN_SMTP_PASSWORD;
    else process.env.TITAN_SMTP_PASSWORD = password;
  }
});
=======
// Server-side delivery checks. SMTP is replaced locally; no messages leave this process.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createContactHandler} = require('../lib/contact-handler');

const valid = {name: 'Enquiry test', email: 'visitor@example.invalid', phone: '+91 90000 00000', company: 'R&D', service: 'Website Development', message: 'Please discuss a new website.\nThank you.'};
const configured = {NODE_ENV: 'production', SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '465', SMTP_USERNAME: 'hello@clarigence.in', SMTP_PASSWORD: 'private-test-password'};

function setup({env = configured, sendMail = async () => ({accepted: ['hello@clarigence.in']}), constructionError} = {}) {
  const calls = [], logs = [], options = [];
  let closed = 0;
  const handler = createContactHandler({env, log: message => logs.push(message), createTransport: settings => {
    if (constructionError) throw constructionError;
    options.push(settings);
    return {sendMail: async message => {calls.push(message); return sendMail(message);}, close: () => closed++};
  }});
  return {calls, logs, options, get closed() {return closed;}, async request(overrides = {}) {
    const response = {headers: {}, setHeader(name, value) {this.headers[name] = value;}, status(code) {this.code = code; return this;}, json(body) {this.body = body; return this;}};
    await handler({method: 'POST', headers: {origin: 'https://www.clarigence.in', 'content-type': 'application/json'}, body: valid, ...overrides}, response);
    return response;
  }};
}

test('Send enquiry delivers to the fixed business mailbox and uses the visitor as Reply-To', async () => {
  const app = setup();
  const result = await app.request({body: {...valid, name: '  Enquiry test  ', to: 'attacker@example.invalid', _cc: 'attacker@example.invalid', attachments: [{path: '/etc/passwd'}]}});
  assert.equal(result.code, 200);
  assert.deepEqual(result.body, {success: true});
  assert.equal(result.headers['Cache-Control'], 'no-store');
  const mail = app.calls[0];
  assert.equal(mail.to, 'hello@clarigence.in');
  assert.equal(mail.from.address, 'hello@clarigence.in');
  assert.equal(mail.replyTo.address, valid.email);
  assert.equal(mail.subject, 'New Clarigence website enquiry');
  for (const value of Object.values(valid)) assert(mail.text.includes(value));
  assert.equal(mail.cc, undefined);
  assert.equal(mail.attachments, undefined);
  assert.equal(app.options[0].secure, true);
  assert.equal(app.options[0].requireTLS, true);
  assert.equal(app.closed, 1);
});

test('SMTP port 587 requires STARTTLS and permits an authorized sender override', async () => {
  const app = setup({env: {...configured, SMTP_PORT: '587', ENQUIRY_EMAIL_FROM: 'website@clarigence.in'}});
  assert.equal((await app.request()).code, 200);
  assert.equal(app.options[0].secure, false);
  assert.equal(app.options[0].requireTLS, true);
  assert.equal(app.calls[0].from.address, 'website@clarigence.in');
});

test('unsupported methods and foreign origins cannot send', async () => {
  const app = setup();
  assert.equal((await app.request({method: 'GET'})).code, 405);
  for (const origin of ['https://attacker.invalid', 'http://localhost:8000', undefined]) {
    assert.equal((await app.request({headers: {origin, 'content-type': 'application/json'}})).code, 403);
  }
  assert.equal(app.calls.length, 0);
});

test('Vercel deployment previews and local development can use their own endpoint', async () => {
  for (const [env, origin] of [[{...configured, VERCEL_URL: 'example.vercel.app'}, 'https://example.vercel.app'], [{...configured, NODE_ENV: 'development'}, 'http://localhost:8000']]) {
    const app = setup({env});
    assert.equal((await app.request({headers: {origin, 'content-type': 'application/json'}})).code, 200);
  }
});

test('malformed, oversized or unsupported request bodies never reach SMTP', async () => {
  const app = setup();
  for (const body of ['{', null, [], true]) assert.equal((await app.request({body})).code, 400);
  assert.equal((await app.request({body: {...valid, padding: 'x'.repeat(33000)}})).code, 413);
  assert.equal((await app.request({headers: {origin: 'https://www.clarigence.in', 'content-type': 'text/plain'}})).code, 415);
  assert.equal(app.calls.length, 0);
});

test('server validates fields even when browser validation is bypassed', async () => {
  const app = setup();
  for (const [field, value] of [['name', ''], ['name', 'x'.repeat(121)], ['email', 'visitor@example.invalid\r\nBcc: attacker@example.invalid'], ['email', {}], ['phone', 'not a number'], ['company', 'x'.repeat(161)], ['service', 'Unknown service'], ['message', 'short'], ['message', 'x'.repeat(5001)]]) {
    const result = await app.request({body: {...valid, [field]: value}});
    assert.equal(result.code, 400, field);
    assert(result.body.fieldErrors[field], field);
  }
  assert.equal(app.calls.length, 0);
});

test('unconfigured SMTP never reports successful delivery or exposes credentials', async () => {
  for (const env of [{}, {...configured, SMTP_PASSWORD: ''}, {...configured, SMTP_PORT: '25'}]) {
    const app = setup({env});
    const result = await app.request();
    assert.equal(result.code, 503);
    assert.deepEqual(result.body, {success: false});
    assert.equal(app.calls.length, 0);
    assert(!JSON.stringify(app.logs).includes(configured.SMTP_PASSWORD));
  }
});

test('SMTP failure, timeout and rejected recipient never report success or retry', async () => {
  for (const code of ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'secret-provider-detail']) {
    const app = setup({sendMail: async () => {throw Object.assign(new Error('private-test-password private email diagnostic'), {code});}});
    const result = await app.request();
    assert.equal(result.code, 502);
    assert.deepEqual(result.body, {success: false});
    assert.equal(app.calls.length, 1);
    assert.equal(app.closed, 1);
    assert(!JSON.stringify(app.logs).includes('private'));
    assert(!JSON.stringify(app.logs).includes('secret-provider-detail'));
  }
  const rejected = setup({sendMail: async () => ({accepted: [], rejected: ['hello@clarigence.in']})});
  assert.equal((await rejected.request()).code, 502);
  const failedSetup = setup({constructionError: new Error('private setup detail')});
  assert.equal((await failedSetup.request()).code, 502);
});
>>>>>>> aa121380a22126890a726815ea76a6f7c4c22044
