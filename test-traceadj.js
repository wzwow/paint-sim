// v0.33 trace placement (move / resize / turn) test. Exit 0 = pass. Writes screenshot-v0.33-traceadj-{desktop,mobile}.png
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
const L=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const Q={tl:'#d02020',tr:'#20a040',bl:'#2040d0',br:'#e0c020'};
const IMG=path.join(require('os').tmpdir(),'medium-traceadj-test.png');
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
async function setup(ctx){const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
 await p.addInitScript(()=>{try{localStorage.setItem('seenWelcome','1');}catch(_){}});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.traceAdjust,null,{timeout:60000});await p.waitForTimeout(900);
 await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));await p.evaluate(()=>paintAPI.applyPreset('oilImp'));return{p,errs};}
const info=p=>p.evaluate(()=>paintAPI.refInfo());const tp=p=>p.evaluate(()=>paintAPI.tracePlace());
const painted=p=>p.evaluate(()=>{const o=paintAPI.olHeight();let n=0;for(let i=0;i<o.h.length;i++)if(o.h[i]>.02)n++;return n;});
async function px(p,x,y){const b=await p.screenshot({clip:{x:Math.round(x)-1,y:Math.round(y)-1,width:3,height:3}});
 return await p.evaluate(async d=>{const im=new Image();im.src='data:image/png;base64,'+d;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);const q=g.getImageData(Math.floor(im.width/2),Math.floor(im.height/2),1,1).data;return[q[0],q[1],q[2]];},b.toString('base64'));}
