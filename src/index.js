// ============================================================================
// TVNOW-CF v9.1.2 — DEBUG COMPLETO + TUTTI I FIX
// ============================================================================

const CONFIG = {
  WORKER_NAME: 'TVNOW-CF',
  WORKER_VERSION: '9.1.2',
  WORKER_BUILD: '2026-11-19',
  DEFAULT_TIMEOUT: 1500,
  FAST_MODE_DEFAULT: true,
  EXTRA_KEYFRAME_SEG: 2,
  CACHE_RESOLUTIONS_TTL: 20,
  SESSION_REFRESH_INTERVAL: 1500,
  URL_CACHE_TTL: 300,
  EXT_X_START_OFFSET: -3,
  EXT_X_VERSION: 6,
  MAX_RETRIES: 2,
  USER_AGENT_POOL: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
  ],
  VAVOO_MIRRORS: [
    'https://geil.to/live/resolve?url=',
    'https://vavoo.geil.to/live/resolve?url=',
    'https://live.vavoo.to/hls/'
  ],
  NTV_RESOLVER_API: 'https://chat.cfbu247.sbs/api/resolve-dlstream/',
  DADDY_EMBED_BASE: 'https://thedaddy.to/embed/'
};

const CHANNEL_DB = {
  'sky sport f1':          { ntv: '577',  vavoo: '181', daddy: '216' },
  'sky sport tennis':      { ntv: '576',  vavoo: '180', daddy: '215' },
  'sky sport calcio':      { ntv: '870',  vavoo: '182', daddy: '217' },
  'sky sport arena':       { ntv: '462',  vavoo: '179', daddy: '214' },
  'sky sport uno':         { ntv: '460',  vavoo: '176', daddy: '210' },
  'sky sport due':         { ntv: '461',  vavoo: '177', daddy: '211' },
  'sky sport max':         { ntv: '869',  vavoo: '183', daddy: '218' },
  'sky sport 24':          { ntv: '482',  vavoo: '184', daddy: '219' },
  'sky sport football':    { ntv: '871',  vavoo: '185', daddy: '220' },
  'sky sport collection':  { ntv: '872',  vavoo: '186', daddy: '221' },
  'sky sport motogp':      { ntv: '873',  vavoo: '187', daddy: '222' },
  '251':             { ntv: '251', vavoo: '251', daddy: '251', direct: true },
  'calcio 251':      { ntv: '251', vavoo: '251', daddy: '251', direct: true },
  'sky calcio 251':  { ntv: '251', vavoo: '251', daddy: '251', direct: true },
  'dazn 1':          { ntv: '251', vavoo: '251', daddy: '251', direct: true },
  '252':             { ntv: '252', vavoo: '252', daddy: '252', direct: true },
  'calcio 252':      { ntv: '252', vavoo: '252', daddy: '252', direct: true },
  'sky calcio 252':  { ntv: '252', vavoo: '252', daddy: '252', direct: true },
  'dazn 2':          { ntv: '252', vavoo: '252', daddy: '252', direct: true },
  '253':             { ntv: '253', vavoo: '253', daddy: '253', direct: true },
  'calcio 253':      { ntv: '253', vavoo: '253', daddy: '253', direct: true },
  'sky calcio 253':  { ntv: '253', vavoo: '253', daddy: '253', direct: true },
  'dazn 3':          { ntv: '253', vavoo: '253', daddy: '253', direct: true },
  'sky cinema uno':        { ntv: '450', vavoo: '150', daddy: '300' },
  'sky cinema due':        { ntv: '451', vavoo: '151', daddy: '301' },
  'sky cinema max':        { ntv: '452', vavoo: '152', daddy: '302' },
  'sky cinema hits':       { ntv: '453', vavoo: '153', daddy: '303' },
  'sky cinema action':     { ntv: '454', vavoo: '154', daddy: '304' },
  'sky cinema comedy':     { ntv: '455', vavoo: '155', daddy: '305' },
  'sky cinema drama':      { ntv: '456', vavoo: '156', daddy: '306' },
  'sky cinema family':     { ntv: '457', vavoo: '157', daddy: '307' },
  'sky cinema romance':    { ntv: '458', vavoo: '158', daddy: '308' },
  'sky cinema suspense':   { ntv: '459', vavoo: '159', daddy: '309' },
  'sky cinema collection': { ntv: '880', vavoo: '160', daddy: '310' },
  'rai 1':         { ntv: '101', vavoo: '1',  daddy: '1'  },
  'rai 2':         { ntv: '102', vavoo: '2',  daddy: '2'  },
  'rai 3':         { ntv: '103', vavoo: '3',  daddy: '3'  },
  'rai 4':         { ntv: '104', vavoo: '4',  daddy: '4'  },
  'rai 5':         { ntv: '105', vavoo: '5',  daddy: '5'  },
  'rai movie':     { ntv: '106', vavoo: '6',  daddy: '6'  },
  'rai premium':   { ntv: '107', vavoo: '7',  daddy: '7'  },
  'rai news 24':   { ntv: '108', vavoo: '8',  daddy: '8'  },
  'rai sport':     { ntv: '109', vavoo: '9',  daddy: '9'  },
  'rai scuola':    { ntv: '110', vavoo: '10', daddy: '10' },
  'rai yoyo':      { ntv: '111', vavoo: '11', daddy: '11' },
  'rai gulp':      { ntv: '112', vavoo: '12', daddy: '12' },
  'rai storia':    { ntv: '113', vavoo: '13', daddy: '13' },
  'rai 4k':        { ntv: '114', vavoo: '14', daddy: '14' },
  'canale 5':      { ntv: '201', vavoo: '20', daddy: '20' },
  'italia 1':      { ntv: '202', vavoo: '21', daddy: '21' },
  'rete 4':        { ntv: '203', vavoo: '22', daddy: '22' },
  '20mediaset':    { ntv: '204', vavoo: '23', daddy: '23' },
  'mediaset extra':{ ntv: '205', vavoo: '24', daddy: '24' },
  'focus':         { ntv: '206', vavoo: '25', daddy: '25' },
  'top crime':     { ntv: '207', vavoo: '26', daddy: '26' },
  'cine 34':       { ntv: '208', vavoo: '27', daddy: '27' },
  'boing':         { ntv: '209', vavoo: '28', daddy: '28' },
  'cartoonito':    { ntv: '210', vavoo: '29', daddy: '29' },
  'rsi la 1':      { ntv: '2455610203', vavoo: '1001', daddy: '401' },
  'rsi la 2':      { ntv: '3590183307', vavoo: '1002', daddy: '402' },
  'tv8':                   { ntv: '301', vavoo: '30',  daddy: '50'  },
  'nova':                  { ntv: '302', vavoo: '31',  daddy: '51'  },
  'mtv':                   { ntv: '303', vavoo: '32',  daddy: '52'  },
  'vh1':                   { ntv: '304', vavoo: '33',  daddy: '53'  },
  'comedy central':        { ntv: '305', vavoo: '34',  daddy: '54'  },
  'paramount':             { ntv: '306', vavoo: '35',  daddy: '55'  },
  'nickelodeon':           { ntv: '307', vavoo: '36',  daddy: '56'  },
  'disney channel':        { ntv: '308', vavoo: '37',  daddy: '57'  },
  'national geographic':   { ntv: '309', vavoo: '38',  daddy: '58'  },
  'discovery':             { ntv: '310', vavoo: '39',  daddy: '59'  },
  'eurosport 1':           { ntv: '601', vavoo: '190', daddy: '250' },
  'eurosport 2':           { ntv: '602', vavoo: '191', daddy: '251' },
  'bbc world':             { ntv: '701', vavoo: '200', daddy: '350' },
  'cnn':                   { ntv: '702', vavoo: '201', daddy: '351' },
  'sky tg24':              { ntv: '481', vavoo: '175', daddy: '209' }
};

