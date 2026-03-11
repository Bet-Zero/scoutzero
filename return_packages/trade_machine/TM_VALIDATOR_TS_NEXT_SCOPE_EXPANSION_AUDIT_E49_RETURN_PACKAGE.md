# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E49 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the actual current repo state is `src/features/architect/utils/persistenceContracts/`.
- The recommended scope appears to contain `3` core live JS business-logic files:
  - `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
  - `src/features/architect/utils/persistenceContracts/validatePersistableShape.js`
  - `src/features/architect/utils/persistenceContracts/enforcement.js`
- `src/features/architect/utils/persistenceContracts/contracts.js` was inspected explicitly and classified as a **rule-definition surface**, not assumed in advance.
- The scope looks worth doing next because it is still strongly connected to live runtime behavior and tests, stays materially smaller than the broader rule-engine candidates, and has a cleaner cutoff than the cross-folder lifecycle candidates.

## 2. Closed Scope Confirmation
- **E39 remains closed.**
  - Re-checked `src/features/architect/utils/tradeMachine/index.js`, `src/features/architect/utils/tradeMachine/rules/index.js`, `src/features/architect/utils/tradeMachine/utils/index.js`, `src/features/architect/utils/tradeMachine/validators/index.js`, `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`, and `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`.
  - They still read as intentionally kept public entrypoints, barrels, or constants surfaces rather than the next live business-logic arc.
- **E41 remains complete.**
  - Re-checked `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`, `src/features/architect/utils/tradeMachine/utils/swapResolution.js`, and `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js`.
  - All three still read as shim-only compatibility surfaces over authoritative `.ts` peers.
- **E43/E44 `tradeContext` remains complete.**
  - Re-checked `src/features/architect/utils/tradeContext/tradeContext.js`, `src/features/architect/utils/tradeContext/assertions.js`, and `src/features/architect/utils/tradeContext/legacy/index.js`.
  - They still read as shim/barrel compatibility surfaces over authoritative `.ts` files.
- **E46 remains complete.**
  - Re-checked `src/features/architect/utils/tradeHelpers.js`, `src/features/architect/utils/hardCapUtils.js`, `src/features/architect/utils/faExceptionUtils.js`, and `src/features/architect/utils/capUtils.js`.
  - All four still read as pure compatibility shims over the E46 TypeScript implementations.
- **E48 remains complete.**
  - Re-checked `src/features/architect/utils/capTotals/computeTeamCapTotals.js`.
  - It still reads as a pure compatibility shim over `computeTeamCapTotals.ts`; `src/features/architect/utils/capTotals/index.js` remains a nearby barrel/support surface.
- This audit avoided silently reopening prior scopes by reclassifying those closed-scope `.js` files first, before counting or comparing new candidates. No prior scope needed reopening from the actual current repo evidence.

## 3. Candidate Next Scopes

### A. Persistence-Contract Enforcement / TPE Canonicalization Cluster
- **Includes**
  - `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
  - `src/features/architect/utils/persistenceContracts/validatePersistableShape.js`
  - `src/features/architect/utils/persistenceContracts/enforcement.js`
  - `src/features/architect/utils/persistenceContracts/contracts.js`
- **Excludes**
  - `src/features/architect/utils/persistenceContracts/index.js` from the live-business-logic count because it is a barrel-only public surface
- **Estimated live JS business-logic file count**
  - `3` core files
- **Classification note**
  - `contracts.js` was inspected directly and classified as a **rule-definition surface** because it defines the allowlists and deep-rule structures that actively determine persistence behavior, but it does not itself execute normalization or enforcement flow.
- **Why it is a good next arc**
  - It keeps a clean folder-centered boundary.
  - It has strong live runtime pressure through `mutationPipeline.js`, `seasonManager.js`, `resolveOffseasonTransition.ts`, Trade Machine TPE reads, `tradeExceptions.ts`, and `tpeValidation.ts`.
  - It is smaller and more coherent than `playerRulesProfile` and the broader cap/offseason family, while still carrying real business-logic importance.

### B. PlayerRulesProfile Internal Rule Engine
- **Includes**
  - `src/features/architect/utils/playerRulesProfile/computeProfile.js`
  - `src/features/architect/utils/playerRulesProfile/extensionRules.js`
  - `src/features/architect/utils/playerRulesProfile/birdRightsRules.js`
  - `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js`
  - `src/features/architect/utils/playerRulesProfile/maxSalaryRules.js`
  - `src/features/architect/utils/playerRulesProfile/rfaRules.js`
- **Excludes**
  - `src/features/architect/utils/playerRulesProfile/index.js` because it is a barrel
  - `src/features/architect/utils/playerRulesProfile/types.js` because it is a JSDoc/type-documentation support surface rather than live business logic
- **Estimated live JS business-logic file count**
  - `6`
