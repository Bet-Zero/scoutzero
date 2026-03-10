# TM_VALIDATOR_TS_CLOSEOUT_AUDIT_E36 — EXECUTION RETURN PACKAGE

## 1. Summary
- The validator-adjacent Trade Machine migration scope used in E34/E35 is functionally complete for live JS business logic: no remaining in-scope `.js` files currently contain live business logic.
- The E35 "0 remaining live JS business-logic holdouts" claim is **CONFIRMED** for the same scope.
- Recommended next step: **do a shim/barrel normalization pass**. This is optional and low-risk because the remaining JS in this slice is compatibility/barrel/constants-only; the main leftover caveats are stale export paths in `rules/index.js` and `utils/index.js`.

## 2. Scope Definition Used
- This audit used the same validator-adjacent scope carried forward in E34/E35: the post-migration remaining-JS inventory around `rules/validateRoster.ts`, `utils/validateInput.ts`, `utils/normalizeTradeInput.ts`, the validator/public barrels, and the two trade-machine constants/message surfaces.
- Starting point: the 12-file E35 inventory claim.
- Verification method: compared the E34/E35 return packages and the E35 master-doc entry against the current contents and current in-repo import graph for:
  - `rules/validateRoster.ts`
  - `utils/validateInput.ts`
  - `utils/normalizeTradeInput.ts`
  - `validators/index.js`
  - `index.js`
  - the six named compatibility-host `.js` files
- Result: no omitted in-scope JS files were found. The same 12-file inventory still describes this narrow E34/E35 slice.
- Ambiguous boundary cases called out explicitly:
  - The broader `src/features/architect/utils/tradeMachine` tree still contains many other `.js` files, but they are outside this audit because E34/E35 already used a narrower slice than the whole tree.
  - `tradeUtilities.js` and `eligibilityRules.js` are compatibility-barrel hybrids. For this audit they are classified as `shim-only compatibility file` because they contain no executable business logic and only preserve stable module paths.
  - `src/features/architect/utils/tradeHelpers.js` and `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js` are imported by the migrated TS helpers, but they remain outside this migration scope and are not counted as in-scope holdouts.

## 3. Remaining JS Inventory
The verified remaining-JS inventory for this E34/E35 scope is unchanged from E35: 12 in-scope files, plus 2 nearby imported JS utilities that remain explicitly out of scope.

### In-scope remaining JS files

| Path | Classification | Why it belongs in that classification |
| --- | --- | --- |
| `src/features/architect/utils/tradeMachine/rules/validateRoster.js` | `shim-only compatibility file` | Single re-export to `validateRoster.ts`; no executable JS logic remains. Still used by direct parity tests and by compatibility barrels. |
| `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js` | `shim-only compatibility file` | Re-export host for `validateCash.js` and `validateReacquisition.js`; immediate targets are JS shims to TS. No executable business logic remains in this file. |
| `src/features/architect/utils/tradeMachine/utils/validateInput.js` | `shim-only compatibility file` | Single re-export to `validateInput.ts`; no executable JS logic remains. Still used by direct tests and compatibility barrels. |
| `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js` | `shim-only compatibility file` | Single re-export to `normalizeTradeInput.ts`; no executable JS logic remains. Still used by direct tests and compatibility barrels. |
| `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` | `shim-only compatibility file` | Aggregating compatibility host that only re-exports `tpeValidation.js` and `tradeUtilityMisc.js`; both are JS shims to TS. No executable JS business logic remains in the host file. |
| `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js` | `shim-only compatibility file` | Deprecated wrapper that only re-exports from `matchingValues.js`, which is itself a JS shim to `matchingValues.ts`. No executable JS business logic remains here. |
| `src/features/architect/utils/tradeMachine/index.js` | `barrel / public entrypoint` | Public Trade Machine API barrel with re-exports only. It still has live `src/` and test consumers, so it remains an active public entrypoint. |
| `src/features/architect/utils/tradeMachine/validators/index.js` | `barrel / public entrypoint` | Compatibility validator barrel with re-exports only. Current in-repo use is test/smoke coverage rather than `src/` runtime consumers, but it remains an active compatibility entrypoint. |
| `src/features/architect/utils/tradeMachine/rules/index.js` | `barrel / public entrypoint` | Rules barrel with re-exports only. No current in-repo `src/` or `tests` consumer was found, but it remains a public/export surface rather than business logic. |
| `src/features/architect/utils/tradeMachine/utils/index.js` | `barrel / public entrypoint` | Utils barrel with re-exports only. No current in-repo `src/` or `tests` consumer was found, but it remains a public/export surface rather than business logic. |
| `src/features/architect/utils/tradeMachine/constants/cbaConstants.js` | `constants / config / message surface` | Exports threshold/config objects plus a simple lookup helper. It supplies shared CBA data; it is not a live validator-business-logic holdout in this migration slice. |
| `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js` | `constants / config / message surface` | Exports canonical second-apron message strings and a formatter only. It is a shared message surface, not validator business logic. |

### Nearby imported JS files explicitly outside this migration scope

