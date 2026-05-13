// calendarTemplate.js (CommonJS)
// Full pasteable area (no bleeds): 271.42mm × 393.14mm
// Two half-pages stacked with 10mm white gap between them.
// Each half: 271.42mm × 191.57mm
// Page A (top): botanical illustration left + commentary/climate/tasks/inspo right
// Page B (bottom): full calendar grid Mon–Sun with key dates + holidays

var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];


function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayMon(year, month) { return (new Date(year, month, 1).getDay() + 6) % 7; }

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Font directory — set by pdfService at startup once fonts are downloaded
var _fontDir = null;
function setFontDir(dir) { _fontDir = dir; }

// Build @font-face CSS — uses local disk files if available, falls back to Google CDN
function buildFontCSS() {
  if (!_fontDir) {
    // Fallback: Google Fonts CDN (requires network during render)
    return "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&family=Pinyon+Script&display=swap');";
  }
  // Local disk fonts — no network fetch during Puppeteer render
  function fontSrc(file) {
    var dir = _fontDir.split('\\').join('/');
    return "url('file://" + dir + '/' + file + "') format('woff2')";
  }
  return [
    "@font-face{font-family:'Playfair Display';font-style:normal;font-weight:400;src:" + fontSrc('playfair-400.woff2') + ";}",
    "@font-face{font-family:'Playfair Display';font-style:normal;font-weight:600;src:" + fontSrc('playfair-600.woff2') + ";}",
    "@font-face{font-family:'Playfair Display';font-style:italic;font-weight:400;src:" + fontSrc('playfair-400i.woff2') + ";}",
    "@font-face{font-family:'Crimson Pro';font-style:normal;font-weight:400;src:" + fontSrc('crimsonpro-400.woff2') + ";}",
    "@font-face{font-family:'Crimson Pro';font-style:normal;font-weight:500;src:" + fontSrc('crimsonpro-500.woff2') + ";}",
    "@font-face{font-family:'Crimson Pro';font-style:italic;font-weight:400;src:" + fontSrc('crimsonpro-400i.woff2') + ";}",
    "@font-face{font-family:'Pinyon Script';font-style:normal;font-weight:400;src:" + fontSrc('pinyonscript-400.woff2') + ";}",
  ].join('\n');
}

