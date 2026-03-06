# C1 Test Coverage To Requirements

## Executed Command Set
- `npm run typecheck` -> `return_packages/architect/audit/C_stageC_typecheck.log`
- `npm run build` -> `return_packages/architect/audit/C_stageC_build.log`
- `npm run test:diff -- --reporter=dot` -> `return_packages/architect/audit/C_stageC_test_diff.log`
- `npm run test:architect -- --reporter=dot` -> `return_packages/architect/audit/C_stageC_test_architect.log`
- `npm run test:trade -- --reporter=dot` -> `return_packages/architect/audit/C_stageC_test_trade.log`

## Coverage Matrix

| Requirement ID | Dynamic Proof Source | Status |
|---|---|---|
| ARQ-001 | `test:architect` (dashboard/hook tests in suite) | PASS |
| ARQ-002 | `test:architect` + static anchors for world metadata writes | PASS |
| ARQ-003 | `test:trade` (58 files / 537 tests passed) | PASS |
| ARQ-004 | `test:trade` + trade fail-closed guardrails in architect suite | PASS |
| ARQ-005 | `tmCapIntegration.executeTrade_writePaths.guardrail.test.ts` within architect suite | PASS |
| ARQ-006 | Cap SSOT guardrails in architect suite | PASS |
| ARQ-007 | Phase 79 parity guardrails in architect suite | PASS |
| ARQ-008 | FA authoritative path tests in architect suite | PASS |
| ARQ-009 | `useArchitectState.worldFreeAgency.test.tsx` in architect suite | PASS WITH QUEUED EDGE |
| ARQ-010 | `offseason.devGate.guardrail.test.ts` in architect suite | FAIL |
| ARQ-011 | Season manager guardrails in architect suite | PASS |
| ARQ-012 | Team history world events integration tests in architect suite | PASS |
| ARQ-013 | Team history payload enrichment guardrails in architect suite | PASS |
| ARQ-014 | Entitlement collision/identity tests in architect suite | PASS |
| ARQ-015 | Entitlement world-scope assertions in architect suite | PASS |
| ARQ-016 | Edit contract closure gates in architect suite | PASS |
| ARQ-017 | Mutation pipeline guardrails in architect suite | PASS |
| ARQ-018 | Security source guardrails (static test file exists; not executed in scoped command) | PARTIAL |
| ARQ-019 | Security source guardrails (static test file exists; not executed in scoped command) | PARTIAL |
| ARQ-020 | Stage C log files include runtime/exit/output excerpts | PASS |

## High-Risk Unproven/Partial Areas
- Firestore rules runtime integration (`npm run test:rules`) not executed in this run; queued as `VQ-E2-001`.
- Runtime emulator/manual UX workflows not executed in this run; queued as `VQ-D-001`.
