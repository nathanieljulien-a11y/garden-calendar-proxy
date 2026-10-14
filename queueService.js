// queueService.js (CommonJS)
// In-memory job queue for PDF generation.
// Processes one job at a time to avoid OOM crashes from concurrent Chromium instances.
// Jobs are persisted in orderStore.js so their status survives a status check even
// if the server restarts mid-queue; recoverInterrupted() re-queues them on startup.
//
// Usage:
//   var queue = require('./queueService.js');
//   queue.enqueue(orderId);         // add a job — call after createOrder()
//   queue.getStatus()               // { busy, queueLength, currentJobId }

var store     = require('./orderStore.js');
var r2        = require('./r2.js');
var messaging = require('./etsyMessaging.js');
var intake    = require('./etsyIntake.js');

var ORDER_FORM_URL = (process.env.ORDER_FORM_URL || 'https://garden-calendar-order-form.vercel.app').replace(/\/$/, '');

// Lazy-require pdfService internals to avoid circular deps at startup.
var _pdfService = null;
function _getPdf() {
  if (!_pdfService) _pdfService = require('./pdfService.js');
  return _pdfService;
}

// ── Queue state ───────────────────────────────────────────────────────────────
var _busy         = false;
var _queue        = []; // array of order IDs waiting to be processed
var _currentJobId = null;

// ── Public: enqueue ───────────────────────────────────────────────────────────
function enqueue(orderId) {
  _queue.push(orderId);
  var position = _queue.length;
  console.log('[queue] Enqueued ' + orderId + ' — queue length: ' + _queue.length);
  _tick();
  return { position: position };
}

// ── Public: status ────────────────────────────────────────────────────────────
function getStatus() {
  return {
    busy:         _busy,
    queueLength:  _queue.length,
    currentJobId: _currentJobId,
  };
}

// ── Internal: tick ────────────────────────────────────────────────────────────
function _tick() {
  if (_busy || _queue.length === 0) return;
  var orderId = _queue.shift();
  _processJob(orderId);
}

// ── Internal: process one job ─────────────────────────────────────────────────
async function _processJob(orderId) {
  _busy         = true;
  _currentJobId = orderId;
  console.log('[queue] Starting job:', orderId);

  var order = store.getOrder(orderId);
  if (!order) {
    console.error('[queue] Order not found:', orderId);
    _finish();
    return;
  }

  // The buyer submitted a newer version of this order while it was waiting — don't spend a PDF on it
  if (order.superseded) {
    console.log('[queue] Order', orderId, 'was superseded before it started — skipping');
    store.updateOrder(orderId, { status: 'superseded' });
    _finish();
    return;
  }

  // product is required on every order (ADR-009) — hard error if missing
  if (!order.formData || !order.formData.product) {
    console.error('[queue] Order', orderId, 'is missing required product field — cannot process');
    store.updateOrder(orderId, { status: 'failed', error: 'Missing required product field (ADR-009)' });
    _finish();
    return;
  }

  // attempts lets restart-recovery stop a job that keeps crashing the server (e.g. out of memory)
  store.updateOrder(orderId, { status: 'processing', attempts: (order.attempts || 0) + 1 });

  try {
    var apiKey = process.env.ANTHROPIC_API_KEY || '';

    var pdf    = _getPdf();
    var html   = await pdf.buildFullHTML(Object.assign({ _id: order.id }, order.formData), apiKey, { approved: false });
    var pdfBuf = await pdf.generatePDF(html);

    var filename  = orderId + '.pdf';
    var publicUrl = await r2.uploadToR2(pdfBuf, filename);

    store.updateOrder(orderId, { status: 'done', pdfUrl: publicUrl });
    console.log('[queue] Job done:', orderId, '→', publicUrl);

    // Notify buyer via Etsy Conversations (non-blocking — failure doesn't fail the job).
    // Skip if the buyer submitted a newer version while this one was generating.
    var latest = store.getOrder(orderId);
    if (latest && latest.superseded) {
      console.log('[queue] Order', orderId, 'was superseded during generation — not sending preview');
    } else {
      _sendEtsyPreview(order, publicUrl).catch(function(e) {
        console.error('[queue] Etsy preview message failed for', orderId, ':', e.message);
      });
    }

  } catch(e) {
    console.error('[queue] Job failed:', orderId, e.message);
    store.updateOrder(orderId, { status: 'failed', error: e.message });
    // Auto-created (proof-first) orders have no form submission behind them — if generation
    // fails the buyer would otherwise hear nothing. Send them the full form instead.
    if (order.formData && order.formData.source === 'etsy-intake') {
      _sendIntakeFailure(order).catch(function(e2) {
        console.error('[queue] Intake fallback message failed for', orderId, ':', e2.message);
      });
    }
  }

  _finish();
}

// ── Internal: finish ──────────────────────────────────────────────────────────
function _finish() {
  _busy         = false;
  _currentJobId = null;
  _tick();
}

