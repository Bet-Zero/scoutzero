# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E92 — EXECUTION RETURN PACKAGE

## 1. Summary
- Execution-time repo inspection re-ran the two-lane decision rule after the E91 Free Agency offer-sheet closeout and confirmed the `Offseason preview surface` as the strongest remaining `batched low-risk` candidate.
- The recommended next move is a `batched low-risk pass`, not a `high-risk surgical` move.
- Estimated live JS/JSX/TSX business-logic count for the recommended scope: `2` core files.
- It still looks worth doing next. The DEV-gated nature lowers product value, but current repo evidence still favors the smaller, cleaner, materially safer 2-file batch over promoting `src/features/architect/utils/seasonManager.js` into the next migration move.

## 2. Closed Scope Confirmation
- This audit treated E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, E82, E84, E86, E88, E89, and E91 as closed or complete.
- The audit avoided silently reopening them by re-checking adjacent holdouts and classifying them as same-path TS-backed shims, wrappers, barrels, shells, helper adapters, dangerous hubs, or zero-import residue instead of folding them back into live migration scope.
- Closed-scope adjacency explicitly re-checked and excluded includes:
  - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
  - `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
  - `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
  - `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
  - `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`
  - `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
  - `src/features/architect/utils/tradeContext/index.js`
  - `src/features/architect/utils/persistenceContracts/index.js`
  - `src/features/architect/utils/capTotals/index.js`
  - `src/features/architect/utils/playerRulesProfile/index.js`
- No current repo evidence required reopening any prior closed arc.

## 3. Candidate Next Scopes

### Frontier Inventory Snapshot
- `live business logic`
  - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
  - `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
  - `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
  - `src/features/architect/shared/LeagueView/LeagueView.jsx`
  - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
  - `src/features/architect/contract/ContractEditor/ContractEditor.jsx`
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
- `TS-backed shim`
  - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
  - `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
  - `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
  - `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
  - `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`
  - `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
  - `src/features/architect/hooks/useCapValidation.js`
  - `src/features/architect/hooks/usePlayerRulesProfiles.js`
  - `src/features/architect/hooks/useTradeMachine.js`
  - `src/features/architect/hooks/useTradeMachineSnapshot.js`
- `barrel/public entrypoint`
  - `src/features/architect/GMDashboard/components/index.js`
  - `src/features/architect/GMDashboard/index.jsx`
  - `src/features/architect/utils/tradeMachine/index.js`
  - `src/features/architect/utils/tradeMachine/cache/index.js`
  - `src/features/architect/utils/tradeMachine/engine/index.js`
  - `src/features/architect/utils/tradeMachine/rules/index.js`
  - `src/features/architect/utils/tradeMachine/validators/index.js`
  - `src/features/architect/utils/tradeMachine/utils/index.js`
- `thin wrapper/deprecated wrapper`
  - `src/features/architect/OffseasonTab.jsx`
  - `src/features/architect/ValidationWarnings.jsx`
  - `src/features/architect/LeagueView.jsx`
  - `src/features/architect/RosterVisual.jsx`
  - `src/features/architect/FreeAgentPool.jsx`
  - `src/features/architect/utils/runOffseason.js`
  - `src/features/architect/GMDashboard/sections/RosterSection.jsx`
  - `src/features/architect/GMDashboard/sections/TradeSection.jsx`
  - `src/features/architect/GMDashboard/sections/HistorySection.jsx`
  - `src/features/architect/GMDashboard/sections/CapTableSection.jsx`
- `debug/support/monitoring`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.debug.js`
  - `src/features/architect/utils/tradeMachine/engine/performanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js`
- `dead/scratch/zero-import residue`
  - `src/features/architect/hooks/useCapSheetState.js`
  - `src/features/architect/utils/architectCore.js`
  - `src/features/architect/utils/cashUtils.js`
  - `src/features/architect/utils/freeAgentLogic.js`
  - `src/features/architect/utils/temp_mutation_code.js`
  - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
  - `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
- `low-risk presentational component`
  - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
  - `src/features/architect/contract/ContractEditorModal/ContractEditorModal.jsx`
  - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
- `high-risk state/orchestration hub`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`

### Candidate 1 — Offseason Preview Surface
- Scope name: `Offseason preview surface`
- Lane: `batched low-risk`
- Includes:
  - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
  - `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
