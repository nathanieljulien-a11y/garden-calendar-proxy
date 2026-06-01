#!/usr/bin/env node
/**
 * Artwork Review Script — Clockwatcher Almanacs
 * 
 * Run from Render Shell in the repo root:
 *   node review-artwork.js
 * 
 * Reviews all images in ./artwork/, checks resolution via sharp,
 * and uses Claude Haiku to assess garden calendar suitability
 * including which months the plant is at its best.
 * 
 * Requires: ANTHROPIC_API_KEY env var (already set on Render)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ARTWORK_DIR = path.join(__dirname, 'artwork');
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MIN_WIDTH = 2400;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set');
  process.exit(1);
}

async function getImageWidth(filepath) {
  try {
    const sharp = require('sharp');
    const meta = await sharp(filepath).metadata();
    return meta.width || null;
  } catch(e) { return null; }
}

function toBase64(filepath) {
  return fs.readFileSync(filepath).toString('base64');
}

function callClaude(filename, base64) {
  return new Promise((resolve, reject) => {
    const prompt = `You are curating botanical illustrations for a UK/European home garden wall calendar. The calendar is decorative and should feel beautiful on a wall — ornamental borders, cottage gardens, kitchen gardens.

Filename: ${filename}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "verdict": "garden"|"allotment"|"forest"|"reject",
  "note": "one sentence max 12 words",
  "peak_months": [1,2,3]
}

Verdict criteria:
- "garden": ornamental or common kitchen garden plant, attractive full decorative plate, beautiful on a wall
- "allotment": primarily a crop, vegetable, or utility plant
- "forest": woodland, wild, or medicinal plant with no strong garden association
- "reject": text page, dissection diagram only, poor quality scan

peak_months: array of month numbers (1=Jan...12=Dec) when this plant is most visually prominent in a UK garden — flowering, fruiting, or at peak ornamental interest. Be specific — most plants peak in 1-3 months. For year-round plants use the most distinctive season.`;

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
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

function monthsLabel(nums) {
  if (!nums || !nums.length) return '—';
  return nums.map(n => MONTHS[n - 1]).join(', ');
}

async function main() {
  const files = fs.readdirSync(ARTWORK_DIR)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .sort();

  console.log(`\n✦ Artwork Review — ${files.length} files found in ./artwork/\n`);
  console.log(`${'FILE'.padEnd(40)} ${'WIDTH'.padEnd(10)} ${'VERDICT'.padEnd(12)} ${'PEAK MONTHS'.padEnd(28)} NOTE`);
  console.log('─'.repeat(120));

  const results = [];
  let garden = 0, allotment = 0, forest = 0, reject = 0, errors = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filepath = path.join(ARTWORK_DIR, filename);

    const width = await getImageWidth(filepath);
    const resPass = width >= MIN_WIDTH;
    const resLabel = width ? `${width}px` : '?';
    const resFlag = width === null ? '?' : (resPass ? '✓' : '✗');

    let verdict = null, note = '', peak_months = [];
    try {
      const base64 = toBase64(filepath);
      const result = await callClaude(filename, base64);
      verdict = result.verdict;
      note = result.note || '';
      peak_months = result.peak_months || [];
      if (verdict === 'garden') garden++;
      else if (verdict === 'allotment') allotment++;
      else if (verdict === 'forest') forest++;
      else if (verdict === 'reject') reject++;
    } catch(e) {
      verdict = 'ERROR';
      note = e.message.slice(0, 50);
      errors++;
    }

    results.push({ filename, plantName: plantName(filename), width, resPass, verdict, note, peak_months });
    console.log(`${pad(filename, 40)} ${pad(resFlag + ' ' + resLabel, 10)} ${pad(verdict || '?', 12)} ${pad(monthsLabel(peak_months), 28)} ${note}`);

    if (i < files.length - 1) await sleep(600);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(120));
  console.log(`\n✦ Summary`);
  console.log(`  Total:     ${files.length}  |  ≥2400px: ${results.filter(r=>r.resPass).length}  |  <2400px: ${results.filter(r=>r.width&&!r.resPass).length}`);
  console.log(`  Garden: ${garden}  |  Allotment: ${allotment}  |  Forest: ${forest}  |  Reject: ${reject}  |  Errors: ${errors}`);

  // ── Monthly coverage map ───────────────────────────────────────────────────
  const approved = results.filter(r => r.verdict === 'garden' && r.resPass);
  console.log(`\n✦ Monthly coverage — garden-approved ≥2400px (${approved.length} plants)\n`);
  console.log('  ' + MONTHS.join('  '));
  console.log('  ' + MONTHS.map((m, i) => {
    const count = approved.filter(r => r.peak_months.includes(i + 1)).length;
    return String(count).padStart(3, ' ');
  }).join(' '));

  console.log('\n  Detail:');
  MONTHS.forEach((m, i) => {
    const plants = approved.filter(r => r.peak_months.includes(i + 1));
    if (plants.length) {
      console.log(`  ${m}: ${plants.map(r => r.plantName).join(', ')}`);
    } else {
      console.log(`  ${m}: — (no coverage)`);
    }
  });

  // ── Gap analysis ───────────────────────────────────────────────────────────
  const gaps = MONTHS.filter((m, i) => approved.filter(r => r.peak_months.includes(i + 1)).length === 0);
  if (gaps.length) {
    console.log(`\n  ⚠ Months with no approved plants: ${gaps.join(', ')}`);
  }

  // ── Full approved list ─────────────────────────────────────────────────────
  if (approved.length) {
    console.log(`\n✦ Garden-approved (≥2400px):`);
    approved.forEach(r => {
      console.log(`  "${r.plantName}" — ${monthsLabel(r.peak_months)}`);
    });
  }

  // ── Low-res garden plants ──────────────────────────────────────────────────
  const lowRes = results.filter(r => r.verdict === 'garden' && !r.resPass);
  if (lowRes.length) {
    console.log(`\n✦ Garden-approved but low-res (${lowRes.length}) — needs replacement:`);
    lowRes.forEach(r => console.log(`  ${r.filename} (${r.width || '?'}px) — ${monthsLabel(r.peak_months)}`));
  }

  // ── Forest/allotment ───────────────────────────────────────────────────────
  const nonGarden = results.filter(r => ['allotment','forest'].includes(r.verdict));
  if (nonGarden.length) {
    console.log(`\n✦ Allotment/Forest — excluded from garden calendar:`);
    nonGarden.forEach(r => console.log(`  ${r.filename} (${r.verdict})`));
  }

  // ── JSON output ────────────────────────────────────────────────────────────
  const jsonPath = path.join(__dirname, 'artwork-review-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n✦ Full results saved to: ${jsonPath}\n`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
