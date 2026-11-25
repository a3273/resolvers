// ============================================================================
// TVNOW-CF v10.17 - Worker HLS re-streamer (NTV / Vavoo / Daddy)
// Deploy: https://resolvers.simone-scorrano-2011.workers.dev
//
// Regole stabili:
// - Logica di risoluzione provider intatta. Daddy = SOLO edge URL stabili
//   (edge.wedd48c.top, token nel contenuto): edge giu -> Daddy KO 60s,
//   NIENTE fallback embed (relay VOD vecchi = stream congelato).
// - Delay UNIFORME ~30s (v10.17, ExoPlayer/buffer) su BORDI SEGMENTO:
//   offset EXT-X-START solo su keyframe; offset dentro il GOP = video
//   grigio/corrotto. Floor: il ritardo di FONTE (PDT) si somma.
// - Filtro H264 (v10.17): variant H265 scartate dal master e loggate.
// - Stabilita prima del delay.
// - Canali indipendenti: cache/stato per canale|provider, ordine adattivo.
// - Niente recap "FIX vX" nell output; storico solo qui nei commenti.
//
// Architettura rapida:
// - SUB_BUDGET 40 fetch/invocazione (limite CF 50): warm/prefetch si fermano prima.
// - warmNext: max 1 batch/10s; heartbeat 5min riscalda 6 canali.
// - Playlist upstream: bust 2s anti-cache CDN + single-flight 3s + guardia
//   anti-freeze (checkFreshOrThrow su tutti i provider).
// - Segmenti: Cache API 120s chiave senza token -> edge CF (bust 30s) -> origine;
//   prefetch 2 seg; rete di sicurezza avvio (plCache 60s se tutti KO).
// - Lag fonte via PDT (lagMemo): relay lenti oltre 45s in coda 5min; senza PDT
//   la misura e muta (si esclude la fonte non fidata).
// - Vavoo: URL signed senza bust (fetchPlaylistSmart), TTL 120s, host CDN fisso
//   al posto di IP nudi (CF 1003).
// - /dump?ch=x&p=y : playlist servita come testo (diagnosi remota).
// ============================================================================
let MODULE_CTX = null; let SUB_BUDGET = 40;
const subFree = n => SUB_BUDGET >= n;
const subSpend = n => { SUB_BUDGET = Math.max(0, SUB_BUDGET - n); };
const bg = fn => { try { if (MODULE_CTX && MODULE_CTX.waitUntil) MODULE_CTX.waitUntil(Promise.resolve().then(fn).catch(() => {})); } catch (e) {} };
export default { async fetch(req, env, ctx) {
    MODULE_CTX = ctx || null;
    SUB_BUDGET = 40;   // v10.13 AA: budget azzerato a ogni nuova invocazione
    heartbeat();
    const u = new URL(req.url);
    const P = u.origin; const path = u.pathname;
    if (req.method === 'HEAD' || req.method === 'OPTIONS')
      return R('OK', 200, { 'content-type':'text/plain; charset=utf-8', ...CORS() });
    try { switch (path) {
        case '/live':  return await live(u, P, null);
        case '/ntv':   return await live(u, P, 'ntv');
        case '/vavoo': return await live(u, P, 'vavoo');
        case '/daddy': return await live(u, P, 'daddy');
        case '/seg':   return await seg(u, req);
        case '/player': return await player(u, P);
        case '/warm':  return await warm();
        case '/rawu':  return await rawu(u);
        case '/vmap':  return R(await vmap(), 200, TXT());
        case '/ch':    return R(elencoCanali(), 200, TXT());
        case '/probe': return R(await probe(u), 200, TXT());
        case '/dump':  { const rr = await live(u, P, u.searchParams.get('p')); const bb = await rr.text(); return R(bb, 200, TXT()); }
        case '/diag':  return R(await diag(u), 200, TXT());
        case '/debug': return R(debug(), 200, TXT());
        case '/checkseg': return await checkseg(u);
        case '/segtest':  return await segtest(u);
        case '/ip': {
          const ip = req.headers.get('cf-connecting-ip') || '';
          const r = await fetchT('https://www.cloudflare.com/cdn-cgi/trace', {}, 8000);
          return R('client: ' + ip + '\negress:\n' + (r.ok ? await r.text() : 'err'), 200, TXT());
        }
        case '/': return R(uso(P), 200, TXT());
        default:  return R('404\n\n' + uso(P), 200, TXT());
      }
    } catch (e) {
      return R('ERRORE: ' + (e && e.message ? e.message : String(e)), 200, TXT());
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(warm()); }
};
// --- CONFIGURAZIONE --------------------------------------------------------
// v10.17: TARGET UNIFORME ~30s su TUTTI i provider (richiesta esperta: ExoPlayer
// non decodifica H265 -> serve margine per il filtro H264 e i buffer dei player).
// Ritardo sotto: delay totale = ritardo di FONTE (PDT, misurato) + finestra.
const PROV_DELAY = {
  ntv:   { target: 28, start: 30 },   // finestra ~30s -> EXT-X-START -> delay ~28-32s
  daddy: { target: 28, start: 30 },   // idem
  vavoo: { target: 28, start: 30 }    // idem (prima 17-27s: unificato a richiesta)
}; const MIN_SEGS = 2;
const delayCfg = prov => PROV_DELAY[prov] || { target: 24, start: 20 };
const PREFETCH_SEGS = 2;                  // v10.13 CC: 2 (era 1): i 2 seg piu' nuovi gia' in cache -> zero micro-scatti
const STALE_FACTOR = 6, MAX_BUFFER_SECS = 40;
const SEG_CACHE_TTL = 60;                 // v10.17: 60s (era 30): i segmenti pubblicati non cambiano mai -> piu' cache = meno scatti
const BUST_MS = 30000;                    // FIX: bust stabile 30s (era assente)
const SEGFAIL_TTL = 3*60*1000, SEGFAIL_MAX = 3, SEGFAIL_EARLY = 1;
const PL_CACHE_TTL = 2000, RESOLVE_BUDGET = 8000, STATE_STALE_TTL = 15*60*1000; // v10.13 BB: resolve cap 8s (era 12s)
const CB_FAIL_WIN = 120*1000, CB_FAIL_TH = 6, CB_COOLDOWN = 50*1000;
const NTV_REFRESH_MARGIN = 900, VAVOO_URL_TTL = 120*1000; // v10.10 T: 120s (era 240s): la URL vavoo e' anche la chiave cache CDN della playlist
const DADDY_TTL = 10*60*1000, VAVOO_HEALTH_TTL = 15*60*1000, VAVOO_MAP_TTL = 8*3600*1000;
const MAX_TOKEN_CACHE = 80, MAX_DADDY_CACHE = 150;
const VER = 'TVNOW-CF v10.17';
const DADDY_EDGE_BASE = 'https://edge.wedd48c.top';
const DADDY_EDGE_IDS = ['869','461','870','576','462','875','460','577','575','574','877','878','879','871','872','873','860','861','862','859','864','865','867','868','863','880'];
const DADDY_EDGE_FAIL_TTL = 60 * 1000;    // edge giu -> canale Daddy KO 60s (niente embed, v10.15)
const PLAYLIST_FRESH_MS = 3000;           // v10.13 CC: single-flight 4s -> 3s (finestra anunciata piu' fresca)
const SEG_API_TTL = 120;                  // Cache API segmenti: sopravvive alla rotazione token (120s)
const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
]; function uaFor(key) {
  const s = String(key || 'default');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return UA_LIST[h % UA_LIST.length];
}
// --- CANALI ----------------------------------------------------------------
const CHANNELS = [
  { slug:'rsi-la-1', name:'RSI La 1', ntv:'', vavoo:'rsi la 1', daddy:'', vid6:'2455610203', vid7:'2290395046' },
  { slug:'rsi-la-2', name:'RSI La 2', ntv:'', vavoo:'rsi la 2', daddy:'', vid6:'3590183307', vid7:'3475299702' },
  { slug:'sky-sport-serie-a', name:'Sky Sport Serie A', ntv:'', vavoo:'sky sport serie a', daddy:'880', vid6:'2077387085', vid7:'' },
  { slug:'sky-sport-24', name:'Sky Sport 24', ntv:'869', vavoo:'sky sport 24', daddy:'869', vid6:'2775802255', vid7:'3445562519' },
  { slug:'sky-sport-uno', name:'Sky Sport Uno', ntv:'461', vavoo:'sky sport uno', daddy:'461', vid6:'210669162', vid7:'3192996672' },
  { slug:'sky-sport-calcio', name:'Sky Sport Calcio', ntv:'870', vavoo:'sky sport calcio', daddy:'870', vid6:'1665920101', vid7:'449990998' },
  { slug:'sky-sport-tennis', name:'Sky Sport Tennis', ntv:'576', vavoo:'sky sport tennis', daddy:'576', vid6:'2100771782', vid7:'78546677' },
  { slug:'sky-sport-arena', name:'Sky Sport Arena', ntv:'462', vavoo:'sky sport arena', daddy:'462', vid6:'3007400791', vid7:'2555960713' },
  { slug:'sky-sport-basket', name:'Sky Sport Basket', ntv:'875', vavoo:'sky sport basket', daddy:'875', vid6:'2711959620', vid7:'326825326' },
  { slug:'sky-sport-max', name:'Sky Sport Max', ntv:'460', vavoo:'sky sport max', daddy:'460', vid6:'2066326916', vid7:'' },
  { slug:'sky-sport-f1', name:'Sky Sport F1', ntv:'577', vavoo:'sky sport f1', daddy:'577', vid6:'4246774056', vid7:'2289038972' },
  { slug:'sky-sport-motogp', name:'Sky Sport MotoGP', ntv:'575', vavoo:'sky sport motogp', daddy:'575', vid6:'3036316886', vid7:'2090703806' },
  { slug:'sky-sport-golf', name:'Sky Sport Golf', ntv:'574', vavoo:'sky sport golf', daddy:'574', vid6:'729945219', vid7:'3897711086' },
  { slug:'dazn-1', name:'DAZN 1', ntv:'877', vavoo:'dazn 1', daddy:'877', vid6:'1376440573', vid7:'2745635299' },
  { slug:'eurosport-1', name:'Eurosport 1', ntv:'878', vavoo:'eurosport 1', daddy:'878', vid6:'3481346857', vid7:'3448075317' },
  { slug:'eurosport-2', name:'Eurosport 2', ntv:'879', vavoo:'eurosport 2', daddy:'879', vid6:'2283887097', vid7:'2317684453' },
  { slug:'sky-calcio-251', name:'Sky Calcio 251', ntv:'871', vavoo:'', daddy:'871', vid6:'', vid7:'' },
  { slug:'sky-calcio-252', name:'Sky Calcio 252', ntv:'872', vavoo:'', daddy:'872', vid6:'', vid7:'' },
  { slug:'sky-calcio-253', name:'Sky Calcio 253', ntv:'873', vavoo:'', daddy:'873', vid6:'', vid7:'' },
  { slug:'sky-cinema-uno', name:'Sky Cinema Uno', ntv:'860', vavoo:'', daddy:'860', vid6:'2872151911', vid7:'1759625738' },
  { slug:'sky-cinema-action', name:'Sky Cinema Action', ntv:'861', vavoo:'', daddy:'861', vid6:'3812796171', vid7:'1144128726' },
  { slug:'sky-cinema-comedy', name:'Sky Cinema Comedy', ntv:'862', vavoo:'', daddy:'862', vid6:'500203271', vid7:'3131104474' },
  { slug:'sky-cinema-collection', name:'Sky Cinema Collection', ntv:'859', vavoo:'', daddy:'859', vid6:'', vid7:'3525837057' },
  { slug:'sky-cinema-romance', name:'Sky Cinema Romance', ntv:'864', vavoo:'', daddy:'864', vid6:'2890008905', vid7:'1281264885' },
  { slug:'sky-cinema-family', name:'Sky Cinema Family', ntv:'865', vavoo:'', daddy:'865', vid6:'415795144', vid7:'3216516117' },
  { slug:'sky-cinema-drama', name:'Sky Cinema Drama', ntv:'867', vavoo:'', daddy:'867', vid6:'', vid7:'' },
  { slug:'sky-cinema-suspense', name:'Sky Cinema Suspense', ntv:'868', vavoo:'', daddy:'868', vid6:'1820997555', vid7:'3060043751' },
  { slug:'sky-crime', name:'Sky Crime', ntv:'863', vavoo:'', daddy:'863', vid6:'', vid7:'' },
  { slug:'sky-serie', name:'Sky Serie', ntv:'880', vavoo:'', daddy:'880', vid6:'836680112', vid7:'' }
]; const ALIASES = {
  'dazn':'dazn-1','dazn-zona':'dazn-1','zona-dazn':'dazn-1','serie-a':'sky-sport-serie-a',
  'sky-calcio-1':'sky-calcio-251','sky-calcio-2':'sky-calcio-252','sky-calcio-3':'sky-calcio-253',
  'sky-sport-24-ntv':'sky-sport-24','sky-sport-uno-italy':'sky-sport-uno'
};
// --- UTILITIES -------------------------------------------------------------
const norm = s => String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const BY_KEY = (() => { const m = new Map();
  for (const c of CHANNELS) { m.set(c.slug, c);
    m.set(norm(c.name), c);
    if (c.ntv) m.set(c.ntv, c);
    if (c.daddy) m.set('d'+c.daddy, c);
  }
  for (const [a, s] of Object.entries(ALIASES)) {
    const c = m.get(s); if (c) m.set(a, c);
  }
  return m; })(); function findCh(q) {
  let k = norm(q);
  if (BY_KEY.has(k)) return BY_KEY.get(k);
  k = k.replace(/-ntv$/,'').replace(/-daddy$/,'');
  return BY_KEY.get(k) || null;
}
function elencoCanali() {
  const L = ['CANALI (' + CHANNELS.length + ') - /live?ch=<slug>'];
  for (const c of CHANNELS)
    L.push('  ' + c.slug.padEnd(24) + ' ntv=' + String(c.ntv||'-').padEnd(4) + ' vavoo=' + (c.vavoo||'-').padEnd(18) + ' daddy=' + (c.daddy||'-').padEnd(4));
  return L.join('\n'); }
