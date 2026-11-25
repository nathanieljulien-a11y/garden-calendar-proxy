// buyerNotify.js (CommonJS)
// One place that "sends a message to the Etsy buyer".
//
// Etsy's public API has no endpoint for messaging buyers (the call in etsyMessaging.js
// returns 404 — see OPERATIONS.md), so by default the message is emailed to the operator
// ready to paste into Etsy (Shop Manager → Orders → the order → Message). Set
// ETSY_MESSAGING_API=1 to try the API first (it falls back to the email if it fails).
//
// deliver() never throws: a notification problem must not fail an order or make the
// Etsy cron retry the same receipt every 5 minutes.

var messaging = require('./etsyMessaging.js');
var operator  = require('./operatorNotify.js');

// Replaceable in tests
var _deps = { messaging: messaging, operator: operator };

// opts: { receiptId, buyerUserId, message, kind }
// Returns { via: 'etsy' | 'operator-email' | 'logged' }
async function deliver(opts) {
  var receiptId = opts.receiptId;
  var kind      = opts.kind || 'message';

  if (process.env.ETSY_MESSAGING_API === '1' && opts.buyerUserId) {
    try {
      await _deps.messaging.sendEtsyMessage(receiptId, opts.buyerUserId, opts.message);
      return { via: 'etsy' };
    } catch (e) {
      console.error('[notify] Etsy messaging API failed for receipt', receiptId, '—', e.message, '— emailing operator instead');
    }
  }

  var subject = '[Garden Calendar] Send to Etsy buyer — order ' + receiptId + ' (' + kind + ')';
  var text = [
    'Please send the message below to the buyer of Etsy order #' + receiptId + '.',
    'Etsy → Shop Manager → Orders → open the order → Message.',
    '',
    '----------------------------------------',
    opts.message,
    '----------------------------------------',
  ].join('\n');

  var r = await _deps.operator.notify(subject, text);
  if (r.sent) return { via: 'operator-email' };

  // Last resort: it is in the Render logs so it is not lost
  console.warn('[notify] Could not email the operator. Message for receipt', receiptId, '(' + kind + '):\n' + opts.message);
  return { via: 'logged' };
}

module.exports = { deliver: deliver, _deps: _deps };