// ── Internal: send preview notification via Etsy Conversations ───────────────
// Looks up the buyer's user ID from the receipt map saved by etsyCron,
// then messages them with the PDF preview link and approve URL.
// Silently skips if etsy_receipt_id is missing (e.g. direct test submissions).
async function _sendEtsyPreview(order, pdfUrl) {
  var receiptId = order.formData && order.formData.etsy_receipt_id;
  if (!receiptId) {
    console.log('[queue] No etsy_receipt_id on order', order.id, '— skipping Etsy preview message');
    return;
  }

  var receiptMap = store.getMeta('etsyReceiptMap') || {};
  var buyerUserId = receiptMap[String(receiptId)];
  if (!buyerUserId) {
    console.warn('[queue] No buyer_user_id found for receipt', receiptId, '— skipping Etsy preview message');
    return;
  }

  var approveUrl = (process.env.BACKEND_URL || 'https://garden-calendar-proxy.onrender.com')
    + '/orders/' + order.id + '/approve?token=' + order.token;

  var name = (order.formData.recipientName || order.formData.calendarName || '').trim();
  var calendarLabel = name ? name + "'s Garden Calendar" : 'your Garden Calendar';

  var message = [
    'Great news \u2014 your calendar preview is ready!',
    '',
    'We\u2019ve generated a PDF proof of ' + calendarLabel + '. Please take a look and, when you\u2019re happy, click the link below to approve it for print:',
    '',
    approveUrl,
    '',
    'You can also view the PDF directly here:',
    pdfUrl,
    '',
    'Once approved, your calendar goes straight to print and Gelato will send you tracking information.',
    '',
    'Want to change something \u2014 the plants, special dates, the cover message? Use this link (it\u2019s pre-filled with your current choices). Submitting it creates a new proof and replaces this one:',
    intake.buildFormUrl(ORDER_FORM_URL, order.formData, { includePlants: true }),
    '',
    'If anything looks wrong, just reply to this message and we\u2019ll sort it out.',
    '',
    'Warm wishes,',
    'The Garden Calendar team',
  ].join('\n');

  await messaging.sendEtsyMessage(receiptId, buyerUserId, message);
  console.log('[queue] Etsy preview message sent for order', order.id, 'receipt', receiptId);
}

// ── Internal: proof-first generation failed → send the full form link ────────
async function _sendIntakeFailure(order) {
  var receiptId   = order.formData && order.formData.etsy_receipt_id;
  var receiptMap  = store.getMeta('etsyReceiptMap') || {};
  var buyerUserId = receiptId && receiptMap[String(receiptId)];
  if (!buyerUserId) {
    console.warn('[queue] Cannot send intake fallback for', order.id, '— no buyer_user_id for receipt', receiptId);
    return;
  }
  var link = intake.buildFormUrl(ORDER_FORM_URL, order.formData, { includePlants: false });
  var message = [
    'Hi again \u2014 we hit a snag creating your calendar proof automatically, and we\u2019re sorry about that.',
    '',
    'Could you fill in this short form instead (it takes about 2 minutes and is already filled in with your details)?',
    link,
    '',
    'We\u2019ll send your proof as soon as it\u2019s submitted. Nothing goes to print until you approve it.',
    '',
    'Warm wishes,',
    'The Garden Calendar team',
  ].join('\n');
  await messaging.sendEtsyMessage(receiptId, buyerUserId, message);
  console.log('[queue] Intake fallback form link sent for order', order.id, 'receipt', receiptId);
}

// ── Public: recover jobs interrupted by a restart/deploy ─────────────────────
// The queue is in memory, but every order is saved to disk the moment it is created.
// Call once at startup: any order still 'queued' or 'processing' was cut off, so put it
// back on the queue. Guards:
//   • only orders created in the last RECOVER_MAX_AGE_MS (old test orders are ignored)
//   • superseded orders are skipped
//   • an order already tried MAX_ATTEMPTS times is marked failed instead of looping
//     (and proof-first orders get the fallback form link, as for any failed generation)
// The buyer preview message is only sent after a job reaches 'done', so re-running an
// interrupted job cannot send a duplicate message.
var RECOVER_MAX_AGE_MS = 24 * 60 * 60 * 1000;
var MAX_ATTEMPTS       = 2;

function recoverInterrupted(now) {
  now = now || Date.now();
  var pending = store.listByStatus(['queued', 'processing']);
  var recovered = 0;
  pending.forEach(function(o) {
    if (o.superseded) return;
    if (o.id === _currentJobId || _queue.indexOf(o.id) !== -1) return;
    var age = now - Date.parse(o.createdAt);
    if (!(age <= RECOVER_MAX_AGE_MS)) {
      console.log('[queue] Recovery: skipping stale order', o.id, '(' + o.status + ', created ' + o.createdAt + ')');
      return;
    }
    if ((o.attempts || 0) >= MAX_ATTEMPTS) {
      console.error('[queue] Recovery: order', o.id, 'already attempted', o.attempts, 'times — marking failed');
      store.updateOrder(o.id, { status: 'failed', error: 'Interrupted ' + o.attempts + ' times by restarts; not retried' });
      if (o.formData && o.formData.source === 'etsy-intake') {
        _sendIntakeFailure(o).catch(function(e) {
          console.error('[queue] Intake fallback message failed for', o.id, ':', e.message);
        });
      }
      return;
    }
    console.log('[queue] Recovery: re-queueing interrupted order', o.id, '(was ' + o.status + ', attempts ' + (o.attempts || 0) + ')');
    enqueue(o.id);
    recovered++;
  });
  console.log('[queue] Recovery complete — ' + recovered + ' order(s) re-queued');
  return recovered;
}

module.exports = {
  enqueue:             enqueue,
  getStatus:           getStatus,
  recoverInterrupted:  recoverInterrupted,
};
