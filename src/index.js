// ============================================================================
// TVNOW-CF v9.0 Quality-Lock — 1080p H.264 default + fallback automatico
// ============================================================================
// FIX:
// 1. selectBestVariant sceglie SEMPRE H.264 (avc1) alla risoluzione massima
// 2. HEVC (hvc1/hev1) scartato di default (causa schermo nero)
// 3. Quality-Lock: &fail=1 scende 1080→720→480→360, &reset=1 torna 1080
// 4. ID Vavoo (6)/(7) completi dal PDF
// ============================================================================

const CONFIG = {
  VERSION: 'TVNOW-CF v9.0 Quality-Lock',
  DELAY_TARGET: 27, DELAY_MIN: 25, PREF_SEGS: 3, MIN_SEGS: 2,
  RES_LADDER: [1080, 720, 480, 360, 240],
  QUALITY_TTL: 30 * 60 * 1000,
  FEATURES: [
    '1080p H.264 default', 'Quality-Lock auto-fallback', 'HEVC blocked',
    'Dual-ID Vavoo (6)/(7)', 'Health Check Auto-Switch', 'Keyframe Window 8s',
    'No EXT-X-START', 'Cache Bust 5s', 'Multi-Provider Fallback',
    'Segment Proxy', 'UA Rotation', 'Cookie Persistence', 'Debug Endpoints'
  ]
};

