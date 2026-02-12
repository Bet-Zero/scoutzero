# TM-VACUUM-E1 — Execution Return Package

> **Ticket:** TM-VACUUM-E1  
> **Date:** 2026-02-12  
> **Status:** COMPLETE  
> **Build:** ✅ Passes  
> **New Tests:** 43 passing (26 + 6 + 11)  
> **Regressions:** None (all pre-existing failures unchanged)

---

## Summary

Vacuum mode pick-right editing is now functional. When `worldId` is null (no world selected), users can:

- **Edit** existing base entitlements — changes stored as session overlay patches
- **Create** new entitlements — stored as full documents with `vacuum:` prefixed IDs
- **See changes reflected** in UI entitlement rows, trade validation, Stepien checks, and trade receipts
- **Clear edits** via a "Clear session pick edits" button that reverts to base state

All changes persist to `localStorage` only — **no Firestore writes occur in vacuum mode**. World mode behavior is completely unchanged.

---

## File-by-File Changes

### New Files

| File                                                                         | Purpose                                                                          |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | localStorage-backed overlay store with load/save/edit/create/clear/ID generation |
| `src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts`               | 26 unit tests for overlay store                                                  |
| `src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts`           | 6 tests for resolver merge seam (vacuum + world mode)                            |
| `src/tests/architect/pickRightWizard.vacuumApply.test.tsx`                   | 11 tests for wizard vacuum apply behavior                                        |

### Modified Files

| File                                                               | Changes                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/entitlementResolver.ts` | Import overlay store; inject vacuum overlay merge after base resolution when `!worldId`                                                                                                                             |
| `src/features/architect/tradeMachine/TradeEditor.jsx`              | Remove `!worldId` gates from edit/create handlers; add `isVacuumMode` prop pass-through; add "Clear session pick edits" button; add worldId transition cleanup via `useEffect`                                      |
| `src/features/architect/admin/PickRightWizardModal.tsx`            | Accept `worldId: string \| null`, `userId: string \| null`, `vacuumMode?: boolean`; branch `handleApply` for vacuum vs world path; add session mode banner; use `'vacuum'` as draft key prefix when worldId is null |
| `src/features/architect/hooks/useTradeMachine.js`                  | Extend `applyEntitlementOverrideUpdate` to append new entitlements (vacuum creates); add `refreshEntitlements()` for re-resolving all active team slots; expose in return object                                    |

---

## Overlay Storage Format

**localStorage key:** `vacuum_entitlement_overlay`

```json
{
  "version": 1,
  "overlays": {
    "BOS": {
      "edits": {
        "ent:BOS:2027:1:own:abc12345": {
          "description": "Top 3 protected",
          "protectionLadder": [{ "year": 2027, "condition": "Top 3" }]
        }
      },
      "creates": {
        "vacuum:BOS:2028:1:own:x7k2m9p1": {
          "id": "vacuum:BOS:2028:1:own:x7k2m9p1",
          "holderTeam": "BOS",
          "seasonYear": 2028,
          "round": 1,
          "kind": "pick_ownership",
          "underlyingPickId": "BOS_2028_1"
        }
      }
    }
  },
  "_updatedAt": "2026-02-12T12:00:00.000Z"
}
```

**Vacuum ID format:** `vacuum:<teamCode>:<seasonYear>:<round>:<kindShort>:<8char>`  
**Kind mapping:** `pick_ownership` → `own`, `swap_right` → `swap`, `conveyance_right` → `conv`

---

## How Create vs Edit Works in Vacuum Mode

### Edit (existing base entitlement)

1. User clicks pencil icon on an existing entitlement (e.g., `ent:BOS:2027:1:own:abc12345`)
2. Wizard opens with `entitlementId` set to the existing ID
3. User modifies fields → clicks Apply
4. `handleApply` detects `!worldId` → vacuum path
5. Calls `applyVacuumEdit(teamCode, entitlementId, document)` — stores patch in overlay
6. `onSuccess` fires → `applyEntitlementOverrideUpdate` deep-merges into in-memory state
7. Next `resolveEntitlementsForTeam(null, teamCode)` call will merge this edit onto the base

### Create (new vacuum entitlement)

1. User clicks "New Pick Right" button
2. Wizard opens with `entitlementId = null`
3. User fills fields → clicks Apply
4. `handleApply` detects `!worldId` + no `entitlementId` → calls `makeVacuumEntitlementId()`
5. Calls `applyVacuumCreate(teamCode, vacuumId, document)` — stores full doc in overlay
6. `onSuccess` fires → `applyEntitlementOverrideUpdate` appends new entitlement to team's list
7. Next `resolveEntitlementsForTeam(null, teamCode)` call will include this create

### Re-edit (vacuum-created entitlement)

1. User clicks pencil on an entitlement with `vacuum:` prefix ID
2. Wizard opens with `entitlementId` starting with `vacuum:`
3. On Apply → `applyVacuumCreate` overwrites the existing create entry (full replace)

---

## How World Mode Remains Unchanged

- **Resolver seam:** The vacuum overlay merge block is inside `if (!worldId)` — when `worldId` is truthy, this block is **completely skipped**
- **TradeEditor gates:** When `worldId` is truthy, the existing `userId` requirement is preserved
- **Wizard Apply:** When `worldId` is truthy, the existing `writeWorldEntitlement(db, {...})` path executes exactly as before
- **`writeWorldEntitlement` safety net:** The function already guards on `!worldId` → returns `{ success: false }` — this is a secondary defense even if the vacuum path somehow fails to intercept
- **No overlay leakage:** When switching from vacuum → world mode, `clearVacuumOverlay()` is called automatically via a `useEffect` on `worldId` transitions

---

## Test Commands + Results

```bash
# Overlay store — 26 tests
npm run test -- --run src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts
# Result: 26 passed

