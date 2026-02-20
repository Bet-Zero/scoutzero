# TM-ENTITLEMENT-IDENTITY-LOCK — Execution Return Package

**Status:** COMPLETE  
**Date:** 2026-02-20  
**Mode:** EXECUTION (implement + validate)

---

## Summary

Implemented the "Identity Lock" UX model for entitlement editing. Users can no longer change identity-defining fields when editing an existing entitlement. The "Duplicate as new" button was renamed to "Create new from this…" and remains the sanctioned path for changing entitlement identity. Raw entitlement IDs (`ent:…`) are no longer displayed in the Basics tab.

---

## Requirements Implemented

### R1 — Identity fields locked in edit mode

| View                          | Before                                    | After                                                                                                  |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Simple (QuickBuilder)**     | Already locked (showed read-only summary) | Added helper text: "To change the pick/right, use 'Create new from this…'"                             |
| **Advanced → Basics tab**     | All fields editable                       | holderTeam, seasonYear, round, kind, underlyingPickId **disabled** with visual indicator + lock notice |
| **Advanced → Swap tab**       | All fields editable                       | swapControllerPickId, swapTargetDefinition **disabled** with lock notice                               |
| **Advanced → Conveyance tab** | All fields editable                       | Pool picks, receivesRank, receivesComparator **disabled** (add/remove buttons too) with lock notice    |
| **Advanced → JSON tab**       | Already stripped identity changes         | No change (already correct)                                                                            |
| **Advanced → Protection tab** | Editable (detail field)                   | Remains editable — protections are detail fields, not identity                                         |

In create mode (no `entitlementId`), all fields remain fully editable as before.

### R2 — "Create new from this…" action

- Renamed button from "Duplicate as new" → **"Create new from this…"**
- Behavior unchanged: clones `formState` into a document with `id` stripped, passes to `onDuplicateAsNew` callback
- The parent (`TradeEditor.jsx`) reopens the editor in create mode with the prefilled document
- Original entitlement is NOT touched

### R3 — IDs invisible

- Removed the "Entitlement ID (read-only)" input field from `EntitlementEditorBasicsTab`
- No UI shows `ent:…` or `vacuum:…` IDs

### R4 — Backend move semantics preserved

- No changes to `saveEntitlementFromFormState.ts` or the identity-change/move logic
- The move-on-identity-change path is now practically unreachable via normal UI but remains as a defensive safety net

---

## Files Changed

| File                                                                 | Change                                                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/admin/EntitlementEditorBasicsTab.tsx`        | Added `isEditMode` prop; disabled identity fields when true; removed raw ID field; added lock notice             |
| `src/features/architect/admin/EntitlementEditorSwapTab.tsx`          | Added `isEditMode` prop; disabled `swapControllerPickId` and `swapTargetDefinition` when true; added lock notice |
| `src/features/architect/admin/EntitlementEditorConveyanceTab.tsx`    | Added `isEditMode` prop; disabled pool inputs, rank, comparator when true; added lock notice                     |
| `src/features/architect/admin/EntitlementEditorFormTabs.tsx`         | Route `isEditMode` prop to Basics, Swap, and Conveyance tabs (was only passed to Advanced tab)                   |
| `src/features/architect/admin/PickRightWizardModal.tsx`              | Renamed "Duplicate as new" button text to "Create new from this…"                                                |
| `src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx` | Added helper text below locked identity summary                                                                  |
| `src/tests/architect/entitlementIdentityLock.test.tsx`               | **NEW** — 15 tests covering R1–R3                                                                                |
| `src/tests/architect/vacuumE3.duplicateAsNew.test.tsx`               | Updated button text assertion; fixed incomplete `WIZARD_LABELS` mock                                             |

---

## Before/After Behavior

### Editing an existing entitlement (Simple view)

- **Before:** Locked identity summary with 🔒 icon, no guidance text
- **After:** Same locked summary + helper: "To change the pick/right, use 'Create new from this…'"

### Editing an existing entitlement (Advanced → Basics tab)

- **Before:** holderTeam, seasonYear, round, kind, underlyingPickId all editable; raw ID shown
- **After:** All identity fields disabled with dimmed styling; raw ID removed; amber lock notice shown

### Editing an existing entitlement (Advanced → Swap tab)

- **Before:** swapControllerPickId and swapTargetDefinition editable

- **After:** Both disabled with lock notice

### Editing an existing entitlement (Advanced → Conveyance tab)

- **Before:** Pool picks, rank, comparator editable; add/remove buttons active
- **After:** All identity fields disabled; add/remove buttons disabled; lock notice shown

### Creating a new entitlement

- **Before & After:** All fields remain fully editable — no change

### "Create new from this…" flow

- **Before:** Button labeled "Duplicate as new"
- **After:** Button labeled "Create new from this…"; behavior identical (strips ID, reopens in create mode)

---

## Test Results

```
npm run test -- --run src/tests/architect/entitlementIdentityLock.test.tsx

 ✓ src/tests/architect/entitlementIdentityLock.test.tsx  (15 tests) 530ms
 Test Files  1 passed (1)
      Tests  15 passed (15)

npm run test -- --run src/tests/architect/vacuumE3.duplicateAsNew.test.tsx


 ✓ src/tests/architect/vacuumE3.duplicateAsNew.test.tsx  (5 tests) 317ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### Build

```
npm run build — ✓ built in 39.46s (no errors)
```

---

## Identity Fields Reference (Conservative Lock Set)

Per the Stop Conditions, these fields are locked:

| Field                   | Used by            |
| ----------------------- | ------------------ |
| `holderTeam`            | All kinds          |
| `seasonYear`            | All kinds          |
| `round`                 | All kinds          |
| `kind`                  | All kinds          |
| `underlyingPickId`      | `pick_ownership`   |
| `swapControllerPickId`  | `swap_right`       |
| `swapTargetDefinition`  | `swap_right`       |
| `poolUnderlyingPickIds` | `conveyance_right` |
| `receivesComparator`    | `conveyance_right` |
| `receivesRank`          | `conveyance_right` |

All other fields (description, protectionLadder, swapType, status, linkage fields) remain editable.
