// calendarTemplate.js (CommonJS)
// Full pasteable area (no bleeds): 271.42mm × 393.14mm
// Two half-pages stacked with 10mm white gap between them.
// Each half: 271.42mm × 191.57mm
// Page A (top): botanical illustration left + commentary/climate/tasks/inspo right
// Page B (bottom): full calendar grid Mon–Sun with key dates + holidays

var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

// Generic month-specific garden task intro text
var MONTHLY_TASKS = [
  'January is a time to plan next season\'s garden. Order seeds and bulbs from catalogues, service tools, and start chitting potatoes indoors.',
  'February brings the first signs of life. Force rhubarb under pots, prune wisteria to two buds, and start seeds of slow-growing annuals on a windowsill.',
  'March is the start of the main growing season. Divide perennials, plant summer bulbs, mow the lawn for the first time, and begin sowing veg under cover.',
  'April is a busy month. Plant out hardy annuals, earth up potatoes, deadhead spring bulbs without removing foliage, and keep an eye on late frosts.',
  'May is peak planting time. Harden off tender plants before planting out after the last frost date, stake tall perennials, and sow French beans directly.',
  'June calls for deadheading, feeding, and watering. Thin fruit on trees and bushes, layer strawberries, and keep on top of weeds before they set seed.',
  'July is harvest season. Pick regularly to encourage more, water deeply rather than little and often, and take cuttings of tender perennials.',
  'August is the month of abundance. Harvest consistently, prune summer-fruiting raspberries after fruiting, and begin planting autumn-flowering bulbs.',
  'September is transition time. Plant spring bulbs, divide irises and other perennials, harvest and store root crops, and begin winter pruning of wisteria.',
  'October is time to put the garden to bed. Plant garlic and spring bulbs, cut back herbaceous perennials, mulch borders generously, and clean the greenhouse.',
  'November focuses on structure and soil. Plant bare-root trees and roses, dig over vacant beds to expose pests to frost, and rake and compost autumn leaves.',
  'December is a quiet month. Prune apple and pear trees on dry days, force bulbs indoors, plan next year\'s garden, and protect tender plants from hard frost.',
];

var QUOTES = [
  { text: 'To forget how to dig the earth and tend the soil is to forget ourselves.', author: 'Mahatma Gandhi' },
  { text: 'A garden is a grand teacher. It teaches patience and careful watchfulness; it teaches industry and thrift.', author: 'Gertrude Jekyll, Home and Garden, 1900' },
  { text: 'The kiss of the sun for pardon, the song of the birds for mirth \u2014 one is nearer God\u2019s heart in a garden than anywhere else on earth.', author: 'Dorothy Frances Gurney, 1913' },
  { text: 'God Almighty first planted a garden; and indeed it is the purest of human pleasures.', author: 'Francis Bacon, Essays, 1625' },
  { text: 'A garden must be looked into and dressed as the body.', author: 'George Herbert, Outlandish Proverbs, 1640' },
  { text: 'Who loves a garden still his Eden keeps, perennial pleasures plants, and wholesome harvests reaps.', author: 'Amos Bronson Alcott, 1868' },
  { text: 'The garden is the poor man\u2019s apothecary.', author: 'German proverb' },
  { text: 'He who plants a garden plants happiness.', author: 'Chinese proverb' },
  { text: 'A garden is not made in a year; indeed it is never made in the sense of being finished.', author: 'H. H. Thomas, The Complete Gardener, 1912' },
  { text: 'All gardening is landscape painting.', author: 'Alexander Pope, c.\u00a01720' },
  { text: 'The best place to find God is in a garden. You can dig for him there.', author: 'George Bernard Shaw, 1932' },
  { text: 'The glory of gardening: hands in the dirt, head in the sun, heart with nature.', author: 'Alfred Austin, The Garden That I Love, 1894' },
];

// Plant commentary — loaded from data/plantCommentary.json via setPlantCommentary()
var _plantCommentary = {};

function setPlantCommentary(data) {
  _plantCommentary = data || {};
}

function getCommentary(plant) {
  if (!plant) return { latin: '', habit: '', features: '', flowers: '', conditions: '', care: '', facts: [] };
  return _plantCommentary[plant.toLowerCase()] || { latin: '', habit: '', features: '', flowers: '', conditions: '', care: '', facts: [] };
}

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

