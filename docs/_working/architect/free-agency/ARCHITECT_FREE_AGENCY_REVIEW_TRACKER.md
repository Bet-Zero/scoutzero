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
| FA-2B | Tighten the Boundary Between Visible Modal Action Availability and Real Free Agency Action Truth | TODO |       |
| FA-2C | Reduce Identity / Lookup Fallback Drift in the Visible Pool Surface                           | TODO |       |
| FA-2D | Add Focused Guardrails for Free Agent Pool UI Truth and Modal Launch Wiring                   | TODO |       |

**STEP 2 STATUS: TODO**

---
