# Return Package: PST Emulator Pick Rules Seeding

**Date**: 2026-02-01  
**Goal**: Make `architect_basePickRules` behave like other "must-have" base collections — auto-seeded on first run, persists across restarts.

---

## Summary

Added `architect_basePickRules` to the emulator startup seed check. The collection is now:

- Automatically seeded from `pst_pick_ledger_final_2026_2033.json` if missing
- Persisted across emulator restarts via export-on-exit
- Protected by emulator guards (FIRESTORE_EMULATOR_HOST required)

---

## Files Changed

| File                           | Change                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| `scripts/emu/seedIfMissing.ts` | Added pick rules count check, seeding logic, and verification |
| `scripts/emu/README.md`        | Documented pick rules as part of guaranteed seeded base set   |

---

## Implementation Details

### seedIfMissing.ts Changes

1. **New Constants**:
   - `PICK_LEDGER_JSON_PATH` - path to source ledger file
   - `MIN_PICK_RULES_THRESHOLD = 100` - minimum docs required (conservative)

2. **New Function**: `getExpectedPickRulesCount()`
   - Reads `pst_pick_ledger_final_2026_2033.json`
   - Counts picks with encumbrances (protections, swaps, conveyance, didNotConvey, selectionSpecs)
   - Returns expected doc count (currently 125)

3. **Updated `checkSeedState()`**:
   - Added `architect_basePickRules` collection query
   - Returns `basePickRulesCount` in state object

4. **Updated Main Logic**:
   - Checks if `basePickRulesCount >= MIN_PICK_RULES_THRESHOLD`
   - If missing: runs `npm run pst:push:base-pick-rules` with emulator env vars
   - Verifies count after seeding

### Seed Order

1. entitlements (if missing)
2. baseTeams entitlementIds (if missing)
3. **basePickRules** (if missing) ← NEW
4. basePlayers (if missing)
5. players_v2 (if missing)

---

## Log Excerpt: First Run (Seed Happens)

```
[seed] projectId: scoutzero-bf1ae
[seed] expected entitlement count: 540 (from .../pst_entitlement_assets_2026_2033.json)
[seed] expected base pick rules count: 125 (from .../pst_pick_ledger_final_2026_2033.json)
[seed] base entitlements missing — seeding required
[seed] base team entitlementIds missing — seeding required
[seed] architect_basePlayers missing — seeding required
[seed] players_v2 missing — seeding required
[seed] base pick rules missing or incomplete (0/125) — seeding required
[seed] base entitlements or teams missing — running PST seeding scripts...

> scoutzero-final2@0.0.1 pst:push:base-entitlements
🎉 Base entitlement push complete.

> scoutzero-final2@0.0.1 pst:patch:base-teams-entitlements
🎉 Base teams patch complete.

[seed] base pick rules missing — running pst:push:base-pick-rules...

> scoutzero-final2@0.0.1 pst:push:base-pick-rules
=== Push Base Pick Rules ===
Total picks in ledger: 480
Picks with rules: 125
✅ Batch 1/1 committed (125 docs)
🎉 Base pick rules push complete. 125 docs written.

[seed] seeding architect_basePlayers from staged data...
[seed] architect_basePlayers: 660 players (660 writes across 2 batches).
[seed] seeding players_v2 from staged data...
[seed] players_v2: 660 players (1980 writes across 5 batches).
```

---

## Log Excerpt: Second Run (Seed Skipped)

```
[seed] projectId: scoutzero-bf1ae
[seed] expected entitlement count: 540 (from .../pst_entitlement_assets_2026_2033.json)
[seed] expected base pick rules count: 125 (from .../pst_pick_ledger_final_2026_2033.json)
[seed] base entitlements present (540) — skipping
[seed] base teams entitlementIds present (30/30) — skipping
[seed] architect_basePlayers present — skipping seed
[seed] players_v2 present — skipping seed
[seed] base pick rules present (125) — skipping
```

---

## Acceptance Criteria Verification

| Criterion                                                                       | Status                           |
| ------------------------------------------------------------------------------- | -------------------------------- |
| Starting emulators with empty `.emulator-data` results in pick rules present    | ✅ Verified                      |
| Restarting emulators preserves `architect_basePickRules` (export-on-exit works) | ✅ Verified                      |
| Second run of `npm run emu` skips pick rules seeding if already present         | ✅ Verified                      |
| No production writes possible without emulator env vars                         | ✅ Protected by `initAdminEmu()` |
| `scripts/emu/README.md` documents pick rules as guaranteed base set             | ✅ Updated                       |

---

## Validation Steps Performed

1. `rm -rf .emulator-data` - Cleared existing data
2. `npm run emu` - Started fresh, observed full seeding including pick rules (125 docs)
3. Verified emulator UI shows `architect_basePickRules` collection
4. Ctrl+C to trigger export
5. `npm run emu` again - Observed all collections skipped (already present)
6. Pick rules count confirmed: 125/125

---

## Notes

- The threshold check uses `MIN_PICK_RULES_THRESHOLD = 100` rather than exact match
- This is conservative to handle minor variations in ledger processing
- Expected count (125) is derived from picks with encumbrances in the ledger
- All emulator guards from `initAdminEmu()` apply (FIRESTORE_EMULATOR_HOST required)
