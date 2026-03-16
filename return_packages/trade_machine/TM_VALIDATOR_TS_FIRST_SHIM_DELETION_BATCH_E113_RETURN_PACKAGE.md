# TM_VALIDATOR_TS_FIRST_SHIM_DELETION_BATCH_E113 — EXECUTION RETURN PACKAGE

## 1. Summary

- The 39-file first shim deletion batch completed fully.
- Deleted `39/39` planned same-path shims and retained `0/39`.
- Runtime behavior was not refactored or intentionally changed; the surviving `.ts/.tsx` authorities remained the source of truth.
- No `src/**` runtime import retargets were required for deleted E113 paths after the post-delete scan.
- The cleanup stayed inside the exact E113 deletion scope. Wrapper, barrel, public-entry, mixed-shim, and required-shim families were left in place.
- One small compile-only compatibility fix outside the shim batch was required to get `npm run typecheck` green: [CapSheet.tsx](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.tsx) now passes `Number(player.yearsOfService)` into `getMinimumCapHit(...)`. This did not change runtime behavior.

## 2. Files Changed

- Deleted files:

```text
src/features/architect/GMDashboard/components/OfferSheetList.jsx
src/features/architect/GMDashboard/sections/CapSheetSection.jsx
src/features/architect/GMDashboard/sections/CapTableSection.jsx
src/features/architect/GMDashboard/sections/FreeAgencySection.jsx
src/features/architect/GMDashboard/sections/HistorySection.jsx
src/features/architect/GMDashboard/sections/RosterSection.jsx
src/features/architect/GMDashboard/sections/TradeSection.jsx
src/features/architect/tradeMachine/DataWarningsSection.jsx
src/features/architect/tradeMachine/FaExceptionTracker.jsx
src/features/architect/tradeMachine/TradeEditor.jsx
src/features/architect/tradeMachine/TradeExceptionDashboard.jsx
src/features/architect/tradeMachine/TradeExportCapture.jsx
src/features/architect/tradeMachine/TradeLegalChecker.jsx
src/features/architect/tradeMachine/TradePreviewModal.jsx
src/features/architect/tradeMachine/TradeReceiptPanel.jsx
src/features/architect/tradeMachine/TradeSalaryCalculator.jsx
src/features/architect/tradeMachine/TradeSummaryPanel.jsx
src/features/architect/tradeMachine/TradeTeamCard.jsx
src/features/architect/tradeMachine/ValidationDetailsPanel.jsx
src/features/architect/tradeMachine/utils/computeTradeDraftKey.js
src/features/architect/tradeMachine/utils/devSntInjector.js
src/features/architect/tradeMachine/utils/entitlementWarnings.js
src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js
src/features/architect/utils/architectCore.js
src/features/architect/utils/capHoldTransitionHelpers.js
src/features/architect/utils/contractNormalization.js
src/features/architect/utils/contractSalaryUtils.js
src/features/architect/utils/entitlements/formatEntitlement.js
src/features/architect/utils/entitlements/seasonManagerProjection.js
src/features/architect/utils/exceptionHistory/historyHelpers.js
src/features/architect/utils/firebaseTeamPlanHelpers.js
src/features/architect/utils/runOffseason.js
src/features/architect/utils/salaryUtils.js
src/features/architect/utils/schemaAdapter.js
src/features/architect/utils/teamLoader.js
src/features/architect/utils/tradeContext/assertions.js
src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js
src/features/architect/utils/tradeManager.js
src/features/architect/utils/worldManager.js
```

