# Trade Machine — Vacuum Mode Master Document

> **Document ID:** TRADE_MACHINE_VACUUM_MODE_MASTER  
> **Created:** 2026-02-12  
> **Status:** EXECUTION COMPLETE — TM-VACUUM-E1  
> **Ticket:** TM-VACUUM-P1

---

## 1. Problem Statement

Today the Trade Machine's pick-right editing (pencil icon, "New Pick Right") is **hard-gated** on three conditions:

| Gate                                      | Check location                                                      | Blocker                            |
| ----------------------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `VITE_FEATURE_ENTITLEMENT_AUTHORING=true` | `entitlementWriter.ts → isEntitlementAuthoringEnabled()`            | Feature flag (environment)         |
| `worldId` must be non-null                | `TradeEditor.jsx → handleEditEntitlement / handleCreateEntitlement` | Toast: _"Select an active world…"_ |
| `userId` must be non-null                 | Same functions                                                      | Toast: _"Sign in to edit…"_        |

If no `worldId` is selected the user **cannot** create or edit pick rights at all. The entitlements the user sees come entirely from Firestore (`architect_baseEntitlements` + optional `architect_worlds/{worldId}/entitlements`). There is no way to speculatively modify entitlements without committing to a world.

This prevents "sandbox" exploration — the most common use case for the Trade Machine.

---

## 2. Definitions

| Term                    | Meaning                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vacuum mode**         | Trade Machine operating with `worldId === null`. No Firestore world overlay is active. All visible entitlements come from `architect_baseEntitlements` only.                                                    |
| **World mode**          | Trade Machine operating with a valid `worldId`. Entitlements are resolved as `base + worldOverride` and writes go to `architect_worlds/{worldId}/entitlements/`. Existing behavior — unchanged by this feature. |
| **Session overlay**     | An in-memory + localStorage map of entitlement _overrides_ and _creates_ that are merged into the entitlement list at resolver level during vacuum mode. Never written to Firestore.                            |
| **Overlay entitlement** | An entitlement document that exists only in the session overlay (created in vacuum mode). Distinguished by an `id` starting with `vacuum:`.                                                                     |
| **Resolver merge seam** | The single code location where the session overlay is merged with Firestore-resolved entitlements before they are consumed by the UI and validator.                                                             |

---

## 3. Chosen Architecture: Option A — Resolver-Layer Session Overlay

### Why Option A

The entitlement resolution path is cleanly encapsulated in a single function:  
`resolveEntitlementsForTeam(worldId, teamCode)` in `entitlementResolver.ts`.

This function is called by:

- `useTradeMachine.js` → team init (slot 0)
- `useTradeMachine.js` → `selectTeam()` (slots 1+)
- `useTeamEntitlements.ts` (standalone hook)

All consumers go through this function. Injecting the overlay here means **one merge point** feeds all downstream: UI rows, trade validation (`validationEntitlements`), Stepien rule, trade receipt.

### Option B (rejected)

Merging at the UI projection layer (`EntitlementPicksList.jsx`) was considered but rejected because:

- Would not affect `validationEntitlements` passed to the trade validator
- Would require a second merge point inside `useTradeMachine.js`
- Duplicated merge logic = higher bug surface

### Architecture Diagram

```
┌──────────────────────────────────────────────────┐
│                 GMDashboard                       │
│   worldId = null  │  userId = null (or set)       │
└────────┬─────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│               TradeEditor.jsx                     │
│  worldId  ──▶  useTradeMachine(…, worldId)        │
│                                                   │
│  NEW: Gate checks relaxed for vacuum mode:        │
│    handleEditEntitlement:  worldId OR vacuumMode ✓│
│    handleCreateEntitlement: worldId OR vacuumMode ✓│
│    PickRightWizardModal: accept vacuumMode prop   │
└────────┬─────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│     entitlementResolver.ts (MERGE SEAM)           │
│                                                   │
│  resolveEntitlementsForTeam(worldId, teamCode):   │
│    1. Fetch base entitlements from Firestore       │
│    2. If worldId: fetch + deep-merge overrides     │
│    3. ★ NEW: If !worldId: load session overlay     │
│       from vacuumOverlayStore, deep-merge/append   │
│    4. Return EffectiveEntitlement[]                │
└────────┬─────────────────────────────────────────┘
         │
         ├──▶ team.entitlements (UI display)
         ├──▶ team.validationEntitlements → validateStepien()
         ├──▶ EntitlementPicksList → EntitlementPickRow
         └──▶ Trade receipt (outgoingEntitlements / incomingEntitlements)
```

### Storage Design

```
localStorage key:  "vacuum_entitlement_overlay"

Value (JSON):
{
  "version": 1,
  "overlays": {
    "<teamCode>": {
      "edits": {
        "<existingEntitlementId>": { /* partial override fields */ }
      },
      "creates": {
        "vacuum:<teamCode>:<year>:<round>:<kind>:<shortUuid>": { /* full entitlement doc */ }
      }
    }
  },
  "_updatedAt": "<ISO timestamp>"
}
```

- **Edits**: keyed by existing entitlement ID; deep-merged with the base entitlement at resolve time.
- **Creates**: keyed by a `vacuum:` prefixed ID; appended to the resolved list.
- **ID format for creates**: `vacuum:<teamCode>:<seasonYear>:<round>:<kindShort>:<8-char-uuid>` — mirrors `generateEntitlementId()` but with `vacuum:` prefix to prevent Firestore collisions.

### Clear/Reset

