// pdfService.js — Garden Calendar PDF generator (CommonJS)
// POST /generate-pdf — accepts order JSON, returns 24-page PDF (2 pages per month)

var express    = require('express');
var puppeteer  = require('puppeteer-core');
var chromium   = require('@sparticuz/chromium');
var https      = require('https');
var http       = require('http');
var tpl        = require('./calendarTemplate.js');

var router = express.Router();

var GELATO = { widthMm: 426, heightMm: 303, bleedMm: 3 };

var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

// ── Fetch image as base64 data URI ────────────────────────────────────────────
function fetchImageAsBase64(url) {
  return new Promise(function(resolve) {
    var client = url.startsWith('https') ? https : http;
    var req = client.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      // Follow one redirect
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchImageAsBase64(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) { resolve(null); return; }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var buf = Buffer.concat(chunks);
        var ct  = res.headers['content-type'] || 'image/jpeg';
        resolve('data:' + ct + ';base64,' + buf.toString('base64'));
      });
    });
    req.on('error', function() { resolve(null); });
    req.setTimeout(10000, function() { req.abort(); resolve(null); });
  });
}

// ── Call Claude for plant commentary + inspo garden ───────────────────────────
function fetchCommentary(plant, monthName, climate, apiKey) {
  return new Promise(function(resolve) {
    if (!apiKey) { resolve({}); return; }

    var prompt = 'You are a horticultural writer producing content for a printed garden calendar.\n\n'
      + 'Plant: ' + plant + '\n'
      + 'Month: ' + monthName + '\n'
      + 'Climate: ' + climate + '\n\n'
      + 'Write calendar content for this plant in this month and climate region.\n'
      + 'Return ONLY valid JSON with these fields:\n'
      + '{\n'
      + '  "fact": "One fascinating historical or botanical fact about this plant (2-3 sentences)",\n'
      + '  "enjoy": "What to enjoy about this plant in this specific month — sensory details, what is flowering/fruiting/interesting right now (2-3 sentences)",\n'
      + '  "care": "The 2-3 most important care tasks for this plant this month in this climate (2-3 sentences)",\n'
      + '  "inspo": {\n'
      + '    "name": "Name of a real, well-known garden worth visiting this month",\n'
      + '    "location": "City, Country",\n'
      + '    "highlight": "What makes it worth visiting specifically in ' + monthName + ' (1-2 sentences)"\n'
      + '  }\n'
      + '}\n'
      + 'Keep each field concise. The inspo garden should be realistic and well-known.';

    var body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    var opts = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
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
          var parsed = JSON.parse(data);
          var text = parsed.content && parsed.content[0] && parsed.content[0].text;
          if (!text) { resolve({}); return; }
          // Strip markdown code fences if present
          text = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/,'').trim();
          var commentary = JSON.parse(text);
          resolve(commentary);
        } catch(e) {
          console.warn('[PDF] Commentary parse error:', e.message);
          resolve({});
        }
      });
    });
    req.on('error', function(e) {
      console.warn('[PDF] Commentary fetch error:', e.message);
      resolve({});
    });
    req.setTimeout(15000, function() { req.abort(); resolve({}); });
    req.write(body);
    req.end();
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

// ── Build full HTML document ──────────────────────────────────────────────────
async function buildFullHTML(order, apiKey) {
  var startMonth    = order.startMonth;
  var year          = order.year || new Date().getFullYear();
  var plants        = order.plants;
  var keyDates      = order.keyDates || [];
  var holidays      = order.holidays || [];
  var climate       = order.climate;
  var recipientName = order.recipientName || '';

  var pages = [];

  for (var i = 0; i < 12; i++) {
    var monthIdx  = (startMonth + i) % 12;
    var monthYear = year + Math.floor((startMonth + i) / 12);
    var monthName = MONTH_NAMES[monthIdx];
    var plant     = plants[i] || '';

    console.log('[PDF] Month ' + (i+1) + '/12: ' + monthName + ' — ' + plant);

    // Fetch artwork and commentary in parallel
    var artworkUrl = tpl.getArtworkUrl(plant);
    var artworkB64Promise = artworkUrl ? fetchImageAsBase64(artworkUrl) : Promise.resolve(null);
    var commentaryPromise = fetchCommentary(plant, monthName, climate, apiKey);

    var results = await Promise.all([artworkB64Promise, commentaryPromise]);
    var artworkB64 = results[0] || '';
    var commentary = results[1] || {};

    // Filter key dates and holidays for this month
    var monthKeyDates = (keyDates || []).filter(function(d) {
      var date = new Date(d.date);
      return date.getFullYear() === monthYear && date.getMonth() === monthIdx;
    });
    var monthHolidays = (holidays || []).filter(function(h) {
      var s = new Date(h.startDate), e = new Date(h.endDate);
      var ms = new Date(monthYear, monthIdx, 1), me = new Date(monthYear, monthIdx + 1, 0);
      return s <= me && e >= ms;
    });

    // Page A: artwork + commentary
    pages.push(tpl.buildPageA({
      monthName: monthName, monthIdx: monthIdx, year: monthYear,
      plant: plant, artworkB64: artworkB64, commentary: commentary,
      recipientName: recipientName, climate: climate,
    }));

    // Page B: full calendar grid
    pages.push(tpl.buildPageB({
      monthName: monthName, monthIdx: monthIdx, year: monthYear,
      plant: plant, keyDates: monthKeyDates, holidays: monthHolidays,
      climate: climate, recipientName: recipientName,
    }));
  }

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>\n'
    + '* { box-sizing:border-box; margin:0; padding:0; }\n'
    + '@page { size:' + GELATO.widthMm + 'mm ' + GELATO.heightMm + 'mm; margin:0; }\n'
    + 'html,body { width:' + GELATO.widthMm + 'mm; height:' + GELATO.heightMm + 'mm; margin:0; padding:0; }\n'
    + tpl.SHARED_CSS + '\n'
    + '</style></head><body>\n'
    + pages.join('\n')
    + '\n</body></html>';
}

// ── PDF generation ────────────────────────────────────────────────────────────
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
    // Images are already base64 embedded — no network needed, so use domcontentloaded
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(function(r) { setTimeout(r, 1500); }); // let fonts render
    var pdf = await page.pdf({
      width: GELATO.widthMm + 'mm',
      height: GELATO.heightMm + 'mm',
      printBackground: true,
      margin: { top:0, right:0, bottom:0, left:0 },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post('/generate-pdf', async function(req, res) {
  var errors = validateOrder(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY || '';
  console.log('[PDF] Starting generation for ' + req.body.climate + ', start month ' + req.body.startMonth);
  var t0 = Date.now();

  try {
    var html = await buildFullHTML(req.body, apiKey);
    var pdf  = await generatePDF(html);
    console.log('[PDF] Done in ' + ((Date.now()-t0)/1000).toFixed(1) + 's, ' + Math.round(pdf.length/1024) + 'KB');
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
