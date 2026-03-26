| Issue ID | Related Step | Severity | Description                                                                                                                    | Status |
| -------- | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| TM-1A    | TM-1A        | HIGH     | UI preview legality does not represent all apply-time validation gates, so a trade can appear valid but fail during execution. | RESOLVED |
| TM-1B    | TM-1B        | MEDIUM   | Roster validation is split across validator core and post-state checks, creating duplication and drift risk.                   | OPEN   |
| TM-1C    | TM-1C        | MEDIUM   | Hard cap and apron enforcement is distributed across multiple modules without a clear single source of truth.                  | OPEN   |
| TM-1D    | TM-1D        | MEDIUM   | An alternate trade execution path may bypass mutation pipeline validation and post-state legality checks.                      | OPEN   |
