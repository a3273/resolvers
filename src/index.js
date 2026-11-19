// TVNOW-CF v8.5 — AVVIO VELOCE + RSI FIX + HEVC FILTER — COMPLETO
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
      if (path === '/vmap') return R(await vmap(u), 200, TXT());
      if (path === '/ch') return R(elencoCanali(), 200, TXT());
      if (path === '/probe') return R(await probe(u), 200, TXT());
      if (path === '/diag') return R(await diag(u), 200, TXT());
      if (path === '/analyze') return R(await analyze(u), 200, TXT());
      if (path === '/debug') return R(debug(), 200, TXT());
      if (path === '/checkseg') return await checkseg(u);
      if (path === '/ip') {
        const ip = req.headers.get('cf-connecting-ip') || '';
        const r = await fetchT('https://www.cloudflare.com/cdn-cgi/trace', {}, 8000);
        const t = r.ok ? await r.text() : 'trace err ' + r.status;
        return R('client: ' + ip + '\negress:\n' + t, 200, TXT());
      }
      if (path === '/') return R(uso(P), 200, TXT());
      return R('404\n\n' + uso(P), 200, TXT());
    } catch (e) {
      return R('ERRORE: ' + (e?.message || String(e)), 200, TXT());
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(warm()); }
};

// === CONFIG — OTTIMIZZATA PER AVVIO VELOCE ===
const DELAY_TARGET = 16, DELAY_MIN = 12, PREF_SEGS = 3, MIN_SEGS = 2;
const DELAY_FAST_TARGET = 8, DELAY_FAST_MIN = 6; // ✅ Modalità FAST: avvio in 3-4s
const EXTRA_KEYFRAME_SEG = 1, EXTRA_KEYFRAME_SEG_SAFE = 2;

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
];
const getRandomUA = () => UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// === CANALI — RSI La 2 con ID FISSO ===
const CHANNELS = [
  { slug: 'rsi-la-1', name: 'RSI La 1', ntv: '', vavoo: 'rsi la 1', vavooId: '2455610203', daddy: '', vid: '2455610203' },
  { slug: 'rsi-la-2', name: 'RSI La 2', ntv: '', vavoo: 'rsi la 2', vavooId: '3590183307', daddy: '', vid: '3590183307' },
  { slug: 'sky-sport-serie-a', name: 'Sky Sport Serie A', ntv: '', vavoo: 'sky sport serie a', daddy: '880' },
  { slug: 'sky-sport-24', name: 'Sky Sport 24', ntv: '869', vavoo: 'sky sport 24', daddy: '869' },
  { slug: 'sky-sport-uno', name: 'Sky Sport Uno', ntv: '461', vavoo: 'sky sport uno', daddy: '461' },
  { slug: 'sky-sport-calcio', name: 'Sky Sport Calcio', ntv: '870', vavoo: 'sky sport calcio', daddy: '870' },
  { slug: 'sky-sport-tennis', name: 'Sky Sport Tennis', ntv: '576', vavoo: 'sky sport tennis', daddy: '576', vid: '2100771782' },
  { slug: 'sky-sport-arena', name: 'Sky Sport Arena', ntv: '462', vavoo: 'sky sport arena', daddy: '462' },
  { slug: 'sky-sport-f1', name: 'Sky Sport F1', ntv: '577', vavoo: 'sky sport f1', daddy: '577' },
  { slug: 'sky-sport-motogp', name: 'Sky Sport MotoGP', ntv: '575', vavoo: 'sky sport motogp', daddy: '575' },
  { slug: 'sky-sport-max', name: 'Sky Sport Max', ntv: '460', vavoo: 'sky sport max', daddy: '460' },
  { slug: 'dazn-1', name: 'DAZN 1', ntv: '877', vavoo: 'dazn 1', daddy: '877', vid: '2745635299' },
  { slug: 'eurosport-1', name: 'Eurosport 1', ntv: '878', vavoo: 'eurosport 1', daddy: '878', vid: '3448075317' },
  { slug: 'eurosport-2', name: 'Eurosport 2', ntv: '879', vavoo: 'eurosport 2', daddy: '879', vid: '2317684453' }
];

const ALIASES = { dazn: 'dazn-1', 'serie-a': 'sky-sport-serie-a' };
const norm = s => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const BY_KEY = (() => {
  const m = new Map();
  for (const c of CHANNELS) {
    m.set(c.slug, c); m.set(norm(c.name), c);
    if (c.ntv) m.set(c.ntv, c); if (c.daddy) m.set('d' + c.daddy, c);
  }
  for (const [a, s] of Object.entries(ALIASES)) { const c = m.get(s); if (c) m.set(a, c); }
  return m;
})();
const findCh = q => { let k = norm(q); return BY_KEY.get(k) || BY_KEY.get(k.replace(/-ntv$/, '').replace(/-daddy$/, '')) || null; };
const elencoCanali = () => {
  const L = ['CANALI (' + CHANNELS.length + ') — /live?ch=<slug>'];
  for (const c of CHANNELS) L.push('  ' + c.slug.padEnd(22) + ' ntv:' + String(c.ntv).padEnd(4) + ' vavoo:' + (c.vavoo || '-').padEnd(18) + ' daddy:' + (c.daddy || '-') + (c.vavooId ? ' vid:' + c.vavooId : ''));
  return L.join('\n');
};

