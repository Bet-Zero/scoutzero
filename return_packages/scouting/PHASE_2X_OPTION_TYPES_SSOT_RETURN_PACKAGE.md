# PHASE 2X RETURN PACKAGE: Option Types SSOT + Year Semantics Cleanup

**DATE**: 2026-02-01  
**STATUS**: ✅ COMPLETE  
**MASTER DOC**: `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`

---

## EXECUTIVE SUMMARY

**PROBLEM SOLVED**: Option Type filter (PO/TO/ETO) returned **0 players for all years** because:

1. `currentContractView.options[]` had flat arrays like `["TO"]` with **no year association**
2. `enrichPlayerData` tried to read from `contractsView.seasons` which **doesn't exist** in main doc
3. Option year→type mapping only existed in `contracts` subcollection (not fetched by table hook)

**SOLUTION IMPLEMENTED**:

- Added `currentContractView.optionsByYear` as SSOT in schema
- Created backfill script to populate from contracts subcollection
- Updated enrichment to use `optionsByYear` as primary source
- Added explicit `optionYear` filter for year-specific option filtering
- Clarified year semantics in UI labels

---

## ROOT CAUSE RECAP

| Issue                   | Root Cause                                               | Fix                                             |
| ----------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| Option filter returns 0 | No year→option mapping in main doc                       | Add `optionsByYear` field + backfill            |
| Year confusion          | "Season" vs "Free Agent Year" vs "Option Year" ambiguous | Add explicit `optionYear` filter, rename labels |
| Enrichment failure      | `contractsView.seasons` doesn't exist                    | Use `optionsByYear` from main doc as SSOT       |

---

## SCHEMA CHANGES

### Added to `CurrentContractViewZ` (players_v2.ts)

```typescript
// Phase 2X SSOT: Year-specific option type mapping
// Keys are seasonStartYear as strings (e.g., "2025" for 2025-26 season)
// Values are option types: "PO" | "TO" | "ETO"
optionsByYear: z.record(z.string(), OptionTypeZ).optional();
```

### Example Document Shape

```json
{
  "currentContractView": {
    "freeAgentYear": 2028,
    "freeAgentType": "UFA",
    "options": ["TO"],
    "optionsByYear": {
      "2026": "TO",
      "2027": "TO"
    },
    "salaryByYear": { "2025": 15000000, "2026": 16000000 }
  }
}
```

---

## BACKFILL SCRIPT

**Location**: `scripts/migrations/backfill_optionsByYear.ts`

### Usage

```bash
# DRY RUN (default) - see what would change
npx tsx scripts/migrations/backfill_optionsByYear.ts

# WRITE MODE - apply changes to Firestore
npx tsx scripts/migrations/backfill_optionsByYear.ts --write

# SINGLE PLAYER
npx tsx scripts/migrations/backfill_optionsByYear.ts --write --player=aaron_gordon
```

### How It Works

1. Reads all `players_v2` documents
2. For each player, fetches `contracts` subcollection
3. Extracts `option` field from `salariesByYear[].option` in each contract
4. Builds `optionsByYear` map using **seasonStartYear** convention
5. Updates `currentContractView.optionsByYear` in main doc

### Idempotent Properties

- Safe to re-run (skips docs with existing `optionsByYear`)
- Batch-friendly (500 docs per batch commit)
- Logs summary with counts and option type breakdown

---

## FILES CHANGED

| File                                                                         | Change                                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/schemas/players_v2.ts`                                                  | Added `optionsByYear` to `CurrentContractViewZ`                              |
| `src/features/roster/utils/enrichPlayerData.js`                              | Use `optionsByYear` as primary SSOT, fallback to legacy                      |
| `src/shared/utils/filtering/playerFilterDefaults.js`                         | Added `optionYear: null` default                                             |
| `src/shared/utils/filtering/playerFilterUtils.js`                            | Filter uses `optionYear ?? salaryYear` for matching                          |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx` | Renamed "Free Agent Year" → "Free Agency Summer", added Option Year dropdown |
| `src/features/table/hooks/useFilterDiagnostics.js`                           | Updated diagnostics to track `optionsByYear` source                          |
| `src/tests/scouting/player_filters_wiring_contract.test.js`                  | Added 3 Phase 2X tests for optionYear                                        |
| `scripts/migrations/backfill_optionsByYear.ts`                               | Created backfill script (NEW)                                                |