// ── Page A: illustration left + commentary/tasks/inspo right ─────────────────
function buildPageA(opts) {
  var monthName     = opts.monthName;
  var monthIdx      = opts.monthIdx;
  var year          = opts.year;
  var plant         = opts.plant || '';
  var artworkB64    = opts.artworkB64 || '';
  var artworkSource = opts.artworkSource || 'Köhler’s Medizinal-Pflanzen, 1887 · Public Domain';
  var inspo         = opts.inspo || null;
  var inspoPhotoB64 = opts.inspoPhotoB64 || '';
  var inspoQrB64    = opts.inspoQrB64 || '';
  var appQrB64      = opts.appQrB64 || '';
  var climate       = opts.climate || '';
  var climateData   = opts.climateData || null;
  var calendarName  = opts.calendarName || opts.recipientName || '';

  var plantDisplay = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : monthName;
  var commentary   = getCommentary(plant);
  var quote        = QUOTES[monthIdx % QUOTES.length];
  var taskText     = MONTHLY_TASKS[monthIdx] || '';

  // Climate bar — ASCII symbols, single line, compact
  var climateHtml = '';
  if (climateData && climateData._cd) {
    var cd   = climateData._cd;
    var tMax = cd.tMax  && cd.tMax[monthIdx]  != null ? Math.round(cd.tMax[monthIdx])  + '\u00b0C' : null;
    var tMin = cd.tMin  && cd.tMin[monthIdx]  != null ? Math.round(cd.tMin[monthIdx])  + '\u00b0C' : null;
    var rain = cd.precip && cd.precip[monthIdx] != null ? Math.round(cd.precip[monthIdx]) + 'mm' : null;
    var sun  = cd.sunHrs && cd.sunHrs[monthIdx] != null ? parseFloat(cd.sunHrs[monthIdx]).toFixed(1) + ' hrs sun/day' : null;
    // Unicode symbols: ☀ sun (U+2600), ☂ umbrella/rain (U+2602), both BMP — reliable in Chromium
    // Thermometer: no clean BMP symbol; use ▲▼ arrows for high/low temps
    var parts = [];
    if (tMax || tMin) parts.push(
      '▲ ' + (tMax || '') + (tMax && tMin ? '  ▼ ' : '') + (tMin ? tMin : '')
    );
    if (rain) parts.push('☂ ' + rain);
    if (sun)  parts.push('☀ ' + sun);
    var statsLine = parts.join('  \u00b7  ');
    climateHtml = '<div class="climate-bar">'
      + '<span class="climate-region">' + esc(climate) + '</span>'
      + (statsLine ? '<span class="climate-stats">' + statsLine + '</span>' : '')
      + '</div>';
  } else if (climate) {
    climateHtml = '<div class="climate-bar"><span class="climate-region">' + esc(climate) + '</span></div>';
  }

  // Plant commentary box — title is plant name, 5 bullets from plantCommentary.json
  var plantBoxHtml = '';
  if (plant && (commentary.habit || commentary.flowers || commentary.care)) {
    var bullets = [];
    if (commentary.habit)      bullets.push(commentary.habit);
    if (commentary.flowers)    bullets.push(commentary.flowers);
    if (commentary.conditions) bullets.push(commentary.conditions);
    if (commentary.care)       bullets.push(commentary.care);
    if (commentary.facts && commentary.facts[0]) bullets.push(commentary.facts[0]);
    bullets = bullets.slice(0, 4);
    plantBoxHtml = '<div class="plant-box">'
      + '<div class="section-label">' + esc(plantDisplay) + '</div>'
      + '<ul class="plant-bullets">'
      + bullets.map(function(b) { return '<li>' + esc(b) + '</li>'; }).join('')
      + '</ul>'
      + '</div>';
  }

  // Garden tasks box
  var tasksHtml = '<div class="tasks-box">'
    + '<div class="section-label">Garden tasks</div>'
    + '<div class="tasks-intro">' + esc(taskText) + '</div>'
    + '<div class="tasks-question">What needs doing in your garden this month?</div>'
    + '<div class="tasks-lines">'
    + '<div class="task-line"><span class="checkbox">\u25a1</span><span class="task-rule"></span></div>'
    + '<div class="task-line"><span class="checkbox">\u25a1</span><span class="task-rule"></span></div>'
    + '<div class="task-line"><span class="checkbox">\u25a1</span><span class="task-rule"></span></div>'
    + '<div class="task-line"><span class="checkbox">\u25a1</span><span class="task-rule"></span></div>'
    + '</div>'
    + '</div>';

  // Compact inspo block: image left | text middle | QR right
  var inspoHtml = '';
  if (inspo && inspo.name) {
    inspoHtml = '<div class="inspo-block">'
      + '<div class="section-label">Have you visited this garden?</div>'
      + '<div class="inspo-row">';
    if (inspoPhotoB64) {
      inspoHtml += '<div class="inspo-photo-col"><img src="' + inspoPhotoB64 + '" alt="' + esc(inspo.name) + '"/></div>';
    }
    inspoHtml += '<div class="inspo-text-col">'
      + '<div class="inspo-name">' + esc(inspo.name) + '</div>'
      + (inspo.location  ? '<div class="inspo-location">'  + esc(inspo.location)  + '</div>' : '')
      + (inspo.highlight ? '<div class="inspo-highlight">' + esc(inspo.highlight) + '</div>' : '')
      + '</div>';
    if (inspoQrB64) {
      inspoHtml += '<div class="inspo-qr-col">'
        + '<img src="' + inspoQrB64 + '" width="52" height="52" alt="Search QR"/>'
        + '<div class="inspo-qr-lbl">Search \u2197</div>'
        + '</div>';
    }
    inspoHtml += '</div></div>';
  }

  // Footer: quote left, then [text | QR] right-aligned, QR vertically aligned with inspo QR
  var footerHtml = '<div class="page-footer">'
    + '<div class="footer-quote-col">'
    + '<div class="quote-text">\u201c' + esc(quote.text) + '\u201d</div>'
    + '<div class="quote-attr">\u2014\u00a0' + esc(quote.author) + '</div>'
    + '</div>'
    + (appQrB64
        ? '<div class="footer-qr-col">'
          + '<div class="qr-label">Your digital garden calendar</div>'
          + '<img src="' + appQrB64 + '" width="52" height="52" alt="App QR"/>'
          + '</div>'
        : '')
    + '</div>';

  return '<div class="cal-page page-a">'
    + '<div class="page-a-layout">'

    + '<div class="col-artwork">'
    + (artworkB64
        ? '<img class="artwork-img" src="' + artworkB64 + '" alt="' + esc(plantDisplay) + ' botanical illustration"/>'
        : '<div class="artwork-placeholder"><div class="artwork-placeholder-text">' + esc(plantDisplay) + '</div></div>')
    + '<div class="artwork-footer">'
    + '<span class="artwork-plant-name">' + esc(plantDisplay) + (commentary.latin ? ' <span class="artwork-latin">' + esc(commentary.latin) + '</span>' : '') + '</span>'
    + '<span class="artwork-credit">' + esc(artworkSource) + '</span>'
    + '</div>'
    + '</div>'

    + '<div class="col-right">'
    + '<div class="page-header">'
    + '<div class="header-month">' + esc(monthName) + '\u00a0' + year + '</div>'
    + (calendarName ? '<div class="header-recipient">' + esc(calendarName) + '</div>' : '')
    + '</div>'
    + climateHtml
    + tasksHtml
    + plantBoxHtml
    + inspoHtml
    + footerHtml
    + '</div>'

    + '</div>'
    + '</div>';
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
  var monthIcsB64   = opts.monthIcsB64 || '';
  // Calculate grid layout for QR placement
  var _firstDow2    = getFirstDayMon(year, monthIdx);
  var _daysInMonth2 = getDaysInMonth(year, monthIdx);
  var _totalCells   = _firstDow2 + _daysInMonth2;
  var _rowsNeeded   = Math.ceil(_totalCells / 7);
  var _trailing     = _totalCells % 7 === 0 ? 0 : 7 - (_totalCells % 7);
  // QR goes in last cell: either last trailing cell or last blank-row cell

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

  // Trailing cells + blank row — last cell gets holiday QR if present
  var total    = firstDow + daysInMonth;
  var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  var rowsNeeded = Math.ceil(total / 7);
  var totalCells = rowsNeeded * 7; // always render full rows
  var trailingCount = totalCells - total; // trailing + blank row cells

  for (var t = 0; t < trailingCount; t++) {
    var isLast = (t === trailingCount - 1);
    var nextDay = t < trailing ? (t + 1) : null; // null = blank-row cell
    if (isLast && monthIcsB64) {
      // Last cell: show QR code for holiday(s) starting this month
      gridHtml += '<div class="cal-cell cal-empty cal-ics-cell">'
        + '<div class="cal-ics-qr-wrap">'
        + '<img src="' + monthIcsB64 + '" class="cal-ics-qr" alt="Add to calendar"/>'
        + '<span class="cal-ics-lbl">Add to calendar</span>'
        + '</div>'
        + '</div>';
    } else {
      gridHtml += '<div class="cal-cell cal-empty">'
        + (nextDay ? '<div class="day-top-row"><span class="day-num day-num-other">' + nextDay + '</span></div>' : '')
        + '</div>';
    }
  }

  return '<div class="cal-page page-b">'
    + '<div class="page-b-layout">'
    + '<div class="cal-header">'
    + '<div class="cal-header-month">' + esc(monthName) + '</div>'
    + '<div class="cal-header-year">' + year + '</div>'
    // No plant name in calendar header
    + (recipientName ? '<div class="cal-header-recipient">' + esc(recipientName) + '\u2019s Garden Calendar</div>' : '')
    + '</div>'
    + '<div class="cal-grid-full">' + gridHtml + '</div>'
    + '<div class="cal-footer">'
    + '<span class="cal-footer-text">The Garden Calendar \u00b7 garden-calendar-frontend.vercel.app</span>'
    + (climate ? '<span class="cal-footer-climate">' + esc(climate) + '</span>' : '')
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
  // Content box: 279.42mm × 195.57mm centred in each 305×209mm half-page slot
  // Blank full-sheet: 305mm × 428mm
  '.cal-page{width:279.42mm;height:195.57mm;position:relative;overflow:hidden;background:var(--parchment);display:block;margin:6.715mm auto;padding:0;}',
  '.cal-blank{width:305mm;height:428mm;background:white;page-break-after:always;margin:0;padding:0;}',

  // 10mm white gap between page-a and page-b
  '.page-a{margin-bottom:3.285mm;}',
  // page-break-after on page-b ensures each month pair occupies exactly one full sheet
  '.page-b{page-break-after:always;}',

  // ── PAGE A ──────────────────────────────────────────────────────────────
  // 50-50 split: left = 139.71mm, right = 139.71mm
  '.page-a-layout{display:grid;grid-template-columns:139.71mm 1fr;height:100%;margin:0;}',

  // Artwork column
  '.col-artwork{position:relative;overflow:hidden;background:#F7F2E8;border-right:0.4mm solid var(--border);display:flex;flex-direction:column;}',
  '.artwork-img{flex:1;width:100%;min-height:0;object-fit:cover;object-position:top left;display:block;filter:sepia(5%) contrast(1.06);}',
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
  '.tasks-question{font-size:9.5pt;font-weight:600;color:var(--ink);margin-bottom:2.5mm;}',
  '.tasks-lines{display:flex;flex-direction:column;gap:3.5mm;}',
  '.task-line{display:flex;align-items:center;gap:2mm;}',
  '.checkbox{font-size:8.5pt;color:var(--gold);flex-shrink:0;line-height:1;}',
  '.task-rule{flex:1;border-bottom:0.3mm solid rgba(139,105,20,0.3);height:0;}',

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
  '.cv-cover{width:305mm;height:428mm;display:flex;flex-direction:row;overflow:hidden;background:var(--parchment);page-break-before:always;page-break-after:always;margin:0;padding:0;}',
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
  '.cv-etsy-row{display:flex;align-items:center;gap:3mm;padding:2mm 2.5mm;border:0.3mm solid var(--border);border-radius:0.8mm;background:rgba(255,255,255,0.3);}',
  '.cv-etsy-badge{font-family:"Playfair Display",serif;font-size:12pt;text-transform:uppercase;letter-spacing:0.1em;color:var(--rust);flex-shrink:0;}',
  '.cv-etsy-url{font-family:"Crimson Pro",serif;font-size:15pt;color:var(--muted);font-style:italic;}',
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
  // No gap between day-name row and data rows (unified border)
  '.cal-grid-full{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:8mm repeat(6,1fr);min-height:0;border-left:0.3mm solid var(--border);border-top:0.3mm solid var(--border);}',

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
  '.cal-footer{display:flex;justify-content:space-between;align-items:center;padding:1.5mm 4mm;border-top:0.3mm solid var(--border);flex-shrink:0;}',
  '.cal-ics-cell{display:flex;align-items:center;justify-content:center;padding:1mm;background:rgba(139,105,20,0.03);}',
  '.cal-ics-qr-wrap{display:flex;flex-direction:column;align-items:center;gap:0.8mm;}',
  '.cal-ics-qr{width:18mm;height:18mm;border:0.3mm solid var(--border);border-radius:0.8mm;background:white;}',
  '.cal-ics-lbl{font-size:5pt;color:var(--muted);font-style:italic;text-align:center;line-height:1.3;}',
  '.cal-footer-text{font-size:5.5pt;color:var(--muted);opacity:0.6;letter-spacing:0.04em;}',
  '.cal-footer-climate{font-size:5.5pt;color:var(--muted);font-style:italic;opacity:0.7;}',
].join('\n');

