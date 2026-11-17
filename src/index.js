// ============================================================================
// TVNOW-CF v3.5 — VAVOO + NTV + DADDYLIVE (ANTI-BLOCK POTENZIATO)
// 
// FIX CRITICI:
// - Sky Calcio 251/252/253 e Sky Cinema/Crime/Serie spostati esclusivamente su DaddyLive.
// - Anti-Block Potenziato: Header "Sec-Fetch-*" e "Accept-Language" per sembrare un browser Chrome reale.
// - Playlist troncata agli ultimi 4 segmenti => delay minimo (~25-35s).
// - Cache segmenti a 0 + timestamp unico => bypass totale cache Cloudflare.
// - Buffer player consigliato: 3000ms.
// ============================================================================

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
      if (path === '/warm') return await warm();
      if (path === '/rawu') return await rawu(u);
      if (path === '/vmap') return R(await vmap(), 200, TXT());
      if (path === '/ch') return R(elencoCanali(), 200, TXT());
      if (path === '/probe') return R(await probe(u), 200, TXT());
      if (path === '/debug') return R(debug(), 200, TXT());
      if (path === '/ip') {
        const ip = req.headers.get('cf-connecting-ip') || '';
        const r = await fetchT('https://www.cloudflare.com/cdn-cgi/trace', {}, 8000);
        const t = r.ok ? await r.text() : 'trace err ' + r.status;
        return R('worker ip client: ' + ip + '\negress:\n' + t, 200, TXT());
      }
      if (path === '/') return R(uso(P), 200, TXT());
      return R('404: endpoint non trovato\n\n' + uso(P), 200, TXT());
    } catch (e) {
      return R('ERRORE: ' + (e && e.message ? e.message : String(e)), 200, TXT());
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(warm()); }
};

