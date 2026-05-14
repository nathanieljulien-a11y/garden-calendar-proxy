// products/garden-wall-calendar.js (CommonJS)
// All garden-specific logic extracted from pdfService.js and calendarTemplate.js.
// Implements the product interface consumed by pdfService.js's generic buildFullHTML loop:
//
//   product.validateOrder(body, errors)
//   product.buildSharedState(order, geo, apiKey)   → sharedState object
//   product.buildMonthContent(j, order, geo, sharedState) → per-month fields for buildPageA
//   product.buildPageA(monthOpts)                  → HTML string
//   product.buildCoverPage(opts)                   → HTML string

var fs   = require('fs');
var path = require('path');
var https = require('https');
var http  = require('http');

var climateChart = require('../utils/climateChart.js');

// ── Startup: index artwork files ──────────────────────────────────────────────
var _artworkFileMap = {};
try {
  var _artDir = path.join(__dirname, '..', 'artwork');
  fs.readdirSync(_artDir).forEach(function(f) {
    _artworkFileMap[f.toLowerCase()] = f;
  });
  console.log('[garden] Artwork files indexed:', Object.keys(_artworkFileMap).length);
} catch(e) {
  console.warn('[garden] Could not index artwork directory:', e.message);
}

// ── Startup: load garden photo manifest ──────────────────────────────────────
var _gardenPhotoManifest     = {};
var _gardenPhotoManifestNorm = {};

function _normaliseGardenKey(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

try {
  var _manifestPath = path.join(__dirname, '..', 'garden-photos', 'manifest.json');
  _gardenPhotoManifest = JSON.parse(fs.readFileSync(_manifestPath, 'utf8'));
  Object.keys(_gardenPhotoManifest).forEach(function(k) {
    _gardenPhotoManifestNorm[_normaliseGardenKey(k)] = _gardenPhotoManifest[k];
  });
  console.log('[garden] Garden photo manifest loaded:', Object.keys(_gardenPhotoManifest).length, 'gardens');
} catch(e) {
  console.warn('[garden] Garden photo manifest not found — will fetch live:', e.message);
}

function readGardenPhotoFromDisk(gardenName) {
  if (!gardenName) return null;
  var fname = _gardenPhotoManifest[gardenName]
           || _gardenPhotoManifestNorm[_normaliseGardenKey(gardenName)];
  if (!fname) return null;
  var fpath = path.join(__dirname, '..', 'garden-photos', fname);
  try {
    if (!fs.existsSync(fpath)) return null;
    return fs.readFileSync(fpath);
  } catch(e) { return null; }
}

// ── Startup: load plant commentary ───────────────────────────────────────────
var _plantCommentary = {};
try {
  _plantCommentary = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'plantCommentary.json'), 'utf8')
  );
  console.log('[garden] plantCommentary loaded:', Object.keys(_plantCommentary).length, 'plants');
} catch(e) {
  console.warn('[garden] plantCommentary not found — plant notes will be empty:', e.message);
}

function getCommentary(plant) {
  if (!plant) return { latin: '', habit: '', features: '', flowers: '', conditions: '', care: '', facts: [] };
  return _plantCommentary[plant.toLowerCase()] || { latin: '', habit: '', features: '', flowers: '', conditions: '', care: '', facts: [] };
}

// ── Artwork ───────────────────────────────────────────────────────────────────
// Display name overrides for plant keys that don't match their common name
var PLANT_DISPLAY = {
  lilyofthevalley: 'Lily of the Valley',
  limetree:        'Lime Tree',
};

var ARTWORK_SOURCES = {
  'koehler': 'K\u00f6hler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Public Domain \u00b7 Missouri Botanical Garden',
  'edwards': 'Edwards\u2019 Botanical Register, 1815\u20131847 \u00b7 Public Domain',
  'redoute': 'Trait\u00e9 des Arbres et Arbustes, Redout\u00e9 (1801\u20131819) \u00b7 Public Domain',
};
var ARTWORK_SOURCE_DEFAULT = 'K\u00f6hler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Public Domain \u00b7 Missouri Botanical Garden';

function readArtworkBuffer(plant) {
  if (!plant) return null;
  var key     = plant.toLowerCase().trim();
  var exts    = ['.jpg', '.png'];
  var prefixes = ['koehler', 'edwards', 'redoute'];

  for (var p = 0; p < prefixes.length; p++) {
    for (var e = 0; e < exts.length; e++) {
      var target = prefixes[p] + '_' + key + exts[e];
      var actual = _artworkFileMap[target];
      if (actual) {
        return {
          buf:    fs.readFileSync(path.join(__dirname, '..', 'artwork', actual)),
          source: ARTWORK_SOURCES[prefixes[p]] || ARTWORK_SOURCE_DEFAULT,
        };
      }
    }
  }
  // Fallback: legacy unprefixed filename
  for (var e = 0; e < exts.length; e++) {
    var target = key + exts[e];
    var actual = _artworkFileMap[target];
    if (actual) {
      return {
        buf:    fs.readFileSync(path.join(__dirname, '..', 'artwork', actual)),
        source: ARTWORK_SOURCE_DEFAULT,
      };
    }
  }
  console.warn('[garden] Artwork not found on disk:', key);
  return null;
}

// ── Region logic ──────────────────────────────────────────────────────────────
function _deriveUserRegion(cc, state, county, name) {
  if (cc === 'gb') {
    if (/scilly/.test(county) || /scilly/.test(name)) return 'uk-islands';
    if (/orkney|shetland|hebrides|skye/.test(county) || /orkney|shetland|hebrides|skye/.test(name)) return 'uk-islands';
    return 'uk';
  }
  if (cc === 'ie') return 'ireland';
  if (cc === 'fr') {
    if (/corsica|corse/.test(state) || /corsica|corse/.test(name)) return 'corsica';
    return 'mainland';
  }
  if (cc === 'es') {
    if (/balear|mallorca|menorca|ibiza|formentera/.test(state) || /balear|mallorca|menorca|ibiza|formentera/.test(name)) return 'mallorca';
    if (/canaria|canary|lanzarote|fuerteventura|gran canaria|tenerife|la palma|gomera|hierro/.test(state) || /canaria/.test(name)) return 'canary-islands';
    return 'mainland';
  }
  if (cc === 'pt') {
    if (/madeira/.test(state) || /madeira/.test(name)) return 'madeira';
    return 'mainland';
  }
  if (cc === 'it') {
    if (/sardegna|sardinia/.test(state) || /sardegna|sardinia/.test(name)) return 'sardinia';
    return 'mainland';
  }
  if (cc === 'us') {
    if (/hawaii/.test(state) || /hawaii/.test(name)) return 'hawaii';
    return 'mainland';
  }
  if (cc === 'gr') return 'mainland';
  if (cc === 'nz') return 'nz';
  if (cc === 'au') return 'mainland';
  return 'mainland';
}

var _REGION_COMPAT = {
  'uk':             ['uk'],
  'ireland':        ['ireland'],
  'uk-islands':     ['uk'],
  'corsica':        ['mainland'],
  'mallorca':       ['mallorca', 'mainland'],
  'canary-islands': ['mainland'],
  'madeira':        ['mainland'],
  'sardinia':       ['mainland'],
  'hawaii':         ['mainland'],
  'nz':             ['nz', 'au'],
  'mainland':       ['mainland'],
};

function _gardenCompatible(userRegion, gardenRegion) {
  var allowed = _REGION_COMPAT[userRegion] || ['mainland'];
  return allowed.indexOf(gardenRegion) !== -1;
}

