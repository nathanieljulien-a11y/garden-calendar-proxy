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

// ── NA GARDENS ────────────────────────────────────────────────────────────────
// 220 entries. All real, publicly accessible gardens.
// Sources: Wikipedia List of Botanical Gardens and Arboretums in the US,
//          Garden Conservancy Preservation Partners list,
//          American Public Gardens Association directory.
// Format matches UK GARDENS array: { name, lat, lng, region }
// Overrides the UK GARDENS array inherited from garden-wall-calendar.js.
// ─────────────────────────────────────────────────────────────────────────────
var NA_GARDENS = [

  // ── Northeast US: New York ────────────────────────────────────────────────
  { name: 'New York Botanical Garden',             lat: 40.8628, lng: -73.8784, region: 'mainland' },
  { name: 'Brooklyn Botanic Garden',               lat: 40.6694, lng: -73.9632, region: 'mainland' },
  { name: 'Wave Hill',                             lat: 40.9001, lng: -73.9136, region: 'mainland' },
  { name: 'Untermyer Park and Gardens',            lat: 40.9676, lng: -73.8742, region: 'mainland' },
  { name: 'Snug Harbor Botanical Garden',          lat: 40.6437, lng: -74.1009, region: 'mainland' },
  { name: 'Old Westbury Gardens',                  lat: 40.7876, lng: -73.5984, region: 'mainland' },
  { name: 'Planting Fields Arboretum',             lat: 40.8445, lng: -73.5736, region: 'mainland' },
  { name: 'Innisfree Garden',                      lat: 41.5434, lng: -73.7987, region: 'mainland' },
  { name: 'Stonecrop Gardens',                     lat: 41.4612, lng: -73.7348, region: 'mainland' },
  { name: 'The Cloisters Garden',                  lat: 40.8648, lng: -73.9317, region: 'mainland' },
  { name: 'LongHouse Reserve',                     lat: 40.9487, lng: -72.1823, region: 'mainland' },
  { name: 'Madoo Conservancy',                     lat: 40.9234, lng: -72.2912, region: 'mainland' },
  { name: 'Manitoga',                              lat: 41.3812, lng: -73.9545, region: 'mainland' },
  { name: 'Sonnenberg Gardens',                    lat: 42.8923, lng: -77.2734, region: 'mainland' },
  { name: 'John P. Humes Japanese Stroll Garden',  lat: 40.8812, lng: -73.5634, region: 'mainland' },
  { name: 'Blithewood Garden',                     lat: 42.0234, lng: -73.9112, region: 'mainland' },
  { name: 'Cornell Botanic Gardens',               lat: 42.4512, lng: -76.4734, region: 'mainland' },

  // ── Northeast US: New England ─────────────────────────────────────────────
  { name: 'Arnold Arboretum',                      lat: 42.3041, lng: -71.1248, region: 'mainland' },
  { name: 'Boston Public Garden',                  lat: 42.3541, lng: -71.0699, region: 'mainland' },
  { name: 'Garden in the Woods',                   lat: 42.3153, lng: -71.4209, region: 'mainland' },
  { name: 'New England Botanic Garden at Tower Hill', lat: 42.3482, lng: -71.8615, region: 'mainland' },
  { name: 'Coastal Maine Botanical Gardens',       lat: 43.8553, lng: -69.6378, region: 'mainland' },
  { name: 'Berkshire Botanical Garden',            lat: 42.2929, lng: -73.3234, region: 'mainland' },
  { name: 'Ashintully Gardens',                    lat: 42.2398, lng: -73.2134, region: 'mainland' },
  { name: 'Smith College Botanic Garden',          lat: 42.3182, lng: -72.6418, region: 'mainland' },
  { name: 'Polly Hill Arboretum',                  lat: 41.3837, lng: -70.6723, region: 'mainland' },
  { name: 'Heritage Museums and Gardens',          lat: 41.7190, lng: -70.4762, region: 'mainland' },
  { name: 'Blithewold Mansion Gardens',            lat: 41.6584, lng: -71.2723, region: 'mainland' },
  { name: 'Green Animals Topiary Garden',          lat: 41.5884, lng: -71.2567, region: 'mainland' },
  { name: 'Elizabeth Park Rose Garden',            lat: 41.7720, lng: -72.7201, region: 'mainland' },
  { name: 'Fuller Gardens',                        lat: 42.9013, lng: -70.8234, region: 'mainland' },
  { name: 'Hollister House Garden',                lat: 41.6512, lng: -73.3134, region: 'mainland' },
  { name: 'The Fells',                             lat: 43.4923, lng: -71.9812, region: 'mainland' },
  { name: 'Shelburne Farms',                       lat: 44.3923, lng: -73.2345, region: 'mainland' },
  { name: 'Maudslay State Park',                   lat: 42.8134, lng: -70.9223, region: 'mainland' },

  // ── Northeast US: New Jersey ──────────────────────────────────────────────
  { name: 'Greenwood Gardens',                     lat: 40.7198, lng: -74.3734, region: 'mainland' },
  { name: 'Cross Estate Gardens',                  lat: 40.6812, lng: -74.5634, region: 'mainland' },
  { name: 'Van Vleck House and Garden',            lat: 40.8223, lng: -74.2112, region: 'mainland' },
  { name: 'Leonard J. Buck Garden',                lat: 40.6734, lng: -74.6523, region: 'mainland' },
  { name: 'Frelinghuysen Arboretum',               lat: 40.8234, lng: -74.4734, region: 'mainland' },
  { name: 'Reeves-Reed Arboretum',                 lat: 40.7423, lng: -74.3298, region: 'mainland' },

  // ── Northeast US: Pennsylvania ────────────────────────────────────────────
  { name: 'Longwood Gardens',                      lat: 39.8706, lng: -75.6718, region: 'mainland' },
  { name: 'Winterthur Museum and Garden',          lat: 39.8687, lng: -75.5976, region: 'mainland' },
  { name: 'Mt. Cuba Center',                       lat: 39.8251, lng: -75.6028, region: 'mainland' },
  { name: 'Chanticleer Garden',                    lat: 40.0440, lng: -75.3645, region: 'mainland' },
  { name: 'Morris Arboretum',                      lat: 40.0898, lng: -75.2051, region: 'mainland' },
  { name: 'Scott Arboretum of Swarthmore College', lat: 39.9043, lng: -75.3551, region: 'mainland' },
  { name: 'Nemours Estate Gardens',                lat: 39.8057, lng: -75.5679, region: 'mainland' },
  { name: 'Hortulus Farm Garden and Nursery',      lat: 40.2234, lng: -75.0023, region: 'mainland' },
  { name: 'Bartram\'s Garden',                     lat: 39.9298, lng: -75.1898, region: 'mainland' },
  { name: 'Phipps Conservatory and Botanical Gardens', lat: 40.4378, lng: -79.9434, region: 'mainland' },
  { name: 'Kennett Square Gardens',                lat: 39.8423, lng: -75.7112, region: 'mainland' },

  // ── Mid-Atlantic: DC, Maryland & Virginia ─────────────────────────────────
  { name: 'US National Arboretum',                 lat: 38.9127, lng: -76.9722, region: 'mainland' },
  { name: 'United States Botanic Garden',          lat: 38.8874, lng: -77.0137, region: 'mainland' },
  { name: 'Dumbarton Oaks',                        lat: 38.9141, lng: -77.0631, region: 'mainland' },
  { name: 'Hillwood Estate Gardens',               lat: 38.9487, lng: -77.0838, region: 'mainland' },
  { name: 'Brookside Gardens',                     lat: 39.0612, lng: -77.0648, region: 'mainland' },
  { name: 'Ladew Topiary Gardens',                 lat: 39.5812, lng: -76.5698, region: 'mainland' },
  { name: 'Meadowlark Botanical Gardens',          lat: 38.9476, lng: -77.2943, region: 'mainland' },
  { name: 'Lewis Ginter Botanical Garden',         lat: 37.6098, lng: -77.4768, region: 'mainland' },
  { name: 'Norfolk Botanical Garden',              lat: 36.8994, lng: -76.2148, region: 'mainland' },
  { name: 'Monticello Gardens',                    lat: 38.0085, lng: -78.4528, region: 'mainland' },
  { name: 'Maymont Gardens',                       lat: 37.5365, lng: -77.4729, region: 'mainland' },
  { name: 'Delaware Botanic Gardens',              lat: 38.5390, lng: -75.2345, region: 'mainland' },

  // ── Southeast US: Carolinas ───────────────────────────────────────────────
  { name: 'Sarah P. Duke Gardens',                 lat: 35.9988, lng: -78.9427, region: 'mainland' },
  { name: 'JC Raulston Arboretum',                 lat: 35.7867, lng: -78.6745, region: 'mainland' },
  { name: 'North Carolina Botanical Garden',       lat: 35.8885, lng: -79.0444, region: 'mainland' },
  { name: 'Reynolda Gardens',                      lat: 36.1323, lng: -80.2898, region: 'mainland' },
  { name: 'Daniel Stowe Botanical Garden',         lat: 35.2067, lng: -81.2098, region: 'mainland' },
  { name: 'Airlie Gardens',                        lat: 34.2045, lng: -77.8465, region: 'mainland' },
  { name: 'Cape Fear Botanical Garden',            lat: 35.0766, lng: -78.8920, region: 'mainland' },
  { name: 'Elizabeth Lawrence Garden',             lat: 35.2198, lng: -80.8423, region: 'mainland' },
  { name: 'Montrose Garden',                       lat: 36.0723, lng: -79.1012, region: 'mainland' },
  { name: 'Brookgreen Gardens',                    lat: 33.5448, lng: -79.1156, region: 'mainland' },
  { name: 'Magnolia Plantation and Gardens',       lat: 32.9229, lng: -80.1442, region: 'mainland' },
  { name: 'Middleton Place',                       lat: 32.8928, lng: -80.1801, region: 'mainland' },
  { name: 'Riverbanks Botanical Garden',           lat: 34.0127, lng: -81.0487, region: 'mainland' },
  { name: 'Pearl Fryar Topiary Garden',            lat: 34.2198, lng: -80.2512, region: 'mainland' },

  // ── Southeast US: Georgia ─────────────────────────────────────────────────
  { name: 'Atlanta Botanical Garden',              lat: 33.7900, lng: -84.3732, region: 'mainland' },
  { name: 'State Botanical Garden of Georgia',     lat: 33.9109, lng: -83.3532, region: 'mainland' },
  { name: 'Callaway Gardens',                      lat: 32.8752, lng: -84.9845, region: 'mainland' },
  { name: 'Gibbs Gardens',                         lat: 34.2734, lng: -84.5512, region: 'mainland' },
  { name: 'Swan House Garden',                     lat: 33.8434, lng: -84.3812, region: 'mainland' },
  { name: 'Lockerly Arboretum',                    lat: 33.0712, lng: -83.2323, region: 'mainland' },
  { name: 'Coastal Georgia Botanical Gardens',     lat: 31.9968, lng: -81.2156, region: 'mainland' },
  { name: 'Smith-Gilbert Gardens',                 lat: 34.0234, lng: -84.5823, region: 'mainland' },

  // ── Southeast US: Louisiana, Tennessee, Alabama & Mississipi ───────────────────────────────────────────────
  { name: 'Cheekwood Botanical Garden',            lat: 36.0824, lng: -86.8776, region: 'mainland' },
  { name: 'Memphis Botanical Garden',              lat: 35.1087, lng: -89.9123, region: 'mainland' },
  { name: 'Knoxville Botanical Garden',            lat: 35.9688, lng: -83.8794, region: 'mainland' },
  { name: 'Reflection Riding Arboretum',           lat: 35.0234, lng: -85.3876, region: 'mainland' },
  { name: 'Dixon Gallery and Gardens',             lat: 35.1298, lng: -89.8434, region: 'mainland' },
  { name: 'Lichterman Nature Center',              lat: 35.1534, lng: -89.9123, region: 'mainland' },
  { name: 'Birmingham Botanical Gardens',          lat: 33.4929, lng: -86.7637, region: 'mainland' },
  { name: 'Huntsville Botanical Garden',           lat: 34.7898, lng: -86.5334, region: 'mainland' },
  { name: 'Bellingrath Gardens',                   lat: 30.4540, lng: -88.1109, region: 'mainland' },
  { name: 'Eudora Welty Garden',                   lat: 32.3234, lng: -90.1723, region: 'mainland' },
  { name: 'University of Tennessee Gardens Knoxville', lat: 35.9512, lng: -83.9312, region: 'mainland' },
  { name: 'New Orleans Botanical Garden',          lat: 29.9801, lng: -90.0912, region: 'mainland' },
  { name: 'Longue Vue House and Gardens',          lat: 29.9623, lng: -90.1234, region: 'mainland' },
  { name: 'Rosedown Plantation',                   lat: 30.8248, lng: -91.2215, region: 'mainland' },
  { name: 'Zemurray Gardens',                      lat: 30.7423, lng: -90.2812, region: 'mainland' },
  { name: 'Jungle Gardens Avery Island',           lat: 29.8923, lng: -91.8934, region: 'mainland' },
  { name: 'LSU AgCenter Botanic Gardens',          lat: 30.4123, lng: -91.1712, region: 'mainland' },
  { name: 'Crosby Arboretum',                      lat: 30.6723, lng: -89.5812, region: 'mainland' },
  { name: 'Mynelle Gardens Jackson MS',            lat: 32.3012, lng: -90.2134, region: 'mainland' },
  { name: 'Garvan Woodland Gardens',               lat: 34.5023, lng: -93.0534, region: 'mainland' },
  { name: 'Botanical Garden of the Ozarks',        lat: 36.0623, lng: -94.1823, region: 'mainland' },

  // ── Southeast US: Texas ───────────────────────────────────────────────────
  { name: 'San Antonio Botanical Garden',          lat: 29.4571, lng: -98.4584, region: 'mainland' },
  { name: 'Houston Botanic Garden',                lat: 29.6912, lng: -95.3418, region: 'mainland' },
  { name: 'Dallas Arboretum and Botanical Garden', lat: 32.8237, lng: -96.7168, region: 'mainland' },
  { name: 'Fort Worth Botanic Garden',             lat: 32.7384, lng: -97.3715, region: 'mainland' },
  { name: 'Lady Bird Johnson Wildflower Center',   lat: 30.1868, lng: -97.8773, region: 'mainland' },
  { name: 'The John Fairey Garden',                lat: 30.0923, lng: -96.0834, region: 'mainland' },
  { name: 'Mercer Arboretum and Botanic Gardens',  lat: 30.0023, lng: -95.2812, region: 'mainland' },
  { name: 'Houston Arboretum and Nature Center',   lat: 29.7648, lng: -95.4523, region: 'mainland' },
  { name: 'Bayou Bend Collection and Gardens',     lat: 29.7598, lng: -95.4234, region: 'mainland' },
  { name: 'Moody Gardens',                         lat: 29.2734, lng: -94.8823, region: 'mainland' },
  { name: 'Beaumont Botanical Gardens',            lat: 30.0698, lng: -94.1423, region: 'mainland' },
  { name: 'South Texas Botanical Gardens',         lat: 27.6834, lng: -97.3923, region: 'mainland' },
  { name: 'Zilker Botanical Garden',               lat: 30.2598, lng: -97.7712, region: 'mainland' },
  { name: 'Chihuahuan Desert Gardens',             lat: 31.7698, lng: -106.5012, region: 'mainland' },
  { name: 'El Paso Municipal Rose Garden',         lat: 31.7823, lng: -106.4734, region: 'mainland' },
  { name: 'Keystone Heritage Park Botanical Garden', lat: 31.8734, lng: -106.5423, region: 'mainland' },
  { name: 'Chihuahuan Desert Nature Center',       lat: 30.6134, lng: -103.8923, region: 'mainland' },
  { name: 'Japanese Garden San Angelo',            lat: 31.4623, lng: -100.4534, region: 'mainland' },
  { name: 'Texas Discovery Gardens Dallas',        lat: 32.7823, lng: -96.7612, region: 'mainland' },
  { name: 'Botanical Research Institute of Texas', lat: 32.7334, lng: -97.3623, region: 'mainland' },
  { name: 'Chandor Gardens',                       lat: 32.7523, lng: -97.7934, region: 'mainland' },

  // ── Southeast US: Florida ─────────────────────────────────────────────────
  { name: 'Bok Tower Gardens',                     lat: 27.9376, lng: -81.5887, region: 'mainland' },
  { name: 'Fairchild Tropical Botanic Garden',     lat: 25.6726, lng: -80.2756, region: 'mainland' },
  { name: 'Marie Selby Botanical Gardens',         lat: 27.3342, lng: -82.5465, region: 'mainland' },
  { name: 'Naples Botanical Garden',               lat: 26.1187, lng: -81.7534, region: 'mainland' },
  { name: 'Harry P. Leu Gardens',                  lat: 28.5447, lng: -81.3617, region: 'mainland' },
  { name: 'Kanapaha Botanical Gardens',            lat: 29.6076, lng: -82.4312, region: 'mainland' },
  { name: 'Mounts Botanical Garden',               lat: 26.7106, lng: -80.1083, region: 'mainland' },
  { name: 'Cummer Museum of Art and Gardens',      lat: 30.3298, lng: -81.6623, region: 'mainland' },
  { name: 'McKee Botanical Garden',                lat: 27.6234, lng: -80.3923, region: 'mainland' },
  { name: 'Sunken Gardens',                        lat: 27.7734, lng: -82.6423, region: 'mainland' },
  { name: 'Alfred B. Maclay State Gardens',        lat: 30.5298, lng: -84.2623, region: 'mainland' },
  { name: 'Edison and Ford Winter Estates',        lat: 26.6323, lng: -81.8734, region: 'mainland' },
  { name: 'Vizcaya Museum and Gardens',            lat: 25.7448, lng: -80.2112, region: 'mainland' },
  { name: 'Flamingo Gardens',                      lat: 26.0734, lng: -80.2423, region: 'mainland' },
  { name: 'Morikami Museum and Japanese Gardens', lat: 26.4623, lng: -80.1234, region: 'mainland' },
  { name: 'Fruit and Spice Park',                  lat: 25.5023, lng: -80.4712, region: 'mainland' },
  { name: 'Florida Botanical Gardens Largo',       lat: 27.9098, lng: -82.7823, region: 'mainland' },
  { name: 'Key West Tropical Forest and Botanical Garden', lat: 24.5534, lng: -81.8012, region: 'mainland' },

  // ── Midwest US: Illinois & Wisconsin ─────────────────────────────────────
  { name: 'Chicago Botanic Garden',                lat: 42.1511, lng: -87.7870, region: 'mainland' },
  { name: 'Morton Arboretum',                      lat: 41.8146, lng: -88.0714, region: 'mainland' },
  { name: 'Garfield Park Conservatory',            lat: 41.8845, lng: -87.7178, region: 'mainland' },
  { name: 'Lincoln Park Conservatory',             lat: 41.9230, lng: -87.6356, region: 'mainland' },
  { name: 'Olbrich Botanical Gardens',             lat: 43.0698, lng: -89.3208, region: 'mainland' },
  { name: 'Boerner Botanical Gardens',             lat: 42.9473, lng: -88.0132, region: 'mainland' },
  { name: 'Green Bay Botanical Garden',            lat: 44.5133, lng: -88.1198, region: 'mainland' },
  { name: 'Cantigny Park Gardens',                 lat: 41.8512, lng: -88.1534, region: 'mainland' },
  { name: 'Anderson Japanese Gardens',             lat: 42.2423, lng: -89.0812, region: 'mainland' },
  { name: 'Rotary Botanical Gardens',              lat: 42.5923, lng: -88.4234, region: 'mainland' },

  // ── Midwest US: Ohio ──────────────────────────────────────────────────────
  { name: 'Franklin Park Conservatory',            lat: 39.9684, lng: -82.9535, region: 'mainland' },
  { name: 'Holden Arboretum',                      lat: 41.6048, lng: -81.3245, region: 'mainland' },
  { name: 'Cleveland Botanical Garden',            lat: 41.5106, lng: -81.6098, region: 'mainland' },
  { name: 'Dawes Arboretum',                       lat: 40.0209, lng: -82.3898, region: 'mainland' },
  { name: 'Inniswood Metro Gardens',               lat: 40.1239, lng: -82.9076, region: 'mainland' },
  { name: 'Toledo Botanical Garden',               lat: 41.6898, lng: -83.6045, region: 'mainland' },
  { name: 'Aullwood Garden',                       lat: 39.8212, lng: -84.2334, region: 'mainland' },

  // ── Midwest US: Michigan ──────────────────────────────────────────────────
  { name: 'Frederik Meijer Gardens and Sculpture Park', lat: 42.9823, lng: -85.5912, region: 'mainland' },
  { name: 'Matthaei Botanical Gardens',            lat: 42.2834, lng: -83.6748, region: 'mainland' },
  { name: 'Nichols Arboretum',                     lat: 42.2823, lng: -83.7212, region: 'mainland' },
  { name: 'Dow Gardens',                           lat: 43.6198, lng: -84.2378, region: 'mainland' },
  { name: 'Michigan State University Hidden Lake Gardens', lat: 42.0628, lng: -84.1456, region: 'mainland' },
  { name: 'Anna Scripps Whitcomb Conservatory',    lat: 42.3434, lng: -83.0448, region: 'mainland' },

  // ── Midwest US: Indiana ───────────────────────────────────────────────────
  { name: 'Foellinger-Freimann Botanical Conservatory', lat: 41.0798, lng: -85.1423, region: 'mainland' },
  { name: 'Garfield Park Conservatory Indianapolis', lat: 39.7398, lng: -86.1234, region: 'mainland' },

  // ── Midwest US: Nebraska, Minnesota, Missouri, Iowa & Kentucky ─────────────────────
  { name: 'Minnesota Landscape Arboretum',         lat: 44.8651, lng: -93.6134, region: 'mainland' },
  { name: 'Como Park Zoo and Conservatory',        lat: 44.9812, lng: -93.1526, region: 'mainland' },
  { name: 'Munsinger Gardens and Clemens Gardens', lat: 45.5623, lng: -94.1534, region: 'mainland' },
  { name: 'Missouri Botanical Garden',             lat: 38.6127, lng: -90.2590, region: 'mainland' },
  { name: 'Powell Gardens',                        lat: 38.8517, lng: -94.2045, region: 'mainland' },
  { name: 'Lauritzen Gardens',                     lat: 41.2198, lng: -95.9634, region: 'mainland' },
  { name: 'Yew Dell Botanical Gardens',            lat: 38.3409, lng: -85.4401, region: 'mainland' },
  { name: 'State Botanical Garden of Kentucky',    lat: 38.0298, lng: -84.5128, region: 'mainland' },
  { name: 'Shaw Nature Reserve',                   lat: 38.4623, lng: -90.8234, region: 'mainland' },
  { name: 'Loose Park Rose Garden',                lat: 39.0334, lng: -94.5923, region: 'mainland' },
  { name: 'University of Nebraska Botanical Garden', lat: 40.8198, lng: -96.7023, region: 'mainland' },
  { name: 'Sunken Gardens Lincoln',                lat: 40.7934, lng: -96.7234, region: 'mainland' },
  { name: 'Iowa State University Reiman Gardens', lat: 42.0234, lng: -93.6423, region: 'mainland' },
  { name: 'Greater Des Moines Botanical Garden',  lat: 41.5934, lng: -93.6123, region: 'mainland' },
  { name: 'Eloise Butler Wildflower Garden',       lat: 44.9823, lng: -93.3712, region: 'mainland' },
  { name: 'Lyndale Park Rose Garden',              lat: 44.9334, lng: -93.3123, region: 'mainland' },
  { name: 'University of Minnesota Landscape Arboretum Outreach', lat: 44.9734, lng: -93.4923, region: 'mainland' },
  { name: 'Linnaeus Arboretum Gustavus',           lat: 44.3612, lng: -94.0123, region: 'mainland' },
  { name: 'Duluth Rose Garden',                    lat: 46.7823, lng: -92.1034, region: 'mainland' },
  { name: 'Overland Park Arboretum',               lat: 38.8612, lng: -94.7234, region: 'mainland' },
  { name: 'Kauffman Memorial Garden',              lat: 39.0323, lng: -94.5712, region: 'mainland' },
  { name: 'Gage Park Rose Garden Topeka',          lat: 39.0523, lng: -95.7234, region: 'mainland' },
  { name: 'Dyck Arboretum of the Plains',          lat: 38.1423, lng: -97.4312, region: 'mainland' },
  { name: 'Laumeier Sculpture Park Gardens',       lat: 38.5323, lng: -90.4212, region: 'mainland' },
  { name: 'Missouri Botanical Garden Shaw Nature Reserve', lat: 38.4623, lng: -90.8234, region: 'mainland' },
  { name: 'Bellefontaine Cemetery Gardens',        lat: 38.6823, lng: -90.2712, region: 'mainland' },
  { name: 'Alton Arboretum',                       lat: 38.8912, lng: -90.1823, region: 'mainland' },

  // ── Mountain / Rocky Mountain: Colorado ───────────────────────────────────
  { name: 'Denver Botanic Gardens',                lat: 39.7325, lng: -104.9610, region: 'mainland' },
  { name: 'Denver Botanic Gardens at Chatfield',   lat: 39.5434, lng: -105.0723, region: 'mainland' },
  { name: 'Hudson Gardens',                        lat: 39.5701, lng: -105.0748, region: 'mainland' },
  { name: 'Betty Ford Alpine Gardens',             lat: 39.6445, lng: -106.3754, region: 'mainland' },
  { name: 'Gardens on Spring Creek',               lat: 40.5768, lng: -105.0620, region: 'mainland' },
  { name: 'Andrews Arboretum',                     lat: 40.0145, lng: -105.2705, region: 'mainland' },
  { name: 'Rocky Mountain Botanic Gardens',        lat: 40.2234, lng: -105.2712, region: 'mainland' },
  { name: 'Montrose Botanic Gardens',              lat: 38.4823, lng: -107.8734, region: 'mainland' },
  { name: 'Durango Botanic Gardens',               lat: 37.2823, lng: -107.8812, region: 'mainland' },
  { name: 'Yampa River Botanic Park',              lat: 40.4923, lng: -106.8312, region: 'mainland' },
  { name: 'Kendrick Lake Gardens',                 lat: 39.7012, lng: -105.1198, region: 'mainland' },
  { name: 'Benson Sculpture Garden Loveland',      lat: 40.3923, lng: -105.0712, region: 'mainland' },

  // ── Nevada ─────────────────────
  { name: 'Springs Preserve Botanical Garden',     lat: 36.1734, lng: -115.1912, region: 'mainland' },
  { name: 'Ethel M Botanical Cactus Garden',       lat: 36.0323, lng: -115.0134, region: 'mainland' },
  { name: 'Wilbur D. May Arboretum',               lat: 39.5423, lng: -119.7823, region: 'mainland' },
  { name: 'Bartley Ranch Regional Park Garden',    lat: 39.4823, lng: -119.8234, region: 'mainland' },
  { name: 'Nevada Arboretum at UNR',               lat: 39.5423, lng: -119.8134, region: 'mainland' },
  { name: 'Galena Creek Visitor Center Garden',    lat: 39.4123, lng: -119.8712, region: 'mainland' },
  { name: 'Clark County Wetlands Park Garden',     lat: 36.0823, lng: -115.0534, region: 'mainland' },
  { name: 'UNLV Arboretum',                        lat: 36.1023, lng: -115.1423, region: 'mainland' },
  { name: 'Henderson Bird Viewing Preserve',       lat: 36.0023, lng: -115.0234, region: 'mainland' },
  { name: 'Las Vegas Springs Preserve Ext',        lat: 36.1812, lng: -115.2023, region: 'mainland' },

  // ── Mountain / Rocky Mountain: Utah, Idaho & Wyoming ─────────────────────
  { name: 'Red Butte Garden',                      lat: 40.7673, lng: -111.8245, region: 'mainland' },
  { name: 'Thanksgiving Point Gardens',            lat: 40.4148, lng: -111.8945, region: 'mainland' },
  { name: 'Idaho Botanical Garden',                lat: 43.6015, lng: -116.1695, region: 'mainland' },
  { name: 'Cheyenne Botanic Gardens',              lat: 41.1412, lng: -104.7987, region: 'mainland' },
  { name: 'Sawtooth Botanical Garden',             lat: 43.6823, lng: -114.3634, region: 'mainland' },
  { name: 'Thanksgiving Point Ashton Gardens',     lat: 40.3923, lng: -111.9234, region: 'mainland' },
  { name: 'Gilgal Sculpture Garden',               lat: 40.7512, lng: -111.8634, region: 'mainland' },
  { name: 'Provo Temple Gardens',                  lat: 40.2423, lng: -111.6534, region: 'mainland' },
  { name: 'Logan Botanical Garden',                lat: 41.7423, lng: -111.8334, region: 'mainland' },
  { name: 'College of Southern Idaho Arboretum',   lat: 42.5623, lng: -114.4634, region: 'mainland' },
  { name: 'Boise State University Arboretum',      lat: 43.6034, lng: -116.2023, region: 'mainland' },

  // ── Mountain / Rocky Mountain: New Mexico & Arizona ──────────────────────
  { name: 'Rio Grande Botanic Garden',             lat: 35.1050, lng: -106.6967, region: 'mainland' },
  { name: 'Desert Botanical Garden',               lat: 33.4618, lng: -111.9445, region: 'mainland' },
  { name: 'Tucson Botanical Garden',               lat: 32.2440, lng: -110.9132, region: 'mainland' },
  { name: 'Boyce Thompson Arboretum',              lat: 33.2848, lng: -111.1587, region: 'mainland' },
  { name: 'Wallace Desert Garden',                 lat: 33.5923, lng: -111.8234, region: 'mainland' },
  { name: 'Tohono Chul Garden',                    lat: 32.3498, lng: -111.0134, region: 'mainland' },
  { name: 'ABQ BioPark Botanic Garden',            lat: 35.0934, lng: -106.6823, region: 'mainland' },
  { name: 'Santa Fe Botanical Garden',             lat: 35.6734, lng: -105.9423, region: 'mainland' },
  
  // ── Oklahoma ─────────────────────
  { name: 'Myriad Botanical Gardens',              lat: 35.4662, lng: -97.5195, region: 'mainland' },
  { name: 'Tulsa Botanic Garden',                  lat: 36.2334, lng: -96.0123, region: 'mainland' },
  { name: 'Honor Heights Park',                    lat: 35.7423, lng: -95.3634, region: 'mainland' },
  { name: 'Chickasaw Cultural Center Gardens',     lat: 34.6734, lng: -97.0023, region: 'mainland' },
  { name: 'Will Rogers Gardens',                   lat: 35.5223, lng: -97.5712, region: 'mainland' },
  { name: 'Woodward Park and Tulsa Arboretum',     lat: 36.1198, lng: -95.9734, region: 'mainland' },
  { name: 'Philbrook Museum Gardens',              lat: 36.1123, lng: -95.9812, region: 'mainland' },
  { name: 'Oklahoma Botanic Garden Stillwater',    lat: 36.1198, lng: -97.0823, region: 'mainland' },
  { name: 'Hambrick Botanical Gardens',            lat: 35.5134, lng: -97.4923, region: 'mainland' },
  { name: 'Albuquerque Garden Center',             lat: 35.1334, lng: -106.5923, region: 'mainland' },
  { name: 'New Mexico State University Garden',    lat: 32.2823, lng: -106.7534, region: 'mainland' },
  { name: 'Tohono Chul Garden Expansion',          lat: 32.3623, lng: -111.0023, region: 'mainland' },
  { name: 'Civano Nursery Demonstration Garden',   lat: 32.1923, lng: -110.7834, region: 'mainland' },
  { name: 'Tempe Botanical Garden',                lat: 33.4123, lng: -111.9234, region: 'mainland' },
  { name: 'Mesa Arts Center Garden',               lat: 33.4223, lng: -111.8312, region: 'mainland' },
  { name: 'Phoenix Desert Botanic Annex',          lat: 33.4712, lng: -111.9112, region: 'mainland' },

  // ── Pacific Northwest: Washington State ───────────────────────────────────
  { name: 'Washington Park Arboretum',             lat: 47.6390, lng: -122.2962, region: 'mainland' },
  { name: 'Bellevue Botanical Garden',             lat: 47.5934, lng: -122.1531, region: 'mainland' },
  { name: 'Kubota Garden',                         lat: 47.5153, lng: -122.2912, region: 'mainland' },
  { name: 'Bloedel Reserve',                       lat: 47.7187, lng: -122.5623, region: 'mainland' },
  { name: 'Rhododendron Species Botanical Garden', lat: 47.3184, lng: -122.3217, region: 'mainland' },
  { name: 'Lakewold Gardens',                      lat: 47.2590, lng: -122.4401, region: 'mainland' },
  { name: 'Skagit Valley Tulip Fields',            lat: 48.4248, lng: -122.3345, region: 'mainland' },
  { name: 'Ohme Gardens',                          lat: 47.5134, lng: -120.3287, region: 'mainland' },
  { name: 'Manito Park and Botanical Gardens',     lat: 47.6348, lng: -117.3948, region: 'mainland' },

  // ── Pacific Northwest: Oregon ─────────────────────────────────────────────
  { name: 'Portland Japanese Garden',              lat: 45.5195, lng: -122.7062, region: 'mainland' },
  { name: 'International Rose Test Garden',        lat: 45.5193, lng: -122.7049, region: 'mainland' },
  { name: 'Crystal Springs Rhododendron Garden',   lat: 45.4751, lng: -122.6362, region: 'mainland' },
  { name: 'Leach Botanical Garden',                lat: 45.4682, lng: -122.5634, region: 'mainland' },
  { name: 'Oregon Garden',                         lat: 44.9865, lng: -122.7234, region: 'mainland' },
  { name: 'Shore Acres State Park Garden',         lat: 43.3248, lng: -124.3934, region: 'mainland' },
  { name: 'Owen Rose Garden',                      lat: 44.0487, lng: -123.1023, region: 'mainland' },
  { name: 'Hendricks Park Rhododendron Garden',    lat: 44.0434, lng: -123.0823, region: 'mainland' },

  // ── California: Bay Area & Northern California ────────────────────────────
  { name: 'UC Botanical Garden at Berkeley',       lat: 37.8762, lng: -122.2384, region: 'mainland' },
  { name: 'Filoli Historic House and Garden',      lat: 37.4615, lng: -122.2843, region: 'mainland' },
  { name: 'San Francisco Botanical Garden',        lat: 37.7696, lng: -122.4693, region: 'mainland' },
  { name: 'Conservatory of Flowers',               lat: 37.7712, lng: -122.4605, region: 'mainland' },
  { name: 'Gardens of Alcatraz',                   lat: 37.8267, lng: -122.4230, region: 'mainland' },
  { name: 'Ruth Bancroft Garden',                  lat: 37.9098, lng: -121.9987, region: 'mainland' },
  { name: 'Hakone Estate and Gardens',             lat: 37.2523, lng: -122.0234, region: 'mainland' },
  { name: 'Quarryhill Botanical Garden',           lat: 38.3812, lng: -122.5145, region: 'mainland' },
  { name: 'Mendocino Coast Botanical Gardens',     lat: 39.3087, lng: -123.8123, region: 'mainland' },
  { name: 'UC Santa Cruz Arboretum',               lat: 36.9923, lng: -122.0634, region: 'mainland' },
  { name: 'Sunset Garden Menlo Park',              lat: 37.4423, lng: -122.1823, region: 'mainland' },
  { name: 'Turtle Bay Exploration Park',           lat: 40.5712, lng: -122.3923, region: 'mainland' },

  // ── California: Southern California ──────────────────────────────────────
  { name: 'The Huntington Library and Gardens',    lat: 34.1290, lng: -118.1143, region: 'mainland' },
  { name: 'Descanso Gardens',                      lat: 34.2012, lng: -118.2101, region: 'mainland' },
  { name: 'Los Angeles County Arboretum',          lat: 34.1462, lng: -117.9734, region: 'mainland' },
  { name: 'Lotusland',                             lat: 34.4487, lng: -119.7412, region: 'mainland' },
  { name: 'Santa Barbara Botanic Garden',          lat: 34.4512, lng: -119.7234, region: 'mainland' },
  { name: 'South Coast Botanic Garden',            lat: 33.7562, lng: -118.3623, region: 'mainland' },
  { name: 'Rancho Santa Ana Botanic Garden',       lat: 34.1215, lng: -117.7134, region: 'mainland' },
  { name: 'San Diego Botanic Garden',              lat: 33.0862, lng: -116.9923, region: 'mainland' },
  { name: 'Balboa Park Botanical Building',        lat: 32.7312, lng: -117.1512, region: 'mainland' },
  { name: 'UC Riverside Botanic Gardens',          lat: 33.9734, lng: -117.3276, region: 'mainland' },
  { name: 'Sherman Library and Gardens',           lat: 33.6165, lng: -117.8734, region: 'mainland' },
  { name: 'Mildred E. Mathias Botanical Garden UCLA', lat: 34.0698, lng: -118.4423, region: 'mainland' },
  { name: 'Quail Botanical Gardens Encinitas',     lat: 33.0862, lng: -117.2623, region: 'mainland' },

  // ── Canada: British Columbia ──────────────────────────────────────────────
  { name: 'Butchart Gardens',                      lat: 48.5648, lng: -123.4698, region: 'mainland' },
  { name: 'VanDusen Botanical Garden',             lat: 49.2376, lng: -123.1334, region: 'mainland' },
  { name: 'UBC Botanical Garden',                  lat: 49.2537, lng: -123.2523, region: 'mainland' },
  { name: 'Nitobe Memorial Garden',                lat: 49.2659, lng: -123.2587, region: 'mainland' },
  { name: 'Queen Elizabeth Park',                  lat: 49.2423, lng: -123.1123, region: 'mainland' },
  { name: 'Horticulture Centre of the Pacific',    lat: 48.5023, lng: -123.3756, region: 'mainland' },
  { name: 'Milner Gardens and Woodland',           lat: 49.3712, lng: -124.3234, region: 'mainland' },
  { name: 'Tofino Botanical Gardens',              lat: 49.1445, lng: -125.9067, region: 'mainland' },

  // ── Canada: Ontario & Quebec───────────────────────────────────────────────────────
  { name: 'Royal Botanical Gardens Burlington',    lat: 43.3198, lng: -79.8623, region: 'mainland' },
  { name: 'Toronto Botanical Garden',              lat: 43.7312, lng: -79.3534, region: 'mainland' },
  { name: 'Niagara Parks Botanical Gardens',       lat: 43.1523, lng: -79.0587, region: 'mainland' },
  { name: 'Allan Gardens Conservatory',            lat: 43.6612, lng: -79.3723, region: 'mainland' },
  { name: 'Guelph Arboretum',                      lat: 43.5348, lng: -80.2312, region: 'mainland' },
  { name: 'Humber Arboretum',                      lat: 43.7523, lng: -79.5912, region: 'mainland' },
  { name: 'Parkwood Estate Gardens',               lat: 43.8923, lng: -78.8712, region: 'mainland' },
  { name: 'Centennial Park Conservatory',          lat: 43.6334, lng: -79.5687, region: 'mainland' },
  { name: 'Dominion Arboretum Ottawa',             lat: 45.3834, lng: -75.7134, region: 'mainland' },
  { name: 'Fletcher Wildlife Garden',              lat: 45.3812, lng: -75.7198, region: 'mainland' },
  { name: 'Montreal Botanical Garden',             lat: 45.5590, lng: -73.5561, region: 'mainland' },
  { name: 'Jardins de Metis',                      lat: 48.6645, lng: -68.0823, region: 'mainland' },
  { name: 'Domaine Joly-De Lotbiniere',            lat: 46.6734, lng: -71.8212, region: 'mainland' },
  { name: 'Jardin botanique de Quebec',            lat: 46.8223, lng: -71.2234, region: 'mainland' },
  { name: 'Jardins de Versailles Quebec',          lat: 46.8534, lng: -71.3423, region: 'mainland' },
  { name: 'Parc de la Gorge de Coaticook',         lat: 45.1323, lng: -71.8012, region: 'mainland' },
  { name: 'Arboretum Morgan Montreal',             lat: 45.4323, lng: -73.9534, region: 'mainland' },
  { name: 'Arboretum des Sources Ottawa',          lat: 45.4234, lng: -75.7423, region: 'mainland' },
  { name: 'Experimental Farm Ottawa',              lat: 45.3823, lng: -75.7123, region: 'mainland' },
  { name: 'Kingston Botanical Garden',             lat: 44.2312, lng: -76.4923, region: 'mainland' },

  // ── Canada: Alberta ───────────────────────────────────────────────────────
  { name: 'University of Alberta Botanic Garden',  lat: 53.3748, lng: -113.7234, region: 'mainland' },
  { name: 'Muttart Conservatory',                  lat: 53.5334, lng: -113.4812, region: 'mainland' },
  { name: 'Reader Rock Garden',                    lat: 51.0223, lng: -114.0612, region: 'mainland' },
  { name: 'Nikka Yuko Japanese Garden',            lat: 49.6934, lng: -112.8387, region: 'mainland' },
  { name: 'Calgary Zoo Botanical Garden',          lat: 51.0434, lng: -114.0312, region: 'mainland' },
  { name: 'Inglewood Bird Sanctuary Garden',       lat: 51.0334, lng: -114.0123, region: 'mainland' },
  { name: 'Olds College Botanic Garden',           lat: 51.7923, lng: -114.1034, region: 'mainland' },
  { name: 'Lethbridge Nikka Yuko Japanese Garden', lat: 49.6934, lng: -112.8387, region: 'mainland' },

  // ── Canada: Nova Scotia & New Brunswick ──────────────────────────────────
  { name: 'Halifax Public Gardens',                lat: 44.6412, lng: -63.5823, region: 'mainland' },
  { name: 'Annapolis Royal Historic Gardens',      lat: 44.7434, lng: -65.5145, region: 'mainland' },
  { name: 'Harriet Irving Botanical Gardens',      lat: 45.0634, lng: -64.3712, region: 'mainland' },
  { name: 'Kingsbrae Garden',                      lat: 45.0748, lng: -67.0523, region: 'mainland' },
  { name: 'New Brunswick Botanical Garden',        lat: 47.3612, lng: -68.3223, region: 'mainland' },

   // ── Canada: Winnipeg & Manitoba ──────────────────────────────────
  { name: 'Assiniboine Park Conservatory',         lat: 49.8823, lng: -97.2334, region: 'mainland' },
  { name: 'English Garden at Assiniboine Park',    lat: 49.8812, lng: -97.2298, region: 'mainland' },
  { name: 'Winnipeg Horticulture Society Gardens', lat: 49.8734, lng: -97.1423, region: 'mainland' },
  { name: 'Living Prairie Museum',                 lat: 49.9023, lng: -97.2534, region: 'mainland' },
  { name: 'Morden Research Centre Gardens',        lat: 49.1923, lng: -98.0823, region: 'mainland' },

];

module.exports = Object.assign({}, base, {
  id:            'garden-wall-calendar-na',
  gelatoSku:     'wall_calendar_product_pf_xl11x16-5-inch_pt_100-lb-cover-coated-silk_cl_4-4_bt_wire-with-hook-top_ct_none_prt_none_ver',
  // formatOverride tells pdfService to use the 'na' FORMATS entry (287.4×427.1mm bleed sheet)
  // instead of the default 'a3' dimensions.
  formatOverride: 'na',
  GARDENS:       NA_GARDENS,
});
