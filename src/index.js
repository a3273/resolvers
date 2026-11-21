// ============================================================================
// TVNOW-CF v9.2 — AUTO-HEAL + DELAY RIDOTTO + FIX SCHERMO NERO + PLAYER HLS.JS
//
// NOVITÀ rispetto alla v9.1:
// 12. NUOVO ENDPOINT /player: serve una pagina HTML con HLS.js integrato
//     che usa il decoder software del browser, bypassando i limiti hardware
//     di HEVC in MPEG-TS e gestendo correttamente le tracce audio separate.
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
      if (path === '/debug') return R(debug(), 200, TXT());
      if (path === '/checkseg') return await checkseg(u);
      if (path === '/segtest') return await segtest(u);
      if (path === '/player') return await player(u, P);
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

// ---------------------------------------------------------------------------
// ⏱ DELAY: ridotto. 16s è il minimo prudente per HLS con segmenti ~2s:
// sotto i 12s il player resta senza buffer e iniza a "saltare".
// ---------------------------------------------------------------------------
const DELAY_TARGET  = 16;
const DELAY_MIN     = 12;
const PREF_SEGS     = 3;
const MIN_SEGS      = 2;

// 🔧 AUTO-HEAL
const STALE_FACTOR   = 4;                 // TARGETDURATION x 4 senza nuovi segs = provider morto
const SEGFAIL_TTL    = 3 * 60 * 1000;     // memoria fallimenti segmenti
const SEGFAIL_MAX    = 2;                 // fallimenti prima di de-priorizzare un provider
const PL_CACHE_TTL   = 2500;              // cache risposta playlist
const RESOLVE_BUDGET = 12000;             // max ms per risolvere un provider vavoo

// 🔥 DUAL-ID: ogni canale ha vid6 (precedente priorità) e vid7 (fallback).
// Nella v9.0 la mappa live ha SEMPRE priorità: gli ID hard-coded sono solo
// candidati extra, perché diventano stanci nel giro di qualche giorno.
const CHANNELS = [
  { slug: 'rsi-la-1', name: 'RSI La 1', ntv: '', vavoo: 'rsi la 1', daddy: '', vid6: '2455610203', vid7: '2290395046' },
  { slug: 'rsi-la-2', name: 'RSI La 2', ntv: '', vavoo: 'rsi la 2', daddy: '', vid6: '3590183307', vid7: '3475299702' },
  { slug: 'sky-sport-serie-a', name: 'Sky Sport Serie A', ntv: '', vavoo: 'sky sport serie a', daddy: '880', vid6: '2077387085', vid7: '' },
  { slug: 'sky-sport-24', name: 'Sky Sport 24', ntv: '869', vavoo: 'sky sport 24', daddy: '869', vid6: '2775802255', vid7: '3445562519' },
  { slug: 'sky-sport-uno', name: 'Sky Sport Uno', ntv: '461', vavoo: 'sky sport uno', daddy: '461', vid6: '210669162', vid7: '3192996672' },
  { slug: 'sky-sport-calcio', name: 'Sky Sport Calcio', ntv: '870', vavoo: 'sky sport calcio', daddy: '870', vid6: '1665920101', vid7: '449990998' },
  { slug: 'sky-sport-tennis', name: 'Sky Sport Tennis', ntv: '576', vavoo: 'sky sport tennis', daddy: '576', vid6: '2100771782', vid7: '78546677' },
  { slug: 'sky-sport-arena', name: 'Sky Sport Arena', ntv: '462', vavoo: 'sky sport arena', daddy: '462', vid6: '3007400791', vid7: '2555960713' },
  { slug: 'sky-sport-basket', name: 'Sky Sport Basket', ntv: '875', vavoo: 'sky sport basket', daddy: '875', vid6: '2711959620', vid7: '326825326' },
  { slug: 'sky-sport-max', name: 'Sky Sport Max', ntv: '460', vavoo: 'sky sport max', daddy: '460', vid6: '2066326916', vid7: '' },
  { slug: 'sky-sport-f1', name: 'Sky Sport F1', ntv: '577', vavoo: 'sky sport f1', daddy: '577', vid6: '4246774056', vid7: '2289038972' },
  { slug: 'sky-sport-motogp', name: 'Sky Sport MotoGP', ntv: '575', vavoo: 'sky sport motogp', daddy: '575', vid6: '3036316886', vid7: '2090703806' },
  { slug: 'sky-sport-golf', name: 'Sky Sport Golf', ntv: '574', vavoo: 'sky sport golf', daddy: '574', vid6: '729945219', vid7: '3897711086' },
  { slug: 'dazn-1', name: 'DAZN 1', ntv: '877', vavoo: 'dazn 1', daddy: '877', vid6: '1376440573', vid7: '2745635299' },
  { slug: 'eurosport-1', name: 'Eurosport 1', ntv: '878', vavoo: 'eurosport 1', daddy: '878', vid6: '3481346857', vid7: '3448075317' },
  { slug: 'eurosport-2', name: 'Eurosport 2', ntv: '879', vavoo: 'eurosport 2', daddy: '879', vid6: '2283887097', vid7: '2317684453' },
  { slug: 'sky-calcio-251', name: 'Sky Calcio 251', ntv: '871', vavoo: '', daddy: '871', vid6: '', vid7: '' },
  { slug: 'sky-calcio-252', name: 'Sky Calcio 252', ntv: '872', vavoo: '', daddy: '872', vid6: '', vid7: '' },
  { slug: 'sky-calcio-253', name: 'Sky Calcio 253', ntv: '873', vavoo: '', daddy: '873', vid6: '', vid7: '' },
  { slug: 'sky-cinema-uno', name: 'Sky Cinema Uno', ntv: '860', vavoo: '', daddy: '860', vid6: '2872151911', vid7: '1759625738' },
  { slug: 'sky-cinema-action', name: 'Sky Cinema Action', ntv: '861', vavoo: '', daddy: '861', vid6: '3812796171', vid7: '1144128726' },
  { slug: 'sky-cinema-comedy', name: 'Sky Cinema Comedy', ntv: '862', vavoo: '', daddy: '862', vid6: '500203271', vid7: '3131104474' },
  { slug: 'sky-cinema-collection', name: 'Sky Cinema Collection', ntv: '859', vavoo: '', daddy: '859', vid6: '', vid7: '3525837057' },
  { slug: 'sky-cinema-romance', name: 'Sky Cinema Romance', ntv: '864', vavoo: '', daddy: '864', vid6: '2890008905', vid7: '1281264885' },
  { slug: 'sky-cinema-family', name: 'Sky Cinema Family', ntv: '865', vavoo: '', daddy: '865', vid6: '415795144', vid7: '3216516117' },
  { slug: 'sky-cinema-drama', name: 'Sky Cinema Drama', ntv: '867', vavoo: '', daddy: '867', vid6: '', vid7: '' },
  { slug: 'sky-cinema-suspense', name: 'Sky Cinema Suspense', ntv: '868', vavoo: '', daddy: '868', vid6: '1820997555', vid7: '3060043751' },
  { slug: 'sky-crime', name: 'Sky Crime', ntv: '863', vavoo: '', daddy: '863', vid6: '', vid7: '' },
  { slug: 'sky-serie', name: 'Sky Serie', ntv: '880', vavoo: '', daddy: '880', vid6: '836680112', vid7: '' }
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
  for (const c of CHANNELS) L.push('  ' + c.slug.padEnd(24) + ' ntv=' + String(c.ntv).padEnd(4) + ' vavoo=' + (c.vavoo || '-').padEnd(18) + ' daddy=' + (c.daddy || '-').padEnd(4) + (c.vid6 ? ' v6=' + c.vid6 : '') + (c.vid7 ? ' v7=' + c.vid7 : ''));
  return L.join('\n');
}

