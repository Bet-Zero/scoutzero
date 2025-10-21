# Player-Scrape Readiness - Quick Summary

## Status: ALMOST READY (85% confidence)

### What Works ✅
- Complete TypeScript parser with Zod validation
- Handles multiple contracts (current + future extensions)
- Schema matches architect/basePlayers perfectly
- Sample data validates successfully
- Well-documented with setup guides

### What's Missing ⚠️
1. **Playwright browser not installed** (30 min fix)
2. **Not tested with real SalarySwish pages** (sample is placeholder)
3. **Season format mismatch with players_v2** ("2025-26" vs "2025")
4. **No Firestore upload script** (mentioned but not implemented)
5. **No integration tests** (end-to-end validation needed)

### Architecture Decision

**Recommendation: OPTION B - Scrape architect/basePlayers separately**

```
SalarySwish.com
    │
    ├─── player-scrape ──> architect/basePlayers  (CBA-focused)
    │
    └─── players_v2 scrape ──> players_v2/contracts  (scout-focused)
```

**Why separate?**
- Different purposes (CBA compliance vs scouting)
- Different schemas (complex nested vs flat)
- Already architected this way

### Field Deltas

**For architect/basePlayers:** ✅ NO CHANGES NEEDED - schema matches perfectly

**For players_v2/contracts:** Need transformations:
- `startSeason`: "2025-26" → "2025" (year only)
- `birdRights`: {object} → "Bird" (flatten to string)
- `contractValue`: rename from `totalValue`
- Add `capPercentage` field (calculated)
- Add `year` field to salariesByYear array

### Next Steps (1-2 days)

1. Install Playwright: `npx playwright install chromium`
2. Test with 3-5 real SalarySwish pages
3. Fix any parsing issues
4. Add field transformations (if targeting players_v2)
5. Create Firestore upload script
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

See [READINESS_ASSESSMENT.md](./READINESS_ASSESSMENT.md) for full details.
