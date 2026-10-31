// v0.42: collapsible brush sliders — collapse/expand, persistence, [ ] keys while collapsed, no overlaps at 5 sizes. Playwright + SwiftShader.
const {chromium}=require('playwright');
const URL=process.argv[2]||('file://'+__dirname+'/index.html');
const SIZES=[[2191,1304,0],[1280,800,0],[360,800,1],[412,915,1],[915,412,1]];
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const fail=[],errs=[];const ok=(c,m)=>{if(!c)fail.push(m);};
const ovl=p=>p.evaluate(()=>{const sel='#barL,#barR,#rail,#colc,#viewc';const els=[...document.querySelectorAll(sel)].filter(e=>e.offsetParent||getComputedStyle(e).position==='fixed'&&getComputedStyle(e).display!=='none');const R=els.map(e=>[e.id,e.getBoundingClientRect()]).filter(([,r])=>r.width>0);const bad=[];
 for(let i=0;i<R.length;i++){const [a,r]=R[i];if(r.left<-1||r.top<-1||r.right>innerWidth+1||r.bottom>innerHeight+1)bad.push(a+' offscreen');for(let j=i+1;j<R.length;j++){const [c,q]=R[j];if(r.left<q.right-1&&q.left<r.right-1&&r.top<q.bottom-1&&q.top<r.bottom-1)bad.push(a+'×'+c);}}return bad;});
for(const [w,h,mob] of SIZES){const o=mob?{viewport:{width:w,height:h},deviceScaleFactor:2,hasTouch:true,isMobile:true}:{viewport:{width:w,height:h}};const ctx=await b.newContext(o);const p=await ctx.newPage();
 p.on('pageerror',x=>errs.push(w+': '+x));await p.goto(URL);await p.waitForTimeout(1200);await p.evaluate(()=>{const x=document.getElementById('welcome');if(x)x.remove();});const tag=w+'x'+h;
 const act=async s=>mob?p.tap(s):p.click(s);
 ok(!(await p.evaluate(()=>document.getElementById('rail').classList.contains('col'))),tag+' expanded by default');
 ok((await ovl(p)).length===0,tag+' expanded overlaps '+(await ovl(p)));
 const hE=await p.evaluate(()=>document.getElementById('rail').getBoundingClientRect().height);
 const fb=await p.evaluate(()=>{const r=document.getElementById('railFold').getBoundingClientRect();return Math.min(r.width,r.height);});ok(fb>=20,tag+' fold handle size '+fb);
 if(w===2191)await p.screenshot({path:'_wip/v042shot-desk-exp.png'});if(w===412)await p.screenshot({path:'_wip/v042shot-mob-exp.png'});
 await act('#railFold');await p.waitForTimeout(150);
 const c=await p.evaluate(()=>{const r=document.getElementById('rail'),ch=document.getElementById('railChip').getBoundingClientRect();return{col:r.classList.contains('col'),h:r.getBoundingClientRect().height,chip:document.getElementById('railChipV').textContent,size:document.getElementById('size').value,vs:document.getElementById('vsSize').offsetParent===null,cw:ch.width,chh:ch.height,ls:localStorage.getItem('medium-rail')};});
 ok(c.col&&c.vs,tag+' collapses');ok(c.h<hE*0.4,tag+' gives back space '+c.h+'/'+hE);ok(c.chip===c.size,tag+' chip shows size');ok(c.cw>=44&&c.chh>=44,tag+' chip tap target');ok(c.ls==='1',tag+' saved');
 ok((await ovl(p)).length===0,tag+' collapsed overlaps '+(await ovl(p)));
 if(!mob){await p.mouse.move(w/2,h/2);await p.keyboard.press('BracketRight');await p.keyboard.press('BracketRight');await p.waitForTimeout(100);const k=await p.evaluate(()=>[document.getElementById('size').value,document.getElementById('railChipV').textContent]);ok(+k[0]>+c.size&&k[0]===k[1],tag+' ] keys while collapsed '+k);
  await p.keyboard.press('BracketLeft');const k2=await p.evaluate(()=>[document.getElementById('size').value,document.getElementById('railChipV').textContent]);ok(+k2[0]<+k[0]&&k2[0]===k2[1],tag+' [ key while collapsed');}
 if(w===2191)await p.screenshot({path:'_wip/v042shot-desk-col.png'});if(w===412)await p.screenshot({path:'_wip/v042shot-mob-col.png'});
 await p.reload();await p.waitForTimeout(1200);ok(await p.evaluate(()=>document.getElementById('rail').classList.contains('col')),tag+' persists after reload');
 await act('#railChip');await p.waitForTimeout(250);const e=await p.evaluate(()=>{const r=document.getElementById('rail');const k=document.querySelector('#vsSize .k').getBoundingClientRect(),v=document.getElementById('vsSize').getBoundingClientRect();return{col:r.classList.contains('col'),ls:localStorage.getItem('medium-rail'),kin:k.top>=v.top-4&&k.bottom<=v.bottom+4}});
 ok(!e.col&&e.ls==='0',tag+' expands from chip');ok(e.kin,tag+' slider knob drawn after expand');ok((await ovl(p)).length===0,tag+' re-expanded overlaps');
 await ctx.close();}
console.log('FAILS',fail.length?fail:'none');console.log('ERRORS',errs.length?errs:'none');await b.close();})();
