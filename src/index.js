// ============================================================================
// TVNOW-CF v1.7 — NTV + VAVOO + DADDYLIVE (Player 2优先) + MATCHORA
// Cloudflare Worker — file unico, zero dipendenze.
//
// Catena DADDYLIVE ottimizzata:
//   1. Prova https://dlhd.sx/embed/stream-{id}-2.php (Player 2, più veloce)
//   2. Se fallisce, prova https://dlhd.sx/embed/stream-{id}.php (Player 1)
//   3. Estrae iframe annidato o link .m3u8 diretto con helper dedicato.
//
// ENDPOINT:
//   /live?ch=<slug|id>   playlist proxy (riscritta sui segmenti del worker)
//   /ntv /vavoo /daddy /htsport  alias legacy con ordine provider forzato
//   /seg?u=<url>         pass-through segmenti (Range incluso)
//   /ch                  elenco canali mappati
//   /probe?ch=<slug>     diagnostica catena completa per un canale
//   /debug               stato (cache token, versioni)
//   /rawu?u=&ref=&o=&len=&find=   fetch arbitraria con header custom
//   /ip                  IP egress
// ============================================================================

export default {
  async fetch(req) {
    const u = new URL(req.url);
    const P = u.origin;
    const path = u.pathname;

    if (req.method === 'HEAD' || req.method === 'OPTIONS') {
      return R('OK', 200, { 'content-type': 'text/plain; charset=utf-8', ...CORS() });
    }
    try {
      if (path === '/live') return await live(u, P, null);
      if (path === '/ntv') return await live(u, P, 'ntv');
      if (path === '/vavoo') return await live(u, P, 'vavoo');
      if (path === '/daddy') return await live(u, P, 'daddy');
      if (path === '/htsport') return await live(u, P, 'matchora');
      if (path === '/seg') return await seg(u);
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
  }
};

// ============================= CANALI ======================================
// ntv   = ID numerico per chat.cfbu247.sbs/api/resolve-dlstream
// vavoo = query di ricerca per il fallback Vavoo
// hts   = pagina htsport.info per il terzo provider (Matchora)
// daddy = ID numerico per DaddyLive (stream-<id>.php)

const CHANNELS = [
  // --- SOLO VAVOO ---
  { slug: 'rsi-la-1',            name: 'RSI La 1',          ntv: '',    vavoo: 'rsi la 1',        hts: '', daddy: '' },
  { slug: 'rsi-la-2',            name: 'RSI La 2',          ntv: '',    vavoo: 'rsi la 2',        hts: '', daddy: '' },
  { slug: 'sky-sport-serie-a',   name: 'Sky Sport Serie A', ntv: '',    vavoo: 'sky sport serie a', hts: '', daddy: '880' },

  // --- TRIPLETTE COMPLETE (Vavoo + NTV + Daddy + Matchora) ---
  { slug: 'sky-sport-24',        name: 'Sky Sport 24',      ntv: '869', vavoo: 'sky sport 24',      hts: 'sport24hd', daddy: '869' },
  { slug: 'sky-sport-uno',       name: 'Sky Sport Uno',     ntv: '461', vavoo: 'sky sport uno',     hts: 'sport1',    daddy: '461' },
  { slug: 'sky-sport-calcio',    name: 'Sky Sport Calcio',  ntv: '870', vavoo: 'sky sport calcio',  hts: 'calciohd',  daddy: '870' },
  { slug: 'sky-sport-tennis',    name: 'Sky Sport Tennis',  ntv: '576', vavoo: 'sky sport tennis',  hts: 'tennishd',  daddy: '576' },
  { slug: 'sky-sport-arena',     name: 'Sky Sport Arena',   ntv: '462', vavoo: 'sky sport arena',   hts: 'sportarenahd', daddy: '462' },
  { slug: 'sky-sport-basket',    name: 'Sky Sport Basket',  ntv: '875', vavoo: 'sky sport basket',  hts: 'baskethd',  daddy: '875' },
  { slug: 'sky-sport-max',       name: 'Sky Sport Max',     ntv: '460', vavoo: 'sky sport max',     hts: 'sportmaxhd', daddy: '460' },
  { slug: 'sky-sport-f1',        name: 'Sky Sport F1',      ntv: '577', vavoo: 'sky sport f1',      hts: 'f1hd',      daddy: '577' },
  { slug: 'sky-sport-motogp',    name: 'Sky Sport MotoGP',  ntv: '575', vavoo: 'sky sport motogp',  hts: 'motohd',    daddy: '575' },
  { slug: 'sky-sport-golf',      name: 'Sky Sport Golf',    ntv: '574', vavoo: 'sky sport golf',    hts: 'golfhd',    daddy: '574' },
  { slug: 'dazn-1',              name: 'DAZN 1',            ntv: '877', vavoo: 'dazn 1',            hts: 'dazn1hd',   daddy: '877', vid: '2745635299' },
  { slug: 'eurosport-1',         name: 'Eurosport 1',       ntv: '878', vavoo: 'eurosport 1',       hts: 'eurosport1hd', daddy: '878', vid: '3448075317' },
  { slug: 'eurosport-2',         name: 'Eurosport 2',       ntv: '879', vavoo: 'eurosport 2',       hts: 'eurosport2hd', daddy: '879', vid: '2317684453' },

  // --- SOLO NTV + DADDY (Cinema, Calcio 25x, Crime, Serie) ---
  { slug: 'sky-calcio-251',      name: 'Sky Calcio 251',    ntv: '871', vavoo: '', hts: '', daddy: '871' },
  { slug: 'sky-calcio-252',      name: 'Sky Calcio 252',    ntv: '872', vavoo: '', hts: '', daddy: '872' },
  { slug: 'sky-calcio-253',      name: 'Sky Calcio 253',    ntv: '873', vavoo: '', hts: '', daddy: '873' },
  { slug: 'sky-cinema-uno',      name: 'Sky Cinema Uno',    ntv: '860', vavoo: '', hts: '', daddy: '860' },
  { slug: 'sky-cinema-action',   name: 'Sky Cinema Action', ntv: '861', vavoo: '', hts: '', daddy: '861' },
  { slug: 'sky-cinema-comedy',   name: 'Sky Cinema Comedy', ntv: '862', vavoo: '', hts: '', daddy: '862' },
  { slug: 'sky-cinema-collection',name:'Sky Cinema Collection',ntv:'859',vavoo:'', hts: '', daddy: '859' },
  { slug: 'sky-cinema-romance',  name: 'Sky Cinema Romance',ntv: '864', vavoo: '', hts: '', daddy: '864' },
  { slug: 'sky-cinema-family',   name: 'Sky Cinema Family', ntv: '865', vavoo: '', hts: '', daddy: '865' },
  { slug: 'sky-cinema-drama',    name: 'Sky Cinema Drama',  ntv: '867', vavoo: '', hts: '', daddy: '867' },
  { slug: 'sky-cinema-suspense', name: 'Sky Cinema Suspense',ntv:'868', vavoo: '', hts: '', daddy: '868' },
  { slug: 'sky-crime',           name: 'Sky Crime',         ntv: '863', vavoo: '', hts: '', daddy: '863' },
  { slug: 'sky-serie',           name: 'Sky Serie',         ntv: '880', vavoo: '', hts: '', daddy: '880' },

  // --- ALTRI CANALI ---
  { slug: 'sky-cinema-uno-24',   name: 'Sky Cinema Uno +24', ntv: '863', vavoo: '', hts: '', daddy: '863' },
  { slug: 'sky-cinema-due-24',   name: 'Sky Cinema Due +24', ntv: '866', vavoo: '', hts: '', daddy: '866' },
  { slug: 'sky-uno',             name: 'Sky Uno',           ntv: '881', vavoo: 'sky uno', hts: '', daddy: '881' },
  { slug: 'italia-1',            name: 'Italia 1',          ntv: '854', vavoo: 'italia 1', hts: '', daddy: '854' },
  { slug: 'la7',                 name: 'La7',               ntv: '855', vavoo: 'la7', hts: '', daddy: '855', vid: '775530063' },
  { slug: 'la7d',                name: 'LA7d',              ntv: '856', vavoo: 'la7d', hts: '', daddy: '856' },
  { slug: 'rai-premium',         name: 'Rai Premium',       ntv: '858', vavoo: '', hts: '', daddy: '858', vid: '2828455552' },
  { slug: 'rai-sport',           name: 'Rai Sport',         ntv: '882', vavoo: 'rai sport', hts: '', daddy: '882', vid: '551730224' }
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
    m.set(c.slug, c);
    m.set(norm(c.name), c);
    if (c.ntv) m.set(c.ntv, c);
    if (c.daddy) m.set('d' + c.daddy, c);
  }
  for (const [a, s] of Object.entries(ALIASES)) {
    const c = m.get(s);
    if (c) m.set(a, c);
  }
  return m;
})();