const sessionStore = new Map();

function getSessionKey(p, id) { return `${p}:${id}`; }

function getOrCreateSession(p, id) {
  const key = getSessionKey(p, id);
  let s = sessionStore.get(key);
  const now = Math.floor(Date.now()/1000);
  if (!s || (now - s.createdAt) > CONFIG.SESSION_REFRESH_INTERVAL) {
    s = { createdAt: now, uaIndex: Math.floor(Math.random()*CONFIG.USER_AGENT_POOL.length),
          cookies: new Map(), failCount: 0, lastSuccess: now, resolvedUrl: null, resolvedAt: 0 };
    sessionStore.set(key, s);
  }
  return s;
}

function rotateUA(s) { s.uaIndex = (s.uaIndex+1) % CONFIG.USER_AGENT_POOL.length; }
function getUA(s) { return CONFIG.USER_AGENT_POOL[s.uaIndex]; }

function buildAntiBlockHeaders(s, referer='') {
  const h = {
    'User-Agent': getUA(s), 'Accept': '*/*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br', 'Connection': 'keep-alive',
    'Cache-Control': 'no-cache', 'Pragma': 'no-cache',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site', 'DNT': '1'
  };
  if (referer) h['Referer'] = referer;
  if (s.cookies.size) h['Cookie'] = [...s.cookies].map(([k,v])=>`${k}=${v}`).join('; ');
  return h;
}

function storeCookies(s, resp) {
  const sc = resp.headers.get('set-cookie');
  if (sc) sc.split(',').forEach(p => {
    const m = p.trim().match(/^([^=]+)=([^;]+)/);
    if (m) s.cookies.set(m[1], m[2]);
  });
}

async function fetchAB(url, s, opts={}) {
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), opts.timeout||CONFIG.DEFAULT_TIMEOUT);
  try {
    const r = await fetch(url, { headers: buildAntiBlockHeaders(s, opts.referer),
      signal: ctrl.signal, cf: { cacheTtl: opts.cacheTtl||0, cacheEverything: false }});
    clearTimeout(t); storeCookies(s,r); s.lastSuccess=Math.floor(Date.now()/1000);
    s.failCount = 0;
    return r;
  } catch(e) {
    clearTimeout(t); s.failCount++; rotateUA(s);
    if (s.failCount <= CONFIG.MAX_RETRIES) {
      const c2 = new AbortController(); const t2 = setTimeout(()=>c2.abort(), opts.timeout||CONFIG.DEFAULT_TIMEOUT);
      try {
        const r = await fetch(url, { headers: buildAntiBlockHeaders(s, opts.referer),
          signal: c2.signal, cf: { cacheTtl: 0, cacheEverything: false }});
        clearTimeout(t2); storeCookies(s,r); s.lastSuccess=Math.floor(Date.now()/1000);
        s.failCount = 0;
        return r;
      } catch(e2) { clearTimeout(t2); throw e2; }
    }
    throw e;
  }
}

