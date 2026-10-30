const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1500,height:900}});const errs=[];
p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text())});p.on('pageerror',e=>errs.push(''+e));
await p.goto('file:///workspace/paint-proto/index.html');await p.waitForTimeout(800);
const r=await p.evaluate(async()=>{const A=window.paintAPI;if(!A)return ['noapi'];A.pause(true);const log=[];
const line=(x0,y0,x1,y1,n=30)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t]);}return a;};
const wave=(x0,y,len,amp,ph)=>{const a=[];for(let i=0;i<=40;i++){const t=i/40;a.push([x0+t*len,y+amp*Math.sin(t*6+ph)]);}return a;};
// ---- (a) OIL impasto, right third ----
A.setMedium(1);A.setSize(50);
A.selectPig(8);A.stroke(wave(.69,.80,.27,.035,0));A.stroke(wave(.69,.74,.27,.035,.6)); // two overlapping white strokes (wet)
A.selectPig(2);A.stroke(wave(.70,.70,.25,.03,1.4));                                  // yellow over wet white: stacks + mixes
log.push(A.volume());A.step(20);A.dryAll();log.push(A.volume());
A.selectPig(3);A.stroke(line(.72,.88,.80,.56));A.stroke(line(.75,.88,.83,.56));       // red over the dried layers
A.selectPig(1);A.setSize(40);for(let k=0;k<4;k++){A.stroke(line(.86,.62+k*.01,.93,.70+k*.01,12));A.stroke(line(.93,.71,.86,.63,12));} // piled blue mound
log.push(A.volume(),A.probe(.92,.61),A.probe(.90,.66));
A.selectPig(8);A.setSize(34);A.stroke(wave(.70,.47,.27,.025,0));                     // white
A.selectPig(3);A.stroke(line(.71,.40,.96,.40));A.selectPig(1);A.stroke(line(.71,.35,.96,.35));
A.selectPig(8);A.setSize(44);A.stroke(line(.72,.33,.96,.43));                         // dirty-brush drag through wet red/blue/white
// ---- (b) watercolour, left ----
A.setMedium(0);A.setSize(60);
A.selectPig(1);A.stroke(wave(.04,.78,.24,.04,0));A.stroke(wave(.04,.72,.24,.04,0));A.step(60);
A.selectPig(6);A.stroke(wave(.05,.45,.22,.03,2));A.step(650);       // let it partly dry
A.setSize(26);A.selectPig(0);A.stroke(line(.11,.47,.13,.45,4));  // water into drying area -> bloom
A.selectPig(4);A.setSize(40);A.stroke(line(.06,.22,.28,.15));A.stroke(line(.14,.28,.16,.10)); // wet-on-wet cross
A.step(400);
// ---- (c) mid medium ----
A.setMedium(.45);A.setSize(44);A.selectPig(5);A.stroke(wave(.37,.72,.26,.05,0));A.selectPig(2);A.stroke(wave(.37,.62,.26,.05,1));
A.setMedium(.3);A.selectPig(3);A.stroke(line(.38,.35,.62,.30));A.setMedium(.65);A.selectPig(7);A.stroke(line(.38,.22,.62,.18));
A.step(300);log.push(A.volume(),A.probe(.92,.61));
const t0=performance.now();A.step(20);const ms=(performance.now()-t0)/20;
const full=document.getElementById('c').toDataURL();A.zoom(.83,.70,2.6);const close=document.getElementById('c').toDataURL();A.zoom(.2,.6,2.5);const wc=document.getElementById('c').toDataURL();A.zoom(.5,.5,1);
return [JSON.stringify(A.info()),log,ms,full,close,wc];});
if(r[0]==='noapi'){console.log('noapi',errs);process.exit(1)}
const fs=require('fs');fs.writeFileSync('/workspace/paint-proto/screenshot-v2.png',Buffer.from(r[3].split(',')[1],'base64'));
fs.writeFileSync('/workspace/paint-proto/screenshot-impasto-closeup.png',Buffer.from(r[4].split(',')[1],'base64'));
fs.writeFileSync('/workspace/paint-proto/wc-closeup.png',Buffer.from(r[5].split(',')[1],'base64'));console.log(r[0],JSON.stringify(r[1]),'ms/step(swiftshader)',r[2].toFixed(1),'errors:',errs);await b.close();})();
