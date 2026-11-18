// ============================================================================
// TVNOW-CF v8.7 — ANTI-LOOP + ANTI-SCHERMO GRIGIO
//
// MODIFICHE RAGIONATE:
// 1. Fix Schermo Grigio: Aggiunto il supporto per #EXT-X-KEY e #EXT-X-VERSION.
//    Prima venivano ignorati, impedendo la decifratura AES e causando schermate
//    grigie con artefatti verdi.
// 2. Fix Loop (Scene Ferme): Rimossa la finestra forzata a 3 segmenti. Ora la
//    playlist viene passata interamente, lasciando al player la gestione del buffer.
// 3. Fix Cache Loop: Rimossi il cache-buster (_t=) e la cache forzata a 15s sui
//    segmenti, che costringevano il player a ricevere sempre gli stessi dati.
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

const CHANNELS = [
  { slug: 'rsi-la-1', name: 'RSI La 1', ntv: '', vavoo: 'rsi la 1', daddy: '', vid: '2455610203' },
  { slug: 'rsi-la-2', name: 'RSI La 2', ntv: '', vavoo: 'rsi la 2', daddy: '', vid: '3475299702' },
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

const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';
const tokenCache = new Map();
let ntvStats = { resolve: 0, refresh: 0, err: 0 };
const MAX_TOKEN_CACHE = 50;

async function ntvToken(id) {
  const now = Date.now() / 1000; const c = tokenCache.get(id);
  if (c && c.exp - now > 900) return c;
  if (tokenCache.size >= MAX_TOKEN_CACHE) {
    const keys = Array.from(tokenCache.keys());
    for (let i = 0; i < 10; i++) tokenCache.delete(keys[i]);
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

const DADDY_DOMAINS = ['https://thedaddy.li', 'https://daddylivetv.sbs'];
const daddyCache = new Map();
const DADDY_TTL = 2 * 60 * 1000;
const MAX_DADDY_CACHE = 100;

async function daddyResolve(id) {
  if (!id) return null;
  const now = Date.now(); const cached = daddyCache.get(id);
  if (cached && cached.exp > now) return cached.url;
  if (daddyCache.size >= MAX_DADDY_CACHE) {
    const keys = Array.from(daddyCache.keys());
    for (let i = 0; i < 10; i++) daddyCache.delete(keys[i]);
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

function vavooStreamHeaders(vu) {
  let o = 'https://vavoo.to';
  try { o = new URL(vu).origin; } catch (e) {}
  return Object.assign({
    'User-Agent': 'VAVOO/1.0',
    'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
    'Origin': o,
    'Referer': o + '/'
  });
}

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

let lastPl = { key: '', txt: '', t: 0 };

async function live(u, P, legacy) {
  countReq('live');
  const q = u.searchParams.get('ch') || u.searchParams.get('c') || '';
  if (!q) return R('uso: /live?ch=<slug|id>\n\n' + elencoCanali(), 200, TXT());
  const c = findCh(q);
  if (!c) return R('canale non mappato: "' + q + '"\n\n' + elencoCanali(), 200, TXT());

  const order = legacy ? [legacy, ...['ntv','vavoo','daddy'].filter(x => x !== legacy)]
    : (u.searchParams.get('p') || 'ntv,vavoo,daddy').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const availableOrder = order.filter(p => {
    if (p === 'vavoo') return c.vavoo || c.vid;
    if (p === 'ntv') return c.ntv;
    if (p === 'daddy') return c.daddy;
    return true;
  });

  const ck = c.slug + ':' + availableOrder.join('.');
  if (lastPl.key === ck && Date.now() - lastPl.t < 2500) return R(lastPl.txt, 200, HLS_NO_CACHE());

  const provs = {
    vavoo: async () => {
      if (!c.vavoo && !c.vid) return null;
      const vu = await vavooResolve(c.vavoo, c.vid);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/i.test(vu)) {
        const r = await fetchT(vu, { headers: vavooStreamHeaders(vu) }, 8000);
        if (!r.ok) { vavooDrop(c.vavoo, c.vid); return null; }
        const out = rewriteAny(await r.text(), vu, P, 'https://vavoo.to/', 'https://vavoo.to');
        lastPl = { key: ck, txt: out, t: Date.now() };
        return R(out, 200, HLS_NO_CACHE());
      }
      return R('redirect vavoo', 302, { Location: vu, ...CORS() });
    },
    ntv: async () => {
      if (!c.ntv) return null;
      const pl = await ntvPlaylist(c.ntv);
      const out = rewriteAny(pl.txt, pl.base, P, pl.ref, '');
      lastPl = { key: ck, txt: out, t: Date.now() };
      return R(out, 200, HLS_NO_CACHE());
    },
    daddy: async () => {
      if (!c.daddy) return null;
      const du = await daddyResolve(c.daddy);
      if (!du || !/\.m3u8/i.test(du)) return null;
      const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 8000);
      if (!r.ok) { daddyCache.delete(c.daddy); return null; }
      const out = ['#EXTVLCOPT:http-referrer=https://thedaddy.li/', '#EXTVLCOPT:http-user-agent=' + UA]
        .concat(rewriteAny(await r.text(), du, P, 'https://thedaddy.li/', '').split('\n'));
      const finalTxt = out.join('\n'); lastPl = { key: ck, txt: finalTxt, t: Date.now() };
      return R(finalTxt, 200, HLS_NO_CACHE());
    }
  };

  for (const p of availableOrder) { const fn = provs[p]; if (!fn) continue; try { const res = await fn(); if (res) return res; } catch (e) { log(p + ' ko ' + c.slug + ': ' + (e && e.message)); } }
  return R('ERRORE: provider KO (' + availableOrder.join(' -> ') + ') per ' + c.name + '. /probe?ch=' + c.slug, 200, TXT());
}

function rewriteAny(txt, baseUrl, P, ref, origin) {
  txt = String(txt);
  if (!txt.includes('#EXTM3U')) throw new Error('risposta non-HLS');
  return /#EXT-X-STREAM-INF/.test(txt) ? rewriteMaster(txt, baseUrl, P, ref, origin) : rewriteMediaPl(txt, baseUrl, P, ref, origin);
}

// FIX: Aggiunto supporto per #EXT-X-KEY e #EXT-X-VERSION
function parseMediaPl(txt) {
  let upSeq = 0, upTarget = 4, map = null, isMaster = false, version = 3;
  const keys = [];
  const segs = [];
  let pending = null, disc = false, brange = null;
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF')) { isMaster = true; break; }
    if (line.startsWith('#EXTM3U')) continue;
    if (line.startsWith('#EXT-X-VERSION:')) { version = parseInt(line.split(':')[1]) || 3; continue; }
    if (line.startsWith('#EXT-X-TARGETDURATION:')) { upTarget = parseInt(line.split(':')[1]) || 4; continue; }
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) { upSeq = parseInt(line.split(':')[1]) || 0; continue; }
    if (line.startsWith('#EXT-X-MAP')) { map = line; continue; }
    if (line.startsWith('#EXT-X-KEY')) { keys.push(line); continue; } // FIX: Cattura le chiavi AES
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
  return { upSeq, upTarget, map, keys, segs, isMaster, version };
}

function pickWindow(durs) {
  const n = durs.length;
  if (!n) return { count: 0, sum: 0 };
  const maxSegs = 3;
  let count = 0, sum = 0;
  for (let i = n - 1; i >= 0; i--) {
    count++; sum += durs[i];
    if (count >= maxSegs) break;
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

// FIX: Rimosso il cache bust (_t=) che causava il loop infinito degli stessi segmenti
function proxUrl(abs, P, ref, origin) {
  let u = P + '/seg?u=' + encodeURIComponent(abs);
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

// FIX: Inserisce #EXT-X-KEY e non taglia più i segmenti a 3 (causa del loop)
function rewriteMediaPl(txt, baseUrl, P, ref, origin) {
  const p = parseMediaPl(txt);
  if (p.isMaster || !p.segs.length) return rewriteMaster(txt, baseUrl, P, ref, origin);

  // FIX LOOP: Manteniamo tutti i segmenti della playlist sorgente
  const kept = p.segs; 
  const dropped = 0; 

  const out = [
    '#EXTM3U',
    '#EXT-X-VERSION:' + (p.version || 3),
    '#EXT-X-TARGETDURATION:' + p.upTarget,
    '#EXT-X-MEDIA-SEQUENCE:' + p.upSeq // FIX: Non sottraiamo più i segmenti scartati
  ];
  
  if (p.map) {
    const mu = (p.map.match(/URI="([^"]+)"/) || [])[1];
    if (mu) out.push('#EXT-X-MAP:URI="' + proxUrl(absSegUrl(mu, baseUrl), P, ref, origin) + '"');
  }

  // FIX SCHERMO GRIGIO: Riscrive le chiavi AES
  for (const k of p.keys) {
    const rewrittenK = k.replace(/URI="([^"]+)"/g, (m, uri) => {
      return 'URI="' + proxUrl(absSegUrl(uri, baseUrl), P, ref, origin) + '"';
    });
    out.push(rewrittenK);
  }

  kept.forEach((s, idx) => {
    if (s.disc && idx > 0) out.push('#EXT-X-DISCONTINUITY');
    out.push(s.extinf);
    if (s.brange) out.push(s.brange);
    out.push(proxUrl(absSegUrl(s.url, baseUrl), P, ref, origin));
  });

  return out.join('\n');
}

async function seg(u) {
  countReq('seg');
  const target = u.searchParams.get('u'); if (!target) return R('uso: /seg?u=<url>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://thedaddy.li/';
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
    if (!r.ok) return new Response('upstream ' + r.status, { status: r.status, headers: CORS() });
    const txt = await r.text();
    const baseDir = target.substring(0, target.lastIndexOf('/') + 1) || target;
    const out = rewriteAny(txt, baseUrl_of(baseDir), u.origin, ref, o || '');
    return R(out, 200, HLS_NO_CACHE());
  }

  // FIX LOOP: Rimosso cacheTtl: 15. I segmenti devono essere presi freschi per non bloccarsi.
  const cfOpt = { cacheTtl: 0 };
  
  try {
    const r = await fetchT(target, { headers: h, cf: cfOpt }, 15000);
    const hh = {
      'content-type': r.headers.get('content-type') || 'video/mp2t',
      'access-control-allow-origin': '*', 
      'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-allow-headers': 'Range, User-Agent, Referer, Origin',
      'cache-control': 'no-cache'
    };
    const cl = r.headers.get('content-length'); if (cl) hh['content-length'] = cl;
    const cr = r.headers.get('content-range'); if (cr) hh['content-range'] = cr;
    
    return new Response(r.body, { status: r.status, headers: hh });
  } catch (e) {
    return new Response('Segment Fetch Error', { status: 502, headers: CORS() });
  }
}

function baseUrl_of(d) { return d.startsWith('http') ? d : 'https://' + d.replace(/^\/{2,}/, ''); }

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
  for (const c of CHANNELS) if (/tennis/.test(c.slug)) { const id = c.vid || vavooMapFind(c.vavoo, m); L.push((id ? 'OK' : '--') + ' ' + c.slug + ' -> ' + (id || 'non trovato') + (c.vid ? ' (PINNATO)' : '')); }
  return L.join('\n');
}

async function diag(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-24';
  const c = findCh(q);
  if (!c) return 'Canale non trovato: ' + q;
  const L = ['=== DIAGNOSTICA (v8.7 Fix) ===', 'Canale: ' + c.name + ' (slug: ' + c.slug + ')', ''];
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
  if (c.vavoo || c.vid) await tryP('VAVOO', async () => {
    const vu = await vavooResolve(c.vavoo, c.vid);
    if (!vu) throw new Error('non risolto');
    const r = await fetchT(vu, { headers: vavooStreamHeaders(vu) }, 8000);
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
  L.push('=== CONFIGURAZIONE ===');
  L.push('Segmenti: FULL (nessun taglio)');
  L.push('Partenza: standard HLS (no tag falsi)');
  L.push('Cache segmenti: 0s (freschi per evitare loop)');
  L.push('RSI: ID Vavoo hardcodati');
  return L.join('\n');
}

function playlistStats(txt) {
  const p = parseMediaPl(txt);
  if (p.isMaster) return 'master playlist';
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs);
  const total = durs.reduce((a, b) => a + b, 0);
  return 'fonte ' + p.segs.length + ' segs / ' + total.toFixed(1) + 's'
    + ' | finestra ' + plan.count + ' segs / ' + plan.sum.toFixed(1) + 's';
}

const VER = 'TVNOW-CF v8.7';
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
  const L = [VER, 'Cache: NTV=' + tokenCache.size + '/' + MAX_TOKEN_CACHE + ' | Daddy=' + daddyCache.size + '/' + MAX_DADDY_CACHE + ' | VavooURL=' + vavooURLCache.size];
  const vm = vavooMapGet();
  L.push('Vavoo map: ' + (vm ? vm.size + ' canali' : 'non caricata'));
  L.push('Cache segmenti: 0s | Partenza: FULL');
  L.push('Richieste oggi: live=' + reqStats.live + ' seg=' + reqStats.seg);
  L.push('Log:\n  ' + (logs.slice(-10).join('\n  ') || '(vuoti)'));
  return L.join('\n');
}

function uso(P) { return [VER,'','uso:','  /live?ch=<slug|id>','  /diag?ch=sky-sport-24','  /warm  /vmap  /probe?ch=X  /debug',''].join('\n'); }
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
// ███ FINE TVNOW-CF v8.7 ███
