# ARCHITECT AUDIT V3 CONSOLIDATED IMPLEMENTATION PLAN

## Purpose

This document consolidates:

1. The original Codex audit findings from March 5, 2026.
2. The Claude review of that audit's correctness and blueprint compliance.
3. A current-state revalidation pass started on March 6, 2026.

It is intended to replace a stage-by-stage reading workflow with one execution-oriented plan while preserving the original finding IDs and evidence trail.

## Source Artifacts

### Primary audit artifacts

- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_FULL_RUN_RETURN_PACKAGE.md`
- `return_packages/architect/audit/G1_FINAL_SCORECARD.md`
- `return_packages/architect/audit/G2_BLOCKER_BACKLOG.md`
- `return_packages/architect/audit/B5_OFFSEASON_SEASON_ADVANCE_STATIC_AUDIT.md`
- `return_packages/architect/audit/B4_FREE_AGENCY_OFFER_SHEET_STATIC_AUDIT.md`
- `return_packages/architect/audit/B8_CONTRACT_EDITOR_STATIC_AUDIT.md`
- `return_packages/architect/audit/D_UX_TRUTH_AUDIT.md`
- `return_packages/architect/audit/E2_SECURITY_POSTURE_AUDIT.md`

### Audit review artifacts

- `return_packages/architect/audit/reviews/ARCHITECT_AUDIT_V3_CLAUDE_REVIEW_RETURN_PACKAGE.md`
- `return_packages/architect/audit/reviews/ARCHITECT_AUDIT_V3_CLAUDE_SPOTCHECK_LOG.md`
- `return_packages/architect/audit/reviews/ARCHITECT_AUDIT_V3_CLAUDE_COMMAND_CONFIRMATION_LOG.md`

### Current-state spot checks used in this consolidation

- `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
- `src/tests/architect/offseason.devGate.guardrail.test.ts`
- `src/features/architect/utils/firebaseTeamPlanHelpers.js`
- `src/constants/collections.ts`
- `src/features/architect/contract/ContractEditor/ContractEditor.jsx`

### Live delta artifacts created from this consolidation

- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_LIVE_STATUS_DELTA.md`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_LIVE_STATUS_DELTA.json`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_VQ_E2_RULES_RUNTIME_PROOF.md`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_VQ_B4_FAIL_CLOSED_PROOF.md`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_VQ_D_MANUAL_EXECUTION_PACKAGE.md`

## Executive Summary

The March 5 Codex audit concluded `Not Ready` with a score of `78.45 / 100`, driven by one concrete ship-blocking finding (`FIND-B5-001`) and one queued ship-blocking evidence gap (`VQ-D-001`). Claude reviewed that audit and found no discrepancies. Claude confirmed the finding quality, the queue governance, the command evidence, and the verdict math.

The current repository state has already moved since that audit snapshot:

- `FIND-B5-001` now appears resolved in code and was revalidated by a fresh `npm run test:architect -- --reporter=dot` pass on March 6, 2026.
- `FIND-B4-001` now appears resolved in source via centralized collection constants.
- `FIND-B8-001` now appears resolved in source via removal of the audited debug log.

Because of that delta, the implementation plan should shift from “fix the three audit findings” to “confirm current-state resolutions, then close the remaining evidence gaps and re-score.”

## Historical Audit vs Review Comparison

| Area                     | Codex audit result                                             | Claude review result                                       | Consolidated conclusion   |
| ------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------- |
| Artifact completeness    | All expected A-G artifacts present                             | Confirmed                                                  | Closed                    |
| Domain coverage          | 10 architect domains covered by B1-B10                         | Confirmed                                                  | Closed                    |
| Finding schema quality   | 3 findings and 3 queue items documented                        | Confirmed required schema fields and anchors               | Closed                    |
| Runtime command evidence | Typecheck, build, test:diff, test:architect, test:trade logged | Confirmed mandatory commands and accepted Stage C evidence | Closed                    |
| UX truth stage           | Fallback code-trace path used; no screenshot proof             | Confirmed fallback path is blueprint-valid                 | Still needs runtime proof |
| Security posture stage   | Static posture strong; runtime rules proof missing             | Confirmed queueing was correct                             | Still needs runtime proof |
| Final verdict            | `Not Ready`, `78.45 / 100`                                     | Confirmed exact score math and threshold application       | Historically correct      |

## Consolidated Status Matrix

| ID            | Historical status     | Claude comparison          | Current status on March 6                                                | Consolidated disposition                                           | Next action                                         |
| ------------- | --------------------- | -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------- |
| `FIND-B5-001` | High, ship-blocking   | Confirmed                  | Resolved in current tree and architect suite now passes                  | Move to `Resolved since audit`                                     | Archive fresh proof and remove from active backlog  |
| `FIND-B4-001` | Medium                | Confirmed                  | Appears resolved in current tree                                         | Move to `Candidate resolved` pending broader regression confidence | Keep as resolved unless future drift appears        |
| `FIND-B8-001` | Low                   | Confirmed                  | Appears resolved in current tree                                         | Move to `Candidate resolved`                                       | No further action unless log reappears              |
| `VQ-D-001`    | Queued, ship-blocking | Confirmed queue governance | Still open, but narrowed to entitlement/runtime authoring proof          | Remains active                                                     | Finish the remaining entitlement save-path evidence |
| `VQ-E2-001`   | Queued                | Confirmed queue governance | Resolved by runtime rules proof on March 6                               | Move to `Resolved since audit`                                     | Keep proof artifact attached for verdict update     |
| `VQ-B4-001`   | Queued                | Confirmed queue governance | Resolved by fail-closed implementation and focused hook proof on March 6 | Move to `Resolved since audit`                                     | Keep proof artifact attached for verdict update     |

## Detailed Breakdown

### `FIND-B5-001` — Offseason guardrail mismatch

#### Historical audit position

- Source: `return_packages/architect/audit/B5_OFFSEASON_SEASON_ADVANCE_STATIC_AUDIT.md`
- Severity: `High`
- Ship-Blocking: `Yes`
- Original claim: the source phrase required by `src/tests/architect/offseason.devGate.guardrail.test.ts` was split across JSX lines in `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`, causing the architect suite to fail.

#### Claude review position

- Source: `return_packages/architect/audit/reviews/ARCHITECT_AUDIT_V3_CLAUDE_SPOTCHECK_LOG.md`
- Result: confirmed the source split, the guardrail expectation, and the failing architect test log.
- Disagreement: none.

#### Current-state revalidation

- Current source now contains the contiguous string in `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`.
- The guardrail test in `src/tests/architect/offseason.devGate.guardrail.test.ts` still expects that exact string.
- Fresh command run on March 6, 2026:
  - `npm run test:architect -- --reporter=dot`
  - Result: `Test Files 167 passed (167)` / `Tests 2454 passed (2454)` / `Duration 163.29s`

#### Consolidated decision

`FIND-B5-001` is no longer an active implementation item. It should be marked `Resolved since audit` and retained only for audit history and score-delta recalculation.

### `FIND-B4-001` — Hardcoded `freeAgents` collection usage

#### Historical audit position

- Source: `return_packages/architect/audit/B4_FREE_AGENCY_OFFER_SHEET_STATIC_AUDIT.md`
- Severity: `Medium`
- Original claim: `src/features/architect/utils/firebaseTeamPlanHelpers.js` used hardcoded `'freeAgents'` strings rather than centralized collection constants.

#### Claude review position

- Source: `return_packages/architect/audit/reviews/ARCHITECT_AUDIT_V3_CLAUDE_SPOTCHECK_LOG.md`
- Result: confirmed both hardcoded usages and confirmed the collection constant was absent at audit time.
- Disagreement: none.

#### Current-state revalidation

- `src/features/architect/utils/firebaseTeamPlanHelpers.js` now uses `FREE_AGENTS_COLLECTION`.
- `src/constants/collections.ts` now defines `FREE_AGENTS_COLLECTION`.

#### Consolidated decision

`FIND-B4-001` appears resolved. Because this was a static consistency finding rather than a failing runtime gate, no additional dedicated test was run in this consolidation pass. Treat it as `Candidate resolved`, with no active code work required unless future drift is detected.

### `FIND-B8-001` — Contract editor debug log

#### Historical audit position

- Source: `return_packages/architect/audit/B8_CONTRACT_EDITOR_STATIC_AUDIT.md`
- Severity: `Low`
- Original claim: `src/features/architect/contract/ContractEditor/ContractEditor.jsx` contained an unconditional `console.log` in render path.

#### Claude review position

- Source: `return_packages/architect/audit/reviews/ARCHITECT_AUDIT_V3_CLAUDE_SPOTCHECK_LOG.md`
- Result: confirmed the exact log line at audit time.
- Disagreement: none.

#### Current-state revalidation

- The audited log line is no longer present in `src/features/architect/contract/ContractEditor/ContractEditor.jsx`.

#### Consolidated decision

`FIND-B8-001` appears resolved and should not remain in the active implementation backlog.

### `VQ-D-001` — Missing runtime UX proof

#### Historical audit position

- Source: `return_packages/architect/audit/D_UX_TRUTH_AUDIT.md`
- Type: verification queue
- Ship-Blocking: `Yes (queued)`
- Original claim: no screenshot-backed runtime proof was captured for audited workflows.

#### Claude review position

- Confirmed this was correctly queued because confidence was below 70.
- Confirmed it was not the sole basis for the March 5 `Not Ready` verdict.

#### Current-state revalidation

- Review-mode Playwright now auto-creates or selects a world before world-backed checklist rows run.
- `D-MQ-002` now passes in review mode with automated world-date advancement proof.
- `D-MQ-007` now passes in review mode with automated season-advance modal/world-gating proof.
- `D-MQ-005` now passes in review mode as a persisted offer-sheet proof: Playwright submits a legal seeded offer sheet, renders the pending row, and verifies the saved ATL world document through emulator-backed admin read.

#### Consolidated decision

`VQ-D-001` remains active and is now the highest-value remaining readiness task, but its scope is narrower than before. The execution path is hybrid: keep the hardened Playwright suite for deterministic shell and world-backed proof, then finish the remaining entitlement save-path checks with emulator-backed walkthrough evidence.

### `VQ-E2-001` — Missing runtime Firestore rules proof

#### Historical audit position

- Source: `return_packages/architect/audit/E2_SECURITY_POSTURE_AUDIT.md`
- Type: verification queue
- Original claim: the security posture was well supported statically, but `npm run test:rules` had not been executed in the audit run.

#### Claude review position

- Confirmed queue routing was correct.
- Confirmed the static security posture claims were evidence-backed.

#### Current-state revalidation

- Runtime proof was produced on March 6, 2026.
- Command run:
  - `npm run test:rules`
- Result:
  - `Test Files 1 passed (1)`
  - `Tests 16 passed (16)`
- Proof artifact:
  - `return_packages/architect/audit/ARCHITECT_AUDIT_V3_VQ_E2_RULES_RUNTIME_PROOF.md`

#### Consolidated decision

`VQ-E2-001` is resolved by runtime proof and should be removed from the active backlog.

### `VQ-B4-001` — Free agency failure-path proof gap

#### Historical audit position

- Source: `return_packages/architect/audit/B4_FREE_AGENCY_OFFER_SHEET_STATIC_AUDIT.md`
- Type: verification queue
- Original claim: the audit could not prove whether a failure in world roster index loading could temporarily over-include world players in the free-agent pool.

#### Claude review position

- Confirmed the item was correctly queued under the confidence threshold.

#### Current-state revalidation

- The failure path was reproduced and fixed in the hook state logic.
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts` now keeps `worldRosterIndex` unresolved on `getLeague(worldId)` failure and clears the pool.
- Focused proof command:
  - `npm run test:node -- --reporter=dot src/tests/architect/useArchitectState.worldFreeAgency.test.ts`
