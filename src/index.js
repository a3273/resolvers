// ============================================================================
// TVNOW-CF v11.3 — Worker completo con debug, probe, UI + Daddy ottimizzato
// ============================================================================

const CHANNELS = [
  // 🏆 SKY SPORT
  { slug: 'sky-sport-24', name: 'Sky Sport 24', ntv: 'sky-sport-24', vavoo: '869', daddy: '869' },
  { slug: 'sky-sport-uno', name: 'Sky Sport Uno', ntv: 'sky-sport-uno', vavoo: '461', daddy: '461' },
  { slug: 'sky-sport-calcio', name: 'Sky Sport Calcio', ntv: 'sky-sport-calcio', vavoo: '870', daddy: '870' },
  { slug: 'sky-sport-tennis', name: 'Sky Sport Tennis', ntv: 'sky-sport-tennis', vavoo: '576', daddy: '576' },
  { slug: 'sky-sport-arena', name: 'Sky Sport Arena', ntv: 'sky-sport-arena', vavoo: '462', daddy: '462' },
  { slug: 'sky-sport-basket', name: 'Sky Sport Basket', ntv: 'sky-sport-basket', vavoo: '875', daddy: '875' },
  { slug: 'sky-sport-max', name: 'Sky Sport Max', ntv: 'sky-sport-max', vavoo: '460', daddy: '460' },
  { slug: 'sky-sport-f1', name: 'Sky Sport F1', ntv: 'sky-sport-f1', vavoo: '577', daddy: '577' },
  { slug: 'sky-sport-motogp', name: 'Sky Sport MotoGP', ntv: 'sky-sport-motogp', vavoo: '575', daddy: '575' },
  { slug: 'sky-sport-golf', name: 'Sky Sport Golf', ntv: 'sky-sport-golf', vavoo: '574', daddy: '574' },
  // ⚽ SKY CALCIO
  { slug: 'sky-calcio-251', name: 'Sky Calcio 251', ntv: 'sky-calcio-251', vavoo: '871', daddy: '871' },
  { slug: 'sky-calcio-252', name: 'Sky Calcio 252', ntv: 'sky-calcio-252', vavoo: '872', daddy: '872' },
  { slug: 'sky-calcio-253', name: 'Sky Calcio 253', ntv: 'sky-calcio-253', vavoo: '873', daddy: '873' },
  // 🎾 ALTRO SPORT
  { slug: 'dazn-1', name: 'DAZN 1', ntv: 'dazn-1', vavoo: '877', daddy: '877' },
  { slug: 'eurosport-1', name: 'Eurosport 1', ntv: 'eurosport-1', vavoo: '878', daddy: '878' },
  { slug: 'eurosport-2', name: 'Eurosport 2', ntv: 'eurosport-2', vavoo: '879', daddy: '879' },
  // 🎬 SKY CINEMA
  { slug: 'sky-cinema-uno', name: 'Sky Cinema Uno', ntv: 'sky-cinema-uno', vavoo: '860', daddy: '860' },
  { slug: 'sky-cinema-action', name: 'Sky Cinema Action', ntv: 'sky-cinema-action', vavoo: '861', daddy: '861' },
  { slug: 'sky-cinema-comedy', name: 'Sky Cinema Comedy', ntv: 'sky-cinema-comedy', vavoo: '862', daddy: '862' },
  { slug: 'sky-cinema-collection', name: 'Sky Cinema Collection', ntv: 'sky-cinema-collection', vavoo: '859', daddy: '859' },
  { slug: 'sky-cinema-romance', name: 'Sky Cinema Romance', ntv: 'sky-cinema-romance', vavoo: '864', daddy: '864' },
  { slug: 'sky-cinema-family', name: 'Sky Cinema Family', ntv: 'sky-cinema-family', vavoo: '865', daddy: '865' },
  { slug: 'sky-cinema-drama', name: 'Sky Cinema Drama', ntv: 'sky-cinema-drama', vavoo: '867', daddy: '867' },
  { slug: 'sky-cinema-suspense', name: 'Sky Cinema Suspense', ntv: 'sky-cinema-suspense', vavoo: '868', daddy: '868' },
  { slug: 'sky-cinema-uno-24', name: 'Sky Cinema Uno +24', ntv: 'sky-cinema-uno-24', vavoo: '863', daddy: '863' },
  { slug: 'sky-cinema-due-24', name: 'Sky Cinema Due +24', ntv: 'sky-cinema-due-24', vavoo: '866', daddy: '866' },
  { slug: 'sky-crime', name: 'Sky Crime', ntv: 'sky-crime', vavoo: '881', daddy: '881' }
];

