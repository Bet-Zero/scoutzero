# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E53 — EXECUTION RETURN PACKAGE

## 1. Summary
- The expected leading next migration scope from current repo inspection was `src/features/architect/utils/exceptionHistory/historyHelpers.js`, and final verification against the actual current repo state confirmed that it remains the best next migration scope.
- The recommended scope currently contains `1` live JS business-logic file.
- It looks worth doing next because it is still authoritative JS business logic with strong runtime relevance, a clean cutoff, and materially less scope risk than the larger adjacent candidates.

## 2. Closed Scope Confirmation
- **E39 remains closed.**
  - Re-checked the intentionally kept Trade Machine JS entrypoints, barrels, and constants.
  - They still read as compatibility/public-surface residue rather than the next live business-logic arc.
- **E41 remains complete.**
  - Re-checked `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`, `swapResolution.js`, and `conveyanceResolution.js`.
  - All three still read as shim-only compatibility surfaces over authoritative `.ts` peers.
- **E43/E44 `tradeContext` remains complete.**
  - Re-checked `src/features/architect/utils/tradeContext/tradeContext.js`, `assertions.js`, and `legacy/index.js`.
  - They still read as compatibility shims/wrappers over authoritative `.ts` files.
- **E46 remains complete.**
  - Re-checked `src/features/architect/utils/tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js`.
  - All four still read as pure compatibility shims over the E46 TypeScript implementations.
- **E48 remains complete.**
  - Re-checked `src/features/architect/utils/capTotals/computeTeamCapTotals.js`.
  - It still reads as a pure compatibility shim over `computeTeamCapTotals.ts`.
- **E50 remains complete.**
  - Re-checked `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`, `validatePersistableShape.js`, `enforcement.js`, and `contracts.js`.
  - They still read as shim-only compatibility surfaces over authoritative `.ts` peers.
- **E52 remains complete.**
  - Re-checked `src/features/architect/utils/tpeLifecycle.js`, `src/features/architect/utils/exceptions/exceptionLifecycle.js`, and `src/features/architect/utils/entitlements/seasonManagerProjection.js`.
  - They still read as compatibility shims over the E52 TypeScript implementations.
- This audit avoided silently reopening prior scopes by reclassifying every closed-scope `.js` file first and excluding known shim/barrel residue from the new live-business-logic counts unless actual repo evidence proved otherwise. No prior scope needed reopening.

## 3. Candidate Next Scopes

### A. Exception History Helper Surface
- **Includes**
  - `src/features/architect/utils/exceptionHistory/historyHelpers.js`
- **Excludes**
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`
  - `src/features/architect/utils/runOffseason.js`
- **Estimated live JS business-logic file count**
  - `1`
- **Why it is a good next arc**
  - It is still real JS business logic with no TS peer.
  - It is used by `mutationPipeline.js`, `seasonManager.js`, and TS `resolveOffseasonTransition.ts`.
  - It has the cleanest remaining cutoff near the E52 area without reopening a broader orchestration surface.
  - Hard rule for future execution: do not broaden the arc by pulling in adjacent exception-history consumers or wrappers unless execution evidence proves a direct dependency blocker.

### B. PlayerRulesProfile Internal Rule Engine
- **Includes**
  - `src/features/architect/utils/playerRulesProfile/computeProfile.js`
  - `src/features/architect/utils/playerRulesProfile/extensionRules.js`
  - `src/features/architect/utils/playerRulesProfile/birdRightsRules.js`
  - `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js`
  - `src/features/architect/utils/playerRulesProfile/rfaRules.js`
  - `src/features/architect/utils/playerRulesProfile/maxSalaryRules.js`
- **Excludes**
  - `src/features/architect/utils/playerRulesProfile/index.js` because it is a barrel
  - `src/features/architect/utils/playerRulesProfile/types.js` because it is a JSDoc-only, zero-import support surface
- **Estimated live JS business-logic file count**
  - `6`
- **Why it is not the best next arc**
  - It is clearly live and coherent.
  - It is materially larger than E52 and materially larger than the `historyHelpers.js` slice.
  - It reads as a later grouped campaign or sub-arc chain rather than the smallest coherent next slice.

### C. Entitlement UI Projection Pair
- **Includes**
  - `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
  - `src/features/architect/utils/entitlements/formatEntitlement.js`
- **Excludes**
  - `src/features/architect/utils/entitlements/seasonManagerProjection.js` because it belongs to the already-closed E52 scope
  - `src/features/architect/utils/entitlements/entitlementTerms.ts` because it is already TS
- **Estimated live JS business-logic file count**
  - `2`
- **Why it is not the best next arc**
  - It is clean and actively used.
  - It is more display/projection oriented than the next highest-pressure runtime business-logic slice.
  - It is not as directly adjacent to the just-closed E52 helper arc as `historyHelpers.js`.

