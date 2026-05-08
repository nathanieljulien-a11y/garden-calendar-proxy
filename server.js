const express = require('express');
const helmet  = require('helmet');
const pdfRouter = require('./pdfService.js');   // ← add this line
const gelatoRouter = require('./gelatoService.js');
const tokenStore = require('./tokenStore.js');
const app    = express();
const PORT   = process.env.PORT || 3001;
const API_KEY       = process.env.ANTHROPIC_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
// Additional origins always allowed — order form is a separate Vercel app
const ALLOWED_ORIGINS = [
  ALLOWED_ORIGIN,
  'https://garden-calendar-order-form.vercel.app',
].filter(o => o && o !== '*');
const DAILY_GEN_CAP = parseInt(process.env.DAILY_GEN_CAP  || '30');
const IP_HOURLY_CAP = parseInt(process.env.IP_HOURLY_CAP  || '10');
const IP_DAILY_GEN  = parseInt(process.env.IP_DAILY_GEN   || '3');
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_STREAM  = 'claude-sonnet-4-20250514';  // 12-month generation — needs Sonnet quality
const MODEL_CALL    = 'claude-haiku-4-5-20251001'; // today tasks, insights, lenses — Haiku sufficient

if (!API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// Handle CORS — must come before all routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ALLOWED_ORIGIN === '*' || ALLOWED_ORIGINS.indexOf(origin) !== -1;
  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (ALLOWED_ORIGIN === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gc-token, x-admin-secret');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// Body limit raised to 64kb — calendar prompts with full climate context can reach ~8-10kb
// Stripe webhook route must receive raw body for signature verification — exclude it here
app.use((req, res, next) => {
  if (req.path === '/api/stripe/webhook') return next();
  express.json({ limit: '64kb' })(req, res, next);
});
//Raw body parser for /upload-to-r2 (PDF binary upload)
app.use('/upload-to-r2', express.raw({ type: 'application/pdf', limit: '30mb' }));
app.use(pdfRouter);
app.use(gelatoRouter);
app.use(require('./orderService.js'));
app.use(require('./eventService.js'));
app.use(require('./creditService.js'));
app.use('/api/stripe', require('./stripeService.js'));
app.use(require('./contactService.js'));

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

// ── Token validation for rate limit bypass ────────────────────────────────────
// Token holders (print / subscriber) bypass the per-IP daily gen cap.
// The hourly cap and global daily cap still apply to everyone.
function checkTokenValid(req) {
  try {
    const token = req.headers['x-gc-token'];
    if (!token) return false;
    const check = tokenStore.checkCredit(token, 'gen');
    // Token is valid (not expired, not exhausted) — bypass IP daily gen limit
    return check.ok === true;
  } catch { return false; }
}

// ── Input validation ──────────────────────────────────────────────────────────
function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Invalid body';
  if (body.model && body.model !== MODEL_STREAM && body.model !== MODEL_CALL) return 'Invalid model';
  if (!Array.isArray(body.messages) || body.messages.length === 0) return 'Missing messages';
  // Check combined prompt length — raised to 40k chars to accommodate climate context
  const totalLen = body.messages.reduce((s, m) => {
    const c = m.content;
    return s + (typeof c === 'string' ? c.length : JSON.stringify(c).length);
  }, 0);
  if (totalLen > 40_000) return 'Prompt too long';
  return null;
}

// ── Core proxy ────────────────────────────────────────────────────────────────
async function proxy(req, res, stream, model) {
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
      body: JSON.stringify({ model, max_tokens: cappedTokens, messages, stream }),
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
    // Send a keepalive comment every 15s to prevent Railway/proxy idle timeouts
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
// ── Geocoding ────────────────────────────────────────────────────────────────
// Photon (komoot) — city string → lat, lng, country_code
// Source: OpenStreetMap contributors · ODbL  https://www.openstreetmap.org/copyright
// Photon is an open-source geocoder built on OpenStreetMap data, hosted by komoot.
// It has no rate limit for reasonable use and requires no API key.
// Same OSM data and ODbL licence as Nominatim — attribution is identical.
//
// Why proxied: keeps the data source abstracted server-side so we can swap
// geocoders without touching the frontend, and avoids any CORS issues.
//
// Fallback: if Photon fails, we retry once with Nominatim.
app.get('/api/geocode', async (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string' || q.trim().length === 0 || q.length > 200) {
    return res.status(400).json({ error: 'invalid_query', message: 'q parameter required (max 200 chars)' });
  }

  // Attempt 1: Photon (no rate limit)
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q.trim())}&limit=1&lang=en`;
    const upstream = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (upstream.ok) {
      const data = await upstream.json();
      const f = data.features?.[0];
      if (f) {
        const [lng, lat] = f.geometry.coordinates;
        const props = f.properties || {};
        // Photon returns country_code as ISO 3166-1 alpha-2 uppercase — normalise to lowercase
        const country_code = (props.countrycode || props.country_code || '').toLowerCase() || null;
        return res.json({
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          country_code,
          display_name: [props.name, props.city, props.state, props.country].filter(Boolean).join(', '),
        });
      }
      // Photon returned no results — fall through to Nominatim
    }
  } catch (e) {
    console.warn('Photon geocode failed, trying Nominatim fallback:', e.message);
  }

  // Fallback: Nominatim (1 req/sec limit — only reached if Photon fails)
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
      // If Nominatim also rate-limits, return 404 (location not found) rather than
      // exposing the 429 to the client — the user should just try again
      if (upstream.status === 429) {
        return res.status(404).json({ error: 'not_found', message: `Location not found: "${q}" — please try again` });
      }
      return res.status(upstream.status).json({ error: 'nominatim_error', message: `Geocoding returned ${upstream.status}` });
    }
    const data = await upstream.json();
    const r = data[0];
    if (!r) {
      return res.status(404).json({ error: 'not_found', message: `Location not found: "${q}"` });
    }
    return res.json({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      country_code: r.address?.country_code || null,
      display_name: r.display_name,
    });
  } catch (e) {
    console.error('Nominatim fallback error:', e.message);
    return res.status(502).json({ error: 'geocode_unreachable', message: 'Could not reach geocoding service — please try again' });
  }
});

// ── Botanical data routes ────────────────────────────────────────────────────
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
  const r = Math.min(parseFloat(radius) || 0.5, 2.0); // cap at 2 degrees (~220km)
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

app.get('/api/health', (req, res) => {
  const ip = req.ip;
  const today = todayStr();
  const ipRec = ipDailyGen[ip];
  const ipUsed = (ipRec && ipRec.date === today) ? ipRec.count : 0;
  res.json({
    ok: true,
    globalGenToday: globalGen.count,
    cap: DAILY_GEN_CAP,
    ipGenToday: ipUsed,
    ipCap: IP_DAILY_GEN,
  });
});

// ── OpenFarm crop data ────────────────────────────────────────────────────────
// Source: OpenFarm · openfarm.cc · CC BY licence
app.get('/api/openfarm', async (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string' || q.length > 100) {
    return res.status(400).json({ error: 'invalid_query' });
  }
  try {
    const url = `https://openfarm.cc/api/v1/crops/?filter=${encodeURIComponent(q.trim())}`;
    const upstream = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'openfarm_error' });
    const data = await upstream.json();
    const crop = data.data?.[0];
    if (!crop) return res.json({ found: false });
    const attrs = crop.attributes || {};
    res.json({
      found: true,
      name: attrs.name,
      description: attrs.description,
      sowing_method: attrs.sowing_method,
      spread: attrs.spread,
      row_spacing: attrs.row_spacing,
      height: attrs.height,
    });
  } catch (e) {
    res.status(502).json({ error: 'openfarm_unreachable', message: e.message });
  }
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
  proxy(req, res, false, MODEL_CALL);
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
  // Token holders (print / subscriber) bypass the per-IP daily gen cap —
  // their credits are tracked server-side and enforced via /api/credits/use.
  const hasValidToken = checkTokenValid(req);
  if (!hasValidToken && !checkIpDailyGen(ip)) {
    return res.status(429).json({
      error: 'rate_limit',
      message: `You've used your ${IP_DAILY_GEN} free generations for today. Come back tomorrow!`,
    });
  }

  incrementGlobalGen();
  if (!hasValidToken) incrementIpDailyGen(ip);
  console.log(`[gen] ip=${ip} globalToday=${globalGen.count}/${DAILY_GEN_CAP} tokenHolder=${hasValidToken}`);

  proxy(req, res, true, MODEL_STREAM);
});

