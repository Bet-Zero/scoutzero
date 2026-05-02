# STEP 1 — League / World Time / As-Of Ownership and Source of Truth

## Scope

League / World Time / As-Of — Step 1: Ownership and Source of Truth

**Date:** 2026-04-02  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the League / World Time / As-Of system to determine the real ownership model and source of truth for world selection, world date, and time-context-driven behavior across Architect.

Main questions:

- the real source of truth for world selection and as-of/time state
- whether world selection, world date control, and downstream feature state all route through one clear authoritative owner model
- whether world-scoped and non-world-scoped behavior are clearly separated
- whether any duplicate, fallback, legacy, or alternate world/time state paths still exist
- whether League / World Time / As-Of tells one coherent ownership story overall

---

## Executive Verdict

**RISK**

The system is coherent, but not yet maximally clean from an ownership standpoint.

There is a real central state owner in `useArchitectState.ts`, and the top-level orchestration in `GMDashboard.tsx` is straightforward. But two important seams are still split across control surfaces instead of being fully centralized:

- active world restore/persist logic lives in `WorldSelector.tsx` rather than entirely in the central state layer
- world date mutation is performed directly by `WorldTimeControls.tsx` rather than through a clearly centralized action owner

The world-vs-no-world boundary is understandable, but it is still distributed across multiple layers rather than expressed through one explicit policy seam.

That keeps the correct Step 1 verdict at **RISK**.

---

## World / Time Ownership / Source-of-Truth Map

### 1. Top-level orchestration owner

`GMDashboard.tsx` is the top-level orchestration surface for League / World Time / As-Of behavior.

It:

- gets `worldId`, `worldAsOfDate`, `setWorldId`, `setWorldAsOfDate`, and `reloadActiveWorldTeamData` from `useArchitectState(...)`
- renders `WorldSelector` only when a user exists
- renders `WorldTimeControls` only when both `userId` and `worldId` exist
- passes the state-hook setters directly into those control surfaces

So `GMDashboard.tsx` is the UI orchestration owner, not the real state owner.

### 2. Real state owner

`useArchitectState.ts` is the real source of truth for world/time state inside Architect.

It owns:

- `worldId`
- `worldAsOfDate`
- `worldRosterIndex`
- `worldPlayerOverrides`
- `refreshWorldRosterIndex()`
- `reloadActiveWorldTeamData()`

It also owns the world-aware data loading effect:

- calls `loadWorldTeamData(worldId, teamId)`
- loads world metadata through `getWorldMetadata(worldId)`
- stores `worldAsOfDate`
- refreshes world roster index on world changes

That makes `useArchitectState.ts` the actual state and reload owner.

### 3. World selection surface

`WorldSelector.tsx` is the user-facing selection lifecycle surface.

It owns:

- listing worlds
- create / branch / rename / archive / delete UI
- localStorage restore/persist of active `worldId`
- clearing an invalid stored world id if it no longer exists

But it does **not** own the active world state itself. It receives `worldId` and `setWorldId` from above and routes persistence operations through `worldManager` helpers. So it is a control surface, not the authoritative owner.

### 4. World date / as-of surface

`WorldTimeControls.tsx` is the user-facing as-of date mutation surface.

It:

- renders only if `worldId` exists
- uses `updateWorldMetadata(worldId, { asOfDate })`
- updates UI state only through injected `setAsOfDate(...)`
- exposes both direct date input and `+1 Day` through the same mutation owner `updateWorldMetadata(...)`

Again, this is a control surface, not the actual owner of world date state.

---

## Ownership Cleanliness Analysis

### What is coherent

The ownership story is mostly clean:

- **UI orchestration:** `GMDashboard.tsx`
- **state + reload truth:** `useArchitectState.ts`
- **world selection controls:** `WorldSelector.tsx`
- **world date controls:** `WorldTimeControls.tsx`

That is a sensible split.

### What is less clean

#### 1. World selection persistence is partly in the control surface

`WorldSelector.tsx` handles localStorage restore and persistence of active `worldId` itself, not the state hook. That means part of “active world truth” lives in the selector surface instead of fully in the central state layer.

That is not broken, but it is a split ownership seam.

#### 2. World date mutation is direct-from-control, not mediated by the state hook

`WorldTimeControls.tsx` calls `updateWorldMetadata(...)` directly and then pushes the result back up through `setAsOfDate(...)`. The state hook does not own the mutation path the way it owns reload and world-aware team loading.

That means the system has:

- central state ownership for stored date value
- but a widget-local mutation path for changing it

That is coherent enough, but still a split seam.

#### 3. World vs no-world behavior is clear but distributed

The no-world boundary is understandable:

- `WorldSelector` explicitly offers “No World Selected” and labels it “quick sandbox”
- `WorldTimeControls` disappears when no `worldId` exists
- `useArchitectState` falls back to base-team loading when `worldId` is null

But the boundary is enforced across multiple layers rather than through one named policy surface.

---

## Duplicate, Fallback, Legacy, or Alternate Paths

### Fallback paths that do exist

These are real and intentional:

- base-team load when `worldId` is null via `loadWorldTeamData(worldId, teamId)` fallback behavior in the state hook
- localStorage restore for `worldId` inside `WorldSelector.tsx`
- system-date display fallback in `WorldTimeControls.tsx` when `asOfDate` is missing

### Alternate paths that still exist

- active world selection is both:
  - a central state value in `useArchitectState`
  - a locally restored/persisted value in `WorldSelector`
- world date is both:
  - a state-hook value
  - a widget-owned metadata mutation path

I do **not** see a dead legacy path here, but I do see ownership split across the state hook and control surfaces.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- there is a real central state owner
- world-aware loading/reload clearly routes through `useArchitectState`
- top-level dashboard wiring is straightforward
- selection and date controls are not inventing fake state; they route into real persistence/state surfaces

### Why this is not PASS

- world selection restore/persist logic lives in `WorldSelector` instead of fully in the central state layer
- world date mutation is performed directly by `WorldTimeControls` instead of through a clearly centralized action owner
- the world-vs-no-world boundary is coherent, but still somewhat distributed rather than expressed through one clean policy seam

---

## Files Reviewed

- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/components/WorldSelector.tsx`
- `src/features/architect/GMDashboard/components/WorldTimeControls.tsx`

---

## Final Conclusion

The League / World Time / As-Of system is coherent, but its ownership is still not maximally centralized.

The real state owner exists, but active world restore/persist and world-date mutation are still partly owned by the control surfaces instead of flowing entirely through one central state/action seam.

The correct Step 1 verdict is:

**RISK**
