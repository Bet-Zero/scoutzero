# TypeScript Hardening Baseline

Captured: 2026-04-21

This is the starting evidence package for `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`.
It records the live repo state before the hardening waves begin. Counts below are
regex/file inventory measurements, not semantic type-safety proof.

## Summary

- Runtime `src/` is extension-migrated: `0` `.js` and `0` `.jsx` files.
- Root TypeScript is still permissive: `strict: false`.
- Root `npm run typecheck` passes, but that is a compatibility gate only.
- Both strict probes fail as expected and define the current measurement baseline:
  `tsconfig.architect-strict.json` has `2,567` TS errors, and
  `tsconfig.shared-boundaries-strict.json` has `244` TS errors.
- The highest-risk dishonesty mechanism remains `src/global-shims.d.ts`, which
  exports broad `any` ambient declarations for modules that now have real TS/TSX
  implementations.

## File Inventory

Inventory source: live `rg --files` scan of repo files.

| Scope                   | `.ts` | `.tsx` | `.js` | `.jsx` | `.d.ts` |
| ----------------------- | ----: | -----: | ----: | -----: | ------: |
| Repo-wide               |   879 |    331 |    26 |      0 |       4 |
| `src/`                  |   600 |    321 |     0 |      0 |       4 |
| `tests/`                |   147 |     10 |     0 |      0 |       0 |
| `src/tests/`            |   294 |     99 |     0 |      0 |       0 |
| `tests/` + `src/tests/` |   441 |    109 |     0 |      0 |       0 |

The remaining repo-wide `.js` files are outside runtime `src/` and live in
scripts/config-style surfaces. They are not the main app migration blocker, but
they are also not checked by root TypeScript unless imported into included TS.

## Compiler Posture

### Root `tsconfig.json`

| Setting               | Current value            | Hardening meaning                                   |
| --------------------- | ------------------------ | --------------------------------------------------- |
| `strict`              | `false`                  | Root typecheck does not enforce the strict family.  |
| `strictFunctionTypes` | `true`                   | One strict sub-flag is enabled explicitly.          |
| `skipLibCheck`        | `true`                   | Library declaration checks are skipped.             |
| `isolatedModules`     | `true`                   | Vite-compatible single-file transform safety is on. |
| `noEmit`              | `true`                   | Typecheck does not emit build output.               |
| `moduleResolution`    | `"bundler"`              | Matches Vite/bundler resolution.                    |
| `resolveJsonModule`   | `true`                   | JSON imports are allowed.                           |
| `allowJs`             | not enabled              | JS files are not part of root TS checking.          |
| `checkJs`             | not enabled              | Remaining JS is not type-checked as JS.             |
| `baseUrl`/`paths`     | `.` and `@/* -> ./src/*` | Repo alias is configured.                           |

Root includes runtime `src/**/*`, several scrape/pipeline script trees, and
`capTotals`. Root excludes `node_modules`, `dist`, `archive`, and
`player-scrape/contracts/**/*`.

### Additional TypeScript Configs

| Config                                   | Purpose                                                                      | Current posture                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `tsconfig.architect-strict.json`         | Strict probe for Architect runtime and Architect/trade tests.                | Extends root, sets `strict: true`, currently fails with `2,567` TS errors. |
| `tsconfig.shared-boundaries-strict.json` | Strict probe for shared player hooks plus selected route/storage boundaries. | Extends root, sets `strict: true`, currently fails with `244` TS errors.   |
| `functions/tsconfig.json`                | Separate Firebase Functions compiler config.                                 | Outside the current runtime hardening flow.                                |

## Dishonesty Markers

Marker corpus: code files from live `rg --files`, excluding `docs/`,
`return_packages/`, `archive/`, `dist/`, and generated dependency folders.

These are regex occurrence counts. The `any` count includes occurrences inside
more specific markers such as `as any` and `Record<string, any>`.

| Marker                | Full repo code corpus | Runtime `src/` excluding `src/tests/` | Tests (`tests/` + `src/tests/`) | Other code |
| --------------------- | --------------------: | ------------------------------------: | ------------------------------: | ---------: |
| `any`                 |                 1,223 |                                   174 |                             755 |        294 |
| `as any`              |                   441 |                                     5 |                             395 |         41 |
| `as unknown as`       |                    56 |                                     7 |                              43 |          6 |
| `@ts-ignore`          |                     0 |                                     0 |                               0 |          0 |
| `@ts-expect-error`    |                     1 |                                     0 |                               1 |          0 |
| `Record<string, any>` |                    78 |                                     4 |                              59 |         15 |

### Visibility Counts

`unknown` is tracked separately because it can represent honest boundary work or
unresolved data-shape debt depending on how it is narrowed.

| Marker    | Full repo code corpus | Runtime `src/` excluding `src/tests/` | Tests (`tests/` + `src/tests/`) | Other code |
| --------- | --------------------: | ------------------------------------: | ------------------------------: | ---------: |
| `unknown` |                 2,679 |                                 1,471 |                           1,047 |        161 |

## Strict Probe Baselines

These failures are measurement baselines, not Step 1 pass/fail goals.

| Command                                                                 | Result           | Error count |
| ----------------------------------------------------------------------- | ---------------- | ----------: |
| `npm run typecheck`                                                     | PASS             |           0 |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         | FAIL as expected |       2,567 |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` | FAIL as expected |         244 |

### Architect Strict Probe Concentration

Top error codes:

| Code      | Count |
| --------- | ----: |
| `TS18048` |   549 |
| `TS7006`  |   398 |
| `TS2322`  |   389 |
| `TS18049` |   237 |
| `TS2345`  |   225 |

Top files by current error count:

| File                                                                                                    | Errors |
| ------------------------------------------------------------------------------------------------------- | -----: |
| `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`                              |     95 |
| `tests/__mocks__/firebase.ts`                                                                           |     87 |
| `tests/architect/seasonManager.test.ts`                                                                 |     84 |
| `tests/architect/offerSheetPersistence.test.ts`                                                         |     80 |
| `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` |     70 |
| `tests/architect/capLegalityValidation.test.ts`                                                         |     67 |
| `tests/architect/teamLoader.test.ts`                                                                    |     67 |
| `src/features/architect/utils/mutationPipeline.ts`                                                      |     55 |

### Shared Boundary Strict Probe Concentration

Top error codes:

| Code     | Count |
| -------- | ----: |
| `TS7031` |    98 |
| `TS7006` |    49 |
| `TS2339` |    49 |
| `TS2345` |    16 |
| `TS7053` |    13 |

Top files by current error count:

| File                                                                | Errors |
| ------------------------------------------------------------------- | -----: |
| `src/pages/ListManager.tsx`                                         |     43 |
| `src/features/lists/ListPreviewModal/ListExportWrapper/index.tsx`   |     26 |
| `src/features/lists/ListSearchBar.tsx`                              |     19 |
| `src/features/roster/AddPlayerDrawer/addPlayer/PhysicalFilters.tsx` |     18 |
| `src/features/lists/AddToListButton/AddToListModal.tsx`             |     16 |
| `src/features/lists/ListTierHeader/index.tsx`                       |     15 |
| `src/features/roster/RosterControls.tsx`                            |     10 |

## Audit-Proven Risk Themes

Source: `docs/typescript/POST_MIGRATION_HARDENING_AUDIT.md`, rechecked against
live repo evidence where Step 1 needed counts.

1. Root TypeScript is still permissive. A green root typecheck does not prove
   strict typing because `strict` is off.
2. `src/global-shims.d.ts` is the strongest dishonesty signal. It has `11`
   ambient module declarations exporting `any`; the `Dialog` shim also declares
   exports that the real `src/shared/components/ui/Dialog.tsx` implementation
   does not provide.
3. Declaration facades still hide real implementation weakness in at least one
   sibling case: `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.d.ts`.
4. User-content Firebase helpers are relatively honest:
   `src/firebase/listHelpers.ts`, `src/firebase/rosterHelpers.ts`, and
   `src/firebase/rankerHelpers.ts` validate reads/writes with Zod-backed schemas.
5. Shared player reads are mixed. `src/shared/hooks/usePlayerDetail.ts` performs
   DEV-only validation but still casts raw production data; `useSimplePlayerData`
   spreads `docSnap.data()` into output without schema parsing.
6. Architect/base-data Firestore reads still rely heavily on cast-only trust in
   `subscribeArchitectPlayerData`, `loadArchitectBasePlayer`, `teamLoader`,
   `worldManager`, and `firebaseTeamPlanHelpers`.
7. Route, storage, and JSON parsing boundaries are inconsistent. Some paths
   narrow carefully; others parse or read into typed-looking data with minimal
   validation.
8. Tests are the biggest explicit type-bypass layer: `755` test-side `any`
   occurrences, `395` `as any` occurrences, and broad mocks/fixtures in central
   Architect suites.
9. Repo-wide strict mode is not ready. The current strict probes are useful
   measurement tools, not evidence that root `strict: true` is close.

## Declaration Layer Review

Reviewed: 2026-04-21, after Step 3 removed `src/global-shims.d.ts`.

Live code search found no remaining `declare module` blocks outside docs. The
project now has three non-library `.d.ts` files:

| File                                                           | Classification                 | Why it still exists                                                                                                 | Type posture                                                                                                                      | Blocks later hardening?                                                                                           |
| -------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/vite-env.d.ts`                                            | Justified boundary declaration | Provides Vite client references and the app's `VITE_*` environment variable surface.                                | No broad placeholders or `any`; it declares optional string env values.                                                           | No. Keep as the Vite/env boundary.                                                                                |
| `src/types/player.d.ts`                                        | Temporary legacy bridge        | Preserves the legacy player type import surface while canonical player schemas live in `src/schemas/players_v2.ts`. | Core document exports forward to schema-derived types; legacy view interfaces still allow extra fields with `unknown`, not `any`. | Not a live blocker, but future code should prefer schema exports directly and avoid adding new declarations here. |
| `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.d.ts` | Still suspicious               | Sits beside a real `PlayerNameMini.tsx` implementation whose props are not typed in the implementation file.        | No `any`, but it is a duplicate declaration facade that can drift from runtime props.                                             | Not a Step 5 blocker; revisit when strict-prep or table UI typing reaches this component.                         |

Step 4 also removed the stale `src/global-shims.d.ts` include from
`tsconfig.architect-strict.json`. Declaration-layer dishonesty is no longer a
global ambient-module blocker, but the `PlayerNameMini` sibling declaration
remains a small local cleanup target.

## Architect Boundary Review

Reviewed: 2026-04-21, after Steps 6-7 hardened the primary Architect/base-data
Firestore ingress points.

Step 6 routed `subscribeArchitectPlayerData`, `loadArchitectBasePlayer`, and
`teamLoader` through the shared Architect Firestore boundary helpers. Step 7
added runtime readers for world metadata in `worldManager.ts` and for base
team, base player, and free-agent documents in
`firebaseTeamPlanHelpers.ts`. The hardened wave removes cast-only trust from
the planned world/base read stack while preserving the existing hydrated output
shapes.

