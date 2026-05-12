// pdfService.js (CommonJS)
// Generic PDF pipeline — product-agnostic.
// Product-specific content (artwork, inspo gardens, page A layout, cover page)
// lives in products/garden-wall-calendar.js and is loaded via products/index.js.
//
// Page A: provided by product.buildPageA(monthOpts)
// Page B: full calendar grid — tpl.buildPageB(monthOpts)  [shared, unchanged]
// Cover:  provided by product.buildCoverPage(opts)

var express   = require('express');
var QRCode    = require('qrcode');
var puppeteer = require('puppeteer-core');
var chromium  = require('@sparticuz/chromium');
var https     = require('https');
var http      = require('http');
var tpl       = require('./calendarTemplate.js');
var fontMgr   = require('./downloadFonts.js');
var products  = require('./products/index.js');

// Etsy shop URL — set ETSY_SHOP_URL env var on Render before going live
var ETSY_SHOP_URL = process.env.ETSY_SHOP_URL || 'www.etsy.com/shop/HobbyCalendar';

// Download fonts at startup (async, non-blocking)
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
// compressToJpegDataUri and compressDataUri are passed to product.buildSharedState
// so products can compress their own imagery without depending on this module.
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


// ── Geocoding + climate data ──────────────────────────────────────────────────
// ── Region helper (used by geocodeCity to tag location) ─────────────────────────
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
    // Strip trailing country/region suffixes that confuse Photon into returning POIs
    // e.g. "Wandsworth, UK" → "Wandsworth", "Bath, England" → "Bath"
    var q = city.replace(/,?\s*(uk|gb|england|scotland|wales|northern ireland|united kingdom|great britain)$/i, '').trim();
    var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=5&lang=en';
    https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          var features = d.features || [];
          if (!features.length) { resolve(null); return; }
          // Prefer osm_key=place results over POIs
          var placeKeys = ['place', 'boundary', 'natural', 'landuse'];
          var f = features.find(function(feat) {
            var k = ((feat.properties || {}).osm_key || '').toLowerCase();
            return placeKeys.indexOf(k) !== -1;
          }) || features[0];
          var props = f.properties || {};
          var placeName = props.name || props.district || props.city || props.locality || '';
          var cc     = (props.countrycode || '').toLowerCase();
          var state  = (props.state  || '').toLowerCase();
          var county = (props.county || '').toLowerCase();
          var name   = placeName.toLowerCase();
          var userRegion = _deriveUserRegion(cc, state, county, name);
          console.log('[PDF] Geocode userRegion: ' + userRegion + ' (cc=' + cc + ')');
          resolve({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            displayName: city.trim(), // use user's original input as display label
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
  // NASA POWER Climatology API — free, no key, no daily cap, global coverage.
  // Returns 30-year monthly climate normals (MERRA-2 model).
  // T2M = monthly mean 2m temperature (°C) — realistic averages, used with ±3°C offset
  // for tMax/tMin to give a sensible chart spread.
  // PRECTOTCORR = precipitation (mm/day avg). ALLSKY_SFC_SW_DWN = solar radiation (MJ/m²/day).
  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var daysPerMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  var url = 'https://power.larc.nasa.gov/api/temporal/climatology/point'
    + '?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN'
    + '&community=AG'
    + '&longitude=' + lng.toFixed(4)
    + '&latitude=' + lat.toFixed(4)
    + '&format=JSON';
  return new Promise(function(resolve) {
    var req = https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          var params = d && d.properties && d.properties.parameter;
          if (!params || !params.T2M) {
            console.error('[PDF] NASA POWER API error:', JSON.stringify(d).slice(0, 200));
            resolve(null); return;
          }
          var tMax=[], tMin=[], precip=[], sunHrs=[];
          for (var i = 0; i < 12; i++) {
            var mo = MONTHS[i];
            var mean = params.T2M[mo] || 0;
            tMax.push(  parseFloat((mean + 3).toFixed(1)));
            tMin.push(  parseFloat((mean - 3).toFixed(1)));
            // PRECTOTCORR is mm/day average — multiply by days in month for monthly total
            precip.push(parseFloat(((params.PRECTOTCORR[mo] || 0) * daysPerMonth[i]).toFixed(0)));
            // ALLSKY_SFC_SW_DWN is MJ/m²/day — divide by 3.6 for approximate peak sun hours
            sunHrs.push(parseFloat(((params.ALLSKY_SFC_SW_DWN[mo] || 0) / 3.6).toFixed(1)));
          }
          console.log('[PDF] Climate data: NASA POWER 30-year climatology normals');
          resolve({ _cd: { tMax: tMax, tMin: tMin, precip: precip, sunHrs: sunHrs } });
        } catch(e) {
          console.error('[PDF] NASA POWER parse error:', e.message, 'raw:', data.slice(0, 300));
          resolve(null);
        }
      });
    });
    req.on('error', function(e) {
      console.error('[PDF] NASA POWER fetch error:', e.message);
      resolve(null);
    });
    req.setTimeout(30000, function() {
      console.error('[PDF] NASA POWER fetch timeout');
      req.destroy();
      resolve(null);
    });
  });
}

