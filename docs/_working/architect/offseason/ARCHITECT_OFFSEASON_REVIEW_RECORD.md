# STEP 1 — Offseason Action Ownership and Source of Truth

## Scope

Offseason — Step 1: Action Ownership and Source of Truth

**Date:** 2026-04-01  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine the real ownership model and source of truth for Offseason actions and state.

Main questions:

- what the real source of truth is for Offseason actions and state
- whether world-backed season advancement, draft-position input, and any offseason preview/local paths all route through one clear authoritative owner model
- whether world-only actions and any local/preview behavior are clearly separated
- whether any duplicate, fallback, legacy, or alternate mutation/state paths still exist
- whether Offseason tells one coherent ownership story overall

---

## Executive Verdict

**RISK**

Offseason is not fragmented, but it does **not** yet tell one singular ownership story.

There is a real top-level owner surface in `OffseasonSection.tsx`, and the world-backed season-advance path is clearly anchored in `SeasonAdvanceModal.tsx` → `advanceSeasonInWorld(...)` in `seasonManager.ts`.

But Offseason still has **two materially different execution models**:

- a **world-backed authoritative path** for real season advancement
- a **DEV-gated local preview path** through `OffseasonTab` and `runOffseason(...)` that is explicitly non-persisting

That split is intentional, but it means Offseason does **not** yet have one clean “one feature, one owner, one execution model” story.

---

## Ownership / Source-of-Truth Map

### 1. Dashboard wrapper / top-level routing owner

`OffseasonSection.tsx` is the main Offseason dashboard surface.

It owns:

- showing the world-backed season-advance block
- launching `SeasonAdvanceModal`
- rendering `DraftPositionsInput`
- exposing the DEV preview path through `OffseasonTab`
- tracking `worldSeason`
- comparing `worldSeason` vs viewing year
- handling `onAdvanceComplete` post-success UI state updates

This makes `OffseasonSection.tsx` the **top-level Offseason orchestration owner**, but **not** the sole mutation owner.

### 2. Shared dashboard/world state owner

`useArchitectState.ts` owns the dashboard state Offseason depends on:

- `teamCapSheet`
- `currentYear`
- `lastCapSheet`
- `offseasonRun`
- `offseasonSummary`
- `worldId`
- `worldAsOfDate`
- `refreshWorldRosterIndex`
- world-aware team loading via `loadWorldTeamData(...)`

So Offseason does **not** own its own full state model locally.
It depends on the broader Architect dashboard state owner.

### 3. World-backed season-advance action owner

`SeasonAdvanceModal.tsx` is the main visible action surface for real season advancement.

It owns:

- wizard steps
- option-decision collection
- confirmation flow
- dispatching `advanceSeasonInWorld(...)`
- packaging result data for `onAdvanceComplete(...)`

But the actual authoritative season-advance execution is owned by `advanceSeasonInWorld(...)` in `seasonManager.ts`, which:

- reads world metadata
- derives the season transition
- loads all teams
- processes transitions for the league
- updates world metadata
- commits world changes in batch

So the real authoritative world-backed Offseason mutation owner is:

- **UI/action entry:** `SeasonAdvanceModal.tsx`
- **authoritative execution:** `seasonManager.ts`

### 4. Draft positions persistence owner

`DraftPositionsInput.tsx` is a separate persisted-input system inside Offseason.

It owns:

- year selection
- JSON editing
- validation UI
- load/save/reset interactions

But persistence truth is actually owned by `worldManager.ts`, which provides:

- `getDraftPositions(...)`
- `getDraftPositionsMap(...)`
- `validateDraftPositionsMap(...)`
- `saveDraftPositions(...)`
- `clearDraftPositions(...)`
- `getWorldMetadata(...)`

So Draft Positions is a second real Offseason sub-system with its own ownership seam:

- **UI/input owner:** `DraftPositionsInput.tsx`
- **persistence owner:** `worldManager.ts`

### 5. DEV / local preview owner

`OffseasonTab.tsx` is the DEV-gated single-team preview path.

It owns:

- local option confirmation flow
- calling `runOffseason(...)`
- setting preview cap sheet state
- advancing `currentYear`
- setting offseason summary/modal state locally
- explicitly warning that preview is not saved

This is a **second Offseason execution model**, clearly separate from world-backed advancement.

---

## Duplicate, Legacy, Preview, or Alternate Paths

### 1. Two real execution models

This is the biggest ownership cleanliness issue.

#### World-backed authoritative path

- `OffseasonSection.tsx`
- `SeasonAdvanceModal.tsx`
- `advanceSeasonInWorld(...)` in `seasonManager.ts`

#### DEV/local preview path

- `OffseasonSection.tsx`
- `OffseasonTab.tsx`
- `runOffseason(...)` preview path

That is not hidden duplication, but it is definitely an **alternate path**.

### 2. Wrapper-level state patching after authoritative success

`OffseasonSection.tsx` does not just launch the world action.
It also applies post-success state locally:

- updates `currentYear`
- updates `worldSeason`
- sets `offseasonRun`
- sets `offseasonSummary`
- opens offseason modal
- optionally triggers reload callback

That means the authoritative world mutation and the dashboard-visible aftermath are split across:

- `seasonManager.ts`
- `SeasonAdvanceModal.tsx`
- `OffseasonSection.tsx`

### 3. Draft positions are separate from season advancement

Draft positions live in the same Offseason tab, but they are not owned by the same execution seam as season advancement.

They persist through `worldManager.ts`, and season advancement later reads positions through world metadata / draft positions helpers.

That is coherent, but still a separate action/persistence owner model.

### 4. Preview/local behavior is clearly labeled, but still a real branch

The DEV preview path is not hidden.
`OffseasonSection.tsx` explicitly labels it preview-only and non-persisting, and `OffseasonTab.tsx` repeats that message after preview runs.

So it is not misleading legacy behavior.
But it is still a structurally separate Offseason branch.

---

## World-Only vs Local/Preview Separation

### What is clean

- Real season advancement is clearly world-backed:
  - `worldId` is required in `SeasonAdvanceModal.tsx`
  - `advanceSeasonInWorld(...)` is the authoritative world execution path
- Draft positions input is also clearly world-bound:
  - `DraftPositionsInput` requires `worldId`
  - it loads/saves through world metadata in `worldManager.ts`
- DEV preview is clearly marked as:
  - DEV-only
  - localStorage-gated
  - non-persisting
  - preview-only

### What is still weaker than ideal

The separation is visible, but not fully ownership-clean because all of this still sits inside one tab wrapper and one broader dashboard state model.

So the boundary is understandable, but still structurally mixed enough to keep the verdict at RISK.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- there is a real top-level orchestration owner in `OffseasonSection.tsx`
- the world-backed season-advance path is clearly real and authoritative
- draft positions persistence is explicitly owned and world-backed
- the DEV preview path is clearly labeled and intentionally separated, not hidden

### Why this is not PASS

- Offseason does **not** yet have one singular ownership/execution model
- season advancement, draft-position persistence, and DEV preview are three distinct Offseason sub-systems
- wrapper-level state updates after advancement are still split from authoritative execution
- the feature depends heavily on shared dashboard/world state from `useArchitectState.ts` rather than a tighter dedicated Offseason state contract

---

## Final Conclusion

Offseason has a real authoritative world-backed advancement path, a real persisted draft-input path, and a clearly marked DEV preview path — but those are still multiple distinct ownership/execution seams inside one feature.

The correct Step 1 verdict is:

**RISK**
