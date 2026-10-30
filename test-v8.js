// v8 headless test: layers, blend modes, surfaces, big canvas pan/zoom, exports, project roundtrip. Playwright + SwiftShader.
const {chromium}=require('playwright');const fs=require('fs');const OUT='/workspace/paint-proto/exports-v8';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const errs=[];const p=await b.newPage({viewport:{width:1500,height:900}});
p.on('pageerror',x=>errs.push(''+x));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels/.test(m.text()))errs.push(m.text());});
await p.goto('file://'+__dirname+'/index.html');await p.waitForTimeout(800);
const ev=(f,a)=>p.evaluate(f,a);
await ev(()=>{window.LN=(x0,y0,x1,y1,n=24)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t+.02*Math.sin(t*3)]);}return a;};});
// 1. multi-layer painting: oil bg, watercolour layer multiply, oil layer, knife
const r1=await ev(()=>{const A=paintAPI;A.pause(true);A.setMedium(1);A.setSize(60);
 const cols=[3,2,5,1];cols.forEach((c,i)=>{A.selectPig(c);A.stroke(LN(.08,.2+i*.17,.55,.25+i*.17));});A.step(30);
 A.L.add();A.L.rename(1,'Wash');A.setMedium(0);A.setWLoad(.8);A.selectPig(1);A.setSize(70);A.stroke(LN(.35,.15,.9,.8));A.step(60);A.L.blend('multiply');
 A.L.add();A.L.rename(2,'Highlights');A.setMedium(1);A.selectPig(0);A.setSize(30);A.stroke(LN(.6,.85,.95,.3));A.setTool('knife');A.stroke(LN(.15,.9,.5,.75));A.setTool('brush');A.step(20);
 return {layers:A.layers(),info:A.info()};});
console.log('layers',JSON.stringify(r1.layers));
await p.screenshot({path:'screenshot-v8.png'});
// blend modes: screenshot each mode on the wash layer
const blendShots=[];for(const m of ['normal','multiply','screen','overlay']){await ev(m=>{paintAPI.L.select(1);paintAPI.L.blend(m);paintAPI.render();},m);
 blendShots.push(await p.screenshot({clip:{x:274,y:90,width:960,height:720}}));}
for(const[i,s]of blendShots.entries())fs.writeFileSync('/tmp/blend'+i+'.png',s);
// undo covers layer ops
const u=await ev(()=>{const A=paintAPI;const n=A.layers().length;A.L.add();A.L.del();A.undo();const a=A.layers().length;A.undo();return [n,a,A.layers().length];});console.log('undo layer ops',u);
// visibility, reorder, merge
const m=await ev(()=>{const A=paintAPI;A.L.vis(0,false);A.L.vis(0,true);A.L.select(2);A.L.down();A.L.up();A.L.merge();return A.layers().map(l=>l.name);});console.log('after merge',m);
await ev(()=>paintAPI.undo());
// exports
const ex=await ev(async()=>{const A=paintAPI;const o={};for(const[k,x2]of [['lit',0],['flat',0],['height',0],['normal',0],['layers',0],['lit',1]])for(const[n,c]of A.exportData(k,x2))o[n]=c.toDataURL('image/png');
 const bytes=await A.saveProjectBytes();o['painting.mpaint']=btoa(Array.from(bytes,c=>String.fromCharCode(c)).join(''));return o;});
for(const[n,d]of Object.entries(ex))fs.writeFileSync(OUT+'/'+n,Buffer.from(d.replace(/^data:image\/png;base64,/,''),'base64'));
console.log('exports',Object.keys(ex).map(n=>n+':'+fs.statSync(OUT+'/'+n).size));
// project roundtrip: wipe doc, reopen, compare flat export
const rt=await ev(async(b64)=>{const A=paintAPI;const px=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;const before=px(A.exportData('flat')[0][1]);
 A.newCanvas(1024,768);const blank=px(A.exportData('flat')[0][1]);const by=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await A.openProjectBytes(by);A.render();
 const after=px(A.exportData('flat')[0][1]);let d=0,d0=0;for(let i=0;i<before.length;i++){d=Math.max(d,Math.abs(before[i]-after[i]));d0+=Math.abs(before[i]-blank[i]);}
 return {maxDiff:d,meanDiffVsBlank:d0/before.length,layers:A.layers().map(l=>l.name)};},ex['painting.mpaint']);console.log('roundtrip',JSON.stringify(rt));
