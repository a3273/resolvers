// ============================================================================
// TVNOW-CF v8.3 — SOLUZIONE COMPLETA:
// ✅ RSI La 2: ID corretto 3590183307
// ✅ FIX SCHERMO NERO: Rilevamento codec HEVC + filtro H.264 automatico
// ✅ NUOVI PARAMETRI: force_h264, variant, list_variants, safe
// ✅ NUOVO ENDPOINT: /analyze — diagnostica completa codec e varianti
// ✅ Miglioramenti fMP4, keyframe, anti-block e anti-death
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
      if (path === '/diag') return R(await diag(u), 200, TXT());
      if (path === '/analyze') return R(await analyze(u), 200, TXT()); // ✅ NUOVO
      if (path === '/debug') return R(debug(), 200, TXT());
      if (path === '/checkseg') return await checkseg(u);
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

// ==== DELAY OTTIMIZZATO v8.3 =====================================
const DELAY_TARGET  = 16;
const DELAY_MIN     = 12;
const PREF_SEGS     = 3;
const MIN_SEGS      = 2;
const EXTRA_KEYFRAME_SEG = 1;
const EXTRA_KEYFRAME_SEG_SAFE = 2; // ✅ Per modalità safe

// ==== ROTAZIONE USER-AGENT ANTI-BLOCK ============================
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
];
function getRandomUA() { return UA_POOL[Math.floor(Math.random() * UA_POOL.length)]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const CHANNELS = [
  { slug: 'rsi-la-1', name: 'RSI La 1', ntv: '', vavoo: 'rsi la 1', daddy: '', vid: '2455610203' },
  { slug: 'rsi-la-2', name: 'RSI La 2', ntv: '', vavoo: 'rsi la 2', daddy: '', vid: '3590183307' }, // ✅ ID CORRETTO
  { slug: 'sky-sport-serie-a', name: 'Sky Sport Serie A', ntv: '', vavoo: 'sky sport serie a', daddy: '880' },
  { slug: 'sky-sport-24', name: 'Sky Sport 24', ntv: '869', vavoo: 'sky sport 24', daddy: '869' },
  { slug: 'sky-sport-uno', name: 'Sky Sport Uno', ntv: '461', vavoo: 'sky sport uno', daddy: '461' },
  { slug: 'sky-sport-calcio', name: 'Sky Sport Calcio', ntv: '870', vavoo: 'sky sport calcio', daddy: '870' },
  { slug: 'sky-sport-tennis', name: 'Sky Sport Tennis', ntv: '576', vavoo: 'sky sport tennis', daddy: '576', vid: '2100771782' },
  { slug: 'sky-sport-arena', name: 'Sky Sport Arena', ntv: '462', vavoo: 'sky sport arena', daddy: '462' },
  { slug: 'sky-sport-basket', name: 'Sky Sport Basket', ntv: '875', vavoo: 'sky sport basket', daddy: '875' },
  { slug: 'sky-sport-max', name: 'Sky Sport Max', ntv: '460', vavoo: 'sky sport max', daddy: '460' },
  { slug: 'sky-sport-f1', name: 'Sky Sport F1', ntv: '577', vavoo: 'sky sport f1', daddy: '577' },
  { slug: 'sky-sport-motogp', name: 'Sky Sport MotoGP', ntv: '575', vavoo: 'sky sport motogp', daddy: '575' },
  { slug: 'sky-sport-golf', name: 'Sky Sport Golf', ntv: '574', vavoo: 'sky sport golf', daddy: '574' },
  { slug: 'dazn-1', name: 'DAZN 1', ntv: '877', vavoo: 'dazn 1', daddy: '877', vid: '2745635299' },
  { slug: 'eurosport-1', name: 'Eurosport 1', ntv: '878', vavoo: 'eurosport 1', daddy: '878', vid: '3448075317' },
  { slug: 'eurosport-2', name: 'Eurosport 2', ntv: '879', vavoo: 'eurosport 2', daddy: '879', vid: '2317684453' },
  { slug: 'sky-calcio-251', name: 'Sky Calcio 251', ntv: '871', vavoo: '', daddy: '871' },
  { slug: 'sky-calcio-252', name: 'Sky Calcio 252', ntv: '872', vavoo: '', daddy: '872' },
  { slug: 'sky-calcio-253', name: 'Sky Calcio 253', ntv: '873', vavoo: '', daddy: '873' },
  { slug: 'sky-cinema-uno', name: 'Sky Cinema Uno', ntv: '860', vavoo: '', daddy: '860' },
  { slug: 'sky-cinema-action', name: 'Sky Cinema Action', ntv: '861', vavoo: '', daddy: '861' },
  { slug: 'sky-cinema-comedy', name: 'Sky Cinema Comedy', ntv: '862', vavoo: '', daddy: '862' },
  { slug: 'sky-cinema-collection', name: 'Sky Cinema Collection', ntv: '859', vavoo: '', daddy: '859' },
  { slug: 'sky-cinema-romance', name: 'Sky Cinema Romance', ntv: '864', vavoo: '', daddy: '864' },
  { slug: 'sky-cinema-family', name: 'Sky Cinema Family', ntv: '865', vavoo: '', daddy: '865' },
  { slug: 'sky-cinema-drama', name: 'Sky Cinema Drama', ntv: '867', vavoo: '', daddy: '867' },
  { slug: 'sky-cinema-suspense', name: 'Sky Cinema Suspense', ntv: '868', vavoo: '', daddy: '868' },
  { slug: 'sky-crime', name: 'Sky Crime', ntv: '863', vavoo: '', daddy: '863' },
  { slug: 'sky-serie', name: 'Sky Serie', ntv: '880', vavoo: '', daddy: '880' }
];

const ALIASES = {
  'dazn': 'dazn-1', 'dazn-zona': 'dazn-1', 'zona-dazn': 'dazn-1',
  'serie-a': 'sky-sport-serie-a',
  'sky-calcio-1': 'sky-calcio-251', 'sky-calcio-2': 'sky-calcio-252', 'sky-calcio-3': 'sky-calcio-253',
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

function norm(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function findCh(q) { let k = norm(q); if (BY_KEY.has(k)) return BY_KEY.get(k); k = k.replace(/-ntv$/, '').replace(/-daddy$/, ''); return BY_KEY.get(k) || null; }
function elencoCanali() {
  const L = ['CANALI (' + CHANNELS.length + ') — /live?ch=<slug o id>'];
  for (const c of CHANNELS) L.push('  ' + c.slug.padEnd(24) + ' ntv=' + String(c.ntv).padEnd(4) + ' vavoo=' + (c.vavoo || '-').padEnd(18) + ' daddy=' + (c.daddy || '-').padEnd(4) + (c.vid ? ' vid=' + c.vid : ''));
  return L.join('\n');
}

// ============================================================================
// NTV
// ============================================================================
const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';
const tokenCache = new Map();
let ntvStats = { resolve: 0, refresh: 0, err: 0 };
const MAX_TOKEN_CACHE = 50;
const NTV_REFRESH_AHEAD = 120;

async function ntvToken(id) {
  const now = Date.now() / 1000; const c = tokenCache.get(id);
  if (c && c.exp - now > NTV_REFRESH_AHEAD) return c;
  if (tokenCache.size > MAX_TOKEN_CACHE) {
    const keys = Array.from(tokenCache.keys());
    for (let i = 0; i < keys.length - MAX_TOKEN_CACHE; i++) tokenCache.delete(keys[i]);
  }
  ntvStats.resolve++;
  try {
    const r = await fetchT(NTV_API + id, { headers: getBrowserHeaders('https://tvnow247.today/') }, 8000);
    if (!r.ok) { ntvStats.err++; throw new Error('ntv api ' + r.status); }
    const j = await r.json().catch(() => null);
    const m3u8 = j && (j.m3u8 || j.proxyPlaylistUrl || j.proxyPlayerUrl);
    if (!m3u8) { ntvStats.err++; throw new Error('ntv api senza m3u8'); }
    const exp = +(String(m3u8).match(/[?&]e=(\d+)/) || [])[1] || (now + 3600);
    const entry = { m3u8, exp, ref: (j && j.referer) || 'https://tvnow247.today/', lastOk: now };
    tokenCache.set(id, entry); return entry;
  } catch (e) {
    if (c && c.exp - now > 0) { ntvStats.err++; return c; }
    throw e;
  }
}

async function ntvPlaylist(id) {
  let tk = await ntvToken(id);
  let retry = 0, maxRetries = 3;
  while (retry < maxRetries) {
    try {
      const r = await fetchT(tk.m3u8, { headers: getBrowserHeaders(tk.ref) }, 8000);
      let txt = r.ok ? await r.text() : '';
      const bad = !r.ok || r.status >= 500 || !txt.includes('#EXTM3U');
      if (bad) {
        tokenCache.delete(id); ntvStats.refresh++;
        tk = await ntvToken(id);
        retry++; await sleep(500 * retry); continue;
      }
      return { txt, ref: tk.ref, base: tk.m3u8 };
    } catch (e) {
      tokenCache.delete(id); ntvStats.err++;
      tk = await ntvToken(id);
      retry++; await sleep(800 * retry);
    }
  }
  throw new Error('ntv playlist: troppi tentativi falliti');
}

// ============================================================================
// DADDYLIVE
// ============================================================================
const DADDY_DOMAINS = ['https://thedaddy.li', 'https://daddylivetv.sbs'];
const daddyCache = new Map();
const DADDY_TTL = 2 * 60 * 1000;
const DADDY_REFRESH_AHEAD = 60 * 1000;
const MAX_DADDY_CACHE = 100;

async function daddyResolve(id) {
  if (!id) return null;
  const now = Date.now(); const cached = daddyCache.get(id);
  if (cached && cached.exp - now > DADDY_REFRESH_AHEAD) return cached.url;
  if (daddyCache.size > MAX_DADDY_CACHE) {
    const keys = Array.from(daddyCache.keys());
    for (let i = 0; i < keys.length - MAX_DADDY_CACHE; i++) daddyCache.delete(keys[i]);
  }
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

function getBrowserHeaders(referer) {
  return {
    'User-Agent': getRandomUA(),
    'Accept': '*/*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer,
    'Origin': referer.replace(/\/$/, ''),
    'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'cross-site',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache', 'Pragma': 'no-cache'
  };
}

// ============================================================================
// VAVOO
// ============================================================================
const VAVOO_MIRRORS = ['https://geil.to','https://geil.app','https://geil.win','https://vavoo.to','https://kool.to','https://vavoo.net','https://kool.ws','https://huhu.to','https://oha.to','https://voltop.net'];
const VAVOO_SOURCES = ['https://raw.githubusercontent.com/aphrodite747/VvOo/main/index_Italy.m3u','https://raw.githubusercontent.com/BontAce/VVOOITV/main/index_Italy.m3u'];
let vavooMap = { map: null, t: 0, src: '' };
const VAVOO_MAP_TTL = 6 * 3600 * 1000;
function vavooMapGet() { return (vavooMap.map && Date.now() - vavooMap.t < VAVOO_MAP_TTL) ? vavooMap.map : null; }

async function ensureVavooMap(force) {
  const cached = vavooMapGet(); if (cached && !force) return cached;
  for (const src of VAVOO_SOURCES) {
    try {
      const r = await fetchT(src, { headers: { 'User-Agent': getRandomUA() } }, 10000); if (!r.ok) continue;
      const t = await r.text(); const m = new Map();
      for (const b of t.split('#EXTINF')) {
        const nm = (b.match(/tvg-name="([^"]+)"/) || [])[1];
        const id = (b.match(/vavoo\/(\d+)\.m3u8/) || [])[1];
        if (nm && id) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/, '')); if (k && !m.has(k)) m.set(k, id); }
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

function vavooHeaders(extra) { return Object.assign({ 'User-Agent': getRandomUA(), 'Accept': 'application/json', 'Origin': 'https://vavoo.to', 'Referer': 'https://vavoo.to/' }, extra || {}); }

async function vavooResolveId(base, id) {
  const play = base + '/live/play/' + id;
  try { const r = await fetchT(base + '/live/resolve?url=' + encodeURIComponent(play), { headers: getBrowserHeaders(base + '/') }, 5000); if (r.ok) { const j = await r.json().catch(() => null); if (j && j.url) return j.url; } } catch (e) {}
  try { const r = await fetchT(base + '/mediahubmx-resolve.json', { method: 'POST', headers: vavooHeaders({ 'Content-Type': 'application/json', 'Origin': base, 'Referer': base + '/' }), body: JSON.stringify({ language: 'de', region: 'DE', url: play, clientVersion: '3.0.2' }) }, 5000); if (r.ok) { const j = await r.json().catch(() => null); if (j && j.url) return j.url; } } catch (e) {}
  return null;
}

async function vavooLiveFind(base, query) {
  try {
    const rl = await fetchT(base + '/mediahubmx-list.json', { method: 'POST', headers: vavooHeaders({ 'Content-Type': 'application/json', 'Origin': base, 'Referer': base + '/' }), body: JSON.stringify({ language: 'it', region: 'IT', clientVersion: '3.0.2', url: base + '/live' }) }, 5000);
    if (!rl.ok) return null;
    const j = await rl.json().catch(() => null);
    const items = j && (j.items || j.channels || j.entries) || [];
    const tmp = new Map();
    for (const it of items) {
      const nm = it.name || it.title || '';
      const iid = it.id || ((it.url || '').match(/play\/(\d+)/) || [])[1];
      if (nm && iid) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/, '')); if (k && !tmp.has(k)) tmp.set(k, String(iid)); }
    }
    return vavooMapFind(query, tmp);
  } catch (e) { return null; }
}

const vavooURLCache = new Map();
const VAVOO_URL_TTL = 2 * 60 * 1000;
function vavooCacheKey(query, vid) { return vid ? 'v' + vid : 'q:' + norm(query); }
function vavooDrop(query, vid) { vavooURLCache.delete(vavooCacheKey(query, vid)); }

async function vavooResolve(query, vid) {
  const now = Date.now();
  const k = vavooCacheKey(query, vid);
  const hit = vavooURLCache.get(k);
  if (hit && hit.exp > now) return hit.url;
  const url = await vavooResolveRaw(query, vid);
  if (url) vavooURLCache.set(k, { url, exp: now + VAVOO_URL_TTL });
  return url;
}

async function vavooResolveRaw(query, vid) {
  let id = vid || null;
  if (!id) { const m = await ensureVavooMap(); id = vavooMapFind(query, m); }
  if (id) { for (const base of VAVOO_MIRRORS.slice(0, 6)) { const u = await vavooResolveId(base, id); if (u) return u; } return null; }
  for (const base of VAVOO_MIRRORS.slice(0, 2)) {
    const id2 = await vavooLiveFind(base, query);
    if (id2) { for (const b2 of VAVOO_MIRRORS.slice(0, 6)) { const u = await vavooResolveId(b2, id2); if (u) return u; } }
  }
  return null;
}

// ============================================================================
// LIVE — Funzione principale
// ============================================================================
let lastPl = { key: '', txt: '', t: 0 };
async function live(u, P, legacy) {
  countReq('live');
  const q = u.searchParams.get('ch') || u.searchParams.get('c') || '';
  if (!q) return R('uso: /live?ch=<slug|id>\n\n' + elencoCanali(), 200, TXT());
  const c = findCh(q);
  if (!c) return R('canale non mappato: "' + q + '"\n\n' + elencoCanali(), 200, TXT());

  // ✅ Nuovi parametri per v8.3
  const forceH264 = u.searchParams.get('force_h264') === '1';
  const variantIdx = parseInt(u.searchParams.get('variant') || '-1');
  const listVariants = u.searchParams.get('list_variants') === '1';
  const safeMode = u.searchParams.get('safe') === '1';

  const order = legacy ? [legacy, ...['ntv','vavoo','daddy'].filter(x => x !== legacy)]
    : (u.searchParams.get('p') || 'ntv,vavoo,daddy').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const availableOrder = order.filter(p => {
    if (p === 'vavoo') return c.vavoo || c.vid;
    if (p === 'ntv') return c.ntv;
    if (p === 'daddy') return c.daddy;
    return true;
  });

  const ck = c.slug + ':' + availableOrder.join('.') + ':' + forceH264 + ':' + variantIdx + ':' + safeMode;
  if (lastPl.key === ck && Date.now() - lastPl.t < 2500) return R(lastPl.txt, 200, HLS_NO_CACHE());

  const provs = {
    vavoo: async () => {
      if (!c.vavoo && !c.vid) return null;
      const vu = await vavooResolve(c.vavoo, c.vid);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/i.test(vu)) {
        const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent': 'VAVOO/1.0' }) }, 8000);
        if (!r.ok) { vavooDrop(c.vavoo, c.vid); return null; }
        let txt = await r.text();
        // ✅ Applica filtri codec se richiesto
        if (forceH264 || variantIdx >= 0 || listVariants) {
          txt = filterMasterVariants(txt, forceH264, variantIdx, listVariants);
          if (listVariants) return R(txt, 200, TXT());
        }
        const out = rewriteAny(txt, vu, P, 'https://vavoo.to/', 'https://vavoo.to', safeMode);
        lastPl = { key: ck, txt: out, t: Date.now() };
        return R(out, 200, HLS_NO_CACHE());
      }
      return R('redirect vavoo', 302, { Location: vu, ...CORS() });
    },
    ntv: async () => {
      if (!c.ntv) return null;
      const pl = await ntvPlaylist(c.ntv);
      let txt = pl.txt;
      if (forceH264 || variantIdx >= 0 || listVariants) {
        txt = filterMasterVariants(txt, forceH264, variantIdx, listVariants);
        if (listVariants) return R(txt, 200, TXT());
      }
      const out = rewriteAny(txt, pl.base, P, pl.ref, '', safeMode);
      lastPl = { key: ck, txt: out, t: Date.now() };
      return R(out, 200, HLS_NO_CACHE());
    },
    daddy: async () => {
      if (!c.daddy) return null;
      const du = await daddyResolve(c.daddy);
      if (!du || !/\.m3u8/i.test(du)) return null;
      const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 8000);
      if (!r.ok) { daddyCache.delete(c.daddy); return null; }
      let txt = await r.text();
      if (forceH264 || variantIdx >= 0 || listVariants) {
        txt = filterMasterVariants(txt, forceH264, variantIdx, listVariants);
        if (listVariants) return R(txt, 200, TXT());
      }
      const rewritten = rewriteAny(txt, du, P, 'https://thedaddy.li/', '', safeMode);
      const out = ['#EXTVLCOPT:http-referrer=https://thedaddy.li/', '#EXTVLCOPT:http-user-agent=' + getRandomUA()]
        .concat(rewritten.split('\n'));
      const finalTxt = out.join('\n'); lastPl = { key: ck, txt: finalTxt, t: Date.now() };
      return R(finalTxt, 200, HLS_NO_CACHE());
    }
  };

  for (const p of availableOrder) { const fn = provs[p]; if (!fn) continue; try { const res = await fn(); if (res) return res; } catch (e) { log(p + ' ko ' + c.slug + ': ' + (e && e.message)); } }
  return R('ERRORE: provider KO (' + availableOrder.join(' -> ') + ') per ' + c.name + '. /probe?ch=' + c.slug, 200, TXT());
}

