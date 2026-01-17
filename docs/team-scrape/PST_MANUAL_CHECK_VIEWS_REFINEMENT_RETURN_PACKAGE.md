# PST Manual Check Views Refinement Return Package

**Date**: 2026-01-17
**Phase**: 6.2 - Tag Generation Refinement
**Status**: COMPLETE

---

## Summary

Refactored the manual check views generator to produce cleaner, Fanspo-like tags with:

- Protection deduplication and conflict resolution
- Year-based protection filtering
- Separate formatting for swap controllers vs favorable pools
- PROT_CONFLICT marker for contradictory protections

This is a **presentation-layer fix only**. No changes were made to Phase 4/5 parsing logic or ledger/profile schemas.

---

## Files Modified

| File | Changes |
|------|---------|
| `team-scrape/draft-picks/scripts/pst/pst_phase_6_manual_check_views.ts` | Replaced `composeOutcomeSpec()` with `generateTags()` implementing new tagging rules |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | Updated Tag Generation Rules table with Phase 6.2 refinements |

---

## How to Run

```bash
npm run pst:manual-views
```

Or as part of the full pipeline:

```bash
npm run pst:build-final
```

---

## BOS Before/After Comparison

### BEFORE (Phase 6.1)

```
════════════════════════════════════════════════════════════════════════════════
# BOS — BOSTON CELTICS (13 picks)

────────────────────────────────────────────────────────────────────────────────
2026 | 1 | own | 
2026 | 2 | via MIL | Top 4; swap:ORL — least of (MIL,ORL)
2026 | 2 | via MIN | Top 55
2026 | 2 | via NOP | Top 4
2027 | 1 | own | 
2028 | 1 | via SAS | Top 4; Top 1; protected #46-60; swap:SAS
2030 | 1 | own | 
2031 | 1 | own | 
2031 | 2 | via HOU | Top 55
2032 | 1 | own | 
2032 | 2 | own | 
2033 | 1 | own | 
2033 | 2 | own | 
```

### AFTER (Phase 6.2)

```
════════════════════════════════════════════════════════════════════════════════
# BOS — BOSTON CELTICS (13 picks)

────────────────────────────────────────────────────────────────────────────────
2026 | 1 | own | 
2026 | 2 | via MIL | Top 4, least of (MIL,ORL), did not convey
2026 | 2 | via MIN | Top 55, did not convey
2026 | 2 | via NOP | Top 4, did not convey
2027 | 1 | own | 
2028 | 1 | via SAS | Top 4, protected #46-60, swap SAS, PROT_CONFLICT
2030 | 1 | own | 
2031 | 1 | own | 
2031 | 2 | via HOU | Top 55
2032 | 1 | own | 
2032 | 2 | own | 
2033 | 1 | own | 
2033 | 2 | own | 
```

### Key Changes Verified

| Line | Before | After | Fix |
|------|--------|-------|-----|
| 2028 via SAS | `Top 4; Top 1; protected #46-60; swap:SAS` | `Top 4, protected #46-60, swap SAS, PROT_CONFLICT` | Conflicting Top N resolved to broadest (Top 4), PROT_CONFLICT added |
| 2026 via MIL | `Top 4; swap:ORL — least of (MIL,ORL)` | `Top 4, least of (MIL,ORL), did not convey` | Favorable pool shown as `least of (...)` not as swap prefix |

---

## IND Before/After Comparison

### BEFORE (Phase 6.1)

```
2026 | 1 | own | Top 3; Top 10; Top 4
```

### AFTER (Phase 6.2)

```
2026 | 1 | own | Top 10, PROT_CONFLICT
```

**Fix**: Three conflicting Top N protections (Top 3, Top 4, Top 10) resolved to broadest (Top 10), with PROT_CONFLICT marker.

---

## Validation Checklist

- [x] BOS lines have no `swap:TEAM` unless controller exists
- [x] Favorable pools shown as `least of (...)` / `most of (...)` not as swap prefixes
- [x] At most one Top N tag per year (broadest chosen if multiple)
- [x] Contradictory Top N tags show PROT_CONFLICT marker
- [x] Only presentation logic changed (no schema/parser changes)
- [x] Master doc updated with refined tag generation rules

---

## Confirmation

Only presentation logic in `pst_phase_6_manual_check_views.ts` was modified. The function `generateTags()` replaces `composeOutcomeSpec()` and:

1. Filters protections by `appliesToYears` containing the pick year
2. Dedupes identical protections
3. Resolves conflicting Top N to broadest value + PROT_CONFLICT
4. Emits favorable pools as `least of (...)`/`most of (...)` separately
5. Emits `swap {controller}` only when no favorable pool present
6. Limits tags to 4 per line

No changes to:

- `pst_pick_rule_parser.ts` (Phase 4)
- `pst_phase_5_finalize.ts` (Phase 5)
- `pst_pick_ledger_final_2026_2033.json` (final ledger)
- `pst_pick_rule_profiles_final_2026_2033.json` (final profiles)

---

**Phase Status: COMPLETE**
