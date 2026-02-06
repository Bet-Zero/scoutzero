# TM-9: Pick Editor Wizard Translation Layer + Front-Facing UX Copy

## Summary

TM-9 adds a **WizardModel** layer between the user-facing wizard and the schema-level `EntitlementFormState`. The wizard now speaks plain English — all schema jargon is removed from wizard mode and centralized in a copy module for the Advanced Editor.

## Architecture

```
User → WizardModel → wizardToFormState() → EntitlementFormState → buildEntitlementDocument() → validateEntitlementDocument() → Firestore
```

The WizardModel is the source of truth in wizard mode. A `useEffect` syncs it to `EntitlementFormState` via the translation layer on every change. The existing validation/save pipeline is untouched.

## Files Changed

### New Files (TM-9)

| File                                                   | Purpose                                                                                 |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/features/architect/admin/pickRightWizardModel.ts` | WizardModel type, factories, reverse mapping, pick ID helpers                           |
| `src/features/architect/admin/wizardToEntitlement.ts`  | Translation layer: `wizardToFormState()`, `wizardToDocument()`, `validateWizardModel()` |
| `src/features/architect/admin/pickEditorCopy.ts`       | Centralized UI copy, labels, tradability badge, jargon glossary                         |
| `src/tests/architect/wizardTranslation.test.ts`        | 37 pure unit tests for translation, round-trip, jargon, drafts                          |

### Modified Files (TM-9)

| File                                                                      | Changes                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/features/architect/admin/PickRightWizardModal.tsx`                   | Added WizardModel state management, `useEffect` sync, v2 draft handling        |
| `src/features/architect/admin/PickRightWizardSteps/WizardStepDetails.tsx` | Props changed to `wizardModel` instead of `formState`, jargon-free labels      |
| `src/features/architect/admin/PickRightWizardSteps/WizardStepReview.tsx`  | Uses `wizardModel` for display, tradability badge, jargon-free labels          |
| `src/features/architect/admin/PlainEnglishPreview.tsx`                    | Minor: "swap controller pick" → "controller pick:"                             |
| `src/features/architect/admin/pickRightWizardDraft.ts`                    | v2 envelope format `{version:2, wizardModel, formState}`, v1 migration on load |
| `src/tests/architect/pickRightWizard.test.tsx`                            | Updated test IDs and props to match TM-9 modal interface                       |

### Unchanged (preserved intact)

| File                            | Reason                                              |
| ------------------------------- | --------------------------------------------------- |
| `entitlementEditorFormState.ts` | Zero changes — the form state schema is unchanged   |
| `useEntitlementEditorState.ts`  | Zero changes — Advanced Editor state hook preserved |
| `EntitlementEditorModal.tsx`    | Zero changes — Advanced Editor completely untouched |
| All `EntitlementEditor*Tab.tsx` | Zero changes — Advanced Editor tabs preserved       |
| `entitlementWriter.ts`          | Zero changes — validation/save pipeline preserved   |

## Key Design Decisions

### 1. WizardModel as Source of Truth

The wizard no longer directly manipulates `EntitlementFormState`. Instead it maintains a `WizardModel` with user-facing field names and values. A `useEffect` translates this to `EntitlementFormState` on every change.

### 2. Jargon Elimination

Schema terms like `underlyingPickId`, `underlyingStatus`, `swapControllerPickId`, `swapTargetDefinition`, `receivesComparator` are never shown in wizard mode. They're mapped to plain-English labels via `pickEditorCopy.ts`.

### 3. Tradability Badge

Replaces the old `underlyingStatus` dropdown. Status is auto-derived from the wizard model:

- No protections → ✅ Tradable (green)
- Has protections/swap/conveyance → ⚠️ Tradable with restriction (amber)

### 4. Draft v2 Format

Drafts now store both `wizardModel` and `formState` in a versioned envelope. v1 (raw formState) drafts are auto-migrated on load via `formStateToWizardModel()`.

### 5. Advanced Editor Untouched

The Advanced Editor (`EntitlementEditorModal` + tabs) is completely preserved. The "Open in Advanced Editor" button passes the translated `formState` to the `onOpenAdvanced` callback.

## Test Results

```
37 passed — wizardTranslation.test.ts
  - WizardModel factories (3)
  - Pick ID helpers (3)
  - wizardToFormState translation (5)
  - Translation → Validation pipeline (4)
  - Round-trip WizardModel ↔ FormState (4)
  - Tradability badge (5)
  - Jargon-free labels (6)
  - Draft v2 handling (7)

23 passed — pickRightWizard.test.tsx
  - Intent step rendering (5)
  - Edit mode (2)
  - Protection template flow (1)
  - Review step navigation (2)
  - Tradability badge display (2)
  - Apply flow (1)
  - Draft save (1)
  - Advanced editor callback (1)
  - Cancel / back navigation (3)
  - Swap / conveyance flows (3)
  - Jargon-free UI assertion (1)
  - Step indicator (1)

Total: 60/60 passed
Build: ✅ Production build succeeds
```

## Jargon Map

| Schema Term             | Wizard Label                                 |
| ----------------------- | -------------------------------------------- |
| `underlyingPickId`      | (auto-derived, not shown)                    |
| `underlyingStatus`      | Tradability badge (auto-computed)            |
| `swapControllerPickId`  | Controller Pick                              |
| `swapTargetDefinition`  | Target Description                           |
| `poolUnderlyingPickIds` | Pool of Picks                                |
| `receivesComparator`    | Selection Method                             |
| `receivesRank`          | Selection Rank                               |
| `clean`                 | Tradable                                     |
| `encumbered`            | Restricted                                   |
| `pooled`                | Part of a pool                               |
| `pick_ownership`        | Pick Ownership / Protect a Pick              |
| `swap_right`            | Swap Right / Create a Swap Right             |
| `conveyance_right`      | Conveyance Right / Create a Conveyance Right |
