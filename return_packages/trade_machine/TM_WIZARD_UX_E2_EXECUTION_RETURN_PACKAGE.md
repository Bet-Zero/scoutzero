# TM-WIZARD-UX-E2 — Execution Return Package

**Ticket:** TM-WIZARD-UX-E2  
**Date:** 2026-02-14  
**Scope:** Edit mode identity summary — remove PickSelector in edit mode

---

## Summary

Removed the confusing PickSelector (Team / Year / Round dropdowns) from the Pick Right Wizard when editing an existing entitlement. In edit mode, the user clicked a specific entitlement row to open the modal, so the pick identity is already known. The PickSelector has been replaced with a locked, read-only identity summary.

Create mode ("New Pick Right") is unchanged — the PickSelector remains visible for choosing the pick.

---

## Before / After

### Before (edit mode)

- Full PickSelector rendered with Team, Year, Round dropdowns
- Dropdowns were disabled (`lockIdentityFields=true`) but still visually present
- "Owner (changes when traded)" helper text displayed below the selector
- User could see dropdown UI chrome suggesting selection was possible

### After (edit mode)

- **No PickSelector rendered at all** — no Team/Year/Round dropdowns in the DOM
- Locked identity summary panel shows:
  - **Primary line**: "BOS 2027 1st Round" (team, year, round label)
  - **Owner line**: "Owner: BOS (changes when traded)"
  - **Pick ID line**: "Pick ID: BOS_2027_1" (canonical ID)
  - **Lock icon**: 🔒 visual indicator
  - **Helper text**: "To change the pick itself or type, create a new pick right."
- All other edit-mode features unchanged: action controls, protection presets, swap config, pool config, preview, apply bar, draft saving, advanced editor, duplicate-as-new

### Create mode (unchanged)

- PickSelector remains visible for selecting team/year/round
- Action cards (Protect, Swap, Pool) remain visible
- No identity summary shown

---

## File-by-File Changes

### `src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx`

- **Section A (Pick Identity)**: Added conditional render — `isEditMode ? <IdentitySummary> : <PickSelector>`
- Edit mode renders `data-testid="edit-identity-summary"` with sub-elements: `edit-identity-primary`, `edit-identity-owner`, `edit-identity-pick-id`
- Create mode renders `PickSelector` exactly as before
- Removed the old `isEditMode && <helper text>` block that was below PickSelector
- Updated file header with TM-WIZARD-UX-E2 history entry

### `src/tests/architect/pickRightWizard.test.tsx`

- **Replaced** test "locks identity pick fields in edit mode" (checked disabled dropdowns) with 3 new tests:
  1. "does NOT show PickSelector in edit mode" — asserts `pick-selector`, `pick-selector-team`, `pick-selector-year`, `pick-selector-round` are all absent
  2. "shows locked identity summary in edit mode" — asserts `edit-identity-summary`, primary text (BOS/2027/1st), owner text, pick ID, helper copy
  3. "shows PickSelector in create mode" — asserts `pick-selector` present, `edit-identity-summary` absent
- **Replaced** test "shows edit-mode helper copy about owner and creating new right" (old text format) — assertions merged into the new identity summary test
- **Renamed** test "shows pick selector always visible" → "shows pick selector in create mode" for accuracy
- Updated file header with TM-WIZARD-UX-E2 history entry

### `src/tests/architect/quickBuilder.test.tsx`

- **Added** new describe block "Edit mode identity summary (TM-WIZARD-UX-E2)" with 6 tests:
  1. "edit mode does NOT render PickSelector"
  2. "edit mode renders locked identity summary with team/year/round"
  3. "edit mode shows Owner line"
  4. "edit mode shows Pick ID"
  5. "create mode renders PickSelector, NOT identity summary"
  6. "edit mode still shows action controls and apply bar"
- Updated file header with TM-WIZARD-UX-E2 history entry

### `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`

- Added TM-WIZARD-UX-E2 section documenting the change, files, and test results

---

## Tests Run + Results

| Test File                              | Result  | Count                                   |
| -------------------------------------- | ------- | --------------------------------------- |
| `quickBuilder.test.tsx`                | ✅ PASS | 26/26 (20 original + 6 new)             |
| `pickRightWizard.test.tsx`             | ✅ PASS | 23/23 (20 original + 3 new, 2 replaced) |
| `pickRightWizard.vacuumApply.test.tsx` | ✅ PASS | 11/11 (no regressions)                  |
| Production build                       | ✅ PASS | succeeds (44s)                          |

---

## Non-Goals Verified

- ❌ No entitlement schema changes
- ❌ No Firestore write changes
- ❌ No vacuum overlay behavior changes
- ❌ No resolver merge seam changes
- ❌ No validation pipeline changes
- ❌ No legacy picks reintroduced
- ❌ No new persistence paths

---

## Stop Conditions Checked

- ✅ Removing PickSelector in edit mode does NOT break apply — Apply button, validation, and save pipeline all work identically (tested by `pickRightWizard.test.tsx` "calls writer on Apply click when valid")
- ✅ No new persistence path introduced
- ✅ Edit mode has sufficient identity data — `wizardModel.pick` always has `team`, `year`, `round` populated from `initialDocument` via `formStateToWizardModel()`

---

## Follow-Ups / Edge Cases

- **None identified.** The change is purely presentational. All data flow paths (WizardModel → formState → buildEntitlementDocument → validation → save) remain unchanged.
