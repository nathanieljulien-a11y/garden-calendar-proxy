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

var store = require('./orderStore.js');
var r2    = require('./r2.js');

// Lazy-require pdfService internals to avoid circular deps at startup.
// pdfService.js exports buildFullHTML and generatePDF — we call them directly
// rather than going via the Express route so we get the Buffer back.
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
// Adds an order ID to the queue and kicks off processing if idle.
// Returns { position } — 0 means it will start immediately.
function enqueue(orderId) {
  _queue.push(orderId);
  var position = _queue.length; // 1-based: position 1 = next up
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
// Called after every enqueue and after every job completes.
// Starts the next job if idle and the queue is non-empty.
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

  store.updateOrder(orderId, { status: 'processing' });

  try {
    var apiKey = process.env.ANTHROPIC_API_KEY || '';

    // buildFullHTML and generatePDF are the internal functions from pdfService.js.
    // We require them here — pdfService.js must export them (see patch note below).
    var pdf = _getPdf();
    var html   = await pdf.buildFullHTML(order.formData, apiKey, { approved: false });
    var pdfBuf = await pdf.generatePDF(html);

    // Upload to R2
    var filename  = orderId + '.pdf';
    var publicUrl = await r2.uploadToR2(pdfBuf, filename);

    store.updateOrder(orderId, { status: 'done', pdfUrl: publicUrl });
    console.log('[queue] Job done:', orderId, '→', publicUrl);

    // Fire email notification (non-blocking — failure doesn't fail the job)
    _sendPreviewEmail(order, publicUrl).catch(function(e) {
      console.error('[queue] Preview email failed for', orderId, ':', e.message);
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
  _tick(); // start next job if any
}

// ── Internal: trigger preview email ──────────────────────────────────────────
// Lazy-requires emailService to avoid circular deps.
var _emailService = null;
async function _sendPreviewEmail(order, pdfUrl) {
  if (!_emailService) {
    try { _emailService = require('./emailService.js'); } catch(e) {
      console.warn('[queue] emailService not available:', e.message);
      return;
    }
  }
  var approveUrl = (process.env.FRONTEND_URL || 'https://garden-calendar-frontend.vercel.app')
    + '/approve?token=' + order.token;
  await _emailService.sendPreviewEmail({
    to:         order.formData.email,
    name:       order.formData.recipientName || order.formData.calendarName || 'your recipient',
    pdfUrl:     pdfUrl,
    approveUrl: approveUrl,
    orderId:    order.id,
  });
}

module.exports = {
  enqueue:   enqueue,
  getStatus: getStatus,
};
