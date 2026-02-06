# TM-7 Quick Reference

**Status**: ✅ Complete | **Tests**: 27/27 Passing | **Build**: ✅ Passing (66s)

---

## What Was Built

**Live Preview Panel** — Real-time preview of entitlement terms as you edit  
**Protection Templates** — 6 pre-built ladders (Lottery→Top 10, Top 3→Unprotected, etc.)  
**Swap Type Selector** — Choose "Best of" or "Worst of" explicitly  
**Conveyance Pool Picker** — Structured UI for pick pools (no more textarea parsing)  
**Form Validation** — Inline errors, blocked save, tab badges showing error counts  
**Create Button** — "+ New Pick Right" in Trade Machine entitlement lists

---

## Files to Know

### Core Components

- `src/features/architect/admin/PickTermsPreview.tsx` — Preview panel
- `src/features/architect/admin/ProtectionLadderTemplates.ts` — 6 templates
- `src/features/architect/admin/EntitlementEditorCreateButton.tsx` — Create button

### Modified

- `EntitlementEditorModal.tsx` — Split layout (form left, preview right)
- `useEntitlementEditorState.ts` — Validation logic, `fieldErrors`, `isValid`
- `entitlementEditorFormState.ts` — Added `swapType` field
- All tab components — Now accept and display `fieldErrors`
- `TradeEditor.jsx` / `EntitlementPicksList.jsx` — Create button integration

### Tests (27 passing)

- `entitlementEditorSwapType.test.tsx` — swapType round-trip (6 tests)
- `entitlementEditorProtection.test.tsx` — Templates + validation (8 tests)
- `entitlementEditorCreate.test.tsx` — Create flow (7 tests)
- `pickTermsPreview.test.tsx` — Preview pipeline (6 tests)

---

## How to Use

### Enable Feature

```bash
# .env
VITE_FEATURE_ENTITLEMENT_AUTHORING=true
```

### Create New Entitlement

1. Open Trade Machine → Select world
2. Find team → Entitlements section
3. Click "+ New Pick Right" (green button)
4. Fill required fields → Save

### Apply Protection Template

1. Open entitlement editor → Protection Ladder tab
2. Select template from dropdown (e.g., "Lottery → Top 10 → Unprotected")
3. Verify years adjusted to seasonYear
4. Edit/reorder tiers as needed → Save

### Check Live Preview

1. Edit any field in form
2. Watch right panel update:
   - **Terms Summary**: Human-readable (e.g., "Top 3 → Unprotected")
   - **Row Preview**: How it appears in trade UI
   - **JSON Preview**: Raw terms structure
   - **Status Badges**: ✓ Protection, ✓ Swap, ✓ Conveyance

### Fix Validation Errors

1. Look for red borders + error text
2. Check tab badges (red circles with numbers)
3. Save button disabled until all errors fixed
4. Hover save button for tooltip

---

## Validation Rules

**Always Required**: `holderTeam` (3 letters), `seasonYear` (2020-2040), `round` (1 or 2), `kind`

**Kind-Specific**:

- `pick_ownership` → requires `underlyingPickId`
- `swap_right` → requires `swapControllerPickId`, `swapTargetDefinition`, `swapType`
- `conveyance_right` → requires pool (≥2 picks), `receivesComparator`, `receivesRank` (≥1)

**Protection Ladder**:

- Years must be ascending
- `roll` tiers require `rollToYear`
- `convert` tiers require `convertToRound`
- `cancel` tiers don't need condition

---

## Testing

### Run New Tests

```bash
npm run test -- --run src/tests/architect/entitlementEditor*.test.tsx \
  src/tests/architect/pickTermsPreview.test.tsx
```

### Verify Build

```bash
npm run build  # Should complete in ~66s
```

### Manual Scenarios

1. **Live Preview** — Edit field → Preview updates immediately
2. **Templates** — Apply "Lottery → Top 10 → Unprotected" → 3 tiers appear
3. **Reorder** — Click "Move Up" / "Move Down" on tier
4. **Duplicate** — Click ⧉ button → Copy with year +1
5. **Swap Type** — Select "Best of" → Preview shows "Swap best"
6. **Pool Picker** — Add 2+ picks → No errors
7. **Create** — Click "+ New Pick Right" → Modal opens with defaults
8. **Validation** — Leave required field empty → Red border + save blocked

---

## Known Limitations

- **No Trade Validation**: Ladder/swap/conveyance not yet simulated (amber warning shown)
- **No Drag-Drop**: Use Move Up/Down buttons instead
- **Templates Replace**: No merge/append mode (replaces entire ladder)
- **Emulator Only**: No production writes (feature-gated)

---

## Quick Troubleshooting

**Modal won't open**: Check `VITE_FEATURE_ENTITLEMENT_AUTHORING=true` in `.env`  
**Save disabled**: Look for red borders or tab badges with error counts  
**Preview not updating**: Check browser console for errors (shouldn't happen)  
**Template wrong years**: Verify `seasonYear` field is correct before applying  
**Create button missing**: Check `canEditEntitlements` prop flow from TradeEditor

---

## Next Steps (Not Included)

- Drag-and-drop tier reordering
- More templates (Top 1, Top 8, etc.)
- Trade validation simulation
- Historical audit log
- Bulk operations

---

**Full Report**: `docs/architect/TM7_PICK_EDITOR_UX_COMPLETION_REPORT.md`  
**Implementation Date**: February 5, 2026
