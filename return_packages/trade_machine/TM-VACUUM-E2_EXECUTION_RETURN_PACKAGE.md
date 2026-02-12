# TM-VACUUM-E2 — EXECUTION RETURN PACKAGE

Date: 2026-02-12
Mode: EXECUTION

## Summary

Implemented Pick-Right Wizard edit guardrails and vacuum per-item controls without changing world-mode authoring flow.

Delivered:

- Edit mode now opens directly on Details and skips Type/intent step
- Edit-mode identity fields are locked in wizard (pick identity + anchor IDs)
- Helper copy added:
  - `Owner (changes when traded)`
  - `To change the pick itself or type, create a new pick right.`
- Vacuum per-item actions added:
  - `Revert this edit` (base entitlement with overlay patch)
  - `Delete this session pick right` (`vacuum:` entitlement)
- Resolver seam still single-point merge; world mode remains untouched
- Entitlement list badges added:
  - `Session-only`
  - `Edited (session)`

## File-by-file changes

- `src/features/architect/admin/PickRightWizardModal.tsx`
  - Edit mode starts on `details`
  - Type step hidden in edit mode
  - Back from details closes in edit mode (no return to Type)
  - Added vacuum per-item actions + callbacks (`onVacuumSessionMutation`)
  - Wired overlay checks (`hasEdit` / `hasCreate`) and removals (`removeEdit` / `removeCreate`)

- `src/features/architect/admin/PickRightWizardSteps/WizardStepDetails.tsx`
  - Added `isEditMode` + `lockIdentityFields` props
  - Locked identity selectors in edit mode (primary pick, swap type/controller, conveyance pool identity controls)
  - Added helper copy text for owner/type-change guidance

- `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts`
  - Added:
    - `removeEdit(teamCode, entitlementId)`
    - `removeCreate(teamCode, vacuumEntitlementId)`
    - `hasEdit(teamCode, entitlementId)`
    - `hasCreate(teamCode, vacuumEntitlementId)`

- `src/features/architect/utils/entitlements/entitlementResolver.ts`
  - Vacuum merge seam now tags resolved rows:
    - `__vacuumEdited: true` for patched base entitlements
    - `__vacuumSessionOnly: true` for vacuum-created entitlements

- `src/features/architect/tradeMachine/EntitlementPickRow.jsx`
  - Added row badges for vacuum state
  - Added per-row vacuum actions:
    - `Revert this edit`
    - `Delete this session pick right`

- `src/features/architect/tradeMachine/EntitlementPicksList.jsx`
  - Threaded vacuum props and per-item callbacks into row component

- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - Threaded vacuum props/callbacks into entitlement list

- `src/features/architect/tradeMachine/TradeEditor.jsx`
  - Wired per-item handlers to overlay store remove APIs
  - Calls existing `refreshEntitlements()` after per-item remove to refresh UI/validation
  - Passed `onVacuumSessionMutation` to wizard modal for refresh after modal-level revert/delete

- `src/tests/architect/pickRightWizard.test.tsx`
  - Updated for edit-details start
  - Added lock assertions for identity fields
  - Added helper copy assertions
  - Updated template/swap label expectations

- `src/tests/architect/pickRightWizard.vacuumApply.test.tsx`
  - Updated edit-mode flow assumptions
  - Expanded vacuum overlay store mocks for new APIs

- `src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts`
  - Added tests for `removeEdit` / `removeCreate`

- `src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts`
  - Added tests for per-item remove behavior:
    - revert edit restores base display
    - delete vacuum entitlement removes from resolved list
  - Added metadata flag checks for badge behavior

- `src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx` (new)
  - Verifies `Session-only` and `Edited (session)` badge rendering
  - Verifies per-item action labels appear on matching rows

- `docs/architect/TRADE_MACHINE_VACUUM_MODE_MASTER.md`
  - Added E2 section + revision history entry

## Tests run + results

Ran:

- `npm run test -- --run src/tests/architect/pickRightWizard.test.tsx src/tests/architect/pickRightWizard.vacuumApply.test.tsx src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx`
  - Result: **5 files passed, 75 tests passed**

- `npm run build`
  - Result: **pass**

Notes:

- Existing non-blocking build warnings remain (chunk size, browserslist staleness, existing `fs` externalization warning path).

## Manual smoke checklist (vacuum + world)

Execution status key:

- `[x]` validated by automated test/build run
- `[ ]` requires in-browser manual click-through

Vacuum mode (`worldId = null`):

- [x] Open edit via pencil on base entitlement; modal starts on Details
- [x] Confirm primary pick/team/year/round and anchor identity controls are locked
- [x] Confirm helper copy appears in details
- [x] Make an edit; save; row shows `Edited (session)` badge
- [x] Click `Revert this edit`; row returns to base display and badge disappears
- [x] Create new pick right; row shows `Session-only` badge
- [x] Click `Delete this session pick right`; row disappears
- [ ] Validate trade after each action; verify UI/validation refreshes without full clear

World mode (`worldId != null`):

- [x] Open edit via pencil; modal still starts on Details and identity fields are locked
- [x] Confirm no vacuum per-item controls/badges appear
- [x] Save edit; Firestore world write path remains active

### Smoke execution log (this run)

- Re-ran focused E2 suite:
  - `npm run test -- --run src/tests/architect/pickRightWizard.test.tsx src/tests/architect/pickRightWizard.vacuumApply.test.tsx src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx`
  - Result: **5 files passed, 75 tests passed**
- Re-ran production build:
  - `npm run build`
  - Result: **pass**
- Remaining manual-only item:
  - One browser click-through to validate full trade re-validation UX immediately after per-item revert/delete action.

## Notes / risks

- No Firestore writes were introduced for vacuum per-item controls; actions operate only on local overlay store and call `refreshEntitlements()`.
- Resolver merge seam remains single-point (`resolveEntitlementsForTeamWithDb`), avoiding duplicate merge logic.
- World-mode entitlement authoring behavior remains unchanged except intended wizard UX guardrails (details-first + locked identity in edit mode).
