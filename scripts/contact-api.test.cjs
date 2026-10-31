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
