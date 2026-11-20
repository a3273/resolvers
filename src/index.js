// ============================================================================
// TVNOW-CF v1.6 — FIX KEYFRAME (10 segmenti + DISCONTINUITY iniziale)
// ============================================================================
// Fix: servire 10 segmenti invece di 6 per garantire un keyframe all'inizio.
// Aggiungere EXT-X-DISCONTINUITY all'inizio per forzare il reset del decoder.
// Mantiene: NO cache-busting per NTV, header corretti.
// ============================================================================

const CONFIG = {
  VERSION: 'TVNOW-CF v1.6',
  FEATURES: ['Fix keyframe (10 segmenti + DISCONTINUITY)', 'NO cache-busting NTV', 'Vavoo Raw Bypass', 'Daddy Deep Scraping']
};

const CHANNELS = [
  { slug:'sky-sport-24', name:'Sky Sport 24', ntv:'869', vavoo:'sky sport 24', daddy:'869', vid6:'2775802255', vid7:'3445562519' },
  { slug:'sky-sport-uno', name:'Sky Sport Uno', ntv:'461', vavoo:'sky sport uno', daddy:'461', vid6:'210669162', vid7:'3192996672' },
  { slug:'sky-sport-calcio', name:'Sky Sport Calcio', ntv:'870', vavoo:'sky sport calcio', daddy:'870', vid6:'1665920101', vid7:'449990998' },
  { slug:'sky-sport-serie-a', name:'Sky Sport Serie A', ntv:'', vavoo:'sky sport serie a', daddy:'880', vid6:'2077387085', vid7:'' },
  { slug:'sky-sport-tennis', name:'Sky Sport Tennis', ntv:'576', vavoo:'sky sport tennis', daddy:'576', vid6:'2100771782', vid7:'78546677' },
  { slug:'sky-sport-f1', name:'Sky Sport F1', ntv:'577', vavoo:'sky sport f1', daddy:'577', vid6:'4246774056', vid7:'2289038972' },
  { slug:'sky-sport-motogp', name:'Sky Sport MotoGP', ntv:'575', vavoo:'sky sport motogp', daddy:'575', vid6:'3036316886', vid7:'2090703806' },
  { slug:'sky-sport-arena', name:'Sky Sport Arena', ntv:'462', vavoo:'sky sport arena', daddy:'462', vid6:'3007400791', vid7:'2555960713' },
  { slug:'sky-sport-max', name:'Sky Sport Max', ntv:'460', vavoo:'sky sport max', daddy:'460', vid6:'2066326916', vid7:'' },
  { slug:'sky-sport-basket', name:'Sky Sport Basket', ntv:'875', vavoo:'sky sport basket', daddy:'875', vid6:'2711959620', vid7:'326825326' },
  { slug:'sky-sport-golf', name:'Sky Sport Golf', ntv:'574', vavoo:'sky sport golf', daddy:'574', vid6:'729945219', vid7:'3897711086' },
  { slug:'dazn-1', name:'DAZN 1', ntv:'877', vavoo:'dazn 1', daddy:'877', vid6:'1376440573', vid7:'2745635299' },
  { slug:'eurosport-1', name:'Eurosport 1', ntv:'878', vavoo:'eurosport 1', daddy:'878', vid6:'3481346857', vid7:'3448075317' },
  { slug:'eurosport-2', name:'Eurosport 2', ntv:'879', vavoo:'eurosport 2', daddy:'879', vid6:'2283887097', vid7:'2317684453' },
  { slug:'rsi-la-1', name:'RSI La 1', ntv:'2455610203', vavoo:'rsi la 1', daddy:'', vid6:'2455610203', vid7:'2290395046' },
  { slug:'rsi-la-2', name:'RSI La 2', ntv:'3590183307', vavoo:'rsi la 2', daddy:'', vid6:'3590183307', vid7:'3475299702' },
  { slug:'sky-cinema-uno', name:'Sky Cinema Uno', ntv:'860', vavoo:'sky cinema uno', daddy:'860', vid6:'2872151911', vid7:'1759625738' },
  { slug:'sky-cinema-action', name:'Sky Cinema Action', ntv:'861', vavoo:'sky cinema action', daddy:'861', vid6:'3812796171', vid7:'1144128726' },
  { slug:'sky-cinema-comedy', name:'Sky Cinema Comedy', ntv:'862', vavoo:'sky cinema comedy', daddy:'862', vid6:'500203271', vid7:'3131104474' },
  { slug:'sky-cinema-collection', name:'Sky Cinema Collection', ntv:'859', vavoo:'sky cinema collection', daddy:'859', vid6:'', vid7:'3525837057' },
  { slug:'sky-cinema-romance', name:'Sky Cinema Romance', ntv:'864', vavoo:'sky cinema romance', daddy:'864', vid6:'2890008905', vid7:'1281264885' },
  { slug:'sky-cinema-family', name:'Sky Cinema Family', ntv:'865', vavoo:'sky cinema family', daddy:'865', vid6:'415795144', vid7:'3216516117' },
  { slug:'sky-cinema-drama', name:'Sky Cinema Drama', ntv:'867', vavoo:'sky cinema drama', daddy:'867', vid6:'1235530177', vid7:'' },
  { slug:'sky-cinema-suspense', name:'Sky Cinema Suspense', ntv:'868', vavoo:'sky cinema suspense', daddy:'868', vid6:'1820997555', vid7:'3060043751' },
  { slug:'sky-calcio-251', name:'Sky Calcio 251', ntv:'871', vavoo:'', daddy:'871', vid6:'', vid7:'' },
  { slug:'sky-calcio-252', name:'Sky Calcio 252', ntv:'872', vavoo:'', daddy:'872', vid6:'', vid7:'' },
  { slug:'sky-calcio-253', name:'Sky Calcio 253', ntv:'873', vavoo:'', daddy:'873', vid6:'', vid7:'' },
  { slug:'sky-serie', name:'Sky Serie', ntv:'880', vavoo:'sky serie', daddy:'880', vid6:'836680112', vid7:'' },
  { slug:'sky-crime', name:'Sky Crime', ntv:'863', vavoo:'sky crime', daddy:'863', vid6:'', vid7:'' }
];

