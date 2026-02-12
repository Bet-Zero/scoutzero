# Trade Machine — Vacuum Mode Master Document

> **Document ID:** TRADE_MACHINE_VACUUM_MODE_MASTER  
> **Created:** 2026-02-12  
> **Status:** EXECUTION COMPLETE — TM-VACUUM-E3 + TM-UI-COPY-E1  
> **Ticket:** TM-VACUUM-P1, TM-UI-COPY-E1

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

| Date       | Change                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-12 | Initial preflight — architecture chosen (Option A), evidence collected.                                                                         |
| 2026-02-12 | TM-VACUUM-E1 execution complete. All 6 tasks implemented, 43 new tests passing.                                                                 |
| 2026-02-12 | TM-VACUUM-E2 execution complete. Added edit guardrails, per-item vacuum controls, and session badges.                                           |
| 2026-02-12 | TM-VACUUM-E3 execution complete. Advanced editor lock parity, duplicate-as-new, vacuum metadata sanitization, auto-validation on revert/delete. |

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

---

## 9. E2 — Pick-Right Guardrails + Per-Item Vacuum Controls

### Scope implemented

- Wizard edit-mode guardrails now lock entitlement identity fields while preserving create-mode flexibility.
- Edit entry via pencil opens directly at **Details** and skips the **Type** step.
- Vacuum mode now supports per-item session actions: revert one base edit or delete one session-only entitlement.
- Entitlement rows now display session badges for vacuum-created and vacuum-edited items.

### Identity fields locked in edit mode (wizard)

In edit mode (`entitlementId` is non-null), the wizard locks fields that define the entitlement's identity:

- Primary pick selector (team/year/round + raw pick ID path)
- Kind/type changes (intent step is skipped and cannot be revisited)
- Swap controller/anchor pick selector
- Conveyance pool pick identity add/remove/edit controls

Helper copy shown in wizard details:

- `Owner (changes when traded)`
- `To change the pick itself or type, create a new pick right.`

This reduces accidental identity mutation while keeping non-identity edits available (e.g., description and right-specific details not used as anchors).

### Per-item vacuum controls

Overlay store API expanded with per-item removal operations:

- `removeEdit(teamCode, entitlementId)`
- `removeCreate(teamCode, vacuumId)`

These are surfaced in vacuum mode through two pathways:

- Wizard edit footer actions:
  - `Revert this edit` for base entitlements currently patched in overlay
  - `Delete this session pick right` for `vacuum:` entitlements
- Entitlement row quick actions with matching labels (vacuum tab list)

After either action, the UI calls existing `refreshEntitlements()` to re-resolve through the single resolver seam so display + validation stay in sync.

### Badge semantics in entitlement list

- `Session-only` badge: entitlement ID is `vacuum:*` / session-created overlay entry
- `Edited (session)` badge: base entitlement has an active overlay patch

Resolver seam now tags merged rows in vacuum mode:

- `__vacuumSessionOnly: true` for overlay creates
- `__vacuumEdited: true` for overlay edits

World mode behavior remains unchanged because overlay merge/flags still only run when `worldId` is null.

---

## 10. E3 — Advanced Editor Lock, Duplicate-as-New, Sanitization, Auto-Validation

### Scope implemented

- Advanced (JSON) editor tab now enforces the same identity-field locks as the form-based wizard when in edit mode.
- "Duplicate as new pick right" button added to the wizard for safe identity mutations.
- Vacuum resolver metadata (`__vacuumEdited`, `__vacuumSessionOnly`) is stripped at all exit points: trade decorator, export capture, and Firestore writer.
- Per-item revert and delete operations now automatically re-run trade validation.

### A) Advanced Editor lock parity

The Advanced tab (`EntitlementEditorAdvancedTab.tsx`) accepts raw JSON editing, which previously could bypass the wizard's identity-field locks. In edit mode:

- `IDENTITY_FIELDS` constant defines the locked set: `holderTeam`, `kind`, `seasonYear`, `round`, `underlyingPickId`, `swapControllerPickId`.
- On "Apply JSON", the parsed object is compared against the current form state for each identity field.
- If any identity field was changed, the original values are restored and an amber inline warning is shown: _"Identity fields (holderTeam, kind, …) cannot be changed in edit mode. Those fields have been restored. To change them, use 'Duplicate as new pick right'."_
- Non-identity fields (description, protections, etc.) are applied normally.
- `isEditMode` prop threaded from `EntitlementEditorModal` → `EntitlementEditorFormTabs` → `EntitlementEditorAdvancedTab`.

### B) Duplicate as new pick right

`PickRightWizardModal.tsx` now accepts an `onDuplicateAsNew` callback prop. When provided and in edit mode:

- A "Duplicate as new pick right" button (with `data-testid="wizard-duplicate-as-new"`) renders in the wizard footer.
- Clicking it builds the full entitlement document from current form state, strips the `id` field, and passes it to the parent callback.
- `TradeEditor.jsx` wires this to close the current editor and reopen in create mode with the document pre-filled via `setEntitlementEditorState({ entitlementId: null, initialDocument: document })`.

