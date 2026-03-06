# F1 Contradiction Ledger

## Canonical Hierarchy Used
1. Running code behavior
2. Passing tests
3. Master docs (`docs/architect/*_MASTER.md`)
4. Return packages
5. Inline comments

## Contradictions

| Contradiction ID | Sources in Conflict | Winner Source | Rationale | Severity | Status |
|---|---|---|---|---|---|
| CDR-001 | OffseasonTab source copy split across JSX line break vs guardrail expectation of exact phrase (`offseason.devGate.guardrail`) | Passing-tests contract (tier 2) once fixed; currently unresolved in code | Stage C shows active test failure. In this run, the guardrail is the enforceable release signal for this workflow. | High | RESOLVED-WINNER + ACTION_OPEN |
| CDR-002 | Collection constants policy (`src/constants/collections.ts`) vs hardcoded `'freeAgents'` in helper | Running code (tier 1) | Runtime behavior currently uses literal path; docs/policy must align by code fix to constants import. | Medium | RESOLVED-WINNER + ACTION_OPEN |
| CDR-003 | Older domain masters vs current code/test state after Feb-Mar 2026 changes | Running code + current tests (tiers 1-2) | Multiple domain files changed within 30 days and one scoped test currently fails; docs treated as stale context only. | Low | RESOLVED |

## Required Follow-Up Updates (Lower Authority)
- Fix `CDR-001` by updating either:
  - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx` (contiguous phrase), or
  - `src/tests/architect/offseason.devGate.guardrail.test.ts` (render-semantic assertion instead of brittle source substring).
- Fix `CDR-002` by updating:
  - `src/constants/collections.ts` (add free-agent constant),
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js` (import constant).
- Refresh stale doc narratives in:
  - `docs/architect/OFFSEASON_MASTER.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
  - `docs/architect/CAP_SHEET_MASTER.md`

## Stage F Exit Check
- Every contradiction has winner + rationale recorded.
- No unresolved High+ contradiction without owner/action path remains.
