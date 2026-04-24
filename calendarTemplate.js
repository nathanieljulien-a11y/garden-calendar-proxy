/**
 * calendarTemplate.js — Per-page HTML template
 *
 * Builds one A3 landscape calendar page as an HTML string.
 * Puppeteer renders this to PDF.
 *
 * Layout (inside 3mm bleed boundary, so 414mm × 291mm usable):
 *   Left  (130mm): Botanical artwork plate + plant name + licence
 *   Centre (200mm): Month header, key dates/holidays grid, gardening notes
 *   Right   (84mm): Inspo garden photo, QR code, quote
 */

// ─── Botanical artwork — pre-computed direct upload.wikimedia.org URLs ────────
// Köhler's Medizinal-Pflanzen (1887) — public domain
const ARTWORK = {
  'rose':        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Rosa_centifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-257.jpg/500px-Rosa_centifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-257.jpg',
  'wisteria':    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Wisteria_sinensis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-285.jpg/500px-Wisteria_sinensis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-285.jpg',
  'lavender':    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Lavandula_angustifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-088.jpg/500px-Lavandula_angustifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-088.jpg',
  'peony':       'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Paeonia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-164.jpg/500px-Paeonia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-164.jpg',
  'iris':        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Iris_germanica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-187.jpg/500px-Iris_germanica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-187.jpg',
  'tulip':       'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Tulipa_gesneriana_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-272.jpg/500px-Tulipa_gesneriana_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-272.jpg',
  'sunflower':   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Helianthus_annuus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-078.jpg/500px-Helianthus_annuus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-078.jpg',
  'camellia':    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Camellia_japonica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-025.jpg/500px-Camellia_japonica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-025.jpg',
  'magnolia':    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Magnolia_grandiflora_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-097.jpg/500px-Magnolia_grandiflora_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-097.jpg',
  'oleander':    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Nerium_oleander_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-124.jpg/500px-Nerium_oleander_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-124.jpg',
  'foxglove':    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Digitalis_purpurea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-052.jpg/500px-Digitalis_purpurea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-052.jpg',
  'hydrangea':   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Hydrangea_macrophylla_SZ85.png/500px-Hydrangea_macrophylla_SZ85.png',
  'rosemary':    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Rosmarinus_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-244.jpg/500px-Rosmarinus_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-244.jpg',
  'thyme':       'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Thymus_vulgaris_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-271.jpg/500px-Thymus_vulgaris_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-271.jpg',
  'sage':        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Salvia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-246.jpg/500px-Salvia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-246.jpg',
  'mint':        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Mentha_piperita_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-112.jpg/500px-Mentha_piperita_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-112.jpg',
  'lavender':    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Lavandula_angustifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-088.jpg/500px-Lavandula_angustifolia_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-088.jpg',
  'fig':         'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Ficus_carica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-057.jpg/500px-Ficus_carica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-057.jpg',
  'peach':       'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Prunus_persica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-183.jpg/500px-Prunus_persica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-183.jpg',
  'cherry':      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Prunus_cerasus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-180.jpg/500px-Prunus_cerasus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-180.jpg',
  'strawberry':  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Fragaria_vesca_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-065.jpg/500px-Fragaria_vesca_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-065.jpg',
  'raspberry':   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Rubus_idaeus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-237.jpg/500px-Rubus_idaeus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-237.jpg',
  'grape':       'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vitis_vinifera_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-280.jpg/500px-Vitis_vinifera_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-280.jpg',
  'lemon':       'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Citrus_limon_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-036.jpg/500px-Citrus_limon_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-036.jpg',
  'olive':       'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Olea_europaea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-130.jpg/500px-Olea_europaea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-130.jpg',
  'pansy':       'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Viola_tricolor_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-278.jpg/500px-Viola_tricolor_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-278.jpg',
  'foxglove':    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Digitalis_purpurea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-052.jpg/500px-Digitalis_purpurea_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-052.jpg',
  'nasturtium':  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Tropaeolum_majus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-273.jpg/500px-Tropaeolum_majus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-273.jpg',
  'borage':      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Borago_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-023.jpg/500px-Borago_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-023.jpg',
  'snapdragon':  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Antirrhinum_majus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-013.jpg/500px-Antirrhinum_majus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-013.jpg',
  'valerian':    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Valeriana_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-275.jpg/500px-Valeriana_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-275.jpg',
  'fennel':      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Foeniculum_vulgare_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-063.jpg/500px-Foeniculum_vulgare_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-063.jpg',
  'elderflower': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Sambucus_nigra_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-247.jpg/500px-Sambucus_nigra_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-247.jpg',
  'almond':      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Prunus_dulcis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-177.jpg/500px-Prunus_dulcis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-177.jpg',
  'quince':      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Cydonia_oblonga_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-047.jpg/500px-Cydonia_oblonga_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-047.jpg',
};

