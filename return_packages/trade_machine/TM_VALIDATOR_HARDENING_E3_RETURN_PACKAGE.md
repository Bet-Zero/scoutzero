# TM_VALIDATOR_HARDENING_E3 — EXECUTION RETURN PACKAGE

## 1. Summary

- Standardized authoritative validator `violations` / `warnings` to one canonical `ValidationIssue` item contract.
- Hardened the authoritative validator boundary so rule envelopes, team summaries, top-level failures, receipts, and wrapper failures all carry canonical issue objects instead of mixed strings/objects.
- Moved S&T-specific January 15 ownership fully into `validateSignAndTrade.js` and left generic timing ownership in `timingValidation.js`.
- Updated official consumers, debug surfaces, and regression tests so the reviewed validator path no longer depends on raw string issue arrays.
- Outcome: the authoritative validator is now clean enough for targeted TS migration to begin, starting from the shared issue/result surface rather than the whole engine at once.

## 2. Files Changed

- `src/features/architect/utils/tradeMachine/utils/validationIssueText.js`
  - Added canonical issue creation, normalization, summary, and text helpers.
- `src/features/architect/utils/tradeMachine/utils/tradeTimingWindows.js`
  - Added shared trade-date and January 15 cutoff helpers.
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Normalized authoritative issue output at the validator boundary and clarified S&T vs generic timing ownership.
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
  - Added authoritative S&T January 15 enforcement and shared timing helper usage.
- `src/features/architect/utils/tradeMachine/rules/timingValidation.js`
  - Removed S&T-specific Jan. 15 ownership and kept only generic timing rules.
- `src/features/architect/utils/tradeContext/tradeContext.js`
  - Preserved canonical issue objects through wrapper success and catch/fail paths.
- `src/features/architect/utils/tradeContext/types.js`
  - Updated JSDoc typedefs for canonical validator issues and wrapper output.
- `src/features/architect/utils/tradeMachine/constants/types.ts`
  - Added `ValidationIssue` and updated validator result types to use it.
- `src/features/architect/utils/tradeMachine/engine/validatorDebug.ts`
  - Updated debug typing/log output for canonical issue objects.
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.debug.js`
  - Rendered canonical issue text instead of raw objects.
- `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
  - Normalized issue display and moved entitlement exclusivity detail reads to `issue.meta`.
- `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`
  - Rendered receipt violations/warnings through canonical issue text helpers.
- `src/features/architect/utils/tradeMachine/rules/validateHardCap.ts`
- `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.ts`
- `src/features/architect/utils/tradeMachine/rules/validateStepien.ts`
  - Aligned TS rule result types to emit `ValidationIssue[]` instead of raw string arrays.
- `tests/trade/validatorContractCleanup.test.js`
- `tests/trade/validatorTrustFixes.test.js`
- `tests/trade/jan15_offseason_timing.test.js`
- `tests/tradeValidator.test.js`
- `tests/tradeValidatorEdgeCases.test.js`
- `tests/trade/frozenPick_consequences.test.js`
- `tests/trade/input_validation.test.js`
- `tests/trade/rosterLegality_validateTrade.test.js`
- `tests/trade/secondApronBoundary.test.js`
- `tests/trade/secondApron_tpeBan.test.js`
- `tests/trade/tpe_absorption_fail_closed.test.js`
- `tests/trade/tpe_creation_expiry_usage.test.js`
- `tests/trade/useTradeMachine.validatorTrust.test.ts`
- `src/tests/trade/validatorContractConsumers.test.jsx`
- `src/tests/trade/tradeSnapshotWiring.test.js`
- `src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts`
- `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`
  - Updated regression coverage and consumers to assert canonical issue objects via shared text helpers.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E3 entry and TS migration note.

## 3. Issue Payload Standardization

- Canonical authoritative issue items now expose one shape:
  - `message`
  - `severity`
  - `rule`
  - `code`
  - `details`
  - `meta`
- `validationIssueText.js` now converts legacy strings and legacy objects into canonical issue objects and preserves readable text through `getValidationIssueText()`.
- Deterministic fallback codes are derived when a source issue does not already provide a stable code.
- Rule-specific metadata now survives under `issue.meta` instead of leaking ad hoc top-level fields. This includes entitlement exclusivity conflict detail.
- `tradeValidator.js` now normalizes:
  - per-rule `violations` / `warnings`
  - team-level `violations` / `warnings`
  - top-level `violations` / `warnings`
  - `summaryByTeamIndex` issue summaries
  - `tradeReceipt.teams[*].violations` / `warnings`
  - fail-fast routing/input errors
