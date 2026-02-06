# TM-8 Pick Editor UX P0 — Return Package

**Ticket:** TM-8 Pick Editor UX Overhaul (P0 Wizard Layer)
**Date:** 2026-02-05
**Status:** SHIPPED

---

## Summary

Implemented a guided wizard modal as the default entrypoint for creating and editing pick rights (entitlements) in the Trade Machine. A random user can now create protections, swaps, and conveyance rights using dropdown selectors and protection templates — without typing raw pick IDs or understanding the schema. The existing tabbed editor (TM-4/TM-7) is preserved as the "Advanced Editor" accessible via a toggle inside the wizard.

---

## Files Changed

### New Files (10)

| File                                                                      | Purpose                                                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/features/architect/admin/PickRightWizardModal.tsx`                   | Wizard modal orchestrator — default entrypoint from pencil icon |
| `src/features/architect/admin/PickSelector.tsx`                           | Team/Year/Round dropdown → canonical pick ID generator          |
| `src/features/architect/admin/PlainEnglishPreview.tsx`                    | Plain-English + termsShort + validity indicator preview         |
| `src/features/architect/admin/pickRightWizardDraft.ts`                    | localStorage draft helpers (save/load/clear/hasDraft)           |
| `src/features/architect/admin/PickRightWizardSteps/WizardStepIntent.tsx`  | Step 1: "What are you doing?" intent selection                  |
| `src/features/architect/admin/PickRightWizardSteps/WizardStepDetails.tsx` | Step 2: Kind-specific configuration inputs                      |
| `src/features/architect/admin/PickRightWizardSteps/WizardStepReview.tsx`  | Step 3: Review + Save Draft / Apply                             |
| `src/tests/architect/pickRightWizard.test.tsx`                            | Wizard core flow tests (25+ cases)                              |
| `src/tests/architect/pickRightWizardDraft.test.ts`                        | Draft localStorage tests (10 cases)                             |
| `src/tests/architect/pickSelector.test.tsx`                               | PickSelector component tests (9 cases)                          |

### Modified Files (2)

| File                                                  | Change                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | Replaced `EntitlementEditorModal` import/render with `PickRightWizardModal` (~3 lines) |
| `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`        | Added TM-8 section documenting all changes                                             |

---

## Before/After UX

### Before (TM-4/TM-7)

- Pencil icon → opens `EntitlementEditorModal` directly
- User sees 5-tab form: Basics / Protection Ladder / Swap / Conveyance / Advanced JSON
- User types raw pick IDs (e.g., `BOS_2027_1`) in text inputs
- No plain-English description of what was configured
- Save immediately writes to Firestore world override (no draft option)
- No guided flow — user must understand all fields

### After (TM-8)

- Pencil icon → opens `PickRightWizardModal` (wizard mode by default)
- **Step 1 (create mode):** "What are you doing?" — 4 cards: Protect a Pick / Create a Swap / Create a Conveyance / Advanced Editor
- **Step 2:** Guided inputs using dropdown selectors (no raw pick ID typing needed)
  - PickSelector: Team dropdown (all 30 NBA teams sorted), Year dropdown (2024-2033), Round dropdown (1st/2nd)
  - Protection templates: 6 common patterns auto-fill the ladder
  - Swap: Radio button selector for best_of / worst_of
  - Conveyance: Visual pool picker with add/remove buttons
- **Step 3:** Review with plain-English preview ("2027 1st Round pick from BOS: Top 3 protected in 2027 → Unprotected in 2028"), termsShort, validity indicator, field summary
- **Save Draft** → localStorage only, no Firestore write
- **Apply** → writes via existing `writeWorldEntitlement()` path
- "Open Advanced Editor" link available at all times → switches to full TM-4/TM-7 tabbed form
- Draft restore prompt on wizard open if previous draft exists

---

## Pick ID Generation

- **Helper:** `generatePickId()` from `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`
- **Canonical format:** `{TEAM}_{YEAR}_{ROUND}` (e.g., `BOS_2027_1`, `PHI_2026_2`)
- **Validation regex:** `/^[A-Z]{2,4}_\d{4}_[12]$/`
- **PickSelector component:** Composes Team/Year/Round dropdowns → calls `generatePickId({ originalTeam, year, round })` → outputs canonical string
- **Advanced override:** Collapsible "edit raw pick ID" text input for power users

---

## Draft vs Apply Behavior

### Save Draft (localStorage only)

- **Key format:** `pickrightdraft:{worldId}:{entitlementId|new}`
- **Examples:**
  - Create mode: `pickrightdraft:world-123:new`
  - Edit mode: `pickrightdraft:world-123:ent:BOS:2027:1:own:abcd1234`
- **Content:** Full `EntitlementFormState` serialized as JSON
- **Lifecycle:**
  - On wizard open: checks `hasDraft()` → shows "Restore Draft?" prompt if exists
  - On Save Draft click: calls `saveDraft()` → toast "Draft saved locally"
  - On Apply success: calls `clearDraft()` → draft removed automatically
  - On Discard: calls `clearDraft()` → draft removed

### Apply (Firestore write)

- Uses existing `writeWorldEntitlement()` from `entitlementWriter.ts`
- Writes to: `architect_worlds/{worldId}/entitlements/{entitlementId}`
- Uses existing `validateEntitlementDocument()` for schema validation before write
- Uses existing `buildEntitlementDocument()` to convert form state to Firestore document
- Feature-gated: `VITE_FEATURE_ENTITLEMENT_AUTHORING=true` required

---

## Test Commands & Results

```bash
# Draft helpers (unit tests — no mocking complexity)
npm run test src/tests/architect/pickRightWizardDraft.test.ts -- --run

