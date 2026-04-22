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

| Scope | `.ts` | `.tsx` | `.js` | `.jsx` | `.d.ts` |
| --- | ---: | ---: | ---: | ---: | ---: |
| Repo-wide | 879 | 331 | 26 | 0 | 4 |
| `src/` | 600 | 321 | 0 | 0 | 4 |
| `tests/` | 147 | 10 | 0 | 0 | 0 |
| `src/tests/` | 294 | 99 | 0 | 0 | 0 |
| `tests/` + `src/tests/` | 441 | 109 | 0 | 0 | 0 |

The remaining repo-wide `.js` files are outside runtime `src/` and live in
scripts/config-style surfaces. They are not the main app migration blocker, but
they are also not checked by root TypeScript unless imported into included TS.

## Compiler Posture

### Root `tsconfig.json`

| Setting | Current value | Hardening meaning |
| --- | --- | --- |
| `strict` | `false` | Root typecheck does not enforce the strict family. |
| `strictFunctionTypes` | `true` | One strict sub-flag is enabled explicitly. |
| `skipLibCheck` | `true` | Library declaration checks are skipped. |
| `isolatedModules` | `true` | Vite-compatible single-file transform safety is on. |
| `noEmit` | `true` | Typecheck does not emit build output. |
| `moduleResolution` | `"bundler"` | Matches Vite/bundler resolution. |
| `resolveJsonModule` | `true` | JSON imports are allowed. |
| `allowJs` | not enabled | JS files are not part of root TS checking. |
| `checkJs` | not enabled | Remaining JS is not type-checked as JS. |
| `baseUrl`/`paths` | `.` and `@/* -> ./src/*` | Repo alias is configured. |

Root includes runtime `src/**/*`, several scrape/pipeline script trees, and
`capTotals`. Root excludes `node_modules`, `dist`, `archive`, and
`player-scrape/contracts/**/*`.

### Additional TypeScript Configs

| Config | Purpose | Current posture |
| --- | --- | --- |
| `tsconfig.architect-strict.json` | Strict probe for Architect runtime and Architect/trade tests. | Extends root, sets `strict: true`, currently fails with `2,567` TS errors. |
| `tsconfig.shared-boundaries-strict.json` | Strict probe for shared player hooks plus selected route/storage boundaries. | Extends root, sets `strict: true`, currently fails with `244` TS errors. |
| `functions/tsconfig.json` | Separate Firebase Functions compiler config. | Outside the current runtime hardening flow. |

## Dishonesty Markers

Marker corpus: code files from live `rg --files`, excluding `docs/`,
`return_packages/`, `archive/`, `dist/`, and generated dependency folders.

These are regex occurrence counts. The `any` count includes occurrences inside
more specific markers such as `as any` and `Record<string, any>`.

| Marker | Full repo code corpus | Runtime `src/` excluding `src/tests/` | Tests (`tests/` + `src/tests/`) | Other code |
| --- | ---: | ---: | ---: | ---: |
| `any` | 1,223 | 174 | 755 | 294 |
| `as any` | 441 | 5 | 395 | 41 |
| `as unknown as` | 56 | 7 | 43 | 6 |
| `@ts-ignore` | 0 | 0 | 0 | 0 |
| `@ts-expect-error` | 1 | 0 | 1 | 0 |
| `Record<string, any>` | 78 | 4 | 59 | 15 |

### Visibility Counts

`unknown` is tracked separately because it can represent honest boundary work or
unresolved data-shape debt depending on how it is narrowed.

| Marker | Full repo code corpus | Runtime `src/` excluding `src/tests/` | Tests (`tests/` + `src/tests/`) | Other code |
| --- | ---: | ---: | ---: | ---: |
| `unknown` | 2,679 | 1,471 | 1,047 | 161 |

## Strict Probe Baselines

These failures are measurement baselines, not Step 1 pass/fail goals.

