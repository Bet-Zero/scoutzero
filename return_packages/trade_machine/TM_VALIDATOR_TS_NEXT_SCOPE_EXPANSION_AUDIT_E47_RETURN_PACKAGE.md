# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E47 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration scope from the actual current repo state is the **`capTotals` SSOT boundary** centered on `src/features/architect/utils/capTotals/computeTeamCapTotals.js`.
- The recommended scope appears to contain **1 live JS business-logic file**. The nearby `src/features/architect/utils/capTotals/index.js` surface is live, but it reads as a barrel-only compatibility surface rather than additional business logic.
- It looks worth doing next because it is smaller and cleaner than the heavier candidate families, while still carrying strong runtime relevance across Trade Machine UI, trade-context/apply-time flows, cap sheet UI, offseason transitions, and world-mutation totals recomputation.

## 2. Closed Scope Confirmation
- **E39** remains closed.
  - I re-checked `src/features/architect/utils/tradeMachine/index.js`, `rules/index.js`, `utils/index.js`, `validators/index.js`, `constants/cbaConstants.js`, and `constants/secondApronMessages.js`.
  - They still read as intentionally kept public entrypoints/barrels/constants, not the next live JS business-logic arc.
- **E41** remains complete.
  - I re-checked `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`, `swapResolution.js`, and `conveyanceResolution.js`.
  - All three still read as shim-only compatibility surfaces over authoritative `.ts` peers, so they were excluded from the next-scope live-business-logic count.
- **E43/E44** `tradeContext` remains complete.
  - I re-checked `src/features/architect/utils/tradeContext/tradeContext.js`, `assertions.js`, and `legacy/index.js`.
  - They still read as shim/barrel compatibility surfaces over authoritative `.ts` files, so they were excluded from the next-scope live-business-logic count.
- **E46** remains complete.
  - I re-checked `src/features/architect/utils/tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js`.
  - All four still read as pure compatibility shims over the E46 TypeScript implementations, so they were excluded from the next-scope live-business-logic count.
- This audit avoided silently reopening prior scopes by reclassifying those closed-scope `.js` files first, before comparing any new candidates.

## 3. Candidate Next Scopes

### A. CapTotals SSOT Boundary
- **Includes**
  - `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
- **Excludes**
  - `src/features/architect/utils/capTotals/index.js` from the live-business-logic count because it is a barrel-only surface
  - `src/features/architect/utils/seasonFormat.js`, `capProjections.js`, `capLegalityValidation.js`, and broader mutation/offseason files because they are dependencies or adjacent consumers rather than part of the clean `capTotals` ownership boundary
- **Estimated live JS business-logic file count**
  - `1`
- **Why it is a good next arc**
  - It is the smallest coherent live-business-logic boundary that still has strong runtime relevance.
  - `computeTeamCapTotals.js` is the SSOT totals engine used by Trade Machine UI, cap sheet UI, `tradeContext.ts`, `mutationPipeline.js`, `seasonManager.js`, `tradeManager.js`, `resolveOffseasonTransition.ts`, and `capLegalityValidation.js`.
  - The cutoff is unusually clean: one authoritative logic file plus one nearby barrel surface.

### B. Persistence-Contract Enforcement / TPE Normalization Cluster
- **Includes**
  - `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
  - `src/features/architect/utils/persistenceContracts/validatePersistableShape.js`
  - `src/features/architect/utils/persistenceContracts/enforcement.js`
- **Excludes**
  - `src/features/architect/utils/persistenceContracts/contracts.js` from the live-business-logic count because it reads more like a live rule-surface/allowlist definition than the core execution logic
  - `src/features/architect/utils/persistenceContracts/index.js` because it is a barrel
- **Estimated live JS business-logic file count**
  - `3`
- **Why it is or isn’t a good next arc**
  - It is a serious candidate and the next-best nearby option after `capTotals`.
  - It has real runtime relevance through TPE reads, Trade Machine rule helpers, offseason persistence, and environment-gated persistence enforcement.
  - It lost to `capTotals` because it is still wider, split across TPE normalization plus persistence enforcement concerns, and does not cut as cleanly as the single-ownership `capTotals` SSOT surface.

### C. PlayerRulesProfile Internal Rule Engine
- **Includes**
  - `src/features/architect/utils/playerRulesProfile/computeProfile.js`
  - `src/features/architect/utils/playerRulesProfile/extensionRules.js`
  - `src/features/architect/utils/playerRulesProfile/birdRightsRules.js`
  - `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js`
  - `src/features/architect/utils/playerRulesProfile/maxSalaryRules.js`
  - `src/features/architect/utils/playerRulesProfile/rfaRules.js`
