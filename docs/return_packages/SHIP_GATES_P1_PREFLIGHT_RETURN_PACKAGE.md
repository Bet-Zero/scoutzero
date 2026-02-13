# SHIP_GATES_P1 — PREFLIGHT RETURN PACKAGE

Date: 2026-02-12  
Mode: Discovery-only (no functional code changes)

## Executive Summary

- `npm run test -- --run` fails with **76 failed tests** across **22 failed files** (2895 total tests, 1239 total suites).
- `npm run validate:project` fails with **3 missing required directories**.
- CI is aligned with local gates: `ci.yml` runs both `npm run test -- --run` and `npm run validate:project` on Node 18.
- Most failures look like pre-existing baseline debt; a smaller cluster is **likely** tied to currently modified Architect/Trade/Entitlement files.

## A) Test Suite Failure Inventory

### Totals

- Failed files: **22**
- Failed tests: **76**
- Passed tests: **2819**

### Failed test files (with failed test counts)

1. `tests/computeTeamCapTotals.test.js` (21)
2. `tests/architect/seasonManager.test.js` (10)
3. `src/tests/trade/TradeValidationGating.guardrail.test.jsx` (10)
4. `src/tests/architect/signAndTrade.test.js` (6)
5. `tests/newSchemaValidation.test.js` (3)
6. `tests/entitlements/entitlementPickRowProjection.test.js` (3)
7. `tests/architect/renounceRights.test.js` (2)
8. `tests/architect/tradeManager.test.js` (2)
9. `tests/entitlements/entitlementTerms.test.ts` (2)
10. `tests/validators/stepienEntitlements.test.js` (2)
11. `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.js` (2)
12. `src/tests/architect/pickRightWizard.test.tsx` (2)
13. `src/tests/trade/staleValidationFix.test.js` (2)
14. `tests/salaryMatchingUnification.test.js` (1)
15. `tests/tradeValidatorEdgeCases.test.js` (1)
16. `tests/architect/integration.test.js` (1)
17. `tests/architect/offerSheetPersistence.test.js` (1)
18. `tests/architect/offerSheetResolution.test.js` (1)
19. `tests/trade/roster_twoWay_enforcement.test.js` (1)
20. `tests/trade/tpe_creation_expiry_usage.test.js` (1)
21. `src/tests/architect/entitlementEditorModal.test.tsx` (1)
22. `src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js` (1)

### Top 10 failure messages grouped by likely root cause

1. **21** — Missing mocked export: `yearToSeasonKey` from `capSettingsProvider`
2. **19** — Generic assertion mismatch: `expected false to be true`
3. **11** — UI text assertion misses (e.g., unable to find expected text)
4. **2** — Type expectation mismatch (`'undefined'` vs `'number'`)
5. **2** — Offer-sheet reason code mismatch (`rfa_offer_sheet_resolution_required` vs expected)
6. **2** — Ordering/position assertion mismatch (`expected -1 to be greater than -1`)
7. **2** — Draft key unchanged assertion mismatch (`expected ... not to be ...`)
8. **1** — Apron tier mismatch (`FIRST_APRON` vs `SECOND_APRON`)
9. **1** — Runtime undefined access (`Cannot read properties of undefined (reading 'legal')`)
10. **1** — Length mismatch (`expected length 0 but got 1`)

### Failure inventory table (failed file → bucket → suspected root cause)

