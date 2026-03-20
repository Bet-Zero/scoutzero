# TM_VALIDATOR_TS_TRADEMACHINE_ENGINE_SHIM_BATCH_E121 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the fifth Phase 7B runtime-backed same-path cleanup batch.
- Deleted 7 `tradeMachine/engine` `.js` shims under `src/features/architect/utils/tradeMachine/engine/`.
- Retargeted live `src/**` imports, trade tests, and Architect guardrails to extensionless paths or TS-authority checks for those engine modules.
- Added a dedicated E121 guardrail proving deleted-path absence plus representative extensionless/authority parity.

## 2. Closed Scope Confirmation
- This pass stayed inside the `tradeMachine/engine` same-path shim batch.
- Deleted shims were limited to same-path engine re-export hosts for `engineUtils`, `performanceMonitor`, `tradeDebug`, `tradeValidator`, `validationDebugMonitor`, `validationPerformanceMonitor`, and `validationUtils`.
- `src/features/architect/utils/tradeMachine/engine/index.js` remained intact as the intentional barrel surface, but now resolves through extensionless specifiers instead of deleted `.js` engine hosts.
- `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx` was retargeted because `tradeDebug.js` moved from “kept pure shim” to “intentionally deleted shim path” in this batch.
- No `tradeMachine/cache/*.js`, persistence-contract helper, shared-contract helper, `tradeContext/legacy/index.js`, or mixed/structural keeper file was retired in this pass.

## 3. Files Changed
Deleted runtime-backed same-path shims:
- `src/features/architect/utils/tradeMachine/engine/{engineUtils.js,performanceMonitor.js,tradeDebug.js,tradeValidator.js,validationDebugMonitor.js,validationPerformanceMonitor.js,validationUtils.js}`

Runtime/test import-retarget and guardrail updates:
- `src/features/architect/utils/tradeMachine/{MIGRATION_NOTES.md,index.js}`
- `src/features/architect/utils/tradeMachine/engine/{index.js,tradeValidator.ts,validationDebugMonitor.ts,validationPerformanceMonitor.ts,validationUtils.ts,validatorDebug.ts}`
- `src/features/architect/utils/tradeMachine/validators/{index.js}`
- `src/tests/architect/{grouped33FileScope.compatibility.guardrail.test.tsx,phase15_trade_payload_entitlements_only_guardrail.test.js,tradeEntitlementExclusivity.unavailable.test.ts,tradeEntitlementRouting.test.ts,tradeMachineEngineShimBatch.e121.guardrail.test.ts}`
- `src/tests/trade/{P0_hardCapSkip_worldless.guardrail.test.js,goldenTrades.test.js}`
- `src/tests/tradeMachine/{hardCap_reasonParity.guardrail.test.ts,signAndTrade.failClosed.guardrail.test.ts,validationUtils.contract.test.ts}`
- `tests/{regression.secondApron.js,setupDebug.js,tradeValidatorEdgeCases.test.js,validationPerformance.test.js}`
- `tests/trade/{cashLedger_season_tracking.test.js,consent_and_reacq.test.js,frozenPick_consequences.test.js,hardCap_trigger_faException.test.js,input_validation.test.js,jan15_offseason_timing.test.js,orderOfOps_conversionsBeforeMatching.test.js,rosterLegality_validateTrade.test.js,rosterValidation_surface.test.js,roster_twoWay_enforcement.test.js,salaryMatching.test.js,secondApron_tpeBan.test.js,signAndTrade_completeness.test.js,timingEnforcement_authoritative.test.js,tpe_absorption_fail_closed.test.js,tpe_creation_expiry_usage.test.js,validation_caching.test.js,validatorContractCleanup.test.js,validatorTrustFixes.test.js}`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_TRADEMACHINE_ENGINE_SHIM_BATCH_E121_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- The retired `tradeMachine/engine` shim paths are now intentionally absent, and the preserved internal contract for those modules is extensionless resolution to the TS authority.
- `src/tests/architect/tradeMachineEngineShimBatch.e121.guardrail.test.ts` proves deleted-path absence and representative extensionless/authority parity across all 7 retired engine surfaces.
- `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx` now treats `tradeDebug.js` as intentionally absent while still proving default-only parity across the extensionless import and the TS authority.
- `src/features/architect/utils/tradeMachine/index.js`, `src/features/architect/utils/tradeMachine/validators/index.js`, and `src/features/architect/utils/tradeMachine/engine/index.js` now resolve through extensionless engine specifiers instead of deleted `.js` engine hosts.
- `src/features/architect/utils/tradeMachine/engine/index.js` no longer contains the stale nonexistent `tradeValidator.debug.js` export.

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
  - Coverage result: 198 files, 2726 tests passed
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
- Next Phase 7B batch: `tradeMachine/cache` same-path runtime-backed shims.
- Remaining Phase 7B runtime-backed clusters after that: persistence-contract helpers and shared contract helpers.
- Phase 7C mixed/structural keeper review remains open.
- Phase 7D wrapper/barrel/public-entry cleanup remains open.
- Phase 7E final Architect JS/JSX inventory gate remains open.