// === NTV — TIMEOUT 2s PER FAILOVER VELOCE ===
const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';
const tokenCache = new Map();
const NTV_REFRESH_AHEAD = 120, MAX_TOKEN_CACHE = 50, NTV_CACHE_TTL = 15; // ✅ Cache 15s
async function ntvToken(id) {
  const now = Date.now() / 1000;
  const c = tokenCache.get(id);
  if (c && c.exp - now > NTV_REFRESH_AHEAD) return c;
  if (tokenCache.size > MAX_TOKEN_CACHE) {
    const keys = Array.from(tokenCache.keys());
    for (let i = 0; i < keys.length - MAX_TOKEN_CACHE; i++) tokenCache.delete(keys[i]);
  }
  try {
    const r = await fetchT(NTV_API + id, { headers: getBrowserHeaders('https://tvnow247.today/') }, 2000); // ✅ 2s invece di 8s
    if (!r.ok) throw new Error('ntv api ' + r.status);
    const j = await r.json().catch(() => null);
    const m3u8 = j?.m3u8 || j?.proxyPlaylistUrl || j?.proxyPlayerUrl;
    if (!m3u8) throw new Error('ntv api senza m3u8');
    const exp = +((m3u8.match(/[?&]e=(\d+)/) || [])[1]) || (now + 3600);
    const entry = { m3u8, exp, ref: j?.referer || 'https://tvnow247.today/', lastOk: now };
    tokenCache.set(id, entry);
    return entry;
  } catch (e) {
    if (c && c.exp - now > 0) return c;
    throw e;
  }
}
async function ntvPlaylist(id) {
  let tk = await ntvToken(id), retry = 0;
  while (retry < 3) {
    try {
      const r = await fetchT(tk.m3u8, { headers: getBrowserHeaders(tk.ref) }, 3000); // ✅ 3s
      const txt = r.ok ? await r.text() : '';
      if (r.ok && txt.includes('#EXTM3U')) return { txt, ref: tk.ref, base: tk.m3u8 };
      tokenCache.delete(id);
      tk = await ntvToken(id);
      retry++; await sleep(300 * retry);
    } catch {
      tokenCache.delete(id); retry++; await sleep(500 * retry);
    }
  }
  throw new Error('ntv playlist fallita');
}

// === DADDY ===
const DADDY_DOMAINS = ['https://thedaddy.li', 'https://daddylivetv.sbs'];
const daddyCache = new Map(), DADDY_TTL = 120000, DADDY_REFRESH_AHEAD = 60000, MAX_DADDY_CACHE = 100;
async function extractM3u8FromEmbed(url, refererDomain, timeoutMs) {
  const r = await fetchT(url, { headers: getBrowserHeaders(refererDomain + '/'), cf: { cacheTtl: 300 } }, timeoutMs);
  if (!r.ok) return null;
  const html = await r.text();
  let m = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if (m) return m[1];
  const iframe = html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
  if (iframe) {
    const r2 = await fetchT(iframe[1], { headers: getBrowserHeaders(url), cf: { cacheTtl: 300 } }, timeoutMs);
    if (r2.ok) {
      const html2 = await r2.text();
      m = html2.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
      if (m) return m[1];
    }
  }
  return null;
}
async function daddyResolve(id) {
  if (!id) return null;
  const now = Date.now();
  const cached = daddyCache.get(id);
  if (cached && cached.exp - now > DADDY_REFRESH_AHEAD) return cached.url;
  if (daddyCache.size > MAX_DADDY_CACHE) daddyCache.delete(daddyCache.keys().next().value);
  for (const domain of DADDY_DOMAINS) {
    try {
      const m3u8 = await extractM3u8FromEmbed(`${domain}/embed/stream-${id}.php`, domain, 3000); // ✅ 3s
      if (m3u8) { daddyCache.set(id, { url: m3u8, exp: now + DADDY_TTL }); return m3u8; }
    } catch {}
  }
  return null;
}

