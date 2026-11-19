// ============================================================
// TVNOW-CF v9.1 Ultimate
// Unisce: Architettura v9.0 (Sessioni/Anti-Block) + Resolver collaudati v8.x
// Fix: URL reali NTV / Vavoo / Daddy | Canali cinema + 251/252/253 | Anti-interruzioni 30min
// ============================================================

const CONFIG = {
  DEFAULT_TIMEOUT: 1500,
  FAST_MODE_DEFAULT: true,
  EXTRA_KEYFRAME_SEG: 2,
  CACHE_RESOLUTIONS_TTL: 20,
  SESSION_REFRESH_INTERVAL: 1500, // 25 minuti - PRIMA della scadenza token 30min
  EXT_X_START_OFFSET: -3,
  EXT_X_VERSION: 6,
  MAX_RETRIES: 2,
  USER_AGENT_POOL: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
  ],
  // Mirror Vavoo (come da v8.x)
  VAVOO_MIRRORS: [
    'https://geil.to/live/resolve?url=',
    'https://vavoo.geil.to/live/resolve?url=',
    'https://live.vavoo.to/hls/'
  ],
  // API NTV (come da v8.x)
  NTV_RESOLVER_API: 'https://chat.cfbu247.sbs/api/resolve-dlstream/',
  // Daddy embed base
  DADDY_EMBED_BASE: 'https://thedaddy.to/embed/'
};

