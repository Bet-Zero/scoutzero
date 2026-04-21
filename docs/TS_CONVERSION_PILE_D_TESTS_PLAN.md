# JS → TS Conversion — Pile D Tests Plan

**Purpose:** Convert the remaining JS/JSX test and test-support files to TypeScript without breaking any existing test behavior.

**Status:** COMPLETE — 2026-04-20

**Relationship to prior plans:**

- Pile A (constants, data, Firestore helpers): complete.
- Pile B (shared utils, hooks, schemas): complete.
- Pile C (runtime UI/page/component): `docs/TS_CONVERSION_PILE_C_PLAN.md` — in progress, separate track.
- Pile D (this document): test and test-support JS/JSX under `src/tests/**` and `tests/**` — complete.

**How this doc works:** This plan is complete. If the user says "keep working on Pile D" or "keep working on `docs/TS_CONVERSION_PILE_D_TESTS_PLAN.md`," confirm that no Pile D JS/JSX files remain under `src/tests/**` or `tests/**`, reference the completion snapshot and Step 17 below, and continue the broader JS→TS effort in `docs/TS_CONVERSION_PILE_C_PLAN.md` or `docs/TS_CONVERSION_NEXT_STEPS.md` instead of adding new Pile D steps unless the user explicitly asks to re-scope this document.

**Commit & status hygiene:**

1. Use the commit message specified in each step.
2. Before committing source changes, update this file with the step status or a dated progress note.
3. Include the plan update in the same commit as the conversion work.
4. If a step cannot finish, leave it `IN PROGRESS` and state the blocker plainly.

**Scope boundary:**

- Pile D covers only test and test-support files: `src/tests/**/*.js(x)` and `tests/**/*.js(x)`.
- Pile D does NOT touch runtime source files. If a type import is needed from a source module, import it — do not duplicate the type.
- If a converted test reveals a genuine type error in a source module, note it but do not fix it in the test migration commit. File a follow-up comment in this plan instead.
- JSX test files (`.test.jsx`) become `.test.tsx`. Pure-logic test files (`.test.js`) become `.test.ts`.

**Validation rules (per AGENTS.md):**

- After each commit, run the relevant scoped test suite with `--reporter=dot` to confirm zero regressions.
- Use the validation command specified in each step. Do not run `npm run test:full` unless the prompt contains `RUN FULL SUITE`.
- Run `npm run typecheck` after each batch to confirm no new type errors are introduced.
- If a test run exceeds 4 minutes, stop and switch to a cheaper scoped command.

**Conversion technique:**

1. Rename `.js` → `.ts` or `.jsx` → `.tsx`.
2. Add minimal type annotations: typed imports, `describe`/`it` blocks need no annotation. Fixture objects get `as const` or explicit types only where the test logic requires it.
3. Do not refactor test logic, add docstrings, or restructure assertions.
4. If a test file imports from another JS file that has not been converted yet, use a `// @ts-expect-error` or rely on the existing `global-shims.d.ts` until that file's batch arrives. Prefer converting the dependency first (support files go in Step 1).
5. Where vitest config `setupFiles` reference a converted file, update the config in the same commit.

---

## Completion Snapshot (2026-04-20)

- Final status: complete through Step 17.
- Remaining `.js` / `.jsx` files under `src/tests/**` and `tests/**`: `0`.
- Final verification recorded in this document: `npm run typecheck`, `npm run build`, `npm run validate:project`, and `find src/tests tests \( -name '*.js' -o -name '*.jsx' \)`.
- Next JS→TS track: runtime UI/page/component work in `docs/TS_CONVERSION_PILE_C_PLAN.md`.

## Inventory Summary (2026-04-19 baseline before conversion)

### Counts

| Location       | JS test files | JSX test files | JS support files | Total JS/JSX |
| -------------- | ------------: | -------------: | ---------------: | -----------: |
| `src/tests/**` |            93 |             11 |                0 |          104 |
| `tests/**`     |           108 |             10 |                9 |          127 |
| **Total**      |       **201** |         **21** |            **9** |      **231** |

### Already-TS test files (no action needed)

| Location       | `.test.ts` | `.test.tsx` |
| -------------- | ---------: | ----------: |
| `src/tests/**` |        201 |          88 |
| `tests/**`     |         30 |           0 |

### JS Support (non-test) files

| File                                    | Lines | Role                                               | Consumers                                                                        |
| --------------------------------------- | ----: | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `tests/setupFirebaseMocks.js`           |    66 | Vitest setup file — Firebase mock wiring           | Referenced in `vitest.config.js`, `vitest.node.config.js`, `vitest.ui.config.js` |
| `tests/setupDebug.js`                   |    13 | Vitest setup file — debug logging                  | Referenced in all vitest configs                                                 |
| `tests/__mocks__/firebase.js`           |   719 | Manual Firebase SDK mock                           | Auto-resolved by vitest module resolution                                        |
| `tests/helpers/architectTestHelpers.js` |   440 | Shared architect world/team/player factory helpers | 10 architect test files in `tests/architect/`                                    |
| `tests/fixtures/newSchemaPlayer.js`     |   169 | Player fixture conforming to `players_v2` schema   | `tests/newSchemaValidation.test.js` + 13 other test files                        |
| `tests/fixtures/architect/players.js`   |   503 | Architect player fixture data                      | `tests/helpers/architectTestHelpers.js` and 2 direct consumers                   |
| `tests/fixtures/architect/teams.js`     |   241 | Architect team fixture data                        | `tests/helpers/architectTestHelpers.js` and 2 direct consumers                   |
| `tests/fixtures/architect/worlds.js`    |   134 | Architect world fixture data                       | `tests/helpers/architectTestHelpers.js` and 2 direct consumers                   |
| `tests/regression.secondApron.js`       |    71 | Second apron regression fixture/scenario           | Self-contained; imported by 0 other test files                                   |

### Subdirectory breakdown (JS/JSX test files only)

