// gelatoService.js (CommonJS)
// POST /submit-to-gelato  — creates a draft order in Gelato API
// POST /upload-to-r2      — uploads a PDF buffer to Cloudflare R2 and returns public URL
//
// Environment variables required:
//   GELATO_API_KEY         — from Gelato dashboard → Settings → API Access
//   CLOUDFLARE_ACCOUNT_ID  — from Cloudflare dashboard sidebar
//   R2_ACCESS_KEY_ID       — from R2 API token creation
//   R2_SECRET_ACCESS_KEY   — from R2 API token creation
//   R2_BUCKET_NAME         — e.g. garden-calendar-pdfs
//   R2_PUBLIC_URL          — e.g. https://pub-xxxxxxxx.r2.dev

var express = require('express');
var https   = require('https');
var crypto  = require('crypto');

var router  = express.Router();

var GELATO_API_KEY    = process.env.GELATO_API_KEY    || '';
var ACCOUNT_ID        = process.env.CLOUDFLARE_ACCOUNT_ID || '';
var R2_KEY_ID         = process.env.R2_ACCESS_KEY_ID  || '';
var R2_SECRET         = process.env.R2_SECRET_ACCESS_KEY || '';
var R2_BUCKET         = process.env.R2_BUCKET_NAME    || 'garden-calendar-pdfs';
var R2_PUBLIC_URL     = (process.env.R2_PUBLIC_URL    || '').replace(/\/$/, '');

var PRODUCT_UID = 'wall-calendars_pf_a3_pt_250-gsm-coated-silk_cl_4-4_bt_wire-with-hook-top_ver';

// ── Validation ────────────────────────────────────────────────────────────────
function validateSubmitBody(body) {
  var errors = [];
  if (!body.pdfUrl || typeof body.pdfUrl !== 'string')
    errors.push('pdfUrl required (public URL to the generated PDF)');
  if (!body.orderReferenceId || typeof body.orderReferenceId !== 'string')
    errors.push('orderReferenceId required (your internal order ID)');
  if (!body.customerReferenceId || typeof body.customerReferenceId !== 'string')
    errors.push('customerReferenceId required (your internal customer ID)');
  if (!body.shippingAddress)
    errors.push('shippingAddress required');
  else {
    var a = body.shippingAddress;
    if (!a.firstName)    errors.push('shippingAddress.firstName required');
    if (!a.lastName)     errors.push('shippingAddress.lastName required');
    if (!a.addressLine1) errors.push('shippingAddress.addressLine1 required');
    if (!a.city)         errors.push('shippingAddress.city required');
    if (!a.postCode)     errors.push('shippingAddress.postCode required');
    if (!a.country)      errors.push('shippingAddress.country required (2-letter ISO code e.g. GB)');
    if (!a.email)        errors.push('shippingAddress.email required');
  }
  // orderType defaults to 'draft' — only 'draft' or 'order' allowed
  if (body.orderType && body.orderType !== 'draft' && body.orderType !== 'order')
    errors.push('orderType must be "draft" or "order" (default: draft)');
  return errors;
}

// ── Gelato API call ───────────────────────────────────────────────────────────
function callGelatoApi(payload) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(payload);
    var req  = https.request({
      hostname: 'order.gelatoapis.com',
      path:     '/v4/orders',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'X-API-KEY':      GELATO_API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var d = JSON.parse(data);
          resolve({ status: res.statusCode, body: d });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, function() { req.destroy(new Error('Gelato API timeout')); });
    req.write(body);
    req.end();
  });
}

// ── AWS Signature V4 for R2 (R2 uses S3-compatible API) ──────────────────────
function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}
function getSigningKey(secret, date, region, service) {
  var kDate    = sign('AWS4' + secret, date);
  var kRegion  = sign(kDate, region);
  var kService = sign(kRegion, service);
  return sign(kService, 'aws4_request');
}

