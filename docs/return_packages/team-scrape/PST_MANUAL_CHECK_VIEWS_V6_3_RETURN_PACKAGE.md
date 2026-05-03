# PST Manual Check Views v6.3 Return Package

**Date**: 2026-01-17  
**Phase**: 6.3 - Conditional Tag + Swap Display Rule  
**Status**: COMPLETE

---

## Summary

Implemented two presentation-only changes to the PST manual check views generator:

1. **Conditional vs Did-Not-Convey**: Previously, "did not convey" was emitted whenever `didNotConvey[]` was non-empty. This was misleading for future picks (2026-2033). Now:
   - `did not convey` is only emitted when evidence text contains explicit past-tense language
   - `conditional` is emitted otherwise (default for condition_not_met rows)

2. **Swap Tag Display**: Previously, swap tags were suppressed when favorable pool tags existed. Now:
   - `swap {TEAM}` is always emitted when controller is explicit
   - Both pool tags and swap tags can appear on the same line

---

## Files Modified

| File | Changes |
|------|---------|
| `team-scrape/draft-picks/scripts/pst/pst_phase_6_manual_check_views.ts` | Added `isExplicitNonTransfer()` helper, updated `generateTags()` for v6.3 rules, added profiles loading for evidence text lookup |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | Updated Phase Status table, Tag Generation Rules section, added Phase 6.3 documentation |

---

## How to Run

```bash
npm run pst:manual-views
```

Or to run the full pipeline:

```bash
npm run pst:build-final
```

---

## BOS Block Comparison

### BEFORE (v6.2)

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

### AFTER (v6.3)

```
════════════════════════════════════════════════════════════════════════════════
# BOS — BOSTON CELTICS (13 picks)

────────────────────────────────────────────────────────────────────────────────
2026 | 1 | own | 
2026 | 2 | via MIL | Top 4, least of (MIL,ORL), swap ORL, conditional
2026 | 2 | via MIN | Top 55, conditional
2026 | 2 | via NOP | Top 4, conditional
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

---

## Validation Examples

### Example 1: "conditional" instead of "did not convey"

**Line**: `2026 | 2 | via MIL | Top 4, least of (MIL,ORL), swap ORL, conditional`

- Previously showed: `did not convey`
- Now shows: `conditional`
- Reason: The evidence text for this pick does not contain past-tense outcome language like "did not convey" or "protection exercised". The pick is for 2026 (future), so the condition hasn't been evaluated yet.

### Example 2: Both "least of (...)" AND "swap {controller}" on same line

**Line**: `2026 | 2 | via MIL | Top 4, least of (MIL,ORL), swap ORL, conditional`

- Shows: `least of (MIL,ORL)` AND `swap ORL` together
- Previously: Only `least of (MIL,ORL)` would appear (swap was suppressed)
- Now: Both appear, matching Fanspo/Spotrac display style

### Additional Examples with Both Pool + Swap Tags

```
2026 | 1 | via CLE | least of (ATL,SAS), swap ATL, swap UTA, conditional
2026 | 1 | via MIL | most of (MIL,NOP), swap NOP, conditional
2027 | 1 | via MIL | Top 4, least of (DEN,LAL,MIL,NOP,OKC), swap NOP
2028 | 1 | via CLE | least of (ATL,SAS), swap ATL, swap UTA
2026 | 1 | own | most of (DAL,HOU,PHX), 2nd most of (DAL,HOU,PHX), swap HOU
```

---

## Notes on Conditional/Did-Not-Convey Rule

### Detection Logic

The generator now checks evidence text for explicit past-tense outcome language:

```typescript
const PAST_TENSE_PATTERNS = [
  /did not convey/i,
  /not conveyed/i,
  /will not convey/i,
  /would not transfer/i,
  /protection exercised/i,
];
```

- If any evidence text matches these patterns → emit `did not convey`
- Otherwise → emit `conditional`

### Results

- **26 lines** now show `conditional` (all future picks with condition_not_met rows)
- **0 lines** show `did not convey` (expected for 2026-2033 range since no past outcomes exist yet)

### Rationale

For future picks in the 2026-2033 window, the conditions haven't been evaluated yet. Showing "did not convey" was misleading because it implied the pick had already failed to convey. The new "conditional" tag accurately reflects that the pick has conditional language attached but no outcome has been determined.

---

## Phase Status

**COMPLETE**

All acceptance criteria met:

- ✓ "conditional" emitted instead of "did not convey" for future picks without past-tense evidence
- ✓ Swap tags displayed alongside favorable pool tags when controller is explicit
- ✓ Manual check views regenerated with v6.3 format
- ✓ Master doc updated with Phase 6.3 documentation
