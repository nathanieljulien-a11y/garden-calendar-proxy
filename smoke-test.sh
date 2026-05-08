#!/usr/bin/env bash
# Garden Calendar — Production Smoke Test
# Run after every deploy: bash smoke-test.sh
# Requires: curl, jq
# Set ADMIN_SECRET and TEST_TOKEN as env vars or edit the defaults below.

set -euo pipefail

BACKEND="https://garden-calendar-proxy.onrender.com"
FRONTEND="https://garden-calendar-frontend.vercel.app"
ADMIN_SECRET="${ADMIN_SECRET:-}"
TEST_TOKEN="${TEST_TOKEN:-}"   # A known valid print or subscriber token for credit checks

PASS=0
FAIL=0

# ── Helpers ──────────────────────────────────────────────────────────────────

green() { echo -e "\033[32m✓ $1\033[0m"; }
red()   { echo -e "\033[31m✗ $1\033[0m"; }

check() {
  local label="$1"
  local result="$2"
  local expect="$3"
  if echo "$result" | grep -q "$expect"; then
    green "$label"
    PASS=$((PASS + 1))
  else
    red "$label (expected '$expect', got: $result)"
    FAIL=$((FAIL + 1))
  fi
}

# ── Backend health ────────────────────────────────────────────────────────────

echo ""
echo "── Backend ──────────────────────────────────────────────────────"

R=$(curl -sf "$BACKEND/api/health" || echo "UNREACHABLE")
check "GET /api/health → ok" "$R" "ok"

# ── Geocoding ─────────────────────────────────────────────────────────────────

R=$(curl -sf "$BACKEND/api/geocode?q=London" || echo "FAIL")
check "GET /api/geocode?q=London → lat present" "$R" "lat"

# ── Credits endpoint ─────────────────────────────────────────────────────────

if [ -n "$TEST_TOKEN" ]; then
  R=$(curl -sf "$BACKEND/api/credits/$TEST_TOKEN" || echo "FAIL")
  check "GET /api/credits/:token → plan present" "$R" "plan"
else
  echo "  (skipping credit check — TEST_TOKEN not set)"
fi

# ── Events summary (admin) ────────────────────────────────────────────────────

if [ -n "$ADMIN_SECRET" ]; then
  R=$(curl -sf "$BACKEND/api/events/summary" -H "x-admin-secret: $ADMIN_SECRET" || echo "FAIL")
  check "GET /api/events/summary → total present" "$R" "total"
else
  echo "  (skipping events summary — ADMIN_SECRET not set)"
fi

# ── Contact endpoint ─────────────────────────────────────────────────────────

R=$(curl -sf -X POST "$BACKEND/api/contact" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test","email":"smoke@example.com","topic":"feedback","message":"Automated smoke test — ignore"}' \
  || echo "FAIL")
check "POST /api/contact → accepted" "$R" "ok\|accepted\|sent"

# ── Frontend pages ────────────────────────────────────────────────────────────

echo ""
echo "── Frontend ─────────────────────────────────────────────────────"

R=$(curl -sf -o /dev/null -w "%{http_code}" "$FRONTEND/" || echo "000")
check "GET / → 200" "$R" "200"

R=$(curl -sf -o /dev/null -w "%{http_code}" "$FRONTEND/privacy" || echo "000")
check "GET /privacy → 200" "$R" "200"

R=$(curl -sf -o /dev/null -w "%{http_code}" "$FRONTEND/contact" || echo "000")
check "GET /contact → 200" "$R" "200"

# ── Order form ────────────────────────────────────────────────────────────────

echo ""
echo "── Order form ───────────────────────────────────────────────────"

R=$(curl -sf -o /dev/null -w "%{http_code}" "https://garden-calendar-order-form.vercel.app/" || echo "000")
check "GET order form / → 200" "$R" "200"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "  Passed: $PASS   Failed: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  ⚠ Smoke test failed — investigate before marking deploy complete."
  exit 1
else
  echo "  All checks passed."
  exit 0
fi
