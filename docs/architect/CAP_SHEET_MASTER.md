# CAP_SHEET_MASTER

Last updated: 2026-02-28  
Status: Active SSOT for Cap Sheet page completeness

---

## Current Scope Definition (Cap Sheet Page)

This master doc covers the **Cap Sheet page surface only** in Architect GM Dashboard:

- Route/tab path: `/gm/:teamId` -> `GMDashboard` -> `activeTab === 'cap'`
- Rendered page components in scope:
- `CapSheetSection`
- `CapSheet` (including `CapSummaryTiles`, `ManageDeadMoneyModal`, `ManageExceptionsModal`)
- `ExceptionTracker`
- In-scope workflows: controls and state transitions initiated from this page (including persistence boundaries reached by those controls)
- Out of scope: Trade Machine screen, offseason-only screens, non-cap tabs unless directly invoked by Cap Sheet controls

---

## Artifact Index

- P1 Preflight Audit: `return_packages/architect/TM_CAP_SHEET_P1_PREFLIGHT_RETURN_PACKAGE.md`
- E1 Execution Closure: `return_packages/architect/TM_CAP_SHEET_E1_EXECUTION_RETURN_PACKAGE.md`
- E2 Polish Closure: `return_packages/architect/TM_CAP_SHEET_E2_EXECUTION_RETURN_PACKAGE.md`
- E3 Closure Permanence Gates: `return_packages/architect/TM_CAP_SHEET_E3_EXECUTION_RETURN_PACKAGE.md`

---

## E2 Execution Status (2026-02-28)

### Resolved in E2

1. **P1-A RESOLVED** — Player cap % denominator now uses `totals.salaryCap` (SSOT from `computeTeamCapTotals`) instead of deprecated `capProjections[yearKey]?.cap`.
2. **P2-B RESOLVED** — World mutation failure toasts deduplicated: `persistMutation` skips toast when `onFailure` callback is provided, preventing double-toast from callback calling `reportMutationError`.

### Ship-Critical Page Gates Satisfied by E2

- Cap % display uses the same salary cap source as totals calculation (no denominator drift)
- Cap Sheet save failures emit exactly one user-facing toast (modal inline error remains primary feedback)

### Tests Added in E2

- `src/tests/architect/capSheet_capPct_ssot.behavior.test.jsx` — Guardrail tests verifying `totals.salaryCap` usage
- `src/tests/architect/capSheet_toast_dedupe.behavior.test.ts` — Behavior tests verifying single toast emission on failure

---

## E3 — Closure Permanence Gates (2026-02-28)

### Purpose

E3 adds **permanent regression gates** (fast source-scanning tests) that fail CI if any E1/E2 Cap Sheet page closures regress. These gates are deterministic and do not require UI rendering.

### Gate File

`src/tests/architect/capSheet_closure.gate.test.ts`

### Gates Implemented

| Gate   | What It Protects                                                                    | Pattern Scanned                                                                                             |
| ------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Gate 1 | Cap % denominator uses SSOT `totals.salaryCap`, not deprecated `capProjections`     | `CapSheet.jsx`: `getCapPercentage(..., totals.salaryCap)` presence, `capProjections` import absence         |
| Gate 2 | DPE not exposed in Cap Sheet Exceptions UI                                          | `ManageExceptionsModal.jsx`: `EXCEPTION_TYPES` excludes `dpe`; `ExceptionTracker.jsx`: no DPE card/label    |
| Gate 3 | ExceptionTracker reads canonical `team.exceptions` first with legacy fallback       | `ExceptionTracker.jsx`: `canonicalEntry = teamCapSheet?.exceptions?.[canonicalKey]`, `legacyEntry` fallback |
| Gate 4 | TPE expiry display uses canonical normalized fields (`expiresOn`, `expirationDate`) | `ExceptionTracker.jsx`: `tpe.expiresOn \|\| tpe.expirationDate \|\| tpe.expires` fallback chain             |
| Gate 5 | Modal save does not close-before-confirm (awaits save, keeps open on failure)       | Both modals: `await onSave(...)`, conditional `onClose()`, `role="alert"` error surface                     |
| Gate 6 | World failure toast dedupe (single toast when `onFailure` callback provided)        | `useArchitectActions.ts`: `if (!options.onFailure) toast.error(...)` guard                                  |

### Run Command

```bash
npm run test:node -- --run src/tests/architect/capSheet_closure.gate.test.ts --reporter=dot
```

### Return Package

`return_packages/architect/TM_CAP_SHEET_E3_EXECUTION_RETURN_PACKAGE.md`

---

## E1 Execution Status (2026-02-28)

### Resolved in E1

1. **P0-1 RESOLVED** — Exception Tracker now reads canonical `team.exceptions` first, with legacy fallback read support for `team.mle`, `team.tpMle`, `team.bae`, and `team.room`.
2. **P0-2 RESOLVED** — DPE removed from Cap Sheet Exceptions modal payload surface; Cap Sheet exception edits now align with validator-accepted keys (`mle`, `tpmle`, `bae`, `room`).
3. **P1-1 RESOLVED** — Trade exception expiry display now falls back `expiresOn -> expirationDate -> expires -> —`.
4. **P1-2 RESOLVED** — `Manage Exceptions` and `Manage Dead Money` modals now await save completion; failed world persistence keeps modal open and shows inline error.

### Ship-Critical Page Gates Satisfied by E1

- Cap Sheet exception save reflects on page immediately in current session
- Cap Sheet exception payload cannot fail solely due to unsupported `dpe` key
- Trade exception expiry cell no longer blanks when canonical expiry is present
- Cap Sheet modal save UX is fail-closed (no close-then-fail behavior)

---

## Known Gaps (Snapshot)

**All P1/P2 gaps resolved in E1+E2. E3 closure permanence gates added.**

### Remaining Candidate Work (Lower Priority)

None — all identified gaps have been addressed.

---

## References

- Route/tab wiring: `src/App.jsx`, `src/pages/GmDashboardView.jsx`, `src/features/architect/GMDashboard/GMDashboard.jsx`
- Page section/component files: `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`, `src/features/architect/capSheet/`
- Mutation and persistence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`, `src/features/architect/utils/mutationPipeline.js`
- Validators: `src/features/architect/utils/capLegality/postStateCapValidator.ts`, `src/features/architect/utils/capLegalityValidation.js`
- Totals SSOT: `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
