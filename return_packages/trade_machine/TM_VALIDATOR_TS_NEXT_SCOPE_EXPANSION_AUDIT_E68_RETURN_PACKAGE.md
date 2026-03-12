# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E68 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the actual current repo state is the Trade Machine validation snapshot/accessor boundary centered on `src/features/architect/hooks/useTradeMachineSnapshot.js` and `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`.
- That recommended scope currently reads as `2` live JS business-logic files.
- It looks worth doing next because it is runtime-live, narrowly read-only, strongly cohesive around validator-result consumption, and more cleanly bounded than the loader-adjacent world data access pair or the larger orchestration surfaces.

## 2. Closed Scope Confirmation
- Confirmed as still closed/complete in this audit: E39 validator-adjacent Trade Machine arc, E41 draft-pick resolution utility arc, E43/E44 `tradeContext` mini-arc, E46 trade-facing helper foundation arc, E48 `capTotals` mini-arc, E50 `persistenceContracts` arc, E52 season-transition helper arc, E54 exception-history mini-arc, E56/E57 `playerRulesProfile` arc, E59 contract/season helper arc, E61/E62 non-trade cap-legality arc, E64 world-aware loader mini-arc, and E66/E67 entitlement presentation arc.
- No repo evidence required reopening any of those boundaries.
- This audit avoided silently reopening them by re-checking nearby JS residue and classifying it before counting anything:
  - `src/features/architect/utils/teamLoader.js` still reads as a pure compatibility shim over `teamLoader.ts`, so the E64 loader boundary remains closed.
  - `src/features/architect/utils/seasonUtils.js` still reads as a deprecated wrapper over `seasonFormat.js`, not a fresh business-logic arc.
  - `src/features/architect/utils/capTotals/index.js`, `src/features/architect/utils/persistenceContracts/index.js`, `src/features/architect/utils/tradeMachine/index.js`, `src/features/architect/utils/playerRulesProfile/index.js`, and `src/features/architect/utils/exceptions/index.js` read as public barrel or compatibility surfaces rather than new migration candidates.
  - The E39-kept Trade Machine public entrypoints/barrels/constants remain intentionally outside the next-scope live-business-logic count unless a future pass proves a separate arc around them. This audit did not find that evidence.
  - The E66/E67 entitlement files are now TS-backed and remain closed; they were not recounted as a next scope.

## 3. Candidate Next Scopes

### Trade Machine Validation Snapshot / Accessor Boundary
- Scope name: Trade Machine validation snapshot/accessor boundary.
- Includes: `src/features/architect/hooks/useTradeMachineSnapshot.js` and `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`.
- Excludes: `src/features/architect/hooks/useTradeMachine.js`, `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`, `src/features/architect/tradeMachine/utils/devSntInjector.js`, `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`, validator engine/rules files, and all E39/E66/E67 closed files.
- Estimated live JS business-logic file count: `2`.
- Why it is a good next arc:
  - `getOfficialSalaryMatchingSnapshot.js` is the canonical selector for official validator salary-matching values and is used by runtime UI surfaces plus tests.
  - `useTradeMachineSnapshot.js` is the read-only accessor layer that exposes team/trade snapshots for UI consumption and is used by runtime UI plus tests.
  - The boundary is cleanly read-only and centered on one concern: consuming and exposing validator results without local recomputation.
- Why the cutoff makes sense:
  - `computeTradeDraftKey.js` is adjacent but solves stale-validation state freshness, not validator-result access.
  - `useTradeMachine.js` is stateful orchestration and would widen the arc into team loading, entitlement resolution, and user interactions.
  - Hard rule for future execution: do not silently widen this scope to include `computeTradeDraftKey.js`, `useTradeMachine.js`, validator engine files, or export utilities unless execution evidence proves the snapshot/accessor pair cannot stand cleanly without them. If that happens, the exact blocker should be documented rather than auto-expanding the scope.

### Loader-Adjacent World Data Access Boundary
- Scope name: loader-adjacent world data access boundary.
- Includes: `src/features/architect/utils/worldManager.js` and `src/features/architect/utils/firebaseTeamPlanHelpers.js`.
- Excludes: `src/features/architect/utils/teamLoader.js` because E64 already closed it as shim-only, plus `src/features/architect/utils/worldTeamData.ts`, `src/features/architect/hooks/useArchitectPlayerData.js`, `src/features/architect/utils/basicArchitectUtils.js`, `src/features/architect/utils/seasonManager.js`, `src/features/architect/utils/mutationPipeline.js`, and `src/features/architect/utils/tradeManager.js`.
- Estimated live JS business-logic file count: `2`.
- Why it was a serious candidate:
  - Both files are runtime-live.
  - Importer evidence shows real runtime pressure from GM dashboard, League View, `teamLoader.ts`, `worldTeamData.ts`, `mutationPipeline.js`, and `seasonManager.js`.