- **Excludes**
  - `src/features/architect/utils/playerRulesProfile/index.js` because it is a barrel
  - `src/features/architect/utils/playerRulesProfile/types.js` because it reads as support/documentation surface rather than core business logic
- **Estimated live JS business-logic file count**
  - `6`
- **Why it is or isn’t a good next arc**
  - It is real live business logic and remains a valid future migration campaign.
  - It is materially larger than `capTotals` and `persistenceContracts`, and current repo layering intentionally funnels consumers through `salaryEngine`, which makes it a less clean immediate follow-up than the smaller adjacent boundaries.

### D. Broader Cap-Legality / Offseason Helper Family
- **Includes**
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/capHoldTransitionHelpers.js`
  - `src/features/architect/utils/contractNormalization.js`
  - `src/features/architect/utils/tpeLifecycle.js`
  - `src/features/architect/utils/seasonFormat.js`
- **Excludes**
  - `src/features/architect/utils/capTotals/computeTeamCapTotals.js` because current repo evidence says it is cleaner as its own smaller adjacent boundary
  - `src/features/architect/utils/capProjections.js` because it reads primarily as shared cap-data/rule surface rather than the core logic center of this family
- **Estimated live JS business-logic file count**
  - `5`
- **Why it is or isn’t a good next arc**
  - It was one of the expected leading candidates from initial inspection and is still clearly live.
  - It is too broad for the “smallest coherent boundary” rule: the family spans cap validation, cap-hold transitions, normalization, TPE lifecycle, and season-format helpers, with `capLegalityValidation.js` alone dominating the size/risk profile.

### E. World Mutation / Orchestration Surface
- **Includes**
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/worldManager.js`
  - `src/features/architect/utils/tradeManager.js`
  - `src/features/architect/utils/teamLoader.js`
  - `src/features/architect/utils/schemaAdapter.js`
- **Excludes**
  - lower-level helper families unless pulled into a later dedicated campaign
  - closed E39/E41/E43/E44/E46 boundaries
- **Estimated live JS business-logic file count**
  - `6`
- **Why it is or isn’t a good next arc**
  - It is clearly live and runtime-critical.
  - It is too large and cross-cutting for the next immediate migration slice. It would almost certainly require multiple sub-arcs and would violate the rule against recommending the largest or most central subsystem by instinct.

### F. Remaining TradeMachine Engine / Cache Residue
- **Includes**
  - active JS support/instrumentation surfaces such as `validationCache.js`, `validationCacheService.js`, `engineUtils.js`, `tradeDebug.js`, and `validationPerformanceMonitor.js`
- **Excludes**
  - barrels (`cache/index.js`, `engine/index.js`, `validators/index.js`)
  - constants/message surfaces
  - zero-import or effectively inactive leftovers such as `validatorFactory.js`, `resolveValidationEntitlements.js`, and `tradeExportUtils.js`
- **Estimated live JS business-logic file count**
  - `5` active JS support-logic files, but the area is heavily mixed with instrumentation and residue
- **Why it is or isn’t a good next arc**
  - It is not a clean business-logic migration boundary.
  - Current repo state still reads it as a mixed instrumentation/cache cleanup area rather than the next coherent TypeScript business-logic arc.

