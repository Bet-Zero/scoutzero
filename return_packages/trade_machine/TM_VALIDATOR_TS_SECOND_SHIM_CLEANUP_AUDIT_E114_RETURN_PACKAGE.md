# TM_VALIDATOR_TS_SECOND_SHIM_CLEANUP_AUDIT_E114 — EXECUTION RETURN PACKAGE

## 1. Summary
- No meaningful second safe removable same-path shim batch exists from current repo evidence.
- Shim cleanup is not the next default deletion category after E113.
- The strongest current second-batch candidate set is empty.
- The strongest keep reason is combined runtime explicit `.js/.jsx` import pressure plus active compatibility/source-scan guardrails.
- Mixed-shim cleanup and wrapper/barrel/public-entry cleanup remain separate lanes.
- The retained audited-root same-path frontier re-confirmed at `105` files, partitioned into `72` pure runtime-import required shims, `19` pure compatibility/guardrail-pinned shims, and `14` mixed / structural keepers.

## 2. Closed Scope Confirmation
- Prior migration scopes remain closed. E112 remains the closed shim-frontier audit, and E113 remains the closed first deletion batch.
- E113 completed its first deletion batch fully and deleted all `39` planned same-path shims without widening into wrappers, barrels, or unrelated runtime cleanup.
- Retained same-path `.js/.jsx` files remain closed shim residue unless current repo evidence proves otherwise.
- E114 did not reopen runtime migration scope. It re-audited only the post-E113 retained frontier under:
  - `src/features/architect/GMDashboard/**`
  - `src/features/architect/offseason/**`
  - `src/features/architect/tradeMachine/**`
  - `src/features/architect/utils/**`
  - `src/shared/components/**`
  - `src/shared/utils/contracts/**`

