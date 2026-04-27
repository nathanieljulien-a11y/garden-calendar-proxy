// calendarTemplate.js (CommonJS)
// A3 portrait = two A4 landscape pages stacked vertically on one sheet.
// Page A layout (top half): illustration left + commentary/inspo/climate right
// Page B layout (bottom half): full calendar grid with dark header bar + footer
//
// ORIGINAL A4 landscape page: 426mm wide × 303mm tall (with 3mm bleed)
// A3 portrait stacked:        305mm wide × 428mm tall (with 4mm bleed)
//   top half  = Page A at 305mm × 210mm (trim) — same proportions as A4 landscape rotated
//   bottom half = Page B at 305mm × 210mm (trim)
//   binding safe zone: extra top margin on Page A (wire-O holes at top)
//   perf safe zone:    extra bottom margin on Page B
//
// The CSS is the original A4 design scaled to the A3 half-height (214mm with bleed).
// Nothing else changes.

var DAY_NAMES   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

var QUOTES = [
  { text: 'To forget how to dig the earth and tend the soil is to forget ourselves.', author: 'Mahatma Gandhi' },
  { text: 'A garden is a grand teacher. It teaches patience and careful watchfulness; it teaches industry and thrift.', author: 'Gertrude Jekyll, Home and Garden, 1900' },
  { text: "The kiss of the sun for pardon, the song of the birds for mirth \u2014 one is nearer God\u2019s heart in a garden than anywhere else on earth.", author: 'Dorothy Frances Gurney, 1913' },
  { text: 'God Almighty first planted a garden; and indeed it is the purest of human pleasures.', author: 'Francis Bacon, Essays, 1625' },
  { text: 'A garden must be looked into and dressed as the body.', author: 'George Herbert, Outlandish Proverbs, 1640' },
  { text: 'Who loves a garden still his Eden keeps, perennial pleasures plants, and wholesome harvests reaps.', author: 'Amos Bronson Alcott, 1868' },
  { text: "The garden is the poor man\u2019s apothecary.", author: 'German proverb' },
  { text: 'He who plants a garden plants happiness.', author: 'Chinese proverb' },
  { text: 'A garden is not made in a year; indeed it is never made in the sense of being finished.', author: 'H. H. Thomas, The Complete Gardener, 1912' },
  { text: 'All gardening is landscape painting.', author: 'Alexander Pope, c.\u00a01720' },
  { text: 'The best place to find God is in a garden. You can dig for him there.', author: 'George Bernard Shaw, 1932' },
  { text: 'The glory of gardening: hands in the dirt, head in the sun, heart with nature.', author: 'Alfred Austin, The Garden That I Love, 1894' },
];

