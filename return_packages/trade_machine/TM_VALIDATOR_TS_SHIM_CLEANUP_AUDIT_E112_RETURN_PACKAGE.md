# TM_VALIDATOR_TS_SHIM_CLEANUP_AUDIT_E112 — EXECUTION RETURN PACKAGE

## 1. Summary
- The repo now supports same-path shim cleanup as the next default cleanup category inside the audited E112 frontier because a meaningful low-risk first deletion batch exists.
- A real first safe removable shim batch exists: 39 files survive from the 43-file zero-explicit-import initial candidate pool after mixed, documentation, and structural surfaces were excluded.
- The strongest removable-shim candidate set is the 39-file batch listed in Section 5. The four initial-pool exclusions are `src/features/architect/tradeMachine/ValidationStateHeader.jsx`, `src/features/architect/utils/capLegalityValidation.js`, `src/features/architect/utils/tradeContext/legacy/index.js`, and `src/features/architect/utils/tradeContext/types.js`.
- The strongest reason many shims must still remain is unchanged live runtime code that still imports explicit `.js/.jsx` paths, plus active compatibility guardrails and shim-shape tests that intentionally keep several zero-runtime shims in place.
- Same-path shim cleanup, wrapper cleanup, and barrel/public-entry cleanup are three different lanes. E112 does not merge them into one recommendation.

## 2. Closed Scope Confirmation
- The previously closed migration scopes remain closed: E91, E93, E95, E97, E99, E101, E103, E105, E107, E109, E111, and the grouped 33-file scope were re-checked through `docs/architect/TRADE_MACHINE_MASTER.md` and the matching return packages where exact kept-shim rationale mattered.
- Same-path `.js/.jsx` files with authoritative `.ts/.tsx` peers remain closed as shim residue unless current repo evidence proved otherwise. E112 did not reopen any prior migration arc and did not find a blocker that forced renewed TS migration work.
- The concrete E112 shim-deletion frontier was re-audited across the requested 144 same-path pairs under:
  - `src/features/architect/GMDashboard/**`
  - `src/features/architect/offseason/**`
  - `src/features/architect/tradeMachine/**`
  - `src/features/architect/utils/**`
  - `src/shared/components/**`
  - `src/shared/utils/contracts/**`
- The current 43-file zero-explicit-import set was treated only as the initial candidate pool for Candidate 1. Only files confirmed to be pure same-path re-export shims with no hidden wrapper/public-entry role were allowed into the actual first-batch recommendation.

## 3. Frontier Classification
### `required shim`
Runtime-import required same-path shims. These still have explicit `.js/.jsx` runtime importers in `src/**`, so deleting them now would break live resolution:

