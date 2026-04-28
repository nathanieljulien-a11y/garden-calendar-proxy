// pdfService.js (CommonJS)
// POST /generate-pdf — 24-page PDF, 2 pages per month
// Page A: artwork + plantCommentary.json notes + Claude inspo garden + climate data
// Page B: full calendar grid with key dates and holidays

var express   = require('express');
var QRCode    = require('qrcode');
var puppeteer = require('puppeteer-core');
var chromium  = require('@sparticuz/chromium');
var https     = require('https');
var http      = require('http');
var tpl       = require('./calendarTemplate.js');
var fs        = require('fs');
var path      = require('path');

// Load garden photo manifest once at startup
var _gardenPhotoManifest = {};
try {
  var _manifestPath = path.join(__dirname, 'garden-photos', 'manifest.json');
  _gardenPhotoManifest = JSON.parse(fs.readFileSync(_manifestPath, 'utf8'));
  console.log('[pdfService] Garden photo manifest loaded:', Object.keys(_gardenPhotoManifest).length, 'gardens');
} catch(e) {
  console.warn('[pdfService] Garden photo manifest not found — will fetch live:', e.message);
}

function readGardenPhotoFromDisk(gardenName) {
  if (!gardenName) return null;
  var fname = _gardenPhotoManifest[gardenName];
  if (!fname) return null;
  var fpath = path.join(__dirname, 'garden-photos', fname);
  try {
    if (!fs.existsSync(fpath)) return null;
    var buf = fs.readFileSync(fpath);
    return 'data:image/jpeg;base64,' + buf.toString('base64');
  } catch(e) { return null; }
}

// Load plant commentary once at startup
try {
  var _commentary = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'plantCommentary.json'), 'utf8')
  );
  tpl.setPlantCommentary(_commentary);
  console.log('[pdfService] plantCommentary loaded:', Object.keys(_commentary).length, 'plants');
} catch(e) {
  console.warn('[pdfService] plantCommentary not found — plant notes will be empty:', e.message);
}

var router = express.Router();

var FORMATS = {
  a3: { widthMm: 279.42, heightMm: 401.14, label: 'A3 Portrait Standard Wall Calendar' },
  a4: { widthMm: 305, heightMm: 218, label: 'A4 Landscape Wire-O Calendar' },
};


// ── Read artwork from disk (downloaded at build time by download-artwork.js) ───
var path = require('path');

function readArtworkAsBase64(plant) {
  if (!plant) return null;
  var key = plant.toLowerCase().trim();
  // Try jpg first, then png
  var exts = ['.jpg', '.png'];
  for (var i = 0; i < exts.length; i++) {
    var fp = path.join(__dirname, 'artwork', key + exts[i]);
    try {
      var buf = require('fs').readFileSync(fp);
      var ct  = exts[i] === '.png' ? 'image/png' : 'image/jpeg';
      return 'data:' + ct + ';base64,' + buf.toString('base64');
    } catch(e) { /* try next */ }
  }
  console.warn('[ART] Not found on disk:', key);
  return null;
}

// ── Geocode a city string to lat/lng via Photon (same as web app) ─────────────
function geocodeCity(city) {
  return new Promise(function(resolve) {
    if (!city) { resolve(null); return; }
    var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(city) + '&limit=1&lang=en';
    https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          var f = d.features && d.features[0];
          if (!f) { resolve(null); return; }
          resolve({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });
        } catch(e) { resolve(null); }
      });
    }).on('error', function() { resolve(null); })
      .setTimeout(8000, function() { resolve(null); });
  });
}

