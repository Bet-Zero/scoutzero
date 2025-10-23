# Player-Scrape

NBA player contract scraper for populating `players_v2` Firestore collection.

## 🚀 Quick Start

**Current Status:** 85% Ready → [Get to 100% Ready](./GETTING_STARTED.md)

**Want to get started right away?** 
- **Fast track:** [PATH_TO_100.md](./PATH_TO_100.md) - Visual summary (3 steps, 1-2 days)
- **Detailed guide:** [GETTING_STARTED.md](./GETTING_STARTED.md) - Complete instructions with code

## Documentation

- **[PATH_TO_100.md](./PATH_TO_100.md)** - **QUICK VIEW!** Visual 3-step summary to 100%
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - **START HERE!** Complete guide from 0% to 100% ready
- **[READINESS_ASSESSMENT.md](./READINESS_ASSESSMENT.md)** - Detailed 85% readiness analysis
- **[QUICK_SUMMARY.md](./QUICK_SUMMARY.md)** - Executive summary of current state
- **[docs/README.md](./docs/README.md)** - Full technical documentation
- **[docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)** - Playwright installation instructions

## What Does This Do?

Scrapes NBA player contract data from [SalarySwish](https://salaryswish.com) and outputs structured JSON ready for uploading to:
- **Primary target:** `players_v2/{playerId}/contracts/{contractId}` in Firestore
- **Secondary target:** `architect/basePlayers` (future)

## Key Features

✅ Comprehensive contract data (salary breakdown, options, guarantees)  
✅ Bird rights and free agency information  
✅ Trade eligibility and CBA-specific fields  
✅ Handles rookie scale, veteran, and extension contracts  
✅ **Detects and parses future contracts/extensions** (e.g., signed extensions that haven't started yet)  
✅ Batch processing for multiple players  

## Prerequisites

- Node.js 18+
- Playwright browser (run `npx playwright install chromium`)
- Firebase Admin SDK configured (for uploading)

## Quick Commands

```bash
# Single player workflow
PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npm run parse-player
npm run validate-player

# Batch processing
PLAYERS_FILE="examples/players_list.json" npm run batch-scrape-players
```

## Need Help?

1. **Getting to 100% ready?** → [GETTING_STARTED.md](./GETTING_STARTED.md)
2. **Installation issues?** → [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)
3. **Understanding the assessment?** → [READINESS_ASSESSMENT.md](./READINESS_ASSESSMENT.md)
4. **Full documentation?** → [docs/README.md](./docs/README.md)

## Status Overview

| Component | Status | Action |
|-----------|--------|--------|
| Parser & Schema | ✅ Ready | Validated and tested |
| Playwright Setup | ⚠️ Required | Run `npx playwright install chromium` |
| Real Data Testing | ⚠️ Required | Test with live SalarySwish pages |
| Transform Layer | 🔨 Needed | Create for players_v2 compatibility |
| Upload Script | 🔨 Needed | Create for Firestore deployment |
| Integration Tests | 📊 Optional | Recommended for confidence |

**See [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed instructions on completing all required and recommended steps.**