// === VAVOO — FIX RSI La 2 ID FISSO + TIMEOUT VELOCI ===
const VAVOO_MIRRORS = ['https://geil.to','https://geil.app','https://vavoo.to','https://kool.to','https://huhu.to','https://oha.to'];
const VAVOO_SOURCES = ['https://raw.githubusercontent.com/aphrodite747/VvOo/main/index_Italy.m3u'];
let vavooMap = { map: null, t: 0 };
const VAVOO_MAP_TTL = 6 * 3600 * 1000;
const vavooMapGet = () => (vavooMap.map && Date.now() - vavooMap.t < VAVOO_MAP_TTL) ? vavooMap.map : null;
async function ensureVavooMap(force) {
  const cached = vavooMapGet(); if (cached && !force) return cached;
  for (const src of VAVOO_SOURCES) {
    try {
      const r = await fetchT(src, { headers: { 'User-Agent': getRandomUA() } }, 5000); // ✅ 5s
      if (!r.ok) continue;
      const t = await r.text(); const m = new Map();
      for (const b of t.split('#EXTINF')) {
        const nm = (b.match(/tvg-name="([^"]+)"/) || [])[1];
        const id = (b.match(/vavoo\/(\d+)\.m3u8/) || [])[1];
        if (nm && id) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/, '')); if (k && !m.has(k)) m.set(k, id); }
      }
      if (m.size > 50) { vavooMap = { map: m, t: Date.now() }; return m; }
    } catch {}
  }
  return cached;
}
const vavooMapFind = (q, m) => {
  if (!m || !q) return null;
  const k = norm(q); if (m.has(k)) return m.get(k);
  const qTok = k.split('-').filter(Boolean);
  let best = null, bestScore = -1;
  for (const [key, id] of m) {
    const kTok = key.split('-').filter(Boolean);
    if (qTok.every(w => kTok.includes(w))) {
      const score = qTok.length - (kTok.length - qTok.length);
      if (score > bestScore) { bestScore = score; best = id; }
    }
  }
  return best;
};
const getBrowserHeaders = ref => ({
  'User-Agent': getRandomUA(), 'Accept': '*/*', 'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8',
  'Referer': ref, 'Origin': ref.replace(/\/$/, ''), 'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'cross-site'
});
const vavooHeaders = extra => Object.assign({ 'User-Agent': 'VAVOO/1.0', 'Origin': 'https://vavoo.to', 'Referer': 'https://vavoo.to/' }, extra || {});
async function vavooResolveId(base, id) {
  try {
    const r = await fetchT(base + '/live/resolve?url=' + encodeURIComponent(base + '/live/play/' + id), { headers: getBrowserHeaders(base + '/') }, 2000); // ✅ 2s
    if (r.ok) { const j = await r.json().catch(() => null); if (j?.url) return j.url; }
  } catch {}
  try {
    const r = await fetchT(base + '/mediahubmx-resolve.json', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...vavooHeaders() },
      body: JSON.stringify({ language: 'it', region: 'IT', url: base + '/live/play/' + id, clientVersion: '3.0.2' })
    }, 2000); // ✅ 2s
    if (r.ok) { const j = await r.json().catch(() => null); if (j?.url) return j.url; }
  } catch {}
  return null;
}
const vavooURLCache = new Map(), VAVOO_URL_TTL = 15000; // ✅ Cache 15s per avvio veloce
const vavooCacheKey = (q, vid) => vid ? 'v' + vid : 'q:' + norm(q);

// === RISOLUZIONE VAVOO — RSI La 2 con ID FISSO PRIORITARIO ===
async function vavooResolve(query, vid) {
  const k = vavooCacheKey(query, vid);
  const hit = vavooURLCache.get(k);
  if (hit && hit.exp > Date.now()) return hit.url;

  // ✅ FIX RSI LA 2: ID FISSO diretto
  if (vid === '3590183307' || norm(query || '') === 'rsi-la-2' || query === 'rsi la 2') {
    for (const base of VAVOO_MIRRORS) {
      const u = await vavooResolveId(base, '3590183307');
      if (u) { vavooURLCache.set(k, { url: u, exp: Date.now() + VAVOO_URL_TTL }); return u; }
    }
  }

  let id = vid || null;
  if (!id) { const m = await ensureVavooMap(); id = vavooMapFind(query, m); }
  if (id) { for (const base of VAVOO_MIRRORS) { const u = await vavooResolveId(base, id); if (u) { vavooURLCache.set(k, { url: u, exp: Date.now() + VAVOO_URL_TTL }); return u; } } }
  return null;
}

// === FILTRO CODEC H.264/HEVC ===
function filterMasterVariants(txt, forceH264, variantIdx, listVariants) {
  if (!/#EXT-X-STREAM-INF/.test(txt)) return txt;
  const lines = txt.split(/\r?\n/), variants = [], out = []; let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.startsWith('#EXTM3U') || line.startsWith('#EXT-X-VERSION')) { out.push(line); i++; continue; }
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const codecs = (line.match(/CODECS="([^"]+)"/) || [])[1] || '';
      const resolution = (line.match(/RESOLUTION=([\dx]+)/) || [])[1] || '';
      const isH264 = /avc1/i.test(codecs), isHEVC = /hvc1|hev1/i.test(codecs);
      variants.push({ infLine: line, url: lines[i+1]?.trim() || '', codecs, resolution, isH264, isHEVC });
      i += 2; continue;
    }
    if (line.startsWith('#')) { out.push(line); i++; continue; }
    i++;
  }
  if (listVariants) {
    const R = ['=== VARIANTI DISPONIBILI ===', ''];
    variants.forEach((v, idx) => R.push(`[${idx}] ${v.isH264?'✅ H.264':v.isHEVC?'⚠️ HEVC':'❓'} | ${v.resolution} | CODECS="${v.codecs}"`));
    R.push('');
    R.push('Usa: /live?ch=X&force_h264=1  OPPURE  /live?ch=X&variant=N');
    return R.join('\n');
  }
  let filtered = variants;
  if (forceH264) {
    filtered = variants.filter(v => v.isH264);
    if (filtered.length === 0) return '#EXTM3U\n# AVVISO: Nessuna variante H.264 trovata\n# Usa player compatibile HEVC (VLC, MPV)\n';
  }
  if (variantIdx >= 0 && variantIdx < filtered.length) filtered = [filtered[variantIdx]];
  filtered.forEach(v => { out.push(v.infLine); out.push(v.url); });
  return out.join('\n');
}

