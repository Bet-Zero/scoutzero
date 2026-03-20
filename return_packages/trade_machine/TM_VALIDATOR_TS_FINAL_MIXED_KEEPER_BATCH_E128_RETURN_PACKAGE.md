# TM_VALIDATOR_TS_FINAL_MIXED_KEEPER_BATCH_E128 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the final Phase 7C mixed/structural keeper batch.
- Deleted the last 2 deletable same-path shim surfaces in the Phase 7C review set: `capSettingsProvider.js` and `tradeContext/types.js`.
- Moved the remaining live runtime/test callers off explicit `.js` imports to extensionless or TS-authority resolution.
- Added a dedicated E128 guardrail proving the exact deleted-path set and confirming that `tradeContext/legacy/index.js` remains the intentional preserved legacy contract.

## 2. Closed Scope Confirmation
- This pass stayed inside the final mixed/structural keeper review lane.
- Deleted files were limited to `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js` and `src/features/architect/utils/tradeContext/types.js`.
- `src/features/architect/utils/tradeContext/legacy/index.js` was intentionally preserved and not modified.
- No route/public-entry wrapper cleanup was attempted in this batch.

## 3. Files Changed
Deleted shim surfaces:
- `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js`
- `src/features/architect/utils/tradeContext/types.js`

Runtime/source retargets:
- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`

Test and guardrail retargets:
- `src/tests/architect/{finalMixedKeeperBatch.e128.guardrail.test.ts,phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js,seasonAdvance_postStateValidator_failClose.behavior.test.ts}`
- `tests/{capSettingsProvider.test.js}`
- `tests/architect/{capLegalityValidation.test.js}`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_FINAL_MIXED_KEEPER_BATCH_E128_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- `capSettingsProvider.js` and `tradeContext/types.js` are now intentionally absent.
- The preserved internal contract is:
  - extensionless importing for `tradeMachine/utils/capSettingsProvider`, backed by `capSettingsProvider.ts`
  - direct TS-type authority for `tradeContext/types.ts`, with no retained runtime shim
  - continued explicit preservation of `tradeContext/legacy/index.js` as the intentional legacy wrapper surface
- `src/tests/architect/finalMixedKeeperBatch.e128.guardrail.test.ts` proves:
  - exact deleted-path absence for the 2 retired shims
  - extensionless / authority export parity for `capSettingsProvider`
  - empty runtime-module parity for `tradeContext/types`
  - `tradeContext/legacy/index.js` remains shim-only and points at `legacy/index.ts`
- The Phase 65 direct-`.tradeExceptions` allowlist no longer includes `tradeContext/types.js`, so the deleted shim path is not silently preserved by source-scan tests.

## 5. Validation / Inspection Run
Validation commands actually run:
- `npm run typecheck`
  - Result: PASS
- `npm run build`
  - Result: PASS
  - Notes: pre-existing warnings only for stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
- `npm run test:architect -- --reporter=dot`
  - Result: PASS
  - Coverage result: 203 files, 2753 tests passed
- `npm run test:trade -- --reporter=dot`
  - Result: PASS
  - Coverage result: 71 files, 637 tests passed
- `npm run validate:project`
  - Result: PASS

Commands intentionally skipped:
- `npm run test:diff -- --reporter=dot`
  - Skipped because the Architect plus trade suites matched the touched helper/runtime/guardrail surface directly and avoided diff-based escalation to broader tiers.
- `npm run test:full`
  - Skipped because AGENTS.md blocks full-suite runs unless the prompt contains `RUN FULL SUITE`.
- `npm run lint`
  - Skipped because repo guidance says lint is opt-in only and this execution did not require it.

## 6. Remaining Follow-Up
- Phase 7C is closed; `tradeContext/legacy/index.js` remains the intentionally preserved legacy contract.
- Next lane is Phase 7D route/public-entry wrapper cleanup for surfaces such as `GMDashboard/index.jsx`, `LeagueView.jsx`, and any remaining import-topology wrappers/barrels.
- Phase 7E final Architect JS/JSX inventory gate remains open.
