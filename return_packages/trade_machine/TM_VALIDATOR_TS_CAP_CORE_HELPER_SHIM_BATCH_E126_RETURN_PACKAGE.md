# TM_VALIDATOR_TS_CAP_CORE_HELPER_SHIM_BATCH_E126 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the first Phase 7C mixed/structural keeper retirement batch.
- Deleted 2 retired helper shims: `capLegalityValidation.js` and `capTotals/computeTeamCapTotals.js`.
- Rewrote the affected smoke tests and Architect guardrails to the new contract: deleted path absent, extensionless import resolves to the TS authority, and the retained `capTotals` barrel still aligns with the authority exports.
- Added a dedicated E126 guardrail proving exact deleted-path coverage and extensionless/authority parity.

## 2. Closed Scope Confirmation
- This pass stayed inside the cap-core helper shim batch.
- Deleted files were limited to `src/features/architect/utils/capLegalityValidation.js` and `src/features/architect/utils/capTotals/computeTeamCapTotals.js`.
- No live runtime helper such as `capSettingsProvider.js` or `hardCapStatus.js` was retired in this pass.
- No trade-context legacy surface, route/public-entry wrapper, or mixed UI shim (`DraftPositionsInput.jsx`, `EntitlementPicksList.jsx`, `ValidationStateHeader.jsx`) was changed in this batch.

## 3. Files Changed
Deleted helper shims:
- `src/features/architect/utils/capLegalityValidation.js`
- `src/features/architect/utils/capTotals/computeTeamCapTotals.js`

Test and guardrail retargets:
- `src/tests/architect/{batchB_cbaRules.test.js,capCoreHelperShimBatch.e126.guardrail.test.ts,capSheetFull_ssot_parity_guardrails.test.js,phase73_tile_reactivity_and_totals_drift_guardrails.test.js,phase75_room_exception_auto_eligibility_guardrails.test.js,phase83_live_pipeline_mutations_and_season_advance_emulator_e2e.test.js,season_advance_bridge_gate_guardrails.test.js}`
- `tests/smoke/{capLegalityValidationImports.smoke.test.ts,helperFoundationImports.smoke.test.ts}`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_CORE_HELPER_SHIM_BATCH_E126_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- `capLegalityValidation.js` and `computeTeamCapTotals.js` are now intentionally absent.
- The preserved internal contract for both helpers is extensionless importing backed by the TS authorities `capLegalityValidation.ts` and `computeTeamCapTotals.ts`.
- `src/tests/architect/capCoreHelperShimBatch.e126.guardrail.test.ts` proves the exact 2-file deletion batch, extensionless/authority parity for both helper surfaces, and continued `capTotals/index.js` barrel alignment.
- The touched older guardrails and smoke suites no longer require shim-file existence; they now validate the authority surface directly or assert the deleted path is absent.

## 5. Validation / Inspection Run
Validation commands actually run:
- `npm run typecheck`
  - Result: PASS
- `npm run build`
  - Result: PASS
  - Notes: pre-existing warnings only for stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
- `npm run test:architect -- --reporter=dot`
  - Result: PASS
  - Coverage result: 202 files, 2748 tests passed
- `npm run validate:project`
  - Result: PASS

Commands intentionally skipped:
- `npm run test:trade -- --reporter=dot`
  - Skipped because this batch stayed inside cap-core helper shims and Architect guardrail/smoke surfaces, not the trade-helper runtime lanes that require separate trade-suite coverage.
- `npm run test:diff -- --reporter=dot`
  - Skipped because the required Architect suite matched the touched surface directly and avoided diff-based escalation to broader tiers.
- `npm run test:full`
  - Skipped because AGENTS.md blocks full-suite runs unless the prompt contains `RUN FULL SUITE`.
- `npm run lint`
  - Skipped because repo guidance says lint is opt-in only and this execution did not require it.

## 6. Remaining Follow-Up
- Remaining Phase 7C keeper review set: `capSettingsProvider.js`, `hardCapStatus.js`, `basicArchitectUtils.js`, `playerRulesProfile/types.js`, `tradeContext/types.js`, `tradeContext/legacy/index.js`, `ValidationStateHeader.jsx`, `EntitlementPicksList.jsx`, `DraftPositionsInput.jsx`.
- Remaining Phase 7D route/public-entry wrapper decisions are still open for surfaces such as `GMDashboard/index.jsx` and `LeagueView.jsx`.
- Phase 7E final Architect JS/JSX inventory gate remains open.