// ── Full HTML document ────────────────────────────────────────────────────────
// @page: content (271.42 × 393.14mm) + 4mm bleed each side = 279.42 × 401.14mm
function buildDocument(pages) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>\n'
    + '* { box-sizing:border-box; margin:0; padding:0; }\n'
    + '@page { size:305mm 428mm; margin:0; }\n'
    + 'html,body { width:305mm; margin:0; padding:0; background:white; }\n'
    + SHARED_CSS + '\n'
    + '</style></head><body>\n'
    + pages.join('\n')
    + '\n</body></html>';
}

module.exports = {
  buildPageA:         buildPageA,
  buildPageB:         buildPageB,
  buildBlankPage:     buildBlankPage,
  buildCoverPage:     buildCoverPage,
  buildDocument:      buildDocument,
  setPlantCommentary: setPlantCommentary,
  setFontDir:         setFontDir,
  getCommentary:      getCommentary,
  buildICS:           buildICS,
  buildMonthICS:      buildMonthICS,
  SHARED_CSS:         SHARED_CSS,
  MONTH_NAMES:        MONTH_NAMES,
};

// ── Climate chart for cover page row 2 ───────────────────────────────────────
// Inline SVG: temperature lines (high/low) on left axis, precip bars on right axis.
// 12 months starting from startMonthIdx. Rendered at 130×52mm in cover page.
function _buildClimateChart(climateData, startMonthIdx, monthNames, climateLabel) {
  climateLabel = climateLabel || '';
  // Abbreviated month labels
  var MON_ABBR = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  var W = 500, H = 180;  // SVG units (maps to ~130×52mm at cover scale)
  var padL = 38, padR = 38, padT = 16, padB = 28;
  var cW = W - padL - padR, cH = H - padT - padB;

  var cd = (climateData && climateData._cd) || null;
  if (!cd) {
    // No data — show placeholder
    return '<div class="cv-chart-block"><span class="cv-section-label">Average climate</span>'
      + '<div class="cv-chart-empty">Climate data not available</div></div>';
  }

  // Reorder data to start from startMonthIdx
  var tMaxR=[], tMinR=[], precipR=[], labelsR=[];
  for (var i=0;i<12;i++) {
    var mi = (startMonthIdx + i) % 12;
    tMaxR.push(cd.tMax[mi]);
    tMinR.push(cd.tMin[mi]);
    precipR.push(cd.precip[mi]);
    labelsR.push(monthNames[i] ? monthNames[i].slice(0,1) : MON_ABBR[mi]);
  }

  // Scales
  var allTemps = tMaxR.concat(tMinR).filter(function(v){return v!=null;});
  var tLo = Math.floor(Math.min.apply(null,allTemps) / 5) * 5 - 5;
  var tHi = Math.ceil(Math.max.apply(null,allTemps) / 5) * 5 + 5;
  var pHi = Math.ceil(Math.max.apply(null,precipR) / 20) * 20;

  function tY(v) { return padT + cH - (v - tLo) / (tHi - tLo) * cH; }
  function pY(v) { return padT + cH - v / pHi * cH; }
  function xMid(i) { return padL + (i + 0.5) * (cW / 12); }
  function xLeft(i){ return padL + i * (cW / 12); }
  var barW = cW / 12 * 0.65;

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" '
    + 'style="width:100%;height:100%;display:block;">';

  // Background
  svg += '<rect width="'+W+'" height="'+H+'" fill="#FDFAF4"/>';

  // Grid lines (temperature)
  var tStep = (tHi - tLo) <= 30 ? 5 : 10;
  for (var t = tLo; t <= tHi; t += tStep) {
    var gy = tY(t);
    if (gy < padT || gy > padT+cH+1) continue;
    svg += '<line x1="'+padL+'" y1="'+gy+'" x2="'+(padL+cW)+'" y2="'+gy+'" '
      + 'stroke="rgba(139,105,20,0.12)" stroke-width="0.8"/>';
    svg += '<text x="'+(padL-4)+'" y="'+(gy+3)+'" text-anchor="end" '
      + 'font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#7A5C2A">'+t+'°</text>';
  }

  // Precipitation bars (right axis, sage green, behind lines)
  var pStep = pHi <= 80 ? 20 : 40;
  for (var p = 0; p <= pHi; p += pStep) {
    var py = pY(p);
    if (py < padT || py > padT+cH+1) continue;
    svg += '<text x="'+(padL+cW+4)+'" y="'+(py+3)+'" text-anchor="start" '
      + 'font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#5A7A32">'+p+'</text>';
  }
  for (var i=0;i<12;i++) {
    if (precipR[i] == null) continue;
    var bx = xLeft(i) + (cW/12 - barW)/2;
    var by = pY(precipR[i]);
    var bh = padT + cH - by;
    svg += '<rect x="'+bx+'" y="'+by+'" width="'+barW+'" height="'+bh+'" '
      + 'fill="rgba(90,122,50,0.22)" rx="1"/>';
  }

  // Temperature lines
  // tMax line (rust/warm)
  var maxPts = tMaxR.map(function(v,i){return xMid(i)+','+tY(v);}).join(' ');
  svg += '<polyline points="'+maxPts+'" fill="none" stroke="#8A3A10" stroke-width="2" stroke-linejoin="round"/>';
  // tMin line (gold)
  var minPts = tMinR.map(function(v,i){return xMid(i)+','+tY(v);}).join(' ');
  svg += '<polyline points="'+minPts+'" fill="none" stroke="#8B6914" stroke-width="2" stroke-linejoin="round"/>';

  // Dots on lines
  for (var i=0;i<12;i++) {
    svg += '<circle cx="'+xMid(i)+'" cy="'+tY(tMaxR[i])+'" r="3" fill="#8A3A10"/>';
    svg += '<circle cx="'+xMid(i)+'" cy="'+tY(tMinR[i])+'" r="3" fill="#8B6914"/>';
  }

  // Month labels
  for (var i=0;i<12;i++) {
    svg += '<text x="'+xMid(i)+'" y="'+(padT+cH+14)+'" text-anchor="middle" '
      + 'font-family="Playfair Display,serif" font-size="11" fill="#2C1A0A">'+labelsR[i]+'</text>';
  }

  // Legend
  var ly = padT - 5;
  svg += '<line x1="'+padL+'" y1="'+ly+'" x2="'+(padL+18)+'" y2="'+ly+'" stroke="#8A3A10" stroke-width="2"/>';
  svg += '<text x="'+(padL+22)+'" y="'+(ly+4)+'" font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#8A3A10">High</text>';
  svg += '<line x1="'+(padL+60)+'" y1="'+ly+'" x2="'+(padL+78)+'" y2="'+ly+'" stroke="#8B6914" stroke-width="2"/>';
  svg += '<text x="'+(padL+82)+'" y="'+(ly+4)+'" font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#8B6914">Low °C</text>';
  svg += '<rect x="'+(padL+145)+'" y="'+(ly-7)+'" width="14" height="10" fill="rgba(90,122,50,0.3)" rx="1"/>';
  svg += '<text x="'+(padL+163)+'" y="'+(ly+4)+'" font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#5A7A32">Rain mm</text>';

  // Axis lines
  svg += '<line x1="'+padL+'" y1="'+padT+'" x2="'+padL+'" y2="'+(padT+cH)+'" stroke="rgba(44,26,10,0.2)" stroke-width="1"/>';
  svg += '<line x1="'+padL+'" y1="'+(padT+cH)+'" x2="'+(padL+cW)+'" y2="'+(padT+cH)+'" stroke="rgba(44,26,10,0.2)" stroke-width="1"/>';
  svg += '<line x1="'+(padL+cW)+'" y1="'+padT+'" x2="'+(padL+cW)+'" y2="'+(padT+cH)+'" stroke="rgba(90,122,50,0.2)" stroke-width="1"/>';

  svg += '</svg>';

  return '<div class="cv-chart-block">'
    + '<span class="cv-section-label">Typical climate in ' + esc(climateLabel) + '</span>'
    + '<div class="cv-chart-svg">' + svg + '</div>'
    + '<div class="cv-chart-source">Source: Open-Meteo ERA5 reanalysis · 10-year averages 2015–2024</div>'
    + '</div>';
}