// Hardcoded plant commentary — fact, care notes, enjoy notes per plant
var PLANT_COMMENTARY = {
  'rose':        { fact: 'Rosa has been cultivated for over 5,000 years. The oldest living rose is said to grow on the Cathedral of Hildesheim in Germany, planted around 815\u00a0AD.', care: 'Deadhead regularly to encourage continuous flowering. Feed with a high-potash fertiliser fortnightly from spring to late summer. Watch for blackspot in humid conditions.', enjoy: 'Few sights in the garden match a fully open rose in peak bloom \u2014 the layered petals, the scent carried on warm air, the colours deepening towards the centre.' },
  'iris':        { fact: 'The word iris means rainbow in Greek. The fleur-de-lis, symbol of French royalty, is derived from the iris \u2014 most likely Iris pseudacorus, the yellow flag iris native to France.', care: 'Divide congested rhizomes every three to four years, immediately after flowering. Plant shallowly with the top of the rhizome exposed to the sun to ripen and encourage flowering.', enjoy: 'Iris flowers have an almost architectural quality \u2014 the three upright standards and three drooping falls create a structure quite unlike any other flower in the garden.' },
  'lavender':    { fact: 'Lavender takes its name from the Latin lavare, to wash. Roman soldiers added it to their bathwater, and it was used to scent linen in Tudor England.', care: 'Trim plants after flowering to prevent woodiness, but never cut into bare old wood. Perfect drainage is essential \u2014 more lavender dies from wet roots than from drought.', enjoy: 'The combination of silver-grey foliage and purple flower spikes, alive with bees and butterflies, makes lavender one of the most complete sensory experiences in the summer garden.' },
  'tulip':       { fact: "Tulip mania gripped Holland in the 1630s, when a single bulb of the striped \u2018Semper Augustus\u2019 sold for more than a skilled craftsman could earn in a year. The striking colours were caused by a virus.", care: 'Plant bulbs 15\u00a0cm deep in autumn in well-drained soil. After flowering, allow the foliage to die back completely before removing \u2014 this replenishes the bulb for next year.', enjoy: 'Tulips bring an almost theatrical sense of colour to the spring garden. Their simple cup shape and jewel-bright colours seem to concentrate all the optimism of the season.' },
  'peony':       { fact: 'Peonies can live for over a century. There are records of specimens in English gardens that have been flowering in the same spot for more than 150 years without ever being divided.', care: 'Plant with the red growing buds (eyes) no more than 5\u00a0cm below the soil surface. Planting too deep is the single most common reason peonies fail to flower.', enjoy: 'When a peony opens fully, it becomes one of the most extravagant flowers in cultivation \u2014 layers of silky petals, often fragrant, in colours from deepest crimson to palest blush.' },
  'wisteria':    { fact: 'The largest known wisteria in the world grows in Sierra Madre, California, planted in 1894. It covers over 4,000 square metres and weighs an estimated 250 tonnes.', care: 'Prune twice a year: cut all new growth back to five leaves in midsummer, then reduce the same shoots to two or three buds in late winter. This builds up the flowering spurs.', enjoy: "Few flowering climbers match wisteria in full bloom \u2014 cascading racemes of lilac-blue or white flowers, intensely fragrant on warm days, transforming whatever they cover." },
  'camellia':    { fact: "Camellias are closely related to the tea plant, Camellia sinensis. Both originated in East Asia, where camellias have been cultivated for over 1,000 years.", care: 'Never let camellias dry out, especially in autumn when flower buds are forming. Mulch generously to retain moisture. Avoid planting in frost pockets.', enjoy: "Camellias are among the most glamorous of winter and early spring flowers \u2014 their glossy evergreen leaves and perfectly formed blooms appearing when little else is in flower." },
  'magnolia':    { fact: "Magnolias are among the most ancient of flowering plants, predating bees. They evolved to be pollinated by beetles, which is why the flowers are so robust.", care: "Avoid planting in frost pockets, as late frosts can destroy the flowers. Prune only when necessary, immediately after flowering. Never prune in autumn.", enjoy: "There is nothing subtle about a magnolia in full flower. The large, silky blooms open from furry buds with an almost theatrical sense of occasion, dominating the garden for weeks." },
  'hydrangea':   { fact: "Hydrangea flower colour is directly affected by soil pH. In acid soils the flowers turn blue; in alkaline soils they turn pink. White varieties are unaffected.", care: "Prune mophead and lacecap varieties in spring, cutting stems back to the first pair of fat, healthy buds. Leave old flowerheads on the plant over winter to protect new buds from frost.", enjoy: "Hydrangeas are the quintessential late-summer flowering shrub \u2014 large, rounded flowerheads in blues, pinks, and whites that persist for months and dry beautifully on the plant." },
  'foxglove':    { fact: "Digitalis, the heart medication derived from foxglove, was first described medicinally by William Withering in 1785. It remains an important drug today.", care: "Foxgloves are biennial \u2014 sow seed in June for flowers the following summer. They self-seed prolifically in the right conditions. Cut down flower spikes after flowering to encourage side shoots.", enjoy: "The tall spires of foxgloves bring a wild, woodland quality to the garden. Individually, each tubular flower is beautifully spotted inside \u2014 an invitation to peer in at the bee\u2019s-eye view." },
  'rosemary':    { fact: "Rosemary has been associated with memory since ancient Greece \u2014 students wore garlands of it during examinations. \u2018Rosemary for remembrance\u2019 appears in Shakespeare\u2019s Hamlet.", care: "Requires excellent drainage and full sun. Trim lightly after flowering to keep plants bushy, but never cut into old bare wood \u2014 rosemary will not regenerate from leafless stems.", enjoy: "Rosemary in full flower is a magnet for bees. The blue flowers, the silver-green needle-like foliage, and the intense Mediterranean fragrance make it one of the most useful plants in the garden." },
  'thyme':       { fact: "The ancient Greeks burned thyme as incense in their temples, and Roman soldiers bathed in thyme-infused water before battle, believing it conferred strength and courage.", care: "Trim hard after flowering to prevent plants becoming woody and sprawling. Excellent drainage is essential. Divide or replace plants every three to four years as they deteriorate with age.", enjoy: "Thyme in flower is a perfect miniature landscape \u2014 the tiny flowers covering every stem, alive with bumblebees on warm days, the whole plant intensely aromatic when touched." },
  'sage':        { fact: "The Latin name Salvia comes from salvare, to save \u2014 a reference to sage\u2019s long history as a medicinal herb. In medieval Europe it was said that a garden with sage needed no doctor.", care: "Cut back hard in spring to encourage fresh growth from the base. Replace plants every four to five years as they become woody. Excellent drainage is essential \u2014 sage detests wet roots.", enjoy: "Common sage is an underrated ornamental plant. The soft, textured grey-green leaves have a woolly surface that catches the light beautifully, and the purple flower spikes are attractive to bees." },
  'mint':        { fact: "There are over 600 varieties of mint, and they hybridise so freely that even botanists find them difficult to classify. Spearmint and peppermint are among the most familiar.", care: "Contain mint in pots or with a buried barrier \u2014 it spreads aggressively by underground runners and will take over a border within a season if left unchecked.", enjoy: "Mint is one of the most evocative garden scents \u2014 fresh, clean, and instantly recognisable. Running your hand along a stem and inhaling the scent is one of the small pleasures of the kitchen garden." },
  'fig':         { fact: "Figs are botanically unusual: what we eat is not a fruit but a syconium \u2014 an inverted flower structure containing hundreds of tiny flowers inside. The true fruits are the crunchy seeds within.", care: "Restrict roots to encourage fruiting \u2014 plant in a large container or line a pit with paving slabs. In cool climates, fan-train against a warm south-facing wall.", enjoy: "A fig tree in full leaf brings a Mediterranean quality to any garden. The large, deeply lobed leaves are architectural and beautiful, and ripe figs have an intensity of sweetness matched by few fruits." },
  'peach':       { fact: "Peaches originated in China, where they have been cultivated for over 4,000 years. They reached Europe via Persia, giving rise to the Latin name persica.", care: "Fan-train against a warm wall in cooler climates. Thin fruits to one per 20\u00a0cm after the natural June drop for the best size and flavour. Net against peach leaf curl in late winter.", enjoy: "A peach ripened on a warm wall, picked and eaten in the garden still warm from the sun, is one of the great pleasures of the fruit garden \u2014 sweet, fragrant, and entirely seasonal." },
  'cherry':      { fact: "A mature sweet cherry tree can produce up to 7,000 individual fruits in a single season. The wood of the cherry tree is highly prized by furniture makers for its rich, warm grain.", care: "Prune only in summer to minimise the risk of silver leaf disease. Net trees when fruit begins to colour \u2014 birds can strip a tree overnight.", enjoy: "Cherry blossom is among the most celebrated of all flowering trees. The explosion of white or pink flowers in early spring, often before the leaves, is a moment of pure seasonal joy." },
  'strawberry':  { fact: "The strawberry is not technically a berry. The red flesh is an enlarged receptacle; the true fruits are the small seeds on the surface.", care: "Replace plants every three years as productivity declines. Peg down runners into small pots to propagate. Mulch with straw as fruits develop to keep them clean and deter slugs.", enjoy: "The smell of a sun-warmed strawberry freshly picked from the plant is impossible to replicate commercially. Homegrown strawberries, eaten immediately, bear little resemblance to shop-bought fruit." },
  'raspberry':   { fact: "Raspberries are aggregate fruits, each composed of many small individual drupelets arranged around a central core. A single raspberry may contain up to 100 individual tiny fruits fused together.", care: "After fruiting, cut all canes of summer-fruiting varieties to the ground and tie in the new canes for the following year. Autumn-fruiting varieties can be cut to the ground in late winter.", enjoy: "Raspberries are one of the most rewarding of all soft fruits \u2014 prolific, easy to grow, and with a depth of flavour that intensifies when eaten fresh from the cane." },
  'grape':       { fact: "Evidence of winemaking dates back at least 8,000 years, making the grape one of the oldest cultivated plants. The genome of the grapevine contains more genes than the human genome.", care: "Prune hard to a framework of permanent rods each winter. Tie in new growth regularly during the growing season. Thin bunches in summer to improve air circulation and fruit size.", enjoy: "A grapevine in full growth has an extraordinary vitality \u2014 the tendrils reaching out to grip any support, the large leaves casting dappled shade, the developing bunches hanging in growing clusters." },
  'lemon':       { fact: "Lemon trees can carry flowers, unripe green fruit, and ripe yellow fruit all simultaneously. They never go fully dormant and, given warmth and light, will produce fruit year-round.", care: "Feed with a specialist citrus fertiliser monthly from spring to autumn. Bring under cover before the first frost in cool climates. Water consistently \u2014 erratic watering causes fruit to split.", enjoy: "A potted lemon tree in flower is one of the most intoxicating things in the garden. The intense, sweet fragrance of lemon blossom carries remarkable distances on still, warm evenings." },
  'olive':       { fact: "Some olive trees in the Mediterranean are genuinely ancient \u2014 carbon dating has confirmed specimens in Crete, Sardinia, and Lebanon that are estimated to be over 2,000 years old and still producing olives.", care: "Extremely drought-tolerant once established. Hardy to around \u221210\u00b0C, but young trees need protection in hard winters. Pot-grown olives should be moved under cover below \u22125\u00b0C.", enjoy: "The olive has an elegance and timelessness unlike almost any other tree. The silver-grey foliage catching the light, the gnarled ancient-looking trunks \u2014 it carries the Mediterranean with it." },
  'elderflower': { fact: "Elder has been considered a magical and medicinal plant throughout European history. Almost every part of the plant has been used \u2014 flowers for cordials, berries for wine, bark for purgatives.", care: "Elder grows vigorously and can become large \u2014 cut back hard every two to three years in late winter to keep it to a manageable size. Tolerates most soils and positions including shade.", enjoy: "Elderflowers in June have one of the most evocative scents in the countryside \u2014 sweet, slightly musky, and intensely summery. The large flat-topped flowerheads are beautiful in their own right." },
  'fennel':      { fact: "Fennel is one of the oldest cultivated plants. It was grown in ancient Egypt, Greece, and Rome, used as food, medicine, and \u2014 according to Pliny the Elder \u2014 as a remedy for improving eyesight.", care: "Fennel self-seeds vigorously \u2014 deadhead unless you want it to spread. Keep away from dill and coriander, which it will hybridise with. Cut to the ground in autumn.", enjoy: "Bronze fennel is one of the most beautiful foliage plants in the garden. The feathery, hair-fine leaves in deep copper-bronze catch the light and move gracefully in the slightest breeze." },
  'valerian':    { fact: "Valerian root has been used as a sedative and sleep aid since ancient Greece and Rome. Modern research has confirmed it contains compounds that interact with GABA receptors.", care: "Cut to the ground in autumn. Divide clumps every three to four years in spring or autumn. Self-seeds freely \u2014 deadhead to prevent unwanted spread. Tolerates most soils.", enjoy: "Valerian in full flower is a cloud of tiny pale pink or white flowers on tall stems, humming with butterflies and bees. It has a wildness and informality that suits cottage and naturalistic planting." },
  'quince':      { fact: "Quince is believed to be the \u2018golden apple\u2019 of Greek mythology \u2014 the fruit of discord that led ultimately to the Trojan War.", care: "Quinces are largely self-fertile and require little pruning beyond removing dead wood. They fruit best in warm summers \u2014 in cool climates, wall training in a sheltered position helps.", enjoy: "Quince is spectacular in both spring and autumn. The large white or pale pink blossom in April is beautiful; in October the golden-yellow fruits hanging heavily on the branches are extraordinary." },
  'almond':      { fact: "Almonds are the world\u2019s most widely grown tree nut. Botanically, the almond is a drupe \u2014 related to the peach, plum, and cherry. The part we eat is the seed inside the stone.", care: "In cool climates, plant against a warm south-facing wall to protect the early blossom from frost. Fan-training maximises heat absorption and fruit production in marginal climates.", enjoy: "Almond blossom appears very early in the year \u2014 sometimes in January or February \u2014 covering bare branches with pink-tinged white flowers before a single leaf has opened." },
  'apricot':     { fact: "Apricots originated in China over 4,000 years ago and reached Europe via Armenia \u2014 hence the species name armeniaca. Alexander the Great is credited with bringing them west.", care: "Fan-train against a warm south-facing wall in cool climates. Protect blossom from late frosts with fleece \u2014 apricots flower very early and a single frost can destroy the entire crop.", enjoy: "Apricots ripening on a warm wall are among the most beautiful sights in the fruit garden \u2014 the orange-gold skin, the warm fragrance, the knowledge that this is genuinely one of the finest fruits you can grow." },
  'mulberry':    { fact: "The mulberry takes decades to begin fruiting seriously. James I planted thousands of black mulberry trees across England in 1609 to establish a silk industry \u2014 unfortunately silk worms prefer white mulberry leaves.", care: "Mulberries need almost no pruning \u2014 simply remove dead wood if necessary in late summer. Avoid disturbing the roots. Stake young trees firmly as they have a shallow root system.", enjoy: "A mature mulberry tree is one of the most characterful in the garden \u2014 the gnarled trunk, the large lobed leaves casting deep shade, and in late summer the dark red fruits that stain everything they touch." },
};

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
// Mon-first: 0=Mon … 6=Sun
function getFirstDayMon(year, month) { return (new Date(year, month, 1).getDay() + 6) % 7; }