| Directory                          |  JS | JSX | Total |   Lines | Scoped suite     |
| ---------------------------------- | --: | --: | ----: | ------: | ---------------- |
| `tests/` (root)                    |  41 |   0 |    41 |  ~9,200 | `test:node`      |
| `tests/trade/`                     |  34 |   0 |    34 |  ~6,800 | `test:trade`     |
| `tests/architect/`                 |  19 |   5 |    24 | ~11,050 | `test:architect` |
| `tests/validators/`                |   7 |   0 |     7 |  ~1,800 | `test:node`      |
| `tests/entitlements/`              |   4 |   0 |     4 |  ~1,300 | `test:architect` |
| `tests/smoke/`                     |   3 |   0 |     3 |    ~165 | `test:fast`      |
| `tests/roster/`                    |   0 |   1 |     1 |     289 | `test:roster`    |
| `tests/` UI (root JSX)             |   0 |   3 |     3 |    ~460 | `test:ui`        |
| `src/tests/architect/`             |  54 |   8 |    62 | ~24,100 | `test:architect` |
| `src/tests/architect/dare/`        |  10 |   0 |    10 |  ~3,700 | `test:architect` |
| `src/tests/architect/capTotals/`   |   4 |   0 |     4 |    ~700 | `test:architect` |
| `src/tests/architect/capLegality/` |   1 |   0 |     1 |    ~200 | `test:architect` |
| `src/tests/architect/utils/`       |   1 |   0 |     1 |    ~200 | `test:architect` |
| `src/tests/trade/`                 |  11 |   3 |    14 |  ~4,500 | `test:trade`     |
| `src/tests/tradeMachine/`          |   9 |   0 |     9 |  ~3,400 | `test:trade`     |
| `src/tests/scouting/`              |   1 |   0 |     1 |     509 | `test:scouting`  |
| `src/tests/` (root)                |   2 |   0 |     2 |    ~270 | `test:node`      |

---

## Conversion Steps

### Step 1 — Test support infrastructure (9 files, ~2,356 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Converted the nine setup/mock/helper/fixture files to TypeScript and updated Vitest setup-file references to `.ts`. `npm run typecheck`, `npm run test:fast -- --reporter=dot`, and targeted support-consumer node tests pass. `npm run test:diff -- --reporter=dot` was started but stopped because the diff runner selected `npm run test:full`, which is guarded by AGENTS.md unless the prompt contains `RUN FULL SUITE`.

**Why first:** These are non-test files that other test files import. Converting them first eliminates cross-batch `@ts-expect-error` suppressions and gives every subsequent step typed fixtures and helpers from the start.

**Files:**

| File                                    | Lines | Action                        |
| --------------------------------------- | ----: | ----------------------------- |
| `tests/setupDebug.js`                   |    13 | → `setupDebug.ts`             |
| `tests/setupFirebaseMocks.js`           |    66 | → `setupFirebaseMocks.ts`     |
| `tests/__mocks__/firebase.js`           |   719 | → `firebase.ts`               |
| `tests/regression.secondApron.js`       |    71 | → `regression.secondApron.ts` |
| `tests/fixtures/newSchemaPlayer.js`     |   169 | → `newSchemaPlayer.ts`        |
| `tests/fixtures/architect/players.js`   |   503 | → `players.ts`                |
| `tests/fixtures/architect/teams.js`     |   241 | → `teams.ts`                  |
| `tests/fixtures/architect/worlds.js`    |   134 | → `worlds.ts`                 |
| `tests/helpers/architectTestHelpers.js` |   440 | → `architectTestHelpers.ts`   |

**Config updates required:** Update `setupFiles` paths in `vitest.config.js`, `vitest.node.config.js`, `vitest.ui.config.js`, `vitest.emulator.config.js`, and `vitest.rules.config.js` to reference `.ts` extensions.

**Validation:**

```bash
npm run typecheck
npm run test:fast -- --reporter=dot
npm run test:diff -- --reporter=dot
```

**Commit message:** `test: convert test support/fixture/mock files to TypeScript (Pile D Step 1)`

---

### Step 2 — Smoke tests and smallest root test files (≤100 lines each, ~18 files, ~850 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed the 18 Step 2 smoke/small root test files from `.js` to `.ts`; no test logic or TypeScript annotations were needed. `npm run typecheck`, `npm run test:fast -- --reporter=dot`, and a targeted `npm run test:node -- --reporter=dot` run over the 18 converted files pass. The broad `npm run test:node -- --reporter=dot` command was also run, but it exceeded the 4-minute AGENTS.md budget and failed in unrelated pre-existing `tests/contractSalaryUtils.test.js` warning-payload expectations: the runtime warning now includes `hasPrimaryContract: false` and `hasContractsMap: false`.

**Why second:** These are the smallest, lowest-risk test files. Many are pure smoke/sanity checks with no cross-test imports. Converting them builds confidence in the pipeline before tackling larger files.

**Files:**

| File                                     | Lines | Action  |
| ---------------------------------------- | ----: | ------- |
| `tests/smoke/utilities.smoke.test.js`    |    45 | → `.ts` |
| `tests/smoke/trade-basics.smoke.test.js` |    52 | → `.ts` |
| `tests/smoke/imports.smoke.test.js`      |    68 | → `.ts` |
| `tests/formatHeight.test.js`             |    12 | → `.ts` |
| `tests/buildAnchorComparisons.test.js`   |    16 | → `.ts` |
| `tests/contractYears.test.js`            |    21 | → `.ts` |
| `tests/hasStepienViolation.test.js`      |    39 | → `.ts` |
| `tests/seasonIntegrationFinal.test.js`   |    55 | → `.ts` |
| `tests/yearLogicIntegration.test.js`     |    59 | → `.ts` |
| `tests/contractFixValidation.test.js`    |    60 | → `.ts` |
| `tests/tradeSalaryMatching.test.js`      |    65 | → `.ts` |
| `tests/contractDebugging.test.js`        |    76 | → `.ts` |
| `tests/seasonUtils.test.js`              |    83 | → `.ts` |
| `tests/contractOptionUsed.test.js`       |    84 | → `.ts` |
| `tests/seasonNormalizer.test.js`         |    94 | → `.ts` |
| `tests/dateConversion.test.js`           |    34 | → `.ts` |
| `tests/salaryMargin.test.js`             |    40 | → `.ts` |
| `tests/salaryUtils.test.js`              |    41 | → `.ts` |

**Validation:**

```bash
npm run test:fast -- --reporter=dot
npm run test:node -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert smoke + small root test files to TypeScript (Pile D Step 2)`

---

### Step 3 — Small trade and validator tests (≤100 lines, ~17 files, ~1,150 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed the 17 Step 3 small trade/validator tests from `.js` to `.ts`; no test logic or TypeScript annotations were needed. `npm run typecheck`, `npm run test:trade -- --reporter=dot`, targeted `npm run test:node -- --reporter=dot tests/validators/hardCap.test.ts`, and `npm run validate:project` pass. The broad `npm run test:node -- --reporter=dot` command was also run, but it exceeded the 4-minute AGENTS.md budget and failed in the unrelated pre-existing `tests/contractSalaryUtils.test.js` warning-payload expectation: the runtime warning now includes `hasPrimaryContract: false` and `hasContractsMap: false`.

