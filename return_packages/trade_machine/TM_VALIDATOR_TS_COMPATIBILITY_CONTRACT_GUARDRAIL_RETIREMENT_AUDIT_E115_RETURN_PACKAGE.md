# TM_VALIDATOR_TS_COMPATIBILITY_CONTRACT_GUARDRAIL_RETIREMENT_AUDIT_E115 — EXECUTION RETURN PACKAGE

## 1. Summary
- Guardrail-retirement / compatibility-contract cleanup is now the strongest next cleanup category.
- A meaningful compatibility-only blocked same-path shim set still exists after fresh repo inspection. The clearest cluster is the dashboard/world, GM world-support, trade-team-card leaf, offseason preview, and helper/utility families whose retained `.js/.jsx` files no longer have live `src/**` explicit `.js/.jsx` importers but are still required by compatibility tests, shim-parity assertions, smoke tests, or source-scan guardrails.
- Candidate 1 wins because that compatibility-only blocked set is still meaningful and its strongest blocker cluster is plausibly retargetable or partially removable. This is true even though the full retained frontier is still numerically dominated by runtime-backed shims.
- The strongest retargetable/removable guardrail cluster is the parity/source-scan coverage in `src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx`, `src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx`, `src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx`, `src/tests/architect/offseason.previewSurface.e93.behavior.test.tsx`, `src/tests/architect/offseason.devGate.guardrail.test.ts`, `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`, `src/tests/architect/seasonManager.compatibility.guardrail.test.ts`, and `src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts`.
- The strongest reason some retained shims still must remain is unchanged runtime import pressure plus clearly intentional compatibility surfaces, especially `src/shared/utils/contracts/contractUtils.js`, `src/shared/utils/contracts/seasonNormalizer.js`, the Trade Machine cache/engine shims, and `src/features/architect/utils/tradeContext/legacy/index.js`.
- `src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts` no longer blocks retained same-path shims; E113 already retargeted preview/export coverage to deleted-shim absence and surviving authority checks.
- Mixed-shim cleanup, wrapper/barrel/public-entry cleanup, and live JS/JSX migration remain separate lanes.

## 2. Closed Scope Confirmation
- Prior migration scopes remain closed. E112 remains the closed shim-frontier audit, E113 remains the closed first deletion batch, and E114 remains the closed second-batch audit.
- E113 completed the first pure same-path deletion batch and removed all `39` planned shims without widening into runtime migration, wrapper cleanup, or barrel cleanup.
- E114 correctly found no second pure same-path shim deletion batch from current repo evidence.
- E115 did not reopen runtime migration scope. It re-audited the post-E114 retained same-path frontier only to separate compatibility-contract pressure from runtime-import pressure.
- Retained same-path `.js/.jsx` files continue to be treated as shim residue by default unless fresh repo evidence shows a mixed/structural role or an intentional compatibility contract.
- E115 stayed docs-only. No runtime files, tests, imports, or shim files were edited.

## 3. Frontier Classification
### `compatibility-only shim keeper`
- Dashboard/world family: `src/features/architect/GMDashboard/GMDashboard.jsx`, `src/features/architect/GMDashboard/components/WorldSelector.jsx`, and `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx` are still pinned by `src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx`; `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx` and `src/features/architect/GMDashboard/components/WorldTimeControls.jsx` are still pinned by `src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx`. Fresh import-specifier scans found no live `src/**` explicit `.jsx` importers for this family.
- Trade-team-card leaf family: `src/features/architect/tradeMachine/CapImpactTiles.jsx`, `src/features/architect/tradeMachine/SelectTeamCard.jsx`, `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`, `src/features/architect/tradeMachine/TradePlayerRow.jsx`, `src/features/architect/tradeMachine/EntitlementPickRow.jsx`, and `src/features/architect/tradeMachine/TradeExceptionManager.jsx` are still pinned by `src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx`; fresh import-specifier scans found no live `src/**` explicit `.jsx` importers for these files.
- Offseason preview family: `src/features/architect/GMDashboard/sections/OffseasonSection.jsx` is still pinned by `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx`; `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx` and `src/features/architect/offseason/OffseasonTab/OptionManager.jsx` are still pinned by `src/tests/architect/offseason.previewSurface.e93.behavior.test.tsx` plus the shim-content clauses in `src/tests/architect/offseason.devGate.guardrail.test.ts`. Fresh import-specifier scans found no live `src/**` explicit `.jsx` importers for this family.
- Helper/util family: `src/features/architect/utils/mutationPipeline.js` is still pinned by `src/tests/architect/mutationPipeline.boundary.e107.test.ts` and `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`; `src/features/architect/utils/seasonManager.js` is still pinned by `src/tests/architect/seasonManager.compatibility.guardrail.test.ts` and `src/tests/tradeMachine/seasonSwapResolution.test.js`; `src/features/architect/utils/entitlements/entitlementPickRowProjection.js` is still pinned by `src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts`; `src/features/architect/utils/tpeLifecycle.js` is still pinned by `tests/smoke/seasonTransitionHelperImports.smoke.test.ts`; `src/features/architect/utils/tradeContext/tradeContext.js` is still pinned by `tests/trade/validatorContractCleanup.test.js`; `src/shared/components/EditContractModal.jsx` is still pinned by `src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx` plus behavior coverage in `src/tests/architect/editContractModal_buyout_and_close.behavior.test.jsx` and `tests/architect/EditContractModal.rules.test.jsx`. Fresh import-specifier scans found no live `src/**` explicit `.js/.jsx` importers for these files.

