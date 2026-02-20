# Entitlement Editor Unification: Simple ↔ Advanced — Execution Return Package

**Ticket:** Entitlement Editor Unification  
**Status:** COMPLETE  
**Date:** 2026-02-20  
**Master Doc:** `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`

---

## What Changed

Unified the Entitlement Editor from two separate modals (Simple wizard + Advanced tabbed editor) into **ONE modal with two views** sharing a single session state. The Advanced button now toggles an inline view instead of opening a separate modal.

### Architecture Summary

```
┌─────────────────────────────────────────────────┐
│           PickRightWizardModal (Unified)         │
│  ┌───────────────────────────────────────────┐   │
│  │  useEntitlementEditorSession (Hook)        │   │
│  │  - formState (canonical shared state)      │   │
│  │  - wizardModel (simple view helper)        │   │
│  │  - openView: 'simple' | 'advanced'         │   │
│  │  - storageMode: 'vacuum' | 'world'         │   │
│  │  - handleApply → saveEntitlementFromFormState│  │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─────────────┐   ┌──────────────────────────┐  │
│  │ Simple View  │   │  Advanced View            │  │
│  │ QuickBuilder │   │  EntitlementEditorFormTabs│  │
│  │              │←→│  PickTermsPreview          │  │
│  └─────────────┘   └──────────────────────────┘  │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │  Shared Footer: Cancel | Session Actions | Apply │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Single modal with view toggle** (header pill: Simple | Advanced) instead of two separate modals
2. **saveEntitlementFromFormState** — pure function that both views call, routes vacuum vs world internally
3. **useEntitlementEditorSession** — single hook owns all state; both views consume from it
4. **No more `advancedEditorState`** in TradeEditor — removed entirely
5. **Vacuum guard removed** — Advanced view works in both vacuum and world modes

---

## Invariants Implemented

### R1 — One Editor, One Working State ✅

- `useEntitlementEditorSession` owns the single `formState`
- Switching Simple → Advanced does not lose changes (same state object)
- Advanced → Simple syncs via `formStateToWizardModel()` reverse mapping

### R2 — One Save Semantics (Context-Agnostic) ✅

- `saveEntitlementFromFormState()` is the single save function
- Both views' Apply button calls `session.handleApply()` which delegates to it
- Internally routes: vacuum → localStorage overlay; world → Firestore

### R3 — Context Is Implementation Detail ✅

- No user-facing "vacuum mode" or "world mode" language
- The `storageMode` is internal to the session
- Removed the toast: "Advanced editor requires saving to a world first"

---

## Files Changed

| File                                                           | Change                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/features/architect/admin/saveEntitlementFromFormState.ts` | **NEW** — Unified save function (vacuum + world routing)                     |
| `src/features/architect/admin/useEntitlementEditorSession.ts`  | **NEW** — Shared session hook (formState, wizardModel, view toggle, save)    |
| `src/features/architect/admin/PickRightWizardModal.tsx`        | **REWRITTEN** — Unified modal with Simple/Advanced view toggle               |
| `src/features/architect/tradeMachine/TradeEditor.jsx`          | Removed `advancedEditorState`, `EntitlementEditorModal` import, vacuum guard |
| `src/tests/architect/entitlementEditorUnification.test.ts`     | **NEW** — 9 tests for state continuity, save routing, round-trip             |
| `src/tests/architect/pickRightWizard.test.tsx`                 | Updated 2 tests for new view toggle behavior (was `onOpenAdvanced` callback) |

### Files NOT Changed (kept for backward compat)

| File                                                        | Status                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/features/architect/admin/EntitlementEditorModal.tsx`   | Kept as-is — still importable but no longer rendered by TradeEditor |
| `src/features/architect/admin/useEntitlementEditorState.ts` | Kept as-is — still used by EntitlementEditorModal tests             |

---

## Validation Results

### Build

- `npm run build` → ✅ PASS (37s, 3039 modules)

### New Tests

- `entitlementEditorUnification.test.ts` → ✅ 9/9 passed
  - State Continuity: Simple → Advanced (2 tests)
  - Save Routing: Unified Save Function (3 tests)
  - Round-Trip Continuity: Advanced → Simple (3 tests)
  - Unified Save: Both views same pipeline (1 test)

### Existing Tests (no regressions)

- `advancedEditorHandoff.test.ts` → ✅ 7/7 passed
- `entitlementEditorModal.test.tsx` → ✅ 5/5 passed
- `entitlementEditorProtection.test.tsx` → ✅ 8/8 passed
- `entitlementEditorSwapType.test.tsx` → ✅ 6/6 passed
- `noVacuumWording.test.ts` → ✅ 7/7 passed
- `vacuumEntitlementOverlayStore.test.ts` → ✅ (all passed)
- `entitlementResolver.vacuumOverlay.test.ts` → ✅ (all passed)

### Pre-existing Failures (NOT introduced by this change)

- `pickRightWizard.test.tsx` — 6 failures (was 7 before, fixed 1)
- `wizardTranslation.test.ts` — 4 failures (preset count mismatch)
- `vacuumE3.duplicateAsNew.test.tsx` — 1 failure (mock missing WIZARD_LABELS)

---

## Manual Smoke Steps

1. **Simple → Advanced → Simple round-trip:**
   - Open entitlement editor (Simple view default)
   - Select "Protect" → choose a template
   - Click "Advanced" toggle pill
   - Verify protection ladder appears in Protection Ladder tab
   - Click "Simple" toggle pill
   - Verify template selection is still shown

2. **Save in vacuum mode:**
   - Without a world, open editor → make change → Apply
   - Toast should show "Saved (this session only)"
   - Overlay stored in localStorage

3. **Save in world mode:**
   - With a world loaded, open editor → make change → Apply
   - Toast should show "Entitlement saved"
   - Document written to Firestore

4. **Advanced in vacuum mode (was previously blocked):**
   - Without a world, open editor
   - Click "Advanced" toggle
   - Verify tabbed editor loads (no error toast)
   - Make edits in Basics/Protection tabs
   - Click Apply → saves to vacuum overlay
