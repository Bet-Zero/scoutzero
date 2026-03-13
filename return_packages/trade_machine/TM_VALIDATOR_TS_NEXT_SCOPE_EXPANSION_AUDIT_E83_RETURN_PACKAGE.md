# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E83 — EXECUTION RETURN PACKAGE

## 1. Summary
- Execution-time repo inspection confirmed the `Team History surface` as the strongest next TypeScript migration scope after the E82 `firebaseTeamPlanHelpers` closeout.
- The recommended next move is a `batched low-risk pass`, not a high-risk surgical scope.
- Estimated live JS/JSX business-logic count for the recommended scope: `5` core files, with `4` thin wrapper compatibility files explicitly excluded from that live count.
- It looks worth doing next because it is a coherent, read-only, strongly exercised UI family with typed backing helpers, and it is materially safer than the strongest remaining surgical alternative.

## 2. Closed Scope Confirmation
- This audit treated the following prior scopes as closed or complete: E39 validator-adjacent Trade Machine scope, E41 draft-pick resolution scope, E43/E44 `tradeContext`, E46 trade-facing helper foundation, E48 `capTotals`, E50 `persistenceContracts`, E52 season-transition helpers, E54 exception-history helpers, E56/E57 `playerRulesProfile`, E59 contract/season helpers, E61/E62 non-trade cap-legality, E64 world-aware loader, E66/E67 entitlement presentation, E69 Trade Machine snapshot/accessors, E71 Architect contract/cap hooks, E73 world lifecycle, E75 trade-execution helpers, E77 helper-trio, E78 `useTradeMachine`, E80 `consentUtils`, and E82 `firebaseTeamPlanHelpers`.
- The audit avoided silently reopening those areas by re-checking nearby `.js` holdouts and classifying them as TS-backed shims, public barrels, constants/data/config, thin wrappers, support/debug surfaces, or unrelated presentational consumers rather than folding them back into live business-logic scope.
- The recommended Team History batch does **not** reopen E41 or E54. `src/features/architect/offseason/DraftPickTracker/DraftPickTracker.jsx` is a presentational history table, not the closed draft-pick resolution utility cluster, and `src/features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.jsx` is a presentational history consumer, not the closed `src/features/architect/utils/exceptionHistory/historyHelpers.js` boundary.
- No prior closed scope showed current repo evidence that required reopening in E83.

## 3. Candidate Next Scopes

### Candidate 1 — Team History Surface
- Scope name: `Team History surface`
- Lane: `batched low-risk`
- Includes:
  - `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`
  - `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.jsx`
  - `src/features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.jsx`
  - `src/features/architect/offseason/DraftPickTracker/DraftPickTracker.jsx`
  - `src/features/architect/offseason/WaiveStretchTracker/WaiveStretchTracker.jsx`
