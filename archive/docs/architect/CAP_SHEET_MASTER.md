# CAP_SHEET_MASTER

Last updated: 2026-03-01  
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
- P4 Preflight — Correctness Proof: `return_packages/architect/TM_CAP_SHEET_P4_PREFLIGHT_RETURN_PACKAGE.md`

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

## P4 Preflight — Correctness Matrix (2026-03-01)

### Purpose

P4 proves whether Cap Sheet is truly "FULLY CORRECT + COMPLETE" beyond E1/E2/E3 closures. Inventories every Cap Sheet surface that implies correctness and traces each to the SSOT.

### Surface Inventory (20 surfaces audited)

| # | Surface | Component | SSOT Origin | Test Coverage |
|---|---------|-----------|-------------|---------------|
| 1 | Total Cap Allocations tile | `CapSummaryTiles.jsx:50-54` | `computeTeamCapTotals().totalCapAllocations` | `computeTeamCapTotals.test.js` (24), `leagueViewSsot.test.js` (8) |
| 2 | Cap Space tile | `CapSummaryTiles.jsx:56-65` | `-deltas.vsCap` | `computeTeamCapTotals.test.js`, `salaryMatchingRules.test.js` (16) |
| 3 | Luxury Tax Space tile | `CapSummaryTiles.jsx:67-75` | `-deltas.vsLuxuryTax` | `computeTeamCapTotals.test.js` |
| 4 | 1st Apron Space tile + lock | `CapSummaryTiles.jsx:77-103` | `-deltas.vsFirstApron` + `isHardCappedAtFirstApron()` | `hardCap.test.js` (5), `hardCap_salaryMatching.guardrail.test.js` (14) |
| 5 | 2nd Apron Space tile + lock | `CapSummaryTiles.jsx:105-119` | `-deltas.vsSecondApron` + `isHardCappedAtSecondApron()` | `hardCap.test.js`, `apronSemantics.test.js` (4) |
| 6 | Cap % per player | `CapSheet.jsx:283` | `getCapPercentage(capHit, totals.salaryCap)` | `capSheet_capPct_ssot.behavior.test.jsx`, gate 1 |
| 7 | Player Salaries breakdown | `CapSheet.jsx:406-408` | `totals.playersTotal` | `computeTeamCapTotals.test.js`, `salaryEngine.test.js` (19) |
| 8 | Dead Money breakdown | `CapSheet.jsx:410-416` | `totals.deadMoneyTotal` | `deadMoney.test.js` (7), `deadCapManagement.test.js` (7), `deadMoney_modal_schema_parity.test.js` (11) |
| 9 | Cap Holds breakdown | `CapSheet.jsx:418-424` | `totals.capHoldsTotal` | `capHolds.test.ts` |
| 10 | Incomplete Roster Charge | `CapSheet.jsx:426-447` | `totals.incompleteChargesTotal` | `incompleteRosterCharge.test.js` (9) |
| 11 | Total Cap Hit footer | `CapSheet.jsx:451-458` | `totals.totalCapAllocations` | same as #1 |
| 12 | Exception Tracker cards | `ExceptionTracker.jsx` | `team.exceptions` (canonical) + legacy fallback | `exceptionManagement.test.js` (18), gate 3 |
| 13 | Exception History | `ExceptionHistoryTracker.jsx` | `team.exceptionHistory[]` | `tradeExceptions.test.js` (7) |
| 14 | Dead Money Modal | `ManageDeadMoneyModal.jsx` | Manual → canonical `deadCap[]` | `deadMoney_modal_schema_parity.test.js` (11), gate 5 |
| 15 | Exceptions Modal | `ManageExceptionsModal.jsx` | Manual → canonical `exceptions` | `exceptionManagement.test.js`, gate 2 |
| 16 | Hard Cap Lock indicator | `CapSummaryTiles.jsx:87-102` | `isHardCappedAtFirstApron()` + reason | `hardCap.test.js`, `hardCap_trigger_faException.test.js` |
| 17 | Cap Room color coding | `CapSummaryTiles.jsx` | `deltas` sign (negative=green, positive=red) | `computeTeamCapTotals.test.js` |
| 18 | CapSheetFull multi-year | `CapSheetFull.jsx` | `getContractYearSlice()` per year | `capSheetFull_ssot_parity_guardrails.test.js` |
| 19 | Year selector | `CapSheet.jsx:235-249` | `selectedYear` → `useMemo` recompute | `computeTeamCapTotals.test.js` (multi-year) |
| 20 | Confidence label | `CapSheet.jsx:183-215` | `totals._meta.rulesSourcesSummary` | implicit via `capRulesProfile` tests |

