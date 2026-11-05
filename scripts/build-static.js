const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
require('./enhance-visuals.js');
const output = path.join(root, 'dist');
const publicFiles = [
  'index.html',
  'about.html',
  'services.html',
  'solutions.html',
  'portfolio.html',
  'contact.html',
  'privacy.html',
  'styles.css',
  'visuals.css',
  'experience.css',
  'script.js',
  'cms.js',
  'experience.js',
  'content.json',
  'api-config.js',
  'sitemap.xml',
  'robots.txt',
  'favicon.ico',
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of publicFiles) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) {
    throw new Error(`Required public file is missing: ${file}`);
  }
  fs.copyFileSync(source, path.join(output, file));
}

const assetsSource = path.join(root, 'assets');
if (!fs.existsSync(assetsSource)) {
  throw new Error('Required public assets folder is missing: assets');
}
fs.cpSync(assetsSource, path.join(output, 'assets'), { recursive: true });

// Only production builds (deploy/deploy.sh) carry the Google tag, so previews and test runs never reach Google Analytics.
const googleTagId = process.env.GOOGLE_TAG_ID;
if (googleTagId) {
  const tag = `<script async src="https://www.googletagmanager.com/gtm.js?id=${googleTagId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
</script>`;
  for (const file of publicFiles.filter(name => name.endsWith('.html'))) {
    const target = path.join(output, file);
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('<head>', `<head>\n${tag}`));
  }
}

console.log(`Prepared static Vercel output in ${path.relative(root, output)}; email enquiries use /api/contact (SMTP configuration required).`);
