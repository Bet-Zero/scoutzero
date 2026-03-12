# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E58 — EXECUTION RETURN PACKAGE

## 1. Summary
- The expected leading candidate from current repo inspection, the contract/season helper family centered on `src/features/architect/utils/seasonFormat.js`, `src/features/architect/utils/contractUtils.js`, and `src/features/architect/utils/contractSalaryUtils.js`, remained the strongest next migration scope after final verification against the actual current repo state.
- The recommended scope contains `3` live JS business-logic files.
- It looks worth doing next because it is still authoritative JS logic, directly adjacent to the now-closed E56/E57 `playerRulesProfile` arc, broadly used by runtime code plus tests, and materially cleaner than the remaining alternatives.
- Current execution evidence says it should likely be handled as **one grouped arc**, not split.

## 2. Closed Scope Confirmation
- **E39 remains closed.**
  - Re-checked the kept validator-adjacent JS entrypoints, barrels, and constants.
  - They still read as intentional public-surface or support residue, not the next live business-logic arc.
- **E41 remains complete.**
  - Re-checked `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`, `swapResolution.js`, and `conveyanceResolution.js`.
  - All three are still pure compatibility shims over authoritative `.ts` peers.
- **E43/E44 `tradeContext` remains complete.**
  - Re-checked `src/features/architect/utils/tradeContext/tradeContext.js`, `assertions.js`, and `legacy/index.js`.
  - All three are still shim-only compatibility surfaces, while `tradeContext/index.js` remains an intentional public barrel.
- **E46 remains complete.**
  - Re-checked `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js`.
  - All four remain pure compatibility shims over authoritative `.ts` implementations.
- **E48 remains complete.**
  - Re-checked `src/features/architect/utils/capTotals/computeTeamCapTotals.js`.
  - It remains a pure compatibility shim over `computeTeamCapTotals.ts`.
- **E50 remains complete.**
  - Re-checked `normalizeTeamTpe.js`, `validatePersistableShape.js`, `enforcement.js`, and `contracts.js`.
  - All four remain shim-only compatibility surfaces over authoritative `.ts` peers.
- **E52 remains complete.**
  - Re-checked `tpeLifecycle.js`, `exceptions/exceptionLifecycle.js`, and `entitlements/seasonManagerProjection.js`.
  - All three remain compatibility shims over authoritative `.ts` implementations.
- **E54 remains complete.**
  - Re-checked `src/features/architect/utils/exceptionHistory/historyHelpers.js`.
  - It remains a shim-only compatibility surface over `historyHelpers.ts`.
- **E56/E57 remains complete.**
  - Re-checked the five `playerRulesProfile` leaf-rule `.js` files plus `computeProfile.js`.
  - All six remain compatibility shims over authoritative `.ts` peers; only `index.js` and `types.js` remain intentionally out-of-scope barrel/JSDoc support.
- This audit avoided silently reopening prior scopes by directly reclassifying the kept `.js` files before counting new candidates. No prior scope required reopening.

## 3. Candidate Next Scopes

### A. Contract / Season Helper Family
- **Includes**
  - `src/features/architect/utils/seasonFormat.js`
  - `src/features/architect/utils/contractUtils.js`
  - `src/features/architect/utils/contractSalaryUtils.js`
- **Excludes**
  - `src/features/architect/utils/seasonUtils.js` because it is a deprecated re-export wrapper over `seasonFormat.js`
  - `src/features/architect/utils/capProjections.js` because it is a live data/constants surface, not business logic
  - adjacent cap-hold helpers because `contractUtils.js` only re-exports `calculateCapHold` from already-TS `capHolds.ts`, which is not a blocker that forces widening
- **Estimated live JS business-logic file count**
  - `3`
- **Why it is or isn’t a good next arc**
  - It is the best next arc.
  - It is still authoritative JS logic used by runtime hooks, UI surfaces, TS authority modules, and tests.
  - It is directly adjacent to the closed E56/E57 arc because the TS-backed `playerRulesProfile` authorities still depend on `seasonUtils.js`/`seasonFormat.js` and `contractUtils.js`.
  - It has a clean cutoff: `seasonFormat.js` is the shared season-normalization foundation, `contractUtils.js` is the contract utility hub, and `contractSalaryUtils.js` is the small salary lookup companion.
  - Execution evidence did **not** show a blocker that requires widening into adjacent contract/cap helpers.

