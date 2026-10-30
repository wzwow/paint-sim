// v9 headless test: v8 vs v9 memory, timings, undo depth, visual equivalence, v8 project compatibility. Playwright + SwiftShader (CPU GL: timings are relative only).
const {chromium}=require('playwright');const fs=require('fs');
const INIT=`(()=>{let s=987654;Math.random=()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const P=WebGL2RenderingContext.prototype;const unit=new Map();let cu=0;const sz=new Map();window.__gpu={cur:0,peak:0};
const bpp=(gl,f)=>f===gl.RGBA32F?16:f===gl.RGBA16F?8:f===gl.R16F?2:f===gl.R32F?4:4;
const oa=P.activeTexture;P.activeTexture=function(u){cu=u;return oa.call(this,u);};
const ob=P.bindTexture;P.bindTexture=function(t,x){if(t===this.TEXTURE_2D)unit.set(cu,x);return ob.call(this,t,x);};
const oi=P.texImage2D;P.texImage2D=function(...a){if(a.length>=8&&a[1]===0&&typeof a[3]==='number'){const x=unit.get(cu);const b=a[3]*a[4]*bpp(this,a[2]);const old=sz.get(x)||0;sz.set(x,b);__gpu.cur+=b-old;__gpu.peak=Math.max(__gpu.peak,__gpu.cur);}return oi.apply(this,a);};
const od=P.deleteTexture;P.deleteTexture=function(x){const b=sz.get(x);if(b){__gpu.cur-=b;sz.delete(x);}return od.call(this,x);};})();`;
const SIZES=[[1024,768,'1024×768'],[2048,1536,'2048×1536'],[2480,3508,'A4 300dpi 2480×3508'],[4096,4096,'4096×4096']];
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const errs=[];
async function open(file){const p=await b.newPage({viewport:{width:1500,height:900}});await p.addInitScript(INIT);
 p.on('pageerror',x=>errs.push(file+': '+x));p.on('console',m=>{if(m.type()==='error'||/GL_INVALID|GL ERROR/.test(m.text()))if(!/ReadPixels/.test(m.text()))errs.push(file+': '+m.text());});
 await p.goto('file://'+__dirname+'/'+file);await p.waitForTimeout(600);await p.evaluate(()=>{paintAPI.pause(true);window.LN=(x0,y0,x1,y1,n=30)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t+.015*Math.sin(t*4)]);}return a;};});return p;}
// ---- 1. visual equivalence at 1024x768 ----
const PAINT=async p=>p.evaluate(async()=>{const A=paintAPI;A.setSize(60);
 A.setMedium(0);A.setWLoad(.8);[[6,.25],[1,.45],[3,.62]].forEach(([c,y])=>{A.selectPig(c);A.stroke(LN(.06,y,.5,y+.05));});A.step(60);
 A.setMedium(1);A.selectPig(2);A.stroke(LN(.45,.2,.95,.3));A.selectPig(4);A.setShape('flat');A.stroke(LN(.5,.45,.95,.5));A.setShape('round');
 A.setTool('knife');A.selectPig(0);A.stroke(LN(.55,.75,.9,.7));A.setTool('brush');A.step(30);
 A.L.add();A.setMedium(0);A.selectPig(5);A.setSize(80);A.stroke(LN(.2,.85,.8,.15));A.step(60);A.L.blend('multiply');
 A.L.add();A.setMedium(1);A.selectPig(0);A.setSize(25);A.stroke(LN(.1,.1,.9,.9));A.step(20);A.render();
 const o={};for(const k of ['lit','flat'])o[k]=A.exportData(k)[0][1].toDataURL();const by=await A.saveProjectBytes();o.proj=btoa(Array.from(by,c=>String.fromCharCode(c)).join(''));return o;});
