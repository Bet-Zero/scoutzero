# TM_VALIDATOR_TS_GROUPED_33_FILE_SCOPE — EXECUTION RETURN PACKAGE

## 1. Summary
- The named grouped 33-file scope was migrated to authoritative `.ts` / `.tsx` implementations.
- All 33 legacy `.js` / `.jsx` files in scope are now shim-only re-exports.
- Runtime behavior was preserved; the pass stayed compatibility-first and did not redesign APIs, cache payloads, or UI flow.
- No blocker forced widening outside the named 33-file scope.

## 2. Files Changed
Runtime authorities:
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/GMDashboard/sections/HistorySection.tsx`
- `src/features/architect/GMDashboard/sections/TradeSection.tsx`
- `src/features/architect/GMDashboard/sections/RosterSection.tsx`
- `src/features/architect/GMDashboard/sections/CapTableSection.tsx`
- `src/features/architect/shared/RosterVisual/RosterVisual.tsx`
- `src/features/architect/shared/LeagueView/LeagueView.tsx`
- `src/features/architect/shared/ValidationWarnings/ValidationWarnings.tsx`
- `src/features/architect/contract/ContractEditor/ContractEditor.tsx`
- `src/features/architect/contract/ContractEditorModal/ContractEditorModal.tsx`
- `src/features/architect/utils/cbaConstants.ts`
- `src/features/architect/utils/capProjections.ts`
- `src/features/architect/utils/playerRulesProfile/types.ts`
- `src/features/architect/utils/stepienUtils.ts`
- `src/features/architect/utils/salaryUtils.ts`
- `src/features/architect/utils/basicArchitectUtils.ts`
- `src/features/architect/utils/architectCore.ts`
- `src/features/architect/utils/runOffseason.ts`
- `src/features/architect/utils/reacqUtils.ts`
- `src/features/architect/utils/seasonUtils.ts`
- `src/features/architect/utils/tradeMachine/constants/cbaConstants.ts`
- `src/features/architect/utils/tradeMachine/constants/secondApronMessages.ts`
- `src/features/architect/hooks/useArchitectPlayerData.ts`
- `src/features/architect/utils/tradeMachine/cache/validationCache.ts`
- `src/features/architect/utils/tradeMachine/cache/validationCacheService.ts`
- `src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.ts`
- `src/features/architect/utils/tradeMachine/engine/performanceMonitor.ts`
- `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.ts`
- `src/features/architect/utils/tradeMachine/engine/tradeDebug.ts`
- `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.ts`
- `src/features/architect/utils/tradeMachine/engine/engineUtils.ts`
- `src/features/architect/utils/tradeMachine/rules/enforcement.ts`

Legacy same-path shims:
- `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
- `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`
- `src/features/architect/GMDashboard/sections/HistorySection.jsx`
- `src/features/architect/GMDashboard/sections/TradeSection.jsx`
- `src/features/architect/GMDashboard/sections/RosterSection.jsx`
- `src/features/architect/GMDashboard/sections/CapTableSection.jsx`
- `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
- `src/features/architect/shared/LeagueView/LeagueView.jsx`
- `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
- `src/features/architect/contract/ContractEditor/ContractEditor.jsx`
- `src/features/architect/contract/ContractEditorModal/ContractEditorModal.jsx`
- `src/features/architect/utils/cbaConstants.js`
- `src/features/architect/utils/capProjections.js`
- `src/features/architect/utils/playerRulesProfile/types.js`
- `src/features/architect/utils/stepienUtils.js`
- `src/features/architect/utils/salaryUtils.js`
- `src/features/architect/utils/basicArchitectUtils.js`
- `src/features/architect/utils/architectCore.js`
- `src/features/architect/utils/runOffseason.js`
- `src/features/architect/utils/reacqUtils.js`
- `src/features/architect/utils/seasonUtils.js`
- `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
- `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`
- `src/features/architect/hooks/useArchitectPlayerData.js`
- `src/features/architect/utils/tradeMachine/cache/validationCache.js`
- `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
- `src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js`
- `src/features/architect/utils/tradeMachine/engine/performanceMonitor.js`
- `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js`
- `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
- `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
- `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
- `src/features/architect/utils/tradeMachine/rules/enforcement.js`

Tests and guardrails:
- `src/tests/architect/offseason.devGate.guardrail.test.ts`
- `src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js`
- `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx`
- `src/tests/architect/grouped33FileScope.node.behavior.test.ts`
- `src/tests/architect/grouped33FileScope.ui.behavior.test.tsx`

Docs and return artifacts:
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `docs/COMPONENT_INDEX.md`
- `docs/components/ArchitectHierarchy.md`
- `docs/architect/OFFSEASON_MASTER.md`
- `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
- `docs/architect/contracts/PERSISTENCE_CONTRACTS.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_GROUPED_33_FILE_SCOPE_RETURN_PACKAGE.md`

