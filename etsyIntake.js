// etsyIntake.js (CommonJS)
// "Proof-first" intake: read the buyer's answers straight from the Etsy receipt
// (start month, location, calendar name) so a proof can be generated immediately,
// without the buyer having to fill in the order form first.
//
// Pure functions only — no network, no store access — so everything here is unit
// testable (see test/etsyIntake.test.js).
//
// Where the answers live on an Etsy receipt (Open API v3):
//   receipt.transactions[0].variations[]  — each { property_id, formatted_name, formatted_value }
//     • Personalization box  → property_id 54 (formatted_name is seller-configured)
//     • Seller-defined variation (e.g. "Start month") → any other property_id
//
// Recommended listing setup (see OPERATIONS.md):
//   • Variation  "Start month"  — 12 options January … December, same price
//   • Personalization (required), instructions like:
//       "Location: Bath, UK / Name: The Smith Garden"

var MONTH_NAMES = ['january','february','march','april','may','june',
                   'july','august','september','october','november','december'];
var MONTH_ABBR  = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// ── Default plants for the first proof ────────────────────────────────────────
// One plant per CALENDAR month (index 0 = January). All have ≥2400px artwork and a
// plantCommentary.json entry. Used only for the first auto-generated proof — the
// buyer can change every plant in the customise form. Edit this list to taste.
var DEFAULT_PLANT_BY_MONTH = [
  'juniper',      // Jan
  'baylaurel',    // Feb
  'wildpansy',    // Mar
  'sourcherry',   // Apr
  'apple',        // May
  'foxglove',     // Jun
  'lavender',     // Jul
  'raspberry',    // Aug
  'autumncrocus', // Sep
  'quince',       // Oct
  'buckthorn',    // Nov
  'lemon',        // Dec
];

// plants[i] is shown in calendar month (startMonth + i), so rotate the list.
function defaultPlantsFor(startMonth) {
  var out = [];
  for (var i = 0; i < 12; i++) out.push(DEFAULT_PLANT_BY_MONTH[(startMonth - 1 + i) % 12]);
  return out;
}

// ── Month parsing ─────────────────────────────────────────────────────────────
// "March", "mar", "Sept", "3", "03" → 3.  Anything else → null.
function monthFromText(s) {
  if (s == null) return null;
  var t = String(s).trim().toLowerCase().replace(/[.,]/g, '');
  if (!t) return null;
  if (/^\d{1,2}$/.test(t)) {
    var n = parseInt(t, 10);
    return n >= 1 && n <= 12 ? n : null;
  }
  for (var i = 0; i < 12; i++) {
    if (t === MONTH_NAMES[i] || t === MONTH_ABBR[i] || (i === 8 && t === 'sept')) return i + 1;
  }
  // "starting in March", "start: March 2027" — find a month word inside short text
  if (t.length <= 40) {
    for (var j = 0; j < 12; j++) {
      if (new RegExp('\\b' + MONTH_NAMES[j] + '\\b').test(t)) return j + 1;
    }
  }
  return null;
}

// ── Label classification ──────────────────────────────────────────────────────
function classifyLabel(label) {
  var l = String(label || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!l) return null;
  if (/^(your |garden |calendar )?(location|city|town|place|where)( of (the )?garden)?$/.test(l)) return 'city';
  if (/^(start|starts|starting|start month|starting month|calendar starts|begin|begins|first month)$/.test(l)) return 'start';
  if (/^(your |garden |calendar |recipient )?(name|title)( on (the )?calendar)?$/.test(l) ||
      /^(calendar name|garden name|name of (the )?(garden|calendar)|recipient|for|calendar for)$/.test(l)) return 'name';
  if (/^(personal )?(message|note|dedication)$/.test(l)) return 'message';
  return null;
}

// ── Free-text personalization → labelled fields ───────────────────────────────
// Accepts segments split by newline, ";", "|" or " / ", each "Label: value"
// (also "Label = value" or "Label - value").  Unlabelled text is ignored.
function parsePersonalization(text) {
  var out = {};
  if (!text) return out;
  var segments = String(text).split(/\r?\n|;|\||\s\/\s/);
  segments.forEach(function(seg) {
    var m = seg.match(/^\s*([A-Za-z][A-Za-z ]{0,30}?)\s*(?::|=|\s[-–—]\s)\s*(.+?)\s*$/);
    if (!m) return;
    var kind = classifyLabel(m[1]);
    if (kind && !out[kind]) out[kind] = m[2];
  });
  return out;
}