- Updated tests and guardrails:
  - [offerSheets_closure.gate.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/offerSheets_closure.gate.test.ts)
  - [tradeEditorTeamCard.compatibility.guardrail.test.tsx](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeEditorTeamCard.compatibility.guardrail.test.tsx)
  - [tradeMachineValidationPresentation.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeMachineValidationPresentation.compatibility.guardrail.test.ts)
  - [tradeMachinePreviewExport.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts)
  - [tradeMachineHookSupportHelpers.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeMachineHookSupportHelpers.compatibility.guardrail.test.ts)
  - [tradeMachineSnapshotAccessors.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeMachineSnapshotAccessors.compatibility.guardrail.test.ts)
  - [entitlementPresentationHelpers.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/entitlementPresentationHelpers.compatibility.guardrail.test.ts)
  - [tradeExecutionHelpers.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeExecutionHelpers.compatibility.guardrail.test.ts)
  - [teamLoader.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/teamLoader.compatibility.guardrail.test.ts)
  - [worldManager.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/worldManager.compatibility.guardrail.test.ts)
  - [firebaseTeamPlanHelpers.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts)
  - [phase57_forbid_validateTrade_in_compute_guardrail.test.js](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js)
  - [phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js)
  - [phase73_tile_reactivity_and_totals_drift_guardrails.test.js](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js)
  - [phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js)
  - [capLegalityHelperImports.smoke.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/tests/smoke/capLegalityHelperImports.smoke.test.ts)
  - [contractSeasonHelperImports.smoke.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/tests/smoke/contractSeasonHelperImports.smoke.test.ts)
  - [seasonTransitionHelperImports.smoke.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/tests/smoke/seasonTransitionHelperImports.smoke.test.ts)
  - [exceptionHistoryHelperImports.smoke.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/tests/smoke/exceptionHistoryHelperImports.smoke.test.ts)

- New E113 guardrail:
  - [firstShimDeletionBatch.e113.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/firstShimDeletionBatch.e113.guardrail.test.ts)

- Supporting compile-only fix:
  - [CapSheet.tsx](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.tsx)

- Master doc:
  - [TRADE_MACHINE_MASTER.md](/Users/brenthibbitts/Desktop/ScoutZero/docs/architect/TRADE_MACHINE_MASTER.md)

- Return package:
  - [TM_VALIDATOR_TS_FIRST_SHIM_DELETION_BATCH_E113_RETURN_PACKAGE.md](/Users/brenthibbitts/Desktop/ScoutZero/return_packages/trade_machine/TM_VALIDATOR_TS_FIRST_SHIM_DELETION_BATCH_E113_RETURN_PACKAGE.md)

- Unrelated pre-existing worktree edits outside E113 were left untouched.

## 3. Deletion Batch Outcome

- Exact count deleted: `39`
- Exact count retained from the planned 39: `0`
- Files planned for deletion but kept: none
- Blockers: none

## 4. Retargets / Compatibility Fixes

- No `src/**` runtime import changes were required for the deleted E113 shim paths. The post-delete reference scan found no live runtime imports that needed retargeting.
- Deleted-batch compatibility tests were converted from shim-presence / dual-path parity expectations into shim-absence assertions plus surviving authority/export checks.
- Offer-sheet and dashboard coverage was retargeted in [offerSheets_closure.gate.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/offerSheets_closure.gate.test.ts) so it now expects `OfferSheetList.jsx` and `FreeAgencySection.jsx` to be absent while the TS authorities still resolve.
- Trade Machine UI compatibility coverage was retargeted in [tradeEditorTeamCard.compatibility.guardrail.test.tsx](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeEditorTeamCard.compatibility.guardrail.test.tsx), [tradeMachineValidationPresentation.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeMachineValidationPresentation.compatibility.guardrail.test.ts), and [tradeMachinePreviewExport.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts). The deleted `.jsx` surfaces are now expected to be absent, while extensionless imports and the `.tsx` authorities remain the compatibility proof.
- Utility/helper compatibility coverage was retargeted in [tradeMachineHookSupportHelpers.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeMachineHookSupportHelpers.compatibility.guardrail.test.ts), [tradeMachineSnapshotAccessors.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeMachineSnapshotAccessors.compatibility.guardrail.test.ts), [entitlementPresentationHelpers.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/entitlementPresentationHelpers.compatibility.guardrail.test.ts), [tradeExecutionHelpers.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/tradeExecutionHelpers.compatibility.guardrail.test.ts), [teamLoader.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/teamLoader.compatibility.guardrail.test.ts), [worldManager.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/worldManager.compatibility.guardrail.test.ts), and [firebaseTeamPlanHelpers.compatibility.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts).
- Source-scan guardrails were minimally adjusted in [phase57_forbid_validateTrade_in_compute_guardrail.test.js](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js), [phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js), [phase73_tile_reactivity_and_totals_drift_guardrails.test.js](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js), and [phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js).
- `phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` needed one additional allowlist retarget from the old JS path to the surviving TS authority: `utils/mutationPipeline.ts` was added to the allowlist and the allowlist size threshold moved from `<= 10` to `<= 11`.
- Smoke coverage was retargeted in [capLegalityHelperImports.smoke.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/tests/smoke/capLegalityHelperImports.smoke.test.ts), [contractSeasonHelperImports.smoke.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/tests/smoke/contractSeasonHelperImports.smoke.test.ts), [seasonTransitionHelperImports.smoke.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/tests/smoke/seasonTransitionHelperImports.smoke.test.ts), and [exceptionHistoryHelperImports.smoke.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/tests/smoke/exceptionHistoryHelperImports.smoke.test.ts). The exception-history smoke test specifically stopped asserting that the TS authority must still look like a shim stub.
- Added [firstShimDeletionBatch.e113.guardrail.test.ts](/Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/firstShimDeletionBatch.e113.guardrail.test.ts) to prove the batch happened: it asserts all 39 deleted paths are gone and checks representative surviving authorities for a dashboard section, Trade Machine UI, Trade Machine util, architect util, and exception/entitlement utility coverage.
- Compile-only compatibility fix: [CapSheet.tsx](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.tsx) now converts `player.yearsOfService` with `Number(...)` before calling `getMinimumCapHit(...)`. This was necessary for `tsc --noEmit` after unrelated worktree typing changes and was kept surgical.

