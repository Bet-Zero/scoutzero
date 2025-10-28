# Player-Scrape

NBA player contract scraper for populating `players_v2` Firestore collection.

## 🚀 Quick Start

**Current Status:** ✅ Production Ready - [See Current Status](./STATUS.md)

**System is fully functional** with all contract normalization features implemented and tested.

### Quick Commands

```bash
# Parse a single player (using cached HTML)
PLAYER_ID="player_name" TEAM_CODE="XXX" npx tsx player-scrape/scripts/parse_player.ts

# Fetch and parse from SalarySwish
PLAYER_URL="https://salaryswish.com/players/austin-reaves" \
PLAYER_ID="austin_reaves" \
TEAM_CODE="LAL" \
npx tsx player-scrape/scripts/parse_player.ts

# Batch process multiple players
PLAYERS_FILE="examples/players_list_sample.json" \
npx tsx player-scrape/scripts/batch_scrape_players.ts

# Validate output
npx tsx player-scrape/scripts/validate_player.ts
```

## Documentation

- **[STATUS.md](./STATUS.md)** - Current system status and capabilities
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and updates
- **[docs/README.md](./docs/README.md)** - Full technical documentation
- **[docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)** - Playwright installation guide
- **[docs/NORMALIZATION_IMPLEMENTATION.md](./docs/NORMALIZATION_IMPLEMENTATION.md)** - Technical implementation details
- **[docs/COMPLETION_SUMMARY.md](./docs/COMPLETION_SUMMARY.md)** - Implementation completion notes

## What Does This Do?

Scrapes NBA player contract data from [SalarySwish](https://salaryswish.com) and outputs structured JSON ready for uploading to:
- **Primary target:** `players_v2/{playerId}/contracts/{contractId}` in Firestore
- **Secondary target:** `architect/basePlayers` (future)

## Key Features

✅ Comprehensive contract data (salary breakdown, options, guarantees)  
✅ Guarantee schedules - Tracks partial guarantee triggers and dates  
✅ Option tracking - Captures when options are exercised/declined with dates  
✅ Extension voiding - Properly handles extensions that void player options  
✅ Contract type precision - Distinguishes ROOKIE SCALE from ROOKIE CONTRACT  
✅ Bird rights and free agency information  
✅ Trade eligibility and CBA-specific fields  
✅ Handles rookie scale, veteran, and extension contracts  
✅ Detects and parses future contracts/extensions  
✅ Independent metadata parsing - Each contract reports its own signing details  
✅ Batch processing for multiple players  
✅ Test suite - Validates normalization against spec requirements  

## Prerequisites

- Node.js 18+
- Playwright browser installed (check: `npx playwright --version`)
- Firebase Admin SDK configured (optional, for uploading to Firestore)

## System Status

| Component | Status | Notes |
|-----------|--------|-------|
| Parser & Schema | ✅ Complete | All normalization features implemented |
| Playwright Setup | ✅ Complete | Version 1.56.0 installed |
| Scripts | ✅ Working | Fetch, parse, validate, batch all tested |
| Test Suite | ✅ Passing | Contract normalization validated |
| Transform Layer | 📋 Future | Optional for players_v2 format conversion |
| Upload Script | 📋 Future | Optional for automated Firestore deployment |

## Need Help?

1. **Current status?** → [STATUS.md](./STATUS.md)
2. **Installation issues?** → [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)
3. **Technical details?** → [docs/README.md](./docs/README.md)
4. **Implementation notes?** → [docs/NORMALIZATION_IMPLEMENTATION.md](./docs/NORMALIZATION_IMPLEMENTATION.md)
