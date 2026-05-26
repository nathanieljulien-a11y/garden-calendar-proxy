const express = require('express');
const router  = express.Router();
const { GARDENS } = require('./products/garden-wall-calendar.js');

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/nearby-gardens?lat=51.5&lng=-0.1&n=10
// Returns the n closest gardens from the curated GARDENS array as [{name, location, distanceKm}]
router.get('/api/nearby-gardens', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const n   = Math.min(parseInt(req.query.n) || 10, 20);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const scored = GARDENS
    .map(g => ({ name: g.name, distanceKm: haversineKm(lat, lng, g.lat, g.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, n)
    .map(g => ({ name: g.name, distanceKm: Math.round(g.distanceKm) }));

  console.log(`[nearby-gardens] lat=${lat} lng=${lng} returning ${scored.length} gardens`);
  res.json(scored);
});

module.exports = router;
