## STEP 1 — Trade Machine Validator Core Truth

| ID    | Title                         | Status | Notes |
| ----- | ----------------------------- | ------ | ----- |
| TM-1A | Preview vs Apply Gap          | DONE   |       |
| TM-1B | Roster Validation Split       | DONE   |       |
| TM-1C | Hard Cap / Apron Distribution | DONE   |       |
| TM-1D | Alternate Execution Path Risk | DONE   |       |

**STEP STATUS: DONE**

---

## STEP 2 — Preview vs Apply Truth Gap (UI Trust Layer)

| ID  | Title                 | Status | Notes            |
| --- | --------------------- | ------ | ---------------- |
| —   | No execution substeps | —      | Review-only step |

**STEP STATUS: DONE (No execution required)**

---

## STEP 3 — Apply Pipeline Authority (True Execution Source of Truth)

| ID    | Title                                            | Status | Notes                                                                                                                                                                                                                                                                                                                        |
| ----- | ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TM-3A | Define Explicit Execution Authority Surface      | DONE   | `validateTradeExecutionAuthority()` in `tradeContext/tradeExecutionAuthority.ts`                                                                                                                                                                                                                                             |
| TM-3B | Centralize Apply Pipeline Legality Chain         | DONE   | `buildTradeApplyPreparation()` now centralizes trade apply preparation; `validateTradeExecutionAuthority()` consumes explicit prepared trade context.                                                                                                                                                                        |
| TM-3C | Clarify Ownership of Each Validation Layer       | DONE   | Stage-1 snapshot verdict adapter now lives in `tradeContext/tradeExecutionAuthority.ts` as `evaluateTradeSnapshotValidationStage()`. Stage 5 is a named authority delegator (`runTradePostStateLegalityStage()`) that derives inputs, then hands rule ownership to `validatePostStateCapLegality()`.                         |
| TM-3D | Align Preview with Execution Authority Model     | DONE   | Preview now reuses the shared preparation + authority-stage model and the UI consumes one primary preview authority surface: `previewAuthority` drives top-level legality/apply gating/preview trust, while `snapshotValidationDetails` remains detail-only for per-team validator panels and export summaries.              |
| TM-3E | Expose and Document Execution Authority Boundary | DONE   | `getTradePreviewAuthority()` is now the canonical preview authority surface, `validateTradeExecutionAuthority()` remains the canonical execution authority surface, world-state-only gates are grouped in `validateTradeWorldStateAuthorityGates()`, and `persistWorldMutation()` remains the explicit persistence boundary. |

**STEP STATUS: DONE**

---

## STEP 4 — Duplicate / Legacy / Alternate Paths Audit

| ID    | Title                                                      | Status | Notes |
| ----- | ---------------------------------------------------------- | ------ | ----- |
| TM-4A | Retire or Fence Deprecated Validation Compatibility Barrel | DONE   | Removed `tradeMachine/validators/index.ts` after confirming there were no non-test live consumers. |
| TM-4B | Separate Canonical vs Legacy Trade Context Exports         | DONE   | `tradeContext/index.ts` is now canonical-only; deprecated compatibility exports live under `tradeContext/legacy`. |
| TM-4C | Prune or Fence Dormant Secondary Helper Modules            | TODO   |       |
| TM-4D | Review Broad Public TradeMachine Barrel for Drift Risk     | TODO   |       |

**STEP STATUS: TODO**

---
