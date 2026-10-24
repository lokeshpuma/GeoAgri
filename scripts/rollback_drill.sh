#!/usr/bin/env bash
set -e

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== [Rollback Drill §19.6] Starting Drill ==="

# 1. Stash uncommitted changes if any
echo "1. Stashing working tree..."
git stash -u || true

# 2. Switch to baseline-v2.0 tag and run pytest
echo "2. Switching to baseline-v2.0 tag..."
git switch --detach baseline-v2.0
(cd backend && venv/bin/python -m pytest tests/test_phase8_landclass.py tests/test_phase9_irrigability.py -q)
echo "✓ Baseline tests passed"

# 3. Switch to latest step tag
LAST_STEP_TAG=$(git tag -l "step-S*" | sort -V | tail -n 1)
if [ -n "$LAST_STEP_TAG" ]; then
    echo "3. Switching to latest step tag: $LAST_STEP_TAG..."
    git switch --detach "$LAST_STEP_TAG"
    (cd backend && venv/bin/python -m pytest tests/test_no_default_leak.py -q)
    echo "✓ Step tag $LAST_STEP_TAG tests passed"
fi

# 4. Return to active integration branch
echo "4. Returning to integrate/detection branch..."
git switch integrate/detection

# 5. Runtime flag test: LAND_DETECTION_MODE=off LAND_GATE_MODE=off
echo "5. Testing runtime switches (detection=off, gate=off)..."
(
    cd backend
    LAND_DETECTION_MODE=off LAND_GATE_MODE=off venv/bin/python -c '
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
res = client.post("/api/v1/predict/full-report", json={
    "polygon": [
        [77.5850, 12.9650],
        [77.5870, 12.9650],
        [77.5870, 12.9670],
        [77.5850, 12.9670],
        [77.5850, 12.9650]
    ],
    "season": "kharif"
})
assert res.status_code == 200, f"Expected 200, got {res.status_code}"
data = res.json()
assert "field_summary" in data
assert "land_class" in data
assert "irrigability" in data
print("Runtime off-switch verified successfully.")
'
)

echo "ROLLBACK OK"
exit 0