| File or group                                                                    | Classification                               | Why                                                                                                                                                                                                                         | Resume point                                                                            |
| -------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/features/architect/utils/worldManager.ts`                                   | Safe to defer                                | World metadata reads now require object-shaped documents and validate known scalar, list, stats, and draft-position fields before returning `WorldMetadata`.                                                                | Revisit only if world metadata schema becomes canonical Zod.                            |
| `src/features/architect/utils/firebaseTeamPlanHelpers.ts`                        | Safe to defer                                | Base team, base player, contract, bio, exception, and free-agent reads now pass through boundary readers before hydration; remaining loose fields are preserved as unknown passthrough for legacy compatibility.            | Revisit when a canonical hydrated-base-team schema exists.                              |
| `src/features/architect/utils/mutationPipeline.ts` current-state Firestore reads | Next-wave candidate                          | The strict scan still shows casted offer-sheet team/player override snapshot reads in the committed mutation pipeline, and the strict probe concentrates many downstream optional/nullability errors there.                 | Step 10/11 candidate if the strict checkpoint supports one narrow runtime wave.         |
| `src/features/architect/utils/entitlements/*` resolver and pick-rule reads       | Safe to defer                                | These casts are real boundary debt, but they are scoped to entitlement resolution rather than the Step 6-7 world/base read stack and did not block the wave validation.                                                     | Track for a future entitlement-boundary pass.                                           |
| `src/features/architect/GMDashboard/**` dashboard/action adapter contracts       | Needs separate product/architecture decision | Strict errors show broad disagreement between dashboard cap-sheet/player shapes, mutation-pipeline carrier shapes, and trade/cap consumers; fixing this is a contract-alignment pass, not another Firestore-boundary patch. | Separate Architect contract-normalization plan or Step 11 only if narrowed by evidence. |
| `tests/__mocks__/firebase.ts` and cast-heavy Architect suites                    | Next-wave candidate                          | Tests remain the biggest typed bypass layer and still dominate strict-probe output.                                                                                                                                         | Step 8.                                                                                 |

The Architect strict probe still fails on the known broader backlog, but a
filtered strict check after Step 7 showed no errors in
`architectFirestoreBoundary.ts`, `worldManager.ts`, or
`firebaseTeamPlanHelpers.ts`.

## Test Typing Review

Reviewed: 2026-04-21, after Step 8 tightened the central Firebase mock and the
first targeted Architect suites.

### Updated Test-Side Dishonesty Markers

| Marker                | Step 1 baseline tests | Current tests | Delta |
| --------------------- | --------------------: | ------------: | ----: |
| `any`                 |                   755 |           637 |  -118 |
| `as any`              |                   395 |           332 |   -63 |
| `as unknown as`       |                    43 |            44 |    +1 |
| `@ts-ignore`          |                     0 |             0 |     0 |
| `@ts-expect-error`    |                     1 |             1 |     0 |
| `Record<string, any>` |                    59 |            42 |   -17 |

`unknown` remains a visibility metric rather than a dishonesty score. Test-side
`unknown` moved from `1,047` to `1,096` (`+49`) because Step 8 converted
central mock and fixture surfaces away from `any` and toward explicit boundary
unknowns that must be narrowed by the consuming test.

### Step 8 Improvements That Landed

- `tests/__mocks__/firebase.ts` now has `0` `any`, `0` `as any`, and `0`
  `Record<string, any>` matches. Its remaining `38` `unknown` usages are
  boundary-shaped mock I/O rather than permissive trust.
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` now has `0`
  matches for every tracked dishonesty marker. The suite uses explicit fixture
  contracts plus localized `Record<string, unknown>` passthrough where
  compatibility extras are intentional.
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx` improved
  materially from the audit hotspot state (`133` `any`, `91` `as any`) to `32`
  `any` and `28` `as any`, but it is still one of the biggest remaining typed
  bypass clusters in the test layer.

### Remaining Test Debt Classification

| File or group                                                                                                                                                                                                                                                                                                           | Classification                         | Why                                                                                                                                                                                                              | Resume point                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/tests/architect/useArchitectActions.freeAgency.test.tsx`                                                                                                                                                                                                                                                           | High-value next-wave candidate         | This is still a central action-layer proof surface with `32` `any` and `28` `as any`, mostly in hook-state setup, mutation-call assertions, and trade/apply payloads.                                            | If Step 10/11 supports another test-focused wave, revisit this suite first.                                   |
| `src/tests/architect/tmCapIntegration.*`, `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`, `src/tests/architect/capSheet.transactionMatrix.behavior.test.tsx`                                                                                                                          | High-value next-wave candidate         | The heaviest remaining `any`/`as any` density now lives in trade/cap integration harnesses, so critical guardrails still accept loosely shaped inputs too easily.                                                | Best next cluster after `useArchitectActions.freeAgency.test.tsx` if the plan takes one more typed-test pass. |
| `src/tests/architect/mutationPipeline.boundary.e107.test.ts`, `src/tests/architect/mutationPipeline.computeResultBridge.test.ts`, `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`                                                                                                                | High-value next-wave candidate         | Mutation-pipeline guardrails still rely on cast-heavy fixtures, which weakens the same runtime contracts Steps 6-7 just hardened.                                                                                | Keep grouped as one follow-on harness wave rather than fixing them piecemeal.                                 |
| `tests/__mocks__/firebase.ts`                                                                                                                                                                                                                                                                                           | Acceptable temporary compromise        | The mock remains central, but it no longer uses tracked dishonesty markers. The remaining `unknown` usage reflects mock-boundary truth, not bag-typed trust.                                                     | Revisit only if Step 10 shows strict-prep leverage in the mock layer.                                         |
| `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`                                                                                                                                                                                                                                                        | Acceptable temporary compromise        | This suite now proves persistence behavior with explicit fixture contracts and no tracked dishonesty markers.                                                                                                    | Leave it alone unless runtime contract changes require new fixture shape coverage.                            |
| `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts`, `src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts`, `tests/trade/useTradeMachine.validatorTrust.test.ts`                                                                                                  | Acceptable temporary compromise        | These compatibility-style suites still carry some `Record<string, any>` bag typing, but they are lower leverage than the action/trade/cap harnesses above and would likely widen into runtime contract redesign. | Revisit only in a dedicated compatibility-contract cleanup pass.                                              |
| Scattered leaf suites with `1-4` `as unknown as` occurrences, including `src/tests/architect/capSheet_exception_wiring.behavior.test.tsx`, `src/tests/architect/deadCapManagement.test.ts`, `src/tests/architect/signAndTrade.test.ts`, `src/tests/architect/worldTime.test.ts`, and `tests/architect/capHolds.test.ts` | Not worth targeted hardening right now | These are real casts, but they are sparse and isolated enough that a dedicated cleanup wave would not materially change trust metrics.                                                                           | Leave them for opportunistic cleanup when those suites already need behavior work.                            |

### Conclusion

The typed test layer is materially more honest than the Step 1 baseline, but it
is not yet mostly truthful. The central Firebase mock and one persistence-truth
suite now reinforce runtime contracts instead of bypassing them, but the
highest-value remaining dishonesty is still concentrated in Architect
action/trade/cap integration harnesses. In plain terms: the support layer is
helping more, but the most important Architect tests still bypass runtime truth
too often to call the test layer fully trustworthy.

## Strictness Checkpoint

Reviewed: 2026-04-21, after Steps 3-9.

### Probe Delta

| Command                                                                 | Step 1 baseline | Current result | Delta | Reading                                                                                                       |
| ----------------------------------------------------------------------- | --------------: | -------------: | ----: | ------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                     |               0 |              0 |     0 | Root compatibility gate still passes, but root `strict: false` means this is not hardening proof by itself.   |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |             244 |              0 |  -244 | Shared/runtime probe moved materially and now passes.                                                         |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |           2,567 |          2,632 |   +65 | Architect/test probe did not improve at repo scale; it is slightly worse overall despite local boundary wins. |

### Which Probes Moved Meaningfully

- The shared/runtime probe moved decisively. The declaration cleanup plus Step 5
  boundary work removed the full `244`-error backlog, so there is no remaining
  shared strict-prep family to chase inside this plan.
- The Architect/test probe did not move meaningfully at whole-probe level.
  Earlier waves did harden the targeted boundary files, but that progress did
  not collapse the broader strict backlog.

### What Improved Without Changing the Whole-Repo Architect Count

- The Step 6-7 Architect boundary files are now clean under the Architect
  strict probe: `subscribeArchitectPlayerData.ts`,
  `loadArchitectBasePlayer.ts`, `teamLoader.ts`, `worldManager.ts`, and
  `firebaseTeamPlanHelpers.ts` each show `0` current strict errors.
- The central Firebase mock no longer contributes Architect strict errors:
  `tests/__mocks__/firebase.ts` fell from the Step 1 hotspot list (`87`) to
  `0`.
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx` is no longer a
  top strict hotspot. It still carries typed-test debt, but the Architect
  strict probe now reports `4` errors there instead of it dominating the list.

These local wins matter, but they exposed the real shape of the remaining
Architect debt rather than reducing it enough to justify a narrow Step 11 wave.

### Remaining Error Families

The shared/runtime probe has no remaining strict error family.

The Architect/test probe is now dominated by broad contract and nullability
families rather than by the specific boundary files already hardened:

| Error family                     | Current count | What it signals                                                                                                    | Where it lives now                                                                                                  |
| -------------------------------- | ------------: | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `TS18048` / `TS18049` / `TS2533` |           891 | Possibly-null and optionality churn after truthful boundary contracts meet looser downstream consumers.            | Concentrated across Architect persistence/season tests plus `mutationPipeline.ts` and dashboard adapters.           |
| `TS2322` / `TS2345`              |           649 | Cross-contract assignability mismatches between dashboard, mutation, cap-sheet, and test-harness shapes.           | Strongest in `seasonManager.test.ts`, `GMDashboard*`, `useArchitectActions.ts`, and persistence/offer-sheet suites. |
| `TS7006` / `TS7005` / `TS18046`  |           583 | Untyped parameters, untyped locals, and `unknown`-not-narrowed patterns that still dominate older Architect tests. | Mostly in large Architect test harnesses rather than the shared runtime surface.                                    |

### Concentration vs. Spread

- The Architect strict backlog currently spans `194` files.
- The top `10` files account for `731 / 2,632` errors (`27.8%`).
- The top `20` files account for `1,144 / 2,632` errors (`43.5%`).
- That means there are real hotspots, but the remaining debt is still spread
  too broadly to call it one bounded strict-prep cluster.

Current top Architect strict hotspots:

| File                                                                                                    | Errors | Dominant families                                  |
| ------------------------------------------------------------------------------------------------------- | -----: | -------------------------------------------------- |
| `tests/architect/seasonManager.test.ts`                                                                 |    117 | `TS2322`, `TS18046`, `TS7006`, `TS7005`            |
| `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`                              |     95 | `TS18048`, `TS18049`                               |
| `tests/architect/offerSheetPersistence.test.ts`                                                         |     80 | `TS18048`, `TS18049`, `TS2532`, `TS2533`           |
| `tests/architect/capLegalityValidation.test.ts`                                                         |     67 | Mixed contract/nullability debt                    |
| `tests/architect/teamLoader.test.ts`                                                                    |     67 | Mixed contract/nullability debt                    |
| `tests/architect/worldManager.test.ts`                                                                  |     66 | Mixed contract/nullability debt                    |
| `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` |     64 | Mixed contract/nullability debt                    |
| `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts`                                     |     62 | Mixed contract/nullability debt                    |
| `src/tests/architect/exceptionManagement.test.ts`                                                       |     58 | Mixed contract/nullability debt                    |
| `src/features/architect/utils/mutationPipeline.ts`                                                      |     55 | `TS18048`, `TS2322`, `TS18049`, `TS2533`, `TS2345` |

### Readiness Verdict

- Is the repo still nowhere near ready?
  Shared/runtime is now ready on its own probe, but the combined Architect/test
  surface is still nowhere near strict-ready.
- Is it now somewhat ready with a narrow prep pass?
  Not inside this plan. The remaining Architect/test debt is too cross-cutting
  across runtime contracts and large test harnesses to fit one bounded Step 11
  wave honestly.
- Which exact error families are most worth targeting next, and where do they
  live?
  Architect-only nullability/optionality (`TS18048`, `TS18049`, `TS2533`),
  assignability (`TS2322`, `TS2345`), and test-harness typing gaps (`TS7006`,
  `TS7005`, `TS18046`) across `mutationPipeline`, `GMDashboard` contract
  adapters, `seasonManager.test.ts`, `phase50_executeTrade_integration_persistence.test.ts`,
  and `offerSheetPersistence.test.ts`.
- Which probe moved meaningfully and which did not?
  `tsconfig.shared-boundaries-strict.json` moved meaningfully to pass; the
  Architect/test probe did not.

### Recommendation

**Option C:** Do not start broader strict-prep inside this plan.

Reason: the shared boundary surface is already clear, but the remaining
Architect/test strict debt is still a separate contract-alignment problem, not a
single narrow cleanup wave. The next honest move is a dedicated follow-on plan
focused on Architect nullability and contract normalization across
`mutationPipeline`, the dashboard/action adapters, and the dominant persistence
and season-advance test harnesses.

## Master Plan Resume Baseline

Reviewed: 2026-04-22, after Step 13 reset the plan around the real remaining
mission backlog.

### Current Strict-Probe Truth

| Command                                                                 | Current result   | Error count | Reading                                                                                                                      |
| ----------------------------------------------------------------------- | ---------------- | ----------: | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` | PASS             |           0 | Shared/runtime strict debt remains cleared; there is no live evidence of shared-boundary regression.                         |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         | FAIL as expected |       2,632 | The remaining mission-area backlog is still concentrated in Architect runtime contracts plus Architect-heavy test harnesses. |

The shared/runtime probe is now green. The mission is still blocked by the
Architect side of the repo: central runtime carrier/adapter contracts remain
misaligned, and the biggest strict backlog still sits in persistence, offer
sheet, season, and guardrail harnesses that exercise those contracts.

### Current Architect Strict Hotspots

Top error families from the live `tsconfig.architect-strict.json` run:

| Error family | Count | What it now signals                                                                      |
| ------------ | ----: | ---------------------------------------------------------------------------------------- |
| `TS18048`    |   557 | Optional/null values still flowing into code paths that assume presence.                 |
| `TS2322`     |   410 | Assignability disagreements between runtime carrier shapes and consuming adapters/tests. |
| `TS7006`     |   305 | Untyped parameters still concentrated in older Architect/trade harnesses.                |
| `TS18049`    |   241 | Values may be `null` or `undefined` where downstream code expects real objects.          |
| `TS2345`     |   239 | Function-call contracts still disagree across mutation, dashboard, and test layers.      |
| `TS18046`    |   153 | `unknown` values are reaching assertions and helpers without truthful narrowing.         |
| `TS18047`    |   144 | Nullable values are still used as present in key test/runtime flows.                     |
| `TS7005`     |   125 | Older Architect/trade harnesses still rely on implicitly-`any` locals.                   |

Top failing files from the same live run:

| File                                                                                                    | Errors | Why it matters now                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------- |
| `tests/architect/seasonManager.test.ts`                                                                 |    117 | Highest single-file test hotspot; central season lifecycle harness still bypasses real contracts too often.           |
| `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`                              |     95 | Persistence truth harness still has heavy nullability churn across execute-trade flows.                               |
| `tests/architect/offerSheetPersistence.test.ts`                                                         |     80 | Offer-sheet persistence coverage still depends on loosely aligned fixture/runtime shapes.                             |
| `tests/architect/capLegalityValidation.test.ts`                                                         |     67 | Cap legality integration harness still carries broad contract mismatch debt.                                          |
| `tests/architect/teamLoader.test.ts`                                                                    |     67 | Team-loader test surface still has mixed assignability/nullability fallout even after the runtime boundary hardening. |
| `tests/architect/worldManager.test.ts`                                                                  |     66 | World-manager harness still reflects older loose contracts rather than the hardened readers.                          |
| `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` |     64 | High-value parity/season-advance guardrail harness remains contract-heavy and nullable.                               |
| `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts`                                     |     62 | Exception guardrails still rely on overly permissive compatibility fixtures.                                          |
| `src/tests/architect/exceptionManagement.test.ts`                                                       |     58 | Exception lifecycle harness still reflects inconsistent runtime shapes.                                               |
| `src/features/architect/utils/mutationPipeline.ts`                                                      |     55 | Highest-leverage runtime contract owner still failing across nullability and assignability families.                  |

### Concentration Snapshot

- `tests/architect/` contributes `784` strict errors.
- `src/tests/architect/` contributes `1,081` strict errors.
- `tests/trade/` still contributes `439` strict errors inside the Architect
  strict probe, so the remaining backlog is not limited to one Architect-only
  folder.
- `src/features/architect/` contributes `202` strict errors, with the most
  important runtime owner still in `mutationPipeline.ts` (`55`) plus the
  `GMDashboard/**` action/adapter surface (`31`) and
  `GMDashboard/hooks/useArchitectActions.ts` (`22`).

In plain terms: the shared boundary work held, but full project type hardening
is still blocked because the repo does not yet have truthful end-to-end
Architect contracts. The mutation pipeline, dashboard/action adapters, and the
largest persistence/season/offer-sheet harnesses still disagree about what data
is present, nullable, or assignable, so root compatibility passing is still not
evidence of real hardening completion.

### Final Review Correction

`PASS WITH DEBT` from `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md`
remains a valid verdict for the completed foundation phase only. It is now
explicitly treated as an intermediate phase result, not a mission-complete
result, because the live strict evidence still shows a large unresolved
Architect/runtime/test backlog inside this same plan.

## Step 17 Runtime Contract Wave Delta

Reviewed: 2026-04-22, after the second runtime contract-normalization wave.

### Strict Probe Delta

| Measurement                                                                                    |                                                          Step 16 close |   After Step 17 |   Delta |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------: | --------------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json`                                |                                                                  2,549 |           2,501 |     -48 |
| `src/features/architect/utils/mutationPipeline.ts`                                             |                                                                     57 |              34 |     -23 |
| `src/features/architect/tradeMachine/TradeEditor.tsx` and touched child trade-machine UI files | 13 direct `TradeEditor.tsx` errors plus child nullable-contract errors | 0 direct errors | Cleared |

### Runtime Surfaces Improved

- `mutationPipeline.ts` now accepts unknown/current-state ingress only at named
  normalizer boundaries for player bio display/draft, trade-eligibility rules,
  player arrays, representation, dashboard reload contract slices, lineage
  override merging, and persistable player override snapshots.
- `TradeEditor.tsx` now hands sign-and-trade modal callbacks and entitlement
  destination routing through explicit adapters instead of relying on nullable
  IDs being accepted by narrower consumers.
- `TradeTeamCard.tsx`, `OutgoingPlayersList.tsx`, `TradePlayerRow.tsx`,
  `EntitlementPicksList.tsx`, and `EntitlementPickRow.tsx` now accept the
  nullable team/entitlement/player fields produced by the hook layer and
  normalize them before narrower child/projection calls.

### Remaining Runtime Hotspots

`mutationPipeline.ts` remains the only major runtime hotspot from this wave at
`34` strict errors. The remaining families are mostly offer-sheet/signing
nullability and final mutation-result carrier assignability. The trade-editor
adapter cluster no longer appears in the Architect strict output.

Plain-language read: Step 17 finished the dashboard/trade-machine adapter side
of the runtime wave and reduced the central mutation-pipeline backlog, but it
did not make `mutationPipeline.ts` strict-ready. Step 18 should classify whether
that remaining mutation-pipeline cluster should be attacked before moving into
the planned test-harness waves.

## Runtime Contract Review

Reviewed: 2026-04-22, after Steps 16-17 completed the planned runtime
contract-normalization waves.

### Updated Architect Strict-Probe Counts

| Measurement                                                       | Step 14 resume baseline | Current |   Delta |
| ----------------------------------------------------------------- | ----------------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json`   |                   2,632 |   2,501 |    -131 |
| `src/features/architect/` runtime surfaces                        |                     202 |     123 |     -79 |
| `src/features/architect/utils/mutationPipeline.ts`                |                      55 |      34 |     -21 |
| `src/features/architect/GMDashboard/**`                           |                      31 |       2 |     -29 |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` |                      22 |       0 | Cleared |
| `src/features/architect/hooks/useTradeMachine.ts`                 |                       5 |       0 | Cleared |

### Runtime Hotspots Materially Improved

- `useArchitectActions.ts` no longer appears in the Architect strict output, so
  the earlier dashboard/action carrier disagreement is no longer a dominant
  runtime blocker.
- `useTradeMachine.ts` and the `TradeEditor.tsx` trade-machine adapter cluster
  are clear, so the trade-editor seam is not driving the remaining runtime
  backlog.
- `GMDashboard/**` collapsed from `31` errors to `2`, leaving only a small
  residual state seam instead of a wave-sized dashboard/apply/reload mismatch.
- `mutationPipeline.ts` still matters, but it is down from `55` to `34`; the
  remaining runtime concentration is now a smaller offer-sheet/signing/result
  carrier cluster rather than a repo-wide adapter failure.

### Remaining Runtime Backlog Classification

| Classification                            | File or group                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Why it belongs here now                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Immediate next-wave candidate`           | `src/features/architect/utils/mutationPipeline.ts` (`34`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | This is the only remaining concentrated runtime-owner hotspot. The surviving errors are mostly offer-sheet/signing nullability plus final mutation-result assignability, so if another runtime wave is needed it should stay tightly bounded here.                          |
| `Safe to defer until tests are tightened` | `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx` (`8`), `src/features/architect/utils/capLegalityValidation.ts` (`8`), `src/features/architect/utils/leagueInvariants.ts` (`8`), `src/features/architect/utils/tradeContext/tradeContext.ts` (`8`), `src/features/architect/utils/seasonManager.ts` (`7`), `src/features/architect/utils/offseason/resolveOffseasonTransition.ts` (`6`), `src/features/architect/utils/capTotals/computeTeamCapTotals.ts` (`5`), `src/features/architect/utils/tradeMachine/rules/miscRules.ts` (`5`) | These pockets are real but dispersed, and the dominant failing test harnesses exercise the same season, persistence, and cap flows. Tightening the tests first should show which of these pockets still need truthful runtime fixes versus local fixture/narrowing cleanup. |
| `Needs product/architecture decision`     | None currently identified from live repo evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | The remaining runtime backlog is technical contract debt, not a blocked user-facing requirement. If a later wave promotes a canonical world/team/offseason carrier choice, that is an internal architecture decision rather than a product-direction question for the user. |

### Recommendation

The next wave should prioritize tests, not a third standalone runtime pass.
Runtime strict debt has narrowed from `202` to `123` errors, while the current
test layer now carries `2,252` of the `2,501` total Architect-strict errors
(`1,029` in `src/tests/architect`, `784` in `tests/architect`, and `439` in
`tests/trade`). Step 19 should therefore start with
`tests/helpers/architectTestHelpers.ts` plus
`tests/architect/seasonManager.test.ts`, while allowing only the minimum
runtime support edits needed if those harnesses expose the remaining
`mutationPipeline.ts` carrier seam.

## Step 19 Test Harness Wave Delta

Reviewed: 2026-04-22, after the first Architect test-harness hardening wave.

### Strict Probe Delta

| Measurement                                                     | Step 18 baseline | Current |   Delta |
| --------------------------------------------------------------- | ---------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json` |            2,501 |   2,403 |     -98 |
| `tests/architect/seasonManager.test.ts`                         |              117 |       0 | Cleared |
| `tests/helpers/architectTestHelpers.ts`                         |               18 |       0 | Cleared |

### What Changed

- `tests/helpers/architectTestHelpers.ts` now exports explicit mock
  world/team/player contracts plus typed mock readers, so the shared helper
  layer no longer feeds `unknown`, implicit-`any`, or string-indexing fallout
  into the season harness.
- `tests/architect/seasonManager.test.ts` now consumes those typed helpers,
  narrows season-advance success vs. failure results explicitly, replaces raw
  `getMockData()` team reads with truthful helper-backed accessors, and keeps
  deliberately invalid inputs inside the callable string domain instead of
  depending on null casts.
- The targeted harness still preserves the same runtime coverage: the focused
  node test for `tests/architect/seasonManager.test.ts` passes with all
  `29 / 29` tests green.

### Remaining Test Hotspots After Step 19

The Step 19 wave removed the highest season-harness hotspot cleanly, but it did
not finish the broader persistence cluster. The next highest-value remaining
targets are still:

- `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
  (`95` at the Step 18 baseline)
- `tests/architect/offerSheetPersistence.test.ts` (`80` at the Step 18
  baseline)

Plain-language read: the season-manager harness is now aligned with the current
runtime contracts, and the shared helper it depended on is no longer amplifying
typed debt. Step 20 should move directly to the execute-trade / offer-sheet
persistence cluster rather than reopening this season-helper seam.

## Step 20 Test Harness Wave Delta

Reviewed: 2026-04-22, after the second Architect test-harness hardening wave.

### Strict Probe Delta

| Measurement                                                                |              Step 19 close | Current |   Delta |
| -------------------------------------------------------------------------- | -------------------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json`            |                      2,403 |   2,228 |    -175 |
| `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts` | 95 at the Step 18 baseline |       0 | Cleared |
| `tests/architect/offerSheetPersistence.test.ts`                            | 80 at the Step 18 baseline |       0 | Cleared |

### What Changed

- `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
  now uses typed trade fixture builders plus required updated-team,
  trade-exception, and history readers aligned with
  `ArchitectMutationResult` instead of assuming optional mutation output is
  always present.
- `tests/architect/offerSheetPersistence.test.ts` now builds
  `storeOfferSheet` state/payload fixtures against the live
  `computeWorldMutation` signature and resolves offer-sheet/team/player updates
  through required helper functions instead of raw optional arrays.
- The approved narrow node test run passed for both touched harnesses:
  `npm run test:node -- --reporter=dot tests/architect/offerSheetPersistence.test.ts src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
  finished with `37 / 37` tests green.

### Remaining Test Hotspots After Step 20

The Step 20 wave cleared the planned execute-trade / offer-sheet persistence
cluster. The next strongest remaining Architect strict hotspots are now:

- `tests/architect/capLegalityValidation.test.ts` (`69`)
- `tests/architect/renounceRights.test.ts` (`66`)
- `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` (`64`)
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` (`64`)
- `tests/architect/worldManager.test.ts` (`64`)
- `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts` (`62`)
- `src/tests/architect/exceptionManagement.test.ts` (`58`)
- `tests/architect/teamLoader.test.ts` (`52`)

`src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
and `tests/architect/offerSheetPersistence.test.ts` no longer appear anywhere
in the Architect strict output.

Plain-language read: Step 20 finished the planned execute-trade / offer-sheet
persistence cluster and shifted the remaining test backlog toward cap legality,
renounce-rights persistence, exception/season parity guardrails, and the
mutation persistence-truth/world-manager family. Step 21 should classify those
remaining clusters before the master checkpoint decides whether another wave is
still required.

## Master Plan Test Review

Reviewed: 2026-04-22, after Steps 19-20 completed the planned high-value test
harness waves.

### Updated Test-Side Marker Counts

| Marker                | Step 9 review | Current | Delta |
| --------------------- | ------------: | ------: | ----: |
| `any`                 |           637 |     637 |     0 |
| `as any`              |           332 |     332 |     0 |
| `as unknown as`       |            44 |      44 |     0 |
| `@ts-ignore`          |             0 |       0 |     0 |
| `@ts-expect-error`    |             1 |       1 |     0 |
| `Record<string, any>` |            42 |      41 |    -1 |

`unknown` remains a visibility metric rather than a dishonesty score. Test-side
`unknown` moved from `1,096` in the Step 9 review to `1,121` (`+25`) because
the latest harness waves tightened optional/result access around truthful
mutation outputs rather than removing boundary-shaped `unknown` usage.

### Which Central Harnesses Improved Materially In Steps 19–20

- `tests/helpers/architectTestHelpers.ts` and
  `tests/architect/seasonManager.test.ts` are now clear under the Architect
  strict probe after Step 19.
- `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
  and `tests/architect/offerSheetPersistence.test.ts` are now also clear under
  the Architect strict probe after Step 20.
- The Architect strict probe dropped from `2,501` at the Step 18 runtime review
  to `2,228` after Steps 19-20 (`-273` total), and the combined high-value
  season / execute-trade / offer-sheet cluster no longer appears in the failing
  file list.

### Current Test Concentration

The remaining Architect strict backlog is still overwhelmingly test-driven:

- `tests/architect/`: `624`
- `src/tests/architect/`: `934`
- `tests/trade/`: `439`

That is `1,997 / 2,228` current Architect strict errors (`89.6%`) still living
in tests, while `src/features/architect/` runtime code is down to `123`.

Current top remaining test hotspots:

- `tests/architect/capLegalityValidation.test.ts` (`69`)
- `tests/architect/renounceRights.test.ts` (`66`)
- `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` (`64`)
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` (`64`)
- `tests/architect/worldManager.test.ts` (`64`)
- `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts` (`62`)
- `src/tests/architect/exceptionManagement.test.ts` (`58`)
- `tests/architect/teamLoader.test.ts` (`52`)

### Remaining Test Backlog Classification

| Classification                                                           | File or group                                                                                                                                                                                                                                                                                                                                                                                                   | Why it belongs here now                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Immediate next-wave candidate`                                          | `tests/architect/capLegalityValidation.test.ts`, `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`, `tests/architect/worldManager.test.ts`, `tests/architect/teamLoader.test.ts`, and `tests/architect/renounceRights.test.ts`                                                                                                                                                                   | These files now dominate the remaining persistence/world/cap truth layer. They sit closest to the hardened runtime readers and mutation carriers, so tightening them should collapse the next highest-leverage assignability/nullable test debt rather than widening into broad parity suites. |
| `Safe to defer only if runtime strictness is otherwise mission-complete` | `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts`, `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts`, `src/tests/architect/exceptionManagement.test.ts`, plus broader integration-style suites like `tests/architect/contractNormalization.test.ts`, `tests/architect/e2e-workflows.test.ts`, and `tests/architect/integration.test.ts` | These remain important, but they are broader exception/parity or end-to-end harnesses rather than the next closest trust boundary. They should not outrank the persistence/world/cap truth cluster unless the master checkpoint shows the remaining backlog is otherwise nearly closed.        |
| `Needs architecture-contract decision`                                   | None currently identified from live evidence                                                                                                                                                                                                                                                                                                                                                                    | The remaining backlog still reads as technical contract/test debt rather than a blocked product or architecture choice.                                                                                                                                                                        |

### Conclusion

The high-value test layer is materially better than it was at the Step 18
runtime review, but it is not yet mostly reinforcing runtime truth. The most
important season, execute-trade, and offer-sheet harnesses are now aligned with
the runtime contracts, yet almost ninety percent of the remaining Architect
strict backlog still sits in tests and the next strongest cluster is still the
persistence/world/cap truth layer. In plain terms: the plan should not declare
the test layer mostly hardened yet, but the remaining priority is now much more
focused than it was before Steps 19-20.

## Master Hardening Checkpoint

Reviewed: 2026-04-22, after Steps 19-21 completed the first persistence/test
normalization wave.

### Probe Delta

| Command                                                                 | Original baseline | Step 14 resume baseline | Current | Reading                                                                                                                                                       |
| ----------------------------------------------------------------------- | ----------------: | ----------------------: | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                     |                 0 | compatibility-only pass |       0 | Root compatibility remains green, but root `strict: false` still means this is not mission-completion evidence.                                               |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |               244 |                       0 |       0 | Shared/runtime strict work remains fully green; no shared regression is blocking the mission.                                                                 |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |             2,567 |                   2,632 |   2,228 | Architect/test strict posture improved materially (`-339` vs the original baseline, `-404` vs Step 14), but it remains the mission blocker by a large margin. |

### Current Architect Strict Concentration

- The Architect strict probe still reports `2,228` errors across `168` files.
- The top `10` files still account for `598 / 2,228` errors (`26.8%`).
- The top `20` files would still account for `962 / 2,228` errors (`43.2%`).

That is materially improved from the Step 14 resume state, but it is still too
broad to describe as one small final cleanup pass.

Top current error families:

- `TS18048` (`555`)
- `TS7006` (`269`)
- `TS2322` (`251`)
- `TS2345` (`238`)
- `TS18049` (`192`)
- `TS18047` (`147`)

Top current hotspots:

- `tests/architect/capLegalityValidation.test.ts` (`69`)
- `tests/architect/renounceRights.test.ts` (`66`)
- `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` (`64`)
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` (`64`)
- `tests/architect/worldManager.test.ts` (`64`)
- `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts` (`62`)
- `src/tests/architect/exceptionManagement.test.ts` (`58`)
- `tests/architect/teamLoader.test.ts` (`52`)
- `tests/architect/contractNormalization.test.ts` (`50`)
- `tests/architect/e2e-workflows.test.ts` (`49`)

### Readiness Verdict

- Are we now close to complete project hardening?
  No. Shared/runtime is complete on its strict probe, but the Architect/test
  surface still has a large mission-area backlog.
- If not, exactly what remains?
  The remaining backlog is now concentrated in three families:
  persistence/world truth harnesses (`mutationPipeline.tradePersistenceTruth`,
  `worldManager`, `teamLoader`), cap/rules persistence harnesses
  (`capLegalityValidation`, `renounceRights`), and broader exception/parity /
  integration guardrails (`phase76`, `phase74`, `exceptionManagement`, plus
  larger integration suites).
- What is the next highest-leverage wave?
  The persistence/world/cap truth layer remains highest leverage. The next
  honest move is multiple additional waves, starting with the persistence/world
  truth cluster and then the cap legality / renounce-rights cluster.

### Checkpoint Decision

The remaining mission-area backlog is still broad enough to require multiple
additional waves. This checkpoint therefore extends the same master plan with
Steps 23-25 rather than allowing any final-review or closeout path.

## Step 23 Persistence/World Truth Wave Delta

Reviewed: 2026-04-22, after the third Architect persistence/world-truth wave.

### Strict Probe Delta

| Measurement                                                      |           Step 22 checkpoint | Current |   Delta |
| ---------------------------------------------------------------- | ---------------------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json`  |                        2,228 |   2,050 |    -178 |
| `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` | 64 at the Step 22 checkpoint |       0 | Cleared |
| `tests/architect/worldManager.test.ts`                           | 64 at the Step 22 checkpoint |       0 | Cleared |
| `tests/architect/teamLoader.test.ts`                             | 52 at the Step 22 checkpoint |       0 | Cleared |

### What Changed

- `tests/helpers/architectTestHelpers.ts` now distinguishes persisted world
  team snapshots from fully hydrated mock teams via `MockTeamSnapshot`, and its
  `MockWorldMetadata` type now truthfully overrides `parentWorldId` and `stats`
  instead of inheriting the base fixture's narrower literals.
- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` now uses
  required snapshot and offer-sheet readers, helper-derived fixture builders,
  and explicit `computeWorldMutation` current-state adapters instead of raw
  optional persisted blobs.
- `tests/architect/worldManager.test.ts` and
  `tests/architect/teamLoader.test.ts` now use required metadata/player/totals
  readers, truthful snapshot seeding for missing-player coverage, and `.js`
  helper imports instead of `.ts` extension imports.
- The approved narrow node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot tests/architect/teamLoader.test.ts tests/architect/worldManager.test.ts tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
  finished with `87 / 87` tests green.

### Remaining Hotspots After Step 23

The Step 23 wave cleared the planned persistence/world truth cluster. The next
strongest remaining Architect strict hotspots are now:

- `tests/architect/capLegalityValidation.test.ts` (`69`)
- `tests/architect/renounceRights.test.ts` (`67`)
- `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` (`64`)
- `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts` (`62`)
- `src/tests/architect/exceptionManagement.test.ts` (`58`)
- `tests/architect/contractNormalization.test.ts` (`50`)
- `tests/architect/e2e-workflows.test.ts` (`49`)

`tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`,
`tests/architect/worldManager.test.ts`, and
`tests/architect/teamLoader.test.ts` no longer appear in the Architect strict
output.

Plain-language read: Step 23 finished the planned persistence/world truth
cluster and removed three of the most direct post-checkpoint contract tests
from the Architect strict backlog. The next honest move is the bounded cap
legality / renounce-rights wave rather than drifting into the broader
exception/parity integration surfaces.

## Step 24 Cap Legality / Rights Wave Delta

Reviewed: 2026-04-22, after the fourth Architect cap-legality/rights wave.

### Strict Probe Delta

| Measurement                                                     |     Step 23 wave | Current |   Delta |
| --------------------------------------------------------------- | ---------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json` |            2,050 |   1,914 |    -136 |
| `tests/architect/capLegalityValidation.test.ts`                 | 69 after Step 23 |       0 | Cleared |
| `tests/architect/renounceRights.test.ts`                        | 67 after Step 23 |       0 | Cleared |

### What Changed

- `tests/architect/capLegalityValidation.test.ts` now imports the shared
  architect helpers through the live `.js` surface, uses local
  required-reader helpers for violations/warnings/team updates, aligns its
  sign/free-agent and cap-legality fixtures with the current validator
  contracts, and narrows free-agency payload reads before asserting on them.
- `tests/architect/renounceRights.test.ts` now uses helper-backed player/team
  fixtures, required persisted-state readers, and explicit mutation-result
  readers instead of raw optional persisted snapshots and stale shape
  assumptions.
- The approved narrow node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot tests/architect/capLegalityValidation.test.ts tests/architect/renounceRights.test.ts`
  finished with `248 / 248` tests green.
- Root compatibility still holds: `npm run typecheck` passed after the Step 24
  edits.

### Remaining Hotspots After Step 24

The Step 24 wave cleared the planned cap-legality / renounce-rights cluster.
The strongest remaining Architect strict hotspots are now:

- `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` (`64`)
- `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts` (`62`)
- `src/tests/architect/exceptionManagement.test.ts` (`58`)
- `tests/architect/contractNormalization.test.ts` (`50`)
- `tests/architect/integration.test.ts` (`49`)
- `tests/architect/e2e-workflows.test.ts` (`49`)
- `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts` (`41`)
- `tests/architect/schemaAdapter.test.ts` (`39`)

`tests/architect/capLegalityValidation.test.ts` and
`tests/architect/renounceRights.test.ts` no longer appear in the Architect
strict output.

Plain-language read: Step 24 removed the remaining cap-legality / renounce-rights
truth cluster exactly as planned and pulled the Architect strict backlog down to
`1,914`. The remaining debt is no longer primarily about cap/rule fixture truth;
it is concentrated in exception lifecycle/parity guardrails plus a smaller set
of integration/normalization harnesses, which is the right input for the Step 25
checkpoint.

## Post-Step-24 Hardening Checkpoint

Reviewed: 2026-04-22, after Steps 23-24 completed the planned persistence/world/cap truth waves.

### Probe Delta

| Command                                                                 | Original baseline | Step 14 resume baseline | Step 22 checkpoint | Current | Reading                                                                                                                                                                          |
| ----------------------------------------------------------------------- | ----------------: | ----------------------: | -----------------: | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                     |                 0 | compatibility-only pass |                  0 |       0 | Root compatibility remains green, but root `strict: false` still means this is not mission-completion evidence.                                                                  |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |               244 |                       0 |                  0 |       0 | Shared/runtime strict work remains fully green; no shared regression is blocking the mission.                                                                                    |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |             2,567 |                   2,632 |              2,228 |   1,914 | Architect/test strict posture improved materially (`-653` vs the original baseline, `-718` vs Step 14, `-314` vs Step 22), but it remains the mission blocker by a large margin. |

### Current Architect Strict Concentration

- The remaining backlog is now led by the exception/parity guardrail cluster:
  `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` (`64`),
  `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts` (`62`), and
  `src/tests/architect/exceptionManagement.test.ts` (`58`).
- The next tier is the integration/normalization cluster:
  `tests/architect/contractNormalization.test.ts` (`50`),
  `tests/architect/integration.test.ts` (`49`),
  `tests/architect/e2e-workflows.test.ts` (`49`),
  `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts` (`41`), and
  `tests/architect/schemaAdapter.test.ts` (`39`).
- The previous persistence/world/cap truth hotspots from Steps 23-24 no longer
  lead the backlog. That is real progress, but it does not collapse the
  remaining Architect/test debt into one tiny final pass.

### Checkpoint Decision

The remaining mission-area backlog is still **multiple waves**, not one final
bounded cleanup pass and not an architecture-decision blocker.

The next honest split is:

1. one bounded wave for the remaining exception lifecycle / parity guardrail
   harnesses;
2. one follow-up wave for the remaining integration / normalization harnesses;
3. a fresh checkpoint after those waves before any final-review claim.

Plain-language read: the hardening plan is substantially healthier than it was
at the Step 22 checkpoint, and the cap-legality / renounce-rights cluster is no
longer in the way. But `1,914` Architect-strict errors is still far beyond a
truthful final-review threshold, and the remaining debt is clearly split across
at least two bounded test waves. The plan must therefore continue with a
dedicated exception/parity wave first, then an integration/normalization wave,
before another readiness checkpoint can honestly decide whether closeout is in
range.

## Step 26 Exception / Parity Wave Delta

Reviewed: 2026-04-22, after the fifth Architect exception/parity wave.

### Strict Probe Delta

| Measurement                                                                                             | Step 25 checkpoint | Current |   Delta |
| ------------------------------------------------------------------------------------------------------- | -----------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json`                                         |              1,914 |   1,730 |    -184 |
| `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` |   64 after Step 25 |       0 | Cleared |
| `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts`                                     |   62 after Step 25 |       0 | Cleared |
| `src/tests/architect/exceptionManagement.test.ts`                                                       |   58 after Step 25 |       0 | Cleared |

### What Changed

- `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts`
  now treats helper-built teams as always carrying exception state, uses a
  required-reader handoff only for the explicit missing-exceptions edge case,
  and no longer leaks optionality across the entire harness.
- `src/tests/architect/exceptionManagement.test.ts` now resolves mutation
  results through required updated-team, updated-exceptions, and totals readers
  instead of repeatedly assuming `teamUpdates[0]` and nested exception bags are
  always present.
- `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts` now uses
  typed room-exception fixtures, required violation/team-update readers, and
  explicit room-exception narrowing across its mutation and reload proofs.
- The approved narrow node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts src/tests/architect/exceptionManagement.test.ts`
  finished with `59 / 59` tests green.
- Root compatibility still holds: `npm run typecheck` passed after the Step 26
  edits.

### Remaining Hotspots After Step 26

The Step 26 wave cleared the planned exception/parity guardrail cluster. The
strongest remaining Architect strict hotspots are now:

- `tests/architect/contractNormalization.test.ts` (`50`)
- `tests/architect/integration.test.ts` (`49`)
- `tests/architect/e2e-workflows.test.ts` (`49`)
- `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts` (`41`)
- `tests/architect/schemaAdapter.test.ts` (`39`)
- `src/tests/architect/phase17_entitlement_routing_guardrail.test.ts` (`37`)
- `src/tests/tradeMachine/phase5DraftPositions.test.ts` (`34`)
- `src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts` (`34`)
- `src/features/architect/utils/mutationPipeline.ts` (`34`)
- `tests/architect/extension_voidedByExtension.test.ts` (`33`)

The three Step 26 target files no longer appear in the Architect strict output.

Plain-language read: Step 26 removed the full exception/parity guardrail wave as
planned and pushed the Architect strict backlog down to `1,730`. The remaining
debt is now led by the integration/normalization cluster identified in Step 25,
with a smaller tail of trade/entitlement/mutation guardrails behind it. The next
honest move is Step 27's integration/normalization wave rather than reopening
the cleared exception/parity cluster.

## Step 27 Integration / Normalization Wave Delta

Reviewed: 2026-04-23, after the sixth Architect integration/normalization wave.

### Strict Probe Delta

| Measurement                                                             |     Step 26 wave | Current |   Delta |
| ----------------------------------------------------------------------- | ---------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |            1,730 |   1,502 |    -228 |
| `tests/architect/contractNormalization.test.ts`                         | 50 after Step 26 |       0 | Cleared |
| `tests/architect/integration.test.ts`                                   | 49 after Step 26 |       0 | Cleared |
| `tests/architect/e2e-workflows.test.ts`                                 | 49 after Step 26 |       0 | Cleared |
| `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts` | 41 after Step 26 |       0 | Cleared |
| `tests/architect/schemaAdapter.test.ts`                                 | 39 after Step 26 |       0 | Cleared |

### What Changed

- `tests/architect/contractNormalization.test.ts` now requires normalized
  contract/free-agency structures before property reads and no longer assumes
  optional normalization outputs are always present.
- `tests/architect/schemaAdapter.test.ts` now imports the helper layer through
  the live `.js` surface, uses typed adapter input/result helpers, and resolves
  trade input/team output through required readers instead of raw optional
  return shapes.
- `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts` now
  types its minimal team fixtures truthfully and resolves updated post-trade
  teams through required readers before asserting on entitlement transfer state.
- `tests/architect/integration.test.ts` and
  `tests/architect/e2e-workflows.test.ts` now use typed authoritative trade
  compute helpers, required world/team/source/roster readers, and current `.js`
  helper imports instead of stale `.ts` imports and repeated raw optional-state
  assumptions.
- The approved narrow node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot tests/architect/contractNormalization.test.ts tests/architect/integration.test.ts tests/architect/e2e-workflows.test.ts src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts tests/architect/schemaAdapter.test.ts`
  finished with `100 / 100` tests green.
- Root compatibility still holds: `npm run typecheck` passed after the Step 27
  edits.

### Remaining Hotspots After Step 27

The Step 27 wave cleared the planned integration/normalization cluster. The
strongest remaining Architect strict hotspots are now:

- `src/tests/architect/phase17_entitlement_routing_guardrail.test.ts` (`37`)
- `src/tests/tradeMachine/phase5DraftPositions.test.ts` (`34`)
- `src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts` (`34`)
- `src/features/architect/utils/mutationPipeline.ts` (`34`)
- `tests/architect/extension_voidedByExtension.test.ts` (`33`)
- `tests/trade/validatorContractCleanup.test.ts` (`32`)
- `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts` (`31`)
- `tests/trade/validatorTrustFixes.test.ts` (`30`)
- `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts` (`30`)
- `tests/trade/consent_and_reacq.test.ts` (`29`)

The five Step 27 target files no longer appear in the Architect strict output.

Plain-language read: Step 27 removed the remaining integration/normalization
cluster exactly as planned and pulled the Architect strict backlog down to
`1,502`. That is real progress, but the remaining debt is still spread across
multiple trade/entitlement guardrail and mutation-pipeline-adjacent surfaces.
Step 28 therefore needs to act as a real checkpoint and extend the plan again
unless the cross-probe evidence says the remaining mission-area backlog has
collapsed more than this wave suggests.

## Post-Step-27 Hardening Checkpoint

Reviewed: 2026-04-23, after Steps 26-27 completed the planned
exception/parity and integration/normalization waves.

### Probe Delta

| Command                                                                 | Original baseline | Step 14 resume baseline | Step 22 checkpoint | Step 25 checkpoint | Current | Reading                                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ----------------: | ----------------------: | -----------------: | -----------------: | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                     |                 0 | compatibility-only pass |                  0 |                  0 |       0 | Root compatibility remains green, but root `strict: false` still means this is not mission-completion evidence.                                                                                         |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |               244 |                       0 |                  0 |                  0 |       0 | Shared/runtime strict work remains fully green; no shared regression is blocking the mission.                                                                                                           |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |             2,567 |                   2,632 |              2,228 |              1,914 |   1,502 | Architect/test strict posture improved materially (`-1,065` vs the original baseline, `-1,130` vs Step 14, `-726` vs Step 22, `-412` vs Step 25), but it remains the mission blocker by a large margin. |

### Current Architect Strict Concentration

- The remaining backlog is now led by the next guardrail/runtime-owner tier:
  `src/tests/architect/phase17_entitlement_routing_guardrail.test.ts` (`37`),
  `src/tests/tradeMachine/phase5DraftPositions.test.ts` (`34`),
  `src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts` (`34`),
  `src/features/architect/utils/mutationPipeline.ts` (`34`), and
  `tests/architect/extension_voidedByExtension.test.ts` (`33`).
- The next strongest validator/unit tier is
  `tests/trade/validatorContractCleanup.test.ts` (`32`),
  `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts` (`31`),
  `tests/trade/validatorTrustFixes.test.ts` (`30`),
  `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts` (`30`), and
  `tests/trade/consent_and_reacq.test.ts` (`29`).
- The Step 26-27 target files no longer lead the backlog, and shared strict is
  still fully green. That is real progress, but it does not collapse the
  remaining Architect/test work into a truthful final-review-sized cleanup.

### Checkpoint Decision

The mission is **not** honestly ready for final review. `1,502`
Architect-strict errors still represent substantial mission-area backlog, and
the remaining debt is split across at least two more bounded waves rather than
one small final pass.

The next honest split is:

1. one bounded wave for the remaining Architect/trade guardrail cluster,
   including only the tiny `mutationPipeline.ts` fixups directly required to
   keep that guardrail cluster truthful;
2. one follow-up wave for the remaining trade validator/unit truth cluster;
3. another checkpoint after those waves before any final-review claim.

Plain-language read: after Steps 26-27, the plan is materially healthier and
shared/runtime strict remains fully green, but final review is still blocked by
large Architect/test debt. The plan must extend again rather than route to
closeout.

## Step 29 Architect / Trade Guardrail Wave Delta

Reviewed: 2026-04-23, after the seventh Architect/trade guardrail wave.

### Strict Probe Delta

| Measurement                                                                                          | Step 28 checkpoint | Current |   Delta |
| ---------------------------------------------------------------------------------------------------- | -----------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json`                                      |              1,502 |   1,336 |    -166 |
| `src/tests/architect/phase17_entitlement_routing_guardrail.test.ts`                                  |   37 after Step 28 |       0 | Cleared |
| `src/tests/tradeMachine/phase5DraftPositions.test.ts`                                                |   34 after Step 28 |       0 | Cleared |
| `src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts`                         |   34 after Step 28 |       0 | Cleared |
| `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts`                      |   31 after Step 28 |       0 | Cleared |
| `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts` |   30 after Step 28 |       0 | Cleared |

### What Changed

- `src/tests/architect/phase17_entitlement_routing_guardrail.test.ts` now uses
  typed entitlement fixtures and required post-trade team readers instead of
  `never[]` fixture defaults and raw `teamUpdates.find(...).team` assumptions.
- `src/tests/tradeMachine/phase5DraftPositions.test.ts` now routes its draft
  pick assertions through required draft-pick readers instead of repeatedly
  assuming every season-manager result exposes `draftPicks[0]` directly.
- `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts`
  now types its source-scan reader/cache surfaces, narrows caught errors before
  reading their message, and requires TEAM contract deep rules before use.
- `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts`
  now uses a typed test-team model, required totals readers, and explicit
  source-scan match narrowing so its SSOT/persist-reload assertions line up with
  the real totals contract.
- `src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts`
  now uses typed trade player/team fixtures, explicit mutation vs legacy
  current-state helpers, and required validated-trade-context readers instead of
  implicit-any fixture builders and raw optional context reads.
- The approved narrow node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot src/tests/architect/phase17_entitlement_routing_guardrail.test.ts src/tests/tradeMachine/phase5DraftPositions.test.ts src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts`
  finished with `100 / 100` tests green.
- Root compatibility still holds: `npm run typecheck` passed after the Step 29
  edits.

### Remaining Hotspots After Step 29

The Step 29 wave cleared the planned Architect/trade guardrail cluster. The
strongest remaining Architect strict hotspots are now:

- `src/features/architect/utils/mutationPipeline.ts` (`34`)
- `tests/architect/extension_voidedByExtension.test.ts` (`33`)
- `tests/trade/validatorContractCleanup.test.ts` (`32`)
- `tests/trade/validatorTrustFixes.test.ts` (`30`)
- `tests/trade/consent_and_reacq.test.ts` (`29`)
- `src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts` (`29`)
- `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts` (`28`)
- `src/tests/architect/signAndTrade.test.ts` (`27`)
- `tests/trade/tpe_creation_expiry_usage.test.ts` (`26`)
- `tests/trade/secondApronBoundary.test.ts` (`26`)

The five Step 29 target files no longer appear in the Architect strict output.

Plain-language read: Step 29 removed the remaining planned guardrail cluster and
pulled the Architect strict backlog down to `1,336`. The next blocker is now
the validator/unit cluster called out in Step 30, with `mutationPipeline.ts`
still sitting as the top runtime-owner hotspot but not yet forcing a dedicated
runtime wave by itself.

## Step 30 Trade Validator / Unit Truth Wave Delta

Reviewed: 2026-04-23, after the eighth validator/unit truth wave.

### Strict Probe Delta

| Measurement                                                     |          Step 29 | Current |   Delta |
| --------------------------------------------------------------- | ---------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json` |            1,336 |   1,212 |    -124 |
| `tests/architect/extension_voidedByExtension.test.ts`           | 33 after Step 29 |       0 | Cleared |
| `tests/trade/validatorContractCleanup.test.ts`                  | 32 after Step 29 |       0 | Cleared |
| `tests/trade/validatorTrustFixes.test.ts`                       | 30 after Step 29 |       0 | Cleared |
| `tests/trade/consent_and_reacq.test.ts`                         | 29 after Step 29 |       0 | Cleared |

### What Changed

- `tests/architect/extension_voidedByExtension.test.ts` now types its salary
  rows against the live mutation-pipeline contract, uses a numeric mutation
  timestamp, and routes future-contract assertions through required salary-row
  readers instead of raw optional chains.
- `tests/trade/consent_and_reacq.test.ts` now uses normalized-player and
  validator-team fixture shapes that match the live consent/reacquisition
  rules instead of minimal ad hoc objects that only compiled because of loose
  inference.
- `tests/trade/validatorContractCleanup.test.ts` now uses typed validator
  player/team/slot fixtures, preserves routing entitlement data across the
  post-trade snapshot bridge, and narrows canonical team-result / trade-receipt
  / validated-context reads instead of relying on implicit-any bags.
- `tests/trade/validatorTrustFixes.test.ts` now uses typed contract/player/team
  fixtures, a narrow skip-reason reader for rule envelopes, and an extracted
  `executeTrade` mutation helper so its apply-time validation assertions match
  the real `computeWorldMutation` contract.
- The approved bounded node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot tests/trade/validatorContractCleanup.test.ts tests/trade/validatorTrustFixes.test.ts tests/trade/consent_and_reacq.test.ts tests/architect/extension_voidedByExtension.test.ts`
  finished with `21 / 21` tests green.
- Root compatibility still holds: `npm run typecheck` passed after the Step 30
  edits.

### Remaining Hotspots After Step 30

The Step 30 wave cleared the planned validator/unit cluster. The strongest
remaining Architect strict hotspots are now:

- `src/features/architect/utils/mutationPipeline.ts` (`34`)
- `src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts` (`29`)
- `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts` (`28`)
- `src/tests/architect/signAndTrade.test.ts` (`27`)
- `tests/trade/tpe_creation_expiry_usage.test.ts` (`26`)
- `tests/trade/secondApronBoundary.test.ts` (`26`)
- `src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts` (`26`)
- `tests/trade/timingEnforcement_authoritative.test.ts` (`24`)
- `tests/trade/reacquisition_bar.test.ts` (`24`)
- `src/tests/architect/deadCapManagement.test.ts` (`24`)

The four Step 30 target files no longer appear in the Architect strict output.

Plain-language read: Step 30 removed the next high-value validator/unit truth
cluster and pulled Architect strict down to `1,212`. The backlog is now back in
the DARE/runtime-adjacent guardrail and trade-rule families, which is exactly
what Step 31 needs to reassess before extending the master plan again.

## Post-Step-30 Hardening Checkpoint

Reviewed: 2026-04-23, after Steps 29-30 completed the planned
Architect/trade guardrail and validator/unit truth waves.

### Probe Delta

| Command                                                                 | Original baseline | Step 14 resume baseline | Step 22 checkpoint | Step 28 checkpoint | Current | Reading                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ----------------: | ----------------------: | -----------------: | -----------------: | ------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                     |                 0 | compatibility-only pass |                  0 |                  0 |       0 | Root compatibility remains green, but root `strict: false` still means this is not mission-completion evidence.                                                                                           |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |               244 |                       0 |                  0 |                  0 |       0 | Shared/runtime strict work remains fully green; no shared regression is blocking the mission.                                                                                                             |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |             2,567 |                   2,632 |              2,228 |              1,502 |   1,212 | Architect/test strict posture improved materially (`-1,355` vs the original baseline, `-1,420` vs Step 14, `-1,016` vs Step 22, `-290` vs Step 28), but it remains the mission blocker by a large margin. |

### Current Architect Strict Concentration

- The remaining backlog is now led by the next runtime-owner and Architect
  DARE/trade-apply tier: `src/features/architect/utils/mutationPipeline.ts`
  (`34`), `src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts`
  (`29`), `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts`
  (`28`), `src/tests/architect/signAndTrade.test.ts` (`27`), and
  `src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts`
  (`26`).
- The next strongest trade-rule unit tier is
  `tests/trade/tpe_creation_expiry_usage.test.ts` (`26`),
  `tests/trade/secondApronBoundary.test.ts` (`26`),
  `tests/trade/timingEnforcement_authoritative.test.ts` (`24`),
  `tests/trade/reacquisition_bar.test.ts` (`24`), and
  `tests/trade/tpe_absorption_fail_closed.test.ts` (`23`).
- The Step 29-30 target files no longer lead the backlog, and shared strict is
  still fully green. That is real progress, but it does not collapse the
  remaining Architect/test work into a truthful final-review-sized cleanup.

### Checkpoint Decision

The mission is **not** honestly ready for final review. `1,212`
Architect-strict errors still represent substantial mission-area backlog, and
the remaining debt is still split across at least two more bounded waves rather
than one small final pass.

The next honest split is:

1. one bounded wave for the remaining Architect DARE / trade-apply cluster,
   including only the tiny `mutationPipeline.ts` fixups directly required to
   keep that cluster truthful;
2. one follow-up wave for the remaining trade-rule / TPE unit truth cluster;
3. another checkpoint after those waves before any final-review claim.

Plain-language read: after Steps 29-30, the plan is materially healthier and
shared/runtime strict remains fully green, but final review is still blocked by
large Architect/test debt concentrated in the next DARE/runtime-adjacent and
trade-rule unit clusters. The plan must extend again rather than route to
closeout.

## Step 32 Architect DARE / Trade-Apply Wave Delta

Reviewed: 2026-04-23, after the ninth Architect DARE / trade-apply wave.

### Strict Probe Delta

| Measurement                                                                     | Step 31 checkpoint | Current |   Delta |
| ------------------------------------------------------------------------------- | -----------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json`                 |              1,212 |   1,079 |    -133 |
| `src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts`             |   29 after Step 31 |       0 | Cleared |
| `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts`          |   28 after Step 31 |       0 | Cleared |
| `src/tests/architect/signAndTrade.test.ts`                                      |   27 after Step 31 |       0 | Cleared |
| `src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts`  |   26 after Step 31 |       0 | Cleared |
| `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.ts` |   23 after Step 31 |       0 | Cleared |

### What Changed

- `src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts` now
  types its reused script-content variables explicitly instead of relying on
  implicit `any` across regex/text assertions.
- `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts` now
  types its mocked Firestore/season helper parameters, DARE input bridge, and
  mock-call assertions so the smoke tests read the actual captured DARE payload
  instead of closure-local `null` placeholders.
- `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.ts`
  now types its source-scan helpers and validation-call accumulators so the
  guardrail stays strict without changing any of the purity assertions it
  enforces.
- `src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts`
  now requires non-null TPE history entries before reading them and uses a
  truthful partial-history model for legacy exception-history rows.
- `src/tests/architect/signAndTrade.test.ts` now routes its changed-team and
  player assertions through required readers, types the local roster filler and
  validation-order arrays, and builds mocked trade-validation results through
  the file's canonical result helper instead of ad hoc casts.
- The approved bounded node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts src/tests/architect/signAndTrade.test.ts src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.ts src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts`
  finished with `83 / 83` tests green.
- Root compatibility still holds: `npm run typecheck` passed after the Step 32
  edits.

### Remaining Hotspots After Step 32

The Step 32 wave cleared the planned Architect DARE / trade-apply cluster. The
strongest remaining Architect strict hotspots are now:

- `src/features/architect/utils/mutationPipeline.ts` (`34`)
- `tests/trade/tpe_creation_expiry_usage.test.ts` (`26`)
- `tests/trade/secondApronBoundary.test.ts` (`26`)
- `tests/trade/timingEnforcement_authoritative.test.ts` (`24`)
- `tests/trade/reacquisition_bar.test.ts` (`24`)
- `src/tests/architect/deadCapManagement.test.ts` (`24`)
- `tests/trade/tpe_absorption_fail_closed.test.ts` (`23`)
- `src/shared/components/EditContractModal.tsx` (`22`)
- `src/tests/tradeMachine/seasonSwapResolution.test.ts` (`21`)
- `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.ts` (`20`)

The five Step 32 target files no longer appear in the Architect strict output.

Plain-language read: Step 32 removed the largest remaining Architect DARE /
trade-apply truth cluster and pulled Architect strict down to `1,079`. The next
highest-leverage wave is now the trade-rule / TPE unit cluster already queued in
Step 33, with `mutationPipeline.ts` still sitting as the top runtime-owner
hotspot but not yet forcing a standalone runtime wave.

## Step 33 Trade-Rule / TPE Unit Wave Delta

Reviewed: 2026-04-23, after the tenth trade-rule / TPE unit wave.

### Strict Probe Delta

| Measurement                                                     |          Step 32 | Current |   Delta |
| --------------------------------------------------------------- | ---------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json` |            1,079 |     944 |    -135 |
| `tests/trade/tpe_creation_expiry_usage.test.ts`                 | 26 after Step 32 |       0 | Cleared |
| `tests/trade/secondApronBoundary.test.ts`                       | 26 after Step 32 |       0 | Cleared |
| `tests/trade/timingEnforcement_authoritative.test.ts`           | 24 after Step 32 |       0 | Cleared |
| `tests/trade/reacquisition_bar.test.ts`                         | 24 after Step 32 |       0 | Cleared |
| `tests/trade/tpe_absorption_fail_closed.test.ts`                | 23 after Step 32 |       0 | Cleared |

### What Changed

- `tests/trade/validation_caching.test.ts` now uses typed validator-input,
  player, and team fixtures plus a narrow warning-shape helper so the caching
  assertions no longer depend on implicit-any builders or `never[]` defaults.
- `tests/trade/tpe_absorption_fail_closed.test.ts` and
  `tests/trade/tpe_creation_expiry_usage.test.ts` now build team-held TPE,
  player, and team fixtures against the live validator contracts and route
  repeated `validateTrade` calls through shared params helpers instead of ad
  hoc object bags.
- `tests/trade/reacquisition_bar.test.ts` now types its helper issue arrays and
  reacquisition player fixtures truthfully, including string team identifiers
  that match the live eligibility rule contracts.
- `tests/trade/timingEnforcement_authoritative.test.ts` now types its trade
  harness builders, roster reducers, and warning readers so the timing rule
  assertions stay aligned with the live validator-team/player shapes.
- `tests/trade/secondApronBoundary.test.ts` now uses typed player/team/pick
  fixtures and a shared `validateTrade` params builder so the second-apron
  boundary assertions are enforced through the real trade-rule contract instead
  of loose fixture inference.
- The approved bounded node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot tests/trade/tpe_creation_expiry_usage.test.ts tests/trade/secondApronBoundary.test.ts tests/trade/timingEnforcement_authoritative.test.ts tests/trade/reacquisition_bar.test.ts tests/trade/tpe_absorption_fail_closed.test.ts tests/trade/validation_caching.test.ts`
  finished with `30 / 30` tests green.
- Root compatibility still holds: `npm run typecheck` passed after the Step 33
  edits.

### Remaining Hotspots After Step 33

The Step 33 wave cleared the planned trade-rule / TPE unit cluster. The
strongest remaining Architect strict hotspots are now:

- `src/features/architect/utils/mutationPipeline.ts` (`34`)
- `src/tests/architect/deadCapManagement.test.ts` (`24`)
- `src/shared/components/EditContractModal.tsx` (`22`)
- `src/tests/tradeMachine/seasonSwapResolution.test.ts` (`21`)
- `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.ts` (`20`)
- `tests/trade/twoWayPlayers_snapshot.test.ts` (`19`)
- `tests/architect/tradeManager.test.ts` (`19`)
- `src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.ts` (`19`)
- `src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.ts` (`19`)
- `tests/trade/secondApron_tpeBan.test.ts` (`18`)

The six Step 33 target files no longer appear in the Architect strict output.

Plain-language read: Step 33 removed the entire queued trade-rule / TPE unit
cluster and pulled Architect strict down to `944`, which is the first sub-1000
Architect checkpoint in this resumed master-plan run. That is real progress,
but the remaining backlog is still large enough that Step 34 must reassess the
mission honestly rather than routing to final review.

## Post-Step-33 Hardening Checkpoint

Reviewed: 2026-04-23, after Steps 32-33 completed the planned
Architect DARE/trade-apply and trade-rule/TPE unit waves.

### Probe Delta

| Command                                                                 | Original baseline | Step 14 resume baseline | Step 22 checkpoint | Step 31 checkpoint | Current | Reading                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ----------------: | ----------------------: | -----------------: | -----------------: | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                     |                 0 | compatibility-only pass |                  0 |                  0 |       0 | Root compatibility remains green, but root `strict: false` still means this is not mission-completion evidence.                                                                                          |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |               244 |                       0 |                  0 |                  0 |       0 | Shared/runtime strict work remains fully green; no shared regression is blocking the mission.                                                                                                            |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |             2,567 |                   2,632 |              2,228 |              1,212 |     944 | Architect/test strict posture improved materially (`-1,623` vs the original baseline, `-1,688` vs Step 14, `-1,284` vs Step 22, `-268` vs Step 31), but it remains the mission blocker by a wide margin. |

### Current Architect Strict Concentration

- The remaining backlog is now led by the next runtime-owner and
  season-state-cap tier: `src/features/architect/utils/mutationPipeline.ts`
  (`34`), `src/tests/architect/deadCapManagement.test.ts` (`24`),
  `src/shared/components/EditContractModal.tsx` (`22`), and
  `src/tests/tradeMachine/seasonSwapResolution.test.ts` (`21`).
- The strongest remaining Architect/test follow-on tier is
  `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.ts` (`20`),
  `src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.ts` (`19`),
  `src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.ts` (`19`),
  `tests/architect/tradeManager.test.ts` (`19`), and
  `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.ts` (`18`).
- The residual trade aftermath tier is now led by
  `tests/trade/twoWayPlayers_snapshot.test.ts` (`19`),
  `tests/trade/secondApron_tpeBan.test.ts` (`18`),
  `tests/trade/poisonPill_average.test.ts` (`17`), plus the next sign-and-trade,
  timing-soft-enforcement, and trade-kicker unit files that still sit outside a
  truthful final-review-sized cleanup.
- The Step 32-33 target files no longer lead the backlog, and shared strict is
  still fully green. That is real progress, but it does not collapse the
  remaining Architect/test work into a truthful final-review-sized cleanup.

### Checkpoint Decision

The mission is **not** honestly ready for final review. `944`
Architect-strict errors still represent substantial mission-area backlog, and
the remaining debt is still split across at least two more bounded waves rather
than one small final pass.

The next honest split is:

1. one bounded wave for the remaining Architect dead-cap / season-state truth
   cluster, including only the tiny `mutationPipeline.ts` fixups directly
   required to keep that cluster truthful;
2. one follow-up wave for the remaining trade aftermath / snapshot truth
   cluster;
3. another checkpoint after those waves before any final-review claim.

Plain-language read: after Steps 32-33, the plan is materially healthier and
shared/runtime strict remains fully green, but final review is still blocked by
the next dead-cap / season-state tier, the top runtime-owner hotspot, and the
residual trade aftermath unit cluster. The plan must extend again rather than
route to closeout.

## Step 35 Architect Dead-Cap / Season-State Wave Delta

Reviewed: 2026-04-23, after the eleventh Architect dead-cap / season-state wave.

### Strict Probe Delta

| Measurement                                                                        | Step 34 checkpoint | Current |   Delta |
| ---------------------------------------------------------------------------------- | -----------------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json`                    |                944 |     823 |    -121 |
| `src/tests/architect/deadCapManagement.test.ts`                                    |   24 after Step 34 |       0 | Cleared |
| `src/tests/tradeMachine/seasonSwapResolution.test.ts`                              |   21 after Step 34 |       0 | Cleared |
| `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.ts`              |   20 after Step 34 |       0 | Cleared |
| `src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.ts` |   19 after Step 34 |       0 | Cleared |
| `src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.ts`        |   19 after Step 34 |       0 | Cleared |
| `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.ts`   |   18 after Step 34 |       0 | Cleared |

### What Changed

- `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.ts`
  now types its salary-fixture inputs and routes optional totals, nullable
  violation results, and regex match captures through required readers instead
  of raw optional chains.
- `src/tests/tradeMachine/seasonSwapResolution.test.ts` now uses a required
  draft-pick reader for swap-resolution assertions so the test no longer
  dereferences optional `draftPicks` and `resolutionMeta` values directly.
- `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.ts` now
  uses required readers for `applyWorldMutation()` result summaries, changed
  teams, exception buckets, and changed players instead of assuming those
  optional result surfaces are always present.
- `src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.ts`
  and `src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.ts`
  now type their TPE record, history-entry, and helper-layer fixtures against
  the live trade-exception/history contracts, including truthful support for
  mixed legacy/canonical history rows.
- `src/tests/architect/deadCapManagement.test.ts` now routes mutation results
  through a required updated-team reader so the dead-cap assertions no longer
  depend on unchecked `teamUpdates[0]` access.
- The approved bounded node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot src/tests/architect/deadCapManagement.test.ts src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.ts src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.ts src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.ts src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.ts src/tests/tradeMachine/seasonSwapResolution.test.ts`
  finished with `85 / 85` tests green.
- Root compatibility still holds: `npm run typecheck` passed after the Step 35
  edits.

### Remaining Hotspots After Step 35

The Step 35 wave cleared the planned Architect dead-cap / season-state cluster.
The strongest remaining Architect strict hotspots are now:

- `src/features/architect/utils/mutationPipeline.ts` (`34`)
- `src/shared/components/EditContractModal.tsx` (`22`)
- `tests/trade/twoWayPlayers_snapshot.test.ts` (`19`)
- `tests/architect/tradeManager.test.ts` (`19`)
- `tests/trade/secondApron_tpeBan.test.ts` (`18`)
- `tests/trade/poisonPill_average.test.ts` (`17`)
- `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.ts` (`17`)
- `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.ts` (`17`)
- `tests/trade/signAndTrade_completeness.test.ts` (`16`)
- `tests/trade/consent_and_birdVeto.test.ts` (`16`)

The six Step 35 target files no longer appear in the Architect strict output.

Plain-language read: Step 35 removed the queued Architect dead-cap /
season-state truth cluster and pulled Architect strict down to `823`. The next
highest-leverage work is now the trade aftermath / snapshot cluster already
queued in Step 36, with `mutationPipeline.ts` and `EditContractModal.tsx`
remaining as the loudest non-cluster hotspots.

## Step 36 Trade Aftermath / Snapshot Wave Delta

Reviewed: 2026-04-24, after the twelfth trade aftermath / snapshot wave.

### Strict Probe Delta

| Measurement                                                     | Step 35 wave | Current |   Delta |
| --------------------------------------------------------------- | -----------: | ------: | ------: |
| `npm run typecheck -- --project tsconfig.architect-strict.json` |          823 |     709 |    -114 |
| `tests/trade/twoWayPlayers_snapshot.test.ts`                    |          19  |       0 | Cleared |
| `tests/architect/tradeManager.test.ts`                          |          19  |       0 | Cleared |
| `tests/trade/secondApron_tpeBan.test.ts`                        |          18  |       0 | Cleared |
| `tests/trade/poisonPill_average.test.ts`                        |          17  |       0 | Cleared |
| `tests/trade/signAndTrade_completeness.test.ts`                 |          16  |       0 | Cleared |
| `tests/trade/tradeKicker_proration.test.ts`                     |           9  |       0 | Cleared |
| `tests/trade/tradeKicker_zeroGuarantee.test.ts`                 |           9  |       0 | Cleared |
| `tests/trade/timingGates_softEnforcement.test.ts`               |           7  |       0 | Cleared |

### What Changed

- `tests/architect/tradeManager.test.ts` now imports the helper/mocked Firebase
  modules through real extension-safe paths, routes optional MLE, hard-cap,
  cap-hold, dead-cap, and extension-contract reads through required readers,
  and localizes the deliberate invalid-`worldId` runtime probes instead of
  relying on dishonest call-site typing.
- `tests/trade/secondApron_tpeBan.test.ts` now builds live-path and
  compatibility-path trade/TPE fixtures against the validator contract types,
  removing the implicit-any team/player/TPE builders and the `never[]`
  defaults that were masking canonical TPE-shape expectations.
- `tests/trade/timingGates_softEnforcement.test.ts` now types the enforcement
  harness, callback collectors, and surfaced issue arrays so the retired
  aggregation-rule assertions read through truthful warning/violation readers.
- `tests/trade/poisonPill_average.test.ts`,
  `tests/trade/tradeKicker_proration.test.ts`, and
  `tests/trade/tradeKicker_zeroGuarantee.test.ts` now build players from the
  live matching-value parameter contract instead of loose bag objects, which
  removes the implicit-any extension/year payloads and stale kicker/player
  fixture shortcuts.
- The interrupted in-progress hardening already present in
  `tests/trade/signAndTrade_completeness.test.ts` and
  `tests/trade/twoWayPlayers_snapshot.test.ts` was carried forward to
  completion by aligning both suites with the live validator/snapshot input
  contracts and required update readers.
- The approved bounded node validation passed for the touched cluster:
  `npm run test:node -- --reporter=dot tests/trade/twoWayPlayers_snapshot.test.ts tests/architect/tradeManager.test.ts tests/trade/secondApron_tpeBan.test.ts tests/trade/signAndTrade_completeness.test.ts tests/trade/timingGates_softEnforcement.test.ts tests/trade/poisonPill_average.test.ts tests/trade/tradeKicker_proration.test.ts tests/trade/tradeKicker_zeroGuarantee.test.ts`
  finished with `42 / 42` tests green.
- Root compatibility still holds: `npm run typecheck` passed after the Step 36
  edits.

### Remaining Hotspots After Step 36

The Step 36 wave cleared the planned trade aftermath / snapshot cluster. The
strongest remaining Architect strict hotspots are now:

- `src/features/architect/utils/mutationPipeline.ts` (`34`)
- `src/shared/components/EditContractModal.tsx` (`22`)
- `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.ts` (`17`)
- `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.ts` (`17`)
- `tests/trade/consent_and_birdVeto.test.ts` (`16`)
- `tests/architect/ruleContextTiming.test.ts` (`16`)
- `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.ts` (`16`)
- `src/tests/architect/capSheet_exception_wiring.behavior.test.tsx` (`16`)
- `tests/architect/seasonHelpers.test.ts` (`15`)
- `tests/trade/frozenPick_consequences.test.ts` (`14`)

The eight Step 36 target files no longer appear in the Architect strict output.

Plain-language read: Step 36 removed the queued trade aftermath / snapshot
truth cluster and pulled Architect strict down to `709`. The mission is
healthier, but it is still far from final-review readiness, so the Step 37
checkpoint must reassess and extend the master plan again rather than route to
closeout.

## Step 37 Post-Wave Checkpoint

Reviewed: 2026-04-24, after Steps 35-36 completed the dead-cap/season-state and
trade aftermath/snapshot waves.

### Probe Delta

| Command                                                                 | Original baseline | Step 14 resume baseline | Step 22 checkpoint | Step 34 checkpoint | Current | Reading                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ----------------: | ----------------------: | -----------------: | -----------------: | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`                                                     |                 0 | compatibility-only pass |                  0 |                  0 |       0 | Root compatibility remains green, but root `strict: false` still means this is not mission-completion evidence.                                                                                              |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |               244 |                       0 |                  0 |                  0 |       0 | Shared/runtime strict work remains fully green; no shared regression is blocking the mission.                                                                                                                |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |             2,567 |                   2,632 |              2,228 |                944 |     709 | Architect/test strict posture improved materially (`-1,858` vs the original baseline, `-1,923` vs Step 14, `-1,519` vs Step 22, `-235` vs Step 34), but it remains the mission blocker by a large margin. |

### Current Architect Strict Concentration

The current Architect strict backlog is concentrated in:

1. Runtime-owner / persistence carriers:
   `src/features/architect/utils/mutationPipeline.ts` (`34`),
   `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.ts` (`17`),
   `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.ts` (`16`),
   `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.ts` (`17`).
2. Cap-sheet / timing / consent / pick-rule truth:
   `src/shared/components/EditContractModal.tsx` (`22`),
   `src/tests/architect/capSheet_exception_wiring.behavior.test.tsx` (`16`),
   `tests/architect/ruleContextTiming.test.ts` (`16`),
   `tests/architect/seasonHelpers.test.ts` (`15`),
   `tests/trade/consent_and_birdVeto.test.ts` (`16`),
   `tests/trade/frozenPick_consequences.test.ts` (`14`),
   `src/tests/tradeMachine/swapResolution.test.ts` (`14`).

### Checkpoint Verdict

The mission is not honestly close to final review. Shared strict is already
green, but Architect strict still carries `709` errors across a live
runtime-owner hotspot plus multiple remaining Architect/trade truth clusters.
Routing to final review here would violate the master-plan closure rules.

### Required Plan Extension

The plan must extend again. The next bounded waves are now:

- Step 38: mutation-owner / persistence truth cluster
- Step 39: cap-sheet / timing / consent truth cluster
- Step 40: another master checkpoint after those waves

Plain-language read: the hardening program is making real progress, but the
repo is still in an evidence-backed `not ready for final review` state. The
next move is another bounded execution wave, not closeout.

## Step 38 Mutation-Owner / Persistence Wave Delta

Reviewed: 2026-04-24, after Step 38 hardened the bounded `mutationPipeline`
/ persistence / DARE cluster.

| Measurement                                                                 | Step 37 checkpoint | Current | Delta |
| --------------------------------------------------------------------------- | -----------------: | ------: | ----: |
| `npm run typecheck`                                                         |                  0 |       0 |     0 |
| `npm run typecheck -- --project tsconfig.architect-strict.json`             |                709 |     624 |   -85 |
| `npm run test:node -- --reporter=dot src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.ts src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.ts src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.ts` | not yet run | `56 / 56` | bounded pack green |

### Step 38 Surface Result

- `src/features/architect/utils/mutationPipeline.ts`,
  `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.ts`,
  `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.ts`,
  and `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.ts`
  no longer appear in the live Architect strict output.
- The wave stayed bounded to nullable totals synchronization, offer-sheet
  carrier narrowing, sign-and-trade handoff truth, persistence fixture helper
  typing, and DARE mock/input typing rather than widening into general season
  or cap-legality cleanup.

### Remaining Concentration After Step 38

The next backlog is now led by the Step 39 cluster:

1. `src/shared/components/EditContractModal.tsx` (`22`)
2. `tests/trade/consent_and_birdVeto.test.ts` (`16`)
3. `tests/architect/ruleContextTiming.test.ts` (`16`)
4. `src/tests/architect/capSheet_exception_wiring.behavior.test.tsx` (`16`)
5. `tests/architect/seasonHelpers.test.ts` (`15`)
6. `tests/trade/frozenPick_consequences.test.ts` (`14`)
7. `src/tests/tradeMachine/swapResolution.test.ts` (`14`)

Plain-language read: Step 38 cleared the remaining mutation-owner /
persistence truth cluster cleanly, but the mission still is not close to final
review because the next cap-sheet / timing / consent / pick-rule cluster now
dominates the live strict backlog.

## Step 39 Cap-Sheet / Timing / Consent Wave Delta

Reviewed: 2026-04-24, after Step 39 hardened the bounded cap-sheet / timing /
consent / pick-rule cluster.

| Measurement                                                                 | Step 38 wave | Current | Delta |
| --------------------------------------------------------------------------- | -----------: | ------: | ----: |
| `npm run typecheck`                                                         |            0 |       0 |     0 |
| `npm run typecheck -- --project tsconfig.architect-strict.json`             |          624 |     511 |  -113 |
| `npm run test:ui -- --reporter=dot src/tests/architect/capSheet_exception_wiring.behavior.test.tsx` | not yet run | `23 / 23` | bounded pack green |
| `npm run test:node -- --reporter=dot tests/architect/ruleContextTiming.test.ts tests/architect/seasonHelpers.test.ts tests/trade/consent_and_birdVeto.test.ts tests/trade/frozenPick_consequences.test.ts src/tests/tradeMachine/swapResolution.test.ts` | not yet run | `102 / 102` | bounded pack green |

### Step 39 Surface Result

- `src/shared/components/EditContractModal.tsx`,
  `src/tests/architect/capSheet_exception_wiring.behavior.test.tsx`,
  `tests/architect/ruleContextTiming.test.ts`,
  `tests/architect/seasonHelpers.test.ts`,
  `tests/trade/consent_and_birdVeto.test.ts`,
  `tests/trade/frozenPick_consequences.test.ts`, and
  `src/tests/tradeMachine/swapResolution.test.ts` no longer appear in the live
  Architect strict output.
- The wave stayed bounded to modal/player/year narrowing, cap-sheet table and
  TPE fixture readers, required cap-season reads, intentional invalid-season
  runtime probes, typed consent/pick fixtures, and swap-resolution required
  metadata helpers.

### Remaining Concentration After Step 39

The next backlog is no longer led by the Step 39 cluster. The strongest live
Architect strict hotspots are now:

1. `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts` (`14`)
2. `tests/trade/rosterWindow_softEnforcement.test.ts` (`13`)
3. `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.ts` (`13`)
4. `src/tests/architect/batchB_cbaRules.test.ts` (`13`)
5. `tests/architect/playerRulesProfile.test.ts` (`12`)
6. `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts` (`12`)
7. `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.ts` (`12`)
8. `src/tests/architect/mutationPipeline.tradeSatHandoffContract.test.ts` (`12`)
9. `src/tests/architect/mutationPipeline.tradeSatHandoffClosure.test.ts` (`12`)
10. `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts` (`12`)

Plain-language read: Step 39 removed the planned mixed cap-sheet / timing /
consent / pick-rule truth cluster and reduced Architect strict to `511`.
The mission remains open because the remaining backlog is still substantial and
spread across multiple Architect/trade guardrail and roster-rule clusters, so
Step 40 must reassess and extend rather than route directly to final closeout.

## Step 40 Post-Wave Checkpoint

Reviewed: 2026-04-24, after Steps 38-39 completed the mutation-owner /
persistence and cap-sheet / timing / consent truth waves.

### Probe Delta

| Command                                                                 | Original baseline | Step 14 resume baseline | Step 22 checkpoint | Step 37 checkpoint | Current | Reading                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ----------------: | ----------------------: | -----------------: | -----------------: | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                     |                 0 | compatibility-only pass |                  0 |                  0 |       0 | Root compatibility remains green, but root `strict: false` still means this is not mission-completion evidence.                                                                        |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |               244 |                       0 |                  0 |                  0 |       0 | Shared/runtime strict work remains fully green; no shared regression is blocking the mission.                                                                                          |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |             2,567 |                   2,632 |              2,228 |                709 |     511 | Architect/test strict posture improved materially (`-2,056` vs the original baseline, `-2,121` vs Step 14, `-1,717` vs Step 22, `-198` vs Step 37), but it remains the mission blocker. |

### Current Architect Strict Concentration

The current Architect strict backlog is concentrated in:

1. Sign-and-trade / mutation / canonical TPE guardrails:
   `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.ts`
   (`13`),
   `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.ts`
   (`12`),
   `src/tests/architect/mutationPipeline.tradeSatHandoffContract.test.ts`
   (`12`),
   `src/tests/architect/mutationPipeline.tradeSatHandoffClosure.test.ts`
   (`12`),
   `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
   (`12`), and
   `src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.ts`
   (`11`).
2. Roster / player-rules / timing / input validation:
   `tests/trade/rosterWindow_softEnforcement.test.ts` (`13`),
   `tests/architect/playerRulesProfile.test.ts` (`12`),
   `tests/trade/rosterLegality_validateTrade.test.ts` (`11`),
   `tests/trade/cashLedger_season_tracking.test.ts` (`10`),
   `tests/trade/jan15_offseason_timing.test.ts` (`9`),
   `tests/trade/input_validation.test.ts` (`9`), and
   `tests/trade/roster_twoWay_enforcement.test.ts` (`8`).
3. Offseason / DARE / tile-reactivity follow-on work:
   `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts`
   (`14`),
   `src/tests/architect/batchB_cbaRules.test.ts` (`13`),
   `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts`
   (`12`),
   `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts`
   (`10`), and `src/tests/architect/dare/dareResolver.test.ts` (`10`).

### Checkpoint Verdict

The mission is not honestly ready for final review. The Step 38-39 waves
removed their planned target clusters and kept root/shared strict green, but
Architect strict still carries `511` errors across multiple meaningful
guardrail, roster-rule, offseason, and DARE clusters.

### Required Plan Extension

The plan must extend again. The next bounded waves are now:

- Step 41: Architect sign-and-trade / mutation guardrail truth cluster
- Step 42: roster / rule validation truth cluster
- Step 43: another master checkpoint after those waves

Plain-language read: Step 40 confirms the hardening program is still making
measurable progress, but the remaining mission-area debt is too broad for final
review or closeout. The next move is another bounded execution wave, not a
completion claim.

## Step 41 Sign-And-Trade / Mutation Guardrail Wave Delta

Reviewed: 2026-04-24, after Step 41 hardened the bounded Architect
sign-and-trade / mutation guardrail cluster.

| Measurement                                                                 | Step 40 checkpoint | Current | Delta |
| --------------------------------------------------------------------------- | -----------------: | ------: | ----: |
| `npm run typecheck`                                                         |                  0 |       0 |     0 |
| `npm run typecheck -- --project tsconfig.architect-strict.json`             |                511 |     439 |   -72 |
| `npm run test:node -- --reporter=dot src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.ts src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.ts src/tests/architect/mutationPipeline.tradeSatHandoffContract.test.ts src/tests/architect/mutationPipeline.tradeSatHandoffClosure.test.ts src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.ts` | not yet run | `55 / 55` | bounded pack green |

### Step 41 Surface Result

- `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.ts`,
  `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.ts`,
  `src/tests/architect/mutationPipeline.tradeSatHandoffContract.test.ts`,
  `src/tests/architect/mutationPipeline.tradeSatHandoffClosure.test.ts`,
  `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`, and
  `src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.ts`
  no longer appear in the live Architect strict output.
- The wave stayed bounded to required mutation-result readers, canonical
  current-state player fixtures, typed source-scan helpers, and typed
  sanitization probes rather than widening into the remaining roster-rule,
  offseason, or DARE backlog.

### Remaining Concentration After Step 41

The next backlog is now led by the Step 42 roster / rule validation cluster and
the known offseason / DARE follow-on tier:

1. `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts` (`14`)
2. `tests/trade/rosterWindow_softEnforcement.test.ts` (`13`)
3. `src/tests/architect/batchB_cbaRules.test.ts` (`13`)
4. `tests/architect/playerRulesProfile.test.ts` (`12`)
5. `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts` (`12`)
6. `tests/trade/rosterLegality_validateTrade.test.ts` (`11`)
7. `tests/trade/cashLedger_season_tracking.test.ts` (`10`)
8. `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts` (`10`)
9. `src/tests/architect/dare/dareResolver.test.ts` (`10`)
10. `tests/trade/jan15_offseason_timing.test.ts` (`9`)

Plain-language read: Step 41 removed the planned sign-and-trade / mutation
guardrail truth cluster and reduced Architect strict to `439`. The mission
still remains open because the roster/rule validation cluster and the
offseason/DARE follow-on tier remain substantial.

## Step 42 Roster / Rule Validation Wave Delta

Reviewed: 2026-04-24, after Step 42 hardened the bounded roster / rule
validation truth cluster.

| Measurement                                                                 | Step 41 checkpoint | Current | Delta |
| --------------------------------------------------------------------------- | -----------------: | ------: | ----: |
| `npm run typecheck`                                                         |                  0 |       0 |     0 |
| `npm run typecheck -- --project tsconfig.architect-strict.json`             |                439 |     367 |   -72 |
| `npm run test:node -- --reporter=dot tests/trade/rosterWindow_softEnforcement.test.ts tests/trade/rosterLegality_validateTrade.test.ts tests/architect/playerRulesProfile.test.ts tests/trade/cashLedger_season_tracking.test.ts tests/trade/jan15_offseason_timing.test.ts tests/trade/input_validation.test.ts tests/trade/roster_twoWay_enforcement.test.ts` | not yet run | `73 / 73` | bounded pack green |

### Step 42 Surface Result

- `tests/trade/rosterWindow_softEnforcement.test.ts`,
  `tests/trade/rosterLegality_validateTrade.test.ts`,
  `tests/architect/playerRulesProfile.test.ts`,
  `tests/trade/cashLedger_season_tracking.test.ts`,
  `tests/trade/jan15_offseason_timing.test.ts`,
  `tests/trade/input_validation.test.ts`, and
  `tests/trade/roster_twoWay_enforcement.test.ts` no longer appear in the live
  Architect strict output.
- The wave stayed bounded to typed roster-window carriers, normalized
  validateTrade fixtures, required profile/extension reads, canonical issue
  arrays, and stale input import cleanup rather than widening into general
  offseason, DARE, or UI hardening.

### Remaining Concentration After Step 42

The next backlog is now led by Architect tile/reactivity, CBA batch,
offseason-transition, DARE, season-advance, and preflight truth clusters:

1. `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts` (`14`)
2. `src/tests/architect/batchB_cbaRules.test.ts` (`13`)
3. `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts` (`12`)
4. `src/tests/architect/dare/dareResolver.test.ts` (`10`)
5. `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts` (`10`)
6. `src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.ts` (`9`)
7. `src/tests/tradeMachine/conveyancePreflight.test.ts` (`9`)
8. `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx` (`8`)
9. `src/features/architect/utils/capLegalityValidation.ts` (`8`)
10. `src/features/architect/utils/leagueInvariants.ts` (`8`)
11. `src/features/architect/utils/tradeContext/tradeContext.ts` (`8`)
12. `src/tests/architect/phase59_legacy_import_guardrail.test.ts` (`8`)

Plain-language read: Step 42 removed the planned roster / rule validation
truth cluster and reduced Architect strict to `367`. The mission remains open:
the next checkpoint must extend the plan again if these remaining clusters are
still meaningful, which they currently are.

## Step 43 Post-Wave Checkpoint

Reviewed: 2026-04-24, after Steps 41-42 completed the sign-and-trade /
mutation guardrail and roster / rule validation truth waves.

### Probe Delta

| Command                                                                 | Original baseline | Step 14 resume baseline | Step 22 checkpoint | Step 40 checkpoint | Current | Reading                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ----------------: | ----------------------: | -----------------: | -----------------: | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                     |                 0 | compatibility-only pass |                  0 |                  0 |       0 | Root compatibility remains green, but root `strict: false` still means this is not mission-completion evidence.                                                                        |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |               244 |                       0 |                  0 |                  0 |       0 | Shared/runtime strict work remains fully green; no shared regression is blocking the mission.                                                                                          |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |             2,567 |                   2,632 |              2,228 |                511 |     367 | Architect/test strict posture improved materially (`-2,200` vs the original baseline, `-2,265` vs Step 14, `-1,861` vs Step 22, `-144` vs Step 40), but it remains the mission blocker. |

### Current Architect Strict Concentration

The current Architect strict backlog is concentrated in:

1. Reactivity / CBA / guardrail tests:
   `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts` (`14`),
   `src/tests/architect/batchB_cbaRules.test.ts` (`13`),
   `src/tests/architect/phase59_legacy_import_guardrail.test.ts` (`8`),
   `src/tests/architect/mutationPipeline.currentStateTeamBoundary.test.ts` (`7`),
   and `src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.ts` (`7`).
2. Offseason / DARE / season-advance / preflight tests:
   `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts` (`12`),
   `src/tests/architect/dare/dareResolver.test.ts` (`10`),
   `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts` (`10`),
   `src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.ts` (`9`),
   and `src/tests/tradeMachine/conveyancePreflight.test.ts` (`9`).
3. Runtime owner follow-on files:
   `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx` (`8`),
   `src/features/architect/utils/capLegalityValidation.ts` (`8`),
   `src/features/architect/utils/leagueInvariants.ts` (`8`),
   `src/features/architect/utils/tradeContext/tradeContext.ts` (`8`),
   and `src/features/architect/utils/seasonManager.ts` (`7`).

The top current hotspots are:

1. `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts` (`14`)
2. `src/tests/architect/batchB_cbaRules.test.ts` (`13`)
3. `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts` (`12`)
4. `src/tests/architect/dare/dareResolver.test.ts` (`10`)
5. `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts` (`10`)
6. `src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.ts` (`9`)
7. `src/tests/tradeMachine/conveyancePreflight.test.ts` (`9`)
8. `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx` (`8`)
9. `src/features/architect/utils/capLegalityValidation.ts` (`8`)
10. `src/features/architect/utils/leagueInvariants.ts` (`8`)
11. `src/features/architect/utils/tradeContext/tradeContext.ts` (`8`)
12. `src/tests/architect/phase59_legacy_import_guardrail.test.ts` (`8`)

### Readiness Verdict

Not ready for final review. Root typecheck and shared-boundaries strict are
green, but Architect strict still carries `367` errors across meaningful
mission-area surfaces. The remaining work is no longer a final-review cleanup;
it needs at least two more bounded source-change waves and another checkpoint:

- Step 44: Architect reactivity / CBA guardrail truth cluster
- Step 45: offseason / DARE / preflight truth cluster
- Step 46: another master checkpoint after those waves

Plain-language read: Step 43 confirms the hardening program is still making
measurable progress, but the remaining Architect/test/runtime backlog is too
large for a truthful completion claim. The next move is another bounded
execution wave, not final review.

## Step 44 Reactivity / CBA Guardrail Wave Delta

Reviewed: 2026-04-24, after Step 44 hardened the bounded Architect reactivity /
CBA guardrail truth cluster.

| Measurement                                                                 | Step 43 checkpoint | Current | Delta |
| --------------------------------------------------------------------------- | -----------------: | ------: | ----: |
| `npm run typecheck`                                                         |                  0 |       0 |     0 |
| `npm run typecheck -- --project tsconfig.architect-strict.json`             |                367 |     318 |   -49 |
| `npm run test:node -- --reporter=dot src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts src/tests/architect/batchB_cbaRules.test.ts src/tests/architect/phase59_legacy_import_guardrail.test.ts src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.ts src/tests/architect/mutationPipeline.currentStateTeamBoundary.test.ts` | not yet run | `65 / 65` | bounded pack green |

### Step 44 Surface Result

- `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts`,
  `src/tests/architect/batchB_cbaRules.test.ts`,
  `src/tests/architect/phase59_legacy_import_guardrail.test.ts`,
  `src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.ts`, and
  `src/tests/architect/mutationPipeline.currentStateTeamBoundary.test.ts` no
  longer appear in the live Architect strict output.
- The wave stayed bounded to typed source-scan helpers, canonical validation
  issue arrays, explicit snapshot/reload readers, normalized draft-pick
  fixtures, and typed console spies rather than widening into offseason, DARE,
  or runtime-owner cleanup.

### Remaining Concentration After Step 44

The next backlog is now led by the planned Step 45 offseason / DARE / preflight
truth cluster and a smaller runtime / trade-rule follow-on tier:

1. `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts` (`12`)
2. `src/tests/architect/dare/dareResolver.test.ts` (`10`)
3. `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts` (`10`)
4. `src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.ts` (`9`)
5. `src/tests/tradeMachine/conveyancePreflight.test.ts` (`9`)
6. `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx` (`8`)
7. `src/features/architect/utils/capLegalityValidation.ts` (`8`)
8. `src/features/architect/utils/leagueInvariants.ts` (`8`)
9. `src/features/architect/utils/tradeContext/tradeContext.ts` (`8`)
10. `src/features/architect/utils/seasonManager.ts` (`7`)
11. `tests/architect/overrideBypass.test.ts` (`7`)
12. `tests/trade/orderOfOps_conversionsBeforeMatching.test.ts` (`7`)

Plain-language read: Step 44 removed the planned reactivity / CBA guardrail
truth cluster and reduced Architect strict to `318`. The mission remains open:
the Step 45 offseason / DARE / preflight cluster is still substantial and must
run before the next readiness checkpoint.

## Step 45 Offseason / DARE / Preflight Wave Delta

Reviewed: 2026-04-24, after Step 45 hardened the bounded offseason / DARE /
preflight truth cluster.

| Measurement                                                                 | Step 44 checkpoint | Current | Delta |
| --------------------------------------------------------------------------- | -----------------: | ------: | ----: |
| `npm run typecheck`                                                         |                  0 |       0 |     0 |
| `npm run typecheck -- --project tsconfig.architect-strict.json`             |                318 |     268 |   -50 |
| `npm run test:node -- --reporter=dot src/tests/architect/phase86_oste_offseason_transition_engine.test.ts src/tests/architect/dare/dareResolver.test.ts src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.ts src/tests/tradeMachine/conveyancePreflight.test.ts` | not yet run | `86 / 86` | bounded pack green |

### Step 45 Surface Result

- `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts`,
  `src/tests/architect/dare/dareResolver.test.ts`,
  `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts`,
  `src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.ts`, and
  `src/tests/tradeMachine/conveyancePreflight.test.ts` no longer appear in the
  live Architect strict output.
- The wave stayed bounded to typed DARE Firestore fixtures, typed E2E
  player/team helpers, canonical TPE lifecycle fixtures, explicit OSTE
  transition readers, and localized runtime-invalid conveyance probes rather
  than widening into UI or broad runtime-owner cleanup.

### Remaining Concentration After Step 45

The next backlog is now split between runtime owner files and smaller
trade/Architect test clusters:

1. `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx` (`8`)
2. `src/features/architect/utils/capLegalityValidation.ts` (`8`)
3. `src/features/architect/utils/leagueInvariants.ts` (`8`)
4. `src/features/architect/utils/tradeContext/tradeContext.ts` (`8`)
5. `src/features/architect/utils/seasonManager.ts` (`7`)
6. `tests/architect/overrideBypass.test.ts` (`7`)
7. `tests/trade/orderOfOps_conversionsBeforeMatching.test.ts` (`7`)
8. `src/features/architect/utils/offseason/resolveOffseasonTransition.ts` (`6`)
9. `src/tests/architect/dare/protectionLadderFactory.test.ts` (`6`)
10. `src/tests/architect/phase47_tpe_persistence_guardrails.test.ts` (`6`)
11. `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.ts` (`6`)
12. `src/tests/architect/phase86_league_invariants.test.ts` (`6`)

Plain-language read: Step 45 removed the planned offseason / DARE / preflight
truth cluster and reduced Architect strict to `268`. The mission remains open
until the Step 46 checkpoint proves whether the remaining runtime-owner and
smaller test clusters are final-review-safe or still require more numbered
waves.

## Step 46 Post-Wave Checkpoint

Reviewed: 2026-04-24, after Steps 44-45 completed the reactivity / CBA
guardrail and offseason / DARE / preflight truth waves.

### Probe Delta

| Command                                                                 | Original baseline | Step 14 resume baseline | Step 22 checkpoint | Step 40 checkpoint | Step 43 checkpoint | Current | Reading                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ----------------: | ----------------------: | -----------------: | -----------------: | -----------------: | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`                                                     |                 0 | compatibility-only pass |                  0 |                  0 |                  0 |       0 | Root compatibility remains green, but root `strict: false` still means this is not mission-completion evidence.                                                                                        |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` |               244 |                       0 |                  0 |                  0 |                  0 |       0 | Shared/runtime strict work remains fully green; no shared regression is blocking the mission.                                                                                                          |
| `npm run typecheck -- --project tsconfig.architect-strict.json`         |             2,567 |                   2,632 |              2,228 |                511 |                367 |     268 | Architect/test strict posture improved materially (`-2,299` vs the original baseline, `-2,364` vs Step 14, `-1,960` vs Step 22, `-243` vs Step 40, `-99` vs Step 43), but remains the mission blocker. |

### Current Architect Strict Concentration

The current Architect strict backlog is concentrated in:

1. Runtime owner boundary files:
   `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx` (`8`),
   `src/features/architect/utils/capLegalityValidation.ts` (`8`),
   `src/features/architect/utils/leagueInvariants.ts` (`8`),
   `src/features/architect/utils/tradeContext/tradeContext.ts` (`8`),
   `src/features/architect/utils/seasonManager.ts` (`7`), and
   `src/features/architect/utils/offseason/resolveOffseasonTransition.ts` (`6`).
2. Remaining trade / Architect test clusters:
   `tests/architect/overrideBypass.test.ts` (`7`),
   `tests/trade/orderOfOps_conversionsBeforeMatching.test.ts` (`7`),
   `src/tests/architect/dare/protectionLadderFactory.test.ts` (`6`),
   `src/tests/architect/phase47_tpe_persistence_guardrails.test.ts` (`6`),
   `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.ts` (`6`),
   `src/tests/architect/phase86_league_invariants.test.ts` (`6`),
   `tests/architect/EditContractModal.rules.test.tsx` (`6`),
   `tests/trade/byc_outgoing_max.test.ts` (`6`), and
   `tests/trade/salaryMatching.test.ts` (`6`).

The top current hotspots are:

1. `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx` (`8`)
2. `src/features/architect/utils/capLegalityValidation.ts` (`8`)
3. `src/features/architect/utils/leagueInvariants.ts` (`8`)
4. `src/features/architect/utils/tradeContext/tradeContext.ts` (`8`)
5. `src/features/architect/utils/seasonManager.ts` (`7`)
6. `tests/architect/overrideBypass.test.ts` (`7`)
7. `tests/trade/orderOfOps_conversionsBeforeMatching.test.ts` (`7`)
8. `src/features/architect/utils/offseason/resolveOffseasonTransition.ts` (`6`)
9. `src/tests/architect/dare/protectionLadderFactory.test.ts` (`6`)
10. `src/tests/architect/phase47_tpe_persistence_guardrails.test.ts` (`6`)
11. `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.ts` (`6`)
12. `src/tests/architect/phase86_league_invariants.test.ts` (`6`)

### Readiness Verdict

Not ready for final review. Root typecheck and shared-boundaries strict are
green, but Architect strict still carries `268` errors across runtime-owner and
test surfaces. The remaining work still needs at least two more bounded waves
and another checkpoint:

- Step 47: Architect runtime-owner boundary cluster
- Step 48: remaining trade / Architect test truth cluster
- Step 49: another master checkpoint after those waves

Plain-language read: Step 46 confirms the hardening program is still making
measurable progress, but the remaining Architect/runtime/test backlog is too
large for a truthful completion claim. The next move is another bounded
execution wave, not final review.

## Step 47 Runtime-Owner Boundary Wave

Measured 2026-04-24 after Step 47.

| Probe                                                                 | Result | Notes |
| --------------------------------------------------------------------- | -----: | ----- |
| `npm run typecheck`                                                   | pass   | Root compatibility remains green after the runtime-owner boundary changes. |
| `npm run typecheck -- --project tsconfig.architect-strict.json`       |   223 | Expected strict failure while the master plan remains active; Step 47 target files are clear. |
| `npm run build`                                                       | pass   | Production build passed; Vite reported existing dynamic/static import and chunk-size warnings. |

Step 47 reduced the Architect strict backlog from `268` to `223` errors
(`-45`). The cleared runtime-owner targets were:

- `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx`
- `src/features/architect/utils/capLegalityValidation.ts`
- `src/features/architect/utils/leagueInvariants.ts`
- `src/features/architect/utils/tradeContext/tradeContext.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`

The remaining top hotspots are now concentrated in the Step 48 test cluster
and the next lower runtime utilities:

1. `tests/trade/orderOfOps_conversionsBeforeMatching.test.ts` (`7`)
2. `tests/architect/overrideBypass.test.ts` (`7`)
3. `tests/trade/salaryMatching.test.ts` (`6`)
4. `tests/trade/byc_outgoing_max.test.ts` (`6`)
5. `tests/architect/EditContractModal.rules.test.tsx` (`6`)
6. `src/tests/architect/phase86_league_invariants.test.ts` (`6`)
7. `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.ts` (`6`)
8. `src/tests/architect/phase47_tpe_persistence_guardrails.test.ts` (`6`)
9. `src/tests/architect/dare/protectionLadderFactory.test.ts` (`6`)
10. `src/tests/architect/tradeApply_tradeToRouting.guardrail.test.ts` (`5`)
11. `src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.ts` (`5`)
12. `src/tests/architect/entitlementInvariants.test.ts` (`5`)

Readiness remains negative: the runtime-owner wave was successful, but `223`
Architect strict errors are still meaningful mission-area debt. Step 48 remains
the next executable wave.

## Step 48 Trade / Architect Test Truth Wave

Measured 2026-04-24 after Step 48.

| Probe | Result | Notes |
| ----- | -----: | ----- |
| `npm run typecheck` | pass | Root compatibility remains green after the test truth wave. |
| `npm run typecheck -- --project tsconfig.architect-strict.json` | 167 | Expected strict failure while the master plan remains active; Step 48 target files are clear. |
| `npm run test:node -- --reporter=dot tests/architect/overrideBypass.test.ts tests/trade/orderOfOps_conversionsBeforeMatching.test.ts src/tests/architect/dare/protectionLadderFactory.test.ts src/tests/architect/phase47_tpe_persistence_guardrails.test.ts src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.ts src/tests/architect/phase86_league_invariants.test.ts tests/architect/EditContractModal.rules.test.tsx tests/trade/byc_outgoing_max.test.ts tests/trade/salaryMatching.test.ts` | pass | Vitest reported `8` files and `118` tests passed; the UI-modal TSX target is accepted by the command but not listed separately by the node runner output. |

Step 48 reduced the Architect strict backlog from `223` to `167` errors
(`-56`). The cleared test-cluster targets were:

- `tests/architect/overrideBypass.test.ts`
- `tests/trade/orderOfOps_conversionsBeforeMatching.test.ts`
- `src/tests/architect/dare/protectionLadderFactory.test.ts`
- `src/tests/architect/phase47_tpe_persistence_guardrails.test.ts`
- `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.ts`
- `src/tests/architect/phase86_league_invariants.test.ts`
- `tests/architect/EditContractModal.rules.test.tsx`
- `tests/trade/byc_outgoing_max.test.ts`
- `tests/trade/salaryMatching.test.ts`

The remaining top hotspots are:

1. `src/tests/architect/tradeApply_tradeToRouting.guardrail.test.ts` (`5`)
2. `src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.ts` (`5`)
3. `src/tests/architect/entitlementInvariants.test.ts` (`5`)
4. `src/features/architect/utils/tradeMachine/rules/miscRules.ts` (`5`)
5. `src/features/architect/utils/capTotals/computeTeamCapTotals.ts` (`5`)
6. `tests/trade/faExceptions_as_trade_buckets.test.ts` (`4`)
7. `tests/architect/salaryEngine.test.ts` (`4`)
8. `tests/architect/ExceptionTracker.tpe.test.tsx` (`4`)
9. `src/tests/architect/utils/seasonManager.tpe.test.ts` (`4`)
10. `src/tests/architect/useArchitectActions.freeAgency.test.tsx` (`4`)
11. `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.ts` (`4`)
12. `src/tests/architect/phase42_apron_derivation_consolidation.test.ts` (`4`)

Readiness remains negative. The Step 48 wave removed the planned test cluster,
but `167` Architect strict errors still include runtime utilities and several
test clusters. Step 49 must reassess the mission and extend the plan if this
remaining backlog is still substantial.

## Evidence Commands

- `rg --files`
- `node -e '<inventory and marker counting script>'`
- `node - <<'NODE' <tests-only marker count and hotspot script> NODE`
- `sed -n '1,220p' tsconfig.json`
- `sed -n '1,220p' tsconfig.architect-strict.json`
- `sed -n '1,220p' tsconfig.shared-boundaries-strict.json`
- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/architect/seasonManager.test.ts`
- `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
- `node -e '<architect strict output parser for live file/code hotspot counts>'`
- `node -e '<architect strict output parser for runtime-vs-test concentration buckets>'`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/architect_step20.log 2>&1; echo EXIT:$?; grep -c "error TS" /tmp/architect_step20.log; grep -E "src/tests/architect/phase50_executeTrade_integration_persistence.test.ts|tests/architect/offerSheetPersistence.test.ts" /tmp/architect_step20.log`
- `node -e '<architect strict output parser for Step 20 post-wave hotspot counts>'`
- `npm run test:node -- --reporter=dot tests/architect/offerSheetPersistence.test.ts src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
- `node -e '<test marker count script for tests/ and src/tests/>'`
- `node -e '<architect strict concentration parser for tests/architect, src/tests/architect, tests/trade, and src/features/architect>'`
- `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/architect_step22.log 2>&1; echo EXIT:$?; grep -c "error TS" /tmp/architect_step22.log`
- `node -e '<architect strict family and concentration parser for Step 22>'`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/architect_step23.log 2>&1; echo EXIT:$?; grep -c "error TS" /tmp/architect_step23.log; grep -E "tests/architect/mutationPipeline.tradePersistenceTruth.test.ts|tests/architect/worldManager.test.ts|tests/architect/teamLoader.test.ts" /tmp/architect_step23.log`
- `grep -E "tests/architect/capLegalityValidation.test.ts|tests/architect/renounceRights.test.ts|src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts|src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts|src/tests/architect/exceptionManagement.test.ts|tests/architect/contractNormalization.test.ts|tests/architect/e2e-workflows.test.ts" /tmp/architect_step23.log | sed -E 's/\([0-9]+,[0-9]+\):.*$//' | sort | uniq -c | sort -nr`
- `npm run test:node -- --reporter=dot tests/architect/teamLoader.test.ts tests/architect/worldManager.test.ts tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- `npm run test:node -- --reporter=dot tests/architect/capLegalityValidation.test.ts tests/architect/renounceRights.test.ts`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/architect_step24.log 2>&1; echo EXIT:$?; grep -c "error TS" /tmp/architect_step24.log`
- `grep -E "^tests/architect/(capLegalityValidation|renounceRights)\.test\.ts" /tmp/architect_step24.log || true`
- `grep "error TS" /tmp/architect_step24.log | sed -E 's/^([^(:]+).*/\1/' | sort | uniq -c | sort -nr | head -10`
- `npm run test:node -- --reporter=dot src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts src/tests/architect/exceptionManagement.test.ts`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/architect_step26.log 2>&1; echo EXIT:$?; grep -c "error TS" /tmp/architect_step26.log`
- `grep -E "^src/tests/architect/(phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails|phase74_room_exception_mvp_guardrails|exceptionManagement)\.test\.ts" /tmp/architect_step26.log || true`
- `grep "error TS" /tmp/architect_step26.log | sed -E 's/^([^(:]+).*/\1/' | sort | uniq -c | sort -nr | head -10`
- `npm run test:node -- --reporter=dot tests/architect/contractNormalization.test.ts tests/architect/integration.test.ts tests/architect/e2e-workflows.test.ts src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts tests/architect/schemaAdapter.test.ts`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/step27_architect_strict.log 2>&1; echo EXIT:$?; grep -c "error TS" /tmp/step27_architect_strict.log`
- `awk -F'(' '/error TS/{print $1}' /tmp/step27_architect_strict.log | sort | uniq -c | sort -nr | head -12`
- `npm run test:node -- --reporter=dot src/tests/architect/phase17_entitlement_routing_guardrail.test.ts src/tests/tradeMachine/phase5DraftPositions.test.ts src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/step29_architect_strict.log 2>&1; echo EXIT:$?; grep -c "error TS" /tmp/step29_architect_strict.log`
- `awk -F'(' '/error TS/{print $1}' /tmp/step29_architect_strict.log | sort | uniq -c | sort -nr | head -12`
- `npm run test:node -- --reporter=dot tests/trade/validatorContractCleanup.test.ts tests/trade/validatorTrustFixes.test.ts tests/trade/consent_and_reacq.test.ts tests/architect/extension_voidedByExtension.test.ts`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/step30_architect_strict.log 2>&1; echo EXIT:$?`
- `awk '/^[[:space:]]+[0-9]+[[:space:]]/ {sum += $1} END {print sum}' /tmp/step30_architect_strict.log`
- `awk '/^[[:space:]]+[0-9]+[[:space:]]/ {print $1, $2}' /tmp/step30_architect_strict.log | sort -nr | head -12`
- `grep -E "^(tests/architect/extension_voidedByExtension.test.ts|tests/trade/validatorContractCleanup.test.ts|tests/trade/validatorTrustFixes.test.ts|tests/trade/consent_and_reacq.test.ts)" /tmp/step30_architect_strict.log || true`
- `npm run test:node -- --reporter=dot src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts src/tests/architect/signAndTrade.test.ts src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.ts src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/step32_architect_strict.log 2>&1; echo EXIT:$?`
- `awk '/^[[:space:]]+[0-9]+[[:space:]]/ {sum += $1} END {print sum}' /tmp/step32_architect_strict.log`
- `awk '/^[[:space:]]+[0-9]+[[:space:]]/ {print $1, $2}' /tmp/step32_architect_strict.log | sort -nr | head -12`
- `grep -E "^(src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts|src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts|src/tests/architect/signAndTrade.test.ts|src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.ts|src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts)" /tmp/step32_architect_strict.log || true`
- `npm run test:node -- --reporter=dot tests/trade/tpe_creation_expiry_usage.test.ts tests/trade/secondApronBoundary.test.ts tests/trade/timingEnforcement_authoritative.test.ts tests/trade/reacquisition_bar.test.ts tests/trade/tpe_absorption_fail_closed.test.ts tests/trade/validation_caching.test.ts`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/step33_architect_strict.log 2>&1; echo EXIT:$?`
- `grep -E '^[^[:space:]][^(:]*\([0-9]+,[0-9]+\): error TS' /tmp/step33_architect_strict.log | wc -l`
- `grep -E '^[^[:space:]][^(:]*\([0-9]+,[0-9]+\): error TS' /tmp/step33_architect_strict.log | sed -E 's#^([^(:]+)\([0-9]+,[0-9]+\): error TS.*#\1#' | sort | uniq -c | sort -nr | head -12`
- `grep -E '^(tests/trade/tpe_creation_expiry_usage|tests/trade/secondApronBoundary|tests/trade/timingEnforcement_authoritative|tests/trade/reacquisition_bar|tests/trade/tpe_absorption_fail_closed|tests/trade/validation_caching)\.test\.ts' /tmp/step33_architect_strict.log || true`
- `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/step34_architect_strict.log 2>&1; echo EXIT:$?; grep -E '^[^[:space:]][^(:]*\([0-9]+,[0-9]+\): error TS' /tmp/step34_architect_strict.log | wc -l`
- `grep -E '^[^[:space:]][^(:]*\([0-9]+,[0-9]+\): error TS' /tmp/step34_architect_strict.log | sed -E 's#^([^(:]+)\([0-9]+,[0-9]+\): error TS.*#\1#' | sort | uniq -c | sort -nr | head -12`
- `npm run test:node -- --reporter=dot src/tests/architect/deadCapManagement.test.ts src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.ts src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.ts src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.ts src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.ts src/tests/tradeMachine/seasonSwapResolution.test.ts`
- `npm run typecheck -- --project tsconfig.architect-strict.json > /tmp/step35_architect_strict.log 2>&1; echo EXIT:$?; grep -E '^[^[:space:]][^(:]*\([0-9]+,[0-9]+\): error TS' /tmp/step35_architect_strict.log | wc -l`
- `grep -E '^[^[:space:]][^(:]*\([0-9]+,[0-9]+\): error TS' /tmp/step35_architect_strict.log | sed -E 's#^([^(:]+)\([0-9]+,[0-9]+\): error TS.*#\1#' | sort | uniq -c | sort -nr | head -12`
- `grep -E '^(src/tests/architect/deadCapManagement|src/tests/architect/freeAgency_fixpack_e1\.pipeline\.behavior|src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration|src/tests/architect/phase47c_tpe_persistence_hardening_guardrails|src/tests/architect/phase75_room_exception_auto_eligibility_guardrails|src/tests/tradeMachine/seasonSwapResolution)\.test\.ts' /tmp/step35_architect_strict.log || true`
- `rg -n "declare module|declare global|namespace |interface Window|/// <reference" -g '!node_modules' -g '!dist' -g '!coverage' -g '!functions/node_modules'`
- `rg -n "Record<string, unknown>|as any|\\bany\\b|unknown" tests/architect/mutationPipeline.tradePersistenceTruth.test.ts src/tests/architect/useArchitectActions.freeAgency.test.tsx tests/__mocks__/firebase.ts`
