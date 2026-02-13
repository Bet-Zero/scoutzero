# Roster Builder v1 Closure — Execution Return Package (RB_E1)

**Date:** 2026-02-05  
**Scope:** Roster Builder (Quick Lineup Builder) v1 closure

## Master Doc

- Path: `docs/features/roster_builder_quick_MASTER.md`

## Files Changed

- `src/features/roster/utils/rosterUtils.js`
- `src/features/roster/hooks/useRosterManager.js`
- `src/shared/utils/filtering/basicFilterUtils.js`
- `src/features/roster/AddPlayerDrawer/index.jsx`
- `src/features/roster/AddPlayerDrawer/addPlayer/ContractFilters.jsx`
- `src/features/roster/RosterViewer.jsx`
- `src/features/roster/SaveRosterModal.jsx`
- `src/features/roster/RosterViewerActions.tsx`
- `src/features/roster/RosterExportModal.jsx`
- `src/features/roster/RosterPreviewModal.jsx`
- `src/features/roster/RosterExportCapture.jsx`
- `src/firebase/rosterHelpers.js`
- `src/tests/roster/rosterBuilderUtils.test.ts`
- `docs/features/roster_builder_quick_MASTER.md`
- `docs/components/RosterHierarchy.md`

## Fix Summary by Task

### T1 — Roster integrity (5/4/6)

- Added `normalizeRosterShape` + `createEmptyRoster` and applied normalization after auto‑fill, load, add/remove, and before save/update.

### T2 — Team filter mismatch

- Added `normalizeTeamCode` and applied canonical comparison in the add‑player drawer (with fallbacks for player data).

### T3 — Free‑agent type filter mismatch

- Added `normalizeFreeAgentType`, normalized dropdown values, and canonicalized comparisons in drawer filtering logic.

### T4 — Update/Overwrite flow

- Updated `updateRosterProject` to accept a payload with optional `name/team` and always update `updatedAt`.
- Save modal now supports overwrite vs save‑as‑copy; overwrite uses `updateRosterProject`, copy uses `createRosterProject`.

### T5 — Preview/Export wiring

- Added Preview/Export buttons in the main roster UI.
- Wired `RosterPreviewModal` and added JSON export (copy/download) in `RosterExportModal`.

### T6 — Duplicate prevention

- Added `rosterHasPlayer` guard with toast warning to block duplicate adds.

### T7 — Tests / validation

- Added `src/tests/roster/rosterBuilderUtils.test.ts` for roster shape + normalization helpers.

### T8 — Documentation updates

- Updated Master Doc statuses, acceptance criteria, and manual script.
- Regenerated component docs (`RosterHierarchy.md`).

## Validation Commands

- `npm run test -- --run` → **Timed out after 120s**. Partial failures observed in architect tests (seasonManager, signAndTrade, offerSheetPersistence, phase77 ordering, integration). No roster‑builder failures surfaced before timeout.
- `npm run test -- --run src/tests/roster/rosterBuilderUtils.test.ts` → **PASS** (3 tests).
- `npm run typecheck` → **FAIL** (pre‑existing TypeScript errors in architect and team‑scrape files).
- `npm run lint` → **Timed out after 120s** (known large error set).
- `npm run docs` → **PASS** (RosterHierarchy.md updated).
- `npm run validate:project` → **FAIL** (missing required directories: `player-scrape/contracts/output`, `player-scrape/contracts/working`, `team-scrape/shared/firestore_staging/output/merged`).

## Manual Test Script Results (from Master Doc)

1. Navigate to `/roster` from `Tools → Roster Builder`. — **NOT RUN**
2. Select a team and keep load method set to “Current NBA Roster”; verify auto‑fill and 5/4/6 counts. — **NOT RUN**
3. Click an empty slot, pick a player from the drawer, confirm the slot fills. — **NOT RUN**
4. Open the drawer via the global drawer button and select a player; confirm it fills the next available slot. — **NOT RUN**
5. Try to add the same player again; confirm a warning appears and the roster does not duplicate. — **NOT RUN**
6. Remove a player via the ✕ control. — **NOT RUN**
7. Use search to find a player by name; verify list updates. — **NOT RUN**
8. Apply team and FA type filters; verify list updates. — **NOT RUN**
9. Click “Preview”; confirm the modal opens and download works. — **NOT RUN**
10. Click “Export”; confirm JSON copy/download works. — **NOT RUN**
11. Click “Save Roster”, enter a name, save; confirm it appears in `/rosters`. — **NOT RUN**
12. Open the saved roster (`/roster/:id`); confirm lineup matches. Try **Overwrite** and **Save as new copy** from the Save modal. — **NOT RUN**

## Remaining Known Gaps / Risks

- Manual test script not executed in this environment (UI not run).
- Full test suite timed out and includes pre‑existing failures unrelated to roster builder.
- `npm run typecheck` and `npm run validate:project` fail due to pre‑existing repo issues.
- Lint timed out (expected large pre‑existing error set).
- Non‑goals remain: no positional constraints, salary cap, or team limit enforcement.
