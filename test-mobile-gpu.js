// Mobile-GPU regression for watercolour washes (v0.14: NaN blow-up blocks; v0.15: faint grid / tile seams / edge streaks on a Galaxy Note).
// Runs one wash-and-dry scenario (512x512 = 4x4 tiles of 128 px, virtual clock so idle timing is exact; the wash touches the LEFT canvas
// edge) on three GPU paths in parallel:
//   float  : normal SwiftShader path (RGBA32F, float linear filtering)
//   mobile : OES_texture_float_linear hidden, like Mali/Adreno phones (v0.15: RGBA32F + shader filtering; v0.14: RGBA16F)
//   half   : mobile + ?forceHalf=1&mediump=1 (RGBA16F sim, mediump shaders - SwiftShader still computes fp32, fp16 storage is exact)
// Checks per path: no NaN/Inf; pigment bounded; no black pixels; dry at the end; tile-boundary seam ratio < 1.6; grid detector
// (tools/grid_metrics.py: high-pass luminance gradient folded at periods 8/16/32/64/128 px in x and y, normalised z; ~1 = noise,
// the Note screenshot scores 3.25 at y128, v0.13-half 3.15) <= 1.8; left-edge streak ratio; the same grid detector on the
// difference image (path - float) <= 1.8; stripes and mean colour vs float.
// Usage: node test-mobile-gpu.js [file.html]   exit 0 pass, 1 fail, 2 crash.  ~15-20 min (three browsers in parallel).
const {chromium}=require('playwright');const fs=require('fs');const {execFileSync}=require('child_process');const GRID_MAX=1.8;
const FILE=process.argv[2]||'index.html';const TAG=FILE==='index.html'?'':'-'+FILE.replace(/\.html$/,'').replace(/\W/g,'_');
const STATS=` wtStats(){if(!hasWater)return null;const b=new Float32Array(W*H*4);const r={};gl.bindFramebuffer(gl.FRAMEBUFFER,WT.r.fb);for(const a of [0,1,2]){gl.readBuffer(gl.COLOR_ATTACHMENT0+a);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,b);let mx=0,bad=0,sum=0;for(let i=0;i<b.length;i++){const v=b[i];if(!isFinite(v)){bad++;continue;}if(Math.abs(v)>mx)mx=Math.abs(v);sum+=v;}r['a'+a]={mx:+mx.toPrecision(3),bad,sum:+sum.toPrecision(4)};}return r;},`;
function prep(){let s=fs.readFileSync(__dirname+'/'+FILE,'utf8');if(s.includes('wtStats('))return FILE;s=s.replace(' info:()=>({',STATS+' info:()=>({');if(!s.includes('wtStats('))throw new Error('cannot inject wtStats');const t='_mgpu_'+FILE.replace(/\W/g,'_')+'.html';fs.writeFileSync(__dirname+'/'+t,s);return t;}
const init=hide=>`(()=>{const H=${JSON.stringify(hide)};const g=WebGL2RenderingContext.prototype.getExtension;WebGL2RenderingContext.prototype.getExtension=function(n){return H.includes(n)?null:g.call(this,n);};
 const r=performance.now.bind(performance);window.__vt=null;performance.now=()=>window.__vt!=null?window.__vt:r();})()`;