// ============================= CANALI ======================================
const CHANNELS = [
  { slug: 'rsi-la-1',            name: 'RSI La 1',          ntv: '',    vavoo: 'rsi la 1',        daddy: '' },
  { slug: 'rsi-la-2',            name: 'RSI La 2',          ntv: '',    vavoo: 'rsi la 2',        daddy: '' },
  { slug: 'sky-sport-serie-a',   name: 'Sky Sport Serie A', ntv: '',    vavoo: 'sky sport serie a', daddy: '880' },
  { slug: 'sky-sport-24',        name: 'Sky Sport 24',      ntv: '869', vavoo: 'sky sport 24',      daddy: '869' },
  { slug: 'sky-sport-uno',       name: 'Sky Sport Uno',     ntv: '461', vavoo: 'sky sport uno',     daddy: '461' },
  { slug: 'sky-sport-calcio',    name: 'Sky Sport Calcio',  ntv: '870', vavoo: 'sky sport calcio',  daddy: '870' },
  { slug: 'sky-sport-tennis',    name: 'Sky Sport Tennis',  ntv: '576', vavoo: 'sky sport tennis',  daddy: '576', vid: '2100771782' },
  { slug: 'sky-sport-arena',     name: 'Sky Sport Arena',   ntv: '462', vavoo: 'sky sport arena',   daddy: '462' },
  { slug: 'sky-sport-basket',    name: 'Sky Sport Basket',  ntv: '875', vavoo: 'sky sport basket',  daddy: '875' },
  { slug: 'sky-sport-max',       name: 'Sky Sport Max',     ntv: '460', vavoo: 'sky sport max',     daddy: '460' },
  { slug: 'sky-sport-f1',        name: 'Sky Sport F1',      ntv: '577', vavoo: 'sky sport f1',      daddy: '577' },
  { slug: 'sky-sport-motogp',    name: 'Sky Sport MotoGP',  ntv: '575', vavoo: 'sky sport motogp',  daddy: '575' },
  { slug: 'sky-sport-golf',      name: 'Sky Sport Golf',    ntv: '574', vavoo: 'sky sport golf',    daddy: '574' },
  { slug: 'dazn-1',              name: 'DAZN 1',            ntv: '877', vavoo: 'dazn 1',            daddy: '877', vid: '2745635299' },
  { slug: 'eurosport-1',         name: 'Eurosport 1',       ntv: '878', vavoo: 'eurosport 1',       daddy: '878', vid: '3448075317' },
  { slug: 'eurosport-2',         name: 'Eurosport 2',       ntv: '879', vavoo: 'eurosport 2',       daddy: '879', vid: '2317684453' },
  
  // 🔥 CANALI ESCLUSIVAMENTE SU DADDYLIVE (ntv: '')
  { slug: 'sky-calcio-251',      name: 'Sky Calcio 251',    ntv: '', vavoo: '', daddy: '871' },
  { slug: 'sky-calcio-252',      name: 'Sky Calcio 252',    ntv: '', vavoo: '', daddy: '872' },
  { slug: 'sky-calcio-253',      name: 'Sky Calcio 253',    ntv: '', vavoo: '', daddy: '873' },
  { slug: 'sky-cinema-uno',      name: 'Sky Cinema Uno',    ntv: '', vavoo: '', daddy: '860' },
  { slug: 'sky-cinema-action',   name: 'Sky Cinema Action', ntv: '', vavoo: '', daddy: '861' },
  { slug: 'sky-cinema-comedy',   name: 'Sky Cinema Comedy', ntv: '', vavoo: '', daddy: '862' },
  { slug: 'sky-cinema-collection',name:'Sky Cinema Collection',ntv:'',vavoo:'', daddy: '859' },
  { slug: 'sky-cinema-romance',  name: 'Sky Cinema Romance',ntv: '', vavoo: '', daddy: '864' },
  { slug: 'sky-cinema-family',   name: 'Sky Cinema Family', ntv: '', vavoo: '', daddy: '865' },
  { slug: 'sky-cinema-drama',    name: 'Sky Cinema Drama',  ntv: '', vavoo: '', daddy: '867' },
  { slug: 'sky-cinema-suspense', name: 'Sky Cinema Suspense',ntv:'', vavoo: '', daddy: '868' },
  { slug: 'sky-cinema-uno-24',   name: 'Sky Cinema Uno +24', ntv: '', vavoo: '', daddy: '863' },
  { slug: 'sky-cinema-due-24',   name: 'Sky Cinema Due +24', ntv: '', vavoo: '', daddy: '866' },
  { slug: 'sky-crime',           name: 'Sky Crime',         ntv: '', vavoo: '', daddy: '863' },
  { slug: 'sky-serie',           name: 'Sky Serie',         ntv: '', vavoo: '', daddy: '880' },
  
  { slug: 'italia-1',            name: 'Italia 1',          ntv: '854', vavoo: 'italia 1', daddy: '854' },
  { slug: 'la7',                 name: 'La7',               ntv: '855', vavoo: 'la7', daddy: '855', vid: '775530063' },
  { slug: 'la7d',                name: 'LA7d',              ntv: '856', vavoo: 'la7d', daddy: '856' },
  { slug: 'rai-premium',         name: 'Rai Premium',       ntv: '858', vavoo: '', daddy: '858', vid: '2828455552' },
  { slug: 'rai-sport',           name: 'Rai Sport',         ntv: '882', vavoo: 'rai sport', daddy: '882', vid: '551730224' }
];

const ALIASES = {
  'dazn': 'dazn-1', 'dazn-zona': 'dazn-1', 'zona-dazn': 'dazn-1',
  'sky-sport-serie-a': 'sky-sport-serie-a', 'serie-a': 'sky-sport-serie-a',
  'sky-calcio-1': 'sky-calcio-251', 'sky-calcio-2': 'sky-calcio-252', 'sky-calcio-3': 'sky-calcio-253',
  'sky-cinema-2-24': 'sky-cinema-due-24', 'sky-cinema-unopi24': 'sky-cinema-uno-24',
  'sky-sport-24-ntv': 'sky-sport-24', 'sky-sport-uno-italy': 'sky-sport-uno'
};

const BY_KEY = (() => {
  const m = new Map();
  for (const c of CHANNELS) {
    m.set(c.slug, c); m.set(norm(c.name), c);
    if (c.ntv) m.set(c.ntv, c); if (c.daddy) m.set('d' + c.daddy, c);
  }
  for (const [a, s] of Object.entries(ALIASES)) { const c = m.get(s); if (c) m.set(a, c); }
  return m;
})();