// keep painting after reload (oil still works)
await ev(()=>{const A=paintAPI;A.setMedium(1);A.selectPig(4);A.stroke(LN(.2,.5,.4,.55));A.step(10);});
await p.screenshot({path:'/tmp/after-reload.png'});
// 2. surfaces: same strokes on each
const names=['Cold-press','Hot-press','Rough','Linen','Cotton weave','Panel'];const surf=[];
for(let t=0;t<6;t++){await ev(t=>{const A=paintAPI;A.newCanvas(1024,768);A.setSurface({type:t,scale:1,ground:t>=3?'#d9cbb2':'#f6f0e4'});A.setRelief&&0;
 A.setMedium(0);A.setWLoad(.75);A.selectPig(6);A.setSize(70);A.stroke(LN(.05,.3,.48,.3));A.selectPig(1);A.stroke(LN(.05,.55,.48,.6));A.step(80);
 A.setMedium(1);A.selectPig(3);A.setSize(50);A.stroke(LN(.55,.3,.95,.35).map(q=>[q[0],q[1],.3]));A.selectPig(2);A.setShape('flat');A.stroke(LN(.55,.65,.95,.6));A.setShape('round');A.step(20);
 A.fit();A.render();},t);
 surf.push(await p.screenshot({clip:{x:274,y:90,width:960,height:720}}));}
// 3. big canvas + pan/zoom
const big=await ev(()=>{const A=paintAPI;const r=A.newCanvas(2048,1536);const t0=performance.now();A.setMedium(1);A.selectPig(3);A.setSize(80);A.stroke(LN(.1,.5,.9,.5));A.step(10);const ms=performance.now()-t0;
 const tooBig=A.newCanvas(9000,9000);A.zoom(.5,.5,4);return {r,ms:Math.round(ms),tooBig,info:A.info(),view:{...A.view}};});console.log('big',JSON.stringify(big));
await p.screenshot({path:'/tmp/big-zoom.png'});
await p.mouse.move(500,300);await p.keyboard.down('Space');await p.mouse.down();await p.mouse.move(700,400,{steps:5});await p.mouse.up();await p.keyboard.up('Space');
await p.mouse.wheel(0,300);await p.waitForTimeout(200);const v2=await ev(()=>({...paintAPI.view}));console.log('after pan+wheel',JSON.stringify(v2));
await p.screenshot({path:'/tmp/big-pan.png'});
// compose texture sheet
const sheet=await ev(async([imgs,names])=>{const c=document.createElement('canvas');c.width=960*3;c.height=(720+30)*2;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.font='22px sans-serif';g.fillStyle='#222';
 for(let i=0;i<6;i++){const im=new Image();im.src='data:image/png;base64,'+imgs[i];await im.decode();const x=(i%3)*960,y=Math.floor(i/3)*750;g.drawImage(im,x,y+30);g.fillText(names[i],x+10,y+22);}return c.toDataURL('image/png');},[surf.map(s=>s.toString('base64')),names]);
fs.writeFileSync('screenshot-v8-textures.png',Buffer.from(sheet.split(',')[1],'base64'));
const bs=await ev(async imgs=>{const c=document.createElement('canvas');c.width=960*2;c.height=750*2;const g=c.getContext('2d');g.font='22px sans-serif';const n=['normal','multiply','screen','overlay'];
 for(let i=0;i<4;i++){const im=new Image();im.src='data:image/png;base64,'+imgs[i];await im.decode();g.fillStyle='#fff';g.fillRect((i%2)*960,Math.floor(i/2)*750,960,30);g.drawImage(im,(i%2)*960,Math.floor(i/2)*750+30);g.fillStyle='#222';g.fillText('Wash layer: '+n[i],(i%2)*960+10,Math.floor(i/2)*750+22);}return c.toDataURL();},blendShots.map(s=>s.toString('base64')));
fs.writeFileSync('screenshot-v8-blends.png',Buffer.from(bs.split(',')[1],'base64'));
console.log('ERRORS',errs.length?errs:'none');await b.close();})();
