// etsyCron.js (CommonJS)
// Polls Etsy Orders API every 5 minutes for new orders.
// For each new order, sends the customer a personalised message via Etsy
// Conversations API with a link to the order form.
//
// Environment variables required:
//   ETSY_API_KEY             — from developer.etsy.com (Keystring)
//   ETSY_REFRESH_TOKEN       — obtained via etsy-oauth-helper.js (one-time setup)
//   ETSY_SHOP_ID             — your Etsy shop ID (numeric, found in shop URL)
//   ORDER_FORM_URL           — base URL of the order form Vercel deployment
//   ETSY_LISTING_PRODUCTS    — comma-separated listingId:productId pairs, e.g.:
//                              "1234567890:garden-wall-calendar,9876543210:garden-wall-calendar-na"
//                              Required for every active listing (ADR-009).
//   ETSY_AUTO_PROOF          — set to "1" to enable proof-first intake: read start month,
//                              location and calendar name from the Etsy order, generate the
//                              proof immediately and message the buyer, instead of sending
//                              the order-form link first. Off by default. If the order
//                              details can't be read, the old form-link message is sent.

var store      = require('./orderStore.js');
var messaging  = require('./etsyMessaging.js');
var intake     = require('./etsyIntake.js');

var ETSY_API_KEY       = process.env.ETSY_API_KEY   || '';
var ETSY_SHOP_ID       = process.env.ETSY_SHOP_ID   || '';
var ORDER_FORM_URL     = (process.env.ORDER_FORM_URL || 'https://garden-calendar-order-form.vercel.app').replace(/\/$/, '');
var POLL_INTERVAL_MS   = 5 * 60 * 1000; // 5 minutes
var AUTO_PROOF         = process.env.ETSY_AUTO_PROOF === '1';

