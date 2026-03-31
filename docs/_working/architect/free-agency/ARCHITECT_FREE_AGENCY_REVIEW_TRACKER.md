# ARCHITECT FREE AGENCY — REVIEW TRACKER

Progress and execution status for the Free Agency review series.

---

## STEP 1 — Free Agency Action Ownership and Source of Truth

| ID    | Title                                                                                         | Status | Notes |
|-------|-----------------------------------------------------------------------------------------------|--------|-------|
| FA-1A | Clarify the Primary Free Agency Action Owner Across UI Wiring, Modal Dispatch, and Mutation Execution | DONE | Grouped `freeAgencyActionOwner` now flows from `useArchitectActions.ts` through dashboard wiring into pool/modal dispatch surfaces, with focused ownership guardrails added. |
| FA-1B | Tighten the Ownership Boundary Between UI Payload Construction and Authoritative Signing Truth | DONE | FreeAgentPool now stages and dispatches only, EditContractModal uses staging/dispatch naming, and `useArchitectActions.ts` owns authoritative signing preparation across sign, sign-and-trade, and offer-sheet flows with focused guardrails. |
| FA-1C | Clarify and Fence the Dual-Path Ownership Model for World Mode vs Vacuum Mode                 | DONE | `freeAgencyActionOwner` now exposes explicit `dualPathSigning` vs `worldOnly` ownership, dashboard/pool wiring consumes `actionOwner.worldOnly` instead of raw `worldId`, and focused guardrails pin the split. |
| FA-1D | Add Guardrails for Free Agency Ownership Boundaries and Alternate Paths                       | DONE | Focused guardrails now pin grouped `actionOwner` prop contracts, world-only fail-closed behavior, canonical authoritative mutation routing, and FreeAgentPool modal action availability derived from `actionOwner.worldOnly`. |

**STEP 1 STATUS: DONE**

---

## STEP 2 — Free Agent Pool UI Truth and Modal Launch Wiring

| ID    | Title                                                                                         | Status | Notes |
|-------|-----------------------------------------------------------------------------------------------|--------|-------|
| FA-2A | Align Row Actions, Selected-Player Actions, and Modal Launch into One Clearly Shared UI Truth Path | DONE | `FreeAgentPool.tsx` now owns one explicit `openContractModal` launch callback plus one `contractModalTarget` state, both visible entry surfaces feed that same launch path, and focused runtime/static guardrails pin the shared modal-launch contract. |
| FA-2B | Tighten the Boundary Between Visible Modal Action Availability and Real Free Agency Action Truth | DONE | `useArchitectActions.ts` now publishes `freeAgentModalAvailability` as the grouped-owner source of truth for modal-visible actions, labels, and Offer Sheet toggle visibility; `FreeAgentPool.tsx` passes that owner contract straight into `EditContractModal.tsx`, and focused runtime/static guardrails now pin the owner-to-modal availability projection. |
| FA-2C | Reduce Identity / Lookup Fallback Drift in the Visible Pool Surface                           | DONE | `FreeAgentPool.tsx` now builds one `FreeAgentSurfaceEntry` per free agent from runtime `playersMap`, tracks selection and row-menu state by `selectionKey`, and stages modal launch from that same shared entry; rows, selected-player cards, and modal launch now read from one pool-level visible-identity contract, and focused runtime/static guardrails pin duplicate-name selection plus stable id lookup precedence. |
| FA-2D | Add Focused Guardrails for Free Agent Pool UI Truth and Modal Launch Wiring                   | DONE | Focused runtime and closure guardrails now compare row-menu vs selected-card launch through both mocked and real modal paths, keep duplicate-name row menus keyed by `selectionKey`, and forbid Step 2 legacy seams from reappearing around shared launch, owner-projected availability, and shared-entry identity. |

**STEP 2 STATUS: DONE**

---

## STEP 3 — Free Agency Standard Signing Flow

| ID    | Title                                                                 | Status | Notes |
|-------|-----------------------------------------------------------------------|--------|-------|
| FA-3A | Centralize and Clarify Standard Signing Payload Finalization          | DONE   | `EditContractModal.tsx` now stages lean standard-sign payloads while `useArchitectActions.ts` owns one dedicated standard-sign preparation seam that finalizes canonical salary rows, action year, totals, mechanism, and mutation payload truth. |
| FA-3B | Align Standard Signing Legality Validation with Final Mutation Truth  | DONE   | `handleSign` now validates and mutates from the same prepared standard-sign package, and focused runtime/closure guardrails now pin that legality/mutation alignment plus the absence of modal-finalized standard-sign truth. |
| FA-3C | Fence the Standard Signing World-Mode vs Vacuum-Mode Dual Path        | TODO   |       |
| FA-3D | Protect Final-State, Persistence, and Reload Truth for Standard Signings | TODO |       |

**STEP 3 STATUS: TODO**

---
