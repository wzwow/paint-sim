// v6 headless test: v5 vs v6, same strokes at Dynamics 100%. Playwright + SwiftShader.
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const errs=[];const shots={};
for(const f of ['index-v5.html','index.html']){const p=await b.newPage({viewport:{width:1500,height:900}});
 p.on('console',m=>{if((m.type()==='error'||m.type()==='warning')&&!/ReadPixels/.test(m.text()))errs.push(f+': '+m.text())});p.on('pageerror',e=>errs.push(f+': '+e));
 await p.goto('file:///workspace/paint-proto/'+f);await p.waitForTimeout(800);
 shots[f]=await p.evaluate(async()=>{const A=window.paintAPI;A.pause(true);const cv=document.getElementById('c');
 const path=(fn,n,dt,pr)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;const[x,y]=fn(t);a.push([x,y,pr?pr(t):.6,dt]);}return a;};
 const rows=[['fast straight',path(t=>[.08+t*.8,.9],30,3)],
  ['fast curve',path(t=>[.08+t*.75,.72+.08*Math.sin(t*Math.PI*1.2)],40,3)],
  ['curved flick',path(t=>{const a=-1.9+t*1.5;return[.36+.26*Math.cos(a),.62+.3*Math.sin(a)*1.5]},60,0,t=>Math.min(1,.3+t*2)).map((q,j)=>[q[0],q[1],q[2],j<15?30:j>45?2:8])],
  ['S-curve',path(t=>[.08+t*.8,.36+.09*Math.sin(t*Math.PI*2)],140,8)],
  ['slow (ridges)',path(t=>[.08+t*.8,.12],140,30)]];
 A.setMedium(1);A.setTool('brush');A.setSize(40);A.setDyn(1);const pigs=[1,3,5,6,7];
 rows.forEach(([l,pts],i)=>{A.setShape(i===3?'flat':'round');A.selectPig(pigs[i]);A.stroke(pts,.6);});
 A.step(5);const u=A.info().undo;A.undo();A.selectPig(7);A.setShape('round');A.stroke(rows[4][1],.6);A.step(2); // undo + redo zig-zag
 const full=cv.toDataURL();A.zoom(.55,.88,3.5);const g=cv.toDataURL();A.zoom(.55,.42,2.6);const fl=cv.toDataURL();A.zoom(.5,.5,1);return [full,g,fl,u];});
 await p.close();}
const p=await b.newPage();
const out=await p.evaluate(async(S)=>{const L=async s=>{const im=new Image();im.src=s;await im.decode();return im;};
 const mk=async(a,b2,la,lb,lab)=>{const c=document.createElement('canvas');c.width=1200;c.height=lab?1100:800;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
  const ia=await L(a),ib=await L(b2);const h=lab?540:396;g.drawImage(ia,0,0,1200,800,0,0,lab?1200*.675:600,h);return {c,g,ia,ib};};
 // full comparison: stacked v5 / v6
 const c=document.createElement('canvas');c.width=1200;c.height=1610;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,1200,1610);
 const a=await L(S['index-v5.html'][0]),bb=await L(S['index.html'][0]);g.drawImage(a,0,0);g.drawImage(bb,0,810);
 g.font='bold 22px sans-serif';g.fillStyle='#000c';g.fillText('v5 — Dynamics 100%',16,30);g.fillText('v6 — Dynamics 100%',16,840);
 g.font='15px sans-serif';const ys=[.9,.76,.5,.38,.12],ls=['fast straight','fast curve','curved flick','S-curve','slow (ridges)'];for(const off of[0,810])ls.forEach((l,i)=>g.fillText(l,8,off+(1-ys[i])*800-36));
 // closeup 2x2: fast strokes v5/v6, flick v5/v6
 const d=document.createElement('canvas');d.width=1200;d.height=800;const h=d.getContext('2d');
 const im=[await L(S['index-v5.html'][1]),await L(S['index.html'][1]),await L(S['index-v5.html'][2]),await L(S['index.html'][2])];
 im.forEach((x,i)=>h.drawImage(x,(i%2)*600,Math.floor(i/2)*400,600,400));h.fillStyle='#fff';h.fillRect(598,0,4,800);h.fillRect(0,398,1200,4);
 h.font='bold 16px sans-serif';h.fillStyle='#000c';['v5 fast stroke (3.5x)','v6 fast stroke: dry streaks (3.5x)','v5 flick tail','v6 curved flick tail'].forEach((l,i)=>h.fillText(l,(i%2)*600+10,Math.floor(i/2)*400+22));
 return [c.toDataURL(),d.toDataURL()];},shots);
const w=(f,d)=>fs.writeFileSync(f,Buffer.from(d.split(',')[1],'base64'));
w('/workspace/paint-proto/screenshot-v6.png',out[0]);w('/workspace/paint-proto/screenshot-v6-closeup.png',out[1]);
console.log('undo stack v5/v6',shots['index-v5.html'][3],shots['index.html'][3],'errors:',errs);await b.close();})();
