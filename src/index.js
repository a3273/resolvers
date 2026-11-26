// ============================================================================
// TVNOW-CF v10.24 - Worker HLS re-streamer (NTV / Vavoo / Daddy)
// Deploy: https://resolvers.simone-scorrano-2011.workers.dev
//
// v10.24: DELAY ADATTIVO PER CANALE + STABILITA' AUTO-TARATA + H264 + INDIPENDENZA
//
// PRINCIPIO FISICO (da cui deriva tutto):
//   Il live edge e' l'ULTIMO segmento completo nella playlist upstream. Quel
//   segmento rappresenta contenuto gia' passato: riprodurlo significa essere
//   almeno segDur indietro. Il delay minimo = (segmenti pubblicati) x segDur.
//   Con 1 solo segmento il player non ha runway -> stallo garantito.
//   Misurato (freezetest NTV sky-sport-24): 9 seq in 55s => segDur 6.1s.
//   => pavimento praktico 2 x 6.1 = 12.2s. Vavoo segDur ~14.5s => 29s.
//   Non esiste modifica al worker che scenda sotto questi valori senza scatti.
//
// A) DELAY
//   A1 PLAYLIST_FRESH_MS 3000->1000, PL_CACHE_TTL 2000->700, PL_BUST_MS 2000->1000.
//      Prima aggiungevamo fino a 5s di ritardo NOSTRO (fetch cached 3s + output
//      cached 2s). Il player polla ogni targetDuration (~6s): con 1 spettatore
//      la freschezza piu' corta non costa richieste extra (la cache scade
//      comunque tra due poll). Guadagno netto -2..4s.
//   A2 NTV e Vavoo passano da fetchPlaylistSmart a fetchUpstreamPl (single-flight).
//      BUCO TROVATO: solo Daddy aveva single-flight sulla playlist; NTV/Vavoo
//      fetch diretto protetto solo dai 2s di plCache. Senza A2, A1 avrebbe
//      moltiplicato le fetch con piu' spettatori.
//   A3 Finestra in NUMERO SEGMENTI da segDur misurato per canale|provider (EWMA),
//      non piu' secondi fissi uguali per tutti i canali dello stesso provider.
//      sky-sport-24 (6.1s) resta 12.2s; un canale con 2.5s scende da 10s a 7.5s.
//   A4 ?d=N forza il numero segmenti (A/B test senza redeploy).
//   A5 EXT-X-START calcolato sul RUNWAY, non su secondi fissi. Prima con segmenti
//      da 6.1s snapOffset dava sempre 0: il parametro start non faceva nulla.
//      Ora scatta solo se restano >= 2 segmenti di runway (prudenza).
//
// B) STABILITA'
//   B1 Il prefetch passa da withSegSingleFlight con la STESSA chiave di /seg.
//      BUCO TROVATO: warmSeg chiamava fetchSegmentWithCache fuori dal
//      single-flight -> prefetch e richiesta player = DUE fetch dello stesso
//      segmento in gara. Ora il player si accoda al prefetch in volo.
//   B2 Timeout segmento 20s -> 5/6.5/8s progressivi: un segmento appeso non
//      blocca piu' 20s (stallo visibile), il retry parte a 5s.
//   B3 RUNWAY ADATTIVO PER CANALE: base 4s; su retry/segFail di quel
//      canale|provider si aggiunge +1 segmento (extraSegs); dopo 5min puliti
//      si torna indietro. Ogni canale trova da solo il suo minimo sicuro.
//   B4 warmNext riserva budget al canale attivo (12 subrequest) prima di
//      scaldare gli altri: il playback non viene mai affamato dal warm.
//   B5 heartbeat solo su /live e /player, NON su /seg: le invocazioni di
//      playback hanno budget intero.
//
// C) H264
//   C1 Master con SOLO variant HEVC -> marca h265Bad e passa al provider dopo.
//      Prima il filtro le teneva tutte (hasAvc falso) -> video grigio audio ok.
//   C2 HEVC rilevato su Vavoo (master o sonda PMT) -> FLIP vid6/vid7 prima di
//      declassare: i due ID sono spesso encode diversi (HD H264 vs FHD HEVC).
//   C3 /codec?ch=<slug> e /codec?all=1&page=N: mappa codec canale x provider.
//   C4 Verifica gruppi AUDIO / variant audio-only nel master riscritto.
//
// D) INDIPENDENZA
//   D1 plCache keyed sul PROVIDER VINCITORE, non sull'intero tryOrder (che
//      cambia a ogni variazione di provRank/segFail/h265/lag): prima la cache
//      da 2s non colpiva quasi mai e si ri-risolveva ogni poll.
//   D2 Tutto lo stato adattivo (segDur, runway, extraSegs, contatori) e'
//      per slug|prov: un canale che scatta non allarga la finestra degli altri.
//   D3 vavooGoodHost: adozione con validazione e reset dopo 3 fail consecutivi
//      (prima un resolve sfortunato avvelenava tutti i canali).
//
// E) MISURA
//   E1 /diag: segDur misurato, segmenti pubblicati, delay teorico, runway,
//      extraSegs, retry/fail per canale|provider.
//   E2 /player: contatore UNDERRUN oltre a SN playlist e Playhead.
//   E3 /debug: delay stimato per canale + eventi instabilita'.
//
// INVARIATO: risoluzione provider (Daddy solo edge, no embed), fix v10.20
// SOURCE RESTART, fix v10.23 (no-cache al player, ENDLIST rimosso, guard daddy,
// safety-net skip su freeze, stateKey annidate senza bust), sonda H265 PMT,
// chiave cache segmenti firmata, SUB_BUDGET 40, warm progressivo.
// ============================================================================
let MODULE_CTX = null; let SUB_BUDGET = 40;
const subFree = n => SUB_BUDGET >= n;
const subSpend = n => { SUB_BUDGET = Math.max(0, SUB_BUDGET - n); };
const bg = fn => { try { if (MODULE_CTX && MODULE_CTX.waitUntil) MODULE_CTX.waitUntil(Promise.resolve().then(fn).catch(() => {})); } catch (e) {} };

