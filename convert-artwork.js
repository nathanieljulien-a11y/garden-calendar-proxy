#!/usr/bin/env node
/**
 * convert-artwork.js — Build-time JP2 → JPEG conversion
 * 
 * Run as part of Render build command:
 *   npm install && node convert-artwork.js
 * 
 * Scans ./artwork/ for any files with .jpg extension that are actually
 * JP2 format (renamed during upload), converts them to proper JPEG.
 * Safe to run repeatedly — skips files that are already JPEG.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTWORK_DIR = path.join(__dirname, 'artwork');
const QUALITY = 92;

function getFormat(filepath) {
  try {
    return execSync(`identify -format "%m" "${filepath}" 2>/dev/null`, { encoding: 'utf8' }).trim();
  } catch(e) {
    return null;
  }
}

function convert(filepath) {
  const tmp = '/tmp/artwork-convert.jpg';
  execSync(`convert "${filepath}" -quality ${QUALITY} "${tmp}"`, { stdio: 'inherit' });
  execSync(`mv "${tmp}" "${filepath}"`);
}

const files = fs.readdirSync(ARTWORK_DIR)
  .filter(f => /\.(jpg|jpeg)$/i.test(f))
  .sort();

console.log(`[convert-artwork] Checking ${files.length} files in ./artwork/`);

let converted = 0;
let skipped = 0;
let errors = 0;

for (const filename of files) {
  const filepath = path.join(ARTWORK_DIR, filename);
  const format = getFormat(filepath);

  if (!format) {
    console.log(`[convert-artwork] SKIP (unreadable): ${filename}`);
    errors++;
    continue;
  }

  if (format === 'JP2' || format === 'JPX') {
    process.stdout.write(`[convert-artwork] Converting ${filename}... `);
    try {
      convert(filepath);
      console.log('done');
      converted++;
    } catch(e) {
      console.log(`FAILED: ${e.message}`);
      errors++;
    }
  } else {
    skipped++;
  }
}

console.log(`[convert-artwork] Done — converted: ${converted}, skipped: ${skipped}, errors: ${errors}`);
