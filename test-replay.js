// v0.47 stroke recorder, replay and time-lapse video; v0.48: recording off by default, Record switch, red dot, Clear recording (Playwright + SwiftShader, headless).
// Usage: node test-replay.js [file] [--shots] [--video-out path]
// Checks: the recording replays to (nearly) the same picture; play/pause, speed, scrub and back-to-start work; the video is a real, playable
// file of the chosen length whose last frame is the finished painting; closing the replay leaves the painting, its undo history and pause
// state untouched; a saved project carries its recording; the phone layout of the replay bar fits and every control can be tapped.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const args=process.argv.slice(2);const tgt=args.find(a=>!a.startsWith('--')&&!/\.(mp4|webm)$/.test(a))||'index.html';const URL='file://'+path.resolve(__dirname,tgt)+'?welcome=0';
const SHOTS=args.includes('--shots');const vo=args.indexOf('--video-out');const VOUT=vo>=0?args[vo+1]:path.join(__dirname,'_wip','replay-sample');
const results=[];const errs=[];let cur='';
const check=(ok,name,detail)=>{results.push({ok:!!ok,name});console.log((ok?'  PASS ':'  FAIL ')+cur+' · '+name+(detail===undefined?'':'  → '+JSON.stringify(detail)));};
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
async function diff(p,a,b){return p.evaluate(async([a,b])=>{const ld=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=s;});const[A,B]=await Promise.all([ld(a),ld(b)]);
 if(A.width!==B.width||A.height!==B.height)return{size:[A.width,A.height,B.width,B.height]};const c=document.createElement('canvas');c.width=A.width;c.height=A.height;const g=c.getContext('2d');
 g.drawImage(A,0,0);const da=g.getImageData(0,0,c.width,c.height).data;g.clearRect(0,0,c.width,c.height);g.drawImage(B,0,0);const db=g.getImageData(0,0,c.width,c.height).data;
 let n=0,s=0,mx=0;for(let i=0;i<da.length;i+=4){const d=Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]);s+=d;if(d>mx)mx=d;if(d>48)n++;}
 return{frac:+(n/(da.length/4)).toFixed(5),mean:+(s/(da.length/4)/3).toFixed(3),max:mx};},[a,b]);}
// read the header of a saved .mpaint (gzip 'MPNT' + header length + JSON header)
const hdrOf=p=>p.evaluate(async()=>{const b=await paintAPI.saveProjectBytes();const raw=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 const hl=new DataView(raw.buffer).getUint32(4,true);return JSON.parse(new TextDecoder().decode(raw.subarray(8,8+hl)));});
const toastTxt=p=>p.evaluate(()=>document.getElementById('toast').textContent);
const dotShown=p=>p.evaluate(()=>{const d=document.getElementById('recDot');if(d.hidden)return false;const r=d.getBoundingClientRect();return r.width>=5&&r.height>=5&&getComputedStyle(d).display!=='none';});
async function openRecSettings(p,tap){if(!(await p.evaluate(()=>document.getElementById('panel').classList.contains('open')&&!document.getElementById('pBody').hidden)))await (tap?p.tap('#dSet'):p.click('#dSet'));await p.waitForTimeout(300);
 await p.evaluate(()=>{const g=document.getElementById('gRec');g.open=true;g.scrollIntoView({block:'start'});});await p.waitForTimeout(250);}
