# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E81 — EXECUTION RETURN PACKAGE

## 1. Summary
- Current execution-time inspection confirmed `src/features/architect/utils/firebaseTeamPlanHelpers.js` as the strongest next coherent TypeScript migration scope after the E80 consent helper closeout.
- Estimated live JS business-logic count for the recommended scope: `1`.
- It looks worth doing next because it remains runtime-live through the base-team loading path, stays materially smaller than the larger validator-support and season/pipeline alternatives, and still provides a cleaner cutoff than broader support or orchestration families.

## 2. Closed Scope Confirmation
- This audit treated the following prior scopes as closed or complete: E39 validator-adjacent Trade Machine scope, E41 draft-pick resolution utility scope, E43/E44 `tradeContext`, E46 trade-facing helper foundation, E48 `capTotals`, E50 `persistenceContracts`, E52 season-transition helpers, E54 exception-history helpers, E56/E57 `playerRulesProfile`, E59 contract/season helpers, E61/E62 non-trade cap-legality, E64 world-aware loader, E66/E67 entitlement presentation, E69 Trade Machine snapshot/accessors, E71 Architect contract/cap hooks, E73 world lifecycle, E75 trade-execution helpers, E77 Trade Machine helper-trio, E78 `useTradeMachine`, and E80 `consentUtils`.
- The audit avoided silently reopening those areas by re-checking the same-name `.js` files, nearby barrels, and adjacent helper families against current importer/runtime evidence and continuing to classify the closed-scope files as TS-backed compatibility shims, public barrels, or already-complete boundaries rather than reopened JS business logic.
- No closed scope showed execution-time repo evidence that required reopening in E81.

## 3. Candidate Next Scopes

### Candidate 1 — World / Data-Access Helper Boundary
- Includes:
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js`
- Excludes:
  - `src/features/architect/hooks/useArchitectPlayerData.js`
  - `src/features/architect/utils/teamLoader.ts`
  - `src/features/architect/utils/worldTeamData.ts`
  - `src/features/architect/shared/LeagueView/LeagueView.jsx`
  - `worldManager`-adjacent consumers and closed E64/E73 surfaces
- Estimated live JS business-logic file count: `1`.
- Why it is a good next arc:
  - It remains runtime-live through `teamLoader.ts`, `worldTeamData.ts`, and `LeagueView.jsx`.
  - It owns real base-team hydration behavior and a clearly bounded file-level API surface.
  - The file-level boundary remained clean under execution-time inspection; no blocker required widening into adjacent consumers.
- Why it wins:
  - It is still the smallest coherent live-business-logic boundary with strong runtime relevance and a cleaner cutoff than the broader validator-support and orchestration families.

### Candidate 2 — Validator Runtime-Support Cluster
- Includes:
  - `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
  - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
  - `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
- Excludes:
  - `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/performanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCache.js`
  - `src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
  - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.debug.js`
- Estimated live JS business-logic file count: `4`.
- Why it is a serious candidate:
  - It stays close to active Trade Machine validator flow and remains runtime-/test-live through validation support imports.
- Why it is not the best next arc:
  - It mixes cache, monitoring, and debug concerns.
  - Nearby alternate cache/debug residue still makes the cutoff less clean than the single-file data-access boundary.
  - It is materially larger than the recommended one-file scope.

### Candidate 3 — Season / Pipeline Orchestration Family
- Includes:
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
- Excludes:
  - `src/features/architect/utils/runOffseason.js` from the core count because it is a thin wrapper over the TS offseason engine
  - already-closed helper families these files consume
- Estimated live JS business-logic file count: `2` core files plus `1` wrapper.
- Why it is not a good next arc:
  - The files are extremely large, heavily coupled, and covered by broad runtime and guardrail surface area.
  - This family is much larger and riskier than the next recommended slice.

### Candidate 4 — Low-Risk Wrapper Batch
- Includes:
  - `src/features/architect/hooks/useArchitectPlayerData.js`
  - `src/features/architect/utils/runOffseason.js`
  - `src/features/architect/utils/seasonUtils.js`
  - `src/features/architect/utils/architectCore.js`
  - `src/features/architect/utils/salaryUtils.js`
- Excludes:
  - broader UI/component files
  - closed TS-backed helper boundaries
- Estimated live JS business-logic file count: `3` runtime-live wrappers plus `2` lower-value wrapper/barrel surfaces.
- Why it is not the best next arc:
  - The batch is mostly wrapper cleanup rather than the strongest remaining business-logic slice.
  - It is safer than the orchestration family but still less valuable and less coherent than the recommended data-access boundary.

## 4. Recommended Next Scope
- Recommended next migration scope: `src/features/architect/utils/firebaseTeamPlanHelpers.js`.
- Why it is the best next choice:
  - Execution-time repo evidence confirmed it remains runtime-live through the base-team loading path without needing adjacent consumer widening.
  - It stayed within the fixed rule: smallest coherent live-business-logic boundary with strong runtime relevance and a cleaner cutoff than broader support or orchestration families.
  - It beat the validator runtime-support cluster because that cluster is broader and more mixed, and it beat the wrapper batch because the wrapper batch is lower-value cleanup.
- Recommended execution shape: one grouped mini-arc / single-file boundary.
- Hard rule for any follow-up execution:
  - Do not silently widen this scope to include `useArchitectPlayerData.js`, `teamLoader.ts`, `worldTeamData.ts`, `LeagueView.jsx`, or `worldManager`-adjacent consumers unless migration execution proves `firebaseTeamPlanHelpers.js` cannot stand cleanly on its own.
  - If that happens, document the exact blocker instead of auto-expanding the scope.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/firebaseTeamPlanHelpers.js`
  - Why it belongs in scope:
    - It remains the JS authority for base-team hydration, base-team cap-sheet loading, and the mixed exported helper surface around team/free-agent data access.
    - Current importer evidence shows `hydrateBaseTeam` is runtime-live through `teamLoader.ts`, and `loadTeamCapSheet` is runtime-live through `worldTeamData.ts` and `LeagueView.jsx`.
    - `prepareCapSheet`, `getAllTeams`, `saveFreeAgents`, and `loadFreeAgents` remain part of the file-level export contract even though current repo evidence shows weaker or dormant live usage for some of them.
  - Central or peripheral: `central`.

