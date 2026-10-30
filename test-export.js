// v0.19 export dialog test (desktop mouse/keyboard + mobile touch). Exit 0 = pass, 1 = failed checks, 2 = crashed.
// Paints watercolour (layer 1) + oil (layer 2), opens the Export dialog through the UI, checks every format (MIME, magic bytes, size),
// transparent PNG alpha (0 on bare paper, >0 under paint, no dark fringe: straight colour of the faint edge vs the solid interior),
// current layer vs all layers, 2x, file name, Share (mocked Web Share API on mobile), Esc/Cancel, persistence after reload,
// mobile fit/44px targets, no page errors. Writes screenshot-v0.19-export-{desktop,mobile}.png and screenshot-v0.19-transparent-demo.png.
// Usage: node test-export.js [url]
let VER=null;const {chromium}=require('playwright');const fs=require('fs');const zlib=require('zlib');
const URL=process.argv[2]||('file://'+__dirname+'/index.html');
const VPS=[{name:'desktop',ctx:{viewport:{width:1440,height:900}}},
 {name:'mobile',ctx:{viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true}}];
let fails=0;const check=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined&&(!c||process.env.V)?' '+JSON.stringify(x):''));if(!c)fails++;};
function decodePNG(buf){if(buf.readUInt32BE(0)!==0x89504e47)throw new Error('not a PNG');let o=8,w,h,ct,bd;const id=[];
 while(o<buf.length){const len=buf.readUInt32BE(o),type=buf.toString('latin1',o+4,o+8),d=buf.subarray(o+8,o+8+len);
  if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];if(d[12])throw new Error('interlaced');}else if(type==='IDAT')id.push(d);else if(type==='IEND')break;o+=12+len;}
 if(bd!==8||(ct!==6&&ct!==2))throw new Error('unsupported PNG '+bd+'/'+ct);const bpp=ct===6?4:3,S=w*bpp,raw=zlib.inflateSync(Buffer.concat(id)),px=new Uint8Array(w*h*4);let prev=new Uint8Array(S);
 for(let y=0;y<h;y++){const f=raw[y*(S+1)],line=new Uint8Array(raw.subarray(y*(S+1)+1,(y+1)*(S+1)));
  for(let i=0;i<S;i++){const a=i>=bpp?line[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;let p=0;
   if(f===1)p=a;else if(f===2)p=b;else if(f===3)p=(a+b)>>1;else if(f===4){const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);p=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}line[i]=(line[i]+p)&255;}
  for(let x=0;x<w;x++){const d=(y*w+x)*4;px[d]=line[x*bpp];px[d+1]=line[x*bpp+1];px[d+2]=line[x*bpp+2];px[d+3]=bpp===4?line[x*bpp+3]:255;}prev=line;}
 return{w,h,px,ct};}