### `runtime-and-compatibility shim keeper`
- `src/shared/utils/contracts/contractUtils.js` is still imported at runtime by `src/shared/utils/contracts/index.js`, and compatibility coverage still references it in `src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx` and `tests/smoke/contractSeasonHelperImports.smoke.test.ts`.
- `src/shared/utils/contracts/seasonNormalizer.js` is still imported at runtime by `src/shared/utils/contracts/index.js`, `src/shared/utils/contracts/contractParser.js`, and `src/features/architect/utils/tradeMachine/utils/seasonUtils.ts`, and compatibility coverage still references it in `src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx` and `tests/seasonNormalizer.test.js`.
- `src/features/architect/utils/tradeMachine/cache/validationCache.js` is still imported at runtime by `src/features/architect/utils/tradeMachine/cache/index.js`, `src/features/architect/utils/tradeMachine/engine/performanceMonitor.ts`, `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.ts`, and `src/features/architect/utils/tradeMachine/validators/index.js`, while `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx` still preserves the shim/export contract.
- `src/features/architect/utils/tradeMachine/engine/tradeDebug.js` is still imported at runtime by `src/features/architect/utils/tradeMachine/engine/index.js`, `src/features/architect/utils/tradeMachine/engine/validationUtils.ts`, and `src/features/architect/utils/tradeMachine/engine/validatorDebug.ts`, while `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx` still preserves the shim/export contract.
- The broader runtime-backed frontier cataloged in E114 still exists. E115 does not convert those files into compatibility-only keepers.

### `mixed / structural shim keeper`
- `src/features/architect/tradeMachine/ValidationStateHeader.jsx` remains pinned by `src/tests/architect/tradeMachineValidationPresentation.compatibility.guardrail.test.ts`; the current guardrail preserves an explicit default-plus-named `.jsx` compatibility surface.
- `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx` remains pinned by `src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx`; the guardrail preserves both named/default `.jsx` parity and authority prop-surface expectations.
- `src/features/architect/tradeMachine/EntitlementPicksList.jsx` remains pinned by `src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx`; the guardrail preserves dual named/default `.jsx` parity.
- `src/features/architect/utils/basicArchitectUtils.js`, `src/features/architect/utils/playerRulesProfile/types.js`, and `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js` remain mixed export or documentation keepers with guardrail-only pressure from `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx` or `src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js`.
- `src/features/architect/utils/capTotals/computeTeamCapTotals.js` remains pinned by explicit `.js` import parity in `src/tests/architect/batchB_cbaRules.test.js`, smoke coverage in `tests/smoke/helperFoundationImports.smoke.test.ts`, and shim-purity/source-scan clauses in `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`.
- `src/features/architect/utils/capLegalityValidation.js` remains pinned by `tests/smoke/capLegalityValidationImports.smoke.test.ts` and shim-purity/source-scan clauses in `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`.
- `src/features/architect/utils/tradeContext/types.js` remains a structural typedef / allowlist keeper because `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` still names `utils/tradeContext/types.js` inside its allowlist.
- `src/features/architect/utils/tradeContext/legacy/index.js` remains an intentional legacy wrapper surface pinned by `src/tests/architect/phase59_legacy_import_guardrail.test.js`.

