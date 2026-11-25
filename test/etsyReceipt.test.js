// Run: node test/etsyReceipt.test.js
var assert = require('assert');
var r = require('../etsyReceipt.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('splitName');
test('first + last', function() { assert.deepStrictEqual(r.splitName('Helen Hall'), { firstName: 'Helen', lastName: 'Hall' }); });
test('middle names stay with the first name', function() { assert.deepStrictEqual(r.splitName('  Helen  Mary   Hall '), { firstName: 'Helen Mary', lastName: 'Hall' }); });
test('single word / empty', function() {
  assert.deepStrictEqual(r.splitName('Cher'), { firstName: 'Cher', lastName: '' });
  assert.deepStrictEqual(r.splitName(null), { firstName: '', lastName: '' });
});

console.log('addressFromReceipt');
var receipt = { name: 'Helen Hall', first_line: '1 Example Road', second_line: null, city: 'Carshalton', state: null, zip: 'SM5 1AA', country_iso: 'GB', buyer_email: null };
test('maps Etsy fields to Gelato fields', function() {
  var a = r.addressFromReceipt(receipt, { fallbackEmail: 'me@x.test' });
  assert.strictEqual(a.firstName, 'Helen'); assert.strictEqual(a.lastName, 'Hall');
  assert.strictEqual(a.addressLine1, '1 Example Road'); assert.strictEqual(a.addressLine2, '');
  assert.strictEqual(a.city, 'Carshalton'); assert.strictEqual(a.postCode, 'SM5 1AA'); assert.strictEqual(a.country, 'GB');
});
test('uses the fallback email only when Etsy gives none', function() {
  assert.strictEqual(r.addressFromReceipt(receipt, { fallbackEmail: 'me@x.test' }).email, 'me@x.test');
  assert.strictEqual(r.addressFromReceipt(Object.assign({}, receipt, { buyer_email: 'b@x.test' }), { fallbackEmail: 'me@x.test' }).email, 'b@x.test');
  assert.strictEqual(r.addressFromReceipt(receipt).email, '');
});

console.log('postcodeMatches');
test('ignores case and spacing', function() {
  assert.ok(r.postcodeMatches('sm51aa', 'SM5 1AA'));
  assert.ok(r.postcodeMatches(' SM5-1AA ', 'sm5 1aa'));
});
test('rejects wrong, empty and too-short', function() {
  assert.ok(!r.postcodeMatches('SM5 1AB', 'SM5 1AA'));
  assert.ok(!r.postcodeMatches('', ''));
  assert.ok(!r.postcodeMatches('SM', 'SM'));
  assert.ok(!r.postcodeMatches('SM5 1AA', undefined));
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