// ============================================================================
// CACHE E STATISTICHE
// ============================================================================

const m3u8Cache = new Map();
const M3U8_TTL = 90 * 1000;

const segCache = new Map();
const SEG_TTL = 60 * 1000;
const MAX_SEG_CACHE = 200;

let totalRequests = 0;
let segRequests = 0;
let m3u8Requests = 0;
let cacheHits = 0;
const deployTime = Date.now();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findCh(query) {
  const q = query.toLowerCase();
  return CHANNELS.find(c =>
    c.slug === q || c.name.toLowerCase() === q ||
    c.ntv === q || c.vavoo === q || c.daddy === q
  );
}

function cleanupSegCache() {
  if (segCache.size > MAX_SEG_CACHE) {
    const entries = Array.from(segCache.entries());
    entries.sort((a, b) => a[1].time - b[1].time);
    for (let i = 0; i < entries.length - MAX_SEG_CACHE; i++) {
      segCache.delete(entries[i][0]);
    }
  }
}

const TXT = () => ({ 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' });
const JSON_H = () => ({ 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
const M3U8 = () => ({ 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'max-age=30', 'access-control-allow-origin': '*' });
const TS = () => ({ 'content-type': 'video/mp2t', 'cache-control': 'max-age=60', 'access-control-allow-origin': '*' });
const HTML = () => ({ 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' });

// ============================================================================
// PROVIDER NTV (placeholder)
// ============================================================================

async function resolveNtv(slug) {
  try {
    console.log(`[NTV] Tentativo per ${slug}`);
    return null;
  } catch (e) { return null; }
}

// ============================================================================
// PROVIDER VAVOO (placeholder)
// ============================================================================

async function resolveVavoo(id) {
  try {
    console.log(`[VAVOO] Tentativo per ID ${id}`);
    return null;
  } catch (e) { return null; }
}

// ============================================================================
// PROVIDER DADDY - Risoluzione m3u8 da thedaddy.li
// ============================================================================

async function resolveDaddyM3u8(channelId) {
  console.log(`[DADDY] Risoluzione m3u8 per ID ${channelId}`);

  const playerUrl = `https://thedaddy.li/cast/stream-${channelId}.php`;
  const playerResp = await fetch(playerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,*/*',
      'Accept-Language': 'it-IT,it;q=0.9'
    },
    redirect: 'follow'
  });
  if (!playerResp.ok) throw new Error(`HTTP ${playerResp.status} thedaddy.li`);
  const playerHtml = await playerResp.text();

  const iframeMatch = playerHtml.match(/<iframe[^>]*src=["']([^"']*dembed\.st[^"']*)["'][^>]*>/i);
  if (!iframeMatch) throw new Error('Iframe dembed.st non trovato');
  let dembedUrl = iframeMatch[1];
  if (dembedUrl.startsWith('//')) dembedUrl = 'https:' + dembedUrl;

  const dembedResp = await fetch(dembedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://thedaddy.li/',
      'Accept': 'text/html,*/*'
    }
  });
  if (!dembedResp.ok) throw new Error(`HTTP ${dembedResp.status} dembed.st`);
  const dembedHtml = await dembedResp.text();

  let m3u8Match = dembedHtml.match(/https?:\/\/edge\.wedd48c\.top\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
  if (!m3u8Match) m3u8Match = dembedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
  if (!m3u8Match) throw new Error('URL m3u8 non trovato');

  const m3u8Url = m3u8Match[0].replace(/\\/g, '').replace(/["']/g, '');
  console.log(`[DADDY] ✅ m3u8: ${m3u8Url.substring(0, 80)}...`);
  return m3u8Url;
}

// ============================================================================
// ENDPOINT /daddy-proxy - m3u8 ottimizzata
// ============================================================================

async function daddyProxy(u, origin) {
  m3u8Requests++;
  const id = u.searchParams.get('id');
  if (!id) return new Response('id mancante', { status: 400, headers: TXT() });

  try {
    const cacheKey = `m3u8_${id}`;
    const cached = m3u8Cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      cacheHits++;
      return new Response(cached.content, { headers: M3U8() });
    }

    const originalM3u8Url = await resolveDaddyM3u8(id);
    const m3u8Resp = await fetch(originalM3u8Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://dembed.st/'
      }
    });
    if (!m3u8Resp.ok) throw new Error(`HTTP ${m3u8Resp.status} m3u8`);
    let m3u8Content = await m3u8Resp.text();

    if (m3u8Content.includes('#EXT-X-STREAM-INF')) {
      const variants = [];
      const lines = m3u8Content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
          variants.push({
            bandwidth: bwMatch ? parseInt(bwMatch[1]) : 0,
            urlLine: (lines[i + 1] || '').trim()
          });
        }
      }
      if (variants.length > 0) {
        variants.sort((a, b) => b.bandwidth - a.bandwidth);
        let subUrl = variants[0].urlLine;
        if (!subUrl.startsWith('http')) {
          subUrl = new URL(subUrl, originalM3u8Url).href;
        }
        const subResp = await fetch(subUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://dembed.st/'
          }
        });
        if (subResp.ok) m3u8Content = await subResp.text();
      }
    }

    m3u8Content = m3u8Content.replace(/#EXT-X-TARGETDURATION:\d+/, '#EXT-X-TARGETDURATION:10');
    if (!m3u8Content.includes('#EXT-X-PLAYLIST-TYPE')) {
      m3u8Content = m3u8Content.replace(/#EXTM3U/, '#EXTM3U\n#EXT-X-PLAYLIST-TYPE:EVENT');
    }

    const lines = m3u8Content.split('\n');
    const rewritten = lines.map(line => {
      if (line.startsWith('#') || line.trim() === '') return line;
      let segmentUrl = line.trim();
      if (!segmentUrl.startsWith('http')) {
        segmentUrl = new URL(segmentUrl, originalM3u8Url).href;
      }
      const cacheSegKey = new URL(segmentUrl).pathname;
      return `${origin}/daddy-seg?u=${encodeURIComponent(segmentUrl)}&k=${encodeURIComponent(cacheSegKey)}&id=${id}`;
    });
    const finalContent = rewritten.join('\n');

    m3u8Cache.set(cacheKey, { content: finalContent, expires: Date.now() + M3U8_TTL });
    console.log(`[DADDY] ✅ m3u8 ottimizzata ID ${id}`);

    return new Response(finalContent, { headers: M3U8() });
  } catch (error) {
    console.error(`[DADDY] Errore:`, error.message);
    return new Response(`Errore: ${error.message}`, { status: 500, headers: TXT() });
  }
}

// ============================================================================
// ENDPOINT /daddy-seg - Proxy segmenti
// ============================================================================

async function daddySeg(u) {
  segRequests++;
  const segmentUrl = u.searchParams.get('u');
  const cacheKey = u.searchParams.get('k') || segmentUrl;
  if (!segmentUrl) return new Response('u mancante', { status: 400, headers: TXT() });

  const cached = segCache.get(cacheKey);
  if (cached && Date.now() - cached.time < SEG_TTL) {
    cacheHits++;
    return new Response(cached.body, { headers: TS() });
  }

  try {
    const segResp = await fetch(segmentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://dembed.st/',
        'Origin': 'https://dembed.st',
        'Accept': '*/*'
      }
    });
    if (!segResp.ok) return new Response(`HTTP ${segResp.status}`, { status: segResp.status });

    const body = await segResp.arrayBuffer();
    segCache.set(cacheKey, { body, time: Date.now() });
    cleanupSegCache();

    return new Response(body, { headers: TS() });
  } catch (error) {
    return new Response(`Errore: ${error.message}`, { status: 500, headers: TXT() });
  }
}

