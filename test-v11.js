// v11 test: desktop 1440x900 + mobile 390x844 (hasTouch,isMobile). Strokes, panels, colour picker, undo/redo, New dialog. Playwright + SwiftShader.
const {chromium}=require('playwright');
const URL=process.argv[2]||('file://'+__dirname+'/index.html');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const errs=[];const out={};const fail=[];
const ok=(c,m)=>{if(!c)fail.push(m);};
const watch=(p,tag)=>{p.on('pageerror',x=>errs.push(tag+': '+x));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels/.test(m.text()))errs.push(tag+': '+m.text());});};
// ---------- desktop ----------
{const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();watch(p,'desktop');await p.goto(URL);await p.waitForTimeout(1200);
 const info=()=>p.evaluate(()=>paintAPI.info());
 const r=await p.evaluate(()=>{const v=paintAPI.view,c=document.getElementById('c'),d=c.width/c.getBoundingClientRect().width,W=paintAPI.info().W,H=paintAPI.info().H;return{x:v.ox/d,y:(c.height-v.oy)/d-H*v.s/d,w:W*v.s/d,h:H*v.s/d};});
 const stroke=async(x0,y0,x1,y1)=>{await p.mouse.move(x0,y0);await p.mouse.down();for(let i=1;i<=25;i++){const t=i/25;await p.mouse.move(x0+(x1-x0)*t,y0+(y1-y0)*t+15*Math.sin(t*6));await p.waitForTimeout(12);}await p.mouse.up();};
 const P=(u,v)=>[r.x+r.w*u,r.y+r.h*v];
 await stroke(...P(.1,.25),...P(.9,.3));
 await p.click('#dCol');await p.waitForTimeout(150);ok(await p.isVisible('#cp'),'desktop picker opens');
 const sv=await p.$('#cpSV');const bb=await sv.boundingBox();await p.mouse.click(bb.x+bb.width*.8,bb.y+bb.height*.25);
 const hb=await (await p.$('#cpH')).boundingBox();await p.mouse.click(hb.x+hb.width*.02,hb.y+hb.height/2);
 out.desktopPickedHex=await p.evaluate(()=>document.getElementById('col').value);
 await p.click('#cpPig button:nth-child(3)');await p.waitForTimeout(100);
 await p.screenshot({path:'screenshot-v11-panel.png'});
 await p.keyboard.press('Escape');
 await p.click('#dMed');await stroke(...P(.1,.5),...P(.9,.55));
 await p.click('#dKnife');await stroke(...P(.3,.2),...P(.6,.7));await p.click('#dBrush');
 // rail size slider
 const vs=await (await p.$('#vsSize')).boundingBox();await p.mouse.click(vs.x+vs.width/2,vs.y+vs.height*.3);out.desktopSizeAfterRail=await p.evaluate(()=>document.getElementById('size').value);
 await p.click('#dMed');await p.click('#cpPig button:nth-child(2)',{trial:true}).catch(()=>{});await stroke(...P(.15,.75),...P(.85,.8));
 await p.waitForTimeout(500);const u0=(await info()).undo;
 await p.click('#bUndo');await p.click('#bUndo');const a=await info();
 await p.click('#bRedo');const bR=await info();
 await p.keyboard.press('Control+z');await p.keyboard.press('Control+Shift+Z');await p.keyboard.press('Control+Shift+Z');const c2=await info();
 ok(a.undo===u0-2&&a.redo===2,'desktop undo x2');ok(bR.undo===u0-1&&bR.redo===1,'desktop redo button');ok(c2.undo===u0&&c2.redo===0,'desktop kbd redo');
 out.desktopUndo={u0,afterUndo2:[a.undo,a.redo],afterRedo:[bR.undo,bR.redo],afterKbd:[c2.undo,c2.redo]};
 // layers: add layer, paint, undo-redo layer op
 await p.click('summary:has-text("Layers")');await p.click('#lAdd');await stroke(...P(.2,.4),...P(.8,.45));await p.waitForTimeout(300);
 const L1=await p.evaluate(()=>document.querySelectorAll('.ly').length);await p.click('#bUndo');await p.click('#bUndo');const L2=await p.evaluate(()=>document.querySelectorAll('.ly').length);await p.click('#bRedo');await p.click('#bRedo');const L3=await p.evaluate(()=>document.querySelectorAll('.ly').length);
 ok(L1===2&&L2===1&&L3===2,'layer undo/redo');out.layersUndoRedo=[L1,L2,L3];
 await p.click('summary:has-text("Layers")');
 await p.click('#tNew');await p.waitForTimeout(150);ok(await p.isVisible('#dlgNew'),'desktop new dialog');await p.click('#nCancel');
 await p.mouse.move(r.x+r.w*.5,r.y+r.h*.5);
 out.desktop=await p.evaluate(()=>{const ids={};document.querySelectorAll('[id]').forEach(e=>ids[e.id]=(ids[e.id]||0)+1);return{dupIds:Object.entries(ids).filter(([k,v])=>v>1),mobile:document.body.classList.contains('m'),panelOpen:document.getElementById('panel').classList.contains('open'),ver:document.getElementById('ver').textContent,info:paintAPI.info()};});
 await p.screenshot({path:'screenshot-v11-desktop.png'});await ctx.close();}
