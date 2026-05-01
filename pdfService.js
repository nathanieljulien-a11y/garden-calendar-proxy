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

// ── Derive user region tag from Photon properties ─────────────────────────────
// Used to enforce island/mainland separation in garden candidate selection.
// Returns a string tag that is matched against garden region tags.
function _deriveUserRegion(cc, state, county, name) {
  if (cc === 'gb') {
    // Distinguish island groups within GB
    if (/scilly/.test(county) || /scilly/.test(name)) return 'uk-islands';
    if (/orkney|shetland|hebrides|skye/.test(county) || /orkney|shetland|hebrides|skye/.test(name)) return 'uk-islands';
    return 'uk';
  }
  if (cc === 'ie') return 'ireland';
  if (cc === 'fr') {
    if (/corsica|corse/.test(state) || /corsica|corse/.test(name)) return 'corsica';
    if (/martinique|guadeloupe|reunion|mayotte/.test(state)) return 'mainland';
    return 'mainland';
  }
  if (cc === 'es') {
    if (/balear|mallorca|menorca|ibiza|formentera/.test(state) || /balear|mallorca|menorca|ibiza|formentera/.test(name)) return 'mallorca';
    if (/canaria|canary|lanzarote|fuerteventura|gran canaria|tenerife|la palma|gomera|hierro/.test(state) || /canaria/.test(name)) return 'canary-islands';
    return 'mainland';
  }
  if (cc === 'pt') {
    if (/madeira/.test(state) || /madeira/.test(name)) return 'madeira';
    if (/azores|acores/.test(state)) return 'mainland';
    return 'mainland';
  }
  if (cc === 'it') {
    if (/sardegna|sardinia/.test(state) || /sardegna|sardinia/.test(name)) return 'sardinia';
    return 'mainland'; // Sicily intentionally treated as mainland (land bridge)
  }
  if (cc === 'us') {
    if (/hawaii/.test(state) || /hawaii/.test(name)) return 'hawaii';
    return 'mainland';
  }
  if (cc === 'gr') return 'mainland'; // Greek islands use mainland Greece garden list
  if (cc === 'nz') return 'nz';
  if (cc === 'au') return 'mainland';
  return 'mainland';
}

// ── Garden region compatibility ───────────────────────────────────────────────
// Returns true if a garden's region tag is compatible with the user's region tag.
// This prevents cross-channel / cross-sea suggestions for islands.
var _REGION_COMPAT = {
  'uk':             ['uk'],
  'ireland':        ['ireland'],
  'uk-islands':     ['uk'],          // Scottish/Scilly islands use mainland UK list
  'corsica':        ['mainland'],    // fallback to mainland France
  'mallorca':       ['mallorca', 'mainland'], // Balearics + mainland Spain fallback
  'canary-islands': ['mainland'],    // fallback to mainland Spain
  'madeira':        ['mainland'],    // fallback to mainland Portugal
  'sardinia':       ['mainland'],    // fallback to mainland Italy
  'hawaii':         ['mainland'],    // fallback to US mainland
  'nz':             ['nz', 'au'],    // NZ can pull Australian gardens
  'mainland':       ['mainland'],
};

