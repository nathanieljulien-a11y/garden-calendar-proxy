// products/garden-wall-calendar-na.js (CommonJS)
// North America (US & Canada) variant of the garden wall calendar.
// Ledger size: 11 × 16.5 inches (279mm × 419mm), wire-bound with hook top.
//
// All layout, artwork, inspo, garden database, and generation logic is
// inherited from garden-wall-calendar.js — this file only overrides the
// product identity fields consumed by orderService.js and products/index.js.
//
// PDF page dimensions are controlled by calendarTemplate.js (.cal-sheet CSS).
// The NA sheet size requires a separate calendarTemplate variant or an
// override mechanism — see BACKLOG NA-1 for the dimension work still to do.
// This file is the product registry entry; dimension changes are a follow-on
// task in the same sprint once the Gelato test print confirms the spec.

var base = require('./garden-wall-calendar.js');

// ── NA garden seed list ───────────────────────────────────────────────────────
// 175 real, publicly accessible gardens across US and Canada.
// Overrides the UK GARDENS array inherited from garden-wall-calendar.js.
// Same format: { name, lat, lng, region }
// ─────────────────────────────────────────────────────────────────────────────
var NA_GARDENS = [

  // ── Northeast US: New York ────────────────────────────────────────────────
  { name: 'New York Botanical Garden',             lat: 40.8628, lng: -73.8784, region: 'mainland' },
  { name: 'Brooklyn Botanic Garden',               lat: 40.6694, lng: -73.9632, region: 'mainland' },
  { name: 'The Cloisters Garden',                  lat: 40.8648, lng: -73.9317, region: 'mainland' },
  { name: 'Untermyer Park and Gardens',            lat: 40.9676, lng: -73.8742, region: 'mainland' },
  { name: 'Innisfree Garden',                      lat: 41.5434, lng: -73.7987, region: 'mainland' },
  { name: 'Stonecrop Gardens',                     lat: 41.4612, lng: -73.7348, region: 'mainland' },
  { name: 'Wave Hill',                             lat: 40.9001, lng: -73.9136, region: 'mainland' },
  { name: 'Old Westbury Gardens',                  lat: 40.7876, lng: -73.5984, region: 'mainland' },
  { name: 'Planting Fields Arboretum',             lat: 40.8445, lng: -73.5736, region: 'mainland' },
  { name: 'Snug Harbor Botanical Garden',          lat: 40.6437, lng: -74.1009, region: 'mainland' },

  // ── Northeast US: New England ─────────────────────────────────────────────
  { name: 'Arnold Arboretum',                      lat: 42.3041, lng: -71.1248, region: 'mainland' },
  { name: 'Boston Public Garden',                  lat: 42.3541, lng: -71.0699, region: 'mainland' },
  { name: 'Garden in the Woods',                   lat: 42.3153, lng: -71.4209, region: 'mainland' },
  { name: 'New England Botanic Garden at Tower Hill', lat: 42.3482, lng: -71.8615, region: 'mainland' },
  { name: 'Coastal Maine Botanical Gardens',       lat: 43.8553, lng: -69.6378, region: 'mainland' },
  { name: 'Berkshire Botanical Garden',            lat: 42.2929, lng: -73.3234, region: 'mainland' },
  { name: 'Blithewold Mansion Gardens',            lat: 41.6584, lng: -71.2723, region: 'mainland' },
  { name: 'Elizabeth Park Rose Garden',            lat: 41.7720, lng: -72.7201, region: 'mainland' },
  { name: 'Green Animals Topiary Garden',          lat: 41.5884, lng: -71.2567, region: 'mainland' },
  { name: 'Fuller Gardens',                        lat: 42.9013, lng: -70.8234, region: 'mainland' },
  { name: 'Heritage Museums and Gardens',          lat: 41.7190, lng: -70.4762, region: 'mainland' },
  { name: 'Smith College Botanic Garden',          lat: 42.3182, lng: -72.6418, region: 'mainland' },
  { name: 'Polly Hill Arboretum',                  lat: 41.3837, lng: -70.6723, region: 'mainland' },

  // ── Northeast US: Mid-Atlantic ────────────────────────────────────────────
  { name: 'Longwood Gardens',                      lat: 39.8706, lng: -75.6718, region: 'mainland' },
  { name: 'Winterthur Museum and Garden',          lat: 39.8687, lng: -75.5976, region: 'mainland' },
  { name: 'Mt. Cuba Center',                       lat: 39.8251, lng: -75.6028, region: 'mainland' },
  { name: 'Chanticleer Garden',                    lat: 40.0440, lng: -75.3645, region: 'mainland' },
  { name: 'Pennsylvania Horticultural Society Garden', lat: 39.9526, lng: -75.1932, region: 'mainland' },
  { name: 'Morris Arboretum',                      lat: 40.0898, lng: -75.2051, region: 'mainland' },
  { name: 'Scott Arboretum of Swarthmore College', lat: 39.9043, lng: -75.3551, region: 'mainland' },
  { name: 'Nemours Estate Gardens',                lat: 39.8057, lng: -75.5679, region: 'mainland' },
  { name: 'Delaware Botanic Gardens',              lat: 38.5390, lng: -75.2345, region: 'mainland' },
  { name: 'US National Arboretum',                 lat: 38.9127, lng: -76.9722, region: 'mainland' },
  { name: 'Brookside Gardens',                     lat: 39.0612, lng: -77.0648, region: 'mainland' },
  { name: 'Ladew Topiary Gardens',                 lat: 39.5812, lng: -76.5698, region: 'mainland' },
  { name: 'Cylburn Arboretum',                     lat: 39.3573, lng: -76.6662, region: 'mainland' },
  { name: 'William Paca House Garden',             lat: 38.9790, lng: -76.4924, region: 'mainland' },
  { name: 'Lewis Ginter Botanical Garden',         lat: 37.6098, lng: -77.4768, region: 'mainland' },
  { name: 'Norfolk Botanical Garden',              lat: 36.8994, lng: -76.2148, region: 'mainland' },
  { name: 'Monticello Gardens',                    lat: 38.0085, lng: -78.4528, region: 'mainland' },
  { name: 'Maymont Gardens',                       lat: 37.5365, lng: -77.4729, region: 'mainland' },
  { name: 'Meadowlark Botanical Gardens',          lat: 38.9476, lng: -77.2943, region: 'mainland' },
  { name: 'Dumbarton Oaks',                        lat: 38.9141, lng: -77.0631, region: 'mainland' },
  { name: 'United States Botanic Garden',          lat: 38.8874, lng: -77.0137, region: 'mainland' },
  { name: 'Hillwood Estate Gardens',               lat: 38.9487, lng: -77.0838, region: 'mainland' },

  // ── Southeast US: Carolinas ───────────────────────────────────────────────
  { name: 'Sarah P. Duke Gardens',                 lat: 35.9988, lng: -78.9427, region: 'mainland' },
  { name: 'North Carolina Botanical Garden',       lat: 35.8885, lng: -79.0444, region: 'mainland' },
  { name: 'Daniel Stowe Botanical Garden',         lat: 35.2067, lng: -81.2098, region: 'mainland' },
  { name: 'Airlie Gardens',                        lat: 34.2045, lng: -77.8465, region: 'mainland' },
  { name: 'Cape Fear Botanical Garden',            lat: 35.0766, lng: -78.8920, region: 'mainland' },
  { name: 'JC Raulston Arboretum',                 lat: 35.7867, lng: -78.6745, region: 'mainland' },
  { name: 'Brookgreen Gardens',                    lat: 33.5448, lng: -79.1156, region: 'mainland' },
  { name: 'Middleton Place',                       lat: 32.8928, lng: -80.1801, region: 'mainland' },
  { name: 'Magnolia Plantation and Gardens',       lat: 32.9229, lng: -80.1442, region: 'mainland' },
  { name: 'Riverbanks Botanical Garden',           lat: 34.0127, lng: -81.0487, region: 'mainland' },

  // ── Southeast US: Georgia & Tennessee ────────────────────────────────────
  { name: 'Atlanta Botanical Garden',              lat: 33.7900, lng: -84.3732, region: 'mainland' },
  { name: 'State Botanical Garden of Georgia',     lat: 33.9109, lng: -83.3532, region: 'mainland' },
  { name: 'Callaway Gardens',                      lat: 32.8752, lng: -84.9845, region: 'mainland' },
  { name: 'Gibbs Gardens',                         lat: 34.2734, lng: -84.5512, region: 'mainland' },
  { name: 'Coastal Georgia Botanical Gardens',     lat: 31.9968, lng: -81.2156, region: 'mainland' },
  { name: 'Cheekwood Botanical Garden',            lat: 36.0824, lng: -86.8776, region: 'mainland' },
  { name: 'Memphis Botanical Garden',              lat: 35.1087, lng: -89.9123, region: 'mainland' },
  { name: 'Knoxville Botanical Garden',            lat: 35.9688, lng: -83.8794, region: 'mainland' },
  { name: 'Reflection Riding Arboretum',           lat: 35.0234, lng: -85.3876, region: 'mainland' },

  // ── Southeast US: Alabama, Louisiana & Texas ──────────────────────────────
  { name: 'Birmingham Botanical Gardens',          lat: 33.4929, lng: -86.7637, region: 'mainland' },
  { name: 'Bellingrath Gardens',                   lat: 30.4540, lng: -88.1109, region: 'mainland' },
  { name: 'New Orleans Botanical Garden',          lat: 29.9801, lng: -90.0912, region: 'mainland' },
  { name: 'Rosedown Plantation',                   lat: 30.8248, lng: -91.2215, region: 'mainland' },
  { name: 'San Antonio Botanical Garden',          lat: 29.4571, lng: -98.4584, region: 'mainland' },
  { name: 'Houston Botanic Garden',                lat: 29.6912, lng: -95.3418, region: 'mainland' },
  { name: 'Dallas Arboretum and Botanical Garden', lat: 32.8237, lng: -96.7168, region: 'mainland' },
  { name: 'Fort Worth Botanic Garden',             lat: 32.7384, lng: -97.3715, region: 'mainland' },
  { name: 'Lady Bird Johnson Wildflower Center',   lat: 30.1868, lng: -97.8773, region: 'mainland' },

  // ── Southeast US: Florida ─────────────────────────────────────────────────
  { name: 'Bok Tower Gardens',                     lat: 27.9376, lng: -81.5887, region: 'mainland' },
  { name: 'Fairchild Tropical Botanic Garden',     lat: 25.6726, lng: -80.2756, region: 'mainland' },
  { name: 'Marie Selby Botanical Gardens',         lat: 27.3342, lng: -82.5465, region: 'mainland' },
  { name: 'Naples Botanical Garden',               lat: 26.1187, lng: -81.7534, region: 'mainland' },
  { name: 'Harry P. Leu Gardens',                  lat: 28.5447, lng: -81.3617, region: 'mainland' },
  { name: 'Kanapaha Botanical Gardens',            lat: 29.6076, lng: -82.4312, region: 'mainland' },
  { name: 'Mounts Botanical Garden',               lat: 26.7106, lng: -80.1083, region: 'mainland' },

  // ── Midwest US: Illinois & Wisconsin ─────────────────────────────────────
  { name: 'Chicago Botanic Garden',                lat: 42.1511, lng: -87.7870, region: 'mainland' },
  { name: 'Morton Arboretum',                      lat: 41.8146, lng: -88.0714, region: 'mainland' },
  { name: 'Garfield Park Conservatory',            lat: 41.8845, lng: -87.7178, region: 'mainland' },
  { name: 'Lincoln Park Conservatory',             lat: 41.9230, lng: -87.6356, region: 'mainland' },
  { name: 'Olbrich Botanical Gardens',             lat: 43.0698, lng: -89.3208, region: 'mainland' },
  { name: 'Boerner Botanical Gardens',             lat: 42.9473, lng: -88.0132, region: 'mainland' },
  { name: 'Green Bay Botanical Garden',            lat: 44.5133, lng: -88.1198, region: 'mainland' },

  // ── Midwest US: Ohio & Michigan ───────────────────────────────────────────
  { name: 'Franklin Park Conservatory',            lat: 39.9684, lng: -82.9535, region: 'mainland' },
  { name: 'Dawes Arboretum',                       lat: 40.0209, lng: -82.3898, region: 'mainland' },
  { name: 'Inniswood Metro Gardens',               lat: 40.1239, lng: -82.9076, region: 'mainland' },
  { name: 'Toledo Botanical Garden',               lat: 41.6898, lng: -83.6045, region: 'mainland' },
  { name: 'Cleveland Botanical Garden',            lat: 41.5106, lng: -81.6098, region: 'mainland' },
  { name: 'Holden Arboretum',                      lat: 41.6048, lng: -81.3245, region: 'mainland' },
  { name: 'Dow Gardens',                           lat: 43.6198, lng: -84.2378, region: 'mainland' },
  { name: 'Michigan State University Hidden Lake Gardens', lat: 42.0628, lng: -84.1456, region: 'mainland' },
  { name: 'Anna Scripps Whitcomb Conservatory',    lat: 42.3434, lng: -83.0448, region: 'mainland' },
  { name: 'Matthaei Botanical Gardens',            lat: 42.2834, lng: -83.6748, region: 'mainland' },

  // ── Midwest US: Minnesota, Missouri, Iowa & Kentucky ─────────────────────
  { name: 'Minnesota Landscape Arboretum',         lat: 44.8651, lng: -93.6134, region: 'mainland' },
  { name: 'Como Park Zoo and Conservatory',        lat: 44.9812, lng: -93.1526, region: 'mainland' },
  { name: 'Missouri Botanical Garden',             lat: 38.6127, lng: -90.2590, region: 'mainland' },
  { name: 'Powell Gardens',                        lat: 38.8517, lng: -94.2045, region: 'mainland' },
  { name: 'Lauritzen Gardens',                     lat: 41.2198, lng: -95.9634, region: 'mainland' },
  { name: 'Yew Dell Botanical Gardens',            lat: 38.3409, lng: -85.4401, region: 'mainland' },
  { name: 'State Botanical Garden of Kentucky',    lat: 38.0298, lng: -84.5128, region: 'mainland' },

  // ── Mountain / Rocky Mountain US ─────────────────────────────────────────
  { name: 'Denver Botanic Gardens',                lat: 39.7325, lng: -104.9610, region: 'mainland' },
  { name: 'Hudson Gardens',                        lat: 39.5701, lng: -105.0748, region: 'mainland' },
  { name: 'Betty Ford Alpine Gardens',             lat: 39.6445, lng: -106.3754, region: 'mainland' },
  { name: 'Gardens on Spring Creek',               lat: 40.5768, lng: -105.0620, region: 'mainland' },
  { name: 'Red Butte Garden',                      lat: 40.7673, lng: -111.8245, region: 'mainland' },
  { name: 'Thanksgiving Point Gardens',            lat: 40.4148, lng: -111.8945, region: 'mainland' },
  { name: 'Idaho Botanical Garden',                lat: 43.6015, lng: -116.1695, region: 'mainland' },
  { name: 'Cheyenne Botanic Gardens',              lat: 41.1412, lng: -104.7987, region: 'mainland' },
  { name: 'Rio Grande Botanic Garden',             lat: 35.1050, lng: -106.6967, region: 'mainland' },
  { name: 'Tucson Botanical Garden',               lat: 32.2440, lng: -110.9132, region: 'mainland' },
  { name: 'Desert Botanical Garden',               lat: 33.4618, lng: -111.9445, region: 'mainland' },
  { name: 'Boyce Thompson Arboretum',              lat: 33.2848, lng: -111.1587, region: 'mainland' },

  // ── Pacific Northwest: Washington State ───────────────────────────────────
  { name: 'Washington Park Arboretum',             lat: 47.6390, lng: -122.2962, region: 'mainland' },
  { name: 'Bellevue Botanical Garden',             lat: 47.5934, lng: -122.1531, region: 'mainland' },
  { name: 'Kubota Garden',                         lat: 47.5153, lng: -122.2912, region: 'mainland' },
  { name: 'Rhododendron Species Botanical Garden', lat: 47.3184, lng: -122.3217, region: 'mainland' },
  { name: 'Lakewold Gardens',                      lat: 47.2590, lng: -122.4401, region: 'mainland' },
  { name: 'Skagit Valley Tulip Fields',            lat: 48.4248, lng: -122.3345, region: 'mainland' },
  { name: 'Ohme Gardens',                          lat: 47.5134, lng: -120.3287, region: 'mainland' },
  { name: 'Manito Park and Botanical Gardens',     lat: 47.6348, lng: -117.3948, region: 'mainland' },
  { name: 'Bloedel Reserve',                       lat: 47.7187, lng: -122.5623, region: 'mainland' },

  // ── Pacific Northwest: Oregon ─────────────────────────────────────────────
  { name: 'Portland Japanese Garden',              lat: 45.5195, lng: -122.7062, region: 'mainland' },
  { name: 'International Rose Test Garden',        lat: 45.5193, lng: -122.7049, region: 'mainland' },
  { name: 'Leach Botanical Garden',                lat: 45.4682, lng: -122.5634, region: 'mainland' },
  { name: 'Oregon Garden',                         lat: 44.9865, lng: -122.7234, region: 'mainland' },
  { name: 'Shore Acres State Park Garden',         lat: 43.3248, lng: -124.3934, region: 'mainland' },
  { name: 'Owen Rose Garden',                      lat: 44.0487, lng: -123.1023, region: 'mainland' },
  { name: 'Hendricks Park Rhododendron Garden',    lat: 44.0434, lng: -123.0823, region: 'mainland' },
  { name: 'Crystal Springs Rhododendron Garden',   lat: 45.4751, lng: -122.6362, region: 'mainland' },

  // ── California: Bay Area & Northern California ────────────────────────────
  { name: 'UC Botanical Garden at Berkeley',       lat: 37.8762, lng: -122.2384, region: 'mainland' },
  { name: 'Filoli Historic House and Garden',      lat: 37.4615, lng: -122.2843, region: 'mainland' },
  { name: 'San Francisco Botanical Garden',        lat: 37.7696, lng: -122.4693, region: 'mainland' },
  { name: 'Conservatory of Flowers',               lat: 37.7712, lng: -122.4605, region: 'mainland' },
  { name: 'Ruth Bancroft Garden',                  lat: 37.9098, lng: -121.9987, region: 'mainland' },
  { name: 'Quarryhill Botanical Garden',           lat: 38.3812, lng: -122.5145, region: 'mainland' },
  { name: 'Mendocino Coast Botanical Gardens',     lat: 39.3087, lng: -123.8123, region: 'mainland' },
  { name: 'Hakone Estate and Gardens',             lat: 37.2523, lng: -122.0234, region: 'mainland' },

  // ── California: Southern California ──────────────────────────────────────
  { name: 'The Huntington Library and Gardens',    lat: 34.1290, lng: -118.1143, region: 'mainland' },
  { name: 'Descanso Gardens',                      lat: 34.2012, lng: -118.2101, region: 'mainland' },
  { name: 'Los Angeles County Arboretum',          lat: 34.1462, lng: -117.9734, region: 'mainland' },
  { name: 'South Coast Botanic Garden',            lat: 33.7562, lng: -118.3623, region: 'mainland' },
  { name: 'Santa Barbara Botanic Garden',          lat: 34.4512, lng: -119.7234, region: 'mainland' },
  { name: 'Lotusland',                             lat: 34.4487, lng: -119.7412, region: 'mainland' },
  { name: 'Rancho Santa Ana Botanic Garden',       lat: 34.1215, lng: -117.7134, region: 'mainland' },
  { name: 'Balboa Park Botanical Building',        lat: 32.7312, lng: -117.1512, region: 'mainland' },
  { name: 'San Diego Botanic Garden',              lat: 33.0862, lng: -116.9923, region: 'mainland' },
  { name: 'UC Riverside Botanic Gardens',          lat: 33.9734, lng: -117.3276, region: 'mainland' },
  { name: 'Sherman Library and Gardens',           lat: 33.6165, lng: -117.8734, region: 'mainland' },

  // ── Canada: British Columbia ──────────────────────────────────────────────
  { name: 'Butchart Gardens',                      lat: 48.5648, lng: -123.4698, region: 'mainland' },
  { name: 'VanDusen Botanical Garden',             lat: 49.2376, lng: -123.1334, region: 'mainland' },
  { name: 'UBC Botanical Garden',                  lat: 49.2537, lng: -123.2523, region: 'mainland' },
  { name: 'Nitobe Memorial Garden',                lat: 49.2659, lng: -123.2587, region: 'mainland' },
  { name: 'Queen Elizabeth Park',                  lat: 49.2423, lng: -123.1123, region: 'mainland' },
  { name: 'Horticulture Centre of the Pacific',    lat: 48.5023, lng: -123.3756, region: 'mainland' },
  { name: 'Milner Gardens and Woodland',           lat: 49.3712, lng: -124.3234, region: 'mainland' },
  { name: 'Tofino Botanical Gardens',              lat: 49.1445, lng: -125.9067, region: 'mainland' },

  // ── Canada: Ontario ───────────────────────────────────────────────────────
  { name: 'Royal Botanical Gardens Burlington',    lat: 43.3198, lng: -79.8623, region: 'mainland' },
  { name: 'Toronto Botanical Garden',              lat: 43.7312, lng: -79.3534, region: 'mainland' },
  { name: 'Edwards Gardens',                       lat: 43.7342, lng: -79.3487, region: 'mainland' },
  { name: 'Niagara Parks Botanical Gardens',       lat: 43.1523, lng: -79.0587, region: 'mainland' },
  { name: 'Allan Gardens Conservatory',            lat: 43.6612, lng: -79.3723, region: 'mainland' },
  { name: 'Guelph Arboretum',                      lat: 43.5348, lng: -80.2312, region: 'mainland' },
  { name: 'Humber Arboretum',                      lat: 43.7523, lng: -79.5912, region: 'mainland' },
  { name: 'Centennial Park Conservatory',          lat: 43.6334, lng: -79.5687, region: 'mainland' },
  { name: 'Parkwood Estate Gardens',               lat: 43.8923, lng: -78.8712, region: 'mainland' },

  // ── Canada: Quebec ────────────────────────────────────────────────────────
  { name: 'Montreal Botanical Garden',             lat: 45.5590, lng: -73.5561, region: 'mainland' },
  { name: 'Jardins de Metis',                      lat: 48.6645, lng: -68.0823, region: 'mainland' },
  { name: 'Domaine Joly-De Lotbiniere',            lat: 46.6734, lng: -71.8212, region: 'mainland' },
  { name: 'Jardin botanique de Quebec',            lat: 46.8223, lng: -71.2234, region: 'mainland' },

  // ── Canada: Alberta ───────────────────────────────────────────────────────
  { name: 'University of Alberta Botanic Garden',  lat: 53.3748, lng: -113.7234, region: 'mainland' },
  { name: 'Muttart Conservatory',                  lat: 53.5334, lng: -113.4812, region: 'mainland' },
  { name: 'Reader Rock Garden',                    lat: 51.0223, lng: -114.0612, region: 'mainland' },
  { name: 'Nikka Yuko Japanese Garden',            lat: 49.6934, lng: -112.8387, region: 'mainland' },

  // ── Canada: Nova Scotia & New Brunswick ──────────────────────────────────
  { name: 'Halifax Public Gardens',                lat: 44.6412, lng: -63.5823, region: 'mainland' },
  { name: 'Annapolis Royal Historic Gardens',      lat: 44.7434, lng: -65.5145, region: 'mainland' },
  { name: 'Harriet Irving Botanical Gardens',      lat: 45.0634, lng: -64.3712, region: 'mainland' },
  { name: 'Kingsbrae Garden',                      lat: 45.0748, lng: -67.0523, region: 'mainland' },
  { name: 'New Brunswick Botanical Garden',        lat: 47.3612, lng: -68.3223, region: 'mainland' },

];

module.exports = Object.assign({}, base, {
  id:            'garden-wall-calendar-na',
  gelatoSku:     'wall_calendar_product_pf_xl11x16-5-inch_pt_100-lb-cover-coated-silk_cl_4-4_bt_wire-with-hook-top_ct_none_prt_none_ver',
  // formatOverride tells pdfService to use the 'na' FORMATS entry (287.4×427.1mm bleed sheet)
  // instead of the default 'a3' dimensions.
  formatOverride: 'na',
  GARDENS:       NA_GARDENS,
});