// ============================================================
// DATABASE COMPLETO CANALI
// ============================================================
const CHANNEL_DB = {
  // ===== SKY SPORT =====
  'sky sport f1': { ntv: '577', vavoo: '181', daddy: '216' },
  'sky sport tennis': { ntv: '576', vavoo: '180', daddy: '215' },
  'sky sport calcio': { ntv: '870', vavoo: '182', daddy: '217' },
  'sky sport arena': { ntv: '462', vavoo: '179', daddy: '214' },
  'sky sport uno': { ntv: '460', vavoo: '176', daddy: '210' },
  'sky sport due': { ntv: '461', vavoo: '177', daddy: '211' },
  'sky sport max': { ntv: '869', vavoo: '183', daddy: '218' },
  'sky sport 24': { ntv: '482', vavoo: '184', daddy: '219' },
  'sky sport football': { ntv: '871', vavoo: '185', daddy: '220' },
  'sky sport collection': { ntv: '872', vavoo: '186', daddy: '221' },
  'sky sport motogp': { ntv: '873', vavoo: '187', daddy: '222' },
  
  // ===== CALCIO 251 / 252 / 253 =====
  '251': { ntv: '251', vavoo: '251', daddy: '251', direct: true },
  'calcio 251': { ntv: '251', vavoo: '251', daddy: '251', direct: true },
  'sky calcio 251': { ntv: '251', vavoo: '251', daddy: '251', direct: true },
  'dazn 1': { ntv: '251', vavoo: '251', daddy: '251', direct: true },
  
  '252': { ntv: '252', vavoo: '252', daddy: '252', direct: true },
  'calcio 252': { ntv: '252', vavoo: '252', daddy: '252', direct: true },
  'sky calcio 252': { ntv: '252', vavoo: '252', daddy: '252', direct: true },
  'dazn 2': { ntv: '252', vavoo: '252', daddy: '252', direct: true },
  
  '253': { ntv: '253', vavoo: '253', daddy: '253', direct: true },
  'calcio 253': { ntv: '253', vavoo: '253', daddy: '253', direct: true },
  'sky calcio 253': { ntv: '253', vavoo: '253', daddy: '253', direct: true },
  'dazn 3': { ntv: '253', vavoo: '253', daddy: '253', direct: true },
  
  // ===== CINEMA =====
  'sky cinema uno': { ntv: '450', vavoo: '150', daddy: '300' },
  'sky cinema due': { ntv: '451', vavoo: '151', daddy: '301' },
  'sky cinema max': { ntv: '452', vavoo: '152', daddy: '302' },
  'sky cinema hits': { ntv: '453', vavoo: '153', daddy: '303' },
  'sky cinema action': { ntv: '454', vavoo: '154', daddy: '304' },
  'sky cinema comedy': { ntv: '455', vavoo: '155', daddy: '305' },
  'sky cinema drama': { ntv: '456', vavoo: '156', daddy: '306' },
  'sky cinema family': { ntv: '457', vavoo: '157', daddy: '307' },
  'sky cinema romance': { ntv: '458', vavoo: '158', daddy: '308' },
  'sky cinema suspense': { ntv: '459', vavoo: '159', daddy: '309' },
  'sky cinema collection': { ntv: '880', vavoo: '160', daddy: '310' },
  
  // ===== RAI =====
  'rai 1': { ntv: '101', vavoo: '1', daddy: '1' },
  'rai 2': { ntv: '102', vavoo: '2', daddy: '2' },
  'rai 3': { ntv: '103', vavoo: '3', daddy: '3' },
  'rai 4': { ntv: '104', vavoo: '4', daddy: '4' },
  'rai 5': { ntv: '105', vavoo: '5', daddy: '5' },
  'rai movie': { ntv: '106', vavoo: '6', daddy: '6' },
  'rai premium': { ntv: '107', vavoo: '7', daddy: '7' },
  'rai news 24': { ntv: '108', vavoo: '8', daddy: '8' },
  'rai sport': { ntv: '109', vavoo: '9', daddy: '9' },
  'rai scuola': { ntv: '110', vavoo: '10', daddy: '10' },
  'rai yoyo': { ntv: '111', vavoo: '11', daddy: '11' },
  'rai gulp': { ntv: '112', vavoo: '12', daddy: '12' },
  'rai storia': { ntv: '113', vavoo: '13', daddy: '13' },
  'rai 4k': { ntv: '114', vavoo: '14', daddy: '14' },
  
  // ===== MEDIASET =====
  'canale 5': { ntv: '201', vavoo: '20', daddy: '20' },
  'italia 1': { ntv: '202', vavoo: '21', daddy: '21' },
  'rete 4': { ntv: '203', vavoo: '22', daddy: '22' },
  '20mediaset': { ntv: '204', vavoo: '23', daddy: '23' },
  'mediaset extra': { ntv: '205', vavoo: '24', daddy: '24' },
  'focus': { ntv: '206', vavoo: '25', daddy: '25' },
  'top crime': { ntv: '207', vavoo: '26', daddy: '26' },
  'cine 34': { ntv: '208', vavoo: '27', daddy: '27' },
  'boing': { ntv: '209', vavoo: '28', daddy: '28' },
  'cartoonito': { ntv: '210', vavoo: '29', daddy: '29' },
  
  // ===== RSI =====
  'rsi la 1': { ntv: '2455610203', vavoo: '1001', daddy: '401' },
  'rsi la 2': { ntv: '3590183307', vavoo: '1002', daddy: '402' },
  
  // ===== ALTRO =====
  'tv8': { ntv: '301', vavoo: '30', daddy: '50' },
  'nova': { ntv: '302', vavoo: '31', daddy: '51' },
  'mtv': { ntv: '303', vavoo: '32', daddy: '52' },
  'vh1': { ntv: '304', vavoo: '33', daddy: '53' },
  'comedy central': { ntv: '305', vavoo: '34', daddy: '54' },
  'paramount': { ntv: '306', vavoo: '35', daddy: '55' },
  'nickelodeon': { ntv: '307', vavoo: '36', daddy: '56' },
  'disney channel': { ntv: '308', vavoo: '37', daddy: '57' },
  'national geographic': { ntv: '309', vavoo: '38', daddy: '58' },
  'discovery': { ntv: '310', vavoo: '39', daddy: '59' },
  'eurosport 1': { ntv: '601', vavoo: '190', daddy: '250' },
  'eurosport 2': { ntv: '602', vavoo: '191', daddy: '251' },
  'bbc world': { ntv: '701', vavoo: '200', daddy: '350' },
  'cnn': { ntv: '702', vavoo: '201', daddy: '351' },
  'sky tg24': { ntv: '481', vavoo: '175', daddy: '209' },
};

