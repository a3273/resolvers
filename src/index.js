// ============================================================
// TVNOW-CF v9.1 Ultimate
// Architettura: Sessioni + Anti-Block + UA Rotation + Filtro H.264
// Resolver: NTV/Vavoo/Daddy reali (collaudati v8.x)
// Debug: versione + tutte le funzioni visibili
// ============================================================

const CONFIG = {
  VERSION: 'TVNOW-CF v9.1 Ultimate',
  DEFAULT_TIMEOUT: 5000,
  MAX_RETRIES: 2,
  SESSION_REFRESH_INTERVAL: 1500, // 25 min (prima della scadenza 30min)
  EXTRA_KEYFRAME_SEG: 2,
  EXT_X_START_OFFSET: -3,
  EXT_X_VERSION: 6,
  USER_AGENT_POOL: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
  ],
  // Resolver reali collaudati
  NTV_API: 'https://chat.cfbu247.sbs/api/resolve-dlstream/',
  VAVOO_MIRRORS: ['https://geil.to','https://geil.app','https://geil.win','https://vavoo.to','https://kool.to','https://vavoo.net'],
  DADDY_DOMAINS: ['https://thedaddy.li','https://daddylivetv.sbs'],
  // Funzionalità attive
  FEATURES: ['Session Management','UA Rotation','Cookie Persistence','Anti-Block Retry','HLS Parser','H.264 Filter','Best Variant Selector','Keyframe Search','EXT-X-MAP Support','Discontinuity Handling','Auto-Refresh 25min','Multi-Provider Fallback','Segment Proxy','Cache Control','Debug Endpoints']
};

