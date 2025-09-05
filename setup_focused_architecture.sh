#!/bin/bash

# Focused Data Architecture Setup
# Addresses contract scraping priority and evaluation migration

echo "🎯 FOCUSED NBA DATA ARCHITECTURE SETUP"
echo "======================================"
echo ""
echo "📊 Bio Data: From existing comprehensive dataset"
echo "💰 Contract Data: Fresh scraping from Spotrac team pages"  
echo "👤 Evaluation Data: Migrated from Firebase (if credentials available)"
echo "📈 Team Cap Data: Scraped from salary overview pages"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Navigate to data pipeline
cd data_pipeline

echo "🚀 Starting focused contract migration..."
echo ""

# Run the focused migration system
node focused_contract_migration.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SETUP COMPLETE!"
    echo ""
    echo "📋 What was accomplished:"
    echo "   📊 Bio data processed from comprehensive existing dataset"
    echo "   💰 Contract data scraped using efficient team-based approach"
    echo "   👤 User evaluations migrated (if Firebase available)"
    echo "   📈 Team salary cap data collected"
    echo "   🗃️  New separated schema collections created"
    echo ""
    echo "🧪 Next Steps:"
    echo "   1. cd .. && npm run dev"
    echo "   2. Navigate to http://localhost:5173/"
    echo "   3. Verify ALL players show (not just 15)"
    echo "   4. Check Trade Machine functionality"
    echo "   5. Confirm your evaluations are preserved"
    echo ""
    echo "📋 DATA STRUCTURE EXPLANATION:"
    echo "   • nba_players: Bio data (height, weight, position, etc.)"
    echo "   • player_contracts: Salary and contract info"
    echo "   • player_evaluations: Your grades, roles, notes"
    echo "   • team_caps: Team salary totals and luxury tax info"
    echo ""
    echo "⚠️  If evaluations show 0 migrated:"
    echo "   - Provide Firebase credentials in .env file"
    echo "   - Re-run this script to migrate your evaluation data"
else
    echo ""
    echo "❌ Setup failed. Check error messages above."
    exit 1
fi