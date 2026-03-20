# TM_VALIDATOR_TS_INTERNAL_WRAPPER_BATCH_E125 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the first internal wrapper/barrel cleanup batch after the Phase 7B same-path shim retirement lane.
- Deleted 13 internal Architect wrapper/barrel surfaces and moved live callers/tests onto canonical feature-folder imports or direct component imports.
- Added a dedicated E125 guardrail proving deleted-path absence, extensionless/authority parity, and direct `OffseasonSection` component imports.
- Kept route/public-entry wrappers and mixed keeper surfaces out of scope.

## 2. Closed Scope Confirmation
- This pass stayed inside the internal wrapper/barrel cleanup gate.
- Deleted files were limited to internal top-level wrapper aliases plus the `GMDashboard/components/index.js` barrel.
- Remaining route/public-entry surfaces such as `src/features/architect/GMDashboard/index.jsx` and `src/features/architect/LeagueView.jsx` were not retired.
- Mixed/structural keepers such as `DraftPositionsInput.jsx`, `EntitlementPicksList.jsx`, `ValidationStateHeader.jsx`, `basicArchitectUtils.js`, `capLegalityValidation.js`, `computeTeamCapTotals.js`, `hardCapStatus.js`, `tradeContext/types.js`, and `tradeContext/legacy/index.js` remained untouched.

## 3. Files Changed
Deleted internal wrapper/barrel surfaces:
- `src/features/architect/{CapSheet.jsx,CapSheetFull.jsx,CapSummaryTiles.jsx,DraftPickTracker.jsx,ExceptionHistoryTracker.jsx,ExceptionTracker.jsx,FreeAgentPool.jsx,OffseasonTab.jsx,RosterVisual.jsx,TeamHistoryTab.jsx,ValidationWarnings.jsx,WaiveStretchTracker.jsx}`
- `src/features/architect/GMDashboard/components/index.js`

Runtime/source retargets:
- `src/features/architect/GMDashboard/sections/{CapSheetSection.tsx,CapTableSection.tsx,FreeAgencySection.tsx,HistorySection.tsx,OffseasonSection.tsx,RosterSection.tsx}`
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`
- `src/shared/components/EditContractModal.tsx`
- `src/global-shims.d.ts`

Test and guardrail retargets:
- `src/tests/architect/{freeAgentPool.surface.e86.behavior.test.tsx,internalWrapperBatch.e125.guardrail.test.tsx,sharedContractPocket.e111.behavior.test.tsx,teamHistory.baseMode.noEventsQuery.test.tsx,teamHistory.detailView.integration.test.tsx,teamHistory.displayFromEnrichedEvents.integration.test.tsx,teamHistory.displaySummary.failsoft.guardrail.test.ts,teamHistory.displaySummary.matrix.integration.test.tsx,teamHistory.fixtures.gating.test.tsx,teamHistory.render.sections.test.tsx,teamHistory.subsections.e84.rendering.test.tsx,teamHistory.surface.e84.integration.test.tsx,teamHistory.timelineFromWorldEvents.matrix.integration.test.tsx,teamHistory.worldBoundary.integration.test.tsx,teamHistory.worldEvents.integration.test.tsx,tmCapIntegration.ui.tradeApply_updatesTeamHistory.integration.test.tsx}`
- `tests/architect/CapSheetFull.rules.test.jsx`

Plan/doc updates:
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_INTERNAL_WRAPPER_BATCH_E125_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- The deleted internal wrapper paths are now intentionally absent; the preserved internal contract is direct canonical feature-folder importing rather than top-level wrapper alias importing.
- `src/tests/architect/internalWrapperBatch.e125.guardrail.test.tsx` proves deleted-path absence plus representative extensionless/authority parity for the retired wrapper family.
- That E125 guardrail also asserts that `src/features/architect/GMDashboard/sections/OffseasonSection.tsx` imports `SeasonAdvanceModal` and `DraftPositionsInput` directly, not through the retired `GMDashboard/components/index.js` barrel.
- `src/global-shims.d.ts` no longer declares the deleted wrapper aliases, so the removed internal wrapper paths are not silently accepted by TypeScript.

## 5. Validation / Inspection Run
Validation commands actually run:
- `npm run typecheck`
  - Result: PASS
- `npm run build`
  - Result: PASS
  - Notes: pre-existing warnings only for stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
- `npm run test:diff -- --reporter=dot`
  - Result: FAIL for signoff
  - Notes: changing `src/global-shims.d.ts` caused the diff runner to select `FULL`; the resulting failures were outside the E125 wrapper scope:
    - `src/tests/security/firestoreRules.integration.test.ts` requires `FIRESTORE_EMULATOR_HOST`
    - `tests/validators/roster.test.js` expects `warningsOnly: null` while the current validator returns `false`
- `npm run test:architect -- --reporter=dot`
  - Result: PASS
  - Coverage result: 201 files, 2743 tests passed
- `npm run validate:project`
  - Result: PASS

Commands intentionally skipped:
- `npm run test:trade -- --reporter=dot`
  - Skipped because this batch stayed in internal wrapper/barrel and Architect UI surfaces, not the trade-helper/runtime-backed helper lanes that require the separate trade suite.
- `npm run test:full`
  - Skipped as an explicit command because AGENTS.md blocks full-suite runs unless the prompt contains `RUN FULL SUITE`; the `test:diff` escalation above was incidental and not used as signoff.
- `npm run lint`
  - Skipped because repo guidance says lint is opt-in only and this execution did not require it.

## 6. Remaining Follow-Up
- Next safe lane: Phase 7C mixed/structural keeper review.
- Remaining route/public-entry wrapper decisions are still open for `GMDashboard/index.jsx`, `LeagueView.jsx`, and any other wrappers that intentionally shape public import topology.
- Phase 7E final Architect JS/JSX inventory gate remains open.
