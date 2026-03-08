# TM_VALIDATOR_TS_SIGN_AND_TRADE_E9 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative S&T rule surface into TypeScript via `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.ts`.
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js` is now a pure re-export-only compatibility shim with no remaining business logic.
- Behavior was preserved in the authoritative path: offseason-only legality, S&T Jan. 15 ownership, source/destination validation, contract payload completeness, S&T-specific aggregation restrictions, taxpayer-MLE receiver restriction, and receiving-team hard-cap consequence all remain on the S&T rule surface.
- `tradeValidator.js` remained JS by scope. No engine refactor was required.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.ts`
  - New authoritative TS implementation for the live S&T validator rule surface with canonical `ValidationIssue[]` output.
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
  - Reduced to a pure compatibility re-export shim.
- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts`
  - Hardened only the exported helper contracts directly consumed by the authoritative S&T rule path.
- `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`
  - Added canonical issue-envelope assertions and a direct authoritative receiver hard-cap rule assertion.
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
  - Added explicit validator-to-apply parity assertions for the receiver hard-cap consequence.
- `tests/signAndTradeAggregation.test.js`
  - Refreshed stale S&T fixtures to match the authoritative fail-closed contract and updated assertions to canonical issue access.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E9 indexed entry and updated active S&T SSOT references to the TS-backed rule surface.
- `return_packages/trade_machine/TM_VALIDATOR_TS_SIGN_AND_TRADE_E9_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `SignAndTradeContractLike`
  - Minimal exported contract-like input shape for the authoritative S&T helper path.
  - Applies to `resolveSignAndTradeContractPayload()` and `validateSignAndTradeContractPayload()`.
- `SignAndTradeNormalizedContract`
  - Normalized S&T contract payload with canonical `salariesByYear`, `contractYears`, and `firstYearGuaranteed`.
  - Applies to the authoritative S&T contract completeness path and the new TS rule module.
- `SignAndTradeCapHold`
  - Minimal exported cap-hold shape used by authoritative S&T eligibility checks.
  - Applies only to `isSignAndTradeEligible()` input typing.
- `SignAndTradePlayerLike`
  - Minimal exported player/contract-carrier shape for authoritative S&T helper consumption.
  - Applies to `isSignAndTradeEligible()`, `resolveSignAndTradeContractPayload()`, and `getSignAndTradeSalaryForYear()`.
- `SignAndTradeValidationResult`
  - Local TS rule result shape built on canonical `ValidationIssue[]`, plus `hardCapped` and S&T detail flags.
  - Applies only inside `validateSignAndTrade.ts`.

## 4. Migration Work Completed
- `validateSignAndTrade.ts`
  - Ported the authoritative S&T rule logic 1:1 into TS.
  - Preserved current ownership of offseason legality, S&T Jan. 15, outgoing/incoming S&T aggregation, taxpayer-MLE receiver blocking, source-team checks, destination checks, contract completeness, and receiver hard-cap consequence.
  - Minimal contract correction from typing: the rule now emits canonical `ValidationIssue[]` directly instead of relying on downstream string normalization, while keeping the same user-facing message text.
- `validateSignAndTrade.js`
  - Converted to a pure re-export shim only.
- `signAndTradeEligibility.ts`
  - Narrowly hardened the exported helper contracts used by the live authoritative S&T rule path.
  - Minimal contract correction from typing: explicitly modeled the legacy dual-shape `signAndTrade` payload so the authoritative helper path can safely read either the boolean flag or the nested legacy contract carrier without widening cleanup beyond this surface.
- `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`
  - Preserved under-contract rejection, missing-contract rejection, first-year salary parity, and 3-team destination routing.
  - Added direct canonical issue-shape assertions for `rules.signAndTrade.violations[]`.
  - Added a direct authoritative rule-path hard-cap assertion showing the receiving team still becomes hard-capped through `rules.signAndTrade`.
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
  - Added parity assertions proving the authoritative S&T rule still marks the receiver hard-capped before apply and that apply still persists the same hard-cap consequence fields.
- `tests/signAndTradeAggregation.test.js`
  - Fixture corrections classified as `fixture no longer matched the authoritative fail-closed contract`:
    - old S&T “valid” fixtures used legacy under-contract stand-ins instead of free-agent/S&T-contract payloads on the authoritative tradeMachine path
    - old fixtures did not pin a post-Jan.-15 date even when the test intended a valid S&T case
  - Assertion corrections classified as `assertion depended on outdated raw-string issue access`:
    - old checks used `teamResults[i].violations` as if it were `string[]`
    - refreshed checks now read canonical issue text through `getValidationIssueText()` / `issue.message`

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Remains JS because this pass only required typed consumption of the S&T rule module; no engine refactor was needed.
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
  - Remains JS because E9 intentionally preserved the current S&T-owned hard-cap consequence boundary instead of broadening into the adjacent hard-cap rule surface.
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.js`
  - Remains JS because the S&T aggregation ownership stayed in `validateSignAndTrade.ts`; broader aggregation-module migration was out of scope.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/signAndTrade_completeness.test.js tests/trade/jan15_offseason_timing.test.js tests/signAndTradeAggregation.test.js src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts tests/trade/validatorTrustFixes.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS rule module and narrowed helper contracts interoperate with the live validator path.
  - The targeted node suite proves authoritative S&T contract completeness, S&T Jan. 15 ownership staying out of generic timing, S&T aggregation enforcement, canonical `rules.signAndTrade` envelope compatibility, authoritative apply-path S&T legality behavior, and receiver hard-cap consequence parity between validator and apply.
  - `validate:project` proves the added TS file and updated module/doc structure remain valid for project schema rules.
- Results:
  - PASS.
- Commands intentionally skipped:
  - `npm run build`
  - broader `npm run test:trade -- --reporter=dot`
  - broader `npm run test:architect -- --reporter=dot`
  - full-suite commands
  - Reason: this pass was limited to the authoritative validator S&T slice, and the targeted node suite already covered the live S&T validator/apply surfaces changed by E9.

## 7. Remaining TS Migration Queue
- Next best slice: `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
- Reason: E9 intentionally preserved the current S&T-owned receiver hard-cap consequence behavior, so the adjacent authoritative hard-cap/apron surface is now the most natural remaining JS-backed validator rule boundary.

## 8. Master Doc Update
- Added `Validator TS Sign-And-Trade E9 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the active authoritative S&T rule logic now lives in `rules/validateSignAndTrade.ts`.
- Recorded that `validateSignAndTrade.js` is now a pure compatibility shim.
- Reaffirmed that the S&T vs generic timing ownership split is unchanged.
- Updated active S&T SSOT references and noted that the next migration slice should be `hardCapValidation.js`.
