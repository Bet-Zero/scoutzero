# Complete Fresh Data Scraping Pipeline

This pipeline implements the complete separated schema architecture with working fresh data scraping that addresses environmental limitations.

## Overview

**Goal**: Replace old data structure with fresh scraped data in new separated schema
**Starting Point**: Your 630 player list from `public/players.json`  
**Output**: Four Firebase collections with fresh NBA data and preserved user evaluations
**Policy**: NO FALLBACKS - Empty results show what works vs what doesn't

## Architecture

### New Separated Schema (Four Collections)

1. **`nba_players`** - Fresh NBA player data (bio, team, status)
2. **`player_contracts`** - Fresh Spotrac contract data (salary, years, terms)
3. **`player_evaluations`** - Your migrated grades, roles, notes (ONLY data preserved from old system)
4. **`team_caps`** - Team salary cap calculations from fresh contract data

### No Fallbacks Policy

- If NBA API scraping fails → `nba_players` collection will be empty
- If Spotrac scraping fails → `player_contracts` and `team_caps` collections will be empty  
- If Firebase not accessible → `player_evaluations` collection will be empty
- Empty results clearly show what worked vs what needs fixing

## Environment Handling

### Sandboxed Environment (Current)
External APIs (Spotrac, NBA.com) are DNS blocked for security.
- ❌ Cannot scrape fresh data here
- ✅ Can create schema structure and demonstrate pipeline
- ✅ Can migrate evaluations if Firebase credentials available

### Local Machine Environment (Required for Fresh Data)
Full internet access allows actual fresh data scraping.
- ✅ Can scrape from Spotrac team salary pages
- ✅ Can fetch from NBA.com player APIs
- ✅ Can complete full pipeline with real data

## Usage

### Complete Setup (One Command)

```bash
./setup_complete_fresh_pipeline.sh
```

This script:
- Detects environment capabilities
- Runs full pipeline if external APIs available
- Provides local execution instructions if APIs blocked
- Creates clear success/failure indicators

### Manual Step-by-Step

#### 1. Fresh Data Scraping (Run Locally)
```bash
node local_fresh_data_scraper.js
```
- Scrapes NBA player data from NBA.com API (630+ players)
- Scrapes contract data from Spotrac team pages (30 requests vs 450+ individual)
- Creates `output/fresh_data.json` with all scraped results
- **Must run on local machine** where external APIs aren't blocked

#### 2. Create Separated Schema
```bash
node migrate_and_structure.js
```
- Loads fresh scraped data from step 1
- Migrates ONLY your user evaluations from Firebase (grades, roles, notes)
- Creates four separated collections in JSON format
- NO fallbacks to old NBA data - uses only fresh scraped data

#### 3. Upload to Firebase
```bash
node load_to_firebase.js
```
- Uploads separated schema collections to Firebase
- Uses batch processing with progress logging
- Creates backup of existing data before upload
- Requires `serviceAccountKey.json` in parent directory

## Data Sources

### Fresh Data (Scraped)
- **NBA Player Data**: `stats.nba.com/stats/commonallplayers` API
- **Contract Data**: Spotrac team salary pages (e.g., `spotrac.com/nba/boston-celtics/`)
- **Team Caps**: Calculated from aggregated contract data

### Preserved Data (Migrated)
- **User Evaluations**: Your grades, roles, notes, tiers from existing Firebase `players` collection
- **Nothing Else**: No NBA stats, bio data, or contracts are preserved from old system

## Environment Detection

The setup script automatically detects:

```bash
# External API Access
curl -I "https://www.spotrac.com" --connect-timeout 5      # Contract scraping
curl -I "https://stats.nba.com" --connect-timeout 5        # NBA player data

# Firebase Credentials  
ls ../serviceAccountKey.json                                # Firebase upload capability
```

## Success Indicators

### Full Success (All Fresh Data)
```
🏀 NBA Players: 630 (SUCCESS)
💰 Contracts: 450 (SUCCESS)  
👤 Evaluations: 25 (SUCCESS)
📊 Team Caps: 30 (SUCCESS)
```

### Partial Success (Restricted Environment)
```
🏀 NBA Players: 0 (FAILED - no fresh NBA data)
💰 Contracts: 0 (FAILED - no fresh contract data)
👤 Evaluations: 25 (SUCCESS)
📊 Team Caps: 0 (FAILED - no contract data for calculations)
```

### Frontend Integration

The frontend (`useSimplePlayerData.js`) uses the new schema exclusively:
- Reads from `nba_players`, `player_contracts`, `player_evaluations` collections
- Combines data for complete player profiles  
- NO fallback to old `players` collection
- Empty collections will result in no players displayed (shows what needs fresh data)

## File Structure

```
data_pipeline/
├── local_fresh_data_scraper.js     # Fresh data scraping (run locally)
├── migrate_and_structure.js        # Schema migration (no fallbacks)  
├── load_to_firebase.js             # Firebase upload with batching
├── setup_complete_fresh_pipeline.sh # One-command setup with environment detection
└── output/
    ├── fresh_data.json             # Raw scraped data
    ├── nba_players.json            # NBA player collection data
    ├── player_contracts.json       # Contract collection data
    ├── player_evaluations.json     # Evaluation collection data
    └── team_caps.json              # Team cap collection data
```

## Troubleshooting

### "No fresh data available" Error
- External APIs are blocked in current environment
- Run `local_fresh_data_scraper.js` on your local machine
- Copy resulting `output/fresh_data.json` back to pipeline

### "No evaluations to migrate" 
- Firebase credentials not available
- Add `serviceAccountKey.json` to parent directory
- Run migration script locally with Firebase access

### "Empty collections in frontend"
- Check Firebase upload was successful
- Verify new collections exist in Firebase console  
- Ensure `useSimplePlayerData.js` is using new schema (not old `players` collection)

## Real-World Workflow

1. **Development**: Run complete pipeline on local machine with full API access
2. **Deployment**: Upload processed data to Firebase from local environment
3. **Production**: Frontend reads from populated Firebase collections
4. **Updates**: Re-run local scraping pipeline to refresh with current data

This approach handles the reality that external APIs are often blocked in deployment environments while providing a complete local development and data refresh workflow.