- Why it is not the best next arc:
  - `worldManager.js` is broader than a helper slice: it spans world CRUD, branching, deletion/purge flows, stats updates, draft-position storage, and ownership repair.
  - `firebaseTeamPlanHelpers.js` mixes base-team hydration, base-team list loading, free-agent loading, and free-agent writes.
  - The grouped cutoff is noticeably less clean than the validator snapshot/accessor pair.

### Trade Machine Hook-Support Pocket
- Scope name: Trade Machine hook-support pocket.
- Includes: `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`, `src/features/architect/tradeMachine/utils/devSntInjector.js`, and `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`.
- Excludes: `src/features/architect/hooks/useTradeMachine.js`.
- Estimated live JS business-logic file count: `3`.
- Why it was a serious candidate:
  - All three files are runtime-live and adjacent to the Trade Machine UI flow.
  - They are smaller than the loader/world pair and much smaller than the orchestration family.
- Why it is not a good next arc:
  - The three files do not form one coherent subsystem.
  - `computeTradeDraftKey.js` handles stale-validation freshness, `devSntInjector.js` is DEV-only S&T helper logic, and `tradeExportUtils.js` is narrow export-payload cleanup.
  - This reads as a grab-bag of separate micro-arcs, not one clean next slice.

### Larger Orchestration Family
- Scope name: larger orchestration family.
- Includes: `src/features/architect/utils/schemaAdapter.js`, `src/features/architect/utils/tradeManager.js`, `src/features/architect/utils/seasonManager.js`, and `src/features/architect/utils/mutationPipeline.js`.
- Excludes: `src/features/architect/utils/runOffseason.js` from the core count because it is a thin wrapper over the TS offseason engine, plus all already-closed helper families those files depend on.
- Estimated live JS business-logic file count: `4`.
- Why it is not a good next arc:
  - It is materially larger and more coupled than the other candidates.
  - `seasonManager.js` and `mutationPipeline.js` are central orchestration hubs with heavy runtime and test coupling.
  - Choosing this next would violate the “smallest coherent live-business-logic boundary” rule.

### Zero-Import / Explicitly Excluded JS Files
- `src/features/architect/utils/cashUtils.js`
  - Classification: isolated seasonal cash helper.
  - Exclusion reason: zero-import and too isolated to outrank the recommended snapshot/accessor boundary.
- `src/features/architect/utils/freeAgentLogic.js`
  - Classification: legacy free-agent signing helper with real logic.
  - Exclusion reason: zero-import and not proven runtime-live by current importer evidence.
- `src/features/architect/utils/rosterUtils.js`
  - Classification: isolated roster-window helper.
  - Exclusion reason: zero-import and not part of a stronger remaining live family.
- `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
  - Classification: unimported entitlement-resolution wrapper around TS entitlement authorities.
  - Exclusion reason: inactive wrapper, not current runtime scope.
- `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - Classification: unimported experimental cache/instrumentation support surface.
  - Exclusion reason: no current importer evidence and not a clean user-facing business-logic boundary.
- `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
  - Classification: unimported legacy enforcement consolidation.
  - Exclusion reason: inactive legacy residue.
- `src/features/architect/hooks/useCapSheetState.js`
  - Classification: unimported local UI-state hook with business logic.
  - Exclusion reason: currently inactive and not part of a clearer live migration family.
- `src/features/architect/utils/architectCore.js`
  - Classification: zero-import aggregator/index surface.
  - Exclusion reason: entrypoint/barrel shape, not a next-scope business-logic arc.
- `src/features/architect/utils/temp_mutation_code.js`
  - Classification: scratch residue with no imports or live export contract.
  - Exclusion reason: not a candidate business-logic scope.
- `src/features/architect/utils/validatePhase21.test.js`
  - Classification: test file stored under `utils/`, not production business logic.
  - Exclusion reason: explicitly not a migration candidate.
- `src/features/architect/utils/capProjections.js`
  - Classification: live data/constants surface with very high importer count.
  - Exclusion reason: it is not a “next business-logic arc” even though it is runtime-live.

## 4. Recommended Next Scope
- Recommended next migration scope: the Trade Machine validation snapshot/accessor boundary consisting of `src/features/architect/hooks/useTradeMachineSnapshot.js` and `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`.
- Why it is the best next choice:
  - It is the smallest coherent remaining runtime-live JS boundary with a clean cutoff.
  - It stays entirely in read-only validator-result selection/access behavior and avoids widening into orchestration, data loading, or mixed helper grab-bags.
  - It has clear runtime relevance across Trade Machine UI surfaces and focused test coverage.
- Recommended execution shape: one grouped mini-arc.
- Hard rule for that future execution:
  - Do not silently widen the recommended scope to include `computeTradeDraftKey.js`, `useTradeMachine.js`, validator engine files, or export utilities unless execution evidence shows the snapshot/accessor boundary cannot stand cleanly without them.
  - If that happens, document the exact blocker instead of auto-expanding the scope.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`
  - Why it belongs in scope: it is the canonical selector for official validator salary-matching values and exposes the exact rule/result fields used across multiple UI surfaces.
  - Usage read: runtime UI plus tests.
  - Central or peripheral: central.