### Totals Correctness Chain

All 20 surfaces trace back to `computeTeamCapTotals()` (pure SSOT function, no cache). UI recomputes via `React.useMemo([teamCapSheet, selectedYear])`. Mutation pipeline always calls `buildTotalsByTeam()` fresh. No persisted/cached totals are ever shown as authoritative.

### STOP CONDITIONS — All Clear ✅

1. ❌ No deprecated/non-SSOT sources found
2. ❌ No mutation path without totals refresh
3. ❌ No hard-cap scenario bypasses `effectiveAllowableIncoming = min(allowableIncoming, hardCapIncomingCeiling)`
4. ❌ No base/world divergence — same function for both

---

## Scenario Battery (2026-03-01)

12 concrete scenarios validating cap sheet correctness.

| # | Scenario | Expected Outcome | Code Enforcement | Test Exists |
|---|----------|------------------|------------------|-------------|
| 1 | Under-cap team cap space | Cap Space = salaryCap - totalAllocations (green) | `deltas.vsCap` in `computeTeamCapTotals` | ✅ `computeTeamCapTotals.test.js` |
| 2 | Hard-cap + salary matching ceiling | `effectiveAllowableIncoming = min(salaryMatch, hardCapCeiling)` | `validateSalaryMatching.js:415-442` | ✅ `hardCap_salaryMatching.guardrail.test.js` (14) |
| 3 | Waive (no stretch) | Dead money = remaining guaranteed; player removed | `mutationPipeline.computeWaiveResult()` | ✅ `tradeManager.test.js` |
| 4 | Waive + stretch | Dead cap distributed over `2*remainingYears+1` years | `mutationPipeline` stretch logic | ✅ `tradeManager.test.js`, `deadCapManagement.test.js` |
| 5 | Buyout | Dead cap = guaranteed - buyoutAmount | `mutationPipeline` buyout logic | ✅ `capLegalityValidation.test.js` |
| 6 | Player option decline | Cap hold = Bird% × salary; player off roster | `capHolds.ts:calculateCapHold()` | ✅ `capHolds.test.ts` |
| 7 | Team option decline | Cap hold = EarlyBird% × salary | `capHolds.ts:calculateCapHold()` | ✅ `capHolds.test.ts` |
| 8 | TPE creation (trade) | TPE = salary differential; `exceptionHistory` entry | `historyHelpers.js` | ✅ `tradeExceptions.test.js` |
| 9 | TPE consumption | Remaining decremented; `TPE_CONSUMED` logged | `historyHelpers.js` | ✅ `tradeExceptions.test.js` |
| 10 | TPE expiry (season advance) | `TPE_EXPIRED` entry; removed from active | `historyHelpers.js` | ✅ `tradeExceptions.test.js` |
| 11 | Incomplete roster (11 std + 2 two-way) | Charge = 3 × rookieMin; two-way excluded | `countStandardRoster()` in `computeTeamCapTotals` | ✅ `incompleteRosterCharge.test.js` (9) |
| 12 | Room exception eligibility | Under-cap → eligible; over-cap → blocked | `canUseRoomException()` | ✅ `exceptionManagement.test.js` |

---

## Ranked Gaps (2026-03-01)

| Priority | Gap | Status | Action |
|----------|-----|--------|--------|
| — | *(none at P0 or P1)* | — | — |
| P2 | CapSheetFull future totals rows must use SSOT if added | Advisory | Guardrail test exists (`capSheetFull_ssot_parity_guardrails.test.js`); no code change needed |

---

## Known Gaps (Snapshot)

**All P0/P1/P2 gaps resolved in E1+E2. E3 closure permanence gates added. P4 correctness proof complete — all surfaces verified.**

### Remaining Candidate Work (Lower Priority)

None — all identified gaps have been addressed. One P2 advisory gap (CapSheetFull future totals rows) is covered by an existing guardrail test.

---

## References

- Route/tab wiring: `src/App.jsx`, `src/pages/GmDashboardView.jsx`, `src/features/architect/GMDashboard/GMDashboard.jsx`
- Page section/component files: `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`, `src/features/architect/capSheet/`
- Mutation and persistence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`, `src/features/architect/utils/mutationPipeline.js`
- Validators: `src/features/architect/utils/capLegality/postStateCapValidator.ts`, `src/features/architect/utils/capLegalityValidation.js`
- Totals SSOT: `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
