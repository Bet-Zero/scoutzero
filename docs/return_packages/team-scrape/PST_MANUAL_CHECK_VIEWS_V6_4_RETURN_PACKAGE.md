
# PST Manual Check Views v6.4 Return Package

## Summary

The goal was to fix manual check views incorrectly labeling some swap-only picks as "via XYZ" instead of "own". The instruction required enforcing a deterministic rule: `originTag = (originalTeam == ownerTeam) ? "own" : "via " + originalTeam`.

However, strict enforcement of this rule **DOES NOT** produce the desired "own" label for the cited example (BOS 2028 1st swap w/ SAS). This is because the underlying Ledger (Phase 5) identifies the pick held by BOS as `SAS_2028_1st`, with `originalTeam: SAS` and `owner: BOS`.

Under strict Rule A:

- `originalTeam` ("SAS") != `ownerTeam` ("BOS")
- Result: "via SAS"

The user requirement to show this as "own" requires `originalTeam` to be interpreted as "BOS", which contradicts the Ledger data. Modifying the Ledger was strictly out of scope.

## Files Modified

- `team-scrape/draft-picks/scripts/pst/pst_phase_6_manual_check_views.ts` (Updated to explicitly use Rule A, though logic was effectively same)
- `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` (Updated with v6.4 rule definition)

## How to Run

```bash
npm run pst:manual-views
```

## BEFORE / AFTER (Validation)

### Example 1: BOS 2028 1st (Swap w/ SAS) – UNCHANGED (BLOCKED)

The pick held by BOS is `SAS_2028_1st`.

**BEFORE (v6.3)**:

```
2028 | 1 | via SAS | Top 1, protected #46-60, swap SAS
```

**AFTER (v6.4 - Strict Rule A)**:

```
2028 | 1 | via SAS | Top 1, protected #46-60, swap SAS
```

**Reason**: `pick.originalTeam` is "SAS" in the ledger. Rule A produces "via SAS". To achieve "own", the ledger would need to identify this pick as originally BOS, but the ledger models the swap by transferring ownership of the SAS pick to BOS.

### Example 2: Swap-Holdings (ATL) – UNCHANGED

Picks where ATL holds others' picks via swap also show correctly as "via".

**BEFORE**:

```
2026 | 1 | via CLE | least of (ATL,SAS), swap ATL, swap UTA, conditional
2026 | 1 | via NOP | swap NOP, conditional
```

**AFTER**:

```
2026 | 1 | via CLE | least of (ATL,SAS), swap ATL, swap UTA, conditional
2026 | 1 | via NOP | swap NOP, conditional
```

## Confirmation of Scope

- Only presentation logic was touched (`pst_phase_6_manual_check_views.ts`).
- Phase 4/5 Parsing and Ledger logic were NOT modified.

## Status

**BLOCKED**

The requirement to show "own" for swapped picks contradicts the requirement to derive "via" strictly from `originalTeam` vs `ownerTeam` WITHOUT using swap info, given the current Ledger state where swapped picks retain their `originalTeam` identity.