```text
src/features/architect/utils/capProjections.js
src/features/architect/utils/capUtils.js
src/features/architect/utils/cbaConstants.js
src/features/architect/utils/consentUtils.js
src/features/architect/utils/contractUtils.js
src/features/architect/utils/exceptions/exceptionLifecycle.js
src/features/architect/utils/faExceptionUtils.js
src/features/architect/utils/hardCapUtils.js
src/features/architect/utils/persistenceContracts/contracts.js
src/features/architect/utils/persistenceContracts/enforcement.js
src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js
src/features/architect/utils/persistenceContracts/validatePersistableShape.js
src/features/architect/utils/playerRulesProfile/birdRightsRules.js
src/features/architect/utils/playerRulesProfile/computeProfile.js
src/features/architect/utils/playerRulesProfile/extensionRules.js
src/features/architect/utils/playerRulesProfile/maxSalaryRules.js
src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js
src/features/architect/utils/playerRulesProfile/rfaRules.js
src/features/architect/utils/reacqUtils.js
src/features/architect/utils/seasonFormat.js
src/features/architect/utils/seasonUtils.js
src/features/architect/utils/stepienUtils.js
src/features/architect/utils/timingUtils.js
src/features/architect/utils/tradeHelpers.js
src/shared/utils/contracts/contractUtils.js
src/shared/utils/contracts/seasonNormalizer.js
src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js
src/features/architect/utils/tradeMachine/cache/validationCache.js
src/features/architect/utils/tradeMachine/cache/validationCacheService.js
src/features/architect/utils/tradeMachine/constants/cbaConstants.js
src/features/architect/utils/tradeMachine/constants/secondApronMessages.js
src/features/architect/utils/tradeMachine/engine/engineUtils.js
src/features/architect/utils/tradeMachine/engine/performanceMonitor.js
src/features/architect/utils/tradeMachine/engine/tradeDebug.js
src/features/architect/utils/tradeMachine/engine/tradeValidator.js
src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js
src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js
src/features/architect/utils/tradeMachine/engine/validationUtils.js
src/features/architect/utils/tradeMachine/rules/basicRules.js
src/features/architect/utils/tradeMachine/rules/draftRules.js
src/features/architect/utils/tradeMachine/rules/enforceConsent.js
src/features/architect/utils/tradeMachine/rules/enforcement.js
src/features/architect/utils/tradeMachine/rules/hardCapValidation.js
src/features/architect/utils/tradeMachine/rules/miscRules.js
src/features/architect/utils/tradeMachine/rules/rosterValidation.js
src/features/architect/utils/tradeMachine/rules/timingValidation.js
src/features/architect/utils/tradeMachine/rules/tradeExceptions.js
src/features/architect/utils/tradeMachine/rules/validateAggregation.js
src/features/architect/utils/tradeMachine/rules/validateCash.js
src/features/architect/utils/tradeMachine/rules/validateConsent.js
src/features/architect/utils/tradeMachine/rules/validateEligibility.js
src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js
src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js
src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js
src/features/architect/utils/tradeMachine/rules/validateReacquisition.js
src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js
src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js
src/features/architect/utils/tradeMachine/rules/validateStepien.js
src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js
src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js
src/features/architect/utils/tradeMachine/utils/capUtils.js
src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js
src/features/architect/utils/tradeMachine/utils/dataValidation.js
src/features/architect/utils/tradeMachine/utils/matchingValues.js
src/features/architect/utils/tradeMachine/utils/pickIdUtils.js
src/features/architect/utils/tradeMachine/utils/salaryMargin.js
src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js
src/features/architect/utils/tradeMachine/utils/salaryUtils.js
src/features/architect/utils/tradeMachine/utils/seasonUtils.js
src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js
src/features/architect/utils/tradeMachine/utils/swapResolution.js
src/features/architect/utils/tradeMachine/utils/tpeValidation.js
src/features/architect/utils/tradeMachine/utils/tradeTimingWindows.js
src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js
src/features/architect/utils/tradeMachine/utils/validationIssueText.js
```

Zero-runtime same-path shims that are still intentionally pinned by active compatibility guardrails, shim-shape assertions, or explicit compatibility imports in `src/tests` / `tests`:

```text
src/features/architect/GMDashboard/components/DeleteWorldModal.jsx
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx
src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx
src/features/architect/GMDashboard/components/WorldSelector.jsx
src/features/architect/GMDashboard/components/WorldTimeControls.jsx
src/features/architect/GMDashboard/GMDashboard.jsx
src/features/architect/GMDashboard/sections/OffseasonSection.jsx
src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx
src/features/architect/offseason/OffseasonTab/OptionManager.jsx
src/features/architect/tradeMachine/CapImpactTiles.jsx
src/features/architect/tradeMachine/EntitlementPickRow.jsx
src/features/architect/tradeMachine/EntitlementPicksList.jsx
src/features/architect/tradeMachine/OutgoingPlayersList.jsx
src/features/architect/tradeMachine/SelectTeamCard.jsx
src/features/architect/tradeMachine/TradeExceptionManager.jsx
src/features/architect/tradeMachine/TradePlayerRow.jsx
src/features/architect/utils/basicArchitectUtils.js
src/features/architect/utils/capTotals/computeTeamCapTotals.js
src/features/architect/utils/entitlements/entitlementPickRowProjection.js
src/features/architect/utils/mutationPipeline.js
src/features/architect/utils/playerRulesProfile/types.js
src/features/architect/utils/seasonManager.js
src/features/architect/utils/tpeLifecycle.js
src/features/architect/utils/tradeContext/tradeContext.js
src/features/architect/utils/tradeMachine/utils/hardCapStatus.js
src/shared/components/EditContractModal.jsx
```

