# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E45 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the current repo state is the **trade-facing helper foundation** centered on:
  - `src/features/architect/utils/tradeHelpers.js`
  - `src/features/architect/utils/hardCapUtils.js`
  - `src/features/architect/utils/faExceptionUtils.js`
  - `src/features/architect/utils/capUtils.js`
- The recommended scope appears to contain **4 live JS business-logic files**.
- It looks worth doing next because it is still directly adjacent to the Trade Machine validator/UI surface, has clear runtime importer pressure, and stays materially smaller and cleaner than the broader season/cap-legality family or the world-mutation orchestration surface.

## 2. Closed Scope Confirmation
- **E39** remains closed.
  - I did not recount `src/features/architect/utils/tradeMachine/index.js`, `rules/index.js`, `utils/index.js`, `validators/index.js`, `constants/cbaConstants.js`, or `constants/secondApronMessages.js` as the next scope.
  - Repo inspection still reads those as public entrypoint/barrel/constants surfaces, not the next live JS business-logic arc.
- **E41** remains complete.
  - I explicitly re-checked `pickIdUtils.js`, `swapResolution.js`, and `conveyanceResolution.js`.
  - All three now have authoritative `.ts` peers and remain only as compatibility JS shims, so they were excluded from the next-scope live-business-logic count.
- **E43/E44** `tradeContext` remains complete.
  - I explicitly re-checked `tradeContext.js`, `assertions.js`, and `legacy/index.js`.
  - Current repo state still reads them as shim/barrel compatibility surfaces over TS-authoritative implementations, so they were excluded from the next-scope live-business-logic count.
- This audit avoided silently reopening prior scopes by reclassifying closed-scope JS files before comparing new candidates, rather than treating “remaining `.js`” as automatically in-scope.

## 3. Candidate Next Scopes

### A. Trade-Facing Helper Foundation
- **Includes**
  - `src/features/architect/utils/tradeHelpers.js`
  - `src/features/architect/utils/hardCapUtils.js`
  - `src/features/architect/utils/faExceptionUtils.js`
  - `src/features/architect/utils/capUtils.js`
- **Excludes**
  - `src/features/architect/utils/cbaConstants.js` and `src/features/architect/utils/tradeMachine/constants/*` as constants surfaces
  - the broader cap-legality helper family (`capLegalityValidation.js`, `contractNormalization.js`, `capHoldTransitionHelpers.js`, `tpeLifecycle.js`, `seasonFormat.js`)
  - the closed E39/E41/E43/E44 shim/barrel surfaces
- **Estimated live JS business-logic file count**
  - `4`
- **Why it is a good next arc**
  - `tradeHelpers.js` is still a high-pressure runtime surface used by Trade Machine UI, the validator, hooks, and tests.
  - `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` are active support files directly tied to that same trade-facing boundary rather than a separate subsystem.
  - The boundary stays coherent without forcing in the much larger signing/waive/extension/offseason validation family.
  - Current importer/dependency analysis still reads this as likely batchable in one grouped pass.

### B. Season-Transition / Cap-Legality Helper Family
- **Includes**
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/capHoldTransitionHelpers.js`
  - `src/features/architect/utils/contractNormalization.js`
  - `src/features/architect/utils/tpeLifecycle.js`
  - `src/features/architect/utils/seasonFormat.js`
- **Excludes**
  - `mutationPipeline.js` and `seasonManager.js` orchestration shells
  - the trade-facing helper foundation files above
  - constants-only surfaces
- **Estimated live JS business-logic file count**
  - `5`
- **Why it is not the best next arc**
  - It is coherent at a high level, but it is already broad enough to cover signing, waiving, extensions, option decisions, offer sheets, renounce flows, cap holds, TPE lifecycle, and season format normalization.
  - `capLegalityValidation.js` alone is very large, and the combined family is materially larger than the helper-foundation candidate.
  - Current repo state reads this more like a later grouped migration campaign than the next immediate slice.

### C. World Mutation / Orchestration Surface
- **Includes**
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/worldManager.js`
  - `src/features/architect/utils/teamLoader.js`
  - `src/features/architect/utils/schemaAdapter.js`
  - `src/features/architect/utils/tradeManager.js`
