# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E72 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the actual current repo state is `src/features/architect/utils/worldManager.js`.
- Estimated live JS business-logic count for the recommended scope: `1`.
- It looks worth doing next because it is runtime-live across GM Dashboard flows, downstream loader/orchestration callers, and tests while still presenting a tighter migration boundary than the remaining Trade Machine hook-support, data-loader, and orchestration families.

## 2. Closed Scope Confirmation
- Confirmed as still closed/complete in this audit: E39 validator-adjacent Trade Machine arc, E41 draft-pick resolution utility arc, E43/E44 `tradeContext` mini-arc, E46 trade-facing helper foundation arc, E48 `capTotals` mini-arc, E50 `persistenceContracts` arc, E52 season-transition helper arc, E54 exception-history mini-arc, E56/E57 `playerRulesProfile` arc, E59 contract/season helper arc, E61/E62 non-trade cap-legality arc, E64 world-aware loader mini-arc, E66/E67 entitlement presentation arc, E69 Trade Machine validation snapshot/accessor arc, and E71 Architect contract/cap hook arc.
- No repo evidence required reopening any of those boundaries.
- This audit avoided silently reopening them by re-checking nearby JS residue before counting anything:
  - same-name `.js` files with authoritative `.ts` peers were re-classified as shims, wrappers, or barrel surfaces and excluded from the live-business-logic count
  - E39-kept public entrypoints/barrels/constants were not recounted because they still read as compatibility/public-surface residue rather than a fresh migration arc
  - E41 draft-pick resolution files still read as TS-backed compatibility surfaces
  - E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, and E71 same-name `.js` files still read as compatibility shims, deprecated wrappers, or public barrel surfaces over authoritative TS peers

## 3. Candidate Next Scopes

### World Lifecycle And Draft-Position Boundary
- Scope name: `worldManager.js` standalone world-lifecycle + draft-position boundary.
- Includes: `src/features/architect/utils/worldManager.js`.
- Excludes: `src/features/architect/utils/firebaseTeamPlanHelpers.js`, `src/features/architect/hooks/useArchitectPlayerData.js`, `src/features/architect/utils/teamLoader.ts`, and orchestration consumers that call into world metadata or draft-position helpers.
- Estimated live JS business-logic file count: `1`.
- Why it is a good next arc:
  - the file is runtime-live in production UI, loader/orchestration code, and tests
  - it has a coherent boundary around world CRUD, metadata updates, branching, stats, draft-position storage, and the development-only ownership repair helper
  - it is smaller and cleaner than the nearby multi-file families that remain JS-heavy
- Why the cutoff makes sense:
  - `firebaseTeamPlanHelpers.js` is adjacent but mixes base-team hydration with free-agent reads/writes, which is a separate data-loader concern
  - `useArchitectPlayerData.js` is a thin subscription wrapper over TS-backed data access, not the next business-logic authority
  - `teamLoader.ts` and the orchestration consumers are downstream callers, not part of the JS authority being recommended

### Trade Machine Hook-Support Family
- Scope name: Trade Machine hook-support family.
- Includes: `src/features/architect/hooks/useTradeMachine.js`, `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`, `src/features/architect/tradeMachine/utils/devSntInjector.js`, and `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`.
- Excludes: the E69-closed snapshot/accessor pair and Trade Machine UI components.
- Estimated live JS business-logic file count: `4`.
- Why it was a serious candidate:
  - all four files are runtime-live and tied to active Trade Machine UI behavior
  - importer evidence shows direct production usage plus focused test coverage
- Why it is not the best next arc:
  - `useTradeMachine.js` is a large stateful orchestrator that widens quickly into world loading, entitlements, validation wiring, and export semantics
  - the three smaller support files are real logic, but they do not create a smaller cleaner boundary than the dominant hook

### Base-Team Loader / Free-Agent Data Boundary
- Scope name: `firebaseTeamPlanHelpers.js` data-loader boundary.
- Includes: `src/features/architect/utils/firebaseTeamPlanHelpers.js`.
- Excludes: `src/features/architect/hooks/useArchitectPlayerData.js`.
- Estimated live JS business-logic file count: `1`.
- Why it was a serious candidate:
  - it is runtime-live in shared views, `worldTeamData.ts`, `teamLoader.ts`, and tests
  - it owns base-team hydration, team-list reads, and free-agent read/write helpers
- Why it is not the best next arc:
  - it mixes two concerns that are adjacent but not as cleanly unified as `worldManager.js`
  - the file is more data-loader oriented and less self-contained as a next TypeScript migration slice than the recommended world-lifecycle boundary

### Core Orchestration Family
- Scope name: core orchestration family.
- Includes: `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/utils/seasonManager.js`, and `src/features/architect/utils/schemaAdapter.js`.
- Excludes: `src/features/architect/utils/tradeManager.js`, which remains business logic but currently reads as mostly test/barrel-facing rather than a stronger product-runtime driver than the three-file core.
- Estimated live JS business-logic file count: `3`.
- Why it is not a good next arc:
  - this family is materially larger and more coupled than the other serious candidates
  - `mutationPipeline.js` and `seasonManager.js` are central orchestration hubs with extensive runtime/test coupling and many existing guardrails
  - choosing this next would skip past a smaller coherent boundary that is still runtime-relevant

## 4. Recommended Next Scope
- Recommended next migration scope: `src/features/architect/utils/worldManager.js`.
- Why it is the best next choice:
  - it is the smallest coherent remaining runtime-live JS business-logic boundary with strong product relevance after E71
  - it stays adjacent to world-aware Architect flows without forcing the next pass to absorb base-team loading, hook wrappers, or orchestration consumers
  - its responsibilities are broad enough to matter but still contained inside one authoritative JS file
