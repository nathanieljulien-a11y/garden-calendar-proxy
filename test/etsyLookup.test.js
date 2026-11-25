// Run: node test/etsyLookup.test.js   (needs express, as in production)
var assert = require('assert');
var http   = require('http');

process.env.ETSY_LISTING_PRODUCTS = '111:garden-wall-calendar,222:garden-wall-calendar-na';
var receiptSvc = require('../etsyReceipt.js');
var operatorEmails = [];
var operator = require('../operatorNotify.js');
operator._setTransport(async function(p) { operatorEmails.push(p); });
process.env.RESEND_API_KEY = 'k'; process.env.EMAIL_FROM = 'f@x.test'; process.env.OPERATOR_EMAIL = 'me@x.test';

function receipt(over) {
  return Object.assign({
    receipt_id: 4246343135, zip: 'SM5 1AA', is_paid: true, status: 'Paid', name: 'Helen Hall', first_line: '1 Example Road',
    transactions: [{ listing_id: 111, quantity: 1, variations: [
      { property_id: 54, formatted_name: 'Start Month', formatted_value: 'January' },
      { property_id: 54, formatted_name: 'Garden location - town, country', formatted_value: 'Carshalton, UK' },
      { property_id: 54, formatted_name: 'Calendar name', formatted_value: 'The Hall Family Garden' },
      { property_id: 54, formatted_name: 'Personal message', formatted_value: 'Dear Hel, Merry Christmas!' },
    ] }],
  }, over || {});
}
var current = receipt();
var fetched = [];
receiptSvc.fetchReceipt = async function(id) {
  fetched.push(id);
  if (String(id) !== String(current.receipt_id)) throw new Error('404 not found');
  return current;
};

var router = require('../etsyLookup.js');
var app = require('express')(); app.use(require('express').json()); app.use(router);

var passed = 0;
async function test(name, fn) {
  try { router._test.reset(); await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
function post(port, body) {
  return new Promise(function(resolve, reject) {
    var d = JSON.stringify(body);
    var req = http.request({ port: port, path: '/api/etsy-order/lookup', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, function(res) {
      var s = ''; res.on('data', function(c) { s += c; }); res.on('end', function() { resolve({ status: res.statusCode, body: JSON.parse(s) }); });
    });
    req.on('error', reject); req.write(d); req.end();
  });
}

var server = app.listen(0, async function() {
  var port = server.address().port;
  var OK = { orderNumber: '4246343135', postcode: 'sm51aa' };

  console.log('POST /api/etsy-order/lookup');
  await test('right order number + postcode → product and the Etsy answers, no personal details', async function() {
    var r = await post(port, OK);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body, { ok: true, receiptId: '4246343135', product: 'garden-wall-calendar',
      prefill: { city: 'Carshalton, UK', name: 'The Hall Family Garden', start: 1, msg: 'Dear Hel, Merry Christmas!' } });
    var text = JSON.stringify(r.body);
    assert.ok(text.indexOf('Example Road') === -1 && text.indexOf('Helen') === -1 && text.indexOf('SM5') === -1);
  });
  await test('accepts "#4246343135" and spaces in the order number', async function() {
    assert.strictEqual((await post(port, { orderNumber: ' #4246 343135 ', postcode: 'SM5 1AA' })).status, 200);
  });
  await test('wrong postcode and unknown order give the SAME answer (does not reveal which orders exist)', async function() {
    var a = await post(port, { orderNumber: '4246343135', postcode: 'ZZ9 9ZZ' });
    var b = await post(port, { orderNumber: '999999999', postcode: 'SM5 1AA' });
    assert.strictEqual(a.status, 404); assert.strictEqual(b.status, 404);
    assert.deepStrictEqual(a.body, b.body);
  });
  await test('bad input → 400 without calling Etsy', async function() {
    fetched.length = 0;
    assert.strictEqual((await post(port, { orderNumber: 'abc', postcode: 'SM5 1AA' })).status, 400);
    assert.strictEqual((await post(port, { orderNumber: '4246343135', postcode: '' })).status, 400);
    assert.strictEqual(fetched.length, 0);
  });
  await test('locks an order after 6 wrong postcodes — even the right one is then refused', async function() {
    for (var i = 0; i < router._test.PER_ORDER_MAX; i++) assert.strictEqual((await post(port, { orderNumber: '4246343135', postcode: 'AB1 2CD' })).status, 404);
    assert.strictEqual((await post(port, OK)).status, 429);
  });
  await test('a successful lookup clears earlier wrong tries', async function() {
    for (var i = 0; i < 3; i++) await post(port, { orderNumber: '4246343135', postcode: 'AB1 2CD' });
    assert.strictEqual((await post(port, OK)).status, 200);
    for (var j = 0; j < 5; j++) await post(port, { orderNumber: '4246343135', postcode: 'AB1 2CD' });
    assert.strictEqual((await post(port, OK)).status, 200);
  });
  await test('global hourly cap stops runaway lookups', async function() {
    for (var i = 0; i < router._test.GLOBAL_MAX; i++) await post(port, OK);
    assert.strictEqual((await post(port, OK)).status, 429);
  });
  await test('unpaid or cancelled order → 409', async function() {
    current = receipt({ is_paid: false });
    assert.strictEqual((await post(port, OK)).status, 409);
    current = receipt({ status: 'Canceled' });
    assert.strictEqual((await post(port, OK)).status, 409);
    current = receipt();
  });
  await test('listing not in ETSY_LISTING_PRODUCTS → 409 and the operator is emailed', async function() {
    operatorEmails.length = 0;
    current = receipt({ transactions: [{ listing_id: 777, variations: [] }] });
    assert.strictEqual((await post(port, OK)).status, 409);
    await new Promise(function(r) { setTimeout(r, 30); });
    assert.ok(operatorEmails[0] && operatorEmails[0].subject.indexOf('could not find a product') !== -1);
    current = receipt();
  });
  await test('partially readable answers still work (the buyer fills the rest)', async function() {
    current = receipt({ transactions: [{ listing_id: 222, variations: [{ property_id: 54, formatted_name: 'Start Month', formatted_value: 'March' }] }] });
    var r = await post(port, OK);
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.product, 'garden-wall-calendar-na');
    assert.deepStrictEqual(r.body.prefill, { start: 3 });
    current = receipt();
  });

  server.close();
  console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
  setTimeout(function() { process.exit(process.exitCode || 0); }, 50);
});
