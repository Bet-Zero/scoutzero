# A4 Prior Artifact Reuse Log

## Reuse-First Sampling Evidence

Sampling inputs per domain were evaluated against blueprint staleness triggers:
- Changed within 30 days (`git log -1` evidence)
- Failing relevant tests in scoped runs
- Persistence/rules contract touches

## Classification

| Artifact / Domain Master | Sample Evidence Used | Staleness Trigger(s) | Classification |
|---|---|---|---|
| `docs/architect/TRADE_MACHINE_MASTER.md` | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` (2026-02-26), `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts` (2026-03-03) | Recent domain changes (<30d) | STALE |
| `docs/architect/CAP_SHEET_MASTER.md` | `src/features/architect/utils/capTotals/computeTeamCapTotals.js` (2026-02-28), `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.js` | Recent SSOT/persistence changes (<30d) | STALE |
| `docs/architect/OFFSEASON_MASTER.md` | `src/features/architect/GMDashboard/sections/OffseasonSection.jsx` (2026-03-03), `src/tests/architect/offseason.devGate.guardrail.test.ts` failing | Recent changes + failing test trigger | STALE |
| `docs/architect/ENTITLEMENTS_MASTER.md` | `src/features/architect/utils/entitlements/entitlementWriter.ts` (2026-02-25), `src/tests/architect/entitlementWriter.collision.test.ts` | Recent changes (<30d) | STALE |
| `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md` | Current command logs (`C_stageC_*`) + domain changes | Gate doc older than current code/test state | STALE |
| Contract editor legacy area (`docs/architect/EDIT_CONTRACT_MASTER.md`) | `src/features/architect/contract/ContractEditor/ContractEditor.jsx` (2025-12-13), closure gate tests | No direct recent file churn in legacy editor | VALID (sampled) |

## Staleness Evidence Anchors
- `src/features/architect/GMDashboard/GMDashboard.jsx` last changed: 2026-03-04.
- `src/features/architect/utils/mutationPipeline.js` last changed: 2026-03-03.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx` last changed: 2026-03-03.
- `firestore.rules` last changed: 2026-03-04.
- Scoped test failure observed: `src/tests/architect/offseason.devGate.guardrail.test.ts` via `return_packages/architect/audit/C_stageC_test_architect.log`.

## Reuse Decision
- No closed domain qualified for no-reaudit acceptance under blueprint rules because at least one staleness trigger fired for each high-impact Architect domain.
- Prior artifacts were reused as context only; all critical claims were re-anchored to current code/tests in this run.
