// v0.18 dried-wash speckle test. Eight pigments (the palette minus clear water) are each laid as a wet patch of overlapping strokes on
// cold-press paper, left to dry completely (virtual clock), then each patch interior is measured with tools/speckle.py: pale 'salt'
// speckles = mid-scale blobs lighter than their surroundings (granulation, which is DARK pigment in paper valleys, is not counted).
// v0.17 on a desktop GPU dried Ultramarine and Burnt sienna into pale frosty speckles. Pass: every pigment pale <= 2.5% and <= 5 pale blobs (>= 20 px) per 10k px.
// v0.17: Ultramarine 15.0% / 16.0, Burnt sienna 10.7% / 14.2, Payne's grey 3.9% / 5.5 (v0.18: 1.6% / 3.8, 0 / 0, 0 / 0).
// Writes test-speckle.png (all patches) and test-speckle-<pigment>.png crops. Usage: node test-speckle.js [file.html]  exit 0/1/2. ~5-10 min.
const {chromium}=require('playwright');const fs=require('fs');const {execFileSync}=require('child_process');
const FILE=process.argv[2]||'index.html';const TAG=FILE==='index.html'?'':'-'+FILE.replace(/\.html$/,'').replace(/\W/g,'_');
const BLOBS=5,PALE=2.5;const CW=224,CH=232,COLS=4,ROWS=2;
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});let code=0;
 try{const ctx=await b.newContext({viewport:{width:1000,height:800}});await ctx.addInitScript(`(()=>{window.__pigs=${JSON.stringify(process.env.PIGS||'')};let a=777;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};const r=performance.now.bind(performance);window.__vt=null;performance.now=()=>window.__vt!=null?window.__vt:r();})()`);
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
  await p.goto('file://'+__dirname+'/'+FILE);await p.waitForFunction(()=>window.paintAPI,null,{timeout:30000});
  const r=await p.evaluate(([CW,CH,COLS,ROWS])=>{const A=paintAPI,W=CW*COLS,H=CH*ROWS;A.newCanvas(W,H);A.fit();A.pause(true);window.__vt=1e6;
   const T=n=>{for(let i=0;i<n;i++){window.__vt+=1000/120;A.step(1);}};A.setMed('water');A.setSize(26);const names=[];
   const ONLY=(window.__pigs||'').split(',').filter(Boolean).map(Number);for(let c=0;c<8;c++){if(ONLY.length&&!ONLY.includes(c)){names.push('skip');continue;}A.selectPig(c+1);names.push(document.getElementById('pn').textContent);const cx=(c%COLS)*CW,cy=Math.floor(c/COLS)*CH;
    for(let j=0;j<5;j++){const a=[];for(let i=0;i<=12;i++){const u=j%2?1-i/12:i/12;a.push([(cx+62+u*(CW-124))/W,1-(cy+68+j*24+3*Math.sin(i*.8))/H]);}A.stroke(a,.85,{dt:14});window.__vt+=120;T(6);}}
   T(400);window.__vt+=46000;T(2600);const wet=[];for(let c=0;c<8;c++){const cx=(c%COLS)*CW,cy=Math.floor(c/COLS)*CH;wet.push(A.wet((cx+CW/2)/W,1-(cy+CH/2)/H));}
   const cv=A.exportData('flat')[0][1];return{url:cv.toDataURL('image/png'),names,wet};},[CW,CH,COLS,ROWS]);
  const out=__dirname+'/test-speckle'+TAG+'.png';fs.writeFileSync(out,Buffer.from(r.url.split(',')[1],'base64'));
  const fails=[];
  for(let c=0;c<8;c++){const x0=(c%COLS)*CW,y0=Math.floor(c/COLS)*CH;
   const m=JSON.parse(execFileSync('python3',[__dirname+'/tools/speckle.py',out,''+x0,''+y0,''+(x0+CW),''+(y0+CH)]).toString());
   const nm=r.names[c];if(nm==='skip')continue;console.log(`${nm.padEnd(15)} ${m.error?m.error:`pale ${m.pale_pct}%  blobs/10k ${m.blobs_per_10k}  p99.5 ${m.p99_5}  sd ${m.sd}`}  wet ${r.wet[c].toFixed(4)}`);
   if(m.error){if(!/white/i.test(nm))fails.push(nm+': '+m.error);continue;}
   if(m.blobs_per_10k>BLOBS||m.pale_pct>PALE)fails.push(`${nm}: speckled (pale ${m.pale_pct}%, ${m.blobs_per_10k} blobs/10k)`);
   if(r.wet[c]>1e-3)fails.push(nm+': not dry');}
  if(errs.length)fails.push('page errors: '+errs.join(';'));
  console.log(fails.length?'FAIL\n '+fails.join('\n '):`PASS (limits: blobs/10k <= ${BLOBS}, pale <= ${PALE}%) image ${out}`);code=fails.length?1:0;}
 catch(e){console.error(e);code=2;}await b.close();process.exit(code);})();
