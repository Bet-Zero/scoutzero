#!/bin/bash

echo "🚀 NEW DATA ARCHITECTURE SETUP"
echo "=============================="
echo ""
echo "This script sets up the new separated data architecture:"
echo "📊 Fresh NBA data from scraping system"
echo "📝 Your personal evaluations preserved from old system"  
echo "🏗️ New separated collections (no fallback to old schema)"
echo ""
echo "🎯 WHAT THIS DOES:"
echo "=================="
echo "1. 📝 Migrates ONLY your evaluations (grades, roles, notes)"
echo "2. 🏀 Populates fresh NBA data in new schema"
echo "3. 🔄 Updates frontend to use new schema exclusively"
echo "4. 🧪 Ready for testing with complete separated architecture"
echo ""
echo "⚠️  IMPORTANT NOTES:"
echo "=================="
echo "✅ Your old 'players' collection is NOT modified (safe backup)"
echo "✅ Only YOUR evaluations are migrated (grades, roles, notes)"
echo "📊 NBA data comes from fresh scraping - NOT old data"
echo "🔄 Frontend will use new schema ONLY - no fallback"
echo ""
echo "Ready to set up the new architecture? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo ""
    echo "🚀 Setting up new data architecture..."
    echo ""
    
    cd data_pipeline
    
    echo "📝 Step 1: Migrating your evaluations only..."
    node migrate_evaluations_only.js
    
    echo ""
    echo "🏀 Step 2: Populating fresh NBA data..."
    node populate_nba_data.js
    
    echo ""
    echo "✅ NEW ARCHITECTURE SETUP COMPLETE!"
    echo ""
    echo "📋 WHAT WAS CREATED:"
    echo "=================="
    echo "📂 player_evaluations - Your grades/roles/notes"
    echo "📂 nba_players        - Fresh NBA stats/bio data" 
    echo "📂 player_contracts   - Individual contract data"
    echo "📂 team_caps          - Team salary cap information"
    echo ""
    echo "🧪 TESTING STEPS:"
    echo "================"
    echo "1. npm run dev"
    echo "2. Check all players show (not just 15)"
    echo "3. Verify your evaluations are preserved"
    echo "4. Test Trade Machine with individual contracts"
    echo ""
    echo "💡 Frontend now uses new schema exclusively (no fallback)"
    
else
    echo ""
    echo "ℹ️  Setup cancelled. Your data is unchanged."
fi