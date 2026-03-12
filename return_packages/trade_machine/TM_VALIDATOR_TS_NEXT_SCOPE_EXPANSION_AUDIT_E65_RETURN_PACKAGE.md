# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E65 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the current repo state is the entitlement projection/display helper boundary centered on `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`, `src/features/architect/utils/entitlements/formatEntitlement.js`, and `src/features/architect/tradeMachine/utils/entitlementWarnings.js`.
- That recommended scope currently reads as `3` live JS business-logic files.
- It looks worth doing next because it is runtime-live, adjacent to the already-migrated Trade Machine/entitlement support work, and more cleanly bounded than the loader-adjacent world data access pair.

## 2. Closed Scope Confirmation
- Confirmed as still closed/complete in this audit: E39 validator-adjacent Trade Machine scope, E41 draft-pick resolution utility arc, E43/E44 `tradeContext` mini-arc, E46 trade-facing helper foundation arc, E48 `capTotals` mini-arc, E50 `persistenceContracts` arc, E52 season-transition helper arc, E54 exception-history mini-arc, E56/E57 `playerRulesProfile` arc, E59 contract/season helper arc, E61/E62 non-trade cap-legality arc, and E64 world-aware loader mini-arc.
- No repo evidence required reopening any of those boundaries.
- The audit avoided silently reopening them by re-checking the known JS residue in those areas and classifying it before counting anything:
  - `src/features/architect/utils/teamLoader.js` still reads as a pure E64 compatibility shim over `teamLoader.ts`.
  - `src/features/architect/utils/capTotals/index.js`, `src/features/architect/utils/persistenceContracts/index.js`, `src/features/architect/utils/tradeContext/index.js`, `src/features/architect/utils/playerRulesProfile/index.js`, `src/features/architect/utils/seasonUtils.js`, `src/features/architect/utils/timingUtils.js`, and `src/features/architect/utils/tradeMachine/index.js` all read as barrel or compatibility surfaces rather than fresh live-business-logic candidates.
  - E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, and E64 JS holdouts with `.ts` authorities were not recounted as next-scope logic.

## 3. Candidate Next Scopes

### Loader-Adjacent World Data Access
- Scope name: loader-adjacent world data access boundary.
- Includes: `src/features/architect/utils/worldManager.js` and `src/features/architect/utils/firebaseTeamPlanHelpers.js`.
- Excludes: `src/features/architect/utils/teamLoader.js` because E64 already closed it as shim-only; `src/features/architect/utils/worldTeamData.ts` and other TS consumers; broader orchestration files like `mutationPipeline.js` and `seasonManager.js`.
- Estimated live JS business-logic file count: `2`.
- Why it was a serious candidate:
  - It was the expected leading candidate from current repo inspection because both files sit directly next to the E64 loader boundary.
  - Importer evidence shows real runtime usage: `worldManager.js` is consumed by GM dashboard surfaces plus `mutationPipeline.js`, `seasonManager.js`, and `teamLoader.ts`; `firebaseTeamPlanHelpers.js` is consumed by `teamLoader.ts`, `worldTeamData.ts`, and `LeagueView.jsx`.
- Why it is not the best next arc:
  - The pair is broader and more coupled than E64. `worldManager.js` spans world CRUD, archiving, branching, stats, draft-position storage, and ownership repair instead of one narrow loader concern.
  - `firebaseTeamPlanHelpers.js` mixes base-team hydration, static team loading, and free-agent pool helpers, including write helpers (`saveFreeAgents`) that are not part of the same clean read-only loader slice.
  - As a grouped recommendation, the cutoff is less clean than the entitlement/display pair.

