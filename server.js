const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const app    = express();
const PORT   = process.env.PORT || 3001;
const API_KEY       = process.env.ANTHROPIC_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const DAILY_GEN_CAP = parseInt(process.env.DAILY_GEN_CAP  || '30');
const IP_HOURLY_CAP = parseInt(process.env.IP_HOURLY_CAP  || '10');
const IP_DAILY_GEN  = parseInt(process.env.IP_DAILY_GEN   || '3');
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-sonnet-4-20250514';

if (!API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: ALLOWED_ORIGIN === '*' ? '*' : ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '8kb' }));

// ── In-memory rate stores (reset on restart — fine for demo scale) ────────────
// Per-IP hourly requests
const ipHourly = {}; // { ip: { count, resetAt } }
// Per-IP daily generations
const ipDailyGen = {}; // { ip: { count, date } }
// Global daily generations
let globalGen = { count: 0, date: todayStr() };

function todayStr() { return new Date().toISOString().slice(0, 10); }

function checkAndIncrementIpHourly(ip) {
  const now = Date.now();
  const rec = ipHourly[ip];
  if (!rec || now > rec.resetAt) {
    ipHourly[ip] = { count: 1, resetAt: now + 3600_000 };
    return true;
  }
  if (rec.count >= IP_HOURLY_CAP) return false;
  rec.count++;
  return true;
}

function checkIpDailyGen(ip) {
  const today = todayStr();
  const rec = ipDailyGen[ip];
  if (!rec || rec.date !== today) return true; // fresh day
  return rec.count < IP_DAILY_GEN;
}

function incrementIpDailyGen(ip) {
  const today = todayStr();
  if (!ipDailyGen[ip] || ipDailyGen[ip].date !== today) {
    ipDailyGen[ip] = { count: 0, date: today };
  }
  ipDailyGen[ip].count++;
}

function checkGlobalGen() {
  const today = todayStr();
  if (globalGen.date !== today) { globalGen = { count: 0, date: today }; }
  return globalGen.count < DAILY_GEN_CAP;
}

function incrementGlobalGen() {
  const today = todayStr();
  if (globalGen.date !== today) { globalGen = { count: 0, date: today }; }
  globalGen.count++;
}

function minutesUntilReset(ip) {
  const rec = ipHourly[ip];
  if (!rec) return 0;
  return Math.ceil((rec.resetAt - Date.now()) / 60_000);
}

// ── Input validation ──────────────────────────────────────────────────────────
function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Invalid body';
  if (body.model && body.model !== MODEL) return 'Invalid model';
  if (!Array.isArray(body.messages) || body.messages.length === 0) return 'Missing messages';
  // Check combined prompt length
  const totalLen = body.messages.reduce((s, m) => {
    const c = m.content;
    return s + (typeof c === 'string' ? c.length : JSON.stringify(c).length);
  }, 0);
  if (totalLen > 20_000) return 'Prompt too long';
  return null;
}

// ── Core proxy ────────────────────────────────────────────────────────────────
async function proxy(req, res, stream) {
  const err = validateBody(req.body);
  if (err) return res.status(400).json({ error: 'invalid_request', message: err });

  const { messages, max_tokens } = req.body;
  const cappedTokens = Math.min(parseInt(max_tokens) || 1000, 12000);

  let anthropicRes;
  try {
    anthropicRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: cappedTokens, messages, stream }),
    });
  } catch (e) {
    console.error('Anthropic fetch error:', e.message);
    return res.status(502).json({ error: 'upstream_error', message: 'Could not reach AI service' });
  }

  if (!anthropicRes.ok) {
    const body = await anthropicRes.json().catch(() => ({}));
    return res.status(anthropicRes.status).json(body);
  }

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering on Railway
    const reader = anthropicRes.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(value);
      }
    };
    pump().catch(e => { console.error('Stream pump error:', e.message); res.end(); });
  } else {
    const data = await anthropicRes.json();
    res.json(data);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ ok: true, globalGenToday: globalGen.count, cap: DAILY_GEN_CAP });
});

// Non-streaming: meta, inspiration, insights
app.post('/api/call', (req, res) => {
  const ip = req.ip;
  if (!checkAndIncrementIpHourly(ip)) {
    return res.status(429).json({
      error: 'rate_limit',
      message: `Too many requests. Try again in ${minutesUntilReset(ip)} minutes.`,
    });
  }
  proxy(req, res, false);
});

// Streaming: calendar generation — stricter limits
app.post('/api/stream', (req, res) => {
  const ip = req.ip;

  if (!checkAndIncrementIpHourly(ip)) {
    return res.status(429).json({
      error: 'rate_limit',
      message: `Too many requests. Try again in ${minutesUntilReset(ip)} minutes.`,
    });
  }
  if (!checkGlobalGen()) {
    return res.status(429).json({
      error: 'rate_limit',
      message: 'The demo has reached its daily limit. Please try again tomorrow.',
    });
  }
  if (!checkIpDailyGen(ip)) {
    return res.status(429).json({
      error: 'rate_limit',
      message: `You've used your ${IP_DAILY_GEN} free generations for today. Come back tomorrow!`,
    });
  }

  incrementGlobalGen();
  incrementIpDailyGen(ip);
  console.log(`[gen] ip=${ip} globalToday=${globalGen.count}/${DAILY_GEN_CAP}`);

  proxy(req, res, true);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Garden Calendar proxy running on port ${PORT}`);
  console.log(`Allowed origin: ${ALLOWED_ORIGIN}`);
  console.log(`Daily gen cap: ${DAILY_GEN_CAP}, IP daily gen: ${IP_DAILY_GEN}, IP hourly: ${IP_HOURLY_CAP}`);
});
