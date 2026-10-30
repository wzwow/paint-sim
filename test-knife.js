// v0.24 palette knife dynamics. Compares the candidate (index.html) with v0.23 (index-v0.23.html + a test-only height probe, written to
// _wip/knife-v023.html). Oil, 512x512, pen-style strokes via paintAPI.stroke. Exit 0 pass / 1 fail / 2 crash.
//  P pressure: Load & lay at pressure .25 vs .9 -> mean layer height; ratio light/hard (v0.24 >= 1.8 and > v0.23 x1.25).
//    Spread over a wet oil layer, hard vs light -> paint pushed aside (height gain just outside the blade ends), hard > light.
//  T twist: Load & lay with blade angle 0 (flat) vs 90 (edge along the stroke) -> mark width; flat/edge >= 2.5 (v0.23 has no blade angle).
//    Pen azimuth: same with tl.phi (no snapping: small tilt only partly applies the azimuth).
//  R run-out: one long Load & lay stroke (size 40) -> painted length; v0.24 >= 1.4x v0.23, and the end fades over >= 6% of the stroke
//    (coverage 20-80%) instead of stopping dead.
//  K pickup: red and blue wet oil bands, knife spread drags through -> colour streaking across the blade after the bands
//    (std of the red-blue difference across the mark), v0.24 >= 1.3x v0.23.
//  Modes: spread, scrape, lay all change the painting; no NaN in the paint buffers; no console/page errors. Writes _wip/knife-*.png.
const {chromium}=require('playwright');const fs=require('fs');
const NEW=process.argv[2]||'index.html';
const PROBE=" olHeight(){const b=new Float32Array(W*H*4);gl.bindFramebuffer(gl.FRAMEBUFFER,OL.r.fb);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,b);const o=new Float32Array(W*H);let nan=0;for(let i=0;i<W*H;i++){const v=b[4*i]+b[4*i+1];if(!isFinite(v))nan++;o[i]=v;}return{h:Array.from(o),nan,W,H};},\n volume(){";
fs.mkdirSync(__dirname+'/_wip',{recursive:true});{let s=fs.readFileSync(__dirname+'/index-v0.23.html','utf8');if(!s.includes('olHeight'))s=s.replace(' volume(){',PROBE);fs.writeFileSync(__dirname+'/_wip/knife-v023.html',s);}
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x===undefined?'':' '+JSON.stringify(x)));if(!c)fails++;};
async function measure(b,file,tag){const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.goto('file://'+__dirname+'/'+file+'?welcome=0&simfull=1');await p.waitForFunction(()=>window.paintAPI,null,{timeout:30000});await p.waitForTimeout(300);
 const r=await p.evaluate(()=>{const A=paintAPI;A.newCanvas(512,512);A.pause(true);let nan=0;
  const ln=(x0,y0,x1,y1,n,pr,tl)=>{const a=[];for(let i=0;i<=n;i++)a.push([x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,pr,14]);return a;};
  const H=()=>{const o=A.olHeight();nan+=o.nan;return o;};
  const knife=(mode,size,kang)=>{A.setTool('knife');A.setKMode(mode);A.setSize(size);if(A.setKAng)A.setKAng(kang||0);};
  const pen=(t,phi)=>({tl:{t,phi,pen:true}});
  const meanIn=(o,x0,x1,y0,y1)=>{let s=0,n=0;for(let y=Math.floor(y0*o.H);y<y1*o.H;y++)for(let x=Math.floor(x0*o.W);x<x1*o.W;x++){s+=o.h[y*o.W+x];n++;}return s/n;};
  const width=(o,xf,y0,y1,thr)=>{let n=0;const x=Math.floor(xf*o.W);for(let y=Math.floor(y0*o.H);y<y1*o.H;y++)if(o.h[y*o.W+x]>thr)n++;return n;};
  const res={};A.setMedium(1,'oil');A.setHex('#c8452a');
  // P: pressure, lay on blank paper
  knife('lay',30);A.stroke(ln(.15,.3,.85,.3,40,.25),.25,pen(0,null));A.stroke(ln(.15,.7,.85,.7,40,.9),.9,pen(0,null));A.step(2);
  let o=H();res.hLight=meanIn(o,.25,.45,.25,.35);res.hHard=meanIn(o,.25,.45,.65,.75);A.clear();A.newCanvas(512,512);A.pause(true);
  // P2: spread over a wet oil layer: paint pushed aside
  const layer=()=>{A.setTool('brush');A.setSize(120);A.setShape('flat');for(let j=0;j<5;j++)A.stroke(ln(.05,.12+j*.19,.95,.12+j*.19,30,.8),.8);A.step(2);};
  A.setHex('#c8452a');layer();o=H();const pre=o.h.slice();
  knife('spread',30);A.stroke(ln(.15,.3,.85,.3,40,.2),.2,pen(0,null));A.stroke(ln(.15,.7,.85,.7,40,.95),.95,pen(0,null));A.step(2);o=H();
  const Lh=30/800*1.05*.9*512*1.15/o.H;const gain=(yc)=>{let s=0,n=0;for(let y=Math.floor((yc-Lh-.05)*o.H);y<(yc+Lh+.05)*o.H;y++){const d=Math.abs(y/o.H-yc);if(d<Lh+.004)continue;for(let x=Math.floor(.3*o.W);x<.5*o.W;x++){const i=y*o.W+x;s+=Math.max(o.h[i]-pre[i],0);n++;}}return s/n;};
  res.pushLight=gain(.3);res.pushHard=gain(.7);A.newCanvas(512,512);A.pause(true);A.setHex('#c8452a');
  // T: blade angle flat vs edge (mouse style: follow + blade angle) and pen azimuth
  knife('lay',30,0);A.stroke(ln(.15,.25,.85,.25,40,.55),.55,{});knife('lay',30,90);A.stroke(ln(.15,.5,.85,.5,40,.55),.55,{});
  knife('lay',30,0);A.stroke(ln(.15,.75,.85,.75,40,.55),.55,pen(.8,Math.PI/2));A.step(2);o=H();const th=.02;
  res.wFlat=width(o,.35,.1,.4,th);res.wEdge=width(o,.35,.4,.62,th);res.wPenEdge=width(o,.35,.63,.9,th);A.newCanvas(512,512);A.pause(true);A.setHex('#c8452a');
  // R: run-out
  knife('lay',40,0);A.stroke(ln(.04,.5,.96,.5,80,.55),.55,{});A.step(2);o=H();
  const cov=[];for(let xi=0;xi<o.W;xi++){let n=0,m=0;for(let y=Math.floor(.43*o.H);y<.57*o.H;y++){m++;if(o.h[y*o.W+xi]>.02)n++;}cov.push(n/m);}
  const cmax=Math.max(...cov.slice(30,80));let last=0,f80=0;for(let xi=0;xi<o.W;xi++){if(cov[xi]>.2*cmax)last=xi;if(cov[xi]>.8*cmax)f80=xi;}
  res.runLen=(last-.04*o.W)/(.92*o.W);res.fade=Math.max(0,last-f80)/(.92*o.W);
  const exR=A.exportData('flat')[0][1].toDataURL('image/png');A.newCanvas(512,512);A.pause(true);
  // K: pickup streaks: two wet bands (red above blue) along the path; each part of the blade should carry its own colour on past them, knife spread through them
  A.setTool('brush');A.setShape('flat');A.setSize(30);A.setHex('#c8202a');A.stroke(ln(.15,.47,.42,.47,30,.8),.8);A.setHex('#2040c0');A.stroke(ln(.15,.53,.42,.53,30,.8),.8);A.step(2);
  knife('spread',34,0);A.stroke(ln(.12,.5,.9,.5,60,.5),.5,pen(0,null));A.step(2);
  const fc=A.exportData('flat')[0][1];const c=document.createElement('canvas');c.width=fc.width;c.height=fc.height;const x=c.getContext('2d');x.drawImage(fc,0,0);const d=x.getImageData(0,0,c.width,c.height).data;
  let sd=0,nc=0;for(let xi=Math.floor(.55*c.width);xi<.75*c.width;xi+=2){const v=[];for(let y=Math.floor(.42*c.height);y<.58*c.height;y++){const i=4*(y*c.width+xi);if(d[i]+d[i+1]+d[i+2]<640)v.push(d[i]-d[i+2]);}
   if(v.length>8){const mu=v.reduce((a,b)=>a+b,0)/v.length;sd+=Math.sqrt(v.reduce((a,b)=>a+(b-mu)*(b-mu),0)/v.length);nc++;}}
  res.streak=nc?sd/nc:0;res.streakCols=nc;const exK=c.toDataURL('image/png');
  // modes all work
  A.newCanvas(512,512);A.pause(true);A.setHex('#2a7f62');layer();const f0=A.exportData('flat')[0][1].toDataURL();const ch={};
  for(const [m,y] of [['spread',.25],['scrape',.5],['lay',.75]]){const b0=A.exportData('flat')[0][1].toDataURL();knife(m,30,0);A.stroke(ln(.2,y,.8,y,30,.6),.6,pen(0,null));A.step(2);ch[m]=A.exportData('flat')[0][1].toDataURL()!==b0;}
  res.modes=ch;H();res.nan=nan;return{res,exR,exK};});
 await p.context().close();fs.writeFileSync(__dirname+`/_wip/knife-run-${tag}.png`,Buffer.from(r.exR.split(',')[1],'base64'));fs.writeFileSync(__dirname+`/_wip/knife-pick-${tag}.png`,Buffer.from(r.exK.split(',')[1],'base64'));
 r.res.errs=errs;return r.res;}
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const o=await measure(b,'_wip/knife-v023.html','old'),n=await measure(b,NEW,'new');await b.close();
 const f=x=>+x.toFixed(4);console.log('v0.23',JSON.stringify(o,(k,v)=>typeof v==='number'?f(v):v));console.log('v0.24',JSON.stringify(n,(k,v)=>typeof v==='number'?f(v):v));
 const pr=n.hLight/n.hHard,po=o.hLight/o.hHard;
 check(pr>=1.8&&pr>=po*1.25,`pressure: light/hard layer height x${pr.toFixed(2)} (v0.23 x${po.toFixed(2)})`);
 check(n.pushHard>n.pushLight*1.15,`hard pressure pushes more paint aside: ${n.pushHard.toFixed(4)} vs light ${n.pushLight.toFixed(4)} (v0.23 ${o.pushHard.toFixed(4)} vs ${o.pushLight.toFixed(4)})`);
 check(n.wFlat>=2.5*Math.max(n.wEdge,1),`blade angle: flat ${n.wFlat}px vs edge ${n.wEdge}px (v0.23 ${o.wFlat} vs ${o.wEdge})`);
 check(n.wPenEdge<=.6*n.wFlat,`pen azimuth along the stroke (tilt .8) cuts a narrow line: ${n.wPenEdge}px vs flat ${n.wFlat}px (v0.23 ${o.wPenEdge})`);
 check(n.runLen>=1.4*o.runLen&&n.runLen>=.8,`run-out: painted length ${(100*n.runLen).toFixed(0)}% of the stroke (v0.23 ${(100*o.runLen).toFixed(0)}%)`);
 check(n.fade>=.06,`run-out end fades over ${(100*n.fade).toFixed(1)}% of the stroke (v0.23 ${(100*o.fade).toFixed(1)}%)`);
 check(n.streak>=1.3*o.streak&&n.streakCols>5,`pickup streaks: across-blade colour std ${n.streak.toFixed(1)} (v0.23 ${o.streak.toFixed(1)})`);
 check(n.modes.spread&&n.modes.scrape&&n.modes.lay,'spread, scrape and load & lay all change the painting',n.modes);
 check(!n.nan,'no NaN/Inf in the paint buffers',n.nan);check(!n.errs.length,'no console/page errors',n.errs.slice(0,3));
 console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
