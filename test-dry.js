// v0.13 regression: a watercolour wash left alone must finish drying (before v0.13 the sim stopped after 45 s idle and froze wet paint).
// Paints a wash, steps a little, simulates 46 s of idle time, then steps until dry. Pass: centre and edge dry within 3000 steps, no errors.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
await p.goto('file://'+__dirname+'/index.html');await p.waitForFunction(()=>window.paintAPI,null,{timeout:20000});await p.waitForTimeout(300);
const r=await p.evaluate(()=>{const A=paintAPI;A.newCanvas(512,512);A.pause(true);A.setMed('water');A.setSize(30);A.setHex('#1f3a93');
 for(let j=0;j<4;j++){const a=[];for(let i=0;i<=20;i++)a.push([.2+.6*i/20,.4+j*.05]);A.stroke(a,.6);}
 for(let i=0;i<200;i++)A.step(1);const w0=A.wet(.5,.47);A.ageIdle(46000);let i=0;for(;i<3000;i++){A.step(1);if(i%50==0&&A.wet(.5,.47)<.001&&A.wet(.25,.47)<.001&&A.wet(.75,.47)<.001)break;}
 return{w0,steps:i,w:A.wet(.5,.47)+A.wet(.25,.47)+A.wet(.75,.47)};});
await b.close();const ok=r.w0>.01&&r.w<.003&&!errs.length;console.log(JSON.stringify(r),errs,ok?'PASS':'FAIL');process.exit(ok?0:1);})();