function norm(s) { return String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function findCh(q) { let k=norm(q); if (BY_KEY.has(k)) return BY_KEY.get(k); k=k.replace(/-ntv$/,'').replace(/-daddy$/,''); return BY_KEY.get(k)||null; }
function elencoCanali() {
  const L = ['CANALI (' + CHANNELS.length + ') — /live?ch=<slug o id>'];
  for (const c of CHANNELS) L.push('  ' + c.slug.padEnd(22) + ' ntv=' + String(c.ntv).padEnd(4) + ' vavoo=' + (c.vavoo||'-').padEnd(18) + ' daddy=' + (c.daddy||'-').padEnd(4) + (c.vid ? ' vid=' + c.vid : ''));
  return L.join('\n');
}

// ============================= NTV (URL DIRETTI) ==========================
const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';
const tokenCache = new Map();
let ntvStats = { resolve: 0, refresh: 0, err: 0 };

async function ntvToken(id) {
  const now = Date.now()/1000; const c = tokenCache.get(id);
  if (c && c.exp - now > 14400) return c;
  ntvStats.resolve++;
  const r = await fetchT(NTV_API + id, { headers: getBrowserHeaders('https://tvnow247.today/') }, 8000);
  if (!r.ok) { ntvStats.err++; throw new Error('ntv api ' + r.status); }
  const j = await r.json().catch(() => null);
  const m3u8 = j && (j.m3u8 || j.proxyPlaylistUrl || j.proxyPlayerUrl);
  if (!m3u8) { ntvStats.err++; throw new Error('ntv api senza m3u8'); }
  const exp = +(String(m3u8).match(/[?&]e=(\d+)/) || [])[1] || (now + 86400);
  const entry = { m3u8, exp, ref: (j && j.referer) || 'https://tvnow247.today/' };
  tokenCache.set(id, entry); return entry;
}

async function ntvPlaylist(id) {
  let tk = await ntvToken(id);
  let r = await fetchT(tk.m3u8, { headers: getBrowserHeaders(tk.ref) }, 8000);
  if (r.status === 403 || r.status === 401) { tokenCache.delete(id); ntvStats.refresh++; tk = await ntvToken(id); r = await fetchT(tk.m3u8, { headers: getBrowserHeaders(tk.ref) }, 8000); }
  if (!r.ok) throw new Error('ntv playlist ' + r.status);
  const txt = await r.text();
  if (!txt.includes('#EXTM3U')) throw new Error('ntv playlist non-HLS');
  return { txt, ref: tk.ref, base: tk.m3u8 };
}

// ============================= DADDYLIVE (ANTI-BLOCK) ======================
const DADDY_DOMAINS = ['https://thedaddy.li', 'https://daddylivetv.sbs'];
const daddyCache = new Map(); const DADDY_TTL = 5*60*1000;

async function daddyResolve(id) {
  if (!id) return null;
  const now = Date.now(); const cached = daddyCache.get(id);
  if (cached && cached.exp > now) return cached.url;
  for (const domain of DADDY_DOMAINS) {
    try {
      let m3u8 = await extractM3u8FromEmbed(`${domain}/embed/stream-${id}.php`, domain, 5000);
      if (m3u8) { daddyCache.set(id, { url: m3u8, exp: now + DADDY_TTL }); return m3u8; }
      m3u8 = await extractM3u8FromEmbed(`${domain}/watch.php?id=${id}`, domain, 5000);
      if (m3u8) { daddyCache.set(id, { url: m3u8, exp: now + DADDY_TTL }); return m3u8; }
    } catch (e) { continue; }
  }
  return null;
}

async function extractM3u8FromEmbed(url, refererDomain, timeoutMs) {
  // 🔥 Anti-Block: Header completi da browser reale
  const r = await fetchT(url, { headers: getBrowserHeaders(refererDomain + '/'), cf: { cacheTtl: 300, cacheEverything: true } }, timeoutMs);
  if (!r.ok) return null;
  const html = await r.text();
  let m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if (m3u8) return m3u8[1];
  const iframe = html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
  if (iframe) {
    const r2 = await fetchT(iframe[1], { headers: getBrowserHeaders(url), cf: { cacheTtl: 300, cacheEverything: true } }, timeoutMs);
    if (r2.ok) {
      const html2 = await r2.text();
      m3u8 = html2.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
      if (m3u8) return m3u8[1];
      const iframe2 = html2.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
      if (iframe2) {
        const r3 = await fetchT(iframe2[1], { headers: getBrowserHeaders(iframe[1]), cf: { cacheTtl: 300, cacheEverything: true } }, timeoutMs);
        if (r3.ok) { const html3 = await r3.text(); m3u8 = html3.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i); if (m3u8) return m3u8[1]; }
      }
    }
  }
  return null;
}

