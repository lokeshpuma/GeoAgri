#!/usr/bin/env bash
# GeoAgri repository clean-up. Run from the repository root on a clean git tree.
# Safe: uses git mv / git rm only, stops on the first error, and changes nothing outside git's index.
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

[ -d .git ] || { echo "Run from the repository root (no .git here)"; exit 1; }
[ -z "$(git diff --name-only)" ] || { echo "Commit or stash your changes first"; exit 1; }

mv_if() { [ -e "$1" ] && { mkdir -p "$(dirname "$2")"; git mv "$1" "$2"; echo "moved  $1 -> $2"; } || echo "skip   $1 (not found)"; }
rm_if() { [ -e "$1" ] && { git rm -rq "$1"; echo "removed $1"; } || echo "skip   $1 (not found)"; }

# 1. Planning documents leave the root and become project history
mkdir -p docs/prd
mv_if PRD.md                                          docs/prd/PRD_v1_baseline.md
mv_if PRD_v3.2_Confirm_Fix_and_Global_Crops.md        docs/prd/PRD_v3.2_Confirm_Fix_and_Global_Crops.md
mv_if PRD_v3.3_Audit_Fixes_Layout_and_Recommender.md  docs/prd/PRD_v3.3_Audit_Fixes_Layout_and_Recommender.md
mv_if PRD_v3.4_Truthful_Data_UI_Recovery_and_Repo_Cleanup.md docs/prd/PRD_v3.4_Truthful_Data_UI_Recovery_and_Repo_Cleanup.md

# 2. Guides move under docs/
mv_if DATA_GUIDE.md   docs/data-guide.md
mv_if run.md          docs/running-locally.md

# 3. "documentation/" becomes "docs/" (one documentation folder, not two)
for f in architecture.md api_reference.md; do mv_if "documentation/$f" "docs/$f"; done
mv_if documentation/model_cards docs/model-cards
mv_if documentation/result      docs/results
mv_if documentation/screens     docs/screenshots

# 4. Files that are AI prompts, not project documentation
rm_if geoagri_data_expansion_training_prompt.md

# 5. Dead code: vercel.json sends /api to Render, so this Vercel function is never used
rm_if api

# 6. Generated or unused artefacts that should not live in git
rm_if backend/ml/data/processed/faostat_yields.parquet     # 10 MB, rebuilt by load_faostat.py
rm_if backend/ml/data/processed/registry_calibrated.json   # 3 MB, not read by the app

# 7. Local-machine image links in the results docs become relative links
if [ -d docs/results ]; then
  U_PREFIX="Users"
  grep -rl "file:///${U_PREFIX}/" docs/results 2>/dev/null | while read -r f; do
    sed -i.bak -E "s#file:///${U_PREFIX}/[^)]*/documentation/result/assets/#assets/#g" "$f" && rm -f "$f.bak"
    echo "fixed  image links in $f"
  done
fi

# 8. Keep generated files out of git from now on
{
  echo ""
  echo "# Generated data (rebuild with backend/ml/training/*)"
  echo "backend/ml/data/processed/*.parquet"
  echo "backend/ml/data/processed/registry_calibrated.json"
  echo "backend/.cache/"
  echo "frontend/test-results/"
  echo "frontend/playwright-report/"
} >> .gitignore
git add .gitignore