- **Excludes**
  - lower-level helper families unless needed as dependencies during a future dedicated arc
  - closed E39/E41/E43/E44 boundaries
- **Estimated live JS business-logic file count**
  - `6`
- **Why it is not the best next arc**
  - It is clearly live, but it is far too large and cross-cutting for the next immediate migration slice.
  - `mutationPipeline.js` and `seasonManager.js` dominate the scope, and the surrounding files are tightly coupled to reads, writes, persistence, world lifecycle, and apply-time invariants.
  - Current repo state reads this as something that would need multiple sub-arcs, not the next clean follow-up after the closed `tradeContext` mini-arc.

### D. Remaining TradeMachine Engine / Cache Residue
- **Includes**
  - active JS support/instrumentation files such as:
    - `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
    - `src/features/architect/utils/tradeMachine/cache/validationCache.js`
    - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
    - `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
    - `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
- **Excludes**
  - `cache/index.js`, `engine/index.js`, and `validators/index.js` as barrels
  - `resolveValidationEntitlements.js`, `validatorFactory.js`, and `enforcementValidation.js` as zero-import / effectively inactive scope candidates
  - `cacheInvalidationManager.js` and `validationDebugMonitor.js` as test-driven support surfaces
  - `performanceMonitor.js` and `tradeValidator.debug.js` as older duplicate/debug residue
  - constants surfaces
- **Estimated live JS business-logic file count**
  - `5` active JS support-logic files, but the area is heavily mixed with non-business-logic residue
- **Why it is not the best next arc**
  - This cluster is not a clean business-logic migration boundary.
  - Current repo state shows overlapping cache implementations, stale/older duplicates, test-only support files, and zero-import leftovers.
  - It is better read as cleanup/instrumentation debt than the next coherent TypeScript business-logic arc.

## 4. Recommended Next Scope
- **Recommended next migration scope:** the **trade-facing helper foundation** centered on:
  - `src/features/architect/utils/tradeHelpers.js`
  - `src/features/architect/utils/hardCapUtils.js`
  - `src/features/architect/utils/faExceptionUtils.js`
  - `src/features/architect/utils/capUtils.js`
- **Why this is the best next choice**
  - It best matches the “adjacent but still coherent” requirement after E39, E41, and E43/E44.
  - It remains close to live Trade Machine runtime behavior without forcing the audit into the much broader cap-legality or orchestration layers.
  - It has real runtime pressure: `tradeHelpers.js` alone still has heavy direct importer usage across Trade Machine UI, the validator, hooks, and tests; the three supporting files are live dependencies of that same surface.
  - It is also the cleanest cutoff that does not silently reopen prior closed scopes.
- **One arc or split?**
  - Current dependency/importer analysis still says this **likely fits as one grouped arc**.
  - `tradeHelpers.js` is the center of gravity, with `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` acting as its supporting trade-facing helper layer.
  - If a future execution pass uncovers importer friction, the clean fallback split would be:
    - support-helper sub-arc: `capUtils.js`, `hardCapUtils.js`, `faExceptionUtils.js`
    - follow-up sub-arc: `tradeHelpers.js`
  - From the actual current repo state, that split does **not** look necessary yet.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/tradeHelpers.js`
  - **Why it belongs in scope:** still provides live salary, apron-label, pick-display, TPE, and adjustment helpers used by Trade Machine UI, validator-adjacent TS code, hooks, and tests.
  - **Role:** `central`
- `src/features/architect/utils/hardCapUtils.js`
  - **Why it belongs in scope:** still contains live hard-cap trigger / hard-cap status / cap-limit reasoning used by trade UI, cap sheet UI, and re-exported helper flows.
  - **Role:** `central-supporting`
- `src/features/architect/utils/faExceptionUtils.js`
  - **Why it belongs in scope:** still contains live FA-exception bucket eligibility/allocation logic used directly by trade UI and indirectly by `tradeHelpers.js`.
  - **Role:** `supporting`
- `src/features/architect/utils/capUtils.js`
  - **Why it belongs in scope:** still acts as the live apron-status facade used by `tradeHelpers.js`, `faExceptionUtils.js`, `usePlayerRulesProfiles`, `buildRuleContext.ts`, and apron guardrail coverage.
  - **Role:** `supporting`