---

## YEAR SEMANTICS TABLE

| Concept                | Stored Value           | Display Format      | Example            | Used For                  |
| ---------------------- | ---------------------- | ------------------- | ------------------ | ------------------------- |
| **Season**             | `2025` (startYear)     | `2025-26`           | Season dropdown    | Salary, stats context     |
| **Free Agency Summer** | `2028` (calendar year) | `2028`              | FA Year filter     | When player becomes FA    |
| **Option Year**        | `2025` (startYear)     | `2025-26` or `2025` | Option Year filter | Year to check option type |

**Key Rule**: All year-keyed data uses **seasonStartYear** convention (2025 = 2025-26 season).

---

## VALIDATION OUTPUT

### Build

```
✓ built in 44.85s
```

### Tests

```
✓ src/tests/scouting/player_filters_wiring_contract.test.js (33)
  ✓ Contract Option Filters (8)
    ✓ optionTypes: filters by Player Option (PO) with salaryYear
    ✓ optionTypes: filters by Team Option (TO) with salaryYear
    ✓ optionTypes: combined PO+TO for 2025
    ✓ optionTypes: empty array returns all players
    ✓ optionTypes: season-string format uses start year (SSOT regression)
    ✓ optionTypes: uses optionYear when explicitly set (Phase 2X)
    ✓ optionTypes: falls back to salaryYear when optionYear is null
    ✓ optionTypes: no match when optionYear has no options

Test Files  1 passed (1)
     Tests  33 passed (33)
```

---

## BEFORE/AFTER COUNTS

**Before Backfill** (estimated from diagnostics):

- Players with `currentContractView.options[]`: ~260
- Players with enriched `optionByYear`: 0
- Option filter matches: 0

**After Backfill** (expected):

- Players with `currentContractView.optionsByYear`: ~260
- Players with enriched `optionByYear`: ~260
- Option filter matches: Non-zero (based on data)

**Run backfill script to populate `optionsByYear` in production!**

---

## MANUAL SMOKE TEST

1. Start dev server: `npm run dev`
2. Navigate to `/players?debugFilters=1`
3. Check diagnostics panel for:
   - `rawOptionSources.currentContractViewOptionsByYear > 0` (after backfill)
   - `enrichedStats.withAnyOptionByYear > 0`
4. Set filters:
   - Season: 2025-26
   - Option Year: 2025 (or leave at "Use Season")
   - Option Type: TO
5. Verify non-zero player results

---

## NEXT STEPS

1. **Run backfill in production**:

   ```bash
   npx tsx scripts/migrations/backfill_optionsByYear.ts --write
   ```

2. **Update staging pipeline** (if using `player-scrape`):
   - Ensure `stage_player.ts` populates `optionsByYear` from contracts

3. **Verify in production**:
   - Check `/players?debugFilters=1` shows non-zero counts
   - Test Option Type filter returns expected players

---

## TEMPORARY SCRIPTS

| Script                      | Location              | Action                                    |
| --------------------------- | --------------------- | ----------------------------------------- |
| `backfill_optionsByYear.ts` | `scripts/migrations/` | **KEEP** - needed for production backfill |

---

## LINKS

- Master Doc: `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`
- Schema: `src/schemas/players_v2.ts`
- Enrichment: `src/features/roster/utils/enrichPlayerData.js`
- Filter Utils: `src/shared/utils/filtering/playerFilterUtils.js`