// ============================================================================
// ENDPOINT /daddy-prefetch
// ============================================================================

async function daddyPrefetch(u, origin) {
  const popularChannels = ['577', '870', '869', '860', '877', '462', '461'];
  const results = [];
  
  for (const id of popularChannels) {
    try {
      const cacheKey = `m3u8_${id}`;
      const cached = m3u8Cache.get(cacheKey);
      if (cached && Date.now() < cached.expires) {
        results.push({ id, status: 'already_cached' });
        continue;
      }

      const fakeUrl = new URL(`${origin}/daddy-proxy?id=${id}`);
      const resp = await daddyProxy(fakeUrl, origin);
      if (resp.status === 200) {
        results.push({ id, status: 'cached' });
      } else {
        results.push({ id, status: 'error', code: resp.status });
      }
    } catch (e) {
      results.push({ id, status: 'error', error: e.message });
    }
  }

  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    prefetched: results,
    cache_size: m3u8Cache.size
  }, null, 2), { headers: JSON_H() });
}

// ============================================================================
// ENDPOINT /live - Flusso principale
// ============================================================================

async function live(req, u) {
  const query = u.searchParams.get('ch') || u.searchParams.get('id') || '';
  const channel = findCh(query);
  if (!channel) return new Response(`Canale non trovato: ${query}`, { status: 404, headers: TXT() });

  console.log(`[LIVE] Richiesta ${channel.name} (${channel.slug})`);

  if (channel.ntv) {
    const r = await resolveNtv(channel.ntv);
    if (r) return new Response(null, { status: 302, headers: { 'Location': r.url, 'access-control-allow-origin': '*' } });
  }

  if (channel.vavoo) {
    const r = await resolveVavoo(channel.vavoo);
    if (r) return new Response(null, { status: 302, headers: { 'Location': r.url, 'access-control-allow-origin': '*' } });
  }

  if (channel.daddy) {
    const url = `${u.origin}/daddy-proxy?id=${channel.daddy}`;
    return new Response(null, {
      status: 302,
      headers: { 'Location': url, 'access-control-allow-origin': '*', 'cache-control': 'no-cache' }
    });
  }

  return new Response(`Nessun provider per ${channel.name}`, { status: 503, headers: TXT() });
}

