// pdfService.js (CommonJS)
// POST /generate-pdf — 24-page PDF, 2 pages per month
// Page A: artwork + plantCommentary.json notes + Claude inspo garden + climate data
// Page B: full calendar grid with key dates and holidays

var express   = require('express');
var puppeteer = require('puppeteer-core');
var chromium  = require('@sparticuz/chromium');
var https     = require('https');
var http      = require('http');
var tpl       = require('./calendarTemplate.js');
var fs        = require('fs');
var path      = require('path');

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

var GELATO = { widthMm: 426, heightMm: 303 };

var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

// ── Read artwork from disk (downloaded at build time by download-artwork.js) ───
var path = require('path');

function readArtworkAsBase64(plant) {
  if (!plant) return null;
  var key = plant.toLowerCase().trim();
  // Try jpg first, then png
  var exts = ['.jpg', '.png'];
  for (var i = 0; i < exts.length; i++) {
    var fp = path.join(__dirname, 'artwork', key + exts[i]);
    try {
      var buf = require('fs').readFileSync(fp);
      var ct  = exts[i] === '.png' ? 'image/png' : 'image/jpeg';
      return 'data:' + ct + ';base64,' + buf.toString('base64');
    } catch(e) { /* try next */ }
  }
  console.warn('[ART] Not found on disk:', key);
  return null;
}

// ── Geocode a city string to lat/lng via Photon (same as web app) ─────────────
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

// ── Fetch climate data from Open-Meteo (same approach as web app) ─────────────
function fetchClimateData(lat, lng) {
  return new Promise(function(resolve) {
    if (lat == null || lng == null) { resolve(null); return; }
    // Open-Meteo climate API returns DAILY data — we fetch one representative year
    // and average each variable by calendar month ourselves
    var url = 'https://climate-api.open-meteo.com/v1/climate'
      + '?latitude=' + lat + '&longitude=' + lng
      + '&start_date=2000-01-01&end_date=2000-12-31'
      + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,daylight_duration'
      + '&models=EC_Earth3P_HR';
    https.get(url, { headers: { 'Accept': 'application/json' } }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          if (d.error) { resolve(null); return; }
          var daily = d.daily || {};
          var times      = daily.time                || [];
          var tMaxArr    = daily.temperature_2m_max  || [];
          var tMinArr    = daily.temperature_2m_min  || [];
          var precipArr  = daily.precipitation_sum   || [];
          var sunArr     = daily.sunshine_duration   || [];
          var dayArr     = daily.daylight_duration    || [];

          // Accumulate sums and counts per calendar month (0-indexed)
          var sums = { tMax:[],tMin:[],precip:[],sun:[] };
          var counts = [];
          for (var m = 0; m < 12; m++) {
            sums.tMax.push(0); sums.tMin.push(0);
            sums.precip.push(0); sums.sun.push(0);
            counts.push(0);
          }
          for (var i = 0; i < times.length; i++) {
            var mo = parseInt((times[i] || '').split('-')[1], 10) - 1;
            if (mo < 0 || mo > 11) continue;
            if (tMaxArr[i]   != null) { sums.tMax[mo]   += tMaxArr[i];   }
            if (tMinArr[i]   != null) { sums.tMin[mo]   += tMinArr[i];   }
            if (precipArr[i] != null) { sums.precip[mo] += precipArr[i]; }
            var sunVal = (sunArr[i] != null && sunArr[i] > 0) ? sunArr[i] : (dayArr[i] || 0);
            sums.sun[mo] += sunVal;
            counts[mo]++;
          }
          var tMax=[],tMin=[],precip=[],sunHrs=[];
          for (var m = 0; m < 12; m++) {
            var n = counts[m] || 1;
            tMax.push(parseFloat((sums.tMax[m] / n).toFixed(1)));
            tMin.push(parseFloat((sums.tMin[m] / n).toFixed(1)));
            precip.push(parseFloat((sums.precip[m]).toFixed(0)));   // monthly total
            sunHrs.push(parseFloat((sums.sun[m] / n / 3600).toFixed(1))); // avg hrs/day
          }
          resolve({ _cd: { tMax, tMin, precip, sunHrs } });
        } catch(e) { console.error('[PDF] climate parse error', e.message); resolve(null); }
      });
    }).on('error', function(e) { console.error('[PDF] climate fetch error', e.message); resolve(null); })
      .setTimeout(10000, function() { resolve(null); });
  });
}