// --- STATO GLOBALE ---------------------------------------------------------
const tokenCache = new Map(), daddyCache = new Map(), vavooURLCache = new Map();
const vavooHealth = new Map(), segFails = new Map();
const cbFails = new Map(), cbCooldown = new Map();
const plCache = new Map(), plState = new Map(), upFresh = new Map();
const daddyEdgeFail = new Map();          // v10.7: memo edge URL fallita per id
const plFetchCache = new Map();           // v10.7: single-flight fetch playlist upstream
const SEGCACHE = (typeof caches !== 'undefined') ? caches.default : null; // v10.7 L
let segStat = { apiHits: 0, origin: 0 }; // v10.7: preservazione richieste visibile in /debug
const provScore = new Map();
const PROV_SCORE_TTL = 10 * 60 * 1000;
const noteProv = (slug, prov, ok) => { if (slug && prov) provScore.set(slug + '|' + prov, { ok: !!ok, t: Date.now() }); };
const provRank = (slug, prov) => {
  const e = provScore.get((slug || '_') + '|' + (prov || '_'));
  if (!e || Date.now() - e.t > PROV_SCORE_TTL) return 1; // neutro
  return e.ok ? 2 : 0;                                   // ok di recente -> primo; ko -> ultimo
};
let ntvStats = { resolve:0, refresh:0, err:0 };
const logs = [];
const log = m => { logs.push(new Date().toISOString().slice(11,19) + ' ' + m); if (logs.length > 80) logs.shift(); };
let reqStats = { day: new Date().toISOString().slice(0,10), live:0, seg:0 };
const countReq = k => {
  const d = new Date().toISOString().slice(0,10);
  if (d !== reqStats.day) reqStats = { day:d, live:0, seg:0 };
  reqStats[k]++; };
// --- CIRCUIT BREAKER -------------------------------------------------------
const cbKey = (slug, prov) => (slug || '_') + '|' + (prov || '_');
function cbRecordFail(slug, prov) {
  if (!prov) return;
  const key = cbKey(slug, prov);
  const now = Date.now();
  const arr = (cbFails.get(key) || []).filter(t => now - t < CB_FAIL_WIN);
  arr.push(now); cbFails.set(key, arr);
  if (arr.length >= CB_FAIL_TH && !cbCooldown.has(key)) {
    cbCooldown.set(key, now + CB_COOLDOWN);
    log('CB ' + key + ' cooldown ' + CB_COOLDOWN/1000 + 's');
  }
}
function cbInCooldown(slug, prov) {
  const key = cbKey(slug, prov);
  const until = cbCooldown.get(key);
  if (!until) return false;
  if (Date.now() >= until) { cbCooldown.delete(key); cbFails.delete(key); return false; }
  return true; }
const cbClear = (slug, prov) => { const k = cbKey(slug, prov); cbFails.delete(k); cbCooldown.delete(k); };
// --- ANTI-BLOCK SEGMENTI ---------------------------------------------------
const recordSegFail = (ch, prov) => {
  if (!ch || !prov) return;
  const key = ch + '|' + prov, now = Date.now();
  const arr = (segFails.get(key) || []).filter(t => now - t < SEGFAIL_TTL);
  arr.push(now); segFails.set(key, arr);
  if (arr.length >= SEGFAIL_MAX) log('segfail ' + key + ' x' + arr.length);
};
const segFailCount = (ch, prov) => {
  if (!ch || !prov) return 0; const now = Date.now();
  return (segFails.get(ch + '|' + prov) || []).filter(t => now - t < SEGFAIL_TTL).length;
};
const clearSegFails = (ch, prov) => { if (ch && prov) segFails.delete(ch + '|' + prov); };
// --- CLEANUP ---------------------------------------------------------------
let lastCleanup = 0; function cleanupStaleState() {
  const now = Date.now();
  if (now - lastCleanup < 90000) return;
  lastCleanup = now;
  const cutoff = now - STATE_STALE_TTL;
  for (const [k, v] of plState) if (v.t < cutoff) plState.delete(k);
  for (const [k, v] of upFresh) if (v.t < cutoff) upFresh.delete(k);
  for (const [k, h] of vavooHealth) if (h.t < cutoff) vavooHealth.delete(k);
  for (const [k, s] of provScore) if (s.t < cutoff) provScore.delete(k);
  for (const [k, t] of daddyEdgeFail) if (Date.now() - t > 2 * DADDY_EDGE_FAIL_TTL) daddyEdgeFail.delete(k);
  for (const [k, e] of plFetchCache) if (!e.inflight && (!e.txt || Date.now() - e.t > 30000)) plFetchCache.delete(k);
  for (const [k, arr] of cbFails) if (!arr.length) cbFails.delete(k);
  for (const [k, e] of plCache) if (Date.now() - e.t > 60000) plCache.delete(k);
  for (const [k, e] of vavooURLCache) if (Date.now() > e.exp) vavooURLCache.delete(k);
  for (const [k, arr] of segFails) {
    const near = arr.filter(t => now - t < SEGFAIL_TTL);
    if (near.length) segFails.set(k, near); else segFails.delete(k);
  }
  for (const [k, t] of noBustHosts) if (now - t > NO_BUST_TTL) noBustHosts.delete(k);
  for (const [k, e] of lagMemo) if (now - e.t > 2 * LAG_TTL_MS) lagMemo.delete(k);
}
function getPlState(key) { let st = plState.get(key);
  if (!st) { st = { lastSeq:-1, lastUpSeq:-1, base:'', discont:false, t:Date.now() }; plState.set(key, st); }
  return st; }
// --- VAVOO HEALTH ----------------------------------------------------------
function getVavooHealth(slug) {
  const h = vavooHealth.get(slug);
  if (!h) return { prefer7:false, t:0, fails6:0, fails7:0 };
  if (Date.now() - h.t > VAVOO_HEALTH_TTL) { vavooHealth.delete(slug); return { prefer7:false, t:0, fails6:0, fails7:0 }; }
  return h; }
function updateVavooHealth(slug, num) {
  const h = getVavooHealth(slug);
  h.t = Date.now(); h.prefer7 = (num === 7);
  if (num === 6 || num === 0) h.fails6 = 0;
  if (num === 7 || num === 0) h.fails7 = 0;
  vavooHealth.set(slug, h); }
// v10.16 FIX: segfail da SEGMENTI non toccava la preferenza ID: canali con vid6
// upstream rotto (es. 502 sui .ts) restavano bloccati per sempre sul 6.
function vavooFlip(slug) {
  const h = getVavooHealth(slug);
  h.t = Date.now(); h.prefer7 = !h.prefer7; h.fails6 = 0; h.fails7 = 0;
  vavooHealth.set(slug, h);
  log('vavoo ' + slug + ': cambio id non riuscito (segs KO ripetuti) -> ' + (h.prefer7 ? 'id7' : 'id6')); }
function recordVavooFail(slug, idNum) {
  const h = getVavooHealth(slug);
  h.t = Date.now();
  if (idNum === 6) h.fails6++; else h.fails7++;
  if (h.fails6 >= 3) h.prefer7 = true;
  if (h.fails7 >= 3) h.prefer7 = false;
  vavooHealth.set(slug, h); }
