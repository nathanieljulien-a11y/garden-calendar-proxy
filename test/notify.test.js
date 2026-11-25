// Run: node test/notify.test.js
// buyerNotify + operatorNotify — no network.
var assert = require('assert');
var buyerNotify = require('../buyerNotify.js');
var operator    = require('../operatorNotify.js');

var passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

(async function() {
  var ENV = ['RESEND_API_KEY', 'EMAIL_FROM', 'OPERATOR_EMAIL', 'CONTACT_EMAIL', 'ETSY_MESSAGING_API'];
  var saved = {}; ENV.forEach(function(k) { saved[k] = process.env[k]; delete process.env[k]; });

  console.log('operatorNotify');
  await test('does nothing, and does not throw, when email is not configured', async function() {
    var r = await operator.notify('s', 't');
    assert.strictEqual(r.sent, false);
  });
  await test('sends to OPERATOR_EMAIL, falling back to CONTACT_EMAIL', async function() {
    process.env.RESEND_API_KEY = 'k'; process.env.EMAIL_FROM = 'from@x.test'; process.env.CONTACT_EMAIL = 'contact@x.test';
    var seen = [];
    operator._setTransport(async function(p) { seen.push(p); });
    assert.strictEqual((await operator.notify('a', 'b')).sent, true);
    process.env.OPERATOR_EMAIL = 'me@x.test';
    await operator.notify('a', 'b');
    assert.deepStrictEqual(seen[0].to, ['contact@x.test']);
    assert.deepStrictEqual(seen[1].to, ['me@x.test']);
  });
  await test('a failing email does not throw', async function() {
    operator._setTransport(async function() { throw new Error('boom'); });
    assert.strictEqual((await operator.notify('a', 'b')).sent, false);
  });

  console.log('buyerNotify');
  await test('default: emails the operator the message to paste, never calls the Etsy API', async function() {
    var apiCalls = 0, emails = [];
    buyerNotify._deps.messaging = { sendEtsyMessage: async function() { apiCalls++; } };
    buyerNotify._deps.operator  = { notify: async function(s, t) { emails.push({ s: s, t: t }); return { sent: true }; } };
    var r = await buyerNotify.deliver({ receiptId: 42, buyerUserId: 7, message: 'HELLO BUYER', kind: 'form link' });
    assert.strictEqual(r.via, 'operator-email');
    assert.strictEqual(apiCalls, 0);
    assert.ok(emails[0].s.indexOf('order 42') !== -1);
    assert.ok(emails[0].t.indexOf('HELLO BUYER') !== -1);
  });
  await test('ETSY_MESSAGING_API=1 uses the API when it works', async function() {
    process.env.ETSY_MESSAGING_API = '1';
    var sent = [];
    buyerNotify._deps.messaging = { sendEtsyMessage: async function(r, u, m) { sent.push([r, u, m]); } };
    buyerNotify._deps.operator  = { notify: async function() { throw new Error('should not email'); } };
    var r = await buyerNotify.deliver({ receiptId: 42, buyerUserId: 7, message: 'M' });
    assert.strictEqual(r.via, 'etsy');
    assert.deepStrictEqual(sent[0], [42, 7, 'M']);
  });
  await test('API failure falls back to the operator email (and does not throw)', async function() {
    process.env.ETSY_MESSAGING_API = '1';
    var emails = 0;
    buyerNotify._deps.messaging = { sendEtsyMessage: async function() { throw new Error('Resource not found'); } };
    buyerNotify._deps.operator  = { notify: async function() { emails++; return { sent: true }; } };
    var r = await buyerNotify.deliver({ receiptId: 42, buyerUserId: 7, message: 'M' });
    assert.strictEqual(r.via, 'operator-email'); assert.strictEqual(emails, 1);
  });
  await test('missing buyer id still reaches the operator', async function() {
    delete process.env.ETSY_MESSAGING_API;
    buyerNotify._deps.operator = { notify: async function() { return { sent: true }; } };
    assert.strictEqual((await buyerNotify.deliver({ receiptId: 42, message: 'M' })).via, 'operator-email');
  });
  await test('if even the email fails, the message is logged and nothing throws', async function() {
    buyerNotify._deps.operator = { notify: async function() { return { sent: false }; } };
    assert.strictEqual((await buyerNotify.deliver({ receiptId: 42, message: 'M' })).via, 'logged');
  });

  ENV.forEach(function(k) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
