// ============================================================================
// TVNOW-CF v10.8 — DELAY MINIMO PER PROVIDER + STABILITA' LUNGA + CANALI INDIPENDENTI
// ============================================================================
// PROVIDER INTATTI: NTV / Vavoo / Daddy (resolve, health, circuit breaker,
// segfails, warm, diag) sono IDENTICI alla v10.4. Toccata solo la catena
// playlist/segmenti, che era la causa del ritardo.
//
// CAUSE DEL RITARDO 70s TROVATE NELLA v10.4:
// 1. CACHE EDGE SEGMENTI 600s SENZA BUST: in /seg c'era cacheTtl:600 e in
//    proxUrl il bust _t era stato rimosso. Con nomi file fissi/token ruotati
//    (tipico di queste origini) la CF può servire un segmento lungo fino a 10
//    minuti: il player riceve un "live edge" vecchio e variabile. Da qui
//    scene ripetute + ritardo percepito di 60-120s. (v8.7 lo sapeva: bust 15s)
// 2. cache-control: public, max-age=600 verso il PLAYER: le TV app mettono in
//    cache lato client -> stessi segmenti serviti due volte, latenza che non scende.
// 3. PL_CACHE_TTL 4000ms: fino a 4s di ritardo gratis ad ogni poll.
// 4. /player senza liveSyncDuration/liveMaxLatencyDuration: hls.js non
//    rincorre mai la live edge, il buffer cresce senza limite.
//
// FIX v10.5:
// A. Bust _t stabile 30s su ogni URL segmento + cacheTtl edge 30s: freshness
//    garantita, quota origin protetta (riuso per 30s tra poll e tra spettatori)
// B. cache-control verso il player: max-age=30 (non 600)
// C. PL_CACHE_TTL: 2000ms
// D. Finestra adattiva sulle durate REALI (EXTINF), target 27s, min 25s:
//    playlist annuncio stabile, il player non esce mai dalla finestra quindi
//    non si risincronizza (le risincronizzazioni erano un'altra fonte di drift)
// E. /player: liveSyncDuration=25, liveMaxLatencyDuration=40,
//    maxLiveSyncPlaybackRate=1.5 (se resta indietro, accelera e rientra)
//
// FIX v10.6 (delay bloccato 25-30s per OGNI canale e provider + stabilita'):
// F. EXT-X-START:TIME-OFFSET dinamico (PRECISE=YES): quando la finestra
//    minimizzata supera i 27s (es. Vavoo 2x17s = 34s), il player parte dentro
//    la window cosi' il delay EFFETTIVO e' ~25-28s su ogni canale/provider.
//    Se un device specifico da schermo grigio, metti EXT_START_TRIM = false.
// G. PREFETCH del segmento piu' nuovo in background (ctx.waitUntil): quando il
//    player lo chiede e' gia' in cache edge CF -> meno microscatti.
// H. Orditine provider ADATTIVO per canale: chi e' andato in errore di recente
//    su QUEL canale scende in coda (provScore), chi ha funzionato sale.
//    Ogni canale e' indipendente: stati, cache, score, CB e segfail sono tutti
//    chiavi <canale>|<provider> — un canale rotto non tocca gli altri.
//
// FIX v10.7 (PRESERVAZIONE RICHIESTE, flusso daddy-channels):
// I. RISOLUZIONE DADDY A COSTO ZERO: le URL edge stabili del repo daddy-channels
//    (edge.wedd48c.top/premium<ID>/index.m3u8, senza token nella URL) sono la
//    PRIMA via di risoluzione: zero richieste di estrazione embed (prima 2-6
//    richieste, iframes inclusi, a ogni scadenza). La catena embed resta
//    SOLO come fallback se l'edge URL fallisce (memo 60s di edge-fail).
// L. CACHE API NORMALIZZATA PER SEGMENTO: il token ruota ogni 120s, quindi le
//    URL dei segmenti (e la cache edge) cambiavano ogni 120s. Ora i segmenti
//    sono anche nella Workers Cache API con chiave URL PRIVA dei parametri
//    rotanti (token/s/e/sig/auth/...): la cache sopravvive alla rotazione,
//    viewer multipli e rotazioni successive condividono lo stesso download.
// M. SINGLE-FLIGHT PLAYLIST UPSTREAM: i fetch della playlist upstream
//    (daddy + playlist annidate via /seg) sono deduplicati con finestra di
//    freschezza 4s: N viewer sullo stesso canale = 1 richiesta upstream.
// N. Il prefetch (v10.6 G) popola la Cache API normalizzata (stessa chiave).
//
// FIX v10.8 (DEFINITIVA: delay minimo per provider + stabilita' lunga):
// O. DELAY PER PROVIDER (non piu' uniforme 27s): ogni provider e' portato al
//    SUO minimo stabile, calcolato su TARGETDURATION/durate reali:
//    - NTV (7s/seg):     21s   (3 seg; i 14s con 2 seg sono spec-risk decoder)
//    - DADDY (4-6s/seg): 16-18s (3-5 seg)
//    - VAVOO (17s/seg):  ~28s  (2 seg = 34s, trimmato via EXT-X-START)
//    Nessun provider e' piu' limitato dagli altri.
// P. ANTI-ROTTURA POST-30MIN: cleanup completo anche di plCache, vavooURLCache
//    e segFails (prima crescevano senza bound) + memoria sotto controllo durante
//    lo zapping: zero leak, l'isolate vive a lungo e se riparte riparte pulito.
// Q. ANTI-AFFATICAMENTO ZAPPING: i provider di ripiego vengono PRE-RISCALDATI
//    in background al primo poll di ogni canale (ntv token / vavoo resolve /
//    daddy edge gia' in cache): quando cambi canale o il provider primario cade,
//    il fallback e' gia' pronto, non si parte da zero.
// ============================================================================

// ctx del modulo worker: serve per il prefetch in background (waitUntil)
let MODULE_CTX = null;
const bg = fn => { try { if (MODULE_CTX && MODULE_CTX.waitUntil) MODULE_CTX.waitUntil(Promise.resolve().then(fn).catch(() => {})); } catch (e) {} };

