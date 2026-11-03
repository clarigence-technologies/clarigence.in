/* Extends the existing admin and its authenticated, CSRF-aware apiRequest helper. */
(() => {
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const panel=el('section','cms-panel');panel.id='cms-workspace';panel.hidden=true;
  const footer=document.querySelector('.app-footer');footer.before(panel);
  const legacy=[document.querySelector('#overview'),document.querySelector('.stat-grid'),document.querySelector('#enquiries')];
  const modules=[['services','Services'],['portfolio','Portfolio'],['clients','Clients'],['home','Homepage'],['about','About'],['business','Site Settings'],['seo','SEO']];
  let currentModule='',generation=0,documentGeneration=0,schemaPromise;
  let projectClients=new Map();
  const nav=document.querySelector('.side-nav');
  modules.forEach(([key,label])=>{const a=el('a','side-link',label);a.href=`#cms-${key}`;a.dataset.cms=key;nav.append(a);});
  const button=(label,callback,cls='button')=>{const b=el('button',cls,label);b.type='button';b.addEventListener('click',callback);return b;};
  const status=(container,message,state='')=>{container.textContent=message;container.dataset.state=state;};
  const selected=key=>nav.querySelectorAll('a').forEach(a=>{const active=a.dataset.cms===key || (!key&&a.getAttribute('href')==='#overview');a.classList.toggle('selected',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  nav.addEventListener('click',event=>{
    const a=event.target.closest('a');if(!a)return;
    if(a.dataset.cms){event.preventDefault();openModule(a.dataset.cms);}
    else{generation++;currentModule='';panel.hidden=true;legacy.forEach(n=>n.hidden=false);selected('');}
  });
  const summary=async()=>{
    try{const totals=await apiRequest('/api/admin/cms/summary');
      for(const [key,label] of [['activeServices','ACTIVE SERVICES'],['publishedProjects','PUBLISHED PROJECTS']]){
        let value=document.getElementById(`cms-stat-${key}`);
        if(!value){const card=el('article','stat-card');card.append(el('span','stat-label',label));value=el('div','stat-value');value.id=`cms-stat-${key}`;card.append(value,el('span','stat-foot','Current database records'));document.querySelector('.stat-grid').append(card);}value.textContent=totals[key];
      }
    }catch{/* Existing enquiry error handling owns expired-session feedback. */}
  };
  document.addEventListener('clarigence:admin-ready',()=>{generation++;panel.hidden=true;currentModule='';legacy.forEach(n=>n.hidden=false);selected('');schemaPromise=null;summary();});
  async function openModule(key){
    currentModule=key;const token=++generation;panel.hidden=false;legacy.forEach(n=>n.hidden=true);selected(key);
    panel.replaceChildren(el('p','eyebrow','WEBSITE CONTENT'),el('h1','',modules.find(m=>m[0]===key)?.[1]||'Content'));
    const message=el('p','form-message','Loading content…');message.setAttribute('role','status');message.setAttribute('aria-live','polite');panel.append(message);
    try{
      if(key==='clients'){
        const items=await apiRequest('/api/admin/clients');if(token!==generation)return;message.textContent='';renderClients(items,message);
      }else if(key==='services'||key==='portfolio'){
        const [items,clientList]=await Promise.all([apiRequest(`/api/admin/cms/${key}`),key==='portfolio'?apiRequest('/api/admin/clients'):Promise.resolve([])]);if(token!==generation)return;
        projectClients=new Map(clientList.filter(c=>c.projectSlug).map(c=>[c.projectSlug,c]));
        message.textContent='';renderList(key,items,message);
      }else{
        schemaPromise ||= apiRequest('/api/admin/content/schema').catch(error=>{schemaPromise=null;throw error;});const schemas=await schemaPromise;if(token!==generation)return;
        let documentKey=key;
        if(key==='seo'){
          const label=el('label','','Page');const picker=el('select');picker.id='cms-seo-page';label.htmlFor=picker.id;
          ['home','about','services','solutions','portfolio','contact'].forEach(p=>picker.append(new Option(p[0].toUpperCase()+p.slice(1),`seo-${p}`)));
          panel.append(label,picker);documentKey=picker.value;
          picker.addEventListener('change',()=>loadDocument(picker.value,schemas[ picker.value ],message,token));
        }
        await loadDocument(documentKey,schemas[documentKey],message,token);
      }
    }catch(error){if(token===generation)status(message,error.message,'error');}
  }
  function renderList(kind,items,message){
    const toolbar=el('div','cms-toolbar');toolbar.append(button(`Add ${kind==='services'?'service':'project'}`,()=>itemForm(kind,null,message),'button primary-button'),el('p','',kind==='portfolio'?'All published projects appear on the Portfolio page. Use “Add to happy clients” to also show a project’s logo under “Our happy clients” on the homepage.':'Lower display order appears first. Disable/unpublish to hide a record without deleting it.'));
    panel.append(toolbar);
    if(!items.length){panel.append(el('p','cms-empty','No records yet. Add your first project or service.'));return;}
    const list=el('div','cms-records');
    items.forEach(item=>{
      const row=el('article','cms-record');const intro=el('div');intro.append(el('h2','',item.name),el('p','',`${item.active?'Published':'Draft / inactive'} · Order ${item.displayOrder} · ${item.slug}${kind==='portfolio'?(projectClients.get(item.slug)?.active?' · In Our happy clients':' · Portfolio only'):''}${item.concept&&kind==='portfolio'?' · Demo/concept':''}`));
      const actions=el('div','cms-row-actions');
      actions.append(button('Edit',async event=>{
        const target=event.currentTarget;target.disabled=true;const token=++generation;
        status(message,'Loading saved record…');
        try{
          const saved=await apiRequest(`/api/admin/cms/${kind}/${item.id}`);
          if(token===generation)itemForm(kind,saved,message);
        }catch(error){if(token===generation)status(message,error.message,'error');}
        finally{target.disabled=false;}
      }),...(kind==='portfolio'?[button(projectClients.get(item.slug)?.active?'Remove from happy clients':'Add to happy clients',async event=>{
        const target=event.currentTarget;const linked=projectClients.get(item.slug);target.disabled=true;
        try{
          // No logo yet: open the project form so a logo can be uploaded.
          if(!linked?.active&&!linked?.logoUrl){const saved=await apiRequest(`/api/admin/cms/portfolio/${item.id}`);itemForm(kind,saved,message,{addToClients:true});return;}
          await apiRequest(`/api/admin/clients/project/${encodeURIComponent(item.slug)}`,{method:'PUT',body:JSON.stringify({show:!linked.active})});
          await openModule(kind);status(panel.querySelector('.form-message'),linked.active?'Logo removed from Our happy clients. The project stays on the Portfolio page.':'Logo added to Our happy clients on the homepage'+(item.active?'.':' (visible once the project is published).'),'success');
        }catch(e){status(message,e.message,'error');target.disabled=false;}
      })]:[]),button(item.active?'Deactivate':'Publish',async event=>{
        const target=event.currentTarget;target.disabled=true;
        try{await apiRequest(`/api/admin/cms/${kind}/${item.id}`,{method:'PUT',body:JSON.stringify({...item,active:!item.active})});await openModule(kind);status(panel.querySelector('.form-message'),'Publication status updated.','success');summary();}catch(e){status(message,e.message,'error');target.disabled=false;}
      }),button('Delete',async event=>{
        if(!window.confirm(`Delete “${item.name}” permanently? This cannot be undone. You can deactivate it instead.`))return;
        const target=event.currentTarget;target.disabled=true;
        try{await apiRequest(`/api/admin/cms/${kind}/${item.id}`,{method:'DELETE'});await openModule(kind);status(panel.querySelector('.form-message'),'Record deleted.','success');summary();}catch(e){status(message,e.message,'error');target.disabled=false;}
      },'button delete-button'));
      row.append(intro,actions);list.append(row);
    });panel.append(list);
  }
  function field(form,{name,label,type='text',max=12000,required=false},value=''){
    const wrap=el('div','cms-field');const title=el('label','',`${label}${required?' *':''}`);title.htmlFor=`cms-${name}`;
    let input;
    if(type==='boolean'){input=el('select');input.append(new Option('No / disabled','false'),new Option('Yes / enabled','true'));}
    else if(type==='icon'){input=el('select');['window','cloud','phone','trend','layout','pin','mail','shield','form','flow'].forEach(icon=>input.append(new Option(icon,icon)));}
    else if(type==='textarea'||type==='list'){input=el('textarea');input.rows=type==='list'?3:4;input.maxLength=max;}
    else{input=el('input');input.type=['email','number'].includes(type)?type:'text';input.maxLength=max;if(type==='number'){input.min='0';input.max='100000';input.step='1';}}
    input.id=title.htmlFor;input.name=name;input.required=required;input.value=Array.isArray(value)?value.join('\n'):String(value??'');
    input.dataset.type=type;const error=el('span','cms-field-error');error.id=`${input.id}-error`;input.setAttribute('aria-describedby',error.id);input.addEventListener('input',()=>{error.textContent='';input.removeAttribute('aria-invalid');});
    wrap.append(title,input,error);if(type==='list')wrap.append(el('small','','One item per line (maximum 20).'));
    if(type==='image')wrap.append(el('small','','Use a served local image path, such as /assets/images/project.png or /images/project.jpg, or an HTTP/HTTPS image URL. The file must already be available at this address.'));
    if(name==='slug'){
      input.pattern='[a-z0-9]+(?:-[a-z0-9]+)*';
      wrap.append(el('small','','Internal identifier, such as my-project. It stays fixed after creation. Enter the website address in Project URL.'));
    }
    if(name==='projectUrl')wrap.append(el('small','','Use www.abc.com, https://www.abc.com, or an HTTP URL. Addresses without a scheme are saved with https://.'));
    form.append(wrap);return input;
  }
  function formFeedback(form,message,error){
    status(message,error.message,'error');let first;
    for(const [name,text] of Object.entries(error.fieldErrors||{})){
      const input=form.elements.namedItem(name);if(!input)continue;input.setAttribute('aria-invalid','true');document.getElementById(`${input.id}-error`).textContent=text;first ||=input;
    }first?.focus();
  }
  function itemForm(kind,item,message,options={}){
    panel.querySelectorAll('.cms-toolbar,.cms-records,.cms-empty,.cms-editor').forEach(n=>n.remove());message.textContent='';
    const form=el('form','cms-editor');form.append(el('h2','',`${item?'Edit':'Add'} ${kind==='services'?'service':'project'}`),el('p','','Fields marked * are required. Content is plain text, not HTML.'));
    const definitions=[{name:'name',label:kind==='services'?'Service name':'Project title',max:120,required:true},{name:'slug',label:'Stable internal slug',max:120,required:true},{name:'shortDescription',label:'Short description',type:'textarea',max:600,required:true},{name:'description',label:'Full description',type:'textarea',max:12000,required:true},{name:'icon',label:'Icon',type:'icon',required:true},{name:'imageUrl',label:'Image URL/path (optional)',type:'image',max:2048},{name:'displayOrder',label:'Display order',type:'number',required:true},{name:'active',label:kind==='services'?'Active / visible':'Published',type:'boolean',required:true}];
    if(kind==='services')definitions.push({name:'capabilities',label:'Key capabilities',type:'list',max:6000},{name:'benefits',label:'Business benefits',type:'list',max:6000},{name:'useCases',label:'Typical use cases',type:'textarea',max:2000});
    else definitions.push({name:'category',label:'Category',max:120},{name:'technologies',label:'Technologies',type:'list',max:2400},{name:'projectUrl',label:'Project URL (optional)',type:'url',max:2048},{name:'concept',label:'Clearly label as demo / concept',type:'boolean'});
    definitions.forEach(def=>field(form,def,item?.[def.name]??({displayOrder:10,active:false,featured:false,concept:true,icon:'window'}[def.name]??'')));
    if(kind==='portfolio'){
      const wrap=el('div','cms-field');const label=el('label','','Upload photo (optional)');label.htmlFor='cms-photo';
      const photo=el('input');photo.type='file';photo.id='cms-photo';photo.name='photo';photo.accept='image/png,image/jpeg,image/gif';
      const error=el('span','cms-field-error');error.id='cms-photo-error';photo.setAttribute('aria-describedby','cms-photo-help cms-photo-error');
      const help=el('small','','Choose a PNG, JPEG or GIF photo up to 5 MB (maximum 16 million pixels). It replaces the image URL when you save. Leave empty to keep the current image or save without a photo.');help.id='cms-photo-help';
      photo.addEventListener('change',()=>{error.textContent='';photo.removeAttribute('aria-invalid');});
      wrap.append(label,photo,help,error);form.elements.imageUrl.closest('.cms-field').before(wrap);
    }
    if(kind==='portfolio'){
      // "Our happy clients" on the homepage: optional client logo for this project.
      const linked=item?projectClients.get(item.slug):null;
      form.append(el('h3','cms-subheading','Our happy clients (homepage)'));
      const show=field(form,{name:'showInClients',label:'Add this project’s logo to Our happy clients',type:'boolean'},String(Boolean(options.addToClients||linked?.active)));
      show.closest('.cms-field').append(el('small','','Yes: the client logo appears under “Our happy clients” on the homepage. No: the project appears on the Portfolio page only.'));
      const logoWrap=el('div','cms-field');const logoLabel=el('label','','Upload client logo');logoLabel.htmlFor='cms-clientLogo';
      const logoFile=el('input');logoFile.type='file';logoFile.id='cms-clientLogo';logoFile.name='clientLogo';logoFile.accept='image/png,image/jpeg,image/gif';
      const logoError=el('span','cms-field-error');logoError.id='cms-clientLogo-error';logoFile.setAttribute('aria-describedby','cms-clientLogo-help cms-clientLogo-error');
      const logoHelp=el('small','',linked?.logoUrl?'Current logo shown below. Choose a file only to replace it.':'PNG, JPEG or GIF up to 5 MB. A square or round logo on a transparent background looks best.');logoHelp.id='cms-clientLogo-help';
      logoFile.addEventListener('change',()=>{logoError.textContent='';logoFile.removeAttribute('aria-invalid');});
      logoWrap.append(logoLabel,logoFile,logoHelp,logoError);
      if(linked?.logoUrl){const preview=el('img','cms-client-logo');preview.src=/^(https?:)?\/\//.test(linked.logoUrl)||linked.logoUrl.startsWith('/')?linked.logoUrl:'/'+linked.logoUrl;preview.alt='Current client logo';logoWrap.append(preview);}
      form.append(logoWrap);
      const logoPath=field(form,{name:'clientLogoUrl',label:'Client logo path (optional)',type:'image',max:2048},linked?.logoUrl||'');
      const toggleLogo=()=>{const on=show.value==='true';logoWrap.hidden=!on;logoPath.closest('.cms-field').hidden=!on;};
      show.addEventListener('change',toggleLogo);toggleLogo();
      if(options.addToClients)queueMicrotask(()=>{logoFile.focus();status(message,'Upload the client logo, then save to add it to Our happy clients.');});
    }
    if(item)form.elements.slug.readOnly=true;
    else{let edited=false;form.elements.slug.addEventListener('input',()=>edited=true);form.elements.name.addEventListener('input',()=>{if(!edited)form.elements.slug.value=form.elements.name.value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');});}
    const actions=el('div','cms-form-actions');const save=el('button','button primary-button','Save');save.type='submit';actions.append(save,button('Cancel',()=>openModule(kind)));form.append(actions);panel.append(form);form.elements.name.focus();
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(save.disabled||!form.reportValidity())return;save.disabled=true;save.textContent='Saving…';status(message,'Saving content…');
      const payload={version:item?.version??null};
      definitions.forEach(def=>{const input=form.elements.namedItem(def.name);payload[def.name]=def.type==='boolean'?input.value==='true':def.type==='number'?Number(input.value):def.type==='list'?input.value.split('\n').map(s=>s.trim()).filter(Boolean):input.value.trim();});
      try{
        const clientShow=kind==='portfolio'&&form.elements.namedItem('showInClients')?.value==='true';
        const clientLogoFile=kind==='portfolio'?form.elements.namedItem('clientLogo')?.files[0]:null;
        if(clientShow&&!clientLogoFile&&!form.elements.namedItem('clientLogoUrl').value.trim())throw Object.assign(new Error('Upload the client logo to add this project to Our happy clients.'),{fieldErrors:{clientLogo:'Upload the client logo.'}});
        if(clientLogoFile&&clientLogoFile.size>5*1024*1024)throw Object.assign(new Error('Choose a logo up to 5 MB.'),{fieldErrors:{clientLogo:'Choose a logo up to 5 MB.'}});
        const photo=form.elements.namedItem('photo');const file=photo?.files[0];
        if(file){
          if(file.size>5*1024*1024)throw Object.assign(new Error('Choose a photo up to 5 MB.'),{fieldErrors:{photo:'Choose a photo up to 5 MB.'}});
          status(message,'Uploading photo...');const body=new FormData();body.append('file',file);
          const uploaded=await apiRequest('/api/admin/cms/portfolio/images',{method:'POST',body});
          payload.imageUrl=uploaded.imageUrl;form.elements.imageUrl.value=uploaded.imageUrl;photo.value='';
        }
        await apiRequest(`/api/admin/cms/${kind}${item?`/${item.id}`:''}`,{method:item?'PUT':'POST',body:JSON.stringify(payload)});
        if(kind==='portfolio'){
          const linked=projectClients.get(payload.slug);
          let clientLogoUrl=form.elements.namedItem('clientLogoUrl').value.trim();
          if(clientLogoFile){
            status(message,'Uploading client logo…');const body=new FormData();body.append('file',clientLogoFile);
            clientLogoUrl=(await apiRequest('/api/admin/cms/portfolio/images',{method:'POST',body})).imageUrl;
            form.elements.namedItem('clientLogoUrl').value=clientLogoUrl;form.elements.namedItem('clientLogo').value='';
          }
          if(clientShow||linked)await apiRequest(`/api/admin/clients/project/${encodeURIComponent(payload.slug)}`,{method:'PUT',body:JSON.stringify({show:clientShow,logoUrl:clientLogoUrl||null})});
        }
        await openModule(kind);status(panel.querySelector('.form-message'),'Content saved. Refresh the public page to see the change.','success');summary();}
      catch(error){formFeedback(form,message,error);}
      finally{save.disabled=false;save.textContent='Save';}
    });
  }
  const logoSrc=url=>/^(https?:)?\/\//.test(url)||url.startsWith('/')?url:'/'+url;
  function renderClients(items,message){
    const toolbar=el('div','cms-toolbar');toolbar.append(button('Add client',()=>clientForm(null,message),'button primary-button'),el('p','','Client logos appear in the homepage "Our happy clients" section. Lower display order appears first.'));
    panel.append(toolbar);
    if(!items.length){panel.append(el('p','cms-empty','No clients yet. Add your first client logo.'));return;}
    const list=el('div','cms-records');
    items.forEach(item=>{
      const row=el('article','cms-record');const intro=el('div','cms-client-intro');
      const logo=el('img','cms-client-logo');logo.src=logoSrc(item.logoUrl);logo.alt='';logo.loading='lazy';
      const text=el('div');text.append(el('h2','',item.name),el('p','',`${item.active?'Published':'Hidden'} · Order ${item.displayOrder}${item.projectSlug?' · From portfolio project':''}${item.websiteUrl?' · '+item.websiteUrl:''}`));intro.append(logo,text);
      const actions=el('div','cms-row-actions');
      actions.append(button('Edit',()=>clientForm(item,message)),button(item.active?'Hide':'Publish',async event=>{
        const target=event.currentTarget;target.disabled=true;
        try{await apiRequest(`/api/admin/clients/${item.id}`,{method:'PUT',body:JSON.stringify({...item,active:!item.active})});await openModule('clients');status(panel.querySelector('.form-message'),'Client updated.','success');}catch(e){status(message,e.message,'error');target.disabled=false;}
      }),button('Delete',async event=>{
        if(!window.confirm(`Delete client “${item.name}” permanently? You can hide it instead.`))return;
        const target=event.currentTarget;target.disabled=true;
        try{await apiRequest(`/api/admin/clients/${item.id}`,{method:'DELETE'});await openModule('clients');status(panel.querySelector('.form-message'),'Client deleted.','success');}catch(e){status(message,e.message,'error');target.disabled=false;}
      },'button delete-button'));
      row.append(intro,actions);list.append(row);
    });panel.append(list);
  }
  function clientForm(item,message){
    panel.querySelectorAll('.cms-toolbar,.cms-records,.cms-empty,.cms-editor').forEach(n=>n.remove());message.textContent='';
    const form=el('form','cms-editor');form.append(el('h2','',`${item?'Edit':'Add'} client`),el('p','','Fields marked * are required. Upload a logo or enter an existing image path.'));
    const definitions=[{name:'name',label:'Client name',max:120,required:true},{name:'logoUrl',label:'Logo URL/path',type:'image',max:2048},{name:'websiteUrl',label:'Client website (optional)',type:'url',max:2048},{name:'displayOrder',label:'Display order',type:'number',required:true},{name:'active',label:'Published',type:'boolean',required:true}];
    definitions.forEach(def=>field(form,def,item?.[def.name]??({displayOrder:10,active:true}[def.name]??'')));
    const wrap=el('div','cms-field');const label=el('label','','Upload logo');label.htmlFor='cms-photo';
    const photo=el('input');photo.type='file';photo.id='cms-photo';photo.name='photo';photo.accept='image/png,image/jpeg,image/gif';
    const error=el('span','cms-field-error');error.id='cms-photo-error';photo.setAttribute('aria-describedby','cms-photo-help cms-photo-error');
    const help=el('small','','PNG, JPEG or GIF up to 5 MB. A transparent PNG looks best. It replaces the logo path when you save.');help.id='cms-photo-help';
    photo.addEventListener('change',()=>{error.textContent='';photo.removeAttribute('aria-invalid');});
    wrap.append(label,photo,help,error);form.elements.logoUrl.closest('.cms-field').before(wrap);
    const actions=el('div','cms-form-actions');const save=el('button','button primary-button','Save');save.type='submit';actions.append(save,button('Cancel',()=>openModule('clients')));form.append(actions);panel.append(form);form.elements.name.focus();
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(save.disabled||!form.reportValidity())return;save.disabled=true;save.textContent='Saving…';status(message,'Saving client…');
      const payload={version:item?.version??null};
      definitions.forEach(def=>{const input=form.elements.namedItem(def.name);payload[def.name]=def.type==='boolean'?input.value==='true':def.type==='number'?Number(input.value):input.value.trim();});
      try{
        const file=photo.files[0];
        if(file){
          if(file.size>5*1024*1024)throw Object.assign(new Error('Choose a logo up to 5 MB.'),{fieldErrors:{photo:'Choose a logo up to 5 MB.'}});
          status(message,'Uploading logo…');const body=new FormData();body.append('file',file);
          const uploaded=await apiRequest('/api/admin/cms/portfolio/images',{method:'POST',body});
          payload.logoUrl=uploaded.imageUrl;form.elements.logoUrl.value=uploaded.imageUrl;photo.value='';
        }
        if(!payload.logoUrl)throw Object.assign(new Error('Upload a logo or enter a logo path.'),{fieldErrors:{photo:'Upload a logo or enter a logo path.'}});
        await apiRequest(`/api/admin/clients${item?`/${item.id}`:''}`,{method:item?'PUT':'POST',body:JSON.stringify(payload)});await openModule('clients');status(panel.querySelector('.form-message'),'Client saved. Refresh the homepage to see the change.','success');}
      catch(error){formFeedback(form,message,error);}
      finally{save.disabled=false;save.textContent='Save';}
    });
  }
  async function loadDocument(key,definitions,message,token){
    const docToken=++documentGeneration;
    panel.querySelector('.cms-editor')?.remove();status(message,'Loading page content…');
    try{
      const doc=await apiRequest(`/api/admin/content/${key}`);if(token!==generation||docToken!==documentGeneration)return;
      status(message,'');const form=el('form','cms-editor');form.append(el('p','','Fields marked * are required. Edit content only; layout and motion remain in frontend code.'));
      definitions.forEach(def=>field(form,def,doc.content[def.name]));
      const actions=el('div','cms-form-actions');const save=el('button','button primary-button','Save content');save.type='submit';actions.append(save,button('Cancel',()=>openModule(currentModule)));form.append(actions);panel.append(form);
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(save.disabled||!form.reportValidity())return;save.disabled=true;save.textContent='Saving…';status(message,'Saving…');
        const content={};definitions.forEach(def=>content[def.name]=form.elements.namedItem(def.name).value.trim());
        try{const saved=await apiRequest(`/api/admin/content/${key}`,{method:'PUT',body:JSON.stringify({content,version:doc.version})});doc.version=saved.version;status(message,'Content saved. Refresh the public page to see the change.','success');}
        catch(error){formFeedback(form,message,error);}finally{save.disabled=false;save.textContent='Save content';}
      });
    }catch(error){if(token===generation)status(message,error.message,'error');}
  }
})();