### B. Entitlement Projection / Display Pair
- **Includes**
  - `src/features/architect/utils/entitlements/formatEntitlement.js`
  - `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
- **Excludes**
  - `src/features/architect/utils/entitlements/seasonManagerProjection.js` because the E52 scope already closed it as a shim-backed surface
  - existing TS-backed entitlement resolver/terms surfaces
- **Estimated live JS business-logic file count**
  - `2`
- **Why it is or isn’t a good next arc**
  - It is coherent, live, and still authoritative JS.
  - It is heavily UI-facing projection logic used by `EntitlementPickRow`, `TradeReceiptPanel`, `TradeSummaryPanel`, `EntitlementPicksList`, and focused tests.
  - It is not the best next arc because it is less adjacent to the just-closed E56/E57 rules work and lower leverage than the contract/season helper family.

### C. Remaining Trade Machine Support Residue
- **Includes**
  - live support surfaces such as `tradeExportUtils.js`, `validationCache.js`, `validationCacheService.js`, `cacheInvalidationManager.js`, `engineUtils.js`, `performanceMonitor.js`, `validationPerformanceMonitor.js`, `tradeDebug.js`, and `validationDebugMonitor.js`
- **Excludes**
  - `validatorFactory.js`, `resolveValidationEntitlements.js`, and `validationCacheManager.js` after explicit zero-import inspection
  - `index.js` barrel files, constants-only files, and `tradeValidator.debug.js`
- **Estimated live JS business-logic file count**
  - `0` clean next-arc business-logic files for scope-selection purposes
- **Why it is or isn’t a good next arc**
  - The area still contains live JS logic, but it reads as cache/debug/perf/export support residue rather than a coherent business-logic boundary.
  - `validatorFactory.js` is zero-import factory residue.
  - `resolveValidationEntitlements.js` is a zero-import read-only wrapper over the TS entitlement resolver.
  - `validationCacheManager.js` is zero-import cache infrastructure residue.
  - The remaining imported files are too mixed to recommend as the next intelligent migration slice.

### D. Broad Orchestration / World-Mutation Surface
- **Includes**
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/worldManager.js`
  - `src/features/architect/utils/teamLoader.js`
  - `src/features/architect/utils/tradeManager.js`
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js`
- **Excludes**
  - `src/features/architect/utils/runOffseason.js` because it is a thin wrapper over the TS offseason transition engine
- **Estimated live JS business-logic file count**
  - `7`
- **Why it is or isn’t a good next arc**
  - It is undeniably live and central to runtime behavior.
  - It is not the best next arc because it is much larger, cross-domain, and harder to cut cleanly than the contract/season helper family.
  - Choosing it next would skip a smaller adjacent boundary and would likely force a longer sub-arc chain rather than a clean grouped scope.

## 4. Recommended Next Scope
- **Recommended next migration scope:** the contract/season helper family centered on:
  - `src/features/architect/utils/seasonFormat.js`
  - `src/features/architect/utils/contractUtils.js`
  - `src/features/architect/utils/contractSalaryUtils.js`
- **Why it is the best next choice**
  - Final repo verification upheld the initial expectation.
  - It is the smallest coherent live-business-logic boundary with strong runtime relevance after the E56/E57 `playerRulesProfile` closure.
  - It is already pulled into the new TS-backed `playerRulesProfile` authorities plus UI, hooks, cap-sheet surfaces, and offseason helpers.
  - It can be migrated cleanly without silently widening into adjacent contract/cap helpers.
- **One arc or split?**
  - Handle it as **one grouped arc**.
  - Current execution evidence does not justify splitting it into multiple sub-arcs.
  - Current execution evidence does not justify widening it beyond these three files.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/seasonFormat.js`
  - **Why it belongs in scope:** authoritative season-code and end-year conversion logic used throughout Architect runtime code, TS authorities, hooks, and UI.
  - **Role:** `central foundation`