Mixed same-path compatibility surfaces that are still not first-batch-safe even though they currently have no explicit `.js/.jsx` refs:

```text
src/features/architect/tradeMachine/ValidationStateHeader.jsx
src/features/architect/utils/capLegalityValidation.js
```

### `safe removable shim`
The 43-file zero-explicit-import set was the initial candidate pool. After representative reads and stricter filtering, the following 39 files qualify as the actual first safe removable shim batch:

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

Initial-candidate-pool files that did not survive into the first-batch recommendation:

```text
src/features/architect/tradeMachine/ValidationStateHeader.jsx
src/features/architect/utils/capLegalityValidation.js
src/features/architect/utils/tradeContext/legacy/index.js
src/features/architect/utils/tradeContext/types.js
```

### `intentional wrapper / barrel / public entrypoint`
Top-level wrapper and public-entry surfaces. These are not simple same-path shim residue and should be treated as wrapper cleanup, not shim deletion:

```text
src/features/architect/CapSheet.jsx
src/features/architect/CapSheetFull.jsx
src/features/architect/CapSummaryTiles.jsx
src/features/architect/DraftPickTracker.jsx
src/features/architect/ExceptionHistoryTracker.jsx
src/features/architect/ExceptionTracker.jsx
src/features/architect/FreeAgentPool.jsx
src/features/architect/GMDashboard/index.jsx
src/features/architect/LeagueView.jsx
src/features/architect/OffseasonTab.jsx
src/features/architect/RosterVisual.jsx
src/features/architect/TeamHistoryTab.jsx
src/features/architect/ValidationWarnings.jsx
src/features/architect/WaiveStretchTracker.jsx
```

Barrel and public-entry surfaces. These are a separate barrel/public-entry cleanup lane:

```text
src/features/architect/GMDashboard/components/index.js
src/features/architect/utils/capTotals/index.js
src/features/architect/utils/exceptions/index.js
src/features/architect/utils/persistenceContracts/index.js
src/features/architect/utils/playerRulesProfile/index.js
src/features/architect/utils/tradeContext/index.js
src/features/architect/utils/tradeMachine/cache/index.js
src/features/architect/utils/tradeMachine/engine/index.js
src/features/architect/utils/tradeMachine/index.js
src/features/architect/utils/tradeMachine/rules/index.js
src/features/architect/utils/tradeMachine/utils/index.js
src/shared/components/ui/filters/index.js
src/shared/utils/contracts/index.js
```

Structural same-path keepers that were intentionally excluded from Candidate 1 because their remaining role is wrapper/documentation-shaped rather than simple compatibility residue:

```text
src/features/architect/utils/tradeContext/legacy/index.js
src/features/architect/utils/tradeContext/types.js
```

### `live business logic still in JS/JSX`
These files still contain live implementation logic and are not shim-cleanup work:

```text
src/shared/components/BirdRightsIcon.jsx
src/shared/components/DropdownGroup.jsx
src/shared/components/ErrorBoundary.jsx
src/shared/components/PlayerHeadshot.jsx
src/shared/components/SeasonYearSelector.jsx
src/shared/components/TeamLogo.jsx
src/shared/components/TeamSelectDropdown.jsx
src/shared/components/ui/Dialog.jsx
src/shared/components/ui/Modal.jsx
src/shared/components/ui/ToggleButton.jsx
src/shared/components/ui/VideoExamples.jsx
src/shared/components/ui/drawers/DrawerShell.jsx
src/shared/components/ui/drawers/OpenDrawerButton.jsx
src/shared/components/ui/filters/BadgeFilterSelect.jsx
src/shared/components/ui/filters/MultiSelectFilter.jsx
src/shared/components/ui/filters/RangeSelector.jsx
src/shared/components/ui/filters/RoleChecklist.jsx
src/shared/components/ui/grades/OverallGradeBlock.jsx
src/shared/utils/contracts/contractParser.js
```

