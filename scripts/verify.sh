#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== [1/4] Running PRD Grep Gates ==="

# Gate M1: No point buffer or Hyderabad default centroid
if grep -rn "78.4867\|17.3850\|default_buffer_m\|used_fallback_buffer" backend/app frontend/src 2>/dev/null; then
    echo "FAIL: Gate M1 violation (hardcoded coordinates or fallback buffer found)"
    exit 1
fi
echo "✓ Gate M1 passed"

# Gate M2: No soil constants or seeded RNG
if grep -rn "18\.5\|145\.0\|rng.uniform" backend/app/services/soil 2>/dev/null; then
    echo "FAIL: Gate M2 violation (synthetic soil constants found)"
    exit 1
fi
echo "✓ Gate M2 passed"

# Gate M11: No paused ISRIC URL
if grep -rn "rest.isric.org" backend/app 2>/dev/null; then
    echo "FAIL: Gate M11 violation (rest.isric.org found)"
    exit 1
fi
echo "✓ Gate M11 passed"

# Gate M13: No fabricated land-record labels
if grep -rn "Agricultural / Cultivable\|Agricultural Cropland" backend/app 2>/dev/null; then
    echo "FAIL: Gate M13 violation (fabricated land record strings found)"
    exit 1
fi
echo "✓ Gate M13 passed"

# Gate M18: No silent defaults in feature pipeline
if grep -rn "13\.32\|75\.75\|320\.0\|, 0\.5)" backend/app/services/features 2>/dev/null; then
    echo "FAIL: Gate M18 violation (silent feature defaults found)"
    exit 1
fi
echo "✓ Gate M18 passed"

# Gate M20: No guessed KSRSAC geoserver URL
if grep -rn "ksrsac.karnataka.gov.in/geoserver" backend 2>/dev/null; then
    echo "FAIL: Gate M20 violation (guessed KSRSAC geoserver URL found)"
    exit 1
fi
echo "✓ Gate M20 passed"

echo "=== [2/4] Running Backend Tests ==="
cd "$REPO_ROOT/backend"
venv/bin/python -m pytest tests/ -q

echo "=== [3/4] Building Frontend ==="
cd "$REPO_ROOT/frontend"
npm run build

echo "=== [4/5] Auditing CSS Classes ==="
cd "$REPO_ROOT"
python3 scripts/audit_css_classes.py

echo "=== [5/5] Verification Complete ==="
echo "ALL GATES & BUILDS PASSED (EXIT 0)"
exit 0