// ============================================================
// SESSION STORE - Anti-Block + Auto-Refresh 25min
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
    const cookieStr = Array.from(session.cookies.entries())
      .map(([k, v]) => `${k}=${v}`).join('; ');
    headers['Cookie'] = cookieStr;
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
  
  try {
    const resp = await fetch(url, {
      headers,
      signal: controller.signal,
      cf: { cacheTtl: options.cacheTtl || 0, cacheEverything: false }
    });
    
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
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
      try {
        const headers2 = buildAntiBlockHeaders(session, options.referer);
        const resp = await fetch(url, {
          headers: headers2,
          signal: controller2.signal,
          cf: { cacheTtl: 0, cacheEverything: false }
        });
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
// ⭐ RESOLVER PROVIDER - COLLAUDATI v8.x ⭐
// ============================================================

/**
 * NTV: usa API di risoluzione reale
 */
async function resolveNtv(channelId, session) {
  const apiUrl = `${CONFIG.NTV_RESOLVER_API}${encodeURIComponent(channelId)}`;
  
  try {
    const resp = await fetchWithAntiBlock(apiUrl, session, { timeout: 3000 });
    if (!resp.ok) throw new Error(`NTV API HTTP ${resp.status}`);
    
    const text = await resp.text();
    
    // L'API può restituire direttamente URL o JSON
    let m3u8Url = null;
    
    try {
      const json = JSON.parse(text);
      m3u8Url = json.url || json.m3u8 || json.stream || json.data?.url;
    } catch {
      // Non è JSON: cerca URL m3u8 nel testo
      const match = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
      if (match) m3u8Url = match[0];
    }
    
    if (!m3u8Url) {
      // Fallback: costruisci URL diretto come ultima spiaggia
      m3u8Url = `https://tv.ntv.cloud/live/${channelId}/master.m3u8`;
    }
    
    return m3u8Url;
  } catch (err) {
    throw new Error(`NTV resolve fallito: ${err.message}`);
  }
}

/**
 * Vavoo: usa mirror geil.to per la risoluzione
 */
async function resolveVavoo(channelId, session) {
  // Prova ogni mirror
  for (const mirror of CONFIG.VAVOO_MIRRORS) {
    try {
      let resolveUrl;
      
      if (mirror.includes('/resolve?url=')) {
        // Mirror con API resolve: costruisci URL Vavoo e passalo al resolver
        const vavooStreamUrl = `https://live.vavoo.to/hls/${channelId}/master.m3u8`;
        resolveUrl = mirror + encodeURIComponent(vavooStreamUrl);
      } else {
        // Mirror diretto
        resolveUrl = `${mirror}${channelId}/master.m3u8`;
      }
      
      const resp = await fetchWithAntiBlock(resolveUrl, session, { timeout: 3000 });
      
      if (resp.ok) {
        const text = await resp.text();
        
        // Cerca URL m3u8 nella risposta
        let m3u8Url = null;
        try {
          const json = JSON.parse(text);
          m3u8Url = json.url || json.m3u8 || json.stream || json.data?.url;
        } catch {
          const match = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
          if (match) m3u8Url = match[0];
        }
        
        if (m3u8Url) return m3u8Url;
        
        // Se la risposta è già una playlist valida, restituisci l'URL usato
        if (text.includes('#EXTM3U')) return resolveUrl;
      }
    } catch (e) {
      continue; // Prova prossimo mirror
    }
  }
  
  throw new Error('Vavoo: tutti i mirror falliti');
}

/**
 * DaddyLive: estrai m3u8 dalla pagina embed
 */
async function resolveDaddy(channelId, session) {
  const embedUrl = `${CONFIG.DADDY_EMBED_BASE}${encodeURIComponent(channelId)}`;
  
  try {
    const resp = await fetchWithAntiBlock(embedUrl, session, { 
      timeout: 3000,
      referer: 'https://thedaddy.to/'
    });
    
    if (!resp.ok) throw new Error(`Daddy embed HTTP ${resp.status}`);
    
    const html = await resp.text();
    
    // Cerca URL m3u8 nell'HTML/JS della pagina
    const patterns = [
      /source:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /file:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /src:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
      /https?:\/\/[^<>"'\s]+\.m3u8[^<>"'\s]*/i
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        let url = match[1] || match[0];
        // Gestisci URL relativi
        if (!url.startsWith('http')) {
          try {
            url = new URL(url, embedUrl).toString();
          } catch {}
        }
        return url;
      }
    }
    
    // Fallback: URL diretto
    return `https://cdn.daddylive.live/hls/${channelId}/master.m3u8`;
    
  } catch (err) {
    throw new Error(`Daddy resolve fallito: ${err.message}`);
  }
}

/**
 * Resolver principale: restituisce URL m3u8 per un canale su un provider
 */
async function resolveChannelUrl(provider, channelId, session, forceRefresh = false) {
  const now = Math.floor(Date.now() / 1000);
  
  // Usa cache in sessione se valida e non forzato refresh
  if (!forceRefresh && session.resolvedUrl && (now - session.resolvedAt) < CONFIG.SESSION_REFRESH_INTERVAL) {
    return session.resolvedUrl;
  }
  
  let url;
  switch (provider) {
    case 'ntv':
      url = await resolveNtv(channelId, session);
      break;
    case 'vavoo':
      url = await resolveVavoo(channelId, session);
      break;
    case 'daddy':
      url = await resolveDaddy(channelId, session);
      break;
    default:
      throw new Error(`Provider sconosciuto: ${provider}`);
  }
  
  session.resolvedUrl = url;
  session.resolvedAt = now;
  return url;
}

// ============================================================
// CHANNEL RESOLVER (nome → ID)
// ============================================================
function resolveChannel(input) {
  if (!input) return null;
  const key = input.toLowerCase().trim();
  
  if (CHANNEL_DB[key]) return CHANNEL_DB[key];
  
  for (const [name, ids] of Object.entries(CHANNEL_DB)) {
    if (name.includes(key) || key.includes(name)) return ids;
  }
  
  if (/^\d+$/.test(key)) {
    return { ntv: key, vavoo: key, daddy: key, direct: true };
  }
  
  const nospace = key.replace(/\s+/g, '');
  if (CHANNEL_DB[nospace]) return CHANNEL_DB[nospace];
  
  return null;
}

// ============================================================
// PARSE HLS PLAYLIST
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
// FILTRO H.264 (FONDAMENTALE per schermo grigio!)
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
    const proxiedMapUri = `/seg?url=${encodeURIComponent(absoluteMapUri)}&init=1`;
    output += `#EXT-X-MAP:URI="${proxiedMapUri}"`;
    if (map.BYTERANGE) output += `,BYTERANGE="${map.BYTERANGE}"`;
    output += '\n';
  }
  
  for (const seg of selectedSegments) {
    if (seg.hasDiscontinuity) {
      output += '#EXT-X-DISCONTINUITY\n';
    }
    output += `#EXTINF:${seg.duration.toFixed(3)},\n`;
    const absoluteSegUri = resolveUri(seg.uri, baseUrl);
    output += `/seg?url=${encodeURIComponent(absoluteSegUri)}\n`;
  }
  
  output += '#EXT-X-ENDLIST\n';
  
  return output;
}