// ============================================================================
// 🔥 HEALTH CHECK VAVOO: tiene traccia di quale ID (6 o 7) funziona meglio
// ============================================================================
const VAVOO_HEALTH_TTL = 10 * 60 * 1000; // 10 minuti
const vavooHealth = new Map(); // chiave: slug canale, valore: { prefer7, t, fails6, fails7 }

function getVavooHealth(slug) {
  const h = vavooHealth.get(slug);
  if (!h) return { prefer7: false, t: 0, fails6: 0, fails7: 0 };
  if (Date.now() - h.t > VAVOO_HEALTH_TTL) {
    // Reset dopo 10 minuti: riprova (6) come preferito
    vavooHealth.delete(slug);
    return { prefer7: false, t: 0, fails6: 0, fails7: 0 };
  }
  return h;
}

function updateVavooHealth(slug, num) {
  const h = getVavooHealth(slug);
  h.t = Date.now();
  h.prefer7 = (num === 7);
  if (num === 6 || num === 0) h.fails6 = 0;
  if (num === 7 || num === 0) h.fails7 = 0;
  vavooHealth.set(slug, h);
}

function recordVavooFail(slug, idNum) {
  const h = getVavooHealth(slug);
  h.t = Date.now();
  if (idNum === 6) h.fails6++; else h.fails7++;
  if (h.fails6 >= 2) h.prefer7 = true;
  if (h.fails7 >= 2) h.prefer7 = false;
  vavooHealth.set(slug, h);
}

// ============================================================================
// 🔧 ANTI-BLOCCO: memoria dei fallimenti segmenti, per canale+provider
// ============================================================================
const segFails = new Map(); // 'slug|prov' -> [timestamp...]

function recordSegFail(ch, prov) {
  if (!ch || !prov) return;
  const key = ch + '|' + prov;
  const now = Date.now();
  const arr = (segFails.get(key) || []).filter(t => now - t < SEGFAIL_TTL);
  arr.push(now);
  segFails.set(key, arr);
  if (arr.length >= SEGFAIL_MAX) log('segfail ' + key + ' x' + arr.length + ': serve re-resolve');
}

function segFailCount(ch, prov) {
  if (!ch || !prov) return 0;
  const now = Date.now();
  const arr = (segFails.get(ch + '|' + prov) || []).filter(t => now - t < SEGFAIL_TTL);
  return arr.length;
}

function clearSegFails(ch, prov) {
  if (ch && prov) segFails.delete(ch + '|' + prov);
}

// ============================================================================
// 🔧 STATO PLAYLIST per canale: continuità sequenza + rilevamento congelamento
// ============================================================================
const plCache = new Map();  // ck -> { txt, t }
const plState = new Map();  // slug -> { lastSeq, lastUpSeq, base, discont }
const upFresh = new Map();  // 'slug|prov' -> { seq, t }

function getPlState(key) {
  let st = plState.get(key);
  if (!st) { st = { lastSeq: -1, lastUpSeq: -1, base: '', discont: false }; plState.set(key, st); }
  return st;
}

function plCacheGet(ck) {
  const e = plCache.get(ck);
  if (e && Date.now() - e.t < PL_CACHE_TTL) return e.txt;
  if (e) plCache.delete(ck);
  return null;
}

function plCacheSet(ck, txt) { plCache.set(ck, { txt, t: Date.now() }); }

// Solleva errore se la playlist upstream non avanza la sequenza da troppo tempo
function checkFreshOrThrow(key, upSeq, upTarget, prov) {
  const now = Date.now();
  const st = upFresh.get(key);
  if (!st || upSeq !== st.seq) { upFresh.set(key, { seq: upSeq, t: now }); return; }
  const maxAge = Math.max(12, (upTarget || 4) * STALE_FACTOR) * 1000;
  if (now - st.t > maxAge)
    throw new Error(prov + ' playlist congelata (seq ' + upSeq + ' da ' + Math.round((now - st.t) / 1000) + 's)');
}

