// ============================================================
// TVNOW-CF v8.7 Stable+Fast  —  Debug functions INVARIATE
// ============================================================
// ✅ Mantenute: /analyze, /diag, /checkseg, /vmap, /debug, /ch
// ✅ Mantenuti: tutti i parametri diagnostici
// 🆕 Anti-block + stabilità + avvio + keyframe hunting migliorati
// ============================================================

const SOURCES = {
  ntv:    (id) => `https://www.ntvstreaming.com/live/${id}/master.m3u8`,
  vavoo:  (id) => `https://live.vavoo.to/playlist/${id}/index.m3u8`,
  daddy:  (id) => `https://dlhd.live/player/${id}/master.m3u8`
};

const RSI_LA2_ID = "3590183307";
const RSI_LA1_ID = "2455610203";

// ---- Configurazione ----
const EXTRA_KEYFRAME_SEG = 2;
const FAST_WINDOW_SEC = 3;
const SEGMENT_TIMEOUT = 1500;
const RESOLUTION_CACHE_SEC = 20;
const START_TIME_OFFSET = -3;

// ---- Anti-block: User-Agent rotation ----
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0"
];
function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ---- Cache risoluzioni ----
const resCache = new Map();

async function fetchWithTimeout(url, opts = {}, timeout = SEGMENT_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = new Headers(opts.headers || {});
    if (!headers.has("User-Agent")) headers.set("User-Agent", randomUA());
    headers.set("Accept", "*/*");
    headers.set("Accept-Language", "it-IT,it;q=0.9,en;q=0.8");
    headers.set("Cache-Control", "no-cache");
    headers.set("Pragma", "no-cache");
    const res = await fetch(url, { ...opts, headers, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ---- Proxy richieste upstream con anti-block ----
async function proxyUpstream(url, request) {
  const headers = new Headers();
  for (const [k, v] of new Headers(request.headers)) {
    if (!["host", "cookie", "authorization", "referer"].includes(k.toLowerCase())) {
      headers.set(k, v);
    }
  }
  headers.set("User-Agent", randomUA());
  headers.set("Cache-Control", "no-cache");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      signal: controller.signal
    });

    const respHeaders = new Headers();
    for (const [k, v] of upstream.headers) {
      const lk = k.toLowerCase();
      if (["content-type", "cache-control", "access-control-allow-origin"].includes(lk)) {
        respHeaders.set(k, v);
      }
    }
    respHeaders.set("Access-Control-Allow-Origin", "*");
    respHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate");
    respHeaders.set("X-Proxy", "TVNOW-CF-v8.7");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders
    });
  } catch (e) {
    clearTimeout(timeoutId);
    return new Response(JSON.stringify({ error: "Upstream error", detail: e.message }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

// ---- Analizza e scegli la migliore variante H.264 ----
function parseMasterPlaylist(body) {
  const lines = body.split(/\r?\n/);
  const variants = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const attrs = {};
      const attrStr = line.substring("#EXT-X-STREAM-INF:".length);
      const re = /([A-Z-]+)=("[^"]*"|[^,]+)/g;
      let m;
      while ((m = re.exec(attrStr)) !== null) {
        attrs[m[1]] = m[2].replace(/^"|"$/g, "");
      }
      current = { attrs, line, index: variants.length };
    } else if (current && line && !line.startsWith("#")) {
      current.uri = line;
      variants.push(current);
      current = null;
    }
  }
  return variants;
}

function codecIsH264(codecs) {
  if (!codecs) return false;
  return codecs.split(",").some(c => c.trim().startsWith("avc1"));
}

function selectVariant(variants, forceH264, preferredIdx) {
  if (preferredIdx !== null && variants[preferredIdx]) return variants[preferredIdx];
  if (forceH264) {
    const h264 = variants.filter(v => codecIsH264(v.attrs.CODECS));
    if (h264.length) {
      return h264.reduce((a, b) => 
        (parseInt(a.attrs.RESOLUTION?.split("x")[1]) || 0) >= (parseInt(b.attrs.RESOLUTION?.split("x")[1]) || 0) ? a : b
      );
    }
  }
  return variants.reduce((a, b) => 
    (parseInt(a.attrs.BANDWIDTH) || 0) >= (parseInt(b.attrs.BANDWIDTH) || 0) ? a : b
  );
}

// ---- Analizza media playlist e calcola finestra ottimale ----
function parseMediaPlaylist(body) {
  const lines = body.split(/\r?\n/);
  const segments = [];
  let version = 3;
  let targetDur = 0;
  let mediaSeq = 0;
  let mapUri = null;
  let discontinuityCounter = 0;
  let hasDiscontinuity = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXT-X-VERSION:")) version = parseInt(line.split(":")[1]);
    else if (line.startsWith("#EXT-X-TARGETDURATION:")) targetDur = parseFloat(line.split(":")[1]);
    else if (line.startsWith("#EXT-X-MEDIA-SEQUENCE:")) mediaSeq = parseInt(line.split(":")[1]);
    else if (line.startsWith("#EXT-X-MAP:")) {
      const m = line.match(/URI="([^"]+)"/);
      if (m) mapUri = m[1];
    }
    else if (line.startsWith("#EXT-X-DISCONTINUITY")) {
      hasDiscontinuity = true;
      discontinuityCounter++;
    }
    else if (line.startsWith("#EXTINF:")) {
      const dur = parseFloat(line.split(":")[1].split(",")[0]);
      segments.push({
        dur,
        uri: lines[i + 1] || "",
        index: segments.length,
        afterDiscontinuity: hasDiscontinuity
      });
      hasDiscontinuity = false;
    }
  }
  return { lines, segments, version, targetDur, mediaSeq, mapUri, discontinuityCounter };
}