- `src/features/architect/hooks/useTradeMachineSnapshot.js`
  - Why it belongs in scope: it is the consumer-facing accessor layer that reads validator output through the official selector and exposes team/trade snapshots for Trade Machine UI consumption.
  - Usage read: runtime UI plus tests.
  - Central or peripheral: peripheral to the selector, but still core to the recommended boundary.

## 6. Validation / Inspection Run
- Files changed:
  - `docs/architect/TRADE_MACHINE_MASTER.md`
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E68_RETURN_PACKAGE.md`
- Static inspection commands and steps used:
  - `rg --files src/features/architect | rg '\\.js$'`
  - `rg -n "^export (async )?function|^export const " src/features/architect/utils/worldManager.js src/features/architect/utils/firebaseTeamPlanHelpers.js src/features/architect/hooks/useTradeMachineSnapshot.js src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js src/features/architect/tradeMachine/utils/computeTradeDraftKey.js src/features/architect/tradeMachine/utils/devSntInjector.js src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js src/features/architect/hooks/usePlayerRulesProfiles.js src/features/architect/utils/seasonManager.js src/features/architect/utils/mutationPipeline.js src/features/architect/utils/tradeManager.js src/features/architect/utils/schemaAdapter.js`
  - `wc -l src/features/architect/utils/worldManager.js src/features/architect/utils/firebaseTeamPlanHelpers.js src/features/architect/hooks/useTradeMachineSnapshot.js src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js src/features/architect/tradeMachine/utils/computeTradeDraftKey.js src/features/architect/tradeMachine/utils/devSntInjector.js src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js src/features/architect/hooks/usePlayerRulesProfiles.js src/features/architect/utils/seasonManager.js src/features/architect/utils/mutationPipeline.js src/features/architect/utils/tradeManager.js src/features/architect/utils/schemaAdapter.js`
  - targeted `sed -n` reads over `docs/architect/TRADE_MACHINE_MASTER.md`, the closed-scope return packages, the top candidate files, nearby barrel/shim residues, and the explicitly named zero-import files
  - targeted local `node - <<'NODE'` inspection scripts to classify remaining JS files, resolve actual importers across `src/` and `tests/`, and separate live business logic from shim/barrel/support residue
- What those steps proved:
  - the recommended snapshot/accessor pair is runtime-live and has the cleanest remaining cutoff
  - the loader-adjacent pair is runtime-live but materially broader and more coupled
  - the hook-support pocket is smaller but incoherent as one grouped next arc
  - the larger orchestration family is too coupled for the next migration slice
  - the named zero-import files were explicitly inspected before exclusion
- Validation commands run:
  - `npm run typecheck`
    - Result: PASS.
  - `npm run validate:project`
    - Result: PASS.
- Commands intentionally skipped:
  - `npm run test:diff -- --reporter=dot`
    - Skipped because this was a doc/audit pass and static inspection plus the required validation commands resolved scope selection without behavior uncertainty.
  - `npm run build`
    - Skipped because no UI/routes/components changed in this pass.
  - broader test suites such as `npm run test:trade -- --reporter=dot` and `npm run test:architect -- --reporter=dot`
    - Skipped because no production logic changed and the audit did not need broader runtime proof.

## 7. Complexity / Risk Assessment
- Relative to the just-closed E66/E67 entitlement presentation arc, the recommended next arc is smaller.
- It looks batchable as one grouped mini-arc rather than another long micro-pass chain.
- Key risks/caveats:
  - `getOfficialSalaryMatchingSnapshot.js` is a canonical selector, so any null/default drift or field-path drift would affect multiple UI surfaces quickly.
  - `useTradeMachineSnapshot.js` exposes a stable consumer-facing return shape; execution would need to preserve defaults and avoid introducing local recomputation.
  - The recommended scope must not be silently widened to `computeTradeDraftKey.js`, `useTradeMachine.js`, validator engine files, or export utilities unless a concrete dependency blocker is proven and documented explicitly.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E68 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that:
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
  - the recommended next migration scope is the Trade Machine validation snapshot/accessor boundary.
  - the estimated live JS business-logic count for that scope is `2`.
  - the next arc should likely remain one grouped mini-arc.
