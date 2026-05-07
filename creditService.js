// creditService.js (CommonJS)
// Sprint B2 — credit enforcement API.
//
// Routes:
//   POST   /api/credits/use        — validate token, check allowance, decrement counter
//   GET    /api/credits/:token     — return plan + remaining counts (frontend on load)
//   DELETE /api/credits/:token     — GDPR erasure (self-service or admin)
//   GET    /api/credits            — list all token records (admin only)

var express    = require('express');
var tokenStore = require('./tokenStore.js');

var router = express.Router();

// ── Admin auth helper ─────────────────────────────────────────────────────────
function isAdmin(req) {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET;
}

// ── POST /api/credits/use ─────────────────────────────────────────────────────
// Called by the frontend before any credit-consuming action.
// Body: { token: string, action: 'gen' | 'week' | 'inspo_trial' }
// Returns:
//   200 { ok: true, remaining: { gen, week }, plan, expiresAt }
//   402 { ok: false, reason: 'credit_exhausted' | 'token_expired' | ... }
//   400 { error: 'missing_fields' }
router.post('/api/credits/use', function(req, res) {
  var token  = req.body && req.body.token;
  var action = req.body && req.body.action;

  if (!token || !action) {
    return res.status(400).json({ error: 'missing_fields', message: 'token and action required' });
  }

  var allowed = ['gen', 'week', 'inspo_trial'];
  if (!allowed.includes(action)) {
    return res.status(400).json({ error: 'invalid_action', message: 'action must be gen, week, or inspo_trial' });
  }

  // Check credit before decrementing
  var check = tokenStore.checkCredit(token, action);
  if (!check.ok) {
    var status = check.reason === 'credit_exhausted' || check.reason === 'token_expired' ? 402 : 404;
    return res.status(status).json({ ok: false, reason: check.reason });
  }

  // Decrement
  var updated = tokenStore.useCredit(token, action);
  if (!updated) {
    return res.status(500).json({ ok: false, reason: 'write_failed' });
  }

  var limits = tokenStore.PLAN_LIMITS[updated.plan] || {};

  res.json({
    ok:        true,
    action:    action,
    remaining: {
      gen:  (limits.genMax  || 0) - updated.genUsed,
      week: (limits.weekMax || 0) - updated.weekUsed,
    },
    plan:      updated.plan,
    expiresAt: updated.expiresAt,
  });
});

// ── GET /api/credits/:token ───────────────────────────────────────────────────
// Called by the frontend on load to establish tier and remaining credits.
// Returns:
//   200 { ok: true, plan, remaining, expiresAt, inspoTrialUsed, inspoTrialAvailable }
//   404 { ok: false, reason: 'token_not_found' }
//   402 { ok: false, reason: 'token_expired' }
router.get('/api/credits/:token', function(req, res) {
  var token  = req.params.token;
  var record = tokenStore.getToken(token);

  if (!record) {
    return res.status(404).json({ ok: false, reason: 'token_not_found' });
  }

  if (new Date(record.expiresAt) < new Date()) {
    return res.status(402).json({ ok: false, reason: 'token_expired', expiresAt: record.expiresAt });
  }

  var limits = tokenStore.PLAN_LIMITS[record.plan] || {};

  // inspo trial is available to print-tier users who have used >= 3 weekly credits
  // and haven't used their trial yet
  var inspoTrialAvailable = record.plan === 'print'
    && record.weekUsed >= 3
    && !record.inspoTrialUsed;

  res.json({
    ok:   true,
    plan: record.plan,
    remaining: {
      gen:  (limits.genMax  || 0) - record.genUsed,
      week: (limits.weekMax || 0) - record.weekUsed,
    },
    inspoTrialUsed:      record.inspoTrialUsed,
    inspoTrialAvailable: inspoTrialAvailable,
    expiresAt:           record.expiresAt,
    createdAt:           record.createdAt,
  });
});

// ── DELETE /api/credits/:token ────────────────────────────────────────────────
// GDPR erasure — removes the token record entirely.
// Self-service: any caller with the token can delete it.
// Returns:
//   200 { ok: true, deleted: true }
//   404 { ok: false, reason: 'token_not_found' }
router.delete('/api/credits/:token', function(req, res) {
  var token   = req.params.token;
  var deleted = tokenStore.deleteToken(token);

  if (!deleted) {
    return res.status(404).json({ ok: false, reason: 'token_not_found' });
  }

  res.json({ ok: true, deleted: true });
});

// ── GET /api/credits — admin list ─────────────────────────────────────────────
// Returns all token records. Admin only.
router.get('/api/credits', function(req, res) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'unauthorised' });
  }

  var records = tokenStore.listTokens();
  res.json({
    count:   records.length,
    tokens:  records,
  });
});

module.exports = router;

