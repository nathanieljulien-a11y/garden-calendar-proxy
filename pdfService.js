const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { buildCalendarPageHTML, SHARED_CSS } = require('./calendarTemplate.js');

const router = express.Router();

const GELATO = {
  widthMm:  426,
  heightMm: 303,
  bleedMm:  3,
};

function validateOrder(body) {
  const errors = [];
  if (body.startMonth == null || body.startMonth < 0 || body.startMonth > 11)
    errors.push('startMonth must be 0-11');
  if (!body.climate || typeof body.climate !== 'string')
    errors.push('climate region required');
  if (!Array.isArray(body.plants) || body.plants.length !== 12)
    errors.push('plants must be array of 12 plant names');
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

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function buildFullCalendarHTML(order) {
  const { startMonth, year, plants, keyDates, holidays, climate, recipientName } = order;
  const pages = [];

  for (let i = 0; i < 12; i++) {
    const monthIdx  = (startMonth + i) % 12;
    const monthYear = year + Math.floor((startMonth + i) / 12);
    const monthName = MONTH_NAMES[monthIdx];
    const plant     = plants[i];

    const monthKeyDates = (keyDates || []).filter(function(d) {
      const date = new Date(d.date);
      return date.getFullYear() === monthYear && date.getMonth() === monthIdx;
    });

    const monthHolidays = (holidays || []).filter(function(h) {
      const start  = new Date(h.startDate);
      const end    = new Date(h.endDate);
      const mStart = new Date(monthYear, monthIdx, 1);
      const mEnd   = new Date(monthYear, monthIdx + 1, 0);
      return start <= mEnd && end >= mStart;
    });

    pages.push(buildCalendarPageHTML(
      monthName, monthIdx, monthYear, plant, climate,
      recipientName, monthKeyDates, monthHolidays, i === 0, GELATO.bleedMm
    ));
  }

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8"/>\n<style>\n' +
    '* { box-sizing: border-box; margin: 0; padding: 0; }\n' +
    '@page { size: ' + GELATO.widthMm + 'mm ' + GELATO.heightMm + 'mm; margin: 0; }\n' +
    'html, body { width: ' + GELATO.widthMm + 'mm; height: ' + GELATO.heightMm + 'mm; margin: 0; padding: 0; }\n' +
    '.calendar-page { width: ' + GELATO.widthMm + 'mm; height: ' + GELATO.heightMm + 'mm; position: relative; overflow: hidden; page-break-after: always; page-break-inside: avoid; background: #FDFAF4; }\n' +
    '.bleed-content { position: absolute; top: ' + GELATO.bleedMm + 'mm; left: ' + GELATO.bleedMm + 'mm; right: ' + GELATO.bleedMm + 'mm; bottom: ' + GELATO.bleedMm + 'mm; overflow: hidden; display: flex; flex-direction: column; }\n' +
    SHARED_CSS + '\n' +
    '</style>\n</head>\n<body>\n' +
    pages.join('\n') +
    '\n</body>\n</html>';
}

async function generateCalendarPDF(order) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: Math.round(GELATO.widthMm * 150 / 25.4),
      height: Math.round(GELATO.heightMm * 150 / 25.4),
      deviceScaleFactor: 2,
    });

    const html = buildFullCalendarHTML(order);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise(function(r) { setTimeout(r, 1000); });

    const pdfBuffer = await page.pdf({
      width: GELATO.widthMm + 'mm',
      height: GELATO.heightMm + 'mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

router.post('/generate-pdf', async function(req, res) {
  try {
    const errors = validateOrder(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    console.log('[PDF] Generating calendar for ' + req.body.climate);
    const start = Date.now();

    const pdfBuffer = await generateCalendarPDF(req.body);

    console.log('[PDF] Generated in ' + ((Date.now() - start) / 1000).toFixed(1) + 's');

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="garden-calendar.pdf"',
      'Content-Length':      pdfBuffer.length,
    });
    res.end(pdfBuffer);

  } catch (err) {
    console.error('[PDF] Error:', err);
    res.status(500).json({ error: 'PDF generation failed', message: err.message });
  }
});

module.exports = router;
