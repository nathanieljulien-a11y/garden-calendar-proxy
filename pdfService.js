/**
 * pdfService.js — Garden Calendar PDF Generator (CommonJS)
 * POST /generate-pdf — accepts order JSON, returns print-ready PDF
 *
 * Gelato A3 landscape specs:
 *   420mm × 297mm + 3mm bleed each side = 426mm × 303mm
 */

var express    = require('express');
var puppeteer  = require('puppeteer-core');
var chromium   = require('@sparticuz/chromium');
var template   = require('./calendarTemplate.js');

var buildCalendarPageHTML = template.buildCalendarPageHTML;
var SHARED_CSS            = template.SHARED_CSS;

var router = express.Router();

var MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── Validation ────────────────────────────────────────────────────────────────
function validateOrder(body) {
  var errors = [];
  if (body.startMonth === undefined || body.startMonth < 0 || body.startMonth > 11)
    errors.push('startMonth must be 0-11');
  if (!body.climate || typeof body.climate !== 'string')
    errors.push('climate region required');
  if (!Array.isArray(body.plants) || body.plants.length !== 12)
    errors.push('plants must be an array of exactly 12 plant names');
  if (body.keyDates && !Array.isArray(body.keyDates))
    errors.push('keyDates must be an array');
  if (body.keyDates && body.keyDates.length > 20)
    errors.push('maximum 20 key dates');
  if (body.holidays && !Array.isArray(body.holidays))
    errors.push('holidays must be an array');
  if (body.holidays && body.holidays.length > 6)
    errors.push('maximum 6 holiday periods');
  return errors;
}

// ── Build full 12-page HTML document ─────────────────────────────────────────
function buildFullHTML(order) {
  var startMonth    = order.startMonth;
  var year          = order.year || new Date().getFullYear();
  var plants        = order.plants;
  var keyDates      = order.keyDates  || [];
  var holidays      = order.holidays  || [];
  var climate       = order.climate;
  var recipientName = order.recipientName || '';

  var pages = [];

  for (var i = 0; i < 12; i++) {
    var monthIdx  = (startMonth + i) % 12;
    var monthYear = year + Math.floor((startMonth + i) / 12);
    var monthName = MONTH_NAMES[monthIdx];
    var plant     = plants[i];

    var monthKeyDates = keyDates.filter(function(d) {
      var date = new Date(d.date);
      return date.getFullYear() === monthYear && date.getMonth() === monthIdx;
    });

    var monthHolidays = holidays.filter(function(h) {
      var start  = new Date(h.startDate);
      var end    = new Date(h.endDate);
      var mStart = new Date(monthYear, monthIdx, 1);
      var mEnd   = new Date(monthYear, monthIdx + 1, 0);
      return start <= mEnd && end >= mStart;
    });

    pages.push(buildCalendarPageHTML({
      monthName:     monthName,
      monthIdx:      monthIdx,
      year:          monthYear,
      plant:         plant,
      climate:       climate,
      recipientName: recipientName,
      keyDates:      monthKeyDates,
      holidays:      monthHolidays,
      bleedMm:       3,
    }));
  }

  return '<!DOCTYPE html>\n'
    + '<html lang="en">\n'
    + '<head>\n'
    + '<meta charset="UTF-8"/>\n'
    + '<style>\n'
    + '@page { size: 426mm 303mm; margin: 0; }\n'
    + 'html, body { width: 426mm; height: 303mm; margin: 0; padding: 0; }\n'
    + '.calendar-page { width: 426mm; height: 303mm; position: relative; overflow: hidden; page-break-after: always; page-break-inside: avoid; }\n'
    + '.calendar-page:last-child { page-break-after: auto; }\n'
    + '.bleed-content { position: absolute; top: 3mm; left: 3mm; right: 3mm; bottom: 3mm; overflow: hidden; display: flex; flex-direction: column; }\n'
    + SHARED_CSS + '\n'
    + '</style>\n'
    + '</head>\n'
    + '<body>\n'
    + pages.join('\n')
    + '\n</body>\n</html>';
}

// ── PDF generation ────────────────────────────────────────────────────────────
async function generatePDF(order) {
  var execPath = await chromium.executablePath();

  var browser = await puppeteer.launch({
    args:            chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath:  execPath,
    headless:        true,
    ignoreHTTPSErrors: true,
  });

  try {
    var page = await browser.newPage();
    var html = buildFullHTML(order);

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout:   45000,
    });

    // Extra wait for fonts and layout to settle
    await new Promise(function(resolve) { setTimeout(resolve, 1000); });

    var pdf = await page.pdf({
      width:           '426mm',
      height:          '303mm',
      printBackground: true,
      margin:          { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return pdf;

  } finally {
    await browser.close();
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post('/generate-pdf', async function(req, res) {
  try {
    var errors = validateOrder(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    console.log('[PDF] Starting generation — climate:', req.body.climate, 'startMonth:', req.body.startMonth);
    var t0 = Date.now();

    var pdf = await generatePDF(req.body);

    console.log('[PDF] Done in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's, ' + Math.round(pdf.length / 1024) + 'KB');

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="garden-calendar.pdf"',
      'Content-Length':      pdf.length,
    });
    res.end(pdf);

  } catch (err) {
    console.error('[PDF] Error:', err.message);
    res.status(500).json({ error: 'PDF generation failed', message: err.message });
  }
});

module.exports = router;
