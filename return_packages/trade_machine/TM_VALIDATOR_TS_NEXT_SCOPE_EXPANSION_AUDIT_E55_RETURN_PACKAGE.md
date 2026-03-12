# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E55 — EXECUTION RETURN PACKAGE

## 1. Summary
- The expected leading candidate from current repo inspection was `src/features/architect/utils/playerRulesProfile/`, and final verification against the actual current repo state confirmed that it is now the strongest next migration scope.
- The recommended scope currently contains `6` live JS business-logic files.
- It looks worth doing next because it is still authoritative JS business logic with strong runtime relevance, a clean internal boundary, and a materially better cutoff than the broader orchestration files or the remaining Trade Machine support residue.
- It should not be executed as one blind six-file conversion pass. Current inspection shows `computeProfile.js` acts as the aggregation hub with materially higher coupling than the leaf rule modules, so the arc should stay unified at the audit level but likely execute in phases.

## 2. Closed Scope Confirmation
- **E39 remains closed.**
  - Re-checked the intentionally kept Trade Machine JS entrypoints, barrels, and constants from the validator-adjacent scope.
  - They still read as public-surface, barrel, constant, or support residue rather than the next live business-logic arc.
- **E41 remains complete.**
  - Re-checked `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`, `swapResolution.js`, and `conveyanceResolution.js`.
  - All three still read as compatibility shims over authoritative `.ts` peers.
- **E43/E44 `tradeContext` remains complete.**
  - Re-checked `src/features/architect/utils/tradeContext/tradeContext.js`, `assertions.js`, and `legacy/index.js`.
  - They still read as compatibility shims, while `tradeContext/index.js` remains an intentional public barrel.
- **E46 remains complete.**
  - Re-checked `src/features/architect/utils/tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js`.
  - All four still read as pure compatibility shims over the E46 TypeScript implementations.
- **E48 remains complete.**
  - Re-checked `src/features/architect/utils/capTotals/computeTeamCapTotals.js`.
  - It still reads as a pure compatibility shim over `computeTeamCapTotals.ts`, while `capTotals/index.js` remains only a barrel surface.
- **E50 remains complete.**
  - Re-checked `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`, `validatePersistableShape.js`, `enforcement.js`, and `contracts.js`.
  - They still read as shim-only compatibility surfaces over authoritative `.ts` peers, while `persistenceContracts/index.js` remains an intentional public barrel.
- **E52 remains complete.**
  - Re-checked `src/features/architect/utils/tpeLifecycle.js`, `src/features/architect/utils/exceptions/exceptionLifecycle.js`, and `src/features/architect/utils/entitlements/seasonManagerProjection.js`.
  - They still read as compatibility shims over authoritative `.ts` implementations, while `exceptions/index.js` remains an intentional public barrel.
- **E54 remains complete.**
  - Re-checked `src/features/architect/utils/exceptionHistory/historyHelpers.js`.
  - It now reads as a shim-only compatibility surface over `historyHelpers.ts`.
- This audit avoided silently reopening prior scopes by reclassifying each closed-scope `.js` file first and excluding known shims, barrels, and compatibility surfaces from the new live-business-logic counts unless actual repo evidence proved otherwise. No prior scope needed reopening.

## 3. Candidate Next Scopes

### A. PlayerRulesProfile Internal Rule Engine
- **Includes**
  - `src/features/architect/utils/playerRulesProfile/birdRightsRules.js`
  - `src/features/architect/utils/playerRulesProfile/computeProfile.js`
  - `src/features/architect/utils/playerRulesProfile/extensionRules.js`
  - `src/features/architect/utils/playerRulesProfile/maxSalaryRules.js`
  - `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js`
  - `src/features/architect/utils/playerRulesProfile/rfaRules.js`
- **Excludes**
  - `src/features/architect/utils/playerRulesProfile/index.js` because it is a barrel/public surface
  - `src/features/architect/utils/playerRulesProfile/types.js` because it is JSDoc-only support with no runtime logic
- **Estimated live JS business-logic file count**
  - `6`
- **Why it is a good next arc**
  - It is still entirely JS-authored authoritative business logic with no TS peers.
  - It is live in runtime and test flows through `salaryEngine`, `capLegalityValidation.js`, `usePlayerRulesProfiles.js`, `EditContractModal`, and dedicated unit tests.
  - `ARCHITECT_LAYERING.md` already documents it as an internal implementation behind the stable `salaryEngine` wrapper, which gives the migration a clean external boundary.
  - The only meaningful caution is execution shape: `computeProfile.js` is the aggregation hub and should likely follow the leaf modules rather than be converted in one blind six-file pass.

