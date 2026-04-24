// calendarTemplate.js (CommonJS)
// Page A: ~1/3 illustration left | ~2/3 right panel
//   Right panel top→bottom: weather · tasks · plant notes · inspo garden
// Page B: full-page calendar grid

var DAY_NAMES   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

var QUOTES = [
  { text: 'To forget how to dig the earth and tend the soil is to forget ourselves.', author: 'Mahatma Gandhi' },
  { text: 'A garden is a grand teacher. It teaches patience and careful watchfulness.', author: 'Gertrude Jekyll, 1900' },
  { text: "One is nearer God's heart in a garden than anywhere else on earth.", author: 'Dorothy Frances Gurney, 1913' },
  { text: 'God Almighty first planted a garden; and indeed it is the purest of human pleasures.', author: 'Francis Bacon, 1625' },
  { text: 'A garden must be looked into and dressed as the body.', author: 'George Herbert, 1640' },
  { text: 'Who loves a garden still his Eden keeps, perennial pleasures plants.', author: 'Amos Bronson Alcott, 1868' },
  { text: "The garden is the poor man's apothecary.", author: 'German proverb' },
  { text: 'He who plants a garden plants happiness.', author: 'Chinese proverb' },
  { text: 'A garden is not made in a year; indeed it is never made in the sense of being finished.', author: 'H. H. Thomas, 1912' },
  { text: 'All gardening is landscape painting.', author: 'Alexander Pope, c. 1720' },
  { text: 'The best place to find God is in a garden. You can dig for him there.', author: 'George Bernard Shaw, 1932' },
  { text: 'The glory of gardening: hands in the dirt, head in the sun, heart with nature.', author: 'Alfred Austin, 1894' },
];

// Pre-computed direct upload.wikimedia.org URLs
var ARTWORK_URLS = {
  'rose': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Rosa_centifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-122.jpg/800px-Rosa_centifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-122.jpg',
  'lavender': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Lavandula_angustifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-087.jpg/800px-Lavandula_angustifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-087.jpg',
  'foxglove': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Digitalis_purpurea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-053.jpg/800px-Digitalis_purpurea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-053.jpg',
  'lemon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Citrus_limon_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-041.jpg/800px-Citrus_limon_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-041.jpg',
  'cherry': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Prunus_cerasus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-113.jpg/800px-Prunus_cerasus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-113.jpg',
  'raspberry': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Rubus_idaeus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-124.jpg/800px-Rubus_idaeus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-124.jpg',
  'sage': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Salvia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-126.jpg/800px-Salvia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-126.jpg',
  'elderflower': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Sambucus_nigra_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-127.jpg/800px-Sambucus_nigra_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-127.jpg',
  'valerian': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Valeriana_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-143.jpg/800px-Valeriana_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-143.jpg',
  'grape': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Vitis_vinifera_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-145.jpg/800px-Vitis_vinifera_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-145.jpg',
  'quince': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Cydonia_oblonga_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-049.jpg/800px-Cydonia_oblonga_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-049.jpg',
  'thyme': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Thymus_vulgaris_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-271.jpg/800px-Thymus_vulgaris_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-271.jpg',
  'mint': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Mentha_%C3%97_piperita_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-095.jpg/800px-Mentha_%C3%97_piperita_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-095.jpg',
  'olive': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Olea_europaea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-229.jpg/800px-Olea_europaea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-229.jpg',
};

// Plate source info for bottom banner
var ARTWORK_SOURCE = {
  'rose':       { plate: '122', name: 'Rosa centifolia' },
  'lavender':   { plate: '087', name: 'Lavandula angustifolia' },
  'foxglove':   { plate: '053', name: 'Digitalis purpurea' },
  'lemon':      { plate: '041', name: 'Citrus limon' },
  'cherry':     { plate: '113', name: 'Prunus cerasus' },
  'raspberry':  { plate: '124', name: 'Rubus idaeus' },
  'sage':       { plate: '126', name: 'Salvia officinalis' },
  'elderflower':{ plate: '127', name: 'Sambucus nigra' },
  'valerian':   { plate: '143', name: 'Valeriana officinalis' },
  'grape':      { plate: '145', name: 'Vitis vinifera' },
  'quince':     { plate: '049', name: 'Cydonia oblonga' },
  'thyme':      { plate: '271', name: 'Thymus vulgaris' },
  'mint':       { plate: '095', name: 'Mentha \u00d7 piperita' },
  'olive':      { plate: '229', name: 'Olea europaea' },
};

