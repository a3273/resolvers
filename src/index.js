// ============================================================
// TVNOW-CF v9.0 Max Stability
// Fix: canali cinema + calcio 251/252/253 | Anti-Block Max | Anti-interruzioni 30min
// ============================================================

const CONFIG = {
  DEFAULT_TIMEOUT: 1500,
  FAST_MODE_DEFAULT: true,
  EXTRA_KEYFRAME_SEG: 2,
  CACHE_RESOLUTIONS_TTL: 20,
  SESSION_REFRESH_INTERVAL: 1500, // 25 minuti in secondi (prima dei 30min di scadenza token)
  EXT_X_START_OFFSET: -3,
  EXT_X_VERSION: 6,
  MAX_RETRIES: 2,
  USER_AGENT_POOL: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
  ]
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
  
  // ===== CALCIO 251 / 252 / 253 (DAZN / Sky Extra) =====
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
// SESSION STORE (per Anti-Block e Auto-Refresh)
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
      lastSuccess: now
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
// ANTI-BLOCK HEADERS GENERATOR
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
  
  // Aggiungi cookie dalla sessione se presenti
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
// CHANNEL RESOLVER
// ============================================================
function resolveChannel(input) {
  if (!input) return null;
  
  const key = input.toLowerCase().trim();
  
  // Cerca nel database
  if (CHANNEL_DB[key]) return CHANNEL_DB[key];
  
  // Cerca per sottostringa
  for (const [name, ids] of Object.entries(CHANNEL_DB)) {
    if (name.includes(key) || key.includes(name)) return ids;
  }
  
  // Fallback: se è puro numero, usalo direttamente come ID
  if (/^\d+$/.test(key)) {
    return { ntv: key, vavoo: key, daddy: key, direct: true };
  }
  
  // Rimuovi spazi e riprova
  const nospace = key.replace(/\s+/g, '');
  if (CHANNEL_DB[nospace]) return CHANNEL_DB[nospace];
  
  return null;
}

// ============================================================
// PROVIDER URL BUILDERS
// ============================================================
function buildProviderUrl(provider, channelId, isMaster = true) {
  const id = encodeURIComponent(channelId);
  
  switch (provider) {
    case 'ntv':
      return isMaster 
        ? `https://tv.ntv.cloud/live/${id}/master.m3u8`
        : null;
    case 'vavoo':
      return isMaster
        ? `https://live.vavoo.to/hls/${id}/master.m3u8`
        : null;
    case 'daddy':
      return isMaster
        ? `https://cdn.daddylive.live/hls/${id}/master.m3u8`
        : null;
    default:
      return null;
  }
}

// ============================================================
// FETCH CON ANTI-BLOCK E RETRY
// ============================================================
async function fetchWithAntiBlock(url, session, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.DEFAULT_TIMEOUT);
  
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
    
    // Rotazione UA per prossimo tentativo
    rotateUA(session);
    
    if (session.failCount <= CONFIG.MAX_RETRIES) {
      // Nuovo tentativo con UA diverso
      const headers2 = buildAntiBlockHeaders(session, options.referer);
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), CONFIG.DEFAULT_TIMEOUT);
      
      try {
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
    discontinuitySequence: 0
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
      // Variante nella master playlist
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
  
  delete result._nextHasDiscontinuity;
  return result;
}

function parseAttributes(attrStr) {
  const result = {};
  // Regex per catturare KEY=VALUE o KEY="VALUE"
  const regex = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]+))/g;
  let match;
  while ((match = regex.exec(attrStr)) !== null) {
    result[match[1]] = match[2] !== undefined ? match[2] : match[3];
  }
  return result;
}

// ============================================================
// PROCESS MASTER PLAYLIST - FILTRO H.264
// ============================================================
function filterVariants(variants, forceH264 = false, variantIndex = -1) {
  if (variantIndex >= 0 && variantIndex < variants.length) {
    return [variants[variantIndex]];
  }
  
  if (!forceH264) return variants;
  
  // Filtra solo varianti H.264
  const h264Variants = variants.filter(v => {
    const codecs = (v.CODECS || '').toLowerCase();
    return codecs.includes('avc1') || !codecs.includes('hvc1') && !codecs.includes('hev1');
  });
  
  return h264Variants.length > 0 ? h264Variants : variants;
}