// Emittente comune: valida la freschezza, riscrive, mette in cache, risponde
function emitPlaylist(ck, slug, prov, txt, baseUrl, ctx) {
  const p = parseMediaPl(txt);
  if (!p.isMaster && p.segs.length) checkFreshOrThrow(slug + '|' + prov, p.upSeq, p.upTarget, prov);
  const out = rewriteAny(txt, baseUrl, Object.assign({}, ctx, { stateKey: slug }));
  plCacheSet(ck, out);
  return R(out, 200, HLS_NO_CACHE());
}

// ============================================================================
// PROVIDER NTV
// ============================================================================
const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';
const tokenCache = new Map();
let ntvStats = { resolve: 0, refresh: 0, err: 0 };
const MAX_TOKEN_CACHE = 50;

async function ntvToken(id) {
  const now = Date.now() / 1000; const c = tokenCache.get(id);
  if (c && c.exp - now > 900) return c;
  if (tokenCache.size > MAX_TOKEN_CACHE) {
    const keys = Array.from(tokenCache.keys());
    for (let i = 0; i < keys.length - MAX_TOKEN_CACHE; i++) tokenCache.delete(keys[i]);
  }
  ntvStats.resolve++;
  const r = await fetchT(NTV_API + id, { headers: getBrowserHeaders('https://tvnow247.today/') }, 8000);
  if (!r.ok) { ntvStats.err++; throw new Error('ntv api ' + r.status); }
  const j = await r.json().catch(() => null);
  const m3u8 = j && (j.m3u8 || j.proxyPlaylistUrl || j.proxyPlayerUrl);
  if (!m3u8) { ntvStats.err++; throw new Error('ntv api senza m3u8'); }
  const exp = +(String(m3u8).match(/[?&]e=(\d+)/) || [])[1] || (now + 3600);
  const entry = { m3u8, exp, ref: (j && j.referer) || 'https://tvnow247.today/' };
  tokenCache.set(id, entry); return entry;
}

async function ntvPlaylist(id) {
  let tk = await ntvToken(id);
  let r = await fetchT(tk.m3u8, { headers: getBrowserHeaders(tk.ref) }, 8000);
  let txt = r.ok ? await r.text() : '';
  const bad = !r.ok || r.status >= 500 || !txt.includes('#EXTM3U');
  if (bad) {
    tokenCache.delete(id); ntvStats.refresh++;
    tk = await ntvToken(id);
    r = await fetchT(tk.m3u8, { headers: getBrowserHeaders(tk.ref) }, 8000);
    txt = r.ok ? await r.text() : '';
  }
  if (!txt.includes('#EXTM3U')) throw new Error('ntv playlist ' + r.status + ' non-HLS');
  return { txt, ref: tk.ref, base: tk.m3u8 };
}

// ============================================================================
// PROVIDER DADDY
// ============================================================================
const DADDY_DOMAINS = ['https://thedaddy.li', 'https://daddylivetv.sbs'];
const daddyCache = new Map();
const DADDY_TTL = 3 * 60 * 1000;
const MAX_DADDY_CACHE = 100;

async function daddyResolve(id) {
  if (!id) return null;
  const now = Date.now(); const cached = daddyCache.get(id);
  if (cached && cached.exp > now) return cached.url;
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
    'User-Agent': UA,
    'Accept': '*/*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer,
    'Origin': referer.replace(/\/$/, ''),
    'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'cross-site',
    'Upgrade-Insecure-Requests': '1'
  };
}

// ============================================================================
// PROVIDER VAVOO
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
      const r = await fetchT(src, { headers: { 'User-Agent': 'VAVOO/1.0' } }, 10000); if (!r.ok) continue;
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

function vavooHeaders(extra) { return Object.assign({ 'User-Agent': 'MediaHubMX/2', 'Accept': 'application/json', 'Origin': 'https://vavoo.to', 'Referer': 'https://vavoo.to/' }, extra || {}); }

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

// 🔧 Cache URL risolte Vavoo (2 min)
const vavooURLCache = new Map();
const VAVOO_URL_TTL = 2 * 60 * 1000;
function vavooDrop(query, vid) { vavooURLCache.delete(vid ? 'v' + vid : 'q:' + norm(query)); }

// 🔧 RISOLUZIONE DUAL con priorità MAPPA LIVE → vid6/vid7 (health check) → ricerca live
async function vavooResolveDual(slug, query, vid6, vid7) {
  const t0 = Date.now();
  const cacheKey = slug || ('q:' + norm(query));

  const cachedUrl = vavooURLCache.get(cacheKey);
  if (cachedUrl && cachedUrl.exp > t0) return cachedUrl.url;

  const healthKey = slug || norm(query);
  const health = getVavooHealth(healthKey);

  // Mappa live: la fonte più affidabile, aggiornata dai repo
  const m = await ensureVavooMap();
  const mapId = m ? vavooMapFind(query || '', m) : null;

  // Costruisci la lista candidati: mappa prima, poi vid6/vid7 nell'ordine
  // dettato dall'health check
  const cands = [];
  if (mapId) cands.push({ id: mapId, num: 0 });
  const rest = [];
  if (vid6 && vid6 !== mapId) rest.push({ id: vid6, num: 6 });
  if (vid7 && vid7 !== mapId) rest.push({ id: vid7, num: 7 });
  if (health.prefer7) rest.reverse();
  cands.push(...rest);

  // Nessun ID noto: cerca l'ID live sui mirror
  if (!cands.length && query) {
    for (const base of VAVOO_MIRRORS.slice(0, 2)) {
      if (Date.now() - t0 > RESOLVE_BUDGET) break;
      try { const id2 = await vavooLiveFind(base, query); if (id2) { cands.push({ id: id2, num: 0 }); break; } } catch (e) {}
    }
  }

  // Prova i candidati (max 3) con budget di tempo
  for (const cand of cands.slice(0, 3)) {
    if (Date.now() - t0 > RESOLVE_BUDGET) break;
    const url = await tryVavooId(cand.id);
    if (url) {
      updateVavooHealth(healthKey, cand.num);
      vavooURLCache.set(cacheKey, { url, exp: Date.now() + VAVOO_URL_TTL });
      return url;
    }
    if (cand.num) recordVavooFail(healthKey, cand.num);
  }

  // Ultimo ricorso: la mappa è vecchia? Forzala e riprova con un ID diverso
  if (Date.now() - t0 < RESOLVE_BUDGET && vavooMap.t && Date.now() - vavooMap.t > 30 * 60 * 1000) {
    try {
      const m2 = await ensureVavooMap(true);
      const id2 = m2 ? vavooMapFind(query || '', m2) : null;
      if (id2 && id2 !== mapId) {
        const u2 = await tryVavooId(id2);
        if (u2) {
          updateVavooHealth(healthKey, 0);
          vavooURLCache.set(cacheKey, { url: u2, exp: Date.now() + VAVOO_URL_TTL });
          return u2;
        }
      }
    } catch (e) {}
  }

  return null;
}