// Hardcoded plant commentary: 5 bullet points per plant
var PLANT_NOTES = {
  'rose':       ['Rosa has been cultivated for over 5,000 years.', 'The oldest living rose is said to grow on Hildesheim Cathedral, planted around 815 AD.', 'In April, watch for the first red shoots pushing from the base.', 'Feed now with a high-potash fertiliser to set up the first flush.', 'Deadhead regularly through summer to encourage continuous flowering.'],
  'lavender':   ['Lavender takes its name from the Latin lavare \u2014 to wash.', 'Roman soldiers scented their baths with it; Tudor households used it to perfume linen.', 'In April, silver-grey mounds of fresh growth emerge from the base.', 'Cut back last year\u2019s stems to just above new growth to keep plants compact.', 'Perfect drainage is essential: more lavender dies from wet roots than from drought.'],
  'foxglove':   ['Digitalis, derived from foxglove, transformed heart medicine in 1785.', 'The name comes from the Old English foxes gl\u014dfa \u2014 the fox\u2019s glove.', 'A biennial by nature: sow in June for flowers the following summer.', 'Self-seeds prolifically in the right conditions, naturalising in woodland edges.', 'Leave seedheads on the plant \u2014 bees love the tubular flowers in late spring.'],
  'lemon':      ['Lemon trees can carry flowers, unripe and ripe fruit simultaneously.', 'They originate in Assam, India, and reached Europe via Arab traders in the 11th century.', 'In cool climates, bring under cover before the first frost in October.', 'Feed monthly with specialist citrus fertiliser from March to September.', 'Erratic watering causes fruit to split \u2014 keep moisture levels consistent.'],
  'cherry':     ['A mature cherry tree can produce up to 7,000 fruits in a single season.', 'The wood is prized by furniture makers for its warm, close-grained character.', 'Prune only in summer to avoid silver leaf disease, which enters through winter wounds.', 'Net trees as fruit colours to protect from birds, who can strip a tree overnight.', 'Morello cherries are self-fertile; sweet varieties need a pollination partner.'],
  'raspberry':  ['Raspberries are aggregate fruits: each \u2018berry\u2019 is a cluster of up to 100 tiny drupelets.', 'Summer-fruiting varieties fruit on last year\u2019s canes; autumn varieties on this year\u2019s.', 'After summer fruiting, cut all canes to the ground and tie in the new ones.', 'Autumn-fruiting varieties can simply be cut to the ground in late winter.', 'Feed with a high-potash fertiliser in spring to maximise fruit size.'],
  'sage':       ['Salvia comes from the Latin salvare \u2014 to save \u2014 a reference to its medicinal reputation.', 'In medieval Europe it was said that a garden with sage needed no doctor.', 'Cut back hard in spring to encourage fresh growth from the base.', 'Replace plants every four to five years as they become woody and less productive.', 'Excellent drainage is essential \u2014 sage detests wet roots in winter.'],
  'elderflower':['Elder has been considered magical throughout European history.', 'Almost every part is used: flowers for cordials and fritters, berries for wine and syrups.', 'The large flat-topped flowerheads appear in June \u2014 pick when fully open for the best scent.', 'Cut back hard every two to three years in late winter to keep to a manageable size.', 'Tolerates most soils and positions, including quite deep shade.'],
  'valerian':   ['Valerian root has been used as a sedative since ancient Greece and Rome.', 'Modern research confirms it contains compounds that interact with GABA receptors.', 'Cut to the ground in autumn; it will return vigorously in spring.', 'Divide clumps every three to four years to maintain vigour.', 'Self-seeds freely \u2014 deadhead to prevent unwanted spread into borders.'],
  'grape':      ['Evidence of winemaking dates back at least 8,000 years.', 'The grapevine\u2019s genome contains more genes than the human genome.', 'Prune hard to a framework of permanent rods each winter, before the sap rises.', 'Tie in new growth regularly during the growing season as it extends quickly.', 'Thin bunches in summer to improve air circulation and increase fruit size.'],
  'quince':     ['Quince is believed to be the golden apple of Greek mythology.', 'It is one of the earliest fruits to be cultivated, grown in ancient Mesopotamia.', 'Quinces require long, warm summers to ripen \u2014 wall training helps in cooler climates.', 'The raw fruit is astringent but transforms completely when cooked into membrillo or jelly.', 'Self-fertile and largely pest-free \u2014 one of the most rewarding of all garden fruits.'],
  'thyme':      ['The ancient Greeks burned thyme as temple incense; Roman soldiers bathed in it.', 'Its name comes from the Greek thymos, meaning courage or strength.', 'Trim hard after flowering to prevent plants from becoming woody and sprawling.', 'Replace plants every three to four years as they deteriorate with age.', 'Excellent drainage is essential \u2014 it originates on dry Mediterranean hillsides.'],
  'mint':       ['There are over 600 varieties of mint, and they hybridise freely.', 'Peppermint is itself a natural hybrid of watermint and spearmint.', 'Contain mint in pots or with a buried barrier \u2014 it spreads aggressively underground.', 'Cut back to the ground in autumn; fresh growth returns vigorously in spring.', 'Running your hand along a stem and inhaling the scent is one of the garden\u2019s small pleasures.'],
  'olive':      ['Some Mediterranean olive trees are estimated to be over 2,000 years old.', 'The olive branch has symbolised peace since ancient Greece.', 'Extremely drought-tolerant once established \u2014 overwatering is the main risk.', 'Hardy to around \u221210\u00b0C, but young trees need protection in hard winters.', 'Pot-grown olives should be moved under cover when temperatures fall below \u22125\u00b0C.'],
};

