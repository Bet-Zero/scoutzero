# C3 Gap List Untested Risks

## Open Gaps

| Gap ID | Requirement Link | Gap Description | Impact | Routing |
|---|---|---|---|---|
| GAP-C-001 | ARQ-010 | Architect scoped suite has one failing offseason guardrail test (`offseason.devGate.guardrail`). | High (ship-blocking) | Finding `FIND-B5-001` |
| GAP-C-002 | ARQ-018/019 | Firestore emulator integration test matrix not executed in this run (`test:rules`). | Medium | Verification Queue `VQ-E2-001` |
| GAP-C-003 | ARQ-002/010/012 | No live emulator/manual UX run in this environment for screenshot-backed truth proof. | Medium | Verification Queue `VQ-D-001` |
| GAP-C-004 | ARQ-009 | Free-agent world roster index failure branch incidence not dynamically reproduced. | Low-Medium | Verification Queue `VQ-B4-001` |

## Scripts Availability Check
- `test:architect`: AVAILABLE (run)
- `test:trade`: AVAILABLE (run)
- `test:smoke:architect`: AVAILABLE (not required, not run)
- `gates:architect`: AVAILABLE (not explicitly required for this run, not run)
- Missing desired scripts: none
