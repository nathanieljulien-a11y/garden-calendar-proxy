// downloadFonts.js — runs once at server startup, downloads Google Fonts to disk
// Chromium can then load them via @font-face with local file:// src
// This eliminates the per-render network fetch and associated RAM overhead

var https = require('https');
var fs    = require('fs');
var path  = require('path');

var FONT_DIR = path.join(__dirname, 'fonts');

// Exact woff2 URLs from Google Fonts CSS2 API (latin subset, the weights we use)
// These are stable CDN URLs — Google does not change them for existing font versions
var FONTS = [
  // Playfair Display
  { file: 'playfair-400.woff2',     url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.woff2' },
  { file: 'playfair-600.woff2',     url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXBzHwcbmjWBN2PKdFvUDQ.woff2' },
  { file: 'playfair-400i.woff2',    url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFRD-vYSZviVYUb_rj3ij__anPXDTzYgEM86xRbPQ.woff2' },
  // Crimson Pro
  { file: 'crimsonpro-400.woff2',   url: 'https://fonts.gstatic.com/s/crimsonpro/v24/q5uUsoa5M_tv7IihmnkabAReu49Y_Bo.woff2' },
  { file: 'crimsonpro-500.woff2',   url: 'https://fonts.gstatic.com/s/crimsonpro/v24/q5uUsoa5M_tv7IihmnkabC5Seu49Y_Bo.woff2' },
  { file: 'crimsonpro-400i.woff2',  url: 'https://fonts.gstatic.com/s/crimsonpro/v24/q5uYsoa5M_tv7IihmnkabC5XiXCAlXGks1WZzm18.woff2' },
  // Pinyon Script
  { file: 'pinyonscript-400.woff2', url: 'https://fonts.gstatic.com/s/pinyonscript/v22/6xKpdSJbL9-e9LuoeQiDRQR8aOLQO4bhiDY.woff2' },
];

function downloadFont(font) {
  return new Promise(function(resolve) {
    var dest = path.join(FONT_DIR, font.file);
    if (fs.existsSync(dest)) {
      console.log('[fonts] Already exists: ' + font.file);
      resolve(true);
      return;
    }
    https.get(font.url, { headers: { 'User-Agent': 'GardenCalendar/1.0' } }, function(res) {
      if (res.statusCode !== 200) {
        console.warn('[fonts] Failed ' + font.file + ': HTTP ' + res.statusCode);
        res.resume();
        resolve(false);
        return;
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        fs.writeFileSync(dest, Buffer.concat(chunks));
        console.log('[fonts] Downloaded: ' + font.file + ' (' + Math.round(fs.statSync(dest).size/1024) + 'KB)');
        resolve(true);
      });
    }).on('error', function(e) {
      console.warn('[fonts] Error ' + font.file + ': ' + e.message);
      resolve(false);
    });
  });
}

async function downloadAllFonts() {
  if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR);
  var results = [];
  for (var i = 0; i < FONTS.length; i++) {
    results.push(await downloadFont(FONTS[i]));
  }
  var ok = results.filter(Boolean).length;
  console.log('[fonts] ' + ok + '/' + FONTS.length + ' fonts ready in ' + FONT_DIR);
  return ok === FONTS.length;
}

module.exports = { downloadAllFonts: downloadAllFonts, FONT_DIR: FONT_DIR };