// In-memory climate cache — keyed by rounded lat/lng, cleared at midnight
// Disk-persisted climate cache — keyed by rounded lat/lng, cleared at midnight.
// Survives Render restarts and deploys. File: climate-cache.json in project root.
var _climateCachePath = process.env.RENDER_DISK_PATH
  ? require('path').join(process.env.RENDER_DISK_PATH, 'climate-cache.json')
  : require('path').join(__dirname, 'climate-cache.json');

// Shared-state cache path — stores pre-built artwork/inspo/QR data per order
// so the approve run can skip the expensive buildSharedState step entirely.
var _stateDirPath = process.env.RENDER_DISK_PATH || __dirname;

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


// ── Product formats ───────────────────────────────────────────────────────────
// widthMm/heightMm are passed to generatePDF — products can specify their own dimensions.
var FORMATS = {
  a3: { widthMm: 305, heightMm: 428, label: 'A3 Portrait Standard Wall Calendar' },
  a4: { widthMm: 305, heightMm: 218, label: 'A4 Landscape Wire-O Calendar' },
};

var router = express.Router();

// ── QR code helper ────────────────────────────────────────────────────────────
async function makeQrB64(url, ecl) {
  try {
    var dataUrl = await QRCode.toDataURL(url, {
      width: 150, margin: 2,
      errorCorrectionLevel: ecl || 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    return dataUrl;
  } catch(e) { console.error('[PDF] QR gen error:', e.message); return ''; }
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
  if (body.keyDates && body.keyDates.length > 20)
    errors.push('maximum 20 key dates');
  if (body.holidays && body.holidays.length > 6)
    errors.push('maximum 6 holiday periods');
  // Delegate product-specific validation (e.g. plants array check for garden calendar)
  var product = products.getProduct(body.productType);
  product.validateOrder(body, errors);
  return errors;
}

// ── Build full HTML ───────────────────────────────────────────────────────────
// Returns { html, widthMm, heightMm } — pass directly to generatePDF.
// generatePDF also accepts a plain HTML string for backward compatibility
// with existing queueService.js calls.
async function buildFullHTML(order, apiKey, opts) {
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var fmt        = (order.format || 'a3').toLowerCase();
  var fmtConfig  = FORMATS[fmt] || FORMATS.a3;
  var startMonth = order.startMonth - 1; // convert 1-12 to 0-11
  var year       = order.year || new Date().getFullYear();
  var keyDates   = order.keyDates || [];
  var holidays   = order.holidays || [];
  var city       = order.city || order.climate;

  console.log('[PDF] keyDates received:', JSON.stringify(keyDates));
  console.log('[PDF] holidays received:', JSON.stringify(holidays));
  console.log('[PDF] Geocoding city: ' + city);

  var geo = await geocodeCity(city);
  // Derive climate label from geocode result — overrides whatever the form sent
  var climate = order.climate;
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

  // ── Load product config ───────────────────────────────────────────────────
  var product = products.getProduct(order.productType);
  console.log('[PDF] Product: ' + product.id);

  // ── Build product shared state (artwork, inspos, QRs etc.) ───────────────
  var sharedState = await product.buildSharedState(
    order, geo, apiKey, compressToJpegDataUri, makeQrB64
  );

  // ── Persist shared state so approve run can skip buildSharedState ─────────
  if (order._id || order.id) {
    var _stateFile = require('path').join(_stateDirPath, (order._id || order.id) + '-state.json');
    try {
      require('fs').writeFileSync(_stateFile, JSON.stringify({
        sharedState: sharedState,
        geo:         geo,
        climate:     climate,
        climateData: climateData,
      }), 'utf8');
      console.log('[PDF] Shared state saved:', _stateFile);
    } catch(e) {
      console.warn('[PDF] Could not save shared state (non-fatal):', e.message);
    }
  }

  // ── Build pages ───────────────────────────────────────────────────────────
  var coverMonthNames = [];
  for (var ci = 0; ci < 12; ci++) coverMonthNames.push(MONTH_NAMES[(startMonth + ci) % 12]);
  var endYear   = year + Math.floor((startMonth + 11) / 12);
  var dateRange = MONTH_NAMES[startMonth] + ' ' + year + ' \u2013 ' + MONTH_NAMES[(startMonth + 11) % 12] + ' ' + endYear;

  var pages = [];

  // Cover page
  try {
    var coverExtras = product.buildCoverExtras(order, sharedState);
    pages.push(product.buildCoverPage(Object.assign({
      calendarName:  order.calendarName || order.recipientName || '',
      dateRange:     dateRange,
      climate:       climate,
      climateData:   climateData,
      startMonthIdx: startMonth,
      monthNames:    coverMonthNames,
      personalMsg:   order.personalMsg || order.personalMessage || '',
      etsyUrl:       order.etsyUrl || ETSY_SHOP_URL,
    }, coverExtras)));
    console.log('[PDF] Cover page built OK');
  } catch(coverErr) {
    console.error('[PDF] buildCoverPage CRASH:', coverErr.stack);
    throw coverErr;
  }

  // Month pages
  for (var j = 0; j < 12; j++) {
    var mIdx  = (startMonth + j) % 12;
    var mYear = year + Math.floor((startMonth + j) / 12);
    var mName = MONTH_NAMES[mIdx];

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

    // Merge generic month fields with product-specific content
    var productContent = product.buildMonthContent(j, order, sharedState);
    var monthOpts = Object.assign({
      monthName:    mName,
      monthIdx:     mIdx,
      year:         mYear,
      climate:      climate,
      climateData:  climateData,
      calendarName: order.calendarName || order.recipientName || '',
      keyDates:     monthKeyDates,
      holidays:     monthHolidays,
    }, productContent);

    pages.push(product.buildPageA(monthOpts));
    pages.push(tpl.buildPageB(monthOpts));
    console.log('[PDF] Month ' + (j+1) + ' (' + mName + ') built OK');
  }

  pages.push(tpl.buildBlankPage());
  console.log('[PDF] Pages built: ' + pages.length + ' (cover + 12×[A+B] + blank, ' + fmt.toUpperCase() + ')');

  try {
    var doc = tpl.buildDocument(pages, { proof: !(opts && opts.approved) });
    console.log('[PDF] buildDocument OK, length: ' + Math.round(doc.length / 1024) + 'KB');
    return { html: doc, widthMm: fmtConfig.widthMm, heightMm: fmtConfig.heightMm };
  } catch(docErr) {
    console.error('[PDF] buildDocument CRASH:', docErr.stack);
    throw docErr;
  }
}

// ── Shared state helpers ─────────────────────────────────────────────────────

// Load saved shared state for an order. Returns null if not found.
function loadSharedState(orderId) {
  if (!orderId) return null;
  var stateFile = require('path').join(_stateDirPath, orderId + '-state.json');
  try {
    if (!require('fs').existsSync(stateFile)) return null;
    var raw = require('fs').readFileSync(stateFile, 'utf8');
    return JSON.parse(raw);
  } catch(e) {
    console.warn('[PDF] Could not load shared state for', orderId, ':', e.message);
    return null;
  }
}

// Delete saved shared state after successful final PDF upload.
function deleteSharedState(orderId) {
  if (!orderId) return;
  var stateFile = require('path').join(_stateDirPath, orderId + '-state.json');
  try {
    if (require('fs').existsSync(stateFile)) {
      require('fs').unlinkSync(stateFile);
      console.log('[PDF] Shared state deleted:', orderId);
    }
  } catch(e) {
    console.warn('[PDF] Could not delete shared state for', orderId, ':', e.message);
  }
}

// ── Build full HTML from saved state (approve run — no API calls) ─────────────
// Skips geocode, climate fetch, buildSharedState entirely.
// Falls back to full buildFullHTML if state file not found (safety net).
async function buildFullHTMLFromState(orderId, order, opts) {
  var saved = loadSharedState(orderId);
  if (!saved) {
    console.warn('[PDF] No saved state for', orderId, '— falling back to full rebuild');
    return buildFullHTML(order, process.env.ANTHROPIC_API_KEY || '', opts);
  }

  console.log('[PDF] Using saved shared state for', orderId, '(skipping buildSharedState)');
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var fmt        = (order.format || 'a3').toLowerCase();
  var fmtConfig  = FORMATS[fmt] || FORMATS.a3;
  var startMonth = order.startMonth - 1;
  var year       = order.year || new Date().getFullYear();
  var keyDates   = order.keyDates || [];
  var holidays   = order.holidays || [];

  var geo         = saved.geo;
  var climate     = saved.climate;
  var climateData = saved.climateData;
  var sharedState = saved.sharedState;

  var product = products.getProduct(order.productType);

  var coverMonthNames = [];
  for (var ci = 0; ci < 12; ci++) coverMonthNames.push(MONTH_NAMES[(startMonth + ci) % 12]);
  var endYear   = year + Math.floor((startMonth + 11) / 12);
  var dateRange = MONTH_NAMES[startMonth] + ' ' + year + ' – ' + MONTH_NAMES[(startMonth + 11) % 12] + ' ' + endYear;

  var pages = [];

  // Cover page
  var coverExtras = product.buildCoverExtras(order, sharedState);
  pages.push(product.buildCoverPage(Object.assign({
    calendarName:  order.calendarName || order.recipientName || '',
    dateRange:     dateRange,
    climate:       climate,
    climateData:   climateData,
    startMonthIdx: startMonth,
    monthNames:    coverMonthNames,
    personalMsg:   order.personalMsg || order.personalMessage || '',
    etsyUrl:       order.etsyUrl || ETSY_SHOP_URL,
  }, coverExtras)));

  // Month pages
  for (var j = 0; j < 12; j++) {
    var mIdx  = (startMonth + j) % 12;
    var mYear = year + Math.floor((startMonth + j) / 12);
    var mName = MONTH_NAMES[mIdx];

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

    var productContent = product.buildMonthContent(j, order, sharedState);
    var monthOpts = Object.assign({
      monthName:    mName,
      monthIdx:     mIdx,
      year:         mYear,
      climate:      climate,
      climateData:  climateData,
      calendarName: order.calendarName || order.recipientName || '',
      keyDates:     monthKeyDates,
      holidays:     monthHolidays,
    }, productContent);

    pages.push(product.buildPageA(monthOpts));
    pages.push(tpl.buildPageB(monthOpts));
  }

  pages.push(tpl.buildBlankPage());
  console.log('[PDF] Pages rebuilt from state: ' + pages.length + ' (' + fmt.toUpperCase() + ')');

  var doc = tpl.buildDocument(pages, { proof: !(opts && opts.approved) });
  console.log('[PDF] buildDocument OK, length: ' + Math.round(doc.length / 1024) + 'KB');
  return { html: doc, widthMm: fmtConfig.widthMm, heightMm: fmtConfig.heightMm };
}

// ── Render PDF + R2 upload ────────────────────────────────────────────────────
async function generatePDF(html, widthMm, heightMm) {
  // Accept either a plain HTML string (legacy/queueService calls) or
  // the {html, widthMm, heightMm} object returned by buildFullHTML.
  if (html && typeof html === 'object' && html.html) {
    widthMm  = html.widthMm;
    heightMm = html.heightMm;
    html     = html.html;
  }
  widthMm  = widthMm  || 305;
  heightMm = heightMm || 428;

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
    var built = await buildFullHTML(req.body, apiKey);
    console.log('[PDF] HTML built (' + Math.round(built.html.length / 1024) + 'KB). Rendering...');
    var pdfBuf = await generatePDF(built);
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
router.buildFullHTML          = buildFullHTML;
router.buildFullHTMLFromState = buildFullHTMLFromState;
router.generatePDF            = generatePDF;
router.deleteSharedState      = deleteSharedState;