export default {
  async fetch(req, env, ctx) {
    MODULE_CTX = ctx || null;
    const u = new URL(req.url);
    const P = u.origin;
    const path = u.pathname;
    if (req.method === 'HEAD' || req.method === 'OPTIONS')
      return R('OK', 200, { 'content-type':'text/plain; charset=utf-8', ...CORS() });
    try {
      switch (path) {
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
// DELAY MINIMO PER PROVIDER (v10.8): calcolato sulle durate REALI (EXTINF /
// TARGETDURATION misurate sulle fonti), ognuno al proprio floor stabile:
const PROV_DELAY = {
  ntv:   { target: 21, min: 15 },  // seg ~7s -> 3 seg (21s); 2 seg solo se la fonte publica poco
  daddy: { target: 18, min: 14 },  // seg ~4-6s -> 3-5 seg (16-20s)
  vavoo: { target: 28, min: 27 }   // seg ~17s -> 2 seg (34s) + trim EXT-X-START -> ~28s
};
const PROV_PREF_SEGS = 3, MIN_SEGS = 2;
const delayCfg = prov => PROV_DELAY[prov] || { target: 24, min: 20 };
const DELAY_TARGET = 24; // fallback di testo/estimate per provider non noto
const EXT_START_TRIM = true;              // F: trim delay via EXT-X-START (false se un device da schermo grigio)
const PREFETCH_SEGS = 1;                  // G: quanti segmenti nuovi pre-caricare in bg
const STALE_FACTOR = 6, MAX_BUFFER_SECS = 40;
const SEG_CACHE_TTL = 30;                 // FIX: 30s edge cache (era 600)
const BUST_MS = 30000;                    // FIX: bust stabile 30s (era assente)
const SEGFAIL_TTL = 3*60*1000, SEGFAIL_MAX = 3, SEGFAIL_EARLY = 1;
const PL_CACHE_TTL = 2000, RESOLVE_BUDGET = 12000, STATE_STALE_TTL = 15*60*1000;
const CB_FAIL_WIN = 120*1000, CB_FAIL_TH = 6, CB_COOLDOWN = 50*1000;
const NTV_REFRESH_MARGIN = 900, VAVOO_URL_TTL = 240*1000;
const DADDY_TTL = 10*60*1000, VAVOO_HEALTH_TTL = 15*60*1000, VAVOO_MAP_TTL = 8*3600*1000;
const MAX_TOKEN_CACHE = 80, MAX_DADDY_CACHE = 150;
const VER = 'TVNOW-CF v10.8 FINAL';
// v10.7: URL edge STABILI (da daddy-channels/edge.json): nessun token nella
// URL, il token vive nel contenuto e ruota ogni 120s lato server. La risoluzione
// Daddy parte da qui = ZERO richieste di estrazione embed.
const DADDY_EDGE_BASE = 'https://edge.wedd48c.top';
const DADDY_EDGE_IDS = ['869','461','870','576','462','875','460','577','575','574','877','878','879','871','872','873','860','861','862','859','864','865','867','868','863','880'];
const DADDY_EDGE_FAIL_TTL = 60 * 1000;    // se l'edge URL fallisce, usa embeds per 60s
const PLAYLIST_FRESH_MS = 4000;           // single-flight upstream playlist (finestra freschezza)
const SEG_API_TTL = 120;                  // Cache API segmenti: sopravvive alla rotazione token (120s)
const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

function uaFor(key) {
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
];
const ALIASES = {
  'dazn':'dazn-1','dazn-zona':'dazn-1','zona-dazn':'dazn-1','serie-a':'sky-sport-serie-a',
  'sky-calcio-1':'sky-calcio-251','sky-calcio-2':'sky-calcio-252','sky-calcio-3':'sky-calcio-253',
  'sky-sport-24-ntv':'sky-sport-24','sky-sport-uno-italy':'sky-sport-uno'
};

// --- UTILITIES -------------------------------------------------------------
const norm = s => String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const BY_KEY = (() => {
  const m = new Map();
  for (const c of CHANNELS) {
    m.set(c.slug, c);
    m.set(norm(c.name), c);
    if (c.ntv) m.set(c.ntv, c);
    if (c.daddy) m.set('d'+c.daddy, c);
  }
  for (const [a, s] of Object.entries(ALIASES)) {
    const c = m.get(s);
    if (c) m.set(a, c);
  }
  return m;
})();

function findCh(q) {
  let k = norm(q);
  if (BY_KEY.has(k)) return BY_KEY.get(k);
  k = k.replace(/-ntv$/,'').replace(/-daddy$/,'');
  return BY_KEY.get(k) || null;
}
function elencoCanali() {
  const L = ['CANALI (' + CHANNELS.length + ') — /live?ch=<slug>'];
  for (const c of CHANNELS)
    L.push('  ' + c.slug.padEnd(24) + ' ntv=' + String(c.ntv||'-').padEnd(4) + ' vavoo=' + (c.vavoo||'-').padEnd(18) + ' daddy=' + (c.daddy||'-').padEnd(4));
  return L.join('\n');
}

// --- STATO GLOBALE ---------------------------------------------------------
const tokenCache = new Map(), daddyCache = new Map(), vavooURLCache = new Map();
const vavooHealth = new Map(), segFails = new Map();
const cbFails = new Map(), cbCooldown = new Map();
const plCache = new Map(), plState = new Map(), upFresh = new Map();
const daddyEdgeFail = new Map();          // v10.7: memo edge URL fallita per id
const plFetchCache = new Map();           // v10.7: single-flight fetch playlist upstream
const SEGCACHE = (typeof caches !== 'undefined') ? caches.default : null; // v10.7 L
let segStat = { apiHits: 0, origin: 0 }; // v10.7: preservazione richieste visibile in /debug
// v10.6 H: score per <canale>|<provider> per l'ordine adattivo (canali indipendenti)
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
  reqStats[k]++;
};

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
  return true;
}
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
  if (!ch || !prov) return 0;
  const now = Date.now();
  return (segFails.get(ch + '|' + prov) || []).filter(t => now - t < SEGFAIL_TTL).length;
};
const clearSegFails = (ch, prov) => { if (ch && prov) segFails.delete(ch + '|' + prov); };

// --- CLEANUP ---------------------------------------------------------------
let lastCleanup = 0;
function cleanupStaleState() {
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
  // v10.8 P: nessuna mappa cresce senza bound (zero leak, isolate longevo)
  for (const [k, e] of plCache) if (Date.now() - e.t > 60000) plCache.delete(k);
  for (const [k, e] of vavooURLCache) if (Date.now() > e.exp) vavooURLCache.delete(k);
  for (const [k, arr] of segFails) {
    const near = arr.filter(t => now - t < SEGFAIL_TTL);
    if (near.length) segFails.set(k, near); else segFails.delete(k);
  }
}

function getPlState(key) {
  let st = plState.get(key);
  if (!st) { st = { lastSeq:-1, lastUpSeq:-1, base:'', discont:false, t:Date.now() }; plState.set(key, st); }
  return st;
}

// --- VAVOO HEALTH ----------------------------------------------------------
function getVavooHealth(slug) {
  const h = vavooHealth.get(slug);
  if (!h) return { prefer7:false, t:0, fails6:0, fails7:0 };
  if (Date.now() - h.t > VAVOO_HEALTH_TTL) { vavooHealth.delete(slug); return { prefer7:false, t:0, fails6:0, fails7:0 }; }
  return h;
}
function updateVavooHealth(slug, num) {
  const h = getVavooHealth(slug);
  h.t = Date.now(); h.prefer7 = (num === 7);
  if (num === 6 || num === 0) h.fails6 = 0;
  if (num === 7 || num === 0) h.fails7 = 0;
  vavooHealth.set(slug, h);
}
function recordVavooFail(slug, idNum) {
  const h = getVavooHealth(slug);
  h.t = Date.now();
  if (idNum === 6) h.fails6++; else h.fails7++;
  if (h.fails6 >= 3) h.prefer7 = true;
  if (h.fails7 >= 3) h.prefer7 = false;
  vavooHealth.set(slug, h);
}

const plCacheGet = ck => {
  const e = plCache.get(ck);
  if (e && Date.now() - e.t < PL_CACHE_TTL) return e.txt;
  if (e) plCache.delete(ck);
  return null;
};
const plCacheSet = (ck, txt) => plCache.set(ck, { txt, t:Date.now() });

function checkFreshOrThrow(key, upSeq, upTarget, prov) {
  const now = Date.now();
  const st = upFresh.get(key);
  if (!st || upSeq !== st.seq) { upFresh.set(key, { seq:upSeq, t:now }); return; }
  const maxAge = Math.max(20, (upTarget || 4) * STALE_FACTOR) * 1000;
  if (now - st.t > maxAge) throw new Error(prov + ' congelata (seq ' + upSeq + ' da ' + Math.round((now-st.t)/1000) + 's)');
}

// --- v10.7 L/M: cache normalizzata segmenti + single-flight playlist -------
// Il token ruota ogni 120s -> le URL dei segmenti cambiano ma il CONTENUTO
// (path/file) no. Chiave di cache = URL senza i parametri rotanti: cosi' la
// cache sopravvive alla rotazione e viewer multipli / poll successivi
// condividono lo stesso download (zero richieste extra all'origine).
const SEG_TOKEN_PARAM = /^(token|t$|_t$|e$|s$|sig|signature|auth|key|expires|exp|md5|wmsauthsign|hmac|st)$/i;
function segCacheKey(abs) {
  const qi = abs.indexOf('?');
  if (qi < 0) return abs;
  const base = abs.slice(0, qi);
  const keep = [];
  for (const kv of abs.slice(qi + 1).split('&')) {
    const name = (kv.split('=')[0] || '').toLowerCase();
    if (SEG_TOKEN_PARAM.test(name)) continue;
    keep.push(kv);
  }
  return keep.length ? base + '?' + keep.join('&') : base;
}

// Single-flight + freschezza 4s per le playlist upstream: N viewer / poll
// ravvicinati sullo stesso stream = UNA sola richiesta all'origine.
function fetchUpstreamPl(key, url, headers, timeoutMs) {
  const now = Date.now();
  const e = plFetchCache.get(key);
  if (e && e.txt && now - e.t < PLAYLIST_FRESH_MS) return Promise.resolve(e.txt);
  if (e && e.inflight) return e.inflight;
  const p = (async () => {
    const r = await fetchT(url, { headers }, timeoutMs);
    const txt = r.ok ? await r.text() : '';
    if (!txt.includes('#EXTM3U')) throw new Error('upstream ' + r.status);
    return txt;
  })();
  plFetchCache.set(key, { t: now, inflight: p });
  return p.then(txt => {
    plFetchCache.set(key, { t: Date.now(), txt, inflight: null });
    return txt;
  }).catch(err => {
    plFetchCache.delete(key);
    throw err;
  });
}

// Segmento: 1) Cache API normalizzata  2) edge CF (bust 30s)  3) origine.
// Cache write SOLO per 200 con contenuto video (mai HTML/JSON di protezione).
function isVideoCt(ct) { ct = String(ct || '').toLowerCase(); return /mpegurl|mp2t|mp4|octet-stream|video\//.test(ct) && !/html|json|xml/.test(ct); }
async function fetchSegmentWithCache(target, h, range) {
  const key = segCacheKey(target);
  if (SEGCACHE && !range) {
    try {
      const hit = await SEGCACHE.match(key);
      if (hit) {
        segStat.apiHits++;
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
  const out = rewriteAny(txt, baseUrl, Object.assign({}, ctx, { stateKey: slug + '|' + prov }));
  // v10.6 G: prefetch in background dei segmenti piu' nuovi. Quando il player
  // li chiede sono gia' nella cache edge CF: anti-microscatti, zero attesa.
  if (!p.isMaster && PREFETCH_SEGS > 0) {
    const news = p.segs.slice(-PREFETCH_SEGS);
    for (const s of news) {
      try {
        const abs = absSegUrl(s.url, baseUrl);
        bg(() => warmSeg(abs, ctx));
      } catch (e) {}
    }
  }
  plCacheSet(ck, out);
  return R(out, 200, HLS_NO_CACHE());
}

// v10.6 G: prefetch dei nuovi segmenti tramite fetchSegmentWithCache:
// popola la Cache API NORMALIZZATA (stessa chiave del player, sopravvive
// alla rotazione token) + cache edge CF (stesso bust a 30s)
async function warmSeg(abs, ctx) {
  const ref = (ctx && ctx.ref) || 'https://thedaddy.li/';
  const h = getBrowserHeaders(ref, ((ctx && ctx.ch) || '') + '|' + ((ctx && ctx.prov) || ''));
  const o = ctx && ctx.origin;
  if (o) h['Origin'] = o;
  if (ref.includes('thedaddy') || ref.includes('dembed')) { h['Referer'] = 'https://dembed.st/'; h['Origin'] = 'https://dembed.st'; }
  try {
    const withBust = abs + (abs.includes('?') ? '&' : '?') + '_t=' + (Math.floor(Date.now() / BUST_MS) * BUST_MS);
    await fetchSegmentWithCache(withBust, h, null);
  } catch (e) {}
}

// --- v10.8 Q: ANTI-AFFATICAMENTO ZAPPING -----------------------------------
// Al primo poll di un canale i provider DI RIPIEGO vengono pre-riscaldati in
// background (token NTV / resolve Vavoo / edge Daddy gia' in cache). Quando
// cambi canale o il provider primario cade, il fallback parte gia' caldo.
// Costo: ~zero dopo il primo giro (tutte le resolution hanno cache propria).
async function preWarmProv(p, c) {
  try {
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
  return entry;
}
async function ntvPlaylist(id, slug) {
  let tk = await ntvToken(id, slug);
  let r = await fetchT(tk.m3u8, { headers: getBrowserHeaders(tk.ref, (slug || '') + '|ntv') }, 12000);
  let txt = r.ok ? await r.text() : '';
  if (!r.ok || r.status >= 500 || !txt.includes('#EXTM3U')) {
    tokenCache.delete(id); ntvStats.refresh++;
    tk = await ntvToken(id, slug);
    r = await fetchT(tk.m3u8, { headers: getBrowserHeaders(tk.ref, (slug || '') + '|ntv') }, 12000);
    txt = r.ok ? await r.text() : '';
  }
  if (!txt.includes('#EXTM3U')) throw new Error('ntv playlist ' + r.status + ' non-HLS');
  return { txt, ref: tk.ref, base: tk.m3u8 };
}

// --- PROVIDER DADDY (INTATTO dalla v10.4) ----------------------------------
const DADDY_DOMAINS = ['https://thedaddy.li', 'https://daddylivetv.sbs'];
async function daddyResolve(id, slug, forceEmbeds) {
  if (!id) return null;
  const now = Date.now();
  const cached = daddyCache.get(id);
  if (cached && cached.exp > now) return cached.url;
  if (daddyCache.size > MAX_DADDY_CACHE) {
    const ks = Array.from(daddyCache.keys());
    for (let i = 0; i < ks.length - MAX_DADDY_CACHE; i++) daddyCache.delete(ks[i]);
  }
  // v10.7 I: edge URL STABILE dal repo daddy-channels: zero estrazioni.
  // La playlist si scarica da qui su ogni poll, il token (nel contenuto) ruota
  // ogni 120s lato server: nessuna URL da ritirare. Se fallisce, memo 60s di
  // edge-fail e si riparte dalla catena embed.
  if (!forceEmbeds && DADDY_EDGE_IDS.indexOf(String(id)) >= 0) {
    const failedAt = daddyEdgeFail.get(String(id)) || 0;
    if (Date.now() - failedAt > DADDY_EDGE_FAIL_TTL) {
      const eu = DADDY_EDGE_BASE + '/premium' + id + '/index.m3u8';
      daddyCache.set(id, { url: eu, exp: now + DADDY_TTL });
      return eu;
    }
  }
  return await daddyResolveEmbeds(id, slug);
}
async function daddyResolveEmbeds(id, slug) {
  if (!id) return null;
  const now = Date.now();
  for (const domain of DADDY_DOMAINS) {
    try {
      let m3u8 = await extractM3u8FromEmbed(`${domain}/cast/stream-${id}.php`, domain, 8000);
      if (m3u8) { daddyCache.set(id, { url:m3u8, exp:now + DADDY_TTL }); cbClear(slug, 'daddy'); return m3u8; }
      m3u8 = await extractM3u8FromEmbed(`${domain}/embed/stream-${id}.php`, domain, 8000);
      if (m3u8) { daddyCache.set(id, { url:m3u8, exp:now + DADDY_TTL }); cbClear(slug, 'daddy'); return m3u8; }
      m3u8 = await extractM3u8FromEmbed(`${domain}/watch.php?id=${id}`, domain, 8000);
      if (m3u8) { daddyCache.set(id, { url:m3u8, exp:now + DADDY_TTL }); cbClear(slug, 'daddy'); return m3u8; }
    } catch (e) { continue; }
  }
  cbRecordFail(slug, 'daddy');
  return null;
}
async function extractM3u8FromEmbed(url, ref, timeoutMs) {
  const r = await fetchT(url, { headers: getBrowserHeaders(ref + '/', ref), cf:{ cacheTtl:300, cacheEverything:true } }, timeoutMs);
  if (!r.ok) return null;
  const html = await r.text();
  const m = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if (m) return m[1];
  const iframe = html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
  if (!iframe) return null;
  const r2 = await fetchT(iframe[1], { headers: getBrowserHeaders(url, ref), cf:{ cacheTtl:300, cacheEverything:true } }, timeoutMs);
  if (!r2.ok) return null;
  const html2 = await r2.text();
  const m2 = html2.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if (m2) return m2[1];
  const if2 = html2.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
  if (!if2) return null;
  const r3 = await fetchT(if2[1], { headers: getBrowserHeaders(iframe[1], ref), cf:{ cacheTtl:300, cacheEverything:true } }, timeoutMs);
  if (!r3.ok) return null;
  const m3 = (await r3.text()).match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  return m3 ? m3[1] : null;
}
function getBrowserHeaders(referer, uaKey) {
  return {
    'User-Agent': uaFor(uaKey || referer), 'Accept': '*/*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer, 'Origin': referer.replace(/\/$/, ''),
    'Sec-Fetch-Dest':'empty', 'Sec-Fetch-Mode':'cors', 'Sec-Fetch-Site':'cross-site',
    'Upgrade-Insecure-Requests':'1'
  };
}

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
  return cached;
}
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
  return best;
}
const vavooHeaders = extra => Object.assign({
  'User-Agent':'MediaHubMX/2', 'Accept':'application/json',
  'Origin':'https://vavoo.to', 'Referer':'https://vavoo.to/'
}, extra || {});
async function vavooResolveId(base, id) {
  const play = base + '/live/play/' + id;
  try {
    const r = await fetchT(base + '/live/resolve?url=' + encodeURIComponent(play), { headers: getBrowserHeaders(base + '/', base) }, 6000);
    if (r.ok) { const j = await r.json().catch(() => null); if (j && j.url) return j.url; }
  } catch (e) {}
  try {
    const r = await fetchT(base + '/mediahubmx-resolve.json', {
      method:'POST', headers: vavooHeaders({ 'Content-Type':'application/json', 'Origin':base, 'Referer':base + '/' }),
      body: JSON.stringify({ language:'de', region:'DE', url:play, clientVersion:'3.0.2' })
    }, 6000);
    if (r.ok) { const j = await r.json().catch(() => null); if (j && j.url) return j.url; }
  } catch (e) {}
  return null;
}
async function vavooLiveFind(base, query) {
  try {
    const rl = await fetchT(base + '/mediahubmx-list.json', {
      method:'POST', headers: vavooHeaders({ 'Content-Type':'application/json', 'Origin':base, 'Referer':base + '/' }),
      body: JSON.stringify({ language:'it', region:'IT', clientVersion:'3.0.2', url:base + '/live' })
    }, 6000);
    if (!rl.ok) return null;
    const j = await rl.json().catch(() => null);
    const items = (j && (j.items || j.channels || j.entries)) || [];
    const tmp = new Map();
    for (const it of items) {
      const nm = it.name || it.title || '';
      const iid = it.id || ((it.url || '').match(/play\/(\d+)/) || [])[1];
      if (nm && iid) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/, '')); if (k && !tmp.has(k)) tmp.set(k, String(iid)); }
    }
    return vavooMapFind(query, tmp);
  } catch (e) { return null; }
}
async function tryVavooId(id) {
  for (const base of VAVOO_MIRRORS.slice(0, 4)) {
    try { const u = await vavooResolveId(base, id); if (u) return u; } catch (e) {}
  }
  return null;
}
async function vavooResolveDual(slug, query, vid6, vid7) {
  const t0 = Date.now();
  const cacheKey = slug || ('q:' + norm(query));
  const cachedUrl = vavooURLCache.get(cacheKey);
  if (cachedUrl && cachedUrl.exp > t0) return cachedUrl.url;
  const healthKey = slug || norm(query);
  const health = getVavooHealth(healthKey);
  const m = await ensureVavooMap();
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
    const url = await tryVavooId(cand.id);
    if (url) {
      updateVavooHealth(healthKey, cand.num);
      vavooURLCache.set(cacheKey, { url, exp:Date.now() + VAVOO_URL_TTL });
      cbClear(slug, 'vavoo');
      return url;
    }
    if (cand.num) recordVavooFail(healthKey, cand.num);
  }
  if (Date.now() - t0 < RESOLVE_BUDGET && vavooMap.t && Date.now() - vavooMap.t > 45*60*1000) {
    try {
      const m2 = await ensureVavooMap(true);
      const id2 = m2 ? vavooMapFind(query || '', m2) : null;
      if (id2 && id2 !== mapId) {
        const u2 = await tryVavooId(id2);
        if (u2) {
          updateVavooHealth(healthKey, 0);
          vavooURLCache.set(cacheKey, { url:u2, exp:Date.now() + VAVOO_URL_TTL });
          cbClear(slug, 'vavoo');
          return u2;
        }
      }
    } catch (e) {}
  }
  cbRecordFail(slug, 'vavoo');
  return null;
}
async function vavooResolve(query, vid) {
  const c = findCh(query);
  if (c) return await vavooResolveDual(c.slug, c.vavoo || query, c.vid6, c.vid7);
  return await vavooResolveDual(null, query, vid, null);
}

