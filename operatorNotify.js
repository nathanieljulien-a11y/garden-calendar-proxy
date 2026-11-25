// operatorNotify.js (CommonJS)
// Emails the operator (the shop owner) via Resend. Never throws — a failed email must
// never break an order. Used when something needs a human: a buyer message to paste into
// Etsy (the Etsy API cannot send messages), or an order that needs a look in Gelato.
//
// Environment variables:
//   RESEND_API_KEY   — already set for the contact form
//   EMAIL_FROM       — verified sender address (already set)
//   OPERATOR_EMAIL   — where these emails go (falls back to CONTACT_EMAIL, then EMAIL_FROM)

var https = require('https');

function _resendPost(payload, apiKey) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(payload);
    var req  = https.request({
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers: {
        'Authorization':  'Bearer ' + apiKey,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        if (res.statusCode === 200 || res.statusCode === 201) resolve(data);
        else reject(new Error('Resend HTTP ' + res.statusCode + ': ' + data.slice(0, 200)));
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, function() { req.destroy(new Error('Resend timeout')); });
    req.write(body);
    req.end();
  });
}

// Replaceable in tests
var _transport = _resendPost;

// Returns { sent: boolean }. Reads env at call time.
async function notify(subject, text) {
  var apiKey = process.env.RESEND_API_KEY || '';
  var from   = process.env.EMAIL_FROM || '';
  var to     = process.env.OPERATOR_EMAIL || process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || '';
  if (!apiKey || !from || !to) {
    console.warn('[operator] Not emailed (RESEND_API_KEY / EMAIL_FROM / OPERATOR_EMAIL missing):', subject);
    return { sent: false };
  }
  try {
    await _transport({ from: from, to: [to], subject: subject, text: text }, apiKey);
    console.log('[operator] Emailed operator:', subject);
    return { sent: true };
  } catch (e) {
    console.error('[operator] Email failed:', subject, '—', e.message);
    return { sent: false };
  }
}

module.exports = {
  notify: notify,
  _setTransport: function(fn) { _transport = fn || _resendPost; },
};
