// v0.31 reference image test. Exit 0 = pass. Writes screenshot-v0.31-ref-desktop.png, screenshot-v0.31-ref-mobile.png
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const near=(h,t,d=24)=>{const a=rgb(h),b=rgb(t);return a.every((v,i)=>Math.abs(v-b[i])<=d);};
const L=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const Q={tl:'#d02020',tr:'#20a040',bl:'#2040d0',br:'#e0c020'};
const IMG=path.join(require('os').tmpdir(),'medium-ref-test.png');
async function setup(ctx){const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
 await p.addInitScript(()=>{try{localStorage.setItem('seenWelcome','1');}catch(_){}});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.refInfo,null,{timeout:60000});await p.waitForTimeout(900);
 await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 await p.evaluate(()=>paintAPI.applyPreset('oilImp'));return{p,errs};}
const painted=p=>p.evaluate(()=>{const o=paintAPI.olHeight();let n=0;for(let i=0;i<o.h.length;i++)if(o.h[i]>.02)n++;return n;});
const info=p=>p.evaluate(()=>paintAPI.refInfo());
const col=p=>p.evaluate(()=>paintAPI.colour());
// image pixel -> page coordinates
const at=async(p,ix,iy)=>{const r=await p.evaluate(()=>{const b=document.getElementById('refC').getBoundingClientRect();return[b.left,b.top];});const i=await info(p);return[r[0]+i.ox+ix*i.s,r[1]+i.oy+iy*i.s];};
(async()=>{const b=await chromium.launch({args:L});
try{// make the test PNG (800x600, four flat quadrants + a 1 px white frame)
 {const ctx=await b.newContext();const p=await ctx.newPage();const d=await p.evaluate(Q=>{const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d');
  g.fillStyle=Q.tl;g.fillRect(0,0,400,300);g.fillStyle=Q.tr;g.fillRect(400,0,400,300);g.fillStyle=Q.bl;g.fillRect(0,300,400,300);g.fillStyle=Q.br;g.fillRect(400,300,400,300);return c.toDataURL('image/png');},Q);
  fs.writeFileSync(IMG,Buffer.from(d.split(',')[1],'base64'));await ctx.close();}
 // ---------- desktop ----------
 {const ctx=await b.newContext({viewport:{width:1280,height:800}});const{p,errs}=await setup(ctx);
  check(await p.isVisible('#tRef'),'toolbar reference button visible');
  check(!(await info(p)).has&&!(await p.isVisible('#ref')),'no reference at start');
  const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null),p.click('#tRef')]);
  check(!!fc,'button with no image opens the file chooser');
  if(fc)await fc.setFiles(IMG);else await p.setInputFiles('#refFile',IMG);
  await p.waitForFunction(()=>paintAPI.refInfo().open,null,{timeout:10000});let i=await info(p);
  check(i.has&&i.open&&i.w0===800&&i.h0===600,'image loaded into the reference window',i);
  check(await p.textContent('#refT')==='medium-ref-test','title shows file name',await p.textContent('#refT'));
  check(await p.evaluate(()=>document.getElementById('tRef').classList.contains('on')),'toolbar button shows on');
  const n0=await painted(p);
  // pan
  const ox0=i.ox;const c0=await at(p,400,300);await p.mouse.move(c0[0],c0[1]);await p.mouse.down();await p.mouse.move(c0[0]+40,c0[1]+20,{steps:6});await p.mouse.up();await p.waitForTimeout(150);
  i=await info(p);check(Math.abs(i.ox-ox0-40)<2,'drag pans the image',[ox0,i.ox]);check(await painted(p)===n0,'dragging on the reference does not paint');
  // wheel zoom + fit
  const s0=i.s;const c1=await at(p,200,150);await p.mouse.move(c1[0],c1[1]);await p.mouse.wheel(0,-400);await p.waitForTimeout(150);i=await info(p);check(i.s>s0*1.5,'wheel zooms in',[s0,i.s]);
  const c2=await at(p,200,150);check(Math.hypot(c2[0]-c1[0],c2[1]-c1[1])<2,'zoom keeps the point under the cursor',[c1,c2]);
  await p.click('#refFit');await p.waitForTimeout(100);i=await info(p);check(Math.abs(i.s-s0)<.001,'fit button restores the view',[s0,i.s]);
  await p.mouse.wheel(0,-300);await p.waitForTimeout(100);const cc=await at(p,400,300);await p.mouse.dblclick(cc[0],cc[1]);await p.waitForTimeout(100);i=await info(p);check(Math.abs(i.s-s0)<.001,'double-click fits');
  // pipette button pick
  await p.evaluate(()=>applyHex('#777777',false));
  await p.click('#refPk');check((await info(p)).pick,'pipette button turns pick on');
  let q=await at(p,200,150);await p.mouse.move(q[0],q[1]);await p.waitForTimeout(150);
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.31-ref-desktop.png')});
  await p.mouse.down();await p.mouse.up();await p.waitForTimeout(200);let c=await col(p);
  check(near(c,Q.tl),'pipette picks the red quadrant',c);check(!(await info(p)).pick,'pick mode ends after a pick');check(await painted(p)===n0,'picking does not paint');
  // Alt+click
  q=await at(p,200,450);await p.keyboard.down('Alt');await p.mouse.move(q[0],q[1]);await p.mouse.down();await p.mouse.up();await p.keyboard.up('Alt');await p.waitForTimeout(200);
  c=await col(p);check(near(c,Q.bl),'Alt+click picks the blue quadrant',c);
  // I (main eyedropper) then click on the reference
  await p.keyboard.press('i');await p.waitForTimeout(100);q=await at(p,600,450);await p.mouse.click(q[0],q[1]);await p.waitForTimeout(200);
  c=await col(p);check(near(c,Q.br),'I then click on the reference picks yellow',c);check(!(await p.evaluate(()=>paintAPI.pickOn())),'main pick mode ends');
  // painting with it
  await p.mouse.move(700,560);await p.mouse.down();for(let k=1;k<=20;k++){await p.mouse.move(700+k*12,560);await p.waitForTimeout(12);}await p.mouse.up();await p.waitForTimeout(400);
  check(await painted(p)>n0,'painting still works');
  // move + resize window
  const b0=(await info(p)).box;const hb=await p.locator('#refT').boundingBox();await p.mouse.move(hb.x+10,hb.y+hb.height/2);await p.mouse.down();await p.mouse.move(hb.x+110,hb.y+hb.height/2+50,{steps:5});await p.mouse.up();
  let b1=(await info(p)).box;check(b1.x===b0.x+100&&b1.y===b0.y+50,'title bar drags the window',[b0,b1]);
  const rb=await p.locator('#refRs').boundingBox();await p.mouse.move(rb.x+rb.width/2,rb.y+rb.height/2);await p.mouse.down();await p.mouse.move(rb.x+rb.width/2+80,rb.y+rb.height/2+60,{steps:5});await p.mouse.up();
  b1=(await info(p)).box;check(b1.w===b0.w+80&&b1.h===b0.h+60,'corner resizes the window',b1);
  const hb2=await p.locator('#refT').boundingBox();await p.mouse.move(hb2.x+10,hb2.y+hb2.height/2);await p.mouse.down();await p.mouse.move(5000,5000,{steps:3});await p.mouse.up();b1=(await info(p)).box;check(b1.x===1280-80&&b1.y===800-44,'window cannot be dragged off screen (title bar stays reachable)',b1);{const t=await p.locator('#refT').boundingBox();await p.mouse.move(t.x+5,t.y+t.height/2);await p.mouse.down();await p.mouse.move(400,200,{steps:5});await p.mouse.up();}
  // hide / show via settings
  await p.click('#refX');check(!(await p.isVisible('#ref')),'close hides the window');
  await p.evaluate(()=>{const d=document.getElementById('gRef');d.open=true;if(!document.getElementById('panel').classList.contains('open'))document.getElementById('dSet').click();});await p.waitForTimeout(250);
  check((await p.textContent('#bRefShow'))==='Show'&&(await p.textContent('#refMsg')).includes('800×600'),'settings shows hidden image',await p.textContent('#refMsg'));
  await p.click('#bRefShow');check(await p.isVisible('#ref'),'Show reopens it');
  // persists across reload
  await p.waitForTimeout(600);const keep=await info(p);await p.reload();await p.waitForFunction(()=>window.paintAPI&&paintAPI.refInfo&&paintAPI.refInfo().has,null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(500);
  i=await info(p);check(i.has&&i.open&&i.box&&i.box.x===keep.box.x&&i.box.w===keep.box.w,'reference and window position restored after reload',[keep.box,i.box]);
  // remove + undo
  await p.evaluate(()=>paintAPI.refRemove());check(!(await info(p)).has&&!(await p.isVisible('#ref')),'remove clears it');
  await p.click('#toast button');await p.waitForFunction(()=>paintAPI.refInfo().has,null,{timeout:5000}).catch(()=>{});check((await info(p)).has,'Undo brings it back');
  // drop and paste
  await p.evaluate(()=>paintAPI.refRemove());
  await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=64;c.height=32;const g=c.getContext('2d');g.fillStyle='#10a0a0';g.fillRect(0,0,64,32);const bl=await new Promise(r=>c.toBlob(r,'image/png'));
   const dt=new DataTransfer();dt.items.add(new File([bl],'dropped.png',{type:'image/png'}));document.getElementById('c').dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true}));document.getElementById('c').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
  await p.waitForFunction(()=>paintAPI.refInfo().w0===64,null,{timeout:5000}).catch(()=>{});i=await info(p);check(i.w0===64&&i.open&&i.name==='dropped','dropping an image file makes it the reference',i.name);
  check(near(await p.evaluate(()=>paintAPI.refSampleImg(10,10)),'#10a0a0',4),'dropped image samples right');
  await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=40;c.height=40;const g=c.getContext('2d');g.fillStyle='#a01090';g.fillRect(0,0,40,40);const bl=await new Promise(r=>c.toBlob(r,'image/png'));
   const dt=new DataTransfer();dt.items.add(new File([bl],'image.png',{type:'image/png'}));document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
  await p.waitForFunction(()=>paintAPI.refInfo().w0===40,null,{timeout:5000}).catch(()=>{});i=await info(p);check(i.w0===40&&i.name==='Pasted image','pasting an image makes it the reference',i.name);
  check(!errs.length,'desktop: no page errors',errs);await ctx.close();}
 // ---------- mobile ----------
 {const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});const{p,errs}=await setup(ctx);
  const cdp=await ctx.newCDPSession(p);const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((q,k)=>({x:q[0],y:q[1],id:k,radiusX:4,radiusY:4,force:.5}))});
  check(await p.isVisible('#tRef')&&!(await p.isVisible('#tRefM')),'v0.40: mobile uses the desktop reference button (phone copy hidden)');
  await p.tap('#dSet');await p.waitForTimeout(300);await p.evaluate(()=>{document.getElementById('gRef').open=true;document.getElementById('gRef').scrollIntoView();});await p.waitForTimeout(200);
  check(await p.isVisible('#bRefAdd'),'mobile: Add image in settings');
  const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null),p.tap('#bRefAdd')]);check(!!fc,'mobile: Add image opens the chooser');
  if(fc)await fc.setFiles(IMG);else await p.setInputFiles('#refFile',IMG);await p.waitForFunction(()=>paintAPI.refInfo().open,null,{timeout:10000});await p.waitForTimeout(300);
  check(!(await p.evaluate(()=>document.getElementById('panel').classList.contains('open'))),'mobile: settings drawer closes to show it');
  let i=await info(p);check(i.box.x>=0&&i.box.x+i.box.w<=390&&i.box.y+i.box.h<=844,'mobile: window fits the screen',i.box);
  const sz=await p.evaluate(()=>[...document.querySelectorAll('#refH .ib')].map(e=>{const r=e.getBoundingClientRect();return Math.min(r.width,r.height);}));check(Math.min(...sz)>=44,'mobile: window buttons ≥44 px',sz);
  // pinch zoom
  const s0=i.s;const m=await at(p,400,300);await T('touchStart',[[m[0]-20,m[1]],[m[0]+20,m[1]]]);for(let k=1;k<=8;k++){await T('touchMove',[[m[0]-20-k*5,m[1]],[m[0]+20+k*5,m[1]]]);await p.waitForTimeout(16);}await T('touchEnd',[]);await p.waitForTimeout(150);
  i=await info(p);check(i.s>s0*1.5,'mobile: pinch zooms the reference',[s0,i.s]);await p.tap('#refFit');
  await p.evaluate(()=>applyHex('#777777',false));const n0=await painted(p);
  await p.tap('#refPk');let q=await at(p,600,150);await T('touchStart',[[q[0],q[1]+30]]);await T('touchMove',[[q[0],q[1]+10]]);await T('touchMove',[[q[0],q[1]]]);await p.waitForTimeout(200);
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.31-ref-mobile.png')});await T('touchEnd',[]);await p.waitForTimeout(250);
  const c=await col(p);check(near(c,Q.tr),'mobile: touch pick picks the green quadrant',c);check(await painted(p)===n0,'mobile: picking does not paint');
  check(!errs.length,'mobile: no page errors',errs);await ctx.close();}
}catch(e){console.log('FAIL exception '+(e.stack||e));fails++;}
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