// === LIVE PRINCIPALE — OTTIMIZZATA PER AVVIO VELOCE ===
let lastPl = { key: '', txt: '', t: 0 };
async function live(u, P, legacy) {
  const q = u.searchParams.get('ch') || u.searchParams.get('c') || '';
  if (!q) return R('uso: /live?ch=<slug>\n\n' + elencoCanali(), 200, TXT());
  const c = findCh(q);
  if (!c) return R('canale non trovato: "' + q + '"\n\n' + elencoCanali(), 200, TXT());
  
  const forceH264 = u.searchParams.get('force_h264') === '1';
  const variantIdx = parseInt(u.searchParams.get('variant') || '-1');
  const listVariants = u.searchParams.get('list_variants') === '1';
  const safeMode = u.searchParams.get('safe') === '1';
  const fastMode = u.searchParams.get('fast') === '1'; // ✅ NUOVO: modalità avvio veloce
  
  const order = legacy ? [legacy, ...['ntv','vavoo','daddy'].filter(x => x !== legacy)]
    : (u.searchParams.get('p') || 'ntv,vavoo,daddy').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const availableOrder = order.filter(p =>
    p === 'vavoo' ? (c.vavoo || c.vavooId || c.vid) : p === 'ntv' ? !!c.ntv : p === 'daddy' ? !!c.daddy : true
  );
  
  const ck = c.slug + ':' + availableOrder.join('.') + ':' + forceH264 + ':' + variantIdx + ':' + fastMode;
  if (lastPl.key === ck && Date.now() - lastPl.t < 2500) return R(lastPl.txt, 200, HLS_NO_CACHE());
  
  const provs = {
    vavoo: async () => {
      if (!c.vavoo && !c.vavooId && !c.vid) return null;
      const vu = await vavooResolve(c.vavoo, c.vavooId || c.vid);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/i.test(vu)) {
        const r = await fetchT(vu, { headers: vavooHeaders() }, 3000); // ✅ 3s
        if (!r.ok) return null;
        let txt = await r.text();
        if (forceH264 || variantIdx >= 0 || listVariants) {
          txt = filterMasterVariants(txt, forceH264, variantIdx, listVariants);
          if (listVariants) return R(txt, 200, TXT());
        }
        const out = rewriteAny(txt, vu, P, 'https://vavoo.to/', 'https://vavoo.to', safeMode, fastMode);
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
      const out = rewriteAny(txt, pl.base, P, pl.ref, '', safeMode, fastMode);
      lastPl = { key: ck, txt: out, t: Date.now() };
      return R(out, 200, HLS_NO_CACHE());
    },
    daddy: async () => {
      if (!c.daddy) return null;
      const du = await daddyResolve(c.daddy);
      if (!du || !/\.m3u8/i.test(du)) return null;
      const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 3000); // ✅ 3s
      if (!r.ok) { daddyCache.delete(c.daddy); return null; }
      let txt = await r.text();
      if (forceH264 || variantIdx >= 0 || listVariants) {
        txt = filterMasterVariants(txt, forceH264, variantIdx, listVariants);
        if (listVariants) return R(txt, 200, TXT());
      }
      const rewritten = rewriteAny(txt, du, P, 'https://thedaddy.li/', '', safeMode, fastMode);
      const out = ['#EXTVLCOPT:http-referrer=https://thedaddy.li/', '#EXTVLCOPT:http-user-agent=' + getRandomUA()]
        .concat(rewritten.split('\n'));
      const finalTxt = out.join('\n');
      lastPl = { key: ck, txt: finalTxt, t: Date.now() };
      return R(finalTxt, 200, HLS_NO_CACHE());
    }
  };
  
  for (const p of availableOrder) {
    const fn = provs[p]; if (!fn) continue;
    try { const res = await fn(); if (res) return res; }
    catch (e) { log(p + ' ko ' + c.slug + ': ' + (e?.message || e)); }
  }
  return R('ERRORE: provider KO (' + availableOrder.join(' -> ') + ') per ' + c.name + '. /probe?ch=' + c.slug, 200, TXT());
}