// ============================================================================
// ENDPOINT /probe
// ============================================================================

async function probe(u) {
  const query = u.searchParams.get('ch') || u.searchParams.get('id') || '';
  const provider = u.searchParams.get('provider') || 'all';
  const channel = findCh(query);
  
  if (!channel) {
    return new Response(JSON.stringify({ error: 'Canale non trovato', query }, null, 2), { headers: JSON_H() });
  }

  const results = {
    channel: channel,
    timestamp: new Date().toISOString(),
    tests: {}
  };

  if (provider === 'all' || provider === 'ntv') {
    if (channel.ntv) {
      const start = Date.now();
      try {
        const r = await resolveNtv(channel.ntv);
        results.tests.ntv = {
          status: r ? 'ok' : 'failed',
          elapsed: Date.now() - start + 'ms',
          url: r ? r.url : null
        };
      } catch (e) {
        results.tests.ntv = { status: 'error', error: e.message, elapsed: Date.now() - start + 'ms' };
      }
    }
  }

  if (provider === 'all' || provider === 'vavoo') {
    if (channel.vavoo) {
      const start = Date.now();
      try {
        const r = await resolveVavoo(channel.vavoo);
        results.tests.vavoo = {
          status: r ? 'ok' : 'failed',
          elapsed: Date.now() - start + 'ms',
          url: r ? r.url : null
        };
      } catch (e) {
        results.tests.vavoo = { status: 'error', error: e.message, elapsed: Date.now() - start + 'ms' };
      }
    }
  }

  if (provider === 'all' || provider === 'daddy') {
    if (channel.daddy) {
      const start = Date.now();
      try {
        const m3u8Url = await resolveDaddyM3u8(channel.daddy);
        results.tests.daddy = {
          status: 'ok',
          elapsed: Date.now() - start + 'ms',
          m3u8_url: m3u8Url
        };
      } catch (e) {
        results.tests.daddy = { status: 'error', error: e.message, elapsed: Date.now() - start + 'ms' };
      }
    }
  }

  return new Response(JSON.stringify(results, null, 2), { headers: JSON_H() });
}

