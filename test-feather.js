// v0.20 watercolour feathering. Paints the same scenes in v0.19 (index-v0.19.html) and the candidate (default index.html):
//  C a blue stroke into the same wash after 400 steps (damp, mostly soaked in);
//  A wet-on-wet: a pale yellow wash, then (while wet) a blue stroke laid into it; B wet wash on dry paper: the same blue stroke on dry paper.
// After drying, measures the blue stroke's edge from the flat export: roughness = perimeter of the half-darkness mask / perimeter of the
// same mask smoothed (r=6 px box) [1 = clean round edge], fringe = soft-edge pixels (10-50% of core darkness) per edge pixel.
// edgeHF = mean |D - 3x3 box(D)| over the soft-edge band (8-60% of core darkness), % of core: fine fibre-scale edge texture.
// Pass: A edgeHF >=1.5x and 15%-contour roughness >=1.03x vs v0.19; B roughness, soft-edge width <=12% and edgeHF <=15% change; no NaN; no errors. Writes _wip/feather-*.png.
const {chromium}=require('playwright');const fs=require('fs');
const NEW=process.argv[2]||'index.html',OLD=process.argv[3]||'index-v0.19.html';
async function run(b,file,scene,seed){const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.goto((file.includes('://')?file:'file://'+__dirname+'/'+file)+'?simfull=1');await p.waitForFunction(()=>window.paintAPI,null,{timeout:30000});await p.waitForTimeout(300);
 const r=await p.evaluate(([scene,seed])=>{const A=paintAPI;A.newCanvas(400,400);A.pause(true);A.setMed('water');
  const ln=(y0,y1,x0,x1,n)=>{const a=[];for(let i=0;i<=n;i++)a.push([x0+(x1-x0)*i/n,y0+(y1-y0)*i/n]);return a;};
  if(scene!=='B'){A.setSize(60);A.setHex('#f3e9b0');for(let j=0;j<6;j++)A.stroke(ln(.2+j*.12,.2+j*.12,.08,.92,24),.7);A.step(scene==='C'?400:30);}
  A.setSize(22);A.setHex('#1f3a93');A.stroke(ln(.5,.5+seed*.01,.2,.8,24),.65);A.stroke(ln(.3,.7,.5,.52,24),.65);
  for(let i=0;i<500;i++)A.step(1);A.dryAll();A.step(2);
  const cv=A.exportData('flat')[0][1];const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');x.drawImage(cv,0,0);
  const W=c.width,H=c.height,d=x.getImageData(0,0,W,H).data;const url=c.toDataURL('image/png');
  const R=new Float32Array(W*H);for(let i=0;i<W*H;i++)R[i]=d[4*i];let nan=false;for(let i=0;i<d.length;i++)if(!(d[i]>=0))nan=true;
  const bgS=[];for(let y=0;y<H;y+=4)for(const xx of [Math.floor(W*.1),Math.floor(W*.9)])bgS.push(R[y*W+xx]);bgS.sort((a,b)=>a-b);const bg=bgS[bgS.length>>1];
  const D=new Float32Array(W*H);for(let i=0;i<W*H;i++)D[i]=Math.max(bg-R[i],0);
  const core=[];for(let k=-6;k<=6;k++)core.push(D[Math.round(H*.5)*W+Math.round(W*(.35+k*.005))]);core.sort((a,b)=>a-b);const cd=core[core.length>>1];
  let fr=0;for(let i=0;i<W*H;i++){const t=D[i]/cd;if(t>.1&&t<=.5)fr++;}
  const per=m=>{let n=0;for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(m[i]&&(!m[i-1]||!m[i+1]||!m[i-W]||!m[i+W]))n++;}return n;};
  const rough=th=>{const M=new Uint8Array(W*H);for(let i=0;i<W*H;i++)M[i]=D[i]>th*cd?1:0;
   const rr=6,I=new Float32Array((W+1)*(H+1));for(let y=0;y<H;y++)for(let x=0;x<W;x++)I[(y+1)*(W+1)+x+1]=M[y*W+x]+I[y*(W+1)+x+1]+I[(y+1)*(W+1)+x]-I[y*(W+1)+x];
   const S=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const x0=Math.max(x-rr,0),x1=Math.min(x+rr+1,W),y0=Math.max(y-rr,0),y1=Math.min(y+rr+1,H);
    S[y*W+x]=(I[y1*(W+1)+x1]-I[y0*(W+1)+x1]-I[y1*(W+1)+x0]+I[y0*(W+1)+x0])/((x1-x0)*(y1-y0))>.5?1:0;}
   return [per(M)/Math.max(per(S),1),per(S)];};
  let hf=0,nh=0;for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){const i=y*W+x,t=D[i]/cd;if(t<=.08||t>.6)continue;let b=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)b+=D[i+dy*W+dx];hf+=Math.abs(D[i]-b/9);nh++;}
  let grey=0;for(let i=0;i<W*H;i++){const r=d[4*i],g=d[4*i+1],b=d[4*i+2];if(Math.max(r,g,b)-Math.min(r,g,b)<45&&(r+g+b)/3<200)grey++;}
  const edgeHF=hf/Math.max(nh,1)/cd*100;
  const r50=rough(.5),r25=rough(.25),r15=rough(.15);const PS=r50[1];
  return{bg,core:cd,rough:r50[0],rough25:r25[0],rough15:r15[0],fringe:fr/Math.max(PS,1),edgeHF,grey,nan,url};},[scene,seed]);
 await p.context().close();r.errs=errs;return r;}
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const res={};for(const sc of (process.env.SCENES||'ABC').split(''))for(const [tag,f] of [['old',OLD],['new',NEW]]){const r=await run(b,f,sc,0);fs.mkdirSync(__dirname+'/_wip',{recursive:true});
  fs.writeFileSync(__dirname+`/_wip/feather-${sc}-${tag}.png`,Buffer.from(r.url.split(',')[1],'base64'));delete r.url;res[sc+tag]=r;console.log(sc,tag,JSON.stringify(r));}
 await b.close();if(process.env.SCENES)process.exit(0);let ok=true;const chk=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)ok=false;};
 const rA=res.Anew.rough15/res.Aold.rough15,fA=res.Anew.edgeHF/res.Aold.edgeHF,rB=res.Bnew.rough/res.Bold.rough,fB=res.Bnew.edgeHF/res.Bold.edgeHF,sB=res.Bnew.fringe/res.Bold.fringe;
 chk(fA>=1.5,`wet-on-wet edge feathering (fine edge texture) x${fA.toFixed(2)} vs v0.19 (>=1.5)`);chk(rA>=1.03,`wet-on-wet outer-contour (15%) roughness x${rA.toFixed(3)} vs v0.19 (>=1.03)`);
 chk(Math.abs(rB-1)<=.12,`dry paper roughness x${rB.toFixed(2)} (within 12%)`);chk(Math.abs(fB-1)<=.15,`dry paper edge texture x${fB.toFixed(2)} (within 15%)`);chk(Math.abs(sB-1)<=.12,`dry paper soft-edge width x${sB.toFixed(2)} (within 12%)`);
 const fC=res.Cnew.edgeHF/res.Cold.edgeHF;chk(fC>=1.2,`wash meeting damp paper (C, 400 steps later) edge feathering x${fC.toFixed(2)} vs v0.19 (>=1.2)`);
 chk(['A','B','C'].every(k=>res[k+'new'].grey<=res[k+'old'].grey*1.2+50),'no grey blow-up blobs (dark low-chroma pixel count <= 1.2x v0.19 + 50; blue-over-yellow greens also count, hence relative)');
 chk(Object.values(res).every(r=>!r.nan),'no NaN pixels');chk(Object.values(res).every(r=>!r.errs.length),'no console/page errors');
 console.log(ok?'ALL PASS':'FAILED');process.exit(ok?0:1);})().catch(e=>{console.error(e);process.exit(2);});