// === RISCRITTURA PLAYLIST — CON MODALITÀ FAST ===
function rewriteAny(txt, baseUrl, P, ref, origin, safeMode, fastMode) {
  txt = String(txt);
  if (!txt.includes('#EXTM3U')) throw new Error('risposta non-HLS');
  return /#EXT-X-STREAM-INF/.test(txt) ? rewriteMaster(txt, baseUrl, P, ref, origin) : rewriteMediaPl(txt, baseUrl, P, ref, origin, safeMode, fastMode);
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
      disc = false; brange = null; continue;
    }
    if (line.startsWith('#')) continue;
    if (pending) { pending.url = line; segs.push(pending); pending = null; }
  }
  return { upSeq, upTarget, map, segs, isMaster };
}
function pickWindow(durs, fast) {
  const n = durs.length; if (!n) return { count: 0, sum: 0 };
  const target = fast ? DELAY_FAST_TARGET : DELAY_TARGET;
  const minD = fast ? DELAY_FAST_MIN : DELAY_MIN;
  let count = 0, sum = 0;
  for (let i = n - 1; i >= 0; i--) { count++; sum += durs[i]; if (count >= (fast ? 2 : PREF_SEGS) && sum >= target) break; }
  while (count > MIN_SEGS && sum - durs[n - count] >= minD) { sum -= durs[n - count]; count--; }
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

// ✅ rewriteMediaPl — CON FAST MODE + EXT-X-START PER AVVIO IMMEDIATO
function rewriteMediaPl(txt, baseUrl, P, ref, origin, safeMode, fastMode) {
  const p = parseMediaPl(txt);
  if (p.isMaster || !p.segs.length) return rewriteMaster(txt, baseUrl, P, ref, origin);
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs, fastMode);
  let startIdx = p.segs.length - plan.count;
  const extraSegs = safeMode ? EXTRA_KEYFRAME_SEG_SAFE : EXTRA_KEYFRAME_SEG;
  startIdx = Math.max(0, startIdx - extraSegs);
  if (startIdx > 0 && p.segs[startIdx].disc) startIdx = Math.max(0, startIdx - 1);
  while (startIdx < p.segs.length - 1 && (p.segs[startIdx].dur <= 0 || p.segs[startIdx].dur > p.upTarget * 3)) startIdx++;
  const kept = p.segs.slice(startIdx);
  const dropped = startIdx;
  
  // ✅ Calcola TIME-OFFSET per EXT-X-START: dice al player da dove iniziare
  const keptDurs = kept.map(s => s.dur || p.upTarget);
  const totalKept = keptDurs.reduce((a, b) => a + b, 0);
  const startOffset = fastMode ? Math.min(4, totalKept - 0.5) : Math.min(6, totalKept - 0.5);
  
  const out = [
    '#EXTM3U', '#EXT-X-VERSION:6', '#EXT-X-TARGETDURATION:' + p.upTarget,
    '#EXT-X-MEDIA-SEQUENCE:' + (p.upSeq + dropped), '#EXT-X-ALLOW-CACHE:NO',
    '#EXT-X-START:TIME-OFFSET=-' + startOffset.toFixed(1) + ',PRECISE=NO' // ✅ AVVIO IMMEDIATO
  ];
  if (p.map) {
    const mu = (p.map.match(/URI="([^"]+)"/) || [])[1];
    if (mu) {
      const mapAbs = absSegUrl(mu, baseUrl);
      const mapProx = P + '/seg?u=' + encodeURIComponent(mapAbs) + '&init=1' +
        (ref ? '&ref=' + encodeURIComponent(ref) : '') + (origin ? '&o=' + encodeURIComponent(origin) : '');
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

// === SEG — Proxy segmenti ===
async function seg(u) {
  const target = u.searchParams.get('u'); if (!target) return R('uso: /seg?u=<url>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://thedaddy.li/';
  const isInit = u.searchParams.get('init') === '1';
  const h = getBrowserHeaders(ref);
  const o = u.searchParams.get('o'); if (o) h['Origin'] = o;
  const range = u.searchParams.get('range'); if (range) h['Range'] = range;
  if (ref.includes('thedaddy')) { h['Referer'] = 'https://thedaddy.li/'; h['Origin'] = 'https://thedaddy.li'; }
  if (/\.m3u8(\?|$)/i.test(target)) {
    const r = await fetchT(target, { headers: h, cf: { cacheTtl: 0 } }, 5000); // ✅ 5s
    if (!r.ok) return R('upstream ' + r.status, r.status, TXT());
    const txt = await r.text();
    const baseDir = target.substring(0, target.lastIndexOf('/') + 1) || target;
    const out = rewriteAny(txt, baseUrl_of(baseDir), u.origin, ref, o || '');
    return R(out, 200, HLS_NO_CACHE());
  }
  const cfOpt = (range || isInit) ? { cacheTtl: 0 } : { cacheTtl: 120, cacheEverything: true };
  let retry = 0;
  while (retry <= 2) {
    try {
      const r = await fetchT(target, { headers: { ...h, 'User-Agent': getRandomUA() }, cf: cfOpt }, 8000); // ✅ 8s
      if (r.ok || r.status === 206 || r.status === 304) {
        const contentType = r.headers.get('content-type') || '';
        if (contentType.includes('text/html')) { retry++; continue; }
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
      retry++; await sleep(200 * retry);
    } catch (e) {
      retry++; if (retry > 2) throw e; await sleep(400 * retry);
    }
  }
  return R('upstream err', 502, TXT());
}
function baseUrl_of(d) { return d.startsWith('http') ? d : 'https://' + d.replace(/^\/{2,}/, ''); }

// === CHECKSEG ===
async function checkseg(u) {
  const source = u.searchParams.get('s') || 'ntv';
  const ch = u.searchParams.get('ch') || '869';
  const L = ['=== CHECK SEGMENTO ===', 'Fonte: ' + source, 'Canale: ' + ch, ''];
  try {
    let segUrl = '', headers = {}, txt = '';
    if (source === 'ntv') { const pl = await ntvPlaylist(ch); txt = pl.txt; headers = getBrowserHeaders(pl.ref); }
    else if (source === 'daddy') {
      const du = await daddyResolve(ch); if (!du) return R('Daddy: URL non risolto', 200, TXT());
      const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 3000);
      if (!r.ok) return R('Daddy HTTP ' + r.status, 200, TXT());
      txt = await r.text(); headers = getBrowserHeaders('https://thedaddy.li/');
    } else if (source === 'vavoo') {
      const c = findCh(ch); if (!c) return R('Vavoo: canale non trovato', 200, TXT());
      const vu = await vavooResolve(c.vavoo, c.vavooId || c.vid); if (!vu) return R('Vavoo: URL non risolto', 200, TXT());
      const r = await fetchT(vu, { headers: vavooHeaders() }, 3000);
      if (!r.ok) return R('Vavoo HTTP ' + r.status, 200, TXT());
      txt = await r.text(); headers = vavooHeaders();
    }
    const lines = txt.split('\n');
    const isMaster = txt.includes('#EXT-X-STREAM-INF');
    L.push('Tipo: ' + (isMaster ? 'MASTER' : 'MEDIA'));
    L.push('fMP4: ' + (txt.includes('#EXT-X-MAP') ? 'SÌ' : 'NO (MPEG-TS)'));
    if (isMaster) {
      L.push(''); L.push('=== VARIANTI ===');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          const codecs = (lines[i].match(/CODECS="([^"]+)"/) || [])[1] || '';
          const res = (lines[i].match(/RESOLUTION=([\dx]+)/) || [])[1] || '';
          L.push(`  ${/avc1/i.test(codecs)?'✅H.264':/hvc1|hev1/i.test(codecs)?'⚠️HEVC':'❓'} | ${res} | ${codecs}`);
        }
      }
    }
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('#EXTINF') && lines[i+1] && !lines[i+1].trim().startsWith('#')) {
        segUrl = lines[i+1].trim(); break;
      }
    }
    if (!segUrl || !segUrl.startsWith('http')) return R(L.join('\n'), 200, TXT());
    L.push(''); L.push('URL: ' + segUrl);
    const r = await fetchT(segUrl, { headers }, 5000);
    L.push('HTTP: ' + r.status + ' | CT: ' + r.headers.get('content-type'));
    const buf = await r.arrayBuffer(); const bytes = new Uint8Array(buf);
    L.push('Bytes: ' + bytes.length);
    if (bytes.length >= 4) {
      if (bytes[0] === 0x47) L.push('✅ MPEG-TS valido');
      else if (String.fromCharCode(bytes[4],bytes[5],bytes[6],bytes[7]) === 'ftyp') L.push('✅ fMP4 valido');
      else {
        const t = String.fromCharCode(...bytes.slice(0,100));
        if (t.includes('<html')) L.push('❌ HTML di errore');
        else L.push('❓ Formato sconosciuto');
      }
    }
    return R(L.join('\n'), 200, TXT());
  } catch (e) { return R('ERRORE: ' + e.message, 200, TXT()); }
}