- Excludes:
  - `src/features/architect/OffseasonTab.jsx`
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - `src/features/architect/utils/runOffseason.js`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - all Trade Machine hubs
- Estimated live JS/JSX/TSX business-logic file count: `2`
- Why it is a serious candidate:
  - It is the cleanest remaining low-risk feature pair after E91: `OffseasonSection.jsx` imports the top-level Offseason wrapper, which reaches `OffseasonTab.jsx`, which in turn owns `OptionManager.jsx`.
  - The two core files are small (`121` + `154` lines) and the boundary stayed intact under execution-time inspection.
  - `runOffseason.js` is a small adjacent helper adapter (`50` lines) that delegates into `resolveOffseasonTransition.ts`; current evidence did not prove it must be pulled into the same migration slice.
  - Dedicated guardrail coverage already exists for the DEV/localStorage gating.
- Why it is not perfect:
  - The preview is DEV-gated and non-persisting, so its product/runtime value is lower than a live world-persistence hub.
  - If a future execution pass finds that TS migration cannot stand without widening into `runOffseason.js` or `OffseasonSection.jsx`, that blocker should be documented explicitly instead of auto-expanding the scope.

### Candidate 2 — Season Manager Surgical Core
- Scope name: `seasonManager.js`
- Lane: `high-risk surgical`
- Includes:
  - `src/features/architect/utils/seasonManager.js`
- Excludes:
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
- Estimated live JS/JSX/TSX business-logic file count: `1`
- Why it is a serious candidate:
  - It remains the strongest remaining surgical alternative.
  - It is `1718` lines and directly owns season advancement, world persistence, entitlement/DARE work, TPE lifecycle handling, and post-state cap validation.
  - It has broader importer and test reach than any remaining single-file candidate.
- Why it is not the best next move:
  - It is still materially more behavior-sensitive than the strongest remaining batch candidate.
  - The audit did not find evidence that batching has been exhausted strongly enough to force this file next.

### Candidate 3 — Mutation Pipeline Surgical Core
- Scope name: `mutationPipeline.js`
- Lane: `high-risk surgical`
- Includes:
  - `src/features/architect/utils/mutationPipeline.js`
- Excludes:
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
- Estimated live JS/JSX/TSX business-logic file count: `1`
- Why it is a serious candidate:
  - It is the largest remaining dangerous hub at `4589` lines.
  - It is the central Architect world mutation/persistence layer and is imported by a large spread of tests and hooks.
- Why it is not the best next move:
  - It is even riskier and less surgically isolated than `seasonManager.js`.
  - Current repo evidence points to keeping it on the dangerous-hub shortlist rather than promoting it over a cleaner batch.

### Candidate 4 — Shared Support Display Batch
- Scope name: `shared support display batch`
- Lane: `batched low-risk`
- Includes:
  - `src/features/architect/shared/LeagueView/LeagueView.jsx`
  - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
  - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
- Excludes:
  - `src/features/architect/LeagueView.jsx`
  - `src/features/architect/RosterVisual.jsx`
  - `src/features/architect/ValidationWarnings.jsx`
  - `src/features/architect/GMDashboard/sections/RosterSection.jsx`
- Estimated live JS/JSX/TSX business-logic file count: `3`
- Why it is not a good next move:
  - The files are live, but they do not form a single feature boundary.
  - `LeagueView` loads team data, `RosterVisual` derives roster display state, and `ValidationWarnings` is mostly presentational. Together they read as cleanup, not a coherent migration arc.

### Candidate 5 — Legacy ContractEditor Pair
- Scope name: `ContractEditor pair`
- Lane: `batched low-risk`
- Includes:
  - `src/features/architect/contract/ContractEditor/ContractEditor.jsx`
  - `src/features/architect/contract/ContractEditorModal/ContractEditorModal.jsx`
- Excludes:
  - `src/shared/components/EditContractModal.jsx`
  - `src/features/architect/contract/index.ts`
- Estimated live JS/JSX/TSX business-logic file count: `2`
- Why it is not a good next move:
  - The pair is compact, but current repo evidence shows the main live contract-action path now runs through `src/shared/components/EditContractModal.jsx`, not this legacy pair.
  - `ContractEditorModal.jsx` is mostly a shell, and the pair is materially weaker than the Offseason batch on current frontier relevance.

