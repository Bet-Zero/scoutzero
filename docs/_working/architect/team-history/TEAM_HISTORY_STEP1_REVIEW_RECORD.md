# TEAM HISTORY — STEP 1 REVIEW RECORD

## Scope

Team History — Step 1: Top-Level Ownership, Composition, and Source-Selection Truth

**Date:** 2026-04-03  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review Team History at the top-level feature/composition layer to determine whether its ownership model, dashboard handoff, and source-selection behavior are structurally clean and truthful.

Main questions:

- whether Team History has one coherent top-level ownership story
- whether `HistorySection.tsx` is just a thin handoff or accidentally owns feature truth
- whether `TeamHistoryTab` is the true composition/control surface for Team History
- whether world vs base vs fixture source-selection behavior is structurally clean
- whether the feature’s top-level mode selection can create misleading or conflicting history truth
- whether Team History’s major sub-surfaces are wired together coherently

---

## Executive Verdict

**RISK**

Team History has a mostly understandable top-level structure, but the ownership/composition story is not yet fully clean.

The strongest clean parts:

- `HistorySection.tsx` is a thin dashboard handoff wrapper, not a hidden second feature owner
- `GMDashboard.tsx` wires Team History like a normal dashboard tab and passes only the expected feature inputs
- `TeamHistoryTab.tsx` is clearly the real Team History composition surface
- the major Team History sub-surfaces are wired together coherently inside the tab

The risk comes from the feature’s top-level truth model:

- Team History can render from a world-event timeline
- or explicit local `historyTimeline`
- or a section-derived synthesized timeline
- or a DEV fixture-injected override path

That is not automatically wrong, but it means the feature currently has too many top-level truth modes for one history surface without a stronger explicit source-of-truth contract.

The top-level scope banner helps, but it still under-describes the real source-selection logic. In particular, fixture injection can suppress the world-event timeline even when `worldId` exists.

Because of that, the correct Step 1 verdict is **RISK**, not PASS.

---

## Team History Top-Level Feature Map

### 1. Dashboard handoff seam

`GMDashboard.tsx` selects the `history` tab and renders `HistorySection`, passing:

- `teamCapSheet`
- `worldId`
- `onInjectTeamHistoryFixtures`
- `onClearTeamHistoryFixtures`
- `hasInjectedTeamHistoryFixtures`

`HistorySection.tsx` then forwards those props directly into `TeamHistoryTab` without adding local feature state or alternate ownership.

### 2. Main composition/control surface

`TeamHistoryTab.tsx` is the actual Team History feature surface.

It owns:

- top-level timeline source selection
- selected-entry modal state
- DEV fixture panel visibility
- world-vs-base timeline branching
- composition of:
  - recent history timeline
  - `WaiveStretchTracker`
  - `ExceptionHistoryTracker`
  - `DraftPickTracker`
  - `HistoryDetailModal`

### 3. Timeline source-selection seam

At the top level, Team History chooses between two broad timeline modes:

- world-event mode when `worldId` exists and fixtures are not injected
- local/fallback mode otherwise

Inside local/fallback mode it then chooses between:

- explicit `teamCapSheet.historyTimeline`
- or a synthesized timeline built from section arrays via `normalizeTimelineFromSections(...)`

### 4. World-event intake seam

When world-event mode is active, `WorldEventsTimeline` uses `useWorldTeamEvents(...)` and then normalizes results through `normalizeWorldEventsForTeamHistory(...)` before rendering rows.

### 5. DEV override seam

When DEV fixtures are enabled, `TeamHistoryTab` shows the fixture panel and disables world-event timeline mode through `shouldUseWorldEventTimeline = Boolean(worldId) && !hasInjectedTeamHistoryFixtures`.

The actual synthetic override logic lives in `devTeamHistoryFixtures.ts`.

---

## Dashboard Handoff / Composition / Source-Selection Analysis

### `HistorySection.tsx` is a thin handoff, not a hidden owner

This part is clean.

`HistorySection.tsx` does not add feature state, persistence logic, or alternate mode branching. It simply passes Team History inputs into `TeamHistoryTab`.

### `TeamHistoryTab.tsx` is the true composition/control surface

This part is also clear.

`TeamHistoryTab.tsx` owns the top-level Team History behavior:

- timeline source selection
- row selection / modal state
- banner + fixture panel rendering
- world timeline vs fallback timeline selection
- composition of the lower trackers

So structurally, yes: `TeamHistoryTab` is the real feature surface.