// ── Garden database ───────────────────────────────────────────────────────────
var GARDENS = [
  // ── UK: South-East England ───────────────────────────────────────────────
  { name:'Royal Botanic Gardens, Kew',            lat:51.4787, lng:-0.2956,  region:'uk' },
  { name:'RHS Garden Wisley',                     lat:51.3084, lng:-0.4729,  region:'uk' },
  { name:'Sissinghurst Castle Garden',            lat:51.1108, lng:0.5856,   region:'uk' },
  { name:'Great Dixter House and Gardens',        lat:50.9839, lng:0.6283,   region:'uk' },
  { name:'Wakehurst',                             lat:51.0561, lng:-0.0759,  region:'uk' },
  { name:'Hampton Court Palace Garden',           lat:51.4036, lng:-0.3378,  region:'uk' },
  { name:'Chelsea Physic Garden',                 lat:51.4858, lng:-0.1676,  region:'uk' },
  { name:'Emmetts Garden',                        lat:51.2583, lng:0.0956,   region:'uk' },
  { name:'Nymans',                                lat:51.0297, lng:-0.2192,  region:'uk' },
  { name:'Sheffield Park and Garden',             lat:50.9731, lng:-0.0003,  region:'uk' },
  { name:'Penshurst Place',                       lat:51.1711, lng:0.1781,   region:'uk' },
  { name:'Hever Castle Gardens',                  lat:51.1861, lng:0.1122,   region:'uk' },
  { name:'Chartwell',                             lat:51.2647, lng:0.0711,   region:'uk' },
  { name:'Knole Park',                            lat:51.2681, lng:0.1864,   region:'uk' },
  { name:'Scotney Castle',                        lat:51.0878, lng:0.4078,   region:'uk' },
  { name:"Bateman's",                             lat:50.9942, lng:0.4264,   region:'uk' },
  { name:'Borde Hill Garden',                     lat:51.0453, lng:-0.1272,  region:'uk' },
  { name:'Leonardslee Lakes and Gardens',         lat:51.0025, lng:-0.2697,  region:'uk' },
  { name:'Parham House and Gardens',              lat:50.9281, lng:-0.4314,  region:'uk' },
  { name:'West Dean Gardens',                     lat:50.9292, lng:-0.7764,  region:'uk' },
  { name:'Denmans Garden',                        lat:50.8697, lng:-0.5611,  region:'uk' },
  { name:'Loseley Park',                          lat:51.2117, lng:-0.5886,  region:'uk' },
  { name:'Painshill Park',                        lat:51.3181, lng:-0.4703,  region:'uk' },
  { name:'Claremont Landscape Garden',            lat:51.3394, lng:-0.4447,  region:'uk' },
  { name:'Polesden Lacey',                        lat:51.2642, lng:-0.3739,  region:'uk' },
  { name:'The Savill Garden',                     lat:51.4242, lng:-0.5833,  region:'uk' },
  { name:'Mottisfont',                            lat:51.0553, lng:-1.5319,  region:'uk' },
  { name:'Exbury Gardens',                        lat:50.8164, lng:-1.4019,  region:'uk' },
  { name:'Pashley Manor Gardens',                 lat:51.0336, lng:0.4914,   region:'uk' },
  { name:'Merriments Gardens',                    lat:50.9817, lng:0.5247,   region:'uk' },
  // ── UK: South-West England ───────────────────────────────────────────────
  { name:'Trebah Garden',                         lat:50.0939, lng:-5.1114,  region:'uk' },
  { name:'Glendurgan Garden',                     lat:50.1003, lng:-5.0878,  region:'uk' },
  { name:'Heligan Gardens',                       lat:50.2628, lng:-4.8022,  region:'uk' },
  { name:'Trelissick Garden',                     lat:50.2017, lng:-5.0231,  region:'uk' },
  { name:'Tresco Abbey Garden',                   lat:49.9542, lng:-6.3306,  region:'uk' },
  { name:'RHS Garden Rosemoor',                   lat:50.8839, lng:-3.9931,  region:'uk' },
  { name:'Bicton Park Botanical Gardens',         lat:50.6856, lng:-3.3803,  region:'uk' },
  { name:'Greenway',                              lat:50.3903, lng:-3.6069,  region:'uk' },
  { name:'Coleton Fishacre',                      lat:50.3289, lng:-3.5517,  region:'uk' },
  { name:'Killerton',                             lat:50.7742, lng:-3.4764,  region:'uk' },
  { name:'Knightshayes Court',                    lat:50.9403, lng:-3.5061,  region:'uk' },
  { name:'Tyntesfield',                           lat:51.4047, lng:-2.7531,  region:'uk' },
  { name:'Montacute House',                       lat:50.9406, lng:-2.7119,  region:'uk' },
  { name:'Forde Abbey',                           lat:50.8161, lng:-2.8711,  region:'uk' },
  { name:'Mapperton Gardens',                     lat:50.7750, lng:-2.7194,  region:'uk' },
  { name:'Abbotsbury Subtropical Gardens',        lat:50.6617, lng:-2.5981,  region:'uk' },
  { name:'Hestercombe Gardens',                   lat:51.0322, lng:-3.1342,  region:'uk' },
  { name:'Prior Park Landscape Garden',           lat:51.3672, lng:-2.3497,  region:'uk' },
  { name:'Iford Manor',                           lat:51.3372, lng:-2.2694,  region:'uk' },
  { name:'Stourhead',                             lat:51.1003, lng:-2.2958,  region:'uk' },
  { name:'Kingston Lacy',                         lat:50.8019, lng:-2.0172,  region:'uk' },
  { name:'Athelhampton House',                    lat:50.7406, lng:-2.3742,  region:'uk' },
  { name:'The Garden House Devon',                lat:50.5194, lng:-4.1122,  region:'uk' },
  { name:'Cotehele',                              lat:50.4956, lng:-4.2200,  region:'uk' },
  { name:'Antony House',                          lat:50.3944, lng:-4.2361,  region:'uk' },
  { name:'Caerhays Castle Garden',                lat:50.2275, lng:-4.8764,  region:'uk' },
  { name:'East Lambrook Manor Gardens',           lat:50.9281, lng:-2.8242,  region:'uk' },
  { name:'Barrington Court',                      lat:50.9322, lng:-2.8833,  region:'uk' },
  // ── UK: East of England ──────────────────────────────────────────────────
  { name:'RHS Garden Hyde Hall',                  lat:51.6689, lng:0.6303,   region:'uk' },
  { name:'Beth Chatto Gardens',                   lat:51.8400, lng:0.9556,   region:'uk' },
  { name:'Anglesey Abbey',                        lat:52.2358, lng:0.2086,   region:'uk' },
  { name:'Blickling Estate',                      lat:52.8072, lng:1.2219,   region:'uk' },
  { name:'Sandringham Gardens',                   lat:52.8331, lng:0.5058,   region:'uk' },
  { name:'Bressingham Gardens',                   lat:52.4333, lng:1.0742,   region:'uk' },
  { name:'Helmingham Hall Gardens',               lat:52.1736, lng:1.1117,   region:'uk' },
  { name:'Somerleyton Hall Gardens',              lat:52.5117, lng:1.6869,   region:'uk' },
  { name:'Mannington Hall',                       lat:52.7864, lng:1.1672,   region:'uk' },
  { name:'Doddington Hall Gardens',               lat:53.1828, lng:-0.5594,  region:'uk' },
  { name:'Burghley House Gardens',                lat:52.6503, lng:-0.4597,  region:'uk' },
  { name:'Felbrigg Hall',                         lat:52.8792, lng:1.2703,   region:'uk' },
  { name:'Oxburgh Hall',                          lat:52.5833, lng:0.5972,   region:'uk' },
  { name:'Houghton Hall Walled Garden',           lat:52.8347, lng:0.6319,   region:'uk' },
  { name:'Wimpole Estate',                        lat:52.1286, lng:-0.0458,  region:'uk' },
  { name:'Audley End House and Gardens',          lat:52.0203, lng:0.2058,   region:'uk' },
  { name:'Peckover House',                        lat:52.5992, lng:0.1556,   region:'uk' },
  { name:'Elton Hall Gardens',                    lat:52.5450, lng:-0.3797,  region:'uk' },
  { name:'Grimsthorpe Castle Gardens',            lat:52.7725, lng:-0.4364,  region:'uk' },
  // ── UK: Midlands & Wales ─────────────────────────────────────────────────
  { name:'Hidcote',                               lat:52.0808, lng:-1.7311,  region:'uk' },
  { name:'Kiftsgate Court Gardens',               lat:52.0817, lng:-1.7333,  region:'uk' },
  { name:'Bodnant Garden',                        lat:53.2344, lng:-3.8011,  region:'uk' },
  { name:'Powis Castle Garden',                   lat:52.5997, lng:-3.2042,  region:'uk' },
  { name:'Barnsley House',                        lat:51.7853, lng:-1.8369,  region:'uk' },
  { name:'Bourton House Garden',                  lat:51.8972, lng:-1.7419,  region:'uk' },
  { name:'Birmingham Botanical Gardens',          lat:52.4731, lng:-1.9289,  region:'uk' },
  { name:'Upton House',                           lat:52.0747, lng:-1.5317,  region:'uk' },
  { name:'Packwood House',                        lat:52.3419, lng:-1.7328,  region:'uk' },
  { name:'Baddesley Clinton',                     lat:52.3464, lng:-1.7172,  region:'uk' },
  { name:'Coton Manor Garden',                    lat:52.3303, lng:-1.0919,  region:'uk' },
  { name:'Cottesbrooke Hall Gardens',             lat:52.3772, lng:-1.0167,  region:'uk' },
  { name:'Erddig',                                lat:52.9911, lng:-3.0044,  region:'uk' },
  { name:'Aberglasney Gardens',                   lat:51.8942, lng:-4.1703,  region:'uk' },
  { name:'National Botanic Garden of Wales',      lat:51.8567, lng:-4.1111,  region:'uk' },
  { name:'Ragley Hall Gardens',                   lat:52.2003, lng:-1.8428,  region:'uk' },
  { name:'Charlecote Park',                       lat:52.2086, lng:-1.6264,  region:'uk' },
  { name:'Hanbury Hall',                          lat:52.2792, lng:-2.1028,  region:'uk' },
  { name:'Wightwick Manor Gardens',               lat:52.5664, lng:-2.1747,  region:'uk' },
  { name:'Chirk Castle Gardens',                  lat:52.9342, lng:-3.0758,  region:'uk' },
  { name:'Dyffryn House and Gardens',             lat:51.4353, lng:-3.3061,  region:'uk' },
  // ── UK: North of England ─────────────────────────────────────────────────
  { name:'RHS Garden Harlow Carr',                lat:53.9894, lng:-1.5389,  region:'uk' },
  { name:'Studley Royal Water Garden',            lat:54.1214, lng:-1.5811,  region:'uk' },
  { name:'Newby Hall',                            lat:54.1031, lng:-1.4917,  region:'uk' },
  { name:'Castle Howard',                         lat:54.1214, lng:-0.9383,  region:'uk' },
  { name:'Scampston Hall Walled Garden',          lat:54.2042, lng:-0.6483,  region:'uk' },
  { name:'York Gate Garden',                      lat:53.8514, lng:-1.5978,  region:'uk' },
  { name:'Alnwick Garden',                        lat:55.4153, lng:-1.7050,  region:'uk' },
  { name:'Cragside',                              lat:55.3167, lng:-1.8806,  region:'uk' },
  { name:'Wallington',                            lat:55.1278, lng:-1.9503,  region:'uk' },
  { name:'Belsay Hall Gardens',                   lat:55.0861, lng:-1.8706,  region:'uk' },
  { name:'Levens Hall',                           lat:54.3031, lng:-2.7419,  region:'uk' },
  { name:'Sizergh Castle',                        lat:54.3100, lng:-2.7019,  region:'uk' },
  { name:'Holker Hall Gardens',                   lat:54.1836, lng:-2.9447,  region:'uk' },
  { name:'Dalemain',                              lat:54.6489, lng:-2.8256,  region:'uk' },
  { name:'Tatton Park',                           lat:53.3239, lng:-2.3825,  region:'uk' },
  { name:'Dunham Massey',                         lat:53.3842, lng:-2.3658,  region:'uk' },
  { name:'Biddulph Grange Garden',                lat:53.1289, lng:-2.1675,  region:'uk' },
  { name:'Wentworth Castle Gardens',              lat:53.5225, lng:-1.5347,  region:'uk' },
  { name:'Beningbrough Hall',                     lat:54.0233, lng:-1.1883,  region:'uk' },
  { name:'Nunnington Hall',                       lat:54.1675, lng:-1.0108,  region:'uk' },
  { name:'Parcevall Hall Gardens',                lat:54.0581, lng:-1.9211,  region:'uk' },
  { name:'Harewood House Gardens',                lat:53.8925, lng:-1.5381,  region:'uk' },
  // ── UK: Scotland ─────────────────────────────────────────────────────────
  { name:'Royal Botanic Garden Edinburgh',        lat:55.9678, lng:-3.2111,  region:'uk' },
  { name:'Crarae Garden',                         lat:56.0631, lng:-5.2297,  region:'uk' },
  { name:'Arduaine Garden',                       lat:56.2028, lng:-5.5497,  region:'uk' },
  { name:'Inverewe Garden',                       lat:57.7878, lng:-5.6011,  region:'uk' },
  { name:'Crathes Castle Garden',                 lat:57.0556, lng:-2.5281,  region:'uk' },
  { name:'Pitmedden Garden',                      lat:57.2781, lng:-2.2197,  region:'uk' },
  { name:'Branklyn Garden',                       lat:56.4028, lng:-3.4094,  region:'uk' },
  { name:'Drummond Castle Gardens',               lat:56.3789, lng:-3.8611,  region:'uk' },
  { name:'Logan Botanic Garden',                  lat:54.7197, lng:-4.9569,  region:'uk' },
  { name:'Threave Garden',                        lat:54.9261, lng:-3.9942,  region:'uk' },
  { name:'Culzean Castle and Country Park',       lat:55.3550, lng:-4.7939,  region:'uk' },
  { name:'Glenarn Garden',                        lat:56.0097, lng:-4.7797,  region:'uk' },
  { name:'Younger Botanic Garden Benmore',        lat:56.0608, lng:-4.9997,  region:'uk' },
  { name:'Castle Kennedy Gardens',                lat:54.8800, lng:-4.9569,  region:'uk' },
  { name:'Scone Palace Gardens',                  lat:56.4269, lng:-3.4139,  region:'uk' },
  { name:'House of Dun',                          lat:56.6778, lng:-2.5167,  region:'uk' },
  { name:'Glamis Castle Gardens',                 lat:56.6086, lng:-3.0003,  region:'uk' },
  // ── Ireland ──────────────────────────────────────────────────────────────
  { name:'National Botanic Gardens Dublin',       lat:53.3700, lng:-6.2681,  region:'ireland' },
  { name:'Powerscourt Estate Gardens',            lat:53.1822, lng:-6.1917,  region:'ireland' },
  { name:'Killarney House Gardens',               lat:52.0572, lng:-9.5069,  region:'ireland' },
  { name:'Glenveagh Castle Gardens',              lat:55.0408, lng:-7.9069,  region:'ireland' },
  { name:'Mount Usher Gardens',                   lat:52.9900, lng:-6.0678,  region:'ireland' },
  { name:'Birr Castle Demesne',                   lat:53.0994, lng:-7.9103,  region:'ireland' },
  { name:'Altamont Garden',                       lat:52.7100, lng:-6.7336,  region:'ireland' },
  { name:'Rowallane Garden',                      lat:54.3864, lng:-5.7469,  region:'ireland' },
  { name:'Mount Stewart',                         lat:54.5358, lng:-5.5481,  region:'ireland' },
  { name:'Benvarden Garden',                      lat:55.1250, lng:-6.5186,  region:'ireland' },
  { name:'Ilnacullin (Garinish Island)',           lat:51.7550, lng:-9.7364,  region:'ireland' },
  { name:'Fota Arboretum and Gardens',            lat:51.8994, lng:-8.2947,  region:'ireland' },
  { name:'Kilmacurragh Botanic Gardens',          lat:52.9433, lng:-6.1822,  region:'ireland' },
  { name:'Heywood Gardens',                       lat:52.8703, lng:-7.3536,  region:'ireland' },
  { name:'Strokestown Park Gardens',              lat:53.7764, lng:-8.1058,  region:'ireland' },
  // ── France: North ────────────────────────────────────────────────────────
  { name:"Giverny (Monet's Garden)",              lat:49.0761, lng:1.5344,   region:'mainland' },
  { name:'Ch\u00e2teau de Versailles Gardens',    lat:48.8049, lng:2.1204,   region:'mainland' },
  { name:'Vaux-le-Vicomte',                       lat:48.5678, lng:2.7156,   region:'mainland' },
  { name:'Ch\u00e2teau de Villandry Gardens',     lat:47.3417, lng:0.5131,   region:'mainland' },
  { name:'Ch\u00e2teau de Chaumont-sur-Loire Gardens', lat:47.4783, lng:1.1836, region:'mainland' },
  { name:'Jardin des Plantes Paris',              lat:48.8442, lng:2.3597,   region:'mainland' },
  { name:'Parc de Bagatelle Paris',               lat:48.8653, lng:2.2456,   region:'mainland' },
  { name:'Ch\u00e2teau de Br\u00e9cy Gardens',   lat:49.2208, lng:-0.4544,  region:'mainland' },
  { name:'Jardins du Ch\u00e2teau de Vendeuvre', lat:48.9094, lng:0.0281,   region:'mainland' },
  { name:'Jardins de Valmer',                     lat:47.3806, lng:0.7019,   region:'mainland' },
  { name:'Ch\u00e2teau de Fontainebleau Gardens', lat:48.4022, lng:2.7019,  region:'mainland' },
  { name:'Parc Floral de Paris',                  lat:48.8400, lng:2.4436,   region:'mainland' },
  { name:'Jardins de Kerdalo',                    lat:48.6214, lng:-3.1342,  region:'mainland' },
  { name:'Parc du Thabor Rennes',                 lat:48.1125, lng:-1.6703,  region:'mainland' },
  { name:'Jardins de la Ballue',                  lat:48.4342, lng:-1.6019,  region:'mainland' },
  { name:'Roseraie du Val-de-Marne',              lat:48.7797, lng:2.4708,   region:'mainland' },
  { name:"Jardins du Manoir d'Eyrignac",          lat:44.9294, lng:1.2506,   region:'mainland' },
  { name:'Jardins de Marqueyssac',                lat:44.8494, lng:1.2100,   region:'mainland' },
  // ── France: South ────────────────────────────────────────────────────────
  { name:'Villa Ephrussi de Rothschild',          lat:43.6944, lng:7.3333,   region:'mainland' },
  { name:'Domaine du Rayol',                      lat:43.1539, lng:6.4742,   region:'mainland' },
  { name:'Serre de la Madone',                    lat:43.7758, lng:7.4158,   region:'mainland' },
  { name:'Ch\u00e2teau Val Joanis Gardens',       lat:43.7994, lng:5.5119,   region:'mainland' },
  { name:'Jardins de Salagon',                    lat:43.9006, lng:5.7353,   region:'mainland' },
  { name:'Bambouseraie en C\u00e9vennes',         lat:43.9500, lng:4.0019,   region:'mainland' },
  { name:'Parc Phoenix Nice',                     lat:43.6958, lng:7.2464,   region:'mainland' },
  { name:"Jardins de l'Imaginaire Terrasson",     lat:45.1294, lng:1.3069,   region:'mainland' },
  { name:'Jardins de Cadiot',                     lat:44.8444, lng:0.9542,   region:'mainland' },
  { name:'Jardin Botanique de Lyon',              lat:45.7739, lng:4.8542,   region:'mainland' },
  { name:"Parc de la T\u00eate d'Or Lyon",        lat:45.7769, lng:4.8522,   region:'mainland' },
  { name:'Jardins du Palais Royal Paris',         lat:48.8644, lng:2.3369,   region:'mainland' },
  // ── Belgium, Netherlands, Luxembourg ─────────────────────────────────────
  { name:'Keukenhof',                             lat:52.2697, lng:4.5469,   region:'mainland' },
  { name:'Hortus Botanicus Amsterdam',            lat:52.3664, lng:4.9072,   region:'mainland' },
  { name:'Clingendael Park',                      lat:52.0869, lng:4.2800,   region:'mainland' },
  { name:'Paleis Het Loo Gardens',                lat:52.2442, lng:5.9597,   region:'mainland' },
  { name:'Arboretum Kalmthout',                   lat:51.3869, lng:4.4572,   region:'mainland' },
  { name:'Hortus Botanicus Leiden',               lat:52.1608, lng:4.4733,   region:'mainland' },
  { name:'Botanische Tuin Utrecht',               lat:52.0897, lng:5.1736,   region:'mainland' },
  { name:'Arboretum Trompenburg',                 lat:51.9061, lng:4.5072,   region:'mainland' },
  { name:'Kasteel de Haar Gardens',               lat:52.1253, lng:4.9917,   region:'mainland' },
  { name:'Rosarium Winschoten',                   lat:53.1433, lng:7.0369,   region:'mainland' },
  { name:'Annevoie Gardens',                      lat:50.3308, lng:4.8769,   region:'mainland' },
  { name:'Jardin Botanique de Meise',             lat:50.9297, lng:4.3169,   region:'mainland' },
  { name:'Citadelpark Ghent',                     lat:51.0378, lng:3.7108,   region:'mainland' },
  { name:'Ch\u00e2teau de Modave Gardens',        lat:50.4494, lng:5.2956,   region:'mainland' },
  { name:'Parc de Laeken Brussels',               lat:50.8933, lng:4.3608,   region:'mainland' },
  { name:'Ch\u00e2teau de Seneffe Gardens',       lat:50.5306, lng:4.2608,   region:'mainland' },
  { name:'Parc de Mariemont',                     lat:50.5072, lng:4.2819,   region:'mainland' },
  { name:"Jardins du Ch\u00e2teau de Jehay",      lat:50.5633, lng:5.3483,   region:'mainland' },
  { name:"Ch\u00e2teau d'Hex Gardens",            lat:50.7733, lng:5.2603,   region:'mainland' },
  { name:"Jardins d'Annevoie",                    lat:50.3311, lng:4.8772,   region:'mainland' },
  // ── Germany ───────────────────────────────────────────────────────────────
  { name:'Sanssouci Gardens Potsdam',             lat:52.4044, lng:13.0386,  region:'mainland' },
  { name:'Herrenhausen Gardens Hanover',          lat:52.3928, lng:9.6986,   region:'mainland' },
  { name:'Munich Botanical Garden',               lat:48.1633, lng:11.5006,  region:'mainland' },
  { name:'Berlin Botanical Garden',               lat:52.4486, lng:13.3053,  region:'mainland' },
  { name:'Schwetzingen Palace Gardens',           lat:49.3831, lng:8.5694,   region:'mainland' },
  { name:'Wilhelma Stuttgart',                    lat:48.8061, lng:9.2114,   region:'mainland' },
  { name:'Insel Mainau',                          lat:47.6997, lng:9.1969,   region:'mainland' },
  { name:'Planten un Blomen Hamburg',             lat:53.5617, lng:9.9808,   region:'mainland' },
  { name:'Palmengarten Frankfurt',                lat:50.1228, lng:8.6469,   region:'mainland' },
  { name:'Rhododendronpark Bremen',               lat:53.0964, lng:8.7794,   region:'mainland' },
  { name:'Schlosspark Pillnitz',                  lat:51.0097, lng:13.8786,  region:'mainland' },
  { name:'Muskauer Park',                         lat:51.5497, lng:14.9694,  region:'mainland' },
  { name:'Worlitz Garden Kingdom',                lat:51.8281, lng:12.4156,  region:'mainland' },
  { name:'Branitzer Park Cottbus',                lat:51.7444, lng:14.3594,  region:'mainland' },
  { name:'Schlosspark Schwerin',                  lat:53.6211, lng:11.4092,  region:'mainland' },
  { name:'F\u00fcrstliche G\u00e4rten Weikersheim', lat:49.4803, lng:9.8986, region:'mainland' },
  { name:'Schlosspark Linderhof',                 lat:47.5717, lng:10.9628,  region:'mainland' },
  { name:'Westpark Munich',                       lat:48.1228, lng:11.4922,  region:'mainland' },
  { name:'Britzer Garten Berlin',                 lat:52.4381, lng:13.4172,  region:'mainland' },
  { name:'Berggarten Hannover',                   lat:52.3917, lng:9.7019,   region:'mainland' },
  { name:'Rosengarten Zweibr\u00fccken',          lat:49.2522, lng:7.3633,   region:'mainland' },
  // ── Austria ───────────────────────────────────────────────────────────────
  { name:'Sch\u00f6nbrunn Palace Gardens',        lat:48.1847, lng:16.3122,  region:'mainland' },
  { name:'Belvedere Gardens Vienna',              lat:48.1919, lng:16.3806,  region:'mainland' },
  { name:'Volksgarten Vienna',                    lat:48.2064, lng:16.3619,  region:'mainland' },
  { name:'Burggarten Vienna',                     lat:48.2036, lng:16.3672,  region:'mainland' },
  { name:'Hellbrunn Palace Gardens',              lat:47.7567, lng:13.0617,  region:'mainland' },
  { name:'Mirabell Gardens Salzburg',             lat:47.8058, lng:13.0428,  region:'mainland' },
  { name:'Schloss Ambras Gardens Innsbruck',      lat:47.2539, lng:11.4278,  region:'mainland' },
  { name:'Botanischer Garten Vienna',             lat:48.1961, lng:16.3742,  region:'mainland' },
  { name:'Schlosspark Laxenburg',                 lat:48.0628, lng:16.3572,  region:'mainland' },
  { name:'Rosarium Baden bei Wien',               lat:48.0053, lng:16.2322,  region:'mainland' },
  { name:'Schloss Eggenberg Gardens',             lat:47.0664, lng:15.3933,  region:'mainland' },
  { name: 'Schonbrunn Palace Gardens Vienna',       lat: 48.1823, lng: 16.3123,  region: 'mainland' },
  { name: 'Belvedere Palace Gardens Vienna',        lat: 48.1912, lng: 16.3812,  region: 'mainland' },
  { name: 'Klosterneuburg Monastery Gardens',       lat: 48.3123, lng: 16.3234,  region: 'mainland' },
  // ── Hungary ─────────────────────────────────────────────────────────────────
  { name: 'Fuveszkert Botanical Garden Budapest',   lat: 47.4923, lng: 19.0712,  region: 'mainland' },
  { name: 'Soroksár Botanical Garden Budapest',     lat: 47.3923, lng: 19.0823,  region: 'mainland' },
  { name: 'Vácrátót Botanical Garden',                   lat: 47.7823, lng: 19.1334,  region: 'mainland' },
 // ── Poland ─────────────────────────────────────────────────────────────────
  { name: 'Warsaw University Botanical Garden',     lat: 52.2198, lng: 21.0298,  region: 'mainland' },
  { name: 'Warsaw Botanical Garden Powsin',         lat: 52.0998, lng: 21.0912,  region: 'mainland' },
  { name: 'Krakow Botanical Garden',                lat: 50.0623, lng: 19.9523,  region: 'mainland' },
  { name: 'Wroclaw University Botanical Garden',    lat: 51.1134, lng: 17.0523,  region: 'mainland' },
  { name: 'Wroclaw Japanese Garden',                lat: 51.0998, lng: 17.0734,  region: 'mainland' },
  { name: 'Poznan Botanical Garden',                lat: 52.3934, lng: 16.9212,  region: 'mainland' },
  { name: 'Rogów Arboretum',                        lat: 51.8234, lng: 20.0423,  region: 'mainland' },
  { name: 'Lodz Botanical Garden',                  lat: 51.7423, lng: 19.4523,  region: 'mainland' },
  { name: 'Lublin Botanical Garden',                lat: 51.2523, lng: 22.5712,  region: 'mainland' },
  { name: 'Gdansk Botanical Garden',                lat: 54.3723, lng: 18.5998,  region: 'mainland' },
  { name: 'Bydgoszcz Botanical Garden',             lat: 53.1334, lng: 18.0134,  region: 'mainland' },
  // ── Italy ─────────────────────────────────────────────────────────────────
  { name:"Villa d'Este Gardens Tivoli",           lat:41.9631, lng:12.7961,  region:'mainland' },
  { name:'Villa Borghese Rome',                   lat:41.9142, lng:12.4922,  region:'mainland' },
  { name:'Boboli Gardens Florence',               lat:43.7628, lng:11.2497,  region:'mainland' },
  { name:'Villa Melzi Gardens Bellagio',          lat:45.9853, lng:9.2617,   region:'mainland' },
  { name:'Villa Carlotta Lake Como',              lat:46.0064, lng:9.2436,   region:'mainland' },
  { name:'Villa Taranto Lake Maggiore',           lat:45.9392, lng:8.5744,   region:'mainland' },
  { name:'Isola Bella Gardens',                   lat:45.8983, lng:8.5281,   region:'mainland' },
  { name:'Villa Cimbrone Ravello',                lat:40.6467, lng:14.6072,  region:'mainland' },
  { name:'Villa Rufolo Ravello',                  lat:40.6494, lng:14.6133,  region:'mainland' },
  { name:'Giardini Botanici Hanbury',             lat:43.7842, lng:7.5194,   region:'mainland' },
  { name:'Orto Botanico di Padova',               lat:45.3986, lng:11.8806,  region:'mainland' },
  { name:'Parco Giardino Sigurt\u00e0',           lat:45.3594, lng:10.7286,  region:'mainland' },
  { name:'Villa Pisani Gardens Stra',             lat:45.4111, lng:11.9978,  region:'mainland' },
  { name:'Giardino della Landriana',              lat:41.5531, lng:12.3019,  region:'mainland' },
  { name:'La Foce Gardens Tuscany',               lat:43.0378, lng:11.6933,  region:'mainland' },
  { name:'Villa Gamberaia Florence',              lat:43.7633, lng:11.3283,  region:'mainland' },
  { name:"Horti Leonini San Quirico d'Orcia",     lat:43.0578, lng:11.6069,  region:'mainland' },
  { name:'Giardino Giusti Verona',                lat:45.4428, lng:11.0069,  region:'mainland' },
  { name:'Castello Ruspoli Gardens',              lat:42.3094, lng:12.1261,  region:'mainland' },
  { name:'Giardino Botanico di Brera Milan',      lat:45.4717, lng:9.1864,   region:'mainland' },
  { name: 'Villa Taranto Botanical Garden',         lat: 45.9423, lng: 8.5534,   region: 'mainland' },
  { name: 'Isola Bella Gardens Lake Maggiore',      lat: 45.8923, lng: 8.5198,   region: 'mainland' },
  { name: 'Parco Giardino Sigurta',                 lat: 45.3534, lng: 10.8023,  region: 'mainland' },
  { name: 'Orto Botanico di Padova',                lat: 45.3998, lng: 11.8823,  region: 'mainland' },
  { name: 'Villa del Balbianello Lake Como',        lat: 45.9734, lng: 9.1523,   region: 'mainland' },
  { name: 'Hanbury Botanical Gardens',              lat: 43.7823, lng: 7.5234,   region: 'mainland' },
  { name: 'Giardini Botanici Hruska Gardone',       lat: 45.6198, lng: 10.5598,  region: 'mainland' },
  { name: 'Orto Botanico di Torino',                lat: 45.0634, lng: 7.6698,   region: 'mainland' },
  { name: 'Boboli Gardens Florence',                lat: 43.7634, lng: 11.2498,  region: 'mainland' },
  { name: 'Villa d\'Este Gardens Tivoli',           lat: 41.9534, lng: 12.7923,  region: 'mainland' },
  { name: 'Orto Botanico di Roma',                  lat: 41.8923, lng: 12.4698,  region: 'mainland' },
  { name: 'Roseto Comunale Rome',                   lat: 41.8798, lng: 12.4834,  region: 'mainland' },
  { name: 'Villa Lante Gardens Bagnaia',            lat: 42.4123, lng: 12.1498,  region: 'mainland' },
  { name: 'Giardino dei Tarocchi',                  lat: 42.4423, lng: 11.4534,  region: 'mainland' },
  { name: 'Orto Botanico di Firenze',               lat: 43.7823, lng: 11.2534,  region: 'mainland' },
  { name: 'Giardino dell\'Iris Florence',           lat: 43.7634, lng: 11.2623,  region: 'mainland' },
  { name: 'Orto Botanico di Palermo',               lat: 38.1098, lng: 13.3698,  region: 'mainland' },
  { name: 'Orto Botanico di Napoli',                lat: 40.8598, lng: 14.2698,  region: 'mainland' },
  { name: 'Reggia di Caserta Gardens',              lat: 41.0734, lng: 14.3298,  region: 'mainland' },
  { name: 'La Mortella Garden Ischia',              lat: 40.7423, lng: 13.8934,  region: 'mainland' },
  { name: 'Villa Comunale Taormina',                lat: 37.8523, lng: 15.2912,  region: 'mainland' },
  { name: 'Orto Botanico di Catania',               lat: 37.5023, lng: 15.0912,  region: 'mainland' },
  // ── Spain ─────────────────────────────────────────────────────────────────
  { name:'Real Jard\u00edn Bot\u00e1nico Madrid', lat:40.4114, lng:-3.6922,  region:'mainland' },
  { name:'Retiro Park Madrid',                    lat:40.4153, lng:-3.6844,  region:'mainland' },
  { name:'Generalife Gardens Granada',            lat:37.1772, lng:-3.5886,  region:'mainland' },
  { name:'Alc\u00e1zar Gardens Seville',          lat:37.3831, lng:-5.9922,  region:'mainland' },
  { name:'Jardines de Aranjuez',                  lat:40.0331, lng:-3.6047,  region:'mainland' },
  { name:'Pazo de Oca Gardens Galicia',           lat:42.7081, lng:-8.4969,  region:'mainland' },
  { name:'Jard\u00edn Bot\u00e1nico de Barcelona', lat:41.3653, lng:2.1536,  region:'mainland' },
  { name:'Park G\u00fcell Barcelona',             lat:41.4145, lng:2.1527,   region:'mainland' },
  { name:'Palacio Real de La Granja Gardens',     lat:40.8983, lng:-4.0139,  region:'mainland' },
  { name:'Capricho de la Alameda de Osuna',       lat:40.4444, lng:-3.6042,  region:'mainland' },
  { name:'Jardines de Sabatini Madrid',           lat:40.4192, lng:-3.7147,  region:'mainland' },
  { name:'Jardines de Santa Clotilde Lloret de Mar', lat:41.6989, lng:2.8572, region:'mainland' },
  { name:"Laberint d'Horta Barcelona",            lat:41.4294, lng:2.1439,   region:'mainland' },
  { name:'Jard\u00edn Bot\u00e1nico de Valencia', lat:39.4731, lng:-0.3808,  region:'mainland' },
  { name:'Pazo de Mari\u00f1\u00e1n',             lat:43.3472, lng:-8.2917,  region:'mainland' },
  { name:'Jardines de Alfabia Mallorca',          lat:39.7394, lng:2.7022,   region:'mallorca' },
  { name: 'Real Jardin Botanico Madrid',            lat: 40.4098, lng: -3.6923,  region: 'mainland' },
  { name: 'Jardin Botanico Barcelona',              lat: 41.3634, lng: 2.1534,   region: 'mainland' },
  { name: 'Parc del Laberint d\'Horta',             lat: 41.4312, lng: 2.1423,   region: 'mainland' },
  { name: 'Real Alcazar Gardens Seville',           lat: 37.3834, lng: -5.9923,  region: 'mainland' },
  { name: 'Jardin Botanico de Cordoba',             lat: 37.8798, lng: -4.7812,  region: 'mainland' },
  { name: 'Alhambra Gardens Granada',               lat: 37.1765, lng: -3.5878,  region: 'mainland' },
  { name: 'Jardin Botanico de Valencia',            lat: 39.4712, lng: -0.3823,  region: 'mainland' },
  { name: 'Jardin Botanico de Malaga',              lat: 36.7234, lng: -4.4112,  region: 'mainland' },
  { name: 'Parque Maria Luisa Seville',             lat: 37.3723, lng: -5.9834,  region: 'mainland' },
  { name: 'Jardines de Aranjuez',                   lat: 40.0334, lng: -3.6023,  region: 'mainland' },
  { name: 'Senorio de Bertiz Natural Park',         lat: 43.1523, lng: -1.6234,  region: 'mainland' },
  { name: 'Jardin Botanico Atlantico Gijon',        lat: 43.5334, lng: -5.6712,  region: 'mainland' },
  { name: 'Parque del Buen Retiro Madrid',          lat: 40.4153, lng: -3.6844,  region: 'mainland' },
  { name: 'El Capricho Park Madrid',                lat: 40.4612, lng: -3.6198,  region: 'mainland' },
  { name: 'Gardens of El Escorial',                 lat: 40.5892, lng: -4.1483,  region: 'mainland' },
  { name: 'Parc de Collserola Barcelona',           lat: 41.4198, lng: 2.0734,   region: 'mainland' },
  { name: 'Jardins de Can Artigas',                 lat: 42.2198, lng: 1.9134,   region: 'mainland' },
  { name: 'Jardins de Santa Clotilde',              lat: 41.7023, lng: 2.8534,   region: 'mainland' },
  { name: 'Jardin Botanic Mar i Murtra',            lat: 41.9523, lng: 3.2012,   region: 'mainland' },
  { name: 'Jardins Artigas La Pobla de Lillet',     lat: 42.2234, lng: 1.9198,   region: 'mainland' },
  { name: 'Jardin Botanico Ramon Rubial Barakaldo', lat: 43.2934, lng: -2.9923,  region: 'mainland' },
  { name: 'Jardin Botanico Santa Catalina Vitoria', lat: 42.8734, lng: -2.6812,  region: 'mainland' },
  { name: 'Jardines de Doña Casilda Bilbao',        lat: 43.2612, lng: -2.9323,  region: 'mainland' },
  // ── Portugal ──────────────────────────────────────────────────────────────
  { name:'Jardim Bot\u00e2nico de Lisboa',        lat:38.7167, lng:-9.1533,  region:'mainland' },
  { name:'Pal\u00e1cio de Queluz Gardens',        lat:38.7556, lng:-9.2561,  region:'mainland' },
  { name:'Jardins do Pal\u00e1cio de Monserrate Sintra', lat:38.7883, lng:-9.4281, region:'mainland' },
  { name:'Quinta da Regaleira Sintra',            lat:38.7978, lng:-9.3975,  region:'mainland' },
  { name:'Jardins do Pal\u00e1cio Nacional de Pena', lat:38.7878, lng:-9.3906, region:'mainland' },
  { name:'Jardim Bot\u00e2nico do Porto',         lat:41.1508, lng:-8.6294,  region:'mainland' },
  { name:'Jardim da Funda\u00e7\u00e3o Calouste Gulbenkian', lat:38.7364, lng:-9.1542, region:'mainland' },
  { name:'Parque de Serralves Porto',             lat:41.1578, lng:-8.6578,  region:'mainland' },
  { name:'Jardim do Pa\u00e7o Episcopal Castelo Branco', lat:39.8208, lng:-7.4942, region:'mainland' },
  { name:'Tapada de Mafra',                       lat:38.9383, lng:-9.3317,  region:'mainland' },
  { name:'Jardim Bot\u00e2nico da Ajuda',         lat:38.7047, lng:-9.1886,  region:'mainland' },
  { name:'Parque Eduardo VII Lisbon',             lat:38.7267, lng:-9.1528,  region:'mainland' },
  { name:'Quinta do Palheiro Ferreiro Madeira',   lat:32.6594, lng:-16.8678, region:'madeira' },
  { name:'Monte Palace Tropical Garden Madeira',  lat:32.6633, lng:-16.8975, region:'madeira' },
  { name: 'Jardim Botanico de Lisboa',              lat: 38.7198, lng: -9.1512,  region: 'mainland' },
  { name: 'Jardim Botanico de Coimbra',             lat: 40.2034, lng: -8.4198,  region: 'mainland' },
  { name: 'Jardim Botanico do Porto',               lat: 41.1534, lng: -8.6298,  region: 'mainland' },
  { name: 'Palacio de Queluz Gardens',              lat: 38.7534, lng: -9.2598,  region: 'mainland' },
  { name: 'Quinta da Regaleira Sintra',             lat: 38.7923, lng: -9.3934,  region: 'mainland' },
  { name: 'Jardins do Palacio de Cristal Porto',    lat: 41.1498, lng: -8.6398,  region: 'mainland' },
  // ── Greece ────────────────────────────────────────────────────────────────
  { name:'National Garden Athens',                lat:37.9736, lng:23.7386,  region:'mainland' },
  { name:'Zappeion Gardens Athens',               lat:37.9694, lng:23.7386,  region:'mainland' },
  { name:'Botanical Garden of Athens',            lat:37.9686, lng:23.7822,  region:'mainland' },
  { name:'Stavros Niarchos Foundation Cultural Centre Gardens', lat:37.9428, lng:23.6908, region:'mainland' },
  { name:'Municipal Garden of Chania Crete',      lat:35.5136, lng:24.0175,  region:'mainland' },
  { name:'Botanical Park and Gardens of Crete',   lat:35.1994, lng:23.7903,  region:'mainland' },
  { name:'Rodini Park Rhodes',                    lat:36.4228, lng:28.2281,  region:'mainland' },
  { name:'Municipal Garden Corfu Town',           lat:39.6228, lng:19.9219,  region:'mainland' },
  { name:'Achilleion Palace Gardens Corfu',       lat:39.5642, lng:19.9178,  region:'mainland' },
  { name:'Botanical Garden of Thessaloniki',      lat:40.6344, lng:22.9444,  region:'mainland' },
  { name:'Nymfaio Arboretum',                     lat:40.6172, lng:21.5456,  region:'mainland' },
  
  // SCANDINAVIA: Sweden
  { name: 'Gothenburg Botanical Garden',            lat: 57.6769, lng: 11.9538,  region: 'mainland' },
  { name: 'Bergianska Tradgarden Stockholm',        lat: 59.3698, lng: 18.0556,  region: 'mainland' },
  { name: 'Uppsala University Botanic Garden',      lat: 59.8512, lng: 17.6298,  region: 'mainland' },
  { name: 'Linnaeus Garden Uppsala',                lat: 59.8578, lng: 17.6234,  region: 'mainland' },
  { name: 'Alnarps Tradgard',                       lat: 55.6612, lng: 13.0734,  region: 'mainland' },
  { name: 'Lund Botanical Garden',                  lat: 55.7023, lng: 13.1934,  region: 'mainland' },
  { name: 'Malmo Botanical Garden',                 lat: 55.5934, lng: 12.9923,  region: 'mainland' },
  { name: 'Norrvikens Tradgardar',                  lat: 56.2823, lng: 12.8534,  region: 'mainland' },
  { name: 'Goteborgs Tradgardssallskap',            lat: 57.6923, lng: 11.9723,  region: 'mainland' },
  { name: 'Rosendals Tradgard Stockholm',           lat: 59.3234, lng: 18.1023,  region: 'mainland' },
  { name: 'Drottningholm Palace Gardens',           lat: 59.3212, lng: 17.8876,  region: 'mainland' },
  { name: 'Ulriksdal Palace Gardens',               lat: 59.3812, lng: 18.0234,  region: 'mainland' },
  { name: 'Haga Park Stockholm',                    lat: 59.3634, lng: 18.0198,  region: 'mainland' },
  { name: 'Linnaeus Hammarby Uppsala',              lat: 59.8023, lng: 17.6812,  region: 'mainland' },

  // SCANDINAVIA: Norway
  { name: 'Oslo Botanical Garden',                  lat: 59.9098, lng: 10.7723,  region: 'mainland' },
  { name: 'Bergen Botanical Garden',                lat: 60.3823, lng: 5.3334,   region: 'mainland' },
  { name: 'Stavanger Botanical Garden',             lat: 58.9534, lng: 5.7198,   region: 'mainland' },
  { name: 'Kristiansand Botanical Garden',          lat: 58.1423, lng: 7.9923,   region: 'mainland' },
  { name: 'Ringve Botanical Garden Trondheim',      lat: 63.4234, lng: 10.4312,  region: 'mainland' },
  { name: 'Tromso Arctic Alpine Botanic Garden',    lat: 69.6534, lng: 18.9823,  region: 'mainland' },
  { name: 'Agder Naturmuseum Botanical Garden',     lat: 58.1523, lng: 8.0134,   region: 'mainland' },
  { name: 'Milde Arboretum Bergen',                 lat: 60.2698, lng: 5.2912,   region: 'mainland' },
  { name: 'Svinvik Arboretum',                      lat: 63.0234, lng: 7.9812,   region: 'mainland' },

  // SCANDINAVIA: Denmark & Finland
  { name: 'Copenhagen Botanical Garden',            lat: 55.6876, lng: 12.5712,  region: 'mainland' },
  { name: 'Aarhus Botanical Garden',                lat: 56.1698, lng: 10.1923,  region: 'mainland' },
  { name: 'Odense Botanical Garden',                lat: 55.3923, lng: 10.3734,  region: 'mainland' },
  { name: 'Helsinki Botanical Garden',              lat: 60.1756, lng: 24.9323,  region: 'mainland' },
  { name: 'Turku Botanical Garden',                 lat: 60.4534, lng: 22.2898,  region: 'mainland' },
  { name: 'Oulu Botanical Garden',                  lat: 65.0098, lng: 25.4712,  region: 'mainland' },
  { name: 'Frederiksberg Gardens Copenhagen',       lat: 55.6723, lng: 12.5212,  region: 'mainland' },
  { name: 'Forstbotanisk Have Charlottenlund',      lat: 55.7612, lng: 12.5798,  region: 'mainland' },
  { name: 'Helsingborg Fredriksdal Gardens',        lat: 56.0523, lng: 12.7234,  region: 'mainland' },
  { name: 'Linkoping Botanical Garden',             lat: 58.4112, lng: 15.6212,  region: 'mainland' },
  { name: 'Tampere Botanical Garden',               lat: 61.5012, lng: 23.7712,  region: 'mainland' },
  { name: 'Jyvaskyla Botanical Garden',             lat: 62.2312, lng: 25.7423,  region: 'mainland' },
  { name: 'Tallinn Botanical Garden',               lat: 59.4798, lng: 24.8312,  region: 'mainland' },
  { name: 'Tartu Botanical Garden',                 lat: 58.3712, lng: 26.7223,  region: 'mainland' },
  
  // ── USA: East Coast ───────────────────────────────────────────────────────
  { name:'Longwood Gardens',                      lat:39.8706, lng:-75.6727, region:'mainland' },
  { name:'New York Botanical Garden',             lat:40.8619, lng:-73.8778, region:'mainland' },
  { name:'Brooklyn Botanic Garden',               lat:40.6694, lng:-73.9636, region:'mainland' },
  { name:'Arnold Arboretum Boston',               lat:42.3081, lng:-71.1244, region:'mainland' },
  { name:'Dumbarton Oaks Washington DC',          lat:38.9144, lng:-77.0631, region:'mainland' },
  { name:'Winterthur Garden',                     lat:39.8658, lng:-75.5972, region:'mainland' },
  { name:'Chanticleer Garden',                    lat:40.0494, lng:-75.3997, region:'mainland' },
  { name:'Wave Hill',                             lat:40.8983, lng:-73.9122, region:'mainland' },
  { name:'Ladew Topiary Gardens',                 lat:39.5997, lng:-76.5469, region:'mainland' },
  { name:'Biltmore Estate Gardens',               lat:35.5406, lng:-82.5519, region:'mainland' },
  { name:'Magnolia Plantation and Gardens',       lat:32.8811, lng:-80.0969, region:'mainland' },
  { name:'Vizcaya Museum and Gardens',            lat:25.7453, lng:-80.2406, region:'mainland' },
  // ── USA: West Coast ───────────────────────────────────────────────────────
  { name:'Butchart Gardens Victoria',             lat:48.5644, lng:-123.4717, region:'mainland' },
  { name:'Van Dusen Botanical Garden Vancouver',  lat:49.2369, lng:-123.1347, region:'mainland' },
  { name:'Portland Japanese Garden',              lat:45.5197, lng:-122.7061, region:'mainland' },
  { name:'Huntington Library Art Museum and Botanical Gardens', lat:34.1289, lng:-118.1144, region:'mainland' },
  { name:'Filoli',                                lat:37.5256, lng:-122.3147, region:'mainland' },
  { name:'San Francisco Botanical Garden',        lat:37.7669, lng:-122.4672, region:'mainland' },
  { name:'UC Berkeley Botanical Garden',          lat:37.8764, lng:-122.2411, region:'mainland' },
  { name:'Crystal Springs Rhododendron Garden',   lat:45.4681, lng:-122.6456, region:'mainland' },
  { name:'Bellevue Botanical Garden',             lat:47.5972, lng:-122.1561, region:'mainland' },
  // ── Hawaii ────────────────────────────────────────────────────────────────
  { name:'Foster Botanical Garden Honolulu',      lat:21.3172, lng:-157.8628, region:'mainland' },
  { name:'Lyon Arboretum Honolulu',               lat:21.3328, lng:-157.8019, region:'mainland' },
  { name:'Waimea Valley Botanical Garden',        lat:21.6383, lng:-158.0508, region:'mainland' },
  { name:'National Tropical Botanical Garden Kauai', lat:21.9094, lng:-159.5281, region:'mainland' },
  { name:'Maui Nui Botanical Gardens',            lat:20.8894, lng:-156.4736, region:'mainland' },
  // ── Australia & New Zealand ───────────────────────────────────────────────
  { name:'Royal Botanic Garden Sydney',           lat:-33.8642, lng:151.2167, region:'au' },
  { name:'Royal Botanic Gardens Melbourne',       lat:-37.8306, lng:144.9797, region:'au' },
  { name:'Adelaide Botanic Garden',               lat:-34.9183, lng:138.6094, region:'au' },
  { name:'Kings Park Perth',                      lat:-31.9600, lng:115.8331, region:'au' },
  { name:'Australian National Botanic Gardens Canberra', lat:-35.2772, lng:149.1108, region:'au' },
  { name:'Brisbane Botanic Gardens Mount Coot-tha', lat:-27.4778, lng:152.9781, region:'au' },
  { name:'Christchurch Botanic Gardens',          lat:-43.5322, lng:172.6208, region:'nz' },
  { name:'Hamilton Gardens New Zealand',          lat:-37.7781, lng:175.3031, region:'nz' },
  { name:'Wellington Botanic Garden',             lat:-41.2811, lng:174.7694, region:'nz' },
  { name:'Dunedin Botanic Garden',                lat:-45.8661, lng:170.5044, region:'nz' },
  { name:'Ayrlies Garden Auckland',               lat:-36.9267, lng:175.0933, region:'nz' },
];

