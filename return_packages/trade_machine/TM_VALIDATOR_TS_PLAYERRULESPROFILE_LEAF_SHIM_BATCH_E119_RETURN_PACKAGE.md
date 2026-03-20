# TM_VALIDATOR_TS_PLAYERRULESPROFILE_LEAF_SHIM_BATCH_E119 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the third Phase 7B runtime-backed same-path cleanup batch.
- Deleted 6 `playerRulesProfile` leaf `.js` shims under `src/features/architect/utils/playerRulesProfile/`.
- Retargeted live `src/**` imports, smoke tests, and Architect guardrails to extensionless paths or TS-authority checks for those leaf modules.
- Added a dedicated E119 guardrail proving deleted-path absence plus representative extensionless/authority parity.

## 2. Closed Scope Confirmation
- This pass stayed inside the `playerRulesProfile` leaf shim batch.
- Deleted shims were limited to same-path leaf re-export hosts for `minimumSalaryRules`, `maxSalaryRules`, `birdRightsRules`, `rfaRules`, `extensionRules`, and `computeProfile`.
- `src/features/architect/utils/playerRulesProfile/index.js` remained intact as the intentional barrel surface.
- `src/features/architect/utils/playerRulesProfile/types.js` remained intact as the intentional JSDoc/default-export support surface.
- No `tradeMachine/rules/*.js`, `tradeMachine/engine/*.js`, `tradeMachine/cache/*.js`, persistence-contract helper, shared-contract helper, or mixed/structural keeper file was retired in this pass.

## 3. Files Changed
Deleted runtime-backed same-path shims:
- `src/features/architect/utils/playerRulesProfile/{birdRightsRules.js,computeProfile.js,extensionRules.js,maxSalaryRules.js,minimumSalaryRules.js,rfaRules.js}`

Runtime/test import-retarget and guardrail updates:
- `src/features/architect/utils/capLegalityValidation.ts`
- `src/features/architect/utils/playerRulesProfile/{computeProfile.ts,extensionRules.ts,index.js,maxSalaryRules.ts,rfaRules.ts}`
- `src/tests/architect/{phase40_secondApron_drift_guardrails.test.js,playerRulesProfileLeafShimBatch.e119.guardrail.test.ts}`
- `tests/architect/playerRulesProfile.test.js`
- `tests/smoke/{playerRulesProfileComputeProfileImports.smoke.test.ts,playerRulesProfileLeafImports.smoke.test.ts}`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_PLAYERRULESPROFILE_LEAF_SHIM_BATCH_E119_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- The retired `playerRulesProfile` leaf shim paths are now intentionally absent, and the preserved internal contract for those modules is extensionless resolution to the TS authority.
- `src/tests/architect/playerRulesProfileLeafShimBatch.e119.guardrail.test.ts` proves deleted-path absence and representative extensionless/authority parity for all 6 retired leaf surfaces.
- `tests/smoke/playerRulesProfileLeafImports.smoke.test.ts` and `tests/smoke/playerRulesProfileComputeProfileImports.smoke.test.ts` now assert extensionless/authority parity and deleted-path absence instead of `.js`-shim presence.
- `src/features/architect/utils/playerRulesProfile/index.js` remains as the intentional barrel entrypoint, but it now exports from extensionless leaf specifiers rather than deleted `.js` hosts.
- `src/features/architect/utils/playerRulesProfile/types.js` remains intentionally untouched.

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
  - Coverage result: 196 files, 2702 tests passed
- `npm run validate:project`
  - Result: PASS

Commands intentionally skipped:
- `npm run test:architect -- --reporter=dot`
  - Skipped because `npm run test:diff -- --reporter=dot` already selected the Architect tier and passed against the touched guardrails and behavior suites.
- `npm run test:trade -- --reporter=dot`
  - Skipped because this batch stayed inside player-rules/cap-legality surfaces rather than the trade-helper runtime lane, and `npm run test:diff -- --reporter=dot` already ran the Architect tier.
- `npm run test:full`
  - Skipped because AGENTS.md blocks full-suite runs unless the prompt contains `RUN FULL SUITE`.
- `npm run lint`
  - Skipped because repo guidance says lint is opt-in only and this execution did not require it.

## 6. Remaining Follow-Up
- Next Phase 7B batch: `tradeMachine/rules` same-path runtime-backed shims.
- Remaining Phase 7B runtime-backed clusters after that: `tradeMachine/engine`, `tradeMachine/cache`, persistence-contract helpers, and shared contract helpers.
- Phase 7C mixed/structural keeper review remains open.
- Phase 7D wrapper/barrel/public-entry cleanup remains open.
- Phase 7E final Architect JS/JSX inventory gate remains open.
