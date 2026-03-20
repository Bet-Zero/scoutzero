# TM_VALIDATOR_TS_RESIDUAL_PURE_SHIM_BATCH_E127 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the second Phase 7C mixed/structural keeper review batch.
- Deleted 6 residual pure same-path shims that no longer had live `src/**` callers: `DraftPositionsInput.jsx`, `EntitlementPicksList.jsx`, `ValidationStateHeader.jsx`, `basicArchitectUtils.js`, `playerRulesProfile/types.js`, and `hardCapStatus.js`.
- Rewrote the affected Architect compatibility suites and the worldless hard-cap trade guardrail to the new contract: deleted path absent, extensionless import resolves to the TS / TSX authority, and the authority export surface remains aligned.
- Added a dedicated E127 guardrail proving the exact deleted-path set and extensionless / authority parity for all 6 retired surfaces.

## 2. Closed Scope Confirmation
- This pass stayed inside the residual pure-shim subset of the Phase 7C keeper review.
- Deleted files were limited to `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`, `src/features/architect/tradeMachine/EntitlementPicksList.jsx`, `src/features/architect/tradeMachine/ValidationStateHeader.jsx`, `src/features/architect/utils/basicArchitectUtils.js`, `src/features/architect/utils/playerRulesProfile/types.js`, and `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js`.
- No live mixed/legacy contract was removed from the remaining trio: `capSettingsProvider.js`, `tradeContext/types.js`, and `tradeContext/legacy/index.js` were not changed in this batch.
- No additional route/public-entry wrapper cleanup was attempted here.

## 3. Files Changed
Deleted shim surfaces:
- `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
- `src/features/architect/tradeMachine/EntitlementPicksList.jsx`
- `src/features/architect/tradeMachine/ValidationStateHeader.jsx`
- `src/features/architect/utils/basicArchitectUtils.js`
- `src/features/architect/utils/playerRulesProfile/types.js`
- `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js`

Runtime/source retargets:
- `src/features/architect/utils/playerRulesProfile/types.ts`

Test and guardrail retargets:
- `src/tests/architect/{gmWorldSupportFamily.compatibility.guardrail.test.tsx,grouped33FileScope.compatibility.guardrail.test.tsx,residualPureShimBatch.e127.guardrail.test.tsx,tradeMachineValidationPresentation.compatibility.guardrail.test.ts,tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx}`
- `src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_RESIDUAL_PURE_SHIM_BATCH_E127_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- The 6 deleted shim paths are now intentionally absent.
- The preserved internal contract for each retired surface is extensionless importing backed by the TS / TSX authorities:
  - `basicArchitectUtils.ts`
  - `playerRulesProfile/types.ts`
  - `tradeMachine/utils/hardCapStatus.ts`
  - `tradeMachine/ValidationStateHeader.tsx`
  - `tradeMachine/EntitlementPicksList.tsx`
  - `GMDashboard/components/DraftPositionsInput.tsx`
- `src/tests/architect/residualPureShimBatch.e127.guardrail.test.tsx` proves the exact deleted-path batch plus export-key and export-identity parity between extensionless imports and the direct authorities.
- The touched older compatibility suites no longer require the deleted shim files to exist; they now assert deleted-path absence or compare extensionless imports directly against the TS / TSX authority modules.

## 5. Validation / Inspection Run
Validation commands actually run:
- `npm run typecheck`
  - Result: PASS
- `npm run build`
  - Result: PASS
  - Notes: pre-existing warnings only for stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
- `npm run test:architect -- --reporter=dot`
  - Result: PASS
  - Coverage result: 202 files, 2749 tests passed
- `npm run validate:project`
  - Result: PASS

Commands intentionally skipped:
- `npm run test:trade -- --reporter=dot`
  - Skipped because this batch stayed inside Architect compatibility/guardrail surfaces plus one import-only hard-cap trade guardrail retarget, not a runtime trade-helper behavior lane.
- `npm run test:diff -- --reporter=dot`
  - Skipped because the Architect suite matched the touched surface directly and avoided diff-based escalation to broader tiers.
- `npm run test:full`
  - Skipped because AGENTS.md blocks full-suite runs unless the prompt contains `RUN FULL SUITE`.
- `npm run lint`
  - Skipped because repo guidance says lint is opt-in only and this execution did not require it.

## 6. Remaining Follow-Up
- Remaining Phase 7C keeper review set: `capSettingsProvider.js`, `tradeContext/types.js`, and `tradeContext/legacy/index.js`.
- Remaining Phase 7D route/public-entry wrapper decisions are still open for surfaces such as `GMDashboard/index.jsx` and `LeagueView.jsx`.
- Phase 7E final Architect JS/JSX inventory gate remains open.
