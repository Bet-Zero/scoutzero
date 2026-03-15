# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E106 — EXECUTION RETURN PACKAGE

## 1. Summary

- Current repo evidence shows the frontier is now `surgical-by-default`.
- Batching no longer wins by default after E105.
- Strongest Lane A target: `src/features/architect/utils/mutationPipeline.js`.
- Strongest Lane B target: the shared-display/support trio:
  - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
  - `src/features/architect/shared/LeagueView/LeagueView.jsx`
  - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
- Final recommended next scope: `src/features/architect/utils/mutationPipeline.js`.
- Chosen lane: `high-risk surgical`.
- Estimated live JS/JSX/TSX business-logic count for the recommended scope: `1`.
- Likely future execution shape: `one named boundary executed in internal sub-arcs`.

## 2. Closed Scope Confirmation

- Current repo evidence does not break closure for any previously completed scope through E105. The following remain closed/complete:
  - E39
  - E41
  - E43/E44
  - E46
  - E48
  - E50
  - E52
  - E54
  - E56/E57
  - E59
  - E61/E62
  - E64
  - E66/E67
  - E69
  - E71
  - E73
  - E75
  - E77
  - E78
  - E80
  - E82
  - E84
  - E86
  - E88
  - E89
  - E91
  - E93
  - E95
  - E97
  - E99
  - E101
  - E103
  - E105
- Same-path `.js/.jsx` files with `.ts/.tsx` authorities remain `TS-backed shim` residue, not reopened live-business-logic winners. That includes the same-path E103, E101, E99, and E97 `.jsx` files plus closed helper shims such as `src/features/architect/utils/seasonManager.js`.
- Top-level re-export stubs, barrels, wrappers, and section shells remain excluded from the live-business-logic winner count unless importer evidence proves they still own unique behavior. Current importer evidence did not prove that for the wrapper/barrel surfaces called out in this audit.

## 3. Candidate Next Scopes

### Current Frontier Classification

- `high-risk state/orchestration hub`
  - `src/features/architect/utils/mutationPipeline.js` - live `4589`-line cross-feature engine exporting `buildWorldMutationEventPayload`, `applyWorldMutation`, and `computeWorldMutation`; importer scans confirm live use from `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`, `src/features/architect/utils/seasonManager.ts`, and broad architect/trade guardrails.
  - `src/features/architect/GMDashboard/GMDashboard.jsx` - live `495`-line dashboard hub that composes world selection, modal surfaces, section shells, and TS-backed state/action hooks.
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx` - live `798`-line world-management hub that still owns create/branch/rename/archive/delete workflow orchestration.
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx` - live `781`-line season-advance wizard that still owns option-decision flow, expiry previews, and season-advance UI orchestration.
  - `src/shared/components/EditContractModal.jsx` - live `1570`-line shared contract-action modal used by `GMDashboard.jsx`, `TradeEditor.tsx`, and `FreeAgentPool.tsx`.
- `live business logic`
  - `src/features/architect/shared/LeagueView/LeagueView.jsx` - live `117`-line route-level load/navigate surface with parallel team loads and cap-total derivation.
  - `src/features/architect/shared/RosterVisual/RosterVisual.jsx` - live `140`-line roster-transform/render surface with player hydration, two-way handling, and roster-slot filling.
  - `src/shared/utils/contracts/contractUtils.js` - live `21`-line shared season-year/years-remaining helper.
  - `src/shared/utils/contracts/seasonNormalizer.js` - live `94`-line shared season parsing/normalization helper.
