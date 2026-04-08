# ARCHITECT ROSTER ISSUE LOG

---

## STEP 1 - Roster Display Adapter, World/Base Truth Dependency, and Legacy Boundary

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| AR-1-1 | AR-1A | MEDIUM | The roster view is a display consumer of `teamCapSheet.players` and `playersMap`, but the contract is implicit. `useArchitectState` builds world-aware `playersMap` from base players plus world overrides, while `RosterVisual` merges only selected lookup keys into hydrated team players and keeps the hydrated player object authoritative. That may be correct, but it is not obvious or guarded as the intended world/base truth model. | OPEN |
| AR-1-2 | AR-1A, AR-1B | MEDIUM | Architect roster intentionally reuses legacy roster rendering and utility code from the standalone roster feature. The live path appears display-only because `RosterVisual` passes `isExport`, which hides add/remove controls, but the boundary between Architect display mode and older mutable roster workflows is convention-based rather than clearly pinned. | OPEN |
| AR-1-3 | AR-1B | MEDIUM | Existing test coverage is mostly smoke/import coverage plus one shallow UI behavior test. It does not meaningfully prove world/base roster truth, `playersMap` override behavior, real legacy roster utility behavior, or the display-only boundary against hidden add/remove persistence drift. | OPEN |

---

## Current Issue Summary

The issue set is small and local. There is no evidence that Architect Roster owns persistence or should become a multi-step feature. The root problems are adapter-truth explicitness, legacy-boundary durability, and focused guardrail coverage.
