# Teams Base Collection Migration

## Overview

This migration transforms the legacy `/teams` collection into a new season-keyed structure at `/teams_base_vNext`. The new structure serves as the real-world foundation for HoopZero Architect (trade machine, cap manager, draft picks, exceptions, etc.).

**IMPORTANT**: This migration writes to a **shadow collection** (`/teams_base_vNext`) and never modifies the original `/teams` collection.

## Quick Start

### Prerequisites

- Node.js 18+
- Firebase Admin credentials (`serviceAccountKey.json` in project root or `GOOGLE_APPLICATION_CREDENTIALS` env var)
- Dependencies installed: `npm install`

### Running the Migration

#### 1. Dry-Run (Preview Only - Recommended First)

```bash
node scripts/migrate_teams_base.js --dry-run
```

This will:
- Preview all transformations without writing to Firestore
- Generate output files in `./migration_output/`
- Show a summary table of all teams
- Report any warnings

#### 2. Write to Shadow Collection

```bash
node scripts/migrate_teams_base.js --write
```

This will:
- Write transformed data to `/teams_base_vNext`
- Skip documents that are identical (hash-based idempotency)
- Batch writes safely (≤450 operations per batch)
- Generate full output artifacts

#### 3. Single Team Migration

```bash
node scripts/migrate_teams_base.js --write --team=LAL
```

Migrate only the Lakers (useful for testing).

#### 4. Limited Run

```bash
node scripts/migrate_teams_base.js --write --limit=5
```

Migrate only the first 5 teams (useful for testing).

#### 5. Season Filter

```bash
node scripts/migrate_teams_base.js --write --seasons=2024-25,2025-26
```

Include only specific seasons in the output.

## CLI Options

| Option | Description | Example |
|--------|-------------|---------|
| `--dry-run` | Preview without writing (default) | `--dry-run` |
| `--write` | Write to `/teams_base_vNext` | `--write` |
| `--team=CODE` | Process single team | `--team=LAL` |
| `--limit=N` | Process first N teams | `--limit=10` |
| `--seasons=S1,S2` | Filter specific seasons | `--seasons=2024-25,2025-26` |

## Output Artifacts

All output is saved to `./migration_output/`:

### 1. Preview Summary
- **File**: `preview_{timestamp}.ndjson`
- **Format**: NDJSON (one JSON object per line)
- **Contents**: Compact summary of each team transformation

Example line:
```json
{"teamCode":"LAL","teamId":"lakers","seasons":["2024-25","2025-26"],"playerCount":15,"hash":"a1b2c3d4","status":"WRITTEN"}
```

### 2. Before/After Snapshots
- **Files**: `{TEAM}.before.json` and `{TEAM}.after.json`
- **Format**: Pretty-printed JSON
- **Contents**: Full document before and after transformation

### 3. Warnings Log
- **File**: `warnings_{timestamp}.log`
- **Format**: Plain text, one warning per line
- **Contents**: Any data gaps, missing fields, or transformation issues

Example:
```
LAL: No season data found, defaulting to 2025
OKC: Missing cap holds data
```

## Verification Steps

### 1. Count Verification

After running with `--write`, verify the counts match:

```bash
# Original collection
firebase firestore:collections:list | grep teams

# Shadow collection
firebase firestore:collections:list | grep teams_base_vNext
```

Both should have 30 documents (one per team).

### 2. Sample Document Review

Check a transformed document:

```bash
cat migration_output/LAL.after.json | jq .
```

Verify:
- ✅ `meta` has correct team info
- ✅ `seasons` object has season keys like "2024-25"
- ✅ Each season has `roster`, `cap`, `picks`
- ✅ Salary values are numbers (not strings like "$11.9M")
- ✅ Pick protection is normalized

### 3. Diff Review

Compare before/after for a specific team:

```bash
diff -u migration_output/LAL.before.json migration_output/LAL.after.json
```

### 4. Warnings Review

Check for any data gaps:

```bash
cat migration_output/warnings_*.log
```

Address any critical warnings before using the data in production.

## Data Structure

### Target Collection: `/teams_base_vNext/{teamCode}`

