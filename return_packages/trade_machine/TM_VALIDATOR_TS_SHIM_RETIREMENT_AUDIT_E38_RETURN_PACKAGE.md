# TM_VALIDATOR_TS_SHIM_RETIREMENT_AUDIT_E38 — EXECUTION RETURN PACKAGE

## 1. Summary
- Meaningful shim retirement is practical in this validator-adjacent scope: 6 of the 12 remaining JS surfaces are internal compatibility shims with stable direct replacements already present in the repo, while the other 6 are 4 public entrypoints/barrels and 2 constants/message surfaces.
- The remaining JS files are not all public. The current slice still leans internal-shim-heavy, but the JS that would remain after a cleanup pass is mostly public entrypoints plus the two constants/message surfaces.
- Recommended next step: leave the public entrypoints in JS, and do one grouped internal-shim retirement pass that updates import paths and barrel re-exports without changing validator behavior.

## 2. Scope Used
- This audit used the same 12-file validator-adjacent Trade Machine JS scope carried through E36 and E37:
  - Shim-only compatibility files:
    - `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
    - `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
    - `src/features/architect/utils/tradeMachine/utils/validateInput.js`
    - `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
    - `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
    - `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js`
  - Barrel / public entrypoints:
    - `src/features/architect/utils/tradeMachine/index.js`
    - `src/features/architect/utils/tradeMachine/validators/index.js`
    - `src/features/architect/utils/tradeMachine/rules/index.js`
    - `src/features/architect/utils/tradeMachine/utils/index.js`
  - Constants / message surfaces:
    - `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
    - `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`
- This matches the E36/E37 closeout scope exactly: no new migration slice was opened, and no additional business-logic modules were recounted as in-scope.
- Boundary cases:
  - Direct replacement modules behind the shims were inspected only as evidence for future `from` -> `to` recommendations: `validateCash.js`, `validateReacquisition.js`, `validateEligibility.js`, `matchingValues.js`, `tpeValidation.js`, and `tradeUtilityMisc.js`.
  - Directory imports and `vi.mock(...)` references to `@/features/architect/utils/tradeMachine` were counted as `src/features/architect/utils/tradeMachine/index.js` consumers because they resolve to the public entrypoint.
  - Nearby shared helpers such as `src/features/architect/utils/tradeHelpers.js` and `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js` were not added to the audited scope; they were only inspected where the in-scope TS targets still depend on them.

## 3. Current JS Surface Inventory

### Shim-only compatibility files
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
  - Current classification: `shim-only compatibility file`
  - In-repo importers: yes (4)
  - Importer kinds:
    - compatibility/public surfaces: `src/features/architect/utils/tradeMachine/index.js`, `src/features/architect/utils/tradeMachine/rules/index.js`, `src/features/architect/utils/tradeMachine/validators/index.js`
    - test: `tests/validators/roster.test.js`
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
  - Current classification: `shim-only compatibility file`
  - In-repo importers: yes (6)
  - Importer kinds:
    - runtime code: `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`, `src/features/architect/utils/tradeMachine/rules/miscRules.ts`
    - compatibility/public surfaces: `src/features/architect/utils/tradeMachine/index.js`, `src/features/architect/utils/tradeMachine/rules/index.js`, `src/features/architect/utils/tradeMachine/validators/index.js`
    - test: `tests/trade/cashLedger_season_tracking.test.js`
- `src/features/architect/utils/tradeMachine/utils/validateInput.js`
  - Current classification: `shim-only compatibility file`
  - In-repo importers: yes (4)
  - Importer kinds:
    - compatibility/public surfaces: `src/features/architect/utils/tradeMachine/utils/index.js`, `src/features/architect/utils/tradeMachine/validators/index.js`
    - tests: `tests/trade/input_validation.test.js`, `tests/validators/validateInput.test.ts`
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
  - Current classification: `shim-only compatibility file`
  - In-repo importers: yes (4)
  - Importer kinds:
    - compatibility/public surfaces: `src/features/architect/utils/tradeMachine/utils/index.js`, `src/features/architect/utils/tradeMachine/validators/index.js`
    - tests: `tests/trade/input_validation.test.js`, `tests/validators/normalizeTradeInput.test.ts`
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Current classification: `shim-only compatibility file`
  - In-repo importers: yes (13)
  - Importer kinds:
    - runtime code: `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/utils/stepienUtils.js`, `src/features/architect/utils/tradeHelpers.js`, `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`, `src/features/architect/utils/tradeMachine/rules/basicRules.ts`, `src/features/architect/utils/tradeMachine/rules/draftRules.ts`, `src/features/architect/utils/tradeMachine/rules/validateStepien.ts`, `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js`
    - compatibility/public surfaces: `src/features/architect/utils/tradeMachine/index.js`, `src/features/architect/utils/tradeMachine/utils/index.js`
    - tests: `src/tests/architect/utils/seasonManager.tpe.test.js`, `src/tests/tradeMachine/conveyancePreflight.test.js`, `tests/trade/tradeUtilityMisc_surface.test.js`
- `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js`
  - Current classification: `shim-only compatibility file`
  - In-repo importers: yes (4)
  - Importer kinds:
    - compatibility/public surfaces: `src/features/architect/utils/tradeMachine/utils/index.js`, `src/features/architect/utils/tradeMachine/validators/index.js`
    - tests: `tests/newSchemaValidation.test.js`, `tests/trade/tradeKicker_zeroGuarantee.test.js`

### Barrel / public entrypoints
- `src/features/architect/utils/tradeMachine/index.js`
  - Current classification: `barrel / public entrypoint`
  - In-repo importers: yes (23 import references across 21 files)
  - Importer kinds:
    - runtime code: `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/utils/tradeContext/tradeContext.js`, `src/features/architect/utils/tradeManager.js`
    - tests and compatibility mocks: `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.js`, `src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js`, `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js`, `src/tests/architect/signAndTrade.test.js`, `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`, `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx`, `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx`, `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts`, `src/tests/trade/goldenTrades.test.js`, `tests/architect/e2e-workflows.test.js`, `tests/architect/integration.test.js`, `tests/architect/tradeManager.test.js`, `tests/capSettingsProvider.test.js`, `tests/signAndTradeAggregation.test.js`, `tests/trade/draftRules_surface.test.ts`, `tests/trade/secondApronBoundary.test.js`, `tests/tradeValidator.test.js`
      - `src/tests/architect/signAndTrade.test.js` and `tests/architect/tradeManager.test.js` each contribute both a direct import reference and a `vi.mock(...)` reference.
    - smoke test: `tests/smoke/imports.smoke.test.js`
- `src/features/architect/utils/tradeMachine/validators/index.js`
  - Current classification: `barrel / public entrypoint`
  - In-repo importers: yes (4)
  - Importer kinds:
    - tests: `tests/validators/normalizeTradeInput.test.ts`, `tests/validators/roster.test.js`, `tests/validators/validateInput.test.ts`
    - smoke test: `tests/smoke/imports.smoke.test.js`
- `src/features/architect/utils/tradeMachine/rules/index.js`
  - Current classification: `barrel / public entrypoint`
  - In-repo importers: yes (1)
  - Importer kinds:
    - smoke test: `tests/smoke/imports.smoke.test.js`
- `src/features/architect/utils/tradeMachine/utils/index.js`
  - Current classification: `barrel / public entrypoint`
  - In-repo importers: yes (1)
  - Importer kinds:
    - smoke test: `tests/smoke/imports.smoke.test.js`

### Constants / message surfaces
- `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
  - Current classification: `constants / config / message surface`
  - In-repo importers: yes (6)
  - Importer kinds:
    - runtime code: `src/features/architect/utils/capRulesProfile/capRulesProfile.ts`, `src/features/architect/utils/cbaConstants.js`, `src/features/architect/utils/tradeMachine/rules/basicRules.js`, `src/features/architect/utils/tradeMachine/rules/basicRules.ts`, `src/features/architect/utils/tradeMachine/utils/matchingValues.ts`
    - test: `src/tests/architect/capTotals/incompleteRosterCharge.test.js`