export default { async fetch(req, env, ctx) {
    MODULE_CTX = ctx || null;
    SUB_BUDGET = 40;
    const u = new URL(req.url);
    const P = u.origin; const path = u.pathname;
    // B5: heartbeat solo dove non c'e' playback in corso. Su /seg il budget
    // deve restare intero per il fetch del segmento.
    if (path === '/live' || path === '/player' || path === '/' || path === '/ntv' ||
        path === '/vavoo' || path === '/daddy') heartbeat();
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
        case '/bytetest':   return R(await byteTest(u), 200, TXT());
        case '/freezetest': return R(await freezeTest(u), 200, TXT());
        case '/codec':      return R(await codecScan(u), 200, TXT());
        case '/adapt':      return R(adaptReport(u), 200, TXT());
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
// A3/B3: la finestra non e' piu' in secondi fissi ma in NUMERO SEGMENTI,
// calcolata da segDur misurato + runway target. Formula:
//   segmenti = max(MIN_SEGS, ceil(runway / segDur) + 1) + extraSegs
// Il "+1" e' il segmento in riproduzione; ceil(runway/segDur) e' il margine
// davanti al playhead che deve sopravvivere a un fetch lento.
//   segDur 6.1s, runway 4 -> ceil(0.66)+1 = 2 -> 12.2s  (pavimento, come ora)
//   segDur 2.5s, runway 4 -> ceil(1.6)+1  = 3 ->  7.5s  (migliora da 10s)
//   segDur 14.5s,runway 4 -> ceil(0.28)+1 = 2 -> 29.0s  (pavimento fisico)
const MIN_SEGS = 2;
const RUNWAY_BASE = 4;          // secondi di runway minimi davanti al playhead
const RUNWAY_WIDE = 12;         // ?w=1: finestra larga per confronto
const EXTRA_SEGS_MAX = 3;       // backoff massimo in segmenti
const CLEAN_DECAY_MS = 5 * 60 * 1000;   // 5min puliti -> togli 1 segmento di backoff
const SEG_TIMEOUTS = [5000, 6500, 8000]; // B2: timeout progressivi per tentativo
const WARM_RESERVE = 12;        // B4: subrequest riservati al canale attivo

// Legacy: usato solo per le stime statiche in /diag senza slug.
const PROV_DELAY = {
  ntv:   { target: 8, start: 10 },
  vavoo: { target: 12, start: 14 },
  daddy: { target: 14, start: 16 }
};
const delayCfg = prov => PROV_DELAY[prov] || { target: 24, start: 20 };

const PREFETCH_SEGS = 3;
const STALE_FACTOR = 6, MAX_BUFFER_SECS = 40;
const SEG_CACHE_TTL = 90;                 // edge CF: i segmenti pubblicati sono immutabili
const BUST_MS = 30000;                    // bust stabile 30s
const SEGFAIL_TTL = 3*60*1000, SEGFAIL_MAX = 3, SEGFAIL_EARLY = 1;
const PL_CACHE_TTL = 700;                 // A1: era 2000
const RESOLVE_BUDGET = 8000, STATE_STALE_TTL = 15*60*1000;
const CB_FAIL_WIN = 120*1000, CB_FAIL_TH = 6, CB_COOLDOWN = 50*1000;
const NTV_REFRESH_MARGIN = 900, VAVOO_URL_TTL = 120*1000;
const DADDY_TTL = 10*60*1000, VAVOO_HEALTH_TTL = 15*60*1000, VAVOO_MAP_TTL = 8*3600*1000;
const MAX_TOKEN_CACHE = 80, MAX_DADDY_CACHE = 150;
const VER = 'TVNOW-CF v10.24';
const DADDY_EDGE_BASE = 'https://edge.wedd48c.top';
const DADDY_EDGE_IDS = ['869','461','870','576','462','875','460','577','575','574','877','878','879','871','872','873','860','861','862','859','864','865','867','868','863','880'];
const DADDY_EDGE_FAIL_TTL = 60 * 1000;
const PLAYLIST_FRESH_MS = 1000;           // A1: era 3000
const SEG_API_TTL = 120;
const freezeDetected = new Map();
const FREEZE_TTL = 5 * 60 * 1000;
const byteSamples = new Map();
const freezeSamples = new Map();
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
const BY_KEY = (() => { const m = new Map();
  for (const c of CHANNELS) { m.set(c.slug, c); m.set(norm(c.name), c);
    if (c.ntv) m.set(c.ntv, c); if (c.daddy) m.set('d'+c.daddy, c); }
  for (const [a, s] of Object.entries(ALIASES)) { const c = m.get(s); if (c) m.set(a, c); }
  return m; })();
function findCh(q) {
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
function stripBust(url) {
  const s = String(url); const qi = s.indexOf('?');
  if (qi < 0) return s;
  const base = s.slice(0, qi); const keep = [];
  for (const kv of s.slice(qi + 1).split('&')) {
    const name = (kv.split('=')[0] || '').toLowerCase();
    if (name === '_t' || name === '_b' || name === '_p265' || name === '_bt') continue;
    keep.push(kv);
  }
  return keep.length ? base + '?' + keep.join('&') : base;
}
function hashRange(b, from, to) {
  let x = 0x811c9dc5; const end = Math.min(to, b.length);
  for (let i = from; i < end; i++) { x ^= b[i]; x = (x * 0x01000193) >>> 0; }
  return x.toString(16).padStart(8, '0');
}
function contentFingerprint(b) {
  return [hashRange(b,0,65536), hashRange(b,32768,98304), hashRange(b,131072,196608)].join('-');
}
function strHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }

// --- A3/B3/D2: STATO ADATTIVO PER CANALE|PROVIDER --------------------------
// segDur: EWMA delle durate EXTINF misurate (il valore reale, non quello
//         dichiarato nei commenti delle versioni precedenti).
// runway: secondi di margine richiesti davanti al playhead.
// extraSegs: backoff in segmenti, +1 su instabilita', -1 dopo 5min puliti.
// Tutto per slug|prov: nessun canale influenza un altro.
const chAdapt = new Map();
const ADAPT_TTL = 30 * 60 * 1000;
function adaptKey(slug, prov) { return (slug || '_') + '|' + (prov || '_'); }
function getAdapt(slug, prov) {
  const k = adaptKey(slug, prov);
  let a = chAdapt.get(k);
  if (!a) {
    a = { segDur:0, samples:0, runway:RUNWAY_BASE, extraSegs:0,
          lastBad:0, lastCount:0, retries:0, fails:0, underruns:0, t:Date.now() };
    chAdapt.set(k, a);
  }
  return a;
}
function noteSegDur(slug, prov, durs) {
  if (!slug || !prov || !durs || !durs.length) return;
  const valid = durs.filter(d => d > 0.2 && d < 60);
  if (!valid.length) return;
  const avg = valid.reduce((x,y) => x+y, 0) / valid.length;
  const a = getAdapt(slug, prov);
  a.segDur = a.segDur ? (a.segDur * 0.7 + avg * 0.3) : avg;
  a.samples++; a.t = Date.now();
}
function noteInstability(slug, prov, kind, countNow) {
  if (!slug || !prov) return;
  const a = getAdapt(slug, prov);
  const now = Date.now();
  if (kind === 'retry') a.retries++; else if (kind === 'underrun') a.underruns++; else a.fails++;
  a.t = now;
  // throttle: un evento ogni 3s alza il backoff, non una raffica
  if (now - a.lastBad < 3000) return;
  const base = Math.max(countNow || a.lastCount || MIN_SEGS, MIN_SEGS);
  if (a.extraSegs < EXTRA_SEGS_MAX) {
    a.extraSegs++;
    a.lastBad = now;
    log('adapt ' + adaptKey(slug,prov) + ': +' + a.extraSegs + ' seg (runway ' +
      (base + a.extraSegs) + ' seg) causa ' + kind);
  }
}
function decayAdapt() {
  const now = Date.now();
  for (const [k, a] of chAdapt) {
    if (now - a.t > ADAPT_TTL) { chAdapt.delete(k); continue; }
    if (a.extraSegs > 0 && a.lastBad && now - a.lastBad > CLEAN_DECAY_MS) {
      a.extraSegs--;
      a.lastBad = now;
      log('adapt ' + k + ': backoff scende a +' + a.extraSegs + ' seg (5min puliti)');
    }
  }
}
function adaptLine(slug, prov) {
  const a = chAdapt.get(adaptKey(slug, prov));
  if (!a) return 'nessuna misura';
  const sd = a.segDur ? a.segDur.toFixed(2) + 's' : 'n/d';
  const cnt = a.lastCount || '-';
  const delay = (a.segDur && a.lastCount) ? (a.segDur * a.lastCount).toFixed(1) + 's' : 'n/d';
  return 'segDur ' + sd + ' | seg ' + cnt + ' | delay ~' + delay +
    ' | runway ' + a.runway + 's +' + a.extraSegs + 'seg' +
    ' | retry ' + a.retries + ' fail ' + a.fails + ' underrun ' + a.underruns +
    ' | campioni ' + a.samples;
}
function adaptReport(u) {
  const q = u.searchParams.get('ch');
  const L = ['=== ADATTAMENTO PER CANALE|PROVIDER (' + VER + ') ===',
    'formula: seg = max(' + MIN_SEGS + ', ceil(runway/segDur)+1) + extraSegs',
    'runway base ' + RUNWAY_BASE + 's | backoff max +' + EXTRA_SEGS_MAX +
    ' seg | decadimento dopo ' + (CLEAN_DECAY_MS/60000) + 'min puliti', ''];
  const keys = q ? ['ntv','vavoo','daddy'].map(p => adaptKey(findCh(q) ? findCh(q).slug : q, p))
                 : Array.from(chAdapt.keys()).sort();
  if (!keys.length) return L.concat(['nessuna misura: guarda un canale e richiama /adapt']).join('\n');
  for (const k of keys) {
    const a = chAdapt.get(k);
    if (!a) { L.push(k + ': nessuna misura'); continue; }
    const [slug, prov] = k.split('|');
    L.push(k + ': ' + adaptLine(slug, prov));
  }
  L.push('', 'Reset backoff: /adapt?reset=1&ch=<slug>&p=<prov>');
  return L.join('\n');
}

// --- STATO GLOBALE ---------------------------------------------------------
const tokenCache = new Map(), daddyCache = new Map(), vavooURLCache = new Map();
const vavooHealth = new Map(), segFails = new Map();
const cbFails = new Map(), cbCooldown = new Map();
const plCache = new Map(), plState = new Map(), upFresh = new Map();
const daddyEdgeFail = new Map();
const plFetchCache = new Map();
const lastWin = new Map();                // D1: provider vincitore per canale+parametri
const SEGCACHE = (typeof caches !== 'undefined') ? caches.default : null;
let segStat = { apiHits: 0, origin: 0, joined: 0 };
const provScore = new Map();
const PROV_SCORE_TTL = 30 * 60 * 1000;
const noteProv = (slug, prov, ok) => { if (slug && prov) provScore.set(slug + '|' + prov, { ok: !!ok, t: Date.now() }); };
const provRank = (slug, prov) => {
  const e = provScore.get((slug || '_') + '|' + (prov || '_'));
  if (!e || Date.now() - e.t > PROV_SCORE_TTL) return 1;
  return e.ok ? 2 : 0;
};
let ntvStats = { resolve:0, refresh:0, err:0 };
const logs = [];
const log = m => { logs.push(new Date().toISOString().slice(11,19) + ' ' + m); if (logs.length > 90) logs.shift(); };
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
  noteInstability(ch, prov, 'fail');       // B3
  if (arr.length >= SEGFAIL_MAX) log('segfail ' + key + ' x' + arr.length);
};
const segFailCount = (ch, prov) => {
  if (!ch || !prov) return 0; const now = Date.now();
  return (segFails.get(ch + '|' + prov) || []).filter(t => now - t < SEGFAIL_TTL).length;
};
const clearSegFails = (ch, prov) => { if (ch && prov) segFails.delete(ch + '|' + prov); };

// --- CLEANUP ---------------------------------------------------------------
let lastCleanup = 0;
function cleanupStaleState() {
  const now = Date.now();
  if (now - lastCleanup < 60000) return;
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
  for (const [k, e] of h265Memo) if (now - e.t > 2 * H265_TTL) h265Memo.delete(k);
  for (const [k, e] of segInflight) if (!e.p && now - e.t > 30000) segInflight.delete(k);
  for (const [k, e] of servedSeq) if (now - e.t > 15*60*1000) servedSeq.delete(k);
  for (const [k, t] of freezeDetected) if (now - t > FREEZE_TTL) freezeDetected.delete(k);
  for (const [k, e] of byteSamples) if (now - e.t > 15*60*1000) byteSamples.delete(k);
  for (const [k, e] of freezeSamples) if (now - e.t > 15*60*1000) freezeSamples.delete(k);
  for (const [k, e] of lastWin) if (now - e.t > 10*60*1000) lastWin.delete(k);
  decayAdapt();                            // B3: decadimento backoff
}
function getPlState(key) { let st = plState.get(key);
  if (!st) { st = { lastSeq:-1, lastUpSeq:-1, base:'', discont:false, clampAt:0, t:Date.now() }; plState.set(key, st); }
  return st; }

// --- TRACKING SEQ SERVITE --------------------------------------------------
const servedSeq = new Map();
function noteServedSeq(slug, prov, seq) {
  if (slug && prov) servedSeq.set(slug + '|' + prov, { seq, t: Date.now() }); }
function servedSeqManual() {
  const now = Date.now(); const rows = [];
  for (const [k, e] of servedSeq) {
    if (now - e.t > 15*60*1000) { servedSeq.delete(k); continue; }
    rows.push(k + '=' + e.seq + ' (' + Math.round((now - e.t)/1000) + 's fa)');
  }
  return rows.sort().join(', ') || 'nessuno'; }
const FROZEN_S = 90;
function frozenManual() {
  const now = Date.now(); const out = [];
  for (const [k, e] of servedSeq) {
    if (now - e.t > FROZEN_S*1000 && now - e.t < 15*60*1000)
      out.push(k + ': fermo da ' + Math.round((now - e.t)/1000) + 's (seq ' + e.seq + ')');
  }
  return out.join('; ') || 'nessuno'; }

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
function vavooFlip(slug) {
  const h = getVavooHealth(slug);
  h.t = Date.now(); h.prefer7 = !h.prefer7; h.fails6 = 0; h.fails7 = 0;
  vavooHealth.set(slug, h);
  vavooURLCache.delete(slug);
  log('vavoo ' + slug + ': flip id -> ' + (h.prefer7 ? 'id7' : 'id6')); }
function recordVavooFail(slug, idNum) {
  const h = getVavooHealth(slug);
  h.t = Date.now();
  if (idNum === 6) h.fails6++; else h.fails7++;
  if (h.fails6 >= 3) h.prefer7 = true;
  if (h.fails7 >= 3) h.prefer7 = false;
  vavooHealth.set(slug, h); }

const plCacheGet = ck => { const e = plCache.get(ck);
  if (e && Date.now() - e.t < PL_CACHE_TTL) return e.txt;
  if (e) plCache.delete(ck); return null; };
const plCacheSet = (ck, txt) => plCache.set(ck, { txt, t:Date.now() });

function checkFreshOrThrow(key, upSeq, upTarget, prov) {
  const now = Date.now(); const st = upFresh.get(key);
  if (!st || upSeq !== st.seq) { upFresh.set(key, { seq:upSeq, t:now }); return; }
  const maxAge = Math.max(20, (upTarget || 4) * STALE_FACTOR) * 1000;
  if (now - st.t > maxAge) {
    freezeDetected.set(key, now);
    log('FREEZE ' + key + ': seq ' + upSeq + ' fermo da ' + Math.round((now-st.t)/1000) + 's');
    throw new Error(prov + ' FREEZE (seq ' + upSeq + ' da ' + Math.round((now-st.t)/1000) + 's)');
  }
}

// --- H265: sonda PMT + verdetto master -------------------------------------
const h265Memo = new Map();
const H265_TTL = 30 * 60 * 1000;
const h265Bad = key => { const e = h265Memo.get(key); return !!(e && Date.now() - e.t < H265_TTL && e.bad); };
const noteH265 = (key, bad) => { if (key) h265Memo.set(key, { bad: !!bad, t: Date.now() }); };
function tsParseVideoCodec(b) {
  try {
    const nPkts = Math.min(Math.floor(b.length / 188), 140);
    const pmtPids = new Set();
    let has = { h264:false, h265:false, audio:false };
    const sections = [];
    for (let i = 0; i < nPkts; i++) {
      const o = i * 188;
      if (b[o] !== 0x47) continue;
      const afc = (b[o+3] >> 4) & 0x3;
      if (afc === 0 || afc === 2) continue;
      if ((b[o+1] & 0x40) !== 0x40) continue;
      let p = o + 4;
      if (afc === 3) p += 1 + b[p];
      if (p >= o + 188) continue;
      p += 1 + b[p];
      if (p + 8 > o + 188) continue;
      const pid = ((b[o+1] & 0x1f) << 8) | b[o+2];
      const secLen = ((b[p+1] & 0x0f) << 8) | b[p+2];
      if (pid === 0) {
        const end = Math.min(p + 3 + Math.max(0, secLen-4), o+188);
        for (let q = p+8; q+4 <= end; q += 4) {
          const prog = (b[q] << 8) | b[q+1];
          const pmt = ((b[q+2] & 0x1f) << 8) | b[q+3];
          if (prog !== 0 && pmt) pmtPids.add(pmt);
        }
      } else sections.push({ pid, o:p, end: Math.min(p+3+Math.max(0,secLen-4), o+188) });
    }
    for (const sec of sections) {
      if (!pmtPids.has(sec.pid)) continue;
      let c = sec.o + 3 + 2 + 1 + 1 + 1 + 2;
      if (c + 2 > sec.end) continue;
      const pil = ((b[c] & 0x0f) << 8) | b[c+1];
      c += 2 + pil;
      while (c + 5 <= sec.end) {
        const st = b[c];
        const esLen = ((b[c+3] & 0x0f) << 8) | b[c+4];
        if (st === 0x1b) has.h264 = true;
        else if (st === 0x24) has.h265 = true;
        else if (st === 0x0f || st === 0x11) has.audio = true;
        c += 5 + esLen;
      }
    }
    if (has.h264 && has.h265) return 'both';
    if (has.h264) return 'h264';
    if (has.h265) return 'h265';
    return 'unknown';
  } catch (e) { return 'unknown'; }
}
// C1: verdetto codec dal master (CODECS dichiarati). Usato per marcare subito
// i master HEVC-only, che prima passavano il filtro e davano video grigio.
function masterCodecVerdict(txt) {
  const lines = String(txt).split(/\r?\n/);
  let video = 0, avc = 0, hevc = 0, declared = 0, audioGroups = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#EXT-X-MEDIA') && /TYPE=AUDIO/i.test(line)) audioGroups++;
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue;
    const isAudioOnly = !/RESOLUTION=/.test(line) &&
      !/(avc|hevc|hvc|vp09|av01)/i.test((line.match(/CODECS="([^"]+)"/)||[])[1]||'');
    if (isAudioOnly) continue;
    video++;
    const cx = (line.match(/CODECS="([^"]+)"/) || [])[1] || '';
    if (cx) declared++;
    if (/(hevc|hvc1|hev1|h265)/i.test(cx)) hevc++;
    else if (/avc1/i.test(cx)) avc++;
  }
  return { video, avc, hevc, declared, audioGroups,
    onlyHevc: (declared > 0 && video > 0 && avc === 0 && hevc > 0) };
}
async function probeH265(slug, prov, absUrl, ctx) {
  if (!slug || !prov || !absUrl) return;
  const key = slug + '|' + prov;
  const e = h265Memo.get(key);
  if (e && Date.now() - e.t < H265_TTL) return;
  noteH265(key, false);
  try {
    const ref = (ctx && ctx.ref) || 'https://thedaddy.li/';
    const h = getBrowserHeaders(ref, slug + '|' + prov);
    const o = ctx && ctx.origin; if (o) h['Origin'] = o;
    if (ref.includes('thedaddy') || ref.includes('dembed')) { h['Referer']='https://dembed.st/'; h['Origin']='https://dembed.st'; }
    h['Range'] = 'bytes=0-32767';
    const r = await fetchT(absUrl + (absUrl.includes('?')?'&':'?') + '_p265=1', { headers:h }, 6000);
    if (!r.ok) return;
    const ab = await r.arrayBuffer();
    const codec = tsParseVideoCodec(new Uint8Array(ab.slice(0, 131072)));
    if (codec === 'h265') {
      noteH265(key, true);
      log('h265 ' + key + ': HEVC nel TS -> provider in coda');
      // C2: su Vavoo i due ID sono spesso encode diversi: prova l'altro
      if (prov === 'vavoo') { vavooFlip(slug); log('h265 ' + key + ': flip ID Vavoo (encode alternativo)'); }
    } else if (codec === 'h264' || codec === 'both') {
      log('h265 ' + key + ': ' + codec + ' (ok)');
    }
  } catch (e) {}
}

// --- CACHE SEGMENTI --------------------------------------------------------
function segCacheKey(abs) {
  const qi = abs.indexOf('?');
  if (qi < 0) return abs;
  const base = abs.slice(0, qi);
  const keep = [];
  for (const kv of abs.slice(qi + 1).split('&')) {
    const name = (kv.split('=')[0] || '').toLowerCase();
    if (name === '_t' || name === '_b' || name === '_p265' || name === '_bt') continue;
    keep.push(kv); }
  const q = keep.length ? '?' + keep.join('&') : '';
  return base + q + '#k' + strHash(base + q).toString(36);
}
const PL_BUST_MS = 1000;                   // A1: era 2000
function plBust(url) {
  const b = Math.floor(Date.now() / PL_BUST_MS) * PL_BUST_MS;
  return url + (url.includes('?') ? '&' : '?') + '_b=' + b;
}
const NO_BUST_TTL = 30 * 60 * 1000;
const noBustHosts = new Map();
const CF_NO_CACHE_PL = () => ({ cf: { cacheTtl: 0, cacheEverything: false } });
async function fetchPlaylistSmart(url, headers, timeoutMs) {
  const host = String(url).split('/')[2] || '';
  const banned = noBustHosts.get(host) || 0;
  if (Date.now() - banned > NO_BUST_TTL) {
    const r = await fetchT(plBust(url), Object.assign({ headers }, CF_NO_CACHE_PL()), timeoutMs);
    if (r.status === 403 || r.status === 400) noBustHosts.set(host, Date.now());
    else return r; }
  return await fetchT(url, Object.assign({ headers }, CF_NO_CACHE_PL()), timeoutMs);
}
// A2: single-flight per TUTTI i provider (prima solo Daddy).
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
    return txt; }).catch(err => { plFetchCache.delete(key); throw err; }); }
