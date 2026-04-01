# ARCHITECT FREE AGENCY — REVIEW TRACKER

Progress and execution status for the Free Agency review series.

---

## STEP 1 — Free Agency Action Ownership and Source of Truth

| ID    | Title                                                                                                 | Status | Notes                                                                                                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FA-1A | Clarify the Primary Free Agency Action Owner Across UI Wiring, Modal Dispatch, and Mutation Execution | DONE   | Grouped `freeAgencyActionOwner` now flows from `useArchitectActions.ts` through dashboard wiring into pool/modal dispatch surfaces, with focused ownership guardrails added.                                                                  |
| FA-1B | Tighten the Ownership Boundary Between UI Payload Construction and Authoritative Signing Truth        | DONE   | FreeAgentPool now stages and dispatches only, EditContractModal uses staging/dispatch naming, and `useArchitectActions.ts` owns authoritative signing preparation across sign, sign-and-trade, and offer-sheet flows with focused guardrails. |
| FA-1C | Clarify and Fence the Dual-Path Ownership Model for World Mode vs Vacuum Mode                         | DONE   | `freeAgencyActionOwner` now exposes explicit `dualPathSigning` vs `worldOnly` ownership, dashboard/pool wiring consumes `actionOwner.worldOnly` instead of raw `worldId`, and focused guardrails pin the split.                               |
| FA-1D | Add Guardrails for Free Agency Ownership Boundaries and Alternate Paths                               | DONE   | Focused guardrails now pin grouped `actionOwner` prop contracts, world-only fail-closed behavior, canonical authoritative mutation routing, and FreeAgentPool modal action availability derived from `actionOwner.worldOnly`.                 |

**STEP 1 STATUS: DONE**

---

## STEP 2 — Free Agent Pool UI Truth and Modal Launch Wiring

| ID    | Title                                                                                              | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FA-2A | Align Row Actions, Selected-Player Actions, and Modal Launch into One Clearly Shared UI Truth Path | DONE   | `FreeAgentPool.tsx` now owns one explicit `openContractModal` launch callback plus one `contractModalTarget` state, both visible entry surfaces feed that same launch path, and focused runtime/static guardrails pin the shared modal-launch contract.                                                                                                                                                                     |
| FA-2B | Tighten the Boundary Between Visible Modal Action Availability and Real Free Agency Action Truth   | DONE   | `useArchitectActions.ts` now publishes `freeAgentModalAvailability` as the grouped-owner source of truth for modal-visible actions, labels, and Offer Sheet toggle visibility; `FreeAgentPool.tsx` passes that owner contract straight into `EditContractModal.tsx`, and focused runtime/static guardrails now pin the owner-to-modal availability projection.                                                              |
| FA-2C | Reduce Identity / Lookup Fallback Drift in the Visible Pool Surface                                | DONE   | `FreeAgentPool.tsx` now builds one `FreeAgentSurfaceEntry` per free agent from runtime `playersMap`, tracks selection and row-menu state by `selectionKey`, and stages modal launch from that same shared entry; rows, selected-player cards, and modal launch now read from one pool-level visible-identity contract, and focused runtime/static guardrails pin duplicate-name selection plus stable id lookup precedence. |
| FA-2D | Add Focused Guardrails for Free Agent Pool UI Truth and Modal Launch Wiring                        | DONE   | Focused runtime and closure guardrails now compare row-menu vs selected-card launch through both mocked and real modal paths, keep duplicate-name row menus keyed by `selectionKey`, and forbid Step 2 legacy seams from reappearing around shared launch, owner-projected availability, and shared-entry identity.                                                                                                         |

**STEP 2 STATUS: DONE**

---

## STEP 3 — Free Agency Standard Signing Flow

| ID    | Title                                                                    | Status | Notes                                                                                                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FA-3A | Centralize and Clarify Standard Signing Payload Finalization             | DONE   | `EditContractModal.tsx` now stages lean standard-sign payloads while `useArchitectActions.ts` owns one dedicated standard-sign preparation seam that finalizes canonical salary rows, action year, totals, mechanism, and mutation payload truth.                                                                                        |
| FA-3B | Align Standard Signing Legality Validation with Final Mutation Truth     | DONE   | `handleSign` now validates and mutates from the same prepared standard-sign package, and focused runtime/closure guardrails now pin that legality/mutation alignment plus the absence of modal-finalized standard-sign truth.                                                                                                            |
| FA-3C | Fence the Standard Signing World-Mode vs Vacuum-Mode Dual Path           | DONE   | `handleSign` now routes through explicit `executeWorldModeStandardSigning(...)` and `executeVacuumModeStandardSigning(...)` hook-local executors that both consume the same prepared standard-sign payload and return one normalized committed-state shape, with focused cross-mode and closure guardrails pinning parity.               |
| FA-3D | Protect Final-State, Persistence, and Reload Truth for Standard Signings | DONE   | Standard signing now applies one shared committed-state applier only after world `changedTeams` or reload resolves the committed team snapshot; world mode fails closed when no snapshot can be resolved, refreshes roster index only after that resolution, and focused reload/fail-closed guardrails now pin persistence/reload truth. |

**STEP 3 STATUS: DONE**

---

## STEP 4 — Free Agency Sign-and-Trade Initiation, Preflight, and Commit Truth

