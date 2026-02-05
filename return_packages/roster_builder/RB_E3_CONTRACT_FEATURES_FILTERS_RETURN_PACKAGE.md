# RB_E3 Contract Features Filters — Return Package

**Date:** 2026-02-05  
**Execution Type:** Feature Enhancement  
**Status:** ✅ COMPLETE

## Summary

Fixed the misleading "FA Type" filter in the Add Player drawer by splitting it into two focused filters:

1. **FA Status** — True free agent statuses only (UFA/RFA)
2. **Contract Features** — Options and two-way contracts (TO/PO/ETO/Two-Way)

## T1 — Players Table Logic Location

### Option Detection

- **File:** `src/shared/utils/filtering/playerFilterUtils.js` (Lines 150-155)
- **Field path:** `player.optionByYear[year]` → values are `'PO'`, `'TO'`, `'ETO'`
- **Source:** Enriched via `src/features/roster/utils/enrichPlayerData.js` (Lines 332-365)
  - PRIMARY: `currentContractView.optionsByYear` (denormalized in main doc)
  - FALLBACK: Built from `primaryContract.salariesByYear`

### Two-Way Detection

- **File:** `src/features/roster/utils/contractUtils.js` (Lines 1-21)
- **Function:** `isTwoWayContract(player)`
- **Field paths checked:**
  - `contract.contractType`
  - `contract.signedUsing`
  - `primaryContract.contractType`
  - `contracts[0].contractType`
- **Keywords:** `'two-way'`, `'two way'`, `'two_way'` (case-insensitive)

## T2 — Shared Helpers Added

Added to `src/shared/utils/filtering/basicFilterUtils.js`:

### `playerHasOptionType(player, optionType)`

- Checks both `optionByYear` map (Players Table format) and `options` array (AddPlayerDrawer format)
- Handles nested `player.original` structure
- Normalizes option type to uppercase for comparison

### `isPlayerTwoWay(player)`

- Mirrors logic from `isTwoWayContract` in roster utils
- Handles both direct player objects and `player.original` wrapper format
- Checks `contract`, `primaryContract`, `contracts[0]`, and `currentContractView`

### `getDefaultAddPlayerFilters()`

Updated filter defaults:

- Renamed `freeAgentType` → `freeAgentStatus` (empty string default)
- Added `contractFeature` (empty string default)

## T3 — UI Changes

File: `src/features/roster/AddPlayerDrawer/addPlayer/ContractFilters.jsx`

### Before

- "FA Type" dropdown with: UFA, RFA, SFA, Two-Way, TO, PO, ETO (7 mixed options)

### After

- **FA Status** dropdown: Any, UFA (Unrestricted), RFA (Restricted)
- **Contract Features** dropdown: Any, Team Option, Player Option, ETO, Two-Way

## T4 — Filtering Logic

File: `src/features/roster/AddPlayerDrawer/index.jsx`

- Imported new helpers: `playerHasOptionType`, `isPlayerTwoWay`
- Destructured new filter fields: `freeAgentStatus`, `contractFeature`
- FA Status filter uses `getPlayerFreeAgentType()` for UFA/RFA matching
- Contract Features filter:
  - Two-Way: calls `isPlayerTwoWay(p)`
  - TO/PO/ETO: calls `playerHasOptionType(p, contractFeature)`

## T5 — Test Results

File: `src/tests/roster/rosterBuilderUtils.test.ts`

```
 ✓ Roster Builder Utils (22)
   ✓ normalizeRosterShape pads and truncates to 5/4/6
   ✓ normalizeTeamCode accepts code, slug, and full name
   ✓ normalizeFreeAgentType canonicalizes FA types from schema
   ✓ getPlayerFreeAgentType extracts from currentContractView
   ✓ getPlayerFreeAgentType extracts from bio.display (legacy)
   ✓ getPlayerFreeAgentType extracts from primaryContract.freeAgency
   ✓ getPlayerFreeAgentType returns null for players without FA type
   ✓ getPlayerFreeAgentType prioritizes currentContractView over other sources
   ✓ playerHasOptionType (7)
     ✓ detects Team Option from optionByYear map
     ✓ detects Player Option from optionByYear map
     ✓ detects ETO from optionByYear map
     ✓ detects option from options array (AddPlayerDrawer format)
     ✓ handles nested original format
     ✓ returns false for players without options
     ✓ returns false for null/undefined player
   ✓ isPlayerTwoWay (7)
     ✓ detects two-way from contract.contractType
     ✓ detects two-way from primaryContract.contractType
     ✓ detects two-way from contract.signedUsing
     ✓ handles nested original format
     ✓ returns false for standard contracts
     ✓ returns false for players without contract
     ✓ returns false for null/undefined player

Test Files  1 passed (1)
     Tests  22 passed (22)
```

## Files Changed

| File                                                                | Change                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/shared/utils/filtering/basicFilterUtils.js`                    | Added `playerHasOptionType`, `isPlayerTwoWay` helpers; updated `getDefaultAddPlayerFilters` |
| `src/features/roster/AddPlayerDrawer/addPlayer/ContractFilters.jsx` | Renamed FA Type → FA Status (UFA/RFA only); added Contract Features dropdown                |
| `src/features/roster/AddPlayerDrawer/index.jsx`                     | Imported new helpers; updated filter destructuring and logic                                |
| `src/tests/roster/rosterBuilderUtils.test.ts`                       | Added 14 new tests for option and two-way detection                                         |
| `docs/features/roster_builder_quick_MASTER.md`                      | Updated Gaps & Risks section with RB_E3 closure                                             |

## Field Paths Used

### Option Detection

- `player.optionByYear` (enriched format from Players Table)
- `player.options` (array format in AddPlayerDrawer processed players)
- `player.original.optionByYear` (nested format)

### Two-Way Detection

- `player.contract.contractType`
- `player.contract.signedUsing`
- `player.primaryContract.contractType`
- `player.contracts[0].contractType`
- `player.currentContractView.contractType`

## Build Verification

```
✓ built in 38.77s
No compile errors
```

## Acceptance Criteria

- [x] FA Status UFA/RFA still works (uses `getPlayerFreeAgentType`)
- [x] Contract Features TO/PO/ETO/Two-Way filters use shared helpers
- [x] No console errors
- [x] All 22 tests pass
- [x] Production build succeeds