const plCacheGet = ck => { const e = plCache.get(ck);
  if (e && Date.now() - e.t < PL_CACHE_TTL) return e.txt;
  if (e) plCache.delete(ck); return null;
};
const plCacheSet = (ck, txt) => plCache.set(ck, { txt, t:Date.now() });
function checkFreshOrThrow(key, upSeq, upTarget, prov) {
  const now = Date.now(); const st = upFresh.get(key);
  if (!st || upSeq !== st.seq) { upFresh.set(key, { seq:upSeq, t:now }); return; }
  const maxAge = Math.max(20, (upTarget || 4) * STALE_FACTOR) * 1000;
  if (now - st.t > maxAge) throw new Error(prov + ' congelata (seq ' + upSeq + ' da ' + Math.round((now-st.t)/1000) + 's)');
}
// --- v10.7 L/M: cache normalizzata segmenti + single-flight playlist -------
const SEG_TOKEN_PARAM = /^(token|t$|_t$|e$|s$|sig|signature|auth|key|expires|exp|md5|wmsauthsign|hmac|st)$/i;
function segCacheKey(abs) { const qi = abs.indexOf('?');
  if (qi < 0) return abs;
  const base = abs.slice(0, qi);
  const keep = [];
  for (const kv of abs.slice(qi + 1).split('&')) {
    const name = (kv.split('=')[0] || '').toLowerCase();
    if (SEG_TOKEN_PARAM.test(name)) continue;
    keep.push(kv); }
  return keep.length ? base + '?' + keep.join('&') : base;
}
const PL_BUST_MS = 2000; function plBust(url) {
  const b = Math.floor(Date.now() / PL_BUST_MS) * PL_BUST_MS;
  return url + (url.includes('?') ? '&' : '?') + '_b=' + b;
}
const NO_BUST_TTL = 30 * 60 * 1000;
const noBustHosts = new Map();
const CF_NO_CACHE_PL = () => ({ cf: { cacheTtl: 0, cacheEverything: false } });
async function fetchPlaylistSmart(url, headers, timeoutMs) {
  const host = String(url).split('/')[2] || '';
  const banned = noBustHosts.get(host) || 0;
  const canBust = Date.now() - banned > NO_BUST_TTL;
  if (canBust) {
    const r = await fetchT(plBust(url), Object.assign({ headers }, CF_NO_CACHE_PL()), timeoutMs);
    if (r.status === 403 || r.status === 400) { noBustHosts.set(host, Date.now()); }
    else return r; }
  return await fetchT(url, Object.assign({ headers }, CF_NO_CACHE_PL()), timeoutMs);
}
function fetchUpstreamPl(key, url, headers, timeoutMs) {
  const now = Date.now();
  const e = plFetchCache.get(key);
  if (e && e.txt && now - e.t < PLAYLIST_FRESH_MS) return Promise.resolve(e.txt);
  if (e && e.inflight) return e.inflight;
  const p = (async () => {
    const r = await fetchPlaylistSmart(url, headers, timeoutMs);
    const txt = r.ok ? await r.text() : '';
    if (!txt.includes('#EXTM3U')) throw new Error('upstream ' + r.status);
    return txt; })();
  plFetchCache.set(key, { t: now, inflight: p });
  return p.then(txt => {
    plFetchCache.set(key, { t: Date.now(), txt, inflight: null });
    return txt; }).catch(err => {
    plFetchCache.delete(key); throw err;
  }); }
function isVideoCt(ct) { ct = String(ct || '').toLowerCase(); return /mpegurl|mp2t|mp4|octet-stream|video\//.test(ct) && !/html|json|xml/.test(ct); }
async function fetchSegmentWithCache(target, h, range) {
  const key = segCacheKey(target);
  if (SEGCACHE && !range) { try {
      const hit = await SEGCACHE.match(key);
      if (hit) { segStat.apiHits++;
        const hh = { 'content-type': hit.headers.get('content-type') || 'video/mp2t', 'cache-control': 'public, max-age=' + SEG_CACHE_TTL, 'access-control-allow-origin': '*' };
        const cl = hit.headers.get('x-content-length'); if (cl) hh['content-length'] = cl;
        return { resp: new Response(hit.body, { status: 200, headers: hh }), fromCache: 'api' };
      }
    } catch (e) {}
  }
  const r = await fetchT(target, { headers: h, cf: (range ? { cacheTtl: 0 } : { cacheTtl: SEG_CACHE_TTL, cacheEverything: true }) }, 20000);
  if (r.status === 200) segStat.origin++;
  if (SEGCACHE && !range && r.status === 200 && isVideoCt(r.headers.get('content-type'))) {
    try {
      const stored = new Response(r.clone().body, {
        headers: {
          'content-type': r.headers.get('content-type') || 'video/mp2t',
          'cache-control': 'public, max-age=' + SEG_API_TTL,
          'x-content-length': r.headers.get('content-length') || ''
        }
      });
      bg(() => SEGCACHE.put(key, stored));
    } catch (e) {}
  }
  return { resp: r, fromCache: 'origin' };
}
function emitPlaylist(ck, slug, prov, txt, baseUrl, ctx) {
  const p = parseMediaPl(txt);
  if (!p.isMaster && p.segs.length) checkFreshOrThrow(slug + '|' + prov, p.upSeq, p.upTarget, prov);
  if (!p.isMaster) noteSrcLag(ctx && ctx.stateKey ? ctx.stateKey : slug + '|' + prov, srcLagOf(p));
  const out = rewriteAny(txt, baseUrl, Object.assign({}, ctx, { stateKey: slug + '|' + prov }));
  if (!p.isMaster && PREFETCH_SEGS > 0) {
    const news = p.segs.slice(-PREFETCH_SEGS);
    for (const s of news) { try {
        const abs = absSegUrl(s.url, baseUrl);
        bg(() => warmSeg(abs, ctx));
      } catch (e) {}
    }
  }
  plCacheSet(ck, out);
  return R(out, 200, HLS_NO_CACHE());
}
async function warmSeg(abs, ctx) {
  if (!subFree(1)) return;   // v10.13 AA: il prefetch non mangia il budget
  subSpend(1);
  const ref = (ctx && ctx.ref) || 'https://thedaddy.li/';
  const h = getBrowserHeaders(ref, ((ctx && ctx.ch) || '') + '|' + ((ctx && ctx.prov) || ''));
  const o = ctx && ctx.origin; if (o) h['Origin'] = o;
  if (ref.includes('thedaddy') || ref.includes('dembed')) { h['Referer'] = 'https://dembed.st/'; h['Origin'] = 'https://dembed.st'; }
  try {
    const withBust = abs + (abs.includes('?') ? '&' : '?') + '_t=' + (Math.floor(Date.now() / BUST_MS) * BUST_MS);
    await fetchSegmentWithCache(withBust, h, null);
  } catch (e) {}
}
// --- v10.11 X: HEARTBEAT 5 MIN (uptime: canali sempre pronti) ---------------
const HEARTBEAT_MS = 5 * 60 * 1000;
let lastHeartbeat = 0; function heartbeat() {
  const now = Date.now();
  if (now - lastHeartbeat < HEARTBEAT_MS) return;
  lastHeartbeat = now;
  log('heartbeat: warm 6 canali (cursor ' + warmCursor + ')');
  warmNext(6); }
// --- v10.10 V: WARM PROGRESSIVO CON CURSORE (tutti i canali pronti in pochi accessi) ---
const WARM_BATCH = 2;
let warmCursor = 0, lastWarm = 0;
function warmNext(n) {
  const n2 = Math.min(n, Math.max(0, Math.floor(SUB_BUDGET / 6)));
  if (!n2) return;
  if (Date.now() - lastWarm < 10 * 1000) return;
  lastWarm = Date.now(); subSpend(n2 * 6);
  const t0 = Date.now(); const jobs = [];
  for (let i = 0; i < n && i < CHANNELS.length; i++) {
    const c = CHANNELS[(warmCursor + i) % CHANNELS.length];
    jobs.push((async () => {
      try { if (c.ntv) await ntvToken(c.ntv, c.slug); } catch (e) {}
      try { if (c.daddy) await daddyResolve(c.daddy, c.slug); } catch (e) {}
      try { if (c.vavoo || c.vid6 || c.vid7) await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7); } catch (e) {}
    })()); }
  warmCursor = (warmCursor + n) % CHANNELS.length;
  const p = Promise.all(jobs).then(() => { log('warm batch ok (cur=' + warmCursor + ', ' + (Date.now()-t0) + 'ms)'); }).catch(() => {});
  if (MODULE_CTX) { try { MODULE_CTX.waitUntil(p); } catch (e) {} }
  return p; }
// --- v10.8 Q: ANTI-AFFATICAMENTO ZAPPING -----------------------------------
async function preWarmProv(p, c) {
  if (!subFree(4)) return;   // v10.13 AA: budget prima del lavoro opzionale
  subSpend(4); try {
    if (p === 'ntv' && c.ntv) await ntvToken(c.ntv, c.slug);
    else if (p === 'vavoo' && (c.vavoo || c.vid6 || c.vid7)) await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
    else if (p === 'daddy' && c.daddy) await daddyResolve(c.daddy, c.slug);
  } catch (e) {}
}
// --- PROVIDER NTV (INTATTO dalla v10.4) ------------------------------------
const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';
async function ntvToken(id, slug) {
  const now = Date.now() / 1000;
  const c = tokenCache.get(id);
  if (c && c.exp - now > NTV_REFRESH_MARGIN) return c;
  if (tokenCache.size > MAX_TOKEN_CACHE) {
    const ks = Array.from(tokenCache.keys());
    for (let i = 0; i < ks.length - MAX_TOKEN_CACHE; i++) tokenCache.delete(ks[i]);
  }
  ntvStats.resolve++;
  const r = await fetchT(NTV_API + id, { headers: getBrowserHeaders('https://tvnow247.today/', (slug || '') + '|ntv') }, 12000);
  if (!r.ok) { ntvStats.err++; cbRecordFail(slug, 'ntv'); throw new Error('ntv api ' + r.status); }
  const j = await r.json().catch(() => null);
  const m3u8 = j && (j.m3u8 || j.proxyPlaylistUrl || j.proxyPlayerUrl);
  if (!m3u8) { ntvStats.err++; cbRecordFail(slug, 'ntv'); throw new Error('ntv senza m3u8'); }
  const exp = +(String(m3u8).match(/[?&]e=(\d+)/) || [])[1] || (now + 3600);
  const entry = { m3u8, exp, ref: (j && j.referer) || 'https://tvnow247.today/' };
  tokenCache.set(id, entry); cbClear(slug, 'ntv');
  return entry; }