// ============================================================================
// ✅ NUOVO: Filtro varianti nella Master Playlist
// ============================================================================
function filterMasterVariants(txt, forceH264, variantIdx, listVariants) {
  if (!/#EXT-X-STREAM-INF/.test(txt)) return txt; // Non è una master, lascia invariato
  
  const lines = String(txt).split(/\r?\n/);
  const variants = [];
  let out = [];
  let i = 0;
  
  // Prima passata: raccogli tutte le varianti
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.startsWith('#EXTM3U') || line.startsWith('#EXT-X-VERSION')) {
      out.push(line); i++; continue;
    }
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const infLine = line;
      const url = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
      const codecs = (infLine.match(/CODECS="([^"]+)"/) || [])[1] || '';
      const bandwidth = (infLine.match(/BANDWIDTH=(\d+)/) || [])[1] || '0';
      const resolution = (infLine.match(/RESOLUTION=([\dx]+)/) || [])[1] || '';
      const frameRate = (infLine.match(/FRAME-RATE=([\d.]+)/) || [])[1] || '';
      
      const isH264 = /avc1/i.test(codecs);
      const isHEVC = /hvc1|hev1/i.test(codecs);
      const isAudioOnly = !isH264 && !isHEVC && /mp4a|aac/i.test(codecs);
      
      variants.push({
        idx: variants.length,
        infLine, url, codecs, bandwidth, resolution, frameRate,
        isH264, isHEVC, isAudioOnly
      });
      i += 2; continue;
    }
    if (line.startsWith('#')) { out.push(line); i++; continue; }
    i++;
  }
  
  if (listVariants) {
    // ✅ Modalità lista: restituisci informazioni sulle varianti
    const result = ['=== VARIANTI DISPONIBILI ===', ''];
    variants.forEach((v, idx) => {
      const codecType = v.isH264 ? '✅ H.264' : v.isHEVC ? '⚠️ HEVC' : v.isAudioOnly ? '🔊 Audio' : '❓ Sconosciuto';
      result.push(`[${idx}] ${codecType} | ${v.resolution || '?'} | ${Math.round(v.bandwidth/1000)}kbps | ${v.frameRate || '?'}fps | CODECS="${v.codecs}"`);
      result.push(`      URL: ${v.url.substring(0, 80)}${v.url.length > 80 ? '...' : ''}`);
      result.push('');
    });
    result.push('=== COME USARE ===');
    result.push('• /live?ch=sky-sport-f1&force_h264=1 → usa SOLO varianti H.264');
    result.push('• /live?ch=sky-sport-f1&variant=0 → usa la variante con indice 0');
    result.push('• Prova prima force_h264=1. Se non ci sono varianti H.264, il tuo player non supporta HEVC.');
    return result.join('\n');
  }
  
  // Filtra le varianti
  let filtered = variants;
  if (forceH264) {
    filtered = variants.filter(v => v.isH264 || v.isAudioOnly);
    if (filtered.length === 0) {
      // Nessuna variante H.264: restituisci un messaggio chiaro
      return '#EXTM3U\n# AVVISO: Nessuna variante H.264 trovata\n# Questo canale usa solo HEVC/H.265 che il tuo player non supporta\n# Prova un altro provider o usa un player compatibile HEVC (VLC, MPV, MX Player)\n';
    }
  }
  
  // Se è richiesto un indice specifico
  if (variantIdx >= 0 && variantIdx < filtered.length) {
    filtered = [filtered[variantIdx]];
  }
  
  // Ricostruisci la playlist
  const finalOut = [...out];
  filtered.forEach(v => {
    finalOut.push(v.infLine);
    finalOut.push(v.url);
  });
  
  return finalOut.join('\n');
}

