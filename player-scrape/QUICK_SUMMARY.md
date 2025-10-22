# Player-Scrape Readiness - Quick Summary

## Status: ALMOST READY (85% confidence)

**CORRECTED FOCUS:** This scraper is for updating/populating **players_v2/{playerId}/contracts** subcollection in Firestore.

> 🚀 **Want to get to 100%?** See **[GETTING_STARTED.md](./GETTING_STARTED.md)** for complete step-by-step instructions!

### What Works ✅
- Complete TypeScript parser with Zod validation
- Handles multiple contracts (current + future extensions)
- **Season format already correct**: Outputs "YYYY-YY" (e.g., "2025-26") ✅
- **All 4 new fields already present** in output ✅
- Well-documented with setup guides

### Four New Fields - Already in Scraper! ✅
1. **isRookieScale** → `contract.isRookieScale` (poison pill logic)
2. **yearsOfService** → `contract.birdRights.yearsOfService` (extension rules)
3. **capHit** per year → `contract.salariesByYear[].capHit` (cap with incentives)
4. **tradeBonus** per year → `contract.salariesByYear[].tradeBonus` (per-year kicker)

### What's Missing ⚠️
1. **Playwright browser not installed** (30 min fix)
2. **Not tested with real SalarySwish pages** (sample is placeholder)
3. **Transform layer for players_v2** (flatten Bird rights, extract options, etc.)
4. **No Firestore upload script for players_v2** (needs creation)
5. **No integration tests** (end-to-end validation needed)

### Architecture Decision

**PRIMARY TARGET: players_v2/{playerId}/contracts/{contractId}**

```
SalarySwish.com
    │
    ▼
player-scrape + transform
    │
    ▼
players_v2/{playerId}/contracts/std_202425
```

**Why this matters:**
- players_v2 already exists in Firestore
- This scraper updates/populates it going forward
- Season format: YYYY-YY (e.g., "2025-26") - already correct!
- After players_v2 is working, decide separately about architect/basePlayers

### Field Transformations Needed

**For players_v2/contracts:**
- ✅ Season format: Already YYYY-YY (e.g., "2025-26")
- ✅ Four new fields: Already in scraper output
- Transform needed:
  - Flatten Bird rights: `{object}` → `"Bird"` (string)
  - Extract year: Add `year` field from `season` in salariesByYear
  - Rename: `totalValue` → `contractValue`
  - Extract: Separate `options[]` array
  - Calculate: `capPercentage` field

### Transform Example

```typescript
// Scraper output has everything, just needs restructuring:
{
  startSeason: "2025-26",  // ✅ Already correct format
  isRookieScale: true,      // ✅ NEW FIELD #3
  yearsOfService: 3,        // ✅ NEW FIELD #4 (from birdRights)
  salariesByYear: [{
    season: "2025-26",
    year: 2025,             // Add this from season
    capHit: 12000000,       // ✅ NEW FIELD #1
    tradeBonus: null,       // ✅ NEW FIELD #2
    ...
  }]
}
```

### Next Steps (1-2 days)

1. Install Playwright: `npx playwright install chromium`
2. Test with 3-5 real SalarySwish pages
3. Fix any parsing issues
4. **Create transform layer for players_v2 compatibility**
5. **Create Firestore upload script for players_v2/{playerId}/contracts**
6. Run integration tests

### Quick Reference

```bash
# Setup
npm install
npx playwright install chromium

# Test single player
PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
PLAYER_ID="austin_reaves" npm run parse-player
npm run validate-player

# Batch scrape
PLAYERS_FILE="examples/players_list.json" npm run batch-scrape-players
```

### Key Corrections from Original Assessment

1. **Primary target is players_v2** (not architect/basePlayers)
2. **Season format already correct** - outputs "YYYY-YY" format ✅
3. **Four new fields already present** in scraper ✅
4. **Need transform layer** to match players_v2 structure
5. **players_v2 uses subcollections** - not flat structure

See [READINESS_ASSESSMENT.md](./READINESS_ASSESSMENT.md) for full details.