async function run(file,mode){const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{const ctx=await b.newContext({viewport:{width:900,height:900}});await ctx.addInitScript(init(mode==='float'?[]:['OES_texture_float_linear']));
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.goto('file://'+__dirname+'/'+file+(mode==='half'?'?forceHalf=1&mediump=1':''));await p.waitForFunction(()=>window.paintAPI,null,{timeout:20000});await p.waitForTimeout(300);
 const r=await p.evaluate(()=>{const A=paintAPI,S=512;const nc=A.newCanvas(S,S);A.fit();A.pause(true);window.__vt=1e6;const T=()=>{window.__vt+=1000/120;A.step(1);};
  A.setMed('water');A.setSize(34);A.setHex('#2a5bd7');
  for(let pass=0;pass<2;pass++)for(let j=0;j<9;j++){const a=[];for(let i=0;i<=24;i++)a.push([-.03+.91*(pass?1-i/24:i/24),.14+j*.09+.02*Math.sin(i*.7+pass)]);A.stroke(a,.8,{dt:12});window.__vt+=300;for(let k=0;k<12;k++)T();}
  for(let i=0;i<300;i++)T();window.__vt+=45000;for(let i=0;i<1500;i++)T();
  const st=A.wtStats(),wet=Math.max(A.wet(.5,.5),A.wet(.3,.3),A.wet(.7,.7));
  const c=A.exportData('flat')[0][1],w=c.width,h=c.height,D=c.getContext('2d').getImageData(0,0,w,h).data;
  const L=new Float32Array(w*h),R=[0,0,0];for(let i=0;i<w*h;i++){L[i]=(.3*D[4*i]+.59*D[4*i+1]+.11*D[4*i+2])/255;}
  // wash mask: clearly painted pixels (paper is ~0.93 luminance)
  const M=new Uint8Array(w*h);let nm=0,black=0;for(let i=0;i<w*h;i++){if(L[i]<.85){M[i]=1;nm++;R[0]+=D[4*i];R[1]+=D[4*i+1];R[2]+=D[4*i+2];if(L[i]<.08)black++;}}
  const mean=R.map(v=>v/Math.max(nm,1)/255);
  // seam metric: mean |dI| across a line at offset x (between x-1 and x), over masked pixels; boundary = 128k, reference = nearby offsets
  const dX=x=>{let s=0,n=0;for(let y=0;y<h;y++){const i=y*w+x;if(M[i]&&M[i-1]){s+=Math.abs(L[i]-L[i-1]);n++;}}return n>50?s/n:null;};
  const dY=y=>{let s=0,n=0;for(let x=0;x<w;x++){const i=y*w+x;if(M[i]&&M[i-w]){s+=Math.abs(L[i]-L[i-w]);n++;}}return n>50?s/n:null;};
  let seam=0,seamAt='';for(const [f,lim] of [[dX,w],[dY,h]])for(let b=128;b<lim;b+=128){const bv=f(b);if(bv==null)continue;const ref=[];for(let o=3;o<=40;o++){for(const q of [b-o,b+o])if(q>0&&q<lim){const v=f(q);if(v!=null)ref.push(v);}}
   ref.sort((a,b)=>a-b);const med=ref[ref.length>>1]||1e-3;const ratio=bv/Math.max(med,1e-3);if(ratio>seam){seam=ratio;seamAt=(f===dX?'x=':'y=')+b;}}
  // stripe metric: per 64-row band, column means over masked pixels; RMS of (column mean - 9px moving average). Same for row means in 64-col bands.
  const hp=a=>{let s=0,n=0;for(let i=4;i<a.length-4;i++){if(a[i]==null)continue;let m=0,k=0;for(let j=-4;j<=4;j++)if(a[i+j]!=null){m+=a[i+j];k++;}if(k<9)continue;s+=(a[i]-m/k)**2;n++;}return n?Math.sqrt(s/n):0;};
  let sv=0,sh=0;for(let y0=0;y0<h;y0+=64){const cm=[];for(let x=0;x<w;x++){let s=0,n=0;for(let y=y0;y<y0+64;y++){const i=y*w+x;if(M[i]){s+=L[i];n++;}}cm.push(n>=48?s/n:null);}sv=Math.max(sv,hp(cm));}
  for(let x0=0;x0<w;x0+=64){const rm=[];for(let y=0;y<h;y++){let s=0,n=0;for(let x=x0;x<x0+64;x++){const i=y*w+x;if(M[i]){s+=L[i];n++;}}rm.push(n>=48?s/n:null);}sh=Math.max(sh,hp(rm));}
  return{nc,info:A.info(),st,wet,nm,black,mean,seam:+seam.toFixed(3),seamAt,stripeV:+sv.toFixed(4),stripeH:+sh.toFixed(4),png:c.toDataURL('image/png')};});
 fs.writeFileSync(__dirname+`/test-mobile-gpu-${mode}${TAG}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;r.errs=errs;return r;}finally{await b.close();}}
(async()=>{const t0=Date.now();const file=prep();let code=0;
 try{const [F,Mo,Hf]=await Promise.all([run(file,'float'),run(file,'mobile'),run(file,'half')]);const fails=[];const R={float:F,mobile:Mo,half:Hf};
  const img=m=>__dirname+`/test-mobile-gpu-${m}${TAG}.png`;
  const gm=(...a)=>JSON.parse(execFileSync('python3',[__dirname+'/tools/grid_metrics.py',...a]).toString());
  for(const [n,r] of Object.entries(R)){r.gm=gm(img(n),...(n==='float'?[]:[img('float')]));
   const P=r.gm.a.period||{},Pd=(r.gm.diff&&r.gm.diff.period)||{};const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>k+':'+v).join(' ');
   console.log(n.padEnd(6),'sim',r.info.sim||r.nc.IF,r.info.nolin?'(shader filter)':'','| NaN',r.st?r.st.a0.bad+r.st.a1.bad+r.st.a2.bad:'-','| maxF',r.st&&r.st.a1.mx,'maxD',r.st&&r.st.a2.mx,'| wet',r.wet.toFixed(4),'| washPx',r.nm,'black',r.black,
    '| seam',r.seam,r.seamAt,'| grid',top(P),'| edge',r.gm.a.edge,(r.gm.diff?'| diff-grid '+top(Pd)+' rms '+r.gm.diff.rms:''),'| stripes V/H',r.stripeV,r.stripeH,'| mean',r.mean.map(v=>v.toFixed(3)).join(','),r.errs.length?'| errors '+r.errs.slice(0,3):'');
   if(r.errs.length)fails.push(n+': page errors');
   if(!r.st)fails.push(n+': no water');else{for(const a of ['a0','a1','a2'])if(r.st[a].bad)fails.push(`${n}: ${r.st[a].bad} NaN/Inf values in water attachment ${a}`);
    if(r.st.a1.mx>64)fails.push(`${n}: suspended pigment blew up (max ${r.st.a1.mx})`);if(r.st.a2.mx>60)fails.push(`${n}: deposited pigment blew up (max ${r.st.a2.mx})`);}
   if(r.nm<0.3*512*512)fails.push(n+': wash too small ('+r.nm+' px)');
   if(r.black>0)fails.push(`${n}: ${r.black} black/NaN pixels`);
   if(r.wet>.003)fails.push(`${n}: wash not dry (${r.wet.toFixed(4)})`);
   if(r.seam>1.6)fails.push(`${n}: tile seam at ${r.seamAt} (ratio ${r.seam})`);
   for(const [k,v] of Object.entries(P))if(v>GRID_MAX)fails.push(`${n}: grid/periodic lines, period ${k} score ${v} > ${GRID_MAX}`);
   for(const [k,v] of Object.entries(Pd))if(v>GRID_MAX)fails.push(`${n}: grid in (${n} - float) difference, period ${k} score ${v} > ${GRID_MAX}`);}
  const fe=F.gm.a.edge||1;
  for(const n of ['mobile','half']){const r=R[n];
   if(n==='half'&&!/16/.test(r.info.sim||r.nc.IF))fails.push('half run did not use RGBA16F');
   if(r.gm.a.edge!=null&&r.gm.a.edge>Math.max(2,1.5*fe))fails.push(`${n}: left-edge streaks (ratio ${r.gm.a.edge} vs float ${fe})`);
   if(r.stripeV>1.6*F.stripeV+.004||r.stripeH>1.6*F.stripeH+.004)fails.push(`${n} stripes vs float: V ${r.stripeV}/${F.stripeV} H ${r.stripeH}/${F.stripeH}`);
   if(r.seam>1.6*F.seam+.2)fails.push(`${n} seams vs float: ${r.seam}/${F.seam}`);
   const dm=Math.max(...r.mean.map((v,i)=>Math.abs(v-F.mean[i])));if(dm>.06)fails.push(n+' mean colour differs from float by '+dm.toFixed(3));}
  if(F.gm.a.edge!=null&&F.gm.a.edge>2.5)fails.push(`float: left-edge streaks (ratio ${F.gm.a.edge})`);
  console.log(fails.length?'FAIL\n - '+fails.join('\n - '):'PASS','('+((Date.now()-t0)/1000).toFixed(0)+' s; images test-mobile-gpu-{float,mobile,half}'+TAG+'.png)');code=fails.length?1:0;}
 catch(e){console.error('CRASH',e);code=2;}
 if(file!==FILE)fs.unlinkSync(__dirname+'/'+file);process.exit(code);})();