// ============================================================================
// CHANNELS — ID Vavoo (6)/(7) completi dal PDF
// ============================================================================
const CHANNELS = [
  // SKY SPORT
  { slug:'sky-sport-24', name:'Sky Sport 24', ntv:'869', vavoo:'sky sport 24', daddy:'869', vid6:'2775802255', vid7:'3445562519' },
  { slug:'sky-sport-uno', name:'Sky Sport Uno', ntv:'461', vavoo:'sky sport uno', daddy:'461', vid6:'210669162', vid7:'3192996672' },
  { slug:'sky-sport-calcio', name:'Sky Sport Calcio', ntv:'870', vavoo:'sky sport calcio', daddy:'870', vid6:'1665920101', vid7:'449990998' },
  { slug:'sky-sport-tennis', name:'Sky Sport Tennis', ntv:'576', vavoo:'sky sport tennis', daddy:'576', vid6:'2100771782', vid7:'78546677' },
  { slug:'sky-sport-f1', name:'Sky Sport F1', ntv:'577', vavoo:'sky sport f1', daddy:'577', vid6:'4246774056', vid7:'2289038972' },
  { slug:'sky-sport-motogp', name:'Sky Sport MotoGP', ntv:'575', vavoo:'sky sport motogp', daddy:'575', vid6:'3036316886', vid7:'2090703806' },
  { slug:'sky-sport-arena', name:'Sky Sport Arena', ntv:'462', vavoo:'sky sport arena', daddy:'462', vid6:'3007400791', vid7:'2555960713' },
  { slug:'sky-sport-max', name:'Sky Sport Max', ntv:'460', vavoo:'sky sport max', daddy:'460', vid6:'2066326916', vid7:'' },
  { slug:'sky-sport-basket', name:'Sky Sport Basket', ntv:'875', vavoo:'sky sport nba', daddy:'875', vid6:'2711959620', vid7:'326825326' },
  { slug:'sky-sport-golf', name:'Sky Sport Golf', ntv:'574', vavoo:'sky sport golf', daddy:'574', vid6:'729945219', vid7:'3897711086' },
  { slug:'sky-sport-serie-a', name:'Sky Sport Serie A', ntv:'', vavoo:'sky sport serie a', daddy:'880', vid6:'2077387085', vid7:'' },
  { slug:'sky-sport-football', name:'Sky Sport Football', ntv:'871', vavoo:'sky sport football', daddy:'871', vid6:'3093535330', vid7:'1989309231' },
  // DAZN / EUROSPORT
  { slug:'dazn-1', name:'DAZN 1', ntv:'877', vavoo:'dazn 1', daddy:'877', vid6:'1376440573', vid7:'2745635299' },
  { slug:'dazn-2', name:'DAZN 2', ntv:'', vavoo:'dazn 2', daddy:'', vid6:'363506221', vid7:'' },
  { slug:'zona-dazn', name:'Zona DAZN', ntv:'', vavoo:'zona dazn', daddy:'', vid6:'2911178456', vid7:'' },
  { slug:'eurosport-1', name:'Eurosport 1', ntv:'878', vavoo:'eurosport 1', daddy:'878', vid6:'3481346857', vid7:'3448075317' },
  { slug:'eurosport-2', name:'Eurosport 2', ntv:'879', vavoo:'eurosport 2', daddy:'879', vid6:'2283887097', vid7:'2317684453' },
  { slug:'wwe-channel', name:'WWE Channel', ntv:'', vavoo:'wwe channel', daddy:'', vid6:'2989824407', vid7:'' },
  // RSI
  { slug:'rsi-la-1', name:'RSI La 1', ntv:'2455610203', vavoo:'rsi la 1', daddy:'', vid6:'2455610203', vid7:'2290395046' },
  { slug:'rsi-la-2', name:'RSI La 2', ntv:'3590183307', vavoo:'rsi la 2', daddy:'', vid6:'3590183307', vid7:'3475299702' },
  // SKY CINEMA
  { slug:'sky-cinema-uno', name:'Sky Cinema Uno', ntv:'860', vavoo:'sky cinema uno', daddy:'860', vid6:'2872151911', vid7:'1759625738' },
  { slug:'sky-cinema-due', name:'Sky Cinema Due', ntv:'', vavoo:'sky cinema due', daddy:'', vid6:'1228534500', vid7:'2330574729' },
  { slug:'sky-cinema-action', name:'Sky Cinema Action', ntv:'861', vavoo:'sky cinema action', daddy:'861', vid6:'3812796171', vid7:'1144128726' },
  { slug:'sky-cinema-comedy', name:'Sky Cinema Comedy', ntv:'862', vavoo:'sky cinema comedy', daddy:'862', vid6:'500203271', vid7:'3131104474' },
  { slug:'sky-cinema-drama', name:'Sky Cinema Drama', ntv:'867', vavoo:'sky cinema drama', daddy:'867', vid6:'1235530177', vid7:'' },
  { slug:'sky-cinema-family', name:'Sky Cinema Family', ntv:'865', vavoo:'sky cinema family', daddy:'865', vid6:'415795144', vid7:'3216516117' },
  { slug:'sky-cinema-romance', name:'Sky Cinema Romance', ntv:'864', vavoo:'sky cinema romance', daddy:'864', vid6:'2890008905', vid7:'1281264885' },
  { slug:'sky-cinema-suspense', name:'Sky Cinema Suspense', ntv:'868', vavoo:'sky cinema suspense', daddy:'868', vid6:'1820997555', vid7:'3060043751' },
  { slug:'sky-cinema-collection', name:'Sky Cinema Collection', ntv:'859', vavoo:'sky cinema collection', daddy:'859', vid6:'', vid7:'3525837057' },
  // SKY PRIMAFILA
  { slug:'sky-primafila-1', name:'Sky Primafila 1', ntv:'', vavoo:'sky primafila 1', daddy:'', vid6:'1944682394', vid7:'1492183364' },
  { slug:'sky-primafila-2', name:'Sky Primafila 2', ntv:'', vavoo:'sky primafila 2', daddy:'', vid6:'877200714', vid7:'525374356' },
  { slug:'sky-primafila-3', name:'Sky Primafila 3', ntv:'', vavoo:'sky primafila 3', daddy:'', vid6:'153693434', vid7:'573618724' },
  { slug:'sky-primafila-4', name:'Sky Primafila 4', ntv:'', vavoo:'sky primafila 4', daddy:'', vid6:'3137990890', vid7:'2416993844' },
  { slug:'sky-primafila-5', name:'Sky Primafila 5', ntv:'', vavoo:'sky primafila 5', daddy:'', vid6:'2255083866', vid7:'2909818756' },
  { slug:'sky-primafila-6', name:'Sky Primafila 6', ntv:'', vavoo:'sky primafila 6', daddy:'', vid6:'3251217290', vid7:'3939513684' },
  { slug:'sky-primafila-7', name:'Sky Primafila 7', ntv:'', vavoo:'sky primafila 7', daddy:'', vid6:'4238969402', vid7:'3618643172' },
  { slug:'sky-primafila-8', name:'Sky Primafila 8', ntv:'', vavoo:'sky primafila 8', daddy:'', vid6:'2130255339', vid7:'1440779061' },
  { slug:'sky-primafila-9', name:'Sky Primafila 9', ntv:'', vavoo:'sky primafila 9', daddy:'', vid6:'1134113883', vid7:'1753260677' },
  { slug:'sky-primafila-10', name:'Sky Primafila 10', ntv:'', vavoo:'sky primafila 10', daddy:'', vid6:'4272937805', vid7:'2268489342' },
  // SKY ALTRO
  { slug:'sky-serie', name:'Sky Serie', ntv:'880', vavoo:'sky serie', daddy:'880', vid6:'836680112', vid7:'' },
  { slug:'sky-crime', name:'Sky Crime', ntv:'863', vavoo:'sky crime', daddy:'863', vid6:'', vid7:'' },
  { slug:'sky-arte', name:'Sky Arte', ntv:'', vavoo:'sky arte', daddy:'', vid6:'1806815496', vid7:'1902695925' },
  { slug:'sky-atlantic', name:'Sky Atlantic', ntv:'', vavoo:'sky atlantic', daddy:'', vid6:'1421393119', vid7:'1482866609' },
  { slug:'sky-documentaries', name:'Sky Documentaries', ntv:'', vavoo:'sky documentaries', daddy:'', vid6:'464281981', vid7:'' },
  { slug:'sky-nature', name:'Sky Nature', ntv:'', vavoo:'sky nature', daddy:'', vid6:'3810188456', vid7:'' },
  { slug:'sky-uno', name:'Sky Uno', ntv:'', vavoo:'sky uno', daddy:'', vid6:'2130523218', vid7:'322024849' },
  { slug:'sky-tg24', name:'Sky TG24', ntv:'481', vavoo:'sky tg 24', daddy:'481', vid6:'3376031355', vid7:'318057128' },
  // RAI
  { slug:'rai-1', name:'Rai 1', ntv:'101', vavoo:'rai 1', daddy:'101', vid6:'875922788', vid7:'1225653759' },
  { slug:'rai-2', name:'Rai 2', ntv:'102', vavoo:'rai 2', daddy:'102', vid6:'1939210164', vid7:'246253359' },
  { slug:'rai-3', name:'Rai 3', ntv:'103', vavoo:'rai 3', daddy:'103', vid6:'1324733956', vid7:'869117599' },
  { slug:'rai-4', name:'Rai 4', ntv:'104', vavoo:'rai 4', daddy:'104', vid6:'4241820180', vid7:'2179822223' },
  { slug:'rai-5', name:'Rai 5', ntv:'105', vavoo:'rai 5', daddy:'105', vid6:'3249873828', vid7:'3163380543' },
  { slug:'rai-movie', name:'Rai Movie', ntv:'106', vavoo:'rai movie', daddy:'106', vid6:'2835672487', vid7:'1925964148' },
  { slug:'rai-premium', name:'Rai Premium', ntv:'107', vavoo:'rai premium', daddy:'107', vid6:'2861734300', vid7:'2828455552' },
  { slug:'rai-news-24', name:'Rai News 24', ntv:'108', vavoo:'rai news 24', daddy:'108', vid6:'2272923972', vid7:'2239645272' },
  { slug:'rai-sport', name:'Rai Sport', ntv:'109', vavoo:'rai sport', daddy:'109', vid6:'2924135092', vid7:'551730224' },
  { slug:'rai-scuola', name:'Rai Scuola', ntv:'110', vavoo:'rai scuola', daddy:'110', vid6:'2007798511', vid7:'1886684667' },
  { slug:'rai-yoyo', name:'Rai Yoyo', ntv:'111', vavoo:'rai yoyo', daddy:'111', vid6:'1785501924', vid7:'1890950169' },
  { slug:'rai-gulp', name:'Rai Gulp', ntv:'112', vavoo:'rai gulp', daddy:'112', vid6:'1901652742', vid7:'1803677691' },
  { slug:'rai-storia', name:'Rai Storia', ntv:'113', vavoo:'rai storia', daddy:'113', vid6:'78838793', vid7:'57338653' },
  { slug:'rai-4k', name:'Rai 4K', ntv:'114', vavoo:'rai 4k', daddy:'114', vid6:'2049087681', vid7:'' },
  { slug:'rai-italia', name:'Rai Italia', ntv:'', vavoo:'rai italia', daddy:'', vid6:'374675593', vid7:'294457245' },
  // MEDIASET
  { slug:'canale-5', name:'Canale 5', ntv:'201', vavoo:'canale 5', daddy:'201', vid6:'1534161807', vid7:'1101559666' },
  { slug:'italia-1', name:'Italia 1', ntv:'202', vavoo:'italia 1', daddy:'202', vid6:'663536394', vid7:'' },
  { slug:'italia-2', name:'Italia 2', ntv:'', vavoo:'italia 2', daddy:'', vid6:'1613543898', vid7:'3538009430' },
  { slug:'rete-4', name:'Rete 4', ntv:'203', vavoo:'rete 4', daddy:'203', vid6:'4198218214', vid7:'2235732004' },
  { slug:'mediaset-20', name:'20 Mediaset', ntv:'204', vavoo:'mediaset 20', daddy:'204', vid6:'1230338185', vid7:'3134481201' },
  { slug:'mediaset-extra', name:'Mediaset Extra', ntv:'205', vavoo:'mediaset extra', daddy:'205', vid6:'477466531', vid7:'' },
  { slug:'focus', name:'Focus', ntv:'206', vavoo:'focus', daddy:'206', vid6:'3439223610', vid7:'2982550433' },
  { slug:'top-crime', name:'Top Crime', ntv:'207', vavoo:'top crime', daddy:'207', vid6:'269503091', vid7:'3420407456' },
  { slug:'cine-34', name:'Cine 34', ntv:'208', vavoo:'cine 34', daddy:'208', vid6:'62558606', vid7:'1768670187' },
  { slug:'boing', name:'Boing', ntv:'209', vavoo:'boing', daddy:'209', vid6:'3373510242', vid7:'3022771961' },
  { slug:'cartoonito', name:'Cartoonito', ntv:'210', vavoo:'cartoonito', daddy:'210', vid6:'1987220436', vid7:'1907000512' },
  { slug:'iris', name:'Iris', ntv:'', vavoo:'iris', daddy:'', vid6:'576490047', vid7:'23919988' },
  { slug:'la-5', name:'La 5', ntv:'', vavoo:'la 5', daddy:'', vid6:'84139639', vid7:'1425667375' },
  { slug:'la-7', name:'La 7', ntv:'', vavoo:'la 7', daddy:'', vid6:'2143522071', vid7:'775530063' },
  { slug:'la-7-d', name:'La 7 D', ntv:'', vavoo:'la 7 d', daddy:'', vid6:'881846038', vid7:'' },
  // ALTRO
  { slug:'tv8', name:'TV8', ntv:'301', vavoo:'tv 8', daddy:'301', vid6:'4038365720', vid7:'2706291008' },
  { slug:'nove', name:'Nove', ntv:'', vavoo:'discovery nove', daddy:'', vid6:'2651461317', vid7:'1574591400' },
  { slug:'dmax', name:'DMAX', ntv:'', vavoo:'dmax', daddy:'', vid6:'3008151733', vid7:'3803638765' },
  { slug:'real-time', name:'Real Time', ntv:'', vavoo:'real time', daddy:'', vid6:'1574975196', vid7:'2251241999' },
  { slug:'giallo', name:'Giallo', ntv:'', vavoo:'giallo', daddy:'', vid6:'2373936189', vid7:'4060499455' },
  { slug:'k2', name:'K2', ntv:'', vavoo:'k2', daddy:'', vid6:'2255724318', vid7:'11090349' },
  { slug:'frisbee', name:'Frisbee', ntv:'', vavoo:'frisbee', daddy:'', vid6:'1995860185', vid7:'' },
  { slug:'super', name:'Super!', ntv:'', vavoo:'super', daddy:'', vid6:'3550030443', vid7:'2900362153' },
  { slug:'comedy-central', name:'Comedy Central', ntv:'', vavoo:'comedy central', daddy:'', vid6:'3658277450', vid7:'433893159' },
  { slug:'nickelodeon', name:'Nickelodeon', ntv:'', vavoo:'nickelodeon', daddy:'', vid6:'3039389215', vid7:'' },
  { slug:'nick-jr', name:'Nick Jr', ntv:'', vavoo:'nick jr', daddy:'', vid6:'380958472', vid7:'' },
  { slug:'cartoon-network', name:'Cartoon Network', ntv:'', vavoo:'cartoon network', daddy:'', vid6:'1744435623', vid7:'1289777017' },
  { slug:'baby-tv', name:'Baby TV', ntv:'', vavoo:'baby tv', daddy:'', vid6:'3938501125', vid7:'2265727942' },
  { slug:'nat-geo', name:'Nat Geo', ntv:'', vavoo:'nat geo', daddy:'', vid6:'1735702308', vid7:'179844839' },
  { slug:'nat-geo-wild', name:'Nat Geo Wild', ntv:'', vavoo:'nat geo wild', daddy:'', vid6:'3428501495', vid7:'3229664409' },
  { slug:'discovery', name:'Discovery', ntv:'', vavoo:'discovery channel', daddy:'', vid6:'1955739367', vid7:'3554841914' },
  { slug:'discovery-focus', name:'Discovery Focus', ntv:'', vavoo:'discovery focus', daddy:'', vid6:'', vid7:'2113273064' },
  { slug:'discovery-k2', name:'Discovery K2', ntv:'', vavoo:'discovery k2', daddy:'', vid6:'', vid7:'3037871903' },
  { slug:'food-network', name:'Food Network', ntv:'', vavoo:'food network', daddy:'', vid6:'2820683351', vid7:'2767861049' },
  { slug:'hgtv', name:'HGTV', ntv:'', vavoo:'hgtv', daddy:'', vid6:'2897782781', vid7:'4248997029' },
  { slug:'history', name:'History', ntv:'', vavoo:'history', daddy:'', vid6:'317837654', vid7:'2134724757' },
  { slug:'motor-trend', name:'Motor Trend', ntv:'', vavoo:'motortrend', daddy:'', vid6:'3758728323', vid7:'3889279895' },
  { slug:'warner-tv', name:'Warner TV', ntv:'', vavoo:'warner tv', daddy:'', vid6:'3171202588', vid7:'' },
  { slug:'fox', name:'Fox', ntv:'', vavoo:'fox', daddy:'', vid6:'', vid7:'563160609' },
  { slug:'star-comedy', name:'Star Comedy', ntv:'', vavoo:'star comedy', daddy:'', vid6:'1512072384', vid7:'' },
  { slug:'star-life', name:'Star Life', ntv:'', vavoo:'star life', daddy:'', vid6:'3946128844', vid7:'' },
  { slug:'premium-crime', name:'Premium Crime', ntv:'', vavoo:'premium crime', daddy:'', vid6:'', vid7:'444768053' },
  { slug:'crime-investigation', name:'Crime Investigation', ntv:'', vavoo:'crime investigation', daddy:'', vid6:'3005227700', vid7:'1968339149' },
  { slug:'deejay-tv', name:'DeeJay TV', ntv:'', vavoo:'deejay tv', daddy:'', vid6:'963607327', vid7:'3802167244' },
  { slug:'rtl-1025', name:'RTL 102.5', ntv:'', vavoo:'rtl 102.5', daddy:'', vid6:'3168132911', vid7:'1729811452' },
  { slug:'radio-capital', name:'Radio Capital', ntv:'', vavoo:'radio capital', daddy:'', vid6:'', vid7:'421441745' },
  { slug:'m2o', name:'M2O', ntv:'', vavoo:'m2o', daddy:'', vid6:'215827632', vid7:'' },
  { slug:'tv2000', name:'TV2000', ntv:'', vavoo:'tv 2000', daddy:'', vid6:'1949044924', vid7:'1133734972' },
  { slug:'tgcom-24', name:'TGCom 24', ntv:'', vavoo:'tgcom 24', daddy:'', vid6:'2418148449', vid7:'1785098768' },
  { slug:'tg-norba-24', name:'Tg Norba 24', ntv:'', vavoo:'tg norba 24', daddy:'', vid6:'3379729817', vid7:'3413557893' },
  { slug:'bloomberg-tv', name:'Bloomberg TV', ntv:'', vavoo:'bloomberg tv', daddy:'', vid6:'', vid7:'116299718' },
  { slug:'france-24', name:'France 24', ntv:'', vavoo:'france 24', daddy:'', vid6:'', vid7:'2179686828' },
  { slug:'euronews', name:'Euronews', ntv:'', vavoo:'euronews', daddy:'', vid6:'490955579', vid7:'' },
  { slug:'animal-planet', name:'Animal Planet', ntv:'', vavoo:'animal planet', daddy:'', vid6:'', vid7:'1908877526' },
  { slug:'rakuten-top-free', name:'Rakuten Top Free', ntv:'', vavoo:'rakuten top free', daddy:'', vid6:'', vid7:'1572866962' },
  { slug:'rakuten-comedy-movies', name:'Rakuten Comedy Movies', ntv:'', vavoo:'rakuten comedy movies', daddy:'', vid6:'', vid7:'1109372778' },
  { slug:'rakuten-drama', name:'Rakuten Drama', ntv:'', vavoo:'rakuten drama', daddy:'', vid6:'', vid7:'2098624390' },
  { slug:'rakuten-family', name:'Rakuten Family', ntv:'', vavoo:'rakuten family', daddy:'', vid6:'', vid7:'3902650955' },
  { slug:'rakuten-tv-shows', name:'Rakuten TV Shows', ntv:'', vavoo:'rakuten tv shows', daddy:'', vid6:'', vid7:'86091226' },
  { slug:'super-tennis', name:'Super Tennis', ntv:'', vavoo:'super tennis', daddy:'', vid6:'3213195143', vid7:'3009377513' },
  { slug:'sport-italia', name:'Sport Italia', ntv:'', vavoo:'sport italia', daddy:'', vid6:'', vid7:'2881739927' },
  { slug:'mtv-hits', name:'MTV Hits', ntv:'', vavoo:'mtv hits', daddy:'', vid6:'', vid7:'3446813098' },
  { slug:'cielo', name:'Cielo', ntv:'', vavoo:'cielo', daddy:'', vid6:'2719953688', vid7:'3743894403' },
  { slug:'sky-super-tennis', name:'Sky Super Tennis', ntv:'', vavoo:'sky super tennis', daddy:'', vid6:'', vid7:'558282118' }
];

