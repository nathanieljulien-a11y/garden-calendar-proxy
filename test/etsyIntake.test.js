// Run: node test/etsyIntake.test.js
// Plain assert — no test framework needed.
var assert = require('assert');
var fs     = require('fs');
var path   = require('path');
var intake = require('../etsyIntake.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

function receipt(variations, extra) {
  return Object.assign({
    receipt_id: 1234567890,
    transactions: [{ listing_id: 111, quantity: 1, variations: variations }],
  }, extra || {});
}
var P = function(value, name) { return { property_id: 54, formatted_name: name || 'Personalization', formatted_value: value }; };
var START = function(v) { return { property_id: 513, formatted_name: 'Start month', formatted_value: v }; };

console.log('monthFromText');
test('full name', function() { assert.strictEqual(intake.monthFromText('March'), 3); });
test('abbreviation + case', function() { assert.strictEqual(intake.monthFromText(' sept. '), 9); });
test('number', function() { assert.strictEqual(intake.monthFromText('12'), 12); });
test('out of range number', function() { assert.strictEqual(intake.monthFromText('13'), null); });
test('month inside short phrase', function() { assert.strictEqual(intake.monthFromText('starting in October please'), 10); });
test('garbage', function() { assert.strictEqual(intake.monthFromText('whenever'), null); });

console.log('parsePersonalization');
test('slash separated (listing instruction format)', function() {
  var p = intake.parsePersonalization('Location: Bath, UK / Name: The Smith Garden');
  assert.deepStrictEqual(p, { city: 'Bath, UK', name: 'The Smith Garden' });
});
test('newline separated, odd case + synonyms', function() {
  var p = intake.parsePersonalization('town = Austin, Texas, USA\nCalendar name: Mum\'s Patch\nstart - April');
  assert.strictEqual(p.city, 'Austin, Texas, USA');
  assert.strictEqual(p.name, "Mum's Patch");
  assert.strictEqual(p.start, 'April');
});
test('unlabelled text yields nothing', function() {
  assert.deepStrictEqual(intake.parsePersonalization('London please'), {});
});
test('hyphen inside a place name is not a separator', function() {
  var p = intake.parsePersonalization('Location: Stratford-upon-Avon, UK');
  assert.strictEqual(p.city, 'Stratford-upon-Avon, UK');
});

console.log('parseReceipt');
test('variation + labelled personalization (the recommended setup)', function() {
  var r = intake.parseReceipt(receipt([START('January'), P('Location: Bath, UK / Name: The Smith Garden')]));
  assert.ok(r.ok, r.reasons.join('; '));
  assert.deepStrictEqual(r.data, { city: 'Bath, UK', startMonth: 1, calendarName: 'The Smith Garden', nameDefaulted: false });
});
test('everything in the personalization box', function() {
  var r = intake.parseReceipt(receipt([P('Location: Leeds\nName: Gran\nStart: June')]));
  assert.ok(r.ok, r.reasons.join('; '));
  assert.strictEqual(r.data.startMonth, 6);
});
test('separate personalization questions named by field', function() {
  var r = intake.parseReceipt(receipt([
    START('March'), P('Edinburgh, UK', 'Location'), P('The Wee Garden', 'Calendar name'),
  ]));
  assert.ok(r.ok, r.reasons.join('; '));
  assert.strictEqual(r.data.city, 'Edinburgh, UK');
  assert.strictEqual(r.data.calendarName, 'The Wee Garden');
});
test('missing name defaults from location', function() {
  var r = intake.parseReceipt(receipt([START('May'), P('Location: Bath, UK')]));
  assert.ok(r.ok);
  assert.strictEqual(r.data.calendarName, 'Bath Garden');
  assert.strictEqual(r.data.nameDefaulted, true);
});
test('missing location fails', function() {
  var r = intake.parseReceipt(receipt([START('May'), P('Name: Dad')]));
  assert.ok(!r.ok);
  assert.ok(r.reasons.some(function(x) { return /location/.test(x); }));
});
test('missing start month fails', function() {
  var r = intake.parseReceipt(receipt([P('Location: Bath, UK')]));
  assert.ok(!r.ok);
  assert.ok(r.reasons.some(function(x) { return /start month/.test(x); }));
});
test('unstructured text fails (falls back to form link)', function() {
  var r = intake.parseReceipt(receipt([START('May'), P('bath please, for my mum')]));
  assert.ok(!r.ok);
});
test('no variations at all fails', function() {
  assert.ok(!intake.parseReceipt(receipt([])).ok);
});
test('two items on one receipt falls back', function() {
  var rc = receipt([START('May'), P('Location: Bath')]);
  rc.transactions.push({ listing_id: 111, quantity: 1, variations: [] });
  var r = intake.parseReceipt(rc);
  assert.ok(!r.ok);
  assert.ok(/transactions/.test(r.reasons[0]));
});
test('quantity 2 falls back', function() {
  var rc = receipt([START('May'), P('Location: Bath')]);
  rc.transactions[0].quantity = 2;
  assert.ok(!intake.parseReceipt(rc).ok);
});
test('null receipt does not throw', function() {
  assert.ok(!intake.parseReceipt(null).ok);
});

console.log('buildFormData / plants / year');
test('start month later this year → this year', function() {
  var fd = intake.buildFormData({ city: 'Bath, UK', startMonth: 10, calendarName: 'X' }, 99, 'garden-wall-calendar', new Date(2026, 9, 13));
  assert.strictEqual(fd.year, 2026);
});
test('January start in October → next year', function() {
  var fd = intake.buildFormData({ city: 'Bath, UK', startMonth: 1, calendarName: 'X' }, 99, 'garden-wall-calendar', new Date(2026, 9, 13));
  assert.strictEqual(fd.year, 2027);
});
test('shape matches what POST /orders validation expects', function() {
  var fd = intake.buildFormData({ city: 'Bath, UK', startMonth: 3, calendarName: 'X' }, 99, 'garden-wall-calendar', new Date(2026, 9, 13));
  assert.strictEqual(fd.plants.length, 12);
  assert.strictEqual(fd.product, 'garden-wall-calendar');
  assert.strictEqual(fd.etsy_receipt_id, '99');
  assert.strictEqual(fd.format, 'a3');
});
test('plants rotate from the start month', function() {
  var p = intake.defaultPlantsFor(3); // starts March
  assert.strictEqual(p[0], intake.DEFAULT_PLANT_BY_MONTH[2]);
  assert.strictEqual(p[11], intake.DEFAULT_PLANT_BY_MONTH[1]);
  assert.strictEqual(new Set(p).size, 12);
});
test('every default plant has artwork and commentary', function() {
  var commentary = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'plantCommentary.json'), 'utf8'));
  var files = fs.readdirSync(path.join(__dirname, '..', 'artwork'));
  intake.DEFAULT_PLANT_BY_MONTH.forEach(function(p) {
    assert.ok(commentary[p], 'no plantCommentary entry for ' + p);
    assert.ok(files.some(function(f) { return new RegExp('^[a-z0-9]+_' + p + '\\.jpe?g$').test(f); }), 'no artwork file for ' + p);
  });
});

console.log('buildFormUrl');
test('prefills and encodes', function() {
  var fd = intake.buildFormData({ city: 'Bath, UK', startMonth: 3, calendarName: "Mum's Patch" }, 99, 'garden-wall-calendar', new Date(2026, 9, 13));
  var u = intake.buildFormUrl('https://form.example/', fd, { includePlants: true });
  assert.ok(u.indexOf('https://form.example?etsy_receipt_id=99&product=garden-wall-calendar') === 0);
  assert.ok(u.indexOf('city=Bath%2C%20UK') !== -1);
  assert.ok(u.indexOf('name=Mum\'s%20Patch') !== -1 || u.indexOf('name=Mum%27s%20Patch') !== -1);
  assert.ok(u.indexOf('start=3') !== -1);
  assert.ok(/plants=([a-z]+(%2C)?){12}/.test(u));
});
test('plants omitted unless requested', function() {
  var fd = intake.buildFormData({ city: 'Bath', startMonth: 3, calendarName: 'X' }, 99, 'p', new Date(2026, 9, 13));
  assert.ok(intake.buildFormUrl('https://f', fd).indexOf('plants=') === -1);
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