| Failed file                                                                                       | Bucket                                | Suspected root cause                                                         | Baseline vs Regression                                                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `tests/computeTeamCapTotals.test.js`                                                              | Mocking/test environment              | Mock missing `yearToSeasonKey` export                                        | Likely baseline (high confidence)                                              |
| `src/tests/trade/TradeValidationGating.guardrail.test.jsx`                                        | UI/component assertions               | Expected UI copy no longer rendered (`Show Validation Details`)              | Likely regression from recent Trade UI changes (medium confidence)             |
| `tests/architect/seasonManager.test.js`                                                           | Data fixtures/schema drift            | Behavioral assertions no longer match actual state transitions               | Likely baseline (medium confidence)                                            |
| `src/tests/architect/signAndTrade.test.js`                                                        | Data fixtures/schema drift            | Sign-and-trade success path assertions no longer align with current behavior | Possible regression from recent FA wiring changes (medium confidence)          |
| `tests/newSchemaValidation.test.js`                                                               | Data fixtures/schema drift            | Schema assumptions vs current fixtures/state differ                          | Likely baseline (medium confidence)                                            |
| `tests/entitlements/entitlementPickRowProjection.test.js`                                         | Data fixtures/schema drift            | Projected entitlement text/value mismatch                                    | Possible regression from entitlement/vacuum work (medium confidence)           |
| `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.js` | Data fixtures/schema drift            | Ordering/parity expectations diverge                                         | Likely baseline (medium confidence)                                            |
| `src/tests/architect/pickRightWizard.test.tsx`                                                    | UI/component assertions               | Missing expected test IDs/templates in wizard UI                             | Likely regression from recent wizard refactors (high confidence)               |
| `src/tests/trade/staleValidationFix.test.js`                                                      | Data fixtures/schema drift            | Validation draft-key behavior changed                                        | Likely regression from recent `useTradeMachine` edits (medium confidence)      |
| `tests/architect/renounceRights.test.js`                                                          | Data fixtures/schema drift            | Boolean outcome mismatch                                                     | Likely baseline (medium confidence)                                            |
| `tests/architect/tradeManager.test.js`                                                            | Data fixtures/schema drift            | Expected numeric fields now undefined                                        | Likely baseline (medium confidence)                                            |
| `tests/entitlements/entitlementTerms.test.ts`                                                     | Data fixtures/schema drift            | Term label mismatch (`Swap worst` vs `Swap`)                                 | Possible regression from entitlement path changes (medium confidence)          |
| `tests/validators/stepienEntitlements.test.js`                                                    | Data fixtures/schema drift            | Missing expected Stepien warning text                                        | Possible regression from entitlement path changes (medium confidence)          |
| `src/tests/architect/entitlementEditorModal.test.tsx`                                             | UI/component assertions               | Missing expected `data-testid` element                                       | Possible regression from entitlement UI changes (medium confidence)            |
| `src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js`                                      | Data fixtures/schema drift            | Expected context field is null                                               | Likely baseline (medium confidence)                                            |
| `tests/architect/integration.test.js`                                                             | Data fixtures/schema drift            | Expected numeric field undefined                                             | Likely baseline (low-medium confidence)                                        |
| `tests/architect/offerSheetPersistence.test.js`                                                   | Data fixtures/schema drift            | Offer-sheet status reason mismatch                                           | Possible regression from recent offer-sheet action changes (medium confidence) |
| `tests/architect/offerSheetResolution.test.js`                                                    | Data fixtures/schema drift            | Offer-sheet status reason mismatch                                           | Possible regression from recent offer-sheet action changes (medium confidence) |
| `tests/salaryMatchingUnification.test.js`                                                         | Data fixtures/schema drift            | Apron tier expectation mismatch                                              | Likely baseline (medium confidence)                                            |
| `tests/trade/roster_twoWay_enforcement.test.js`                                                   | Data fixtures/schema drift            | Missing expected violation message                                           | Likely baseline (medium confidence)                                            |
| `tests/trade/tpe_creation_expiry_usage.test.js`                                                   | Time/date randomness / nondeterminism | Year parsing/derivation resolves `NaN` in one path                           | Possible regression, could also be fixture drift (low confidence)              |
| `tests/tradeValidatorEdgeCases.test.js`                                                           | Other                                 | Runtime undefined access in edge-case branch                                 | Likely baseline (low-medium confidence)                                        |

### Bucket counts

- Data fixtures/schema drift: **16 files**
- UI/component assertions: **3 files**
- Mocking/test environment: **1 file**
- Time/date randomness / nondeterminism: **1 file**
- Other: **1 file**
- Firestore emulator/networking: **0 files**
- Imports/pathing: **0 files**

### Fastest path to green (highest leverage ordering)