// ==================== RESOLVER ====================

async function resolveNtv(id, s) {
  try {
    const apiUrl = `${CONFIG.NTV_RESOLVER_API}${encodeURIComponent(id)}`;
    const r = await fetchAB(apiUrl, s, { timeout: 4000 });
    if (!r.ok) throw new Error(`API HTTP ${r.status}`);
    const txt = await r.text();
    let m = null;
    try { const j = JSON.parse(txt); m = j.url||j.m3u8||j.stream||(j.data&&j.data.url); }
    catch { const mm = txt.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i); if (mm) m = mm[0]; }
    if (m) return m;
  } catch(e) {}
  return `https://tv.ntv.cloud/live/${id}/master.m3u8`;
}

async function resolveVavoo(id, s) {
  for (const mirror of CONFIG.VAVOO_MIRRORS) {
    try {
      const u = mirror.includes('/resolve?url=')
        ? mirror + encodeURIComponent(`https://live.vavoo.to/hls/${id}/master.m3u8`)
        : `${mirror}${id}/master.m3u8`;
      const r = await fetchAB(u, s, { timeout: 4000 });
      if (r.ok) {
        const txt = await r.text();
        let m = null;
        try { const j = JSON.parse(txt); m = j.url||j.m3u8||j.stream||(j.data&&j.data.url); }
        catch { const mm = txt.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i); if (mm) m = mm[0]; }
        if (m) return m;
        if (txt.includes('#EXTM3U')) return u;
      }
    } catch {}
  }
  throw new Error('Vavoo: tutti mirror falliti');
}

async function resolveDaddy(id, s) {
  const u = `${CONFIG.DADDY_EMBED_BASE}${encodeURIComponent(id)}`;
  try {
    const r = await fetchAB(u, s, { timeout: 4000, referer: 'https://thedaddy.to/' });
    if (!r.ok) throw new Error(`embed HTTP ${r.status}`);
    const html = await r.text();
    const pats = [/source:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i, /file:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /src:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i, /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
      /https?:\/\/[^<>"'\s]+\.m3u8[^<>"'\s]*/i];
    for (const p of pats) {
      const m = html.match(p);
      if (m) {
        let url = m[1]||m[0];
        if (!url.startsWith('http')) try { url = new URL(url, u).toString(); } catch {}
        return url;
      }
    }
  } catch {}
  return `https://cdn.daddylive.live/hls/${id}/master.m3u8`;
}

async function resolveChannelUrl(p, id, s, force=false) {
  const now = Math.floor(Date.now()/1000);
  if (!force && s.resolvedUrl && (now-s.resolvedAt) < CONFIG.URL_CACHE_TTL) return s.resolvedUrl;
  let url;
  switch(p) {
    case 'ntv':   url = await resolveNtv(id,s); break;
    case 'vavoo': url = await resolveVavoo(id,s); break;
    case 'daddy': url = await resolveDaddy(id,s); break;
    default: throw new Error(`Provider ${p} sconosciuto`);
  }
  s.resolvedUrl = url; s.resolvedAt = now; return url;
}

function resolveChannel(input) {
  if (!input) return null;
  const k = input.toLowerCase().trim();
  if (CHANNEL_DB[k]) return CHANNEL_DB[k];
  for (const [n,ids] of Object.entries(CHANNEL_DB))
    if (n.includes(k)||k.includes(n)) return ids;
  if (/^\d+$/.test(k)) return { ntv:k, vavoo:k, daddy:k, direct:true };
  const ns = k.replace(/\s+/g,'');
  return CHANNEL_DB[ns] || null;
}

// ==================== PARSE HLS ====================

function parseHls(c) {
  const lines = c.split('\n').map(l=>l.trim());
  const r = { isMaster:false, version:3, targetDuration:0, mediaSequence:0,
    discontinuitySequence:0, variants:[], segments:[], map:null, start:null, _nextDisc:false };
  for (let i=0;i<lines.length;i++) {
    const l = lines[i];
    if (l.startsWith('#EXT-X-VERSION:')) r.version = parseInt(l.split(':')[1])||3;
    else if (l.startsWith('#EXT-X-TARGETDURATION:')) r.targetDuration = parseFloat(l.split(':')[1])||0;
    else if (l.startsWith('#EXT-X-MEDIA-SEQUENCE:')) r.mediaSequence = parseInt(l.split(':')[1])||0;
    else if (l.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE:')) r.discontinuitySequence = parseInt(l.split(':')[1])||0;
    else if (l.startsWith('#EXT-X-STREAM-INF:')) {
      r.isMaster = true;
      const a = parseAttrs(l.split(':')[1]);
      const uri = (lines[i+1] && !lines[i+1].startsWith('#')) ? lines[++i] : '';
      r.variants.push({...a, uri});
    }
    else if (l.startsWith('#EXT-X-MAP:')) r.map = parseAttrs(l.split(':')[1]);
    else if (l.startsWith('#EXT-X-START:')) r.start = parseAttrs(l.split(':')[1]);
    else if (l.startsWith('#EXTINF:')) {
      const d = parseFloat(l.split(':')[1].split(',')[0])||0;
      const uri = (lines[i+1] && !lines[i+1].startsWith('#')) ? lines[++i] : '';
      r.segments.push({ duration:d, uri, hasDisc:r._nextDisc });
      r._nextDisc = false;
    }
    else if (l === '#EXT-X-DISCONTINUITY') r._nextDisc = true;
  }
  return r;
}

function parseAttrs(s) {
  const r = {}; const re = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]+))/g; let m;
  while ((m=re.exec(s))!==null) r[m[1]] = m[2]!==undefined?m[2]:m[3];
  return r;
}

