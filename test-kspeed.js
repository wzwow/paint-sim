// v0.43 palette knife SPEED dynamics. Oil, 512x512, the same straight knife stroke drawn slow (40 ms per 9 px point, ~0.2 px/ms),
// moderate (14 ms, ~0.6 px/ms - what test-knife uses) and fast (3 ms, ~3 px/ms) via paintAPI.stroke's per-point dt. Candidate vs v0.42.
//  Lay (Load & lay, pressure .55, blank paper): mean layer height in the middle of the mark (x .2-.45, before the run-out), and "gaps" = share of the blade's core
//    band with almost no paint. Fast must be thinner (<= .85x slow) and broken (gaps >= slow + .08); moderate must stay like v0.42
//    (height within 12%, gaps within +.04) so ordinary strokes don't change.
//  Spread over a wet layer: paint pushed past the blade ends; v0.42 already pushes more when fast (more sweeps), v0.43 must cut the
//    fast/slow ratio by >= 10% (a fast blade skims).
//  Scrape over a wet layer: paint left in the scraped band, fast >= 1.3x slow (a fast scrape skates over spots, leaving streaks).
//  No NaN, no console/page errors. Writes _wip/kspeed-<tag>.png (top: slow lay, mid: fast lay, bottom: slow | fast scrape). Exit 0/1/2.
const {chromium}=require('playwright');const fs=require('fs');
const NEW=process.argv[2]||'file://'+__dirname+'/index.html',OLD=process.argv[3]||'file://'+__dirname+'/index-v0.42.html';
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x===undefined?'':' '+JSON.stringify(x)));if(!c)fails++;};
async function measure(b,url,tag){const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.goto(url+(url.includes('?')?'&':'?')+'welcome=0&simfull=1');await p.waitForFunction(()=>window.paintAPI,null,{timeout:60000});await p.waitForTimeout(300);
 const r=await p.evaluate(()=>{const A=paintAPI;let nan=0;const res={};
  const ln=(x0,y0,x1,y1,n,pr,dt)=>{const a=[];for(let i=0;i<=n;i++)a.push([x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,pr,dt]);return a;};
  const H=()=>{const o=A.olHeight();nan+=o.nan;return o;};const pen={tl:{t:0,phi:null,pen:true}};
  const knife=(mode,size)=>{A.setTool('knife');A.setKMode(mode);A.setSize(size);if(A.setKAng)A.setKAng(0);};
  const fresh=()=>{A.newCanvas(512,512);A.pause(true);A.setMedium(1,'oil');A.setHex('#c8452a');};
  const Lh=30/800*1.05*.9*512*1.15/512;
  const band=(o,yc,x0,x1,f)=>{const a=[];for(let y=Math.floor((yc-Lh*f)*o.H);y<(yc+Lh*f)*o.H;y++)for(let x=Math.floor(x0*o.W);x<x1*o.W;x++)a.push(o.h[y*o.W+x]);return a;};
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  // lay at three speeds
  fresh();knife('lay',30);const Y={slow:.2,mid:.5,fast:.8},DT={slow:40,mid:14,fast:3};
  for(const k in Y)A.stroke(ln(.12,Y[k],.88,Y[k],40,.55,DT[k]),.55,pen);A.step(2);let o=H();
  for(const k in Y){const a=band(o,Y[k],.2,.45,.6);res['h_'+k]=mean(a);}
  const thr=.15*res.h_slow;for(const k in Y){const a=band(o,Y[k],.2,.45,.6);res['gap_'+k]=a.filter(v=>v<thr).length/a.length;}
  const exL=A.exportData('flat')[0][1].toDataURL('image/png');
  // spread / scrape over a wet layer
  const layer=()=>{A.setTool('brush');A.setSize(120);A.setShape('flat');for(let j=0;j<5;j++)A.stroke(ln(.05,.12+j*.19,.95,.12+j*.19,30,.8,16),.8);A.step(2);};
  for(const m of ['spread','scrape']){fresh();layer();o=H();const pre=o.h.slice();knife(m,30);
   A.stroke(ln(.12,.3,.88,.3,40,.6,40),.6,pen);A.stroke(ln(.12,.7,.88,.7,40,.6,3),.6,pen);A.step(2);o=H();
   if(m==='spread'){const gain=yc=>{let s=0,n=0;for(let y=Math.floor((yc-Lh-.05)*o.H);y<(yc+Lh+.05)*o.H;y++){if(Math.abs(y/o.H-yc)<Lh+.004)continue;for(let x=Math.floor(.3*o.W);x<.6*o.W;x++){const i=y*o.W+x;s+=Math.max(o.h[i]-pre[i],0);n++;}}return s/n;};
    res.push_slow=gain(.3);res.push_fast=gain(.7);}
   else{res.scr_slow=mean(band(o,.3,.3,.62,.5));res.scr_fast=mean(band(o,.7,.3,.62,.5));res.scr_pre=mean(band({h:pre,W:o.W,H:o.H},.3,.3,.62,.5));var exS=A.exportData('flat')[0][1].toDataURL('image/png');}}
  res.nan=nan;return{res,exL,exS};});
 await p.context().close();for(const [k,v] of [['lay',r.exL],['scrape',r.exS]])fs.writeFileSync(__dirname+`/_wip/kspeed-${k}-${tag}.png`,Buffer.from(v.split(',')[1],'base64'));
 r.res.errs=errs;return r.res;}
