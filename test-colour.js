// v0.39: colour quick wins — wheel/square, old vs new, HSB/RGB entry, greyscale value check, quick ring, KM nudges, 18 recents + pinned favourites, phone tabs. Exit 0 = pass.
const {chromium}=require('playwright');const path=require('path');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
const lum=h=>{const n=parseInt(h.slice(1),16);return .2126*(n>>16&255)+.7152*(n>>8&255)+.0722*(n&255);};const rb=h=>{const n=parseInt(h.slice(1),16);return (n>>16&255)-(n&255);};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{for(const [w,h,mob] of [[2191,1304,0],[1280,800,0],[412,915,1]]){console.log('== '+w+'x'+h);
 const ctx=await b.newContext(mob?{viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:w,height:h},deviceScaleFactor:1});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.homeView,null,{timeout:30000});await p.waitForTimeout(900);
 await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 const tap=s=>mob?p.tap(s):p.click(s);const col=()=>p.evaluate(()=>document.getElementById('col').value);
 // KM nudges are real pigment mixes
 const k=await p.evaluate(()=>{const a='#3a7d44';return{l:paintAPI.kmMix(a,'#ffffff',.2),d:paintAPI.kmMix(a,'#202124',.2),w:paintAPI.kmMix(a,'#e0631a',.2),c:paintAPI.kmMix(a,'#1f3a93',.2),by:paintAPI.kmMix('#1f3a93','#f2d02a',.5)};});
 check(lum(k.l)>lum('#3a7d44')&&lum(k.d)<lum('#3a7d44'),'lighter/darker change value',k);check(rb(k.w)>rb('#3a7d44')&&rb(k.c)<rb('#3a7d44'),'warmer/cooler shift temperature',k);
 { const n=parseInt(k.by.slice(1),16);check((n>>8&255)>(n>>16&255)&&(n>>8&255)>(n&255)*0.9,'blue+yellow mixes greenish (subtractive)',k.by);}
 await tap(mob?'#tCol':'#dCol');await p.waitForTimeout(300);
 const vis=s=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&r.width>0&&r.top>=0&&r.bottom<=innerHeight+.5&&r.left>=0&&r.right<=innerWidth+.5;},s);
 check(await vis('#cp'),'picker open and inside viewport');
 const old=await col();
 // wheel
 await tap('#cpMWh');await p.waitForTimeout(200);check(await vis('#cpWh')&&!(await vis('#cpSV')),'wheel replaces square');
 const wb=await p.locator('#cpWh').boundingBox();await p.mouse.click(wb.x+wb.width*.9,wb.y+wb.height/2);await p.waitForTimeout(150);const cw=await col();
 check(cw!==old,'wheel click changes colour',[old,cw]);
 check(await p.evaluate(()=>getComputedStyle(document.getElementById('cpOld')).backgroundColor!==getComputedStyle(document.getElementById('cpPrev')).backgroundColor),'old vs new swatches differ');
 await tap('#cpOld');await p.waitForTimeout(150);check(await col()===old,'old swatch restores colour',[old,await col()]);
 await tap('#cpMSq');await p.waitForTimeout(150);check(await vis('#cpSV'),'square back');
 // numeric
 await p.selectOption('#cpNM','rgb');await p.fill('#cpN0','255');await p.fill('#cpN1','0');await p.fill('#cpN2','0');await p.locator('#cpN2').press('Tab');await p.waitForTimeout(150);check(await col()==='#ff0000','RGB entry',await col());
 await p.selectOption('#cpNM','hsb');await p.waitForTimeout(50);check(await p.inputValue('#cpN0')==='0'&&await p.inputValue('#cpN1')==='100','HSB shows red',[await p.inputValue('#cpN0'),await p.inputValue('#cpN1')]);
 await p.fill('#cpN0','120');await p.locator('#cpN0').press('Tab');await p.waitForTimeout(150);check(await col()==='#00ff00','HSB entry',await col());
 await p.fill('#cpHex','#3a7d44');await p.locator('#cpHex').press('Enter');await p.waitForTimeout(150);
 // nudge buttons
 const c0=await col();await tap('.cpMix button[data-mx=light]');await p.waitForTimeout(100);const c1=await col();check(lum(c1)>lum(c0),'Lighter button',[c0,c1]);
 await tap('.cpMix button[data-mx=warm]');await p.waitForTimeout(100);const c2=await col();check(rb(c2)>rb(c1),'Warmer button',[c1,c2]);
 // pins + recents
 if(mob){await tap('#cpTabs [data-t=saved]');await p.waitForTimeout(150);check(await vis('#cpFav')||await p.evaluate(()=>document.getElementById('cpFav').offsetParent!==null),'Saved tab shows favourites');check(!(await p.evaluate(()=>document.getElementById('cpN0').offsetParent)),'Mix tab hidden on phone');}
 await tap('#cpPin');await p.waitForTimeout(100);check((await p.evaluate(()=>paintAPI.pins()))[0]===c2,'pin current colour');
 await p.evaluate(()=>{for(let i=0;i<25;i++)paintAPI.kmNudge(i%2?'dark':'warm',.05);});const nr=await p.evaluate(()=>paintAPI.recent().length);check(nr===18,'18 recent colours kept',nr);
 check(await p.evaluate(()=>document.querySelectorAll('#cpRec button').length)===18,'18 recent swatches drawn');
 await p.reload();await p.waitForFunction(()=>window.paintAPI&&paintAPI.homeView,null,{timeout:30000});await p.waitForTimeout(600);await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 check((await p.evaluate(()=>[paintAPI.pins()[0],paintAPI.recent().length])).join()===c2+',18','pins and recents persist');
 if(mob){await tap('#tCol');await p.waitForTimeout(300);await tap('#cpTabs [data-t=saved]');await p.waitForTimeout(200);await p.screenshot({path:'screenshot-v0.39-colour-mobile.png'});
  const cpb=await p.evaluate(()=>{const r=document.getElementById('cp').getBoundingClientRect(),t=document.getElementById('tb').getBoundingClientRect();return r.bottom<=t.top+1&&r.top>=0;});check(cpb,'phone picker clear of toolbar');await tap('#cpTabs [data-t=mix]');await p.waitForTimeout(200);await p.screenshot({path:'screenshot-v0.39-colour-mobile-mix.png'});
  await p.evaluate(()=>document.getElementById('cpClose').click());}
 else{await p.click('#dCol');await p.waitForTimeout(300);if(w===2191)await p.screenshot({path:'screenshot-v0.39-colour-desktop.png'});await p.click('#cpClose');}
 // greyscale view only
 const gid=mob?'#mvGrey':'#vGrey';await tap(gid);await p.waitForTimeout(150);check(await p.evaluate(()=>document.body.classList.contains('grey')&&getComputedStyle(document.getElementById('c')).filter.includes('grayscale')),'greyscale toggle on');
