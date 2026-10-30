// v0.37: Light & relief pop-over (☀ in view bar), presets, dial, flat view, persistence, mobile row. Exit 0 = pass.
const {chromium}=require('playwright');const path=require('path');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
const ov=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{for(const [w,h,mob] of [[2191,1304,0],[1280,800,0],[412,915,1]]){console.log('== '+w+'x'+h);
 const ctx=await b.newContext(mob?{viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:w,height:h},deviceScaleFactor:1});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.homeView,null,{timeout:30000});await p.evaluate(()=>localStorage.removeItem('medium.light'));await p.reload();await p.waitForFunction(()=>window.paintAPI&&paintAPI.homeView,null,{timeout:30000});await p.waitForTimeout(800);
 const L=()=>p.evaluate(()=>paintAPI.lightState());const d0=await L();check(Math.abs(d0.str-100)<1&&!d0.flat,'defaults',d0);
 const sun=mob?'#mvSun':'#vSun';
 if(mob&&!(await p.isVisible('#mvSun'))){await p.tap('#tView');await p.waitForTimeout(300);}
 await (mob?p.tap(sun):p.click(sun));await p.waitForTimeout(300);check(await p.isVisible('#lp'),'panel opens');
 const r=await p.evaluate(()=>{const R=e=>document.getElementById(e).getBoundingClientRect();const a=R('lp');return{a:{l:a.left,t:a.top,r:a.right,b:a.bottom},vw:innerWidth,vh:innerHeight};});
 check(r.a.l>=0&&r.a.t>=0&&r.a.r<=r.vw&&r.a.b<=r.vh,'panel inside viewport',r);
 await (mob?p.tap('[data-lp=raking]'):p.click('[data-lp=raking]'));await p.waitForTimeout(200);let s=await L();check(s.el<20&&s.str>130,'raking preset',s);
 const dl=await p.locator('#lpDial').boundingBox();await p.mouse.move(dl.x+dl.width/2,dl.y+dl.height/2);await p.mouse.down();await p.mouse.move(dl.x+dl.width/2+5,dl.y+dl.height/2-5,{steps:3});await p.mouse.up();await p.waitForTimeout(200);
 s=await L();check(s.el>70,'dial drag to centre raises sun',s.el);
 await p.fill('#lpGl','30');await p.dispatchEvent('#lpGl','input');await p.waitForTimeout(100);check((await L()).gloss==30,'gloss slider',(await L()).gloss);
 if(w===2191)await p.screenshot({path:'screenshot-v0.39-light-panel-desktop.png'});
 if(mob)await p.screenshot({path:'screenshot-v0.39-light-panel-mobile.png'});
 await p.keyboard.press('Escape');await p.waitForTimeout(200);check(!(await p.isVisible('#lp')),'Esc closes');
 const fl=mob?'#mvFlat':'#vFlat';await (mob?p.tap(fl):p.click(fl));await p.waitForTimeout(200);check((await L()).flat,'flat toggle on');
 await p.reload();await p.waitForFunction(()=>window.paintAPI&&paintAPI.homeView,null,{timeout:30000});await p.waitForTimeout(600);s=await L();check(s.flat&&s.gloss==30,'persisted after reload',s);
 await p.evaluate(()=>localStorage.removeItem('medium.light'));
 check(!errs.length,'no errors',errs);await ctx.close();}}
catch(e){console.log('FAIL exception '+e);fails++;}finally{await b.close();}console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
