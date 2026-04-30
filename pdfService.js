// pdfService.js (CommonJS)
// POST /generate-pdf — 24-page PDF, 2 pages per month
// Page A: artwork + plantCommentary.json notes + Claude inspo garden + climate data
// Page B: full calendar grid with key dates and holidays

var express   = require('express');
var QRCode    = require('qrcode');
var puppeteer = require('puppeteer-core');
var chromium  = require('@sparticuz/chromium');
var https     = require('https');
var http      = require('http');
var tpl       = require('./calendarTemplate.js');
var fs        = require('fs');
var path      = require('path');
var fontMgr   = require('./downloadFonts.js');

// Download fonts at startup (async, non-blocking — PDF generation checks readiness)
var _fontsReady = false;
var _fontDir    = fontMgr.FONT_DIR;
fontMgr.downloadAllFonts().then(function(ok) {
  _fontsReady = ok;
  if (ok) tpl.setFontDir(_fontDir);
}).catch(function(e) {
  console.warn('[fonts] Download failed:', e.message, '— will fall back to Google Fonts CDN');
});

// sharp is optional — if unavailable we skip compression and log a warning
var sharp;
try {
  sharp = require('sharp');
} catch(e) {
  console.warn('[pdfService] sharp not available — images will not be compressed. Run: npm install sharp');
  sharp = null;
}

// ── Image compression helpers ─────────────────────────────────────────────────
// All return a base64 data-URI string (or the original if sharp is unavailable).

// Compress a Buffer → JPEG data-URI.
// widthPx: resize to this width (preserving aspect ratio). null = no resize.
// quality: JPEG quality 1-100.
async function compressToJpegDataUri(buf, widthPx, quality) {
  if (!sharp || !buf || buf.length === 0) {
    return 'data:image/jpeg;base64,' + buf.toString('base64');
  }
  try {
    // Detect format from magic bytes — handle JPEG, PNG, TIFF, WebP, GIF
    var fmt = 'jpeg';
    if (buf.length > 4) {
      if (buf[0] === 0x89 && buf[1] === 0x50) fmt = 'png';
      else if (buf[0] === 0xFF && buf[1] === 0xD8) fmt = 'jpeg';
      else if ((buf[0] === 0x49 && buf[1] === 0x49) || (buf[0] === 0x4D && buf[1] === 0x4D)) fmt = 'tiff';
      else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[4] === 0x57) fmt = 'webp';
      else if (buf[0] === 0x47 && buf[1] === 0x49) fmt = 'gif';
    }
    var pipeline = sharp(buf, { failOn: 'none' });
    if (fmt !== 'jpeg') pipeline = pipeline.toFormat('jpeg'); // force convert non-JPEG
    pipeline = pipeline.rotate(); // auto-correct EXIF orientation
    if (widthPx) pipeline = pipeline.resize(widthPx, null, { withoutEnlargement: true });
    var compressed = await pipeline.jpeg({ quality: quality, mozjpeg: true }).toBuffer();
    console.log('[IMG] Compressed ' + fmt.toUpperCase() + ': '
      + Math.round(buf.length/1024) + 'KB → ' + Math.round(compressed.length/1024) + 'KB');
    return 'data:image/jpeg;base64,' + compressed.toString('base64');
  } catch(e) {
    console.warn('[IMG] sharp compress failed (' + e.message + ') — using original');
    return 'data:image/jpeg;base64,' + buf.toString('base64');
  }
}

// Compress a base64 data-URI string (any image format) → compressed JPEG data-URI.
async function compressDataUri(dataUri, widthPx, quality) {
  if (!sharp || !dataUri) return dataUri;
  try {
    // Strip the data:...;base64, prefix
    var b64 = dataUri.replace(/^data:[^;]+;base64,/, '');
    var buf  = Buffer.from(b64, 'base64');
    return await compressToJpegDataUri(buf, widthPx, quality);
  } catch(e) {
    console.warn('[IMG] compressDataUri failed:', e.message);
    return dataUri;
  }
}

// Build artwork filename map once at startup (lowercase key → actual filename)
// Supports any capitalisation: koehler_rose.jpg, Koehler_Rose.JPG etc.
var _artworkFileMap = {};
try {
  var _artDir = path.join(__dirname, 'artwork');
  require('fs').readdirSync(_artDir).forEach(function(f) {
    _artworkFileMap[f.toLowerCase()] = f;
  });
  console.log('[pdfService] Artwork files indexed:', Object.keys(_artworkFileMap).length);
} catch(e) {
  console.warn('[pdfService] Could not index artwork directory:', e.message);
}

// Load garden photo manifest once at startup
var _gardenPhotoManifest = {};
try {
  var _manifestPath = path.join(__dirname, 'garden-photos', 'manifest.json');
  _gardenPhotoManifest = JSON.parse(fs.readFileSync(_manifestPath, 'utf8'));
  console.log('[pdfService] Garden photo manifest loaded:', Object.keys(_gardenPhotoManifest).length, 'gardens');
} catch(e) {
  console.warn('[pdfService] Garden photo manifest not found — will fetch live:', e.message);
}

function readGardenPhotoFromDisk(gardenName) {
  if (!gardenName) return null;
  var fname = _gardenPhotoManifest[gardenName];
  if (!fname) return null;
  var fpath = path.join(__dirname, 'garden-photos', fname);
  try {
    if (!fs.existsSync(fpath)) return null;
    var buf = fs.readFileSync(fpath);
    // Return raw buffer — compression applied later in buildFullHTML
    return buf;
  } catch(e) { return null; }
}

// Load plant commentary once at startup
try {
  var _commentary = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'plantCommentary.json'), 'utf8')
  );
  tpl.setPlantCommentary(_commentary);
  console.log('[pdfService] plantCommentary loaded:', Object.keys(_commentary).length, 'plants');
} catch(e) {
  console.warn('[pdfService] plantCommentary not found — plant notes will be empty:', e.message);
}