- `src/features/architect/utils/contractUtils.js`
  - **Why it belongs in scope:** authoritative contract utility hub for contract generation, display shaping, contract-year slicing, minimum salary helpers, stretch logic, and last-salary lookup.
  - **Role:** `central hub`
- `src/features/architect/utils/contractSalaryUtils.js`
  - **Why it belongs in scope:** authoritative salary lookup and fallback helper used by trade UI surfaces and direct tests; it depends only on `seasonFormat.js` inside the recommended scope.
  - **Role:** `peripheral companion`

## 6. Validation / Inspection Run
- **Files changed**
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E58_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- **Validation commands actually run**
  - `npm run typecheck`
  - `npm run validate:project`
- **Inspection commands and steps used**
  - Re-read `docs/architect/TRADE_MACHINE_MASTER.md` plus the E55, E56, and E57 return packages.
  - Re-scanned remaining `.js` files under `src/features/architect/utils/` and classified them as `ts-peer` versus `js-only`.
  - Re-inspected the closed-scope `.js` files directly to confirm they are still compatibility shims.
  - Re-read the expected contract/season helper front-runner and its nearby exclusions.
  - Re-read the entitlement projection pair.
  - Re-read the TM support residue, including the required zero-import files `validatorFactory.js`, `resolveValidationEntitlements.js`, and `validationCacheManager.js`.
  - Re-read the broad orchestration/world-mutation family to confirm that it remains too large for the next slice.
- **What those steps proved**
  - The initial contract/season helper expectation held up under actual repo inspection.
  - `seasonUtils.js` remains a deprecated wrapper over `seasonFormat.js`.
  - `capProjections.js` remains live runtime data but not business logic.
  - `contractUtils.js` does **not** require silent widening into adjacent contract/cap helpers; its only notable external edge is a backwards-compatible re-export from already-TS `capHolds.ts`.
  - The entitlement pair is coherent but lower leverage.
  - The TM residue still reads as support residue rather than the next business-logic arc.
  - The orchestration family remains much larger and more awkward than the recommended 3-file boundary.
- **Commands intentionally skipped**
  - `npm run test:diff -- --reporter=dot`
    - Exact reason: static inspection plus the required validation commands resolved the scope choice without leaving a real uncertainty.
  - broader scoped suites
    - Exact reason: this was an audit/doc-only pass with no runtime code changes.
  - `npm run build`
    - Exact reason: no UI/routes/components changed in this pass.

## 7. Complexity / Risk Assessment
- **Relative size vs the just-closed E56/E57 `playerRulesProfile` arc**
  - The recommended next arc is **smaller**.
  - E56/E57 closed out `6` live JS business-logic files; the recommended E58 scope contains `3`.
- **Batchable or smaller slices?**
  - It looks **batchable as one grouped arc**.
  - Current repo evidence does not indicate that it needs another long micro-pass chain.
- **Key risks / caveats**
  - Preserve existing season conversion semantics, especially mixed numeric-year and `YYYY-YY` string handling.
  - Preserve current contract display and salary-fallback behavior, including warning behavior in `contractSalaryUtils.js`.
  - Preserve the broad existing importer contract across hooks, UI, TS-backed authorities, and direct tests.
  - Keep `seasonUtils.js` as the compatibility wrapper rather than widening the arc into wrapper cleanup.
  - Keep `capProjections.js` and adjacent contract/cap helpers out of scope unless future execution uncovers a concrete migration blocker.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E58 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that:
  - E39 remains closed
  - E41 remains complete
  - the `tradeContext` mini-arc remains complete
  - the E46 trade-facing helper foundation remains complete
  - the E48 `capTotals` mini-arc remains complete
  - the E50 `persistenceContracts` arc remains complete
  - the E52 season-transition helper arc remains complete
  - the E54 exception-history mini-arc remains complete
  - the E56/E57 `playerRulesProfile` arc remains complete
  - the expected leading candidate from current repo inspection was the contract/season helper family, and final verification confirmed it as the recommended next scope
  - the estimated live JS business-logic count for that scope is `3`
  - the next arc should likely be handled as **one grouped scope**
  - no blocker was found that requires silently widening the scope beyond `seasonFormat.js`, `contractUtils.js`, and `contractSalaryUtils.js`