const p8=await open('index-v8.html'),p9=await open('index.html');
const r8=await PAINT(p8),r9=await PAINT(p9);
await p8.screenshot({path:'/tmp/v9/ui8.png'});await p9.screenshot({path:'/tmp/v9/ui9.png'});
const diffJS=async(p,a,c)=>p.evaluate(async([a,c])=>{const ld=async u=>{const im=new Image();im.src=u;await im.decode();const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;const g=cv.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,cv.width,cv.height);};
 const A=await ld(a),B=await ld(c);let s=0,mx=0,n8=0;const N=A.width*A.height;const hm=new ImageData(A.width,A.height);
 for(let i=0;i<N;i++){let d=0;for(let k=0;k<3;k++)d=Math.max(d,Math.abs(A.data[4*i+k]-B.data[4*i+k]));s+=d;mx=Math.max(mx,d);if(d>8)n8++;const v=Math.min(255,d*8);hm.data.set([255,255-v,255-v,255],4*i);}
 const cv=document.createElement('canvas');cv.width=A.width;cv.height=A.height;cv.getContext('2d').putImageData(hm,0,0);
 return{mean:+(s/N).toFixed(3),max:mx,pctOver8:+(100*n8/N).toFixed(3),heat:cv.toDataURL()};},[a,c]);
const dLit=await diffJS(p9,r8.lit,r9.lit),dFlat=await diffJS(p9,r8.flat,r9.flat);
console.log('visual diff lit',JSON.stringify({...dLit,heat:undefined}),'flat',JSON.stringify({...dFlat,heat:undefined}));
// composite screenshot: v8 | v9 | diff heat (x8)
const sheet=await p9.evaluate(async([a,c,h])=>{const ld=async u=>{const im=new Image();im.src=u;await im.decode();return im;};const I=[await ld(a),await ld(c),await ld(h)];
 const s=.62,w=1024*s,hh=768*s;const cv=document.createElement('canvas');cv.width=w*3+40;cv.height=hh+50;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);g.font='20px sans-serif';g.fillStyle='#222';
 ['v8','v9','|v8 − v9| × 8 (white = identical)'].forEach((t,i)=>{g.drawImage(I[i],i*(w+20),40,w,hh);g.fillText(t,i*(w+20)+8,26);});return cv.toDataURL();},[r8.lit,r9.lit,dLit.heat]);
fs.writeFileSync('screenshot-v9.png',Buffer.from(sheet.split(',')[1],'base64'));
fs.writeFileSync('/tmp/v9/lit8.png',Buffer.from(r8.lit.split(',')[1],'base64'));fs.writeFileSync('/tmp/v9/lit9.png',Buffer.from(r9.lit.split(',')[1],'base64'));
// ---- 2. v8 project opens in v9 ----
fs.writeFileSync('/tmp/v9/v8-project.mpaint',Buffer.from(r8.proj,'base64'));
const op=await p9.evaluate(async b64=>{const A=paintAPI;A.newCanvas(1024,768);const by=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const h=await A.openProjectBytes(by);A.render();
 return{hdrVersion:h.version,layers:A.layers().map(l=>l.name+'/'+l.blend),flat:A.exportData('flat')[0][1].toDataURL()};},r8.proj);