## 6. Validation / Inspection Run
- **Files changed**
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E45_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- **Validation commands actually run**
  - `npm run typecheck`
    - Result: `PASS`
    - Proved the current audited repo state typechecks cleanly before documenting the next-scope recommendation.
  - `npm run validate:project`
    - Result: `PASS`
    - Proved the project structure remains valid before and during this audit pass.
- **Inspection / classification steps used**
  - Read the E44 closeout package and current `TRADE_MACHINE_MASTER.md` to anchor the closed-scope boundary.
  - Enumerated remaining `.js` files under `src/features/architect/utils/` and `src/features/architect/utils/tradeMachine/`.
  - Classified JS files by whether they had TS peers, then re-read representative files to separate live logic from shims, barrels, constants, debug scripts, and test-only residue.
  - Ran importer scans across `src/` and `tests/` for:
    - helper-foundation files
    - season/cap-legality helper family
    - orchestration files
    - engine/cache residue
  - Ran zero-import verification for files that looked suspicious from the directory scan, including:
    - `resolveValidationEntitlements.js`
    - `validatorFactory.js`
    - `enforcementValidation.js`
    - `validationCacheManager.js`
  - Used `wc -l` to size the top candidates and compare the helper-foundation candidate against the just-closed `tradeContext` mini-arc.
- **What those inspection steps proved**
  - The expected leading candidate was confirmed by current repo evidence rather than assumption.
  - The world-mutation surface and the season/cap-legality helper family are both live, but too large and cross-cutting to be the next immediate slice.
  - The engine/cache residue is real but awkwardly mixed with instrumentation, older duplicates, test-only files, barrels, and zero-import leftovers.
- **Commands intentionally skipped**
  - `npm run test:diff -- --reporter=dot`
    - Skipped because this pass is audit/scoping only and no runtime code changed.
  - `npm run test:architect -- --reporter=dot`
    - Skipped because scope selection was resolved from importer/state inspection without broader test execution.
  - `npm run build`
    - Skipped because this pass only updates audit documentation.
  - `npm run test:full`
    - Skipped because full-suite execution is guarded and not needed for this documentation-only pass.

## 7. Complexity / Risk Assessment
- **Relative size vs the just-closed `tradeContext` mini-arc**
  - By raw size, the recommended helper-foundation candidate is **slightly smaller** (`874` lines across 4 files vs `952` lines across the 3-file `tradeContext` mini-arc).
  - In practical migration difficulty, it looks **roughly similar** because the helper exports fan out into both validator-adjacent logic and Trade Machine UI.
- **Grouped arc or smaller slices?**
  - Current repo evidence still reads as **batchable in one grouped arc**.
  - The support files are tightly related to the same trade-facing helper boundary, and `tradeHelpers.js` is already directly wired to them.
  - The clean fallback split exists, but current dependency pressure does not make it the preferred first read.
- **Key risks / caveats**
  - `tradeHelpers.js` mixes real calculation helpers with UI-facing formatting helpers, so migration work must preserve export names and string output exactly.
  - Hard-cap / apron boundary helpers must preserve existing semantics, especially around first-apron vs second-apron labeling and fail-closed trade behavior.
  - `faExceptionUtils.js` and `capUtils.js` are small, but they sit on live eligibility/gating paths, so even small signature drift would ripple into Trade Machine UI and guardrail tests.
  - This scope should stay migration-focused; opportunistic redesign of helper behavior would turn a coherent arc into a larger cleanup effort.

## 8. Master Doc Update
- Updated `docs/architect/TRADE_MACHINE_MASTER.md` by:
  - adding the indexed entry `### Validator TS Next-Scope Expansion Audit E45 (2026-03-11)`
  - noting explicitly that **E39 remains closed**
  - noting explicitly that **E41 remains complete**
  - noting explicitly that the **`tradeContext` mini-arc remains complete**
  - recording the recommended next migration scope as the trade-facing helper foundation:
    - `tradeHelpers.js`
    - `hardCapUtils.js`
    - `faExceptionUtils.js`
    - `capUtils.js`
  - recording the estimated live JS business-logic count for that scope as `4`
  - recording that the current repo read still favors **one grouped arc**, with split fallback only if importer-state friction appears during execution
