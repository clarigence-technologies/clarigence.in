const services = new Set(require('../content.json').services.filter(service => service.active !== false).map(service => service.name));
const recipient = 'hello@clarigence.in';
const emailPattern = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;

function createContactHandler({env = process.env, createTransport = options => require('nodemailer').createTransport(options), log = console.error} = {}) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const reply = (status, body) => response.status(status).json(body);
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return reply(405, {success: false});
    }
    const origins = new Set(['https://clarigence.in', 'https://www.clarigence.in']);
    for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) {
      if (host) origins.add(`https://${host}`);
    }
    if (env.NODE_ENV !== 'production' && env.VERCEL !== '1') {
      origins.add('http://localhost:8000');
      origins.add('http://127.0.0.1:8000');
    }
    if (!origins.has(request.headers.origin)) return reply(403, {success: false});
    if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) {
      return reply(415, {success: false});
    }
    let body = request.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return reply(400, {success: false}); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, {success: false});
    if (Buffer.byteLength(JSON.stringify(body)) > 32768) return reply(413, {success: false});
    const values = {};
    const fieldErrors = {};
    const limits = {name: [1, 120], email: [1, 254], phone: [0, 30], company: [0, 160], service: [1, 160], message: [10, 5000]};
    for (const [field, [min, max]] of Object.entries(limits)) {
      const value = body[field] ?? '';
      values[field] = typeof value === 'string' ? value.trim() : '';
      if (typeof value !== 'string' || values[field].length < min || values[field].length > max) fieldErrors[field] = 'Invalid value';
    }
    if (!emailPattern.test(values.email)) fieldErrors.email = 'Invalid email';
    if (values.phone && !/^[+0-9() .-]{7,30}$/.test(values.phone)) fieldErrors.phone = 'Invalid phone';
    if (!services.has(values.service)) fieldErrors.service = 'Invalid service';
    if (Object.keys(fieldErrors).length) return reply(400, {success: false, fieldErrors});

    const port = Number(env.SMTP_PORT || 465);
    const sender = env.ENQUIRY_EMAIL_FROM || env.SMTP_USERNAME || '';
    if (!env.SMTP_HOST || !env.SMTP_USERNAME || !env.SMTP_PASSWORD || ![465, 587].includes(port) || !emailPattern.test(sender)) {
      log('Contact email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD and a valid sender in Vercel.');
      return reply(503, {success: false});
    }
    let transport;
    try {
      transport = createTransport({
        host: env.SMTP_HOST,
        port,
        secure: port === 465,
        requireTLS: true,
        auth: {user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD},
        connectionTimeout: 4000,
        greetingTimeout: 3000,
        socketTimeout: 8000,
        disableFileAccess: true,
        disableUrlAccess: true
      });
      const result = await transport.sendMail({
        from: {name: 'Clarigence website', address: sender},
        to: recipient,
        replyTo: {address: values.email},
        subject: 'New Clarigence website enquiry',
        text: [
          `Name: ${values.name}`, `Email: ${values.email}`, `Phone: ${values.phone}`,
          `Company: ${values.company}`, `Service: ${values.service}`, '', values.message
        ].join('\n')
      });
      if (!result.accepted?.some(address => String(address).toLowerCase() === recipient)) {
        throw new Error('Recipient not accepted');
      }
      return reply(200, {success: true});
    } catch (error) {
      // Never expose SMTP responses, passwords or enquiry details to logs or visitors.
      const code = ['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EENVELOPE'].includes(error.code) ? error.code : 'SMTP_ERROR';
      log(`Contact email delivery failed: ${code}`);
      return reply(502, {success: false});
    } finally {
      transport?.close();
    }
  };
}

module.exports = {createContactHandler};
