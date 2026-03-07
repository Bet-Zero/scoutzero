# TM_VALIDATOR_TRUST_FIXES_E1 — EXECUTION RETURN PACKAGE

## 1. Summary

- Fixed the four blocker targets from `TM_VALIDATOR_DEEP_REVIEW_P1`: canonical preview/apply validation context, authoritative two-way enforcement, authoritative FA-exception enforcement, and override/legality separation.
- No blocker target was left open in the live authoritative path.
- Overall outcome: the authoritative validator is materially more trustworthy, and live preview/apply no longer depend on machine-date defaults or override-flattened legality.

## 2. Files Changed

- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Canonicalized `asOfDate`, `tradeDate`, derived season state, and authoritative `offseason` handling.
  - Routed authoritative eligibility and FA-exception validation into the live engine path.
- `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js`
  - Collapsed the old live path onto `validateEligibility.js` so two-way trade blocking is enforced by the live engine.
- `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js`
  - Fixed FA-exception validation to use canonical salary fallback when `matchIncoming` is absent on incoming clones.
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
  - Subtracted FA-exception-absorbed salary in the live salary-matching path using canonical salary fallback.
- `src/features/architect/utils/tradeMachine/index.js`
  - Pointed public eligibility export at the authoritative module.
- `src/features/architect/utils/tradeMachine/validators/index.js`
  - Pointed compatibility validator export at the authoritative eligibility module.
- `src/features/architect/utils/tradeContext/tradeContext.js`
  - Threaded `payload.asOfDate` into apply-time trade validation input.
- `src/features/architect/utils/mutationPipeline.js`
  - Threaded resolved mutation `asOfDate` into authoritative `executeTrade` pre-validation.
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
  - Passed world `asOfDate` and canonical trade context into both world and base-state apply paths.
- `src/features/architect/GMDashboard/sections/TradeSection.jsx`
  - Passed `worldAsOfDate` into the Trade Machine editor.
- `src/features/architect/GMDashboard/GMDashboard.jsx`
  - Passed `worldAsOfDate` down to `TradeSection`.
- `src/features/architect/hooks/useTradeMachine.js`
  - Passed canonical `asOfDate` into preview validation.
  - Stopped override from rewriting `result.legal`; added `authoritativeLegal` and structured `override` metadata.
- `src/features/architect/tradeMachine/TradeEditor.jsx`
  - Stopped hiding the blocker message when override is requested.
