// etsyCron.js (CommonJS)
// Polls Etsy Orders API every 5 minutes for new orders.
// For each new order, sends the customer a personalised message via Etsy
// Conversations API with a link to the order form.
//
// Environment variables required:
//   ETSY_API_KEY        — from developer.etsy.com (Keystring)
//   ETSY_REFRESH_TOKEN  — obtained via etsy-oauth-helper.js (one-time setup)
//   ETSY_SHOP_ID        — your Etsy shop ID (numeric, found in shop URL)
//   ORDER_FORM_URL      — base URL of the order form Vercel deployment
//
// State is persisted to orders.json (via orderStore) so restarts don't
// re-message customers or miss orders placed during downtime.

var https   = require('https');
var store   = require('./orderStore.js');

var ETSY_API_KEY       = process.env.ETSY_API_KEY       || '';
var ETSY_SHARED_SECRET = process.env.ETSY_SHARED_SECRET || '';
var ETSY_SHOP_ID       = process.env.ETSY_SHOP_ID       || '';
var ORDER_FORM_URL     = (process.env.ORDER_FORM_URL    || 'https://garden-calendar-order-form.vercel.app').replace(/\/$/, '');
var POLL_INTERVAL_MS   = 5 * 60 * 1000; // 5 minutes
var ETSY_TOKEN_URL     = 'https://api.etsy.com/v3/public/oauth/token';

// ── Token management ──────────────────────────────────────────────────────────
// Access tokens expire after 1 hour. We refresh automatically using the
// stored refresh token before each poll cycle.

var _accessToken       = null;
var _accessTokenExpiry = 0; // unix ms