// ---------- mobile ----------
{const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
 const p=await ctx.newPage();watch(p,'mobile');await p.goto(URL);await p.waitForTimeout(1500);const cdp=await ctx.newCDPSession(p);
 const touch=async(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((q,i)=>({x:q[0],y:q[1],id:i,radiusX:4,radiusY:4,force:.5}))});
 const st=await p.evaluate(()=>{const v=paintAPI.view,c=document.getElementById('c'),d=c.width/c.getBoundingClientRect().width,I=paintAPI.info();return{r:[v.ox/d,(c.height-v.oy)/d-I.H*v.s/d,I.W*v.s/d,I.H*v.s/d],W:I.W,H:I.H,mobile:document.body.classList.contains('m'),
  minBtn:Math.min(...[...document.querySelectorAll('#tb .ib,#mTop .ib')].map(x=>Math.min(x.getBoundingClientRect().width,x.getBoundingClientRect().height)))};});
 const [L,T,Wd,Ht]=st.r;ok(st.mobile,'mobile class');ok(st.minBtn>=44,'touch targets >=44');
 const stroke=async(x0,y0,x1,y1,n=25)=>{await touch('touchStart',[[x0,y0]]);for(let i=1;i<=n;i++){const t=i/n;await touch('touchMove',[[x0+(x1-x0)*t,y0+(y1-y0)*t+12*Math.sin(t*5)]]);await p.waitForTimeout(16);}await touch('touchEnd',[]);};
 await p.tap('#dMed');await p.tap('#dCol');await p.waitForTimeout(150);ok(await p.isVisible('#cp'),'mobile picker');await p.tap('#cpPig button:nth-child(4)');
 await stroke(L+Wd*.15,T+Ht*.3,L+Wd*.85,T+Ht*.35);ok(!(await p.isVisible('#cp')),'picker closes on canvas');
 await p.tap('#dCol');await p.tap('#cpPig button:nth-child(3)');await stroke(L+Wd*.15,T+Ht*.45,L+Wd*.85,T+Ht*.5);
 await p.tap('#dMed');await p.tap('#dCol');await p.tap('#cpPig button:nth-child(2)');await stroke(L+Wd*.2,T+Ht*.6,L+Wd*.8,T+Ht*.7);
 // size bar
 const hs=await (await p.$('#tSize')).boundingBox();await p.tap('#tSize',{position:{x:hs.width*.75,y:hs.height/2}});out.mobileSize=await p.evaluate(()=>document.getElementById('size').value);
 await p.waitForTimeout(600);const u1=await p.evaluate(()=>paintAPI.info().undo);
 const cx=L+Wd/2,cy=T+Ht/2;await touch('touchStart',[[cx-40,cy],[cx+40,cy]]);for(let i=1;i<=10;i++){await touch('touchMove',[[cx-40-i*8,cy+i*3],[cx+40+i*8,cy+i*3]]);await p.waitForTimeout(16);}await touch('touchEnd',[]);
 await p.waitForTimeout(300);const u2=await p.evaluate(()=>paintAPI.info());ok(u2.undo===u1,'pinch does not paint');
 await p.tap('#bUndo');const m1=await p.evaluate(()=>paintAPI.info());await p.tap('#bRedo');const m2=await p.evaluate(()=>paintAPI.info());ok(m1.undo===u1-1&&m2.undo===u1&&m2.redo===0,'mobile undo/redo');
 await p.evaluate(()=>paintAPI.fit());await p.waitForTimeout(400);
 out.mobile={...st,undo:[u1,u2.undo,m1.undo,m2.undo]};
 await p.screenshot({path:'screenshot-v11-mobile.png'});
 await p.tap('#dCol');await p.waitForTimeout(250);await p.screenshot({path:'screenshot-v11-mobile-picker.png'});await p.tap('#cpClose');
 await p.tap('#dSet');await p.waitForTimeout(400);ok(await p.isVisible('#panel'),'drawer opens');await p.screenshot({path:'screenshot-v11-drawer.png'});
 out.mobile.sections=await p.evaluate(()=>[...document.querySelectorAll('#pBody summary')].map(s=>s.textContent));
 await p.tap('summary:has-text("Canvas")');await p.tap('#bNew');await p.waitForTimeout(250);out.mobile.newDlg=await p.evaluate(()=>{const d=document.getElementById('dlgNew').getBoundingClientRect();return{w:d.width,left:d.left,preset:document.getElementById('preset').value,nw:document.getElementById('nw').value,nh:document.getElementById('nh').value};});
 ok(out.mobile.newDlg.w<=390&&out.mobile.newDlg.left>=0,'dialog fits phone');await p.screenshot({path:'screenshot-v11-newdialog-mobile.png'});
 await p.tap('#nOk');await p.waitForTimeout(800);out.mobile.after=await p.evaluate(()=>{const i=paintAPI.info();return[i.W,i.H];});
 await ctx.close();}
console.log(JSON.stringify(out,null,1));console.log('FAILS',fail.length?fail:'none');console.log('ERRORS',errs.length?errs:'none');await b.close();})();