function getCommentary(plant) {
  if (!plant) return { fact: '', care: '', enjoy: '' };
  return PLANT_COMMENTARY[plant.toLowerCase()] || { fact: '', care: '', enjoy: '' };
}

function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Page A: illustration left + commentary right ──────────────────────────────
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
  var recipientName = opts.recipientName || '';

  var plantDisplay = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : monthName;
  var commentary   = getCommentary(plant);
  var quote        = QUOTES[monthIdx % QUOTES.length];

  // Climate bar
  var climateHtml = '';
  if (climateData && climateData._cd) {
    var cd = climateData._cd;
    var tMax  = cd.tMax  && cd.tMax[monthIdx]  != null ? Math.round(cd.tMax[monthIdx])  + '\u00b0C' : null;
    var tMin  = cd.tMin  && cd.tMin[monthIdx]  != null ? Math.round(cd.tMin[monthIdx])  + '\u00b0C' : null;
    var rain  = cd.precip && cd.precip[monthIdx]!= null ? Math.round(cd.precip[monthIdx]) + 'mm' : null;
    var sun   = cd.sunHrs && cd.sunHrs[monthIdx]!= null ? parseFloat(cd.sunHrs[monthIdx]).toFixed(1) + ' hrs sun/day' : null;
    var stats = [tMax ? ('High ' + tMax) : '', tMin ? ('Low ' + tMin) : '', rain ? (rain + ' rain') : '', sun || ''].filter(Boolean).join(' \u00b7 ');
    if (stats) {
      climateHtml = '<div class="climate-bar">'
        + '<span class="climate-region">' + esc(climate) + '</span>'
        + '<span class="climate-stats">' + stats + '</span>'
        + '</div>';
    }
  } else if (climate) {
    climateHtml = '<div class="climate-bar"><span class="climate-region">' + esc(climate) + '</span></div>';
  }

  // Inspo garden block
  var inspoHtml = '';
  if (inspo && inspo.name) {
    inspoHtml = '<div class="inspo-block">'
      + '<div class="section-label">Garden to visit this ' + esc(monthName) + '</div>';
    if (inspoPhotoB64) {
      inspoHtml += '<div class="inspo-photo"><img src="' + inspoPhotoB64 + '" alt="' + esc(inspo.name) + '"/></div>';
    }
    inspoHtml += '<div class="inspo-name">' + esc(inspo.name) + '</div>'
      + (inspo.location ? '<div class="inspo-location">' + esc(inspo.location) + '</div>' : '')
      + (inspo.highlight ? '<div class="inspo-highlight">' + esc(inspo.highlight) + '</div>' : '');
    if (inspoQrB64) {
      inspoHtml += '<div class="inspo-qr-row">'
        + '<img src="' + inspoQrB64 + '" width="44" height="44" alt="Search QR"/>'
        + '<span class="inspo-qr-lbl">Search &nearr;</span>'
        + '</div>';
    }
    inspoHtml += '</div>';
  }

  // App QR
  var appQrHtml = '';
  if (appQrB64) {
    appQrHtml = '<div class="qr-row">'
      + '<img src="' + appQrB64 + '" width="64" height="64" alt="app QR"/>'
      + '<div class="qr-label">Your digital<br/>garden calendar</div>'
      + '</div>';
  }

  return '<div class="cal-page page-a">'
    + '<div class="bleed-a">'
    + '<div class="page-a-layout">'

    + '<div class="col-artwork">'
    + (artworkB64
        ? '<img class="artwork-img" src="' + artworkB64 + '" alt="' + esc(plantDisplay) + ' botanical illustration"/>'
        : '<div class="artwork-placeholder"><div class="artwork-placeholder-text">' + esc(plantDisplay) + '</div></div>')
    + '<div class="artwork-footer">'
    + '<span class="artwork-plant-name">' + esc(plantDisplay) + '</span>'
    + '<span class="artwork-credit">K\u00f6hler\u2019s Medizinal-Pflanzen, 1887\u00a0\u00b7\u00a0Public Domain</span>'
    + '</div>'
    + '</div>'

    + '<div class="col-right">'
    + '<div class="page-header">'
    + '<div class="header-month">' + esc(monthName) + '\u00a0' + year + '</div>'
    + (recipientName ? '<div class="header-recipient">' + esc(recipientName) + '\u2019s Garden Calendar</div>' : '')
    + '</div>'
    + climateHtml
    + (commentary.fact  ? '<div class="commentary-section"><div class="section-label">Did you know?</div><div class="commentary-text fact-text">' + esc(commentary.fact) + '</div></div>' : '')
    + (commentary.enjoy ? '<div class="commentary-section"><div class="section-label">What to enjoy this month</div><div class="commentary-text">' + esc(commentary.enjoy) + '</div></div>' : '')
    + (commentary.care  ? '<div class="commentary-section"><div class="section-label">Care notes</div><div class="commentary-text">' + esc(commentary.care) + '</div></div>' : '')
    + inspoHtml
    + '<div class="page-footer">'
    + '<div class="quote-text">\u201c' + esc(quote.text) + '\u201d</div>'
    + '<div class="quote-attr">\u2014\u00a0' + esc(quote.author) + '</div>'
    + appQrHtml
    + '</div>'
    + '</div>'

    + '</div>'
    + '</div>'
    + '</div>';
}

