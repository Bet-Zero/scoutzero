# Architect Free Agency MASTER (TM_FREE_AGENCY_E1 Execution SSOT)

Last Updated: 2026-03-01 (P1 Offer Sheet lifecycle call-graph added)  
Status: E1 implementation complete with E2 closure permanence gates added for Free Agency offer-sheet initiation and authoritative FA sync wiring.

## IN SCOPE

- GM Dashboard Free Agency tab wiring and workflows only (`activeTab === 'fa'`). (Evidence: `src/features/architect/GMDashboard/GMDashboard.jsx:318-335`)
- Route -> dashboard -> tab render proof. (Evidence: `src/App.jsx:35`, `src/pages/GmDashboardView.jsx:2-8`)
- Free Agency workflow handlers, validators, persistence path, cap refresh path.
- Base vs world mode behavior for Free Agency actions.

## OUT OF SCOPE

- Trade Machine deep audit (except where sign-and-trade path is required to prove FA wiring).
- Cap Sheet feature audit outside proving totals SSOT refresh contract.
- Refactors, fixes, and runtime behavior changes.
- Firestore source-data write-path changes (`players_v2`, `architect_base*`).

## Page Map

1. Route registration:
   - `/gm/:teamId` -> `GmDashboardView`. (Evidence: `src/App.jsx:35`)
2. Page wrapper:
   - `GmDashboardView` renders `GMDashboard`. (Evidence: `src/pages/GmDashboardView.jsx:2-8`)
3. Tab switch + render gate:
   - Free Agency button sets `activeTab` to `'fa'`. (Evidence: `src/features/architect/GMDashboard/GMDashboard.jsx:241-250`)
   - Conditional render mounts `FreeAgencySection` when `activeTab === 'fa'`. (Evidence: `src/features/architect/GMDashboard/GMDashboard.jsx:318-335`)
4. Free Agency section tree:
   - Root: `FreeAgencySection`
   - Children:
     - incoming `OfferSheetList`
     - outgoing `OfferSheetList`
     - `FreeAgentPool`
   - World gating text and disabled reasons included when no world. (Evidence: `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:32-75`)
5. Free Agent Pool internals:
   - `FreeAgencyFilterBar`, `FreeAgentPoolHeader`, `SelectedFreeAgentCards`, `FreeAgentRow[]`, and local shared `EditContractModal`. (Evidence: `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:129-191`)

## Workflow Inventory

| Workflow                       | Entry control                                    | Handler path                                                                                                                 | Validator path                                                                                                                 | Persistence path                                                       | Cap totals refresh                                                                   |
| ------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Search/filter/sort/clear       | `FreeAgencyFilterBar` controls                   | `updateFilterState` / `clearFilters`                                                                                         | none                                                                                                                           | localStorage persistence only                                          | none                                                                                 |
| Select/unselect candidates     | Click `FreeAgentRow`                             | `handleSelect`                                                                                                               | none                                                                                                                           | none                                                                   | none                                                                                 |
| Remove selected candidate      | Selected card remove                             | `handleRemove`                                                                                                               | none                                                                                                                           | none                                                                   | none                                                                                 |
| Open signing modal             | Row/menu/card sign controls                      | `setContractPlayer(...)`                                                                                                     | none                                                                                                                           | none                                                                   | none                                                                                 |
| Sign Free Agent                | Modal confirm (`signNew` action override)        | `EditContractModal` -> `onSave(handleSaveFromModal)` -> `onSign(actions.handleSign)` -> `signFreeAgent`                      | Base: `validateSigning` + local `validatePostStateCapLegality`; World: pipeline `validateSigning` + world post-state validator | Base: local compute-only; World: `applyWorldMutation` pipeline persist | signing compute recalculates totals; `setTeamCapSheet` sync feeds cap SSOT           |
| Store Offer Sheet (world-only) | Modal confirm (`signNew` + `Offer Sheet` toggle) | `EditContractModal(onStoreOfferSheet)` -> `actions.handleStoreOfferSheet` -> `runAuthoritativeFAMutation('storeOfferSheet')` | `validateSigning` + world post-state validator                                                                                 | world-only authoritative mutation (`applyWorldMutation`)               | changed-team sync updates `teamCapSheet.offerSheets`; outgoing list reflects new row |
| Sign-and-trade                 | Modal confirm (`signAndTrade`)                   | `actions.handleSignAndTrade` -> `signAndTrade`                                                                               | prevalidated signing+trade context + world post-state validator                                                                | world-only authoritative mutation; blocked in base mode                | team sync after mutation; cap surfaces recompute                                     |
| Match offer sheet              | Incoming list `Match`                            | `actions.handleMatchOfferSheet` -> `matchOfferSheet`                                                                         | `validateOfferSheetResolution('match')` + world post-state validator                                                           | world-only authoritative mutation; blocked/disabled in base            | status update only (no totals recompute)                                             |
| Decline offer sheet            | Incoming list `Decline`                          | `actions.handleDeclineOfferSheet` -> `declineOfferSheet`                                                                     | `validateOfferSheetResolution('decline')` + world post-state validator                                                         | world-only authoritative mutation; blocked/disabled in base            | status update only (no totals recompute)                                             |
| Finalize matched               | Incoming list `Finalize Match`                   | `actions.handleFinalizeOfferSheet` -> `finalizeMatchedOfferSheet`                                                            | `validateOfferSheetResolution('finalize')` + world post-state validator                                                        | world-only authoritative mutation                                      | home-team totals recomputed during compute                                           |
| Finalize declined              | Outgoing list `Finalize Signing`                 | `actions.handleFinalizeOfferSheet` -> `finalizeDeclinedOfferSheet`                                                           | `validateOfferSheetResolution('finalize')` + world post-state validator                                                        | world-only authoritative mutation                                      | offering + home totals recomputed during compute                                     |
| View profile                   | Row menu `View Profile`                          | direct location change                                                                                                       | none                                                                                                                           | none                                                                   | none                                                                                 |

