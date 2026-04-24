// pdfService.js — Garden Calendar PDF generator (CommonJS)
// POST /generate-pdf

var express   = require('express');
var puppeteer = require('puppeteer-core');
var chromium  = require('@sparticuz/chromium');
var https     = require('https');
var http      = require('http');
var tpl       = require('./calendarTemplate.js');

var router = express.Router();

var GELATO = { widthMm: 426, heightMm: 303, bleedMm: 3 };

var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

// ── Fetch image as base64 data URI (server-side, no CORS) ─────────────────────
function fetchImageAsBase64(url, redirectCount) {
  redirectCount = redirectCount || 0;
  if (redirectCount > 3) return Promise.resolve(null);
  return new Promise(function(resolve) {
    var client = url.startsWith('https') ? https : http;
    var req = client.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        var loc = res.headers.location;
        if (!loc) { resolve(null); return; }
        // Handle relative redirects
        if (!loc.startsWith('http')) {
          var parsed = new URL(url);
          loc = parsed.protocol + '//' + parsed.host + loc;
        }
        fetchImageAsBase64(loc, redirectCount + 1).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { resolve(null); return; }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var buf = Buffer.concat(chunks);
        var ct  = res.headers['content-type'] || 'image/jpeg';
        // Strip charset etc from content-type
        ct = ct.split(';')[0].trim();
        resolve('data:' + ct + ';base64,' + buf.toString('base64'));
      });
      res.on('error', function() { resolve(null); });
    });
    req.on('error', function() { resolve(null); });
    req.setTimeout(12000, function() { req.destroy(); resolve(null); });
  });
}

// ── Call Claude Haiku for one month's commentary ───────────────────────────────
function fetchCommentary(plant, monthName, climate, apiKey) {
  return new Promise(function(resolve) {
    if (!apiKey || !plant) { resolve({}); return; }

    var prompt = 'You are writing content for a printed garden calendar. Be concise.\n\n'
      + 'Plant: ' + plant + '\n'
      + 'Month: ' + monthName + '\n'
      + 'Climate: ' + climate + '\n\n'
      + 'Return ONLY valid JSON, no markdown fences:\n'
      + '{"fact":"1-2 sentence botanical or historical fact about this plant.","enjoy":"What is visually interesting or enjoyable about this plant in ' + monthName + ' — what is flowering, fruiting, or noteworthy right now. 2 sentences.","care":"The 2 most important care tasks for this plant in ' + monthName + ' in this climate. 2 sentences.","inspo":{"name":"Name of a real well-known garden","location":"City, Country","highlight":"Why visit in ' + monthName + '. 1 sentence."}}';

    var body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
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
          var text = parsed.content && parsed.content[0] && parsed.content[0].text || '';
          text = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
          resolve(JSON.parse(text));
        } catch(e) {
          console.warn('[PDF] Commentary parse error for ' + plant + ':', e.message);
          resolve({});
        }
      });
    });
    req.on('error', function(e) {
      console.warn('[PDF] Commentary error for ' + plant + ':', e.message);
      resolve({});
    });
    req.setTimeout(20000, function() { req.destroy(); resolve({}); });
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

// ── Build full 24-page HTML ────────────────────────────────────────────────────
async function buildFullHTML(order, apiKey) {
  var startMonth    = order.startMonth;
  var year          = order.year || new Date().getFullYear();
  var plants        = order.plants;
  var keyDates      = order.keyDates || [];
  var holidays      = order.holidays || [];
  var climate       = order.climate;
  var recipientName = order.recipientName || '';

  // Fetch all 12 commentaries in parallel (Haiku is fast and cheap)
  console.log('[PDF] Fetching 12 commentaries in parallel...');
  var commentaryPromises = [];
  for (var i = 0; i < 12; i++) {
    var monthIdx = (startMonth + i) % 12;
    var plant    = plants[i] || '';
    commentaryPromises.push(fetchCommentary(plant, MONTH_NAMES[monthIdx], climate, apiKey));
  }
  var commentaries = await Promise.all(commentaryPromises);
  console.log('[PDF] Commentaries done. Fetching 12 artwork images...');

  // Fetch all 12 artwork images in parallel
  var artworkPromises = [];
  for (var j = 0; j < 12; j++) {
    var artUrl = tpl.getArtworkUrl(plants[j] || '');
    artworkPromises.push(artUrl ? fetchImageAsBase64(artUrl) : Promise.resolve(null));
  }
  var artworks = await Promise.all(artworkPromises);
  console.log('[PDF] Images done. Building HTML...');

  var pages = [];
  for (var k = 0; k < 12; k++) {
    var mIdx  = (startMonth + k) % 12;
    var mYear = year + Math.floor((startMonth + k) / 12);
    var mName = MONTH_NAMES[mIdx];
    var plt   = plants[k] || '';

    var monthKeyDates = (keyDates).filter(function(d) {
      var date = new Date(d.date);
      return date.getFullYear() === mYear && date.getMonth() === mIdx;
    });
    var monthHolidays = (holidays).filter(function(h) {
      var s = new Date(h.startDate), e = new Date(h.endDate);
      var ms = new Date(mYear, mIdx, 1), me = new Date(mYear, mIdx + 1, 0);
      return s <= me && e >= ms;
    });

    pages.push(tpl.buildPageA({
      monthName: mName, monthIdx: mIdx, year: mYear, plant: plt,
      artworkB64: artworks[k] || '',
      commentary: commentaries[k] || {},
      recipientName: recipientName, climate: climate,
    }));

    pages.push(tpl.buildPageB({
      monthName: mName, monthIdx: mIdx, year: mYear, plant: plt,
      keyDates: monthKeyDates, holidays: monthHolidays,
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
    // All images are base64 embedded — use domcontentloaded, not networkidle
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await new Promise(function(r) { setTimeout(r, 2000); }); // let fonts render
    var pdf = await page.pdf({
      width: GELATO.widthMm + 'mm',
      height: GELATO.heightMm + 'mm',
      printBackground: true,
      margin: { top:0, right:0, bottom:0, left:0 },
      timeout: 120000,
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

  // Set a long response timeout — PDF generation takes 60-120s
  req.socket.setTimeout(180000);
  res.setTimeout(180000);

  var apiKey = process.env.ANTHROPIC_API_KEY || '';
  console.log('[PDF] Order received: ' + req.body.climate + ', month ' + req.body.startMonth);
  var t0 = Date.now();

  try {
    var html = await buildFullHTML(req.body, apiKey);
    console.log('[PDF] HTML built (' + Math.round(html.length/1024) + 'KB), rendering PDF...');
    var pdf = await generatePDF(html);
    console.log('[PDF] Complete in ' + ((Date.now()-t0)/1000).toFixed(1) + 's, ' + Math.round(pdf.length/1024) + 'KB');
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