This provides a safe pathway for users who need to change identity fields: duplicate → modify identity → save as new.

### C) Vacuum metadata sanitization

Resolver merge tags (`__vacuumEdited`, `__vacuumSessionOnly`) are internal bookkeeping that must never leak to payloads, exports, or Firestore writes.

Three sanitization points implemented:

| Exit point       | File                     | Method                                                   |
| ---------------- | ------------------------ | -------------------------------------------------------- |
| Trade decorator  | `entitlementTerms.ts`    | Destructure out both keys before spread                  |
| Export capture   | `TradeExportCapture.jsx` | `sanitizeEntitlement()` wrapper on incoming entitlements |
| Firestore writer | `entitlementWriter.ts`   | `deleteField()` for both keys in `setDoc` payload        |

Utility functions in new `sanitizeVacuumMetadata.ts`:

- `sanitizeEntitlement(doc)` — returns cleaned copy (same ref if no keys present).
- `sanitizeEntitlements(docs)` — array variant.
- `hasVacuumMetadata(doc)` — boolean assertion helper.

### D) Auto-validation after revert/delete

`TradeEditor.jsx` now calls `handleValidate()` immediately after `refreshEntitlements()` in both:

- `handleRevertEntitlementEdit` — revert a base entitlement's overlay patch.
- `handleDeleteSessionEntitlement` — delete a vacuum-created entitlement.

This ensures the validation panel reflects the current entitlement state without requiring the user to manually re-trigger validation.

### Files created/modified

| File                               | Change                                                |
| ---------------------------------- | ----------------------------------------------------- |
| `EntitlementEditorAdvancedTab.tsx` | Identity field interception + warning in edit mode    |
| `EntitlementEditorFormTabs.tsx`    | Thread `isEditMode` prop                              |
| `EntitlementEditorModal.tsx`       | Pass `isEditMode={!!entitlementId}`                   |
| `PickRightWizardModal.tsx`         | `onDuplicateAsNew` callback + button                  |
| `TradeEditor.jsx`                  | Wire duplicate-as-new, auto-validate on revert/delete |
| `sanitizeVacuumMetadata.ts`        | **NEW** — sanitization utility                        |
| `entitlementTerms.ts`              | Destructure out vacuum keys in decorator              |
| `TradeExportCapture.jsx`           | Sanitize entitlements in export                       |
| `entitlementWriter.ts`             | `deleteField()` vacuum keys on Firestore write        |

### Test coverage

| Test file                              | Count | Coverage                                                                |
| -------------------------------------- | ----- | ----------------------------------------------------------------------- |
| `vacuumE3.advancedEditorLock.test.tsx` | 5     | Identity field interception, warning display, non-identity pass-through |
| `vacuumE3.duplicateAsNew.test.tsx`     | 5     | Button visibility, callback invocation, ID stripping                    |
| `vacuumE3.sanitization.test.ts`        | 11    | Single/array sanitization, no-op optimization, hasVacuumMetadata        |
| `vacuumE3.decorateEntitlement.test.ts` | 5     | Decorator strips vacuum keys, preserves all other fields                |
| `vacuumE3.autoValidation.test.ts`      | 6     | handleValidate called after revert and delete operations                |

### User expectations: vacuum vs world

- **Vacuum mode** (`worldId = null`): edits/creates/removals are local session-only, per-item controls are available, badges indicate session state.
- **World mode** (`worldId != null`): no vacuum controls, no vacuum badges, no overlay merge impact; entitlement authoring stays on existing world write path.

---

## 9. User-Facing Copy (TM-UI-COPY-E1)

### Principle

The internal engineering term **"vacuum mode"** is never surfaced in user-facing UI. All variable names, metadata keys (`__vacuumEdited`, `__vacuumSessionOnly`), localStorage keys (`vacuum_entitlement_overlay`), and ID prefixes (`vacuum:`) remain unchanged internally but are invisible to users.

### User-visible language

| Context                            | Copy                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| Base-mode banner (no world)        | "Not saved to a world — changes are stored in this browser only." |
| World selector label               | "Architect (optional)"                                            |
| World selector helper (no world)   | "Select a world to save changes. No world = quick sandbox."       |
| Badge: session-created entitlement | "Session-only"                                                    |
| Badge: edited base entitlement     | "Edited (this session)"                                           |
| Clear button label                 | "Clear session pick changes"                                      |
| Toast: overlay cleared             | "Session pick changes cleared"                                    |
| Toast: session save                | "Saved (this session only)"                                       |
| Toast: edit reverted               | "Session edit reverted"                                           |
| Toast: session pick deleted        | "Session pick right deleted"                                      |

### Conceptual mapping

- **No world selected** = GM Tools / Quick Trade — sandbox, not persisted
- **World selected** = Architect World — saved to Firestore

### Test guard

`src/tests/architect/noVacuumWording.test.ts` scans key UI source files and fails if "vacuum" appears in any user-visible rendered text (JSX text nodes, titles, toasts). Internal identifiers and comments are allowed.
