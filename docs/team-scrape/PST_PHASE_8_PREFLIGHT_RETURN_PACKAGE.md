# PHASE 8 PREFLIGHT RETURN PACKAGE

**Date**: 2026-01-21
**Author**: Antigravity

---

## 1. Findings & Inspection

### Current Pick Inputs

- **Trade Machine**: Uses `draftPicks[]` on the Team object.
- **Schema**: `DraftPickZ` (defined in `src/schemas/architect.ts`) conflates identity, ownership, and swap rights (`isSwap` bool).
- **Gap**: Complex entitlements (e.g., "Most favorable of 3 teams") cannot be cleanly represented by a single `DraftPickZ` attached to one team, especially if the underlying pick ID is ambiguous or shared.

### Existing "Hooks"

- `selectionSpecs` in `encumbrances` (from Phase 7) provide the exact data needed.
- `swap_right` vs `swap` (ranked) semantics are already parsed.

---

## 2. Proposed Spec (Summary)

See full spec: [PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md](PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md)

- **New Concept**: `EntitlementAsset`
- **Kinds**: `pick_ownership`, `conveyance_right`, `swap_right`
- **ID**: Deterministic hash-based ID `ent:{holder}:{year}:{round}:{kind}:{hash}`
- **Goal**: Decouple "What I own" from "The underlying slot".

---

## 3. Proposed Outputs

1. `data/pst/pst_entitlement_assets_2026_2033.json`
2. `data/pst/pst_entitlements_by_team_2026_2033.json`

## 4. Execution Plan (Next Steps)

1. **Script**: Create `team-scrape/draft-picks/scripts/pst/pst_phase_8_build_entitlement_assets.ts`
2. **Logic**:
   - Iterate over `pst_pick_ledger_final_2026_2033.json`.
   - For simple owned picks (no complex encumbrance): emit `pick_ownership`.
   - For `selectionSpecs` (from encumbrances): emit `conveyance_right` or `swap_right` based on spec.
   - Assign stable IDs.
3. **Integration**: Add `npm run pst:entitlements` script.

## 5. Acceptance Criteria (Execution)

- Generator runs deterministically.
- HOU 2029 assets are correctly split into `conveyance_right` and `swap_right` (or as per ledger reality).
- Output JSONs are valid.