function _gardenCompatible(userRegion, gardenRegion) {
  var allowed = _REGION_COMPAT[userRegion] || ['mainland'];
  return allowed.indexOf(gardenRegion) !== -1;
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
          var props = f.properties || {};
          var parts = [props.name || props.city];
          if (props.state && props.state !== props.name) parts.push(props.state);
          if (props.country) parts.push(props.country);
          var displayName = parts.filter(Boolean).join(', ');
          var cc     = (props.countrycode || '').toLowerCase();
          var state  = (props.state  || '').toLowerCase();
          var county = (props.county || '').toLowerCase();
          var name   = (props.name   || '').toLowerCase();
          var userRegion = _deriveUserRegion(cc, state, county, name);
          console.log('[PDF] Geocode userRegion: ' + userRegion + ' (cc=' + cc + ')');
          resolve({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            displayName: displayName,
            userRegion:  userRegion,
          });
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
// ── Garden database with coordinates ─────────────────────────────────────────
// Each entry: { name, lat, lng, region }
// region: 'uk' | 'ireland' | 'mainland' | 'mallorca' | 'nz' | 'au'
// Distance-based selection replaces bounding-box lookup.
// All gardens within 200km of user (compatible region) are candidates,
// sorted nearest-first. Falls back to free-choice Claude prompt if <12 found.

var GARDENS = [
  // ── UK: South-East England ───────────────────────────────────────────────
  { name:'Royal Botanic Gardens, Kew',            lat:51.4787, lng:-0.2956,  region:'uk' },
  { name:'RHS Garden Wisley',                     lat:51.3084, lng:-0.4729,  region:'uk' },
  { name:'Sissinghurst Castle Garden',            lat:51.1108, lng:0.5856,   region:'uk' },
  { name:'Great Dixter House and Gardens',        lat:50.9839, lng:0.6283,   region:'uk' },
  { name:'Wakehurst',                             lat:51.0561, lng:-0.0759,  region:'uk' },
  { name:'Hampton Court Palace Garden',           lat:51.4036, lng:-0.3378,  region:'uk' },
  { name:'Chelsea Physic Garden',                 lat:51.4858, lng:-0.1676,  region:'uk' },
  { name:'Emmetts Garden',                        lat:51.2583, lng:0.0956,   region:'uk' },
  { name:'Nymans',                                lat:51.0297, lng:-0.2192,  region:'uk' },
  { name:'Sheffield Park and Garden',             lat:50.9731, lng:-0.0003,  region:'uk' },
  { name:'Penshurst Place',                       lat:51.1711, lng:0.1781,   region:'uk' },
  { name:'Hever Castle Gardens',                  lat:51.1861, lng:0.1122,   region:'uk' },
  { name:'Chartwell',                             lat:51.2647, lng:0.0711,   region:'uk' },
  { name:'Knole Park',                            lat:51.2681, lng:0.1864,   region:'uk' },
  { name:'Scotney Castle',                        lat:51.0878, lng:0.4078,   region:'uk' },
  { name:"Bateman's",                             lat:50.9942, lng:0.4264,   region:'uk' },
  { name:'Borde Hill Garden',                     lat:51.0453, lng:-0.1272,  region:'uk' },
  { name:'Leonardslee Lakes and Gardens',         lat:51.0025, lng:-0.2697,  region:'uk' },
  { name:'Parham House and Gardens',              lat:50.9281, lng:-0.4314,  region:'uk' },
  { name:'West Dean Gardens',                     lat:50.9292, lng:-0.7764,  region:'uk' },
  { name:'Denmans Garden',                        lat:50.8697, lng:-0.5611,  region:'uk' },
  { name:'Loseley Park',                          lat:51.2117, lng:-0.5886,  region:'uk' },
  { name:'Painshill Park',                        lat:51.3181, lng:-0.4703,  region:'uk' },
  { name:'Claremont Landscape Garden',            lat:51.3394, lng:-0.4447,  region:'uk' },
  { name:'Polesden Lacey',                        lat:51.2642, lng:-0.3739,  region:'uk' },
  { name:'The Savill Garden',                     lat:51.4242, lng:-0.5833,  region:'uk' },
  { name:'Mottisfont',                            lat:51.0553, lng:-1.5319,  region:'uk' },
  { name:'Exbury Gardens',                        lat:50.8164, lng:-1.4019,  region:'uk' },
  { name:'Pashley Manor Gardens',                 lat:51.0336, lng:0.4914,   region:'uk' },
  { name:'Merriments Gardens',                    lat:50.9817, lng:0.5247,   region:'uk' },
  // ── UK: South-West England ───────────────────────────────────────────────
  { name:'Trebah Garden',                         lat:50.0939, lng:-5.1114,  region:'uk' },
  { name:'Glendurgan Garden',                     lat:50.1003, lng:-5.0878,  region:'uk' },
  { name:'Heligan Gardens',                       lat:50.2628, lng:-4.8022,  region:'uk' },
  { name:'Trelissick Garden',                     lat:50.2017, lng:-5.0231,  region:'uk' },
  { name:'Tresco Abbey Garden',                   lat:49.9542, lng:-6.3306,  region:'uk' },
  { name:'RHS Garden Rosemoor',                   lat:50.8839, lng:-3.9931,  region:'uk' },
  { name:'Bicton Park Botanical Gardens',         lat:50.6856, lng:-3.3803,  region:'uk' },
  { name:'Greenway',                              lat:50.3903, lng:-3.6069,  region:'uk' },
  { name:'Coleton Fishacre',                      lat:50.3289, lng:-3.5517,  region:'uk' },
  { name:'Killerton',                             lat:50.7742, lng:-3.4764,  region:'uk' },
  { name:'Knightshayes Court',                    lat:50.9403, lng:-3.5061,  region:'uk' },
  { name:'Tyntesfield',                           lat:51.4047, lng:-2.7531,  region:'uk' },
  { name:'Montacute House',                       lat:50.9406, lng:-2.7119,  region:'uk' },
  { name:'Forde Abbey',                           lat:50.8161, lng:-2.8711,  region:'uk' },
  { name:'Mapperton Gardens',                     lat:50.7750, lng:-2.7194,  region:'uk' },
  { name:'Abbotsbury Subtropical Gardens',        lat:50.6617, lng:-2.5981,  region:'uk' },
  { name:'Hestercombe Gardens',                   lat:51.0322, lng:-3.1342,  region:'uk' },
  { name:'Prior Park Landscape Garden',           lat:51.3672, lng:-2.3497,  region:'uk' },
  { name:'Iford Manor',                           lat:51.3372, lng:-2.2694,  region:'uk' },
  { name:'Stourhead',                             lat:51.1003, lng:-2.2958,  region:'uk' },
  { name:'Kingston Lacy',                         lat:50.8019, lng:-2.0172,  region:'uk' },
  { name:'Athelhampton House',                    lat:50.7406, lng:-2.3742,  region:'uk' },
  { name:'The Garden House Devon',                lat:50.5194, lng:-4.1122,  region:'uk' },
  { name:'Cotehele',                              lat:50.4956, lng:-4.2200,  region:'uk' },
  { name:'Antony House',                          lat:50.3944, lng:-4.2361,  region:'uk' },
  { name:'Caerhays Castle Garden',                lat:50.2275, lng:-4.8764,  region:'uk' },
  { name:'East Lambrook Manor Gardens',           lat:50.9281, lng:-2.8242,  region:'uk' },
  { name:'Barrington Court',                      lat:50.9322, lng:-2.8833,  region:'uk' },
  // ── UK: East of England ──────────────────────────────────────────────────
  { name:'RHS Garden Hyde Hall',                  lat:51.6689, lng:0.6303,   region:'uk' },
  { name:'Beth Chatto Gardens',                   lat:51.8400, lng:0.9556,   region:'uk' },
  { name:'Anglesey Abbey',                        lat:52.2358, lng:0.2086,   region:'uk' },
  { name:'Blickling Estate',                      lat:52.8072, lng:1.2219,   region:'uk' },
  { name:'Sandringham Gardens',                   lat:52.8331, lng:0.5058,   region:'uk' },
  { name:'Bressingham Gardens',                   lat:52.4333, lng:1.0742,   region:'uk' },
  { name:'Helmingham Hall Gardens',               lat:52.1736, lng:1.1117,   region:'uk' },
  { name:'Somerleyton Hall Gardens',              lat:52.5117, lng:1.6869,   region:'uk' },
  { name:'Mannington Hall',                       lat:52.7864, lng:1.1672,   region:'uk' },
  { name:'Doddington Hall Gardens',               lat:53.1828, lng:-0.5594,  region:'uk' },
  { name:'Burghley House Gardens',                lat:52.6503, lng:-0.4597,  region:'uk' },
  { name:'Felbrigg Hall',                         lat:52.8792, lng:1.2703,   region:'uk' },
  { name:'Oxburgh Hall',                          lat:52.5833, lng:0.5972,   region:'uk' },
  { name:'Houghton Hall Walled Garden',           lat:52.8347, lng:0.6319,   region:'uk' },
  { name:'Wimpole Estate',                        lat:52.1286, lng:-0.0458,  region:'uk' },
  { name:'Audley End House and Gardens',          lat:52.0203, lng:0.2058,   region:'uk' },
  { name:'Peckover House',                        lat:52.5992, lng:0.1556,   region:'uk' },
  { name:'Elton Hall Gardens',                    lat:52.5450, lng:-0.3797,  region:'uk' },
  { name:'Grimsthorpe Castle Gardens',            lat:52.7725, lng:-0.4364,  region:'uk' },
  // ── UK: Midlands & Wales ─────────────────────────────────────────────────
  { name:'Hidcote',                               lat:52.0808, lng:-1.7311,  region:'uk' },
  { name:'Kiftsgate Court Gardens',               lat:52.0817, lng:-1.7333,  region:'uk' },
  { name:'Bodnant Garden',                        lat:53.2344, lng:-3.8011,  region:'uk' },
  { name:'Powis Castle Garden',                   lat:52.5997, lng:-3.2042,  region:'uk' },
  { name:'Barnsley House',                        lat:51.7853, lng:-1.8369,  region:'uk' },
  { name:'Bourton House Garden',                  lat:51.8972, lng:-1.7419,  region:'uk' },
  { name:'Birmingham Botanical Gardens',          lat:52.4731, lng:-1.9289,  region:'uk' },
  { name:'Upton House',                           lat:52.0747, lng:-1.5317,  region:'uk' },
  { name:'Packwood House',                        lat:52.3419, lng:-1.7328,  region:'uk' },
  { name:'Baddesley Clinton',                     lat:52.3464, lng:-1.7172,  region:'uk' },
  { name:'Coton Manor Garden',                    lat:52.3303, lng:-1.0919,  region:'uk' },
  { name:'Cottesbrooke Hall Gardens',             lat:52.3772, lng:-1.0167,  region:'uk' },
  { name:'Erddig',                                lat:52.9911, lng:-3.0044,  region:'uk' },
  { name:'Aberglasney Gardens',                   lat:51.8942, lng:-4.1703,  region:'uk' },
  { name:'National Botanic Garden of Wales',      lat:51.8567, lng:-4.1111,  region:'uk' },
  { name:'Ragley Hall Gardens',                   lat:52.2003, lng:-1.8428,  region:'uk' },
  { name:'Charlecote Park',                       lat:52.2086, lng:-1.6264,  region:'uk' },
  { name:'Hanbury Hall',                          lat:52.2792, lng:-2.1028,  region:'uk' },
  { name:'Wightwick Manor Gardens',               lat:52.5664, lng:-2.1747,  region:'uk' },
  { name:'Chirk Castle Gardens',                  lat:52.9342, lng:-3.0758,  region:'uk' },
  { name:'Dyffryn House and Gardens',             lat:51.4353, lng:-3.3061,  region:'uk' },
  // ── UK: North of England ─────────────────────────────────────────────────
  { name:'RHS Garden Harlow Carr',                lat:53.9894, lng:-1.5389,  region:'uk' },
  { name:'Studley Royal Water Garden',            lat:54.1214, lng:-1.5811,  region:'uk' },
  { name:'Newby Hall',                            lat:54.1031, lng:-1.4917,  region:'uk' },
  { name:'Castle Howard',                         lat:54.1214, lng:-0.9383,  region:'uk' },
  { name:'Scampston Hall Walled Garden',          lat:54.2042, lng:-0.6483,  region:'uk' },
  { name:'York Gate Garden',                      lat:53.8514, lng:-1.5978,  region:'uk' },
  { name:'Alnwick Garden',                        lat:55.4153, lng:-1.7050,  region:'uk' },
  { name:'Cragside',                              lat:55.3167, lng:-1.8806,  region:'uk' },
  { name:'Wallington',                            lat:55.1278, lng:-1.9503,  region:'uk' },
  { name:'Belsay Hall Gardens',                   lat:55.0861, lng:-1.8706,  region:'uk' },
  { name:'Levens Hall',                           lat:54.3031, lng:-2.7419,  region:'uk' },
  { name:'Sizergh Castle',                        lat:54.3100, lng:-2.7019,  region:'uk' },
  { name:'Holker Hall Gardens',                   lat:54.1836, lng:-2.9447,  region:'uk' },
  { name:'Dalemain',                              lat:54.6489, lng:-2.8256,  region:'uk' },
  { name:'Tatton Park',                           lat:53.3239, lng:-2.3825,  region:'uk' },
  { name:'Dunham Massey',                         lat:53.3842, lng:-2.3658,  region:'uk' },
  { name:'Biddulph Grange Garden',                lat:53.1289, lng:-2.1675,  region:'uk' },
  { name:'Wentworth Castle Gardens',              lat:53.5225, lng:-1.5347,  region:'uk' },
  { name:'Beningbrough Hall',                     lat:54.0233, lng:-1.1883,  region:'uk' },
  { name:'Nunnington Hall',                       lat:54.1675, lng:-1.0108,  region:'uk' },
  { name:'Parcevall Hall Gardens',                lat:54.0581, lng:-1.9211,  region:'uk' },
  { name:'Harewood House Gardens',                lat:53.8925, lng:-1.5381,  region:'uk' },
  // ── UK: Scotland ─────────────────────────────────────────────────────────
  { name:'Royal Botanic Garden Edinburgh',        lat:55.9678, lng:-3.2111,  region:'uk' },
  { name:'Crarae Garden',                         lat:56.0631, lng:-5.2297,  region:'uk' },
  { name:'Arduaine Garden',                       lat:56.2028, lng:-5.5497,  region:'uk' },
  { name:'Inverewe Garden',                       lat:57.7878, lng:-5.6011,  region:'uk' },
  { name:'Crathes Castle Garden',                 lat:57.0556, lng:-2.5281,  region:'uk' },
  { name:'Pitmedden Garden',                      lat:57.2781, lng:-2.2197,  region:'uk' },
  { name:'Branklyn Garden',                       lat:56.4028, lng:-3.4094,  region:'uk' },
  { name:'Drummond Castle Gardens',               lat:56.3789, lng:-3.8611,  region:'uk' },
  { name:'Logan Botanic Garden',                  lat:54.7197, lng:-4.9569,  region:'uk' },
  { name:'Threave Garden',                        lat:54.9261, lng:-3.9942,  region:'uk' },
  { name:'Culzean Castle and Country Park',       lat:55.3550, lng:-4.7939,  region:'uk' },
  { name:'Glenarn Garden',                        lat:56.0097, lng:-4.7797,  region:'uk' },
  { name:'Younger Botanic Garden Benmore',        lat:56.0608, lng:-4.9997,  region:'uk' },
  { name:'Castle Kennedy Gardens',                lat:54.8800, lng:-4.9569,  region:'uk' },
  { name:'Scone Palace Gardens',                  lat:56.4269, lng:-3.4139,  region:'uk' },
  { name:'House of Dun',                          lat:56.6778, lng:-2.5167,  region:'uk' },
  { name:'Glamis Castle Gardens',                 lat:56.6086, lng:-3.0003,  region:'uk' },
  // ── Ireland ──────────────────────────────────────────────────────────────
  { name:'National Botanic Gardens Dublin',       lat:53.3700, lng:-6.2681,  region:'ireland' },
  { name:'Powerscourt Estate Gardens',            lat:53.1822, lng:-6.1917,  region:'ireland' },
  { name:'Killarney House Gardens',               lat:52.0572, lng:-9.5069,  region:'ireland' },
  { name:'Glenveagh Castle Gardens',              lat:55.0408, lng:-7.9069,  region:'ireland' },
  { name:'Mount Usher Gardens',                   lat:52.9900, lng:-6.0678,  region:'ireland' },
  { name:'Birr Castle Demesne',                   lat:53.0994, lng:-7.9103,  region:'ireland' },
  { name:'Altamont Garden',                       lat:52.7100, lng:-6.7336,  region:'ireland' },
  { name:'Rowallane Garden',                      lat:54.3864, lng:-5.7469,  region:'ireland' },
  { name:'Mount Stewart',                         lat:54.5358, lng:-5.5481,  region:'ireland' },
  { name:'Benvarden Garden',                      lat:55.1250, lng:-6.5186,  region:'ireland' },
  { name:'Ilnacullin (Garinish Island)',           lat:51.7550, lng:-9.7364,  region:'ireland' },
  { name:'Fota Arboretum and Gardens',            lat:51.8994, lng:-8.2947,  region:'ireland' },
  { name:'Kilmacurragh Botanic Gardens',          lat:52.9433, lng:-6.1822,  region:'ireland' },
  { name:'Heywood Gardens',                       lat:52.8703, lng:-7.3536,  region:'ireland' },
  { name:'Strokestown Park Gardens',              lat:53.7764, lng:-8.1058,  region:'ireland' },
  // ── France: North ────────────────────────────────────────────────────────
  { name:"Giverny (Monet's Garden)",              lat:49.0761, lng:1.5344,   region:'mainland' },
  { name:'Château de Versailles Gardens',         lat:48.8049, lng:2.1204,   region:'mainland' },
  { name:'Vaux-le-Vicomte',                       lat:48.5678, lng:2.7156,   region:'mainland' },
  { name:'Château de Villandry Gardens',          lat:47.3417, lng:0.5131,   region:'mainland' },
  { name:'Château de Chaumont-sur-Loire Gardens', lat:47.4783, lng:1.1836,   region:'mainland' },
  { name:'Jardin des Plantes Paris',              lat:48.8442, lng:2.3597,   region:'mainland' },
  { name:'Parc de Bagatelle Paris',               lat:48.8653, lng:2.2456,   region:'mainland' },
  { name:'Château de Brécy Gardens',              lat:49.2208, lng:-0.4544,  region:'mainland' },
  { name:'Jardins du Château de Vendeuvre',       lat:48.9094, lng:0.0281,   region:'mainland' },
  { name:'Jardins de Valmer',                     lat:47.3806, lng:0.7019,   region:'mainland' },
  { name:'Château de Fontainebleau Gardens',      lat:48.4022, lng:2.7019,   region:'mainland' },
  { name:'Parc Floral de Paris',                  lat:48.8400, lng:2.4436,   region:'mainland' },
  { name:'Jardins de Kerdalo',                    lat:48.6214, lng:-3.1342,  region:'mainland' },
  { name:'Parc du Thabor Rennes',                 lat:48.1125, lng:-1.6703,  region:'mainland' },
  { name:'Jardins de la Ballue',                  lat:48.4342, lng:-1.6019,  region:'mainland' },
  { name:'Roseraie du Val-de-Marne',              lat:48.7797, lng:2.4708,   region:'mainland' },
  { name:'Jardins du Manoir d\'Eyrignac',         lat:44.9294, lng:1.2506,   region:'mainland' },
  { name:'Jardins de Marqueyssac',                lat:44.8494, lng:1.2100,   region:'mainland' },
  // ── France: South ────────────────────────────────────────────────────────
  { name:'Villa Ephrussi de Rothschild',          lat:43.6944, lng:7.3333,   region:'mainland' },
  { name:'Domaine du Rayol',                      lat:43.1539, lng:6.4742,   region:'mainland' },
  { name:'Serre de la Madone',                    lat:43.7758, lng:7.4158,   region:'mainland' },
  { name:'Château Val Joanis Gardens',            lat:43.7994, lng:5.5119,   region:'mainland' },
  { name:'Jardins de Salagon',                    lat:43.9006, lng:5.7353,   region:'mainland' },
  { name:'Bambouseraie en Cévennes',              lat:43.9500, lng:4.0019,   region:'mainland' },
  { name:'Parc Phoenix Nice',                     lat:43.6958, lng:7.2464,   region:'mainland' },
  { name:'Jardins de l\'Imaginaire Terrasson',    lat:45.1294, lng:1.3069,   region:'mainland' },
  { name:'Jardins de Cadiot',                     lat:44.8444, lng:0.9542,   region:'mainland' },
  { name:'Jardin Botanique de Lyon',              lat:45.7739, lng:4.8542,   region:'mainland' },
  { name:'Parc de la Tête d\'Or Lyon',            lat:45.7769, lng:4.8522,   region:'mainland' },
  { name:'Jardins du Palais Royal Paris',         lat:48.8644, lng:2.3369,   region:'mainland' },
  // ── Belgium, Netherlands, Luxembourg ─────────────────────────────────────
  { name:'Keukenhof',                             lat:52.2697, lng:4.5469,   region:'mainland' },
  { name:'Hortus Botanicus Amsterdam',            lat:52.3664, lng:4.9072,   region:'mainland' },
  { name:'Clingendael Park',                      lat:52.0869, lng:4.2800,   region:'mainland' },
  { name:'Paleis Het Loo Gardens',                lat:52.2442, lng:5.9597,   region:'mainland' },
  { name:'Arboretum Kalmthout',                   lat:51.3869, lng:4.4572,   region:'mainland' },
  { name:'Hortus Botanicus Leiden',               lat:52.1608, lng:4.4733,   region:'mainland' },
  { name:'Botanische Tuin Utrecht',               lat:52.0897, lng:5.1736,   region:'mainland' },
  { name:'Arboretum Trompenburg',                 lat:51.9061, lng:4.5072,   region:'mainland' },
  { name:'Kasteel de Haar Gardens',               lat:52.1253, lng:4.9917,   region:'mainland' },
  { name:'Rosarium Winschoten',                   lat:53.1433, lng:7.0369,   region:'mainland' },
  { name:'Annevoie Gardens',                      lat:50.3308, lng:4.8769,   region:'mainland' },
  { name:'Jardin Botanique de Meise',             lat:50.9297, lng:4.3169,   region:'mainland' },
  { name:'Citadelpark Ghent',                     lat:51.0378, lng:3.7108,   region:'mainland' },
  { name:'Château de Modave Gardens',             lat:50.4494, lng:5.2956,   region:'mainland' },
  { name:'Parc de Laeken Brussels',               lat:50.8933, lng:4.3608,   region:'mainland' },
  { name:'Château de Seneffe Gardens',            lat:50.5306, lng:4.2608,   region:'mainland' },
  { name:'Parc de Mariemont',                     lat:50.5072, lng:4.2819,   region:'mainland' },
  { name:'Jardins du Château de Jehay',           lat:50.5633, lng:5.3483,   region:'mainland' },
  { name:'Château d\'Hex Gardens',                lat:50.7733, lng:5.2603,   region:'mainland' },
  { name:'Jardins d\'Annevoie',                   lat:50.3311, lng:4.8772,   region:'mainland' },
  // ── Germany ───────────────────────────────────────────────────────────────
  { name:'Sanssouci Gardens Potsdam',             lat:52.4044, lng:13.0386,  region:'mainland' },
  { name:'Herrenhausen Gardens Hanover',          lat:52.3928, lng:9.6986,   region:'mainland' },
  { name:'Munich Botanical Garden',               lat:48.1633, lng:11.5006,  region:'mainland' },
  { name:'Berlin Botanical Garden',               lat:52.4486, lng:13.3053,  region:'mainland' },
  { name:'Schwetzingen Palace Gardens',           lat:49.3831, lng:8.5694,   region:'mainland' },
  { name:'Wilhelma Stuttgart',                    lat:48.8061, lng:9.2114,   region:'mainland' },
  { name:'Insel Mainau',                          lat:47.6997, lng:9.1969,   region:'mainland' },
  { name:'Planten un Blomen Hamburg',             lat:53.5617, lng:9.9808,   region:'mainland' },
  { name:'Palmengarten Frankfurt',                lat:50.1228, lng:8.6469,   region:'mainland' },
  { name:'Rhododendronpark Bremen',               lat:53.0964, lng:8.7794,   region:'mainland' },
  { name:'Schlosspark Pillnitz',                  lat:51.0097, lng:13.8786,  region:'mainland' },
  { name:'Muskauer Park',                         lat:51.5497, lng:14.9694,  region:'mainland' },
  { name:'Worlitz Garden Kingdom',                lat:51.8281, lng:12.4156,  region:'mainland' },
  { name:'Branitzer Park Cottbus',                lat:51.7444, lng:14.3594,  region:'mainland' },
  { name:'Schlosspark Schwerin',                  lat:53.6211, lng:11.4092,  region:'mainland' },
  { name:'Fürstliche Gärten Weikersheim',         lat:49.4803, lng:9.8986,   region:'mainland' },
  { name:'Schlosspark Linderhof',                 lat:47.5717, lng:10.9628,  region:'mainland' },
  { name:'Westpark Munich',                       lat:48.1228, lng:11.4922,  region:'mainland' },
  { name:'Britzer Garten Berlin',                 lat:52.4381, lng:13.4172,  region:'mainland' },
  { name:'Berggarten Hannover',                   lat:52.3917, lng:9.7019,   region:'mainland' },
  { name:'Rosengarten Zweibrücken',               lat:49.2522, lng:7.3633,   region:'mainland' },
  // ── Austria ───────────────────────────────────────────────────────────────
  { name:'Schönbrunn Palace Gardens',             lat:48.1847, lng:16.3122,  region:'mainland' },
  { name:'Belvedere Gardens Vienna',              lat:48.1919, lng:16.3806,  region:'mainland' },
  { name:'Volksgarten Vienna',                    lat:48.2064, lng:16.3619,  region:'mainland' },
  { name:'Burggarten Vienna',                     lat:48.2036, lng:16.3672,  region:'mainland' },
  { name:'Hellbrunn Palace Gardens',              lat:47.7567, lng:13.0617,  region:'mainland' },
  { name:'Mirabell Gardens Salzburg',             lat:47.8058, lng:13.0428,  region:'mainland' },
  { name:'Schloss Ambras Gardens Innsbruck',      lat:47.2539, lng:11.4278,  region:'mainland' },
  { name:'Botanischer Garten Vienna',             lat:48.1961, lng:16.3742,  region:'mainland' },
  { name:'Schlosspark Laxenburg',                 lat:48.0628, lng:16.3572,  region:'mainland' },
  { name:'Rosarium Baden bei Wien',               lat:48.0053, lng:16.2322,  region:'mainland' },
  { name:'Schloss Eggenberg Gardens',             lat:47.0664, lng:15.3933,  region:'mainland' },
  // ── Italy ─────────────────────────────────────────────────────────────────
  { name:'Villa d\'Este Gardens Tivoli',          lat:41.9631, lng:12.7961,  region:'mainland' },
  { name:'Villa Borghese Rome',                   lat:41.9142, lng:12.4922,  region:'mainland' },
  { name:'Boboli Gardens Florence',               lat:43.7628, lng:11.2497,  region:'mainland' },
  { name:'Villa Melzi Gardens Bellagio',          lat:45.9853, lng:9.2617,   region:'mainland' },
  { name:'Villa Carlotta Lake Como',              lat:46.0064, lng:9.2436,   region:'mainland' },
  { name:'Villa Taranto Lake Maggiore',           lat:45.9392, lng:8.5744,   region:'mainland' },
  { name:'Isola Bella Gardens',                   lat:45.8983, lng:8.5281,   region:'mainland' },
  { name:'Villa Cimbrone Ravello',                lat:40.6467, lng:14.6072,  region:'mainland' },
  { name:'Villa Rufolo Ravello',                  lat:40.6494, lng:14.6133,  region:'mainland' },
  { name:'Giardini Botanici Hanbury',             lat:43.7842, lng:7.5194,   region:'mainland' },
  { name:'Orto Botanico di Padova',               lat:45.3986, lng:11.8806,  region:'mainland' },
  { name:'Parco Giardino Sigurtà',                lat:45.3594, lng:10.7286,  region:'mainland' },
  { name:'Villa Pisani Gardens Stra',             lat:45.4111, lng:11.9978,  region:'mainland' },
  { name:'Giardino della Landriana',              lat:41.5531, lng:12.3019,  region:'mainland' },
  { name:'La Foce Gardens Tuscany',               lat:43.0378, lng:11.6933,  region:'mainland' },
  { name:'Villa Gamberaia Florence',              lat:43.7633, lng:11.3283,  region:'mainland' },
  { name:'Horti Leonini San Quirico d\'Orcia',    lat:43.0578, lng:11.6069,  region:'mainland' },
  { name:'Giardino Giusti Verona',                lat:45.4428, lng:11.0069,  region:'mainland' },
  { name:'Castello Ruspoli Gardens',              lat:42.3094, lng:12.1261,  region:'mainland' },
  { name:'Giardino Botanico di Brera Milan',      lat:45.4717, lng:9.1864,   region:'mainland' },
  // ── Spain ─────────────────────────────────────────────────────────────────
  { name:'Real Jardín Botánico Madrid',           lat:40.4114, lng:-3.6922,  region:'mainland' },
  { name:'Retiro Park Madrid',                    lat:40.4153, lng:-3.6844,  region:'mainland' },
  { name:'Generalife Gardens Granada',            lat:37.1772, lng:-3.5886,  region:'mainland' },
  { name:'Alcázar Gardens Seville',               lat:37.3831, lng:-5.9922,  region:'mainland' },
  { name:'Jardines de Aranjuez',                  lat:40.0331, lng:-3.6047,  region:'mainland' },
  { name:'Pazo de Oca Gardens Galicia',           lat:42.7081, lng:-8.4969,  region:'mainland' },
  { name:'Jardín Botánico de Barcelona',          lat:41.3653, lng:2.1536,   region:'mainland' },
  { name:'Park Güell Barcelona',                  lat:41.4145, lng:2.1527,   region:'mainland' },
  { name:'Real Jardín Botánico de Madrid',        lat:40.4114, lng:-3.6922,  region:'mainland' },
  { name:'Palacio Real de La Granja Gardens',     lat:40.8983, lng:-4.0139,  region:'mainland' },
  { name:'Capricho de la Alameda de Osuna',       lat:40.4444, lng:-3.6042,  region:'mainland' },
  { name:'Jardines de Sabatini Madrid',           lat:40.4192, lng:-3.7147,  region:'mainland' },
  { name:'Jardines de Santa Clotilde Lloret de Mar', lat:41.6989, lng:2.8572, region:'mainland' },
  { name:'Laberint d\'Horta Barcelona',           lat:41.4294, lng:2.1439,   region:'mainland' },
  { name:'Jardín Botánico de Valencia',           lat:39.4731, lng:-0.3808,  region:'mainland' },
  { name:'Pazo de Mariñán',                       lat:43.3472, lng:-8.2917,  region:'mainland' },
  { name:'Jardines de Alfabia Mallorca',          lat:39.7394, lng:2.7022,   region:'mallorca' },
  // ── Portugal ──────────────────────────────────────────────────────────────
  { name:'Jardim Botânico de Lisboa',             lat:38.7167, lng:-9.1533,  region:'mainland' },
  { name:'Palácio de Queluz Gardens',             lat:38.7556, lng:-9.2561,  region:'mainland' },
  { name:'Jardins do Palácio de Monserrate Sintra', lat:38.7883, lng:-9.4281, region:'mainland' },
  { name:'Quinta da Regaleira Sintra',            lat:38.7978, lng:-9.3975,  region:'mainland' },
  { name:'Jardins do Palácio Nacional de Pena',   lat:38.7878, lng:-9.3906,  region:'mainland' },
  { name:'Jardim Botânico do Porto',              lat:41.1508, lng:-8.6294,  region:'mainland' },
  { name:'Jardim da Fundação Calouste Gulbenkian', lat:38.7364, lng:-9.1542, region:'mainland' },
  { name:'Parque de Serralves Porto',             lat:41.1578, lng:-8.6578,  region:'mainland' },
  { name:'Jardim do Paço Episcopal Castelo Branco', lat:39.8208, lng:-7.4942, region:'mainland' },
  { name:'Tapada de Mafra',                       lat:38.9383, lng:-9.3317,  region:'mainland' },
  { name:'Jardim Botânico da Ajuda',              lat:38.7047, lng:-9.1886,  region:'mainland' },
  { name:'Parque Eduardo VII Lisbon',             lat:38.7267, lng:-9.1528,  region:'mainland' },
  { name:'Quinta do Palheiro Ferreiro Madeira',   lat:32.6594, lng:-16.8678, region:'madeira' },
  { name:'Monte Palace Tropical Garden Madeira',  lat:32.6633, lng:-16.8975, region:'madeira' },
  // ── Greece ────────────────────────────────────────────────────────────────
  { name:'National Garden Athens',                lat:37.9736, lng:23.7386,  region:'mainland' },
  { name:'Zappeion Gardens Athens',               lat:37.9694, lng:23.7386,  region:'mainland' },
  { name:'Botanical Garden of Athens',            lat:37.9686, lng:23.7822,  region:'mainland' },
  { name:'Stavros Niarchos Foundation Cultural Centre Gardens', lat:37.9428, lng:23.6908, region:'mainland' },
  { name:'Municipal Garden of Chania Crete',      lat:35.5136, lng:24.0175,  region:'mainland' },
  { name:'Botanical Park and Gardens of Crete',   lat:35.1994, lng:23.7903,  region:'mainland' },
  { name:'Rodini Park Rhodes',                    lat:36.4228, lng:28.2281,  region:'mainland' },
  { name:'Municipal Garden Corfu Town',           lat:39.6228, lng:19.9219,  region:'mainland' },
  { name:'Achilleion Palace Gardens Corfu',       lat:39.5642, lng:19.9178,  region:'mainland' },
  { name:'Botanical Garden of Thessaloniki',      lat:40.6344, lng:22.9444,  region:'mainland' },
  { name:'Nymfaio Arboretum',                     lat:40.6172, lng:21.5456,  region:'mainland' },
  // ── USA: East Coast ───────────────────────────────────────────────────────
  { name:'Longwood Gardens',                      lat:39.8706, lng:-75.6727, region:'mainland' },
  { name:'New York Botanical Garden',             lat:40.8619, lng:-73.8778, region:'mainland' },
  { name:'Brooklyn Botanic Garden',               lat:40.6694, lng:-73.9636, region:'mainland' },
  { name:'Arnold Arboretum Boston',               lat:42.3081, lng:-71.1244, region:'mainland' },
  { name:'Dumbarton Oaks Washington DC',          lat:38.9144, lng:-77.0631, region:'mainland' },
  { name:'Winterthur Garden',                     lat:39.8658, lng:-75.5972, region:'mainland' },
  { name:'Chanticleer Garden',                    lat:40.0494, lng:-75.3997, region:'mainland' },
  { name:'Wave Hill',                             lat:40.8983, lng:-73.9122, region:'mainland' },
  { name:'Ladew Topiary Gardens',                 lat:39.5997, lng:-76.5469, region:'mainland' },
  { name:'Biltmore Estate Gardens',               lat:35.5406, lng:-82.5519, region:'mainland' },
  { name:'Magnolia Plantation and Gardens',       lat:32.8811, lng:-80.0969, region:'mainland' },
  { name:'Vizcaya Museum and Gardens',            lat:25.7453, lng:-80.2406, region:'mainland' },
  // ── USA: West Coast ───────────────────────────────────────────────────────
  { name:'Butchart Gardens Victoria',             lat:48.5644, lng:-123.4717, region:'mainland' },
  { name:'Van Dusen Botanical Garden Vancouver',  lat:49.2369, lng:-123.1347, region:'mainland' },
  { name:'Portland Japanese Garden',              lat:45.5197, lng:-122.7061, region:'mainland' },
  { name:'Huntington Library Art Museum and Botanical Gardens', lat:34.1289, lng:-118.1144, region:'mainland' },
  { name:'Filoli',                                lat:37.5256, lng:-122.3147, region:'mainland' },
  { name:'San Francisco Botanical Garden',        lat:37.7669, lng:-122.4672, region:'mainland' },
  { name:'UC Berkeley Botanical Garden',          lat:37.8764, lng:-122.2411, region:'mainland' },
  { name:'Crystal Springs Rhododendron Garden',   lat:45.4681, lng:-122.6456, region:'mainland' },
  { name:'Bellevue Botanical Garden',             lat:47.5972, lng:-122.1561, region:'mainland' },
  // ── Hawaii ────────────────────────────────────────────────────────────────
  { name:'Foster Botanical Garden Honolulu',      lat:21.3172, lng:-157.8628, region:'mainland' },
  { name:'Lyon Arboretum Honolulu',               lat:21.3328, lng:-157.8019, region:'mainland' },
  { name:'Waimea Valley Botanical Garden',        lat:21.6383, lng:-158.0508, region:'mainland' },
  { name:'National Tropical Botanical Garden Kauai', lat:21.9094, lng:-159.5281, region:'mainland' },
  { name:'Maui Nui Botanical Gardens',            lat:20.8894, lng:-156.4736, region:'mainland' },
  // ── Australia & New Zealand ───────────────────────────────────────────────
  { name:'Royal Botanic Garden Sydney',           lat:-33.8642, lng:151.2167, region:'au' },
  { name:'Royal Botanic Gardens Melbourne',       lat:-37.8306, lng:144.9797, region:'au' },
  { name:'Adelaide Botanic Garden',               lat:-34.9183, lng:138.6094, region:'au' },
  { name:'Kings Park Perth',                      lat:-31.9600, lng:115.8331, region:'au' },
  { name:'Australian National Botanic Gardens Canberra', lat:-35.2772, lng:149.1108, region:'au' },
  { name:'Brisbane Botanic Gardens Mount Coot-tha', lat:-27.4778, lng:152.9781, region:'au' },
  { name:'Christchurch Botanic Gardens',          lat:-43.5322, lng:172.6208, region:'nz' },
  { name:'Hamilton Gardens New Zealand',          lat:-37.7781, lng:175.3031, region:'nz' },
  { name:'Wellington Botanic Garden',             lat:-41.2811, lng:174.7694, region:'nz' },
  { name:'Dunedin Botanic Garden',                lat:-45.8661, lng:170.5044, region:'nz' },
  { name:'Ayrlies Garden Auckland',               lat:-36.9267, lng:175.0933, region:'nz' },
];

// ── Haversine distance (km) ───────────────────────────────────────────────────
function _haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2)
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
        * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Get candidate gardens sorted by distance ──────────────────────────────────
