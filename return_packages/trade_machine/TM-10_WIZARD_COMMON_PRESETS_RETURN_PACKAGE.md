# TM-10: Wizard Common Presets — Return Package

**Date:** 2026-02-10
**Scope:** Pick Editor Wizard protection preset simplification + swap label polish

---

## What Changed (file-by-file)

### 1. `src/features/architect/admin/ProtectionLadderTemplates.ts`

Added `WIZARD_PRESETS` export — a curated 5-item array of `ProtectionTemplate` objects. The existing `PROTECTION_TEMPLATES` (6 items, used by Advanced Editor) is unchanged.

New presets:
- `unprotected` — empty tiers
- `top4_unprotected` — 2-tier: Top 4 roll → Unprotected cancel
- `top10_unprotected` — 2-tier: Top 10 roll → Unprotected cancel
- `lottery_unprotected` — 2-tier: Lottery roll → Unprotected cancel
- `lottery_top10_unprotected` — 3-tier: Lottery roll → Top 10 roll → Unprotected cancel

Cancel tiers use `condition: 'Unprotected'` (not empty string) to pass the document validator's non-empty condition requirement.

### 2. `src/features/architect/admin/PickRightWizardSteps/WizardStepDetails.tsx`

- Changed import from `PROTECTION_TEMPLATES` to `WIZARD_PRESETS`
- Template grid and `handleTemplateSelect` now iterate/search `WIZARD_PRESETS`
- Swap type button labels changed from hardcoded `"Best of"` / `"Worst of"` to `WIZARD_LABELS.swapBestOf` / `WIZARD_LABELS.swapWorstOf`

### 3. `src/features/architect/admin/pickEditorCopy.ts`

- Updated `protectionPatternHelp` to: "These are the most common NBA protections. For custom protections or special rules, open Advanced Editor."
- Added `swapBestOf: 'Swap most favorable'` to `WIZARD_LABELS`
- Added `swapWorstOf: 'Swap least favorable'` to `WIZARD_LABELS`

### 4. `src/tests/architect/wizardTranslation.test.ts`

Added test block **"TM-10: WIZARD_PRESETS"** (8 tests):
- Preset list contains exactly 5 entries with correct IDs
- `unprotected` produces empty ladder
- `top4_unprotected` produces correct 2-tier ladder
- `top10_unprotected` produces correct 2-tier ladder
- `lottery_unprotected` produces correct 2-tier ladder with Lottery condition
- `lottery_top10_unprotected` produces correct 3-tier ladder
- Selecting unprotected clears protectionLadder and sets status to "clean"
- Every preset passes the full validation pipeline (`wizardToFormState` → `validateWizardModel`)

Also added import of `WIZARD_PRESETS` and `applyProtectionTemplate`.

### 5. `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`

Added TM-10 section documenting: presets table, swap labels, microcopy, files changed, test results.

---

## Before / After Behavior

### Protection presets (wizard mode)

**Before (6 buttons):**
1. Unprotected
2. Lottery -> Top 10 -> Unprotected
3. Top 3 -> Unprotected
4. Top 10 -> Converts to 2nd
5. Top 5 -> Top 3 -> Unprotected
6. Lottery -> Converts to 2nd

**After (5 buttons):**
1. Unprotected
2. Top 4 protected -> Unprotected next year
3. Top 10 protected -> Unprotected next year
4. Lottery protected (Top 14) -> Unprotected next year
5. Lottery -> Top 10 -> Unprotected

### Swap labels (wizard mode)

**Before:** "Best of" / "Worst of"
**After:** "Swap most favorable" / "Swap least favorable"

### Protection help text

**Before:** "Choose a common protection pattern to auto-fill the ladder."
**After:** "These are the most common NBA protections. For custom protections or special rules, open Advanced Editor."

### Advanced Editor

**Unchanged.** `PROTECTION_TEMPLATES` still has all 6 original entries.

---

## Test Commands + Results

```
npm run test -- --run src/tests/architect/wizardTranslation.test.ts
# 45/45 pass (8 new TM-10 tests)

npm run test -- --run src/tests/architect/pickRightWizardDraft.test.ts src/tests/architect/pickSelector.test.tsx
# 21/21 pass (no regressions)

npm run build
# succeeds
```

---

## Schema Impact

None. No Firestore schema changes. All presets produce valid documents using the existing `ProtectionLadderTierForm` structure and pass `validateEntitlementDocument()`.
