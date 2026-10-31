const nodemailer = require('nodemailer');
const services = new Set(require('../content.json').services.filter(s => s.active).map(s => s.name));
const mailbox = 'hello@clarigence.in';

module.exports = async function contact(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({success: false});
  }
  if (!['https://www.clarigence.in', 'https://clarigence.in'].includes(req.headers.origin)) {
    return res.status(403).json({success: false});
  }
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); }
  catch { return res.status(400).json({success: false}); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({success: false});
  const values = Object.fromEntries(['name', 'email', 'phone', 'company', 'service', 'message']
    .map(key => [key, typeof body[key] === 'string' ? body[key].trim() : '']));
  const fieldErrors = {};
  if (!values.name || values.name.length > 120) fieldErrors.name = true;
  if (values.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(values.email)) fieldErrors.email = true;
  if (values.phone && !/^[+0-9() .-]{7,30}$/.test(values.phone)) fieldErrors.phone = true;
  if (values.company.length > 160) fieldErrors.company = true;
  if (!services.has(values.service)) fieldErrors.service = true;
  if (values.message.length < 10 || values.message.length > 5000) fieldErrors.message = true;
  if (Object.keys(fieldErrors).length) return res.status(400).json({success: false, fieldErrors});
  if (!process.env.TITAN_SMTP_PASSWORD) return res.status(503).json({success: false});
  const transport = nodemailer.createTransport({
    host: process.env.TITAN_SMTP_HOST || 'smtp.titan.email',
    port: 465,
    secure: true,
    auth: {user: mailbox, pass: process.env.TITAN_SMTP_PASSWORD},
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true
  });
  try {
    const result = await transport.sendMail({
      from: {name: 'Clarigence website', address: mailbox},
      to: mailbox,
      replyTo: values.email,
      subject: 'New Clarigence website enquiry',
      text: Object.entries(values).map(([key, value]) => `${key}: ${value}`).join('\n\n')
    });
    if (!result.accepted?.includes(mailbox)) throw new Error('Recipient not accepted');
    return res.status(200).json({success: true});
  } catch {
    // Never log mailbox credentials or visitor details.
    console.error('Titan enquiry delivery failed');
    return res.status(502).json({success: false});
  } finally {
    transport.close();
  }
};
