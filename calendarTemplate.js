// calendarTemplate.js — Garden Calendar page templates (CommonJS)
// Two pages per month:
//   Page A: botanical artwork (full-bleed left) + plant commentary right
//   Page B: full-page calendar grid with key dates and holidays

var DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

var QUOTES = [
  { text: 'To forget how to dig the earth and tend the soil is to forget ourselves.', author: 'Mahatma Gandhi' },
  { text: 'A garden is a grand teacher. It teaches patience and careful watchfulness; it teaches industry and thrift.', author: 'Gertrude Jekyll, Home and Garden, 1900' },
  { text: "The kiss of the sun for pardon, the song of the birds for mirth — one is nearer God's heart in a garden than anywhere else on earth.", author: 'Dorothy Frances Gurney, 1913' },
  { text: 'God Almighty first planted a garden; and indeed it is the purest of human pleasures.', author: 'Francis Bacon, Essays, 1625' },
  { text: 'A garden must be looked into and dressed as the body.', author: 'George Herbert, Outlandish Proverbs, 1640' },
  { text: 'Who loves a garden still his Eden keeps, perennial pleasures plants, and wholesome harvests reaps.', author: 'Amos Bronson Alcott, 1868' },
  { text: "The garden is the poor man's apothecary.", author: 'German proverb' },
  { text: 'He who plants a garden plants happiness.', author: 'Chinese proverb' },
  { text: 'A garden is not made in a year; indeed it is never made in the sense of being finished.', author: 'H. H. Thomas, The Complete Gardener, 1912' },
  { text: 'All gardening is landscape painting.', author: 'Alexander Pope, c. 1720' },
  { text: 'The best place to find God is in a garden. You can dig for him there.', author: 'George Bernard Shaw, 1932' },
  { text: 'The glory of gardening: hands in the dirt, head in the sun, heart with nature.', author: 'Alfred Austin, The Garden That I Love, 1894' },
];

var ARTWORK_FILENAMES = {
  'rose':        'Rosa_centifolia_-_Köhler–s_Medizinal-Pflanzen-257.jpg',
  'wisteria':    'Wisteria_sinensis_-_Köhler–s_Medizinal-Pflanzen-285.jpg',
  'lavender':    'Lavandula_angustifolia_-_Köhler–s_Medizinal-Pflanzen-088.jpg',
  'peony':       'Paeonia_officinalis_-_Köhler–s_Medizinal-Pflanzen-164.jpg',
  'iris':        'Iris_germanica_-_Köhler–s_Medizinal-Pflanzen-187.jpg',
  'tulip':       'Tulipa_gesneriana_-_Köhler–s_Medizinal-Pflanzen-272.jpg',
  'sunflower':   'Helianthus_annuus_-_Köhler–s_Medizinal-Pflanzen-078.jpg',
  'camellia':    'Camellia_japonica_-_Köhler–s_Medizinal-Pflanzen-025.jpg',
  'magnolia':    'Magnolia_grandiflora_-_Köhler–s_Medizinal-Pflanzen-097.jpg',
  'oleander':    'Nerium_oleander_-_Köhler–s_Medizinal-Pflanzen-124.jpg',
  'foxglove':    'Digitalis_purpurea_-_Köhler–s_Medizinal-Pflanzen-052.jpg',
  'hydrangea':   'Hydrangea_macrophylla_SZ85.png',
  'rosemary':    'Rosmarinus_officinalis_-_Köhler–s_Medizinal-Pflanzen-244.jpg',
  'thyme':       'Thymus_vulgaris_-_Köhler–s_Medizinal-Pflanzen-271.jpg',
  'sage':        'Salvia_officinalis_-_Köhler–s_Medizinal-Pflanzen-246.jpg',
  'mint':        'Mentha_piperita_-_Köhler–s_Medizinal-Pflanzen-112.jpg',
  'fig':         'Ficus_carica_-_Köhler–s_Medizinal-Pflanzen-057.jpg',
  'peach':       'Prunus_persica_-_Köhler–s_Medizinal-Pflanzen-183.jpg',
  'cherry':      'Prunus_cerasus_-_Köhler–s_Medizinal-Pflanzen-180.jpg',
  'strawberry':  'Fragaria_vesca_-_Köhler–s_Medizinal-Pflanzen-065.jpg',
  'raspberry':   'Rubus_idaeus_-_Köhler–s_Medizinal-Pflanzen-237.jpg',
  'grape':       'Vitis_vinifera_-_Köhler–s_Medizinal-Pflanzen-280.jpg',
  'lemon':       'Citrus_limon_-_Köhler–s_Medizinal-Pflanzen-036.jpg',
  'olive':       'Olea_europaea_-_Köhler–s_Medizinal-Pflanzen-130.jpg',
  'pansy':       'Viola_tricolor_-_Köhler–s_Medizinal-Pflanzen-278.jpg',
  'nasturtium':  'Tropaeolum_majus_-_Köhler–s_Medizinal-Pflanzen-273.jpg',
  'borage':      'Borago_officinalis_-_Köhler–s_Medizinal-Pflanzen-023.jpg',
  'snapdragon':  'Antirrhinum_majus_-_Köhler–s_Medizinal-Pflanzen-013.jpg',
  'valerian':    'Valeriana_officinalis_-_Köhler–s_Medizinal-Pflanzen-275.jpg',
  'fennel':      'Foeniculum_vulgare_-_Köhler–s_Medizinal-Pflanzen-063.jpg',
  'elderflower': 'Sambucus_nigra_-_Köhler–s_Medizinal-Pflanzen-247.jpg',
  'almond':      'Prunus_dulcis_-_Köhler–s_Medizinal-Pflanzen-177.jpg',
  'quince':      'Cydonia_oblonga_-_Köhler–s_Medizinal-Pflanzen-047.jpg',
  'mulberry':    'Morus_nigra_-_Köhler–s_Medizinal-Pflanzen-119.jpg',
  'apricot':     'Prunus_armeniaca_-_Köhler–s_Medizinal-Pflanzen-179.jpg',
};