- `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`
  - Current classification: `constants / config / message surface`
  - In-repo importers: yes (9)
  - Importer kinds:
    - runtime code: `src/features/architect/utils/tradeMachine/rules/basicRules.ts`, `src/features/architect/utils/tradeMachine/rules/validateAggregation.ts`, `src/features/architect/utils/tradeMachine/rules/validateCash.ts`, `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.ts`, `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.ts`
    - tests: `src/tests/trade/secondApron_SSOT_guardrail.test.js`, `tests/trade/basicRules.test.ts`, `tests/trade/validateAggregation.test.ts`, `tests/tradeValidatorEdgeCases.test.js`

## 4. Shim Retirement Assessment
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
  - Assessment: `can likely be retired after import updates`
  - Why: the file is a pure re-export to `validateRoster.ts`, and every current importer is either a barrel surface or a direct test.
  - Import updates required: yes. All 4 import sites would need to move to `validateRoster.ts`.
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
  - Assessment: `can likely be retired after import updates`
  - Why: the file is still pure compatibility-only, but it remains in active use because it bundles 3 exports that now live in `validateCash.js`, `validateReacquisition.js`, and `validateEligibility.js`.
  - Import updates required: yes. Removing or bypassing it requires split-path updates across runtime code, barrels, and one direct test.