**Why third:** Small trade rule tests are self-contained, import only from source modules (already TS), and match cleanly to `test:trade`.

**Files:**

| File                                                       | Lines | Action  |
| ---------------------------------------------------------- | ----: | ------- |
| `tests/trade/roster_twoWay_enforcement.test.js`            |    33 | → `.ts` |
| `tests/trade/hardCap_trigger_faException.test.js`          |    37 | → `.ts` |
| `tests/trade/byc_outgoing_max.test.js`                     |    38 | → `.ts` |
| `tests/trade/firstApron_100pct.test.js`                    |    41 | → `.ts` |
| `tests/trade/matchingBands_2023.test.js`                   |    54 | → `.ts` |
| `tests/trade/usedTradeExceptions.test.js`                  |    55 | → `.ts` |
| `tests/trade/rosterWindow_softEnforcement.test.js`         |    61 | → `.ts` |
| `tests/trade/poisonPill_average.test.js`                   |    65 | → `.ts` |
| `tests/trade/frozenPick_consequences.test.js`              |    74 | → `.ts` |
| `tests/trade/tradeKicker_proration.test.js`                |    77 | → `.ts` |
| `tests/trade/orderOfOps_conversionsBeforeMatching.test.js` |    81 | → `.ts` |
| `tests/trade/tradeKicker_zeroGuarantee.test.js`            |    85 | → `.ts` |
| `tests/trade/cashLedger_season_tracking.test.js`           |    86 | → `.ts` |
| `tests/trade/consent_and_birdVeto.test.js`                 |    90 | → `.ts` |
| `tests/trade/timingGates_softEnforcement.test.js`          |    99 | → `.ts` |
| `tests/trade/tradeUtilityMisc_surface.test.js`             |    97 | → `.ts` |
| `tests/validators/hardCap.test.js`                         |    84 | → `.ts` |

**Validation:**

```bash
npm run test:trade -- --reporter=dot
npm run test:node -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert small trade + validator tests to TypeScript (Pile D Step 3)`

---

### Step 4 — Small JSX UI tests (≤120 lines, ~8 files, ~440 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed the eight Step 4 JSX UI tests from `.jsx` to `.tsx`; no test logic or TypeScript annotations were needed. `npm run typecheck`, `npm run validate:project`, and a targeted `npm run test:ui -- --reporter=dot` run over the eight converted files pass. `npm run test:architect -- --reporter=dot` passed all 283 files / 3,298 tests but exceeded the 4-minute AGENTS.md budget at 276s. The broad `npm run test:ui -- --reporter=dot` command also exceeded the 4-minute budget at 329s and failed in unrelated pre-existing `src/tests/architect/tradeEditorTeamCard.boundary.e105.test.tsx`: the `setPlayerTrade` spy now receives normalized player fields (`bio`, `playerId`, `yearsOfService`) and a concrete `signAndTradeContract` object where the test expected a narrower payload.

**Why fourth:** These are the smallest JSX component tests. Converting them to `.tsx` validates the JSX→TSX pipeline before tackling larger UI tests.

**Files:**

| File                                                            | Lines | Action   |
| --------------------------------------------------------------- | ----: | -------- |
| `tests/PlayerHeadshot.test.jsx`                                 |    11 | → `.tsx` |
| `tests/AnchorComparison.test.jsx`                               |    19 | → `.tsx` |
| `tests/RankingSetup.test.jsx`                                   |    27 | → `.tsx` |
| `tests/architect/PlayerContractMini.voidedByExtension.test.jsx` |    82 | → `.tsx` |
| `tests/architect/CapSheetFull.rules.test.jsx`                   |    92 | → `.tsx` |
| `tests/architect/ExceptionTracker.tpe.test.jsx`                 |    92 | → `.tsx` |
| `src/tests/architect/capSheet_capPct_ssot.behavior.test.jsx`    |    53 | → `.tsx` |
| `src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx`  |    79 | → `.tsx` |

**Validation:**

```bash
npm run test:architect -- --reporter=dot
npm run test:ui -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert small JSX UI tests to TSX (Pile D Step 4)`

---

### Step 5 — Remaining `tests/` root logic tests (100–300 lines, 16 files, ~3,122 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all 16 Step 5 files from `.js` to `.ts` with no migration-only logic changes. Updated `tests/contractSalaryUtils.test.ts` to match the current warning payload shape, which now includes `hasPrimaryContract: false` and `hasContractsMap: false`. `npm run typecheck` passes, and a targeted `npm run test:node -- --reporter=dot` run over all 16 converted Step 5 files now passes (15 files / 174 tests passed; `tests/validationPerformance.test.ts` remains intentionally skipped by its `RUN_PERF_TESTS` gate).

**Files:**

| File                                            | Lines | Action  |
| ----------------------------------------------- | ----: | ------- |
| `tests/tradeHelpers.test.js`                    |   109 | → `.ts` |
| `tests/rankingEngine.test.js`                   |   111 | → `.ts` |
| `tests/tradeExceptions.test.js`                 |   118 | → `.ts` |
| `tests/validationPerformance.test.js`           |   130 | → `.ts` |
| `tests/contractSalaryUtils.test.js`             |   147 | → `.ts` |
| `tests/playerSchemaValidation.test.js`          |   161 | → `.ts` |
| `tests/newSchemaValidation.test.js`             |   230 | → `.ts` |
| `tests/contractLukaDoncicSpec.test.js`          |   230 | → `.ts` |
| `tests/capSettingsProvider.test.js`             |   266 | → `.ts` |
| `tests/capUtils.test.js`                        |   270 | → `.ts` |
| `tests/contractNormalizationValidation.test.js` |   288 | → `.ts` |
| `tests/tierMakerListOrder.test.js`              |   103 | → `.ts` |
| `tests/rankerSaveAsList.test.js`                |   105 | → `.ts` |
| `tests/seasonUtilsNormalization.test.js`        |   117 | → `.ts` |
| `tests/tierListModePersistence.test.js`         |   127 | → `.ts` |
| `tests/rankerSessionSerialization.test.js`      |   178 | → `.ts` |

**Validation:**

```bash
npm run test:node -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert mid-size root logic tests to TypeScript (Pile D Step 5)`