function resolveUri(uri, base) {
  if (!uri) return '';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  try {
    return new URL(uri, base).toString();
  } catch {
    return uri;
  }
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
      
      return new Response('TVNOW-CF v9.1 Ultimate - Usa: /live?ch=nome_canale', {
        headers: { 'Content-Type': 'text/plain' }
      });
      
    } catch (err) {
      return new Response(`ERRORE: ${err.message}`, { 
        status: 500, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }
  }
};

// ============================================================
// HANDLER: /live
// ============================================================
async function handleLive(url) {
  const chParam = url.searchParams.get('ch') || '';
  const providerParam = url.searchParams.get('p') || 'ntv,vavoo,daddy';
  const fastMode = url.searchParams.get('fast') !== '0';
  const forceH264 = url.searchParams.get('force_h264') === '1';
  const variantIndex = parseInt(url.searchParams.get('variant') || '-1');
  const safeMode = url.searchParams.get('safe') === '1';
  const forceRefresh = url.searchParams.get('refresh') === '1';
  
  if (!chParam) {
    return new Response('Specificare un canale: /live?ch=rai1 o /live?ch=577', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  const channel = resolveChannel(chParam);
  if (!channel) {
    return new Response(`Canale "${chParam}" non trovato. Prova con ID numerico o nome completo.`, {
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
      
      // 🔄 Auto-refresh sessione ogni 25 minuti (Anti-interruzione 30min!)
      if (forceRefresh || (now - session.createdAt) > CONFIG.SESSION_REFRESH_INTERVAL) {
        sessionStore.delete(getSessionKey(provider, channelId));
        const fresh = getOrCreateSession(provider, channelId);
        Object.assign(session, fresh);
      }
      
      // ⭐ Risolvi URL con i resolver collaudati
      const masterUrl = await resolveChannelUrl(provider, channelId, session, forceRefresh);
      
      if (!masterUrl) {
        lastError = `${provider}: URL non risolto`;
        continue;
      }
      
      const masterResp = await fetchWithAntiBlock(masterUrl, session, { cacheTtl: 0, timeout: 3000 });
      
      if (!masterResp.ok) {
        // Se fallisce, forza refresh URL e riprova una volta
        session.resolvedUrl = null;
        const masterUrl2 = await resolveChannelUrl(provider, channelId, session, true);
        const masterResp2 = await fetchWithAntiBlock(masterUrl2, session, { cacheTtl: 0, timeout: 3000 });
        
        if (!masterResp2.ok) {
          lastError = `${provider}: HTTP ${masterResp2.status}`;
          continue;
        }
      }
      
      const masterContent = await (masterResp.ok ? masterResp.text() : (async () => {
        const r = await fetchWithAntiBlock(await resolveChannelUrl(provider, channelId, session, true), session, { cacheTtl: 0 });
        return r.text();
      })());
      
      const parsed = parseHlsPlaylist(masterContent);
      
      // Caso 1: è già una media playlist
      if (!parsed.isMaster && parsed.segments.length > 0) {
        const optimized = buildOptimizedMediaPlaylist(parsed, masterUrl, fastMode && !safeMode);
        if (optimized) {
          return new Response(optimized, {
            headers: {
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Access-Control-Allow-Origin': '*',
              'X-Provider': provider,
              'X-Session-Age': `${now - session.createdAt}s`
            }
          });
        }
      }
      
      // Caso 2: è una master playlist
      if (parsed.isMaster && parsed.variants.length > 0) {
        if (url.searchParams.get('list_variants') === '1') {
          const list = parsed.variants.map((v, i) => 
            `[${i}] ${v.RESOLUTION || '?'} | ${v.CODECS || '?'} | ${v.BANDWIDTH ? (v.BANDWIDTH/1000).toFixed(0)+'kbps' : ''}`
          ).join('\n');
          return new Response(`Varianti ${provider}:\n${list}`, {
            headers: { 'Content-Type': 'text/plain' }
          });
        }
        
        const filtered = filterVariants(parsed.variants, forceH264, variantIndex);
        
        if (filtered.length === 0) {
          lastError = `${provider}: nessuna variante H.264`;
          continue;
        }
        
        const selected = variantIndex >= 0 ? filtered[0] : selectBestVariant(filtered);
        const mediaUrl = resolveUri(selected.uri, masterUrl);
        
        const mediaSession = getOrCreateSession(provider, channelId + ':media');
        const mediaResp = await fetchWithAntiBlock(mediaUrl, mediaSession, { 
          cacheTtl: 0, referer: masterUrl, timeout: 3000 
        });
        
        if (!mediaResp.ok) {
          lastError = `${provider}: media HTTP ${mediaResp.status}`;
          continue;
        }
        
        const mediaContent = await mediaResp.text();
        const parsedMedia = parseHlsPlaylist(mediaContent);
        
        if (parsedMedia.segments.length === 0) {
          lastError = `${provider}: nessun segmento`;
          continue;
        }
        
        const optimized = buildOptimizedMediaPlaylist(parsedMedia, mediaUrl, fastMode && !safeMode);
        
        if (optimized) {
          return new Response(optimized, {
            headers: {
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Access-Control-Allow-Origin': '*',
              'X-Provider': provider,
              'X-Variant': `${selected.RESOLUTION || '?'} ${selected.CODECS || ''}`,
              'X-Session-Age': `${now - session.createdAt}s`
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
    const provider = detectProviderFromUrl(decodedUrl);
    const session = getOrCreateSession(provider || 'generic', 'segment');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isInit ? 3000 : 2000);
    
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
    
    // ⚠️ Fondamentale: NON copiare Content-Length se Transfer-Encoding: chunked
    if (cl && !te) respHeaders.set('Content-Length', cl);
    
    respHeaders.set('Cache-Control', isInit 
      ? 'no-store, no-cache, must-revalidate' 
      : 'public, max-age=5');
    
    return new Response(resp.body, { status: resp.status, headers: respHeaders });
    
  } catch (err) {
    return new Response(`Errore segmento: ${err.message}`, { status: 502 });
  }
}

function detectProviderFromUrl(url) {
  if (url.includes('ntv.cloud') || url.includes('cfbu247')) return 'ntv';
  if (url.includes('vavoo') || url.includes('geil.to')) return 'vavoo';
  if (url.includes('daddy') || url.includes('daddylive')) return 'daddy';
  return null;
}

// ============================================================
// HANDLER: /analyze
// ============================================================
async function handleAnalyze(url) {
  const ch = url.searchParams.get('ch') || '';
  if (!ch) return new Response('?ch=nome_canale', { status: 400 });
  
  const channel = resolveChannel(ch);
  if (!channel) return new Response('Canale non trovato', { status: 404 });
  
  let report = `=== ANALISI CANALE: ${ch} (v9.1 Ultimate) ===\n\n`;
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
      
      report += `✅ URL risolto: ${resolved.substring(0, 80)}...\n`;
      report += `Tempo resolve: ${t1 - t0}ms\n`;
      report += `UA: ${getUA(session).substring(0, 50)}...\n`;
      
      const t2 = Date.now();
      const resp = await fetchWithAntiBlock(resolved, session, { cacheTtl: 0, timeout: 3000 });
      const t3 = Date.now();
      
      report += `Fetch status: ${resp.status} (${t3 - t2}ms)\n`;
      
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
// HANDLER: /resolve (debug resolver)
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
    `Provider: ${provider}\nCanale: ${ch}\nID: ${channel[provider]}\nURL risolto:\n${resolved}`,
    { headers: { 'Content-Type': 'text/plain' } }
  );
}

// ============================================================
// HANDLER: /diag
// ============================================================
async function handleDiag(url) {
  const ch = url.searchParams.get('ch') || '';
  if (!ch) return new Response('?ch=nome_canale', { status: 400 });
  
  const channel = resolveChannel(ch);
  if (!channel) return new Response('Canale non trovato', { status: 404 });
  
  const results = [];
  
  for (const provider of ['ntv', 'vavoo', 'daddy']) {
    const id = channel[provider];
    if (!id) continue;
    
    try {
      const session = getOrCreateSession(provider, id);
      const t0 = Date.now();
      const resolved = await resolveChannelUrl(provider, id, session, true);
      const resp = await fetchWithAntiBlock(resolved, session, { cacheTtl: 0, timeout: 3000 });
      const t1 = Date.now();
      
      if (resp.ok) {
        const content = await resp.text();
        const parsed = parseHlsPlaylist(content);
        let info = '';
        if (parsed.isMaster) {
          const hasH264 = parsed.variants.some(v => (v.CODECS||'').toLowerCase().includes('avc1'));
          info = `MASTER ${parsed.variants.length}var H264:${hasH264?'SI':'NO'}`;
        } else {
          info = `MEDIA ${parsed.segments.length}seg`;
        }
        results.push(`${provider.toUpperCase()}: ✅ OK ${t1-t0}ms | ${info}`);
      } else {
        results.push(`${provider.toUpperCase()}: ⚠️ HTTP ${resp.status}`);
      }
    } catch (e) {
      results.push(`${provider.toUpperCase()}: ❌ FAIL (${e.message})`);
    }
  }
  
  return new Response(
    `DIAG v9.1: ${ch}\nRisolto come: ${JSON.stringify(channel)}\n\n${results.join('\n')}`,
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
  
  let report = '';
  
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
  
  let output = `=== CANALI (${total}) - v9.1 Ultimate - pagina ${page + 1} ===\n\n`;
  
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
// HANDLER: /debug
// ============================================================
async function handleDebug() {
  const now = Math.floor(Date.now() / 1000);
  
  let output = `=== TVNOW-CF v9.1 Ultimate ===\n\n`;
  output += `Sessioni attive: ${sessionStore.size}\n`;
  output += `Session refresh: ${CONFIG.SESSION_REFRESH_INTERVAL}s (25min)\n`;
  output += `Extra keyframe: ${CONFIG.EXTRA_KEYFRAME_SEG}\n`;
  output += `Timeout: ${CONFIG.DEFAULT_TIMEOUT}ms\n`;
  output += `EXT-X-START: ${CONFIG.EXT_X_START_OFFSET}s\n\n`;
  
  output += `NTV resolver: ${CONFIG.NTV_RESOLVER_API}\n`;
  output += `Vavoo mirrors: ${CONFIG.VAVOO_MIRRORS.length}\n`;
  output += `Daddy embed: ${CONFIG.DADDY_EMBED_BASE}\n\n`;
  
  output += `=== SESSIONI ===\n`;
  for (const [key, sess] of sessionStore.entries()) {
    const age = now - sess.createdAt;
    const pct = Math.min(100, Math.round((age / CONFIG.SESSION_REFRESH_INTERVAL) * 100));
    const urlAge = sess.resolvedAt ? now - sess.resolvedAt : 'n/a';
    output += `${key} | età:${age}s(${pct}%) | urlEtà:${urlAge}s | fail:${sess.failCount}\n`;
  }
  
  return new Response(output, { headers: { 'Content-Type': 'text/plain' } });
}
