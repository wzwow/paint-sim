// UI regression suite — must pass before any publish (see TESTING.md).
// Usage: node test-ui.js [url|file] [--update-baselines] [--no-baselines]
// Exit code 0 = all checks passed, 1 = failures. Playwright + SwiftShader (headless, emulated GPU).
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const args=process.argv.slice(2);const UPD=args.includes('--update-baselines'),NOBASE=args.includes('--no-baselines');
const tgt=args.find(a=>!a.startsWith('--'))||'index.html';const URL=/^(https?|file):/.test(tgt)?tgt:'file://'+path.resolve(__dirname,tgt);
const BASE=path.join(__dirname,'baselines');const TOL=0.03; // max fraction of UI-chrome pixels allowed to differ
const results=[];const errs=[];let cur='';
const check=(ok,name,detail)=>{results.push({vp:cur,ok:!!ok,name,detail});console.log((ok?'  PASS ':'  FAIL ')+cur+' · '+name+(ok||detail===undefined?'':'  → '+JSON.stringify(detail)));};
const VPS=[
 {name:'desktop',ctx:{viewport:{width:1440,height:900}},
  bars:['#barL .ib','#barR .ib','#rail .ib','#rail .vs'],
  opens:[['#dSet','#panel','#dClose'],['#dCol','#cp','#cpClose'],['#tNew','#dlgNew','#nCancel']],settings:'#dSet',undo:'#bUndo',redo:'#bRedo',color:'#dCol',med:'#dMed'},
 {name:'mobile',ctx:{viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'},
  bars:['#barL .brand','#mTop .ib','#tb .ib','#tSize'],
  opens:[['#tSet','#panel','#dClose'],['#tCol','#cp','#cpClose']],dialogVia:['#tSet','summary:has-text("Canvas")','#bNew','#dlgNew','#nCancel'],settings:'#tSet',undo:'#tUndo',redo:'#tRedo',color:'#tCol',med:'#tMed'}];
async function pixelDiff(page,a,b){return page.evaluate(async([a,b])=>{const ld=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s;});const[A,B]=await Promise.all([ld(a),ld(b)]);
 if(A.width!==B.width||A.height!==B.height)return 1;const c=document.createElement('canvas');c.width=A.width;c.height=A.height;const g=c.getContext('2d');g.drawImage(A,0,0);const da=g.getImageData(0,0,c.width,c.height).data;g.clearRect(0,0,c.width,c.height);g.drawImage(B,0,0);const db=g.getImageData(0,0,c.width,c.height).data;
 let n=0;for(let i=0;i<da.length;i+=4)if(Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2])>48)n++;return n/(da.length/4);},[a,b]);}
