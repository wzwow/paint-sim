// v0.35 Pencil tool tests. Usage: node test-pencil.js [url|file]
const {chromium}=require('playwright');const path=require('path');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(ok,n,d)=>{if(!ok)fails++;console.log((ok?'  PASS ':'  FAIL ')+n+(ok?'':'  → '+JSON.stringify(d)));};
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
(async()=>{const b=await chromium.launch({args:GL});const errs=[];
const open=async(ctx)=>{const p=await (await b.newContext(ctx)).newPage();p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels/.test(m.text()))errs.push(m.text())});await p.goto(URL);await p.waitForFunction(()=>window.paintAPI,null,{timeout:20000});await p.waitForTimeout(800);return p;};
// desktop: button + key
let p=await open({viewport:{width:1440,height:900}});
await p.evaluate(()=>paintAPI.setTool('brush'));await p.click('#dPencil');
check(await p.evaluate(()=>paintAPI.state?paintAPI.state().tool:document.getElementById('dPencil').classList.contains('on'))!==false&&await p.evaluate(()=>document.getElementById('dPencil').classList.contains('on')),'toolbar button selects pencil');
await p.evaluate(()=>paintAPI.setTool('brush'));await p.mouse.move(700,450);await p.keyboard.press('g');
check(await p.evaluate(()=>document.getElementById('dPencil').classList.contains('on')),'key G selects pencil');
check(await p.evaluate(()=>getComputedStyle(document.getElementById('pencilOpts')).display!=='none'),'pencil settings present');
check(await p.evaluate(()=>!!document.querySelector('#dPencil[data-ic="pencil"]')),'pencil icon');
check(await p.evaluate(()=>/Pencil/.test(document.body.innerHTML)&&!!document.querySelector('#phard')&&!!document.querySelector('#pgrain')),'settings sliders exist');
const R=await p.evaluate(()=>{const A=paintAPI;A.pause(true);A.newCanvas(600,400);A.setSurface({type:0});A.setTool('pencil');A.setSize(22);A.setPencil({pcol:'g',phard:.6,pgrain:.6});
 const ln=(v,pr,o)=>{const a=[];for(let i=0;i<=40;i++)a.push([.1+.8*i/40,v,pr]);A.stroke(a,pr,o||{dt:8});};
 const g=()=>{const c=A.exportData('lit')[0][1];const x=c.getContext('2d')||null;let d;if(x)d=x.getImageData(0,0,c.width,c.height);else{const t=document.createElement('canvas');t.width=c.width;t.height=c.height;const y=t.getContext('2d');y.drawImage(c,0,0);d=y.getImageData(0,0,c.width,c.height);}return d;};
 const band=(d,v,hw)=>{const W=d.width,H=d.height;const y0=Math.round((1-v)*H);let s=0,n=0,vals=[];for(let y=y0-hw;y<=y0+hw;y++)for(let x=Math.round(.15*W);x<.85*W;x++){const i=4*(y*W+x);const L=(d.data[i]+d.data[i+1]+d.data[i+2])/3;s+=L;n++;vals.push(L);}const m=s/n;let va=0;for(const q of vals)va+=(q-m)*(q-m);return{m,sd:Math.sqrt(va/n)};};
 const width=(d,v)=>{const W=d.width,H=d.height,x=Math.round(.5*W);let n=0;for(let y=0;y<H;y++){const i=4*(y*W+x);const ref=d.data[4*(5*W+x)];if(Math.abs((1-y/H)-v)<.1&&d.data[i]<ref-18)n++;}return n;};
 const d0=g();const blank=band(d0,.8,3);
 ln(.8,.2);ln(.6,.95);A.stroke([[.1,.35,.5],[.5,.35,.5],[.9,.35,.5]],.5,{tl:{t:.9,phi:0,pen:true}});ln(.15,.5);
 const d1=g();const light=band(d1,.8,3),hard=band(d1,.6,3),plain=width(d1,.15),tilt=width(d1,.35);
 A.undo();A.undo();A.undo();A.undo();const d2=g();const und=band(d2,.6,3);
 return{blank,light,hard,plain,tilt,und,ew:d1.width};});
console.log('   ',JSON.stringify(R));
check(R.light.m<R.blank.m-1,'stroke deposits pigment',R);
check(R.hard.m<R.light.m-3,'more pressure is darker',R);
check(R.hard.sd>4,'paper grain variance visible in mark',R.hard);
check(R.tilt>R.plain*1.8,'tilt gives a broader mark',{plain:R.plain,tilt:R.tilt});
check(Math.abs(R.und.m-R.blank.m)<1.5,'undo restores',R.und);
check(R.ew===600&&R.light.m<R.blank.m,'export includes pencil');
// wet paint: pencil over wet oil does not crash/smear
const wet=await p.evaluate(()=>{const A=paintAPI;A.newCanvas(400,300);A.setTool('brush');A.setMed('oil');A.setHex('#c03030');A.stroke([[.2,.5,.8],[.8,.5,.8]],.8);A.setTool('pencil');A.setPencil({pcol:'g'});A.stroke([[.1,.3,.8],[.5,.7,.8],[.9,.3,.8]],.8);A.step(3);return true;});
check(wet,'pencil over wet oil runs');
await p.close();
// mobile bar
p=await open({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
await p.evaluate(()=>paintAPI.setTool('brush'));await p.tap('#dPencil');
check(await p.evaluate(()=>document.getElementById('tPencil').classList.contains('on')),'mobile bar selects pencil');
check(!errs.length,'no page errors',errs);
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
