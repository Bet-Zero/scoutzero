# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E76 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the actual current repo state is the Trade Machine hook-support pocket centered on `src/features/architect/hooks/useTradeMachine.js`.
- Estimated live JS business-logic count for the recommended scope: `4`.
- It still looks worth doing next because it is the smallest remaining boundary that is both runtime-central and internally coherent, while the smaller `firebaseTeamPlanHelpers.js` challenger still reads as a mixed data-access surface rather than a cleaner cutoff.

## 2. Closed Scope Confirmation
- This audit treated the following prior scopes as closed/complete: E39 validator-adjacent Trade Machine scope, E41 draft-pick resolution utility scope, E43/E44 `tradeContext` mini-arc, E46 trade-facing helper foundation, E48 `capTotals`, E50 `persistenceContracts`, E52 season-transition helpers, E54 exception-history helpers, E56/E57 `playerRulesProfile`, E59 contract/season helpers, E61/E62 non-trade cap-legality, E64 world-aware loader, E66/E67 entitlement presentation, E69 Trade Machine validation snapshot/accessors, E71 Architect contract/cap hooks, E73 world-lifecycle / `worldManager`, and E75 trade-execution helpers.
- The audit avoided silently reopening those scopes by re-checking the same-name `.js` files, nearby public barrels, and adjacent wrappers against the current repo state and continuing to classify them as TS-backed compatibility shims, wrapper-only surfaces, or barrel/index files rather than new live business-logic candidates.
- No prior closed scope showed current repo evidence that required reopening in E76.

## 3. Candidate Next Scopes

### Candidate 1 — Trade Machine Hook-Support Pocket
- Includes:
  - `src/features/architect/hooks/useTradeMachine.js`
  - `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`
  - `src/features/architect/tradeMachine/utils/devSntInjector.js`
  - `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`
- Excludes:
  - E69-closed snapshot/accessor files `src/features/architect/hooks/useTradeMachineSnapshot.js` and `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`
  - validator engine/rules/cache files
  - UI consumers such as `TradeEditor.jsx`
- Estimated live JS business-logic file count: `4`.
- Why it is a good next arc:
  - `useTradeMachine.js` is a live runtime hook used by `TradeEditor.jsx` and direct tests, and it owns stale-validation state, team loading, entitlement hydration, cap totals wiring, synthetic S&T injection, and trade export assembly.
  - The three smaller JS helpers are directly wired into that hook and remain live in runtime and/or tests.
  - The cutoff is clean without reopening E69 or dragging in validator internals.
- Why it is not a one-pass mini-arc:
  - The hook alone is materially larger and more stateful than the just-closed E75 helper boundary, so it likely wants sub-arcs even though the overall family remains the best next scope.

### Candidate 2 — World / Data-Access Pocket
- Includes:
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js`
- Excludes:
  - `src/features/architect/hooks/useArchitectPlayerData.js` because current repo evidence still shows it as a thin wrapper over authoritative `subscribeArchitectPlayerData.ts`
  - `src/features/architect/utils/teamLoader.ts`, `src/features/architect/utils/worldTeamData.ts`, and `src/features/architect/utils/worldManager.js`
- Estimated live JS business-logic file count: `1`.
- Why it is a serious candidate:
  - `firebaseTeamPlanHelpers.js` is runtime-live through `LeagueView.jsx`, `worldTeamData.ts`, `teamLoader.ts`, and GMDashboard free-agent flows.
  - It contains substantive business logic for base-team hydration, team list fallback behavior, and free-agent pool access.
- Why it is not the best next arc:
  - It mixes base-team read/hydration logic with free-agent pool write/read helpers in one file, so the boundary is smaller but less clean.
  - Recommending it next would prefer single-file size over boundary coherence.

### Candidate 3 — Season / Pipeline Orchestration Family
- Includes:
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/runOffseason.js`
- Excludes:
  - closed E64 / E73 / E75 boundaries and downstream UI consumers
- Estimated live JS business-logic file count: `3`.
- Why it is not a good next arc:
  - `seasonManager.js` and `mutationPipeline.js` are both very large, multi-responsibility orchestration surfaces, and `runOffseason.js` does not make that family materially cleaner.
  - This would be a major widening away from the smallest coherent next slice.