// ── Haversine + candidate selection ──────────────────────────────────────────
function _haversineKm(lat1, lng1, lat2, lng2) {
  var R    = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a    = Math.sin(dLat/2) * Math.sin(dLat/2)
           + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
           * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

var MAX_DIST_KM          = 200;
var MAX_DIST_FALLBACK_KM = 400;

function getRegionalGardens(lat, lng, userRegion) {
  if (lat == null || lng == null) return [];
  userRegion = userRegion || 'mainland';

  function _candidates(maxDist) {
    return GARDENS
      .filter(function(g) { return _gardenCompatible(userRegion, g.region); })
      .map(function(g)    { return { name: g.name, dist: _haversineKm(lat, lng, g.lat, g.lng) }; })
      .filter(function(g) { return g.dist <= maxDist; })
      .sort(function(a, b){ return a.dist - b.dist; })
      .map(function(g)    { return g.name; });
  }

  var results = _candidates(MAX_DIST_KM);
  if (results.length < 12) {
    console.log('[garden] inspo: fewer than 12 within ' + MAX_DIST_KM + 'km — relaxing to ' + MAX_DIST_FALLBACK_KM + 'km');
    results = _candidates(MAX_DIST_FALLBACK_KM);
  }
  console.log('[garden] inspo: ' + results.length + ' candidate gardens for region ' + userRegion);
  return results;
}

function normaliseGardenName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\b(rhs|nts|english heritage|national trust|the|garden|gardens|park|house|castle|abbey|hall|manor|place|estate|botanical|botanic|arboretum|pleasure grounds)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ── Inspo fetch ───────────────────────────────────────────────────────────────
function fetchInspoOne(plant, monthName, climate, lat, lng, userRegion, apiKey, usedNames) {
  return new Promise(function(resolve) {
    if (!apiKey) { resolve(null); return; }
    var locationHint = lat && lng
      ? ' (approx. ' + Math.round(lat) + '\u00b0N ' + Math.round(Math.abs(lng)) + '\u00b0' + (lng < 0 ? 'W' : 'E') + ')'
      : '';
    var recentUsed    = usedNames.slice(-4);
    var excludeClause = recentUsed.length
      ? '\n\nDo NOT suggest any of these: ' + recentUsed.join(', ') + '.'
      : '';
    var regionalGardens = getRegionalGardens(lat, lng, userRegion);
    var candidates = regionalGardens.filter(function(g) {
      return usedNames.indexOf(g) === -1 && normaliseGardenName(g) !== '' &&
        usedNames.every(function(u) { return normaliseGardenName(u) !== normaliseGardenName(g); });
    });
    var gardenHint;
    if (candidates.length > 0) {
      gardenHint = '\n\nChoose from these verified gardens near ' + climate + ' (all are real and within day-trip distance): '
        + candidates.slice(0, 12).join(', ') + '.'
        + ' Pick the one that is most interesting specifically in ' + monthName + '.';
    } else {
      console.log('[garden] inspo: candidates exhausted for ' + climate + ', using free-choice fallback');
      gardenHint = '\n\nSuggest a real, well-known, publicly accessible garden within a comfortable day trip of '
        + climate + '. It must genuinely exist and be visitable. Do NOT repeat any of these already used: '
        + (usedNames.length ? usedNames.join(', ') : 'none') + '.';
    }

    var prompt =
      'Suggest one real, publicly accessible garden worth visiting in ' + monthName
      + ' for someone based in ' + climate + locationHint + '.'
      + ' It must be within a comfortable day trip \u2014 preferably under 1.5 hours away.'
      + gardenHint
      + excludeClause
      + '\n\nThe highlight should mention something specific happening in that garden in ' + monthName + '.'
      + '\n\nReturn ONLY valid JSON with no markdown fences, no explanation, nothing before or after the JSON object:'
      + '\n{"name":"Full official garden name","location":"Town, County","highlight":"One specific sentence about what makes it worth visiting in ' + monthName + '.","wikipedia":"Wikipedia article title for this garden if one exists, else null"}';

    var body = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    });
    var opts = {
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    };
    var req = https.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        console.log('[garden] inspo API status:', res.statusCode);
        try {
          var p = JSON.parse(data);
          if (p.error) { console.error('[garden] inspo API error:', JSON.stringify(p.error)); resolve(null); return; }
          var text    = (p.content && p.content[0] && p.content[0].text || '').trim();
          var cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
          var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (!jsonMatch) { console.error('[garden] inspo no JSON found in:', text.slice(0, 100)); resolve(null); return; }
          resolve(JSON.parse(jsonMatch[0]));
        } catch(e) {
          console.error('[garden] inspo parse error:', e.message, 'raw:', data.slice(0, 200));
          resolve(null);
        }
      });
    });
    req.on('error', function(e) { console.error('[garden] inspo req error:', e.message); resolve(null); });
    req.setTimeout(15000, function() { console.error('[garden] inspo timeout'); req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function fetchAllInspos(plants, monthNames, climate, lat, lng, userRegion, apiKey) {
  var inspos          = [];
  var usedNormalised  = [];
  var usedDisplay     = [];

  for (var i = 0; i < 12; i++) {
    var result   = await fetchInspoOne(plants[i], monthNames[i], climate, lat, lng, userRegion, apiKey, usedDisplay);
    var attempts = 0;
    while (result && result.name && attempts < 3) {
      var norm = normaliseGardenName(result.name);
      if (usedNormalised.indexOf(norm) === -1) break;
      console.log('[garden] Dedup: ' + result.name + ' already used, retrying...');
      usedDisplay.push(result.name);
      result = await fetchInspoOne(plants[i], monthNames[i], climate, lat, lng, userRegion, apiKey, usedDisplay);
      attempts++;
    }
    if (result && result.name) {
      usedNormalised.push(normaliseGardenName(result.name));
      usedDisplay.push(result.name);
    }
    inspos.push(result);
    console.log('[garden] Inspo ' + (i + 1) + '/12: ' + (result && result.name || 'null'));
  }
  return inspos;
}

// ── Wikipedia photo fetch ─────────────────────────────────────────────────────
function fetchImageAsBuffer(imageUrl, _depth) {
  _depth = _depth || 0;
  return new Promise(function(resolve) {
    if (_depth > 4) { resolve(null); return; }
    var parsed = require('url').parse(imageUrl);
    var lib    = parsed.protocol === 'https:' ? https : http;
    var req = lib.get({
      hostname: parsed.hostname,
      path:     parsed.path,
      headers:  { 'User-Agent': 'GardenCalendar/1.0', 'Accept': 'image/png,image/jpeg,image/*' },
    }, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        var loc = res.headers.location;
        if (loc.startsWith('/')) loc = parsed.protocol + '//' + parsed.hostname + loc;
        res.resume();
        return fetchImageAsBuffer(loc, _depth + 1).then(resolve);
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var buf = Buffer.concat(chunks);
        if (buf.length < 500) { resolve(null); return; }
        if (!(res.headers['content-type'] || '').includes('image')) { resolve(null); return; }
        resolve(buf);
      });
    });
    req.on('error', function() { resolve(null); });
    req.setTimeout(12000, function() { req.destroy(); resolve(null); });
  });
}