function filterVariants(v, forceH264=false, idx=-1) {
  if (idx>=0 && idx<v.length) return [v[idx]];
  if (!forceH264) return v;
  const h = v.filter(x => {
    const c = (x.CODECS||'').toLowerCase();
    return c.includes('avc1') || (!c.includes('hvc1') && !c.includes('hev1'));
  });
  return h.length ? h : v;
}

function selectBest(v) {
  return v.map((x,i)=>({v:x,i,s:scoreV(x)})).sort((a,b)=>b.s-a.s)[0].v;
}

function scoreV(v) {
  let s=0; const c=(v.CODECS||'').toLowerCase(); const r=v.RESOLUTION||'';
  if (c.includes('avc1')) s+=100;
  if (c.includes('hvc1')||c.includes('hev1')) s-=50;
  if (r.includes('720')) s+=50; if (r.includes('1080')) s+=30; if (r.includes('480')) s+=20;
  return s;
}

function buildPlaylist(p, base, fast=true) {
  const { segments:segs, targetDuration:td, mediaSequence:ms, version, map, discontinuitySequence:ds } = p;
  if (!segs.length) return null;
  let si = fast ? Math.max(0, segs.length-4-CONFIG.EXTRA_KEYFRAME_SEG) : Math.max(0, segs.length-8);
  if (fast) for (let i=si;i<segs.length&&i<si+3;i++) if (segs[i]?.hasDisc && i>0) { si=Math.max(0,i-1); break; }
  const sel = segs.slice(si);
  const backDur = sel.slice(0,-1).reduce((a,b)=>a+b.duration,0);
  const off = Math.max(CONFIG.EXT_X_START_OFFSET, -backDur);
  let o = '#EXTM3U\n';
  o += `#EXT-X-VERSION:${Math.max(version,CONFIG.EXT_X_VERSION)}\n`;
  o += `#EXT-X-TARGETDURATION:${Math.ceil(td)}\n`;
  o += `#EXT-X-MEDIA-SEQUENCE:${ms+si}\n`;
  o += `#EXT-X-DISCONTINUITY-SEQUENCE:${ds}\n`;
  o += `#EXT-X-START:TIME-OFFSET=${off},PRECISE=NO\n`;
  if (map) {
    const mu = resolveUri(map.URI||map.uri||'', base);
    o += `#EXT-X-MAP:URI="/seg?url=${encodeURIComponent(mu)}&init=1"`;
    if (map.BYTERANGE) o += `,BYTERANGE="${map.BYTERANGE}"`;
    o += '\n';
  }
  for (const s of sel) {
    if (s.hasDisc) o += '#EXT-X-DISCONTINUITY\n';
    o += `#EXTINF:${s.duration.toFixed(3)},\n`;
    o += `/seg?url=${encodeURIComponent(resolveUri(s.uri,base))}\n`;
  }
  o += '#EXT-X-ENDLIST\n';
  return o;
}

function resolveUri(u, base) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  try { return new URL(u, base).toString(); } catch { return u; }
}

function detectProvider(u) {
  if (u.includes('ntv.cloud')||u.includes('cfbu247')) return 'ntv';
  if (u.includes('vavoo')||u.includes('geil.to')) return 'vavoo';
  if (u.includes('daddy')||u.includes('daddylive')) return 'daddy';
  return null;
}

// ==================== HANDLER PRINCIPALE ====================

addEventListener('fetch', e => e.respondWith(handle(e.request)));

async function handle(req) {
  const url = new URL(req.url); const path = url.pathname;
  try {
    if (path==='/live'||path==='/') return handleLive(url);
    if (path==='/seg') return handleSeg(url);
    if (path==='/analyze') return handleAnalyze(url);
    if (path==='/diag') return handleDiag(url);
    if (path==='/checkseg') return handleCheckSeg(url);
    if (path==='/vmap') return handleVMap(url);
    if (path==='/ch') return handleChList(url);
    if (path==='/debug') return handleDebug();
    if (path==='/resolve') return handleResolve(url);
    return plain('TVNOW-CF v9.1.2\nUso: /live?ch=nome_canale\nEsempio: /live?ch=sky sport f1');
  } catch(err) { return plain(`ERRORE: ${err.message}`, 500); }
}

function plain(t, s=200) {
  return new Response(t, { status:s, headers: {
    'Content-Type':'text/plain; charset=utf-8', 'Access-Control-Allow-Origin':'*' }});
}

function hls(t, extra={}) {
  return new Response(t, { headers: {
    'Content-Type':'application/vnd.apple.mpegurl',
    'Cache-Control':'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin':'*', ...extra }});
}

