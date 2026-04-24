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
    // Use Open-Meteo climate API — 30-year monthly normals
    var url = 'https://climate-api.open-meteo.com/v1/climate'
      + '?latitude=' + lat + '&longitude=' + lng
      + '&start_year=1991&end_year=2020'
      + '&monthly=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration'
      + '&models=EC_Earth3P_HR';
    https.get(url, { headers: { 'Accept': 'application/json' } }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          var m = d.monthly || {};
          resolve({
            _cd: {
              tMax:   m.temperature_2m_max   || [],
              tMin:   m.temperature_2m_min   || [],
              precip: m.precipitation_sum    || [],
              sunHrs: (m.sunshine_duration   || []).map(function(v) { return v != null ? (v / 3600).toFixed(1) : null; }),
            }
          });
        } catch(e) { resolve(null); }
      });
    }).on('error', function() { resolve(null); })
      .setTimeout(10000, function() { resolve(null); });
  });
}

// ── Call Claude Haiku for inspo garden only (one call per month) ──────────────
function fetchInspo(plant, monthName, climate, lat, lng, apiKey) {
  return new Promise(function(resolve) {
    if (!apiKey) { resolve(null); return; }
    var locationHint = lat && lng ? ' near ' + Math.round(lat) + '\u00b0N, ' + Math.round(lng) + '\u00b0E' : '';
    var prompt = 'Suggest one real, well-known, publicly accessible garden worth visiting in '
      + monthName + ' for someone in ' + climate + locationHint + ', who enjoys ' + (plant || 'ornamental gardens') + '.\n\n'
      + 'Return ONLY valid JSON, no markdown:\n'
      + '{"name":"Garden name","location":"City, Country","highlight":"One sentence on what makes it worth visiting specifically in ' + monthName + '."}\n\n'
      + 'Choose a well-known garden that genuinely has something special in ' + monthName + '. Be specific.';

    var body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
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
      res.on('data', function(c) { data += c; });
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


// ── Fetch Wikipedia thumbnail for inspo garden (same as web app) ─────────────
function fetchWikipediaPhoto(title) {
  return new Promise(function(resolve) {
    if (!title) { resolve(null); return; }
    var enc = encodeURIComponent(title.replace(/ /g,'_'));
    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + enc;
    https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          var thumb = d.thumbnail && d.thumbnail.source;
          if (!thumb) { resolve(null); return; }
          // Fetch the actual image as base64
          fetchImageAsBase64(thumb).then(resolve);
        } catch(e) { resolve(null); }
      });
    }).on('error', function() { resolve(null); })
      .setTimeout(8000, function() { resolve(null); });
  });
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateOrder(body) {
  var errors = [];
  if (body.startMonth == null || body.startMonth < 0 || body.startMonth > 11)
    errors.push('startMonth must be 0-11');
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
  var startMonth    = order.startMonth;
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

  // Fetch all 12 inspo gardens in parallel
  console.log('[PDF] Fetching 12 inspo garden recommendations...');
  var inspoPromises = [];
  for (var i = 0; i < 12; i++) {
    var mIdx = (startMonth + i) % 12;
    inspoPromises.push(fetchInspo(plants[i], MONTH_NAMES[mIdx], climate, geo && geo.lat, geo && geo.lng, apiKey));
  }
  var inspos = await Promise.all(inspoPromises);
  console.log('[PDF] Inspo gardens done. Fetching Wikipedia photos...');
  var inspoPhotoPromises = inspos.map(function(inspo) {
    if (!inspo || !inspo.name) return Promise.resolve(null);
    var wikiTitle = inspo.wikipedia || inspo.name;
    return fetchWikipediaPhoto(wikiTitle);
  });
  var inspoPhotos = await Promise.all(inspoPhotoPromises);
  console.log('[PDF] Inspo photos: ' + inspoPhotos.filter(Boolean).length + '/12 found.');

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
