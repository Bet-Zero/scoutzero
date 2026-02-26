# TRADE_E2E_CAP_APRON_DEEP_REVIEW_P1 — EXECUTION RETURN PACKAGE

**Execution Date:** 2026-02-26  
**Mode:** Execution (post-preflight implementation)

## STOP REPORT
- Preflight STOP condition #3 was valid: hard-cap/apron legality was partially wired across UI surfaces (Team Card vs Summary used different allowable-incoming semantics).
- Execution status: resolved.
- Active STOP conditions after implementation: none.

## A) Ship-Readiness Verdict
✅ **Ship-ready for cap/apron legality** (no open cap/apron blockers found in this pass).

## B) System Map (Authoritative)

### 1) Team cap totals computation (SSOT)
- **Canonical source:** `src/features/architect/utils/capTotals/computeTeamCapTotals.js` → `computeTeamCapTotals()`.
- **Apply-time usage:** `src/features/architect/utils/tradeContext/tradeContext.js` → `buildPostTradeTeamsSnapshot()` recalculates `updatedTeam.totals` with `computeTeamCapTotals(...)`.
- **Inputs:** team cap sheet (`players`, `capHolds`, dead-cap sources), selected year.
- **Outputs:** canonical totals object (`totalCapAllocations`, deltas vs cap/tax/aprons, metadata).
- **World-aware:** yes via loader chain that supplies team snapshot before totals recompute.

### 2) Incoming/outgoing salary computation (route-aware)
- **Canonical route resolver:** `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` → `shouldRoutePlayerToTeam()`.
- **Blocking routing validation (before salary pass):** `tradeValidator.js` → `validatePlayerRouting(...)` early return path.
- **Canonical salary pass:** `tradeValidator.js` second pass computes `salaryOut` and routed `salaryIn` using `matchOutgoing`/`matchIncoming`.
- **Inputs:** per-team sends, activeTeamCount, player destination fields (`tradeTo` aliases).
- **Outputs:** per-team `salaryOut`, `salaryIn`, `projectedSalary`.
- **World-aware:** indirectly yes (teams are loaded via world-aware chain before validation).

### 3) Salary matching logic
- **Rule engine SSOT:** `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js` → `getSalaryMatchingResult()`.
- **Validator wrapper/enforcement:** `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js` → `validateSalaryMatching()`.
- **Hard-cap-aware ceiling in salary-matching output:** `validateSalaryMatching()` computes `hardCapIncomingCeiling` and `effectiveAllowableIncoming = min(allowableIncoming, hardCapIncomingCeiling)`.
- **Inputs:** `teamTotalSalary`, `salaryOut`, routed `salaryIn`, cap settings, hard-cap status.
- **Outputs:** pass/fail, `allowableIncoming`, `effectiveAllowableIncoming`, rule metadata, violations.
- **World-aware:** yes through supplied team state/context.

### 4) Hard-cap / apron enforcement logic
- **Hard-cap status source:** `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js` → `getHardCapStatus()`.
- **Hard-cap enforcement:** `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js` → `validateHardCap()`.
- **Inputs:** team totals, `salaryIn`, `salaryOut`, hard-cap flags/status, apron thresholds.
- **Outputs:** pass/fail, hard-cap violation messages, hardCapType, cap limits.
- **World-aware:** yes through world-loaded team state.

### 5) “Allowable Incoming” UI display logic
- **Canonical selector:** `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js` → `getOfficialSalaryMatchingSnapshot()`.
- **Canonical display helper:** same file → `getDisplayAllowableIncoming(snapshot)` (effective-first).
- **Snapshot accessor contract:** `src/features/architect/hooks/useTradeMachineSnapshot.js` → `getTeamSnapshot()` now exposes `effectiveAllowableIncoming`, `hardCapIncomingCeiling`, `displayAllowableIncoming`, `isHardCapped`.
- **Rendered in Team Card:** `src/features/architect/tradeMachine/TradeTeamCard.jsx` uses `snapshot.displayAllowableIncoming`.
- **Rendered in Summary:** `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` uses `getDisplayAllowableIncoming(officialSnapshot)`.
- **World-aware:** UI receives world-loaded team state through `useTradeMachine` + `loadWorldTeamData`.

## C) End-to-End Flow Traces (Concrete)