- Result:
  - `Test Files 1 passed (1)`
  - `Tests 2 passed (2)`
- Proof artifact:
  - `return_packages/architect/audit/ARCHITECT_AUDIT_V3_VQ_B4_FAIL_CLOSED_PROOF.md`

#### Consolidated decision

`VQ-B4-001` is resolved by fail-closed behavior plus focused executable proof and should be removed from the active backlog.

## Active Implementation Backlog

### Bucket 1 — Resolved since audit

- `FIND-B5-001`

### Bucket 2 — Candidate resolved from current source inspection

- `FIND-B4-001`
- `FIND-B8-001`

### Bucket 3 — Still open, evidence-only

- `VQ-D-001`

### Bucket 4 — Still open, targeted investigation

### Bucket 5 — Resolved by runtime proof since audit

- `VQ-E2-001`

### Bucket 6 — Resolved by code fix plus focused proof since audit

- `VQ-B4-001`

## Ordered Execution Plan

### Phase 1 — Lock in current-state resolution evidence

1. Record the March 6 `test:architect` pass as closure evidence for `FIND-B5-001`.
2. Preserve the current source proof for `FIND-B4-001` and `FIND-B8-001` as post-audit deltas.
3. Update the active blocker list so the historical B5 blocker does not remain incorrectly open.