// ============================================================================
// ENDPOINT /debug
// ============================================================================

async function debug(u) {
  const query = u.searchParams.get('ch') || u.searchParams.get('id') || '';
  const channel = findCh(query);
  
  if (!channel) {
    return new Response(JSON.stringify({ error: 'Canale non trovato', query }, null, 2), { headers: JSON_H() });
  }

  const info = {
    channel: channel,
    timestamp: new Date().toISOString(),
    providers: {
      ntv: channel.ntv ? { configured: true, slug: channel.ntv } : { configured: false },
      vavoo: channel.vavoo ? { configured: true, id: channel.vavoo } : { configured: false },
      daddy: channel.daddy ? { configured: true, id: channel.daddy } : { configured: false }
    },
    endpoints: {
      live: `/live?ch=${channel.slug}`,
      daddy_proxy: `/daddy-proxy?id=${channel.daddy || 'N/A'}`
    }
  };

  return new Response(JSON.stringify(info, null, 2), { headers: JSON_H() });
}

// ============================================================================
// ENDPOINT /stats
// ============================================================================

async function stats() {
  const hours = (Date.now() - deployTime) / 1000 / 60 / 60;
  const perDay = hours > 0 ? Math.round((totalRequests / hours) * 24) : 0;
  return new Response(JSON.stringify({
    uptime_hours: hours.toFixed(2),
    total_requests: totalRequests,
    m3u8_requests: m3u8Requests,
    segment_requests: segRequests,
    cache_hits: cacheHits,
    cache_hit_rate: segRequests > 0 ? ((cacheHits / segRequests) * 100).toFixed(1) + '%' : '0%',
    m3u8_cached: m3u8Cache.size,
    segments_cached: segCache.size,
    estimated_daily: perDay,
    cloudflare_limit: 100000,
    usage_percent: ((perDay / 100000) * 100).toFixed(2) + '%',
    status: perDay < 50000 ? '✅ OK' : perDay < 80000 ? '⚠️ ATTENZIONE' : '❌ OVER LIMIT'
  }, null, 2), { headers: JSON_H() });
}

// ============================================================================
// ENDPOINT /channels
// ============================================================================

async function channels() {
  return new Response(JSON.stringify(CHANNELS, null, 2), { headers: JSON_H() });
}

// ============================================================================
// ENDPOINT /health
// ============================================================================

async function health() {
  return new Response(JSON.stringify({
    status: 'ok',
    version: '11.3',
    channels: CHANNELS.length,
    timestamp: new Date().toISOString()
  }, null, 2), { headers: JSON_H() });
}

// ============================================================================
// ROUTER PRINCIPALE
// ============================================================================

export default {
  async fetch(req) {
    totalRequests++;
    const u = new URL(req.url);
    const path = u.pathname;
    
    try {
      if (path === '/') return await health();
      if (path === '/health') return await health();
      if (path === '/live') return await live(req, u);
      if (path === '/channels') return await channels();
      if (path === '/stats') return await stats();
      if (path === '/probe') return await probe(u);
      if (path === '/debug') return await debug(u);
      if (path === '/daddy-proxy') return await daddyProxy(u, u.origin);
      if (path === '/daddy-seg') return await daddySeg(u);
      if (path === '/daddy-prefetch') return await daddyPrefetch(u, u.origin);
      
      return new Response('Endpoint non trovato', { status: 404, headers: TXT() });
    } catch (error) {
      console.error('[ERROR]', error);
      return new Response(`Errore: ${error.message}`, { status: 500, headers: TXT() });
    }
  }
};
