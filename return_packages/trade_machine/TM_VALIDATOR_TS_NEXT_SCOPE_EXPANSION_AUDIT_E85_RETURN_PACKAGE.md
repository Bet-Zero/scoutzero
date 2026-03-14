# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E85 — EXECUTION RETURN PACKAGE

## 1. Summary
- Execution-time repo inspection re-ran the two-lane decision rule after the E84 Team History closeout and confirmed the `Free Agent Pool surface` as the strongest next TypeScript migration scope.
- The recommended next move is a `batched low-risk pass`, not a `high-risk surgical` move.
- Estimated live JS/JSX/TSX business-logic count for the recommended scope: `3` core files.
- It looks worth doing next because it is a coherent directory-level feature family with a clean cutoff, partially TS-backed neighbors, and materially lower behavior risk than the strongest remaining surgical alternative.

## 2. Closed Scope Confirmation
- This audit treated E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, E82, and E84 as closed or complete.
- The audit avoided silently reopening those scopes by re-checking nearby holdouts and classifying them as wrappers, TS-backed shims, barrels, support/debug files, low-value residue, or separate adjacent feature surfaces instead of folding them back into live migration scope.
- Closed-scope adjacency that was explicitly re-checked and excluded includes `src/features/architect/utils/tradeContext/index.js`, `src/features/architect/utils/persistenceContracts/index.js`, `src/features/architect/utils/capTotals/index.js`, `src/features/architect/utils/playerRulesProfile/index.js`, `src/features/architect/utils/exceptions/index.js`, `src/features/architect/utils/tradeMachine/rules/index.js`, `src/features/architect/utils/tradeMachine/validators/index.js`, and `src/features/architect/utils/tradeMachine/utils/index.js`.
- No current repo evidence required reopening any prior closed arc.

## 3. Candidate Next Scopes

### Frontier Inventory Snapshot
- `live business logic`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
  - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
  - `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
  - `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
  - `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
  - `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`
  - `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
- `TS-backed shim`
  - `src/features/architect/utils/seasonUtils.js` delegates to `seasonFormat.js`
  - `src/features/architect/utils/salaryUtils.js` is a documented SSOT wrapper over `computeTeamCapTotals`
  - `src/features/architect/utils/runOffseason.js` delegates to TS-backed offseason logic
  - `src/features/architect/hooks/useArchitectPlayerData.js` delegates to `subscribeArchitectPlayerData.ts`
- `barrel / public entrypoint`
  - `src/features/architect/utils/tradeMachine/cache/index.js`
  - `src/features/architect/utils/tradeMachine/engine/index.js`
  - `src/features/architect/utils/tradeContext/index.js`
  - `src/features/architect/utils/persistenceContracts/index.js`
  - `src/features/architect/utils/capTotals/index.js`
  - `src/features/architect/utils/playerRulesProfile/index.js`
  - `src/features/architect/utils/exceptions/index.js`
  - `src/features/architect/utils/tradeMachine/rules/index.js`
  - `src/features/architect/utils/tradeMachine/validators/index.js`
  - `src/features/architect/utils/tradeMachine/utils/index.js`
- `thin wrapper / compatibility surface`
  - `src/features/architect/FreeAgentPool.jsx`
  - `src/features/architect/OffseasonTab.jsx`
  - `src/features/architect/CapSheet.jsx`
  - `src/features/architect/CapSheetFull.jsx`
  - `src/features/architect/ValidationWarnings.jsx`
  - `src/features/architect/LeagueView.jsx`
  - `src/features/architect/RosterVisual.jsx`