async function settingsClose(p){await p.evaluate(()=>{if(document.getElementById('panel').classList.contains('open'))document.getElementById('dClose').click();});await p.waitForTimeout(250);}
const live=p=>p.evaluate(()=>paintAPI.exportData('lit')[0][1].toDataURL('image/png'));
const st=p=>p.evaluate(()=>paintAPI.replayState());
async function waitFor(p,fn,ms,arg){const t0=Date.now();for(;;){const v=await p.evaluate(fn,arg);if(v)return v;if(Date.now()-t0>ms)return null;await p.waitForTimeout(150);}}
async function snap(p){await p.evaluate(()=>paintAPI.replaySnap());return waitFor(p,()=>paintAPI.replaySnapResult(),60000);}
// a small painting that uses most kinds of action
async function paint(p){await p.evaluate(()=>{const A=paintAPI;A.newCanvas(384,288);A.pause(true);
 const ln=(x0,y0,x1,y1,n)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t+.03*Math.sin(t*6)]);}return a;};
 A.setMed('water');A.setSize(40);A.selectPig(1);A.stroke(ln(.08,.3,.92,.34,30),.7);A.step(12);A.selectPig(2);A.stroke(ln(.1,.5,.9,.45,30),.7,{tl:{t:.4,phi:.6,pen:true}});A.step(40);
 A.setSurface({type:1});A.selectPig(3);A.setSize(22);A.stroke(ln(.2,.75,.8,.7,24),.6,{mouse:true});A.step(30);
 A.L.add();A.setMedium(1,'oil');A.selectPig(6);A.setSize(30);A.stroke(ln(.15,.15,.85,.6,30),.8);A.step(8);
 A.stroke(ln(.3,.9,.7,.1,20),.8);A.undo();A.redo();A.L.opacity(.8,true);
 A.setTool('knife');A.setHex('#e8d8a0');A.stroke(ln(.4,.2,.6,.8,16),.7);A.setTool('brush');A.step(6);
 A.setMed('water');A.selectPig(0);A.setSize(50);A.stroke(ln(.2,.4,.6,.4,20),.7);A.step(20);A.dryAll();A.step(4);A.render();});
 // a few real frames of the live sim (steps happen in requestAnimationFrame, as when a person paints)
 await p.evaluate(()=>paintAPI.pause(false));await p.waitForTimeout(700);await p.evaluate(()=>{paintAPI.pause(true);paintAPI.render();});}