async function ntvPlaylist(id, slug) {
  let tk = await ntvToken(id, slug);
  let r = await fetchPlaylistSmart(tk.m3u8, getBrowserHeaders(tk.ref, (slug || '') + '|ntv'), 8000);
  let txt = r.ok ? await r.text() : '';
  if (!r.ok || r.status >= 500 || !txt.includes('#EXTM3U')) {
    tokenCache.delete(id); ntvStats.refresh++;
    tk = await ntvToken(id, slug);
    r = await fetchPlaylistSmart(tk.m3u8, getBrowserHeaders(tk.ref, (slug || '') + '|ntv'), 8000);
    txt = r.ok ? await r.text() : '';
  }
  if (!txt.includes('#EXTM3U')) throw new Error('ntv playlist ' + r.status + ' non-HLS');
  return { txt, ref: tk.ref, base: tk.m3u8 };
}
// --- PROVIDER DADDY (edge URL stabili; niente fallback embed v10.15) -------
async function daddyResolve(id, slug) {
  if (!id) return null; const now = Date.now();
  const cached = daddyCache.get(id);
  if (cached && cached.exp > now) return cached.url;
  if (daddyCache.size > MAX_DADDY_CACHE) {
    const ks = Array.from(daddyCache.keys());
    for (let i = 0; i < ks.length - MAX_DADDY_CACHE; i++) daddyCache.delete(ks[i]);
  }
  if (DADDY_EDGE_IDS.indexOf(String(id)) >= 0) {
    const failedAt = daddyEdgeFail.get(String(id)) || 0;
    if (Date.now() - failedAt > DADDY_EDGE_FAIL_TTL) {
      const eu = DADDY_EDGE_BASE + '/premium' + id + '/index.m3u8';
      daddyCache.set(id, { url: eu, exp: now + DADDY_TTL });
      return eu; }
    return null; }
  return null; }
function getBrowserHeaders(referer, uaKey) {
  return {
    'User-Agent': uaFor(uaKey || referer), 'Accept': '*/*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer, 'Origin': referer.replace(/\/$/, ''),
    'Sec-Fetch-Dest':'empty', 'Sec-Fetch-Mode':'cors', 'Sec-Fetch-Site':'cross-site',
    'Upgrade-Insecure-Requests':'1'
  }; }
// --- PROVIDER VAVOO (INTATTO dalla v10.4) ----------------------------------
const VAVOO_MIRRORS = ['https://geil.to','https://geil.app','https://geil.win','https://vavoo.to','https://kool.to','https://vavoo.net','https://kool.ws','https://huhu.to','https://oha.to','https://voltop.net'];
const VAVOO_SOURCES = ['https://raw.githubusercontent.com/aphrodite747/VvOo/main/index_Italy.m3u','https://raw.githubusercontent.com/BontAce/VVOOITV/main/index_Italy.m3u'];
let vavooMap = { map:null, t:0, src:'' };
const vavooMapGet = () => (vavooMap.map && Date.now() - vavooMap.t < VAVOO_MAP_TTL) ? vavooMap.map : null;
async function ensureVavooMap(force) {
  const cached = vavooMapGet();
  if (cached && !force) return cached;
  for (const src of VAVOO_SOURCES) {
    try {
      const r = await fetchT(src, { headers:{ 'User-Agent':'VAVOO/1.0' } }, 12000);
      if (!r.ok) continue;
      const t = await r.text();
      const m = new Map();
      for (const b of t.split('#EXTINF')) {
        const nm = (b.match(/tvg-name="([^"]+)"/) || [])[1];
        const id = (b.match(/vavoo\/(\d+)\.m3u8/) || [])[1];
        if (nm && id) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/, '')); if (k && !m.has(k)) m.set(k, id); }
      }
      if (m.size > 50) { vavooMap = { map:m, t:Date.now(), src }; return m; }
    } catch (e) {}
  }
  return cached; }
function vavooMapFind(query, m) {
  if (!m || !query) return null;
  const q = norm(query);
  if (m.has(q)) return m.get(q);
  const qTok = q.split('-').filter(Boolean);
  let best = null, bestScore = -1;
  for (const [k, id] of m) {
    const kTok = k.split('-').filter(Boolean);
    if (qTok.every(w => kTok.includes(w))) {
      const score = qTok.length - (kTok.length - qTok.length);
      if (score > bestScore) { bestScore = score; best = id; }
    }
  }
  return best; }
const vavooHeaders = extra => Object.assign({
  'User-Agent':'MediaHubMX/2', 'Accept':'application/json',
  'Origin':'https://vavoo.to', 'Referer':'https://vavoo.to/'
}, extra || {});
async function vavooResolveId(base, id) {
  const play = base + '/live/play/' + id;
  try {
    const r = await fetchT(base + '/live/resolve?url=' + encodeURIComponent(play), { headers: getBrowserHeaders(base + '/', base) }, 4000);
    if (r.ok) { const j = await r.json().catch(() => null); if (j && j.url) return j.url; }
  } catch (e) {}
  try {
    const r = await fetchT(base + '/mediahubmx-resolve.json', {
      method:'POST', headers: vavooHeaders({ 'Content-Type':'application/json', 'Origin':base, 'Referer':base + '/' }),
      body: JSON.stringify({ language:'de', region:'DE', url:play, clientVersion:'3.0.2' })
    }, 4000);
    if (r.ok) { const j = await r.json().catch(() => null); if (j && j.url) return j.url; }
  } catch (e) {}
  return null; }
