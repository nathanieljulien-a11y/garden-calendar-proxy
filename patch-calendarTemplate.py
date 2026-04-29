#!/usr/bin/env python3
"""
Patch script for calendarTemplate.js
Run from the garden-calendar-proxy repo root: python3 patch-calendarTemplate.py
"""
import sys

with open('calendarTemplate.js', 'r') as f:
    c = f.read()

patches = []

# ── Fix 2: Climate bar — spread across full width (justify-content:space-between) ──
old = "'.climate-bar{display:flex;flex-direction:row;align-items:baseline;flex-wrap:wrap;gap:2mm;padding:1mm 2.5mm;background:rgba(139,105,20,0.06);border-left:0.8mm solid var(--gold);flex-shrink:0;}'"
new = "'.climate-bar{display:flex;flex-direction:row;align-items:baseline;flex-wrap:nowrap;justify-content:space-between;gap:2mm;padding:1mm 2.5mm;background:rgba(139,105,20,0.06);border-left:0.8mm solid var(--gold);flex-shrink:0;}'"
patches.append(('Climate bar spread', old, new))

# ── Fix 3: Artwork credit — use artworkSource from opts instead of hardcoded Köhler ──
old = (
    "  var monthName     = opts.monthName;\n"
    "  var monthIdx      = opts.monthIdx;\n"
    "  var year          = opts.year;\n"
    "  var plant         = opts.plant || '';\n"
    "  var artworkB64    = opts.artworkB64 || '';\n"
    "  var inspo         = opts.inspo || null;\n"
    "  var inspoPhotoB64 = opts.inspoPhotoB64 || '';\n"
    "  var inspoQrB64    = opts.inspoQrB64 || '';\n"
    "  var appQrB64      = opts.appQrB64 || '';\n"
    "  var climate       = opts.climate || '';\n"
    "  var climateData   = opts.climateData || null;\n"
    "  var calendarName  = opts.calendarName || opts.recipientName || '';"
)
new = (
    "  var monthName     = opts.monthName;\n"
    "  var monthIdx      = opts.monthIdx;\n"
    "  var year          = opts.year;\n"
    "  var plant         = opts.plant || '';\n"
    "  var artworkB64    = opts.artworkB64 || '';\n"
    "  var artworkSource = opts.artworkSource || 'K\u00f6hler\u2019s Medizinal-Pflanzen, 1887 \u00b7 Public Domain';\n"
    "  var inspo         = opts.inspo || null;\n"
    "  var inspoPhotoB64 = opts.inspoPhotoB64 || '';\n"
    "  var inspoQrB64    = opts.inspoQrB64 || '';\n"
    "  var appQrB64      = opts.appQrB64 || '';\n"
    "  var climate       = opts.climate || '';\n"
    "  var climateData   = opts.climateData || null;\n"
    "  var calendarName  = opts.calendarName || opts.recipientName || '';"
)
patches.append(('artworkSource from opts', old, new))

# ── Fix 4: Use artworkSource in the credit line instead of hardcoded Köhler ──
old = "    + '<span class=\"artwork-credit\">K\\u00f6hler\\u2019s Medizinal-Pflanzen, 1887 \\u00b7 Public Domain \\u00b7 Digitised by Missouri Botanical Garden</span>'"
new = "    + '<span class=\"artwork-credit\">' + esc(artworkSource) + '</span>'"
patches.append(('artwork-credit use artworkSource', old, new))

# ── Fix 5: Cover chart — title and source line ──
old = (
    "  return '<div class=\"cv-chart-block\">'\n"
    "    + '<span class=\"cv-section-label\">30-year climate averages (1991\u20132020)</span>'\n"
    "    + '<div class=\"cv-chart-svg\">' + svg + '</div>'\n"
    "    + '<div class=\"cv-chart-source\">Source: Open-Meteo EC_Earth3P_HR model</div>'\n"
    "    + '</div>';"
)
new = (
    "  return '<div class=\"cv-chart-block\">'\n"
    "    + '<span class=\"cv-section-label\">Typical climate in ' + esc(climateLabel) + '</span>'\n"
    "    + '<div class=\"cv-chart-svg\">' + svg + '</div>'\n"
    "    + '<div class=\"cv-chart-source\">Source: Open-Meteo ERA5 reanalysis \u00b7 30-year climate averages 1991\u20132020</div>'\n"
    "    + '</div>';"
)
patches.append(('Cover chart title + source', old, new))

# ── Fix 6: Pass climateLabel into _buildClimateChart ──
old = "  var climateChartHtml = _buildClimateChart(opts.climateData, opts.startMonthIdx || 0, opts.monthNames || []);"
new = "  var climateChartHtml = _buildClimateChart(opts.climateData, opts.startMonthIdx || 0, opts.monthNames || [], opts.climate || '');"
patches.append(('Pass climate label to chart fn', old, new))

# ── Fix 7: _buildClimateChart signature — add climateLabel param ──
old = "function _buildClimateChart(climateData, startMonthIdx, monthNames) {"
new = "function _buildClimateChart(climateData, startMonthIdx, monthNames, climateLabel) {\n  climateLabel = climateLabel || '';"
patches.append(('Chart fn signature + climateLabel', old, new))

# ── Fix 8: Cover page About illustrations — dynamic based on sources used ──
# Find the static Köhler-only credit and replace with dynamic dual-source version
old = (
    "    + '<span class=\"cv-section-label\">About the illustrations</span>'\n"
    "    + '<p>The botanical illustrations in this calendar are taken from K\\u00f6hler\\u2019s Medizinal-Pflanzen (1887), a landmark work of botanical art. All plates are in the public domain, digitised by the Missouri Botanical Garden.</p>'"
)
new = (
    "    + '<span class=\"cv-section-label\">About the illustrations</span>'\n"
    "    + (function(){\n"
    "        var hasKoehler = (opts.artworkSources || []).some(function(s){ return s && s.includes('K\\u00f6hler'); });\n"
    "        var hasEdwards = (opts.artworkSources || []).some(function(s){ return s && s.includes('Edwards'); });\n"
    "        var txt = '';\n"
    "        if (hasKoehler) txt += 'K\\u00f6hler\\u2019s Medizinal-Pflanzen (1887) is a landmark work of botanical art; plates are in the public domain, digitised by the Missouri Botanical Garden.';\n"
    "        if (hasKoehler && hasEdwards) txt += ' ';\n"
    "        if (hasEdwards) txt += 'Edwards\\u2019 Botanical Register (1815\\u20131847) is one of the finest illustrated botanical periodicals of the 19th century; all plates are in the public domain.';\n"
    "        if (!hasKoehler && !hasEdwards) txt = 'The botanical illustrations in this calendar are in the public domain.';\n"
    "        return '<p>' + txt + '</p>';\n"
    "      }())"
)
patches.append(('About illustrations dynamic sources', old, new))

# ── Fix 9: Pass artworkSources array to buildCoverPage from pdfService ──
# This is in pdfService.js not calendarTemplate — handled separately below.

# Apply all patches
ok = True
for name, old, new in patches:
    if old in c:
        c = c.replace(old, new)
        print(f'  OK  {name}')
    else:
        print(f'  MISS {name}')
        ok = False

with open('calendarTemplate.js', 'w') as f:
    f.write(c)

print('\nAll done.' if ok else '\nSome patches missed — check output above.')
sys.exit(0 if ok else 1)
