# SHIP_GATES_RC1_UI_SUITE_FIX_E1 — EXECUTION RETURN PACKAGE

**Date:** 2026-02-26
**Mode:** EXECUTION
**Goal:** Make `npm run test -- --run` PASS by fixing 6 UI test files (27 failing tests) discovered after node-layer went green in RC1.1.

---

## Summary

All 27 UI test failures across 6 files have been resolved. The combined gate `npm run test -- --run` now passes (node: 232 files, UI: 34 files). No trade logic or CBA legality changes were made.

---

## Per-File Root Cause and Fix

### Task A — `src/tests/architect/wizardTranslation.test.ts` (4 fails → 0)

**Root cause:** Label drift — the UI was intentionally simplified for user-friendly copy, but tests still expected the old schema-style labels.

**Changes (test updates):**
- `WIZARD_KIND_LABELS`: Updated expectations from `'Pick Ownership'`/`'Swap Right'`/`'Conveyance Right'` to `'Protection'`/`'Swap'`/`'Pool'`
- `WIZARD_INTENT_LABELS`: Updated `create_conveyance` expectation from `'Conveyance'` to `'Pool'`
- `WIZARD_PRESETS`: Updated count from 5 → 4, removed `lottery_top10_unprotected` test (preset was removed in TM-WIZARD-SIMPLIFY-E2)

**Decision:** Tests updated to match current canonical UI labels — the simplified labels are the intended user-facing output.

### Task B — `src/tests/architect/pickRightWizard.test.tsx` (6 fails → 0) + `src/tests/architect/pickRightWizard.vacuumApply.test.tsx` (10 fails → 0)

**Root causes:**
1. **Testid rename:** Apply button was `wizard-apply-footer` but tests expected `wizard-apply`
2. **Missing Save Draft button:** Removed during unification; `handleSaveDraft` existed in session hook but no UI button
3. **Missing vacuum mode banner:** Removed during unification ("Context is Implementation Detail")
4. **Missing Convert to Swap:** Feature designed in TM-WIZARD-SIMPLIFY-E2 but not implemented in QuickBuilder
5. **Missing test mocks:** `saveEntitlementFromFormState` (introduced during unification) uses `writeWorldEntitlementAndAttachToTeamAtomic`, `rekeyVacuumCreate`, `resolveVacuumEditCollisions`, `findVacuumCreateByIdentityKey` — none were mocked
6. **Vacuum create routing bug:** `saveEntitlementFromFormState` pre-computed a non-vacuum deterministic ID for vacuum creates, causing the save to route through vacuum edit instead of vacuum create

**Component changes:**
- `PickRightWizardModal.tsx`: Renamed testid to `wizard-apply`. Added Save Draft button (`wizard-save-draft`). Added vacuum mode banner (`vacuum-mode-banner`). Added `handleConvertToSwap` callback using `wizardPickToId`. Passed `onConvertToSwap` to QuickBuilder.
- `QuickBuilder.tsx`: Added `edit-identity-pick-id` element. Added `onConvertToSwap` prop. Added Convert to Swap section (`swap-convert-section`, `convert-to-swap-btn`) that replaces normal swap controls when editing pick_ownership.
- `saveEntitlementFromFormState.ts`: Fixed vacuum create routing — pass `undefined` as entitlementId to `saveVacuum` for creates (1-line fix).

**Test changes:**
- `pickRightWizard.test.tsx`: Updated `wizard-apply-footer` reference to `wizard-apply`. Added `writeWorldEntitlementAndAttachToTeamAtomic` to entitlementWriter mock.
- `pickRightWizard.vacuumApply.test.tsx`: Added missing mocks (`rekeyVacuumCreate`, `resolveVacuumEditCollisions`, `findVacuumCreateByIdentityKey`, `writeWorldEntitlementAndAttachToTeamAtomic`). Updated vacuum re-edit test to expect `rekeyVacuumCreate` (correct behavior with deterministic ID system). Updated vacuum create assertion to check team code instead of removed `makeVacuumEntitlementId`.

### Task C — `src/tests/architect/quickBuilder.test.tsx` (4 fails → 0)

**Root causes:**
1. Missing `edit-identity-pick-id` in QuickBuilder edit mode
2. Convert to Swap section not implemented
3. Missing `writeWorldEntitlementAndAttachToTeamAtomic` mock

**Changes:** Component fixes from Task B above. Added `writeWorldEntitlementAndAttachToTeamAtomic` to test mock.

### Task D — `src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx` (2 fails → 0)

**Root cause:** Vacuum action buttons moved to 3-dot menu during component refactoring, but test didn't open the menu. Also, badge text was `'Edited'` but test expected `'Edited (this session)'`.

