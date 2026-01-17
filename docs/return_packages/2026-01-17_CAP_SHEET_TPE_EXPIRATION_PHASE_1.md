# RETURN PACKAGE: TPE Expiration Automation (Phase 1)

**DATE:** 2026-01-17
**INITIATIVE:** Cap Sheet — TPE Expiration Automation
**PHASE:** 1 (Core Logic + Wiring + UI + Tests)
**STATUS:** ✅ COMPLETE

## 1. Summary

Implemented the automated expiration of Trade Exceptions (TPEs) during the season advance workflow. When a World advances to a new season (e.g., 2026-27), any TPEs with an expiry date **before July 1, 2026** (the start boundary of the new season) are automatically removed from the team's asset list. The UI now proactively informs the user of these removals in the Season Advance summary.

## 2. Changes Implemented

| File | Type | Description |
|------|------|-------------|
| `src/features/architect/utils/tpeLifecycle.js` | **NEW** | Added `processTradeExceptions` core logic. |
| `src/features/architect/utils/seasonManager.js` | **MODIFY** | Wired `processTradeExceptions` into the `advanceSeasonInWorld` pipeline. |
| `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx` | **MODIFY** | Updated wizard to display "Expiring Trade Exceptions" in the summary. |
| `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` | **MODIFY** | Updated `createTPE` to write canonical `expiresOn` field. |
| `src/tests/architect/utils/seasonManager.tpe.test.js` | **NEW** | Added unit tests for expiration boundary logic and schema hygiene. |

## 3. Implementation Details

### Core Logic (`tpeLifecycle.js`)

- **Function:** `processTradeExceptions(tradeExceptions, toSeason)`
- **Boundary Rule:** Calculates the start of the *new* season (July 1st).
  - Example: Advancing to `2026-27` -> Boundary is `2026-07-01`.
- **Filtering:**
  - `expiryDate < Boundary` ❌ **REMOVED** (Expired)
  - `expiryDate >= Boundary` ✅ **KEPT** (Active)
- **Schema Support:** Reads both `expiresOn` (canonical) and `expiryISO` (legacy).

### Schema Hygiene (`tradeUtilities.js`)

- New TPEs created via `createTPE` now include:

  ```javascript
  {
    expiresOn: "2026-02-15T...", // Canonical (New)
    expiryISO: "2026-02-15T...", // Legacy (Backward Compat)
  }
  ```

### UI Integration (`SeasonAdvanceModal.jsx`)

- Added a new section to the "Advance to [Season]" summary step.
- Displays: "Expiring Trade Exceptions (N)" with amount and date.
- Uses `findExpiringTPEs` helper to preview what *will* be removed (mirroring the backend logic).

## 4. Validation Results

### Unit Tests

**Command:** `npx vitest run src/tests/architect/utils/seasonManager.tpe.test.js`
**Result:** ✅ **PASS** (5/5 tests passed)

```text
✓ TPE Expiration Lifecycle (4)
  ✓ removes TPEs expiring before the season start boundary (July 1)
  ✓ keeps TPEs expiring on or after season start boundary
  ✓ handles mixed list of active and expired TPEs
  ✓ handles invalid or missing expiry dates safely (preserves them)
✓ TPE Schema Hygiene (1)
  ✓ createTPE produces both expiresOn and expiryISO fields
```

### Manual/Visual Verification (Code)

- **Wiring Check:** `seasonManager.js` explicitly calls `processTradeExceptions` inside `processTeamSeasonTransitionWithOptions`.
- **Persistence:** The returned `activeTPEs` replace `team.tradeExceptions`, effectively deleting expired items from the World overlay.

## 5. Next Steps (Phase 2)

- **Schema Cleanup:** Remove `expiryISO` once all consumers are migrated to `expiresOn`.
- **Global Search:** Audit codebase for any other direct matching of TPE dates using raw string comparisons vs date objects.
- **Backfill:** Consider a migration script for existing TPEs if they lack `expiresOn` (currently handled by fallback read).
