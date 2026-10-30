// v0.34 desktop Clear button + Shift+Delete. Exit 0 = pass.
const {chromium}=require('playwright');const path=require('path');
const tgt=process.argv[2]||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x):''));if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
await p.goto(URL);await p.waitForFunction(()=>window.paintAPI&&paintAPI.clearLayer,null,{timeout:30000});await p.waitForTimeout(900);
const vis=await p.evaluate(()=>{const e=document.getElementById('tClr'),r=e.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{w:r.width,h:r.height,hit:!!h&&(h===e||e.contains(h)),tip:e.dataset.tip,svg:!!e.querySelector('svg')};});
check(vis.w>=28&&vis.hit&&vis.svg&&/Shift\+Delete/.test(vis.tip),'toolbar Clear button visible with bin icon + tooltip',vis);
const flat=()=>p.evaluate(()=>{const c=paintAPI.exportData('flat',false)[0][1];const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const s=[];for(let i=0;i<d.length;i+=64)s.push(d[i]+d[i+1]+d[i+2]);return s;});
let BASE=null;const has=async()=>{await p.waitForTimeout(200);const f=await flat();let n=0;for(let i=0;i<f.length;i++)if(Math.abs(f[i]-BASE[i])>30)n++;return n>20;};
const paint=async()=>{const c=await p.$('#c');const r=await c.boundingBox();await p.mouse.move(r.x+r.width*.3,r.y+r.height*.4);await p.mouse.down();for(let i=1;i<=15;i++){await p.mouse.move(r.x+r.width*(.3+.4*i/15),r.y+r.height*.45);await p.waitForTimeout(16);}await p.mouse.up();await p.waitForTimeout(400);};
const dl=()=>p.evaluate(()=>document.getElementById('dlgClear').open);const und=()=>p.evaluate(()=>paintAPI.info().undo);
BASE=await flat();await paint();check(await has(),'stroke painted');
await p.click('#tClr');await p.waitForTimeout(200);check(await dl(),'confirm opens from toolbar');
const u0=await und();await p.click('#clCancel');await p.waitForTimeout(200);check(!(await dl())&&await has()&&(await und())===u0,'Cancel does nothing');
await p.click('#tClr');await p.waitForTimeout(200);await p.click('#clLayer');await p.waitForTimeout(300);check(!(await has())&&(await und())===u0+1,'Clear empties the layer, one undo step');
await p.keyboard.press('Control+z');await p.waitForTimeout(300);check(await has(),'Undo restores');
await p.mouse.click(5,450);await p.keyboard.press('Shift+Delete');await p.waitForTimeout(200);check(await dl(),'Shift+Delete opens confirm');await p.keyboard.press('Escape');await p.waitForTimeout(150);
await p.keyboard.press('Shift+Backspace');await p.waitForTimeout(200);check(await dl(),'Shift+Backspace opens confirm');await p.click('#clLayer');await p.waitForTimeout(300);check(!(await has()),'cleared via shortcut');
await p.keyboard.press('Control+z');await p.waitForTimeout(300);
// layer row bin
await p.evaluate(()=>{if(!document.getElementById('panel').classList.contains('open'))document.getElementById('dSet').click();});await p.waitForTimeout(400);await p.evaluate(()=>{document.getElementById('lAdd').closest('details').open=true;document.getElementById('lAdd').click();});await p.waitForTimeout(300);
const rb=await p.evaluate(()=>{const r=[...document.querySelectorAll('#layers .ly')];return{n:r.length,bins:r.filter(x=>x.querySelector('.lclr')).length,onBin:!!document.querySelector('#layers .ly.on .lclr')};});
check(rb.bins===1&&rb.onBin,'active layer row has a bin',rb);
const ai=await p.evaluate(()=>paintAPI.layers().findIndex(l=>l.active));await p.evaluate(()=>document.querySelector('#layers .ly.on .lclr').scrollIntoView({block:'center'}));await p.waitForTimeout(150);await p.click('#layers .ly.on .lclr');await p.waitForTimeout(200);
const sh=await p.evaluate(()=>({o:document.getElementById('dlgClear').open,all:!document.getElementById('clAll').hidden}));check(sh.o&&sh.all&&(await p.evaluate(()=>paintAPI.layers().findIndex(l=>l.active)))===ai,'row bin opens confirm with Clear all (2 layers)',sh);
await p.click('#clCancel');await p.waitForTimeout(200);
await p.click('#dClose').catch(()=>{});await p.waitForTimeout(200);
await p.click('#tClr');await p.waitForTimeout(300);await p.screenshot({path:path.join(__dirname,'screenshot-v0.34-clear-desktop.png')});await p.click('#clCancel');
// [ / ] size
{const g=()=>p.evaluate(()=>({v:+document.getElementById('size').value,sv:document.getElementById('sv').textContent,vl:document.getElementById('vlSize').textContent,ro:(document.getElementById('szRead')||{}).textContent||''}));await p.mouse.click(5,450);
 const a=await g();await p.keyboard.press(']');const b1=await g();await p.keyboard.press('Shift+BracketRight');const c=await g();await p.keyboard.press('[');const d=await g();
 check(b1.v>a.v&&b1.v<=Math.ceil(a.v*1.15)+1&&c.v>b1.v*1.25&&d.v<c.v&&/size/.test(b1.ro)&&b1.sv.startsWith(String(b1.v))&&b1.vl.includes(String(b1.v)),'] [ Shift+] change size, slider + readout follow',{a,b1,c,d});
 for(let i=0;i<40;i++)await p.keyboard.press('[');const e=await g();check(e.v===4,'clamped at min',e);
 await p.evaluate(()=>document.getElementById('dKnife').click());await p.keyboard.press(']');const k=await g();check(k.v>4&&/Knife/.test(k.ro),'applies to knife too',k);}
// typing in an input must not trigger
check(errs.length===0,'no page errors',errs);
// mobile: toolbar button hidden
const m=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});const mp=await m.newPage();await mp.goto(URL);await mp.waitForFunction(()=>window.paintAPI,null,{timeout:30000});await mp.waitForTimeout(600);
check(await mp.evaluate(()=>getComputedStyle(document.getElementById('tClr')).display==='none'),'toolbar Clear hidden on mobile');
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