## 5. Remaining Shims Not Deleted

- E113 deleted only the exact 39-file safe-removable same-path shim batch from E112.
- Same-path shims outside that batch were intentionally left in place because E112 classifies them as required, mixed, structural, wrapper-related, barrel/public-entry, or otherwise outside the first deletion lane.
- Wrapper/barrel cleanup remains a separate lane and was not touched here.
- Local post-E113 inventory inside `src/features/architect/**` still contains `121` same-path `.js/.jsx` shim surfaces. Representative retained families include:
  - dashboard and cap-sheet wrappers such as `GMDashboard/GMDashboard.jsx`, `GMDashboard/components/SeasonAdvanceModal.jsx`, `GMDashboard/components/WorldSelector.jsx`, `capSheet/CapSheet/CapSheet.jsx`, `capSheet/CapSheetFull/CapSheetFull.jsx`, and `capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - retained UI compatibility shims such as `tradeMachine/ValidationStateHeader.jsx`, `tradeMachine/TradeExceptionManager.jsx`, `tradeMachine/TradePlayerRow.jsx`, `tradeMachine/CapImpactTiles.jsx`, `tradeMachine/EntitlementPickRow.jsx`, and `tradeMachine/EntitlementPicksList.jsx`
  - retained hooks and architect utils such as `hooks/useTradeMachine.js`, `hooks/useTradeMachineSnapshot.js`, `utils/capLegalityValidation.js`, `utils/contractUtils.js`, `utils/seasonFormat.js`, `utils/seasonManager.js`, `utils/tpeLifecycle.js`, `utils/exceptions/exceptionLifecycle.js`, `utils/tradeContext/legacy/index.js`, and `utils/tradeContext/types.js`
  - retained Trade Machine engine/cache/rules/util surfaces such as `utils/tradeMachine/cache/validationCache.js`, `utils/tradeMachine/engine/tradeValidator.js`, `utils/tradeMachine/rules/validateSalaryMatching.js`, `utils/tradeMachine/rules/validateTradeExceptions.js`, `utils/tradeMachine/utils/salaryUtils.js`, and `utils/tradeMachine/utils/validationIssueText.js`
- E112 remains the source-of-truth audit for why those remaining families were not part of E113.

## 6. Regression Coverage Run

- `npm run typecheck`
  - Attempt 1: FAIL
  - Failure: [CapSheet.tsx](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.tsx) passed `player.yearsOfService` into `getMinimumCapHit(number)`
  - Follow-up: applied `Number(player.yearsOfService)` cast
- `npm run typecheck`
  - Attempt 2: PASS
- `npm run test:node -- --reporter=dot src/tests/architect/firstShimDeletionBatch.e113.guardrail.test.ts`
  - PASS
- `npm run test:node -- --reporter=dot src/tests/architect/offerSheets_closure.gate.test.ts src/tests/architect/tradeMachineHookSupportHelpers.compatibility.guardrail.test.ts src/tests/architect/tradeMachineSnapshotAccessors.compatibility.guardrail.test.ts src/tests/architect/entitlementPresentationHelpers.compatibility.guardrail.test.ts src/tests/architect/tradeExecutionHelpers.compatibility.guardrail.test.ts src/tests/architect/teamLoader.compatibility.guardrail.test.ts src/tests/architect/worldManager.compatibility.guardrail.test.ts src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js tests/smoke/capLegalityHelperImports.smoke.test.ts tests/smoke/contractSeasonHelperImports.smoke.test.ts tests/smoke/seasonTransitionHelperImports.smoke.test.ts tests/smoke/exceptionHistoryHelperImports.smoke.test.ts`
  - Attempt 1: FAIL
  - Failure: `phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` still expected the old JS allowlist shape
  - Attempt 2: FAIL
  - Failure: `exceptionHistoryHelperImports.smoke.test.ts` still asserted that the TS authority should look like a shim stub
  - Attempt 3: PASS
- `npm run test:ui -- --reporter=dot src/tests/architect/tradeEditorTeamCard.compatibility.guardrail.test.tsx src/tests/architect/tradeMachineValidationPresentation.compatibility.guardrail.test.ts src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts`
  - PASS
  - Note: under `vitest.ui.config.js`, only `tradeEditorTeamCard.compatibility.guardrail.test.tsx` matched the UI config include rules. The two `.ts` files were filtered out before execution.
- `npm run test:node -- --reporter=dot src/tests/architect/tradeMachineValidationPresentation.compatibility.guardrail.test.ts src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts`
  - Attempt 1: FAIL
  - Failure: `tradeMachineValidationPresentation.compatibility.guardrail.test.ts` still expected the surviving `.tsx` authorities to contain deleted shim export stubs
  - Attempt 2: PASS
- `npm run typecheck`
  - Attempt 3: PASS
- `npm run build`
  - PASS
  - Warnings:
    - stale `Browserslist` data warning
    - Vite browser externalization warning for `fs` imported by `src/features/architect/utils/tradeMachine/engine/tradeDebug.ts`
    - mixed static/dynamic import chunking warnings for `src/firebaseConfig.js`, `src/features/architect/utils/entitlements/entitlementResolver.ts`, and `src/features/architect/utils/leagueInvariants.ts`
    - large chunk size warning for the main production bundle
- `npm run validate:project`
  - PASS
- Intentionally skipped:
  - `npm run test:diff`, `npm run test:architect`, `npm run test:trade`, and any full-suite command were intentionally skipped because E113 is a deletion-only compatibility pass and the targeted guardrails/smokes gave the narrowest sufficient proof.

## 7. Post-E113 Status

- The first shim deletion batch is effectively complete.
- Another same-path shim cleanup batch still exists after this pass, but it must be selected from the remaining E112 inventory rather than widened ad hoc.
- Shim cleanup still remains the next cleanup category, but only through another narrowly audited batch. Wrapper/barrel/public-entry cleanup remains a separate frontier.
- E113 did not eliminate the broader retained-shim inventory; it removed the first safe `39`-file deletion batch cleanly and left the remaining families untouched.

## 8. Master Doc Update

- Appended `### Validator TS First Shim Deletion Batch E113 (2026-03-15)` immediately after E112 and before the grouped 33-file entry in [TRADE_MACHINE_MASTER.md](/Users/brenthibbitts/Desktop/ScoutZero/docs/architect/TRADE_MACHINE_MASTER.md).
- The appended entry states that the 39-file first deletion batch completed fully, `39` files were deleted, `0` planned deletions were retained, runtime behavior remained unchanged, the cleanup stayed inside the exact E113 scope, and `npm run typecheck`, `npm run build`, and `npm run validate:project` all passed.
- The appended entry points to [TM_VALIDATOR_TS_FIRST_SHIM_DELETION_BATCH_E113_RETURN_PACKAGE.md](/Users/brenthibbitts/Desktop/ScoutZero/return_packages/trade_machine/TM_VALIDATOR_TS_FIRST_SHIM_DELETION_BATCH_E113_RETURN_PACKAGE.md).