**Component change:** Updated badge text to `'Edited (this session)'`, action text to `'Revert this edit'` and `'Delete this session pick right'`.

**Test change:** Updated test to pass `openMenu` and `setOpenMenu` props so the dropdown menu is visible. This matches the current 3-dot menu interaction pattern.

### Task E — `tests/RankingSetup.test.jsx` (1 fail → 0)

**Root cause:** Component redesigned with Tier Tagging UX. Old `data-testid="top-tier"` removed, replaced by `data-testid="tier-tagging"`. Old click interaction (click player name) replaced by TOP/BOT buttons. Start button text changed to `'Start Ranking →'`.

**Test change:** Updated to use `tier-tagging` testid, click TOP button, and match `/Start/` regex.

**Decision:** Test updated to match new UI — the Tier Tagging design is the canonical UX.

---

## Whether Testids Were Restored or Tests Updated

| Fix | Approach | Rationale |
|-----|----------|-----------|
| `wizard-apply` | Restored testid in component | `wizard-apply` is the canonical UI contract for the Apply button |
| `wizard-save-draft` | Restored button in component | Save Draft is a legitimate feature; `handleSaveDraft` existed in session hook |
| `vacuum-mode-banner` | Restored banner in component | Vacuum session indicator is useful UX |
| `edit-identity-pick-id` | Added to component | Pick ID display in edit mode is part of the identity summary spec |
| Convert to Swap section | Added to component | Designed in TM-WIZARD-SIMPLIFY-E2, not yet implemented in QuickBuilder |
| `WIZARD_KIND_LABELS` etc. | Updated tests | UI was intentionally simplified; tests were stale |
| Vacuum badges menu | Updated tests | 3-dot menu is the canonical interaction pattern |
| `RankingSetup` | Updated tests | Tier Tagging UX is the canonical design |
| Vacuum re-edit behavior | Updated test | Deterministic ID system correctly rekeys on identity change |

---

## Validation Outputs

| Command | Result |
|---------|--------|
| `npm run test:ui -- --run` | **PASS** (34 files, 370 tests passed, 2 skipped) |
| `npm run test:node -- --reporter=dot` | **PASS** (232 files, 3025 tests passed, 9 skipped, 8 todo) |
| `npm run test -- --run` | **PASS** (full: node 232 + UI 34 = 266 files) |
| `npm run build` | **PASS** |
| `npm run validate:project` | **PASS** |

---

## Files Changed

### Component files (production code)
1. `src/features/architect/admin/PickRightWizardModal.tsx` — Added Save Draft button, vacuum banner, Convert to Swap handler, renamed Apply testid
2. `src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx` — Added `edit-identity-pick-id`, Convert to Swap section, `onConvertToSwap` prop
3. `src/features/architect/tradeMachine/EntitlementPickRow.jsx` — Updated vacuum badge text and action text
4. `src/features/architect/admin/saveEntitlementFromFormState.ts` — Fixed vacuum create routing (1-line)

### Test files
5. `src/tests/architect/wizardTranslation.test.ts` — Updated label/preset expectations
6. `src/tests/architect/pickRightWizard.test.tsx` — Updated testid reference, added mock
7. `src/tests/architect/pickRightWizard.vacuumApply.test.tsx` — Added missing mocks, updated vacuum re-edit/create assertions
8. `src/tests/architect/quickBuilder.test.tsx` — Added mock
9. `src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx` — Updated to open menu for action visibility
10. `tests/RankingSetup.test.jsx` — Updated selectors and interaction for Tier Tagging UX

### Documentation
11. `docs/SHIP_GATES_MASTER.md` — Added RC1.2 Gate Snapshot
12. `docs/architect/TRADE_MACHINE_MASTER.md` — Added RC1.2 sub-bullet

---

## Key Design Decisions

1. **Convert to Swap** was implemented as a QuickBuilder feature (not just a test fix) because TM-WIZARD-SIMPLIFY-E2 designed this feature and the test expectations are correct — editing pick_ownership and selecting Swap should offer conversion.

2. **Vacuum create routing fix** in `saveEntitlementFromFormState.ts` was necessary because the unified save function was pre-computing non-vacuum deterministic IDs for vacuum creates, causing them to route through the edit path instead of the create path. This was a 1-line fix that correctly passes `undefined` as the entitlementId for creates.

3. **Vacuum re-edit test** was updated to expect `rekeyVacuumCreate` instead of `applyVacuumCreate` because the deterministic ID system correctly detects identity changes and rekeys rather than blindly overwriting.