- `src/features/architect/utils/tradeMachine/utils/validateInput.js`
  - Assessment: `can likely be retired after import updates`
  - Why: the file is a pure re-export to `validateInput.ts`, with no runtime consumers outside compatibility barrels and tests.
  - Import updates required: yes. All 4 import sites would need to move to `validateInput.ts`.
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
  - Assessment: `can likely be retired after import updates`
  - Why: the file is a pure re-export to `normalizeTradeInput.ts`, with no runtime consumers outside compatibility barrels and tests.
  - Import updates required: yes. All 4 import sites would need to move to `normalizeTradeInput.ts`.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Assessment: `can likely be retired after import updates`
  - Why: the host file is still pure compatibility-only, and every referenced symbol already has a stable direct home in either `tpeValidation.js` or `tradeUtilityMisc.js`.
  - Import updates required: yes. This is the highest-touch shim in the scope because the replacement is symbol-specific rather than a single path swap.
- `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js`
  - Assessment: `can likely be retired after import updates`
  - Why: the file is a deprecated wrapper over the canonical `matchingValues.js` surface, and its current consumers are barrels/tests only.
  - Import updates required: yes. All 4 import sites would need to move to `matchingValues.js`.
- `src/features/architect/utils/tradeMachine/index.js`
  - Assessment: `public entrypoint that should probably remain`
  - Why: it has live runtime consumers plus a wide test/mock footprint; keeping the JS public API stable is lower risk than removing this surface.
  - Import updates required: not as a removal target. A future shim-retirement pass should only change its internal re-export lines where they currently point at internal shims.
- `src/features/architect/utils/tradeMachine/validators/index.js`
  - Assessment: `public entrypoint that should probably remain`
  - Why: current usage is test/smoke-only, but it is an explicit backwards-compatibility entrypoint and still exercised.
  - Import updates required: not as a removal target. A future pass should update its internal re-export lines away from internal shims.
- `src/features/architect/utils/tradeMachine/rules/index.js`
  - Assessment: `public entrypoint that should probably remain`
  - Why: current in-repo usage is smoke-only, but it is still a public barrel surface and no evidence was found that deleting it would be meaningfully safer than keeping it.
  - Import updates required: not as a removal target. A future pass can update its internal re-exports away from shim files.
