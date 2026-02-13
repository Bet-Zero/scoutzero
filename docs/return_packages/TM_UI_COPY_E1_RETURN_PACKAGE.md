# TM-UI-COPY-E1 — Execution Return Package

> **Ticket:** TM-UI-COPY-E1  
> **Date:** 2026-02-12  
> **Status:** COMPLETE  
> **Parent:** `docs/architect/TRADE_MACHINE_VACUUM_MODE_MASTER.md`

---

## Summary

Removed all "vacuum"-adjacent user-facing language from Trade Machine and Pick-Right wizard surfaces. Replaced with clear, descriptive copy that communicates the default/saved distinction: **GM Tools (quick sandbox)** vs **Architect world (saved to Firestore)**. No behavior, logic, or persistence changes were made — this is a copy + labeling execution only.

---

## T1 — Inventory of User-Visible "Vacuum" Text

**Finding:** The word "vacuum" already did **not** appear in any rendered user-facing text. All UI strings used "session" terminology. The word "vacuum" exists only in internal identifiers, metadata keys, localStorage keys, ID prefixes, comments, `data-testid` attributes, and console error messages.

The following user-facing strings were targeted for improvement under the "clarify default vs saved" directive:

| File | Location | Original String | Type |
| --- | --- | --- | --- |
| `PickRightWizardModal.tsx` | L524 banner | "Session mode — changes saved to this browser only" | Banner |
| `TradeEditor.jsx` | L262 button | "Clear session pick edits" | Button label |
| `TradeEditor.jsx` | L260 tooltip | "Clear all session pick-right edits" | Tooltip |
| `EntitlementPickRow.jsx` | L249 badge | "Edited (session)" | Badge |
| `TradeEditor.jsx` | L206 toast | "Session pick edits cleared" | Toast |
| `PickRightWizardModal.tsx` | L360 toast | "Entitlement saved (session)" | Toast |
| `WorldSelector.jsx` | L442 label | "World" | Label |

---

## T2 — Before/After Copy Changes

### A) Base mode (no world selected)

| Surface | Before | After |
| --- | --- | --- |
| Wizard banner | Session mode — changes saved to this browser only | Not saved to a world — changes are stored in this browser only. |
| Clear button label | Clear session pick edits | Clear session pick changes |
| Clear button tooltip | Clear all session pick-right edits | Clear all session pick changes |
| Badge (edited base) | Edited (session) | Edited (this session) |
| Badge (session-only) | Session-only | Session-only *(unchanged — already descriptive)* |
| Toast: overlay cleared | Session pick edits cleared | Session pick changes cleared |
| Toast: session save | Entitlement saved (session) | Saved (this session only) |
| Toast: edit reverted | Session edit reverted | *(unchanged)* |
| Toast: pick deleted | Session pick right deleted | *(unchanged)* |
| Action: revert | Revert this edit | *(unchanged)* |
| Action: delete | Delete this session pick right | *(unchanged)* |

### B) World mode (world selected)

No banner is shown (the `vacuumMode || !worldId` guard hides it). No changes needed.

---

## T3 — World Selector Helper Copy

Added below the world selector dropdown when no world is selected:

> Select a world to save changes. No world = quick sandbox.

Rendered as `text-[10px] text-white/40` — subtle, non-intrusive. Hidden when a world is selected.

---

## T4 — GM Tools vs Architect Language Alignment

| Surface | Before | After |
| --- | --- | --- |
| World selector label | "World" | "Architect (optional)" |
| World selector helper | *(none)* | "Select a world to save changes. No world = quick sandbox." |
| Nav link | "GM Tools" | *(unchanged — already correct)* |
| Dashboard heading | "HoopZero Architect – GM Dashboard" | *(unchanged — already correct)* |

---

## T5 — "No Vacuum Wording" Test Guard

Created: `src/tests/architect/noVacuumWording.test.ts`

- Scans 7 key UI source files for "vacuum" in user-visible contexts:
  - JSX text nodes (`>…vacuum…<`)
  - String prop values (`title=`, `aria-label=`, `placeholder=`)
  - Toast messages (`toast.success('…vacuum…')`)
