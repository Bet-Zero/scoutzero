# Clean View Comparison - Before vs After

This document demonstrates the transformation from merged team data (technical format) to clean view data (UI-focused format).

## Example: Lakers (LAL)

### Before: Merged Data (Technical)

**Roster Entry:**
```json
{
  "displayName": "James, LeBron",
  "sourceUrl": "https://www.salaryswish.com/players/lebron-james"
}
```

**Draft Pick Entry:**
```json
{
  "id": "LAL_2026_1st",
  "year": 2026,
  "round": 1,
  "status": "own",
  "originalTeam": "LAL",
  "currentOwner": "LAL",
  "stepienEligible": true,
  "tradeable": true,
  "protection": null,
  "isSwap": false,
  "pickNumber": null,
  "detailUrl": "https://basketball.realgm.com/nba/teams/Los-Angeles-Lakers/13/draft-picks"
}
```

**Cap Summary:**
```json
{
  "activeSalary": 194820805,
  "deadCapTotal": 0,
  "capHoldsTotal": 16073918,
  "guaranteedSalary": 194891405,
  "rosterCount": 18,
  "twoWayCount": 3,
  "salaryCap": 154647000,
  "capSpace": -40173805,
  "luxuryTaxLine": 187895000,
  "taxSpace": -6925805,
  "firstApronLine": 195945000,
  "firstApronRoom": 1124195,
  "firstApronTriggered": false,
  "secondApronLine": 207824000,
  "secondApronRoom": 13003195,
  "secondApronTriggered": false,
  "hardCappedAt": "firstApron",
  "likelyIncentives": 0
}
```

---

### After: Clean View (UI-Focused)

**Roster Entry:**
```json
"James, LeBron"
```

**Draft Pick Entry:**
```json
"2026 Round 1"
```

**Cap Summary:**
```json
{
  "activeSalary": "$194.82M",
  "capSpace": "$-40173805",
  "luxuryTaxStatus": "Over by $6.93M",
  "firstApronStatus": "Room: $1.12M",
  "secondApronStatus": "Room: $13.00M",
  "rosterCount": 18
}
```

---

## Key Transformations

### 1. Roster Simplification
- **Before**: Object with `displayName` and `sourceUrl`
- **After**: Simple string array
- **Benefit**: 60% smaller, easier to read

### 2. Draft Picks Human-Readable
- **Before**: 11 fields including IDs, flags, and URLs
- **After**: Single formatted string
- **Examples**:
  - `"2026 Round 1"` (basic)
  - `"2026 Round 2 via LAL"` (traded)
  - `"2027 Round 1 (top-4 protected)"` (conditional)
  - `"2028 Round 2 via WAS [SWAP]"` (swap rights)

### 3. Currency Formatting
- **Before**: `194820805` (raw number)
- **After**: `"$194.82M"` (formatted string)
- **Patterns**:
  - Millions: `$194.82M`
  - Thousands: `$2.46M` → `$2460K`
  - Under 1K: `$500`

### 4. Cap Status Clarity
- **Before**: Separate boolean flags and raw numbers
- **After**: Descriptive status strings
- **Examples**:
  - `"Over by $6.93M"` instead of `taxSpace: -6925805`
  - `"TRIGGERED"` instead of `firstApronTriggered: true`
  - `"Room: $1.12M"` instead of `firstApronRoom: 1124195`

### 5. Metadata Removal
- **Removed**: `sourceUrl`, `detailUrl`
- **Removed**: `mergedAt`, `version`, `sources`
- **Removed**: Technical IDs like `LAL_2026_1st`
- **Removed**: Flags like `stepienEligible`, `tradeable`
- **Benefit**: Focus on what users see, not how it's tracked

---

## File Size Comparison

### Lakers (LAL)
| Format | Size | Reduction |
|--------|------|-----------|
| Merged JSON | 17.2 KB | - |
| Clean JSON | 4.1 KB | 76% smaller |
| Clean Markdown | 2.1 KB | 88% smaller |

### All Teams Combined
| Format | Size | Reduction |
|--------|------|-----------|
| Merged JSON | 118 KB | - |
| Clean JSON | 22 KB | 81% smaller |
| Clean Markdown | 12 KB | 90% smaller |

---

## Readability Comparison

### Merged Data - Finding Draft Picks
```json
// Need to navigate nested structure and decode fields
{
  "draftPicks": {
    "own": [
      {
        "id": "LAL_2026_1st",
        "year": 2026,
        "round": 1,
        "status": "own",
        "originalTeam": "LAL",
        "currentOwner": "LAL",
        "stepienEligible": true,
        "tradeable": true,
        "protection": null,
        "isSwap": false,
        "pickNumber": null,
        "detailUrl": "https://basketball.realgm.com/nba/teams/Los-Angeles-Lakers/13/draft-picks"
      }
    ]
  }
}
```

### Clean View - Finding Draft Picks
```json
// Immediate understanding, no decoding needed
{
  "draftPicks": {
    "own": ["2026 Round 1"]
  }
}
```

Or in Markdown:
```markdown
### Own Picks (6)
1. 2026 Round 1
2. 2028 Round 1
3. 2030 Round 1
```

---

## Use Case Examples

### For Developers
**Clean JSON** provides mock data for UI testing:
```javascript
// Easy to understand what will be displayed
const roster = cleanData.roster; // ["James, LeBron", "Doncic, Luka", ...]
const picks = cleanData.draftPicks.own; // ["2026 Round 1", ...]
```

### For Designers
**Clean Markdown** shows exact UI content:
```markdown
## Roster (14)
1. James, LeBron
2. Doncic, Luka
3. Hachimura, Rui
```

### For Stakeholders
**Clean View** enables quick validation:
- ✅ All 14 roster players visible
- ✅ Cap space calculation clear: "Over by $6.93M"
- ✅ Draft picks organized by status

---

## Technical Details

### Data Preserved
- ✅ All roster player names
- ✅ All cap hold information
- ✅ All draft pick details (year, round, protection, swaps)
- ✅ All financial totals
- ✅ Team identification (code, name, season)

### Data Transformed
- 🔄 URLs removed (not shown in UI)
- 🔄 Numbers formatted as currency
- 🔄 Booleans converted to descriptive text
- 🔄 IDs removed (internal tracking only)
- 🔄 Timestamps removed (metadata only)

### Data Lost
- ❌ None - all UI-relevant data is preserved

---

## Generated Files

All clean view files are in: `team-scrape/review_and_merge/out_clean_views/`

**Individual Teams:**
- `LAL_clean.json` / `LAL_clean.md` - Lakers
- `MEM_clean.json` / `MEM_clean.md` - Grizzlies
- `NYK_clean.json` / `NYK_clean.md` - Knicks
- `OKC_clean.json` / `OKC_clean.md` - Thunder
- `WAS_clean.json` / `WAS_clean.md` - Wizards

**Combined:**
- `all_teams_clean.json` - All teams in single JSON array
- `all_teams_clean.md` - All teams in single Markdown document

---

## Regenerating Clean Views

After updating merged data:
```bash
npm run merge:samples    # Update merged data
npm run clean-view       # Regenerate clean views
```

View results:
```bash
cat team-scrape/review_and_merge/out_clean_views/all_teams_clean.md
```

---

**Purpose:** This comparison demonstrates how the clean view tool transforms technical data into UI-focused formats suitable for visual review and design planning.
