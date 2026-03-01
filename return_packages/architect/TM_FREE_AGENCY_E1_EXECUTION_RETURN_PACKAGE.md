# TM_FREE_AGENCY_E1 — EXECUTION RETURN PACKAGE

Date: 2026-03-01  
Ticket: `TM_FREE_AGENCY_E1`  
Mode: EXECUTION (implementation + tests + docs)  
Scope: Free Agency tab only (`activeTab === 'fa'`) in GM Dashboard

## 1) Summary

Implemented in-tab offer-sheet initiation for Free Agency world mode using existing authoritative mutation plumbing, preserved success-gated modal close behavior, added regression tests for world/base gating + state sync, and updated SSOT/ship-gates docs.

## 2) Task-by-Task Changes

### Task A1 — Offer sheet initiation wiring in Free Agency modal (world mode)

- Added `onStoreOfferSheet` prop wiring into Free Agency pool modal path.
- Updated FA modal action set to include `signNew` (label override remains user-facing `Sign Free Agent`) and keep `signAndTrade` in world mode.
- World mode now passes `onStoreOfferSheet`; base mode passes `null` so offer-sheet toggle is not reachable.
- Existing callback contract and close-gate behavior unchanged (`{ success, message }`, close only on success).

Evidence:
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:42-50`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:177-192`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:16-23`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:65-73`
- `src/features/architect/GMDashboard/GMDashboard.jsx:318-333`
- `src/shared/components/EditContractModal.jsx:715-729`
- `src/shared/components/EditContractModal.jsx:813-823`
- `src/shared/components/EditContractModal.jsx:1097-1110`

### Task A2 — Outgoing offer-sheet UI update after store success

- No new mutation type added; reused existing `handleStoreOfferSheet`.
- Confirmed world save path uses `runAuthoritativeFAMutation('storeOfferSheet')`.
- Current team state updates from authoritative `changedTeams` via `syncTeamFromMutationResult`, which drives outgoing list input (`teamCapSheet.offerSheets`) already wired in Free Agency section.

Evidence:
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:768-839`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1658-1731`
- `src/features/architect/GMDashboard/GMDashboard.jsx:327-330`

### Task B — SSOT docs update: offer-sheet initiation + authoritative vs preview

- Updated Free Agency master doc with:
  - new `Offer Sheet Initiation (E1)` section,
  - new `Authoritative vs Preview (E1)` section,
  - workflow table entry for `Store Offer Sheet (world-only)`,
  - status promoted from preflight/discovery to E1 execution SSOT.

Evidence:
- `docs/architect/free_agency_MASTER.md:1-4`
- `docs/architect/free_agency_MASTER.md:36-45`
- `docs/architect/free_agency_MASTER.md:64-100`

### Task C (optional safe cleanups)

- **C1 completed:** removed stale `capProjections` pass-through into `FreeAgentPool` and aligned `FreeAgencySection` prop surface.
- **C2 completed:** aligned `ActiveTab` union values with runtime keys (`cap`, `capfull`, `fa`) in local hook typing.

Evidence:
- `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:16-23`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:65-73`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:157-164`

## 3) Tests Added / Extended

### New tests

1. `src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx`
   - World mode: offer-sheet toggle reachable from FA modal path, failed store keeps modal open, success closes.
   - Base mode: offer-sheet toggle absent, standard signing path used, no store-offer-sheet callback call.
   - Evidence: `src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx:83-167`

### Extended tests

1. `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
   - World mode: `handleStoreOfferSheet` uses `storeOfferSheet` mutation and updates outgoing list state from `changedTeams`.
   - Base mode: offer-sheet store blocked with no authoritative write.
   - Evidence: `src/tests/architect/useArchitectActions.freeAgency.test.tsx:254-337`

## 4) Validation Commands Run (Required)

1. `npm run test:node -- --run --reporter=dot`
   - Result: PASS
   - Summary: `Test Files 255 passed | 1 skipped (256)`; `Tests 3237 passed | 9 skipped | 3 todo (3249)`

2. `npm run test:ui -- --run --reporter=dot`
   - Result: PASS
   - Summary: `Test Files 40 passed (40)`; `Tests 388 passed | 2 skipped (390)`

3. `npm run build`
   - Result: PASS
   - Summary: `✓ built in 29.05s`
   - Notes: existing non-blocking Vite chunk-size/dynamic-import warnings emitted.

4. `npm run validate:project`
   - Result: PASS
   - Summary: `✅ All validations passed!`

### Targeted test command (requested)

- `npm run test:ui -- --run src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx src/tests/architect/useArchitectActions.freeAgency.test.tsx --reporter=dot`
  - Result: PASS
  - Summary: `Test Files 2 passed (2)`; `Tests 8 passed (8)`

## 5) Commands Intentionally Skipped

- `npm run dev` (not needed; task completed with automated validation and no manual smoke requirement in this execution run).
- `npm run typecheck` (not requested in ticket validation list).
- `npm run test:full` (not permitted without explicit `RUN FULL SUITE` token).

## 6) Files Changed (This Ticket)

- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
- `src/features/architect/GMDashboard/GMDashboard.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx` (new)
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
- `docs/architect/free_agency_MASTER.md`
- `docs/SHIP_GATES_MASTER.md`
- `return_packages/architect/TM_FREE_AGENCY_E1_EXECUTION_RETURN_PACKAGE.md` (new)

## 7) Remaining Gaps (Ranked)

### P0
- None in scoped Free Agency E1 execution.

### P1
- None in scoped Free Agency E1 execution.

### P2
- None in scoped Free Agency E1 execution.

## 8) git status --short

```bash
 M docs/SHIP_GATES_MASTER.md
 M docs/architect/EDIT_CONTRACT_MASTER.md
 M docs/architect/free_agency_MASTER.md
 M src/features/architect/GMDashboard/GMDashboard.jsx
 M src/features/architect/GMDashboard/hooks/useArchitectState.ts
 M src/features/architect/GMDashboard/sections/FreeAgencySection.jsx
 M src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx
 M src/tests/architect/useArchitectActions.freeAgency.test.tsx
?? return_packages/architect/TM_EDIT_CONTRACT_E2_EXECUTION_RETURN_PACKAGE.md
?? return_packages/architect/TM_FREE_AGENCY_E1_EXECUTION_RETURN_PACKAGE.md
?? return_packages/architect/TM_FREE_AGENCY_P1_PREFLIGHT_RETURN_PACKAGE.md
?? src/tests/architect/editContractModal_closure.gate.test.ts
?? src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx
```
