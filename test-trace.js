// v0.32 tracing overlay + mobile reference button test. Exit 0 = pass. Writes screenshot-v0.32-trace-{desktop,mobile}.png
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
const L=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const Q={tl:'#d02020',tr:'#20a040',bl:'#2040d0',br:'#e0c020'};
const IMG=path.join(require('os').tmpdir(),'medium-trace-test.png');
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
async function setup(ctx){const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
 await p.addInitScript(()=>{try{localStorage.setItem('seenWelcome','1');}catch(_){}});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.refInfo&&paintAPI.traceAt,null,{timeout:60000});await p.waitForTimeout(900);
 await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));await p.evaluate(()=>paintAPI.applyPreset('oilImp'));return{p,errs};}
const info=p=>p.evaluate(()=>paintAPI.refInfo());
const painted=p=>p.evaluate(()=>{const o=paintAPI.olHeight();let n=0;for(let i=0;i<o.h.length;i++)if(o.h[i]>.02)n++;return n;});
// screen colour at a client point (screenshot of one css px)
async function px(p,x,y){const b=await p.screenshot({clip:{x:Math.round(x)-1,y:Math.round(y)-1,width:3,height:3}});
 return await p.evaluate(async d=>{const im=new Image();im.src='data:image/png;base64,'+d;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);const q=g.getImageData(Math.floor(im.width/2),Math.floor(im.height/2),1,1).data;return[q[0],q[1],q[2]];},b.toString('base64'));}
