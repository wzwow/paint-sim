// v0.12 watercolour wet-time: paints a Water stroke, steps the sim and counts steps until the stroke centre is dry (water < .003).
// Compares v11.3 (index-v11.html + wet() probe) with the current build, and the current build after Ink was selected and then Water again.
// Pass: current Water wet-time >= v11.3, and after ink->water also >= v11.3.
const {chromium}=require('playwright');const fs=require('fs');
const OLD='file://'+__dirname+'/_old_wet.html';
async function wetTime(b,url,pre){const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
 await p.goto(url);await p.waitForFunction(()=>window.paintAPI,null,{timeout:20000});await p.waitForTimeout(300);
 const n=await p.evaluate(pre=>{const A=paintAPI;A.pause(true);A.setSize(30);
  if(pre==='ink'){A.setMed('ink');A.setHex('#1f3a93');A.stroke([[.2,.2],[.8,.2]],.6);}
  if(A.setMed)A.setMed('water');else A.setMedium(0);A.setHex('#1f3a93');A.stroke([[.2,.5],[.5,.5],[.8,.5]],.6);
  let i=0;for(;i<3000;i++){A.step(1);if(A.wet(.5,.5)<.003)break;}return i;},pre);
 await p.close();if(errs.length)throw new Error(errs.join());return n;}
(async()=>{const s=fs.readFileSync(__dirname+'/index.html','utf8');const i=s.indexOf(' wet(x,y)'),j=s.indexOf(' info:()=>({',i);
 fs.writeFileSync(__dirname+'/_old_wet.html',fs.readFileSync(__dirname+'/index-v11.html','utf8').replace(' info:()=>({',s.slice(i,j)+' info:()=>({'));
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const old=await wetTime(b,OLD),cur=await wetTime(b,'file://'+__dirname+'/index.html'),after=await wetTime(b,'file://'+__dirname+'/index.html','ink');
 await b.close();fs.unlinkSync(__dirname+'/_old_wet.html');
 const ok=cur>=old&&after>=old;console.log(`wet steps (until centre dry; app runs 120 steps/s): v11.3=${old} v0.12=${cur} v0.12 after ink->water=${after} -> ${ok?'PASS':'FAIL'}`);process.exit(ok?0:1);})();