| Path | Classification | Why it belongs in that classification |
| --- | --- | --- |
| `src/features/architect/utils/tradeHelpers.js` | `shared utility outside this migration scope` | Live shared architect utility used by `validateInput.ts` and other non-scope consumers. E35 already treated it as outside this narrow validator-adjacent slice. |
| `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js` | `shared utility outside this migration scope` | Canonical architect-wide persistence-contract helper used by `normalizeTradeInput.ts` and other non-scope consumers. It remains outside this narrow validator-adjacent slice. |

## 4. Shim Purity Verification

| Path | Truly shim-only? | Remaining business logic found? | Verification note |
| --- | --- | --- | --- |
| `src/features/architect/utils/tradeMachine/rules/validateRoster.js` | Yes | None | Direct single re-export to `validateRoster.ts`. |
| `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js` | Yes | None | Host file only re-exports `validateCash.js` and `validateReacquisition.js`; both immediate targets are JS shims to TS files. |
| `src/features/architect/utils/tradeMachine/utils/validateInput.js` | Yes | None | Direct single re-export to `validateInput.ts`. |
| `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js` | Yes | None | Direct single re-export to `normalizeTradeInput.ts`. |
| `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` | Yes | None | Aggregating compatibility shim only; re-exports `tpeValidation.js` and `tradeUtilityMisc.js`, and both immediate targets are JS shims to TS files. |
| `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js` | Yes | None | Deprecated wrapper only; re-exports `matchingValues.js`, which is a JS shim to `matchingValues.ts`. |

## 5. Findings
- E35 "0 remaining live JS business-logic holdouts" claim: **CONFIRMED**.
- Files that contradict the claim: none.
- Previously migrated `.js` files in this scope that still contain business logic by mistake: none found.
- Scope/classification drift from E35:
  - No omitted in-scope JS files were found from the actual post-E35 repo state.
  - No listed in-scope file had to be reclassified into `live business-logic holdout`.
  - `tradeUtilities.js` and `eligibilityRules.js` remain best described as compatibility hosts even though their structure is mini-barrel-like.
- Notable caveats:
  - `src/features/architect/utils/tradeMachine/rules/index.js` still exports `./reacquisition.js`, but that file does not exist.
  - `src/features/architect/utils/tradeMachine/utils/index.js` still exports `./pickUtils.js`, but that file does not exist.
  - No current in-repo `src/` or `tests` consumers were found for either of those two barrels, so these stale export paths do not invalidate the E35 zero-holdout claim, but they do support optional barrel normalization.
  - `src/features/architect/utils/tradeMachine/index.js` remains a live public entrypoint in `src/` and tests and should not be treated as dead compatibility surface.
  - `src/features/architect/utils/tradeMachine/validators/index.js` remains exercised by in-repo tests/smoke coverage even though no current `src/` runtime consumer was found.

## 6. Validation Run
- Files changed:
  - `return_packages/trade_machine/TM_VALIDATOR_TS_CLOSEOUT_AUDIT_E36_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- Commands run:
  - `rg --files src/features/architect/utils/tradeMachine | rg '\.js$'`
    - Proved the broader Trade Machine tree still has many `.js` files, so E35's 12-file list had to be validated as a narrow scope claim rather than assumed to cover the whole tree.
    - Result: broader tree still contains many JS files outside this E34/E35 slice.
  - `sed -n ...` inspection passes across the E34/E35 return packages, `docs/architect/TRADE_MACHINE_MASTER.md`, and each candidate in-scope file
    - Proved exact current file contents, whether each file still contains executable business logic, and whether the E34/E35 scope statement still matches the repo.
    - Result: the six named compatibility hosts contain no JS business logic; the remaining in-scope JS files are barrels or constants/message surfaces only.
  - `rg -n ...` import-graph and consumer searches across `src` and `tests`
    - Proved current in-repo consumers, confirmed no omitted in-scope JS files, and surfaced stale barrel exports.
    - Result: `index.js` remains live in `src/` and tests; `validators/index.js` remains used by tests; `rules/index.js` and `utils/index.js` have no current in-repo consumers and each retains one stale export path.
  - `npm run typecheck`
    - Proved the typed validator-adjacent surfaces compile cleanly in the current mixed JS/TS graph.
    - Result: PASS.
  - `npm run validate:project`
    - Proved the repo still satisfies the project schema after this docs-only audit pass.
    - Result: PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E36 made no runtime-code or public-behavior changes. Static file inspection plus the required typecheck/project-validation commands resolved the inventory and shim-purity questions without broader suites.

## 7. Recommended Next Step
- Recommended next step: **do a shim/barrel normalization pass**.
- Why this is the right next step from the actual repo state:
  - no in-scope live JS business logic remains to justify another real TS migration slice
  - the remaining work in this slice is now compatibility/public-surface cleanup
  - the only concrete leftover caveats found by E36 are stale export paths in `rules/index.js` and `utils/index.js`
- This recommendation is optional and low-risk: it is non-business-logic cleanup only.

## 8. Master Doc Update
- Added one indexed E36 closeout-audit entry to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the validator-adjacent Trade Machine migration scope used in E34/E35 is functionally complete for live JS business logic.
- Recorded that the E35 remaining-count claim was **CONFIRMED**.
- Recorded the concise remaining-JS classification: 6 shim-only compatibility files, 4 barrel/public entrypoints, 2 constants/message surfaces, plus 2 nearby imported shared JS utilities that remain outside this migration scope.
- Recorded the recommended next step: optional low-risk shim/barrel normalization pass.
