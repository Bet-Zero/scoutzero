# B2 Trade Machine Static Audit

- Domain: `D02`
- Staleness status: `STALE` (trade validator and integration tests changed within 30 days)

## 10-Lens Review

| Lens | Evidence | Result |
|---|---|---|
| 1. Purpose/intent | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:L47-L83` | PASS |
| 2. Input contracts | Team/player routing helpers `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:L88-L139` | PASS |
| 3. Rules correctness | Validator imports and enforcement chain `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:L7-L45` | PASS |
| 4. State transitions/idempotency | `computeTradeResult` prevalidated context assertions `src/features/architect/utils/mutationPipeline.js:L1924-L1931` | PASS |
| 5. Persistence boundaries | Write choke-point in `persistWorldMutation` `src/features/architect/utils/mutationPipeline.js:L3526-L3690` | PASS |
| 6. Error/fail-closed | Routing fail-closed warnings/errors `src/features/architect/utils/mutationPipeline.js:L1976-L1979`, `:L2012-L2031` | PASS |
| 7. UX truthfulness | Trade outcomes feed event payload with before/after totals `src/features/architect/utils/mutationPipeline.js:L1095-L1112` | PASS |
| 8. Tests/guardrails | Write-path guardrail test `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts:L157-L265`; trade suite pass in `C_stageC_test_trade.log` | PASS |
| 9. Perf/reactivity | Wrapped common validators `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:L266-L283` | PASS |
| 10. Docs parity | Validator header documents known gaps and DG status `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:L52-L83` | PASS |

## Findings
- None at confidence >=70.

## Verification Queue
- None.