(async()=>{fs.mkdirSync(__dirname+'/_wip',{recursive:true});
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const o=await measure(b,OLD,'old'),n=await measure(b,NEW,'new');await b.close();
 const f=x=>+x.toFixed(4);console.log('v0.42',JSON.stringify(o,(k,v)=>typeof v==='number'?f(v):v));console.log('new  ',JSON.stringify(n,(k,v)=>typeof v==='number'?f(v):v));
 check(n.h_fast<=.85*n.h_slow,`fast lay is thinner: ${n.h_fast.toFixed(4)} vs slow ${n.h_slow.toFixed(4)} (v0.42 ${o.h_fast.toFixed(4)} vs ${o.h_slow.toFixed(4)})`);
 check(n.gap_fast>=n.gap_slow+.08,`fast lay skips: gaps ${(100*n.gap_fast).toFixed(1)}% vs slow ${(100*n.gap_slow).toFixed(1)}% (v0.42 ${(100*o.gap_fast).toFixed(1)}% vs ${(100*o.gap_slow).toFixed(1)}%)`);
 check(Math.abs(n.h_mid/o.h_mid-1)<=.12&&n.gap_mid<=o.gap_mid+.04,`moderate speed unchanged vs v0.42: height x${(n.h_mid/o.h_mid).toFixed(3)}, gaps ${(100*n.gap_mid).toFixed(1)}% (v0.42 ${(100*o.gap_mid).toFixed(1)}%)`);
 check(n.push_fast/n.push_slow<=.9*o.push_fast/o.push_slow,`fast spread bulldozes less (fast/slow push ratio down >=10% vs v0.42): slow ${n.push_slow.toFixed(4)} vs fast ${n.push_fast.toFixed(4)} (v0.42 slow ${o.push_slow.toFixed(4)} vs fast ${o.push_fast.toFixed(4)})`);
 check(n.scr_fast>=1.3*n.scr_slow,`fast scrape leaves more paint: ${n.scr_fast.toFixed(4)} vs slow ${n.scr_slow.toFixed(4)} of ${n.scr_pre.toFixed(4)} (v0.42 ${o.scr_fast.toFixed(4)} vs ${o.scr_slow.toFixed(4)})`);
 check(!n.nan,'no NaN/Inf in the paint buffers',n.nan);check(!n.errs.length,'no console/page errors',n.errs.slice(0,3));
 console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
