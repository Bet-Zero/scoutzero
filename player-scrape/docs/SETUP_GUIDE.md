# Player Scraper Setup Guide

## 🔧 Required Setup Steps

### 1. Install Playwright Browser

The player scraper requires Playwright's Chromium browser to render JavaScript-based salary tables from SalarySwish.

```bash
# Install Playwright browsers
npx playwright install chromium

# Or install all browsers
npx playwright install
```

**Why Playwright?** SalarySwish renders salary data dynamically with JavaScript. Simple HTTP requests (like `got`) only fetch raw HTML without executing JavaScript, resulting in incomplete data.

### 2. Verify Installation

Test that the fetcher works correctly:

```bash
# Fetch a player page
PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player

# Check that page.html contains rendered salary table
grep -i "Season" player-scrape/page.html
grep -i "Salary" player-scrape/page.html
```

You should see salary table HTML if installation was successful.

### 3. Run Parser

Once you have a properly fetched page.html:

```bash
PLAYER_ID="austin_reaves" TEAM_CODE="LAL" npm run parse-player
```

Check `player-scrape/player.json` - it should have populated:
- ✅ Salary years array
- ✅ Contract totals
- ✅ Bird rights status (not HTML text)
- ✅ Free agency info
- ✅ Trade eligibility

### 4. Batch Processing

For scraping multiple players:

```bash
# Create players list (or use existing players_list_sample.json)
cat > players_list.json << 'EOF'
[
  { "playerId": "lebron_james", "slug": "lebron-james", "teamCode": "LAL" },
  { "playerId": "anthony_davis", "slug": "anthony-davis", "teamCode": "LAL" }
]
EOF

# Run batch scraper
PLAYERS_FILE="players_list.json" OUTPUT_DIR="output/players" npm run batch-scrape-players
```

## 🐛 Troubleshooting

### Error: "browser executable doesn't exist"

**Solution:** Run `npx playwright install chromium`

### Error: "No table found" or empty salaries

**Cause:** Using old `got`-based fetcher instead of Playwright

**Solution:** Ensure `fetch_player_page.ts` imports from `playwright`, not `got`

### Network Issues During Install

If Playwright installation fails due to network restrictions:

1. **Option A:** Use environment variable to skip browser download during npm install:
   ```bash
   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
   ```
   Then manually install browsers later when network is available:
   ```bash
   npx playwright install chromium
   ```

2. **Option B:** Use proxy if available:
   ```bash
   export HTTPS_PROXY=http://your-proxy:port
   npx playwright install chromium
   ```

3. **Option C:** Pre-download browsers on a machine with network access, then copy to restricted environment (see Playwright docs)

## ✅ Validation Checklist

After setup, verify the scraper works by checking:

- [ ] `fetch_player_page.ts` imports `playwright` (not `got`)
- [ ] `npx playwright install chromium` completed successfully
- [ ] Test fetch produces `page.html` with `<table>` elements
- [ ] Parser extracts salary data into `player.json`
- [ ] `player.json` has populated `salariesByYear` array
- [ ] Bird rights shows status string (e.g., "Bird") not HTML
- [ ] Contract totals are calculated correctly

## 📊 Expected Output Structure

Valid `player.json` should match this structure:

```json
{
  "playerId": "austin_reaves",
  "displayName": "Austin Reaves",
  "teamCode": "LAL",
  "teamName": "Los Angeles Lakers",
  "bio": {
    "position": "G",
    "height": "6-5",
    "weight": "206",
    "age": 26,
    "experience": 3
  },
  "contract": {
    "contractType": "VETERAN CONTRACT",
    "isExtension": false,
    "isRookieScale": false,
    "salariesByYear": [
      {
        "season": "2025-26",
        "salary": 12000000,
        "guaranteed": true,
        "option": null
      }
      // ... more years
    ],
    "totalValue": 40900000,
    "birdRights": {
      "status": "Bird"  // ← Should be clean string, not HTML
    },
    "freeAgency": {
      "type": "UFA",
      "year": 2028
    },
    "tradeEligibility": {
      "canBeTradedNow": true,
      "rules": {
        "poisonPill": false
      }
    }
  }
}
```

## 🔄 Migration from Old Version

If you're using the old `got`-based fetcher:

1. Update `fetch_player_page.ts` to use Playwright (already done in latest version)
2. Update `batch_scrape_players.ts` to use Playwright (already done in latest version)
3. Install Playwright browsers: `npx playwright install chromium`
4. Re-fetch all player pages to get properly rendered HTML
5. Re-run parser on new HTML files

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [SalarySwish Player Pages](https://salaryswish.com/players/)
- [Player Scraper README](./README.md)
- [Schema Documentation](./player_scrape_schema.ts)
