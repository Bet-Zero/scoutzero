# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E74 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the actual current repo state is the trade-execution helper boundary centered on `src/features/architect/utils/tradeManager.js` and `src/features/architect/utils/schemaAdapter.js`.
- Estimated live JS business-logic count for the recommended scope: `2`.
- It still looks worth doing next because it is the smallest coherent remaining business-logic boundary adjacent to the closed Trade Machine / Architect migration path, with a cleaner cutoff than the larger hook-support, world/data-access, engine/cache/debug, or season/pipeline families.

## 2. Closed Scope Confirmation
- This audit treated the following prior scopes as closed/complete: E39 validator-adjacent Trade Machine scope, E41 draft-pick resolution utility scope, E43/E44 `tradeContext` mini-arc, E46 trade-facing helper foundation, E48 `capTotals`, E50 `persistenceContracts`, E52 season-transition helpers, E54 exception-history helpers, E56/E57 `playerRulesProfile`, E59 contract/season helpers, E61/E62 non-trade cap-legality, E64 world-aware loader, E66/E67 entitlement presentation, E69 Trade Machine validation snapshot/accessors, E71 Architect contract/cap hooks, and E73 world-lifecycle / `worldManager`.
- The audit avoided silently reopening those scopes by re-checking the same-name `.js` files and nearby barrels against the current repo state and continuing to classify them as TS-backed compatibility shims, wrapper-only surfaces, or barrel/index files rather than new live business-logic candidates.
- No prior closed scope showed repo evidence that required reopening in E74.

## 3. Candidate Next Scopes

### Candidate 1 — Trade-Execution Helper Boundary
- Includes:
  - `src/features/architect/utils/tradeManager.js`
  - `src/features/architect/utils/schemaAdapter.js`
- Excludes:
  - `src/features/architect/utils/architectCore.js` because current repo evidence still shows it as a barrel-only export surface with guardrail-only usage, not standalone business logic.
  - `src/features/architect/utils/seasonManager.js`, `src/features/architect/utils/mutationPipeline.js`, and `src/features/architect/utils/runOffseason.js` because they are larger orchestration files, not required to make `tradeManager.js` + `schemaAdapter.js` a coherent cut.
- Estimated live JS business-logic file count: `2`.
- Why it is a good next arc:
  - `tradeManager.js` remains live business logic with unit/integration/E2E coverage for `executeTrade`, `signFreeAgent`, `waivePlayer`, and `extendPlayer`.
  - `schemaAdapter.js` remains live business logic used by both tests and runtime through `mutationPipeline.js` and `tradeManager.js`.
  - The cutoff is clean: `schemaAdapter.js` shapes trade input, `tradeManager.js` owns the read-only trade/signing/waiver/extension snapshot API, and `architectCore.js` can stay excluded as a barrel.
- Why it is not awkward:
  - Both files sit on the same trade-execution contract boundary and already share direct dependency wiring.
  - The scope stays small without dragging in season advancement, persistence orchestration, or UI state management.

### Candidate 2 — Trade Machine Hook-Support Pocket
- Includes:
  - `src/features/architect/hooks/useTradeMachine.js`
  - `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`
  - `src/features/architect/tradeMachine/utils/devSntInjector.js`
  - `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`
- Excludes:
  - `useTradeMachineSnapshot.js` and `getOfficialSalaryMatchingSnapshot.js` because E69 already closed that boundary.
  - Trade Machine validator/rules/utils files already converted in prior arcs or still better treated as separate engine/support families.
- Estimated live JS business-logic file count: `4`.
- Why it is a serious candidate:
  - All four files are runtime- and/or test-used, and `useTradeMachine.js` is a direct UI hook used by `TradeEditor.jsx`.
  - The pocket is still adjacent to recent Trade Machine scope closures.
- Why it is not the best next arc:
  - `useTradeMachine.js` alone is larger than the just-closed E73 `worldManager.ts` authority and pulls in broader UI state, loading, validation, entitlement, and debug concerns.
  - The cutoff is coherent, but it is materially larger and more stateful than the trade-execution helper boundary.

