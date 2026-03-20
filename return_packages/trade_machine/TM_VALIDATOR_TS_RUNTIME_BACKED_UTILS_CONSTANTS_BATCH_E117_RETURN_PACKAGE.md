# TM_VALIDATOR_TS_RUNTIME_BACKED_UTILS_CONSTANTS_BATCH_E117 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the first Phase 7B runtime-backed same-path cleanup batch.
- Deleted 17 runtime-backed same-path `.js` shims under `src/features/architect/utils/tradeMachine/utils/` and `src/features/architect/utils/tradeMachine/constants/`.
- Retargeted live `src/**` imports, tests, and retained barrel/wrapper exports to extensionless paths for those utilities/constants.
- Added a dedicated E117 guardrail proving deleted-path absence plus representative extensionless/authority parity.

## 2. Closed Scope Confirmation
- This pass stayed inside the `tradeMachine/utils` + `tradeMachine/constants` runtime-backed batch.
- Deleted shims were limited to pure same-path re-export hosts for the retired utils/constants surface.
- `capSettingsProvider.js` and `hardCapStatus.js` remained intact.
- No top-level Architect helper shim was deleted in this pass.
- No `playerRulesProfile/**`, `tradeMachine/rules/*.js`, `tradeMachine/engine/*.js`, `tradeMachine/cache/*.js`, `tradeContext/legacy/index.js`, or `shared/utils/contracts/*.js` shim was deleted in this pass.
- Retained wrapper/barrel/public entry files (`tradeMachine/index.js`, `tradeMachine/utils/index.js`, `tradeMachine/validators/index.js`) were updated only to use extensionless internal specifiers.

## 3. Files Changed
Deleted runtime-backed same-path shims:
- `src/features/architect/utils/tradeMachine/constants/{cbaConstants.js,secondApronMessages.js}`
- `src/features/architect/utils/tradeMachine/utils/{capUtils.js,conveyanceResolution.js,dataValidation.js,matchingValues.js,pickIdUtils.js,salaryMargin.js,salaryMatchingRules.js,salaryUtils.js,seasonUtils.js,stepienEntitlementUtils.js,swapResolution.js,tpeValidation.js,tradeTimingWindows.js,tradeUtilityMisc.js,validationIssueText.js}`