function fetchWikipediaPhotoBuffer(title) {
  return new Promise(function(resolve) {
    if (!title) { resolve(null); return; }
    var enc = encodeURIComponent(title.replace(/ /g, '_'));
    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + enc;
    var req = https.get(url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d     = JSON.parse(data);
          var thumb = d.thumbnail && d.thumbnail.source;
          if (!thumb) { resolve(null); return; }
          fetchImageAsBuffer(thumb).then(resolve);
        } catch(e) { console.error('[garden] wiki parse error:', e.message); resolve(null); }
      });
    });
    req.on('error', function(e) { console.error('[garden] wiki req error:', e.message); resolve(null); });
    req.setTimeout(8000, function() { req.destroy(); resolve(null); });
  });
}

// ── Content strings — 7 climate zones ──────────────────────────────────────
// Index 0 = January. Zone derived from userRegion in pdfService and passed
// into buildPageA as opts.climateZone. Falls back to temperate if unknown.
var MONTHLY_TASKS = {
  temperate: [
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
  ],
  temperate_eu: [
    'January is the depths of winter. Browse seed catalogues, service tools, and plan the season ahead. In colder regions, check stored bulbs and root vegetables for signs of rot.',
    'February brings tentative signs of life, though hard frosts are still likely. Sow slow-growing annuals and onions on a warm windowsill, prune roses on mild days, and watch for the first snowdrops.',
    'March is the cautious start of the growing season. Sow tomatoes and peppers under glass, divide perennials as growth resumes, and prepare beds with compost — but wait for the soil to warm before sowing directly.',
    'April brings real warmth but late frosts remain a threat, especially in northern and eastern regions. Plant summer bulbs, sow hardy annuals directly, harden off seedlings, and mow the lawn for the first time.',
    'May is the most exciting month in the garden. After the last frost, plant out tomatoes, peppers, and tender annuals. Sow beans and courgettes directly, stake tall perennials, and keep up with weeding as growth accelerates.',
    'June is full summer growth. Deadhead roses for repeat bloom, feed container plants weekly, thin fruit on overloaded branches, and water consistently in dry spells. Midsummer evenings are long — use them.',
    'July is harvest time. Pick soft fruit and vegetables regularly to encourage more, water deeply in hot weather, and take softwood cuttings of pelargoniums and tender perennials to overwinter.',
    'August is abundant but signals the turn of the season. Harvest consistently, cut back flowered perennials to encourage a second flush, sow autumn salads, and begin collecting seed from favourite plants.',
    'September is transition time. Plant spring bulbs, divide perennials, harvest and store root crops, and begin clearing spent summer plants. Sow hardy annuals for early colour next spring.',
    'October is the month to put the garden to rest. Plant garlic and tulip bulbs, cut back herbaceous perennials, mulch generously before the ground freezes, and collect fallen leaves for composting.',
    'November focuses on structure and preparation. Plant bare-root trees and roses while the soil is still workable, protect tender plants with fleece or mulch, and complete leaf clearance before hard frost arrives.',
    'December is a quiet month of planning and patience. Prune fruit trees and ornamentals on dry days, force hyacinths or amaryllis indoors, and browse catalogues for next year\'s seeds and plants.',
  ],
  mediterranean: [
    'January is the quiet heart of winter, though rarely a harsh one. Prune olive and fruit trees on dry days, plant bare-root roses, and sow sweet peas under glass for an early spring display.',
    'February stirs the Mediterranean garden back to life. Prune roses before new growth extends, divide snowdrops after flowering, and sow tomatoes and peppers under glass for transplanting in spring.',
    'March is the garden\'s busiest month. Plant summer bulbs, divide perennials, sow annuals directly into warm soil, and begin feeding roses and fruit trees as growth accelerates.',
    'April is peak spring. Deadhead bulbs as they finish, plant out tender annuals, feed citrus with a balanced fertiliser, and begin establishing summer watering routines before the dry season arrives.',
    'May brings warming days and the first hint of summer drought. Finish planting summer annuals, install drip irrigation if needed, and apply a thick mulch to conserve moisture through the dry months ahead.',
    'June marks the start of the dry season. Water deeply but infrequently, harvest in the cool of the morning, deadhead spent flowers, and let Mediterranean herbs — lavender, rosemary, thyme — bake in the heat.',
    'July is the height of summer dormancy for many plants. Keep irrigation consistent, harvest figs, tomatoes, and peppers generously, and resist the urge to prune established shrubs in the heat.',
    'August is the peak of the dry season but the end is in sight. Harvest generously, water established trees deeply and rarely, and start sowing autumn vegetables — lettuce, chard, and brassicas — in trays for September transplanting.',
    'September brings welcome rain and cooler nights. Plant spring bulbs, sow autumn vegetables directly, divide perennials, and take cuttings of tender plants before temperatures drop further.',
    'October is the start of the Mediterranean garden\'s second chapter. Plant spring bulbs, sow sweet peas and hardy annuals, prune fruit trees, and enjoy the relief of cooler, wetter weather returning.',
    'November is a productive month. Plant bare-root fruit trees and roses, sow broad beans and hardy winter greens, and prepare beds with compost as the rains return. The garden is waking up, not going to sleep.',
    'December is mild and often wet. Prune fruit trees and roses, plant bare-root trees while the soil is fully workable, and sow sweet peas and hardy annuals if you haven\'t already. The garden needs little else.',
  ],
  continental_na: [
    'January is seed catalog season. Browse varieties, plan your beds, and start slow-growing onions and leeks under grow lights. Outside, the garden rests — and there is satisfaction in that too.',
    'February is still deep winter across most of the continent, but the seed trays come out. Start peppers, eggplant, and slow-growing annuals under lights. Check stored bulbs and root vegetables for rot.',
    'March arrives with mixed signals — snow is still possible but the urge to start is hard to resist. Sow tomatoes, peppers, and brassicas indoors. Wait for the soil to warm and dry before working beds outside.',
    'April is the month of cautious optimism. Harden off seedlings but keep frost cloth handy — a late freeze is still possible in most zones. Direct-sow peas, spinach, and lettuce as soon as the soil can be worked.',
    'May is peak planting season. After your last frost date, plant out tomatoes, peppers, squash, and tender annuals. Stake tall perennials, sow beans directly in the ground, and keep up with weeding as growth surges.',
    'June is full-on summer in the garden. Water deeply and consistently, mulch everything to retain moisture, deadhead regularly, and keep harvesting to encourage more production. The pace is relentless — in the best way.',
    'July is abundance. Harvest tomatoes, zucchini, and beans daily — they grow fast in the heat. Take softwood cuttings of perennials, deadhead annuals to extend the season, and water at the base to avoid leaf scorch.',
    'August brings the garden\'s peak harvest. Pick tomatoes, peppers, and corn at their prime. Prune summer-fruiting raspberries, start planning a fall garden, and sow a cover crop in any beds that are finishing up.',
    'September is the fall garden\'s beginning. Plant garlic and spring bulbs, transplant fall brassicas, divide perennials, and harvest winter squash before the first frost arrives. The pace picks up again after summer\'s heat.',
    'October is a race against frost. Harvest the last tomatoes and peppers before the cold arrives, plant garlic before the ground freezes, cut back perennials, and mulch beds generously to protect roots through winter.',
    'November is the garden\'s closing chapter in most of North America. Plant the last spring bulbs before the ground freezes, cover tender perennials with a deep mulch, and clean and oil tools before storing them away.',
    'December is the garden\'s true rest. Prune fruit trees and ornamentals on dry days, force bulbs indoors for winter color, plan next year\'s beds, and browse seed catalogs as they start arriving.',
  ],
  pacific_nw: [
    'January is wet and quiet. Prune fruit trees and roses on dry days, plan the season ahead, and start slow-growing seeds — onions, leeks, celery — on a warm windowsill indoors.',
    'February brings the first hints of spring. Prune roses before buds break, sow tomatoes and peppers indoors, and watch for early bulbs pushing through the sodden ground.',
    'March is the cautious start of the growing season. Sow cool-season crops — peas, spinach, lettuce — directly into prepared beds. Last frost is still possible, but the soil is workable and the days are lengthening fast.',
    'April is one of the best months in the Northwest garden. Plant summer bulbs, divide perennials, direct-sow hardy annuals, and harden off seedlings started indoors. The rain keeps coming, but growth is accelerating.',
    'May is prime planting time. Harden off tomatoes, peppers, and tender annuals and get them in the ground after your last frost date. Sow beans and squash directly, stake tall perennials, and keep up with slugs.',
    'June is often still cool and overcast on the coast, but growth is steady. Deadhead roses for repeat bloom, feed containers regularly, and water if a dry spell arrives — it does happen, and the garden feels it quickly.',
    'July is the Northwest\'s finest month. Long dry days and warm temperatures ripen tomatoes, fill the berry canes, and reward the patience of spring. Harvest regularly, water deeply in dry spells, and enjoy every day of it.',
    'August is harvest season at full tilt. Pick soft fruit, tomatoes, and beans daily. Take cuttings of tender perennials, sow autumn salads now for a September harvest, and begin thinking about garlic planting in a few weeks.',
    'September is transition time. Plant garlic and spring bulbs, divide perennials, sow cover crops in empty beds, and harvest winter squash before the rains return in earnest. The growing season here runs longer than most.',
    'October brings the rain back. Plant spring bulbs and bare-root trees while the soil is still workable, cut back spent perennials, mulch borders, and move tender plants under cover before the first frost arrives.',
    'November is the garden\'s quiet season. Plant bare-root roses and fruit trees, sow hardy winter greens under cover, and focus on soil improvement — this is the best time of year to add compost to beds.',
    'December is wet and restful. Prune fruit trees and ornamentals on dry days, force bulbs indoors, plan next year\'s garden, and browse seed catalogs. The Northwest garden rarely freezes hard — there is always something green.',
  ],
  pacific_sw: [
    'January is a planting month. Set out bare-root fruit trees, roses, and cane fruit while they are dormant, and sow cool-season crops — lettuce, peas, chard — directly outdoors in frost-free areas.',
    'February brings early color and growing energy. Plant summer-flowering bulbs in frost-free areas, start tomatoes and peppers indoors six to eight weeks before your last frost date, and prune roses before new growth breaks.',
    'March is prime cool-season growing time. Direct-sow carrots, beets, and greens, harden off seedlings started indoors, and watch for late frosts at higher elevations. Inland valleys are warming fast.',
    'April is full swing. Plant tomatoes and peppers in Southern California; in the Central Valley, the heat is already building — get warm-season crops in early and mulch immediately to protect soil moisture.',
    'May is the last comfortable month before summer heat dominates inland. Get everything planted, mulch deeply, and establish drip irrigation. On the coast, cool conditions continue and the planting window stays open longer.',
    'June is the gateway to summer. Inland gardens need consistent deep watering, morning harvests, and heavy mulching. Coastal gardens stay cool enough for salad crops — one of the great advantages of the California coast.',
    'July is hot, dry, and demanding. Water deeply and infrequently to encourage deep roots, harvest tomatoes and peppers at their peak, and hold off on fertilizing — pushing growth in extreme heat does more harm than good.',
    'August is peak harvest month. Tomatoes, peppers, melons, and stone fruit are at their best. Keep up with watering, watch for spider mites in hot dry conditions, and start sowing fall greens in trays for September transplanting.',
    'September brings the first hint of relief. Start fall planting in earnest — brassicas, lettuce, carrots — as temperatures ease. Plant garlic at month\'s end. In the Central Valley, the best gardening weather of the year is arriving.',
    'October is one of the finest months for gardening. Plant spring bulbs, sow cool-season crops directly, set out winter annuals, and plant bare-root fruit trees later in the month as dormancy begins.',
    'November is planting season in mild-winter areas. Set out bare-root roses and fruit trees, sow cool-season greens for winter harvest, and plant spring bulbs. In desert areas, this is the most comfortable time of year to garden.',
    'December is quiet but not dormant. Prune fruit trees and roses on mild days, plant bare-root stock while the soil is workable, force paperwhites indoors, and plan the year ahead. The California garden rarely truly sleeps.',
  ],
  southeast_na: [
    'January is a gentle winter month. Plant bare-root fruit trees and roses, sow cool-season crops under cover, and start tomato and pepper seeds indoors ahead of the early spring planting season.',
    'February brings early color — camellias, early daffodils, and the first warmth. Start tomatoes and peppers indoors, plant bare-root roses and fruit trees, and direct-sow cool-season vegetables in prepared beds.',
    'March is the sweet spot of the Southern growing season. Direct-sow or transplant cool-season crops, plant summer bulbs, and divide perennials before the heat arrives. Get warm-season seedlings hardening off now.',
    'April is the last comfortable planting month before summer heat builds. Get tomatoes, peppers, and squash in the ground, mulch everything heavily to retain moisture, and enjoy the brief window of perfect gardening weather.',
    'May is the gateway to summer — act fast. Plant heat-lovers like okra, sweet potatoes, and Southern peas. Shade cloth will help cool-season crops limp through a few more weeks before they finally give up to the heat.',
    'June is hot, humid, and full-on. Water in the morning to reduce fungal disease, harvest squash and cucumbers frequently before they overrun you, and sow a second round of beans for a fall harvest.',
    'July is the South\'s toughest month. Maintenance is everything — water early, mulch deeply, and harvest fast. Start planning the fall garden, which will be one of the year\'s most rewarding. The worst of the heat won\'t last.',
    'August is when the fall garden begins in earnest. Start seeds of broccoli, kale, and collards indoors. It is still ferociously hot but it won\'t last — and the fall garden in the South is worth every bit of the planning.',
    'September is the South\'s second spring. Transplant fall vegetables — broccoli, cabbage, kale — into amended beds, plant garlic at month\'s end, and divide perennials as temperatures begin their welcome easing.',
    'October is peak fall gardening. Sow cool-season crops directly — lettuce, spinach, carrots — and set out winter annuals like pansies and snapdragons. The garden is at its most comfortable and most rewarding.',
    'November is one of the South\'s finest gardening months. Cool-season crops are thriving, camellias are in bloom, and there is still time to plant garlic and spring bulbs. The pace is easy and the rewards generous.',
    'December is gentle. Prune fruit trees and roses on mild days, plant bare-root trees and shrubs, protect tender plants if a hard freeze is forecast, and enjoy the cool-season greens that are still producing in the garden.',
  ],
};