var router = express.Router();

var FORMATS = {
  a3: { widthMm: 305, heightMm: 428, label: 'A3 Portrait Standard Wall Calendar' },
  a4: { widthMm: 305, heightMm: 218, label: 'A4 Landscape Wire-O Calendar' },
};


// ── Read artwork from disk ────────────────────────────────────────────────────
// Returns { buf: Buffer, source: string } or null.
// Compression (to two sizes) is applied later in buildFullHTML so we only
// read the file once but compress twice (full-res for page A, thumbnail for cover).

var ARTWORK_SOURCES = {
  'koehler': 'Köhler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Public Domain \u00b7 Missouri Botanical Garden',
  'edwards': 'Edwards\u2019 Botanical Register, 1815\u20131847 \u00b7 Public Domain',
  'redoute': 'Trait\u00e9 des Arbres et Arbustes, Redout\u00e9 (1801\u20131819) \u00b7 Public Domain',
};
var ARTWORK_SOURCE_DEFAULT = 'Köhler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Public Domain \u00b7 Missouri Botanical Garden';

// Filename conventions supported:
//   Koehler_plantname.jpg   — Köhler's Medizinal-Pflanzen
//   Edwards_plantname.jpg   — Edwards' Botanical Register
//   Redoute_plantname.jpg   — Redouté's Traité des Arbres et Arbustes
//   plantname.jpg           — legacy (assumed Köhler)
function readArtworkBuffer(plant) {
  if (!plant) return null;
  var key  = plant.toLowerCase().trim();
  var exts = ['.jpg', '.png'];
  var prefixes = ['koehler', 'edwards', 'redoute'];

  for (var p = 0; p < prefixes.length; p++) {
    for (var e = 0; e < exts.length; e++) {
      var target = prefixes[p] + '_' + key + exts[e];
      var actual = _artworkFileMap[target];
      if (actual) {
        return {
          buf:    fs.readFileSync(path.join(__dirname, 'artwork', actual)),
          source: ARTWORK_SOURCES[prefixes[p]] || ARTWORK_SOURCE_DEFAULT,
        };
      }
    }
  }

  // Fallback: legacy unprefixed filename
  for (var e = 0; e < exts.length; e++) {
    var target = key + exts[e];
    var actual = _artworkFileMap[target];
    if (actual) {
      return {
        buf:    fs.readFileSync(path.join(__dirname, 'artwork', actual)),
        source: ARTWORK_SOURCE_DEFAULT,
      };
    }
  }

  console.warn('[ART] Not found on disk:', key);
  return null;
}

// ── Geocode a city string to lat/lng via Photon ───────────────────────────────
function geocodeCity(city) {
  return new Promise(function(resolve) {
    if (!city) { resolve(null); return; }
    var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(city) + '&limit=1&lang=en';
    https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          var f = d.features && d.features[0];
          if (!f) { resolve(null); return; }
          resolve({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });
        } catch(e) { resolve(null); }
      });
    }).on('error', function() { resolve(null); })
      .setTimeout(8000, function() { resolve(null); });
  });
}

// ── Fetch climate data from Open-Meteo ───────────────────────────────────────
// Uses the monthly endpoint (tiny response) with 2 retries.
// Returns null only after all retries fail — caller must treat null as hard error.
function fetchClimateDataOnce(lat, lng) {
  return new Promise(function(resolve) {
    // 10-year recent period 2015-2024 — more representative of current climate
    // than the WMO 1991-2020 normal, and ~3,650 rows vs ~10,950 (one third the API cost).
    // EC_Earth3P_HR covers 1950-2050 so this range is fully available.
    var url = 'https://climate-api.open-meteo.com/v1/climate'
      + '?latitude=' + lat.toFixed(4) + '&longitude=' + lng.toFixed(4)
      + '&start_date=2015-01-01&end_date=2024-12-31'
      + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,daylight_duration'
      + '&models=EC_Earth3P_HR';
    var req = https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          if (d.error) {
            console.error('[PDF] climate API error:', d.reason || JSON.stringify(d).slice(0,200));
            resolve(null); return;
          }
          var daily = d.daily;
          if (!daily || !daily.time || !daily.time.length) {
            console.error('[PDF] climate API: no daily field. Keys:', Object.keys(d).join(','));
            resolve(null); return;
          }
          // Accumulate sums per calendar month (0=Jan … 11=Dec)
          var sums   = { tMax:new Array(12).fill(0), tMin:new Array(12).fill(0),
                         precip:new Array(12).fill(0), sun:new Array(12).fill(0) };
          var counts = new Array(12).fill(0);
          var daysPerMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
          for (var i = 0; i < daily.time.length; i++) {
            var mo = parseInt(daily.time[i].split('-')[1], 10) - 1;
            if (mo < 0 || mo > 11) continue;
            if (daily.temperature_2m_max[i]  != null) sums.tMax[mo]   += daily.temperature_2m_max[i];
            if (daily.temperature_2m_min[i]  != null) sums.tMin[mo]   += daily.temperature_2m_min[i];
            if (daily.precipitation_sum[i]   != null) sums.precip[mo] += daily.precipitation_sum[i];
            // EC_Earth3P_HR often returns 0 for sunshine_duration — fall back to daylight_duration
            var sunVal = (daily.sunshine_duration && daily.sunshine_duration[i] > 0)
              ? daily.sunshine_duration[i]
              : (daily.daylight_duration && daily.daylight_duration[i] != null ? daily.daylight_duration[i] : 0);
            if (sunVal > 0) sums.sun[mo] += sunVal;
            counts[mo]++;
          }
          var tMax=[], tMin=[], precip=[], sunHrs=[];
          for (var mo = 0; mo < 12; mo++) {
            var n = counts[mo] || 1;
            tMax.push(  parseFloat((sums.tMax[mo]   / n).toFixed(1)));
            tMin.push(  parseFloat((sums.tMin[mo]   / n).toFixed(1)));
            // precip: sum over all days in month / number of years (approx 3)
            precip.push(parseFloat((sums.precip[mo] / n * daysPerMonth[mo]).toFixed(0)));
            // sunshine_duration is seconds/day already (daily sum / 1 day) — convert to hours
            sunHrs.push(parseFloat((sums.sun[mo] / n / 3600).toFixed(1)));
          }
          console.log('[PDF] Climate data: ' + daily.time.length + ' daily records averaged into 12 months');
          resolve({ _cd: { tMax: tMax, tMin: tMin, precip: precip, sunHrs: sunHrs } });
        } catch(e) {
          console.error('[PDF] climate parse error:', e.message, 'raw:', data.slice(0, 300));
          resolve(null);
        }
      });
    });
    req.on('error', function(e) {
      console.error('[PDF] climate fetch error:', e.message);
      resolve(null);
    });
    req.setTimeout(20000, function() {
      console.error('[PDF] climate fetch timeout');
      req.destroy();
      resolve(null);
    });
  });
}

