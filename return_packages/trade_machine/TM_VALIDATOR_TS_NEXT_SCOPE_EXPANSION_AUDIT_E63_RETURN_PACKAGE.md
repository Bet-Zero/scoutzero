# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E63 — EXECUTION RETURN PACKAGE

## 1. Summary
- The expected leading candidate from current repo inspection was the world-aware loader boundary centered on `src/features/architect/utils/teamLoader.js`, and final verification against the actual current repo state confirmed it as the strongest next migration scope.
- The recommended scope contains `1` live JS business-logic file.
- It looks worth doing next because `teamLoader.js` is still authoritative JS logic with no TS peer, broad runtime and test usage, and a much cleaner cutoff than the nearby entitlement projection pair or the broader orchestration layer.

## 2. Closed Scope Confirmation
- The following prior scopes were treated as closed throughout this audit and were re-checked before any new candidate counting: E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, and E61/E62.
- Current repo evidence still shows those closed-scope `.js` files as compatibility shims, barrels, wrappers, constants, or support residue rather than fresh live-business-logic holdouts. Representative current examples include:
  - `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` as E46 shim surfaces over `.ts` authorities
  - `computeTeamCapTotals.js` as the E48 shim surface
  - `normalizeTeamTpe.js`, `validatePersistableShape.js`, `enforcement.js`, and `contracts.js` as E50 shim surfaces
  - `tpeLifecycle.js`, `exceptions/exceptionLifecycle.js`, and `entitlements/seasonManagerProjection.js` as E52 shim surfaces
  - `historyHelpers.js` as the E54 shim surface
  - `minimumSalaryRules.js`, `maxSalaryRules.js`, `birdRightsRules.js`, `rfaRules.js`, `extensionRules.js`, and `computeProfile.js` as E56/E57 shim surfaces
  - `seasonFormat.js`, `contractUtils.js`, and `contractSalaryUtils.js` as E59 shim surfaces
  - `contractNormalization.js`, `capHoldTransitionHelpers.js`, and `capLegalityValidation.js` as E61/E62 shim surfaces
  - `pickIdUtils.js`, `swapResolution.js`, and `conveyanceResolution.js` as E41 compatibility re-export surfaces
- This audit avoided silently reopening those arcs by classifying the kept `.js` files first and excluding them from the next-scope live-business-logic count unless current source inspection proved otherwise. No closed scope required reopening.

## 3. Candidate Next Scopes

### A. World-Aware Loader Boundary
- **Includes**
  - `src/features/architect/utils/teamLoader.js`
- **Excludes**
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js`
  - `src/features/architect/utils/worldManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/tradeManager.js`
  - `src/features/architect/utils/schemaAdapter.js`
- **Estimated live JS business-logic file count**
  - `1`
- **Why it is or isn’t a good next arc**
  - It is the best next arc after current-state verification.
  - `teamLoader.js` has no TS peer, is directly imported by live runtime surfaces such as `useArchitectState.ts`, `worldTeamData.ts`, `leagueInvariants.ts`, `mutationPipeline.js`, `seasonManager.js`, and `tradeManager.js`, and also has dedicated direct tests in `tests/architect/teamLoader.test.js` plus multiple integration and guardrail consumers.
  - It owns a coherent boundary: world -> parent -> base fallback, 30-team league loading, player override merge behavior, and `salariesByYear` merge behavior.
  - No blocker was found that requires widening the scope to `firebaseTeamPlanHelpers.js`, `worldManager.js`, or other loader-adjacent helpers.

### B. Entitlement Projection / Display Pair
- **Includes**
  - `src/features/architect/utils/entitlements/formatEntitlement.js`
  - `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
- **Excludes**
  - `src/features/architect/utils/entitlements/seasonManagerProjection.js` because E52 already closed it as a shim-backed surface
  - `src/features/architect/utils/entitlements/entitlementTerms.ts` and the rest of the entitlement resolver/writer family because they are already TS authorities
- **Estimated live JS business-logic file count**
  - `2`
- **Why it is or isn’t a good next arc**
  - It is coherent, actively used, and still authoritative JS logic.
  - It feeds `EntitlementPickRow.jsx`, `EntitlementPicksList.jsx`, `TradeReceiptPanel.jsx`, `TradeSummaryPanel.jsx`, admin previews, and focused tests.
  - It is not the best next arc because it is more UI projection-oriented and lower leverage than `teamLoader.js`, which sits on more central runtime load paths and broader integration coverage.

### C. Broad Orchestration / World-Mutation Layer
- **Includes**
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/worldManager.js`
  - `src/features/architect/utils/tradeManager.js`
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js`
  - `src/features/architect/utils/schemaAdapter.js`
- **Excludes**
  - `src/features/architect/utils/teamLoader.js` because this audit verified it separately as a smaller standalone boundary
  - `src/features/architect/utils/runOffseason.js` because it remains a thin wrapper over TS offseason logic rather than a next-arc core boundary
- **Estimated live JS business-logic file count**
  - `6`
- **Why it is or isn’t a good next arc**
  - It is undeniably live and high-impact.
  - It is not the best next arc because it is cross-domain, much larger, and harder to cut cleanly than the single-file loader boundary.
  - Choosing it next would likely create another long chain of smaller follow-up slices instead of a focused next migration win.

