# Phase 20 Return Package: World Time SSOT

**Date:** 2026-01-20  
**Mode:** EXECUTION  
**Status:** ✅ Complete

---

## Executive Summary

Phase 20 introduces a **single source of truth for "world time"** (`asOfDate`) so timing-based CBA rules can be legally enforced in future phases (stretch timing, 48-hour offer sheet window) **without hacks**.

Key deliverables:

- Canonical `asOfDate` field stored at world level
- Mutation pipeline threads `asOfDate` through all phases
- Safe defaults with explicit warning when date is defaulted
- Clear persistence policy documented

---

## Files Changed

| Path | Change |
|------|--------|
| [mutationPipeline.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js) | Added `resolveWorldAsOfDate()` helper; threaded `asOfDate` through `applyWorldMutation`, `computeWorldMutation`, `validateMutation`, `persistWorldMutation`; emits `world_time_defaulted` warning |
| [capLegalityValidation.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capLegalityValidation.js) | Added `world_time_defaulted` to `SOFT_WARNING_RULES` |
| [worldTime.test.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/worldTime.test.js) | New test file with 14 tests covering resolution, warning, and persist behavior |
| [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md) | Added Phase 20 changelog + World Time SSOT section (9.8) |

---

## World Time SSOT Spec

### Field Name + Location

- **Field:** `asOfDate` (ISO date string, e.g., `"2026-01-20"`)
- **Location:** `architect_worlds/{worldId}` document

### Resolution Precedence

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | Payload `asOfDate` | Explicit date from mutation payload |
| 2 | World metadata `asOfDate` | Date stored on world document |
| 3 | System fallback | Current date (`new Date().toISOString().slice(0,10)`) + warning |

### Overwrite Policy

- **Only update** world metadata `asOfDate` when payload explicitly provides it
- **Never overwrite** silently when payload omits `asOfDate`
- Allows mutations to reference a specific date without advancing world time

---

## Rule IDs Added/Updated

| Rule ID | Severity | Description |
|---------|----------|-------------|
| `world_time_defaulted` | Warning | Neither payload nor world metadata provided `asOfDate`; date was defaulted to system time |

---

## Tests Added

| Test | Description |
|------|-------------|
| T1 | `resolveWorldAsOfDate` uses payload date when provided (highest priority) |
| T2 | Uses world date when payload is missing |
| T2b | Uses world date when payload is undefined |
| T3 | Returns defaulted date when both payload and world are missing |
| T3b | Returns defaulted date when both are undefined |
| T3c | Returns defaulted date when inputs are empty strings |
| T4 | `world_time_defaulted` exists in SOFT_WARNING_RULES |
| T4b | Warning structure includes `asOfDateUsed` field |
| T5 | `computeWorldMutation` signature accepts `asOfDate` |
| T6 | worldPatch includes `asOfDate` when payload provides it |
| T7 | worldPatch does NOT include `asOfDate` when payload omits it |
| T7b | worldPatch does NOT include `asOfDate` when payload has undefined |
| + | Edge cases: non-string values ignored |

---

## Test Output

```
 ✓ src/tests/architect/worldTime.test.js (14)
   ✓ Phase 20: World Time SSOT (14)
     ✓ resolveWorldAsOfDate helper (8)
     ✓ world_time_defaulted warning rule (1)
     ✓ Warning emission in validateMutation (integration) (1)
     ✓ asOfDate context threading (structural) (1)
     ✓ Persist path behavior (structural) (3)

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  3.63s
```

---

## Build Output

```
vite v4.5.14 building for production...
✓ 2930 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-4afc0256.css            73.91 kB │ gzip:  12.97 kB
dist/assets/index-f7cbeaa8.js          1,913.50 kB │ gzip: 557.99 kB
✓ built in 24.52s
```

---

## Master Doc Diff Summary

### Changelog Entry (Phase 20)

Added to Section 10 Change Log:
> **Contract Rules Phase 20:** World Time SSOT. (1) Added `resolveWorldAsOfDate()` helper as single source of truth for world time. Resolution priority: payload `asOfDate` → world metadata `asOfDate` → system fallback. (2) Threaded `asOfDate` through mutation pipeline. (3) Added `world_time_defaulted` warning rule. (4) Persist policy: only write `asOfDate` to world metadata when payload explicitly includes it. (5) 14 new tests added. Build succeeds.

### New Section Added

**Section 9.8: World Time SSOT (Phase 20)** - Documents field location, resolution precedence, helper function, persistence policy, warning rule, and Phase 21 enablement.

---

## Known Limitations / Next Steps

Phase 20 **only introduces time SSOT + threading**. Does NOT implement:

| Rule | Phase | Status |
|------|-------|--------|
| `stretch_timing_invalid` | 21 | Ready to implement using `asOfDate` |
| 48-hour offer sheet window | 21+ | Ready to implement using `asOfDate` |
| Season phase detection | 21+ | May require additional world metadata |

**Phase 21 can now implement timing rules using `asOfDate` from validation context without additional plumbing.**
