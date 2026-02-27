# TRADE_E2E_TRADE_MACHINE_5PACK_CLOSEOUT_P1_RETURN_PACKAGE

Date: 2026-02-26
Mode: PREFLIGHT (discovery + documentation; no functional code changes)

---

## 1) 5-Pack Scorecard

### 1. Salary Matching — PASS

- **Validator SSOT:** `validateSalaryMatching()` per team → result in `allRules.salaryMatching` (tradeValidator.js:1000). Computes `matchOutgoing`/`matchIncoming` via `computeMatchingValues()` (SSOT for BYC/poison pill/trade kicker adjustments).
- **Apply-time gate:** `validatePostTradeSnapshotForContext()` calls `validateTrade()` on post-trade state → re-runs salary matching with same function. `!validationResult.valid` returns `{ success: false }` before any batch (mutationPipeline.js:533–538).
- **UI surface:** `TradeLegalChecker` reads `team.rules?.salaryMatching` — wired to real validator output.
- **Proof:** `TRADE_E2E_TRADE_APPLY_CONSISTENCY_DEEP_REVIEW_P1_RETURN_PACKAGE.md` — Q1/Q2 confirm no semantic mismatch; Q3/Q4 confirm no silent drops.

### 2. Sign-and-Trade — PASS

- **Validator SSOT:** `validateSignAndTrade()` per team → result in `allRules.signAndTrade` (tradeValidator.js:874, 1005). Checks S&T eligibility, contract payload shape, destination, hard-cap consequences.
- **Apply-time gate (preflight):** `buildPostTradeTeamsSnapshot()` runs dedicated S&T preflight (tradeContext.js:147–213) — throws `SIGN_AND_TRADE_APPLY_ERROR` on: missing/invalid destination, ineligible player status, missing/invalid S&T contract payload.
- **Apply-time gate (re-validation):** `validatePostTradeSnapshotForContext()` → `validateTrade()` re-runs `validateSignAndTrade()` on post-trade state.
- **UI surface:** `TradeLegalChecker` reads `team.rules?.signAndTrade` — wired to real validator output.
- **Proof:** `TRADE_E2E_SIGN_AND_TRADE_DEEP_REVIEW_P1_RETURN_PACKAGE.md`, `TRADE_E2E_SIGN_AND_TRADE_FIX_E1_EXECUTION_RETURN_PACKAGE.md`, TRADE_MACHINE_MASTER.md "E1 — Sign-And-Trade" section.

### 3. Validator ↔ Apply-time ↔ Persistence Consistency — PASS

- **SSOT enforcement:** Apply-time calls the *same* `validateTrade()` function via `validatePostTradeSnapshotForContext()` (tradeContext.js:612). Apply-time is strictly stricter — additional gates run only at apply: `validateMutationLeagueInvariants()` (Phase 86), `validateMutationEntitlementInvariants()` (Phase B5), `validateTradeApplyExclusivity()` (Phase 3.7).
- **Atomicity:** Single `writeBatch(db).commit()` (mutationPipeline.js:2646). All writes staged via `batch.set()`/`batch.update()` before the single commit. Pre-persist failures prevent batch opening.
- **No override bypass at apply:** `VITE_ENABLE_CBA_OVERRIDE` allows `forceTrade` at UI-time only. Apply-time pipeline uses raw `validation.legal` with no override path (mutationPipeline.js:2232–2250).
- **Proof:** `TRADE_E2E_TRADE_APPLY_CONSISTENCY_DEEP_REVIEW_P1_RETURN_PACKAGE.md` — no STOPs triggered, Q1–Q5 all confirm parity.

### 4. Multi-team Routing Semantics — PASS

- **Validator SSOT (players):** `validatePlayerRouting()` (tradeValidator.js:771) — enforces explicit destinations for all outgoing players in 3+ team trades. `shouldRoutePlayerToTeam()` requires `destinationTeamId !== null` for 3+ teams, no broadcast fallback.
- **Validator SSOT (entitlements):** `validateEntitlementRouting()` (tradeValidator.js:732) — enforces uniqueness, ownership, destination validity for entitlements in 3+ team trades.
- **Apply-time gate:** `buildPostTradeTeamsSnapshot()` throws `TRADE_APPLY_ROUTING_ERROR` for unrouted players in 3+ team trades (tradeContext.js:248–253). No partial writes.
- **UI surface:** Routing failures surface as legality reasons in `TradeSummaryPanel`; per-team routing details in validation output.
- **Proof:** TRADE_MACHINE_MASTER.md Clarified Rules A–E; `TRADE_TESTS_FIX_E1_EXECUTION_RETURN_PACKAGE.md`.

### 5. Roster + Structural Legality — PASS

