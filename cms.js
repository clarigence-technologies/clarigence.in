/* Business content is rendered as text; CMS input never becomes executable HTML. */
(() => {
  const requests = new Map();
  // CMS hydration shares the initial headline timeline rather than replaying it.
  const headlineStart = document.querySelector('.title-letter')?.getAnimations()[0]?.startTime ?? performance.now();
  const api = async path => {
    if (!requests.has('content')) requests.set('content', (async () => {
      const response = await fetch(window.CLARIGENCE_CONFIG.contentUrl, {
        headers: {Accept: 'application/json'}, credentials: 'omit', signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error('Content unavailable');
      return response.json();
    })());
    const content = await requests.get('content');
    const services = content.services.filter(item => item.active).sort((a, b) => a.displayOrder - b.displayOrder);
    if (path === '/api/services') return services;
    if (path.startsWith('/api/services/')) {
      const service = services.find(item => item.slug === decodeURIComponent(path.slice('/api/services/'.length)));
      if (!service) throw new Error('Service unavailable');
      return service;
    }
    if (path === '/api/portfolio') return content.portfolio;
    if (path.startsWith('/api/content/')) {
      const document = content.documents[path.slice('/api/content/'.length)];
      if (!document) throw new Error('Content unavailable');
      return document;
    }
    throw new Error('Unknown content');
  };
  const node = (tag, classes, text) => {
    const element=document.createElement(tag);
    if(classes)element.className=classes;
    if(text!=null)element.textContent=text;
    return element;
  };
  const safeUrl=(value,image=false,project=false) => {
    if(!value || /[\\<>"\s\u0000-\u001f\u007f]/.test(value))return '';
    if(project && /^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::[0-9]{1,5})?(?:[/?#].*)?$/i.test(value) && !/^[a-z0-9_-]+\.html(?:[?#].*)?$/i.test(value))value=`https://${value}`;
    try {
      const absolute=/^[a-z][a-z0-9+.-]*:/i.test(value);
      if(value.startsWith('//'))return '';
      const url=new URL(value,image?`${location.origin}/`:location.href);
      if(url.username || url.password)return '';
      if(!['http:','https:'].includes(url.protocol))return '';
      if(url.origin!==location.origin && url.protocol!=='https:' && !image && !project)return '';
      if(image){
        if(url.hash)return '';
        if(absolute){if(!/(?:\.(png|jpe?g|webp|gif|avif)|\/[^/.]*|^)$/i.test(url.pathname))return '';}
        else if(value.includes('..') || value.includes('%') || !/^\/?[a-z0-9_./-]+\.(png|jpe?g|webp|gif|avif)$/i.test(value.split('?')[0]))return '';
      }
      if(!image && url.origin===location.origin){
        const pages={'/index.html':'/','/index':'/','/home':'/','/about.html':'/about','/services.html':'/services','/solutions.html':'/solutions','/portfolio.html':'/portfolio','/contact.html':'/contact'};
        url.pathname=pages[url.pathname]||url.pathname;
      }
      return url.href;
    } catch{return '';}
  };
  const link=(text,href,classes='text-link') => {
    const a=node('a',classes,text);a.href=safeUrl(href)||'/contact';return a;
  };
  const status=(container,message,state='error') => {
    container.replaceChildren(node('p',`content-status content-${state}`,message));
    container.setAttribute('aria-busy','false');
  };
  const icons={window:'M3 8h18M4 3h16v18H3V3Z',cloud:'M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-11-2 5 5 0 0 0-1 10Z',phone:'M8 2h8v20H8ZM10 18h4',trend:'M3 17l6-6 4 4 8-10M15 5h6v6',layout:'M3 3h18v18H3ZM3 9h18M9 9v12',pin:'M12 22s8-8 8-13a8 8 0 0 0-16 0c0 5 8 13 8 13Z',mail:'M3 5h18v14H3ZM3 5l9 7 9-7',shield:'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6ZM8 12l3 3 5-6',form:'M5 2h14v20H5ZM8 7h8M8 11h8M8 15h4',flow:'M3 3h6v6H3ZM15 15h6v6h-6ZM9 6h9v9M6 9v9h9'};
  const icon = name => {
    const wrapper=node('span','icon');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[name]||icons.window);svg.append(path);wrapper.append(svg);return wrapper;
  };
  const image=(url,alt,classes) => {
    if(/^\/api\/portfolio\/images\/[a-f0-9-]+\.(png|jpg|gif)$/.test(url))url=`${window.CLARIGENCE_CONFIG.apiBaseUrl}${url}`;
    const img=node('img',classes);img.src=safeUrl(url,true);img.alt=alt;img.loading='lazy';img.decoding='async';
    img.addEventListener('error',()=>img.remove(),{once:true});return img;
  };
  const reveal=container=>window.ClarigenceMotion?.observe(container);
  const detailHref=slug=>`/services?service=${encodeURIComponent(slug)}`;
  const designGraphic=(name,alt,classes)=>{
    const asset=node('img',classes);asset.src=`assets/graphics/${name}.svg`;asset.alt=alt;asset.width=640;asset.height=420;asset.loading='lazy';asset.decoding='async';return asset;
  };
  async function services(){
    const containers=[...document.querySelectorAll('[data-services]')];
    const select=document.querySelector('[name=service]');
    const footer=document.querySelector('.footer-services');
    const detail=document.querySelector('[data-service-detail]');
    try {
      const items=await api('/api/services');
      if(!Array.isArray(items))throw new Error('Invalid content');
      const navigation=document.querySelector('[data-nav-services]');
      if(navigation){
        navigation.replaceChildren();
        items.forEach(service=>{
          const entry=link('',detailHref(service.slug),'service-menu-link');
          const symbol=icon(service.icon);symbol.className='service-menu-icon';
          const arrow=node('span','service-menu-arrow','↗');arrow.setAttribute('aria-hidden','true');
          entry.append(symbol,node('span','',service.name),arrow);navigation.append(entry);
        });
        if(!items.length)navigation.append(node('p','services-menu-empty','New services are coming soon. Contact us to discuss your project.'));
      }
      containers.forEach(container=>{
        container.replaceChildren();container.setAttribute('aria-busy','false');
        if(!items.length){status(container,'Services will be available soon. Contact us to discuss your requirements.','empty');return;}
        items.forEach((service,index)=>{
          const card=link('',detailHref(service.slug),'service-card');
          const top=node('div','card-top');top.append(icon(service.icon),node('span','card-number',String(index+1).padStart(2,'0')));
          card.append(top,node('h3','',service.name),node('p','',service.shortDescription));
          if(service.capabilities?.length){const list=node('ul','service-features');service.capabilities.slice(0,3).forEach(capability=>list.append(node('li','',capability)));card.append(list);}
          const action=node('span','card-link','Explore service ');const arrow=node('span','','↗');arrow.setAttribute('aria-hidden','true');action.append(arrow);card.append(action);container.append(card);
        });reveal(container);
      });
      if(footer){
        footer.querySelectorAll('a').forEach(a=>a.remove());
        items.forEach(service=>footer.append(link(service.name,detailHref(service.slug),'')));
      }
      if(select){
        const selected=select.value;select.replaceChildren(new Option('Choose a service',''));
        items.forEach(service=>select.append(new Option(service.name,service.name)));
        const requested=new URLSearchParams(location.search).get('service');
        const matched=items.find(service=>service.slug===requested);
        if(matched)select.value=matched.name;else select.value=selected;
        select.disabled=!items.length;
        select.closest('.field').querySelector('.field-error').textContent=items.length?'':'No published services yet. Please contact us by email.';
      }
      if(detail){
        const slug=new URLSearchParams(location.search).get('service')||decodeURIComponent(location.hash.slice(1));
        if(slug){
          detail.hidden=false;
          document.querySelector('.services-section').hidden=true;
          status(detail,'Loading service details…','loading');
          try{renderService(detail,await api(`/api/services/${encodeURIComponent(slug)}`));}
          catch{status(detail,'This service is unavailable. Explore our services or contact us to discuss your project.');detail.append(link('Explore all services','services.html'));}
        }
      }
    } catch {
      containers.forEach(container=>status(container,'Services are temporarily unavailable. Please contact us to discuss your project.'));
      if(select){select.replaceChildren(new Option('Services temporarily unavailable',''));select.disabled=true;select.closest('.field').querySelector('.field-error').textContent='Please try again later or contact us by email.';}
      if(footer){footer.querySelectorAll('a').forEach(a=>a.remove());footer.append(link('Discuss your requirements','contact.html',''));}
      if(detail && (location.search||location.hash)){detail.hidden=false;status(detail,'Service details are temporarily unavailable. Please contact us.');}
    }
  }
  function renderService(container,s){
    container.replaceChildren();container.setAttribute('aria-busy','false');
    const title=document.querySelector('.page-hero h1');title.textContent=s.name;
    document.querySelector('.page-hero .hero-lede').textContent=s.shortDescription;
    document.title=`${s.name} | Clarigence.in`;
    document.querySelector('meta[name=description]')?.setAttribute('content',s.shortDescription);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content',s.shortDescription);
    const canonical=document.querySelector('link[rel=canonical]');
    if(canonical){canonical.href=new URL(detailHref(s.slug),canonical.href).href;document.querySelector('meta[property="og:url"]')?.setAttribute('content',canonical.href);}
    const article=node('article','service-detail');const intro=node('div');intro.append(icon(s.icon),node('h2','',s.name),node('p','cms-copy',s.description));
    if(s.useCases){intro.append(node('h3','cms-subheading','Typical use cases'),node('p','',s.useCases));}
    if(s.imageUrl)intro.append(image(s.imageUrl,`${s.name} illustration`,'service-image'));
    else intro.append(designGraphic(s.icon==='cloud'?'crm-concept':s.icon==='window'||s.icon==='layout'?'website-concept':'business-growth',`Illustrative ${s.name} graphic`,'service-image'));
    const content=node('div');
    [['How we can help',s.capabilities],['Business benefits',s.benefits]].forEach(([heading,list])=>{
      if(list?.length){content.append(node('h3','',heading));const ul=node('ul','capabilities');list.forEach(value=>ul.append(node('li','',value)));content.append(ul);}
    });
    content.append(link('Discuss this service ↗',`/contact?service=${encodeURIComponent(s.slug)}`,'button button-primary'));
    article.append(intro,content);container.append(article);reveal(container);
  }
  async function portfolio(){
    const containers=[...document.querySelectorAll('[data-portfolio]')];if(!containers.length)return;
    try {
      const items=await api('/api/portfolio');if(!Array.isArray(items))throw new Error('Invalid content');
      for(const container of containers){
        const selected=container.dataset.featured==='true'?items.filter(p=>p.featured).slice(0,2):items;
        container.replaceChildren();container.setAttribute('aria-busy','false');
        if(!selected.length){status(container,'No published projects to show yet. Let’s discuss what we could build for your business.','empty');continue;}
        selected.forEach(project=>{
          const article=node('article','work-card');const art=node('div','project-art');
          const category=(project.category||'').toLowerCase();
          const symbol=category.includes('retail')?'mobile':category.includes('health')?'hospital':category.includes('estate')?'property':category.includes('billing')?'billing':category.includes('commerce')?'commerce':category.includes('crm')?'crm':category.includes('cloud')?'cloud':'website';
          art.classList.add('project-symbol-art');
          const logoNames=['sinnar-mobile','carewell','aurelia','ledger','digital-presence','shopping','workflows','cloud'];
          const logoName=logoNames.find(name=>project.logoUrl===`assets/graphics/logo-${name}.svg`);
          const logo=designGraphic(logoName?`logo-${logoName}`:`portfolio-${symbol}`,logoName?`${project.title} logo`:'','project-symbol');
          if(logoName)logo.classList.add('project-brand-logo');
          art.append(logo);
          if(project.concept)art.append(node('span','concept-badge','DEMO / CONCEPT'));
          const copy=node('div','project-copy');copy.append(node('p','eyebrow',project.category||'Project'),node('h3','',project.title),node('p','',project.shortDescription));
          if(project.technologies?.length)copy.append(node('p','technology',project.technologies.join(' · ')));
          const details=node('details');details.append(node('summary','',project.concept?'Explore the concept':'Project details'),node('p','cms-copy',project.description));
          if(project.concept)details.append(node('p','','An illustrative demo or concept, not a client case study.'));
          const projectHref=safeUrl(project.projectUrl,false,true);
          if(projectHref){const url=node('a','text-link','View project ↗');url.href=projectHref;url.target='_blank';url.rel='noopener noreferrer';url.setAttribute('aria-label',`View ${project.title} (opens in a new tab)`);details.append(url);}
          copy.append(details);article.append(art,copy);container.append(article);
        });reveal(container);
      }
    }catch{containers.forEach(container=>status(container,'Portfolio is temporarily unavailable. Please check back later.'));}
  }
  const text=(selector,value)=>{if(value!=null)document.querySelectorAll(selector).forEach(n=>{n.textContent=value;});};
  const multiline=(element,value)=>{
    if(!element || value==null)return;element.replaceChildren();
    const lines=value.split('\n');lines.forEach((line,index)=>{if(index)element.append(document.createElement('br'));element.append(index===lines.length-1&&index>0?node('span','heading-accent',line):document.createTextNode(line));});
  };
  function heroTitle(value){
    const heading=document.querySelector('.hero-title');if(!heading)return;
    const normalized=text=>text.replace(/\s+/g,' ').trim();
    if(normalized(heading.getAttribute('aria-label')||'')===normalized(value))return;
    const elapsed=Math.max(0,performance.now()-headlineStart)/1000;
    heading.setAttribute('aria-label',value.replaceAll('\n',' '));heading.replaceChildren();
    value.split('\n').forEach((line,lineIndex)=>{
      const row=node('span',`title-line${lineIndex===value.split('\n').length-1?' title-accent':''}`);row.setAttribute('aria-hidden','true');let offset=0;
      line.split(' ').forEach((word,index)=>{
        if(index)row.append(document.createTextNode(' '));const wrapper=node('span','title-word');
        [...word].forEach((letter,i)=>{const part=node('span','title-letter',letter);part.style.setProperty('--letter-delay',`${lineIndex*.25+(offset+i)*.024-elapsed}s`);wrapper.append(part);});
        offset+=word.length;row.append(wrapper);
      });heading.append(row);
    });
  }
  async function content(){
    const page=location.pathname.split('/').pop()||'index.html';
    const key=['index.html','index','home'].includes(page)?'home':page.replace('.html','');
    await Promise.allSettled([
      api('/api/content/business').then(s=>{
        text('.footer-brand p:first-of-type',s.tagline);text('.footer-column:last-child>p',s.address);
        text('.footer-bottom>span',`© ${new Date().getFullYear()} ${s.name}. All rights reserved.`);
        document.querySelectorAll('.brand').forEach(n=>n.setAttribute('aria-label',`${s.name} home`));
        document.querySelectorAll('.brand img').forEach(n=>{n.alt=s.name;});
        document.querySelectorAll('a[href^="mailto:"]').forEach(a=>{if(!s.email)return;a.href=`mailto:${s.email}`;if(a.querySelector('svg')){a.title=`Email ${s.email}`;a.setAttribute('aria-label',`Email Clarigence at ${s.email}`);}else a.textContent=s.email;});
        document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a=>{a.hidden=!s.whatsapp;if(s.whatsapp)a.href=`https://wa.me/${s.whatsapp}`;});
        const social=document.querySelector('.social-links');
        if(social){
          const profiles={LinkedIn:s.linkedin,Instagram:s.instagram,Facebook:s.facebook,YouTube:s.youtube};
          social.querySelectorAll('a').forEach(a=>{
            const label=a.querySelector('span')?.textContent;
            const href=safeUrl(profiles[label]);
            if(href)a.href=href;
          });
        }
        const contact=document.querySelector('.contact-info');if(contact){contact.querySelectorAll('[data-business-extra]').forEach(n=>n.remove());if(s.showPhone==='true'&&s.phone){const phone=node('a','',s.phone);phone.href=`tel:${s.phone.replace(/[^+0-9]/g,'')}`;phone.dataset.businessExtra='true';contact.append(phone);}if(s.hours){const hours=node('span','',s.hours);hours.dataset.businessExtra='true';contact.append(hours);}}
      }),
      api(`/api/content/seo-${key}`).then(s=>{
        if(key==='services' && (new URLSearchParams(location.search).has('service')||location.hash))return;
        document.title=s.title;
        const set=(selector,value)=>{if(value)document.querySelector(selector)?.setAttribute('content',value);};
        set('meta[name=description]',s.description);set('meta[property="og:title"]',s.ogTitle||s.title);set('meta[property="og:description"]',s.ogDescription||s.description);set('meta[property="og:image"]',safeUrl(s.ogImage,true));
      }),
      (key==='home'?api('/api/content/home').then(s=>{
        heroTitle(s.headline);text('.hero-lede',s.subtitle);
        [['.hero-actions .button:first-child',s.primaryCtaText,s.primaryCtaUrl],['.hero-actions .button:last-child',s.secondaryCtaText,s.secondaryCtaUrl]].forEach(([selector,label,href])=>{const a=document.querySelector(selector);if(a){a.replaceChildren(document.createTextNode(label),node('span','','↗'));a.href=safeUrl(href)||'/contact';}});
        multiline(document.querySelector('.about-preview h2'),s.aboutHeading);text('.about-preview>div:last-child>p:not(.large-copy)',s.aboutText);
        multiline(document.querySelector('.cta-box h2'),s.ctaHeading);text('.cta-box p:not(.eyebrow)',s.ctaDescription);
      }):key==='about'?api('/api/content/about').then(s=>{
        multiline(document.querySelector('.page-hero h1'),s.heading);text('.page-hero .hero-lede',s.intro);text('.about-preview>div:last-child>p:nth-of-type(2)',s.companyDescription);text('.why-section .section-heading>p',s.valuesIntro);
        const existing=document.querySelector('[data-about-extra]');if(existing)existing.remove();const section=node('section','section wrap');section.dataset.aboutExtra='true';
        [['Mission',s.mission],['Vision',s.vision]].forEach(([label,value])=>{if(value){const article=node('article');article.append(node('h2','',label),node('p','cms-copy',value));section.append(article);}});
        if(section.children.length)document.querySelector('.why-section').before(section);
      }):Promise.resolve())
    ]);
  }
  Promise.allSettled([services(),portfolio(),content()]);
})();