- Excludes:
  - thin wrappers `src/features/architect/TeamHistoryTab.jsx`, `src/features/architect/ExceptionHistoryTracker.jsx`, `src/features/architect/DraftPickTracker.jsx`, and `src/features/architect/WaiveStretchTracker.jsx` from the live-business-logic count
  - `src/features/architect/GMDashboard/sections/HistorySection.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
- Estimated live JS/JSX/TSX business-logic file count: `5`.
- Why it is a good next move:
  - The family is coherent even though it spans small subdirectories; every counted core file exists to render the Team History experience.
  - The surface is read-only UI/state, already backed by typed world-event plumbing through `useWorldTeamEvents.ts` and `normalizeWorldEventsForTeamHistory.ts`.
  - Execution-time importer evidence confirmed the batch can stand on its own without widening into dashboard/orchestration hubs.

### Candidate 2 — Season Manager Surgical Core
- Scope name: `seasonManager.js`
- Lane: `high-risk surgical`
- Includes:
  - `src/features/architect/utils/seasonManager.js`
- Excludes:
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - other world-lifecycle, dashboard, and trade UI consumers
- Estimated live JS/JSX/TSX business-logic file count: `1`.
- Why it is a serious candidate:
  - It remains the strongest surgical alternative by runtime importance: `1719` lines, `11` importer edges, Firestore batch writes, world metadata updates, TPE/exception lifecycle work, entitlement projection/DARE flow, and post-state cap validation.
- Why it is not the best next move:
  - It is materially more behavior-sensitive than the Team History batch.
  - It still leans on `mutationPipeline.js` for transient-field sanitization, so the clean one-file cutoff is real but still risk-heavy.
  - It is the right kind of file to keep on the short dangerous-hub list, not the best next batchable win.

### Candidate 3 — Free Agent Pool Surface
- Scope name: `Free Agent Pool surface`
- Lane: `batched low-risk`
- Includes:
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
- Excludes:
  - thin wrapper `src/features/architect/FreeAgentPool.jsx`
  - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
  - already-typed neighbors such as `SelectedFreeAgentCards.tsx`, `FreeAgencyFilterBar.tsx`, `FreeAgentPoolHeader.tsx`, and `useFreeAgencyFilterPersistence.ts`
- Estimated live JS/JSX/TSX business-logic file count: `3`.
- Why it is a serious candidate:
  - It is a clean directory-level batch with typed neighbors and limited inward coupling.
- Why it is not the best next move:
  - It carries more mutation wiring than Team History, including contract payload assembly and sign/sign-and-trade pathways.
  - It has narrower runtime/test reach than Team History and does not beat Team History on safety.

## 4. Recommended Next Scope
- Recommended next migration scope: `Team History surface`.
- Lane: `batched low-risk`.
- Why it is the best next choice:
  - Current execution-time repo evidence confirmed that it is a coherent family-level boundary with a clean cutoff and no forced widening into dashboard, trade UI, or orchestration hubs.
  - It is safer than the strongest surgical alternative `seasonManager.js`, which still owns Firestore writes, season advancement, entitlement resolution, and post-state legality flow.
  - It beats the strongest other low-risk batch (`Free Agent Pool surface`) because Team History is more read-only, more tightly bounded around one feature surface, and better supported by current importer/test evidence.
- Recommended execution shape: `one grouped batched pass`.
- Widening rule:
  - Do not silently widen this recommendation into `HistorySection.jsx`, `GMDashboard.jsx`, `SeasonAdvanceModal.jsx`, `WorldSelector.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `ValidationDetailsPanel.jsx`, `seasonManager.js`, or `mutationPipeline.js` unless a future execution pass proves the Team History surface cannot stand cleanly on its own.
  - If that happens, document the exact blocker instead of auto-expanding the scope.

## 5. Live JS/JSX/TSX Business-Logic Inventory For Recommended Scope