- `low-risk presentational component`
  - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx` - live `73`-line presentational renderer for warnings/errors inside `EditContractModal.jsx`.
- `TS-backed shim`
  - Same-path E103 `.jsx` shims:
    - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
    - `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
    - `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
  - Same-path E101 `.jsx` shims:
    - `src/features/architect/tradeMachine/CapImpactTiles.jsx`
    - `src/features/architect/tradeMachine/SelectTeamCard.jsx`
    - `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`
    - `src/features/architect/tradeMachine/TradePlayerRow.jsx`
    - `src/features/architect/tradeMachine/EntitlementPicksList.jsx`
    - `src/features/architect/tradeMachine/EntitlementPickRow.jsx`
    - `src/features/architect/tradeMachine/TradeExceptionManager.jsx`
  - Same-path E99 `.jsx` shims:
    - `src/features/architect/tradeMachine/TradePreviewModal.jsx`
    - `src/features/architect/tradeMachine/TradeExportCapture.jsx`
  - Same-path E97 `.jsx` shims:
    - `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
    - `src/features/architect/tradeMachine/ValidationStateHeader.jsx`
    - `src/features/architect/tradeMachine/DataWarningsSection.jsx`
    - `src/features/architect/tradeMachine/FaExceptionTracker.jsx`
    - `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
    - `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
    - `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx`
    - `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx`
    - `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`
  - Additional same-path shim holdouts already backed by TS authorities:
    - `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
    - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
    - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
    - `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
    - `src/features/architect/utils/seasonManager.js`
- `barrel/public entrypoint`
  - `src/features/architect/GMDashboard/index.jsx`
  - `src/features/architect/GMDashboard/components/index.js`
  - `src/shared/utils/contracts/index.js`
- `thin wrapper/deprecated wrapper`
  - `src/features/architect/ValidationWarnings.jsx`
  - `src/features/architect/LeagueView.jsx`
  - `src/features/architect/RosterVisual.jsx`
  - `src/features/architect/GMDashboard/sections/TradeSection.jsx`
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
- `debug/support/monitoring`
  - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
- `dead/scratch/zero-import residue`
  - `src/features/architect/hooks/useCapSheetState.js`
  - `src/features/architect/utils/cashUtils.js`
  - `src/features/architect/utils/freeAgentLogic.js`
  - `src/features/architect/utils/temp_mutation_code.js`
  - `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
  - `src/features/architect/utils/validatePhase21.test.js`
  - `src/features/architect/utils/draftPickUtils.js`
- Zero-import / weak-import residue confirmation:
  - `useCapSheetState.js`, `cashUtils.js`, `freeAgentLogic.js`, `temp_mutation_code.js`, and `enforcementValidation.js` did not surface live runtime importers in the repo scans used for this audit.
  - `validatorFactory.js` and `resolveValidationEntitlements.js` also did not surface live runtime importers in the repo scans used for this audit, which is why they stay classified as support residue instead of next-scope business logic.
  - `draftPickUtils.js` still has only test-backed residue through `src/tests/architect/phase40_secondApron_drift_guardrails.test.js`; current repo evidence did not surface a live runtime importer.

### Candidate A1 - `mutationPipeline.js`

- Lane: `high-risk surgical`
- Live count: `1`
- Scope:
  - `src/features/architect/utils/mutationPipeline.js`
- Why it is serious:
  - It remains the central mutation read/compute/validate/persist engine.
  - It still spans trade, free agency, season advance, offer sheets, persistence, and event payload generation.
  - It is still the broadest remaining cross-feature engine in live JS.
  - Importer scans confirm it remains wired into major orchestrators such as `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` and `src/features/architect/utils/seasonManager.ts`.
- Why it wins:
  - After E105, the repo no longer has a stronger batched low-risk default. The highest-leverage remaining live JS boundary is the mutation engine itself.
  - Delaying this file in favor of a weaker mixed trio would preserve the broadest remaining cross-feature JS hub unchanged.
  - The file is large and risky, but it is now the clearest single next boundary rather than a premature widening move.
- Likely future execution shape:
  - `one named boundary executed in internal sub-arcs`, not a one-shot conversion.

### Candidate A2 - dashboard/world surgical boundary

- Lane: `high-risk surgical`
- Live count: `3`
- Scope:
  - `src/features/architect/GMDashboard/GMDashboard.jsx` (`495` lines)
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx` (`798` lines)
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx` (`781` lines)
- Why it is serious:
  - This is still the other major live JSX cluster near the architect dashboard frontier.
  - `WorldSelector.jsx` and `SeasonAdvanceModal.jsx` each own real orchestration behavior, not just rendering.
- Why it does not beat `mutationPipeline.js`:
  - The cut is weaker. `GMDashboard.jsx` now mainly composes TS-backed hooks and section shells, while the remaining JSX files straddle dashboard/world shell wiring instead of isolating the broadest engine boundary.
  - The cluster still depends on section shells and hook interfaces rather than presenting the single strongest remaining business-logic hub.
  - It remains a real future surgical alternative, but it does not outrank the central mutation engine.

### Candidate A3 - shared contract surgical pocket

- Lane: `high-risk surgical`
- Live count: `3`
- Scope:
  - `src/shared/components/EditContractModal.jsx` (`1570` lines)
  - `src/shared/utils/contracts/contractUtils.js` (`21` lines)
  - `src/shared/utils/contracts/seasonNormalizer.js` (`94` lines)
- Why it is serious:
  - `EditContractModal.jsx` is a large live shared modal with real action/validation/business-rule wiring.
  - The shared contract helpers remain live JS and are still imported outside architect-specific code.
  - Importer scans show the modal still bridges `GMDashboard.jsx`, `TradeEditor.tsx`, and `FreeAgentPool.tsx`.
- Why it does not beat `mutationPipeline.js`:
  - The pocket is real, but it is not low-risk. The `1570`-line modal dominates the boundary and spans several product flows.
  - The two helper files are small and do not create a stronger next-scope boundary than the still-live central mutation engine.
  - This reads as a legitimate future surgical pocket, not the best immediate move.

### Candidate B1 - shared-display/support trio

- Lane: `batched low-risk`
- Live count: `3`
- Scope:
  - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx` (`73` lines)
  - `src/features/architect/shared/LeagueView/LeagueView.jsx` (`117` lines)
  - `src/features/architect/shared/RosterVisual/RosterVisual.jsx` (`140` lines)