var QUOTES = [
  { text: 'To forget how to dig the earth and tend the soil is to forget ourselves.',                                                                    author: 'Mahatma Gandhi' },
  { text: 'A garden is a grand teacher. It teaches patience and careful watchfulness; it teaches industry and thrift.',                                  author: 'Gertrude Jekyll, Home and Garden, 1900' },
  { text: 'The kiss of the sun for pardon, the song of the birds for mirth \u2014 one is nearer God\u2019s heart in a garden than anywhere else on earth.', author: 'Dorothy Frances Gurney, 1913' },
  { text: 'God Almighty first planted a garden; and indeed it is the purest of human pleasures.',                                                        author: 'Francis Bacon, Essays, 1625' },
  { text: 'A garden must be looked into and dressed as the body.',                                                                                       author: 'George Herbert, Outlandish Proverbs, 1640' },
  { text: 'Who loves a garden still his Eden keeps, perennial pleasures plants, and wholesome harvests reaps.',                                          author: 'Amos Bronson Alcott, 1868' },
  { text: 'The garden is the poor man\u2019s apothecary.',                                                                                              author: 'German proverb' },
  { text: 'He who plants a garden plants happiness.',                                                                                                    author: 'Chinese proverb' },
  { text: 'A garden is not made in a year; indeed it is never made in the sense of being finished.',                                                     author: 'H. H. Thomas, The Complete Gardener, 1912' },
  { text: 'All gardening is landscape painting.',                                                                                                        author: 'Alexander Pope, c.\u00a01720' },
  { text: 'The best place to find God is in a garden. You can dig for him there.',                                                                       author: 'George Bernard Shaw, 1932' },
  { text: 'The glory of gardening: hands in the dirt, head in the sun, heart with nature.',                                                              author: 'Alfred Austin, The Garden That I Love, 1894' },
];