- `debug / support / monitoring`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.debug.js`
  - `src/features/architect/utils/tradeMachine/engine/performanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js`
- `dead / scratch / zero-import residue`
  - `src/features/architect/hooks/useCapSheetState.js` — inactive legacy hook with no current importer evidence
  - `src/features/architect/utils/architectCore.js` — stale aggregator barrel with no current importer evidence
  - `src/features/architect/utils/cashUtils.js` — isolated legacy helper with no current importer evidence
  - `src/features/architect/utils/freeAgentLogic.js` — isolated legacy signing helper with no current importer evidence
  - `src/features/architect/utils/playerRulesProfile/types.js` — JSDoc type-doc residue only, no runtime importer evidence
  - `src/features/architect/utils/temp_mutation_code.js` — scratch/orphan residue
  - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js` — unwired support module with no current importer evidence
  - `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js` — unwired support module with no current importer evidence
  - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js` — unwired support module with no current importer evidence
- `low-risk presentational component`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
  - `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
  - `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
- `high-risk state / orchestration hub`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`

### Candidate 1 — Free Agent Pool Surface
- Scope name: `Free Agent Pool surface`
- Lane: `batched low-risk`
- Includes:
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
- Excludes:
  - thin wrapper `src/features/architect/FreeAgentPool.jsx`
  - typed siblings `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPoolHeader.tsx`, `src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx`, and `src/features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx`
  - adjacent feature files `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx` and `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
  - dangerous hubs `src/features/architect/GMDashboard/GMDashboard.jsx`, `src/features/architect/GMDashboard/components/WorldSelector.jsx`, `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`, `src/features/architect/tradeMachine/TradeEditor.jsx`, `src/features/architect/tradeMachine/TradeTeamCard.jsx`, `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`, `src/features/architect/utils/seasonManager.js`, and `src/features/architect/utils/mutationPipeline.js`
- Estimated live JS/JSX/TSX business-logic file count: `3`
- Why it is a good next move:
  - It is a coherent single-feature directory with one stateful coordinator plus two presentational support components.
  - Typed siblings already exist, so the remaining JSX holdouts are concentrated and easy to count cleanly.
  - Importer evidence did not force widening into dashboard scaffolding or the offer-sheet surface.

### Candidate 2 — Season Manager Surgical Core
- Scope name: `seasonManager.js`
- Lane: `high-risk surgical`
- Includes:
  - `src/features/architect/utils/seasonManager.js`
- Excludes:
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - all Trade Machine UI hubs
- Estimated live JS/JSX/TSX business-logic file count: `1`
- Why it is a serious candidate:
  - It remains the strongest surgical alternative because it owns season advancement, Firestore batch writes, entitlement resolution, TPE lifecycle work, and post-state cap legality validation.
  - Repo evidence shows broad caller and guardrail attention through `SeasonAdvanceModal.jsx`, dynamic imports, and a large body of dedicated tests.
- Why it is not the best next move:
  - The runtime risk is substantially higher than the leading low-risk batch.
  - It is exactly the kind of dangerous hub that should stay on the short surgical list rather than displacing a cleaner grouped UI batch.

### Candidate 3 — Cap Sheet Surface
- Scope name: `Cap Sheet surface`
- Lane: `batched low-risk`
- Includes:
  - `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
  - `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
  - `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`
  - `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
- Excludes:
  - top-level wrappers `src/features/architect/CapSheet.jsx`, `src/features/architect/CapSummaryTiles.jsx`, `src/features/architect/CapSheetFull.jsx`, and `src/features/architect/ExceptionTracker.jsx`
  - dashboard section wrappers `src/features/architect/GMDashboard/sections/CapSheetSection.jsx` and `src/features/architect/GMDashboard/sections/CapTableSection.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
- Estimated live JS/JSX/TSX business-logic file count: `6`
- Why it is a serious candidate:
  - The files form a coherent cap-sheet family and remain heavily exercised.
- Why it is not the best next move:
  - It is materially larger than E84 and clearly broader than the `Free Agent Pool` batch.
  - It includes manual mutation modal flows, which makes it less safe than the leading low-risk alternative.

### Candidate 4 — OffseasonTab Surface
- Scope name: `OffseasonTab surface`
- Lane: `batched low-risk`
- Includes:
  - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
  - `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