// ============================================================
// DATABASE COMPLETO CANALI
// ============================================================
const CHANNEL_DB = {
  // SKY SPORT
  'sky sport f1': { ntv: '577', vavoo: '4246774056', daddy: '577' },
  'sky sport tennis': { ntv: '576', vavoo: '2100771782', daddy: '576' },
  'sky sport calcio': { ntv: '870', vavoo: '1665920101', daddy: '870' },
  'sky sport arena': { ntv: '462', vavoo: '3007400791', daddy: '462' },
  'sky sport uno': { ntv: '461', vavoo: '210669162', daddy: '461' },
  'sky sport due': { ntv: '460', vavoo: '2066326916', daddy: '460' },
  'sky sport max': { ntv: '460', vavoo: '2066326916', daddy: '460' },
  'sky sport 24': { ntv: '869', vavoo: '2775802255', daddy: '869' },
  'sky sport football': { ntv: '871', vavoo: '3093535330', daddy: '871' },
  'sky sport collection': { ntv: '872', vavoo: '186', daddy: '872' },
  'sky sport motogp': { ntv: '575', vavoo: '3036316886', daddy: '575' },
  'sky sport basket': { ntv: '875', vavoo: '2711959620', daddy: '875' },
  'sky sport golf': { ntv: '574', vavoo: '729945219', daddy: '574' },
  'sky sport serie a': { ntv: '', vavoo: '2077387085', daddy: '880' },
  
  // CALCIO 251/252/253
  '251': { ntv: '871', vavoo: '251', daddy: '871' },
  'calcio 251': { ntv: '871', vavoo: '251', daddy: '871' },
  'sky calcio 251': { ntv: '871', vavoo: '251', daddy: '871' },
  'dazn 1': { ntv: '877', vavoo: '1376440573', daddy: '877' },
  '252': { ntv: '872', vavoo: '252', daddy: '872' },
  'calcio 252': { ntv: '872', vavoo: '252', daddy: '872' },
  'sky calcio 252': { ntv: '872', vavoo: '252', daddy: '872' },
  'dazn 2': { ntv: '872', vavoo: '363506221', daddy: '872' },
  '253': { ntv: '873', vavoo: '253', daddy: '873' },
  'calcio 253': { ntv: '873', vavoo: '253', daddy: '873' },
  'sky calcio 253': { ntv: '873', vavoo: '253', daddy: '873' },
  'dazn 3': { ntv: '873', vavoo: '253', daddy: '873' },
  
  // CINEMA
  'sky cinema uno': { ntv: '860', vavoo: '2872151911', daddy: '860' },
  'sky cinema due': { ntv: '', vavoo: '2330574729', daddy: '' },
  'sky cinema max': { ntv: '', vavoo: '152', daddy: '' },
  'sky cinema hits': { ntv: '', vavoo: '153', daddy: '' },
  'sky cinema action': { ntv: '861', vavoo: '3812796171', daddy: '861' },
  'sky cinema comedy': { ntv: '862', vavoo: '500203271', daddy: '862' },
  'sky cinema drama': { ntv: '867', vavoo: '1235530177', daddy: '867' },
  'sky cinema family': { ntv: '865', vavoo: '415795144', daddy: '865' },
  'sky cinema romance': { ntv: '864', vavoo: '2890008905', daddy: '864' },
  'sky cinema suspense': { ntv: '868', vavoo: '1820997555', daddy: '868' },
  'sky cinema collection': { ntv: '859', vavoo: '3525837057', daddy: '859' },
  
  // RAI
  'rai 1': { ntv: '101', vavoo: '875922788', daddy: '101' },
  'rai 2': { ntv: '102', vavoo: '1939210164', daddy: '102' },
  'rai 3': { ntv: '103', vavoo: '1324733956', daddy: '103' },
  'rai 4': { ntv: '104', vavoo: '4241820180', daddy: '104' },
  'rai 5': { ntv: '105', vavoo: '3249873828', daddy: '105' },
  'rai movie': { ntv: '106', vavoo: '2835672487', daddy: '106' },
  'rai premium': { ntv: '107', vavoo: '2861734300', daddy: '107' },
  'rai news 24': { ntv: '108', vavoo: '2272923972', daddy: '108' },
  'rai sport': { ntv: '109', vavoo: '2924135092', daddy: '109' },
  'rai scuola': { ntv: '110', vavoo: '2007798511', daddy: '110' },
  'rai yoyo': { ntv: '111', vavoo: '1785501924', daddy: '111' },
  'rai gulp': { ntv: '112', vavoo: '1901652742', daddy: '112' },
  'rai storia': { ntv: '113', vavoo: '78838793', daddy: '113' },
  'rai 4k': { ntv: '114', vavoo: '2049087681', daddy: '114' },
  
  // MEDIASET
  'canale 5': { ntv: '201', vavoo: '1534161807', daddy: '201' },
  'italia 1': { ntv: '202', vavoo: '663536394', daddy: '202' },
  'rete 4': { ntv: '203', vavoo: '4198218214', daddy: '203' },
  '20mediaset': { ntv: '204', vavoo: '1230338185', daddy: '204' },
  'mediaset extra': { ntv: '205', vavoo: '477466531', daddy: '205' },
  'focus': { ntv: '206', vavoo: '3439223610', daddy: '206' },
  'top crime': { ntv: '207', vavoo: '269503091', daddy: '207' },
  'cine 34': { ntv: '208', vavoo: '62558606', daddy: '208' },
  'boing': { ntv: '209', vavoo: '3373510242', daddy: '209' },
  'cartoonito': { ntv: '210', vavoo: '1987220436', daddy: '210' },
  'iris': { ntv: '', vavoo: '576490047', daddy: '' },
  'italia 2': { ntv: '', vavoo: '1613543898', daddy: '' },
  'la 5': { ntv: '', vavoo: '84139639', daddy: '' },
  'la 7': { ntv: '', vavoo: '2143522071', daddy: '' },
  
  // RSI
  'rsi la 1': { ntv: '2455610203', vavoo: '2455610203', daddy: '' },
  'rsi la 2': { ntv: '3590183307', vavoo: '3475299702', daddy: '' },
  
  // ALTRO
  'tv8': { ntv: '301', vavoo: '4038365720', daddy: '301' },
  'nova': { ntv: '302', vavoo: '31', daddy: '302' },
  'mtv': { ntv: '303', vavoo: '32', daddy: '303' },
  'vh1': { ntv: '304', vavoo: '33', daddy: '304' },
  'comedy central': { ntv: '305', vavoo: '3658277450', daddy: '305' },
  'paramount': { ntv: '306', vavoo: '35', daddy: '306' },
  'nickelodeon': { ntv: '307', vavoo: '3039389215', daddy: '307' },
  'disney channel': { ntv: '308', vavoo: '37', daddy: '308' },
  'national geographic': { ntv: '309', vavoo: '1735702308', daddy: '309' },
  'nat geo wild': { ntv: '', vavoo: '3428501495', daddy: '' },
  'discovery': { ntv: '310', vavoo: '1955739367', daddy: '310' },
  'discovery focus': { ntv: '', vavoo: '2113273064', daddy: '' },
  'discovery k2': { ntv: '', vavoo: '3037871903', daddy: '' },
  'discovery nove': { ntv: '', vavoo: '2651461317', daddy: '' },
  'dmax': { ntv: '', vavoo: '3008151733', daddy: '' },
  'real time': { ntv: '', vavoo: '1574975196', daddy: '' },
  'giallo': { ntv: '', vavoo: '2373936189', daddy: '' },
  'food network': { ntv: '', vavoo: '2820683351', daddy: '' },
  'hgtv': { ntv: '', vavoo: '2897782781', daddy: '' },
  'history': { ntv: '', vavoo: '317837654', daddy: '' },
  'eurosport 1': { ntv: '878', vavoo: '3481346857', daddy: '878' },
  'eurosport 2': { ntv: '879', vavoo: '2283887097', daddy: '879' },
  'bbc world': { ntv: '701', vavoo: '200', daddy: '701' },
  'cnn': { ntv: '702', vavoo: '201', daddy: '702' },
  'sky tg24': { ntv: '481', vavoo: '3376031355', daddy: '481' },
  'sky serie': { ntv: '880', vavoo: '836680112', daddy: '880' },
  'sky crime': { ntv: '863', vavoo: '', daddy: '863' },
  'sky arte': { ntv: '', vavoo: '1806815496', daddy: '' },
  'sky atlantic': { ntv: '', vavoo: '1421393119', daddy: '' },
  'fox': { ntv: '', vavoo: '563160609', daddy: '' },
  'star life': { ntv: '', vavoo: '3946128844', daddy: '' },
  'star comedy': { ntv: '', vavoo: '1512072384', daddy: '' },
  'premium crime': { ntv: '', vavoo: '444768053', daddy: '' },
  'crime investigation': { ntv: '', vavoo: '3005227700', daddy: '' },
  'motor trend': { ntv: '', vavoo: '3758728323', daddy: '' },
  'frisbee': { ntv: '', vavoo: '1995860185', daddy: '' },
  'k2': { ntv: '', vavoo: '2255724318', daddy: '' },
  'super': { ntv: '', vavoo: '3550030443', daddy: '' },
  'baby tv': { ntv: '', vavoo: '3938501125', daddy: '' },
  'cartoon network': { ntv: '', vavoo: '1744435623', daddy: '' },
  'nick jr': { ntv: '', vavoo: '380958472', daddy: '' },
  'deejay tv': { ntv: '', vavoo: '963607327', daddy: '' },
  'rtl 102.5': { ntv: '', vavoo: '3168132911', daddy: '' },
  'radio capital': { ntv: '', vavoo: '421441745', daddy: '' },
  'm2o': { ntv: '', vavoo: '215827632', daddy: '' },
  'tv2000': { ntv: '', vavoo: '1949044924', daddy: '' },
  'tg com 24': { ntv: '', vavoo: '2418148449', daddy: '' },
  'tg norba 24': { ntv: '', vavoo: '3379729817', daddy: '' },
  'bloomberg tv': { ntv: '', vavoo: '116299718', daddy: '' },
  'france 24': { ntv: '', vavoo: '2179686828', daddy: '' },
  'euronews': { ntv: '', vavoo: '490955579', daddy: '' },
  'rakuten top free': { ntv: '', vavoo: '1572866962', daddy: '' },
  'rakuten action movies': { ntv: '', vavoo: '1109372778', daddy: '' },
  'rakuten comedy movies': { ntv: '', vavoo: '1109372778', daddy: '' },
  'rakuten drama': { ntv: '', vavoo: '2098624390', daddy: '' },
  'rakuten family': { ntv: '', vavoo: '3902650955', daddy: '' },
  'rakuten tv shows': { ntv: '', vavoo: '86091226', daddy: '' },
  'wwe channel': { ntv: '', vavoo: '2989824407', daddy: '' },
  'warner tv': { ntv: '', vavoo: '3171202588', daddy: '' }
};