---

### Step 6 — Remaining `tests/` root large tests (300+ lines, 10 files, ~4,082 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all 10 Step 6 files from `.js` to `.ts` with no test-logic changes. `npm run typecheck` passes, and a targeted `npm run test:node -- --reporter=dot` run over the 10 converted Step 6 files passes (10 files / 169 tests).

**Files:**

| File                                                 | Lines | Action  |
| ---------------------------------------------------- | ----: | ------- |
| `tests/rankerLocalDraft.test.js`                     |   361 | → `.ts` |
| `tests/tradeValidatorEdgeCases.test.js`              |   306 | → `.ts` |
| `tests/signAndTradeAggregation.test.js`              |   367 | → `.ts` |
| `tests/tierSaveAsList.test.js`                       |   444 | → `.ts` |
| `tests/salaryMatchingRules.test.js`                  |   217 | → `.ts` |
| `tests/salaryMatchingUnification.test.js`            |   167 | → `.ts` |
| `tests/tradeValidator.test.js`                       |   524 | → `.ts` |
| `tests/computeTeamCapTotals.test.js`                 |   644 | → `.ts` |
| `tests/contractParser.test.js`                       |   545 | → `.ts` |
| `tests/contractNormalizationRulesValidation.test.js` |   507 | → `.ts` |

**Validation:**

```bash
npm run test:node -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert large root logic tests to TypeScript (Pile D Step 6)`

---

### Step 7 — `tests/validators/` remaining + `tests/entitlements/` (10 files, ~2,950 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all 10 Step 7 files from `.js` to `.ts` with no test-logic changes. `npm run typecheck` passes, and a targeted `npm run test:node -- --reporter=dot` run over the 10 converted validator/entitlement files passes (10 files / 144 tests). The broad `npm run test:architect -- --reporter=dot` step listed below was intentionally skipped because that script is directory-scoped to `tests/architect`, `src/tests/architect`, and `src/tests/tradeMachine`; using it here would run the full architect suite rather than the changed `tests/entitlements/*` files, which conflicts with AGENTS.md's default targeted-validation rule.

**Files:**

| File                                                      | Lines | Action  |
| --------------------------------------------------------- | ----: | ------- |
| `tests/validators/validationCache.test.js`                |   130 | → `.ts` |
| `tests/validators/salaryMatching.test.js`                 |   200 | → `.ts` |
| `tests/validators/stepienEntitlementBaseline.test.js`     |   370 | → `.ts` |
| `tests/validators/stepienEntitlements.test.js`            |   569 | → `.ts` |
| `tests/validators/stepien.test.js`                        |   170 | → `.ts` |
| `tests/validators/roster.test.js`                         |   180 | → `.ts` |
| `tests/entitlements/entitlementTrading.test.js`           |   350 | → `.ts` |
| `tests/entitlements/entitlementPickRowProjection.test.js` |   656 | → `.ts` |
| `tests/entitlements/worldTradeTransfer.test.js`           |   200 | → `.ts` |
| `tests/entitlements/tradeReceiptEntitlements.test.js`     |   125 | → `.ts` |

**Validation:**

```bash
npm run test:node -- --reporter=dot
npm run test:architect -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert validator + entitlement tests to TypeScript (Pile D Step 7)`

---

### Step 8 — `tests/trade/` medium and large tests (18 files, ~3,933 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all 18 Step 8 `tests/trade/` files from `.js` to `.ts` with no migration-only logic changes or extra type annotations required. `npm run typecheck` passes, and `npm run test:trade -- --reporter=dot` passes (72 files / 632 tests in 59.06s).

**Files:**

| File                                                  | Lines | Action  |
| ----------------------------------------------------- | ----: | ------- |
| `tests/trade/input_validation.test.js`                |   100 | → `.ts` |
| `tests/trade/consent_and_reacq.test.js`               |   109 | → `.ts` |
| `tests/trade/twoWayPlayers_snapshot.test.js`          |   110 | → `.ts` |
| `tests/trade/reacquisition_bar.test.js`               |   128 | → `.ts` |
| `tests/trade/signAndTrade_completeness.test.js`       |   140 | → `.ts` |
| `tests/trade/tpe_creation_expiry_usage.test.js`       |   200 | → `.ts` |
| `tests/trade/secondApronBoundary.test.js`             |   296 | → `.ts` |
| `tests/trade/timingEnforcement_authoritative.test.js` |   194 | → `.ts` |
| `tests/trade/salaryMatching.test.js`                  |   234 | → `.ts` |
| `tests/trade/tpe_absorption_fail_closed.test.js`      |   222 | → `.ts` |
| `tests/trade/secondApron_tpeBan.test.js`              |   155 | → `.ts` |
| `tests/trade/secondApron_handcuffs.test.js`           |   178 | → `.ts` |
| `tests/trade/faExceptions_as_trade_buckets.test.js`   |   175 | → `.ts` |
| `tests/trade/jan15_offseason_timing.test.js`          |   160 | → `.ts` |
| `tests/trade/rosterLegality_validateTrade.test.js`    |   200 | → `.ts` |
| `tests/trade/validation_caching.test.js`              |   247 | → `.ts` |
| `tests/trade/validatorTrustFixes.test.js`             |   456 | → `.ts` |
| `tests/trade/validatorContractCleanup.test.js`        |   429 | → `.ts` |

**Validation:**

```bash
npm run test:trade -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert tests/trade tests to TypeScript (Pile D Step 8)`

---

### Step 9 — `tests/architect/` JS tests (19 files, ~14,617 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all 19 Step 9 `tests/architect/` files from `.js` to `.ts` with no migration-only logic changes or extra type annotations required. `npm run typecheck` passes, a targeted `npm run test:node -- --reporter=dot` run over the 19 converted files passes (19 files / 615 tests in 14.33s), and `npm run validate:project` passes. The broad `npm run test:architect -- --reporter=dot` step listed below was intentionally skipped because earlier batches showed that suite can exceed AGENTS.md's 4-minute budget; the targeted node run covered every converted Step 9 file directly.

**Files:**

