# TS-ZERO-003C - Fixture helper mocks (2026-04-29)

## Scope

Gate 4 Phase 3C: remove practical broad casts from small repeated test helpers and negative fixtures left by the repo-wide scan.

## Source changes

| File | Change |
| --- | --- |
| `src/tests/architect/phase15_trade_payload_entitlements_only_guardrail.test.ts` | Typed trade payload players as `NormalizedPlayer` fixtures instead of casting the generated players array. |
| `src/tests/architect/phaseC_entitlement_invariants_integration.test.ts` | Replaced the `createTeam(...): any` helper with explicit entitlement/team fixture types. |
| `src/tests/architect/tm6b.hardCapOwnership.guardrail.test.ts` | Replaced the hard-cap projection cast with a parameter-derived intersection type for the intentional `hardCapLevel` fixture. |
| `src/tests/architect/devSntInjector.utils.test.ts` | Typed S&T injector team slot fixtures from `injectSyntheticSntPlayersIntoTeams` parameters and removed the no-target cast. |
| `src/tests/architect/entitlementDedupe.test.ts` | Removed the negative unknown-kind `as any`; the production input contract already accepts unknown kind strings. |
| `src/tests/architect/teamHistory.eventEmissionMatrix.guardrail.test.ts` | Removed the `event.playerIds as any[]` assertion cast and asserted the typed array length directly. |

## Validation

| Command | Result |
| --- | --- |
| Touched-file marker scan | PASS except one false-positive comment containing `any`. |
| `npm run typecheck` | PASS |
| `npm run test:node -- --reporter=dot` (six touched files) | PASS - 6 files, 54 tests. |
| `npm run lint:md` | PASS |
| `npm run validate:project` | PASS |
| `git diff --check` | PASS |

## Skipped

- `npm run build` - source changes were test-only; no UI, route, component, or runtime bundle changed.
- `npm run test:full` - prompt did not contain `RUN FULL SUITE`.