- `validatePostTradeSnapshotForContext()` now preserves canonical issue objects on both success and wrapper failure paths.

## 4. S&T / Timing Ownership Changes

- Ownership is now explicit:
  - `validateSignAndTrade.js` owns S&T-specific season/timing legality.
  - `timingValidation.js` owns generic timing legality only.
- `validateSignAndTrade.js` now owns:
  - offseason-only S&T restriction
  - S&T January 15 re-trade restriction
  - source/destination ownership checks
  - S&T contract payload completeness
  - outgoing/incoming aggregation restrictions
  - taxpayer-MLE receiver restriction
  - receiving-team hard-cap consequence
- `timingValidation.js` now keeps:
  - moratorium
  - explicit `eligibleTradeDate`
  - 30-day restriction
  - December 15 newly signed FA restriction
  - January 15 recently extended player restriction
  - 3-month midseason signing restriction
  - 60-day aggregation restriction
- Shared cutoff math now lives in `tradeTimingWindows.js`, so both modules use the same date behavior without splitting rule ownership.
- Regression wording now makes the owner obvious in output:
  - S&T: `cannot be traded until January 15 (sign-and-trade)`
  - recent extension: `cannot be traded until January 15 (recent extension)`

## 5. Regression Coverage Added or Updated

- `tests/trade/validatorContractCleanup.test.js`
  - Proves authoritative rule envelopes and top-level fail-fast/wrapper paths expose canonical issue objects.
- `tests/trade/jan15_offseason_timing.test.js`
  - Proves S&T January 15 enforcement is owned by `rules.signAndTrade`, while recent-extension January 15 remains under `rules.timingEnforcement`.
- `tests/trade/validatorTrustFixes.test.js`
  - Proves authoritative as-of-date threading still changes S&T legality by date through the intended owner.
- `src/tests/trade/validatorContractConsumers.test.jsx`
  - Proves official consumer rendering still works with canonical issue objects only.
- `src/tests/trade/tradeSnapshotWiring.test.js`
  - Proves snapshot wiring prefers canonical top-level violations and cap settings.
- Updated trade/guardrail tests that previously assumed string arrays so they now assert text through `getValidationIssueText()` while keeping behavior expectations unchanged.

## 6. Remaining TS Blockers

- The authoritative validator contract is ready for targeted TS migration, but the migration should start with the shared contract layer rather than leaf rules.
- `dataWarnings` and `capSettingsWarnings` still remain separate non-`ValidationIssue` warning channels.
- Non-authoritative or legacy consumers outside the reviewed official validator path were not broadly migrated in this pass.

## 7. Validation Run

- Commands run:
  - `npm run test:node -- --reporter=dot tests/trade/validatorContractCleanup.test.js tests/trade/validatorTrustFixes.test.js tests/trade/jan15_offseason_timing.test.js tests/trade/signAndTrade_completeness.test.js tests/tradeValidator.test.js`
  - `npm run test:ui -- --reporter=dot src/tests/trade/validatorContractConsumers.test.jsx`
  - `npm run test:trade -- --reporter=dot`
  - `npm run typecheck`
  - `npm run build`
  - `npm run validate:project`
- Result:
  - Targeted node validator hardening coverage passed: `5` files, `31` tests.
  - Targeted UI consumer coverage passed: `1` file, `1` test.
  - Full trade suite passed: `61` files, `546` tests.
  - `typecheck` passed.
  - `build` passed.
  - `validate:project` passed.
- Intentionally not run:
  - `npm run test:architect -- --reporter=dot`
    - Not needed after the targeted validator node/UI gates, final full trade suite, `typecheck`, `build`, and `validate:project` all passed.
  - `npm run lint`
    - Repo policy says lint only runs when requested because the repo carries pre-existing lint noise.
- Build notes:
  - Vite emitted existing warnings about `firebaseConfig.js` dynamic/static import mixing, `entitlementResolver.ts` / `leagueInvariants.ts` chunking, browser-compat externalization of `fs` from `tradeDebug.js`, large chunk size, and stale Browserslist data.
  - No new build-blocking errors were introduced by this pass.

## 8. Master Doc Update

- Added `TM_VALIDATOR_HARDENING_E3_RETURN_PACKAGE.md` to the Trade Machine return-package index in `docs/architect/TRADE_MACHINE_MASTER.md`.
- Added a short `Validator Hardening E3 (2026-03-07)` note stating that targeted validator TS migration can now begin.
- Recorded the recommended first migration slice:
  - shared `ValidationIssue` / validator result types
  - `validationIssueText.js`
  - `tradeValidator.js`
  - `tradeContext` contract surfaces
