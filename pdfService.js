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
    // Detect format from magic bytes to avoid sharp format-sniffing failures
    // PNG: starts with 0x89 0x50 0x4E 0x47
    // JPEG: starts with 0xFF 0xD8
    var isPng = buf.length > 4
      && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    var sharpInput = isPng
      ? sharp(buf, { failOn: 'none' }).png()   // explicitly tell sharp it's PNG first
      : sharp(buf, { failOn: 'none' });
    var pipeline = sharpInput.rotate();        // auto-correct EXIF orientation
    if (widthPx) pipeline = pipeline.resize(widthPx, null, { withoutEnlargement: true });
    var compressed = await pipeline.jpeg({ quality: quality, mozjpeg: true }).toBuffer();
    console.log('[IMG] Compressed ' + (isPng ? 'PNG' : 'JPEG') + ': '
      + Math.round(buf.length/1024) + 'KB → ' + Math.round(compressed.length/1024) + 'KB');
    return 'data:image/jpeg;base64,' + compressed.toString('base64');
  } catch(e) {
    console.warn('[IMG] sharp compress failed:', e.message, '— using original');
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
  a3: { widthMm: 279.42, heightMm: 401.14, label: 'A3 Portrait Standard Wall Calendar' },
  a4: { widthMm: 305, heightMm: 218, label: 'A4 Landscape Wire-O Calendar' },
};


// ── Read artwork from disk ────────────────────────────────────────────────────
// Returns { buf: Buffer, source: string } or null.
// Compression (to two sizes) is applied later in buildFullHTML so we only
// read the file once but compress twice (full-res for page A, thumbnail for cover).

var ARTWORK_SOURCES = {
  'koehler': 'Köhler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Public Domain \u00b7 Missouri Botanical Garden',
  'edwards': 'Edwards\u2019 Botanical Register, 1815\u20131847 \u00b7 Public Domain',
};
var ARTWORK_SOURCE_DEFAULT = 'Köhler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Public Domain \u00b7 Missouri Botanical Garden';

// Filename conventions supported:
//   Koehler_plantname.jpg   — Köhler's Medizinal-Pflanzen
//   Edwards_plantname.jpg   — Edwards' Botanical Register
//   plantname.jpg           — legacy (assumed Köhler)
function readArtworkBuffer(plant) {
  if (!plant) return null;
  var key  = plant.toLowerCase().trim();
  var exts = ['.jpg', '.png'];
  var prefixes = ['koehler', 'edwards'];

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
function fetchClimateData(lat, lng) {
  return new Promise(function(resolve) {
    var url = 'https://climate-api.open-meteo.com/v1/climate'
      + '?latitude=' + lat + '&longitude=' + lng
      + '&start_date=1991-01-01&end_date=2020-12-31'
      + '&models=EC_Earth3P_HR'
      + '&monthly=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration';
    https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          if (!d.monthly) { resolve(null); return; }
          var m = d.monthly;
          // Convert sunshine_duration (seconds/month) to hours/day
          var sunHrs = null;
          if (m.sunshine_duration) {
            sunHrs = m.sunshine_duration.map(function(s, i) {
              var daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31][i % 12];
              return s / 3600 / daysInMonth;
            });
          }
          resolve({
            _cd: {
              tMax:   m.temperature_2m_max   || null,
              tMin:   m.temperature_2m_min   || null,
              precip: m.precipitation_sum    || null,
              sunHrs: sunHrs,
            }
          });
        } catch(e) { resolve(null); }
      });
    }).on('error', function() { resolve(null); })
      .setTimeout(15000, function() { resolve(null); });
  });
}

// ── Fetch inspo garden from Claude API ───────────────────────────────────────
function fetchInspoOne(plant, monthName, climate, lat, lng, apiKey, excludeNames) {
  return new Promise(function(resolve) {
    if (!apiKey) { resolve(null); return; }
    var excludeClause = excludeNames && excludeNames.length
      ? ' Do NOT suggest any of these gardens (already used): ' + excludeNames.join(', ') + '.'
      : '';
    var locationClause = lat && lng
      ? ' The user is located at approximately ' + lat.toFixed(2) + ', ' + lng.toFixed(2) + ' — prioritise gardens within reasonable travel distance, but include world-class gardens further away if they are particularly relevant.'
      : '';
    var prompt = 'Suggest one inspiring garden to visit this month for someone growing '
      + (plant || 'a mixed garden') + ' in a ' + climate + ' climate, in ' + monthName + '.'
      + locationClause + excludeClause
      + ' Reply with a JSON object only (no markdown): '
      + '{"name":"...","location":"...","highlight":"one sentence about what makes it special to visit in ' + monthName + '","wikipedia":"Wikipedia article title or null"}';

    var body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });

    var req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      }
    }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        console.log('[PDF] inspo API status:', res.statusCode);
        try {
          var d = JSON.parse(data);
          var text = d.content && d.content[0] && d.content[0].text || '';
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

// Normalise garden name for dedup comparison
function normaliseGardenName(name) {
  return (name || '').toLowerCase()
    .replace(/\bthe\b/g, '').replace(/[^a-z0-9]/g, '').trim();
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
  }

  // ── Artwork: read once as Buffer, compress to two sizes ───────────────────
  // Full-res (page A illustration): max 1800px wide, JPEG q82  → ~100–130KB each
  // Thumbnail (cover grid):         max  500px wide, JPEG q75  → ~15–25KB each
  console.log('[PDF] Reading & compressing artwork...');
  var artworkRaw = plants.map(function(p) { return readArtworkBuffer(p); }); // {buf, source} | null
  console.log('[PDF] Artwork loaded: ' + artworkRaw.filter(Boolean).length + '/12');
  artworkRaw.forEach(function(a, i) {
    if (a) console.log('[ART] ' + plants[i] + ' \u2192 ' + (a.source.includes('Edwards') ? 'Edwards' : 'K\u00f6hler'));
  });

  var artworks = await Promise.all(artworkRaw.map(async function(a) {
    if (!a) return null;
    var fullB64  = await compressToJpegDataUri(a.buf, 1800, 82);
    var thumbB64 = await compressToJpegDataUri(a.buf,  500, 75);
    return { b64: fullB64, thumbB64: thumbB64, source: a.source };
  }));

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
      plants:        plants,
      monthNames:    coverMonthNames,
      appQrB64:      appQrB64,
      personalMsg:   order.personalMsg  || '',
      etsyUrl:       order.etsyUrl      || '',
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
  var widthMm = 279.42, heightMm = 401.14;

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
    '--js-flags=--max-old-space-size=256', // cap V8 heap at 256MB
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
    await page.setViewport({
      width:  Math.round(widthMm * 150 / 25.4),
      height: Math.round(heightMm * 150 / 25.4),
      deviceScaleFactor: 1.5,
    });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await new Promise(function(r) { setTimeout(r, 2000); });
    return await page.pdf({
      width: widthMm + 'mm', height: heightMm + 'mm',
      printBackground: true, margin: { top:0, right:0, bottom:0, left:0 },
      timeout: 120000,
    });
  } finally {
    await browser.close();
  }
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
