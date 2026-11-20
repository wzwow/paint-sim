// v0.52 layer thumbnails: one live thumbnail per Layers-tab row (checkerboard, canvas aspect), matches the downscaled layer,
// updates after stroke / undo / redo / clear / reorder / drying, throttled (no update storm), phone rows >= 44 px, tap thumbnail selects.
// Exit 0 = pass.
const {chromium}=require('playwright');const path=require('path');
const URL=process.argv[2]||('file://'+path.resolve(__dirname,'index.html'));
const MOB={deviceScaleFactor:2,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-N986B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'};
const VPS=[{name:'desktop',ctx:{viewport:{width:1440,height:900}}},{name:'phone',ctx:Object.assign({viewport:{width:390,height:844}},MOB)}];
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x===undefined?'':' '+JSON.stringify(x)));if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const vp of VPS){console.log('== '+vp.name);const ctx=await b.newContext(vp.ctx);const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels/.test(m.text()))errs.push(m.text());});
 await p.goto(URL+(URL.includes('?')?'&':'?')+'welcome=0');await p.waitForFunction(()=>window.paintAPI,null,{timeout:60000});await p.waitForTimeout(800);
 await p.evaluate(()=>{const w=document.getElementById('wc');if(w&&!w.hidden){const x=w.querySelector('button');x&&x.click();}});
 const mob=vp.name==='phone';
 await p.evaluate(()=>{const A=paintAPI;A.newCanvas(512,384);});await p.waitForTimeout(300);
 if(mob)await p.tap('#tLayM').catch(async()=>{await p.tap('#tLay');});else await p.click('#tLay');await p.waitForTimeout(400);
 check(await p.evaluate(()=>paintAPI.lthInfo().open),'Layers tab open');
 const flush=()=>p.evaluate(()=>{paintAPI.lthFlush();paintAPI.lthFlush();return paintAPI.lthInfo();});
 // paint: layer 1 red oil stroke (left), layer 2 blue oil stroke (right), layer 3 empty
 await p.evaluate(()=>{const A=paintAPI;A.pause(true);A.setMedium(1,'oil');A.setHex('#c0262b');A.stroke([[.1,.3],[.4,.3],[.4,.7]],.8);A.step(30);
  A.L.add();A.setHex('#2848c8');A.stroke([[.6,.2],[.9,.8]],.8);A.step(30);A.L.add();A.render();});
 let info=await flush();
 const rows=await p.evaluate(()=>[...document.querySelectorAll('#layers .ly')].map(r=>{const c=r.querySelector('canvas.lth'),rr=r.getBoundingClientRect(),cr=c&&c.getBoundingClientRect();
  return{i:+r.dataset.i,has:!!c,w:c&&c.width,h:c&&c.height,cw:cr&&cr.width,ch:cr&&cr.height,rowH:rr.height,bg:c&&getComputedStyle(c).backgroundImage.includes('gradient')};}));
 check(rows.length===3&&rows.every(r=>r.has),'one thumbnail per layer row',rows);
 check(rows.every(r=>Math.abs(r.w/r.h-512/384)<.05&&Math.abs(r.cw/r.ch-512/384)<.08),'thumbnail matches canvas aspect ratio',rows.map(r=>[r.w,r.h,r.cw,r.ch]));
 check(rows.every(r=>r.bg),'thumbnail sits on a checkerboard');
 check(rows.every(r=>r.rowH>=44),'rows at least 44 px tall',rows.map(r=>r.rowH));
 // compare each thumbnail with the downscaled flat layer export
 const cmp=await p.evaluate(()=>{const A=paintAPI,ex=A.exportData('layers',false);const out=[];
  ex.forEach((e,i)=>{const t=A.lthPixels(i);const c=document.createElement('canvas');c.width=t.w;c.height=t.h;const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(e[1],0,0,t.w,t.h);
   const r=g.getImageData(0,0,t.w,t.h).data;let da=0,dc=0,nc=0,cov=0,covR=0,cx=0,cxR=0;for(let k=0;k<t.w*t.h;k++){const a1=t.d[4*k+3]/255,a2=r[4*k+3]/255;da+=Math.abs(a1-a2);cov+=a1;covR+=a2;cx+=a1*(k%t.w);cxR+=a2*(k%t.w);
    if(a1>.7&&a2>.7){nc++;for(let q=0;q<3;q++)dc+=Math.abs(t.d[4*k+q]-r[4*k+q])/3;}}
   out.push({i,da:+(da/(t.w*t.h)).toFixed(4),dc:nc?+(dc/nc).toFixed(1):0,nc,cov:+(cov/(t.w*t.h)).toFixed(4),covR:+(covR/(t.w*t.h)).toFixed(4),cx:cov?+(cx/cov/t.w).toFixed(3):-1,cxR:covR?+(cxR/covR/t.w).toFixed(3):-1});});return out;});
 console.log(JSON.stringify(cmp));
 check(cmp[0].cov>.02&&cmp[1].cov>.02&&cmp[2].cov<.001,'painted layers show paint, empty layer is empty',cmp.map(c=>c.cov));
 check(cmp.every(c=>c.da<.05),'thumbnail alpha matches downscaled layer (mean |dA| < 0.05)',cmp.map(c=>c.da));
 check(cmp.every(c=>c.nc===0||c.dc<45),'thumbnail colour matches downscaled layer within lighting tolerance (mean |dRGB| < 45/255)',cmp.map(c=>c.dc));
 check(cmp[0].cx<.45&&cmp[1].cx>.55&&Math.abs(cmp[0].cx-cmp[0].cxR)<.03&&Math.abs(cmp[1].cx-cmp[1].cxR)<.03,'each thumbnail shows only its own layer, in the right place',cmp.map(c=>[c.cx,c.cxR]));
 const px=i=>p.evaluate(i=>paintAPI.lthPixels(i),i);const cov=t=>{let s=0;for(let k=3;k<t.d.length;k+=4)s+=t.d[k];return s/255/(t.w*t.h);};
 const diff=(a,b)=>{let s=0;for(let k=0;k<a.d.length;k++)s+=Math.abs(a.d[k]-b.d[k]);return s/a.d.length;};
 // stroke on empty top layer -> its thumbnail updates
 let t0=await px(2);await p.evaluate(()=>{const A=paintAPI;A.stroke([[.2,.85],[.8,.85]],.8);A.step(20);A.render();});await flush();let t1=await px(2);
 check(t1.v>t0.v&&cov(t1)>cov(t0)+.01,'thumbnail updates after a stroke',{v:[t0.v,t1.v],cov:[cov(t0),cov(t1)]});
 await p.evaluate(()=>{paintAPI.undo();paintAPI.render();});await flush();let t2=await px(2);check(cov(t2)<.001,'thumbnail updates after undo',cov(t2));
 await p.evaluate(()=>{paintAPI.redo();paintAPI.render();});await flush();let t3=await px(2);check(diff(t3,t1)<3,'thumbnail updates after redo',diff(t3,t1));
 await p.evaluate(()=>{paintAPI.clearLayer();paintAPI.render();});await flush();let t4=await px(2);check(cov(t4)<.001,'thumbnail updates after clear layer',cov(t4));
 // reorder: move layer 2 (blue) to top position -> thumbnails follow their layers
 const before1=await px(1);await p.evaluate(()=>{const A=paintAPI;A.L.select(1);A.L.up();A.render();});await flush();
 const afterTop=await px(2),afterMid=await px(1);check(diff(afterTop,before1)<3&&cov(afterMid)<.001,'thumbnails follow layers after reorder',{top:diff(afterTop,before1),mid:cov(afterMid)});
 const domOrder=await p.evaluate(()=>[...document.querySelectorAll('#layers .ly')].map(r=>r.dataset.i));check(domOrder.join()==='2,1,0','rows top-to-bottom',domOrder);
 // file open (save + reopen) -> thumbnails rebuilt
 const fo=await p.evaluate(async()=>{const A=paintAPI;const by=await A.saveProjectBytes();await A.openProjectBytes(by);A.render();A.lthFlush();A.lthFlush();return [0,1,2].map(i=>{const t=A.lthPixels(i);let s=0;for(let k=3;k<t.d.length;k+=4)s+=t.d[k];return +(s/255/(t.w*t.h)).toFixed(4);});}).catch(e=>'ERR '+e);
 check(Array.isArray(fo)&&fo[2]>.02&&fo[0]>.02,'thumbnails after file open',fo);
 // no update storm: 20 quick strokes in real time, panel open
 await p.evaluate(()=>{paintAPI.pause(false);});await p.waitForTimeout(1500);
 const st=await p.evaluate(async()=>{const A=paintAPI;A.lthInfo();const s0=A.lthInfo().stats.batches,T0=performance.now();
  for(let k=0;k<20;k++){A.stroke([[.1+.04*k,.1],[.1+.04*k,.4]],.6);await new Promise(r=>setTimeout(r,60));}
  await new Promise(r=>setTimeout(r,800));const T=performance.now()-T0,s=A.lthInfo().stats;return{batches:s.batches-s0,T,ms:s.ms/s.batches,maxMs:s.maxMs,minGap:s.minGap};});
 check(st.batches>=1&&st.batches<=Math.ceil(st.T/250)+1&&st.minGap>=240,'no update storm: batches <= 4/s while painting fast',st);
 const awake=await p.evaluate(async()=>{const A=paintAPI;A.dryAll();for(let k=0;k<40&&A.info().awake;k++)await new Promise(r=>setTimeout(r,250));return A.info().awake;});
 await p.waitForTimeout(800);const idle0=await p.evaluate(()=>paintAPI.lthInfo().stats.batches);await p.waitForTimeout(2500);const idle1=await p.evaluate(()=>paintAPI.lthInfo().stats.batches);
 check(awake===0&&idle1-idle0===0,'idle (dry, sim asleep): no periodic thumbnail work',{d:idle1-idle0,awake});
 // wet watercolour drying refreshes while the tab is open
 const wv=await p.evaluate(async()=>{const A=paintAPI;A.setMedium(0,'water');A.stroke([[.3,.5],[.7,.5]],.9);await new Promise(r=>setTimeout(r,300));const v0=A.lthPixels(A.layers().findIndex(l=>l.active)).v;
  await new Promise(r=>setTimeout(r,3500));return{v0,v1:A.lthPixels(A.layers().findIndex(l=>l.active)).v};});
 check(wv.v1-wv.v0>=2&&wv.v1-wv.v0<=5,'wet paint: thumbnail refreshes while drying (about 1/s)',wv);
 // panel closed: no thumbnail work while painting
 await p.evaluate(()=>{document.getElementById('dClose').click();});await p.waitForTimeout(300);const c0=await p.evaluate(()=>paintAPI.lthInfo().stats.batches);
 await p.evaluate(async()=>{const A=paintAPI;A.setMedium(1,'oil');for(let k=0;k<5;k++){A.stroke([[.2,.2+.1*k],[.8,.2+.1*k]],.6);await new Promise(r=>setTimeout(r,100));}});await p.waitForTimeout(1200);
 const c1=await p.evaluate(()=>paintAPI.lthInfo().stats.batches);check(c1===c0,'Layers tab closed: no thumbnail rendering',{c0,c1});
 if(mob)await p.tap('#tLayM').catch(async()=>{await p.tap('#tLay');});else await p.click('#tLay');await p.waitForTimeout(700);
 const c2=await p.evaluate(()=>paintAPI.lthInfo().stats.batches);check(c2>c1,'reopening the tab refreshes thumbnails',{c1,c2});
 // tap a thumbnail selects that layer
 const sel=await p.evaluate(()=>{const r=document.querySelector('#layers .ly[data-i="0"] canvas.lth').getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2];});
 if(mob)await p.touchscreen.tap(sel[0],sel[1]);else await p.mouse.click(sel[0],sel[1]);await p.waitForTimeout(400);
 check(await p.evaluate(()=>paintAPI.layers()[0].active),'tapping a thumbnail selects its layer');
 await p.evaluate(()=>{paintAPI.L.add();});await p.waitForTimeout(500);
 await p.screenshot({path:'_wip/v052/thumbs-'+vp.name+'.png'});
 check(!errs.length,'no console errors',errs);await ctx.close();}
await b.close();console.log(fails?fails+' FAIL':'ALL PASS');process.exit(fails?1:0);})();
