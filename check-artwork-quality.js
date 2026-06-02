#!/usr/bin/env bash
# check-artwork-quality.sh
# Run in the Render Shell (or locally) from the repo root.
# Produces: artwork-quality-check.pdf
# Each page = one illustration, with filename + resolution printed beneath.
# Requires: ImageMagick (convert, montage, identify) — available on Render.

set -euo pipefail

ARTWORK_DIR="./artwork"
OUT_DIR="/tmp/art-qc-pages"
FINAL_PDF="./artwork-quality-check.pdf"
MAX_PLANTS=20          # cap to keep PDF manageable; set to 999 for all
FILTER="garden"        # only include plants with this verdict in artwork-review-results.json
                       # set to "" to include everything

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/*.pdf

echo "=== Artwork quality check PDF builder ==="
echo "Source: $ARTWORK_DIR"
echo "Output: $FINAL_PDF"
echo ""

# ── Optional: read verdicts from artwork-review-results.json ──────────────────
# If the file exists, build an allowlist of garden-approved plants.
ALLOWLIST=""
if [ -n "$FILTER" ] && [ -f "./artwork-review-results.json" ]; then
  echo "Reading verdicts from artwork-review-results.json (filter: $FILTER)..."
  ALLOWLIST=$(node -e "
    const results = require('./artwork-review-results.json');
    const approved = Object.entries(results)
      .filter(([,v]) => v.verdict === '$FILTER' && v.widthPx >= 2400)
      .map(([k]) => k);
    console.log(approved.join('\n'));
  " 2>/dev/null || echo "")
  COUNT=$(echo "$ALLOWLIST" | grep -c . || true)
  echo "  → $COUNT garden-approved ≥2400px plants found"
else
  echo "No filter applied — including all files in $ARTWORK_DIR"
fi

# ── Build one PDF page per image ──────────────────────────────────────────────
PAGE=0
for IMG in "$ARTWORK_DIR"/*.jpg "$ARTWORK_DIR"/*.jpeg "$ARTWORK_DIR"/*.png; do
  [ -f "$IMG" ] || continue
  BASENAME=$(basename "$IMG")
  STEM="${BASENAME%.*}"

  # Apply allowlist filter if active
  if [ -n "$ALLOWLIST" ] && ! echo "$ALLOWLIST" | grep -qx "$STEM"; then
    continue
  fi

  [ "$PAGE" -ge "$MAX_PLANTS" ] && break

  # Get pixel dimensions
  DIMS=$(identify -format "%wx%h" "$IMG" 2>/dev/null || echo "?x?")
  WIDTH=$(echo "$DIMS" | cut -dx -f1)
  LABEL="${STEM}  |  ${DIMS}px"

  PAGE_PDF="$OUT_DIR/$(printf '%03d' $PAGE)_${STEM}.pdf"

  # Compose: image + label text below, A4 portrait
  convert \
    -size 2480x3508 xc:white \
    \( "$IMG" -resize 2480x2800\> -gravity Center -extent 2480x2800 \) \
    -gravity North -composite \
    -font DejaVu-Sans -pointsize 48 \
    -fill "#1E1208" \
    -annotate +0+2870 "$LABEL" \
    -compress jpeg \
    "$PAGE_PDF"

  echo "  [$((PAGE+1))] $LABEL"
  PAGE=$((PAGE+1))
done

echo ""
echo "Pages built: $PAGE"

if [ "$PAGE" -eq 0 ]; then
  echo "ERROR: No images found. Check ARTWORK_DIR and FILTER settings."
  exit 1
fi

# ── Merge all pages into one PDF ──────────────────────────────────────────────
echo "Merging into $FINAL_PDF..."
convert "$OUT_DIR"/*.pdf "$FINAL_PDF"

echo ""
echo "Done. File: $FINAL_PDF"
echo "Page count: $PAGE"
echo ""
echo "To download: copy the file from Render disk, or run:"
echo "  curl -u admin:<password> https://your-render-url/path-if-exposed"
echo ""
echo "Or use the Render dashboard → Disks → Browse to locate the file."