| Command | Result | Error count |
| --- | --- | ---: |
| `npm run typecheck` | PASS | 0 |
| `npm run typecheck -- --project tsconfig.architect-strict.json` | FAIL as expected | 2,567 |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` | FAIL as expected | 244 |

### Architect Strict Probe Concentration

Top error codes:

| Code | Count |
| --- | ---: |
| `TS18048` | 549 |
| `TS7006` | 398 |
| `TS2322` | 389 |
| `TS18049` | 237 |
| `TS2345` | 225 |

Top files by current error count:

| File | Errors |
| --- | ---: |
| `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts` | 95 |
| `tests/__mocks__/firebase.ts` | 87 |
| `tests/architect/seasonManager.test.ts` | 84 |
| `tests/architect/offerSheetPersistence.test.ts` | 80 |
| `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` | 70 |
| `tests/architect/capLegalityValidation.test.ts` | 67 |
| `tests/architect/teamLoader.test.ts` | 67 |
| `src/features/architect/utils/mutationPipeline.ts` | 55 |

### Shared Boundary Strict Probe Concentration

Top error codes:

| Code | Count |
| --- | ---: |
| `TS7031` | 98 |
| `TS7006` | 49 |
| `TS2339` | 49 |
| `TS2345` | 16 |
| `TS7053` | 13 |

Top files by current error count:

| File | Errors |
| --- | ---: |
| `src/pages/ListManager.tsx` | 43 |
| `src/features/lists/ListPreviewModal/ListExportWrapper/index.tsx` | 26 |
| `src/features/lists/ListSearchBar.tsx` | 19 |
| `src/features/roster/AddPlayerDrawer/addPlayer/PhysicalFilters.tsx` | 18 |
| `src/features/lists/AddToListButton/AddToListModal.tsx` | 16 |
| `src/features/lists/ListTierHeader/index.tsx` | 15 |
| `src/features/roster/RosterControls.tsx` | 10 |

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

| File | Classification | Why it still exists | Type posture | Blocks later hardening? |
| --- | --- | --- | --- | --- |
| `src/vite-env.d.ts` | Justified boundary declaration | Provides Vite client references and the app's `VITE_*` environment variable surface. | No broad placeholders or `any`; it declares optional string env values. | No. Keep as the Vite/env boundary. |
| `src/types/player.d.ts` | Temporary legacy bridge | Preserves the legacy player type import surface while canonical player schemas live in `src/schemas/players_v2.ts`. | Core document exports forward to schema-derived types; legacy view interfaces still allow extra fields with `unknown`, not `any`. | Not a live blocker, but future code should prefer schema exports directly and avoid adding new declarations here. |
| `src/features/table/PlayerTable/PlayerRow/PlayerNameMini.d.ts` | Still suspicious | Sits beside a real `PlayerNameMini.tsx` implementation whose props are not typed in the implementation file. | No `any`, but it is a duplicate declaration facade that can drift from runtime props. | Not a Step 5 blocker; revisit when strict-prep or table UI typing reaches this component. |

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

| File or group | Classification | Why | Resume point |
| --- | --- | --- | --- |
| `src/features/architect/utils/worldManager.ts` | Safe to defer | World metadata reads now require object-shaped documents and validate known scalar, list, stats, and draft-position fields before returning `WorldMetadata`. | Revisit only if world metadata schema becomes canonical Zod. |
| `src/features/architect/utils/firebaseTeamPlanHelpers.ts` | Safe to defer | Base team, base player, contract, bio, exception, and free-agent reads now pass through boundary readers before hydration; remaining loose fields are preserved as unknown passthrough for legacy compatibility. | Revisit when a canonical hydrated-base-team schema exists. |
| `src/features/architect/utils/mutationPipeline.ts` current-state Firestore reads | Next-wave candidate | The strict scan still shows casted offer-sheet team/player override snapshot reads in the committed mutation pipeline, and the strict probe concentrates many downstream optional/nullability errors there. | Step 10/11 candidate if the strict checkpoint supports one narrow runtime wave. |
| `src/features/architect/utils/entitlements/*` resolver and pick-rule reads | Safe to defer | These casts are real boundary debt, but they are scoped to entitlement resolution rather than the Step 6-7 world/base read stack and did not block the wave validation. | Track for a future entitlement-boundary pass. |
| `src/features/architect/GMDashboard/**` dashboard/action adapter contracts | Needs separate product/architecture decision | Strict errors show broad disagreement between dashboard cap-sheet/player shapes, mutation-pipeline carrier shapes, and trade/cap consumers; fixing this is a contract-alignment pass, not another Firestore-boundary patch. | Separate Architect contract-normalization plan or Step 11 only if narrowed by evidence. |
| `tests/__mocks__/firebase.ts` and cast-heavy Architect suites | Next-wave candidate | Tests remain the biggest typed bypass layer and still dominate strict-probe output. | Step 8. |

The Architect strict probe still fails on the known broader backlog, but a
filtered strict check after Step 7 showed no errors in
`architectFirestoreBoundary.ts`, `worldManager.ts`, or
`firebaseTeamPlanHelpers.ts`.

## Test Typing Review

Reviewed: 2026-04-21, after Step 8 tightened the central Firebase mock and the
first targeted Architect suites.

### Updated Test-Side Dishonesty Markers

| Marker | Step 1 baseline tests | Current tests | Delta |
| --- | ---: | ---: | ---: |
| `any` | 755 | 637 | -118 |
| `as any` | 395 | 332 | -63 |
| `as unknown as` | 43 | 44 | +1 |
| `@ts-ignore` | 0 | 0 | 0 |
| `@ts-expect-error` | 1 | 1 | 0 |
| `Record<string, any>` | 59 | 42 | -17 |

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

| File or group | Classification | Why | Resume point |
| --- | --- | --- | --- |
| `src/tests/architect/useArchitectActions.freeAgency.test.tsx` | High-value next-wave candidate | This is still a central action-layer proof surface with `32` `any` and `28` `as any`, mostly in hook-state setup, mutation-call assertions, and trade/apply payloads. | If Step 10/11 supports another test-focused wave, revisit this suite first. |
| `src/tests/architect/tmCapIntegration.*`, `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`, `src/tests/architect/capSheet.transactionMatrix.behavior.test.tsx` | High-value next-wave candidate | The heaviest remaining `any`/`as any` density now lives in trade/cap integration harnesses, so critical guardrails still accept loosely shaped inputs too easily. | Best next cluster after `useArchitectActions.freeAgency.test.tsx` if the plan takes one more typed-test pass. |
| `src/tests/architect/mutationPipeline.boundary.e107.test.ts`, `src/tests/architect/mutationPipeline.computeResultBridge.test.ts`, `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts` | High-value next-wave candidate | Mutation-pipeline guardrails still rely on cast-heavy fixtures, which weakens the same runtime contracts Steps 6-7 just hardened. | Keep grouped as one follow-on harness wave rather than fixing them piecemeal. |
| `tests/__mocks__/firebase.ts` | Acceptable temporary compromise | The mock remains central, but it no longer uses tracked dishonesty markers. The remaining `unknown` usage reflects mock-boundary truth, not bag-typed trust. | Revisit only if Step 10 shows strict-prep leverage in the mock layer. |
| `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts` | Acceptable temporary compromise | This suite now proves persistence behavior with explicit fixture contracts and no tracked dishonesty markers. | Leave it alone unless runtime contract changes require new fixture shape coverage. |
| `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts`, `src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts`, `tests/trade/useTradeMachine.validatorTrust.test.ts` | Acceptable temporary compromise | These compatibility-style suites still carry some `Record<string, any>` bag typing, but they are lower leverage than the action/trade/cap harnesses above and would likely widen into runtime contract redesign. | Revisit only in a dedicated compatibility-contract cleanup pass. |
| Scattered leaf suites with `1-4` `as unknown as` occurrences, including `src/tests/architect/capSheet_exception_wiring.behavior.test.tsx`, `src/tests/architect/deadCapManagement.test.ts`, `src/tests/architect/signAndTrade.test.ts`, `src/tests/architect/worldTime.test.ts`, and `tests/architect/capHolds.test.ts` | Not worth targeted hardening right now | These are real casts, but they are sparse and isolated enough that a dedicated cleanup wave would not materially change trust metrics. | Leave them for opportunistic cleanup when those suites already need behavior work. |

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

| Command | Step 1 baseline | Current result | Delta | Reading |
| --- | ---: | ---: | ---: | --- |
| `npm run typecheck` | 0 | 0 | 0 | Root compatibility gate still passes, but root `strict: false` means this is not hardening proof by itself. |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` | 244 | 0 | -244 | Shared/runtime probe moved materially and now passes. |
| `npm run typecheck -- --project tsconfig.architect-strict.json` | 2,567 | 2,632 | +65 | Architect/test probe did not improve at repo scale; it is slightly worse overall despite local boundary wins. |

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

| Error family | Current count | What it signals | Where it lives now |
| --- | ---: | --- | --- |
| `TS18048` / `TS18049` / `TS2533` | 891 | Possibly-null and optionality churn after truthful boundary contracts meet looser downstream consumers. | Concentrated across Architect persistence/season tests plus `mutationPipeline.ts` and dashboard adapters. |
| `TS2322` / `TS2345` | 649 | Cross-contract assignability mismatches between dashboard, mutation, cap-sheet, and test-harness shapes. | Strongest in `seasonManager.test.ts`, `GMDashboard*`, `useArchitectActions.ts`, and persistence/offer-sheet suites. |
| `TS7006` / `TS7005` / `TS18046` | 583 | Untyped parameters, untyped locals, and `unknown`-not-narrowed patterns that still dominate older Architect tests. | Mostly in large Architect test harnesses rather than the shared runtime surface. |

### Concentration vs. Spread

- The Architect strict backlog currently spans `194` files.
- The top `10` files account for `731 / 2,632` errors (`27.8%`).
- The top `20` files account for `1,144 / 2,632` errors (`43.5%`).
- That means there are real hotspots, but the remaining debt is still spread
  too broadly to call it one bounded strict-prep cluster.

Current top Architect strict hotspots:

| File | Errors | Dominant families |
| --- | ---: | --- |
| `tests/architect/seasonManager.test.ts` | 117 | `TS2322`, `TS18046`, `TS7006`, `TS7005` |
| `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts` | 95 | `TS18048`, `TS18049` |
| `tests/architect/offerSheetPersistence.test.ts` | 80 | `TS18048`, `TS18049`, `TS2532`, `TS2533` |
| `tests/architect/capLegalityValidation.test.ts` | 67 | Mixed contract/nullability debt |
| `tests/architect/teamLoader.test.ts` | 67 | Mixed contract/nullability debt |
| `tests/architect/worldManager.test.ts` | 66 | Mixed contract/nullability debt |
| `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` | 64 | Mixed contract/nullability debt |
| `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts` | 62 | Mixed contract/nullability debt |
| `src/tests/architect/exceptionManagement.test.ts` | 58 | Mixed contract/nullability debt |
| `src/features/architect/utils/mutationPipeline.ts` | 55 | `TS18048`, `TS2322`, `TS18049`, `TS2533`, `TS2345` |

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

| Command | Current result | Error count | Reading |
| --- | --- | ---: | --- |
| `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` | PASS | 0 | Shared/runtime strict debt remains cleared; there is no live evidence of shared-boundary regression. |
| `npm run typecheck -- --project tsconfig.architect-strict.json` | FAIL as expected | 2,632 | The remaining mission-area backlog is still concentrated in Architect runtime contracts plus Architect-heavy test harnesses. |

The shared/runtime probe is now green. The mission is still blocked by the
Architect side of the repo: central runtime carrier/adapter contracts remain
misaligned, and the biggest strict backlog still sits in persistence, offer
sheet, season, and guardrail harnesses that exercise those contracts.

### Current Architect Strict Hotspots

Top error families from the live `tsconfig.architect-strict.json` run:

| Error family | Count | What it now signals |
| --- | ---: | --- |
| `TS18048` | 557 | Optional/null values still flowing into code paths that assume presence. |
| `TS2322` | 410 | Assignability disagreements between runtime carrier shapes and consuming adapters/tests. |
| `TS7006` | 305 | Untyped parameters still concentrated in older Architect/trade harnesses. |
| `TS18049` | 241 | Values may be `null` or `undefined` where downstream code expects real objects. |
| `TS2345` | 239 | Function-call contracts still disagree across mutation, dashboard, and test layers. |
| `TS18046` | 153 | `unknown` values are reaching assertions and helpers without truthful narrowing. |
| `TS18047` | 144 | Nullable values are still used as present in key test/runtime flows. |
| `TS7005` | 125 | Older Architect/trade harnesses still rely on implicitly-`any` locals. |

Top failing files from the same live run:

| File | Errors | Why it matters now |
| --- | ---: | --- |
| `tests/architect/seasonManager.test.ts` | 117 | Highest single-file test hotspot; central season lifecycle harness still bypasses real contracts too often. |
| `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts` | 95 | Persistence truth harness still has heavy nullability churn across execute-trade flows. |
| `tests/architect/offerSheetPersistence.test.ts` | 80 | Offer-sheet persistence coverage still depends on loosely aligned fixture/runtime shapes. |
| `tests/architect/capLegalityValidation.test.ts` | 67 | Cap legality integration harness still carries broad contract mismatch debt. |
| `tests/architect/teamLoader.test.ts` | 67 | Team-loader test surface still has mixed assignability/nullability fallout even after the runtime boundary hardening. |
| `tests/architect/worldManager.test.ts` | 66 | World-manager harness still reflects older loose contracts rather than the hardened readers. |
| `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts` | 64 | High-value parity/season-advance guardrail harness remains contract-heavy and nullable. |
| `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts` | 62 | Exception guardrails still rely on overly permissive compatibility fixtures. |
| `src/tests/architect/exceptionManagement.test.ts` | 58 | Exception lifecycle harness still reflects inconsistent runtime shapes. |
| `src/features/architect/utils/mutationPipeline.ts` | 55 | Highest-leverage runtime contract owner still failing across nullability and assignability families. |

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

## Evidence Commands

- `rg --files`
- `node -e '<inventory and marker counting script>'`
- `node - <<'NODE' <tests-only marker count and hotspot script> NODE`
- `sed -n '1,220p' tsconfig.json`
- `sed -n '1,220p' tsconfig.architect-strict.json`
- `sed -n '1,220p' tsconfig.shared-boundaries-strict.json`
- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
- `node -e '<architect strict output parser for live file/code hotspot counts>'`
- `rg -n "declare module|declare global|namespace |interface Window|/// <reference" -g '!node_modules' -g '!dist' -g '!coverage' -g '!functions/node_modules'`
- `rg -n "Record<string, unknown>|as any|\\bany\\b|unknown" tests/architect/mutationPipeline.tradePersistenceTruth.test.ts src/tests/architect/useArchitectActions.freeAgency.test.tsx tests/__mocks__/firebase.ts`