1. **Mocking/test environment first**: fix `capSettingsProvider` mock export (`yearToSeasonKey`) → clears **21 failures in 1 file**.
2. **UI assertion drift second**: normalize key UI selectors/text (`TradeValidationGating`, `PickRightWizard`, `EntitlementEditorModal`) → likely clears **13 failures**.
3. **Entitlement/offer-sheet behavioral expectations third**: reconcile changed business outputs vs tests (`entitlementTerms`, `stepienEntitlements`, `offerSheet*`, `entitlementPickRowProjection`) → cascade potential across multiple files.
4. **Residual value/state mismatches**: season/trade manager/integration edge assertions.

Single-root-cause cascade candidates:

- Missing mock export (`yearToSeasonKey`) is a direct single-source cascade.
- Recent entitlement/wizard/trade-machine wiring likely drives a multi-file cascade in entitlement + offer-sheet tests.

## B) `validate:project` Failure Analysis

### What failed

Validator: `scripts/validate-project-schema.ts` using `project.schema.json` `directories.required`.

Missing required directories:

1. `player-scrape/contracts/output`
2. `player-scrape/contracts/working`
3. `team-scrape/shared/firestore_staging/output/merged`

### Why these directories are required (per schema intent)

- `player-scrape/contracts/output`: canonical output target for player contract scrape/parse artifacts.
- `player-scrape/contracts/working`: intermediate working directory used by fetch/parse scripts.
- `team-scrape/shared/firestore_staging/output/merged`: merged team staging output path in team pipeline.

### Create vs ignore vs remove-from-rule recommendation

Recommended repo-level approach (no implementation yet):

1. **Short-term gate unblocking:** auto-create these directories during validation/bootstrap (e.g., `mkdir -p`) before strict checks.
2. **Schema hygiene follow-up:** move clearly generated/runtime-only directories from `directories.required` to an optional/generated list, while keeping source/script directories required.
3. **CI consistency:** if strict required rules remain, ensure CI explicitly creates these dirs before `npm run validate:project`.

Reasoning: these are generated/output-style paths and empty dirs are brittle in git workflows; strict existence checks create false negatives unless bootstrapped.

## C) CI / Local Consistency

### CI commands currently run

From `.github/workflows/ci.yml`:

- `npm ci` (with `PUPPETEER_SKIP_DOWNLOAD=true`)
- `npm run typecheck` (continue-on-error)
- `npm run test -- --run`
- `npm run validate:project`

From `.github/workflows/audit.yml`:

- `npm ci`
- `npm run test -- --run`

From `.github/workflows/player-scrape-regression.yml`:

- `npm ci`
- `npm run typecheck`
- `npm run regress`

### Node/tooling assumptions

- CI pins Node **18** (`actions/setup-node@v4` with `node-version: 18`)
- `package.json` engine: `node >=18.17`

Conclusion: current preflight failures are not primarily Node-version drift; they are test expectation/mocking drift plus repo hygiene (missing required dirs).

## Top 3 root causes likely to fix many failures

1. **Mock contract mismatch in `computeTeamCapTotals` tests** (`yearToSeasonKey` export missing).
2. **UI assertion drift** (text/test-id expectations no longer match rendered components).
3. **Entitlement/offer-sheet behavior expectation drift** after recent Architect/Trade/FA changes.

## Recommended Execution Scope (phased)

1. **Phase 1 — Hygiene gates**: stabilize `validate:project` by bootstrapping missing dirs or relaxing generated-dir strictness.
2. **Phase 2 — Test infra/mocks**: fix high-cascade mock export mismatch.
3. **Phase 3 — UI test realignment**: update brittle text/test-id assertions to current UI contract.
4. **Phase 4 — Entitlement/offer-sheet expectation audit**: align tests vs intended post-change behavior; explicitly mark true regressions.
5. **Phase 5 — Residual edge-case cleanup**: close remaining one-off logic/date/edge failures.

## Notes / Confidence

- Confidence is high on counts and missing-dir failures.
- Regression attribution is moderate because multiple large feature edits are currently unstaged; I flagged likely regressions conservatively where failing files overlap those edited areas.
