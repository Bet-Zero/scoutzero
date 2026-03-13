# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E70 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the actual current repo state is the Architect contract/cap hook boundary centered on `src/features/architect/hooks/usePlayerRulesProfiles.js` and `src/features/architect/hooks/useCapValidation.js`.
- That recommended scope currently reads as `2` live JS business-logic files.
- It looks worth doing next because both files are runtime-live, hook-level business logic with clean boundaries around player-rules profile consumption and contract-action validation, and the pair is materially smaller/cleaner than the remaining Trade Machine hook-support, world/data-access, and orchestration families.

## 2. Closed Scope Confirmation
- Confirmed as still closed/complete in this audit: E39 validator-adjacent Trade Machine arc, E41 draft-pick resolution utility arc, E43/E44 `tradeContext` mini-arc, E46 trade-facing helper foundation arc, E48 `capTotals` mini-arc, E50 `persistenceContracts` arc, E52 season-transition helper arc, E54 exception-history mini-arc, E56/E57 `playerRulesProfile` arc, E59 contract/season helper arc, E61/E62 non-trade cap-legality arc, E64 world-aware loader mini-arc, E66/E67 entitlement presentation arc, and E69 Trade Machine validation snapshot/accessor arc.
- No repo evidence required reopening any of those boundaries.
- This audit avoided silently reopening them by re-checking nearby JS residue before counting anything:
  - E39-kept JS public entrypoints/barrels/constants were not recounted because they still read as compatibility/public-surface residue rather than a fresh live business-logic arc.
  - E41 files (`pickIdUtils.js`, `swapResolution.js`, `conveyanceResolution.js`) still read as TS-backed compatibility surfaces, not reopened business logic.
  - E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, and E69 same-name `.js` files were re-checked as shim-only compatibility layers, deprecated wrappers, or barrel surfaces over authoritative `.ts` peers.
  - `src/features/architect/utils/seasonUtils.js` still reads as a deprecated wrapper, not a new migration arc.
  - `src/features/architect/utils/capTotals/index.js`, `src/features/architect/utils/persistenceContracts/index.js`, `src/features/architect/utils/playerRulesProfile/index.js`, `src/features/architect/utils/exceptions/index.js`, `src/features/architect/utils/tradeContext/index.js`, and `src/features/architect/utils/tradeMachine/index.js` still read as public barrel/API surfaces, not next-scope business logic.

## 3. Candidate Next Scopes

### Architect Contract/Cap Hook Boundary
- Scope name: Architect contract/cap hook boundary.
- Includes: `src/features/architect/hooks/usePlayerRulesProfiles.js`, `src/features/architect/hooks/useCapValidation.js`.
- Excludes: `src/features/architect/hooks/useArchitectPlayerData.js`, UI-facing hooks outside this pair, and component-level consumers such as `CapSheet.jsx`, `GMDashboard.jsx`, and `EditContractModal.jsx`.
- Estimated live JS business-logic file count: `2`.
- Why it is a good next arc:
  - Both files are runtime-live hook-level business logic used by production UI and tests.
  - Both sit directly on top of already-TS-backed rules/cap authorities, so the boundary is narrow and does not require reopening the earlier rule/helper arcs.
  - The pair reads as one coherent hook layer for contract/cap interactions rather than an arbitrary JS leftovers bucket.
- Why the cutoff makes sense:
  - `useArchitectPlayerData.js` is adjacent in the dashboard flow but currently reads as a thin subscription wrapper over TS-backed data access, not part of this contract/cap hook layer.
  - UI consumers should stay out of scope unless execution proves the hook pair cannot migrate cleanly without widening.
  - Current repo evidence supports this as one grouped mini-arc.