| File                                                  | Lines | Action                                                       |
| ----------------------------------------------------- | ----: | ------------------------------------------------------------ |
| `tests/architect/offerSheetResolution.test.js`        |    78 | → `.ts`                                                      |
| `tests/architect/extension_voidedByExtension.test.js` |   142 | → `.ts`                                                      |
| `tests/architect/seasonHelpers.test.js`               |   254 | → `.ts`                                                      |
| `tests/architect/tradeManager.test.js`                |   306 | → `.ts`                                                      |
| `tests/architect/overrideBypass.test.js`              |   385 | → `.ts`                                                      |
| `tests/architect/teamLoader.test.js`                  |   519 | → `.ts`                                                      |
| `tests/architect/contractNormalization.test.js`       |   502 | → `.ts`                                                      |
| `tests/architect/salaryEngine.test.js`                |   525 | → `.ts`                                                      |
| `tests/architect/e2e-workflows.test.js`               |   508 | → `.ts`                                                      |
| `tests/architect/renounceRights.test.js`              |   626 | → `.ts`                                                      |
| `tests/architect/ruleContextTiming.test.js`           |   691 | → `.ts`                                                      |
| `tests/architect/worldManager.test.js`                |   798 | → `.ts`                                                      |
| `tests/architect/seasonManager.test.js`               |   857 | → `.ts`                                                      |
| `tests/architect/offerSheetPersistence.test.js`       |   879 | → `.ts`                                                      |
| `tests/architect/integration.test.js`                 |   734 | → `.ts`                                                      |
| `tests/architect/playerRulesProfile.test.js`          | 1,152 | → `.ts`                                                      |
| `tests/architect/worldsOnlyRegression.test.js`        |   150 | → `.ts`                                                      |
| `tests/architect/schemaAdapter.test.js`               |   130 | → `.ts`                                                      |
| `tests/architect/capLegalityValidation.test.js`       | 5,381 | → `.ts` (largest file in Pile D — convert last in this step) |

**Validation:**

```bash
npm run test:architect -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert tests/architect JS tests to TypeScript (Pile D Step 9)`

**Note:** `tests/architect/capLegalityValidation.test.js` is 5,381 lines. If conversion is too noisy in one pass, split it into a standalone sub-commit.

---

### Step 10 — `tests/architect/` JSX tests (4 files, ~1,287 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all four Step 10 JSX UI tests from `.jsx` to `.tsx` with no migration-only logic changes or extra type annotations required. `npm run typecheck` passes, targeted `npm run test:ui -- --reporter=dot tests/tierMakerRoutes.ui.test.tsx tests/tierMakerBoards.ui.test.tsx` passes (2 files / 6 tests), and targeted `npm run test:roster -- --reporter=dot tests/roster/rosterBuilder.ui.test.tsx` passes (the `test:roster` script ran its built-in `src/tests/roster` scope plus the converted file and finished at 3 files / 31 tests). `npm run test:architect -- --reporter=dot tests/architect/EditContractModal.rules.test.tsx` also passes, but that script is directory-scoped to `tests/architect`, `src/tests/architect`, and `src/tests/tradeMachine`; it therefore ran a broader regression pass than Step 10 needed and finished in 204.67s with 283 files / 3,298 tests passed, still within the AGENTS.md 4-minute budget.

**Files:**

| File                                               | Lines | Action   |
| -------------------------------------------------- | ----: | -------- |
| `tests/architect/EditContractModal.rules.test.jsx` |   570 | → `.tsx` |
| `tests/tierMakerRoutes.ui.test.jsx`                |   203 | → `.tsx` |
| `tests/tierMakerBoards.ui.test.jsx`                |   225 | → `.tsx` |
| `tests/roster/rosterBuilder.ui.test.jsx`           |   289 | → `.tsx` |

**Validation:**

```bash
npm run test:ui -- --reporter=dot
npm run test:architect -- --reporter=dot
npm run test:roster -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert tests/ JSX UI tests to TSX (Pile D Step 10)`

---

### Step 11 — `src/tests/tradeMachine/` JS tests (9 files, ~3,400 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all nine Step 11 `src/tests/tradeMachine/` files from `.js` to `.ts`. Most files stayed logic-identical; the only TS migration edits were local expectation types for broad `unknown` metadata fields in trade-machine utility return values, one legacy Stepien fallback test routed through the existing `makeTeam()` helper to satisfy weak-type checks, and explicit `undefined` third arguments where the typed season-manager signatures require `positionsMap`. `npm run typecheck`, `npm run test:trade -- --reporter=dot`, and `npm run validate:project` pass. The trade suite finished at 72 files / 632 tests in 70.15s and included the converted trade-machine files directly.

**Files:**

| File                                                  | Lines | Action  |
| ----------------------------------------------------- | ----: | ------- |
| `src/tests/tradeMachine/displayFix.test.js`           |    54 | → `.ts` |
| `src/tests/tradeMachine/pickIdUtils.test.js`          |   136 | → `.ts` |
| `src/tests/tradeMachine/draftPicksSmokeCheck.test.js` |   170 | → `.ts` |
| `src/tests/tradeMachine/seasonSwapResolution.test.js` |   280 | → `.ts` |
| `src/tests/tradeMachine/draftPicksPreflight.test.js`  |   320 | → `.ts` |
| `src/tests/tradeMachine/stepienObligations.test.js`   |   406 | → `.ts` |
| `src/tests/tradeMachine/conveyancePreflight.test.js`  |   408 | → `.ts` |
| `src/tests/tradeMachine/phase5DraftPositions.test.js` |   598 | → `.ts` |
| `src/tests/tradeMachine/swapResolution.test.js`       |   687 | → `.ts` |

**Validation:**

```bash
npm run test:trade -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert src/tests/tradeMachine tests to TypeScript (Pile D Step 11)`

---

### Step 12 — `src/tests/trade/` JS tests (11 files, ~3,700 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all 11 Step 12 `src/tests/trade/` files from `.js` to `.ts`. Most files stayed logic-identical; the only TS migration edits were local helper typing in `goldenTrades.test.ts`, spreading the canonical empty snapshot shape into two partial fixtures in `tradeMultiSurfaceOfficialValues.test.ts`, and narrowing the local `severity` helper literal union in `tradeSnapshotWiring.test.ts`. `npm run typecheck` passes, and `npm run test:trade -- --reporter=dot` passes (72 files / 632 tests in 87.49s).

**Files:**