const ALIASES = { 'dazn':'dazn-1','serie-a':'sky-sport-serie-a', 'sky-calcio-1':'sky-calcio-251','sky-calcio-2':'sky-calcio-252','sky-calcio-3':'sky-calcio-253' };

const BY_KEY = (() => {
  const m = new Map();
  for (const c of CHANNELS) {
    m.set(c.slug, c); m.set(norm(c.name), c);
    if (c.ntv) m.set(c.ntv, c); if (c.daddy) m.set('d'+c.daddy, c);
    if (c.vid6) m.set('v'+c.vid6, c); if (c.vid7) m.set('v'+c.vid7, c);
  }
  for (const [a,s] of Object.entries(ALIASES)) { const c = m.get(s); if (c) m.set(a, c); }
  return m;
})();

function norm(s){ return String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function findCh(q){ let k=norm(q); if(BY_KEY.has(k)) return BY_KEY.get(k); k=k.replace(/-ntv$/,'').replace(/-daddy$/,''); return BY_KEY.get(k)||null; }

function elencoCanali(u){
  const search=(u&&u.searchParams.get('q'))||'';
  const L=[CONFIG.VERSION+' — CANALI ('+CHANNELS.length+')'];
  L.push('Uso: /live?ch=<slug>');
  for(const c of CHANNELS){
    if(search && !c.slug.includes(search) && !c.name.toLowerCase().includes(search)) continue;
    L.push('  '+c.slug.padEnd(24)+' ntv='+String(c.ntv).padEnd(4)+' v6='+(c.vid6||'-').padEnd(12)+' daddy='+(c.daddy||'-'));
  }
  return L.join('\n');
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchStream(url, ref) {
  const isRaw = /https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url) || url.includes('sunshine');
  
  const headers = isRaw ? {
    'User-Agent': UA,
    'Referer': ref || 'https://geil.to/',
    'Accept': '*/*'
  } : {
    'User-Agent': UA,
    'Referer': ref || 'https://tvnow247.today/',
    'Origin': ref ? ref.replace(/\/$/, '') : 'https://tvnow247.today',
    'Accept': '*/*'
  };

  let r = await fetchT(url, { headers }, 8000);
  
  if (r.status === 403 && url.startsWith('http://')) {
    r = await fetchT(url.replace('http://', 'https://'), { headers }, 8000);
  }
  
  return r;
}

const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';
const tokenCache = new Map();

async function ntvToken(id){
  const now=Date.now()/1000; const c=tokenCache.get(id);
  if(c && c.exp-now>900) return c;
  const r=await fetchT(NTV_API+id,{headers:{'User-Agent':UA,'Referer':'https://tvnow247.today/'}},8000);
  if(!r.ok) throw new Error('ntv api '+r.status);
  const j=await r.json().catch(()=>null);
  const m3u8=j&&(j.m3u8||j.proxyPlaylistUrl||j.proxyPlayerUrl);
  if(!m3u8) throw new Error('ntv api senza m3u8');
  const exp=+(String(m3u8).match(/[?&]e=(\d+)/)||[])[1]||(now+3600);
  const entry={m3u8,exp,ref:(j&&j.referer)||'https://tvnow247.today/'};
  tokenCache.set(id,entry); return entry;
}

async function ntvPlaylist(id){
  let tk=await ntvToken(id);
  let r=await fetchT(tk.m3u8,{headers:{'User-Agent':UA,'Referer':tk.ref}},8000);
  let txt=r.ok?await r.text():'';
  const bad=!r.ok||r.status>=500||!txt.includes('#EXTM3U');
  if(bad){ tokenCache.delete(id); tk=await ntvToken(id); r=await fetchT(tk.m3u8,{headers:{'User-Agent':UA,'Referer':tk.ref}},8000); txt=r.ok?await r.text():''; }
  if(!txt.includes('#EXTM3U')) throw new Error('ntv playlist '+r.status+' non-HLS');
  return {txt,ref:tk.ref,base:tk.m3u8};
}

const DADDY_DOMAINS=['https://thedaddy.li','https://daddylivetv.sbs'];
const daddyCache=new Map();

async function daddyResolve(id){
  if(!id) return null;
  const now=Date.now(); const cached=daddyCache.get(id);
  if(cached&&cached.exp>now) return cached.url;
  for(const domain of DADDY_DOMAINS){
    try{
      let m3u8=await extractM3u8Deep(`${domain}/embed/stream-${id}.php`, domain, 5000, 0);
      if(m3u8){ daddyCache.set(id,{url:m3u8,exp:now+180000}); return m3u8; }
      m3u8=await extractM3u8Deep(`${domain}/watch.php?id=${id}`, domain, 5000, 0);
      if(m3u8){ daddyCache.set(id,{url:m3u8,exp:now+180000}); return m3u8; }
    }catch(e){ continue; }
  }
  return null;
}

async function extractM3u8Deep(url, refererDomain, timeoutMs, depth){
  if(depth > 2) return null;
  
  const r=await fetchT(url,{headers:{'User-Agent':UA,'Referer':refererDomain+'/'},cf:{cacheTtl:300,cacheEverything:true}},timeoutMs);
  if(!r.ok) return null;
  const html=await r.text();
  
  let m3u8=html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if(m3u8) return m3u8[1];
  
  const jsVar = html.match(/(?:file|source|url|m3u8)["']?\s*[:=]\s*["']([^"']+)["']/i);
  if(jsVar && jsVar[1].includes('.m3u8')) return jsVar[1];
  
  const iframe=html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
  if(iframe){
    return await extractM3u8Deep(iframe[1], url, timeoutMs, depth + 1);
  }
  
  return null;
}

const VAVOO_MIRRORS=['https://geil.to','https://geil.app','https://geil.win','https://vavoo.to','https://kool.to','https://vavoo.net'];
const VAVOO_SOURCES=['https://raw.githubusercontent.com/aphrodite747/VvOo/main/index_Italy.m3u','https://raw.githubusercontent.com/BontAce/VVOOITV/main/index_Italy.m3u'];
let vavooMap={map:null,t:0,src:''};

async function ensureVavooMap(force){
  const cached=(vavooMap.map&&Date.now()-vavooMap.t<21600000)?vavooMap.map:null;
  if(cached&&!force) return cached;
  for(const src of VAVOO_SOURCES){
    try{
      const r=await fetchT(src,{headers:{'User-Agent':'VAVOO/1.0'}},10000); if(!r.ok) continue;
      const t=await r.text(); const m=new Map();
      for(const b of t.split('#EXTINF')){
        const nm=(b.match(/tvg-name="([^"]+)"/)||[])[1];
        const id=(b.match(/vavoo\/(\d+)\.m3u8/)||[])[1];
        if(nm&&id){ const k=norm(nm.replace(/\s*\(\d+\)\s*$/,'')); if(k&&!m.has(k)) m.set(k,id); }
      }
      if(m.size>50){ vavooMap={map:m,t:Date.now(),src}; return m; }
    }catch(e){}
  }
  return cached;
}

function vavooMapFind(query,m){
  if(!m||!query) return null;
  const q=norm(query); if(m.has(q)) return m.get(q);
  const qTok=q.split('-').filter(Boolean);
  let best=null,bestScore=-1;
  for(const [k,id] of m){
    const kTok=k.split('-').filter(Boolean);
    if(qTok.every(w=>kTok.includes(w))){ const score=qTok.length-(kTok.length-qTok.length); if(score>bestScore){ bestScore=score; best=id; } }
  }
  return best;
}

async function vavooResolveId(base,id){
  const play=base+'/live/play/'+id;
  try{ const r=await fetchT(base+'/live/resolve?url='+encodeURIComponent(play),{headers:{'User-Agent':UA,'Referer':base+'/'}},5000); if(r.ok){ const j=await r.json().catch(()=>null); if(j&&j.url) return j.url; } }catch(e){}
  try{ const r=await fetchT(base+'/mediahubmx-resolve.json',{method:'POST',headers:{'User-Agent':'MediaHubMX/2','Content-Type':'application/json','Origin':base,'Referer':base+'/'},body:JSON.stringify({language:'de',region:'DE',url:play,clientVersion:'3.0.2'})},5000); if(r.ok){ const j=await r.json().catch(()=>null); if(j&&j.url) return j.url; } }catch(e){}
  return null;
}

const vavooURLCache=new Map();

async function vavooResolveDual(slug,vid6,vid7){
  const now=Date.now();
  const cacheKey=slug||('q:'+norm(slug));
  const cachedUrl=vavooURLCache.get(cacheKey);
  if(cachedUrl&&cachedUrl.exp>now) return cachedUrl.url;
  
  let firstId=vid6, secondId=vid7;
  if(!firstId&&!secondId){ const m=await ensureVavooMap(); firstId=vavooMapFind(slug,m); }
  
  if(firstId){
    for(const base of VAVOO_MIRRORS.slice(0,6)){
      const u=await vavooResolveId(base,firstId);
      if(u){ vavooURLCache.set(cacheKey,{url:u,exp:now+120000}); return u; }
    }
  }
  if(secondId){
    for(const base of VAVOO_MIRRORS.slice(0,6)){
      const u=await vavooResolveId(base,secondId);
      if(u){ vavooURLCache.set(cacheKey,{url:u,exp:now+120000}); return u; }
    }
  }
  return null;
}

async function live(u, P, legacy) {
  const q = u.searchParams.get('ch') || u.searchParams.get('c') || '';
  if (!q) return R('uso: /live?ch=<slug>\n\n' + elencoCanali(u), 200, TXT());
  const c = findCh(q);
  if (!c) return R('canale non mappato: "' + q + '"\n\n' + elencoCanali(u), 200, TXT());

  const order = legacy ? [legacy, ...['vavoo', 'daddy', 'ntv'].filter(x => x !== legacy)] : (u.searchParams.get('p') || 'vavoo,daddy,ntv').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const availableOrder = order.filter(p => {
    if (p === 'vavoo') return c.vavoo || c.vid6 || c.vid7;
    if (p === 'ntv') return c.ntv;
    if (p === 'daddy') return c.daddy;
    return true;
  });

  const provs = {
    vavoo: async () => {
      if (!c.vavoo && !c.vid6 && !c.vid7) return null;
      const vu = await vavooResolveDual(c.slug, c.vid6, c.vid7);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/i.test(vu)) {
        const r = await fetchStream(vu, 'https://geil.to/');
        if (!r.ok) { vavooURLCache.delete(c.slug); return null; }
        return rewriteAny(await r.text(), vu, P, 'https://geil.to/', 'https://geil.to');
      }
      return R('redirect vavoo', 302, { Location: vu, ...CORS() });
    },
    ntv: async () => {
      if (!c.ntv) return null;
      const pl = await ntvPlaylist(c.ntv);
      return rewriteAny(pl.txt, pl.base, P, pl.ref, '');
    },
    daddy: async () => {
      if (!c.daddy) return null;
      const du = await daddyResolve(c.daddy);
      if (!du || !/\.m3u8/i.test(du)) return null;
      const r = await fetchStream(du, 'https://thedaddy.li/');
      if (!r.ok) { daddyCache.delete(c.daddy); return null; }
      const processed = rewriteAny(await r.text(), du, P, 'https://thedaddy.li/', '');
      return ['#EXTVLCOPT:http-referrer=https://thedaddy.li/', '#EXTVLCOPT:http-user-agent=' + UA].concat(processed.split('\n')).join('\n');
    }
  };

  for (const p of availableOrder) {
    const fn = provs[p];
    if (!fn) continue;
    try {
      const res = await fn();
      if (res) return R(res, 200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-cache, no-store, must-revalidate', ...CORS() });
    } catch (e) { /* continua */ }
  }
  return R('ERRORE: provider KO per ' + c.name + '. /probe?ch=' + c.slug, 200, TXT());
}

function rewriteAny(txt, baseUrl, P, ref, origin) {
  txt = String(txt);
  if (!txt.includes('#EXTM3U')) throw new Error('risposta non-HLS');
  return /#EXT-X-STREAM-INF/.test(txt) ? rewriteMaster(txt, baseUrl, P, ref, origin) : rewriteMediaPl(txt, baseUrl, P, ref, origin);
}

function parseMediaPl(txt) {
  let upSeq = 0, upTarget = 4, map = null, isMaster = false;
  const segs = [];
  let pending = null, disc = false, brange = null;
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF')) { isMaster = true; break; }
    if (line.startsWith('#EXTM3U')) continue;
    if (line.startsWith('#EXT-X-TARGETDURATION:')) { upTarget = parseInt(line.split(':')[1]) || 4; continue; }
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) { upSeq = parseInt(line.split(':')[1]) || 0; continue; }
    if (line.startsWith('#EXT-X-MAP')) { map = line; continue; }
    if (line.startsWith('#EXT-X-DISCONTINUITY')) { disc = true; continue; }
    if (line.startsWith('#EXT-X-BYTERANGE')) { brange = line; continue; }
    if (line.startsWith('#EXTINF')) {
      pending = { extinf: line, dur: parseFloat((line.match(/#EXTINF:([\d.]+)/) || [])[1]) || 0, disc, brange };
      disc = false; brange = null;
      continue;
    }
    if (line.startsWith('#')) continue;
    if (pending) { pending.url = line; segs.push(pending); pending = null; }
  }
  return { upSeq, upTarget, map, segs, isMaster };
}

function absSegUrl(url, baseUrl) {
  if (/^https?:\/\//i.test(url)) return url;
  let abs;
  if (url.startsWith('/')) abs = new URL(baseUrl).origin + url;
  else abs = baseUrl.replace(/[^/]*$/, '') + url.replace(/^\.\//, '');
  return abs.replace(/([^:])\/{2,}/g, '$1/');
}

function proxUrl(abs, P, ref, origin) {
  const isNtv = abs.includes('tvnow247') || abs.includes('cfbu247');
  let urlToEncode = isNtv ? abs : abs + (abs.includes('?') ? '&' : '?') + '_t=' + Math.floor(Date.now() / 60000) * 60000;
  let u = P + '/seg?u=' + encodeURIComponent(urlToEncode);
  if (ref) u += '&ref=' + encodeURIComponent(ref);
  if (origin) u += '&o=' + encodeURIComponent(origin);
  return u;
}

function rewriteMaster(txt, baseUrl, P, ref, origin) {
  const out = [];
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) { out.push(line); continue; }
    let u = P + '/seg?u=' + encodeURIComponent(absSegUrl(line, baseUrl));
    if (ref) u += '&ref=' + encodeURIComponent(ref);
    if (origin) u += '&o=' + encodeURIComponent(origin);
    out.push(u);
  }
  return out.join('\n');
}

// 🔥 FIX: 10 segmenti + DISCONTINUITY iniziale per forzare keyframe
function rewriteMediaPl(txt, baseUrl, P, ref, origin) {
  const p = parseMediaPl(txt);
  if (p.isMaster || !p.segs.length) return rewriteMaster(txt, baseUrl, P, ref, origin);
  
  // Servire 10 segmenti invece di 6 per garantire un keyframe
  const kept = p.segs.slice(-10);
  const dropped = p.segs.length - kept.length;
  
  const out = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:' + p.upTarget,
    '#EXT-X-MEDIA-SEQUENCE:' + (p.upSeq + dropped),
    '#EXT-X-DISCONTINUITY-SEQUENCE:0'
  ];
  
  if (p.map) {
    const mu = (p.map.match(/URI="([^"]+)"/) || [])[1];
    if (mu) out.push('#EXT-X-MAP:URI="' + proxUrl(absSegUrl(mu, baseUrl), P, ref, origin) + '"');
  }
  
  // Aggiungere DISCONTINUITY all'inizio per forzare il reset del decoder
  out.push('#EXT-X-DISCONTINUITY');
  
  kept.forEach((s, idx) => {
    out.push(s.extinf);
    if (s.brange) out.push(s.brange);
    out.push(proxUrl(absSegUrl(s.url, baseUrl), P, ref, origin));
  });
  
  return out.join('\n');
}

async function seg(u) {
  const target = u.searchParams.get('u'); if (!target) return R('uso: /seg?u=<url>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://tvnow247.today/';
  const o = u.searchParams.get('o');
  
  const isNtv = target.includes('tvnow247') || target.includes('cfbu247');
  const headers = isNtv ? {
    'User-Agent': UA,
    'Referer': 'https://tvnow247.today/',
    'Origin': 'https://tvnow247.today',
    'Accept': '*/*'
  } : {
    'User-Agent': UA,
    'Referer': ref,
    'Origin': ref.replace(/\/$/, ''),
    'Accept': '*/*'
  };

  const r = await fetchT(target, { headers, cf: { cacheTtl: isNtv ? 0 : 60, cacheEverything: !isNtv } }, 15000);
  if (!r.ok) return R('upstream ' + r.status, r.status, TXT());

  if (/\.m3u8(\?|$)/i.test(target)) {
    const txt = await r.text();
    const baseDir = target.substring(0, target.lastIndexOf('/') + 1) || target;
    const out = rewriteAny(txt, baseDir, u.origin, ref, o || '');
    return R(out, 200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-cache', ...CORS() });
  }

  const hh = {
    'content-type': r.headers.get('content-type') || 'video/mp2t',
    'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'Range, User-Agent, Referer, Origin',
    'cache-control': isNtv ? 'no-cache' : 'public, max-age=60'
  };
  const cl = r.headers.get('content-length'); if (cl) hh['content-length'] = cl;
  return new Response(r.body, { status: r.status, headers: hh });
}

async function diag(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-24';
  const c = findCh(q);
  if (!c) return 'Canale non trovato: ' + q;
  const L = ['=== DIAGNOSTICA (' + CONFIG.VERSION + ') ===', 'Canale: ' + c.name + ' (slug: ' + c.slug + ')', ''];
  L.push('Vavoo ID6: ' + (c.vid6 || 'none') + ' | ID7: ' + (c.vid7 || 'none'));
  L.push('NTV ID: ' + (c.ntv || 'none'));
  L.push('Daddy ID: ' + (c.daddy || 'none'));
  L.push('');
  const tryP = async (label, fn) => {
    const t0 = Date.now();
    try {
      const txt = await fn();
      L.push('— ' + label + ' (' + (Date.now() - t0) + 'ms) —');
      L.push('OK | ' + (txt.includes('#EXT-X-STREAM-INF') ? 'MASTER' : 'MEDIA') + ' playlist');
    } catch (e) { L.push('— ' + label + ' (' + (Date.now() - t0) + 'ms) —\nERRORE: ' + (e && e.message)); }
    L.push('');
  };
  if (c.vavoo || c.vid6 || c.vid7) await tryP('VAVOO', async () => {
    const vu = await vavooResolveDual(c.slug, c.vid6, c.vid7);
    if (!vu) throw new Error('non risolto');
    const r = await fetchStream(vu, 'https://geil.to/');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  });
  if (c.ntv) await tryP('NTV', async () => (await ntvPlaylist(c.ntv)).txt);
  if (c.daddy) await tryP('DADDY', async () => {
    const du = await daddyResolve(c.daddy);
    if (!du) throw new Error('non risolto');
    const r = await fetchStream(du, 'https://thedaddy.li/');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  });
  return L.join('\n');
}

async function probe(u) {
  const q = u.searchParams.get('ch') || ''; const c = findCh(q);
  if (!c) return 'canale non mappato: "' + q + '"\n\n' + elencoCanali(u);
  const L = ['PROBE ' + c.name];
  try { const t0 = Date.now(); const vu = (c.vid6 || c.vid7) ? await vavooResolveDual(c.slug, c.vid6, c.vid7) : null; L.push('1) VAVOO: ' + (vu ? 'OK (' + (Date.now() - t0) + 'ms)' : 'skip')); } catch (e) { L.push('1) VAVOO: ERR ' + e.message); }
  try { if (!c.ntv) L.push('2) NTV: skip'); else { const t0 = Date.now(); const pl = await ntvPlaylist(c.ntv); L.push('2) NTV: OK ' + (pl.txt.match(/#EXTINF/g) || []).length + ' segs (' + (Date.now() - t0) + 'ms)'); } } catch (e) { L.push('2) NTV: ERR ' + e.message); }
  try { const t0 = Date.now(); const du = c.daddy ? await daddyResolve(c.daddy) : null; L.push('3) DADDY: ' + (du ? 'OK (' + (Date.now() - t0) + 'ms)' : 'skip')); } catch (e) { L.push('3) DADDY: ERR ' + e.message); }
  return L.join('\n');
}

function debug() {
  const L = [CONFIG.VERSION, ''];
  L.push('📋 SISTEMA');
  L.push('─────────────────────────────────────────────────────────');
  L.push('Canali DB:       ' + CHANNELS.length);
  L.push('');
  L.push('✨ FUNZIONALITÀ');
  L.push('─────────────────────────────────────────────────────────');
  CONFIG.FEATURES.forEach((f, i) => { L.push('  ' + String(i + 1).padStart(2) + '. ' + f); });
  L.push('');
  L.push('🌐 ENDPOINT');
  L.push('─────────────────────────────────────────────────────────');
  L.push('  /live?ch=canale              Stream');
  L.push('  /seg?u=...                   Proxy segmento');
  L.push('  /diag?ch=canale              Diagnostica');
  L.push('  /probe?ch=canale             Test rapido');
  L.push('  /ch?q=ricerca                Lista canali');
  L.push('  /debug                       Questa pagina');
  return L.join('\n');
}

function uso(P) { return [CONFIG.VERSION, '', 'uso:', '  /live?ch=<slug>            Stream', '  /diag?ch=canale              Diagnostica', '  /probe?ch=canale             Test rapido', '  /ch?q=ricerca                Lista canali', '  /debug                       Info sistema', ''].join('\n'); }
function TXT() { return { 'content-type': 'text/plain; charset=utf-8', ...CORS() }; }
function CORS() { return { 'access-control-allow-origin': '*' }; }
function R(body, status, headers) { const h = Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, headers || {}); if (status === 302) delete h['content-type']; return new Response(body, { status: status || 200, headers: h }); }

async function fetchT(url, opt, ms) {
  const o = Object.assign({}, opt || {});
  if (ms && typeof AbortController !== 'undefined') {
    const ac = new AbortController();
    const t = setTimeout(() => { try { ac.abort(); } catch (e) {} }, ms);
    o.signal = ac.signal;
    try { return await fetch(url, o); } finally { clearTimeout(t); }
  }
  return fetch(url, o);
}

export default {
  async fetch(req) {
    const u = new URL(req.url);
    const P = u.origin;
    const path = u.pathname;
    if (req.method === 'HEAD' || req.method === 'OPTIONS')
      return R('OK', 200, { 'content-type': 'text/plain; charset=utf-8', ...CORS() });
    try {
      if (path === '/live') return await live(u, P, null);
      if (path === '/ntv') return await live(u, P, 'ntv');
      if (path === '/vavoo') return await live(u, P, 'vavoo');
      if (path === '/daddy') return await live(u, P, 'daddy');
      if (path === '/seg') return await seg(u);
      if (path === '/diag') return R(await diag(u), 200, TXT());
      if (path === '/probe') return R(await probe(u), 200, TXT());
      if (path === '/debug') return R(debug(), 200, TXT());
      if (path === '/ch') return R(elencoCanali(u), 200, TXT());
      if (path === '/') return R(uso(P), 200, TXT());
      return R('404: endpoint non trovato\n\n' + uso(P), 200, TXT());
    } catch (e) {
      return R('ERRORE: ' + (e && e.message ? e.message : String(e)), 200, TXT());
    }
  }
};
// ███ FINE TVNOW-CF v1.6 ███