const ALIASES = {
  'dazn':'dazn-1','dazn-zona':'zona-dazn','serie-a':'sky-sport-serie-a',
  'sky-calcio-1':'sky-sport-calcio','sky-calcio-2':'sky-sport-calcio','sky-calcio-3':'sky-sport-calcio',
  'sky-sport-24-ntv':'sky-sport-24','sky-sport-uno-italy':'sky-sport-uno',
  'nove':'nove','tv-8':'tv8','rai-news':'rai-news-24','rai-news':'rai-news-24',
  'mediaset-20':'mediaset-20','20-mediaset':'mediaset-20','20mediaset':'mediaset-20'
};

const BY_KEY = (() => {
  const m = new Map();
  for (const c of CHANNELS) {
    m.set(c.slug, c); m.set(norm(c.name), c);
    if (c.ntv) m.set(c.ntv, c);
    if (c.daddy) m.set('d'+c.daddy, c);
    if (c.vid6) m.set('v'+c.vid6, c);
    if (c.vid7) m.set('v'+c.vid7, c);
  }
  for (const [a,s] of Object.entries(ALIASES)) { const c = m.get(s); if (c) m.set(a, c); }
  return m;
})();

function norm(s){ return String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function findCh(q){ let k=norm(q); if(BY_KEY.has(k)) return BY_KEY.get(k); k=k.replace(/-ntv$/,'').replace(/-daddy$/,''); return BY_KEY.get(k)||null; }

function elencoCanali(u){
  const search=(u&&u.searchParams.get('q'))||'';
  const L=[CONFIG.VERSION+' — CANALI ('+CHANNELS.length+')'];
  L.push('Uso: /live?ch=<slug>   /live?ch=X&res=720   /live?ch=X&fail=1');
  L.push('');
  for(const c of CHANNELS){
    if(search && !c.slug.includes(search) && !c.name.toLowerCase().includes(search)) continue;
    const q = qualityStore.get(c.slug);
    const maxRes = q ? q.maxRes : 1080;
    L.push('  '+c.slug.padEnd(24)+' ntv='+String(c.ntv).padEnd(4)+' v6='+(c.vid6||'-').padEnd(12)+' v7='+(c.vid7||'-').padEnd(12)+' maxRes='+maxRes);
  }
  return L.join('\n');
}

// ============================================================================
// QUALITY-LOCK — gestisce la risoluzione massima per ogni canale
// ============================================================================
const qualityStore = new Map();

function getQuality(slug){
  const q = qualityStore.get(slug);
  if(!q || Date.now()-q.t > CONFIG.QUALITY_TTL){
    return { maxRes: 1080, t: Date.now(), fails: 0 };
  }
  return q;
}

function degradeQuality(slug){
  const q = getQuality(slug);
  const idx = CONFIG.RES_LADDER.indexOf(q.maxRes);
  if(idx >= 0 && idx < CONFIG.RES_LADDER.length-1){
    q.maxRes = CONFIG.RES_LADDER[idx+1];
    q.fails++;
    q.t = Date.now();
    qualityStore.set(slug, q);
    log('⬇️ Quality degrade '+slug+' → '+q.maxRes+'p');
    return q.maxRes;
  }
  return q.maxRes;
}

function resetQuality(slug){
  qualityStore.set(slug, { maxRes: 1080, t: Date.now(), fails: 0 });
  log('🔄 Quality reset '+slug+' → 1080p');
}

function setQuality(slug, res){
  qualityStore.set(slug, { maxRes: res, t: Date.now(), fails: 0 });
  log('🎯 Quality set '+slug+' → '+res+'p');
}

// ============================================================================
// HEALTH CHECK VAVOO
// ============================================================================
const VAVOO_HEALTH_TTL = 10*60*1000;
const vavooHealth = new Map();

function getVavooHealth(slug){
  const h = vavooHealth.get(slug);
  if(!h) return { prefer7:false, t:0, fails6:0, fails7:0 };
  if(Date.now()-h.t > VAVOO_HEALTH_TTL){ vavooHealth.delete(slug); return { prefer7:false,t:0,fails6:0,fails7:0 }; }
  return h;
}
function updateVavooHealth(slug, winnerId){
  const h = getVavooHealth(slug);
  h.t=Date.now(); h.prefer7=(winnerId===7);
  h.fails6 = winnerId===6 ? 0 : h.fails6+1;
  h.fails7 = winnerId===7 ? 0 : h.fails7+1;
  vavooHealth.set(slug, h);
}
function recordVavooFail(slug, idNum){
  const h = getVavooHealth(slug);
  h.t=Date.now();
  if(idNum===6) h.fails6++; else h.fails7++;
  if(h.fails6>=2) h.prefer7=true;
  if(h.fails7>=2) h.prefer7=false;
  vavooHealth.set(slug, h);
}

// ============================================================================
// NTV
// ============================================================================
const NTV_API = 'https://chat.cfbu247.sbs/api/resolve-dlstream/';
const tokenCache = new Map();
let ntvStats = { resolve:0, refresh:0, err:0 };
const MAX_TOKEN_CACHE = 50;

async function ntvToken(id){
  const now=Date.now()/1000; const c=tokenCache.get(id);
  if(c && c.exp-now>900) return c;
  if(tokenCache.size>MAX_TOKEN_CACHE){ const keys=Array.from(tokenCache.keys()); for(let i=0;i<keys.length-MAX_TOKEN_CACHE;i++) tokenCache.delete(keys[i]); }
  ntvStats.resolve++;
  const r=await fetchT(NTV_API+id,{headers:getBrowserHeaders('https://tvnow247.today/')},8000);
  if(!r.ok){ ntvStats.err++; throw new Error('ntv api '+r.status); }
  const j=await r.json().catch(()=>null);
  const m3u8=j&&(j.m3u8||j.proxyPlaylistUrl||j.proxyPlayerUrl);
  if(!m3u8){ ntvStats.err++; throw new Error('ntv api senza m3u8'); }
  const exp=+(String(m3u8).match(/[?&]e=(\d+)/)||[])[1]||(now+3600);
  const entry={m3u8,exp,ref:(j&&j.referer)||'https://tvnow247.today/'};
  tokenCache.set(id,entry); return entry;
}

async function ntvPlaylist(id){
  let tk=await ntvToken(id);
  let r=await fetchT(tk.m3u8,{headers:getBrowserHeaders(tk.ref)},8000);
  let txt=r.ok?await r.text():'';
  const bad=!r.ok||r.status>=500||!txt.includes('#EXTM3U');
  if(bad){ tokenCache.delete(id); ntvStats.refresh++; tk=await ntvToken(id); r=await fetchT(tk.m3u8,{headers:getBrowserHeaders(tk.ref)},8000); txt=r.ok?await r.text():''; }
  if(!txt.includes('#EXTM3U')) throw new Error('ntv playlist '+r.status+' non-HLS');
  return {txt,ref:tk.ref,base:tk.m3u8};
}

// ============================================================================
// DADDY
// ============================================================================
const DADDY_DOMAINS=['https://thedaddy.li','https://daddylivetv.sbs'];
const daddyCache=new Map();
const DADDY_TTL=3*60*1000;
const MAX_DADDY_CACHE=100;

async function daddyResolve(id){
  if(!id) return null;
  const now=Date.now(); const cached=daddyCache.get(id);
  if(cached&&cached.exp>now) return cached.url;
  if(daddyCache.size>MAX_DADDY_CACHE){ const keys=Array.from(daddyCache.keys()); for(let i=0;i<keys.length-MAX_DADDY_CACHE;i++) daddyCache.delete(keys[i]); }
  for(const domain of DADDY_DOMAINS){
    try{
      let m3u8=await extractM3u8FromEmbed(`${domain}/embed/stream-${id}.php`,domain,5000);
      if(m3u8){ daddyCache.set(id,{url:m3u8,exp:now+DADDY_TTL}); return m3u8; }
      m3u8=await extractM3u8FromEmbed(`${domain}/watch.php?id=${id}`,domain,5000);
      if(m3u8){ daddyCache.set(id,{url:m3u8,exp:now+DADDY_TTL}); return m3u8; }
    }catch(e){ continue; }
  }
  return null;
}

async function extractM3u8FromEmbed(url,refererDomain,timeoutMs){
  const r=await fetchT(url,{headers:getBrowserHeaders(refererDomain+'/'),cf:{cacheTtl:300,cacheEverything:true}},timeoutMs);
  if(!r.ok) return null;
  const html=await r.text();
  let m3u8=html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if(m3u8) return m3u8[1];
  const iframe=html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
  if(iframe){
    const r2=await fetchT(iframe[1],{headers:getBrowserHeaders(url),cf:{cacheTtl:300,cacheEverything:true}},timeoutMs);
    if(r2.ok){
      const html2=await r2.text();
      m3u8=html2.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
      if(m3u8) return m3u8[1];
      const iframe2=html2.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
      if(iframe2){
        const r3=await fetchT(iframe2[1],{headers:getBrowserHeaders(iframe[1]),cf:{cacheTtl:300,cacheEverything:true}},timeoutMs);
        if(r3.ok){ const html3=await r3.text(); m3u8=html3.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i); if(m3u8) return m3u8[1]; }
      }
    }
  }
  return null;
}