// ── Call Claude Haiku for inspo garden only (one call per month) ──────────────
// Normalise a garden name for dedup comparison
// "RHS Wisley", "Wisley Garden", "RHS Garden Wisley" → "wisley"
function normaliseGardenName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\b(rhs|nts|english heritage|the|garden|gardens|park|house|castle|abbey|hall|manor)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Single inspo fetch — returns Promise<{name,location,highlight,wikipedia?}|null>
function fetchInspoOne(plant, monthName, climate, lat, lng, apiKey, usedNames) {
  return new Promise(function(resolve) {
    if (!apiKey) { resolve(null); return; }
    var locationHint = lat && lng
      ? ' (approx. ' + Math.round(lat) + '°N ' + Math.round(Math.abs(lng)) + '°' + (lng < 0 ? 'W' : 'E') + ')'
      : '';
    // Only pass last 4 used names to keep prompt short
    var recentUsed = usedNames.slice(-4);
    var excludeClause = recentUsed.length
      ? '\n\nDo NOT suggest any of these: ' + recentUsed.join(', ') + '.'
      : '';
    var prompt =
      'Suggest one real, publicly accessible garden worth visiting in ' + monthName
      + ' for someone based in ' + climate + locationHint + '.'
      + ' The garden should be reachable as a day trip by car or public transport (roughly within 2 hours).'
      + ' The commentary does not need to be linked to the plant on the page.'
      + ' Only suggest gardens you are certain exist and are open to the public.'
      + excludeClause
      + '\n\nReturn ONLY valid JSON, no markdown, no explanation:'
      + '\n{"name":"Full garden name","location":"Town, County/Region","highlight":"One specific sentence about what makes it worth visiting in ' + monthName + '.","wikipedia":"Wikipedia article title if one exists, else null"}';

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
        try {
          var p = JSON.parse(data);
          var text = (p.content && p.content[0] && p.content[0].text || '').trim();
          text = text.replace(/^```[a-z]*\n?/i,'').replace(/\n?```$/,'').trim();
          resolve(JSON.parse(text));
        } catch(e) { resolve(null); }
      });
    });
    req.on('error', function() { resolve(null); });
    req.setTimeout(15000, function() { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// Fetch 12 inspo gardens sequentially so we can pass used-names for dedup
async function fetchAllInspos(plants, monthNames, monthIndices, climate, lat, lng, apiKey) {
  var inspos = [];
  var usedNormalised = []; // normalised names already used this calendar
  var usedDisplay = [];    // display names for the exclude clause

  for (var i = 0; i < 12; i++) {
    var result = await fetchInspoOne(
      plants[i], monthNames[i], climate, lat, lng, apiKey, usedDisplay
    );
    // Dedup check
    if (result && result.name) {
      var norm = normaliseGardenName(result.name);
      if (usedNormalised.indexOf(norm) !== -1) {
        // Try once more with stronger exclude signal
        usedDisplay.push(result.name);
        result = await fetchInspoOne(
          plants[i], monthNames[i], climate, lat, lng, apiKey, usedDisplay
        );
      }
      if (result && result.name) {
        norm = normaliseGardenName(result.name);
        usedNormalised.push(norm);
        usedDisplay.push(result.name);
      }
    }
    inspos.push(result);
    console.log('[PDF] Inspo ' + (i+1) + '/12: ' + (result && result.name || 'null'));
  }
  return inspos;
}


// ── Fetch Wikipedia thumbnail for inspo garden (same as web app) ─────────────
function fetchImageAsBase64(imageUrl) {
  return new Promise(function(resolve) {
    var parsed = require('url').parse(imageUrl);
    var lib = parsed.protocol === 'https:' ? https : http;
    var req = lib.get(imageUrl, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchImageAsBase64(res.headers.location).then(resolve);
      }
      var chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() {
        var buf = Buffer.concat(chunks);
        if (buf.length < 500) { resolve(null); return; }
        var ct = res.headers['content-type'] || 'image/jpeg';
        resolve('data:' + ct + ';base64,' + buf.toString('base64'));
      });
    });
    req.on('error', function() { resolve(null); });
    req.setTimeout(10000, function() { req.destroy(); resolve(null); });
  });
}

