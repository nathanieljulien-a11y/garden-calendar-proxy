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

// ── Page A: illustration left + commentary/tasks/inspo right ─────────────────
function buildPageA(opts) {
  var monthName     = opts.monthName;
  var monthIdx      = opts.monthIdx;
  var year          = opts.year;
  var plant         = opts.plant || '';
  var artworkB64    = opts.artworkB64 || '';
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

  // Climate bar — symbols + 2-line layout
  var climateHtml = '';
  if (climateData && climateData._cd) {
    var cd   = climateData._cd;
    var tMax = cd.tMax  && cd.tMax[monthIdx]  != null ? Math.round(cd.tMax[monthIdx])  + '\u00b0C' : null;
    var tMin = cd.tMin  && cd.tMin[monthIdx]  != null ? Math.round(cd.tMin[monthIdx])  + '\u00b0C' : null;
    var rain = cd.precip && cd.precip[monthIdx] != null ? Math.round(cd.precip[monthIdx]) + 'mm' : null;
    var sun  = cd.sunHrs && cd.sunHrs[monthIdx] != null ? parseFloat(cd.sunHrs[monthIdx]).toFixed(1) + ' hrs' : null;
    var line1Parts = [];
    var line2Parts = [];
    if (tMax) line1Parts.push('\uD83C\uDF21\uFE0F ' + tMax + ' high');
    if (tMin) line1Parts.push(tMin + ' low');
    if (rain) line2Parts.push('\uD83C\uDF27\uFE0F ' + rain + ' rain');
    if (sun)  line2Parts.push('\u2600\uFE0F ' + sun + ' sun/day');
    var line1 = line1Parts.join(' \u00b7 ');
    var line2 = line2Parts.join(' \u00b7 ');
    climateHtml = '<div class="climate-bar">'
      + '<div class="climate-region">' + esc(climate) + '</div>'
      + (line1 ? '<div class="climate-line">' + line1 + '</div>' : '')
      + (line2 ? '<div class="climate-line">' + line2 + '</div>' : '')
      + '</div>';
  } else if (climate) {
    climateHtml = '<div class="climate-bar"><div class="climate-region">' + esc(climate) + '</div></div>';
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
    bullets = bullets.slice(0, 5);
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

  // Footer: quote left + app QR right, side by side
  var footerHtml = '<div class="page-footer">'
    + '<div class="footer-quote-col">'
    + '<div class="quote-text">\u201c' + esc(quote.text) + '\u201d</div>'
    + '<div class="quote-attr">\u2014\u00a0' + esc(quote.author) + '</div>'
    + '</div>'
    + (appQrB64
        ? '<div class="footer-qr-col">'
          + '<img src="' + appQrB64 + '" width="52" height="52" alt="App QR"/>'
          + '<div class="qr-label">Your digital<br/>garden calendar</div>'
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
    + '<span class="artwork-credit">K\u00f6hler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Public Domain \u00b7 Digitised by Missouri Botanical Garden</span>'
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

  // Trailing empty cells with next month's day numbers (lighter colour)
  var total    = firstDow + daysInMonth;
  var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var t = 0; t < trailing; t++) {
    gridHtml += '<div class="cal-cell cal-empty"><div class="day-top-row"><span class="day-num day-num-other">' + (t + 1) + '</span></div></div>';
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
// @page size = full pasteable area: 271.42mm × 393.14mm (no bleeds)
// Page A: 271.42mm × 191.57mm
// Gap:    10mm white
// Page B: 271.42mm × 191.57mm
// Total:  393.14mm ✓

var SHARED_CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap');",
  ':root{--ink:#2C1A0A;--gold:#8B6914;--sage:#5A7A32;--cream:#F0EBE0;--parchment:#FDFAF4;--rust:#8A3A10;--muted:#7A5C2A;--border:rgba(139,105,20,0.22);}',
  'body{font-family:"Crimson Pro",Georgia,serif;color:var(--ink);background:white;margin:0;padding:0;}',

  // Dimensions: content 271.42 × 393.14mm + 4mm bleed each side = 279.42 × 401.14mm
  // Each half-page: 279.42mm wide × 195.57mm tall  (401.14 - 10mm gap) / 2
  // Blank full-sheet: 279.42mm × 401.14mm
  '.cal-page{width:279.42mm;height:195.57mm;position:relative;overflow:hidden;background:var(--parchment);display:block;margin:0;padding:0;}',
  '.cal-blank{width:279.42mm;height:401.14mm;background:white;page-break-after:always;margin:0;padding:0;}',

  // 10mm white gap between page-a and page-b
  '.page-a{margin-bottom:10mm;}',
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
  '.climate-bar{display:flex;flex-direction:column;gap:1mm;padding:1.5mm 2.5mm;background:rgba(139,105,20,0.06);border-left:0.8mm solid var(--gold);flex-shrink:0;} .climate-line{font-size:7pt;color:var(--ink);}',
  '.climate-region{font-size:6.5pt;font-style:italic;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;}',
  // .climate-stats removed — replaced by .climate-line in the new 2-line layout,

  // Section label (shared)
  '.section-label{font-family:"Playfair Display",serif;font-size:6.5pt;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);margin-bottom:2mm;display:block;}',

  // Plant commentary box
  '.plant-box{flex-shrink:0;}',
  '.plant-bullets{list-style:none;padding:0;margin:0;}',
  '.plant-bullets li{font-size:9.5pt;line-height:1.6;color:var(--ink);padding-left:3.5mm;position:relative;margin-bottom:2mm;}',
  '.plant-bullets li::before{content:"\u2022";position:absolute;left:0;color:var(--gold);}',

  // Garden tasks box
  '.tasks-box{flex-shrink:0;}',
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
  '.page-footer{border-top:0.3mm solid var(--border);padding-top:2mm;flex-shrink:0;display:flex;align-items:flex-start;gap:3mm;}',
  '.footer-quote-col{flex:1;min-width:0;}',
  '.quote-text{font-family:"Playfair Display",serif;font-style:italic;font-size:7pt;line-height:1.5;color:var(--ink);margin-bottom:0.8mm;}',
  '.quote-attr{font-size:6pt;color:var(--muted);}',
  '.footer-qr-col{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:1mm;}',
  '.footer-qr-col img{border:0.3mm solid var(--border);border-radius:1mm;padding:0.5mm;background:white;}',
  '.qr-label{font-size:5pt;color:var(--muted);line-height:1.3;text-align:center;}',

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
  '.cal-footer-text{font-size:5.5pt;color:var(--muted);opacity:0.6;letter-spacing:0.04em;}',
  '.cal-footer-climate{font-size:5.5pt;color:var(--muted);font-style:italic;opacity:0.7;}',
].join('\n');

// ── Full HTML document ────────────────────────────────────────────────────────
// @page: content (271.42 × 393.14mm) + 4mm bleed each side = 279.42 × 401.14mm
function buildDocument(pages) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>\n'
    + '* { box-sizing:border-box; margin:0; padding:0; }\n'
    + '@page { size:279.42mm 401.14mm; margin:0; }\n'
    + 'html,body { width:279.42mm; margin:0; padding:0; background:white; }\n'
    + SHARED_CSS + '\n'
    + '</style></head><body>\n'
    + pages.join('\n')
    + '\n</body></html>';
}

module.exports = {
  buildPageA:         buildPageA,
  buildPageB:         buildPageB,
  buildBlankPage:     buildBlankPage,
  buildDocument:      buildDocument,
  setPlantCommentary: setPlantCommentary,
  getCommentary:      getCommentary,
  SHARED_CSS:         SHARED_CSS,
  MONTH_NAMES:        MONTH_NAMES,
};
