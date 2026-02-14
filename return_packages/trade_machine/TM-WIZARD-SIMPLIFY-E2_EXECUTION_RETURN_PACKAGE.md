# TM-WIZARD-SIMPLIFY-E2 EXECUTION RETURN PACKAGE

**Date:** 2026-02-14
**Ticket:** TM-WIZARD-SIMPLIFY-E2
**Goal:** Rebuild Pick Right Wizard "Quick Builder" into a no-scroll, single-screen UX menu

---

## Summary

Completely rebuilt the Quick Builder to be a compact "edit menu" that fits on a single laptop viewport without scrolling. Removed all verbose blocks (Plain English preview, Terms Summary, Tradability badge, ladder preview) and relegated Pool/Conveyance editing to Advanced Editor only.

---

## Before/After

### Before (TM-WIZARD-SIMPLIFY-E1)

- Edit mode showed: PickSelector, action cards with descriptions, ladder tier preview, Plain English block, Terms Summary block, Tradability badge, apply bar
- Pool mode showed: full pool management UI with chips, pick list, add/remove buttons
- Total content: required scrolling on typical laptop viewport

### After (TM-WIZARD-SIMPLIFY-E2)

- Edit mode shows: compact locked identity row (single line), active type indicator, action-specific controls, description input, compact validity + apply bar
- Create mode shows: PickSelector, minimal action toggle (Protection / Swap / Pool…), action-specific controls
- Pool mode shows: single-line redirect message pointing to Advanced Editor
- Total content: fits in single viewport without scrolling

---

## File-by-File Changes

### `src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx`

**Change Type:** Major restructure

- **EDIT MODE identity**: Reduced from multi-line summary to single horizontal row:
  - `Pick: {TEAM} {YEAR} {ROUND} • Owner: {TEAM} [pick_id] 🔒`
  - Removed helper text "To change the pick itself..."
- **ACTION TOGGLE**: Replaced action cards with compact buttons:
  - `🛡️ Protection` / `🔄 Swap` / `📦 Pool…`
  - Pool button now just sets intent (was: directly opened Advanced)
- **PROTECTION PRESETS**: Changed from 2-column cards to 5-column button row:
  - Labels only, descriptions moved to `title` tooltips
  - "Custom…" link retained for Advanced Editor
- **REMOVED**: PlainEnglishPreview component, Tradability badge, ladder tier preview
- **POOL MODE**: Shows redirect message instead of full pool UI
- **APPLY BAR**: Compact layout with inline validity indicator
- **Lines reduced**: 710 → 461 (35% reduction)

### `src/features/architect/admin/pickEditorCopy.ts`

**Change Type:** Copy tightening

- Removed verbose help text:
  - `pickHelp`: "" (was: "Select the team, year...")
  - `protectionPatternHelp`: "" (was: "Choose a common protection...")
  - `controllerPickHelp`: "" (was: "The pick your team controls...")
  - `targetDescriptionHelp`: "" (was: "Describe what the swap is against...")
  - `poolOfPicksHelp`: "" (was: "A pool lets you receive...")
  - `selectionRankHelp`: "" (was: "Which rank(s) to receive...")
- Shortened labels:
  - `openAdvanced`: "Advanced →" (was: "Open Advanced Editor")
  - `pickOwnershipTitle`: "Protection" (was: "Pick Ownership")
  - `descriptionPlaceholder`: shortened
  - `conveyanceRightTitle`: "Pool" (was: "Conveyance Right")

### `src/tests/architect/pickRightWizard.test.tsx`

**Change Type:** Test updates for compact UI

- Updated file header with TM-WIZARD-SIMPLIFY-E2 history entry
- **Protect controls test**: Removed `quick-builder-preview` expectation
- **Pool test**: Changed to verify redirect message instead of pool UI
- **Pool management tests**: Skipped (feature moved to Advanced Editor)
- **Template test**: Changed to verify button selection state instead of ladder text
- **Tradability badge test**: Skipped (feature removed)
- **Identity summary test**: Removed helper copy assertion

### `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`

**Change Type:** New execution log section

- Added TM-WIZARD-SIMPLIFY-E2 section documenting:
  - Problem statement
  - Solution description
  - Key changes list
  - Files changed
  - Test results
  - Schema/pipeline invariants preserved

---

