// v0.37: desktop bottom view bar: Fit,1:1,-,%,+,rotL,rotR,straighten,Light(☀),Flat(◐),Clear. Exit 0 = pass.
const {chromium}=require('playwright');const path=require('path');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
const IDS=['vFit','v100','vOut','zoomv','vIn','vRL','vRR','rotv','vSun','vGrey','vFlat','vClr'];
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{for(const [w,h] of [[2191,1304],[1280,800]]){console.log('== '+w+'x'+h);const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.homeView,null,{timeout:30000});await p.waitForTimeout(900);
 const order=await p.evaluate(()=>[...document.querySelectorAll('#viewc button')].map(e=>e.id));check(JSON.stringify(order)===JSON.stringify(IDS),'order matches mobile',order);
 const geo=()=>p.evaluate(ids=>{const W=innerWidth,H=innerHeight;const out=ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),cs=getComputedStyle(e);
   const cx=r.left+r.width/2,cy=r.top+r.height/2,top=document.elementFromPoint(cx,cy);return{id,ok:cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>8&&r.left>=0&&r.right<=W&&r.top>=0&&r.bottom<=H&&!!top&&e.contains(top)};});
   const ov=(a,b)=>{if(!a||!b)return false;const r=a.getBoundingClientRect(),q=b.getBoundingClientRect();if(!q.width||getComputedStyle(b).display==='none')return false;return r.left<q.right&&q.left<r.right&&r.top<q.bottom&&q.top<r.bottom;};
   const vc=document.getElementById('viewc');return{out,ref:ov(vc,document.getElementById('ref'))};},IDS);
 for(const st of ['plain','settings','ref']){
  if(st==='settings')await p.click('#dSet');if(st==='ref'){await p.click('#dSet');await p.click('#tRef').catch(()=>{});}
  await p.waitForTimeout(400);const g=await geo();const bad=g.out.filter(o=>!o.ok).map(o=>o.id);check(!bad.length,st+': all buttons visible/unclipped/uncovered',bad);if(st==='ref')check(!g.ref,'ref: no overlap with reference window');
  const tips=await p.evaluate(ids=>ids.map(i=>document.getElementById(i).dataset.tip||''),IDS);check(tips.every(t=>t.length>3),'tooltips');}
 await p.evaluate(()=>{document.getElementById('ref')?.classList.remove('open');});
 const V=()=>p.evaluate(()=>({s:paintAPI.view.s,r:paintAPI.view.r,home:paintAPI.isHome(),undo:paintAPI.info().undo,rot:document.getElementById('rotv'),}));
 const S=()=>p.evaluate(()=>({s:paintAPI.view.s,r:paintAPI.view.r,home:paintAPI.isHome(),undo:paintAPI.info().undo,rd:document.getElementById('rotv').disabled,rt:document.getElementById('rotv').textContent,z:document.getElementById('zoomv').textContent}));
 let a=await S();check(a.rd,'straighten disabled when straight',a.rt);
 await p.click('#v100');await p.waitForTimeout(150);a=await S();check(a.z.startsWith('100%'),'1:1 → 100%',a.z);
 await p.click('#vIn');await p.waitForTimeout(150);let c=await S();check(c.s>a.s*1.2,'zoom in',[a.s,c.s]);
 await p.click('#vOut');await p.waitForTimeout(150);c=await S();check(Math.abs(c.s-a.s)<1e-3,'zoom out',c.s);
 await p.click('#vFit');await p.waitForTimeout(150);c=await S();check(c.home,'fit');
 await p.click('#vRR');await p.click('#vRR');await p.waitForTimeout(300);c=await S();check(!c.rd&&/30°/.test(c.rt),'rotate right ×2 → straighten enabled with angle',c.rt);
 await p.click('#vRL');await p.waitForTimeout(300);c=await S();check(/15°/.test(c.rt),'rotate left',c.rt);
 if(w===2191){await p.click('#vRR');await p.waitForTimeout(400);await p.hover('#rotv');await p.waitForTimeout(500);await p.screenshot({path:'screenshot-v0.39-viewbar-desktop.png'});}
 await p.click('#rotv');await p.waitForTimeout(300);c=await S();check(c.r===0&&c.rd,'straighten resets & disables',[c.r,c.rt]);
 const u0=(await S()).undo;const cx=w/2,cy=h/2;await p.mouse.move(cx-100,cy);await p.mouse.down();for(let i=0;i<20;i++)await p.mouse.move(cx-100+i*10,cy+i*3);await p.mouse.up();await p.waitForTimeout(500);
 const u1=(await S()).undo;
 await p.click('#vClr');await p.waitForTimeout(200);check(await p.evaluate(()=>document.getElementById('dlgClear').open),'clear opens confirm sheet');
 await p.click('#clCancel');await p.waitForTimeout(150);check((await S()).undo===u1,'cancel does nothing');
 await p.click('#vClr');await p.click('#clLayer');await p.waitForTimeout(400);const u2=(await S()).undo;check(u2>u1,'clear adds undo step',[u0,u1,u2]);
 await p.keyboard.press('Control+z');await p.waitForTimeout(400);check((await S()).undo<u2,'undo after clear');
 check(!errs.length,'no page errors',errs);await ctx.close();}}
catch(e){console.log('FAIL exception '+e);fails++;}finally{await b.close();}console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
