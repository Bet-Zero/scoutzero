# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E60 — EXECUTION RETURN PACKAGE

## 1. Summary
- The expected leading candidate from current repo inspection was the non-trade cap-legality family centered on `src/features/architect/utils/capLegalityValidation.js`, `src/features/architect/utils/contractNormalization.js`, and `src/features/architect/utils/capHoldTransitionHelpers.js`, and final verification against the actual current repo state confirmed it as the strongest next migration scope.
- The recommended scope contains `3` live JS business-logic files.
- It looks worth doing next because it is still authoritative JS logic with direct runtime and test usage, sits immediately adjacent to the recently closed helper arcs, and has a cleaner cutoff than the larger orchestration surface.
- The arc should stay unified at the audit level, but execution should be phased: helper modules first, then `capLegalityValidation.js` as the higher-coupling hub.

## 2. Closed Scope Confirmation
- **E39 remains closed.**
  - Re-checked the kept validator-adjacent JS entrypoints, barrels, constants, and support residue.
  - They still read as intentional public-surface or support residue, not the next live business-logic arc.
- **E41 remains complete.**
  - Re-checked `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`, `swapResolution.js`, and `conveyanceResolution.js`.
  - All three remain compatibility shims over authoritative TS peers.
- **E43/E44 `tradeContext` remains complete.**
  - Re-checked `tradeContext.js`, `assertions.js`, and `legacy/index.js`.
  - Those files remain closed-scope shim surfaces, while `tradeContext/index.js` remains an intentional public barrel.
- **E46 remains complete.**
  - Re-checked `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js`.
  - All four remain compatibility shims over authoritative TS implementations.
- **E48 remains complete.**
  - Re-checked `src/features/architect/utils/capTotals/computeTeamCapTotals.js`.
  - It remains a pure compatibility shim over `computeTeamCapTotals.ts`; `capTotals/index.js` remains a barrel surface.
- **E50 remains complete.**
  - Re-checked `normalizeTeamTpe.js`, `validatePersistableShape.js`, `enforcement.js`, and `contracts.js`.
  - All four remain shim-only compatibility surfaces; `persistenceContracts/index.js` remains a public barrel.
- **E52 remains complete.**
  - Re-checked `tpeLifecycle.js`, `exceptions/exceptionLifecycle.js`, and `entitlements/seasonManagerProjection.js`.
  - All three remain compatibility shims over TS authorities; `exceptions/index.js` remains a public barrel.
- **E54 remains complete.**
  - Re-checked `src/features/architect/utils/exceptionHistory/historyHelpers.js`.
  - It remains a shim-only compatibility surface over `historyHelpers.ts`.
- **E56/E57 remains complete.**
  - Re-checked the five `playerRulesProfile` leaf-rule `.js` files plus `computeProfile.js`.
  - All six remain compatibility shims; `playerRulesProfile/index.js` and `types.js` remain intentional barrel/JSDoc support only.
- **E59 remains complete.**
  - Re-checked `seasonFormat.js`, `contractUtils.js`, and `contractSalaryUtils.js`.
  - All three remain pure compatibility shims over their new TS authorities; `seasonUtils.js` remains a deprecated wrapper and not an E59 reopening signal.
- This audit avoided silently reopening prior scopes by reclassifying the kept `.js` files before counting new candidates. No closed scope required reopening.

## 3. Candidate Next Scopes

### A. Non-Trade Cap-Legality Family
- **Includes**
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/contractNormalization.js`
  - `src/features/architect/utils/capHoldTransitionHelpers.js`
- **Excludes**
  - `src/features/architect/utils/runOffseason.js` because it is now a thin wrapper over the TS offseason transition engine
  - `src/features/architect/utils/seasonUtils.js` because it is a deprecated wrapper over the already-closed E59 `seasonFormat` authority
  - `src/features/architect/utils/capProjections.js` because it is a live data/constants surface, not business logic
  - downstream orchestration files such as `mutationPipeline.js` and `seasonManager.js` because they consume this family rather than define its core rules
- **Estimated live JS business-logic file count**
  - `3`
- **Why it is or isn’t a good next arc**
  - It is the strongest next arc after actual verification.
  - All three files are still JS-only, still authoritative, and still heavily used by runtime code plus tests.
  - It has a cleaner cutoff than the orchestration family and materially higher leverage than the smaller entitlement projection pair.
  - The caveat is coupling: `capLegalityValidation.js` is the high-coupling hub, so execution should not be a blind one-shot grouped pass.

### B. Entitlement Projection / Display Pair
- **Includes**
  - `src/features/architect/utils/entitlements/formatEntitlement.js`
  - `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
