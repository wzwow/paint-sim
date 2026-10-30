// Medium paint: offline support. The app is one HTML file plus icons.
// Pages: network first (so a new version shows up as soon as you're online), cached copy when offline.
// Icons/manifest: cache first. Bump VERSION with each release so old caches are cleared.
const VERSION='medium-v0.39';
const CORE=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-192.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('medium-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='version'&&e.source)e.source.postMessage({version:VERSION});});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
 if(r.mode==='navigate'||u.pathname.endsWith('/index.html')){
  // page: network first, 4 s timeout, then cache (ignore ?query so ?diag=1 etc. still open offline)
  e.respondWith((async()=>{const c=await caches.open(VERSION);
   try{const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),4000);const n=await fetch(r,{signal:ctl.signal,cache:'no-cache'});clearTimeout(t);
    if(n&&n.ok&&n.type==='basic')c.put('./index.html',n.clone());return n;}
   catch(_){return (await c.match('./index.html'))||(await c.match('./'))||Response.error();}})());return;}
 e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>m||fetch(r).then(n=>{if(n&&n.ok&&n.type==='basic'){const cl=n.clone();caches.open(VERSION).then(c=>c.put(r,cl));}return n;})));
});