- `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
  - Distinguished override-requested state from authoritative legality in the status banner.
- `tests/trade/validatorTrustFixes.test.js`
  - Added direct validator/apply-path regressions for two-way, FA-exception, and season-state context.
- `tests/trade/useTradeMachine.validatorTrust.test.ts`
  - Added preview-path regression proving override state stays separate from authoritative legality.
- `tests/tradeValidator.test.js`
  - Updated two legacy S&T fixtures to pass explicit offseason override when isolating S&T legality from the separate Jan. 15 timing gate.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added indexed summary entry and execution note for this pass.

## 3. Implemented Fixes

### TMV-001

- What changed:
  - `validateTrade()` now canonicalizes `asOfDate`, `tradeDate`, and season state, and derives `offseason` from the canonical date when callers do not explicitly provide it.
  - `useTradeMachine`, `useArchitectActions`, `mutationPipeline`, and `tradeContext` now thread `asOfDate` into the same authoritative validator path.
- Exact authoritative path now used:
  - Preview: `useTradeMachine` -> `validateTrade`
  - Apply: `useArchitectActions` -> `computeWorldMutation` -> `validatePostTradeSnapshotForContext` -> `validateTrade`
- Why this is the correct fix:
  - Both live paths now reach the same validator with the same date contract instead of falling back to machine time or implicit `offseason: true`.
- Follow-up still remaining:
  - Generic callers can still manually pass conflicting `offseason` and `asOfDate` for isolated tests or legacy code; live preview/apply no longer do that.

### TMV-002

- What changed:
  - The live engine now enforces eligibility through `validateEligibility.js` via the old `enforceEligibility.js` import path.
  - Two-way outgoing players are therefore blocked inside authoritative `validateTrade()`.
- Exact authoritative path now used:
  - `tradeValidator.js` -> `validators.enforceEligibility` -> `validateEligibility.js`
- Why this is the correct fix:
  - It removes split ownership between the tested two-way rule and the live engine import path.
- Follow-up still remaining:
  - None for the blocker target.

### TMV-003

- What changed:
  - `tradeValidator.js` now runs `validateFaExceptionUsage()` before salary matching and attaches the result to the team validation context.
  - `validateSalaryMatching()` now honors successful FA-exception absorption in the live path.
  - FA-exception salary usage now falls back to canonical contract salary when incoming clones lack `matchIncoming`.
- Exact authoritative path now used:
  - `tradeValidator.js` -> `validateFaExceptionUsage.js` -> `validateSalaryMatching.js`
- Why this is the correct fix:
  - It makes the user-reachable FA-exception path legal/illegal through the same authoritative `validateTrade()` result the UI and apply flow rely on.
- Follow-up still remaining:
  - None for the blocker target.

### TMV-004

- What changed:
  - `useTradeMachine` no longer rewrites `legal` when override is requested.
  - Override state is now carried separately as `result.override`, and `authoritativeLegal` mirrors the real validator output.
  - `TradeSummaryPanel` and `TradeEditor` now message override-requested trades as blocked unless authoritative legality is true.
- Exact authoritative path now used:
  - `useTradeMachine` result contract -> `TradeEditor` / `TradeSummaryPanel`
- Why this is the correct fix:
  - It preserves one meaning for `legal`: authoritative validator legality. Override remains metadata, not a legality rewrite.
- Follow-up still remaining:
  - None for the blocker target.

## 4. Regression Coverage Added or Updated

- `tests/trade/validatorTrustFixes.test.js`
  - Proves `validateTrade()` blocks outgoing two-way players through the authoritative engine path.
  - Proves live-payload FA-exception usage is enforced through `validateTrade()`, including illegal aggregation and legal bucket-backed absorption.
  - Proves `computeWorldMutation()` threads `asOfDate` into authoritative trade validation and changes S&T season-state results by date.
  - Hits the authoritative validator/apply preflight path directly.
- `tests/trade/useTradeMachine.validatorTrust.test.ts`
  - Proves the real preview hook keeps override state separate from authoritative legality and that in-season `worldAsOfDate` blocks S&T preview legality.
  - Hits the authoritative preview path directly through `useTradeMachine`.
- `tests/tradeValidator.test.js`
  - Updated two existing S&T cases so they explicitly pass `offseason: true` while using a Jan. 20 date to isolate S&T legality from the separate Jan. 15 timing gate already enforced elsewhere.
  - This was a fixture correction, not a behavior downgrade: the old expectations relied on an in-season date for a rule family that now correctly uses canonical season-state input.

## 5. Remaining Gaps

- `validateSignAndTrade.js` and `timingValidation.js` still own overlapping S&T-related timing concepts. Live preview/apply now use the correct date context, but the broader rule split remains conceptually awkward.
- The validator result contract is still mixed-shape (`rules` contains both objects and arrays). That was outside this blocker pass.

## 6. Validation Run

- Commands run:
  - `npm run test:node -- --reporter=dot tests/tradeValidator.test.js tests/trade/validatorTrustFixes.test.js tests/trade/useTradeMachine.validatorTrust.test.ts`
  - `npm run test:trade -- --reporter=dot`
  - `npm run typecheck`
  - `npm run build`
  - `npm run validate:project`
- Result:
  - Targeted validator regressions passed.
  - Full trade suite passed: `60` files, `542` tests.
  - `typecheck` passed.
  - `build` passed. Vite emitted existing chunk-size / dynamic-import warnings only.
  - `validate:project` passed.
- Intentionally not run:
  - `npm run test:architect -- --reporter=dot`
    - Not needed once the full trade suite covered the touched authoritative validator path and the new preview/apply regressions.

## 7. Master Doc Update

- Added `TM_VALIDATOR_TRUST_FIXES_E1_RETURN_PACKAGE.md` to the Trade Machine return-package index in `docs/architect/TRADE_MACHINE_MASTER.md`.
- Added a short `Validator Trust Fixes E1 (2026-03-07)` note stating that the major validator blockers from the trust audit were fixed in the authoritative path, while broader validator cleanup remains open.