// 🆕 Keyframe hunting: trova segmento che inizia con IDR (dimensione maggiore = probabile keyframe)
function findKeyframeStart(segments, extraSeg) {
  if (segments.length === 0) return 0;
  
  // Strategia: parti da extraSeg, poi verifica se ci sono discontinuità
  let startIdx = Math.min(extraSeg, segments.length - 1);
  
  // Se il segmento scelto viene dopo una discontinuità, è ottimo (inizio GOP)
  if (segments[startIdx]?.afterDiscontinuity) {
    return startIdx;
  }
  
  // Altrimenti, cerca all'indietro l'ultima discontinuità
  for (let i = startIdx; i >= 0; i--) {
    if (segments[i]?.afterDiscontinuity) {
      return i;
    }
  }
  
  // Se nessuna discontinuità, usa extraSeg come fallback
  return startIdx;
}

// ---- Genera playlist ottimizzata ----
function buildOptimizedPlaylist(parsed, startIdx, isFast, mapUriProxy) {
  const { lines, segments, version, targetDur, mediaSeq } = parsed;
  const out = [];
  
  out.push("#EXTM3U");
  out.push(`#EXT-X-VERSION:${Math.max(version, 6)}`);
  out.push(`#EXT-X-TARGETDURATION:${Math.ceil(targetDur)}`);
  
  let newSeq = mediaSeq + startIdx;
  out.push(`#EXT-X-MEDIA-SEQUENCE:${newSeq}`);
  
  if (segments.some(s => s.afterDiscontinuity)) {
    out.push("#EXT-X-DISCONTINUITY-SEQUENCE:0");
  }
  
  // 🆕 MAP subito dopo gli header, senza cache
  if (mapUriProxy) {
    out.push(`#EXT-X-MAP:URI="${mapUriProxy}"`);
  }
  
  // Quanti segmenti includere
  let endIdx;
  if (isFast) {
    const segsFor3s = Math.ceil(FAST_WINDOW_SEC / Math.max(targetDur, 1));
    endIdx = Math.min(startIdx + segsFor3s + 1, segments.length);
  } else {
    endIdx = segments.length;
  }
  
  // EXT-X-START per dire al player da dove iniziare
  if (isFast) {
    out.push(`#EXT-X-START:TIME-OFFSET=${START_TIME_OFFSET}`);
  }
  
  let addedDiscontinuity = false;
  for (let i = startIdx; i < endIdx; i++) {
    const seg = segments[i];
    if (seg.afterDiscontinuity && !addedDiscontinuity) {
      out.push("#EXT-X-DISCONTINUITY");
      addedDiscontinuity = true;
    }
    out.push(`#EXTINF:${seg.dur.toFixed(3)},`);
    out.push(seg.uri);
  }
  
  out.push("#EXT-X-ENDLIST");
  return out.join("\n");
}