```javascript
{
  meta: {
    teamCode: "LAL",
    teamId: "lakers",
    market: "Los Angeles",
    name: "Lakers",
    abbreviation: "LAL",
    conference: "West",
    division: "Pacific",
    colors: { primary: "#552583", secondary: "#FDB927", accent: ["#000000"] },
    logos: { /* logo URLs if available */ },
    updatedAt: Timestamp
  },
  
  seasons: {
    "2024-25": {
      roster: {
        players: [
          {
            playerId: "lbj-001",
            displayName: "LeBron James",
            position: "F",
            contractRef: { source: "contract_clean", playerId: "lbj-001" }
          }
          // ... more players
        ],
        twoWays: ["player-id-1", "player-id-2"],
        inactiveList: [],
        updatedAt: Timestamp
      },
      
      cap: {
        salaryRows: [
          {
            playerId: "lbj-001",
            year: 2025,
            amount: 48728845,  // dollars (int)
            type: "option_player",  // base|option_team|option_player|non_guaranteed|cap_hold|dead
            notes: "spotrac"
          }
          // ... more rows
        ],
        totalsByYear: {
          "2025": { payroll: 104933285, deadMoney: 0, capHolds: 0 },
          "2026": { payroll: 123892435, deadMoney: 0, capHolds: 0 }
        },
        exceptions: [
          {
            kind: "MLE",  // MLE|BAE|RME|TPE|DPE
            amount: 12860000,
            createdOn: "2024-07-01",
            expiresOn: "2025-06-30",
            usedAmount: 0
          }
        ],
        aprons: {
          hardCapActive: false,
          apron1Breached: false,
          apron2Breached: false
        },
        tpes: [],
        deadMoney: [],
        capHolds: [],
        rights: [],
        updatedAt: Timestamp
      },
      
      picks: {
        incoming: [
          {
            year: 2027,
            round: 1,
            from: "NOP",
            protection: "Top-10 protected, converts to two 2nds if not conveyed by 2028",
            swap: false,
            notes: null,
            sourceDealId: null
          }
        ],
        outgoing: [
          {
            year: 2025,
            round: 1,
            to: "LAL",
            protection: null,
            swap: false
          }
        ],
        updatedAt: Timestamp
      },
      
      transactions: [],
      notes: "",
      updatedAt: Timestamp
    }
    // ... more seasons
  }
}
```

## Transformation Rules

1. **Team Metadata**: Derived from `mapping/teamCodeMap.json` and team colors
2. **Season Keys**: Generated as "YYYY-YY" (e.g., 2025 → "2024-25")
3. **Currency**: All strings like "$11.9M" converted to numbers in dollars
4. **Roster**: Minimal player info with `contractRef` pointer to contract data
5. **Salary Rows**: Extracted from `contract_clean.salaries_by_year`
6. **Contract Types**: Mapped to standard types (base, option_team, option_player, etc.)
7. **Pick Protection**: Normalized to clean human-readable format
8. **Idempotency**: SHA1 hash prevents duplicate writes

## Testing

### Run Test Suite

```bash
npm run test tests/teams_migration.spec.js -- --run
```

Tests validate:
- ✅ Legacy fixture structure
- ✅ Team code mapping (30 teams)
- ✅ Expected transformation output shape
- ✅ Data invariants (numeric salaries, valid picks, etc.)
- ✅ Totals calculation accuracy
- ✅ Season key generation
- ✅ Protection string normalization

### Golden Fixtures

Sample teams in `tests/fixtures/teams_legacy/`:
- `LAL.json` - Lakers (player options, picks)
- `BOS.json` - Celtics (extensions, pick trades)
- `OKC.json` - Thunder (team options, protected picks)

## Safety Features

### 1. Read-Only Source
- **Never modifies** `/teams` collection
- All writes go to `/teams_base_vNext`

### 2. Idempotency
- Computes SHA1 hash of output
- Skips write if document unchanged
- Prevents unnecessary churn

### 3. Batch Safety
- Max 450 operations per batch
- Exponential backoff on errors
- Resumable from any point

### 4. Validation
- Warnings for missing data
- Does not fail on gaps
- Logs all issues for review

## Common Issues

### Issue: No Firebase credentials

**Error**: `Firebase credentials not found`

**Fix**: Place `serviceAccountKey.json` in project root or set `GOOGLE_APPLICATION_CREDENTIALS` env var

### Issue: No season data found

**Warning**: `{TEAM}: No season data found, defaulting to {YEAR}`

**Cause**: Team document has no contract year data

**Action**: Review team document, may need manual data entry

### Issue: Cannot parse currency

**Warning**: `{TEAM}: Invalid salary format`

**Cause**: Unexpected currency string format

**Action**: Check salary data, may need manual fix

### Issue: Missing team in mapping

**Error**: `Unknown team code`

**Fix**: Add team to `mapping/teamCodeMap.json`

## Migration to Production

After verifying the shadow collection:

1. **Review all warnings**: `cat migration_output/warnings_*.log`
2. **Spot-check random teams**: Compare before/after JSON files
3. **Verify counts**: 30 teams in source = 30 teams in shadow
4. **Test Architect**: Load shadow data in GM tools to ensure compatibility
5. **Backup source**: Export `/teams` collection
6. **Cutover**: Update Architect to read from `/teams_base_vNext`
7. **Monitor**: Watch for errors in production logs

## Rollback Plan

If issues are found:

1. **Architect code**: Revert to read from `/teams`
2. **Delete shadow**: `firebase firestore:delete /teams_base_vNext --recursive`
3. **Fix issues**: Update migration script
4. **Re-run**: Start migration again with fixes

## Next Steps

After successful migration:

1. Update Architect to use `/teams_base_vNext`
2. Add season navigation UI
3. Implement Architect fork logic (user plans in `/teamPlans/*`)
4. Archive legacy `/teams` collection (optional)

## Support

For issues or questions:
- Review `migration_output/warnings_*.log`
- Check test failures: `npm run test tests/teams_migration.spec.js`
- Consult `docs/FIRESTORE_SCHEMA.md` for collection details
