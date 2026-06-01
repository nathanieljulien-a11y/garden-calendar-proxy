#!/usr/bin/env node
/**
 * Artwork Review Script — Clockwatcher Almanacs
 * Run from Render Shell: node review-artwork.js
 * Requires: ANTHROPIC_API_KEY env var
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ARTWORK_DIR = path.join(__dirname, 'artwork');
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MIN_WIDTH = 2400;
const DELAY_MS = 1500;
const MAX_RETRIES = 3;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

if (!API_KEY) { console.error('ERROR: ANTHROPIC_API_KEY not set'); process.exit(1); }

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

function apiCall(filename, base64) {
  return new Promise((resolve, reject) => {
    const prompt = `You are curating botanical illustrations for a UK/European home garden wall calendar. Ornamental borders, cottage gardens, kitchen gardens. The calendar should feel beautiful and decorative on a wall.

Filename: ${filename}

Respond ONLY with valid JSON (no markdown, no explanation):
{"verdict":"garden"|"allotment"|"forest"|"reject","note":"one sentence max 12 words","peak_months":[1,2,3]}

Verdict:
- "garden": ornamental or kitchen garden plant, attractive full decorative plate
- "allotment": primarily a crop/vegetable/utility plant
- "forest": woodland or wild plant, no garden association
- "reject": text page, dissection diagram, poor scan, or mislabeled

peak_months: month numbers (1=Jan...12=Dec) when most visually prominent in UK garden.`;

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
        // Surface rate limit errors for retry
        if (res.statusCode === 429) {
          return reject(Object.assign(new Error('rate_limit'), { retryable: true }));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 100)}`));
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.find(b => b.type === 'text')?.text || '';
          const result = JSON.parse(text.replace(/```json|```/g, '').trim());
          resolve(result);
        } catch(e) {
          reject(new Error(`Parse error: ${e.message} — raw: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function callClaude(filename, base64) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await apiCall(filename, base64);
    } catch(e) {
      if (e.retryable && attempt < MAX_RETRIES) {
        const wait = attempt * 3000;
        process.stdout.write(` [rate limit, waiting ${wait/1000}s...]`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function plantName(fn) { return fn.replace(/\.[^.]+$/, '').replace(/^[a-z]+_/, '').replace(/_/g, ' '); }
function pad(str, len) { return String(str).padEnd(len, ' ').slice(0, len); }
function monthsLabel(nums) { return (!nums || !nums.length) ? '—' : nums.map(n => MONTHS[n-1]).join(', '); }

async function main() {
  const files = fs.readdirSync(ARTWORK_DIR)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .sort();

  console.log(`\n✦ Artwork Review — ${files.length} files\n`);
  console.log(`${'FILE'.padEnd(40)} ${'WIDTH'.padEnd(10)} ${'VERDICT'.padEnd(12)} ${'PEAK MONTHS'.padEnd(28)} NOTE`);
  console.log('─'.repeat(120));

  const results = [];
  let garden=0, allotment=0, forest=0, reject=0, errors=0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filepath = path.join(ARTWORK_DIR, filename);

    const width = await getImageWidth(filepath);
    const resPass = width >= MIN_WIDTH;
    const resFlag = width === null ? '?' : (resPass ? '✓' : '✗');
    const resLabel = width ? `${width}px` : '?';

    let verdict=null, note='', peak_months=[];
    try {
      const base64 = toBase64(filepath);
      const result = await callClaude(filename, base64);
      verdict = result.verdict;
      note = result.note || '';
      peak_months = result.peak_months || [];
      if (verdict==='garden') garden++;
      else if (verdict==='allotment') allotment++;
      else if (verdict==='forest') forest++;
      else if (verdict==='reject') reject++;
    } catch(e) {
      verdict = 'ERROR'; note = e.message.slice(0, 50); errors++;
    }

    results.push({ filename, plantName: plantName(filename), width, resPass, verdict, note, peak_months });
    console.log(`${pad(filename,40)} ${pad(resFlag+' '+resLabel,10)} ${pad(verdict||'?',12)} ${pad(monthsLabel(peak_months),28)} ${note}`);

    if (i < files.length - 1) await sleep(DELAY_MS);
  }

  console.log('\n' + '─'.repeat(120));
  console.log(`\n✦ Summary`);
  console.log(`  Total: ${files.length}  |  ≥2400px: ${results.filter(r=>r.resPass).length}  |  <2400px: ${results.filter(r=>r.width&&!r.resPass).length}`);
  console.log(`  Garden: ${garden}  |  Allotment: ${allotment}  |  Forest: ${forest}  |  Reject: ${reject}  |  Errors: ${errors}`);

  const approved = results.filter(r => r.verdict==='garden' && r.resPass);
  console.log(`\n✦ Monthly coverage — garden-approved ≥2400px (${approved.length} plants)\n`);
  console.log('  ' + MONTHS.join('  '));
  console.log('  ' + MONTHS.map((_,i) => String(approved.filter(r=>r.peak_months.includes(i+1)).length).padStart(3)).join(' '));
  console.log('\n  Detail:');
  MONTHS.forEach((m,i) => {
    const plants = approved.filter(r => r.peak_months.includes(i+1));
    console.log(`  ${m}: ${plants.length ? plants.map(r=>r.plantName).join(', ') : '— (no coverage)'}`);
  });

  const gaps = MONTHS.filter((_,i) => approved.filter(r=>r.peak_months.includes(i+1)).length === 0);
  if (gaps.length) console.log(`\n  ⚠ Months with no approved plants: ${gaps.join(', ')}`);

  if (approved.length) {
    console.log(`\n✦ Garden-approved (≥2400px):`);
    approved.forEach(r => console.log(`  "${r.plantName}" — ${monthsLabel(r.peak_months)}`));
  }

  const lowRes = results.filter(r => r.verdict==='garden' && !r.resPass);
  if (lowRes.length) {
    console.log(`\n✦ Garden-approved but low-res (${lowRes.length}):`);
    lowRes.forEach(r => console.log(`  ${r.filename} (${r.width||'?'}px) — ${monthsLabel(r.peak_months)}`));
  }

  const rejects = results.filter(r => r.verdict==='reject');
  if (rejects.length) {
    console.log(`\n✦ Rejected — delete from repo:`);
    rejects.forEach(r => console.log(`  ${r.filename} — ${r.note}`));
  }

  const nonGarden = results.filter(r => ['allotment','forest'].includes(r.verdict));
  if (nonGarden.length) {
    console.log(`\n✦ Allotment/Forest:`);
    nonGarden.forEach(r => console.log(`  ${r.filename} (${r.verdict}) — ${monthsLabel(r.peak_months)}`));
  }

  const errorList = results.filter(r => r.verdict==='ERROR');
  if (errorList.length) {
    console.log(`\n✦ Errors — re-run these manually:`);
    errorList.forEach(r => console.log(`  ${r.filename}`));
  }

  fs.writeFileSync(path.join(__dirname, 'artwork-review-results.json'), JSON.stringify(results, null, 2));
  console.log(`\n✦ Results saved to artwork-review-results.json\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
