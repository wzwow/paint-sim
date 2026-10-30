// v11.2/v11.3 pen tests: synthetic S-Pen-like PointerEvents with (a) spiky pressure/tilt + jitter at touch-down and
// (b) a realistic lift-off (pressure ramp .6->0 over the last 8 samples, tilt drift, pointerup at pressure 0 at a jumped position).
// Vertical (top->bottom) and diagonal (BL->TR) strokes, oil and watercolour. Painted band width at start/end must not exceed 1.25x mid.
// Mouse strokes (with the lift flick) are measured too and reported.
const {chromium}=require('playwright');
const URL=process.argv[2]||('file://'+__dirname+'/index.html');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:1000,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
await p.goto(URL);await p.waitForFunction(()=>window.paintAPI,null,{timeout:20000});await p.waitForTimeout(500);
const res=await p.evaluate(async()=>{const A=paintAPI;A.setSize(34);A.pause(true);
 const c=document.getElementById('c'),rc=c.getBoundingClientRect(),v=A.view,{W,H}=A.info();const d=c.width/rc.width;
 const scr=(u,w)=>[rc.left+(v.ox+u*W*v.s)/d,rc.bottom-(v.oy+w*H*v.s)/d];
 const R=(()=>{let a=7;return()=>{a=(a*16807)%2147483647;return a/2147483647;};})();
 const out=[];
 const run=(med,name,u0,v0,u1,v1,type)=>{A.clear();A.setMedium(med);const wc=med<.15;
  const ev=(t,u,w,o)=>{const[x,y]=scr(u,w);c.dispatchEvent(new PointerEvent(t,Object.assign({pointerId:7,pointerType:type,isPrimary:true,bubbles:true,clientX:x,clientY:y,buttons:1,button:0,pressure:type==='pen'?.6:.5,tiltX:20,tiltY:-15},o)));};
  const N=40,L8=8;
  if(type==='pen')ev('pointermove',u0-.02,v0-.02,{buttons:0,pressure:0,tiltX:-70,tiltY:80});
  ev('pointerdown',u0,v0,type==='pen'?{pressure:1,tiltX:-80,tiltY:75}:{});
  if(type==='pen'){const sp=[0,1,.02,1,0,.9];for(let i=0;i<6;i++)ev('pointermove',u0+(R()-.5)*.003,v0+(R()-.5)*.003,{pressure:sp[i],tiltX:(R()-.5)*170,tiltY:(R()-.5)*170});}
  for(let i=1;i<=N;i++){const t=i/N;const k=i-(N-L8);const o={};
   if(type==='pen'&&k>0){o.pressure=Math.max(0,.6*(1-k/L8));o.tiltX=20+k*6;o.tiltY=-15-k*5;}
   ev('pointermove',u0+(u1-u0)*t,v0+(v1-v0)*t,o);}
  ev('pointerup',u1+.01,v1+.015,{buttons:0,pressure:0,tiltX:60,tiltY:-60});
  for(let i=0;i<20;i++)A.step(1);
  const Lp=Math.hypot((u1-u0)*W,(v1-v0)*H),dx=(u1-u0)*W/Lp,dy=(v1-v0)*H/Lp,nx=-dy,ny=dx;
  const at=f=>A.band(u0+(u1-u0)*f,v0+(v1-v0)*f,nx,ny,90,wc);
  const mx=fs=>Math.max(...fs.map(at));
  // end: beyond the last sample too (flick/tail region)
  const mid=mx([.45,.5,.55]);
  // fray detector: how far past the last drawn sample does paint (>=3px wide band) extend? The lift-off splay shows up as strands/clumps
  // thrown well beyond the stroke end. Measured in px along the stroke direction.
  let over=0;for(let s=0;s<=120;s+=2){const f=1+s/Lp;if(at(f)>=3)over=s;}const fray=over;
  out.push({name,start:mx([0,.03,.06]),mid,end:mx([.9,.94,.97,1,1.03,1.06,1.1]),fray});};
 for(const [med,mn] of [[1,'oil'],[0,'wc']]){
  run(med,mn+' pen vertical',.4,.8,.4,.3,'pen');run(med,mn+' pen diagonal',.3,.3,.6,.7,'pen');
  run(med,mn+' mouse vertical',.4,.8,.4,.3,'mouse');}
 A.pause(false);return out;});
let bad=[];for(const r of res){const okS=r.start<=r.mid*1.25,okE=r.end<=r.mid*1.25&&r.fray<=16;const pen=/pen/.test(r.name);
 console.log((okS&&okE&&r.mid>8?'PASS ':pen?'FAIL ':'NOTE ')+r.name+' start/mid/end = '+r.start+'/'+r.mid+'/'+r.end+' overshoot past end='+r.fray+'px');if(pen&&!(okS&&okE&&r.mid>8))bad.push(r.name);}
await b.close();if(errs.length)console.log('ERRORS',errs);if(errs.length||bad.length){console.log('FAIL');process.exit(1);}console.log('PASS');})();