Workflow evidence:  
`src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx:44-123`  
`src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts:116-143`  
`src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:51-116`  
`src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:176-190`  
`src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx:186-221`  
`src/features/architect/GMDashboard/components/OfferSheetList.jsx:70-123`  
`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1360-1893`  
`src/shared/components/EditContractModal.jsx:657-674`  
`src/shared/components/EditContractModal.jsx:749-767`  
`src/shared/components/EditContractModal.jsx:813-823`

## Offer Sheet Initiation (E1)

- Free Agency tab now exposes offer-sheet initiation directly inside the FA signing modal in world mode.
- UI entry path:
  - Free Agent row/menu `Sign Free Agent` -> `FreeAgentPool` modal instance.
  - Modal actions include `signNew` (label override: `Sign Free Agent`) in both modes.
  - World mode passes `onStoreOfferSheet`, which unlocks the `Offer Sheet` toggle under `signNew`.
- Mutation path:
  - `EditContractModal` submit with `Offer Sheet` checked -> `onStoreOfferSheet(...)`.
  - `handleStoreOfferSheet` -> `runAuthoritativeFAMutation('storeOfferSheet', ...)` -> `applyWorldMutation(...)`.
- User-visible success:
  - Save toast appears.
  - Outgoing offer sheet appears via `changedTeams` sync into `teamCapSheet.offerSheets`, consumed by FA outgoing list.
- Base mode gating:
  - `onStoreOfferSheet` is not wired in base mode and offer-sheet toggle is not rendered.

Execution evidence:
`src/features/architect/GMDashboard/GMDashboard.jsx`  
`src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`  
`src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`  
`src/shared/components/EditContractModal.jsx`  
`src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

## Authoritative vs Preview (E1)

- Free Agency world actions are authoritative-only by design:
  - `runAuthoritativeFAMutation(...) -> applyWorldMutation(...)` with world validation/persistence contract.
- Rationale:
  - FA workflows include multi-team side effects (`signAndTrade`, offer-sheet resolution/finalization) and lifecycle status transitions that require canonical changed-team reconciliation before UI settles.
  - This is intentionally different from single-team cap-sheet optimistic preview flows that route through `applyCapAuditedTeamMutation(...)`.
- Error UX contract:
  - Action callbacks return `{ success, message }`.
  - `EditContractModal` closes only on `success:true`; on failure it stays open and renders inline error.
  - Action layer also emits explicit toasts for world-required or mutation failures.

Execution evidence:
`src/features/architect/GMDashboard/hooks/useArchitectActions.ts`  
`src/shared/components/EditContractModal.jsx`  
`src/features/architect/utils/mutationPipeline.js`

## Validator + Audit Wiring Notes

- Authoritative world mutation pipeline is `READ -> COMPUTE -> VALIDATE -> PERSIST -> POST-UPDATE`. (Evidence: `src/features/architect/utils/mutationPipeline.js:626-728`)
- World post-state cap validator (`validatePostStateCapLegality`) runs before persistence. (Evidence: `src/features/architect/utils/mutationPipeline.js:810-858`)
- Firestore writes are confined to pipeline persist phase. (Evidence: `src/features/architect/utils/mutationPipeline.js:867-868`)
- Cap-audit envelope persisted in world events includes validator version, before/after totals, violations/warnings, and diff summary. (Evidence: `src/features/architect/utils/mutationPipeline.js:2933-2966`)
- Local pre-apply audited helper (`applyCapAuditedTeamMutation`) exists, but FA world actions currently use direct authoritative runner path. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:861-947`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1402-1410`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1629-1642`)

