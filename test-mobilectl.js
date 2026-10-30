// v0.29/v0.40 mobile canvas controls test (v0.40: phone uses the desktop view bar #viewc; zoom/rotate run in landscape, portrait checks single row at 360/390/412). Exit 0 = pass. Writes screenshot-v0.29-mobile-controls.png, screenshot-v0.29-clear-confirm.png
const {chromium}=require('playwright');const path=require('path');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:3,hasTouch:true,isMobile:true});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));
 await p.addInitScript(()=>{try{localStorage.setItem('seenWelcome','1');}catch(_){}});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.clearLayer,null,{timeout:60000});await p.waitForTimeout(900);
 // dismiss welcome / any dialog
 await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 const V=()=>p.evaluate(()=>({s:paintAPI.view.s,r:paintAPI.view.r,dpr:devicePixelRatio,home:paintAPI.isHome(),undo:paintAPI.info().undo}));
 const deg=r=>Math.round(r*180/Math.PI);
 const st=await p.evaluate(()=>['tb','mTop','mView'].map(id=>{const e=document.getElementById(id);return e?getComputedStyle(e).display:'none';}));check(st.every(d=>d==='none'),'v0.40: phone-only toolbars removed (tb/mTop/mView hidden)',st);
 const box=await p.evaluate(()=>{const R=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height,b:r.bottom,r:r.right};};return{mv:R('viewc'),barL:R('barL'),barR:R('barR'),rail:R('rail'),colc:R('colc'),btn:[...document.querySelectorAll('#viewc>button')].filter(e=>e.offsetWidth).map(e=>{const r=e.getBoundingClientRect();return[e.id,r.width,r.height,Math.round(r.top)];})};});
 check(box.mv.w>0&&box.mv.y>=box.barL.b&&box.mv.b<=390&&box.mv.x>=0&&box.mv.r<=844,'view bar visible, below top bar, on screen',box.mv);
 check(box.btn.every(([i,w,h])=>w>=40&&h>=44),'targets ~44px',box.btn);check(new Set(box.btn.map(x=>x[3])).size===1,'view bar is a single row',box.btn);
 check(['barR','rail','colc'].every(k=>box[k].w>0&&box[k].b<=box.mv.y+1&&box[k].y>=box.barL.b-1),'tool column, sliders and colour column visible between bars',box);
 const v0=await V();
 await p.tap('#vIn');await p.waitForTimeout(100);let a=await V();check(a.s>v0.s*1.2,'zoom in',[v0.s,a.s]);
 await p.tap('#vOut');await p.tap('#vOut');await p.waitForTimeout(100);let c=await V();check(c.s<a.s/1.4,'zoom out',[a.s,c.s]);
 await p.tap('#v100');await p.waitForTimeout(100);c=await V();check(Math.abs(c.s-c.dpr)<.01,'1:1 = 100%',c.s);
 await p.tap('#vRR');await p.waitForTimeout(100);c=await V();check(deg(c.r)===-15,'rotate right',deg(c.r));
 await p.tap('#vRL');await p.tap('#vRL');await p.tap('#vRL');await p.waitForTimeout(350);c=await V();check(deg(c.r)===30,'rotate left x3',deg(c.r));
 const rt=await p.textContent('#rotv');check(rt==='-30°','angle button shows -30° (matches zoom chip)',rt);
 await p.tap('#vFit');await p.waitForTimeout(150);c=await V();check(c.home&&c.r===0,'fit restores home view',c);
 await p.tap('#vRR');await p.tap('#vRR');await p.waitForTimeout(100);await p.tap('#rotv');await p.waitForTimeout(100);c=await V();check(Math.abs(c.r)<1e-6,'straighten resets rotation',c.r);
 // paint a stroke under rotation, check it lands under the finger
 await p.tap('#vRR');await p.tap('#vRR');await p.waitForTimeout(100);
 await p.evaluate(()=>paintAPI.applyPreset('oilImp'));
 const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:0,radiusX:4,radiusY:4,force:.5}]});
 const stroke=async(x0,y0,x1,y1)=>{await T('touchStart',x0,y0);for(let i=1;i<=20;i++){await T('touchMove',x0+(x1-x0)*i/20,y0+(y1-y0)*i/20);await p.waitForTimeout(16);}await T('touchEnd');await p.waitForTimeout(400);};
 await stroke(370,200,470,200);
 const uvAt=(x,y)=>p.evaluate(([x,y])=>{const c=document.getElementById('c'),r=c.getBoundingClientRect(),d=c.width/r.width,v=paintAPI.view,px=(x-r.left)*d,py=(r.bottom-y)*d,C=Math.cos(v.r),S=Math.sin(v.r),qx=(px-v.ox)/v.s,qy=(py-v.oy)/v.s;return[C*qx+S*qy,-S*qx+C*qy];},[x,y]);
 const hAt=async(x,y)=>{const[u,v]=await uvAt(x,y);return p.evaluate(([u,v])=>{const o=paintAPI.olHeight();let m=0;const X=Math.round(u),Y=Math.round(v);for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const xx=X+dx,yy=Y+dy;if(xx>=0&&yy>=0&&xx<o.W&&yy<o.H)m=Math.max(m,o.h[yy*o.W+xx],o.h[(o.H-1-yy)*o.W+xx]);}return m;},[u,v]);};
 const hMid=await hAt(420,200),hOff=await hAt(420,320);check(hMid>.02&&hOff<.02,'stroke lands under the finger on rotated view',[hMid,hOff]);
 await p.waitForTimeout(300);await p.screenshot({path:path.join(__dirname,'screenshot-v0.29-mobile-controls.png')});
 const painted=()=>p.evaluate(()=>{const o=paintAPI.olHeight();let n=0;for(let i=0;i<o.h.length;i++)if(o.h[i]>.02)n++;return n;});
 const n0=await painted();check(n0>50,'has paint',n0);
 // cancel
 await p.tap('#vClr');await p.waitForTimeout(200);check(await p.evaluate(()=>document.getElementById('dlgClear').open),'clear opens confirm');
 await p.screenshot({path:path.join(__dirname,'screenshot-v0.29-clear-confirm.png')});
 await p.tap('#clCancel');await p.waitForTimeout(200);check(!(await p.evaluate(()=>document.getElementById('dlgClear').open))&&await painted()===n0,'cancel does nothing');
 await p.tap('#vClr');await p.waitForTimeout(150);await p.tap('#clLayer');await p.waitForTimeout(300);const n1=await painted();check(n1===0,'clear layer clears',n1);
 await p.tap('#bUndo');await p.waitForTimeout(400);const n2=await painted();check(Math.abs(n2-n0)<=n0*.02,'undo restores',[n0,n2]);
 // clear all layers with 2 layers
 const addL=await p.evaluate(()=>{const b=document.getElementById('lAdd');if(b){b.click();return true;}return false;});
 await p.waitForTimeout(200);const L=await p.evaluate(()=>paintAPI.layers().length);
 if(L>1){await p.tap('#vFit');await stroke(370,140,470,140);await p.tap('#vClr');await p.waitForTimeout(150);check(await p.isVisible('#clAll'),'clear all offered with 2 layers');await p.tap('#clAll');await p.waitForTimeout(300);
  const ls=await p.evaluate(()=>paintAPI.layers().map(l=>l.has));check(ls.every(h=>!h)&&await painted()===0,'clear all layers',ls);
  await p.tap('#bUndo');await p.waitForTimeout(400);const ls2=await p.evaluate(()=>paintAPI.layers().map(l=>l.has));check(ls2.some(h=>h),'undo restores layers',ls2);}
 else console.log('NOTE could not add a layer (add-layer button not found), clear-all not exercised',addL);
 // stroke after everything
 await p.tap('#vFit');await p.waitForTimeout(150);const before=await painted();await stroke(360,290,500,290);const after=await painted();check(after>before,'strokes still land after clear/undo',[before,after]);
 for(const [w,h] of [[360,800],[390,844],[412,915]]){const c2=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:3,hasTouch:true,isMobile:true});const q=await c2.newPage();q.on('pageerror',e=>errs.push(''+e));
  await q.addInitScript(()=>{try{localStorage.setItem('seenWelcome','1');}catch(_){}});await q.goto(URL);await q.waitForFunction(()=>window.paintAPI&&paintAPI.clearLayer,null,{timeout:60000});await q.waitForTimeout(700);await q.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
  const g=await q.evaluate(()=>{const els=[...document.querySelectorAll('#barL .ib,#barR .ib,#colc .ib,#qsw button,#rail .vs,#viewc>button')].filter(e=>e.offsetWidth);const r=els.map(e=>{const b=e.getBoundingClientRect();const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return{id:e.id||e.className,l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height,hit:!!hit&&(hit===e||e.contains(hit))};});const ov=[];for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i],c=r[j];if(a.l<c.r-1&&c.l<a.r-1&&a.t<c.b-1&&c.t<a.b-1)ov.push(a.id+'/'+c.id);}
   const vb=r.filter(x=>document.getElementById(x.id)&&document.getElementById(x.id).parentNode.id==='viewc');return{out:r.filter(x=>x.l<0||x.t<0||x.r>innerWidth+.5||x.b>innerHeight+.5||!x.hit).map(x=>x.id),small:r.filter(x=>x.h<44||x.w<38).map(x=>x.id),ov,rows:new Set(vb.map(x=>Math.round(x.t))).size,vb:vb.map(x=>x.id)};});
  check(!g.out.length&&!g.small.length&&!g.ov.length,w+'x'+h+': all controls on screen, clickable, >=44px tall, no overlap',g);check(g.rows===1&&g.vb.includes('vClr')&&g.vb.includes('vFit'),w+'x'+h+': view bar single row incl. Fit and Clear',g.vb);
  await q.tap('#vClr');await q.waitForTimeout(200);check(await q.evaluate(()=>document.getElementById('dlgClear').open),w+': clear opens confirm');await q.tap('#clCancel');await c2.close();}
 check(!errs.length,'no page errors',errs);
}catch(e){console.log('FAIL exception',e);fails++;}finally{await b.close();}
console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