# PickSelector component
npm run test src/tests/architect/pickSelector.test.tsx -- --run

# Wizard core flows
npm run test src/tests/architect/pickRightWizard.test.tsx -- --run

# Full build verification
npm run build
```

---

## Known Limitations

1. **Protection ladder editing in wizard mode is template-driven only.** Users can apply templates and clear the ladder, but cannot add/edit/reorder individual tiers without switching to Advanced Editor. This is intentional for P0 — keeping the wizard simple.

2. **Swap and conveyance are display-only in trade validation.** As noted in existing amber warnings: swap and conveyance definitions are saved and displayed but not yet simulated by the trade validation engine. This is pre-existing (TM-6/TM-7) and not a TM-8 regression.

3. **Draft storage is per-browser.** localStorage drafts do not sync across devices or browsers. This is intentional for P0 — we avoid adding Firestore draft collections.

4. **Year range is static (2024-2033).** The PickSelector offers a 10-year range. For picks beyond 2033, users can use the "Advanced: edit raw pick ID" toggle or the Advanced Editor.

5. **No stop conditions triggered.** Pick ID convention is clear and centralized. Pencil icon entrypoint is centralized in TradeEditor.jsx. Wizard state routes cleanly into existing hooks with no refactoring needed.

---

## Architecture Notes

- **Zero breaking changes:** The existing `EntitlementEditorModal` is fully preserved as a component. The wizard wraps it rather than replacing it. The "Advanced Editor" mode inside the wizard renders the existing tabbed form via `EntitlementEditorFormTabs` + `PickTermsPreview` components.
- **Same validation path:** Both wizard and advanced modes use `useEntitlementEditorState` hook → `buildEntitlementDocument()` → `validateEntitlementDocument()` → `writeWorldEntitlement()`. No new validation was added.
- **Same form state type:** Both modes operate on `EntitlementFormState` from `entitlementEditorFormState.ts`. Switching between wizard and advanced mode preserves all field values.
- **Feature flag:** `VITE_FEATURE_ENTITLEMENT_AUTHORING=true` gates everything. If disabled, the modal shows "Feature Disabled" (same behavior as TM-4).
