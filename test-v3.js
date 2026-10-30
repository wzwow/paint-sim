// v3 headless test: Playwright + SwiftShader. Scripted strokes incl. synthetic pen pointer events with tiltX/tiltY/pressure.
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1500,height:900}});const errs=[];
p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text())});p.on('pageerror',e=>errs.push(''+e));
await p.goto('file:///workspace/paint-proto/index.html');await p.waitForTimeout(800);
const r=await p.evaluate(async()=>{const A=window.paintAPI;if(!A)return ['noapi'];A.pause(true);const log=[];const cv=document.getElementById('c');
const line=(x0,y0,x1,y1,n=30)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t]);}return a;};
const wave=(x0,y,len,amp,ph,n=40)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+t*len,y+amp*Math.sin(t*6+ph)]);}return a;};
// synthetic pen stroke through real PointerEvents (pressure, tiltX, tiltY)
function pen(pts,pres,tiltX,tiltY){const R=cv.getBoundingClientRect();const ev=(type,[x,y])=>cv.dispatchEvent(new PointerEvent(type,{pointerId:7,pointerType:'pen',isPrimary:true,bubbles:true,
 clientX:R.left+x*R.width,clientY:R.top+(1-y)*R.height,pressure:pres,tiltX,tiltY,buttons:1}));
 ev('pointerdown',pts[0]);for(const q of pts.slice(1))ev('pointermove',q);ev('pointerup',pts[pts.length-1]);}
const UN=A.info().undo;
// ===== OIL =====
A.setMedium(1);A.setTool('brush');A.setStiff(.5);
// top row: four brush shapes
A.setSize(46);
A.setShape('round');A.selectPig(1);A.stroke(wave(.03,.86,.21,.03,0),.6);
A.setShape('flat');A.selectPig(3);A.stroke(wave(.27,.86,.21,.03,1),.6);
A.setShape('filbert');A.selectPig(5);A.stroke(wave(.51,.86,.21,.03,2),.6);
A.setShape('fan');A.selectPig(7);A.setSize(56);A.stroke(wave(.75,.86,.21,.03,3),.55);
// middle row: multi-colour flat stroke, dry-brush round, tilted side stroke (pen events)
A.setShape('flat');A.setSize(56);A.multi(['#f6c81a','#d0281c','#1f3a93']);A.stroke(wave(.03,.62,.27,.04,0),.65);A.multi(null);
A.setShape('round');A.setSize(46);A.selectPig(6);A.stroke(line(.35,.62,.62,.62),.35,{load:.22});   // brush low on paint -> broken dry-brush
A.selectPig(2);A.setBTilt(0);pen(wave(.68,.60,.28,.025,0,30),.7,0,60);       // pen tilted 60 deg (tiltY) -> side of brush
log.push(['tilted-pen-stroke-height',A.probe(.80,.60)[0][0]]);
// bottom row base layers: scrape target (red, dried) and spread target
A.setShape('flat');A.setSize(60);A.selectPig(3);for(let k=0;k<3;k++)A.stroke(line(.36,.12+k*.08,.62,.14+k*.08),.7);
A.step(10);A.dryAll();
A.selectPig(1);for(let k=0;k<3;k++)A.stroke(line(.36,.13+k*.08,.62,.15+k*.08),.75);    // wet blue over dried red
A.selectPig(8);A.setShape('round');A.setSize(40);for(let k=0;k<4;k++)A.stroke(line(.06,.14+k*.06,.12,.16+k*.06,6),.8);  // white dollops
A.selectPig(2);for(let k=0;k<3;k++)A.stroke(line(.14,.16+k*.07,.18,.18+k*.07,6),.8);                                       // yellow dollops
log.push(['before-knife',A.volume()]);
// palette knife
A.setTool('knife');A.setSize(60);
A.setKMode('spread');A.stroke(line(.04,.30,.27,.24,40),.5);A.stroke(line(.05,.16,.28,.12,40),.45);   // spread
log.push(['after-spread',A.volume()]);
A.setKMode('scrape');A.stroke(line(.38,.33,.60,.08,40),.8);A.setBAng(25);A.setFollow(true);A.stroke(line(.47,.33,.58,.20,30),.8);A.setBAng(0);  // scrape over dried
A.setKMode('lay');A.selectPig(8);A.setSize(48);A.stroke(line(.66,.32,.78,.30,30),.5);A.selectPig(4);A.stroke(line(.67,.22,.79,.20,30),.5);A.selectPig(2);A.stroke(line(.66,.13,.78,.08,30),.55);
// ===== WATERCOLOUR round brush =====
A.setMedium(0);A.setTool('brush');A.setShape('round');A.setSize(50);A.selectPig(1);A.stroke(wave(.83,.25,.14,.04,0,30),.6);
A.step(250);
log.push(['after-all',A.volume()]);
// undo test: undo 1 (watercolour) and redo-free check that undo stack grew per stroke
log.push(['undo-count',A.info().undo-UN]);
const t0=performance.now();A.step(10);const ms=(performance.now()-t0)/10;
A.setMedium(1);A.setTool('brush');A.setSize(46);const t1=performance.now();A.stroke(line(.1,.45,.3,.45,20),.6);const msStroke=performance.now()-t1;A.undo();
const full=cv.toDataURL();const snap=async(cx,cy,s)=>{A.zoom(cx,cy,s);const im=new Image();im.src=cv.toDataURL();await im.decode();return im;};
const ims=[await snap(.33,.86,4),await snap(.14,.64,4),await snap(.50,.20,4),await snap(.72,.22,4)];A.zoom(.5,.5,1);
const cc=document.createElement('canvas');cc.width=1200;cc.height=800;const g=cc.getContext('2d');ims.forEach((im,i)=>g.drawImage(im,(i%2)*600,Math.floor(i/2)*400,600,400));
g.fillStyle='#fff';g.fillRect(598,0,4,800);g.fillRect(0,398,1200,4);g.font='16px sans-serif';g.fillStyle='#000a';['flat bristle grooves','multi-colour flat','knife scrape over dried red','laid slabs (knife)'].forEach((l,i)=>g.fillText(l,(i%2)*600+10,Math.floor(i/2)*400+22));
const c1=cc.toDataURL(),c2=c1;
return [JSON.stringify(A.info()),log,ms,msStroke,full,c1,c2];});
if(r[0]==='noapi'){console.log('noapi',errs);process.exit(1)}
const w=(f,d)=>fs.writeFileSync(f,Buffer.from(d.split(',')[1],'base64'));
w('/workspace/paint-proto/screenshot-v3.png',r[4]);w('/workspace/paint-proto/screenshot-v3-closeup.png',r[5]);
console.log(r[0],JSON.stringify(r[1]),'ms/step',r[2].toFixed(1),'ms/stroke',r[3].toFixed(0),'errors:',errs);await b.close();})();