// ---- Risolvi URL relativo ----
function resolveUri(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

// ---- Gestisci flusso live con fallback tra fonti ----
async function handleLive(params, request) {
  const ch = params.get("ch");
  if (!ch) return jsonErr("Parametro 'ch' mancante", 400);
  
  const isFast = params.get("fast") !== "0";
  const forceH264 = params.get("force_h264") === "1";
  const safeMode = params.get("safe") === "1";
  const variantIdx = params.has("variant") ? parseInt(params.get("variant")) : null;
  const listVariants = params.get("list_variants") === "1";
  const providerPref = (params.get("p") || "ntv,vavoo,daddy").split(",").map(s => s.trim()).filter(Boolean);
  
  // RSI La 2: ID corretto come priorità
  let channelId = ch;
  let sourceKey = null;
  
  if (ch.includes(":")) {
    const [s, id] = ch.split(":");
    sourceKey = s;
    channelId = id;
  }
  
  // Override speciale RSI La 2
  if (channelId === RSI_LA2_ID || ch.toLowerCase().includes("rsila2") || ch === "3475299702") {
    channelId = RSI_LA2_ID;
  }
  
  const sources = sourceKey ? [sourceKey] : providerPref;
  
  // 🆕 Prova ogni fonte con fallback automatico
  let lastErr = null;
  for (const src of sources) {
    if (!SOURCES[src]) continue;
    
    try {
      const masterUrl = SOURCES[src](channelId);
      const masterRes = await fetchWithTimeout(masterUrl, {}, 3000);
      
      if (!masterRes.ok) {
        lastErr = `Fonte ${src}: HTTP ${masterRes.status}`;
        continue;
      }
      
      const masterBody = await masterRes.text();
      const variants = parseMasterPlaylist(masterBody);
      
      if (variants.length === 0) {
        lastErr = `Fonte ${src}: nessuna variante`;
        continue;
      }
      
      // Lista varianti per diagnostica
      if (listVariants) {
        return json({
          source: src,
          channel: channelId,
          variants: variants.map((v, i) => ({
            index: i,
            bandwidth: v.attrs.BANDWIDTH,
            resolution: v.attrs.RESOLUTION || "n/a",
            codecs: v.attrs.CODECS || "n/a",
            isH264: codecIsH264(v.attrs.CODECS),
            uri: v.uri
          }))
        });
      }
      
      const chosen = selectVariant(variants, forceH264, variantIdx);
      const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
      const mediaUrl = resolveUri(baseUrl, chosen.uri);
      
      // Cache della risoluzione scelta
      const cacheKey = `${src}:${channelId}`;
      resCache.set(cacheKey, {
        resolution: chosen.attrs.RESOLUTION,
        codecs: chosen.attrs.CODECS,
        bandwidth: chosen.attrs.BANDWIDTH,
        ts: Date.now()
      });
      
      const mediaRes = await fetchWithTimeout(mediaUrl, {}, 2500);
      if (!mediaRes.ok) {
        lastErr = `Fonte ${src} media: HTTP ${mediaRes.status}`;
        continue;
      }
      
      const mediaBody = await mediaRes.text();
      const parsed = parseMediaPlaylist(mediaBody);
      
      if (parsed.segments.length === 0) {
        lastErr = `Fonte ${src}: nessun segmento`;
        continue;
      }
      
      // 🆕 Trova inizio con keyframe
      const extraSeg = safeMode ? EXTRA_KEYFRAME_SEG + 1 : EXTRA_KEYFRAME_SEG;
      const startIdx = findKeyframeStart(parsed.segments, extraSeg);
      
      const mediaBase = mediaUrl.substring(0, mediaUrl.lastIndexOf("/") + 1);
      
      // Riscrivi URI segmenti tramite proxy
      for (const seg of parsed.segments) {
        const absUri = resolveUri(mediaBase, seg.uri);
        seg.uri = `/seg?u=${encodeURIComponent(absUri)}&src=${src}`;
      }
      
      // Riscrivi MAP tramite proxy
      let mapProxy = null;
      if (parsed.mapUri) {
        const absMap = resolveUri(mediaBase, parsed.mapUri);
        mapProxy = `/seg?u=${encodeURIComponent(absMap)}&src=${src}&init=1`;
      }
      
      const optimized = buildOptimizedPlaylist(parsed, startIdx, isFast, mapProxy);
      
      return new Response(optimized, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Access-Control-Allow-Origin": "*",
          "X-Source": src,
          "X-Chosen-Resolution": chosen.attrs.RESOLUTION || "",
          "X-Codecs": chosen.attrs.CODECS || "",
          "X-Start-Idx": startIdx.toString(),
          "X-Total-Segs": parsed.segments.length.toString()
        }
      });
      
    } catch (e) {
      lastErr = `Fonte ${src}: ${e.message}`;
      continue;
    }
  }
  
  return jsonErr(`Tutte le fonti fallite. Ultimo errore: ${lastErr}`, 502);
}