## Acceptance Criteria Status

| Criterion                                                                                                                         | Status | Notes                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| EDIT MODE shows NO pick selector controls                                                                                         | ✅     | Edit mode shows locked identity row only                                    |
| Modal fits without scroll (typical laptop viewport)                                                                               | ✅     | Removed Plain English, Terms, Tradability, ladder preview                   |
| Quick screen shows only: pick label, protection presets, swap 2 options, optional description, validity, apply bar, advanced link | ✅     | Implemented as specified                                                    |
| Pool/conveyance UI is not present on quick screen at all                                                                          | ✅     | Shows redirect message only                                                 |
| Advanced Editor still exists and can do everything                                                                                | ✅     | Unchanged                                                                   |
| No user-visible "vacuum" wording                                                                                                  | ✅     | Modal uses "Not saved to a world — changes are stored in this browser only" |
| Existing save/apply + draft + duplicate-as-new flows still work                                                                   | ✅     | All vacuum apply tests pass                                                 |

---

## Test Commands and Results

```bash
# Primary wizard tests
npm run test -- --run src/tests/architect/pickRightWizard.test.tsx
# Result: 21 passed, 2 skipped

# Quick Builder unit tests
npm run test -- --run src/tests/architect/quickBuilder.test.tsx
# Result: 26 passed

# Vacuum apply tests
npm run test -- --run src/tests/architect/pickRightWizard.vacuumApply.test.tsx
# Result: 11 passed

# No vacuum wording tests
npm run test -- --run src/tests/architect/noVacuumWording.test.ts
# Result: 7 passed

# Production build
npm run build
# Result: Build succeeded in 37.36s
```

**Total tests:** 65 passed, 2 skipped (67 total)

---

## Screenshot Notes (Described)

### Edit Mode (No-Scroll Compact)

```
┌─────────────────────────────────────────────────────┐
│ Edit Pick Right                                   × │
├─────────────────────────────────────────────────────┤
│ ⚠️ Not saved to a world — stored in browser only    │
├─────────────────────────────────────────────────────┤
│ Pick: BOS 2027 1st • Owner: BOS    BOS_2027_1   🔒  │
│                                                     │
│ 🛡️ Protection                                       │
│                                                     │
│ PROTECTION                                          │
│ [Unprotected][Top 4→][Top 10→][Lottery→][3-Year]   │
│ Custom…                                             │
│                                                     │
│ [Description (optional)_______________________]     │
├─────────────────────────────────────────────────────┤
│ ✓ Valid            [Save Draft] [Apply] Advanced →  │
├─────────────────────────────────────────────────────┤
│ [Cancel]                                            │
└─────────────────────────────────────────────────────┘
```

### Create Mode (No-Scroll Compact)

```
┌─────────────────────────────────────────────────────┐
│ New Pick Right                                    × │
├─────────────────────────────────────────────────────┤
│ Pick                                                │
│ [Team ▼] [Year ▼] [Round ▼]                        │
│                                                     │
│ [🛡️ Protection] [🔄 Swap] [📦 Pool…]               │
│                                                     │
│ (action-specific controls appear here)              │
│                                                     │
│ [Description (optional)_______________________]     │
├─────────────────────────────────────────────────────┤
│ ✓ Valid            [Save Draft] [Apply] Advanced →  │
├─────────────────────────────────────────────────────┤
│ [Cancel]                                            │
└─────────────────────────────────────────────────────┘
```

### Pool Mode (Redirect)

```
│ Pool editing is available in the Advanced Editor.   │
│ [Open Advanced Editor] (link)                       │
```

---

## Pipeline Invariants Preserved

| Invariant                                            | Status       |
| ---------------------------------------------------- | ------------ |
| WizardModel → `wizardToFormState()`                  | ✅ Unchanged |
| `wizardToFormState()` → `buildEntitlementDocument()` | ✅ Unchanged |
| `buildEntitlementDocument()` → validate              | ✅ Unchanged |
| validate → apply                                     | ✅ Unchanged |
| Draft save/restore                                   | ✅ Unchanged |
| Vacuum overlay persistence                           | ✅ Unchanged |

**No schema changes.** All downstream pipeline code untouched.

---

## Blockers

None encountered. The UI changes were purely presentational and did not require schema modifications or pipeline changes.