## Cap Totals SSOT Refresh Contract

- Cap-impacting FA computes call `computeTeamCapTotals(...)` in mutation compute stage (sign/finalize paths). (Evidence: `src/features/architect/utils/mutationPipeline.js:1916-1917`, `src/features/architect/utils/mutationPipeline.js:3408-3412`, `src/features/architect/utils/mutationPipeline.js:3544-3585`)
- Team state reconciliation for world mutations uses changed-team payload (or fallback reload) and refreshes world roster index. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:768-788`)
- Cap surfaces consume SSOT totals with `useMemo(() => computeTeamCapTotals(teamCapSheet, selectedYear), ...)`. (Evidence: `src/features/architect/capSheet/CapSheet/CapSheet.jsx:54-58`)
- `computeTeamCapTotals` is documented as the canonical totals source. (Evidence: `src/features/architect/utils/capTotals/computeTeamCapTotals.js:190-204`)

## E2 Closure Permanence Gates (2026-03-01)

### Purpose

- Add deterministic, source-scanning CI gates that fail fast if E1 Free Agency closures regress.
- Enforce world-mode offer-sheet reachability, base-mode gating, authoritative mutation/sync wiring, and E1 cleanup invariants.

### Gate File

- `src/tests/architect/freeAgency_closure.gate.test.ts`

### Gate Categories

- **Gate 1:** World-mode offer-sheet initiation wiring exists in `FreeAgentPool` modal path.
- **Gate 2:** Base mode cannot access offer-sheet initiation wiring in `FreeAgentPool`.
- **Gate 3:** `handleStoreOfferSheet` calls authoritative `'storeOfferSheet'` mutation and preserves `{ success, message }` callback contract.
- **Gate 4:** Authoritative success path syncs current team from `changedTeams` via `syncTeamFromMutationResult`.
- **Gate 5:** `FreeAgencySection` does not pass stale `capProjections` into `FreeAgentPool`.
- **Gate 6:** `ActiveTab` union includes runtime `'fa'`, `'cap'`, and `'capfull'`.

### Run Command

```bash
npm run test:node -- --run src/tests/architect/freeAgency_closure.gate.test.ts --reporter=dot
```

### Policy

- Ticket scope is **tests + docs only**.
- No runtime production behavior changes are permitted.

## Offer Sheet Lifecycle — Call Graph + Invariants (P1)

**Added:** 2026-03-01 (TM_OFFER_SHEETS_P1 preflight)

### Status State Machine

```
PENDING_MATCH ──┬── Match (home team) ──► MATCHED ──► Finalize Match (home) ──► [removed]
                │
                └── Decline (home team) ──► DECLINED ──► Finalize Signing (offering) ──► [removed]
```

- **PENDING_MATCH**: Initial status after offer sheet stored. Only home team can transition via Match or Decline.
- **MATCHED**: Home team matched the offer. Only home team can finalize (applies contract, keeps player).
- **DECLINED**: Home team declined the offer. Only offering team can finalize (signs player, moves to offering roster).

### Mutation Types

| Mutation                     | Actor         | Status Requirement | Outcome                                          |
| ---------------------------- | ------------- | ------------------ | ------------------------------------------------ |
| `storeOfferSheet`            | Offering team | N/A (creates new)  | Creates offer sheet with `PENDING_MATCH`         |
| `matchOfferSheet`            | Home team     | `PENDING_MATCH`    | Updates to `MATCHED`                             |
| `declineOfferSheet`          | Home team     | `PENDING_MATCH`    | Updates to `DECLINED`                            |
| `finalizeMatchedOfferSheet`  | Home team     | `MATCHED`          | Applies contract, removes offer sheet            |
| `finalizeDeclinedOfferSheet` | Offering team | `DECLINED`         | Signs player to offering team, removes from home |

### Two-Team Sync Expectations

All offer sheet mutations update **both teams**:

1. **storeOfferSheet**: Adds to offering team's `offerSheets[]` AND mirrors to home team's `incomingOfferSheets[]`
2. **matchOfferSheet/declineOfferSheet**: Updates status on both teams' arrays
3. **finalizeMatchedOfferSheet**: Removes from both arrays, applies contract on home team
4. **finalizeDeclinedOfferSheet**: Removes from both arrays, moves player from home → offering

**UI Sync**: Current team is immediately synced via `syncTeamFromMutationResult`. Other team is persisted to Firestore and will reflect on team switch or refresh.

### Totals Recompute Expectations

| Stage             | Home Team Totals | Offering Team Totals |
| ----------------- | ---------------- | -------------------- |
| Store             | ❌               | ❌                   |
| Match/Decline     | ❌               | ❌                   |
| Finalize Match    | ✅               | ❌                   |
| Finalize Declined | ✅               | ✅                   |

Totals are computed via `computeTeamCapTotals()` in the mutation compute phase. UI surfaces always derive from SSOT current team state.

### Validation Invariants

`validateOfferSheetResolution()` enforces:

- Only home team can Match/Decline
- Home team cannot finalize a DECLINED sheet
- Offering team cannot finalize a MATCHED sheet
- 48-hour match window warning (soft, not blocking)

### Evidence Files

- Compute functions: `src/features/architect/utils/mutationPipeline.js` (L3015-3600)
- Validation: `src/features/architect/utils/capLegalityValidation.js` (L3819-3899)
- Handlers: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (L1658-1893)
- UI lists: `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
- Tests: `tests/architect/offerSheetResolution.test.js`, `tests/architect/offerSheetPersistence.test.js`