### Candidate 3 — World/Data-Access Pocket
- Includes:
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js`
  - nearby `src/features/architect/hooks/useArchitectPlayerData.js` review
- Excludes:
  - `src/features/architect/utils/teamLoader.ts` and `src/features/architect/utils/worldTeamData.ts` because those are already-TS consumers, not remaining JS authorities.
  - `src/features/architect/utils/worldManager.js` because E73 already closed that boundary.
- Estimated live JS business-logic file count: `1`.
- Why the count is `1`:
  - `firebaseTeamPlanHelpers.js` is substantive live business logic with runtime callers in `worldTeamData.ts`, `teamLoader.ts`, and `LeagueView.jsx`, plus test mocks/coverage.
  - `useArchitectPlayerData.js` currently reads as a thin subscription wrapper over authoritative `subscribeArchitectPlayerData.ts`, so it was inspected and excluded from the live-business-logic count.
- Why it is not the best next arc:
  - The surface is mixed: base-team hydration, free-agent read/write helpers, and a thin hook wrapper do not form as clean a business-logic boundary as `tradeManager.js` + `schemaAdapter.js`.
  - If reduced to just `firebaseTeamPlanHelpers.js`, it becomes a single-file mixed-responsibility data-access surface rather than the next best grouped migration arc.

### Candidate 4 — Season / Pipeline Orchestration Family
- Includes:
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/runOffseason.js`
- Excludes:
  - `src/features/architect/utils/architectCore.js` because it remains a barrel surface, not orchestration logic authority.
- Estimated live JS business-logic file count: `3`.
- Why it is not a good next arc:
  - The family is far larger than E73 and spans world persistence, mutation application, season advancement, OSTE delegation, event/history writes, and post-state validation.
  - `runOffseason.js` is small, but it does not reduce the need to split `seasonManager.js` and `mutationPipeline.js` into smaller future arcs.
  - This would be an obvious silent widening of scope away from the smallest coherent next slice.

### Candidate 5 — Trade Machine Engine / Cache / Debug Support Cluster
- Includes:
  - `src/features/architect/utils/tradeMachine/cache/validationCache.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
  - `src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js`
  - `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
  - `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
  - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js`
- Excludes:
  - `cache/index.js` and `engine/index.js` because they are barrels.
  - `validationCacheManager.js`, `validatorFactory.js`, `performanceMonitor.js`, `tradeValidator.debug.js`, and `resolveValidationEntitlements.js` because current importer evidence leaves them as low-/zero-import support or debug-adjacent files rather than the next live boundary to recommend.
- Estimated live JS business-logic file count: `7`.
- Why it is not the best next arc:
  - The cluster is support-heavy, partially debug-only, and already split between runtime-used pieces and low-/zero-import leftovers.
  - It is a worse “next intelligent slice” than the smaller trade-execution or hook-support boundaries and would likely need sub-arcs rather than one clean grouped pass.

## 4. Recommended Next Scope
- Recommended next migration scope: the trade-execution helper boundary consisting of `src/features/architect/utils/tradeManager.js` and `src/features/architect/utils/schemaAdapter.js`.
- Why it is the best next choice:
  - It is the smallest coherent remaining business-logic boundary that stays adjacent to the closed Trade Machine / Architect migration path.
  - It avoids reopening any prior E39-E73 scope.
  - It is cleaner than the world/data-access pocket, which currently mixes one substantive helper with a thin TS-backed hook wrapper.
  - It is much smaller and less state-heavy than the `useTradeMachine.js` hook-support pocket.
  - It avoids the obvious overreach of widening into `seasonManager.js`, `mutationPipeline.js`, `runOffseason.js`, `architectCore.js`, or Trade Machine engine/cache/debug support.
