# TRADE_E2E_SIGN_AND_TRADE_FIX_E1 — EXECUTION RETURN PACKAGE

## Scope
Implemented ship-scope S&T repairs across Trade Machine UI, validator, salary modeling, apply-time persistence, guardrail tests, and master documentation.

## Ship-Readiness Verdict
✅ Ship-ready for Sign-and-Trade fail-closed parity across UI → validator → apply-time persistence.

## What Was Implemented

### T1) Canonical S&T eligibility + contract SSOT
Added:
- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts`

Provides:
- `getPlayerContractStatusForYear(...)`
- `isSignAndTradeEligible(...)`
- contract normalization/validation helpers:
  - `normalizeSignAndTradeContractPayload(...)`
  - `resolveSignAndTradeContractPayload(...)`
  - `validateSignAndTradeContractPayload(...)`
  - `getSignAndTradeSalaryForYear(...)`

Behavior:
- Canonical status enum: `UNDER_CONTRACT | FREE_AGENT | CAP_HOLD | UNKNOWN`
- Eligibility no longer depends on missing salary rows.
- Trade Machine/apply paths use strict eligibility + strict contract payload requirements.
- Non-Trade-Machine legacy test payloads remain compatible via explicit legacy inference in non-strict mode.

### T2) Trade Machine S&T requires contract capture before state mutation
Updated:
- `src/features/architect/tradeMachine/TradePlayerRow.jsx`
- `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/features/architect/hooks/useTradeMachine.js`

Behavior:
- S&T menu gate now uses canonical eligibility resolver.
- Clicking S&T opens contract modal flow (no immediate toggle).
- S&T state only persists after valid modal confirm with destination + valid contract.
- Hard invariant enforced in state updates: if `signAndTrade=true`, then valid `signAndTradeContract` must exist.

### T3) FA modal payload normalization to canonical `salariesByYear[]`
Updated:
- `src/shared/components/EditContractModal.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

Behavior:
- S&T payloads now emit canonical contract shape with `salariesByYear[]`.
- `ensureContractStructure` updated to normalize legacy input safely while preserving canonical output.

### T4) Validator fail-closed + parity for contract/destination/eligibility
Updated:
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js`

Behavior:
- Validator blocks when S&T eligibility fails, contract is missing/invalid, or route is incomplete.
- Trade Machine source path enforces strict `signAndTradeContract` presence.
- Destination routing is required for Trade Machine and all 3+ team trades.
- Salary matching now uses S&T first-year contract salary for S&T assets.

### T5) Apply-time fail-closed + atomic S&T semantics for executeTrade path
Updated:
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

Behavior:
- ExecuteTrade preflight (Trade Machine path) fails before persistence on invalid S&T payloads.
- Apply snapshot now persists normalized S&T contract to destination player.
- Source team cap hold for S&T player is removed in same computed update.
- Receiving team hard-cap consequence is persisted via existing allowed team fields (`hardCapped`, `hardCapLevel`, `hardCapReason`, `hardCapTriggeredBy`) plus totals metadata.
- No partial commit path introduced.

### T6) Guardrail tests
Added:
- `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`

Coverage includes:
- ineligible S&T rejection
- missing contract rejection
- S&T salary matching parity
- 3+ team destination rejection
- apply-time fail-closed/no-write behavior
- apply-time contract persistence + cap hold cleanup + hard-cap consequences

### T7) Master doc updated
Updated:
- `docs/architect/TRADE_MACHINE_MASTER.md`

Added explicit S&T section covering:
- canonical eligibility
- required contract payload shape
- Trade Machine state representation
- validator/apply parity
- fail-closed guarantees
- hard-cap consequence semantics

## Validation Outputs (Required Commands)

1. `npm run test:trade -- --reporter=dot`
- PASS
- Test Files: `54 passed`
- Tests: `508 passed`, `1 skipped`, `3 todo`

2. `npm run test:architect -- --reporter=dot`
- PASS
- Test Files: `136 passed`
- Tests: `2206 passed`, `1 skipped`, `3 todo`

3. `npm run build`
- PASS
- Vite build completed successfully.
- Non-blocking warnings observed:
  - dynamic import chunking notices
  - large chunk size warning
  - browser compatibility/externalization notices

4. `npm run validate:project`
- PASS
- `All validations passed!`

## Exact Files Changed
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/features/architect/tradeMachine/TradePlayerRow.jsx`
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
- `src/shared/components/EditContractModal.jsx`
- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts`
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
- `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`

---

## RETURN PACKAGE (PASTE BACK)
1) Ship-Readiness Verdict (S&T)
- ✅ Ship-ready.

2) Blockers list (should be empty if complete)
- None.

3) Exact files changed (bulleted)
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/features/architect/tradeMachine/TradePlayerRow.jsx`
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
- `src/shared/components/EditContractModal.jsx`
- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts`
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
- `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`

4) Behavior changes (what the user can now do)
- Trade Machine users can no longer set S&T without completing a contract modal.
- S&T now requires destination + valid contract payload to validate/apply.
- Salary matching uses S&T first-year contract salary for S&T assets.
- ExecuteTrade apply path persists S&T contract semantics and cap-hold/hard-cap effects fail-closed.

5) Tests added/updated (with paths)
- Added: `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`
- Added: `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
- Updated behavior covered by existing suites including `tests/tradeValidator.test.js`, `tests/trade/signAndTrade_completeness.test.js`, and `src/tests/architect/signAndTrade.test.js` (via full suite run).

6) Validation outputs (commands + PASS/FAIL + counts)
- `npm run test:trade -- --reporter=dot` → PASS (`54` files, `508 passed`, `1 skipped`, `3 todo`)
- `npm run test:architect -- --reporter=dot` → PASS (`136` files, `2206 passed`, `1 skipped`, `3 todo`)
- `npm run build` → PASS (build completed; non-blocking Vite warnings)
- `npm run validate:project` → PASS (`All validations passed!`)

7) Any STOP REPORT (if triggered)
- None.
