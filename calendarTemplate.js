// calendarTemplate.js (CommonJS)
// Supports two Gelato print formats via opts.format:
//   'a3'  → Standard Wall Calendar A3 portrait  (305×428mm with bleed)
//   'a4'  → Wire-O Horizontal Calendar A4 landscape (305×218mm with bleed)
//
// Page structure per format (14 pages total):
//   Page  1: blank cover
//   Pages 2-13: 12 month pages (one per month)
//   Page 14: blank back
//
// Each month page layout:
//   ┌─────────────────────────────────────┐
//   │  BLEED TOP (4mm)                    │
//   │  BINDING SAFE ZONE (extra 8mm)      │  ← 12mm from trim = 16mm from bleed
//   ├────────────────┬────────────────────┤
//   │                │  weather bar       │
//   │  illustration  │  monthly tasks     │  TOP 50%
//   │                │  plant notes       │
//   │                │  inspo garden      │
//   ├────────────────┴────────────────────┤
//   │  Mon Tue Wed Thu Fri Sat Sun        │
//   │  calendar grid fills bottom half    │  BOTTOM 50%
//   │  key dates · holidays highlighted   │
//   ├─────────────────────────────────────┤
//   │  footer (attribution · QR · branding│
//   │  BLEED BOTTOM (4mm)                 │
//   └─────────────────────────────────────┘

var fs   = require('fs');
var path = require('path');

var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

var DAY_NAMES_MON = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; // Mon-first

var QUOTES = [
  { text: 'To forget how to dig the earth and tend the soil is to forget ourselves.', author: 'Mahatma Gandhi' },
  { text: 'A garden is a grand teacher. It teaches patience and careful watchfulness; it teaches industry and thrift.', author: 'Gertrude Jekyll, 1900' },
  { text: "The kiss of the sun for pardon, the song of the birds for mirth \u2014 one is nearer God\u2019s heart in a garden than anywhere else on earth.", author: 'Dorothy Frances Gurney, 1913' },
  { text: 'God Almighty first planted a garden; and indeed it is the purest of human pleasures.', author: 'Francis Bacon, 1625' },
  { text: 'A garden must be looked into and dressed as the body.', author: 'George Herbert, 1640' },
  { text: 'Who loves a garden still his Eden keeps, perennial pleasures plants, and wholesome harvests reaps.', author: 'Amos Bronson Alcott' },
  { text: "The garden is the poor man\u2019s apothecary.", author: 'German proverb' },
  { text: 'He who plants a garden plants happiness.', author: 'Chinese proverb' },
  { text: 'A garden is not made in a year; indeed it is never made in the sense of being finished.', author: 'H. H. Thomas, 1912' },
  { text: 'All gardening is landscape painting.', author: 'Alexander Pope, c.\u200a1720' },
  { text: 'The best place to find God is in a garden. You can dig for him there.', author: 'George Bernard Shaw' },
  { text: 'The glory of gardening: hands in the dirt, head in the sun, heart with nature.', author: 'Alfred Austin, 1894' },
];

// ── Format configs ─────────────────────────────────────────────────────────────
var FORMATS = {
  a3: {
    label:      'A3 Portrait',
    widthMm:    305,   // with 4mm bleed
    heightMm:   428,
    bleedMm:    4,
    topSafeMm:  16,    // 4mm bleed + 12mm binding = 16mm from edge
    sideSafeMm: 8,     // 4mm bleed + 4mm safe
    botSafeMm:  8,
  },
  a4: {
    label:      'A4 Landscape',
    widthMm:    305,   // with 4mm bleed (297+4+4)
    heightMm:   218,
    bleedMm:    4,
    topSafeMm:  16,
    sideSafeMm: 8,
    botSafeMm:  8,
  },
};

