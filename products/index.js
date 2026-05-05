// products/index.js (CommonJS)
// Product registry — maps productType string to product config module.
// Each product must implement:
//   validateOrder(body, errors)
//   buildSharedState(order, geo, apiKey, compressToJpegDataUri, makeQrB64) → sharedState
//   buildMonthContent(monthLoopIndex, order, sharedState) → per-month fields
//   buildPageA(monthOpts) → HTML string
//   buildCoverExtras(order, sharedState) → extra fields for buildCoverPage
//   buildCoverPage(opts) → HTML string

var PRODUCTS = {
  'garden-wall-calendar': require('./garden-wall-calendar.js'),
};

// Default product when no productType is specified on an order.
var DEFAULT_PRODUCT = 'garden-wall-calendar';

function getProduct(productType) {
  var id = productType || DEFAULT_PRODUCT;
  var p  = PRODUCTS[id];
  if (!p) throw new Error('Unknown productType: ' + id);
  return p;
}

module.exports = { getProduct: getProduct };
