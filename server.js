const express = require('express');
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

// Handle CORS — must come before all routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ALLOWED_ORIGIN === '*' || origin === ALLOWED_ORIGIN;
  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (ALLOWED_ORIGIN === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// Body limit raised to 64kb — calendar prompts with full climate context can reach ~8-10kb
app.use(express.json({ limit: '64kb' }));

// ── In-memory rate stores (reset on restart — fine for demo scale) ────────────
const ipHourly  = {}; // { ip: { count, resetAt } }
const ipDailyGen = {}; // { ip: { count, date } }
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
  if (!rec || rec.date !== today) return true;
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
  const totalLen = body.messages.reduce((s, m) => {
    const c = m.content;
    return s + (typeof c === 'string' ? c.length : JSON.stringify(c).length);
  }, 0);
  if (totalLen > 40_000) return 'Prompt too long';
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
    res.setHeader('X-Accel-Buffering', 'no');
    const reader = anthropicRes.body.getReader();
    const keepalive = setInterval(() => {
      try { res.write(new TextEncoder().encode(": keepalive\n\n")); } catch {}
    }, 15000);
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
        }
      } finally {
        clearInterval(keepalive);
        res.end();
      }
    };
    pump().catch(e => { console.error('Stream pump error:', e.message); clearInterval(keepalive); res.end(); });
  } else {
    const data = await anthropicRes.json();
    res.json(data);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// ── Geocoding ─────────────────────────────────────────────────────────────────
// Nominatim (OpenStreetMap) — city string → lat, lng, country_code
// Source: OpenStreetMap contributors · ODbL  https://www.openstreetmap.org/copyright
//
// Why proxied: Nominatim's usage policy requires a meaningful User-Agent identifying
// the application. Browsers strip/anonymise User-Agent on cross-origin requests,
// so the call must come from the server where we can set it explicitly.
//
// Rate limit: 1 req/sec. Frontend caches in localStorage by city string, so this
// route is only hit on first lookup per city per browser.
app.get('/api/geocode', async (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string' || q.trim().length === 0 || q.length > 200) {
    return res.status(400).json({ error: 'invalid_query', message: 'q parameter required (max 200 chars)' });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.trim())}&format=json&addressdetails=1&limit=1`;
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'GardenCalendar/1.0 contact@yourdomain.com',
        'Accept': 'application/json',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'nominatim_error', message: `Nominatim returned ${upstream.status}` });
    }
    const data = await upstream.json();
    const r = data[0];
    if (!r) {
      return res.status(404).json({ error: 'not_found', message: `Location not found: "${q}"` });
    }
    res.json({
      lat:          parseFloat(r.lat),
      lng:          parseFloat(r.lon),
      country_code: r.address?.country_code || null,  // lowercase ISO 3166-1 alpha-2, e.g. "gb", "fr"
      display_name: r.display_name,
    });
  } catch (e) {
    console.error('Nominatim fetch error:', e.message);
    res.status(502).json({ error: 'nominatim_unreachable', message: 'Could not reach geocoding service' });
  }
});

// ── Botanical data routes ─────────────────────────────────────────────────────

// GBIF species match — resolves common/scientific name to accepted taxon
// Source: Global Biodiversity Information Facility (GBIF) · CC BY 4.0
// Underpins: Plants of the World Online / WCVP names backbone (Royal Botanic Gardens, Kew)
app.get('/api/species', async (req, res) => {
  const name = req.query.name;
  if (!name || typeof name !== 'string' || name.length > 120) {
    return res.status(400).json({ error: 'invalid_query' });
  }
  try {
    const upstream = await fetch(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&verbose=false`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'gbif_error' });
    const data = await upstream.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'gbif_unreachable', message: e.message });
  }
});

// GBIF occurrence count — regional suitability evidence for a given plant + location
// Returns count of recorded occurrences within a bounding box
// Source: GBIF occurrence data · CC BY 4.0 / CC0 (per dataset)
app.get('/api/occurrences', async (req, res) => {
  const { name, lat, lng, radius } = req.query;
  if (!name || !lat || !lng) return res.status(400).json({ error: 'missing_params' });
  const r = Math.min(parseFloat(radius) || 0.5, 2.0);
  const latMin = (parseFloat(lat) - r).toFixed(3);
  const latMax = (parseFloat(lat) + r).toFixed(3);
  const lngMin = (parseFloat(lng) - r).toFixed(3);
  const lngMax = (parseFloat(lng) + r).toFixed(3);
  try {
    const upstream = await fetch(
      `https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(name)}&decimalLatitude=${latMin},${latMax}&decimalLongitude=${lngMin},${lngMax}&limit=1`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) }
    );
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'gbif_error' });
    const data = await upstream.json();
    res.json({ count: data.count || 0, name });
  } catch (e) {
    res.status(502).json({ error: 'gbif_unreachable', message: e.message });
  }
});

// Trefle plant hardiness & bloom period data
// Source: Trefle.io botanical API · CC BY · trefle.io
// Token stored as TREFLE_TOKEN env var on Render — never exposed to frontend.
// Returns minimum_temperature (°C), bloom_months, fruit_months for a given scientific name.
// NOTE: Trefle growth attribute data (min_temp, bloom_months) is currently unpopulated
// for most species — verified March 2026. Route retained for future use; frontend does
// not call it until data quality improves. Token not required for startup.
const TREFLE_TOKEN = process.env.TREFLE_TOKEN || '';
const TREFLE_URL   = 'https://trefle.io/api/v1/plants/search';

app.get('/api/trefle', async (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string' || q.length > 120) {
    return res.status(400).json({ error: 'invalid_query' });
  }
  if (!TREFLE_TOKEN) {
    return res.status(503).json({ error: 'trefle_not_configured', message: 'TREFLE_TOKEN not set' });
  }
  try {
    const upstream = await fetch(
      `${TREFLE_URL}?q=${encodeURIComponent(q)}&token=${TREFLE_TOKEN}`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) }
    );
    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: 'trefle_error', ...body });
    }
    const data = await upstream.json();
    const plant = data?.data?.[0];
    if (!plant) return res.json({ found: false, q });
    const species = plant.main_species || plant;
    res.json({
      found:           true,
      q,
      scientific_name: plant.scientific_name,
      common_name:     plant.common_name,
      min_temp_c:      species?.growth?.minimum_temperature?.deg_c ?? null,
      bloom_months:    species?.growth?.bloom_months  ?? null,
      fruit_months:    species?.growth?.fruit_months  ?? null,
    });
  } catch (e) {
    res.status(502).json({ error: 'trefle_unreachable', message: e.message });
  }
});

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
