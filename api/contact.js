// Vercel Function: SMTP credentials stay on the server.
module.exports = require('../lib/contact-handler').createContactHandler();
module.exports.config = {
  api: {
    bodyParser: false
  }
};
