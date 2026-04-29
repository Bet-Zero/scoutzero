# TS-ZERO-003C - Core TPE mocks (2026-04-29)

## Scope

Gate 4 Phase 3C: remove repeated `any[]` return types from Architect core persistence-contract mocks.

## Source changes

| File | Change |
| --- | --- |
| `src/tests/architect/architectCoreLogicBlockerTrio.test.ts` | Changed mocked `getTeamTpeList` return type from `any[]` to `unknown[]`. |
| `src/tests/architect/architectCoreTrioPassR2.test.ts` | Same. |

## Validation

| Command | Result |
| --- | --- |
| Touched-file marker scan | PASS except `expect.any(Date)` assertion matcher false positive. |
| `npm run typecheck` | PASS |
| `npm run test:node -- --reporter=dot` (two touched files) | PASS - 2 files, 6 tests. |
| `npm run lint:md` | PASS |
| `npm run validate:project` | PASS |
| `git diff --check` | PASS |

## Skipped

- `npm run build` - source changes were test-only; no UI, route, component, or runtime bundle changed.
- `npm run test:full` - prompt did not contain `RUN FULL SUITE`.
