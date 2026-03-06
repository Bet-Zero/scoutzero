# A2 Requirement Matrix

## Requirement Matrix (Stage A -> B/C/D/E/G)

| Requirement ID | Domain(s) | Requirement | Blueprint Lens Coverage |
|---|---|---|---|
| ARQ-001 | D01 | `/gm/:teamId` must mount GMDashboard and expose all Architect tabs. | 1,7 |
| ARQ-002 | D01,D09 | World selector/time controls must be world-scoped and persist to world metadata only. | 4,5,7 |
| ARQ-003 | D02 | Trade validation must execute canonical validator/rule chain before persistence. | 2,3,4 |
| ARQ-004 | D02,D09 | Trade apply must fail closed on invalid routing and avoid writes on invalid trade contexts. | 4,6 |
| ARQ-005 | D02,D10 | Trade persistence writes must stay inside `architect_worlds/{worldId}/...`. | 5 |
| ARQ-006 | D03 | Team cap totals must be computed via `computeTeamCapTotals()` SSOT at UI + pipeline call sites. | 3,7 |
| ARQ-007 | D03,D09 | Post-mutation totals must match SSOT and survive persist/reload parity. | 4,8 |
| ARQ-008 | D04 | Authoritative FA actions (sign/S&T/offer sheet) must require active world + user identity. | 2,5,6 |
| ARQ-009 | D04 | FA pool derivation must not classify rostered world players as free agents. | 3,4,7 |
| ARQ-010 | D05 | Offseason DEV preview path must remain non-persisting and clearly labeled. | 1,7,10 |
| ARQ-011 | D05,D09 | World season advance must persist only world team snapshots + world metadata updates. | 4,5 |
| ARQ-012 | D06 | Team history timeline must resolve world events by world/team scope and normalize display safely. | 2,7 |
| ARQ-013 | D06,D09 | History event payloads must include operation/totals metadata for traceability. | 3,4,8 |
| ARQ-014 | D07 | Entitlement writes must be world-scoped and collision-safe (deterministic identity). | 2,5,6 |
| ARQ-015 | D07,D10 | Entitlement systems must never write base entitlement collections in GM flows. | 5,6 |
| ARQ-016 | D08 | Edit-contract actions must be success-gated; failure paths must avoid false-success close behavior. | 4,7,8 |
| ARQ-017 | D09 | Mutation pipeline must remain single write choke-point with contract validation and atomic batch commit. | 4,5,6 |
| ARQ-018 | D10 | Firestore rules must enforce owner-only world writes and explicit base read-only denies. | 5,6 |
| ARQ-019 | D10 | Unmatched Firestore paths must fail closed (`allow read, write: if false`). | 6 |
| ARQ-020 | All | Dynamic proof must include command text, runtime, output excerpts, and unresolved gaps queued. | 8,10 |

## Risk Order For Stage B
1. D02 Trade Machine (high rules + boundary impact)
2. D03 Cap Sheet/SSOT Totals (cross-surface truth)
3. D09 Persistence/World Data (single write path)
4. D10 Security Boundaries (rules enforcement)
5. D05 Offseason/Season Advance
6. D04 Free Agency/Offer Sheets
7. D07 Entitlements Admin/DARE
8. D06 Team History
9. D01 Dashboard Orchestration
10. D08 Contract Editor