// --- ROTTA /live (provider intatti, solo cache output ridotta a 2s) --------
async function live(u, P, legacy) {
  countReq('live');
  cleanupStaleState();
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
    return false;
  });
  if (!available.length) return R('NESSUN provider mappato per ' + c.name, 200, TXT());
  const ordered = [];
  for (const p of prefList) if (available.includes(p) && !ordered.includes(p)) ordered.push(p);
  for (const p of available) if (!ordered.includes(p)) ordered.push(p);

  // v10.6 H: ordine adattivo PER CANALE: provider andato ko di recente su questo
  // canale scende in coda; quello che funziona sale. Ogni canale decide da solo.
  ordered.sort((a, b) => provRank(c.slug, b) - provRank(c.slug, a));

  const good = ordered.filter(p => segFailCount(c.slug, p) < SEGFAIL_MAX);
  const bad  = ordered.filter(p => segFailCount(c.slug, p) >= SEGFAIL_MAX);
  const finalOrder = good.concat(bad);

  const cbLive = finalOrder.filter(p => !cbInCooldown(c.slug, p));
  const cbFrozen = finalOrder.filter(p => cbInCooldown(c.slug, p));
  const tryOrder = cbLive.concat(cbFrozen);

  // v10.8 Q: pre-riscalda i provider di ripiego DI QUESTO CANALE in background:
  // se il primario cade (o zappi di continuo), il fallback e' gia' pronto.
  for (let i = 1; i < tryOrder.length; i++) { const pp = tryOrder[i]; if (pp) bg(() => preWarmProv(pp, c)); }

  const ck = c.slug + ':' + tryOrder.join('.');
  const cachedOut = plCacheGet(ck);
  if (cachedOut) return R(cachedOut, 200, HLS_NO_CACHE());

  const provs = {
    vavoo: async () => {
      if (!c.vavoo && !c.vid6 && !c.vid7) return null;
      if (segFailCount(c.slug, 'vavoo') >= SEGFAIL_MAX) {
        vavooURLCache.delete(c.slug); clearSegFails(c.slug, 'vavoo');
        log('vavoo ' + c.slug + ': re-resolve');
      } else if (segFailCount(c.slug, 'vavoo') >= SEGFAIL_EARLY) {
        const ent = vavooURLCache.get(c.slug);
        if (ent && ent.exp - Date.now() < 40000) { vavooURLCache.delete(c.slug); log('vavoo ' + c.slug + ': early re-resolve'); }
      }
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/i.test(vu)) {
        const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent':'VAVOO/1.0' }) }, 12000);
        if (!r.ok) { vavooURLCache.delete(c.slug); cbRecordFail(c.slug, 'vavoo'); return null; }
        const txt = await r.text();
        if (!txt.includes('#EXTM3U')) { vavooURLCache.delete(c.slug); cbRecordFail(c.slug, 'vavoo'); return null; }
        return emitPlaylist(ck, c.slug, 'vavoo', txt, vu, { P, ch:c.slug, prov:'vavoo', ref:'https://vavoo.to/', origin:'https://vavoo.to' });
      }
      return R('redirect vavoo', 302, { Location:vu, ...CORS() });
    },
    ntv: async () => {
      if (!c.ntv) return null;
      const pl = await ntvPlaylist(c.ntv, c.slug);
      return emitPlaylist(ck, c.slug, 'ntv', pl.txt, pl.base, { P, ch:c.slug, prov:'ntv', ref:pl.ref, origin:'' });
    },
    daddy: async () => {
      if (!c.daddy) return null;
      // v10.7: edge URL stabile (0 estrazioni) + single-flight playlist (4s).
      // Se l'edge fallisce: memo 60s e fallback catena embed nello STESSO poll.
      const dh = getBrowserHeaders('https://dembed.st/', c.slug + '|daddy');
      let du = await daddyResolve(c.daddy, c.slug);
      let txt = null;
      if (du && /\.m3u8/i.test(du)) {
        try { txt = await fetchUpstreamPl('daddy|' + c.daddy, du, dh, 12000); }
        catch (e) {
          if (/wedd48c|edge\./i.test(du)) {
            daddyEdgeFail.set(String(c.daddy), Date.now()); daddyCache.delete(c.daddy);
            log('daddy edge ko ' + c.daddy + ' -> embeds');
            du = null;
          } else { cbRecordFail(c.slug, 'daddy'); return null; }
        }
      } else du = null;
      if (!du) {
        du = await daddyResolve(c.daddy, c.slug, true);
        if (!du || !/\.m3u8/i.test(du)) return null;
        const r = await fetchT(du, { headers: dh }, 12000);
        txt = r.ok ? await r.text() : '';
        if (!txt.includes('#EXTM3U')) { daddyCache.delete(c.daddy); cbRecordFail(c.slug, 'daddy'); return null; }
      }
      const body = rewriteAny(txt, du, { P, ch:c.slug, prov:'daddy', ref:'https://dembed.st/', origin:'https://dembed.st' });
      const lines = body.split('\n');
      if (lines[0] === '#EXTM3U')
        lines.splice(1, 0, '#EXTVLCOPT:http-referrer=https://dembed.st/', '#EXTVLCOPT:http-user-agent=' + uaFor(c.slug + '|daddy'));
      const out = lines.join('\n');
      plCacheSet(ck, out); cbClear(c.slug, 'daddy');
      return R(out, 200, HLS_NO_CACHE());
    }
  };

  let lastErr = '';
  for (const p of tryOrder) {
    const fn = provs[p];
    if (!fn) continue;
    try {
      const res = await fn();
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
    const line = raw.trim();
    if (!line) continue;
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
      continue;
    }
    if (line.startsWith('#')) continue;
    if (pending) { pending.url = line; segs.push(pending); pending = null; }
  }
  return { upSeq, upTarget, upVersion, map, segs, isMaster, endlist };
}