### B. Entitlement Projection / Display Pair
- **Includes**
  - `src/features/architect/utils/entitlements/formatEntitlement.js`
  - `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
- **Excludes**
  - `src/features/architect/utils/entitlements/seasonManagerProjection.js` because it belongs to the already-closed E52 scope
  - nearby `.ts` entitlement resolver, rules, and DARE files because they are already TS-backed
- **Estimated live JS business-logic file count**
  - `2`
- **Why it is not the best next arc**
  - It is live, coherent, and smaller than `playerRulesProfile`.
  - It is more display/projection oriented than the next highest-value rules boundary.
  - It does not have the same internal-wrapper boundary advantage that `playerRulesProfile` gets from `salaryEngine`.

### C. Core Orchestration / World Mutation Surface
- **Includes**
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/worldManager.js`
- **Excludes**
  - `src/features/architect/utils/runOffseason.js` because it is a thin wrapper over TS offseason logic rather than a next-arc core business-logic boundary
  - lower-level helper families that can still be migrated independently
- **Estimated live JS business-logic file count**
  - `4`
- **Why it is not the best next arc**
  - It is undeniably live and central.
  - It is far too large and cross-domain to be the next intelligent migration slice.
  - Choosing it next would skip over a smaller, cleaner, lower-risk rules family that is already isolated in practice.

### D. Remaining Trade Machine Support Residue
- **Includes**
  - imported support surfaces such as `src/features/architect/utils/tradeMachine/cache/validationCache.js`, `validationCacheService.js`, `engine/engineUtils.js`, `engine/tradeDebug.js`, `engine/performanceMonitor.js`, and `engine/validationPerformanceMonitor.js`
- **Excludes**
  - barrelling-only entrypoints such as `src/features/architect/utils/tradeMachine/cache/index.js` and `engine/index.js`
  - explicitly inspected zero-import files that do not currently qualify as the next business-logic arc:
    - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
    - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
    - `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
- **Estimated live JS business-logic file count**
  - `0` clean next-arc business-logic files for scope-selection purposes
- **Why it is not the best next arc**
  - The area still contains live JS support code, but it reads as cache, debug, instrumentation, and residue rather than the next coherent business-logic boundary.
  - The three zero-import files were explicitly inspected before exclusion:
    - `validatorFactory.js` is an unused factory surface with no repo importers
    - `resolveValidationEntitlements.js` is a read-only helper wrapper with no repo importers
    - `validationCacheManager.js` is only re-exported by a cache barrel and has no runtime importer evidence
  - That inspection reinforced the conclusion that this area should not be the next migration recommendation.

## 4. Recommended Next Scope
- **Recommended next migration scope:** `src/features/architect/utils/playerRulesProfile/`
- **Why it is the best next choice**
  - The expected leading candidate from current repo inspection held up after final verification against the actual current repo state.
  - It is the strongest remaining JS-authored business-logic family with real runtime relevance and a clean boundary around an already-documented internal implementation.
  - It is materially easier to cut cleanly than the orchestration files and more central to business rules than the entitlement projection pair.
- **One arc or split?**
  - Keep it as **one recommended arc at the audit level**.
  - Current repo evidence favors **phased execution** rather than a one-shot conversion:
    - phase 1 should target the leaf rule modules: `minimumSalaryRules.js`, `maxSalaryRules.js`, `birdRightsRules.js`, `rfaRules.js`, and `extensionRules.js`
    - phase 2 should target `computeProfile.js` because it is the aggregation hub that imports the leaf rules and assembles the profile object
  - `index.js` should stay treated as a compatibility/public barrel and should not be counted as core business logic for the arc.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js`
  - **Why it belongs in scope:** authoritative minimum-salary computation and years-of-service logic, with both legacy and RuleContext entry points
  - **Role:** `central leaf`
- `src/features/architect/utils/playerRulesProfile/maxSalaryRules.js`
  - **Why it belongs in scope:** authoritative max-salary and supermax logic, with legacy and RuleContext entry points used by salary workflows
  - **Role:** `central leaf`
- `src/features/architect/utils/playerRulesProfile/birdRightsRules.js`
  - **Why it belongs in scope:** authoritative Bird-rights classification and signing-capability logic used in player rules profiles
  - **Role:** `central leaf`
- `src/features/architect/utils/playerRulesProfile/rfaRules.js`
  - **Why it belongs in scope:** authoritative restricted-free-agency and qualifying-offer logic used in player rules profiles
  - **Role:** `central leaf`