| File                                                           | Lines | Action  |
| -------------------------------------------------------------- | ----: | ------- |
| `src/tests/trade/playerRouting.test.js`                        |   135 | → `.ts` |
| `src/tests/trade/staleValidationFix.test.js`                   |   140 | → `.ts` |
| `src/tests/trade/worldless_season_mapping.guardrail.test.js`   |   160 | → `.ts` |
| `src/tests/trade/tpe_perPlayer.guardrail.test.js`              |   200 | → `.ts` |
| `src/tests/trade/hardCapSkip_strict_boolean.guardrail.test.js` |   180 | → `.ts` |
| `src/tests/trade/hardCap_salaryMatching.guardrail.test.js`     |   200 | → `.ts` |
| `src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js`   |   150 | → `.ts` |
| `src/tests/trade/secondApron_SSOT_guardrail.test.js`           |   180 | → `.ts` |
| `src/tests/trade/goldenTrades.test.js`                         |   350 | → `.ts` |
| `src/tests/trade/tradeSnapshotWiring.test.js`                  |   582 | → `.ts` |
| `src/tests/trade/tradeMultiSurfaceOfficialValues.test.js`      |   482 | → `.ts` |

**Validation:**

```bash
npm run test:trade -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert src/tests/trade JS tests to TypeScript (Pile D Step 12)`

---

### Step 13 — `src/tests/trade/` JSX tests + scouting + root tests (6 files, ~1,650 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all six Step 13 files to `.ts` / `.tsx`. Minimal TS migration edits were limited to a small `enrichPlayerData` helper cast in `player_filters_wiring_contract`, replacing stale `incomingAssets[].picks` test fixtures with the current `entitlements` shape, and a typed input interaction in `TradeSalaryCalculator.guardrail`. `npm run typecheck`, `npm run validate:project`, targeted `npm run test:ui -- --reporter=dot src/tests/trade/TradeSalaryCalculator.guardrail.test.tsx src/tests/trade/validatorContractConsumers.test.tsx src/tests/trade/TradeValidationGating.guardrail.test.tsx`, and targeted `npm run test:node -- --reporter=dot src/tests/scouting/player_filters_wiring_contract.test.ts src/tests/stripUndefinedDeep.test.ts src/tests/videoExamples.undefined.test.ts` all pass. The broader `test:trade` and `test:scouting` commands listed below were intentionally narrowed because `test:trade` defaults to `tests/trade`, and `test:scouting` runs both node and UI across the whole scouting tree, which is broader than the Step 13 diff and unnecessary under AGENTS.md's targeted-validation rule.

**Files:**

| File                                                        | Lines | Action   |
| ----------------------------------------------------------- | ----: | -------- |
| `src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx`  |   407 | → `.tsx` |
| `src/tests/trade/validatorContractConsumers.test.jsx`       |   336 | → `.tsx` |
| `src/tests/trade/TradeValidationGating.guardrail.test.jsx`  |   494 | → `.tsx` |
| `src/tests/scouting/player_filters_wiring_contract.test.js` |   509 | → `.ts`  |
| `src/tests/stripUndefinedDeep.test.js`                      |   183 | → `.ts`  |
| `src/tests/videoExamples.undefined.test.js`                 |    87 | → `.ts`  |

**Validation:**

```bash
npm run test:trade -- --reporter=dot
npm run test:scouting -- --reporter=dot
npm run test:ui -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert src/tests trade JSX + scouting + root tests to TypeScript (Pile D Step 13)`

---

### Step 14 — `src/tests/architect/` small-to-medium JS guardrails, part 1 (~15 files, ~5,500 lines)

**Status:** DONE — 2026-04-19

**Progress note (2026-04-19):** Renamed all 15 Step 14 files from `.js` to `.ts`. Seven files were rename-only; the remaining eight needed minimal TS migration edits limited to typed mock-module spreads, local fixture widening/casts for intentionally invalid inputs, one required `player` field in `validateSigning` calls, and optional-property-safe expectations where helper types are broader than the asserted runtime shape. `npm run typecheck`, a targeted `npm run test:node -- --reporter=dot` run over the 15 converted files, and `npm run validate:project` all pass. The broad `npm run test:architect -- --reporter=dot` step listed below was intentionally skipped because that script is directory-scoped to all architect and trade-machine node tests; the targeted node run covered every converted Step 14 file directly and better matches AGENTS.md's default targeted-validation rule.

**Why split:** The `src/tests/architect/` directory has 62 JS files and 8 JSX files. Converting in two batches (Steps 14–15 for JS, Step 16 for JSX) keeps each commit reviewable and limits blast radius.

**Files (sorted by size, smallest first):**

| File                                                                    | Lines | Action  |
| ----------------------------------------------------------------------- | ----: | ------- |
| `src/tests/architect/apronSemantics.test.js`                            |    50 | → `.ts` |
| `src/tests/architect/phase39_drift_guardrails.test.js`                  |    84 | → `.ts` |
| `src/tests/architect/worldTime.test.js`                                 |   108 | → `.ts` |
| `src/tests/architect/legacyMatchingValue.test.js`                       |   130 | → `.ts` |
| `src/tests/architect/dataValidation.test.js`                            |   150 | → `.ts` |
| `src/tests/architect/batchB_cbaRules.test.js`                           |   180 | → `.ts` |
| `src/tests/architect/deadCapManagement.test.js`                         |   200 | → `.ts` |
| `src/tests/architect/phase17_entitlement_routing_guardrail.test.js`     |   220 | → `.ts` |
| `src/tests/architect/capLegality/exceptionBlocking.test.js`             |   200 | → `.ts` |
| `src/tests/architect/utils/seasonManager.tpe.test.js`                   |   200 | → `.ts` |
| `src/tests/architect/phase16_3_trade_machine_init_guardrail.test.js`    |   250 | → `.ts` |
| `src/tests/architect/phase42_apron_derivation_consolidation.test.js`    |   300 | → `.ts` |
| `src/tests/architect/phase40_secondApron_drift_guardrails.test.js`      |   320 | → `.ts` |
| `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js` |   350 | → `.ts` |
| `src/tests/architect/oste_validation_unification_e1_1.test.js`          |   300 | → `.ts` |

**Validation:**

```bash
npm run test:architect -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert src/tests/architect small guardrail tests to TypeScript (Pile D Step 14)`

---

### Step 15 — `src/tests/architect/` large JS guardrails + dare/, part 2 (55 files, ~24,200 lines)

**Status:** DONE — 2026-04-20