- **Validator SSOT:** `computeRosterValidation()` per team (tradeValidator.js:166) → result in `allRules.rosterCount` (tradeValidator.js:1014). Constants: `MIN_ROSTER=14`, `MAX_ROSTER=15`, `MAX_TWO_WAY=3`. Respects `validationFlags.rosterEnforcement` and `validationFlags.twoWayRoster`.
- **Apply-time gate:** `validatePostTradeSnapshotForContext()` → `validateTrade()` → same roster rules. `legal: false` blocks `executeTrade` before `batch.commit()`.
- **UI surface:** `TradeLegalChecker` reads `team.rules?.rosterCount` — wired to real validator output (fixed in E1).
- **Proof:** `TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_FIX_E1_EXECUTION_RETURN_PACKAGE.md`; tests in `tests/trade/rosterLegality_validateTrade.test.js` (3 tests: max overflow, min underflow, two-way overflow).

---

## 2) UI Parity Confirmation — NO STOP

`TradeLegalChecker.jsx` renders 13 rule rows via the `RuleDisplay` component. Every row reads from `team.rules?.{key}` where `{key}` maps exactly to a key in the validator's `allRules` object (tradeValidator.js:999–1015).

| UI Row | `allRules` Key | Wired to Validator? |
|--------|---------------|---------------------|
| Salary Matching | `salaryMatching` | Yes |
| Hard Cap | `hardCap` | Yes |
| Stepien Rule | `stepienRule` | Yes |
| Sign-and-Trade | `signAndTrade` | Yes |
| 2nd Apron Rules | `secondApronEnforcement` | Yes |
| Roster Count | `rosterCount` | Yes (wired in E1) |
| Player Consent | `consent` | Yes |
| Reacquisition | `reacquisition` | Yes |
| Salary Aggregation | `aggregation` | Yes |
| Trade Exceptions | `tradeExceptions` | Yes |
| Cash Inclusion | `cash` | Yes |
| Timing Restrictions | `timingEnforcement` | Yes |
| Pick Exclusivity | `entitlementExclusivity` | Yes |

The `RuleDisplay` component (TradeLegalChecker.jsx:10–33) returns `null` when:
- `!rule` (undefined/null)
- `typeof rule !== 'object'`
- `Array.isArray(rule)` (enforcement arrays like `consentEnforcement`, `eligibilityEnforcement`)
- `rule.passed === undefined`

This means non-applicable rules simply do not render. There are **zero unwired or cosmetic-only rows**.

**STOP condition #1 (cosmetic UI row): NOT TRIGGERED.**

---

## 3) Apply-Time Fail-Closed Confirmation — NO STOP

The `applyWorldMutation('executeTrade')` pipeline enforces the following gates in order. Any failure returns `{ success: false }` or throws before persistence:

| Phase | Gate | Location | What It Blocks |
|-------|------|----------|----------------|
| 2 (compute) | Player routing invariant (3+ teams) | `buildPostTradeTeamsSnapshot()` (tradeContext.js:248–253) | Throws `TRADE_APPLY_ROUTING_ERROR` — no partial writes |
| 2 (compute) | S&T preflight (eligibility/contract/destination) | `buildPostTradeTeamsSnapshot()` (tradeContext.js:147–213) | Throws `SIGN_AND_TRADE_APPLY_ERROR` — no partial writes |
| 2 (compute) | Entitlement cross-team duplicate (post-apply assertion) | `buildPostTradeTeamsSnapshot()` (tradeContext.js:528–540) | Throws invariant violation |
| 2 (compute) | Full trade re-validation (salary, hard cap, roster, S&T, TPE, etc.) | `validatePostTradeSnapshotForContext()` → `validateTrade()` (tradeContext.js:612) | Returns `legal: false` → blocks at Phase 3 |
| 2 (compute) | TPE consumption fail-closed | `computeTradeResult()` (mutationPipeline.js:1192–1219, 1499–1508) | Returns `{ success: false }` if `absorptionMode='TPE'` without valid `tpeId`/`matchIncoming` |
| 3 | Validation gate | `validateMutation()` (mutationPipeline.js:2232–2250) | Reads pre-validated context; `!valid` → `{ success: false }` |
| 3.5 | League invariants (duplicate players) | `validateMutationLeagueInvariants()` (mutationPipeline.js:544–565) | `{ success: false }` |
| 3.6 | Entitlement invariants (duplicate entitlements) | `validateMutationEntitlementInvariants()` (mutationPipeline.js:569–591) | `{ success: false }` |
| 3.7 | Entitlement exclusivity (overlapping claims) | `validateTradeApplyExclusivity()` (mutationPipeline.js:600–620) | `{ success: false }` |
| 4 | Atomic persist | `persistWorldMutation()` → `batch.commit()` (mutationPipeline.js:2646) | Single atomic commit; Firestore rolls back on failure |