### Trade Machine Hook-Support Family
- Scope name: Trade Machine hook-support family.
- Includes: `src/features/architect/hooks/useTradeMachine.js`, `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`, `src/features/architect/tradeMachine/utils/devSntInjector.js`, `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`.
- Excludes: the E69-closed snapshot/accessor pair and Trade Machine component consumers.
- Estimated live JS business-logic file count: `4`.
- Why it was a serious candidate:
  - All four files are runtime-live and adjacent to active Trade Machine UI flows.
  - Importer evidence shows production usage plus focused test coverage.
- Why it is not the best next arc:
  - `useTradeMachine.js` is a large stateful orchestrator that widens quickly into entitlement resolution, team loading, validator wiring, and UI interaction semantics.
  - The three support utilities do not form one tight business-logic subsystem with the hook; they read as separate helper concerns.
  - This is more likely a future split arc than a clean immediate next slice.

### World/Data-Access Family
- Scope name: world/data-access family.
- Includes: `src/features/architect/utils/worldManager.js`, `src/features/architect/utils/firebaseTeamPlanHelpers.js`.
- Excludes: `src/features/architect/utils/teamLoader.js` because E64 remains complete, plus `src/features/architect/hooks/useArchitectPlayerData.js` and higher-level dashboard consumers.
- Estimated live JS business-logic file count: `2`.
- Why it was a serious candidate:
  - Both files are runtime-live and heavily referenced by production flows and tests.
  - They sit near the same Architect world-loading surface.
- Why it is not the best next arc:
  - `worldManager.js` spans CRUD, branching, archive/delete flows, stats updates, draft-position persistence, and ownership repair.
  - `firebaseTeamPlanHelpers.js` mixes base-team hydration, base-team reads, free-agent loading, and free-agent writes.
  - The boundary is broader and more Firestore-coupled than the recommended hook pair.

### Larger Orchestration Family
- Scope name: larger orchestration family.
- Includes: `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/utils/seasonManager.js`, `src/features/architect/utils/tradeManager.js`, `src/features/architect/utils/schemaAdapter.js`.
- Excludes: `src/features/architect/utils/runOffseason.js` because it now reads as a thin wrapper over the TS offseason engine.
- Estimated live JS business-logic file count: `4`.
- Why it is not a good next arc:
  - This is the highest-coupling remaining family and materially larger than the other candidates.
  - `mutationPipeline.js` and `seasonManager.js` are central orchestration hubs with extensive runtime/test coupling.
  - Choosing this next would skip past several smaller coherent boundaries still available.

### Explicitly Excluded Nearby Non-Candidates
- `src/features/architect/hooks/useArchitectPlayerData.js`
  - Classification: thin subscription wrapper over `subscribeArchitectPlayerData.ts`.
  - Exclusion reason: runtime-live but not the cleanest next business-logic arc; keep out of the recommended hook pair unless a concrete migration blocker proves otherwise.
- `src/features/architect/utils/capProjections.js`
  - Classification: deprecated cap data/constants surface.
  - Exclusion reason: live data/config surface, not a clean next business-logic migration arc.
- `src/features/architect/hooks/useCapSheetState.js`
  - Classification: zero-import local state hook with real logic.
  - Exclusion reason: inactive in current importer graph and not part of a stronger remaining live family.
- `src/features/architect/utils/cashUtils.js`
  - Classification: zero-import isolated seasonal cash helper.
  - Exclusion reason: too isolated to outrank the recommended boundary.
- `src/features/architect/utils/freeAgentLogic.js`
  - Classification: zero-import legacy signing helper with real logic.
  - Exclusion reason: not currently proven runtime-live by importer evidence.
- `src/features/architect/utils/temp_mutation_code.js`
  - Classification: scratch/abandoned mutation residue.
  - Exclusion reason: not a valid migration candidate.
- `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - Classification: unimported cache/instrumentation support surface.
  - Exclusion reason: inactive support code, not a user-facing business-logic boundary.
- `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
  - Classification: unimported legacy consolidation file.
  - Exclusion reason: inactive legacy residue.