- **Why it is not the best next arc**
  - It is clearly live and still important.
  - It is materially larger than the persistence-contract cluster.
  - Current repo layering increasingly routes callers through `salaryEngine`, while `capLegalityValidation.js` still deep-imports parts of the internal rule engine, which makes this a heavier grouped arc or likely sub-arc campaign rather than the best immediate next slice.

### C. Exception / TPE Lifecycle Cluster
- **Includes**
  - `src/features/architect/utils/tpeLifecycle.js`
  - `src/features/architect/utils/exceptions/exceptionLifecycle.js`
  - `src/features/architect/utils/exceptionHistory/historyHelpers.js`
- **Excludes**
  - `src/features/architect/utils/exceptions/index.js` because it is a barrel-only support surface
- **Estimated live JS business-logic file count**
  - `3`
- **Why it is not the best next arc**
  - It is live and relevant to season transition behavior.
  - It is less clean as a migration boundary because it spans three neighboring but separately owned surfaces: TPE expiry, non-TPE exception reset, and history-entry generation.
  - It reads more like a cross-folder lifecycle grab-bag than a single crisp boundary.

### D. Broader Cap-Legality / Offseason Helper Family
- **Includes**
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/capHoldTransitionHelpers.js`
  - `src/features/architect/utils/contractNormalization.js`
  - `src/features/architect/utils/tpeLifecycle.js`
  - `src/features/architect/utils/seasonFormat.js`
  - adjacent rule-data support in `src/features/architect/utils/capProjections.js`
- **Excludes**
  - orchestration files such as `mutationPipeline.js`, `seasonManager.js`, and `tradeManager.js`
  - smaller adjacent clusters that already cut more cleanly, including `persistenceContracts`
- **Estimated live JS business-logic file count**
  - `5` core files, with `capProjections.js` reading as adjacent rule-data support
- **Why it is not the best next arc**
  - It is undeniably live, but too broad for the next immediate slice.
  - `capLegalityValidation.js` alone dominates the size and risk profile.
  - Pulling this family next would broaden the migration campaign faster than the repo state currently justifies.

### E. Remaining Trade Machine Support / Residue
- **Includes**
  - runtime-adjacent or test-referenced JS support such as:
    - `src/features/architect/utils/tradeMachine/cache/validationCache.js`
    - `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
    - `src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js`
    - `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
    - `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
    - `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
    - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
    - `src/features/architect/utils/tradeMachine/engine/performanceMonitor.js`
    - `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`
- **Excludes**
  - barrel surfaces such as `cache/index.js`, `engine/index.js`, and `rules/index.js`
  - zero-import files explicitly inspected and excluded from the live-business-logic count:
    - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
    - `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
    - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
  - older debug-only or compatibility residue such as `tradeValidator.debug.js`
- **Estimated live JS business-logic file count**
  - `2` lightweight runtime-adjacent helper files, with the rest of the area reading primarily as cache, instrumentation, debug, or test-support residue
- **Why it is not the best next arc**
  - This is not a clean product-facing business-logic boundary.
  - The actual current repo state reads it as a mixed residue area, not the next coherent migration slice.
  - The zero-import files were explicitly checked rather than assumed away, and that inspection reinforced the “not next” conclusion.

## 4. Recommended Next Scope
- **Recommended next migration scope:** `src/features/architect/utils/persistenceContracts/`
- **Why this is the best next choice**
  - The expected leading candidate from current repo inspection was `persistenceContracts`, and the comparison pass against the actual current repo state confirmed that it still wins.
  - It is the cleanest remaining folder boundary with strong runtime relevance at persistence and TPE-read boundaries.
  - It stays materially smaller and easier to reason about than `playerRulesProfile` and the broader cap/offseason helper family.
  - It is cleaner than the exception/TPE lifecycle candidate because it is concentrated in one folder instead of spanning several nearby but separately owned helper surfaces.
- **Estimated live JS business-logic count**
  - `3` core live JS business-logic files, with `contracts.js` carried as an in-scope rule-definition support surface
- **One arc or split?**
  - Current repo evidence favors **one grouped folder arc**.
  - The clean fallback split, only if execution exposes typing or importer friction, would be:
    - core behavior sub-arc: `normalizeTeamTpe.js`, `validatePersistableShape.js`, and `enforcement.js`
    - follow-up support sub-arc: `contracts.js` plus any shim/barrel compatibility adjustments

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
  - **Why it belongs in scope:** it owns canonical TPE read/persist normalization, legacy-to-canonical merging, alias normalization, deterministic deduplication, and telemetry behavior that are used directly by live UI, mutation, season-advance, and validation flows.
  - **Role:** `central`
- `src/features/architect/utils/persistenceContracts/validatePersistableShape.js`
  - **Why it belongs in scope:** it contains the actual allowlist/deep-rule traversal logic, violation-path detection, and formatted error construction used to guard persistable shapes.
  - **Role:** `central`