function norm(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function findCh(q) {
  let k = norm(q);
  if (BY_KEY.has(k)) return BY_KEY.get(k);
  k = k.replace(/-ntv$/, '').replace(/-daddy$/, '');
  return BY_KEY.get(k) || null;
}

function elencoCanali() {
  const L = ['CANALI (' + CHANNELS.length + ') — /live?ch=<slug o id>'];
  for (const c of CHANNELS) {
    L.push('  ' + c.slug.padEnd(22) + ' ntv=' + String(c.ntv).padEnd(4) + ' vavoo=' + (c.vavoo || '-').padEnd(18) + ' daddy=' + (c.daddy || '-').padEnd(4) + (c.hts ? ' [matchora: ' + c.hts + ']' : ''));
  }
  return L.join('\n');
}

// ============================= NTV (PRIMARIO) ==============================

const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';
const tokenCache = new Map();
let ntvStats = { resolve: 0, refresh: 0, err: 0 };

async function ntvToken(id) {
  const now = Date.now() / 1000;
  const c = tokenCache.get(id);
  if (c && c.exp - now > 3600) return c;
  ntvStats.resolve++;
  const r = await fetchT(NTV_API + id, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, 12000);
  if (!r.ok) { ntvStats.err++; throw new Error('ntv api ' + r.status); }
  const j = await r.json().catch(() => null);
  const m3u8 = j && (j.m3u8 || j.proxyPlaylistUrl || j.proxyPlayerUrl);
  if (!m3u8) { ntvStats.err++; throw new Error('ntv api senza m3u8 (mode ' + (j && j.mode) + ')'); }
  const exp = +(String(m3u8).match(/[?&]e=(\d+)/) || [])[1] || (now + 86400);
  const entry = { m3u8: m3u8, exp: exp, ref: (j && j.referer) || '' };
  tokenCache.set(id, entry);
  return entry;
}

async function ntvPlaylist(id) {
  let tk = await ntvToken(id);
  let r = await fetchT(tk.m3u8, { headers: reqHeaders(tk.ref) }, 12000);
  if (r.status === 403 || r.status === 401) {
    tokenCache.delete(id);
    ntvStats.refresh++;
    tk = await ntvToken(id);
    r = await fetchT(tk.m3u8, { headers: reqHeaders(tk.ref) }, 12000);
  }
  if (!r.ok) throw new Error('ntv playlist ' + r.status);
  const txt = await r.text();
  if (!txt.includes('#EXTM3U')) throw new Error('ntv playlist non-HLS');
  return { txt: txt, ref: tk.ref };
}

function reqHeaders(ref) {
  const h = { 'User-Agent': UA, 'Accept': '*/*' };
  if (ref) h['Referer'] = ref;
  return h;
}

// ============================= DADDYLIVE (PLAYER 2 PRIORITARIO) ============

const DADDY_DOMAINS = [
  'https://dlhd.sx',
  'https://daddylive.mp',
  'https://dlhd.to',
  'https://daddylive.live'
];

const daddyCache = new Map();
const DADDY_TTL = 5 * 60 * 1000; // 5 minuti

async function daddyResolve(id) {
  if (!id) return null;
  const now = Date.now();
  const cached = daddyCache.get(id);
  if (cached && cached.exp > now) return cached.url;

  for (const domain of DADDY_DOMAINS) {
    try {
      // 🔥 PROVA PRIMA IL PLAYER 2 (più veloce e stabile)
      const embedUrlP2 = `${domain}/embed/stream-${id}-2.php`;
      let m3u8 = await extractM3u8FromEmbed(embedUrlP2, domain);
      if (m3u8) {
        daddyCache.set(id, { url: m3u8, exp: now + DADDY_TTL });
        return m3u8;
      }

      // 🔥 FALLBACK AL PLAYER 1 se il 2 fallisce
      const embedUrlP1 = `${domain}/embed/stream-${id}.php`;
      m3u8 = await extractM3u8FromEmbed(embedUrlP1, domain);
      if (m3u8) {
        daddyCache.set(id, { url: m3u8, exp: now + DADDY_TTL });
        return m3u8;
      }
    } catch (e) {
      continue; // prova dominio successivo
    }
  }
  return null;
}

async function extractM3u8FromEmbed(embedUrl, refererDomain) {
  const r = await fetchT(embedUrl, {
    headers: { 'User-Agent': UA, 'Referer': refererDomain + '/' },
    cf: { cacheTtl: 300, cacheEverything: true }
  }, 12000);

  if (!r.ok) return null;
  const html = await r.text();

  // 1) Cerca m3u8 diretto nella pagina
  let m3u8 = html.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i);
  if (m3u8) return m3u8[1];

  // 2) Cerca iframe e scendi di un livello
  const iframe = html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
  if (iframe) {
    const r2 = await fetchT(iframe[1], {
      headers: { 'User-Agent': UA, 'Referer': embedUrl },
      cf: { cacheTtl: 300, cacheEverything: true }
    }, 12000);

    if (r2.ok) {
      const html2 = await r2.text();
      m3u8 = html2.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i);
      if (m3u8) return m3u8[1];
    }
  }
  return null;
}

