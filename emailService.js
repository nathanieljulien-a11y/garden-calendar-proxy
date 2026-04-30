// emailService.js (CommonJS)
// Sends transactional emails via Resend.com.
//
// Environment variables required:
//   RESEND_API_KEY    — from resend.com dashboard
//   EMAIL_FROM        — verified sender address, e.g. calendars@yourdomain.com
//   FRONTEND_URL      — used to build the approve link if not already built by caller

var https = require('https');

var RESEND_API_KEY = process.env.RESEND_API_KEY || '';
var EMAIL_FROM     = process.env.EMAIL_FROM     || 'Garden Calendar <calendars@example.com>';

// ── Send preview email ────────────────────────────────────────────────────────
// opts: { to, name, pdfUrl, approveUrl, orderId }
async function sendPreviewEmail(opts) {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping preview email for', opts.orderId);
    return;
  }

  var recipientName = opts.name || 'your recipient';
  var subject       = 'Your Garden Calendar preview is ready';

  var html = [
    '<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#2C1A0A;max-width:580px;margin:0 auto;padding:24px;">',
    '<h2 style="font-size:22px;font-weight:normal;color:#2C1A0A;border-bottom:1px solid #C8A96A;padding-bottom:8px;">Your Garden Calendar preview</h2>',
    '<p style="font-size:15px;line-height:1.7;">Hello,</p>',
    '<p style="font-size:15px;line-height:1.7;">',
    '  Your personalised Garden Calendar for <strong>' + _esc(recipientName) + '</strong> is ready to preview.',
    '</p>',
    '<p style="margin:24px 0;">',
    '  <a href="' + _esc(opts.pdfUrl) + '" style="display:inline-block;padding:12px 24px;background:#2C1A0A;color:#F0EBE0;text-decoration:none;font-size:15px;border-radius:4px;">',
    '    View your calendar PDF',
    '  </a>',
    '</p>',
    '<p style="font-size:15px;line-height:1.7;">',
    '  If everything looks good, click the button below to approve it for printing.',
    '  Once approved, it will be sent to print and dispatched to the address you provided.',
    '</p>',
    '<p style="margin:24px 0;">',
    '  <a href="' + _esc(opts.approveUrl) + '" style="display:inline-block;padding:12px 24px;background:#5A7A32;color:#ffffff;text-decoration:none;font-size:15px;border-radius:4px;">',
    '    Approve and send to print &rarr;',
    '  </a>',
    '</p>',
    '<p style="font-size:13px;color:#7A5C2A;line-height:1.6;">',
    '  If you need any changes, just reply to this email before approving.',
    '  Once approved, the order is sent straight to print and cannot be amended.',
    '</p>',
    '<hr style="border:none;border-top:1px solid #E0D8C8;margin:24px 0;"/>',
    '<p style="font-size:11px;color:#999;line-height:1.5;">',
    '  Order reference: ' + _esc(opts.orderId),
    '</p>',
    '</body></html>',
  ].join('\n');

  var text = [
    'Your Garden Calendar preview is ready.',
    '',
    'Hello,',
    '',
    'Your personalised Garden Calendar for ' + recipientName + ' is ready to preview.',
    '',
    'View your PDF: ' + opts.pdfUrl,
    '',
    'If everything looks good, click this link to approve it for printing:',
    opts.approveUrl,
    '',
    'If you need any changes, just reply to this email before approving.',
    'Once approved, the order cannot be amended.',
    '',
    'Order reference: ' + opts.orderId,
  ].join('\n');

  await _resendSend({
    from:    EMAIL_FROM,
    to:      [opts.to],
    subject: subject,
    html:    html,
    text:    text,
  });

  console.log('[email] Preview email sent to', opts.to, 'for order', opts.orderId);
}

// ── Internal: Resend API call ─────────────────────────────────────────────────
function _resendSend(payload) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(payload);
    var req  = https.request({
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error('Resend HTTP ' + res.statusCode + ': ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, function() { req.destroy(new Error('Resend timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Internal: escape HTML ─────────────────────────────────────────────────────
function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { sendPreviewEmail: sendPreviewEmail };