// In-memory climate cache — keyed by rounded lat/lng, cleared at midnight
// Disk-persisted climate cache — keyed by rounded lat/lng, cleared at midnight.
// Survives Render restarts and deploys. File: climate-cache.json in project root.
var _climateCachePath = require('path').join(__dirname, 'climate-cache.json');

function _climateCacheKey(lat, lng) {
  return lat.toFixed(2) + ',' + lng.toFixed(2);
}

function _readClimateCache() {
  try {
    if (!require('fs').existsSync(_climateCachePath)) return {};
    var raw = require('fs').readFileSync(_climateCachePath, 'utf8');
    return JSON.parse(raw);
  } catch(e) {
    console.warn('[PDF] Climate cache read error:', e.message);
    return {};
  }
}

function _writeClimateCache(cache) {
  try {
    require('fs').writeFileSync(_climateCachePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch(e) {
    console.warn('[PDF] Climate cache write error:', e.message);
  }
}

async function fetchClimateData(lat, lng) {
  var today = new Date().toISOString().slice(0, 10);
  var cache = _readClimateCache();

  // Clear all entries if day has changed
  var dates = Object.values(cache).map(function(v) { return v.date; });
  if (dates.length && dates.every(function(d) { return d !== today; })) {
    console.log('[PDF] Climate cache: new day, clearing');
    cache = {};
    _writeClimateCache(cache);
  }

  var key = _climateCacheKey(lat, lng);
  if (cache[key] && cache[key].date === today) {
    console.log('[PDF] Climate data: cache hit for ' + key);
    return cache[key].data;
  }

  var RETRIES = 3, DELAY_MS = 2000;
  for (var attempt = 1; attempt <= RETRIES; attempt++) {
    console.log('[PDF] Climate fetch attempt ' + attempt + '/' + RETRIES);
    var result = await fetchClimateDataOnce(lat, lng);
    if (result) {
      cache[key] = { date: today, data: result };
      _writeClimateCache(cache);
      return result;
    }
    if (attempt < RETRIES) {
      await new Promise(function(r) { setTimeout(r, DELAY_MS * attempt); });
    }
  }
  console.error('[PDF] Climate data FAILED after ' + RETRIES + ' attempts — PDF will be missing weather data');
  return null;
}

// Curated garden seed lists by region — lat/lng bounding boxes [minLat,maxLat,minLng,maxLng]
var GARDEN_REGIONS = [
  { box:[50.8,51.9,-0.9,1.5], gardens:[
    'Royal Botanic Gardens, Kew','RHS Garden Wisley','Sissinghurst Castle Garden',
    'Great Dixter','Wakehurst','Hampton Court Palace Garden','Chelsea Physic Garden',
    'Emmetts Garden','Nymans','Sheffield Park and Garden','Penshurst Place',
    'Hever Castle Gardens','Chartwell','Knole Park','Scotney Castle',
    "Bateman's",'Borde Hill Garden','Leonardslee Lakes and Gardens',
    'Parham House and Gardens','West Dean Gardens','Denmans Garden',
    'Loseley Park','Painshill Park','Claremont Landscape Garden',
    'Polesden Lacey','The Savill Garden','Mottisfont','Exbury Gardens',
    'Jenkyn Place','Hannah Peschar Sculpture Garden','Pashley Manor Gardens',
  ]},
  { box:[49.9,51.5,-6.5,-1.8], gardens:[
    'Trebah Garden','Glendurgan Garden','Heligan Gardens','Trelissick Garden',
    'Tresco Abbey Garden','RHS Garden Rosemoor','Bicton Park Botanical Gardens',
    'Greenway','Coleton Fishacre','Killerton','Knightshayes','Tyntesfield',
    'Montacute House','Forde Abbey','Mapperton Gardens','Abbotsbury Subtropical Gardens',
    'Hestercombe Gardens','Prior Park Landscape Garden','Iford Manor','Stourhead',
    'Kingston Lacy','Athelhampton House',
  ]},
  { box:[51.5,53.5,-1.0,2.0], gardens:[
    'RHS Garden Hyde Hall','Beth Chatto Gardens','Anglesey Abbey',
    'Blickling Estate','Sandringham Gardens','Bressingham Gardens',
    'Helmingham Hall Gardens','Somerleyton Hall Gardens','Mannington Hall',
    'Benington Lordship','Doddington Hall Gardens','Burghley House Gardens',
  ]},
  { box:[51.3,53.5,-5.5,-1.0], gardens:[
    'Hidcote','Kiftsgate Court Gardens','Bodnant Garden','Powis Castle Garden',
    'Barnsley House','Bourton House Garden','Birmingham Botanical Gardens',
    'Upton House','Packwood House','Baddesley Clinton','Coton Manor Garden',
    'Cottesbrooke Hall Gardens','Erddig','Aberglasney Gardens',
    'National Botanic Garden of Wales',
  ]},
  { box:[53.0,55.8,-3.5,0.0], gardens:[
    'RHS Garden Harlow Carr','Studley Royal Water Garden','Newby Hall',
    'Castle Howard','Scampston Hall Walled Garden','York Gate Garden',
    'Alnwick Garden','Cragside','Wallington','Belsay Hall Gardens',
    'Levens Hall','Sizergh Castle','Holker Hall','Dalemain',
    'Tatton Park','Dunham Massey','Biddulph Grange Garden',
    'Wentworth Castle Gardens',
  ]},
  { box:[54.5,61.0,-8.0,-0.5], gardens:[
    'Royal Botanic Garden Edinburgh','Crarae Garden','Arduaine Garden',
    'Inverewe Garden','Crathes Castle Garden','Pitmedden Garden',
    'Branklyn Garden','Drummond Castle Gardens','Logan Botanic Garden',
    'Threave Garden','Culzean Castle and Country Park','Glenarn Garden',
  ]},
  { box:[51.3,55.5,-10.5,-5.5], gardens:[
    'National Botanic Gardens Dublin','Powerscourt Estate Gardens',
    'Killarney House Gardens','Glenveagh Castle Gardens',
    'Mount Usher Gardens','Birr Castle Demesne','Altamont Garden',
    'Rowallane Garden','Mount Stewart','Benvarden Garden',
  ]},
  { box:[49.5,53.6,2.5,7.2], gardens:[
    'Keukenhof','Hortus Botanicus Amsterdam','Clingendael Park',
    'Paleis Het Loo Gardens','Arboretum Kalmthout','Hex Castle Gardens',
  ]},
  { box:[41.5,51.1,-5.5,9.6], gardens:[
    "Giverny (Monet's Garden)",'Versailles Gardens','Vaux-le-Vicomte',
    'Villandry Gardens','Jardins de Marqueyssac','Jardin des Plantes Paris',
    'Château de Chaumont-sur-Loire Gardens',
  ]},
  { box:[46.0,55.5,5.5,17.5], gardens:[
    'Sanssouci Gardens Potsdam','Herrenhausen Gardens Hanover',
    'Munich Botanical Garden','Berlin Botanical Garden',
    'Schwetzingen Palace Gardens','Wilhelma Stuttgart',
    'Schönbrunn Palace Gardens','Belvedere Gardens Vienna','Insel Mainau',
  ]},
  { box:[24.0,50.0,-90.0,-60.0], gardens:[
    'Longwood Gardens','New York Botanical Garden','Brooklyn Botanic Garden',
    'Arnold Arboretum Boston','Dumbarton Oaks Washington DC',
    'Winterthur Garden','Chanticleer Garden','Wave Hill',
    'Ladew Topiary Gardens',
  ]},
  { box:[30.0,50.0,-130.0,-100.0], gardens:[
    'Butchart Gardens Victoria','Van Dusen Botanical Garden Vancouver',
    'Portland Japanese Garden','Huntington Library Gardens',
    'Filoli','San Francisco Botanical Garden','UC Berkeley Botanical Garden',
  ]},
  { box:[-47.0,-10.0,110.0,178.0], gardens:[
    'Royal Botanic Garden Sydney','Royal Botanic Gardens Melbourne',
    'Adelaide Botanic Garden','Kings Park Perth',
    'Christchurch Botanic Gardens','Hamilton Gardens New Zealand',
  ]},
];

function getRegionalGardens(lat, lng) {
  if (lat == null || lng == null) return [];
  for (var i = 0; i < GARDEN_REGIONS.length; i++) {
    var b = GARDEN_REGIONS[i].box;
    if (lat >= b[0] && lat <= b[1] && lng >= b[2] && lng <= b[3])
      return GARDEN_REGIONS[i].gardens;
  }
  return [];
}

// ── Normalise garden name for dedup ──────────────────────────────────────────
function normaliseGardenName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\b(rhs|nts|english heritage|national trust|the|garden|gardens|park|house|castle|abbey|hall|manor|place|estate|botanical|botanic|arboretum|pleasure grounds)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ── Single inspo fetch ────────────────────────────────────────────────────────
function fetchInspoOne(plant, monthName, climate, lat, lng, apiKey, usedNames) {
  return new Promise(function(resolve) {
    if (!apiKey) { resolve(null); return; }
    var locationHint = lat && lng
      ? ' (approx. ' + Math.round(lat) + '\u00b0N ' + Math.round(Math.abs(lng)) + '\u00b0' + (lng < 0 ? 'W' : 'E') + ')'
      : '';
    var recentUsed = usedNames.slice(-4);
    var excludeClause = recentUsed.length
      ? '\n\nDo NOT suggest any of these: ' + recentUsed.join(', ') + '.'
      : '';
    var regionalGardens = getRegionalGardens(lat, lng);
    var candidates = regionalGardens.filter(function(g) {
      return usedNames.indexOf(g) === -1 && normaliseGardenName(g) !== '' &&
        usedNames.every(function(u) { return normaliseGardenName(u) !== normaliseGardenName(g); });
    });
    var gardenHint = candidates.length > 0
      ? '\n\nChoose from these verified gardens near ' + climate + ' (all are real and within day-trip distance): '
        + candidates.slice(0, 12).join(', ') + '.'
        + ' Pick the one that is most interesting specifically in ' + monthName + '.'
      : '';

    var prompt =
      'Suggest one real, publicly accessible garden worth visiting in ' + monthName
      + ' for someone based in ' + climate + locationHint + '.'
      + ' It must be within a comfortable day trip \u2014 preferably under 1.5 hours away.'
      + gardenHint
      + excludeClause
      + '\n\nThe highlight should mention something specific happening in that garden in ' + monthName + '.'
      + '\n\nReturn ONLY valid JSON with no markdown fences, no explanation, nothing before or after the JSON object:'
      + '\n{"name":"Full official garden name","location":"Town, County","highlight":"One specific sentence about what makes it worth visiting in ' + monthName + '.","wikipedia":"Wikipedia article title for this garden if one exists, else null"}';

    var body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }],
    });
    var opts = {
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    var req = https.request(opts, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        console.log('[PDF] inspo API status:', res.statusCode);
        try {
          var p = JSON.parse(data);
          if (p.error) { console.error('[PDF] inspo API error:', JSON.stringify(p.error)); resolve(null); return; }
          var text = (p.content && p.content[0] && p.content[0].text || '').trim();
          // Strip markdown fences if Haiku wraps JSON in ```json ... ```
          var cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
          var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (!jsonMatch) { console.error('[PDF] inspo no JSON found in:', text.slice(0,100)); resolve(null); return; }
          resolve(JSON.parse(jsonMatch[0]));
        } catch(e) {
          console.error('[PDF] inspo parse error:', e.message, 'raw:', data.slice(0,200));
          resolve(null);
        }
      });
    });
    req.on('error', function(e) { console.error('[PDF] inspo req error:', e.message); resolve(null); });
    req.setTimeout(15000, function() { console.error('[PDF] inspo timeout'); req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}
// Fetch 12 inspo gardens sequentially so we can pass used-names for dedup
async function fetchAllInspos(plants, monthNames, monthIndices, climate, lat, lng, apiKey) {
  var inspos = [];
  var usedNormalised = [];
  var usedDisplay = [];

  for (var i = 0; i < 12; i++) {
    var result = await fetchInspoOne(
      plants[i], monthNames[i], climate, lat, lng, apiKey, usedDisplay
    );
    var attempts = 0;
    while (result && result.name && attempts < 3) {
      var norm = normaliseGardenName(result.name);
      if (usedNormalised.indexOf(norm) === -1) break;
      console.log('[PDF] Dedup: ' + result.name + ' already used, retrying...');
      usedDisplay.push(result.name);
      result = await fetchInspoOne(
        plants[i], monthNames[i], climate, lat, lng, apiKey, usedDisplay
      );
      attempts++;
    }
    if (result && result.name) {
      usedNormalised.push(normaliseGardenName(result.name));
      usedDisplay.push(result.name);
    }
    inspos.push(result);
    console.log('[PDF] Inspo ' + (i+1) + '/12: ' + (result && result.name || 'null'));
  }
  return inspos;
}

// ── Fetch image as raw Buffer ─────────────────────────────────────────────────
function fetchImageAsBuffer(imageUrl, _depth) {
  _depth = _depth || 0;
  return new Promise(function(resolve) {
    if (_depth > 4) { resolve(null); return; }
    var parsed = require('url').parse(imageUrl);
    var lib = parsed.protocol === 'https:' ? https : http;
    var opts = {
      hostname: parsed.hostname,
      path: parsed.path,
      headers: {
        'User-Agent': 'GardenCalendar/1.0',
        'Accept': 'image/png,image/jpeg,image/*',
      }
    };
    var req = lib.get(opts, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        var loc = res.headers.location;
        if (loc.startsWith('/')) loc = parsed.protocol + '//' + parsed.hostname + loc;
        res.resume();
        return fetchImageAsBuffer(loc, _depth + 1).then(resolve);
      }
      var chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() {
        var buf = Buffer.concat(chunks);
        if (buf.length < 500) { resolve(null); return; }
        var ct = res.headers['content-type'] || '';
        if (!ct.includes('image')) { resolve(null); return; }
        resolve(buf);
      });
    });
    req.on('error', function() { resolve(null); });
    req.setTimeout(12000, function() { req.destroy(); resolve(null); });
  });
}