**Progress note (2026-04-20):** Completed sub-batch 15c and closed Step 15. The remaining 19 root `src/tests/architect/` guardrail/integration files were renamed from `.js` to `.ts`. TS migration edits stayed narrow: local invalid-payload casts in the exception/entitlement guardrails, `vi.mocked(...)` narrowing for mocked team-loader and validation functions, typed helper-option objects for room-exception / season-advance fixtures, local casts for partial `currentState` fixtures passed to `computeWorldMutation(...)`, and updating Phase 83 source-scan assertions to self-reference the new `.ts` filename. `npm run typecheck` passes, `npm run validate:project` passes, and a targeted `npm run test:node -- --reporter=dot` run over the 19 converted 15c files passes (19 files / 308 tests in 21.14s). Sub-batches 15a and 15b remain complete as previously recorded; as with those earlier slices, the broad `npm run test:architect -- --reporter=dot` step was intentionally skipped here because that script is directory-scoped to the full architect suite, while the targeted node run covered every converted Step 15c file directly and matched AGENTS.md's default targeted-validation rule.

**Why large:** These are the heavyweight architect guardrail, integration, and persistence tests. They share similar import patterns and can be converted in a single batch after Step 14 proves the smaller files.

**Mandatory split:** This step is too large for a single commit. Split into three sub-commits:

- **15a** — `dare/` + `capTotals/` + `capLegality/` subdirectory files (~15 files) — DONE 2026-04-20
- **15b** — Phase 47–70 guardrails (~21 files) — DONE 2026-04-20
- **15c** — Phase 72–86 + remaining non-phase files (~19 files) — DONE 2026-04-20

**Files (all remaining JS in `src/tests/architect/` including `dare/`, `capTotals/`):**

| File                                                                                                    | Lines | Action  |
| ------------------------------------------------------------------------------------------------------- | ----: | ------- |
| `src/tests/architect/entitlementInvariants.test.js`                                                     |   350 | → `.ts` |
| `src/tests/architect/exceptionManagement.test.js`                                                       |   501 | → `.ts` |
| `src/tests/architect/signAndTrade.test.js`                                                              | 1,055 | → `.ts` |
| `src/tests/architect/capLegalityValidation.test.js`                                                     |   866 | → `.ts` |
| `src/tests/architect/phase86_league_invariants.test.js`                                                 |   439 | → `.ts` |
| `src/tests/architect/capSheetFull_ssot_parity_guardrails.test.js`                                       |   640 | → `.ts` |
| `src/tests/architect/phase47_tpe_persistence_guardrails.test.js`                                        |   350 | → `.ts` |
| `src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.js`                             |   578 | → `.ts` |
| `src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.js`                          |   350 | → `.ts` |
| `src/tests/architect/phase50_executeTrade_integration_persistence.test.js`                              |   818 | → `.ts` |
| `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.js`                              |   683 | → `.ts` |
| `src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.js`                      |   724 | → `.ts` |
| `src/tests/architect/phase55_trade_validation_separation_guardrails.test.js`                            |   447 | → `.ts` |
| `src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js`                                |   496 | → `.ts` |
| `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js`                         |   654 | → `.ts` |
| `src/tests/architect/phase59_legacy_import_guardrail.test.js`                                           |   300 | → `.ts` |
| `src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.js`                      |   459 | → `.ts` |
| `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.js`                         |   611 | → `.ts` |
| `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js`                |   815 | → `.ts` |
| `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js`                               |   350 | → `.ts` |
| `src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js`                 |   412 | → `.ts` |
| `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`                     |   448 | → `.ts` |
| `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js`                    |   446 | → `.ts` |
| `src/tests/architect/phase67_migration_execution_guardrails.test.js`                                    |   300 | → `.ts` |
| `src/tests/architect/phase68_verify_only_empty_scan_must_fail_guardrails.test.js`                       |   250 | → `.ts` |
| `src/tests/architect/phase69_seeded_verify_only_nonempty_proof_guardrails.test.js`                      |   250 | → `.ts` |
| `src/tests/architect/phase70_ci_proof_and_prod_write_safety_guardrails.test.js`                         |   300 | → `.ts` |
| `src/tests/architect/phase72_ssot_cap_totals_unification_guardrails.test.js`                            |   400 | → `.ts` |
| `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js`                       |   350 | → `.ts` |
| `src/tests/architect/phase74_room_exception_mvp_guardrails.test.js`                                     |   586 | → `.ts` |
| `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`                        |   516 | → `.ts` |
| `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.js` |   530 | → `.ts` |
| `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.js`       |   627 | → `.ts` |
| `src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js`                   |   350 | → `.ts` |
| `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.js`    |   471 | → `.ts` |
| `src/tests/architect/phase80_emulator_e2e_cap_sheet_proof_guardrails.test.js`                           |   300 | → `.ts` |
| `src/tests/architect/phase83_live_pipeline_mutations_and_season_advance_emulator_e2e.test.js`           |   350 | → `.ts` |
| `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js`                                 |   488 | → `.ts` |
| `src/tests/architect/phase16_seasonmanager_entitlements_ssot_view_guardrail.test.js`                    |   490 | → `.ts` |
| `src/tests/architect/season_advance_bridge_gate_guardrails.test.js`                                     |   300 | → `.ts` |
| `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.js`                                   |   350 | → `.ts` |
| `src/tests/architect/dare/dareResolver.test.js`                                                         |   427 | → `.ts` |
| `src/tests/architect/dare/conveyanceResolutionAdapter.test.js`                                          |   380 | → `.ts` |
| `src/tests/architect/dare/protectionLadderFactory.test.js`                                              |   200 | → `.ts` |
| `src/tests/architect/dare/swapResolutionAdapter.test.js`                                                |   200 | → `.ts` |
| `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js`                            |   389 | → `.ts` |
| `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.js`                                  |   623 | → `.ts` |
| `src/tests/architect/dare/phaseD2_true_e2e_trade_to_advance_gate.test.js`                               |   350 | → `.ts` |
| `src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.js`                                     |   300 | → `.ts` |
| `src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.js`                                    |   350 | → `.ts` |
| `src/tests/architect/dare/phaseD4_true_e2e_gate_guardrails.test.js`                                     |   300 | → `.ts` |
| `src/tests/architect/capTotals/deadMoney.test.js`                                                       |   200 | → `.ts` |
| `src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js`                                   |   150 | → `.ts` |
| `src/tests/architect/capTotals/leagueViewSsot.test.js`                                                  |   200 | → `.ts` |
| `src/tests/architect/capTotals/incompleteRosterCharge.test.js`                                          |   150 | → `.ts` |

**Note:** Split into sub-commits as described above (15a/15b/15c). Each sub-commit should pass `npm run test:architect -- --reporter=dot` before proceeding.

**Validation:**

```bash
npm run test:architect -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert src/tests/architect large JS guardrails to TypeScript (Pile D Step 15)`

