# TM_VALIDATOR_TS_RULES_E5 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the post-E4 authoritative TPE helper/rule surface into TS with `tpeValidation.ts` as the single TPE implementation site and `validateTradeExceptions.ts` as the authoritative typed rule module.
- Migrated only the authoritative cash-rule surface into TS with `validateCash.ts`; `eligibilityRules.js` remains a JS compatibility host for adjacent non-cash functions that were intentionally out of scope.
- Behavior was preserved across the targeted authoritative preview/apply and direct-rule regression set.
- Some directly related files remained JS by design:
  - `tradeUtilities.js` is now a pure compatibility barrel.
  - `eligibilityRules.js` is a compatibility host for the non-cash functions that were not migrated in this pass.
  - `tradeValidator.js` remains JS because this pass was rule-surface-only.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/tpeValidation.ts`
  - Added the typed single implementation for the migrated TPE helper surface.
- `src/features/architect/utils/tradeMachine/utils/tpeValidation.js`
  - Added a JS compatibility shim so existing JS import sites can resolve the new TS helper surface cleanly.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js`
  - Moved the non-TPE utility helpers out of `tradeUtilities.js`.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Reduced to a pure compatibility re-export barrel with no duplicated TPE logic.
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.ts`
  - Added the authoritative typed TPE rule implementation using canonical `ValidationIssue` output.
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
  - Replaced with a thin JS compatibility re-export so the existing import path and guardrail allowlist remain stable.
- `src/features/architect/utils/tradeMachine/rules/validateCash.ts`
  - Added the authoritative typed seasonal cash-limit / second-apron cash rule implementation.
- `src/features/architect/utils/tradeMachine/rules/validateCash.js`
  - Added a JS compatibility shim for the new cash rule module.
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
  - Kept the non-cash functions in place and re-exported the new typed `validateCash`.
- `src/features/architect/utils/tradeMachine/constants/types.ts`
  - Hardened the shared validator contract for trade exceptions, canonical TPE usage, and cash-rule results.
- `tests/tradeExceptions.test.js`
  - Updated direct TPE rule assertions to read canonical `ValidationIssue` output.
- `tests/trade/cashLedger_season_tracking.test.js`
  - Updated the direct cash helper assertion to read canonical `ValidationIssue` output.
- `tests/trade/tpe_absorption_fail_closed.test.js`
  - Updated the direct TPE rule assertions to read canonical `ValidationIssue` output.
- `tests/trade/secondApron_tpeBan.test.js`
  - Added the behavior-lock assertion proving equivalent rule outcome for live-path TPE usage vs compatibility-input TPE usage.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E5 index entry and dated status note.
- `return_packages/trade_machine/TM_VALIDATOR_TS_RULES_E5_RETURN_PACKAGE.md`
  - Added this return package.

## 3. Types Introduced or Hardened
- `TradeExceptionRecord`
  - Flexible trade-exception input/compatibility shape used for team-held TPEs, compatibility TPE input, and created-TPE payloads in the authoritative rule path.
- `NormalizedTradeExceptionRecord`
  - Canonical normalized TPE shape returned by `normalizeTpeForValidation()` and carried through canonical usage resolution.
- `TradeExceptionPlayer`
  - Minimal typed player shape for the authoritative TPE rule path, including live-path `absorptionMode`, `tpeId`, and matching salary fields.
- `CanonicalTeamTpeUsageEntry`
  - Canonical per-TPE usage envelope that makes `tpeId`, resolved TPE object, consumed players, total usage, and usage source explicit.
- `UnresolvedTpeUsage`
  - Fail-closed unresolved TPE assignment shape used to distinguish missing `tpeId` from unknown/unresolvable `tpeId`.
- `CanonicalTeamTpeUsage`
  - Canonical normalized result for available TPEs, used TPEs, unresolved players, and `usesTpe` state.
- `TradeExceptionValidationResult`
  - Canonical typed result for the authoritative TPE rule, including `ValidationIssue[]` violations plus `createdTPE`.
- `CashValidationResult`
  - Canonical typed result for the authoritative cash rule using `ValidationIssue[]`.

## 4. Migration Work Completed
- `tpeValidation.ts`
  - Moved `isPriorYearTPE`, `isCurrentSeasonTPE`, `hasPriorYearTPE`, `createTPE`, `isExpiredTPE`, `canUseTPE`, `normalizeTpeForValidation`, and `buildCanonicalTeamTpeUsage` into one TS implementation.
  - Preserved E4 behavior exactly:
    - canonical trade-date expiry behavior
    - actual live-path TPE usage plus compatibility-input resolution
    - source-ref mutation propagation for remaining balance / `isUsed`
  - Minimal contract correction required by typing:
    - introduced explicit normalized-vs-raw trade-exception typing so canonical usage resolution no longer relies on loose object assumptions.
- `validateTradeExceptions.ts`
  - Converted the authoritative TPE rule to TS and emitted canonical `ValidationIssue[]` directly.
  - Preserved E4 behavior exactly:
    - fail-closed missing/unknown `tpeId`
    - prior-year second-apron blocking
    - TPE-plus-outgoing aggregation blocking
    - expiry and capacity checks
    - created-TPE computation
  - Minimal contract correction required by typing:
    - unresolved TPE states are now explicitly typed as `missingTpeId` vs `missingOnTeam` instead of being implicit string branches.
- `validateCash.ts`
  - Extracted only the authoritative cash-rule surface into TS.
  - Preserved E4 behavior exactly:
    - authoritative `cashSent` field
    - seasonal cash-limit enforcement on `team.team.cashLedger.totalOut + cashSent`
    - distinct second-apron cash block vs seasonal-limit block
  - Minimal contract correction required by typing:
    - the rule now always returns canonical `ValidationIssue[]` even for missing trade-context failures.
- JS compatibility wiring
  - Added `tpeValidation.js` and `validateCash.js` compatibility shims and kept `validateTradeExceptions.js` as a thin re-export.
  - This was required because the validator-area JS barrels did not cleanly resolve the new TS files behind bare `.js` specifiers during the first runtime attempt.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Kept in JS as a pure compatibility barrel so the broad existing utility import surface does not churn in this narrow migration.
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
  - Kept in JS as the compatibility host for `enforceEligibility` and `validateReacquisition`, which were adjacent but intentionally out of scope.
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
  - Kept in JS as a compatibility re-export because the existing import path is referenced broadly and an architect guardrail allowlists this exact path.
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Kept in JS because this pass was restricted to the authoritative TPE and cash rule surfaces only.

## 6. Regression Coverage Run
- Commands run:
  - `npm run test:node -- --reporter=dot tests/trade/tpe_creation_expiry_usage.test.js tests/trade/tpe_absorption_fail_closed.test.js tests/trade/secondApron_tpeBan.test.js tests/trade/cashLedger_season_tracking.test.js tests/trade/validatorTrustFixes.test.js tests/tradeExceptions.test.js tests/tradeValidatorEdgeCases.test.js`
  - `npm run typecheck`
  - `npm run validate:project`
- What they prove:
  - `tpe_creation_expiry_usage.test.js`
    - canonical trade-date expiry behavior
    - live-path TPE-plus-outgoing blocking
    - created-TPE behavior
  - `tpe_absorption_fail_closed.test.js`
    - fail-closed missing `tpeId`
    - fail-closed unknown/unresolvable `tpeId`
    - valid team-held `tpeId` still succeeds
  - `secondApron_tpeBan.test.js`
    - prior-year second-apron TPE block
    - current-year allowance
    - below-apron allowance
    - behavior-lock parity between live-path player-assigned usage and optional compatibility-input usage
  - `cashLedger_season_tracking.test.js`
    - authoritative seasonal cash-limit enforcement on `cashSent`
  - `validatorTrustFixes.test.js`
    - authoritative preview/apply regression protection from E4 for TPE and cash
  - `tradeExceptions.test.js`
    - direct authoritative TPE rule still mutates remaining balance and blocks expiry/capacity/in-flight use correctly
  - `tradeValidatorEdgeCases.test.js`
    - second-apron cash blocking still works in the authoritative validator path
  - `typecheck`
    - the new TS rule/helper surface integrates cleanly with the current TS setup
  - `validate:project`
    - structural project checks remained valid after adding the new permanent files
- Results:
  - Targeted node suite passed: `7` files, `36` tests.
  - `typecheck` passed.
  - `validate:project` passed.
- Commands intentionally skipped:
  - `npm run test:diff -- --reporter=dot`
    - Skipped because the targeted validator suite is a more meaningful proof for this narrow rule-surface migration.
  - `npm run build`
    - Skipped because no UI/route/build-surface work was done.
  - `npm run lint`
    - Skipped per repo policy; lint runs only when requested because of known pre-existing noise.
  - Full-suite commands
    - Skipped because this prompt did not include `RUN FULL SUITE`.

## 7. Remaining TS Migration Queue
- Next best slice: the small authoritative consent/eligibility cluster.
- Priority targets:
  - `src/features/architect/utils/tradeMachine/rules/validateConsent.js`
  - `src/features/architect/utils/tradeMachine/rules/enforceConsent.js`
  - `src/features/architect/utils/tradeMachine/rules/validateEligibility.js`
- After that, revisit the non-cash holdouts in `eligibilityRules.js` only after they are re-validated as stable enough to type without reopening rule-design risk.

## 8. Master Doc Update
- Added `return_packages/trade_machine/TM_VALIDATOR_TS_RULES_E5_RETURN_PACKAGE.md` to the indexed Trade Machine return-package list in `docs/architect/TRADE_MACHINE_MASTER.md`.
- Added a new dated entry, `Validator TS Rules E5 (2026-03-08)`, stating:
  - the authoritative post-E4 TPE helper/rule path is now in TS
  - the authoritative `validateCash` surface now runs from TS
  - compatibility JS hosts remain in place for the live import chain
  - the next migration slice should be the small consent/eligibility cluster
