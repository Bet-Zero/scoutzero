# STEP 2 — World Selection Lifecycle and Persistence Truth

## Scope

League / World Time / As-Of — Step 2: World Selection Lifecycle and Persistence Truth

**Date:** 2026-04-02  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the full world-selection lifecycle to determine whether world creation, restore, switching, and selection persistence are correct and trustworthy.

Main questions:

- whether active world selection is structurally clean and authoritative
- whether localStorage restore/persist behavior is correct
- whether world create / branch / rename / archive / delete all route through one clear persistence owner
- whether any stale, duplicate, fallback, or weak world-selection paths still exist
- whether the user-facing world selection lifecycle tells one coherent truth overall

---

## Executive Verdict

**RISK**

The world-selection lifecycle is mostly correct and coherent, but it still has enough duplicate/alternate persistence seams to keep the right verdict at **RISK**.

The strongest parts of the lifecycle are now structurally clean:

- active selection ownership is centered in `useArchitectState.ts`
- the selector reads as a control surface rather than a state owner
- create / branch / rename / full delete all have real persistence ownership in `worldManager.ts`

The remaining issues are:

- the archive UI bypasses the more explicit `archiveWorld(...)` owner helper and calls `updateWorldMetadata(...)` directly
- a deprecated legacy delete path (`deleteWorld(...)`) still exists alongside the real full-delete path (`purgeWorld(...)`)
- `listUserWorlds(...)` still has both a primary query path and a fallback manual-iteration path

Those seams are not active breakage, but they are enough to prevent a clean PASS.

---

## World Selection Lifecycle Map

### 1. Active world state owner

After Step 1, the active world state itself lives in `useArchitectState.ts`, not in the selector widget.

The hook owns:

- `activeWorldOwner`
- restore of stored world id
- persistence/removal of active world id
- invalid-world cleanup
- active world transitions through `setActiveWorld(...)`

That means the selector is no longer the real owner of the active world lifecycle.

### 2. User-facing control surface

`WorldSelector.tsx` is now the UI/control surface for:

- selecting a world
- creating a world
- branching a world
- renaming a world
- archiving a world
- deleting a world
- surfacing errors / modals / action menu state

It consumes the owner contract from above rather than owning selection persistence locally.

### 3. Real persistence owner

`worldManager.ts` is the real persistence owner for world lifecycle operations:

- `createWorld(...)`
- `getWorldMetadata(...)`
- `listUserWorlds(...)`
- `updateWorldMetadata(...)`
- `archiveWorld(...)`
- `deleteWorld(...)` (legacy metadata-only delete)
- `purgeWorld(...)` (full recursive deletion through Cloud Function)
- `branchWorld(...)`

So the full chain now reads:

**state owner (`useArchitectState`) → UI control surface (`WorldSelector`) → persistence owner (`worldManager`)**

That is a much cleaner lifecycle story.

---

## Restore / Persist / Create / Branch / Rename / Archive / Delete Analysis

### Active world restore/persist

This is now structurally clean.

The restore/persist lifecycle used to live in `WorldSelector.tsx`, but the Step 1 work moved it into `useArchitectState.ts`, where it belongs. The hook now owns:

- localStorage restore-once
- clearing invalid stored worlds
- persisting/removing active world selection
- the public `activeWorldOwner` contract consumed by the dashboard and selector

That is the correct shape for active selection truth.

### Create world

`WorldSelector.tsx` handles the modal and user flow, but `createWorld(...)` in `worldManager.ts` owns the real persistence behavior:

- validates `userId`
- validates name
- generates world id
- writes metadata
- initializes stats/default fields
- links parent if branching

This is clean.

### Branch world

Also clean.

UI flow lives in `WorldSelector.tsx`, while `branchWorld(...)` in `worldManager.ts`:

- fetches parent metadata
- inherits season
- routes into `createWorld(...)` with `parentWorldId`

### Rename world

Structurally clean:

- UI modal in `WorldSelector.tsx`
- actual persistence through `updateWorldMetadata(...)` in `worldManager.ts`

### Archive world

Mostly clean, but with one small quirk:

- `WorldSelector.tsx` currently calls `updateWorldMetadata(worldId, { isArchived: true })` directly from the UI flow instead of calling `archiveWorld(...)`
- `worldManager.ts` does provide a dedicated `archiveWorld(...)` helper that includes a permission check, but the selector is not using it

That means the intended persistence owner exists, but the UI bypasses the more explicit archive helper.

### Delete world

There are **two delete paths**, and that is the biggest structural risk in the lifecycle:

- `deleteWorld(...)` in `worldManager.ts` is marked **legacy** and deletes only metadata, leaving orphaned subcollections behind
- `purgeWorld(...)` is the real full-delete path via Cloud Function and is what `WorldSelector.tsx` actually uses in `handleDeleteWorld(...)`

So the live UI is doing the right thing, but the module still exposes a weaker legacy deletion path.

---

## Misleading, Duplicated, or Weakly Owned Selection Paths

### What is clean

- active world restore/persist is now centered in the state hook, not the widget
- CRUD-style world operations are clearly persistence-owned by `worldManager.ts`
- the selector now reads more like a proper control surface than a state owner

### Real weakness 1: archive helper exists but is bypassed

The UI archives by directly calling `updateWorldMetadata(..., { isArchived: true })` instead of routing through the dedicated `archiveWorld(...)` helper. That weakens the “one clear owner path per action” story a little.

### Real weakness 2: legacy delete path still exists

`deleteWorld(...)` is explicitly deprecated and weaker than `purgeWorld(...)`, but it still exists in the persistence module. That creates a real duplicate/legacy path risk even though the UI currently uses the correct one.

### Real weakness 3: list fallback is legitimate but still a fallback seam

`listUserWorlds(...)` has a real query path and an in-memory fallback path if Firestore indexing/querying fails. That is understandable and probably necessary, but it is still a dual-path lifecycle seam.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- active selection ownership is now structurally much cleaner
- create/branch/rename/delete all have real persistence ownership
- the live UI uses the correct full-delete path (`purgeWorld`) rather than the weaker legacy delete path
- localStorage restore/persist behavior no longer looks widget-owned

### Why this is not PASS

- archive UI bypasses the more explicit `archiveWorld(...)` owner helper
- deprecated `deleteWorld(...)` still exists alongside `purgeWorld(...)`
- `listUserWorlds(...)` still has a primary query path plus a fallback manual iteration path

---

## Files Reviewed

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/components/WorldSelector.tsx`
- `src/features/architect/utils/worldManager.ts`

---

## Final Conclusion

The world-selection lifecycle is mostly correct and coherent, but it still contains enough duplicate/alternate persistence seams to keep the right Step 2 verdict at:

**RISK**