## 6. Validation / Inspection Run
- Inspection commands and steps used:
  - `git status --short`
  - `sed -n '1336,1396p' docs/architect/TRADE_MACHINE_MASTER.md`
  - `rg -n "loadTeamCapSheet|hydrateBaseTeam|loadFreeAgents|saveFreeAgents|getAllTeams|prepareCapSheet" src tests`
  - `rg -n "validationCacheService\\.js|validationPerformanceMonitor\\.js|engineUtils\\.js|tradeDebug\\.js|seasonManager|mutationPipeline|runOffseason|useArchitectPlayerData|seasonUtils|architectCore|salaryUtils" src tests`
  - `rg -n "useCapSheetState|draftPickUtils|cashUtils|freeAgentLogic|rosterUtils|temp_mutation_code|resolveValidationEntitlements|enforcementValidation|validatorFactory|validationCacheManager|tradeValidator\\.debug" src tests`
  - `wc -l src/features/architect/utils/firebaseTeamPlanHelpers.js src/features/architect/utils/tradeMachine/cache/validationCacheService.js src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js src/features/architect/utils/tradeMachine/engine/engineUtils.js src/features/architect/utils/tradeMachine/engine/tradeDebug.js src/features/architect/utils/seasonManager.js src/features/architect/utils/mutationPipeline.js src/features/architect/utils/runOffseason.js src/features/architect/hooks/useArchitectPlayerData.js src/features/architect/utils/seasonUtils.js src/features/architect/utils/architectCore.js src/features/architect/utils/salaryUtils.js`
  - targeted `sed -n` reads of:
    - `src/features/architect/utils/firebaseTeamPlanHelpers.js`
    - `src/features/architect/hooks/useCapSheetState.js`
  - earlier targeted reads/importer checks that informed the final comparison:
    - `seasonManager.js`
    - `runOffseason.js`
    - `mutationPipeline.js`
    - `validationCacheService.js`
    - `validationPerformanceMonitor.js`
    - `engineUtils.js`
    - `tradeDebug.js`
