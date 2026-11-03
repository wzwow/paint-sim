// v10 test: mobile emulation (Pixel 7, iPhone 14) with synthetic touch strokes + pinch, drawer, desktop no-duplicates. Playwright + SwiftShader.
const {chromium,devices}=require('playwright');const fs=require('fs');
// v0.43: updated to the v0.40+ UI (pigments on the picker's Pigments tab, Settings drawer #panel, no bottom #tb bar) and given pass/fail checks + exit code.
const URL=process.argv[2]||('file://'+__dirname+'/index.html');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const errs=[];const out={};const fail=[];const ok=(c,m)=>{if(!c)fail.push(m);};
for(const dev of ['Pixel 7','iPhone 14']){const ctx=await b.newContext({...devices[dev]});const p=await ctx.newPage();
 p.on('pageerror',x=>errs.push(dev+': '+x));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels/.test(m.text()))errs.push(dev+': '+m.text());});
 await p.goto(URL);await p.waitForTimeout(1200);
 const cdp=await ctx.newCDPSession(p);
 const touch=async(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((q,i)=>({x:q[0],y:q[1],id:i,radiusX:4,radiusY:4,force:.5}))});
 const st=await p.evaluate(()=>{const r=document.getElementById('c').getBoundingClientRect();return{r:[r.left,r.top,r.width,r.height],W:paintAPI.info().W,H:paintAPI.info().H,scrollH:document.documentElement.scrollHeight,innerH:innerHeight,dpr:devicePixelRatio,cw:document.getElementById('c').width,mobile:document.body.classList.contains('m'),tb:document.getElementById('tb').getBoundingClientRect().height,minBtn:Math.min(...[...document.querySelectorAll('#barL .ib,#barR .ib,#colc .ib,#viewc>button')].filter(x=>x.offsetParent).map(x=>Math.min(x.getBoundingClientRect().width,x.getBoundingClientRect().height)))};});
 ok(st.mobile,dev+' mobile class');ok(st.minBtn>=44,dev+' touch targets >=44 ('+st.minBtn+')');ok(st.scrollH<=st.innerH+1,dev+' page does not scroll');
 const rf=await p.evaluate(()=>{const g=id=>document.getElementById(id).getBoundingClientRect();return{rail:g('rail').bottom,fold:g('railFold').bottom,view:g('viewc').top,inner:innerHeight};});ok(rf.rail<=rf.view&&rf.fold<=rf.inner,dev+' brush sliders fit above the view bar '+JSON.stringify(rf));
 const [L,T,Wd,Ht]=st.r;
 const stroke=async(x0,y0,x1,y1,n=25)=>{await touch('touchStart',[[x0,y0]]);for(let i=1;i<=n;i++){const t=i/n;await touch('touchMove',[[x0+(x1-x0)*t,y0+(y1-y0)*t+12*Math.sin(t*5)]]);await p.waitForTimeout(16);}await touch('touchEnd',[]);};
 // oil strokes via toolbar medium toggle
 const pig=async n=>{await p.tap('#dCol');await p.waitForTimeout(150);if(!(await p.isVisible('#cpPig')))await p.tap('#cpTabs [data-t=pig]');const want=await p.evaluate(n=>document.querySelector('#cpPig button:nth-child('+n+')').title,n);await p.tap('#cpPig button:nth-child('+n+')');await p.waitForTimeout(100);
  const pn=await p.evaluate(()=>document.getElementById('pn').textContent);ok(pn.includes(want),dev+' pigment '+n+' ('+want+' vs '+pn+')');if(await p.isVisible('#cp'))await p.tap('#cpClose');};
 const u0=await p.evaluate(()=>paintAPI.info().undo);
 // v0.43: strokes start >=25% in so they begin clear of the left tool column (Chromium touch adjustment snaps a touch 5 px from a button onto the button)
 await p.tap('#dMed');await pig(4);await stroke(L+Wd*.25,T+Ht*.3,L+Wd*.75,T+Ht*.35);
 await pig(3);await stroke(L+Wd*.25,T+Ht*.45,L+Wd*.75,T+Ht*.5);
 await p.tap('#dMed');await pig(2);await stroke(L+Wd*.25,T+Ht*.6,L+Wd*.75,T+Ht*.7);
 await p.waitForTimeout(800);const u1=await p.evaluate(()=>paintAPI.info().undo);
 // pinch zoom: must not paint
 const v0=await p.evaluate(()=>({...paintAPI.view}));const cx=L+Wd/2,cy=T+Ht/2;
 await touch('touchStart',[[cx-40,cy],[cx+40,cy]]);for(let i=1;i<=10;i++){await touch('touchMove',[[cx-40-i*8,cy+i*3],[cx+40+i*8,cy+i*3]]);await p.waitForTimeout(16);}await touch('touchEnd',[]);
 await p.waitForTimeout(300);const v1=await p.evaluate(()=>({...paintAPI.view}));const u2=await p.evaluate(()=>paintAPI.info().undo);
 await p.evaluate(()=>paintAPI.fit());await p.waitForTimeout(400);
 ok(u1===u0+3,dev+' 3 strokes -> 3 undo steps ('+u0+'->'+u1+')');ok(u2===u1,dev+' pinch does not paint');ok(v1.s>v0.s*1.2,dev+' pinch zooms in');
 out[dev]={...st,undoAfterStrokes:u1,undoAfterPinch:u2,zoomBefore:+v0.s.toFixed(3),zoomAfter:+v1.s.toFixed(3)};
 const tag=dev==='Pixel 7'?'':'-iphone';await p.screenshot({path:'screenshot-v10-mobile'+tag+'.png'});
 await p.tap('#dSet');await p.waitForTimeout(500);ok(await p.isVisible('#panel'),dev+' settings drawer opens');await p.screenshot({path:'screenshot-v10-drawer'+tag+'.png'});
 out[dev].drawerSections=await p.evaluate(()=>[...document.querySelectorAll('#pBody summary')].map(s=>s.textContent));
 // drawer scroll + a control inside works
 ok(out[dev].drawerSections.length>=4,dev+' drawer sections');
 out[dev].sizeSync=await p.evaluate(()=>{const s=document.getElementById('size');s.value=80;s.dispatchEvent(new Event('input'));return s.value;});ok(+out[dev].sizeSync===80,dev+' size control');
 await ctx.close();}
// desktop: no duplicates, layout as before
const p=await b.newPage({viewport:{width:1500,height:900}});p.on('pageerror',x=>errs.push('desktop: '+x));await p.goto(URL);await p.waitForTimeout(800);
out.desktop=await p.evaluate(()=>{const ids={};document.querySelectorAll('[id]').forEach(e=>ids[e.id]=(ids[e.id]||0)+1);const dup=Object.entries(ids).filter(([k,v])=>v>1);
 const vis=id=>{const e=document.getElementById(id);if(!e)return false;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};return{dupIds:dup,mobile:document.body.classList.contains('m'),rail:vis('vsSize'),viewBar:vis('viewc'),tools:vis('dBrush'),phoneBarHidden:getComputedStyle(document.getElementById('tb')).display==='none'};});
ok(!out.desktop.dupIds.length,'desktop no duplicate ids');ok(!out.desktop.mobile,'desktop not mobile');ok(out.desktop.rail&&out.desktop.viewBar&&out.desktop.tools,'desktop rail/view bar/tools visible');
await p.screenshot({path:'screenshot-v10-desktop.png'});
console.log(JSON.stringify(out,null,1));console.log('FAILS',fail.length?fail:'none');console.log('ERRORS',errs.length?errs:'none');await b.close();process.exit(fail.length||errs.length?1:0);})();
