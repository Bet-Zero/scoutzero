#!/bin/bash
# parse_all_tests.sh - Parse all test HTML files

cd "$(dirname "$0")/.."

echo "📋 Parsing all test cases..."

# Parse Luka Doncic
echo ""
echo "1. Parsing Luka Doncic..."
cp examples/luka_doncic_test.html examples/page.html
PLAYER_ID="luka_doncic" TEAM_CODE="DAL" npx tsx scripts/parse_player.ts

# Parse Austin Reaves  
echo ""
echo "2. Parsing Austin Reaves..."
cp examples/austin_reaves_test.html examples/page.html
PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npx tsx scripts/parse_player.ts

echo ""
echo "✅ All test cases parsed"