// ==================== /live ====================

async function handleLive(url) {
  const ch = url.searchParams.get('ch')||'';
  const provs = (url.searchParams.get('p')||'ntv,vavoo,daddy').split(',').map(x=>x.trim());
  const fast = url.searchParams.get('fast')!=='0';
  const forceH264 = url.searchParams.get('force_h264')==='1';
  const vi = parseInt(url.searchParams.get('variant')||'-1');
  const safe = url.searchParams.get('safe')==='1';
  const refresh = url.searchParams.get('refresh')==='1';
  const listV = url.searchParams.get('list_variants')==='1';

  if (!ch) return plain('Specificare canale: /live?ch=rai1 oppure /live?ch=577', 400);

  const chan = resolveChannel(ch);
  if (!chan) return plain(`Canale "${ch}" non trovato. Usa /ch per la lista.`, 404);

  let lastErr = null;

  for (const p of provs) {
    const cid = chan[p]; if (!cid) { lastErr = `${p}: nessun ID`; continue; }

    try {
      const s = getOrCreateSession(p, cid);
      const now = Math.floor(Date.now()/1000);

      if (refresh || (now-s.createdAt) > CONFIG.SESSION_REFRESH_INTERVAL) {
        sessionStore.delete(getSessionKey(p,cid));
        Object.assign(s, getOrCreateSession(p,cid));
      }

      const mUrl = await resolveChannelUrl(p, cid, s, refresh);
      if (!mUrl) { lastErr = `${p}: URL vuoto`; continue; }

      let mResp = await fetchAB(mUrl, s, { cacheTtl:0, timeout: 4000 });
      if (!mResp.ok) {
        s.resolvedUrl = null;
        try {
          const mUrl2 = await resolveChannelUrl(p, cid, s, true);
          mResp = await fetchAB(mUrl2, s, { cacheTtl:0, timeout: 4000 });
        } catch(e2) {
          lastErr = `${p}: HTTP ${mResp.status} + retry: ${e2.message}`;
          continue;
        }
        if (!mResp.ok) { lastErr = `${p}: HTTP ${mResp.status}`; continue; }
      }

      const mCont = await mResp.text();
      const parsed = parseHls(mCont);

      if (!parsed.isMaster && parsed.segments.length > 0) {
        const opt = buildPlaylist(parsed, mUrl, fast && !safe);
        if (opt) return hls(opt, { 'X-Provider':p, 'X-Session-Age':`${now-s.createdAt}s` });
        lastErr = `${p}: playlist vuota dopo ottimizzazione`;
        continue;
      }

      if (parsed.isMaster && parsed.variants.length > 0) {
        if (listV) {
          const list = parsed.variants.map((v,i)=>
            `[${i}] ${(v.RESOLUTION||'?').padEnd(10)} | ${(v.CODECS||'?').padEnd(25)} | ${v.BANDWIDTH?(v.BANDWIDTH/1000).toFixed(0)+'kbps':''}`
          ).join('\n');
          return plain(`Varianti ${p}:\n\n${list}`);
        }

        const filt = filterVariants(parsed.variants, forceH264, vi);
        if (!filt.length) { lastErr = `${p}: nessuna variante H.264`; continue; }

        const sel = vi>=0 ? filt[0] : selectBest(filt);
        if (!sel.uri) { lastErr = `${p}: variante senza URI`; continue; }

        const mediaUrl = resolveUri(sel.uri, mUrl);
        const ms = getOrCreateSession(p, cid+':media');
        const mdResp = await fetchAB(mediaUrl, ms, { cacheTtl:0, referer:mUrl, timeout: 4000 });

        if (!mdResp.ok) { lastErr = `${p}: media HTTP ${mdResp.status}`; continue; }

        const mdCont = await mdResp.text();
        const pm = parseHls(mdCont);

        if (!pm.segments.length) { lastErr = `${p}: media senza segmenti`; continue; }

        const opt = buildPlaylist(pm, mediaUrl, fast && !safe);
        if (opt) return hls(opt, {
          'X-Provider':p, 'X-Variant':`${sel.RESOLUTION||'?'} ${sel.CODECS||''}`,
          'X-Session-Age':`${now-s.createdAt}s`
        });

        lastErr = `${p}: buildPlaylist null`;
        continue;
      }

      lastErr = `${p}: playlist non valida — isMaster=${parsed.isMaster}, varianti=${parsed.variants.length}, segmenti=${parsed.segments.length}`;
      continue;

    } catch(err) {
      lastErr = `${p}: ${err.message}`;
      continue;
    }
  }

  return plain(`Tutti i provider hanno fallito.\nUltimo errore: ${lastErr}`, 502);
}

// ==================== /seg ====================

