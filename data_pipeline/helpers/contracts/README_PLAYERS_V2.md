# Players v2 Contract Scraper for Architect

This scraper extracts detailed individual player contract data from SalarySwish player pages to populate the `/architect/basePlayers/{playerId}` collection in Firestore.

## Purpose

The Players v2 scraper builds on the existing contract scraper by extracting **additional architect-specific data** required for the GM Tools:

### Data Extracted

1. **Bird Rights**
   - Status: None, Non-Bird, Early Bird, or Full Bird
   - Years of service with current team
   - Eligible exceptions

2. **Free Agency Information**
   - Type: RFA or UFA
   - Free agency year
   - Cap hold amount
   - Qualifying offer (for RFAs)
   - Early termination options

3. **Contract Options**
   - Player Options (PO)
   - Team Options (TO)
   - Early Termination Options (ETO)
   - Option year and value

4. **Trade Eligibility** ⭐ NEW
   - Current trade eligibility status
   - Restriction dates (if any)
   - Restriction reasons (recent signing, recent trade)
   - **Base Year Compensation (BYC)** flag
   - **Poison Pill** flag
   - **Aggregation** eligibility

5. **Guarantees**
   - Fully guaranteed vs non-guaranteed years
   - Partial guarantee amounts
   - Guarantee dates

## Architecture

### Input
- **Source**: SalarySwish player pages (e.g., `https://salaryswish.com/players/austin-reaves`)
- **Player IDs**: From `data_pipeline/resources/data/all_player_ids.json`

### Output Collections

#### `/architect/basePlayers/players/{playerId}`
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
    "signedUsing": "Bird Exception",
    "startSeason": "2023-24",
    "endSeason": "2027-28",
    "totalValue": 53830000,
    "salariesByYear": [
      {
        "season": "2025-26",
        "salary": 12000000,
        "guaranteed": true,
        "option": null
      }
    ],
    "birdRights": {
      "status": "Bird",
      "yearsWithTeam": 3,
      "eligibleFor": ["Bird Exception"]
    },
    "freeAgency": {
      "type": "UFA",
      "year": 2028,
      "capHold": 18750000,
      "qualifyingOffer": null
    },
    "tradeEligibility": {
      "canBeTradedNow": true,
      "restrictedUntil": null,
      "reason": null,
      "rules": {
        "baseYearCompensation": false,
        "poisonPill": false,
        "aggregation": true
      }
    }
  }
}
```

## Usage

### Step 1: Scrape Player Pages

```bash
cd data_pipeline/helpers/contracts
python3 scrape_players_v2.py
```

**Output**: `data_pipeline/resources/data/players_v2_contracts.json`

### Step 2: Parse to Architect Schema

```bash
python3 parse_players_v2.py
```

**Output**: `data_pipeline/resources/data/architect_base_players.json`

### Step 3: Upload to Firestore

```bash
node upload_players_v2.js
```

**Result**: Data uploaded to `/architect/basePlayers/players/{playerId}`

## Integration with Existing Pipeline

This scraper **complements** the existing contract scraper:

| Scraper | Purpose | Collection | Key Fields |
|---------|---------|------------|------------|
| `scrape_all_contracts.py` | Basic team contracts | `/players` | salary, guaranteed, options |
| `scrape_players_v2.py` ⭐ | Architect player data | `/architect/basePlayers` | Bird rights, trade eligibility, FA status |

### When to Run

- **Initial Setup**: Run once to populate architect base data
- **Season Updates**: Re-run when contracts change (trades, signings, extensions)
- **Weekly Sync**: Part of the architect data refresh pipeline

## Key Differences from v1 Scraper

### Enhanced Features

1. **Trade Eligibility Rules** (NEW)
   - Base Year Compensation detection
   - Poison Pill detection
   - Aggregation eligibility

2. **Bird Rights Details** (Enhanced)
   - Specific status (None, Non-Bird, Early Bird, Bird)
   - Years with team calculation
   - Eligible exceptions list

3. **Free Agency Details** (Enhanced)
   - Cap hold amounts
   - Qualifying offers for RFAs
   - Early termination options

4. **Contract Options** (Enhanced)
   - Separate PO/TO/ETO detection
   - Option year tracking
   - Option value extraction

### Data Validation

The scraper includes validation to ensure:
- All players have salary data
- Years are in valid range (2020-2035)
- Salaries are reasonable (> $100k)
- Required fields are present

## Error Handling

### Connectivity Issues
If SalarySwish is unreachable:
```
❌ SalarySwish is not accessible
🛑 Cannot proceed without access to player pages
```

### Parsing Errors
Individual player parsing errors are logged but don't stop the scraper:
```
❌ Error parsing austin_reaves: Missing contract table
```

### Validation Failures
Invalid players are skipped with warnings:
```
⚠️  Skipping jaylen_brown: No salary data found
```

## File Structure

```
data_pipeline/helpers/contracts/
├── scrape_players_v2.py       # Main scraper (HTML extraction)
├── parse_players_v2.py         # Transform to architect schema
├── upload_players_v2.js        # Firestore upload
├── scrape_all_contracts.py     # Original contract scraper (v1)
└── parse_contract_data_enhanced.py  # Original parser (v1)
```

## Dependencies

### Python
- `requests` - HTTP requests
- `beautifulsoup4` - HTML parsing
- `json`, `re`, `time` - Standard library

### Node.js
- `firebase-admin` - Firestore upload
- `fs`, `path` - Standard library

## Testing

### Test Individual Player
Create a test script to validate a single player:

```python
from scrape_players_v2 import scrape_player_page, parse_player_html

# Test scraping
data = scrape_player_page("austin_reaves", "austin-reaves")
if data:
    player = parse_player_html("austin_reaves", data["html"])
    print(json.dumps(player, indent=2))
```

### Verify Output
Check the parsed data:

```bash
# View a sample player
cat data_pipeline/resources/data/architect_base_players.json | jq '.austin_reaves'
```

## Troubleshooting

### No Data Scraped
1. Check internet connectivity to SalarySwish
2. Verify player ID format (underscores → hyphens)
3. Check if URL structure has changed

### Missing Fields
Some fields may be `null` if not found on the player page:
- `signingDate` - May not be visible
- `yearsWithTeam` - Calculated from text, may be missing
- `capHold` - Only visible for pending free agents

### Trade Eligibility Flags
BYC and Poison Pill flags require specific text on the page:
- Look for "Base Year Compensation" or "BYC"
- Look for "Poison Pill"
- Default to `false` if not found

## Architect Integration

This scraper is part of the **Architect Teams Plan** (Phase 2: Data Migration).

### Related Components
- `/architect/baseTeams` - Team cap sheets (separate scraper)
- `/architect/worlds` - User simulation saves
- `/architect/teamPlans` - User roster modifications

### Next Steps
1. ✅ Player scraper (this component)
2. ⏳ Team scraper integration
3. ⏳ World creation logic
4. ⏳ Season advancement system

## References

- [Architect Goals](../../../architect-teams-plan/01-GOALS.md)
- [Target Schema](../../../architect-teams-plan/03-TARGET-SCHEMA.md)
- [Implementation Plan](../../../architect-teams-plan/07-IMPLEMENTATION-PLAN.md)
- [Firestore Schema](../../../docs/FIRESTORE_SCHEMA.md)
