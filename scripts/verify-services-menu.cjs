const {chromium}=require('../.qa-tools/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'backend/src/main/resources/cms-seed.json'),'utf8')).services;

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext();
  await context.route('https://menu.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/')){
    if(url.pathname==='/api/services')return route.fulfill({json:fixtures});
    return route.fulfill({status:404,json:{}});
   }
   if(url.pathname==='/api-config.js')return route.fulfill({contentType:'application/javascript',body:'window.CLARIGENCE_CONFIG={contentUrl:"https://menu.test/content.json",apiBaseUrl:"https://menu.test",contactApiUrl:"https://menu.test/api/contact"};'});
   let file=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!path.extname(file))file+='.html';
   const target=path.join(root,file);
   if(!fs.existsSync(target))return route.fulfill({status:404,body:''});
   const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.ico':'image/x-icon'};
   return route.fulfill({body:fs.readFileSync(target),contentType:mime[path.extname(target)]||'application/octet-stream'});
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,768,900,1024,1440]){
   await page.setViewportSize({width,height:900});
   await page.goto('https://menu.test/',{waitUntil:'networkidle'});
   const toggle=page.locator('.services-toggle');
   assert.equal(await page.locator('[data-nav-services] a').count(),fixtures.length);
   if(width<=900)await page.locator('.menu-toggle').click();
   if(width>900)await toggle.hover();else await toggle.click();
   await page.waitForFunction(()=>document.querySelector('.services-toggle').getAttribute('aria-expanded')==='true');
   await page.waitForTimeout(350);
   const layout=await page.locator('.services-dropdown').evaluate(n=>({inert:n.inert,opacity:getComputedStyle(n).opacity,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert(!layout.inert&&layout.opacity==='1'&&layout.left>=0&&layout.right<=width&&!layout.overflow,JSON.stringify(layout));
   if(width===390||width===1440){
    const output=path.join(root,'artifacts/qa');fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,`services-dropdown-${width}.png`)});
   }
   await toggle.focus();await page.keyboard.press('Escape');
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   assert(await page.locator('.services-dropdown').evaluate(n=>n.inert));
   await page.keyboard.press('ArrowDown');
   assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   assert(await page.locator('.services-dropdown a').first().evaluate(n=>n===document.activeElement));
   await page.locator('[data-nav-services] a').first().click();
   await page.waitForURL('**/services?service=*');
   console.log(`${width}px: CMS links, open/close, keyboard, bounds and service navigation passed.`);
  }
  // A touch-capable desktop-sized tablet must open with a tap, without hover.
  const touch=await browser.newContext({hasTouch:true,viewport:{width:1024,height:900}});
  const tapPage=await touch.newPage();
  await tapPage.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{}});
   let file=url.pathname==='/'?'index.html':url.pathname.slice(1);
   const target=path.join(root,file);
   return fs.existsSync(target)?route.fulfill({path:target}):route.abort();
  });
  await tapPage.goto('https://menu.test/');
  await tapPage.locator('.services-toggle').tap();
  assert.equal(await tapPage.locator('.services-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(await tapPage.locator('[data-nav-services] a').count(),10);
  await tapPage.locator('.services-toggle').tap();
  assert.equal(await tapPage.locator('.services-toggle').getAttribute('aria-expanded'),'false');
  await tapPage.locator('.services-toggle').tap();
  await tapPage.touchscreen.tap(10,700);
  assert.equal(await tapPage.locator('.services-toggle').getAttribute('aria-expanded'),'false');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.services-dropdown').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
  for(const file of ['about','services','solutions','portfolio','contact']){
   await page.goto(`https://menu.test/${file}`,{waitUntil:'networkidle'});
   assert.equal(await page.locator('.services-toggle').count(),1);
   assert.equal(await page.locator('[data-nav-services] a').count(),fixtures.length);
  }
  assert.deepEqual(errors,[]);
  console.log('Touch tap toggling and fallback service links passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
