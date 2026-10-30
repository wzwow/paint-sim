// v0.23 brush presets. Desktop (1440x900) + mobile (390x844 touch, DPR 3). Exit 0 pass / 1 fail / 2 crash.
// Checks: picker opens from the toolbar (desktop) / bottom bar (mobile) and fits the screen, 11 built-ins with engine-painted
// thumbnails (distinct images, cached in localStorage, not repainted after reload), applying each preset sets every parameter
// (state + UI controls), the active preset is shown and marked modified after a change, save / rename / delete custom presets,
// persistence after reload (custom list + active preset re-applied), touch targets >= 44 px on mobile, no horizontal overflow,
// presets in the help sheet, the thumbnail iframe never writes storage, zero console/page errors.
const {chromium}=require('playwright');
const URL=(process.argv[2]||('file://'+__dirname+'/index.html'))+'?welcome=0';
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const vp of [{name:'desktop',o:{viewport:{width:1440,height:900}}},{name:'mobile',o:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3}}]){
 const ctx=await b.newContext(vp.o);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 const T=s=>vp.name+' · '+s;const mob=vp.name==='mobile';
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.presets,null,{timeout:30000});await p.waitForTimeout(500);
 const btn=mob?'#tPre':'#dPre';
 const vis=await p.evaluate(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{w:r.width,h:r.height,in:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,hit:!!el&&e.contains(el)};},btn);
 check(vis.in&&vis.hit&&vis.w>=44&&vis.h>=44,T('Presets button visible, clickable, >= 44 px'),vis);
 if(mob)await p.tap(btn);else await p.click(btn);await p.waitForTimeout(300);
 check(await p.evaluate(()=>paintAPI.presetsOpen()),T('tapping it opens the picker'));
 const ps=await p.evaluate(()=>paintAPI.presets());check(ps.filter(q=>!q.custom).length===15,T('15 built-in presets'),ps.length);
 const names=['Watercolour round wash','Wet-on-wet bloom','Dry brush','Watercolour detail','Gouache flat','Acrylic filbert','Oil impasto round','Oil fan blender','Palette knife impasto','Ink liner','Ink wash'];
 check(names.every(n=>ps.some(q=>q.name===n)),T('the requested preset names'));
 const sigs=new Set(ps.map(q=>JSON.stringify(q.v)));check(sigs.size===ps.length,T('every preset has distinct settings'));
 const t0=Date.now();await p.waitForFunction(()=>paintAPI.presetThumbsPending()===0&&paintAPI.presets().every(q=>paintAPI.presetThumb(q.id)),null,{timeout:420000});
 const tsec=(Date.now()-t0)/1000;
 const th=await p.evaluate(async()=>{const out=[];for(const q of paintAPI.presets()){const u=paintAPI.presetThumb(q.id);const im=new Image();im.src=u;await im.decode();const c=document.createElement('canvas');c.width=60;c.height=20;const x=c.getContext('2d');x.drawImage(im,0,0,60,20);
  const d=x.getImageData(0,0,60,20).data;let ink=0;const bg=[d[0],d[1],d[2]];for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-bg[0])+Math.abs(d[i+1]-bg[1])+Math.abs(d[i+2]-bg[2])>40)ink++;out.push({id:q.id,w:im.width,h:im.height,ink:ink/1200,sig:Array.from(d.filter((_,i)=>i%16===0)).join(',')});}
  return{out,imgs:[...document.querySelectorAll('#bp img.ok')].length,frame:!!document.getElementById('bpFrame'),stored:Object.keys(JSON.parse(localStorage.getItem('presetThumbs')||'{}')).length};});
 check(th.out.every(t=>t.w===360&&t.h===120&&t.ink>.03&&t.ink<.8),T('every thumbnail is a 360x120 stroke image with paint on it ('+tsec.toFixed(0)+' s to paint all)'),th.out.map(t=>[t.id,t.ink.toFixed(2)]));
 check(new Set(th.out.map(t=>t.sig)).size===th.out.length,T('thumbnails are all different'));
 check(th.imgs===15&&th.stored===15&&!th.frame,T('thumbnails shown in the cards, cached in localStorage, thumbnail iframe removed'),th);
 const fit=await p.evaluate(()=>{const r=document.getElementById('bp').getBoundingClientRect();return{l:r.left,t:r.top,r:r.right,b:r.bottom,W:innerWidth,H:innerHeight,doc:document.documentElement.scrollWidth-innerWidth};});
 check(fit.l>=0&&fit.t>=0&&fit.r<=fit.W&&fit.b<=fit.H&&fit.doc<=0,T('picker fits the viewport, no horizontal overflow'),fit);
 // apply each preset through the UI and check state + controls
 const bad=[];for(const q of ps){const sel='#bp .bpC[data-id="'+q.id+'"]';if(!(await p.evaluate(()=>paintAPI.presetsOpen())))await p.evaluate(()=>paintAPI.openPresets());
  await p.$eval(sel,e=>e.scrollIntoView({block:'center'}));if(mob)await p.tap(sel);else await p.click(sel);await p.waitForTimeout(80);
  const r=await p.evaluate(()=>{const s=paintAPI.presetState();const $=i=>document.getElementById(i);return{s,ui:{size:+$('size').value,stiff:+$('stiff').value,wload:+$('wload').value,dyn:+$('dyn').value,flick:$('flick').checked,wob:$('wob').checked,
   shape:$('shape').querySelector('.on')&&$('shape').querySelector('.on').dataset.v,tool:$('tool').querySelector('.on')&&$('tool').querySelector('.on').dataset.v,med:paintAPI.medium()}};});
  const v=q.v,u=r.ui;const ok=r.s&&r.s.id===q.id&&!r.s.modified&&u.size===v.size&&Math.abs(u.stiff-v.stiff)<.011&&Math.abs(u.wload-v.wload)<.011&&Math.abs(u.dyn-v.dyn)<.011&&u.flick===v.flick&&u.wob===v.wobble&&u.shape===v.shape&&u.tool===v.tool&&(v.tool==='pencil'||u.med===v.med);
  if(!ok)bad.push({id:q.id,r});}
 check(!bad.length,T('tapping each card applies all its settings (state + controls) and marks it active, not modified'),bad.slice(0,2));
 if(mob)check(!(await p.evaluate(()=>paintAPI.presetsOpen())),T('on mobile the picker closes after choosing'));
 // active label + modified
 await p.evaluate(()=>paintAPI.applyPreset('inkLine'));await p.waitForTimeout(500);
 const lab=await p.evaluate(()=>({t:document.getElementById('dPreT').textContent,mod:document.getElementById('dPre').classList.contains('mod')}));check(lab.t==='Ink liner'&&!lab.mod,T('toolbar shows the active preset'),lab);
 await p.evaluate(()=>{const e=document.getElementById('size');e.value=50;e.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(600);
 const md=await p.evaluate(()=>({s:paintAPI.presetState(),d:document.getElementById('dPre').classList.contains('mod'),t:document.getElementById('tPre').classList.contains('mod')}));
 check(md.s&&md.s.modified&&md.d&&md.t,T('changing a setting marks the preset modified'),md);
 await p.evaluate(()=>paintAPI.openPresets());await p.waitForTimeout(200);
 check(await p.evaluate(()=>{const w=document.querySelector('#bp .bpI.on');return !!w&&w.dataset.id==='inkLine'&&w.classList.contains('mod')&&/modified/.test(document.getElementById('bpAct').textContent);}),T('picker highlights the active card and says modified'));
 // save (button) -> inline rename -> type name
 if(mob)await p.tap('#bpSave');else await p.click('#bpSave');await p.waitForTimeout(250);
 const hasIn=await p.evaluate(()=>!!document.querySelector('#bp .bpIn')&&document.activeElement.classList.contains('bpIn'));check(hasIn,T('Save current adds a preset with its name field focused'));
 await p.keyboard.press('Control+A');await p.keyboard.type('Big liner');await p.keyboard.press('Enter');await p.waitForTimeout(250);
 const sv=await p.evaluate(()=>{const c=paintAPI.presets().filter(q=>q.custom);return{c,s:paintAPI.presetState()};});
 check(sv.c.length===1&&sv.c[0].name==='Big liner'&&sv.c[0].v.size===50&&sv.c[0].v.med==='ink'&&sv.s.id===sv.c[0].id&&!sv.s.modified,T('saved with the typed name and the current settings, now active'),sv);
 const cid=sv.c[0].id;
 await p.waitForFunction(id=>!!paintAPI.presetThumb(id),cid,{timeout:120000});check(true,T('custom preset gets an engine thumbnail'));
 // rename via pencil
 const rn='#bp .bpI[data-id="'+cid+'"] .bpRen';await p.$eval(rn,e=>e.scrollIntoView({block:'center'}));if(mob)await p.tap(rn);else await p.click(rn);await p.waitForTimeout(200);
 await p.keyboard.press('Control+A');await p.keyboard.type('Bold liner');await p.keyboard.press('Enter');await p.waitForTimeout(200);
 check(await p.evaluate(id=>paintAPI.presets().find(q=>q.id===id).name==='Bold liner'&&document.querySelector('#bp .bpI[data-id="'+id+'"] .nm').textContent==='Bold liner',cid),T('rename with the pencil button'));
 // a second custom via API, for delete
 const cid2=await p.evaluate(()=>{paintAPI.applyPreset('gouFlat');return paintAPI.savePreset('Temp');});
 if(mob){const sm=await p.evaluate(()=>[...document.querySelectorAll('#bp button,#bp input')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{c:e.className||e.id,w:r.width,h:r.height};}).filter(x=>Math.min(x.w,x.h)<44));
  check(!sm.length,T('picker touch targets >= 44 px'),sm);}
 const dl='#bp .bpI[data-id="'+cid2+'"] .bpDel';await p.$eval(dl,e=>e.scrollIntoView({block:'center'}));
 if(mob)await p.tap(dl);else await p.click(dl);await p.waitForTimeout(150);
 check(await p.evaluate(id=>paintAPI.presets().some(q=>q.id===id),cid2),T('first tap on delete only asks (Delete?)'));
 if(mob)await p.tap(dl);else await p.click(dl);await p.waitForTimeout(200);
 check(await p.evaluate(id=>!paintAPI.presets().some(q=>q.id===id)&&!document.querySelector('#bp .bpI[data-id="'+id+'"]')&&paintAPI.presetState()===null,cid2),T('second tap deletes it (and clears the active preset)'));
 await p.evaluate(id=>paintAPI.applyPreset(id),cid);await p.waitForTimeout(200);
 // escape / outside closes
 if(!mob){await p.keyboard.press('Escape');await p.waitForTimeout(150);check(!(await p.evaluate(()=>paintAPI.presetsOpen())),T('Escape closes the picker'));await p.keyboard.press('p');await p.waitForTimeout(150);check(await p.evaluate(()=>paintAPI.presetsOpen()),T('P opens it'));await p.keyboard.press('p');}
 else{await p.evaluate(()=>paintAPI.openPresets());await p.touchscreen.tap(195,60);await p.waitForTimeout(200);check(!(await p.evaluate(()=>paintAPI.presetsOpen())),T('tapping outside closes the picker'));}
 // reload: persistence + cache
 await p.reload();await p.waitForFunction(()=>window.paintAPI&&paintAPI.presets,null,{timeout:30000});await p.waitForTimeout(500);
 const rl=await p.evaluate(id=>({c:paintAPI.presets().filter(q=>q.custom).map(q=>q.name),s:paintAPI.presetState(),size:+document.getElementById('size').value,med:paintAPI.medium(),th:paintAPI.presets().every(q=>!!paintAPI.presetThumb(q.id))}),cid);
 check(rl.c.length===1&&rl.c[0]==='Bold liner',T('custom preset survives a reload'),rl.c);
 check(rl.s&&rl.s.id===cid&&!rl.s.modified&&rl.size===50&&rl.med==='ink',T('active preset is re-applied after a reload'),rl);
 await p.evaluate(()=>paintAPI.openPresets());await p.waitForTimeout(300);
 check(rl.th&&await p.evaluate(()=>!document.getElementById('bpFrame')&&paintAPI.presetThumbsPending()===0&&document.querySelectorAll('#bp img.ok').length===16),T('thumbnails come from the cache after reload (no repaint)'));
 await p.evaluate(()=>paintAPI.closePresets());
 // help
 const hp=await p.evaluate(()=>{paintAPI.openHelp('hsPresets');const s=document.getElementById('hsPresets');return!!s&&/Save current/.test(s.textContent)&&!!document.querySelector('#dlgHelp [data-go="hsPresets"]')&&paintAPI.helpKeys().some(k=>k.id==='presets');});
 check(hp,T('presets section + chip + P shortcut in the help sheet'));await p.evaluate(()=>paintAPI.closeHelp());
 // painting still works with a preset
 const pa=await p.evaluate(()=>{paintAPI.applyPreset('oilImp');paintAPI.pause(true);const before=paintAPI.exportData('flat')[0][1].toDataURL();paintAPI.stroke([[.3,.5],[.5,.52],[.7,.5]],.6);paintAPI.step(3);return before!==paintAPI.exportData('flat')[0][1].toDataURL();});
 check(pa,T('a stroke after applying a preset paints'));
 check(!errs.length,T('no console/page errors'),errs.slice(0,3));await ctx.close();}
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
