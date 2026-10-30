// v10 test: mobile emulation (Pixel 7, iPhone 14) with synthetic touch strokes + pinch, drawer, desktop no-duplicates. Playwright + SwiftShader.
const {chromium,devices}=require('playwright');const fs=require('fs');
const URL=process.argv[2]||('file://'+__dirname+'/index.html');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const errs=[];const out={};
for(const dev of ['Pixel 7','iPhone 14']){const ctx=await b.newContext({...devices[dev]});const p=await ctx.newPage();
 p.on('pageerror',x=>errs.push(dev+': '+x));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels/.test(m.text()))errs.push(dev+': '+m.text());});
 await p.goto(URL);await p.waitForTimeout(1200);
 const cdp=await ctx.newCDPSession(p);
 const touch=async(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((q,i)=>({x:q[0],y:q[1],id:i,radiusX:4,radiusY:4,force:.5}))});
 const st=await p.evaluate(()=>{const r=document.getElementById('c').getBoundingClientRect();return{r:[r.left,r.top,r.width,r.height],W:paintAPI.info().W,H:paintAPI.info().H,scrollH:document.documentElement.scrollHeight,innerH:innerHeight,dpr:devicePixelRatio,cw:document.getElementById('c').width,mobile:document.body.classList.contains('m'),tb:document.getElementById('tb').getBoundingClientRect().height,minBtn:Math.min(...[...document.querySelectorAll('#tb button')].map(x=>Math.min(x.getBoundingClientRect().width,x.getBoundingClientRect().height)))};});
 const [L,T,Wd,Ht]=st.r;
 const stroke=async(x0,y0,x1,y1,n=25)=>{await touch('touchStart',[[x0,y0]]);for(let i=1;i<=n;i++){const t=i/n;await touch('touchMove',[[x0+(x1-x0)*t,y0+(y1-y0)*t+12*Math.sin(t*5)]]);await p.waitForTimeout(16);}await touch('touchEnd',[]);};
 // oil strokes via toolbar medium toggle
 await p.tap('#tMed');await p.tap('#tCol');await p.waitForTimeout(100);await p.tap('#popG button:nth-child(4)');
 await stroke(L+Wd*.15,T+Ht*.3,L+Wd*.85,T+Ht*.35);
 await p.tap('#tCol');await p.tap('#popG button:nth-child(3)');await stroke(L+Wd*.15,T+Ht*.45,L+Wd*.85,T+Ht*.5);
 await p.tap('#tMed');await p.tap('#tCol');await p.tap('#popG button:nth-child(2)');await stroke(L+Wd*.2,T+Ht*.6,L+Wd*.8,T+Ht*.7);
 await p.waitForTimeout(800);const u1=await p.evaluate(()=>paintAPI.info().undo);
 // pinch zoom: must not paint
 const v0=await p.evaluate(()=>({...paintAPI.view}));const cx=L+Wd/2,cy=T+Ht/2;
 await touch('touchStart',[[cx-40,cy],[cx+40,cy]]);for(let i=1;i<=10;i++){await touch('touchMove',[[cx-40-i*8,cy+i*3],[cx+40+i*8,cy+i*3]]);await p.waitForTimeout(16);}await touch('touchEnd',[]);
 await p.waitForTimeout(300);const v1=await p.evaluate(()=>({...paintAPI.view}));const u2=await p.evaluate(()=>paintAPI.info().undo);
 await p.evaluate(()=>paintAPI.fit());await p.waitForTimeout(400);
 out[dev]={...st,undoAfterStrokes:u1,undoAfterPinch:u2,zoomBefore:+v0.s.toFixed(3),zoomAfter:+v1.s.toFixed(3)};
 const tag=dev==='Pixel 7'?'':'-iphone';await p.screenshot({path:'screenshot-v10-mobile'+tag+'.png'});
 await p.tap('#tSet');await p.waitForTimeout(500);await p.screenshot({path:'screenshot-v10-drawer'+tag+'.png'});
 out[dev].drawerSections=await p.evaluate(()=>[...document.querySelectorAll('#dBody summary')].map(s=>s.textContent));
 // drawer scroll + a control inside works
 out[dev].sizeSync=await p.evaluate(()=>{const s=document.getElementById('size');s.value=80;s.dispatchEvent(new Event('input'));return s.value;});
 await ctx.close();}
// desktop: no duplicates, layout as before
const p=await b.newPage({viewport:{width:1500,height:900}});p.on('pageerror',x=>errs.push('desktop: '+x));await p.goto(URL);await p.waitForTimeout(800);
out.desktop=await p.evaluate(()=>{const ids={};document.querySelectorAll('[id]').forEach(e=>ids[e.id]=(ids[e.id]||0)+1);const dup=Object.entries(ids).filter(([k,v])=>v>1);
 const labs=[...document.querySelectorAll('#side .lab span:first-child')].map(s=>s.textContent);return{dupIds:dup,sideLabels:labs,mobile:document.body.classList.contains('m'),toolbarVisible:getComputedStyle(document.getElementById('tb')).display};});
await p.screenshot({path:'screenshot-v10-desktop.png'});
console.log(JSON.stringify(out,null,1));console.log('ERRORS',errs.length?errs:'none');await b.close();})();
