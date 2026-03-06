# B5 Offseason + Season Advance Static Audit

- Domain: `D05`
- Staleness status: `STALE` (offseason section/tab changed within 30 days; scoped test failure present)

## 10-Lens Review

| Lens | Evidence | Result |
|---|---|---|
| 1. Purpose/intent | Offseason section with world advance + DEV preview `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L127-L223` | PASS |
| 2. Input contracts | Offseason tab props and option-decision flow `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx:L19-L40` | PASS |
| 3. Rules correctness | Season advance requires world currentSeason and updates to next season `src/features/architect/utils/seasonManager.js:L193-L205`, `:L252-L260` | PASS |
| 4. State transitions/idempotency | Preview path updates local state only; world advance path uses batch writes | PASS |
| 5. Persistence boundaries | `seasonManager` persists world team docs and world metadata only `src/features/architect/utils/seasonManager.js:L241-L260` | PASS |
| 6. Error/fail-closed | Missing `currentSeason` throws `src/features/architect/utils/seasonManager.js:L195-L197` | PASS |
| 7. UX truthfulness | DEV warning banner exists `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L191-L195` | PASS WITH CONTRADICTION |
| 8. Tests/guardrails | Guardrail expects persistence-direction copy `src/tests/architect/offseason.devGate.guardrail.test.ts:L75-L77` | FAIL |
| 9. Perf/reactivity | World season fetch effect scoped by `worldId` `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L60-L81` | PASS |
| 10. Docs parity | `OFFSEASON_MASTER.md` stale relative to latest guardrail behavior | GAP |

### Finding: FIND-B5-001

- Domain: offseason_season_advance
- Severity: High
- Ship-Blocking: Yes
- Statement: The Architect scoped suite currently fails because OffseasonTab source text no longer contains the exact guardrail-required persistence phrase literal.
- Why it matters: A failing scoped Architect suite blocks readiness evidence for offseason workflow truthfulness and regression protection.
- Primary evidence:
  - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx:L99-L100`
  - `src/tests/architect/offseason.devGate.guardrail.test.ts:L75-L77`
  - `return_packages/architect/audit/C_stageC_test_architect.log` (failure excerpt + counts)
- Command(s) run:
  - `npm run test:architect -- --reporter=dot`
  - Output excerpt: `Test Files 1 failed | 166 passed (167)` and failing assertion at `offseason.devGate.guardrail.test.ts:76`.
- Expected vs Actual:
  - Expected: Guardrail test finds the required persistence-direction string in OffseasonTab source.
  - Actual: Test fails on `expect(source).toContain('Use World Season Advance to persist')` because source text is split in JSX (`Use` + newline + `World Season Advance...`).
- Confidence (0-100): 96
- Fix recommendation: Make the phrase contiguous in source OR update the guardrail to assert semantic rendering rather than brittle source substring matching.

## Verification Queue
- None.
