# TM_VALIDATOR_TS_TRADEMACHINE_RULES_SHIM_BATCH_E120 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the fourth Phase 7B runtime-backed same-path cleanup batch.
- Deleted 21 `tradeMachine/rules` `.js` shims under `src/features/architect/utils/tradeMachine/rules/`.
- Retargeted live `src/**` imports, trade tests, and Architect guardrails to extensionless paths or TS-authority checks for those rule modules.
- Added a dedicated E120 guardrail proving deleted-path absence plus representative extensionless/authority parity.

## 2. Closed Scope Confirmation
- This pass stayed inside the `tradeMachine/rules` same-path shim batch.
- Deleted shims were limited to same-path rule re-export hosts for `basicRules`, `draftRules`, `enforceConsent`, `enforcement`, `hardCapValidation`, `miscRules`, `rosterValidation`, `timingValidation`, `tradeExceptions`, `validateAggregation`, `validateCash`, `validateConsent`, `validateEligibility`, `validateEntitlementRouting`, `validateFaExceptionUsage`, `validatePlayerRouting`, `validateReacquisition`, `validateSalaryMatching`, `validateSignAndTrade`, `validateStepien`, and `validateTradeExceptions`.
- `src/features/architect/utils/tradeMachine/rules/index.js` remained intact as the intentional barrel surface.
- `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js` remained intact as the intentional wrapper surface, but now resolves through the extensionless authority import.
- No `tradeMachine/engine/*.js`, `tradeMachine/cache/*.js`, persistence-contract helper, shared-contract helper, `tradeContext/legacy/index.js`, or mixed/structural keeper file was retired in this pass.

## 3. Files Changed
Deleted runtime-backed same-path shims:
- `src/features/architect/utils/tradeMachine/rules/{basicRules.js,draftRules.js,enforceConsent.js,enforcement.js,hardCapValidation.js,miscRules.js,rosterValidation.js,timingValidation.js,tradeExceptions.js,validateAggregation.js,validateCash.js,validateConsent.js,validateEligibility.js,validateEntitlementRouting.js,validateFaExceptionUsage.js,validatePlayerRouting.js,validateReacquisition.js,validateSalaryMatching.js,validateSignAndTrade.js,validateStepien.js,validateTradeExceptions.js}`

Runtime/test import-retarget and guardrail updates:
- `src/features/architect/utils/{stepienUtils.ts}`
- `src/features/architect/utils/tradeMachine/{MIGRATION_NOTES.md,index.js}`
- `src/features/architect/utils/tradeMachine/engine/{tradeValidator.ts}`
- `src/features/architect/utils/tradeMachine/rules/{draftRules.ts,enforceEligibility.js,enforcement.ts,index.js,miscRules.ts,validateEligibility.ts}`
- `src/features/architect/utils/tradeMachine/validators/{index.js}`
- `src/tests/architect/{batchB_cbaRules.test.js,phase17_entitlement_routing_guardrail.test.js,phase43_apron_drift_prevention_guardrails.test.js,phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js,tradeEntitlementRouting.test.ts,tradeMachineRulesShimBatch.e120.guardrail.test.ts}`
- `src/tests/trade/{P0_hardCapSkip_worldless.guardrail.test.js,hardCapSkip_strict_boolean.guardrail.test.js,hardCap_salaryMatching.guardrail.test.js,playerRouting.test.js,secondApron_SSOT_guardrail.test.js,tpe_perPlayer.guardrail.test.js,validatorContractConsumers.test.jsx}`
- `src/tests/tradeMachine/{draftPicksPreflight.test.js,stepienObligations.test.js}`
- `tests/{hasStepienViolation.test.js,salaryMatchingUnification.test.js,tradeExceptions.test.js,tradeValidator.test.js}`
- `tests/trade/{basicRules.test.ts,cashLedger_season_tracking.test.js,consent_and_birdVeto.test.js,consent_and_reacq.test.js,draftRules_surface.test.ts,faExceptions_as_trade_buckets.test.js,jan15_offseason_timing.test.js,miscRules.test.ts,reacquisition_bar.test.js,rosterValidation_surface.test.js,rosterWindow_softEnforcement.test.js,salaryMatching.test.js,secondApron_tpeBan.test.js,timingGates_softEnforcement.test.js,tpe_absorption_fail_closed.test.js,tradeExceptions_surface.test.ts,validateAggregation.test.ts}`
- `tests/validators/{salaryMatching.test.js,stepien.test.js,stepienEntitlementBaseline.test.js,stepienEntitlements.test.js}`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_TRADEMACHINE_RULES_SHIM_BATCH_E120_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- The retired `tradeMachine/rules` shim paths are now intentionally absent, and the preserved internal contract for those modules is extensionless resolution to the TS authority.
- `src/tests/architect/tradeMachineRulesShimBatch.e120.guardrail.test.ts` proves deleted-path absence and representative extensionless/authority parity across the retired rule surface, including `validateSalaryMatching`, `hardCapValidation`, `validateStepien`, `validateAggregation`, `validateTradeExceptions`, `basicRules`, `timingValidation`, `validateEligibility`, `validateConsent`, `validateEntitlementRouting`, `validatePlayerRouting`, `draftRules`, and `enforcement`.
- The first `npm run test:diff -- --reporter=dot` pass surfaced one expectation mismatch in the new `timingValidation` clause; the guardrail was corrected to match the real TS authority export surface (`enforceTiming`, `enforceTimingGates`, `enforceTimingLegacy`, `validateTiming`, `validateTimingLegacy`) and rerun cleanly.
- `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js` and `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` now point at TS authorities instead of deleted rule shim paths.
- `src/features/architect/utils/tradeMachine/rules/index.js` and `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js` remain in place, but both now resolve through extensionless imports rather than deleted `.js` rule hosts.

## 5. Validation / Inspection Run
Validation commands actually run:
- `npm run typecheck`
  - Result: PASS
- `npm run build`
  - Result: PASS
  - Notes: pre-existing warnings only for stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
- `npm run test:diff -- --reporter=dot`
  - Result: PASS after one in-batch rerun to correct the new `timingValidation` guardrail expectation
  - Selected tier: `ARCHITECT`
  - Final coverage result: 197 files, 2717 tests passed
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
- Next Phase 7B batch: `tradeMachine/engine` same-path runtime-backed shims.
- Remaining Phase 7B runtime-backed clusters after that: `tradeMachine/cache`, persistence-contract helpers, and shared contract helpers.
- Phase 7C mixed/structural keeper review remains open.
- Phase 7D wrapper/barrel/public-entry cleanup remains open.
- Phase 7E final Architect JS/JSX inventory gate remains open.