await tap(gid);await p.waitForTimeout(100);check(!(await p.evaluate(()=>document.body.classList.contains('grey'))),'greyscale toggle off');
 if(!mob){await p.keyboard.press('Shift+V');check(await p.evaluate(()=>document.body.classList.contains('grey')),'Shift+V toggles');await p.keyboard.press('Shift+V');}
 // quick ring (right-click), no paint
 if(!mob){const before=await p.evaluate(()=>document.getElementById('bUndo').disabled+':'+(paintAPI.info().strokes??''));await p.mouse.click(w/2,h/2,{button:'right'});await p.waitForTimeout(200);
  check(await vis('#ring'),'right-click opens quick ring');const n=await p.evaluate(()=>document.querySelectorAll('#ring button:not(.rm):not(.rc)').length);check(n>=3,'ring shows saved colours',n);
  if(w===2191)await p.screenshot({path:'screenshot-v0.39-ring-desktop.png'});
  const r0=await col();await p.click('#ring button:not(.rm):not(.rc) >> nth=2');await p.waitForTimeout(150);check(await col()!==r0&&!(await vis('#ring')),'ring pick sets colour + closes');
  const after=await p.evaluate(()=>document.getElementById('bUndo').disabled+':'+(paintAPI.info().strokes??''));check(before===after,'right-click did not paint',[before,after]);
  await p.mouse.click(w/2,h/2,{button:'right'});await p.keyboard.press('Escape');await p.waitForTimeout(100);check(!(await vis('#ring')),'Esc closes ring');}
 check(!errs.length,'no errors',errs);await ctx.close();}}
catch(e){console.log('FAIL exception '+e);fails++;}finally{await b.close();}console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
