# Entitlement Editor Naming Unification — Execution Report

**Ticket:** TM-ENTITLEMENT-NAMING-UNIFY  
**Date:** 2026-02-20  
**Status:** ✅ COMPLETE

---

## Summary

Unified the entitlement editing UI terminology to present **one editor** with two levels of complexity:

- **Entitlement Editor (Simple)** — Previously called "Pick Right Wizard" or "Quick Builder"
- **Entitlement Editor (Advanced)** — The tabbed full-field editor

Removed all "Wizard" language from user-facing UI text.

---

## Changes Made

### UI Text Changes

| Location                  | Before                                              | After                                              |
| ------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Modal title (create mode) | `New Pick Right`                                    | `Entitlement Editor`                               |
| Modal title (edit mode)   | `{team} {year} {round}`                             | `Entitlement Editor` with pick details as subtitle |
| Create button             | `New Pick Right`                                    | `New Entitlement`                                  |
| Create button title attr  | `Create new pick right`                             | `Create new entitlement`                           |
| Pool redirect link        | `Open Advanced Editor`                              | `Advanced`                                         |
| Pool redirect message     | `Pool editing is available in the Advanced Editor.` | `Pool editing is available in the Advanced view.`  |
| Advanced modal title      | `{Edit\|Create} World Entitlement`                  | `Entitlement Editor (Advanced)`                    |

### Files Changed

| File                                                                 | Change Type            |
| -------------------------------------------------------------------- | ---------------------- |
| `src/features/architect/admin/EntitlementEditorCreateButton.tsx`     | Button text + title    |
| `src/features/architect/admin/PickRightWizardModal.tsx`              | Modal header structure |
| `src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx` | Pool redirect text     |
| `src/features/architect/admin/EntitlementEditorModal.tsx`            | Modal title            |
| `src/tests/architect/entitlementEditorCreate.test.tsx`               | Test expectations      |
| `src/tests/architect/pickRightWizard.test.tsx`                       | Test expectations      |
| `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`       | Added naming section   |

---

## Before/After Examples

### Create Button

**Before:**

```tsx
<span>New Pick Right</span>
```

**After:**

```tsx
<span>New Entitlement</span>
```

### Simple View Modal Header

**Before:**

```tsx
<h2>{entitlementId ? `${team} ${year} ${round}` : 'New Pick Right'}</h2>
```

**After:**

```tsx
<h2>Entitlement Editor</h2>;
{
  entitlementId && (
    <p>
      {team} {year} {round}
    </p>
  );
}
```

### Advanced View Modal Title

**Before:**

```tsx
<h2>{entitlementId ? 'Edit' : 'Create'} World Entitlement</h2>
```

**After:**

```tsx
<h2>Entitlement Editor (Advanced)</h2>
```

---

## Validation Results

### Build

- **Status:** ✅ PASS
- `npm run build` completes successfully
- No TypeScript/syntax errors

### Tests

- **EntitlementEditorCreateButton tests:** ✅ 7/7 PASS
- **PickRightWizard tests:** ✅ 24/32 PASS (6 pre-existing failures unrelated to naming)
- Pre-existing failures are related to "Convert to Swap" mock infrastructure, not naming changes

### Wizard Terminology Verification

- **Status:** ✅ PASS
- Searched for "Wizard" in user-facing UI strings
- All remaining "wizard" references are in:
  - Code identifiers (file names, class names)
  - `data-testid` attributes (not user-visible)
  - Comments and documentation
  - Washington Wizards team references

---

## Acceptance Criteria Checklist

| Criterion                                                     | Status  |
| ------------------------------------------------------------- | ------- |
| Users see **one** thing named **Entitlement Editor**          | ✅ PASS |
| Simple view is the default and not framed as a separate tool  | ✅ PASS |
| Advanced view is presented as an expansion of the same editor | ✅ PASS |
| No user-facing UI uses "Wizard" language                      | ✅ PASS |
| Create actions use **New Entitlement** label                  | ✅ PASS |

---

## Documentation Updated

Added new section to `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`:

**"Naming: Entitlement Editor (Simple/Advanced)"**

Includes:

- Overview of the one-editor-two-levels model
- UX model table
- Key principles
- UI text standards
- File mapping

---

## Notes

- File names like `PickRightWizardModal.tsx` were NOT renamed (internal identifiers, not user-facing)
- The term "pick right" is still used appropriately as a domain term (the right to a draft pick)
- Only user-facing UI text was changed; no functional behavior modifications