### `guardrail likely retargetable`
- `src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx`, `src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx`, and `src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx` can preserve extensionless import and export-shape guarantees by asserting the `.ts/.tsx` authorities and extensionless imports instead of requiring the `.jsx` shims to exist.
- `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`, `src/tests/architect/seasonManager.compatibility.guardrail.test.ts`, and `src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts` can preserve named API guarantees against the authoritative `.ts` files without needing explicit `.js` import parity to keep the shim alive.
- `src/tests/architect/offseason.previewSurface.e93.behavior.test.tsx` can keep the preview behavior proof while dropping the explicit `OffseasonTab.jsx` / `OptionManager.jsx` import requirement.
- `src/tests/architect/tradeMachineValidationPresentation.compatibility.guardrail.test.ts` is partially retargetable: the deleted E113 presentation shims are already absent, and the only retained blocker left is `ValidationStateHeader.jsx`.
- `src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts` is already effectively retargeted and is no longer a retained-shim blocker.

### `guardrail likely intentional contract`
- `src/tests/architect/phase59_legacy_import_guardrail.test.js` deliberately preserves direct legacy namespace compatibility for `src/features/architect/utils/tradeContext/legacy/index.js`; this reads as an intentional compatibility contract, not accidental shim residue.
- `src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx` reflects an active shared-contract compatibility surface, but it is not the primary deletion blocker because the corresponding shims still have runtime `src/**` `.js` importers.

### `guardrail likely removable`
- The shim-content clauses in `src/tests/architect/offseason.devGate.guardrail.test.ts` look removable once preview behavior is asserted through `OffseasonTab.tsx` / `OptionManager.tsx` or extensionless imports; their current extra value is proving shim purity, not runtime behavior.
- `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` looks removable or retargetable for `src/features/architect/utils/tradeContext/types.js`; the allowlist role is path-sensitive and can be moved to `types.ts` or dropped if that file no longer needs to be named at all.
- The shim-purity checks in `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js` for `src/features/architect/utils/capLegalityValidation.js` and `src/features/architect/utils/capTotals/computeTeamCapTotals.js` look removable once the TS authorities and extensionless imports carry the same SSOT proof.
- `tests/smoke/capLegalityValidationImports.smoke.test.ts` is the strongest remaining shim-presence/parity contract in the mixed-helper lane; if explicit `.js` compatibility for that family is no longer intentional, this test becomes the obvious first retirement target.

### `wrapper / barrel / public-entrypoint lane`
- `src/features/architect/GMDashboard/index.jsx` and `src/features/architect/utils/tradeContext/index.js` remain wrapper/barrel/public-entry surfaces and must stay out of the E115 recommendation.

### `live JS/JSX migration lane`
- `src/shared/components/TeamLogo.jsx` remains live JSX business logic, not same-path shim residue, and stays outside this lane.

## 4. Candidate Cleanup Directions
### Candidate 1 — guardrail-retirement / compatibility-contract cleanup audit + execution lane
- Wins.
- Fresh repo evidence still shows a meaningful compatibility-only blocked set. The dashboard/world, GM world-support, trade-team-card leaf, offseason preview, and helper/util families retain same-path `.js/.jsx` shims that no longer have live `src/**` explicit `.js/.jsx` importers but are still required by tests or guardrails that directly read the shim files or import them explicitly.
- The strongest blocker cluster is retargetable or partially removable rather than runtime-backed: parity tests, shim-purity checks, and allowlist/source-scan clauses can be re-aimed at `.ts/.tsx` authorities or extensionless import surfaces.
- The broader retained frontier is still heavily runtime-backed, but that does not defeat Candidate 1 as the next category because those runtime-backed shims sit in separate runtime/mixed lanes and are not unlocked by keeping the compatibility-only cluster frozen.

### Candidate 2 — keep the compatibility layer as-is
- Loses as the next category.
- This conservative path is still correct for runtime-backed and clearly intentional surfaces such as `src/shared/utils/contracts/*.js`, the Trade Machine cache/engine shims, and `src/features/architect/utils/tradeContext/legacy/index.js`.
- It does not win overall because it would leave a meaningful compatibility-only blocked shim set untouched even though the current blocker is no longer live runtime import pressure.

### Candidate 3 — mixed/wrapper/barrel cleanup remains separate
- Still true.
- Mixed-shim cleanup, wrapper cleanup, barrel/public-entry cleanup, and live-JS migration should not be folded into E115’s recommendation.

Decision:
- Candidate 1 wins.
- Candidate 2 remains the keep-path for runtime-backed or intentionally preserved compatibility surfaces.
- Candidate 3 remains separate either way.

