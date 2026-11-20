// v0.51 blend modes + editing groundwork (Playwright + SwiftShader, headless).
// Usage: node test-blend.js [file] [--old index-v0.50.html]
// 1. Every one of the 18 modes vs a CPU reference (W3C Compositing & Blending formulas) on known flat colours, for: new documents (gamma
//    blend space), old documents (linear for normal/multiply/screen/overlay), opaque and 60 % alpha top layer, top layer live (active) and baked.
// 2. Old files: a v0.50 painting looks pixel-identical in this build for its four modes; a v0.51 file (old modes) opens in v0.50; unknown blend
//    names fall back to normal; v0.51 files keep their blend space + new modes through save/open.
// 3. Undo memory budget: layer textures kept only by undo history are counted and capped (desktop and phone), history still undoes, memory returns.
// 4. editCommit (dry -> bake -> edit -> undo -> record): wet paint is dried, undo restores the wet paint, no texture leak.
// 5. Replay: a recording that changes blend modes mid-painting (and an edit) replays to the same picture; a v0.50 recording still replays.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const args=process.argv.slice(2);const oi=args.indexOf('--old');const OLD=oi>=0?args[oi+1]:'index-v0.50.html';
const NEW=args.find((a,i)=>!a.startsWith('--')&&args[i-1]!=='--old')||'index.html';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
let fails=0,n=0;const check=(c,m,x)=>{n++;console.log((c?'PASS ':'FAIL ')+m+(x===undefined?'':' '+JSON.stringify(x)));if(!c)fails++;};
const SEED=`(()=>{let s=987654321;Math.random=()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};})();`;
const url=(f,q)=>'file://'+path.resolve(__dirname,f)+'?welcome=0'+(q||'');
const MODES=['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','linear-burn','linear-dodge','soft-light','hard-light','difference','exclusion','hue','saturation','color','luminosity'];
// ---- CPU reference ----
const cl=x=>Math.min(1,Math.max(0,x));const lum=c=>.3*c[0]+.59*c[1]+.11*c[2];
function clip(c){const l=lum(c),n=Math.min(...c),x=Math.max(...c);if(n<0)c=c.map(v=>l+(v-l)*l/(l-n));if(x>1)c=c.map(v=>l+(v-l)*(1-l)/(x-l));return c;}
const setLum=(c,l)=>{const d=l-lum(c);return clip(c.map(v=>v+d));};const sat=c=>Math.max(...c)-Math.min(...c);
function setSat(c,s){const mx=Math.max(...c),mn=Math.min(...c);return mx>mn?c.map(v=>(v-mn)*s/(mx-mn)):[0,0,0];}
const sep={multiply:(b,s)=>b*s,screen:(b,s)=>b+s-b*s,overlay:(b,s)=>b<=.5?2*b*s:1-2*(1-b)*(1-s),darken:Math.min,lighten:Math.max,
 'color-dodge':(b,s)=>b===0?0:s>=1?1:Math.min(1,b/(1-s)),'color-burn':(b,s)=>b>=1?1:s<=0?0:1-Math.min(1,(1-b)/s),'linear-burn':(b,s)=>Math.max(0,b+s-1),'linear-dodge':(b,s)=>Math.min(1,b+s),
 'soft-light':(b,s)=>{if(s<=.5)return b-(1-2*s)*b*(1-b);const d=b<=.25?((16*b-12)*b+4)*b:Math.sqrt(b);return b+(2*s-1)*(d-b);},'hard-light':(b,s)=>s<=.5?2*b*s:1-2*(1-b)*(1-s),
 difference:(b,s)=>Math.abs(b-s),exclusion:(b,s)=>b+s-2*b*s};
