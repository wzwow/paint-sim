// v0.26 installable app + offline. Serves this folder over http://127.0.0.1 (service workers need http/https), desktop 1440x900 + mobile 390x844 touch.
// Checks: manifest linked + valid (name, start_url, scope, standalone, 192/512 + maskable icons that load at the stated size), favicon + apple-touch icon load,
// service worker registers with ?sw=1 and takes control after a reload, page then opens OFFLINE (title, paintAPI, canvas paints), Settings > Install & offline
// explains install + says it works offline, a beforeinstallprompt shows the Install button and clicking it calls prompt(), off under automation by default,
// file:// says offline needs the web address, zero console/page errors. Usage: node test-install.js [baseURL] (default: local server).
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)fails++;};
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
(async()=>{let srv=null,BASE=process.argv[2];
if(!BASE){srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);let f=path.join(__dirname,u.endsWith('/')?u+'index.html':u);
  if(!f.startsWith(__dirname)||!fs.existsSync(f)){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(f).pipe(r);});
 await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));BASE='http://127.0.0.1:'+srv.address().port+'/';}
if(!BASE.endsWith('/'))BASE+='/';const ver=(fs.readFileSync(__dirname+'/index.html','utf8').match(/<title>[^<]*(v0\.\d+)/)||[])[1];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const vp of [{name:'desktop',o:{viewport:{width:1440,height:900}}},{name:'mobile',o:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3}}]){
 const ctx=await b.newContext(vp.o);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 const T=s=>vp.name+' · '+s;const mob=vp.name==='mobile';
 const load=async q=>{await p.goto(BASE+'?welcome=0'+q);await p.waitForFunction(()=>window.paintAPI&&paintAPI.installInfo,null,{timeout:40000});await p.waitForTimeout(1200);};
 // 1. default under automation: no service worker
 await load('');let ii=await p.evaluate(()=>paintAPI.installInfo());check(!ii.swOn&&ii.sw==='off',T('service worker off under automation unless ?sw=1'),ii);
 // 2. manifest + icons
 if(!mob){const man=await p.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]');const u=new URL(l.getAttribute('href'),location.href).href;const r=await fetch(u);const j=await r.json();
   const icons=[];for(const i of j.icons){const iu=new URL(i.src,u).href;const im=new Image();im.src=iu;try{await im.decode();icons.push({src:i.src,sizes:i.sizes,purpose:i.purpose,w:im.naturalWidth,h:im.naturalHeight});}catch(_){icons.push({src:i.src,bad:1});}}
   const ex=[];for(const sel of ['link[rel=icon]','link[rel=apple-touch-icon]']){const im=new Image();im.src=document.querySelector(sel).href;try{await im.decode();ex.push(im.naturalWidth);}catch(_){ex.push(0);}}
   return{ok:r.ok,ct:r.headers.get('content-type'),j,icons,ex,theme:document.querySelector('meta[name=theme-color]').content};});
  const j=man.j;check(man.ok&&j.name&&j.short_name==='Medium'&&j.start_url&&j.scope&&j.display==='standalone',T('manifest valid: name, short name, start_url, scope, standalone'),j);
  const sz=s=>man.icons.find(i=>i.sizes===s+'x'+s&&i.purpose==='any'&&i.w===s&&i.h===s),mk=man.icons.find(i=>i.purpose==='maskable'&&i.w===512);
  check(sz(192)&&sz(512)&&mk&&man.icons.every(i=>!i.bad),T('192 + 512 icons and a 512 maskable icon load at their stated sizes'),man.icons);
  check(man.ex[0]===32&&man.ex[1]===180,T('favicon (32) and apple-touch icon (180) load'),man.ex);
  check(j.background_color===man.theme&&j.theme_color===man.theme,T('manifest colours match the app'),[j.background_color,man.theme]);}
 // 3. service worker registers, controls after reload
 await load('&sw=1');try{await p.waitForFunction(()=>paintAPI.installInfo().sw==='ready',null,{timeout:30000});}catch(_){}
 ii=await p.evaluate(()=>paintAPI.installInfo());check(ii.sw==='ready'&&/Works offline/.test(ii.off),T('service worker installed; Settings says it works offline'),ii);
 await load('&sw=1');ii=await p.evaluate(()=>paintAPI.installInfo());check(ii.controlled,T('after a reload the page is served through the service worker'),ii);
 const cached=await p.evaluate(async()=>{const ks=await caches.keys();const c=await caches.open(ks.find(k=>k.startsWith('medium-')));return{ks,n:(await c.keys()).map(r=>new URL(r.url).pathname.split('/').pop())};});
 check(cached.ks.some(k=>k.startsWith('medium-'))&&cached.n.includes('index.html')&&cached.n.includes('icon-512.png'),T('page and icons cached ('+cached.n.length+' files, cache '+cached.ks.join(',')+')'),cached);
 // 4. offline
 await ctx.setOffline(true);let offOK=true;try{await load('&sw=1&diag=0');}catch(e){offOK=false;}
 const off=offOK&&await p.evaluate(()=>({t:document.title,api:!!window.paintAPI,c:!!document.getElementById('c')}));
 check(offOK&&off.api&&off.c&&off.t.includes(ver),T('with the network off the app still opens ('+(off&&off.t)+')'),off);
 if(offOK){const box=await p.evaluate(()=>{const r=document.getElementById('c').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
  if(mob){const cdp=await ctx.newCDPSession(p);const tp=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,force:.6}]});await tp('touchStart',box.x-100,box.y);for(let i=1;i<=25;i++){await tp('touchMove',box.x-100+i*8,box.y);await p.waitForTimeout(16);}await tp('touchEnd');}
  else{await p.mouse.move(box.x-150,box.y);await p.mouse.down();for(let i=1;i<=30;i++){await p.mouse.move(box.x-150+i*10,box.y+Math.sin(i/5)*30);await p.waitForTimeout(16);}await p.mouse.up();}
  await p.waitForTimeout(1500);const ink=await p.evaluate(()=>{const c=paintAPI.exportData('flat')[0][1];const x=document.createElement('canvas');x.width=128;x.height=96;const g=x.getContext('2d');g.drawImage(c,0,0,128,96);const d=g.getImageData(0,0,128,96).data;let n=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-d[0])+Math.abs(d[i+1]-d[1])+Math.abs(d[i+2]-d[2])>30)n++;return n/(d.length/4);});
  check(ink>.003,T('painting works offline'),ink);}
 await ctx.setOffline(false);
 // 5. Settings > Install & offline, with a simulated install prompt
 await p.evaluate(()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>{window.__prompted=1;return Promise.resolve();};e.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(e);});
 const click=async s=>mob?p.tap(s):p.click(s);
 if(!(await p.evaluate(()=>document.querySelector('.open #gInst, #gInst')&&!!document.getElementById('gInst').closest('.open'))))await click(mob?'#dSet':'#dSet');await p.waitForTimeout(400);
 const sum=await p.$('#gInst summary');check(!!sum,T('Settings has an Install & offline section'));
 if(sum){await sum.scrollIntoViewIfNeeded();await click('#gInst summary');await p.waitForTimeout(300);await p.evaluate(()=>document.getElementById('gInst').scrollIntoView({block:'center'}));await p.waitForTimeout(300);
  const bi=await p.evaluate(()=>{const e=document.getElementById('bInstall'),r=e.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{vis:!e.hidden&&r.width>0,h:r.height,hit:!!h&&(h===e||e.contains(h)),msg:document.getElementById('instMsg').textContent,off:document.getElementById('offMsg').textContent,in:r.right<=innerWidth&&r.left>=0};});
  check(bi.vis&&bi.hit&&bi.in&&(!mob||bi.h>=40),T('Install app button appears when the browser offers install, is tappable and on screen'),bi);
  await p.screenshot({path:'screenshot-'+ver+'-install-'+vp.name+'.png'});
  await click('#bInstall');await p.waitForTimeout(300);const pr=await p.evaluate(()=>({p:window.__prompted,h:document.getElementById('bInstall').hidden,msg:document.getElementById('instMsg').textContent}));
  check(pr.p===1&&pr.h&&/install/i.test(pr.msg),T('clicking it opens the browser install prompt, then shows how to install from the menu'),pr);}
 // 6. help mentions installing
 const hl=await p.evaluate(()=>document.getElementById('hsExport').textContent);check(/Install as an app/.test(hl),T('help explains installing'));
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);check(ov<=0,T('no horizontal overflow'),ov);
 const real=errs.filter(e=>!/ERR_INTERNET_DISCONNECTED|net::ERR/.test(e));check(real.length===0,T('zero console/page errors'),real.slice(0,5));
 await ctx.close();}
// 7. file:// page explains
{const ctx=await b.newContext({viewport:{width:1200,height:800}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
 await p.goto('file://'+__dirname+'/index.html?welcome=0&sw=1');await p.waitForFunction(()=>window.paintAPI&&paintAPI.installInfo,null,{timeout:40000});
 const ii=await p.evaluate(()=>paintAPI.installInfo());check(ii.sw==='file'&&/web address/.test(ii.off)&&errs.length===0,'file:// · no service worker, Settings says offline needs the web address',{ii,errs});await ctx.close();}
await b.close();if(srv)srv.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