// ── Page B: full calendar grid ────────────────────────────────────────────────
function buildPageB(opts) {
  var monthName     = opts.monthName;
  var monthIdx      = opts.monthIdx;
  var year          = opts.year;
  var plant         = opts.plant || '';
  var keyDates      = opts.keyDates || [];
  var holidays      = opts.holidays || [];
  var climate       = opts.climate || '';
  var recipientName = opts.recipientName || '';

  var plantDisplay = plant ? (plant.charAt(0).toUpperCase() + plant.slice(1)) : '';

  // Key date map (string parsing to avoid timezone issues)
  var keyDateMap = {};
  for (var i = 0; i < keyDates.length; i++) {
    var kd = keyDates[i];
    var parts = (kd.date || '').split('-');
    if (parseInt(parts[0],10) === year && (parseInt(parts[1],10) - 1) === monthIdx) {
      var kday = parseInt(parts[2], 10);
      if (!keyDateMap[kday]) keyDateMap[kday] = [];
      keyDateMap[kday].push(kd.label || '');
    }
  }

  // Holiday map
  var holidayDays = {}, holidayLabelMap = {};
  var daysInMonth = getDaysInMonth(year, monthIdx);
  for (var h = 0; h < holidays.length; h++) {
    var hol = holidays[h];
    var sp = (hol.startDate||'').split('-'), ep = (hol.endDate||'').split('-');
    var sy = parseInt(sp[0],10), sm = parseInt(sp[1],10)-1, sd = parseInt(sp[2],10);
    var ey = parseInt(ep[0],10), em = parseInt(ep[1],10)-1, ed = parseInt(ep[2],10);
    for (var d2 = 1; d2 <= daysInMonth; d2++) {
      var before = (sy < year)||(sy===year&&sm < monthIdx)||(sy===year&&sm===monthIdx&&sd<=d2);
      var after  = (ey > year)||(ey===year&&em > monthIdx)||(ey===year&&em===monthIdx&&ed>=d2);
      if (before && after) {
        holidayDays[d2] = true;
        if ((sy<year)||(sy===year&&sm<monthIdx)||(sy===year&&sm===monthIdx&&sd===d2)) {
          if (!holidayLabelMap[d2]) holidayLabelMap[d2] = hol.label || 'Holiday';
        }
      }
    }
  }

  var firstDow = getFirstDayMon(year, monthIdx);

  var gridHtml = '';
  // Day headers Mon–Sun
  var dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (var dn = 0; dn < 7; dn++) {
    var isWknd = dn >= 5;
    gridHtml += '<div class="cal-dow' + (isWknd ? ' cal-dow-wknd' : '') + '">' + dayNames[dn] + '</div>';
  }
  // Leading empties
  for (var e = 0; e < firstDow; e++) {
    gridHtml += '<div class="cal-cell cal-empty"></div>';
  }
  // Days
  for (var d = 1; d <= daysInMonth; d++) {
    var col = (firstDow + d - 1) % 7;
    var isWeekend = col >= 5;
    var isHol   = !!holidayDays[d];
    var isHolS  = holidayLabelMap[d] !== undefined;
    var kdList  = keyDateMap[d] || [];
    var cls = 'cal-cell'
      + (isWeekend ? ' cal-weekend' : '')
      + (isHol ? ' cal-holiday' : '')
      + (kdList.length ? ' cal-event' : '');
    var inner = '<span class="day-num">' + d + '</span>';
    if (isHolS) inner += '<span class="hol-label">' + esc(holidayLabelMap[d]) + '</span>';
    for (var k = 0; k < kdList.length; k++) {
      inner += '<span class="event-label">' + esc(kdList[k]) + '</span>';
    }
    gridHtml += '<div class="' + cls + '">' + inner + '</div>';
  }
  // Trailing empties
  var total = firstDow + daysInMonth;
  var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var t = 0; t < trailing; t++) {
    gridHtml += '<div class="cal-cell cal-empty"></div>';
  }

  return '<div class="cal-page page-b">'
    + '<div class="bleed-b">'
    + '<div class="page-b-layout">'
    + '<div class="cal-header">'
    + '<div class="cal-header-month">' + esc(monthName) + '</div>'
    + '<div class="cal-header-year">' + year + '</div>'
    + (plantDisplay ? '<div class="cal-header-plant">' + esc(plantDisplay) + '</div>' : '')
    + (recipientName ? '<div class="cal-header-recipient">' + esc(recipientName) + '\u2019s Garden Calendar</div>' : '')
    + '</div>'
    + '<div class="cal-grid-full">' + gridHtml + '</div>'
    + '<div class="cal-footer">'
    + '<span class="cal-footer-text">The Garden Calendar\u00a0\u00b7\u00a0garden-calendar-frontend.vercel.app</span>'
    + (climate ? '<span class="cal-footer-climate">' + esc(climate) + '</span>' : '')
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
}