// ============================================================================
// Riscrittura playlist
// ============================================================================
function rewriteAny(txt, baseUrl, P, ref, origin, safeMode) {
  txt = String(txt);
  if (!txt.includes('#EXTM3U')) throw new Error('risposta non-HLS');
  return /#EXT-X-STREAM-INF/.test(txt) ? rewriteMaster(txt, baseUrl, P, ref, origin) : rewriteMediaPl(txt, baseUrl, P, ref, origin, safeMode);
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
      pending = {
        extinf: line,
        dur: parseFloat((line.match(/#EXTINF:([\d.]+)/) || [])[1]) || 0,
        disc, brange
      };
      disc = false; brange = null;
      continue;
    }
    if (line.startsWith('#')) continue;
    if (pending) { pending.url = line; segs.push(pending); pending = null; }
  }
  return { upSeq, upTarget, map, segs, isMaster };
}

function pickWindow(durs) {
  const n = durs.length;
  if (!n) return { count: 0, sum: 0 };
  let count = 0, sum = 0;
  for (let i = n - 1; i >= 0; i--) {
    count++; sum += durs[i];
    if (count >= PREF_SEGS && sum >= DELAY_TARGET) break;
  }
  while (count > MIN_SEGS && sum - durs[n - count] >= DELAY_MIN) {
    sum -= durs[n - count]; count--;
  }
  return { count, sum };
}

function absSegUrl(url, baseUrl) {
  if (/^https?:\/\//i.test(url)) return url;
  let abs;
  if (url.startsWith('/')) abs = new URL(baseUrl).origin + url;
  else abs = baseUrl.replace(/[^/]*$/, '') + url.replace(/^\.\//, '');
  return abs.replace(/([^:])\/{2,}/g, '$1/');
}

function proxUrl(abs, P, ref, origin) {
  const bust = Math.floor(Date.now() / 60000) * 60000;
  const withBust = abs + (abs.includes('?') ? '&' : '?') + '_t=' + bust;
  let u = P + '/seg?u=' + encodeURIComponent(withBust);
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

// ✅ v8.3: rewriteMediaPl migliorato con safeMode
function rewriteMediaPl(txt, baseUrl, P, ref, origin, safeMode) {
  const p = parseMediaPl(txt);
  if (p.isMaster || !p.segs.length) return rewriteMaster(txt, baseUrl, P, ref, origin);

  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs);
  
  let startIdx = p.segs.length - plan.count;
  
  // ✅ Segmento extra per keyframe (1 normale, 2 in safe mode)
  const extraSegs = safeMode ? EXTRA_KEYFRAME_SEG_SAFE : EXTRA_KEYFRAME_SEG;
  startIdx = Math.max(0, startIdx - extraSegs);
  
  // ✅ Se c'è DISCONTINUITY, andiamo ancora più indietro
  if (startIdx > 0 && p.segs[startIdx].disc) {
    startIdx = Math.max(0, startIdx - 1);
  }
  
  // ✅ Salta segmenti con durata anomala
  while (startIdx < p.segs.length - 1 && (p.segs[startIdx].dur <= 0 || p.segs[startIdx].dur > p.upTarget * 3)) {
    startIdx++;
  }
  
  const kept = p.segs.slice(startIdx);
  const dropped = startIdx;

  const out = [
    '#EXTM3U',
    '#EXT-X-VERSION:6', // ✅ Versione 6 per massima compatibilità fMP4
    '#EXT-X-TARGETDURATION:' + p.upTarget,
    '#EXT-X-MEDIA-SEQUENCE:' + (p.upSeq + dropped),
    '#EXT-X-ALLOW-CACHE:NO' // ✅ Evita caching di segmenti corrotti
  ];
  
  // ✅ Gestione robusta EXT-X-MAP
  if (p.map) {
    const mu = (p.map.match(/URI="([^"]+)"/) || [])[1];
    if (mu) {
      const mapAbs = absSegUrl(mu, baseUrl);
      const mapProx = P + '/seg?u=' + encodeURIComponent(mapAbs) + '&init=1' + 
        (ref ? '&ref=' + encodeURIComponent(ref) : '') + 
        (origin ? '&o=' + encodeURIComponent(origin) : '');
      out.push('#EXT-X-MAP:URI="' + mapProx + '"');
    }
  }

  kept.forEach((s, idx) => {
    if (s.disc && idx > 0) out.push('#EXT-X-DISCONTINUITY');
    out.push(s.extinf);
    if (s.brange) out.push(s.brange);
    out.push(proxUrl(absSegUrl(s.url, baseUrl), P, ref, origin));
  });

  return out.join('\n');
}

// ============================================================================
// SEG — Proxy segmenti
// ============================================================================
async function seg(u) {
  countReq('seg');
  const target = u.searchParams.get('u'); if (!target) return R('uso: /seg?u=<url>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://thedaddy.li/';
  const isInit = u.searchParams.get('init') === '1';
  const h = getBrowserHeaders(ref);
  const o = u.searchParams.get('o');
  if (o) h['Origin'] = o;
  const range = u.searchParams.get('range');
  if (range) h['Range'] = range;

  if (ref.includes('thedaddy')) {
    h['Referer'] = 'https://thedaddy.li/';
    h['Origin'] = 'https://thedaddy.li';
  }

  if (/\.m3u8(\?|$)/i.test(target)) {
    const r = await fetchT(target, { headers: h, cf: { cacheTtl: 0 } }, 10000);
    if (!r.ok) return R('upstream ' + r.status, r.status, TXT());
    const txt = await r.text();
    const baseDir = target.substring(0, target.lastIndexOf('/') + 1) || target;
    const out = rewriteAny(txt, baseUrl_of(baseDir), u.origin, ref, o || '');
    return R(out, 200, HLS_NO_CACHE());
  }

  const cfOpt = (range || isInit) ? { cacheTtl: 0 } : { cacheTtl: 120, cacheEverything: true };
  
  let retry = 0, maxRetries = 2;
  while (retry <= maxRetries) {
    try {
      const r = await fetchT(target, { headers: { ...h, 'User-Agent': getRandomUA() }, cf: cfOpt }, 15000);
      if (r.ok || r.status === 206 || r.status === 304) {
        // ✅ Controllo: non restituiamo HTML di errore come video
        const contentType = r.headers.get('content-type') || '';
        if (contentType.includes('text/html') || contentType.includes('application/xml')) {
          retry++; await sleep(300 * retry); continue;
        }
        
        const hh = {
          'content-type': contentType || 'video/mp2t',
          'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS',
          'access-control-allow-headers': 'Range, User-Agent, Referer, Origin',
          'cache-control': 'no-cache, no-store, must-revalidate', 'pragma': 'no-cache', 'expires': '0',
          'keep-alive': 'timeout=30, max=1000'
        };
        const cl = r.headers.get('content-length');
        const te = r.headers.get('transfer-encoding');
        if (cl && !te) hh['content-length'] = cl;
        const cr = r.headers.get('content-range'); if (cr) hh['content-range'] = cr;
        return new Response(r.body, { status: r.status, headers: hh });
      }
      retry++; await sleep(300 * retry);
    } catch (e) {
      retry++; if (retry > maxRetries) throw e; await sleep(500 * retry);
    }
  }
  return R('upstream err', 502, TXT());
}

function baseUrl_of(d) { return d.startsWith('http') ? d : 'https://' + d.replace(/^\/{2,}/, ''); }

// ============================================================================
// CHECKSEG
// ============================================================================
async function checkseg(u) {
  const source = u.searchParams.get('s') || 'ntv';
  const ch = u.searchParams.get('ch') || '869';
  const L = ['=== CHECK SEGMENTO REALE ===', 'Fonte: ' + source, 'Canale ID/Name: ' + ch, ''];
  
  try {
    let segUrl = '';
    let headers = {};
    let txt = '';
    
    if (source === 'ntv') {
      const pl = await ntvPlaylist(ch);
      txt = pl.txt;
      headers = getBrowserHeaders(pl.ref);
    } else if (source === 'daddy') {
      const du = await daddyResolve(ch);
      if (!du) return R('Daddy: URL non risolto', 200, TXT());
      const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 8000);
      if (!r.ok) return R('Daddy HTTP ' + r.status, 200, TXT());
      txt = await r.text();
      headers = getBrowserHeaders('https://thedaddy.li/');
    } else if (source === 'vavoo') {
      const c = findCh(ch);
      if (!c) return R('Vavoo: Canale non trovato (usa slug, es. sky-sport-24)', 200, TXT());
      const vu = await vavooResolve(c.vavoo, c.vid);
      if (!vu) return R('Vavoo: URL non risolto', 200, TXT());
      const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent': 'VAVOO/1.0' }) }, 8000);
      if (!r.ok) return R('Vavoo HTTP ' + r.status, 200, TXT());
      txt = await r.text();
      headers = vavooHeaders({ 'User-Agent': 'VAVOO/1.0' });
    }
    
    const lines = txt.split('\n');
    let isMaster = txt.includes('#EXT-X-STREAM-INF');
    let hasMap = txt.includes('#EXT-X-MAP');
    
    L.push('Tipo playlist: ' + (isMaster ? 'MASTER (varianti)' : 'MEDIA (segmenti)'));
    L.push('Ha EXT-X-MAP (fMP4): ' + (hasMap ? '✅ SÌ' : '❌ NO (MPEG-TS)'));
    
    // ✅ Se è master, analizziamo i codec
    if (isMaster) {
      L.push('');
      L.push('=== VARIANTI TROVATE ===');
      let vIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          const codecs = (lines[i].match(/CODECS="([^"]+)"/) || [])[1] || '';
          const resolution = (lines[i].match(/RESOLUTION=([\dx]+)/) || [])[1] || '';
          const isH264 = /avc1/i.test(codecs);
          const isHEVC = /hvc1|hev1/i.test(codecs);
          const codecLabel = isH264 ? '✅ H.264' : isHEVC ? '⚠️ HEVC' : '❓';
          L.push(`  [${vIdx}] ${codecLabel} | ${resolution} | CODECS="${codecs}"`);
          vIdx++;
        }
      }
      if (vIdx === 0) L.push('  Nessuna variante trovata');
    }
    
    L.push('');
    
    if (isMaster) {
      L.push('⚠️  È una Master Playlist. Prova una variante specifica con /live?ch=...&variant=N');
      for(let i=0; i<lines.length; i++) {
        if(!lines[i].startsWith('#') && lines[i].trim().length > 0) {
          segUrl = lines[i].trim();
          break;
        }
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('#EXTINF') && lines[i+1] && !lines[i+1].trim().startsWith('#')) {
          segUrl = lines[i+1].trim();
          break;
        }
      }
    }
    
    if (!segUrl) return R('Nessun URL trovato nella playlist', 200, TXT());
    
    if (!segUrl.startsWith('http')) {
        L.push('⚠️  URL relativo trovato, impossibile da testare direttamente senza base URL.');
        return R(L.join('\n'), 200, TXT());
    }

    L.push('URL testato: ' + segUrl);
    L.push('');
    
    const r = await fetchT(segUrl, { headers: headers }, 10000);
    L.push('HTTP Status: ' + r.status);
    L.push('Content-Type: ' + r.headers.get('content-type'));
    L.push('');
    
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf);
    L.push('Dimensione: ' + bytes.length + ' bytes');
    L.push('');
    
    const hex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    L.push('Primi 16 bytes (hex): ' + hex);
    L.push('');
    
    if (bytes.length >= 4) {
      if (bytes[0] === 0x47) {
        L.push('✅ Formato: MPEG-TS (Transport Stream)');
      } else if (String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'ftyp') {
        L.push('✅ Formato: fMP4 (Fragmented MP4)');
        const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        L.push('Brand: ' + brand);
      } else {
        const text = String.fromCharCode(...bytes.slice(0, 100));
        if (text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('<script')) {
          L.push('❌ Formato: HTML (pagina di errore/blocco) - NON È VIDEO');
          L.push('Contenuto HTML: ' + text.substring(0, 150) + '...');
        } else {
          L.push('❓ Formato: SCONOSCIUTO/RAW');
        }
      }
    }
    
    L.push('');
    L.push('=== CONCLUSIONE ===');
    if (r.status !== 200) {
      L.push('❌ Segmento non disponibile (HTTP ' + r.status + ')');
    } else if (bytes.length < 100) {
      L.push('❌ Segmento troppo piccolo (' + bytes.length + ' bytes)');
    } else if (bytes[0] === 0x47 || String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'ftyp') {
      L.push('✅ Il segmento video è VALIDO.');
      L.push('');
      L.push('Se il player mostra schermo nero, le cause possibili sono:');
      L.push('  1. ❗ Codec HEVC/H.265 non supportato dal tuo player');
      L.push('     → Prova: /live?ch=sky-sport-f1&force_h264=1');
      L.push('     → Oppure usa VLC, MPV o MX Player che supportano HEVC');
      L.push('  2. ❗ Keyframe mancante nella finestra');
      L.push('     → Prova: /live?ch=sky-sport-f1&safe=1');
      L.push('  3. ❗ Problema con EXT-X-MAP (fMP4)');
      L.push('     → Verifica che l\'init segment venga scaricato');
    } else {
      L.push('⚠️  Il segmento NON è un video valido. La fonte sta restituendo errori o blocchi.');
    }
    
    return R(L.join('\n'), 200, TXT());
  } catch (e) {
    return R('ERRORE: ' + e.message, 200, TXT());
  }
}