- **Excludes**
  - `src/features/architect/utils/entitlements/seasonManagerProjection.js` because E52 already closed it as a shim-backed surface
  - the TS entitlement resolver, terms, claims, writer, and DARE surfaces because they are already TS authorities and outside this display-only boundary
- **Estimated live JS business-logic file count**
  - `2`
- **Why it is or isn’t a good next arc**
  - It is coherent, small, and actively used by Trade Machine UI surfaces plus tests.
  - It is not the best next arc because it is lower leverage and less adjacent to the active non-trade validation/mutation rule family than the cap-legality candidate.

### C. World Mutation / Orchestration Surface
- **Includes**
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/worldManager.js`
  - `src/features/architect/utils/teamLoader.js`
  - `src/features/architect/utils/tradeManager.js`
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js`
  - `src/features/architect/utils/schemaAdapter.js`
- **Excludes**
  - `src/features/architect/utils/architectCore.js` because it is a barrel
  - `src/features/architect/utils/runOffseason.js` because it is a wrapper over TS offseason logic
- **Estimated live JS business-logic file count**
  - `7`
- **Why it is or isn’t a good next arc**
  - It is undeniably live and high-impact runtime logic.
  - It is not the best next arc because it is substantially larger, more cross-domain, and more awkward to cut cleanly than the verified cap-legality family.
  - Choosing it next would likely force a longer chain of smaller follow-up slices.

### D. Remaining Trade Machine Support Residue
- **Includes**
  - imported support files such as `validationCache.js`, `validationCacheService.js`, `cacheInvalidationManager.js`, `engineUtils.js`, `tradeDebug.js`, `validationPerformanceMonitor.js`, `validationDebugMonitor.js`, and `tradeExportUtils.js`
- **Excludes**
  - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js` after explicit zero-import inspection
  - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js` after explicit zero-import inspection
  - `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js` after explicit inspection as index-only support residue
- **Estimated live JS business-logic file count**
  - `0` clean next-arc business-logic files for scope-selection purposes
- **Why it is or isn’t a good next arc**
  - This area still contains live JS support logic, but it reads as cache/debug/export infrastructure rather than a coherent business-logic migration boundary.
  - It is not the right next scope recommendation.

## 4. Recommended Next Scope
- **Recommended next migration scope:** the non-trade cap-legality family centered on:
  - `src/features/architect/utils/contractNormalization.js`
  - `src/features/architect/utils/capHoldTransitionHelpers.js`
  - `src/features/architect/utils/capLegalityValidation.js`
- **Why it is the best next choice**
  - Final repo verification upheld the initial expectation rather than displacing it.
  - It is the smallest nearby high-value live-business-logic boundary after E59 that still has strong runtime relevance.
  - It directly feeds mutation, offseason, post-state validation, and UI preflight surfaces without requiring an immediate widening into the much larger orchestration family.