### 1) 2-team trade: UI → validation → salary matching → hard-cap → reason surface
1. `useTradeMachine` loads teams (`loadWorldTeamData`) and assembles trade slots.
2. `validateTrade` computes outgoing/incoming matching salaries.
3. `validateSalaryMatching` evaluates matching rule and ceilings.
4. `validateHardCap` evaluates apron hard-cap breach using projected salary and incoming ceiling semantics.
5. Team-level rule violations roll into `teamResults`; top-level `reason` is surfaced.
6. UI snapshots use `getOfficialSalaryMatchingSnapshot` + `getDisplayAllowableIncoming`, so displayed allowable aligns with effective legality ceiling.

### 2) 3+ team trade: routing → incoming/outgoing → matching → hard-cap → summaries
1. `validatePlayerRouting` runs first and blocks missing/invalid routing in 3+ team trades.
2. `shouldRoutePlayerToTeam` gates `salaryIn` accumulation by explicit destination.
3. Salary pass computes routed `salaryIn`/`salaryOut`.
4. `validateSalaryMatching` applies second-apron/first-apron/over-cap rules from routed values.
5. `validateHardCap` enforces hard-cap breach checks.
6. Team card and summary both display `displayAllowableIncoming` semantics.
7. Apply-time snapshot (`buildPostTradeTeamsSnapshot`) consumes `tradeTo`/`receivingTeamId`/`receivingTeamIndex`/aliases; 3+ unrouted players are skipped (no broadcast fallback).

### 3) Hard-cap scenario: legal ceilings vs displayed ceilings
1. `validateSalaryMatching` may produce `allowableIncoming` (salary-match ceiling) higher than hard-cap room.
2. Same function computes `hardCapIncomingCeiling` and `effectiveAllowableIncoming` (minimum of both ceilings).
3. `validateHardCap` separately enforces projected-salary hard-cap legality and now reports incoming-ceiling overage language where applicable.
4. UI “Allowable Incoming” now reads `displayAllowableIncoming` (effective first), so display and legality surface are aligned.

## D) Truth Model vs Implementation (Gap Analysis)

### Enforced truth model (code-and-tests reality)
- `salaryIn/salaryOut` are routed and canonicalized in validator second pass.
- Salary matching and hard-cap are separate rules, but salary matching exports hard-cap-aware effective ceiling fields for UI parity.
- Hard-cap legality is enforced by `validateHardCap`.
- UI display uses a canonical helper to avoid surface drift.

### Mismatch question: can UI allowable exceed hard-cap-limited amount?
- **Current state:** no, for displayed “Allowable Incoming”.
- Raw `allowableIncoming` can still be numerically above hard-cap room by design, but UI display now uses `displayAllowableIncoming` (`effectiveAllowableIncoming` first).
- Validator legality remains enforced by `validateHardCap`, and violation messaging now references incoming ceiling semantics when that is the active limiter.

## Specific Questions (Required)

1. **1st-apron hard-capped teams**
- Compute allowable as `min(salaryMatchCeiling, apron-remaining-based ceiling)`? **Yes** (`validateSalaryMatching`).
- Enforce in validator legality? **Yes** (`validateHardCap`).
- Display same number in UI? **Yes now** (Team Card + Summary both use canonical display helper/effective-first semantics).

2. **Second apron teams**
- “Incoming <= outgoing” computed from routed incoming only in 3+ team trades? **Yes** (routing-gated `salaryIn`).
- Applied before/after routing validation? **Routing validation runs first**; salary matching runs after routing pass.

3. **Allowable Incoming consistency across surfaces**
- Team panel display, summary panel, validator reason alignment? **Yes after this execution** for hard-cap-limited allowable display semantics.

4. **World-aware + parent-world-aware chain**
- Same chain as Architect? **Yes** (`useTradeMachine` → `loadWorldTeamData` → `teamLoader.getTeam` world → parent → base).

## E) Issues List (Blockers / Majors / Minors)

### Resolved in this execution

1. **Severity: Blocker**
- **Issue:** Team Card displayed raw `allowableIncoming` while Summary used effective hard-cap-aware ceiling.
- **Why incorrect:** users could see two different legality ceilings for same team/trade.
- **Repro:** hard-capped team with salary-match ceiling above hard-cap ceiling.
- **Impacted surfaces:** `TradeTeamCard.jsx`, `TradeSummaryPanel.jsx`, snapshot selector path.
- **Fix strategy:** introduce canonical `displayAllowableIncoming` + shared helper and route both surfaces through it.

