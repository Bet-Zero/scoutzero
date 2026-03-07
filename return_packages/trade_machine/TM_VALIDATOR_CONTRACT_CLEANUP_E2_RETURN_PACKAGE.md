# TM_VALIDATOR_CONTRACT_CLEANUP_E2 — EXECUTION RETURN PACKAGE

## 1. Summary

- Standardized the authoritative validator contract so `teamResults.rules` no longer mixes object and bare-array rule outputs.
- Standardized `validateTrade()` so fail-fast exits and normal trade evaluation now return the same canonical top-level fields.
- Fixed apply-time wrapping so `validatePostTradeSnapshotForContext()` preserves authoritative violations, warnings, metadata, and raw validation output instead of flattening or dropping them.
- Aligned the official validator consumers to read canonical fields that actually exist.
- Overall outcome: the validator contract is materially closer to TS-readiness, and the reviewed official consumers no longer depend on the old mixed-shape or nonexistent-field behavior.

## 2. Files Changed

- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Added canonical rule-envelope normalization and canonical top-level result shaping.
  - Added explicit team-result metadata needed by official consumers (`teamCode`, `incomingPlayers`, `outgoingPlayers`, `faExceptionBuckets`, `apronStatus`).
- `src/features/architect/utils/tradeMachine/utils/validationIssueText.js`
  - Added shared issue-text normalization helpers for mixed string/object violation payloads.
- `src/features/architect/utils/tradeContext/tradeContext.js`
  - Changed apply-time wrapper to preserve the full authoritative validator contract and raw result.
- `src/features/architect/utils/tradeContext/types.js`
  - Updated JSDoc typedefs to reflect the preserved canonical validator contract.
- `src/features/architect/hooks/useTradeMachineSnapshot.js`
  - Switched the official snapshot accessor to canonical top-level `capSettings` and `violations`.
- `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
  - Stopped reading nonexistent `result.failures`; now renders canonical top-level violations.
- `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
  - Updated the rule renderer to consume the canonical rule envelope and surface warnings.
- `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx`
  - Updated to read canonical team-result fields and canonical trade-exception blockers/warnings.
- `src/features/architect/tradeMachine/FaExceptionTracker.jsx`
  - Updated to read canonical FA-exception buckets, usage, blockers, and warnings.
- `tests/trade/validatorContractCleanup.test.js`
  - Added direct contract and apply-wrapper regression coverage.
- `src/tests/trade/validatorContractConsumers.test.jsx`
  - Added official-consumer regression coverage through `ValidationDetailsPanel`.
- `src/tests/trade/tradeSnapshotWiring.test.js`
  - Added snapshot-accessor regressions for canonical top-level `capSettings` and `violations`.
- `tests/trade/validatorTrustFixes.test.js`
  - Updated rule-shape expectations for canonical rule envelopes.
- `tests/trade/secondApronBoundary.test.js`
  - Updated second-apron enforcement assertions for canonical rule envelopes.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E2 entry and short status note.

## 3. Contract Changes Implemented

- Per-rule contract:
  - `tradeValidator.js` now normalizes every `teamResults.rules.*` entry through one envelope.
  - Canonical per-rule fields are now `passed`, `violations`, `warnings`, `message`, `details`, `key`, and `sourceType`, with rule-specific metadata preserved on top.
  - Bare enforcement arrays are no longer exposed in the authoritative contract.

- Top-level validator contract:
  - `validateTrade()` now returns the same canonical fields on both fail-fast and normal paths:
    - `legal`
    - `valid`
    - `error`
    - `reason`
    - `violations`
    - `warnings`
    - `teamResults`
    - `summaryByTeamIndex`
    - `performance`
    - `tradeReceipt`
    - `dataWarnings`
    - `hasDataIssues`
    - `yearKey`
    - `seasonKey`
    - `capSettings`
    - `capSettingsSource`
    - `capSettingsWarnings`
    - `asOfDate`
    - `tradeDate`
    - `offseason`

- Team-result additions:
  - Added canonical consumer-facing team fields to the authoritative result:
    - `teamCode`
    - `incomingPlayers`
    - `outgoingPlayers`
    - `faExceptionBuckets`
    - `apronStatus`
  - This was deliberate contract expansion so official panels no longer have to guess or fall back to unrelated inputs.

- Apply wrapper preservation:
  - `validatePostTradeSnapshotForContext()` now spreads the authoritative validator result and adds the required wrapper-only fields (`valid`, `validationTeams`, `_rawValidation`, `_isValidatedTradeContext`) without flattening away top-level legality data.
  - Failures thrown inside the wrapper now still produce the canonical top-level keys instead of an incomplete ad hoc object.

## 4. Consumer Alignment Changes

