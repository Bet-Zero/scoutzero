#!/bin/bash
# Complete pipeline to scrape and upload Players v2 contract data

echo "🏀 Players v2 Contract Scraper Pipeline"
echo "========================================================================"
echo ""

# Step 1: Scrape player pages
echo "📡 Step 1: Scraping player contract pages from SalarySwish..."
echo "------------------------------------------------------------------------"
python3 scrape_players_v2.py
SCRAPE_STATUS=$?

if [ $SCRAPE_STATUS -ne 0 ]; then
    echo ""
    echo "❌ Scraping failed! Check connectivity to SalarySwish."
    exit 1
fi

echo ""
echo "------------------------------------------------------------------------"
echo ""

# Step 2: Parse to architect schema
echo "🔄 Step 2: Parsing contract data to architect schema..."
echo "------------------------------------------------------------------------"
python3 parse_players_v2.py
PARSE_STATUS=$?

if [ $PARSE_STATUS -ne 0 ]; then
    echo ""
    echo "❌ Parsing failed! Check scraped data format."
    exit 1
fi

echo ""
echo "------------------------------------------------------------------------"
echo ""

# Step 3: Upload to Firestore
echo "☁️  Step 3: Uploading to Firestore /architect/basePlayers..."
echo "------------------------------------------------------------------------"
node upload_players_v2.js
UPLOAD_STATUS=$?

if [ $UPLOAD_STATUS -ne 0 ]; then
    echo ""
    echo "❌ Upload failed! Check Firestore credentials."
    exit 1
fi

echo ""
echo "========================================================================"
echo "✅ Pipeline Complete!"
echo "========================================================================"
echo ""
echo "📁 Data available at: /architect/basePlayers/players/{playerId}"
echo "🔧 Ready for use in Architect GM Tools"
echo ""
