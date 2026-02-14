# TM-WIZARD-SIMPLIFY-E1: Pick Right Wizard — Quick Builder UX Overhaul

**Ticket**: TM-WIZARD-SIMPLIFY-E1  
**Status**: COMPLETE  
**Date**: 2026-02-14

---

## Executive Summary

The Pick Right Wizard has been rebuilt from a 3-step wizard (Intent → Details → Review) into a single-screen "Quick Builder" that shows the pick identity, action cards, action-specific controls, inline preview, and an always-visible Apply bar — all on one screen with zero jargon.

### What Changed

- **Single screen**: No more "Next" / "Back" navigation. The user picks an action, sees controls and preview immediately, and applies.
- **Protect flow**: Only curated WIZARD_PRESETS (5 common NBA protections). "Custom → Advanced" link for anything beyond.
- **Swap flow**: Human language — "Most favorable" / "Least favorable" buttons, "Your pick" / "Their pick" selectors, auto-filled target description.
- **Pool flow**: Chip-based selection (Best / Top 2 / Worst / Bottom 2 / Middle) replacing comparator dropdowns and rank number inputs.
- **Jargon ban**: 15 schema terms (conveyance, comparator, rank, encumbered, etc.) are banned from all Quick Builder UI text. Enforced by automated test.
- **Display text cleanup**: PlainEnglishPreview now says "Pool right" instead of "Conveyance right"; termsShort says "Pool (ordered)" instead of "Conveys (ranked)"; tradability badge says "Part of pick pool" instead of "Part of conveyance pool".

---

## Test & Build Results

| Check | Result |
|-------|--------|
| Quick Builder tests (20 tests) | ✅ All pass |
| Wizard modal tests (22 tests) | ✅ All pass |
| Vacuum apply tests (11 tests) | ✅ All pass |
| Draft persistence tests (11 tests) | ✅ All pass |
| Entitlement terms tests (5 tests) | ✅ All pass |
| **Total: 69 targeted tests** | ✅ **All pass** |
| Production build (`npm run build`) | ✅ Succeeds (34s, chunk warning pre-existing) |

---

## Files Changed

### Created (1 file)

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx` | 594 | Single-screen Quick Builder: pick selector, action cards, protect/swap/pool controls, inline preview, apply bar |

### Modified (5 files)

| File | Lines | What changed |
|------|-------|-------------|
| `src/features/architect/admin/PickRightWizardModal.tsx` | 521 | Removed 3-step wizard flow (step state, Next/Back buttons, step conditionals). Now renders `<QuickBuilder>` as sole body content. All save/load/validation logic preserved unchanged. |
| `src/features/architect/admin/pickEditorCopy.ts` | 291 | Added `WIZARD_INTENT_DESCRIPTIONS`, `POOL_CHIP_PRESETS` (5 chips with comparator+ranks mapping), `detectPoolChip()` reverse detection, `BANNED_JARGON_WORDS` (15 terms). Updated labels: "Swap Direction"→human names, "Conveyance"→"Pool" throughout. |
| `src/features/architect/admin/PlainEnglishPreview.tsx` | 201 | Changed "Conveyance right for..." → "Pool right for..." in `buildPlainEnglish()`. |
| `src/features/architect/utils/entitlements/entitlementTerms.ts` | 328 | Changed `formatEntitlementTermsShort` from "Conveys (ranked)" → "Pool (ordered)". |
| `tests/entitlements/entitlementTerms.test.ts` | 109 | Updated expected termsShort string to match "Pool (ordered)". |

### Test Files Modified/Created (3 files)

| File | Tests | What changed |
|------|-------|-------------|
| `src/tests/architect/quickBuilder.test.tsx` (NEW) | 20 | Pool chip translation (7), protect presets→formState pipeline (4), swap auto-fill (2), pool chips→formState (4), jargon-ban assertions (3) |
| `src/tests/architect/pickRightWizard.test.tsx` | 22 | Rewrote for Quick Builder: removed multi-step navigation tests, added action card/chip/single-screen tests |
| `src/tests/architect/pickRightWizard.vacuumApply.test.tsx` | 11 | Removed `wizard-next` step navigation from all apply/draft flows |

### Preserved Unchanged

| File | Reason |
|------|--------|
| `WizardStepDetails.tsx`, `WizardStepReview.tsx` | Kept on disk for potential Advanced Editor reference. No longer imported by modal. |
| `wizardToEntitlement.ts` | Translation pipeline unchanged — Quick Builder produces the same WizardModel shapes |
| `pickRightWizardModel.ts` | Model schema unchanged |
| `ProtectionLadderTemplates.ts` | Preset data unchanged (consumed by Quick Builder) |
| `PlainEnglishPreview.tsx` (component logic) | Component structure unchanged, only display text updated |
| `PickSelector.tsx` | Pick identity selectors unchanged |
| All Advanced Editor files | Untouched |
| All entitlement utility files | Untouched |
| `vacuumEntitlementOverlayStore.ts` | Untouched |

---

## Task Mapping

| Task | Description | Status |
|------|-------------|--------|
| T1 | Single-screen layout: pick + cards + controls + preview + apply | ✅ |
| T2 | Protect flow: curated presets only, custom → Advanced | ✅ |
| T3 | Swap flow: human language, auto-fill target description | ✅ |
| T4 | Pool flow: chip presets replacing comparator/rank dropdowns | ✅ |
| T5 | Jargon ban: 15 banned terms, automated test enforcement | ✅ |
| T6 | Laptop-friendly layout, collapsible details sections | ✅ |
| T7 | Tests: updated 2 existing suites, created 1 new suite (20 tests) | ✅ |

---

## Architecture Notes

### Quick Builder Data Flow

```
QuickBuilder (UI)
  ├── PickSelector → sets holderTeam/seasonYear/round/pickId on WizardModel
  ├── Action cards → sets model.intent (protect/swap/pool)
  ├── Protect section → applies WIZARD_PRESETS to model.protectionLadder
  ├── Swap section → sets swapType + target pick via PickSelector
  ├── Pool section → manages poolUnderlyingPickIds + applies chip presets
  └── Apply bar → triggers existing save/apply pipeline