// v10.8: finestra adattiva sulle durate reali, con TARGET/MIN PER PROVIDER:
// ogni provider sta al proprio delay minimo stabile, nessuno e' limitato
// dagli altri. Vavoo viene comunque trimmato via EXT-X-START in rewriteMediaPl.
function pickWindow(durs, prov) {
  const n = durs.length;
  if (!n) return { count:0, sum:0 };
  const cfg = delayCfg(prov);
  let count = 0, sum = 0;
  for (let i = n - 1; i >= 0; i--) {
    count++; sum += durs[i];
    if (count >= PROV_PREF_SEGS && sum >= cfg.target) break;
  }
  while (count > MIN_SEGS && sum - durs[n - count] >= cfg.min) { sum -= durs[n - count]; count--; }
  return { count, sum };
}

function absSegUrl(url, baseUrl) {
  if (/^https?:\/\//i.test(url)) return url;
  let abs;
  if (url.startsWith('/')) abs = new URL(baseUrl).origin + url;
  else abs = baseUrl.replace(/[^/]*$/, '') + url.replace(/^\.\//, '');
  return abs.replace(/([^:])\/{2,}/g, '$1/');
}

// v10.5 FIX PRINCIPALE: bust _t stabile 30s. Prima era assente -> cache edge
// 600s di segmenti vecchi = live edge finto, scene ripetute, delay 70s+.
// Ora: stesso URL per 30s (riuso cache tra poll/spettatori), cambia dopo ->
// freshness guaranteed, nessun segmento vecchio di piu' di ~30s.
function proxUrl(abs, ctx) {
  const bust = Math.floor(Date.now() / BUST_MS) * BUST_MS;
  const withBust = abs + (abs.includes('?') ? '&' : '?') + '_t=' + bust;
  let u = ctx.P + '/seg?u=' + encodeURIComponent(withBust);
  if (ctx.ref)    u += '&ref=' + encodeURIComponent(ctx.ref);
  if (ctx.origin) u += '&o='   + encodeURIComponent(ctx.origin);
  if (ctx.ch)     u += '&ch='  + encodeURIComponent(ctx.ch);
  if (ctx.prov)   u += '&p='   + encodeURIComponent(ctx.prov);
  return u;
}

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
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#EXTM3U')) continue;
    if (line.startsWith('#EXT-X-MEDIA')) {
      const mu = line.match(/URI="([^"]+)"/);
      media.push(mu ? line.replace(/URI="[^"]+"/, 'URI="' + proxUrl(absSegUrl(mu[1], baseUrl), ctx) + '"') : line);
      continue;
    }
    if (line.startsWith('#EXT-X-I-FRAME-STREAM-INF')) {
      const mu = line.match(/URI="([^"]+)"/);
      iframes.push(mu ? line.replace(/URI="[^"]+"/, 'URI="' + proxUrl(absSegUrl(mu[1], baseUrl), ctx) + '"') : line);
      continue;
    }
    if (line.startsWith('#EXT-X-STREAM-INF')) { pending = line; continue; }
    if (line.startsWith('#')) { media.push(line); continue; }
    if (pending) {
      const bw = parseInt((pending.match(/BANDWIDTH=(\d+)/) || [])[1] || '0');
      const rm = pending.match(/RESOLUTION=(\d+)x(\d+)/);
      if (!isAudioOnlyStreamInf(pending) && bw > maxBw) { maxBw = bw; maxRes = rm ? rm[1] + 'x' + rm[2] : '?'; }
      variants.push({ line: pending, url: line, audioOnly: isAudioOnlyStreamInf(pending), bw });
      pending = null;
    }
  }
  if (maxBw && ctx && ctx.ch)
    log('quality ' + ctx.ch + ': max ' + maxRes + ' @ ' + Math.round(maxBw/1000) + 'kbps (' + variants.filter(v => !v.audioOnly).length + ' variant)');
  const video = variants.filter(v => !v.audioOnly).sort((a, b) => b.bw - a.bw);
  const audio = variants.filter(v => v.audioOnly);
  const out = ['#EXTM3U'];
  out.push(...media);
  for (const v of video) out.push(v.line, proxUrl(absSegUrl(v.url, baseUrl), ctx));
  for (const v of audio) out.push(v.line, proxUrl(absSegUrl(v.url, baseUrl), ctx));
  out.push(...iframes);
  return out.join('\n');
}