// ── Parse ETSY_LISTING_PRODUCTS env var ───────────────────────────────────────
// Format: "listingId1:productId1,listingId2:productId2"
// Returns a map of { listingId (string) → productId (string) }
function _parseListingProductMap() {
  var raw = process.env.ETSY_LISTING_PRODUCTS || '';
  var map = {};
  if (!raw.trim()) return map;
  raw.split(',').forEach(function(pair) {
    var parts = pair.trim().split(':');
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      map[parts[0].trim()] = parts[1].trim();
    }
  });
  return map;
}

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
// productId is required — caller must resolve it from the listing map before calling.
function _buildMessage(order, formUrl, productId) {
  var link = formUrl
    + '?etsy_receipt_id=' + order.receipt_id
    + '&product=' + encodeURIComponent(productId);
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

// ── Proof-first intake ────────────────────────────────────────────────────────
// Returns the intake order record { orderId, ackSent } for this receipt, creating
// and enqueueing the order if it does not exist yet. Returns null when the order
// details can't be read or the location can't be found — the caller then falls
// back to the form-link message.
async function _startProofFirst(order, receiptId, productId) {
  var intakeOrders = store.getMeta('etsyIntakeOrders') || {};
  if (intakeOrders[receiptId]) return intakeOrders[receiptId];   // already created (retry of a failed ack)

  var parsed = intake.parseReceipt(order);
  if (!parsed.ok) {
    console.warn('[etsy] Auto-proof: could not read order details for receipt', receiptId, '—', parsed.reasons.join('; '), '— falling back to form link');
    return null;
  }

  // The location must geocode, otherwise the proof would silently have no climate data.
  var geo = null;
  try { geo = await require('./pdfService.js').geocodeCity(parsed.data.city); } catch (e) { geo = null; }
  if (!geo) {
    console.warn('[etsy] Auto-proof: location "' + parsed.data.city + '" not found for receipt', receiptId, '— falling back to form link');
    return null;
  }

  try { require('./products/index.js').getProduct(productId); }
  catch (e) {
    console.warn('[etsy] Auto-proof: unknown product', productId, 'for receipt', receiptId, '— falling back to form link');
    return null;
  }

  var formData = intake.buildFormData(parsed.data, receiptId, productId);
  var created  = store.createOrder(formData);
  intakeOrders[receiptId] = { orderId: created.id };
  store.setMeta('etsyIntakeOrders', intakeOrders);        // persist BEFORE enqueue/message so a crash can't double-create
  require('./queueService.js').enqueue(created.id);
  console.log('[etsy] Auto-proof: order', created.id, 'created for receipt', receiptId,
    '— city:', formData.city, '— start:', formData.startMonth, '— name:', formData.calendarName,
    parsed.data.nameDefaulted ? '(name defaulted)' : '');
  return intakeOrders[receiptId];
}

function _buildAckMessage(formData) {
  var customiseUrl = intake.buildFormUrl(ORDER_FORM_URL, formData, { includePlants: true });
  return [
    'Hi there! Thank you so much for your Garden Calendar order \u2014 we\u2019re excited to make something special for you.',
    '',
    'We\u2019ve got your details:',
    '\u2022 Location: ' + formData.city,
    '\u2022 Calendar name: ' + formData.calendarName,
    '\u2022 Starting: ' + intake.MONTH_LABELS[formData.startMonth - 1] + ' ' + formData.year,
    '',
    'We\u2019re creating your proof now \u2014 you\u2019ll get it here in this conversation in a few minutes.',
    '',
    'Want to add special dates, change the plants or add a message on the cover? Use this link (it\u2019s already filled in with the details above). Submitting it replaces the proof we\u2019re making:',
    customiseUrl,
    '',
    'Nothing goes to print until you approve your proof. If you have any questions, just reply to this message.',
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

  var listingProductMap = _parseListingProductMap();
  if (Object.keys(listingProductMap).length === 0) {
    console.warn('[etsy] ETSY_LISTING_PRODUCTS not set — cannot resolve product for orders. Set this env var before going live (ADR-009).');
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

      // Resolve product from listing_id (ADR-009)
      // Etsy receipts contain an array of transactions, each with a listing_id.
      // We use the listing_id of the first transaction as the product signal.
      var listingId = null;
      if (order.transactions && order.transactions.length > 0) {
        listingId = String(order.transactions[0].listing_id);
      }
      var productId = listingId ? listingProductMap[listingId] : null;

      if (!productId) {
        console.error('[etsy] Could not resolve product for receipt', receiptId,
          '— listing_id:', listingId,
          '— ETSY_LISTING_PRODUCTS map:', JSON.stringify(listingProductMap),
          '— message will be sent but form link will be missing ?product=. Fix ETSY_LISTING_PRODUCTS.');
        // Still send the message so the customer isn't left hanging,
        // but log loudly — the order form will reject the submission without a product.
        productId = 'UNKNOWN';
      }

      try {
        var message = null;

        // Proof-first intake (ETSY_AUTO_PROOF=1): create the order from the Etsy answers
        if (AUTO_PROOF && productId !== 'UNKNOWN') {
          var started = await _startProofFirst(order, receiptId, productId);
          if (started) {
            var intakeOrder = store.getOrder(started.orderId);
            message = _buildAckMessage(intakeOrder.formData);
          }
        }
        // Otherwise (flag off, or details unreadable): the existing form-link message
        if (!message) message = _buildMessage(order, ORDER_FORM_URL, productId);

        await messaging.sendEtsyMessage(order.receipt_id, order.buyer_user_id, message);

        if (!meta.messagedReceipts) meta.messagedReceipts = [];
        meta.messagedReceipts.push(receiptId);
        meta.lastReceiptTimestamp = Math.max(
          meta.lastReceiptTimestamp || 0,
          order.create_timestamp
        );
        store.setMeta('etsyCron', meta);

        console.log('[etsy] Processed receipt', receiptId, '— product:', productId);
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