async function handleSeg(url) {
  const su = url.searchParams.get('url');
  const isInit = url.searchParams.get('init')==='1';
  if (!su) return plain('URL mancante', 400);
  try {
    const du = decodeURIComponent(su);
    const prov = detectProvider(du)||'generic';
    const s = getOrCreateSession(prov, 'segment');
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), isInit?4000:3000);
    const h = buildAntiBlockHeaders(s);
    if (isInit) { h['Cache-Control']='no-store'; h['Pragma']='no-cache'; }
    const r = await fetch(du, { headers:h, signal:ctrl.signal, cf:{ cacheTtl:isInit?0:5, cacheEverything:false }});
    clearTimeout(t); storeCookies(s,r);
    const rh = new Headers();
    rh.set('Content-Type', r.headers.get('content-type')||'video/mp2t');
    rh.set('Access-Control-Allow-Origin','*');
    const cl = r.headers.get('content-length'); const te = r.headers.get('transfer-encoding');
    if (cl && !te) rh.set('Content-Length', cl);
    rh.set('Cache-Control', isInit ? 'no-store' : 'public, max-age=5');
    return new Response(r.body, { status: r.status, headers: rh });
  } catch(err) { return plain(`Errore segmento: ${err.message}`, 502); }
}

// ==================== DIAGNOSTICA ====================

async function handleAnalyze(url) {
  const ch = url.searchParams.get('ch')||'';
  if (!ch) return plain('?ch=nome_canale', 400);
  const chan = resolveChannel(ch);
  if (!chan) return plain('Canale non trovato', 404);
  let rep = `ANALISI ${ch} (v${CONFIG.WORKER_VERSION})\nMapping: ${JSON.stringify(chan)}\n\n`;
  for (const p of ['ntv','vavoo','daddy']) {
    const id = chan[p]; if (!id) continue;
    rep += `--- ${p.toUpperCase()} (ID:${id}) ---\n`;
    try {
      const s = getOrCreateSession(p,id); const t0=Date.now();
      const res = await resolveChannelUrl(p,id,s,true); const t1=Date.now();
      rep += `URL: ${res.substring(0,80)}...\nTempo: ${t1-t0}ms\nUA: ${getUA(s).substring(0,50)}...\n`;
      const t2=Date.now(); const r=await fetchAB(res,s,{cacheTtl:0,timeout:4000}); const t3=Date.now();
      rep += `Fetch: ${r.status} (${t3-t2}ms)\n`;
      if (r.ok) {
        const pm = parseHls(await r.text());
        if (pm.isMaster) {
          rep += `MASTER ${pm.variants.length} var:\n`;
          pm.variants.forEach((v,i)=>{
            const c=(v.CODECS||'').toLowerCase();
            const tag = c.includes('avc1')?'H264':(c.includes('hvc1')||c.includes('hev1')?'HEVC':'?');
            rep += `  [${i}] ${tag} ${(v.RESOLUTION||'?').padEnd(12)} | ${(v.CODECS||'?').padEnd(30)}\n`;
          });
        } else rep += `MEDIA ${pm.segments.length} seg | MAP:${pm.map?'SI':'NO'} | TD:${pm.targetDuration}s\n`;
      }
    } catch(e) { rep += `ERRORE: ${e.message}\n`; }
    rep += '\n';
  }
  return plain(rep);
}

async function handleResolve(url) {
  const ch = url.searchParams.get('ch')||''; const p = url.searchParams.get('p')||'ntv';
  if (!ch) return plain('?ch=canale&p=ntv|vavoo|daddy', 400);
  const chan = resolveChannel(ch); if (!chan||!chan[p]) return plain('Non trovato', 404);
  const s = getOrCreateSession(p, chan[p]);
  const r = await resolveChannelUrl(p, chan[p], s, true);
  return plain(`Provider:${p}\nCanale:${ch}\nID:${chan[p]}\n\nURL:\n${r}`);
}

async function handleDiag(url) {
  const ch = url.searchParams.get('ch')||''; if (!ch) return plain('?ch=nome_canale',400);
  const chan = resolveChannel(ch); if (!chan) return plain('Non trovato',404);
  const res = [];
  for (const p of ['ntv','vavoo','daddy']) {
    const id = chan[p]; if (!id) continue;
    try {
      const s = getOrCreateSession(p,id); const t0=Date.now();
      const ru = await resolveChannelUrl(p,id,s,true);
      const r = await fetchAB(ru,s,{cacheTtl:0,timeout:4000}); const t1=Date.now();
      if (r.ok) {
        const pm = parseHls(await r.text());
        let info = pm.isMaster
          ? `MASTER ${pm.variants.length}var H264:${pm.variants.some(v=>(v.CODECS||'').toLowerCase().includes('avc1'))?'SI':'NO'}`
          : `MEDIA ${pm.segments.length}seg`;
        res.push(`${p.toUpperCase()}: OK ${t1-t0}ms | ${info}`);
      } else res.push(`${p.toUpperCase()}: HTTP ${r.status}`);
    } catch(e) { res.push(`${p.toUpperCase()}: FAIL (${e.message})`); }
  }
  return plain(`DIAG v${CONFIG.WORKER_VERSION}: ${ch}\nMapping: ${JSON.stringify(chan)}\n\n${res.join('\n')}`);
}

async function handleCheckSeg(url) {
  const src = url.searchParams.get('s')||'ntv'; const ch = url.searchParams.get('ch')||'';
  if (!ch) return plain('?s=ntv&ch=ID',400);
  const chan = resolveChannel(ch); const id = chan?.[src]||ch;
  const s = getOrCreateSession(src,id);
  const mu = await resolveChannelUrl(src,id,s,true);
  try {
    const r = await fetchAB(mu,s,{cacheTtl:0}); const pm = parseHls(await r.text());
    let mediaU = mu;
    if (pm.isMaster && pm.variants.length) {
      mediaU = resolveUri(pm.variants[0].uri, mu);
      const mr = await fetchAB(mediaU,s,{cacheTtl:0});
      return segReport(await mr.text(), mediaU);
    }
    return segReport(await r.text(), mediaU);
  } catch(e) { return plain(`Errore: ${e.message}`,500); }
}

