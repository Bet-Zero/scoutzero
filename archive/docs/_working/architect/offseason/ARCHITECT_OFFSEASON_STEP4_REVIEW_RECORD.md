# STEP 4 — Draft Positions Input and Persistence Truth

## Scope

Offseason — Step 4: Draft Positions Input and Persistence Truth

**Date:** 2026-04-02  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the Offseason `DraftPositionsInput` system to determine whether draft-position input, validation, save/load behavior, and downstream truth are correct.

Main questions:

- whether draft-position input is structurally clean and authoritative
- whether world/year selection, load, save, and validation behavior are correct
- whether draft-position persistence truth is clearly owned
- whether this input path could mislead the user about what data is actually saved or used
- whether any duplicate, fallback, or weaker persistence paths still exist
- whether draft positions tell one coherent Offseason input/persistence story overall

---

## Executive Verdict

**RISK**

Draft positions tell a mostly coherent Offseason input/persistence story: one UI owner, one persistence owner, and one real downstream consumer in world-backed season advancement.

But the seam still has a meaningful UX/truth gap:

- **Reset to Template** only resets the local editor contents
- it does **not** clear persisted draft positions for that year
- `clearDraftPositions(...)` exists at the persistence layer but is not exposed in the UI

That means a user can reasonably think they “reset” saved draft positions when they only reset the textarea.

The core persistence and downstream usage are real, so this is not FAIL. But that truth gap keeps the correct verdict at **RISK**.

---

## Draft Positions Input / Persistence Map

### 1. UI owner

`DraftPositionsInput.tsx` is the only real UI surface for this seam. It owns:

- selected draft year
- JSON text editing
- validate button
- save button
- reset-to-template button
- last-saved display
- load/save status messaging

### 2. Wrapper / placement

`OffseasonSection.tsx` renders `DraftPositionsInput` only on the world-backed Offseason surface, and passes:

- `worldId`
- `defaultDraftYear={worldDraftYear ?? viewingYear}`
- `worldSeason`

So this is clearly part of the world-mode Offseason path, not the DEV preview path.

### 3. Persistence owner

Actual persistence truth is owned by `worldManager.ts`, not by the component. The real persistence helpers are:

- `getDraftPositions(...)`
- `getDraftPositionsMap(...)`
- `validateDraftPositionsMap(...)`
- `saveDraftPositions(...)`
- `clearDraftPositions(...)`

### 4. Downstream consumer

The saved positions are actually consumed later by `advanceSeasonInWorld(...)` in `seasonManager.ts`, which calls `getDraftPositionsMap(worldId, draftYear)` and then uses that positions map for conveyance/swap auto-resolution during season advance.

That means the seam is real end-to-end:

UI input → world metadata persistence → season-advance consumption.

---

## Load / Validate / Save / Downstream-Truth Analysis

### Load behavior

Load behavior is mostly correct.

`DraftPositionsInput.tsx`:

- loads whenever `worldId` or `selectedYear` changes
- calls `getDraftPositions(worldId, selectedYear)`
- if data exists, populates the textarea from `positionsMap`
- if no data exists, falls back to the sample template
- records `method` and `updatedAtIso` into `lastSaved`

This is structurally clean.

### Validation behavior

Validation is strong and clearly owned.

`handleValidate()`:

- blocks empty JSON
- blocks parse errors
- calls `validateDraftPositionsMap(...)`
- shows returned validation errors in UI
- refuses save if validation fails

And the persistence layer validator in `worldManager.ts` checks:

- object shape
- non-empty map
- 3-letter uppercase team codes
- integer positions
- valid position range 1–60
- duplicate positions

This part is solid.

### Save behavior

Save behavior is also mostly correct.

`handleSave()`:

- requires `worldId`
- re-runs validation before saving
- parses JSON
- calls `saveDraftPositions(worldId, selectedYear, positionsMap, { method: 'manual' })`
- only shows success if the persistence layer returns success
- updates local `lastSaved` UI state after success

`saveDraftPositions(...)` in `worldManager.ts`:

- validates again at the persistence layer
- writes to `draftPositionsByYear.{draftYear}`
- stores:
  - `positionsMap`
  - `method`
  - `updatedAtIso`
- updates `lastModifiedAt` on world metadata

So save truth is clearly owned by the world manager, not the UI.

### Downstream truth

This is one of the stronger parts of the seam.

`advanceSeasonInWorld(...)`:

- computes the `draftYear`
- calls `getDraftPositionsMap(worldId, draftYear)`
- uses that map in:
  - `resolveDraftPickConveyanceForYear(...)`
  - `resolveDraftPickSwapsForYear(...)`
- explicitly preserves NO-OP behavior when no positions map exists

That means the saved data is not decorative. It is actually used.

---

## Misleading, Duplicated, or Weakly Owned Paths

### What is clean

- one UI owner: `DraftPositionsInput.tsx`
- one persistence owner: `worldManager.ts`
- one downstream season-advance consumer: `advanceSeasonInWorld(...)`
- clear world-only placement in `OffseasonSection.tsx`

### Real weakness 1: reset is only local template reset

The component exposes **Reset to Template**, but that does **not** clear persisted draft positions. It only replaces the textarea contents locally and clears visible errors/messages.

That can mislead a user into thinking they “reset” the saved data when they really only reset the editor contents.

This matters because `worldManager.ts` does have a real persistence-level clearer, `clearDraftPositions(...)`, but the UI does not expose it.

### Real weakness 2: UI says positions affect “the current draft year,” but year source is indirect

The flow is correct, but the UX is slightly indirect:

- the wrapper passes `defaultDraftYear={worldDraftYear ?? viewingYear}`
- the component lets the user choose among 8 years ahead
- the executor later uses `draftYear = fromYear` from world season truth

That is not wrong, but it means the saved year and the actually-consumed year can diverge if the user edits the wrong year. The system is coherent, but the UI could be clearer about which specific saved year will be consumed on the next advance.

### Real weakness 3: last-saved display is partially UI-invented after save

After save success, the component sets:

- `method: 'manual'`
- `updatedAtIso: new Date().toISOString()`

instead of reloading the persisted value from storage.

That is probably fine in practice, but it is still UI-invented success metadata rather than round-tripped committed metadata.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- the ownership story is clear
- validation is strong
- save/load behavior is real
- downstream season-advance consumption is real
- there is no fake or disconnected persistence seam here

### Why this is not PASS

- “Reset to Template” is a **local editor reset**, not a true persistence reset
- `clearDraftPositions(...)` exists but is not exposed in the UI, creating a real UX/truth gap
- the last-saved success metadata is partially UI-invented after save
- the “year that will be used next” story is coherent, but not as explicit as it could be

---

## Files Reviewed

- `src/features/architect/GMDashboard/components/DraftPositionsInput.tsx`
- `src/features/architect/utils/worldManager.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/tests/architect/gmWorldSupportFamily.e103.behavior.test.tsx`

---

## Final Conclusion

Draft positions tell a mostly coherent Offseason input/persistence story: one UI owner, one persistence owner, one real downstream consumer.

But the UI still has a truth gap around reset/clear semantics and a mild saved-year/used-year clarity gap.

The correct Step 4 verdict is:

**RISK**
