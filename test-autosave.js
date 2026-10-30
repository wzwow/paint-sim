// v0.25 autosave + reopen. Desktop (1440x900) + mobile (390x844 touch, DPR 3). Exit 0 pass / 1 fail / 2 crash.
// Checks: autosave off under automation by default; with ?autosave=1 a stroke is saved to IndexedDB within ~10 s of lifting the pen,
// the status line says so, a reload reopens the same painting (size, layers, pixels) with a toast + Start fresh, Start fresh empties it
// and the next reload opens blank, the Autosave checkbox off deletes the stored copy, Ctrl+S downloads a .mpaint, Ctrl+O opens the file
// picker, toast fits the screen, zero console/page errors.
const {chromium}=require('playwright');
const BASE=(process.argv[2]||('file://'+__dirname+'/index.html'));
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)fails++;};
const sig=p=>p.evaluate(()=>{const c=paintAPI.exportData('flat')[0][1];const x=document.createElement('canvas');x.width=128;x.height=Math.round(128*c.height/c.width);const g=x.getContext('2d');g.drawImage(c,0,0,x.width,x.height);
 const d=g.getImageData(0,0,x.width,x.height).data;const bg=[d[0],d[1],d[2]];let ink=0;const v=[];for(let i=0;i<d.length;i+=4){const df=Math.abs(d[i]-bg[0])+Math.abs(d[i+1]-bg[1])+Math.abs(d[i+2]-bg[2]);if(df>30)ink++;v.push(d[i],d[i+1],d[i+2]);}return{ink:ink/(d.length/4),v,W:c.width,H:c.height,layers:paintAPI.layers().map(l=>l.name)};});
