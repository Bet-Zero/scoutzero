# TypeScript Gate 5 Test and Mock Classification

Date: 2026-04-25

Verdict: Gate 5 passes by classification. Full TypeScript hardening remains
incomplete until Gate 8 produces the final evidence package.

## Gate 5 Scan

Command:

```bash
rg -n "\bany\b|as any|as unknown as|Record<string, any>|@ts-ignore|@ts-expect-error" tests src/tests -g '*.ts' -g '*.tsx'
```

Result: 630 raw matches.

The scan intentionally overmatches assertion helpers such as `expect.any`,
prose containing the word "any", malformed-input tests, and dynamic mock
fixtures. All remaining true test-side markers are classified below.

## Classification Rules

| Classification | Applies to | Why allowed |
| --- | --- | --- |
| ASSERTION FALSE POSITIVE | `expect.any(...)`, prose/comments, and string-literal domain values like `"any"`. | These are not TypeScript escape hatches. |
| NEGATIVE BOUNDARY FIXTURE | Tests intentionally passing malformed/null/wrong-shaped input through a public boundary. | The cast is local to the assertion that validates fail-closed behavior. |
| SDK MOCK BOUNDARY | Firestore/Firebase/write-batch mocks and dynamic module mocks that stand in for SDK surfaces. | The broad value shape is confined to the mock layer and does not define runtime contracts. |
| UI/HARNESS STATE BAG | React hook/component harness state objects used to exercise broad dashboard flows. | The harness simulates runtime state breadth while assertions verify typed behavior at the public surface. |
| VALIDATOR RESULT BAG | Trade/Architect validator result objects with dynamic rule keys. | Validator output is intentionally map-like in tests; runtime validator contracts are tested separately. |
| SOURCE-SCAN GUARDRAIL | Tests importing barrels or reading source text dynamically. | The broad module object is the subject of the guardrail, not a runtime contract. |

## High-Volume Clusters

| Files | Classification | Follow-up |
| --- | --- | --- |
| `src/tests/architect/useArchitectActions.freeAgency.test.tsx`, `src/tests/architect/architectHardeningE4.polish.test.ts`, `src/tests/architect/useArchitectActions.actionYearCoherence.behavior.test.tsx`, `src/tests/architect/useArchitectActions_editContract_resync.behavior.test.tsx` | UI/HARNESS STATE BAG | Consider shared typed dashboard harness builders if these tests are edited again. |
| `src/tests/architect/capSheet.transactionMatrix.behavior.test.tsx`, `src/tests/architect/capSheet.uiFlows.integration.test.tsx`, `src/tests/architect/capSheet_toast_dedupe.behavior.test.ts`, `src/tests/architect/capSheet.displayCore.e88.behavior.test.tsx` | UI/HARNESS STATE BAG | Keep casts local to harness setup; do not move them into production helpers. |
| `src/tests/architect/tmCapIntegration*.test.tsx`, `src/tests/architect/mutationPipeline*.test.ts`, `src/tests/architect/dareMutatorExclusivityGate.test.ts`, `src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts` | SDK MOCK BOUNDARY | Future central Firebase mock tightening can replace repeated local bags. |
| `src/tests/tradeMachine/*.test.ts`, `tests/trade/*.test.ts`, `tests/architect/capLegalityValidation.test.ts`, `tests/architect/tradeManager.test.ts` | VALIDATOR RESULT BAG / NEGATIVE BOUNDARY FIXTURE | Keep malformed inputs explicit and local to fail-closed assertions. |
| `src/tests/architect/tradeMachineBarrelBatch.e131.guardrail.test.ts`, topology/import guardrails, and source-scan guardrail tests | SOURCE-SCAN GUARDRAIL | Dynamic imports remain intentionally broad because the test validates module surface shape. |

## File Coverage Inventory

Every file with Gate 5 scan hits is covered by one of the classifications
above. Counts are raw scan matches, not unreviewed debt counts.