// 🔥 FUNZIONE ANTI-BLOCK POTENZIATA
function getBrowserHeaders(referer) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer,
    'Origin': referer.replace(/\/$/, ''),
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };
}

// ============================= VAVOO =======================================
const VAVOO_MIRRORS = ['https://geil.to','https://geil.app','https://geil.win','https://vavoo.to','https://kool.to','https://vavoo.net','https://kool.ws','https://huhu.to','https://oha.to','https://voltop.net'];
const VAVOO_SOURCES = ['https://raw.githubusercontent.com/aphrodite747/VvOo/main/index_Italy.m3u','https://raw.githubusercontent.com/BontAce/VVOOITV/main/index_Italy.m3u'];
let vavooMap = { map: null, t: 0, src: '' };
const VAVOO_MAP_TTL = 6*3600*1000;
function vavooMapGet() { return (vavooMap.map && Date.now() - vavooMap.t < VAVOO_MAP_TTL) ? vavooMap.map : null; }

async function ensureVavooMap(force) {
  const cached = vavooMapGet(); if (cached && !force) return cached;
  for (const src of VAVOO_SOURCES) {
    try {
      const r = await fetchT(src, { headers: { 'User-Agent': 'VAVOO/1.0' } }, 10000); if (!r.ok) continue;
      const t = await r.text(); const m = new Map();
      for (const b of t.split('#EXTINF')) {
        const nm = (b.match(/tvg-name="([^"]+)"/) || [])[1];
        const id = (b.match(/vavoo\/(\d+)\.m3u8/) || [])[1];
        if (nm && id) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/,'')); if (k && !m.has(k)) m.set(k, id); }
      }
      if (m.size > 50) { vavooMap = { map: m, t: Date.now(), src }; return m; }
    } catch (e) {}
  }
  return cached;
}

function vavooMapFind(query, m) {
  if (!m || !query) return null;
  const q = norm(query); if (m.has(q)) return m.get(q);
  const qTok = q.split('-').filter(Boolean);
  let best = null, bestScore = -1;
  for (const [k, id] of m) {
    const kTok = k.split('-').filter(Boolean);
    if (qTok.every(w => kTok.includes(w))) {
      const score = qTok.length - (kTok.length - qTok.length);
      if (score > bestScore) { bestScore = score; best = id; }
    }
  }
  return best;
}

function vavooHeaders(extra) { return Object.assign({ 'User-Agent': 'MediaHubMX/2', 'Accept': 'application/json', 'Origin': 'https://vavoo.to', 'Referer': 'https://vavoo.to/' }, extra || {}); }
async function vavooResolveId(base, id) {
  const play = base + '/live/play/' + id;
  try { const r = await fetchT(base + '/live/resolve?url=' + encodeURIComponent(play), { headers: getBrowserHeaders(base + '/') }, 5000); if (r.ok) { const j = await r.json().catch(()=>null); if (j && j.url) return j.url; } } catch (e) {}
  try { const r = await fetchT(base + '/mediahubmx-resolve.json', { method: 'POST', headers: vavooHeaders({ 'Content-Type': 'application/json', 'Origin': base, 'Referer': base + '/' }), body: JSON.stringify({ language: 'de', region: 'DE', url: play, clientVersion: '3.0.2' }) }, 5000); if (r.ok) { const j = await r.json().catch(()=>null); if (j && j.url) return j.url; } } catch (e) {}
  return null;
}