- Why it is the strongest Lane B comparator:
  - It is the most coherent remaining lower-risk live group after excluding shims, wrappers, barrels, and dead residue.
  - All three files still own live behavior rather than serving only as same-path compatibility shells.
- Why it loses:
  - The trio is too mixed and too scattered. `ValidationWarnings.jsx` is presentational, `LeagueView.jsx` is a route/load/navigate surface, and `RosterVisual.jsx` does roster hydration and transform work.
  - The files sit in different usage contexts and do not represent a single strong frontier boundary.
  - Delaying `mutationPipeline.js` for this trio no longer has the leverage needed to keep batching alive as the default.

### Candidate B2 - wrapper/support cleanup pockets

- Lane: `batched low-risk`
- Live count: `0` as a true next-scope business-logic winner
- Scope reviewed as explicit non-winners:
  - `src/features/architect/ValidationWarnings.jsx`
  - `src/features/architect/LeagueView.jsx`
  - `src/features/architect/RosterVisual.jsx`
  - `src/features/architect/GMDashboard/sections/TradeSection.jsx`
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - `src/features/architect/GMDashboard/index.jsx`
  - `src/features/architect/GMDashboard/components/index.js`
  - `src/shared/utils/contracts/index.js`
- Why they do not win:
  - These surfaces are wrappers, section shells, shims, or barrels rather than a real live-business-logic next scope.
  - `TradeSection.jsx` is a direct handoff into the already-closed E105 authority.
  - `ValidationWarnings.jsx`, `LeagueView.jsx`, and `RosterVisual.jsx` are backwards-compatible wrapper stubs above the real shared implementations.
  - `GMDashboard/index.jsx`, `GMDashboard/components/index.js`, and `src/shared/utils/contracts/index.js` are export surfaces, not business-logic boundaries.
  - `OffseasonSection.jsx` still owns some section-shell logic, but current repo evidence still reads it as a support shell around existing authorities rather than a stronger next-scope winner than `mutationPipeline.js`.

