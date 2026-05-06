#!/usr/bin/env bash
# Clone STEPBible-Data for Hebrew/Greek lemmas + Strong's tags.
# We only want the TAGNT (Greek NT) and TAHOT (Hebrew OT) tagged TSVs — the
# repo also contains many large translations we don't need, so use a sparse
# checkout to keep it manageable.
#
# Output: bible-data/STEPBible-Data/  (~150 MB → trimmed to ~50 MB after sparse)

set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p bible-data
cd bible-data

if [ -d STEPBible-Data ]; then
  echo "✓ STEPBible-Data already cloned. Pulling latest…"
  cd STEPBible-Data
  git pull --depth 1
  exit 0
fi

git clone --depth 1 --filter=blob:none --sparse https://github.com/STEPBible/STEPBible-Data.git
cd STEPBible-Data
# Pick only what we need: tagged Greek + Hebrew with Strong's
git sparse-checkout set \
  "TAGNT - Translators Amalgamated Greek NT - STEPBible.org CC BY.txt" \
  "TAHOT - Translators Amalgamated OT+ - STEPBible.org CC BY.txt" \
  "Lexicons" \
  "README.md"

echo "✓ STEPBible-Data ready"
ls -lh