// ---- Proxy segmenti ----
async function handleSegment(params, request) {
  const u = params.get("u");
  if (!u) return jsonErr("URL mancante", 400);
  
  const isInit = params.get("init") === "1";
  const timeout = isInit ? 3000 : SEGMENT_TIMEOUT;
  
  try {
    const upstream = await fetchWithTimeout(u, {
      headers: { "Range": request.headers.get("Range") || "" }
    }, timeout);
    
    if (!upstream.ok && upstream.status !== 206) {
      return new Response(null, { status: upstream.status });
    }
    
    const respHeaders = new Headers();
    const cl = upstream.headers.get("content-length");
    const te = upstream.headers.get("transfer-encoding");
    
    respHeaders.set("Content-Type", upstream.headers.get("content-type") || "video/MP2T");
    respHeaders.set("Access-Control-Allow-Origin", "*");
    
    // Non copiare Content-Length se c'è Transfer-Encoding chunked
    if (cl && !te) {
      respHeaders.set("Content-Length", cl);
    }
    
    // Cache per segmenti normali, MAI per init
    if (isInit) {
      respHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate");
    } else {
      respHeaders.set("Cache-Control", "public, max-age=4");
    }
    
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders
    });
    
  } catch (e) {
    return new Response(null, { status: 504 });
  }
}

// ============================================================
// 🔒 FUNZIONI DI DEBUG E DIAGNOSTICA — INVARIATE dalla v8.6
// ============================================================

async function handleAnalyze(params) {
  const ch = params.get("ch");
  if (!ch) return jsonErr("ch mancante", 400);
  
  const result = { channel: ch, sources: {} };
  let channelId = ch;
  let sourceKey = null;
  
  if (ch.includes(":")) {
    const [s, id] = ch.split(":");
    sourceKey = s;
    channelId = id;
  }
  
  if (channelId === "3475299702") channelId = RSI_LA2_ID;
  
  const sources = sourceKey ? [sourceKey] : Object.keys(SOURCES);
  
  for (const src of sources) {
    try {
      const masterUrl = SOURCES[src](channelId);
      const res = await fetchWithTimeout(masterUrl, {}, 3000);
      const body = await res.text();
      const variants = parseMasterPlaylist(body);
      
      result.sources[src] = {
        httpStatus: res.status,
        masterReachable: res.ok,
        variantCount: variants.length,
        variants: variants.map(v => ({
          resolution: v.attrs.RESOLUTION,
          codecs: v.attrs.CODECS,
          bandwidth: v.attrs.BANDWIDTH,
          isH264: codecIsH264(v.attrs.CODECS),
          hasHevc: v.attrs.CODECS?.includes("hvc1") || false
        }))
      };
      
      if (variants.length > 0) {
        const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
        const mediaUrl = resolveUri(baseUrl, variants[0].uri);
        const mres = await fetchWithTimeout(mediaUrl, {}, 2500);
        const mbody = await mres.text();
        const parsed = parseMediaPlaylist(mbody);
        
        result.sources[src].media = {
          segmentCount: parsed.segments.length,
          targetDuration: parsed.targetDur,
          version: parsed.version,
          hasMap: !!parsed.mapUri,
          discontinuityCount: parsed.discontinuityCounter,
          firstSegments: parsed.segments.slice(0, 5).map(s => ({
            dur: s.dur,
            afterDiscontinuity: s.afterDiscontinuity
          }))
        };
      }
      
    } catch (e) {
      result.sources[src] = { error: e.message };
    }
  }
  
  return json(result);
}

async function handleDiag(params) {
  const ch = params.get("ch");
  const info = {
    channel: ch,
    rsiLa2Fixed: ch === RSI_LA2_ID || ch === "3475299702",
    correctRsiLa2Id: RSI_LA2_ID,
    cacheEntries: resCache.size,
    cache: Object.fromEntries(resCache.entries())
  };
  return json(info);
}