// Returns gardens within 200km, compatible region, sorted nearest-first.
// If fewer than 12 found, relaxes distance cap to 400km before giving up.
var MAX_DIST_KM = 200;
var MAX_DIST_FALLBACK_KM = 400;

function getRegionalGardens(lat, lng, userRegion) {
  if (lat == null || lng == null) return [];
  userRegion = userRegion || 'mainland';

  function _candidates(maxDist) {
    return GARDENS
      .filter(function(g) { return _gardenCompatible(userRegion, g.region); })
      .map(function(g) { return { name: g.name, dist: _haversineKm(lat, lng, g.lat, g.lng) }; })
      .filter(function(g) { return g.dist <= maxDist; })
      .sort(function(a, b) { return a.dist - b.dist; })
      .map(function(g) { return g.name; });
  }

  var results = _candidates(MAX_DIST_KM);
  if (results.length < 12) {
    console.log('[PDF] inspo: fewer than 12 gardens within ' + MAX_DIST_KM + 'km — relaxing to ' + MAX_DIST_FALLBACK_KM + 'km');
    results = _candidates(MAX_DIST_FALLBACK_KM);
  }
  console.log('[PDF] inspo: ' + results.length + ' candidate gardens within range of ' + userRegion);
  return results;
}
    'Royal Botanic Gardens, Kew','RHS Garden Wisley','Sissinghurst Castle Garden',
    'Great Dixter House and Gardens','Wakehurst','Hampton Court Palace Garden',
    'Chelsea Physic Garden','Emmetts Garden','Nymans','Sheffield Park and Garden',
    'Penshurst Place','Hever Castle Gardens','Chartwell','Knole Park','Scotney Castle',
    "Bateman's",'Borde Hill Garden','Leonardslee Lakes and Gardens',
    'Parham House and Gardens','West Dean Gardens','Denmans Garden',
    'Loseley Park','Painshill Park','Claremont Landscape Garden',
    'Polesden Lacey','The Savill Garden','Mottisfont','Exbury Gardens',
    'Jenkyn Place','Hannah Peschar Sculpture Garden','Pashley Manor Gardens',
    'Batemans','Coombe Wood Garden','Merriments Gardens',
  ]},
  // ── UK: South-West England (Devon, Cornwall, Dorset, Somerset, Wiltshire) ───
  { box:[49.9,51.5,-6.5,-1.8], gardens:[
    'Trebah Garden','Glendurgan Garden','Heligan Gardens','Trelissick Garden',
    'Tresco Abbey Garden','RHS Garden Rosemoor','Bicton Park Botanical Gardens',
    'Greenway','Coleton Fishacre','Killerton','Knightshayes Court','Tyntesfield',
    'Montacute House','Forde Abbey','Mapperton Gardens','Abbotsbury Subtropical Gardens',
    'Hestercombe Gardens','Prior Park Landscape Garden','Iford Manor','Stourhead',
    'Kingston Lacy','Athelhampton House','Lacock Abbey','Bowood House and Gardens',
    'Corsham Court','Barrington Court','Tintinhull Garden','East Lambrook Manor Gardens',
    'The Garden House Devon','Cotehele','Antony House','Caerhays Castle Garden',
  ]},
  // ── UK: East of England (Essex, Suffolk, Norfolk, Cambridgeshire, Lincolnshire) ─
  { box:[51.5,53.5,-1.0,2.0], gardens:[
    'RHS Garden Hyde Hall','Beth Chatto Gardens','Anglesey Abbey',
    'Blickling Estate','Sandringham Gardens','Bressingham Gardens',
    'Helmingham Hall Gardens','Somerleyton Hall Gardens','Mannington Hall',
    'Benington Lordship','Doddington Hall Gardens','Burghley House Gardens',
    'Felbrigg Hall','Oxburgh Hall','Houghton Hall Walled Garden',
    'Wimpole Estate','Audley End House and Gardens','Peckover House',
    'Elton Hall Gardens','Grimsthorpe Castle Gardens',
  ]},
  // ── UK: Midlands & Wales ────────────────────────────────────────────────────
  { box:[51.3,53.5,-5.5,-1.0], gardens:[
    'Hidcote','Kiftsgate Court Gardens','Bodnant Garden','Powis Castle Garden',
    'Barnsley House','Bourton House Garden','Birmingham Botanical Gardens',
    'Upton House','Packwood House','Baddesley Clinton','Coton Manor Garden',
    'Cottesbrooke Hall Gardens','Erddig','Aberglasney Gardens',
    'National Botanic Garden of Wales','Ragley Hall Gardens','Charlecote Park',
    'Hanbury Hall','Moseley Old Hall','Attingham Park','Wightwick Manor Gardens',
    'Chirk Castle Gardens','Tredegar House','Dyffryn House and Gardens',
    'Bodysgallen Hall','Plas Newydd','Bodnant Garden','Chirk Castle',
  ]},
  // ── UK: North of England (Yorkshire, Lancashire, Cumbria, Northumberland) ───
  { box:[53.0,55.8,-3.5,0.0], gardens:[
    'RHS Garden Harlow Carr','Studley Royal Water Garden','Newby Hall',
    'Castle Howard','Scampston Hall Walled Garden','York Gate Garden',
    'Alnwick Garden','Cragside','Wallington','Belsay Hall Gardens',
    'Levens Hall','Sizergh Castle','Holker Hall Gardens','Dalemain',
    'Tatton Park','Dunham Massey','Biddulph Grange Garden',
    'Wentworth Castle Gardens','Beningbrough Hall','Nunnington Hall',
    'Parcevall Hall Gardens','Broughton Hall','Sledmere House Gardens',
    'Skipton Castle Gardens','Harewood House Gardens',
  ]},
  // ── UK: Scotland ─────────────────────────────────────────────────────────────
  { box:[54.5,61.0,-8.0,-0.5], gardens:[
    'Royal Botanic Garden Edinburgh','Crarae Garden','Arduaine Garden',
    'Inverewe Garden','Crathes Castle Garden','Pitmedden Garden',
    'Branklyn Garden','Drummond Castle Gardens','Logan Botanic Garden',
    'Threave Garden','Culzean Castle and Country Park','Glenarn Garden',
    'Craigieburn Garden','Cally Gardens','Bargany Gardens',
    'Castle Kennedy Gardens','Galloway House Gardens','Younger Botanic Garden Benmore',
    'Crarae Garden','Torosay Castle Gardens','Colonsay House Gardens',
    'House of Dun','Glamis Castle Gardens','Scone Palace Gardens',
  ]},
  // ── UK: Ireland ──────────────────────────────────────────────────────────────
  { box:[51.3,55.5,-10.5,-5.5], gardens:[
    'National Botanic Gardens Dublin','Powerscourt Estate Gardens',
    'Killarney House Gardens','Glenveagh Castle Gardens',
    'Mount Usher Gardens','Birr Castle Demesne','Altamont Garden',
    'Rowallane Garden','Mount Stewart','Benvarden Garden',
    'Ilnacullin (Garinish Island)','Creagh Garden','Ballymaloe Cookery School Gardens',
    'Fota Arboretum and Gardens','Kilmacurragh Botanic Gardens',
    'Heywood Gardens','Tullynally Castle Gardens','Strokestown Park Gardens',
  ]},
  // ── France: North (Normandy, Brittany, Loire Valley, Île-de-France) ─────────
  { box:[46.5,51.1,-5.5,3.5], gardens:[
    "Giverny (Monet's Garden)",'Château de Versailles Gardens','Vaux-le-Vicomte',
    'Château de Villandry Gardens','Jardins de Marqueyssac','Jardin des Plantes Paris',
    'Château de Chaumont-sur-Loire Gardens','Château de Brécy Gardens',
    'Jardins du Château de Canon','Jardins du Château de Vendeuvre',
    'Jardins de Valmer','Parc de Bagatelle Paris','Roseraie du Val-de-Marne',
    'Jardins du Manoir de Erygnac','Château de Fontainebleau Gardens',
    'Jardins de Courseulles','Parc Floral de Paris','Jardins de Kerdalo',
    'Domaine de Kerguéhennec','Parc du Thabor Rennes','Jardins de la Ballue',
    'Château de Brétesche','Jardins de Callunes','Jardin Georges Delaselle',
  ]},
  // ── France: South (Provence, Languedoc, Côte d'Azur, Dordogne, Bordeaux) ───
  { box:[41.5,46.5,-2.0,9.5], gardens:[
    'Jardins de la Fontaine Nîmes','Villa Ephrussi de Rothschild',
    'Jardin Exotique Monaco','Domaine du Rayol','Les Jardins de la Riviera',
    'Jardins de Pontchartrain','Serre de la Madone','Château Val Joanis Gardens',
    'Jardins de l\'Abbaye de Valsaintes','Jardins de Salagon',
    'Prieuré de Salagon','Jardins du Château de Gourdon',
    'Bambouseraie en Cévennes','Jardins de Roquelin','Parc Phoenix Nice',
    'Jardins de la Bastide du Roy','Jardins du Château de la Gaude',
    'Jardins de l\'Imaginaire Terrasson','Jardins de Eyrignac',
    'Château de Losse Gardens','Jardins de Cadiot','Parc Bordelais',
  ]},
  // ── Belgium, Netherlands, Luxembourg ────────────────────────────────────────
  { box:[49.4,53.6,2.5,7.2], gardens:[
    'Keukenhof','Hortus Botanicus Amsterdam','Clingendael Park',
    'Paleis Het Loo Gardens','Arboretum Kalmthout','Hex Castle Gardens',
    'Hortus Botanicus Leiden','Botanische Tuin Utrecht','Arboretum Trompenburg',
    'Kasteel de Haar Gardens','Park Clingendael','Beeckestijn Estate',
    'Rosarium Winschoten','Botanical Garden Delft','Arboretum Oudenbosch',
    'Château de Freÿr Gardens','Annevoie Gardens','Château d\'Hex Gardens',
    'Jardin Botanique de Meise','Citadelpark Ghent','Château de Modave Gardens',
    'Parc de Laeken Brussels','Château de Seneffe Gardens',
    'Parc de Mariemont','Jardins du Château de Jehay',
  ]},
  // ── Germany ──────────────────────────────────────────────────────────────────
  { box:[47.2,55.1,5.8,15.1], gardens:[
    'Sanssouci Gardens Potsdam','Herrenhausen Gardens Hanover',
    'Munich Botanical Garden','Berlin Botanical Garden',
    'Schwetzingen Palace Gardens','Wilhelma Stuttgart',
    'Insel Mainau','Berggarten Hannover','Rosengarten Zweibrücken',
    'Westpark Munich','Planten un Blomen Hamburg','Britzer Garten Berlin',
    'Palmengarten Frankfurt','Rhododendronpark Bremen','Schlosspark Pillnitz',
    'Muskauer Park','Worlitz Garden Kingdom','Branitzer Park Cottbus',
    'Schlosspark Schwerin','Fürstliche Gärten Weikersheim',
    'Schlosspark Linderhof','Park Schönbusch','Erbacher Schlossgarten',
  ]},
  // ── Austria ──────────────────────────────────────────────────────────────────
  { box:[46.3,49.0,9.5,17.2], gardens:[
    'Schönbrunn Palace Gardens','Belvedere Gardens Vienna',
    'Volksgarten Vienna','Burggarten Vienna','Prater Vienna',
    'Schloss Eggenberg Gardens','Stift Admont Gardens','Hellbrunn Palace Gardens',
    'Mirabell Gardens Salzburg','Schloss Ambras Gardens Innsbruck',
    'Arboretum Grillhof','Botanischer Garten Vienna','Schlosspark Laxenburg',
    'Rosarium Baden bei Wien','Kurgarten Baden bei Wien',
  ]},
  // ── Italy ────────────────────────────────────────────────────────────────────
  { box:[36.5,47.1,6.6,18.6], gardens:[
    'Villa d\'Este Gardens Tivoli','Villa Borghese Rome','Boboli Gardens Florence',
    'Villa Melzi Gardens Bellagio','Villa Carlotta Lake Como',
    'Villa Taranto Lake Maggiore','Isola Bella Gardens','Villa Cimbrone Ravello',
    'Villa Rufolo Ravello','Giardini Botanici Hanbury',
    'Orto Botanico di Padova','Giardino di Boboli','Villa Medici Rome',
    'Parco Giardino Sigurtà','Giardino Botanico di Brera Milan',
    'Villa Pisani Gardens Stra','Giardino della Landriana',
    'La Foce Gardens Tuscany','Castello Ruspoli Gardens',
    'Giardino di Venzano','Villa Gamberaia Florence',
    'Horti Leonini San Quirico d\'Orcia','Giardino Giusti Verona',
  ]},
  // ── Spain ────────────────────────────────────────────────────────────────────
  { box:[35.9,43.8,-9.3,4.3], gardens:[
    'Real Jardín Botánico Madrid','Retiro Park Madrid',
    'Generalife Gardens Granada','Alcázar Gardens Seville',
    'Jardines de Aranjuez','Pazo de Oca Gardens Galicia',
    'Jardín Botánico de Barcelona','Park Güell Barcelona',
    'Jardines de Alfabia Mallorca','Jardín Botánico de Valencia',
    'Real Jardín Botánico de Madrid','Palacio Real de La Granja Gardens',
    'Jardines del Monasterio de Yuste','Pazo de Mariñán',
    'Capricho de la Alameda de Osuna','Jardines de Sabatini Madrid',
    'Jardín de Cactus Lanzarote','Jardines de Can Artigas',
    'Jardines de Santa Clotilde Lloret de Mar','Laberint d\'Horta Barcelona',
  ]},
  // ── Portugal ─────────────────────────────────────────────────────────────────
  { box:[36.8,42.2,-9.5,-6.2], gardens:[
    'Jardim Botânico de Lisboa','Palácio de Queluz Gardens',
    'Jardins do Palácio de Monserrate Sintra','Quinta da Regaleira Sintra',
    'Jardins do Palácio Nacional de Pena','Jardim Botânico do Porto',
    'Jardim da Fundação Calouste Gulbenkian','Parque de Serralves Porto',
    'Jardim do Paço Episcopal Castelo Branco','Tapada de Mafra',
    'Jardim Botânico da Ajuda','Parque Eduardo VII Lisbon',
    'Quinta do Palheiro Ferreiro Madeira','Monte Palace Tropical Garden Madeira',
  ]},
  // ── Greece ───────────────────────────────────────────────────────────────────
  { box:[34.8,42.0,19.3,29.7], gardens:[
    'National Garden Athens','Zappeion Gardens Athens',
    'Botanical Garden of Athens','Nymfaio Arboretum',
    'Stavros Niarchos Foundation Cultural Centre Gardens',
    'Municipal Garden of Chania Crete','Botanical Park and Gardens of Crete',
// ── Normalise garden name for dedup ──────────────────────────────────────────
function normaliseGardenName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\b(rhs|nts|english heritage|national trust|the|garden|gardens|park|house|castle|abbey|hall|manor|place|estate|botanical|botanic|arboretum|pleasure grounds)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ── Single inspo fetch ────────────────────────────────────────────────────────
function fetchInspoOne(plant, monthName, climate, lat, lng, userRegion, apiKey, usedNames) {
  return new Promise(function(resolve) {
    if (!apiKey) { resolve(null); return; }
    var locationHint = lat && lng
      ? ' (approx. ' + Math.round(lat) + '\u00b0N ' + Math.round(Math.abs(lng)) + '\u00b0' + (lng < 0 ? 'W' : 'E') + ')'
      : '';
    var recentUsed = usedNames.slice(-4);
    var excludeClause = recentUsed.length
      ? '\n\nDo NOT suggest any of these: ' + recentUsed.join(', ') + '.'
      : '';
    var regionalGardens = getRegionalGardens(lat, lng, userRegion);
    var candidates = regionalGardens.filter(function(g) {
      return usedNames.indexOf(g) === -1 && normaliseGardenName(g) !== '' &&
        usedNames.every(function(u) { return normaliseGardenName(u) !== normaliseGardenName(g); });
    });
    var gardenHint;
    if (candidates.length > 0) {
      // Preferred: pick from curated regional list
      gardenHint = '\n\nChoose from these verified gardens near ' + climate + ' (all are real and within day-trip distance): '
        + candidates.slice(0, 12).join(', ') + '.'
        + ' Pick the one that is most interesting specifically in ' + monthName + '.';
    } else {
      // Fallback: curated list exhausted — let Claude choose freely but constrain quality
      console.log('[PDF] inspo: regional candidates exhausted for ' + climate + ', using free-choice fallback');
      gardenHint = '\n\nSuggest a real, well-known, publicly accessible garden within a comfortable day trip of '
        + climate + '. It must genuinely exist and be visitable. Do NOT repeat any of these already used: '
        + (usedNames.length ? usedNames.join(', ') : 'none') + '.';
    }

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
async function fetchAllInspos(plants, monthNames, monthIndices, climate, lat, lng, userRegion, apiKey) {
  var inspos = [];
  var usedNormalised = [];
  var usedDisplay = [];

  for (var i = 0; i < 12; i++) {
    var result = await fetchInspoOne(
      plants[i], monthNames[i], climate, lat, lng, userRegion, apiKey, usedDisplay
    );
    var attempts = 0;
    while (result && result.name && attempts < 3) {
      var norm = normaliseGardenName(result.name);
      if (usedNormalised.indexOf(norm) === -1) break;
      console.log('[PDF] Dedup: ' + result.name + ' already used, retrying...');
      usedDisplay.push(result.name);
      result = await fetchInspoOne(
        plants[i], monthNames[i], climate, lat, lng, userRegion, apiKey, usedDisplay
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
async function buildFullHTML(order, apiKey, opts) {
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
  // Derive climate label from geocode result — overrides whatever the form sent
  if (geo && geo.displayName) {
    climate = geo.displayName;
    console.log('[PDF] Climate label derived from geocode: ' + climate);
  }
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
    climate, geo && geo.lat, geo && geo.lng, geo && geo.userRegion || 'mainland', apiKey
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
    var doc = tpl.buildDocument(pages, { proof: !(opts && opts.approved) });
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