## 4. Recommended Next Scope
- **Recommended next migration scope:** the world-aware loader boundary centered on `src/features/architect/utils/teamLoader.js`
- **Why it is the best next choice**
  - The expected front-runner held up under direct repo verification rather than just proximity-based intuition.
  - It is the smallest coherent live-business-logic boundary in the nearby area with strong runtime and test relevance.
  - It is more central than the entitlement display pair and far cleaner than the broader orchestration family.
  - It can be audited as a self-contained migration candidate without widening into adjacent loader/orchestration helpers.
- **One arc or split?**
  - It currently reads as **one grouped mini-arc**.
  - Do not silently widen it to `firebaseTeamPlanHelpers.js`, `worldManager.js`, or other loader-adjacent helpers unless future execution proves a concrete blocker. If that happens, document the blocker explicitly instead of auto-expanding the scope.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/teamLoader.js`
  - **Why it belongs in scope:** it is still the authoritative JS loader for world-aware team and player reads, including the world -> parent -> base fallback chain, league batch loading, player override merging, and salary-array merge behavior.
  - **Role:** `central`

## 6. Validation / Inspection Run
- **Files changed**
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E63_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- **Validation commands actually run**
  - `npm run typecheck`
    - Result: PASS
  - `npm run validate:project`
    - Result: PASS
- **Inspection commands and steps used**
  - Re-read the current `docs/architect/TRADE_MACHINE_MASTER.md` E60-E62 area and the earlier next-scope audit packages to preserve the already-closed boundaries.
  - Used `rg -n` plus direct file inspection to verify that the closed-scope `.js` files now remain shim/barrel/wrapper surfaces over authoritative `.ts` peers.
  - Used importer-graph inspection across `src/` and `tests/` to compare `teamLoader.js`, the entitlement projection/display pair, and the broader orchestration layer.
  - Used `wc -l` to compare the size of `teamLoader.js`, the entitlement pair, the orchestration family, and the just-closed E61/E62 TS authority files.
  - Directly inspected `teamLoader.js`, `firebaseTeamPlanHelpers.js`, `worldManager.js`, `tradeManager.js`, `schemaAdapter.js`, `formatEntitlement.js`, `entitlementPickRowProjection.js`, `consentUtils.js`, `validatorFactory.js`, `resolveValidationEntitlements.js`, `validationCacheManager.js`, `cashUtils.js`, and `draftPickUtils.js`.
- **What those steps proved**
  - `teamLoader.js` remains live runtime business logic with no TS peer.
  - `teamLoader.js` still owns the world -> parent -> base fallback chain, 30-team league loading, player override merge behavior, and `salariesByYear` merge behavior.
  - `firebaseTeamPlanHelpers.js` and `worldManager.js` remain adjacent dependencies, but current repo evidence does not show that `teamLoader.js` must be widened to include them as the next migration boundary.
  - The entitlement pair remains coherent and live, but it is still lower leverage than the loader boundary.
  - The orchestration layer remains too large and awkward for the next slice.
  - The requested support residue does not displace the recommendation:
    - `consentUtils.js` is live but only a small helper consumed by TS consent rules
    - `validatorFactory.js` remains zero-import residue
    - `resolveValidationEntitlements.js` remains a zero-import read-only wrapper
    - `validationCacheManager.js` remains index-only support residue
    - `cashUtils.js` remains zero-import dead-end utility logic
    - `draftPickUtils.js` remains test-only/debug-heavy residue with console logging and no runtime import chain
- **Commands intentionally skipped**
  - `npm run test:diff -- --reporter=dot`
    - Exact reason: static inspection plus the required validation commands resolved the scope choice without leaving a runtime uncertainty.
  - broader suites such as `npm run test:architect -- --reporter=dot` and `npm run test:trade -- --reporter=dot`
    - Exact reason: this was an audit/doc-only pass with no production logic changes.
  - `npm run build`
    - Exact reason: no UI/routes/components changed in this pass.

## 7. Complexity / Risk Assessment
- **Likely size of the next arc relative to the just-closed E61/E62 non-trade cap-legality arc**
  - The recommended next arc is **much smaller**.
  - `teamLoader.js` is `333` lines, while the just-closed E61/E62 authority set (`contractNormalization.ts`, `capHoldTransitionHelpers.ts`, `capLegalityValidation.ts`) totals `5009` lines.
- **Whether it looks batchable or still best handled in smaller slices**
  - It looks **batchable as one grouped mini-arc**.
  - Current repo evidence does not suggest another long micro-pass chain is needed here.
- **Key risks / caveats**
  - Preserve the exact fallback order and failure behavior for world -> parent -> base reads.
  - Preserve current `getLeague()` batch-loading behavior and its 30-team expectations.
  - Preserve `mergePlayerOverride()` and `mergeSalariesByYear()` semantics exactly.
  - Preserve the public API surface of `getTeam`, `getLeague`, `getPlayer`, and `mergePlayerOverride`.
  - Preserve `.js` and extensionless import compatibility.
  - Do not widen into `firebaseTeamPlanHelpers.js`, `worldManager.js`, or other adjacent helpers unless a future execution pass proves a concrete blocker.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E63 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new E63 entry records that:
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
  - the E61/E62 non-trade cap-legality arc remains complete
  - the expected leading candidate from current repo inspection was the world-aware loader boundary centered on `teamLoader.js`, and final verification against the actual current repo state confirmed it as the recommended next scope
  - the estimated live JS business-logic count for that scope is `1`
  - the next arc currently reads as **one grouped mini-arc**
  - no blocker was found that requires widening the scope to `firebaseTeamPlanHelpers.js`, `worldManager.js`, or other loader-adjacent helpers
  - return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E63_RETURN_PACKAGE.md`