function getBrowserHeaders(referer){
  return {
    'User-Agent':UA,'Accept':'*/*','Accept-Language':'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer':referer,'Origin':referer.replace(/\/$/,''),
    'Sec-Fetch-Dest':'empty','Sec-Fetch-Mode':'cors','Sec-Fetch-Site':'cross-site','Upgrade-Insecure-Requests':'1'
  };
}

// ============================================================================
// VAVOO
// ============================================================================
const VAVOO_MIRRORS=['https://geil.to','https://geil.app','https://geil.win','https://vavoo.to','https://kool.to','https://vavoo.net','https://kool.ws','https://huhu.to','https://oha.to','https://voltop.net'];
const VAVOO_SOURCES=['https://raw.githubusercontent.com/aphrodite747/VvOo/main/index_Italy.m3u','https://raw.githubusercontent.com/BontAce/VVOOITV/main/index_Italy.m3u'];
let vavooMap={map:null,t:0,src:''};
const VAVOO_MAP_TTL=6*3600*1000;
function vavooMapGet(){ return (vavooMap.map&&Date.now()-vavooMap.t<VAVOO_MAP_TTL)?vavooMap.map:null; }

async function ensureVavooMap(force){
  const cached=vavooMapGet(); if(cached&&!force) return cached;
  for(const src of VAVOO_SOURCES){
    try{
      const r=await fetchT(src,{headers:{'User-Agent':'VAVOO/1.0'}},10000); if(!r.ok) continue;
      const t=await r.text(); const m=new Map();
      for(const b of t.split('#EXTINF')){
        const nm=(b.match(/tvg-name="([^"]+)"/)||[])[1];
        const id=(b.match(/vavoo\/(\d+)\.m3u8/)||[])[1];
        if(nm&&id){ const k=norm(nm.replace(/\s*\(\d+\)\s*$/,'')); if(k&&!m.has(k)) m.set(k,id); }
      }
      if(m.size>50){ vavooMap={map:m,t:Date.now(),src}; return m; }
    }catch(e){}
  }
  return cached;
}

function vavooMapFind(query,m){
  if(!m||!query) return null;
  const q=norm(query); if(m.has(q)) return m.get(q);
  const qTok=q.split('-').filter(Boolean);
  let best=null,bestScore=-1;
  for(const [k,id] of m){
    const kTok=k.split('-').filter(Boolean);
    if(qTok.every(w=>kTok.includes(w))){
      const score=qTok.length-(kTok.length-qTok.length);
      if(score>bestScore){ bestScore=score; best=id; }
    }
  }
  return best;
}

function vavooHeaders(extra){ return Object.assign({'User-Agent':'MediaHubMX/2','Accept':'application/json','Origin':'https://vavoo.to','Referer':'https://vavoo.to/'},extra||{}); }

async function vavooResolveId(base,id){
  const play=base+'/live/play/'+id;
  try{ const r=await fetchT(base+'/live/resolve?url='+encodeURIComponent(play),{headers:getBrowserHeaders(base+'/')},5000); if(r.ok){ const j=await r.json().catch(()=>null); if(j&&j.url) return j.url; } }catch(e){}
  try{ const r=await fetchT(base+'/mediahubmx-resolve.json',{method:'POST',headers:vavooHeaders({'Content-Type':'application/json','Origin':base,'Referer':base+'/'}),body:JSON.stringify({language:'de',region:'DE',url:play,clientVersion:'3.0.2'})},5000); if(r.ok){ const j=await r.json().catch(()=>null); if(j&&j.url) return j.url; } }catch(e){}
  return null;
}

