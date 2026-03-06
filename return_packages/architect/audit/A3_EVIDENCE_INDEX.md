# A3 Evidence Index

## Requirement -> Proof Index

| Requirement ID | Claim Summary | Proof Anchors | Command Evidence | Current Confidence |
|---|---|---|---|---|
| ARQ-001 | Dashboard route and tab composition exist. | `src/App.jsx:L34-L36`, `src/features/architect/GMDashboard/GMDashboard.jsx:L228-L301` | N/A - static structure | 95 |
| ARQ-002 | World controls write only world metadata. | `src/features/architect/GMDashboard/components/WorldTimeControls.jsx:L34-L50`, `src/features/architect/utils/worldManager.js:L257-L287` | N/A - static structure | 88 |
| ARQ-003 | Trade validator chain wired in engine. | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:L7-L45` | `return_packages/architect/audit/C_stageC_test_trade.log` | 91 |
| ARQ-004 | Invalid trade apply fails closed pre-write. | `src/features/architect/utils/mutationPipeline.js:L2012-L2031`, `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts:L233-L265` | `return_packages/architect/audit/C_stageC_test_trade.log` | 90 |
| ARQ-005 | Trade writes remain world-scoped. | `src/features/architect/utils/mutationPipeline.js:L3564-L3668`, `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts:L200-L231` | `return_packages/architect/audit/C_stageC_test_trade.log` | 93 |
| ARQ-006 | Cap totals use SSOT function in UI and engine. | `src/features/architect/capSheet/CapSheet/CapSheet.jsx:L54-L58`, `src/features/architect/utils/capTotals/computeTeamCapTotals.js:L204-L282` | `return_packages/architect/audit/C_stageC_test_architect.log` | 89 |
| ARQ-007 | Totals SSOT and persist/reload parity are guarded by tests. | `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.js:L13-L33` | `return_packages/architect/audit/C_stageC_test_architect.log` | 86 |
| ARQ-008 | FA authoritative actions require world mode. | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L932-L975`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L1511-L1586` | `return_packages/architect/audit/C_stageC_test_architect.log` | 87 |
| ARQ-009 | World free-agent derivation excludes rostered world players. | `src/features/architect/GMDashboard/hooks/useArchitectState.ts:L503-L518`, `src/tests/architect/useArchitectState.worldFreeAgency.test.tsx:L82-L134` | `return_packages/architect/audit/C_stageC_test_architect.log` | 74 |
| ARQ-010 | Offseason DEV preview remains non-persisting and copy-guarded. | `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L50-L55`, `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx:L95-L101`, `src/tests/architect/offseason.devGate.guardrail.test.ts:L71-L77` | `return_packages/architect/audit/C_stageC_test_architect.log` | 96 |
| ARQ-011 | Season advance writes world team snapshots + metadata. | `src/features/architect/utils/seasonManager.js:L241-L260` | `return_packages/architect/audit/C_stageC_test_architect.log` | 82 |
| ARQ-012 | History world events query + normalization wired. | `src/features/architect/history/hooks/useWorldTeamEvents.ts:L64-L95`, `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts:L95-L121` | `return_packages/architect/audit/C_stageC_test_architect.log` | 84 |
| ARQ-013 | History payload supports totals/operation metadata. | `src/features/architect/utils/mutationPipeline.js:L1095-L1112`, `src/tests/architect/teamHistory.worldEvents.integration.test.tsx:L41-L88` | `return_packages/architect/audit/C_stageC_test_architect.log` | 85 |
| ARQ-014 | Entitlement writes are world-scoped and collision-safe. | `src/features/architect/utils/entitlements/entitlementWriter.ts:L451-L503`, `src/features/architect/utils/entitlements/entitlementWriter.ts:L577-L617`, `src/tests/architect/entitlementWriter.collision.test.ts:L54-L118` | `return_packages/architect/audit/C_stageC_test_architect.log` | 87 |
| ARQ-015 | Entitlement systems avoid base writes in runtime helpers. | `src/features/architect/utils/entitlements/entitlementWriter.ts:L443-L445`, `src/features/architect/utils/entitlements/dare/entitlementMutator.ts:L72-L132` | N/A - static structure | 83 |
| ARQ-016 | Edit contract actions are closure-gated. | `src/shared/components/EditContractModal.jsx:L169-L172`, `src/tests/architect/editContractModal_closure.gate.test.ts:L103-L145` | `return_packages/architect/audit/C_stageC_test_architect.log` | 84 |
| ARQ-017 | Mutation pipeline is write choke point with contract checks. | `src/features/architect/utils/mutationPipeline.js:L3516-L3561`, `src/features/architect/utils/mutationPipeline.js:L3638-L3668` | `return_packages/architect/audit/C_stageC_test_architect.log` | 91 |
| ARQ-018 | Security rules owner-gate world writes and deny base writes. | `firestore.rules:L55-L109` | `return_packages/architect/audit/C_stageC_test_architect.log` | 80 |
| ARQ-019 | Security rules include fail-closed fallback. | `firestore.rules:L128-L131`, `src/tests/security/architectSecurity.rulesSource.guardrail.test.ts:L21-L26` | `return_packages/architect/audit/C_stageC_test_architect.log` | 80 |
| ARQ-020 | Stage C command evidence includes runtime and output excerpts. | `return_packages/architect/audit/C_stageC_typecheck.log`, `return_packages/architect/audit/C_stageC_build.log`, `return_packages/architect/audit/C_stageC_test_diff.log`, `return_packages/architect/audit/C_stageC_test_architect.log`, `return_packages/architect/audit/C_stageC_test_trade.log` | Command logs listed | 100 |

## Verification Queue (Strict Schema)
`FindingID | Missing evidence | What to run/check | Owner | Status`

`VQ-B4-001 | Cannot confirm production incidence of worldRosterIndex load-failure branch causing temporary FA over-inclusion | Force getLeague failure in world mode and validate FA list behavior with targeted hook test + runtime smoke | Agent | QUEUED`

`VQ-D-001 | Runtime UI proof (emulator/dev-server walkthrough screenshots) unavailable in this run | Execute manual checklist in D_MANUAL_QA_CHECKLIST.md in emulator-backed session and attach screenshots | User | QUEUED`

`VQ-E2-001 | Firestore rules integration suite was not executed in this run environment | Run npm run test:rules in emulator environment and attach excerpted pass/fail matrix | Agent | QUEUED`