// Returns the Wikimedia Commons URL for a plant's artwork file
function getArtworkUrl(plant) {
  if (!plant) return null;
  var filename = ARTWORK_FILENAMES[plant.toLowerCase()];
  if (!filename) return null;
  var enc = encodeURIComponent(filename);
  return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + enc + '?width=800';
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

// ── Page A: Artwork + commentary ─────────────────────────────────────────────
function buildPageA(opts) {
  var monthName    = opts.monthName;
  var monthIdx     = opts.monthIdx;
  var year         = opts.year;
  var plant        = opts.plant || '';
  var artworkB64   = opts.artworkB64 || '';  // base64 data URI
  var commentary   = opts.commentary || {};  // { fact, care, enjoy, inspo }
  var recipientName = opts.recipientName || '';
  var climate      = opts.climate || '';

  var plantDisplay = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : monthName;
  var quote        = QUOTES[monthIdx % QUOTES.length];
  var qrUrl        = encodeURIComponent('https://garden-calendar-frontend.vercel.app');

  var artworkSrc = artworkB64
    ? artworkB64
    : 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#F0EAD8"/>'
        + '<text x="200" y="300" text-anchor="middle" font-family="Georgia" font-style="italic" font-size="24" fill="#A08050">' + plantDisplay + '</text></svg>'
      );

  var inspoHtml = '';
  if (commentary.inspo) {
    var ig = commentary.inspo;
    inspoHtml = '<div class="inspo-block">'
      + '<div class="section-label">Garden to visit this month</div>'
      + '<div class="inspo-name">' + (ig.name || '') + '</div>'
      + (ig.location ? '<div class="inspo-location">' + ig.location + '</div>' : '')
      + (ig.highlight ? '<div class="inspo-highlight">' + ig.highlight + '</div>' : '')
      + '</div>';
  }

  return '<div class="cal-page page-a">'
    + '<div class="bleed">'
    + '<div class="page-a-layout">'

    + '<div class="col-artwork-full">'
    + '<img class="artwork-img" src="' + artworkSrc + '" alt="' + plantDisplay + ' botanical illustration"/>'
    + '<div class="artwork-footer">'
    + '<span class="artwork-plant-name">' + plantDisplay + '</span>'
    + '<span class="artwork-credit">Köhler\'s Medizinal-Pflanzen, 1887 · Public Domain</span>'
    + '</div>'
    + '</div>'

    + '<div class="col-commentary">'
    + '<div class="commentary-header">'
    + '<div class="commentary-month">' + monthName + ' ' + year + '</div>'
    + (recipientName ? '<div class="commentary-recipient">' + recipientName + '\'s Garden Calendar</div>' : '')
    + '</div>'

    + (commentary.fact ? (
        '<div class="commentary-section">'
        + '<div class="section-label">Did you know?</div>'
        + '<div class="commentary-text fact-text">' + commentary.fact + '</div>'
        + '</div>'
      ) : '')

    + (commentary.enjoy ? (
        '<div class="commentary-section">'
        + '<div class="section-label">Things to enjoy in ' + monthName + '</div>'
        + '<div class="commentary-text">' + commentary.enjoy + '</div>'
        + '</div>'
      ) : '')

    + (commentary.care ? (
        '<div class="commentary-section">'
        + '<div class="section-label">Care notes</div>'
        + '<div class="commentary-text">' + commentary.care + '</div>'
        + '</div>'
      ) : '')

    + inspoHtml

    + '<div class="commentary-footer">'
    + '<div class="quote-text">\u201c' + quote.text + '\u201d</div>'
    + '<div class="quote-attr">\u2014 ' + quote.author + '</div>'
    + '<div class="qr-row">'
    + '<img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + qrUrl + '&margin=2" width="60" height="60" alt="app QR"/>'
    + '<div class="qr-label">Your digital<br/>garden calendar</div>'
    + '</div>'
    + '</div>'

    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
}

