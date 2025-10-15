#!/bin/bash
# Example: Run team scraper with Fanspo enrichment for multiple teams
#
# This script demonstrates how to use the Fanspo enrichment feature
# for different NBA teams using mock data

echo "🏀 NBA Team Scraper - Fanspo Enrichment Demo"
echo "==========================================="
echo ""

# Function to run parser with Fanspo enrichment
run_team_parse() {
  local team_name=$1
  local team_slug=$2
  local team_id=$3
  local team_code=$4
  
  echo "📊 Processing: $team_name ($team_code)"
  echo "   Team Slug: $team_slug"
  echo "   Team ID: $team_id"
  echo ""
  
  FANSPO_ENRICH=1 \
  FANSPO_MOCK=1 \
  TEAM_SLUG="$team_slug" \
  TEAM_ID="$team_id" \
  TEAM_CODE="$team_code" \
  npm run parse-mock
  
  echo ""
  echo "✅ Draft picks with Fanspo data:"
  cat team.json | jq -r '.draftPicks[] | select(.fromTeams or .toTeams) | "  \(.year) Round \(.round): \(if .fromTeams then "from " + (.fromTeams | join(", ")) else "" end)\(if .toTeams then "to " + (.toTeams | join(", ")) else "" end) \(if .protections then "(\(.protections))" else "" end)"'
  
  echo ""
  echo "---"
  echo ""
}

# Lakers example
run_team_parse "Los Angeles Lakers" "Lakers" 14 "LAL"

# Celtics example  
run_team_parse "Boston Celtics" "Celtics" 2 "BOS"

# Warriors example
run_team_parse "Golden State Warriors" "Warriors" 9 "GSW"

echo ""
echo "🎉 Demo complete!"
echo ""
echo "📚 For more information:"
echo "   - See FANSPO_ENRICHMENT.md for detailed documentation"
echo "   - See FANSPO_DEMO.md for before/after comparisons"
echo "   - Run 'npx tsx team-scrape/test_fanspo_enrichment.ts' for unit tests"
