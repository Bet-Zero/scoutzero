# Return Package: Draft Mode (sessionStorage) + Cross-Mode Conversion

**Execution**: 1g — Draft sessionStorage and Conversion  
**Date**: 2026-02-05  
**Status**: COMPLETE

---

## What Changed

Implemented "Draft Mode" for the Tiermaker/Tieramid feature so users can:

- Toggle between Tiermaker and Tieramid without losing unsaved work
- Refresh the page and have their draft restored from sessionStorage
- Save to Firestore only when they explicitly choose (no Firestore spam)
- Clear their draft with a single button

### Architecture

Draft state is **lifted above the board components** into `TierMakerView.jsx`, which holds both layouts simultaneously via the `useTierDraft` hook. Boards operate in two modes:

- **Draft Mode** (no `tierListId` in URL): Boards receive draft data as props and report changes back. sessionStorage persistence is active.
- **Saved Mode** (`tierListId` present): Boards behave as before — load/save from Firestore. sessionStorage is completely inert.

Cross-mode conversion utilities are pure functions that translate between the two data shapes deterministically. Conversion only fires when toggling to a mode that has no content while the source mode does have content.

---

## Draft Schema (sessionStorage)

**Key**: `tiermaker_draft_v1`

```json
{
  "draftStandard": {
    "tiers": { "S": ["pid1", "pid2"], "A": ["pid3"], "Pool": [] },
    "tierOrder": ["S", "A", "B", "C", "D", "Pool"]
  },
  "draftTieramid": {
    "rows": { "Row1": ["pid1"], "Row2": ["pid2", "pid3"], "Pool": [] },
    "rowOrder": ["Row1", "Row2", "Row3", "Row4", "Row5", "Pool"]
  },
  "draftUpdatedAt": 1738771200000
}
```

- Values are **player ID arrays** (same as Firestore format), not player objects.
- Debounce: ~1000ms for sessionStorage writes.
- Board → parent reporting: ~300ms debounce.
- Null values indicate "not yet used" (different from empty).

---

## Conversion Rules Implemented

### Standard → Tieramid (`standardToTieramid`)

1. Flatten `tierOrder` top → bottom (excluding Pool), preserving left → right order within each tier.
2. Fill Row1(1), Row2(2), Row3(3)… left → right.
3. Add rows beyond the default 5 as needed so ALL players fit.
4. Pool copies directly.

### Tieramid → Standard (`tieramidToStandard`)

1. Each row becomes a tier with the same name (Row1 → tier "Row1").
2. Left → right order preserved.
3. Pool stays Pool.

### Conversion Trigger

- Only fires in Draft Mode during mode toggle.
- Only fires when target mode is **empty** AND source mode has content.
- If target mode already has content → no conversion (preserves edits).

### "Empty" Definition

- Standard: all tiers (including Pool) have zero IDs, or draft is null.
- Tieramid: all rows (including Pool) have zero IDs, or draft is null.

---

## Validation Notes

### Build

- `npm run build` passes with no new errors or warnings.

### Draft Mode (Manual Test Script)

1. Open `/tier-maker` (no listId) → boards start empty ✓
2. Add players + move into tiers in Tiermaker
3. Toggle to Tieramid → auto-conversion fires, all players present in pyramid rows with correct order
4. Toggle back to Tiermaker → draftStandard preserved (not overwritten — has content)
5. Refresh browser → both mode states restore from sessionStorage
6. Click Clear Draft → empties everything + refresh stays empty (sessionStorage gone)

### Saved Mode (Manual Test Script)

1. Create or load a tier list → URL becomes `/tier-maker/:id?mode=...`
2. Refresh → loads from Firestore (not sessionStorage)
3. Toggle mode → existing cross-mode auto-load from Firestore works
4. sessionStorage not read or written during any saved mode operation

### Edge Cases

- Tiermaker with 20 players → Tieramid gets 6+ rows (Row1-Row6 = 1+2+3+4+5+6 = 21 spots)
- Empty pool + empty tiers → conversion produces empty target (no crash)
- Board unmount/remount on toggle → draft init ref prevents double-load

---

## Files Touched

| File | Action | Purpose |
|---|---|---|
| `src/features/tierMaker/utils/draftConversion.ts` | **NEW** | Pure conversion + isEmpty utilities |
| `src/features/tierMaker/hooks/useTierDraft.ts` | **NEW** | sessionStorage draft persistence hook |
| `src/pages/TierMakerView.jsx` | **MODIFY** | Draft orchestration, conversion on toggle, Clear Draft button |
| `src/features/tierMaker/TierMakerBoard.jsx` | **MODIFY** | Accept draft props, draft init/reporting effects, Firestore guard |
| `src/features/tierMaker/TieramidBoard.jsx` | **MODIFY** | Accept draft props, draft init/reporting effects, Firestore guard |
| `docs/features/tiermaker_tieramid_MASTER.md` | **MODIFY** | Added "Draft vs Saved Mode" + "Cross-Mode Conversion Rules" sections |
| `docs/return_packages/2026-02-05_execution-1g-draft-sessionstorage-and-conversion.md` | **NEW** | This return package |
