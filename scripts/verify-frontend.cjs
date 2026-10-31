/* Public-site regression checks. All submissions are intercepted; no emails are sent. */
const {chromium}=require('../.qa-tools/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'artifacts/qa');
fs.mkdirSync(output,{recursive:true});
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:8000';
const routes=['/','/about','/services','/solutions','/portfolio','/contact'];
const widths=[320,360,375,390,412,430,768,900,1024,1440,1920];
const content=JSON.parse(fs.readFileSync(path.join(root,'content.json'),'utf8'));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  let layouts=0;
  const titles=new Set(),links=new Set();
  async function layout(label){
   const state=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,unlabeled:[...document.querySelectorAll('input,select,textarea')].filter(n=>!n.labels.length).length,overflow:[...document.querySelectorAll('main h1,main h2,main h3,.hero-actions,.contact-form,.service-detail,.service-card')].filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>n.className)}));
   assert(state.scroll<=state.width,`${label} document overflow: ${JSON.stringify(state)}`);
   assert.equal(state.h1,1,`${label}: one h1`);assert.equal(state.unlabeled,0,`${label}: field labels`);assert.deepEqual(state.overflow,[],`${label}: content bounds`);
   const cards=await page.locator('.service-card').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {width:r.width,top:r.top,title:n.querySelector('h3')?.textContent};}));
   if(cards.length){
    const primaryWidth=Math.min(...cards.slice(0,4).map(c=>c.width));
    // At small desktop widths, primary services use halves and supporting services use thirds.
    const minimumRatio=state.width>900&&state.width<=1100?.6:.9;
    for(const card of cards)assert(card.width>=primaryWidth*minimumRatio,`${label}: squeezed service card ${JSON.stringify(card)}`);
    if(state.width>900&&cards.length===10){const row=cards.slice(-3);assert(row.every(c=>Math.abs(c.top-row[0].top)<1&&Math.abs(c.width-row[0].width)<1),`${label}: final service row must align ${JSON.stringify(row)}`);}
   }
   layouts++;
  }
  for(const route of routes){
   for(const width of widths){
    await page.setViewportSize({width,height:900});await page.goto(origin+route);await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
    await layout(`${route} ${width}`);
    assert.equal(await page.locator('[data-nav-services] a').count(),10);
    if(route==='/'||route==='/services')assert.equal(await page.locator('.service-card').count(),10);
    if(width<=900){
     await page.locator('.menu-toggle').click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');
     await page.locator('.services-toggle').click();assert.equal(await page.locator('.services-toggle').getAttribute('aria-expanded'),'true');
     await layout(`${route} ${width} menu`);
     await page.keyboard.press('Escape');assert.equal(await page.locator('.services-toggle').getAttribute('aria-expanded'),'false');
     await page.keyboard.press('Escape');assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
    }
    if(width===1440||width===390){
     // Lazy-loaded assets and entrance effects must be observed throughout the page.
     await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,15));}scrollTo(0,0);});
     await page.waitForLoadState('networkidle');
     await page.screenshot({path:path.join(output,`${route==='/'?'home':route.slice(1)}-${width}.png`),fullPage:true});
     if(route==='/')await page.screenshot({path:path.join(output,`hero-${width}.png`)});
     assert.deepEqual(await page.locator('img').evaluateAll(nodes=>nodes.filter(n=>n.complete&&!n.naturalWidth).map(n=>n.src)),[],'No missing images');
    }
   }
   const title=await page.title();assert(!titles.has(title),'Unique SEO title');titles.add(title);
   for(const href of await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.href)))if(href.startsWith(origin))links.add(href);
  }
  for(const href of links){const response=await context.request.get(href);assert(response.ok(),`Broken link ${href}`);}
  for(const service of content.services){
   for(const width of [320,768,1440]){
    await page.setViewportSize({width,height:900});await page.goto(`${origin}/services?service=${service.slug}`);await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('h1').innerText(),service.name);assert.equal(await page.locator('.service-detail').count(),1);await layout(`${service.slug} ${width}`);
    assert((await page.locator('.service-detail .button').getAttribute('href')).includes(service.slug));
   }
  }
  await page.goto(`${origin}/services#salesforce-development`);await page.waitForLoadState('networkidle');assert.equal(await page.locator('h1').innerText(),'Salesforce Development');
  await page.goto(`${origin}/contact?service=salesforce-development`);await page.waitForLoadState('networkidle');assert.equal(await page.locator('[name=service]').inputValue(),'Salesforce Development');
  await page.goto(origin+'/');await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.process-grid article').count(),6);
  await page.locator('.project-copy summary').first().click();assert(await page.locator('.project-copy details').first().getAttribute('open')!==null);
  assert.equal(await page.locator('.concept-badge').count(),content.portfolio.filter(p=>p.featured).slice(0,2).filter(p=>p.concept).length);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(origin+'/');await page.waitForLoadState('networkidle');
  assert((await page.locator('.hero-visual').evaluate(n=>getComputedStyle(n).animationName)).includes('artwork-arrive'));
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.hero-visual').evaluate(n=>getComputedStyle(n).animationName),'none');assert.equal(await page.locator('.reveal-pending').count(),0);
  // CMS content must remain plain text; published work must not inherit a demo badge.
  const fixture=structuredClone(content);fixture.services[0].name='<img src=x onerror=alert(1)>';fixture.portfolio=[{...fixture.portfolio[0],concept:false,title:'Published example',imageUrl:'assets/images/clarigence-logo.png'}];
  await page.route('**/content.json',r=>r.fulfill({json:fixture}));await page.goto(origin+'/portfolio');await page.waitForLoadState('networkidle');assert.equal(await page.locator('.concept-badge').count(),0);assert.equal(await page.locator('.project-symbol').count(),1);assert((await page.locator('.service-menu-link').first().textContent()).includes('<img src=x onerror=alert(1)>'));assert.equal(await page.locator('.service-menu-link img').count(),0);
  await page.unroute('**/content.json');
  assert.deepEqual(errors,[],'No runtime, console, network or missing asset errors');
  const report={layouts,routes:routes.length,serviceDetails:content.services.length,widths,internalLinks:links.size,assets:'passed',serviceCardAlignment:'minimum widths and complete final row passed',navigation:'mobile and desktop passed',serviceSelection:'query and legacy anchor passed',portfolio:'concept and published content passed',cms:'text escaping and current content schema passed',motion:'initial and dynamic reduced motion passed',errors};
  fs.writeFileSync(path.join(output,'redesign-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