| Hits | File | Primary classification |
| ---: | --- | --- |
| 32 | `src/tests/architect/useArchitectActions.freeAgency.test.tsx` | UI/HARNESS STATE BAG |
| 30 | `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx` | SDK MOCK BOUNDARY |
| 30 | `src/tests/architect/capSheet.transactionMatrix.behavior.test.tsx` | UI/HARNESS STATE BAG |
| 27 | `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts` | SDK MOCK BOUNDARY |
| 24 | `src/tests/architect/mutationPipeline.computeResultBridge.test.ts` | SDK MOCK BOUNDARY |
| 24 | `src/tests/architect/mutationPipeline.batchedHardening.test.ts` | SDK MOCK BOUNDARY |
| 23 | `src/tests/architect/mutationPipeline.boundary.e107.test.ts` | SDK MOCK BOUNDARY |
| 19 | `src/tests/architect/tradeContext_assertions.contract.test.ts` | VALIDATOR RESULT BAG |
| 19 | `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx` | SDK MOCK BOUNDARY |
| 15 | `src/tests/architect/tradeEditorTeamCard.boundary.e105.test.tsx` | UI/HARNESS STATE BAG |
| 15 | `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts` | SDK MOCK BOUNDARY |
| 15 | `src/tests/architect/capSheet_toast_dedupe.behavior.test.ts` | UI/HARNESS STATE BAG |
| 13 | `src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 12 | `src/tests/architect/useArchitectActions_editContract_resync.behavior.test.tsx` | UI/HARNESS STATE BAG |
| 12 | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` | VALIDATOR RESULT BAG |
| 12 | `src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts` | SDK MOCK BOUNDARY |
| 11 | `src/tests/architect/pickRightWizard.vacuumApply.test.tsx` | SDK MOCK BOUNDARY |
| 10 | `src/tests/architect/useArchitectActions.actionYearCoherence.behavior.test.tsx` | UI/HARNESS STATE BAG |
| 10 | `src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 10 | `src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts` | SDK MOCK BOUNDARY |
| 10 | `src/tests/architect/GMDashboard.smoke.test.tsx` | UI/HARNESS STATE BAG |
| 9 | `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts` | VALIDATOR RESULT BAG |
| 9 | `src/tests/architect/dashboardWorldBoundary.e109.test.tsx` | UI/HARNESS STATE BAG |
| 9 | `src/tests/architect/dareMutatorExclusivityGate.test.ts` | SDK MOCK BOUNDARY |
| 8 | `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts` | VALIDATOR RESULT BAG |
| 8 | `src/tests/architect/architectHardeningE4.polish.test.ts` | UI/HARNESS STATE BAG |
| 7 | `src/tests/architect/worldOptimistic_postStateValidator_blocks_violation.behavior.test.ts` | UI/HARNESS STATE BAG |
| 7 | `src/tests/architect/grouped33FileScope.ui.behavior.test.tsx` | UI/HARNESS STATE BAG |
| 7 | `src/tests/architect/entitlementIdentityMove.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 6 | `tests/architect/capLegalityValidation.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 6 | `tests/architect/EditContractModal.rules.test.tsx` | ASSERTION FALSE POSITIVE |
| 6 | `src/tests/architect/useArchitectState.worldFreeAgency.test.ts` | UI/HARNESS STATE BAG |
| 6 | `src/tests/architect/capSheet.uiFlows.integration.test.tsx` | UI/HARNESS STATE BAG |
| 5 | `tests/trade/useTradeMachine.validatorTrust.test.ts` | VALIDATOR RESULT BAG |
| 5 | `src/tests/architect/worldOptimistic_lock_serialization.behavior.test.ts` | UI/HARNESS STATE BAG |
| 5 | `src/tests/architect/tradeMachineBarrelBatch.e131.guardrail.test.ts` | SOURCE-SCAN GUARDRAIL |
| 5 | `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesTeamHistory.integration.test.tsx` | SDK MOCK BOUNDARY |
| 4 | `tests/trade/validatorContractCleanup.test.ts` | ASSERTION FALSE POSITIVE |
| 4 | `src/tests/security/firestoreRules.integration.test.ts` | ASSERTION FALSE POSITIVE |
| 4 | `src/tests/architect/tm1b.rosterValidationConsolidation.test.ts` | VALIDATOR RESULT BAG |
| 4 | `src/tests/architect/mutationPipeline.currentStateIngressClosure.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 4 | `src/tests/architect/mutationPipeline.catchallNarrowing.test.ts` | VALIDATOR RESULT BAG |
| 4 | `src/tests/architect/capSheet_exception_wiring.behavior.test.tsx` | NEGATIVE BOUNDARY FIXTURE |
| 4 | `src/tests/architect/baseMode_capAuditEventV1.localLog.behavior.test.ts` | UI/HARNESS STATE BAG |
| 3 | `tests/architect/teamLoader.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 3 | `src/tests/architect/worldTime.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 3 | `src/tests/architect/useTradeMachine.compatibility.guardrail.test.ts` | ASSERTION FALSE POSITIVE |
| 3 | `src/tests/architect/signAndTrade.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 3 | `src/tests/architect/mutationPipeline.currentStateCarrierClosure.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 3 | `src/tests/architect/freeAgentPool.surface.e86.behavior.test.tsx` | ASSERTION FALSE POSITIVE |
| 3 | `src/tests/architect/deadCapManagement.test.ts` | NEGATIVE BOUNDARY FIXTURE |
| 3 | `src/tests/architect/architectRuntimeBlockers.pass1.test.ts` | UI/HARNESS STATE BAG |
| 2 or fewer | Remaining listed scan-hit files | ASSERTION FALSE POSITIVE / NEGATIVE BOUNDARY FIXTURE / SOURCE-SCAN GUARDRAIL |

For files with two or fewer raw matches, the hits are limited to local
negative-fixture casts, `expect.any` assertions, source-scan guardrail imports,
or prose/string-literal false positives. No central mock owner remains
unclassified by this audit.