// ============================================================
// SESSION STORE
// ============================================================
const sessionStore = new Map();

function getSessionKey(provider, channelId) {
  return `${provider}:${channelId}`;
}

function getOrCreateSession(provider, channelId) {
  const key = getSessionKey(provider, channelId);
  let session = sessionStore.get(key);
  const now = Math.floor(Date.now() / 1000);
  
  if (!session || (now - session.createdAt) > CONFIG.SESSION_REFRESH_INTERVAL) {
    session = {
      createdAt: now,
      uaIndex: Math.floor(Math.random() * CONFIG.USER_AGENT_POOL.length),
      cookies: new Map(),
      failCount: 0,
      lastSuccess: now,
      resolvedUrl: null,
      resolvedAt: 0
    };
    sessionStore.set(key, session);
  }
  return session;
}

function rotateUA(session) {
  session.uaIndex = (session.uaIndex + 1) % CONFIG.USER_AGENT_POOL.length;
  return CONFIG.USER_AGENT_POOL[session.uaIndex];
}

function getUA(session) {
  return CONFIG.USER_AGENT_POOL[session.uaIndex];
}

// ============================================================
// ANTI-BLOCK HEADERS
// ============================================================
function buildAntiBlockHeaders(session, referer = '') {
  const ua = getUA(session);
  const headers = {
    'User-Agent': ua,
    'Accept': '*/*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'DNT': '1'
  };
  if (referer) headers['Referer'] = referer;
  if (session.cookies.size > 0) {
    headers['Cookie'] = Array.from(session.cookies.entries())
      .map(([k, v]) => `${k}=${v}`).join('; ');
  }
  return headers;
}

function storeCookiesFromResponse(session, response) {
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    setCookie.split(',').forEach(cookiePart => {
      const match = cookiePart.trim().match(/^([^=]+)=([^;]+)/);
      if (match) session.cookies.set(match[1], match[2]);
    });
  }
}

// ============================================================
// FETCH CON ANTI-BLOCK E RETRY
// ============================================================
async function fetchWithAntiBlock(url, session, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeout || CONFIG.DEFAULT_TIMEOUT;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  const headers = buildAntiBlockHeaders(session, options.referer);
  if (options.headers) Object.assign(headers, options.headers);
  
  const fetchOptions = {
    headers,
    signal: controller.signal,
    method: options.method || 'GET',
    cf: { cacheTtl: options.cacheTtl || 0, cacheEverything: false }
  };
  if (options.body) fetchOptions.body = options.body;
  
  try {
    const resp = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    storeCookiesFromResponse(session, resp);
    session.lastSuccess = Math.floor(Date.now() / 1000);
    session.failCount = 0;
    return resp;
  } catch (err) {
    clearTimeout(timeoutId);
    session.failCount++;
    rotateUA(session);
    if (session.failCount <= CONFIG.MAX_RETRIES) {
      const headers2 = buildAntiBlockHeaders(session, options.referer);
      if (options.headers) Object.assign(headers2, options.headers);
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
      try {
        const resp = await fetch(url, { ...fetchOptions, headers: headers2, signal: controller2.signal });
        clearTimeout(timeoutId2);
        storeCookiesFromResponse(session, resp);
        session.lastSuccess = Math.floor(Date.now() / 1000);
        return resp;
      } catch (err2) {
        clearTimeout(timeoutId2);
        throw err2;
      }
    }
    throw err;
  }
}

// ============================================================
// ⭐ RESOLVER REALI COLLAUDATI ⭐
// ============================================================

async function resolveNtv(channelId, session) {
  const apiUrl = `${CONFIG.NTV_API}${channelId}`;
  const resp = await fetchWithAntiBlock(apiUrl, session, { 
    timeout: 8000, 
    referer: 'https://tvnow247.today/' 
  });
  if (!resp.ok) throw new Error(`NTV API HTTP ${resp.status}`);
  const json = await resp.json().catch(() => null);
  const m3u8 = json && (json.m3u8 || json.proxyPlaylistUrl || json.proxyPlayerUrl);
  if (!m3u8) throw new Error('NTV: nessun m3u8 nella risposta');
  return m3u8;
}

async function resolveVavoo(channelId, session) {
  for (const base of CONFIG.VAVOO_MIRRORS) {
    try {
      const play = `${base}/live/play/${channelId}`;
      // Tentativo 1: live/resolve
      const resp1 = await fetchWithAntiBlock(
        `${base}/live/resolve?url=${encodeURIComponent(play)}`, 
        session, 
        { timeout: 5000, referer: `${base}/` }
      );
      if (resp1.ok) {
        const json = await resp1.json().catch(() => null);
        if (json && json.url) return json.url;
      }
      // Tentativo 2: mediahubmx-resolve.json
      const resp2 = await fetchWithAntiBlock(
        `${base}/mediahubmx-resolve.json`,
        session,
        {
          timeout: 5000,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Origin': base, 'Referer': `${base}/` },
          body: JSON.stringify({ language: 'de', region: 'DE', url: play, clientVersion: '3.0.2' })
        }
      );
      if (resp2.ok) {
        const json = await resp2.json().catch(() => null);
        if (json && json.url) return json.url;
      }
    } catch (e) { continue; }
  }
  throw new Error('Vavoo: tutti i mirror falliti');
}