(async()=>{const br=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const vp of VPS){cur=vp.name;console.log('== '+vp.name);const ctx=await br.newContext(vp.ctx);const p=await ctx.newPage();
 p.on('pageerror',x=>errs.push(vp.name+': '+x));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels/.test(m.text()))errs.push(vp.name+': '+m.text());});
 await p.goto(URL);await p.waitForTimeout(1200);
 const mobile=await p.evaluate(()=>document.body.classList.contains('m'));check(mobile===(vp.name==='mobile'),'layout mode detected',{mobile});
 check(await p.evaluate(()=>/v\d+/.test((document.getElementById('ver')||{}).textContent||'')),'version marker visible');
 // baseline screenshot of UI chrome (canvas is painted with the sim, so mask it out by hiding the canvas)
 const shot=async()=>{await p.evaluate(()=>{document.getElementById('c').style.visibility='hidden';document.getElementById('cur').style.visibility='hidden';});const b=(await p.screenshot()).toString('base64');await p.evaluate(()=>{document.getElementById('c').style.visibility='';document.getElementById('cur').style.visibility='';});return b;};
 if(!NOBASE){const f=path.join(BASE,vp.name+'.png');const s=await shot();if(UPD||!fs.existsSync(f)){fs.mkdirSync(BASE,{recursive:true});fs.writeFileSync(f,Buffer.from(s,'base64'));console.log('  (baseline written '+f+')');}
  else{const d=await pixelDiff(p,fs.readFileSync(f).toString('base64'),s);check(d<=TOL,'UI matches baseline (tol '+TOL*100+'%)',{diffPct:+(d*100).toFixed(2)});if(d>TOL)fs.writeFileSync(path.join(BASE,vp.name+'-actual.png'),Buffer.from(s,'base64'));}}
 // toolbar buttons: exist, visible, in viewport, no overlap, hit-testable
 const bars=await p.evaluate(sels=>{const W=innerWidth,H=innerHeight;const els=sels.flatMap(s=>[...document.querySelectorAll(s)].map((e,i)=>({e,s:s+'#'+(e.id||i)})));
  const r=els.map(({e,s})=>{const b=e.getBoundingClientRect(),cs=getComputedStyle(e);const cx=b.left+b.width/2,cy=b.top+b.height/2;const hit=document.elementFromPoint(cx,cy);
   return{s,w:b.width,h:b.height,l:b.left,t:b.top,r:b.right,b:b.bottom,vis:cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>0&&b.width>0&&b.height>0,inVp:b.left>=0&&b.top>=0&&b.right<=W&&b.bottom<=H,hit:!!hit&&(hit===e||e.contains(hit))};});
  const ov=[];for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i],c=r[j];if(Math.min(a.r,c.r)-Math.max(a.l,c.l)>1&&Math.min(a.b,c.b)-Math.max(a.t,c.t)>1)ov.push(a.s+' x '+c.s);}
  return{n:r.length,counts:sels.map(s=>document.querySelectorAll(s).length),bad:r.filter(x=>!x.vis||!x.inVp||!x.hit).map(x=>({s:x.s,vis:x.vis,inVp:x.inVp,hit:x.hit})),ov,small:r.filter(x=>Math.min(x.w,x.h)<44).map(x=>x.s)};},vp.bars);
 check(bars.counts.every(c=>c>0),'every toolbar group has buttons',bars.counts);
 check(!bars.bad.length,'toolbar controls visible, in viewport, clickable ('+bars.n+')',bars.bad);
 check(!bars.ov.length,'toolbar controls do not overlap',bars.ov);
 check(!bars.small.length,'touch targets >= 44px',bars.small);
 // floating bars don't overlap each other
 const flo=await p.evaluate(()=>{const v=[...document.querySelectorAll('.fl')].filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>0&&e.id!=='panel'&&e.id!=='cp';}).map(e=>[e.id,e.getBoundingClientRect()]);const o=[];
  for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++){const a=v[i][1],b=v[j][1];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>0&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0)o.push(v[i][0]+' x '+v[j][0]);}return o;});
 check(!flo.length,'floating bars do not overlap',flo);
 // uniqueness
 const uq=await p.evaluate(()=>{const ids={};document.querySelectorAll('[id]').forEach(e=>ids[e.id]=(ids[e.id]||0)+1);const sums=[...document.querySelectorAll('summary')].map(s=>s.textContent.trim());
  return{dup:Object.entries(ids).filter(([k,v])=>v>1),sums,dupSum:sums.filter((s,i)=>sums.indexOf(s)!==i),one:['#panel','#cp','#dlgNew','#surf','#layers','#expMode','#tb','#c'].map(s=>[s,document.querySelectorAll(s).length])};});
 check(!uq.dup.length,'all element ids unique',uq.dup);check(!uq.dupSum.length,'no duplicated settings sections',uq.dupSum);
 check(uq.one.every(([s,n])=>n===1),'single instance of panel/picker/dialog/Surface/Layers/Export/toolbar/canvas',uq.one);
 for(const need of ['Brush','Paint','Layers','Canvas','Export'])check(uq.sums.some(s=>s.startsWith(need)),'settings section "'+need+'" present');
 const ovf=async(tag)=>{const o=await p.evaluate(()=>({doc:document.documentElement.scrollWidth-innerWidth,body:document.body.scrollWidth-innerWidth,sx:scrollX,pb:(()=>{const e=document.getElementById('pBody');return e.offsetParent?e.scrollWidth-e.clientWidth:0;})(),
   off:[...document.querySelectorAll('.fl,dialog[open]')].filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden';}).map(e=>[e.id,e.getBoundingClientRect()]).filter(([i,b])=>b.left<-1||b.right>innerWidth+1).map(x=>x[0])}));
  check(o.doc<=0&&o.body<=0&&o.sx===0&&o.pb<=0&&!o.off.length,'no horizontal overflow ('+tag+')',o);};
 await ovf('idle');
 // open/close: panel, colour picker, dialog
 const isOpen=async s=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return false;if(e.tagName==='DIALOG')return e.open;const c=getComputedStyle(e),b=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>.5&&b.width>0;},s);
 const click=async s=>{if(vp.name==='mobile')await p.tap(s);else await p.click(s);await p.waitForTimeout(350);};
 // start with panel closed for determinism
 await p.evaluate(()=>{document.getElementById('panel').classList.remove('open');});await p.waitForTimeout(250);
 for(const[btn,el,close]of vp.opens){await click(btn);check(await isOpen(el),el+' opens via '+btn);await ovf(el+' open');
  if(el==='#panel'){const secs=await p.$$('#pBody summary');let okS=true;for(const s of secs){const before=await s.evaluate(x=>x.parentNode.open);await s.click();await p.waitForTimeout(80);const after=await s.evaluate(x=>x.parentNode.open);if(before===after)okS=false;await s.click();await p.waitForTimeout(60);}check(okS,'every settings section expands/collapses ('+secs.length+')');}
  if(el==='#cp'){const bb=await (await p.$('#cpSV')).boundingBox();await p.mouse.click(bb.x+bb.width*.7,bb.y+bb.height*.3);const hx=await p.evaluate(()=>document.getElementById('col').value);check(/^#[0-9a-f]{6}$/.test(hx)&&hx!=='#2a6f97','colour picker sets colour',hx);
   check(await p.evaluate(()=>document.getElementById('cpRec').children.length>0),'recent swatch recorded');}
  await click(close);check(!(await isOpen(el)),el+' closes via '+close);}
 if(vp.dialogVia){const[a,sum,b,dlg,cl]=vp.dialogVia;await click(a);await click(sum);await click(b);check(await isOpen(dlg),'New canvas dialog opens (mobile)');
  const d=await p.evaluate(()=>{const r=document.getElementById('dlgNew').getBoundingClientRect();return{l:r.left,r:r.right,w:innerWidth,nw:+document.getElementById('nw').value,nh:+document.getElementById('nh').value};});
  check(d.l>=0&&d.r<=d.w,'dialog fits viewport',d);check(d.nw<=2048&&d.nh<=2048,'phone-sensible default size',d);await click(cl);check(!(await isOpen(dlg)),'dialog closes');
  if(await isOpen('#panel'))await click('#dClose');}
 // stroke paints pixels (flat export before/after a real pointer stroke)
 const flat=()=>p.evaluate(()=>{const c=paintAPI.exportData('flat',false)[0][1];const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=0;const s=[];for(let i=0;i<d.length;i+=64)s.push(d[i]+d[i+1]+d[i+2]);return s;});
 const diff=(a,b)=>a.reduce((n,v,i)=>n+(Math.abs(v-b[i])>30?1:0),0);
 const R=await p.evaluate(()=>{const v=paintAPI.view,c=document.getElementById('c'),d=c.width/c.getBoundingClientRect().width,I=paintAPI.info();return{x:v.ox/d,y:(c.height-v.oy)/d-I.H*v.s/d,w:I.W*v.s/d,h:I.H*v.s/d};});
 const cdp=vp.name==='mobile'?await ctx.newCDPSession(p):null;
 const stroke=async(u0,v0,u1,v1)=>{const X=u=>R.x+R.w*u,Y=v=>R.y+R.h*v;
  if(cdp){const T=(type,q)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:q?[{x:q[0],y:q[1],id:0,radiusX:4,radiusY:4,force:.5}]:[]});await T('touchStart',[X(u0),Y(v0)]);for(let i=1;i<=20;i++){const t=i/20;await T('touchMove',[X(u0+(u1-u0)*t),Y(v0+(v1-v0)*t)]);await p.waitForTimeout(16);}await T('touchEnd');}
  else{await p.mouse.move(X(u0),Y(v0));await p.mouse.down();for(let i=1;i<=20;i++){const t=i/20;await p.mouse.move(X(u0+(u1-u0)*t),Y(v0+(v1-v0)*t));await p.waitForTimeout(12);}await p.mouse.up();}await p.waitForTimeout(300);};
 // v12 media picker: opens, 5 options, >=44px, inside viewport, no overlap; choose oil (stable pixels)
 await click(vp.med);check(await isOpen('#mp'),'#mp media picker opens via '+vp.med);
 const mpI=await p.evaluate(()=>{const bs=[...document.querySelectorAll('#mp .ib')].map(e=>{const b=e.getBoundingClientRect();const h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return{k:e.dataset.med,l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height,hit:!!h&&(h===e||e.contains(h))};});
  const ov=[];for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],c=bs[j];if(Math.min(a.r,c.r)-Math.max(a.l,c.l)>1&&Math.min(a.b,c.b)-Math.max(a.t,c.t)>1)ov.push(a.k+' x '+c.k);}
  return{keys:bs.map(b=>b.k),small:bs.filter(b=>Math.min(b.w,b.h)<44).map(b=>b.k),out:bs.filter(b=>b.l<0||b.t<0||b.r>innerWidth||b.b>innerHeight||!b.hit).map(b=>b.k),ov};});
 check(mpI.keys.join()==='water,gouache,acrylic,oil,ink','media picker lists Water/Gouache/Acrylic/Oil/Ink',mpI.keys);
 check(!mpI.small.length,'media picker targets >= 44px',mpI.small);check(!mpI.out.length,'media picker options visible and clickable',mpI.out);check(!mpI.ov.length,'media picker options do not overlap',mpI.ov);
 await ovf('#mp open');
 for(const k of ['gouache','ink','acrylic']){await click('#mp [data-med="'+k+'"]');const m=await p.evaluate(()=>paintAPI.medium());check(m===k,'picker selects '+k,{m});await click(vp.med);}
 await click('#mp [data-med="oil"]');check(!(await isOpen('#mp')),'media picker closes after choosing');check(await p.evaluate(()=>paintAPI.medium())==='oil','picker selects oil');
 const f0=await flat();const u0=(await p.evaluate(()=>paintAPI.info())).undo;
 await stroke(.15,.3,.85,.35);const f1=await flat();const d1=diff(f0,f1);check(d1>20,'stroke paints pixels',{changed:d1});
 await stroke(.15,.6,.85,.65);const i2=await p.evaluate(()=>paintAPI.info());check(i2.undo===u0+2,'two strokes => two undo steps',{u0,u:i2.undo});
 await click(vp.undo);await click(vp.undo);const fu=await flat();const iu=await p.evaluate(()=>paintAPI.info());
 check(iu.undo===u0&&iu.redo===2&&diff(f0,fu)<d1/4,'undo restores canvas',{undo:iu.undo,redo:iu.redo,resid:diff(f0,fu)});
 await click(vp.redo);const fr=await flat();const ir=await p.evaluate(()=>paintAPI.info());check(ir.undo===u0+1&&diff(f0,fr)>d1/2,'redo re-applies stroke',{undo:ir.undo,changed:diff(f0,fr)});
 if(vp.name==='desktop'){await p.keyboard.press('Control+z');const k1=await p.evaluate(()=>paintAPI.info());await p.keyboard.press('Control+Shift+Z');const k2=await p.evaluate(()=>paintAPI.info());check(k1.undo===u0&&k2.undo===u0+1,'Ctrl+Z / Ctrl+Shift+Z',[k1.undo,k2.undo]);}
 await stroke(.2,.8,.7,.85);check((await p.evaluate(()=>paintAPI.info())).redo===0,'new stroke clears redo stack');
 if(cdp){const u=(await p.evaluate(()=>paintAPI.info())).undo;const cx=R.x+R.w/2,cy=R.y+R.h/2;const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((q,i)=>({x:q[0],y:q[1],id:i,radiusX:4,radiusY:4,force:.5}))});
  await T('touchStart',[[cx-40,cy],[cx+40,cy]]);for(let i=1;i<=8;i++){await T('touchMove',[[cx-40-i*8,cy],[cx+40+i*8,cy]]);await p.waitForTimeout(16);}await T('touchEnd',[]);await p.waitForTimeout(200);
  check((await p.evaluate(()=>paintAPI.info())).undo===u,'pinch zoom does not paint');}
 await ovf('after painting');await ctx.close();}
cur='all';check(!errs.length,'zero console/page errors',errs);
await br.close();const f=results.filter(r=>!r.ok);console.log('\n'+(results.length-f.length)+'/'+results.length+' checks passed'+(f.length?' — FAILED: '+f.map(r=>r.vp+' · '+r.name).join('; '):''));process.exit(f.length?1:0);})().catch(e=>{console.error('SUITE CRASHED',e);process.exit(2);});
