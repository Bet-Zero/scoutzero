# ARCHITECT CAP SHEET — REVIEW TRACKER

Progress and execution status for the Cap Sheet review series.

---

## STEP 1 — Cap Totals Source of Truth

| ID    | Title                                                                                | Status | Notes                                                                                |
| ----- | ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------ |
| CS-1A | Align Two-Way Cap Treatment Between Row Display and Canonical Totals                 | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_1A_EXECUTION_RETURN_PACKAGE.md) |
| CS-1B | Clarify Canonical Ownership of Included vs Excluded Cap Categories                   | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_1B_EXECUTION_RETURN_PACKAGE.md) |
| CS-1C | Reduce Internal Legacy Compatibility Drift Risk Inside the Canonical Totals Engine   | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_1C_EXECUTION_RETURN_PACKAGE.md) |
| CS-1D | Identify and Fence Parallel Cap-Math Surfaces That Could Drift from Cap Sheet Totals | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_1D_EXECUTION_RETURN_PACKAGE.md) |

**STEP STATUS: DONE**

---

## STEP 2 — Cap Sheet Display Truth

| ID    | Title                                                                                               | Status | Notes                                                                                |
| ----- | --------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| CS-2A | Align Row-Level Cap Hit Display with Canonical Player Salary Math                                   | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_2A_EXECUTION_RETURN_PACKAGE.md) |
| CS-2B | Clarify Which Current-Year Display Elements Are Canonical Totals Consumers vs Adjacent Detail Views | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_2B_EXECUTION_RETURN_PACKAGE.md) |
| CS-2C | Reduce Partial-Truth Risk in the Current-Year Cap Sheet Layout                                      | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_2C_EXECUTION_RETURN_PACKAGE.md) |
| CS-2D | Guard the Current-Year Display Against Future Local Recalculation Drift                             | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_2D_EXECUTION_RETURN_PACKAGE.md) |

**STEP STATUS: DONE**

---

## STEP 3 — Full Cap Table / Multi-Year Truth

| ID    | Title                                                                                                 | Status | Notes                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| CS-3A | Align Multi-Year Player Row Values with Canonical Future-Year Cap-Hit Rules                           | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_3A_EXECUTION_RETURN_PACKAGE.md) |
| CS-3B | Fix Future-Only Player Visibility Risk in the Multi-Year Table                                        | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_3B_EXECUTION_RETURN_PACKAGE.md) |
| CS-3C | Clarify the Relationship Between Multi-Year Player Rows, Cap Holds Table, and Canonical Yearly Totals | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_3C_EXECUTION_RETURN_PACKAGE.md) |
| CS-3D | Add Guardrails for Multi-Year Row-to-Total Parity and Future-Year Population Truth                    | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_3D_EXECUTION_RETURN_PACKAGE.md) |

**STEP STATUS: DONE**

---

## STEP 4 — Exceptions / TPE / Hard-Cap Display and Accounting

| ID    | Title                                                                       | Status | Notes                                                                                |
| ----- | --------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| CS-4A | Unify Exception Default-Amount Ownership Across Tracker and Modal Surfaces  | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_4A_EXECUTION_RETURN_PACKAGE.md) |
| CS-4B | Align Room Exception Display Eligibility with Canonical Under-Cap Logic     | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_4B_EXECUTION_RETURN_PACKAGE.md) |
| CS-4C | Route Hard-Cap Display Through the Canonical Hard-Cap Resolver              | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_4C_EXECUTION_RETURN_PACKAGE.md) |
| CS-4D | Reduce Legacy / Compatibility Drift in TPE and Exception Presentation Reads | DONE   | [Return package](return_packages/ARCHITECT_CAP_SHEET_4D_EXECUTION_RETURN_PACKAGE.md) |

**STEP STATUS: DONE**

---

## STEP 5 — Cap Sheet Mutation Paths, Save/Persist, and Final Validation

| ID    | Title                                                                                                    | Status | Notes |
| ----- | -------------------------------------------------------------------------------------------------------- | ------ | ----- |
| CS-5A | Lock Dead Money and Exception Edits to One Audited Mutation Path                                         | DONE | Structural hardening and guardrails remain live in code, and the current requested validation still only reports unrelated red suites outside the CS-5A / CS-5C change set. |
| CS-5B | Tighten Alignment Between Local Preview Apply, Audit Generation, Final Validation, and World Persistence | DONE   | `applyCapAuditedTeamMutation(...)` now consumes one prepared lifecycle contract for preview snapshots, cap-audit evaluation, local apply, persistence linkage, and rollback; focused guardrails pin invalid preview blocking, authoritative event linkage, and persist-failure rollback. Requested validation still reports unrelated red suites outside the CS-5B touch set. |
| CS-5C | Fence Weaker Local-Only Cap Sheet Mutation Paths Away from Authoritative Edit Flows                      | DONE   | `useArchitectActions.ts` no longer exposes raw local-only contract-editor / roster / reset mutators on the primary action surface; DEV-only fixture paths now live behind explicit nested dev-tool namespaces, `EditContractModal` no longer falls back through a local-only save callback, and focused guardrails pin the tightened boundary. Requested validation still reports unrelated red suites outside the CS-5C touch set. |
| CS-5D | Add Focused Guardrails for UI-to-Validation-to-Persistence Mutation Truth                                | IN_PROGRESS   | Focused CS-5D guardrails now pin the authoritative Cap Sheet stage order, preview-operationId persistence handoff, preview-event linkage, and in-place rollback semantics across the manual dead-money / exceptions path. Requested validation is still blocked by unrelated red suites in `src/tests/architect/signAndTrade.test.js` and `tests/architect/renounceRights.test.js`, so final closeout remains open. |

**STEP STATUS: IN_PROGRESS**

---