async function uploadToR2(pdfBuffer, filename) {
  if (!ACCOUNT_ID || !R2_KEY_ID || !R2_SECRET) {
    throw new Error('R2 credentials not configured (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }

  var now        = new Date();
  var dateStr    = now.toISOString().slice(0,10).replace(/-/g,'');   // YYYYMMDD
  var amzDate    = now.toISOString().replace(/[:-]/g,'').slice(0,15) + 'Z'; // yyyymmddTHHMMSSZ
  var region     = 'auto';
  var service    = 's3';
  var host       = ACCOUNT_ID + '.r2.cloudflarestorage.com';
  var path       = '/' + R2_BUCKET + '/' + filename;
  var contentType= 'application/pdf';
  var bodyHash   = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  // Canonical request
  var canonHeaders = 'content-type:' + contentType + '\n'
    + 'host:' + host + '\n'
    + 'x-amz-content-sha256:' + bodyHash + '\n'
    + 'x-amz-date:' + amzDate + '\n';
  var signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  var canonRequest = ['PUT', path, '', canonHeaders, signedHeaders, bodyHash].join('\n');

  // String to sign
  var credScope  = dateStr + '/' + region + '/' + service + '/aws4_request';
  var strToSign  = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credScope + '\n'
    + crypto.createHash('sha256').update(canonRequest).digest('hex');

  // Signature
  var signingKey = getSigningKey(R2_SECRET, dateStr, region, service);
  var signature  = crypto.createHmac('sha256', signingKey).update(strToSign).digest('hex');

  var authHeader = 'AWS4-HMAC-SHA256 Credential=' + R2_KEY_ID + '/' + credScope
    + ', SignedHeaders=' + signedHeaders
    + ', Signature=' + signature;

  return new Promise(function(resolve, reject) {
    var req = https.request({
      hostname: host,
      path:     path,
      method:   'PUT',
      headers:  {
        'Content-Type':          contentType,
        'Content-Length':        pdfBuffer.length,
        'x-amz-content-sha256': bodyHash,
        'x-amz-date':           amzDate,
        'Authorization':         authHeader,
      },
    }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
          var publicUrl = R2_PUBLIC_URL + '/' + filename;
          resolve(publicUrl);
        } else {
          reject(new Error('R2 upload failed: HTTP ' + res.statusCode + ' — ' + data));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, function() { req.destroy(new Error('R2 upload timeout')); });
    req.write(pdfBuffer);
    req.end();
  });
}

// ── Route: POST /submit-to-gelato ─────────────────────────────────────────────
// Body: { pdfUrl, orderReferenceId, customerReferenceId, shippingAddress, orderType?, currency? }
router.post('/submit-to-gelato', async function(req, res) {
  if (!GELATO_API_KEY) {
    return res.status(503).json({ error: 'GELATO_API_KEY not configured' });
  }

  var errors = validateSubmitBody(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  var body       = req.body;
  var orderType  = body.orderType || 'draft'; // safe default
  var currency   = body.currency  || 'GBP';
  var addr       = body.shippingAddress;

  var payload = {
    orderType:           orderType,
    orderReferenceId:    body.orderReferenceId,
    customerReferenceId: body.customerReferenceId,
    currency:            currency,
    items: [{
      itemReferenceId: body.orderReferenceId + '-cal',
      productUid:      PRODUCT_UID,
      files: [{
        type: 'default',
        url:  body.pdfUrl,
      }],
      quantity: 1,
    }],
    shipmentMethodUid: body.shipmentMethodUid || 'standard',
    shippingAddress: {
      firstName:    addr.firstName,
      lastName:     addr.lastName,
      companyName:  addr.companyName  || '',
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      city:         addr.city,
      state:        addr.state        || '',
      postCode:     addr.postCode,
      country:      addr.country,
      email:        addr.email,
      phone:        addr.phone        || '',
    },
  };

  console.log('[Gelato] Submitting ' + orderType + ' order: ' + body.orderReferenceId);
  console.log('[Gelato] PDF URL: ' + body.pdfUrl);
  console.log('[Gelato] Ship to: ' + addr.firstName + ' ' + addr.lastName + ', ' + addr.country);

  try {
    var result = await callGelatoApi(payload);
    console.log('[Gelato] Response: HTTP ' + result.status
      + (result.body.id ? ' — order ID: ' + result.body.id : ''));

    if (result.status === 200 || result.status === 201) {
      return res.json({
        success:         true,
        gelatoOrderId:   result.body.id,
        fulfillmentStatus: result.body.fulfillmentStatus,
        orderType:       orderType,
        dashboardUrl:    'https://dashboard.gelato.com/orders/' + result.body.id,
      });
    } else {
      console.error('[Gelato] Error response:', JSON.stringify(result.body));
      return res.status(result.status).json({
        error:   'Gelato API error',
        details: result.body,
      });
    }
  } catch(e) {
    console.error('[Gelato] Request failed:', e.message);
    return res.status(502).json({ error: 'Gelato API unreachable', detail: e.message });
  }
});

// ── Route: POST /upload-to-r2 ─────────────────────────────────────────────────
// Accepts a PDF as binary body, uploads to R2, returns { url }
// For automated use — manual upload via Cloudflare dashboard is simpler for testing
router.post('/upload-to-r2', async function(req, res) {
  if (!R2_PUBLIC_URL) {
    return res.status(503).json({ error: 'R2 not configured' });
  }

  // Expect raw PDF binary body — use express.raw() middleware
  var buf = req.body;
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 100) {
    return res.status(400).json({ error: 'Request body must be a PDF binary' });
  }

  var filename = 'gc-' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.pdf';
  console.log('[R2] Uploading: ' + filename + ' (' + Math.round(buf.length/1024) + 'KB)');

  try {
    var url = await uploadToR2(buf, filename);
    console.log('[R2] Uploaded: ' + url);
    return res.json({ success: true, url: url, filename: filename });
  } catch(e) {
    console.error('[R2] Upload failed:', e.message);
    return res.status(502).json({ error: 'R2 upload failed', detail: e.message });
  }
});

module.exports = router;
