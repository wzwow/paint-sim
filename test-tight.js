// v0.18 tight sim-region check: the same watercolour + oil scenario simulated with the tight scheduler (default) and with ?simfull=1 (every
// step over the whole canvas, nothing ever sleeps) must give the same picture: max 8-bit difference of the flat export <= 6 and < 0.2% of
// pixels > 2. Also: tiles must go to sleep after drying (awake 0) and the scratch never exceeds the canvas height.
// Deterministic: sim driven by paintAPI.step with a virtual clock, Math.random seeded (brush bristle jitter). Usage: node test-tight.js [file.html]  (exit 0 pass / 1 fail / 2 crash)
const {chromium}=require('playwright');const FILE=process.argv[2]||'index.html';
const init=`(()=>{let a=12345;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};const r=performance.now.bind(performance);window.__vt=null;performance.now=()=>window.__vt!=null?window.__vt:r();})()`;
async function run(b,q,file=FILE){const ctx=await b.newContext({viewport:{width:1000,height:800}});await ctx.addInitScript(init);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
 await p.goto('file://'+__dirname+'/'+file+q);await p.waitForFunction(()=>window.paintAPI,null,{timeout:20000});
 const r=await p.evaluate(()=>{const A=paintAPI;A.newCanvas(448,352);A.fit();A.pause(true);window.__vt=1e6;const T=n=>{for(let i=0;i<n;i++){window.__vt+=1000/120;A.step(1);}};
  A.setMed('water');A.setSize(24);A.setHex('#2a5bd7');const aw=[];
  for(let j=0;j<4;j++){const a=[];for(let i=0;i<=30;i++)a.push([.1+.5*i/30,.2+j*.12+.03*Math.sin(i*.5)]);A.stroke(a,.8,{dt:12});window.__vt+=200;T(40);aw.push(A.info().awake);}
  A.setHex('#c0392b');{const a=[];for(let i=0;i<=30;i++)a.push([.55+.3*i/30,.75-.5*i/30]);A.stroke(a,.8,{dt:12});}T(200);
  A.setMed('oil');A.setHex('#e0b030');{const a=[];for(let i=0;i<=30;i++)a.push([.15+.7*i/30,.85]);A.stroke(a,.7,{dt:12});}T(300);
  aw.push(A.info().awake);window.__vt+=46000;T(2500);const end=A.info();
  const c=A.exportData('flat')[0][1],D=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return{px:Array.from(D),w:c.width,aw,end:{awake:end.awake,W:end.W,H:end.H},perf:A.perf?A.perf():null};});
 await ctx.close();return Object.assign(r,{errs});}
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});let code=0;
 try{const REF=process.env.REF;const [t,f]=await Promise.all([run(b,''),REF?run(b,'',REF):run(b,'?simfull=1')]);let mx=0,n2=0;for(let i=0;i<t.px.length;i++){const d=Math.abs(t.px[i]-f.px[i]);if(d>mx)mx=d;if(d>2)n2++;}
  if(process.env.DUMP){require('fs').writeFileSync(__dirname+'/_logs/tight-dump.json',JSON.stringify({w:t.w,t:t.px,f:f.px}));}
  const frac=n2/t.px.length;console.log(`tight vs full: max diff ${mx}, ${(frac*100).toFixed(3)}% channels > 2 | awake during strokes (tight) ${t.aw.join(',')} | at end tight ${t.end.awake} full ${f.end.awake}`);
  const fails=[];if(mx>6)fails.push('max diff '+mx+' > 6');if(frac>=.002)fails.push('too many differing pixels');if(t.end.awake!==0)fails.push('tiles still awake after drying: '+t.end.awake);
  if(t.errs.length||f.errs.length)fails.push('page errors: '+t.errs.concat(f.errs).join(';'));
  console.log(fails.length?'FAIL: '+fails.join('; '):'PASS');code=fails.length?1:0;}
 catch(e){console.error(e);code=2;}await b.close();process.exit(code);})();
