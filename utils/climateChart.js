// utils/climateChart.js (CommonJS)
// Shared inline SVG climate chart — temperature lines + precipitation bars.
// Used by any product that wants a 12-month climate overview on its cover page.
// Rendered at 130×52mm in the cover page right panel.


function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// climateData: { _cd: { tMax, tMin, precip, sunHrs } } — 12-element arrays, Jan=0
// startMonthIdx: 0–11 — which month to start the chart from
// monthNames: array of 12 display strings for the calendar's month order
// climateLabel: string — city/region name shown in the heading
// Returns an HTML string (div containing heading + SVG + source credit).
function buildClimateChart(climateData, startMonthIdx, monthNames, climateLabel) {
  climateLabel = climateLabel || '';

  var W = 500, H = 180;  // SVG units (maps to ~130×52mm at cover scale)
  var padL = 38, padR = 38, padT = 16, padB = 28;
  var cW = W - padL - padR, cH = H - padT - padB;

  var cd = (climateData && climateData._cd) || null;
  if (!cd) {
    return '<div class="cv-chart-block"><span class="cv-section-label">Average climate</span>'
      + '<div class="cv-chart-empty">Climate data not available</div></div>';
  }

  // Reorder data to start from startMonthIdx
  var tMaxR = [], tMinR = [], precipR = [], labelsR = [];
  var MON_ABBR = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  for (var i = 0; i < 12; i++) {
    var mi = (startMonthIdx + i) % 12;
    tMaxR.push(cd.tMax[mi]);
    tMinR.push(cd.tMin[mi]);
    precipR.push(cd.precip[mi]);
    labelsR.push(monthNames[i] ? monthNames[i].slice(0, 1) : MON_ABBR[mi]);
  }

  // Scales
  var allTemps = tMaxR.concat(tMinR).filter(function(v) { return v != null; });
  var tLo = Math.floor(Math.min.apply(null, allTemps) / 5) * 5 - 5;
  var tHi = Math.ceil(Math.max.apply(null, allTemps) / 5) * 5 + 5;
  var pHi = Math.ceil(Math.max.apply(null, precipR) / 20) * 20;

  function tY(v)    { return padT + cH - (v - tLo) / (tHi - tLo) * cH; }
  function pY(v)    { return padT + cH - v / pHi * cH; }
  function xMid(i)  { return padL + (i + 0.5) * (cW / 12); }
  function xLeft(i) { return padL + i * (cW / 12); }
  var barW = cW / 12 * 0.65;

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" '
    + 'style="width:100%;height:100%;display:block;">';

  svg += '<rect width="' + W + '" height="' + H + '" fill="#FDFAF4"/>';

  // Grid lines (temperature axis)
  var tStep = (tHi - tLo) <= 30 ? 5 : 10;
  for (var t = tLo; t <= tHi; t += tStep) {
    var gy = tY(t);
    if (gy < padT || gy > padT + cH + 1) continue;
    svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (padL + cW) + '" y2="' + gy + '" '
      + 'stroke="rgba(139,105,20,0.12)" stroke-width="0.8"/>';
    svg += '<text x="' + (padL - 4) + '" y="' + (gy + 3) + '" text-anchor="end" '
      + 'font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#7A5C2A">' + t + '°</text>';
  }

  // Precipitation axis labels (right side)
  var pStep = pHi <= 80 ? 20 : 40;
  for (var p = 0; p <= pHi; p += pStep) {
    var py = pY(p);
    if (py < padT || py > padT + cH + 1) continue;
    svg += '<text x="' + (padL + cW + 4) + '" y="' + (py + 3) + '" text-anchor="start" '
      + 'font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#5A7A32">' + p + '</text>';
  }

  // Precipitation bars (behind temperature lines)
  for (var i = 0; i < 12; i++) {
    if (precipR[i] == null) continue;
    var bx = xLeft(i) + (cW / 12 - barW) / 2;
    var by = pY(precipR[i]);
    var bh = padT + cH - by;
    svg += '<rect x="' + bx + '" y="' + by + '" width="' + barW + '" height="' + bh + '" '
      + 'fill="rgba(90,122,50,0.22)" rx="1"/>';
  }

  // Temperature lines
  var maxPts = tMaxR.map(function(v, i) { return xMid(i) + ',' + tY(v); }).join(' ');
  svg += '<polyline points="' + maxPts + '" fill="none" stroke="#8A3A10" stroke-width="2" stroke-linejoin="round"/>';
  var minPts = tMinR.map(function(v, i) { return xMid(i) + ',' + tY(v); }).join(' ');
  svg += '<polyline points="' + minPts + '" fill="none" stroke="#8B6914" stroke-width="2" stroke-linejoin="round"/>';

  // Dots on lines
  for (var i = 0; i < 12; i++) {
    svg += '<circle cx="' + xMid(i) + '" cy="' + tY(tMaxR[i]) + '" r="3" fill="#8A3A10"/>';
    svg += '<circle cx="' + xMid(i) + '" cy="' + tY(tMinR[i]) + '" r="3" fill="#8B6914"/>';
  }

  // Month labels
  for (var i = 0; i < 12; i++) {
    svg += '<text x="' + xMid(i) + '" y="' + (padT + cH + 14) + '" text-anchor="middle" '
      + 'font-family="Playfair Display,serif" font-size="11" fill="#2C1A0A">' + labelsR[i] + '</text>';
  }

  // Legend
  var ly = padT - 5;
  svg += '<line x1="' + padL + '" y1="' + ly + '" x2="' + (padL + 18) + '" y2="' + ly + '" stroke="#8A3A10" stroke-width="2"/>';
  svg += '<text x="' + (padL + 22) + '" y="' + (ly + 4) + '" font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#8A3A10">High</text>';
  svg += '<line x1="' + (padL + 60) + '" y1="' + ly + '" x2="' + (padL + 78) + '" y2="' + ly + '" stroke="#8B6914" stroke-width="2"/>';
  svg += '<text x="' + (padL + 82) + '" y="' + (ly + 4) + '" font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#8B6914">Low °C</text>';
  svg += '<rect x="' + (padL + 145) + '" y="' + (ly - 7) + '" width="14" height="10" fill="rgba(90,122,50,0.3)" rx="1"/>';
  svg += '<text x="' + (padL + 163) + '" y="' + (ly + 4) + '" font-family="Crimson Pro,Georgia,serif" font-size="11" fill="#5A7A32">Rain mm</text>';

  // Axis lines
  svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + cH) + '" stroke="rgba(44,26,10,0.2)" stroke-width="1"/>';
  svg += '<line x1="' + padL + '" y1="' + (padT + cH) + '" x2="' + (padL + cW) + '" y2="' + (padT + cH) + '" stroke="rgba(44,26,10,0.2)" stroke-width="1"/>';
  svg += '<line x1="' + (padL + cW) + '" y1="' + padT + '" x2="' + (padL + cW) + '" y2="' + (padT + cH) + '" stroke="rgba(90,122,50,0.2)" stroke-width="1"/>';

  svg += '</svg>';

  return '<div class="cv-chart-block">'
    + '<span class="cv-section-label">Typical climate in ' + esc(climateLabel) + '</span>'
    + '<div class="cv-chart-svg">' + svg + '</div>'
    + '<div class="cv-chart-source">Source: Visual Crossing Weather · Statistical normals</div>'
    + '</div>';
}

module.exports = { buildClimateChart: buildClimateChart };
