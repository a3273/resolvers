// ============================================================================
// TVNOW-CF v11.0 LIVE-TRUTH — freeze reale, niente playlist stantie servite
// ============================================================================
// DIAGNOSI (perché i TTL non hanno mai cambiato nulla):
// Se NTV, Vavoo e Daddy sono fermi sulla STESSA scena alla STESSA ora, non sono
// tre cache indipendenti che si congelano per coincidenza. Le cause possibili
// sono: (A) le fonti rigirano un loop registrato, (B) il worker serve sempre la
// stessa playlist. Le versioni precedenti cambiavano i TTL senza distinguere A da B.
//
// BUG CONCRETI TROVATI NEL CODICE PRECEDENTE:
// 1. RETE DI SICUREZZA CHE ANNULLA IL FREEZE DETECTOR
//    In /live, dopo che tutti i provider fallivano (anche per FREEZE), si pescava
//    da plCache una entry < 60s e la si serviva. Quella entry conteneva i segmenti
//    congelati -> il freeze veniva rilevato e poi servito comunque, all'infinito.
//    FIX: la rete di sicurezza è ammessa SOLO per errori transitori, MAI se un
//    provider è marcato frozen, e solo entro 8s (un ciclo di poll).
//
// 2. #EXT-X-ENDLIST COPIATO DALL'UPSTREAM
//    Con ENDLIST il player tratta la playlist come VOD finito: smette di
//    ricaricarla, l'orario si ferma all'ultimo PDT e il buffer si ripete.
//    FIX: ENDLIST non viene MAI emesso. Se l'upstream lo pubblica, il provider
//    viene marcato "vod" e messo in coda (è una finestra registrata, non live).
//
// 3. FREEZE DETECTOR BASATO SOLO SU MEDIA-SEQUENCE
//    Se la seq oscilla (relay che riparte) o i nomi file sono fissi con contenuto
//    rotante, il controllo non scattava. Inoltre il bust _t ogni 15s faceva
//    sembrare "nuovi" segmenti identici, mascherando il congelamento.
//    FIX: freeze = TUTTI i segnali statici (fingerprint dei path segmenti,
//    MEDIA-SEQUENCE, ultimo PDT) per oltre la soglia. Se uno solo si muove,
//    la fonte è viva.
//
// 4. CLAMP DELLA SEQUENZA CHE MENTIVA AL PLAYER
//    Su regresso upstream si riusava st.lastSeq (stesso valore) con gli stessi
//    URL: il player non vedeva nulla di nuovo e continuava a riprodurre il buffer.
//    FIX: su regresso si emette DISCONTINUITY e seq = lastSeq + 1 (progresso reale
//    segnalato), mai lo stesso valore.
//
// 5. EXT-X-START RIEMESSO A OGNI REFRESH
//    Alcuni player riapplicano il TIME-OFFSET a ogni ricarica e cercano indietro
//    dentro la finestra -> riproduzione ripetuta.
//    FIX: rimosso. Il delay si controlla SOLO con la dimensione della finestra.
//
// STRUMENTO DI VERIFICA (non serve deployare altro):
//   /freeze?ch=sky-sport-24&p=ntv
//   campiona l'upstream due volte a 15s, con cache bypassata, e stampa seq,
//   fingerprint e PDT di entrambi i campioni + verdetto:
//     FONTE FERMA  -> nessun fix lato worker può far avanzare il contenuto
//     FONTE VIVA   -> il problema era lato worker, i fix sopra lo risolvono
//
// INVARIATI: budget subrequest, circuito per canale|provider, filtro H264,
// sonda PMT HEVC, Daddy edge+embed, Vavoo dual-ID + fix IP-literal 1003,
// warm progressivo, heartbeat, single-flight, /metrics.
// ============================================================================