## Offer Sheets — E1 Closure Permanence Gates (2026-03-01)

### Purpose

Add deterministic, source-scanning CI gates that fail fast if the Offer Sheet lifecycle regresses.
Enforce mutation routing, two-team state loading, validation invocation, mirror updates, finalize totals recompute, persistence, UI wiring, and team sync.

### Gate File

- `src/tests/architect/offerSheets_closure.gate.test.ts`

### Gate Categories

| Gate                                                     | Tests | What It Protects                                                                                                              |
| -------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Gate 1:** Mutation types present + routed              | 8     | All 5 offer sheet mutation types exist and route through `applyWorldMutation`, `loadStateForMutation`, `computeWorldMutation` |
| **Gate 2:** Two-team state loading                       | 4     | `loadStateForMutation` loads both `homeTeam` and `offeringTeam` for match/decline/finalize                                    |
| **Gate 3:** Validation uses validateOfferSheetResolution | 5     | Validation layer invokes `validateOfferSheetResolution` for match, decline, finalize actions                                  |
| **Gate 4:** Store mirrors to both teams                  | 4     | `computeStoreOfferSheetResult` updates offering team `offerSheets` and mirrors to home team `incomingOfferSheets`             |
| **Gate 5:** Match/Decline enforce status + mirror        | 5     | Both compute functions check `PENDING_MATCH`, set correct status, and mirror update to home team                              |
| **Gate 6:** Finalize matched recomputes home totals      | 5     | Removes offer sheet, applies contract, calls `computeTeamCapTotals` for home team                                             |
| **Gate 7:** Finalize declined recomputes BOTH totals     | 5     | Adds player to offering, removes from home, calls `computeTeamCapTotals` for both teams                                       |
| **Gate 8:** Persistence writes teamUpdates               | 3     | `persistWorldMutation` iterates `teamUpdates` and writes to Firestore                                                         |
| **Gate 9:** UI wiring + world gating                     | 5     | `OfferSheetList` calls handlers, `FreeAgencySection` passes `actionsDisabled={!worldId}`                                      |
| **Gate 10:** Current team sync reads changedTeams        | 4     | `syncTeamFromMutationResult` reads `changedTeams`, finds current team, calls `setTeamCapSheet`                                |

**Total: 48 tests**

### Run Command

```bash
npm run test:node -- --run src/tests/architect/offerSheets_closure.gate.test.ts --reporter=dot
```

### Policy

- Ticket scope is **tests + docs only**.
- No runtime production behavior changes are permitted.

## Ranked Gaps (P0/P1/P2)

### P0

- None found in scoped Free Agency tab wiring.

### P1

1. No active P1 gaps in scoped Free Agency tab after E1 implementation.

### P2

1. No active P2 drift gaps in scoped FA wiring after E1 optional cleanups.

## Minimal Smoke Checklist (<10 minutes)

### Base mode

1. Open Free Agency tab with no world selected and verify world-required warning appears.
2. Confirm offer-sheet action buttons are disabled.
3. Open signing modal and confirm sign-and-trade action is not available.
4. Perform a known-invalid signing attempt (intentionally illegal terms) and verify modal remains open with error feedback.

### World mode

1. Open Free Agency tab with active world.
2. Complete one legal signing and verify save succeeds and player leaves free-agent pool.
3. If offer sheets are present, run Match or Decline, then Finalize path appropriate to row status.
4. Perform one invalid finalize context (stale/mismatch status) and verify error toast path is sane.

## Commands (Preflight audit run)

- Ran: `git status --short`, targeted `rg -n ...` discovery, and multiple `nl -ba ... | sed -n ...p` evidence extractions.
- Skipped intentionally: `npm run dev`, `npm run build`, `npm run test:*`, `npm run validate:project` (docs-only discovery phase).