- `src/features/architect/utils/tradeMachine/utils/index.js`
  - Assessment: `public entrypoint that should probably remain`
  - Why: current in-repo usage is smoke-only, but it is still a public barrel surface and a natural place to preserve compatibility after internal shims are retired.
  - Import updates required: not as a removal target. A future pass can update its internal re-exports away from shim files.
- `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
  - Assessment: `constants/message surface not worth retiring in this pass`
  - Why: the file still has multiple live runtime consumers and also feeds `src/features/architect/utils/cbaConstants.js`. Retiring it would broaden E38 into constants refactoring rather than shim cleanup.
  - Import updates required: yes if ever retired, but not recommended in this pass.
- `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`
  - Assessment: `constants/message surface not worth retiring in this pass`
  - Why: 5 runtime rule modules already consume it as the canonical second-apron message source; it is not a compatibility shim.
  - Import updates required: yes if ever retired, but not recommended in this pass.

## 5. Batch Cleanup Opportunities

### Group A — Direct one-target shim bypasses
- Files involved: `rules/validateRoster.js`, `utils/validateInput.js`, `utils/normalizeTradeInput.js`, `utils/computeMatchingValues.js`
- Import/path changes that could be updated together in a future pass:
  - `src/features/architect/utils/tradeMachine/index.js`: `./rules/validateRoster.js` -> `./rules/validateRoster.ts`
  - `src/features/architect/utils/tradeMachine/rules/index.js`: `./validateRoster.js` -> `./validateRoster.ts`
  - `src/features/architect/utils/tradeMachine/validators/index.js`: `../rules/validateRoster.js` -> `../rules/validateRoster.ts`
  - `tests/validators/roster.test.js`: `@/features/architect/utils/tradeMachine/rules/validateRoster.js` -> `@/features/architect/utils/tradeMachine/rules/validateRoster.ts`
  - `src/features/architect/utils/tradeMachine/utils/index.js`: `./validateInput.js` -> `./validateInput.ts`
  - `src/features/architect/utils/tradeMachine/validators/index.js`: `../utils/validateInput.js` -> `../utils/validateInput.ts`
  - `tests/trade/input_validation.test.js`: `@/features/architect/utils/tradeMachine/utils/validateInput.js` -> `@/features/architect/utils/tradeMachine/utils/validateInput.ts`
  - `tests/validators/validateInput.test.ts`: `@/features/architect/utils/tradeMachine/utils/validateInput.js` -> `@/features/architect/utils/tradeMachine/utils/validateInput.ts`
  - `src/features/architect/utils/tradeMachine/utils/index.js`: `./normalizeTradeInput.js` -> `./normalizeTradeInput.ts`
  - `src/features/architect/utils/tradeMachine/validators/index.js`: `../utils/normalizeTradeInput.js` -> `../utils/normalizeTradeInput.ts`
  - `tests/trade/input_validation.test.js`: `@/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js` -> `@/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts`
  - `tests/validators/normalizeTradeInput.test.ts`: `@/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js` -> `@/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts`
  - `src/features/architect/utils/tradeMachine/utils/index.js`: `./computeMatchingValues.js` -> `./matchingValues.js`
  - `src/features/architect/utils/tradeMachine/validators/index.js`: `../utils/computeMatchingValues.js` -> `../utils/matchingValues.js`
  - `tests/newSchemaValidation.test.js`: `@/features/architect/utils/tradeMachine/utils/computeMatchingValues` -> `@/features/architect/utils/tradeMachine/utils/matchingValues.js`
  - `tests/trade/tradeKicker_zeroGuarantee.test.js`: `@/features/architect/utils/tradeMachine/utils/computeMatchingValues.js` -> `@/features/architect/utils/tradeMachine/utils/matchingValues.js`
- Risk: low. Each shim already forwards to one stable direct target, and none of these files currently serve as live runtime aggregation points.
- Execution shape: these can be handled together in one future batch.

### Group B — `eligibilityRules.js` split-shim bypass
- Files/imports involved:
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`: `validateCash` from `../rules/eligibilityRules.js` -> `../rules/validateCash.js`; `validateReacquisition` from `../rules/eligibilityRules.js` -> `../rules/validateReacquisition.js`
  - `src/features/architect/utils/tradeMachine/rules/miscRules.ts`: `validateCash` from `./eligibilityRules.js` -> `./validateCash.js`
  - `src/features/architect/utils/tradeMachine/index.js`: `validateCash` export from `./rules/eligibilityRules.js` -> `./rules/validateCash.js`
  - `src/features/architect/utils/tradeMachine/rules/index.js`: replace `export * from './eligibilityRules.js'` with direct re-exports from `./validateCash.js`, `./validateReacquisition.js`, and `./validateEligibility.js`
  - `src/features/architect/utils/tradeMachine/validators/index.js`: replace `../rules/eligibilityRules.js` exports with direct re-exports from `../rules/validateCash.js`, `../rules/validateReacquisition.js`, and `../rules/validateEligibility.js`
  - `tests/trade/cashLedger_season_tracking.test.js`: `@/features/architect/utils/tradeMachine/rules/eligibilityRules.js` -> `@/features/architect/utils/tradeMachine/rules/validateCash.js`