// ── Fetch climate data from Open-Meteo (same approach as web app) ─────────────
function fetchClimateData(lat, lng) {
  return new Promise(function(resolve) {
    if (lat == null || lng == null) { resolve(null); return; }
    // Open-Meteo climate API returns DAILY data — we fetch one representative year
    // and average each variable by calendar month ourselves
    var url = 'https://climate-api.open-meteo.com/v1/climate'
      + '?latitude=' + lat + '&longitude=' + lng
      + '&start_date=2000-01-01&end_date=2000-12-31'
      + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,daylight_duration'
      + '&models=EC_Earth3P_HR';
    https.get(url, { headers: { 'Accept': 'application/json' } }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          if (d.error) { resolve(null); return; }
          var daily = d.daily || {};
          var times      = daily.time                || [];
          var tMaxArr    = daily.temperature_2m_max  || [];
          var tMinArr    = daily.temperature_2m_min  || [];
          var precipArr  = daily.precipitation_sum   || [];
          var sunArr     = daily.sunshine_duration   || [];
          var dayArr     = daily.daylight_duration    || [];

          // Accumulate sums and counts per calendar month (0-indexed)
          var sums = { tMax:[],tMin:[],precip:[],sun:[] };
          var counts = [];
          for (var m = 0; m < 12; m++) {
            sums.tMax.push(0); sums.tMin.push(0);
            sums.precip.push(0); sums.sun.push(0);
            counts.push(0);
          }
          for (var i = 0; i < times.length; i++) {
            var mo = parseInt((times[i] || '').split('-')[1], 10) - 1;
            if (mo < 0 || mo > 11) continue;
            if (tMaxArr[i]   != null) { sums.tMax[mo]   += tMaxArr[i];   }
            if (tMinArr[i]   != null) { sums.tMin[mo]   += tMinArr[i];   }
            if (precipArr[i] != null) { sums.precip[mo] += precipArr[i]; }
            var sunVal = (sunArr[i] != null && sunArr[i] > 0) ? sunArr[i] : (dayArr[i] || 0);
            sums.sun[mo] += sunVal;
            counts[mo]++;
          }
          var tMax=[],tMin=[],precip=[],sunHrs=[];
          for (var m = 0; m < 12; m++) {
            var n = counts[m] || 1;
            tMax.push(parseFloat((sums.tMax[m] / n).toFixed(1)));
            tMin.push(parseFloat((sums.tMin[m] / n).toFixed(1)));
            precip.push(parseFloat((sums.precip[m]).toFixed(0)));   // monthly total
            sunHrs.push(parseFloat((sums.sun[m] / n / 3600).toFixed(1))); // avg hrs/day
          }
          resolve({ _cd: { tMax, tMin, precip, sunHrs } });
        } catch(e) { console.error('[PDF] climate parse error', e.message); resolve(null); }
      });
    }).on('error', function(e) { console.error('[PDF] climate fetch error', e.message); resolve(null); })
      .setTimeout(10000, function() { resolve(null); });
  });
}