## 3. Frontier Classification
### `required shim`
Runtime-import required same-path shims. A fresh explicit-import scan still found `75` retained same-path shims with `src/**` `.js/.jsx` pressure. Three of those are mixed-export keepers and are classified below in `mixed / structural shim keepers`. The remaining `72` pure runtime-import required shims are:

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
src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js
src/features/architect/utils/tradeMachine/rules/validateReacquisition.js
src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js
src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js
src/features/architect/utils/tradeMachine/rules/validateStepien.js
src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js
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
src/shared/utils/contracts/contractUtils.js
src/shared/utils/contracts/seasonNormalizer.js
```

Compatibility/guardrail-pinned same-path shims. A fresh scan still found `28` retained same-path shims with `src/tests` / `tests` pressure. Nine of those are mixed or structural keepers and are classified below in `mixed / structural shim keepers`. The remaining `19` pure compatibility/guardrail-pinned shims are:

```text
src/features/architect/GMDashboard/GMDashboard.jsx
src/features/architect/GMDashboard/components/DeleteWorldModal.jsx
src/features/architect/GMDashboard/components/WorldSelector.jsx
src/features/architect/GMDashboard/components/WorldTimeControls.jsx
src/features/architect/GMDashboard/sections/OffseasonSection.jsx
src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx
src/features/architect/offseason/OffseasonTab/OptionManager.jsx
src/features/architect/tradeMachine/CapImpactTiles.jsx
src/features/architect/tradeMachine/EntitlementPickRow.jsx
src/features/architect/tradeMachine/OutgoingPlayersList.jsx
src/features/architect/tradeMachine/SelectTeamCard.jsx
src/features/architect/tradeMachine/TradeExceptionManager.jsx
src/features/architect/tradeMachine/TradePlayerRow.jsx
src/features/architect/utils/entitlements/entitlementPickRowProjection.js
src/features/architect/utils/mutationPipeline.js
src/features/architect/utils/seasonManager.js
src/features/architect/utils/tpeLifecycle.js
src/features/architect/utils/tradeContext/tradeContext.js
src/shared/components/EditContractModal.jsx
```

### `safe removable shim`
None. No retained same-path shim currently satisfies all required deletion rules.

### `mixed / structural shim keepers`
These same-path survivors still read as mixed-export or structural/documentation surfaces, so they are not part of a second pure shim deletion batch:

```text
src/features/architect/GMDashboard/components/DraftPositionsInput.jsx
src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx
src/features/architect/tradeMachine/EntitlementPicksList.jsx
src/features/architect/tradeMachine/ValidationStateHeader.jsx
src/features/architect/utils/basicArchitectUtils.js
src/features/architect/utils/capLegalityValidation.js
src/features/architect/utils/capTotals/computeTeamCapTotals.js
src/features/architect/utils/playerRulesProfile/types.js
src/features/architect/utils/tradeContext/legacy/index.js
src/features/architect/utils/tradeContext/types.js
src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js
src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js
src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js
src/features/architect/utils/tradeMachine/utils/hardCapStatus.js
```

Representative reasons:
- `src/features/architect/utils/capLegalityValidation.js` is still a mixed export surface and is still pinned by shim-presence / parity guardrails in `tests/smoke/capLegalityValidationImports.smoke.test.ts` and `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`.
- `src/features/architect/utils/tradeContext/types.js` is still a structural/documentation keeper with an active source-scan allowlist role in `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`.
- `src/features/architect/utils/tradeContext/legacy/index.js` is still an intentional legacy wrapper surface with active guardrail coverage in `src/tests/architect/phase59_legacy_import_guardrail.test.js`.

### `intentional wrapper / barrel / public entrypoint`
Top-level wrappers and public-entry surfaces remain a separate wrapper cleanup lane. Their count re-confirmed at `14` and all remain present:

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

Barrel / public-entry surfaces remain a separate barrel/public-entry cleanup lane. Their count re-confirmed at `13` and all remain present:

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

### `live business logic still in JS/JSX`
These live JS/JSX surfaces remain outside same-path shim deletion. Their count re-confirmed at `19` and all remain present:

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
Deprecated support residue remains separate from same-path shim deletion:

```text
src/features/architect/utils/tradeMachine/validators/index.js
```

### `dead / test-only / zero-runtime-import residue`
Non-runtime residue outside the same-path shim frontier:

```text
src/features/architect/utils/validatePhase21.test.js
```

## 4. Candidate Cleanup Directions
### Candidate 1 — second safe removable shim batch
- Result: empty.
- Why it loses: the re-confirmed `105`-file retained same-path frontier is fully consumed by `72` pure runtime-import required shims, `19` pure compatibility/guardrail-pinned shims, and `14` mixed / structural keepers.
- No retained same-path file currently satisfies the full safe-removal rule set.

### Candidate 2 — conservative keep-retained-shims path
- Keep the retained same-path shim frontier in place because the current repo evidence no longer exposes a meaningful low-risk second deletion batch.
- Why it wins: this path matches the re-confirmed frontier and avoids forcing deletion across live runtime import surfaces, active parity/source-scan guardrails, and mixed/structural keepers.

### Candidate 3 — mixed / wrapper cleanup is separate
- Mixed-shim cleanup is not the same lane as pure same-path shim deletion.
- Wrapper cleanup and barrel/public-entry cleanup are also separate lanes and should not be folded into a second same-path deletion batch.

Decision:
- Candidate 2 wins.
- Candidate 1 is empty after re-confirmation.
- Candidate 3 remains true and stays out of the second-batch recommendation.

## 5. Recommended Next Scope
- No second same-path shim deletion batch now.
- Next stronger category: compatibility-contract / guardrail-retirement audit.
- Mixed-shim cleanup remains a separate downstream lane.
- Wrapper/barrel/public-entry cleanup remains a separate downstream lane.
- Why the retained same-path frontier is still not safe:
  - `72` retained same-path shims still have explicit `.js/.jsx` runtime import pressure in `src/**`
  - `19` more retained same-path shims are still intentionally pinned by compatibility or source-scan guardrails
  - `14` retained same-path shims still function as mixed-export or structural/documentation keepers

## 6. Validation / Inspection Run
Inspection commands used:

```bash
node - <<'NODE' # same-path sibling scan across the audited roots
node - <<'NODE' # wrapper / barrel / live-JS / residue existence checks
node - <<'NODE' # explicit .js/.jsx importer bucketing across src, src/tests, tests, docs, return_packages
node - <<'NODE' # export-shape classification for retained same-path shims
sed -n '2068,2089p' docs/architect/TRADE_MACHINE_MASTER.md
sed -n '1,120p' src/features/architect/utils/capLegalityValidation.js
sed -n '1,140p' src/features/architect/utils/tradeContext/types.js
sed -n '1,80p' src/features/architect/tradeMachine/TradeExceptionManager.jsx
sed -n '1,120p' src/features/architect/GMDashboard/index.jsx
sed -n '1,120p' src/features/architect/GMDashboard/components/index.js
sed -n '1,140p' src/shared/components/TeamLogo.jsx
sed -n '1,220p' tests/smoke/capLegalityValidationImports.smoke.test.ts
sed -n '1,160p' src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js
sed -n '1,220p' src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx
sed -n '1,200p' src/tests/architect/tradeMachineValidationPresentation.compatibility.guardrail.test.ts
sed -n '1,200p' src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx
sed -n '1,180p' src/tests/architect/offseason.devGate.guardrail.test.ts
sed -n '1,280p' src/tests/architect/phase59_legacy_import_guardrail.test.js
npm run typecheck
npm run validate:project
```

What the inspection proved:
- The audited-root retained same-path frontier is still `105`.
- Wrapper, barrel/public-entry, and live-JS counts re-confirmed at `14`, `13`, and `19`.
- The explicit importer scan still leaves no same-path shim in a deletion-ready state.
- The only two retained same-path shims with no resolved code-import pressure are still not safe:
  - `src/features/architect/utils/capLegalityValidation.js` remains a mixed export shim with active shim-presence guardrails.
  - `src/features/architect/utils/tradeContext/types.js` remains a structural/documentation keeper with an active source-scan allowlist role.
- Representative spot checks covered all required evidence classes:
  - required pure shim: `src/features/architect/tradeMachine/TradeExceptionManager.jsx`
  - mixed shim: `src/features/architect/utils/capLegalityValidation.js`
  - structural/documentation shim: `src/features/architect/utils/tradeContext/types.js`
  - wrapper: `src/features/architect/GMDashboard/index.jsx`
  - barrel/public entrypoint: `src/features/architect/GMDashboard/components/index.js`
  - live JS non-shim: `src/shared/components/TeamLogo.jsx`
  - retained compatibility guardrail: `src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx`

Validation results:
- `npm run typecheck`: FAIL (pre-existing / out-of-scope workspace state)
- `npm run validate:project`: PASS

Typecheck failure notes:
- The failures are in non-E114 runtime/test surfaces outside the two allowed documentation artifacts.
- The failing set includes out-of-scope files such as `src/features/architect/capSheet/CapSheet/CapSheet.tsx`, `src/features/architect/utils/mutationPipeline.ts`, `src/features/architect/utils/seasonManager.ts`, `src/features/roster/RosterViewerActions.tsx`, and multiple roster / scouting / architect test files.
- Several failing files also intersect the already-dirty workspace state, confirming that E114 could not truthfully report `typecheck: PASS`.

Intentionally skipped:
- All `npm run test:*` commands were skipped because the prompt forbids broader suites unless a true unresolved ambiguity appears, and static inspection resolved the frontier cleanly.

## 7. Complexity / Risk Assessment
- Second-batch pure shim deletion is now awkward and high-risk relative to the value returned, because the remaining pure same-path shim frontier is fully pinned by runtime imports or active compatibility contracts.
- E113 changed the landscape materially: it removed the first and only meaningful low-risk pure same-path deletion batch, leaving only retained families that now need a different prerequisite lane.
- Mixed-shim cleanup is not the same as pure shim cleanup because mixed-export keepers change module surface behavior even when a same-path TS authority exists.
- Wrapper/barrel cleanup is not the same as pure shim cleanup because it changes top-level import topology and public entrypoints rather than redundant same-path compatibility files.
- The next execution should be small and surgical, but it should be an audit or contract-retirement pass rather than another batched same-path shim deletion pass.

## 8. Master Doc Update
- Appended `### Validator TS Second Shim Cleanup Audit E114 (2026-03-15)` immediately after E113 in `docs/architect/TRADE_MACHINE_MASTER.md`.
- The appended entry states that no meaningful second safe removable same-path shim batch exists from current repo evidence, shim cleanup is not the next default category after E113, the strongest second-batch candidate set is empty, the strongest keep reason is runtime-import plus compatibility/guardrail pressure, mixed/wrapper/barrel cleanup remains a separate lane, `npm run typecheck` failed from pre-existing / out-of-scope workspace state, `npm run validate:project` passed, and the entry points to this E114 return package.