// === WARM / PROBE / VMAP / DIAG / ANALYZE ===
async function warm() {
  const t0 = Date.now();
  const ids = ['869','461','870','576','462','577','575','877','878','879'];
  let ok = 0, err = 0;
  for (let i = 0; i < ids.length; i += 4) {
    await Promise.all(ids.slice(i,i+4).map(async id => { try { await ntvToken(id); ok++; } catch { err++; } }));
  }
  for (const ch of ['rsi la 1','rsi la 2','sky sport 24','sky sport f1']) {
    try { await vavooResolve(ch, null); } catch {}
  }
  try { await ensureVavooMap(); } catch {}
  const msg = 'WARM ok=' + ok + ' err=' + err + ' (' + (Date.now()-t0) + 'ms)';
  log(msg); return R(msg, 200, TXT());
}
async function probe(u) {
  const q = u.searchParams.get('ch') || ''; const c = findCh(q);
  if (!c) return 'canale non trovato\n\n' + elencoCanali();
  const L = ['PROBE ' + c.name];
  try { const t0 = Date.now(); const vu = (c.vavoo||c.vavooId||c.vid) ? await vavooResolve(c.vavoo, c.vavooId||c.vid) : null; L.push('VAVOO: ' + (vu ? 'OK ('+(Date.now()-t0)+'ms)' : 'skip')); } catch(e){ L.push('VAVOO: ERR '+e.message); }
  try { if (!c.ntv) L.push('NTV: skip'); else { const t0=Date.now(); const pl=await ntvPlaylist(c.ntv); L.push('NTV: OK ('+(Date.now()-t0)+'ms)'); } } catch(e){ L.push('NTV: ERR '+e.message); }
  try { const t0=Date.now(); const du=c.daddy?await daddyResolve(c.daddy):null; L.push('DADDY: '+(du?'OK ('+(Date.now()-t0)+'ms)':'skip')); } catch(e){ L.push('DADDY: ERR '+e.message); }
  return L.join('\n');
}
async function vmap(u) {
  const force = u.searchParams.get('force') === '1';
  const m = await ensureVavooMap(force); if (!m) return 'VMAP: nessuna fonte';
  const L = ['VMAP: ' + m.size + ' canali'];
  for (const c of CHANNELS) {
    if (/rsi|tennis|f1|calcio|arena/i.test(c.slug)) {
      const id = c.vavooId || c.vid || vavooMapFind(c.vavoo, m);
      L.push((id?'OK':'—') + ' ' + c.slug + ' -> ' + (id || 'non trovato') + (c.vavooId ? ' (FISSO)' : ''));
    }
  }
  return L.join('\n');
}
async function diag(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-f1';
  const c = findCh(q); if (!c) return 'Canale non trovato';
  const L = ['=== DIAGNOSTICA ===', 'Canale: ' + c.name, '', 'Usa /analyze?ch=' + c.slug + ' per analisi completa', ''];
  const tryP = async (label, fn) => {
    const t0 = Date.now();
    try { const txt = await fn(); L.push('— ' + label + ' (' + (Date.now()-t0) + 'ms) —'); L.push('OK | ' + playlistStats(txt)); }
    catch (e) { L.push('— ' + label + ' —'); L.push('ERR: ' + (e?.message || e)); }
    L.push('');
  };
  if (c.vavoo||c.vavooId||c.vid) await tryP('VAVOO', async () => {
    const vu = await vavooResolve(c.vavoo, c.vavooId||c.vid); if (!vu) throw new Error('non risolto');
    const r = await fetchT(vu, { headers: vavooHeaders() }, 3000); if (!r.ok) throw new Error('HTTP '+r.status);
    return await r.text();
  });
  if (c.ntv) await tryP('NTV', async () => (await ntvPlaylist(c.ntv)).txt);
  if (c.daddy) await tryP('DADDY', async () => {
    const du = await daddyResolve(c.daddy); if (!du) throw new Error('non risolto');
    const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 3000); if (!r.ok) throw new Error('HTTP '+r.status);
    return await r.text();
  });
  return L.join('\n');
}
async function analyze(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-f1';
  const c = findCh(q); if (!c) return 'Canale non trovato\n\n' + elencoCanali();
  const L = ['═══════════════════════════════', 'ANALISI COMPLETA: ' + c.name, '═══════════════════════════════', ''];
  const analyzeSrc = async (label, getTxt) => {
    L.push('───────────────────────────────');
    L.push('📡 ' + label);
    L.push('───────────────────────────────');
    try {
      const t0 = Date.now(); const txt = await getTxt(); const dt = Date.now() - t0;
      const isMaster = /#EXT-X-STREAM-INF/.test(txt);
      const hasMap = txt.includes('#EXT-X-MAP');
      L.push('✅ Caricata in ' + dt + 'ms');
      L.push('   Tipo: ' + (isMaster ? 'MASTER' : 'MEDIA'));
      L.push('   fMP4: ' + (hasMap ? 'SÌ' : 'NO (MPEG-TS)'));
      if (isMaster) {
        const lines = txt.split(/\r?\n/); const vars = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            const codecs = (lines[i].match(/CODECS="([^"]+)"/) || [])[1] || '';
            const res = (lines[i].match(/RESOLUTION=([\dx]+)/) || [])[1] || '';
            const bw = (lines[i].match(/BANDWIDTH=(\d+)/) || [])[1] || '0';
            vars.push({ idx: vars.length, codecs, res, bw, h264: /avc1/i.test(codecs), hevc: /hvc1|hev1/i.test(codecs) });
          }
        }
        const h264n = vars.filter(v => v.h264).length, hevcn = vars.filter(v => v.hevc).length;
        L.push('   Varianti: ' + vars.length + ' (H.264:' + h264n + ' HEVC:' + hevcn + ')');
        vars.forEach(v => L.push(`     [${v.idx}] ${v.h264?'✅H.264':v.hevc?'⚠️HEVC':'❓'} | ${v.res} | ${Math.round(v.bw/1000)}kbps | "${v.codecs}"`));
        if (h264n === 0 && hevcn > 0) {
          L.push(''); L.push('   ❗❗❗ TUTTE LE VARIANTI SONO HEVC!');
          L.push('   Il tuo player non supporta HEVC → SCHERMO NERO');
          L.push('   Soluzioni: VLC, MPV, MX Player');
        } else if (h264n > 0) {
          L.push(''); L.push('   💡 Prova: /live?ch=' + c.slug + '&force_h264=1&fast=1');
        }
      }
    } catch (e) { L.push('❌ ERRORE: ' + (e?.message || e)); }
    L.push('');
  };
  if (c.ntv) await analyzeSrc('NTV (ID ' + c.ntv + ')', async () => (await ntvPlaylist(c.ntv)).txt);
  if (c.vavoo||c.vavooId||c.vid) await analyzeSrc('VAVOO', async () => {
    const vu = await vavooResolve(c.vavoo, c.vavooId||c.vid); if (!vu) throw new Error('non risolto');
    const r = await fetchT(vu, { headers: vavooHeaders() }, 3000); if (!r.ok) throw new Error('HTTP '+r.status);
    return await r.text();
  });
  if (c.daddy) await analyzeSrc('DADDY (ID ' + c.daddy + ')', async () => {
    const du = await daddyResolve(c.daddy); if (!du) throw new Error('non risolto');
    const r = await fetchT(du, { headers: getBrowserHeaders('https://thedaddy.li/') }, 3000); if (!r.ok) throw new Error('HTTP '+r.status);
    return await r.text();
  });
  L.push('═══════════════════════════════');
  L.push('📋 AZIONI PER AVVIO VELOCE');
  L.push('═══════════════════════════════');
  L.push('');
  L.push('🚀 /live?ch=' + c.slug + '&fast=1');
  L.push('🎯 /live?ch=' + c.slug + '&fast=1&force_h264=1');
  L.push('🛡️  /live?ch=' + c.slug + '&safe=1');
  L.push('📋 /live?ch=' + c.slug + '&list_variants=1');
  return L.join('\n');
}

