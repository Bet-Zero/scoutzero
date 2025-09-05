#!/bin/bash

# Focused Data Architecture Setup
# Addresses contract scraping priority and evaluation migration

echo "🎯 WORKING NBA DATA ARCHITECTURE SETUP"
echo "====================================="
echo ""
echo "📊 Bio Data: From existing comprehensive dataset"
echo "💰 Contract Data: Extracted from existing players.json (has real contract data!)"  
echo "👤 Evaluation Data: Migrated from Firebase (if credentials available)"
echo "📈 Team Cap Data: Calculated from actual contract values"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Navigate to data pipeline
cd data_pipeline

echo "🚀 Starting working contract migration..."
echo ""

# Run the working migration system that uses existing contract data
node working_contract_migration.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SETUP COMPLETE!"
    echo ""
    echo "📋 What was accomplished:"
    echo "   📊 Bio data processed from comprehensive existing dataset"
    echo "   💰 Contract data extracted from existing players.json (real contracts!)"
    echo "   👤 User evaluations migrated (if Firebase available)"
    echo "   📈 Team salary cap data calculated from actual contracts"
    echo "   🗃️  New separated schema collections created"
    echo ""
    echo "📁 DATA FILES CREATED:"
    echo "   • data_pipeline/output/nba_players.json (630 players)"
    echo "   • data_pipeline/output/player_contracts.json (630 contracts)"
    echo "   • data_pipeline/output/team_caps.json (30 teams)"
    echo "   • data_pipeline/output/player_evaluations.json (your grades)"
    echo ""
    echo "🔥 TO USE WITH FIREBASE:"
    echo "   1. Add your Firebase credentials to serviceAccountKey.json"
    echo "   2. cd data_pipeline && node load_separated_data_to_firebase.js"
    echo "   3. Your app will then use the new separated schema"
    echo ""
    echo "🧪 TO TEST THE NEW STRUCTURE:"
    echo "   1. cd .. && npm run dev"
    echo "   2. Navigate to http://localhost:5173/"
    echo "   3. Check if ALL players show (should be 630, not 15)"
    echo "   4. Test Trade Machine functionality"
    echo ""
    echo "📋 DATA STRUCTURE EXPLANATION:"
    echo "   • nba_players: Bio data (height, weight, position, stats)"
    echo "   • player_contracts: Salary and contract info (real data!)"
    echo "   • player_evaluations: Your grades, roles, notes"
    echo "   • team_caps: Team salary totals calculated from contracts"
    echo ""
    echo "✅ CONTRACT DATA SOURCE:"
    echo "   - Uses existing players.json which already has contract info"
    echo "   - No external scraping needed - data is already there!"
    echo "   - Real contract values and free agency info preserved"
    echo ""
    echo "⚠️  IMPORTANT: The frontend expects the new separated schema."
    echo "   Without Firebase data, you'll see 'No NBA data found' errors."
    echo "   This is expected - load the data to Firebase to fix this."
    echo ""
    echo "⚠️  If evaluations show 0 migrated:"
    echo "   - Provide Firebase credentials in .env file"
    echo "   - Re-run this script to migrate your evaluation data"
else
    echo ""
    echo "❌ Setup failed. Check error messages above."
    exit 1
fi