// orderService.js (CommonJS)
// Express router — order intake, status polling, and approval.
//
// Routes:
//   POST /orders          — accept form submission, enqueue PDF job
//   GET  /orders/:id      — poll job status (frontend polls this)
//   POST /orders/:id/approve — customer approves, triggers Gelato draft
//   GET  /orders          — list all orders (admin, requires ADMIN_SECRET header)

var express = require('express');
var store   = require('./orderStore.js');
var queue   = require('./queueService.js');

var router  = express.Router();

var ADMIN_SECRET  = process.env.ADMIN_SECRET || '';
var GELATO_API_KEY = process.env.GELATO_API_KEY || '';
var FRONTEND_URL  = (process.env.FRONTEND_URL || 'https://garden-calendar-frontend.vercel.app').replace(/\/$/, '');

// ── Validation ────────────────────────────────────────────────────────────────
function validateFormData(body) {
  var errors = [];
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@'))
    errors.push('email required');
  if (!body.climate || typeof body.climate !== 'string')
    errors.push('climate required');
  if (!body.city || typeof body.city !== 'string')
    errors.push('city required');
  if (!Array.isArray(body.plants) || body.plants.length !== 12)
    errors.push('plants must be an array of 12 plant names');
  if (body.startMonth == null || body.startMonth < 1 || body.startMonth > 12)
    errors.push('startMonth must be 1–12');
  if (body.keyDates && body.keyDates.length > 20)
    errors.push('maximum 20 key dates');
  if (body.holidays && body.holidays.length > 6)
    errors.push('maximum 6 holiday periods');
  return errors;
}

