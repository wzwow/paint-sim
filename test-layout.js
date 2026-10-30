// v0.38/v0.40: unified layout (v0.40: phone uses the same structure, checked at 360x800, 412x915, 915x412) — top bar (file/undo/redo … reference/layers/help/settings), left tool column, side sliders, right colour column, bottom view bar; one Clear. Exit 0 = pass.
const {chromium}=require('playwright');const path=require('path');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{for(const [w,h,mob] of [[2191,1304,0],[1280,800,0],[360,800,1],[412,915,1],[915,412,1]]){console.log('== '+w+'x'+h);
 const ctx=await b.newContext(mob?{viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:w,height:h},deviceScaleFactor:1});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.homeView,null,{timeout:30000});await p.waitForTimeout(900);
 await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 const L=await p.evaluate(mob=>{const V=e=>{if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0?{l:r.left,t:r.top,r:r.right,b:r.bottom}:null;};
  const ids=s=>[...document.querySelectorAll(s)].filter(e=>V(e)).map(e=>e.id);
  const groups=['barL','barR','rail','colc','viewc'];const box=Object.fromEntries(groups.map(g=>[g,V(document.getElementById(g))]));
  const ov=[];for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){const a=box[groups[i]],c=box[groups[j]];if(a&&c&&Math.min(a.r,c.r)-Math.max(a.l,c.l)>1&&Math.min(a.b,c.b)-Math.max(a.t,c.t)>1)ov.push(groups[i]+'×'+groups[j]);}
  const out=groups.filter(g=>{const a=box[g];return !a||a.l<0||a.t<0||a.r>innerWidth+.5||a.b>innerHeight+.5;});
  const clears=['tClr','bClear','vClr','mvClr'].filter(i=>V(document.getElementById(i)));const fits=['tFit','bFit','vFit','mvFit'].filter(i=>V(document.getElementById(i)));
  return{top:ids('#barL .ib'),tools:ids('#barR .ib'),col:ids('#colc .ib'),ov,out,clears,fits,mtop:ids('#mTop .ib'),q:document.querySelectorAll('#qsw button').length};},mob);
 check(!L.ov.length,'main bars do not overlap',L.ov);check(!L.out.length,'main bars on screen',L.out);
 check(L.clears.length===1,'exactly one visible Clear',L.clears);check(L.fits.length===1,'exactly one visible Fit',L.fits);
 const C=s=>mob?p.tap(s):p.click(s);
 if(mob){const hid=await p.evaluate(()=>['tb','mTop','mView'].filter(i=>{const e=document.getElementById(i);return e&&getComputedStyle(e).display!=='none';}));check(!hid.length,'phone-only toolbars gone',hid);}
 {check(JSON.stringify(L.top)===JSON.stringify(['tNew','tExp','bUndo','bRedo','tRef','tLay','tHelp','dSet']),'top bar order',L.top);
  check(JSON.stringify(L.tools)===JSON.stringify(['dBrush','dPencil','dKnife','dPick','dPre','dMed']),'tool column',L.tools);
  check(L.col[0]==='dCol'&&L.q>=(mob&&h<520?3:4),'colour column with quick swatches',L);
  const tb=await p.evaluate(()=>{const a=document.getElementById('barR').getBoundingClientRect(),r=document.getElementById('rail').getBoundingClientRect();return a.right<=r.left||a.bottom<=r.top;});check(tb,'sliders sit beside/below tool column');
  await C('#dPick');await p.waitForTimeout(150);check(await p.evaluate(()=>paintAPI.pickOn()),'eyedropper button starts pick');await p.keyboard.press('Escape');await p.waitForTimeout(150);check(!(await p.evaluate(()=>paintAPI.pickOn())),'Esc cancels pick');
  const c0=await p.evaluate(()=>paintAPI.colour());await C('#qsw button:nth-child(3)');await p.waitForTimeout(150);const c1=await p.evaluate(()=>paintAPI.colour());check(c0!==c1,'quick swatch sets colour',[c0,c1]);
  await C('#dKnife');await p.waitForTimeout(100);check(await p.evaluate(()=>document.getElementById('dKnife').classList.contains('on')),'knife highlighted');await C('#dBrush');
 }
 await C('#tLay');await p.waitForTimeout(mob?1000:500);
 if(!mob)check(await p.evaluate(()=>{const a=document.getElementById('panel').getBoundingClientRect(),c=document.getElementById('colc').getBoundingClientRect();return a.right<=c.left;}),'settings panel clear of colour column');
 {const LY=await p.evaluate(()=>{const e=document.getElementById('layers'),r=e.getBoundingClientRect();return{open:document.getElementById('panel').classList.contains('open'),h:r.height,t:r.top,b:r.bottom,H:innerHeight};});check(LY.open&&LY.h>0&&LY.t<LY.H&&LY.b>0,'Layers button opens settings at the layers list',LY);}
 await p.evaluate(()=>document.getElementById('dClose').click());await p.waitForTimeout(300);
 if(mob)check(await p.evaluate(()=>{const v=document.getElementById('viewc').getBoundingClientRect();const r=[...document.querySelectorAll('#viewc>button')].filter(e=>e.offsetWidth).map(e=>Math.round(e.getBoundingClientRect().top));return new Set(r).size===1&&v.bottom<=innerHeight;}),'phone view bar single row');
 if(w===2191)await p.screenshot({path:'screenshot-v0.40-layout-desktop.png'});if(w===1280)await p.screenshot({path:'screenshot-v0.40-layout-1280.png'});if(w===412)await p.screenshot({path:'screenshot-v0.40-layout-mobile.png'});if(w===360)await p.screenshot({path:'screenshot-v0.40-layout-360.png'});if(w===915)await p.screenshot({path:'screenshot-v0.40-layout-landscape.png'});
 check(!errs.length,'no errors',errs);await ctx.close();}}
catch(e){console.log('FAIL exception '+e);fails++;}finally{await b.close();}console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