- `TradeSummaryPanel.jsx`
  - Uses `result.violations` for the “Why it fails” block.
  - No longer depends on nonexistent `result.failures`.

- `TradeLegalChecker.jsx`
  - Assumes the canonical per-rule envelope and renders first blocker/warning text from `violations`/`warnings`.
  - No longer drops enforcement rules due to array-vs-object branching.

- `TradeExceptionDashboard.jsx`
  - Reads canonical `teamResult.incomingPlayers`/`outgoingPlayers`.
  - Surfaces `rules.tradeExceptions.violations` and `rules.tradeExceptions.warnings` directly from the validator contract.

- `FaExceptionTracker.jsx`
  - Reads canonical `teamResult.faExceptionBuckets`, `teamResult.incomingPlayers`, `teamResult.apronStatus`, and `rules.faExceptionUsage`.
  - No longer depends on legacy `team.faExceptions` or missing `teamResult.incomingPlayers`.

- `useTradeMachineSnapshot.js`
  - Reads canonical top-level `capSettings` and `violations` directly.
  - No longer relies on receipt/debug fallback for official trade-wide metadata.

## 5. Regression Coverage Added or Updated

- `tests/trade/validatorContractCleanup.test.js`
  - Proves every authoritative rule entry is exposed through one envelope shape.
  - Proves fail-fast routing exits still return the full canonical top-level contract.
  - Proves `validatePostTradeSnapshotForContext()` preserves authoritative violations, warnings, summaries, and metadata.
  - Hits the authoritative validator and apply-wrapper path directly.

- `src/tests/trade/validatorContractConsumers.test.jsx`
  - Proves the official details panel renders canonical top-level blockers, canonical rule blockers, and canonical exception/FA-exception panel blockers.
  - Hits `ValidationDetailsPanel` and therefore the official summary, legal-checker, trade-exception, and FA-exception consumer surfaces together.

- `src/tests/trade/tradeSnapshotWiring.test.js`
  - Proves `getTradeSnapshot()` prefers canonical top-level `capSettings`.
  - Proves `getTradeSnapshot()` prefers canonical top-level `violations` when present.

- `tests/trade/validatorTrustFixes.test.js`
  - Updated to assert canonical rule-envelope structure for `eligibilityEnforcement`.

- `tests/trade/secondApronBoundary.test.js`
  - Updated to assert `secondApronEnforcement.violations` through the canonical rule envelope.

## 6. Remaining Gaps

- Individual issue payloads are still mixed strings/objects across some rule families, especially entitlement exclusivity. The envelope is standardized; the issue item payloads are not yet.
- `validateSignAndTrade.js` and `timingValidation.js` still split related timing ownership. This pass fixed contract consistency, not that design overlap.
- Non-official or legacy consumers outside the reviewed panel/accessor set were not broadly cleaned in this pass.

## 7. Validation Run

- Commands run:
  - `npm run test:node -- --reporter=dot tests/trade/validatorContractCleanup.test.js tests/trade/validatorTrustFixes.test.js tests/trade/secondApronBoundary.test.js tests/tradeValidator.test.js src/tests/trade/tradeSnapshotWiring.test.js src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js`
  - `npm run test:ui -- --reporter=dot src/tests/trade/validatorContractConsumers.test.jsx src/tests/trade/TradeValidationGating.guardrail.test.jsx`
  - `npm run test:trade -- --reporter=dot`
  - `npm run typecheck`
  - `npm run build`
  - `npm run validate:project`

- Result:
  - Targeted node validator/apply-wrapper coverage passed: `6` files, `60` tests.
  - Targeted UI consumer coverage passed: `2` files, `28` tests.
  - Full trade suite passed: `61` files, `547` tests.
  - `typecheck` passed.
  - `build` passed.
  - `validate:project` passed.

- Intentionally not run:
  - `npm run test:architect -- --reporter=dot`
    - Not needed once the authoritative validator path, apply wrapper, official consumer panel, and full trade suite were all directly covered.
  - `npm run lint`
    - Repo policy says lint is only run if asked because the repo carries pre-existing lint noise.

- Build notes:
  - Vite emitted existing warnings about `firebaseConfig.js` dynamic/static import mixing, chunk size, and browser-compat externalization of `fs` from `tradeDebug.js`.
  - No new build-blocking errors were introduced by this pass.

## 8. Master Doc Update

- Added `TM_VALIDATOR_CONTRACT_CLEANUP_E2_RETURN_PACKAGE.md` to the Trade Machine return-package index in `docs/architect/TRADE_MACHINE_MASTER.md`.
- Added a short `Validator Contract Cleanup E2 (2026-03-07)` note stating that the authoritative validator contract and official consumers were aligned, while mixed issue payloads and S&T timing ownership remain TS blockers.