- Excludes:
  - thin wrapper `src/features/architect/OffseasonTab.jsx`
  - adjacent dashboard section `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - thin delegation helper `src/features/architect/utils/runOffseason.js`
- Estimated live JS/JSX/TSX business-logic file count: `2`
- Why it is a serious candidate:
  - It is compact and cleanly bounded.
- Why it is not the best next move:
  - The surface is DEV-gated preview UI, so current runtime value is lower than `Free Agent Pool`.
  - It is smaller, but not a better migration win.

### Candidate 5 — Shared Support Display Batch
- Scope name: `shared support display batch`
- Lane: `batched low-risk`
- Includes:
  - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
  - `src/features/architect/shared/LeagueView/LeagueView.jsx`
  - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
- Excludes:
  - top-level wrappers `src/features/architect/ValidationWarnings.jsx`, `src/features/architect/LeagueView.jsx`, and `src/features/architect/RosterVisual.jsx`
- Estimated live JS/JSX/TSX business-logic file count: `3`
- Why it is not a good next move:
  - It is a smaller wrapper/support batch with real runtime relevance, but it is an awkward grab-bag of unrelated surfaces rather than a coherent feature arc.
  - It is weaker than the `Free Agent Pool surface`, so the strongest remaining low-risk batch after E84 is still another coherent feature surface, not support cleanup.

## 4. Recommended Next Scope
- Recommended next migration scope: `Free Agent Pool surface`
- Lane: `batched low-risk`
- Why it is the best next choice:
  - The audit did not lock this recommendation in advance; it re-ran the two-lane comparison from current repo evidence and confirmed that `Free Agent Pool` still beats the best surgical alternative.
  - It is a cleaner and safer boundary than `seasonManager.js`, which remains the strongest surgical candidate but still owns world writes, season advancement, entitlement resolution, and post-state legality enforcement.
  - It also beats the strongest alternative low-risk candidates: `Cap Sheet surface` is larger and more mutation-enabled, `OffseasonTab surface` is lower-value preview UI, and the remaining support-batch option is less coherent.
- Recommended execution shape: `one grouped batched pass`
- Boundary rule:
  - Execution-time evidence did not require widening this recommendation into `FreeAgencySection.jsx`, `OfferSheetList.jsx`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `ValidationDetailsPanel.jsx`, `seasonManager.js`, or `mutationPipeline.js`.
  - If a future execution pass finds that `Free Agent Pool` cannot stand on its own, it should document the exact blocker instead of auto-expanding the scope.

## 5. Live JS/JSX/TSX Business-Logic Inventory For Recommended Scope

### Core live business-logic files in the recommended batch (`counted`)
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
  - Why it belongs in scope: primary `Free Agent Pool` coordinator; owns filter state usage, player selection state, contract modal wiring, and sign/sign-and-trade callback assembly.
  - Central or peripheral: `central`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`
  - Why it belongs in scope: row-level interaction surface for selection, contextual menu actions, and player-profile navigation.
  - Central or peripheral: `peripheral`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
  - Why it belongs in scope: selected-player card renderer that wires removal and sign actions into the same feature surface.
  - Central or peripheral: `peripheral`

### Thin wrapper / typed-sibling / adjacent-feature files excluded from the live count (`not counted`)
- `src/features/architect/FreeAgentPool.jsx`
  - Why excluded: pure compatibility wrapper over the `freeAgency/FreeAgentPool` folder.
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPoolHeader.tsx`
  - Why excluded: already TS-backed typed sibling.
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx`
  - Why excluded: already TS-backed typed sibling.
- `src/features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx`
  - Why excluded: already TS-backed typed sibling.
- `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
  - Why excluded: adjacent dashboard section wrapper, not part of the clean `Free Agent Pool` boundary.
- `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
  - Why excluded: adjacent offer-sheet support surface with separate dashboard responsibilities.