// ── Call Claude Haiku for inspo garden only (one call per month) ──────────────
// Normalise a garden name for dedup comparison
// "RHS Wisley", "Wisley Garden", "RHS Garden Wisley" → "wisley"
function normaliseGardenName(name) {
  if (!name) return '';
  // Strip all common institutional words, then keep only alphanumeric
  // This means "RHS Garden Wisley", "Wisley Gardens", "Wisley Garden RHS" all → "wisley"
  return name.toLowerCase()
    .replace(/\b(rhs|nts|english heritage|national trust|the|garden|gardens|park|house|castle|abbey|hall|manor|place|estate|botanical|botanic|arboretum|pleasure grounds)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Single inspo fetch — returns Promise<{name,location,highlight,wikipedia?}|null>
// Curated garden seed lists by region — lat/lng bounding boxes [minLat,maxLat,minLng,maxLng]
var GARDEN_REGIONS = [
  { box:[50.8,51.9,-0.9,1.5], gardens:[
    'Royal Botanic Gardens, Kew','RHS Garden Wisley','Sissinghurst Castle Garden',
    'Great Dixter','Wakehurst','Hampton Court Palace Garden','Chelsea Physic Garden',
    'Emmetts Garden','Nymans','Sheffield Park and Garden','Penshurst Place',
    'Hever Castle Gardens','Chartwell','Knole Park','Scotney Castle',
    "Bateman's",'Borde Hill Garden','Leonardslee Lakes and Gardens',
    'Parham House and Gardens','West Dean Gardens','Denmans Garden',
    'Loseley Park','Painshill Park','Claremont Landscape Garden',
    'Polesden Lacey','The Savill Garden','Mottisfont','Exbury Gardens',
    'Jenkyn Place','Hannah Peschar Sculpture Garden','Pashley Manor Gardens',
  ]},
  { box:[49.9,51.5,-6.5,-1.8], gardens:[
    'Trebah Garden','Glendurgan Garden','Heligan Gardens','Trelissick Garden',
    'Tresco Abbey Garden','RHS Garden Rosemoor','Bicton Park Botanical Gardens',
    'Greenway','Coleton Fishacre','Killerton','Knightshayes','Tyntesfield',
    'Montacute House','Forde Abbey','Mapperton Gardens','Abbotsbury Subtropical Gardens',
    'Hestercombe Gardens','Prior Park Landscape Garden','Iford Manor','Stourhead',
    'Kingston Lacy','Athelhampton House',
  ]},
  { box:[51.5,53.5,-1.0,2.0], gardens:[
    'RHS Garden Hyde Hall','Beth Chatto Gardens','Anglesey Abbey',
    'Blickling Estate','Sandringham Gardens','Bressingham Gardens',
    'Helmingham Hall Gardens','Somerleyton Hall Gardens','Mannington Hall',
    'Benington Lordship','Doddington Hall Gardens','Burghley House Gardens',
  ]},
  { box:[51.3,53.5,-5.5,-1.0], gardens:[
    'Hidcote','Kiftsgate Court Gardens','Bodnant Garden','Powis Castle Garden',
    'Barnsley House','Bourton House Garden','Birmingham Botanical Gardens',
    'Upton House','Packwood House','Baddesley Clinton','Coton Manor Garden',
    'Cottesbrooke Hall Gardens','Erddig','Aberglasney Gardens',
    'National Botanic Garden of Wales',
  ]},
  { box:[53.0,55.8,-3.5,0.0], gardens:[
    'RHS Garden Harlow Carr','Studley Royal Water Garden','Newby Hall',
    'Castle Howard','Scampston Hall Walled Garden','York Gate Garden',
    'Alnwick Garden','Cragside','Wallington','Belsay Hall Gardens',
    'Levens Hall','Sizergh Castle','Holker Hall','Dalemain',
    'Tatton Park','Dunham Massey','Biddulph Grange Garden',
    'Wentworth Castle Gardens',
  ]},
  { box:[54.5,61.0,-8.0,-0.5], gardens:[
    'Royal Botanic Garden Edinburgh','Crarae Garden','Arduaine Garden',
    'Inverewe Garden','Crathes Castle Garden','Pitmedden Garden',
    'Branklyn Garden','Drummond Castle Gardens','Logan Botanic Garden',
    'Threave Garden','Culzean Castle and Country Park','Glenarn Garden',
  ]},
  { box:[51.3,55.5,-10.5,-5.5], gardens:[
    'National Botanic Gardens Dublin','Powerscourt Estate Gardens',
    'Killarney House Gardens','Glenveagh Castle Gardens',
    'Mount Usher Gardens','Birr Castle Demesne','Altamont Garden',
    'Rowallane Garden','Mount Stewart','Benvarden Garden',
  ]},
  { box:[49.5,53.6,2.5,7.2], gardens:[
    'Keukenhof','Hortus Botanicus Amsterdam','Clingendael Park',
    'Paleis Het Loo Gardens','Arboretum Kalmthout','Hex Castle Gardens',
  ]},
  { box:[41.5,51.1,-5.5,9.6], gardens:[
    "Giverny (Monet's Garden)",'Versailles Gardens','Vaux-le-Vicomte',
    'Villandry Gardens','Jardins de Marqueyssac','Jardin des Plantes Paris',
    'Château de Chaumont-sur-Loire Gardens',
  ]},
  { box:[46.0,55.5,5.5,17.5], gardens:[
    'Sanssouci Gardens Potsdam','Herrenhausen Gardens Hanover',
    'Munich Botanical Garden','Berlin Botanical Garden',
    'Schwetzingen Palace Gardens','Wilhelma Stuttgart',
    'Schönbrunn Palace Gardens','Belvedere Gardens Vienna','Insel Mainau',
  ]},
  { box:[24.0,50.0,-90.0,-60.0], gardens:[
    'Longwood Gardens','New York Botanical Garden','Brooklyn Botanic Garden',
    'Arnold Arboretum Boston','Dumbarton Oaks Washington DC',
    'Winterthur Garden','Chanticleer Garden','Wave Hill',
    'Ladew Topiary Gardens',
  ]},
  { box:[30.0,50.0,-130.0,-100.0], gardens:[
    'Butchart Gardens Victoria','Van Dusen Botanical Garden Vancouver',
    'Portland Japanese Garden','Huntington Library Gardens',
    'Filoli','San Francisco Botanical Garden','UC Berkeley Botanical Garden',
  ]},
  { box:[-47.0,-10.0,110.0,178.0], gardens:[
    'Royal Botanic Garden Sydney','Royal Botanic Gardens Melbourne',
    'Adelaide Botanic Garden','Kings Park Perth',
    'Christchurch Botanic Gardens','Hamilton Gardens New Zealand',
  ]},
];

function getRegionalGardens(lat, lng) {
  if (lat == null || lng == null) return [];
  for (var i = 0; i < GARDEN_REGIONS.length; i++) {
    var b = GARDEN_REGIONS[i].box;
    if (lat >= b[0] && lat <= b[1] && lng >= b[2] && lng <= b[3])
      return GARDEN_REGIONS[i].gardens;
  }
  return [];
}

function fetchInspoOne(plant, monthName, climate, lat, lng, apiKey, usedNames) {
  return new Promise(function(resolve) {
    if (!apiKey) { resolve(null); return; }
    var locationHint = lat && lng
      ? ' (approx. ' + Math.round(lat) + '°N ' + Math.round(Math.abs(lng)) + '°' + (lng < 0 ? 'W' : 'E') + ')'
      : '';
    // Only pass last 4 used names to keep prompt short
    var recentUsed = usedNames.slice(-4);
    var excludeClause = recentUsed.length
      ? '\n\nDo NOT suggest any of these: ' + recentUsed.join(', ') + '.'
      : '';
    var regionalGardens = getRegionalGardens(lat, lng);
    // Remove already-used gardens from the candidate list
    var candidates = regionalGardens.filter(function(g) {
      return usedNames.indexOf(g) === -1 && normaliseGardenName(g) !== '' &&
        usedNames.every(function(u) { return normaliseGardenName(u) !== normaliseGardenName(g); });
    });
    var gardenHint = candidates.length > 0
      ? '\n\nChoose from these verified gardens near ' + climate + ' (all are real and within day-trip distance): '
        + candidates.slice(0, 12).join(', ') + '.'
        + ' Pick the one that is most interesting specifically in ' + monthName + '.'
      : '';

    var prompt =
      'Suggest one real, publicly accessible garden worth visiting in ' + monthName
      + ' for someone based in ' + climate + locationHint + '.'
      + ' It must be within a comfortable day trip — preferably under 1.5 hours away.'
      + gardenHint
      + excludeClause
      + '\n\nThe highlight should mention something specific happening in that garden in ' + monthName + '.'
      + '\n\nReturn ONLY valid JSON with no markdown fences, no explanation, nothing before or after the JSON object:'
      + '\n{"name":"Full official garden name","location":"Town, County","highlight":"One specific sentence about what makes it worth visiting in ' + monthName + '.","wikipedia":"Wikipedia article title for this garden if one exists, else null"}';

    var body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }],
    });
    var opts = {
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    var req = https.request(opts, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        console.log('[PDF] inspo API status:', res.statusCode);
        try {
          var p = JSON.parse(data);
          if (p.error) { console.error('[PDF] inspo API error:', JSON.stringify(p.error)); resolve(null); return; }
          var text = (p.content && p.content[0] && p.content[0].text || '').trim();
          // Strip markdown fences robustly - find the actual JSON object
          var jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) { console.error('[PDF] inspo no JSON found in:', text.slice(0,100)); resolve(null); return; }
          resolve(JSON.parse(jsonMatch[0]));
        } catch(e) {
          console.error('[PDF] inspo parse error:', e.message, 'raw:', data.slice(0,200));
          resolve(null);
        }
      });
    });
    req.on('error', function(e) { console.error('[PDF] inspo req error:', e.message); resolve(null); });
    req.setTimeout(15000, function() { console.error('[PDF] inspo timeout'); req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// Fetch 12 inspo gardens sequentially so we can pass used-names for dedup
async function fetchAllInspos(plants, monthNames, monthIndices, climate, lat, lng, apiKey) {
  var inspos = [];
  var usedNormalised = []; // normalised names already used this calendar
  var usedDisplay = [];    // display names for the exclude clause

  for (var i = 0; i < 12; i++) {
    var result = await fetchInspoOne(
      plants[i], monthNames[i], climate, lat, lng, apiKey, usedDisplay
    );
    // Dedup: retry up to 3 times if we get a repeat
    var attempts = 0;
    while (result && result.name && attempts < 3) {
      var norm = normaliseGardenName(result.name);
      if (usedNormalised.indexOf(norm) === -1) break; // not a duplicate, keep it
      console.log('[PDF] Dedup: ' + result.name + ' already used, retrying...');
      usedDisplay.push(result.name);
      result = await fetchInspoOne(
        plants[i], monthNames[i], climate, lat, lng, apiKey, usedDisplay
      );
      attempts++;
    }
    if (result && result.name) {
      var norm = normaliseGardenName(result.name);
      usedNormalised.push(norm);
      usedDisplay.push(result.name);
    }
    inspos.push(result);
    console.log('[PDF] Inspo ' + (i+1) + '/12: ' + (result && result.name || 'null'));
  }
  return inspos;
}


// ── Fetch Wikipedia thumbnail for inspo garden (same as web app) ─────────────
function fetchImageAsBase64(imageUrl, _depth) {
  _depth = _depth || 0;
  return new Promise(function(resolve) {
    if (_depth > 4) { resolve(null); return; }
    var parsed = require('url').parse(imageUrl);
    var lib = parsed.protocol === 'https:' ? https : http;
    var opts = {
      hostname: parsed.hostname,
      path: parsed.path,
      headers: {
        'User-Agent': 'GardenCalendar/1.0',
        'Accept': 'image/png,image/jpeg,image/*',
      }
    };
    var req = lib.get(opts, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        var loc = res.headers.location;
        // Handle relative redirects
        if (loc.startsWith('/')) loc = parsed.protocol + '//' + parsed.hostname + loc;
        res.resume();
        return fetchImageAsBase64(loc, _depth + 1).then(resolve);
      }
      var chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() {
        var buf = Buffer.concat(chunks);
        if (buf.length < 500) { resolve(null); return; }
        var ct = res.headers['content-type'] || 'image/jpeg';
        if (!ct.includes('image')) { resolve(null); return; }
        resolve('data:' + ct.split(';')[0].trim() + ';base64,' + buf.toString('base64'));
      });
    });
    req.on('error', function() { resolve(null); });
    req.setTimeout(12000, function() { req.destroy(); resolve(null); });
  });
}