// ─── Add to server.js ────────────────────────────────────────────────────────
// Replaces the old GET /api/youtube endpoint.
// Two-step: ask Claude for a clean search query, then call YouTube.
//
// Requires env vars:
//   ANTHROPIC_API_KEY  — already set for the proxy
//   YOUTUBE_API_KEY    — YouTube Data API v3 key

const REGION_SUFFIX = {
  'uk':            'UK',
  'mediterranean': 'Mediterranean garden',
  'australasian':  'Australia garden',
  'north-american': '',
};

app.post('/api/youtube-search', async (req, res) => {
  const { task, region = 'uk' } = req.body || {};
  if (!task) return res.status(400).json({ message: 'Missing task' });

  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!ytKey) return res.status(503).json({ message: 'YouTube search not configured' });

  // ── Step 1: Ask Claude for a clean search query ────────────────────────────
  let query;
  try {
    const regionSuffix = REGION_SUFFIX[region] || '';
    const prompt = `You are helping find a YouTube gardening tutorial.

Garden task: "${task}"
Region: ${region}

Write a short YouTube search query (4-7 words) that will find the best instructional video for this specific task.
Rules:
- Start with "how to"
- Include the specific plant name (use the most common name, not scientific)
- Include the specific action (prune, divide, take cuttings, plant, etc.)
- End with "${regionSuffix || 'gardening'}" if it helps specificity
- Do NOT include measurements, timing details, or method specifics
- Return ONLY the search query, nothing else

Examples:
Task: "Hard prune roses to outward-facing bud 15cm above ground" → "how to hard prune roses UK"
Task: "Divide established heuchera clumps, replanting outer sections" → "how to divide heuchera UK"
Task: "Take softwood cuttings from pelargonium new growth, 10cm long" → "how to take softwood cuttings pelargonium UK"
Task: "Summer prune wisteria laterals back to 5 leaves" → "how to summer prune wisteria UK"`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',  // cheapest — this is a tiny task
        max_tokens: 30,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (claudeRes.ok) {
      const data = await claudeRes.json();
      query = data.content?.[0]?.text?.trim().replace(/^["']|["']$/g, '') || null;
    }
  } catch (e) {
    // Claude call failed — fall back to simple extraction below
  }

  // ── Fallback: simple verb + first noun extraction if Claude failed ──────────
  if (!query) {
    const regionSuffix = REGION_SUFFIX[region] || '';
    query = `how to ${task.split(',')[0].trim().toLowerCase()} ${regionSuffix}`.slice(0, 80);
  }

  // ── Step 2: Search YouTube ─────────────────────────────────────────────────
  try {
    const params = new URLSearchParams({
      part:             'snippet',
      q:                query,
      type:             'video',
      videoEmbeddable:  'true',
      maxResults:       5,
      relevanceLanguage:'en',
      key:              ytKey,
    });

    const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!ytRes.ok) {
      const err = await ytRes.json();
      return res.status(502).json({ message: err?.error?.message || `YouTube API ${ytRes.status}` });
    }

    const data = await ytRes.json();
    const results = (data.items || [])
      .filter(item => item.id?.videoId)
      .slice(0, 3)
      .map(item => ({
        videoId:      item.id.videoId,
        title:        item.snippet?.title || '',
        channel:      item.snippet?.channelTitle || '',
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url
                   || `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
      }));

    res.json({ query, results });
  } catch (e) {
    res.status(500).json({ message: e.message || 'YouTube search failed' });
  }
});


// ── Artwork list ──────────────────────────────────────────────────────────────
// Returns sorted array of plant names derived from filenames in artwork/ dir.
// Strips koehler_/edwards_/redoute_ prefixes and .jpg/.png extensions.
app.get('/api/artwork-list', (req, res) => {
  try {
    const artDir = require('path').join(__dirname, 'artwork');
    const files  = require('fs').readdirSync(artDir);
    const plants = files
      .filter(f => /\.(jpg|png)$/i.test(f))
      .map(f => f.toLowerCase()
        .replace(/^(koehler|edwards|redoute)_/, '')
        .replace(/\.(jpg|png)$/, '')
      )
      .filter(f => !f.startsWith('xx'))        // exclude WIP/test artwork
      .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
      .sort();
    res.json(plants);
  } catch(e) {
    console.error('[artwork-list] Error reading artwork dir:', e.message);
    res.status(500).json({ error: 'Could not read artwork list' });
  }
});

// ── Etsy OAuth callback — one-time use, remove after token obtained ───────────
// 1. Set redirect URI in Etsy developer dashboard to:
//    https://garden-calendar-proxy.onrender.com/api/etsy-oauth-callback
// 2. Visit the auth URL (see OPERATIONS.md) in your browser
// 3. Etsy redirects here — token is printed to Render logs + shown in browser
// 4. Copy ETSY_REFRESH_TOKEN to Render env vars, then remove this endpoint
app.get('/api/etsy-oauth-callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code parameter');

  const apiKey = process.env.ETSY_API_KEY;
  if (!apiKey) return res.status(500).send('ETSY_API_KEY not set on server');

  const REDIRECT_URI = 'https://garden-calendar-proxy.onrender.com/api/etsy-oauth-callback';

  try {
    const body = new URLSearchParams({
      grant_type:   'authorization_code',
      client_id:    apiKey,
      redirect_uri: REDIRECT_URI,
      code:         code,
    }).toString();

    const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':   'GardenCalendar/1.0',
      },
      body,
    });

    const data = await tokenRes.json();

    if (!data.refresh_token) {
      console.error('[etsy-oauth] Token exchange failed:', JSON.stringify(data));
      return res.status(502).send('<pre>Token exchange failed:\n' + JSON.stringify(data, null, 2) + '</pre>');
    }

    console.log('[etsy-oauth] ✅ SUCCESS — add this to Render env vars:');
    console.log('[etsy-oauth] ETSY_REFRESH_TOKEN=' + data.refresh_token);

    res.send(`
      <h2>✅ Etsy OAuth successful</h2>
      <p>Copy this value into Render as <strong>ETSY_REFRESH_TOKEN</strong>:</p>
      <pre style="background:#f4f4f4;padding:16px;word-break:break-all">${data.refresh_token}</pre>
      <p>Access token (short-lived, not needed):<br><small>${data.access_token}</small></p>
      <p><strong>Done — you can remove the /api/etsy-oauth-callback endpoint from server.js.</strong></p>
    `);
  } catch (e) {
    console.error('[etsy-oauth] Error:', e.message);
    res.status(500).send('OAuth error: ' + e.message);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Garden Calendar proxy running on port ${PORT}`);
  console.log(`Allowed origin: ${ALLOWED_ORIGIN}`);
  console.log(`Daily gen cap: ${DAILY_GEN_CAP}, IP daily gen: ${IP_DAILY_GEN}, IP hourly: ${IP_HOURLY_CAP}`);

  // Start Etsy order cron — no-ops gracefully if env vars not set
  try {
    var etsyCron = require('./etsyCron.js');
    etsyCron.start();
  } catch(e) {
    console.warn('[etsy] Cron failed to load:', e.message);
  }
});