// ── Page B: full calendar grid ────────────────────────────────────────────────
function buildPageB(opts) {
  var monthName     = opts.monthName;
  var monthIdx      = opts.monthIdx;
  var year          = opts.year;
  var keyDates      = opts.keyDates || [];
  var holidays      = opts.holidays || [];
  var climate       = opts.climate || '';
  var recipientName = opts.recipientName || '';
  var calendarName  = opts.calendarName || '';
  var appQrB64      = opts.appQrB64 || '';

  // Key date map — pure string parsing, no Date() timezone issues
  var keyDateMap = {};
  for (var i = 0; i < keyDates.length; i++) {
    var kd    = keyDates[i];
    var parts = (kd.date || '').split('-');
    if (parseInt(parts[0], 10) === year && (parseInt(parts[1], 10) - 1) === monthIdx) {
      var kday = parseInt(parts[2], 10);
      if (!keyDateMap[kday]) keyDateMap[kday] = [];
      keyDateMap[kday].push(kd.label || '');
    }
  }

  // Holiday map — label appears on EVERY day of the holiday period
  var holidayDays     = {};
  var holidayLabelMap = {};
  var daysInMonth     = getDaysInMonth(year, monthIdx);
  for (var h = 0; h < holidays.length; h++) {
    var hol = holidays[h];
    var sp  = (hol.startDate || '').split('-');
    var ep  = (hol.endDate   || '').split('-');
    var sy  = parseInt(sp[0], 10), sm = parseInt(sp[1], 10) - 1, sd = parseInt(sp[2], 10);
    var ey  = parseInt(ep[0], 10), em = parseInt(ep[1], 10) - 1, ed = parseInt(ep[2], 10);
    for (var d2 = 1; d2 <= daysInMonth; d2++) {
      var startsOnOrBefore = (sy < year) || (sy === year && sm < monthIdx) || (sy === year && sm === monthIdx && sd <= d2);
      var endsOnOrAfter    = (ey > year) || (ey === year && em > monthIdx) || (ey === year && em === monthIdx && ed >= d2);
      if (startsOnOrBefore && endsOnOrAfter) {
        holidayDays[d2]     = true;
        holidayLabelMap[d2] = hol.label || 'Holiday'; // same label every day
      }
    }
  }

  var firstDow = getFirstDayMon(year, monthIdx);

  var gridHtml = '';

  // Day headers Mon–Sun
  var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (var dn = 0; dn < 7; dn++) {
    gridHtml += '<div class="cal-dow' + (dn >= 5 ? ' cal-dow-wknd' : '') + '">' + dayNames[dn] + '</div>';
  }

  // Leading empty cells with previous month's day numbers (lighter colour)
  var prevMonthDays = getDaysInMonth(year, (monthIdx + 11) % 12);
  for (var e = 0; e < firstDow; e++) {
    var prevDay = prevMonthDays - firstDow + 1 + e;
    gridHtml += '<div class="cal-cell cal-empty"><div class="day-top-row"><span class="day-num day-num-other">' + prevDay + '</span></div></div>';
  }

  // Current month days
  for (var d = 1; d <= daysInMonth; d++) {
    var col       = (firstDow + d - 1) % 7;
    var isWeekend = col >= 5;
    var isHol     = !!holidayDays[d];
    var kdList    = keyDateMap[d] || [];
    var cls = 'cal-cell'
      + (isWeekend ? ' cal-weekend' : '')
      + (isHol     ? ' cal-holiday' : '')
      + (kdList.length ? ' cal-event' : '');

    // Day number + labels on same top row, wrapping to second line if needed
    var inner = '<div class="day-top-row">'
      + '<span class="day-num">' + d + '</span>';
    if (isHol && holidayLabelMap[d]) {
      inner += '<span class="hol-label">' + esc(holidayLabelMap[d]) + '</span>';
    }
    for (var k = 0; k < kdList.length; k++) {
      inner += '<span class="event-label">' + esc(kdList[k]) + '</span>';
    }
    inner += '</div>';

    gridHtml += '<div class="' + cls + '">' + inner + '</div>';
  }

  // Grid is always 6 data rows (+ 1 header row = 7 total).
  // Rows with at least one current-month day render normally with prev/next fill cells.
  // Row 6 entirely empty → full-width notes box (grid-column 1/-1).
  // Rows 5 AND 6 both entirely empty → single tall notes box spanning both rows (grid-row 5/7).
  var total = firstDow + daysInMonth;
  // How many cells are filled by leading empties + current month days
  // Row 5 starts at cell index 28 (0-based), row 6 at cell index 35
  var row5Start = 28; // cells 28–34
  var row6Start = 35; // cells 35–41
  var row5HasDays = total > row5Start; // at least one current-month day in row 5
  var row6HasDays = total > row6Start; // at least one current-month day in row 6

  if (!row5HasDays) {
    // Rows 5 and 6 both empty — one tall unified notes box spanning data rows 5+6
    // Grid row 1 = header, so data row 5 = grid row 6, data row 6 = grid row 7
    gridHtml += '<div class="cal-notes-box" style="grid-column:1 / -1;grid-row:6 / 8;">'
      + '<span class="cal-notes-label">Notes</span>'
      + '</div>';
  } else if (!row6HasDays) {
    // Row 5 has days, row 6 entirely empty.
    // Render trailing next-month fill cells on row 5, then notes box at data row 6 = grid row 7.
    var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (var t = 0; t < trailing; t++) {
      gridHtml += '<div class="cal-cell cal-empty"><div class="day-top-row"><span class="day-num day-num-other">' + (t + 1) + '</span></div></div>';
    }
    gridHtml += '<div class="cal-notes-box" style="grid-column:1 / -1;grid-row:7 / 8;">'
      + '<span class="cal-notes-label">Notes</span>'
      + '</div>';
  } else {
    // All 6 rows have current-month days — trailing cells get next-month day numbers
    var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (var t = 0; t < trailing; t++) {
      gridHtml += '<div class="cal-cell cal-empty"><div class="day-top-row"><span class="day-num day-num-other">' + (t + 1) + '</span></div></div>';
    }
  }

  return '<div class="cal-page page-b">'
    + '<div class="page-b-layout">'
    + '<div class="cal-header">'
    + '<div class="cal-header-month">' + esc(monthName) + '</div>'
    + '<div class="cal-header-year">' + year + '</div>'
    // No plant name in calendar header
    + (recipientName ? '<div class="cal-header-recipient">' + esc(recipientName) + '\u2019s Garden Calendar by Clockwatcher Almanacs</div>' : '')
    + '</div>'
    + '<div class="cal-grid-full">' + gridHtml + '</div>'
    + '<div class="cal-footer">'
    + '<span class="cal-footer-left">'
    + (calendarName ? esc(calendarName) + (climate ? ' \u00b7 ' : '') : '')
    + (climate ? esc(climate) : '')
    + '</span>'
    + '<span class="cal-footer-right">'
    + 'Clockwatcher Almanacs \u00b7 garden-calendar-frontend.vercel.app'
    + '</span>'
    + (appQrB64 ? '<img class="cal-footer-qr" src="' + appQrB64 + '" alt="App QR"/>' : '')
    + '</div>'
    + '</div>'
    + '</div>';
}