async function vavooLiveFind(base, query) {
  try {
    const rl = await fetchT(base + '/mediahubmx-list.json', { method: 'POST', headers: vavooHeaders({ 'Content-Type': 'application/json', 'Origin': base, 'Referer': base + '/' }), body: JSON.stringify({ language: 'it', region: 'IT', clientVersion: '3.0.2', url: base + '/live' }) }, 5000);
    if (!rl.ok) return null;
    const j = await rl.json().catch(()=>null);
    const items = j && (j.items || j.channels || j.entries) || [];
    const tmp = new Map();
    for (const it of items) {
      const nm = it.name || it.title || '';
      const iid = it.id || ((it.url || '').match(/play\/(\d+)/) || [])[1];
      if (nm && iid) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/,'')); if (k && !tmp.has(k)) tmp.set(k, String(iid)); }
    }
    return vavooMapFind(query, tmp);
  } catch (e) { return null; }
}

async function vavooResolve(query, vid) {
  let id = vid || null;
  if (!id) { const m = await ensureVavooMap(); id = vavooMapFind(query, m); }
  if (id) { for (const base of VAVOO_MIRRORS) { const u = await vavooResolveId(base, id); if (u) return u; } return null; }
  for (const base of VAVOO_MIRRORS.slice(0, 4)) {
    const id2 = await vavooLiveFind(base, query);
    if (id2) { for (const b2 of VAVOO_MIRRORS) { const u = await vavooResolveId(b2, id2); if (u) return u; } }
  }
  return null;
}

// ============================= /live (ULTRA-LOW-LATENCY) ===================
let lastPl = { key: '', txt: '', t: 0 };
async function live(u, P, legacy) {
  const q = u.searchParams.get('ch') || u.searchParams.get('c') || '';
  if (!q) return R('uso: /live?ch=<slug|id>\n\n' + elencoCanali(), 200, TXT());
  const c = findCh(q);
  if (!c) return R('canale non mappato: "' + q + '"\n\n' + elencoCanali(), 200, TXT());
  const order = legacy ? [legacy, ...['vavoo','ntv','daddy'].filter(x => x !== legacy)]
    : (u.searchParams.get('p') || 'vavoo,ntv,daddy').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const ck = c.slug + ':' + order.join('.');
  if (lastPl.key === ck && Date.now() - lastPl.t < 3000) return R(lastPl.txt, 200, HLS());
  const provs = {
    vavoo: async () => {
      if (!c.vavoo && !c.vid) return null;
      const vu = await vavooResolve(c.vavoo, c.vid);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/.test(vu)) {
        const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent': 'VAVOO/1.0' }) }, 8000);
        if (r.ok) { 
          const out = rewritePlLowLatency(await r.text(), vu, P, 'https://vavoo.to/', 'https://vavoo.to'); 
          lastPl = { key: ck, txt: out, t: Date.now() }; 
          return R(out, 200, HLS()); 
        }
      }
      return R('redirect vavoo', 302, { Location: vu, ...CORS() });
    },
    ntv: async () => {
      if (!c.ntv) return null;
      const pl = await ntvPlaylist(c.ntv);
      const out = truncatePlaylist(pl.txt, 4);
      lastPl = { key: ck, txt: out, t: Date.now() }; 
      return R(out, 200, HLS());
    },
    daddy: async () => {
      if (!c.daddy) return null;
      const du = await daddyResolve(c.daddy);
      if (!du || !/\.m3u8/i.test(du)) return null;
      const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 8000);
      if (!r.ok) return null;
      const baseUrl = du.substring(0, du.lastIndexOf('/') + 1);
      const txt = await r.text();
      const out = ['#EXTVLCOPT:http-referrer=https://thedaddy.li/', '#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'];
      for (const line of txt.split(/\r?\n/)) { const t = line.trim(); if (!t) continue; if (t.startsWith('#')) { out.push(t); continue; } out.push(t.startsWith('http') ? t : baseUrl + (t.startsWith('/') ? t.substring(1) : t)); }
      const finalTxt = out.join('\n'); lastPl = { key: ck, txt: finalTxt, t: Date.now() }; return R(finalTxt, 200, HLS());
    }
  };
  for (const p of order) { const fn = provs[p]; if (!fn) continue; try { const res = await fn(); if (res) return res; } catch (e) { log(p + ' ko ' + c.slug + ': ' + (e && e.message)); } }
  return R('ERRORE: provider KO (' + order.join(' -> ') + ') per ' + c.name + '. /probe?ch=' + c.slug, 200, TXT());
}