// ============================= VAVOO (SECONDO) =============================

const VAVOO_MIRRORS = [
  'https://vavoo.to', 'https://kool.to', 'https://vavoo.net', 'https://kool.ws',
  'https://huhu.to', 'https://oha.to', 'https://voltop.net',
  'https://geil.to', 'https://geil.app', 'https://geil.win'
];

const VAVOO_SOURCES = [
  'https://raw.githubusercontent.com/aphrodite747/VvOo/main/index_Italy.m3u',
  'https://raw.githubusercontent.com/BontAce/VVOOITV/main/index_Italy.m3u'
];
let vavooMap = { map: null, t: 0, src: '' };
const VAVOO_MAP_TTL = 6 * 3600 * 1000;

function vavooMapGet() { return (vavooMap.map && Date.now() - vavooMap.t < VAVOO_MAP_TTL) ? vavooMap.map : null; }

async function ensureVavooMap(force) {
  const cached = vavooMapGet();
  if (cached && !force) return cached;
  for (const src of VAVOO_SOURCES) {
    try {
      const r = await fetchT(src, { headers: { 'User-Agent': UA } }, 15000);
      if (!r.ok) continue;
      const t = await r.text();
      const m = new Map();
      const blocks = t.split('#EXTINF');
      for (const b of blocks) {
        const nm = (b.match(/tvg-name="([^"]+)"/) || [])[1];
        const id = (b.match(/vavoo\/(\d+)\.m3u8/) || [])[1];
        if (nm && id) {
          const k = norm(nm.replace(/\s*\(\d+\)\s*$/, ''));
          if (k && !m.has(k)) m.set(k, id);
        }
      }
      if (m.size > 50) { vavooMap = { map: m, t: Date.now(), src }; return m; }
    } catch (e) {}
  }
  return cached;
}