// ── Blank page ────────────────────────────────────────────────────────────────
function buildBlankPage() {
  return '<div class="cal-page cal-blank"></div>';
}

// ── CSS ───────────────────────────────────────────────────────────────────────
// @page size: 305mm × 428mm (A3 297×420mm trim + 4mm bleed each side)
// Each half-page slot: 305mm × 209mm  → content box 279.42×195.57mm centred within
// Gap between page-a and page-b: 10mm
// Cover: 305mm × 428mm full bleed

var SHARED_CSS = [
  buildFontCSS(),
  ':root{--ink:#2C1A0A;--gold:#8B6914;--sage:#5A7A32;--cream:#F0EBE0;--parchment:#FDFAF4;--rust:#8A3A10;--muted:#7A5C2A;--border:rgba(139,105,20,0.22);}',
  'body{font-family:"Crimson Pro",Georgia,serif;color:var(--ink);background:white;margin:0;padding:0;}',

  // Full bleed page: 305mm × 428mm (A3 trim 297×420mm + 4mm bleed)
  // Gelato safe zones: 16mm from top bleed edge (wire-o binding), 12mm from bottom
  // Each month = one .cal-sheet: 428mm tall, padding enforces safe zones.
  // Two half-pages inside, each fills half the available space with 10mm gap between.
  // Available inner height: 428 - 16 - 12 = 400mm; gap 10mm; each half = 195mm.
  '.cal-sheet{width:305mm;height:428mm;page-break-after:always;display:flex;flex-direction:column;padding-top:16mm;padding-bottom:12mm;background:white;box-sizing:border-box;}',
  '.cal-page{width:279.42mm;flex:1;position:relative;overflow:hidden;background:var(--parchment);display:block;margin-left:auto;margin-right:auto;padding:0;}',
  '.cal-blank{width:305mm;height:428mm;background:white;page-break-after:always;margin:0;padding:0;}',

  // 10mm white gap between page-a and page-b
  '.page-a{margin-bottom:10mm;}',
  '.page-b{}'  ,

  // ── PAGE A ──────────────────────────────────────────────────────────────
  // 50-50 split: left = 139.71mm, right = 139.71mm
  '.page-a-layout{display:grid;grid-template-columns:139.71mm 1fr;height:100%;margin:0;}',

  // Artwork column
  '.col-artwork{position:relative;overflow:hidden;background:#F7F2E8;border-right:0.4mm solid var(--border);display:flex;flex-direction:column;}',
  '.artwork-img{flex:1;width:100%;min-height:0;object-fit:contain;object-position:center;display:block;filter:sepia(5%) contrast(1.06);}',
  '.artwork-placeholder{flex:1;display:flex;align-items:center;justify-content:center;}',
  '.artwork-placeholder-text{font-family:"Playfair Display",serif;font-style:italic;font-size:14pt;color:var(--muted);opacity:0.4;}',
  '.artwork-footer{flex-shrink:0;padding:2mm 3mm;background:rgba(240,235,224,0.95);border-top:0.3mm solid var(--border);display:flex;justify-content:space-between;align-items:baseline;gap:2mm;}',
  '.artwork-plant-name{font-family:"Playfair Display",serif;font-style:italic;font-size:8pt;color:var(--ink);display:flex;align-items:baseline;gap:2mm;flex-wrap:wrap;} .artwork-latin{font-style:italic;font-size:6.5pt;color:var(--muted);}',
  '.artwork-credit{font-size:5pt;color:var(--muted);opacity:0.6;text-align:right;}',

  // Right column — justify-content:space-between spreads sections evenly
  '.col-right{display:flex;flex-direction:column;padding:4mm 4.5mm;overflow:hidden;justify-content:space-between;}',

  // Header
  '.page-header{border-bottom:0.4mm solid var(--gold);padding-bottom:2mm;flex-shrink:0;}',
  '.header-month{font-family:"Playfair Display",serif;font-size:14pt;font-weight:600;color:var(--ink);}',
  '.header-recipient{font-size:7pt;color:var(--muted);letter-spacing:0.04em;margin-top:0.5mm;}',

  // Climate bar
  '.climate-bar{display:flex;flex-direction:row;align-items:baseline;flex-wrap:nowrap;justify-content:space-between;gap:2mm;padding:1mm 2.5mm;background:rgba(139,105,20,0.06);border-left:0.8mm solid var(--gold);flex-shrink:0;}',
  '.climate-region{font-size:6.5pt;font-style:italic;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;} .climate-stats{font-size:7pt;color:var(--ink);}',
  // .climate-stats removed — replaced by .climate-line in the new 2-line layout,

  // Section label (shared)
  '.section-label{font-family:"Playfair Display",serif;font-size:6.5pt;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);margin-bottom:2mm;display:block;}',

  // Plant commentary box
  '.plant-box{flex-shrink:0;margin-top:1mm;}',
  '.plant-bullets{list-style:none;padding:0;margin:0;}',
  '.plant-bullets li{font-size:9.5pt;line-height:1.45;color:var(--ink);padding-left:3.5mm;position:relative;margin-bottom:1.2mm;}',
  '.plant-bullets li::before{content:"\u2022";position:absolute;left:0;color:var(--gold);}',

  // Garden tasks box
  '.tasks-box{flex-shrink:0;margin-top:2mm;}',
  '.tasks-intro{font-size:9.5pt;line-height:1.6;color:var(--ink);margin-bottom:2mm;font-style:italic;}',
  '.tasks-question{font-size:9.5pt;font-weight:600;color:var(--ink);padding-top:2mm;margin-bottom:3mm;}',
  '.tasks-lines{display:flex;flex-direction:column;gap:3.5mm;}',
  '.task-line{display:flex;align-items:center;gap:2mm;min-height:7mm;}',
  '.checkbox{font-size:8.5pt;color:var(--gold);flex-shrink:0;line-height:1;}',
  '.task-rule{flex:1;border-bottom:0.5mm solid rgba(139,105,20,0.45);height:0;}',

  // Compact inspo block: image | text | QR in a row
  '.inspo-block{padding:2mm 2.5mm;background:rgba(139,105,20,0.04);border-left:0.8mm solid var(--gold);flex-shrink:0;}',
  '.inspo-row{display:flex;align-items:center;gap:2mm;margin-top:1mm;}',
  '.inspo-photo-col{flex-shrink:0;width:22mm;height:22mm;overflow:hidden;border-radius:0.5mm;}',
  '.inspo-photo-col img{width:100%;height:100%;object-fit:cover;display:block;filter:sepia(8%) contrast(1.04);}',
  '.inspo-text-col{flex:1;min-width:0;overflow:hidden;}',
  '.inspo-name{font-family:"Playfair Display",serif;font-size:8pt;font-weight:600;color:var(--ink);margin-bottom:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
  '.inspo-location{font-size:6.5pt;color:var(--muted);margin-bottom:0.8mm;}',
  '.inspo-highlight{font-size:7pt;line-height:1.45;color:var(--ink);}',
  '.inspo-qr-col{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:0.8mm;}',
  '.inspo-qr-col img{border:0.3mm solid var(--border);border-radius:1mm;padding:0.5mm;background:white;}',
  '.inspo-qr-lbl{font-size:6pt;color:var(--muted);font-style:italic;text-align:center;}',

  // Footer: quote left + app QR right, side by side
  '.page-footer{border-top:0.3mm solid var(--border);padding-top:1.5mm;flex-shrink:0;display:flex;align-items:center;gap:3mm;}',
  '.footer-quote-col{flex:1;min-width:0;}',
  '.quote-text{font-family:"Playfair Display",serif;font-style:italic;font-size:7pt;line-height:1.5;color:var(--ink);margin-bottom:0.8mm;}',
  '.quote-attr{font-size:6pt;color:var(--muted);}',
  '.footer-qr-col{flex-shrink:0;display:flex;flex-direction:row;align-items:center;gap:2mm;}',
  '.footer-qr-col img{border:0.3mm solid var(--border);border-radius:1mm;padding:0.5mm;background:white;flex-shrink:0;}',
  '.qr-label{font-size:7pt;color:var(--muted);line-height:1.4;text-align:right;max-width:25mm;}',

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  '.cv-chart-block{display:flex;flex-direction:column;overflow:hidden;justify-content:center;}',
  '.cv-chart-svg{flex:1;min-height:0;overflow:hidden;}',
  '.cv-chart-empty{font-size:11pt;color:var(--muted);font-style:italic;padding:3mm;}',
  '.cv-chart-source{font-size:7pt;color:var(--muted);font-style:italic;text-align:right;padding-top:0.5mm;}',
  // Cover sheet wrapper — same safe zones as month sheets
  '.cv-sheet{width:305mm;height:428mm;page-break-after:always;display:flex;flex-direction:column;padding-top:16mm;padding-bottom:12mm;background:white;box-sizing:border-box;}',
  // Cover: fills the available space inside the sheet wrapper (400mm)
  '.cv-cover{width:279.42mm;flex:1;display:flex;flex-direction:row;overflow:hidden;background:var(--parchment);margin-left:auto;margin-right:auto;padding:0;}',
  '.cv-thumb-panel{width:50%;height:100%;flex-shrink:0;background:#F2ECE1;border-right:0.4mm solid var(--border);padding:5mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(6,1fr);gap:2mm;overflow:hidden;}',
  '.cv-thumb-item{display:flex;flex-direction:column;gap:0.8mm;min-height:0;overflow:hidden;}',
  '.cv-thumb-img{flex:1;min-height:0;border:0.3mm solid var(--border);overflow:hidden;display:flex;align-items:center;justify-content:center;}',
  '.cv-thumb-img img{width:100%;height:100%;object-fit:cover;object-position:top left;filter:sepia(5%) contrast(1.06);}',
  '.cv-thumb-placeholder{font-family:"Playfair Display",serif;font-style:italic;font-size:12pt;color:var(--muted);opacity:0.5;text-align:center;padding:1mm;}',
  '.cv-thumb-month{font-size:12pt;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold);text-align:center;flex-shrink:0;line-height:1;font-family:"Playfair Display",serif;}',
  '.cv-right-panel{flex:1;height:100%;display:grid;grid-template-rows:repeat(6,1fr);gap:7.03mm;padding:5mm 5mm 10.05mm 5mm;overflow:hidden;}',
  '.cv-right-panel>*{display:flex;flex-direction:column;justify-content:center;overflow:hidden;}',
  '.cv-section-label{font-family:"Playfair Display",serif;font-size:12pt;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);margin-bottom:2mm;flex-shrink:0;}',
  '.cv-cal-label{font-family:"Playfair Display",serif;font-size:12pt;text-transform:uppercase;letter-spacing:0.18em;color:var(--gold);margin-bottom:1.5mm;}',
  '.cv-name{font-family:"Playfair Display",serif;font-size:38pt;font-weight:700;color:var(--ink);line-height:1.05;margin-bottom:1.5mm;}',
  '.cv-daterange{font-family:"Crimson Pro",serif;font-size:15pt;color:var(--muted);font-style:italic;margin-bottom:2mm;}',
  '.cv-gold-rule{height:0.4mm;background:linear-gradient(to right,var(--gold) 60%,transparent);flex-shrink:0;}',
  '.cv-ics-block{border-left:0.8mm solid var(--gold);background:rgba(139,105,20,0.04);padding:2mm 2.5mm;justify-content:center;}',
  '.cv-ics-row{display:flex;align-items:center;gap:3mm;margin-top:1.5mm;}',
  '.cv-qr{width:26mm;height:26mm;flex-shrink:0;border:0.3mm solid var(--border);border-radius:1mm;background:white;}',
  '.cv-qr-empty{background:rgba(139,105,20,0.04);}',
  '.cv-ics-heading{font-family:"Playfair Display",serif;font-size:16pt;font-weight:600;color:var(--ink);margin-bottom:1.5mm;}',
  '.cv-ics-explain{font-size:13pt;color:var(--muted);line-height:1.5;}',
  '.cv-dates-explain{font-size:12pt;color:var(--ink);line-height:1.6;}',
  '.cv-dates-explain p{margin-bottom:2mm;}',
  '.cv-dates-explain p:last-child{margin-bottom:0;}',
  '.cv-dates-explain strong{color:var(--gold);font-weight:600;}',
  // rows 4 and 5 are now separate grid items — each fills its own row exactly
  '.cv-message-block{display:flex;flex-direction:column;overflow:hidden;}',
  '.cv-message-area{flex:1;min-height:0;border:0.3mm solid var(--border);border-radius:1mm;background:rgba(255,255,255,0.4);display:flex;flex-direction:column;overflow:hidden;}',
  '.cv-message-label{font-family:"Playfair Display",serif;font-size:12pt;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);padding:2mm 2.5mm 1.5mm;border-bottom:0.3mm solid var(--border);flex-shrink:0;}',
  '.cv-message-text{font-family:"Pinyon Script",cursive;font-size:13pt;color:var(--ink);line-height:1.7;padding:2mm 3mm;}',
  '.cv-message-placeholder{opacity:0.35;}',
  '.cv-provenance-block{flex:1;min-height:0;border:0.3mm solid var(--border);border-radius:0.8mm;background:rgba(139,105,20,0.03);padding:2mm 2.5mm;display:flex;flex-direction:column;justify-content:center;overflow:hidden;}',
  '.cv-provenance-text{font-size:11pt;color:var(--muted);line-height:1.5;} .cv-provenance-text em{font-style:italic;color:var(--ink);}',
  '.cv-bottom-row{justify-content:space-between;}',
  '.cv-etsy-row{display:flex;align-items:center;padding:2mm 2.5mm;border:0.3mm solid var(--border);border-radius:0.8mm;background:rgba(255,255,255,0.3);}',
  '.cv-etsy-stack{display:flex;flex-direction:column;gap:1mm;min-width:0;overflow:hidden;}',
  '.cv-etsy-badge{font-family:"Playfair Display",serif;font-size:12pt;text-transform:uppercase;letter-spacing:0.1em;color:var(--rust);flex-shrink:0;}',
  '.cv-etsy-url{font-family:"Crimson Pro",serif;font-size:13pt;color:var(--muted);font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.cv-webapp-row{display:flex;align-items:center;gap:3.5mm;padding:3mm;background:var(--ink);border-radius:1mm;}',
  '.cv-webapp-qr{width:24mm;height:24mm;flex-shrink:0;border-radius:0.6mm;background:white;}',
  '.cv-webapp-title{font-family:"Playfair Display",serif;font-size:16pt;font-weight:600;color:var(--parchment);margin-bottom:1mm;}',
  '.cv-webapp-url{font-family:"Crimson Pro",serif;font-size:12pt;color:rgba(253,250,244,0.6);font-style:italic;}',

  // ── PAGE B ──────────────────────────────────────────────────────────────
  '.page-b-layout{display:flex;flex-direction:column;height:100%;}',

  // Dark header bar — no plant name
  '.cal-header{display:flex;align-items:baseline;gap:4mm;padding:3mm 4mm 2.5mm;background:var(--ink);color:var(--parchment);flex-shrink:0;}',
  '.cal-header-month{font-family:"Playfair Display",serif;font-size:22pt;font-weight:600;letter-spacing:0.01em;}',
  '.cal-header-year{font-size:12pt;opacity:0.6;}',
  '.cal-header-recipient{font-size:7pt;opacity:0.5;letter-spacing:0.05em;text-transform:uppercase;margin-left:auto;}',

  // Calendar grid — 7 columns, day-name row fixed at 8mm, remaining rows share space equally
  // grid-template-rows set dynamically via inline style: 5 rows for tight months, 6 for longer ones
  '.cal-grid-full{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:8mm repeat(6,1fr);min-height:0;border-left:0.3mm solid var(--border);border-top:0.3mm solid var(--border);}',

  // Notes box — grid-column and grid-row set via inline style per instance
  '.cal-notes-box{border-right:0.3mm solid var(--border);border-bottom:0.3mm solid var(--border);background:var(--parchment);padding:2mm 3mm;display:flex;flex-direction:column;}',
  '.cal-notes-label{font-family:"Playfair Display",serif;font-size:6pt;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);flex-shrink:0;}',

  // Day name cells
  '.cal-dow{font-size:7pt;text-align:center;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;justify-content:center;border-right:0.3mm solid var(--border);border-bottom:0.3mm solid var(--border);background:rgba(139,105,20,0.04);}',
  '.cal-dow-wknd{color:var(--rust);}',

  // Day cells
  '.cal-cell{padding:1.5mm 2mm;border-right:0.3mm solid var(--border);border-bottom:0.3mm solid var(--border);display:flex;flex-direction:column;overflow:hidden;}',
  '.cal-empty{background:rgba(0,0,0,0.012);}',
  '.cal-weekend{background:rgba(139,105,20,0.02);}',
  '.cal-holiday{background:rgba(90,122,50,0.08);}',
  '.cal-event{background:rgba(139,58,16,0.05);}',

  // Top row: date number + labels inline, wrapping to second line
  '.day-top-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:1mm;line-height:1.2;}',
  '.day-num{font-size:12pt;font-weight:500;color:var(--ink);line-height:1;flex-shrink:0;}',
  '.day-num-other{font-size:9pt;color:rgba(44,26,10,0.28);}',
  '.cal-weekend .day-num{color:var(--rust);}',
  '.cal-holiday .day-num{color:var(--sage);}',
  '.cal-event .day-num{color:var(--gold);}',
  '.hol-label{font-size:5.5pt;color:var(--sage);font-style:italic;line-height:1.2;}',
  '.event-label{font-size:6pt;color:var(--rust);line-height:1.2;}',

  // Footer
  '.cal-footer{display:flex;align-items:center;gap:2mm;padding:1.5mm 4mm;border-top:0.3mm solid var(--border);flex-shrink:0;}',
  '.cal-footer-left{flex:1;font-size:5.5pt;color:var(--muted);opacity:0.7;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.cal-footer-right{flex-shrink:0;font-size:5.5pt;color:var(--muted);opacity:0.6;letter-spacing:0.04em;}',
  '.cal-footer-qr{width:14mm;height:14mm;border:0.3mm solid var(--border);border-radius:0.8mm;padding:0.3mm;background:white;flex-shrink:0;}',
].join('\n');