// ── Artwork source lookup ──────────────────────────────────────────────────────
var ARTWORK_SOURCE = {
  // Köhler's Medizinal-Pflanzen (1887-1898) — public domain
  'rose':        { plate: '122', name: 'Rosa centifolia',          source: 'kohler' },
  'lavender':    { plate: '087', name: 'Lavandula angustifolia',   source: 'kohler' },
  'foxglove':    { plate: '053', name: 'Digitalis purpurea',       source: 'kohler' },
  'lemon':       { plate: '041', name: 'Citrus \u00d7 limon',     source: 'kohler' },
  'cherry':      { plate: '113', name: 'Prunus cerasus',           source: 'kohler' },
  'raspberry':   { plate: '124', name: 'Rubus idaeus',             source: 'kohler' },
  'sage':        { plate: '126', name: 'Salvia officinalis',       source: 'kohler' },
  'elderflower': { plate: '127', name: 'Sambucus nigra',           source: 'kohler' },
  'valerian':    { plate: '143', name: 'Valeriana officinalis',    source: 'kohler' },
  'fennel':      { plate: '148', name: 'Foeniculum vulgare',       source: 'kohler' },
  'grape':       { plate: '145', name: 'Vitis vinifera',           source: 'kohler' },
  'quince':      { plate: '049', name: 'Cydonia oblonga',          source: 'kohler' },
  'thyme':       { plate: '271', name: 'Thymus vulgaris',          source: 'kohler' },
  'mint':        { plate: '095', name: 'Mentha \u00d7 piperita',  source: 'kohler' },
  'olive':       { plate: '229', name: 'Olea europaea',            source: 'kohler' },
  'rosemary':    { plate: '258', name: 'Rosmarinus officinalis',   source: 'kohler' },
  'iris':        { plate: '079', name: 'Iris pallida',             source: 'kohler' },
  // USDA Pomological Watercolor Collection (1886-1942) — public domain
  'fig':         { plate: 'POM00001044', name: 'Ficus carica',             source: 'usda' },
  'peach':       { plate: 'POM00001895', name: 'Prunus persica',           source: 'usda' },
  'strawberry':  { plate: 'POM00001148', name: 'Fragaria \u00d7 ananassa', source: 'usda' },
  'apricot':     { plate: 'POM00001788', name: 'Prunus armeniaca',         source: 'usda' },
  'almond':      { plate: 'POM00001053', name: 'Prunus dulcis',            source: 'usda' },
  'mulberry':    { plate: 'POM00001117', name: 'Morus nigra',              source: 'usda' },
};

// ── Plant commentary (loaded from disk) ───────────────────────────────────────
var _plantCommentary = {};
var _gardenPhotoManifest = {};
var _artworkDir = '';

function init(options) {
  options = options || {};
  _artworkDir = options.artworkDir || path.join(__dirname, 'artwork');

  // Load plant commentary
  try {
    var cp = options.commentaryPath || path.join(__dirname, 'data', 'plantCommentary.json');
    _plantCommentary = JSON.parse(fs.readFileSync(cp, 'utf8'));
    console.log('[tpl] plantCommentary loaded:', Object.keys(_plantCommentary).length, 'plants');
  } catch(e) {
    console.warn('[tpl] plantCommentary not found:', e.message);
  }

  // Load garden photo manifest
  try {
    var mp = options.manifestPath || path.join(__dirname, 'garden-photos', 'manifest.json');
    _gardenPhotoManifest = JSON.parse(fs.readFileSync(mp, 'utf8'));
    console.log('[tpl] Garden photo manifest loaded:', Object.keys(_gardenPhotoManifest).length, 'gardens');
  } catch(e) {
    console.warn('[tpl] Garden photo manifest not found:', e.message);
  }
}

function setPlantCommentary(data) { _plantCommentary = data || {}; }
function setGardenManifest(data)  { _gardenPhotoManifest = data || {}; }

function getArtworkB64(plant) {
  if (!plant || !_artworkDir) return null;
  var fname = path.join(_artworkDir, plant.toLowerCase() + '.jpg');
  try {
    if (!fs.existsSync(fname)) return null;
    return 'data:image/jpeg;base64,' + fs.readFileSync(fname).toString('base64');
  } catch(e) { return null; }
}