Runtime/barrel import-retarget sources:
- `src/features/architect/tradeMachine/{FaExceptionTracker.tsx,TradeExceptionDashboard.tsx,TradeLegalChecker.tsx,TradeReceiptPanel.tsx,TradeSummaryPanel.tsx,TradeTeamCard.tsx}`
- `src/features/architect/utils/{capUtils.ts,cbaConstants.ts,mutationPipeline.ts,seasonManager.ts,stepienUtils.ts,tradeHelpers.ts}`
- `src/features/architect/utils/tradeContext/tradeContext.ts`
- `src/features/architect/utils/entitlements/dare/{conveyanceResolutionAdapter.ts,swapResolutionAdapter.ts}`
- `src/features/architect/utils/tradeMachine/MIGRATION_NOTES.md`
- `src/features/architect/utils/tradeMachine/constants/cbaConstants.ts`
- `src/features/architect/utils/tradeMachine/engine/{tradeDebug.ts,tradeValidator.ts,validatorDebug.ts}`
- `src/features/architect/utils/tradeMachine/index.js`
- `src/features/architect/utils/tradeMachine/rules/{basicRules.js,basicRules.ts,draftRules.ts,miscRules.ts,timingValidation.ts,tradeExceptions.ts,validateAggregation.ts,validateCash.ts,validateConsent.ts,validateEligibility.ts,validateReacquisition.ts,validateSalaryMatching.ts,validateSignAndTrade.ts,validateStepien.ts,validateTradeExceptions.ts}`
- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts`
- `src/features/architect/utils/tradeMachine/utils/{conveyanceResolution.ts,index.js,matchingValues.ts,normalizeTradeInput.ts,salaryMargin.ts,salaryUtils.ts}`
- `src/features/architect/utils/tradeMachine/validators/index.js`

Guardrails and tests retargeted or added:
- `src/tests/architect/{batchB_cbaRules.test.js,dataValidation.test.js,legacyMatchingValue.test.js,phase42_apron_derivation_consolidation.test.js,phase43_apron_drift_prevention_guardrails.test.js,runtimeBackedUtilsConstantsBatch.e117.guardrail.test.ts,seasonAdvance_postStateValidator_failClose.behavior.test.ts,tradeApply_timingWarnings.behavior.test.ts,tradeEditorTeamCard.boundary.e105.test.tsx,tradeEntitlementExclusivity.unavailable.test.ts,utils/seasonManager.tpe.test.js}`
- `src/tests/trade/{goldenTrades.test.js,secondApron_SSOT_guardrail.test.js,tradeSnapshotWiring.test.js,validatorContractConsumers.test.jsx}`
- `src/tests/tradeMachine/{conveyancePreflight.test.js,draftPicksPreflight.test.js,hardCap_reasonParity.guardrail.test.ts,pickIdUtils.test.js,signAndTrade.failClosed.guardrail.test.ts,swapResolution.test.js,validationIssueText.contract.test.ts}`
- `tests/{capUtils.test.js,newSchemaValidation.test.js,salaryMargin.test.js,salaryMatchingRules.test.js,salaryMatchingUnification.test.js,salaryUtils.test.js,seasonUtils.test.js,signAndTradeAggregation.test.js,tradeExceptions.test.js,tradeValidator.test.js,tradeValidatorEdgeCases.test.js}`
- `tests/entitlements/entitlementTrading.test.js`
- `tests/smoke/{imports.smoke.test.js,utilities.smoke.test.js}`
- `tests/trade/{basicRules.test.ts,byc_outgoing_max.test.js,cashLedger_season_tracking.test.js,consent_and_reacq.test.js,firstApron_100pct.test.js,frozenPick_consequences.test.js,input_validation.test.js,jan15_offseason_timing.test.js,poisonPill_average.test.js,reacquisition_bar.test.js,rosterLegality_validateTrade.test.js,secondApronBoundary.test.js,secondApron_tpeBan.test.js,timingEnforcement_authoritative.test.js,tpe_absorption_fail_closed.test.js,tpe_creation_expiry_usage.test.js,tradeKicker_proration.test.js,tradeKicker_zeroGuarantee.test.js,tradeUtilityMisc_surface.test.js,useTradeMachine.validatorTrust.test.ts,validateAggregation.test.ts,validatorContractCleanup.test.js,validatorTrustFixes.test.js}`
- `tests/validators/{hardCap.test.js,stepienEntitlementBaseline.test.js,stepienEntitlements.test.js}`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_RUNTIME_BACKED_UTILS_CONSTANTS_BATCH_E117_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- The retired utils/constants shim paths are now intentionally absent, and the preserved internal contract for those modules is extensionless resolution to the TS authority.
- `src/tests/architect/runtimeBackedUtilsConstantsBatch.e117.guardrail.test.ts` now proves deleted-path absence and representative extensionless/authority parity for `capUtils`, `secondApronMessages`, `validationIssueText`, and `pickIdUtils`.
- `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js` now allowlists the `.ts` authorities instead of the deleted `capUtils.js`, `salaryMargin.js`, and `salaryMatchingRules.js` shim paths.
- The retained barrel/wrapper surfaces continue to exist, but their internal exports now point at extensionless utils/constants specifiers instead of deleted `.js` shim hosts.

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
  - Coverage result: 194 files, 2680 tests passed
- `npm run test:trade -- --reporter=dot`
  - Result: PASS
  - Coverage result: 71 files, 637 tests passed
- `npm run validate:project`
  - Result: PASS

Commands intentionally skipped:
- `npm run test:architect -- --reporter=dot`
  - Skipped because `npm run test:diff -- --reporter=dot` already selected the Architect tier and passed against the touched runtime-backed guardrails and behavior suites.
- `npm run test:full`
  - Skipped because AGENTS.md blocks full-suite runs unless the prompt contains `RUN FULL SUITE`.
- `npm run lint`
  - Skipped because repo guidance says lint is opt-in only and this execution did not require it.

## 6. Remaining Follow-Up
- Next Phase 7B batch: top-level Architect helper shims (`capUtils.js`, `cbaConstants.js`, `contractUtils.js`, `faExceptionUtils.js`, `seasonUtils.js`, `stepienUtils.js`, `tradeHelpers.js`, related helpers).
- Remaining Phase 7B runtime-backed clusters after that: `playerRulesProfile/**`, `tradeMachine/rules`, `tradeMachine/engine`, `tradeMachine/cache`, persistence-contract helpers, and shared contract helpers.
- Phase 7C mixed/structural keeper review remains open.
- Phase 7D wrapper/barrel/public-entry cleanup remains open.
- Phase 7E final Architect JS/JSX inventory gate remains open.