function fetchWikipediaPhoto(title) {
  return new Promise(function(resolve) {
    if (!title) { resolve(null); return; }
    var enc = encodeURIComponent(title.replace(/ /g,'_'));
    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + enc;
    var req = https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          var thumb = d.thumbnail && d.thumbnail.source;
          if (!thumb) { resolve(null); return; }
          fetchImageAsBase64(thumb).then(resolve);
        } catch(e) { console.error('[PDF] wiki parse error:', e.message); resolve(null); }
      });
    });
    req.on('error', function(e) { console.error('[PDF] wiki req error:', e.message); resolve(null); });
    req.setTimeout(8000, function() { req.destroy(); resolve(null); });
  });
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateOrder(body) {
  var errors = [];
  if (body.startMonth == null || body.startMonth < 1 || body.startMonth > 12)
    errors.push('startMonth must be 1-12 (January=1)');
  if (body.format && body.format !== 'a3' && body.format !== 'a4')
    errors.push('format must be a3 or a4 (default: a3)');
  if (!body.climate || typeof body.climate !== 'string')
    errors.push('climate region required');
  if (!Array.isArray(body.plants) || body.plants.length !== 12)
    errors.push('plants must be array of 12 plant names');
  if (body.keyDates && body.keyDates.length > 20)
    errors.push('maximum 20 key dates');
  if (body.holidays && body.holidays.length > 6)
    errors.push('maximum 6 holiday periods');
  return errors;
}

