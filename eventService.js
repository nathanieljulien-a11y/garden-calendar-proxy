// eventService.js (CommonJS)
// Sprint A2 — event instrumentation log
//
// Appends pseudonymous events to /data/events.log (JSONL — one JSON object per line).
// No IP addresses, no email, no personal data stored.
//
// Routes:
//   POST /api/events          — append event (public, fire-and-forget)
//   GET  /api/events          — return raw log lines (admin)
//   GET  /api/events/summary  — aggregated counts by event type + ref (admin)

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router = express.Router();

// ── Path resolution — mirrors orderStore.js and pdfService.js pattern ─────────
const DISK = process.env.RENDER_DISK_PATH || __dirname;
const LOG_PATH = path.join(DISK, 'events.log');

// ── Allowed event names — whitelist to prevent log pollution ─────────────────
const ALLOWED_EVENTS = new Set([
  'page_load',
  'calendar_generated',
  'this_week_generated',
  'inspo_requested',
  'insights_generated',
  'pdf_exported',
  'ics_exported',
  'credit_exhausted',
  'upsell_shown',
  'upsell_clicked',
  'token_validated',
]);

// ── Admin auth helper ─────────────────────────────────────────────────────────
function isAdmin(req) {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET;
}

// ── Append one JSONL line ─────────────────────────────────────────────────────
function appendEvent(fields) {
  try {
    const line = JSON.stringify({ ...fields, ts: new Date().toISOString() }) + '\n';
    fs.appendFileSync(LOG_PATH, line, 'utf8');
  } catch (e) {
    console.error('[events] Write error:', e.message);
  }
}

// ── POST /api/events ──────────────────────────────────────────────────────────
// Fire-and-forget from frontend — always returns 200 so client never surfaces errors.
// Body: { event: string, ...fields }
// Fields recorded: event, ref, tier, city, plantCount, creditsRemaining, source etc.
// Fields never recorded: ip, email, name, any personal data.
router.post('/api/events', (req, res) => {
  const { event, ...rest } = req.body || {};

  if (!event || !ALLOWED_EVENTS.has(event)) {
    // Silently accept but don't write unknown events — keeps log clean
    return res.sendStatus(200);
  }

  // Strip any fields that could contain personal data
  const { ip: _ip, email: _email, name: _name, ...safeRest } = rest;

  appendEvent({ event, ...safeRest });
  res.sendStatus(200);
});

// ── GET /api/events ───────────────────────────────────────────────────────────
// Returns raw JSONL log as a JSON array. Admin only.
router.get('/api/events', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorised' });

  try {
    if (!fs.existsSync(LOG_PATH)) return res.json({ lines: [], count: 0 });
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    const lines = raw
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
    res.json({ lines, count: lines.length });
  } catch (e) {
    console.error('[events] Read error:', e.message);
    res.status(500).json({ error: 'read_failed' });
  }
});

// ── GET /api/events/summary ───────────────────────────────────────────────────
// Returns aggregated counts. Admin only.
// Output shape:
// {
//   totalEvents: 142,
//   byEvent: { page_load: 80, calendar_generated: 22, ... },
//   byRef:   { print: 30, direct: 112, ... },
//   byTier:  { free: 95, print: 30, subscriber: 17, ... },
//   byCityTop10: { "London, UK": 14, ... },
//   recentDays: { "2026-05-06": 42, "2026-05-05": 38, ... }  // last 14 days
// }
router.get('/api/events/summary', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorised' });

  try {
    if (!fs.existsSync(LOG_PATH)) {
      return res.json({ totalEvents: 0, byEvent: {}, byRef: {}, byTier: {}, byCityTop10: {}, recentDays: {} });
    }

    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    const lines = raw
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);

    const byEvent = {};
    const byRef   = {};
    const byTier  = {};
    const cityCount = {};
    const dayCount  = {};

    for (const e of lines) {
      // by event
      byEvent[e.event] = (byEvent[e.event] || 0) + 1;

      // by ref
      const ref = e.ref || 'direct';
      byRef[ref] = (byRef[ref] || 0) + 1;

      // by tier
      if (e.tier) byTier[e.tier] = (byTier[e.tier] || 0) + 1;

      // by city (top 10)
      if (e.city) cityCount[e.city] = (cityCount[e.city] || 0) + 1;

      // by day (last 14)
      if (e.ts) {
        const day = e.ts.slice(0, 10);
        dayCount[day] = (dayCount[day] || 0) + 1;
      }
    }

    // Top 10 cities
    const byCityTop10 = Object.fromEntries(
      Object.entries(cityCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    );

    // Last 14 days only, sorted descending
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const recentDays = Object.fromEntries(
      Object.entries(dayCount)
        .filter(([day]) => new Date(day) >= cutoff)
        .sort((a, b) => b[0].localeCompare(a[0]))
    );

    res.json({
      totalEvents: lines.length,
      byEvent,
      byRef,
      byTier,
      byCityTop10,
      recentDays,
    });
  } catch (e) {
    console.error('[events] Summary error:', e.message);
    res.status(500).json({ error: 'summary_failed' });
  }
});

module.exports = router;