// ── Proof watermark CSS ───────────────────────────────────────────────────────
// Injected only when opts.proof is true in buildDocument.
// Single large diagonal mark centred on each page-b. Pure CSS — no HTML changes.
var PROOF_CSS = [
  '.page-b{position:relative;}',
  '.page-b::after{',
  '  content:"PREVIEW ONLY";',
  '  position:absolute;',
  '  top:50%;left:50%;',
  '  transform:translate(-50%,-50%) rotate(-35deg);',
  '  font-family:"Playfair Display",serif;',
  '  font-size:52pt;',
  '  font-weight:600;',
  '  color:rgba(44,26,10,0.17);',
  '  white-space:nowrap;',
  '  pointer-events:none;',
  '  z-index:100;',
  '}',
].join('\n');

// ── Full HTML document ────────────────────────────────────────────────────────
// @page: content (271.42 × 393.14mm) + 4mm bleed each side = 279.42 × 401.14mm
// opts.proof   — if true, injects PREVIEW ONLY watermark on all page-b pages
// opts.widthMm / opts.heightMm — override default A3 sheet size (305×428mm)
//   for non-A3 products (e.g. NA ledger 287.4×427.1mm).
//   Content width = widthMm - 8 (4mm bleed each side).
//   Safe-zone padding (16mm top / 12mm bottom) and 10mm gap are unchanged.
function buildDocument(pages, opts) {
  var proofCss = (opts && opts.proof) ? PROOF_CSS : '';

  // Dimension overrides — default to A3 bleed sheet
  var sheetW   = (opts && opts.widthMm)  || 305;
  var sheetH   = (opts && opts.heightMm) || 428;
  var contentW = (sheetW - 8).toFixed(2) + 'mm'; // strip 4mm bleed each side

  // Override sheet/page dimensions only when they differ from the A3 default.
  // CSS appended after SHARED_CSS so specificity wins cleanly.
  var dimOverrideCss = '';
  if (sheetW !== 305 || sheetH !== 428) {
    dimOverrideCss = '@page { size:' + sheetW + 'mm ' + sheetH + 'mm; margin:0; }\n'
      + 'html,body { width:' + sheetW + 'mm; }\n'
      + '.cal-sheet { width:' + sheetW + 'mm; height:' + sheetH + 'mm; }\n'
      + '.cv-sheet  { width:' + sheetW + 'mm; height:' + sheetH + 'mm; }\n'
      + '.cal-page  { width:' + contentW + '; }\n'
      + '.cv-cover  { width:' + contentW + '; }\n'
      + '.cal-blank { width:' + sheetW + 'mm; height:' + sheetH + 'mm; }\n';
  }

  // pages array: [cover, pageA_1, pageB_1, pageA_2, pageB_2, ..., blank]
  // Wrap cover in cv-sheet, each A+B pair in cal-sheet, blank stays as-is.
  var html = '';
  var i = 0;

  // Cover (index 0)
  if (pages[i]) {
    html += '<div class="cv-sheet">' + pages[i] + '</div>\n';
    i++;
  }

  // Month pairs
  while (i < pages.length - 1) {
    var pageA = pages[i];
    var pageB = pages[i + 1];
    // Check it's actually a pair (not the blank page)
    if (pageA && pageB && pageB.indexOf('cal-blank') === -1) {
      html += '<div class="cal-sheet">' + pageA + pageB + '</div>\n';
      i += 2;
    } else {
      break;
    }
  }

  // Blank page (last)
  if (pages[i]) {
    html += pages[i] + '\n';
  }

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>\n'
    + '* { box-sizing:border-box; margin:0; padding:0; }\n'
    + '@page { size:305mm 428mm; margin:0; }\n'
    + 'html,body { width:305mm; margin:0; padding:0; background:white; }\n'
    + SHARED_CSS + '\n'
    + proofCss + '\n'
    + dimOverrideCss
    + '</style></head><body>\n'
    + html
    + '\n</body></html>';
}

module.exports = {
  buildPageB:     buildPageB,
  buildBlankPage: buildBlankPage,
  buildDocument:  buildDocument,
  setFontDir:     setFontDir,
  SHARED_CSS:     SHARED_CSS,
  MONTH_NAMES:    MONTH_NAMES,
};
