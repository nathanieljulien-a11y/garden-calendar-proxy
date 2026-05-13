// queueService.js (CommonJS)
// In-memory job queue for PDF generation.
// Processes one job at a time to avoid OOM crashes from concurrent Chromium instances.
// Jobs are persisted in orderStore.js so their status survives a status check even
// if the server restarts mid-queue (the job will re-queue on next submission).
//
// Usage:
//   var queue = require('./queueService.js');
//   queue.enqueue(orderId);         // add a job — call after createOrder()
//   queue.getStatus()               // { busy, queueLength, currentJobId }

var store     = require('./orderStore.js');
var r2        = require('./r2.js');
var messaging = require('./etsyMessaging.js');

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

  // product is required on every order (ADR-009) — hard error if missing
  if (!order.formData || !order.formData.product) {
    console.error('[queue] Order', orderId, 'is missing required product field — cannot process');
    store.updateOrder(orderId, { status: 'failed', error: 'Missing required product field (ADR-009)' });
    _finish();
    return;
  }

  store.updateOrder(orderId, { status: 'processing' });

  try {
    var apiKey = process.env.ANTHROPIC_API_KEY || '';

    var pdf    = _getPdf();
    var html   = await pdf.buildFullHTML(Object.assign({ _id: order.id }, order.formData), apiKey, { approved: false });
    var pdfBuf = await pdf.generatePDF(html);

    var filename  = orderId + '.pdf';
    var publicUrl = await r2.uploadToR2(pdfBuf, filename);

    store.updateOrder(orderId, { status: 'done', pdfUrl: publicUrl });
    console.log('[queue] Job done:', orderId, '→', publicUrl);

    // Notify buyer via Etsy Conversations (non-blocking — failure doesn't fail the job)
    _sendEtsyPreview(order, publicUrl).catch(function(e) {
      console.error('[queue] Etsy preview message failed for', orderId, ':', e.message);
    });

  } catch(e) {
    console.error('[queue] Job failed:', orderId, e.message);
    store.updateOrder(orderId, { status: 'failed', error: e.message });
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
    'If anything looks wrong, just reply to this message and we\u2019ll sort it out.',
    '',
    'Warm wishes,',
    'The Garden Calendar team',
  ].join('\n');

  await messaging.sendEtsyMessage(receiptId, buyerUserId, message);
  console.log('[queue] Etsy preview message sent for order', order.id, 'receipt', receiptId);
}

module.exports = {
  enqueue:   enqueue,
  getStatus: getStatus,
};