// is the screen colour pulled from paper toward target colour t?
const toward=(on,off,t)=>{const T=rgb(t);let ok=0;for(let k=0;k<3;k++){const d=T[k]-off[k];if(Math.abs(d)<40)continue;if(Math.sign(on[k]-off[k])===Math.sign(d)&&Math.abs(on[k]-off[k])>Math.abs(d)*.15)ok++;else return false;}return ok>0;};
(async()=>{const b=await chromium.launch({args:L});
try{{const ctx=await b.newContext();const p=await ctx.newPage();const d=await p.evaluate(Q=>{const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d');
  g.fillStyle=Q.tl;g.fillRect(0,0,400,300);g.fillStyle=Q.tr;g.fillRect(400,0,400,300);g.fillStyle=Q.bl;g.fillRect(0,300,400,300);g.fillStyle=Q.br;g.fillRect(400,300,400,300);return c.toDataURL('image/png');},Q);
  fs.writeFileSync(IMG,Buffer.from(d.split(',')[1],'base64'));await ctx.close();}
 const D='data:image/png;base64,'+fs.readFileSync(IMG).toString('base64');
 // ---------- desktop ----------
 {const ctx=await b.newContext({viewport:{width:1280,height:800}});const{p,errs}=await setup(ctx);
  await p.evaluate(D=>paintAPI.refLoad(D,'quad'),D);await p.waitForFunction(()=>paintAPI.refInfo().open,null,{timeout:10000});await p.evaluate(()=>paintAPI.refShow(false));await p.waitForTimeout(200);
  check(!(await p.isVisible('#trace')),'tracing is off by default');
  const pts=[[200,150,'tl'],[600,150,'tr'],[200,450,'bl'],[600,450,'br']];const off={};
  for(const[u,v,k]of pts){const c=await p.evaluate(([u,v])=>paintAPI.traceAt(u,v),[u,v]);off[k]=await px(p,c[0],c[1]);}
  await p.evaluate(()=>paintAPI.refShow(true));await p.click('#refTr');await p.waitForTimeout(250);
  check((await info(p)).trace&&await p.isVisible('#trace'),'trace button turns tracing on');
  check(await p.evaluate(()=>document.getElementById('refTr').getAttribute('aria-pressed'))==='true','trace button shows pressed');
  await p.evaluate(()=>paintAPI.refShow(false));await p.waitForTimeout(200);
  check((await info(p)).trace&&await p.isVisible('#trace'),'tracing stays on with the window hidden');
  for(const[u,v,k]of pts){const c=await p.evaluate(([u,v])=>paintAPI.traceAt(u,v),[u,v]);const on=await px(p,c[0],c[1]);check(toward(on,off[k],Q[k]),'overlay shows the '+k+' quadrant in the right place',{off:off[k],on});}
  // follows zoom + rotation
  await p.keyboard.press('r');await p.keyboard.press('r');await p.evaluate(()=>paintAPI.zoomStep?paintAPI.zoomStep(1.25):0);await p.mouse.move(640,400);await p.mouse.wheel(0,-200);await p.waitForTimeout(400);
  for(const[u,v,k]of pts){const c=await p.evaluate(([u,v])=>paintAPI.traceAt(u,v),[u,v]);if(c[0]<10||c[1]<70||c[0]>1270||c[1]>730)continue;const on=await px(p,c[0],c[1]);check(toward(on,off[k],Q[k]),'after rotate + zoom, '+k+' still lines up',{on});}
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.32-trace-rotated.png')});
  await p.keyboard.press('Control+0');await p.waitForTimeout(300);
  // opacity slider
  await p.evaluate(()=>{const d=document.getElementById('gRef');d.open=true;if(!document.getElementById('panel').classList.contains('open'))document.getElementById('dSet').click();});await p.waitForTimeout(300);
  check(await p.isChecked('#refTrace'),'settings checkbox shows tracing on');
  await p.evaluate(()=>{const r=document.getElementById('refTrOp');r.value=70;r.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(100);
  check(Math.abs(+(await p.evaluate(()=>getComputedStyle(document.getElementById('trace')).opacity))-.7)<.01&&(await p.textContent('#refTrV'))==='70%','opacity slider sets overlay opacity');
  await p.evaluate(()=>{const r=document.getElementById('refTrOp');r.value=35;r.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.evaluate(()=>document.getElementById('dSet').click());await p.waitForTimeout(300);
  // painting not affected: eyedropper reads the painting, not the overlay; strokes still paint
  const hx=await p.evaluate(()=>paintAPI.pickAt(.25,.75));const hr=rgb(hx);check(hr[0]>200&&hr[1]>200,'eyedropper on the canvas ignores the overlay (samples the paper)',hx);
  const n0=await painted(p);const c=await p.evaluate(()=>paintAPI.traceAt(700,500));await p.mouse.move(c[0],c[1]);await p.mouse.down();for(let k=1;k<=20;k++){await p.mouse.move(c[0]-k*10,c[1]);await p.waitForTimeout(12);}await p.mouse.up();await p.waitForTimeout(400);
  check(await painted(p)>n0,'painting through the overlay works');
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.32-trace-desktop.png')});
  // export does not include it: exported centre pixel of tl quadrant area should be paper
  const ex=await p.evaluate(async()=>{if(!paintAPI.exportCanvas)return null;const c=await paintAPI.exportCanvas();const g=c.getContext('2d');const q=g.getImageData(Math.round(c.width*.3),Math.round(c.height*.3),1,1).data;return[q[0],q[1],q[2]];}).catch(()=>null);
  if(ex)check(ex[1]>180,'export is not tinted by the overlay',ex);else console.log('(no exportCanvas API; export check covered by pickAt)');
  // T key toggles, persists, remove/undo
  await p.keyboard.press('t');await p.waitForTimeout(150);check(!(await info(p)).trace&&!(await p.isVisible('#trace')),'T turns tracing off');
  await p.keyboard.press('t');await p.waitForTimeout(700);
  await p.reload();await p.waitForFunction(()=>window.paintAPI&&paintAPI.refInfo&&paintAPI.refInfo().has,null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(600);
  check((await info(p)).trace&&await p.isVisible('#trace'),'tracing restored after reload');
  await p.evaluate(()=>paintAPI.refRemove());await p.waitForTimeout(150);check(!(await info(p)).trace&&!(await p.isVisible('#trace')),'removing the reference removes the overlay');
  await p.click('#toast button');await p.waitForFunction(()=>paintAPI.refInfo().has,null,{timeout:5000}).catch(()=>{});await p.waitForTimeout(200);check((await info(p)).trace,'Undo brings the overlay back');
  await p.evaluate(()=>paintAPI.refRemove());await p.waitForTimeout(700);
  check(!errs.length,'desktop: no page errors',errs);await ctx.close();}
 // ---------- mobile ----------
 {const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});const{p,errs}=await setup(ctx);
  check(await p.isVisible('#tRef'),'mobile: reference button in the top bar');
  const boxes=await p.evaluate(()=>['tRef','tLay','bUndo','bRedo'].map(i=>{const r=document.getElementById(i).getBoundingClientRect();return[r.left,r.right,r.width,r.height];}).concat([(()=>{const r=document.querySelector('#barL .brand').getBoundingClientRect();return[r.left,r.right];})()]));
  check(boxes.slice(0,4).every(q=>q[2]>=44&&q[3]>=44&&q[1]<=390),'mobile: top buttons ≥44 px and on screen',boxes);check(boxes[4][1]<=Math.min(...boxes.slice(0,4).map(q=>q[0])),'mobile: top-right buttons do not overlap the brand',boxes);
  const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null),p.tap('#tRef')]);check(!!fc,'mobile: reference button with no image opens the chooser');
  if(fc)await fc.setFiles(IMG);else await p.setInputFiles('#refFile',IMG);await p.waitForFunction(()=>paintAPI.refInfo().open,null,{timeout:10000});await p.waitForTimeout(300);
  const hb=await p.evaluate(()=>{const w=document.getElementById('ref').getBoundingClientRect();return[...document.querySelectorAll('#refH .ib')].map(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.right<=w.right+0.5;});});
  check(hb.length===5&&hb.every(Boolean),'mobile: all five window buttons fit and are ≥44 px',hb);
  await p.tap('#refTr');await p.waitForTimeout(250);check((await info(p)).trace,'mobile: trace button turns tracing on');
  await p.tap('#tRef');await p.waitForTimeout(200);check(!(await info(p)).open&&(await info(p)).trace,'mobile: top button hides the window, overlay stays');
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.32-trace-mobile.png')});
  await p.tap('#tRef');await p.waitForTimeout(200);check((await info(p)).open,'mobile: top button shows it again');
  check(!errs.length,'mobile: no page errors',errs);await ctx.close();}
}catch(e){console.log('FAIL exception '+(e.stack||e));fails++;}
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
