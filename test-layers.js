// v0.17 layer rename + layer-list accessibility test (desktop mouse/keyboard + mobile touch). Exit 0 = pass.
const {chromium}=require('playwright');
const URL=process.argv[2]||('file://'+__dirname+'/index.html');
const VPS=[{name:'desktop',ctx:{viewport:{width:1440,height:900}}},
 {name:'mobile',ctx:{viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true}}];
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c?'':' '+JSON.stringify(x===undefined?'':x)));if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const vp of VPS){console.log('== '+vp.name);const ctx=await b.newContext(vp.ctx);const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI,null,{timeout:30000});await p.waitForTimeout(600);
 const tap=async s=>{if(vp.name==='mobile')await p.tap(s);else await p.click(s);await p.waitForTimeout(250);};
 const names=()=>p.evaluate(()=>paintAPI.layers().map(l=>l.name));
 const active=()=>p.evaluate(()=>{const r=document.querySelector('#layers .ly.on .nm');return r?r.textContent:null;});
 await p.evaluate(()=>{const pn=document.getElementById('panel');if(!pn.classList.contains('open'))document.getElementById(document.body.classList.contains('m')?'tSet':'dSet').click();
  const d=document.getElementById('layers').closest('details');d.open=true;});await p.waitForTimeout(400);
 await p.evaluate(()=>document.getElementById('lRen').scrollIntoView({block:'center'}));await p.waitForTimeout(200);
 await tap('#lAdd');const n0=await names();check(n0.length===2,'add layer',n0);
 // rename via button
 await tap('#lRen');check(await p.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('nmi')),'rename field opens and is focused');
 const tool0=await p.evaluate(()=>document.getElementById('tTool').getAttribute('aria-label'));
 await p.keyboard.press('Control+a');await p.keyboard.type('Sky wash bk');
 check(await p.evaluate(t=>document.getElementById('tTool').getAttribute('aria-label')===t,tool0),'typing b/k in the name does not switch tools');
 await p.keyboard.press('Enter');await p.waitForTimeout(250);
 let n=await names();check(n.includes('Sky wash bk')&&await active()==='Sky wash bk','Enter saves the name',n);
 check(!(await p.$('#layers .nmi')),'field closes after Enter');
 // undo / redo the rename
 await p.evaluate(()=>paintAPI.undo());await p.waitForTimeout(200);n=await names();check(!n.includes('Sky wash bk'),'undo reverts rename',n);
 await p.evaluate(()=>paintAPI.redo());await p.waitForTimeout(200);n=await names();check(n.includes('Sky wash bk'),'redo re-applies rename',n);
 // Escape cancels; blank is ignored; whitespace collapsed; 40-char cap
 await tap('#lRen');await p.keyboard.press('Control+a');await p.keyboard.type('Nope');await p.keyboard.press('Escape');await p.waitForTimeout(200);
 check(await active()==='Sky wash bk','Escape cancels',await active());
 check(await p.evaluate(()=>document.getElementById('panel').classList.contains('open')),'Escape in field leaves panel open');
 await tap('#lRen');await p.keyboard.press('Control+a');await p.keyboard.press('Backspace');await p.keyboard.press('Enter');await p.waitForTimeout(200);
 check(await active()==='Sky wash bk','blank name ignored',await active());
 await tap('#lRen');await p.keyboard.press('Control+a');await p.keyboard.type('  Glaze   two  '+'x'.repeat(60));await p.keyboard.press('Enter');await p.waitForTimeout(200);
 const a2=await active();check(a2&&a2.startsWith('Glaze two x')&&a2.length<=40,'whitespace tidied and 40-char cap',a2);
 // Ctrl+Z inside the field edits text, not the painting
 const nb=(await names()).join('|');await tap('#lRen');await p.keyboard.type('q');await p.keyboard.press('Control+z');await p.waitForTimeout(150);
 check((await names()).join('|')===nb,'Ctrl+Z inside the field does not undo the painting');await p.keyboard.press('Escape');await p.waitForTimeout(150);
 // blur commits
 await tap('#lRen');await p.keyboard.press('Control+a');await p.keyboard.type('Blurred');
 await p.evaluate(()=>document.activeElement.blur());await p.waitForTimeout(200);check(await active()==='Blurred','leaving the field saves',await active());
 if(vp.name==='desktop'){
  // double-click active row, F2 shortcut, keyboard navigation
  const row=await p.$('#layers .ly.on .nm');await row.dblclick();await p.waitForTimeout(200);
  check(!!(await p.$('#layers .nmi')),'double-click opens rename');await p.keyboard.press('Control+a');await p.keyboard.type('Dbl');await p.keyboard.press('Enter');await p.waitForTimeout(200);
  check(await active()==='Dbl','double-click rename saved',await active());
  await p.evaluate(()=>document.activeElement&&document.activeElement.blur());await p.evaluate(()=>{document.getElementById('panel').classList.remove('open');});
  await p.keyboard.press('F2');await p.waitForTimeout(400);check(await p.evaluate(()=>document.getElementById('panel').classList.contains('open')&&!!document.querySelector('#layers .nmi')&&document.activeElement.classList.contains('nmi')),'F2 opens panel and renames active layer');
  await p.keyboard.press('Control+a');await p.keyboard.type('F2 name');await p.keyboard.press('Enter');await p.waitForTimeout(200);check(await active()==='F2 name','F2 rename saved',await active());
  await p.focus('#layers .ly.on');await p.keyboard.press('ArrowDown');await p.waitForTimeout(250);
  check(await p.evaluate(()=>paintAPI.layers().findIndex(l=>l.name===document.querySelector('#layers .ly.on .nm').textContent))===0,'ArrowDown selects the layer below');
  check(await p.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('on')),'focus follows the selected layer');
  await p.keyboard.press('ArrowUp');await p.waitForTimeout(250);check(await active()==='F2 name','ArrowUp selects the layer above',await active());
 }
 // eye is a real button with a label, toggles visibility; touch targets on mobile
 const eye=await p.evaluate(()=>{const e=document.querySelector('#layers .ly.on .eye');const r=e.getBoundingClientRect();return{tag:e.tagName,lab:e.getAttribute('aria-label'),w:r.width,h:r.height};});
 check(eye.tag==='BUTTON'&&/^Hide /.test(eye.lab||''),'eye is a labelled button',eye);
 if(vp.name==='mobile'){check(eye.w>=44&&eye.h>=44,'eye >= 44px on mobile',eye);
  const rb=await p.evaluate(()=>{const r=document.getElementById('lRen').getBoundingClientRect();return{w:r.width,h:r.height};});check(rb.w>=44&&rb.h>=44,'rename button >= 44px on mobile',rb);
  const fs=await p.evaluate(()=>{document.getElementById('lRen').click();const i=document.querySelector('#layers .nmi');const f=i?parseFloat(getComputedStyle(i).fontSize):0;if(i)i.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return f;});
  check(fs>=16,'field font >= 16px on mobile (no zoom-on-focus)',fs);}
 await tap('#layers .ly.on .eye');check(await p.evaluate(()=>!paintAPI.layers()[paintAPI.layers().length-1].vis||paintAPI.layers().some(l=>!l.vis)),'eye hides layer');
 check(await p.evaluate(()=>/^Show /.test(document.querySelector('#layers .ly.on .eye').getAttribute('aria-label'))),'eye label flips to Show');
 await tap('#layers .ly.on .eye');
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll');
 await p.screenshot({path:__dirname+'/screenshot-v0.17-layers-'+vp.name+'.png'});
 // screenshot with field open
 await tap('#lRen');await p.keyboard.press('Control+a');await p.keyboard.type('Underpainting');await p.waitForTimeout(150);
 await p.screenshot({path:__dirname+'/screenshot-v0.17-rename-'+vp.name+'.png'});await p.keyboard.press('Enter');
 check(!errs.length,'no console/page errors',errs);await ctx.close();}
await b.close();console.log(fails?('FAILED '+fails):'ALL PASS');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
