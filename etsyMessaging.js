// etsyMessaging.js (CommonJS)
// Shared Etsy API helpers used by both etsyCron.js and queueService.js.
// Handles access token refresh (with disk-based rotation) and buyer messaging.
//
// Consumers:
//   etsyCron.js     — polls for orders, sends form-link messages
//   queueService.js — sends PDF preview messages after generation

var https = require('https');

var ETSY_API_KEY       = process.env.ETSY_API_KEY       || '';
var ETSY_SHARED_SECRET = process.env.ETSY_SHARED_SECRET || '';
var ETSY_SHOP_ID       = process.env.ETSY_SHOP_ID       || '';
var ETSY_TOKEN_URL     = 'https://api.etsy.com/v3/public/oauth/token';

// ── Token state (module-level — shared across both consumers) ─────────────────
var _accessToken       = null;
var _accessTokenExpiry = 0; // unix ms

// ── Get (or refresh) access token ────────────────────────────────────────────
async function getAccessToken() {
  if (_accessToken && Date.now() < _accessTokenExpiry - 60000) {
    return _accessToken; // still valid with 1-min buffer
  }

  var refreshToken = process.env.ETSY_REFRESH_TOKEN || '';

  // Prefer token persisted to disk (rotated at runtime) over env var
  try {
    var diskPath  = process.env.RENDER_DISK_PATH || '/data';
    var diskToken = require('fs').readFileSync(
      require('path').join(diskPath, 'etsy-refresh-token.txt'),
      'utf8'
    ).trim();
    if (diskToken) refreshToken = diskToken;
  } catch(e) {
    // File doesn't exist yet — use env var
  }

  if (!refreshToken) {
    throw new Error('ETSY_REFRESH_TOKEN not set — run OAuth flow to generate one');
  }

  var body = [
    'grant_type=refresh_token',
    'client_id=' + encodeURIComponent(ETSY_API_KEY),
    'refresh_token=' + encodeURIComponent(refreshToken),
  ].join('&');

  var data = await httpsPost(ETSY_TOKEN_URL, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  if (!data.access_token) {
    throw new Error('Token refresh failed: ' + JSON.stringify(data).slice(0, 200));
  }

  _accessToken       = data.access_token;
  _accessTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;

  // Etsy rotates refresh tokens — persist the new one to disk immediately
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    try {
      var diskPath = process.env.RENDER_DISK_PATH || '/data';
      require('fs').writeFileSync(
        require('path').join(diskPath, 'etsy-refresh-token.txt'),
        data.refresh_token,
        'utf8'
      );
      console.log('[etsy] Refresh token rotated and saved to disk');
    } catch(e) {
      console.error('[etsy] Failed to save rotated refresh token:', e.message);
    }
  }

  console.log('[etsy] Access token refreshed, expires in', Math.round((data.expires_in || 3600) / 60), 'min');
  return _accessToken;
}

// ── Send Etsy message to buyer ────────────────────────────────────────────────
async function sendEtsyMessage(receiptId, buyerUserId, message) {
  var token = await getAccessToken();
  var url   = 'https://openapi.etsy.com/v3/application/shops/' + ETSY_SHOP_ID
    + '/messages/buyer';

  var payload = JSON.stringify({
    user_id: buyerUserId,
    message: message,
    subject: 'Your Garden Calendar — personalise your order',
  });

  var data = await httpsPost(url, payload, {
    'x-api-key':     ETSY_API_KEY + ':' + ETSY_SHARED_SECRET,
    'Authorization': 'Bearer ' + token,
    'Content-Type':  'application/json',
  });

  if (data.message_id || data.id) {
    console.log('[etsy] Message sent to buyer', buyerUserId, 'for receipt', receiptId);
    return true;
  } else {
    throw new Error('Message send failed: ' + JSON.stringify(data).slice(0, 200));
  }
}

// ── HTTPS GET ─────────────────────────────────────────────────────────────────
function httpsGet(url, headers) {
  return new Promise(function(resolve, reject) {
    var parsed = require('url').parse(url);
    var opts = {
      hostname: parsed.hostname,
      path:     parsed.path,
      method:   'GET',
      headers:  Object.assign({ 'User-Agent': 'GardenCalendar/1.0' }, headers),
    };
    var req = https.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, function() { req.destroy(new Error('Etsy GET timeout')); });
    req.end();
  });
}

// ── HTTPS POST ────────────────────────────────────────────────────────────────
function httpsPost(url, body, headers) {
  return new Promise(function(resolve, reject) {
    var parsed  = require('url').parse(url);
    var bodyBuf = Buffer.from(body);
    var opts = {
      hostname: parsed.hostname,
      path:     parsed.path,
      method:   'POST',
      headers:  Object.assign({
        'User-Agent':     'GardenCalendar/1.0',
        'Content-Length': bodyBuf.length,
      }, headers),
    };
    var req = https.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, function() { req.destroy(new Error('Etsy POST timeout')); });
    req.write(bodyBuf);
    req.end();
  });
}

module.exports = { getAccessToken, sendEtsyMessage, httpsGet, httpsPost };
