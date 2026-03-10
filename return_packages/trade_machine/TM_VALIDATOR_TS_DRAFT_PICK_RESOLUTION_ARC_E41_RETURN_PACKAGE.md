# TM_VALIDATOR_TS_DRAFT_PICK_RESOLUTION_ARC_E41 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the draft-pick resolution utility cluster into authoritative TypeScript implementations:
  - `src/features/architect/utils/tradeMachine/utils/pickIdUtils.ts`
  - `src/features/architect/utils/tradeMachine/utils/swapResolution.ts`
  - `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.ts`
- Behavior was preserved across canonical pick ID generation, swap resolution, conveyance/protection resolution, season-manager-adjacent wrappers, and DARE-adjacent guardrails.
- The original `.js` files remained only as pure compatibility re-export shims because live consumers still import the stable `.js` paths, and `pickIdUtils` also has extensionless importer usage that made shim-backed stabilization the safest E41 shape.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/pickIdUtils.ts`
  - Added the authoritative TypeScript implementation for round normalization, pick ID generation, ID enforcement, and pick-ID comparison.
  - Safe because the logic was ported directly from the live JS behavior without semantic changes.
- `src/features/architect/utils/tradeMachine/utils/swapResolution.ts`
  - Added the authoritative TypeScript implementation for swap winner resolution, single-pick swap resolution, and batch swap resolution.
  - Safe because the runtime defaults, throw behavior, idempotency, warnings, and metadata shape were preserved exactly.
- `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.ts`
  - Added the authoritative TypeScript implementation for protection parsing, trigger detection, single-pick conveyance resolution, batch conveyance resolution, and protection normalization helpers.
  - Safe because the no-op guards, ladder priority, conversion/final-year ordering, `ifRolls` parsing, and result shapes were preserved exactly.
- `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`
  - Replaced all business logic with a pure compatibility re-export shim to `pickIdUtils.ts`.
  - Safe because explicit `.js` importers still resolve, but the authoritative logic now lives only in TS.
- `src/features/architect/utils/tradeMachine/utils/swapResolution.js`
  - Replaced all business logic with a pure compatibility re-export shim to `swapResolution.ts`.
  - Safe because current `.js` consumers stay stable while the live logic is centralized in TS.
- `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js`
  - Replaced all business logic with a pure compatibility re-export shim to `conveyanceResolution.ts`.
  - Safe because current `.js` consumers stay stable while the live logic is centralized in TS.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E41 execution entry summarizing the TS-backed draft-pick resolution arc, behavior preservation, shim status, and follow-up status.
  - Safe because it is documentation-only and reflects the implemented repo state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_DRAFT_PICK_RESOLUTION_ARC_E41_RETURN_PACKAGE.md`
  - Added the required E41 execution return package.
  - Safe because it is documentation-only and records the exact execution outcome.

## 3. Types Introduced or Hardened
- `PickIdRecord`
  - Represents the loose pick-like object shape accepted by the authoritative pick-ID path.
  - Applies in `pickIdUtils.ts` across `generatePickId`, `ensurePickId`, and `areSamePickById` so legacy/partial pick objects keep their existing fallback behavior.
- `SwapWinnerInput`, `SwapPickLike`, `SwapResolutionOptions`, `TeamSwapsResult`
  - Represent the current swap input surface, permissive pick object shape, resolution options, and batch result shape.
  - Apply in `swapResolution.ts` across the authoritative swap-winner, single-pick, and batch-resolution path.
- `ConveyancePickLike`, `ConveyanceLike`, `ConveyanceConditionsLike`, `ProtectionMetaLike`, `ConveyanceResolutionOptions`, `TeamConveyanceResult`
  - Represent the current permissive conveyance/protection input shapes and the batch result surface.
  - Apply in `conveyanceResolution.ts` across protection parsing, trigger evaluation, single-pick conveyance resolution, batch conveyance resolution, and protection normalization helpers.

## 4. Migration Work Completed
- `pickIdUtils`
  - Moved the live implementation into `pickIdUtils.ts`.
  - Preserved authoritative behavior by directly porting the existing normalization aliases, fallback ID format, valid-ID passthrough, warning text, and dev-only console warning behavior.
  - Minimal contract correction required by typing: none.