### `debug / support / monitoring residue`
Deprecated support layer that still re-exposes validator surfaces and should not be conflated with same-path shim deletion:

```text
src/features/architect/utils/tradeMachine/validators/index.js
```

### `dead / test-only / zero-runtime-import residue`
Non-runtime residue that is outside the same-path shim frontier:

```text
src/features/architect/utils/validatePhase21.test.js
```

## 4. Candidate Cleanup Directions
### Candidate 1 — first safe removable shim batch
- Start point: the 43-file zero-explicit-import initial candidate pool inside the audited 144-pair roots.
- Final result: 39 files survived after excluding mixed or structural surfaces.
- Why it is credible: every recommended file is a same-path pure re-export shim with a `.ts/.tsx` authority, no explicit `.js/.jsx` refs in `src`, `src/tests`, `tests`, `docs`, or `return_packages`, and no wrapper/barrel/public-entry role.

### Candidate 2 — keep shims, cleanup wrappers later
- Conservative interpretation: keep all 144 same-path shims because 75 are still runtime-import required, 26 more are still pinned by compatibility guardrails/tests, 2 zero-ref shims still have mixed export surfaces, and 2 more are structural trade-context keepers rather than clean shim residue.
- Why it loses: this path is safe but leaves an obviously deletable 39-file batch behind.

### Candidate 3 — wrapper/barrel cleanup is a different lane
- Wrapper cleanup and barrel/public-entry cleanup are structurally different from same-path shim deletion.
- The 14 wrapper/public-entry surfaces and 13 barrel/public-entry surfaces listed in Section 3 should not be folded into the first shim-deletion batch.

Decision:
- Candidate 1 wins.
- The first-batch recommendation is meaningful and low-risk, not tiny or awkward, so shim cleanup now beats both the fully conservative keep-everything path and any attempt to collapse wrappers/barrels into the same recommendation.

## 5. Recommended Next Scope
- Recommended next default category: same-path shim cleanup.
- Recommended first deletion batch: the 39 files listed in the `safe removable shim` bucket in Section 3.
- Why those 39 are safe:
  - each file is a same-path pure re-export shim over an existing `.ts/.tsx` authority
  - current repo evidence found no explicit `.js/.jsx` refs in `src`, `src/tests`, `tests`, `docs`, or `return_packages`
  - representative reads did not show hidden wrapper, barrel, or public-entry behavior
- Why the excluded shims are not yet safe:
  - 75 same-path shims still have live runtime `.js/.jsx` importers in `src/**`
  - 26 more zero-runtime shims are still pinned by compatibility guardrails or explicit compatibility tests
  - `src/features/architect/tradeMachine/ValidationStateHeader.jsx` and `src/features/architect/utils/capLegalityValidation.js` are mixed same-path compatibility surfaces rather than the simple pure-shim shape used by the first batch
  - `src/features/architect/utils/tradeContext/legacy/index.js` and `src/features/architect/utils/tradeContext/types.js` still read as structural/documentation trade-context surfaces rather than simple compatibility residue

## 6. Validation / Inspection Run
Inspection commands used:

