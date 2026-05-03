# PST Phase 8.1 Hotfix Return Package: Entitlement Split & Physical Slot Retention

**Date**: 2026-01-21
**Phase**: 8.1 (Hotfix)
**Status**: COMPLETE

## 1. Summary

This hotfix addresses two critical issues in the entitlement asset generation:

1. **Physical Slot Suppression**: Previously, physical pick slots (e.g., `pick_ownership` records) were suppressed if they were covered by a pooled conveyance entitlement. This was incorrect for data storage. Now, all 480 physical slots are ALWAYS emitted, with metadata indicating their status (`pooled`, `encumbered`, or `clean`).
2. **HOU 2029 Mechanism**: The generator previously collapsed the HOU/DAL/PHX 2029 interaction into a single "Rank 2 of 3" conveyance. This has been deterministically split into two separable tradeable assets:
    - **Conveyance Right**: Right to receive the *more favorable* of (DAL, PHX).
    - **Swap Right**: Right to swap HOU pick for the *less favorable* of (DAL, PHX).

## 2. Files Changed

### Code

- `team-scrape/draft-picks/scripts/pst/pst_phase_8_build_entitlement_assets.ts`:
  - Implementation of "Always Emit" logic for physical slots.
  - Implementation of "Separable Split" logic for HOU-style 3-way pools.

### Documentation

- `docs/team-scrape/PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md`: Updated schema and added Section 5.1.
- `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`: Logged Phase 8.1 completion.

### Data

- `data/pst/pst_entitlement_assets_2026_2033.json`: Regenerated (count increased from 480 -> 525 due to retained slots + split rights).
- `data/pst/pst_entitlements_by_team_2026_2033.json`: Regenerated.

## 3. How to Run

```bash
npm run pst:entitlements
```

## 4. Proof: Physical Pick Ownership Count

Command:

```bash
node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync('data/pst/pst_entitlement_assets_2026_2033.json')); console.log(data.assets.filter(a => a.kind === 'pick_ownership').length);"
```

**Result**: `480`

## 5. Proof: HOU 2029 Assets (Split)

The following JSON snippet demonstrates the successful splitting of the HOU 2029 rights into distinct Conveyance and Swap assets, alongside the retained physical slots.

```json
[
  {
    "id": "ent:HOU:2029:1:conv:8c5fc3c8",
    "holderTeam": "HOU",
    "seasonYear": 2029,
    "round": 1,
    "kind": "conveyance_right",
    "description": "Most favorable of DAL, PHX"
  },
  {
    "id": "ent:HOU:2029:1:swap:a6cf2ab5",
    "holderTeam": "HOU",
    "seasonYear": 2029,
    "round": 1,
    "kind": "swap_right",
    "description": "Swap Right: HOU vs (Less favorable of DAL, PHX)"
  },
  {
    "id": "ent:HOU:2029:1:own:3ed63fa4",
    "holderTeam": "HOU",
    "seasonYear": 2029,
    "round": 1,
    "kind": "pick_ownership",
    "underlyingPickId": "DAL_2029_1st",
    "underlyingStatus": "pooled",
    "coveredByEntitlementIds": [
      "ent:HOU:2029:1:conv:8c5fc3c8"
    ]
  },
  {
    "id": "ent:HOU:2029:1:own:c5d6829c",
    "holderTeam": "HOU",
    "seasonYear": 2029,
    "round": 1,
    "kind": "pick_ownership",
    "underlyingPickId": "HOU_2029_1st",
    "underlyingStatus": "encumbered"
  },
  {
    "id": "ent:HOU:2029:1:own:fcba7cfa",
    "holderTeam": "HOU",
    "seasonYear": 2029,
    "round": 1,
    "kind": "pick_ownership",
    "underlyingPickId": "PHX_2029_1st",
    "underlyingStatus": "pooled"
  }
]
```

## 6. Phase Status

**COMPLETE**
