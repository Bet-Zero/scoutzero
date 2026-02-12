# TM-VACUUM-E3 — Execution Return Package

> **Ticket:** TM-VACUUM-E3  
> **Executed:** 2026-02-12  
> **Status:** COMPLETE  
> **Build:** PASSING  
> **Tests:** 32 new tests (all passing), 57 existing vacuum tests (no regressions)

---

## Summary

TM-VACUUM-E3 eliminates remaining micro-friction and safety gaps in vacuum mode:

1. **Advanced Editor lock parity** — identity fields cannot be changed via the Advanced JSON editor in edit mode
2. **Duplicate as new** — safe way to change entitlement identity without mutating the original
3. **Sanitization** — `__vacuumEdited` / `__vacuumSessionOnly` metadata stripped from trade payloads, receipts, export captures, and Firestore writes
4. **Auto-validation after revert/delete** — per-item revert/delete now triggers `handleValidate()` automatically

---

## A) Advanced Editor Lock Parity

### Problem
The Advanced Editor (JSON textarea) allowed bypassing the wizard's edit-mode identity locks. A user could change `holderTeam`, `kind`, `seasonYear`, `round`, `underlyingPickId`, or `swapControllerPickId` through raw JSON even when editing an existing entitlement.

### Solution
- `EntitlementEditorAdvancedTab.tsx` now accepts an `isEditMode` prop
- When `isEditMode=true`, the Apply JSON handler intercepts identity field changes, restores original values, and shows an error message
- An inline amber warning displays: "Identity fields are locked in edit mode. To change identity, use Duplicate as new."
- The prop is threaded through `EntitlementEditorFormTabs.tsx` and `EntitlementEditorModal.tsx`

### Files Modified
| File | Change |
|------|--------|
| `src/features/architect/admin/EntitlementEditorAdvancedTab.tsx` | Added `isEditMode` prop, identity field intercept in `handleApply`, inline lock warning |
| `src/features/architect/admin/EntitlementEditorFormTabs.tsx` | Thread `isEditMode` prop to Advanced tab |
| `src/features/architect/admin/EntitlementEditorModal.tsx` | Pass `isEditMode={!!entitlementId}` to FormTabs |

---

## B) Duplicate as New

### Problem
No safe way to change an entitlement's identity (team, year, round, kind). The only option was to manually create a new one from scratch.

### Solution
- Added `onDuplicateAsNew` callback prop to `PickRightWizardModal`
- In edit mode, a "Duplicate as new" button appears in the wizard footer
- Clicking it calls `buildEntitlementDocument(formState)`, strips the `id` field, and passes the document to the parent
- `TradeEditor.jsx` handles `onDuplicateAsNew` by closing the current editor and reopening in create mode with prefilled values
- Works in both vacuum mode and world mode (new vacuum ID or new world entitlement ID generated on save)

### Files Modified
| File | Change |
|------|--------|
| `src/features/architect/admin/PickRightWizardModal.tsx` | Added `onDuplicateAsNew` prop, handler, and button with `data-testid="wizard-duplicate-as-new"` |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | Wired `onDuplicateAsNew` to reopen wizard in create mode |

---

## C) Sanitization

### Problem
Internal vacuum resolver metadata (`__vacuumEdited`, `__vacuumSessionOnly`) could leak into trade payloads, receipts, export captures, and Firestore writes. These are UI-only flags that should never appear outside the resolver merge seam.

### Solution

Three sanitization points:

1. **`decorateEntitlementForTrade()`** — The primary decorator used by trade payload construction and receipt generation. Now destructures out `__vacuumEdited` and `__vacuumSessionOnly` before spreading the document.

2. **`TradeExportCapture.jsx`** — Export capture entitlement objects are now wrapped with `sanitizeEntitlement()` during the incoming assets preprocessing loop.

3. **`writeWorldEntitlement()`** — Firestore writes now include `deleteField()` sentinels for both vacuum metadata keys, ensuring they are stripped even if present in the document passed to the writer.

### Files Created
| File | Purpose |
|------|---------|
| `src/features/architect/utils/entitlements/sanitizeVacuumMetadata.ts` | `sanitizeEntitlement()`, `sanitizeEntitlements()`, `hasVacuumMetadata()` utility functions |

### Files Modified
| File | Change |
|------|--------|
| `src/features/architect/utils/entitlements/entitlementTerms.ts` | Destructure out vacuum keys in `decorateEntitlementForTrade()` |
| `src/features/architect/tradeMachine/TradeExportCapture.jsx` | Import `sanitizeEntitlement`, wrap entitlement spread |
| `src/features/architect/utils/entitlements/entitlementWriter.ts` | Import `deleteField`, add vacuum key deletion sentinels to Firestore write |

---

## D) Auto-validation After Revert/Delete

### Problem
After reverting an edit or deleting a session pick right, `refreshEntitlements()` was called but the trade validator was not re-run. The user had to manually click "Validate Trade" to see updated results.

### Solution
- `TradeEditor.jsx` now calls `handleValidate()` immediately after `refreshEntitlements()` in both `handleRevertEntitlementEdit` and `handleDeleteSessionEntitlement`
- This ensures the validation pipeline sees the updated entitlement state immediately

### Files Modified
| File | Change |
|------|--------|
| `src/features/architect/tradeMachine/TradeEditor.jsx` | Added `handleValidate()` calls after `refreshEntitlements()` in revert/delete handlers |

---

## E) Tests

### New Test Files (32 tests total)

| File | Tests | Coverage |
|------|-------|----------|
| `src/tests/architect/vacuumE3.advancedEditorLock.test.tsx` | 5 | Edit mode warning display, identity field blocking, non-identity field pass-through, create mode freedom |
| `src/tests/architect/vacuumE3.duplicateAsNew.test.tsx` | 5 | Button visibility (edit mode, create mode, no handler), click behavior (strips id, retains fields), vacuum mode |
| `src/tests/architect/vacuumE3.sanitization.test.ts` | 11 | `sanitizeEntitlement` (null, no keys, each key, both keys), `sanitizeEntitlements` (array, empty), `hasVacuumMetadata` (null, each key, none) |
| `src/tests/architect/vacuumE3.decorateEntitlement.test.ts` | 5 | `decorateEntitlementForTrade` strips each vacuum key, both keys, preserves fields, null/undefined pass-through |
| `src/tests/architect/vacuumE3.autoValidation.test.ts` | 6 | `removeEdit`/`removeCreate` overlay cleanup, validation pipeline integration pattern (revert→refresh→validate, delete→refresh→validate) |

### Existing Test Regression Check
- 57 existing vacuum tests: all passing
- Build: passing

---

## Acceptance Checklist

| Criterion | Status |
|-----------|--------|
| No UI path allows changing entitlement identity in edit mode | ✅ Advanced Editor + Wizard both lock identity fields |
| Duplicate creates a new entitlement without mutating original | ✅ Strips ID, opens create-mode wizard with prefilled values |
| No `__vacuum*` fields appear in receipts/exports/payloads | ✅ Sanitized at decorator, export capture, and Firestore writer |
| Revert/delete immediately updates validator results (test-covered) | ✅ `handleValidate()` called after `refreshEntitlements()` |
| World mode behavior unchanged aside from intended locks/duplicate button | ✅ All changes are additive; vacuum-only paths gated on `!worldId` |