### Core live business-logic files in the recommended batch (`counted`)
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`
  - Why it belongs in scope: main Team History surface, owns timeline selection, world-event timeline mode, fixture gating, and composition of the subsection renderers.
  - Central or peripheral: `central`.
- `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.jsx`
  - Why it belongs in scope: the detail view for Team History entries, including event payload / totals rendering.
  - Central or peripheral: `peripheral`.
- `src/features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.jsx`
  - Why it belongs in scope: subsection renderer for exception and MLE history inside Team History.
  - Central or peripheral: `peripheral`.
- `src/features/architect/offseason/DraftPickTracker/DraftPickTracker.jsx`
  - Why it belongs in scope: subsection renderer for draft-pick log and current pick inventory inside Team History.
  - Central or peripheral: `peripheral`.
- `src/features/architect/offseason/WaiveStretchTracker/WaiveStretchTracker.jsx`
  - Why it belongs in scope: subsection renderer for waived/stretched contracts and dead-cap-by-year history inside Team History.
  - Central or peripheral: `peripheral`.

### Thin wrapper compatibility files excluded from the live count (`not counted`)
- `src/features/architect/TeamHistoryTab.jsx`
  - Why excluded: pure top-level compatibility re-export over `history/TeamHistoryTab/`.
- `src/features/architect/ExceptionHistoryTracker.jsx`
  - Why excluded: pure top-level compatibility re-export over `capSheet/ExceptionHistoryTracker/`.
- `src/features/architect/DraftPickTracker.jsx`
  - Why excluded: pure top-level compatibility re-export over `offseason/DraftPickTracker/`.
- `src/features/architect/WaiveStretchTracker.jsx`
  - Why excluded: pure top-level compatibility re-export over `offseason/WaiveStretchTracker/`.

## 6. Validation / Inspection Run
- Inspection commands and steps used:
  - `git status --short`
  - `sed -n '1338,1408p' docs/architect/TRADE_MACHINE_MASTER.md`
  - node-based importer/line-count inventory over remaining `src/features/architect/**/*.js` and `*.jsx` no-TS-peer files
  - targeted `sed -n` reads of:
    - `src/features/architect/utils/seasonManager.js`
    - `src/features/architect/utils/mutationPipeline.js`
    - `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`
    - `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.jsx`
    - `src/features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.jsx`
    - `src/features/architect/offseason/DraftPickTracker/DraftPickTracker.jsx`
    - `src/features/architect/offseason/WaiveStretchTracker/WaiveStretchTracker.jsx`
    - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
    - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`
    - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
    - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
    - `src/features/architect/GMDashboard/GMDashboard.jsx`
    - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
    - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
    - `src/features/architect/tradeMachine/TradeEditor.jsx`
    - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
    - `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
    - `src/features/architect/utils/tradeMachine/index.js`
    - `src/features/architect/utils/capTotals/index.js`
    - `src/features/architect/utils/persistenceContracts/index.js`
    - `src/features/architect/utils/tradeContext/index.js`
    - zero-import / weak-import residue files named in the execution prompt
- What the inspection proved:
  - The Team History batch remains a clean `5`-file core boundary with `4` wrapper exclusions and does not require widening into dashboard, trade UI, or orchestration hubs.
  - `seasonManager.js` remains the strongest surgical alternative, but it is riskier than the Team History batch and does not currently beat it on next-move cost/benefit.
  - `mutationPipeline.js` remains a dangerous hub, but it is even larger and less suitable than `seasonManager.js` as the next surgical move.
  - The strongest low-risk runner-up is the Free Agent Pool family, but it is less read-only and less compelling than Team History.
  - Zero-import or weak-import residue was explicitly classified before exclusion:
    - `useCapSheetState.js`: inactive legacy hook residue
    - `architectCore.js`: stale public aggregator / barrel residue
    - `cashUtils.js`, `freeAgentLogic.js`, `rosterUtils.js`, `salaryUtils.js`: inactive utility residue
    - `playerRulesProfile/types.js`: type-doc residue
    - `temp_mutation_code.js`: scratch/orphan residue
    - `tradeMachine/cache/index.js`, `tradeMachine/engine/index.js`: barrel/public entrypoint residue
    - `validatorFactory.js`, `enforcementValidation.js`, `resolveValidationEntitlements.js`: unwired support residue
- Required validation commands run:
  - `npm run typecheck`
    - Result: PASS.
  - `npm run validate:project`
    - Result: PASS.
- Commands intentionally skipped:
  - broader `npm run test:* -- --reporter=dot` suites
  - Reason: this was an audit/scoping pass, and static frontier plus importer evidence resolved the recommendation cleanly without a runtime ambiguity that required broader test proof.

## 7. Complexity / Risk Assessment
- Relative size versus the recently closed E75/E77/E78/E80/E82 work:
  - The recommended Team History batch is smaller overall than that grouped recent wave.
  - It is larger than the single-file E80/E82 passes, but materially safer than another orchestration-heavy migration.
- Likely execution shape:
  - Best handled as `one grouped batched pass`, not split sub-arcs.
- Batching-default answer:
  - Yes. The remaining frontier now supports `batched low-risk work by default`, with surgical treatment reserved for a short list of dangerous hubs.
  - Current short dangerous-hub list:
    - `src/features/architect/utils/seasonManager.js`
    - `src/features/architect/utils/mutationPipeline.js`
    - `src/features/architect/GMDashboard/GMDashboard.jsx`
    - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
    - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
    - `src/features/architect/tradeMachine/TradeEditor.jsx`
    - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
    - `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
- Key risks / caveats:
  - keep the `5`-file Team History core count explicit and separate from the `4` wrapper exclusions
  - do not blur Team History UI files into E41 or E54 helper reopenings
  - do not silently widen into dashboard/orchestration hubs unless a future migration pass documents a concrete blocker

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E83 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new E83 entry records that:
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
  - current execution-time repo evidence confirmed the `Team History surface` as the recommended next migration scope under the two-lane rule
  - that next move is `batched low-risk`
  - the estimated live JS/JSX business-logic count for the recommended scope is `5`, with `4` thin wrapper compatibility files excluded from the live count
  - the next move should likely be handled as `one grouped batched pass`
  - the remaining frontier now supports batching by default except for a short dangerous-hub list led by `seasonManager.js`, `mutationPipeline.js`, the central GMDashboard hubs, and the central Trade Machine UI hubs