// ── POST /orders — submit form ────────────────────────────────────────────────
router.post('/orders', function(req, res) {
  var errors = validateFormData(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  var order    = store.createOrder(req.body);
  var enqueued = queue.enqueue(order.id);
  var status   = queue.getStatus();

  console.log('[orders] New order:', order.id, '— queue position:', enqueued.position);

  // position 1 means it starts immediately (no job running ahead of it)
  var message = enqueued.position === 1 && !status.busy
    ? 'Your calendar is being generated — this takes about 3 minutes.'
    : 'Your order is in the queue (position ' + enqueued.position + '). We\'ll email you when your preview is ready.';

  res.status(202).json({
    orderId:  order.id,
    status:   'queued',
    position: enqueued.position,
    message:  message,
    // Client polls this URL to check progress
    statusUrl: FRONTEND_URL + '/order-status?id=' + order.id,
  });
});

// ── GET /orders/:id — poll status ─────────────────────────────────────────────
router.get('/orders/:id', function(req, res) {
  var order = store.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  // Never expose the approval token in a status poll — only send it in the email
  var safe = {
    id:        order.id,
    status:    order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    message:   _statusMessage(order),
    pdfUrl:    order.status === 'done' ? order.pdfUrl : null,
    error:     order.status === 'failed' ? order.error : null,
  };
  res.json(safe);
});

// ── POST /orders/:id/approve — customer approves via token ───────────────────
// Called when customer clicks the approve button in their preview email.
// Body: { token }
router.post('/orders/:id/approve', async function(req, res) {
  var order = store.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (!req.body.token || req.body.token !== order.token) {
    return res.status(403).json({ error: 'Invalid approval token' });
  }
  if (order.status !== 'done') {
    return res.status(409).json({ error: 'PDF not ready yet — status: ' + order.status });
  }
  if (order.approved) {
    return res.status(409).json({ error: 'Order already approved' });
  }
  if (!order.pdfUrl) {
    return res.status(409).json({ error: 'No PDF URL on record — cannot submit to Gelato' });
  }

  store.updateOrder(order.id, { approved: true, approvedAt: new Date().toISOString() });

  // Regenerate clean PDF without proof watermark, upload to R2, then submit to Gelato
  var cleanPdfUrl;
  try {
    var pdf    = require('./pdfService.js');
    var r2     = require('./r2.js');
    var apiKey = process.env.ANTHROPIC_API_KEY || '';
    var cleanHtml   = await pdf.buildFullHTML(order.formData, apiKey, { approved: true });
    var cleanPdfBuf = await pdf.generatePDF(cleanHtml);
    var cleanFilename = order.id + '-final.pdf';
    cleanPdfUrl = await r2.uploadToR2(cleanPdfBuf, cleanFilename);
    store.updateOrder(order.id, { finalPdfUrl: cleanPdfUrl });
    console.log('[orders] Clean PDF generated:', cleanPdfUrl);
  } catch(e) {
    console.error('[orders] Clean PDF generation failed:', e.message);
    return res.status(500).json({ error: 'Could not generate clean PDF for print', detail: e.message });
  }

  // Submit to Gelato as a draft order
  try {
    var gelatoResult = await _submitToGelato(order, cleanPdfUrl);
    store.updateOrder(order.id, {
      gelatoOrderId: gelatoResult.id,
      gelatoDashboardUrl: 'https://dashboard.gelato.com/orders/' + gelatoResult.id,
    });
    console.log('[orders] Gelato draft created:', gelatoResult.id, 'for order:', order.id);
    res.json({
      success: true,
      message: 'Your calendar has been approved and sent to print. You\'ll receive a shipping notification from Gelato.',
      gelatoOrderId: gelatoResult.id,
    });
  } catch(e) {
    console.error('[orders] Gelato submission failed for', order.id, ':', e.message);
    store.updateOrder(order.id, { gelatoError: e.message });
    res.status(502).json({ error: 'Approval saved but Gelato submission failed — we\'ll retry shortly.', detail: e.message });
  }
});

// ── GET /orders/:id/approve?token=xxx — direct link from email ───────────────
// Lets the customer approve via a plain URL (no approve page needed yet).
router.get('/orders/:id/approve', async function(req, res) {
  var order = store.getOrder(req.params.id);
  if (!order) return res.status(404).send('<p>Order not found.</p>');
  if (!req.query.token || req.query.token !== order.token)
    return res.status(403).send('<p>Invalid or expired approval link.</p>');
  if (order.status !== 'done')
    return res.status(409).send('<p>Your PDF is not ready yet. Please wait and try again.</p>');
  if (order.approved)
    return res.status(200).send('<p>This order has already been approved. Your calendar is on its way!</p>');
  if (!order.pdfUrl)
    return res.status(409).send('<p>No PDF on record — please contact us.</p>');

  store.updateOrder(order.id, { approved: true, approvedAt: new Date().toISOString() });

  var cleanPdfUrl;
  try {
    var pdf = require('./pdfService.js');
    var r2  = require('./r2.js');
    var cleanHtml   = await pdf.buildFullHTML(order.formData, process.env.ANTHROPIC_API_KEY || '', { approved: true });
    var cleanPdfBuf = await pdf.generatePDF(cleanHtml);
    cleanPdfUrl = await r2.uploadToR2(cleanPdfBuf, order.id + '-final.pdf');
    store.updateOrder(order.id, { finalPdfUrl: cleanPdfUrl });
    console.log('[orders] Clean PDF generated:', cleanPdfUrl);
  } catch(e) {
    console.error('[orders] Clean PDF generation failed:', e.message);
    return res.status(500).send('<p>Could not generate your print-ready PDF. Please contact us.</p>');
  }

  try {
    var gelatoResult = await _submitToGelato(order, cleanPdfUrl);
    store.updateOrder(order.id, {
      gelatoOrderId: gelatoResult.id,
      gelatoDashboardUrl: 'https://dashboard.gelato.com/orders/' + gelatoResult.id,
    });
    console.log('[orders] Gelato draft created:', gelatoResult.id, 'for order:', order.id);
    res.status(200).send('<p>Your calendar has been approved and sent to print. Thank you!</p>');
  } catch(e) {
    console.error('[orders] Gelato submission failed for', order.id, ':', e.message);
    store.updateOrder(order.id, { gelatoError: e.message });
    res.status(502).send('<p>Approval saved but we hit an issue sending to print — we will be in touch shortly.</p>');
  }
});

// ── GET /orders — admin list ──────────────────────────────────────────────────
router.get('/orders', function(req, res) {
  if (!ADMIN_SECRET || req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  res.json(store.listOrders());
});

// ── Internal: Gelato draft order ──────────────────────────────────────────────
var https = require('https');
var PRODUCT_UID = 'wall-calendars_pf_a3_pt_250-gsm-coated-silk_cl_4-4_bt_wire-with-hook-top_ver';

function _submitToGelato(order, pdfUrl) {
  return new Promise(function(resolve, reject) {
    if (!GELATO_API_KEY) {
      reject(new Error('GELATO_API_KEY not configured'));
      return;
    }
    var addr = order.formData.shippingAddress || {};
    var payload = JSON.stringify({
      orderType:           'draft',
      orderReferenceId:    order.id,
      customerReferenceId: order.formData.email || order.id,
      currency:            'GBP',
      items: [{
        itemReferenceId: order.id + '-cal',
        productUid:      PRODUCT_UID,
        files: [{ type: 'default', url: pdfUrl }],
        quantity: 1,
      }],
      shipmentMethodUid: 'standard',
      shippingAddress: {
        firstName:    addr.firstName    || '',
        lastName:     addr.lastName     || '',
        companyName:  addr.companyName  || '',
        addressLine1: addr.addressLine1 || '',
        addressLine2: addr.addressLine2 || '',
        city:         addr.city         || '',
        state:        addr.state        || '',
        postCode:     addr.postCode     || '',
        country:      addr.country      || 'GB',
        email:        order.formData.email || '',
        phone:        addr.phone        || '',
      },
    });

    var req = https.request({
      hostname: 'order.gelatoapis.com',
      path:     '/v4/orders',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'X-API-KEY':      GELATO_API_KEY,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, function(res2) {
      var data = '';
      res2.on('data', function(c) { data += c; });
      res2.on('end', function() {
        try {
          var d = JSON.parse(data);
          if (res2.statusCode === 200 || res2.statusCode === 201) {
            resolve(d);
          } else {
            reject(new Error('Gelato HTTP ' + res2.statusCode + ': ' + JSON.stringify(d).slice(0, 200)));
          }
        } catch(e) {
          reject(new Error('Gelato response parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, function() { req.destroy(new Error('Gelato timeout')); });
    req.write(payload);
    req.end();
  });
}

// ── Internal: status messages ─────────────────────────────────────────────────
function _statusMessage(order) {
  switch(order.status) {
    case 'queued':     return 'Your order is queued — we\'ll email you when your preview is ready.';
    case 'processing': return 'Generating your calendar — this takes about 3 minutes. Check back shortly.';
    case 'done':       return order.approved
      ? 'Approved and sent to print.'
      : 'Your preview is ready — check your email for the approve link.';
    case 'failed':     return 'Generation failed — we\'ll look into this and be in touch.';
    default:           return '';
  }
}

module.exports = router;