function segReport(c, base) {
  const p = parseHls(c);
  let r = `Segmenti:${p.segments.length} | TD:${p.targetDuration}s | MAP:${p.map?'SI':'NO'}\n\n`;
  p.segments.forEach((s,i)=>{
    r += `[${i}] ${s.duration.toFixed(2)}s${s.hasDisc?' DISC':''} ${resolveUri(s.uri,base).substring(0,70)}...\n`;
  });
  return plain(r);
}

async function handleVMap(url) {
  const ch = url.searchParams.get('ch')||''; if (!ch) return plain('?ch=nome_canale',400);
  const chan = resolveChannel(ch); if (!chan) return plain('Non trovato',404);
  let rep = '';
  for (const p of ['ntv','vavoo','daddy']) {
    const id = chan[p]; if (!id) continue;
    rep += `=== ${p.toUpperCase()} ===\n`;
    try {
      const s = getOrCreateSession(p,id);
      const mu = await resolveChannelUrl(p,id,s,true);
      const r = await fetchAB(mu,s,{cacheTtl:0});
      if (r.ok) {
        const pm = parseHls(await r.text());
        if (pm.isMaster) pm.variants.forEach((v,i)=>{
          rep += `[${i}] RES=${(v.RESOLUTION||'?').padEnd(12)} CODECS=${(v.CODECS||'?').padEnd(25)}\n`;
        });
        else rep += `(media playlist, ${pm.segments.length} seg)\n`;
      } else rep += `HTTP ${r.status}\n`;
    } catch(e) { rep += `ERRORE: ${e.message}\n`; }
    rep += '\n';
  }
  return plain(rep);
}

async function handleChList(url) {
  const q = (url.searchParams.get('q')||'').toLowerCase();
  const page = parseInt(url.searchParams.get('page')||'0'); const ps = 50;
  let names = Object.keys(CHANNEL_DB);
  if (q) names = names.filter(n=>n.includes(q));
  const tot = names.length; const paged = names.slice(page*ps,(page+1)*ps);
  let out = `CANALI (${tot}) - pag ${page+1}\n\n`;
  for (const n of paged) {
    const i = CHANNEL_DB[n];
    out += `${n.padEnd(25)} ntv:${(i.ntv||'-').padEnd(10)} vavoo:${(i.vavoo||'-').padEnd(6)} daddy:${i.daddy||'-'}\n`;
  }
  if ((page+1)*ps < tot) out += `\n... altri ${tot-(page+1)*ps} canali. ?page=${page+1}\n`;
  return plain(out);
}