### Entitlement Projection / Display Helpers
- Scope name: entitlement projection/display helper boundary.
- Includes: `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`, `src/features/architect/utils/entitlements/formatEntitlement.js`, and `src/features/architect/tradeMachine/utils/entitlementWarnings.js`.
- Excludes: TS entitlement resolution and pick-rule infrastructure (`entitlementResolver.ts`, `pickRulesResolver.ts`, `entitlementTerms.ts`), plus the JSX UI consumers that render the results.
- Estimated live JS business-logic file count: `3`.
- Why it is a good next arc:
  - It is a coherent family of pure runtime helpers for entitlement projection, formatting, and warning generation.
  - Importer evidence shows direct runtime use in `EntitlementPickRow.jsx`, `EntitlementPicksList.jsx`, `TradeReceiptPanel.jsx`, `TradeSummaryPanel.jsx`, and `TradeExportCapture.jsx`.
  - The cutoff is clean: helper logic only, no Firestore I/O, no mutation orchestration, no public API redesign pressure.
- Why it still needs slicing discipline:
  - `entitlementPickRowProjection.js` is the heavy center of gravity, while `formatEntitlement.js` and `entitlementWarnings.js` are smaller satellite helpers.
  - This reads better as one recommended family split into smaller execution slices than as a single-file mini-arc like E64.

### Trade UI Utility Pocket
- Scope name: Trade Machine UI utility pocket.
- Includes: `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js` and `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`.
- Excludes: `useTradeMachine.js`, `useTradeMachineSnapshot.js`, validator engine files, and UI components that consume the helpers.
- Estimated live JS business-logic file count: `2`.
- Why it was a serious candidate:
  - It is smaller than the loader-adjacent pair and clearly runtime-live.
  - `getOfficialSalaryMatchingSnapshot.js` is the SSOT selector for salary-matching display across multiple UI surfaces.
  - `computeTradeDraftKey.js` is the stale-validation key helper used in `useTradeMachine.js`.
- Why it is not the best next arc:
  - The two files do not form as clean a grouped boundary as the entitlement/display family. One is a validator-output selector; the other is a draft-state cache key helper.
  - The pocket reads more like two separate future micro-arcs than one strong next grouped scope.

### Larger Orchestration Surfaces
- Scope name: broader orchestration / world-mutation surfaces.
- Includes: `src/features/architect/utils/schemaAdapter.js`, `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/utils/seasonManager.js`, `src/features/architect/utils/tradeManager.js`, and `src/features/architect/utils/runOffseason.js`.
- Excludes: already-closed helper families those files depend on, plus TS modules such as `offseason/resolveOffseasonTransition.ts`.
- Estimated live JS business-logic file count: `5`.
- Why it is not a good next arc:
  - This is materially larger and more coupled than the other candidates.
  - `mutationPipeline.js` and `seasonManager.js` are central orchestration hubs with heavy runtime and test coupling, so they violate the “smallest coherent boundary” rule for the next slice.
  - `runOffseason.js` is small, but it is a wrapper hanging off the larger offseason/orchestration area rather than a better next family by itself.

### Zero-Import / Inactive JS Files Explicitly Inspected
- `src/features/architect/utils/cashUtils.js`: unimported isolated seasonal cash helper; not a strong next arc.
- `src/features/architect/utils/freeAgentLogic.js`: unimported legacy free-agent signing helper; business logic exists, but current importer evidence does not show live runtime use.
- `src/features/architect/utils/rosterUtils.js`: unimported roster-window helper; too isolated and currently inactive.
- `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`: unimported validation wrapper around TS entitlement resolution; inactive wrapper, not counted as live.
- `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`: unimported cache/instrumentation support class; not a live next-scope business-logic boundary.
- `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`: unimported legacy enforcement consolidation; not currently runtime-live.
- `src/features/architect/utils/temp_mutation_code.js`: scratch residue with no exports/importers; excluded from live-business-logic counts.

## 4. Recommended Next Scope
- Recommended next migration scope: the entitlement projection/display helper boundary consisting of `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`, `src/features/architect/utils/entitlements/formatEntitlement.js`, and `src/features/architect/tradeMachine/utils/entitlementWarnings.js`.
- Why it is the best next choice:
  - It beats the loader-adjacent pair on cutoff cleanliness because it stays inside pure projection/formatting/warning logic rather than mixing reads, writes, world CRUD, and dashboard support.
  - It beats the trade UI utility pocket on coherence because the three files support one entitlement-display workflow rather than two loosely related UI utilities.
  - It stays meaningfully runtime-live across several active Trade Machine surfaces without jumping straight into the very large orchestration hubs.
