# PHASE 8 EXECUTION RETURN PACKAGE

**Date**: 2026-01-21
**Author**: Antigravity
**Status**: APPROVED & MERGED

---

## 1. Summary

Formalized "Entitlement Assets" to solve the "pooled pick" problem in the Trade Machine. Generated a tradeable asset layer that sits on top of the physical pick slots.

- **Problem**: HOU 2029 involves 3 picks (DAL, HOU, PHX) pooled together. The underlying slots are "messy".
- **Solution**: Generated an `EntitlementAsset` for HOU representing the "Right to Conveyance (Rank 2) of Pool [DAL, HOU, PHX]", suppressing the messy underlying slots.

---

## 2. Artifacts Created

| Type | Path | Description |
|------|------|-------------|
| **Spec** | `docs/team-scrape/PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md` | Definitive schema and ID rules. |
| **Script** | `team-scrape/draft-picks/scripts/pst/pst_phase_8_build_entitlement_assets.ts` | The generator logic. |
| **Output** | `data/pst/pst_entitlement_assets_2026_2033.json` | Flat list of 506 assets. |
| **Output** | `data/pst/pst_entitlements_by_team_2026_2033.json` | Keyed by holder team. |
| **Master Doc** | `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | Updated with Phase 8. |

---

## 3. Validation: HOU 2029 Case

**Input**: `HOU` owns `DAL_2029_1st`, `HOU_2029_1st`, `PHX_2029_1st`. All marked with `selectionSpec` (Rank 2 of Pool).

**Output Asset**:

```json
{
  "id": "ent:HOU:2029:1:conv:d30eb6c5",
  "holderTeam": "HOU",
  "seasonYear": 2029,
  "round": 1,
  "kind": "conveyance_right",
  "description": "(second most favorable of Mavericks, Rockets, Suns picks)",
  "poolUnderlyingPickIds": [
    "DAL_2029_1st",
    "HOU_2029_1st",
    "PHX_2029_1st"
  ],
  "receivesRank": [ 2 ],
  "receivesComparator": "more_favorable"
}
```

*Note: Simple `pick_ownership` assets for these 3 slots were correctly SUPPRESSED.*

**Validation 2: CLE 2026 Case**

- CLE retains `pick_ownership` (encumbered).
- ATL gets `conveyance_right` (Least favorable).
- UTA gets `swap_right` (Option).

---

## 4. Next Steps (Trade Machine Integration)

1. **Load `pst_entitlements_by_team_2026_2033.json`** in `useTradeMachine.js`.
2. **Display Rules**:
   - If `kind == 'pick_ownership'`, show valid Pick Card.
   - If `kind == 'swap_right'`, show Swap Option Card.
   - If `kind == 'conveyance_right'`, show Conditional/Pooled Pick Card.
3. **Trading**:
   - Trading an Entitlement transfers the `EntitlementAsset` object.
   - Underlying slots move implicitly (back-end resolution required later).

---

## 5. Command

```bash
npm run pst:entitlements
```
