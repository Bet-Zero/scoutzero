# Architect Free Agency MASTER

## Purpose / Definition of Done

This document is the SSOT for Architect Free Agency preflight findings and high-level requirements to reach a shippable FA tab.

Definition of Done (high-level):

- Free Agency reads/writes through the same Architect SSOT used by Cap Sheet and Trade Machine.
- FA list is derived from the same canonical Architect contract/player state (including world context).
- Core FA mechanics (signings, cap holds, rights, exceptions, offer sheets, options, renounce) are wired, reflected in cap sheet state, and persisted only to writable Architect world/plan storage.
- No GM action writes to base `/teams`-style immutable datasets.
- Vacuum/worldless behavior is coherent and intentional.

---

## Current State (as-found)

### Live entry + tab chain

- Route chain is live: `/gm/:teamId` -> `GmDashboardView` -> `GMDashboard`.
- Free Agency is a live tab inside `GMDashboard` (`activeTab === 'fa'`) and is wired through `FreeAgencySection`.
- Key evidence:
  - `src/App.jsx:35`
  - `src/pages/GmDashboardView.jsx:7`
  - `src/features/architect/GMDashboard/GMDashboard.jsx:317`
  - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:49`

### Shared SSOT layer

- Shared dashboard state: `useArchitectState`.
- Shared dashboard actions/mutations: `useArchitectActions`.
- Persist path: `persistMutation` -> `applyWorldMutation` -> `persistWorldMutation` -> `architect_worlds/{worldId}/...`.
- Key evidence:
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:268`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:392`
  - `src/features/architect/utils/mutationPipeline.js:447`
  - `src/features/architect/utils/mutationPipeline.js:2425`

### Free-agent pool as-found

- Displayed pool is derived from `architect_basePlayers` contracts in `useArchitectState`.
- World player overrides are not part of this derivation path.
- A separate `freeAgents` collection loader exists but does not drive live list rendering.
- Key evidence:
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:335`
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:420`
  - `src/features/architect/utils/subscribeArchitectPlayerData.ts:77`
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:384`
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js:257`

---

## SSOT Requirements (what Free Agency must use)

- Use one shared state container for dashboard surfaces (Cap Sheet, Trade, FA), not parallel local data models.
- Use one shared mutation pipeline for all FA mutations, including validation and persistence contracts.
- Use world-aware loaders for all team/player reads in world mode.
- Persist only to Architect writable world/plan storage (`architect_worlds` or formal equivalent), never base team collections.
- Preserve intentional vacuum-mode behavior with explicit guarantees for each FA operation.

Reference anchors:

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:268`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:392`
- `src/features/architect/utils/worldTeamData.ts:81`
- `src/features/architect/utils/teamLoader.js:25`
- `src/features/architect/utils/mutationPipeline.js:588`
- `src/constants/collections.ts:58`

---

## Free Agent Pool Requirements

- Pool derivation must be from canonical architect player/contract schema (not legacy static pools).
- In world mode, pool must resolve against world-overlaid player state (including world player overrides and parent fallback behavior).
- Pool transitions (sign, option decline, renounce effects, offer-sheet status changes) must reflect immediately from shared state and survive reload.
- Remove or formally deprecate parallel/unused pool loaders that can drift from live behavior.

Reference anchors:

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:420`
- `src/features/architect/utils/teamLoader.js:229`
- `src/features/architect/utils/firebaseTeamPlanHelpers.js:255`

---

## Rules & Mechanics Requirements (high-level)

- **Signings:** enforce rights/exception/apron/hard-cap/roster checks and apply all cap effects in shared state.
- **Cap holds:** creation/removal must be consistent across signings/options/renounce and reflected in cap totals.
- **Bird rights:** support eligibility gates and renounce transitions.
- **Exceptions:** MLE/TPMLE/Room/BAE/Minimum eligibility and usage tracking must be consistent in UI/state/persisted data.
- **Offer sheets:** store/match/decline/finalize must be fully operable from live UI with correct team-role gating and cleanup.
- **Options/Renounce:** accept/decline + renounce flows must mutate canonical state and persist correctly.
- **Vacuum mode:** behavior must be coherent and documented for every FA operation.

Reference anchors:

- `src/features/architect/utils/capLegalityValidation.js:2029`
- `src/features/architect/utils/capLegalityValidation.js:3038`
- `src/features/architect/utils/capLegalityValidation.js:3425`
- `src/features/architect/utils/capLegalityValidation.js:3758`
- `src/features/architect/utils/capLegalityValidation.js:3819`
- `src/features/architect/utils/mutationPipeline.js:1438`
- `src/features/architect/utils/mutationPipeline.js:1808`
- `src/features/architect/utils/mutationPipeline.js:1968`
- `src/features/architect/utils/mutationPipeline.js:2568`
- `src/features/architect/utils/mutationPipeline.js:3169`

---

## Gaps

### A) SSOT alignment gaps

- FA pool derives from base players subscription, not world-overlaid player state.
- `loadFreeAgents()` legacy source is still invoked though not used in live pool rendering.