function getGardenPhotoB64(gardenName) {
  if (!gardenName) return null;
  var fname = _gardenPhotoManifest[gardenName];
  if (!fname) return null;
  var fpath = path.join(__dirname, 'garden-photos', fname);
  try {
    if (!fs.existsSync(fpath)) return null;
    return 'data:image/jpeg;base64,' + fs.readFileSync(fpath).toString('base64');
  } catch(e) { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

// Returns 0=Mon … 6=Sun for first day of month
function getFirstDowMon(year, month) {
  var d = new Date(year, month, 1).getDay(); // 0=Sun
  return (d + 6) % 7; // convert to Mon=0
}

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Blank page ────────────────────────────────────────────────────────────────
function buildBlankPage(fmt) {
  var f = FORMATS[fmt] || FORMATS.a3;
  return '<div class="cal-page cal-blank" style="width:' + f.widthMm + 'mm;height:' + f.heightMm + 'mm;"></div>';
}

// ── Month page ────────────────────────────────────────────────────────────────
function buildMonthPage(opts) {
  var fmt         = opts.format || 'a3';
  var f           = FORMATS[fmt] || FORMATS.a3;
  var monthName   = opts.monthName;
  var monthIdx    = opts.monthIdx;
  var year        = opts.year;
  var plant       = opts.plant || '';
  var artworkB64  = opts.artworkB64 || getArtworkB64(plant) || '';
  var inspo       = opts.inspo || null;
  var inspoPhotoB64 = opts.inspoPhotoB64 || (inspo && inspo.name ? getGardenPhotoB64(inspo.name) : null);
  var inspoQrB64  = opts.inspoQrB64 || '';
  var appQrB64    = opts.appQrB64 || '';
  var climateData = opts.climateData || null;
  var climate     = opts.climate || '';
  var recipientName = opts.recipientName || '';
  var keyDates    = opts.keyDates || [];
  var holidays    = opts.holidays || [];

  var plantDisplay = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : monthName;
  var commentary   = _plantCommentary[plant.toLowerCase()] || {};
  var quote        = QUOTES[monthIdx % QUOTES.length];
  var source       = ARTWORK_SOURCE[plant.toLowerCase()];

  // Climate stats
  var cd = climateData && climateData._cd;
  var tMax  = cd && cd.tMax  && Array.isArray(cd.tMax)  && cd.tMax[monthIdx]  != null ? Math.round(cd.tMax[monthIdx])  + '\u00b0C' : null;
  var tMin  = cd && cd.tMin  && Array.isArray(cd.tMin)  && cd.tMin[monthIdx]  != null ? Math.round(cd.tMin[monthIdx])  + '\u00b0C' : null;
  var rain  = cd && cd.precip && Array.isArray(cd.precip) && cd.precip[monthIdx] != null ? Math.round(cd.precip[monthIdx]) + 'mm' : null;
  var sun   = cd && cd.sunHrs && Array.isArray(cd.sunHrs) && cd.sunHrs[monthIdx] != null ? parseFloat(cd.sunHrs[monthIdx]).toFixed(1) + ' hrs/day' : null;
  var wxStats = [
    tMax  ? 'High\u00a0' + tMax  : '',
    tMin  ? 'Low\u00a0'  + tMin  : '',
    rain  ? rain + '\u00a0rain'  : '',
    sun   || '',
  ].filter(Boolean).join('\u00a0\u00b7\u00a0');

  // Attribution line
  var sourceLine = '', sourceSub = '';
  if (source && source.source === 'usda') {
    sourceLine = esc(source.name) + '\u00a0\u00b7\u00a0USDA Pomological Watercolor\u00a0' + source.plate;
    sourceSub  = 'Public domain\u00a0\u00b7\u00a0U.S. National Agricultural Library\u00a0\u00b7\u00a0Wikimedia Commons';
  } else if (source) {
    sourceLine = esc(source.name) + '\u00a0\u00b7\u00a0K\u00f6hler\u2019s Medizinal-Pflanzen\u00a0\u00b7\u00a0Plate\u00a0' + source.plate;
    sourceSub  = 'Public domain\u00a0\u00b7\u00a0Digitised by Missouri Botanical Garden\u00a0\u00b7\u00a0Wikimedia Commons';
  } else {
    sourceLine = esc(plantDisplay) + '\u00a0\u00b7\u00a0Botanical illustration';
    sourceSub  = 'Public domain';
  }

  // ── Build calendar grid cells ─────────────────────────────────────────────
  // Key date map
  var keyDateMap = {};
  for (var i = 0; i < keyDates.length; i++) {
    var kd = keyDates[i];
    var parts = (kd.date || '').split('-');
    var kday = parseInt(parts[2], 10);
    if (kday) {
      if (!keyDateMap[kday]) keyDateMap[kday] = [];
      keyDateMap[kday].push(kd.label || '');
    }
  }

  // Holiday day map (string-parse to avoid timezone issues)
  var daysInMonth = getDaysInMonth(year, monthIdx);
  var holDays = {}, holLabel = {};
  for (var h = 0; h < holidays.length; h++) {
    var hol = holidays[h];
    var sp = (hol.startDate || '').split('-');
    var ep = (hol.endDate   || '').split('-');
    var sy = parseInt(sp[0],10), sm = parseInt(sp[1],10)-1, sd = parseInt(sp[2],10);
    var ey = parseInt(ep[0],10), em = parseInt(ep[1],10)-1, ed = parseInt(ep[2],10);
    for (var d2 = 1; d2 <= daysInMonth; d2++) {
      var before = (sy < year) || (sy===year && sm < monthIdx) || (sy===year && sm===monthIdx && sd <= d2);
      var after  = (ey > year) || (ey===year && em > monthIdx) || (ey===year && em===monthIdx && ed >= d2);
      if (before && after) {
        holDays[d2] = true;
        if (!holLabel[d2] && ((sy<year)||(sy===year&&sm<monthIdx)||(sy===year&&sm===monthIdx&&sd===d2))) {
          holLabel[d2] = hol.label || 'Holiday';
        }
      }
    }
  }

  var firstDow = getFirstDowMon(year, monthIdx);
  var gridCells = '';

  // Day header row
  for (var dn = 0; dn < 7; dn++) {
    var isSatSun = dn >= 5;
    gridCells += '<div class="cal-dow' + (isSatSun ? ' cal-weekend-hdr' : '') + '">' + DAY_NAMES_MON[dn] + '</div>';
  }
  // Leading blanks
  for (var e = 0; e < firstDow; e++) {
    gridCells += '<div class="cal-cell cal-empty"></div>';
  }
  // Days
  for (var d = 1; d <= daysInMonth; d++) {
    var col = (firstDow + d - 1) % 7;
    var isWeekend = col >= 5;
    var isHol   = !!holDays[d];
    var isHolS  = holLabel[d] !== undefined;
    var kdList  = keyDateMap[d] || [];
    var cls = 'cal-cell';
    if (isWeekend) cls += ' cal-weekend';
    if (isHol)     cls += ' cal-holiday';
    if (kdList.length) cls += ' cal-event';

    var inner = '<span class="day-num">' + d + '</span>';
    if (isHolS) inner += '<span class="hol-label">' + esc(holLabel[d]) + '</span>';
    for (var k = 0; k < kdList.length; k++) {
      inner += '<span class="event-label">' + esc(kdList[k]) + '</span>';
    }
    gridCells += '<div class="' + cls + '">' + inner + '</div>';
  }
  // Trailing blanks to complete last row
  var total = firstDow + daysInMonth;
  var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var t = 0; t < trailing; t++) {
    gridCells += '<div class="cal-cell cal-empty"></div>';
  }

  // ── Inspo block ───────────────────────────────────────────────────────────
  var inspoHtml = '';
  if (inspo && inspo.name) {
    inspoHtml  = '<div class="inspo-block">';
    inspoHtml += '<div class="section-label">Garden to visit this ' + esc(monthName) + '</div>';
    if (inspoPhotoB64) {
      inspoHtml += '<div class="inspo-photo"><img src="' + inspoPhotoB64 + '" alt="' + esc(inspo.name) + '"/></div>';
    }
    inspoHtml += '<div class="inspo-name">' + esc(inspo.name) + '</div>';
    if (inspo.location) inspoHtml += '<div class="inspo-loc">' + esc(inspo.location) + '</div>';
    if (inspo.highlight) inspoHtml += '<div class="inspo-highlight">' + esc(inspo.highlight) + '</div>';
    if (inspoQrB64) {
      inspoHtml += '<div class="inspo-qr-row">'
        + '<img src="' + inspoQrB64 + '" width="44" height="44" alt="Search"/>'
        + '<span class="inspo-qr-lbl">Search &#x2197;</span>'
        + '</div>';
    }
    inspoHtml += '</div>';
  }

  // ── Monthly tasks ─────────────────────────────────────────────────────────
  var MONTHLY_TASKS = {
    0:  'January: plan the year ahead. Order seeds and bare-root plants. Prune apple and pear trees on dry days. Force rhubarb under upturned pots. Protect brassicas from pigeons.',
    1:  'February: sow sweet peas and broad beans under glass. Chit seed potatoes in a light frost-free spot. Feed garden birds as wild food runs low. Prune late-flowering clematis hard.',
    2:  'March: start hardening off tender seedlings. Sow tomatoes, peppers, and aubergines under glass. Divide snowdrops just as the leaves fade. Feed roses and shrubs with a balanced fertiliser.',
    3:  'April: plant out onion sets and early potatoes. Stake delphiniums and lupins before they grow too tall. Sow courgettes and cucumbers under cover. Dead-head spring bulbs but leave foliage to die back.',
    4:  'May: direct-sow salad, beetroot, and carrots outdoors. Pinch out sweet pea side-shoots. Watch for aphid colonies on roses and deal promptly. Plant out bedding once all frost risk has passed.',
    5:  'June: harvest strawberries and remove runners. Sow French beans and courgettes direct. Mow lawns regularly and water in dry spells. Feed tomatoes weekly with high-potash fertiliser.',
    6:  'July: harvest courgettes before they become marrows. Pinch out tomato side-shoots. Sow spring cabbages. Prune wisteria laterals to five leaves. Water containers daily in hot weather.',
    7:  'August: take semi-ripe cuttings of tender perennials. Collect seed from annual flowers. Harvest and dry herbs before the first frosts. Order spring bulbs for planting in autumn.',
    8:  'September: plant spring bulbs — tulips, alliums, narcissi. Harvest and store root vegetables. Take hardwood cuttings. Sow hardy annuals for early spring colour.',
    9:  'October: lift dahlias, cannas, and gladioli corms for winter storage. Plant garlic. Mulch beds with well-rotted compost. Rake fallen leaves for leaf mould.',
    10: 'November: plant bare-root roses, trees, and hedging. Insulate outdoor containers. Clear annual beds and add compost. Check stakes and ties are secure before winter storms.',
    11: 'December: clean and oil garden tools. Check stored bulbs and corms for rot. Order seed catalogues. Plan next year\u2019s planting on paper while the garden rests.',
  };

  var tasksText = MONTHLY_TASKS[monthIdx] || '';

  // ── Commentary bullets ────────────────────────────────────────────────────
  var bullets = [];
  if (commentary.habit)       bullets.push(commentary.habit);
  if (commentary.flowers)     bullets.push(commentary.flowers);
  if (commentary.conditions)  bullets.push(commentary.conditions);
  if (commentary.care)        bullets.push(commentary.care);
  if (commentary.facts && commentary.facts.length) bullets.push(commentary.facts[0]);

  var commHtml = bullets.map(function(b) {
    return '<p class="comm-bullet">' + esc(b) + '</p>';
  }).join('');

  // ── QR row ────────────────────────────────────────────────────────────────
  var appQrHtml = appQrB64
    ? '<div class="app-qr-row"><img src="' + appQrB64 + '" width="40" height="40" alt="app"/>'
      + '<span class="app-qr-lbl">Your digital<br/>garden calendar</span></div>'
    : '';

  // ── Assemble ──────────────────────────────────────────────────────────────
  var ts = f.topSafeMm, ss = f.sideSafeMm, bs = f.botSafeMm;

  return '<div class="cal-page" style="width:' + f.widthMm + 'mm;height:' + f.heightMm + 'mm;">'

    // ── TOP HALF ──
    + '<div class="top-half" style="'
    +   'position:absolute;'
    +   'top:' + ts + 'mm;'
    +   'left:' + ss + 'mm;'
    +   'right:' + ss + 'mm;'
    +   'height:calc(50% - ' + ts + 'mm + ' + (f.heightMm/2 - ts) + 'mm - ' + (f.heightMm/2) + 'mm);'
    + '">'

    // We use a flex row: illustration left (~40%) | right panel (~60%)
    + '<div class="top-inner">'

    // Illustration column
    + '<div class="col-illus">'
    + (artworkB64
        ? '<img class="artwork-img" src="' + artworkB64 + '" alt="' + esc(plantDisplay) + ' botanical illustration"/>'
        : '<div class="artwork-ph"><span>' + esc(plantDisplay) + '</span></div>')
    + '<div class="artwork-footer">'
    + '<span class="artwork-name">' + esc(plantDisplay) + '</span>'
    + '<span class="artwork-credit">' + sourceLine + '</span>'
    + '</div>'
    + '</div>'

    // Right panel
    + '<div class="col-right">'

    // Header
    + '<div class="page-header">'
    + '<div class="hdr-month">' + esc(monthName) + '\u00a0' + year + '</div>'
    + (recipientName ? '<div class="hdr-recipient">' + esc(recipientName) + '\u2019s Garden Calendar</div>' : '')
    + '</div>'

    // Weather bar
    + (wxStats ? '<div class="wx-bar">'
      + '<span class="wx-region">' + esc(climate) + '</span>'
      + '<span class="wx-stats">' + wxStats + '</span>'
      + '</div>' : '')

    // Monthly tasks
    + '<div class="tasks-section">'
    + '<div class="section-label">This month in the garden</div>'
    + '<p class="tasks-text">' + esc(tasksText) + '</p>'
    + '</div>'

    // Plant commentary
    + (commHtml ? '<div class="comm-section">'
      + '<div class="section-label">' + esc(plantDisplay) + '</div>'
      + commHtml
      + '</div>' : '')

    // Inspo garden
    + inspoHtml

    // Footer: quote + QR
    + '<div class="right-footer">'
    + '<div class="quote-block">'
    + '<span class="quote-text">\u201c' + esc(quote.text) + '\u201d</span>'
    + '<span class="quote-attr">\u2014\u00a0' + esc(quote.author) + '</span>'
    + '</div>'
    + appQrHtml
    + '</div>'

    + '</div>' // col-right
    + '</div>' // top-inner
    + '</div>' // top-half

    // ── BOTTOM HALF ──
    + '<div class="bot-half" style="'
    +   'position:absolute;'
    +   'top:50%;'
    +   'left:' + ss + 'mm;'
    +   'right:' + ss + 'mm;'
    +   'bottom:' + bs + 'mm;'
    + '">'

    + '<div class="cal-grid">' + gridCells + '</div>'

    + '<div class="cal-footer">'
    + '<span class="footer-brand">The Garden Calendar</span>'
    + '<span class="footer-source">' + sourceSub + '</span>'
    + '</div>'

    + '</div>' // bot-half

    + '</div>'; // cal-page
}

// ── Shared CSS ────────────────────────────────────────────────────────────────
function buildSharedCSS(fmt) {
  var f = FORMATS[fmt] || FORMATS.a3;
  var ts = f.topSafeMm, ss = f.sideSafeMm, bs = f.botSafeMm;

  // Top-half content height in mm (from topSafe to 50%)
  var topContentH = (f.heightMm / 2) - ts;
  // Bot-half content height in mm (from 50% to botSafe from bottom)
  var botContentH = (f.heightMm / 2) - bs;

  // Illustration column width as fraction of top half
  var illusW = 38; // %
  var rightW = 100 - illusW;

  // Font sizes scaled to format
  var scale = fmt === 'a4' ? 0.72 : 1.0;
  function pt(n) { return (n * scale).toFixed(1) + 'pt'; }
  function mm(n) { return (n * scale).toFixed(1) + 'mm'; }

  return [
    "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap');",
    ':root{',
    '  --ink:#2C1A0A;--gold:#8B6914;--sage:#5A7A32;--cream:#F0EBE0;',
    '  --parchment:#FDFAF4;--rust:#8A3A10;--muted:#7A5C2A;',
    '  --border:rgba(139,105,20,0.22);',
    '}',
    'body{font-family:"Crimson Pro",Georgia,serif;color:var(--ink);background:white;margin:0;padding:0;}',

    // Page container
    '.cal-page{position:relative;overflow:hidden;background:var(--parchment);page-break-after:always;page-break-inside:avoid;box-sizing:border-box;}',
    '.cal-blank{background:var(--parchment);}',

    // Top half inner layout
    '.top-half{box-sizing:border-box;overflow:hidden;}',
    '.top-inner{display:flex;height:' + topContentH + 'mm;gap:0;}',

    // Illustration column
    '.col-illus{width:' + illusW + '%;flex-shrink:0;display:flex;flex-direction:column;border-right:0.4mm solid var(--border);background:#F7F2E8;overflow:hidden;}',
    '.artwork-img{flex:1;width:100%;min-height:0;object-fit:contain;display:block;filter:sepia(5%) contrast(1.06);}',
    '.artwork-ph{flex:1;display:flex;align-items:center;justify-content:center;background:#F0EBE0;}',
    '.artwork-ph span{font-family:"Playfair Display",serif;font-style:italic;font-size:' + pt(16) + ';color:var(--muted);opacity:0.5;}',
    '.artwork-footer{flex-shrink:0;padding:' + mm(1.5) + ' ' + mm(2.5) + ';background:rgba(240,235,224,0.95);border-top:0.3mm solid var(--border);display:flex;flex-direction:column;gap:0.5mm;}',
    '.artwork-name{font-family:"Playfair Display",serif;font-style:italic;font-size:' + pt(8) + ';color:var(--ink);}',
    '.artwork-credit{font-size:' + pt(6) + ';color:var(--muted);opacity:0.6;}',

    // Right panel
    '.col-right{flex:1;min-width:0;display:flex;flex-direction:column;padding:' + mm(2.5) + ' ' + mm(3) + ';gap:' + mm(1.5) + ';overflow:hidden;}',

    // Page header
    '.page-header{flex-shrink:0;border-bottom:0.4mm solid var(--gold);padding-bottom:' + mm(1.5) + ';}',
    '.hdr-month{font-family:"Playfair Display",serif;font-size:' + pt(16) + ';font-weight:600;color:var(--ink);}',
    '.hdr-recipient{font-size:' + pt(7.5) + ';color:var(--muted);letter-spacing:0.05em;margin-top:' + mm(0.5) + ';}',

    // Weather bar
    '.wx-bar{flex-shrink:0;display:flex;justify-content:space-between;align-items:baseline;padding:' + mm(1) + ' ' + mm(2) + ';background:rgba(139,105,20,0.05);border-left:0.7mm solid var(--gold);}',
    '.wx-region{font-size:' + pt(7.5) + ';font-style:italic;color:var(--muted);}',
    '.wx-stats{font-size:' + pt(7) + ';color:var(--ink);}',

    // Sections
    '.section-label{font-family:"Playfair Display",serif;font-size:' + pt(7) + ';text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);display:block;margin-bottom:' + mm(0.8) + ';}',
    '.tasks-section{flex-shrink:0;}',
    '.tasks-text{font-size:' + pt(8) + ';line-height:1.45;color:var(--ink);}',
    '.comm-section{flex-shrink:0;}',
    '.comm-bullet{font-size:' + pt(7.5) + ';line-height:1.45;color:var(--ink);margin-bottom:' + mm(0.5) + ';}',

    // Inspo block
    '.inspo-block{flex-shrink:0;padding:' + mm(1.5) + ' ' + mm(2) + ';background:rgba(139,105,20,0.04);border-left:0.7mm solid var(--gold);}',
    '.inspo-photo{width:100%;height:' + (fmt === 'a4' ? mm(18) : mm(30)) + ';overflow:hidden;margin-bottom:' + mm(1) + ';}',
    '.inspo-photo img{width:100%;height:100%;object-fit:cover;filter:sepia(8%) contrast(1.04);}',
    '.inspo-name{font-family:"Playfair Display",serif;font-size:' + pt(9) + ';font-weight:600;color:var(--ink);}',
    '.inspo-loc{font-size:' + pt(7.5) + ';color:var(--muted);margin-top:' + mm(0.4) + ';}',
    '.inspo-highlight{font-size:' + pt(7.5) + ';line-height:1.4;color:var(--ink);margin-top:' + mm(0.6) + ';}',
    '.inspo-qr-row{display:flex;align-items:center;gap:' + mm(2) + ';margin-top:' + mm(1) + ';}',
    '.inspo-qr-row img{border:0.3mm solid var(--border);border-radius:1mm;padding:1mm;background:white;}',
    '.inspo-qr-lbl{font-size:' + pt(7) + ';color:var(--muted);font-style:italic;}',

    // Right footer
    '.right-footer{margin-top:auto;border-top:0.3mm solid var(--border);padding-top:' + mm(1.5) + ';display:flex;align-items:flex-end;justify-content:space-between;flex-shrink:0;}',
    '.quote-block{flex:1;min-width:0;}',
    '.quote-text{display:block;font-family:"Playfair Display",serif;font-style:italic;font-size:' + pt(7.5) + ';line-height:1.5;color:var(--ink);}',
    '.quote-attr{display:block;font-size:' + pt(7) + ';color:var(--muted);margin-top:' + mm(0.5) + ';}',
    '.app-qr-row{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:' + mm(0.8) + ';margin-left:' + mm(2) + ';}',
    '.app-qr-row img{border:0.3mm solid var(--border);border-radius:1mm;padding:1mm;background:white;}',
    '.app-qr-lbl{font-size:' + pt(6) + ';color:var(--muted);text-align:center;line-height:1.3;}',

    // Bottom half
    '.bot-half{box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;}',

    // Calendar grid
    '.cal-grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:auto;align-content:start;border-left:0.3mm solid var(--border);border-top:0.3mm solid var(--border);}',
    '.cal-dow{font-size:' + pt(7) + ';text-align:center;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;padding:' + mm(1) + ';border-right:0.3mm solid var(--border);border-bottom:0.4mm solid var(--gold);background:rgba(139,105,20,0.04);}',
    '.cal-weekend-hdr{color:var(--rust);opacity:0.8;}',
    '.cal-cell{padding:' + mm(1.2) + ' ' + mm(1.5) + ';border-right:0.3mm solid var(--border);border-bottom:0.3mm solid var(--border);display:flex;flex-direction:column;gap:' + mm(0.5) + ';overflow:hidden;}',
    '.cal-empty{background:rgba(0,0,0,0.012);}',
    '.cal-weekend{background:rgba(139,105,20,0.03);}',
    '.cal-holiday{background:rgba(90,122,50,0.08);}',
    '.cal-event{background:rgba(139,105,20,0.06);}',
    '.day-num{font-size:' + pt(11) + ';font-weight:500;color:var(--ink);line-height:1;}',
    '.cal-weekend .day-num{color:var(--rust);}',
    '.cal-holiday .day-num{color:var(--sage);}',
    '.cal-event .day-num{color:var(--gold);}',
    '.hol-label{font-size:' + pt(6.5) + ';color:var(--sage);font-style:italic;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.event-label{font-size:' + pt(7) + ';color:var(--rust);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',

    // Calendar footer
    '.cal-footer{flex-shrink:0;display:flex;justify-content:space-between;align-items:center;padding:' + mm(1) + ' ' + mm(1.5) + ';border-top:0.3mm solid var(--border);}',
    '.footer-brand{font-family:"Playfair Display",serif;font-size:' + pt(7) + ';font-style:italic;color:var(--gold);}',
    '.footer-source{font-size:' + pt(5.5) + ';color:var(--muted);opacity:0.55;}',
  ].join('\n');
}

// ── Full HTML document ────────────────────────────────────────────────────────
function buildDocument(pages, fmt) {
  var f = FORMATS[fmt] || FORMATS.a3;
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>\n'
    + '* { box-sizing:border-box; margin:0; padding:0; }\n'
    + '@page { size:' + f.widthMm + 'mm ' + f.heightMm + 'mm; margin:0; }\n'
    + 'html,body { width:' + f.widthMm + 'mm; margin:0; padding:0; }\n'
    + buildSharedCSS(fmt) + '\n'
    + '</style></head><body>\n'
    + pages.join('\n')
    + '\n</body></html>';
}

module.exports = {
  init:               init,
  setPlantCommentary: setPlantCommentary,
  setGardenManifest:  setGardenManifest,
  getArtworkB64:      getArtworkB64,
  getGardenPhotoB64:  getGardenPhotoB64,
  buildBlankPage:     buildBlankPage,
  buildMonthPage:     buildMonthPage,
  buildDocument:      buildDocument,
  FORMATS:            FORMATS,
};
