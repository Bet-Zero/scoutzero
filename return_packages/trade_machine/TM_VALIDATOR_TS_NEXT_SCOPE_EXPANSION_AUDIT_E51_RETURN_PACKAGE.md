# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E51 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the actual current repo state is the season-transition helper cluster centered on `src/features/architect/utils/tpeLifecycle.js`, `src/features/architect/utils/exceptions/exceptionLifecycle.js`, and `src/features/architect/utils/entitlements/seasonManagerProjection.js`.
- The recommended scope currently appears to contain `3` core live JS business-logic files.
- It looks worth doing next because it is the smallest coherent remaining helper-heavy boundary with strong runtime relevance across season advance, offseason transition, Season Manager projection, and their dedicated guardrail/integration coverage.

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
  - They still read as shim-only compatibility surfaces over authoritative `.ts` peers, with `index.js` remaining only as the nearby barrel/support surface.
- This audit avoided silently reopening prior scopes by reclassifying all closed-scope `.js` files first and excluding them from the live-business-logic comparison unless actual repo evidence proved otherwise. No prior scope needed reopening.

## 3. Candidate Next Scopes

### A. Season-Transition Helper Cluster
- **Includes**
  - `src/features/architect/utils/tpeLifecycle.js`
  - `src/features/architect/utils/exceptions/exceptionLifecycle.js`
  - `src/features/architect/utils/entitlements/seasonManagerProjection.js`
- **Excludes**
  - `src/features/architect/utils/exceptions/index.js` because it is a barrel-only public surface
  - `src/features/architect/utils/runOffseason.js` because it is a thin JS wrapper over TS-owned OSTE behavior
  - `src/features/architect/utils/exceptionHistory/historyHelpers.js` from the core live-business-logic count because it is a shared cross-flow support surface used by both season-advance and mutation-pipeline paths
  - `src/features/architect/utils/seasonManager.js` and `src/features/architect/utils/offseason/resolveOffseasonTransition.ts` because they are orchestration layers, not helper-boundary files
- **Estimated live JS business-logic file count**
  - `3`
- **Why it is a good next arc**
  - It is helper-only, still authoritative JS, and tightly tied to season-transition behavior.
  - It stays materially smaller than the remaining folder-wide and orchestration-scale candidates.
  - The cutoff is clean enough to preserve the “smallest coherent boundary” rule while still covering live runtime paths in `seasonManager.js`, `resolveOffseasonTransition.ts`, `SeasonAdvanceModal.jsx`, and dedicated season-advance / DARE tests.

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
  - `src/features/architect/utils/playerRulesProfile/types.js` because it reads as JSDoc/type-documentation support rather than live business logic
- **Estimated live JS business-logic file count**
  - `6`
- **Why it is not the best next arc**
  - It is unquestionably live and still behavior-bearing.
  - It is much larger than the season-transition helper cluster.
  - The repo increasingly routes callers through `salaryEngine`, while `capLegalityValidation.js` still deep-imports pieces of the folder, so this reads as a future grouped campaign or sub-arc chain rather than the cleanest immediate next slice.