- `resetVacuumOverlay()` → clears `"vacuum_entitlement_overlay"` from localStorage.
- Triggered by: explicit "Clear Session Edits" button (new UI), or switching to world mode.
- Switching from vacuum → world mode: overlay is discarded (world overrides are authoritative).

### Firestore Write Prevention

When `worldId === null` (vacuum mode):

1. `PickRightWizardModal.handleApply()` → **does NOT** call `writeWorldEntitlement()`. Instead calls a new `applyVacuumOverlay(entitlementId, document)` function.
2. `writeWorldEntitlement()` already guards on `!worldId` → returns `{ success: false }`. This is a secondary safety net.
3. The session overlay is the only persistence target.

---

## 4. Glossary

| Symbol                           | File                             | Role                                     |
| -------------------------------- | -------------------------------- | ---------------------------------------- |
| `resolveEntitlementsForTeam`     | `entitlementResolver.ts`         | The resolver merge seam                  |
| `writeWorldEntitlement`          | `entitlementWriter.ts`           | Firestore write — blocked in vacuum      |
| `applyEntitlementOverrideUpdate` | `useTradeMachine.js`             | Local state updater after edit           |
| `PickRightWizardModal`           | `admin/PickRightWizardModal.tsx` | Wizard UI for create/edit                |
| `handleEditEntitlement`          | `TradeEditor.jsx`                | Gate function for edit clicks            |
| `handleCreateEntitlement`        | `TradeEditor.jsx`                | Gate function for create clicks          |
| `validateStepien`                | `rules/validateStepien.js`       | Consumes `validationEntitlements`        |
| `decorateEntitlementForTrade`    | `entitlementTerms.ts`            | Decorates entitlements for trade payload |
| `pickRightWizardDraft.ts`        | `admin/pickRightWizardDraft.ts`  | Existing localStorage draft pattern      |

---

## 5. Revision History

| Date       | Change                                                                          |
| ---------- | ------------------------------------------------------------------------------- |
| 2026-02-12 | Initial preflight — architecture chosen (Option A), evidence collected.         |
| 2026-02-12 | TM-VACUUM-E1 execution complete. All 6 tasks implemented, 43 new tests passing. |

---

## 6. Implemented Behavior (TM-VACUUM-E1)

### What works now

- **Vacuum mode editing**: When `worldId === null`, users can edit existing base entitlements and create new ones via the Pick Right Wizard.
- **Session overlay**: All changes persist to `localStorage` under key `vacuum_entitlement_overlay`. No Firestore writes occur.
- **Single merge seam**: Overlay is merged in `resolveEntitlementsForTeamWithDb()` — edits are deep-merged onto base entitlements, creates are appended. All downstream consumers (UI, validation, Stepien, trade receipt) automatically see the changes.
- **Vacuum IDs**: New entitlements get `vacuum:<teamCode>:<year>:<round>:<kind>:<8char>` IDs to prevent Firestore collision.
- **UI indicators**: Session mode banner ("Session mode — changes saved to this browser only") appears in the wizard header. "Clear session pick edits" button appears in TradeEditor when overlay data exists.
- **Mode transition safety**: Switching from vacuum → world mode automatically clears the overlay via `useEffect`.
- **Immediate UI refresh**: `applyEntitlementOverrideUpdate` now appends new entitlements (not just updates existing ones) so vacuum creates appear immediately.
- **`refreshEntitlements()`**: New function exposed from `useTradeMachine` for re-resolving all active team slots (used by "Clear session pick edits").

### Files created/modified

| File                               | Role                                                                  |
| ---------------------------------- | --------------------------------------------------------------------- |
| `vacuumEntitlementOverlayStore.ts` | localStorage store: load, save, edit, create, clear, ID generation    |
| `entitlementResolver.ts`           | Merge seam injection: `if (!worldId)` → apply overlay edits + creates |
| `TradeEditor.jsx`                  | Gate relaxation, Clear button, mode transition cleanup                |
| `PickRightWizardModal.tsx`         | Vacuum apply path, session banner, nullable worldId/userId            |
| `useTradeMachine.js`               | Append logic for creates, `refreshEntitlements()`                     |

### Test coverage

| Test file                                   | Count | Coverage                                                        |
| ------------------------------------------- | ----- | --------------------------------------------------------------- |
| `vacuumEntitlementOverlayStore.test.ts`     | 26    | Store CRUD, ID format, round-trip, edge cases                   |
| `entitlementResolver.vacuumOverlay.test.ts` | 6     | Merge seam: edit, create, combined, world isolation             |
| `pickRightWizard.vacuumApply.test.tsx`      | 11    | Banner, create/edit/re-edit apply, world mode unchanged, drafts |

---

## 7. Limitations

- No syncing across devices or browser tabs — overlay is single-browser, single-tab.
- No undo/redo for individual edits — only bulk "Clear session pick edits".
- Overlay survives browser close (localStorage) but is not backed up.
- No visual distinction between edited base entitlements and unmodified ones in the entitlements list (beyond the overlay being applied).
- Vacuum creates are appended to end of list — no custom ordering.
- No export/import of overlay data.

---

## 8. Future Work (Optional)

- **Visual indicators**: Badge or highlight on vacuum-edited rows so users can tell which entitlements have been modified.
- **Per-team clear**: Allow clearing overlay for a single team rather than all teams.
- **Overlay export/import**: Let users save overlay as JSON and reload it (persist across sessions more explicitly).
- **Tab sync**: Use `storage` event listener to sync overlay across browser tabs.
- **Undo stack**: Track individual edit/create operations for undo capability.
