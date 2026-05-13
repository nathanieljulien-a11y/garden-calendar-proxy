// orderService.js (CommonJS)
// Express router — order intake, status polling, and approval.
//
// Routes:
//   POST /orders          — accept form submission, enqueue PDF job
//   GET  /orders/:id      — poll job status (frontend polls this)
//   POST /orders/:id/approve — customer approves, triggers Gelato draft
//   GET  /orders          — list all orders (admin, requires ADMIN_SECRET header)

var express     = require('express');
var store       = require('./orderStore.js');
var tokenStore  = require('./tokenStore.js');
var queue       = require('./queueService.js');
var products    = require('./products/index.js');

var router  = express.Router();

var ADMIN_SECRET  = process.env.ADMIN_SECRET || '';
var GELATO_API_KEY = process.env.GELATO_API_KEY || '';
var FRONTEND_URL  = (process.env.FRONTEND_URL || 'https://garden-calendar-frontend.vercel.app').replace(/\/$/, '');

// Fallback SKU for the UK/Europe A3 product (until garden-wall-calendar.js
// exports its own gelatoSku field — see NA-1 sprint notes).
var PRODUCT_UID_FALLBACK = 'wall-calendars_pf_a3_pt_250-gsm-coated-silk_cl_4-4_bt_wire-with-hook-top_ver';

