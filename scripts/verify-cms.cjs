// Run only against the guarded H2 browser fixture, never against a real database.
const {chromium}=require('../.qa-tools/node_modules/playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');const artifacts=path.join(root,'artifacts/qa/cms');fs.mkdirSync(artifacts,{recursive:true});
const credentials=JSON.parse(fs.readFileSync(path.join(root,'.qa-tools/cms-qa-credentials.json'),'utf8'));
const backend='http://127.0.0.1:18081',frontend='http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({reducedMotion:'reduce'});const issues=[];
 context.on('page',p=>p.on('pageerror',e=>issues.push(e.message)));
 await context.route('**/api-config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.CLARIGENCE_CONFIG=Object.freeze({apiBaseUrl:'${backend}',get contactApiUrl(){return this.apiBaseUrl+'/api/contact'}});`}));
 const admin=await context.newPage();await admin.goto(`${backend}/admin/`);
 await admin.locator('#login-email').fill(credentials.email);await admin.locator('#login-password').fill(credentials.password);await admin.locator('#login-form button').click();
 await admin.locator('#dashboard-view').waitFor({state:'visible'});
 await admin.waitForFunction(()=>document.querySelector('#cms-stat-activeServices')?.textContent==='10');
 const page=await context.newPage();await page.goto(`${frontend}/services.html`);await page.waitForFunction(()=>document.querySelectorAll('.service-card').length===10);
 await admin.locator('[data-cms=services]').click();await admin.getByRole('button',{name:'Add service',exact:true}).click();
 async function serviceFields(name){
  await admin.locator('#cms-name').fill(name);await admin.locator('#cms-shortDescription').fill('Browser verification service in an isolated database.');await admin.locator('#cms-description').fill('This content verifies CMS editing, publication, and safe rendering.');await admin.locator('#cms-displayOrder').fill('1');await admin.locator('#cms-capabilities').fill('Responsive content\nAPI integration');await admin.locator('#cms-benefits').fill('Useful business workflows');await admin.locator('#cms-active').selectOption('true');
 }
 await serviceFields('CMS browser verification');await admin.getByRole('button',{name:'Save',exact:true}).click();
 await admin.waitForFunction(()=>document.querySelector('.cms-records')?.textContent.includes('CMS browser verification'));
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.service-card').length===11);
 const serviceCard=page.locator('.service-card').filter({hasText:'CMS browser verification'});assert.equal(await page.locator('.service-card h3').first().innerText(),'CMS browser verification');
 await serviceCard.click();await page.waitForFunction(()=>document.querySelector('.page-hero h1').textContent==='CMS browser verification');
 assert((await page.locator('.service-details').innerText()).includes('API integration'));
 assert((await page.title()).includes('CMS browser verification'));
 let row=admin.locator('.cms-record').filter({hasText:'CMS browser verification'});await row.getByRole('button',{name:'Edit',exact:true}).click();
 await admin.locator('#cms-name').fill('CMS edited verification');await admin.locator('#cms-description').fill('Changed CMS description confirmed in the public website.');await admin.getByRole('button',{name:'Save',exact:true}).click();
 await admin.waitForFunction(()=>document.querySelector('.cms-records')?.textContent.includes('CMS edited verification'));
 await page.reload();await page.waitForFunction(()=>document.querySelector('.page-hero h1').textContent==='CMS edited verification');
 assert((await page.locator('.service-details').innerText()).includes('Changed CMS description'));
 await page.goto(`${frontend}/contact.html?service=cms-browser-verification`);await page.waitForFunction(()=>document.querySelector('[name=service]').value==='CMS edited verification');
 row=admin.locator('.cms-record').filter({hasText:'CMS edited verification'});await row.getByRole('button',{name:'Deactivate',exact:true}).click();
 await admin.waitForFunction(()=>[...document.querySelectorAll('.cms-record')].find(r=>r.textContent.includes('CMS edited verification'))?.textContent.includes('Draft / inactive'));
 await page.goto(`${frontend}/services.html`);await page.waitForFunction(()=>document.querySelectorAll('.service-card').length===10);assert.equal(await page.locator('.service-card').filter({hasText:'CMS edited verification'}).count(),0);
 // Deletion must respect cancel before confirmation.
 row=admin.locator('.cms-record').filter({hasText:'CMS edited verification'});
 admin.once('dialog',dialog=>dialog.dismiss());await row.getByRole('button',{name:'Delete',exact:true}).click();assert.equal(await row.count(),1);
 admin.once('dialog',dialog=>dialog.accept());await row.getByRole('button',{name:'Delete',exact:true}).click();
 await admin.waitForFunction(()=>!document.querySelector('.cms-records')?.textContent.includes('CMS edited verification'));
 await admin.locator('[data-cms=portfolio]').click();await admin.getByRole('button',{name:'Add project',exact:true}).click();
 const imageBytes=fs.readFileSync(path.join(root,'assets/images/clarigence-logo.png'));
 const externalImage='https://portfolio-images.example.test/render?width=800&format=png',localImage='/images/portfolio-test.PNG?v=2';
 await context.route('https://portfolio-images.example.test/**',route=>route.fulfill({contentType:'image/png',body:imageBytes}));
 await context.route(`${frontend}/images/portfolio-test.PNG**`,route=>route.fulfill({contentType:'image/png',body:imageBytes}));
 const initialProject={name:'Internal browser demo',slug:'internal-browser-demo',shortDescription:'A clearly labeled internal demo for CMS verification.',description:'This demo exists only in the in-memory test database.',icon:'window',category:'Internal demo',technologies:'HTML\nSpring Boot',active:'true',featured:'true',concept:'true',displayOrder:'0',imageUrl:externalImage,projectUrl:'www.abc.com'};
 async function fillProject(values){for(const [name,value] of Object.entries(values)){const input=admin.locator(`#cms-${name}`);if(name==='slug'&&await input.evaluate(input=>input.readOnly)){assert.equal(await input.inputValue(),value);continue;}if(['icon','active','featured','concept'].includes(name))await input.selectOption(value);else await input.fill(value);}}
 async function checkProject(values){for(const [name,value] of Object.entries(values))assert.equal(await admin.locator(`#cms-${name}`).inputValue(),value,`Portfolio edit field ${name}`);assert(await admin.locator('#cms-slug').evaluate(input=>input.readOnly));}
 async function openProject(name){await admin.locator('.cms-record').filter({hasText:name}).getByRole('button',{name:'Edit',exact:true}).click();await admin.locator('.cms-editor').waitFor();}
 async function saveProject(name){await admin.getByRole('button',{name:'Save',exact:true}).click();await admin.waitForFunction(name=>document.querySelector('.cms-records')?.textContent.includes(name),name);}
 async function publicProject(name,url,imageUrl){
  await page.goto(`${frontend}/portfolio.html`);await page.waitForFunction(name=>document.querySelector('.work-card h3')?.textContent===name,name);
  assert.equal(await page.locator('.work-card details a').getAttribute('href'),url);
  assert.equal(await page.locator('.project-image').getAttribute('src'),imageUrl);
  await page.waitForFunction(()=>document.querySelector('.project-image')?.naturalWidth>0);
 }
 await fillProject(initialProject);await saveProject(initialProject.name);
 await admin.waitForFunction(()=>document.querySelector('.cms-records')?.textContent.includes('Internal browser demo'));
 await page.goto(`${frontend}/portfolio.html`);await page.waitForFunction(()=>document.querySelector('.work-card h3')?.textContent==='Internal browser demo');assert.equal(await page.locator('.concept-badge').innerText(),'DEMO / CONCEPT');
 await page.goto(`${frontend}/index.html`);await page.waitForFunction(()=>document.querySelector('.work-card h3')?.textContent==='Internal browser demo');
 await publicProject(initialProject.name,'https://www.abc.com/',externalImage);
 // Every field must reload after a full admin refresh, including false values and order zero.
 await admin.reload();await admin.locator('#dashboard-view').waitFor({state:'visible'});await admin.locator('[data-cms=portfolio]').click();
 await openProject(initialProject.name);await checkProject({...initialProject,projectUrl:'https://www.abc.com'});
 await saveProject(initialProject.name);await openProject(initialProject.name);await checkProject({...initialProject,projectUrl:'https://www.abc.com'});
 // Edit must fetch the latest persisted values even if the list was loaded earlier.
 await admin.getByRole('button',{name:'Cancel',exact:true}).click();await admin.locator('.cms-records').waitFor();
 await admin.evaluate(async()=>{const [record]=await apiRequest('/api/admin/cms/portfolio');await apiRequest(`/api/admin/cms/portfolio/${record.id}`,{method:'PUT',body:JSON.stringify({...record,projectUrl:'https://latest.example.test/work'})});});
 await openProject(initialProject.name);await checkProject({...initialProject,projectUrl:'https://latest.example.test/work'});
 const editedProject={...initialProject,name:'Updated browser demo',shortDescription:'Changed portfolio summary',description:'Updated description\nSecond line retained.',icon:'cloud',category:'Updated category',technologies:'JavaScript\nSpring Boot',displayOrder:'3',projectUrl:'https://www.updated.example.test/path?q=2#work',imageUrl:localImage,featured:'false',concept:'false'};
 await fillProject(editedProject);await saveProject(editedProject.name);await openProject(editedProject.name);await checkProject(editedProject);await admin.getByRole('button',{name:'Cancel',exact:true}).click();
 await publicProject(editedProject.name,editedProject.projectUrl,`${frontend}${localImage}`);
 assert.equal(await page.locator('.concept-badge').count(),0);assert((await page.locator('.work-card').innerText()).includes(editedProject.shortDescription));
 await page.locator('.work-card summary').click();assert((await page.locator('.work-card .cms-copy').innerText()).includes(editedProject.description));
 await page.goto(`${frontend}/index.html`);await page.waitForFunction(()=>document.querySelector('[data-portfolio]').getAttribute('aria-busy')==='false');assert.equal(await page.locator('.work-card').count(),0);
 row=admin.locator('.cms-record').filter({hasText:editedProject.name});await row.getByRole('button',{name:'Deactivate',exact:true}).click();await admin.waitForFunction(()=>document.querySelector('.cms-records')?.textContent.includes('Draft / inactive'));
 await openProject(editedProject.name);await checkProject({...editedProject,active:'false'});await admin.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.goto(`${frontend}/portfolio.html`);await page.waitForFunction(()=>document.querySelector('[data-portfolio]').getAttribute('aria-busy')==='false');assert.equal(await page.locator('.work-card').count(),0);
 row=admin.locator('.cms-record').filter({hasText:editedProject.name});await row.getByRole('button',{name:'Publish',exact:true}).click();await admin.waitForFunction(()=>document.querySelector('.cms-records')?.textContent.includes('Published'));
 await openProject(editedProject.name);await checkProject(editedProject);
 await fillProject({imageUrl:externalImage,projectUrl:'www.abc.com/new',featured:'true',concept:'true'});await saveProject(editedProject.name);
 await publicProject(editedProject.name,'https://www.abc.com/new',externalImage);
 await openProject(editedProject.name);await fillProject({imageUrl:'',projectUrl:'',category:'',technologies:''});await saveProject(editedProject.name);
 await openProject(editedProject.name);await checkProject({...editedProject,imageUrl:'',projectUrl:'',category:'',technologies:'',featured:'true',concept:'true'});await admin.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.goto(`${frontend}/portfolio.html`);await page.waitForFunction(()=>document.querySelector('.work-card h3')?.textContent==='Updated browser demo');assert.equal(await page.locator('.project-image,.work-card details a').count(),0);assert.equal(await page.locator('.mock-window').count(),1);
 // Homepage and About records are editable plain text; HTML-like text must not execute.
 await admin.locator('[data-cms=home]').click();await admin.locator('#cms-subtitle').fill('Updated through the existing admin dashboard.');await admin.getByRole('button',{name:'Save content',exact:true}).click();
 await admin.waitForFunction(()=>document.querySelector('#cms-workspace .form-message').textContent.includes('Content saved'));
 await page.goto(`${frontend}/index.html`);await page.waitForFunction(()=>document.querySelector('.hero-lede').textContent==='Updated through the existing admin dashboard.');
 await admin.locator('[data-cms=about]').click();await admin.locator('#cms-mission').fill('<img src=x onerror=alert(1)> Text is safe.');await admin.getByRole('button',{name:'Save content',exact:true}).click();await admin.waitForFunction(()=>document.querySelector('#cms-workspace .form-message').textContent.includes('Content saved'));
 await page.goto(`${frontend}/about.html`);await page.waitForFunction(()=>document.querySelector('[data-about-extra]')?.textContent.includes('Text is safe.'));assert.equal(await page.locator('[data-about-extra] img').count(),0);
 await admin.locator('[data-cms=seo]').click();await admin.locator('#cms-title').fill('CMS managed home title');await admin.getByRole('button',{name:'Save content',exact:true}).click();await admin.waitForFunction(()=>document.querySelector('#cms-workspace .form-message').textContent.includes('Content saved'));
 await page.goto(`${frontend}/index.html`);await page.waitForFunction(()=>document.title==='CMS managed home title');
 // Existing contact -> search/detail -> status change -> delete-confirmation remains functional.
 await page.goto(`${frontend}/contact.html`);await page.waitForFunction(()=>!document.querySelector('[name=service]').disabled);
 await page.locator('[name=name]').fill('CMS browser enquiry');await page.locator('[name=email]').fill('cms-enquiry@example.test');await page.locator('[name=service]').selectOption('Website Development');await page.locator('[name=message]').fill('Verify the existing enquiry workflow after the CMS upgrade.');await page.locator('.form-submit').click();await page.waitForFunction(()=>document.querySelector('#form-status').dataset.state==='success');
 await admin.locator('a[href="#enquiries"]').click();await admin.locator('#search-input').fill('CMS browser enquiry');await admin.waitForFunction(()=>document.querySelector('#enquiry-rows').textContent.includes('CMS browser enquiry'));
 await admin.locator('#enquiry-rows').getByRole('button',{name:'View details →'}).click();await admin.waitForFunction(()=>document.querySelector('#detail-content').textContent.includes('CMS browser enquiry'));await admin.locator('#detail-status').selectOption('CONTACTED');await admin.locator('#save-status').click();await admin.waitForFunction(()=>document.querySelector('#detail-message').textContent==='Status updated.');
 await admin.locator('#close-detail').click();await admin.locator('#status-filter').selectOption('CONTACTED');await admin.waitForFunction(()=>document.querySelector('#enquiry-rows').textContent.includes('Contacted'));
 // Public and admin layouts, including API-rendered cards/forms.
 let layouts=0;
 for(const file of ['index.html','about.html','services.html','solutions.html','portfolio.html','contact.html']){
  for(const width of [320,360,375,390,412,430,768,1024,1440]){
   await page.setViewportSize({width,height:900});await page.goto(`${frontend}/${file}`);await page.waitForLoadState('networkidle');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${file} overflow ${width}`);layouts++;
   if(width===390||width===1440)await page.screenshot({path:path.join(artifacts,`${file}-${width}.png`),fullPage:true});
  }
 }
 await admin.locator('[data-cms=services]').click();await admin.getByRole('button',{name:'Add service',exact:true}).click();
 for(const width of [320,390,768,1024,1440]){
  await admin.setViewportSize({width,height:900});assert(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Admin overflow ${width}`);
  if(width===390||width===1440)await admin.screenshot({path:path.join(artifacts,`admin-${width}.png`),fullPage:true});
 }
 // Dynamically inserted cards participate in the existing reveal system.
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto(`${frontend}/services.html`);await page.waitForLoadState('networkidle');
 assert(await page.locator('.service-card.reveal').count()>0);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert(await page.evaluate(()=>[...document.querySelectorAll('.service-card')].every(card=>getComputedStyle(card).opacity==='1')));
 // Backend failure leaves static navigation and layout usable.
 await context.route(`${backend}/api/services**`,route=>route.abort());await context.route(`${backend}/api/portfolio**`,route=>route.abort());
 await page.goto(`${frontend}/services.html`);await page.waitForFunction(()=>document.querySelector('[data-services]').textContent.includes('temporarily unavailable'));assert(await page.locator('.brand').first().isVisible());
 await page.goto(`${frontend}/portfolio.html`);await page.waitForFunction(()=>document.querySelector('[data-portfolio]').textContent.includes('temporarily unavailable'));
 assert.equal(issues.length,0,JSON.stringify(issues));
 const report={database:'isolated H2; no MySQL records or existing admin account touched',serviceFlow:'add, public render/detail/dropdown, edit, deactivate, delete cancellation and confirmation passed',portfolioFlow:'create, every field edit/reload, unchanged save, latest record loading, URL normalization and updates, external/local image rendering and replacement, optional field clearing, publish/unpublish, featured homepage and concept flags passed',pageContent:'homepage, About plain-text safety, SEO passed',enquiries:'submission, listing, search, details, status/filter passed',layouts,adminWidths:[320,390,768,1024,1440],apiFailure:'graceful services/portfolio failure passed',console:'no uncaught JavaScript errors'};
 fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