const mad=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const vp of [{name:'desktop',o:{viewport:{width:1440,height:900},acceptDownloads:true}},{name:'mobile',o:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3,acceptDownloads:true}}]){
 const ctx=await b.newContext(vp.o);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 const T=s=>vp.name+' · '+s;const mob=vp.name==='mobile';
 const load=async q=>{await p.goto(BASE+'?welcome=0'+q);await p.waitForFunction(()=>window.paintAPI&&paintAPI.autosaveInfo,null,{timeout:30000});await p.waitForTimeout(1500);};
 // 1. default under automation: off
 await load('');const i0=await p.evaluate(()=>paintAPI.autosaveInfo());check(!i0.on,T('autosave is off under automation unless ?autosave=1 (other tests unaffected)'),i0);
 await load('&autosave=1');await p.evaluate(()=>paintAPI.autosaveClear());await load('&autosave=1');
 check(!(await p.evaluate(()=>document.getElementById('toast').classList.contains('on'))),T('nothing stored: no reopen toast'));
 // 2. paint a stroke and wait for the autosave
 const box=await p.evaluate(()=>{const r=document.getElementById('c').getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height};});
 const cx=box.x+box.w/2,cy=box.y+box.h/2;
 if(mob){const cdp=await ctx.newCDPSession(p);const tp=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,force:.6}]});
  await tp('touchStart',cx-120,cy);for(let i=1;i<=30;i++){await tp('touchMove',cx-120+i*8,cy+Math.sin(i/5)*30);await p.waitForTimeout(16);}await tp('touchEnd');}
 else{await p.mouse.move(cx-200,cy);await p.mouse.down();for(let i=1;i<=40;i++){await p.mouse.move(cx-200+i*10,cy+Math.sin(i/6)*40);await p.waitForTimeout(16);}await p.mouse.up();}
 const t0=Date.now();let info=null;try{await p.waitForFunction(()=>{const i=paintAPI.autosaveInfo();return i.info&&!i.busy;},null,{timeout:30000});info=await p.evaluate(()=>paintAPI.autosaveInfo());}catch(_){}
 const secs=(Date.now()-t0)/1000;check(info&&info.info&&secs<15,T('stroke autosaved '+secs.toFixed(1)+' s after lifting (save took '+(info?info.lastMs.toFixed(0):'?')+' ms, '+(info&&info.info?(info.info.bytes/1e3).toFixed(0):'?')+' kB)'),info);
 const st=await p.evaluate(()=>document.getElementById('asv').textContent);check(/Autosaved at \d\d:\d\d/.test(st),T('status line says when it was saved'),st);
 await p.waitForTimeout(2500);await p.evaluate(()=>paintAPI.autosaveNow());const a=await sig(p);check(a.ink>.005,T('the stroke is on the canvas'),a.ink);
 // 3. reload reopens it
 await load('&autosave=1');await p.waitForFunction(()=>document.getElementById('toast').classList.contains('on'),null,{timeout:20000}).catch(()=>{});
 const tst=await p.evaluate(()=>{const t=document.getElementById('toast'),r=t.getBoundingClientRect();return{on:t.classList.contains('on'),txt:t.textContent,in:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,btn:(()=>{const b=t.querySelector('button');if(!b)return null;const q=b.getBoundingClientRect();return{w:q.width,h:q.height};})()};});
 check(tst.on&&/Reopened your painting from/.test(tst.txt)&&/Start fresh/.test(tst.txt)&&tst.in,T('reload shows "Reopened your painting" toast with Start fresh, inside the screen'),tst);
 if(mob)check(tst.btn&&tst.btn.h>=36,T('Start fresh button is a usable touch target'),tst.btn);
 await p.screenshot({path:'screenshot-v0.25-autosave-'+vp.name+'.png'});
 const r=await sig(p);const m=mad(a.v,r.v);
 check(r.W===a.W&&r.H===a.H&&JSON.stringify(r.layers)===JSON.stringify(a.layers),T('same canvas size and layers after reopening'),{a:[a.W,a.H,a.layers],r:[r.W,r.H,r.layers]});
 check(Math.abs(r.ink-a.ink)<=Math.max(.01,a.ink*.15)&&m<4,T('same picture after reopening (ink '+a.ink.toFixed(3)+' vs '+r.ink.toFixed(3)+', mean diff '+m.toFixed(2)+'/255)'));
 // 4. Start fresh
 if(mob)await p.tap('#toast button');else await p.click('#toast button');await p.waitForTimeout(1500);
 const f=await sig(p);check(f.ink<.001,T('Start fresh empties the canvas'),f.ink);
 await load('&autosave=1');const f2=await sig(p);const tt=await p.evaluate(()=>document.getElementById('toast').textContent);
 check(f2.ink<.001&&!/Reopened/.test(tt),T('after Start fresh the next visit opens blank'),{ink:f2.ink,tt});
 // 5. checkbox off deletes the stored copy
 await p.evaluate(()=>{paintAPI.newCanvas&&0;});
 if(mob){await p.mouse.move(0,0);}
 // paint via API-free path: a stroke again, save, then switch autosave off
 if(!mob){await p.mouse.move(cx-100,cy);await p.mouse.down();for(let i=1;i<=20;i++){await p.mouse.move(cx-100+i*10,cy);await p.waitForTimeout(16);}await p.mouse.up();}
 else{const cdp=await ctx.newCDPSession(p);const tp=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,force:.6}]});await tp('touchStart',cx-80,cy);for(let i=1;i<=20;i++){await tp('touchMove',cx-80+i*8,cy);await p.waitForTimeout(16);}await tp('touchEnd');}
 await p.waitForTimeout(800);await p.evaluate(()=>paintAPI.autosaveNow());
 await p.evaluate(()=>{const c=document.getElementById('autoSave');c.checked=false;c.dispatchEvent(new Event('change'));});await p.waitForTimeout(500);
 await load('&autosave=1');const o=await p.evaluate(()=>({chk:document.getElementById('autoSave').checked,txt:document.getElementById('toast').textContent,st:document.getElementById('asv').textContent}));const os=await sig(p);
 check(!o.chk&&!/Reopened/.test(o.txt)&&os.ink<.001&&/off/.test(o.st),T('Autosave off: setting remembered, nothing reopened, status says off'),{o,ink:os.ink});
 await p.evaluate(()=>{const c=document.getElementById('autoSave');c.checked=true;c.dispatchEvent(new Event('change'));});
 // 6. Ctrl+S / Ctrl+O (desktop keyboard)
 if(!mob){const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}).catch(()=>null),p.keyboard.press('Control+s')]);
  check(dl&&/^painting-\d{8}-\d{4}\.mpaint$/.test(dl.suggestedFilename()),T('Ctrl+S downloads a dated .mpaint project'),dl&&dl.suggestedFilename());
  const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null),p.keyboard.press('Control+o')]);check(!!fc,T('Ctrl+O opens the project file picker'));
  const keys=await p.evaluate(()=>paintAPI.helpKeys().map(k=>k.id));check(keys.includes('save')&&keys.includes('open'),T('help lists the save/open shortcuts'));}
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);check(ov<=0,T('no horizontal overflow'),ov);
 check(errs.length===0,T('zero console/page errors'),errs.slice(0,5));
 await ctx.close();}
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