### World/base/fixture source-selection is understandable but not yet clean enough

This is the main reason for the RISK verdict.

Top-level Team History truth currently depends on this chain:

1. if `worldId` exists and fixtures are not injected -> use world events
2. else if `historyTimeline` exists -> use that
3. else synthesize a timeline from section arrays

That means the same tab can represent Team History through multiple substantially different truth paths, plus a DEV override that disables the world path entirely.

That is workable, but not yet a strong top-level truth story.

### The scope banner helps, but does not fully explain the real active source

`TeamHistoryTab` renders a scope banner:

- `World mode: ${worldId}`
- `Base mode`

This is helpful, but it does not explicitly tell the user which timeline source is active:

- world events
- explicit local timeline
- synthesized timeline
- fixtures

So the feature has some mode signaling, but not enough to make the top-level source-selection fully transparent.

### Major sub-surfaces are wired coherently

Within the tab itself, the lower sub-surfaces are wired consistently:

- timeline at the top
- waive history section
- exception history section
- draft history section
- detail modal for selected entries

So this is not a chaotic composition problem. The core issue is the top-level truth-source clarity.

---

## Any Misleading, Duplicate, or Weakly Owned Top-Level Seams

### 1. Multiple top-level truth sources without one explicit source-of-truth contract

This is the biggest issue.

At the composition layer, Team History can mean:

- authoritative world event history
- explicit stored timeline history
- synthesized timeline from section arrays
- synthetic fixture history

That is too much mode variance to call fully clean at Step 1.

### 2. Fixture mode can suppress world timeline truth at the top level

This is likely intentional for DEV, but it is still a major top-level seam.

`shouldUseWorldEventTimeline` is disabled whenever fixtures are injected, even if `worldId` exists.

That means the most authoritative-looking world path is not merely supplemented by fixtures — it is replaced by the local/fixture path.

### 3. The scope banner is simpler than the actual source-selection truth

The UI says “World mode” or “Base mode,” but the real top-level source decision is more complicated. For example, “World mode” with injected fixtures does not actually use the world-event timeline path.

### 4. Team History partly composes other tracker surfaces

`TeamHistoryTab` composes:

- `WaiveStretchTracker`
- `ExceptionHistoryTracker`
- `DraftPickTracker`

That is not bad by itself, but it means Team History is partly a dedicated feature and partly a composed summary surface of other subsystems. That increases the need for a strong top-level ownership and source-selection contract.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- `HistorySection.tsx` is thin and clean
- `GMDashboard.tsx` wiring is straightforward
- `TeamHistoryTab.tsx` is clearly the main feature surface
- the feature is understandable enough to review in structured steps

### Why this is not PASS

- the feature has too many top-level source paths for one history surface
- world/base/fixture source selection is not yet explicit enough as a truth contract
- the banner/mode language is weaker than the real source-selection logic
- fixture injection can replace the world-event path at the top level, which is too important to wave through as already clean

---

## Files Reviewed

- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/sections/HistorySection.tsx`
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`
- `src/features/architect/history/hooks/useWorldTeamEvents.ts`
- `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts`
- `src/features/architect/history/devTeamHistoryFixtures.ts`

---

## Exact File + Function Anchors

### `src/features/architect/GMDashboard/sections/HistorySection.tsx`

- `HistorySection`
- direct pass-through into `TeamHistoryTab`

### `src/features/architect/GMDashboard/GMDashboard.tsx`

- `activeTab === 'history'` render path
- `HistorySection` prop wiring
- Team History fixture controls sourced from dashboard actions

### `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`

- `normalizeTimelineFromSections(...)`
- `WorldEventsTimeline`
- `shouldUseWorldEventTimeline`
- `sortedTimeline`
- `showDevFixturePanel`
- `worldScopeLabel`
- main Team History section composition

### `src/features/architect/history/hooks/useWorldTeamEvents.ts`

- `useWorldTeamEvents(...)`
- world-event query ownership for world mode

### `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts`

- `normalizeWorldEventsForTeamHistory(...)`
- world-event -> display row normalization used by world mode

### `src/features/architect/history/devTeamHistoryFixtures.ts`

- `injectTeamHistoryFixtures(...)`
- `clearTeamHistoryFixtures(...)`
- `hasInjectedTeamHistoryFixtures(...)`
- fixture marker / synthetic override path

---

## Final Conclusion

Team History has a clear enough feature shell to proceed, but Step 1 should land as **RISK**, mainly because the top-level source-selection / mode-truth story is not yet strong enough to call clean.
