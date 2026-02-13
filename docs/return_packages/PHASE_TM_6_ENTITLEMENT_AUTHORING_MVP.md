# PHASE TM-6 — Entitlement Editing + Terms Integration MVP

**Date:** 2026-02-05
**Status:** COMPLETE

---

## Summary

TM-6 completes the entitlement editing + terms integration MVP by adding:

1. **SwapType visibility** — Trade rows now show "Swap best (2028)" or "Swap worst (2028)" instead of generic "Swap (2028)"
2. **Pooled indicator** — Purple Layers icon appears on pooled entitlements in Trade Machine
3. **Improved Stepien warnings** — Specific messages include tier count and pool size instead of vague "conservatively" text

**Key finding:** Most TM-6 infrastructure already existed from TM-4/TM-5. The edit entry point was already wired (pencil icon → modal). This phase focused on display refinements and warning clarity.

---

## What Works Now

### Edit Flow (Verified)

- Click pencil icon on any entitlement row in Trade Machine
- Modal opens with tabbed form (Basics, Protection, Swap, Conveyance, Advanced JSON)
- Edit protection ladder tiers, swap definitions, or conveyance conditions
- Save writes to world override at `architect_worlds/{worldId}/entitlements/{id}`
- Row updates immediately (no page reload required)
- Changes persist across browser refresh

### SwapType Visibility

- `formatEntitlementTermsShort()` now includes swap direction:
  - `"Swap best (2028)"` (default, or explicit `swapType: 'best_of'`)
  - `"Swap worst (2028)"` (when `swapType: 'worst_of'`)
- SwapType is auto-parsed from `swapTargetDefinition` or `description` if explicit field missing
- Appears in: entitlement rows, trade summary, receipt, export

### Pooled Indicator

- Purple Layers icon (`<Layers size={12} />`) appears next to pooled entitlements
- Shows when `underlyingStatus === 'pooled'`
- Tooltip: "Pooled entitlement (multi-team)"

### Stepien Warning Clarity

- Protection ladder warnings now include tier count and starting year:
  - `"Protection ladder (2 tiers starting 2026): Stepien reserves year until all tiers resolve."`
  - `"Protected pick (2027): Stepien reserves year until protection outcome known."`
- Conveyance warnings now include pool size:
  - `"Conveyance from 3-pick pool: Stepien reserves all possible years until pool resolves."`
  - `"Conveyance right: Stepien reserves year until conveyance outcome known."`

---

## UI Path to Edit Entitlements

1. Open Trade Machine (`/architect/trade-machine`)
2. Select a team's entitlements section
3. Find any entitlement row
4. Click the **pencil icon** on the right side of the row
5. Modal opens with tabbed editor
6. Navigate to desired tab (Protection Ladder, Swap, Conveyance)
7. Make changes
8. Click **Save Entitlement**
9. Row updates immediately with new `termsShort`

---

## Files Changed

| File                                                                 | Change                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/features/architect/utils/entitlements/entitlementTerms.ts`      | Added swapType label ("best"/"worst") to `formatEntitlementTermsShort()` |
| `src/features/architect/tradeMachine/EntitlementPickRow.jsx`         | Added Layers import, `isPooled` check, pooled indicator JSX              |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | Improved warning messages with tier count and pool size                  |

---

## Tests Added

| Test File                                                | Coverage                                          |
| -------------------------------------------------------- | ------------------------------------------------- |
| `src/tests/entitlements/entitlementTermsShort.test.ts`   | 7 test cases for swapType visibility              |
| `src/tests/architect/entitlementPickRowDisplay.test.jsx` | Pooled/encumbered indicator tests (extended)      |
| `src/tests/tradeMachine/stepienObligations.test.js`      | 5 test cases for TM-6 warning messages (extended) |
| `src/tests/architect/entitlementEditorModal.test.tsx`    | Edit flow integration tests (extended)            |

---

## Known Limitations (MVP-Conservative)

These remain out of scope for TM-6:

1. **Full ladder outcome resolution** — Trade Machine does not simulate tier-by-tier protection outcomes. Stepien reserves year conservatively until all tiers resolve.

2. **Full conveyance pool resolution** — Trade Machine does not simulate ranked selection from conveyance pools. Stepien reserves all possible years.

3. **Full multi-team swap graph resolution** — Best-of/worst-of determination between multiple swap participants is not simulated.

These limitations are explicit and documented. Warnings clearly state "reserves year until ... resolves" rather than hiding ambiguity.

---

## Manual Verification Checklist

- [x] Click entitlement row edit icon → modal opens with correct data
- [x] Edit protection ladder tier → save → row secondary text shows updated termsShort
- [x] Swap entitlements show "Swap best (2028)" or "Swap worst (2028)" in row
- [x] Pooled entitlements show purple Layers icon
- [x] Trade summary shows same termsShort as row
- [x] Reload page → edited entitlement persists (world override)
- [x] Stepien warning for protection ladder shows tier count and year
- [x] Stepien warning for conveyance shows pool size
- [x] No "evaluated conservatively" without context

---

## Feature Flag

`VITE_FEATURE_ENTITLEMENT_AUTHORING=true` (enabled in `.env.local`)

The entire entitlement editing surface is gated behind this flag. If disabled, pencil icons do not appear and modal cannot be opened.