## 4. Recommended Next Scope
- Recommended next migration scope: `Offseason preview surface`
- Lane: `batched low-risk`
- Why it is the best next choice:
  - Execution-time repo evidence re-ran the two-lane rule instead of locking the answer in advance and still found the Offseason pair cleaner than the strongest surgical alternative.
  - The leading 2-file boundary remained intact under inspection: no current evidence proved it must widen into `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`, `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`, `src/features/architect/utils/seasonManager.js`, `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/GMDashboard/GMDashboard.jsx`, or any Trade Machine hub.
  - It beats the strongest remaining Lane B alternatives because it is a coherent feature pair rather than a mixed support grab-bag or a weakly connected legacy contract surface.
  - The DEV-gated nature lowers its value, but not enough to lose to `seasonManager.js`. Right now the smarter migration slice is still the materially safer, cleaner 2-file batch rather than promoting a `1718`-line season/world persistence hub.
- Recommended execution shape: `one grouped arc`
- Boundary rule:
  - If a future execution pass finds that this 2-file boundary cannot stand on its own, it should document the exact blocker instead of silently widening into the offseason shell, world/season orchestration, or Trade Machine hubs.

## 5. Live JS/JSX/TSX Business-Logic Inventory For Recommended Scope

### Core live business-logic files in the recommended Offseason batch (`counted`)
- `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
  - Why it belongs in scope: authoritative JS coordinator for the single-team offseason preview flow; owns decision-confirmation state, preview advance action wiring, error handling, and the user-facing preview messaging.
  - Central or peripheral: `central`
- `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
  - Why it belongs in scope: direct JS decision surface for collecting option decisions from the current cap sheet and passing the normalized playerId-keyed payload back to `OffseasonTab`.
  - Central or peripheral: `peripheral`

### Wrappers / shells / dangerous hubs excluded from the live count (`not counted`)
- `src/features/architect/OffseasonTab.jsx`
  - Why excluded: pure top-level compatibility re-export stub.
- `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - Why excluded: state/orchestration shell that bridges world metadata loading, draft positions UI, season-advance modal flow, and the DEV/localStorage gate for the preview.
- `src/features/architect/utils/runOffseason.js`
  - Why excluded: small helper adapter around `resolveOffseasonTransition.ts`; adjacent, but current execution evidence did not force widening the Offseason batch to include it.
- `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - Why excluded: dangerous season/world orchestration hub tied directly to `seasonManager.js`.
- `src/features/architect/utils/seasonManager.js`
  - Why excluded: primary high-risk surgical alternative, not part of the clean 2-file batch.
- `src/features/architect/utils/mutationPipeline.js`
  - Why excluded: central world mutation/persistence hub with a much larger blast radius than the recommended batch.
- `src/features/architect/GMDashboard/GMDashboard.jsx`
  - Why excluded: central dashboard hub rather than a clean next-scope batch.
- `src/features/architect/tradeMachine/TradeEditor.jsx`
  - Why excluded: central Trade Machine UI hub.
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - Why excluded: large Trade Machine team-state hub.
- `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
  - Why excluded: large validation/orchestration hub.

## 6. Validation / Inspection Run
- `rg --files src/features/architect | rg '\\.(js|jsx)$' | sort`
  - Proved the remaining post-E91 JS/JSX frontier and kept the inventory grounded in the current repo rather than prior assumptions.
- Importer scans used to prove current coupling and boundary cleanliness:
  - `rg -n "@/features/architect/offseason/OffseasonTab|@/features/architect/OffseasonTab|from './OptionManager'|from '../ContractEditor'|@/features/architect/shared/ValidationWarnings|@/features/architect/ValidationWarnings|@/features/architect/shared/LeagueView|@/features/architect/LeagueView|@/features/architect/shared/RosterVisual|@/features/architect/RosterVisual|@/features/architect/contract/ContractEditorModal|@/features/architect/contract/ContractEditor" src tests`
  - `rg -n "@/features/architect/utils/seasonManager|from '@/features/architect/utils/seasonManager'|from '@/features/architect/utils/seasonManager.js'" src tests`
  - `rg -n "@/features/architect/utils/mutationPipeline|from '@/features/architect/utils/mutationPipeline'|from '@/features/architect/utils/mutationPipeline.js'" src tests`
  - `rg -n "@/features/architect/utils/runOffseason|from '@/features/architect/utils/runOffseason'|from '@/features/architect/utils/runOffseason.js'" src tests`
  - These proved:
    - the Offseason pair has a clean importer chain through `OffseasonSection`
    - `seasonManager.js` and `mutationPipeline.js` remain broad-risk hubs
    - the legacy contract-editor pair is weakly connected
- Classification/source inspection steps:
  - `sed -n` reads over `OffseasonTab.jsx`, `OptionManager.jsx`, `OffseasonSection.jsx`, `runOffseason.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `shared/LeagueView/LeagueView.jsx`, `shared/RosterVisual/RosterVisual.jsx`, `shared/ValidationWarnings/ValidationWarnings.jsx`, `ContractEditor.jsx`, `ContractEditorModal.jsx`, `architectCore.js`, `useCapSheetState.js`, `freeAgentLogic.js`, and `cashUtils.js`
  - Proved which files are live business logic versus wrappers, shells, or zero-import residue.
