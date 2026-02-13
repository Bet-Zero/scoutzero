# TEST_SPEED_P3 — Execution Return Package

**Date**: 2026-02-13
**Phase**: 3 — Node vs Browser Test Split
**Status**: Complete

## What Changed

### Files Created

| File                    | Purpose                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `vitest.node.config.js` | Vitest config for Node-environment tests (`.test.js`, `.test.ts`)                                 |
| `vitest.ui.config.js`   | Vitest config for jsdom-environment tests (`.test.jsx`, `.test.tsx` + 6 localStorage `.ts` files) |

### Files Modified

| File                                      | Change                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `package.json`                            | Added `test:node`, `test:ui` scripts; updated `test:full` to run both sequentially |
| `docs/testing/VALIDATION_TIERS_MASTER.md` | Added P3 section documenting the split and performance results                     |

### Tests Moved

None. Classification is purely config-based using file extensions + explicit exclude/include lists.

## New Commands

| Command             | Purpose                                                       | Duration |
| ------------------- | ------------------------------------------------------------- | -------- |
| `npm run test:node` | Run ~197 pure-logic test files in Node environment (no jsdom) | ~209s    |
| `npm run test:ui`   | Run ~32 component/UI test files in jsdom environment          | ~132s    |
| `npm run test:full` | Run both suites sequentially                                  | ~341s    |

## Before/After Timings

| Metric                     | Before                             | After                                             |
| -------------------------- | ---------------------------------- | ------------------------------------------------- |
| `npm run test:full` total  | **629.91s**                        | **340.87s** (208.76s + 132.11s)                   |
| Environment setup overhead | 1168.65s (jsdom for all 226 files) | 173.62s (0.49s node + 173.13s jsdom for 32 files) |
| Test files                 | 226                                | 229 (197 + 32)                                    |
| Tests                      | 2975 passed                        | 3004 passed (2698 + 306)                          |
| **Speedup**                | —                                  | **289.04s faster (45.9%)**                        |

> File/test count is slightly higher because the split configs pick up 6 localStorage `.ts`
> test files that the monolithic baseline config collected but ran with partial silent failures.
> These now run correctly in jsdom.

## Design Decisions

1. **Extension-based split** (`.js`/`.ts` = Node, `.jsx`/`.tsx` = jsdom): Simple, no test file changes needed
2. **Explicit localStorage exceptions**: 6 `.ts` files that use `localStorage` are excluded from node config and included in UI config by exact path
3. **Separate config files** (`vitest.node.config.js` + `vitest.ui.config.js`): More reliable than CLI `--include`/`--exclude` flags
4. **Setup files shared**: Both configs use `setupFirebaseMocks.js` and `setupDebug.js` (both are node-safe)
5. **No React plugin in node config**: Eliminates `@vitejs/plugin-react` transform overhead entirely

## localStorage-Dependent .ts Files (routed to UI suite)

These 6 `.ts` test files use `localStorage` (a browser global) and must run in jsdom:

- `src/tests/architect/wizardTranslation.test.ts`
- `src/tests/architect/pickRightWizardDraft.test.ts`
- `src/tests/architect/utils/freeAgencyFilterPersistence.test.ts`
- `src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts`
- `src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts`
- `tests/entitlements/vacuumTradeTransfer.test.ts`

## Validation

- [x] `npm run test:node` — 197 passed, 0 failed
- [x] `npm run test:ui` — 32 passed, 0 failed
- [x] `npm run test:full` — both suites pass
- [x] Total test count matches/exceeds baseline (3004 vs 2975)
- [x] No app code changes
- [x] Docs updated

END.