const segInflight = new Map();
function withSegSingleFlight(key, fn) {
  const e = segInflight.get(key);
  if (e && e.p && Date.now() - e.t < 9000) { segStat.joined++; return e.p.catch(() => fn()); }
  const p = fn().finally(() => { setTimeout(() => {
    const cur = segInflight.get(key);
    if (cur && cur.p === p) segInflight.delete(key);
  }, 2000); });
  segInflight.set(key, { p, t: Date.now() });
  return p;
}
function isVideoCt(ct) { ct = String(ct||'').toLowerCase(); return /mpegurl|mp2t|mp4|octet-stream|video\//.test(ct) && !/html|json|xml/.test(ct); }
async function fetchSegmentWithCache(target, h, range, opts) {
  const skipApi = opts && opts.skipApiCache;
  const skipCf = opts && opts.skipCfCache;
  const ch = opts && opts.ch, prov = opts && opts.prov;
  const to = (opts && opts.timeoutMs) || 8000;    // B2
  const fzKey = (ch||'') + '|' + (prov||'');
  const fz = freezeDetected.get(fzKey);
  const skipForFreeze = fz && (Date.now() - fz < FREEZE_TTL);
  const key = segCacheKey(target);
  if (SEGCACHE && !range && !skipApi && !skipForFreeze) { try {
      const hit = await SEGCACHE.match(key);
      if (hit) { segStat.apiHits++;
        const hh = { 'content-type': hit.headers.get('content-type') || 'video/mp2t',
          'cache-control':'no-cache, no-store, must-revalidate', 'pragma':'no-cache', 'expires':'0',
          'access-control-allow-origin':'*' };
        const cl = hit.headers.get('x-content-length'); if (cl) hh['content-length'] = cl;
        return { resp: new Response(hit.body, { status:200, headers:hh }), fromCache:'api' };
      }
    } catch (e) {}
  }
  const cfOpt = (skipCf || skipForFreeze) ? { cacheTtl:0, cacheEverything:false }
    : (range ? { cacheTtl:0 } : { cacheTtl:SEG_CACHE_TTL, cacheEverything:true });
  const r = await fetchT(target, { headers:h, cf:cfOpt }, to);
  if (r.status === 200) segStat.origin++;
  if (SEGCACHE && !range && !skipCf && !skipForFreeze && r.status === 200 && isVideoCt(r.headers.get('content-type'))) {
    try {
      const stored = new Response(r.clone().body, { headers: {
        'content-type': r.headers.get('content-type') || 'video/mp2t',
        'cache-control': 'public, max-age=' + SEG_API_TTL,
        'x-content-length': r.headers.get('content-length') || '' } });
      bg(() => SEGCACHE.put(key, stored));
    } catch (e) {}
  }
  return { resp:r, fromCache:(skipApi||skipForFreeze)?'origin-fresh':'origin' };
}

function emitPlaylist(ck, slug, prov, txt, baseUrl, ctx) {
  const p = parseMediaPl(txt);
  // C1: master HEVC-only -> marca e passa al provider dopo (prima: video grigio)
  if (p.isMaster) {
    const v = masterCodecVerdict(txt);
    if (v.onlyHevc) {
      noteH265(slug + '|' + prov, true);
      log('h264 ' + slug + '|' + prov + ': master HEVC-only (' + v.hevc + '/' + v.video + ') -> provider in coda');
      if (prov === 'vavoo') { vavooFlip(slug); log('h264 ' + slug + ': flip ID Vavoo (encode alternativo)'); }
      throw new Error(prov + ' HEVC-only (nessuna variant AVC)');
    }
    // C4: gruppi audio dichiarati ma nessuna variant video = master rotto
    if (v.video === 0 && v.audioGroups > 0)
      log('warn ' + slug + '|' + prov + ': master con ' + v.audioGroups + ' gruppi AUDIO ma 0 variant video');
  }
  if (!p.isMaster && p.segs.length) {
    checkFreshOrThrow(slug + '|' + prov, p.upSeq, p.upTarget, prov);
    noteSegDur(slug, prov, p.segs.map(s => s.dur || p.upTarget));   // A3
  }
  if (!p.isMaster) noteSrcLag(slug + '|' + prov, srcLagOf(p));
  const out = rewriteAny(txt, baseUrl, Object.assign({}, ctx, { stateKey: slug + '|' + prov }));
  if (!p.isMaster && PREFETCH_SEGS > 0) {
    for (const s of p.segs.slice(-PREFETCH_SEGS)) {
      try { bg(() => warmSeg(absSegUrl(s.url, baseUrl), ctx)); } catch (e) {}
    }
  }
  if (!p.isMaster && p.segs.length) {
    try { bg(() => probeH265(slug, prov, absSegUrl(p.segs[p.segs.length-1].url, baseUrl), ctx)); } catch (e) {}
  }
  plCacheSet(ck, out);
  return R(out, 200, HLS_NO_CACHE());
}
// B1: il prefetch entra nel single-flight con la STESSA chiave del handler
// /seg (attempt 1, no range). Il player che arriva si accoda al fetch in volo
// invece di farne partire un secondo in gara.
async function warmSeg(abs, ctx) {
  if (!subFree(1)) return;
  subSpend(1);
  const ref = (ctx && ctx.ref) || 'https://thedaddy.li/';
  const ch = (ctx && ctx.ch) || '', prov = (ctx && ctx.prov) || '';
  const h = getBrowserHeaders(ref, ch + '|' + prov);
  const o = ctx && ctx.origin; if (o) h['Origin'] = o;
  if (ref.includes('thedaddy') || ref.includes('dembed')) { h['Referer']='https://dembed.st/'; h['Origin']='https://dembed.st'; }
  try {
    const withBust = abs + (abs.includes('?')?'&':'?') + '_t=' + (Math.floor(Date.now()/BUST_MS)*BUST_MS);
    const key = segCacheKey(withBust) + '|r1';
    await withSegSingleFlight(key, () =>
      fetchSegmentWithCache(withBust, h, null, { ch, prov, timeoutMs: 6000 }));
  } catch (e) {}
}

// --- HEARTBEAT / WARM ------------------------------------------------------
const HEARTBEAT_MS = 5 * 60 * 1000;
let lastHeartbeat = 0;
function heartbeat() {
  const now = Date.now();
  if (now - lastHeartbeat < HEARTBEAT_MS) return;
  lastHeartbeat = now;
  warmNext(6, 8);
}
const WARM_BATCH = 2;
let warmCursor = 0, lastWarm = 0;
function warmNext(n, reserve) {
  // B4: il budget del canale attivo viene riservato prima di scaldare altri
  const avail = Math.max(0, SUB_BUDGET - (reserve || 0));
  const n2 = Math.min(n, Math.floor(avail / 6));
  if (!n2) return;
  if (Date.now() - lastWarm < 10000) return;
  lastWarm = Date.now(); subSpend(n2 * 6);
  const jobs = [];
  for (let i = 0; i < n2 && i < CHANNELS.length; i++) {
    const c = CHANNELS[(warmCursor + i) % CHANNELS.length];
    jobs.push((async () => {
      try { if (c.ntv) await ntvToken(c.ntv, c.slug); } catch (e) {}
      try { if (c.daddy) await daddyResolve(c.daddy, c.slug); } catch (e) {}
      try { if (c.vavoo || c.vid6 || c.vid7) await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7); } catch (e) {}
    })()); }
  warmCursor = (warmCursor + n2) % CHANNELS.length;
  const p = Promise.all(jobs).catch(() => {});
  if (MODULE_CTX) { try { MODULE_CTX.waitUntil(p); } catch (e) {} }
  return p; }
async function preWarmProv(p, c) {
  if (!subFree(4)) return;
  subSpend(4); try {
    if (p === 'ntv' && c.ntv) await ntvToken(c.ntv, c.slug);
    else if (p === 'vavoo' && (c.vavoo || c.vid6 || c.vid7)) await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
    else if (p === 'daddy' && c.daddy) await daddyResolve(c.daddy, c.slug);
  } catch (e) {}
}

// --- PROVIDER NTV ----------------------------------------------------------
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
  const r = await fetchT(NTV_API + id, { headers: getBrowserHeaders('https://tvnow247.today/', (slug||'')+'|ntv') }, 12000);
  if (!r.ok) { ntvStats.err++; cbRecordFail(slug,'ntv'); throw new Error('ntv api ' + r.status); }
  const j = await r.json().catch(() => null);
  const m3u8 = j && (j.m3u8 || j.proxyPlaylistUrl || j.proxyPlayerUrl);
  if (!m3u8) { ntvStats.err++; cbRecordFail(slug,'ntv'); throw new Error('ntv senza m3u8'); }
  const exp = +(String(m3u8).match(/[?&]e=(\d+)/) || [])[1] || (now + 3600);
  const entry = { m3u8, exp, ref:(j&&j.referer)||'https://tvnow247.today/' };
  tokenCache.set(id, entry); cbClear(slug,'ntv');
  return entry; }
// A2: single-flight sulla playlist NTV (prima fetch diretto)
async function ntvPlaylist(id, slug) {
  let tk = await ntvToken(id, slug);
  const H = () => getBrowserHeaders(tk.ref, (slug||'')+'|ntv');
  let txt;
  try { txt = await fetchUpstreamPl('ntv|' + id, tk.m3u8, H(), 8000); }
  catch (e) {
    tokenCache.delete(id); ntvStats.refresh++;
    tk = await ntvToken(id, slug);
    txt = await fetchUpstreamPl('ntv|' + id + '|r', tk.m3u8, H(), 8000);
  }
  return { txt, ref: tk.ref, base: tk.m3u8 };
}

// --- PROVIDER DADDY (solo edge, niente embed) ------------------------------
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
      daddyCache.set(id, { url:eu, exp:now+DADDY_TTL });
      return eu; }
    return null; }
  return null; }
function getBrowserHeaders(referer, uaKey) {
  return {
    'User-Agent': uaFor(uaKey || referer), 'Accept':'*/*',
    'Accept-Language':'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer, 'Origin': referer.replace(/\/$/,''),
    'Sec-Fetch-Dest':'empty','Sec-Fetch-Mode':'cors','Sec-Fetch-Site':'cross-site',
    'Upgrade-Insecure-Requests':'1'
  }; }