- Recommended execution shape: one grouped mini-arc, not a split chain, unless future execution uncovers a concrete blocker around the shared `buildTradeTeamInput` contract surface.
- Hard rule for the follow-up execution:
  - Do not silently widen the recommended scope to include `seasonManager.js`, `mutationPipeline.js`, `runOffseason.js`, `architectCore.js`, or Trade Machine engine/cache/debug files unless execution evidence shows `tradeManager.js` + `schemaAdapter.js` cannot stand cleanly as their own migration boundary.
  - If that happens, document the exact blocker instead of auto-expanding the scope.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/tradeManager.js`
  - Why it belongs in scope:
    - It remains the JS authority for the read-only trade/signing/waiver/extension snapshot API.
    - It still contains live business logic for routing incoming assets, snapshot mutation, exception handling, and cap-total recomputation.
    - It is exercised by `tests/architect/tradeManager.test.js`, `tests/architect/integration.test.js`, and `tests/architect/e2e-workflows.test.js`.
  - Central or peripheral: `central`.
- `src/features/architect/utils/schemaAdapter.js`
  - Why it belongs in scope:
    - It remains the JS authority for `buildTradeTeamInput` / `buildTradeInput` and the validator-facing adapter contract.
    - It is used by `tradeManager.js` and by live runtime code in `mutationPipeline.js`, so the boundary stays relevant beyond tests.
    - It has direct unit coverage in `tests/architect/schemaAdapter.test.js`.
  - Central or peripheral: `central`.

## 6. Validation / Inspection Run
- Inspection commands used:
  - `rg -n "E39|E41|E43|E44|E46|E48|E50|E52|E54|E56|E57|E59|E61|E62|E64|E66|E67|E69|E71|E73" docs/architect/TRADE_MACHINE_MASTER.md`
  - `sed -n '1,260p' return_packages/trade_machine/TM_VALIDATOR_TS_WORLD_MANAGER_E73_RETURN_PACKAGE.md`
  - one-off `node` import-graph inventory scripts to:
    - enumerate remaining `src/features/architect/**/*.js` files outside the closed E39-E73 set
    - detect TS peers
    - count importers
    - compare the candidate boundary sizes and internal edges
  - targeted `rg -n` importer checks for:
    - `tradeManager`, `schemaAdapter`, `architectCore`
    - `useTradeMachine`, `computeTradeDraftKey`, `devSntInjector`, `tradeExportUtils`
    - `firebaseTeamPlanHelpers`, `useArchitectPlayerData`
    - `seasonManager`, `mutationPipeline`, `runOffseason`
    - engine/cache/debug files
  - targeted `sed -n` inspection of the serious candidate files and nearby barrels/support files
  - `wc -l` on the leading candidate files and larger comparison files
- What the inspection proved:
  - Closed E39-E73 same-name `.js` files still read as compatibility shims, wrappers, or barrels rather than reopened business logic.
  - `tradeManager.js` + `schemaAdapter.js` remain a coherent standalone boundary.
  - `architectCore.js` does not currently justify inclusion because it is a barrel surface rather than live business logic.
  - `useArchitectPlayerData.js` is nearby but currently reads as a thin wrapper over TS-backed subscription logic.
  - The season/pipeline family and engine/cache/debug cluster are both larger and less clean as the next slice.
- Required validation commands run:
  - `npm run typecheck`
    - Result: PASS.
  - `npm run validate:project`
    - Result: PASS.
- Commands intentionally skipped:
  - broader `npm run test:* -- --reporter=dot` suites
  - Reason: inspection did not reveal a real ambiguity that required broader runtime proof to choose the next scope.

## 7. Complexity / Risk Assessment
- Relative size versus the just-closed E73 world-lifecycle arc:
  - The recommended `tradeManager.js` + `schemaAdapter.js` arc looks smaller than E73 by file count and total line count.
- Likely execution shape:
  - It looks batchable as one grouped mini-arc rather than another long micro-pass chain.
- Key risks / caveats:
  - `schemaAdapter.js` is consumed by `mutationPipeline.js`, so the adapter contract and export surface need exact compatibility.
  - `tradeManager.js` is currently more test-facing than runtime-facing, so the main migration value is boundary closure and type safety rather than direct UI-surface centrality.
  - The nearby `useTradeMachine.js` pocket remains a plausible follow-up after this arc because it is more runtime-central but clearly larger and riskier.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E74 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that E39 remains closed.
- Recorded that E41 remains complete.
- Recorded that the E43/E44 `tradeContext` mini-arc remains complete.
- Recorded that the E46 trade-facing helper foundation remains complete.
- Recorded that the E48 `capTotals` mini-arc remains complete.
- Recorded that the E50 `persistenceContracts` arc remains complete.
- Recorded that the E52 season-transition helper arc remains complete.
- Recorded that the E54 exception-history mini-arc remains complete.
- Recorded that the E56/E57 `playerRulesProfile` arc remains complete.
- Recorded that the E59 contract/season helper arc remains complete.
- Recorded that the E61/E62 non-trade cap-legality arc remains complete.
- Recorded that the E64 world-aware loader mini-arc remains complete.
- Recorded that the E66/E67 entitlement presentation arc remains complete.
- Recorded that the E69 Trade Machine validation snapshot/accessor arc remains complete.
- Recorded that the E71 Architect contract/cap hook arc remains complete.
- Recorded that the E73 world-lifecycle arc remains complete.
- Recorded the recommended next migration scope as `src/features/architect/utils/tradeManager.js` + `src/features/architect/utils/schemaAdapter.js`.
- Recorded the estimated live JS business-logic count for that scope as `2`.
- Recorded that the next arc should likely be handled as one grouped mini-arc rather than silently widened into the larger orchestration or engine/cache/debug families.
