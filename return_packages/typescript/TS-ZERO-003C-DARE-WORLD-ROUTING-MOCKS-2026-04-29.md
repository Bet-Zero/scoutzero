# TS-ZERO-003C - DARE / world reload / routing mocks (2026-04-29)

## Scope

Gate 4 Phase 3C: remove practical broad test/mock casts from the DARE mutator gate, trade entitlement routing helper, Pick Right Wizard draft probe, Trade Machine E131 barrel guardrail, and world free-agency committed snapshot tests.

## Source changes

| File | Change |
| --- | --- |
| `src/tests/architect/dareMutatorExclusivityGate.test.ts` | Replaced broad Firestore/write-batch `any` stubs with typed SDK-facing test doubles; filled `DAREOutput` receipt/meta with the real DARE contract shape; removed the resolved entitlement document cast. |
| `src/tests/architect/tradeEntitlementRouting.test.ts` | Typed route builder slots from `buildEntitlementRoutingMap` parameters and removed the inactive-slot payload cast. |
| `src/tests/architect/pickRightWizardDraft.test.ts` | Typed the mock form state as `EntitlementFormState` and narrowed loaded v2 draft envelopes with a local type guard instead of `(loaded as any)`. |
| `src/tests/architect/tradeMachineBarrelBatch.e131.guardrail.test.ts` | Typed the dynamic utils barrel import with `typeof import(...)` instead of `as any`. |
| `src/tests/architect/useArchitectState.worldFreeAgency.test.ts` | Typed committed team fixtures with `ArchitectDashboardCapSheet` and removed committed snapshot casts from coordinated reload tests. |

## Validation

| Command | Result |
| --- | --- |
| Touched-file marker scan | PASS except one false-positive plain-English test title containing `any`. |
| `npm run typecheck` | PASS |
| `npm run test:architect -- --reporter=dot` | PASS - 283 files, 3,298 tests. Policy note: this exceeded the 4-minute test budget before completion, so cheaper diff-scoped validation was run afterward. |
| `npm run test:diff -- --reporter=dot` | PASS - selected TARGETED and ran 10 related node files (51 tests), but did not infer this exact five-file cluster. |
| `npm run test:node -- --reporter=dot` (four touched Architect node/jsdom-compatible files) | PASS - 4 files, 52 tests. |
| `npm run test:ui -- --reporter=dot src/tests/architect/pickRightWizardDraft.test.ts` | PASS - 1 file, 11 tests. |
| `npm run lint:md` | PASS |
| `npm run validate:project` | PASS |
| `git diff --check` | PASS |

## Skipped

- `npm run build` - source changes were test-only; no UI, route, component, or runtime bundle changed.
- `npm run test:full` - prompt did not contain `RUN FULL SUITE`.