// ── Build full 24-page HTML ────────────────────────────────────────────────────
async function buildFullHTML(order, apiKey) {
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var fmt           = (order.format || 'a3').toLowerCase();
  var fmtConfig     = FORMATS[fmt] || FORMATS.a3;
  var startMonth    = order.startMonth - 1; // convert 1-12 to 0-11
  var year          = order.year || new Date().getFullYear();
  var plants        = order.plants;
  var keyDates      = order.keyDates || [];
  var holidays      = order.holidays || [];
  var climate       = order.climate;
  var city          = order.city || climate;
  var recipientName = order.recipientName || '';

  // Geocode and fetch climate data once upfront
  console.log('[PDF] keyDates received:', JSON.stringify(keyDates));
  console.log('[PDF] holidays received:', JSON.stringify(holidays));
  console.log('[PDF] Geocoding city: ' + city);
  var geo = await geocodeCity(city);
  var climateData = null;
  if (geo) {
    console.log('[PDF] Fetching climate data for', geo.lat, geo.lng);
    climateData = await fetchClimateData(geo.lat, geo.lng);
    console.log('[PDF] Climate data:', climateData ? 'OK' : 'not available');
  }

  // Read artwork from disk (downloaded at build time)
  console.log('[PDF] Reading artwork from disk...');
  var artworks = plants.map(function(p) { return readArtworkAsBase64(p); }); // reads from artwork/ dir committed to repo
  console.log('[PDF] Artwork loaded: ' + artworks.filter(Boolean).length + '/12');

  // Fetch 12 inspo gardens sequentially so dedup works across months
  console.log('[PDF] Fetching 12 inspo gardens (sequential + dedup)...');
  var inspoMonthNames = [], inspoMonthIdxs = [];
  for (var ii = 0; ii < 12; ii++) {
    var mIdx = (startMonth + ii) % 12;
    inspoMonthNames.push(MONTH_NAMES[mIdx]);
    inspoMonthIdxs.push(mIdx);
  }
  var inspos = await fetchAllInspos(
    plants, inspoMonthNames, inspoMonthIdxs,
    climate, geo && geo.lat, geo && geo.lng, apiKey
  );
  console.log('[PDF] Loading inspo garden photos (disk first, then Wikipedia)...');
  var inspoPhotoPromises = inspos.map(function(inspo) {
    if (!inspo || !inspo.name) return Promise.resolve(null);
    var diskPhoto = readGardenPhotoFromDisk(inspo.name);
    if (diskPhoto) return Promise.resolve(diskPhoto);
    var wikiTitle = inspo.wikipedia || inspo.name;
    return fetchWikipediaPhoto(wikiTitle);
  });
  var inspoPhotos = await Promise.all(inspoPhotoPromises);
  console.log('[PDF] Inspo photos: ' + inspoPhotos.filter(Boolean).length + '/12 found.');

  // Generate QR codes locally using qrcode package (no external HTTP needed)
  async function makeQrB64(url, ecl) {
    try {
      var dataUrl = await QRCode.toDataURL(url, {
        width: 150, margin: 2,
        errorCorrectionLevel: ecl || 'M',
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      return dataUrl;
    } catch(e) { console.error('[PDF] QR gen error:', e.message); return ''; }
  }

  var appUrl   = 'https://garden-calendar-frontend.vercel.app';
  var appQrB64 = await makeQrB64(appUrl);
  console.log('[PDF] App QR: ' + (appQrB64 ? 'ok' : 'failed'));

  var inspoQrB64s = await Promise.all(inspos.map(function(ins) {
    if (!ins || !ins.name) return Promise.resolve('');
    var searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(ins.name + ' ' + (ins.location || '') + ' official website');
    return makeQrB64(searchUrl);
  }));
  console.log('[PDF] Inspo QRs: ' + inspoQrB64s.filter(Boolean).length + '/12 ok');

// Per-month holiday ICS QRs are generated inside the month loop below.
  // Cover page no longer has ICS QR codes.
  
  // Build pages: blank cover + 12 months + blank back
  // A3: 14 pages (1 cover + 12 combined + 1 back)
  // A4: 26 pages (1 cover + 12 illus + 12 grid + 1 back)
  // 14 pages: blank cover + 12 months + blank back

  var coverMonthNames = [];
  for (var ci = 0; ci < 12; ci++) coverMonthNames.push(MONTH_NAMES[(startMonth + ci) % 12]);
  var endYear   = year + Math.floor((startMonth + 11) / 12);
  var dateRange = MONTH_NAMES[startMonth] + ' ' + year + ' \u2013 ' + MONTH_NAMES[(startMonth + 11) % 12] + ' ' + endYear;

  var pages = [];
  try {
    pages.push(tpl.buildCoverPage({
      calendarName:  order.calendarName || order.recipientName || '',
      dateRange:     dateRange,
      climate:       climate,
      climateData:   climateData,
      startMonthIdx: startMonth,
      artworks:      artworks,
      plants:        plants,
      monthNames:    coverMonthNames,
      appQrB64:      appQrB64,
      personalMsg:   order.personalMsg  || '',
      etsyUrl:       order.etsyUrl      || '',
    }));
    console.log('[PDF] Cover page built OK');
  } catch(coverErr) {
    console.error('[PDF] buildCoverPage CRASH:', coverErr.stack);
    throw coverErr;
  }

  for (var j = 0; j < 12; j++) {
    var mIdx  = (startMonth + j) % 12;
    var mYear = year + Math.floor((startMonth + j) / 12);
    var mName = MONTH_NAMES[mIdx];
    var plt   = plants[j] || '';

    var monthKeyDates = keyDates.filter(function(d) {
      if (!d.date) return false;
      var parts = d.date.split('-');
      return parseInt(parts[0], 10) === mYear && (parseInt(parts[1], 10) - 1) === mIdx;
    });
    var monthHolidays = holidays.filter(function(h) {
      if (!h.startDate || !h.endDate) return false;
      var sp = h.startDate.split('-'), ep = h.endDate.split('-');
      var sy = parseInt(sp[0],10), sm = parseInt(sp[1],10)-1;
      var ey = parseInt(ep[0],10), em = parseInt(ep[1],10)-1;
      var startsBeforeMonthEnd = (sy < mYear) || (sy === mYear && sm <= mIdx);
      var endsAfterMonthStart  = (ey > mYear) || (ey === mYear && em >= mIdx);
      return startsBeforeMonthEnd && endsAfterMonthStart;
    });
    if (monthKeyDates.length) console.log('[PDF] Month', mName, mYear, '- keyDates:', JSON.stringify(monthKeyDates));
    if (monthHolidays.length) console.log('[PDF] Month', mName, mYear, '- holidays:', JSON.stringify(monthHolidays));

    // Holiday ICS QR for this month (holidays starting this month only)
    var monthIcsStr = tpl.buildMonthICS(mIdx, mYear, keyDates, holidays);
    var monthIcsB64 = monthIcsStr ? await makeQrB64(monthIcsStr, 'M') : '';
    if (monthIcsStr) console.log('[PDF] Month ' + mName + ' holiday ICS QR: ' + monthIcsStr.length + ' chars');

    var monthOpts = {
      monthName: mName, monthIdx: mIdx, year: mYear,
      plant: plt, artworkB64: artworks[j] || '',
      inspo: inspos[j] || null,
      inspoPhotoB64: inspoPhotos[j] || '',
      inspoQrB64: inspoQrB64s[j] || '',
      appQrB64: appQrB64,
      climate: climate, climateData: climateData,
      calendarName: order.calendarName || order.recipientName || '',
      keyDates: monthKeyDates, holidays: monthHolidays,
      monthIcsB64: monthIcsB64,
    };
    pages.push(tpl.buildPageA(monthOpts));
    pages.push(tpl.buildPageB(monthOpts));
    console.log('[PDF] Month ' + (j+1) + ' (' + mName + ') built OK');
  }

  pages.push(tpl.buildBlankPage()); // page 14: blank back
  console.log('[PDF] Pages built: ' + pages.length + ' (14 = cover + 12 months + back, ' + fmt.toUpperCase() + ')');

  try {
    var doc = tpl.buildDocument(pages);
    console.log('[PDF] buildDocument OK, length:', doc.length);
    return doc;
  } catch(docErr) {
    console.error('[PDF] buildDocument CRASH:', docErr.stack);
    throw docErr;
  }
}

// ── Render PDF ────────────────────────────────────────────────────────────────
async function generatePDF(html) {
  // A3 portrait with bleed: 305mm × 428mm
  var widthMm = 279.42, heightMm = 401.14;
  var browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  try {
    var page = await browser.newPage();
    await page.setViewport({
      width:  Math.round(widthMm * 150 / 25.4),
      height: Math.round(heightMm * 150 / 25.4),
      deviceScaleFactor: 2,
    });
    // Images are base64 embedded — domcontentloaded is sufficient
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await new Promise(function(r) { setTimeout(r, 2000); }); // font render time
    return await page.pdf({
      width: widthMm + 'mm', height: heightMm + 'mm',
      printBackground: true, margin: { top:0, right:0, bottom:0, left:0 },
      timeout: 120000,
    });
  } finally {
    await browser.close();
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post('/generate-pdf', async function(req, res) {
  var errors = validateOrder(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  req.socket.setTimeout(180000);
  res.setTimeout(180000);

  var apiKey = process.env.ANTHROPIC_API_KEY || '';
  var t0 = Date.now();
  console.log('[PDF] Order: ' + req.body.climate + ', start ' + req.body.startMonth + ', ' + req.body.plants.join(','));

  try {
    var html = await buildFullHTML(req.body, apiKey);
    console.log('[PDF] HTML built (' + Math.round(html.length / 1024) + 'KB). Rendering...');
    var pdfBuffer = await generatePDF(html);

    // ── PDF/X-4 conversion with Ghostscript ───────────────────────────────
    var finalBuffer = pdfBuffer;
    try {
      var execSync = require('child_process').execSync;
      var tmpIn    = '/tmp/calendar_raw_' + Date.now() + '.pdf';
      var tmpOut   = '/tmp/calendar_x4_'  + Date.now() + '.pdf';
      var iccPath  = path.join(__dirname, 'GRACoL2006_Coated1v2.icc');
      fs.writeFileSync(tmpIn, pdfBuffer);
      var gsAvail  = require('child_process').spawnSync('which', ['gs']).status === 0;
      var iccAvail = fs.existsSync(iccPath);
      if (gsAvail && iccAvail) {
        var gsCmd = [
          'gs', '-dBATCH', '-dNOPAUSE', '-dNOSAFER', '-dQUIET',
          '-sDEVICE=pdfwrite',
          '-dPDFX',
          '-dCompatibilityLevel=1.6',
          '-sColorConversionStrategy=UseDeviceIndependentColor',
          '-dEncodeColorImages=true', '-dEncodeGrayImages=true',
          '-dAutoRotatePages=/None',
          '-sOutputFile=' + tmpOut,
          tmpIn,
        ].join(' ');
        execSync(gsCmd, { timeout: 60000 });
        finalBuffer = fs.readFileSync(tmpOut);
        console.log('[PDF] PDF/X-4 conversion OK (' + Math.round(finalBuffer.length/1024) + 'KB)');
      } else {
        console.warn('[PDF] Skipping PDF/X-4: gs=' + gsAvail + ' icc=' + iccAvail);
      }
      try { fs.unlinkSync(tmpIn); } catch(e){}
      try { fs.unlinkSync(tmpOut); } catch(e){}
    } catch(gsErr) {
      console.error('[PDF] PDF/X-4 failed, using standard PDF:', gsErr.message);
      finalBuffer = pdfBuffer;
    }

    console.log('[PDF] Done in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — ' + Math.round(finalBuffer.length / 1024) + 'KB');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="garden-calendar.pdf"',
      'Content-Length': finalBuffer.length,
    });
    res.end(finalBuffer);
  } catch(err) {
    console.error('[PDF] Error:', err.message);
    console.error('[PDF] STACK:', err.stack); res.status(500).json({ error: 'PDF generation failed', message: err.message, stack: err.stack });
  }
});

module.exports = router;