async function resolveDaddy(channelId, session) {
  for (const domain of CONFIG.DADDY_DOMAINS) {
    try {
      const embedUrl = `${domain}/embed/stream-${channelId}.php`;
      const resp = await fetchWithAntiBlock(embedUrl, session, { 
        timeout: 5000, 
        referer: `${domain}/` 
      });
      if (resp.ok) {
        const html = await resp.text();
        let m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m3u8) return m3u8[1];
        const iframe = html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
        if (iframe) {
          const resp2 = await fetchWithAntiBlock(iframe[1], session, { 
            timeout: 5000, 
            referer: embedUrl 
          });
          if (resp2.ok) {
            const html2 = await resp2.text();
            m3u8 = html2.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
            if (m3u8) return m3u8[1];
          }
        }
      }
    } catch (e) { continue; }
  }
  throw new Error('Daddy: tutti i domini falliti');
}

async function resolveChannelUrl(provider, channelId, session, forceRefresh = false) {
  const now = Math.floor(Date.now() / 1000);
  if (!forceRefresh && session.resolvedUrl && (now - session.resolvedAt) < CONFIG.SESSION_REFRESH_INTERVAL) {
    return session.resolvedUrl;
  }
  let url;
  if (provider === 'ntv') url = await resolveNtv(channelId, session);
  else if (provider === 'vavoo') url = await resolveVavoo(channelId, session);
  else if (provider === 'daddy') url = await resolveDaddy(channelId, session);
  else throw new Error(`Provider sconosciuto: ${provider}`);
  session.resolvedUrl = url;
  session.resolvedAt = now;
  return url;
}

// ============================================================
// CHANNEL RESOLVER
// ============================================================
function resolveChannel(input) {
  if (!input) return null;
  const key = input.toLowerCase().trim();
  if (CHANNEL_DB[key]) return CHANNEL_DB[key];
  for (const [name, ids] of Object.entries(CHANNEL_DB)) {
    if (name.includes(key) || key.includes(name)) return ids;
  }
  if (/^\d+$/.test(key)) return { ntv: key, vavoo: key, daddy: key };
  const nospace = key.replace(/\s+/g, '');
  if (CHANNEL_DB[nospace]) return CHANNEL_DB[nospace];
  return null;
}

// ============================================================
// HLS PARSER AVANZATO
// ============================================================
function parseHlsPlaylist(content) {
  const lines = content.split('\n').map(l => l.trim());
  const result = {
    isMaster: false,
    version: 3,
    targetDuration: 0,
    mediaSequence: 0,
    variants: [],
    segments: [],
    map: null,
    start: null,
    discontinuitySequence: 0,
    _nextHasDiscontinuity: false
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-VERSION:')) {
      result.version = parseInt(line.split(':')[1]) || 3;
    } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      result.targetDuration = parseFloat(line.split(':')[1]) || 0;
    } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      result.mediaSequence = parseInt(line.split(':')[1]) || 0;
    } else if (line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE:')) {
      result.discontinuitySequence = parseInt(line.split(':')[1]) || 0;
    } else if (line.startsWith('#EXT-X-STREAM-INF:')) {
      result.isMaster = true;
      const attrs = parseAttributes(line.split(':')[1]);
      const uri = lines[i + 1] && !lines[i + 1].startsWith('#') ? lines[i + 1] : '';
      result.variants.push({ ...attrs, uri });
      if (uri) i++;
    } else if (line.startsWith('#EXT-X-MAP:')) {
      result.map = parseAttributes(line.split(':')[1]);
    } else if (line.startsWith('#EXT-X-START:')) {
      result.start = parseAttributes(line.split(':')[1]);
    } else if (line.startsWith('#EXTINF:')) {
      const duration = parseFloat(line.split(':')[1].split(',')[0]) || 0;
      const uri = lines[i + 1] && !lines[i + 1].startsWith('#') ? lines[i + 1] : '';
      result.segments.push({
        duration,
        uri,
        hasDiscontinuity: result._nextHasDiscontinuity
      });
      result._nextHasDiscontinuity = false;
      if (uri) i++;
    } else if (line === '#EXT-X-DISCONTINUITY') {
      result._nextHasDiscontinuity = true;
    }
    i++;
  }
  return result;
}

function parseAttributes(attrStr) {
  const result = {};
  const regex = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]+))/g;
  let match;
  while ((match = regex.exec(attrStr)) !== null) {
    result[match[1]] = match[2] !== undefined ? match[2] : match[3];
  }
  return result;
}

// ============================================================
// FILTRO H.264 (anti schermo grigio)
// ============================================================
function filterVariants(variants, forceH264 = false, variantIndex = -1) {
  if (variantIndex >= 0 && variantIndex < variants.length) {
    return [variants[variantIndex]];
  }
  if (!forceH264) return variants;
  const h264Variants = variants.filter(v => {
    const codecs = (v.CODECS || '').toLowerCase();
    return codecs.includes('avc1') || (!codecs.includes('hvc1') && !codecs.includes('hev1'));
  });
  return h264Variants.length > 0 ? h264Variants : variants;
}