async function vavooLiveFind(base, query) {
  try {
    const rl = await fetchT(base + '/mediahubmx-list.json', {
      method:'POST', headers: vavooHeaders({ 'Content-Type':'application/json', 'Origin':base, 'Referer':base + '/' }),
      body: JSON.stringify({ language:'it', region:'IT', clientVersion:'3.0.2', url:base + '/live' })
    }, 4000); if (!rl.ok) return null;
    const j = await rl.json().catch(() => null);
    const items = (j && (j.items || j.channels || j.entries)) || [];
    const tmp = new Map(); for (const it of items) {
      const nm = it.name || it.title || '';
      const iid = it.id || ((it.url || '').match(/play\/(\d+)/) || [])[1];
      if (nm && iid) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/, '')); if (k && !tmp.has(k)) tmp.set(k, String(iid)); }
    }
    return vavooMapFind(query, tmp);
  } catch (e) { return null; }
}
let vavooGoodHost = 'https://7jep2q6xee5pjrv.fu8oefd4v2dvlmaarur6crfp.com';
function vavooFixIpUrl(u) { const s = String(u || '');
  if (!/^http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\//.test(s)) return s;
  return s.replace(/^http:\/\/[^/]+\//, vavooGoodHost + '/');
}
const noteVavooGoodHost = (u) => {
  const m = String(u || '').match(/^https:\/\/([^/]+)\//);
  if (m && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(m[1])) vavooGoodHost = 'https://' + m[1];
};
async function tryVavooId(id) {
  for (const base of VAVOO_MIRRORS.slice(0, 2)) {   // v10.13 BB: 2 mirror (era 4)
    try { const u = await vavooResolveId(base, id); if (u) return u; } catch (e) {}
  }
  return null; }
async function vavooResolveDual(slug, query, vid6, vid7) {
  const t0 = Date.now();
  const cacheKey = slug || ('q:' + norm(query));
  const cachedUrl = vavooURLCache.get(cacheKey);
  if (cachedUrl && cachedUrl.exp > t0) return cachedUrl.url;
  const healthKey = slug || norm(query);
  const health = getVavooHealth(healthKey);
  const m = (vid6 || vid7) ? null : await ensureVavooMap();
  const mapId = m ? vavooMapFind(query || '', m) : null;
  const cands = [];
  if (mapId) cands.push({ id:mapId, num:0 });
  const rest = [];
  if (vid6 && vid6 !== mapId) rest.push({ id:vid6, num:6 });
  if (vid7 && vid7 !== mapId) rest.push({ id:vid7, num:7 });
  if (health.prefer7) rest.reverse();
  cands.push(...rest);
  if (!cands.length && query) {
    for (const base of VAVOO_MIRRORS.slice(0, 2)) {
      if (Date.now() - t0 > RESOLVE_BUDGET) break;
      try { const id2 = await vavooLiveFind(base, query); if (id2) { cands.push({ id:id2, num:0 }); break; } } catch (e) {}
    }
  }
  for (const cand of cands.slice(0, 3)) {
    if (Date.now() - t0 > RESOLVE_BUDGET) break;
    const url = vavooFixIpUrl(await tryVavooId(cand.id));
    noteVavooGoodHost(url); if (url) {
      updateVavooHealth(healthKey, cand.num);
      vavooURLCache.set(cacheKey, { url, exp:Date.now() + VAVOO_URL_TTL });
      cbClear(slug, 'vavoo'); return url;
    }
    if (cand.num) recordVavooFail(healthKey, cand.num);
  }
  if ((vid6 || vid7) ? false : (Date.now() - t0 < RESOLVE_BUDGET) && vavooMap.t && Date.now() - vavooMap.t > 45*60*1000) {
    try {
      const m2 = await ensureVavooMap(true);
      const id2 = m2 ? vavooMapFind(query || '', m2) : null;
      if (id2 && id2 !== mapId) {
        const u2 = vavooFixIpUrl(await tryVavooId(id2));
        noteVavooGoodHost(u2); if (u2) {
          updateVavooHealth(healthKey, 0);
          vavooURLCache.set(cacheKey, { url:u2, exp:Date.now() + VAVOO_URL_TTL });
          cbClear(slug, 'vavoo');
          return u2; }
      }
    } catch (e) {}
  }
  cbRecordFail(slug, 'vavoo'); return null;
}
async function vavooResolve(query, vid) {
  const c = findCh(query);
  if (c) return await vavooResolveDual(c.slug, c.vavoo || query, c.vid6, c.vid7);
  return await vavooResolveDual(null, query, vid, null);
}
// --- ROTTA /live (provider intatti, solo cache output ridotta a 2s) --------
async function live(u, P, legacy) {
  countReq('live'); cleanupStaleState();
  const q = u.searchParams.get('ch') || u.searchParams.get('c') || '';
  if (!q) return R('uso: /live?ch=<slug>\n\n' + elencoCanali(), 200, TXT());
  const c = findCh(q);
  if (!c) return R('canale non mappato: "' + q + '"\n\n' + elencoCanali(), 200, TXT());
  const prefParam = legacy || u.searchParams.get('p') || '';
  const prefList = prefParam ? prefParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  const allProvs = ['ntv', 'vavoo', 'daddy'];
  const available = allProvs.filter(p => {
    if (p === 'ntv')   return !!c.ntv;
    if (p === 'vavoo') return !!(c.vavoo || c.vid6 || c.vid7);
    if (p === 'daddy') return !!c.daddy;
    return false; });
  if (!available.length) return R('NESSUN provider mappato per ' + c.name, 200, TXT());
  const ordered = [];
  for (const p of prefList) if (available.includes(p) && !ordered.includes(p)) ordered.push(p);
  for (const p of available) if (!ordered.includes(p)) ordered.push(p);
  ordered.sort((a, b) => provRank(c.slug, b) - provRank(c.slug, a));
  const good = ordered.filter(p => segFailCount(c.slug, p) < SEGFAIL_MAX);
  const bad  = ordered.filter(p => segFailCount(c.slug, p) >= SEGFAIL_MAX);
  const finalOrder = good.concat(bad);
  const cbLive = finalOrder.filter(p => !cbInCooldown(c.slug, p));
  const cbFrozen = finalOrder.filter(p => cbInCooldown(c.slug, p));
  const cbLiveOk  = cbLive.filter(p => !lagBad(c.slug + '|' + p));
  const cbLiveLag = cbLive.filter(p =>  lagBad(c.slug + '|' + p));
  const tryOrder = cbLiveOk.concat(cbLiveLag, cbFrozen);
  for (let i = 1; i < tryOrder.length; i++) { const pp = tryOrder[i]; if (pp) bg(() => preWarmProv(pp, c)); }
  warmNext(WARM_BATCH);
  const ck = c.slug + ':' + tryOrder.join('.');
  const cachedOut = plCacheGet(ck);
  if (cachedOut) return R(cachedOut, 200, HLS_NO_CACHE());
  const provs = { vavoo: async () => {
      if (!c.vavoo && !c.vid6 && !c.vid7) return null;
      if (segFailCount(c.slug, 'vavoo') >= SEGFAIL_MAX) {
        vavooURLCache.delete(c.slug); vavooFlip(c.slug); clearSegFails(c.slug, 'vavoo');
        log('vavoo ' + c.slug + ': re-resolve dopo segfail con cambio id');
      } else if (segFailCount(c.slug, 'vavoo') >= SEGFAIL_EARLY) {
        const ent = vavooURLCache.get(c.slug);
        if (ent && ent.exp - Date.now() < 40000) { vavooURLCache.delete(c.slug); log('vavoo ' + c.slug + ': early re-resolve'); }
      }
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/i.test(vu)) {
        const r = await fetchPlaylistSmart(vu, vavooHeaders({ 'User-Agent':'VAVOO/1.0' }), 8000);
        if (!r.ok) { vavooURLCache.delete(c.slug); cbRecordFail(c.slug, 'vavoo'); return null; }
        const txt = await r.text();
        if (!txt.includes('#EXTM3U')) { vavooURLCache.delete(c.slug); cbRecordFail(c.slug, 'vavoo'); return null; }
        return emitPlaylist(ck, c.slug, 'vavoo', txt, vu, { P, ch:c.slug, prov:'vavoo', ref:'https://vavoo.to/', origin:'https://vavoo.to' });
      }
      return R('redirect vavoo', 302, { Location:vu, ...CORS() });
    }, ntv: async () => { if (!c.ntv) return null;
      const pl = await ntvPlaylist(c.ntv, c.slug);
      return emitPlaylist(ck, c.slug, 'ntv', pl.txt, pl.base, { P, ch:c.slug, prov:'ntv', ref:pl.ref, origin:'' });
    }, daddy: async () => {
      if (!c.daddy) return null;
      const dh = getBrowserHeaders('https://dembed.st/', c.slug + '|daddy');
      let du = await daddyResolve(c.daddy, c.slug);
      let txt = null;
      if (du && /\.m3u8/i.test(du)) {
        try { txt = await fetchUpstreamPl('daddy|' + c.daddy, du, dh, 8000); }
        catch (e) {
          if (/wedd48c|edge\./i.test(du)) {
            daddyEdgeFail.set(String(c.daddy), Date.now()); daddyCache.delete(c.daddy);
            log('daddy edge ko ' + c.daddy + ' (403/blocchi): Daddy KO, niente embeds');
            cbRecordFail(c.slug, 'daddy');
            return null;
          } else { cbRecordFail(c.slug, 'daddy'); return null; }
        }
      } else du = null; {
        const pchk = parseMediaPl(txt);
        if (!pchk.isMaster && pchk.segs.length) checkFreshOrThrow(c.slug + '|daddy', pchk.upSeq, pchk.upTarget, 'daddy');
      }
      const body = rewriteAny(txt, du, { P, ch:c.slug, prov:'daddy', ref:'https://dembed.st/', origin:'https://dembed.st' });
      const lines = body.split('\n');
      if (lines[0] === '#EXTM3U')
        lines.splice(1, 0, '#EXTVLCOPT:http-referrer=https://dembed.st/', '#EXTVLCOPT:http-user-agent=' + uaFor(c.slug + '|daddy'));
      const out = lines.join('\n');
      plCacheSet(ck, out); cbClear(c.slug, 'daddy');
      return R(out, 200, HLS_NO_CACHE());
    }
  }; let lastErr = ''; for (const p of tryOrder) {
    const fn = provs[p]; if (!fn) continue;
    try { const res = await fn();
      if (res) { noteProv(c.slug, p, true); return res; }
      lastErr = lastErr || (p + ': null');
      noteProv(c.slug, p, false);
    } catch (e) {
      lastErr = p + ': ' + (e && e.message ? e.message : String(e));
      log(p + ' ko ' + c.slug + ': ' + lastErr);
      noteProv(c.slug, p, false);
    }
  }
  for (const p of tryOrder) { cbClear(c.slug, p); clearSegFails(c.slug, p); }
  for (const [k, e] of plCache) {
    if (k.startsWith(c.slug + ':') && Date.now() - e.t < 60 * 1000)
      return R(e.txt, 200, HLS_NO_CACHE());
  }
  return R('ERRORE: provider KO (' + tryOrder.join(' -> ') + ') per ' + c.name + '. Ultimo: ' + lastErr + '. /probe?ch=' + c.slug, 200, TXT());
}
// --- RISCRITTURA PLAYLIST --------------------------------------------------
function rewriteAny(txt, baseUrl, ctx) {
  txt = String(txt);
  if (!txt.includes('#EXTM3U')) throw new Error('non-HLS');
  return /#EXT-X-STREAM-INF/.test(txt) ? rewriteMaster(txt, baseUrl, ctx) : rewriteMediaPl(txt, baseUrl, ctx);
}
function parseMediaPl(txt) {
  let upSeq=0, upTarget=4, upVersion=1, map=null, isMaster=false, endlist=false;
  const segs = [];
  let pending=null, disc=false, brange=null, pdt=null;
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF')) { isMaster = true; break; }
    if (line.startsWith('#EXTM3U')) continue;
    if (line.startsWith('#EXT-X-VERSION:')) { upVersion = parseInt(line.split(':')[1]) || 1; continue; }
    if (line.startsWith('#EXT-X-TARGETDURATION:')) { upTarget = parseInt(line.split(':')[1]) || 4; continue; }
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) { upSeq = parseInt(line.split(':')[1]) || 0; continue; }
    if (line.startsWith('#EXT-X-MAP')) { map = line; continue; }
    if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME')) { pdt = line; continue; }
    if (line.startsWith('#EXT-X-ENDLIST')) { endlist = true; continue; }
    if (line.startsWith('#EXT-X-DISCONTINUITY')) { disc = true; continue; }
    if (line.startsWith('#EXT-X-BYTERANGE')) { brange = line; continue; }
    if (line.startsWith('#EXTINF')) {
      pending = { extinf:line, dur: parseFloat((line.match(/#EXTINF:([\d.]+)/) || [])[1]) || 0, disc, brange, pdt };
      disc=false; brange=null; pdt=null;
      continue; }
    if (line.startsWith('#')) continue;
    if (pending) { pending.url = line; if (brange) { pending.brange = brange; brange = null; } if (pdt) { pending.pdt = pdt; pdt = null; } segs.push(pending); pending = null; }
  }
  return { upSeq, upTarget, upVersion, map, segs, isMaster, endlist };
}
function pickWindow(durs, prov) {
  const n = durs.length;
  if (!n) return { count:0, sum:0 };
  const cfg = delayCfg(prov); let count = 0, sum = 0;
  for (let i = n - 1; i >= 0; i--) {
    count++; sum += durs[i];
    if (count >= MIN_SEGS && sum >= cfg.start) break;
  }
  while (count > MIN_SEGS && sum - durs[n - count] >= cfg.start) { sum -= durs[n - count]; count--; }
  return { count, sum }; }
// v10.16: offset EXT-X-START SOLO su bordi segmento (keyframe allineati).
function snapOffset(keptDurs, sum, target, upTarget) {
  let off = 0;
  for (let k = 0; k < keptDurs.length - 1; k++) {
    const nx = off + (keptDurs[k] || upTarget);
    if (nx <= sum - target + 0.01) off = nx; else break;
  }
  return off; }
function absSegUrl(url, baseUrl) {
  if (/^https?:\/\//i.test(url)) return url;
  let abs;
  if (url.startsWith('/')) abs = new URL(baseUrl).origin + url;
  else abs = baseUrl.replace(/[^/]*$/, '') + url.replace(/^\.\//, '');
  return abs.replace(/([^:])\/{2,}/g, '$1/');
}
function proxUrl(abs, ctx) {
  const bust = Math.floor(Date.now() / BUST_MS) * BUST_MS;
  const withBust = abs + (abs.includes('?') ? '&' : '?') + '_t=' + bust;
  let u = ctx.P + '/seg?u=' + encodeURIComponent(withBust);
  if (ctx.ref)    u += '&ref=' + encodeURIComponent(ctx.ref);
  if (ctx.origin) u += '&o='   + encodeURIComponent(ctx.origin);
  if (ctx.ch)     u += '&ch='  + encodeURIComponent(ctx.ch);
  if (ctx.prov)   u += '&p='   + encodeURIComponent(ctx.prov);
  return u; }
function isAudioOnlyStreamInf(line) {
  if (/RESOLUTION=/.test(line)) return false;
  const codecs = (line.match(/CODECS="([^"]+)"/) || [])[1] || '';
  return !/(avc|hevc|hvc|vp09|av01)/i.test(codecs);
}
function rewriteMaster(txt, baseUrl, ctx) {
  const lines = String(txt).split(/\r?\n/);
  const media = [], iframes = [];
  const variants = [];
  let pending = null, maxBw = 0, maxRes = '';
  for (const raw of lines) { const line = raw.trim();
    if (!line || line.startsWith('#EXTM3U')) continue;
    if (line.startsWith('#EXT-X-MEDIA')) {
      const mu = line.match(/URI="([^"]+)"/);
      media.push(mu ? line.replace(/URI="[^"]+"/, 'URI="' + proxUrl(absSegUrl(mu[1], baseUrl), ctx) + '"') : line);
      continue; }
    if (line.startsWith('#EXT-X-I-FRAME-STREAM-INF')) {
      const mu = line.match(/URI="([^"]+)"/);
      iframes.push(mu ? line.replace(/URI="[^"]+"/, 'URI="' + proxUrl(absSegUrl(mu[1], baseUrl), ctx) + '"') : line);
      continue; }
    if (line.startsWith('#EXT-X-STREAM-INF')) { pending = line; continue; }
    if (line.startsWith('#')) { media.push(line); continue; }
    if (pending) {
      const bw = parseInt((pending.match(/BANDWIDTH=(\d+)/) || [])[1] || '0');
      const rm = pending.match(/RESOLUTION=(\d+)x(\d+)/);
      if (!isAudioOnlyStreamInf(pending) && bw > maxBw) { maxBw = bw; maxRes = rm ? rm[1] + 'x' + rm[2] : '?'; }
      variants.push({ line: pending, url: line, audioOnly: isAudioOnlyStreamInf(pending), bw });
      pending = null; }
  }
  if (maxBw && ctx && ctx.ch)
    log('quality ' + ctx.ch + ': max ' + maxRes + ' @ ' + Math.round(maxBw/1000) + 'kbps (' + variants.filter(v => !v.audioOnly).length + ' variant)');
  const allVideo = variants.filter(v => !v.audioOnly).sort((a, b) => b.bw - a.bw);
  // v10.17 ANTI-H265: i codec dichiarati in CODECS vincono rispetto alla banda:
  // scartate le variant HEVC/H265 (ExoPlayer e tanti player TV non le decodificano);
  // senza CODECS o senza variant avc note si tengono tutte (mai playlists vuote).
  const isHevc = v => /CODECS="/.test(v.line) && /(hevc|hvc1|hev1|h265)/i.test(v.line);
  const hasExplicitCodec = allVideo.some(v => /CODECS="/.test(v.line));
  const hasAvc = allVideo.some(v => !isHevc(v));
  const video = (hasExplicitCodec && hasAvc) ? allVideo.filter(v => !isHevc(v)) : allVideo;
  if (video.length !== allVideo.length)
    log('h264 ' + ((ctx && ctx.ch) || '?') + ': tenute ' + video.length + '/' + allVideo.length + ' variant (filtro H265)');
  const audio = variants.filter(v => v.audioOnly);
  const out = ['#EXTM3U']; out.push(...media);
  for (const v of video) out.push(v.line, proxUrl(absSegUrl(v.url, baseUrl), ctx));
  for (const v of audio) out.push(v.line, proxUrl(absSegUrl(v.url, baseUrl), ctx));
  out.push(...iframes); return out.join('\n');
}
// --- v10.14: RITARDO DI FONTE (PDT) + AUTO-DEPRIORIZZAZIONE ----------------
const lagMemo = new Map(); // slug|prov -> {lag,t,n}
const LAG_BAD_S = 45, LAG_TTL_MS = 5 * 60 * 1000;
function srcLagOf(p) {
  const last = p.segs[p.segs.length - 1];
  if (!last || !last.pdt) return null;
  const t = Date.parse(String(last.pdt).replace(/^#EXT-X-PROGRAM-DATE-TIME:(\s*)/, ''));
  if (!isFinite(t)) return null;
  return Math.max(0, (Date.now() - (t + (last.dur || 0) * 1000)) / 1000);
}
function noteSrcLag(key, lagS) {
  if (lagS == null || !isFinite(lagS)) return;
  const now = Date.now(); let e = lagMemo.get(key);
  if (!e || now - e.t > LAG_TTL_MS) e = { lag: lagS, t: now, n: 1 };
  else { e.lag = e.lag * 0.7 + lagS * 0.3; e.t = now; e.n++; }
  lagMemo.set(key, e); }
const lagBad = key => { const e = lagMemo.get(key); return !!(e && Date.now() - e.t < LAG_TTL_MS && e.lag >= LAG_BAD_S); };
const lagTxt = key => { const e = lagMemo.get(key); return e ? (Math.round(e.lag) + 's' + (e.lag >= LAG_BAD_S ? ' BAD->coda' : ' ok')) : 'n/d (no PDT)'; };
function rewriteMediaPl(txt, baseUrl, ctx) {
  const p = parseMediaPl(txt);
  if (p.isMaster || !p.segs.length) return rewriteMaster(txt, baseUrl, ctx);
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs, ctx && ctx.prov);
  const kept = p.segs.slice(-plan.count);
  const dropped = p.segs.length - kept.length;
  let seq = p.upSeq + dropped; let discontTop = false;
  const st = ctx && ctx.stateKey ? getPlState(ctx.stateKey) : null;
  if (st) {
    if (st.base && st.base !== baseUrl) { st.base = baseUrl; st.discont = true; }
    else if (!st.base) st.base = baseUrl;
    if (st.lastSeq >= 0 && seq <= st.lastSeq) {
      if (seq < st.lastSeq || p.upSeq < st.lastUpSeq) {
        seq = st.lastSeq; st.discont = true;
        log('seek indietro ' + (ctx && ctx.ch) + '/' + (ctx && ctx.prov) + ': seq ' + p.upSeq + ' clampato');
      }
    }
    st.lastSeq = seq; st.lastUpSeq = p.upSeq; st.t = Date.now();
    if (st.discont && kept.length) { discontTop = true; st.discont = false; }
  }
  let version = p.upVersion || 1;
  if (p.map && version < 6) version = 6;
  const pCfg = delayCfg(ctx && ctx.prov);
  const target = (pCfg.start != null ? pCfg.start : pCfg.target);
  const offset = snapOffset(kept.map(s => s.dur), plan.sum, target, p.upTarget);
  const out = ['#EXTM3U', '#EXT-X-VERSION:' + version, '#EXT-X-TARGETDURATION:' + p.upTarget, '#EXT-X-MEDIA-SEQUENCE:' + seq];
  if (offset > 0.5 && !p.endlist)
    out.push('#EXT-X-START:TIME-OFFSET=' + offset.toFixed(1) + ',PRECISE=YES');
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
  }); return out.join('\n'); }
// --- ROTTA /seg (FIX FRESHNESS: cache 30s, era 600s) -----------------------
async function seg(u, req) { countReq('seg');
  const target = u.searchParams.get('u');
  if (!target) return R('uso: /seg?u=<url>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://thedaddy.li/';
  const ch = u.searchParams.get('ch') || '';
  const prov = u.searchParams.get('p') || '';
  const h = getBrowserHeaders(ref, (ch && prov) ? (ch + '|' + prov) : ref);
  const o = u.searchParams.get('o');
  if (o) h['Origin'] = o;
  const rangeParam = u.searchParams.get('range');
  const playerRange = req && req.headers ? req.headers.get('Range') : null;
  if (rangeParam) h['Range'] = rangeParam;
  else if (playerRange) h['Range'] = playerRange;
  const range = h['Range'] || null;
  if (ref.includes('thedaddy') || ref.includes('dembed')) { h['Referer'] = 'https://dembed.st/'; h['Origin'] = 'https://dembed.st'; }
  if (/\.m3u8(\?|$)/i.test(target)) {
    let txt;
    try { txt = await fetchUpstreamPl('m|' + prov + '|' + target, target, h, 12000); }
    catch (e) { return R('upstream playlist', 502, TXT()); }
    const baseDir = target.substring(0, target.lastIndexOf('/') + 1) || target;
    const out = rewriteAny(txt, baseUrl_of(baseDir), { P:u.origin, ref, origin:o||'', ch, prov, stateKey:'m|' + prov + '|' + target });
    return R(out, 200, HLS_NO_CACHE());
  }
  let r, attempts = 0; const maxAttempts = 2;
  while (attempts < maxAttempts) {
    attempts++;
    const signed = await fetchSegmentWithCache(target, h, range);
    r = signed.resp;
    const ct = r.headers.get('content-type') || '';
    const isHtmlBody = r.ok && /^(text\/html|application\/json|text\/xml)/i.test(ct);
    if (!r.ok && !range) { recordSegFail(ch, prov);
      if (attempts < maxAttempts) { log('seg retry ' + attempts + ' per ' + (ch || '?') + ' (status ' + r.status + ')'); continue; }
      return R('upstream ' + r.status, r.status, TXT());
    } else if (isHtmlBody && !range) {
      recordSegFail(ch, prov);
      if (attempts < maxAttempts) { log('seg html retry ' + attempts + ' per ' + (ch || '?')); continue; }
      return R('upstream corrotto ' + r.status, r.status, TXT());
    } else if (!r.ok) { recordSegFail(ch, prov);
      return R('upstream ' + r.status, r.status, TXT());
    }
    break; }
  const hh = {
    'content-type': r.headers.get('content-type') || 'video/mp2t',
    'access-control-allow-origin':'*', 'access-control-allow-methods':'GET, HEAD, OPTIONS',
    'access-control-allow-headers':'Range, User-Agent, Referer, Origin',
    'access-control-expose-headers':'Content-Length, Content-Range, Accept-Ranges',
    'accept-ranges':'bytes',
    'cache-control':'public, max-age=' + SEG_CACHE_TTL
  };
  const cl = r.headers.get('content-length'); const cr = r.headers.get('content-range');
  if (cl) hh['content-length'] = cl;
  if (cr) hh['content-range'] = cr;
  return new Response(r.body, { status:r.status, headers:hh });
}
// --- PLAYER HLS.JS (fix anti-accumulo di delay) -----------------------------
async function player(u, P) {
  const ch = u.searchParams.get('ch') || 'sky-sport-f1';
  const c = findCh(ch);
  if (!c) return R('Canale non trovato: ' + ch, 404, TXT());
  const html = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${c.name} - TVNOW</title>\n  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>\n  <style>\n    * { box-sizing: border-box; }
    body { margin: 0; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }\n    video { width: 100%; max-width: 1200px; height: auto; background: #000; }
    .controls { position: fixed; top: 10px; left: 10px; color: #fff; font-family: monospace; background: rgba(0,0,0,0.85); padding: 15px; border-radius: 8px; font-size: 13px; line-height: 1.6; backdrop-filter: blur(10px); z-index: 1000; }\n    .controls div { margin: 2px 0; }\n    .title { font-weight: 600; font-size: 14px; margin-bottom: 8px; }\n    .status { color: #4CAF50; }\n    .status.error { color: #f44336; }\n    .status.loading { color: #FFC107; }
  </style>\n</head>\n<body>\n  <div class="controls">\n    <div class="title">📺 ${c.name}</div>\n    <div>Player: HLS.js | Delay target: ~30s uniforme | Quality: MAX | Codec: H264</div>\n    <div id="status" class="status loading">⏳ Caricamento...</div>\n    <div id="quality"></div>\n    <div id="buffer"></div>\n  </div>\n  <video id="video" controls autoplay muted playsinline></video>\n  <script>\n    const video = document.getElementById('video');
    const status = document.getElementById('status');\n    const quality = document.getElementById('quality');\n    const buffer = document.getElementById('buffer');\n    const streamUrl = '${P}/live?ch=${c.slug}';\n    if (Hls.isSupported()) {\n      const hls = new Hls({\n        debug: false, enableWorker: true, lowLatencyMode: false,\n        backBufferLength: 20,\n// v10.17: target delay UNIFORME ~30s (sync 25s, tetto 40s prima del catch-up).
liveSyncDuration: 25,\n        liveMaxLatencyDuration: 40,
        maxLiveSyncPlaybackRate: 1.0,\n        maxBufferLength: 20,\n        maxMaxBufferLength: ${MAX_BUFFER_SECS},\n        maxBufferSize: 60 * 1000 * 1000, maxBufferHole: 0.5,\n        capLevelToPlayerSize: false, autoStartLoad: true,\n        nudgeMaxRetry: 10, fragLoadingMaxRetry: 8, manifestLoadingMaxRetry: 4\n      });\n      hls.loadSource(streamUrl);\n      hls.attachMedia(video);\n      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        status.textContent = '✅ Stream caricato';\n        status.className = 'status';\n        video.play().catch(e => console.log('Autoplay bloccato:', e));\n        if (data.levels && data.levels.length > 0) {\n          let bestIdx = 0;\n          data.levels.forEach((l, i) => { if ((l.bitrate || 0) > (data.levels[bestIdx].bitrate || 0)) bestIdx = i; });\n          hls.currentLevel = bestIdx;\n          const lv = data.levels[bestIdx];
          quality.textContent = 'Qualità: ' + lv.width + 'x' + lv.height + ' @ ' + Math.round((lv.bitrate || 0) / 1000) + 'kbps (MAX)';\n        }\n      });\n      hls.on(Hls.Events.ERROR, (event, data) => {\n        if (data.fatal) {\n          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {\n            status.textContent = '🔄 Riconnessione...';\n            status.className = 'status loading';\n            setTimeout(() => hls.startLoad(), 1000);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {\n            status.textContent = '🔄 Media recovery...';\n            status.className = 'status loading';\n            hls.recoverMediaError();\n          } else {\n            status.textContent = '❌ Errore: ' + data.type;\n            status.className = 'status error';\n            hls.destroy();\n          }\n        }\n      });\n      setInterval(() => {\n        if (video.buffered.length > 0) {
          const buffered = video.buffered.end(video.buffered.length - 1) - video.currentTime;\n          buffer.textContent = 'Buffer: ' + buffered.toFixed(1) + 's | Delay ≈ min(buffer, 30)s';\n        }\n      }, 1000);\n    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {\n      status.textContent = '✅ Safari nativo';\n      status.className = 'status';\n      video.src = streamUrl;\n    } else {
      status.textContent = '❌ Browser non supportato';\n      status.className = 'status error';\n    }\n  </script>\n</body>
</html>`;
  return R(html, 200, { 'content-type': 'text/html; charset=utf-8', ...CORS() });
}
// --- DIAGNOSTICA (provider intatti) ----------------------------------------
async function segtest(u) {
  const t = u.searchParams.get('u');
  if (!t) return R('uso: /segtest?u=<url>&ref=<referer>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://vavoo.to/';
  const L = ['=== TEST SEGMENTO ===', 'URL: ' + t, 'Referer: ' + ref, ''];
  try {
    const r = await fetchT(t, { headers: getBrowserHeaders(ref, 'segtest') }, 12000);
    L.push('HTTP: ' + r.status, 'CT: ' + r.headers.get('content-type'));
    const buf = await r.arrayBuffer();
    const b = new Uint8Array(buf);
    L.push('Size: ' + b.length, 'Hex: ' + Array.from(b.slice(0,16)).map(x => x.toString(16).padStart(2,'0')).join(' '));
    if (b.length >= 8) {
      if (b[0] === 0x47) L.push('OK MPEG-TS');
      else if (String.fromCharCode(b[4],b[5],b[6],b[7]) === 'ftyp') L.push('OK fMP4');
      else { const tx = String.fromCharCode(...b.slice(0,100)); L.push(tx.includes('<html') ? 'ERR HTML' : 'WARN'); }
    }
    return R(L.join('\n'), 200, TXT());
  } catch (e) { return R('ERR: ' + e.message, 200, TXT()); }
}
const baseUrl_of = d => d.startsWith('http') ? d : 'https://' + d.replace(/^\/{2,}/, '');
async function checkseg(u) {
  const source = u.searchParams.get('s') || 'ntv';
  const ch = u.searchParams.get('ch') || '869';
  const L = ['=== CHECK SEG ===', 'Fonte: ' + source, 'Canale: ' + ch, ''];
  try {
    let segUrl = '', headers = {}, txt = '';
    let prov = source, slug = '';
    const cc = findCh(ch); if (cc) slug = cc.slug;
    if (source === 'ntv') {
      const pl = await ntvPlaylist(ch, slug); txt = pl.txt; headers = getBrowserHeaders(pl.ref, slug + '|ntv');
    } else if (source === 'daddy') {
      const du = await daddyResolve(ch, slug);
      if (!du) return R('Daddy non risolto', 200, TXT());
      const r = await fetchPlaylistSmart(du, getBrowserHeaders('https://dembed.st/', slug + '|daddy'), 10000);
      if (!r.ok) return R('Daddy HTTP ' + r.status, 200, TXT());
      txt = await r.text(); headers = getBrowserHeaders('https://dembed.st/', slug + '|daddy');
    } else if (source === 'vavoo') {
      const c = findCh(ch);
      if (!c) return R('Vavoo: canale non trovato', 200, TXT());
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      if (!vu) return R('Vavoo non risolto', 200, TXT());
      const r = await fetchPlaylistSmart(vu, vavooHeaders({ 'User-Agent':'VAVOO/1.0' }), 10000);
      if (!r.ok) return R('Vavoo HTTP ' + r.status, 200, TXT());
      txt = await r.text(); headers = vavooHeaders({ 'User-Agent':'VAVOO/1.0' });
    }
    const lines = txt.split('\n');
    const isMaster = txt.includes('#EXT-X-STREAM-INF');
    if (isMaster) {
      L.push('Master Playlist.');
      for (let i = 0; i < lines.length; i++) if (!lines[i].startsWith('#') && lines[i].trim()) { segUrl = lines[i].trim(); break; }
    } else {
      for (let i = 0; i < lines.length; i++)
        if (lines[i].trim().startsWith('#EXTINF') && lines[i+1] && !lines[i+1].trim().startsWith('#')) { segUrl = lines[i+1].trim(); break; }
    }
    if (!segUrl) return R('Nessun URL trovato', 200, TXT());
    if (!segUrl.startsWith('http')) { L.push('URL relativo.'); return R(L.join('\n'), 200, TXT()); }
    L.push('URL: ' + segUrl, '');
    const r = await fetchT(segUrl, { headers }, 12000);
    L.push('HTTP: ' + r.status, 'CT: ' + r.headers.get('content-type'), '');
    const buf = await r.arrayBuffer();
    const b = new Uint8Array(buf);
    L.push('Size: ' + b.length, '');
    L.push('Hex: ' + Array.from(b.slice(0,16)).map(x => x.toString(16).padStart(2,'0')).join(' '), '');
    if (b.length >= 4) {
      if (b[0] === 0x47) L.push('OK MPEG-TS');
      else if (String.fromCharCode(b[4],b[5],b[6],b[7]) === 'ftyp') L.push('OK fMP4');
      else { const tx = String.fromCharCode(...b.slice(0,100)); L.push(tx.includes('<html') ? 'ERR HTML' : 'WARN'); }
    }
    return R(L.join('\n'), 200, TXT());
  } catch (e) { return R('ERR: ' + e.message, 200, TXT()); }
}
async function warm() { const t0 = Date.now();
  const ids = ['869','461','870','576','462','875','460','577','575','574','877','878','879','871','872','873','860','861','862','859','864','865','867','868','863','880'];
  let ok = 0, err = 0;
  for (let i = 0; i < ids.length; i += 8)
    await Promise.all(ids.slice(i, i + 8).map(async id => { try { await ntvToken(id, null); ok++; } catch (e) { err++; } }));
  for (const ch of ['sky sport 24','sky sport uno','sky sport calcio','sky sport tennis','dazn 1','eurosport 1','rsi la 1','rsi la 2','sky sport f1','sky sport motogp'])
    try { await vavooResolve(ch, null); } catch (e) {}
  for (const id of ids.slice(0, 13)) try { await daddyResolve(id, null); } catch (e) {}
  try { await ensureVavooMap(); } catch (e) {}
  const msg = 'WARM ok=' + ok + ' err=' + err + ' (' + (Date.now()-t0) + 'ms) ntv=' + tokenCache.size + ' daddy=' + daddyCache.size + ' vavoo=' + vavooURLCache.size;
  log(msg); return R(msg, 200, TXT());
}
async function probe(u) {
  const q = u.searchParams.get('ch') || '';
  const c = findCh(q);
  if (!c) return 'canale non mappato: "' + q + '"\n\n' + elencoCanali();
  const h = getVavooHealth(c.slug);
  const L = ['PROBE ' + c.name,
    'Health vavoo: prefer7=' + h.prefer7 + ' fails6=' + h.fails6 + ' fails7=' + h.fails7,
    'SegFails: vavoo=' + segFailCount(c.slug,'vavoo') + ' ntv=' + segFailCount(c.slug,'ntv') + ' daddy=' + segFailCount(c.slug,'daddy'),
    'CB (canale|provider): ntv=' + (cbInCooldown(c.slug,'ntv')?'CD':'ok') + ' vavoo=' + (cbInCooldown(c.slug,'vavoo')?'CD':'ok') + ' daddy=' + (cbInCooldown(c.slug,'daddy')?'CD':'ok')];
  if (c.vavoo || c.vid6 || c.vid7) {
    const t0 = Date.now(); try {
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      L.push('1) VAVOO: ' + (vu ? 'OK (' + (Date.now()-t0) + 'ms)\n     URL upstream: ' + vu : 'skip'));
    } catch (e) { L.push('1) VAVOO: ERR ' + e.message); }
  } else L.push('1) VAVOO: skip');
  if (c.ntv) { const t0 = Date.now();
    try {
      const pl = await ntvPlaylist(c.ntv, c.slug);
      L.push('2) NTV: OK (' + (Date.now()-t0) + 'ms)\n     URL upstream: ' + pl.base);
    } catch (e) { L.push('2) NTV: ERR ' + e.message); }
  } else L.push('2) NTV: skip');
  if (c.daddy) { const t0 = Date.now();
    try {
      const du = await daddyResolve(c.daddy, c.slug);
      L.push('3) DADDY: ' + (du ? 'OK (' + (Date.now()-t0) + 'ms)\n     URL upstream: ' + du : 'skip'));
    } catch (e) { L.push('3) DADDY: ERR ' + e.message); }
  } else L.push('3) DADDY: skip');
  return L.join('\n'); }
const vmap = async () => {
  const m = await ensureVavooMap(true);
  return m ? 'VMAP: ' + m.size + ' canali (' + vavooMap.src + ')' : 'VMAP: nessuna fonte';
}; async function diag(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-24';
  const c = findCh(q);
  if (!c) return 'Canale non trovato: ' + q;
  const h = getVavooHealth(c.slug);
  const L = ['=== DIAG ' + VER + ' ===', 'Canale: ' + c.name + ' (slug: ' + c.slug + ')', '',
    'Vavoo ID6: ' + (c.vid6 || 'none') + ' | ID7: ' + (c.vid7 || 'none'),
    'Health: prefer7=' + h.prefer7 + ' fails6=' + h.fails6 + ' fails7=' + h.fails7,
    'SegFails: vavoo=' + segFailCount(c.slug,'vavoo') + ' ntv=' + segFailCount(c.slug,'ntv') + ' daddy=' + segFailCount(c.slug,'daddy'),
    'CB: ntv=' + (cbInCooldown(c.slug,'ntv')?'CD':'ok') + ' vavoo=' + (cbInCooldown(c.slug,'vavoo')?'CD':'ok') + ' daddy=' + (cbInCooldown(c.slug,'daddy')?'CD':'ok'), ''];
  const tryP = async (label, fn) => {
    const t0 = Date.now();
    try { const txt = await fn();
      L.push('-- ' + label + ' (' + (Date.now()-t0) + 'ms) --', 'OK | ' + playlistStats(txt, String(label).split(' ')[0].toLowerCase()) + ' | ritardo fonte: ' + lagTxt(c.slug + '|' + String(label).split(' ')[0].toLowerCase())); }
    catch (e) { L.push('-- ' + label + ' (' + (Date.now()-t0) + 'ms) --', 'ERR: ' + (e && e.message)); }
    L.push(''); };
  if (c.vavoo || c.vid6 || c.vid7) await tryP('VAVOO', async () => {
    const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
    if (!vu) throw new Error('non risolto');
    const r = await fetchPlaylistSmart(vu, vavooHeaders({ 'User-Agent':'VAVOO/1.0' }), 12000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text(); });
  if (c.ntv) await tryP('NTV', async () => (await ntvPlaylist(c.ntv, c.slug)).txt);
  if (c.daddy) await tryP('DADDY', async () => {
    const du = await daddyResolve(c.daddy, c.slug);
    if (!du) throw new Error('non risolto');
    const r = await fetchPlaylistSmart(du, getBrowserHeaders('https://dembed.st/', c.slug + '|daddy'), 12000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text(); });
  L.push('=== FATTORI DI DELAY (v10.17: target UNIFORME ~30s) ===',
    'delay totale percepito = ritardo interno della FONTE + finestra (target 28s / start 30s)',
    'TUTTI i provider (ntv/daddy/vavoo): stesso target -> lo switch non cambia il delay',
    'H264: variant H265 scartate dal master e loggate (ExoPlayer non decodifica H265)',
    'seg window: soglia adattiva per-TARGETDURATION del provider (bordi keyframe)',
    'RITARDO DI FONTE (relay lenti, es. Daddy embed fallback): misurato via PDT;',
    'sopra i 45s il provider va in coda per quel canale (5 min): i minuti di',
    'ritardo di un relay NON sono comprimibili, v10.14 li fa EVITARE.',
    'Ogni provider e\' al SUO minimo stabile, nessuno limitato dagli altri.',
    'Cache/efficienza (riepilogo rapido): Cache API segmenti 120s, single-flight, bust anti-cache (dettagli in /debug e nei commenti).');
  return L.join('\n'); }
function playlistStats(txt, prov) {
  const p = parseMediaPl(txt);
  if (p.isMaster) return 'master playlist';
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs, prov);
  const cfg = delayCfg(prov);
  const total = durs.reduce((a,b) => a+b, 0);
  const target = cfg.start != null ? cfg.start : cfg.target;
  const off = snapOffset(durs.slice(-plan.count), plan.sum, target, p.upTarget);
  return 'fonte ' + p.segs.length + ' segs / ' + total.toFixed(1) + 's'
    + ' | finestra ' + plan.count + '/' + plan.sum.toFixed(1) + 's'
    + ' | delay ' + (plan.sum - off).toFixed(1) + 's (bordo keyframe; target ' + target + 's)';
}
function debug() { const vm = vavooMapGet();
  const sf = []; const now = Date.now();
  for (const [k, arr] of segFails) { const live = arr.filter(t => now - t < SEGFAIL_TTL); if (live.length) sf.push(k + '=' + live.length); }
  const cds = [];
  for (const [k, until] of cbCooldown) if (until > now) cds.push(k);
  return [
    VER,
    'Cache: NTV=' + tokenCache.size + ' | Daddy=' + daddyCache.size + ' | VavooURL=' + vavooURLCache.size,
    'Vavoo map: ' + (vm ? vm.size + ' (' + Math.round((Date.now() - vavooMap.t)/60000) + ' min)' : 'non caricata'),
    'Delay (v10.17): target UNIFORME ~28-30s tutti i provider (floor = lag fonte PDT) | m3u8 bust 2s anti-cache CDN | cache seg ' + SEG_CACHE_TTL + 's + bust ' + (BUST_MS/1000) + 's',
    'Smart bust: host senza bust (URL firmate): ' + (Array.from(noBustHosts.keys()).join(', ') || 'nessuno') + ' | warm cursor: ' + warmCursor + '/' + CHANNELS.length,
    'Heartbeat: ' + (lastHeartbeat ? 'ultimo tick ' + Math.round((now - lastHeartbeat)/1000) + 's fa (ogni 5 min riscalda 6 canali)' : 'non avviato'),
    'Stream: ' + plState.size + ' | Cache PL: ' + plCache.size,
    'Lag fonte (PDT): ' + (Array.from(lagMemo.entries()).filter(([, e]) => Date.now() - e.t < LAG_TTL_MS).sort((a, b) => b[1].lag - a[1].lag).map(([k, e]) => k + '=' + Math.round(e.lag) + 's').join(', ') || 'nessuno misurato'),
    'CB cooldown attivi: ' + (cds.join(', ') || 'nessuno'),
    'SegFails: ' + (sf.join(', ') || 'nessuno'),
    'NTV: resolve=' + ntvStats.resolve + ' refresh=' + ntvStats.refresh + ' err=' + ntvStats.err,
    'Richieste: live=' + reqStats.live + ' seg=' + reqStats.seg,
    'Risparmio: seg cache-api hit=' + segStat.apiHits + ' fetch origine/cf=' + segStat.origin + ' (' + (segStat.apiHits + segStat.origin ? Math.round(segStat.apiHits * 100 / (segStat.apiHits + segStat.origin)) : 0) + '% serviti senza toccare l\'origine)',
    'Log:\n  ' + (logs.slice(-15).join('\n  ') || '(vuoti)')
  ].join('\n'); }
function uso(P) { return [VER, '',
    'uso:',
    '  /live?ch=<slug>                delay UNIFORME ~30s + H264 forzato (v10.17)',
    '  /live?ch=<slug>&p=vavoo,ntv   ordine preferito (fallback reale)',
    '  /player?ch=<slug>              player HLS.js (latenza controllata + catch-up)',
    '  /diag?ch=sky-sport-f1          diagnostica: finestra e delay per-provider',
    '  /probe?ch=sky-sport-f1         probe rapido + URL upstream (test VLC)',
    '  /checkseg?s=<ntv|vavoo|daddy>&ch=<id>  test segmento',
    '  /segtest?u=<url>&ref=<referer> test URL diretto',
    '  /warm /vmap /debug /ch /rawu /dump /ip  utility',
    ''].join('\n'); }
// --- HELPERS ---------------------------------------------------------------
function TXT() { return { 'content-type':'text/plain; charset=utf-8', ...CORS() }; }
function HLS_NO_CACHE() {
  return { 'content-type':'application/vnd.apple.mpegurl',
    'cache-control':'no-cache, no-store, must-revalidate', 'pragma':'no-cache', 'expires':'0', ...CORS() };
}
function CORS() { return { 'access-control-allow-origin':'*' }; }
function R(body, status, headers) {
  const h = Object.assign({ 'content-type':'text/plain; charset=utf-8' }, headers || {});
  if (status === 302) delete h['content-type'];
  return new Response(body, { status:status || 200, headers:h });
}
async function rawu(u) {
  const t = u.searchParams.get('u');
  if (!t) return R('uso: /rawu?u=<url>', 200, TXT());
  const h = getBrowserHeaders(u.searchParams.get('ref') || 'https://thedaddy.li/', 'rawu');
  if (u.searchParams.get('o')) h['Origin'] = u.searchParams.get('o');
  let r; try {
    r = /\.m3u8(\?|$)/i.test(t)
      ? await fetchPlaylistSmart(t, h, 20000)
      : await fetchT(t, { headers:h, cf: { cacheTtl: 0, cacheEverything: false }, redirect:'follow' }, 20000);
  }
  catch (e) { return R('ERR: ' + (e && e.message), 200, TXT()); }
  let body = '';
  try { body = await r.text(); } catch (e) { body = '(no body)'; }
  return R('status ' + r.status + ' | len ' + body.length + '\n' + body.slice(0, 2000), 200, TXT());
}
async function fetchT(url, opt, ms) {
  const o = Object.assign({}, opt || {});
  if (ms && typeof AbortController !== 'undefined') {
    const ac = new AbortController();
    const t = setTimeout(() => { try { ac.abort(); } catch (e) {} }, ms);
    o.signal = ac.signal;
    try { return await fetch(url, o); } finally { clearTimeout(t); }
  }
  return fetch(url, o); }