### Candidate B3 - residual small low-risk pockets

- No additional coherent low-risk batch surfaced after excluding TS-backed shims, wrappers, barrels, debug/support residue, and zero-import residue.

## 4. Recommended Next Scope

- Exact scope name: `src/features/architect/utils/mutationPipeline.js`
- Exact lane: `high-risk surgical`
- Exact estimated live business-logic count: `1`
- Exact reason it wins:
  - It is the broadest remaining cross-feature live JS engine.
  - It still owns the central mutation compute/apply/persist/event-payload path.
  - It remains imported by core orchestrators instead of sitting behind wrapper-only residue.
  - No remaining lower-risk batch is coherent or strong enough to justify delaying it.
- Explicit widening rule:
  - Do not silently widen into other hubs unless a future execution pass proves a real blocker.

## 5. Live JS/JSX/TSX Business-Logic Inventory For Recommended Scope

- In-scope live business logic:
  - `src/features/architect/utils/mutationPipeline.js`
- Explicit exclusions:
  - Dashboard/world hubs:
    - `src/features/architect/GMDashboard/GMDashboard.jsx`
    - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
    - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - Shared contract pocket:
    - `src/shared/components/EditContractModal.jsx`
    - `src/shared/utils/contracts/contractUtils.js`
    - `src/shared/utils/contracts/seasonNormalizer.js`
  - Shared-display/support trio:
    - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
    - `src/features/architect/shared/LeagueView/LeagueView.jsx`
    - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
  - All TS-backed shims:
    - same-path E103 `.jsx` shims
    - same-path E101 `.jsx` shims
    - same-path E99 `.jsx` shims
    - same-path E97 `.jsx` shims
    - `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
    - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
    - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
    - `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
    - `src/features/architect/utils/seasonManager.js`
  - Wrappers and barrels:
    - `src/features/architect/ValidationWarnings.jsx`
    - `src/features/architect/LeagueView.jsx`
    - `src/features/architect/RosterVisual.jsx`
    - `src/features/architect/GMDashboard/sections/TradeSection.jsx`
    - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
    - `src/features/architect/GMDashboard/index.jsx`
    - `src/features/architect/GMDashboard/components/index.js`
    - `src/shared/utils/contracts/index.js`

## 6. Validation / Inspection Run

- Static inspection commands executed:

```bash
rg --files src/features/architect src/shared return_packages/trade_machine docs/architect | rg '\.(js|jsx|ts|tsx|md)$'
sed -n '1,240p' return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_EDITOR_TEAM_CARD_BOUNDARY_E105_RETURN_PACKAGE.md
sed -n '1,260p' return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E104_RETURN_PACKAGE.md
sed -n '1,240p' return_packages/trade_machine/TM_VALIDATOR_TS_GM_WORLD_SUPPORT_FAMILY_E103_RETURN_PACKAGE.md
sed -n '1,220p' return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_TEAM_CARD_LEAF_FAMILY_E101_RETURN_PACKAGE.md
sed -n '1,220p' return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_MACHINE_PREVIEW_EXPORT_FAMILY_E99_RETURN_PACKAGE.md
sed -n '1,260p' return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_MACHINE_VALIDATION_PRESENTATION_E97_RETURN_PACKAGE.md
```

- Result:
  - Confirmed the audit chain through E105.
  - Confirmed E97, E99, E101, E103, and E105 remain closed and that their same-path `.jsx` files now read as compatibility shims rather than reopened live logic.
- Importer and residue scans executed:

```bash
rg -n "mutationPipeline|TradeEditor|TradeTeamCard|GMDashboard|WorldSelector|SeasonAdvanceModal|EditContractModal" src tests --glob '!**/*.md'
rg -n "contractUtils|seasonNormalizer|ValidationWarnings|LeagueView|RosterVisual" src tests --glob '!**/*.md'
rg -n "useCapSheetState|cashUtils|freeAgentLogic|temp_mutation_code|enforcementValidation|validatePhase21\.test|draftPickUtils|validatorFactory|resolveValidationEntitlements|architectCore" src tests --glob '!**/*.md'
rg -n "mutationPipeline" src/features/architect/GMDashboard/hooks/useArchitectActions.ts src/features/architect/utils/seasonManager.ts src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx tests/architect tests/trade
rg -n "from ['\"].*(useCapSheetState|cashUtils|freeAgentLogic|temp_mutation_code|enforcementValidation|draftPickUtils|validatorFactory|resolveValidationEntitlements)['\"]|require\(.*(useCapSheetState|cashUtils|freeAgentLogic|temp_mutation_code|enforcementValidation|draftPickUtils|validatorFactory|resolveValidationEntitlements)" src tests
rg -n "from ['\"].*(EditContractModal|ValidationWarnings|LeagueView|RosterVisual|shared/utils/contracts/contractUtils|shared/utils/contracts/seasonNormalizer)['\"]" src tests
```

- Result:
  - Confirmed `mutationPipeline.js` is still imported by `useArchitectActions.ts`, `seasonManager.ts`, and broad architect/trade coverage.
  - Confirmed `EditContractModal.jsx` still sits in a shared contract pocket spanning dashboard, trade, and free agency.
  - Confirmed the shared-display/support trio remains live but scattered.
  - Confirmed `draftPickUtils.js` has only test-backed residue and the other named residue files do not surface live runtime importer evidence in current repo scans.
- Candidate-file and shim inspection commands executed:

```bash
wc -l src/features/architect/utils/mutationPipeline.js src/features/architect/GMDashboard/GMDashboard.jsx src/features/architect/GMDashboard/components/WorldSelector.jsx src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx src/shared/components/EditContractModal.jsx src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx src/features/architect/shared/LeagueView/LeagueView.jsx src/features/architect/shared/RosterVisual/RosterVisual.jsx src/shared/utils/contracts/contractUtils.js src/shared/utils/contracts/seasonNormalizer.js
sed -n '1,220p' src/features/architect/utils/mutationPipeline.js
rg -n "^export |function |const .* = .*=>|class " src/features/architect/utils/mutationPipeline.js
sed -n '1,240p' src/features/architect/GMDashboard/GMDashboard.jsx
sed -n '1,240p' src/features/architect/GMDashboard/components/WorldSelector.jsx
sed -n '1,260p' src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx
sed -n '1,260p' src/shared/components/EditContractModal.jsx
sed -n '1,220p' src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx
sed -n '1,220p' src/features/architect/shared/LeagueView/LeagueView.jsx
sed -n '1,220p' src/features/architect/shared/RosterVisual/RosterVisual.jsx
sed -n '1,220p' src/shared/utils/contracts/contractUtils.js
sed -n '1,220p' src/shared/utils/contracts/seasonNormalizer.js
sed -n '1,80p' src/features/architect/GMDashboard/components/OfferSheetList.jsx src/features/architect/GMDashboard/sections/FreeAgencySection.jsx src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx src/features/architect/offseason/OffseasonTab/OptionManager.jsx src/features/architect/utils/seasonManager.js src/features/architect/tradeMachine/ValidationDetailsPanel.jsx src/features/architect/tradeMachine/ValidationStateHeader.jsx src/features/architect/tradeMachine/DataWarningsSection.jsx src/features/architect/tradeMachine/FaExceptionTracker.tsx
sed -n '1,120p' src/features/architect/GMDashboard/index.jsx src/features/architect/GMDashboard/components/index.js src/shared/utils/contracts/index.js
sed -n '1,120p' src/features/architect/tradeMachine/TradeSummaryPanel.jsx src/features/architect/tradeMachine/TradeLegalChecker.jsx src/features/architect/tradeMachine/TradeExceptionDashboard.jsx src/features/architect/tradeMachine/TradeSalaryCalculator.jsx src/features/architect/tradeMachine/TradeReceiptPanel.jsx
sed -n '1,80p' src/features/architect/ValidationWarnings.jsx src/features/architect/LeagueView.jsx src/features/architect/RosterVisual.jsx src/features/architect/GMDashboard/sections/TradeSection.jsx src/features/architect/GMDashboard/sections/OffseasonSection.jsx
sed -n '1,80p' src/features/architect/hooks/useCapSheetState.js src/features/architect/utils/cashUtils.js src/features/architect/utils/freeAgentLogic.js src/features/architect/utils/temp_mutation_code.js src/features/architect/utils/tradeMachine/rules/enforcementValidation.js src/features/architect/utils/validatePhase21.test.js src/features/architect/utils/draftPickUtils.js src/features/architect/utils/tradeMachine/engine/validatorFactory.js src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js
```