// Prova a risolvere un singolo ID Vavoo fino a 4 mirror, max ~18s
async function tryVavooId(id) {
  for (const base of VAVOO_MIRRORS.slice(0, 4)) {
    try { const u = await vavooResolveId(base, id); if (u) return u; } catch (e) {}
  }
  return null;
}

// Wrapper per compatibilità (usato da /warm)
async function vavooResolve(query, vid) {
  const c = findCh(query);
  if (c) return await vavooResolveDual(c.slug, c.vavoo || query, c.vid6, c.vid7);
  return await vavooResolveDual(null, query, vid, null);
}

async function vavooResolveRaw(query, vid) {
  return await vavooResolve(query, vid);
}

// ============================================================================
// ROTTA /live — provider ordinati, auto-heal, cache per canale
// ============================================================================
async function live(u, P, legacy) {
  countReq('live');
  const q = u.searchParams.get('ch') || u.searchParams.get('c') || '';
  if (!q) return R('uso: /live?ch=<slug|id>\n\n' + elencoCanali(), 200, TXT());
  const c = findCh(q);
  if (!c) return R('canale non mappato: "' + q + '"\n\n' + elencoCanali(), 200, TXT());

  const order = legacy ? [legacy, ...['ntv','vavoo','daddy'].filter(x => x !== legacy)]
    : (u.searchParams.get('p') || 'ntv,vavoo,daddy').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const availableOrder = order.filter(p => {
    if (p === 'vavoo') return c.vavoo || c.vid6 || c.vid7;
    if (p === 'ntv') return c.ntv;
    if (p === 'daddy') return c.daddy;
    return true;
  });

  // 🔧 ANTI-BLOCCO: i provider con segmenti falliti di recente vanno in fondo
  const good = availableOrder.filter(p => segFailCount(c.slug, p) < SEGFAIL_MAX);
  const bad  = availableOrder.filter(p => segFailCount(c.slug, p) >= SEGFAIL_MAX);
  const finalOrder = good.concat(bad);

  const ck = c.slug + ':' + finalOrder.join('.');
  const cachedOut = plCacheGet(ck);
  if (cachedOut) return R(cachedOut, 200, HLS_NO_CACHE());

  const provs = {
    vavoo: async () => {
      if (!c.vavoo && !c.vid6 && !c.vid7) return null;
      // Se i segmenti vavoo falliscono di recente, l'URL risolto è quasi
      // certamente scaduto: forza una risoluzione nuova
      if (segFailCount(c.slug, 'vavoo') >= SEGFAIL_MAX) {
        vavooURLCache.delete(c.slug);
        clearSegFails(c.slug, 'vavoo');
        log('vavoo ' + c.slug + ': URL scaduto, re-resolve');
      }
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/i.test(vu)) {
        const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent': 'VAVOO/1.0' }) }, 8000);
        if (!r.ok) { vavooURLCache.delete(c.slug); return null; }
        const txt = await r.text();
        return emitPlaylist(ck, c.slug, 'vavoo', txt, vu, { P, ch: c.slug, prov: 'vavoo', ref: 'https://vavoo.to/', origin: 'https://vavoo.to' });
      }
      return R('redirect vavoo', 302, { Location: vu, ...CORS() });
    },
    ntv: async () => {
      if (!c.ntv) return null;
      const pl = await ntvPlaylist(c.ntv);
      return emitPlaylist(ck, c.slug, 'ntv', pl.txt, pl.base, { P, ch: c.slug, prov: 'ntv', ref: pl.ref, origin: '' });
    },
    daddy: async () => {
      if (!c.daddy) return null;
      const du = await daddyResolve(c.daddy);
      if (!du || !/\.m3u8/i.test(du)) return null;
      const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 8000);
      if (!r.ok) { daddyCache.delete(c.daddy); return null; }
      const body = rewriteAny(await r.text(), du, { P, ch: c.slug, prov: 'daddy', ref: 'https://thedaddy.li/', origin: '' });
      const lines = body.split('\n');
      if (lines[0] === '#EXTM3U')
        lines.splice(1, 0, '#EXTVLCOPT:http-referrer=https://thedaddy.li/', '#EXTVLCOPT:http-user-agent=' + UA);
      const out = lines.join('\n');
      plCacheSet(ck, out);
      return R(out, 200, HLS_NO_CACHE());
    }
  };

  for (const p of finalOrder) {
    const fn = provs[p]; if (!fn) continue;
    try { const res = await fn(); if (res) return res; }
    catch (e) { log(p + ' ko ' + c.slug + ': ' + (e && e.message)); }
  }
  return R('ERRORE: provider KO (' + finalOrder.join(' -> ') + ') per ' + c.name + '. /probe?ch=' + c.slug + ' e /debug per i dettagli', 200, TXT());
}

// ============================================================================
// RISCRITTURA PLAYLIST con continuità sequenza + DISCONTINUITY automatica
// ============================================================================
function rewriteAny(txt, baseUrl, ctx) {
  txt = String(txt);
  if (!txt.includes('#EXTM3U')) throw new Error('risposta non-HLS');
  return /#EXT-X-STREAM-INF/.test(txt) ? rewriteMaster(txt, baseUrl, ctx) : rewriteMediaPl(txt, baseUrl, ctx);
}

