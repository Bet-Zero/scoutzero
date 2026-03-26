| ID    | Title                                          | Status | Notes |
| ----- | ---------------------------------------------- | ------ | ----- |
| TM-1A | Preview vs Apply Truth Alignment               | DONE | All local gates in preview (CBA snapshot + post-state cap); 3 Firestore-dependent gates remain apply-only by necessity; UI truthfully discloses limits |
| TM-1B | Roster Validation Consolidation                | DONE   | ROSTER_LIMITS + checkRosterCounts canonical in validateRoster.ts; tradeValidator delegates; postStateCapValidator uses shared constants + adds min-roster check; rosterValidation.ts and enforcement.ts use ROSTER_LIMITS; 15 new tests pass |
| TM-1C | Hard Cap / Apron Rule Consolidation            | TODO   |       |
| TM-1D | Alternate Execution Path Removal / Containment | TODO   |       |
