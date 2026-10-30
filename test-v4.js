// v4 headless test: same strokes with Dynamics 0 (left) vs 1 (right). Playwright + SwiftShader.
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1500,height:900}});const errs=[];
p.on('console',m=>{if((m.type()==='error'||m.type()==='warning')&&!/ReadPixels/.test(m.text()))errs.push(m.text())});p.on('pageerror',e=>errs.push(''+e));
await p.goto('file:///workspace/paint-proto/index.html');await p.waitForTimeout(800);
const r=await p.evaluate(async()=>{const A=window.paintAPI;A.pause(true);const cv=document.getElementById('c');const log=[];
const path=(f,n,dt,pr)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;const[x,y]=f(t);a.push([x,y,pr?pr(t):.6,dt]);}return a;};
const rows=[ // [label, builder(x0) ]
 ['fast',x0=>path(t=>[x0+.06+t*.34,.88],24,3)],
 ['slow',x0=>path(t=>[x0+.06+t*.34,.74],60,30)],
 ['press + flick',x0=>path(t=>[x0+.06+t*.30,.58+.03*Math.sin(t*3)],40,t=>0,t=>Math.min(1,.25+t*2.2))],
 ['S-curve',x0=>path(t=>[x0+.07+t*.32,.33+.11*Math.sin(t*Math.PI*2)],70,8)],
 ['zig-zag',x0=>path(t=>{const k=t*4,f=k-Math.floor(k);return[x0+.07+t*.32,.12+(Math.floor(k)%2?.07-.07*2*f:-.07+.07*2*f)]},80,6)]];
A.setMedium(1);A.setTool('brush');A.setSize(44);
const pigs=[1,3,5,6,7];
for(const[D,x0]of[[0,0],[1,.5]]){A.setDyn(D);rows.forEach(([l,f],i)=>{A.setShape(i===3?'flat':i===1?'filbert':'round');A.selectPig(pigs[i]);
 let pts=f(x0);if(i===2){pts=pts.map((q,j)=>[q[0],q[1],q[2],j<10?40:j>32?2:10]);} // press slowly, accelerate into lift-off flick
 A.stroke(pts,.6);});
 log.push(['D',D,'undo',A.info().undo]);}
A.step(5);
const full=cv.toDataURL();
const snap=async(cx,cy,s)=>{A.zoom(cx,cy,s);const im=new Image();im.src=cv.toDataURL();await im.decode();return im;};
const ims=[await snap(.27,.6,3.2),await snap(.77,.6,3.2),await snap(.25,.33,3),await snap(.75,.33,3)];A.zoom(.5,.5,1);
const lab=async(src,labels)=>{const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=1200;c.height=800;const g=c.getContext('2d');g.drawImage(im,0,0);
 g.font='bold 18px sans-serif';g.fillStyle='#000b';labels(g);return c.toDataURL();};
const panel=await lab(full,g=>{g.fillRect(598,0,4,800);g.fillText('Dynamics 0 (v3 behaviour)',20,24);g.fillText('Dynamics 100%',620,24);
 g.font='14px sans-serif';rows.forEach(([l],i)=>{const y=[.88,.74,.58,.33,.12][i];g.fillText(l,8,(1-y)*800-38);g.fillText(l,608,(1-y)*800-38);});});
const cc=document.createElement('canvas');cc.width=1200;cc.height=800;const g=cc.getContext('2d');ims.forEach((im,i)=>g.drawImage(im,(i%2)*600,Math.floor(i/2)*400,600,400));
g.fillStyle='#fff';g.fillRect(598,0,4,800);g.fillRect(0,398,1200,4);g.font='bold 16px sans-serif';g.fillStyle='#000b';
['Dyn 0: press+flick','Dyn 100%: press+flick','Dyn 0: S-curve (flat)','Dyn 100%: S-curve (flat)'].forEach((l,i)=>g.fillText(l,(i%2)*600+10,Math.floor(i/2)*400+22));
// undo check
const u0=A.info().undo;A.undo();const u1=A.info().undo;
// cursor overlay + simulated mouse pressure via real mouse-like events
return [log,panel,cc.toDataURL(),[u0,u1]];});
const w=(f,d)=>fs.writeFileSync(f,Buffer.from(d.split(',')[1],'base64'));
w('/workspace/paint-proto/screenshot-v4.png',r[1]);w('/workspace/paint-proto/screenshot-v4-closeup.png',r[2]);
// real mouse stroke (simulated pressure from speed) + hover cursor
await p.evaluate(()=>{window.paintAPI.pause(false);});await p.mouse.move(800,300);await p.mouse.down();await p.mouse.move(1000,350,{steps:4});await p.mouse.move(1050,360,{steps:30});await p.mouse.up();
await p.mouse.move(900,500);await p.waitForTimeout(400);await p.screenshot({path:'/tmp/ui4.png'});
console.log(JSON.stringify(r[0]),'undo',r[3],'errors:',errs);await b.close();})();
