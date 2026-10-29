/* Idempotent visual enhancement of the existing pages; routes and copy are retained. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const version=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,10);
const graphic='<div class="growth-illustration"><img src="assets/graphics/business-growth.svg" width="640" height="420" alt="Illustration of a website, customer workspace and connected business tools" loading="lazy" decoding="async"></div>';
function replaceDiv(html,start,replacement){
 const offset=html.indexOf(start);if(offset<0)return html;
 const tags=/<\/?div\b[^>]*>/g;tags.lastIndex=offset;let depth=0,match;
 while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0)return html.slice(0,offset)+replacement+html.slice(tags.lastIndex);}
 return html;
}
for(const file of ['index.html','about.html','services.html','solutions.html','portfolio.html','contact.html']){
 const target=path.join(root,file);let html=fs.readFileSync(target,'utf8');
 html=html.replace('<body>',`<body class="visual-refresh" data-page="${file.replace('.html','')}">`);
 html=html.replaceAll('src="assets/images/clarigence-logo.png"','src="assets/images/clarigence-wordmark.png"').replaceAll('width="2382" height="519"','width="400" height="87"');
 if(!html.includes('href="visuals.css'))html=html.replace(/(<link rel="stylesheet" href="styles\.css(?:\?[^"]*)?">)/,'$1<link rel="stylesheet" href="visuals.css">');
 for(const asset of ['styles.css','visuals.css','script.js','cms.js']){
  const escaped=asset.replaceAll('.','\\.');html=html.replace(new RegExp(`((?:href|src)=")${escaped}(?:\\?[^\"]*)?"`,'g'),`$1${asset}?v=${version(asset)}"`);
 }
 if(file==='about.html')html=replaceDiv(html,'<div class="about-artwork"',graphic);
 if((file==='index.html'||file==='about.html')&&!html.includes('class="growth-illustration"'))html=html.replace(/(<section class="section wrap about-preview"><div>[\s\S]*?<\/h2>)/,'$1'+graphic);
 html=html.replace(/<(h[12])>([^<]+)<br>([^<]+)<\/\1>/g,(_,tag,first,last)=>`<${tag}>${first}<br><span class="heading-accent">${last}</span></${tag}>`);
 fs.writeFileSync(target,html);
}
console.log('Applied Clarigence graphics and versioned visual assets to all six existing pages.');