async function _getAccessToken() {
  if (_accessToken && Date.now() < _accessTokenExpiry - 60000) {
    return _accessToken; // still valid with 1 min buffer
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

  var data = await _httpsPost(ETSY_TOKEN_URL, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  if (!data.access_token) {
    throw new Error('Token refresh failed: ' + JSON.stringify(data).slice(0, 200));
  }

  _accessToken       = data.access_token;
  _accessTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;

  // Etsy rotates refresh tokens — persist the new one to disk immediately
  // so the next refresh cycle reads it back without manual intervention
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

// ── Fetch recent Etsy orders ──────────────────────────────────────────────────
// Returns orders created after `sinceTimestamp` (unix seconds).
async function _fetchNewOrders(sinceTimestamp) {
  var token = await _getAccessToken();
  var limit = 25;
  var url = 'https://openapi.etsy.com/v3/application/shops/' + ETSY_SHOP_ID
    + '/receipts?limit=' + limit + '&sort_on=created&sort_order=desc';

  var data = await _httpsGet(url, {
    'x-api-key':     ETSY_API_KEY + ':' + ETSY_SHARED_SECRET,
    'Authorization': 'Bearer ' + token,
  });

  if (!data.results) {
    console.error('[etsy] Unexpected orders response:', JSON.stringify(data).slice(0, 200));
    return [];
  }

  // Filter to orders newer than sinceTimestamp
  return data.results.filter(function(r) {
    return r.create_timestamp > sinceTimestamp;
  });
}

// ── Send Etsy message to buyer ────────────────────────────────────────────────
async function _sendEtsyMessage(receiptId, buyerUserId, message) {
  var token = await _getAccessToken();
  var url   = 'https://openapi.etsy.com/v3/application/shops/' + ETSY_SHOP_ID
    + '/messages/buyer';

  var payload = JSON.stringify({
    user_id:    buyerUserId,
    message:    message,
    subject:    'Your Garden Calendar — personalise your order',
  });

  var data = await _httpsPost(url, payload, {
    'x-api-key':      ETSY_API_KEY + ':' + ETSY_SHARED_SECRET,
    'Authorization':  'Bearer ' + token,
    'Content-Type':   'application/json',
  });

  if (data.message_id || data.id) {
    console.log('[etsy] Message sent to buyer', buyerUserId, 'for receipt', receiptId);
    return true;
  } else {
    throw new Error('Message send failed: ' + JSON.stringify(data).slice(0, 200));
  }
}

// ── Build personalised message ────────────────────────────────────────────────
function _buildMessage(order, formUrl) {
  var firstName = (order.buyer_user_id ? '' : ''); // Etsy doesn't expose buyer name directly
  // Build form URL — pass the Etsy receipt ID so the backend can tie it to the order
  var link = formUrl + '?etsy_receipt_id=' + order.receipt_id;

  return [
    'Hi there! Thank you so much for your Garden Calendar order \u2014 we\u2019re excited to make something special for you.',
    '',
    'To personalise your calendar, please fill in this short form (it takes about 2 minutes):',
    link,
    '',
    'Once submitted we\u2019ll send you a PDF preview to approve before anything goes to print.',
    '',
    'If you have any questions in the meantime, just reply to this message.',
    '',
    'Warm wishes,',
    'The Garden Calendar team',
  ].join('\n');
}

// ── Main poll cycle ───────────────────────────────────────────────────────────
async function _poll() {
  if (!ETSY_API_KEY || !ETSY_SHOP_ID) {
    console.log('[etsy] ETSY_API_KEY or ETSY_SHOP_ID not set — skipping poll');
    return;
  }
  if (!process.env.ETSY_REFRESH_TOKEN) {
    console.log('[etsy] ETSY_REFRESH_TOKEN not set — skipping poll (run etsy-oauth-helper.js)');
    return;
  }

  try {
    // Read last-processed timestamp from store metadata
    var meta           = store.getMeta('etsyCron') || {};
    var sinceTimestamp = meta.lastReceiptTimestamp || 0;

    console.log('[etsy] Polling for orders since', sinceTimestamp
      ? new Date(sinceTimestamp * 1000).toISOString()
      : 'beginning');

    var newOrders = await _fetchNewOrders(sinceTimestamp);
    console.log('[etsy] Found', newOrders.length, 'new order(s)');

    if (newOrders.length === 0) return;

    // Process oldest-first so lastReceiptTimestamp advances correctly
    newOrders.sort(function(a, b) { return a.create_timestamp - b.create_timestamp; });

    for (var i = 0; i < newOrders.length; i++) {
      var order = newOrders[i];
      var receiptId = String(order.receipt_id);

      // Check if we've already messaged for this receipt
      if (meta.messagedReceipts && meta.messagedReceipts.indexOf(receiptId) !== -1) {
        console.log('[etsy] Already messaged for receipt', receiptId, '— skipping');
        continue;
      }

      try {
        var message = _buildMessage(order, ORDER_FORM_URL);
        await _sendEtsyMessage(order.receipt_id, order.buyer_user_id, message);

        // Record that we've messaged this receipt
        if (!meta.messagedReceipts) meta.messagedReceipts = [];
        meta.messagedReceipts.push(receiptId);
        meta.lastReceiptTimestamp = Math.max(
          meta.lastReceiptTimestamp || 0,
          order.create_timestamp
        );
        store.setMeta('etsyCron', meta);

        console.log('[etsy] Processed receipt', receiptId);
      } catch(e) {
        console.error('[etsy] Failed to process receipt', receiptId, ':', e.message);
        // Don't update lastReceiptTimestamp — will retry next poll
      }
    }

  } catch(e) {
    console.error('[etsy] Poll error:', e.message);
  }
}

// ── Start cron ────────────────────────────────────────────────────────────────
function start() {
  if (!ETSY_API_KEY || !ETSY_SHOP_ID) {
    console.log('[etsy] Cron not started — ETSY_API_KEY or ETSY_SHOP_ID missing');
    return;
  }

  console.log('[etsy] Cron started — polling every', POLL_INTERVAL_MS / 60000, 'minutes');

  // Run immediately on startup, then on interval
  _poll();
  setInterval(_poll, POLL_INTERVAL_MS);
}

// ── Internal: HTTPS GET ───────────────────────────────────────────────────────
function _httpsGet(url, headers) {
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

// ── Internal: HTTPS POST ──────────────────────────────────────────────────────
function _httpsPost(url, body, headers) {
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

module.exports = { start: start };