// ── HTML helpers (local — not imported from calendarTemplate to avoid coupling) ──
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Product interface ─────────────────────────────────────────────────────────

// validateOrder — appends garden-specific errors to the errors array
function validateOrder(body, errors) {
  if (!Array.isArray(body.plants) || body.plants.length !== 12)
    errors.push('plants must be array of 12 plant names');
}

// buildSharedState — called once before the month loop.
// Returns all pre-fetched/compressed data needed by buildMonthContent and buildCoverPage.
async function buildSharedState(order, geo, apiKey, compressToJpegDataUri, makeQrB64) {
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var startMonth  = order.startMonth - 1;
  var plants      = order.plants;

  // ── Artwork: read once, compress to two sizes ──────────────────────────
  console.log('[garden] Reading & compressing artwork...');
  var artworkRaw = plants.map(function(p) { return readArtworkBuffer(p); });
  console.log('[garden] Artwork loaded: ' + artworkRaw.filter(Boolean).length + '/12');
  artworkRaw.forEach(function(a, i) {
    if (a) {
      var src = a.source.includes('Edwards') ? 'Edwards' : a.source.includes('Redout') ? 'Redout\u00e9' : 'K\u00f6hler';
      console.log('[ART] ' + plants[i] + ' \u2192 ' + src);
    }
  });

  var artworks = [];
  for (var ai = 0; ai < artworkRaw.length; ai++) {
    var a = artworkRaw[ai];
    if (!a) { artworks.push(null); continue; }
    console.log('[ART] Compressing ' + plants[ai] + ' (' + Math.round(a.buf.length / 1024) + 'KB raw)...');
    var fullB64  = await compressToJpegDataUri(a.buf, 1800, 82);
    var thumbB64 = await compressToJpegDataUri(a.buf,  500, 75);
    console.log('[ART] ' + plants[ai] + ' done');
    artworks.push({ b64: fullB64, thumbB64: thumbB64, source: a.source });
  }

  var beforeKB = artworkRaw.reduce(function(s, a) { return s + (a ? a.buf.length : 0); }, 0) / 1024;
  var afterKB  = artworks.reduce(function(s, a) {
    if (!a) return s;
    return s + (a.b64.length * 0.75 / 1024) + (a.thumbB64.length * 0.75 / 1024);
  }, 0);
  console.log('[garden] Artwork: ' + Math.round(beforeKB) + 'KB raw \u2192 ~' + Math.round(afterKB) + 'KB compressed');

  // ── Inspo gardens ──────────────────────────────────────────────────────
  console.log('[garden] Fetching 12 inspo gardens...');
  var inspoMonthNames = [];
  for (var ii = 0; ii < 12; ii++) inspoMonthNames.push(MONTH_NAMES[(startMonth + ii) % 12]);

  var climate    = (geo && geo.displayName) || order.climate || '';
  var userRegion = (geo && geo.userRegion)  || 'mainland';
  var inspos = await fetchAllInspos(
    plants, inspoMonthNames, climate,
    geo && geo.lat, geo && geo.lng, userRegion, apiKey
  );

  // ── Inspo photos ───────────────────────────────────────────────────────
  console.log('[garden] Loading & compressing inspo photos...');
  var inspoPhotoBuffers = await Promise.all(inspos.map(function(inspo) {
    if (!inspo || !inspo.name) return Promise.resolve(null);
    var diskBuf = readGardenPhotoFromDisk(inspo.name);
    if (diskBuf) return Promise.resolve(diskBuf);
    return fetchWikipediaPhotoBuffer(inspo.wikipedia || inspo.name);
  }));

  var inspoPhotos = await Promise.all(inspoPhotoBuffers.map(async function(buf) {
    if (!buf) return null;
    return await compressToJpegDataUri(buf, 400, 75);
  }));
  console.log('[garden] Inspo photos: ' + inspoPhotos.filter(Boolean).length + '/12 found');

  // ── QR codes ───────────────────────────────────────────────────────────
  // Embed ref=print and the print token in the QR URL so wall calendar
  // customers are identified and their credits restored if cache is cleared.
  var appUrl = 'https://garden-calendar-frontend.vercel.app?ref=print'
    + (order.printToken ? '&token=' + order.printToken : '');
  var appQrB64 = await makeQrB64(appUrl);
  console.log('[garden] App QR: ' + (appQrB64 ? 'ok' : 'failed'));

  var inspoQrB64s = await Promise.all(inspos.map(function(ins) {
    if (!ins || !ins.name) return Promise.resolve('');
    // Prefer Wikipedia URL if the inspo response included a valid article title,
    // else fall back to a Google Search URL.
    var visitUrl;
    if (ins.wikipedia && typeof ins.wikipedia === 'string' && ins.wikipedia !== 'null') {
      visitUrl = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(ins.wikipedia.replace(/ /g, '_'));
    } else {
      visitUrl = 'https://www.google.com/search?q=' + encodeURIComponent(ins.name + ' ' + (ins.location || '') + ' garden');
    }
    return makeQrB64(visitUrl);
  }));
  console.log('[garden] Inspo QRs: ' + inspoQrB64s.filter(Boolean).length + '/12 ok');

  return { artworks, inspos, inspoPhotos, inspoQrB64s, appQrB64 };
}