// ── Page B: Full calendar grid ────────────────────────────────────────────────
function buildPageB(opts) {
  var monthName    = opts.monthName;
  var monthIdx     = opts.monthIdx;
  var year         = opts.year;
  var plant        = opts.plant || '';
  var keyDates     = opts.keyDates || [];
  var holidays     = opts.holidays || [];
  var climate      = opts.climate || '';
  var recipientName = opts.recipientName || '';

  var plantDisplay = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : '';

  // Build lookup maps
  var keyDateMap = {};
  for (var i = 0; i < keyDates.length; i++) {
    var kd = keyDates[i];
    var kdate = new Date(kd.date);
    if (kdate.getFullYear() === year && kdate.getMonth() === monthIdx) {
      var kday = kdate.getDate();
      if (!keyDateMap[kday]) keyDateMap[kday] = [];
      keyDateMap[kday].push(kd.label || '');
    }
  }

  var holidayDays = {};
  var holidayLabelMap = {};
  for (var h = 0; h < holidays.length; h++) {
    var hol = holidays[h];
    var hstart = new Date(hol.startDate);
    var hend   = new Date(hol.endDate);
    var hcur   = new Date(hstart);
    while (hcur <= hend) {
      if (hcur.getFullYear() === year && hcur.getMonth() === monthIdx) {
        var hday = hcur.getDate();
        holidayDays[hday] = true;
        if (hcur.getTime() === hstart.getTime()) {
          holidayLabelMap[hday] = hol.label || 'Holiday';
        }
      }
      hcur.setDate(hcur.getDate() + 1);
    }
  }

  var daysInMonth = getDaysInMonth(year, monthIdx);
  var firstDow    = getFirstDayOfWeek(year, monthIdx);

  // Day header row
  var gridHtml = '';
  for (var dn = 0; dn < 7; dn++) {
    gridHtml += '<div class="cal-dow">' + DAY_NAMES[dn] + '</div>';
  }
  // Leading empties
  for (var e = 0; e < firstDow; e++) {
    gridHtml += '<div class="cal-cell cal-empty"></div>';
  }
  // Days
  for (var d = 1; d <= daysInMonth; d++) {
    var isHol   = !!holidayDays[d];
    var isHolS  = holidayLabelMap[d] !== undefined;
    var kdList  = keyDateMap[d] || [];
    var cls     = 'cal-cell' + (isHol ? ' cal-holiday' : '') + (kdList.length ? ' cal-event' : '');
    var inner   = '<span class="day-num">' + d + '</span>';
    if (isHolS)  inner += '<span class="hol-label">' + holidayLabelMap[d] + '</span>';
    for (var k = 0; k < kdList.length; k++) {
      inner += '<span class="event-label">' + kdList[k] + '</span>';
    }
    gridHtml += '<div class="' + cls + '">' + inner + '</div>';
  }
  // Trailing empties
  var total    = firstDow + daysInMonth;
  var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var t = 0; t < trailing; t++) {
    gridHtml += '<div class="cal-cell cal-empty"></div>';
  }

  return '<div class="cal-page page-b">'
    + '<div class="bleed">'
    + '<div class="page-b-layout">'

    + '<div class="cal-header">'
    + '<div class="cal-header-month">' + monthName + '</div>'
    + '<div class="cal-header-year">' + year + '</div>'
    + (plantDisplay ? '<div class="cal-header-plant">' + plantDisplay + '</div>' : '')
    + (recipientName ? '<div class="cal-header-recipient">' + recipientName + '\'s Garden Calendar</div>' : '')
    + '</div>'

    + '<div class="cal-grid-full">' + gridHtml + '</div>'

    + '<div class="cal-footer">'
    + '<span class="cal-footer-text">The Garden Calendar · garden-calendar-frontend.vercel.app</span>'
    + (climate ? '<span class="cal-footer-climate">' + climate + '</span>' : '')
    + '</div>'

    + '</div>'
    + '</div>'
    + '</div>';
}