async function vavooLiveFind(base,query){
  try{
    const rl=await fetchT(base+'/mediahubmx-list.json',{method:'POST',headers:vavooHeaders({'Content-Type':'application/json','Origin':base,'Referer':base+'/'}),body:JSON.stringify({language:'it',region:'IT',clientVersion:'3.0.2',url:base+'/live'})},5000);
    if(!rl.ok) return null;
    const j=await rl.json().catch(()=>null);
    const items=j&&(j.items||j.channels||j.entries)||[];
    const tmp=new Map();
    for(const it of items){
      const nm=it.name||it.title||'';
      const iid=it.id||((it.url||'').match(/play\/(\d+)/)||[])[1];
      if(nm&&iid){ const k=norm(nm.replace(/\s*\(\d+\)\s*$/,'')); if(k&&!tmp.has(k)) tmp.set(k,String(iid)); }
    }
    return vavooMapFind(query,tmp);
  }catch(e){ return null; }
}

const vavooURLCache=new Map();
const VAVOO_URL_TTL=2*60*1000;

async function vavooResolveDual(slug,query,vid6,vid7){
  const now=Date.now();
  const cacheKey=slug||('q:'+norm(query));
  const cachedUrl=vavooURLCache.get(cacheKey);
  if(cachedUrl&&cachedUrl.exp>now) return cachedUrl.url;
  const health=getVavooHealth(slug||query);
  let firstId,secondId,firstNum,secondNum;
  if(health.prefer7&&vid7){ firstId=vid7; secondId=vid6; firstNum=7; secondNum=6; }
  else{ firstId=vid6; secondId=vid7; firstNum=6; secondNum=7; }
  if(!firstId&&!secondId){ const m=await ensureVavooMap(); firstId=vavooMapFind(query,m); }
  if(firstId){ const url=await tryVavooId(firstId); if(url){ updateVavooHealth(slug||query,firstNum); vavooURLCache.set(cacheKey,{url,exp:now+VAVOO_URL_TTL}); return url; } recordVavooFail(slug||query,firstNum); }
  if(secondId){ const url=await tryVavooId(secondId); if(url){ updateVavooHealth(slug||query,secondNum); vavooURLCache.set(cacheKey,{url,exp:now+VAVOO_URL_TTL}); return url; } recordVavooFail(slug||query,secondNum); }
  if(!firstId&&!secondId){
    for(const base of VAVOO_MIRRORS.slice(0,2)){
      const id2=await vavooLiveFind(base,query);
      if(id2){ for(const b2 of VAVOO_MIRRORS.slice(0,6)){ const u=await vavooResolveId(b2,id2); if(u){ vavooURLCache.set(cacheKey,{url:u,exp:now+VAVOO_URL_TTL}); return u; } } }
    }
  }
  return null;
}

async function tryVavooId(id){
  for(const base of VAVOO_MIRRORS.slice(0,6)){ const u=await vavooResolveId(base,id); if(u) return u; }
  return null;
}

async function vavooResolve(query,vid){
  const c=findCh(query);
  if(c) return await vavooResolveDual(c.slug,c.vavoo||query,c.vid6,c.vid7);
  return await vavooResolveDual(null,query,vid,null);
}

// ============================================================================
// ⭐ VARIANTE INTELLIGENTE: 1080p H.264 default, fallback automatico
// ============================================================================
function parseMasterPlaylist(body){
  const lines=body.split(/\r?\n/);
  const variants=[]; let current=null;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(line.startsWith('#EXT-X-STREAM-INF:')){
      const attrs={};
      const attrStr=line.substring('#EXT-X-STREAM-INF:'.length);
      const re=/([A-Z-]+)=("[^"]*"|[^,]+)/g; let m;
      while((m=re.exec(attrStr))!==null) attrs[m[1]]=m[2].replace(/^"|"$/g,'');
      current={attrs,index:variants.length};
    } else if(current&&line&&!line.startsWith('#')){
      current.uri=line; variants.push(current); current=null;
    }
  }
  return variants;
}

function codecIsH264(codecs){ return !!codecs && codecs.split(',').some(c=>c.trim().startsWith('avc1')); }
function codecIsHEVC(codecs){ return !!codecs && codecs.split(',').some(c=>c.trim().startsWith('hvc1')||c.trim().startsWith('hev1')); }
function getResHeight(res){ if(!res) return 0; const m=res.match(/x(\d+)/i); return m?parseInt(m[1]):0; }

// 🔥 LOGICA CHIAVE: sceglie H.264 alla risoluzione massima disponibile ≤ maxRes
function selectVariantSmart(variants, maxRes){
  // 1) Filtra SOLO H.264 (mai HEVC di default)
  const h264 = variants.filter(v => codecIsH264(v.attrs.CODECS));
  
  // 2) Se ci sono H.264, scegli quella con risoluzione più alta MA ≤ maxRes
  if(h264.length > 0){
    const eligible = h264.filter(v => getResHeight(v.attrs.RESOLUTION) <= maxRes);
    if(eligible.length > 0){
      return eligible.reduce((a,b) => getResHeight(a.attrs.RESOLUTION) >= getResHeight(b.attrs.RESOLUTION) ? a : b);
    }
    // Se nessuna ≤ maxRes, usa la più bassa disponibile (comunque H.264)
    return h264.reduce((a,b) => getResHeight(a.attrs.RESOLUTION) <= getResHeight(b.attrs.RESOLUTION) ? a : b);
  }
  
  // 3) Nessun H.264: usa HEVC come ULTIMA spiaggia (rischio schermo nero)
  const hevc = variants.filter(v => codecIsHEVC(v.attrs.CODECS));
  if(hevc.length > 0){
    const eligible = hevc.filter(v => getResHeight(v.attrs.RESOLUTION) <= maxRes);
    if(eligible.length > 0) return eligible.reduce((a,b) => getResHeight(a.attrs.RESOLUTION) >= getResHeight(b.attrs.RESOLUTION) ? a : b);
    return hevc[0];
  }
  
  // 4) Nessun codec dichiarato: prendi la più alta ≤ maxRes
  if(variants.length === 0) return null;
  const eligible = variants.filter(v => getResHeight(v.attrs.RESOLUTION) <= maxRes);
  if(eligible.length > 0) return eligible.reduce((a,b) => getResHeight(a.attrs.RESOLUTION) >= getResHeight(b.attrs.RESOLUTION) ? a : b);
  return variants.reduce((a,b) => getResHeight(a.attrs.RESOLUTION) <= getResHeight(b.attrs.RESOLUTION) ? a : b);
}

// ============================================================================
// LIVE
// ============================================================================
let lastPl={key:'',txt:'',t:0};

async function live(u,P,legacy){
  countReq('live');
  const q=u.searchParams.get('ch')||u.searchParams.get('c')||'';
  if(!q) return R('uso: /live?ch=<slug>\n\n'+elencoCanali(u),200,TXT());
  const c=findCh(q);
  if(!c) return R('canale non mappato: "'+q+'"\n\n'+elencoCanali(u),200,TXT());

  // 🎯 Quality-Lock: comandi per l'utente
  if(u.searchParams.get('fail')==='1') degradeQuality(c.slug);
  if(u.searchParams.get('reset')==='1') resetQuality(c.slug);
  const resParam = u.searchParams.get('res');
  if(resParam){ const r=parseInt(resParam); if(CONFIG.RES_LADDER.includes(r)) setQuality(c.slug,r); }

  const order = legacy ? [legacy,...['vavoo','daddy','ntv'].filter(x=>x!==legacy)]
    : (u.searchParams.get('p')||'vavoo,daddy,ntv').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);

  const availableOrder = order.filter(p=>{
    if(p==='vavoo') return c.vavoo||c.vid6||c.vid7;
    if(p==='ntv') return c.ntv;
    if(p==='daddy') return c.daddy;
    return true;
  });

  const maxRes = getQuality(c.slug).maxRes;
  const ck=c.slug+':'+availableOrder.join('.')+':'+maxRes;
  if(lastPl.key===ck&&Date.now()-lastPl.t<1500) return R(lastPl.txt,200,HLS_NO_CACHE());

  const provs={
    vavoo: async()=>{
      if(!c.vavoo&&!c.vid6&&!c.vid7) return null;
      const vu=await vavooResolveDual(c.slug,c.vavoo,c.vid6,c.vid7);
      if(!vu) return null;
      if(/\.m3u8(\?|$)/i.test(vu)){
        const r=await fetchT(vu,{headers:vavooHeaders({'User-Agent':'VAVOO/1.0'})},8000);
        if(!r.ok){ recordVavooFail(c.slug,6); recordVavooFail(c.slug,7); vavooURLCache.delete(c.slug); return null; }
        const out=rewriteAny(await r.text(),vu,P,'https://vavoo.to/','https://vavoo.to',maxRes);
        lastPl={key:ck,txt:out,t:Date.now()};
        return R(out,200,HLS_NO_CACHE());
      }
      return R('redirect vavoo',302,{Location:vu,...CORS()});
    },
    ntv: async()=>{
      if(!c.ntv) return null;
      const pl=await ntvPlaylist(c.ntv);
      const out=rewriteAny(pl.txt,pl.base,P,pl.ref,'',maxRes);
      lastPl={key:ck,txt:out,t:Date.now()};
      return R(out,200,HLS_NO_CACHE());
    },
    daddy: async()=>{
      if(!c.daddy) return null;
      const du=await daddyResolve(c.daddy);
      if(!du||!/\.m3u8/i.test(du)) return null;
      const r=await fetchT(du,{headers:getBrowserHeaders('https://thedaddy.li/')},8000);
      if(!r.ok){ daddyCache.delete(c.daddy); return null; }
      const processed=rewriteAny(await r.text(),du,P,'https://thedaddy.li/','',maxRes);
      const finalTxt=['#EXTVLCOPT:http-referrer=https://thedaddy.li/','#EXTVLCOPT:http-user-agent='+UA].concat(processed.split('\n')).join('\n');
      lastPl={key:ck,txt:finalTxt,t:Date.now()};
      return R(finalTxt,200,HLS_NO_CACHE());
    }
  };

  for(const p of availableOrder){ const fn=provs[p]; if(!fn) continue; try{ const res=await fn(); if(res) return res; }catch(e){ log(p+' ko '+c.slug+': '+(e&&e.message)); } }
  return R('ERRORE: provider KO ('+availableOrder.join(' -> ')+') per '+c.name+'. /probe?ch='+c.slug,200,TXT());
}