Coverage by category:
- **Roster window + two-way:** Phase 2 re-validation (roster rules in `validateTrade`)
- **Salary matching + hard caps:** Phase 2 re-validation (salary/hardCap rules in `validateTrade`)
- **Entitlement routing/exclusivity:** Phase 2 (pre-apply assertions) + Phase 3.6 + Phase 3.7
- **Multi-team routing:** Phase 2 (`TRADE_APPLY_ROUTING_ERROR` throw)
- **S&T:** Phase 2 (`SIGN_AND_TRADE_APPLY_ERROR` throw + re-validation)
- **TPE:** Phase 2 (fail-closed pre-check in `computeTradeResult`)

**STOP condition #2 (rule enforced in validator but NOT at apply-time): NOT TRIGGERED.**
**STOP condition #3 (unresolved evidence gaps): NOT TRIGGERED.**

---

## 4) Non-Blocking Minors (not required for ship)

### Minor 1: `usedTradeExceptions` dead field
- **File:** `src/features/architect/hooks/useTradeMachine.js:1037–1039`
- **Issue:** `exportCurrentTrade()` produces `usedTradeExceptions: t.sends.filter(p => p.acquiredViaTPE).map(p => p.tpeId)`. `acquiredViaTPE` is never set by any action in `useTradeMachine`. Result is always `[]`.
- **Impact:** None — apply-time correctly reads `absorptionMode` + `tpeId`.
- **Recommended fix:** Update filter to `p.absorptionMode === 'TPE'` or remove the field.

### Minor 2: `twoWayPlayers` not maintained by `buildPostTradeTeamsSnapshot`
- **File:** `src/features/architect/utils/tradeContext/tradeContext.js`
- **Issue:** Snapshot builder updates `players` and `roster` but not `twoWayPlayers`. The roster count helper handles this via `isTwoWay` flag detection on the combined `players` array.
- **Impact:** None at runtime — fallback works correctly.
- **Recommended fix:** Maintain `twoWayPlayers` explicitly in snapshot builder for consistency.

### Minor 3: Three duplicate roster validation modules
- **Files:** `src/features/architect/utils/tradeMachine/rules/rosterValidation.js`, `validateRoster.ts`, `validateRoster.js`
- **Issue:** Overlapping functionality. Canonical enforcement is now inline in `tradeValidator.js` via `computeRosterValidation()`. The legacy modules are used by other code paths (enforcement callbacks).
- **Impact:** None — consolidation is a cleanup item.
- **Recommended fix:** Consolidate into single module when blast radius is acceptable.

### Minor 4: `incomingPlayers`/`incomingEntitlements` redundant in export
- **File:** `src/features/architect/hooks/useTradeMachine.js:1029–1036`
- **Issue:** `exportCurrentTrade()` includes these fields, but `applyTradeToCapSheet()` does not use them for world mode (incoming is recomputed via routing). Only used by vacuum-mode local state.
- **Impact:** None — redundant data, not a semantic mismatch.

### Minor 5: Persistence-contract shape enforcement environment-gated
- **File:** `src/features/architect/utils/persistenceContracts/enforcement.js`
- **Issue:** `assertPersistableOrThrow` only enforces when `shouldEnforcePersistenceContracts()` returns true (test environments). Not enforced in production by default.
- **Impact:** Pipeline has upstream shape guarantees; environment-gating is by design.

### Minor 6: `FaExceptionTracker` mixes local and validator data
- **File:** `src/features/architect/tradeMachine/FaExceptionTracker.jsx`
- **Issue:** Mixes local team data with result data for display. Informational only, not an apply gate.
- **Impact:** Display can drift from canonical legality outputs without affecting correctness.

---

## 5) Doc Updates Made

### `docs/architect/TRADE_MACHINE_MASTER.md`

Added new section **"5-Pack Ship Closeout"** at the end of the document containing:
- Date (2026-02-26)
- Scorecard table with PASS status for all 5 pillars, SSOT enforcement points, and evidence links
- Key return package paths (10 packages)
- Non-blocking minors list (6 items)
- Validation gates at closeout (all 4 PASS with counts)

---

## 6) Validation Outputs

### `npm run test:trade -- --reporter=dot`

**Status: PASS**

```
Test Files  56 passed (56)
     Tests  516 passed | 1 skipped | 3 todo (520)
  Duration  84.09s
```

### `npm run test:architect -- --reporter=dot`

**Status: PASS**

```
Test Files  136 passed (136)
     Tests  2206 passed | 1 skipped | 3 todo (2210)
  Duration  170.21s
```

### `npm run build`

**Status: PASS**

```
✓ 3052 modules transformed.
✓ built in 2m 34s
```

Non-blocking warnings: module externalization (`tradeDebug.js` fs import), chunk size.