// ── Cover page ────────────────────────────────────────────────────────────────
// Full sheet: 279.42mm × 401.14mm
// Left panel: 2×6 thumbnail grid aligned to photo areas (not labels)
// Right panel: 6 sections grid-aligned to photo tops/bottoms
function buildCoverPage(opts) {
  var calendarName  = opts.calendarName  || '';
  var dateRange     = opts.dateRange     || '';   // e.g. "June 2026 – May 2027"
  var climate       = opts.climate       || '';
  var artworks      = opts.artworks      || [];   // array of 12 base64 strings
  var artworkSources= opts.artworkSources || [];
  var plants        = opts.plants        || [];   // array of 12 plant names
  var monthNames    = opts.monthNames    || [];   // array of 12 month name strings
  // icsKeyQrB64 / icsHolQrB64 removed — cover no longer has ICS QRs
  var appQrB64      = opts.appQrB64      || '';
  var personalMsg   = opts.personalMsg   || '';
  var etsyUrl       = opts.etsyUrl       || 'etsy.com/shop/yourshophere';
  var startMonthIdx = opts.startMonthIdx || 0;

  // Build 12 thumbnail items
  var thumbsHtml = '';
  for (var i = 0; i < 12; i++) {
    var plantName  = plants[i]    ? (plants[i].charAt(0).toUpperCase() + plants[i].slice(1)) : '';
    var monthName  = monthNames[i] || '';
    var art        = artworks[i]   || '';
    thumbsHtml += '<div class="cv-thumb-item">'
      + '<div class="cv-thumb-img">'
      + (art
          ? '<img src="' + art + '" alt="' + esc(plantName) + '"/>'
          : '<span class="cv-thumb-placeholder">' + esc(plantName) + '</span>')
      + '</div>'
      + '<div class="cv-thumb-month">' + esc(monthName) + '</div>'
      + '</div>';
  }

  // Row 2: 12-month climate chart (temperature lines + precipitation bars)
  var climateChartHtml = _buildClimateChart(opts.climateData, opts.startMonthIdx || 0, opts.monthNames || [], opts.climate || '');

  // Row 3: single dates/holidays explanation box (replaces two separate ICS blocks)
  var datesExplainHtml = '<div class="cv-ics-block">'
    + '<span class="cv-section-label">Your special dates &amp; holidays</span>'
    + '<div class="cv-dates-explain">'
    + '<p><strong>Birthdays &amp; anniversaries</strong> are marked on each monthly calendar page.</p>'
    + '<p><strong>Holiday periods</strong> are shaded on each monthly calendar page. '
    + 'Scan the QR code on the relevant month to load your holiday into your phone\'s calendar.</p>'
    + '</div>'
    + '</div>';

  // Row 4: personal message — its own grid item
  var msgHtml = '<div class="cv-message-block">'
    + '<div class="cv-message-area">'
    + '<div class="cv-message-label">A personal message</div>'
    + (personalMsg
        ? '<div class="cv-message-text">' + esc(personalMsg) + '</div>'
        : '<div class="cv-message-text cv-message-placeholder">With love\u2026</div>')
    + '</div>'
    + '</div>';

  // Row 5: provenance — its own grid item, fills row top to bottom
  var hasKoehler = artworkSources.some(function(s){ return s && s.indexOf('K\u00f6hler')  !== -1; });
  var hasEdwards = artworkSources.some(function(s){ return s && s.indexOf('Edwards')  !== -1; });
  var hasRedoute = artworkSources.some(function(s){ return s && s.indexOf('Redout')   !== -1; });
  var provLines = [];
  if (hasKoehler) provLines.push('<em>K\u00f6hler\u2019s Medizinal-Pflanzen</em> (1887\u20131898) \u00b7 Public domain \u00b7 Missouri Botanical Garden');
  if (hasEdwards) provLines.push('<em>Edwards\u2019 Botanical Register</em> (1815\u20131847) \u00b7 Public domain');
  if (hasRedoute) provLines.push('<em>Trait\u00e9 des Arbres et Arbustes</em>, Pierre Joseph Redout\u00e9 (1801\u20131819) \u00b7 Public domain');
  if (!provLines.length) provLines.push('All botanical illustrations are in the public domain.');
  var provText = provLines.join('<br/>');
  var provHtml = '<div class="cv-provenance-block">'
    + '<span class="cv-section-label">About the illustrations</span>'
    + '<div class="cv-provenance-text">' + provText + '</div>'
    + '</div>';

  // Bottom row: Etsy top, web app QR bottom
  var bottomHtml = '<div class="cv-bottom-row">'
    + '<div class="cv-etsy-row">'
    + '<span class="cv-etsy-badge">Find us on Etsy</span>'
    + '<span class="cv-etsy-url">' + esc(etsyUrl) + '</span>'
    + '</div>'
    + '<div class="cv-webapp-row">'
    + (appQrB64 ? '<img class="cv-webapp-qr" src="' + appQrB64 + '" alt="App QR"/>' : '')
    + '<div class="cv-webapp-text">'
    + '<div class="cv-webapp-title">Your digital garden calendar</div>'
    + '<div class="cv-webapp-url">garden-calendar-frontend.vercel.app</div>'
    + '</div>'
    + '</div>'
    + '</div>';

  return '<div class="cv-cover">'
    // Left: thumbnail grid
    + '<div class="cv-thumb-panel">' + thumbsHtml + '</div>'
    // Right: 6-section grid
    + '<div class="cv-right-panel">'
    + '<div class="cv-title-block">'
    + '<span class="cv-cal-label">A personalised garden calendar</span>'
    + '<div class="cv-name">' + esc(calendarName) + '</div>'
    + '<div class="cv-daterange">' + esc(dateRange) + (climate ? ' \u00b7 ' + esc(climate) : '') + '</div>'
    + '<div class="cv-gold-rule"></div>'
    + '</div>'
    + climateChartHtml
    + datesExplainHtml
    + msgHtml
    + provHtml
    + bottomHtml
    + '</div>'
    + '</div>';
}