2. **Severity: Major**
- **Issue:** Apply-time multi-team routing contract was inconsistent (`tradeTo` not uniformly normalized/consumed).
- **Why incorrect:** 3+ team apply path could degrade to legacy assumptions if only `tradeTo`/alias fields were present.
- **Repro:** 3-team payload with player destination set via `tradeTo` only.
- **Impacted surfaces:** `useArchitectActions.ts`, `tradeContext.js`, `mutationPipeline.js`.
- **Fix strategy:** normalize destination fields at payload build and consume aliases deterministically in snapshot builder.

3. **Severity: Major**
- **Issue:** Hard-cap violation reason text did not always reflect incoming-ceiling overage semantics.
- **Why incorrect:** legality explanation was less aligned with the ceiling users see.
- **Repro:** hard-capped team where salary matching passes but hard cap fails.
- **Impacted surfaces:** `hardCapValidation.js`, validator reason output.
- **Fix strategy:** enrich violation strings with incoming ceiling delta when active.

### Open issues
- **Blockers:** none.
- **Majors:** none identified in this pass.
- **Minors:** none newly identified that block cap/apron legality correctness.

## F) Verification Checklist

### Manual scenarios (10)
1. 2-team over-cap band boundary: verify pass/fail at exact allowable threshold.
2. 1st-apron hard-capped team where salary-match ceiling > hard-cap ceiling: verify displayed allowable = effective ceiling.
3. Same as #2 with incoming above effective ceiling: verify hard-cap failure reason references incoming ceiling overage.
4. 3-team second-apron team with routed incoming > outgoing: verify second-apron salary mismatch failure.
5. Second-apron boundary case (`projectedSalary == secondApron`): verify no strict-second-apron classification from equality alone.
6. Valid 3-team loop routing (A→B→C→A): verify each roster receives only routed player.
7. 3-team missing destination: verify routing validator blocks and apply snapshot does not broadcast unrouted players.
8. Team Card vs Summary allowable parity under hard-cap limitation.
9. Apply trade in world mode using `tradeTo`-only destination metadata: verify destination rosters update correctly.
10. Child world team absent + parent world present: verify parent fallback data drives trade cap legality.

### Automated expectations to keep/add (10)
1. `tests/trade/tradeAllowableIncomingParity.guardrail.test.ts`: Team Card/Summary display parity.
2. `tests/trade/hardCap_reasonParity.guardrail.test.ts`: hard-cap incoming ceiling reason parity.
3. `src/tests/architect/tradeApply_tradeToRouting.guardrail.test.ts`: 3-team `tradeTo` routing in apply snapshot.
4. `src/tests/architect/tradeApply_tradeToRouting.guardrail.test.ts`: no 3-team unrouted player broadcast.
5. `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts`: child→parent fallback + hard-cap legality.
6. Existing routing gate: `src/tests/trade/playerRouting.test.js` must continue requiring destination in 3+ trades.
7. Existing salary matching hard-cap ceiling behavior: `src/tests/trade/hardCap_salaryMatching.guardrail.test.js`.
8. Existing second-apron SSOT boundary semantics: `src/tests/trade/secondApron_SSOT_guardrail.test.js`.
9. Existing selector contract parity: `src/tests/trade/tradeMultiSurfaceOfficialValues.test.js` helper assertions.
10. Existing snapshot wiring invariants: `src/tests/trade/tradeSnapshotWiring.test.js`.

### Gate commands run (required)
1. `npm run test:trade -- --reporter=dot` → **PASS** (`53` files, `504` passed, `1` skipped, `3` todo).
2. `npm run test:architect -- --reporter=dot` → **PASS** (`131` files, `2195` passed, `1` skipped, `3` todo).
3. `npm run build` → **PASS** (warnings only).
4. `npm run validate:project` → **PASS**.

## G) Evidence Requirements

### Decisive logic locations
- Routed incoming/outgoing + routing order: `tradeValidator.js`.
- Salary matching SSOT + hard-cap-effective ceiling: `validateSalaryMatching.js` and `salaryMatchingRules.js`.
- Hard-cap legality and messaging: `hardCapValidation.js`.
- Hard-cap status source: `hardCapStatus.js`.
- UI display selector parity: `getOfficialSalaryMatchingSnapshot.js` + Team Card + Summary.
- World/parent/base load chain: `useTradeMachine.js`, `worldTeamData.ts`, `teamLoader.js`.