// ── Validation ────────────────────────────────────────────────────────────────
function validateFormData(body) {
  var errors = [];
  // product is required on every order (ADR-009) — no default
  if (!body.product || typeof body.product !== 'string')
    errors.push('product is required');
  if (body.climate && typeof body.climate !== 'string')
    errors.push('climate must be a string if provided');
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
  // Validate product is known (catches typos early, before the job hits the queue)
  if (body.product) {
    try { products.getProduct(body.product); }
    catch(e) { errors.push(e.message); }
  }
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

  console.log('[orders] New order:', order.id, '— product:', req.body.product, '— queue position:', enqueued.position);

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

  // Generate print token for wall calendar QR code (idempotent — skip if already exists)
  if (!tokenStore.getTokenBySourceRef(order.id)) {
    var printToken = tokenStore.createPrintToken(order.id);
    store.updateOrder(order.id, { printToken: printToken.token });
  }

  // Regenerate clean PDF without proof watermark, upload to R2, then submit to Gelato
  var cleanPdfUrl;
  try {
    var pdf    = require('./pdfService.js');
    var r2     = require('./r2.js');
    var cleanBuilt  = await pdf.buildFullHTMLFromState(order.id, order.formData, { approved: true });
    var cleanPdfBuf = await pdf.generatePDF(cleanBuilt);
    var cleanFilename = order.id + '-final.pdf';
    cleanPdfUrl = await r2.uploadToR2(cleanPdfBuf, cleanFilename);
    store.updateOrder(order.id, { finalPdfUrl: cleanPdfUrl });
    pdf.deleteSharedState(order.id);
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

// ── Approve page HTML helper ──────────────────────────────────────────────────
var APPROVE_CSS = [
  '* { box-sizing: border-box; margin: 0; padding: 0; }',
  'body { font-family: Georgia, serif; background: #f7f4ef; color: #2c2c2c; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }',
  '.card { background: #fff; border: 1px solid #ddd6c8; border-radius: 6px; max-width: 520px; width: 100%; padding: 2.5rem 2.5rem 2rem; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.07); }',
  '.brand { font-family: Georgia, serif; font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase; color: #9a7c5a; margin-bottom: 1.8rem; }',
  '.icon { font-size: 2.5rem; margin-bottom: 1rem; }',
  'h1 { font-size: 1.4rem; font-weight: normal; color: #2c2c2c; margin-bottom: 0.75rem; line-height: 1.4; }',
  'p { font-size: 0.95rem; color: #666; line-height: 1.6; margin-bottom: 0.75rem; }',
  '.note { font-size: 0.85rem; color: #9a7c5a; margin-top: 0.5rem; }',
  '.etsy-link { display: inline-block; margin-top: 1.25rem; font-size: 0.85rem; color: #9a7c5a; text-decoration: none; border-bottom: 1px solid #ddd6c8; padding-bottom: 1px; }',
  '.etsy-link:hover { color: #2c2c2c; }',
].join('\n');

var ETSY_SHOP_DISPLAY = process.env.ETSY_SHOP_URL || 'etsy.com/shop/ClockwatcherAlmanacs';

function _approvePage(icon, title, body, noteHtml) {
  return '<!DOCTYPE html><html lang="en"><head>'
    + '<meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"/>'
    + '<title>Clockwatcher Almanacs</title>'
    + '<style>' + APPROVE_CSS + '</style>'
    + '</head><body><div class="card">'
    + '<div class="brand">Clockwatcher Almanacs</div>'
    + '<div class="icon">' + icon + '</div>'
    + '<h1>' + title + '</h1>'
    + '<p>' + body + '</p>'
    + (noteHtml ? '<p class="note">' + noteHtml + '</p>' : '')
    + '<a class="etsy-link" href="https://' + ETSY_SHOP_DISPLAY + '" target="_blank">' + ETSY_SHOP_DISPLAY + '</a>'
    + '</div></body></html>';
}

// ── GET /orders/:id/approve?token=xxx — direct link from email ───────────────
router.get('/orders/:id/approve', async function(req, res) {
  var order = store.getOrder(req.params.id);
  if (!order)
    return res.status(404).send(_approvePage('\u{1F33F}', 'Order not found', "We couldn't find this order. If you think this is an error, please get in touch via Etsy."));
  if (!req.query.token || req.query.token !== order.token)
    return res.status(403).send(_approvePage('\u{1F512}', 'Link not valid', 'This approval link is invalid or has expired. Please use the link from your original preview email.'));
  if (order.status !== 'done')
    return res.status(409).send(_approvePage('\u23F3', "Your preview isn't ready yet", "We're still generating your calendar — this usually takes about 3 minutes. Please try the link again shortly."));
  if (order.approved)
    return res.status(200).send(_approvePage('\u2705', 'Already approved', "This calendar has already been approved and sent to print. You'll receive a shipping notification from Gelato when it's on its way."));
  if (!order.pdfUrl)
    return res.status(409).send(_approvePage('\u26A0\uFE0F', 'Something went wrong', "We couldn't find the PDF for this order. Please contact us via Etsy and we'll sort it out."));

  store.updateOrder(order.id, { approved: true, approvedAt: new Date().toISOString() });

  // Generate print token for wall calendar QR code (idempotent — skip if already exists)
  if (!tokenStore.getTokenBySourceRef(order.id)) {
    var printToken = tokenStore.createPrintToken(order.id);
    store.updateOrder(order.id, { printToken: printToken.token });
  }

  var cleanPdfUrl;
  try {
    var pdf = require('./pdfService.js');
    var r2  = require('./r2.js');
    var cleanBuilt  = await pdf.buildFullHTMLFromState(order.id, order.formData, { approved: true });
    var cleanPdfBuf = await pdf.generatePDF(cleanBuilt);
    cleanPdfUrl = await r2.uploadToR2(cleanPdfBuf, order.id + '-final.pdf');
    store.updateOrder(order.id, { finalPdfUrl: cleanPdfUrl });
    pdf.deleteSharedState(order.id);
    console.log('[orders] Clean PDF generated:', cleanPdfUrl);
  } catch(e) {
    console.error('[orders] Clean PDF generation failed:', e.message);
    return res.status(500).send(_approvePage('\u26A0\uFE0F', 'Something went wrong', "We couldn't generate your print-ready file. Please contact us via Etsy and we'll resolve this promptly."));
  }

  try {
    var gelatoResult = await _submitToGelato(order, cleanPdfUrl);
    store.updateOrder(order.id, {
      gelatoOrderId: gelatoResult.id,
      gelatoDashboardUrl: 'https://dashboard.gelato.com/orders/' + gelatoResult.id,
    });
    console.log('[orders] Gelato draft created:', gelatoResult.id, 'for order:', order.id);
    var recipientName = (order.formData && (order.formData.recipientName || order.formData.calendarName)) || '';
    var calendarLabel = recipientName ? recipientName + "'s Garden Calendar" : 'your Garden Calendar';
    return res.status(200).send(_approvePage(
      '\u{1F331}',
      'Your calendar is approved',
      'Thank you \u2014 ' + calendarLabel + ' has been sent to print. Gelato will email you with tracking information once it\u2019s on its way.',
      "Don't forget to scan the QR code inside your calendar to access your digital garden planner."
    ));
  } catch(e) {
    console.error('[orders] Gelato submission failed for', order.id, ':', e.message);
    store.updateOrder(order.id, { gelatoError: e.message });
    return res.status(502).send(_approvePage('\u26A0\uFE0F', 'Approved \u2014 but a hiccup sending to print', "Your approval has been saved, but we hit an issue submitting to Gelato. We'll sort this out and be in touch via Etsy shortly."));
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

function _submitToGelato(order, pdfUrl) {
  return new Promise(function(resolve, reject) {
    if (!GELATO_API_KEY) {
      reject(new Error('GELATO_API_KEY not configured'));
      return;
    }

    // Resolve Gelato SKU from the product module; fall back to UK/Europe A3 constant
    var productSku = PRODUCT_UID_FALLBACK;
    try {
      var product = products.getProduct(order.formData && order.formData.product);
      if (product.gelatoSku) productSku = product.gelatoSku;
    } catch(e) {
      console.warn('[orders] Could not resolve product SKU for order', order.id, '— using fallback:', e.message);
    }

    var addr = order.formData.shippingAddress || {};
    var payload = JSON.stringify({
      orderType:           'draft',
      orderReferenceId:    order.id,
      customerReferenceId: order.id,
      currency:            'GBP',
      items: [{
        itemReferenceId: order.id + '-cal',
        productUid:      productSku,
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