## 6. Validation / Inspection Run
- Inspection commands and steps used:
  - `git status --short`
  - `rg --files src/features/architect | rg '\\.(js|jsx|ts|tsx)$'`
  - node-based inventory scripts to count paired vs unpaired JS/JSX files and group remaining holdouts by directory
  - `rg -n "FreeAgentPool|FreeAgentRow|FreeAgentCard" src/features/architect src/tests`
  - `rg -n "OffseasonTab|OptionManager|runOffseason" src/features/architect src/tests`
  - `rg -n "CapSheetFull|CapSheet|CapSummaryTiles|ExceptionTracker|ManageExceptionsModal|ManageDeadMoneyModal" src/features/architect src/tests`
  - `rg -n "seasonManager|advanceSeason|processSeasonTransition" src/features/architect src/tests`
  - `rg -n "mutationPipeline|persistWorldMutation|sanitizeTransientFieldsForPersistence" src/features/architect src/tests`
  - targeted `sed -n` reads of the leading low-risk candidates, the surgical hubs, adjacent dashboard/trade files, and the zero-import / weak-import residue files named above
  - `wc -l` over the candidate files used for size comparison
- What the inspection proved:
  - `Free Agent Pool` remains a clean `3`-file core boundary with its wrapper, typed siblings, and adjacent dashboard files explicitly excluded from the live count.
  - `seasonManager.js` remains the strongest `high-risk surgical` alternative, but it is still riskier than the best low-risk batch.
  - `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, and `ValidationDetailsPanel.jsx` remain the short dangerous-hub list rather than clean batch candidates.
  - `Cap Sheet surface` and `OffseasonTab surface` are coherent low-risk families, but they do not beat `Free Agent Pool` on current size/safety/value tradeoff.
  - The strongest smaller wrapper/support option is weaker than `Free Agent Pool`, so the remaining frontier still has at least one better coherent feature batch before the next surgical move.
- Required validation commands run:
  - `npm run typecheck`
    - Result: PASS.
  - `npm run validate:project`
    - Result: PASS.
- Commands intentionally skipped:
  - broader `npm run test:* -- --reporter=dot` suites
  - Reason: this was an audit-only pass, and the scope decision was resolved through static frontier plus importer evidence rather than a runtime ambiguity that required broader tests.

## 7. Complexity / Risk Assessment
- Relative size versus the just-closed E84 Team History batch:
  - The recommended `Free Agent Pool` move looks `smaller` than E84.
  - Current counted size read: `3` core JSX files and roughly `567` lines versus E84’s `5` core files and roughly `1012` lines.
- Likely execution shape:
  - Best handled as `one grouped batched pass`, not split into sub-arcs.
- Batching-default answer:
  - Yes. The repo should continue with `batched low-risk work by default`, with surgical treatment reserved for the short dangerous-hub list.
  - The strongest remaining low-risk batch after E84 is still `another coherent feature surface`, not a smaller wrapper/support batch, and it is not yet weaker than the strongest dangerous hub.
- Key risks / caveats:
  - keep the `3`-file live count explicit and separate from wrappers, typed siblings, and adjacent feature files
  - preserve the existing contract payload assembly and callback wiring in `FreeAgentPool.jsx`
  - preserve menu / click-outside behavior in `FreeAgentRow.jsx`
  - preserve selected-card prop compatibility with the already-typed `SelectedFreeAgentCards.tsx`
  - do not widen into dashboard or orchestration hubs unless a future execution pass documents a concrete blocker

## 8. Master Doc Update
- Updated `docs/architect/TRADE_MACHINE_MASTER.md` `Last updated` from `2026-03-13` to `2026-03-14`.
- Added `### Validator TS Next-Scope Expansion Audit E85 (2026-03-14)` immediately after the E84 entry.
- The new E85 entry records that:
  - E39 remains closed
  - E41 remains complete
  - the E43/E44 `tradeContext` mini-arc remains complete
  - the E46 helper-foundation arc remains complete
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
  - the E80 consent helper arc remains complete
  - the E82 world/data-access helper arc remains complete
  - the E84 Team History surface arc remains complete
  - execution-time repo evidence re-ran the two-lane rule rather than locking the recommendation in advance
  - the recommended next migration scope is `Free Agent Pool surface`
  - that next move is `batched low-risk`
  - the estimated live JS/JSX business-logic count for that scope is `3`
  - the next move should likely be handled as `one grouped batched pass`
  - batching still wins by default except for the short dangerous-hub list led by `seasonManager.js`, `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, and `ValidationDetailsPanel.jsx`