function fetchWikipediaPhotoBuffer(title) {
  return new Promise(function(resolve) {
    if (!title) { resolve(null); return; }
    var enc = encodeURIComponent(title.replace(/ /g,'_'));
    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + enc;
    var req = https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          var thumb = d.thumbnail && d.thumbnail.source;
          if (!thumb) { resolve(null); return; }
          fetchImageAsBuffer(thumb).then(resolve);
        } catch(e) { console.error('[PDF] wiki parse error:', e.message); resolve(null); }
      });
    });
    req.on('error', function(e) { console.error('[PDF] wiki req error:', e.message); resolve(null); });
    req.setTimeout(8000, function() { req.destroy(); resolve(null); });
  });
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateOrder(body) {
  var errors = [];
  if (body.startMonth == null || body.startMonth < 1 || body.startMonth > 12)
    errors.push('startMonth must be 1-12 (January=1)');
  if (body.format && body.format !== 'a3' && body.format !== 'a4')
    errors.push('format must be a3 or a4 (default: a3)');
  if (!body.climate || typeof body.climate !== 'string')
    errors.push('climate region required');
  if (!Array.isArray(body.plants) || body.plants.length !== 12)
    errors.push('plants must be array of 12 plant names');
  if (body.keyDates && body.keyDates.length > 20)
    errors.push('maximum 20 key dates');
  if (body.holidays && body.holidays.length > 6)
    errors.push('maximum 6 holiday periods');
  return errors;
}