function parseMediaPl(txt) {
  let upSeq = 0, upTarget = 4, map = null, isMaster = false, endlist = false;
  const segs = [];
  let pending = null, disc = false, brange = null, pdt = null;
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF')) { isMaster = true; break; }
    if (line.startsWith('#EXTM3U')) continue;
    if (line.startsWith('#EXT-X-TARGETDURATION:')) { upTarget = parseInt(line.split(':')[1]) || 4; continue; }
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) { upSeq = parseInt(line.split(':')[1]) || 0; continue; }
    if (line.startsWith('#EXT-X-MAP')) { map = line; continue; }
    // v9.1: PDT ed ENDLIST preservati (sincronizzazione rendizioni audio/video)
    if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME')) { pdt = line; continue; }
    if (line.startsWith('#EXT-X-ENDLIST')) { endlist = true; continue; }
    if (line.startsWith('#EXT-X-DISCONTINUITY')) { disc = true; continue; }
    if (line.startsWith('#EXT-X-BYTERANGE')) { brange = line; continue; }
    if (line.startsWith('#EXTINF')) {
      pending = {
        extinf: line,
        dur: parseFloat((line.match(/#EXTINF:([\d.]+)/) || [])[1]) || 0,
        disc, brange, pdt
      };
      disc = false; brange = null; pdt = null;
      continue;
    }
    if (line.startsWith('#')) continue;
    if (pending) { pending.url = line; segs.push(pending); pending = null; }
  }
  return { upSeq, upTarget, map, segs, isMaster, endlist };
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

function proxUrl(abs, ctx) {
  // v9.1: l'URL upstream passa INTATTO, senza parametri aggiunti. Le URL dei
  // segmenti di questi stream sono già uniche per REFRESH, e su CDN con
  // firma nella query un param extra produce 403 su ogni segmento.
  let u = ctx.P + '/seg?u=' + encodeURIComponent(abs);
  if (ctx.ref) u += '&ref=' + encodeURIComponent(ctx.ref);
  if (ctx.origin) u += '&o=' + encodeURIComponent(ctx.origin);
  if (ctx.ch) u += '&ch=' + encodeURIComponent(ctx.ch);
  if (ctx.prov) u += '&p=' + encodeURIComponent(ctx.prov);
  return u;
}

function rewriteMaster(txt, baseUrl, ctx) {
  const out = [];
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // 🔧 v9.1: le tracce audio (#EXT-X-MEDIA:TYPE=AUDIO,URI=...) e gli
    // I-FRAME-STREAM-INF contengono un URI="..." dentro una riga con #:
    // vengono riscritte, altrimenti il player prende l'audio diretto da
    // upstream e il video dal proxy → solo audio, video nero.
    if (line.startsWith('#')) {
      const mu = line.match(/URI="([^"]+)"/);
      if (mu && (line.startsWith('#EXT-X-MEDIA') || line.startsWith('#EXT-X-I-FRAME-STREAM-INF')))
        out.push(line.replace(/URI="[^"]+"/, 'URI="' + proxUrl(absSegUrl(mu[1], baseUrl), ctx) + '"'));
      else
        out.push(line);
      continue;
    }
    out.push(proxUrl(absSegUrl(line, baseUrl), ctx));
  }
  return out.join('\n');
}

function rewriteMediaPl(txt, baseUrl, ctx) {
  const p = parseMediaPl(txt);
  if (p.isMaster || !p.segs.length) return rewriteMaster(txt, baseUrl, ctx);

  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs);
  const kept = p.segs.slice(-plan.count);
  const dropped = p.segs.length - kept.length;

  let seq = p.upSeq + dropped;
  let discontTop = false;
  const st = ctx && ctx.stateKey ? getPlState(ctx.stateKey) : null;
  if (st) {
    // Host/base upstream cambiata (failover o re-resolve): serve discontinuità
    if (st.base && st.base !== baseUrl) { st.base = baseUrl; st.discont = true; }
    else if (!st.base) st.base = baseUrl;
    // Sequenza upstream andata indietro (reset sorgente): tienila monotona
    if (st.lastSeq >= 0 && seq <= st.lastSeq) {
      if (seq < st.lastSeq || p.upSeq < st.lastUpSeq) {
        seq = st.lastSeq;
        st.discont = true;
        log('seek indietro ' + (ctx && ctx.ch) + ': seq ' + p.upSeq + ' clampato, discontinuità inserita');
      }
    }
    st.lastSeq = seq;
    st.lastUpSeq = p.upSeq;
    if (st.discont && kept.length) { discontTop = true; st.discont = false; }
  }

  const out = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:' + p.upTarget,
    '#EXT-X-MEDIA-SEQUENCE:' + seq
  ];
  if (p.endlist) out.push('#EXT-X-ENDLIST');
  if (p.map) {
    const mu = (p.map.match(/URI="([^"]+)"/) || [])[1];
    if (mu) out.push('#EXT-X-MAP:URI="' + proxUrl(absSegUrl(mu, baseUrl), ctx) + '"');
  }
  if (discontTop) out.push('#EXT-X-DISCONTINUITY');

  kept.forEach((s, idx) => {
    if (s.disc && idx > 0) out.push('#EXT-X-DISCONTINUITY');
    out.push(s.extinf);
    if (s.pdt) out.push(s.pdt);
    if (s.brange) out.push(s.brange);
    out.push(proxUrl(absSegUrl(s.url, baseUrl), ctx));
  });

  return out.join('\n');
}

