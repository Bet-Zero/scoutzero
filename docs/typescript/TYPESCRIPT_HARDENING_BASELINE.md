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

## Evidence Commands

- `rg --files`
- `node -e '<inventory and marker counting script>'`
- `sed -n '1,220p' tsconfig.json`
- `sed -n '1,220p' tsconfig.architect-strict.json`
- `sed -n '1,220p' tsconfig.shared-boundaries-strict.json`
- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
