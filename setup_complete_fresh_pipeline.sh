#!/bin/bash

# COMPLETE FRESH DATA PIPELINE SETUP
# ===================================
# 
# This script provides the complete workflow for implementing the new
# separated schema architecture with fresh scraped data.

echo "🚀 COMPLETE FRESH DATA PIPELINE"
echo "==============================="
echo ""
echo "⚠️  IMPORTANT: External scraping must be run locally"
echo "   This sandboxed environment blocks external APIs"
echo ""

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

cd data_pipeline

echo "📋 SETUP WORKFLOW:"
echo "=================="
echo ""
echo "LOCAL MACHINE STEPS (run these on your computer):"
echo "1. node local_fresh_data_scraper.js    # Scrapes fresh data from external sites"
echo "2. node migrate_and_structure.js       # Creates separated schema from fresh data"
echo "3. node load_to_firebase.js           # Uploads to Firebase"
echo ""
echo "SANDBOXED ENVIRONMENT STEPS (can run here for testing):"
echo "4. Update frontend to use new schema"
echo "5. Test application functionality"
echo ""

# Check environment capabilities
echo "🔍 ENVIRONMENT CHECK:"
echo "===================="

# Test external connectivity
echo -n "Spotrac access: "
if curl -s --connect-timeout 3 https://www.spotrac.com >/dev/null 2>&1; then
    echo "✅ Available"
    EXTERNAL_ACCESS=true
else
    echo "❌ Blocked"
    EXTERNAL_ACCESS=false
fi

echo -n "NBA API access: "
if curl -s --connect-timeout 3 https://stats.nba.com >/dev/null 2>&1; then
    echo "✅ Available"
else
    echo "❌ Blocked"
fi

# Check Firebase credentials
echo -n "Firebase credentials: "
if [ -f "../serviceAccountKey.json" ]; then
    echo "✅ Available"
    FIREBASE_AVAILABLE=true
else
    echo "❌ Not found"
    FIREBASE_AVAILABLE=false
fi

echo ""

# Provide specific instructions based on environment
if [ "$EXTERNAL_ACCESS" = false ]; then
    echo "⚠️  EXTERNAL ACCESS BLOCKED"
    echo "=========================="
    echo ""
    echo "This environment cannot access external APIs (Spotrac, NBA.com)."
    echo "To implement the new architecture:"
    echo ""
    echo "1. Copy these files to your local machine:"
    echo "   - data_pipeline/local_fresh_data_scraper.js"
    echo "   - data_pipeline/migrate_and_structure.js"
    echo "   - data_pipeline/load_to_firebase.js"
    echo ""
    echo "2. On your local machine, run:"
    echo "   cd data_pipeline"
    echo "   npm install axios cheerio  # If not already installed"
    echo "   node local_fresh_data_scraper.js"
    echo ""
    echo "3. The scraper will create fresh_scrape_*.json files"
    echo ""
    echo "4. Run the data processor:"
    echo "   node migrate_and_structure.js"
    echo ""
    echo "5. Upload to Firebase:"
    echo "   node load_to_firebase.js"
    echo ""
    echo "6. Update your frontend code to use the new collections:"
    echo "   - nba_players (bio/stats data)"
    echo "   - player_contracts (salary/contract data)"  
    echo "   - player_evaluations (your grades/notes)"
    echo "   - team_caps (team salary cap data)"
    echo ""
else
    echo "✅ FULL ACCESS AVAILABLE"
    echo "======================="
    echo ""
    echo "This environment can access external APIs."
    echo "Running complete pipeline..."
    
    if [ "$FIREBASE_AVAILABLE" = true ]; then
        echo ""
        echo "🚀 Step 1: Scraping fresh data..."
        node local_fresh_data_scraper.js
        
        echo ""
        echo "🔄 Step 2: Processing and structuring..."
        node migrate_and_structure.js
        
        echo ""
        echo "📤 Step 3: Uploading to Firebase..."
        node load_to_firebase.js
        
        echo ""
        echo "✅ Complete pipeline executed successfully!"
    else
        echo ""
        echo "⚠️  Running without Firebase - creating local files only"
        
        echo ""
        echo "🚀 Step 1: Scraping fresh data..."
        node local_fresh_data_scraper.js
        
        echo ""
        echo "🔄 Step 2: Processing and structuring..."
        node migrate_and_structure.js
        
        echo ""
        echo "📁 Files created in data_pipeline/output/separated_schema/"
        echo "   Run load_to_firebase.js when Firebase is available"
    fi
fi

echo ""
echo "📖 UNDERSTANDING THE NEW ARCHITECTURE"
echo "====================================="
echo ""
echo "The new separated schema creates 4 collections:"
echo ""
echo "📊 nba_players - Player bio/stats data"
echo "   - Player names, teams, positions, stats"
echo "   - Fresh from NBA APIs"
echo "   - No user evaluations mixed in"
echo ""
echo "💰 player_contracts - Contract/salary data"
echo "   - Individual player salaries"
echo "   - Contract lengths and details"
echo "   - Fresh from Spotrac scraping"
echo ""
echo "👤 player_evaluations - Your personal evaluations"
echo "   - Your grades, roles, notes, tiers"
echo "   - Migrated from existing Firebase data"
echo "   - Separated from NBA data for clean structure"
echo ""
echo "📈 team_caps - Team salary cap data"
echo "   - Team payroll totals"
echo "   - Cap space calculations"
echo "   - Luxury tax status"
echo ""
echo "✅ This eliminates the monolithic 'players' collection"
echo "✅ Each collection has a specific purpose"  
echo "✅ Easy to update individual data types"
echo "✅ Better performance and organization"

echo ""
echo "🔧 NEXT STEPS:"
echo "============="
echo ""
echo "After running the data pipeline:"
echo ""
echo "1. Update your frontend hooks to query the new collections"
echo "2. Test the Trade Machine with individual contracts"  
echo "3. Verify all your personal evaluations are preserved"
echo "4. Enjoy the cleaner, more maintainable data structure!"
echo ""

cd ..