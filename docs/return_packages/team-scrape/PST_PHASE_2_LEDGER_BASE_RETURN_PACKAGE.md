# PST PHASE 2: BASE LEDGER & OWNER OVERLAY — RETURN PACKAGE

**Status**: Phase 2 COMPLETE
**Date**: 2026-01-17

---

## 1. Summary

We have successfully established the foundational 480-pick ledger for the years 2026–2033. This creates a "perfect universe" where every pick exists and has exactly one owner. We then overlaid the "visual ownership" extracted from PST's HTML tables, resolving conflicts deterministically.

This layer provides **structural consistency** but NOT yet "legal accuracy" regarding complex protections, swaps, or conditions. It simply reflects "Who does PST say owns this pick right now?"

---

## 2. Files Created

### Scripts (`team-scrape/draft-picks/scripts/pst/`)

- `pst_build_base_ledger.ts`: Generates 480 base assets (Original owner = Original team).
- `pst_build_owner_overlay.ts`: Extracts ownership claims from raw rows (`displayOwner != originalTeam`).
- `pst_apply_display_owner_overlay.ts`: Merges base + overlay using precedence rules.
- `pst_build_holdings_by_team.ts`: Generates a team-centric viewing file.
- `pst_validate_phase_2_ledger.ts`: Strict validation of counts and integrity.

### Data Outputs (`data/pst/`)

- `pst_base_ledger_2026_2033.json`: 30 teams *8 years* 2 rounds = 480 items.
- `pst_owner_overlay.json`: List of ownership changes (e.g., LAL pick owned by NOP).
- `pst_ledger_with_display_owner.json`: The **current working truth** ledger.
- `pst_holdings_by_team.json`: Simplified list of what each team holds.

---

## 3. How to Run

A new convenience command runs the entire pipeline:

```bash
npm run pst:phase-2
# Runs: build:base -> build:overlay -> apply:overlay -> build:holdings
```

To validate:

```bash
npm run pst:phase-2:validate
```

---

## 4. Validation Results

**Global Checks**:

- ✅ Base Ledger Count: **480**
- ✅ Final Ledger Count: **480**
- ✅ Uniqueness: No duplicate pick IDs.
- ✅ Owners: All owners are valid, canonical Team Codes (e.g., "NOP", "UTA").

**Spot Check (DEN)**:

- DEN owns exactly 16 picks in Base Ledger (sanity check passed).

**Spot Check (TOR)**:

- TOR currently holds **15** picks in the 2026-2033 window (reflects mix of own picks + trades).
- Sample holdings: `TOR_2026_1st`, `LAL_2026_2nd`, `TOR_2027_1st`.

---

## 5. Overlay Precedence Rule

When multiple raw rows claim information about the same pick (e.g., appearing on both the "sending" team page and "receiving" team page), we resolve ownership in this order:

1. **Row Kind**: `transaction` > `condition_not_met` > `own`.
    - Transactions implies an active movement.
2. **Claimant Priority**: Prefer the row where `sourceTeamPage` matches the `displayOwner`.
    - If Team B's page says "Team B owns this", we trust it more than Team A saying "Team B owns this".
3. **Stability**: Alphanumeric sort of pickId/rowRef.

---

## 6. Known Limitations

- **No Legal Logic**: Swaps, protections, and conditional logic are NOT parsed yet. The `owner` reflects the current simple column value from PST.
- **Ambiguity**: If PST is ambiguous or wrong, this ledger reflects that error faithfully. Correction happens in Phase 4 (Parser) or via Overrides.

---

## 7. Next Steps

Proceed to **PHASE 3: Normalization** (cleaning text) or **PHASE 4: Deterministic Parser** (interpreting the text for protections/swaps).