function vavooMapFind(query, m) {
  if (!m || !query) return null;
  const q = norm(query);
  if (m.has(q)) return m.get(q);
  for (const [k, id] of m) if (k.includes(q) || q.includes(k)) return id;
  const qs = q.replace(/-/g, '');
  for (const [k, id] of m) { const ks = k.replace(/-/g, ''); if (ks === qs || ks.includes(qs) || qs.includes(ks)) return id; }
  return null;
}

function vavooHeaders(extra) {
  return Object.assign({
    'User-Agent': 'MediaHubMX/2',
    'Accept': 'application/json',
    'Origin': 'https://vavoo.to',
    'Referer': 'https://vavoo.to/'
  }, extra || {});
}

async function vavooResolveId(base, id) {
  const play = base + '/live/play/' + id;
  try {
    const r = await fetchT(base + '/live/resolve?url=' + encodeURIComponent(play),
      { headers: { 'User-Agent': UA, 'Referer': 'https://vavoo.to/', 'Origin': 'https://vavoo.to' } }, 10000);
    if (r.ok) {
      const j = await r.json().catch(() => null);
      if (j && j.url) return j.url;
    }
  } catch (e) {}
  try {
    const r = await fetchT(base + '/mediahubmx-resolve.json', {
      method: 'POST',
      headers: vavooHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ language: 'de', region: 'DE', url: play, clientVersion: '3.0.2' })
    }, 10000);
    if (r.ok) {
      const j = await r.json().catch(() => null);
      if (j && j.url) return j.url;
    }
  } catch (e) {}
  return null;
}