- Allows internal identifiers, comments, `data-testid`, imports, and console messages
- 7 tests (one per file), all passing

---

## T6 — Updated Existing Tests

| Test File | Change |
| --- | --- |
| `entitlementPickRow.vacuumBadges.test.jsx` | Updated assertion: `'Edited (session)'` → `'Edited (this session)'` |
| `pickRightWizard.vacuumApply.test.tsx` | Updated assertion: `/session mode/i` → `/not saved to a world/i`; updated test description |

---

## T7 — Master Doc Update

Updated `docs/architect/TRADE_MACHINE_VACUUM_MODE_MASTER.md`:

- Status line: added `TM-UI-COPY-E1` to revision history
- Added new **Section 9: User-Facing Copy (TM-UI-COPY-E1)** covering:
  - Principle: "vacuum mode" is internal-only terminology
  - Full table of user-visible copy per surface
  - Conceptual mapping: no world = GM Tools / sandbox, world = Architect
  - Test guard reference

---

## Files Changed

| File | Change Type |
| --- | --- |
| `src/features/architect/admin/PickRightWizardModal.tsx` | Banner text, toast text |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | Button label, tooltip, toast text |
| `src/features/architect/tradeMachine/EntitlementPickRow.jsx` | Badge text |
| `src/features/architect/GMDashboard/components/WorldSelector.jsx` | Label change, helper copy added |
| `src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx` | Updated assertion |
| `src/tests/architect/pickRightWizard.vacuumApply.test.tsx` | Updated assertion |
| `src/tests/architect/noVacuumWording.test.ts` | **NEW** — test guard |
| `docs/architect/TRADE_MACHINE_VACUUM_MODE_MASTER.md` | Revision + new section |

---

## Scope Discipline — What Was NOT Changed

- **No internal keys/IDs renamed**: `vacuum_entitlement_overlay`, `vacuum:` prefix, `__vacuumEdited`, `__vacuumSessionOnly`, `isVacuumMode`, `vacuumMode`, `data-testid="vacuum-mode-banner"` — all unchanged
- **No persistence logic changed**
- **No resolver merge logic changed**
- **No validation logic changed**
- **No navigation restructuring**
- **No console error messages changed** (developer-facing, not user-visible)

---

## Test Results

### Targeted runs (3 files, 20 tests)

```
✓ src/tests/architect/noVacuumWording.test.ts         (7 tests)  18ms
✓ src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx  (2 tests) 219ms
✓ src/tests/architect/pickRightWizard.vacuumApply.test.tsx     (11 tests) 988ms

Test Files  3 passed (3)
     Tests  20 passed (20)
```

### Full suite

```
Test Files  21 failed | 200 passed (221)
     Tests  74 failed | 2865 passed | 1 skipped | 3 todo (2943)
```

All 21 failures are **pre-existing** and unrelated to this ticket (e.g., `TradeValidationGating.guardrail.test.jsx`, `staleValidationFix.test.js`). Zero failures in any vacuum-related or copy-related test files.

---

## Build Result

```
✓ 3020 modules transformed.
✓ built in 54.66s

dist/index.html                            0.60 kB
dist/assets/index-a80c3d66.css            79.72 kB
dist/assets/index.esm-f7a675eb.js          3.62 kB
dist/assets/seasonManager-a21253e4.js     40.03 kB
dist/assets/index-9fda4529.js          2,139.92 kB
```

Build succeeds with no new warnings.

---

## Acceptance Criteria Checklist

- [x] No user-visible UI text contains "vacuum"
- [x] Base mode clearly communicates "not saved / browser-only"
- [x] World mode does not imply session-only behavior
- [x] Copy is consistent across: wizard banner, badges, clear button, per-row actions, toasts
- [x] Tests pass (20/20 targeted, 0 new failures in full suite)
- [x] Build passes
- [x] Test guard prevents future regressions
- [x] Master doc updated with revision and new section
