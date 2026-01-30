# Return Package: PST Emulator BaseTeams Restore and Patch Fix

**Date:** 2026-01-29  
**Scope:** Emulator workflow improvements for architect_baseTeams restoration

## Summary

This fix ensures that the emulator workflow never leaves `architect_baseTeams` in a broken state by:

1. Confirming the entitlement patch script uses safe merge semantics (already correct)
2. Adding a deterministic reseed script to restore baseTeams from staged JSON
3. Adding repair commands to fix broken team data

## Root Cause Analysis

The original concern was that `pst_phase_10_patch_base_teams_entitlements.ts` might overwrite baseTeams documents. However, upon inspection, the script already uses:

```typescript
batch.set(docRef, { entitlementIds }, { merge: true });
```

This is **safe** - it only updates the `entitlementIds` field without touching other fields. The actual issue was likely caused by a different operation or data corruption, not this patch script.

## Changes Made

### Task A: Patch Script Verification ✅

**File:** [pst_phase_10_patch_base_teams_entitlements.ts](team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts#L77)

- **Status:** Already safe - no changes needed
- **Evidence:** Line 77 uses `batch.set(docRef, { entitlementIds }, { merge: true })`
- The `{ merge: true }` option ensures only the specified field is updated

### Task B: BaseTeams Reseed Script ✅

**Created:** [scripts/emu/reseedBaseTeams.ts](scripts/emu/reseedBaseTeams.ts)

Features:

- **Emulator-only guard:** Refuses to run without `FIRESTORE_EMULATOR_HOST` set
- **Source:** Reads all 30 team JSON files from `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/`
- **Validation:** Ensures each source file has required fields (`teamCode`, `teamName`, `roster`)
- **Permissive for dev:** Warns about empty rosters but continues (appropriate for emulator/dev environments)
- **Full restore:** Uses `set()` without merge to fully replace documents
- **Post-write verification:** Confirms 30 docs exist with all required fields

### Task C: Package.json Commands ✅

**Modified:** [package.json](package.json)

Added scripts:

| Command                | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `emu:reseed:baseTeams` | Restore baseTeams from staged JSON (full replacement)         |
| `emu:repair:teams`     | Restore baseTeams then re-patch entitlementIds (one-stop fix) |

### Task D: README Updated ✅

**Modified:** [scripts/emu/README.md](scripts/emu/README.md)

Added:

- Troubleshooting entry for broken rosters
- Command table entries for new scripts

## Validation Steps

### 1. Start Emulators

```bash
npm run emu
```

### 2. Run Repair Command

```bash
npm run emu:repair:teams
```

Expected output:

```
[reseed:baseTeams] === RESEED ARCHITECT_BASETEAMS ===
[reseed:baseTeams] Source: .../baseTeams
[reseed:baseTeams] Found 30 team source files
[reseed:baseTeams] ⚠️  Source warnings (non-fatal):
  - POR: roster is empty - team will have no players
[reseed:baseTeams] All 30 source files validated
[reseed:baseTeams] Writing teams to Firestore emulator...
[reseed:baseTeams] ✅ Batch committed: 30 teams (30/30)
[reseed:baseTeams] Wrote 30 team documents
[reseed:baseTeams] Verifying final state...

=== RESEED COMPLETE ===
[reseed:baseTeams] ✅ 30 team docs restored with full data
[reseed:baseTeams] ✅ All docs have teamCode, teamName, and roster fields

=== Patch Base Teams Entitlements ===
...
✅ Batch 1/1 committed (30 teams)
🎉 Base teams patch complete.
```

**Note:** The POR (Portland) source data has an empty roster due to a failed scrape (shows "Error (404)"). The script warns about this but continues - this is appropriate for an emulator/dev environment.

### 3. Verify in Emulator UI

Navigate to `http://localhost:4000/firestore` and verify:

- `architect_baseTeams` has 30 documents
- Each document (e.g., LAL) has:
  - `teamCode` (e.g., "LAL")
  - `teamName` (e.g., "LOS ANGELES LAKERS")
  - `roster` (array with player IDs)
  - `capHolds` (array)
  - `entitlementIds` (array, after patch runs)

### 4. Verify App Loads Teams

```bash
npm run dev
```

Confirm:

- Teams load in the Architect view
- Player rosters appear correctly
- Team salaries differ between teams

## Files Changed

| File                                                                                | Action   | Purpose                                                      |
| ----------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| `team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts` | Verified | Already uses `{ merge: true }` - no changes needed           |
| `scripts/emu/reseedBaseTeams.ts`                                                    | Created  | Emulator-only baseTeams restore script                       |
| `package.json`                                                                      | Modified | Added `emu:reseed:baseTeams` and `emu:repair:teams` commands |
| `scripts/emu/README.md`                                                             | Modified | Added troubleshooting and command documentation              |
| `team-scrape/shared/firestore_staging/scripts/run_full_team_scrape.ts`              | Fixed    | Corrected POR slug from `blazers` to `trailblazers`          |

## Proof: Patch Does Not Overwrite

From [pst_phase_10_patch_base_teams_entitlements.ts#L77](team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts#L77):

```typescript
batch.set(docRef, { entitlementIds }, { merge: true });
```

The `{ merge: true }` Firestore option ensures:

- Only the `entitlementIds` field is written
- All other existing fields (`teamCode`, `teamName`, `roster`, `capHolds`, etc.) are preserved
- This is equivalent to using `update()` but creates the document if it doesn't exist

## Future Prevention

The `npm run emu:repair:teams` command provides a single-command recovery path when baseTeams data becomes corrupted from any source. This command should be included in the standard troubleshooting guide for emulator issues.

## Validation Confirmed ✅

**Date:** 2026-01-29  
**Environment:** Firestore Emulator (127.0.0.1:8082)

Successfully executed:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run emu:repair:teams
```

Results:

- ✅ All 30 team documents restored from staged JSON
- ✅ POR warning issued (empty roster) but processing continued
- ✅ Entitlement patch completed successfully (30 teams)
- ✅ No data loss - all fields preserved except entitlementIds updated
- ✅ Commands work as documented in return package

## Root Cause: Portland Trail Blazers URL Issue 🔍

**Finding:** The POR empty roster was caused by an incorrect URL slug in the team scraper.

**Investigation:**

- Current slug: `blazers` → <https://www.salaryswish.com/teams/blazers> (404)
- Correct slug: `trailblazers` → <https://www.salaryswish.com/teams/trailblazers> (200)

**Fix Applied:**
Changed [run_full_team_scrape.ts](team-scrape/shared/firestore_staging/scripts/run_full_team_scrape.ts#L55):

```diff
- POR: 'blazers',
+ POR: 'trailblazers',
```

**To regenerate POR data:**

```bash
npm run team:full POR
```

This will re-scrape Portland with the correct URL and populate the roster properly.