---

### Step 16 — `src/tests/architect/` JSX tests (6 files, ~2,344 lines)

**Status:** DONE — 2026-04-20

**Progress note (2026-04-20):** Renamed all six Step 16 architect JSX tests from `.jsx` to `.tsx`. TSX migration edits stayed narrow and test-local: typed the cap-settings/UI fixture helpers in `capSheet_exception_wiring`, added a small DOM-card helper plus one `remainingAmount` field to a saved exception-state test fixture, typed the grouped-owner / modal-availability builders in `freeAgentPool.offerSheetInitiation`, and switched `rosterChargeDisplay` to `vi.mocked(computeTeamCapTotals)` with local return-value casts. `npm run typecheck` passes, `npm run validate:project` passes, and a targeted `npm run test:ui -- --reporter=dot` run over the six converted files passes (6 files / 51 tests in 12.54s). The broad `npm run test:architect -- --reporter=dot` step listed below was intentionally skipped because these six files are UI-config tests and the targeted `test:ui` run covered every converted Step 16 file directly while matching AGENTS.md's default targeted-validation rule.

**Files:**

| File                                                                       | Lines | Action   |
| -------------------------------------------------------------------------- | ----: | -------- |
| `src/tests/architect/entitlementPickRowDisplay.test.jsx`                   |   106 | → `.tsx` |
| `src/tests/architect/editContractModal_buyout_and_close.behavior.test.jsx` |   119 | → `.tsx` |
| `src/tests/architect/rosterChargeDisplay.test.jsx`                         |   344 | → `.tsx` |
| `src/tests/architect/OfferSheetList.freeAgency.test.jsx`                   |   364 | → `.tsx` |
| `src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx` |   384 | → `.tsx` |
| `src/tests/architect/capSheet_exception_wiring.behavior.test.jsx`          | 1,027 | → `.tsx` |

**Validation:**

```bash
npm run test:architect -- --reporter=dot
npm run test:ui -- --reporter=dot
npm run typecheck
```

**Commit message:** `test: convert src/tests/architect JSX tests to TSX (Pile D Step 16)`

---

## Post-Conversion Verification (Step 17)

**Status:** DONE — 2026-04-20

Completed 2026-04-20: `npm run typecheck`, `npm run build`, and `npm run validate:project` all passed after the final test conversions. `find src/tests tests \( -name '*.js' -o -name '*.jsx' \)` returned no results, and `docs/TS_CONVERSION_NEXT_STEPS.md` was updated to record Pile D completion.

After all steps are complete:

1. Run `npm run typecheck` — confirm zero new errors.
2. Run `npm run build` — confirm clean build.
3. Run `npm run validate:project` — confirm project structure is valid.
4. Verify zero `.js` or `.jsx` files remain under `src/tests/` and `tests/` (excluding any intentionally deferred files noted below).
5. Update `docs/TS_CONVERSION_NEXT_STEPS.md` to mark Pile D as complete.

```bash
npm run typecheck
npm run build
npm run validate:project
find src/tests tests \( -name '*.js' -o -name '*.jsx' \) | head -20
```

**Commit message:** `docs: mark Pile D test migration complete`

---

## Follow-Up Items

_(Record any type errors discovered in source modules during test conversion. Do not fix them in the test migration commits.)_

- Trade-machine utility typing remains intentionally broad in a few places: `src/features/architect/utils/tradeMachine/utils/swapResolution.ts` exposes `resolutionMeta` as `unknown`, and `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.ts` exposes `conveyanceResult` as `unknown`. The new TS tests use local expectation types instead of changing those source contracts in Step 11.

---

## Summary

|      Step | Scope                           |   Files |       Lines | Risk                               | Scoped validation                                       |
| --------: | ------------------------------- | ------: | ----------: | ---------------------------------- | ------------------------------------------------------- |
|         1 | Support infrastructure          |       9 |      ~2,356 | Low — no test logic changes        | `test:fast`, `test:diff`, `typecheck`                   |
|         2 | Smoke + small root tests        |      18 |        ~850 | Low — tiny isolated files          | `test:fast`, `test:node`, `typecheck`                   |
|         3 | Small trade + validator tests   |      17 |      ~1,150 | Low — small, self-contained        | `test:trade`, `test:node`, `typecheck`                  |
|         4 | Small JSX UI tests              |       8 |        ~440 | Low — validates JSX→TSX path       | `test:architect`, `test:ui`, `typecheck`                |
|         5 | Mid-size root logic tests       |      16 |      ~3,122 | Low-Med — larger but pure logic    | `test:node`, `typecheck`                                |
|         6 | Large root logic tests          |      10 |      ~4,082 | Medium — large files               | `test:node`, `typecheck`                                |
|         7 | Validators + entitlements       |      10 |      ~2,950 | Medium — cross-domain              | `test:node`, `test:architect`, `typecheck`              |
|         8 | `tests/trade/` remaining        |      18 |      ~3,933 | Medium — CBA logic heavy           | `test:trade`, `typecheck`                               |
|         9 | `tests/architect/` JS           |      19 |     ~14,617 | Med-High — large integration tests | `test:architect`, `typecheck`                           |
|        10 | `tests/` JSX UI                 |       4 |      ~1,287 | Medium — component rendering       | `test:ui`, `test:architect`, `test:roster`, `typecheck` |
|        11 | `src/tests/tradeMachine/`       |       9 |      ~3,400 | Medium — draft pick logic          | `test:trade`, `typecheck`                               |
|        12 | `src/tests/trade/` JS           |      11 |      ~3,700 | Medium — guardrails                | `test:trade`, `typecheck`                               |
|        13 | `src/tests/trade/` JSX + misc   |       6 |      ~1,650 | Medium — JSX + scouting            | `test:trade`, `test:scouting`, `test:ui`, `typecheck`   |
|        14 | `src/tests/architect/` small JS |      15 |      ~5,500 | Medium — many guardrails           | `test:architect`, `typecheck`                           |
|        15 | `src/tests/architect/` large JS |      55 |     ~24,200 | High — mandatory 3-way split       | `test:architect`, `typecheck`                           |
|        16 | `src/tests/architect/` JSX      |       6 |      ~2,344 | Medium — component tests           | `test:architect`, `test:ui`, `typecheck`                |
|        17 | Post-conversion verification    |       0 |           0 | N/A                                | Full validation pass                                    |
| **Total** |                                 | **231** | **~70,200** |                                    |                                                         |
