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

var store      = require('./orderStore.js');
var messaging  = require('./etsyMessaging.js');

var ETSY_API_KEY       = process.env.ETSY_API_KEY   || '';
var ETSY_SHOP_ID       = process.env.ETSY_SHOP_ID   || '';
var ORDER_FORM_URL     = (process.env.ORDER_FORM_URL || 'https://garden-calendar-order-form.vercel.app').replace(/\/$/, '');
var POLL_INTERVAL_MS   = 5 * 60 * 1000; // 5 minutes

// ── Fetch recent Etsy orders ──────────────────────────────────────────────────
async function _fetchNewOrders(sinceTimestamp) {
  var token = await messaging.getAccessToken();
  var url = 'https://openapi.etsy.com/v3/application/shops/' + ETSY_SHOP_ID
    + '/receipts?limit=25&sort_on=created&sort_order=desc';

  var data = await messaging.httpsGet(url, {
    'x-api-key':     ETSY_API_KEY + ':' + (process.env.ETSY_SHARED_SECRET || ''),
    'Authorization': 'Bearer ' + token,
  });

  if (!data.results) {
    console.error('[etsy] Unexpected orders response:', JSON.stringify(data).slice(0, 200));
    return [];
  }

  return data.results.filter(function(r) {
    return r.create_timestamp > sinceTimestamp;
  });
}

// ── Build personalised form-link message ──────────────────────────────────────
function _buildMessage(order, formUrl) {
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
    var meta           = store.getMeta('etsyCron') || {};
    var sinceTimestamp = meta.lastReceiptTimestamp || 0;

    console.log('[etsy] Polling for orders since', sinceTimestamp
      ? new Date(sinceTimestamp * 1000).toISOString()
      : 'beginning');

    var newOrders = await _fetchNewOrders(sinceTimestamp);
    console.log('[etsy] Found', newOrders.length, 'new order(s)');

    if (newOrders.length === 0) return;

    newOrders.sort(function(a, b) { return a.create_timestamp - b.create_timestamp; });

    // Load the receipt→buyerUserId map (used by queueService to send preview messages)
    var receiptMap = store.getMeta('etsyReceiptMap') || {};

    for (var i = 0; i < newOrders.length; i++) {
      var order     = newOrders[i];
      var receiptId = String(order.receipt_id);

      // Always persist the receipt→buyerUserId mapping — queueService needs this
      // even if we've already sent the form-link message for this receipt
      receiptMap[receiptId] = order.buyer_user_id;
      store.setMeta('etsyReceiptMap', receiptMap);

      if (meta.messagedReceipts && meta.messagedReceipts.indexOf(receiptId) !== -1) {
        console.log('[etsy] Already messaged for receipt', receiptId, '— skipping');
        continue;
      }

      try {
        var message = _buildMessage(order, ORDER_FORM_URL);
        await messaging.sendEtsyMessage(order.receipt_id, order.buyer_user_id, message);

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
  _poll();
  setInterval(_poll, POLL_INTERVAL_MS);
}

module.exports = { start: start };
