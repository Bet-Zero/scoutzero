# TM_VALIDATOR_TS_PERSISTENCE_CONTRACT_SHIM_BATCH_E123 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the seventh Phase 7B runtime-backed same-path cleanup batch.
- Deleted 4 `persistenceContracts` `.js` shims under `src/features/architect/utils/persistenceContracts/`.
- Retargeted live `src/**` imports, smoke tests, and Architect guardrails to extensionless paths or TS-authority checks for those persistence-contract modules.
- Added a dedicated E123 guardrail proving deleted-path absence plus representative extensionless/authority parity.
- Smoke validation exposed 5 residual explicit `tradeMachine/cache` `.js` imports in engine/validator surfaces, and those imports were also retired extensionlessly in-batch.
- Architect UI smoke exposed season-code `yearKey` handling in `TradeTeamCard.tsx`; that path now normalizes season inputs before calling `computeTeamCapTotals`, preventing `NaN` cap-profile crashes.

## 2. Closed Scope Confirmation
- This pass stayed inside the Phase 7B persistence-contract same-path shim batch plus the directly exposed residual import fallout from the already-retired cache batch.
- Deleted shims were limited to same-path re-export hosts for `contracts`, `enforcement`, `normalizeTeamTpe`, and `validatePersistableShape`.
- `src/features/architect/utils/persistenceContracts/index.js` remained intact as the intentional barrel surface, but now resolves through extensionless specifiers instead of deleted `.js` persistence-contract hosts.
- No shared-contract helper, `tradeContext/legacy/index.js`, or mixed/structural keeper file was retired in this pass.

## 3. Files Changed
Deleted runtime-backed same-path shims:
- `src/features/architect/utils/persistenceContracts/{contracts.js,enforcement.js,normalizeTeamTpe.js,validatePersistableShape.js}`

Runtime/test import-retarget, guardrail, and smoke updates:
- `src/features/architect/tradeMachine/TradeTeamCard.tsx`
- `src/features/architect/utils/persistenceContracts/{enforcement.ts,index.js,validatePersistableShape.ts}`
- `src/features/architect/utils/tradeMachine/engine/{performanceMonitor.ts,validationDebugMonitor.ts,validationPerformanceMonitor.ts,validationUtils.ts}`
- `src/features/architect/utils/tradeMachine/utils/{normalizeTradeInput.ts,tpeValidation.ts}`
- `src/features/architect/utils/tradeMachine/validators/index.js`
- `src/tests/architect/{persistenceContractsShimBatch.e123.guardrail.test.ts,phase61_persistence_contract_allowlist_guardrails.test.js,phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js,phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js,phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js,phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js,phase67_migration_execution_guardrails.test.js,phase75_room_exception_auto_eligibility_guardrails.test.js}`
- `tests/smoke/helperFoundationImports.smoke.test.ts`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_PERSISTENCE_CONTRACT_SHIM_BATCH_E123_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- The retired `persistenceContracts` shim paths are now intentionally absent, and the preserved internal contract for those modules is extensionless resolution to the TS authority.
- `src/tests/architect/persistenceContractsShimBatch.e123.guardrail.test.ts` proves deleted-path absence and representative extensionless/authority parity across all 4 retired persistence-contract surfaces.
- `tests/smoke/helperFoundationImports.smoke.test.ts` now proves the shared persistence-contract surface through the barrel and extensionless direct imports without requiring explicit `.js` hosts to exist.
- `src/features/architect/utils/persistenceContracts/index.js` now resolves through extensionless persistence-contract specifiers instead of deleted `.js` shim hosts.
- The residual cache-import cleanup ensures the earlier E122 cache retirement is now reflected in live engine/validator runtime imports as well as the original guardrail coverage.
- `src/features/architect/tradeMachine/TradeTeamCard.tsx` now normalizes season-code `yearKey` values before cap-profile computation, which removes the `NaN` crash exposed by Architect UI smoke while preserving the intended totals calculation flow.

## 5. Validation / Inspection Run
Validation commands actually run:
- `npm run typecheck`
  - Result: PASS
- `npm run build`
  - Result: PASS
  - Notes: pre-existing warnings only for stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
- `npm run test:fast -- --reporter=dot`
  - Result: PASS
  - Coverage result: 12 files, 57 tests passed
  - Note: run in-batch because smoke coverage exposed the residual cache-import fallout and the `TradeTeamCard` season-key crash
- `npm run test:diff -- --reporter=dot`
  - Result: PASS
  - Selected tier: `ARCHITECT`
  - Coverage result: 200 files, 2738 tests passed
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
- Next Phase 7B batch: shared contract helper same-path shims.
- Remaining Phase 7B cleanup after that: still-intentional top-level data/wrapper surfaces and wrapper/barrel/public-entry cleanup.
- Phase 7C mixed/structural keeper review remains open.
- Phase 7D wrapper/barrel/public-entry cleanup remains open.
- Phase 7E final Architect JS/JSX inventory gate remains open.