- `src/features/architect/utils/persistenceContracts/enforcement.js`
  - **Why it belongs in scope:** it controls the env-gated enforcement path that turns contract validation into active persistence boundary checks.
  - **Role:** `central-supporting`
- Adjacent in-scope support surface explicitly inspected but not counted toward the core live-business-logic total:
  - `src/features/architect/utils/persistenceContracts/contracts.js`
  - **Classification:** `rule-definition surface`
  - **Why it stays in scope:** it defines the allowlists and deep-rule structures that the validator/enforcement path actively consumes
  - **Role:** `supporting`

## 6. Validation / Inspection Run
- **Validation commands actually run**
  - `npm run typecheck`
    - Result: `PASS`
    - Proved the current audited repo state typechecks cleanly before and during this documentation-only pass.
  - `npm run validate:project`
    - Result: `PASS`
    - Proved the project structure remained valid for this docs-only audit pass.
- **Inspection steps used**
  - Read the E44, E45, E46, E47, and E48 return packages plus the current `docs/architect/TRADE_MACHINE_MASTER.md` to anchor the closed-scope boundary.
  - Enumerated the remaining `.js` surface under `src/features/architect/utils/` and sized it with `wc -l`.
  - Classified remaining `.js` files by whether they already had `.ts` peers, then re-read the serious candidates directly with `sed -n`.
  - Ran importer scans across `src/features/architect`, `src/tests`, and `tests` to compare runtime and test pressure for the candidate clusters.
  - Explicitly inspected `src/features/architect/utils/persistenceContracts/contracts.js` and classified it from file content as a rule-definition surface.
  - Explicitly inspected zero-import files in the remaining Trade Machine residue area:
    - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
    - `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
    - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
- **What those steps proved**
  - The previously closed E39, E41, E43/E44, E46, and E48 boundaries remain closed in the current repo state.
  - `persistenceContracts` remained the strongest candidate after direct comparison rather than assumption.
  - `contracts.js` is not barrel-only and not mere constants-like support; it is a live rule-definition surface that belongs in the recommended arc discussion.
  - The remaining Trade Machine residue is real, but it is not the next coherent business-logic arc.
- **Commands intentionally skipped**
  - `npm run test:diff -- --reporter=dot`
    - Skipped because this pass is audit/scoping only and no runtime code changed.
  - `npm run build`
    - Skipped because this pass only updates audit documentation.
  - `npm run test:full`
    - Skipped because full-suite execution is guarded and was not requested.

## 7. Complexity / Risk Assessment
- **Relative size vs the just-closed E48 `capTotals` mini-arc**
  - The recommended next arc is **larger** than E48.
  - Raw current JS size for the recommended boundary is roughly:
    - `normalizeTeamTpe.js` `305` lines
    - `validatePersistableShape.js` `195` lines
    - `enforcement.js` `143` lines
    - plus `contracts.js` `428` lines as in-scope rule-definition support
  - That makes the next arc materially larger than the one-file E48 mini-arc, but still cleaner and smaller than the broader rule-engine candidates.
- **Batchable or smaller slices?**
  - Current repo evidence still reads as **one grouped folder arc**.
  - The fallback split exists, but the folder boundary is coherent enough that a grouped pass is the better default read.
- **Key risks / caveats**
  - `normalizeTeamTpe.js` must preserve canonical-vs-legacy merge order, alias backfilling, deterministic deduplication, and quiet-by-default telemetry behavior exactly.
  - `validatePersistableShape.js` must preserve exact violation-path output and current deep-rule traversal behavior.
  - `enforcement.js` must preserve the current env-gated behavior for test, production, and explicit override paths.
  - `contracts.js` is support rather than procedural logic, but its allowlists and deep rules are behavior-bearing in practice; accidental narrowing or reordering could ripple into guardrails and persistence behavior.
  - Direct-path imports and barrel imports both exist today, so import compatibility must remain stable during migration.

## 8. Master Doc Update
- Updated `docs/architect/TRADE_MACHINE_MASTER.md` by adding:
  - `### Validator TS Next-Scope Expansion Audit E49 (2026-03-11)`
- The new E49 entry records that:
  - **E39 remains closed**
  - **E41 remains complete**
  - the **`tradeContext` mini-arc remains complete**
  - the **E46 trade-facing helper foundation remains complete**
  - the **E48 `capTotals` mini-arc remains complete**
  - the recommended next migration scope is `src/features/architect/utils/persistenceContracts/`
  - the estimated live JS business-logic count for that scope is `3`
  - `contracts.js` was classified from file content as a **rule-definition surface**
  - the next arc currently reads as **one grouped folder scope**, with split fallback only if execution exposes typing or importer friction