- Size comparison steps:
  - `wc -l src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx src/features/architect/offseason/OffseasonTab/OptionManager.jsx src/features/architect/GMDashboard/sections/OffseasonSection.jsx src/features/architect/utils/runOffseason.js src/features/architect/utils/seasonManager.js`
  - `wc -l src/features/architect/utils/seasonManager.js src/features/architect/utils/mutationPipeline.js src/features/architect/GMDashboard/GMDashboard.jsx src/features/architect/GMDashboard/components/WorldSelector.jsx src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx src/features/architect/tradeMachine/TradeEditor.jsx src/features/architect/tradeMachine/TradeTeamCard.jsx src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
  - Proved the recommended pair is still much smaller than the surgical alternatives and adjacent hubs.
- Validation commands:
  - `npm run typecheck`
    - Result: PASS
  - `npm run validate:project`
    - Result: PASS
- Commands intentionally skipped:
  - `npm run test:diff` was skipped because this pass changed only audit documentation and scope selection, not product code.
  - Broader suites such as `npm run test:architect`, `npm run test:trade`, and `npm run test:fast` were skipped because no runtime code changed and no scope-selection uncertainty required them.
  - `npm run test:full` was skipped because the prompt did not include `RUN FULL SUITE`.

## 7. Complexity / Risk Assessment
- Likely size relative to the just-closed E88/E89 and E91 work:
  - smaller than the E88/E89 Cap Sheet family work
  - roughly similar to, or slightly smaller than, the E91 offer-sheet work in raw file count and size
- Likely execution shape:
  - still looks like `another grouped migration arc`, not something that needs immediate sub-slicing
- Whether batching still wins by default:
  - yes. The remaining frontier still supports `batched low-risk` work by default, with surgical treatment reserved for the short dangerous-hub list led by `seasonManager.js`, `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, and `ValidationDetailsPanel.jsx`
- Key risks and caveats:
  - the Offseason preview surface is DEV-gated and non-persisting, so it is less valuable than a live production persistence hub
  - accidental widening into `OffseasonSection.jsx`, `runOffseason.js`, or the season/world orchestration layer would erase the main safety advantage of the recommended batch
  - if future execution reveals type-boundary friction between the 2-file pair and excluded adjacent files, that blocker should be documented rather than worked around by silent scope creep
- Bottom-line comparison:
  - the DEV gate lowers value, but it does not currently lower value enough to make `seasonManager.js` the smarter next move. The safer, cleaner 2-file batch still wins the two-lane comparison today.

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E92 (2026-03-14)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The E92 entry states that:
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
  - the E80 consent helper arc remains complete
  - the E82 world/data-access helper arc remains complete
  - the E84 Team History surface arc remains complete
  - the E86 Free Agent Pool surface arc remains complete
  - the E88 Cap Sheet display-core sub-arc remains complete
  - the E89 Cap Sheet modal-pair sub-arc remains complete
  - the E91 Free Agency offer-sheet surface arc remains complete
  - the recommended next migration scope is the `Offseason preview surface`
  - the recommended next move is `batched low-risk`
  - the estimated live JS/JSX business-logic count for that scope is `2`
  - the next move should likely stay `one grouped arc`
  - the remaining frontier still supports batching by default except for the short dangerous-hub list