// ============================================================================
// ROTTA /seg — con retry, report fallimenti e riscrittura m3u8 annidate
// ============================================================================
async function seg(u) {
  countReq('seg');
  const target = u.searchParams.get('u'); if (!target) return R('uso: /seg?u=<url>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://thedaddy.li/';
  const h = getBrowserHeaders(ref);
  const o = u.searchParams.get('o');
  if (o) h['Origin'] = o;
  const range = u.searchParams.get('range');
  if (range) h['Range'] = range;
  const ch = u.searchParams.get('ch') || '';
  const prov = u.searchParams.get('p') || '';

  if (ref.includes('thedaddy')) {
    h['Referer'] = 'https://thedaddy.li/';
    h['Origin'] = 'https://thedaddy.li';
  }

  if (/\.m3u8(\?|$)/i.test(target)) {
    const r = await fetchT(target, { headers: h, cf: { cacheTtl: 0 } }, 10000);
    if (!r.ok) return R('upstream ' + r.status, r.status, TXT());
    const txt = await r.text();
    const baseDir = target.substring(0, target.lastIndexOf('/') + 1) || target;
    const out = rewriteAny(txt, baseUrl_of(baseDir), { P: u.origin, ref, origin: o || '', ch, prov, stateKey: target });
    return R(out, 200, HLS_NO_CACHE());
  }

  const cfOpt = range ? { cacheTtl: 0 } : { cacheTtl: 300, cacheEverything: true };
  let r = await fetchT(target, { headers: h, cf: cfOpt }, 15000);

  // 🔧 ANTI-BLOCCO SEGMENTI: errore upstream (403/404/410/5xx, spesso cache CF
  // con una risposta vecchia) → retry immediato bypassando la cache
  if (!r.ok && !range) {
    recordSegFail(ch, prov);
    r = await fetchT(target, { headers: h, cf: { cacheTtl: 0, cacheEverything: false } }, 15000);
    if (!r.ok) return R('upstream ' + r.status, r.status, TXT());
  } else if (!r.ok) {
    recordSegFail(ch, prov);
    return R('upstream ' + r.status, r.status, TXT());
  }

  const hh = {
    'content-type': r.headers.get('content-type') || 'video/mp2t',
    'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'Range, User-Agent, Referer, Origin',
    'cache-control': 'no-cache, no-store, must-revalidate', 'pragma': 'no-cache', 'expires': '0'
  };
  const cl = r.headers.get('content-length'); const cr = r.headers.get('content-range'); if (cl) hh['content-length'] = cl; if (cr) hh['content-range'] = cr;
  return new Response(r.body, { status: r.status, headers: hh });
}

async function segtest(u) {
  const t = u.searchParams.get('u'); if (!t) return R('uso: /segtest?u=<url>&ref=<referer>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://vavoo.to/';
  const L = ['=== TEST SEGMENTO DIRETTO (nessuna modifica) ===', 'URL: ' + t, 'Referer: ' + ref, ''];
  try {
    const h = getBrowserHeaders(ref);
    const r = await fetchT(t, { headers: h }, 10000);
    L.push('HTTP Status: ' + r.status);
    L.push('Content-Type: ' + r.headers.get('content-type'));
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf);
    L.push('Dimensione: ' + bytes.length + ' bytes');
    L.push('Primi 16 bytes: ' + Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    if (bytes.length >= 8) {
      if (bytes[0] === 0x47) L.push('✅ Formato: MPEG-TS - COMPATIBILE');
      else if (String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'ftyp') L.push('✅ Formato: fMP4 - COMPATIBILE');
      else {
        const text = String.fromCharCode(...bytes.slice(0, 100));
        L.push(text.includes('<html') || text.includes('<!DOCTYPE') ? '❌ Formato: HTML - NON È VIDEO' : '❓ Formato: SCONOSCIUTO');
      }
    }
    return R(L.join('\n'), 200, TXT());
  } catch (e) { return R('ERRORE: ' + e.message, 200, TXT()); }
}

function baseUrl_of(d) { return d.startsWith('http') ? d : 'https://' + d.replace(/^\/{2,}/, ''); }

// ============================================================================
// PLAYER HLS.JS — Decoder software per codec problematici
// ============================================================================
async function player(u, P) {
  const ch = u.searchParams.get('ch') || 'sky-sport-f1';
  const c = findCh(ch);
  if (!c) return R('Canale non trovato: ' + ch, 404, TXT());
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${c.name} - TVNOW Player</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    video { width: 100%; max-width: 1200px; height: auto; background: #000; }
    .controls { position: fixed; top: 10px; left: 10px; color: #fff; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; background: rgba(0,0,0,0.85); padding: 15px; border-radius: 8px; font-size: 13px; line-height: 1.6; backdrop-filter: blur(10px); z-index: 1000; }
    .controls div { margin: 2px 0; }
    .title { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
    .status { color: #4CAF50; }
    .status.error { color: #f44336; }
    .status.loading { color: #FFC107; }
    @media (max-width: 768px) {
      .controls { font-size: 11px; padding: 10px; }
      video { width: 100vw; max-width: 100vw; }
    }
  </style>
</head>
<body>
  <div class="controls">
    <div class="title">📺 ${c.name}</div>
    <div>Player: HLS.js (software decoder)</div>
    <div>Codec: Auto-detect (HEVC/H.264)</div>
    <div id="status" class="status loading">⏳ Caricamento...</div>
    <div id="quality"></div>
    <div id="buffer"></div>
  </div>
  <video id="video" controls autoplay muted playsinline></video>
  <script>
    const video = document.getElementById('video');
    const status = document.getElementById('status');
    const quality = document.getElementById('quality');
    const buffer = document.getElementById('buffer');
    const streamUrl = '${P}/live?ch=${c.slug}';
    
    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5
      });
      
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        status.textContent = '✅ Stream caricato';
        status.className = 'status';
        video.play().catch(e => console.log('Autoplay bloccato:', e));
        
        if (data.levels && data.levels.length > 0) {
          const currentLevel = data.levels[data.currentLevel || 0];
          quality.textContent = 'Qualità: ' + currentLevel.width + 'x' + currentLevel.height + ' @ ' + Math.round(currentLevel.bitrate/1000) + 'kbps';
        }
      });
      
      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = data.level;
        if (hls.levels[level]) {
          quality.textContent = 'Qualità: ' + hls.levels[level].width + 'x' + hls.levels[level].height + ' @ ' + Math.round(hls.levels[level].bitrate/1000) + 'kbps';
        }
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          status.textContent = '❌ Errore: ' + data.type;
          status.className = 'status error';
          
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.log('Fatal error, destroying player');
              hls.destroy();
              break;
          }
        }
      });
      
      // Aggiorna buffer info
      setInterval(() => {
        if (video.buffered.length > 0) {
          const buffered = video.buffered.end(video.buffered.length - 1) - video.currentTime;
          buffer.textContent = 'Buffer: ' + buffered.toFixed(1) + 's';
        }
      }, 1000);
      
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari nativo
      status.textContent = '✅ Safari nativo (limitato)';
      status.className = 'status';
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('Autoplay bloccato:', e));
      });
    } else {
      status.textContent = '❌ Browser non supportato';
      status.className = 'status error';
    }
  </script>
