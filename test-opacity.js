// v0.50 brush Opacity (how see-through each stroke is). Playwright + SwiftShader, headless.
// Usage: node test-opacity.js [file] [--old index-v0.49.html]
// 1. Per medium (watercolour, ink, gouache, acrylic, oil, pencil): a light stroke at 100 / 50 / 20% over white paper and over a dark band of
//    dried paint (same layer). Coverage = how far the stroke moves the colour from the background towards the 100% stroke (signed projection),
//    measured wet and after drying. Must fall with opacity (monotonic), 20% must be clearly see-through but still visible, and drying must not
//    change it much (a glaze that dries stays a glaze).
// 2. 100% = v0.49: with Math.random seeded the same way, the v0.50 picture at 100% matches index-v0.49.html pixel for pixel (small tolerance).
// 3. UI: the rail's third slider is brush Opacity (not layer opacity), synced with Settings › Paint › Brush opacity; Layer opacity stays in the
//    Layers tab; the knife and clear water grey the slider out (and ignore it); desktop and phone.
// 4. Recorder: the opacity is recorded and the replay of glazed strokes matches the real painting.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const args=process.argv.slice(2);const oi=args.indexOf('--old');const OLD=oi>=0?args[oi+1]:'index-v0.49.html';
const NEW=args.find((a,i)=>!a.startsWith('--')&&args[i-1]!=='--old')||'index.html';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
let fails=0,n=0;const check=(c,m,x)=>{n++;console.log((c?'PASS ':'FAIL ')+m+(x===undefined?'':' '+JSON.stringify(x)));if(!c)fails++;};
const SEED=`(()=>{let s=123456789;Math.random=()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};})();`;
const MEDIA=['water','ink','gouache','acrylic','oil','pencil'];
const url=(f,q)=>'file://'+path.resolve(__dirname,f)+'?welcome=0&simfull=1'+(q||'');
// paints every medium; returns per-medium RGBA (wet + dry) of a 360x240 canvas
async function paintAll(b,file,ops){const p=await (await b.newContext({viewport:{width:1000,height:760}})).newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));await p.addInitScript(SEED);await p.goto(url(file));await p.waitForFunction(()=>window.paintAPI,null,{timeout:60000});await p.waitForTimeout(300);
 const out={};for(const med of MEDIA){out[med]=await p.evaluate(({med,ops})=>{const A=paintAPI;A.newCanvas(360,240);A.pause(true);
  const ln=(x0,y0,x1,y1,n,pr)=>{const a=[];for(let i=0;i<=n;i++)a.push([x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,pr,14]);return a;};
  const M={water:[0,'water'],ink:[0,'ink'],gouache:[.32,'gouache'],acrylic:[.58,'acrylic'],oil:[1,'oil'],pencil:[.32,'gouache']};
  const op=v=>{if(A.setBrushOpacity)A.setBrushOpacity(v);};op(1);
  A.setTool('brush');A.setMedium(M[med][0],M[med][1]);A.setShape('round');A.setSize(44);A.setWLoad(.8);A.setHex(med==='ink'||med==='water'?'#232c52':'#1c2a48');
  for(let j=0;j<3;j++)A.stroke(ln(.02,.48+j*.035,.98,.48+j*.035,40,.8),.8);A.step(20);A.dryAll();A.step(2);
  const hex=med==='ink'?'#2a2a30':med==='water'?'#c23a2b':'#f2c21a';
  if(med!=='pencil'){A.setHex(hex);A.stroke(ln(.02,.03,.3,.03,20,.6),.6);} // clean the brush of the band colour (bottom edge, not measured)
  ops.forEach((o,i)=>{const x=.2+.3*i;if(med==='pencil'){A.setTool('pencil');A.setSize(150);A.setPencil({phard:.7,pgrain:.5,pcol:'g'});}
   else{A.setTool('brush');A.setMedium(M[med][0],M[med][1]);A.setHex(hex);A.setSize(44);A.setWLoad(.8);}op(o);A.stroke(ln(x,.1,x,.9,50,.7),.7);});
  op(1);A.step(30);const g=c=>Array.from(c.getContext('2d').getImageData(0,0,360,240).data);const wet=g(A.exportData('flat')[0][1]);A.dryAll();A.step(2);const dry=g(A.exportData('flat')[0][1]);
  return{wet,dry};},{med,ops});}
 await p.context().close();return{out,errs};}
