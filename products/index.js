// products/index.js (CommonJS)
// Product registry — maps productType string to product config module.
// Each product must implement:
//   validateOrder(body, errors)
//   buildSharedState(order, geo, apiKey, compressToJpegDataUri, makeQrB64) → sharedState
//   buildMonthContent(monthLoopIndex, order, sharedState) → per-month fields
//   buildPageA(monthOpts) → HTML string
//   buildCoverExtras(order, sharedState) → extra fields for buildCoverPage
//   buildCoverPage(opts) → HTML string
//
// Product modules may also export:
//   gelatoSku  — Gelato productUid string. Read by orderService._submitToGelato().
//                If absent, orderService falls back to its own PRODUCT_UID constant.
//
// The `product` field is REQUIRED on every order (ADR-009).
// getProduct() throws if the value is missing or unrecognised — there is no default.

var PRODUCTS = {
  'garden-wall-calendar':    require('./garden-wall-calendar.js'),
  'garden-wall-calendar-na': require('./garden-wall-calendar-na.js'),
};

function getProduct(productType) {
  if (!productType) throw new Error('product field is required on every order — no default is set (ADR-009)');
  var p = PRODUCTS[productType];
  if (!p) throw new Error('Unknown product: ' + productType + '. Known products: ' + Object.keys(PRODUCTS).join(', '));
  return p;
}

module.exports = { getProduct: getProduct };