// ============================================================================
// REWRITE HLS
// ============================================================================
function rewriteAny(txt,baseUrl,P,ref,origin,maxRes){
  txt=String(txt);
  if(!txt.includes('#EXTM3U')) throw new Error('risposta non-HLS');
  if(/#EXT-X-STREAM-INF/.test(txt)){
    const variants=parseMasterPlaylist(txt);
    const chosen=selectVariantSmart(variants,maxRes||1080);
    if(!chosen) throw new Error('nessuna variante');
    const baseDir=baseUrl.substring(0,baseUrl.lastIndexOf('/')+1);
    const mediaUrl=resolveUri(baseDir,chosen.uri);
    return '#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION='+chosen.attrs.RESOLUTION+',CODECS='+chosen.attrs.CODECS+'\n'+proxUrl(mediaUrl,P,ref,origin);
  }
  return rewriteMediaPl(txt,baseUrl,P,ref,origin);
}

function parseMediaPl(txt){
  let upSeq=0,upTarget=4,map=null,isMaster=false;
  const segs=[]; let pending=null,disc=false,brange=null;
  for(const raw of String(txt).split(/\r?\n/)){
    const line=raw.trim();
    if(!line) continue;
    if(line.startsWith('#EXT-X-STREAM-INF')){ isMaster=true; break; }
    if(line.startsWith('#EXTM3U')) continue;
    if(line.startsWith('#EXT-X-TARGETDURATION:')){ upTarget=parseInt(line.split(':')[1])||4; continue; }
    if(line.startsWith('#EXT-X-MEDIA-SEQUENCE:')){ upSeq=parseInt(line.split(':')[1])||0; continue; }
    if(line.startsWith('#EXT-X-MAP')){ map=line; continue; }
    if(line.startsWith('#EXT-X-DISCONTINUITY')){ disc=true; continue; }
    if(line.startsWith('#EXT-X-BYTERANGE')){ brange=line; continue; }
    if(line.startsWith('#EXTINF')){
      pending={extinf:line,dur:parseFloat((line.match(/#EXTINF:([\d.]+)/)||[])[1])||0,disc,brange};
      disc=false; brange=null; continue;
    }
    if(line.startsWith('#')) continue;
    if(pending){ pending.url=line; segs.push(pending); pending=null; }
  }
  return {upSeq,upTarget,map,segs,isMaster};
}

function absSegUrl(url,baseUrl){
  if(/^https?:\/\//i.test(url)) return url;
  let abs;
  if(url.startsWith('/')) abs=new URL(baseUrl).origin+url;
  else abs=baseUrl.replace(/[^/]*$/,'')+url.replace(/^\.\//,'');
  return abs.replace(/([^:])\/{2,}/g,'$1/');
}

function resolveUri(base,rel){ try{ return new URL(rel,base).href; }catch{ return rel; } }

function proxUrl(abs,P,ref,origin){
  const bust=Math.floor(Date.now()/5000)*5000;
  const withBust=abs+(abs.includes('?')?'&':'?')+'_t='+bust;
  let u=P+'/seg?u='+encodeURIComponent(withBust);
  if(ref) u+='&ref='+encodeURIComponent(ref);
  if(origin) u+='&o='+encodeURIComponent(origin);
  return u;
}

function rewriteMediaPl(txt,baseUrl,P,ref,origin){
  const p=parseMediaPl(txt);
  if(p.isMaster||!p.segs.length) return rewriteMaster(txt,baseUrl,P,ref,origin);
  const maxSegs=8;
  const kept=p.segs.slice(-maxSegs);
  const dropped=p.segs.length-kept.length;
  const out=['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-TARGETDURATION:'+p.upTarget,'#EXT-X-MEDIA-SEQUENCE:'+(p.upSeq+dropped)];
  if(p.map){
    const mu=(p.map.match(/URI="([^"]+)"/)||[])[1];
    if(mu) out.push('#EXT-X-MAP:URI="'+proxUrl(absSegUrl(mu,baseUrl),P,ref,origin)+'"');
  }
  kept.forEach((s,idx)=>{
    if(s.disc&&idx>0) out.push('#EXT-X-DISCONTINUITY');
    out.push(s.extinf);
    if(s.brange) out.push(s.brange);
    out.push(proxUrl(absSegUrl(s.url,baseUrl),P,ref,origin));
  });
  return out.join('\n');
}

function rewriteMaster(txt,baseUrl,P,ref,origin){
  const out=[];
  for(const raw of String(txt).split(/\r?\n/)){
    const line=raw.trim();
    if(!line) continue;
    if(line.startsWith('#')){ out.push(line); continue; }
    let u=P+'/seg?u='+encodeURIComponent(absSegUrl(line,baseUrl));
    if(ref) u+='&ref='+encodeURIComponent(ref);
    if(origin) u+='&o='+encodeURIComponent(origin);
    out.push(u);
  }
  return out.join('\n');
}

// ============================================================================
// SEG
// ============================================================================
async function seg(u){
  countReq('seg');
  const target=u.searchParams.get('u'); if(!target) return R('uso: /seg?u=<url>',200,TXT());
  const ref=u.searchParams.get('ref')||'https://thedaddy.li/';
  const h=getBrowserHeaders(ref);
  const o=u.searchParams.get('o'); if(o) h['Origin']=o;
  const range=u.searchParams.get('range'); if(range) h['Range']=range;
  if(ref.includes('thedaddy')){ h['Referer']='https://thedaddy.li/'; h['Origin']='https://thedaddy.li'; }
  if(/\.m3u8(\?|$)/i.test(target)){
    const r=await fetchT(target,{headers:h,cf:{cacheTtl:0}},10000);
    if(!r.ok) return R('upstream '+r.status,r.status,TXT());
    const txt=await r.text();
    const baseDir=target.substring(0,target.lastIndexOf('/')+1)||target;
    const out=rewriteAny(txt,baseDir,u.origin,ref,o||'',1080);
    return R(out,200,HLS_NO_CACHE());
  }
  const cfOpt=range?{cacheTtl:0}:{cacheTtl:5,cacheEverything:true};
  const r=await fetchT(target,{headers:h,cf:cfOpt},15000);
  const hh={'content-type':r.headers.get('content-type')||'video/mp2t','access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-allow-headers':'Range, User-Agent, Referer, Origin','cache-control':range?'no-cache':'public, max-age=5','pragma':range?'no-cache':''};
  const cl=r.headers.get('content-length'); const cr=r.headers.get('content-range'); if(cl) hh['content-length']=cl; if(cr) hh['content-range']=cr;
  return new Response(r.body,{status:r.status,headers:hh});
}

// ============================================================================
// CHECKSEG
// ============================================================================
async function checkseg(u){
  const source=u.searchParams.get('s')||'vavoo';
  const ch=u.searchParams.get('ch')||'sky-sport-24';
  const L=['=== CHECK SEGMENTO REALE ===','Fonte: '+source,'Canale: '+ch,''];
  try{
    let segUrl='',headers={},txt='';
    if(source==='ntv'){ const pl=await ntvPlaylist(ch); txt=pl.txt; headers=getBrowserHeaders(pl.ref); }
    else if(source==='daddy'){ const du=await daddyResolve(ch); if(!du) return R('Daddy: URL non risolto',200,TXT()); const r=await fetchT(du,{headers:getBrowserHeaders('https://thedaddy.li/')},8000); if(!r.ok) return R('Daddy HTTP '+r.status,200,TXT()); txt=await r.text(); headers=getBrowserHeaders('https://thedaddy.li/'); }
    else if(source==='vavoo'){ const c=findCh(ch); if(!c) return R('Vavoo: Canale non trovato',200,TXT()); const vu=await vavooResolveDual(c.slug,c.vavoo,c.vid6,c.vid7); if(!vu) return R('Vavoo: URL non risolto',200,TXT()); const r=await fetchT(vu,{headers:vavooHeaders({'User-Agent':'VAVOO/1.0'})},8000); if(!r.ok) return R('Vavoo HTTP '+r.status,200,TXT()); txt=await r.text(); headers=vavooHeaders({'User-Agent':'VAVOO/1.0'}); }
    const lines=txt.split('\n');
    let isMaster=txt.includes('#EXT-X-STREAM-INF');
    if(isMaster){
      const variants=parseMasterPlaylist(txt);
      const chosen=selectVariantSmart(variants,1080);
      L.push('Varianti trovate: '+variants.length);
      variants.forEach((v,i)=>{
        const c=v.attrs.CODECS||'?';
        const h264=codecIsH264(c)?'✅H264':(codecIsHEVC(c)?'⚠️HEVC':'❓');
        const sel=(chosen===v)?' ← SCELTA':'';
        L.push('  ['+i+'] '+v.attrs.RESOLUTION+' | '+c+' | '+h264+sel);
      });
      if(chosen){ const baseDir=txt.match(/#EXT-X-STREAM-INF/)?lines.find((l,i,a)=>!l.startsWith('#')&&l.trim()&&i>0):''; segUrl=resolveUri(lines.find((l,i,a)=>!l.startsWith('#')&&l.trim())||'',chosen.uri); }
    } else {
      for(let i=0;i<lines.length;i++){ if(lines[i].trim().startsWith('#EXTINF')&&lines[i+1]&&!lines[i+1].trim().startsWith('#')){ segUrl=lines[i+1].trim(); break; } }
    }
    if(!segUrl) return R('Nessun URL trovato',200,TXT());
    if(!segUrl.startsWith('http')){ L.push('⚠️ URL relativo: '+segUrl); return R(L.join('\n'),200,TXT()); }
    L.push('URL testato: '+segUrl+'\n');
    const r=await fetchT(segUrl,{headers},10000);
    L.push('HTTP Status: '+r.status+'\nContent-Type: '+r.headers.get('content-type')+'\n');
    const buf=await r.arrayBuffer(); const bytes=new Uint8Array(buf);
    L.push('Dimensione: '+bytes.length+' bytes\n');
    const hex=Array.from(bytes.slice(0,16)).map(b=>b.toString(16).padStart(2,'0')).join(' ');
    L.push('Primi 16 bytes (hex): '+hex+'\n');
    if(bytes.length>=4){
      if(bytes[0]===0x47) L.push('✅ Formato: MPEG-TS - COMPATIBILE');
      else if(String.fromCharCode(bytes[4],bytes[5],bytes[6],bytes[7])==='ftyp') L.push('✅ Formato: fMP4 - COMPATIBILE');
      else{ const text=String.fromCharCode(...bytes.slice(0,100)); if(text.includes('<html')||text.includes('<!DOCTYPE')) L.push('❌ Formato: HTML - NON È VIDEO'); else L.push('❓ Formato: SCONOSCIUTO'); }
    }
    return R(L.join('\n'),200,TXT());
  }catch(e){ return R('ERRORE: '+e.message,200,TXT()); }
}

// ============================================================================
// WARM, PROBE, VMAP, DIAG, DEBUG, FEATURES
// ============================================================================
async function warm(){
  const t0=Date.now();
  const ids=['869','461','870','576','462','875','460','577','575','574','877','878','879','871','872','873','860','861','862','859','864','865','867','868','863','880'];
  let ok=0,err=0;
  for(let i=0;i<ids.length;i+=8){ await Promise.all(ids.slice(i,i+8).map(async id=>{ try{ await ntvToken(id); ok++; }catch(e){ err++; } })); }
  const vavooChannels=['sky sport 24','sky sport uno','sky sport calcio','sky sport tennis','dazn 1','eurosport 1','rsi la 1','rsi la 2','sky sport f1','sky sport motogp'];
  for(const ch of vavooChannels){ try{ await vavooResolve(ch,null); }catch(e){} }
  try{ await ensureVavooMap(); }catch(e){}
  const msg='WARM ok='+ok+' err='+err+' ('+(Date.now()-t0)+'ms) ntv='+tokenCache.size+'/'+MAX_TOKEN_CACHE+' daddy='+daddyCache.size+'/'+MAX_DADDY_CACHE+' health='+vavooHealth.size+' quality='+qualityStore.size;
  log(msg); return R(msg,200,TXT());
}

async function probe(u){
  const q=u.searchParams.get('ch')||''; const c=findCh(q);
  if(!c) return 'canale non mappato: "'+q+'"\n\n'+elencoCanali(u);
  const L=['PROBE '+c.name+' (maxRes='+getQuality(c.slug).maxRes+'p)'];
  const h=getVavooHealth(c.slug);
  L.push('Health: prefer7='+h.prefer7+' fails6='+h.fails6+' fails7='+h.fails7);
  try{ const t0=Date.now(); const vu=(c.vavoo||c.vid6||c.vid7)?await vavooResolveDual(c.slug,c.vavoo,c.vid6,c.vid7):null; L.push('1) VAVOO: '+(vu?'OK ('+(Date.now()-t0)+'ms)':'skip')); }catch(e){ L.push('1) VAVOO: ERR '+e.message); }
  try{ if(!c.ntv) L.push('2) NTV: skip'); else{ const t0=Date.now(); const pl=await ntvPlaylist(c.ntv); L.push('2) NTV: OK '+(pl.txt.match(/#EXTINF/g)||[]).length+' segs ('+(Date.now()-t0)+'ms)'); } }catch(e){ L.push('2) NTV: ERR '+e.message); }
  try{ const t0=Date.now(); const du=c.daddy?await daddyResolve(c.daddy):null; L.push('3) DADDY: '+(du?'OK ('+(Date.now()-t0)+'ms)':'skip')); }catch(e){ L.push('3) DADDY: ERR '+e.message); }
  return L.join('\n');
}

async function vmap(u){
  const q=u.searchParams.get('ch')||'';
  const m=await ensureVavooMap(true); if(!m) return 'VMAP: nessuna fonte';
  const L=['VMAP: '+m.size+' canali ('+vavooMap.src+')'];
  const target=q?CHANNELS.filter(c=>c.slug.includes(q)||c.name.toLowerCase().includes(q)):CHANNELS;
  for(const c of target){
    const id6=c.vid6||vavooMapFind(c.vavoo,m);
    const id7=c.vid7||'';
    L.push((id6?'OK':'—')+' '+c.slug+' -> v6='+(id6||'non trovato')+(id7?' v7='+id7:''));
  }
  return L.join('\n');
}

async function diag(u){
  const q=u.searchParams.get('ch')||'sky-sport-24';
  const c=findCh(q);
  if(!c) return 'Canale non trovato: '+q;
  const h=getVavooHealth(c.slug);
  const qual=getQuality(c.slug);
  const L=['=== DIAGNOSTICA ('+CONFIG.VERSION+') ===','Canale: '+c.name+' (slug: '+c.slug+')',''];
  L.push('Quality-Lock: maxRes='+qual.maxRes+'p | fails='+qual.fails+' | età='+Math.floor((Date.now()-qual.t)/1000)+'s');
  L.push('Health: prefer7='+h.prefer7+' fails6='+h.fails6+' fails7='+h.fails7+' (TTL='+VAVOO_HEALTH_TTL/1000+'s)');
  L.push('Vavoo ID6: '+(c.vid6||'none')+' | ID7: '+(c.vid7||'none'));
  L.push('');
  const tryP=async(label,fn)=>{
    const t0=Date.now();
    try{
      const txt=await fn();
      L.push('— '+label+' ('+(Date.now()-t0)+'ms) —');
      L.push('OK | '+playlistStats(txt));
      if(/#EXT-X-STREAM-INF/.test(txt)){
        const variants=parseMasterPlaylist(txt);
        const chosen=selectVariantSmart(variants,qual.maxRes);
        L.push('   Varianti: '+variants.length+' | Scelta: '+getResHeight(chosen?.attrs.RESOLUTION)+'p '+(chosen?.attrs.CODECS||'?'));
        variants.forEach((v,i)=>{
          const c=v.attrs.CODECS||'?';
          const h264=codecIsH264(c)?'✅H264':(codecIsHEVC(c)?'⚠️HEVC':'❓');
          const sel=(chosen===v)?' ←':'';
          L.push('   ['+i+'] '+v.attrs.RESOLUTION+' | '+c+' | '+h264+sel);
        });
      }
    }catch(e){ L.push('— '+label+' ('+(Date.now()-t0)+'ms) —\nERRORE: '+(e&&e.message)); }
    L.push('');
  };
  if(c.vavoo||c.vid6||c.vid7) await tryP('VAVOO (dual)',async()=>{
    const vu=await vavooResolveDual(c.slug,c.vavoo,c.vid6,c.vid7);
    if(!vu) throw new Error('non risolto');
    const r=await fetchT(vu,{headers:vavooHeaders({'User-Agent':'VAVOO/1.0'})},8000);
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.text();
  });
  if(c.ntv) await tryP('NTV (ID: '+c.ntv+')',async()=>(await ntvPlaylist(c.ntv)).txt);
  if(c.daddy) await tryP('DADDY (ID: '+c.daddy+')',async()=>{
    const du=await daddyResolve(c.daddy);
    if(!du) throw new Error('non risolto');
    const r=await fetchT(du,{headers:getBrowserHeaders('https://thedaddy.li/')},8000);
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.text();
  });
  L.push('=== LOGICA QUALITY-LOCK ===');
  L.push('1. Default: 1080p H.264 (avc1)');
  L.push('2. HEVC (hvc1/hev1) SEMPRE scartato di default (schermo nero)');
  L.push('3. &fail=1 → scende a 720p, poi 480p, poi 360p, poi 240p');
  L.push('4. &reset=1 → torna a 1080p');
  L.push('5. &res=720 → forza manualmente 720p');
  L.push('6. TTL 30min: poi torna a 1080p');
  return L.join('\n');
}

function playlistStats(txt){
  const p=parseMediaPl(txt);
  if(/#EXT-X-STREAM-INF/.test(txt)){ const v=parseMasterPlaylist(txt); return 'master playlist, '+v.length+' varianti'; }
  const durs=p.segs.map(s=>s.dur||p.upTarget);
  const total=durs.reduce((a,b)=>a+b,0);
  return 'fonte '+p.segs.length+' segs / '+total.toFixed(1)+'s | finestra '+Math.min(p.segs.length,8)+' segs';
}

function debug(){
  const L=[CONFIG.VERSION,''];
  L.push('📋 SISTEMA');
  L.push('─────────────────────────────────────────────────────────');
  L.push('Canali DB:       '+CHANNELS.length);
  L.push('Quality-Lock:    '+qualityStore.size+' canali');
  L.push('Health Vavoo:    '+vavooHealth.size);
  L.push('');
  L.push('🔧 RESOLVER');
  L.push('─────────────────────────────────────────────────────────');
  L.push('NTV API:         '+NTV_API);
  L.push('Vavoo Mirrors:   '+VAVOO_MIRRORS.length);
  L.push('Daddy Domains:   '+DADDY_DOMAINS.length);
  L.push('');
  L.push('✨ FUNZIONALITÀ');
  L.push('─────────────────────────────────────────────────────────');
  CONFIG.FEATURES.forEach((f,i)=>{ L.push('  '+String(i+1).padStart(2)+'. '+f); });
  L.push('');
  L.push('🌐 ENDPOINT');
  L.push('─────────────────────────────────────────────────────────');
  L.push('  /live?ch=canale              Stream 1080p H.264 default');
  L.push('  /live?ch=canale&fail=1       ⬇️ Scendi risoluzione (720→480→360)');
  L.push('  /live?ch=canale&reset=1      🔄 Torna a 1080p');
  L.push('  /live?ch=canale&res=720      🎯 Forza risoluzione specifica');
  L.push('  /seg?u=...                   Proxy segmento');
  L.push('  /warm                        Riscaldamento cache');
  L.push('  /probe?ch=canale             Test rapido');
  L.push('  /diag?ch=canale              Diagnostica completa');
  L.push('  /checkseg?s=vavoo&ch=X       Test variante scelta');
  L.push('  /vmap?ch=canale              Varianti disponibili');
  L.push('  /ch?q=ricerca                Lista canali');
  L.push('  /debug                       Questa pagina');
  L.push('  /features                    Lista funzionalità');
  L.push('  /rawu?u=<url>                Debug URL grezzo');
  L.push('  /ip                          Info IP');
  L.push('');
  L.push('📊 CACHE');
  L.push('─────────────────────────────────────────────────────────');
  L.push('NTV tokens:      '+tokenCache.size+'/'+MAX_TOKEN_CACHE);
  L.push('Daddy URLs:      '+daddyCache.size+'/'+MAX_DADDY_CACHE);
  L.push('Vavoo URLs:      '+vavooURLCache.size);
  L.push('Vavoo Map:       '+(vavooMapGet()?vavooMapGet().size+' canali':'non caricata'));
  L.push('');
  L.push('🎯 QUALITY-LOCK ATTIVI');
  L.push('─────────────────────────────────────────────────────────');
  if(qualityStore.size===0) L.push('  (nessuno — tutti a 1080p default)');
  else{ for(const [slug,q] of qualityStore.entries()){ L.push('  '+slug.padEnd(24)+' maxRes='+q.maxRes+'p | fails='+q.fails+' | età='+Math.floor((Date.now()-q.t)/1000)+'s'); } }
  L.push('');
  L.push('📈 STATISTICHE');
  L.push('─────────────────────────────────────────────────────────');
  L.push('Live requests:   '+reqStats.live);
  L.push('Seg requests:    '+reqStats.seg);
  L.push('NTV resolve:     '+ntvStats.resolve+' (err: '+ntvStats.err+', refresh: '+ntvStats.refresh+')');
  L.push('');
  L.push('📝 LOG ULTIMI');
  L.push('─────────────────────────────────────────────────────────');
  L.push(logs.slice(-10).join('\n  ')||'(vuoti)');
  return L.join('\n');
}

function features(){
  const L=[CONFIG.VERSION,'','FUNZIONALITÀ:',''];
  CONFIG.FEATURES.forEach((f,i)=>{ L.push('  ✅ '+f); });
  L.push('');
  L.push('QUALITY-LADDER:');
  CONFIG.RES_LADDER.forEach(r=>{ L.push('  '+r+'p'); });
  L.push('');
  L.push('CANALI: '+CHANNELS.length);
  return L.join('\n');
}

// ============================================================================
// UTILS
// ============================================================================
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const logs=[];
function log(m){ logs.push(new Date().toISOString().slice(11,19)+' '+m); if(logs.length>40) logs.shift(); }

let reqStats={day:new Date().toISOString().slice(0,10),live:0,seg:0};
function countReq(kind){ const d=new Date().toISOString().slice(0,10); if(d!==reqStats.day) reqStats={day:d,live:0,seg:0}; reqStats[kind]++; }

function uso(P){ return [CONFIG.VERSION,'','uso:','  /live?ch=<slug>            playlist 1080p H.264','  /live?ch=X&fail=1          ⬇️ scendi risoluzione','  /live?ch=X&reset=1         🔄 torna 1080p','  /live?ch=X&res=720         🎯 forza 720p','  /diag?ch=sky-sport-f1      diagnostica','  /checkseg?s=vavoo&ch=X     test variante','  /probe?ch=X  /debug  /features','  /warm  /vmap  /ch  /rawu  /ip',''].join('\n'); }
function TXT(){ return {'content-type':'text/plain; charset=utf-8',...CORS()}; }
function HLS_NO_CACHE(){ return {'content-type':'application/vnd.apple.mpegurl','cache-control':'no-cache, no-store, must-revalidate','pragma':'no-cache','expires':'0',...CORS()}; }
function CORS(){ return {'access-control-allow-origin':'*'}; }
function R(body,status,headers){ const h=Object.assign({'content-type':'text/plain; charset=utf-8'},headers||{}); if(status===302) delete h['content-type']; return new Response(body,{status:status||200,headers:h}); }
async function rawu(u){ const t=u.searchParams.get('u'); if(!t) return R('uso: /rawu?u=<url>',200,TXT()); const h=getBrowserHeaders(u.searchParams.get('ref')||'https://thedaddy.li/'); if(u.searchParams.get('o')) h['Origin']=u.searchParams.get('o'); let r; try{ r=await fetchT(t,{headers:h,redirect:'follow'},20000); }catch(e){ return R('ERR: '+(e&&e.message),200,TXT()); } let body=''; try{ body=await r.text(); }catch(e){ body='(no body)'; } return R('status '+r.status+' | len '+body.length+'\n'+body.slice(0,2000),200,TXT()); }

async function fetchT(url,opt,ms){
  const o=Object.assign({},opt||{});
  if(ms&&typeof AbortController!=='undefined'){
    const ac=new AbortController();
    const t=setTimeout(()=>{ try{ ac.abort(); }catch(e){} },ms);
    o.signal=ac.signal;
    try{ return await fetch(url,o); }finally{ clearTimeout(t); }
  }
  return fetch(url,o);
}
// ███ FINE TVNOW-CF v9.0 Quality-Lock ███