// ── Blank page ────────────────────────────────────────────────────────────────
function buildBlankPage() {
  return '<div class="cal-page cal-blank"></div>';
}

// ── Build combined A3 page (Page A top + Page B bottom) ───────────────────────
function buildMonthPage(opts) {
  return buildPageA(opts) + buildPageB(opts);
}

// ── CSS ───────────────────────────────────────────────────────────────────────
// A3 portrait with 4mm bleed: 305mm × 428mm
// Each half = one A4 landscape equivalent: 305mm × 214mm (including its own bleed slice)
// Page A top bleed = 16mm (4mm bleed + 12mm wire-O binding safe zone)
// Page A bottom = 0 (abutts Page B — no bleed needed at the join)
// Page B top = 0 (abutts Page A)
// Page B bottom bleed = 12mm (4mm bleed + 8mm safe zone for perf/trim)
// Side bleed = 8mm each side (4mm bleed + 4mm safe)
//
// Net content area per half ≈ 289mm × 198mm — same proportions as original A4 design.

var SHARED_CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap');",
  ':root{--ink:#2C1A0A;--gold:#8B6914;--sage:#5A7A32;--cream:#F0EBE0;--parchment:#FDFAF4;--rust:#8A3A10;--muted:#7A5C2A;--border:rgba(139,105,20,0.22);}',
  'body{font-family:"Crimson Pro",Georgia,serif;color:var(--ink);background:var(--parchment);}',

  // Each .cal-page is exactly one A3 half (214mm tall × 305mm wide including bleed)
  // page-break-after ensures Puppeteer paginates after each combined month page
  '.cal-page{width:305mm;height:214mm;position:relative;overflow:hidden;background:var(--parchment);}',
  '.cal-blank{page-break-after:always;}',
  // Page A sits in the top half — extra top bleed for wire-O binding
  '.page-a{page-break-inside:avoid;}',
  // Page B sits directly below — extra bottom bleed for trim/perf
  '.page-b{page-break-after:always;page-break-inside:avoid;}',

  // bleed-a: 16mm top (binding safe), 8mm sides, 0mm bottom (joined to page-b)
  '.bleed-a{position:absolute;top:16mm;left:8mm;right:8mm;bottom:0;overflow:hidden;}',
  // bleed-b: 0mm top (joined to page-a), 8mm sides, 12mm bottom (trim safe)
  '.bleed-b{position:absolute;top:0;left:8mm;right:8mm;bottom:12mm;overflow:hidden;}',

  // ── PAGE A — identical to original A4 design ──
  '.page-a-layout{display:grid;grid-template-columns:155mm 1fr;height:100%;}',
  '.col-artwork{position:relative;overflow:hidden;background:#F7F2E8;border-right:0.4mm solid var(--border);display:flex;flex-direction:column;}',
  '.artwork-img{flex:1;width:100%;min-height:0;object-fit:contain;display:block;filter:sepia(5%) contrast(1.06);}',
  '.artwork-placeholder{flex:1;display:flex;align-items:center;justify-content:center;}',
  '.artwork-placeholder-text{font-family:"Playfair Display",serif;font-style:italic;font-size:20pt;color:var(--muted);opacity:0.4;}',
  '.artwork-footer{flex-shrink:0;padding:2mm 4mm;background:rgba(240,235,224,0.95);border-top:0.3mm solid var(--border);display:flex;justify-content:space-between;align-items:baseline;}',
  '.artwork-plant-name{font-family:"Playfair Display",serif;font-style:italic;font-size:10pt;color:var(--ink);}',
  '.artwork-credit{font-size:7pt;color:var(--muted);opacity:0.6;}',
  '.col-right{display:flex;flex-direction:column;padding:4mm 5mm;overflow:hidden;gap:0;}',
  '.page-header{border-bottom:0.4mm solid var(--gold);padding-bottom:2.5mm;margin-bottom:2.5mm;flex-shrink:0;}',
  '.header-month{font-family:"Playfair Display",serif;font-size:18pt;font-weight:600;color:var(--ink);}',
  '.header-recipient{font-size:8.5pt;color:var(--muted);letter-spacing:0.05em;margin-top:0.5mm;}',
  '.climate-bar{display:flex;justify-content:space-between;align-items:baseline;padding:1.5mm 2.5mm;background:rgba(139,105,20,0.06);border-left:0.8mm solid var(--gold);margin-bottom:2.5mm;flex-shrink:0;}',
  '.climate-region{font-size:8.5pt;font-style:italic;color:var(--muted);}',
  '.climate-stats{font-size:8pt;color:var(--ink);font-family:"Playfair Display",serif;}',
  '.commentary-section{margin-bottom:2.5mm;flex-shrink:0;}',
  '.section-label{font-family:"Playfair Display",serif;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);margin-bottom:1mm;display:block;}',
  '.commentary-text{font-size:9.5pt;line-height:1.5;color:var(--ink);}',
  '.fact-text{font-style:italic;}',
  '.inspo-block{margin-bottom:2.5mm;padding:2.5mm 3mm;background:rgba(139,105,20,0.05);border-left:0.8mm solid var(--gold);flex-shrink:0;}',
  '.inspo-photo{width:100%;max-height:28mm;overflow:hidden;margin-bottom:1.5mm;}',
  '.inspo-photo img{width:100%;height:auto;max-height:28mm;object-fit:contain;display:block;filter:sepia(8%) contrast(1.04);}',
  '.inspo-name{font-family:"Playfair Display",serif;font-size:10.5pt;font-weight:600;color:var(--ink);margin-bottom:0.5mm;}',
  '.inspo-location{font-size:8.5pt;color:var(--muted);margin-bottom:1mm;}',
  '.inspo-highlight{font-size:9pt;line-height:1.45;color:var(--ink);}',
  '.inspo-qr-row{display:flex;align-items:center;gap:2mm;margin-top:1mm;}',
  '.inspo-qr-row img{border:0.3mm solid var(--border);border-radius:1mm;padding:1mm;background:white;}',
  '.inspo-qr-lbl{font-size:7pt;color:var(--muted);font-style:italic;}',
  '.page-footer{margin-top:auto;border-top:0.3mm solid var(--border);padding-top:2.5mm;flex-shrink:0;}',
  '.quote-text{font-family:"Playfair Display",serif;font-style:italic;font-size:8.5pt;line-height:1.5;color:var(--ink);margin-bottom:1mm;}',
  '.quote-attr{font-size:7.5pt;color:var(--muted);margin-bottom:2mm;}',
  '.qr-row{display:flex;align-items:center;gap:3mm;}',
  '.qr-row img{border:0.3mm solid var(--border);border-radius:1mm;padding:1mm;background:white;}',
  '.qr-label{font-size:7pt;color:var(--muted);line-height:1.4;}',

  // ── PAGE B — identical to original A4 design ──
  '.page-b-layout{display:flex;flex-direction:column;height:100%;}',
  '.cal-header{display:flex;align-items:baseline;gap:5mm;padding:3.5mm 5mm 3mm;background:var(--ink);color:var(--parchment);flex-shrink:0;}',
  '.cal-header-month{font-family:"Playfair Display",serif;font-size:26pt;font-weight:600;letter-spacing:0.01em;}',
  '.cal-header-year{font-size:15pt;opacity:0.6;}',
  '.cal-header-plant{font-size:10pt;font-style:italic;opacity:0.7;flex:1;}',
  '.cal-header-recipient{font-size:8pt;opacity:0.5;letter-spacing:0.05em;text-transform:uppercase;}',
  '.cal-grid-full{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;min-height:0;border-left:0.3mm solid var(--border);border-top:0.3mm solid var(--border);}',
  '.cal-dow{font-size:8pt;text-align:center;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding:2.5mm;border-right:0.3mm solid var(--border);border-bottom:0.5mm solid var(--gold);background:rgba(139,105,20,0.04);grid-row:1;}',
  '.cal-dow-wknd{color:var(--rust);opacity:0.85;}',
  '.cal-cell{padding:2.5mm 3mm;border-right:0.3mm solid var(--border);border-bottom:0.3mm solid var(--border);display:flex;flex-direction:column;gap:1.2mm;overflow:hidden;}',
  '.cal-empty{background:rgba(0,0,0,0.015);}',
  '.cal-weekend{background:rgba(139,105,20,0.02);}',
  '.cal-holiday{background:rgba(90,122,50,0.08);}',
  '.cal-event{background:rgba(139,105,20,0.05);}',
  '.day-num{font-size:15pt;font-weight:500;color:var(--ink);line-height:1;margin-bottom:1mm;}',
  '.cal-weekend .day-num{color:var(--rust);}',
  '.cal-holiday .day-num{color:var(--sage);}',
  '.cal-event .day-num{color:var(--gold);}',
  '.hol-label{font-size:7.5pt;color:var(--sage);font-style:italic;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.event-label{font-size:8pt;color:var(--rust);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.cal-footer{display:flex;justify-content:space-between;align-items:center;padding:2mm 5mm;border-top:0.3mm solid var(--border);flex-shrink:0;}',
  '.cal-footer-text{font-size:7pt;color:var(--muted);opacity:0.6;letter-spacing:0.04em;}',
  '.cal-footer-climate{font-size:7pt;color:var(--muted);font-style:italic;opacity:0.7;}',
].join('\n');

// ── Full HTML document ────────────────────────────────────────────────────────
// Page size: 305mm × 428mm (A3 portrait with 4mm bleed)
// Each cal-page is 214mm tall; two per month = 428mm = one A3 sheet.
function buildDocument(pages) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>\n'
    + '* { box-sizing:border-box; margin:0; padding:0; }\n'
    + '@page { size:305mm 428mm; margin:0; }\n'
    + 'html,body { width:305mm; margin:0; padding:0; }\n'
    + SHARED_CSS + '\n'
    + '</style></head><body>\n'
    + pages.join('\n')
    + '\n</body></html>';
}

module.exports = {
  buildPageA:     buildPageA,
  buildPageB:     buildPageB,
  buildMonthPage: buildMonthPage,
  buildBlankPage: buildBlankPage,
  buildDocument:  buildDocument,
  getCommentary:  getCommentary,
  SHARED_CSS:     SHARED_CSS,
};