### Existing tests used as behavior evidence
- `src/tests/trade/playerRouting.test.js`
- `src/tests/trade/hardCap_salaryMatching.guardrail.test.js`
- `src/tests/trade/secondApron_SSOT_guardrail.test.js`
- `src/tests/trade/tradeSnapshotWiring.test.js`
- `src/tests/trade/tradeMultiSurfaceOfficialValues.test.js`

### Assumptions / hand-waved areas surfaced
- `team.hardCapped === true` maps to first-apron hard-cap default in status logic unless more explicit trigger metadata exists.
- 2-team apply-time broadcast fallback remains intentionally preserved for backward compatibility; 3+ team broadcast fallback is intentionally removed.

## H) Stop Conditions (Final Check)
1. Locate where allowable incoming is computed/displayed → **Located and unified**.
2. UI/validator use different salary-in computations with no reconciliation → **No; routed salary-in is canonicalized and UI display parity is fixed.**
3. Hard-cap/apron enforcement missing or partial while UI implies full enforcement → **No remaining stop condition after this execution.**

## Proposed Master Doc Deltas (Not Applied in This Execution)
1. Add a canonical UI rule: “All Allowable Incoming displays must use `displayAllowableIncoming` (effective-first), not raw `allowableIncoming`.”
2. Document apply-path destination contract aliases accepted by trade snapshot builder: `receivingTeamIndex`, `receivingTeamId`, `tradeTo`, `toTeamId`, `destTeamId`.
3. Document explicit behavior: “In 3+ team apply snapshots, unrouted players are skipped (no broadcast fallback).”

## Files Changed
- `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`
- `src/features/architect/hooks/useTradeMachineSnapshot.js`
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
- `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/mutationPipeline.js`
- `src/tests/trade/tradeMultiSurfaceOfficialValues.test.js`
- `tests/trade/tradeAllowableIncomingParity.guardrail.test.ts`
- `tests/trade/hardCap_reasonParity.guardrail.test.ts`
- `src/tests/architect/tradeApply_tradeToRouting.guardrail.test.ts`
- `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts`

## Commands Intentionally Skipped
- `npm run test:full` / raw `vitest` / `npm test`: skipped per policy (`RUN FULL SUITE` not requested).
- `npm run lint`: skipped (not requested; out of scope for this execution).
- `npm run typecheck`: skipped (not required by prompt and all required gates passed).

### RETURN PACKAGE (PASTE BACK)
1) Ship-Readiness Verdict
- ✅ Ship-ready for cap/apron legality.

2) Blockers list (if any)
- None.

3) Ordered fix plan (1–10)
1. Make Team Card allowable incoming hard-cap-aware via canonical display value.
2. Extend snapshot accessor contract with `effectiveAllowableIncoming`, `hardCapIncomingCeiling`, `displayAllowableIncoming`, `isHardCapped`.
3. Align Team Card + Summary display semantics through shared `getDisplayAllowableIncoming` helper.
4. Normalize apply pipeline routing contract to include `tradeTo`/alias fields before persistence.
5. Remove 3+ team apply-time player broadcast fallback for unrouted sends; keep deterministic skip + warning.
6. Add apply-time regression test for 3-team `tradeTo` routing.
7. Add UI parity regression test for Team Card vs Summary allowable display.
8. Add validator reason regression test for hard-cap-limited overage messaging.
9. Add world-context regression test covering child→parent fallback + cap legality enforcement.
10. Re-run required gates and record outcomes.

4) Verification checklist (manual + automated)
- Manual: scenarios 1–10 in Section F.
- Automated: expectations 1–10 in Section F.
- Required gates all passing: `test:trade`, `test:architect`, `build`, `validate:project`.

5) Exact files/functions referenced
- `getOfficialSalaryMatchingSnapshot()`, `getDisplayAllowableIncoming()`
- `getTeamSnapshot()`
- `validateTrade()` salary pass + `shouldRoutePlayerToTeam()`
- `validateSalaryMatching()`
- `getSalaryMatchingResult()`
- `validateHardCap()`
- `getHardCapStatus()`
- `buildPostTradeTeamsSnapshot()`
- `applyTradeToCapSheet()`
- `loadWorldTeamData()`, `getTeam()`
