// etsyLookup.js (CommonJS)
// "Find your order": the buyer opens the order form without a personal link (from the
// listing's automatic Etsy message), types their Etsy order number and the delivery
// postcode, and we hand back what they already told us on Etsy (start month, location,
// calendar name, message) plus the product, so the form only has to ask for plants.
//
//   POST /api/etsy-order/lookup   body: { orderNumber, postcode }
//     → 200 { ok, receiptId, product, prefill: { city, name, start, msg } }
//
// The order number alone is not secret, so the delivery postcode (checked against the
// Etsy receipt) is required too. A wrong postcode and an unknown order number give the
// same answer, wrong tries are limited per order, and total lookups per hour are capped.
// No address or buyer details are returned — only the buyer's own customisation answers.

var express    = require('express');
var intake     = require('./etsyIntake.js');
var receiptSvc = require('./etsyReceipt.js');
var operator   = require('./operatorNotify.js');

var router = express.Router();

var PER_ORDER_MAX = 6;        // failed tries per order number per window
var GLOBAL_MAX    = 200;      // lookups per window across everyone
var WINDOW_MS     = 60 * 60 * 1000;

var _failed = {};             // orderNumber → { count, resetAt }
var _global = { count: 0, resetAt: 0 };

function _bump(rec, now) {
  if (!rec || now >= rec.resetAt) return { count: 1, resetAt: now + WINDOW_MS };
  rec.count++; return rec;
}

var NOT_FOUND = 'We couldn’t match that order number and postcode. Please check them against your Etsy order confirmation (the postcode is the one you’re having it delivered to).';

router.post('/api/etsy-order/lookup', async function(req, res) {
  var now = Date.now();
  var orderNumber = String((req.body && req.body.orderNumber) || '').replace(/[^0-9]/g, '');
  var postcode    = String((req.body && req.body.postcode) || '');

  if (!/^\d{6,15}$/.test(orderNumber) || !postcode.trim())
    return res.status(400).json({ error: 'Please enter your Etsy order number and delivery postcode.' });

  _global = _bump(_global, now);
  if (_global.count > GLOBAL_MAX)
    return res.status(429).json({ error: 'Lots of people are ordering right now — please try again in a few minutes.' });

  var rec = _failed[orderNumber];
  if (rec && now < rec.resetAt && rec.count >= PER_ORDER_MAX)
    return res.status(429).json({ error: 'Too many attempts for this order. Please message us on Etsy and we’ll send you a personal link.' });

  function fail() { _failed[orderNumber] = _bump(_failed[orderNumber], now); return res.status(404).json({ error: NOT_FOUND }); }

  var receipt;
  try { receipt = await receiptSvc.fetchReceipt(orderNumber); }
  catch (e) {
    console.warn('[lookup] receipt lookup failed for', orderNumber, '—', e.message.slice(0, 120));
    return fail();
  }
  if (!receiptSvc.postcodeMatches(postcode, receipt.zip)) return fail();

  if (receipt.is_paid === false || /cancel|refund/i.test(String(receipt.status || '')))
    return res.status(409).json({ error: 'This order isn’t showing as paid yet — please try again later, or message us on Etsy.' });

  var tx        = (receipt.transactions || [])[0] || {};
  var map       = receiptSvc.parseListingProductMap(process.env.ETSY_LISTING_PRODUCTS);
  var product   = map[String(tx.listing_id)];
  if (!product) {
    console.error('[lookup] No product mapped for listing', tx.listing_id, '(receipt', orderNumber + ') — check ETSY_LISTING_PRODUCTS');
    operator.notify('[Garden Calendar] Order lookup could not find a product — order ' + orderNumber,
      'A buyer tried to set up Etsy order ' + orderNumber + ' but listing ' + tx.listing_id + ' is not in ETSY_LISTING_PRODUCTS.').catch(function() {});
    return res.status(409).json({ error: 'We couldn’t set this order up automatically — please message us on Etsy and we’ll sort it out.' });
  }

  var parsed = intake.parseReceipt(receipt).data;     // partial answers are fine — the buyer can fill the gaps
  var prefill = {};
  if (parsed.city)            prefill.city  = parsed.city;
  if (parsed.calendarName && !parsed.nameDefaulted) prefill.name = parsed.calendarName;
  if (parsed.startMonth)      prefill.start = parsed.startMonth;
  if (parsed.personalMessage) prefill.msg   = parsed.personalMessage;

  delete _failed[orderNumber];
  console.log('[lookup] Order', orderNumber, 'found — product:', product, '— prefilled:', Object.keys(prefill).join(','));
  res.json({ ok: true, receiptId: String(receipt.receipt_id), product: product, prefill: prefill });
});

router._test = { reset: function() { _failed = {}; _global = { count: 0, resetAt: 0 }; }, PER_ORDER_MAX: PER_ORDER_MAX, GLOBAL_MAX: GLOBAL_MAX };
module.exports = router;