// ── Collect raw answers from a receipt ───────────────────────────────────────
function _collectAnswers(receipt) {
  var found = {};            // city, name, start, message (raw strings)
  var reasons = [];
  var txs = (receipt && receipt.transactions) || [];

  if (txs.length !== 1) {
    reasons.push('receipt has ' + txs.length + ' transactions (expected exactly 1)');
    return { found: found, reasons: reasons };
  }
  if (txs[0].quantity != null && Number(txs[0].quantity) !== 1) {
    reasons.push('quantity is ' + txs[0].quantity + ' (expected 1)');
    return { found: found, reasons: reasons };
  }

  (txs[0].variations || []).forEach(function(v) {
    var name  = String(v.formatted_name  || '');
    var value = String(v.formatted_value || '').trim();
    if (!value) return;
    var nameKind = classifyLabel(name);
    var isPersonalization = Number(v.property_id) === 54 || /personali[sz]ation/i.test(name);

    if (nameKind && !found[nameKind]) {
      found[nameKind] = value;                       // question text names the field
    } else if (isPersonalization) {
      var p = parsePersonalization(value);           // free-text box with labelled lines
      Object.keys(p).forEach(function(k) { if (!found[k]) found[k] = p[k]; });
    } else if (/start|month/i.test(name) && !found.start) {
      found.start = value;                           // seller-defined "Start month" variation
    }
  });
  return { found: found, reasons: reasons };
}

function _cleanCity(s) {
  var c = String(s || '').replace(/\s+/g, ' ').trim().replace(/[.;:\-–—]+$/, '').trim();
  return c;
}

// ── Public: parse a receipt ───────────────────────────────────────────────────
// Returns { ok, reasons[], data: { city, startMonth, calendarName, nameDefaulted } }
function parseReceipt(receipt) {
  var collected = _collectAnswers(receipt);
  var f = collected.found;
  var reasons = collected.reasons.slice();

  var city = _cleanCity(f.city);
  if (!city) reasons.push('no location found');
  else if (city.length < 2 || city.length > 80 || !/[A-Za-zÀ-ɏ]/.test(city))
    reasons.push('location not usable: "' + city.slice(0, 40) + '"');

  var startMonth = monthFromText(f.start);
  if (!startMonth) reasons.push(f.start ? 'start month not understood: "' + String(f.start).slice(0, 30) + '"' : 'no start month found');

  var calendarName = String(f.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  var nameDefaulted = false;
  if (!calendarName && city) {
    calendarName = city.split(',')[0].trim() + ' Garden';   // "Bath, UK" → "Bath Garden"
    nameDefaulted = true;
  }

  // Optional cover message (the order form allows up to 200 characters)
  var personalMessage = String(f.message || '').replace(/\s+/g, ' ').trim().slice(0, 200);

  return {
    ok: reasons.length === 0,
    reasons: reasons,
    data: { city: city, startMonth: startMonth, calendarName: calendarName, nameDefaulted: nameDefaulted, personalMessage: personalMessage },
  };
}

// ── Public: order form data for the first proof ──────────────────────────────
// `now` is injectable for tests. Year logic mirrors the order form: a start month
// that is the current month or later means this year, otherwise next year.
function buildFormData(parsedData, receiptId, productId, now) {
  now = now || new Date();
  var start = parsedData.startMonth;
  var year  = start >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
  return {
    product:         productId,
    calendarName:    parsedData.calendarName,
    recipientName:   parsedData.calendarName,
    personalMessage: parsedData.personalMessage || '',
    city:            parsedData.city,
    startMonth:      start,
    year:            year,
    format:          'a3',
    plants:          defaultPlantsFor(start),
    keyDates:        [],
    holidays:        [],
    etsy_receipt_id: String(receiptId),
    source:          'etsy-intake',   // lets queueService send a fallback if generation fails
  };
}

// ── Public: link to the (pre-filled) order form ──────────────────────────────
// opts.includePlants — also pre-select the 12 plants used in the proof
function buildFormUrl(formBaseUrl, formData, opts) {
  opts = opts || {};
  var base = String(formBaseUrl || '').replace(/\/$/, '');
  var q = [
    'etsy_receipt_id=' + encodeURIComponent(formData.etsy_receipt_id || ''),
    'product='         + encodeURIComponent(formData.product || ''),
  ];
  if (formData.city)         q.push('city='  + encodeURIComponent(formData.city));
  if (formData.calendarName) q.push('name='  + encodeURIComponent(formData.calendarName));
  if (formData.startMonth)   q.push('start=' + encodeURIComponent(formData.startMonth));
  if (opts.includePlants && Array.isArray(formData.plants) && formData.plants.length === 12)
    q.push('plants=' + encodeURIComponent(formData.plants.join(',')));
  if (formData.personalMessage) q.push('msg=' + encodeURIComponent(formData.personalMessage));
  return base + '?' + q.join('&');
}

var MONTH_LABELS = MONTH_NAMES.map(function(m) { return m.charAt(0).toUpperCase() + m.slice(1); });

module.exports = {
  parseReceipt:          parseReceipt,
  parsePersonalization:  parsePersonalization,
  monthFromText:         monthFromText,
  buildFormData:         buildFormData,
  buildFormUrl:          buildFormUrl,
  defaultPlantsFor:      defaultPlantsFor,
  DEFAULT_PLANT_BY_MONTH: DEFAULT_PLANT_BY_MONTH,
  MONTH_LABELS:          MONTH_LABELS,
};