function selectBestVariant(variants) {
  const scored = variants.map((v, i) => {
    let score = 0;
    const codecs = (v.CODECS || '').toLowerCase();
    const res = v.RESOLUTION || '';
    if (codecs.includes('avc1')) score += 100;
    if (codecs.includes('hvc1') || codecs.includes('hev1')) score -= 50;
    if (res.includes('1280x720') || res.includes('720')) score += 50;
    if (res.includes('1920x1080') || res.includes('1080')) score += 30;
    if (res.includes('854x480') || res.includes('480')) score += 20;
    return { v, score, i };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].v;
}

// ============================================================
// BUILD PLAYLIST OTTIMIZZATA
// ============================================================
function buildOptimizedMediaPlaylist(parsed, baseUrl, fastMode = true) {
  const { segments, targetDuration, mediaSequence, version, map, discontinuitySequence } = parsed;
  if (segments.length === 0) return null;
  
  let startIdx;
  if (fastMode) {
    startIdx = Math.max(0, segments.length - 4 - CONFIG.EXTRA_KEYFRAME_SEG);
    for (let i = startIdx; i < segments.length && i < startIdx + 3; i++) {
      if (segments[i]?.hasDiscontinuity && i > 0) {
        startIdx = Math.max(0, i - 1);
        break;
      }
    }
  } else {
    startIdx = Math.max(0, segments.length - 8);
  }
  
  const selectedSegments = segments.slice(startIdx);
  const newMediaSequence = mediaSequence + startIdx;
  const totalBackDuration = selectedSegments.slice(0, -1).reduce((sum, s) => sum + s.duration, 0);
  const startOffset = Math.max(CONFIG.EXT_X_START_OFFSET, -totalBackDuration);
  
  let output = '#EXTM3U\n';
  output += `#EXT-X-VERSION:${Math.max(version, CONFIG.EXT_X_VERSION)}\n`;
  output += `#EXT-X-TARGETDURATION:${Math.ceil(targetDuration)}\n`;
  output += `#EXT-X-MEDIA-SEQUENCE:${newMediaSequence}\n`;
  output += `#EXT-X-DISCONTINUITY-SEQUENCE:${discontinuitySequence}\n`;
  output += `#EXT-X-START:TIME-OFFSET=${startOffset},PRECISE=NO\n`;
  
  if (map) {
    const mapUri = map.URI || map.uri || '';
    const absoluteMapUri = resolveUri(mapUri, baseUrl);
    output += `#EXT-X-MAP:URI="/seg?url=${encodeURIComponent(absoluteMapUri)}&init=1"`;
    if (map.BYTERANGE) output += `,BYTERANGE="${map.BYTERANGE}"`;
    output += '\n';
  }
  
  for (const seg of selectedSegments) {
    if (seg.hasDiscontinuity) output += '#EXT-X-DISCONTINUITY\n';
    output += `#EXTINF:${seg.duration.toFixed(3)},\n`;
    output += `/seg?url=${encodeURIComponent(resolveUri(seg.uri, baseUrl))}\n`;
  }
  output += '#EXT-X-ENDLIST\n';
  return output;
}

function resolveUri(uri, base) {
  if (!uri) return '';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  try { return new URL(uri, base).toString(); } catch { return uri; }
}

// ============================================================
// HANDLER PRINCIPALE
// ============================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/live' || path === '/') return handleLive(url);
      if (path === '/seg') return handleSegment(url);
      if (path === '/analyze') return handleAnalyze(url);
      if (path === '/diag') return handleDiag(url);
      if (path === '/checkseg') return handleCheckSeg(url);
      if (path === '/vmap') return handleVariants(url);
      if (path === '/ch') return handleChannelList(url);
      if (path === '/debug') return handleDebug();
      if (path === '/resolve') return handleResolveDebug(url);
      if (path === '/features') return handleFeatures();
      
      return new Response(`${CONFIG.VERSION}\n\nEndpoint disponibili:\n/live?ch=canale\n/seg?url=...\n/analyze?ch=canale\n/diag?ch=canale\n/checkseg?s=ntv&ch=canale\n/vmap?ch=canale\n/ch?q=ricerca\n/debug\n/resolve?ch=canale&p=ntv\n/features`, {
        headers: { 'Content-Type': 'text/plain' }
      });
    } catch (err) {
      return new Response(`ERRORE: ${err.message}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  }
};

// ============================================================
// HANDLER: /live
// ============================================================
async function handleLive(url) {
  const chParam = url.searchParams.get('ch') || '';
  const providerParam = url.searchParams.get('p') || 'vavoo,daddy,ntv';
  const fastMode = url.searchParams.get('fast') !== '0';
  const forceH264 = url.searchParams.get('force_h264') === '1';
  const forceRefresh = url.searchParams.get('refresh') === '1';
  
  if (!chParam) {
    return new Response('Specificare un canale: /live?ch=sky-sport-f1', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  const channel = resolveChannel(chParam);
  if (!channel) {
    return new Response(`Canale "${chParam}" non trovato.`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  const providers = providerParam.split(',').map(p => p.trim());
  let lastError = null;
  
  for (const provider of providers) {
    const channelId = channel[provider];
    if (!channelId) continue;
    
    try {
      const session = getOrCreateSession(provider, channelId);
      const now = Math.floor(Date.now() / 1000);
      
      if (forceRefresh || (now - session.createdAt) > CONFIG.SESSION_REFRESH_INTERVAL) {
        sessionStore.delete(getSessionKey(provider, channelId));
        Object.assign(session, getOrCreateSession(provider, channelId));
      }
      
      const masterUrl = await resolveChannelUrl(provider, channelId, session, forceRefresh);
      const masterResp = await fetchWithAntiBlock(masterUrl, session, { cacheTtl: 0, timeout: 5000 });
      
      if (!masterResp.ok) {
        session.resolvedUrl = null;
        const masterUrl2 = await resolveChannelUrl(provider, channelId, session, true);
        const masterResp2 = await fetchWithAntiBlock(masterUrl2, session, { cacheTtl: 0, timeout: 5000 });
        if (!masterResp2.ok) { lastError = `${provider}: HTTP ${masterResp2.status}`; continue; }
      }
      
      const masterContent = await masterResp.text();
      const parsed = parseHlsPlaylist(masterContent);
      
      if (!parsed.isMaster && parsed.segments.length > 0) {
        const optimized = buildOptimizedMediaPlaylist(parsed, masterUrl, fastMode);
        if (optimized) {
          return new Response(optimized, {
            headers: {
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Access-Control-Allow-Origin': '*',
              'X-Provider': provider,
              'X-Version': CONFIG.VERSION
            }
          });
        }
      }
      
      if (parsed.isMaster && parsed.variants.length > 0) {
        const filtered = filterVariants(parsed.variants, forceH264, -1);
        if (filtered.length === 0) { lastError = `${provider}: nessuna variante H.264`; continue; }
        
        const selected = selectBestVariant(filtered);
        const mediaUrl = resolveUri(selected.uri, masterUrl);
        const mediaSession = getOrCreateSession(provider, channelId + ':media');
        const mediaResp = await fetchWithAntiBlock(mediaUrl, mediaSession, { 
          cacheTtl: 0, referer: masterUrl, timeout: 5000 
        });
        
        if (!mediaResp.ok) { lastError = `${provider}: media HTTP ${mediaResp.status}`; continue; }
        
        const parsedMedia = parseHlsPlaylist(await mediaResp.text());
        if (parsedMedia.segments.length === 0) { lastError = `${provider}: nessun segmento`; continue; }
        
        const optimized = buildOptimizedMediaPlaylist(parsedMedia, mediaUrl, fastMode);
        if (optimized) {
          return new Response(optimized, {
            headers: {
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Access-Control-Allow-Origin': '*',
              'X-Provider': provider,
              'X-Variant': `${selected.RESOLUTION || '?'} ${selected.CODECS || ''}`,
              'X-Version': CONFIG.VERSION
            }
          });
        }
      }
    } catch (err) {
      lastError = `${provider}: ${err.message}`;
      continue;
    }
  }
  
  return new Response(`Tutti i provider falliti. Ultimo errore: ${lastError}`, {
    status: 502,
    headers: { 'Content-Type': 'text/plain' }
  });
}

// ============================================================
// HANDLER: /seg
// ============================================================
async function handleSegment(url) {
  const segUrl = url.searchParams.get('url');
  const isInit = url.searchParams.get('init') === '1';
  if (!segUrl) return new Response('URL mancante', { status: 400 });
  
  try {
    const decodedUrl = decodeURIComponent(segUrl);
    const provider = decodedUrl.includes('cfbu247') ? 'ntv' 
      : decodedUrl.includes('geil.to') || decodedUrl.includes('vavoo') ? 'vavoo' 
      : 'daddy';
    const session = getOrCreateSession(provider, 'segment');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isInit ? 3000 : 5000);
    const headers = buildAntiBlockHeaders(session);
    if (isInit) {
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      headers['Pragma'] = 'no-cache';
    }
    
    const resp = await fetch(decodedUrl, {
      headers,
      signal: controller.signal,
      cf: { cacheTtl: isInit ? 0 : 5, cacheEverything: false }
    });
    clearTimeout(timeout);
    storeCookiesFromResponse(session, resp);
    
    const respHeaders = new Headers();
    respHeaders.set('Content-Type', resp.headers.get('content-type') || 'video/mp2t');
    respHeaders.set('Access-Control-Allow-Origin', '*');
    const cl = resp.headers.get('content-length');
    const te = resp.headers.get('transfer-encoding');
    if (cl && !te) respHeaders.set('Content-Length', cl);
    respHeaders.set('Cache-Control', isInit 
      ? 'no-store, no-cache, must-revalidate' 
      : 'public, max-age=5');
    
    return new Response(resp.body, { status: resp.status, headers: respHeaders });
  } catch (err) {
    return new Response(`Errore segmento: ${err.message}`, { status: 502 });
  }
}

// ============================================================
// HANDLER: /analyze
// ============================================================
async function handleAnalyze(url) {
  const ch = url.searchParams.get('ch') || '';
  if (!ch) return new Response('?ch=nome_canale', { status: 400 });
  
  const channel = resolveChannel(ch);
  if (!channel) return new Response('Canale non trovato', { status: 404 });
  
  let report = `=== ANALISI CANALE: ${ch} ===\n`;
  report += `${CONFIG.VERSION}\n\n`;
  report += `Mapping: ${JSON.stringify(channel, null, 2)}\n\n`;
  
  for (const provider of ['ntv', 'vavoo', 'daddy']) {
    const id = channel[provider];
    if (!id) continue;
    
    report += `--- ${provider.toUpperCase()} (ID: ${id}) ---\n`;
    try {
      const session = getOrCreateSession(provider, id);
      const t0 = Date.now();
      const resolved = await resolveChannelUrl(provider, id, session, true);
      const t1 = Date.now();
      report += `✅ URL risolto: ${resolved.substring(0, 100)}...\n`;
      report += `Tempo resolve: ${t1 - t0}ms\n`;
      report += `UA: ${getUA(session).substring(0, 60)}...\n`;
      
      const t2 = Date.now();
      const resp = await fetchWithAntiBlock(resolved, session, { cacheTtl: 0, timeout: 5000 });
      const t3 = Date.now();
      report += `Fetch: ${resp.status} (${t3 - t2}ms)\n`;
      
      if (resp.ok) {
        const content = await resp.text();
        const parsed = parseHlsPlaylist(content);
        if (parsed.isMaster) {
          report += `Tipo: MASTER | Varianti: ${parsed.variants.length}\n`;
          parsed.variants.forEach((v, i) => {
            const c = (v.CODECS || '').toLowerCase();
            const h264 = c.includes('avc1') ? '✅H264' : (c.includes('hvc1')||c.includes('hev1') ? '⚠️HEVC' : '❓');
            report += `  [${i}] ${v.RESOLUTION||'?'} | ${v.CODECS||'?'} | ${h264}\n`;
          });
        } else {
          report += `Tipo: MEDIA | Segmenti: ${parsed.segments.length} | MAP: ${parsed.map ? 'SI' : 'NO'}\n`;
        }
      }
    } catch (err) {
      report += `❌ ERRORE: ${err.message}\n`;
    }
    report += '\n';
  }
  
  return new Response(report, { headers: { 'Content-Type': 'text/plain' } });
}

// ============================================================
// HANDLER: /diag
// ============================================================
async function handleDiag(url) {
  const ch = url.searchParams.get('ch') || 'sky-sport-24';
  const channel = resolveChannel(ch);
  if (!channel) return new Response('Canale non trovato', { status: 404 });
  
  const results = [];
  for (const provider of ['vavoo', 'daddy', 'ntv']) {
    const id = channel[provider];
    if (!id) continue;
    try {
      const session = getOrCreateSession(provider, id);
      const t0 = Date.now();
      const resolved = await resolveChannelUrl(provider, id, session, true);
      const resp = await fetchWithAntiBlock(resolved, session, { cacheTtl: 0, timeout: 5000 });
      const t1 = Date.now();
      if (resp.ok) {
        const parsed = parseHlsPlaylist(await resp.text());
        const info = parsed.isMaster 
          ? `MASTER ${parsed.variants.length}var` 
          : `MEDIA ${parsed.segments.length}seg`;
        results.push(`${provider.toUpperCase()}: ✅ OK ${t1-t0}ms | ${info}`);
      } else {
        results.push(`${provider.toUpperCase()}: ⚠️ HTTP ${resp.status}`);
      }
    } catch (e) {
      results.push(`${provider.toUpperCase()}: ❌ FAIL (${e.message})`);
    }
  }
  
  return new Response(
    `${CONFIG.VERSION}\n\nDIAG: ${ch}\nRisolto come: ${JSON.stringify(channel)}\n\n${results.join('\n')}`,
    { headers: { 'Content-Type': 'text/plain' } }
  );
}

// ============================================================
// HANDLER: /checkseg
// ============================================================
async function handleCheckSeg(url) {
  const source = url.searchParams.get('s') || 'ntv';
  const ch = url.searchParams.get('ch') || '';
  if (!ch) return new Response('?s=ntv&ch=ID', { status: 400 });
  
  const channel = resolveChannel(ch);
  const id = channel?.[source] || ch;
  const session = getOrCreateSession(source, id);
  const masterUrl = await resolveChannelUrl(source, id, session, true);
  
  try {
    const resp = await fetchWithAntiBlock(masterUrl, session, { cacheTtl: 0 });
    const content = await resp.text();
    const parsed = parseHlsPlaylist(content);
    
    let mediaUrl = masterUrl;
    if (parsed.isMaster && parsed.variants.length > 0) {
      mediaUrl = resolveUri(parsed.variants[0].uri, masterUrl);
      const mediaResp = await fetchWithAntiBlock(mediaUrl, session, { cacheTtl: 0 });
      return analyzeSegments(await mediaResp.text(), mediaUrl);
    }
    return analyzeSegments(content, mediaUrl);
  } catch (e) {
    return new Response(`Errore: ${e.message}`, { status: 500 });
  }
}

function analyzeSegments(content, baseUrl) {
  const parsed = parseHlsPlaylist(content);
  let report = `Segmenti: ${parsed.segments.length} | TargetDur: ${parsed.targetDuration}s | MAP: ${parsed.map ? 'SI' : 'NO'}\n\n`;
  parsed.segments.forEach((s, i) => {
    const abs = resolveUri(s.uri, baseUrl);
    report += `[${i}] ${s.duration.toFixed(2)}s disc:${s.hasDiscontinuity ? 'SI' : 'NO'} ${abs.substring(0, 70)}...\n`;
  });
  return new Response(report, { headers: { 'Content-Type': 'text/plain' } });
}

// ============================================================
// HANDLER: /vmap
// ============================================================
async function handleVariants(url) {
  const ch = url.searchParams.get('ch') || '';
  if (!ch) return new Response('?ch=nome_canale', { status: 400 });
  
  const channel = resolveChannel(ch);
  if (!channel) return new Response('Canale non trovato', { status: 404 });
  
  let report = `${CONFIG.VERSION}\n\n`;
  for (const provider of ['ntv', 'vavoo', 'daddy']) {
    const id = channel[provider];
    if (!id) continue;
    report += `=== ${provider.toUpperCase()} ===\n`;
    try {
      const session = getOrCreateSession(provider, id);
      const masterUrl = await resolveChannelUrl(provider, id, session, true);
      const resp = await fetchWithAntiBlock(masterUrl, session, { cacheTtl: 0 });
      if (resp.ok) {
        const parsed = parseHlsPlaylist(await resp.text());
        if (parsed.isMaster) {
          parsed.variants.forEach((v, i) => {
            report += `[${i}] RES=${v.RESOLUTION||'?'} CODECS=${v.CODECS||'?'} BW=${v.BANDWIDTH?(v.BANDWIDTH/1000).toFixed(0)+'kbps':'?'}\n`;
          });
        } else report += '(media playlist)\n';
      } else report += `HTTP ${resp.status}\n`;
    } catch (e) { report += `ERRORE: ${e.message}\n`; }
    report += '\n';
  }
  return new Response(report, { headers: { 'Content-Type': 'text/plain' } });
}

// ============================================================
// HANDLER: /ch
// ============================================================
async function handleChannelList(url) {
  const search = (url.searchParams.get('q') || '').toLowerCase();
  const page = parseInt(url.searchParams.get('page') || '0');
  const pageSize = 50;
  
  let channels = Object.keys(CHANNEL_DB);
  if (search) channels = channels.filter(c => c.includes(search));
  
  const total = channels.length;
  const paged = channels.slice(page * pageSize, (page + 1) * pageSize);
  
  let output = `${CONFIG.VERSION}\n\n=== CANALI (${total}) - pagina ${page + 1} ===\n\n`;
  for (const name of paged) {
    const ids = CHANNEL_DB[name];
    output += `${name.padEnd(25)} ntv:${ids.ntv||'-'} vavoo:${ids.vavoo||'-'} daddy:${ids.daddy||'-'}\n`;
  }
  if ((page + 1) * pageSize < total) {
    output += `\n... altri ${total - (page + 1) * pageSize} canali. ?page=${page + 1} o ?q=ricerca`;
  }
  return new Response(output, { headers: { 'Content-Type': 'text/plain' } });
}

// ============================================================
// HANDLER: /debug (VERSIONE COMPLETA)
// ============================================================
async function handleDebug() {
  const now = Math.floor(Date.now() / 1000);
  
  let output = `╔══════════════════════════════════════════════════════════╗\n`;
  output += `║  ${CONFIG.VERSION.padEnd(56)}║\n`;
  output += `╚══════════════════════════════════════════════════════════╝\n\n`;
  
  output += `📋 INFORMAZIONI SISTEMA\n`;
  output += `─────────────────────────────────────────────────────────\n`;
  output += `Versione:        ${CONFIG.VERSION}\n`;
  output += `Timeout:         ${CONFIG.DEFAULT_TIMEOUT}ms\n`;
  output += `Max Retries:     ${CONFIG.MAX_RETRIES}\n`;
  output += `Session TTL:     ${CONFIG.SESSION_REFRESH_INTERVAL}s (25min)\n`;
  output += `Keyframe Seg:    ${CONFIG.EXTRA_KEYFRAME_SEG}\n`;
  output += `EXT-X-START:     ${CONFIG.EXT_X_START_OFFSET}s\n`;
  output += `EXT-X-VERSION:   ${CONFIG.EXT_X_VERSION}\n`;
  output += `UA Pool Size:    ${CONFIG.USER_AGENT_POOL.length}\n`;
  output += `Canali DB:       ${Object.keys(CHANNEL_DB).length}\n`;
  output += `Sessioni Attive: ${sessionStore.size}\n\n`;
  
  output += `🔧 RESOLVER\n`;
  output += `─────────────────────────────────────────────────────────\n`;
  output += `NTV API:         ${CONFIG.NTV_API}\n`;
  output += `Vavoo Mirrors:   ${CONFIG.VAVOO_MIRRORS.length} (${CONFIG.VAVOO_MIRRORS.join(', ')})\n`;
  output += `Daddy Domains:   ${CONFIG.DADDY_DOMAINS.length} (${CONFIG.DADDY_DOMAINS.join(', ')})\n\n`;
  
  output += `✨ FUNZIONALITÀ ATTIVE\n`;
  output += `─────────────────────────────────────────────────────────\n`;
  CONFIG.FEATURES.forEach((f, i) => {
    output += `  ${String(i+1).padStart(2)}. ${f}\n`;
  });
  output += `\n`;
  
  output += `🌐 ENDPOINT DISPONIBILI\n`;
  output += `─────────────────────────────────────────────────────────\n`;
  output += `  /live?ch=canale          Stream HLS con fallback\n`;
  output += `  /seg?url=...&init=0|1    Proxy segmento\n`;
  output += `  /analyze?ch=canale       Analisi dettagliata\n`;
  output += `  /diag?ch=canale          Diagnostica rapida\n`;
  output += `  /checkseg?s=ntv&ch=X     Check segmento reale\n`;
  output += `  /vmap?ch=canale          Lista varianti HLS\n`;
  output += `  /ch?q=ricerca            Lista canali\n`;
  output += `  /debug                   Questa pagina\n`;
  output += `  /resolve?ch=X&p=ntv      Debug resolver\n`;
  output += `  /features                Lista funzionalità\n\n`;
  
  output += `📊 SESSIONI ATTIVE\n`;
  output += `─────────────────────────────────────────────────────────\n`;
  if (sessionStore.size === 0) {
    output += `  (nessuna sessione attiva)\n`;
  } else {
    for (const [key, sess] of sessionStore.entries()) {
      const age = now - sess.createdAt;
      const pct = Math.min(100, Math.round((age / CONFIG.SESSION_REFRESH_INTERVAL) * 100));
      const urlAge = sess.resolvedAt ? now - sess.resolvedAt : 'n/a';
      const ua = CONFIG.USER_AGENT_POOL[sess.uaIndex].substring(0, 40);
      output += `  ${key}\n`;
      output += `    età: ${age}s (${pct}%) | url: ${urlAge}s | fail: ${sess.failCount}\n`;
      output += `    UA: ${ua}...\n`;
    }
  }
  output += `\n`;
  
  output += `🎯 USER AGENT POOL\n`;
  output += `─────────────────────────────────────────────────────────\n`;
  CONFIG.USER_AGENT_POOL.forEach((ua, i) => {
    output += `  [${i}] ${ua.substring(0, 70)}...\n`;
  });
  
  return new Response(output, { headers: { 'Content-Type': 'text/plain' } });
}

// ============================================================
// HANDLER: /features
// ============================================================
async function handleFeatures() {
  let output = `${CONFIG.VERSION}\n\n`;
  output += `FUNZIONALITÀ IMPLEMENTATE:\n\n`;
  CONFIG.FEATURES.forEach((f, i) => {
    output += `  ✅ ${f}\n`;
  });
  output += `\nCONFIGURAZIONE:\n`;
  output += `  VERSION: ${CONFIG.VERSION}\n`;
  output += `  TIMEOUT: ${CONFIG.DEFAULT_TIMEOUT}ms\n`;
  output += `  MAX_RETRIES: ${CONFIG.MAX_RETRIES}\n`;
  output += `  SESSION_TTL: ${CONFIG.SESSION_REFRESH_INTERVAL}s\n`;
  output += `  KEYFRAME_SEG: ${CONFIG.EXTRA_KEYFRAME_SEG}\n`;
  output += `  START_OFFSET: ${CONFIG.EXT_X_START_OFFSET}s\n`;
  output += `  HLS_VERSION: ${CONFIG.EXT_X_VERSION}\n`;
  output += `  UA_POOL: ${CONFIG.USER_AGENT_POOL.length} agenti\n`;
  output += `  CANALI: ${Object.keys(CHANNEL_DB).length}\n`;
  return new Response(output, { headers: { 'Content-Type': 'text/plain' } });
}

// ============================================================
// HANDLER: /resolve
// ============================================================
async function handleResolveDebug(url) {
  const ch = url.searchParams.get('ch') || '';
  const provider = url.searchParams.get('p') || 'ntv';
  if (!ch) return new Response('?ch=canale&p=ntv|vavoo|daddy', { status: 400 });
  
  const channel = resolveChannel(ch);
  if (!channel || !channel[provider]) return new Response('Canale/provider non trovato', { status: 404 });
  
  const session = getOrCreateSession(provider, channel[provider]);
  const resolved = await resolveChannelUrl(provider, channel[provider], session, true);
  
  return new Response(
    `${CONFIG.VERSION}\n\nProvider: ${provider}\nCanale: ${ch}\nID: ${channel[provider]}\nUA: ${getUA(session)}\n\nURL risolto:\n${resolved}`,
    { headers: { 'Content-Type': 'text/plain' } }
  );
}