function truncatePlaylist(txt, lastN) {
  const lines = txt.split(/\r?\n/);
  const segments = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('#EXTINF')) {
      const extinf = lines[i];
      const url = lines[i+1];
      if (url && !url.startsWith('#')) {
        segments.push({ extinf, url });
        i += 2;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  const lastSegments = segments.slice(-lastN);
  const out = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:4', '#EXT-X-MEDIA-SEQUENCE:0', '#EXT-X-PLAYLIST-TYPE:EVENT'];
  for (const seg of lastSegments) {
    out.push(seg.extinf);
    out.push(seg.url);
  }
  return out.join('\n');
}

function rewritePlLowLatency(txt, baseUrl, P, ref, origin) {
  const out = [];
  const ts = Date.now();
  for (const line of String(txt).split(/\r?\n/)) {
    const t = line.trim(); if (!t) { out.push(''); continue; } if (t[0] === '#') { out.push(t); continue; }
    let abs = t;
    if (!/^https?:\/\//i.test(t)) { if (t.startsWith('/')) { const o = new URL(baseUrl); abs = o.origin + t; } else abs = baseUrl.replace(/[^/]*$/,'') + t.replace(/^\.\//,''); abs = abs.replace(/([^:])\/{2,}/g,'$1/'); }
    const sep = abs.includes('?') ? '&' : '?';
    abs = abs + sep + '_t=' + ts;
    let seg = P + '/seg?u=' + encodeURIComponent(abs); if (ref) seg += '&ref=' + encodeURIComponent(ref); if (origin) seg += '&o=' + encodeURIComponent(origin);
    out.push(seg);
  }
  return out.join('\n');
}

// ============================= /seg (NO CACHE + ANTI-BLOCK) ================
async function seg(u) {
  const target = u.searchParams.get('u'); if (!target) return R('uso: /seg?u=<url>', 200, TXT());
  const h = getBrowserHeaders(u.searchParams.get('ref') || 'https://thedaddy.li/');
  if (u.searchParams.get('o')) h['Origin'] = u.searchParams.get('o');
  if (u.searchParams.get('range')) h['Range'] = u.searchParams.get('range');
  
  const r = await fetchT(target, { headers: h, cf: { cacheTtl: 0 } }, 15000);
  const hh = {
    'content-type': r.headers.get('content-type') || 'video/mp2t',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'Range, User-Agent, Referer, Origin',
    'cache-control': 'no-cache, no-store, must-revalidate',
    'pragma': 'no-cache',
    'expires': '0'
  };
  const cl = r.headers.get('content-length'); const cr = r.headers.get('content-range'); if (cl) hh['content-length'] = cl; if (cr) hh['content-range'] = cr;
  return new Response(r.body, { status: r.status, headers: hh });
}

// ============================= WARM (CRON OGNI 5 MIN) ======================
async function warm() {
  const t0 = Date.now();
  const ids = ['869','461','870','576','462','875','460','577','575','574','877','878','879','871','872','873','860','861','862','859','864','865','867','868','863','866','880','854','855','856','858','882'];
  let ok = 0, err = 0;
  await Promise.all(ids.map(async id => { try { await ntvToken(id); ok++; } catch (e) { err++; } }));
  try { await ensureVavooMap(); } catch (e) {}
  const msg = 'WARM ok=' + ok + ' err=' + err + ' (' + (Date.now()-t0) + 'ms) ntv_cache=' + tokenCache.size;
  log(msg); return R(msg, 200, TXT());
}

// ============================= /probe ======================================
async function probe(u) {
  const q = u.searchParams.get('ch') || ''; const c = findCh(q);
  if (!c) return 'canale non mappato: "' + q + '"\n\n' + elencoCanali();
  const L = ['PROBE ' + c.name + ' (slug=' + c.slug + ' vavoo=' + (c.vavoo||'-') + ' ntv=' + (c.ntv||'-') + ' daddy=' + (c.daddy||'-') + ' vid=' + (c.vid||'-') + ')'];
  try { const t0 = Date.now(); const vu = (c.vavoo||c.vid) ? await vavooResolve(c.vavoo, c.vid) : null; L.push('1) VAVOO: ' + (vu ? 'OK ' + vu.slice(0,90) + '... (' + (Date.now()-t0) + 'ms)' : (c.vavoo||c.vid ? 'nessun risultato' : 'non mappato (salto)'))); } catch (e) { L.push('1) VAVOO: ERRORE ' + e.message); }
  try { if (!c.ntv) L.push('2) NTV: non mappato (salto)'); else { const t0 = Date.now(); const pl = await ntvPlaylist(c.ntv); const segs = (pl.txt.match(/#EXTINF/g)||[]).length; L.push('2) NTV: API OK | playlist 200 ' + segs + ' segs (' + (Date.now()-t0) + 'ms)'); } } catch (e) { L.push('2) NTV: ERRORE ' + e.message); }
  try { const t0 = Date.now(); const du = c.daddy ? await daddyResolve(c.daddy) : null; L.push('3) DADDYLIVE: ' + (du ? 'OK ' + du.slice(0,80) + '... (' + (Date.now()-t0) + 'ms)' : (c.daddy ? 'nessun risultato (id: '+c.daddy+')' : 'non mappato (salto)'))); } catch (e) { L.push('3) DADDYLIVE: ERRORE ' + e.message); }
  return L.join('\n');
}

async function vmap() {
  const m = await ensureVavooMap(true); if (!m) return 'VMAP: nessuna fonte raggiungibile';
  const L = ['VMAP statica: ' + m.size + ' canali (' + vavooMap.src + ')', '--- verifica tennis ---'];
  for (const c of CHANNELS) if (/tennis/.test(c.slug)) { const id = c.vid || vavooMapFind(c.vavoo, m); L.push((id?'OK  ':'--  ') + c.slug + ' -> ' + (id || 'non trovato') + (c.vid ? ' (PINNATO)' : '')); }
  return L.join('\n');
}

const VER = 'TVNOW-CF v3.5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const logs = [];
function log(m) { logs.push(new Date().toISOString().slice(11,19) + ' ' + m); if (logs.length > 40) logs.shift(); }
function debug() { const now = Date.now()/1000; const L = [VER, 'token cache NTV: ' + tokenCache.size, 'daddy cache: ' + daddyCache.size]; const vm = vavooMapGet(); L.push('mappa vavoo: ' + (vm ? vm.size + ' canali' : 'non caricata')); L.push('ultimi log:\n  ' + (logs.slice(-10).join('\n  ') || '(vuoti)')); return L.join('\n'); }
function uso(P) { return [VER,'','uso:','  /live?ch=<slug|id>   playlist','  /warm                (cron) tiene calda la cache','  /vmap                verifica mapping tennis','  legacy: /vavoo?ch=QUERY /ntv?ch=ID /daddy?ch=ID','  /probe?ch=<slug>     diagnostica','  /debug               stato',''].join('\n'); }
function TXT() { return { 'content-type': 'text/plain; charset=utf-8', ...CORS() }; }
function HLS() { return { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-store', ...CORS() }; }
function CORS() { return { 'access-control-allow-origin': '*' }; }
function R(body, status, headers) { const h = Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, headers || {}); if (status === 302) delete h['content-type']; return new Response(body, { status: status || 200, headers: h }); }
async function rawu(u) { const t = u.searchParams.get('u'); if (!t) return R('uso: /rawu?u=<url>&ref=&o=&len=', 200, TXT()); const h = getBrowserHeaders(u.searchParams.get('ref') || 'https://thedaddy.li/'); if (u.searchParams.get('o')) h['Origin'] = u.searchParams.get('o'); let r; try { r = await fetchT(t, { headers: h, redirect: 'follow' }, 20000); } catch (e) { return R('status ERR | ' + (e && e.message), 200, TXT()); } let body = ''; try { body = await r.text(); } catch (e) { body = '(no body)'; } return R('status ' + r.status + ' | len ' + body.length + ' | final ' + r.url + '\n' + body.slice(0, +(u.searchParams.get('len')||2000)||2000), 200, TXT()); }
async function fetchT(url, opt, ms) { const o = Object.assign({}, opt); if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) o.signal = AbortSignal.timeout(ms || 12000); return fetch(url, o); }
// ███ FINE TVNOW-CF v3.5 ███