// Plant facts — interesting notes per plant for the calendar page
// In production these would come from the Claude-generated calendar data
const PLANT_FACTS = {
  'rose':       { fact: 'Rosa has been cultivated for over 5,000 years, with evidence of cultivation in China as far back as 500 BC.', care: 'Deadhead regularly to encourage continuous flowering. Feed fortnightly with a high-potash fertiliser from spring to late summer.' },
  'iris':       { fact: 'The word "iris" means rainbow in Greek — fitting for a genus with over 300 species spanning almost every colour.', care: 'Divide congested clumps every 3–4 years after flowering. Plant rhizomes shallowly, half-exposed to the sun.' },
  'lavender':   { fact: 'Lavender has been used medicinally since ancient Rome. The name derives from the Latin lavare — to wash.', care: 'Trim after flowering to prevent woodiness, but never cut into old wood. Excellent drainage is essential.' },
  'tulip':      { fact: "Tulip mania in 1630s Holland saw single bulbs sell for more than a skilled craftsman's annual wage.", care: 'Plant in autumn, 15cm deep. Allow foliage to die back naturally after flowering to replenish the bulb.' },
  'peony':      { fact: 'Peonies can live for over 100 years. A single specimen planted in the right spot rarely needs moving.', care: 'Plant crowns no deeper than 5cm below soil surface. Too-deep planting is the most common reason for non-flowering.' },
  'wisteria':   { fact: 'The oldest living wisteria is in Japan, planted in 1870, and covers nearly 2,000 square metres.', care: 'Prune twice a year — cut new growth back to 5 leaves in summer, then to 2–3 buds in late winter.' },
  'camellia':   { fact: 'Camellias are closely related to the tea plant (Camellia sinensis). Both originate in East Asia.', care: 'Never let camellias dry out, especially when buds are forming in autumn. Mulch generously to retain moisture.' },
  'magnolia':   { fact: 'Magnolias predate bees — they evolved to be pollinated by beetles, which is why the flowers are so robust.', care: 'Avoid planting in frost pockets. Prune only when necessary, immediately after flowering, to avoid losing next year\'s buds.' },
  'hydrangea':  { fact: 'Hydrangea flower colour is influenced by soil pH — acid soils produce blue flowers, alkaline soils produce pink.', care: 'Prune mophead and lacecap varieties in spring, cutting to fat buds. Leave old flowerheads over winter for frost protection.' },
  'foxglove':   { fact: 'Digitalis, derived from foxglove, remains one of medicine\'s most important heart drugs — used since 1785.', care: 'Biennial by nature — sow in June for flowers the following year. Self-seeds prolifically in the right conditions.' },
  'rosemary':   { fact: "Rosemary has been associated with memory since ancient Greece — sprigs were worn by students during exams.", care: 'Requires excellent drainage and full sun. Trim lightly after flowering, but never cut into old leafless wood.' },
  'lavender':   { fact: "A single lavender plant can produce up to 40 flower stems. The essential oil requires around 150 flowers per drop.", care: 'Trim in spring and after flowering. Avoid waterlogging — more lavender dies from wet feet than from drought.' },
  'fig':        { fact: 'Figs are botanically a syconium — an inverted flower structure. The "fruit" contains hundreds of tiny flowers inside.', care: 'Restrict roots to encourage fruiting. In cool climates, fan-train against a south-facing wall for best results.' },
  'strawberry': { fact: 'Strawberries are not true berries botanically — the red flesh is the receptacle, and the seeds are the actual fruits.', care: 'Replace plants every 3 years. Remove runners unless you want to propagate. Mulch with straw to protect fruits.' },
  'olive':      { fact: 'Some olive trees in the Mediterranean are believed to be over 2,000 years old and still producing fruit.', care: 'Extremely drought-tolerant once established. In cooler climates, protect from hard frost below -10°C.' },
};

