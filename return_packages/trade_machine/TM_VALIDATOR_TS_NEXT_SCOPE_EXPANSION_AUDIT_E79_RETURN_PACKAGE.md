# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E79 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next coherent TypeScript migration scope from the current repo state is `src/features/architect/utils/consentUtils.js`.
- Estimated live JS business-logic count for the recommended scope: `1`.
- It looks worth doing next because it is the smallest remaining runtime-live business-logic boundary with a clean cutoff, and it is materially cleaner than the nearby one-file data-loader challenger, the mixed validator-support cluster, and the larger orchestration family.

## 2. Closed Scope Confirmation
- This audit treated the following prior scopes as closed or complete: E39 validator-adjacent Trade Machine scope, E41 draft-pick resolution utility scope, E43/E44 `tradeContext`, E46 trade-facing helper foundation, E48 `capTotals`, E50 `persistenceContracts`, E52 season-transition helpers, E54 exception-history helpers, E56/E57 `playerRulesProfile`, E59 contract/season helpers, E61/E62 non-trade cap-legality, E64 world-aware loader, E66/E67 entitlement presentation, E69 Trade Machine snapshot/accessors, E71 Architect contract/cap hooks, E73 world lifecycle, E75 trade-execution helpers, E77 Trade Machine helper-trio, and E78 `useTradeMachine`.
- The audit avoided silently reopening those areas by re-checking the same-name `.js` files, nearby barrels, and adjacent wrappers against current importer/runtime evidence and continuing to classify them as TS-backed compatibility shims, public barrels, or wrapper-only surfaces rather than reopened business logic.
- No closed scope showed repo evidence that required reopening in E79.

## 3. Candidate Next Scopes

### Candidate 1 — Consent Helper Boundary
- Includes:
  - `src/features/architect/utils/consentUtils.js`
- Excludes:
  - TS-backed `src/features/architect/utils/tradeMachine/rules/validateConsent.js`
  - TS-backed `src/features/architect/utils/tradeMachine/rules/enforceConsent.js`
  - legacy `src/features/architect/utils/tradeMachine/rules/enforcement.js`
  - zero-import `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
- Estimated live JS business-logic file count: `1`.
- Why it is a good next arc:
  - It remains runtime-live through `validateConsent.ts` and `enforceConsent.ts`, and those rules are consumed by `tradeValidator.ts`.
  - Its ownership is narrow: consent alias detection, NTC approval checks, Bird-veto checks, and shared violation collection.
  - The boundary stays adjacent to the Trade Machine rule surface without reopening E78 or widening into validator internals.
- Why it wins:
  - It is the smallest coherent runtime-relevant business-logic slice left in the nearby frontier.

### Candidate 2 — World / Data-Access Boundary
- Includes:
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js`
- Excludes:
  - `src/features/architect/hooks/useArchitectPlayerData.js`
  - TS loaders such as `teamLoader.ts` and `worldTeamData.ts`
- Estimated live JS business-logic file count: `1`.
- Why it is a serious candidate:
  - It is runtime-live through `LeagueView.jsx`, `teamLoader.ts`, `worldTeamData.ts`, and free-agent/dashboard mocks.
  - It owns real base-team hydration and free-agent pool access behavior.
- Why it is not the best next arc:
  - It mixes base-team hydration, fallback team listing, free-agent reads, and free-agent writes in one file.
  - That makes it a less coherent next boundary than the consent helper.

