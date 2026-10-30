// v0.22 help sheet + keyboard shortcuts + first-run welcome test (desktop mouse/keyboard + mobile touch). Exit 0 = pass, 1 = failed checks, 2 = crashed.
// Usage: node test-help.js [url|file]   (default index.html; e.g. node test-help.js https://wzwow.github.io/paint-sim/)
// Writes screenshot-v0.22-help-{desktop,mobile}.png and screenshot-v0.22-welcome-{desktop,mobile}.png (named by the detected version).
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const tgt=process.argv[2]||'index.html';const BASEURL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
const withQ=(u,q)=>u+(u.includes('?')?'&':'?')+q;
const VPS=[{name:'desktop',ctx:{viewport:{width:1440,height:900}}},
 {name:'mobile',ctx:{viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true}}];
// every shortcut row the help lists must be exercised below (keeps the list honest)
const EXPECT_KEYS=['brush','presets','knife','pencil','undo','redo','export','save','open','help','rename','layersel','pan','zoom','zoomkey','fitkey','actual','rotate','keep','pick','trace','traceadj','size','clear','esc'];
let fails=0,VER='v0.22';const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined&&(!c||process.env.V)?' '+JSON.stringify(x):''));if(!c)fails++;};
const shotName=(k,vp)=>path.join(__dirname,'screenshot-'+VER+'-'+k+'-'+vp+'.png');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const src=/^file:/.test(BASEURL)?fs.readFileSync(decodeURIComponent(BASEURL.replace(/^file:\/\//,'').split('?')[0]),'utf8'):null;
for(const vp of VPS){console.log('== '+vp.name);const mob=vp.name==='mobile';const ctx=await b.newContext(vp.ctx);const errs=[];
 const watch=p=>{p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels/.test(m.text()))errs.push(m.text());});};
 const p=await ctx.newPage();watch(p);
 await p.goto(BASEURL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.openHelp,null,{timeout:30000});await p.waitForTimeout(900);
 const vi=await p.evaluate(()=>({t:document.title,b:document.getElementById('ver').textContent}));const m=/v\d+(\.\d+)*/.exec(vi.t);
 if(m)VER=m[0];check(m&&vi.b===m[0],'title and badge show the same version ('+VER+')',vi);
 const isMob=await p.evaluate(()=>document.body.classList.contains('m'));check(isMob===mob,'layout mode',{isMob});
 check(await p.evaluate(()=>!paintAPI.welcomeOpen()&&document.getElementById('welcome').hidden),'welcome suppressed by default under automation (navigator.webdriver)');
 const tap=async s=>{if(mob)await p.tap(s);else await p.click(s);await p.waitForTimeout(250);};
 const st=()=>p.evaluate(()=>({open:paintAPI.helpOpen(),tool:paintAPI.info().tool,undo:paintAPI.info().undo,redo:paintAPI.info().redo,exp:document.getElementById('dlgExp').open,s:paintAPI.view.s,ox:paintAPI.view.ox,oy:paintAPI.view.oy,
  focusIn:document.getElementById('dlgHelp').contains(document.activeElement),act:document.activeElement&&(document.activeElement.id||document.activeElement.tagName)}));
 // canvas rect in CSS px, for real strokes
 const R=await p.evaluate(()=>{const v=paintAPI.view,c=document.getElementById('c'),d=c.width/c.getBoundingClientRect().width,I=paintAPI.info();return{x:v.ox/d,y:(c.height-v.oy)/d-I.H*v.s/d,w:I.W*v.s/d,h:I.H*v.s/d};});
 const cdp=mob?await ctx.newCDPSession(p):null;
 const stroke=async(pg,u0,v0,u1,v1,o={})=>{const X=u=>R.x+R.w*u,Y=v=>R.y+R.h*v;const c=o.cdp||cdp;
  if(mob){const T=(type,q)=>c.send('Input.dispatchTouchEvent',{type,touchPoints:q?[{x:q[0],y:q[1],id:0,radiusX:4,radiusY:4,force:.5}]:[]});await T('touchStart',[X(u0),Y(v0)]);for(let i=1;i<=16;i++){const t=i/16;await T('touchMove',[X(u0+(u1-u0)*t),Y(v0+(v1-v0)*t)]);await pg.waitForTimeout(16);}await T('touchEnd');}
  else{if(o.shift)await pg.keyboard.down('Shift');await pg.mouse.move(X(u0),Y(v0));await pg.mouse.down();for(let i=1;i<=16;i++){const t=i/16;await pg.mouse.move(X(u0+(u1-u0)*t),Y(v0+(v1-v0)*t));await pg.waitForTimeout(12);}await pg.mouse.up();if(o.shift)await pg.keyboard.up('Shift');}
  await pg.waitForTimeout(300);};
 const flat=pg=>pg.evaluate(()=>{const c=paintAPI.exportData('flat',false)[0][1];const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const s=[];for(let i=0;i<d.length;i+=64)s.push(d[i]+d[i+1]+d[i+2]);return s;});
 const fdiff=(a,c)=>a.reduce((n,v,i)=>n+(Math.abs(v-c[i])>30?1:0),0);
 // geometry of the open sheet
 const geo=()=>p.evaluate(()=>{const d=document.getElementById('dlgHelp'),r=d.getBoundingClientRect();const small=[...d.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return{id:e.id||e.textContent.trim().slice(0,14),w:b.width,h:b.height};});
  const txt=[...d.querySelectorAll('.hSec li,.hKeys td:last-child')].map(e=>parseFloat(getComputedStyle(e).fontSize));
  return{l:r.left,t:r.top,r:r.right,b:r.bottom,W:innerWidth,H:innerHeight,inner:d.scrollWidth-d.clientWidth,doc:document.documentElement.scrollWidth-innerWidth,small,minFont:Math.min(...txt),
   wide:[...d.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>r.right+.5||b.left<r.left-.5);}).map(e=>e.className||e.tagName).slice(0,5)};});
 const geoOK=(g,tag)=>{check(g.l>=0&&g.t>=0&&g.r<=g.W&&g.b<=g.H,'help sheet fits the viewport ('+tag+')',g);check(g.inner<=0&&g.doc<=0&&!g.wide.length,'no horizontal overflow in the help sheet ('+tag+')',{inner:g.inner,doc:g.doc,wide:g.wide});
  check(g.minFont>=(mob?13.5:12.5),'help text readable (min '+g.minFont+' px)',g.minFont);};
 const content=await p.evaluate(()=>({secs:[...document.querySelectorAll('#dlgHelp .hSec h3')].map(h=>h.textContent.trim()),rows:[...document.querySelectorAll('#hKeys tr')].map(r=>r.dataset.k),api:paintAPI.helpKeys().map(k=>k.id)}));
 for(const need of ['Getting started','Watercolour','Oil','Pen & touch','Layers','Export','Keyboard shortcuts'])check(content.secs.some(s=>s.startsWith(need)),'help section "'+need+'"',content.secs);
 check(JSON.stringify(content.rows)===JSON.stringify(content.api)&&JSON.stringify([...content.rows].sort())===JSON.stringify([...EXPECT_KEYS].sort()),'shortcut table = paintAPI.helpKeys() = the set this test exercises',content);
 if(!mob){
  // toolbar button
  const hb=await p.evaluate(()=>{const e=document.getElementById('tHelp'),b=e.getBoundingClientRect(),h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2),rb=document.getElementById('barR').getBoundingClientRect();
   return{w:b.width,h:b.height,in:b.left>=0&&b.right<=innerWidth&&b.top>=0,hit:!!h&&(h===e||e.contains(h)),ovR:b.right>rb.left&&b.left<rb.right&&b.bottom>rb.top,lab:e.getAttribute('aria-label')};});
  check(hb.w>=44&&hb.h>=44&&hb.in&&hb.hit&&!hb.ovR&&/help/i.test(hb.lab),'? help button in the toolbar (44px, visible, clickable, labelled)',hb);
  // paint something so undo has work, set knife so B would change it
  await stroke(p,.2,.3,.6,.35);await p.evaluate(()=>{paintAPI.setTool('knife');document.activeElement&&document.activeElement.blur();});
  await p.click('#tHelp');await p.waitForTimeout(300);let s0=await st();check(s0.open&&s0.focusIn,'help opens via the toolbar button, focus moves into it',s0);
  geoOK(await geo(),'desktop');
  await p.screenshot({path:shotName('help','desktop')});
  // keys while open must not reach the painting
  for(const k of ['b','k','Control+z','Control+Shift+Z','Control+y','Control+Shift+E','Space','F2','Delete'])await p.keyboard.press(k);await p.waitForTimeout(250);
  let s1=await st();check(s1.open&&s1.tool==='knife'&&s1.undo===s0.undo&&s1.redo===s0.redo&&!s1.exp&&s1.ox===s0.ox,'while open: B/K/Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y/Ctrl+Shift+E/Space/F2 do nothing',{s0,s1});
  check(await p.evaluate(()=>!document.querySelector('#layers .nmi')),'F2 while open does not start a rename');
  // focus trap
  let outside=0;for(let i=0;i<30;i++){await p.keyboard.press(i%7===6?'Shift+Tab':'Tab');if(!(await p.evaluate(()=>document.getElementById('dlgHelp').contains(document.activeElement))))outside++;}
  check(outside===0,'Tab / Shift+Tab stay inside the help sheet',{outside});
  // section chips scroll
  await p.evaluate(()=>{document.getElementById('dlgHelp').scrollTop=0;});await p.click('#dlgHelp [data-go="hsKeys"]');await p.waitForTimeout(200);
  const sc=await p.evaluate(()=>{const d=document.getElementById('dlgHelp'),h=d.querySelector('.hHead').getBoundingClientRect(),k=document.getElementById('hsKeys').getBoundingClientRect();const dr=d.getBoundingClientRect();return{st:d.scrollTop,gap:k.top-h.bottom,atEnd:d.scrollTop>=d.scrollHeight-d.clientHeight-1,vis:k.top>=h.bottom-2&&k.bottom<=dr.bottom+1};});
  check(sc.st>100&&(sc.gap>=-2&&sc.gap<40||sc.atEnd&&sc.vis),'section chip scrolls to its section below the sticky header',sc);
  await p.keyboard.press('Escape');await p.waitForTimeout(250);let s2=await st();check(!s2.open,'Esc closes help',s2);check(s2.act==='tHelp','focus returns to the help button',s2.act);
  check(s2.tool==='knife'&&s2.undo===s0.undo,'nothing changed after closing',s2);
  // ? key (Shift+/) toggles, F1 opens, close button and Done close
  await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
  await p.keyboard.press('Shift+Slash');await p.waitForTimeout(250);check((await st()).open,"'?' (Shift+/) opens help");
  await p.keyboard.press('Shift+Slash');await p.waitForTimeout(250);check(!(await st()).open,"'?' again closes it");
  await p.keyboard.press('F1');await p.waitForTimeout(250);check((await st()).open,'F1 opens help');
  await p.click('#hClose');await p.waitForTimeout(250);check(!(await st()).open,'close button closes help');
  await p.keyboard.press('F1');await p.waitForTimeout(250);await p.click('#hDone');await p.waitForTimeout(250);check(!(await st()).open,'Done closes help');
  await p.keyboard.press('F1');await p.waitForTimeout(250);await p.mouse.click(8,450);await p.waitForTimeout(250);check(!(await st()).open,'click on the backdrop closes help');
  // API
  check(await p.evaluate(()=>{const a=paintAPI.openHelp(),o=paintAPI.helpOpen();paintAPI.closeHelp();return a&&o&&!paintAPI.helpOpen();}),'paintAPI.openHelp/closeHelp/helpOpen');
  // ? typed in a text field does not open help
  await p.keyboard.press('F2');await p.waitForTimeout(400);const inField=await p.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('nmi'));
  await p.keyboard.type('a?b');await p.waitForTimeout(150);check(inField&&!(await st()).open,"'?' typed in the layer-name field does not open help",{inField});await p.keyboard.press('Escape');await p.waitForTimeout(200);
  // help does not open on top of another dialog
  await p.keyboard.press('Control+Shift+E');await p.waitForTimeout(300);await p.keyboard.press('F1');await p.waitForTimeout(200);const ex=await st();check(ex.exp&&!ex.open,'F1 does not stack help on the Export dialog',ex);
  await p.keyboard.press('Escape');await p.waitForTimeout(250);
  // ---- every listed shortcut really works ----
  const done=new Set();const blur=()=>p.evaluate(()=>document.activeElement&&document.activeElement.blur());await blur();
  await p.keyboard.press('b');let t=await st();await p.keyboard.press('k');let t2=await st();await p.keyboard.press('b');let t3=await st();
  check(t.tool==='brush'&&t2.tool==='knife'&&t3.tool==='brush','B / K switch brush and palette knife',[t.tool,t2.tool,t3.tool]);done.add('brush');done.add('knife');
  await p.keyboard.press('g');let tg=await st();await p.keyboard.press('b');check(tg.tool==='pencil','G switches to pencil',tg.tool);done.add('pencil');
  await blur();await p.keyboard.press('p');await p.waitForTimeout(150);const pp1=await p.evaluate(()=>paintAPI.presetsOpen());await p.keyboard.press('p');await p.waitForTimeout(150);const pp2=await p.evaluate(()=>paintAPI.presetsOpen());
  check(pp1&&!pp2,'P opens and closes the brush presets (v0.23)',[pp1,pp2]);done.add('presets');
  const u0=(await st()).undo;await stroke(p,.25,.55,.55,.6);const u1=(await st()).undo;await p.keyboard.press('Control+z');const u2=await st();await p.keyboard.press('Control+Shift+Z');const u3=await st();
  await p.keyboard.press('Control+z');await p.keyboard.press('Control+y');const u4=await st();
  check(u1===u0+1&&u2.undo===u0&&u3.undo===u0+1&&u4.undo===u0+1,'Ctrl+Z undo, Ctrl+Shift+Z and Ctrl+Y redo',{u0,u1,u2:u2.undo,u3:u3.undo,u4:u4.undo});done.add('undo');done.add('redo');
  await p.keyboard.press('Control+Shift+E');await p.waitForTimeout(300);check((await st()).exp,'Ctrl+Shift+E opens Export');await p.keyboard.press('Escape');await p.waitForTimeout(250);check(!(await st()).exp,'Esc closes Export');done.add('export');
  {const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}).catch(()=>null),p.keyboard.press('Control+s')]);check(dl&&/\.mpaint$/.test(dl.suggestedFilename()),'Ctrl+S saves a .mpaint project (v0.25)',dl&&dl.suggestedFilename());done.add('save');
   const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null),p.keyboard.press('Control+o')]);check(!!fc,'Ctrl+O opens the project file picker (v0.25)');done.add('open');}
  done.add('help'); // ? and F1 checked above
  await blur();await p.keyboard.press('F2');await p.waitForTimeout(400);check(await p.evaluate(()=>!!document.querySelector('#layers .nmi')),'F2 renames the current layer');await p.keyboard.press('Escape');await p.waitForTimeout(200);done.add('rename');
  await p.click('#lAdd');await p.waitForTimeout(200);const la=await p.evaluate(()=>paintAPI.layers().findIndex(l=>l.active));await p.focus('#layers .ly.on');await p.keyboard.press('ArrowDown');await p.waitForTimeout(200);
  const lb=await p.evaluate(()=>paintAPI.layers().findIndex(l=>l.active));await p.keyboard.press('ArrowUp');await p.waitForTimeout(200);const lc=await p.evaluate(()=>paintAPI.layers().findIndex(l=>l.active));
  check(la===1&&lb===0&&lc===1,'Arrow keys select the layer below / above in the layer list',[la,lb,lc]);done.add('layersel');
  await blur();const cx=R.x+R.w*.5,cy=R.y+R.h*.5;let v0=await st();await p.keyboard.down('Space');await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx+60,cy+30,{steps:5});await p.mouse.up();await p.keyboard.up('Space');await p.waitForTimeout(150);
  let v1=await st();await p.mouse.move(cx,cy);await p.mouse.down({button:'middle'});await p.mouse.move(cx-40,cy,{steps:5});await p.mouse.up({button:'middle'});await p.waitForTimeout(150);let v2=await st();
  check(Math.abs(v1.ox-v0.ox)>20&&v1.undo===v0.undo&&Math.abs(v2.ox-v1.ox)>20&&v2.undo===v0.undo,'Space+drag and middle-button drag pan without painting',{v0:[v0.ox,v0.undo],v1:[v1.ox,v1.undo],v2:[v2.ox,v2.undo]});done.add('pan');
  await p.mouse.move(cx,cy);await p.mouse.wheel(0,-240);await p.waitForTimeout(200);const v3=await st();check(v3.s>v2.s*1.1,'mouse wheel zooms',{before:v2.s,after:v3.s});done.add('zoom');
  {const g=()=>p.evaluate(()=>({s:paintAPI.view.s,r:paintAPI.view.r,dpr:devicePixelRatio,home:paintAPI.isHome()}));await blur();
   await p.keyboard.press('Control+0');await p.waitForTimeout(150);const a=await g();await p.keyboard.press('Control+=');await p.waitForTimeout(150);const b2=await g();await p.keyboard.press('Control+-');await p.keyboard.press('Control+-');await p.waitForTimeout(150);const c2=await g();
   check(a.home&&b2.s>a.s*1.2&&c2.s<b2.s/1.4,'Ctrl+0 fits, Ctrl+= / Ctrl+- zoom (v0.27)',{a,b2,c2});done.add('fitkey');done.add('zoomkey');
   await p.keyboard.press('Control+1');await p.waitForTimeout(150);const d2=await g();check(Math.abs(d2.s-d2.dpr)<.01,'Ctrl+1 zooms to 100% (v0.27)',d2);done.add('actual');
   await p.keyboard.press('r');await p.waitForTimeout(100);const e2=await g();await p.keyboard.press('Shift+R');await p.keyboard.press('Shift+R');await p.waitForTimeout(100);const f2=await g();
   check(Math.abs(e2.r*180/Math.PI+15)<.5&&Math.abs(f2.r*180/Math.PI-15)<.5,'R / Shift+R rotate the view 15 deg (v0.27)',[e2.r,f2.r]);done.add('rotate');
   await p.keyboard.press('Control+0');await p.waitForTimeout(150);const h2=await g();check(h2.r===0&&h2.home,'Ctrl+0 straightens the view again',h2);}
  await p.evaluate(()=>paintAPI.fit());
  check(!src||/beginStroke\(\{keep:e\.shiftKey\}\)/.test(src),'Shift at stroke start is wired to keep the brush load (source check)');
  const k0=(await st()).undo;await stroke(p,.3,.75,.6,.78,{shift:true});check((await st()).undo===k0+1,'Shift+stroke paints a stroke');done.add('keep');
  await p.click('#dCol');await p.waitForTimeout(250);await blur();await p.keyboard.press('Escape');await p.waitForTimeout(200);const ce=await p.evaluate(()=>document.getElementById('cp').classList.contains('open'));
  await p.click('#dMed');await p.waitForTimeout(250);await p.keyboard.press('Escape');await p.waitForTimeout(200);const me=await p.evaluate(()=>document.getElementById('mp').classList.contains('open'));
  check(!ce&&!me,'Esc closes the colour picker and the Medium menu',{ce,me});done.add('esc');
  {await blur();await p.keyboard.press('i');await p.waitForTimeout(120);const on=await p.evaluate(()=>paintAPI.pickOn());await p.keyboard.press('Escape');await p.waitForTimeout(120);const off=await p.evaluate(()=>!paintAPI.pickOn());
   const hx=await p.evaluate(()=>paintAPI.pickAt(.5,.5));check(on&&off&&/^#[0-9a-f]{6}$/.test(hx||''),'I starts the eyedropper, Esc cancels, sampling works (v0.30)',{on,off,hx});done.add('pick');}
  {await blur();await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=40;c.height=30;const g=c.getContext('2d');g.fillStyle='#c03030';g.fillRect(0,0,40,30);await paintAPI.refLoad(c.toDataURL('image/png'),'t');paintAPI.refShow(false);});
   await p.keyboard.press('t');await p.waitForTimeout(150);const on=await p.evaluate(()=>paintAPI.refInfo().trace);await p.keyboard.press('t');await p.waitForTimeout(150);const off=await p.evaluate(()=>!paintAPI.refInfo().trace);
   check(on&&off,'T toggles tracing the reference over the canvas (v0.32)',{on,off});done.add('trace');
   await p.keyboard.press('Shift+T');await p.waitForTimeout(150);const ta=await p.evaluate(()=>paintAPI.traceAdjOn()&&paintAPI.refInfo().trace);await p.keyboard.press('Escape');await p.waitForTimeout(150);const tb=await p.evaluate(()=>!paintAPI.traceAdjOn());
   check(ta&&tb,'Shift+T moves/resizes the trace, Esc ends (v0.33)',{ta,tb});done.add('traceadj');await p.evaluate(()=>paintAPI.refTrace(false));await p.evaluate(()=>paintAPI.refRemove());}
  {await blur();await p.keyboard.press('Shift+Delete');await p.waitForTimeout(150);const o=await p.evaluate(()=>document.getElementById('dlgClear').open);await p.keyboard.press('Escape');await p.waitForTimeout(150);const c=await p.evaluate(()=>!document.getElementById('dlgClear').open);
   check(o&&c,'Shift+Delete opens the clear-layer confirm, Esc cancels (v0.34)',{o,c});done.add('clear');}
  {await blur();const z0=await p.evaluate(()=>+document.getElementById('size').value);await p.keyboard.press(']');await p.waitForTimeout(80);const z1=await p.evaluate(()=>+document.getElementById('size').value);await p.keyboard.press('[');await p.waitForTimeout(80);const z2=await p.evaluate(()=>+document.getElementById('size').value);
   check(z1>z0&&z2<z1,'] / [ change brush size (v0.34)',{z0,z1,z2});done.add('size');}
  check(EXPECT_KEYS.every(k=>done.has(k)),'every listed shortcut was exercised',[...done]);
  // painting still works after help was used
  await p.keyboard.press('F1');await p.waitForTimeout(200);await p.keyboard.press('Escape');await p.waitForTimeout(200);
  const f0=await flat(p),w0=(await st()).undo;await stroke(p,.15,.15,.85,.2);const f1=await flat(p);check((await st()).undo===w0+1&&fdiff(f0,f1)>20,'a stroke paints after closing help',{changed:fdiff(f0,f1)});
 }else{
  check(await p.evaluate(()=>getComputedStyle(document.getElementById('tHelp')).display==='none'),'desktop ? button hidden on mobile');
  await tap('#tSet');await p.waitForTimeout(300);
  const sum=await p.$('#pBody summary:has-text("Help")');check(!!sum,'Settings drawer has a Help & tips section');await sum.scrollIntoViewIfNeeded();await sum.tap();await p.waitForTimeout(300);
  await p.evaluate(()=>document.getElementById('bHelp').scrollIntoView({block:'center'}));await p.waitForTimeout(200);
  const bh=await p.evaluate(()=>{const e=document.getElementById('bHelp'),b=e.getBoundingClientRect(),h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return{w:b.width,h:b.height,hit:!!h&&(h===e||e.contains(h)),txt:e.textContent.trim()};});
  check(bh.h>=44&&bh.hit,'Open help button in the drawer (>=44px, tappable)',bh);
  const tipLen=await p.evaluate(()=>document.getElementById('bHelp').closest('.gb').textContent.trim().length);check(tipLen<160,'old Tips section shortened to a line + button',tipLen);
  await p.screenshot({path:path.join(__dirname,'_logs','help-mobile-drawer.png')});
  await tap('#bHelp');await p.waitForTimeout(300);const s0=await st();check(s0.open,'help opens from Settings › Help & tips',s0);
  check(await p.evaluate(()=>!document.getElementById('panel').classList.contains('open')),'drawer closes behind the help sheet');
  const g=await geo();geoOK(g,'mobile');const sm=g.small.filter(x=>Math.min(x.w,x.h)<44);check(!sm.length,'help sheet touch targets >= 44px',sm);
  await p.screenshot({path:shotName('help','mobile')});
  await p.evaluate(()=>{document.getElementById('dlgHelp').scrollTop=document.getElementById('hsPen').offsetTop-60;});await p.waitForTimeout(150);await p.screenshot({path:path.join(__dirname,'_logs','help-mobile-scrolled.png')});
  await p.evaluate(()=>{const d=document.getElementById('dlgHelp');d.scrollTop=d.scrollHeight;});await p.waitForTimeout(150);await p.screenshot({path:path.join(__dirname,'_logs','help-mobile-end.png')});
  await tap('#hClose');check(!(await st()).open,'close button closes help (tap)');
  await p.evaluate(()=>paintAPI.openHelp());await p.waitForTimeout(200);await p.keyboard.press('Escape');await p.waitForTimeout(200);check(!(await st()).open,'Esc closes help (mobile)');
  const f0=await flat(p),w0=(await st()).undo;await stroke(p,.2,.4,.8,.45);const f1=await flat(p);check((await st()).undo===w0+1&&fdiff(f0,f1)>20,'a touch stroke paints after closing help',{changed:fdiff(f0,f1)});
 }
 check(await p.evaluate(()=>!paintAPI.welcomeOpen()),'welcome never appeared in the default (automation) run');
 // ---- first-run welcome (?welcome=1) ----
 const ctx2=await b.newContext(vp.ctx);const q=await ctx2.newPage();watch(q);
 await q.goto(withQ(BASEURL,'welcome=1'));await q.waitForFunction(()=>window.paintAPI&&paintAPI.welcomeOpen,null,{timeout:30000});await q.waitForTimeout(1100);
 check(await q.evaluate(()=>paintAPI.welcomeOpen()),'welcome card shows with ?welcome=1');
 const wg=await q.evaluate(()=>{const w=document.getElementById('welcome'),r=w.getBoundingClientRect();const ov=[...document.querySelectorAll('.fl')].filter(e=>e!==w&&e.id!=='cp'&&e.id!=='mp'&&e.id!=='panel'||e.id==='panel'&&e.classList.contains('open')).filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden';})
   .filter(e=>{const b=e.getBoundingClientRect();return Math.min(b.right,r.right)-Math.max(b.left,r.left)>0&&Math.min(b.bottom,r.bottom)-Math.max(b.top,r.top)>0;}).map(e=>e.id);
  const btn=[...w.querySelectorAll('button')].map(e=>{const b=e.getBoundingClientRect();return{id:e.id,w:b.width,h:b.height};});
  const fz=[...w.querySelectorAll('li')].map(e=>parseFloat(getComputedStyle(e).fontSize));
  return{l:r.left,t:r.top,r:r.right,b:r.bottom,W:innerWidth,H:innerHeight,ov,btn,minFont:Math.min(...fz),steps:w.querySelectorAll('li').length,doc:document.documentElement.scrollWidth-innerWidth};});
 check(wg.l>=0&&wg.t>=0&&wg.r<=wg.W&&wg.b<=wg.H&&wg.doc<=0,'welcome card fits the viewport',wg);check(!wg.ov.length,'welcome card does not cover the toolbars',wg.ov);
 check(wg.steps>=3&&wg.steps<=4,'welcome has 3-4 steps',wg.steps);check(wg.btn.every(x=>x.h>=(mob?44:40)),'welcome buttons big enough',wg.btn);check(wg.minFont>=13,'welcome text readable',wg.minFont);
 await q.screenshot({path:shotName('welcome',vp.name)});
 // painting outside the card still works while it is shown
 const cdp2=mob?await ctx2.newCDPSession(q):null;const wu0=await q.evaluate(()=>paintAPI.info().undo);
 const Rq=await q.evaluate(()=>{const v=paintAPI.view,c=document.getElementById('c'),d=c.width/c.getBoundingClientRect().width,I=paintAPI.info();return{x:v.ox/d,y:(c.height-v.oy)/d-I.H*v.s/d,w:I.W*v.s/d,h:I.H*v.s/d};});
 {const vy=mob?.85:.2;const X=u=>Rq.x+Rq.w*u,Y=v=>Rq.y+Rq.h*v;
  if(mob){const T=(type,pt)=>cdp2.send('Input.dispatchTouchEvent',{type,touchPoints:pt?[{x:pt[0],y:pt[1],id:0,radiusX:4,radiusY:4,force:.5}]:[]});await T('touchStart',[X(.2),Y(vy)]);for(let i=1;i<=12;i++){await T('touchMove',[X(.2+.5*i/12),Y(vy)]);await q.waitForTimeout(16);}await T('touchEnd');}
  else{await q.mouse.move(X(.2),Y(vy));await q.mouse.down();for(let i=1;i<=12;i++){await q.mouse.move(X(.2+.5*i/12),Y(vy));await q.waitForTimeout(12);}await q.mouse.up();}await q.waitForTimeout(300);}
 check(await q.evaluate(u=>paintAPI.info().undo===u+1,wu0),'canvas still paints while the welcome card is shown');
 check(await q.evaluate(()=>paintAPI.welcomeOpen()),'painting does not dismiss the card by itself');
 if(mob)await q.tap('#wcOk');else await q.click('#wcOk');await q.waitForTimeout(250);
 check(await q.evaluate(()=>!paintAPI.welcomeOpen()&&localStorage.getItem('seenWelcome')==='1'),"'Got it' hides it and remembers seenWelcome");
 await q.reload();await q.waitForFunction(()=>window.paintAPI&&paintAPI.welcomeOpen,null,{timeout:30000});await q.waitForTimeout(1100);
 check(await q.evaluate(()=>!paintAPI.welcomeOpen()),'welcome stays hidden after reload');
 await ctx2.close();
 const ctx3=await b.newContext(vp.ctx);const r=await ctx3.newPage();watch(r);
 await r.goto(withQ(BASEURL,'welcome=1'));await r.waitForFunction(()=>window.paintAPI&&paintAPI.welcomeOpen,null,{timeout:30000});await r.waitForTimeout(1100);
 if(mob)await r.tap('#wcHelp');else await r.click('#wcHelp');await r.waitForTimeout(300);
 check(await r.evaluate(()=>paintAPI.helpOpen()&&!paintAPI.welcomeOpen()&&localStorage.getItem('seenWelcome')==='1'),"'Open help' opens the help sheet and dismisses the card for good");
 await r.keyboard.press('Escape');await ctx3.close();
 check(!errs.length,'no console/page errors',errs);await ctx.close();}
await b.close();console.log(fails?('FAILED '+fails):'ALL PASS');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
