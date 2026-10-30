// v7 headless test: v6 vs v7 watercolour. Playwright + SwiftShader.
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const errs=[];const shots={};
for(const f of ['index-v6.html','index.html']){const p=await b.newPage({viewport:{width:1500,height:900}});
 p.on('console',m=>{if((m.type()==='error'||m.type()==='warning')&&!/ReadPixels/.test(m.text()))errs.push(f+': '+m.text())});p.on('pageerror',e=>errs.push(f+': '+e));
 await p.goto('file:///workspace/paint-proto/'+f);await p.waitForTimeout(800);
 shots[f]=await p.evaluate(async()=>{const A=window.paintAPI;A.pause(true);const cv=document.getElementById('c');
 const path=(fn,n,dt=16)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;const[x,y]=fn(t);a.push([x,y,.6,dt]);}return a;};
 const hline=(x0,x1,y,n=30,dt=16)=>path(t=>[x0+(x1-x0)*t,y],n,dt);
 const wl=v=>{if(A.setWLoad)A.setWLoad(v);};
 A.setMedium(0);A.setTool('brush');A.setShape('round');A.setDyn(.6);wl(.75);
 // F: yellow wash, dried completely, glazed later
 A.selectPig(2);A.setSize(60);for(let k=0;k<4;k++)A.stroke(hline(.72,.95,.38-k*.07),.6);A.step(30);A.dryAll();A.step(2);
 // D: sienna wash, partially dried, then clear water dropped in -> bloom/backrun
 A.selectPig(6);A.setSize(60);for(let k=0;k<4;k++)A.stroke(hline(.05,.28,.38-k*.07),.6);A.step(320);
 A.selectPig(0);A.setSize(26);A.stroke(hline(.13,.18,.27,6),.7);
 // B: pre-wet with clear water, then alizarin through it
 A.selectPig(0);A.setSize(70);for(let k=0;k<4;k++)A.stroke(hline(.38,.62,.9-k*.075),.6);A.step(40);
 A.selectPig(4);A.setSize(30);A.stroke(path(t=>[.4+.2*t,.75+.06*Math.sin(t*6)],30),.6);
 // A: wet-on-dry stroke
 A.selectPig(1);A.setSize(40);A.stroke(path(t=>[.05+.23*t,.75+.06*Math.sin(t*6)],30),.6);
 // C: two colours touching -> bleed
 A.selectPig(2);A.setSize(50);A.stroke(hline(.72,.95,.80),.6);A.selectPig(1);A.stroke(hline(.72,.95,.70),.6);
 // E: dry brush (low water load, fast)
 A.selectPig(7);A.setSize(50);wl(.1);A.stroke(hline(.38,.62,.30,30,3),.5,{load:.2});A.stroke(path(t=>[.38+.24*t,.18+.04*Math.sin(t*5)],30,3),.5,{load:.2});wl(.75);
 // F: glaze ultramarine across the dried yellow wash
 A.selectPig(1);A.setSize(36);A.stroke(path(t=>[.74+.2*t,.12+.3*t],30),.6);
 A.step(500);
 const u=A.info().undo;A.undo();A.selectPig(1);A.setSize(36);A.stroke(path(t=>[.74+.2*t,.12+.3*t],30),.6);A.step(300);
 const full=cv.toDataURL();A.zoom(.5,.75,2.6);const z1=cv.toDataURL();A.zoom(.83,.75,2.6);const z2=cv.toDataURL();A.zoom(.5,.5,1);return [full,z1,z2,u];});
 await p.close();}
const p=await b.newPage();
const out=await p.evaluate(async(S)=>{const L=async s=>{const im=new Image();im.src=s;await im.decode();return im;};
 const c=document.createElement('canvas');c.width=1200;c.height=1610;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,1200,1610);
 g.drawImage(await L(S['index-v6.html'][0]),0,0);g.drawImage(await L(S['index.html'][0]),0,810);
 const labs=[['wet-on-dry',0,0],['wet-on-wet (pre-wet)',1,0],['two colours bleeding',2,0],['bloom / backrun',0,1],['bristle dry-brush',1,1],['glaze over dry wash',2,1]];
 for(const[off,v]of[[0,'v6'],[810,'v7']]){g.font='bold 22px sans-serif';g.fillStyle='#000c';g.fillText(v,12,off+28);g.font='15px sans-serif';
  labs.forEach(([l,cx,cy])=>g.fillText(l,cx*400+50,off+cy*400+50));}
 const d=document.createElement('canvas');d.width=1200;d.height=800;const h=d.getContext('2d');
 const im=[await L(S['index-v6.html'][1]),await L(S['index.html'][1]),await L(S['index-v6.html'][2]),await L(S['index.html'][2])];
 im.forEach((x,i)=>h.drawImage(x,(i%2)*600,Math.floor(i/2)*400,600,400));h.fillStyle='#fff';h.fillRect(598,0,4,800);h.fillRect(0,398,1200,4);
 h.font='bold 16px sans-serif';h.fillStyle='#000c';['v6 wet-on-wet','v7 wet-on-wet: feathered edges','v6 two colours','v7 two colours bleeding'].forEach((l,i)=>h.fillText(l,(i%2)*600+10,Math.floor(i/2)*400+22));
 return [c.toDataURL(),d.toDataURL()];},shots);
const w=(f,d)=>fs.writeFileSync(f,Buffer.from(d.split(',')[1],'base64'));
w('/workspace/paint-proto/screenshot-v7.png',out[0]);w('/workspace/paint-proto/screenshot-v7-closeup.png',out[1]);
console.log('undo v6/v7',shots['index-v6.html'][3],shots['index.html'][3],'errors:',errs);await b.close();})();