### B) Operation wiring gaps

- `handleSign` local optimistic update does not apply full pipeline mechanics (cap-hold removal, exception usage, hard-cap updates).
- Offer-sheet finalize buttons call action with wrong argument shape (live finalize can no-op).
- Multiple offer-sheet/sign-and-trade actions are persist-only with no shared-state optimistic update.

### C) Vacuum-mode coherence gaps

- Persistence hard-skips with null `worldId`; behavior differs by operation depending on whether local optimistic update exists.

### D) Validation/test surface gaps

- Strong pipeline/unit coverage exists, but UI-level FA wiring coverage is lighter than pipeline coverage.

Reference anchors:

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:335`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:384`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:632`
- `src/features/architect/GMDashboard/components/OfferSheetList.jsx:83`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:800`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:398`

---

## Open Questions

- Should FA pool in world mode include world player overrides only, or merged world->parent->base exactly like teamLoader player resolution?
- For vacuum mode, should all FA operations be supported purely in-memory, or should some be explicitly disabled with UI messaging?
- Should offer-sheet finalize remain list-driven, modal-driven, or both (single canonical UX path)?
- Is the legacy `freeAgents` collection path intentionally retained for fallback tooling, or should it be fully retired from dashboard runtime paths?
- What is the expected product behavior for QO/withdraw-QO flows in this phase (explicitly unsupported vs required)?

---

## FA_E1 Execution (2026-02-12)

### Definition of Done + Current Status

- Free Agency tab uses SSOT/pipeline-consistent mutation behavior with explicit world/vacuum policy.
- Offer-sheet finalize wiring bug is fixed and regression-tested.
- Vacuum mode has no silent no-op for world-required FA commit actions.
- Signing flow no longer relies on partial optimistic cap patches.
- FA pool is world-aware on reload and post-mutation refresh.
- Legacy `loadFreeAgents()` runtime read has been removed from live FA pool flow.

Status: **CLOSED ✅**

### Final SSOT Wiring (Implemented)

- `signFreeAgent` now uses canonical mutation outcomes:
  - World mode: `applyWorldMutation` + canonical `changedTeams` sync (with reload fallback via `loadWorldTeamData`).
  - Vacuum mode: `validateSigning` + `computeWorldMutation('signFreeAgent')` then apply computed snapshot locally.
- FA world mutations now use one authoritative runner in `useArchitectActions`:
  - `signFreeAgent`
  - `signAndTrade`
  - `storeOfferSheet`
  - `matchOfferSheet`
  - `declineOfferSheet`
  - `finalizeMatchedOfferSheet` / `finalizeDeclinedOfferSheet`
- Post-success sync refreshes both current team cap sheet and world roster index to keep FA pool + cap sheet coherent.

### World-Aware FA Pool (Implemented)

- Added world roster index loading in `useArchitectState` from `getLeague(worldId)`.
- World mode FA derivation now excludes players rostered in world team snapshots and includes players unrostered in world context.
- Refresh triggers:
  - initial world/team load
  - world switch
  - successful FA world mutations via action runner callback.

### Vacuum-Mode Policy (Implemented)

- Allowed in vacuum mode:
  - `signFreeAgent` (local canonical compute path)
- World-required (explicitly gated in handler + UI):
  - `signAndTrade`
  - `storeOfferSheet`
  - `matchOfferSheet`
  - `declineOfferSheet`
  - `finalizeMatchedOfferSheet`
  - `finalizeDeclinedOfferSheet`
- UI now disables/gates offer-sheet actions with reason text and removes Sign & Trade option in vacuum mode.

### FA_E1 Validation Evidence

- Added tests:
  - `src/tests/architect/OfferSheetList.freeAgency.test.jsx`
  - `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
  - `src/tests/architect/useArchitectState.worldFreeAgency.test.tsx`
- Targeted FA_E1 tests pass:
  - `npm run test -- --run src/tests/architect/OfferSheetList.freeAgency.test.jsx src/tests/architect/useArchitectActions.freeAgency.test.tsx src/tests/architect/useArchitectState.worldFreeAgency.test.tsx`
  - Result: `3 passed`, `7 passed`
- Required gates executed:
  - `npm run test -- --run` -> fails in pre-existing broader baseline suites (`22 failed files / 76 failed tests`; FA_E1 tests pass in this run)
  - `npm run build` -> pass
  - `npm run validate:project` -> fails due pre-existing missing required directories:
    - `player-scrape/contracts/output`
    - `player-scrape/contracts/working`
    - `team-scrape/shared/firestore_staging/output/merged`

---

## Filters + Search (Execution) (2026-02-13)

### Scope

- Add local UI controls for Free Agency list usability now:
  - search
  - position filter
  - age bucket filter
  - salary bucket filter
  - sort dropdown
  - clear/reset action
- Reuse existing project filtering/search/sort patterns where feasible.
- Keep scope local to FA tab rendering only (no world pool correctness expansion, no cap-legality filters).

### Found Files