// ============================================================================
// ✅ NUOVO: ANALYZE — Diagnostica completa
// ============================================================================
async function analyze(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-f1';
  const c = findCh(q);
  if (!c) return 'Canale non trovato: ' + q + '\n\n' + elencoCanali();
  
  const L = ['═══════════════════════════════════════════',
             '  ANALISI COMPLETA CANALE: ' + c.name,
             '═══════════════════════════════════════════',
             'Slug: ' + c.slug,
             'NTV ID: ' + (c.ntv || '—'),
             'Vavoo: ' + (c.vavoo || '—') + (c.vid ? ' (vid=' + c.vid + ')' : ''),
             'Daddy ID: ' + (c.daddy || '—'),
             ''];
  
  const analyzeSource = async (label, getPlaylistFn) => {
    L.push('───────────────────────────────────────────');
    L.push('📡 FONTE: ' + label);
    L.push('───────────────────────────────────────────');
    try {
      const t0 = Date.now();
      const txt = await getPlaylistFn();
      const dt = Date.now() - t0;
      
      const isMaster = /#EXT-X-STREAM-INF/.test(txt);
      const hasMap = txt.includes('#EXT-X-MAP');
      
      L.push('✅ Caricata in ' + dt + 'ms');
      L.push('   Tipo: ' + (isMaster ? 'MASTER (varianti multiple)' : 'MEDIA (segmenti diretti)'));
      L.push('   fMP4: ' + (hasMap ? 'SÌ (usa EXT-X-MAP)' : 'NO (MPEG-TS)'));
      
      if (isMaster) {
        const lines = txt.split(/\r?\n/);
        const variants = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            const codecs = (lines[i].match(/CODECS="([^"]+)"/) || [])[1] || '';
            const resolution = (lines[i].match(/RESOLUTION=([\dx]+)/) || [])[1] || '';
            const bandwidth = (lines[i].match(/BANDWIDTH=(\d+)/) || [])[1] || '0';
            const frameRate = (lines[i].match(/FRAME-RATE=([\d.]+)/) || [])[1] || '';
            const isH264 = /avc1/i.test(codecs);
            const isHEVC = /hvc1|hev1/i.test(codecs);
            variants.push({ idx: variants.length, isH264, isHEVC, codecs, resolution, bandwidth, frameRate });
          }
        }
        
        const h264Count = variants.filter(v => v.isH264).length;
        const hevcCount = variants.filter(v => v.isHEVC).length;
        
        L.push('   Varianti totali: ' + variants.length);
        L.push('   ✅ H.264: ' + h264Count + ' varianti');
        L.push('   ⚠️  HEVC: ' + hevcCount + ' varianti');
        L.push('');
        
        if (variants.length > 0) {
          L.push('   ELENCO VARIANTI:');
          variants.forEach(v => {
            const codecLabel = v.isH264 ? '✅ H.264' : v.isHEVC ? '⚠️ HEVC' : '❓';
            L.push(`     [${v.idx}] ${codecLabel} | ${v.resolution || '?'} | ${Math.round(v.bandwidth/1000)}kbps | ${v.frameRate || '?'}fps | "${v.codecs}"`);
          });
        }
        
        if (h264Count === 0 && hevcCount > 0) {
          L.push('');
          L.push('   ❗❗❗ PROBLEMA: TUTTE le varianti sono HEVC!');
          L.push('   Il tuo player probabilmente non supporta HEVC → SCHERMO NERO');
          L.push('   Soluzioni:');
          L.push('     • Usa un player compatibile HEVC (VLC, MPV, MX Player)');
          L.push('     • Prova un\'altra fonte che offra H.264');
          L.push('     • Disabilita accelerazione hardware nel browser');
        } else if (h264Count > 0) {
          L.push('');
          L.push('   💡 Ci sono varianti H.264! Prova:');
          L.push('      /live?ch=' + c.slug + '&force_h264=1');
        }
      } else {
        // Media playlist: conta segmenti
        const p = parseMediaPl(txt);
        L.push('   Segmenti: ' + p.segs.length);
        L.push('   Durata finestra: ~' + (p.segs.length * p.upTarget) + 's');
        L.push('   Target duration: ' + p.upTarget + 's');
      }
      
    } catch (e) {
      L.push('❌ ERRORE: ' + (e && e.message));
    }
    L.push('');
  };
  
  if (c.ntv) {
    await analyzeSource('NTV (ID ' + c.ntv + ')', async () => (await ntvPlaylist(c.ntv)).txt);
  }
  if (c.vavoo || c.vid) {
    await analyzeSource('VAVOO', async () => {
      const vu = await vavooResolve(c.vavoo, c.vid);
      if (!vu) throw new Error('URL non risolto');
      const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent': 'VAVOO/1.0' }) }, 8000);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    });
  }
  if (c.daddy) {
    await analyzeSource('DADDY (ID ' + c.daddy + ')', async () => {
      const du = await daddyResolve(c.daddy);
      if (!du) throw new Error('URL non risolto');
      const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 8000);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    });
  }
  
  L.push('═══════════════════════════════════════════');
  L.push('📋 RIEPILOGO E AZIONI CONSIGLIATE');
  L.push('═══════════════════════════════════════════');
  L.push('');
  L.push('1️⃣  PRIMA PROVA (se ci sono varianti H.264):');
  L.push('   /live?ch=' + c.slug + '&force_h264=1');
  L.push('');
  L.push('2️⃣  SE ANCORA NERO (keyframe):');
  L.push('   /live?ch=' + c.slug + '&safe=1');
  L.push('');
  L.push('3️⃣  VEDI VARIANTI DISPONIBILI:');
  L.push('   /live?ch=' + c.slug + '&list_variants=1');
  L.push('   Poi scegli una variante: /live?ch=' + c.slug + '&variant=N');
  L.push('');
  L.push('4️⃣  SE TUTTE LE FONTI USANO SOLO HEVC:');
  L.push('   • Il problema è il tuo player, non il worker');
  L.push('   • Usa VLC, MPV o MX Player per HEVC');
  L.push('   • Oppure cerca un canale alternativo con H.264');
  
  return L.join('\n');
}