// --- PROVIDER VAVOO --------------------------------------------------------
const VAVOO_MIRRORS = ['https://geil.to','https://geil.app','https://geil.win','https://vavoo.to','https://kool.to','https://vavoo.net','https://kool.ws','https://huhu.to','https://oha.to','https://voltop.net'];
const VAVOO_SOURCES = ['https://raw.githubusercontent.com/aphrodite747/VvOo/main/index_Italy.m3u','https://raw.githubusercontent.com/BontAce/VVOOITV/main/index_Italy.m3u'];
let vavooMap = { map:null, t:0, src:'' };
const vavooMapGet = () => (vavooMap.map && Date.now()-vavooMap.t < VAVOO_MAP_TTL) ? vavooMap.map : null;
async function ensureVavooMap(force) {
  const cached = vavooMapGet();
  if (cached && !force) return cached;
  for (const src of VAVOO_SOURCES) {
    try {
      const r = await fetchT(src, { headers:{'User-Agent':'VAVOO/1.0'} }, 12000);
      if (!r.ok) continue;
      const t = await r.text(); const m = new Map();
      for (const b of t.split('#EXTINF')) {
        const nm = (b.match(/tvg-name="([^"]+)"/) || [])[1];
        const id = (b.match(/vavoo\/(\d+)\.m3u8/) || [])[1];
        if (nm && id) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/,'')); if (k && !m.has(k)) m.set(k,id); }
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
  for (const [k,id] of m) {
    const kTok = k.split('-').filter(Boolean);
    if (qTok.every(w => kTok.includes(w))) {
      const score = qTok.length - (kTok.length - qTok.length);
      if (score > bestScore) { bestScore = score; best = id; }
    }
  }
  return best; }
const vavooHeaders = extra => Object.assign({
  'User-Agent':'MediaHubMX/2','Accept':'application/json',
  'Origin':'https://vavoo.to','Referer':'https://vavoo.to/' }, extra||{});
async function vavooResolveId(base, id) {
  const play = base + '/live/play/' + id;
  try {
    const r = await fetchT(base+'/live/resolve?url='+encodeURIComponent(play), { headers:getBrowserHeaders(base+'/', base) }, 4000);
    if (r.ok) { const j = await r.json().catch(()=>null); if (j && j.url) return j.url; }
  } catch (e) {}
  try {
    const r = await fetchT(base+'/mediahubmx-resolve.json', { method:'POST',
      headers: vavooHeaders({'Content-Type':'application/json','Origin':base,'Referer':base+'/'}),
      body: JSON.stringify({ language:'de', region:'DE', url:play, clientVersion:'3.0.2' }) }, 4000);
    if (r.ok) { const j = await r.json().catch(()=>null); if (j && j.url) return j.url; }
  } catch (e) {}
  return null; }