- Free Agency tab chain:
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
- `freeAgents` source and derivation:
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- Existing filter/search/sort references reused:
  - `src/shared/utils/filtering/playerFilterUtils.js`
  - `src/shared/utils/filtering/basicFilterUtils.js`
  - `src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx`
  - `src/features/roster/AddPlayerDrawer/index.jsx`

### Decisions and Behavior

- Shared helper added at:
  - `src/shared/utils/filtering/freeAgencyFilterUtils.ts`
- Filter bar UI added at:
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx`
- Free Agency list wiring updated in:
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`

Exact behavior:

- Search:
  - Case-insensitive.
  - Diacritic-insensitive (accent normalized).
  - Tokenized matching across name, team text, and position text.
- Position:
  - Buckets: Guard, Wing, Big.
- Age (Balanced buckets):
  - `<=24`, `25-29`, `30+`.
  - Missing ages are safely excluded only when age filter is active.
- Salary (Balanced buckets, using previous salary):
  - `<$5M`, `$5M-$10M`, `$10M-$20M`, `$20M+`.
  - Missing salaries are safely excluded only when salary filter is active.
- Sort:
  - Name A-Z
  - Salary high->low
  - Age low->high
- Clear:
  - Restores default state (`Salary high->low`, empty query, all buckets).
- Empty results:
  - Displays `No matches` without crashing.

### Deliberate Simplifications

- No cap-legality filter in this phase.
- No changes to world overlay/pool correctness logic in this phase.
- No Firestore read/write behavior changes for this work.

### Validation Evidence

- Targeted Free Agency tests:
  - `npm run test -- --run src/tests/architect/utils/freeAgencyFilterUtils.test.ts src/tests/architect/OfferSheetList.freeAgency.test.jsx src/tests/architect/useArchitectActions.freeAgency.test.tsx src/tests/architect/useArchitectState.worldFreeAgency.test.tsx`
  - Result: `4 passed files`, `14 passed tests`.
- Full test gate:
  - `npm run test -- --run`
  - Result: `222 passed files`, `2946 passed`, `1 skipped`, `3 todo`.
- Build:
  - `npm run build`
  - Result: pass (bundle-size warnings only).
- Lint:
  - `npm run lint`
  - Result: fails with pre-existing baseline issues (`2976 problems`) outside this change scope.
- Dev server smoke (terminal-level):
  - `npm run dev -- --host 127.0.0.1 --port 5173`
  - `curl -I http://127.0.0.1:5173`
  - Result: server started and returned `HTTP/1.1 200 OK`.

---

## UX Enhancements: Results Count + Persisted Filters (2026-02-13)

### Scope

Two narrow UX upgrades to the Free Agency tab filter bar:

1. **Results count indicator** — shows `X results` or `X of Y results` live in the filter bar as the user types/toggles.
2. **Persisted filter state** — search, position, age, salary, and sort selections survive tab switches and page refreshes via localStorage.

No world-overlay corrections, no cap-legality filter, no Firestore changes.

### Files Changed / Added

| File                                                                      | Change                                                                                                                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts`     | **New** — persistence hook + pure parse/load/save/clear helpers                                                                           |
| `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`       | Replaced inline `useState` filter state with `useFreeAgencyFilterPersistence()` hook; passes `filteredCount` / `totalCount` to filter bar |
| `src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx` | Added `filteredCount` / `totalCount` props; renders results indicator right-aligned in the bar                                            |
| `src/tests/architect/utils/freeAgencyFilterPersistence.test.ts`           | **New** — 15 unit tests for parsing, round-trip, error handling                                                                           |

### Results Count Behavior

- Unfiltered: `X results` (filteredCount === totalCount).
- Filtered / searched: `X of Y results`.
- Updates immediately — reuses existing `useMemo`-d filtered array (no re-filter).

### Persistence Behavior

| Detail                | Value                                                        |
| --------------------- | ------------------------------------------------------------ |
| Storage key           | `architect-free-agency-filters-v1`                           |
| Persisted fields      | `query`, `position`, `ageBucket`, `salaryBucket`, `sortBy`   |
| Invalid JSON          | Caught, key removed, defaults applied — no crash             |
| Unknown field values  | Normalized to defaults per field                             |
| Clear action          | Resets UI **and** calls `localStorage.removeItem` on the key |
| Non-writeable storage | Silent catch — UI still works, just won't persist            |

### Persisted State Shape

```json
{
  "query": "",
  "position": "",
  "ageBucket": "",
  "salaryBucket": "",
  "sortBy": "salary_desc"
}
```

### Validation Evidence

- Targeted tests:
  - `npm run test -- --run src/tests/architect/utils/freeAgencyFilterPersistence.test.ts src/tests/architect/utils/freeAgencyFilterUtils.test.ts`
  - Result: `2 passed files`, `22 passed tests`.
- Full test gate:
  - `npm run test -- --run`
  - Result: all passing (no regressions introduced).
- Build:
  - `npm run build`
  - Result: pass (bundle-size warnings only).