### Candidate 4 — Trade Machine Support / Cache / Debug Cluster
- Includes:
  - `src/features/architect/utils/tradeMachine/cache/validationCache.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
  - `src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js`
  - `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
  - `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
  - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
  - `src/features/architect/utils/tradeMachine/rules/enforcement.js`
- Excludes:
  - barrels such as `cache/index.js`, `engine/index.js`, and `tradeMachine/index.js`
  - E69-closed snapshot/accessor files
  - validator TS authorities already migrated in `rules/*.ts`, `utils/*.ts`, and `engine/tradeValidator.ts`
- Estimated live JS business-logic file count: `10`.
- Why it is not the best next arc:
  - The cluster is support-heavy and fragmented across cache, debug, monitoring, entitlement pre-resolution, and legacy enforcement surfaces.
  - It is runtime-live in places, but it is a worse next intelligent slice than the hook-support pocket because it does not present one clean boundary.

### Candidate 5 — Smaller Isolated Utility Residue
- Includes:
  - `src/features/architect/utils/consentUtils.js`
  - `src/features/architect/utils/stepienUtils.js`
- Excludes:
  - `src/features/architect/utils/cashUtils.js` because current repo inspection found no live importers
  - `src/features/architect/utils/rosterUtils.js` because current repo inspection found no live importers
  - `src/features/architect/utils/reacqUtils.js` because it is only reachable through deprecated `timingUtils.js`
  - `src/features/architect/utils/draftPickUtils.js` because current importer evidence is guardrail-only
- Estimated live JS business-logic file count: `2`.
- Why it is not the best next arc:
  - These files are real JS business logic, but they do not form one coherent subsystem.
  - Recommending them next would turn E76 into a scattered residue cleanup chain instead of selecting a clean adjacent arc.

## 4. Recommended Next Scope
- Recommended next migration scope: the Trade Machine hook-support pocket consisting of `src/features/architect/hooks/useTradeMachine.js`, `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`, `src/features/architect/tradeMachine/utils/devSntInjector.js`, and `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`.
- Why it is the best next choice:
  - It is the strongest remaining boundary that combines runtime centrality, current live usage, and a clean internal cutoff.
  - It stays directly adjacent to recently closed Trade Machine work without reopening E69 snapshot/accessor surfaces or dragging in validator engine/rules families.
  - It beats the smaller `firebaseTeamPlanHelpers.js` challenger because that file still mixes multiple data-access responsibilities in one boundary.
  - It is much cleaner than the season/pipeline family and the Trade Machine support/cache/debug cluster.
- Recommended execution shape: split into sub-arcs, not one forced grouped pass.
  - Likely split:
    - helper sub-arc: `computeTradeDraftKey.js`, `devSntInjector.js`, `tradeExportUtils.js`
    - core hook sub-arc: `useTradeMachine.js`
- Hard rule for the follow-up execution:
  - Do not silently widen the recommended scope to include validator engine/rules files, E69 snapshot/accessor files, UI consumers, or world/orchestration files unless execution evidence proves the hook-support boundary cannot stand cleanly on its own.
  - If that happens, document the exact blocker instead of auto-expanding the scope.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/hooks/useTradeMachine.js`
  - Why it belongs in scope:
    - It is the live runtime hook behind `TradeEditor.jsx`.
    - It still owns the current trade-machine state draft, stale-validation key handling, team loading, entitlement/pick-rule loading, synthetic S&T injector lifecycle, and export payload assembly.
  - Central or peripheral: `central`.
- `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`
  - Why it belongs in scope:
    - It provides the current stale-validation key contract used by `useTradeMachine.js`.
    - It has direct test coverage proving deterministic key generation and stale-result invalidation semantics.
  - Central or peripheral: `peripheral`.
- `src/features/architect/tradeMachine/utils/devSntInjector.js`
  - Why it belongs in scope:
    - It is a live helper for the dev-only synthetic sign-and-trade injection path used by `useTradeMachine.js`.
    - It has direct hook-level and utility-level test coverage.
  - Central or peripheral: `peripheral`.
- `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`
  - Why it belongs in scope:
    - It provides the canonical `extractUsedTpeIds()` helper used by `useTradeMachine.js` when building trade export payloads.
    - It has direct test coverage and is part of the hook’s current output assembly path.
  - Central or peripheral: `peripheral`.

## 6. Validation / Inspection Run
- Inspection commands used:
  - `git status --short`
  - `sed -n '1238,1295p' docs/architect/TRADE_MACHINE_MASTER.md`
  - `sed -n '1,260p' src/features/architect/utils/firebaseTeamPlanHelpers.js`
  - `sed -n '1,220p' src/features/architect/hooks/useTradeMachine.js`
  - `sed -n '1,200p' src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`
  - `sed -n '1,260p' src/features/architect/tradeMachine/utils/devSntInjector.js`
  - `sed -n '1,220p' src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`
  - `sed -n '1,220p' src/features/architect/hooks/useArchitectPlayerData.js`
  - `sed -n '1,220p' src/features/architect/utils/runOffseason.js`
  - `sed -n '1,220p' src/features/architect/utils/architectCore.js`
  - `sed -n '1,240p' src/features/architect/utils/tradeMachine/cache/validationCache.js`
  - `sed -n '1,260p' src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
  - `sed -n '1,220p' src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js`
  - `sed -n '1,240p' src/features/architect/utils/tradeMachine/engine/engineUtils.js`
  - `sed -n '1,260p' src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
  - `sed -n '1,260p' src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
  - `sed -n '1,220p' src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
  - `sed -n '1,220p' src/features/architect/utils/tradeMachine/rules/enforcement.js`
  - `sed -n '1,220p' src/features/architect/utils/consentUtils.js`
  - `sed -n '1,240p' src/features/architect/utils/stepienUtils.js`
  - `sed -n '1,220p' src/features/architect/utils/cashUtils.js`
  - `sed -n '1,240p' src/features/architect/utils/reacqUtils.js`
  - `sed -n '1,240p' src/features/architect/utils/rosterUtils.js`
  - `sed -n '1,220p' src/features/architect/utils/draftPickUtils.js`
  - `sed -n '1,220p' src/features/architect/utils/temp_mutation_code.js`
  - targeted `rg -n` importer scans for the hook-support pocket, `firebaseTeamPlanHelpers.js`, support/cache/debug files, smaller isolated utilities, and thin-wrapper exclusions
  - `wc -l` comparison for E75 authorities, the hook-support files, `firebaseTeamPlanHelpers.js`, the orchestration family, and the support/cache/debug cluster
- What the inspection proved:
  - All previously closed E39-E75 boundaries still read as closed, with same-name `.js` files staying shim-only, wrapper-only, or barrel-only.
  - `useTradeMachine.js` remains runtime-live and directly wired to the three smaller helper files.
  - `firebaseTeamPlanHelpers.js` remains the main smaller challenger, but its live surface is still a mixed data-access boundary rather than a cleaner next cut.
  - The season/pipeline family is too large and the support/cache/debug cluster is too fragmented for the next slice.
  - Smaller isolated utility residues exist, but they do not form a better coherent next arc than the hook-support pocket.
- Required validation commands run:
  - `npm run typecheck`
    - Result: PASS.
  - `npm run validate:project`
    - Result: PASS.
- Commands intentionally skipped:
  - broader `npm run test:* -- --reporter=dot` suites
  - Reason: static inspection was sufficient to rank the candidate scopes, and no runtime ambiguity remained that required broader test proof.

## 7. Complexity / Risk Assessment
- Relative size versus the just-closed E75 trade-execution helper arc:
  - The recommended hook-support pocket is larger than E75.
  - E75 authoritative boundary size: `851` LOC across `tradeManager.ts` + `schemaAdapter.ts`.
  - Recommended E76 scope size: `1484` LOC across `useTradeMachine.js` + three adjacent helpers.
- Likely execution shape:
  - This looks more like a split migration than a one-pass grouped mini-arc.
  - The helper trio looks separable, while `useTradeMachine.js` is large enough to justify its own follow-up sub-arc.
- Key risks / caveats:
  - `useTradeMachine.js` is a large stateful React hook, so the main migration risk is preserving initialization order, stale-validation key invalidation, entitlement/pick-rule hydration, and current return-shape behavior.
  - The helper trio sits on explicit `.js` imports and narrow test contracts, so compatibility shims and export stability will matter.
  - The hook touches runtime flows that feed UI consumers, but this audit explicitly does not recommend widening into those UI files.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E76 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
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
- Recorded that the E75 trade-execution helper arc remains complete.
- Recorded the recommended next migration scope as the Trade Machine hook-support pocket centered on `useTradeMachine.js`.
- Recorded the estimated live JS business-logic count for that scope as `4`.
- Recorded that the next arc should likely be split into smaller sub-arcs rather than forced into one grouped pass.