- `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
  - Classification: unimported entitlement-resolution wrapper.
  - Exclusion reason: inactive wrapper over authoritative TS-backed entitlement access.
- `src/features/architect/utils/architectCore.js`
  - Classification: aggregator/barrel surface.
  - Exclusion reason: public API shape, not a next-scope business-logic arc.
- `src/features/architect/utils/tradeMachine/cache/validationCache.js`, `validationCacheService.js`, `validationCacheManager.js`, and `cacheInvalidationManager.js`
  - Classification: cache/monitoring/instrumentation support surfaces.
  - Exclusion reason: some are runtime-live, but they read as support/infrastructure rather than the smallest coherent business-logic boundary to migrate next.

## 4. Recommended Next Scope
- Recommended next migration scope: the Architect contract/cap hook boundary consisting of `src/features/architect/hooks/usePlayerRulesProfiles.js` and `src/features/architect/hooks/useCapValidation.js`.
- Why it is the best next choice:
  - It is the smallest coherent remaining runtime-live JS business-logic boundary that stays adjacent to already-closed cap/rules work.
  - Both files are hook-level adapters over TS-backed rule/cap authorities, so the migration can stay narrow without reopening helper arcs or widening into world orchestration.
  - The pair has clear production relevance across the Cap Sheet, GM Dashboard, and contract-editing flows while remaining much smaller than the world/data-access and orchestration families.
- Recommended execution shape: one grouped mini-arc.
- Hard rule for future execution:
  - Do not silently widen the recommended scope to include `useArchitectPlayerData.js`, UI-facing hooks, or component-level consumers unless execution evidence shows the contract/cap hook pair cannot stand cleanly without them.
  - If that happens, document the exact blocker instead of auto-expanding the scope.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/hooks/usePlayerRulesProfiles.js`
  - Why it belongs in scope: it computes and memoizes PlayerRulesProfile objects for Architect UI consumers, bridging live player/team context into the already-TS-backed salary/rules engine.
  - Usage read: runtime UI plus smoke/mock coverage.
  - Central or peripheral: central.
- `src/features/architect/hooks/useCapValidation.js`
  - Why it belongs in scope: it provides the live contract-action validation/guardrail hook used by contract-editing UI, including warning/error assembly and signing guardrail derivation.
  - Usage read: runtime UI plus behavior/guardrail coverage.
  - Central or peripheral: central.

## 6. Validation / Inspection Run
- Worktree state check:
  - `git status --short`
  - Result: clean worktree before doc edits.
- JS surface discovery and classification:
  - `rg --files src/features/architect -g '*.js'`
  - `rg --files src/features/architect -g '*.jsx'`
  - `rg --files src -g '*.js' | rg 'tradeMachine|architect/utils|architect/hooks|architect/admin|architect/capSheet'`
  - `node <<'NODE' ...` local classification script to enumerate remaining Architect `.js` files, detect same-name TS peers, and count importers across `src/` and `tests/`
  - What these proved: the remaining JS surface is mostly split between shim/barrel residue, a few runtime-live hook/support pockets, and large orchestration hubs.
