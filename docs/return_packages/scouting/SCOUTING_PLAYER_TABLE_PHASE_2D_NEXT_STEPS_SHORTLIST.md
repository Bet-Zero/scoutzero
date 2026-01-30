# SCOUTING PLAYER TABLE — Phase 2D Next Steps Shortlist

**DATE**: 2026-01-29  
**STATUS**: PLANNING

---

## Priority Shortlist (Max 6 Items)

| #   | Category | Task                           | Rationale                                                                              |
| --- | -------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| 1   | **PERF** | Debounce coverage audit        | Verify all filter inputs debounce correctly; document any gaps                         |
| 2   | **SORT** | Sort determinism / stable sort | Ensure players with equal sort values maintain consistent order                        |
| 3   | **UX**   | Empty state polish             | Add dedicated "No players found" UI with "Clear Filters" action                        |
| 4   | **CODE** | Headshot URL unification       | Remove inline normalization in `PlayerRow`; trust `player.headshotUrl` from enrichment |
| 5   | **PERF** | Filter performance profiling   | Profile `filterPlayers` with React DevTools; identify any hot paths                    |
| 6   | **UX**   | Drawer overlay edge cases      | Handle edge cases: filter removes expanded player; scroll position after drawer close  |

---

## Notes

- Items 1–3 are recommended for immediate Phase 2D execution
- Items 4–6 can be deferred to Phase 3 (Code Cleanup) if needed
- All items are within STOP CONDITIONS (no new UI actions/buttons, no virtualization replacement)