function Bf(m,b,s){if(sep[m])return b.map((v,i)=>sep[m](v,s[i]));if(m==='hue')return setLum(setSat(s,sat(b)),lum(b));if(m==='saturation')return setLum(setSat(b,sat(s)),lum(b));if(m==='color')return setLum(s,lum(b));return setLum(b,lum(s));}
function ref(m,b,s,bs){if(m==='normal')return s;const lin=!bs&&MODES.indexOf(m)<4;if(lin)return Bf(m,b,s);const g=v=>Math.pow(cl(v),1/2.2);return Bf(m,b.map(g),s.map(g)).map(v=>Math.pow(cl(v),2.2));}
// half-float rounding (the file stores float16)
const f32=new Float32Array(1),u32=new Uint32Array(f32.buffer);
function toHalf(v){f32[0]=v;const x=u32[0],s=(x>>>16)&0x8000;let e=((x>>>23)&0xff)-127+15,m=x&0x7fffff;if(e<=0)return s;if(e>=31)return s|0x7c00;let h=s|(e<<10)|(m>>>13);if(m&0x1000)h++;return h;}
function fromHalf(h){const s=h&0x8000?-1:1,e=(h>>>10)&31,m=h&1023;if(e===0)return s*m*Math.pow(2,-24);if(e===31)return m?NaN:s*Infinity;return s*(1+m/1024)*Math.pow(2,e-15);}
const q=v=>fromHalf(toHalf(v));
const COLS=[[0,0,0],[1,1,1],[.5,.5,.5],[.8,.2,.1],[.1,.6,.3],[.2,.3,.9],[.05,.05,.4],[.9,.85,.2]].map(c=>c.map(q));
const CW=8,GW=64,GH=64; // 8x8 cells of 8 px: columns = bottom colour, rows = top colour
// build a .mpaint (format of saveProjectBytes): gzip('MPNT' + u32 hl + JSON + float16 blocks)
function mpaint(hdr,blocks){let js=JSON.stringify(hdr);if(Buffer.byteLength(js)%2)js+=' ';const hb=Buffer.from(js);const head=Buffer.alloc(8);head.write('MPNT',0);head.writeUInt32LE(hb.length,4);
 const parts=[head,hb];for(const b of blocks)parts.push(Buffer.from(b.buffer,b.byteOffset,b.byteLength));return require('zlib').gzipSync(Buffer.concat(parts));}
function gridFile(mode,{bs,ai,alpha}){const N=GW*GH*4,bot=new Uint16Array(N),top=new Uint16Array(N),z=new Uint16Array(N);
 for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){const i=4*(y*GW+x),b=COLS[Math.floor(x/CW)],s=COLS[Math.floor(y/CW)];for(let k=0;k<3;k++){bot[i+k]=toHalf(b[k]);top[i+k]=toHalf(s[k]*alpha);}bot[i+3]=toHalf(1);top[i+3]=toHalf(alpha);}
 const hdr={app:'medium-paint-proto',version:10,W:GW,H:GH,surface:{type:0,scale:1,ground:'#f7f1e4',show:true},ai,layers:[{name:'bottom',vis:true,op:1,blend:'normal',has:true},{name:'top',vis:true,op:1,blend:mode,has:true}]};if(bs)hdr.bs=1;
 return mpaint(hdr,[bot,z,top,z,z,z,z,z,z,z]);}
async function page(b,file,o={}){const ctx=await b.newContext(Object.assign({viewport:{width:1100,height:800}},o));const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels|favicon|manifest/.test(m.text()))errs.push(m.text());});
 await p.addInitScript(SEED);await p.goto(url(file));await p.waitForFunction(()=>window.paintAPI,null,{timeout:60000});await p.waitForTimeout(500);p.errs=errs;return p;}
