// ============================================================
// TVNOW-CF v9.1 Ultimate - Debug Fix
// ============================================================

const CONFIG = {
  VERSION: 'TVNOW-CF v9.1 Ultimate',
  DEFAULT_TIMEOUT: 5000,
  MAX_RETRIES: 2,
  SESSION_REFRESH_INTERVAL: 1500,
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
  NTV_API: 'https://chat.cfbu247.sbs/api/resolve-dlstream/',
  VAVOO_MIRRORS: ['https://geil.to','https://geil.app','https://geil.win','https://vavoo.to','https://kool.to','https://vavoo.net'],
  DADDY_DOMAINS: ['https://thedaddy.li','https://daddylivetv.sbs'],
  FEATURES: [
    'Session Management',
    'UA Rotation',
    'Cookie Persistence',
    'Anti-Block Retry',
    'HLS Parser',
    'H.264 Filter',
    'Best Variant Selector',
    'Keyframe Search',
    'EXT-X-MAP Support',
    'Discontinuity Handling',
    'Auto-Refresh 25min',
    'Multi-Provider Fallback',
    'Segment Proxy',
    'Cache Control',
    'Debug Endpoints'
  ]
};

const CHANNEL_DB = {
  'sky sport f1': { ntv: '577', vavoo: '4246774056', daddy: '577' },
  'sky sport tennis': { ntv: '576', vavoo: '2100771782', daddy: '576' },
  'sky sport calcio': { ntv: '870', vavoo: '1665920101', daddy: '870' },
  'sky sport arena': { ntv: '462', vavoo: '3007400791', daddy: '462' },
  'sky sport uno': { ntv: '461', vavoo: '210669162', daddy: '461' },
  'sky sport max': { ntv: '460', vavoo: '2066326916', daddy: '460' },
  'sky sport 24': { ntv: '869', vavoo: '2775802255', daddy: '869' },
  'sky sport motogp': { ntv: '575', vavoo: '3036316886', daddy: '575' },
  'sky sport basket': { ntv: '875', vavoo: '2711959620', daddy: '875' },
  'sky sport golf': { ntv: '574', vavoo: '729945219', daddy: '574' },
  'sky sport serie a': { ntv: '', vavoo: '2077387085', daddy: '880' },
  'dazn 1': { ntv: '877', vavoo: '1376440573', daddy: '877' },
  'eurosport 1': { ntv: '878', vavoo: '3481346857', daddy: '878' },
  'eurosport 2': { ntv: '879', vavoo: '2283887097', daddy: '879' },
  'rsi la 1': { ntv: '2455610203', vavoo: '2455610203', daddy: '' },
  'rsi la 2': { ntv: '3590183307', vavoo: '3475299702', daddy: '' },
  'sky calcio 251': { ntv: '871', vavoo: '', daddy: '871' },
  'sky calcio 252': { ntv: '872', vavoo: '', daddy: '872' },
  'sky calcio 253': { ntv: '873', vavoo: '', daddy: '873' },
  'sky cinema uno': { ntv: '860', vavoo: '2872151911', daddy: '860' },
  'sky cinema action': { ntv: '861', vavoo: '3812796171', daddy: '861' },
  'sky cinema comedy': { ntv: '862', vavoo: '500203271', daddy: '862' },
  'sky cinema collection': { ntv: '859', vavoo: '3525837057', daddy: '859' },
  'sky cinema romance': { ntv: '864', vavoo: '2890008905', daddy: '864' },
  'sky cinema family': { ntv: '865', vavoo: '415795144', daddy: '865' },
  'sky cinema drama': { ntv: '867', vavoo: '', daddy: '867' },
  'sky cinema suspense': { ntv: '868', vavoo: '1820997555', daddy: '868' },
  'sky crime': { ntv: '863', vavoo: '', daddy: '863' },
  'sky serie': { ntv: '880', vavoo: '836680112', daddy: '880' }
};

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
    headers['Cookie'] = Array.from(session.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
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

async function resolveNtv(channelId, session) {
  const apiUrl = `${CONFIG.NTV_API}${channelId}`;
  const resp = await fetchWithAntiBlock(apiUrl, session, { timeout: 8000, referer: 'https://tvnow247.today/' });
  if (!resp.ok) throw new Error(`NTV API HTTP ${resp.status}`);
  const json = await resp.json().catch(() => null);
  const m3u8 = json && (json.m3u8 || json.proxyPlaylistUrl || json.proxyPlayerUrl);
  if (!m3u8) throw new Error('NTV: nessun m3u8');
  return m3u8;
}

async function resolveVavoo(channelId, session) {
  for (const base of CONFIG.VAVOO_MIRRORS) {
    try {
      const play = `${base}/live/play/${channelId}`;
      const resp1 = await fetchWithAntiBlock(`${base}/live/resolve?url=${encodeURIComponent(play)}`, session, { timeout: 5000, referer: `${base}/` });
      if (resp1.ok) {
        const json = await resp1.json().catch(() => null);
        if (json && json.url) return json.url;
      }
      const resp2 = await fetchWithAntiBlock(`${base}/mediahubmx-resolve.json`, session, {
        timeout: 5000,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': base, 'Referer': `${base}/` },
        body: JSON.stringify({ language: 'de', region: 'DE', url: play, clientVersion: '3.0.2' })
      });
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
      const resp = await fetchWithAntiBlock(embedUrl, session, { timeout: 5000, referer: `${domain}/` });
      if (resp.ok) {
        const html = await resp.text();
        let m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m3u8) return m3u8[1];
        const iframe = html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
        if (iframe) {
          const resp2 = await fetchWithAntiBlock(iframe[1], session, { timeout: 5000, referer: embedUrl });
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

function resolveChannel(input) {
  if (!input) return null;
  const key = input.toLowerCase().trim();
  if (CHANNEL_DB[key]) return CHANNEL_DB[key];
  for (const [name, ids] of Object.entries(CHANNEL_DB)) {
    if (name.includes(key) || key.includes(name)) return ids;
  }
  if (/^\d+$/.test(key)) return { ntv: key, vavoo: key, daddy: key };
  return null;
}

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
    if (line.startsWith('#EXT-X-VERSION:')) result.version = parseInt(line.split(':')[1]) || 3;
    else if (line.startsWith('#EXT-X-TARGETDURATION:')) result.targetDuration = parseFloat(line.split(':')[1]) || 0;
    else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) result.mediaSequence = parseInt(line.split(':')[1]) || 0;
    else if (line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE:')) result.discontinuitySequence = parseInt(line.split(':')[1]) || 0;
    else if (line.startsWith('#EXT-X-STREAM-INF:')) {
      result.isMaster = true;
      const attrs = parseAttributes(line.split(':')[1]);
      const uri = lines[i + 1] && !lines[i + 1].startsWith('#') ? lines[i + 1] : '';
      result.variants.push({ ...attrs, uri });
      if (uri) i++;
    } else if (line.startsWith('#EXT-X-MAP:')) result.map = parseAttributes(line.split(':')[1]);
    else if (line.startsWith('#EXT-X-START:')) result.start = parseAttributes(line.split(':')[1]);
    else if (line.startsWith('#EXTINF:')) {
      const duration = parseFloat(line.split(':')[1].split(',')[0]) || 0;
      const uri = lines[i + 1] && !lines[i + 1].startsWith('#') ? lines[i + 1] : '';
      result.segments.push({ duration, uri, hasDiscontinuity: result._nextHasDiscontinuity });
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

function filterVariants(variants, forceH264 = false, variantIndex = -1) {
  if (variantIndex >= 0 && variantIndex < variants.length) return [variants[variantIndex]];
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
    return { v, score, i };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].v;
}

function buildOptimizedMediaPlaylist(parsed, baseUrl, fastMode = true) {
  const { segments, targetDuration, mediaSequence, version, map, discontinuitySequence } = parsed;
  if (segments.length === 0) return null;
  let startIdx = fastMode ? Math.max(0, segments.length - 4 - CONFIG.EXTRA_KEYFRAME_SEG) : Math.max(0, segments.length - 8);
  for (let i = startIdx; i < segments.length && i < startIdx + 3; i++) {
    if (segments[i]?.hasDiscontinuity && i > 0) {
      startIdx = Math.max(0, i - 1);
      break;
    }
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/live' || path === '/') return handleLive(url);
      if (path === '/seg') return handleSegment(url);
      if (path === '/diag') return handleDiag(url);
      if (path === '/debug') return handleDebug();
      if (path === '/features') return handleFeatures();
      return new Response(`${CONFIG.VERSION}\n\nEndpoint: /live?ch=canale\n/debug\n/features`, { headers: { 'Content-Type': 'text/plain' } });
    } catch (err) {
      return new Response(`ERRORE: ${err.message}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  }
};

async function handleLive(url) {
  const chParam = url.searchParams.get('ch') || '';
  const providerParam = url.searchParams.get('p') || 'vavoo,daddy,ntv';
  const fastMode = url.searchParams.get('fast') !== '0';
  const forceH264 = url.searchParams.get('force_h264') === '1';
  const forceRefresh = url.searchParams.get('refresh') === '1';
  if (!chParam) return new Response('Specificare canale: /live?ch=sky-sport-f1', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  const channel = resolveChannel(chParam);
  if (!channel) return new Response(`Canale "${chParam}" non trovato.`, { status: 404, headers: { 'Content-Type': 'text/plain' } });
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
        if (optimized) return new Response(optimized, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Access-Control-Allow-Origin': '*', 'X-Provider': provider, 'X-Version': CONFIG.VERSION } });
      }
      if (parsed.isMaster && parsed.variants.length > 0) {
        const filtered = filterVariants(parsed.variants, forceH264, -1);
        if (filtered.length === 0) { lastError = `${provider}: nessuna variante H.264`; continue; }
        const selected = selectBestVariant(filtered);
        const mediaUrl = resolveUri(selected.uri, masterUrl);
        const mediaSession = getOrCreateSession(provider, channelId + ':media');
        const mediaResp = await fetchWithAntiBlock(mediaUrl, mediaSession, { cacheTtl: 0, referer: masterUrl, timeout: 5000 });
        if (!mediaResp.ok) { lastError = `${provider}: media HTTP ${mediaResp.status}`; continue; }
        const parsedMedia = parseHlsPlaylist(await mediaResp.text());
        if (parsedMedia.segments.length === 0) { lastError = `${provider}: nessun segmento`; continue; }
        const optimized = buildOptimizedMediaPlaylist(parsedMedia, mediaUrl, fastMode);
        if (optimized) return new Response(optimized, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Access-Control-Allow-Origin': '*', 'X-Provider': provider, 'X-Variant': `${selected.RESOLUTION || '?'} ${selected.CODECS || ''}`, 'X-Version': CONFIG.VERSION } });
      }
    } catch (err) {
      lastError = `${provider}: ${err.message}`;
      continue;
    }
  }
  return new Response(`Tutti i provider falliti. Ultimo errore: ${lastError}`, { status: 502, headers: { 'Content-Type': 'text/plain' } });
}

async function handleSegment(url) {
  const segUrl = url.searchParams.get('url');
  const isInit = url.searchParams.get('init') === '1';
  if (!segUrl) return new Response('URL mancante', { status: 400 });
  try {
    const decodedUrl = decodeURIComponent(segUrl);
    const provider = decodedUrl.includes('cfbu247') ? 'ntv' : decodedUrl.includes('geil.to') || decodedUrl.includes('vavoo') ? 'vavoo' : 'daddy';
    const session = getOrCreateSession(provider, 'segment');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isInit ? 3000 : 5000);
    const headers = buildAntiBlockHeaders(session);
    if (isInit) { headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'; headers['Pragma'] = 'no-cache'; }
    const resp = await fetch(decodedUrl, { headers, signal: controller.signal, cf: { cacheTtl: isInit ? 0 : 5, cacheEverything: false } });
    clearTimeout(timeout);
    storeCookiesFromResponse(session, resp);
    const respHeaders = new Headers();
    respHeaders.set('Content-Type', resp.headers.get('content-type') || 'video/mp2t');
    respHeaders.set('Access-Control-Allow-Origin', '*');
    const cl = resp.headers.get('content-length');
    const te = resp.headers.get('transfer-encoding');
    if (cl && !te) respHeaders.set('Content-Length', cl);
    respHeaders.set('Cache-Control', isInit ? 'no-store, no-cache, must-revalidate' : 'public, max-age=5');
    return new Response(resp.body, { status: resp.status, headers: respHeaders });
  } catch (err) {
    return new Response(`Errore segmento: ${err.message}`, { status: 502 });
  }
}

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
        const info = parsed.isMaster ? `MASTER ${parsed.variants.length}var` : `MEDIA ${parsed.segments.length}seg`;
        results.push(`${provider.toUpperCase()}: ✅ OK ${t1-t0}ms | ${info}`);
      } else {
        results.push(`${provider.toUpperCase()}: ⚠️ HTTP ${resp.status}`);
      }
    } catch (e) {
      results.push(`${provider.toUpperCase()}: ❌ FAIL (${e.message})`);
    }
  }
  return new Response(`${CONFIG.VERSION}\n\nDIAG: ${ch}\nRisolto come: ${JSON.stringify(channel)}\n\n${results.join('\n')}`, { headers: { 'Content-Type': 'text/plain' } });
}

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
  output += `  /diag?ch=canale          Diagnostica rapida\n`;
  output += `  /debug                   Questa pagina\n`;
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