### Phase 2 — Complete remaining agent-owned proof work

1. No remaining agent-owned queue items are open from the March 5 audit set.

### Phase 3 — Complete remaining user/manual proof work

1. Execute `return_packages/architect/audit/D_MANUAL_QA_CHECKLIST.md` in emulator mode.
2. Capture screenshots and notes for the audited UX flows referenced by `VQ-D-001`.

### Phase 4 — Re-score and reissue readiness status

1. Recompute the Stage G score using the original weighting model.
2. Update the verdict only after Phases 1 through 3 produce fresh evidence.
3. Archive the result as a post-audit delta rather than rewriting the March 5 return package.

## Validation Log for This Consolidation Start

### Commands run

1. `npm run test:architect -- --reporter=dot`
2. `npm run test:rules`
3. `npm run test:node -- --reporter=dot src/tests/architect/useArchitectState.worldFreeAgency.test.ts`

### Results

1. `npm run test:architect -- --reporter=dot`
   - Exit: `0`
   - Summary: `Test Files 167 passed (167)` / `Tests 2454 passed (2454)`
   - Duration: `163.29s`
2. `npm run test:rules`
   - Exit: `0`
   - Summary: `Test Files 1 passed (1)` / `Tests 16 passed (16)`
   - Duration: `42.98s`
3. `npm run test:node -- --reporter=dot src/tests/architect/useArchitectState.worldFreeAgency.test.ts`
   - Exit: `0`
   - Summary: `Test Files 1 passed (1)` / `Tests 2 passed (2)`
   - Duration: `10.25s`

### Commands intentionally not run yet

1. `npm run build`
   - Not required for this implementation start because no app code was changed in this pass.
2. `npm run typecheck`
   - Not required for this implementation start because no TS/TSX code was changed in this pass.

## Exit Criteria

This consolidated plan can be considered complete when:

1. `FIND-B5-001`, `FIND-B4-001`, and `FIND-B8-001` are formally reclassified out of the active backlog.
2. `VQ-E2-001` has fresh runtime rules proof.
3. `VQ-D-001` has fresh emulator-backed screenshot and walkthrough proof.
4. `VQ-B4-001` has either targeted proof or a superseding fix/test.
5. The Stage G score is recomputed using the same weighting model and a new readiness statement is issued.

## Live Delta Reference

Use the live delta artifacts below when you need the current active backlog without changing the historical March 5 audit package:

- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_LIVE_STATUS_DELTA.md`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_LIVE_STATUS_DELTA.json`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_VQ_E2_RULES_RUNTIME_PROOF.md`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_VQ_B4_FAIL_CLOSED_PROOF.md`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_VQ_D_MANUAL_EXECUTION_PACKAGE.md`
