// orderStore.js (CommonJS)
// Simple file-based order store. Reads and writes orders.json in the project root.
// Persists to /data/orders.json when RENDER_DISK_PATH=/data is set (Render persistent disk).
// Falls back to project root for local development.
//
// Order shape:
// {
//   id:         string  — unique order ID (gc-<timestamp>-<random>)
//   token:      string  — approval token (random hex, used in approve URL)
//   status:     string  — 'queued' | 'processing' | 'done' | 'failed'
//   createdAt:  string  — ISO timestamp
//   updatedAt:  string  — ISO timestamp
//   formData:   object  — raw form submission (plants, city, dates etc.)
//   pdfUrl:     string  — R2 public URL, set when done
//   error:      string  — error message, set when failed
// }

var fs   = require('fs');
var path = require('path');
var crypto = require('crypto');

var STORE_PATH = process.env.RENDER_DISK_PATH
  ? require('path').join(process.env.RENDER_DISK_PATH, 'orders.json')
  : path.join(__dirname, 'orders.json');

// ── Internal helpers ──────────────────────────────────────────────────────────

function _read() {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    var raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch(e) {
    console.error('[orderStore] Read error:', e.message);
    return {};
  }
}

function _write(orders) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(orders, null, 2), 'utf8');
  } catch(e) {
    console.error('[orderStore] Write error:', e.message);
  }
}

function _now() {
  return new Date().toISOString();
}

// ── Public API ────────────────────────────────────────────────────────────────

// Create a new order. Returns the saved order object.
function createOrder(formData) {
  var orders = _read();
  var id     = 'gc-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
  var token  = crypto.randomBytes(20).toString('hex');
  var order  = {
    id:        id,
    token:     token,
    status:    'queued',
    createdAt: _now(),
    updatedAt: _now(),
    formData:  formData,
    pdfUrl:    null,
    error:     null,
  };
  orders[id] = order;
  _write(orders);
  console.log('[orderStore] Created order:', id);
  return order;
}

// Get an order by its ID. Returns the order or null.
function getOrder(id) {
  var orders = _read();
  return orders[id] || null;
}

// Get an order by its approval token. Returns the order or null.
function getOrderByToken(token) {
  if (!token) return null;
  var orders = _read();
  var found  = null;
  Object.keys(orders).forEach(function(id) {
    if (orders[id].token === token) found = orders[id];
  });
  return found;
}

// Update fields on an existing order. Returns the updated order or null.
function updateOrder(id, fields) {
  var orders = _read();
  if (!orders[id]) {
    console.error('[orderStore] updateOrder: order not found:', id);
    return null;
  }
  Object.assign(orders[id], fields, { updatedAt: _now() });
  _write(orders);
  return orders[id];
}

// List all orders, newest first.
function listOrders() {
  var orders = _read();
  return Object.values(orders).sort(function(a, b) {
    return b.createdAt.localeCompare(a.createdAt);
  });
}

// Count orders with a given status.
function countByStatus(status) {
  var orders = _read();
  return Object.values(orders).filter(function(o) { return o.status === status; }).length;
}

// ── Meta: cron state persistence ─────────────────────────────────────────────
// Stores arbitrary key/value metadata alongside orders (e.g. etsyCron state).
// Kept in the same orders.json file under a reserved '_meta' key.

function getMeta(key) {
  var orders = _read();
  return (orders._meta && orders._meta[key]) || null;
}

function setMeta(key, value) {
  var orders = _read();
  if (!orders._meta) orders._meta = {};
  orders._meta[key] = value;
  _write(orders);
}

module.exports = {
  createOrder:      createOrder,
  getOrder:         getOrder,
  getOrderByToken:  getOrderByToken,
  updateOrder:      updateOrder,
  listOrders:       listOrders,
  countByStatus:    countByStatus,
  getMeta:          getMeta,
  setMeta:          setMeta,
};