| ID    | Title                                                                                   | Status | Notes |
| ----- | --------------------------------------------------------------------------------------- | ------ | ----- |
| FA-4A | Tighten Sign-and-Trade Initiation Truth Across Pool, Modal, and World-Only Availability | DONE   | `useArchitectActions.ts` now publishes one explicit `signAndTradeInitiation` descriptor inside `freeAgentModalAvailability`, `FreeAgentPool.tsx` launches SAT from that one owner-level descriptor, and `EditContractModal.tsx` stages destination-team routing through that same world-only initiation path. |
| FA-4B | Align Authoritative Preflight with Commit-Time Sign-and-Trade Payload Truth             | DONE   | SAT preflight and SAT commit now share one hook-local `prepareSignAndTradeTransactionDefinition(...)` seam in `useArchitectActions.ts`, while `EditContractModal.tsx` stages one lean SAT payload object that both preflight and confirm reuse before authoritative finalization in the hook. |
| FA-4C | Clarify and Harden Final Commit, Sync, and Reload Truth for Sign-and-Trade              | DONE   | `useArchitectActions.ts` now routes SAT commit through one explicit world-mode executor that resolves committed active-team truth from `changedTeams` first and `loadWorldTeamData(...)` second, fails closed when no committed snapshot can be resolved, and refreshes the world roster index only after committed-state resolution. |
| FA-4D | Add Focused Guardrails for Sign-and-Trade Preflight, Commit, and Final-State Truth      | DONE   | Focused runtime and closure guardrails now pin SAT changedTeams application, reload fallback, fail-closed missing committed snapshot behavior, roster-index refresh ordering, and explicit SAT final-state routing outside generic `runAuthoritativeFAMutation(...)`. |

**STEP 4 STATUS: DONE**

---

## STEP 5 — Free Agency Offer-Sheet Creation Flow

| ID    | Title                                                                                                                         | Status | Notes |
|-------|-------------------------------------------------------------------------------------------------------------------------------|--------|-------|
| FA-5A | Tighten Offer-Sheet Initiation Truth Across Pool, Modal, and World-Only Availability                                         | DONE   | Grouped owner now publishes explicit `offerSheetInitiation`; pool/modal staging derive visible world-only offer-sheet initiation from that one seam. |
| FA-5B | Align Authoritative Offer-Sheet Preflight with Store-Time Payload Truth                                                      | DONE   | `prepareOfferSheetCreationDefinition(...)` now feeds both authoritative preflight and store with one canonical creation-definition path. |
| FA-5C | Clarify and Harden Pending-State, Sync, and Reload Truth for Created Offer Sheets                                            | DONE   | `handleStoreOfferSheet(...)` now routes through an explicit committed offer-sheet executor that verifies pending-state truth from `changedTeams` or authoritative reload before local cap-sheet sync. |
| FA-5D | Add Focused Guardrails for Offer-Sheet Preflight, Store, and Pending-State Truth                                             | DONE   | Focused behavior tests and closure gates now pin committed offer-sheet identity resolution, verified post-store sync, hydration persistence, and protection against regression back to generic store sync. |

**STEP 5 STATUS: DONE**

---

## STEP 6 — Free Agency Incoming and Outgoing Offer-Sheet Lifecycle

| ID    | Title                                                                 | Status | Notes |
|-------|-----------------------------------------------------------------------|--------|-------|
| FA-6A | Tighten Incoming vs Outgoing Offer-Sheet Surface Truth               | DONE   | `OfferSheetList.tsx` now exposes explicit `surfaceRole` + unified lifecycle callback truth, and `FreeAgencySection.tsx` wires incoming/outgoing offer-sheet surfaces through one role-aware lifecycle adapter. |
| FA-6B | Align Match / Decline / Finalize Routing with Team-Role Truth        | DONE   | `useArchitectActions.ts` now routes match/decline through one shared resolution helper and resolves finalize mutation routing through one explicit status/team-role seam, with focused behavior and closure guardrails updated. |
| FA-6C | Clarify and Harden Final Lifecycle-State, Sync, and Reload Truth     | DONE   | `useArchitectActions.ts` now routes match/decline/finalize through one explicit lifecycle committed-state executor that verifies active-team incoming/outgoing offer-sheet truth from `changedTeams` first and `loadWorldTeamData(...)` second before local dashboard sync. |
| FA-6D | Add Focused Guardrails for Offer-Sheet Lifecycle Role and Final-State Truth | DONE | Focused behavior tests and closure gates now pin lifecycle presence/absence verification, reload fallback, fail-closed committed-state mismatches, and protection against regression back to the generic offer-sheet lifecycle sync path. |

**STEP 6 STATUS: DONE**

---

## STEP 7 — Free Agency World-Mode Gating vs Vacuum-Mode Behavior

| ID    | Title                                                                 | Status | Notes |
|-------|-----------------------------------------------------------------------|--------|-------|
| FA-7A | Make the World-Only vs Dual-Path Free Agency Action Map More Explicit | DONE   | `useArchitectActions.ts` now publishes explicit modal world-only vs lifecycle world-only slices before composing the compatibility aggregate owner, making the Free Agency mode-policy seam easier to trace. |
| FA-7B | Align UI Gating Truth with Actual Mutation / Action Truth             | DONE   | `FreeAgencySection.tsx` now consumes hook-published `offerSheetSectionAvailability` instead of coercing `actionOwner.worldOnly`, and focused behavior/closure tests pin that alignment against drift. |
| FA-7C | Harden Dual-Path Standard Signing vs World-Only Action Behavior       | TODO   |       |
| FA-7D | Add Focused Guardrails for World/Vacuum Boundary Truth                | TODO   |       |

**STEP 7 STATUS: IN_PROGRESS**

---
