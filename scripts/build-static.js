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
  'styles.css',
  'visuals.css',
  'script.js',
  'cms.js',
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

console.log(`Prepared static Vercel output in ${path.relative(root, output)}; email enquiries use FormSubmit.`);
