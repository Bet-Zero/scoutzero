# Phase 2Y: Option Types Backfill Execution

**DATE**: 2026-02-02
**STATUS**: ✅ COMPLETE

## Summary

Phase 2Y creates a production-ready idempotent migration script to backfill `currentContractView.optionsByYear` from the contracts subcollection. This enables the Option Type filter to return real players.

## Problem Solved

The Option Type filter was returning 0 players because:

1. `currentContractView.optionsByYear` (SSOT) was not populated in Firestore
2. `useSimplePlayerData` loads the main doc only, not the contracts subcollection
3. `enrichPlayerData` correctly reads from SSOT but no data existed

## Files Changed

| File                                                        | Change                                              |
| :---------------------------------------------------------- | :-------------------------------------------------- |
| `scripts/migrations/phase2y_backfill_optionsByYear.js`      | NEW: Migration script                               |
| `src/features/table/PlayerTable/FilterDiagnosticsPanel.jsx` | Added optionsByYear count and "Data not backfilled" |
| `src/tests/scouting/player_filters_wiring_contract.test.js` | 2 new Phase 2Y tests                                |
| `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`       | Added Phase 2Y section                              |

## How to Run Backfill

### Dry Run (Default - Safe)

Scan all players and report what would change without writing:

```bash
node scripts/migrations/phase2y_backfill_optionsByYear.js
```

### Single Player Dry Run

Test with a specific player first:

```bash
node scripts/migrations/phase2y_backfill_optionsByYear.js --player=aaron_gordon
```

### Write Mode

Actually update Firestore (requires explicit flag):

```bash
# With emulator (safe)
FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/migrations/phase2y_backfill_optionsByYear.js --write

# Production (requires explicit permission)
ALLOW_PROD_MIGRATION_WRITE=true node scripts/migrations/phase2y_backfill_optionsByYear.js --write
```

### Single Player Write

Update a single player:

```bash
node scripts/migrations/phase2y_backfill_optionsByYear.js --player=aaron_gordon --write
```

## Migration Script Features

| Feature              | Description                                                 |
| :------------------- | :---------------------------------------------------------- |
| Idempotent           | Safe to re-run; only updates if data differs                |
| Dry run default      | No writes unless `--write` is specified                     |
| Production safety    | Refuses writes to prod unless emulator or explicit env var  |
| Single player mode   | `--player=<id>` for targeted testing                        |
| Summary output       | Players scanned, updated, option breakdown counts           |
| Year normalization   | Converts season strings to seasonStartYear (2025-26 → 2025) |
| Option normalization | Handles "Player Option" → "PO", "Team Option" → "TO", etc.  |

## Script Output Example

```
============================================================
Phase 2Y: Backfill optionsByYear Migration
============================================================
Mode: DRY RUN
Target: All players
Firestore: Production
============================================================

[INFO] Found 475 players to process...
[INFO] Processed 50/475...
[INFO] Processed 100/475...
...

DETAILED RESULTS:
------------------------------------------------------------
  Aaron Gordon:
    Status: would_update
    optionsByYear: {"2025":"PO","2026":"PO"}
    Previous: null
    Message: Would update optionsByYear (dry run)
...

============================================================
SUMMARY
============================================================
Total players scanned:  475
  - Not found:          0
  - No contracts:       12
  - No option data:     398
  - Already current:    0
  - Would update:       65
  - Errors:             0

Option Types Breakdown (across all options):
  - PO (Player Option): 42
  - TO (Team Option):   18
  - ETO (Early Term.):  5
============================================================
```

## How to Verify

After running with `--write`:

1. **Check diagnostics panel**:

   ```
   /players?debugFilters=1
   ```

   - Look for "currentContractView.optionsByYear" count > 0
   - "Data Not Backfilled" warning should disappear

2. **Test Option Type filter**:
   - Go to `/players`
   - Open Filters
   - Set Salary Year to 2025
   - Select Option Types: "PO"
   - Verify players appear in results

3. **Verify specific player**:
   - Check a known player's Firestore doc
   - Confirm `currentContractView.optionsByYear` exists with correct values

## Year Semantics (SSOT)

All year-keyed data uses **seasonStartYear** convention:

| Source Format | Stored Key | Example       |
| :------------ | :--------- | :------------ |
| `"2025-26"`   | `"2025"`   | Season string |
| `2025`        | `"2025"`   | Number        |
| `"2025"`      | `"2025"`   | String year   |

This matches the `salaryYear` and `optionYear` filter semantics.

## Safety Latch

The script refuses to write to production unless explicitly allowed:

```
[ERROR] Production write refused!

You are attempting to write to PRODUCTION Firestore without explicit permission.
To proceed, either:
  1. Use the emulator: FIRESTORE_EMULATOR_HOST=localhost:8080
  2. Set explicit permission: ALLOW_PROD_MIGRATION_WRITE=true

This safety latch prevents accidental production data modifications.
```

## Related Documents

- Master Doc: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)
- Phase 2X Return Package: [PHASE_2X_OPTION_TYPES_SSOT_RETURN_PACKAGE.md](scouting/PHASE_2X_OPTION_TYPES_SSOT_RETURN_PACKAGE.md)
- Postcheck Verification: [PHASE_2Y_POSTCHECK_VERIFICATION.md](PHASE_2Y_POSTCHECK_VERIFICATION.md)