- Recommended execution shape: split into sub-arcs rather than one all-at-once grouped conversion.
  - First sub-arc: `entitlementPickRowProjection.js`.
  - Second sub-arc: `formatEntitlement.js` plus `entitlementWarnings.js`.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
  - Why it belongs in scope: it is the main projection layer that converts effective entitlements into canonical pick-row display data consumed by multiple Trade Machine UI surfaces.
  - Central or peripheral: central.
- `src/features/architect/utils/entitlements/formatEntitlement.js`
  - Why it belongs in scope: it provides the shared entitlement-label and sort helpers used by entitlement list/rendering surfaces that sit directly next to the projection layer.
  - Central or peripheral: peripheral.
- `src/features/architect/tradeMachine/utils/entitlementWarnings.js`
  - Why it belongs in scope: it computes the non-blocking entitlement warning messages and display badges used by Trade Machine export/summary surfaces in the same entitlement UX family.
  - Central or peripheral: peripheral.

## 6. Validation / Inspection Run
- Files changed:
  - `docs/architect/TRADE_MACHINE_MASTER.md`
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E65_RETURN_PACKAGE.md`
- Static repo inspection commands used:
  - `rg --files return_packages/trade_machine docs/architect src/features/architect | rg 'TM_VALIDATOR_TS_WORLD_AWARE_TEAM_LOADER_E64_RETURN_PACKAGE\\.md|TRADE_MACHINE_MASTER\\.md|\\.js$|\\.ts$'`
  - targeted `sed -n` reads over the E64 return package, `docs/architect/TRADE_MACHINE_MASTER.md`, the serious candidate files, and the barrel/shim/support residues named in the audit
  - `rg -n "(from|require\\()" ...` importer scan over `src/features/architect` plus `src/tests` / `tests` to identify runtime vs test usage
  - targeted local `node` inspection scripts to summarize remaining JS files, `.ts` peer presence, importer counts, and candidate-scope usage
- What those inspection steps proved:
  - E64 stayed closed and its adjacent dependencies were still the main nearby non-closed JS candidate family.
  - The entitlement/display helper trio is runtime-live and more cleanly bounded than the loader-adjacent pair.
  - The trade UI utility pocket is smaller but less coherent as one grouped arc.
  - Several leftover JS files are barrels, compatibility layers, inactive wrappers, or scratch residue and should not be counted as the next live-business-logic scope.
- Validation commands run after writing the E65 docs:
  - `npm run typecheck`
  - `npm run validate:project`
- Results:
  - `npm run typecheck`: PASS.
  - `npm run validate:project`: PASS.
- Commands intentionally skipped:
  - `npm run test:diff -- --reporter=dot`: skipped because this was a doc/audit pass and static inspection resolved scope selection without behavior uncertainty.
  - `npm run test:architect -- --reporter=dot`: skipped because no code behavior changed and the audit did not require broader runtime proof.
  - `npm run build`: skipped because no UI/routes/components changed in this pass.

## 7. Complexity / Risk Assessment
- Relative to the just-closed E64 world-aware loader mini-arc, the recommended next arc is larger.
- It still looks worth batching as one recommended family, but the execution should likely be split into smaller slices rather than handled as one pass.
- Main risks/caveats:
  - `entitlementPickRowProjection.js` is a large central file with parsing and fallback behavior that feeds several UI surfaces, so behavior drift would be visible quickly.
  - The scope crosses two nearby folders (`utils/entitlements` and `tradeMachine/utils`), which is still coherent but needs a strict “entitlement presentation only” cutoff.
  - Existing UI copy, label text, sort behavior, and warning wording should be preserved exactly unless a future execution prompt explicitly allows behavior changes.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E65 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
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
  - the recommended next migration scope is the entitlement projection/display helper boundary.
  - the estimated live JS business-logic count for that scope is `3`.
  - the next arc should likely be split into a projection core pass and a smaller formatting/warnings follow-up.