- Targeted importer and file reads used to compare serious candidates and exclusions:
  - `rg -n "useTradeMachine|computeTradeDraftKey|isValidationCurrent|extractUsedTpeIds|injectSyntheticSntPlayersIntoTeams|clearSyntheticSntPlayersFromTeams|hasSyntheticSntPlayers" src tests`
  - `rg -n "createWorld|listUserWorlds|getWorldMetadata|updateWorldMetadata|updateWorldStats|getDraftPositionsMap|worldManager" src tests`
  - `rg -n "hydrateBaseTeam|loadTeamCapSheet|getAllTeams|saveFreeAgents|loadFreeAgents|firebaseTeamPlanHelpers|prepareCapSheet" src tests`
  - `rg -n "advanceSeason|processSeasonTransition|processTeamSeasonTransition|seasonManager" src tests`
  - `rg -n "persistWorldMutation|sanitizeTransientFieldsForPersistence|mutationPipeline|validateMutationLeagueInvariants|validateMutationEntitlementInvariants" src tests`
  - `rg -n "executeTrade|signFreeAgent|waivePlayer|extendPlayer|tradeManager|buildTradeTeamInput|buildTradeInput|adaptTeamForValidator|adaptTradeInputForValidator" src tests`
  - `rg -n "useArchitectPlayerData|subscribeArchitectPlayerData" src tests`
  - `rg -n "usePlayerRulesProfiles|computePlayerRulesProfile|profilesById|getProfileForYear" src tests`
  - `rg -n "useCapValidation|buildSigningGuardrails|calculateTeamCapHitLocal" src tests`
  - `rg -n "ValidationCache|validationCache|validationCacheService|cacheInvalidationManager|validationCacheManager" src tests`
  - targeted `sed -n` reads over the serious candidates, the E69 return package, the current master-doc area, and the explicitly excluded zero-import/support files
  - `wc -l` over the serious candidate files to compare scope size
  - What these proved:
    - the recommended contract/cap hook pair is runtime-live and coheres as one hook-level boundary
    - the Trade Machine hook-support family is runtime-live but awkwardly grouped because `useTradeMachine.js` dominates the scope
    - the world/data-access family is runtime-live but broader and more Firestore-coupled
    - the orchestration family is too large for the next slice
    - the named zero-import/support files were explicitly inspected before exclusion
- Validation commands run:
  - `npm run typecheck`
    - Result: PASS.
  - `npm run validate:project`
    - Result: PASS.
- Commands intentionally skipped:
  - `npm run test:diff -- --reporter=dot`
    - Skipped because this was an audit/doc pass and no production code changed.
  - `npm run build`
    - Skipped because no UI/routes/components changed in this pass.
  - broader suites such as `npm run test:trade -- --reporter=dot` and `npm run test:architect -- --reporter=dot`
    - Skipped because the required validation commands plus static inspection were sufficient to select scope without runtime uncertainty.

## 7. Complexity / Risk Assessment
- Relative to the just-closed E69 Trade Machine validation snapshot/accessor arc, the recommended next arc looks larger.
- Even so, it still reads as batchable as one grouped mini-arc rather than another long micro-pass chain.
- Key risks/caveats:
  - `usePlayerRulesProfiles.js` returns memoized maps/helpers consumed by UI surfaces, so a migration must preserve return shapes, lazy/default behavior, and dependency semantics.
  - `useCapValidation.js` has both named and default-export usage, so default-export compatibility and current warning/error assembly must remain exact.
  - Both hooks are UI-consumed, so the next execution pass must preserve current hook contracts without widening into `useArchitectPlayerData.js`, UI-facing hooks, or component-level consumers unless a concrete blocker is proven and documented.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E70 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Documented that:
  - E39 remains closed.
  - E41 remains complete.
  - the `tradeContext` mini-arc remains complete.
  - the E46 trade-facing helper foundation remains complete.
  - the E48 `capTotals` mini-arc remains complete.
  - the E50 `persistenceContracts` arc remains complete.
  - the E52 season-transition helper arc remains complete.
  - the E54 exception-history mini-arc remains complete.
  - the E56/E57 `playerRulesProfile` arc remains complete.
  - the E59 contract/season helper arc remains complete.
  - the E61/E62 non-trade cap-legality arc remains complete.
  - the E64 world-aware loader mini-arc remains complete.
  - the E66/E67 entitlement presentation arc remains complete.
  - the E69 Trade Machine validation snapshot/accessor arc remains complete.
  - the recommended next migration scope is the Architect contract/cap hook boundary.
  - the estimated live JS business-logic count for that scope is `2`.
  - the next arc should likely remain one grouped mini-arc.
  - the non-widening rule now explicitly forbids silently pulling in `useArchitectPlayerData.js`, UI-facing hooks, or component-level consumers without a documented blocker.
