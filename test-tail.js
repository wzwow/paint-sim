// v0.21 regression: fast-stroke "flick on lift" tail must not swing sideways (bug: the flick bend was taken from the last 1-2 samples).
// Mouse pointer events with realistic timestamps (based on _wip/tail/repro2.js), oil, size 34, Dynamics default, Follow on, Flick on.
// Strokes go top->bottom: straight fast, fast with a small hook, fast with a 1.2 px sideways last move, slow with drift.
// Metric: tail angle = direction from the stroke end point to the centroid of the paint in the next 70 canvas px past the end
// (0 deg = straight on). Pass: every |angle| <= 25 deg (and straight <= 10). v0.20 fails (tiny-last / slow drift swing the tail).
// usage: node test-tail.js [file.html] [out.png]
const {chromium}=require('playwright');const path=require('path');
const file=process.argv[2]||'index.html',out=process.argv[3];
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:1000,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('file://'+path.resolve(__dirname,file));await p.waitForFunction(()=>window.paintAPI,null,{timeout:30000});await p.waitForTimeout(500);
const res=await p.evaluate(async()=>{const A=paintAPI;A.pause(true);A.clear();A.setMedium(1);A.setHex('#2f5fb0');A.setSize(34);A.setFlick(true);
 const c=document.getElementById('c'),rc=c.getBoundingClientRect(),v=A.view,{W,H}=A.info();const d=c.width/rc.width;
 const scr=(u,w)=>[rc.left+(v.ox+u*W*v.s)/d,rc.bottom-(v.oy+w*H*v.s)/d];
 const toImg=(x,y)=>[((x-rc.left)*d-v.ox)/v.s,H-((rc.bottom-y)*d-v.oy)/v.s];
 let T=performance.now()+1000;
 const ev=(t,x,y,o)=>{const e=new PointerEvent(t,Object.assign({pointerId:1,pointerType:'mouse',isPrimary:true,bubbles:true,clientX:x,clientY:y,buttons:1,button:0,pressure:.5},o));Object.defineProperty(e,'timeStamp',{value:T});c.dispatchEvent(e);};
 const ends=[];
 const stroke=(x0,y0,L,N,dt,drift,tiny)=>{const pts=[];for(let i=0;i<=N;i++)pts.push([x0,y0+L*i/N]);
  for(let k=0;k<drift.length;k++)pts[N-drift.length+1+k][0]+=drift[k];if(tiny)pts.push([pts[N][0]+tiny[0],pts[N][1]+tiny[1]]);
  const M=pts.length-1;ev('pointerdown',pts[0][0],pts[0][1],{});for(let i=1;i<=M;i++){T+=dt;ev('pointermove',pts[i][0],pts[i][1],{});}
  T+=dt;ev('pointerup',pts[M][0],pts[M][1],{buttons:0,pressure:0});ends.push(toImg(pts[M][0],pts[M][1]));};
 const cols=[['straight fast',8,[],null],['hook fast',8,[2,5,9,14],null],['tiny-last fast',8,[],[1.2,.4]],['drift slow',30,[1,3,6],null]];
 const [ox,oy]=scr(.05,.92),[ex,ey]=scr(.95,.08);const span=ex-ox,top=oy+20,L=(ey-oy)*.42;
 cols.forEach((cc,i)=>{const N=cc[1]===8?14:46;stroke(ox+span*(i+.5)/cols.length,top,L,N,cc[1]===8?6:8,cc[2],cc[3]);});
 A.step(4);const bl=await A.exportBlob({fmt:'png'});const bm=await createImageBitmap(bl);const cv=document.createElement('canvas');cv.width=bm.width;cv.height=bm.height;
 const x=cv.getContext('2d');x.drawImage(bm,0,0);const px=x.getImageData(0,0,cv.width,cv.height).data;const sx=cv.width/W,sy=cv.height/H;
 const bg=[px[0],px[1],px[2]];const out=[];const colW=W/cols.length;
 ends.forEach((e,i)=>{let sxm=0,sym=0,n=0,lat=0;const x0=Math.max(0,Math.floor(i*colW)),x1=Math.min(W,Math.floor((i+1)*colW));
  for(let yy=Math.floor(e[1]);yy<Math.min(H,e[1]+70);yy++)for(let xx=x0;xx<x1;xx++){const k=4*(Math.floor(yy*sy)*cv.width+Math.floor(xx*sx));
   if(Math.abs(px[k]-bg[0])+Math.abs(px[k+1]-bg[1])+Math.abs(px[k+2]-bg[2])>60){sxm+=xx;sym+=yy;n++;lat=Math.max(lat,Math.abs(xx-e[0]));}}
  const cx=n?sxm/n:e[0],cy=n?sym/n:e[1];out.push({name:cols[i][0],n,lat,angle:Math.atan2(cx-e[0],Math.max(cy-e[1],1))*180/Math.PI});});
 return {out,png:cv.toDataURL('image/png')};});
await b.close();if(out)require('fs').writeFileSync(out,Buffer.from(res.png.split(',')[1],'base64'));
let ok=true;const chk=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)ok=false;};
for(const r of res.out)chk(Math.abs(r.angle)<=(r.name.startsWith('straight')?10:25)&&r.n>50,`${r.name}: tail angle ${r.angle.toFixed(1)} deg, max lateral ${r.lat.toFixed(0)} px (${r.n} px)`);
chk(!errs.length,'no console/page errors '+errs.slice(0,2).join(' | '));console.log(ok?'ALL PASS':'FAILED');process.exit(ok?0:1);})().catch(e=>{console.error(e);process.exit(2);});
