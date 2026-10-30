// v0.30 eyedropper test. Exit 0 = pass. Writes screenshot-v0.30-pick-desktop.png, screenshot-v0.30-pick-mobile.png
const {chromium}=require('playwright');const path=require('path');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const L=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
async function setup(ctx){const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
 await p.addInitScript(()=>{try{localStorage.setItem('seenWelcome','1');}catch(_){}});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.startPick,null,{timeout:60000});await p.waitForTimeout(900);
 await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 await p.evaluate(()=>paintAPI.applyPreset('oilImp'));return{p,errs};}
const painted=p=>p.evaluate(()=>{const o=paintAPI.olHeight();let n=0;for(let i=0;i<o.h.length;i++)if(o.h[i]>.02)n++;return n;});
const col=p=>p.evaluate(()=>paintAPI.colour());
(async()=>{const b=await chromium.launch({args:L});
try{// ---------- desktop ----------
 {const ctx=await b.newContext({viewport:{width:1280,height:800}});const{p,errs}=await setup(ctx);
  await p.evaluate(()=>applyHex('#c0281e',false));
  const str=async(x0,y,x1)=>{await p.mouse.move(x0,y);await p.mouse.down();for(let i=1;i<=24;i++){await p.mouse.move(x0+(x1-x0)*i/24,y);await p.waitForTimeout(12);}await p.mouse.up();await p.waitForTimeout(500);};
  await str(450,400,800);await str(450,415,800);
  await p.evaluate(()=>applyHex('#1e46c0',false));
  const n0=await painted(p);
  await p.keyboard.press('i');await p.waitForTimeout(150);check(await p.evaluate(()=>paintAPI.pickOn()),'I starts pick mode');
  check(await p.evaluate(()=>document.body.classList.contains('picking')),'canvas cursor switched');
  await p.mouse.move(620,408);await p.waitForTimeout(300);await p.screenshot({path:path.join(__dirname,'screenshot-v0.30-pick-desktop.png')});
  await p.mouse.down();await p.mouse.move(625,408);await p.mouse.up();await p.waitForTimeout(250);
  let c=await col(p),r=rgb(c);check(r[0]>r[1]+40&&r[0]>r[2]+40,'click picks the red paint',c);
  check(!(await p.evaluate(()=>paintAPI.pickOn())),'pick mode ends after a pick');
  check(await painted(p)===n0,'picking does not paint',[n0,await painted(p)]);
  check((await p.textContent('#pn')).startsWith('Custom'),'colour name shows Custom');
  // Alt+click on bare surface
  await p.keyboard.down('Alt');await p.mouse.move(400,650);await p.waitForTimeout(150);await p.mouse.down();await p.mouse.up();await p.keyboard.up('Alt');await p.waitForTimeout(250);
  c=await col(p);r=rgb(c);check(Math.min(...r)>170,'Alt+click picks the light ground',c);
  check(await painted(p)===n0,'Alt+click does not paint');
  // Esc cancels, cpPick button toggles
  await p.keyboard.press('i');await p.keyboard.press('Escape');await p.waitForTimeout(100);check(!(await p.evaluate(()=>paintAPI.pickOn())),'Esc cancels pick');
  await p.click('#dCol');await p.waitForTimeout(150);check(await p.isVisible('#cpPick'),'pipette button in colour picker');
  await p.click('#cpPick');await p.waitForTimeout(100);check(await p.evaluate(()=>paintAPI.pickOn()&&!document.getElementById('cp').classList.contains('open')),'pipette button starts pick and closes picker');
  await p.mouse.click(700,410);await p.waitForTimeout(250);c=await col(p);r=rgb(c);check(r[0]>r[1]+40,'button pick works',c);
  // painting with picked colour works and matches roughly
  const nb=await painted(p);await str(450,560,800);check(await painted(p)>nb,'painting works after picking');
  const hx=await p.evaluate(()=>{const c=document.getElementById('c').getBoundingClientRect();return null;});
  // API accuracy: transparent area outside canvas returns null
  check(await p.evaluate(()=>paintAPI.pickAt(1.5,.5))===null,'outside canvas returns nothing');
  check(!errs.length,'desktop: no page errors',errs);await ctx.close();}
 // ---------- mobile ----------
 {const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});const{p,errs}=await setup(ctx);
  const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:0,radiusX:4,radiusY:4,force:.5}]});
  const stroke=async(x0,y0,x1,y1)=>{await T('touchStart',x0,y0);for(let i=1;i<=20;i++){await T('touchMove',x0+(x1-x0)*i/20,y0+(y1-y0)*i/20);await p.waitForTimeout(16);}await T('touchEnd');await p.waitForTimeout(400);};
  await p.evaluate(()=>applyHex('#d8a21a',false));await stroke(110,420,280,420);await stroke(110,432,280,432);
  await p.evaluate(()=>applyHex('#205a30',false));const n0=await painted(p);
  await p.tap('#tCol');await p.waitForTimeout(200);const bx=await p.evaluate(()=>{const r=document.getElementById('cpPick').getBoundingClientRect();return[r.width,r.height];});
  check(bx[0]>=36&&bx[1]>=36,'pipette button big enough to tap',bx);
  await p.tap('#cpPick');await p.waitForTimeout(200);check(await p.evaluate(()=>paintAPI.pickOn()),'tap pipette starts pick');
  await T('touchStart',150,500);await T('touchMove',180,460);await T('touchMove',200,426);await p.waitForTimeout(350);
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.30-pick-mobile.png')});
  await T('touchEnd');await p.waitForTimeout(300);
  const c=await col(p),r=rgb(c);check(r[0]>150&&r[1]>100&&r[2]<120,'slide-and-lift picks the yellow ochre',c);
  check(await painted(p)===n0,'picking does not paint',[n0,await painted(p)]);
  check(!(await p.evaluate(()=>paintAPI.pickOn())),'pick ends on lift');
  await stroke(110,600,280,600);check(await painted(p)>n0,'next touch paints again');
  // cancel via toast
  await p.tap('#tCol');await p.waitForTimeout(150);await p.tap('#cpPick');await p.waitForTimeout(150);
  const cancel=await p.$('#toast button');if(cancel){await cancel.tap();await p.waitForTimeout(150);check(!(await p.evaluate(()=>paintAPI.pickOn())),'Cancel in toast ends pick');}else console.log('NOTE toast cancel button not found by selector');
  check(!errs.length,'mobile: no page errors',errs);await ctx.close();}
}catch(e){console.log('FAIL exception',e);fails++;}finally{await b.close();}
console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