- `src/features/architect/utils/playerRulesProfile/extensionRules.js`
  - **Why it belongs in scope:** authoritative extension-eligibility and extension-terms logic, including RuleContext support
  - **Role:** `central leaf`
- `src/features/architect/utils/playerRulesProfile/computeProfile.js`
  - **Why it belongs in scope:** aggregation hub that imports the leaf modules, normalizes league context, and assembles the canonical profile object consumed by higher-level flows
  - **Role:** `central hub`

## 6. Validation / Inspection Run
- **Files changed**
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E55_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- **Validation commands actually run**
  - `npm run typecheck`
    - Result: `PASS`
  - `npm run validate:project`
    - Result: `PASS`
- **Inspection steps used**
  - Re-read `docs/architect/TRADE_MACHINE_MASTER.md` plus the E53 and E54 return packages to lock the already-closed boundaries before re-counting any JS files.
  - Re-scanned remaining `.js` files under `src/features/architect/utils/` to separate TS-backed shims/barrels from authoritative JS business logic.
  - Re-read the `playerRulesProfile` family, including file contents, line counts, and importer usage across `src/` and `tests/`.
  - Re-read the entitlement projection pair, the orchestration family, and the remaining Trade Machine support residue.
  - Explicitly inspected the required zero-import files: `validatorFactory.js`, `resolveValidationEntitlements.js`, and `validationCacheManager.js`.
  - Re-read `src/features/architect/utils/ARCHITECT_LAYERING.md` to confirm the stable `salaryEngine` wrapper boundary around the internal `playerRulesProfile` implementation.
- **What those steps proved**
  - The previously expected leading candidate, `playerRulesProfile`, still has the cleanest next-scope boundary after actual repo verification.
  - `playerRulesProfile` currently contains `6` live JS business-logic files and no authoritative TS peers.
  - `computeProfile.js` has materially higher coupling than the leaf rule files because it imports the rule modules and assembles the aggregate profile shape, which makes phased execution preferable.
  - The entitlement projection pair is live and coherent but lower priority.
  - `capLegalityValidation.js`, `mutationPipeline.js`, `seasonManager.js`, and `worldManager.js` remain too broad for the next intelligent slice.
  - The inspected Trade Machine residue contains live support code, but not the next clean business-logic migration arc.
- **Commands intentionally skipped**
  - `npm run build`
    - Exact reason: this pass only updates audit documentation.
  - `npm run test:diff -- --reporter=dot`
    - Exact reason: no runtime code changed, and the scope decision was resolved through static inspection plus the required repo validation commands.
  - broader scoped test suites
    - Exact reason: this was an audit-only doc pass and no unresolved scope ambiguity remained after inspection.

## 7. Complexity / Risk Assessment
- **Relative size vs the just-closed E54 exception-history mini-arc**
  - The recommended next arc is **larger** than E54.
  - E54 was a single-file helper mini-arc; the recommended `playerRulesProfile` scope is `6` live JS business-logic files totaling roughly `2714` lines, excluding the barrel and JSDoc-only support file.
- **Batchable or smaller slices?**
  - It reads as **one grouped audit arc with phased execution**.
  - Do not recommend a blind one-shot merge of all six files if the execution pass still sees `computeProfile.js` as the higher-coupling hub.
- **Key risks / caveats**
  - Preserve the stable public boundary through `salaryEngine`; avoid turning the internal implementation migration into a public API redesign.
  - Preserve both legacy and RuleContext entry points across the leaf modules.
  - Preserve current result shapes, warning behavior, fallback/default behavior, and helper constants in the rules outputs.
  - Preserve `computeProfile.js` aggregation semantics, especially context normalization and the assembled profile shape consumed by UI and validation flows.

## 8. Master Doc Update
- Updated `docs/architect/TRADE_MACHINE_MASTER.md` `Last updated` date to `2026-03-12`.
- Added `### Validator TS Next-Scope Expansion Audit E55 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new E55 entry records that:
  - **E39 remains closed**
  - **E41 remains complete**
  - the **`tradeContext` mini-arc remains complete**
  - the **E46 trade-facing helper foundation remains complete**
  - the **E48 `capTotals` mini-arc remains complete**
  - the **E50 `persistenceContracts` arc remains complete**
  - the **E52 season-transition helper arc remains complete**
  - the **E54 exception-history mini-arc remains complete**
  - the expected leading candidate from current repo inspection was `src/features/architect/utils/playerRulesProfile/`, and final verification confirmed it as the recommended next scope
  - the estimated live JS business-logic count for that scope is `6`
  - the next arc should stay unified at the audit level but likely execute in **phased execution**, with the leaf rule modules first and `computeProfile.js` following as the aggregation hub