### Candidate 3 — Validator Runtime-Support Cluster
- Includes:
  - `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
  - `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
  - `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
  - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
- Excludes:
  - `src/features/architect/utils/tradeMachine/cache/validationCache.js`
  - `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js`
  - `src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js`
  - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
  - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
- Estimated live JS business-logic file count: `4`.
- Why it is not a good next arc:
  - The remaining live path is split across mixed cache/debug/monitoring support.
  - Nearby residue still includes a second cache implementation, test-only/debug-heavy consumers, and zero-import leftovers, so the cutoff is awkward.

### Candidate 4 — Season / Pipeline Orchestration Family
- Includes:
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
- Excludes:
  - `src/features/architect/utils/runOffseason.js` from the core count because it is a thin wrapper over the TS offseason engine
  - already-closed helper families these files consume
- Estimated live JS business-logic file count: `2` central files plus `1` wrapper.
- Why it is not a good next arc:
  - `mutationPipeline.js` and `seasonManager.js` are both very large, highly coupled orchestration surfaces with broad runtime and test coverage.
  - This would be a much larger and riskier move than the smallest coherent next slice.

## 4. Recommended Next Scope
- Recommended next migration scope: `src/features/architect/utils/consentUtils.js`.
- Why it is the best next choice:
  - It is the smallest remaining runtime-live business-logic boundary with clear ownership and a clean exclusion line.
  - It stays adjacent to current Trade Machine rule flow without reopening E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, or E78.
  - It beats the `firebaseTeamPlanHelpers.js` challenger because that file still mixes several different data-access responsibilities.
  - It is materially cleaner than the validator-support cluster and much smaller than the season/pipeline family.
- Recommended execution shape: one grouped mini-arc.
- Hard rule for any follow-up execution:
  - Do not silently widen the recommended scope to include `validateConsent.ts`, `enforceConsent.ts`, `tradeValidator.ts`, legacy `enforcement.js`, or `enforcementValidation.js` unless execution evidence proves `consentUtils.js` cannot stand cleanly as its own migration boundary.
  - If that happens, document the exact blocker instead of auto-expanding the scope.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/consentUtils.js`
  - Why it belongs in scope:
    - It remains the shared JS authority for consent alias detection, NTC requirement checks, Bird-veto detection, and canonical violation collection.
    - `validateConsent.ts` and `enforceConsent.ts` both import it through the explicit `.js` path, and `tradeValidator.ts` consumes those TS rules at runtime.
  - Central or peripheral: `central`.

## 6. Validation / Inspection Run
- Inspection commands and steps used:
  - `git status --short`
  - `rg -n "### Validator TS Next-Scope Expansion Audit E76|### Validator TS Trade Machine Hook-Support Helpers E77|### Validator TS Use Trade Machine E78" docs/architect/TRADE_MACHINE_MASTER.md`
  - `sed -n '1270,1335p' docs/architect/TRADE_MACHINE_MASTER.md`
  - `rg --files src/features/architect | rg '\.jsx$|\.js$'`
  - targeted `rg -n` importer scans covering:
    - `consentUtils`, `validateConsent`, `enforceConsent`
    - `firebaseTeamPlanHelpers`, `useArchitectPlayerData`
    - `validationCacheService`, `engineUtils`, `tradeDebug`, `validationPerformanceMonitor`
    - `mutationPipeline`, `seasonManager`, `runOffseason`
    - zero-import holdouts such as `validationCacheManager`, `resolveValidationEntitlements`, `enforcementValidation`, `cashUtils`, `rosterUtils`, `salaryUtils`, and `temp_mutation_code`
  - targeted `sed -n` reads of the candidate files and the zero-import exclusions
  - `wc -l` size comparisons for:
    - `consentUtils.js` (`112`)
    - `firebaseTeamPlanHelpers.js` (`275`)
    - validator runtime-support included files (`491` total)
    - `mutationPipeline.js` + `seasonManager.js` + `runOffseason.js` (`6357` total)
    - wrapper-batch files (`useArchitectPlayerData.js`, `runOffseason.js`, `seasonUtils.js`, `architectCore.js`, `salaryUtils.js`) (`227` total)
    - Trade Machine TSX component batch (`20` files, `6059` total LOC)