# Resolver merge seam — 6 tests
npm run test -- --run src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts
# Result: 6 passed

# Wizard vacuum apply — 11 tests
npm run test -- --run src/tests/architect/pickRightWizard.vacuumApply.test.tsx
# Result: 11 passed

# Existing wizard tests — no regressions from changes
npm run test -- --run src/tests/architect/pickRightWizard.test.tsx
# Result: 21 passed, 2 failed (pre-existing — same as before changes)

# Full build
npm run build
# Result: ✅ Build succeeded (exit code 0)
```

---

## Manual Smoke Checklist

### Vacuum Mode (worldId = null)

- [ ] Load Trade Machine with no world selected
- [ ] Click pencil icon on an existing entitlement → wizard opens (no "Select a world" toast)
- [ ] Complete wizard flow → Apply → entitlement updates in list
- [ ] Verify session banner: "Session mode — changes saved to this browser only"
- [ ] Click "New Pick Right" → complete flow → Apply → new `vacuum:` row appears
- [ ] "Clear session pick edits" button appears → click it → rows revert to base
- [ ] Validate Trade → verify entitlement changes are reflected in validation results

### World Mode (worldId set)

- [ ] Select a world → edit entitlement → Apply → `writeWorldEntitlement` fires to Firestore
- [ ] Verify no session mode banner shown
- [ ] Verify "Clear session pick edits" button is NOT shown

### Mode Transition

- [ ] Create vacuum edits → select a world → vacuum overlay is cleared automatically
- [ ] Entitlements revert to base + world overrides

---

## Architecture Decisions

| Decision                                    | Rationale                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Deep-merge** for edits (not full replace) | Consistent with existing `deepMerge` used for world overrides in the resolver          |
| **Append** creates to end of list           | Keeps base entitlement ordering stable                                                 |
| **`vacuum:` prefix** on IDs                 | Prevents accidental collision with real Firestore IDs                                  |
| **Single merge seam** in resolver           | One injection point feeds all downstream: UI, validation, Stepien, receipt             |
| **`refreshEntitlements()` function**        | Cleaner than abusing `selectTeam` for a reload; useful for future features             |
| **`'vacuum'` draft key prefix**             | Keeps vacuum-mode drafts separate from world-mode drafts                               |
| **No vacuum-specific feature flag**         | Reuses `VITE_FEATURE_ENTITLEMENT_AUTHORING` — vacuum mode is an extension of authoring |
| **Auto-clear on mode switch**               | Prevents stale vacuum data from leaking when user selects a world                      |
