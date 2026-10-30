// v0.16 regression: paper/surface texture must not show a grid/brick pattern (Galaxy Note v0.15: faint brick lines in bare paper).
// For every surface type, renders the bare surface (lit, 560x1024 like a phone canvas) twice:
//   normal   : as shipped
//   jittered : in about half of the value-noise cells (chosen per cell), the far lattice corners are looked up at corner + 1e-4, so a
//              corner shared by two cells is hashed from slightly different inputs (emulates the per-call-site /
//              per-GPU rounding differences of mobile compilers - about 1.5 fp32 ulp of the old hash's p*456.21 products at
//              canvas-scale coordinates; SwiftShader itself computes everything identically, so the real failure needs this emulation)
// Pass: (1) jittered == normal (max 8-bit difference <= 2): the paper does not depend on low-order rounding;
//       (2) grid detector (tools/grid_metrics.py --all, periods 8..128 px, x and y) <= 1.8 on both renders, for the paper types
//           (watercolour cold-press / hot-press / rough / smooth; the canvas weaves are periodic by design and only get check 1);
//       (3) straight-line detector (long axis-aligned edges, 41 px runs) <= 7 for the paper types (noise ~4; the Note v0.15 bare-paper
//           screenshot scores 11.8/9.9; v0.15 rough paper with the jitter 16/20).
// Also runs a JS fp32 check of the hash: an integer pcg2d port must give identical values for a corner reached from either cell.
// Usage: node test-paper.js [file.html]  (exit 0 pass, 1 fail, 2 crash). ~1 min.
const {chromium}=require('playwright');const lines={};const fs=require('fs');const {execFileSync}=require('child_process');
const FILE=process.argv[2]||'index.html';const GRID_MAX=1.8,LINE_MAX=7,TYPES=[0,1,2,3,4,5],PAPERS=[0,1,2,5];
const J='1e-4';
function jitterCopy(){let s=fs.readFileSync(__dirname+'/'+FILE,'utf8');const JC=`${J}*step(.5,fract(i.x*.618+i.y*.382))`;const reps=[['hash(i+vec2(1,0))',`hash(i+vec2(1.+${JC},0))`],['hash(i+vec2(0,1))',`hash(i+vec2(0,1.+${JC}))`],['hash(i+1.)',`hash(i+1.+${JC})`]];
 for(const [a,b] of reps){if(!s.includes(a))throw new Error('cannot find '+a+' in '+FILE);s=s.split(a).join(b);}const t='_paper_jit.html';fs.writeFileSync(__dirname+'/'+t,s);return t;}
async function renders(b,file){const p=await (await b.newContext({viewport:{width:600,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
 await p.goto('file://'+__dirname+'/'+file);await p.waitForFunction(()=>window.paintAPI,null,{timeout:20000});const out={};
 for(const t of TYPES){out[t]=await p.evaluate(t=>{const A=paintAPI;A.newCanvas(560,1024);A.pause(true);A.setSurface({type:t});A.render();return A.exportData('lit')[0][1].toDataURL('image/png');},t);}
 await p.close();if(errs.length)throw new Error(errs.join());return out;}
function decode(f){return JSON.parse(execFileSync('python3',['-c',`import sys,json,numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int);b=np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(int);d=np.abs(a-b)
print(json.dumps({'max':int(d.max()),'mean':float(d.mean()),'p999':float(np.percentile(d,99.9))}))`,...f]).toString());}
(async()=>{let code=0;const jf=jitterCopy();const fails=[];
 try{// JS check of the integer hash (same arithmetic as the shader)
  const M=Math.imul;const ph=(x,y)=>{let a=(x+32768)>>>0,b=(y+32768)>>>0;a=(M(a,1664525)+1013904223)>>>0;b=(M(b,1664525)+1013904223)>>>0;a=(a+M(b,1664525))>>>0;b=(b+M(a,1664525))>>>0;a^=a>>>16;b^=b>>>16;a=(a+M(b,1664525))>>>0;b=(b+M(a,1664525))>>>0;a^=a>>>16;return (a>>>8)/16777216;};
  let bad=0;for(let y=0;y<2048;y+=7)for(let x=0;x<2048;x+=5){const c=Math.floor(x+1+1e-4+.5)-1,d=Math.floor(y+.5);if(ph(c+1,d)!==ph(x+1,y))bad++;}
  console.log('JS integer-hash corner agreement: '+(bad?bad+' mismatches':'exact'));if(bad)fails.push('integer hash corner mismatch');
  const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const [N,Jt]=await Promise.all([renders(b,FILE),renders(b,jf)]);await b.close();
  for(const t of TYPES){const fn=__dirname+`/test-paper-t${t}.png`,fj=__dirname+`/test-paper-t${t}-jitter.png`;
   fs.writeFileSync(fn,Buffer.from(N[t].split(',')[1],'base64'));fs.writeFileSync(fj,Buffer.from(Jt[t].split(',')[1],'base64'));
   const d=decode([fn,fj]);const gmA=f=>JSON.parse(execFileSync('python3',[__dirname+'/tools/grid_metrics.py',f,'--all']).toString()).a;const gm=f=>{const r=gmA(f);lines[f]=r.lines;return r.period;};
   const gn=gm(fn),gj=gm(fj);const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>k+':'+v).join(' ');
   console.log(`type ${t}: jitter diff max ${d.max} p99.9 ${d.p999.toFixed(1)} mean ${d.mean.toFixed(3)} | grid normal ${top(gn)} | grid jittered ${top(gj)} | straight lines normal h${lines[fn].h} v${lines[fn].v} jittered h${lines[fj].h} v${lines[fj].v}`);
   if(d.max>2)fails.push(`type ${t}: paper changes with 1e-4 lattice jitter (max diff ${d.max}/255) => precision-sensitive`);
   if(PAPERS.includes(t))for(const [nm,f] of [['normal',fn],['jittered',fj]])for(const [k,v] of Object.entries(lines[f]))if(v>LINE_MAX)fails.push(`type ${t} ${nm}: straight ${k==='h'?'horizontal':'vertical'} lines score ${v} > ${LINE_MAX}`);
   if(PAPERS.includes(t))for(const [nm,g] of [['normal',gn],['jittered',gj]])for(const [k,v] of Object.entries(g))if(v>GRID_MAX)fails.push(`type ${t} ${nm}: grid period ${k} score ${v} > ${GRID_MAX}`);}
  console.log(fails.length?'FAIL\n - '+fails.join('\n - '):'PASS');code=fails.length?1:0;}
 catch(e){console.error('CRASH',e);code=2;}fs.unlinkSync(__dirname+'/'+jf);process.exit(code);})();