- What the inspection proved:
  - `firebaseTeamPlanHelpers.js` remains runtime-live and still stands as a clean file-level boundary without forced widening into adjacent TS/JS consumers.
  - The validator runtime-support alternative remains serious but broader and more mixed.
  - The season/pipeline family remains much larger and riskier.
  - The wrapper batch remains a lower-value cleanup option, not the strongest next business-logic boundary.
  - Zero-import or weak-import exclusions were explicitly re-checked before exclusion:
    - `useCapSheetState.js`: inactive legacy hook with no live importer evidence
    - `draftPickUtils.js`: test-only helper residue
    - `cashUtils.js`, `freeAgentLogic.js`, `rosterUtils.js`: inactive utility residue
    - `temp_mutation_code.js`: scratch/orphan residue
    - `resolveValidationEntitlements.js`: unwired wrapper
    - `enforcementValidation.js`: unwired legacy rule residue
    - `validatorFactory.js`: zero-import support residue
    - `validationCacheManager.js`: unwired alternate cache manager
    - `tradeValidator.debug.js`: manual debug-script residue
- Required validation commands run:
  - `npm run typecheck`
    - Result: PASS.
  - `npm run validate:project`
    - Result: PASS.
- Commands intentionally skipped:
  - broader `npm run test:* -- --reporter=dot` suites
  - Reason: static inspection resolved the scope ranking cleanly and did not leave a runtime ambiguity that required broader test proof.

## 7. Complexity / Risk Assessment
- Relative size versus the just-closed E75/E77/E78/E80 work:
  - The recommended next arc is materially smaller than that grouped recent work.
  - It is larger and more shape-sensitive than the single-file E80 consent helper pass, but still substantially smaller than the validator-support cluster and far smaller than the season/pipeline family.
- Likely execution shape:
  - Best handled as one grouped mini-arc / single-file boundary.
  - The remaining frontier does not yet justify taking a broader batched low-risk pass ahead of this file.
- Larger-batch answer:
  - A low-risk wrapper batch exists, but it is lower-value cleanup and not cleaner than `firebaseTeamPlanHelpers.js`.
  - The validator runtime-support cluster is a plausible later grouped arc, but it is not a cleaner next cut than the recommended one-file boundary.
- Key risks / caveats:
  - preserve the current `hydrateBaseTeam` result shape, including `players`, `roster`, `activeContracts`, draft-pick views, flattened exception helpers, hard-cap flags, `baseline`, and `totals`
  - preserve team-code resolution and base-team fallback behavior in `loadTeamCapSheet`
  - preserve current export compatibility for weaker/dormant exports such as `prepareCapSheet`, `getAllTeams`, `saveFreeAgents`, and `loadFreeAgents`
  - preserve the source-data boundary: base-team/base-player reads stay read-only, while the existing `freeAgents` helper behavior remains unchanged

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E81 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new E81 entry records that:
  - E39 remains closed
  - E41 remains complete
  - the E43/E44 `tradeContext` mini-arc remains complete
  - the E46 trade-facing helper foundation remains complete
  - the E48 `capTotals` mini-arc remains complete
  - the E50 `persistenceContracts` arc remains complete
  - the E52 season-transition helper arc remains complete
  - the E54 exception-history mini-arc remains complete
  - the E56/E57 `playerRulesProfile` arc remains complete
  - the E59 contract/season helper arc remains complete
  - the E61/E62 non-trade cap-legality arc remains complete
  - the E64 world-aware loader mini-arc remains complete
  - the E66/E67 entitlement presentation arc remains complete
  - the E69 Trade Machine validation snapshot/accessor arc remains complete
  - the E71 Architect contract/cap hook arc remains complete
  - the E73 world-lifecycle arc remains complete
  - the E75 trade-execution helper arc remains complete
  - the E77 helper-trio sub-arc remains complete
  - the E78 `useTradeMachine` hook arc remains complete
  - the E80 consent helper arc remains complete
  - current inspection indicated `firebaseTeamPlanHelpers.js` as the leading candidate and execution-time repo evidence confirmed it as the final recommended next scope
  - the estimated live JS business-logic count for that scope is `1`
  - the next arc should likely be handled as one grouped mini-arc rather than split or widened into a larger batched low-risk pass