Special export-surface handling called out explicitly:
- `src/features/architect/utils/basicArchitectUtils.js` is the only mixed shim in scope and preserves both `default` and named exports.
- `src/features/architect/utils/playerRulesProfile/types.js` remains a default-only compatibility/documentation module.
- `src/features/architect/GMDashboard/sections/OffseasonSection.jsx` preserves the named-only surface for both `DEV_OFFSEASON_PREVIEW_FLAG` and `OffseasonSection`.

## 3. Types Introduced or Hardened
- Added permissive file-local bags such as `LooseRecord = Record<string, any>` in migrated leaf/runtime files including `basicArchitectUtils.ts`, `OffseasonSection.tsx`, `validationCache.ts`, `tradeDebug.ts`, `engineUtils.ts`, and `enforcement.ts`.
- Added local cache/monitor helper types only where TS required them, including `CacheBucketMap` in `validationCacheService.ts`, `ValidationMetricsRecord` in `validationPerformanceMonitor.ts`, and permissive local map/metrics shapes inside the TM monitor/cache authorities.
- Added local UI prop types only inside migrated authorities, including `TradeSectionProps`, `TeamSummaryLike`, `ValidationWarningsProps`, `ContractEditorProps`, `ContractEditorModalProps`, and `RosterVisualProps`.
- Added local rule helper types `RuleContext` and `RuleOptions` in `enforcement.ts` to keep callbacks and dates permissive without changing runtime logic.
- No shared migration type barrel was introduced and no public contract was intentionally tightened.

## 4. Migration Work Completed
- Leaf utils/constants/hooks:
  - Ported all named Slice A authorities to `.ts`, kept helper/export order intact, and preserved compatibility-only surfaces for `playerRulesProfile/types` and `basicArchitectUtils`.
  - `architectCore.ts` stayed a barrel-style authority and preserved the current export surface/order while the direct source-scan guardrail was retargeted to the new file.
- TM cache/engine/rules:
  - Ported the Slice B cache, engine, and enforcement leaves to `.ts`.
  - `validationCache.ts` was handled as the highest-risk file: singleton/class behavior, loose payload shapes, duplicate method shapes, cache-key semantics, fallback behavior, and metrics/invalidation behavior were preserved.
  - `tradeDebug.ts`, `validationPerformanceMonitor.ts`, `validationDebugMonitor.ts`, and `performanceMonitor.ts` kept the current logging/monitor object shapes and singleton exports intact.
- Shared display/contract/dashboard sections:
  - Ported the Slice C TSX authorities near line-for-line.
  - Preserved the `OffseasonSection` DEV gate, preview banner copy, named export surface, and world-season advance sequencing.
  - Preserved the display-oriented loose props for `LeagueView`, `RosterVisual`, `ValidationWarnings`, `ContractEditor`, and `ContractEditorModal`.
- Shim conversion:
  - Replaced all 33 legacy `.js` / `.jsx` files with pure shim-only re-exports after the new authorities typechecked cleanly.
  - Shim shapes were verified file-by-file before conversion; no category-wide assumption was used.
  - `basicArchitectUtils.js` required special mixed-surface handling with both `export { default } ...` and `export * ...`.
- Test retargets:
  - Retargeted `src/tests/architect/offseason.devGate.guardrail.test.ts` from `OffseasonSection.jsx` to `OffseasonSection.tsx`.
  - Retargeted `src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js` from `architectCore.js` to `architectCore.ts`.
  - Added a narrow compatibility guardrail only for the highest-risk/odd-surface files: `basicArchitectUtils`, `playerRulesProfile/types`, `OffseasonSection`, `ContractEditorModal`, `validationCache`, and `tradeDebug`.
  - Added focused grouped-scope node/UI behavior tests instead of a broad new integration suite.