function getArtworkUrl(plant) {
  if (!plant) return null;
  return ARTWORK_URLS[plant.toLowerCase()] || null;
}

function getPlantNotes(plant) {
  if (!plant) return [];
  return PLANT_NOTES[plant.toLowerCase()] || [];
}

function getArtworkSource(plant) {
  if (!plant) return null;
  return ARTWORK_SOURCE[plant.toLowerCase()] || null;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  var d = new Date(year, month, 1).getDay(); // 0=Sun
  return (d + 6) % 7; // convert to Mon=0
}

// ── Page A: illustration + right panel ───────────────────────────────────────
function buildPageA(opts) {
  var monthName     = opts.monthName;
  var monthIdx      = opts.monthIdx;
  var year          = opts.year;
  var plant         = opts.plant || '';
  var artworkB64    = opts.artworkB64 || '';
  var inspo         = opts.inspo || null;
  var inspoPhotoB64 = opts.inspoPhotoB64 || '';
  var climate       = opts.climate || '';
  var climateData   = opts.climateData || null;
  var recipientName = opts.recipientName || '';
  var etsy          = opts.etsy || 'etsy.com/shop/thegardencalendar';
  var appUrl        = 'https://garden-calendar-frontend.vercel.app';

  var plantDisplay  = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : monthName;
  var notes         = getPlantNotes(plant);
  var source        = getArtworkSource(plant);
  var artworkSrc    = artworkB64 || '';
  var quote         = QUOTES[monthIdx % QUOTES.length];

  // Climate stats
  var wxHigh = '', wxLow = '', wxRain = '', wxSun = '', wxWind = '';
  if (climateData && climateData._cd) {
    var cd = climateData._cd;
    if (cd.tMax  && cd.tMax[monthIdx]  != null) wxHigh = Math.round(cd.tMax[monthIdx])  + '\u00b0C';
    if (cd.tMin  && cd.tMin[monthIdx]  != null) wxLow  = Math.round(cd.tMin[monthIdx])  + '\u00b0C';
    if (cd.precip && cd.precip[monthIdx]!= null) wxRain = Math.round(cd.precip[monthIdx])+ 'mm';
    if (cd.sunHrs && cd.sunHrs[monthIdx]!= null) wxSun  = parseFloat(cd.sunHrs[monthIdx]).toFixed(1) + 'h';
    if (cd.wind  && cd.wind[monthIdx]  != null) {
      var w = cd.wind[monthIdx];
      wxWind = w < 15 ? 'Calm' : w < 25 ? 'Moderate' : w < 35 ? 'Breezy' : 'Windy';
    }
  }

  // Inspo garden
  var inspoName     = inspo && inspo.name     ? inspo.name     : '';
  var inspoLoc      = inspo && inspo.location ? inspo.location : '';
  var inspoHighlight= inspo && inspo.highlight ? inspo.highlight : '';
  var inspoSearchUrl = inspoName
    ? 'https://www.google.com/search?q=' + encodeURIComponent(inspoName + ' ' + inspoLoc + ' official website')
    : '';
  var inspoQrUrl = inspoSearchUrl
    ? 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(inspoSearchUrl) + '&margin=2'
    : '';
  var appQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(appUrl) + '&margin=2';

  // Notes bullets
  var notesHtml = '';
  for (var i = 0; i < notes.length; i++) {
    notesHtml += '<div class="note-row"><span class="note-bullet">\u2022</span><span class="note-text">' + notes[i] + '</span></div>';
  }
  if (!notesHtml) {
    notesHtml = '<div class="note-row"><span class="note-text" style="font-style:italic;opacity:.6">Plant notes will appear here.</span></div>';
  }

  // Task checkboxes
  var checkboxes = '';
  for (var c = 0; c < 5; c++) {
    checkboxes += '<div class="cb-row"><div class="cb-sq"></div><div class="cb-line"></div></div>';
  }

  // Source info
  var sourceLine = source
    ? source.name + ' \u00b7 K\u00f6hler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Plate ' + source.plate
    : (plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) + ' \u00b7 Botanical illustration' : 'Botanical illustration');
  var sourceSub = 'Public domain illustration \u00b7 Digitised by Missouri Botanical Garden \u00b7 Wikimedia Commons';

  return '<div class="cal-page page-a">'
    + '<div class="bleed">'

    // TOP BANNER
    + '<div class="top-banner">'
    +   '<span class="top-month">' + monthName + '</span>'
    +   '<span class="top-year">' + year + '</span>'
    +   (recipientName ? '<span class="top-name">' + recipientName + '\u2019s Garden Calendar</span>' : '')
    + '</div>'

    // BODY
    + '<div class="page-body">'

    // LEFT: ILLUSTRATION (~1/3)
    + '<div class="col-illus">'
    +   '<div class="illus-area">'
    +     (artworkSrc
           ? '<img class="illus-img" src="' + artworkSrc + '" alt="' + plantDisplay + ' botanical illustration"/>'
           : '<div class="illus-placeholder">' + plantDisplay + '</div>')
    +   '</div>'
    + '</div>'

    // RIGHT PANEL (~2/3)
    + '<div class="col-right">'

    // 1. WEATHER BOX
    + '<div class="r-box wx-box">'
    +   '<div class="box-label">' + monthName + ' climate \u00b7 ' + climate + '</div>'
    +   '<div class="wx-grid">'
    +     '<div class="wx-item"><span class="wx-val">' + (wxHigh||'\u2014') + '</span><span class="wx-lbl">Daytime high</span></div>'
    +     '<div class="wx-item"><span class="wx-val">' + (wxLow||'\u2014') + '</span><span class="wx-lbl">Night low</span></div>'
    +     '<div class="wx-item"><span class="wx-val">' + (wxRain||'\u2014') + '</span><span class="wx-lbl">Avg rainfall</span></div>'
    +     '<div class="wx-item"><span class="wx-val">' + (wxSun||'\u2014') + '</span><span class="wx-lbl">Sun / day</span></div>'
    +   '</div>'
    +   (wxWind ? '<div class="wx-wind">Typical wind: <strong>' + wxWind + '</strong></div>' : '')
    + '</div>'

    // 2. TASKS BOX
    + '<div class="r-box tasks-box">'
    +   '<div class="box-label">Garden tasks</div>'
    +   '<div class="tasks-intro">In ' + monthName + ', look to sow, plant out, and tend to seasonal priorities for your climate and chosen plants.</div>'
    +   '<div class="tasks-prompt">What needs doing in your garden this month?</div>'
    +   checkboxes
    + '</div>'

    // 3. PLANT NOTES BOX
    + '<div class="r-box notes-box">'
    +   '<div class="box-label">' + plantDisplay + '</div>'
    +   '<div class="notes-body">' + notesHtml + '</div>'
    + '</div>'

    // 4. INSPO GARDEN BOX
    + '<div class="r-box inspo-box">'
    +   '<div class="box-label">Garden to visit this ' + monthName + '</div>'
    +   '<div class="inspo-inner">'
    +     '<div class="inspo-photo">'
    +       (inspoPhotoB64
             ? '<img src="' + inspoPhotoB64 + '" class="inspo-photo-img" alt="' + inspoName + '"/>'
             : '<div class="inspo-photo-ph">' + (inspoName ? inspoName.charAt(0) : '?') + '</div>')
    +     '</div>'
    +     '<div class="inspo-text">'
    +       '<div class="inspo-name">' + (inspoName||'Garden to visit') + '</div>'
    +       (inspoLoc ? '<div class="inspo-loc">' + inspoLoc + '</div>' : '')
    +       (inspoHighlight ? '<div class="inspo-desc">' + inspoHighlight + '</div>' : '')
    +     '</div>'
    +     '<div class="inspo-qr-col">'
    +       (inspoQrUrl ? '<img src="' + inspoQrUrl + '" width="44" height="44" alt="search" style="border:0.3mm solid rgba(139,105,20,.2);border-radius:1mm;padding:1mm;background:white;display:block;"/>' : '')
    +       (inspoQrUrl ? '<div class="inspo-qr-lbl">Search &#x2197;</div>' : '')
    +     '</div>'
    +   '</div>'
    + '</div>'

    + '</div>' // col-right
    + '</div>' // page-body

    // BOTTOM BANNER
    + '<div class="bot-banner">'
    +   '<div class="bot-source">'
    +     '<div class="bot-source-title">' + sourceLine + '</div>'
    +     '<div class="bot-source-sub">' + sourceSub + '</div>'
    +   '</div>'
    +   '<div class="bot-brand">'
    +     '<div class="bot-brand-name">The Garden Calendar</div>'
    +     '<div class="bot-brand-url">' + etsy + '</div>'
    +   '</div>'
    +   '<div class="bot-qr">'
    +     '<img src="' + appQrUrl + '" width="38" height="38" alt="app qr" style="border:0.3mm solid rgba(139,105,20,.2);border-radius:1mm;padding:1mm;background:white;display:block;"/>'
    +     '<div class="bot-qr-lbl">Digital<br/>calendar</div>'
    +   '</div>'
    + '</div>'

    + '</div>' // bleed
    + '</div>'; // cal-page
}

