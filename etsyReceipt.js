// etsyReceipt.js (CommonJS)
// Reads a single Etsy receipt and turns it into what Gelato needs. Addresses are fetched
// at the moment they are needed and passed straight on — never stored (OPERATIONS.md:
// buyer address data does not live in our system).

var messaging = require('./etsyMessaging.js');

async function fetchReceipt(receiptId) {
  var token = await messaging.getAccessToken();
  var url   = 'https://openapi.etsy.com/v3/application/shops/' + (process.env.ETSY_SHOP_ID || '')
    + '/receipts/' + encodeURIComponent(String(receiptId));
  var data  = await messaging.httpsGet(url, {
    'x-api-key':     (process.env.ETSY_API_KEY || '') + ':' + (process.env.ETSY_SHARED_SECRET || ''),
    'Authorization': 'Bearer ' + token,
  });
  if (!data || String(data.receipt_id) !== String(receiptId)) {
    throw new Error('Receipt lookup failed: ' + JSON.stringify(data).slice(0, 200));
  }
  return data;
}

// "Helen Mary Hall" → { firstName: "Helen Mary", lastName: "Hall" }
function splitName(full) {
  var n = String(full || '').replace(/\s+/g, ' ').trim();
  var i = n.lastIndexOf(' ');
  if (i < 0) return { firstName: n, lastName: '' };
  return { firstName: n.slice(0, i), lastName: n.slice(i + 1) };
}

// Gelato shippingAddress from an Etsy receipt.
// opts.fallbackEmail — used when Etsy withholds the buyer's email (it does unless the app
// has buyer_email approval). Gelato then sends its tracking emails to that address.
function addressFromReceipt(receipt, opts) {
  opts = opts || {};
  var nm = splitName(receipt.name);
  return {
    firstName:    nm.firstName,
    lastName:     nm.lastName,
    companyName:  '',
    addressLine1: receipt.first_line  || '',
    addressLine2: receipt.second_line || '',
    city:         receipt.city        || '',
    state:        receipt.state       || '',
    postCode:     receipt.zip         || '',
    country:      receipt.country_iso || 'GB',
    email:        receipt.buyer_email || opts.fallbackEmail || '',
    phone:        '',
  };
}

function normalisePostcode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Used to confirm the person approving online is the buyer (they know the delivery postcode).
function postcodeMatches(entered, actual) {
  var a = normalisePostcode(entered), b = normalisePostcode(actual);
  return a.length >= 3 && a === b;
}

// "1234:garden-wall-calendar,5678:garden-wall-calendar-na" → { '1234': 'garden-wall-calendar', ... }
// (same format as the ETSY_LISTING_PRODUCTS env var read by etsyCron.js)
function parseListingProductMap(raw) {
  var map = {};
  String(raw || '').split(',').forEach(function(pair) {
    var parts = pair.trim().split(':');
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) map[parts[0].trim()] = parts[1].trim();
  });
  return map;
}

module.exports = {
  parseListingProductMap: parseListingProductMap,
  fetchReceipt:      fetchReceipt,
  splitName:         splitName,
  addressFromReceipt: addressFromReceipt,
  normalisePostcode: normalisePostcode,
  postcodeMatches:   postcodeMatches,
};
