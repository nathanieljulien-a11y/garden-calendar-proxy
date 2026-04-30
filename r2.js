// r2.js (CommonJS)
// Shared Cloudflare R2 upload helper.
// Extracted from gelatoService.js so pdfService and orderService can reuse it.
//
// Environment variables required:
//   CLOUDFLARE_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET_NAME         (default: garden-calendar-pdfs)
//   R2_PUBLIC_URL          (e.g. https://pub-xxxxxxxx.r2.dev)

var https  = require('https');
var crypto = require('crypto');

var ACCOUNT_ID   = process.env.CLOUDFLARE_ACCOUNT_ID  || '';
var R2_KEY_ID    = process.env.R2_ACCESS_KEY_ID        || '';
var R2_SECRET    = process.env.R2_SECRET_ACCESS_KEY    || '';
var R2_BUCKET    = process.env.R2_BUCKET_NAME          || 'garden-calendar-pdfs';
var R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL         || '').replace(/\/$/, '');

// ── AWS Signature V4 (R2 uses S3-compatible API) ──────────────────────────────
function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSigningKey(secret, date, region, service) {
  var kDate    = sign('AWS4' + secret, date);
  var kRegion  = sign(kDate, region);
  var kService = sign(kRegion, service);
  return sign(kService, 'aws4_request');
}

// Upload a Buffer to R2. Returns the public URL string.
// filename: e.g. 'gc-1234567890-abc123.pdf'
async function uploadToR2(pdfBuffer, filename) {
  if (!ACCOUNT_ID || !R2_KEY_ID || !R2_SECRET) {
    throw new Error('R2 credentials not configured (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }
  if (!R2_PUBLIC_URL) {
    throw new Error('R2_PUBLIC_URL not configured');
  }

  var now         = new Date();
  var dateStr     = now.toISOString().slice(0, 10).replace(/-/g, '');          // YYYYMMDD
  var amzDate     = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'; // yyyymmddTHHMMSSZ
  var region      = 'auto';
  var service     = 's3';
  var host        = ACCOUNT_ID + '.r2.cloudflarestorage.com';
  var path        = '/' + R2_BUCKET + '/' + filename;
  var contentType = 'application/pdf';
  var bodyHash    = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  var canonHeaders = 'content-type:' + contentType + '\n'
    + 'host:' + host + '\n'
    + 'x-amz-content-sha256:' + bodyHash + '\n'
    + 'x-amz-date:' + amzDate + '\n';
  var signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  var canonRequest  = ['PUT', path, '', canonHeaders, signedHeaders, bodyHash].join('\n');

  var credScope  = dateStr + '/' + region + '/' + service + '/aws4_request';
  var strToSign  = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credScope + '\n'
    + crypto.createHash('sha256').update(canonRequest).digest('hex');

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
      headers: {
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
          resolve(R2_PUBLIC_URL + '/' + filename);
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

module.exports = { uploadToR2: uploadToR2 };