// ── Page B: full calendar grid ────────────────────────────────────────────────
function buildPageB(opts) {
  var monthName     = opts.monthName;
  var monthIdx      = opts.monthIdx;
  var year          = opts.year;
  var plant         = opts.plant || '';
  var keyDates      = opts.keyDates  || [];
  var holidays      = opts.holidays  || [];
  var climate       = opts.climate   || '';
  var recipientName = opts.recipientName || '';

  var plantDisplay = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : '';

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
    var hol    = holidays[h];
    var hstart = new Date(hol.startDate);
    var hend   = new Date(hol.endDate);
    var hcur   = new Date(hstart.getTime());
    while (hcur <= hend) {
      if (hcur.getFullYear() === year && hcur.getMonth() === monthIdx) {
        var hday = hcur.getDate();
        holidayDays[hday] = true;
        if (hcur.getTime() === hstart.getTime()) holidayLabelMap[hday] = hol.label || 'Holiday';
      }
      hcur.setDate(hcur.getDate() + 1);
    }
  }

  var daysInMonth = getDaysInMonth(year, monthIdx);
  var firstDow    = getFirstDayOfWeek(year, monthIdx);

  var gridHtml = '';
  for (var dn = 0; dn < 7; dn++) {
    gridHtml += '<div class="cal-dow">' + DAY_NAMES[dn] + '</div>';
  }
  for (var e = 0; e < firstDow; e++) {
    var eW = e >= 5 ? ' weekend' : '';
    gridHtml += '<div class="cal-cell cal-empty' + eW + '"></div>';
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var isHol   = !!holidayDays[d];
    var isHolS  = holidayLabelMap[d] !== undefined;
    var kdList  = keyDateMap[d] || [];
    var colIdx  = (firstDow + d - 1) % 7; // 0=Mon ... 5=Sat 6=Sun
    var isWeekend = colIdx >= 5;
    var cls     = 'cal-cell' + (isWeekend ? ' weekend' : '') + (isHol ? ' cal-holiday' : '') + (kdList.length ? ' cal-event' : '');
    var inner   = '<span class="day-num">' + d + '</span>';
    if (isHolS) inner += '<span class="hol-label">' + holidayLabelMap[d] + '</span>';
    for (var k = 0; k < kdList.length; k++) {
      inner += '<span class="event-label">' + kdList[k] + '</span>';
    }
    gridHtml += '<div class="' + cls + '">' + inner + '</div>';
  }
  var total = firstDow + daysInMonth;
  var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var t = 0; t < trailing; t++) {
    var tCol = (total + t) % 7;
    var tWeekend = tCol >= 5 ? ' weekend' : '';
    gridHtml += '<div class="cal-cell cal-empty' + tWeekend + '"></div>';
  }

  return '<div class="cal-page page-b">'
    + '<div class="bleed">'
    + '<div class="page-b-layout">'
    + '<div class="cal-header">'
    +   '<div class="cal-header-month">' + monthName + '</div>'
    +   '<div class="cal-header-year">' + year + '</div>'
    +   (plantDisplay ? '<div class="cal-header-plant">' + plantDisplay + '</div>' : '')
    +   (recipientName ? '<div class="cal-header-recip">' + recipientName + '\u2019s Garden Calendar</div>' : '')
    + '</div>'
    + '<div class="cal-grid-full">' + gridHtml + '</div>'
    + '<div class="cal-footer">'
    +   '<span class="cal-footer-text">The Garden Calendar \u00b7 garden-calendar-frontend.vercel.app</span>'
    +   (climate ? '<span class="cal-footer-climate">' + climate + '</span>' : '')
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
}