function fetchWikipediaPhoto(title) {
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
          fetchImageAsBase64(thumb).then(resolve);
        } catch(e) { resolve(null); }
      });
    });
    req.on('error', function() { resolve(null); });
    req.setTimeout(8000, function() { req.destroy(); resolve(null); });
  });
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateOrder(body) {
  var errors = [];
  if (body.startMonth == null || body.startMonth < 1 || body.startMonth > 12)
    errors.push('startMonth must be 1-12 (January=1)');
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

// ── Build full 24-page HTML ────────────────────────────────────────────────────
async function buildFullHTML(order, apiKey) {
  var startMonth    = order.startMonth - 1; // convert 1-12 to 0-11
  var year          = order.year || new Date().getFullYear();
  var plants        = order.plants;
  var keyDates      = order.keyDates || [];
  var holidays      = order.holidays || [];
  var climate       = order.climate;
  var city          = order.city || climate;
  var recipientName = order.recipientName || '';

  // Geocode and fetch climate data once upfront
  console.log('[PDF] Geocoding city: ' + city);
  var geo = await geocodeCity(city);
  var climateData = null;
  if (geo) {
    console.log('[PDF] Fetching climate data for', geo.lat, geo.lng);
    climateData = await fetchClimateData(geo.lat, geo.lng);
    console.log('[PDF] Climate data:', climateData ? 'OK' : 'not available');
  }

  // Read artwork from disk (downloaded at build time)
  console.log('[PDF] Reading artwork from disk...');
  var artworks = plants.map(function(p) { return readArtworkAsBase64(p); }); // reads from artwork/ dir committed to repo
  console.log('[PDF] Artwork loaded: ' + artworks.filter(Boolean).length + '/12');

  // Fetch 12 inspo gardens sequentially so dedup works across months
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
  console.log('[PDF] Inspo gardens done. Fetching Wikipedia photos...');
  var inspoPhotoPromises = inspos.map(function(inspo) {
    if (!inspo || !inspo.name) return Promise.resolve(null);
    var wikiTitle = inspo.wikipedia || inspo.name;
    return fetchWikipediaPhoto(wikiTitle);
  });
  var inspoPhotos = await Promise.all(inspoPhotoPromises);
  console.log('[PDF] Inspo photos: ' + inspoPhotos.filter(Boolean).length + '/12 found.');

  // Pre-fetch QR codes as base64 (Puppeteer may not load external URLs)
  var appUrl    = 'https://garden-calendar-frontend.vercel.app';
  var appQrSrc  = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(appUrl) + '&margin=2';
  var appQrB64  = await fetchImageAsBase64(appQrSrc) || '';
  console.log('[PDF] App QR: ' + (appQrB64 ? 'ok' : 'failed'));

  var inspoQrB64s = [];
  for (var qi = 0; qi < 12; qi++) {
    var ins = inspos[qi];
    if (ins && ins.name) {
      var searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(ins.name + ' ' + (ins.location || '') + ' official website');
      var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(searchUrl) + '&margin=2';
      inspoQrB64s.push(await fetchImageAsBase64(qrSrc) || '');
    } else {
      inspoQrB64s.push('');
    }
  }
  console.log('[PDF] Inspo QRs: ' + inspoQrB64s.filter(Boolean).length + '/12 ok');

  // Build all 24 pages
  var pages = [];
  for (var j = 0; j < 12; j++) {
    var mIdx  = (startMonth + j) % 12;
    var mYear = year + Math.floor((startMonth + j) / 12);
    var mName = MONTH_NAMES[mIdx];
    var plt   = plants[j] || '';

    var monthKeyDates = keyDates.filter(function(d) {
      var dt = new Date(d.date);
      return dt.getFullYear() === mYear && dt.getMonth() === mIdx;
    });
    var monthHolidays = holidays.filter(function(h) {
      var s = new Date(h.startDate), e = new Date(h.endDate);
      return s <= new Date(mYear, mIdx + 1, 0) && e >= new Date(mYear, mIdx, 1);
    });

    pages.push(tpl.buildPageA({
      monthName: mName, monthIdx: mIdx, year: mYear,
      plant: plt, artworkB64: artworks[j] || '',
      inspo: inspos[j] || null,
      inspoPhotoB64: inspoPhotos[j] || '',
      inspoQrB64: inspoQrB64s[j] || '',
      appQrB64: appQrB64,
      climate: climate, climateData: climateData,
      recipientName: recipientName,
    }));

    pages.push(tpl.buildPageB({
      monthName: mName, monthIdx: mIdx, year: mYear,
      plant: plt, keyDates: monthKeyDates, holidays: monthHolidays,
      climate: climate, recipientName: recipientName,
    }));
  }

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>\n'
    + '* { box-sizing:border-box; margin:0; padding:0; }\n'
    + '@page { size:' + GELATO.widthMm + 'mm ' + GELATO.heightMm + 'mm; margin:0; }\n'
    + 'html,body { width:' + GELATO.widthMm + 'mm; height:' + GELATO.heightMm + 'mm; margin:0; padding:0; }\n'
    + tpl.SHARED_CSS + '\n'
    + '</style></head><body>\n'
    + pages.join('\n') + '\n</body></html>';
}

// ── Render PDF ────────────────────────────────────────────────────────────────
async function generatePDF(html) {
  var browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  try {
    var page = await browser.newPage();
    await page.setViewport({
      width:  Math.round(GELATO.widthMm * 150 / 25.4),
      height: Math.round(GELATO.heightMm * 150 / 25.4),
      deviceScaleFactor: 2,
    });
    // Images are base64 embedded — domcontentloaded is sufficient
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await new Promise(function(r) { setTimeout(r, 2000); }); // font render time
    return await page.pdf({
      width: GELATO.widthMm + 'mm', height: GELATO.heightMm + 'mm',
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
    var pdf = await generatePDF(html);
    console.log('[PDF] Done in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — ' + Math.round(pdf.length / 1024) + 'KB');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="garden-calendar.pdf"',
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  } catch(err) {
    console.error('[PDF] Error:', err.message);
    res.status(500).json({ error: 'PDF generation failed', message: err.message });
  }
});

module.exports = router;