// ============================================================================
// 🔧 /debug — VERSIONE COMPLETA: nome file, versione, funzioni, endpoint, config
// ============================================================================
async function handleDebug() {
  const now = Math.floor(Date.now()/1000);
  const nowStr = new Date().toISOString();
  
  let o = '';
  
  // 📋 INTESTAZIONE: NOME FILE, VERSIONE, BUILD
  o += '═══════════════════════════════════════════════════════════════\n';
  o += `  📄 FILE:     TVNOW-CF_v${CONFIG.WORKER_VERSION}.js\n`;
  o += `  🏷️  NOME:     ${CONFIG.WORKER_NAME}\n`;
  o += `  🚀 VERSIONE: ${CONFIG.WORKER_VERSION}\n`;
  o += `  📦 BUILD:    ${CONFIG.WORKER_BUILD}\n`;
  o += `  🕐 ORA:      ${nowStr}\n`;
  o += '═══════════════════════════════════════════════════════════════\n\n';
  
  // ⚙️ CONFIGURAZIONE ATTIVA
  o += '━━━━━━━━━━━━━━━━━ ⚙️  CONFIGURAZIONE ━━━━━━━━━━━━━━━━━\n';
  o += `  DEFAULT_TIMEOUT:        ${CONFIG.DEFAULT_TIMEOUT}ms\n`;
  o += `  FAST_MODE_DEFAULT:      ${CONFIG.FAST_MODE_DEFAULT}\n`;
  o += `  EXTRA_KEYFRAME_SEG:     ${CONFIG.EXTRA_KEYFRAME_SEG}\n`;
  o += `  SESSION_REFRESH:        ${CONFIG.SESSION_REFRESH_INTERVAL}s (25min)\n`;
  o += `  URL_CACHE_TTL:          ${CONFIG.URL_CACHE_TTL}s (5min)\n`;
  o += `  EXT_X_START_OFFSET:     ${CONFIG.EXT_X_START_OFFSET}s\n`;
  o += `  EXT_X_VERSION:          ${CONFIG.EXT_X_VERSION}\n`;
  o += `  MAX_RETRIES:            ${CONFIG.MAX_RETRIES}\n`;
  o += `  USER_AGENT_POOL:        ${CONFIG.USER_AGENT_POOL.length} UA disponibili\n`;
  o += `  VAVOO_MIRRORS:          ${CONFIG.VAVOO_MIRRORS.length} mirror\n`;
  o += `  NTV_RESOLVER_API:       ${CONFIG.NTV_RESOLVER_API}\n`;
  o += `  DADDY_EMBED_BASE:       ${CONFIG.DADDY_EMBED_BASE}\n\n`;
  
  // 📡 ELENCO ENDPOINT DISPONIBILI
  o += '━━━━━━━━━━━━━━━━━ 📡 ENDPOINT / FUNZIONI ━━━━━━━━━━━━━━━━━\n';
  o += '  /live?ch=X           → Proxy stream HLS (funzione principale)\n';
  o += '  /seg?url=X           → Proxy segmenti video e init\n';
  o += '  /analyze?ch=X        → Analisi dettagliata codecs e varianti\n';
  o += '  /diag?ch=X           → Diagnostica rapida per provider\n';
  o += '  /checkseg?s=ntv&ch=X → Ispezione primi segmenti\n';
  o += '  /vmap?ch=X           → Mappa varianti per ogni provider\n';
  o += '  /ch                  → Lista canali ( ?q=ricerca ?page=N )\n';
  o += '  /resolve?ch=X&p=ntv  → Debug resolver singolo\n';
  o += '  /debug               → Questa pagina\n\n';
  
  // 🎛️ PARAMETRI SUPPORTATI
  o += '━━━━━━━━━━━━━━━━━ 🎛️  PARAMETRI /live ━━━━━━━━━━━━━━━━━\n';
  o += '  ch=X              Nome o ID canale (es. rai 1, 577, sky sport f1)\n';
  o += '  p=ntv,vavoo,daddy  Ordine di prova provider\n';
  o += '  fast=0            Disattiva avvio veloce\n';
  o += '  force_h264=1      Seleziona solo varianti H.264\n';
  o += '  variant=N         Usa variante specifica (da /vmap)\n';
  o += '  list_variants=1   Elenca varianti disponibili\n';
  o += '  safe=1            Salta allineamento GOP aggressivo\n';
  o += '  refresh=1         Forza refresh sessione e URL\n\n';
  
  // 🧠 SESSIONI ATTIVE
  o += '━━━━━━━━━━━━━━━━━ 🧠 SESSIONI ATTIVE ━━━━━━━━━━━━━━━━━\n';
  o += `  Sessioni: ${sessionStore.size}\n\n`;
  
  if (sessionStore.size === 0) {
    o += '  (nessuna sessione attiva)\n';
  } else {
    for (const [k,sess] of sessionStore) {
      const age = now - sess.createdAt;
      const pct = Math.min(100, Math.round((age/CONFIG.SESSION_REFRESH_INTERVAL)*100));
      const ua = sess.resolvedAt ? `${now-sess.resolvedAt}s fa` : 'mai';
      const urlShort = sess.resolvedUrl ? sess.resolvedUrl.substring(0,50)+'...' : 'non risolto';
      o += `  📌 ${k}\n`;
      o += `     età: ${age}s (${pct}% vita) | fail: ${sess.failCount}\n`;
      o += `     URL risolto: ${ua} → ${urlShort}\n`;
      o += `     UA attivo: ${getUA(sess).substring(0,45)}...\n`;
      o += `     cookies: ${sess.cookies.size}\n\n`;
    }
  }
  
  // 📊 DATABASE CANALI
  o += '━━━━━━━━━━━━━━━━━ 📊 DATABASE CANALI ━━━━━━━━━━━━━━━━━\n';
  o += `  Canali totali: ${Object.keys(CHANNEL_DB).length}\n`;
  o += `  Provider supportati: ntv, vavoo, daddy\n\n`;
  
  // 🔧 FUNZIONI INTERNE
  o += '━━━━━━━━━━━━━━━━━ 🔧 FUNZIONI DEL WORKER ━━━━━━━━━━━━━━━━━\n';
  o += '  • resolveChannel()      → Converte nome → ID per provider\n';
  o += '  • resolveChannelUrl()   → Risolve URL m3u8 con cache\n';
  o += '  • resolveNtv()          → Resolver NTV via API + fallback\n';
  o += '  • resolveVavoo()        → Resolver Vavoo con 3 mirror\n';
  o += '  • resolveDaddy()        → Resolver DaddyLive via scraping\n';
  o += '  • fetchAB()             → Fetch con anti-block, UA rotate, retry\n';
  o += '  • parseHls()            → Parser playlist master/media\n';
  o += '  • filterVariants()      → Filtro H.264 anti-schermo-grigio\n';
  o += '  • selectBest()          → Seleziona variante ottimale\n';
  o += '  • buildPlaylist()       → Ricostruisce playlist ottimizzata\n';
  o += '  • handleLive()          → Handler principale /live\n';
  o += '  • handleSeg()           → Proxy segmenti con CORS\n';
  o += '  • getOrCreateSession()  → Gestore sessioni anti-block\n';
  o += '  • buildAntiBlockHeaders() → Headers realistici\n\n';
  
  o += '═══════════════════════════════════════════════════════════════\n';
  o += `  FINE DEBUG — v${CONFIG.WORKER_VERSION} | ${CONFIG.WORKER_BUILD}\n`;
  o += '═══════════════════════════════════════════════════════════════\n';
  
  return plain(o);
}