- Result:
  - Confirmed the line-count comparison used in this audit:
    - `mutationPipeline.js`: `4589`
    - `GMDashboard.jsx`: `495`
    - `WorldSelector.jsx`: `798`
    - `SeasonAdvanceModal.jsx`: `781`
    - `EditContractModal.jsx`: `1570`
    - `ValidationWarnings.jsx`: `73`
    - `LeagueView.jsx`: `117`
    - `RosterVisual.jsx`: `140`
    - `src/shared/utils/contracts/contractUtils.js`: `21`
    - `src/shared/utils/contracts/seasonNormalizer.js`: `94`
  - Confirmed the named same-path `.jsx` holdouts are now shim-only compatibility surfaces where expected.
- Validation commands executed:

```bash
npm run typecheck
npm run validate:project
```

- Result:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Broader tests intentionally not run:
  - No broader `npm run test:*` suite was needed because this was a documentation-only scope-selection audit and the frontier question was resolved by static inspection plus the required validation commands.

## 7. Complexity / Risk Assessment

- The frontier has now pivoted to `surgical-by-default`.
- Batching no longer wins by default because the remaining lower-risk live files are either too small, too mixed, too scattered, or too wrapped by shims/barrels to justify delaying the largest remaining live business-logic engine.
- `mutationPipeline.js` beats the best remaining Lane B option because it is still the broadest remaining cross-feature engine and still owns the main mutation read/compute/validate/persist/event-payload path.
- The strongest remaining Lane B option is the shared-display/support trio, but it loses because it is not one coherent business-logic boundary; it mixes one presentational component with two unrelated support surfaces.
- The dashboard/world boundary and shared contract pocket remain real alternatives, but neither beats `mutationPipeline.js`:
  - the dashboard/world cut is weaker and more shell-driven
  - the shared contract pocket is real but dominated by one very large cross-feature modal
- Likely execution shape for the winner:
  - `one named boundary executed in internal sub-arcs`
  - the file is too large and too coupled to treat as a safe one-shot conversion
- Major risks and caveats:
  - compute/apply/persist/event-payload coupling lives in one file
  - the file touches trade, free agency, season advance, offer sheets, persistence, and audit/event generation
  - validation, persistence, and post-state audit guardrails will all have to stay aligned during migration
  - widening into dashboard/world or contract hubs should happen only if a later execution pass proves a real blocker

## 8. Master Doc Update

- Added `### Validator TS Next-Scope Expansion Audit E106 (2026-03-15)` to `docs/architect/TRADE_MACHINE_MASTER.md` immediately after the E105 entry.
- Recorded that:
  - the repo is now `surgical-by-default`
  - batching no longer wins by default
  - the strongest Lane A target is `src/features/architect/utils/mutationPipeline.js`
  - the strongest Lane B target is the shared-display/support trio
  - the final recommended next scope is `src/features/architect/utils/mutationPipeline.js`
  - the chosen lane is `high-risk surgical`
  - the estimated live business-logic count is `1`
  - the likely future execution shape is `one named boundary executed in internal sub-arcs`
  - `npm run typecheck` and `npm run validate:project` both passed
  - no broader `npm run test:*` suite was run because static inspection resolved the scope decision