const near=(a,b,t)=>Math.hypot(a[0]-b[0],a[1]-b[1])<(t||3);
const dom=(c,t)=>{const T=rgb(t);const i=T.indexOf(Math.max(...T));return c[i]===Math.max(...c);};
(async()=>{const b=await chromium.launch({args:L});
try{{const ctx=await b.newContext();const p=await ctx.newPage();const d=await p.evaluate(Q=>{const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d');
  g.fillStyle=Q.tl;g.fillRect(0,0,400,300);g.fillStyle=Q.tr;g.fillRect(400,0,400,300);g.fillStyle=Q.bl;g.fillRect(0,300,400,300);g.fillStyle=Q.br;g.fillRect(400,300,400,300);return c.toDataURL('image/png');},Q);
  fs.writeFileSync(IMG,Buffer.from(d.split(',')[1],'base64'));await ctx.close();}
 const D='data:image/png;base64,'+fs.readFileSync(IMG).toString('base64');
 // ---------- desktop ----------
 {const ctx=await b.newContext({viewport:{width:1280,height:800}});const{p,errs}=await setup(ctx);
  await p.evaluate(D=>paintAPI.refLoad(D,'quad'),D);await p.waitForFunction(()=>paintAPI.refInfo().open,null,{timeout:10000});await p.evaluate(()=>paintAPI.refShow(false));
  const t0=await tp(p);check(t0.x===0&&t0.y===0&&t0.s===1&&t0.a===0,'default placement is centred and fitted',t0);
  // settings button starts adjust mode (and turns tracing on)
  await p.evaluate(()=>{document.getElementById('gRef').open=true;if(!document.getElementById('panel').classList.contains('open'))document.getElementById('dSet').click();});await p.waitForTimeout(300);
  check(!(await p.isDisabled('#bTrAdj')),'Move / resize button enabled once there is an image');
  await p.click('#bTrAdj');await p.waitForTimeout(200);check(await p.evaluate(()=>paintAPI.traceAdjOn())&&(await info(p)).trace,'Move / resize turns on adjusting and tracing');
  await p.evaluate(()=>document.getElementById('dSet').click());await p.waitForTimeout(300);
  // drag moves trace; painting paused
  const n0=await painted(p);const c0=await p.evaluate(()=>paintAPI.traceAt(400,300));
  await p.mouse.move(c0[0],c0[1]);await p.mouse.down();for(let k=1;k<=10;k++){await p.mouse.move(c0[0]+k*12,c0[1]+k*6);await p.waitForTimeout(10);}await p.mouse.up();await p.waitForTimeout(300);
  const c1=await p.evaluate(()=>paintAPI.traceAt(400,300));check(near(c1,[c0[0]+120,c0[1]+60],3),'dragging moves the trace with the pointer',{c0,c1});
  check(await painted(p)===n0,'no paint is laid while adjusting');
  // wheel resizes about the pointer: point under pointer stays
  const before=await p.evaluate(()=>paintAPI.traceAt(200,150));await p.mouse.move(before[0],before[1]);await p.mouse.wheel(0,-300);await p.waitForTimeout(250);
  const t1=await tp(p);const after=await p.evaluate(()=>paintAPI.traceAt(200,150));check(t1.s>1.3&&near(before,after,3),'scroll resizes around the pointer',{s:t1.s,before,after});
  await p.keyboard.down('Shift');await p.mouse.wheel(0,100);await p.mouse.wheel(0,100);await p.keyboard.up('Shift');await p.waitForTimeout(250);
  const t2=await tp(p);check(Math.abs(t2.a*180/Math.PI-5)<.6,'Shift+scroll turns the trace 2.5° per notch',t2.a*180/Math.PI);
  // overlay pixels follow new placement
  for(const[u,v,k]of[[200,150,'tl'],[600,450,'br']]){const c=await p.evaluate(([u,v])=>paintAPI.traceAt(u,v),[u,v]);if(c[0]<10||c[1]<70||c[0]>1270||c[1]>730){console.log('skip '+k);continue;}const on=await px(p,c[0],c[1]);check(dom(on,Q[k]),'moved overlay shows '+k+' where expected',on);}
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.33-traceadj-desktop.png')});
  // settings sliders reflect + set
  await p.evaluate(()=>{if(!document.getElementById('panel').classList.contains('open'))document.getElementById('dSet').click();});await p.waitForTimeout(300);
  check((await p.textContent('#refTrSV'))===Math.round(t2.s*100)+'%'&&(await p.textContent('#refTrAV'))==='5°','size and angle sliders show the placement',[await p.textContent('#refTrSV'),await p.textContent('#refTrAV')]);
  await p.evaluate(()=>{const r=document.getElementById('refTrA');r.value=-30;r.dispatchEvent(new Event('input',{bubbles:true}));const s=document.getElementById('refTrS');s.value=80;s.dispatchEvent(new Event('input',{bubbles:true}));});
  const t3=await tp(p);check(Math.abs(t3.a*180/Math.PI+30)<.01&&Math.abs(t3.s-.8)<.001,'angle and size sliders set the placement',t3);
  await p.click('#bTrAdj');await p.waitForTimeout(150);check(!(await p.evaluate(()=>paintAPI.traceAdjOn())),'Done moving ends adjusting');
  await p.evaluate(()=>document.getElementById('dSet').click());await p.waitForTimeout(300);
  // painting works again
  const c=await p.evaluate(()=>paintAPI.traceAt(700,500));await p.mouse.move(c[0],c[1]);await p.mouse.down();for(let k=1;k<=20;k++){await p.mouse.move(c[0]-k*10,c[1]);await p.waitForTimeout(12);}await p.mouse.up();await p.waitForTimeout(400);
  check(await painted(p)>n0,'painting works after Done');
  // Shift+T toggles, Esc ends
  await p.keyboard.press('Shift+T');await p.waitForTimeout(120);const on=await p.evaluate(()=>paintAPI.traceAdjOn());await p.keyboard.press('Escape');await p.waitForTimeout(120);
  check(on&&!(await p.evaluate(()=>paintAPI.traceAdjOn())),'Shift+T starts adjusting, Esc ends it');
  await p.waitForTimeout(600);await p.reload();await p.waitForFunction(()=>window.paintAPI&&paintAPI.refInfo&&paintAPI.refInfo().has,null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(700);
  const t4=await tp(p);check(near([t4.x,t4.y],[t3.x,t3.y],.01)&&Math.abs(t4.s-t3.s)<1e-6&&Math.abs(t4.a-t3.a)<1e-6,'placement restored after reload',t4);
  await p.keyboard.press('Shift+T');await p.waitForTimeout(150);await p.click('#toast button:text("Reset")');await p.waitForTimeout(150);
  const t5=await tp(p);check(t5.x===0&&t5.y===0&&t5.s===1&&t5.a===0&&await p.evaluate(()=>paintAPI.traceAdjOn()),'Reset in the toast restores the fitted placement and keeps adjusting',t5);
  await p.click('#toast button:text("Done")');await p.waitForTimeout(150);check(!(await p.evaluate(()=>paintAPI.traceAdjOn())),'Done in the toast ends adjusting');
  await p.keyboard.press('t');await p.waitForTimeout(100);await p.keyboard.press('Shift+T');await p.waitForTimeout(100);await p.keyboard.press('t');await p.waitForTimeout(100);
  check(!(await p.evaluate(()=>paintAPI.traceAdjOn()))&&!(await info(p)).trace,'turning tracing off also ends adjusting');
  await p.evaluate(()=>paintAPI.refRemove());await p.waitForTimeout(700);
  check(!errs.length,'desktop: no page errors',errs);await ctx.close();}
 // ---------- mobile: one-finger drag + two-finger pinch/twist via CDP ----------
 {const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});const{p,errs}=await setup(ctx);
  await p.evaluate(D=>paintAPI.refLoad(D,'quad'),D);await p.waitForFunction(()=>paintAPI.refInfo().open,null,{timeout:10000});await p.evaluate(()=>paintAPI.refShow(false));
  await p.evaluate(()=>paintAPI.refTrace(true));await p.waitForTimeout(200);
  // via toast button on trace button
  await p.evaluate(()=>paintAPI.refTrace(false));await p.evaluate(()=>paintAPI.refShow(true));await p.tap('#refTr');await p.waitForTimeout(200);
  const hasBtn=await p.isVisible('#toast button:text("Move / resize")');check(hasBtn,'mobile: tracing-on toast offers Move / resize');
  if(hasBtn)await p.tap('#toast button:text("Move / resize")');else await p.evaluate(()=>paintAPI.traceAdjust(true));await p.waitForTimeout(200);
  await p.evaluate(()=>paintAPI.refShow(false));await p.waitForTimeout(150);
  check(await p.evaluate(()=>paintAPI.traceAdjOn()),'mobile: adjusting on');
  const cdp=await ctx.newCDPSession(p);const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((q,i)=>({x:q[0],y:q[1],id:i}))});
  const n0=await painted(p);const a=await p.evaluate(()=>paintAPI.traceAt(400,300));
  await T('touchStart',[a]);for(let k=1;k<=8;k++){await T('touchMove',[[a[0]+k*5,a[1]+k*5]]);await p.waitForTimeout(16);}await T('touchEnd',[]);await p.waitForTimeout(250);
  const a1=await p.evaluate(()=>paintAPI.traceAt(400,300));check(near(a1,[a[0]+40,a[1]+40],3),'mobile: one-finger drag moves the trace',{a,a1});
  const s0=(await tp(p)).s;const cx=195,cy=420;
  await T('touchStart',[[cx-40,cy],[cx+40,cy]]);for(let k=1;k<=10;k++){const r=40+k*6,an=k*2*Math.PI/180;await T('touchMove',[[cx-r*Math.cos(an),cy-r*Math.sin(an)],[cx+r*Math.cos(an),cy+r*Math.sin(an)]]);await p.waitForTimeout(16);}await T('touchEnd',[]);await p.waitForTimeout(250);
  const t=await tp(p);check(Math.abs(t.s/s0-2.5)<.1,'mobile: pinch resizes the trace (not the view)',{ratio:t.s/s0});check(Math.abs(t.a*180/Math.PI-20)<1.5,'mobile: twist turns the trace',t.a*180/Math.PI);
  check(await painted(p)===n0,'mobile: no paint laid while adjusting');
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.33-traceadj-mobile.png')});
  await p.tap('#toast button:text("Done")');await p.waitForTimeout(150);check(!(await p.evaluate(()=>paintAPI.traceAdjOn())),'mobile: Done ends adjusting');
  check(!errs.length,'mobile: no page errors',errs);await ctx.close();}
}catch(e){console.log('FAIL exception '+(e.stack||e));fails++;}
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
