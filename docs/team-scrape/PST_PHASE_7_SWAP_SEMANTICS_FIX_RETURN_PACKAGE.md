# PST Phase 7 Swap Semantics Fix — Return Package

**Date**: 2026-01-18  
**Status**: COMPLETE

---

## Summary

Fixed Phase 5.3 semantic shortcut where simple swaps (mostLeast=null) defaulted to "most" order. Simple swaps now correctly emit `kind: 'swap_right'` without ranked semantics.

---

## Files Changed

| File | Change |
|------|--------|
| `team-scrape/draft-picks/scripts/pst/pst_pick_rule_parser.ts` | Added `swap_right` kind to SelectionSpec; modified `buildSelectionSpecs()` |
| `team-scrape/draft-picks/scripts/pst/pst_phase_7_rights_views.ts` | Added swap_right rendering: "swap vs X" / "swap owed Y" |

---

## Commands Run

```bash
npm run pst:build-final       # Regenerated profiles and ledger
npm run pst:manual-rights-views  # Regenerated rights views
```

---

## DAL 2030 Before/After

**Before** (Phase 5.3):

```
2030 | 1 | owes most favorable to SAS | pool (BOS,DAL,SAS) | via SAS swap rights
```

**After** (Phase 7.1):

```
2030 | 1 | swap owed SAS | pool (BOS,DAL,SAS)
```

SAS controller view:

```
2030 | 1 | swap pool 3 | pool (BOS,DAL,SAS)
```

---

## Ranked Case Proof (Unchanged)

MEM 2026 2nd (ranked swap with explicit "most favorable" language):

```
2026 | 2 | receives most favorable | pool (IND,MEM,MIA) | controller MEM
```

ATL 2026 1st (ranked swap with explicit "least favorable" language):

```
2026 | 1 | receives least favorable | pool (ATL,SAS) | controller ATL
```

Ranked semantics preserved ✓

---

## Invariants

| Metric | Value |
|--------|-------|
| Profiles | 480 |
| Ledger | 480 |
| needs_review | 0 |

All invariants passed ✓

---

## Phase Status

**COMPLETE**