let MODULE_CTX = null;
let SUB_BUDGET = 40;
const subFree = n => SUB_BUDGET >= n;
const subSpend = n => { SUB_BUDGET = Math.max(0, SUB_BUDGET - n); };
const bg = fn => { try { if (MODULE_CTX && MODULE_CTX.waitUntil) MODULE_CTX.waitUntil(Promise.resolve().then(fn).catch(() => {})); } catch (e) {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

export default {
  async fetch(req, env, ctx) {
    MODULE_CTX = ctx || null;
    SUB_BUDGET = 40;
    heartbeat();
    const u = new URL(req.url);
    const P = u.origin;
    const path = u.pathname;
    if (req.method === 'HEAD' || req.method === 'OPTIONS')
      return R('OK', 200, { 'content-type': 'text/plain; charset=utf-8', ...CORS() });
    try {
      switch (path) {
        case '/live':     return await live(u, P, null);
        case '/ntv':      return await live(u, P, 'ntv');
        case '/vavoo':    return await live(u, P, 'vavoo');
        case '/daddy':    return await live(u, P, 'daddy');
        case '/seg':      return await seg(u, req);
        case '/player':   return await player(u, P);
        case '/freeze':   return R(await freezeTest(u), 200, TXT());
        case '/warm':     return await warm();
        case '/rawu':     return await rawu(u);
        case '/vmap':     return R(await vmap(), 200, TXT());
        case '/ch':       return R(elencoCanali(), 200, TXT());
        case '/probe':    return R(await probe(u), 200, TXT());
        case '/dump':     { const rr = await live(u, P, u.searchParams.get('p')); const bb = await rr.text(); return R(bb, 200, TXT()); }
        case '/diag':     return R(await diag(u), 200, TXT());
        case '/debug':    return R(debug(), 200, TXT());
        case '/metrics':  return R(await metrics(), 200, { 'content-type': 'text/plain; version=0.0.4', ...CORS() });
        case '/checkseg': return await checkseg(u);
        case '/segtest':  return await segtest(u);
        case '/unfreeze': return R(unfreeze(u), 200, TXT());
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

// --- CONFIGURAZIONE ---------------------------------------------------------
// Il delay si controlla SOLO con la dimensione della finestra (niente EXT-X-START).
//   win = durata target della finestra pubblicata (= delay dal bordo live)
//   min = sotto questa durata non si accorcia ulteriormente
// Minimo fisico HLS: 2 segmenti. Con segmenti Vavoo da 12-17s il floor è ~24-34s.
const PROV_WIN = {
  ntv:   { win: 14, min: 10 },
  daddy: { win: 16, min: 12 },
  vavoo: { win: 34, min: 24 }
};
const MIN_SEGS = 2;
const winCfg = prov => PROV_WIN[prov] || { win: 24, min: 18 };
const effWinCfg = (slug, prov) => {
  const base = winCfg(prov);
  const e = lagMemo.get((slug || '_') + '|' + (prov || '_'));
  if (e && Date.now() - e.t < LAG_TTL_MS && e.lag > base.win) {
    const need = Math.ceil(e.lag + 4);
    return { win: need, min: need - 2 };
  }
  return base;
};

const PREFETCH_SEGS = 2;
const MAX_BUFFER_SECS = 40;

// Cache segmenti: TTL allineati al bust, mai più lunghi del ciclo di rotazione.
const SEG_CACHE_TTL = 15;
const SEG_API_TTL = 15;
const BUST_MS = 15000;
const CACHE_BUCKET_MS = 15000;

// Freeze: soglia dinamica, mai sotto 3 poll del player.
const FREEZE_MIN_MS = 18000;
const FREEZE_TARGET_MULT = 3;
const FREEZE_BYPASS_TTL = 4 * 60 * 1000;   // bypass cache dopo freeze
const VOD_TTL = 10 * 60 * 1000;            // provider che pubblica ENDLIST

const SEGFAIL_TTL = 3 * 60 * 1000, SEGFAIL_MAX = 3, SEGFAIL_EARLY = 1;
const PL_CACHE_TTL = 2000, RESOLVE_BUDGET = 8000, STATE_STALE_TTL = 15 * 60 * 1000;
const SAFETY_NET_MS = 8000;                // rete di sicurezza: un solo ciclo di poll
const CB_FAIL_WIN = 120 * 1000, CB_FAIL_TH = 6, CB_COOLDOWN = 50 * 1000;
const NTV_REFRESH_MARGIN = 900, VAVOO_URL_TTL = 120 * 1000;
const DADDY_TTL = 10 * 60 * 1000, VAVOO_HEALTH_TTL = 15 * 60 * 1000, VAVOO_MAP_TTL = 8 * 3600 * 1000;
const MAX_TOKEN_CACHE = 80, MAX_DADDY_CACHE = 150;
const PLAYLIST_FRESH_MS = 3000;
const PL_BUST_MS = 2000;
const NO_BUST_TTL = 30 * 60 * 1000;
const H265_TTL = 30 * 60 * 1000;
const LAG_BAD_S = 45, LAG_TTL_MS = 5 * 60 * 1000;
const PROV_SCORE_TTL = 30 * 60 * 1000;
const HEARTBEAT_MS = 5 * 60 * 1000;
const WARM_BATCH = 2;

const VER = 'TVNOW-CF v11.0 LIVE-TRUTH';
const DADDY_EDGE_BASE = 'https://edge.wedd48c.top';
const DADDY_EDGE_IDS = ['869','461','870','576','462','875','460','577','575','574','877','878','879','871','872','873','860','861','862','859','864','865','867','868','863','880'];
const DADDY_EDGE_FAIL_TTL = 60 * 1000;
const DADDY_DOMAINS = ['https://thedaddy.li', 'https://daddylivetv.sbs'];
const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';

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
function strHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }

// --- CANALI -----------------------------------------------------------------
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

// --- UTILITIES --------------------------------------------------------------
const norm = s => String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const BY_KEY = (() => {
  const m = new Map();
  for (const c of CHANNELS) {
    m.set(c.slug, c);
    m.set(norm(c.name), c);
    if (c.ntv) m.set(c.ntv, c);
    if (c.daddy) m.set('d' + c.daddy, c);
  }
  for (const [a, s] of Object.entries(ALIASES)) { const c = m.get(s); if (c) m.set(a, c); }
  return m;
})();
function findCh(q) {
  let k = norm(q);
  if (BY_KEY.has(k)) return BY_KEY.get(k);
  k = k.replace(/-ntv$/, '').replace(/-daddy$/, '');
  return BY_KEY.get(k) || null;
}
function elencoCanali() {
  const L = ['CANALI (' + CHANNELS.length + ') - /live?ch=<slug>'];
  for (const c of CHANNELS)
    L.push('  ' + c.slug.padEnd(24) + ' ntv=' + String(c.ntv || '-').padEnd(4) +
           ' vavoo=' + (c.vavoo || '-').padEnd(18) + ' daddy=' + (c.daddy || '-').padEnd(4));
  return L.join('\n');
}

// --- STATO GLOBALE ----------------------------------------------------------
const tokenCache = new Map(), daddyCache = new Map(), vavooURLCache = new Map();
const vavooHealth = new Map(), segFails = new Map();
const cbFails = new Map(), cbCooldown = new Map();
const plCache = new Map(), plState = new Map();
const daddyEdgeFail = new Map(), plFetchCache = new Map();
const noBustHosts = new Map(), segInflight = new Map();
const h265Memo = new Map(), lagMemo = new Map(), provScore = new Map();
const freshState = new Map();      // slug|prov -> segnali di freschezza
const freezeDetected = new Map();  // slug|prov -> { t, reason }
const vodMark = new Map();         // slug|prov -> t (upstream pubblica ENDLIST)
const SEGCACHE = (typeof caches !== 'undefined') ? caches.default : null;
let segStat = { apiHits: 0, origin: 0, freshFetch: 0 };
let ntvStats = { resolve: 0, refresh: 0, err: 0 };
const logs = [];
const log = m => { logs.push(new Date().toISOString().slice(11, 19) + ' ' + m); if (logs.length > 100) logs.shift(); };
let reqStats = { day: new Date().toISOString().slice(0, 10), live: 0, seg: 0 };
const countReq = k => {
  const d = new Date().toISOString().slice(0, 10);
  if (d !== reqStats.day) reqStats = { day: d, live: 0, seg: 0 };
  reqStats[k]++;
};
let lastHeartbeat = 0, warmCursor = 0, lastWarm = 0, lastCleanup = 0;

const noteProv = (slug, prov, ok) => { if (slug && prov) provScore.set(slug + '|' + prov, { ok: !!ok, t: Date.now() }); };
const provRank = (slug, prov) => {
  const e = provScore.get((slug || '_') + '|' + (prov || '_'));
  if (!e || Date.now() - e.t > PROV_SCORE_TTL) return 1;
  return e.ok ? 2 : 0;
};

// --- CIRCUIT BREAKER (per canale|provider) ----------------------------------
const cbKey = (slug, prov) => (slug || '_') + '|' + (prov || '_');
function cbRecordFail(slug, prov) {
  if (!prov) return;
  const key = cbKey(slug, prov), now = Date.now();
  const arr = (cbFails.get(key) || []).filter(t => now - t < CB_FAIL_WIN);
  arr.push(now); cbFails.set(key, arr);
  if (arr.length >= CB_FAIL_TH && !cbCooldown.has(key)) {
    cbCooldown.set(key, now + CB_COOLDOWN);
    log('CB ' + key + ' cooldown ' + CB_COOLDOWN / 1000 + 's');
  }
}
function cbInCooldown(slug, prov) {
  const key = cbKey(slug, prov), until = cbCooldown.get(key);
  if (!until) return false;
  if (Date.now() >= until) { cbCooldown.delete(key); cbFails.delete(key); return false; }
  return true;
}
const cbClear = (slug, prov) => { const k = cbKey(slug, prov); cbFails.delete(k); cbCooldown.delete(k); };

// --- SEGFAIL ----------------------------------------------------------------
const recordSegFail = (ch, prov) => {
  if (!ch || !prov) return;
  const key = ch + '|' + prov, now = Date.now();
  const arr = (segFails.get(key) || []).filter(t => now - t < SEGFAIL_TTL);
  arr.push(now); segFails.set(key, arr);
  if (arr.length >= SEGFAIL_MAX) log('segfail ' + key + ' x' + arr.length);
  if (prov === 'vavoo' && arr.length === 1) { vavooFlip(ch); log('vavoo ' + ch + ': flip ID su primo segfail'); }
};
const segFailCount = (ch, prov) => {
  if (!ch || !prov) return 0;
  const now = Date.now();
  return (segFails.get(ch + '|' + prov) || []).filter(t => now - t < SEGFAIL_TTL).length;
};
const clearSegFails = (ch, prov) => { if (ch && prov) segFails.delete(ch + '|' + prov); };

// --- CLEANUP ----------------------------------------------------------------
function cleanupStaleState() {
  const now = Date.now();
  if (now - lastCleanup < 90000) return;
  lastCleanup = now;
  const cutoff = now - STATE_STALE_TTL;
  for (const [k, v] of plState) if (v.t < cutoff) plState.delete(k);
  for (const [k, v] of freshState) if (v.tSeen < cutoff) freshState.delete(k);
  for (const [k, h] of vavooHealth) if (h.t < cutoff) vavooHealth.delete(k);
  for (const [k, s] of provScore) if (s.t < cutoff) provScore.delete(k);
  for (const [k, t] of daddyEdgeFail) if (now - t > 2 * DADDY_EDGE_FAIL_TTL) daddyEdgeFail.delete(k);
  for (const [k, e] of plFetchCache) if (!e.inflight && (!e.txt || now - e.t > 30000)) plFetchCache.delete(k);
  for (const [k, arr] of cbFails) if (!arr.length) cbFails.delete(k);
  for (const [k, e] of plCache) if (now - e.t > 60000) plCache.delete(k);
  for (const [k, e] of vavooURLCache) if (now > e.exp) vavooURLCache.delete(k);
  for (const [k, arr] of segFails) {
    const near = arr.filter(t => now - t < SEGFAIL_TTL);
    if (near.length) segFails.set(k, near); else segFails.delete(k);
  }
  for (const [k, t] of noBustHosts) if (now - t > NO_BUST_TTL) noBustHosts.delete(k);
  for (const [k, e] of lagMemo) if (now - e.t > 2 * LAG_TTL_MS) lagMemo.delete(k);
  for (const [k, e] of h265Memo) if (now - e.t > 2 * H265_TTL) h265Memo.delete(k);
  for (const [k, e] of segInflight) if (!e.p && now - e.t > 30000) segInflight.delete(k);
  for (const [k, e] of freezeDetected) if (now - e.t > FREEZE_BYPASS_TTL) freezeDetected.delete(k);
  for (const [k, t] of vodMark) if (now - t > VOD_TTL) vodMark.delete(k);
}

function getPlState(key) {
  let st = plState.get(key);
  if (!st) { st = { lastSeq: -1, lastUpSeq: -1, base: '', discont: false, t: Date.now() }; plState.set(key, st); }
  return st;
}

// --- VAVOO HEALTH -----------------------------------------------------------
function getVavooHealth(slug) {
  const h = vavooHealth.get(slug);
  if (!h) return { prefer7: false, t: 0, fails6: 0, fails7: 0 };
  if (Date.now() - h.t > VAVOO_HEALTH_TTL) { vavooHealth.delete(slug); return { prefer7: false, t: 0, fails6: 0, fails7: 0 }; }
  return h;
}
function updateVavooHealth(slug, num) {
  const h = getVavooHealth(slug);
  h.t = Date.now(); h.prefer7 = (num === 7);
  if (num === 6 || num === 0) h.fails6 = 0;
  if (num === 7 || num === 0) h.fails7 = 0;
  vavooHealth.set(slug, h);
}
function vavooFlip(slug) {
  const h = getVavooHealth(slug);
  h.t = Date.now(); h.prefer7 = !h.prefer7; h.fails6 = 0; h.fails7 = 0;
  vavooHealth.set(slug, h);
  vavooURLCache.delete(slug);
  log('vavoo ' + slug + ': preferenza -> ' + (h.prefer7 ? 'id7' : 'id6'));
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
const plCacheSet = (ck, txt, slug, prov) => plCache.set(ck, { txt, t: Date.now(), slug, prov });

// ============================================================================
// FREEZE DETECTOR — il cuore del fix
// ============================================================================
// Un provider è FERMO solo se TUTTI i segnali disponibili restano identici:
//   - fingerprint dei path dei segmenti (query rimossa: i token ruotano)
//   - MEDIA-SEQUENCE
//   - ultimo EXT-X-PROGRAM-DATE-TIME
// Se uno solo si muove, la fonte sta producendo contenuto nuovo.
// Questo distingue i nomi file fissi con contenuto rotante (seq avanza -> vivo)
// dai loop registrati (tutto identico -> fermo).
// ============================================================================
function segPathFingerprint(p) {
  const paths = p.segs.map(s => String(s.url || '').split('?')[0]);
  return strHash(paths.join('|')).toString(36) + ':' + paths.length;
}
function lastPdtOf(p) {
  for (let i = p.segs.length - 1; i >= 0; i--) {
    if (p.segs[i].pdt) return String(p.segs[i].pdt).replace(/^#EXT-X-PROGRAM-DATE-TIME:\s*/, '');
  }
  return '';
}
function freezeThreshold(upTarget) {
  return Math.max(FREEZE_MIN_MS, (upTarget || 4) * FREEZE_TARGET_MULT * 1000);
}
function noteFreshness(slug, prov, p) {
  const key = (slug || '_') + '|' + (prov || '_');
  const now = Date.now();
  const fp = segPathFingerprint(p);
  const seq = p.upSeq;
  const pdt = lastPdtOf(p);
  let st = freshState.get(key);
  if (!st) {
    st = { fp, seq, pdt, tChanged: now, tSeen: now, polls: 1, upTarget: p.upTarget };
    freshState.set(key, st);
    return { frozen: false, reason: 'primo campione', age: 0 };
  }
  const moved = (fp !== st.fp) || (seq !== st.seq) || (pdt && pdt !== st.pdt);
  if (moved) {
    st.fp = fp; st.seq = seq; if (pdt) st.pdt = pdt;
    st.tChanged = now;
    if (freezeDetected.has(key)) {
      freezeDetected.delete(key);
      log('✅ UNFREEZE ' + key + ': contenuto torna a muoversi');
    }
  }
  st.tSeen = now; st.polls++; st.upTarget = p.upTarget;
  const age = now - st.tChanged;
  const thr = freezeThreshold(p.upTarget);
  const frozen = st.polls >= 2 && age > thr;
  if (frozen) {
    const prev = freezeDetected.get(key);
    freezeDetected.set(key, { t: now, reason: 'fp/seq/pdt statici da ' + Math.round(age / 1000) + 's' });
    if (!prev || now - prev.t > 30000) {
      log('🚨 FREEZE ' + key + ': nessun segnale si muove da ' + Math.round(age / 1000) + 's (soglia ' + Math.round(thr / 1000) + 's)');
      invalidateChannelCache(slug);
    }
  }
  return { frozen, reason: frozen ? 'statico ' + Math.round(age / 1000) + 's' : 'ok', age };
}
const isFrozen = (slug, prov) => {
  const e = freezeDetected.get((slug || '_') + '|' + (prov || '_'));
  return !!(e && Date.now() - e.t < FREEZE_BYPASS_TTL);
};
const channelHasFreeze = slug => {
  for (const p of ['ntv', 'vavoo', 'daddy']) if (isFrozen(slug, p)) return true;
  return false;
};
const isVod = (slug, prov) => {
  const t = vodMark.get((slug || '_') + '|' + (prov || '_'));
  return !!(t && Date.now() - t < VOD_TTL);
};
function freshTxt(slug, prov) {
  const st = freshState.get((slug || '_') + '|' + (prov || '_'));
  if (!st) return 'n/d';
  const age = Math.round((Date.now() - st.tChanged) / 1000);
  return 'seq=' + st.seq + ' fp=' + st.fp + ' statico=' + age + 's poll=' + st.polls +
         (isFrozen(slug, prov) ? ' [FREEZE]' : ' [vivo]') + (isVod(slug, prov) ? ' [VOD]' : '');
}
function invalidateChannelCache(slug) {
  if (!SEGCACHE || !slug) return;
  bg(async () => {
    try {
      const keys = await SEGCACHE.keys();
      let n = 0;
      for (const rq of keys) {
        try {
          const uu = new URL(rq.url);
          if (uu.searchParams.get('ch') === slug) { await SEGCACHE.delete(rq); n++; }
        } catch (e) {}
      }
      if (n) log('🗑️ cache invalidata ' + slug + ': ' + n + ' entry');
    } catch (e) {}
  });
}
function unfreeze(u) {
  const q = u.searchParams.get('ch') || '';
  const c = findCh(q);
  const L = ['=== UNFREEZE ==='];
  const targets = c ? [c.slug] : Array.from(new Set(Array.from(freezeDetected.keys()).map(k => k.split('|')[0])));
  if (!targets.length) return 'nessun freeze attivo';
  for (const slug of targets) {
    for (const p of ['ntv', 'vavoo', 'daddy']) {
      const k = slug + '|' + p;
      freezeDetected.delete(k); freshState.delete(k); vodMark.delete(k);
      cbClear(slug, p); clearSegFails(slug, p);
    }
    for (const k of Array.from(plCache.keys())) if (k.startsWith(slug + ':')) plCache.delete(k);
    invalidateChannelCache(slug);
    L.push('reset: ' + slug);
  }
  return L.join('\n');
}

// --- SONDA H265 (PMT del TS) ------------------------------------------------
const h265Bad = key => { const e = h265Memo.get(key); return !!(e && Date.now() - e.t < H265_TTL && e.bad); };
const noteH265 = (key, bad) => { if (key) h265Memo.set(key, { bad: !!bad, t: Date.now() }); };

function tsParseVideoCodec(b) {
  try {
    const nPkts = Math.min(Math.floor(b.length / 188), 140);
    const pmtPids = new Set();
    const has = { h264: false, h265: false, audio: false };
    const sections = [];
    for (let i = 0; i < nPkts; i++) {
      const o = i * 188;
      if (b[o] !== 0x47) continue;
      const afc = (b[o + 3] >> 4) & 0