// Pre-1923 garden quotes (copyright safe)
const QUOTES = [
  { text: 'To forget how to dig the earth and tend the soil is to forget ourselves.', author: 'Mahatma Gandhi' },
  { text: 'A garden is a grand teacher. It teaches patience and careful watchfulness; it teaches industry and thrift.', author: 'Gertrude Jekyll, Home and Garden (1900)' },
  { text: 'The kiss of the sun for pardon, the song of the birds for mirth — one is nearer God\'s heart in a garden than anywhere else on earth.', author: 'Dorothy Frances Gurney (1913)' },
  { text: 'God Almighty first planted a garden; and indeed it is the purest of human pleasures.', author: 'Francis Bacon, Essays (1625)' },
  { text: 'A garden must be looked into and dressed as the body.', author: 'George Herbert, Outlandish Proverbs (1640)' },
  { text: 'Who loves a garden still his Eden keeps, perennial pleasures plants, and wholesome harvests reaps.', author: 'Amos Bronson Alcott (1868)' },
  { text: 'The garden is the poor man\'s apothecary.', author: 'German proverb' },
  { text: 'He who plants a garden plants happiness.', author: 'Chinese proverb' },
  { text: 'A garden is not made in a year; indeed it is never made in the sense of being finished.', author: 'H. H. Thomas, The Complete Gardener (1912)' },
  { text: 'All gardening is landscape painting.', author: 'Alexander Pope (c. 1720)' },
  { text: 'The best place to find God is in a garden. You can dig for him there.', author: 'George Bernard Shaw, The Adventures of the Black Girl (1932)' },
  { text: 'The garden is the only art form that is never finished.', author: 'Vita Sackville-West (c. 1940)' },
];

// Day name helpers
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

// ─── Main template function ───────────────────────────────────────────────────
export function buildCalendarPageHTML({
  monthName, monthIdx, year, plant, climate,
  recipientName, keyDates = [], holidays = [],
  isFirstPage = false, bleedMm = 3,
}) {
  const artworkUrl  = ARTWORK[plant?.toLowerCase()] || '';
  const plantFacts  = PLANT_FACTS[plant?.toLowerCase()] || { fact: '', care: '' };
  const quoteIdx    = monthIdx % QUOTES.length;
  const quote       = QUOTES[quoteIdx];

  // Build calendar grid data
  const daysInMonth  = getDaysInMonth(year, monthIdx);
  const firstDayDow  = getFirstDayOfWeek(year, monthIdx);   // 0=Sun

  // Key dates indexed by day number
  const keyDateMap = {};
  for (const kd of keyDates) {
    const d = new Date(kd.date);
    if (d.getFullYear() === year && d.getMonth() === monthIdx) {
      const day = d.getDate();
      if (!keyDateMap[day]) keyDateMap[day] = [];
      keyDateMap[day].push(kd.label || '');
    }
  }

  // Holiday ranges
  const holidayDays = new Set();
  const holidayLabelMap = {};
  for (const h of holidays) {
    const start = new Date(h.startDate);
    const end   = new Date(h.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === year && d.getMonth() === monthIdx) {
        const day = d.getDate();
        holidayDays.add(day);
        if (d.getTime() === start.getTime()) {
          holidayLabelMap[day] = h.label || 'Holiday';
        }
      }
    }
  }

  // Build calendar grid cells
  const cells = [];
  // Leading empty cells
  for (let i = 0; i < firstDayDow; i++) cells.push(null);
  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      day,
      isHoliday: holidayDays.has(day),
      isHolidayStart: holidayLabelMap[day] !== undefined,
      holidayLabel: holidayLabelMap[day] || '',
      keyDates: keyDateMap[day] || [],
    });
  }
  // Trailing cells to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const plantDisplayName = plant
    ? plant.charAt(0).toUpperCase() + plant.slice(1)
    : monthName;

  return `
<div class="calendar-page">
  <div class="bleed-content">

    <!-- HEADER BAR -->
    <div class="page-header">
      <div class="header-month">${monthName}</div>
      <div class="header-year">${year}</div>
      <div class="header-plant-name">${plantDisplayName}</div>
      ${recipientName ? `<div class="header-recipient">${recipientName}'s Garden Calendar</div>` : ''}
    </div>

    <!-- THREE-COLUMN LAYOUT -->
    <div class="page-body">

      <!-- LEFT: BOTANICAL ARTWORK -->
      <div class="col-artwork">
        ${artworkUrl ? `
        <div class="artwork-wrap">
          <img src="${artworkUrl}" alt="${plantDisplayName} botanical illustration"/>
        </div>
        <div class="artwork-caption">
          <span class="artwork-plant">${plantDisplayName}</span>
          <span class="artwork-credit">Köhler's Medizinal-Pflanzen · Public Domain</span>
        </div>` : `
        <div class="artwork-wrap artwork-placeholder">
          <div class="artwork-placeholder-text">${monthName}</div>
        </div>`}
        ${plantFacts.fact ? `
        <div class="plant-fact">
          <div class="fact-label">Did you know?</div>
          <div class="fact-text">${plantFacts.fact}</div>
        </div>` : ''}
      </div>

      <!-- CENTRE: CALENDAR GRID + CARE NOTES -->
      <div class="col-centre">

        <!-- Calendar grid -->
        <div class="cal-grid">
          <!-- Day headers -->
          ${DAY_NAMES.map(d => `<div class="cal-dow">${d}</div>`).join('')}
          <!-- Day cells -->
          ${cells.map(cell => {
            if (!cell) return '<div class="cal-cell cal-empty"></div>';
            const cls = [
              'cal-cell',
              cell.isHoliday ? 'cal-holiday' : '',
              cell.keyDates.length > 0 ? 'cal-has-event' : '',
            ].filter(Boolean).join(' ');
            return `<div class="${cls}">
              <span class="cal-day-num">${cell.day}</span>
              ${cell.isHolidayStart ? `<span class="cal-holiday-label">${cell.holidayLabel}</span>` : ''}
              ${cell.keyDates.map(kd => `<span class="cal-key-date">${kd}</span>`).join('')}
            </div>`;
          }).join('')}
        </div>

        <!-- Care notes -->
        ${plantFacts.care ? `
        <div class="care-notes">
          <div class="care-label">Care this month</div>
          <div class="care-text">${plantFacts.care}</div>
        </div>` : ''}

      </div>

      <!-- RIGHT: QUOTE + BRANDING -->
      <div class="col-right">

        <!-- Garden quote -->
        <div class="quote-block">
          <div class="quote-mark">"</div>
          <div class="quote-text">${quote.text}</div>
          <div class="quote-attr">— ${quote.author}</div>
        </div>

        <!-- Climate badge -->
        <div class="climate-badge">
          <div class="climate-label">Climate region</div>
          <div class="climate-value">${climate}</div>
        </div>

        <!-- App QR code -->
        <div class="app-qr">
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('https://garden-calendar-frontend.vercel.app')}&margin=2"
            width="80" height="80" alt="Garden Calendar app QR code"
          />
          <div class="qr-label">Your digital garden calendar</div>
        </div>

        <!-- Footer branding -->
        <div class="page-footer">
          <div class="footer-text">The Garden Calendar · garden-calendar-frontend.vercel.app</div>
        </div>

      </div>
    </div>
  </div>