// ── Shared CSS ──────────────────────────────────────────────────────────────
var SHARED_CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap');",
  ':root{--ink:#2C1A0A;--gold:#8B6914;--sage:#5A7A32;--cream:#F0EBE0;--parchment:#FDFAF4;--rust:#8A3A10;--muted:#7A5C2A;--border:rgba(139,105,20,0.22);}',
  'body{font-family:"Crimson Pro",Georgia,serif;color:var(--ink);background:var(--parchment);}',
  '.cal-page{width:426mm;height:303mm;position:relative;overflow:hidden;page-break-after:always;page-break-inside:avoid;background:var(--parchment);}',
  '.bleed{position:absolute;top:3mm;left:3mm;right:3mm;bottom:3mm;overflow:hidden;display:flex;flex-direction:column;}',

  // TOP BANNER — taller, bigger month/year, no plant name
  '.top-banner{background:var(--ink);color:var(--parchment);padding:4mm 6mm;display:flex;align-items:baseline;gap:5mm;flex-shrink:0;}',
  '.top-month{font-family:"Playfair Display",serif;font-size:34pt;font-weight:600;letter-spacing:.01em;line-height:1;}',
  '.top-year{font-size:18pt;opacity:.6;letter-spacing:.02em;}',
  '.top-name{font-size:9pt;opacity:.5;letter-spacing:.06em;text-transform:uppercase;margin-left:auto;}',

  // PAGE BODY: 1/3 illustration | 2/3 right
  '.page-body{flex:1;display:grid;grid-template-columns:1fr 2fr;min-height:0;overflow:hidden;}',

  // LEFT ILLUSTRATION
  '.col-illus{background:#F7F2E8;border-right:.4mm solid var(--border);overflow:hidden;display:flex;flex-direction:column;}',
  '.illus-area{flex:1;overflow:hidden;}',
  '.illus-img{width:100%;height:100%;object-fit:contain;display:block;filter:sepia(5%) contrast(1.06);}',
  '.illus-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",serif;font-style:italic;font-size:14pt;color:var(--muted);opacity:.4;text-align:center;padding:5mm;}',

  // RIGHT PANEL — flex column, proportional boxes
  // weather 15% | tasks 35% | plant 35% | inspo 15%
  '.col-right{display:flex;flex-direction:column;padding:2.5mm 3mm;gap:1.5mm;overflow:hidden;}',
  '.r-box{border:.4mm solid var(--border);border-radius:1mm;padding:2mm 2.5mm;overflow:hidden;}',
  '.box-label{font-family:"Playfair Display",serif;font-size:7.5pt;text-transform:uppercase;letter-spacing:.12em;color:var(--gold);margin-bottom:1.5mm;display:block;}',

  // Box proportions via flex-grow weighted by ratio (15/35/35/15)
  // We name the boxes; JS adds flex styling inline
  '.wx-box{flex:15;}',
  '.tasks-box{flex:35;}',
  '.notes-box{flex:35;}',
  '.inspo-box{flex:15;}',

  // WEATHER
  '.wx-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1mm;}',
  '.wx-item{display:flex;flex-direction:column;gap:.5mm;}',
  '.wx-val{font-family:"Playfair Display",serif;font-size:15pt;font-weight:600;color:var(--ink);line-height:1;}',
  '.wx-lbl{font-size:7pt;color:var(--muted);}',
  '.wx-wind{font-size:8pt;color:var(--muted);margin-top:1.5mm;}',
  '.wx-wind strong{color:var(--ink);}',

  // TASKS
  '.tasks-intro{font-size:9.5pt;line-height:1.45;color:var(--ink);margin-bottom:2mm;}',
  '.tasks-prompt{font-size:9pt;font-style:italic;color:var(--muted);margin-bottom:2mm;}',
  '.cb-row{display:flex;align-items:center;gap:2mm;margin-bottom:2mm;}',
  '.cb-sq{width:3.5mm;height:3.5mm;border:.4mm solid var(--muted);border-radius:.5mm;flex-shrink:0;}',
  '.cb-line{flex:1;border-bottom:.3mm solid rgba(139,105,20,.18);height:3.5mm;}',

  // PLANT NOTES
  '.notes-body{height:calc(100% - 5mm);display:flex;flex-direction:column;justify-content:space-around;}',
  '.note-row{display:flex;align-items:flex-start;gap:2mm;}',
  '.note-bullet{color:var(--gold);font-size:9.5pt;flex-shrink:0;line-height:1.4;}',
  '.note-text{font-size:9.5pt;line-height:1.45;color:var(--ink);}',

  // INSPO GARDEN
  '.inspo-inner{display:flex;gap:2.5mm;align-items:flex-start;height:calc(100% - 5mm);}',
  '.inspo-photo{width:22mm;flex-shrink:0;align-self:stretch;border-radius:1mm;overflow:hidden;background:rgba(90,122,50,.1);}',
  '.inspo-photo-img{width:100%;height:100%;object-fit:cover;}',
  '.inspo-photo-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",serif;font-size:16pt;color:var(--sage);opacity:.4;}',
  '.inspo-text{flex:1;min-width:0;}',
  '.inspo-name{font-family:"Playfair Display",serif;font-size:10.5pt;font-weight:600;color:var(--ink);line-height:1.2;}',
  '.inspo-loc{font-size:8pt;color:var(--muted);margin-top:.5mm;}',
  '.inspo-desc{font-size:8.5pt;line-height:1.35;color:var(--ink);margin-top:1mm;}',
  '.inspo-qr-col{display:flex;flex-direction:column;align-items:center;gap:1mm;flex-shrink:0;justify-content:center;}',
  '.inspo-qr-lbl{font-size:7pt;color:var(--muted);text-align:center;}',

  // BOTTOM BANNER — taller
  '.bot-banner{background:var(--cream);border-top:.4mm solid var(--border);display:grid;grid-template-columns:1fr auto auto;align-items:center;flex-shrink:0;padding:0;}',
  '.bot-source{padding:2.5mm 4mm;border-right:.4mm solid var(--border);}',
  '.bot-source-title{font-family:"Playfair Display",serif;font-style:italic;font-size:9pt;color:var(--ink);}',
  '.bot-source-sub{font-size:7.5pt;color:var(--muted);margin-top:.5mm;}',
  '.bot-brand{padding:2.5mm 4mm;border-right:.4mm solid var(--border);text-align:center;}',
  '.bot-brand-name{font-family:"Playfair Display",serif;font-style:italic;font-size:10pt;color:var(--gold);}',
  '.bot-brand-url{font-size:8pt;color:var(--muted);}',
  '.bot-qr{padding:2.5mm 3mm;display:flex;align-items:center;gap:2mm;}',
  '.bot-qr-lbl{font-size:7.5pt;color:var(--muted);line-height:1.4;}',

  // PAGE B — CALENDAR GRID
  '.page-b-layout{display:flex;flex-direction:column;height:100%;}',

  // Calendar header — taller top banner, bigger month
  '.cal-header{display:flex;align-items:baseline;gap:5mm;padding:4mm 6mm 3.5mm;background:var(--ink);color:var(--parchment);flex-shrink:0;}',
  '.cal-header-month{font-family:"Playfair Display",serif;font-size:34pt;font-weight:600;line-height:1;}',
  '.cal-header-year{font-size:18pt;opacity:.6;}',
  '.cal-header-plant{font-size:10pt;font-style:italic;opacity:.7;flex:1;}',
  '.cal-header-recip{font-size:8pt;opacity:.5;letter-spacing:.05em;text-transform:uppercase;}',

  // Grid — day headers shorter and centred, Sat+Sun shaded
  '.cal-grid-full{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;min-height:0;border-left:.3mm solid var(--border);border-top:.3mm solid var(--border);}',

  // Day header row — fixed height, larger font, centred both axes
  '.cal-dow{height:8mm;display:flex;align-items:center;justify-content:center;font-size:10pt;font-weight:600;letter-spacing:.06em;color:var(--gold);text-transform:uppercase;border-right:.3mm solid var(--border);border-bottom:.5mm solid var(--gold);background:rgba(139,105,20,.05);}',

  // Sat (6th col) and Sun (7th col) shading on dow headers
  '.cal-dow:nth-child(6){background:rgba(139,105,20,.1);}',
  '.cal-dow:nth-child(7){background:rgba(139,105,20,.1);}',

  // Day cells
  '.cal-cell{padding:2mm 2.5mm;border-right:.3mm solid var(--border);border-bottom:.3mm solid var(--border);display:flex;flex-direction:column;gap:1mm;overflow:hidden;}',

  // Shade Sat and Sun columns (every 6th and 7th in each row)
  // nth-child selects by position in grid, so: 6,7,13,14,20,21,27,28,34,35,41,42
  // Use a repeating pattern: 7n+6 and 7n+7 within the cells (after the dow row of 7)
  // The dow row occupies positions 1-7, day cells start at 8
  // So Sat cells: 7n+6 from position 8 onward — use: nth-child(7n+6), nth-child(7n+7)
  // but we need to account for the 7 header items first
  // Simpler: add weekend class in JS
  '.cal-cell.weekend{background:rgba(139,105,20,.04);}',

  '.cal-empty{background:rgba(0,0,0,.012);}',
  '.cal-empty.weekend{background:rgba(139,105,20,.03);}',
  '.cal-holiday{background:rgba(90,122,50,.08);}',
  '.cal-event{background:rgba(139,105,20,.05);}',
  '.day-num{font-size:16pt;font-weight:500;color:var(--ink);line-height:1;margin-bottom:.5mm;}',
  '.weekend .day-num{color:var(--gold);}',
  '.cal-holiday .day-num{color:var(--sage);}',
  '.cal-event .day-num{color:var(--gold);}',
  '.hol-label{font-size:7.5pt;color:var(--sage);font-style:italic;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.event-label{font-size:8pt;color:var(--rust);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',

  '.cal-footer{display:flex;justify-content:space-between;align-items:center;padding:2mm 5mm;border-top:.3mm solid var(--border);flex-shrink:0;}',
  '.cal-footer-text{font-size:7pt;color:var(--muted);opacity:.6;letter-spacing:.04em;}',
  '.cal-footer-climate{font-size:7pt;color:var(--muted);font-style:italic;opacity:.7;}',
].join('\n');

module.exports = {
  buildPageA: buildPageA,
  buildPageB: buildPageB,
  getArtworkUrl: getArtworkUrl,
  getPlantNotes: getPlantNotes,
  SHARED_CSS: SHARED_CSS,
};