const openB=(p,buf)=>p.evaluate(async a=>{await paintAPI.openProjectBytes(new Uint8Array(a));paintAPI.pause(true);paintAPI.render();},Array.from(buf));
const lit=p=>p.evaluate(()=>{const c=paintAPI.exportData('lit')[0][1];return Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);});
function pxdiff(a,b){if(a.length!==b.length)return{size:[a.length,b.length]};let mx=0,s=0,nbig=0;for(let i=0;i<a.length;i+=4){let d=0;for(let k=0;k<3;k++){const e=Math.abs(a[i+k]-b[i+k]);d=Math.max(d,e);}s+=d;if(d>mx)mx=d;if(d>16)nbig++;}return{max:mx,mean:+(s/(a.length/4)).toFixed(3),frac:+(nbig/(a.length/4)).toFixed(5)};}
(async()=>{const b=await chromium.launch({args:ARGS});
 // ================= 1. formulas =================
 const p=await page(b,NEW);
 const info0=await p.evaluate(()=>({modes:paintAPI.blendModes(),bs:paintAPI.blendSpace(),opts:[...document.querySelectorAll('#lblend option')].map(o=>o.value),groups:[...document.querySelectorAll('#lblend optgroup')].map(g=>g.label)}));
 check(info0.modes.length===18&&MODES.every(m=>info0.modes.includes(m))&&MODES.slice(0,4).every((m,i)=>info0.modes[i]===m),'18 blend modes, ids 0-3 unchanged',info0.modes);
 check(info0.opts.length===18&&MODES.every(m=>info0.opts.includes(m))&&info0.groups.join()==='Darken,Lighten,Contrast,Compare,Colour','Layers-tab picker lists all 18 modes in Photoshop-style groups',info0.groups);
 check(info0.bs===1,'a new document uses the gamma blend space',info0.bs);
 const worst={};let total=0,bad=0;
 for(const bs of [1,0])for(const ai of [1,0])for(const alpha of [1,.6]){for(const m of MODES){
  await openB(p,gridFile(m,{bs,ai,alpha}));const px=await p.evaluate(()=>paintAPI.readComposite(0,0,64,64));const sp=await p.evaluate(()=>paintAPI.blendSpace());
  if(sp!==bs){check(false,'file blend space honoured',{bs,sp});}
  let e=0;const aq=q(alpha);for(let r=0;r<8;r++)for(let c=0;c<8;c++){const x=c*CW+4,y=r*CW+4,i=4*(y*GW+x),bb=COLS[c],ss=COLS[r];const B=ref(m,bb,ss,bs);
   for(let k=0;k<3;k++){const want=(1-aq)*bb[k]+aq*B[k];e=Math.max(e,Math.abs(px[i+k]-want));}e=Math.max(e,Math.abs(px[i+3]-1));}
  const key=m;worst[key]=Math.max(worst[key]||0,e);total++;if(e>3e-3){bad++;console.log('   mismatch',m,{bs,ai,alpha,e:+e.toFixed(5)});}}}
 for(const m of MODES)check(worst[m]<=3e-3,'mode '+m+' matches the reference formula (both blend spaces, live + baked layer, alpha 1 / 0.6)',+worst[m].toExponential(2));
 // live vs baked identical
 {let mx=0;for(const m of ['soft-light','hue','color-dodge','overlay']){await openB(p,gridFile(m,{bs:1,ai:1,alpha:.6}));const a=await p.evaluate(()=>paintAPI.readComposite(0,0,64,64));
  await openB(p,gridFile(m,{bs:1,ai:0,alpha:.6}));const c=await p.evaluate(()=>paintAPI.readComposite(0,0,64,64));for(let i=0;i<a.length;i++)mx=Math.max(mx,Math.abs(a[i]-c[i]));}
  check(mx<1e-4,'live (active) layer and baked layer give the same pixels',mx);}
 // gamma vs linear really differ for screen (sanity), not for multiply/normal
 {const g=async(m,bs)=>{await openB(p,gridFile(m,{bs,ai:0,alpha:1}));return p.evaluate(()=>paintAPI.readComposite(0,0,64,64));};
  const d=(a,c)=>a.reduce((s,v,i)=>Math.max(s,Math.abs(v-c[i])),0);const s1=await g('screen',1),s0=await g('screen',0),m1=await g('multiply',1),m0=await g('multiply',0);
  check(d(s1,s0)>.02&&d(m1,m0)<2e-3,'old documents keep linear screen; new documents blend it on display colours (multiply is the same in both)',{screen:+d(s1,s0).toFixed(3),multiply:+d(m1,m0).toExponential(2)});}
 // unknown blend name
 {await openB(p,gridFile('vivid-light',{bs:1,ai:1,alpha:1}));const L=await p.evaluate(()=>paintAPI.layers());check(L[1].blend==='normal'&&p.errs.length===0,'unknown blend name in a file opens as normal, no errors',L[1].blend);}
 // v0.51 round trip with new mode
 {await openB(p,gridFile('color-burn',{bs:1,ai:1,alpha:.6}));const a=await p.evaluate(()=>paintAPI.readComposite(0,0,64,64));
  const bytes=await p.evaluate(async()=>Array.from(await paintAPI.saveProjectBytes()));const hdr=JSON.parse(require('zlib').gunzipSync(Buffer.from(bytes)).subarray(8,8+require('zlib').gunzipSync(Buffer.from(bytes)).readUInt32LE(4)).toString());
  await p.evaluate(()=>paintAPI.newCanvas(200,200));await openB(p,Buffer.from(bytes));const c=await p.evaluate(()=>paintAPI.readComposite(0,0,64,64));const L=await p.evaluate(()=>({l:paintAPI.layers(),bs:paintAPI.blendSpace()}));
  const mx=a.reduce((s,v,i)=>Math.max(s,Math.abs(v-c[i])),0);
  check(hdr.version===10&&hdr.bs===1&&L.bs===1&&L.l[1].blend==='color-burn'&&mx<2e-3,'v0.51 file keeps its blend space and new modes through save/open',{version:hdr.version,bs:hdr.bs,mx});}
 // ================= 2. old files =================
 const old=await page(b,OLD);
 const oldRes=await old.evaluate(async()=>{const A=paintAPI;A.newCanvas(320,240);A.pause(true);const ln=(x0,y0,x1,y1,n)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t]);}return a;};
  A.setMedium(1,'oil');A.selectPig(5);A.setSize(60);A.stroke(ln(.05,.3,.95,.3,30),.8);A.selectPig(2);A.stroke(ln(.05,.65,.95,.7,30),.8);A.step(10);
  A.L.add();A.setMedium(0,'water');A.selectPig(1);A.setSize(70);A.stroke(ln(.3,.05,.35,.95,30),.8);A.step(30);A.L.add();A.setMedium(.6,'acrylic');A.selectPig(3);A.setSize(40);A.stroke(ln(.6,.05,.7,.95,30),.8);A.step(10);A.render();
  A.L.select(1);A.L.blend('overlay');A.L.select(2);A.L.blend('overlay');A.render();const bytes=await A.saveProjectBytes();
  // v0.50 reopens its own file and runs the same blend changes as the v0.51 page below (so both start from the same float16 file)
  await A.openProjectBytes(bytes);A.pause(true);
  const out={};const g=()=>{const c=A.exportData('lit')[0][1];return Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);};
  for(const m of ['overlay','normal','multiply','screen']){if(m!=='overlay'){A.L.select(1);A.L.blend(m);A.L.select(2);A.L.blend(m==='normal'?'overlay':m);}A.render();out[m]=g();}
  return{out,bytes:Array.from(bytes)};});
 await openB(p,Buffer.from(oldRes.bytes));check(await p.evaluate(()=>paintAPI.blendSpace())===0,'a v0.50 file opens in the linear (old) blend space');
 for(const m of ['overlay','normal','multiply','screen']){if(m!=='overlay'){await p.evaluate(m=>{const A=paintAPI;A.L.select(1);A.L.blend(m);A.L.select(2);A.L.blend(m==='normal'?'overlay':m);A.render();},m);}
  else await p.evaluate(()=>{paintAPI.render();});
  // 'overlay' first = exactly the state saved in the file (layer 1 + 2 overlay, layer 2 active)
  const d=pxdiff(await lit(p),oldRes.out[m]);check(d.max<=2,'v0.50 painting with '+m+' layers looks the same as in v0.50',d);}
 // v0.51 file (old modes only) opens in v0.50
 {await p.evaluate(()=>{const A=paintAPI;A.newCanvas(200,150);A.pause(true);A.setMedium(1,'oil');A.stroke([[.1,.5],[.9,.5]],.8);A.L.add();A.stroke([[.5,.1],[.5,.9]],.8);A.L.blend('screen');A.render();});
  const by=await p.evaluate(async()=>Array.from(await paintAPI.saveProjectBytes()));const e0=old.errs.length;await openB(old,Buffer.from(by));
  const L=await old.evaluate(()=>paintAPI.layers());await old.waitForTimeout(300);check(old.errs.length===e0&&L.length===2&&L[1].blend==='screen','a v0.51 file (classic modes) opens in v0.50',{errs:old.errs.slice(e0),L:L.map(l=>l.blend)});}
 // ================= 5b. v0.50 recording still replays =================
 const oldRec=await old.evaluate(async()=>{const A=paintAPI;A.recSetPref(true,true);A.newCanvas(320,240);A.pause(true);const ln=(x0,y0,x1,y1,n)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t]);}return a;};
  A.setMedium(1,'oil');A.selectPig(5);A.setSize(60);A.stroke(ln(.05,.4,.95,.4,30),.8);A.step(10);A.L.add();A.setMedium(1,'oil');A.selectPig(1);A.setSize(70);A.stroke(ln(.4,.05,.45,.95,30),.8);A.step(10);A.L.blend('screen');
  A.selectPig(3);A.stroke(ln(.7,.05,.75,.95,30),.8);A.step(10);A.L.blend('overlay');A.render();return Array.from(await A.saveProjectBytes());});
 await old.context().close();
 // ================= 3. undo memory budget =================
 for(const [vp,o,w,h,k] of [['desktop',{},1600,1200,20],['phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1},1200,900,12]]){
  const q2=await page(b,NEW,o);const r=await q2.evaluate(({w,h,k})=>{const A=paintAPI;A.newCanvas(w,h);A.pause(true);const base=A.info();A.setMedium(1,'oil');A.setSize(80);A.stroke([[.1,.5],[.9,.5]],.8);A.L.add();A.stroke([[.5,.1],[.5,.9]],.8);
   const tr=[];for(let i=0;i<k;i++){A.L.select(i%2);const f=A.info();tr.push({h:f.histTexMB,g:f.gpuMB,u:f.undo});}const f=A.info();
   let un=0;for(let i=0;i<5;i++)if(A.undo())un++;const after=A.info();A.newCanvas(w,h);const back=A.info();return{base,tr,f,un,after,back,coarse:matchMedia('(pointer:coarse)').matches,lb:w*h*(f.sim==='RGBA32F'?32:16)/1e6};},{w,h,k});
  const mxH=Math.max(...r.tr.map(t=>t.h));const kept=Math.floor(r.f.histTexMB/r.lb+1e-6);
  check(mxH<=r.f.texBudgetMB+.1,vp+': layer textures kept by undo history stay under the budget',{maxHistMB:mxH,budgetMB:r.f.texBudgetMB,layerMB:+r.lb.toFixed(1),coarse:r.coarse});
  check(kept>=(vp==='phone'?3:6)&&r.f.undo>=(vp==='phone'?3:6),vp+': history still holds at least '+(vp==='phone'?3:6)+' full-layer steps',{kept,undo:r.f.undo});
  check(r.un===Math.min(5,r.f.undo)&&q2.errs.length===0,vp+': undo still works after trimming',{un:r.un,errs:q2.errs});
  check(Math.abs(r.back.gpuMB-r.base.gpuMB)<=2,vp+': GPU memory returns to the start after a new canvas',{base:r.base.gpuMB,peak:Math.max(...r.tr.map(t=>t.g)),back:r.back.gpuMB});
  if(vp==='desktop'){const old50=r.lb*k;check(r.f.gpuMB<r.base.gpuMB+r.f.texBudgetMB+r.f.undoMB+3*r.lb,'desktop: memory after '+k+' layer switches is bounded (v0.50 would keep ~'+Math.round(old50)+' MB of layer copies)',{gpuMB:r.f.gpuMB});}
  await q2.context().close();}
 // ================= 4. editCommit =================
 {const r=await p.evaluate(()=>{const A=paintAPI;A.newCanvas(512,384);A.pause(true);A.setMedium(0,'water');A.setSize(60);A.selectPig(1);A.stroke([[.1,.5],[.5,.55],[.9,.5]],.8);A.step(5);
   const wet0=A.info().live;const ok=A.editCommit('copy');const i1=A.info();const L1=A.layersInfo();A.undo();const i2=A.info();A.redo();const i3=A.info();
   const g0=A.info();const gm0=g0.gpuMB-g0.undoMB;for(let i=0;i<10;i++)A.editCommit('copy');for(let i=0;i<10;i++)A.undo();A.stroke([[.2,.2],[.3,.3]],.6);A.step(2);const g1=A.info();
   return{wet0,ok,live1:i1.live,has:L1[0].has,live2:i2.live,live3:i3.live,gm0,gm1:g1.gpuMB-g1.undoMB,redo:g1.redo};});
  check(r.wet0>0&&r.ok&&r.live1===0&&r.has,'editCommit dries the wet paint and bakes it into the layer first',r);
  check(r.live2>0&&r.live3===0,'undo of an edit restores the wet paint; redo re-applies it',r);
  check(Math.abs(r.gm1-r.gm0)<=1.5&&r.redo===0,'10 edits + undo-all + new stroke: no texture leak',{before:+r.gm0.toFixed(1),after:+r.gm1.toFixed(1)});}
 // ================= 5. replay =================
 {const pr=await page(b,NEW);
  await pr.evaluate(()=>{const A=paintAPI;A.recSetPref(true,true);A.newCanvas(320,240);A.pause(true);const ln=(x0,y0,x1,y1,n)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t]);}return a;};
   A.setMedium(1,'oil');A.selectPig(5);A.setSize(60);A.stroke(ln(.05,.4,.95,.4,30),.8);A.step(10);A.L.add();A.setMedium(1,'oil');A.selectPig(1);A.setSize(60);A.stroke(ln(.3,.05,.35,.95,30),.8);A.step(6);
   A.L.blend('soft-light');A.selectPig(3);A.stroke(ln(.55,.05,.6,.95,30),.8);A.step(6);A.L.blend('difference');A.L.add();A.setMedium(0,'water');A.selectPig(2);A.setSize(50);A.stroke(ln(.05,.75,.95,.8,30),.8);A.step(10);
   A.L.blend('hue');A.editCommit('copy');A.L.select(1);A.L.blend('color-burn');A.step(4);A.render();});
  const ev=await pr.evaluate(()=>{const r=paintAPI.recExport();return{bs:r.bs,L:r.ev.filter(e=>e[0]==='L'&&e[3]==='blend').map(e=>e[4][0]),X:r.ev.filter(e=>e[0]==='X').length};});
  check(ev.bs===1&&ev.L.join()==='soft-light,difference,hue,color-burn'&&ev.X===1,'recording carries the blend space, every blend change and the edit',ev);
  const rp=async(pp)=>{const L=await pp.evaluate(()=>paintAPI.exportData('lit')[0][1].toDataURL('image/png'));await pp.evaluate(()=>paintAPI.openReplay());
   let t0=Date.now();while(!(await pp.evaluate(()=>paintAPI.replayState().ready))&&Date.now()-t0<60000)await pp.waitForTimeout(200);await pp.selectOption('#rpSpd','64');
   if(!(await pp.evaluate(()=>paintAPI.replayState().playing)))await pp.click('#rpPlay');t0=Date.now();while(!(await pp.evaluate(()=>paintAPI.replayState().done))&&Date.now()-t0<240000)await pp.waitForTimeout(300);
   await pp.evaluate(()=>paintAPI.replaySnap());let R=null;t0=Date.now();while(!(R=await pp.evaluate(()=>paintAPI.replaySnapResult()))&&Date.now()-t0<60000)await pp.waitForTimeout(200);
   const d=await pp.evaluate(async([a,b])=>{const ld=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=s;});const[A,B]=await Promise.all([ld(a),ld(b)]);const c=document.createElement('canvas');c.width=A.width;c.height=A.height;const g=c.getContext('2d');
    g.drawImage(A,0,0);const da=g.getImageData(0,0,c.width,c.height).data;g.clearRect(0,0,c.width,c.height);g.drawImage(B,0,0);const db=g.getImageData(0,0,c.width,c.height).data;let n=0,s=0;for(let i=0;i<da.length;i+=4){const e=Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]);s+=e;if(e>48)n++;}
    return{frac:+(n/(da.length/4)).toFixed(5),mean:+(s/(da.length/4)/3).toFixed(3)};},[L,R&&R.url]);await pp.evaluate(()=>paintAPI.closeReplay());return d;};
  let d=await rp(pr);check(d.frac<0.01&&d.mean<1.5,'replay with blend changes mid-painting reaches the same picture',d);
  await openB(pr,Buffer.from(oldRec));check(await pr.evaluate(()=>paintAPI.blendSpace())===0,'v0.50 recording: opened in the old blend space');
  d=await rp(pr);check(d.frac<0.01&&d.mean<1.5,'a v0.50 recording (screen/overlay) still replays to the same picture',d);
  check(pr.errs.length===0,'replay page: no errors',pr.errs);await pr.context().close();}
 check(p.errs.length===0,'no page or console errors',p.errs);
 await b.close();console.log(`\n${n-fails}/${n} passed`);process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