const dProj=await diffJS(p9,r8.flat,op.flat);console.log('v8 project in v9',JSON.stringify({v:op.hdrVersion,layers:op.layers,...dProj,heat:undefined}));
// keep painting after open + undo works
const after=await p9.evaluate(()=>{const A=paintAPI;A.setMedium(1);A.selectPig(3);A.stroke(LN(.2,.5,.6,.55));A.step(10);const u=A.info().undo;A.undo();A.step(2);return{undoBefore:u,undoAfter:A.info().undo};});console.log('after open',JSON.stringify(after));
await p8.close();await p9.close();
// ---- 3. memory / timing per size ----
const rows=[];
for(const ver of ['index-v8.html','index.html'])for(const [w,h,label] of SIZES){const p=await open(ver);
 const r=await p.evaluate(async([w,h])=>{const A=paintAPI;const sync=()=>A.probe(.5,.5);__gpu.peak=__gpu.cur;
  let res;try{res=A.newCanvas(w,h);}catch(e){res={ok:false,msg:''+e};}if(!res.ok)return{refused:res.msg};
  sync();const allocMB=__gpu.cur/1e6;const sc=Math.sqrt(w*h/(1024*768));
  const T=()=>performance.now();
  // oil stroke
  A.setMedium(1);A.selectPig(3);A.setSize(40*Math.min(sc,2));let t0=T();A.stroke(LN(.1,.4,.9,.45,60));sync();const oilStroke=T()-t0;
  t0=T();A.step(10);sync();const oilStep=(T()-t0)/10;
  // watercolour stroke
  A.setMedium(0);A.selectPig(1);t0=T();A.stroke(LN(.1,.6,.9,.65,60));sync();const wcStroke=T()-t0;
  t0=T();A.step(10);sync();const wcStep=(T()-t0)/10;
  // 30 more short strokes (overlapping, mixed) -> undo depth
  for(let i=0;i<20;i++){A.setMedium(i%2);A.selectPig(1+i%7);const y=.1+.8*((i*.37)%1),x=.1+.6*((i*.61)%1);A.stroke(LN(x,y,x+.2,y+.05,12));A.step(3);}
  sync();A.render();sync();
  // full redraw (render) timing
  t0=T();A.render();sync();const renderMs=T()-t0;
  const inf=A.info();return{allocMB,curMB:__gpu.cur/1e6,peakMB:__gpu.peak/1e6,undo:inf.undo,oilStroke,oilStep,wcStroke,wcStep,renderMs,simIF:inf.IF};},[w,h]).catch(e=>({refused:'page crashed in SwiftShader ('+(''+e).slice(0,60)+')'}));
 rows.push({ver:ver==='index.html'?'v9':'v8',label,...r});console.log(ver,label,JSON.stringify(r));await p.close().catch(()=>{});}
fs.writeFileSync('/tmp/v9/rows.json',JSON.stringify(rows,null,1));
const f=x=>x==null?'–':typeof x==='number'?(x>=100?Math.round(x):x.toFixed(1)):x;
let md=`# v9 performance results (test-v9.js)\n\nHeadless Chromium + **SwiftShader (software GL on CPU)**. Memory = bytes of all live WebGL textures (counted by wrapping texImage2D/deleteTexture; same method for v8 and v9; excludes the screen framebuffer and driver overhead). Timings are CPU-rendered and only meaningful *relative* to each other — a real GPU is typically 10–100× faster.\n\nScenario per size: new canvas → one long oil stroke → 10 sim steps → one long watercolour stroke → 10 steps → 20 short mixed strokes (each + 3 steps).\n\n| Size | Ver | GPU after alloc | GPU after painting | Peak GPU | Undo steps kept | Oil stroke ms | Oil sim step ms | WC stroke ms | WC sim step ms | Full render ms |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
for(const r of rows)md+=r.refused?`| ${r.label} | ${r.ver} | refused: ${r.refused.replace(/\|/g,'/')} |||||||||\n`:`| ${r.label} | ${r.ver} | ${f(r.allocMB)} MB | ${f(r.curMB)} MB | ${f(r.peakMB)} MB | ${r.undo} | ${f(r.oilStroke)} | ${f(r.oilStep)} | ${f(r.wcStroke)} | ${f(r.wcStep)} | ${f(r.renderMs)} |\n`;
md+=`\nVisual equivalence (1024×768, same seeded strokes, 3 layers incl. multiply, oil+knife+watercolour), per-pixel max channel difference 0–255:\n\n| Export | mean | max | % pixels > 8 |\n|---|---|---|---|\n| lit | ${dLit.mean} | ${dLit.max} | ${dLit.pctOver8}% |\n| flat | ${dFlat.mean} | ${dFlat.max} | ${dFlat.pctOver8}% |\n\nv8 project (.mpaint) opened in v9: layers ${op.layers.join(', ')}; flat export vs v8 original: mean ${dProj.mean}, max ${dProj.max}, ${dProj.pctOver8}% px > 8.\n`;
fs.writeFileSync('perf-v9.md',md);
console.log('ERRORS',errs.length?errs.slice(0,10):'none');await b.close();})();