// ── Build full HTML ───────────────────────────────────────────────────────────
async function buildFullHTML(order, apiKey) {
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var fmt           = (order.format || 'a3').toLowerCase();
  var fmtConfig     = FORMATS[fmt] || FORMATS.a3;
  var startMonth    = order.startMonth - 1; // convert 1-12 to 0-11
  var year          = order.year || new Date().getFullYear();
  var plants        = order.plants;
  var keyDates      = order.keyDates || [];
  var holidays      = order.holidays || [];
  var climate       = order.climate;
  var city          = order.city || climate;
  var recipientName = order.recipientName || '';

  console.log('[PDF] keyDates received:', JSON.stringify(keyDates));
  console.log('[PDF] holidays received:', JSON.stringify(holidays));
  console.log('[PDF] Geocoding city: ' + city);
  var geo = await geocodeCity(city);
  var climateData = null;
  if (geo) {
    console.log('[PDF] Fetching climate data for', geo.lat, geo.lng);
    climateData = await fetchClimateData(geo.lat, geo.lng);
    console.log('[PDF] Climate data:', climateData ? 'OK' : 'not available');
  if (!climateData) {
    throw new Error('Climate data unavailable for ' + city + ' after retries. Cannot produce calendar without weather data.');
  }
  }

  // ── Artwork: read once as Buffer, compress to two sizes ───────────────────
  // Full-res (page A illustration): max 1800px wide, JPEG q82  → ~100–130KB each
  // Thumbnail (cover grid):         max  500px wide, JPEG q75  → ~15–25KB each
  console.log('[PDF] Reading & compressing artwork...');
  var artworkRaw = plants.map(function(p) { return readArtworkBuffer(p); }); // {buf, source} | null
  console.log('[PDF] Artwork loaded: ' + artworkRaw.filter(Boolean).length + '/12');
  artworkRaw.forEach(function(a, i) {
    if (a) {
      var src = a.source.includes('Edwards') ? 'Edwards' : a.source.includes('Redout') ? 'Redout\u00e9' : 'K\u00f6hler';
      console.log('[ART] ' + plants[i] + ' \u2192 ' + src);
    }
  });

  // Process sequentially (not parallel) to avoid simultaneous RAM spikes
  // when decompressing large source files (Redoute watercolours can be 20MB+)
  var artworks = [];
  for (var ai = 0; ai < artworkRaw.length; ai++) {
    var a = artworkRaw[ai];
    if (!a) { artworks.push(null); continue; }
    var rawKB = Math.round(a.buf.length / 1024);
    console.log('[ART] Compressing ' + plants[ai] + ' (' + rawKB + 'KB raw)...');
    var fullB64  = await compressToJpegDataUri(a.buf, 1800, 82);
    var thumbB64 = await compressToJpegDataUri(a.buf,  500, 75);
    console.log('[ART] ' + plants[ai] + ' done: full=' + Math.round(fullB64.length*0.75/1024) + 'KB thumb=' + Math.round(thumbB64.length*0.75/1024) + 'KB');
    artworks.push({ b64: fullB64, thumbB64: thumbB64, source: a.source });
  }

  var beforeKB = artworkRaw.reduce(function(s, a) { return s + (a ? a.buf.length : 0); }, 0) / 1024;
  var afterKB  = artworks.reduce(function(s, a) {
    if (!a) return s;
    return s + (a.b64.length * 0.75 / 1024) + (a.thumbB64.length * 0.75 / 1024);
  }, 0);
  console.log('[PDF] Artwork size: ' + Math.round(beforeKB) + 'KB raw → ~' + Math.round(afterKB) + 'KB compressed (both sizes)');

  // ── Inspo gardens ─────────────────────────────────────────────────────────
  console.log('[PDF] Fetching 12 inspo gardens (sequential + dedup)...');
  var inspoMonthNames = [], inspoMonthIdxs = [];
  for (var ii = 0; ii < 12; ii++) {
    var mIdx = (startMonth + ii) % 12;
    inspoMonthNames.push(MONTH_NAMES[mIdx]);
    inspoMonthIdxs.push(mIdx);
  }
  var inspos = await fetchAllInspos(
    plants, inspoMonthNames, inspoMonthIdxs,
    climate, geo && geo.lat, geo && geo.lng, apiKey
  );

  // ── Inspo photos: fetch as Buffer, compress to small thumbnail ───────────
  // Rendered at 22mm × 22mm on page → ~260px at 300dpi.
  // Compress to max 400px wide, JPEG q75 → ~20–30KB each.
  console.log('[PDF] Loading & compressing inspo garden photos...');
  var inspoPhotoPromises = inspos.map(function(inspo) {
    if (!inspo || !inspo.name) return Promise.resolve(null);
    var diskBuf = readGardenPhotoFromDisk(inspo.name); // now returns Buffer | null
    if (diskBuf) return Promise.resolve(diskBuf);
    var wikiTitle = inspo.wikipedia || inspo.name;
    return fetchWikipediaPhotoBuffer(wikiTitle);
  });
  var inspoPhotoBuffers = await Promise.all(inspoPhotoPromises);

  // Compress all inspo photos
  var inspoPhotos = await Promise.all(inspoPhotoBuffers.map(async function(buf) {
    if (!buf) return null;
    return await compressToJpegDataUri(buf, 400, 75);
  }));

  var inspoBeforeKB = inspoPhotoBuffers.reduce(function(s, b) { return s + (b ? b.length : 0); }, 0) / 1024;
  var inspoAfterKB  = inspoPhotos.reduce(function(s, d) { return s + (d ? d.length * 0.75 / 1024 : 0); }, 0);
  console.log('[PDF] Inspo photos: ' + inspoPhotos.filter(Boolean).length + '/12 found. '
    + Math.round(inspoBeforeKB) + 'KB raw → ~' + Math.round(inspoAfterKB) + 'KB compressed');

  // ── QR codes ──────────────────────────────────────────────────────────────
  async function makeQrB64(url, ecl) {
    try {
      var dataUrl = await QRCode.toDataURL(url, {
        width: 150, margin: 2,
        errorCorrectionLevel: ecl || 'M',
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      return dataUrl;
    } catch(e) { console.error('[PDF] QR gen error:', e.message); return ''; }
  }

  var appUrl   = 'https://garden-calendar-frontend.vercel.app';
  var appQrB64 = await makeQrB64(appUrl);
  console.log('[PDF] App QR: ' + (appQrB64 ? 'ok' : 'failed'));

  var inspoQrB64s = await Promise.all(inspos.map(function(ins) {
    if (!ins || !ins.name) return Promise.resolve('');
    var searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(ins.name + ' ' + (ins.location || '') + ' official website');
    return makeQrB64(searchUrl);
  }));
  console.log('[PDF] Inspo QRs: ' + inspoQrB64s.filter(Boolean).length + '/12 ok');

  // ── Build pages ───────────────────────────────────────────────────────────
  var coverMonthNames = [];
  for (var ci = 0; ci < 12; ci++) coverMonthNames.push(MONTH_NAMES[(startMonth + ci) % 12]);
  var endYear   = year + Math.floor((startMonth + 11) / 12);
  var dateRange = MONTH_NAMES[startMonth] + ' ' + year + ' \u2013 ' + MONTH_NAMES[(startMonth + 11) % 12] + ' ' + endYear;

  var pages = [];
  try {
    pages.push(tpl.buildCoverPage({
      calendarName:  order.calendarName || order.recipientName || '',
      dateRange:     dateRange,
      climate:       climate,
      climateData:   climateData,
      startMonthIdx: startMonth,
      // Cover thumbnails use the small compressed version
      artworks:      artworks.map(function(a) { return a ? a.thumbB64 : ''; }),
      artworkSources: artworks.map(function(a) { return a ? a.source : ''; }),
      plants:        plants,
      monthNames:    coverMonthNames,
      appQrB64:      appQrB64,
      personalMsg:   order.personalMsg  || '',
      etsyUrl:       order.etsyUrl      || 'www.etsy.com/shop/HobbyCalendar',
    }));
    console.log('[PDF] Cover page built OK');
  } catch(coverErr) {
    console.error('[PDF] buildCoverPage CRASH:', coverErr.stack);
    throw coverErr;
  }

  for (var j = 0; j < 12; j++) {
    var mIdx  = (startMonth + j) % 12;
    var mYear = year + Math.floor((startMonth + j) / 12);
    var mName = MONTH_NAMES[mIdx];
    var plt   = plants[j] || '';

    var monthKeyDates = keyDates.filter(function(d) {
      if (!d.date) return false;
      var parts = d.date.split('-');
      return parseInt(parts[0], 10) === mYear && (parseInt(parts[1], 10) - 1) === mIdx;
    });
    var monthHolidays = holidays.filter(function(h) {
      if (!h.startDate || !h.endDate) return false;
      var sp = h.startDate.split('-'), ep = h.endDate.split('-');
      var sy = parseInt(sp[0],10), sm = parseInt(sp[1],10)-1;
      var ey = parseInt(ep[0],10), em = parseInt(ep[1],10)-1;
      var startsBeforeMonthEnd = (sy < mYear) || (sy === mYear && sm <= mIdx);
      var endsAfterMonthStart  = (ey > mYear) || (ey === mYear && em >= mIdx);
      return startsBeforeMonthEnd && endsAfterMonthStart;
    });
    if (monthKeyDates.length) console.log('[PDF] Month', mName, mYear, '- keyDates:', JSON.stringify(monthKeyDates));
    if (monthHolidays.length) console.log('[PDF] Month', mName, mYear, '- holidays:', JSON.stringify(monthHolidays));

    var monthIcsStr = tpl.buildMonthICS(mIdx, mYear, keyDates, holidays);
    var monthIcsB64 = monthIcsStr ? await makeQrB64(monthIcsStr, 'M') : '';
    if (monthIcsStr) console.log('[PDF] Month ' + mName + ' holiday ICS QR: ' + monthIcsStr.length + ' chars');

    var monthOpts = {
      monthName: mName, monthIdx: mIdx, year: mYear,
      plant: plt,
      // Page A uses the full-res compressed version
      artworkB64:    artworks[j] ? artworks[j].b64    : '',
      artworkSource: artworks[j] ? artworks[j].source : '',
      inspo: inspos[j] || null,
      inspoPhotoB64: inspoPhotos[j] || '',
      inspoQrB64: inspoQrB64s[j] || '',
      appQrB64: appQrB64,
      climate: climate, climateData: climateData,
      calendarName: order.calendarName || order.recipientName || '',
      keyDates: monthKeyDates, holidays: monthHolidays,
      monthIcsB64: monthIcsB64,
    };
    pages.push(tpl.buildPageA(monthOpts));
    pages.push(tpl.buildPageB(monthOpts));
    console.log('[PDF] Month ' + (j+1) + ' (' + mName + ') built OK');
  }

  pages.push(tpl.buildBlankPage());
  console.log('[PDF] Pages built: ' + pages.length + ' (cover + 12×[A+B] + blank, ' + fmt.toUpperCase() + ')');

  try {
    var doc = tpl.buildDocument(pages);
    console.log('[PDF] buildDocument OK, length: ' + Math.round(doc.length / 1024) + 'KB');
    return doc;
  } catch(docErr) {
    console.error('[PDF] buildDocument CRASH:', docErr.stack);
    throw docErr;
  }
}

// ── Render PDF ────────────────────────────────────────────────────────────────
async function generatePDF(html) {
  var widthMm = 305, heightMm = 428;

  // Extra memory-saving flags for constrained environments (Render free/starter tier).
  // --disable-dev-shm-usage is the most important: prevents Chromium using /dev/shm
  // (which is only 64MB in most containers) and instead uses /tmp.
  var extraArgs = [
    '--disable-dev-shm-usage',       // use /tmp instead of /dev/shm
    '--disable-gpu',                  // no GPU needed for PDF
    '--no-sandbox',                   // required in container environments
    '--disable-setuid-sandbox',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--safebrowsing-disable-auto-update',
    '--js-flags=--max-old-space-size=384', // cap V8 heap at 384MB
  ];
  var mergedArgs = chromium.args.concat(
    extraArgs.filter(function(a) { return chromium.args.indexOf(a) === -1; })
  );

  var browser = await puppeteer.launch({
    args: mergedArgs,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  try {
    var page = await browser.newPage();
    // Lower deviceScaleFactor to 1.5 (was 2) to halve GPU/raster memory usage.
    // At A3 (279mm wide) 150dpi this gives ~1650px wide — adequate for print preview;
    // Chromium's PDF engine renders vector elements at full quality regardless.
    // deviceScaleFactor:1 and 96dpi viewport — PDF vector output is unaffected,
    // and our artwork is already compressed to appropriate sizes server-side.
    // This significantly reduces Chromium's raster memory usage.
    await page.setViewport({
      width:  Math.round(widthMm * 96 / 25.4),
      height: Math.round(heightMm * 96 / 25.4),
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120000 });
    // Font wait removed — fonts now loaded from disk, no network delay
    return await page.pdf({
      width: widthMm + 'mm', height: heightMm + 'mm',
      printBackground: true, margin: { top:0, right:0, bottom:0, left:0 },
      timeout: 120000,
    });
  } finally {
    await browser.close();
  }
}

// ── R2 upload helper (self-contained, mirrors gelatoService.js) ───────────────
var _crypto = require('crypto');

async function uploadPdfToR2(buf) {
  var accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  var keyId     = process.env.R2_ACCESS_KEY_ID      || '';
  var secret    = process.env.R2_SECRET_ACCESS_KEY  || '';
  var bucket    = process.env.R2_BUCKET_NAME        || 'garden-calendar-pdfs';
  var publicUrl = (process.env.R2_PUBLIC_URL        || '').replace(/\/$/, '');

  if (!accountId || !keyId || !secret || !publicUrl) {
    console.warn('[R2] Missing env vars — accountId:' + !!accountId + ' keyId:' + !!keyId + ' secret:' + !!secret + ' publicUrl:' + !!publicUrl);
    return null;
  }

  var now         = new Date();
  var dateStr     = now.toISOString().slice(0,10).replace(/-/g,'');
  var amzDate     = now.toISOString().replace(/[:-]/g,'').slice(0,15) + 'Z';
  var filename    = 'gc-' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.pdf';
  var region      = 'auto', service = 's3';
  var host        = accountId + '.r2.cloudflarestorage.com';
  var path        = '/' + bucket + '/' + filename;
  var contentType = 'application/pdf';
  var bodyHash    = _crypto.createHash('sha256').update(buf).digest('hex');

  var canonHeaders  = 'content-type:' + contentType + '\nhost:' + host
    + '\nx-amz-content-sha256:' + bodyHash + '\nx-amz-date:' + amzDate + '\n';
  var signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  var canonRequest  = ['PUT', path, '', canonHeaders, signedHeaders, bodyHash].join('\n');
  var credScope     = dateStr + '/' + region + '/' + service + '/aws4_request';
  var strToSign     = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credScope + '\n'
    + _crypto.createHash('sha256').update(canonRequest).digest('hex');

  function _sign(key, msg) { return _crypto.createHmac('sha256', key).update(msg).digest(); }
  var signingKey = _sign(_sign(_sign(_sign('AWS4' + secret, dateStr), region), service), 'aws4_request');
  var signature  = _crypto.createHmac('sha256', signingKey).update(strToSign).digest('hex');
  var authHeader = 'AWS4-HMAC-SHA256 Credential=' + keyId + '/' + credScope
    + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  return new Promise(function(resolve) {
    var req = https.request({
      hostname: host, path: path, method: 'PUT',
      headers: {
        'Content-Type': contentType, 'Content-Length': buf.length,
        'x-amz-content-sha256': bodyHash, 'x-amz-date': amzDate,
        'Authorization': authHeader,
      },
    }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
          resolve(publicUrl + '/' + filename);
        } else {
          console.error('[R2] Upload failed: HTTP ' + res.statusCode + ' — ' + data);
          resolve(null);
        }
      });
    });
    req.on('error', function(e) { console.error('[R2] Upload error:', e.message); resolve(null); });
    req.setTimeout(60000, function() { req.destroy(); resolve(null); });
    req.write(buf);
    req.end();
  });
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post('/generate-pdf', async function(req, res) {
  var errors = validateOrder(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  req.socket.setTimeout(180000);
  res.setTimeout(180000);

  var apiKey = process.env.ANTHROPIC_API_KEY || '';
  var t0 = Date.now();
  console.log('[PDF] Order: ' + req.body.climate + ', start ' + req.body.startMonth + ', ' + req.body.plants.join(','));

  try {
    var html = await buildFullHTML(req.body, apiKey);
    console.log('[PDF] HTML built (' + Math.round(html.length / 1024) + 'KB). Rendering...');
    var pdfBuf = await generatePDF(html);
    var elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('[PDF] Done in ' + elapsed + 's, size: ' + Math.round(pdfBuf.length / 1024) + 'KB');

    // Try to upload to R2 and return URL — falls back to binary if R2 not configured
    var pdfUrl = await uploadPdfToR2(pdfBuf);
    if (pdfUrl) {
      console.log('[PDF] Uploaded to R2: ' + pdfUrl);
      return res.json({ success: true, url: pdfUrl, elapsed: elapsed });
    }

    // Fallback: return binary (for local testing without R2)
    console.log('[PDF] R2 not configured — returning binary');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="garden-calendar.pdf"',
      'Content-Length': pdfBuf.length,
    });
    res.send(pdfBuf);
  } catch(err) {
    console.error('[PDF] Error:', err.stack || err.message);
    res.status(500).json({ error: 'PDF generation failed', detail: err.message });
  }
});

module.exports = router;
router.buildFullHTML = buildFullHTML;
router.generatePDF   = generatePDF;
