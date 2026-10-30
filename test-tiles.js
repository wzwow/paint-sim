// v12 regression: sim scratch buffer overflow on canvases whose sides aren't multiples of 128 (grey bars / black 128px blocks).
// Paints many short strokes in separated columns (=> several disjoint awake spans per tile row), steps, Dry all, steps;
// then checks that unpainted regions between the columns stay exactly empty and nothing is NaN/Inf.
const {chromium}=require('playwright');
const URL=process.argv[2]||('file://'+__dirname+'/index.html');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});let fail=0;
for(const [w,h] of [[1500,800],[1000,700]]){const p=await (await b.newContext({viewport:{width:1200,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI,null,{timeout:20000});await p.waitForTimeout(400);
 const r=await p.evaluate(([w,h])=>{const A=paintAPI;A.newCanvas(w,h);A.fit();A.pause(true);A.setSize(24);
  const cols=[];for(let x=60;x<w-60;x+=384)cols.push(x); // painted columns; gaps of ~2 tiles in between
  for(const m of ['oil','acrylic','water'])for(const x of cols){A.setMed(m);A.setHex('#20262e');for(let y=40;y<h-40;y+=70){A.stroke([[x/w,y/h],[(x+60)/w,(y+20)/h],[(x+110)/w,y/h]],.7);}}
  for(let i=0;i<20;i++)A.step(1);A.dryAll();for(let i=0;i<40;i++)A.step(1);A.dryAll();A.pause(false);
  const gaps=[];for(const x of cols){const gx=x+200;if(gx+90<w)gaps.push(A.regionMax(gx,0,90,h));}
  const all=A.regionMax(0,0,w,h);return{gaps,all};},[w,h]);
 const bad=r.gaps.some(g=>g.some(v=>v>1e-6))||r.all.some(v=>!isFinite(v));
 console.log((bad?'FAIL ':'PASS ')+w+'x'+h+' gap max='+JSON.stringify(r.gaps.map(g=>g.map(v=>+v.toPrecision(2))))+' finite='+r.all.every(isFinite)+(errs.length?' errors '+errs:''));
 if(bad||errs.length)fail=1;}
await b.close();process.exit(fail);})();