const lum=(r,g,b)=>.2126*r+.7152*g+.0722*b;
// region stats in image rows y0..y1 (fractions, top-down)
function region(img,y0,y1){const{w,h,px}=img;const Y0=Math.floor(y0*h),Y1=Math.floor(y1*h);let n0=0,n=0,solid=[],edge=[];
 for(let y=Y0;y<Y1;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,a=px[i+3];n++;if(a===0){n0++;continue;}const L=lum(px[i],px[i+1],px[i+2]);if(a>=200)solid.push(L);else if(a>=8&&a<=128)edge.push(L);}
 const mean=v=>v.length?v.reduce((s,x)=>s+x,0)/v.length:NaN;const pct=(v,p)=>{const s=[...v].sort((a,b)=>a-b);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
 return{n,n0,solid:solid.length,edge:edge.length,solidMean:mean(solid),edgeMean:mean(edge),solidP10:pct(solid,.1),edgeDarkFrac:edge.length?edge.filter(L=>L<pct(solid,.1)-12).length/edge.length:0};}
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const vp of VPS){console.log('== '+vp.name);const mob=vp.name==='mobile';const ctx=await b.newContext(Object.assign({acceptDownloads:true},vp.ctx));
 if(mob)await ctx.addInitScript(()=>{window.__shared=[];navigator.canShare=d=>!!(d&&d.files&&d.files.length&&d.files.every(f=>/^image\//.test(f.type)));
  navigator.share=async d=>{window.__shared.push({name:d.files[0].name,type:d.files[0].type,size:d.files[0].size});};});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.goto(URL);await p.waitForFunction(()=>window.paintAPI,null,{timeout:30000});await p.waitForTimeout(600);
 VER=await p.evaluate(()=>{const m=document.title.match(/v0\.(\d+)/);return m&&+m[1]>=19&&document.getElementById('ver').textContent==='v0.'+m[1]?'v0.'+m[1]:null;});check(!!VER,'title + badge agree, version >= v0.19 ('+VER+')');
 const tap=async s=>{if(mob)await p.tap(s);else await p.click(s);await p.waitForTimeout(200);};
 // paint: layer 1 watercolour (blue band near the top, green below it), dried; layer 2 oil (red band near the bottom)
 const dims=await p.evaluate(()=>{const A=paintAPI;A.pause(true);A.setMed('water');A.setSize(34);
  A.selectPig(1);for(const y of [.74,.70])A.stroke([[.18,y],[.35,y+.02],[.5,y-.01],[.65,y+.015],[.82,y]],.8,{dt:14});A.step(20);
  A.selectPig(5);A.stroke([[.2,.55],[.5,.57],[.8,.54]],.7,{dt:14});A.step(30);A.dryAll();A.L.add();
  A.setMed('oil');A.selectPig(3);A.setSize(40);A.stroke([[.2,.28],[.4,.3],[.6,.27],[.8,.3]],.8,{dt:14});A.step(10);A.render();A.pause(false);return A.info();});
 const W=dims.W,H=dims.H;console.log('canvas',W,'x',H);
 // open via the UI
 if(mob){await tap('#tSet');await p.evaluate(()=>{const d=document.getElementById('bExpDlg').closest('details');d.open=true;document.getElementById('bExpDlg').scrollIntoView({block:'center'});});await p.waitForTimeout(300);
  const bb=await p.evaluate(()=>{const r=document.getElementById('bExpDlg').getBoundingClientRect();return{h:r.height};});check(bb.h>=44,'Export image… button >= 44px on mobile',bb);await tap('#bExpDlg');}
 else{check(await p.evaluate(()=>document.getElementById('tExp').getAttribute('aria-label'))==='Export image','toolbar Export button labelled');await tap('#tExp');}
 const isOpen=()=>p.evaluate(()=>document.getElementById('dlgExp').open);
 check(await isOpen(),'export dialog opens from the '+(mob?'settings drawer':'toolbar'));
 if(mob)check(await p.evaluate(()=>!document.getElementById('panel').classList.contains('open')),'drawer closes behind the dialog');
 let st=await p.evaluate(()=>{const d=document.getElementById('dlgExp');const q=n=>{const r=d.querySelector('input[name="'+n+'"]:checked');return r&&r.value;};
  return{fmt:q('exFmt'),bg:q('exBg'),ly:q('exLy'),sz:q('exSz'),name:document.getElementById('exName').value,info:document.getElementById('exInfo').textContent,focus:d.contains(document.activeElement),
   qHidden:document.getElementById('exQrow').hidden,webp:!document.getElementById('exWebpL').hidden,share:!document.getElementById('exShare').hidden,formats:paintAPI.exportFormats()};});
 check(st.fmt==='png'&&st.bg==='paper'&&st.ly==='all'&&st.sz==='1','defaults: PNG, with paper, all visible layers, 1x',st);
 check(/^paint-\d{8}-\d{4}$/.test(st.name),'default file name paint-YYYYMMDD-HHMM',st.name);
 check(st.info.includes(W+' × '+H+' px'),'dialog shows pixel dimensions',st.info);check(st.focus,'focus moves into the dialog');check(st.qHidden,'no quality slider for PNG');
 check(st.webp===st.formats.includes('webp'),'WebP offered only if the browser encodes it',st.formats);console.log('formats',st.formats.join(','));
 check(st.share===mob,mob?'Share… offered on mobile when canShare(files)':'no Share button on desktop',st.share);
 // labelled controls
 const lab=await p.evaluate(()=>{const d=document.getElementById('dlgExp');const bad=[];d.querySelectorAll('input,button').forEach(e=>{if(e.closest('[hidden]'))return;const n=(e.labels&&e.labels.length?e.labels[0].textContent:'')||e.getAttribute('aria-label')||e.textContent;if(!n.trim())bad.push(e.id||e.name||e.tagName);});
  return{bad,legends:[...d.querySelectorAll('legend')].map(l=>l.textContent),labelled:!!d.getAttribute('aria-labelledby')};});
 check(!lab.bad.length&&lab.legends.join()==='Format,Background,Layers,Size'&&lab.labelled,'every control labelled, groups have legends',lab);
 // fits the screen, no overflow, 44 px targets on mobile
 const fit=await p.evaluate(()=>{const d=document.getElementById('dlgExp'),r=d.getBoundingClientRect();const t=[...d.querySelectorAll('.rseg label,.exBtns button,.exn')].filter(e=>!e.closest('[hidden]')&&e.offsetParent).map(e=>{const b=e.getBoundingClientRect();return[e.textContent.trim().slice(0,14),Math.round(b.width),Math.round(b.height)];});
  const clip=[...d.querySelectorAll('.rseg span,.exBtns button')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent);
  return{l:r.left,t:r.top,r:r.right,b:r.bottom,vw:innerWidth,vh:innerHeight,sh:d.scrollHeight,ch:d.clientHeight,doc:document.documentElement.scrollWidth,t44:t,clip};});
 check(fit.l>=0&&fit.t>=0&&fit.r<=fit.vw&&fit.b<=fit.vh,'dialog inside the viewport',fit);check(fit.sh<=fit.ch+1,'dialog content fits without scrolling',{sh:fit.sh,ch:fit.ch});
 check(fit.doc<=fit.vw,'no horizontal page scroll');check(!fit.clip.length,'no clipped labels/buttons',fit.clip);
 if(mob)check(fit.t44.every(x=>x[2]>=44&&x[1]>=44),'touch targets >= 44px',fit.t44);
 // keyboard: arrows move within a radio group; JPEG shows quality, forces paper
 if(!mob){await p.focus('#dlgExp input[name="exFmt"]:checked');await p.keyboard.press('ArrowRight');await p.waitForTimeout(150);}else{await tap('#dlgExp input[name="exFmt"][value="jpeg"]');}
 st=await p.evaluate(()=>({fmt:document.querySelector('#dlgExp input[name="exFmt"]:checked').value,q:!document.getElementById('exQrow').hidden,trDis:document.querySelector('#dlgExp input[name="exBg"][value="transparent"]').disabled,ext:document.getElementById('exExt').textContent}));
 check(st.fmt==='jpeg'&&st.q&&st.trDis&&st.ext==='.jpg',(mob?'tap':'ArrowRight')+' selects JPEG: quality slider shown, transparent disabled, .jpg',st);
 if(!mob){await p.keyboard.press('ArrowLeft');await p.waitForTimeout(100);}else await tap('#dlgExp input[name="exFmt"][value="png"]');
 // Escape closes
 await p.keyboard.press('Escape');await p.waitForTimeout(200);check(!(await isOpen()),'Esc closes the dialog');
 if(!mob){await p.keyboard.press('Control+Shift+E');await p.waitForTimeout(200);check(await isOpen(),'Ctrl+Shift+E opens the dialog');await tap('#exCancel');check(!(await isOpen()),'Cancel closes the dialog');}
 // keys typed in the file name stay there
 await p.evaluate(()=>paintAPI.openExport());await p.waitForTimeout(150);
 const tool0=await p.evaluate(()=>paintAPI.info().tool),undo0=await p.evaluate(()=>paintAPI.info().undo);
 await p.click('#exName',{clickCount:3});await p.keyboard.type('bk');await p.keyboard.press('Control+z');await p.waitForTimeout(150);
 check(await p.evaluate(()=>paintAPI.info().tool)===tool0&&await p.evaluate(()=>paintAPI.info().undo)===undo0,'typing B/K/Ctrl+Z in the file name does not switch tools or undo');
 await p.fill('#exName','my wash: v1?');
 // Transparent PNG via the UI -> real download
 await tap('#dlgExp input[name="exBg"][value="transparent"]');
 st=await p.evaluate(()=>document.getElementById('exInfo').textContent);check(/transparent/.test(st),'info line follows the choice',st);
 let png,img;
 const dlP=p.waitForEvent('download',{timeout:60000});await tap('#exGo');let dl=null;try{dl=await dlP;}catch(e){}
 if(dl){const fp=await dl.path();png=fs.readFileSync(fp);check(dl.suggestedFilename()==='my wash- v1-.png','download file name sanitised + extension',dl.suggestedFilename());}
 else{check(false,'download event');}
 await p.waitForTimeout(300);check(!(await isOpen()),'dialog closes after download');
 if(png){img=decodePNG(png);check(img.w===W&&img.h===H&&img.ct===6,'transparent PNG is RGBA '+W+'x'+H,{w:img.w,h:img.h,ct:img.ct});
  let border0=true;for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){if(y>img.h*.04&&y<img.h*.96&&x>img.w*.04&&x<img.w*.96)continue;if(img.px[(y*img.w+x)*4+3]!==0){border0=false;}}
  check(border0,'alpha 0 on unpainted paper (canvas border band)');
  const wc=region(img,.20,.36),oil=region(img,.66,.78);console.log('watercolour band',JSON.stringify(wc),'\noil band',JSON.stringify(oil));
  check(wc.solid+wc.edge>1000&&oil.solid>1000,'alpha > 0 under the paint',{wc:wc.solid+wc.edge,oil:oil.solid});
  check(wc.edge>200&&wc.edgeMean>=wc.solidMean-6&&wc.edgeDarkFrac<.03,'watercolour edges: straight colour not darker than the interior (no dark fringe)',{edge:wc.edgeMean,solid:wc.solidMean,dark:wc.edgeDarkFrac});
  check(oil.edge>20?(oil.edgeMean>=oil.solidMean-12&&oil.edgeDarkFrac<.05):true,'oil edges: no dark fringe',{edge:oil.edgeMean,solid:oil.solidMean,dark:oil.edgeDarkFrac,n:oil.edge});}
 // every format through the paintAPI hook (same code path as the dialog)
 const get=o=>p.evaluate(async o=>{const r=await paintAPI.exportImage(o);const u8=new Uint8Array(await r.blob.arrayBuffer());let bm=null;try{const ib=await createImageBitmap(r.blob);bm=[ib.width,ib.height];}catch(e){bm=String(e);}
   let s='';for(let i=0;i<u8.length;i+=32768)s+=String.fromCharCode.apply(null,u8.subarray(i,i+32768));return{type:r.blob.type,w:r.w,h:r.h,bm,b64:btoa(s),opts:r.opts};},o).then(r=>Object.assign(r,{buf:Buffer.from(r.b64,'base64')}));
 const magic={'image/png':b=>b.readUInt32BE(0)===0x89504e47,'image/jpeg':b=>b[0]===0xff&&b[1]===0xd8,'image/webp':b=>b.toString('latin1',0,4)==='RIFF'&&b.toString('latin1',8,12)==='WEBP'};
 const R={};
 for(const [k,o] of [['png',{fmt:'png'}],['pngT',{fmt:'png',bg:'transparent'}],['jpeg',{fmt:'jpeg',q:.9}],['jpegT',{fmt:'jpeg',bg:'transparent'}],['webp',{fmt:'webp',q:.9}],['webpT',{fmt:'webp',bg:'transparent'}],['png2',{fmt:'png',scale:2}],['png2T',{fmt:'png',scale:2,bg:'transparent'}],['cur',{fmt:'png',bg:'transparent',layers:'current'}],['curP',{fmt:'png',layers:'current'}]]){
  if(o.fmt==='webp'&&!st.formats&&false)continue;const r=await get(o);R[k]=r;const want=o.fmt==='webp'&&!(await p.evaluate(()=>paintAPI.exportFormats().includes('webp')))?'image/png':'image/'+o.fmt;
  const sc=o.scale||1;check(r.type===want&&magic[want](r.buf)&&r.w===W*sc&&r.h===H*sc&&Array.isArray(r.bm)&&r.bm[0]===W*sc&&r.bm[1]===H*sc,k+': '+want+' '+(W*sc)+'x'+(H*sc)+' decodes ('+Math.round(r.buf.length/1024)+' KB)',{type:r.type,w:r.w,h:r.h,bm:r.bm});}
 check(R.jpegT.opts.bg==='paper','JPEG forces the paper background');
 const dP=decodePNG(R.png.buf),dT=decodePNG(R.pngT.buf),d2=decodePNG(R.png2T.buf),dC=decodePNG(R.cur.buf),dCP=decodePNG(R.curP.buf);
 let opq=true;for(let i=3;i<dP.px.length;i+=4)if(dP.px[i]!==255){opq=false;break;}check(opq,'with-paper PNG is fully opaque');
 // paper export vs the existing exportData('lit') (unchanged API): should be the same picture
 const litDiff=await p.evaluate(async()=>{const c=paintAPI.exportData('lit',false)[0][1];const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const r=await paintAPI.exportImage({fmt:'png'});const ib=await createImageBitmap(r.blob);const c2=document.createElement('canvas');c2.width=ib.width;c2.height=ib.height;const g=c2.getContext('2d');g.drawImage(ib,0,0);const d=g.getImageData(0,0,c2.width,c2.height).data;let m=0,n=0;for(let i=0;i<d.length;i++){const e=Math.abs(d[i]-a[i]);if(e>m)m=e;if(e>3)n++;}return{w:c.width,h:c.height,m,n,old:paintAPI.exportData('layers',false).length};});
 check(litDiff.w===W&&litDiff.h===H&&litDiff.n<litDiff.w*litDiff.h*4*.001,'"with paper" matches the existing exportData("lit") (old API still works)',litDiff);check(litDiff.old===2,'exportData("layers") still exports one PNG per layer',litDiff.old);
 // 2x: alpha 0 border, smooth (upscaled from 1x: downsampling it again matches the 1x)
 let d2ok=true,diff=0,nn=0;for(let y=0;y<dT.h;y++)for(let x=0;x<dT.w;x++){const i=(y*dT.w+x)*4;let a=0;for(const[dx,dy]of[[0,0],[1,0],[0,1],[1,1]])a+=d2.px[((2*y+dy)*d2.w+2*x+dx)*4+3];a/=4;diff+=Math.abs(a-dT.px[i+3]);nn++;}
 const b2=d2.px[3]===0&&d2.px[(d2.w*d2.h-1)*4+3]===0;check(diff/nn<2&&b2,'2x transparent: alpha matches 1x when downsampled, border stays transparent',{meanAlphaDiff:+(diff/nn).toFixed(3)});
 // current layer only (oil on layer 2) vs all visible (watercolour + oil)
 const cwc=region(dC,.20,.36),coil=region(dC,.66,.78),awc=region(dT,.20,.36);
 check(cwc.n0===cwc.n&&awc.n0<awc.n*.9&&coil.solid>1000,'current layer only: watercolour layer absent, oil present; all layers has both',{curWcTransparent:cwc.n0/cwc.n,allWcTransparent:awc.n0/awc.n,curOil:coil.solid});
 let nd=0;for(let i=3;i<dC.px.length;i+=4)if(Math.abs(dC.px[i]-dT.px[i])>8)nd++;check(nd>2000,'current-layer export differs from all-layers export',nd);
 let cpo=true;for(let i=3;i<dCP.px.length;i+=4)if(dCP.px[i]!==255){cpo=false;break;}check(cpo,'current layer with paper is opaque');
 // transparent over white, blended the way design tools do (8-bit gamma values, normal mode), must match the app's own render on a
 // white ground (relief 0 so paper lighting does not differ): checks colour + alpha together, i.e. no dark (or light) fringe
 const ow=await p.evaluate(async()=>{const A=paintAPI;A.setRelief(0);A.setSurface({ground:'#ffffff'});
  const dec=async bl=>{const ib=await createImageBitmap(bl);const c=document.createElement('canvas');c.width=ib.width;c.height=ib.height;const g=c.getContext('2d');g.drawImage(ib,0,0);return g.getImageData(0,0,c.width,c.height).data;};
  const P=await dec(await A.exportBlob({fmt:'png'}));const ib=await createImageBitmap(await A.exportBlob({fmt:'png',bg:'transparent'}));const c=document.createElement('canvas');c.width=ib.width;c.height=ib.height;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(ib,0,0);const T=g.getImageData(0,0,c.width,c.height).data;
  const al=await dec(await A.exportBlob({fmt:'png',bg:'transparent'}));
  let ns=0,ds=0,ne=0,de=0,dea=0,worst=0;for(let i=0;i<T.length;i+=4){const a=al[i+3];if(a<3)continue;let d=0;for(let k=0;k<3;k++)d+=T[i+k]-P[i+k];d/=3;
   if(a>=200){ns++;ds+=Math.abs(d);}else{ne++;de+=d;dea+=Math.abs(d);if(Math.abs(d)>worst)worst=Math.abs(d);}}
  A.setRelief(1.5);A.setSurface({ground:'#f7f1e4'});return{solidAbs:+(ds/ns).toFixed(2),edgeSigned:+(de/ne).toFixed(2),edgeAbs:+(dea/ne).toFixed(2),ns,ne};});
 console.log('over white vs app on white paper',JSON.stringify(ow));check(ow.solidAbs<4&&Math.abs(ow.edgeSigned)<3&&ow.edgeAbs<5,'transparent PNG over white (gamma-space normal blend) matches the app on white paper: no fringe',ow);
 // name helper
 check(await p.evaluate(()=>paintAPI.exportFileName('a/b.png','jpeg')==='a-b.jpg'&&/^paint-\d{8}-\d{4}\.png$/.test(paintAPI.exportFileName('  ','png'))),'file name sanitising (bad chars, extension swap, blank -> default)');
 // mobile: Share button -> navigator.share gets a File of the chosen type
 if(mob){await p.evaluate(()=>paintAPI.openExport());await p.waitForTimeout(150);await tap('#dlgExp input[name="exFmt"][value="png"]');await tap('#exShare');await p.waitForFunction(()=>window.__shared.length>0||!document.getElementById('dlgExp').open,null,{timeout:60000});await p.waitForTimeout(200);
  const sh=await p.evaluate(()=>window.__shared);check(sh.length===1&&sh[0].type==='image/png'&&/\.png$/.test(sh[0].name)&&sh[0].size>1000,'Share… passes a PNG File to navigator.share',sh);check(!(await isOpen()),'dialog closes after sharing');
  // activation lost -> 'Share now' second step
  await p.evaluate(()=>{navigator.share=async()=>{const e=new Error('no activation');e.name='NotAllowedError';throw e;};});await p.evaluate(()=>paintAPI.openExport());await p.waitForTimeout(150);await tap('#exShare');
  await p.waitForFunction(()=>document.getElementById('exShareT').textContent==='Share now',null,{timeout:60000}).catch(()=>{});
  check(await p.evaluate(()=>document.getElementById('exShareT').textContent==='Share now'&&document.getElementById('dlgExp').open),'share needing a fresh tap offers "Share now"');
  await p.evaluate(()=>{navigator.share=async d=>{window.__shared.push({name:d.files[0].name,type:d.files[0].type,size:d.files[0].size});};});await tap('#exShare');await p.waitForTimeout(300);
  check(await p.evaluate(()=>window.__shared.length===2&&!document.getElementById('dlgExp').open),'"Share now" shares the prepared file');}
 // screenshot: dialog open over the painting (transparent PNG, all layers)
 await p.evaluate(()=>paintAPI.openExport());await p.waitForTimeout(100);await tap('#dlgExp input[name="exFmt"][value="png"]');await tap('#dlgExp input[name="exBg"][value="transparent"]');
 await p.evaluate(()=>{document.activeElement&&document.activeElement.blur();const t=document.getElementById('exToast');if(t)t.classList.remove('on');});await p.waitForTimeout(400);
 await p.screenshot({path:__dirname+'/screenshot-'+(VER||'vX')+'-export-'+vp.name+'.png'});
 // demo: transparent export over a checkerboard, a dark and a coloured background
 if(!mob){const url=await p.evaluate(async()=>{const r=await paintAPI.exportImage({fmt:'png',bg:'transparent'});const ib=await createImageBitmap(r.blob,{premultiplyAlpha:'premultiply'});
   const pw=Math.round(ib.width*.5),ph=Math.round(ib.height*.5),c=document.createElement('canvas');c.width=pw*3+40;c.height=ph+56;const g=c.getContext('2d');g.fillStyle='#161618';g.fillRect(0,0,c.width,c.height);
   const bgs=[['Checkerboard',(x,y)=>{for(let j=0;j<ph;j+=12)for(let i=0;i<pw;i+=12){g.fillStyle=((i+j)/12)%2?'#ffffff':'#cfcfcf';g.fillRect(x+i,y+j,Math.min(12,pw-i),Math.min(12,ph-j));}}],
    ['Dark',(x,y)=>{g.fillStyle='#1d2433';g.fillRect(x,y,pw,ph);}],['Colour gradient',(x,y)=>{const gr=g.createLinearGradient(x,y,x+pw,y+ph);gr.addColorStop(0,'#f6d365');gr.addColorStop(1,'#7ec8c8');g.fillStyle=gr;g.fillRect(x,y,pw,ph);}]];
   bgs.forEach(([n,f],k)=>{const x=10+k*(pw+10),y=10;g.save();g.beginPath();g.rect(x,y,pw,ph);g.clip();f(x,y);g.drawImage(ib,x,y,pw,ph);g.restore();g.fillStyle='#ececef';g.font='600 15px system-ui,sans-serif';g.fillText('Transparent PNG over: '+n,x+4,y+ph+28);});
   return c.toDataURL('image/png');});fs.writeFileSync(__dirname+'/screenshot-'+(VER||'vX')+'-transparent-demo.png',Buffer.from(url.split(',')[1],'base64'));}
 // persistence: choose JPEG 80%, current layer, 2x -> reload -> same choices
 if(!mob){await tap('#dlgExp input[name="exFmt"][value="jpeg"]');await p.$eval('#exQ',e=>{e.value='0.8';e.dispatchEvent(new Event('input',{bubbles:true}));});}
 else await tap('#dlgExp input[name="exFmt"][value="'+(st.formats&&false?'webp':'jpeg')+'"]');
 await tap('#dlgExp input[name="exLy"][value="current"]');await tap('#dlgExp input[name="exSz"][value="2"]');await tap('#exCancel');
 await p.reload();await p.waitForFunction(()=>window.paintAPI,null,{timeout:30000});await p.waitForTimeout(500);
 await p.evaluate(()=>paintAPI.openExport());await p.waitForTimeout(150);
 const per=await p.evaluate(()=>{const d=document.getElementById('dlgExp');const q=n=>d.querySelector('input[name="'+n+'"]:checked').value;return{fmt:q('exFmt'),bg:q('exBg'),ly:q('exLy'),sz:q('exSz'),q:document.getElementById('exQ').value,stored:paintAPI.exportOptions()};});
 check(per.fmt==='jpeg'&&per.ly==='current'&&per.sz==='2'&&per.bg==='paper'&&(mob||Math.abs(per.q-.8)<1e-6)&&per.stored.bg==='transparent','choices persist after reload (transparent remembered for PNG, JPEG shows paper)',per);
 await tap('#dlgExp input[name="exFmt"][value="png"]');check(await p.evaluate(()=>document.querySelector('#dlgExp input[name="exBg"]:checked').value)==='transparent','switching back to PNG restores Transparent');
 await p.keyboard.press('Escape');
 check(!errs.length,'no console/page errors',errs);await ctx.close();}
await b.close();console.log(fails?('FAILED '+fails):'ALL PASS');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