async function vavooResolve(query, vid) {
  let id = vid || null;
  if (!id) {
    const m = await ensureVavooMap();
    id = vavooMapFind(query, m);
  }
  if (id) {
    for (const base of VAVOO_MIRRORS) {
      const u = await vavooResolveId(base, id);
      if (u) return u;
    }
    return null;
  }
  if (!query) return null;
  for (const base of VAVOO_MIRRORS.slice(0, 4)) {
    try {
      let ids = [];
      const rl = await fetchT(base + '/mediahubmx-list.json', {
        method: 'POST',
        headers: vavooHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ language: 'it', region: 'IT', clientVersion: '3.0.2', url: 'https://vavoo.to/live' })
      }, 8000);
      if (rl.ok) {
        const j = await rl.json().catch(() => null);
        const items = j && (j.items || j.channels || j.entries) || [];
        const q = norm(query);
        for (const it of items) {
          const nm = norm(it.name || it.title || '');
          const iid = it.id || ((it.url || '').match(/play\/(\d+)/) || [])[1];
          if (iid && (nm === q || nm.includes(q))) { ids.push(String(iid)); break; }
        }
      }
      for (const id2 of ids.slice(0, 3)) {
        const u = await vavooResolveId(base, id2);
        if (u) return u;
      }
    } catch (e) {}
  }
  return null;
}

// ============================= MATCHORA (QUARTO) ===========================