### `npm run validate:project`

**Status: PASS**

```
✅ All validations passed!
```

---

## 7) Exact Files/Functions Referenced

### Validator
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - `validateTrade()` — main validator entry point (line ~450–1150)
  - `computeRosterValidation(team)` — roster count validation (line 166)
  - `extractPlayerId(p)` — player ID extraction helper
  - `allRules` aggregation (lines 999–1015): `salaryMatching`, `hardCap`, `stepienRule`, `cash`, `tradeExceptions`, `signAndTrade`, `consent`, `reacquisition`, `aggregation`, `consentEnforcement`, `eligibilityEnforcement`, `timingEnforcement`, `secondApronEnforcement`, `entitlementExclusivity`, `rosterCount`
  - `isTeamLegal = violations.length === 0` (line 1037)
  - `isOverallLegal = teamResults.every(r => r.legal)` (line 1114)
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js` — `validateSalaryMatching()`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js` — `validateSignAndTrade()`
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js` — `validatePlayerRouting()`
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` — `validateEntitlementRouting()`, `validateEntitlementLinkageLegality()`
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js` — `validateTradeExceptions()`
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js` — `computeMatchingValues()`
- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts` — `isSignAndTradeEligible()`, `resolveSignAndTradeContractPayload()`, `validateSignAndTradeContractPayload()`

### UI
- `src/features/architect/tradeMachine/TradeLegalChecker.jsx` — 13 rule rows, all wired to `team.rules?.{key}`
- `src/features/architect/tradeMachine/TradeEditor.jsx` — `canApplyTrade = hasCurrentValidation && result?.legal === true` (line 245)
- `src/features/architect/tradeMachine/FaExceptionTracker.jsx` — informational display (minor 6)
- `src/features/architect/hooks/useTradeMachine.js` — `exportCurrentTrade()` (lines 1019–1043), `usedTradeExceptions` dead field (lines 1037–1039)

### Apply-time / Mutation Pipeline
- `src/features/architect/utils/mutationPipeline.js`
  - `applyWorldMutation()` — orchestrator (lines ~450–680)
  - `computeWorldMutation('executeTrade')` — calls `buildPostTradeTeamsSnapshot` + `validatePostTradeSnapshotForContext` (lines 932–963)
  - `computeTradeResult()` — TPE creation/consumption with fail-closed pre-check (lines 1095–1530)
  - `validateMutation()` — validation gate, Phase 57 hard error if context missing (lines 2232–2250)
  - `persistWorldMutation()` — single `batch.commit()` (line 2646)
- `src/features/architect/utils/tradeContext/tradeContext.js`
  - `buildPostTradeTeamsSnapshot()` — pure roster transform with fail-closed routing + S&T invariants (lines 75–563)
  - `validatePostTradeSnapshotForContext()` — calls `validateTrade()` exactly once on post-trade snapshot (lines 593–642)
- `src/features/architect/utils/leagueInvariants.ts` — `validateMutationLeagueInvariants()`, `validateMutationEntitlementInvariants()`, `validateTradeApplyExclusivity()`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` — `applyTradeToCapSheet()` (lines 614–876)

### Persistence / Contracts
- `src/features/architect/utils/persistenceContracts/contracts.js` — allowlists
- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js` — `normalizeTeamTpeSchema()`, `getTeamTpeList()`
- `src/features/architect/utils/persistenceContracts/enforcement.js` — `assertPersistableOrThrow()`, `shouldEnforcePersistenceContracts()`

### Configuration
- `src/config/validationFlags.js` — `rosterEnforcement: 'error'`, `twoWayRoster: 'error'`

### Legacy Roster Modules (minor 3)
- `src/features/architect/utils/tradeMachine/rules/rosterValidation.js`
- `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js`

### Tests
- `tests/trade/rosterLegality_validateTrade.test.js` — 3 tests (max overflow, min underflow, two-way overflow)
- `tests/tradeValidator.test.js` — core validator tests (14 tests)
- `tests/tradeValidatorEdgeCases.test.js` — edge case validator tests

### Docs
- `docs/architect/TRADE_MACHINE_MASTER.md` — updated with 5-Pack Ship Closeout section
- `docs/SHIP_GATES_MASTER.md` — confirmed current, no changes needed

### Return Packages Referenced
- `return_packages/trade_machine/TRADE_E2E_TRADE_APPLY_CONSISTENCY_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_FIX_E1_EXECUTION_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_SIGN_AND_TRADE_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_SIGN_AND_TRADE_FIX_E1_EXECUTION_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_TPE_EXCEPTIONS_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_TPE_EXCEPTIONS_FIX_E1_EXECUTION_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_CAP_APRON_HARDENING_E1_EXECUTION_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_CAP_APRON_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
