// v0.28 knife lift-off ridge. Compares index.html (or argv[2]) with index-v0.27.html. Oil 512x512, knife strokes via paintAPI.stroke.
//  For Load & lay on blank paper and Spread over a wet oil layer: height profile across the blade's final position (mean over the middle
//  of the blade) -> ridge = peak near the lift line / mean layer height mid-stroke. New must be >= 1.35 and > old x1.2; crest must be
//  narrow (half-height width <= 8 px). Lift ridge 0% must match old behaviour (ratio within 20%: chatter and travel phase are random per stroke; the 0% path skips the lift pass entirely). Spread volume conserved (within 3%).
//  Taps (no travel) add no ridge (within 15% run-to-run noise). No NaN, no page errors. Writes _wip/lift-*.png (lit renders) for viewing.
const {chromium}=require('playwright');const fs=require('fs');
const NEW=process.argv[2]||'index.html',OLD='index-v0.27.html';
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x===undefined?'':' '+JSON.stringify(x)));if(!c)fails++;};
async function measure(b,file,tag,klift){const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 const url=/^https?:/.test(file)?file+'?welcome=0&simfull=1':'file://'+__dirname+'/'+file+'?welcome=0&simfull=1';
 await p.goto(url);await p.waitForFunction(()=>window.paintAPI,null,{timeout:30000});await p.waitForTimeout(300);
 const r=await p.evaluate((klift)=>{const A=paintAPI;if(A.setKLift&&klift!=null)A.setKLift(klift);A.newCanvas(512,512);A.pause(true);let nan=0;
  const ln=(x0,y0,x1,y1,n,pr)=>{const a=[];for(let i=0;i<=n;i++)a.push([x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,pr,14]);return a;};
  const H=()=>{const o=A.olHeight();nan+=o.nan;return o;};
  const knife=(mode,size)=>{A.setTool('knife');A.setKMode(mode);A.setSize(size);A.setKAng(0);};
  const prof=(o,yc,half,x0,x1)=>{const v=[];for(let x=x0;x<x1;x++){let s=0,n=0;for(let y=Math.floor((yc-half)*o.H);y<(yc+half)*o.H;y++){s+=o.h[y*o.W+x];n++;}v.push(s/n);}return v;};
  const ridge=(o,yc,xe)=>{const xi=Math.round(xe*o.W);const pr=prof(o,yc,.03,xi-24,xi+24);const mid=prof(o,yc,.03,Math.round(.35*o.W),Math.round(.5*o.W));
   const mm=mid.reduce((a,b)=>a+b,0)/mid.length;let pk=0,pi=0;pr.forEach((v,i)=>{if(v>pk){pk=v;pi=i;}});
   let w=0;for(const v of pr)if(v>mm+(pk-mm)*.5)w++;return{ratio:pk/Math.max(mm,1e-6),w,peakAt:pi-24,mid:mm};};
  const res={};A.setMedium(1,'oil');A.setHex('#c8452a');
  knife('lay',30);A.stroke(ln(.15,.3,.7,.3,40,.6),.6,{});A.step(3);let o=H();res.lay=ridge(o,.3,.7);
  // tap: no travel
  const v0=A.volume?A.volume():null;knife('lay',30);A.stroke([[.85,.75,.6,14]],.6,{});A.step(1);o=H();
  {let mx=0;for(let y=Math.floor(.65*o.H);y<.85*o.H;y++)for(let x=Math.floor(.78*o.W);x<.92*o.W;x++)mx=Math.max(mx,o.h[y*o.W+x]);res.tapMax=mx;}
  const lit1=A.exportData('lit')?A.exportData('lit')[0][1].toDataURL('image/png'):null;
  A.newCanvas(512,512);A.pause(true);A.setHex('#2a6fb0');A.setTool('brush');A.setSize(120);A.setShape('flat');
  for(let j=0;j<5;j++)A.stroke(ln(.05,.12+j*.19,.95,.12+j*.19,30,.8),.8);A.step(2);
  const vb=A.volume();knife('spread',30);A.stroke(ln(.15,.6,.7,.6,40,.6),.6,{});A.step(3);const va=A.volume();o=H();res.spread=ridge(o,.6,.7);res.vol=[vb,va];
  const lit2=A.exportData('lit')?A.exportData('lit')[0][1].toDataURL('image/png'):null;
  H();res.nan=nan;return{res,lit1,lit2};},klift);
 await p.context().close();
 for(const [k,d] of [['lay',r.lit1],['spread',r.lit2]])if(d)fs.writeFileSync(__dirname+`/_wip/lift-${k}-${tag}.png`,Buffer.from(d.split(',')[1],'base64'));
 r.res.errs=errs;return r.res;}
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{const N=await measure(b,NEW,'new',100),O=await measure(b,OLD,'old',null),Z=await measure(b,NEW,'off',0);
  console.log(JSON.stringify({N,O,Z}));
  for(const k of ['lay','spread']){check(N[k].ratio>=1.35&&N[k].ratio>O[k].ratio*1.2,k+' ridge at lift line',{new:+N[k].ratio.toFixed(2),old:+O[k].ratio.toFixed(2)});
   check(N[k].w<=8,k+' crest narrow (px above half height)',N[k].w);check(Math.abs(Z[k].ratio/O[k].ratio-1)<.2,k+' Lift ridge 0% = v0.27',{off:+Z[k].ratio.toFixed(2),old:+O[k].ratio.toFixed(2)});}
  const vr=N.vol[1].v/N.vol[0].v,vo=O.vol[1].v/O.vol[0].v;check(Math.abs(vr-vo)<.03,'spread volume conserved vs v0.27',{new:+vr.toFixed(4),old:+vo.toFixed(4)});
  check(Math.abs(N.tapMax-O.tapMax)<=Math.max(.15*O.tapMax,1e-3),'tap adds no ridge',{new:N.tapMax,old:O.tapMax});
  check(N.nan===0&&Z.nan===0,'no NaN',[N.nan,Z.nan]);check(!N.errs.length&&!Z.errs.length,'no page errors',N.errs.concat(Z.errs).slice(0,3));
 }catch(e){console.log('CRASH',e);await b.close();process.exit(2);}
 await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
