# TM_VALIDATOR_TS_COMPATIBILITY_SHIM_RETIREMENT_BATCH_E116 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed the compatibility-only shim retirement tranche recommended by E115.
- Deleted 20 compatibility-only same-path `.js/.jsx` shims across dashboard/world, trade-team-card leaves, offseason preview, helper utilities, `tradeContext/tradeContext.js`, and `shared/components/EditContractModal.jsx`.
- Rewired guardrails and behavior tests from shim-presence assertions to deleted-path absence plus extensionless/authority parity.
- Left runtime-backed, mixed/structural, wrapper/barrel, and intentional legacy surfaces untouched.

## 2. Closed Scope Confirmation
- This pass stayed inside Phase 7A compatibility-only retirement work.
- No runtime-backed same-path shim was deleted.
- `tradeContext/legacy/index.js` remained intact as the intentional legacy contract.
- Mixed/structural keepers remained intact: `DraftPositionsInput.jsx`, `EntitlementPicksList.jsx`, `ValidationStateHeader.jsx`, `basicArchitectUtils.js`, `playerRulesProfile/types.js`, `capLegalityValidation.js`, `computeTeamCapTotals.js`, `hardCapStatus.js`, `tradeContext/types.js`.
- Runtime-backed shared/Trade Machine shims remained intact, including `shared/utils/contracts/*.js` and the cache/engine/helper families cataloged in E114/E115.

## 3. Files Changed
Deleted compatibility-only shims:
- `src/features/architect/GMDashboard/GMDashboard.jsx`
- `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
- `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
- `src/features/architect/GMDashboard/components/WorldSelector.jsx`
- `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
- `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
- `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
- `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
- `src/features/architect/tradeMachine/CapImpactTiles.jsx`
- `src/features/architect/tradeMachine/EntitlementPickRow.jsx`
- `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`
- `src/features/architect/tradeMachine/SelectTeamCard.jsx`
- `src/features/architect/tradeMachine/TradeExceptionManager.jsx`
- `src/features/architect/tradeMachine/TradePlayerRow.jsx`
- `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/seasonManager.js`
- `src/features/architect/utils/tpeLifecycle.js`
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/shared/components/EditContractModal.jsx`

Retargeted guardrails and behavior tests:
- `src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx`
- `src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx`
- `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx`
- `src/tests/architect/offseason.devGate.guardrail.test.ts`
- `src/tests/architect/offseason.previewSurface.e93.behavior.test.tsx`
- `src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx`
- `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js`
- `src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts`
- `src/tests/architect/seasonManager.compatibility.guardrail.test.ts`
- `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`
- `src/tests/architect/mutationPipeline.boundary.e107.test.ts`
- `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js`
- `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
- `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`
- `src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx`
- `src/tests/tradeMachine/seasonSwapResolution.test.js`
- `tests/architect/EditContractModal.rules.test.jsx`
- `tests/architect/extension_voidedByExtension.test.js`
- `tests/entitlements/entitlementPickRowProjection.test.js`
- `tests/smoke/seasonTransitionHelperImports.smoke.test.ts`
- `tests/trade/validatorContractCleanup.test.js`
- `tests/trade/validatorTrustFixes.test.js`
- `src/tests/architect/editContractModal_buyout_and_close.behavior.test.jsx`

Source/comment/doc touch-ups caused by deleted shim paths:
- `src/features/architect/GMDashboard/components/index.js`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/utils/capLegalityValidation.ts`
- `src/features/architect/utils/exceptions/exceptionLifecycle.ts`
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts`
- `src/features/architect/utils/leagueInvariants.ts`
- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/persistenceContracts/contracts.ts`
- `src/features/architect/utils/tradeContext/tradeContext.ts`
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`
- `.claude/plans/zazzy-herding-mochi.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_COMPATIBILITY_SHIM_RETIREMENT_BATCH_E116_RETURN_PACKAGE.md`

## 4. Guardrail / Contract Outcome
- Dashboard/world guardrails now prove deleted-shim absence plus extensionless/authority parity for `GMDashboard`, `WorldSelector`, and `SeasonAdvanceModal`; `DraftPositionsInput.jsx` remains covered as a retained mixed surface.
- Trade-team-card guardrails now prove deleted-shim absence plus extensionless/authority parity for the retired leaf components; `EntitlementPicksList.jsx` remains covered as a retained mixed surface.
- Offseason guardrails now treat `OffseasonSection.jsx`, `OffseasonTab.jsx`, and `OptionManager.jsx` as retired and prove the surviving TSX authority/export surface directly.
- Helper guardrails now treat `tpeLifecycle.js`, `entitlementPickRowProjection.js`, `seasonManager.js`, `mutationPipeline.js`, and `tradeContext/tradeContext.js` as retired while preserving the authoritative extensionless contracts.
- Shared contract pocket guardrails now treat `EditContractModal.jsx` as retired while preserving the live compatibility contracts for `shared/utils/contracts/contractUtils.js` and `shared/utils/contracts/seasonNormalizer.js`.

## 5. Validation / Inspection Run
Validation commands actually run:
- `npm run typecheck`
  - Result: PASS
- `npm run build`
  - Result: PASS
  - Notes: pre-existing warnings only for stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
- `npm run test:diff -- --reporter=dot`
  - Result: PASS
  - Selected tier: `ARCHITECT`
  - Coverage result: 193 files, 2677 tests passed
- `npm run test:trade -- --reporter=dot`
  - Result: PASS
  - Coverage result: 71 files, 637 tests passed
- `npm run validate:project`
  - Result: PASS

Commands intentionally skipped:
- `npm run test:architect -- --reporter=dot`
  - Skipped because `npm run test:diff -- --reporter=dot` already selected the Architect tier and passed against the touched guardrail/behavior surfaces.
- `npm run test:full`
  - Skipped because AGENTS.md blocks full-suite runs unless the prompt contains `RUN FULL SUITE`.
- `npm run lint`
  - Skipped because repo guidance says lint is opt-in only and this execution did not require it.

## 6. Remaining Follow-Up
- Phase 7B runtime-backed same-path cleanup remains open.
- Phase 7C mixed/structural keeper review remains open.
- Phase 7D wrapper/barrel/public-entry cleanup remains open.
- Phase 7E final Architect JS/JSX inventory gate remains open.
- The next safe lane is still runtime-backed internal import cleanup, starting with the dependency-ordered `src/**` `.js` importer graph rather than reopening mixed/legacy surfaces.