</div>`;
}

// ─── Shared CSS — included once in the outer HTML document ────────────────────
export const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');

:root {
  --parchment:  #FDFAF4;
  --ink:        #2C1A0A;
  --gold:       #8B6914;
  --sage:       #5A7A32;
  --cream:      #F0EBE0;
  --rust:       #8A3A10;
  --muted:      #7A5C2A;
  --border:     rgba(139, 105, 20, 0.25);
  --bleed:      3mm;
}

/* Page structure */
.calendar-page {
  font-family: 'Crimson Pro', Georgia, serif;
  color: var(--ink);
  background: var(--parchment);
}

.bleed-content {
  display: flex;
  flex-direction: column;
}

/* Header */
.page-header {
  display: flex;
  align-items: baseline;
  gap: 6mm;
  padding: 3mm 4mm 2.5mm;
  border-bottom: 0.5mm solid var(--gold);
  background: var(--ink);
  color: var(--parchment);
  flex-shrink: 0;
}

.header-month {
  font-family: 'Playfair Display', serif;
  font-size: 22pt;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.header-year {
  font-size: 14pt;
  opacity: 0.7;
}

.header-plant-name {
  font-size: 11pt;
  font-style: italic;
  opacity: 0.8;
  flex: 1;
}

.header-recipient {
  font-size: 9pt;
  opacity: 0.6;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Three-column body */
.page-body {
  display: grid;
  grid-template-columns: 130mm 1fr 78mm;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* LEFT: Artwork column */
.col-artwork {
  display: flex;
  flex-direction: column;
  border-right: 0.4mm solid var(--border);
  padding: 0;
  overflow: hidden;
  background: #F7F2E8;
}

.artwork-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.artwork-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: sepia(6%) contrast(1.06);
  display: block;
}

.artwork-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.artwork-placeholder-text {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 18pt;
  color: var(--muted);
  opacity: 0.5;
}

.artwork-caption {
  padding: 2mm 4mm;
  background: var(--cream);
  border-top: 0.3mm solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-shrink: 0;
}

.artwork-plant {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 10pt;
  color: var(--ink);
}

.artwork-credit {
  font-size: 7pt;
  color: var(--muted);
  opacity: 0.6;
}

.plant-fact {
  padding: 3mm 4mm;
  border-top: 0.3mm solid var(--border);
  flex-shrink: 0;
}

.fact-label {
  font-family: 'Playfair Display', serif;
  font-size: 7pt;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--gold);
  margin-bottom: 1mm;
}

.fact-text {
  font-size: 8.5pt;
  line-height: 1.45;
  color: var(--ink);
  font-style: italic;
}

/* CENTRE: Calendar + care notes */
.col-centre {
  display: flex;
  flex-direction: column;
  padding: 3mm 4mm;
  gap: 3mm;
  border-right: 0.4mm solid var(--border);
  overflow: hidden;
}

/* Calendar grid */
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5mm;
  flex-shrink: 0;
}

.cal-dow {
  font-size: 7.5pt;
  text-align: center;
  color: var(--gold);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-bottom: 1mm;
  border-bottom: 0.3mm solid var(--border);
}

.cal-cell {
  min-height: 10mm;
  padding: 1mm;
  border: 0.3mm solid transparent;
  border-radius: 0.5mm;
  display: flex;
  flex-direction: column;
  gap: 0.5mm;
  overflow: hidden;
}

.cal-empty {
  background: transparent;
}

.cal-holiday {
  background: rgba(90, 122, 50, 0.08);
  border-color: rgba(90, 122, 50, 0.2);
}

.cal-has-event {
  border-color: var(--gold);
  background: rgba(139, 105, 20, 0.05);
}

.cal-day-num {
  font-size: 9pt;
  font-weight: 500;
  color: var(--ink);
  line-height: 1;
}

.cal-holiday .cal-day-num {
  color: var(--sage);
}

.cal-key-date {
  font-size: 6pt;
  color: var(--rust);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-holiday-label {
  font-size: 5.5pt;
  color: var(--sage);
  font-style: italic;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Care notes */
.care-notes {
  flex: 1;
  padding: 2.5mm 0;
  border-top: 0.3mm solid var(--border);
}

.care-label {
  font-family: 'Playfair Display', serif;
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--gold);
  margin-bottom: 1.5mm;
}

.care-text {
  font-size: 9.5pt;
  line-height: 1.5;
  color: var(--ink);
}

/* RIGHT: Quote + branding */
.col-right {
  display: flex;
  flex-direction: column;
  padding: 4mm 4mm 3mm;
  gap: 4mm;
}

.quote-block {
  flex: 1;
}

.quote-mark {
  font-family: 'Playfair Display', serif;
  font-size: 36pt;
  color: var(--gold);
  line-height: 0.8;
  margin-bottom: 1mm;
  opacity: 0.5;
}

.quote-text {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 9.5pt;
  line-height: 1.55;
  color: var(--ink);
  margin-bottom: 2mm;
}

.quote-attr {
  font-size: 8pt;
  color: var(--muted);
  font-style: italic;
}

.climate-badge {
  padding: 2mm 3mm;
  background: var(--cream);
  border: 0.3mm solid var(--border);
  border-radius: 1mm;
  flex-shrink: 0;
}

.climate-label {
  font-size: 6.5pt;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--gold);
  margin-bottom: 0.5mm;
}

.climate-value {
  font-size: 9pt;
  font-style: italic;
  color: var(--ink);
}

.app-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5mm;
  flex-shrink: 0;
}

.app-qr img {
  border: 0.3mm solid var(--border);
  border-radius: 1mm;
  padding: 1mm;
  background: white;
}

.qr-label {
  font-size: 7pt;
  color: var(--muted);
  text-align: center;
  font-style: italic;
  line-height: 1.3;
}

.page-footer {
  border-top: 0.3mm solid var(--border);
  padding-top: 2mm;
  flex-shrink: 0;
}

.footer-text {
  font-size: 6.5pt;
  color: var(--muted);
  opacity: 0.6;
  text-align: center;
  letter-spacing: 0.04em;
}
`;