```

The Quick Builder produces the **exact same WizardModel shapes** as the old 3-step wizard. The downstream pipeline (`wizardToFormState()` → `buildEntitlementDocument()` → validation → save) is completely unchanged.

### Pool Chip Mapping

| Chip | Comparator | Ranks |
|------|-----------|-------|
| Best | more_favorable | [1] |
| Top 2 | more_favorable | [1, 2] |
| Worst | less_favorable | [1] |
| Bottom 2 | less_favorable | [1, 2] |
| Middle | middle | [1] |

### Dead Code Note

`WizardStepDetails.tsx` and `WizardStepReview.tsx` are no longer imported by the modal. They remain on disk as reference for future Advanced Editor improvements. They can be safely deleted if no longer needed.

---

## Trade-offs & Decisions

1. **Kept WizardModel as-is**: Rather than introducing a new model, the Quick Builder produces the same model shapes. This means zero changes to the downstream validation/save pipeline.
2. **Chip presets are opinionated**: The 5 pool chips cover the most common NBA pool configurations. Less common combos (e.g., "3rd best") require the Advanced Editor.
3. **Description field is collapsible**: Moved into a `<details>` element to save vertical space. Defaults to collapsed.
4. **termsShort changed globally**: "Conveys (ranked)" → "Pool (ordered)" affects both Quick Builder and Advanced Editor preview. This is intentional — the term "conveyance" is confusing everywhere.

---

## Smoke Checklist (5-minute browser test)

1. [ ] Open Pick Right Wizard → confirm single-screen layout (no step indicator)
2. [ ] Select a team/year/round → confirm pick ID auto-generates
3. [ ] Click "Protect a Pick" → confirm 5 preset cards appear
4. [ ] Select "Top 4 Protected" → confirm ladder preview + plain English update
5. [ ] Click "Custom protections (Advanced)" → confirm Advanced Editor opens
6. [ ] Click "Create a Swap" → confirm Most/Least favorable buttons
7. [ ] Select "Most favorable" → confirm "Their pick" selector appears
8. [ ] Select their pick → confirm target description auto-fills
9. [ ] Click "Create a Pool" → confirm chip bar (Best/Top 2/Worst/Bottom 2/Middle)
10. [ ] Click "Best" chip → confirm it highlights
11. [ ] Add pool picks → confirm list updates
12. [ ] Verify Apply button always visible when action selected
13. [ ] Verify Save Draft button works
14. [ ] Verify no jargon words visible (no "conveyance", "comparator", "rank", "encumbered", etc.)
15. [ ] Open in edit mode → confirm action type shown, pick selector locked, controls pre-filled
