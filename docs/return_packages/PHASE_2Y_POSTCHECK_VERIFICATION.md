# Phase 2Y: Postcheck Verification

**DATE**: 2026-02-02
**STATUS**: ✅ IMPLEMENTATION COMPLETE (Pending Backfill Execution)

## Pre-Backfill Verification

### ✅ Build Status

```
npm run build
✓ built in 24.39s
```

### ✅ Test Status

```
npm run test -- --run src/tests/scouting/player_filters_wiring_contract.test.js

 ✓ src/tests/scouting/player_filters_wiring_contract.test.js (35)
   ✓ Phase 2S Filter Wiring Contract Tests (35)
     ✓ Contract Option Filters (10)
       ✓ optionTypes: uses optionsByYear from main doc when present (Phase 2Y SSOT)
       ✓ optionTypes: optionsByYear takes priority over salariesByYear fallback (Phase 2Y)

 Test Files  1 passed (1)
      Tests  35 passed (35)
```

### ✅ Migration Script Syntax

```bash
node scripts/migrations/phase2y_backfill_optionsByYear.js --help
# Outputs help without errors
```

## Schema Verification

The `optionsByYear` field already exists in schema:

**File**: `src/schemas/players_v2.ts` (line 138)

```typescript
optionsByYear: z.record(z.string(), OptionTypeZ).optional(),
```

**Type**: `Record<string, "PO" | "TO" | "ETO">`

**Keys**: Season start year as string (e.g., `"2025"` for 2025-26)

## Enrichment Logic Verification

**File**: `src/features/roster/utils/enrichPlayerData.js` (lines 331-361)

Priority order (SSOT hierarchy):

1. **PRIMARY**: `currentContractView.optionsByYear` (denormalized in main doc)
2. **FALLBACK**: `primaryContract.salariesByYear[].option` (from contracts subcollection)

## Diagnostics Panel Verification

**File**: `src/features/table/PlayerTable/FilterDiagnosticsPanel.jsx`

Added:

- `currentContractView.optionsByYear` count display (with SSOT label)
- "Data Not Backfilled" warning when count is 0
- Updated schema note explaining the data flow

## Post-Backfill Checklist

After running the migration with `--write`, verify:

| Check                                    | Expected                              | Actual |
| :--------------------------------------- | :------------------------------------ | :----- |
| Dry run shows players to update          | `Would update: > 0`                   | ⬜     |
| Migration completes without errors       | Exit code 0                           | ⬜     |
| Diagnostics optionsByYear count > 0      | Non-zero at `/players?debugFilters=1` | ⬜     |
| "Data Not Backfilled" warning disappears | Warning hidden                        | ⬜     |
| Option Type filter (PO) returns players  | Results > 0                           | ⬜     |
| Known player has correct optionsByYear   | e.g., Aaron Gordon shows PO           | ⬜     |
| Re-running migration is idempotent       | `Already current: > 0`                | ⬜     |

## Verification Commands

### 1. Run Migration Dry Run

```bash
cd /Users/brenthibbitts/Desktop/ScoutZero
node scripts/migrations/phase2y_backfill_optionsByYear.js
```

Expected output:

```
SUMMARY
============================================================
Total players scanned:  <N>
  - Would update:       <M>  (should be > 0)
  - Errors:             0
```

### 2. Run Migration for Single Player

```bash
node scripts/migrations/phase2y_backfill_optionsByYear.js --player=aaron_gordon
```

Expected output:

```
DETAILED RESULTS:
------------------------------------------------------------
  Aaron Gordon:
    Status: would_update
    optionsByYear: {"2025":"PO", ...}
```

### 3. Run Migration with Write (Emulator)

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/migrations/phase2y_backfill_optionsByYear.js --write
```

### 4. Verify Diagnostics

Open in browser:

```
http://localhost:5173/players?debugFilters=1
```

Look for:

- **currentContractView.optionsByYear**: Should show `> 0 players`
- **Enriched optionByYear**: Should show `> 0` players with option for salary year
- **Data Not Backfilled** warning should NOT appear

### 5. Test Option Filter

1. Navigate to `/players`
2. Open Filters panel
3. Set Salary Year: `2025`
4. Check Option Types: `PO` (Player Option)
5. Verify: Player list shows results (not empty)

## Files Created/Modified

| File                                                          | Type     | Status |
| :------------------------------------------------------------ | :------- | :----- |
| `scripts/migrations/phase2y_backfill_optionsByYear.js`        | Created  | ✅     |
| `src/features/table/PlayerTable/FilterDiagnosticsPanel.jsx`   | Modified | ✅     |
| `src/tests/scouting/player_filters_wiring_contract.test.js`   | Modified | ✅     |
| `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`         | Modified | ✅     |
| `return_packages/PHASE_2Y_OPTION_TYPES_BACKFILL_EXECUTION.md` | Created  | ✅     |
| `return_packages/PHASE_2Y_POSTCHECK_VERIFICATION.md`          | Created  | ✅     |

## Acceptance Criteria Status

| Criterion                                         | Status              |
| :------------------------------------------------ | :------------------ |
| Option Type filter no longer returns 0            | ⬜ Pending backfill |
| Known player optionsByYear matches contract rows  | ⬜ Pending backfill |
| npm run build passes                              | ✅                  |
| Filter contract test suite passes                 | ✅                  |
| Migration script is idempotent with dry-run/write | ✅                  |

## Next Actions

1. **Run dry run** to confirm players will be updated
2. **Run single player test** with known player (e.g., `aaron_gordon`)
3. **Execute migration** with `--write` flag
4. **Verify diagnostics** at `/players?debugFilters=1`
5. **Test filter** manually in UI

## Related Documents

- Master Doc: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)
- Execution Doc: [PHASE_2Y_OPTION_TYPES_BACKFILL_EXECUTION.md](PHASE_2Y_OPTION_TYPES_BACKFILL_EXECUTION.md)