function rewriteMediaPl(txt, baseUrl, ctx) {
  const p = parseMediaPl(txt);
  if (p.isMaster || !p.segs.length) return rewriteMaster(txt, baseUrl, ctx);
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs, ctx && ctx.prov);
  const kept = p.segs.slice(-plan.count);
  const dropped = p.segs.length - kept.length;
  let seq = p.upSeq + dropped;
  let discontTop = false;
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
  // v10.8 F: trim del delay PER PROVIDER. Se la finestra minimizzata supera il
  // target del provider (es. Vavoo 2x17s = 34s vs target 28s), il player parte
  // dentro la window: delay effettivo = target di quel provider.
  const pTarget = delayCfg(ctx && ctx.prov).target;
  const offset = Math.max(0, plan.sum - pTarget);
  const out = ['#EXTM3U', '#EXT-X-VERSION:' + version, '#EXT-X-TARGETDURATION:' + p.upTarget, '#EXT-X-MEDIA-SEQUENCE:' + seq];
  if (EXT_START_TRIM && offset > 0.5 && !p.endlist)
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
  });
  return out.join('\n');
}

// --- ROTTA /seg (FIX FRESHNESS: cache 30s, era 600s) -----------------------
async function seg(u, req) {
  countReq('seg');
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
    // v10.7 M: single-flight anche per le playlist annidate (N viewer = 1 fetch)
    let txt;
    try { txt = await fetchUpstreamPl('m|' + prov + '|' + target, target, h, 12000); }
    catch (e) { return R('upstream playlist', 502, TXT()); }
    const baseDir = target.substring(0, target.lastIndexOf('/') + 1) || target;
    const out = rewriteAny(txt, baseUrl_of(baseDir), { P:u.origin, ref, origin:o||'', ch, prov, stateKey:'m|' + prov + '|' + target });
    return R(out, 200, HLS_NO_CACHE());
  }

  let r, attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    // v10.7 L: Cache API normalizzata + edge CF (bust 30s) + origine
    const signed = await fetchSegmentWithCache(target, h, range);
    r = signed.resp;
    const ct = r.headers.get('content-type') || '';
    const isHtmlBody = r.ok && /^(text\/html|application\/json|text\/xml)/i.test(ct);
    if (!r.ok && !range) {
      recordSegFail(ch, prov);
      if (attempts < maxAttempts) { log('seg retry ' + attempts + ' per ' + (ch || '?') + ' (status ' + r.status + ')'); continue; }
      return R('upstream ' + r.status, r.status, TXT());
    } else if (isHtmlBody && !range) {
      recordSegFail(ch, prov);
      if (attempts < maxAttempts) { log('seg html retry ' + attempts + ' per ' + (ch || '?')); continue; }
      return R('upstream corrotto ' + r.status, r.status, TXT());
    } else if (!r.ok) {
      recordSegFail(ch, prov);
      return R('upstream ' + r.status, r.status, TXT());
    }
    break;
  }

  const hh = {
    'content-type': r.headers.get('content-type') || 'video/mp2t',
    'access-control-allow-origin':'*', 'access-control-allow-methods':'GET, HEAD, OPTIONS',
    'access-control-allow-headers':'Range, User-Agent, Referer, Origin',
    'access-control-expose-headers':'Content-Length, Content-Range, Accept-Ranges',
    'accept-ranges':'bytes',
    // FIX: max-age=30 anche verso il player (era 600: le TV app mettono in
    // cache lato client i segmenti vecchi e il ritardo non scendeva mai)
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
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${c.name} - TVNOW</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    video { width: 100%; max-width: 1200px; height: auto; background: #000; }
    .controls { position: fixed; top: 10px; left: 10px; color: #fff; font-family: monospace; background: rgba(0,0,0,0.85); padding: 15px; border-radius: 8px; font-size: 13px; line-height: 1.6; backdrop-filter: blur(10px); z-index: 1000; }
    .controls div { margin: 2px 0; }
    .title { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
    .status { color: #4CAF50; }
    .status.error { color: #f44336; }
    .status.loading { color: #FFC107; }
  </style>
</head>
<body>
  <div class="controls">
    <div class="title">📺 ${c.name}</div>
    <div>Player: HLS.js | Delay 16-28s (per provider) | Quality: MAX</div>
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
        debug: false, enableWorker: true, lowLatencyMode: false,
        backBufferLength: 20,
        // v10.8: sync sul floor del provider piu' rapido: se il canale sta su
        // NTV (21s) o Daddy (18s), il player segue invece di tenere 25s+;
        // sopra i 32s accelera a 1.5x e rientra. Il ritardo non si accumula.
        liveSyncDuration: 18,
        liveMaxLatencyDuration: 32,
        maxLiveSyncPlaybackRate: 1.5,
        maxBufferLength: 20,
        maxMaxBufferLength: ${MAX_BUFFER_SECS},
        maxBufferSize: 60 * 1000 * 1000, maxBufferHole: 0.5,
        capLevelToPlayerSize: false, autoStartLoad: true,
        nudgeMaxRetry: 10, fragLoadingMaxRetry: 8, manifestLoadingMaxRetry: 4
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        status.textContent = '✅ Stream caricato';
        status.className = 'status';
        video.play().catch(e => console.log('Autoplay bloccato:', e));
        if (data.levels && data.levels.length > 0) {
          let bestIdx = 0;
          data.levels.forEach((l, i) => { if ((l.bitrate || 0) > (data.levels[bestIdx].bitrate || 0)) bestIdx = i; });
          hls.currentLevel = bestIdx;
          const lv = data.levels[bestIdx];
          quality.textContent = 'Qualità: ' + lv.width + 'x' + lv.height + ' @ ' + Math.round((lv.bitrate || 0) / 1000) + 'kbps (MAX)';
        }
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            status.textContent = '🔄 Riconnessione...';
            status.className = 'status loading';
            setTimeout(() => hls.startLoad(), 1000);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            status.textContent = '🔄 Media recovery...';
            status.className = 'status loading';
            hls.recoverMediaError();
          } else {
            status.textContent = '❌ Errore: ' + data.type;
            status.className = 'status error';
            hls.destroy();
          }
        }
      });
      setInterval(() => {
        if (video.buffered.length > 0) {
          const buffered = video.buffered.end(video.buffered.length - 1) - video.currentTime;
          buffer.textContent = 'Buffer: ' + buffered.toFixed(1) + 's | Delay ≈ min(buffer, 30)s';
        }
      }, 1000);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      status.textContent = '✅ Safari nativo';
      status.className = 'status';
      video.src = streamUrl;
    } else {
      status.textContent = '❌ Browser non supportato';
      status.className = 'status error';
    }
  </script>
</body>
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
    const cc = findCh(ch);
    if (cc) slug = cc.slug;
    if (source === 'ntv') {
      const pl = await ntvPlaylist(ch, slug); txt = pl.txt; headers = getBrowserHeaders(pl.ref, slug + '|ntv');
    } else if (source === 'daddy') {
      const du = await daddyResolve(ch, slug);
      if (!du) return R('Daddy non risolto', 200, TXT());
      const r = await fetchT(du, { headers: getBrowserHeaders('https://dembed.st/', slug + '|daddy') }, 10000);
      if (!r.ok) return R('Daddy HTTP ' + r.status, 200, TXT());
      txt = await r.text(); headers = getBrowserHeaders('https://dembed.st/', slug + '|daddy');
    } else if (source === 'vavoo') {
      const c = findCh(ch);
      if (!c) return R('Vavoo: canale non trovato', 200, TXT());
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      if (!vu) return R('Vavoo non risolto', 200, TXT());
      const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent':'VAVOO/1.0' }) }, 10000);
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

async function warm() {
  const t0 = Date.now();
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
    const t0 = Date.now();
    try {
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      L.push('1) VAVOO: ' + (vu ? 'OK (' + (Date.now()-t0) + 'ms)\n     URL upstream: ' + vu : 'skip'));
    } catch (e) { L.push('1) VAVOO: ERR ' + e.message); }
  } else L.push('1) VAVOO: skip');
  if (c.ntv) {
    const t0 = Date.now();
    try {
      const pl = await ntvPlaylist(c.ntv, c.slug);
      L.push('2) NTV: OK (' + (Date.now()-t0) + 'ms)\n     URL upstream: ' + pl.base);
    } catch (e) { L.push('2) NTV: ERR ' + e.message); }
  } else L.push('2) NTV: skip');
  if (c.daddy) {
    const t0 = Date.now();
    try {
      const du = await daddyResolve(c.daddy, c.slug);
      L.push('3) DADDY: ' + (du ? 'OK (' + (Date.now()-t0) + 'ms)\n     URL upstream: ' + du : 'skip'));
    } catch (e) { L.push('3) DADDY: ERR ' + e.message); }
  } else L.push('3) DADDY: skip');
  return L.join('\n');
}

const vmap = async () => {
  const m = await ensureVavooMap(true);
  return m ? 'VMAP: ' + m.size + ' canali (' + vavooMap.src + ')' : 'VMAP: nessuna fonte';
};

async function diag(u) {
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
    try { const txt = await fn(); L.push('-- ' + label + ' (' + (Date.now()-t0) + 'ms) --', 'OK | ' + playlistStats(txt, String(label).split(' ')[0].toLowerCase())); }
    catch (e) { L.push('-- ' + label + ' (' + (Date.now()-t0) + 'ms) --', 'ERR: ' + (e && e.message)); }
    L.push('');
  };
  if (c.vavoo || c.vid6 || c.vid7) await tryP('VAVOO', async () => {
    const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
    if (!vu) throw new Error('non risolto');
    const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent':'VAVOO/1.0' }) }, 12000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  });
  if (c.ntv) await tryP('NTV', async () => (await ntvPlaylist(c.ntv, c.slug)).txt);
  if (c.daddy) await tryP('DADDY', async () => {
    const du = await daddyResolve(c.daddy, c.slug);
    if (!du) throw new Error('non risolto');
    const r = await fetchT(du, { headers: getBrowserHeaders('https://dembed.st/', c.slug + '|daddy') }, 12000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  });
  L.push('=== FATTORI DI DELAY (v10.8: target per provider) ===',
    'delay totale = ritardo interno della FONTE + finestra (per provider) + buffer del player',
    'NTV:   target ' + PROV_DELAY.ntv.target + 's (3 seg x ~7s)   <- il provider con il delay minore',
    'DADDY: target ' + PROV_DELAY.daddy.target + 's (3-5 seg x 4-6s)',
    'VAVOO: target ' + PROV_DELAY.vavoo.target + 's (2 seg x 17s + trim EXT-X-START)',
    'Ogni provider e\' al SUO minimo stabile, nessuno limitato dagli altri.',
    'v10.7: risoluzione Daddy via edge.json (0 estrazioni) + Cache API senza token + single-flight 4s',
    'v10.8: cleanup completo della memoria (niente morti a 30min) + pre-riscaldamento fallback (zapping fluido).');
  L.push('=== PRESERVAZIONE RICHIESTE (v10.7) ===',
    'Daddy: risoluzione via edge.wedd48c.top (URL stabili daddy-channels) = 0 estrazioni embed;',
    'catena embed solo come fallback dopo un edge-fail (memo 60s).',
    'Segmenti: 3 livelli -> Cache API (chiave senza token, 120s, sopravvive alla rotazione)',
    '-> edge CF (bust 30s) -> origine. Multi-viewer: 1 download, tutti lo riusano.',
    'Playlist upstream: single-flight 4s (N viewer/poll ravvicinati = 1 fetch).',
    'Effetto in /debug: riga "Risparmio" -> % segmenti serviti senza toccare l\'origine.');
  return L.join('\n');
}

function playlistStats(txt, prov) {
  const p = parseMediaPl(txt);
  if (p.isMaster) return 'master playlist';
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs, prov);
  const cfg = delayCfg(prov);
  const total = durs.reduce((a,b) => a+b, 0);
  return 'fonte ' + p.segs.length + ' segs / ' + total.toFixed(1) + 's'
    + ' | finestra ' + plan.count + '/' + plan.sum.toFixed(1) + 's'
    + ' | delay ' + prov.toUpperCase() + ' ~' + Math.min(plan.sum, cfg.target).toFixed(0) + 's (target ' + cfg.target + 's)';
}

function debug() {
  const vm = vavooMapGet();
  const sf = []; const now = Date.now();
  for (const [k, arr] of segFails) { const live = arr.filter(t => now - t < SEGFAIL_TTL); if (live.length) sf.push(k + '=' + live.length); }
  const cds = [];
  for (const [k, until] of cbCooldown) if (until > now) cds.push(k);
  return [
    VER,
    'Cache: NTV=' + tokenCache.size + ' | Daddy=' + daddyCache.size + ' | VavooURL=' + vavooURLCache.size,
    'Vavoo map: ' + (vm ? vm.size + ' (' + Math.round((Date.now() - vavooMap.t)/60000) + ' min)' : 'non caricata'),
    'Delay/provider: ntv ' + PROV_DELAY.ntv.target + 's | daddy ' + PROV_DELAY.daddy.target + 's | vavoo ' + PROV_DELAY.vavoo.target + 's | trim EXT-X-START=' + (EXT_START_TRIM ? 'ON' : 'off') + ' | cache seg ' + SEG_CACHE_TTL + 's + bust ' + (BUST_MS/1000) + 's',
    'Stream: ' + plState.size + ' | Cache PL: ' + plCache.size,
    'CB cooldown attivi: ' + (cds.join(', ') || 'nessuno'),
    'SegFails: ' + (sf.join(', ') || 'nessuno'),
    'NTV: resolve=' + ntvStats.resolve + ' refresh=' + ntvStats.refresh + ' err=' + ntvStats.err,
    'Richieste: live=' + reqStats.live + ' seg=' + reqStats.seg,
    'Risparmio: seg cache-api hit=' + segStat.apiHits + ' fetch origine/cf=' + segStat.origin + ' (' + (segStat.apiHits + segStat.origin ? Math.round(segStat.apiHits * 100 / (segStat.apiHits + segStat.origin)) : 0) + '% serviti senza toccare l\'origine)',
    'Log:\n  ' + (logs.slice(-15).join('\n  ') || '(vuoti)')
  ].join('\n');
}

function uso(P) {
  return [VER, '',
    'uso:',
    '  /live?ch=<slug>                delay ~25-30s',
    '  /live?ch=<slug>&p=vavoo,ntv   ordine preferito (fallback reale)',
    '  /player?ch=<slug>              player HLS.js (latenza controllata + catch-up)',
    '  /diag?ch=sky-sport-f1          diagnostica: finestra e delay per-provider',
    '  /probe?ch=sky-sport-f1         probe rapido + URL upstream (test VLC)',
    '  /checkseg?s=<ntv|vavoo|daddy>&ch=<id>  test segmento',
    '  /segtest?u=<url>&ref=<referer> test URL diretto',
    '  /warm /vmap /debug /ch /rawu /ip  utility',
    '',
    'FIX v10.5:',
    '  • Cache edge segmenti 600s -> 30s (la 600s serviva segmenti vecchi di minuti)',
    '  • Bust _t reintegrato, stabile 30s (freshness garantita, quota protetta)',
    '  • Finestra adattiva su durate EXTINF reali: 25-28s',
    'FIX v10.6:',
    '  • Delay EFFETTIVO 25-30s garantito per ogni canale e provider (EXT-X-START trim)',
    '  • Prefetch bg del segmento nuovo: meno microscatti',
    '  • Ordine provider adattivo PER CANALE (provScore): canali 100% indipendenti',
    'FIX v10.7 (preservazione richieste, daddy-channels):',
    '  • Risoluzione Daddy da URL edge stabili (edge.json): ZERO estrazioni embed',
    '  • Cache API segmenti con chiave senza token: sopravvive alla rotazione 120s',
    '  • Single-flight playlist upstream 4s: N viewer = 1 fetch origine',
    '  • Prefetch popola la Cache API normalizzata',
    ''].join('\n');
}

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
  let r;
  try { r = await fetchT(t, { headers:h, redirect:'follow' }, 20000); }
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
  return fetch(url, o);
}
// ███ FINE TVNOW-CF v10.8 DELAY-FIX ███