- Risk: low to moderate. The mapping is deterministic, but the single shim currently bundles 3 surfaces, so the future pass needs careful export-line updates rather than a blind path swap.
- Execution shape: still batchable in the same future pass as Group A.

### Group C — `tradeUtilities.js` split-shim bypass
- Files/imports involved:
  - `src/features/architect/utils/mutationPipeline.js`: `@/features/architect/utils/tradeMachine/utils/tradeUtilities` -> `@/features/architect/utils/tradeMachine/utils/tpeValidation.js`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`: `../utils/tradeUtilities.js` -> `../utils/tpeValidation.js`
  - `src/features/architect/utils/tradeMachine/rules/basicRules.ts`: `@/features/architect/utils/tradeMachine/utils/tradeUtilities.js` -> `@/features/architect/utils/tradeMachine/utils/tpeValidation.js`
  - `src/tests/architect/utils/seasonManager.tpe.test.js`: `@/features/architect/utils/tradeMachine/utils/tradeUtilities` -> `@/features/architect/utils/tradeMachine/utils/tpeValidation.js`
  - `src/features/architect/utils/stepienUtils.js`: `@/features/architect/utils/tradeMachine/utils/tradeUtilities.js` -> `@/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js`
  - `src/features/architect/utils/tradeHelpers.js`: `isPriorYearTPE` import moves to `@/features/architect/utils/tradeMachine/utils/tpeValidation.js`; `isMeaningfulProtection` re-export moves to `@/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js`
  - `src/features/architect/utils/tradeMachine/rules/draftRules.ts`: `../utils/tradeUtilities.js` -> `../utils/tradeUtilityMisc.js`
  - `src/features/architect/utils/tradeMachine/rules/validateStepien.ts`: `@/features/architect/utils/tradeMachine/utils/tradeUtilities.js` -> `@/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js`
  - `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js`: `./tradeUtilities.js` -> `./tradeUtilityMisc.js`
  - `src/features/architect/utils/tradeMachine/index.js`: `./utils/tradeUtilities.js` re-exports -> direct re-exports from `./utils/tradeUtilityMisc.js`
  - `src/features/architect/utils/tradeMachine/utils/index.js`: replace the current `export * from './tradeUtilities.js'` lines with direct re-exports from `./tpeValidation.js` and `./tradeUtilityMisc.js`
  - `src/tests/tradeMachine/conveyancePreflight.test.js`: `@/features/architect/utils/tradeMachine/utils/tradeUtilities.js` -> `@/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js`
  - `tests/trade/tradeUtilityMisc_surface.test.js`: no 1:1 import swap; the test would need to be rewritten or removed because it currently exists to prove parity between the shim and `tradeUtilityMisc.js`
- Risk: moderate but still contained. This is the highest-touch future cleanup in the audited scope because the shim currently fronts two different direct modules and one test is explicitly shim-specific.
- Execution shape: still looks batchable in one future pass because every symbol already has an unambiguous replacement target.

### Non-candidates in this pass
- `src/features/architect/utils/tradeMachine/index.js`, `src/features/architect/utils/tradeMachine/validators/index.js`, `src/features/architect/utils/tradeMachine/rules/index.js`, and `src/features/architect/utils/tradeMachine/utils/index.js` should remain as JS public entrypoints; only their internal re-exports need future cleanup.
- `src/features/architect/utils/tradeMachine/constants/cbaConstants.js` and `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js` are active constants/message surfaces, not internal shims, and should not be part of the next cleanup batch.

## 6. Validation / Inspection Run
- Files changed:
  - `return_packages/trade_machine/TM_VALIDATOR_TS_SHIM_RETIREMENT_AUDIT_E38_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- Inspection commands and what they proved:
  - `sed -n ...` across the E36/E37 return packages, `docs/architect/TRADE_MACHINE_MASTER.md`, the 12 in-scope JS files, and the direct replacement modules behind those shims
    - Proved the current file contents, verified which files are pure re-export shims, and confirmed that the E36/E37 scope still matches the current repo.
  - `node - <<'NODE' ...`
    - Ran a resolved importer inventory across `src/` and `tests/` for `import`, `export ... from`, dynamic `import()`, and `require()` references to the 12 in-scope files.
    - Result: produced the importer counts and importer-type breakdowns recorded in Sections 3-5.
  - `node - <<'NODE' ...` plus targeted `rg -n ...`
    - Added raw-specifier coverage for `vi.mock(...)` / directory-path references, especially `@/features/architect/utils/tradeMachine`.
    - Result: confirmed that `src/features/architect/utils/tradeMachine/index.js` still has a wider compatibility/test footprint than the resolved-import graph alone would show.
  - `rg -n "from ...\\.ts"` plus `cat tsconfig.json`
    - Proved that direct `.ts` imports already exist in the repo and that `moduleResolution: "bundler"` supports recommending future `.ts` target imports where a shim is removed.
