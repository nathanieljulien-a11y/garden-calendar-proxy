// Run: node test/queueRecovery.test.js
// Stubs the PDF/R2/Etsy modules so no Chromium or network is needed.
var assert = require('assert');
var fs = require('fs'), os = require('os'), path = require('path');

var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-queue-'));
process.env.RENDER_DISK_PATH = dir;

function stub(rel, exportsObj) {
  var f = require.resolve(rel);
  require.cache[f] = { id: f, filename: f, loaded: true, exports: exportsObj };
}
var built = [], sentMsgs = [];
stub('../pdfService.js', {
  buildFullHTML: async function(fd) { built.push(fd._id); return '<html/>'; },
  generatePDF:   async function() { return Buffer.from('pdf'); },
});
stub('../r2.js', { uploadToR2: async function(b, name) { return 'https://r2.example/' + name; } });
stub('../etsyMessaging.js', { sendEtsyMessage: async function(r, u, m) { sentMsgs.push({ r: r, m: m }); } });

var store = require('../orderStore.js');
var queue = require('../queueService.js');

var passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function mk(status, extra, ageMs) {
  var o = store.createOrder(Object.assign({ product: 'garden-wall-calendar', city: 'Bath, UK' }, (extra && extra.formData) || {}));
  var fields = Object.assign({ status: status }, extra || {});
  delete fields.formData;
  store.updateOrder(o.id, fields);
  if (ageMs) {   // backdate createdAt
    var file = path.join(dir, 'orders.json'), all = JSON.parse(fs.readFileSync(file, 'utf8'));
    all[o.id].createdAt = new Date(Date.now() - ageMs).toISOString();
    fs.writeFileSync(file, JSON.stringify(all));
  }
  return o.id;
}
var H = 3600 * 1000;

(async function() {
  console.log('recoverInterrupted');
  // _meta present in the store (as in production) must not break anything
  store.setMeta('etsyReceiptMap', { '1': 2 });

  var interrupted = mk('processing', { attempts: 1 }, 5 * 60 * 1000);
  var queuedOnly  = mk('queued', {}, 2 * 60 * 1000);
  var doneAlready = mk('done', { pdfUrl: 'x' }, 60 * 1000);
  var stale       = mk('processing', { attempts: 1 }, 40 * H);
  var superseded  = mk('processing', { superseded: true }, 60 * 1000);
  var exhausted   = mk('processing', { attempts: 2 }, 60 * 1000);

  await test('re-queues recent interrupted + queued orders only', async function() {
    var n = queue.recoverInterrupted();
    assert.strictEqual(n, 2);
    await sleep(300);
    assert.deepStrictEqual(built.slice().sort(), [interrupted, queuedOnly].sort());
  });
  await test('recovered orders complete', function() {
    assert.strictEqual(store.getOrder(interrupted).status, 'done');
    assert.strictEqual(store.getOrder(queuedOnly).status, 'done');
    assert.strictEqual(store.getOrder(interrupted).attempts, 2);
  });
  await test('done, stale and superseded orders are left alone', function() {
    assert.strictEqual(store.getOrder(doneAlready).status, 'done');
    assert.strictEqual(store.getOrder(stale).status, 'processing');
    assert.strictEqual(store.getOrder(superseded).status, 'processing');
    assert.ok(built.indexOf(doneAlready) === -1 && built.indexOf(stale) === -1 && built.indexOf(superseded) === -1);
  });
  await test('order out of attempts is marked failed, not re-run', function() {
    var o = store.getOrder(exhausted);
    assert.strictEqual(o.status, 'failed');
    assert.ok(built.indexOf(exhausted) === -1);
  });
  await test('running recovery again re-queues nothing', function() {
    assert.strictEqual(queue.recoverInterrupted(), 0);
  });
  await test('no Etsy messages sent for orders without a receipt', function() {
    assert.strictEqual(sentMsgs.length, 0);
  });

  console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
  fs.rmSync(dir, { recursive: true, force: true });
})();
