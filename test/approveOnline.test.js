// Run: node test/approveOnline.test.js   (needs `express` installed, as in production)
// Exercises POST /orders/:id/approve-online and the Gelato address lookup with PDF /
// R2 / Gelato / Etsy stubbed — no network, no Chromium.
var assert = require('assert');
var os     = require('os');
var fs     = require('fs');
var path   = require('path');
var http   = require('http');

process.env.RENDER_DISK_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-test-'));
process.env.GELATO_API_KEY = 'test-key';
// Fake Gelato: https.request to order.gelatoapis.com is answered locally and the payload captured
var https = require('https');
var gelatoMode = 'fail';           // 'fail' → HTTP 500, 'ok' → 201
var gelatoPayloads = [];
https.request = function(opts, cb) {
  var chunks = [];
  var req = new (require('events').EventEmitter)();
  req.write = function(c) { chunks.push(c); };
  req.setTimeout = function() {};
  req.destroy = function() {};
  req.end = function() {
    gelatoPayloads.push(JSON.parse(chunks.join('')));
    var res = new (require('events').EventEmitter)();
    res.statusCode = gelatoMode === 'ok' ? 201 : 500;
    cb(res);
    res.emit('data', JSON.stringify(gelatoMode === 'ok' ? { id: 'gelato-123' } : { message: 'nope' }));
    res.emit('end');
  };
  return req;
};

function stub(rel, exports) {
  var id = require.resolve(rel);
  require.cache[id] = { id: id, filename: id, loaded: true, exports: exports };
}
var pdfCalls = [];
stub('../products/index.js', { getProduct: function() { return { gelatoSku: 'sku' }; } });
stub('../queueService.js',   { enqueue: function() { return { position: 1 }; }, getStatus: function() { return { busy: false }; } });
stub('../pdfService.js',     {
  buildFullHTMLFromState: async function(id) { pdfCalls.push(id); return '<html/>'; },
  generatePDF: async function() { return Buffer.from('pdf'); },
  deleteSharedState: function() {},
});
stub('../r2.js', { uploadToR2: async function(buf, name) { return 'https://r2.test/' + name; } });

var operatorEmails = [];
require('../operatorNotify.js')._setTransport(async function(p) { operatorEmails.push(p); });
process.env.RESEND_API_KEY = 'k'; process.env.EMAIL_FROM = 'from@x.test'; process.env.OPERATOR_EMAIL = 'me@x.test';

var receiptSvc = require('../etsyReceipt.js');
var RECEIPT = { receipt_id: 555, name: 'Helen Hall', first_line: '1 Example Road', city: 'Carshalton', zip: 'SM5 1AA', country_iso: 'GB', buyer_email: null };
var lookups = 0, lookupFails = false;
receiptSvc.fetchReceipt = async function(id) {
  lookups++;
  if (lookupFails) throw new Error('etsy down');
  return RECEIPT;
};

var express = require('express');
var store   = require('../orderStore.js');
var router  = require('../orderService.js');

var app = express(); app.use(express.json()); app.use(router);

var passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
function call(port, method, url, body) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var req = http.request({ port: port, path: url, method: method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, function(res) {
      var s = ''; res.on('data', function(c) { s += c; }); res.on('end', function() { resolve({ status: res.statusCode, body: s ? JSON.parse(s) : null }); });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
function doneOrder(extra) {
  var o = store.createOrder({ product: 'garden-wall-calendar', city: 'Carshalton, UK', etsy_receipt_id: '555' });
  store.updateOrder(o.id, Object.assign({ status: 'done', pdfUrl: 'https://r2.test/' + o.id + '.pdf' }, extra || {}));
  return store.getOrder(o.id);
}

var server = app.listen(0, async function() {
  var port = server.address().port;
  var origLog = console.log; // keep output readable: silence route logging
  console.log('POST /orders/:id/approve-online');

  await test('wrong postcode → 403, counted, nothing approved', async function() {
    var o = doneOrder();
    var r = await call(port, 'POST', '/orders/' + o.id + '/approve-online', { postcode: 'AB1 2CD' });
    assert.strictEqual(r.status, 403);
    var after = store.getOrder(o.id);
    assert.strictEqual(after.approved, undefined); assert.strictEqual(after.approveAttempts, 1);
  });
  await test('locks out after 5 wrong tries, even with the right postcode', async function() {
    var o = doneOrder({ approveAttempts: 5 });
    var before = lookups;
    var r = await call(port, 'POST', '/orders/' + o.id + '/approve-online', { postcode: 'SM5 1AA' });
    assert.strictEqual(r.status, 429); assert.strictEqual(lookups, before);
  });
  await test('missing postcode → 400; no receipt on the order → 403', async function() {
    var o = doneOrder();
    assert.strictEqual((await call(port, 'POST', '/orders/' + o.id + '/approve-online', {})).status, 400);
    var bare = store.createOrder({ product: 'garden-wall-calendar' });
    store.updateOrder(bare.id, { status: 'done', pdfUrl: 'https://r2.test/x.pdf' });
    assert.strictEqual((await call(port, 'POST', '/orders/' + bare.id + '/approve-online', { postcode: 'SM5 1AA' })).status, 403);
  });
  await test('not ready / superseded / already approved / unknown → 409/409/409/404', async function() {
    var queued = store.createOrder({ product: 'garden-wall-calendar', etsy_receipt_id: '555' });
    assert.strictEqual((await call(port, 'POST', '/orders/' + queued.id + '/approve-online', { postcode: 'SM5 1AA' })).status, 409);
    assert.strictEqual((await call(port, 'POST', '/orders/' + doneOrder({ superseded: true }).id + '/approve-online', { postcode: 'SM5 1AA' })).status, 409);
    assert.strictEqual((await call(port, 'POST', '/orders/' + doneOrder({ approved: true }).id + '/approve-online', { postcode: 'SM5 1AA' })).status, 409);
    assert.strictEqual((await call(port, 'POST', '/orders/nope/approve-online', { postcode: 'SM5 1AA' })).status, 404);
  });
  await test('Etsy lookup failure → 502, not approved, attempt not burned', async function() {
    var o = doneOrder(); lookupFails = true;
    var r = await call(port, 'POST', '/orders/' + o.id + '/approve-online', { postcode: 'SM5 1AA' });
    lookupFails = false;
    assert.strictEqual(r.status, 502);
    var after = store.getOrder(o.id); assert.strictEqual(after.approved, undefined); assert.ok(!after.approveAttempts);
  });
  await test('right postcode (any case/spacing) → approved, clean PDF made, print token created, Gelato attempted', async function() {
    var o = doneOrder(); pdfCalls.length = 0; operatorEmails.length = 0;
    var r = await call(port, 'POST', '/orders/' + o.id + '/approve-online', { postcode: 'sm51aa' });
    // Fake Gelato answers 500 here → 502 AFTER approval, PDF and token steps succeeded
    assert.strictEqual(r.status, 502);
    var after = store.getOrder(o.id);
    assert.strictEqual(after.approved, true); assert.strictEqual(after.approvedVia, 'order-form');
    assert.ok(after.finalPdfUrl && after.printToken);
    assert.deepStrictEqual(pdfCalls, [o.id]);
    assert.ok(/Gelato HTTP 500/.test(after.gelatoError));
    assert.ok(operatorEmails.some(function(m) { return m.subject.indexOf('Gelato failed') !== -1; }), 'operator told about the Gelato failure');
  });
  await test('a second approve attempt is refused (no double print)', async function() {
    var o = doneOrder({ approved: true });
    assert.strictEqual((await call(port, 'POST', '/orders/' + o.id + '/approve-online', { postcode: 'SM5 1AA' })).status, 409);
  });

  await test('success: draft carries the Etsy delivery address, order stores the Gelato id, operator is emailed', async function() {
    gelatoMode = 'ok'; gelatoPayloads.length = 0; operatorEmails.length = 0;
    process.env.GELATO_FALLBACK_EMAIL = 'ops@x.test';
    var o = doneOrder();
    var r = await call(port, 'POST', '/orders/' + o.id + '/approve-online', { postcode: 'SM5 1AA' });
    gelatoMode = 'fail';
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.success, true);
    var sa = gelatoPayloads[0].shippingAddress;
    assert.strictEqual(sa.firstName, 'Helen'); assert.strictEqual(sa.lastName, 'Hall');
    assert.strictEqual(sa.addressLine1, '1 Example Road'); assert.strictEqual(sa.postCode, 'SM5 1AA');
    assert.strictEqual(sa.country, 'GB'); assert.strictEqual(sa.email, 'ops@x.test');
    assert.strictEqual(gelatoPayloads[0].orderType, 'draft');
    var after = store.getOrder(o.id);
    assert.strictEqual(after.gelatoOrderId, 'gelato-123');
    // address is passed to Gelato but not kept on our order record
    assert.ok(JSON.stringify(after).indexOf('Example Road') === -1 && JSON.stringify(after).indexOf('SM5 1AA') === -1);
    await new Promise(function(r) { setTimeout(r, 50); });
    var mail = operatorEmails.find(function(m) { return m.subject.indexOf('Gelato draft ready') !== -1; });
    assert.ok(mail && mail.text.indexOf('gelato-123') !== -1);
    assert.ok(mail.text.indexOf('buyer email') !== -1, 'warns that Etsy withheld the buyer email');
  });

  console.log('GET /orders/:id');
  await test('exposes canApproveOnline/approved but never the token', async function() {
    var o = doneOrder();
    var r = await call(port, 'GET', '/orders/' + o.id);
    assert.strictEqual(r.body.canApproveOnline, true); assert.strictEqual(r.body.approved, false);
    assert.ok(JSON.stringify(r.body).indexOf(o.token) === -1);
    var bare = store.createOrder({ product: 'garden-wall-calendar' }); store.updateOrder(bare.id, { status: 'done', pdfUrl: 'u' });
    assert.strictEqual((await call(port, 'GET', '/orders/' + bare.id)).body.canApproveOnline, false);
  });

  console.log('Gelato delivery address');
  await test('comes from the Etsy receipt, with the fallback email when Etsy has none', async function() {
    process.env.GELATO_FALLBACK_EMAIL = 'ops@x.test';
    var r = await router._test.resolveShippingAddress({ id: 'x', formData: { etsy_receipt_id: '555' } });
    assert.strictEqual(r.source, 'etsy');
    assert.strictEqual(r.addr.postCode, 'SM5 1AA'); assert.strictEqual(r.addr.lastName, 'Hall'); assert.strictEqual(r.email, 'ops@x.test');
  });
  await test('an address on the order itself still wins (old behaviour kept)', async function() {
    var r = await router._test.resolveShippingAddress({ id: 'x', formData: { etsy_receipt_id: '555', shippingAddress: { addressLine1: 'A', postCode: 'P' }, email: 'e@x.test' } });
    assert.strictEqual(r.source, 'form'); assert.strictEqual(r.email, 'e@x.test');
  });
  await test('Etsy failure → empty address (draft still created; operator is told to fill it in)', async function() {
    lookupFails = true;
    var r = await router._test.resolveShippingAddress({ id: 'x', formData: { etsy_receipt_id: '555' } });
    lookupFails = false;
    assert.strictEqual(r.source, 'none'); assert.deepStrictEqual(r.addr, {});
  });

  server.close();
  console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
  setTimeout(function() { process.exit(process.exitCode || 0); }, 100);
});