- Recommended execution shape: one grouped file-level arc.
- Hard rule:
  - Do not silently widen the recommended scope to include `firebaseTeamPlanHelpers.js`, `useArchitectPlayerData.js`, `teamLoader.ts`, or orchestration consumers unless execution evidence shows `worldManager.js` cannot stand cleanly as its own migration boundary.
  - If that happens, document the exact blocker instead of auto-expanding the scope.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/worldManager.js`
  - Why it belongs in scope: it is the authoritative JS surface for world creation, metadata reads/updates, soft delete and purge flows, branching, stats updates, draft-position persistence/read helpers, and the development-only ownership repair helper.
  - Runtime relevance: live in production world-management UI, world-aware loaders/orchestration, and automated coverage.
  - Central or peripheral: central.

## 6. Validation / Inspection Run
- Files changed:
  - `docs/architect/TRADE_MACHINE_MASTER.md`
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E72_RETURN_PACKAGE.md`
- Worktree / baseline inspection:
  - `git status --short`
  - Result: clean worktree before the E72 doc edits.
- JS surface discovery and classification:
  - `rg --files src/features/architect src/shared src/pages return_packages/trade_machine docs/architect | rg '(^src/features/architect/.*\\.js$|^return_packages/trade_machine/TM_VALIDATOR_TS_.*E(69|70|71)_RETURN_PACKAGE\\.md$|^docs/architect/TRADE_MACHINE_MASTER\\.md$)'`
  - local `node` classification pass to enumerate remaining Architect `.js` files, detect same-name TS peers, and measure importer usage across `src/` and `tests/`
  - What these proved:
    - the remaining JS surface is split between TS-backed shims/barrels, runtime-live business logic, support/config residue, and zero-import holdouts
    - `worldManager.js` remains a JS-only runtime authority with no same-name TS peer
- Targeted comparison reads and importer checks:
  - `rg -n "worldManager|createWorld|listUserWorlds|getWorldMetadata|updateWorldMetadata|updateWorldStats|getDraftPositionsMap|firebaseTeamPlanHelpers|prepareCapSheet|loadTeamCapSheet|hydrateBaseTeam|loadFreeAgents|saveFreeAgents" src tests`
  - `rg -n "useTradeMachine|computeTradeDraftKey|injectSyntheticSntPlayersIntoTeams|clearSyntheticSntPlayersFromTeams|hasSyntheticSntPlayers|extractUsedTpeIds|tradeExportUtils" src tests`
  - `rg -n "@/features/architect/utils/tradeManager|\\.\\/tradeManager|\\.\\.\\/.*tradeManager" src tests`
  - `rg -n "@/features/architect/utils/schemaAdapter|\\.\\/schemaAdapter|\\.\\.\\/.*schemaAdapter" src tests`
  - `rg -n "@/features/architect/utils/mutationPipeline|\\.\\/mutationPipeline|\\.\\.\\/.*mutationPipeline|@/features/architect/utils/seasonManager|\\.\\/seasonManager|\\.\\.\\/.*seasonManager" src tests`
  - targeted `sed -n` reads over `worldManager.js`, `firebaseTeamPlanHelpers.js`, `useTradeMachine.js`, `mutationPipeline.js`, `seasonManager.js`, `useArchitectPlayerData.js`, `useCapSheetState.js`, support/config files, zero-import holdouts, and the E70/E71/master-doc context
  - `wc -l` over the serious candidate files
  - What these proved:
    - `worldManager.js` is runtime-live and coheres as a standalone world-lifecycle boundary
    - `firebaseTeamPlanHelpers.js` is adjacent but mixes base-team hydration with free-agent read/write helpers
    - the Trade Machine hook-support family is real runtime logic but less coherent because `useTradeMachine.js` dominates the scope
    - the orchestration family is larger and more coupled than the recommended next slice
- Validation commands actually run:
  - `npm run typecheck`
  - Result: PASS.
  - `npm run validate:project`
  - Result: PASS.
- Commands intentionally skipped:
  - `npm run test:diff -- --reporter=dot`
  - Skipped because E72 is an audit/doc-only pass and did not change runtime code.
  - `npm run build`
  - Skipped because E72 did not change routes, components, or runtime UI behavior.
  - broader test suites such as `npm run test:trade -- --reporter=dot` and `npm run test:architect -- --reporter=dot`
  - Skipped because static inspection plus the required validation commands were sufficient to select scope with no unresolved runtime uncertainty.

## 7. Complexity / Risk Assessment
- Relative to the just-closed E71 Architect contract/cap hook arc, the recommended next arc looks larger and riskier.
- Even so, it still reads as batchable as one grouped file-level arc rather than another long chain of micro-passes.
- Key risks/caveats:
  - the file contains Firestore writes, callable deletion flow wiring, and timestamp-sensitive metadata updates that must preserve current error semantics
  - world branching, stats updates, and draft-position persistence helpers have broad consumer/test coverage, so return shapes and thrown-error behavior need exact compatibility
  - the next execution pass must not silently widen into `firebaseTeamPlanHelpers.js`, `useArchitectPlayerData.js`, `teamLoader.ts`, or orchestration consumers unless a concrete blocker is proven and documented

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E72 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
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
  - the E71 Architect contract/cap hook arc remains complete.
  - the recommended next migration scope is `src/features/architect/utils/worldManager.js`.
  - the estimated live JS business-logic count for that scope is `1`.
  - the next arc should likely remain one grouped file-level scope.
  - the non-widening rule now explicitly forbids silently pulling in `firebaseTeamPlanHelpers.js`, `useArchitectPlayerData.js`, `teamLoader.ts`, or orchestration consumers without a documented blocker.