- `swapResolution`
  - Moved the live implementation into `swapResolution.ts`.
  - Preserved authoritative behavior by directly porting `best_of` defaulting, `teamA` tie-breaks, throw behavior for direct calls, warning behavior for batch calls, idempotency, and current resolution metadata.
  - Minimal contract correction required by typing: none.
- `conveyanceResolution`
  - Moved the live implementation into `conveyanceResolution.ts`.
  - Preserved authoritative behavior by directly porting the existing no-op guards, protection-threshold parsing, ladder-first protection lookup, conversion-before-final-year ordering, `ifRolls` protection parsing, and current `conveyanceResult` shape.
  - Minimal contract correction required by typing: none.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`
  - Remains JS only as a pure compatibility shim because live importers still use the stable `.js` path and extensionless `pickIdUtils` consumers also benefit from the existing compatibility shape.
- `src/features/architect/utils/tradeMachine/utils/swapResolution.js`
  - Remains JS only as a pure compatibility shim because live season-manager-adjacent and test importers still use the stable `.js` path.
- `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js`
  - Remains JS only as a pure compatibility shim because live season-manager-adjacent and test importers still use the stable `.js` path.
- No directly related JS business-logic holdouts remain in the E41 arc.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the new TS-backed utilities integrate cleanly with the current repo typing surface, including the stable importer paths.
  - Result: PASS
- `npm run test:node -- --reporter=dot src/tests/tradeMachine/pickIdUtils.test.js src/tests/tradeMachine/draftPicksPreflight.test.js src/tests/tradeMachine/swapResolution.test.js src/tests/tradeMachine/conveyancePreflight.test.js src/tests/tradeMachine/phase5DraftPositions.test.js src/tests/tradeMachine/seasonSwapResolution.test.js src/tests/architect/dare/swapResolutionAdapter.test.js src/tests/architect/dare/conveyanceResolutionAdapter.test.js src/tests/architect/dare/phase17_1_protections_guardrail.test.ts src/tests/architect/dare/phase17_2_swap_guardrail.test.ts src/tests/architect/dare/phase17_3_ladders_and_conversion_guardrail.test.ts src/tests/architect/dare/phase17_4_pool_and_chained_swaps_guardrail.test.ts src/tests/architect/dare/phase17_5_ranked_conveyance_and_conflict_guardrail.test.ts`
  - Proved direct `pickIdUtils`, `swapResolution`, and `conveyanceResolution` behavior remained intact, plus season-manager-adjacent resolution wrappers and DARE-adjacent parity/guardrail coverage.
  - Result: PASS (13 files, 277 tests)
- `npm run validate:project`
  - Proved the repo structure remains valid after adding the three authoritative TS modules and the E41 documentation.
  - Result: PASS
- Commands intentionally skipped:
  - `npm run test:architect -- --reporter=dot`
    - Skipped because the narrower explicit `test:node` file set already covered the direct, season-manager-adjacent, and DARE-adjacent E41 surfaces.
  - `npm run build`
    - Skipped because this was a utility-only TypeScript migration with no UI or route changes, and the required proof set already passed.
  - `npm run test:diff -- --reporter=dot`
    - Skipped because the explicit targeted node proof was more precise for this grouped arc than the diff-based selector.
  - `npm run test:full`
    - Skipped because full suite execution was not requested and is guarded by repo rules.

## 7. Post-E41 Status
- The 3-file draft-pick resolution arc is effectively complete.
- Recommended follow-up: none required for this arc beyond any future importer-state-driven decision to retire the kept `.js` compatibility shims.
- The grouped execution succeeded cleanly as one arc; another migration pass is not needed for the E41 scope.

## 8. Master Doc Update
- Added `### Validator TS Draft-Pick Resolution Arc E41 (2026-03-10)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new entry states that:
  - `pickIdUtils`, `swapResolution`, and `conveyanceResolution` are now TS-backed
  - behavior remained unchanged across the grouped arc
  - the original `.js` files remain only as shim-only compatibility entrypoints
  - no immediate follow-up is required for the 3-file E41 arc
  - the return package is `return_packages/trade_machine/TM_VALIDATOR_TS_DRAFT_PICK_RESOLUTION_ARC_E41_RETURN_PACKAGE.md`
