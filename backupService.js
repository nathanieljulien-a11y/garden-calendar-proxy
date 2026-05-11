// backupService.js (CommonJS)
// Daily backup of all files on the Render persistent disk (/data/*) to R2.
// Runs once at startup (after a short delay) then every 24 hours.
//
// R2 destination: backups/YYYY-MM-DD/<filename>
// Keeps the last 7 days — older backup folders are pruned after upload.
//
// Uses the same AWS Signature V4 approach as r2.js (R2 is S3-compatible).
// No additional dependencies — uses Node built-ins + the env vars already set.

var fs      = require('fs');
var path    = require('path');
var https   = require('https');
var crypto  = require('crypto');

var DISK_PATH   = process.env.RENDER_DISK_PATH || '/data';
var ACCOUNT_ID  = process.env.CLOUDFLARE_ACCOUNT_ID || '';
var ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID || '';
var SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY || '';
var BUCKET      = process.env.R2_BUCKET_NAME || 'garden-calendar-pdfs';
var REGION      = 'auto';
var HOST        = ACCOUNT_ID + '.r2.cloudflarestorage.com';

var RETAIN_DAYS = 7;
var RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── AWS Signature V4 helpers ──────────────────────────────────────────────────

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function hexHmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

function sha256hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function signingKey(dateStr) {
  var kDate    = hmac('AWS4' + SECRET_KEY, dateStr);
  var kRegion  = hmac(kDate, REGION);
  var kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function buildHeaders(method, key, body) {
  var now      = new Date();
  var amzDate  = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  var dateStr  = amzDate.slice(0, 8);
  var bodyHash = sha256hex(body);

  var canonicalHeaders = 'host:' + HOST + '\nx-amz-content-sha256:' + bodyHash + '\nx-amz-date:' + amzDate + '\n';
  var signedHeaders    = 'host;x-amz-content-sha256;x-amz-date';

  var canonicalRequest = [
    method,
    '/' + BUCKET + '/' + key,
    '',
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  var credentialScope = dateStr + '/' + REGION + '/s3/aws4_request';
  var stringToSign    = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256hex(canonicalRequest);
  var signature       = hexHmac(signingKey(dateStr), stringToSign);
  var authorization   = 'AWS4-HMAC-SHA256 Credential=' + ACCESS_KEY + '/' + credentialScope
    + ', SignedHeaders=' + signedHeaders
    + ', Signature=' + signature;

  return {
    'Authorization':        authorization,
    'x-amz-date':           amzDate,
    'x-amz-content-sha256': bodyHash,
    'Content-Length':       Buffer.byteLength(body),
  };
}

// ── R2 PUT ────────────────────────────────────────────────────────────────────

function putObject(key, buffer, contentType) {
  return new Promise(function(resolve, reject) {
    var headers = buildHeaders('PUT', key, buffer);
    headers['Content-Type'] = contentType || 'application/octet-stream';

    var req = https.request({
      hostname: HOST,
      path:     '/' + BUCKET + '/' + key,
      method:   'PUT',
      headers:  headers,
    }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error('R2 PUT ' + key + ' failed: HTTP ' + res.statusCode + ' ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, function() { req.destroy(new Error('R2 PUT timeout: ' + key)); });
    req.write(buffer);
    req.end();
  });
}

// ── R2 LIST (prefix) ─────────────────────────────────────────────────────────

function listObjects(prefix) {
  return new Promise(function(resolve, reject) {
    var now      = new Date();
    var amzDate  = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    var dateStr  = amzDate.slice(0, 8);
    var emptyHash = sha256hex('');
    var query    = 'list-type=2&prefix=' + encodeURIComponent(prefix) + '&delimiter=%2F';

    var canonicalHeaders = 'host:' + HOST + '\nx-amz-content-sha256:' + emptyHash + '\nx-amz-date:' + amzDate + '\n';
    var signedHeaders    = 'host;x-amz-content-sha256;x-amz-date';
    var canonicalRequest = ['GET', '/' + BUCKET + '/', query, canonicalHeaders, signedHeaders, emptyHash].join('\n');
    var credentialScope  = dateStr + '/' + REGION + '/s3/aws4_request';
    var stringToSign     = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256hex(canonicalRequest);
    var signature        = hexHmac(signingKey(dateStr), stringToSign);
    var authorization    = 'AWS4-HMAC-SHA256 Credential=' + ACCESS_KEY + '/' + credentialScope
      + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

    var req = https.request({
      hostname: HOST,
      path:     '/' + BUCKET + '/?' + query,
      method:   'GET',
      headers:  {
        'Authorization':        authorization,
        'x-amz-date':           amzDate,
        'x-amz-content-sha256': emptyHash,
      },
    }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        // Extract <Prefix> tags from XML response (common prefixes = date folders)
        var prefixes = [];
        var re = /<CommonPrefixes><Prefix>([^<]+)<\/Prefix><\/CommonPrefixes>/g;
        var m;
        while ((m = re.exec(data)) !== null) prefixes.push(m[1]);
        resolve(prefixes);
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, function() { req.destroy(new Error('R2 LIST timeout')); });
    req.end();
  });
}

// ── R2 DELETE ─────────────────────────────────────────────────────────────────

function deleteObject(key) {
  return new Promise(function(resolve, reject) {
    var now      = new Date();
    var amzDate  = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    var dateStr  = amzDate.slice(0, 8);
    var emptyHash = sha256hex('');

    var canonicalHeaders = 'host:' + HOST + '\nx-amz-content-sha256:' + emptyHash + '\nx-amz-date:' + amzDate + '\n';
    var signedHeaders    = 'host;x-amz-content-sha256;x-amz-date';
    var canonicalRequest = ['DELETE', '/' + BUCKET + '/' + key, '', canonicalHeaders, signedHeaders, emptyHash].join('\n');
    var credentialScope  = dateStr + '/' + REGION + '/s3/aws4_request';
    var stringToSign     = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256hex(canonicalRequest);
    var signature        = hexHmac(signingKey(dateStr), stringToSign);
    var authorization    = 'AWS4-HMAC-SHA256 Credential=' + ACCESS_KEY + '/' + credentialScope
      + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

    var req = https.request({
      hostname: HOST,
      path:     '/' + BUCKET + '/' + key,
      method:   'DELETE',
      headers:  {
        'Authorization':        authorization,
        'x-amz-date':           amzDate,
        'x-amz-content-sha256': emptyHash,
      },
    }, function(res) {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Backup run ────────────────────────────────────────────────────────────────

async function runBackup() {
  if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
    console.warn('[backup] R2 env vars not set — skipping backup');
    return;
  }

  var today   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  var prefix  = 'backups/' + today + '/';

  // List files on disk
  var files;
  try {
    files = fs.readdirSync(DISK_PATH).filter(function(f) {
      return fs.statSync(path.join(DISK_PATH, f)).isFile();
    });
  } catch(e) {
    console.error('[backup] Could not read disk path', DISK_PATH, ':', e.message);
    return;
  }

  if (!files.length) {
    console.log('[backup] No files found in', DISK_PATH, '— skipping');
    return;
  }

  console.log('[backup] Starting backup of', files.length, 'file(s) to R2 prefix:', prefix);

  var ok = 0, fail = 0;
  for (var i = 0; i < files.length; i++) {
    var filename = files[i];
    var filepath = path.join(DISK_PATH, filename);
    var r2Key    = prefix + filename;
    try {
      var buf = fs.readFileSync(filepath);
      await putObject(r2Key, buf, 'application/octet-stream');
      console.log('[backup] Uploaded:', r2Key);
      ok++;
    } catch(e) {
      console.error('[backup] Failed to upload', filename, ':', e.message);
      fail++;
    }
  }

  console.log('[backup] Done — ' + ok + ' uploaded, ' + fail + ' failed');

  // Prune backup folders older than RETAIN_DAYS
  try {
    var allPrefixes = await listObjects('backups/');
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETAIN_DAYS);

    for (var j = 0; j < allPrefixes.length; j++) {
      // prefix looks like "backups/2026-05-01/"
      var match = allPrefixes[j].match(/backups\/(\d{4}-\d{2}-\d{2})\//);
      if (!match) continue;
      var folderDate = new Date(match[1]);
      if (folderDate < cutoff) {
        // List and delete all objects in this folder
        // For small backups (5 files), list individually isn't worth a separate call —
        // just attempt deletes of the known filenames
        for (var k = 0; k < files.length; k++) {
          var oldKey = 'backups/' + match[1] + '/' + files[k];
          try { await deleteObject(oldKey); } catch(e) { /* non-fatal */ }
        }
        console.log('[backup] Pruned old backup folder:', allPrefixes[j]);
      }
    }
  } catch(e) {
    console.warn('[backup] Prune step failed (non-fatal):', e.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

function start() {
  // Run 2 minutes after startup (let the server settle), then every 24 hours
  setTimeout(function() {
    runBackup();
    setInterval(runBackup, RUN_INTERVAL_MS);
  }, 2 * 60 * 1000);

  console.log('[backup] Daily disk backup scheduled — first run in 2 minutes');
}

module.exports = { start, runBackup };