## 5. Recommended Next Scope
- Recommended next category: a narrow guardrail-retirement / compatibility-contract cleanup execution focused on compatibility-only shim keepers.
- First retained shim families to target:
  - dashboard/world: `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `DeleteWorldModal.jsx`, `WorldTimeControls.jsx`
  - trade-team-card leaves: `CapImpactTiles.jsx`, `SelectTeamCard.jsx`, `OutgoingPlayersList.jsx`, `TradePlayerRow.jsx`, `EntitlementPickRow.jsx`, `TradeExceptionManager.jsx`
  - offseason preview/dev-gate: `OffseasonSection.jsx`, `OffseasonTab.jsx`, `OptionManager.jsx`
  - helper/util: `mutationPipeline.js`, `seasonManager.js`, `entitlementPickRowProjection.js`, `tradeContext/tradeContext.js`, `tpeLifecycle.js`, `EditContractModal.jsx`
- First guardrails/tests to retarget or retire:
  - `src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx`
  - `src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx`
  - `src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx`
  - `src/tests/architect/offseason.previewSurface.e93.behavior.test.tsx`
  - the shim-content clauses inside `src/tests/architect/offseason.devGate.guardrail.test.ts`
  - `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`
  - `src/tests/architect/seasonManager.compatibility.guardrail.test.ts`
  - `src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts`
  - `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx` only for the `OffseasonSection.jsx` compatibility clause
- Second-wave follow-up once the first compatibility-only cluster is cleared:
  - retarget or retire the `tradeContext/types.js` allowlist role inside `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
  - decide whether `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js` and `tests/smoke/capLegalityValidationImports.smoke.test.ts` still intentionally preserve mixed-helper `.js` compatibility or should be narrowed to authority/export checks
- This should come before another shim deletion attempt because the current compatibility-only cluster is blocked mainly by tests and guardrails, not by live runtime imports. Without retargeting that contract layer first, the next deletion batch remains artificially closed.
- This should not start by touching `src/tests/architect/phase59_legacy_import_guardrail.test.js`, `src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx`, or the runtime-backed cache/engine/contract shims; those still look intentional or runtime-backed.

## 6. Validation / Inspection Run
Files changed:
- `return_packages/trade_machine/TM_VALIDATOR_TS_COMPATIBILITY_CONTRACT_GUARDRAIL_RETIREMENT_AUDIT_E115_RETURN_PACKAGE.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`

Inspection commands used:

```bash
sed -n '1,260p' return_packages/trade_machine/TM_VALIDATOR_TS_SHIM_CLEANUP_AUDIT_E112_RETURN_PACKAGE.md
sed -n '1,260p' return_packages/trade_machine/TM_VALIDATOR_TS_FIRST_SHIM_DELETION_BATCH_E113_RETURN_PACKAGE.md
sed -n '1,320p' return_packages/trade_machine/TM_VALIDATOR_TS_SECOND_SHIM_CLEANUP_AUDIT_E114_RETURN_PACKAGE.md
sed -n '2058,2105p' docs/architect/TRADE_MACHINE_MASTER.md
node - <<'NODE' # same-path sibling scan across the audited roots
node - <<'NODE' # import-specifier scan separating src/** runtime pressure from src/tests/tests pressure
rg --files src/tests tests | rg 'dashboardWorldBoundary|gmWorldSupportFamily|tradeMachineValidationPresentation|tradeMachinePreviewExport|tradeTeamCardLeafFamily|offseason\.devGate|sharedContractPocket|capLegalityValidationImports|contractSeasonHelperImports|seasonTransitionHelperImports|phase59_legacy_import_guardrail|phase65_forbid_direct_tradeExceptions_reads_guardrail|phase75_room_exception_auto_eligibility_guardrails|phase78_remove_updateTeamCapTotals_ssot_only_guardrails|compatibility|smoke|parity'
sed -n '1,240p' src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx
sed -n '1,240p' src/tests/architect/tradeMachineValidationPresentation.compatibility.guardrail.test.ts
sed -n '1,240p' src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts
sed -n '1,260p' src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx
sed -n '1,240p' src/tests/architect/offseason.devGate.guardrail.test.ts
sed -n '1,260p' src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx
sed -n '1,260p' src/tests/architect/phase59_legacy_import_guardrail.test.js
sed -n '1,260p' src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js
sed -n '1,260p' src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js
sed -n '1,220p' tests/smoke/contractSeasonHelperImports.smoke.test.ts
sed -n '1,220p' tests/smoke/seasonTransitionHelperImports.smoke.test.ts
sed -n '1,260p' tests/smoke/capLegalityValidationImports.smoke.test.ts
sed -n '1,120p' src/features/architect/utils/capLegalityValidation.js
sed -n '1,120p' src/features/architect/utils/tradeContext/types.js
sed -n '1,120p' src/features/architect/utils/tradeContext/legacy/index.js
sed -n '1,120p' src/features/architect/GMDashboard/index.jsx
sed -n '1,120p' src/shared/components/TeamLogo.jsx
npm run typecheck
npm run validate:project
```

