# B4 Free Agency + Offer Sheet Static Audit

- Domain: `D04`
- Staleness status: `STALE` (hooks/actions changed within 30 days)

## 10-Lens Review

| Lens | Evidence | Result |
|---|---|---|
| 1. Purpose/intent | FA actions and contract flow `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L1511-L1586` | PASS |
| 2. Input contracts | Contract normalization before mutation `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L1527-L1537`, `:L1875-L1883` | PASS |
| 3. Rules correctness | World-required authoritative mutations for S&T/offer sheets `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L1724-L1841`, `:L1846-L2085` | PASS |
| 4. State transitions/idempotency | Mutation truth evaluation uses write summaries `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L757-L805` | PASS |
| 5. Persistence boundaries | World-only authoritative FA path `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L932-L975` | PASS |
| 6. Error/fail-closed | Missing world/user guards fail fast `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:L940-L952` | PASS |
| 7. UX truthfulness | Offer-sheet toggle behavior in pool tests `src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx:L83-L167` | PASS |
| 8. Tests/guardrails | World-aware FA hook test `src/tests/architect/useArchitectState.worldFreeAgency.test.tsx:L82-L134` | PASS WITH GAP |
| 9. Perf/reactivity | World roster index memo/filter strategy `src/features/architect/GMDashboard/hooks/useArchitectState.ts:L393-L441`, `:L503-L568` | PASS WITH GAP |
| 10. Docs parity | Collection constants policy in `src/constants/collections.ts:L1-L6` | GAP |

### Finding: FIND-B4-001

- Domain: free_agency_offer_sheet
- Severity: Medium
- Ship-Blocking: No
- Statement: Free-agent persistence helper uses hardcoded `'freeAgents'` collection strings instead of centralized constants, creating drift risk against collection SSOT policy.
- Why it matters: Collection naming drift can silently fork data between environments and bypass centralized path governance.
- Primary evidence:
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js:L248-L249`
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js:L262-L263`
  - `src/constants/collections.ts:L1-L6`
- Command(s) run:
  - `N/A - static code audit`
  - Output excerpt: `N/A - static code audit`
- Expected vs Actual:
  - Expected: Architect data collection names are imported from centralized constants/path helpers.
  - Actual: Helper uses literal `'freeAgents'` for both `doc()` and `collection()` calls.
- Confidence (0-100): 86
- Fix recommendation: Introduce `FREE_AGENTS_COLLECTION` constant in `src/constants/collections.ts` and import it in `firebaseTeamPlanHelpers.js`.

## Verification Queue
`FindingID | Missing evidence | What to run/check | Owner | Status`

`VQ-B4-001 | Cannot confirm production incidence of worldRosterIndex load-failure branch causing temporary FA over-inclusion | Inject getLeague failure in world mode; validate if fallback empty index causes transient FA inflation and whether UI blocks signing until refresh | Agent | QUEUED`

Evidence anchors for queued item:
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:L434-L439`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:L515-L518`
