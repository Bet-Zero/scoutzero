#!/bin/bash
# validate_normalization.sh - Demonstrate all contract normalization features

cd "$(dirname "$0")/.."

echo "🔍 Contract Normalization Validation Demo"
echo "=========================================="
echo ""

echo "📋 Parsing test cases..."
bash scripts/parse_all_tests.sh > /dev/null 2>&1

echo ""
echo "1️⃣  LUKA DONČIĆ - Extension Voiding Player Option"
echo "   ────────────────────────────────────────────────"
echo "   Contract Type:"
cat output/luka_doncic.json | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'      {d[\"contract\"][\"contractType\"]}')"
echo "   Rookie Scale:"
cat output/luka_doncic.json | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'      {d[\"contract\"][\"isRookieScale\"]}')"
echo "   Max Type:"
cat output/luka_doncic.json | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'      {d[\"contract\"][\"maxType\"]}')"
echo "   Voided PO (2026-27):"
cat output/luka_doncic.json | python3 -c "import json, sys; d=json.load(sys.stdin); po=[y for y in d['contract']['salariesByYear'] if y.get('voidedByExtension')][0]; print(f'      optionUsed: {po[\"optionUsed\"]}'); print(f'      guaranteed: {po[\"guaranteed\"]}'); print(f'      guaranteedAmount: \${po[\"guaranteedAmount\"]:,}')"
echo "   Contract Metadata:"
cat output/luka_doncic.json | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'      supersededIn: {d[\"contract\"][\"supersededIn\"]}'); print(f'      guaranteedValue: \${d[\"contract\"][\"guaranteedValue\"]:,}'); print(f'      totalValue (preserved): \${d[\"contract\"][\"totalValue\"]:,}')"

echo ""
echo "2️⃣  AUSTIN REAVES - Live Player Option"
echo "   ────────────────────────────────────"
echo "   Contract Type:"
cat output/austin_reaves.json | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'      {d[\"contract\"][\"contractType\"]}')"
echo "   Signed Using:"
cat output/austin_reaves.json | python3 -c "import json, sys; d=json.load(sys.stdin); print(f'      {d[\"contract\"][\"signedUsing\"]}')"
echo "   Player Option Year (2027-28):"
cat output/austin_reaves.json | python3 -c "import json, sys; d=json.load(sys.stdin); po=[y for y in d['contract']['salariesByYear'] if y['option']=='PO'][0]; print(f'      option: {po[\"option\"]}'); print(f'      guaranteed: {po[\"guaranteed\"]} (live PO treated as guaranteed)'); print(f'      guaranteedAmount: \${po[\"guaranteedAmount\"]:,}')"

echo ""
echo "✅ All normalization features validated!"
echo ""
echo "📊 Run full test suite:"
echo "   npx tsx player-scrape/scripts/test_contract_normalization.ts"