async function handleCheckSeg(params) {
  const src = params.get("s") || "ntv";
  const ch = params.get("ch");
  if (!SOURCES[src] || !ch) return jsonErr("s o ch mancante", 400);
  
  try {
    const masterUrl = SOURCES[src](ch);
    const mres = await fetchWithTimeout(masterUrl, {}, 3000);
    const variants = parseMasterPlaylist(await mres.text());
    if (!variants.length) return jsonErr("nessuna variante", 404);
    
    const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
    const mediaUrl = resolveUri(baseUrl, variants[0].uri);
    const res = await fetchWithTimeout(mediaUrl, {}, 2500);
    const parsed = parseMediaPlaylist(await res.text());
    
    return json({
      totalSegments: parsed.segments.length,
      targetDuration: parsed.targetDur,
      hasMap: !!parsed.mapUri,
      discontinuities: parsed.discontinuityCounter,
      segments: parsed.segments.map((s, i) => ({
        idx: i,
        dur: s.dur,
        afterDiscontinuity: s.afterDiscontinuity,
        recommendedStart: i >= EXTRA_KEYFRAME_SEG ? "sì" : "troppo vicino all'inizio"
      }))
    });
  } catch (e) {
    return jsonErr(e.message, 500);
  }
}

async function handleVmap() {
  const list = [];
  for (const [name, fn] of Object.entries(SOURCES)) {
    list.push({ source: name, example: fn("ID_CANALE") });
  }
  list.push({ note: "RSI La 2 ID corretto", value: RSI_LA2_ID });
  list.push({ note: "RSI La 1 ID", value: RSI_LA1_ID });
  return json(list);
}

async function handleDebug() {
  return json({
    version: "8.7 Stable+Fast",
    debugFunctions: "INVARIATE",
    features: [
      "Rotazione User-Agent anti-block",
      "Fallback automatico tra fonti",
      "Keyframe hunting intelligente",
      "Finestra avvio 3s",
      "Cache init segment disabilitata",
      "Content-Length safety check",
      "EXT-X-VERSION:6"
    ],
    endpoints: {
      live: "/live?ch=ID",
      analyze: "/analyze?ch=ID",
      diag: "/diag?ch=ID",
      checkseg: "/checkseg?s=ntv&ch=ID",
      vmap: "/vmap",
      debug: "/debug",
      ch: "/ch"
    },
    params: {
      fast: "0=disattiva modalità veloce",
      force_h264: "1=forza solo H.264",
      safe: "1=modalità sicura (più segmenti extra)",
      variant: "N=scegli variante per indice",
      list_variants: "1=elenca varianti disponibili",
      p: "ntv,vavoo,daddy=ordine fonti"
    }
  });
}

async function handleCh() {
  const list = [
    { name: "RSI La 1", ntv: RSI_LA1_ID },
    { name: "RSI La 2", ntv: RSI_LA2_ID, oldWrongId: "3475299702" },
    { name: "Sky Sport F1", ntv: "577" },
    { name: "Sky Sport Tennis", ntv: "576" },
    { name: "Sky Sport Calcio", ntv: "870" },
    { name: "Sky Sport Arena", ntv: "462" }
  ];
  return json(list);
}

// ---- Utilities ----
function json(obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function jsonErr(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// ---- Entrypoint ----
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;
    
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }
    
    // Pulizia cache scaduta
    const now = Date.now();
    for (const [k, v] of resCache) {
      if (now - v.ts > RESOLUTION_CACHE_SEC * 1000) {
        resCache.delete(k);
      }
    }
    
    try {
      if (path === "/" || path === "") {
        return json({
          service: "TVNOW-CF v8.7 Stable+Fast",
          status: "OK",
          debug: "Funzioni diagnostiche invariata",
          usage: "/live?ch=ID_CANALE"
        });
      }
      if (path.startsWith("/live"))      return handleLive(params, request);
      if (path.startsWith("/seg"))       return handleSegment(params, request);
      if (path.startsWith("/analyze"))   return handleAnalyze(params);
      if (path.startsWith("/diag"))      return handleDiag(params);
      if (path.startsWith("/checkseg"))  return handleCheckSeg(params);
      if (path.startsWith("/vmap"))      return handleVmap();
      if (path.startsWith("/debug"))     return handleDebug();
      if (path.startsWith("/ch"))        return handleCh();
      
      // Proxy generico fallback
      return proxyUpstream(url.toString().replace(url.origin + "/", ""), request);
      
    } catch (e) {
      return jsonErr("Errore interno: " + e.message, 500);
    }
  }
};