// ============================================================================
// Utility di sistema
// ============================================================================
async function warm() {
  const t0 = Date.now();
  const ids = ['869','461','870','576','462','875','460','577','575','574','877','878','879','871','872','873','860','861','862','859','864','865','867','868','863','880'];
  let ok = 0, err = 0;
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(ids.slice(i, i + 8).map(async id => { try { await ntvToken(id); ok++; } catch (e) { err++; } }));
  }
  const vavooChannels = ['sky sport 24', 'sky sport uno', 'sky sport calcio', 'sky sport tennis', 'dazn 1', 'eurosport 1', 'rsi la 1', 'rsi la 2'];
  for (const ch of vavooChannels) {
    try { await vavooResolve(ch, null); } catch (e) {}
  }
  try { await ensureVavooMap(); } catch (e) {}
  const msg = 'WARM ok=' + ok + ' err=' + err + ' (' + (Date.now() - t0) + 'ms) ntv=' + tokenCache.size + '/' + MAX_TOKEN_CACHE + ' daddy=' + daddyCache.size + '/' + MAX_DADDY_CACHE;
  log(msg); return R(msg, 200, TXT());
}

async function probe(u) {
  const q = u.searchParams.get('ch') || ''; const c = findCh(q);
  if (!c) return 'canale non mappato: "' + q + '"\n\n' + elencoCanali();
  const L = ['PROBE ' + c.name];
  try { const t0 = Date.now(); const vu = (c.vavoo || c.vid) ? await vavooResolve(c.vavoo, c.vid) : null; L.push('1) VAVOO: ' + (vu ? 'OK (' + (Date.now() - t0) + 'ms)' : 'skip')); } catch (e) { L.push('1) VAVOO: ERR ' + e.message); }
  try { if (!c.ntv) L.push('2) NTV: skip'); else { const t0 = Date.now(); const pl = await ntvPlaylist(c.ntv); L.push('2) NTV: OK ' + (pl.txt.match(/#EXTINF/g) || []).length + ' segs (' + (Date.now() - t0) + 'ms)'); } } catch (e) { L.push('2) NTV: ERR ' + e.message); }
  try { const t0 = Date.now(); const du = c.daddy ? await daddyResolve(c.daddy) : null; L.push('3) DADDY: ' + (du ? 'OK (' + (Date.now() - t0) + 'ms)' : 'skip')); } catch (e) { L.push('3) DADDY: ERR ' + e.message); }
  return L.join('\n');
}

async function vmap() {
  const m = await ensureVavooMap(true); if (!m) return 'VMAP: nessuna fonte';
  const L = ['VMAP: ' + m.size + ' canali (' + vavooMap.src + ')'];
  for (const c of CHANNELS) if (/tennis|f1|calcio|arena|rsi/i.test(c.slug)) { const id = c.vid || vavooMapFind(c.vavoo, m); L.push((id ? 'OK' : '—') + ' ' + c.slug + ' -> ' + (id || 'non trovato') + (c.vid ? ' (PINNATO)' : '')); }
  return L.join('\n');
}

async function diag(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-24';
  const c = findCh(q);
  if (!c) return 'Canale non trovato: ' + q;
  const L = ['=== DIAGNOSTICA (v8.3) ===', 'Canale: ' + c.name + ' (slug: ' + c.slug + ')', '', '💡 Per analisi completa usa: /analyze?ch=' + c.slug, ''];
  const tryP = async (label, fn) => {
    const t0 = Date.now();
    try {
      const txt = await fn();
      L.push('— ' + label + ' (' + (Date.now() - t0) + 'ms) —');
      L.push('OK | ' + playlistStats(txt));
      if (txt.includes('#EXT-X-MAP')) L.push('   ℹ️  Usa fMP4 con EXT-X-MAP');
      else L.push('   ℹ️  Usa MPEG-TS');
      if (/#EXT-X-STREAM-INF/.test(txt)) L.push('   ℹ️  Master playlist: usa /live?ch=' + c.slug + '&list_variants=1 per vedere codec');
    } catch (e) {
      L.push('— ' + label + ' (' + (Date.now() - t0) + 'ms) —');
      L.push('ERRORE: ' + (e && e.message));
    }
    L.push('');
  };
  if (c.vavoo || c.vid) await tryP('VAVOO', async () => {
    const vu = await vavooResolve(c.vavoo, c.vid);
    if (!vu) throw new Error('non risolto');
    const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent': 'VAVOO/1.0' }) }, 8000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  });
  if (c.ntv) await tryP('NTV (ID: ' + c.ntv + ')', async () => (await ntvPlaylist(c.ntv)).txt);
  if (c.daddy) await tryP('DADDY (ID: ' + c.daddy + ')', async () => {
    const du = await daddyResolve(c.daddy);
    if (!du) throw new Error('non risolto');
    const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 8000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  });
  return L.join('\n');
}

function playlistStats(txt) {
  const p = parseMediaPl(txt);
  if (p.isMaster) return 'master playlist (variant instradate via /seg)';
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs);
  const total = durs.reduce((a, b) => a + b, 0);
  return 'fonte ' + p.segs.length + ' segs / ' + total.toFixed(1) + 's'
    + ' | finestra ' + plan.count + ' segs / ' + plan.sum.toFixed(1) + 's'
    + ' | delay ~' + Math.min(plan.sum, DELAY_TARGET).toFixed(0) + 's'
    + (p.map ? ' | fMP4' : ' | MPEG-TS');
}

const VER = 'TVNOW-CF v8.3 (Fix Completo)';
const logs = [];
function log(m) { logs.push(new Date().toISOString().slice(11,19) + ' ' + m); if (logs.length > 40) logs.shift(); }

let reqStats = { day: new Date().toISOString().slice(0,10), live: 0, seg: 0 };
function countReq(kind) {
  const d = new Date().toISOString().slice(0,10);
  if (d !== reqStats.day) reqStats = { day: d, live: 0, seg: 0 };
  reqStats[kind]++;
}

function debug() {
  const L = [VER, 'Cache: NTV=' + tokenCache.size + '/' + MAX_TOKEN_CACHE + ' | Daddy=' + daddyCache.size + '/' + MAX_DADDY_CACHE + ' | VavooURL=' + vavooURLCache.size];
  const vm = vavooMapGet();
  L.push('Vavoo map: ' + (vm ? vm.size + ' canali' : 'non caricata'));
  L.push('Delay: target ' + DELAY_TARGET + 's, min ' + DELAY_MIN + 's, extra seg=' + EXTRA_KEYFRAME_SEG + ' (safe=' + EXTRA_KEYFRAME_SEG_SAFE + ')');
  L.push('UA pool: ' + UA_POOL.length + ' user-agent');
  L.push('Richieste oggi: live=' + reqStats.live + ' seg=' + reqStats.seg);
  L.push('Log:\n  ' + (logs.slice(-10).join('\n  ') || '(vuoti)'));
  return L.join('\n');
}

function uso(P) { return [VER,'','uso base:','  /live?ch=<slug|id>            playlist standard','','NUOVI PARAMETRI v8.3:','  /live?ch=X&force_h264=1       ✅ Solo varianti H.264 (risolve HEVC)','  /live?ch=X&safe=1             🛡️ Finestra più sicura (più keyframe)','  /live?ch=X&variant=N          🎯 Seleziona variante per indice','  /live?ch=X&list_variants=1    📋 Elenca varianti con codec','  /analyze?ch=X                 🔬 Analisi completa codec e varianti','','altri endpoint:','  /diag?ch=X  /checkseg?s=ntv&ch=ID  /warm  /vmap  /probe?ch=X  /debug  /ch',''].join('\n'); }
function TXT() { return { 'content-type': 'text/plain; charset=utf-8', ...CORS() }; }
function HLS_NO_CACHE() {
  return { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-cache, no-store, must-revalidate', 'pragma': 'no-cache', 'expires': '0', ...CORS() };
}
function CORS() { return { 'access-control-allow-origin': '*' }; }
function R(body, status, headers) { const h = Object.assign({ 'content-type': 'text/plain' }, headers || {}); if (status === 302) delete h['content-type']; return new Response(body, { status: status || 200, headers: h }); }
async function rawu(u) { const t = u.searchParams.get('u'); if (!t) return R('uso: /rawu?u=<url>', 200, TXT()); const h = getBrowserHeaders(u.searchParams.get('ref') || 'https://thedaddy.li/'); if (u.searchParams.get('o')) h['Origin'] = u.searchParams.get('o'); let r; try { r = await fetchT(t, { headers: h, redirect: 'follow' }, 20000); } catch (e) { return R('ERR: ' + (e && e.message), 200, TXT()); } let body = ''; try { body = await r.text(); } catch (e) { body = '(no body)'; } return R('status ' + r.status + ' | len ' + body.length + '\n' + body.slice(0, 2000), 200, TXT()); }

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
// ███ FINE TVNOW-CF v8.3 ███