What the inspection proved:
- The audited-root retained same-path frontier still re-confirms at `105` pairs.
- A meaningful compatibility-only blocked set still exists. Fresh import-specifier scans found no live `src/**` explicit `.js/.jsx` importer for the dashboard/world, trade-team-card, offseason preview, `mutationPipeline.js`, `seasonManager.js`, `entitlementPickRowProjection.js`, `tradeContext/tradeContext.js`, `tpeLifecycle.js`, and `EditContractModal.jsx` shims, while current tests still require those shim paths to exist.
- `tradeMachinePreviewExport.compatibility.guardrail.test.ts` no longer blocks retained shims; preview/export moved out of the retained frontier in E113.
- Runtime-and-compatibility keepers still exist and stay separate. Shared contract pocket shims plus Trade Machine cache/engine shims still have real `src/**` `.js` importers.
- Mixed/structural keepers still carry guardrail-driven retention components. The clearest examples are `capLegalityValidation.js`, `computeTeamCapTotals.js`, `tradeContext/types.js`, and `tradeContext/legacy/index.js`.

Validation commands actually run:
- `npm run typecheck`
  - Result: FAIL
  - Failure remains pre-existing / out-of-scope relative to E115’s docs-only scope. The current failure clusters include `src/features/architect/capSheet/CapSheet/CapSheet.tsx`, `src/features/architect/GMDashboard/sections/CapTableSection.tsx`, `src/features/architect/utils/mutationPipeline.ts`, `src/features/architect/utils/seasonManager.ts`, `src/features/roster/RosterViewerActions.tsx`, `src/tests/architect/usePlayerRulesProfiles.behavior.test.ts`, multiple roster test files, and scouting test files.
- `npm run validate:project`
  - Result: PASS

Commands intentionally skipped:
- All `npm run test:*` commands were intentionally skipped because static inspection resolved the compatibility-contract frontier cleanly and the E115 prompt forbids broader test runs unless a real ambiguity requires them.

## 7. Complexity / Risk Assessment
- Guardrail-retirement now looks like a moderate-risk cleanup: lower risk than reopening runtime migration, but not zero risk because many tests deliberately assert explicit `.js/.jsx` compatibility.
- The landscape changed after E113/E114. E113 removed the first low-risk pure same-path deletion batch. E114 then showed no second pure deletion batch remained. E115 now shows the next meaningful unlock is not runtime migration but compatibility-contract retargeting for the test-only blocked shim cluster.
- Guardrail-retirement is a better next unlock than immediate shim deletion because the current blockers for that cluster are parity/source-scan expectations, not live runtime `.js/.jsx` imports. Deleting those shims first would simply fight the existing contracts; retargeting the contracts first can make a later deletion batch real.
- Mixed-shim cleanup remains separate because files like `capLegalityValidation.js`, `computeTeamCapTotals.js`, `basicArchitectUtils.js`, `ValidationStateHeader.jsx`, and `hardCapStatus.js` preserve mixed export/default-plus-named or documentation-shaped surfaces that are not reducible to a simple same-path shim deletion.
- Wrapper/barrel cleanup remains separate because files like `src/features/architect/GMDashboard/index.jsx` and `src/features/architect/utils/tradeContext/index.js` change import topology and public-entry behavior, not just redundant same-path residue.
- The next execution should therefore be a narrow compatibility-contract / guardrail-retarget pass, not an immediate deletion pass and not a merged mixed/wrapper/barrel cleanup.

## 8. Master Doc Update
- Appended `### Validator TS Compatibility-Contract / Guardrail-Retirement Audit E115 (2026-03-15)` immediately after the E114 entry in `docs/architect/TRADE_MACHINE_MASTER.md`.
- The appended entry states that guardrail-retirement / compatibility-contract cleanup is now the next category, that a meaningful compatibility-only blocked shim set still exists, that the strongest retargetable/removable cluster is the dashboard/world plus trade-team/offseason/helper parity guardrails, that the strongest keep reason is unchanged runtime-backed or intentional compatibility pressure, that mixed/wrapper/barrel/live-JS lanes remain separate, that `npm run typecheck` failed, that `npm run validate:project` passed, and it points to this E115 return package.
