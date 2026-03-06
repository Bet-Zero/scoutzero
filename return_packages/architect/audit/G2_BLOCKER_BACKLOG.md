# G2 Blocker Backlog

## Open Blockers (Ordered)

| ID | Severity | Ship-Blocking | Confidence | Type | Owner | Status | Required Next Step |
|---|---|---|---:|---|---|---|---|
| FIND-B5-001 | High | Yes | 96 | Finding | Agent | OPEN | Make offseason persistence phrase/test contract consistent and rerun `npm run test:architect -- --reporter=dot`. |
| VQ-D-001 | N/A (Queue) | Yes (Queued) | 55 | Verification Queue | User | QUEUED | Execute `D_MANUAL_QA_CHECKLIST.md` in emulator session and attach runtime screenshots/evidence. |
| VQ-E2-001 | N/A (Queue) | No | 65 | Verification Queue | Agent | QUEUED | Run `npm run test:rules` in emulator-backed environment and capture output excerpt matrix. |
| FIND-B4-001 | Medium | No | 86 | Finding | Agent | OPEN | Replace hardcoded `freeAgents` literals with centralized constant imports. |
| VQ-B4-001 | N/A (Queue) | No | 62 | Verification Queue | Agent | QUEUED | Simulate world roster index load failure and validate FA pool behavior under failure branch. |
| FIND-B8-001 | Low | No | 93 | Finding | Agent | OPEN | Remove/DEV-gate legacy contract editor debug log statement. |

## Top Ship-Blocking IDs
- FIND-B5-001
- VQ-D-001