- Validation commands actually run:
  - `npm run typecheck`
    - Result: PASS
  - `npm run validate:project`
    - Result: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - Full-suite commands
- Why they were skipped:
  - E38 changed documentation only and did not rewrite any runtime imports or logic. Static importer inspection plus the required typecheck/project-validation commands were sufficient to answer the shim-retirement questions truthfully.

## 7. Recommended Next Step
- Recommendation: `leave public entrypoints in JS but retire internal shims`
- Why this is the right next move from the actual repo state:
  - all 6 in-scope internal shims are now pure compatibility-only surfaces with verified direct replacement targets
  - the 4 JS barrels still serve as public/compatibility entrypoints and are safer to keep while their internal re-exports are cleaned up
  - the 2 JS constants/message surfaces are active shared sources, not dead compatibility layers
- Likely execution complexity: `one batch pass`
  - The importer graph is not tiny, but it is still tightly bounded: 6 internal shim files, deterministic replacement targets, and no need for new business-logic migration.
  - The only meaningfully more complex slice is `tradeUtilities.js`, and even that shim now resolves cleanly into two direct target modules. The graph does not justify splitting into many micro-passes.

## 8. Master Doc Update
- Added one indexed `Validator TS Shim Retirement Audit E38 (2026-03-10)` entry to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that meaningful shim retirement is practical in the validator-adjacent E36/E37 scope because 6 remaining JS files are internal compatibility shims with stable replacements.
- Recorded that the JS surfaces that should remain after cleanup are primarily the 4 public entrypoints plus the 2 constants/message surfaces.
- Recorded the evidence-based next step: keep the public entrypoints in JS and retire the internal shims in one grouped future execution pass.
- `Last updated` already matched `2026-03-10`, so no header-date change was required.