- **One arc or split?**
  - Keep it as **one unified audit-level arc**, because the three files form one coherent rules family.
  - Execute it in **phased sub-arcs**, not a one-shot conversion:
    - helper-first phase: `contractNormalization.js` + `capHoldTransitionHelpers.js`
    - validator-hub follow-up: `capLegalityValidation.js`
  - This phased recommendation is required because `capLegalityValidation.js` is the high-coupling hub over the helper files and multiple downstream consumers.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/contractNormalization.js`
  - **Why it belongs in scope:** canonical contract/free-agency normalization and invariant logic used directly by `capLegalityValidation.js`, `mutationPipeline.js`, `tradeContext.ts`, `useCapSheetState.js`, and direct tests.
  - **Role:** `central support`
- `src/features/architect/utils/capHoldTransitionHelpers.js`
  - **Why it belongs in scope:** canonical cap-hold transition reasoning used by `capLegalityValidation.js`, `mutationPipeline.js`, `seasonManager.js`, the TS offseason transition engine, post-state validation, and UI action preflight.
  - **Role:** `central support`
- `src/features/architect/utils/capLegalityValidation.js`
  - **Why it belongs in scope:** authoritative non-trade cap-legality validator used by `mutationPipeline.js`, `postStateCapValidator.ts`, `resolveOffseasonTransition.ts`, `useArchitectActions.ts`, and multiple direct test suites.
  - **Role:** `central hub`

## 6. Validation / Inspection Run
- **Files changed**
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E60_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- **Validation commands actually run**
  - `npm run typecheck`
    - Result: PASS
  - `npm run validate:project`
    - Result: PASS
- **Inspection commands and steps used**
  - Re-read `docs/architect/TRADE_MACHINE_MASTER.md` and the E58/E59 return packages to preserve the already-closed boundaries.
  - Re-scanned remaining `.js` files under `src/features/architect/utils/` and classified them as closed-scope shim/wrapper/barrel residue versus still-authoritative JS logic.
  - Used local importer-graph inspection across `src/` and `tests/` to measure runtime/test usage, TS-peer status, and zero-import residue.
  - Directly inspected the leading candidate files, the entitlement projection pair, the orchestration family, and the required zero-import TM residue files.
  - Compared file sizes and coupling to judge whether the strongest next arc should execute as one grouped pass or phased sub-arcs.
- **What those steps proved**
  - The expected leading candidate did survive final verification against the actual current repo state.
  - `contractNormalization.js` and `capHoldTransitionHelpers.js` remain live helper authorities rather than wrappers.
  - `capLegalityValidation.js` remains the authoritative high-coupling hub over that helper family.
  - The entitlement display pair remains coherent but lower leverage.
  - The orchestration surface remains materially larger and more awkward than the recommended family.
  - `validatorFactory.js`, `resolveValidationEntitlements.js`, and `validationCacheManager.js` should still be excluded from next-scope business-logic counts.
- **Commands intentionally skipped**
  - `npm run test:diff -- --reporter=dot`
    - Exact reason: this was an audit/doc-only pass, and static inspection plus the required validation commands resolved the scope choice without leaving a runtime uncertainty.
  - broader suites such as `npm run test:architect -- --reporter=dot` or `npm run test:trade -- --reporter=dot`
    - Exact reason: no production logic changed in this pass.
  - `npm run build`
    - Exact reason: no UI/routes/components changed in this pass.

## 7. Complexity / Risk Assessment
- **Relative size vs the just-closed E59 contract/season helper arc**
  - The recommended next arc is **larger** than E59.
  - The three recommended JS files total roughly `4706` lines of JS logic, while the E59 TS authority trio totals roughly `658` lines.
- **Batchable or phased?**
  - It is best treated as a **unified audit-level arc with phased execution sub-arcs**.
  - It should not be run as a blind one-shot grouped conversion because `capLegalityValidation.js` is the high-coupling hub.
- **Key risks / caveats**
  - Preserve validator outputs, reason strings, and failure/warning semantics exactly.
  - Preserve current contract/free-agency normalization and cap-hold transition behavior without widening into behavior cleanup.
  - Avoid accidental widening into `mutationPipeline.js`, `seasonManager.js`, or other orchestration files during the helper-first phase.
  - Preserve compatibility for mixed JS/TS consumers across mutation, offseason, post-state validation, and UI preflight paths.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E60 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
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
  - the E59 contract/season helper arc remains complete
  - the expected leading candidate from current repo inspection was the non-trade cap-legality family, and final verification against the actual current repo state confirmed it as the recommended next scope
  - the estimated live JS business-logic count for that scope is `3`
  - the arc should remain unified at audit level but should execute as phased sub-arcs with helper modules first because `capLegalityValidation.js` is still the high-coupling hub