</body>
</html>`;
  
  return R(html, 200, { 'content-type': 'text/html; charset=utf-8', ...CORS() });
}

// ============================================================================
// DIAGNOSTICA
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
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      if (!vu) return R('Vavoo: URL non risolto', 200, TXT());
      const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent': 'VAVOO/1.0' }) }, 8000);
      if (!r.ok) return R('Vavoo HTTP ' + r.status, 200, TXT());
      txt = await r.text();
      headers = vavooHeaders({ 'User-Agent': 'VAVOO/1.0' });
    }

    const lines = txt.split('\n');
    let isMaster = txt.includes('#EXT-X-STREAM-INF');

    if (isMaster) {
      L.push('⚠️  È una Master Playlist.');
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
        L.push('⚠️  URL relativo trovato.');
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
        L.push('✅ Formato: MPEG-TS - COMPATIBILE');
      } else if (String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'ftyp') {
        L.push('✅ Formato: fMP4 - COMPATIBILE');
      } else {
        const text = String.fromCharCode(...bytes.slice(0, 100));
        if (text.includes('<html') || text.includes('<!DOCTYPE')) {
          L.push('❌ Formato: HTML - NON È VIDEO');
        } else {
          L.push('❓ Formato: SCONOSCIUTO');
        }
      }
    }

    return R(L.join('\n'), 200, TXT());
  } catch (e) {
    return R('ERRORE: ' + e.message, 200, TXT());
  }
}

async function warm() {
  const t0 = Date.now();
  const ids = ['869','461','870','576','462','875','460','577','575','574','877','878','879','871','872','873','860','861','862','859','864','865','867','868','863','880'];
  let ok = 0, err = 0;
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(ids.slice(i, i + 8).map(async id => { try { await ntvToken(id); ok++; } catch (e) { err++; } }));
  }
  const vavooChannels = ['sky sport 24', 'sky sport uno', 'sky sport calcio', 'sky sport tennis', 'dazn 1', 'eurosport 1', 'rsi la 1', 'rsi la 2', 'sky sport f1', 'sky sport motogp'];
  for (const ch of vavooChannels) {
    try { await vavooResolve(ch, null); } catch (e) {}
  }
  const daddyList = ['869','461','870','576','462','875','460','577','575','574','877','878','879'];
  for (const id of daddyList) { try { await daddyResolve(id); } catch (e) {} }
  try { await ensureVavooMap(); } catch (e) {}
  const msg = 'WARM ok=' + ok + ' err=' + err + ' (' + (Date.now() - t0) + 'ms) ntv=' + tokenCache.size + '/' + MAX_TOKEN_CACHE + ' daddy=' + daddyCache.size + '/' + MAX_DADDY_CACHE + ' vavooURL=' + vavooURLCache.size + ' health=' + vavooHealth.size;
  log(msg); return R(msg, 200, TXT());
}

async function probe(u) {
  const q = u.searchParams.get('ch') || ''; const c = findCh(q);
  if (!c) return 'canale non mappato: "' + q + '"\n\n' + elencoCanali();
  const L = ['PROBE ' + c.name];
  const h = getVavooHealth(c.slug);
  L.push('Health vavoo: prefer7=' + h.prefer7 + ' fails6=' + h.fails6 + ' fails7=' + h.fails7);
  L.push('SegFails (3 min): vavoo=' + segFailCount(c.slug, 'vavoo') + ' ntv=' + segFailCount(c.slug, 'ntv') + ' daddy=' + segFailCount(c.slug, 'daddy'));
  try {
    const t0 = Date.now();
    if (c.vavoo || c.vid6 || c.vid7) {
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      L.push('1) VAVOO: ' + (vu ? 'OK (' + (Date.now() - t0) + 'ms)\n     URL upstream: ' + vu : 'skip'));
    } else L.push('1) VAVOO: skip');
  } catch (e) { L.push('1) VAVOO: ERR ' + e.message); }
  try { if (!c.ntv) L.push('2) NTV: skip'); else { const t0 = Date.now(); const pl = await ntvPlaylist(c.ntv); L.push('2) NTV: OK ' + (pl.txt.match(/#EXTINF/g) || []).length + ' segs (' + (Date.now() - t0) + 'ms)\n     URL upstream: ' + pl.base); } } catch (e) { L.push('2) NTV: ERR ' + e.message); }
  try { const t0 = Date.now(); const du = c.daddy ? await daddyResolve(c.daddy) : null; L.push('3) DADDY: ' + (du ? 'OK (' + (Date.now() - t0) + 'ms)\n     URL upstream: ' + du : 'skip')); } catch (e) { L.push('3) DADDY: ERR ' + e.message); }
  L.push('');
  L.push('Suggerito per diagnosi "solo audio": apri l\'URL upstream in VLC con');
  L.push('opzione di rete (se il video parte lì, il problema è nel proxy).');
  L.push('Oppure usa /player?ch=' + c.slug + ' per il player HLS.js integrato.');
  return L.join('\n');
}

async function vmap() {
  const m = await ensureVavooMap(true); if (!m) return 'VMAP: nessuna fonte';
  const L = ['VMAP: ' + m.size + ' canali (' + vavooMap.src + ')'];
  for (const c of CHANNELS) if (/tennis/.test(c.slug)) { const id = c.vid6 || vavooMapFind(c.vavoo, m); L.push((id ? 'OK' : '--') + ' ' + c.slug + ' -> ' + (id || 'non trovato') + (c.vid6 ? ' (ID6=' + c.vid6 + ')' : '')); }
  return L.join('\n');
}

async function diag(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-24';
  const c = findCh(q);
  if (!c) return 'Canale non trovato: ' + q;
  const h = getVavooHealth(c.slug);
  const L = ['=== DIAGNOSTICA (v9.2 Auto-Heal + Player HLS.js) ===', 'Canale: ' + c.name + ' (slug: ' + c.slug + ')', ''];
  L.push('Health: prefer7=' + h.prefer7 + ' fails6=' + h.fails6 + ' fails7=' + h.fails7 + ' (TTL=' + VAVOO_HEALTH_TTL/1000 + 's)');
  L.push('Vavoo ID6: ' + (c.vid6 || 'none') + ' | ID7: ' + (c.vid7 || 'none'));
  L.push('SegFails (3 min): vavoo=' + segFailCount(c.slug, 'vavoo') + ' ntv=' + segFailCount(c.slug, 'ntv') + ' daddy=' + segFailCount(c.slug, 'daddy'));
  L.push('');
  const tryP = async (label, fn) => {
    const t0 = Date.now();
    try {
      const txt = await fn();
      L.push('-- ' + label + ' (' + (Date.now() - t0) + 'ms) --');
      L.push('OK | ' + playlistStats(txt));
    } catch (e) {
      L.push('-- ' + label + ' (' + (Date.now() - t0) + 'ms) --');
      L.push('ERRORE: ' + (e && e.message));
    }
    L.push('');
  };
  if (c.vavoo || c.vid6 || c.vid7) await tryP('VAVOO (dual + mappa live)', async () => {
    const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
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
  L.push('=== LOGICA AUTO-HEAL v9.2 ===');
  L.push('1. Mappa live vavoo con priorità: ID stanci non bloccano più il canale');
  L.push('2. Segmenti falliti (403/404/HTML) → segnalati e il provider va in fondo');
  L.push('3. Playlist congelata (seq fermo > 4x targetduration) → provider scartato');
  L.push('4. Al failover/change host: discontinuità automatica, lo stream riprende');
  L.push('5. Tracce audio #EXT-X-MEDIA riscritte (fix solo-audio) + niente _t sugli URL');
  L.push('6. NUOVO: /player?ch=xxx per player HLS.js con decoder software');
  return L.join('\n');
}

function playlistStats(txt) {
  const p = parseMediaPl(txt);
  if (p.isMaster) return 'master playlist';
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs);
  const total = durs.reduce((a, b) => a + b, 0);
  return 'fonte ' + p.segs.length + ' segs / ' + total.toFixed(1) + 's'
    + ' | finestra ' + plan.count + ' segs / ' + plan.sum.toFixed(1) + 's'
    + ' | delay ~' + Math.min(plan.sum, DELAY_TARGET).toFixed(0) + 's';
}

const VER = 'TVNOW-CF v9.2 (Auto-Heal + Delay 16s + Player HLS.js)';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const logs = [];
function log(m) { logs.push(new Date().toISOString().slice(11,19) + ' ' + m); if (logs.length > 40) logs.shift(); }

let reqStats = { day: new Date().toISOString().slice(0,10), live: 0, seg: 0 };
function countReq(kind) {
  const d = new Date().toISOString().slice(0,10);
  if (d !== reqStats.day) reqStats = { day: d, live: 0, seg: 0 };
  reqStats[kind]++;
}

function debug() {
  const L = [VER, 'Cache: NTV=' + tokenCache.size + '/' + MAX_TOKEN_CACHE + ' | Daddy=' + daddyCache.size + '/' + MAX_DADDY_CACHE + ' | VavooURL=' + vavooURLCache.size + ' | Health=' + vavooHealth.size];
  const vm = vavooMapGet();
  L.push('Vavoo map: ' + (vm ? vm.size + ' canali (' + Math.round((Date.now() - vavooMap.t) / 60000) + ' min)' : 'non caricata'));
  L.push('Delay: target ' + DELAY_TARGET + 's, min ' + DELAY_MIN + 's');
  L.push('Stream attivi (stato playlist): ' + plState.size + ' | Playlist cache: ' + plCache.size);
  const sf = [];
  const now = Date.now();
  for (const [k, arr] of segFails) { const live = arr.filter(t => now - t < SEGFAIL_TTL); if (live.length) sf.push(k + '=' + live.length); }
  L.push('SegFails (3 min): ' + (sf.join(', ') || 'nessuno'));
  L.push('Richieste oggi: live=' + reqStats.live + ' seg=' + reqStats.seg);
  L.push('Log:\n  ' + (logs.slice(-10).join('\n  ') || '(vuoti)'));
  return L.join('\n');
}

function uso(P) { return [VER,'','uso:','  /live?ch=<slug|id>            playlist con auto-heal e delay 16s','  /player?ch=<slug|id>          player HLS.js (decoder software per HEVC)','  /diag?ch=sky-sport-f1           diagnostica completa','  /probe?ch=sky-sport-f1          probe rapido + URL upstream (test in VLC)','  /checkseg?s=vavoo&ch=sky-sport-f1  test segmento reale','  /segtest?u=<url>&ref=<referer>  test URL diretto senza modifiche','  /warm  /vmap  /debug  /ch  /rawu  /ip',''].join('\n'); }
function TXT() { return { 'content-type': 'text/plain; charset=utf-8', ...CORS() }; }
function HLS_NO_CACHE() {
  return { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-cache, no-store, must-revalidate', 'pragma': 'no-cache', 'expires': '0', ...CORS() };
}
function CORS() { return { 'access-control-allow-origin': '*' }; }
function R(body, status, headers) { const h = Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, headers || {}); if (status === 302) delete h['content-type']; return new Response(body, { status: status || 200, headers: h }); }
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
// ███ FINE TVNOW-CF v9.2 ███
