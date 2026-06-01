#!/usr/bin/env node
/**
 * Artwork Review Script — Clockwatcher Almanacs
 * 
 * Run from Render Shell in the repo root:
 *   node review-artwork.js
 * 
 * Reviews all images in ./artwork/, checks resolution via sharp,
 * and uses Claude Haiku to assess garden calendar suitability.
 * Outputs a results table + JSON summary to stdout.
 * 
 * Requires: ANTHROPIC_API_KEY env var (already set on Render)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ARTWORK_DIR = path.join(__dirname, 'artwork');
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MIN_WIDTH = 2400;

if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getImageWidth(filepath) {
  try {
    const sharp = require('sharp');
    const meta = await sharp(filepath).metadata();
    return meta.width || null;
  } catch(e) {
    return null;
  }
}

function toBase64(filepath) {
  return fs.readFileSync(filepath).toString('base64');
}

function callClaude(filename, base64) {
  return new Promise((resolve, reject) => {
    const prompt = `You are curating botanical illustrations for a UK/European home garden wall calendar — ornamental borders, cottage gardens, kitchen gardens. The calendar should feel beautiful and decorative on a wall.

Filename: ${filename}

Respond ONLY with valid JSON (no markdown, no explanation):
{"verdict":"garden"|"allotment"|"forest"|"reject","note":"one sentence max 12 words"}

Verdict criteria:
- "garden": ornamental or common kitchen garden plant, attractive full decorative plate, beautiful on a wall
- "allotment": primarily a crop, vegetable, or utility plant — better for an allotment calendar
- "forest": woodland, wild, or medicinal plant with no strong garden association
- "reject": text page, dissection/anatomy diagram only, herbarium specimen, or poor quality scan`;

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.find(b => b.type === 'text')?.text || '';
          const result = JSON.parse(text.replace(/```json|```/g, '').trim());
          resolve(result);
        } catch(e) {
          reject(new Error(`Parse error: ${e.message} — raw: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function plantName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/^[a-z]+_/, '')
    .replace(/_/g, ' ');
}

function pad(str, len) {
  return String(str).padEnd(len, ' ').slice(0, len);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = fs.readdirSync(ARTWORK_DIR)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .sort();

  console.log(`\n✦ Artwork Review — ${files.length} files found in ./artwork/\n`);
  console.log(`${'FILE'.padEnd(42)} ${'WIDTH'.padEnd(10)} ${'VERDICT'.padEnd(12)} NOTE`);
  console.log('─'.repeat(110));

  const results = [];
  let garden = 0, allotment = 0, forest = 0, reject = 0, errors = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filepath = path.join(ARTWORK_DIR, filename);

    // Resolution check via sharp
    const width = await getImageWidth(filepath);
    const resPass = width >= MIN_WIDTH;
    const resLabel = width ? `${width}px` : '?';
    const resFlag = width === null ? '?' : (resPass ? '✓' : '✗');

    // AI review
    let verdict = null;
    let note = '';
    try {
      const base64 = toBase64(filepath);
      const result = await callClaude(filename, base64);
      verdict = result.verdict;
      note = result.note || '';
      if (verdict === 'garden') garden++;
      else if (verdict === 'allotment') allotment++;
      else if (verdict === 'forest') forest++;
      else if (verdict === 'reject') reject++;
    } catch(e) {
      verdict = 'ERROR';
      note = e.message.slice(0, 60);
      errors++;
    }

    results.push({ filename, plantName: plantName(filename), width, resPass, verdict, note });
    console.log(`${pad(filename, 42)} ${pad(resFlag + ' ' + resLabel, 10)} ${pad(verdict || '?', 12)} ${note}`);

    if (i < files.length - 1) await sleep(600);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(110));
  console.log(`\n✦ Summary`);
  console.log(`  Total files:  ${files.length}`);
  console.log(`  ≥2400px:      ${results.filter(r => r.resPass).length}`);
  console.log(`  <2400px:      ${results.filter(r => r.width && !r.resPass).length}`);
  console.log(`  Garden ✓:     ${garden}`);
  console.log(`  Allotment:    ${allotment}`);
  console.log(`  Forest:       ${forest}`);
  console.log(`  Reject:       ${reject}`);
  console.log(`  Errors:       ${errors}`);

  const approved = results.filter(r => r.verdict === 'garden' && r.resPass);
  if (approved.length) {
    console.log(`\n✦ Garden-approved (≥2400px) — candidates to add to plantCommentary.json + order form:`);
    console.log(approved.map(r => `  "${r.plantName}"`).join(',\n'));
  }

  const lowRes = results.filter(r => r.verdict === 'garden' && !r.resPass);
  if (lowRes.length) {
    console.log(`\n✦ Garden-approved but low-res — needs replacement:`);
    lowRes.forEach(r => console.log(`  ${r.filename} (${r.width || '?'}px)`));
  }

  const rejects = results.filter(r => r.verdict === 'reject');
  if (rejects.length) {
    console.log(`\n✦ Rejected — consider removing from repo:`);
    rejects.forEach(r => console.log(`  ${r.filename} — ${r.note}`));
  }

  const jsonPath = path.join(__dirname, 'artwork-review-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n✦ Full results saved to: ${jsonPath}`);
  console.log('   (view with: cat artwork-review-results.json)\n');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