// ── Shared CSS ────────────────────────────────────────────────────────────────
var SHARED_CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap');",
  ':root{--ink:#2C1A0A;--gold:#8B6914;--sage:#5A7A32;--cream:#F0EBE0;--parchment:#FDFAF4;--rust:#8A3A10;--muted:#7A5C2A;--border:rgba(139,105,20,0.22);}',
  'body{font-family:"Crimson Pro",Georgia,serif;color:var(--ink);background:var(--parchment);}',

  // Page containers
  '.cal-page{width:426mm;height:303mm;position:relative;overflow:hidden;page-break-after:always;page-break-inside:avoid;background:var(--parchment);}',
  '.bleed{position:absolute;top:3mm;left:3mm;right:3mm;bottom:3mm;overflow:hidden;}',

  // ── PAGE A ──
  '.page-a-layout{display:grid;grid-template-columns:160mm 1fr;height:100%;}',
  '.col-artwork-full{position:relative;overflow:hidden;background:#F7F2E8;border-right:0.5mm solid var(--border);}',
  '.artwork-img{width:100%;height:100%;object-fit:contain;display:block;filter:sepia(5%) contrast(1.06);}',
  '.artwork-footer{position:absolute;bottom:0;left:0;right:0;padding:2mm 4mm;background:rgba(240,235,224,0.92);border-top:0.3mm solid var(--border);display:flex;justify-content:space-between;align-items:baseline;}',
  '.artwork-plant-name{font-family:"Playfair Display",serif;font-style:italic;font-size:10pt;color:var(--ink);}',
  '.artwork-credit{font-size:7pt;color:var(--muted);opacity:0.65;}',
  '.col-commentary{display:flex;flex-direction:column;padding:5mm 6mm;overflow:hidden;}',
  '.commentary-header{border-bottom:0.4mm solid var(--gold);padding-bottom:3mm;margin-bottom:4mm;flex-shrink:0;}',
  '.commentary-month{font-family:"Playfair Display",serif;font-size:20pt;font-weight:600;color:var(--ink);}',
  '.commentary-recipient{font-size:9pt;color:var(--muted);letter-spacing:0.06em;margin-top:1mm;}',
  '.commentary-section{margin-bottom:4mm;flex-shrink:0;}',
  '.section-label{font-family:"Playfair Display",serif;font-size:8pt;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);margin-bottom:1.5mm;}',
  '.commentary-text{font-size:10pt;line-height:1.55;color:var(--ink);}',
  '.fact-text{font-style:italic;}',
  '.inspo-block{margin-bottom:4mm;padding:3mm;background:rgba(139,105,20,0.06);border-left:1mm solid var(--gold);flex-shrink:0;}',
  '.inspo-name{font-family:"Playfair Display",serif;font-size:11pt;font-weight:600;color:var(--ink);margin-bottom:0.5mm;}',
  '.inspo-location{font-size:9pt;color:var(--muted);margin-bottom:1mm;}',
  '.inspo-highlight{font-size:9.5pt;line-height:1.45;color:var(--ink);}',
  '.commentary-footer{margin-top:auto;border-top:0.3mm solid var(--border);padding-top:3mm;flex-shrink:0;}',
  '.quote-text{font-family:"Playfair Display",serif;font-style:italic;font-size:9pt;line-height:1.5;color:var(--ink);margin-bottom:1.5mm;}',
  '.quote-attr{font-size:8pt;color:var(--muted);margin-bottom:2mm;}',
  '.qr-row{display:flex;align-items:center;gap:3mm;}',
  '.qr-row img{border:0.3mm solid var(--border);border-radius:1mm;padding:1mm;background:white;}',
  '.qr-label{font-size:7.5pt;color:var(--muted);line-height:1.4;}',

  // ── PAGE B ──
  '.page-b-layout{display:flex;flex-direction:column;height:100%;}',
  '.cal-header{display:flex;align-items:baseline;gap:5mm;padding:4mm 5mm 3mm;background:var(--ink);color:var(--parchment);flex-shrink:0;}',
  '.cal-header-month{font-family:"Playfair Display",serif;font-size:26pt;font-weight:600;letter-spacing:0.01em;}',
  '.cal-header-year{font-size:16pt;opacity:0.65;}',
  '.cal-header-plant{font-size:11pt;font-style:italic;opacity:0.75;flex:1;}',
  '.cal-header-recipient{font-size:8.5pt;opacity:0.55;letter-spacing:0.05em;text-transform:uppercase;}',
  '.cal-grid-full{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:auto;align-content:start;gap:0;border-left:0.3mm solid var(--border);border-top:0.3mm solid var(--border);}',
  '.cal-dow{font-size:8pt;text-align:center;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding:2.5mm;border-right:0.3mm solid var(--border);border-bottom:0.5mm solid var(--gold);background:rgba(139,105,20,0.04);}',
  '.cal-cell{min-height:30mm;padding:2mm 2.5mm;border-right:0.3mm solid var(--border);border-bottom:0.3mm solid var(--border);display:flex;flex-direction:column;gap:1mm;overflow:hidden;vertical-align:top;}',
  '.cal-empty{background:rgba(0,0,0,0.015);}',
  '.cal-holiday{background:rgba(90,122,50,0.07);}',
  '.cal-event{background:rgba(139,105,20,0.05);}',
  '.day-num{font-size:14pt;font-weight:500;color:var(--ink);line-height:1;margin-bottom:1mm;}',
  '.cal-holiday .day-num{color:var(--sage);}',
  '.cal-event .day-num{color:var(--gold);}',
  '.hol-label{font-size:7pt;color:var(--sage);font-style:italic;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.event-label{font-size:7.5pt;color:var(--rust);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.cal-footer{display:flex;justify-content:space-between;align-items:center;padding:2mm 5mm;border-top:0.3mm solid var(--border);flex-shrink:0;}',
  '.cal-footer-text{font-size:7pt;color:var(--muted);opacity:0.6;letter-spacing:0.04em;}',
  '.cal-footer-climate{font-size:7pt;color:var(--muted);font-style:italic;opacity:0.7;}',
].join('\n');

module.exports = {
  buildPageA: buildPageA,
  buildPageB: buildPageB,
  SHARED_CSS: SHARED_CSS,
  getArtworkUrl: getArtworkUrl,
  ARTWORK_FILENAMES: ARTWORK_FILENAMES,
};
