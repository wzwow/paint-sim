// v0.27 canvas view controls test: bottom view bar (zoom -/+, 100%/fit, rotate), rotation maps strokes correctly, cursor/scissor OK,
// mobile: two-finger twist rotates, plain pinch does not, quick two-finger tap fits; zoom chip on mobile. Exit 0 = pass.
// Usage: node test-view.js [url|file]. Writes screenshot-v0.27-view-{desktop,mobile}.png
const {chromium}=require('playwright');const path=require('path');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
const VPS=[{name:'desktop',ctx:{viewport:{width:1440,height:900}}},{name:'mobile',ctx:{viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true}}];
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{for(const vp of VPS){console.log('== '+vp.name);const mob=vp.name==='mobile';const ctx=await b.newContext(vp.ctx);const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels/.test(m.text()))errs.push(m.text());});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.homeView,null,{timeout:30000});await p.waitForTimeout(900);
 const V=()=>p.evaluate(()=>({s:paintAPI.view.s,ox:paintAPI.view.ox,oy:paintAPI.view.oy,r:paintAPI.view.r,dpr:devicePixelRatio,home:paintAPI.isHome(),undo:paintAPI.info().undo,
  bar:(()=>{const e=document.getElementById('viewc'),r=e.getBoundingClientRect(),cs=getComputedStyle(e);return{vis:cs.display!=='none'&&r.width>0,x:r.left,y:r.top,w:r.width,h:r.height,z:document.getElementById('zoomv').textContent,rot:document.getElementById('rotv').disabled?null:document.getElementById('rotv').textContent};})()}));
 const deg=r=>+(r*180/Math.PI).toFixed(1);
 const v0=await V();check(v0.home&&v0.r===0,'starts fitted and straight',v0);
 await p.evaluate(()=>paintAPI.applyPreset('oilImp'));
 // painted bbox (canvas px, from oil height) after a stroke
 const bbox=()=>p.evaluate(()=>{const o=paintAPI.olHeight();let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<o.H;y++)for(let x=0;x<o.W;x++)if(o.h[y*o.W+x]>.02){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return{x0,y0,x1,y1,W:o.W,H:o.H};});
 // canvas point under a CSS screen point, using the app's own inverse
 const uvAt=(x,y)=>p.evaluate(([x,y])=>{const c=document.getElementById('c'),r=c.getBoundingClientRect(),d=c.width/r.width,v=paintAPI.view,px=(x-r.left)*d,py=(r.bottom-y)*d,C=Math.cos(v.r),S=Math.sin(v.r),qx=(px-v.ox)/v.s,qy=(py-v.oy)/v.s;return[C*qx+S*qy,-S*qx+C*qy];},[x,y]);
 const cdp=mob?await ctx.newCDPSession(p):null;
 const touch=async(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((q,i)=>({x:q[0],y:q[1],id:i,radiusX:4,radiusY:4,force:.5}))});
 const W0=vp.ctx.viewport.width,H0=vp.ctx.viewport.height,cx=W0/2,cy=H0*.48;
 if(!mob){
  check(v0.bar.vis&&Math.abs(v0.bar.x+v0.bar.w/2-cx)<4&&v0.bar.y+v0.bar.h<=H0-4,'view bar shown bottom-centre',v0.bar);
  await p.click('#vIn');await p.waitForTimeout(120);const a=await V();check(a.s>v0.s*1.2&&!a.home,'+ zooms in',[v0.s,a.s,a.bar.z]);
  await p.click('#vOut');await p.click('#vOut');await p.waitForTimeout(120);const b2=await V();check(b2.s<a.s/1.4,'- zooms out',[a.s,b2.s]);
  await p.click('#zoomv');await p.waitForTimeout(120);const c2=await V();check(Math.abs(c2.s-c2.dpr)<.01&&c2.bar.z==='100%','clicking the zoom readout goes to 100%',[c2.s,c2.bar.z]);
  await p.click('#zoomv');await p.waitForTimeout(120);const d2=await V();check(d2.home,'clicking it again fits',d2.bar.z);
  await p.click('#vRR');await p.waitForTimeout(120);const e2=await V();check(Math.abs(deg(e2.r)+15)<.2&&e2.bar.rot==='15°','rotate right button: 15° clockwise, reset chip shows 15°',[deg(e2.r),e2.bar.rot]);
  await p.click('#vRL');await p.click('#vRL');await p.waitForTimeout(120);const f2=await V();check(Math.abs(deg(f2.r)-15)<.2&&f2.bar.rot==='-15°','rotate left button',[deg(f2.r),f2.bar.rot]);
  await p.click('#rotv');await p.waitForTimeout(120);const g2=await V();check(g2.r===0&&g2.bar.rot===null,'reset chip straightens and hides',[g2.r,g2.bar.rot]);
  // rotate 90 deg clockwise, paint a horizontal screen stroke: on the canvas it must run vertically, under the pointer
  for(let i=0;i<6;i++)await p.click('#vRR');await p.waitForTimeout(150);const h2=await V();check(Math.abs(deg(h2.r)+90)<.2,'six clicks = 90°',deg(h2.r));
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.27-view-rot0-desktop.png')});
  const sA=[cx-150,cy],sB=[cx+150,cy],uA=await uvAt(...sA),uB=await uvAt(...sB);
  await p.mouse.move(...sA);await p.mouse.down();for(let i=1;i<=30;i++){await p.mouse.move(sA[0]+(sB[0]-sA[0])*i/30,cy);await p.waitForTimeout(10);}await p.mouse.up();await p.waitForTimeout(700);
  const bb=await bbox();const bw=bb.x1-bb.x0,bh=bb.y1-bb.y0,ex=[Math.min(uA[0],uB[0]),Math.min(uA[1],uB[1]),Math.max(uA[0],uB[0]),Math.max(uA[1],uB[1])];
  check(bh>bw*2.5&&bb.y0<ex[1]+30&&bb.y1>ex[3]-30&&bb.x0<ex[0]+5&&bb.x1>ex[2]-5,'stroke in a 90°-rotated view lands under the pointer (vertical on the canvas)',{bb,expect:ex.map(Math.round)});
  await p.mouse.move(cx,cy+120);await p.waitForTimeout(200);
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.27-view-desktop.png')});
  // a rotated view must still render the whole canvas (scissor) and fit must keep rotation inside the screen
  await p.evaluate(()=>{paintAPI.fit();paintAPI.render();});const i2=await V();
  const corners=await p.evaluate(()=>{const v=paintAPI.view,I=paintAPI.info(),c=document.getElementById('c'),d=c.width/c.getBoundingClientRect().width,C=Math.cos(v.r),S=Math.sin(v.r);return [[0,0],[I.W,0],[0,I.H],[I.W,I.H]].map(([x,y])=>[(v.ox+v.s*(C*x-S*y))/d,(c.height-(v.oy+v.s*(S*x+C*y)))/d]);});
  check(corners.every(q=>q[0]>=0&&q[0]<=W0&&q[1]>=0&&q[1]<=H0)&&Math.abs(deg(i2.r)+90)<.2,'resize-fit keeps the rotation and keeps the rotated canvas on screen',corners.map(q=>q.map(Math.round)));
  await p.keyboard.press('Control+0');await p.waitForTimeout(150);const j2=await V();check(j2.home&&j2.r===0,'Ctrl+0 back to straight fit');
 }else{
  check(v0.bar.vis&&v0.bar.y+v0.bar.h<=844,'v0.40: mobile shows the desktop view bar (always visible, on screen)',v0.bar);
  const twist=async(ang,spread,n=14)=>{const r0=60;await touch('touchStart',[[cx-r0,cy],[cx+r0,cy]]);for(let i=1;i<=n;i++){const t=i/n,a=ang*t*Math.PI/180,r=r0+spread*t;await touch('touchMove',[[cx-r*Math.cos(a),cy-r*Math.sin(a)],[cx+r*Math.cos(a),cy+r*Math.sin(a)]]);await p.waitForTimeout(16);}await touch('touchEnd',[]);await p.waitForTimeout(250);};
  await twist(6,70);const a=await V();check(a.r===0&&a.s>v0.s*1.3&&a.undo===v0.undo,'plain pinch (small 6° wobble) zooms without rotating or painting',{s:[v0.s,a.s],r:deg(a.r)});
  check(a.bar.vis&&/%/.test(a.bar.z),'mobile: zoom chip appears when zoomed',a.bar);
  await twist(40,0);const b2=await V();check(Math.abs(deg(b2.r))>20&&b2.undo===v0.undo,'two-finger twist rotates the view',deg(b2.r));check(/°/.test(b2.bar.z),'chip shows the angle',b2.bar.z);
  await p.screenshot({path:path.join(__dirname,'screenshot-v0.27-view-mobile.png')});
  // stroke while rotated lands under the finger
  const sA=[cx-110,cy+60],sB=[cx+110,cy+60],uA=await uvAt(...sA),uB=await uvAt(...sB);
  await touch('touchStart',[sA]);for(let i=1;i<=24;i++){await touch('touchMove',[[sA[0]+(sB[0]-sA[0])*i/24,sA[1]]]);await p.waitForTimeout(16);}await touch('touchEnd',[]);await p.waitForTimeout(700);
  const bb=await bbox(),mid=[(uA[0]+uB[0])/2,(uA[1]+uB[1])/2];check(bb.x1>0&&Math.abs((bb.x0+bb.x1)/2-mid[0])<40&&Math.abs((bb.y0+bb.y1)/2-mid[1])<40,'rotated-view finger stroke lands under the finger',{bb,mid:mid.map(Math.round)});
  await twist(-36,0);const c2=await V();check(c2.r===0,'twisting back to within 5° snaps straight',deg(c2.r));
  await touch('touchStart',[[cx-50,cy],[cx+50,cy]]);await p.waitForTimeout(60);await touch('touchEnd',[]);await p.waitForTimeout(250);const d2=await V();if(!d2.home)console.log('dbg',await p.evaluate(()=>window.__pp||null));check(d2.home&&d2.undo===c2.undo,'quick two-finger tap fits the canvas and paints nothing',{s:d2.s,home:d2.home});
  await twist(50,40);await p.tap('#zoomv');await p.waitForTimeout(200);const e2=await V();check(e2.home&&e2.r===0,'tapping the chip fits and straightens',e2.home);
 }
 check(!errs.length,'no page errors',errs);await ctx.close();}}catch(e){console.log('CRASH',e);fails++;}
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