- What the inspection proved:
  - `consentUtils.js` is still runtime-live and not yet reduced to a shim or barrel.
  - `firebaseTeamPlanHelpers.js` remains the main one-file alternative, but its mixed hydration plus free-agent responsibilities make it less coherent.
  - The remaining validator-support cluster is fragmented across mixed cache/debug/monitoring surfaces, not one clean business-logic arc.
  - The season/pipeline family is too large and coupled for the next recommended slice.
  - The larger batched low-risk alternatives are not cleaner than the consent helper boundary:
    - the wrapper batch is mostly deprecated or thin facade cleanup
    - the Trade Machine TSX batch is UI-heavy, broad, and no longer low-risk by scope size
  - Zero-import holdouts were explicitly classified before exclusion:
    - `useCapSheetState.js`: inactive legacy hook with substantial local-state business logic, but no live repo importers
    - `freeAgentLogic.js`: inactive legacy helper with no live importer evidence
    - `validationCacheManager.js`: support residue, index-only cache infrastructure
    - `resolveValidationEntitlements.js`: zero-import wrapper over TS entitlement resolution
    - `enforcementValidation.js`: zero-import legacy consolidated rule residue
    - `cashUtils.js`: inactive small utility with no live importer evidence
    - `rosterUtils.js`: inactive small utility with no live importer evidence
    - `salaryUtils.js`: wrapper-only SSOT facade over TS-owned cap totals logic
    - `temp_mutation_code.js`: scratch residue, unimported and not wired into live runtime flow
- Required validation commands run:
  - `npm run typecheck`
    - Result: PASS.
  - `npm run validate:project`
    - Result: PASS.
- Commands intentionally skipped:
  - broader `npm run test:* -- --reporter=dot` suites
  - Reason: static inspection resolved the scope ranking cleanly and did not leave a runtime ambiguity that required broader test proof.

## 7. Complexity / Risk Assessment
- Relative size versus the just-closed E75/E77/E78 work:
  - The recommended next arc is materially smaller.
  - `consentUtils.js` is a single `112` LOC JS business-logic file, while the just-closed E75/E77/E78 work covered multiple files and a much larger stateful boundary.
- Likely execution shape:
  - This looks like a one-file grouped mini-arc, not another split chain.
  - The current repo state does not support a larger batched low-risk pass that is cleaner than this boundary.
- Larger-batch answer:
  - A mixed wrapper batch is possible later, but it would be lower-value cleanup rather than the next best business-logic slice.
  - A Trade Machine TSX component batch is not safer: it spans `20` JSX files and `6059` LOC, with UI coupling centered on `TradeEditor.jsx`, `TradeTeamCard.jsx`, and `TradePlayerRow.jsx`.
- Key risks / caveats:
  - message-text parity must remain exact, including `Player NTC — consent required`
  - consent alias coverage must remain stable across `consentGranted`, `consent`, `consents.*`, `hasConsented`, and `hasTradeConsent`
  - Bird-veto and limited-NTC semantics must not drift
  - explicit `.js` import compatibility must be preserved because current TS consumers import `consentUtils.js` directly

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E79 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new E79 entry records that:
  - E39 remains closed
  - E41 remains complete
  - the E43/E44 `tradeContext` mini-arc remains complete
  - the E46 trade-facing helper foundation remains complete
  - the E48 `capTotals` mini-arc remains complete
  - the E50 `persistenceContracts` arc remains complete
  - the E52 season-transition helper arc remains complete
  - the E54 exception-history mini-arc remains complete
  - the E56/E57 `playerRulesProfile` arc remains complete
  - the E59 contract/season helper arc remains complete
  - the E61/E62 non-trade cap-legality arc remains complete
  - the E64 world-aware loader mini-arc remains complete
  - the E66/E67 entitlement presentation arc remains complete
  - the E69 Trade Machine validation snapshot/accessor arc remains complete
  - the E71 Architect contract/cap hook arc remains complete
  - the E73 world-lifecycle arc remains complete
  - the E75 trade-execution helper arc remains complete
  - the E77 helper-trio sub-arc remains complete
  - the E78 `useTradeMachine` hook arc remains complete
  - the recommended next migration scope is `src/features/architect/utils/consentUtils.js`
  - the estimated live JS business-logic count for that scope is `1`
  - the next arc should likely be handled as one grouped mini-arc rather than split or widened into a larger batched low-risk pass
  - the non-widening hard rule locks the boundary against silently pulling in `validateConsent.ts`, `enforceConsent.ts`, `tradeValidator.ts`, `enforcement.js`, or `enforcementValidation.js`