async function vavooLiveFind(base, query) {
  try {
    const rl = await fetchT(base+'/mediahubmx-list.json', { method:'POST',
      headers: vavooHeaders({'Content-Type':'application/json','Origin':base,'Referer':base+'/'}),
      body: JSON.stringify({ language:'it', region:'IT', clientVersion:'3.0.2', url:base+'/live' }) }, 4000);
    if (!rl.ok) return null;
    const j = await rl.json().catch(()=>null);
    const items = (j && (j.items||j.channels||j.entries)) || [];
    const tmp = new Map();
    for (const it of items) {
      const nm = it.name||it.title||'';
      const iid = it.id || ((it.url||'').match(/play\/(\d+)/)||[])[1];
      if (nm && iid) { const k = norm(nm.replace(/\s*\(\d+\)\s*$/,'')); if (k && !tmp.has(k)) tmp.set(k,String(iid)); }
    }
    return vavooMapFind(query, tmp);
  } catch (e) { return null; }
}
// D3: host CDN imparato con validazione e reset dopo fail ripetuti
const VAVOO_HOST_DEFAULT = 'https://7jep2q6xee5pjrv.fu8oefd4v2dvlmaarur6crfp.com';
let vavooGoodHost = VAVOO_HOST_DEFAULT;
let vavooHostFails = 0, vavooHostT = 0;
function vavooFixIpUrl(u) { const s = String(u||'');
  if (!/^http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\//.test(s)) return s;
  return s.replace(/^http:\/\/[^/]+\//, vavooGoodHost + '/');
}
function noteVavooGoodHost(u) {
  const m = String(u||'').match(/^https:\/\/([^/]+)\//);
  if (!m) return;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(m[1])) return;
  if (m[1].length < 8 || !/\./.test(m[1])) return;
  if (vavooGoodHost !== 'https://' + m[1]) {
    vavooGoodHost = 'https://' + m[1];
    vavooHostFails = 0; vavooHostT = Date.now();
  }
}
function noteVavooHostResult(ok) {
  if (ok) { vavooHostFails = 0; return; }
  vavooHostFails++;
  if (vavooHostFails >= 3 && vavooGoodHost !== VAVOO_HOST_DEFAULT) {
    log('vavoo host ' + vavooGoodHost + ' fallito 3x -> reset al default');
    vavooGoodHost = VAVOO_HOST_DEFAULT; vavooHostFails = 0;
  }
}
async function tryVavooId(id) {
  for (const base of VAVOO_MIRRORS.slice(0,2)) {
    try { const u = await vavooResolveId(base, id); if (u) return u; } catch (e) {}
  }
  return null; }
async function vavooResolveDual(slug, query, vid6, vid7) {
  const t0 = Date.now();
  const cacheKey = slug || ('q:'+norm(query));
  const cachedUrl = vavooURLCache.get(cacheKey);
  if (cachedUrl && cachedUrl.exp > t0) return cachedUrl.url;
  const healthKey = slug || norm(query);
  const health = getVavooHealth(healthKey);
  const m = (vid6||vid7) ? null : await ensureVavooMap();
  const mapId = m ? vavooMapFind(query||'', m) : null;
  const cands = [];
  if (mapId) cands.push({ id:mapId, num:0 });
  const rest = [];
  if (vid6 && vid6 !== mapId) rest.push({ id:vid6, num:6 });
  if (vid7 && vid7 !== mapId) rest.push({ id:vid7, num:7 });
  if (health.prefer7) rest.reverse();
  cands.push(...rest);
  if (!cands.length && query) {
    for (const base of VAVOO_MIRRORS.slice(0,2)) {
      if (Date.now()-t0 > RESOLVE_BUDGET) break;
      try { const id2 = await vavooLiveFind(base, query); if (id2) { cands.push({id:id2,num:0}); break; } } catch (e) {}
    }
  }
  for (const cand of cands.slice(0,3)) {
    if (Date.now()-t0 > RESOLVE_BUDGET) break;
    const url = vavooFixIpUrl(await tryVavooId(cand.id));
    noteVavooGoodHost(url);
    if (url) {
      updateVavooHealth(healthKey, cand.num);
      vavooURLCache.set(cacheKey, { url, exp:Date.now()+VAVOO_URL_TTL });
      cbClear(slug,'vavoo'); return url;
    }
    if (cand.num) recordVavooFail(healthKey, cand.num);
  }
  cbRecordFail(slug,'vavoo'); return null;
}
async function vavooResolve(query, vid) {
  const c = findCh(query);
  if (c) return await vavooResolveDual(c.slug, c.vavoo||query, c.vid6, c.vid7);
  return await vavooResolveDual(null, query, vid, null);
}

// --- ROTTA /live -----------------------------------------------------------
async function live(u, P, legacy) {
  countReq('live'); cleanupStaleState();
  const q = u.searchParams.get('ch') || u.searchParams.get('c') || '';
  if (!q) return R('uso: /live?ch=<slug>\n\n' + elencoCanali(), 200, TXT());
  const c = findCh(q);
  if (!c) return R('canale non mappato: "' + q + '"\n\n' + elencoCanali(), 200, TXT());
  const wide = u.searchParams.get('w') === '1';
  const dParam = parseInt(u.searchParams.get('d') || '0', 10);
  const forceSegs = (dParam >= 1 && dParam <= 8) ? dParam : 0;   // A4
  const prefParam = legacy || u.searchParams.get('p') || '';
  const prefList = prefParam ? prefParam.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : [];
  const allProvs = ['ntv','vavoo','daddy'];
  const available = allProvs.filter(p => {
    if (p === 'ntv') return !!c.ntv;
    if (p === 'vavoo') return !!(c.vavoo || c.vid6 || c.vid7);
    if (p === 'daddy') return !!c.daddy;
    return false; });
  if (!available.length) return R('NESSUN provider mappato per ' + c.name, 200, TXT());
  const ordered = [];
  for (const p of prefList) if (available.includes(p) && !ordered.includes(p)) ordered.push(p);
  for (const p of available) if (!ordered.includes(p)) ordered.push(p);
  ordered.sort((a,b) => provRank(c.slug,b) - provRank(c.slug,a));
  const good = ordered.filter(p => segFailCount(c.slug,p) < SEGFAIL_MAX);
  const bad  = ordered.filter(p => segFailCount(c.slug,p) >= SEGFAIL_MAX);
  const finalOrder = good.concat(bad);
  const cbLive = finalOrder.filter(p => !cbInCooldown(c.slug,p));
  const cbFrozen = finalOrder.filter(p => cbInCooldown(c.slug,p));
  const hurt = k => lagBad(k) || h265Bad(k);
  const tryOrder = cbLive.filter(p => !hurt(c.slug+'|'+p))
    .concat(cbLive.filter(p => hurt(c.slug+'|'+p)), cbFrozen);

  // D1: cache keyed sul vincitore, non sull'ordine intero (che cambia sempre)
  const winKey = c.slug + '|' + (prefParam||'auto') + '|' + forceSegs + '|' + (wide?1:0);
  const lw = lastWin.get(winKey);
  if (lw && !cbInCooldown(c.slug, lw.prov) && !h265Bad(c.slug+'|'+lw.prov)) {
    const hit = plCacheGet(c.slug + ':' + lw.prov + ':' + forceSegs + ':' + (wide?1:0));
    if (hit) return R(hit, 200, HLS_NO_CACHE());
  }

  for (let i = 1; i < tryOrder.length; i++) { const pp = tryOrder[i]; if (pp) bg(() => preWarmProv(pp, c)); }
  warmNext(WARM_BATCH, WARM_RESERVE);      // B4

  const baseCtx = { P, ch:c.slug, wide, forceSegs };
  const storeWin = (prov, out) => {
    plCacheSet(c.slug + ':' + prov + ':' + forceSegs + ':' + (wide?1:0), out);
    lastWin.set(winKey, { prov, t:Date.now() });
  };

  const provs = {
    vavoo: async () => {
      if (!c.vavoo && !c.vid6 && !c.vid7) return null;
      if (segFailCount(c.slug,'vavoo') >= SEGFAIL_MAX) {
        vavooFlip(c.slug); clearSegFails(c.slug,'vavoo');
        log('vavoo ' + c.slug + ': re-resolve dopo segfail con cambio id');
      } else if (segFailCount(c.slug,'vavoo') >= SEGFAIL_EARLY) {
        const ent = vavooURLCache.get(c.slug);
        if (ent && ent.exp - Date.now() < 40000) { vavooURLCache.delete(c.slug); log('vavoo ' + c.slug + ': early re-resolve'); }
      }
      const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/i.test(vu)) {
        let txt;
        try {
          // A2: single-flight anche su Vavoo
          txt = await fetchUpstreamPl('vavoo|' + c.slug, vu, vavooHeaders({'User-Agent':'VAVOO/1.0'}), 8000);
          noteVavooHostResult(true);
        } catch (e) {
          noteVavooHostResult(false);
          vavooURLCache.delete(c.slug); cbRecordFail(c.slug,'vavoo'); return null;
        }
        const r = emitPlaylist(null, c.slug, 'vavoo', txt, vu,
          Object.assign({}, baseCtx, { prov:'vavoo', ref:'https://vavoo.to/', origin:'https://vavoo.to' }));
        storeWin('vavoo', await r.clone().text());
        return r;
      }
      return R('redirect vavoo', 302, { Location:vu, ...CORS() });
    },
    ntv: async () => {
      if (!c.ntv) return null;
      const pl = await ntvPlaylist(c.ntv, c.slug);
      const r = emitPlaylist(null, c.slug, 'ntv', pl.txt, pl.base,
        Object.assign({}, baseCtx, { prov:'ntv', ref:pl.ref, origin:'' }));
      storeWin('ntv', await r.clone().text());
      return r;
    },
    daddy: async () => {
      if (!c.daddy) return null;
      const dh = getBrowserHeaders('https://dembed.st/', c.slug + '|daddy');
      let du = await daddyResolve(c.daddy, c.slug);
      let txt = null;
      if (du && /\.m3u8/i.test(du)) {
        try { txt = await fetchUpstreamPl('daddy|' + c.daddy, du, dh, 8000); }
        catch (e) {
          if (/wedd48c|edge\./i.test(du)) {
            daddyEdgeFail.set(String(c.daddy), Date.now()); daddyCache.delete(c.daddy);
            log('daddy edge ko ' + c.daddy + ': Daddy KO 60s, niente embed');
          }
          cbRecordFail(c.slug,'daddy'); return null;
        }
      }
      if (!du || !txt) { cbRecordFail(c.slug,'daddy'); return null; }
      const pchk = parseMediaPl(txt);
      if (!pchk.isMaster && pchk.segs.length) {
        checkFreshOrThrow(c.slug+'|daddy', pchk.upSeq, pchk.upTarget, 'daddy');
        noteSegDur(c.slug, 'daddy', pchk.segs.map(s => s.dur || pchk.upTarget));
        noteServedSeq(c.slug, 'daddy', pchk.upSeq);
      }
      if (pchk.isMaster) {
        const v = masterCodecVerdict(txt);
        if (v.onlyHevc) { noteH265(c.slug+'|daddy', true); cbRecordFail(c.slug,'daddy');
          log('h264 ' + c.slug + '|daddy: master HEVC-only -> coda'); return null; }
      }
      try { const last = pchk.segs[pchk.segs.length-1];
        if (last && last.url) bg(() => probeH265(c.slug,'daddy', absSegUrl(last.url, du), { ref:'https://dembed.st/', origin:'https://dembed.st' }));
      } catch (e) {}
      const body = rewriteAny(txt, du, Object.assign({}, baseCtx,
        { prov:'daddy', ref:'https://dembed.st/', origin:'https://dembed.st', stateKey:c.slug+'|daddy' }));
      const lines = body.split('\n');
      if (lines[0] === '#EXTM3U')
        lines.splice(1,0,'#EXTVLCOPT:http-referrer=https://dembed.st/','#EXTVLCOPT:http-user-agent='+uaFor(c.slug+'|daddy'));
      const out = lines.join('\n');
      storeWin('daddy', out);
      cbClear(c.slug,'daddy');
      return R(out, 200, HLS_NO_CACHE());
    }
  };

  let lastErr = '', sawFreeze = false;
  for (const p of tryOrder) {
    const fn = provs[p]; if (!fn) continue;
    try { const res = await fn();
      if (res) { noteProv(c.slug,p,true); return res; }
      lastErr = lastErr || (p + ': null');
      noteProv(c.slug,p,false);
    } catch (e) {
      const msg = (e && e.message ? e.message : String(e));
      lastErr = p + ': ' + msg;
      if (/FREEZE/i.test(msg)) sawFreeze = true;
      log(p + ' ko ' + c.slug + ': ' + msg);
      noteProv(c.slug,p,false);
    }
  }
  for (const p of tryOrder) { cbClear(c.slug,p); clearSegFails(c.slug,p); }
  if (!sawFreeze && lw) {
    const hit = plCache.get(c.slug + ':' + lw.prov + ':' + forceSegs + ':' + (wide?1:0));
    if (hit && Date.now() - hit.t < 60000) return R(hit.txt, 200, HLS_NO_CACHE());
  } else if (sawFreeze) {
    log('safety-net ' + c.slug + ': SKIP (freeze)');
  }
  return R('ERRORE: provider KO (' + tryOrder.join(' -> ') + ') per ' + c.name +
    '. Ultimo: ' + lastErr + (sawFreeze ? '\nFREEZE: /bytetest?ch=' + c.slug : '') +
    '\n/probe?ch=' + c.slug, 200, TXT());
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
    if (line.startsWith('#EXT-X-VERSION:')) { upVersion = parseInt(line.split(':')[1])||1; continue; }
    if (line.startsWith('#EXT-X-TARGETDURATION:')) { upTarget = parseInt(line.split(':')[1])||4; continue; }
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) { upSeq = parseInt(line.split(':')[1])||0; continue; }
    if (line.startsWith('#EXT-X-MAP')) { map = line; continue; }
    if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME')) { pdt = line; continue; }
    if (line.startsWith('#EXT-X-ENDLIST')) { endlist = true; continue; }
    if (line.startsWith('#EXT-X-DISCONTINUITY')) { disc = true; continue; }
    if (line.startsWith('#EXT-X-BYTERANGE')) { brange = line; continue; }
    if (line.startsWith('#EXTINF')) {
      pending = { extinf:line, dur:parseFloat((line.match(/#EXTINF:([\d.]+)/)||[])[1])||0, disc, brange, pdt };
      disc=false; brange=null; pdt=null; continue; }
    if (line.startsWith('#')) continue;
    if (pending) { pending.url = line; segs.push(pending); pending = null; }
  }
  return { upSeq, upTarget, upVersion, map, segs, isMaster, endlist };
}
// A3/B3/A4: finestra in numero segmenti da segDur misurato + runway + backoff
function pickWindow(durs, prov, slug, forceSegs, wide) {
  const n = durs.length;
  if (!n) return { count:0, sum:0, segDur:0, runway:0 };
  const a = (slug && prov) ? getAdapt(slug, prov) : null;
  const valid = durs.filter(d => d > 0.2 && d < 60);
  const localAvg = valid.length ? valid.reduce((x,y)=>x+y,0)/valid.length : (durs[n-1] || 4);
  const segDur = (a && a.segDur) ? a.segDur : localAvg;
  const runway = wide ? RUNWAY_WIDE : (a ? a.runway : RUNWAY_BASE);
  const extra = a ? a.extraSegs : 0;
  let want;
  if (forceSegs) want = forceSegs;
  else want = Math.max(MIN_SEGS, Math.ceil(runway / Math.max(segDur, 0.5)) + 1) + extra;
  const count = Math.max(1, Math.min(want, n));
  const kept = durs.slice(-count);
  const sum = kept.reduce((x,y)=>x+y,0);
  if (a) { a.lastCount = count; a.t = Date.now(); }
  return { count, sum, segDur, runway, extra };
}
function snapOffset(keptDurs, sum, limit, upTarget) {
  let off = 0;
  for (let k = 0; k < keptDurs.length - 1; k++) {
    const nx = off + (keptDurs[k] || upTarget);
    if (nx <= limit + 0.01) off = nx; else break;
  }
  return off; }
function absSegUrl(url, baseUrl) {
  if (/^https?:\/\//i.test(url)) return url;
  let abs;
  if (url.startsWith('/')) abs = new URL(baseUrl).origin + url;
  else abs = baseUrl.replace(/[^/]*$/,'') + url.replace(/^\.\//,'');
  return abs.replace(/([^:])\/{2,}/g,'$1/');
}
function proxUrl(abs, ctx) {
  const bust = Math.floor(Date.now()/BUST_MS)*BUST_MS;
  const withBust = abs + (abs.includes('?')?'&':'?') + '_t=' + bust;
  let u = ctx.P + '/seg?u=' + encodeURIComponent(withBust);
  if (ctx.ref) u += '&ref='+encodeURIComponent(ctx.ref);
  if (ctx.origin) u += '&o='+encodeURIComponent(ctx.origin);
  if (ctx.ch) u += '&ch='+encodeURIComponent(ctx.ch);
  if (ctx.prov) u += '&p='+encodeURIComponent(ctx.prov);
  return u; }
function isAudioOnlyStreamInf(line) {
  if (/RESOLUTION=/.test(line)) return false;
  const codecs = (line.match(/CODECS="([^"]+)"/)||[])[1]||'';
  return !/(avc|hevc|hvc|vp09|av01)/i.test(codecs);
}
function rewriteMaster(txt, baseUrl, ctx) {
  const lines = String(txt).split(/\r?\n/);
  const media = [], iframes = [], variants = [];
  let pending = null, maxBw = 0, maxRes = '';
  for (const raw of lines) { const line = raw.trim();
    if (!line || line.startsWith('#EXTM3U')) continue;
    if (line.startsWith('#EXT-X-MEDIA')) {
      const mu = line.match(/URI="([^"]+)"/);
      media.push(mu ? line.replace(/URI="[^"]+"/, 'URI="'+proxUrl(absSegUrl(mu[1],baseUrl),ctx)+'"') : line);
      continue; }
    if (line.startsWith('#EXT-X-I-FRAME-STREAM-INF')) {
      const mu = line.match(/URI="([^"]+)"/);
      iframes.push(mu ? line.replace(/URI="[^"]+"/, 'URI="'+proxUrl(absSegUrl(mu[1],baseUrl),ctx)+'"') : line);
      continue; }
    if (line.startsWith('#EXT-X-STREAM-INF')) { pending = line; continue; }
    if (line.startsWith('#')) { media.push(line); continue; }
    if (pending) {
      const bw = parseInt((pending.match(/BANDWIDTH=(\d+)/)||[])[1]||'0');
      const rm = pending.match(/RESOLUTION=(\d+)x(\d+)/);
      if (!isAudioOnlyStreamInf(pending) && bw > maxBw) { maxBw=bw; maxRes=rm?rm[1]+'x'+rm[2]:'?'; }
      variants.push({ line:pending, url:line, audioOnly:isAudioOnlyStreamInf(pending), bw });
      pending = null; }
  }
  if (maxBw && ctx && ctx.ch)
    log('quality ' + ctx.ch + ': max ' + maxRes + ' @ ' + Math.round(maxBw/1000) + 'kbps');
  const allVideo = variants.filter(v=>!v.audioOnly).sort((a,b)=>b.bw-a.bw);
  const isHevc = v => /CODECS="/.test(v.line) && /(hevc|hvc1|hev1|h265)/i.test(v.line);
  const hasExplicit = allVideo.some(v=>/CODECS="/.test(v.line));
  const hasAvc = allVideo.some(v=>!isHevc(v));
  const video = (hasExplicit && hasAvc) ? allVideo.filter(v=>!isHevc(v)) : allVideo;
  if (video.length !== allVideo.length)
    log('h264 ' + ((ctx&&ctx.ch)||'?') + ': tenute ' + video.length + '/' + allVideo.length + ' variant');
  const audio = variants.filter(v=>v.audioOnly);   // C4: mantenute, servono ai gruppi AUDIO
  const out = ['#EXTM3U']; out.push(...media);
  for (const v of video) out.push(v.line, proxUrl(absSegUrl(v.url,baseUrl),ctx));
  for (const v of audio) out.push(v.line, proxUrl(absSegUrl(v.url,baseUrl),ctx));
  out.push(...iframes);
  return out.join('\n');
}

// --- RITARDO DI FONTE (PDT) ------------------------------------------------
const lagMemo = new Map();
const LAG_BAD_S = 45, LAG_TTL_MS = 5*60*1000;
function srcLagOf(p) {
  const last = p.segs[p.segs.length-1];
  if (!last || !last.pdt) return null;
  const t = Date.parse(String(last.pdt).replace(/^#EXT-X-PROGRAM-DATE-TIME:(\s*)/,''));
  if (!isFinite(t)) return null;
  return Math.max(0, (Date.now() - (t + (last.dur||0)*1000))/1000);
}
function noteSrcLag(key, lagS) {
  if (lagS == null || !isFinite(lagS)) return;
  const now = Date.now(); let e = lagMemo.get(key);
  if (!e || now-e.t > LAG_TTL_MS) e = { lag:lagS, t:now, n:1 };
  else { e.lag = e.lag*0.7 + lagS*0.3; e.t=now; e.n++; }
  lagMemo.set(key,e); }
const lagBad = key => { const e = lagMemo.get(key); return !!(e && Date.now()-e.t < LAG_TTL_MS && e.lag >= LAG_BAD_S); };
const lagTxt = key => { const e = lagMemo.get(key); return e ? (Math.round(e.lag)+'s'+(e.lag>=LAG_BAD_S?' BAD->coda':' ok')) : 'n/d (no PDT)'; };

function rewriteMediaPl(txt, baseUrl, ctx) {
  const p = parseMediaPl(txt);
  if (p.isMaster || !p.segs.length) return rewriteMaster(txt, baseUrl, ctx);
  const durs = p.segs.map(s => s.dur || p.upTarget);
  const plan = pickWindow(durs, ctx&&ctx.prov, ctx&&ctx.ch, ctx&&ctx.forceSegs, ctx&&ctx.wide);
  const kept = p.segs.slice(-plan.count);
  const dropped = p.segs.length - kept.length;
  let seq = p.upSeq + dropped; let discontTop = false;
  const st = ctx && ctx.stateKey ? getPlState(ctx.stateKey) : null;
  if (st) {
    if (st.base && st.base !== baseUrl) { st.base = baseUrl; st.discont = true; }
    else if (!st.base) st.base = baseUrl;
    if (st.lastSeq >= 0 && seq <= st.lastSeq) {
      // fix v10.20 SOURCE RESTART (invariato)
      const farBack = (st.lastSeq - seq) > 50;
      const clampedTooLong = st.clampAt && (Date.now() - st.clampAt > 30000);
      if (farBack || clampedTooLong) {
        log('sorgente riavviata ' + (ctx&&ctx.ch) + '/' + (ctx&&ctx.prov) + ': seq ' + p.upSeq + ' rinumerata, nuova timeline');
        seq = p.upSeq + dropped;
        st.lastSeq = seq; st.lastUpSeq = p.upSeq; st.discont = true; st.clampAt = 0;
      } else {
        seq = st.lastSeq; st.discont = true; st.clampAt = st.clampAt || Date.now();
      }
    } else { st.clampAt = 0; }
    st.lastSeq = seq; st.lastUpSeq = p.upSeq; st.t = Date.now();
    if (st.discont && kept.length) { discontTop = true; st.discont = false; }
  }
  noteServedSeq(ctx&&ctx.ch, ctx&&ctx.prov, seq);
  let version = p.upVersion || 1;
  if (p.map && version < 6) version = 6;

  // A5: START solo se restano ALMENO 2 SEGMENTI di runway dopo il punto di
  // partenza. Con 2 segmenti pubblicati il limite e' 0 -> nessuno START
  // (comportamento attuale che funziona). Con 3+ segmenti si guadagna 1 seg.
  const keptD = kept.map(s => s.dur);
  const uniform = keptD.every(d => Math.abs(d - p.upTarget) <= 0.25 * p.upTarget);
  const noBrange = !kept.some(s => s.brange);
  const segD = plan.segDur || p.upTarget;
  const runwayFloor = Math.max(plan.runway || RUNWAY_BASE, 2 * segD);
  const limit = plan.sum - runwayFloor;
  const offset = (uniform && noBrange && limit > 0.4) ? snapOffset(keptD, plan.sum, limit, p.upTarget) : 0;

  const out = ['#EXTM3U','#EXT-X-VERSION:'+version,'#EXT-X-TARGETDURATION:'+p.upTarget,'#EXT-X-MEDIA-SEQUENCE:'+seq];
  if (offset > 0.4) out.push('#EXT-X-START:TIME-OFFSET=' + offset.toFixed(1));
  // v10.23: ENDLIST mai emesso (il player smetterebbe di ricaricare)
  if (p.endlist && ctx && ctx.ch)
    log('ENDLIST rimosso ' + ctx.ch + '/' + ctx.prov);
  if (p.map) {
    const mu = (p.map.match(/URI="([^"]+)"/)||[])[1];
    if (mu) out.push('#EXT-X-MAP:URI="'+proxUrl(absSegUrl(mu,baseUrl),ctx)+'"');
  }
  if (discontTop) out.push('#EXT-X-DISCONTINUITY');
  kept.forEach((s,idx) => {
    if (s.disc && idx>0) out.push('#EXT-X-DISCONTINUITY');
    out.push(s.extinf);
    if (s.pdt) out.push(s.pdt);
    if (s.brange) out.push(s.brange);
    out.push(proxUrl(absSegUrl(s.url,baseUrl),ctx));
  });
  return out.join('\n'); }

// --- ROTTA /seg ------------------------------------------------------------
async function seg(u, req) { countReq('seg');
  const target = u.searchParams.get('u');
  if (!target) return R('uso: /seg?u=<url>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://thedaddy.li/';
  const ch = u.searchParams.get('ch') || '';
  const prov = u.searchParams.get('p') || '';
  const h = getBrowserHeaders(ref, (ch&&prov) ? (ch+'|'+prov) : ref);
  const o = u.searchParams.get('o'); if (o) h['Origin'] = o;
  const rangeParam = u.searchParams.get('range');
  const playerRange = req && req.headers ? req.headers.get('Range') : null;
  if (rangeParam) h['Range'] = rangeParam;
  else if (playerRange) h['Range'] = playerRange;
  const range = h['Range'] || null;
  if (ref.includes('thedaddy') || ref.includes('dembed')) { h['Referer']='https://dembed.st/'; h['Origin']='https://dembed.st'; }
  if (/\.m3u8(\?|$)/i.test(target)) {
    const clean = stripBust(target);
    let txt;
    try { txt = await fetchUpstreamPl('m|'+prov+'|'+clean, target, h, 10000); }
    catch (e) { return R('upstream playlist', 502, TXT()); }
    const baseDir = target.substring(0, target.lastIndexOf('/')+1) || target;
    const out = rewriteAny(txt, baseUrl_of(baseDir),
      { P:u.origin, ref, origin:o||'', ch, prov, stateKey:'m|'+prov+'|'+clean });
    return R(out, 200, HLS_NO_CACHE());
  }
  let r, attempts = 0; const maxAttempts = 3;
  while (attempts < maxAttempts) {
    attempts++;
    // B2: timeout progressivi 5 / 6.5 / 8s (era 20s fisso)
    const o2 = { ch, prov, timeoutMs: SEG_TIMEOUTS[attempts-1] || 8000 };
    if (attempts >= 2) { o2.skipApiCache = true; o2.skipCfCache = attempts >= 3; }
    const signed = await withSegSingleFlight(segCacheKey(target)+'|r'+attempts+(range?'|rg':''), () =>
      fetchSegmentWithCache(target, h, range, o2));
    r = signed.resp;
    const ct = r.headers.get('content-type') || '';
    const isHtmlBody = r.ok && /^(text\/html|application\/json|text\/xml)/i.test(ct);
    if (!r.ok && !range) { recordSegFail(ch,prov);
      if (attempts < maxAttempts) { noteInstability(ch,prov,'retry'); log('seg retry '+attempts+' '+(ch||'?')+' (status '+r.status+')'); continue; }
      return R('upstream '+r.status, r.status, TXT());
    } else if (isHtmlBody && !range) { recordSegFail(ch,prov);
      if (attempts < maxAttempts) { noteInstability(ch,prov,'retry'); log('seg html retry '+attempts+' '+(ch||'?')); continue; }
      return R('upstream corrotto '+r.status, r.status, TXT());
    } else if (!r.ok) { recordSegFail(ch,prov);
      return R('upstream '+r.status, r.status, TXT());
    }
    break; }
  const hh = {
    'content-type': r.headers.get('content-type') || 'video/mp2t',
    'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS',
    'access-control-allow-headers':'Range, User-Agent, Referer, Origin',
    'access-control-expose-headers':'Content-Length, Content-Range, Accept-Ranges',
    'accept-ranges':'bytes',
    'cache-control':'no-cache, no-store, must-revalidate','pragma':'no-cache','expires':'0'
  };
  const cl = r.headers.get('content-length'); const cr = r.headers.get('content-range');
  if (cl) hh['content-length']=cl;
  if (cr) hh['content-range']=cr;
  return new Response(r.body, { status:r.status, headers:hh });
}

// --- DIAGNOSTICA: byte / freeze / codec ------------------------------------
async function resolveForDiag(prov, c) {
  if (prov === 'ntv') {
    if (!c.ntv) return null;
    const tk = await ntvToken(c.ntv, c.slug);
    return { url:tk.m3u8, headers:getBrowserHeaders(tk.ref, c.slug+'|ntv'), label:'NTV' };
  }
  if (prov === 'vavoo') {
    const vu = await vavooResolveDual(c.slug, c.vavoo, c.vid6, c.vid7);
    if (!vu) return null;
    return { url:vu, headers:vavooHeaders({'User-Agent':'VAVOO/1.0'}), label:'VAVOO' };
  }
  if (prov === 'daddy') {
    if (!c.daddy) return null;
    const du = await daddyResolve(c.daddy, c.slug);
    if (!du) return null;
    return { url:du, headers:getBrowserHeaders('https://dembed.st/', c.slug+'|daddy'), label:'DADDY' };
  }
  return null;
}
async function byteTest(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-24';
  const prov = (u.searchParams.get('p') || 'ntv').toLowerCase();
  const c = findCh(q);
  if (!c) return 'canale non mappato: ' + q;
  const R0 = await resolveForDiag(prov, c);
  if (!R0) return c.name + ': ' + prov + ' non risolto';
  const r = await fetchT(plBust(R0.url), { headers:R0.headers, cf:{cacheTtl:0,cacheEverything:false} }, 12000);
  if (!r.ok) return R0.label + ' upstream HTTP ' + r.status;
  const p = parseMediaPl(await r.text());
  if (p.isMaster) return R0.label + ': master playlist, usa /rawu per la media.';
  if (p.segs.length < 2) return R0.label + ': meno di 2 segmenti.';
  const L = ['=== BYTETEST ' + R0.label + ' / ' + c.name + ' ===',
    'seq ' + p.upSeq + ' | segs ' + p.segs.length + ' | ENDLIST ' + (p.endlist?'SI':'no'), ''];
  const a = p.segs[0], b = p.segs[p.segs.length-1];
  const urlA = absSegUrl(a.url, R0.url), urlB = absSegUrl(b.url, R0.url);
  const gap = p.segs.reduce((s,x)=>s+(x.dur||0),0);
  const bust = Date.now();
  const rA = await fetchT(urlA+(urlA.includes('?')?'&':'?')+'_bt='+bust, { headers:Object.assign({},R0.headers), cf:{cacheTtl:0,cacheEverything:false} }, 15000);
  const rB = await fetchT(urlB+(urlB.includes('?')?'&':'?')+'_bt='+bust, { headers:Object.assign({},R0.headers), cf:{cacheTtl:0,cacheEverything:false} }, 15000);
  if (!rA.ok || !rB.ok) return L.concat(['fetch fallito A='+rA.status+' B='+rB.status]).join('\n');
  const bufA = new Uint8Array(await rA.arrayBuffer()), bufB = new Uint8Array(await rB.arrayBuffer());
  const fpA = contentFingerprint(bufA), fpB = contentFingerprint(bufB);
  L.push('A: ' + bufA.length + ' byte  fp ' + fpA);
  L.push('B: ' + bufB.length + ' byte  fp ' + fpB + '  (~' + Math.round(gap) + 's dopo)');
  L.push('');
  if (fpA === fpB) {
    L.push('BYTE IDENTICI: il proxy serve contenuto congelato con nomi nuovi.');
    L.push('Nessun fix worker serve. Prova /live?ch=' + c.slug + '&p=vavoo (o daddy).');
  } else {
    L.push('BYTE DIVERSI: flusso upstream sano.');
    L.push('Delay attuale: /adapt?ch=' + c.slug);
  }
  if (bufA[0] === 0x47) L.push('codec A: ' + tsParseVideoCodec(bufA.slice(0,131072)));
  byteSamples.set(c.slug+'|'+prov, { same:fpA===fpB, t:Date.now() });
  return L.join('\n');
}
async function freezeTest(u) {
  const q = u.searchParams.get('ch') || 'sky-sport-24';
  const prov = (u.searchParams.get('p') || 'ntv').toLowerCase();
  const c = findCh(q);
  if (!c) return 'canale non mappato: ' + q;
  const R0 = await resolveForDiag(prov, c);
  if (!R0) return c.name + ': ' + prov + ' non risolto';
  const r = await fetchT(plBust(R0.url), { headers:R0.headers, cf:{cacheTtl:0,cacheEverything:false} }, 12000);
  if (!r.ok) return R0.label + ' HTTP ' + r.status;
  const p = parseMediaPl(await r.text());
  if (p.isMaster) return R0.label + ': master playlist';
  const nowSeq = p.upSeq, nowLast = p.segs.length ? p.segs[p.segs.length-1].url : '(none)';
  const key = c.slug+'|'+prov, prev = freezeSamples.get(key);
  const L = ['=== FREEZETEST ' + R0.label + ' / ' + c.name + ' ===', 'URL: ' + R0.url, ''];
  if (!prev || Date.now()-prev.t > 5*60*1000) {
    freezeSamples.set(key, { seq:nowSeq, last:nowLast, t:Date.now() });
    L.push('PRIMO CAMPIONE seq ' + nowSeq + ' | ENDLIST ' + (p.endlist?'SI':'no'));
    L.push('>>> richiama tra 30-60s, poi /bytetest?ch=' + c.slug + '&p=' + prov);
    return L.join('\n');
  }
  const dt = Math.round((Date.now()-prev.t)/1000), dSeq = nowSeq - prev.seq;
  L.push('CONFRONTO su ' + dt + 's: seq ' + prev.seq + ' -> ' + nowSeq + ' (delta ' + dSeq + ')');
  L.push('ultimo segmento cambiato: ' + (nowLast===prev.last?'NO':'SI'));
  const srv = servedSeq.get(key);
  if (srv) L.push('seq servita: ' + srv.seq + ' (' + Math.round((Date.now()-srv.t)/1000) + 's fa)');
  L.push('');
  L.push(dSeq === 0 ? 'FONTE CONGELATA (playlist ferma).'
    : 'PLAYLIST AVANZA. Per i BYTE: /bytetest?ch=' + c.slug + '&p=' + prov);
  freezeSamples.set(key, { seq:nowSeq, last:nowLast, t:Date.now() });
  return L.join('\n');
}
// C3: mappa codec. Un canale per chiamata, o 2 canali per pagina con all=1.
async function codecOne(c, prov) {
  const out = [prov.toUpperCase() + ': '];
  try {
    const R0 = await resolveForDiag(prov, c);
    if (!R0) { out.push('non disponibile'); return out.join(''); }
    if (!subFree(2)) { out.push('budget esaurito'); return out.join(''); }
    subSpend(2);
    const r = await fetchT(plBust(R0.url), { headers:R0.headers, cf:{cacheTtl:0,cacheEverything:false} }, 10000);
    if (!r.ok) { out.push('HTTP ' + r.status); return out.join(''); }
    const txt = await r.text();
    const p = parseMediaPl(txt);
    if (p.isMaster) {
      const v = masterCodecVerdict(txt);
      out.push('master ' + v.video + ' video, avc ' + v.avc + ', hevc ' + v.hevc +
        (v.onlyHevc ? ' -> SOLO HEVC (grigio)' : (v.avc ? ' -> H264 OK' : ' -> codec non dichiarati')));
      return out.join('');
    }
    if (!p.segs.length) { out.push('playlist vuota'); return out.join(''); }
    const su = absSegUrl(p.segs[p.segs.length-1].url, R0.url);
    const hh = Object.assign({}, R0.headers); hh['Range'] = 'bytes=0-32767';
    const rs = await fetchT(su + (su.includes('?')?'&':'?') + '_p265=1', { headers:hh }, 7000);
    if (!rs.ok) { out.push('segmento HTTP ' + rs.status); return out.join(''); }
    const b = new Uint8Array(await rs.arrayBuffer());
    const codec = b[0] === 0x47 ? tsParseVideoCodec(b.slice(0,131072)) : 'non-TS';
    out.push('media, segDur ' + (p.segs[p.segs.length-1].dur||0).toFixed(1) + 's, codec ' + codec +
      (codec === 'h265' ? ' -> HEVC (grigio)' : (codec === 'h264' || codec === 'both' ? ' -> H264 OK' : '')));
    return out.join('');
  } catch (e) { out.push('ERR ' + (e && e.message)); return out.join(''); }
}
async function codecScan(u) {
  const one = u.searchParams.get('ch');
  const all = u.searchParams.get('all') === '1';
  const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
  const L = ['=== CODEC SCAN (' + VER + ') ===',
    'h264/both = ok su ExoPlayer | h265 = video grigio | unknown = non determinato', ''];
  if (one) {
    const c = findCh(one);
    if (!c) return 'canale non mappato: ' + one;
    L.push('--- ' + c.name + ' (' + c.slug + ') ---');
    for (const prov of ['ntv','vavoo','daddy']) {
      const has = prov==='ntv' ? !!c.ntv : prov==='daddy' ? !!c.daddy : !!(c.vavoo||c.vid6||c.vid7);
      if (!has) { L.push(prov.toUpperCase() + ': non mappato'); continue; }
      L.push(await codecOne(c, prov));
    }
    L.push('', 'Adattamento: /adapt?ch=' + c.slug);
    return L.join('\n');
  }
  if (!all) return L.concat(['uso: /codec?ch=<slug>  oppure  /codec?all=1&page=N',
    'pagine totali: ' + Math.ceil(CHANNELS.length/2) + ' (2 canali per pagina)']).join('\n');
  const per = 2, start = (page-1)*per, slice = CHANNELS.slice(start, start+per);
  const pages = Math.ceil(CHANNELS.length/per);
  L.push('pagina ' + page + '/' + pages + ' (canali ' + (start+1) + '-' + (start+slice.length) + ')', '');
  if (!slice.length) return L.concat(['pagina vuota']).join('\n');
  for (const c of slice) {
    L.push('--- ' + c.name + ' ---');
    for (const prov of ['ntv','vavoo','daddy']) {
      const has = prov==='ntv' ? !!c.ntv : prov==='daddy' ? !!c.daddy : !!(c.vavoo||c.vid6||c.vid7);
      if (!has) continue;
      L.push(await codecOne(c, prov));
    }
    L.push('');
  }
  if (page < pages) L.push('>>> prossima: /codec?all=1&page=' + (page+1));
  else L.push('=== scansione completa ===');
  return L.join('\n');
}

// --- PLAYER ---------------------------------------------------------------
async function player(u, P) {
  const ch = u.searchParams.get('ch') || 'sky-sport-f1';
  const c = findCh(ch);
  if (!c) return R('Canale non trovato: ' + ch, 404, TXT());
  const wide = u.searchParams.get('w') === '1';
  const d = parseInt(u.searchParams.get('d') || '0', 10);
  let qs = c.slug + (wide ? '&w=1' : '') + ((d>=1&&d<=8) ? '&d='+d : '');
  const a = chAdapt.get(adaptKey(c.slug,'ntv')) || chAdapt.get(adaptKey(c.slug,'vavoo'));
  const sd = (a && a.segDur) ? a.segDur : 6;
  const sync = Math.max(6, Math.round(sd * 1.5));
  const maxLat = Math.max(sync + 8, Math.round(sd * 4));
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.name} - TVNOW</title>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<style>
*{box-sizing:border-box}
body{margin:0;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100vh;font-family:monospace}
video{width:100%;max-width:1200px;background:#000}
.c{position:fixed;top:10px;left:10px;color:#fff;background:rgba(0,0,0,.85);padding:14px;border-radius:8px;font-size:12px;line-height:1.7;z-index:999}
.ok{color:#4CAF50}.err{color:#f44336}.load{color:#FFC107}
</style></head><body>
<div class="c">
<div><b>${c.name}</b>${wide?' [w]':''}${(d>=1&&d<=8)?' [d='+d+']':''}</div>
<div>${VER} | sync ${sync}s max ${maxLat}s | segDur ~${sd.toFixed(1)}s</div>
<div id="st" class="load">Caricamento...</div>
<div id="q"></div><div id="bf"></div><div id="sn"></div><div id="pt"></div><div id="ur"></div>
</div>
<video id="v" controls autoplay muted playsinline></video>
<script>
var v=document.getElementById('v'),st=document.getElementById('st'),q=document.getElementById('q'),
bf=document.getElementById('bf'),sn=document.getElementById('sn'),pt=document.getElementById('pt'),ur=document.getElementById('ur');
var src='${P}/live?ch=${qs}';
var lastSN=-1,stalls=0,lastTime=-1,tStalls=0,underruns=0,wasPlaying=false;
if(Hls.isSupported()){
  var h=new Hls({debug:false,enableWorker:true,lowLatencyMode:false,
    backBufferLength:30,liveSyncDuration:${sync},liveMaxLatencyDuration:${maxLat},
    maxLiveSyncPlaybackRate:1.12,maxBufferLength:${Math.max(20, Math.round(sd*4))},maxMaxBufferLength:${MAX_BUFFER_SECS},
    maxBufferSize:60000000,maxBufferHole:0.5,capLevelToPlayerSize:false,
    autoStartLoad:true,nudgeMaxRetry:10,fragLoadingMaxRetry:8,manifestLoadingMaxRetry:4});
  h.loadSource(src);h.attachMedia(v);
  h.on(Hls.Events.MANIFEST_PARSED,function(e,dd){
    st.textContent='Stream caricato';st.className='ok';v.play().catch(function(){});
    if(dd.levels&&dd.levels.length){var bi=0;
      dd.levels.forEach(function(l,i){if((l.bitrate||0)>(dd.levels[bi].bitrate||0))bi=i});
      h.currentLevel=bi;var l=dd.levels[bi];
      q.textContent=l.width+'x'+l.height+' @'+Math.round((l.bitrate||0)/1000)+'kbps';}
  });
  h.on(Hls.Events.LEVEL_LOADED,function(e,dd){
    var s=dd.details?dd.details.startSN:-1;
    if(s>=0){if(s===lastSN)stalls++;else{stalls=0;lastSN=s}
      sn.textContent='Playlist SN: '+s+(stalls>2?' FERMO x'+stalls:' avanza');
      sn.className=stalls>2?'err':'ok';}
  });
  h.on(Hls.Events.ERROR,function(e,dd){
    if(dd.fatal){
      if(dd.type===Hls.ErrorTypes.NETWORK_ERROR){st.textContent='Rete: retry';st.className='load';setTimeout(function(){h.startLoad()},1000);}
      else if(dd.type===Hls.ErrorTypes.MEDIA_ERROR){st.textContent='Media recovery';st.className='load';h.recoverMediaError();}
      else{st.textContent='Errore '+dd.type;st.className='err';h.destroy();}
    }
  });
  // E2: underrun = buffer vuoto mentre il video sta suonando
  h.on(Hls.Events.BUFFER_EMPTY,function(){ underruns++; ur.textContent='Underrun: '+underruns; ur.className=underruns>2?'err':'load'; });
  setInterval(function(){
    var b=0;
    if(v.buffered.length){b=v.buffered.end(v.buffered.length-1)-v.currentTime;bf.textContent='Buffer: '+b.toFixed(1)+'s';}
    var t=v.currentTime;
    if(t===lastTime&&t>0)tStalls++;else{tStalls=0;lastTime=t}
    pt.textContent='Playhead: '+t.toFixed(1)+'s'+(tStalls>3?' BLOCCATO x'+tStalls:' avanza');
    pt.className=tStalls>3?'err':'ok';
    if(b<0.25&&!v.paused&&wasPlaying){ur.textContent='Underrun: '+underruns+' (buffer 0)';ur.className='err';}
    wasPlaying=!v.paused;
  },1000);
}else if(v.canPlayType('application/vnd.apple.mpegurl')){st.textContent='Safari nativo';st.className='ok';v.src=src;}
else{st.textContent='Browser non supportato';st.className='err';}
</script></body></html>`;
  return R(html, 200, { 'content-type':'text/html; charset=utf-8', ...CORS() });
}

// --- ALTRA DIAGNOSTICA -----------------------------------------------------
async function segtest(u) {
  const t = u.searchParams.get('u');
  if (!t) return R('uso: /segtest?u=<url>&ref=<referer>', 200, TXT());
  const ref = u.searchParams.get('ref') || 'https://tvnow247.today/';
  const busted = t + (t.includes('?')?'&':'?') + '_bt=' + Date.now();
  const L = ['=== SEGTEST ===','URL: '+t,''];
  try {
    const r = await fetchT(busted, { headers:getBrowserHeaders(ref,'segtest'), cf:{cacheTtl:0,cacheEverything:false} }, 15000);
    L.push('HTTP: '+r.status, 'CT: '+r.headers.get('content-type'));
    if (!r.ok) return R(L.join('\n'), 200, TXT());
    const b = new Uint8Array(await r.arrayBuffer());
    L.push('Size: '+b.length+' byte');
    L.push('hash 0-64KB:      '+hashRange(b,0,65536));
    L.push('hash 32KB-96KB:   '+hashRange(b,32768,98304));
    L.push('hash 128KB-192KB: '+hashRange(b,131072,196608));
    if (b[0]===0x47) L.push('codec (PMT): '+tsParseVideoCodec(b.slice(0,131072)));
    else if (String.fromCharCode(b[4],b[5],b[6],b[7])==='ftyp') L.push('fMP4');
    else L.push('WARN: non TS/fMP4');
    const inner = decodeURIComponent((t.match(/[?&]u=([^&]+)/)||[])[1]||'');
    if (inner) L.push('file reale: '+(inner.match(/([^\/]+\.ts)/)||[inner])[0]);
    return R(L.join('\n'), 200, TXT());
  } catch (e) { return R(L.concat(['ERR: '+e.message]).join('\n'), 200, TXT()); }
}
const baseUrl_of = d => d.startsWith('http') ? d : 'https://'+d.replace(/^\/{2,}/,'');
async function checksegOne(source, ch) {
  const cc = findCh(ch); const slug = cc ? cc.slug : '';
  const L = ['--- '+source.toUpperCase()+' ('+(cc?cc.name:ch)+') ---'];
  try {
    if (!cc) return L.concat(['canale non trovato']);
    const R0 = await resolveForDiag(source, cc);
    if (!R0) return L.concat(['non risolto']);
    const r = await fetchPlaylistSmart(R0.url, R0.headers, 10000);
    if (!r.ok) return L.concat(['HTTP '+r.status]);
    const txt = await r.text(); const p = parseMediaPl(txt);
    L.push('seq '+p.upSeq+' | ENDLIST '+(p.endlist?'SI':'no')+' | segs '+p.segs.length);
    if (p.isMaster) { const v = masterCodecVerdict(txt);
      L.push('master: video '+v.video+' avc '+v.avc+' hevc '+v.hevc+(v.onlyHevc?' SOLO HEVC':'')); return L; }
    if (!p.segs.length) return L.concat(['nessun segmento']);
    const su = absSegUrl(p.segs[p.segs.length-1].url, R0.url);
    const rs = await fetchT(su, { headers:R0.headers }, 12000);
    const b = new Uint8Array(await rs.arrayBuffer());
    L.push('HTTP '+rs.status+' | size '+b.length+' | fp '+contentFingerprint(b));
    if (b[0]===0x47) L.push('codec: '+tsParseVideoCodec(b.slice(0,131072)));
    L.push('adapt: '+adaptLine(slug, source));
    return L;
  } catch (e) { return L.concat(['ERR: '+(e&&e.message)]); }
}
async function checkseg(u) {
  const all = u.searchParams.get('all')==='1';
  const source = u.searchParams.get('s')||'ntv';
  const ch = u.searchParams.get('ch')||'869';
  const L = ['=== CHECK SEG ===','Canale: '+ch,''];
  if (all) {
    const res = await Promise.all(['ntv','vavoo','daddy'].map(async s => {
      try { return await checksegOne(s,ch); } catch(e){ return ['--- '+s+' ---','ERR '+e.message]; } }));
    for (const part of res) L.push(...part,'');
    L.push('BYTE: /bytetest?ch='+ch+' | CODEC: /codec?ch='+ch);
    return R(L.join('\n'), 200, TXT());
  }
  L.push(...(await checksegOne(source,ch)),'');
  return R(L.join('\n'), 200, TXT());
}
async function warm() { const t0 = Date.now();
  const ids = DADDY_EDGE_IDS;
  let ok=0, err=0;
  for (let i=0;i<ids.length;i+=8)
    await Promise.all(ids.slice(i,i+8).map(async id => { try{await ntvToken(id,null);ok++}catch(e){err++} }));
  for (const ch of ['sky sport 24','sky sport uno','sky sport calcio','sky sport tennis','dazn 1','eurosport 1','rsi la 1','rsi la 2'])
    try{await vavooResolve(ch,null)}catch(e){}
  try{await ensureVavooMap()}catch(e){}
  const msg='WARM ok='+ok+' err='+err+' ('+(Date.now()-t0)+'ms) ntv='+tokenCache.size+' vavoo='+vavooURLCache.size;
  log(msg); return R(msg,200,TXT());
}
async function probe(u) {
  const q = u.searchParams.get('ch')||'';
  const c = findCh(q);
  if (!c) return 'canale non mappato: "'+q+'"\n\n'+elencoCanali();
  const h = getVavooHealth(c.slug);
  const L = ['PROBE '+c.name,
    'Health vavoo: prefer7='+h.prefer7+' fails6='+h.fails6+' fails7='+h.fails7,
    'SegFails: vavoo='+segFailCount(c.slug,'vavoo')+' ntv='+segFailCount(c.slug,'ntv')+' daddy='+segFailCount(c.slug,'daddy'),
    'H265: ntv='+(h265Bad(c.slug+'|ntv')?'SI':'no')+' vavoo='+(h265Bad(c.slug+'|vavoo')?'SI':'no')+' daddy='+(h265Bad(c.slug+'|daddy')?'SI':'no'),
    'CB: ntv='+(cbInCooldown(c.slug,'ntv')?'CD':'ok')+' vavoo='+(cbInCooldown(c.slug,'vavoo')?'CD':'ok')+' daddy='+(cbInCooldown(c.slug,'daddy')?'CD':'ok'),''];
  for (const pv of ['ntv','vavoo','daddy']) {
    L.push(pv + ': ' + adaptLine(c.slug, pv));
    const s = servedSeq.get(c.slug+'|'+pv);
    if (s) L.push('   seq servita ' + s.seq + ' (' + Math.round((Date.now()-s.t)/1000) + 's fa)');
  }
  L.push('');
  for (const pv of ['ntv','vavoo','daddy']) {
    const has = pv==='ntv'?!!c.ntv:pv==='daddy'?!!c.daddy:!!(c.vavoo||c.vid6||c.vid7);
    if (!has) { L.push(pv.toUpperCase()+': non mappato'); continue; }
    const t0=Date.now();
    try { const R0 = await resolveForDiag(pv, c);
      L.push(pv.toUpperCase()+': '+(R0?'OK ('+(Date.now()-t0)+'ms)':'null'));
      if (R0) L.push('   '+R0.url);
    } catch(e){ L.push(pv.toUpperCase()+': ERR '+e.message); }
  }
  L.push('', '/codec?ch='+c.slug+'  |  /bytetest?ch='+c.slug+'  |  /adapt?ch='+c.slug);
  return L.join('\n'); }
const vmap = async () => { const m = await ensureVavooMap(true);
  return m ? 'VMAP: '+m.size+' canali ('+vavooMap.src+')' : 'VMAP: nessuna fonte'; };
async function diag(u) {
  const q = u.searchParams.get('ch')||'sky-sport-24';
  const c = findCh(q);
  if (!c) return 'Canale non trovato: '+q;
  const L = ['=== DIAG '+VER+' ===','Canale: '+c.name+' ('+c.slug+')','',
    'formula finestra: max('+MIN_SEGS+', ceil(runway/segDur)+1) + backoff',
    'runway base '+RUNWAY_BASE+'s | backoff max +'+EXTRA_SEGS_MAX+' seg | decay '+(CLEAN_DECAY_MS/60000)+'min',''];
  const tryP = async (label, prov) => {
    const t0=Date.now();
    try {
      const R0 = await resolveForDiag(prov, c);
      if (!R0) throw new Error('non risolto');
      const r = await fetchPlaylistSmart(R0.url, R0.headers, 10000);
      if (!r.ok) throw new Error('HTTP '+r.status);
      const txt = await r.text(); const p = parseMediaPl(txt);
      L.push('-- '+label+' ('+(Date.now()-t0)+'ms) --');
      if (p.isMaster) {
        const v = masterCodecVerdict(txt);
        L.push('   master: video '+v.video+' avc '+v.avc+' hevc '+v.hevc+(v.onlyHevc?' SOLO HEVC (coda)':''));
      } else {
        const durs = p.segs.map(s=>s.dur||p.upTarget);
        noteSegDur(c.slug, prov, durs);
        const plan = pickWindow(durs, prov, c.slug, 0, false);
        const total = durs.reduce((a,b)=>a+b,0);
        const lag = srcLagOf(p); if (lag!=null) noteSrcLag(c.slug+'|'+prov, lag);
        L.push('   fonte '+p.segs.length+' seg / '+total.toFixed(1)+'s | segDur medio '+(total/Math.max(p.segs.length,1)).toFixed(2)+'s');
        L.push('   PUBBLICO '+plan.count+' seg = '+plan.sum.toFixed(1)+'s | runway target '+plan.runway+'s +'+plan.extra+' seg');
        L.push('   ENDLIST '+(p.endlist?'SI (rimosso)':'no')+' | lag fonte '+lagTxt(c.slug+'|'+prov));
      }
      L.push('   adapt: '+adaptLine(c.slug,prov));
    } catch(e){ L.push('-- '+label+' ('+(Date.now()-t0)+'ms) --','   ERR '+(e&&e.message)); }
    L.push('');
  };
  if (c.vavoo||c.vid6||c.vid7) await tryP('VAVOO','vavoo');
  if (c.ntv) await tryP('NTV','ntv');
  if (c.daddy) await tryP('DADDY','daddy');
  L.push('=== PAVIMENTO FISICO ===',
    'delay = segmenti pubblicati x segDur. Il live edge e\' l\'ultimo segmento',
    'COMPLETO: riprodurlo costa gia\' segDur. Con 1 solo segmento il player',
    'non ha runway -> stallo. Quindi 2 segmenti sono il minimo praticabile.',
    '  segDur 6.1s -> 12.2s | segDur 2.5s -> 7.5s (3 seg) | segDur 14.5s -> 29s',
    '',
    'Test: /live?ch='+c.slug+'&d=2 (forza 2 seg) vs &d=3 (3 seg)',
    'Codec: /codec?ch='+c.slug+' | Byte: /bytetest?ch='+c.slug);
  return L.join('\n'); }
function debug() { const vm = vavooMapGet(); const now = Date.now();
  const sf = [];
  for (const [k,arr] of segFails) { const l = arr.filter(t=>now-t<SEGFAIL_TTL); if (l.length) sf.push(k+'='+l.length); }
  const cds = []; for (const [k,until] of cbCooldown) if (until>now) cds.push(k);
  const h265 = Array.from(h265Memo.entries()).filter(([,e])=>e.bad&&now-e.t<H265_TTL).map(([k])=>k);
  const fz = Array.from(freezeDetected.entries()).filter(([,t])=>now-t<FREEZE_TTL).map(([k,t])=>k+'('+Math.round((now-t)/1000)+'s)');
  const bs = Array.from(byteSamples.entries()).map(([k,e])=>k+': '+(e.same?'BYTE IDENTICI':'byte diversi'));
  // E3: delay stimato per canale + instabilita'
  const est = [];
  for (const [k,a] of chAdapt) {
    if (now - a.t > 15*60*1000) continue;
    const d = (a.segDur && a.lastCount) ? (a.segDur*a.lastCount).toFixed(1)+'s' : 'n/d';
    est.push(k+' ~'+d+' ('+a.lastCount+'seg x '+(a.segDur?a.segDur.toFixed(1):'?')+'s)'+
      (a.extraSegs?' +'+a.extraSegs+'backoff':'')+
      (a.retries||a.fails?' [r'+a.retries+'/f'+a.fails+']':''));
  }
  return [VER,
    'Cache: NTV='+tokenCache.size+' Daddy='+daddyCache.size+' VavooURL='+vavooURLCache.size,
    'Vavoo map: '+(vm?vm.size:'non caricata')+' | host CDN '+vavooGoodHost.replace('https://','')+' (fail '+vavooHostFails+')',
    'Playlist: single-flight '+PLAYLIST_FRESH_MS+'ms | plCache '+PL_CACHE_TTL+'ms | bust CDN '+PL_BUST_MS+'ms',
    'Segmenti: player NO-CACHE | edge CF '+SEG_CACHE_TTL+'s | Cache API '+SEG_API_TTL+'s | bust '+BUST_MS/1000+'s | timeout '+SEG_TIMEOUTS.join('/')+'ms',
    'Finestra: max('+MIN_SEGS+', ceil(runway/segDur)+1)+backoff | runway '+RUNWAY_BASE+'s (w='+RUNWAY_WIDE+') | backoff max +'+EXTRA_SEGS_MAX,
    'DELAY STIMATO PER CANALE: '+(est.sort().join(' | ')||'nessuna misura'),
    'Prefetch '+PREFETCH_SEGS+' seg (nel single-flight) | join single-flight='+segStat.joined+' | in volo='+segInflight.size,
    'H265 in coda: '+(h265.join(', ')||'nessuno'),
    'BYTETEST: '+(bs.join(', ')||'nessuno'),
    'FREEZE marcati: '+(fz.join(', ')||'nessuno'),
    'SEQ SERVITI: '+servedSeqManual(),
    'FREEZE >90s: '+frozenManual(),
    'Lag fonte PDT: '+(Array.from(lagMemo.entries()).filter(([,e])=>now-e.t<LAG_TTL_MS).sort((a,b)=>b[1].lag-a[1].lag).map(([k,e])=>k+'='+Math.round(e.lag)+'s').join(', ')||'nessuno'),
    'CB cooldown: '+(cds.join(', ')||'nessuno')+' | SegFails: '+(sf.join(', ')||'nessuno'),
    'NTV: resolve='+ntvStats.resolve+' refresh='+ntvStats.refresh+' err='+ntvStats.err,
    'Richieste: live='+reqStats.live+' seg='+reqStats.seg,
    'Cache API hit='+segStat.apiHits+' origine='+segStat.origin+' ('+(segStat.apiHits+segStat.origin?Math.round(segStat.apiHits*100/(segStat.apiHits+segStat.origin)):0)+'% senza origine)',
    'warm cursor '+warmCursor+'/'+CHANNELS.length+' | heartbeat '+(lastHeartbeat?Math.round((now-lastHeartbeat)/1000)+'s fa':'mai'),
    'Log:','  '+(logs.slice(-18).join('\n  ')||'(vuoti)')
  ].join('\n'); }
function uso(P) { return [VER,'',
    'uso:',
    '  /live?ch=<slug>            delay adattivo per canale (minimo sicuro)',
    '  /live?ch=<slug>&d=2        FORZA 2 segmenti (test delay minimo)',
    '  /live?ch=<slug>&d=3        FORZA 3 segmenti (test stabilita\')',
    '  /live?ch=<slug>&w=1        runway largo 12s (confronto)',
    '  /live?ch=<slug>&p=vavoo    forza provider',
    '  /player?ch=<slug>          player con SN / Playhead / Underrun',
    '',
    'misura:',
    '  /adapt?ch=<slug>           segDur misurato, segmenti, delay, backoff',
    '  /diag?ch=<slug>            finestra pubblicata + pavimento fisico',
    '  /codec?ch=<slug>           verdetto H264/HEVC per provider',
    '  /codec?all=1&page=1        mappa codec tutti i canali (2 per pagina)',
    '  /bytetest?ch=<slug>&p=ntv  i byte avanzano?',
    '  /freezetest?ch=<slug>      seq upstream (2 chiamate a 30s)',
    '  /probe /debug /checkseg?ch=<slug>&all=1 /segtest /rawu /dump',
    '  /warm /vmap /ch /ip',
    ''].join('\n'); }

// --- HELPERS ---------------------------------------------------------------
function TXT() { return { 'content-type':'text/plain; charset=utf-8', ...CORS() }; }
function HLS_NO_CACHE() {
  return { 'content-type':'application/vnd.apple.mpegurl',
    'cache-control':'no-cache, no-store, must-revalidate','pragma':'no-cache','expires':'0', ...CORS() };
}
function CORS() { return { 'access-control-allow-origin':'*' }; }
function R(body, status, headers) {
  const h = Object.assign({ 'content-type':'text/plain; charset=utf-8' }, headers||{});
  if (status===302) delete h['content-type'];
  return new Response(body, { status:status||200, headers:h });
}
async function rawu(u) {
  const t = u.searchParams.get('u');
  if (!t) return R('uso: /rawu?u=<url>', 200, TXT());
  const h = getBrowserHeaders(u.searchParams.get('ref')||'https://thedaddy.li/','rawu');
  if (u.searchParams.get('o')) h['Origin']=u.searchParams.get('o');
  let r; try {
    r = /\.m3u8(\?|$)/i.test(t) ? await fetchPlaylistSmart(t,h,15000)
      : await fetchT(t,{headers:h,cf:{cacheTtl:0,cacheEverything:false},redirect:'follow'},15000);
  } catch(e){ return R('ERR: '+(e&&e.message),200,TXT()); }
  let body=''; try{body=await r.text()}catch(e){body='(no body)'}
  const p = /\.m3u8(\?|$)/i.test(t) ? parseMediaPl(body) : null;
  const head = p ? ('SEQ '+p.upSeq+' | ENDLIST '+(p.endlist?'SI':'no')+' | segs '+p.segs.length+'\n\n') : '';
  return R('status '+r.status+' | len '+body.length+'\n'+head+body.slice(0,3000),200,TXT());
}
async function fetchT(url, opt, ms) {
  const o = Object.assign({}, opt||{});
  if (ms && typeof AbortController !== 'undefined') {
    const ac = new AbortController();
    const t = setTimeout(()=>{try{ac.abort()}catch(e){}}, ms);
    o.signal = ac.signal;
    try { return await fetch(url,o); } finally { clearTimeout(t); }
  }
  return fetch(url,o); }
