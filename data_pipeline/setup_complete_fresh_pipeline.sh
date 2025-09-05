#!/bin/bash

# COMPLETE FRESH DATA PIPELINE SETUP
# ==================================
# 
# This script sets up the complete fresh data scraping pipeline with
# the new separated schema architecture.
#
# NO FALLBACKS: Empty results show what works vs what doesn't
# ENVIRONMENT AWARE: Detects restrictions and provides guidance
#
# Usage: ./setup_complete_fresh_pipeline.sh

echo ""
echo "🚀 COMPLETE FRESH DATA PIPELINE SETUP"
echo "====================================="
echo ""
echo "🎯 Goal: Implement new separated schema with fresh data scraping"
echo "📋 Starting Point: Your 630 player list"
echo "🏗️  Output: Four Firebase collections (nba_players, player_contracts, player_evaluations, team_caps)"
echo "🚫 NO FALLBACKS: Empty results show what works vs what doesn't"
echo ""

# Check environment capabilities
echo "🔍 Checking Environment Capabilities..."
echo ""

# Test external API access
echo "📡 Testing external API access..."
if curl -I "https://www.spotrac.com" --connect-timeout 5 >/dev/null 2>&1; then
    SPOTRAC_AVAILABLE=true
    echo "   ✅ Spotrac accessible"
else
    SPOTRAC_AVAILABLE=false
    echo "   ❌ Spotrac blocked (DNS/firewall restriction)"
fi

if curl -I "https://stats.nba.com" --connect-timeout 5 >/dev/null 2>&1; then
    NBA_API_AVAILABLE=true
    echo "   ✅ NBA API accessible"
else
    NBA_API_AVAILABLE=false
    echo "   ❌ NBA API blocked (DNS/firewall restriction)"
fi

# Check Firebase credentials
if [ -f "../serviceAccountKey.json" ]; then
    FIREBASE_AVAILABLE=true
    echo "   ✅ Firebase credentials available"
else
    FIREBASE_AVAILABLE=false
    echo "   ❌ Firebase credentials missing (../serviceAccountKey.json)"
fi

echo ""

# Determine execution strategy
if [ "$SPOTRAC_AVAILABLE" = true ] && [ "$NBA_API_AVAILABLE" = true ]; then
    echo "🎉 FULL CAPABILITY ENVIRONMENT"
    echo "=============================="
    echo "External APIs are accessible. You can run the complete pipeline here."
    echo ""
    echo "Steps to execute:"
    echo "1. node local_fresh_data_scraper.js    # Scrape fresh NBA + Spotrac data"
    echo "2. node migrate_and_structure.js       # Create separated schema"
    echo "3. node load_to_firebase.js            # Upload to Firebase"
    echo ""
    echo "🚀 Starting automated execution..."
    echo ""
    
    # Execute the pipeline
    echo "📊 Step 1: Fresh Data Scraping..."
    if node local_fresh_data_scraper.js; then
        echo "✅ Fresh data scraping completed"
        
        echo ""
        echo "📊 Step 2: Creating Separated Schema..."
        if node migrate_and_structure.js; then
            echo "✅ Schema migration completed"
            
            if [ "$FIREBASE_AVAILABLE" = true ]; then
                echo ""
                echo "📊 Step 3: Uploading to Firebase..."
                if node load_to_firebase.js; then
                    echo "✅ Firebase upload completed"
                    echo ""
                    echo "🎉 COMPLETE SUCCESS!"
                    echo "=================="
                    echo "Your new separated schema is live in Firebase."
                    echo "Run 'npm run dev' and check that all players load correctly."
                else
                    echo "❌ Firebase upload failed"
                fi
            else
                echo ""
                echo "⚠️  Firebase credentials not available"
                echo "Add serviceAccountKey.json to run Firebase upload"
            fi
        else
            echo "❌ Schema migration failed"
        fi
    else
        echo "❌ Fresh data scraping failed"
    fi
    
else
    echo "⚠️  SANDBOXED/RESTRICTED ENVIRONMENT"
    echo "===================================="
    echo "External APIs (Spotrac, NBA.com) are blocked in this environment."
    echo "This is normal for sandboxed/CI environments."
    echo ""
    echo "🏠 LOCAL MACHINE EXECUTION REQUIRED"
    echo ""
    echo "To run the complete fresh data pipeline:"
    echo ""
    echo "1. Download these scripts to your LOCAL machine:"
    echo "   - local_fresh_data_scraper.js"
    echo "   - migrate_and_structure.js" 
    echo "   - load_to_firebase.js"
    echo ""
    echo "2. On your LOCAL machine, run:"
    echo "   node local_fresh_data_scraper.js    # Scrapes fresh data (NBA + Spotrac)"
    echo "   node migrate_and_structure.js       # Creates separated schema"
    echo "   node load_to_firebase.js            # Uploads to Firebase"
    echo ""
    echo "3. Alternatively, run this same setup script on your local machine:"
    echo "   ./setup_complete_fresh_pipeline.sh"
    echo ""
    echo "💡 WHY LOCAL EXECUTION?"
    echo "======================"
    echo "External APIs like Spotrac and NBA.com are blocked in sandboxed environments"
    echo "for security reasons. Your local machine has full internet access and can"
    echo "scrape fresh data that gets processed into the new separated schema."
    echo ""
    echo "📊 WHAT HAPPENS IN THIS ENVIRONMENT"
    echo "=================================="
    echo "I can demonstrate the pipeline structure with sample data, but fresh scraping"
    echo "requires execution on your local machine where external APIs aren't blocked."
    echo ""
    
    # Create sample data structure demonstration
    echo "🔧 Creating sample data structure demonstration..."
    if node migrate_and_structure.js; then
        echo "✅ Sample separated schema structure created"
        echo "   This shows the format but contains no fresh data"
        echo "   Real data requires local execution where APIs aren't blocked"
    else
        echo "⚠️  Schema demonstration creation had issues"
    fi
fi

echo ""
echo "📝 SUMMARY"
echo "=========="
echo "External API Access:"
echo "  Spotrac: $([ "$SPOTRAC_AVAILABLE" = true ] && echo "✅ Available" || echo "❌ Blocked")"
echo "  NBA API: $([ "$NBA_API_AVAILABLE" = true ] && echo "✅ Available" || echo "❌ Blocked")"
echo "Firebase: $([ "$FIREBASE_AVAILABLE" = true ] && echo "✅ Available" || echo "❌ Missing credentials")"
echo ""
echo "🎯 ARCHITECTURE IMPLEMENTED:"
echo "📁 nba_players      - Fresh NBA player data"
echo "📁 player_contracts - Fresh Spotrac contract data"  
echo "📁 player_evaluations - Your migrated grades/roles/notes"
echo "📁 team_caps        - Calculated team salary caps"
echo ""
echo "🚫 NO FALLBACKS: Empty collections indicate what needs fresh data vs what worked"
echo ""