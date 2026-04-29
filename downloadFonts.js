// downloadFonts.js — runs once at server startup
// Fetches current woff2 URLs from Google Fonts CSS API, then downloads to disk.
// Chromium loads fonts from disk via file:// — no network fetch during PDF render.

var https = require('https');
var fs    = require('fs');
var path  = require('path');

var FONT_DIR = path.join(__dirname, 'fonts');

// Google Fonts CSS2 API requests — one per family
var FONT_REQUESTS = [
  {
    url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap',
    files: {
      'playfair-400.woff2':  { style: 'normal',  weight: '400', family: 'Playfair Display' },
      'playfair-600.woff2':  { style: 'normal',  weight: '600', family: 'Playfair Display' },
      'playfair-400i.woff2': { style: 'italic',  weight: '400', family: 'Playfair Display' },
    }
  },
  {
    url: 'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap',
    files: {
      'crimsonpro-400.woff2':  { style: 'normal', weight: '400', family: 'Crimson Pro' },
      'crimsonpro-500.woff2':  { style: 'normal', weight: '500', family: 'Crimson Pro' },
      'crimsonpro-400i.woff2': { style: 'italic', weight: '400', family: 'Crimson Pro' },
    }
  },
  {
    url: 'https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap',
    files: {
      'pinyonscript-400.woff2': { style: 'normal', weight: '400', family: 'Pinyon Script' },
    }
  },
];

function httpsGet(url, headers) {
  return new Promise(function(resolve, reject) {
    var opts = require('url').parse(url);
    opts.headers = headers || {};
    var req = https.get(opts, function(res) {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, function() { req.destroy(new Error('timeout')); });
  });
}

// Parse woff2 URLs out of Google Fonts CSS response
// Matches blocks like: font-style: italic; font-weight: 400; src: url(...woff2)
function parseWoff2Urls(css, targetFiles) {
  var result = {};
  // Split into @font-face blocks
  var blocks = css.split('@font-face');
  for (var i = 1; i < blocks.length; i++) {
    var block = blocks[i];
    // Extract style, weight, url
    var styleMatch  = block.match(/font-style:\s*(\w+)/);
    var weightMatch = block.match(/font-weight:\s*(\d+)/);
    var urlMatch    = block.match(/url\(([^)]+\.woff2)\)/);
    if (!styleMatch || !weightMatch || !urlMatch) continue;
    var style  = styleMatch[1];
    var weight = weightMatch[1];
    var woff2  = urlMatch[1].replace(/['"]/g, '');
    // Match to our target files
    for (var fname in targetFiles) {
      var t = targetFiles[fname];
      if (t.style === style && t.weight === weight) {
        result[fname] = woff2;
      }
    }
  }
  return result;
}

async function downloadAllFonts() {
  if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });

  var totalOk = 0, totalNeeded = 0;

  for (var ri = 0; ri < FONT_REQUESTS.length; ri++) {
    var req = FONT_REQUESTS[ri];
    totalNeeded += Object.keys(req.files).length;

    // Check if all files for this family already exist
    var allExist = Object.keys(req.files).every(function(f) {
      return fs.existsSync(path.join(FONT_DIR, f));
    });
    if (allExist) {
      console.log('[fonts] Already cached: ' + Object.keys(req.files).join(', '));
      totalOk += Object.keys(req.files).length;
      continue;
    }

    // Fetch CSS from Google Fonts API
    console.log('[fonts] Fetching CSS: ' + req.url);
    var cssRes;
    try {
      cssRes = await httpsGet(req.url, {
        // Must send a modern user-agent — Google returns woff2 only for modern browsers
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      });
    } catch(e) {
      console.warn('[fonts] CSS fetch failed: ' + e.message);
      continue;
    }
    if (cssRes.status !== 200) {
      console.warn('[fonts] CSS HTTP ' + cssRes.status + ' for ' + req.url);
      continue;
    }

    var css = cssRes.body.toString('utf8');
    var urlMap = parseWoff2Urls(css, req.files);
    console.log('[fonts] Parsed ' + Object.keys(urlMap).length + '/' + Object.keys(req.files).length + ' URLs');

    // Download each woff2 file
    for (var fname in req.files) {
      var dest = path.join(FONT_DIR, fname);
      if (fs.existsSync(dest)) {
        console.log('[fonts] Already exists: ' + fname);
        totalOk++;
        continue;
      }
      var woff2url = urlMap[fname];
      if (!woff2url) {
        console.warn('[fonts] No URL found for: ' + fname);
        continue;
      }
      try {
        var fontRes = await httpsGet(woff2url, { 'User-Agent': 'GardenCalendar/1.0' });
        if (fontRes.status !== 200) {
          console.warn('[fonts] Font HTTP ' + fontRes.status + ': ' + fname);
          continue;
        }
        fs.writeFileSync(dest, fontRes.body);
        console.log('[fonts] Downloaded: ' + fname + ' (' + Math.round(fontRes.body.length/1024) + 'KB)');
        totalOk++;
      } catch(e) {
        console.warn('[fonts] Download error ' + fname + ': ' + e.message);
      }
    }
  }

  var allReady = totalOk === totalNeeded;
  console.log('[fonts] ' + totalOk + '/' + totalNeeded + ' fonts ready in ' + FONT_DIR);
  return allReady;
}

module.exports = { downloadAllFonts: downloadAllFonts, FONT_DIR: FONT_DIR };
