# Fanspo Enrichment Demo

## Before and After Comparison

### Pick Without Fanspo Enrichment

When running the standard parser without Fanspo enrichment:

```bash
npm run parse
```

**Output (2027 1st round pick):**
```json
{
  "year": 2027,
  "round": 1,
  "status": "contested",
  "pickNumber": 14,
  "detailUrl": "https://www.salaryswish.com/draft/2027?pick=14",
  "title": "Pick is in contention due to an unresolved trade aspect, the final owner is to be determined. Contending teams: UTA, LAL. Click to view full details",
  "contendingTeams": [
    "UTA",
    "LAL"
  ]
}
```

### Pick With Fanspo Enrichment

When running with Fanspo enrichment enabled:

```bash
FANSPO_ENRICH=1 FANSPO_MOCK=1 TEAM_SLUG="Lakers" TEAM_ID=14 npm run parse-mock
```

**Output (2027 1st round pick):**
```json
{
  "year": 2027,
  "round": 1,
  "status": "contested",
  "pickNumber": 14,
  "detailUrl": "https://www.salaryswish.com/draft/2027?pick=14",
  "title": "Pick is in contention due to an unresolved trade aspect, the final owner is to be determined. Contending teams: UTA, LAL. Click to view full details",
  "contendingTeams": [
    "UTA",
    "LAL"
  ],
  "fromTeams": [
    "UTA"
  ],
  "protections": "Top 10 protected, conveys 2028-2030 if not conveyed"
}
```

## Key Differences

### 1. Team Ownership (fromTeams/toTeams)

**Incoming Pick Example:**
```json
{
  "year": 2027,
  "round": 1,
  "fromTeams": ["UTA"],  // 🆕 Added by Fanspo
  ...
}
```

**Outgoing Pick Example:**
```json
{
  "year": 2029,
  "round": 1,
  "toTeams": ["NOP"],  // 🆕 Added by Fanspo
  ...
}
```

### 2. Protection Details

**Before:**
```json
{
  "year": 2029,
  "round": 1,
  "status": "outgoing"
}
```

**After:**
```json
{
  "year": 2029,
  "round": 1,
  "status": "outgoing",
  "toTeams": ["NOP"],
  "protections": "Lottery protected"  // 🆕 Added by Fanspo
}
```

### 3. Conveyance Rules

**Complex Protection Example:**
```json
{
  "year": 2027,
  "round": 1,
  "protections": "Top 10 protected, conveys 2028-2030 if not conveyed"  // 🆕
}
```

This tells us:
- The pick is top-10 protected in 2027
- If it doesn't convey in 2027, it will try to convey in 2028, 2029, or 2030
- The Lakers only get the pick if Utah's pick falls outside the top 10

## Real-World Usage

### Scenario 1: Trade Machine Validation

When validating trades, you need to know:
- Which picks a team actually owns
- What protections apply
- When picks might convey

**Without Fanspo:**
```json
{
  "year": 2029,
  "round": 1,
  "status": "outgoing"
}
```
❌ Can't tell which team receives the pick or if there are protections

**With Fanspo:**
```json
{
  "year": 2029,
  "round": 1,
  "status": "outgoing",
  "toTeams": ["NOP"],
  "protections": "Lottery protected"
}
```
✅ Clear: Pick goes to NOP, but only if Lakers are outside lottery (15-30)

### Scenario 2: Draft Pick Inventory

**Without Fanspo:**
- Need to manually track which picks are incoming from trades
- No protection information readily available
- Can't determine conveyance logic

**With Fanspo:**
- Automatically know all incoming picks and their sources
- Protection details are captured
- Conveyance rules are documented

## Console Output

### Standard Parse (No Enrichment)
```
✅ Wrote ./team.json
  roster=14  tpe=3  holds=28  picks=14
```

### Parse with Fanspo Enrichment (Mock Mode)
```
📝 Using mock Fanspo data for Lakers-14
✅ Fanspo enrichment successful (8 picks enriched)
✅ Wrote ./team.json
  roster=14  tpe=3  holds=28  picks=14
```

Note the additional confirmation:
- "Using mock Fanspo data" - Confirms mock mode is active
- "(8 picks enriched)" - Shows how many picks received Fanspo data

## Verification

Check enriched picks:
```bash
cat team.json | jq '.draftPicks[] | select(.fromTeams or .toTeams)'
```

Output shows all picks with Fanspo enrichment:
```json
{
  "year": 2027,
  "round": 1,
  "fromTeams": ["UTA"],
  "protections": "Top 10 protected, conveys 2028-2030 if not conveyed",
  ...
},
{
  "year": 2029,
  "round": 1,
  "toTeams": ["NOP"],
  "protections": "Lottery protected",
  ...
},
...
```

## Summary

The Fanspo enrichment adds critical missing information to draft picks:

| Feature | Without Fanspo | With Fanspo |
|---------|---------------|-------------|
| **Team Ownership** | ❌ Unknown | ✅ fromTeams/toTeams |
| **Protections** | ❌ Not captured | ✅ Full protection text |
| **Conveyance Rules** | ❌ Missing | ✅ Multi-year logic |
| **Status Accuracy** | ⚠️ May be wrong | ✅ Corrected |
| **Trade Validation** | ❌ Incomplete | ✅ Complete data |

This makes the team scraper much more useful for:
- Trade machine validation
- Draft pick tracking
- Cap planning
- GM tools and simulations