## 4. Recommended Next Scope
- **Recommended next migration scope:** the **`capTotals` SSOT boundary** centered on `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
- **Why this is the best next choice**
  - The expected leading candidates from initial inspection were `persistenceContracts`, `playerRulesProfile`, and the broader cap/offseason family, but verifying the actual current repo state surfaced `capTotals` as a smaller adjacent boundary with stronger direct runtime pressure and a cleaner cutoff.
  - It satisfies the explicit E47 heuristic: it is not the largest or most central subsystem chosen by instinct; it is the smallest coherent live-business-logic boundary that still matters heavily at runtime.
  - It sits directly on user-facing and apply-time flows: cap sheet tiles, Trade Machine cap impact/team cards, `useTradeMachine`, `tradeContext.ts`, mutation/apply-time totals recompute, season advance, offseason transitions, and trade/world manager totals updates.
- **One arc or split?**
  - Current repo evidence says this should be handled as **one grouped mini-arc**.
  - `computeTeamCapTotals.js` is the only live JS business-logic file in the recommended boundary.
  - `src/features/architect/utils/capTotals/index.js` can be treated as a nearby barrel/support surface during execution, but the current repo read does not justify splitting the arc further.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
  - **Why it belongs in scope:** it is the authoritative team-cap totals engine, including totals calculation, room-exception eligibility, and totals-drift warning helpers used across cap sheet UI, Trade Machine UI, mutation/apply-time flows, season/offseason recomputation, and TS-backed `tradeContext`.
  - **Role:** `central`
- Nearby surface explicitly inspected but excluded from the live-business-logic count:
  - `src/features/architect/utils/capTotals/index.js`
  - **Why excluded:** barrel-only export surface over `computeTeamCapTotals.js`, not additional business logic

## 6. Validation / Inspection Run
- **Files changed**
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E47_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- **Validation commands actually run**
  - `npm run typecheck`
    - Result: `PASS`
    - Proved the current audited repo state typechecks cleanly before and during this audit pass.
  - `npm run validate:project`
    - Result: `PASS`
    - Proved the project structure remained valid for this documentation-only audit pass.
- **Inspection steps used**
  - Read the E39, E41, E43/E44, and E46 return packages plus `docs/architect/TRADE_MACHINE_MASTER.md` to anchor the closed-scope boundary.
  - Enumerated remaining `.js` files under `src/features/architect/utils/` and `src/features/architect/utils/tradeMachine/`.
  - Opened representative files with `sed -n` to classify them as live business logic, shim/barrel, constants/messages, or residue.
  - Ran `rg -n` importer scans and one-off `node` inspection scripts to compare candidate clusters by runtime/test usage, line count, TS-peer/shim status, and zero-import status.
  - Manually spot-checked extensionless/barrel-heavy areas such as `capTotals`, `persistenceContracts`, and `playerRulesProfile` so the recommendation would not depend on undercounted importer graph heuristics.
- **What those inspection steps proved**
  - The heavier anticipated candidates (`persistenceContracts`, `playerRulesProfile`, broader cap/offseason helpers) are real, but they are not the smallest clean next slice.
  - `capTotals` emerged from the actual current repo state as the smaller adjacent boundary with the cleanest ownership line and strong runtime relevance.
  - World orchestration remains too large, and remaining Trade Machine engine/cache JS still reads as mixed instrumentation/support residue rather than the next business-logic arc.
- **Commands intentionally skipped**
  - `npm run test:diff -- --reporter=dot`
    - Skipped because this pass is audit/scoping only and makes no runtime code changes.
  - `npm run test:architect -- --reporter=dot`
    - Skipped because importer/content inspection resolved the scope decision without broader runtime uncertainty.
  - `npm run build`
    - Skipped because this pass only updates audit documentation.
  - `npm run test:full`
    - Skipped because full-suite execution is guarded and not needed for a docs-only audit pass.

## 7. Complexity / Risk Assessment
- **Relative size vs the just-closed E46 helper-foundation arc**
  - The recommended next arc is **substantially smaller** than E46.
  - Current live-business-logic read: `computeTeamCapTotals.js` is about `387` lines of JS business logic versus E46’s `4` live JS files totaling roughly `874` lines before that arc closed.
- **Grouped arc or smaller slices?**
  - Current repo evidence reads this as **one grouped mini-arc**, not another long sub-arc chain.
  - There is no strong reason to split a one-core-file boundary unless execution later uncovers importer-path friction around the barrel surface.
- **Key risks / caveats**
  - Even though the file count is small, the fan-out is high. `computeTeamCapTotals()` is used across cap sheet UI, Trade Machine UI, apply-time mutation flows, season advance, offseason, and totals guardrails.
  - Execution would need to preserve exact totals output shape, especially `totalCapAllocations`, `deltas`, `_meta`, dead-money precedence, cap-hold handling, incomplete-roster-charge behavior, `canUseRoomException()`, and dev-only warning behavior.
  - Direct-path imports and barrel imports both exist today, so import compatibility would need to remain stable.

## 8. Master Doc Update
- Updated `docs/architect/TRADE_MACHINE_MASTER.md` by:
  - adding the indexed entry `### Validator TS Next-Scope Expansion Audit E47 (2026-03-11)`
  - noting explicitly that **E39 remains closed**
  - noting explicitly that **E41 remains complete**
  - noting explicitly that the **`tradeContext` mini-arc remains complete**
  - noting explicitly that the **E46 trade-facing helper foundation remains complete**
  - recording the recommended next migration scope as the `capTotals` SSOT boundary centered on `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
  - recording the estimated live JS business-logic count for that scope as `1`
  - recording that the current repo read favors **one grouped mini-arc**, not a split arc