(async()=>{fs.mkdirSync(path.dirname(VOUT),{recursive:true});const br=await chromium.launch({args:ARGS});
 // ---------------- desktop ----------------
 cur='desktop';console.log('== desktop');const ctx=await br.newContext({viewport:{width:1280,height:800},acceptDownloads:true});const p=await ctx.newPage();
 p.on('pageerror',x=>errs.push('desktop: '+x));p.on('console',m=>{if(m.type()==='error'&&!/ReadPixels|favicon|manifest/.test(m.text()))errs.push('desktop: '+m.text());});
 await p.goto(URL);await p.waitForTimeout(1500);
 // ---- v0.48: off by default ----
 let r0=await p.evaluate(()=>({pref:paintAPI.recPref(),set:document.getElementById('recOn').checked,sh:document.getElementById('shRec').checked,ls:localStorage.getItem('recordStrokes'),st:paintAPI.recState(),info:paintAPI.recInfo()}));
 check(!r0.pref&&!r0.set&&!r0.sh&&r0.ls===null&&r0.st==='off'&&!r0.info.on,'recording is off by default (Settings and Share switches unticked)',r0);
 check(!(await dotShown(p)),'no recording dot while off');
 await p.evaluate(()=>{const A=paintAPI;A.newCanvas(384,288);A.pause(true);A.setMed('water');A.setSize(40);A.selectPig(1);A.stroke([[.1,.3],[.5,.35],[.9,.3]],.7);A.step(20);A.render();});
 r0=await p.evaluate(()=>paintAPI.recInfo());check(r0.events===0&&r0.samples===0&&!r0.on,'off: painting captures no recording data',r0);
 let h0=await hdrOf(p);check(!('rec' in h0)&&(await p.evaluate(()=>paintAPI.recBytes()))===null,'off: saved .mpaint has no recording',Object.keys(h0));
 await p.keyboard.press('y');await p.waitForTimeout(300);let tt=await toastTxt(p);
 check(await p.evaluate(()=>document.getElementById('rp').hidden)&&/Recording is off\. Turn it on in Settings to replay future strokes/.test(tt),'off: Replay (Y) shows the friendly "Recording is off" message',tt);
 if(SHOTS)await p.screenshot({path:path.join(__dirname,'screenshot-v0.48-off-message-desktop.png')});
 await p.click('#tRep');await p.waitForTimeout(300);check(await p.evaluate(()=>document.getElementById('rp').hidden)&&/Recording is off/.test(await toastTxt(p)),'off: Replay button shows the same message, no overlay');
 // turn on mid-painting (strokes already on the paper): starts with the next new canvas, said plainly
 await openRecSettings(p);check(await p.evaluate(()=>{const c=document.getElementById('recOn');const r=c.getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&(e===c||e.closest('label')===c.closest('label'));}),'Settings › Replay & recording has a visible, clickable Record switch');
 await p.click('#recOn');await p.waitForTimeout(300);
 let r1=await p.evaluate(()=>({st:paintAPI.recState(),ls:localStorage.getItem('recordStrokes'),sh:document.getElementById('shRec').checked,txt:document.getElementById('recSt').textContent,info:paintAPI.recInfo()}));
 check(r1.st==='pending'&&r1.ls==='1'&&r1.sh&&/next new canvas/.test(r1.txt)&&r1.info.events===0,'on mid-painting: waits for the next new canvas and says so (both switches in sync, saved)',r1);
 check(!(await dotShown(p))&&/next new canvas/.test(await toastTxt(p)),'on mid-painting: no dot yet, toast explains why');
 if(SHOTS)await p.screenshot({path:path.join(__dirname,'screenshot-v0.48-settings-pending-desktop.png')});
 // the choice is remembered
 await p.reload();await p.waitForTimeout(1500);
 r1=await p.evaluate(()=>({pref:paintAPI.recPref(),set:document.getElementById('recOn').checked,sh:document.getElementById('shRec').checked}));check(r1.pref&&r1.set&&r1.sh,'Record choice is remembered after reload',r1);
 await p.evaluate(()=>{paintAPI.newCanvas(384,288);paintAPI.pause(true);});await p.waitForTimeout(300);
 check((await p.evaluate(()=>paintAPI.recState()))==='live'&&await dotShown(p),'new canvas with Record on: recording, red dot shown');
 await openRecSettings(p);
 if(SHOTS)await p.screenshot({path:path.join(__dirname,'screenshot-v0.48-settings-desktop.png')});
 await p.click('#recOn');await p.waitForTimeout(200);check((await p.evaluate(()=>paintAPI.recState()))==='off'&&!(await dotShown(p))&&(await p.evaluate(()=>localStorage.getItem('recordStrokes')))==='0','switch off: dot gone, choice saved');
 await p.click('#recOn');await p.waitForTimeout(200);check((await p.evaluate(()=>paintAPI.recState()))==='live'&&await dotShown(p),'switch on again on a blank canvas: recording straight away');
 await settingsClose(p);
 if(SHOTS){await p.waitForTimeout(400);await p.screenshot({path:path.join(__dirname,'screenshot-v0.48-indicator-desktop.png')});const bb=await p.evaluate(()=>{const r=document.getElementById('barL').getBoundingClientRect();return{x:r.x,y:r.y,width:Math.min(420,r.width),height:r.height};});await p.screenshot({path:path.join(__dirname,'screenshot-v0.48-indicator-closeup.png'),clip:{x:Math.max(0,bb.x-6),y:Math.max(0,bb.y-6),width:bb.width+12,height:bb.height+12}});}
 check(await p.evaluate(()=>{const b=document.getElementById('tRep');const r=b.getBoundingClientRect();return r.width>=40&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest('#tRep')===b;}),'Replay button in the top bar, visible and clickable');
 // empty canvas: friendly message, no overlay
 await p.evaluate(()=>paintAPI.newCanvas(384,288));await p.keyboard.press('y');await p.waitForTimeout(300);
 check(await p.evaluate(()=>document.getElementById('rp').hidden&&/Nothing to replay/.test(document.getElementById('toast').textContent)),'empty canvas: says there is nothing to replay');
 await paint(p);const info=await p.evaluate(()=>paintAPI.recInfo());check(info&&info.on&&info.events>10&&info.samples>100,'recording captured strokes, settings and steps',info);
 const L0=await live(p);const lay0=await p.evaluate(()=>JSON.stringify(paintAPI.layers()));
 // open with the shortcut
 await p.keyboard.press('y');let ok=await waitFor(p,()=>paintAPI.replayState().ready,60000);check(ok,'Y opens the replay and the sandbox loads');
 if(SHOTS){await p.waitForTimeout(600);await p.screenshot({path:path.join(__dirname,'screenshot-v0.48-replay-desktop.png')});}
 let s=await st(p);check(s.D>0&&s.playing,'replay starts playing on its own',{D:s.D,playing:s.playing});
 // pause / play
 await p.click('#rpPlay');await p.waitForTimeout(300);const c1=(await st(p)).clock;await p.waitForTimeout(500);const c2=(await st(p)).clock;s=await st(p);
 check(!s.playing&&Math.abs(c2-c1)<1,'pause stops the replay',{c1,c2});
 await p.keyboard.press('Space');await p.waitForTimeout(800);s=await st(p);check(s.playing||s.done,'Space plays again',{playing:s.playing,done:s.done});
 // speed
 await p.selectOption('#rpSpd','64');await p.waitForTimeout(200);check(await p.evaluate(()=>document.getElementById('rpTime').textContent.length>0),'speed menu works');
 // run to the end and compare with the real painting
 ok=await waitFor(p,()=>paintAPI.replayState().done,240000);check(ok,'replay reaches the end');
 let R=await snap(p);let d=await diff(p,L0,R.url);check(d.frac<0.01&&d.mean<1.5,'replayed picture matches the real painting (pixel diff)',d);
 if(SHOTS){await p.waitForTimeout(300);await p.screenshot({path:path.join(__dirname,'screenshot-v0.48-replay-desktop-end.png')});}
 // scrub to the middle: fewer strokes than the end
 s=await st(p);await p.evaluate(D=>{const r=document.getElementById('rpPos');r.value=500;r.dispatchEvent(new Event('input'));r.dispatchEvent(new Event('change'));},s.D);
 await p.waitForTimeout(400);ok=await waitFor(p,()=>{const s=paintAPI.replayState();return !s.ff&&Math.abs(s.clock-s.D/2)<s.D*.02&&s;},120000);if(ok){await p.waitForTimeout(400);ok=await waitFor(p,()=>{const s=paintAPI.replayState();return !s.ff&&Math.abs(s.clock-s.D/2)<s.D*.02&&s;},120000);}check(ok,'scrub bar seeks to the middle',ok&&{clock:ok.clock,D:ok.D});
 R=await snap(p);const dm=await diff(p,L0,R.url);check(dm.frac>0.02,'middle of the replay is an earlier state of the painting',dm);
 // back to start = blank paper
 // v0.48 test fix: pause, then wait until the replay reports playing=false and no catch-up twice in a row (a state message sent before the pause arrived can flip it back)
 {const t0=Date.now();let calm=0;while(Date.now()-t0<20000&&calm<2){const s=await st(p);if(s.playing){calm=0;if(!s.ff)await p.click('#rpPlay');}else if(s.ff)calm=0;else calm++;await p.waitForTimeout(300);}}
 await p.click('#rpBack');ok=await waitFor(p,()=>{const s=paintAPI.replayState();return !s.ff&&!s.playing&&s.clock<1&&s;},60000);check(ok,'back-to-start returns to the beginning');
 await p.evaluate(()=>paintAPI.replayState().playing&&document.getElementById('rpPlay').click());
 // ---- video ----
 await p.click('#rpVid');await p.waitForTimeout(200);check(await p.evaluate(()=>!document.getElementById('rpV').hidden),'Video opens the time-lapse options');
 const fmt=await p.evaluate(()=>document.getElementById('rpFmt').textContent);console.log('    format: '+fmt);
 await p.click('#rpLen button[data-v="15"]');check(await p.evaluate(()=>document.getElementById('rpHold').checked),'hold-final-frame option on by default');
 await p.click('#rpGo');const t0=Date.now();
 if(SHOTS){await p.waitForTimeout(2500);await p.screenshot({path:path.join(__dirname,'screenshot-v0.48-video-progress-desktop.png')});}
 ok=await waitFor(p,()=>{const s=paintAPI.replayState();return s.vid||(!s.busy&&document.getElementById('rpVSt').textContent.startsWith('Could not')&&document.getElementById('rpVSt').textContent);},600000);
 const vs=await st(p);console.log('    video took '+((Date.now()-t0)/1000).toFixed(1)+' s: '+JSON.stringify(vs.vid));
 check(vs.vid&&vs.vid.size>10000,'video file made and not empty',vs.vid||ok);
 if(vs.vid){const b64=await p.evaluate(async()=>{const f=paintAPI.replayVideoBlob();const b=new Uint8Array(await f.arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return btoa(s);});
  const ext=vs.vid.name.split('.').pop();const out=VOUT+'.'+ext;fs.writeFileSync(out,Buffer.from(b64,'base64'));console.log('    saved '+out);
  let pr=null;try{pr=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_name,width,height,nb_read_frames:format=duration,format_name','-of','json',out]).toString());}catch(e){pr={err:String(e)};}
  const sm=pr.streams&&pr.streams[0]||{};const dur=pr.format&&+pr.format.duration;console.log('    ffprobe: '+JSON.stringify(pr));
  check(sm.codec_name&&+sm.nb_read_frames===vs.vid.frames,'video decodes: every frame readable by ffmpeg',{codec:sm.codec_name,frames:sm.nb_read_frames,want:vs.vid.frames});
  check(dur>16.5&&dur<17.5,'video length = 15 s + 2 s hold',{dur});
  let dec=true;try{execFileSync('ffmpeg',['-v','error','-xerror','-i',out,'-f','null','-']);}catch(e){dec=false;}check(dec,'ffmpeg decodes the whole file without errors');
  const lastPng=path.join(__dirname,'_wip','replay-lastframe.png');try{execFileSync('ffmpeg',['-v','error','-y','-sseof','-0.5','-i',out,'-frames:v','1',lastPng]);
   const url='data:image/png;base64,'+fs.readFileSync(lastPng).toString('base64');const dv=await diff(p,L0,url);check(dv.mean<6&&dv.frac<0.08,'last video frame is the finished painting (allowing for compression)',dv);}catch(e){check(false,'extract last frame',String(e));}
  if(SHOTS){await p.waitForTimeout(500);await p.screenshot({path:path.join(__dirname,'screenshot-v0.48-video-desktop.png')});}
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:10000}).catch(()=>null),p.click('#rpDl')]);check(dl&&/timelapse\.(mp4|webm)$/.test(dl.suggestedFilename()),'Download gives the video file',dl&&dl.suggestedFilename());}
 // close: painting, layers, pause state and undo untouched
 await p.keyboard.press('Escape');await p.waitForTimeout(150);await p.keyboard.press('Escape');await p.waitForTimeout(300);
 check(await p.evaluate(()=>document.getElementById('rp').hidden&&!document.getElementById('rpFr')),'Esc closes the replay and frees the sandbox');
 const L1=await live(p);const d1=await diff(p,L0,L1);check(d1.max===0,'real painting unchanged after replay + video',d1);
 check(await p.evaluate(()=>JSON.stringify(paintAPI.layers()))===lay0,'layers unchanged');
 const ud=await p.evaluate(()=>{const a=paintAPI.exportData('lit')[0][1].toDataURL();paintAPI.undo();const b=paintAPI.exportData('lit')[0][1].toDataURL();paintAPI.redo();return a!==b;});check(ud,'undo history still works after the replay');
 const L2=await live(p);check((await diff(p,L0,L2)).frac<0.002,'redo restores it');
 // project round trip keeps the recording and replays to the same picture
 const n0=(await p.evaluate(()=>paintAPI.recInfo())).events;
 await p.evaluate(async()=>{const b=await paintAPI.saveProjectBytes();window.__pb=b;await paintAPI.openProjectBytes(b);paintAPI.pause(true);paintAPI.render();});
 const ri=await p.evaluate(()=>paintAPI.recInfo());check(ri.on&&!ri.nonblank&&ri.events>=n0,'saved project carries its recording',{before:n0,after:ri.events,bytes:ri.bytes});
 const L3=await live(p);await p.evaluate(()=>paintAPI.openReplay());await waitFor(p,()=>paintAPI.replayState().ready,60000);await p.selectOption('#rpSpd','64');
 ok=await waitFor(p,()=>paintAPI.replayState().done,240000);R=await snap(p);d=await diff(p,L3,R.url);check(ok&&d.frac<0.01&&d.mean<1.5,'reopened project replays to the same picture',d);
 await p.evaluate(()=>paintAPI.closeReplay());
 // v0.48: switching off keeps what was recorded (still replays), records nothing more
 await openRecSettings(p);await p.click('#recOn');await p.waitForTimeout(200);let ri2=await p.evaluate(()=>paintAPI.recInfo());
 await p.evaluate(()=>{paintAPI.stroke([[.2,.2],[.8,.25]],.7);paintAPI.step(4);});let ri3=await p.evaluate(()=>paintAPI.recInfo());
 check(ri2.frozen&&!ri2.live&&ri3.events===ri2.events&&ri3.samples===ri2.samples,'switch off mid-painting: no further strokes recorded',{ri2,ri3});
 await settingsClose(p);await p.click('#tRep');ok=await waitFor(p,()=>paintAPI.replayState().ready,60000);check(ok,'switched off: the existing recording still replays');await p.evaluate(()=>paintAPI.closeReplay());
 // Clear recording (two taps)
 await openRecSettings(p);check(await p.evaluate(()=>!document.getElementById('bRecClr').disabled),'Clear recording is available when there is a recording');
 await p.click('#bRecClr');await p.waitForTimeout(150);check(await p.evaluate(()=>paintAPI.recInfo().events>0&&/again/.test(document.getElementById('bRecClr').textContent)),'first tap only asks to confirm');
 await p.click('#bRecClr');await p.waitForTimeout(200);let ri4=await p.evaluate(()=>({i:paintAPI.recInfo(),dis:document.getElementById('bRecClr').disabled}));
 h0=await hdrOf(p);check(ri4.i.events===0&&ri4.dis&&!('rec' in h0),'second tap clears it; saved project then has no recording',ri4);
 await settingsClose(p);await p.keyboard.press('y');await p.waitForTimeout(300);check(await p.evaluate(()=>document.getElementById('rp').hidden)&&/Recording is off/.test(await toastTxt(p)),'after clearing (Record off): Replay shows the off message');
 // reopening a painting that has a recording still replays it, even with Record off; nothing new is recorded
 await p.evaluate(async()=>{await paintAPI.openProjectBytes(window.__pb);paintAPI.pause(true);paintAPI.render();});const ri5=await p.evaluate(()=>paintAPI.recInfo());
 await p.evaluate(()=>{paintAPI.stroke([[.3,.6],[.7,.62]],.7);paintAPI.step(4);});const ri6=await p.evaluate(()=>paintAPI.recInfo());
 check(ri5.frozen&&ri5.events>10&&ri6.events===ri5.events&&ri6.samples===ri5.samples&&!(await dotShown(p)),'Record off + reopened recorded painting: kept, nothing new recorded, no dot',{ri5,ri6});
 await p.click('#tRep');ok=await waitFor(p,()=>paintAPI.replayState().ready,60000);check(ok,'Record off: a reopened painting with a recording still replays');await p.evaluate(()=>paintAPI.closeReplay());
 h0=await hdrOf(p);check(h0.rec>0,'its recording is kept when saved again');
 await p.evaluate(()=>paintAPI.recSetPref(true,true));check((await p.evaluate(()=>paintAPI.recState()))==='pending','Record on after unrecorded strokes on a reopened painting: waits for the next canvas');
 // a painting from before v0.47 (project without a recording) says it cannot be replayed
 await p.evaluate(async()=>{const raw=new Uint8Array(await new Response(new Blob([window.__pb]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());const hl=new DataView(raw.buffer).getUint32(4,true);
  const hdr=JSON.parse(new TextDecoder().decode(raw.subarray(8,8+hl)));const n=hdr.rec;delete hdr.rec;let js=JSON.stringify(hdr);if(new TextEncoder().encode(js).length%2)js+=' ';const hb=new TextEncoder().encode(js);
  const body=raw.subarray(8+hl+((2-(8+hl)%2)%2),raw.length-n);const parts=[new TextEncoder().encode('MPNT'),new Uint32Array([hb.length]),hb,body];
  const gz=new Blob(parts).stream().pipeThrough(new CompressionStream('gzip'));await paintAPI.openProjectBytes(new Uint8Array(await new Response(gz).arrayBuffer()));});
 await p.click('#tRep');await p.waitForTimeout(300);check(await p.evaluate(()=>document.getElementById('rp').hidden&&/has no recording/.test(document.getElementById('toast').textContent)),'old painting (no recording): explains it cannot be replayed');
 await ctx.close();
 // ---------------- phone ----------------
 cur='phone';console.log('== phone');
 for(const vp of [{w:390,h:844},{w:360,h:740},{w:844,h:390}]){const c2=await br.newContext({viewport:{width:vp.w,height:vp.h},deviceScaleFactor:3,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-N986B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'});
  const q=await c2.newPage();q.on('pageerror',x=>errs.push('phone: '+x));q.on('console',m=>{if(m.type()==='error'&&!/ReadPixels|favicon|manifest/.test(m.text()))errs.push('phone: '+m.text());});
  await q.goto(URL);await q.waitForTimeout(1500);cur='phone '+vp.w+'x'+vp.h;
  const tb=await q.evaluate(()=>{const bar=document.getElementById('barL').getBoundingClientRect();const bs=[...document.querySelectorAll('#barL .ib')].filter(b=>b.offsetParent);const R=bs.map(b=>b.getBoundingClientRect());
   let ov=0;for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++)if(R[i].right>R[j].left+1&&R[j].right>R[i].left+1&&R[i].bottom>R[j].top+1&&R[j].bottom>R[i].top+1)ov++;
   const hit=bs.every((b,i)=>{const r=R[i];const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e&&e.closest('.ib')===b;});
   return{n:bs.length,ov,hit,inside:R.every(r=>r.left>=0&&r.right<=innerWidth),minW:Math.min(...R.map(r=>r.width)),barR:bar.right,vw:innerWidth,rep:!!document.getElementById('tRep').offsetParent};});
  check(!tb.rep&&tb.ov===0&&tb.hit&&tb.inside&&tb.minW>=40,'top bar fits, same targets as v0.46 (Replay lives in the Share sheet on phones)',tb);
  await q.evaluate(()=>{paintAPI.newCanvas(320,420);paintAPI.pause(true);});
  check(!(await q.evaluate(()=>paintAPI.recPref())),'phone: recording off by default');
  await q.tap('#tShare');await q.waitForTimeout(500);
  const shr=await q.evaluate(()=>{const c=document.getElementById('shRec');const l=c.closest('label');l.scrollIntoView({block:'center'});const r=l.getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{h:r.height,inside:r.left>=0&&r.right<=innerWidth,hit:!!e&&l.contains(e),checked:c.checked};});
  check(shr.h>=36&&shr.inside&&shr.hit&&!shr.checked,'Share sheet has a tappable Record switch (off)',shr);
  await q.tap('#shRec');await q.waitForTimeout(300);check((await q.evaluate(()=>paintAPI.recState()))==='live'&&await q.evaluate(()=>/Recording\./.test(document.getElementById('shRecSt').textContent)),'Share sheet switch turns recording on (blank canvas: straight away)');
  if(SHOTS&&vp.w===390)await q.screenshot({path:path.join(__dirname,'screenshot-v0.48-share-phone.png')});
  await q.tap('#shClose');await q.waitForTimeout(300);check(await dotShown(q),'phone: red recording dot visible in the top bar');
  const tb2=await q.evaluate(()=>{const bs=[...document.querySelectorAll('#barL .ib')].filter(b=>b.offsetParent);return bs.every(b=>{const r=b.getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e&&e.closest('.ib')===b;})&&document.getElementById('barL').getBoundingClientRect().right<=innerWidth;});
  check(tb2,'phone: the dot does not cover or push any top-bar button');
  if(SHOTS&&vp.w===390){await q.screenshot({path:path.join(__dirname,'screenshot-v0.48-indicator-phone.png')});await openRecSettings(q,true);await q.screenshot({path:path.join(__dirname,'screenshot-v0.48-settings-phone.png')});
   check(await q.evaluate(()=>{const c=document.getElementById('recOn');const l=c.closest('label');const r=l.getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return c.checked&&r.height>=36&&!!e&&l.contains(e);}),'phone Settings: Record switch ticked and tappable');await settingsClose(q);}
  await q.evaluate(()=>{const A=paintAPI;A.pause(true);A.setMed('water');A.setSize(40);A.selectPig(1);for(let k=0;k<4;k++)A.stroke([[.15,.2+k*.18],[.5,.25+k*.18],[.85,.2+k*.18]].map(a=>a),.7);A.step(30);A.render();});
  await q.tap('#tShare');await q.waitForTimeout(500);check(await q.evaluate(()=>{const b=document.getElementById('shRep');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return r.height>=40&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;}),'Share sheet shows a tappable Replay entry');
  await q.tap('#shRep');ok=await waitFor(q,()=>paintAPI.replayState().ready,60000);check(ok&&await q.evaluate(()=>!document.getElementById('dlgShr').open),'Share → Replay opens the replay (sheet closed)');await q.waitForTimeout(700);
  const lay=await q.evaluate(()=>{const ids=['rpPlay','rpBack','rpPos','rpTime','rpSpd','rpVid','rpX'];const R=ids.map(i=>document.getElementById(i).getBoundingClientRect());let ov=[];
   for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++)if(R[i].right>R[j].left+1&&R[j].right>R[i].left+1&&R[i].bottom>R[j].top+1&&R[j].bottom>R[i].top+1)ov.push(ids[i]+'/'+ids[j]);
   const hit=ids.filter(i=>i!=='rpTime').every(i=>{const r=document.getElementById(i).getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===document.getElementById(i)||document.getElementById(i).contains(e);});
   const fr=document.getElementById('rpFr').getBoundingClientRect(),bar=document.getElementById('rpBar').getBoundingClientRect();
   return{ov,hit,inside:R.every(r=>r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight),minH:Math.min(...R.filter((r,i)=>ids[i]!=='rpTime').map(r=>r.height)),stage:fr.height>100&&fr.bottom<=bar.top+1,scroll:document.scrollingElement.scrollWidth>innerWidth};});
  check(lay.ov.length===0&&lay.hit&&lay.inside&&lay.minH>=40&&lay.stage&&!lay.scroll,'replay bar fits the phone, no overlaps, every control tappable',lay);
  if(SHOTS&&vp.w===390)await q.screenshot({path:path.join(__dirname,'screenshot-v0.48-replay-phone.png')});
  await q.tap('#rpVid');await q.waitForTimeout(300);const vl=await q.evaluate(()=>{const v=document.getElementById('rpV').getBoundingClientRect(),b=document.getElementById('rpBar').getBoundingClientRect();
   return{shown:!document.getElementById('rpV').hidden,inside:v.left>=0&&v.right<=innerWidth&&v.top>=0,clearOfBar:v.bottom<=b.top+2};});
  check(vl.shown&&vl.inside&&vl.clearOfBar,'video options fit above the bar',vl);
  if(SHOTS&&vp.w===390){await q.waitForTimeout(200);await q.screenshot({path:path.join(__dirname,'screenshot-v0.48-video-phone.png')});}
  await q.tap('#rpX').catch(()=>{});await q.waitForTimeout(150);if(!(await q.evaluate(()=>document.getElementById('rp').hidden))){await q.tap('#rpVx');await q.tap('#rpX');}
  await q.waitForTimeout(300);check(await q.evaluate(()=>document.getElementById('rp').hidden),'close button closes the replay');await c2.close();}
 cur='all';check(errs.length===0,'no console or page errors',errs.slice(0,8));
 await br.close();const f=results.filter(r=>!r.ok);console.log(f.length?'FAILED '+f.length+' of '+results.length:'ALL PASS ('+results.length+' checks)');process.exit(f.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
