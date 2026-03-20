# TM_VALIDATOR_TS_TOP_LEVEL_HELPER_SHIM_BATCH_E118 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the second Phase 7B runtime-backed same-path cleanup batch.
- Deleted 12 top-level Architect helper `.js` shims under `src/features/architect/utils/`.
- Retargeted live `src/**` imports, tests, and retained barrel/wrapper exports to extensionless paths for those helper modules.
- Added a dedicated E118 guardrail proving deleted-path absence plus representative extensionless/authority parity.

## 2. Closed Scope Confirmation
- This pass stayed inside the top-level Architect helper shim batch.
- Deleted shims were limited to same-path helper re-export hosts for `capUtils`, `cbaConstants`, `consentUtils`, `contractUtils`, `faExceptionUtils`, `hardCapUtils`, `reacqUtils`, `seasonFormat`, `seasonUtils`, `stepienUtils`, `timingUtils`, and `tradeHelpers`.
- `playerRulesProfile/**`, `tradeMachine/rules/*.js`, `tradeMachine/engine/*.js`, `tradeMachine/cache/*.js`, persistence-contract helpers, `tradeContext/legacy/index.js`, and `shared/utils/contracts/*.js` remained intact.
- No mixed/structural keepers such as `capLegalityValidation.js`, `computeTeamCapTotals.js`, `playerRulesProfile/types.js`, or `ValidationStateHeader.jsx` were retired in this pass.

## 3. Files Changed
Deleted runtime-backed same-path shims:
- `src/features/architect/utils/{capUtils.js,cbaConstants.js,consentUtils.js,contractUtils.js,faExceptionUtils.js,hardCapUtils.js,reacqUtils.js,seasonFormat.js,seasonUtils.js,stepienUtils.js,timingUtils.js,tradeHelpers.js}`

Runtime/test import-retarget and authority updates:
- `src/features/architect/tradeMachine/TradeTeamCard.tsx`
- `src/features/architect/utils/{capHoldTransitionHelpers.ts,cbaConstants.ts,contractSalaryUtils.ts,contractUtils.ts,faExceptionUtils.ts,seasonHelpers.ts,seasonUtils.ts,stepienUtils.ts,timingUtils.ts,tradeHelpers.ts}`
- `src/features/architect/utils/playerRulesProfile/{birdRightsRules.ts,computeProfile.ts,extensionRules.ts,maxSalaryRules.ts,rfaRules.ts}`
- `src/features/architect/utils/tradeMachine/engine/{tradeDebug.ts,tradeValidator.ts}`
- `src/features/architect/utils/tradeMachine/rules/{enforceConsent.ts,hardCapValidation.ts,miscRules.ts,timingValidation.ts,validateAggregation.ts,validateConsent.ts,validateFaExceptionUsage.ts,validateSalaryMatching.ts,validateTradeExceptions.ts}`
- `src/features/architect/utils/tradeMachine/utils/{capUtils.ts,matchingValues.ts,salaryMargin.ts,validateInput.ts}`
- `src/features/architect/utils/tradeMachine/validators/index.js`
- `src/tests/architect/{consentUtils.compatibility.guardrail.test.ts,phase40_secondApron_drift_guardrails.test.js,phase42_apron_derivation_consolidation.test.js,phase43_apron_drift_prevention_guardrails.test.js,topLevelHelperShimBatch.e118.guardrail.test.ts,tradeEditorTeamCard.boundary.e105.test.tsx}`
- `src/tests/tradeMachine/swapResolution.test.js`
- `tests/smoke/{contractSeasonHelperImports.smoke.test.ts,helperFoundationImports.smoke.test.ts}`
- `tests/trade/{hardCap_trigger_faException.test.js,matchingBands_2023.test.js}`
- `tests/tradeSalaryMatching.test.js`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_TOP_LEVEL_HELPER_SHIM_BATCH_E118_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- The retired top-level helper shim paths are now intentionally absent, and the preserved internal contract for those modules is extensionless resolution to the TS authority.
- `src/tests/architect/topLevelHelperShimBatch.e118.guardrail.test.ts` proves deleted-path absence and representative extensionless/authority parity for all 12 retired helper surfaces.
- `tests/smoke/helperFoundationImports.smoke.test.ts` and `tests/smoke/contractSeasonHelperImports.smoke.test.ts` now treat the retired helper shim paths as intentionally absent while preserving explicit checks for still-kept `.js` surfaces outside this batch.
- `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js` now points at TS authorities or extensionless helper imports instead of deleted `capUtils.js` and `tradeHelpers.js` shim hosts.
- `timingUtils.ts` now directly re-exports `violatesReacquisitionBar`, preserving the timing/reacquisition export contract without the retired `timingUtils.js` and `reacqUtils.js` shim layer.

## 5. Validation / Inspection Run
Validation commands actually run:
- `npm run typecheck`
  - Result: PASS
- `npm run build`
  - Result: PASS
  - Notes: pre-existing warnings only for stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
- `npm run test:diff -- --reporter=dot`
  - Result: PASS
  - Selected tier: `ARCHITECT`
  - Coverage result: 195 files, 2694 tests passed
- `npm run test:trade -- --reporter=dot`
  - Result: PASS
  - Coverage result: 71 files, 637 tests passed
- `npm run validate:project`
  - Result: PASS

Commands intentionally skipped:
- `npm run test:architect -- --reporter=dot`
  - Skipped because `npm run test:diff -- --reporter=dot` already selected the Architect tier and passed against the touched Architect guardrails and behavior suites.
- `npm run test:full`
  - Skipped because AGENTS.md blocks full-suite runs unless the prompt contains `RUN FULL SUITE`.
- `npm run lint`
  - Skipped because repo guidance says lint is opt-in only and this execution did not require it.

## 6. Remaining Follow-Up
- Next Phase 7B batch: `playerRulesProfile/**` same-path runtime-backed shims.
- Remaining Phase 7B runtime-backed clusters after that: `tradeMachine/rules`, `tradeMachine/engine`, `tradeMachine/cache`, persistence-contract helpers, and shared contract helpers.
- Phase 7C mixed/structural keeper review remains open.
- Phase 7D wrapper/barrel/public-entry cleanup remains open.
- Phase 7E final Architect JS/JSX inventory gate remains open.