const W=360,H=240;
const mean=(d,x0,x1,y0,y1)=>{let s=[0,0,0],k=0;for(let y=Math.floor((1-y1)*H);y<(1-y0)*H;y++)for(let x=Math.floor(x0*W);x<x1*W;x++){const i=4*(y*W+x);s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2];k++;}return s.map(v=>v/k);};
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function cover(d,ops){const paper=mean(d,.02,.08,.62,.88),band=mean(d,.02,.08,.5,.52);const col=i=>.2+.3*i;
 const w=ops.map((o,i)=>mean(d,col(i)-.01,col(i)+.01,.62,.88)),k=ops.map((o,i)=>mean(d,col(i)-.01,col(i)+.01,.5,.52));
 const vw=sub(w[0],paper),vk=sub(k[0],band);return{w:w.map(c=>+(dot(sub(c,paper),vw)/Math.max(dot(vw,vw),1e-6)).toFixed(3)),k:k.map(c=>+(dot(sub(c,band),vk)/Math.max(dot(vk,vk),1e-6)).toFixed(3)),dW:+Math.sqrt(dot(vw,vw)).toFixed(1),dK:+Math.sqrt(dot(vk,vk)).toFixed(1)};}
function pxDiff(a,b){let mx=0,s=0,big=0;for(let i=0;i<a.length;i+=4){const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));s+=d;if(d>mx)mx=d;if(d>8)big++;}return{max:mx,mean:+(s/(a.length/4)).toFixed(4),big};}
(async()=>{const b=await chromium.launch({args:ARGS});
 try{
 // ---------- 1+2: coverage and 100% regression ----------
 const OPS=[1,.5,.2];
 const N=await paintAll(b,NEW,OPS);check(!N.errs.length,'no page errors while painting',N.errs.slice(0,3));
 const F=await paintAll(b,NEW,[1,1,1]),O=await paintAll(b,OLD,[1,1,1]);
 for(const med of MEDIA){for(const ph of ['wet','dry']){const c=cover(N.out[med][ph],OPS);console.log('  '+med+' '+ph,JSON.stringify(c));
   const tolW=.04,tolK=med==='water'||med==='ink'||med==='pencil'?.06:.04;
   check(c.w[0]>=c.w[1]-tolW&&c.w[1]>=c.w[2]-tolW,`${med} ${ph}: over white, coverage falls with opacity (100/50/20%)`,c.w);
   check(c.w[2]<.8&&c.w[2]>.03,`${med} ${ph}: 20% over white is see-through but visible`,c.w[2]);
   if(med!=='pencil'&&med!=='ink'){check(c.k[0]>=c.k[1]-tolK&&c.k[1]>=c.k[2]-tolK,`${med} ${ph}: over the dark dried band, coverage falls with opacity`,c.k);
    check(c.k[2]<.85,`${med} ${ph}: 20% over the dark band lets it show through`,c.k[2]);}}
  const cw=cover(N.out[med].wet,OPS),cd=cover(N.out[med].dry,OPS);
  check(Math.abs(cw.w[1]-cd.w[1])<.15&&Math.abs(cw.k[1]-cd.k[1])<.15&&Math.abs(cw.k[2]-cd.k[2])<.15,`${med}: a 50% / 20% glaze looks about the same after drying`,{wet:cw,dry:cd});
  for(const ph of ['wet','dry']){const d=pxDiff(F.out[med][ph],O.out[med][ph]);check(d.big<=Math.max(5,W*H*.0005)&&d.mean<.05,`${med} ${ph}: 100% matches v0.49 (seeded, whole picture)`,d);}
  const d1=pxDiff(N.out[med].dry,F.out[med].dry);check(d1.big>200,`${med}: lower opacity really changes the picture`,{big:d1.big});}
 // ---------- 3: UI desktop + phone ----------
 for(const [vw,vh,mob] of [[1280,800,false],[390,844,true]]){const tag=mob?'phone':'desktop';const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob,deviceScaleFactor:mob?2:1});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error'&&!/favicon|manifest/.test(m.text()))errs.push(m.text());});
  await p.goto(url(NEW).replace('&simfull=1',''));await p.waitForFunction(()=>window.paintAPI);await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>{const e=document.getElementById('vsOp');const b=e.getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
   return{x:b.x,y:b.y,w:b.width,h:b.height,in:b.bottom<=innerHeight&&b.right<=innerWidth&&b.width>=40,hit:!!hit&&(hit===e||e.contains(hit)),t:e.dataset.t,lab:e.nextElementSibling.textContent,v:document.getElementById('vlOp').textContent};});
  check(r.in&&r.hit&&r.t==='bop'&&/^Opacity/.test(r.lab)&&r.v==='100%',`${tag}: rail has a visible, reachable Opacity slider for the brush, starting at 100%`,r);
  if(mob)await p.tap('body',{position:{x:r.x+r.w/2,y:r.y+r.h*.75}}).catch(()=>{});
  // drag on the slider (touch on phone uses pointer events too)
  await p.mouse.move(r.x+r.w/2,r.y+r.h*.7);await p.mouse.down();await p.mouse.move(r.x+r.w/2,r.y+r.h*.62);await p.mouse.up();await p.waitForTimeout(500);
  let s=await p.evaluate(()=>({op:paintAPI.brushOpacity().v,lay:paintAPI.layers()[0].op,rail:document.getElementById('vlOp').textContent,set:+document.getElementById('bop').value,bov:document.getElementById('bov').textContent}));
  check(s.op>.2&&s.op<.6&&s.lay===1&&s.rail===Math.round(s.op*100)+'%'&&Math.abs(s.set-s.op)<1e-6&&s.bov===s.rail,`${tag}: dragging it sets the brush opacity (Settings slider in sync), layer opacity untouched`,s);
  await p.evaluate(()=>{const e=document.getElementById('bop');e.value=.8;e.dispatchEvent(new Event('input'));});await p.waitForTimeout(500);
  s=await p.evaluate(()=>({op:paintAPI.brushOpacity().v,rail:document.getElementById('vlOp').textContent}));check(Math.abs(s.op-.8)<1e-6&&s.rail==='80%','Settings › Paint › Brush opacity drives the brush and the rail',s);
  const lay=await p.evaluate(()=>{const l=document.getElementById('lop');const lab=l.previousElementSibling.textContent;return{inLayers:document.getElementById('lBody').contains(l),lab};});
  check(lay.inLayers&&/Layer opacity/.test(lay.lab),'layer opacity still in the Layers tab, labelled "Layer opacity"',lay);
  for(const [what,fn] of [['palette knife',()=>paintAPI.setTool('knife')],['clear water',()=>{paintAPI.setTool('brush');document.getElementById('qClr').click();}]]){
   await p.evaluate(fn);await p.waitForTimeout(600);const q=await p.evaluate(()=>({na:document.getElementById('vsOp').classList.contains('na'),dis:document.getElementById('bop').disabled,note:!document.getElementById('bopNa').hidden,tip:document.getElementById('vsOp').dataset.tip,ap:paintAPI.brushOpacity()}));
   check(q.na&&q.dis&&q.note&&!q.ap.applies&&q.ap.k===1&&q.tip.includes(what),`${tag}: ${what} greys Opacity out and ignores it`,q);
   const before=await p.evaluate(()=>paintAPI.brushOpacity().v);await p.mouse.move(r.x+r.w/2,r.y+r.h*.3);await p.mouse.down();await p.mouse.up();await p.waitForTimeout(300);
   check(await p.evaluate(v=>paintAPI.brushOpacity().v===v,before),`${tag}: greyed slider can't be changed (${what})`);}
  await p.evaluate(()=>{document.getElementById('qClr').click();paintAPI.setTool('brush');});await p.waitForTimeout(600);
  check(await p.evaluate(()=>!document.getElementById('vsOp').classList.contains('na')&&!document.getElementById('bop').disabled),`${tag}: back to the brush with a colour: Opacity active again`);
  const ov=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);check(ov,`${tag}: no horizontal overflow`);
  check(!errs.length,`${tag}: no console/page errors`,errs.slice(0,3));await ctx.close();}
 // ---------- 4: recorder / replay ----------
 {const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
  await p.addInitScript(()=>{try{localStorage.setItem('recordStrokes','1');}catch(_){}});await p.goto(url(NEW).replace('&simfull=1',''));await p.waitForFunction(()=>window.paintAPI);await p.waitForTimeout(1200);
  await p.evaluate(()=>{const A=paintAPI;A.newCanvas(384,288);A.pause(true);const ln=(x0,y0,x1,y1,n)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t]);}return a;};
   A.setMedium(1,'oil');A.setHex('#1c2a48');A.setSize(50);A.stroke(ln(.05,.5,.95,.5,30),.8);A.step(5);A.dryAll();A.step(2);
   A.setHex('#f2c21a');A.setBrushOpacity(.35);A.stroke(ln(.3,.1,.3,.9,30),.7);A.setBrushOpacity(.7);A.stroke(ln(.6,.1,.6,.9,30),.7);A.step(5);
   A.setMed('water');A.setBrushOpacity(.4);A.selectPig(3);A.setSize(40);A.stroke(ln(.1,.2,.9,.25,30),.7);A.step(30);
   A.setTool('pencil');A.setBrushOpacity(.5);A.setSize(80);A.stroke(ln(.1,.8,.9,.75,40),.7);A.setTool('brush');A.setBrushOpacity(1);A.step(10);A.dryAll();A.step(2);A.render();});
  const rec=await p.evaluate(()=>{const b=paintAPI.recBytes();const jl=new DataView(b.buffer,b.byteOffset).getUint32(8,true);const j=JSON.parse(new TextDecoder().decode(b.subarray(16,16+jl)));
   const vals=[];for(const e of j.ev){const d=e[0]==='S'||e[0]==='s'?e[3]:null;if(d&&'s.bop' in d)vals.push(d['s.bop']);}return vals;});
  check(rec.includes(.35)&&rec.includes(.7)&&rec.includes(.4)&&rec.includes(.5),'the recording stores each opacity change',rec);
  const L0=await p.evaluate(()=>paintAPI.exportData('lit')[0][1].toDataURL('image/png'));
  await p.evaluate(()=>paintAPI.openReplay());const t0=Date.now();let ok=false;while(Date.now()-t0<60000){if(await p.evaluate(()=>paintAPI.replayState().ready))break;await p.waitForTimeout(200);}
  await p.evaluate(()=>{try{document.getElementById('rpSpd').value='64';document.getElementById('rpSpd').dispatchEvent(new Event('change'));}catch(_){}});
  while(Date.now()-t0<300000){if(await p.evaluate(()=>paintAPI.replayState().done)){ok=true;break;}await p.waitForTimeout(300);}
  check(ok,'replay of the glazed painting reaches the end');
  await p.evaluate(()=>paintAPI.replaySnap());let snap=null;const t1=Date.now();while(!snap&&Date.now()-t1<60000){snap=await p.evaluate(()=>paintAPI.replaySnapResult());if(!snap)await p.waitForTimeout(200);}
  const d=snap?await p.evaluate(async([a,b])=>{const ld=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=s;});const[A,B]=await Promise.all([ld(a),ld(b)]);const c=document.createElement('canvas');c.width=A.width;c.height=A.height;const g=c.getContext('2d');
   g.drawImage(A,0,0);const da=g.getImageData(0,0,c.width,c.height).data;g.clearRect(0,0,c.width,c.height);g.drawImage(B,0,0);const db=g.getImageData(0,0,c.width,c.height).data;let n=0,s=0;
   for(let i=0;i<da.length;i+=4){const x=Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]);s+=x;if(x>48)n++;}return{frac:+(n/(da.length/4)).toFixed(5),mean:+(s/(da.length/4)/3).toFixed(3),size:[A.width,B.width]};},[L0,snap.url]):null;
  check(d&&d.frac<.01&&d.mean<1.5,'replayed glazes match the real painting (pixel diff)',d);
  await p.evaluate(()=>paintAPI.closeReplay&&paintAPI.closeReplay());check(!errs.length,'replay: no page errors',errs.slice(0,3));await ctx.close();}
 }catch(e){console.log('CRASH',e);fails++;}
 await b.close();console.log(fails?`FAILED ${fails} of ${n}`:`ALL PASS ${n}/${n}`);process.exit(fails?1:0);})();