```bash
rg --files src return_packages docs -g '*.js' -g '*.jsx' -g '*.ts' -g '*.tsx' -g '*.md'
rg -n "Validator TS .*E(91|93|95|97|99|101|103|105|107|109|111)|grouped 33-file scope|same-path shim|shim-only" return_packages/trade_machine docs/architect/TRADE_MACHINE_MASTER.md
rg -n "from ['\"][^'\"]+\\.(js|jsx)['\"]|import\\(['\"][^'\"]+\\.(js|jsx)['\"]\\)" src tests docs return_packages
node -e "<same-path sibling detection across the audited roots>"
node -e "<explicit .js/.jsx reference bucketing across src, src/tests, tests, docs, and return_packages>"
sed -n '1,40p' src/features/architect/utils/runOffseason.js
sed -n '1,40p' src/features/architect/utils/basicArchitectUtils.js
sed -n '1,80p' src/features/architect/CapSheet.jsx
sed -n '1,80p' src/features/architect/utils/tradeMachine/index.js
sed -n '1,120p' src/tests/architect/seasonManager.compatibility.guardrail.test.ts
sed -n '1,120p' src/shared/utils/contracts/contractParser.js
npm run typecheck
npm run validate:project
```

What the inspection proved:
- The same-path frontier inside the audited roots is 144 sibling pairs.
- The 43-file zero-explicit-import set is real, but only 39 of those files survive the stricter pure-shim/no-structural-role test.
- The strongest keep reason is concrete, not hypothetical: many TS authorities still import explicit `.js/.jsx` peers, and several zero-runtime shims are still intentionally asserted by compatibility guardrails.
- Representative spot checks confirmed all six required evidence types:
  - pure shim: `src/features/architect/utils/runOffseason.js`
  - mixed shim: `src/features/architect/utils/basicArchitectUtils.js`
  - wrapper: `src/features/architect/CapSheet.jsx`
  - barrel: `src/features/architect/utils/tradeMachine/index.js`
  - compatibility guardrail: `src/tests/architect/seasonManager.compatibility.guardrail.test.ts`
  - live JS non-shim: `src/shared/utils/contracts/contractParser.js`

Validation results:
- `npm run typecheck` — PASS
- `npm run validate:project` — PASS

Intentionally skipped:
- All `npm run test:*` commands were skipped because this was a documentation-only audit and static inspection resolved the frontier without unresolved ambiguity.
- `npm run build` was skipped because the prompt only required `typecheck` and `validate:project`.

## 7. Complexity / Risk Assessment
- Shim deletion is now low-to-moderate risk if the next execution stays inside the 39-file first batch. The files are homogeneous, pure, and unreferenced by explicit `.js/.jsx` paths in the audited evidence set.
- The main failure modes are:
  - hidden consumers outside the repo that still import explicit `.js/.jsx` paths
  - accidentally widening into guardrail-pinned shims that still have active compatibility tests
  - accidentally widening into mixed or structural surfaces such as `ValidationStateHeader.jsx`, `capLegalityValidation.js`, or the `tradeContext` legacy/type keepers
- Wrapper cleanup is not the same as shim cleanup because wrapper removal changes stable top-level import surfaces, while same-path shim cleanup only removes redundant compatibility files sitting beside authoritative TS peers.
- Barrel/public-entry cleanup is not the same as shim cleanup because barrel removal changes import topology and public module shape even when no same-path authority pair is involved.
- The next execution should be batched but surgical: one exact deletion batch for the 39 safe removable shims, with wrappers/barrels kept out of scope.

## 8. Master Doc Update
- Appended `### Validator TS Shim Cleanup Audit E112 (2026-03-15)` to `docs/architect/TRADE_MACHINE_MASTER.md` immediately after E111 and before the grouped 33-file entry.
- The appended entry states:
  - shim cleanup is now the next cleanup category inside the audited E112 frontier
  - the 43-file zero-explicit-import set was only the initial candidate pool
  - a real low-risk first batch exists with 39 pure same-path re-export shims
  - the strongest keep reason is unchanged live explicit `.js/.jsx` runtime imports plus active compatibility guardrails for zero-runtime shims
  - wrapper cleanup and barrel/public-entry cleanup remain separate lanes
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - the pointer to this return package