## 5. JS/JSX Holdouts
- Within this named 33-file scope, no JS/JSX business-logic holdouts remain.
- The original 33 `.js` / `.jsx` files remain in place only as shim-only compatibility surfaces.
- The broader repository still contains legacy JS/JSX outside this named scope by design; those files were explicitly left out because this pass did not widen into unrelated authorities or hubs.

## 6. Regression Coverage Run
- Baseline before edits:
  - `npm run typecheck` — PASS
  - `npm run build` — PASS
  - `npm run validate:project` — PASS
- Migration-time compile stabilization:
  - `npm run typecheck` — FAIL during authority shaping; fixed permissive local typing in the new TM cache/engine/rules/UI authorities, then reran
  - `npm run typecheck` — PASS
- Targeted node proof:
  - `npm run test:node -- --reporter=dot src/tests/architect/grouped33FileScope.node.behavior.test.ts src/tests/architect/offseason.devGate.guardrail.test.ts src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js src/tests/tradeMachine/validationUtils.contract.test.ts tests/validationPerformance.test.js tests/validators/validationCache.test.js tests/trade/validation_caching.test.js tests/trade/basicRules.test.ts tests/trade/consent_and_reacq.test.js src/tests/architect/phase86_oste_offseason_transition_engine.test.ts tests/contractSeasonHelpers.test.ts tests/yearLogicIntegration.test.js tests/seasonIntegrationFinal.test.js` — FAIL on first run because the new node behavior test hard-coded a locale-sensitive `toLocaleDateString()` value
  - `npm run test:node -- --reporter=dot src/tests/architect/grouped33FileScope.node.behavior.test.ts src/tests/architect/offseason.devGate.guardrail.test.ts src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js src/tests/tradeMachine/validationUtils.contract.test.ts tests/validationPerformance.test.js tests/validators/validationCache.test.js tests/trade/validation_caching.test.js tests/trade/basicRules.test.ts tests/trade/consent_and_reacq.test.js src/tests/architect/phase86_oste_offseason_transition_engine.test.ts tests/contractSeasonHelpers.test.ts tests/yearLogicIntegration.test.js tests/seasonIntegrationFinal.test.js` — PASS
  - Test-only stabilization work: relaxed the single locale-sensitive enforcement assertion to match behavior without pinning a timezone/locale-dependent date string
- Targeted UI proof:
  - `npm run test:ui -- --reporter=dot src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx src/tests/architect/grouped33FileScope.ui.behavior.test.tsx src/tests/smoke/architect.uiSmoke.e1.test.tsx src/tests/architect/capSheet.displayCore.e88.behavior.test.tsx src/tests/architect/capSheet.uiFlows.integration.test.tsx src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx` — PASS
  - The larger UI bundle did not overrun, so the planned split reruns were intentionally not needed
- Required end-of-pass validation:
  - `npm run typecheck` — PASS
  - `npm run build` — PASS
  - `npm run validate:project` — PASS
- Build warnings observed:
  - stale `Browserslist` data warning
  - `fs` externalized for browser compatibility from `src/features/architect/utils/tradeMachine/engine/tradeDebug.ts`
  - existing mixed static/dynamic import chunking warnings
  - existing large chunk warning for the main build output
- Intentionally skipped:
  - no audit-first flow was run
  - `npm run test:full` was not run because the prompt did not authorize `RUN FULL SUITE`
  - the planned UI split commands were not run because the first targeted UI command completed cleanly

## 7. Post-Migration Status
- This grouped 33-file scope is effectively complete.
- No narrow follow-up remains inside the named runtime boundary beyond retaining the mandatory same-path shims.
- Nearby excluded hubs stayed excluded, including broader dashboard/world shells, mutation-pipeline redesign, and unrelated previously closed authorities outside the named list.

## 8. Master Doc Update
- Appended `### Validator TS Grouped 33-File Scope (2026-03-15)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The appended entry records that the grouped 33-file scope is now TS-backed, same-path `.js/.jsx` files are shim-only, behavior remained unchanged, the grouped pass completed cleanly, the grouped boundary is effectively complete, and no narrow in-scope follow-up remains.