// ============================================================
// PROCESS MEDIA PLAYLIST - FINESTRA OTTIMIZZATA
// ============================================================
function buildOptimizedMediaPlaylist(parsed, baseUrl, fastMode = true) {
  const { segments, targetDuration, mediaSequence, version, map, discontinuitySequence } = parsed;
  
  if (segments.length === 0) return null;
  
  // Calcola indice di inizio: dalla fine, abbastanza indietro per keyframe
  let startIdx;
  
  if (fastMode) {
    // Fast mode: inizia da 2 segmenti extra + cerca discontinuità
    startIdx = Math.max(0, segments.length - 4 - CONFIG.EXTRA_KEYFRAME_SEG);
    
    // Se il segmento di inizio ha una discontinuità prima, sposta ancora indietro
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
  
  // Calcola TIME-OFFSET per EXT-X-START
  const totalBackDuration = selectedSegments.slice(0, -1).reduce((sum, s) => sum + s.duration, 0);
  const startOffset = Math.max(CONFIG.EXT_X_START_OFFSET, -totalBackDuration);
  
  // Costruisci playlist
  let output = '#EXTM3U\n';
  output += `#EXT-X-VERSION:${Math.max(version, CONFIG.EXT_X_VERSION)}\n`;
  output += `#EXT-X-TARGETDURATION:${Math.ceil(targetDuration)}\n`;
  output += `#EXT-X-MEDIA-SEQUENCE:${newMediaSequence}\n`;
  output += `#EXT-X-DISCONTINUITY-SEQUENCE:${discontinuitySequence}\n`;
  output += `#EXT-X-START:TIME-OFFSET=${startOffset},PRECISE=NO\n`;
  
  // EXT-X-MAP subito dopo gli header (fondamentale per fMP4)
  if (map) {
    const mapUri = map.URI || map.uri || '';
    const absoluteMapUri = resolveUri(mapUri, baseUrl);
    const proxiedMapUri = `/seg?url=${encodeURIComponent(absoluteMapUri)}&init=1`;
    output += `#EXT-X-MAP:URI="${proxiedMapUri}"`;
    if (map.BYTERANGE) output += `,BYTERANGE="${map.BYTERANGE}"`;
    output += '\n';
  }
  
  // Segmenti
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
      // ===== /live - Endpoint principale streaming =====
      if (path === '/live' || path === '/') {
        return handleLive(url, request);
      }
      
      // ===== /seg - Proxy segmenti =====
      if (path === '/seg') {
        return handleSegment(url, request);
      }
      
      // ===== /analyze - Diagnostica canale =====
      if (path === '/analyze') {
        return handleAnalyze(url);
      }
      
      // ===== /diag - Diagnostica rapida =====
      if (path === '/diag') {
        return handleDiag(url);
      }
      
      // ===== /checkseg - Check segmenti =====
      if (path === '/checkseg') {
        return handleCheckSeg(url);
      }
      
      // ===== /vmap - Varianti disponibili =====
      if (path === '/vmap') {
        return handleVariants(url);
      }
      
      // ===== /ch - Lista canali =====
      if (path === '/ch') {
        return handleChannelList(url);
      }
      
      // ===== /debug - Info sistema =====
      if (path === '/debug') {
        return handleDebug();
      }
      
      return new Response('TVNOW-CF v9.0 Max Stability - Endpoint: /live?ch=nome_canale', {
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
async function handleLive(url, originalRequest) {
  const chParam = url.searchParams.get('ch') || '';
  const providerParam = url.searchParams.get('p') || 'ntv,vavoo,daddy';
  const fastMode = url.searchParams.get('fast') !== '0';
  const forceH264 = url.searchParams.get('force_h264') === '1';
  const variantIndex = parseInt(url.searchParams.get('variant') || '-1');
  const safeMode = url.searchParams.get('safe') === '1';
  
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
  
  // Prova ogni provider in ordine
  let lastError = null;
  
  for (const provider of providers) {
    const channelId = channel[provider];
    if (!channelId) continue;
    
    try {
      const session = getOrCreateSession(provider, channelId);
      const masterUrl = buildProviderUrl(provider, channelId, true);
      
      if (!masterUrl) continue;
      
      // Forza refresh sessione se è scaduto il tempo (Anti-interruzione 30min)
      const now = Math.floor(Date.now() / 1000);
      if ((now - session.createdAt) > CONFIG.SESSION_REFRESH_INTERVAL) {
        sessionStore.delete(getSessionKey(provider, channelId));
        getOrCreateSession(provider, channelId); // Crea nuova sessione fresca
      }
      
      const masterResp = await fetchWithAntiBlock(masterUrl, session, { cacheTtl: 0 });
      
      if (!masterResp.ok) {
        lastError = `Provider ${provider}: HTTP ${masterResp.status}`;
        continue;
      }
      
      const masterContent = await masterResp.text();
      const parsed = parseHlsPlaylist(masterContent);
      
      // Se è una media playlist direttamente
      if (!parsed.isMaster && parsed.segments.length > 0) {
        const optimized = buildOptimizedMediaPlaylist(parsed, masterUrl, fastMode && !safeMode);
        if (optimized) {
          return new Response(optimized, {
            headers: {
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }
      
      // Se è una master playlist
      if (parsed.isMaster && parsed.variants.length > 0) {
        // Se richiesto lista varianti
        if (url.searchParams.get('list_variants') === '1') {
          const list = parsed.variants.map((v, i) => 
            `[${i}] ${v.RESOLUTION || '?'} | ${v.CODECS || '?'} | ${v.BANDWIDTH ? (v.BANDWIDTH/1000).toFixed(0)+'kbps' : '?'}`
          ).join('\n');
          return new Response(`Varianti per ${chParam} (${provider}):\n${list}`, {
            headers: { 'Content-Type': 'text/plain' }
          });
        }
        
        const filtered = filterVariants(parsed.variants, forceH264, variantIndex);
        
        if (filtered.length === 0) {
          lastError = `Nessuna variante H.264 disponibile su ${provider}`;
          continue;
        }
        
        // Seleziona la variante migliore o quella specificata
        const selected = variantIndex >= 0 ? filtered[0] : selectBestVariant(filtered);
        
        // Ottieni la media playlist
        const mediaUrl = resolveUri(selected.uri, masterUrl);
        const mediaSession = getOrCreateSession(provider, channelId + ':media');
        const mediaResp = await fetchWithAntiBlock(mediaUrl, mediaSession, { 
          cacheTtl: 0, 
          referer: masterUrl 
        });
        
        if (!mediaResp.ok) {
          lastError = `Media playlist ${provider}: HTTP ${mediaResp.status}`;
          continue;
        }
        
        const mediaContent = await mediaResp.text();
        const parsedMedia = parseHlsPlaylist(mediaContent);
        
        if (parsedMedia.segments.length === 0) {
          lastError = `Nessun segmento su ${provider}`;
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
              'X-Variant': `${selected.RESOLUTION || '?'} ${selected.CODECS || ''}`
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

function selectBestVariant(variants) {
  // Preferisce 720p H.264, altrimenti la prima disponibile
  const scored = variants.map((v, i) => {
    let score = 0;
    const codecs = (v.CODECS || '').toLowerCase();
    const res = v.RESOLUTION || '';
    
    if (codecs.includes('avc1')) score += 100; // H.264
    if (codecs.includes('hvc1') || codecs.includes('hev1')) score -= 50; // HEVC
    
    if (res.includes('1280x720') || res.includes('720')) score += 50;
    if (res.includes('1920x1080') || res.includes('1080')) score += 30;
    if (res.includes('854x480') || res.includes('480')) score += 20;
    
    return { v, score, i };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored[0].v;
}

// ============================================================
// HANDLER: /seg - Proxy segmenti
// ============================================================
async function handleSegment(url, originalRequest) {
  const segUrl = url.searchParams.get('url');
  const isInit = url.searchParams.get('init') === '1';
  
  if (!segUrl) {
    return new Response('URL segmento mancante', { status: 400 });
  }
  
  try {
    const decodedUrl = decodeURIComponent(segUrl);
    
    // Estrai provider dal dominio per la sessione
    const provider = detectProviderFromUrl(decodedUrl);
    const session = getOrCreateSession(provider || 'generic', 'segment');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isInit ? 3000 : 2000);
    
    const headers = buildAntiBlockHeaders(session);
    // Per init segment: bypass assoluto cache
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
    
    // Costruisci headers di risposta - NON copiare ciecamente Content-Length se chunked
    const respHeaders = new Headers();
    const contentType = resp.headers.get('content-type') || 'video/mp2t';
    respHeaders.set('Content-Type', contentType);
    respHeaders.set('Access-Control-Allow-Origin', '*');
    
    const cl = resp.headers.get('content-length');
    const te = resp.headers.get('transfer-encoding');
    
    // Fondamentale: non copiare Content-Length se c'è Transfer-Encoding chunked
    if (cl && !te) {
      respHeaders.set('Content-Length', cl);
    }
    
    if (isInit) {
      respHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else {
      respHeaders.set('Cache-Control', 'public, max-age=5');
    }
    
    return new Response(resp.body, {
      status: resp.status,
      headers: respHeaders
    });
    
  } catch (err) {
    return new Response(`Errore segmento: ${err.message}`, { status: 502 });
  }
}

function detectProviderFromUrl(url) {
  if (url.includes('ntv.cloud')) return 'ntv';
  if (url.includes('vavoo.to')) return 'vavoo';
  if (url.includes('daddylive')) return 'daddy';
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
  
  let report = `=== ANALISI CANALE: ${ch} ===\n\n`;
  report += `Mapping trovato: ${JSON.stringify(channel, null, 2)}\n\n`;
  
  for (const provider of ['ntv', 'vavoo', 'daddy']) {
    const id = channel[provider];
    if (!id) continue;
    
    report += `--- PROVIDER: ${provider.toUpperCase()} (ID: ${id}) ---\n`;
    
    try {
      const session = getOrCreateSession(provider, id);
      const masterUrl = buildProviderUrl(provider, id, true);
      report += `URL: ${masterUrl}\n`;
      
      const t0 = Date.now();
      const resp = await fetchWithAntiBlock(masterUrl, session, { cacheTtl: 0 });
      const t1 = Date.now();
      
      report += `Status: ${resp.status} ${resp.statusText}\n`;
      report += `Tempo risposta: ${t1 - t0}ms\n`;
      report += `UA usato: ${getUA(session).substring(0, 60)}...\n`;
      
      if (resp.ok) {
        const content = await resp.text();
        const parsed = parseHlsPlaylist(content);
        
        if (parsed.isMaster) {
          report += `Tipo: MASTER PLAYLIST\n`;
          report += `Varianti trovate: ${parsed.variants.length}\n`;
          parsed.variants.forEach((v, i) => {
            const isH264 = (v.CODECS || '').toLowerCase().includes('avc1');
            const isHEVC = (v.CODECS || '').toLowerCase().includes('hvc1') || 
                          (v.CODECS || '').toLowerCase().includes('hev1');
            report += `  [${i}] ${v.RESOLUTION || '?'} | ${v.CODECS || '?'} | ${(v.BANDWIDTH/1000).toFixed(0)}kbps`;
            report += isH264 ? ' [H.264 OK]' : isHEVC ? ' [HEVC - rischio schermo grigio]' : '';
            report += '\n';
          });
          
          // Prova a caricare la prima variante
          if (parsed.variants.length > 0) {
            const mediaUrl = resolveUri(parsed.variants[0].uri, masterUrl);
            report += `\n  Media playlist URL: ${mediaUrl.substring(0, 80)}...\n`;
            
            try {
              const mediaSession = getOrCreateSession(provider, id + ':media');
              const mediaResp = await fetchWithAntiBlock(mediaUrl, mediaSession, { cacheTtl: 0 });
              if (mediaResp.ok) {
                const mediaContent = await mediaResp.text();
                const mediaParsed = parseHlsPlaylist(mediaContent);
                report += `  Segmenti: ${mediaParsed.segments.length}\n`;
                report += `  TargetDuration: ${mediaParsed.targetDuration}s\n`;
                report += `  MediaSequence: ${mediaParsed.mediaSequence}\n`;
                report += `  Ha MAP (fMP4): ${mediaParsed.map ? 'SI' : 'NO'}\n`;
                if (mediaParsed.map) {
                  report += `    MAP URI: ${mediaParsed.map.URI || mediaParsed.map.uri}\n`;
                }
                if (mediaParsed.segments.length > 0) {
                  report += `  Primo segmento durata: ${mediaParsed.segments[0].duration}s\n`;
                  report += `  Primo segmento ha DISCONTINUITY prima: ${mediaParsed.segments[0].hasDiscontinuity ? 'SI' : 'NO'}\n`;
                }
              }
            } catch (e) {
              report += `  Errore media playlist: ${e.message}\n`;
            }
          }
        } else {
          report += `Tipo: MEDIA PLAYLIST\n`;
          report += `Segmenti: ${parsed.segments.length}\n`;
          report += `TargetDuration: ${parsed.targetDuration}s\n`;
          report += `Ha MAP: ${parsed.map ? 'SI' : 'NO'}\n`;
        }
      }
    } catch (err) {
      report += `ERRORE: ${err.message}\n`;
    }
    report += '\n';
  }
  
  return new Response(report, { headers: { 'Content-Type': 'text/plain' } });
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
      const masterUrl = buildProviderUrl(provider, id, true);
      const t0 = Date.now();
      const resp = await fetchWithAntiBlock(masterUrl, session, { cacheTtl: 0 });
      const t1 = Date.now();
      
      if (resp.ok) {
        const content = await resp.text();
        const parsed = parseHlsPlaylist(content);
        
        let variantInfo = '';
        if (parsed.isMaster && parsed.variants.length > 0) {
          const hasH264 = parsed.variants.some(v => 
            (v.CODECS || '').toLowerCase().includes('avc1')
          );
          const hasHEVC = parsed.variants.some(v => {
            const c = (v.CODECS || '').toLowerCase();
            return c.includes('hvc1') || c.includes('hev1');
          });
          variantInfo = `|varianti:${parsed.variants.length}|H264:${hasH264 ? 'SI' : 'NO'}|HEVC:${hasHEVC ? 'SI' : 'NO'}`;
        }
        
        results.push(`${provider.toUpperCase()}: OK ${t1-t0}ms ${variantInfo}`);
      } else {
        results.push(`${provider.toUpperCase()}: HTTP ${resp.status}`);
      }
    } catch (e) {
      results.push(`${provider.toUpperCase()}: FAIL (${e.message})`);
    }
  }
  
  return new Response(
    `DIAG: ${ch}\n` + 
    `Risolto come: ${JSON.stringify(channel)}\n\n` +
    results.join('\n'),
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
  
  const session = getOrCreateSession(source, ch);
  const masterUrl = buildProviderUrl(source, ch, true);
  
  try {
    const resp = await fetchWithAntiBlock(masterUrl, session, { cacheTtl: 0 });
    const content = await resp.text();
    const parsed = parseHlsPlaylist(content);
    
    let mediaUrl = masterUrl;
    if (parsed.isMaster && parsed.variants.length > 0) {
      mediaUrl = resolveUri(parsed.variants[0].uri, masterUrl);
      const mediaResp = await fetchWithAntiBlock(mediaUrl, session, { cacheTtl: 0 });
      const mediaContent = await mediaResp.text();
      return analyzeSegments(mediaContent, mediaUrl);
    }
    
    return analyzeSegments(content, mediaUrl);
  } catch (e) {
    return new Response(`Errore: ${e.message}`, { status: 500 });
  }
}

function analyzeSegments(content, baseUrl) {
  const parsed = parseHlsPlaylist(content);
  let report = `Segmenti totali: ${parsed.segments.length}\n`;
  report += `TargetDuration: ${parsed.targetDuration}s\n`;
  report += `MediaSequence: ${parsed.mediaSequence}\n`;
  report += `Ha MAP: ${parsed.map ? 'SI - ' + (parsed.map.URI || parsed.map.uri) : 'NO'}\n\n`;
  
  parsed.segments.forEach((s, i) => {
    const abs = resolveUri(s.uri, baseUrl);
    report += `[${i}] dur:${s.duration.toFixed(2)}s disc:${s.hasDiscontinuity ? 'SI' : 'NO'} ${abs.substring(0, 60)}...\n`;
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
      const masterUrl = buildProviderUrl(provider, id, true);
      const resp = await fetchWithAntiBlock(masterUrl, session, { cacheTtl: 0 });
      
      if (resp.ok) {
        const content = await resp.text();
        const parsed = parseHlsPlaylist(content);
        
        if (parsed.isMaster) {
          parsed.variants.forEach((v, i) => {
            report += `[${i}] RES=${v.RESOLUTION || '?'} CODECS=${v.CODECS || '?'} BW=${v.BANDWIDTH ? (v.BANDWIDTH/1000).toFixed(0)+'kbps' : '?'}\n`;
          });
        } else {
          report += '(è direttamente una media playlist)\n';
        }
      } else {
        report += `HTTP ${resp.status}\n`;
      }
    } catch (e) {
      report += `ERRORE: ${e.message}\n`;
    }
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
  if (search) {
    channels = channels.filter(c => c.includes(search));
  }
  
  const total = channels.length;
  const paged = channels.slice(page * pageSize, (page + 1) * pageSize);
  
  let output = `=== CANALI DISPONIBILI (${total}) - pagina ${page + 1} ===\n\n`;
  
  for (const name of paged) {
    const ids = CHANNEL_DB[name];
    output += `${name.padEnd(25)} ntv:${ids.ntv || '-'} vavoo:${ids.vavoo || '-'} daddy:${ids.daddy || '-'}\n`;
  }
  
  if ((page + 1) * pageSize < total) {
    output += `\n... e altri ${total - (page + 1) * pageSize} canali. Usa ?page=${page + 1} per proseguire o ?q=ricerca per filtrare.`;
  }
  
  output += `\n\nSuggerimenti:\n`;
  output += `/ch?q=cinema → filtra canali cinema\n`;
  output += `/ch?q=sport → filtra canali sport\n`;
  output += `/ch?q=rai → filtra canali RAI\n`;
  
  return new Response(output, { headers: { 'Content-Type': 'text/plain' } });
}

// ============================================================
// HANDLER: /debug
// ============================================================
async function handleDebug() {
  const activeSessions = sessionStore.size;
  const now = Math.floor(Date.now() / 1000);
  
  let output = `=== TVNOW-CF v9.0 Max Stability ===\n\n`;
  output += `Sessioni attive: ${activeSessions}\n`;
  output += `UA pool size: ${CONFIG.USER_AGENT_POOL.length}\n`;
  output += `Session refresh interval: ${CONFIG.SESSION_REFRESH_INTERVAL}s (25min)\n`;
  output += `Extra keyframe segments: ${CONFIG.EXTRA_KEYFRAME_SEG}\n`;
  output += `Timeout: ${CONFIG.DEFAULT_TIMEOUT}ms\n`;
  output += `Cache resolutions TTL: ${CONFIG.CACHE_RESOLUTIONS_TTL}s\n`;
  output += `EXT-X-START offset: ${CONFIG.EXT_X_START_OFFSET}s\n`;
  output += `EXT-X-VERSION: ${CONFIG.EXT_X_VERSION}\n\n`;
  
  output += `=== SESSIONI ===\n`;
  for (const [key, sess] of sessionStore.entries()) {
    const age = now - sess.createdAt;
    const pct = Math.min(100, Math.round((age / CONFIG.SESSION_REFRESH_INTERVAL) * 100));
    output += `${key} | età:${age}s (${pct}% vita) | fail:${sess.failCount} | UA idx:${sess.uaIndex}\n`;
  }
  
  return new Response(output, { headers: { 'Content-Type': 'text/plain' } });
}