// === UTILITY ===
function playlistStats(txt) {
  const p = parseMediaPl(txt);
  if (p.isMaster) return 'master playlist';
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs, false);
  const total = durs.reduce((a,b) => a+b, 0);
  return p.segs.length + ' segs / ' + total.toFixed(1) + 's | finestra ' + plan.count + '/' + plan.sum.toFixed(1) + 's' + (p.map ? ' | fMP4' : ' | TS');
}
const VER = 'TVNOW-CF v8.5 Fast';
const logs = [];
function log(m) { logs.push(new Date().toISOString().slice(11,19) + ' ' + m); if (logs.length > 40) logs.shift(); }
let reqStats = { day: new Date().toISOString().slice(0,10), live: 0, seg: 0 };
function countReq(kind) {
  const d = new Date().toISOString().slice(0,10);
  if (d !== reqStats.day) reqStats = { day: d, live: 0, seg: 0 };
  reqStats[kind]++;
}
function debug() {
  const L = [VER, 'NTV=' + tokenCache.size + ' Daddy=' + daddyCache.size + ' VavooURL=' + vavooURLCache.size];
  const vm = vavooMapGet(); L.push('Vavoo map: ' + (vm ? vm.size : 'non caricata'));
  L.push('Delay: normale ' + DELAY_MIN + '-' + DELAY_TARGET + 's | FAST ' + DELAY_FAST_MIN + '-' + DELAY_FAST_TARGET + 's');
  L.push('Oggi: live=' + reqStats.live + ' seg=' + reqStats.seg);
  L.push('Log:\n  ' + (logs.slice(-8).join('\n  ') || '(vuoti)'));
  return L.join('\n');
}
function uso(P) {
  return [VER, '',
    'Base: /live?ch=<slug>',
    '🚀 AVVIO VELOCE: aggiungi &fast=1',
    'Parametri: &fast=1 &force_h264=1 &safe=1 &variant=N &list_variants=1 &p=ntv,vavoo,daddy',
    'Tools: /analyze?ch=X /diag?ch=X /checkseg?s=ntv&ch=ID /vmap /probe?ch=X /debug /ch',
    '',
    'Esempi:',
    '  ' + P + '/live?ch=sky-sport-f1&fast=1&force_h264=1',
    '  ' + P + '/live?ch=rsi-la-2&p=vavoo&fast=1',
    '  ' + P + '/analyze?ch=sky-sport-tennis'
  ].join('\n');
}
function TXT() { return { 'content-type': 'text/plain; charset=utf-8', ...CORS() }; }
function HLS_NO_CACHE() {
  return { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-cache, no-store, must-revalidate', 'pragma': 'no-cache', 'expires': '0', ...CORS() };
}
function CORS() { return { 'access-control-allow-origin': '*' }; }
function R(body, status, headers) {
  const h = Object.assign({ 'content-type': 'text/plain' }, headers || {});
  if (status === 302) delete h['content-type'];
  return new Response(body, { status: status || 200, headers: h });
}
async function rawu(u) {
  const t = u.searchParams.get('u'); if (!t) return R('uso: /rawu?u=<url>', 200, TXT());
  const h = getBrowserHeaders(u.searchParams.get('ref') || 'https://thedaddy.li/');
  if (u.searchParams.get('o')) h['Origin'] = u.searchParams.get('o');
  let r; try { r = await fetchT(t, { headers: h, redirect: 'follow' }, 8000); }
  catch (e) { return R('ERR: ' + (e?.message || e), 200, TXT()); }
  let body = ''; try { body = await r.text(); } catch { body = '(no body)'; }
  return R('status ' + r.status + ' | len ' + body.length + '\n' + body.slice(0, 2000), 200, TXT());
}
async function fetchT(url, opt, ms) {
  const o = Object.assign({}, opt || {});
  if (ms && typeof AbortController !== 'undefined') {
    const ac = new AbortController();
    const t = setTimeout(() => { try { ac.abort(); } catch {} }, ms);
    o.signal = ac.signal;
    try { return await fetch(url, o); } finally { clearTimeout(t); }
  }
  return fetch(url, o);
}
// ███ FINE TVNOW-CF v8.5 Fast — COMPLETO ███
