// tokenStore.js (CommonJS)
// Sprint B1 — file-based token store for user credit tracking.
// Reads and writes tokens.json on the Render persistent disk.
// Falls back to project root for local development.
//
// Token shape:
// {
//   token:          string  — UUID v4 (used as the credential)
//   plan:           string  — 'print' | 'subscriber_6mo'
//   createdAt:      string  — ISO timestamp
//   expiresAt:      string  — ISO timestamp
//   genUsed:        number  — calendar generations consumed
//   weekUsed:       number  — this-week uses consumed
//   inspoTrialUsed: boolean — true once the free insights trial has been used (print tier only)
//   source:         string  — 'etsy_print' | 'stripe'
//   sourceRef:      string  — Etsy order ID or Stripe payment intent ID
// }
//
// No name, email, or personal data stored here.
// sourceRef links back to Etsy/Stripe where personal data already lives.

var fs     = require('fs');
var path   = require('path');
var crypto = require('crypto');

var STORE_PATH = process.env.RENDER_DISK_PATH
  ? path.join(process.env.RENDER_DISK_PATH, 'tokens.json')
  : path.join(__dirname, 'tokens.json');

// ── Plan allowances ───────────────────────────────────────────────────────────
var PLAN_LIMITS = {
  'print': {
    genMax:  5,
    weekMax: 25,
    months:  12,   // token valid for 12 months from creation
  },
  'subscriber_6mo': {
    genMax:  5,
    weekMax: 26,
    months:  6,
  },
};

// ── Internal helpers ──────────────────────────────────────────────────────────
function _read() {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    var raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('[tokenStore] Read error:', e.message);
    return {};
  }
}

function _write(tokens) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  } catch (e) {
    console.error('[tokenStore] Write error:', e.message);
  }
}

function _now() {
  return new Date().toISOString();
}

function _expiryDate(months) {
  var d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function _uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = crypto.randomBytes(1)[0] % 16;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
}

// ── Public API ────────────────────────────────────────────────────────────────

// Create a new print token for a wall calendar order.
// Returns the saved token object.
function createPrintToken(orderId) {
  var tokens = _read();
  var plan   = 'print';
  var limits = PLAN_LIMITS[plan];
  var token  = _uuid();
  var record = {
    token:          token,
    plan:           plan,
    createdAt:      _now(),
    expiresAt:      _expiryDate(limits.months),
    genUsed:        0,
    weekUsed:       0,
    inspoTrialUsed: false,
    source:         'etsy_print',
    sourceRef:      orderId,
  };
  tokens[token] = record;
  _write(tokens);
  console.log('[tokenStore] Created print token for order:', orderId);
  return record;
}

// Create a new subscriber token (called by Stripe webhook in Sprint C).
// Returns the saved token object.
function createSubscriberToken(stripePaymentIntentId) {
  var tokens = _read();
  var plan   = 'subscriber_6mo';
  var limits = PLAN_LIMITS[plan];
  var token  = _uuid();
  var record = {
    token:          token,
    plan:           plan,
    createdAt:      _now(),
    expiresAt:      _expiryDate(limits.months),
    genUsed:        0,
    weekUsed:       0,
    inspoTrialUsed: false,
    source:         'stripe',
    sourceRef:      stripePaymentIntentId,
  };
  tokens[token] = record;
  _write(tokens);
  console.log('[tokenStore] Created subscriber token for payment:', stripePaymentIntentId);
  return record;
}

// Get a token record by token string. Returns the record or null.
function getToken(token) {
  if (!token) return null;
  var tokens = _read();
  return tokens[token] || null;
}

// Get a token record by sourceRef (e.g. orderId or Stripe payment intent).
// Returns the first matching record or null.
function getTokenBySourceRef(sourceRef) {
  if (!sourceRef) return null;
  var tokens = _read();
  var found  = null;
  Object.keys(tokens).forEach(function(t) {
    if (tokens[t].sourceRef === sourceRef) found = tokens[t];
  });
  return found;
}

// Check whether a token is valid and has credits remaining for an action.
// action: 'gen' | 'week' | 'inspo_trial'
// Returns { ok: true, remaining } or { ok: false, reason }
function checkCredit(token, action) {
  var record = getToken(token);
  if (!record) return { ok: false, reason: 'token_not_found' };

  var now = new Date();
  if (new Date(record.expiresAt) < now) return { ok: false, reason: 'token_expired' };

  var limits = PLAN_LIMITS[record.plan];
  if (!limits) return { ok: false, reason: 'unknown_plan' };

  if (action === 'gen') {
    if (record.genUsed >= limits.genMax) return { ok: false, reason: 'credit_exhausted' };
  } else if (action === 'week') {
    if (record.weekUsed >= limits.weekMax) return { ok: false, reason: 'credit_exhausted' };
  } else if (action === 'inspo_trial') {
    if (record.inspoTrialUsed) return { ok: false, reason: 'credit_exhausted' };
  } else {
    return { ok: false, reason: 'unknown_action' };
  }

  return {
    ok: true,
    remaining: {
      gen:  limits.genMax  - record.genUsed,
      week: limits.weekMax - record.weekUsed,
    },
  };
}

// Decrement a credit for an action. Returns updated record or null.
// Caller should call checkCredit() first.
function useCredit(token, action) {
  var tokens = _read();
  var record = tokens[token];
  if (!record) return null;

  if (action === 'gen')          record.genUsed  += 1;
  else if (action === 'week')    record.weekUsed += 1;
  else if (action === 'inspo_trial') record.inspoTrialUsed = true;

  _write(tokens);
  console.log('[tokenStore] Credit used:', action, 'for token:', token.slice(0, 8) + '...');
  return record;
}

// Delete a token record (GDPR erasure). Returns true if found and deleted.
function deleteToken(token) {
  var tokens = _read();
  if (!tokens[token]) return false;
  delete tokens[token];
  _write(tokens);
  console.log('[tokenStore] Deleted token:', token.slice(0, 8) + '...');
  return true;
}

// List all token records (admin use only).
function listTokens() {
  var tokens = _read();
  return Object.values(tokens);
}

module.exports = {
  createPrintToken:       createPrintToken,
  createSubscriberToken:  createSubscriberToken,
  getToken:               getToken,
  getTokenBySourceRef:    getTokenBySourceRef,
  checkCredit:            checkCredit,
  useCredit:              useCredit,
  deleteToken:            deleteToken,
  listTokens:             listTokens,
  PLAN_LIMITS:            PLAN_LIMITS,
};