// buildMonthContent — returns the garden-specific fields merged into monthOpts
// for buildPageA (called per month by the generic loop in pdfService.js).
function buildMonthContent(monthLoopIndex, order, sharedState) {
  var j        = monthLoopIndex;
  var artworks = sharedState.artworks;
  return {
    plant:         order.plants[j] || '',
    artworkB64:    artworks[j] ? artworks[j].b64    : '',
    artworkSource: artworks[j] ? artworks[j].source : '',
    inspo:         sharedState.inspos[j]      || null,
    inspoPhotoB64: sharedState.inspoPhotos[j] || '',
    inspoQrB64:    sharedState.inspoQrB64s[j] || '',
    appQrB64:      sharedState.appQrB64,
  };
}

// buildCoverExtras — returns the garden-specific fields for buildCoverPage
function buildCoverExtras(order, sharedState) {
  var artworks = sharedState.artworks;
  return {
    artworks:      artworks.map(function(a) { return a ? a.thumbB64 : ''; }),
    artworkSources: artworks.map(function(a) { return a ? a.source  : ''; }),
    plants:        order.plants,
    appQrB64:      sharedState.appQrB64,
  };
}

// ── buildPageA ────────────────────────────────────────────────────────────────
function buildPageA(opts) {
  var monthName     = opts.monthName;
  var monthIdx      = opts.monthIdx;
  var year          = opts.year;
  var plant         = opts.plant || '';
  var artworkB64    = opts.artworkB64 || '';
  var artworkSource = opts.artworkSource || 'K\u00f6hler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Public Domain';
  var inspo         = opts.inspo || null;
  var inspoPhotoB64 = opts.inspoPhotoB64 || '';
  var inspoQrB64    = opts.inspoQrB64 || '';
  var appQrB64      = opts.appQrB64 || '';
  var climate       = opts.climate || '';
  var climateData   = opts.climateData || null;
  var climateZone   = opts.climateZone || 'temperate';
  var calendarName  = opts.calendarName || opts.recipientName || '';

  var plantDisplay = plant
    ? (PLANT_DISPLAY[plant] || (plant.charAt(0).toUpperCase() + plant.slice(1)))
    : monthName;
  var commentary   = getCommentary(plant);
  var quote        = QUOTES[monthIdx % QUOTES.length];
  var taskText     = (MONTHLY_TASKS[climateZone] || MONTHLY_TASKS.temperate)[monthIdx] || '';

  // Climate bar
  var climateHtml = '';
  if (climateData && climateData._cd) {
    var cd   = climateData._cd;
    var tMax = cd.tMax  && cd.tMax[monthIdx]  != null ? Math.round(cd.tMax[monthIdx])  + '\u00b0C' : null;
    var tMin = cd.tMin  && cd.tMin[monthIdx]  != null ? Math.round(cd.tMin[monthIdx])  + '\u00b0C' : null;
    var rain  = cd.precip    && cd.precip[monthIdx]    != null ? Math.round(cd.precip[monthIdx])    + 'mm'          : null;
    var sun  = cd.sunHrs && cd.sunHrs[monthIdx] != null ? parseFloat(cd.sunHrs[monthIdx]).toFixed(1) + ' hrs daylight' : null;
    var parts = [];
    if (tMax || tMin) parts.push('\u25b2 ' + (tMax || '') + (tMax && tMin ? '  \u25bc ' : '') + (tMin ? tMin : ''));
    if (rain)  parts.push('\u2602 ' + rain);
    if (sun)   parts.push('\u2600 ' + sun);
    var statsLine = parts.join('  \u00b7  ');
    climateHtml = '<div class="climate-bar">'
      + '<span class="climate-region">' + esc(climate) + '</span>'
      + (statsLine ? '<span class="climate-stats">' + statsLine + '</span>' : '')
      + '</div>';
  } else if (climate) {
    climateHtml = '<div class="climate-bar"><span class="climate-region">' + esc(climate) + '</span></div>';
  }

  // Plant commentary box
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

  // Inspo block
  var inspoHtml = '';
  if (inspo && inspo.name) {
    inspoHtml = '<div class="inspo-block">'
      + '<div class="section-label">Have you visited this garden?</div>'
      + '<div class="inspo-row">';
    if (inspoPhotoB64) {
      inspoHtml += '<div class="inspo-photo-col"><img src="' + inspoPhotoB64 + '" alt="' + esc(inspo.name) + '"/></div>';
    }
    inspoHtml += '<div class="inspo-text-col">'
      + '<div class="inspo-name">'      + esc(inspo.name)      + '</div>'
      + (inspo.location  ? '<div class="inspo-location">'  + esc(inspo.location)  + '</div>' : '')
      + (inspo.highlight ? '<div class="inspo-highlight">' + esc(inspo.highlight) + '</div>' : '')
      + '</div>';
    if (inspoQrB64) {
      inspoHtml += '<div class="inspo-qr-col">'
        + '<img src="' + inspoQrB64 + '" width="52" height="52" alt="Visit QR"/>'
        + '<div class="inspo-qr-lbl">Visit \u2197</div>'
        + '</div>';
    }
    inspoHtml += '</div></div>';
  }

  // Footer: quote + app QR
  var footerHtml = '<div class="page-footer">'
    + '<div class="footer-quote-col">'
    + '<div class="quote-text">\u201c' + esc(quote.text) + '\u201d</div>'
    + '<div class="quote-attr">\u2014\u00a0' + esc(quote.author) + '</div>'
    + '</div>'
    + '</div>';

  return '<div class="cal-page page-a">'
    + '<div class="page-a-layout">'
    + '<div class="col-artwork">'
    + (artworkB64
        ? '<img class="artwork-img" src="' + artworkB64 + '" alt="' + esc(plantDisplay) + ' botanical illustration"/>'
        : '<div class="artwork-placeholder"><div class="artwork-placeholder-text">' + esc(plantDisplay) + '</div></div>')
    + '<div class="artwork-footer">'
    + '<span class="artwork-plant-name">' + esc(plantDisplay)
      + (commentary.latin ? ' <span class="artwork-latin">' + esc(commentary.latin) + '</span>' : '')
    + '</span>'
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

// ── buildCoverPage ────────────────────────────────────────────────────────────
function buildCoverPage(opts) {
  var calendarName   = opts.calendarName   || '';
  var dateRange      = opts.dateRange      || '';
  var climate        = opts.climate        || '';
  var artworks       = opts.artworks       || [];
  var artworkSources = opts.artworkSources || [];
  var plants         = opts.plants         || [];
  var monthNames     = opts.monthNames     || [];
  var appQrB64       = opts.appQrB64       || '';
  var personalMsg    = opts.personalMsg    || '';
  var etsyUrl        = opts.etsyUrl        || 'etsy.com/shop/ClockwatcherAlmanacs';
  var startMonthIdx  = opts.startMonthIdx  || 0;

  // Thumbnail grid
  var thumbsHtml = '';
  for (var i = 0; i < 12; i++) {
    var plantName = plants[i]
      ? (PLANT_DISPLAY[plants[i]] || (plants[i].charAt(0).toUpperCase() + plants[i].slice(1)))
      : '';
    var monthName = monthNames[i] || '';
    var art       = artworks[i]   || '';
    thumbsHtml += '<div class="cv-thumb-item">'
      + '<div class="cv-thumb-img">'
      + (art
          ? '<img src="' + art + '" alt="' + esc(plantName) + '"/>'
          : '<span class="cv-thumb-placeholder">' + esc(plantName) + '</span>')
      + '</div>'
      + '<div class="cv-thumb-month">' + esc(monthName) + '</div>'
      + '</div>';
  }

  var climateChartHtml = climateChart.buildClimateChart(
    opts.climateData, startMonthIdx, monthNames, climate
  );

  var datesExplainHtml = '<div class="cv-ics-block">'
    + '<span class="cv-section-label">Your special dates &amp; holidays</span>'
    + '<div class="cv-dates-explain">'
    + '<p><strong>Birthdays &amp; anniversaries</strong> are marked on each monthly calendar page.</p>'
    + '<p><strong>Holiday periods</strong> are shaded on each monthly calendar page.</p>'
    + '</div>'
    + '</div>';

  var msgHtml = '<div class="cv-message-block">'
    + '<div class="cv-message-area">'
    + '<div class="cv-message-label">A personal message</div>'
    + (personalMsg
        ? '<div class="cv-message-text">' + esc(personalMsg) + '</div>'
        : '<div class="cv-message-text cv-message-placeholder">With love\u2026</div>')
    + '</div>'
    + '</div>';

  var hasKoehler = artworkSources.some(function(s) { return s && s.indexOf('K\u00f6hler')  !== -1; });
  var hasEdwards = artworkSources.some(function(s) { return s && s.indexOf('Edwards') !== -1; });
  var hasRedoute = artworkSources.some(function(s) { return s && s.indexOf('Redout')  !== -1; });
  var provLines  = [];
  if (hasKoehler) provLines.push('<em>K\u00f6hler\u2019s Medizinal-Pflanzen</em> (1887\u20131898) \u00b7 Public domain \u00b7 Missouri Botanical Garden');
  if (hasEdwards) provLines.push('<em>Edwards\u2019 Botanical Register</em> (1815\u20131847) \u00b7 Public domain');
  if (hasRedoute) provLines.push('<em>Trait\u00e9 des Arbres et Arbustes</em>, Pierre Joseph Redout\u00e9 (1801\u20131819) \u00b7 Public domain');
  if (!provLines.length) provLines.push('All botanical illustrations are in the public domain.');

  var provHtml = '<div class="cv-provenance-block">'
    + '<span class="cv-section-label">About the illustrations</span>'
    + '<div class="cv-provenance-text">' + provLines.join('<br/>') + '</div>'
    + '</div>';

  var bottomHtml = '<div class="cv-bottom-row">'
    + '<div class="cv-etsy-row">'
    + '<div class="cv-etsy-stack">'
    + '<span class="cv-etsy-badge">Find us on Etsy</span>'
    + '<span class="cv-etsy-url">' + esc(etsyUrl) + '</span>'
    + '</div>'
    + '</div>'
    + '<div class="cv-webapp-row">'
    + (appQrB64 ? '<img class="cv-webapp-qr" src="' + appQrB64 + '" alt="App QR"/>' : '')
    + '<div class="cv-webapp-text">'
    + '<div class="cv-webapp-title">Your Garden Calendar by Clockwatcher Almanacs</div>'
    + '<div class="cv-webapp-url">garden-calendar-frontend.vercel.app</div>'
    + '</div>'
    + '</div>'
    + '</div>';

  return '<div class="cv-cover">'
    + '<div class="cv-thumb-panel">' + thumbsHtml + '</div>'
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

module.exports = {
  id:               'garden-wall-calendar',
  validateOrder:    validateOrder,
  buildSharedState: buildSharedState,
  buildMonthContent: buildMonthContent,
  buildCoverExtras: buildCoverExtras,
  buildPageA:       buildPageA,
  buildCoverPage:   buildCoverPage,
  // Exposed for calendarTemplate.js setPlantCommentary compatibility (startup only)
  _deriveUserRegion: _deriveUserRegion,
};