// ── ICS generation ────────────────────────────────────────────────────────────
// Generates a data:text/calendar URI encoding an ICS calendar file.
// events: mixed array — each item either:
//   {label, date}              — single-day key date
//   {label, startDate, endDate} — multi-day holiday
// Labels truncated to 30 chars. Returns '' if events is empty.
function buildICS(events) {
  if (!events || !events.length) return '';
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Garden Calendar//EN',
  ];
  for (var i = 0; i < events.length; i++) {
    var ev  = events[i];
    var lbl = String(ev.label || '').slice(0, 30).replace(/[\r\n,;\\]/g, ' ');
    var uid = (i + 1) + '@gc';
    if (ev.date) {
      // Single-day key date with 1-week + on-day reminders
      lines.push('BEGIN:VEVENT', 'UID:' + uid,
        'DTSTART;VALUE=DATE:' + ev.date.replace(/-/g, ''),
        'SUMMARY:' + lbl,
        'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM',
        'BEGIN:VALARM', 'TRIGGER:PT0S', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM',
        'END:VEVENT');
    } else {
      // Multi-day holiday with 1-week + on-day (start) reminders
      lines.push('BEGIN:VEVENT', 'UID:' + uid,
        'DTSTART;VALUE=DATE:' + (ev.startDate || '').replace(/-/g, ''),
        'DTEND;VALUE=DATE:'   + _isoDatePlusOne(ev.endDate),
        'SUMMARY:' + lbl,
        'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM',
        'BEGIN:VALARM', 'TRIGGER:PT0S', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM',
        'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  // data: URI triggers full calendar file import on phone — all events at once
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
}

// Build combined ICS for one calendar month.
// Holidays STARTING in this calendar month only.
// Key dates are printed on the grid — no QR needed for them.
// Returns '' when no holiday starts this month (no QR rendered).
function buildMonthICS(monthIdx, year, keyDates, holidays) {
  var events = [];
  (holidays || []).forEach(function(h) {
    if (!h.startDate) return;
    var p = h.startDate.split('-');
    if (parseInt(p[0],10) === year && (parseInt(p[1],10)-1) === monthIdx)
      events.push(h);
  });
  return buildICS(events);
}

// Add one day to an ISO date string (YYYY-MM-DD) — pure arithmetic, no Date() timezone issues
function _isoDatePlusOne(isoStr) {
  if (!isoStr) return '';
  var p   = isoStr.split('-');
  var y   = parseInt(p[0], 10);
  var m   = parseInt(p[1], 10);
  var d   = parseInt(p[2], 10) + 1;
  var dim = new Date(y, m - 1 + (d > 28 ? 1 : 0), 0).getDate(); // days in month
  // Simple overflow
  var daysInM = [0,31,28,31,30,31,30,31,31,30,31,30,31];
  if (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) daysInM[2] = 29;
  if (d > daysInM[m]) { d = 1; m++; }
  if (m > 12)         { m = 1; y++; }
  return y + ('0'+m).slice(-2) + ('0'+d).slice(-2);
}