### C. Broader Cap-Legality / Offseason Helper Family
- **Includes**
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/capHoldTransitionHelpers.js`
  - `src/features/architect/utils/contractNormalization.js`
  - `src/features/architect/utils/seasonFormat.js`
  - `src/features/architect/utils/tpeLifecycle.js`
- **Excludes**
  - `src/features/architect/utils/mutationPipeline.js` and `src/features/architect/utils/seasonManager.js` because they are orchestration shells
  - `src/features/architect/utils/playerRulesProfile/*` because that is a separate internal rule-engine candidate
- **Estimated live JS business-logic file count**
  - `5`
- **Why it is not the best next arc**
  - It is real live business logic, but it is too broad for the next immediate migration slice.
  - `capLegalityValidation.js` alone dominates the size and blast radius.
  - Pulling this family next would broaden the migration campaign faster than the current repo state justifies.

### D. World Mutation / Orchestration Surface
- **Includes**
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/worldManager.js`
  - `src/features/architect/utils/tradeManager.js`
  - `src/features/architect/utils/teamLoader.js`
  - `src/features/architect/utils/schemaAdapter.js`
- **Excludes**
  - lower-level helper families and all previously closed scopes
- **Estimated live JS business-logic file count**
  - `6`
- **Why it is not the best next arc**
  - It is clearly live and central.
  - It is too large and cross-cutting to be the next intelligent slice.
  - Choosing it next would violate the “do not jump to the largest or most central subsystem by instinct” rule.

### E. Remaining Trade Machine Support / Residue
- **Includes**
  - actively imported JS support surfaces such as `validationCache.js`, `validationCacheService.js`, `cacheInvalidationManager.js`, `engineUtils.js`, `validationPerformanceMonitor.js`, and `tradeDebug.js`
- **Excludes**
  - barrel surfaces such as `cache/index.js`, `engine/index.js`, and `rules/index.js`
  - constants/message surfaces
  - explicitly inspected zero-import files:
    - `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
    - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
    - `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
    - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
- **Estimated live JS business-logic file count**
  - `0` clean business-logic files for next-arc purposes
- **Why it is not the best next arc**
  - The area still contains JS support logic, but it reads as cache, instrumentation, debug, and residue rather than the next coherent business-logic migration boundary.
  - The required zero-import files were inspected explicitly before exclusion, and that inspection reinforced the “not next” conclusion.

## 4. Recommended Next Scope
- **Recommended next migration scope:** the season-transition helper cluster centered on `src/features/architect/utils/tpeLifecycle.js`, `src/features/architect/utils/exceptions/exceptionLifecycle.js`, and `src/features/architect/utils/entitlements/seasonManagerProjection.js`
- **Why this is the best next choice**
  - The expected leading candidate from current repo inspection still won after direct comparison against the strongest alternatives.
  - It is the smallest remaining live-business-logic boundary with strong runtime relevance and a clean enough helper-only cutoff.
  - It stays materially smaller and less risky than `playerRulesProfile`, the broader cap/offseason helper family, and the orchestration surfaces.
  - It is cleaner than the remaining Trade Machine residue, which still reads as mixed support/instrumentation cleanup rather than the next business-logic arc.
- **One arc or split?**
  - Current repo evidence favors **one grouped helper arc**.
  - The clean fallback split, only if execution exposes cross-folder typing/import friction, is:
    - lifecycle sub-arc: `tpeLifecycle.js` + `exceptionLifecycle.js`
    - follow-up sub-arc: `seasonManagerProjection.js`
  - `historyHelpers.js` should not be silently absorbed into the core count. At audit time it reads as an adjacent cross-flow support surface, not core scope; if future execution proves it inseparable, record it explicitly as included support or as a split follow-up requirement.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/tpeLifecycle.js`
  - **Why it belongs in scope:** it owns TPE season-boundary expiry logic, canonical expiry-date access, invalid-date fail-safe behavior, and legacy `expiresOn` backfill behavior used by season transition flows and UI previews.
  - **Role:** `central`
- `src/features/architect/utils/exceptions/exceptionLifecycle.js`
  - **Why it belongs in scope:** it owns non-TPE exception rollover, legacy exception-key remapping, enabled-flag preservation, amount reset/recompute behavior, and DPE reset behavior for new seasons.
  - **Role:** `central`
- `src/features/architect/utils/entitlements/seasonManagerProjection.js`
  - **Why it belongs in scope:** it owns the entitlement-to-draft-pick projection layer that Season Manager uses for swap/conveyance/Stepien-compatible draft-asset processing.
  - **Role:** `central-supporting`
- Adjacent files inspected explicitly but excluded from the core live-business-logic count:
  - `src/features/architect/utils/exceptionHistory/historyHelpers.js`
    - **Classification:** shared support surface
    - **Why excluded from the core count:** it is used by `seasonManager.js`, `resolveOffseasonTransition.ts`, and `mutationPipeline.js`, so it crosses the boundary the recommended arc is trying to keep helper-only and season-transition-focused
    - **Execution note:** if future migration work proves it inseparable from `tpeLifecycle.js`, record it explicitly as included support or as a split follow-up instead of silently broadening the core arc
  - `src/features/architect/utils/exceptions/index.js`
    - **Classification:** barrel-only surface
  - `src/features/architect/utils/runOffseason.js`
    - **Classification:** thin JS wrapper over `resolveOffseasonTransition.ts`

## 6. Validation / Inspection Run
- **Files changed**
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E51_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- **Validation commands actually run**
  - `npm run typecheck`
    - Result: `PASS`
    - Proved the current audited repo state typechecks cleanly during this docs-only audit pass.
  - `npm run validate:project`
    - Result: `PASS`
    - Proved the project structure remained valid after adding the E51 audit docs.
- **Inspection commands and steps used**
  - Re-read `docs/architect/TRADE_MACHINE_MASTER.md` plus the E47, E49, and E50 return packages to re-lock the closed boundaries.
  - Enumerated the remaining Architect utility JS/TS surface with `rg --files src/features/architect/utils | rg '\\.(js|ts)$'`.
  - Ran importer scans across `src`, `src/tests`, and `tests` with `rg -n` to compare runtime/test pressure for the leading candidates.
  - Used direct `sed -n` inspection on the leading candidate files, `historyHelpers.js`, `runOffseason.js`, `exceptions/index.js`, and the required zero-import Trade Machine residue files.
  - Used a small `node` line-count script to compare candidate scope size.
- **What those steps proved**
  - E39, E41, E43/E44, E46, E48, and E50 remain closed/complete in the current repo state.
  - The expected leading season-transition helper cluster still wins after current-state comparison, rather than assumption.
  - `historyHelpers.js` is adjacent but cross-flow; it should not be silently folded into the recommended core count.
  - The remaining Trade Machine zero-import files were inspected explicitly and still do not justify reopening that residue as the next business-logic arc.
- **Commands intentionally skipped**
  - `npm run build`
    - Exact reason: this pass only updates audit documentation.
  - `npm run test:diff -- --reporter=dot`
    - Exact reason: no runtime code changed, and static inspection resolved the scope decision without requiring additional runtime proof.
  - `npm run test:architect -- --reporter=dot`
    - Exact reason: broader test execution was unnecessary for a docs-only audit pass once the required repo gates passed.

## 7. Complexity / Risk Assessment
- **Relative size vs the just-closed E50 `persistenceContracts` arc**
  - The recommended next arc looks **slightly smaller overall** than E50.
  - Current JS size for the recommended core boundary is roughly `657` lines (`113 + 295 + 249`) versus E50’s three core procedural files plus the `contracts.js` rule-definition support surface.
- **Batchable or smaller slices?**
  - Current repo evidence still reads as **one grouped helper arc**.
  - The fallback split exists, but the cluster is coherent enough that grouped execution is the better default read.
- **Key risks / caveats**
  - `tpeLifecycle.js` must preserve exact July 1 season-boundary handling, invalid-date fail-safe behavior, and legacy expiry backfill behavior.
  - `exceptionLifecycle.js` must preserve legacy exception-key remapping, enabled-flag preservation, amount reset semantics, and DPE clear-on-rollover behavior.
  - `seasonManagerProjection.js` must preserve the exact draft-pick-like shape Season Manager expects, including protection/conveyance mapping and resolution metadata placeholders.
  - `historyHelpers.js` is the main adjacency risk: it should not be silently pulled into the core arc, but future execution may need to treat it as explicit support or a follow-up slice if typing/import friction proves the helper boundary less isolated than it looks today.

## 8. Master Doc Update
- Updated `docs/architect/TRADE_MACHINE_MASTER.md` by adding:
  - `### Validator TS Next-Scope Expansion Audit E51 (2026-03-11)`
- The new E51 entry records that:
  - **E39 remains closed**
  - **E41 remains complete**
  - the **`tradeContext` mini-arc remains complete**
  - the **E46 trade-facing helper foundation remains complete**
  - the **E48 `capTotals` mini-arc remains complete**
  - the **E50 `persistenceContracts` arc remains complete**
  - the recommended next migration scope is the season-transition helper cluster centered on `tpeLifecycle.js`, `exceptionLifecycle.js`, and `seasonManagerProjection.js`
  - the estimated core live JS business-logic count for that scope is `3`
  - the next arc currently reads as **one grouped helper scope**, with a clean fallback split of lifecycle helpers first and `seasonManagerProjection.js` second
  - `historyHelpers.js` was inspected explicitly and remains outside the core count unless future execution proves it inseparable