### D. Broader World Mutation / Orchestration Surface
- **Includes**
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/worldManager.js`
- **Excludes**
  - `src/features/architect/utils/capHoldTransitionHelpers.js`
  - `src/features/architect/utils/contractNormalization.js`
  - `src/features/architect/utils/teamLoader.js`
  - lower-level helper families that can still be sliced separately
- **Estimated live JS business-logic file count**
  - `4`
- **Why it is not the best next arc**
  - It is undeniably live and central.
  - It is too large and cross-domain to be the next intelligent migration slice.
  - Choosing it next would skip over a much smaller coherent boundary that is already visible from current repo evidence.

### E. Remaining Trade Machine Support / Residue
- **Includes**
  - remaining cache/debug/support surfaces such as `validationCache.js`, `validationCacheService.js`, `cacheInvalidationManager.js`, `engineUtils.js`, `tradeDebug.js`, and `validationPerformanceMonitor.js`
- **Excludes**
  - barrel surfaces such as `cache/index.js`, `engine/index.js`, and other already-classified entrypoints
  - zero-import files explicitly inspected before exclusion:
    - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
    - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
    - `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
- **Estimated live JS business-logic file count**
  - `0` clean next-arc business-logic files for scope-selection purposes
- **Why it is not the best next arc**
  - The area still contains live JS support code, but it reads as an awkward mixed bag of cache, debug, instrumentation, and residue rather than the next coherent business-logic boundary.
  - The required zero-import files were inspected explicitly before exclusion, and that inspection reinforced the “not next” conclusion.

## 4. Recommended Next Scope
- **Recommended next migration scope:** `src/features/architect/utils/exceptionHistory/historyHelpers.js`
- **Why it is the best next choice**
  - The expected leading candidate from current repo inspection still held up after final file-content and importer verification.
  - It is the smallest coherent remaining live-business-logic boundary with strong runtime relevance near the just-closed E52 helper area.
  - It avoids prematurely expanding into the much larger `playerRulesProfile` and orchestration-heavy families.
- **One arc or split?**
  - Current repo evidence favors **one grouped mini-arc**.
  - Do not broaden the arc by pulling in adjacent exception-history consumers or wrappers unless execution evidence proves a direct dependency blocker.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/exceptionHistory/historyHelpers.js`
  - **Why it belongs in scope:** it owns deterministic exception-history entry construction for TPE creation, consumption, and expiry, plus idempotent `appendExceptionHistory()` behavior used by both world-mutation and season-transition flows.
  - **Role:** `central`

## 6. Validation / Inspection Run
- **Files changed**
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E53_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- **Validation commands actually run**
  - `npm run typecheck`
    - Result: `PASS`
  - `npm run validate:project`
    - Result: `PASS`
- **Inspection steps used**
  - Re-read `docs/architect/TRADE_MACHINE_MASTER.md` and the E49, E51, and E52 return packages to lock the closed-scope boundary.
  - Re-scanned importer usage for `historyHelpers`, `runOffseason`, `playerRulesProfile`, the entitlement projection pair, and the remaining Trade Machine residue.
  - Re-read the E52-adjacent section of `docs/architect/TRADE_MACHINE_MASTER.md`.
  - Confirmed there was no existing E53 return package file before writing this one.
  - Re-used prior targeted file-content inspection across the serious candidate files and zero-import residue files already identified during the audit pass.
- **What those steps proved**
  - `historyHelpers.js` still has active runtime consumers and still has no authoritative TS peer.
  - `runOffseason.js` still reads as a thin DEV-only wrapper over TS offseason logic and does not need to be pulled into the next scope.
  - `playerRulesProfile` and the orchestration family remain live, but they are materially larger than the recommended next slice.
  - The remaining Trade Machine residue still does not justify reopening that area as the next business-logic arc.
- **Commands intentionally skipped**
  - `npm run build`
    - Exact reason: this pass only updates audit documentation.
  - `npm run test:diff -- --reporter=dot`
    - Exact reason: no runtime code changed, and the scope decision was resolved through static inspection plus the required repo validation commands.
  - broader scoped test suites
    - Exact reason: this was an audit-only doc pass and no unresolved scope uncertainty remained after inspection.

## 7. Complexity / Risk Assessment
- **Relative size vs the just-closed E52 season-transition helper arc**
  - The recommended next arc is **smaller** than E52.
  - E52’s authoritative TS surface was roughly `780` lines across three files; `historyHelpers.js` is currently `336` lines as a single-file helper boundary.
- **Batchable or smaller slices?**
  - Current repo evidence reads as **one grouped mini-arc**.
- **Key risks / caveats**
  - Preserve deterministic `historyKey` generation for creation, consumption, and expiry entries.
  - Preserve `appendExceptionHistory()`’s current in-place mutation behavior and dedupe behavior.
  - Preserve the named exports plus the `exceptionHistoryHelpers` aggregate export.
  - Preserve stable `.js` and extensionless import compatibility during any future TS migration.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E53 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new E53 entry records that:
  - **E39 remains closed**
  - **E41 remains complete**
  - the **`tradeContext` mini-arc remains complete**
  - the **E46 trade-facing helper foundation remains complete**
  - the **E48 `capTotals` mini-arc remains complete**
  - the **E50 `persistenceContracts` arc remains complete**
  - the **E52 season-transition helper arc remains complete**
  - the expected leading candidate from current repo inspection was `src/features/architect/utils/exceptionHistory/historyHelpers.js`, and final verification confirmed it as the recommended next scope
  - the estimated live JS business-logic count for that scope is `1`
  - the next arc currently reads as **one grouped mini-arc**
  - adjacent exception-history consumers and wrappers remain out of scope unless execution evidence proves a direct dependency blocker
