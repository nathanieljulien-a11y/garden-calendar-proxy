/**
 * pdfService.js — Garden Calendar PDF Generator
 *
 * Express endpoint: POST /generate-pdf
 * Accepts calendar order JSON, renders 12 A3 landscape pages via Puppeteer,
 * returns a print-ready PDF meeting Gelato specs:
 *   - A3 landscape (420mm × 297mm) + 3mm bleed = 426mm × 303mm
 *   - 300 DPI equivalent (Puppeteer renders at screen res; PDF is vector-based text/layout)
 *   - CMYK conversion note: Gelato accepts RGB PDF and converts internally
 *
 * Designed to run on Render alongside your existing proxy server.
 * Add to server.js: import/require this file and mount the router.
 */

import express from 'express';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { buildCalendarPageHTML } from './calendarTemplate.js';

const router = express.Router();

// ─── Gelato A3 specs ──────────────────────────────────────────────────────────
const GELATO = {
  widthMm:  426,   // 420 + 3mm bleed each side
  heightMm: 303,   // 297 + 3mm bleed each side
  bleedMm:  3,
  // Puppeteer page size in inches (for PDF generation)
  widthIn:  426 / 25.4,
  heightIn: 303 / 25.4,
};

// ─── Request validation ───────────────────────────────────────────────────────
function validateOrder(body) {
  const errors = [];

  if (!body.startMonth || typeof body.startMonth !== 'number' || body.startMonth < 0 || body.startMonth > 11)
    errors.push('startMonth must be 0–11');

  if (!body.climate || typeof body.climate !== 'string')
    errors.push('climate region required');

  if (!Array.isArray(body.plants) || body.plants.length !== 12)
    errors.push('plants must be array of 12 plant names (one per month)');

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

// ─── PDF generation ───────────────────────────────────────────────────────────
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

    // Set viewport to A3 landscape at 150dpi equivalent
    // (Puppeteer HTML→PDF is vector for text/CSS, raster for images)
    await page.setViewport({
      width:  Math.round(GELATO.widthMm * 150 / 25.4),   // ~2500px wide
      height: Math.round(GELATO.heightMm * 150 / 25.4),  // ~1787px tall
      deviceScaleFactor: 2,  // retina — sharper image rendering
    });

    // Build all 12 pages as a single HTML document with CSS page breaks
    const html = buildFullCalendarHTML(order);

    await page.setContent(html, {
      waitUntil: 'networkidle0',  // wait for all images to load
      timeout: 30000,
    });

    // Wait for fonts and any remaining layout
    await page.waitForTimeout(500);

    const pdfBuffer = await page.pdf({
      width:  `${GELATO.widthMm}mm`,
      height: `${GELATO.heightMm}mm`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return pdfBuffer;

  } finally {
    await browser.close();
  }
}

// ─── Build full 12-page HTML document ─────────────────────────────────────────
function buildFullCalendarHTML(order) {
  const { startMonth, year, plants, keyDates = [], holidays = [], climate,
          recipientName, inspoGardens = [] } = order;

  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  const pages = [];
  for (let i = 0; i < 12; i++) {
    const monthIdx = (startMonth + i) % 12;
    const monthYear = year + Math.floor((startMonth + i) / 12);
    const monthName = MONTH_NAMES[monthIdx];
    const plant = plants[i];
    const monthKeyDates = (keyDates || []).filter(d => {
      const date = new Date(d.date);
      return date.getMonth() === monthIdx;
    });
    const monthHolidays = (holidays || []).filter(h => {
      const start = new Date(h.startDate);
      const end   = new Date(h.endDate);
      // Include if holiday overlaps with this month
      const mStart = new Date(monthYear, monthIdx, 1);
      const mEnd   = new Date(monthYear, monthIdx + 1, 0);
      return start <= mEnd && end >= mStart;
    });

    pages.push(buildCalendarPageHTML({
      monthName,
      monthIdx,
      year: monthYear,
      plant,
      climate,
      recipientName,
      keyDates: monthKeyDates,
      holidays: monthHolidays,
      isFirstPage: i === 0,
      bleedMm: GELATO.bleedMm,
    }));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  /* Reset */
  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* Page setup — A3 landscape with bleed */
  @page {
    size: ${GELATO.widthMm}mm ${GELATO.heightMm}mm;
    margin: 0;
  }

  html, body {
    width:  ${GELATO.widthMm}mm;
    height: ${GELATO.heightMm}mm;
    margin: 0;
    padding: 0;
    background: white;
  }

  /* Each calendar page */
  .calendar-page {
    width:   ${GELATO.widthMm}mm;
    height:  ${GELATO.heightMm}mm;
    position: relative;
    overflow: hidden;
    page-break-after: always;
    page-break-inside: avoid;
    background: #FDFAF4;
  }

  .calendar-page:last-child {
    page-break-after: auto;
  }

  /* Bleed marks — thin guides at bleed boundary, not printed in final */
  .bleed-content {
    position: absolute;
    top:    ${GELATO.bleedMm}mm;
    left:   ${GELATO.bleedMm}mm;
    right:  ${GELATO.bleedMm}mm;
    bottom: ${GELATO.bleedMm}mm;
    overflow: hidden;
  }

  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap');
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}

// ─── Route handler ─────────────────────────────────────────────────────────────
router.post('/generate-pdf', async (req, res) => {
  try {
    // Validate
    const errors = validateOrder(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    console.log(`[PDF] Generating calendar for ${req.body.climate}, starting ${req.body.startMonth}`);
    const start = Date.now();

    const pdfBuffer = await generateCalendarPDF(req.body);

    console.log(`[PDF] Generated in ${((Date.now() - start) / 1000).toFixed(1)}s, ${Math.round(pdfBuffer.length / 1024)}KB`);

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="garden-calendar.pdf"`,
      'Content-Length':      pdfBuffer.length,
    });
    res.end(pdfBuffer);

  } catch (err) {
    console.error('[PDF] Generation error:', err);
    res.status(500).json({ error: 'PDF generation failed', message: err.message });
  }
});

export default router;