async function matchoraResolve(c) {
  if (!c.hts) return null;
  const r1 = await fetchT('https://htsport.info/' + c.hts + '.htm',
    { headers: { 'User-Agent': UA, 'Referer': 'https://htsport.info/' } }, 12000);
  if (!r1.ok) return null;
  const page = await r1.text();
  const im = page.match(/https?:\/\/matchora\.pro\/embed\/channel\/(\d+)[^"'\s>]*/);
  if (!im) return null;
  const ch = im[1], embedUrl = im[0];
  const r2 = await fetchT(embedUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://htsport.info/' } }, 12000);
  if (!r2.ok) return null;
  const emb = await r2.text();
  const cookies = (r2.headers.getSetCookie ? r2.headers.getSetCookie() : [])
    .map(x => String(x).split(';')[0]).join('; ');
  const fx = (emb.match(/FX="([^"]*)"/) || [])[1] || '';
  const pp = (emb.match(/PP="([^"]*)"/) || [])[1] || '';
  const q = [];
  if (fx) q.push('fx=' + encodeURIComponent(fx));
  if (pp) q.push('pp=' + encodeURIComponent(pp));
  const r3 = await fetchT('https://matchora.pro/api/cast/' + ch + (q.length ? '?' + q.join('&') : ''), {
    headers: {
      'User-Agent': UA, 'Accept': 'application/json',
      'Referer': embedUrl, 'Origin': 'https://matchora.pro',
      ...(cookies ? { 'Cookie': cookies } : {})
    }
  }, 12000);
  if (!r3.ok) return null;
  const j = await r3.json().catch(() => null);
  if (!j || !j.url) return null;
  let out = j.url;
  if (j.relay) out = String(out).replace(/^https?:\/\/[^/]+/, j.relay);
  return out;
}

// ============================= /live =======================================

let lastPl = { key: '', txt: '', t: 0 };

async function live(u, P, legacy) {
  const q = u.searchParams.get('ch') || u.searchParams.get('c') || '';
  if (!q) return R('uso: /live?ch=<slug|id>[&p=ntv,vavoo,daddy,matchora][&direct=1]\n\n' + elencoCanali(), 200, TXT());
  const c = findCh(q);
  if (!c) return R('canale non mappato: "' + q + '"\n\n' + elencoCanali(), 200, TXT());

  const direct = u.searchParams.get('direct') === '1';
  const order = legacy ? [legacy, ...['ntv', 'vavoo', 'daddy', 'matchora'].filter(x => x !== legacy)]
    : (u.searchParams.get('p') || 'ntv,vavoo,daddy,matchora')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const ck = c.slug + (direct ? ':d' : '') + ':' + order.join('.');
  if (lastPl.key === ck && Date.now() - lastPl.t < 2000) return R(lastPl.txt, 200, HLS());

  const provs = {
    // 1) NTV
    ntv: async () => {
      if (!c.ntv) return null;
      const pl = await ntvPlaylist(c.ntv);
      const out = direct ? pl.txt : rewritePl(pl.txt, null, P, pl.ref);
      lastPl = { key: ck, txt: out, t: Date.now() };
      return R(out, 200, HLS());
    },
    // 2) VAVOO
    vavoo: async () => {
      if (!c.vavoo && !c.vid) return null;
      const vu = await vavooResolve(c.vavoo, c.vid);
      if (!vu) return null;
      if (/\.m3u8(\?|$)/.test(vu)) {
        const r = await fetchT(vu, { headers: vavooHeaders({ 'User-Agent': UA }) }, 12000);
        if (r.ok) {
          const out = rewritePl(await r.text(), vu, P, 'https://vavoo.to/');
          lastPl = { key: ck, txt: out, t: Date.now() };
          return R(out, 200, HLS());
        }
      }
      return R('redirect vavoo', 302, { Location: vu, ...CORS() });
    },
    // 3) DADDYLIVE (Player 2 prioritario)
    daddy: async () => {
      if (!c.daddy) return null;
      const du = await daddyResolve(c.daddy);
      if (!du) return null;
      if (/\.m3u8(\?|$)/.test(du)) {
        const r = await fetchT(du, {
          headers: { 'User-Agent': UA, 'Referer': 'https://dlhd.sx/' }
        }, 12000);
        if (r.ok) {
          const out = rewritePl(await r.text(), du, P, 'https://dlhd.sx/');
          lastPl = { key: ck, txt: out, t: Date.now() };
          return R(out, 200, HLS());
        }
      }
      return R('redirect daddy', 302, { Location: du, ...CORS() });
    },
    // 4) MATCHORA
    matchora: async () => {
      const mu = await matchoraResolve(c);
      if (!mu) return null;
      if (/\.m3u8(\?|$)/.test(mu)) {
        const r = await fetchT(mu, {
          headers: { 'User-Agent': UA, 'Referer': 'https://matchora.pro/', 'Origin': 'https://matchora.pro' }
        }, 12000);
        if (r.ok) {
          const out = rewritePl(await r.text(), mu, P, 'https://matchora.pro/');
          lastPl = { key: ck, txt: out, t: Date.now() };
          return R(out, 200, HLS());
        }
      }
      return R('redirect matchora', 302, { Location: mu, ...CORS() });
    }
  };

  for (const p of order) {
    const fn = provs[p];
    if (!fn) continue;
    try {
      const res = await fn();
      if (res) return res;
    } catch (e) {
      log(p + ' ko ' + c.slug + ': ' + (e && e.message));
    }
  }
  return R('ERRORE: provider KO (' + order.join(' -> ') + ') per ' + c.name + ' (ntv=' + (c.ntv || '-') + ' daddy=' + (c.daddy || '-') + '). /probe?ch=' + c.slug + ' per la diagnostica.', 200, TXT());
}

function rewritePl(txt, baseUrl, P, ref) {
  const lines = String(txt).split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) { out.push(''); continue; }
    if (t[0] === '#') { out.push(t); continue; }
    let abs = t;
    if (baseUrl && !/^https?:\/\//i.test(t)) {
      abs = baseUrl.replace(/[^/]*$/, '') + t.replace(/^\.\//, '');
      abs = abs.replace(/([^:])\/{2,}/g, '$1/');
    }
    out.push(P + '/seg?u=' + encodeURIComponent(abs) + (ref ? '&ref=' + encodeURIComponent(ref) : ''));
  }
  return out.join('\n');
}

// ============================= /seg ========================================

async function seg(u) {
  const target = u.searchParams.get('u');
  if (!target) return R('uso: /seg?u=<url>', 200, TXT());
  const h = { 'User-Agent': UA, 'Accept': '*/*' };
  if (u.searchParams.get('ref')) h['Referer'] = u.searchParams.get('ref');
  if (u.searchParams.get('o')) h['Origin'] = u.searchParams.get('o');
  const range = u.searchParams.get('range');
  if (range) h['Range'] = range;
  const r = await fetchT(target, { headers: h }, 20000);
  const hh = { 'content-type': r.headers.get('content-type') || 'video/mp2t', 'access-control-allow-origin': '*' };
  const cl = r.headers.get('content-length');
  const cr = r.headers.get('content-range');
  if (cl) hh['content-length'] = cl;
  if (cr) hh['content-range'] = cr;
  return new Response(r.body, { status: r.status, headers: hh });
}

// ============================= /probe ======================================

async function probe(u) {
  const q = u.searchParams.get('ch') || '';
  const c = findCh(q);
  if (!c) return 'canale non mappato: "' + q + '"\n\n' + elencoCanali();
  const L = ['PROBE ' + c.name + ' (slug=' + c.slug + ' ntv=' + (c.ntv||'-') + ' vavoo=' + (c.vavoo||'-') + ' daddy=' + (c.daddy||'-') + ' hts=' + (c.hts||'-') + ')'];
  // NTV
  try {
    if (!c.ntv) {
      L.push('1) NTV: non mappato (salto)');
    } else {
      const t0 = Date.now();
      const tk = await ntvToken(c.ntv);
      const exp = (String(tk.m3u8).match(/[?&]e=(\d+)/) || [])[1];
      const ore = exp ? ((+exp - Date.now() / 1000) / 3600).toFixed(1) : '~24 (token opaco)';
      const r = await fetchT(tk.m3u8, { headers: reqHeaders(tk.ref) }, 12000);
      const txt = r.ok ? await r.text() : '';
      const segs = (txt.match(/#EXTINF/g) || []).length;
      const first = (txt.split(/\r?\n/).find(l => l.trim() && l.trim()[0] !== '#') || '').trim();
      L.push('1) NTV: API OK, token exp tra ' + ore + 'h | playlist ' + r.status + ' ' + segs + ' segs (' + (Date.now() - t0) + 'ms)');
      if (first) {
        const rs = await fetchT(first, { headers: reqHeaders(tk.ref) }, 15000);
        const kb = rs.headers.get('content-length') ? Math.round(+rs.headers.get('content-length') / 1024) + 'KB' : '?';
        L.push('   seg[0]: ' + rs.status + ' ' + (rs.headers.get('content-type') || '') + ' ' + kb);
      }
    }
  } catch (e) { L.push('1) NTV: ERRORE ' + e.message); }
  // VAVOO
  try {
    const t0 = Date.now();
    const vu = (c.vavoo || c.vid) ? await vavooResolve(c.vavoo, c.vid) : null;
    L.push('2) VAVOO: ' + (vu ? 'OK ' + vu.slice(0, 80) + '... (' + (Date.now() - t0) + 'ms)' : (c.vavoo || c.vid ? 'nessun risultato (query: ' + (c.vavoo || '-') + ' vid: ' + (c.vid || '-') + ')' : 'non mappato (salto)')));
  } catch (e) { L.push('2) VAVOO: ERRORE ' + e.message); }
  // DADDYLIVE
  try {
    const t0 = Date.now();
    const du = c.daddy ? await daddyResolve(c.daddy) : null;
    L.push('3) DADDYLIVE: ' + (du ? 'OK ' + du.slice(0, 80) + '... (' + (Date.now() - t0) + 'ms)' : (c.daddy ? 'nessun risultato (id: ' + c.daddy + ')' : 'non mappato (salto)')));
  } catch (e) { L.push('3) DADDYLIVE: ERRORE ' + e.message); }
  // MATCHORA
  try {
    const mu = c.hts ? await matchoraResolve(c) : null;
    L.push('4) MATCHORA: ' + (mu ? 'OK ' + mu.slice(0, 80) + '...' : (c.hts ? 'nessun risultato (pagina ' + c.hts + ')' : 'non mappato (salto)')));
  } catch (e) { L.push('4) MATCHORA: ERRORE ' + e.message); }
  return L.join('\n');
}

// ============================= /vmap ========================================

async function vmap() {
  const t0 = Date.now();
  const m = await ensureVavooMap(true);
  if (!m) return 'VMAP: nessuna fonte raggiungibile (' + VAVOO_SOURCES.join(', ') + ')';
  const L = ['VMAP: ' + m.size + ' canali da ' + vavooMap.src + ' (' + Math.round((Date.now() - t0) / 100) / 10 + 's, cache ' + Math.round((Date.now() - vavooMap.t) / 60000) + 'min fa)', ''];
  for (const c of CHANNELS) {
    const id = c.vid || vavooMapFind(c.vavoo, m);
    L.push((id ? 'OK  ' : '--  ') + c.slug + ' -> ' + (id || 'non trovato') + (c.vid ? ' (pin)' : ''));
  }
  return L.join('\n');
}

// ============================= UTILS =======================================

const VER = 'TVNOW-CF v1.7';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const logs = [];

function log(m) { logs.push(new Date().toISOString().slice(11, 19) + ' ' + m); if (logs.length > 40) logs.shift(); }

function debug() {
  const now = Date.now() / 1000;
  const L = [VER, 'token cache NTV: ' + tokenCache.size];
  for (const [id, c] of tokenCache) L.push('  id ' + id + ': exp tra ' + ((c.exp - now) / 3600).toFixed(1) + 'h');
  L.push('stats ntv: ' + JSON.stringify(ntvStats));
  L.push('daddy cache: ' + daddyCache.size + ' url');
  const vm = vavooMapGet();
  L.push('mappa vavoo: ' + (vm ? vm.size + ' canali (fonte: ' + vavooMap.src + ', eta ' + Math.round((Date.now() - vavooMap.t) / 60000) + 'min)' : 'non caricata (si carica al primo uso vavoo)'));
  L.push('ultimi log:\n  ' + (logs.slice(-10).join('\n  ') || '(vuoti)'));
  return L.join('\n');
}

function uso(P) {
  return [
    VER,
    '',
    'uso:',
    '  /live?ch=<slug|id>   playlist (es. /live?ch=sky-sport-24 o /live?ch=869)',
    '     [&p=...]          ordine provider (default ntv,vavoo,daddy,matchora)',
    '     [&direct=1]       segmenti DIRETTI dal CDN (anti-tetto richieste)',
    '  legacy compatibili:  /ntv?ch=ID  /vavoo?ch=QUERY  /daddy?ch=ID  /htsport?ch=QUERY',
    '  /seg?u=<url>         segmenti',
    '  /ch                  elenco canali',
    '  /probe?ch=<slug>     diagnostica 4 provider',
    '  /vmap                mappa nome->ID vavoo scaricata (diagnostica)',
    '  /debug               stato',
    '  /ip                  IP egress',
    '',
    'provider: 1) NTV tvnow247 (token 24h auto-renew)  2) Vavoo/geil.to  3) DaddyLive (Player 2优先)  4) Matchora/HTSport'
  ].join('\n');
}

function TXT() { return { 'content-type': 'text/plain; charset=utf-8', ...CORS() }; }
function HLS() { return { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-store', ...CORS() }; }
function CORS() { return { 'access-control-allow-origin': '*' }; }

function R(body, status, headers) {
  const h = Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, headers || {});
  if (status === 302) delete h['content-type'];
  return new Response(body, { status: status || 200, headers: h });
}

async function rawu(u) {
  const t = u.searchParams.get('u');
  if (!t) return R('uso: /rawu?u=<url>&ref=<referer>&o=<origin>&len=N&find=<str>', 200, TXT());
  const h = reqHeaders(u.searchParams.get('ref'));
  if (u.searchParams.get('o')) h['Origin'] = u.searchParams.get('o');
  let r;
  try { r = await fetchT(t, { headers: h, redirect: 'follow' }, 20000); }
  catch (e) { return R('status ERR | ' + (e && e.message), 200, TXT()); }
  let body = '';
  try { body = await r.text(); } catch (e) { body = '(body non leggibile: ' + (e && e.message) + ')'; }
  const head = 'status ' + r.status + ' | ct ' + (r.headers.get('content-type') || '-') +
    ' | len ' + body.length + ' | final ' + r.url + '\n';
  const find = u.searchParams.get('find');
  if (find) {
    const hits = [];
    let idx = 0, n = 0;
    while (n < 6) {
      const p = body.indexOf(find, idx);
      if (p < 0) break;
      hits.push('FIND[' + n + '] @' + p + ': ...' + body.slice(Math.max(0, p - 450), p + 750).replace(/\n/g, ' ') + '...');
      idx = p + find.length; n++;
    }
    return R(head + (hits.length ? hits.join('\n') : 'FIND: nessun match per "' + find + '"'), 200, TXT());
  }
  const len = Math.min(+(u.searchParams.get('len') || 4000) || 4000, body.length);
  return R(head + body.slice(0, len), 200, TXT());
}

async function fetchT(url, opt, ms) {
  const o = Object.assign({}, opt);
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) o.signal = AbortSignal.timeout(ms || 12000);
  return fetch(url, o);
}

// ███ FINE FILE TVNOW-CF v1.7 (NTV + VAVOO + DADDYLIVE Player2 + MATCHORA) ███
