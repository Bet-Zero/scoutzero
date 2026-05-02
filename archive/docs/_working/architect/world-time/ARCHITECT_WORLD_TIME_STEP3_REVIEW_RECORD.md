# STEP 3 — World Date / As-Of Control and Persistence Truth

## Scope

League / World Time / As-Of — Step 3: World Date / As-Of Control and Persistence Truth

**Date:** 2026-04-03  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the full world date / as-of control flow to determine whether the user-facing date controls, metadata persistence, and visible date truth are correct and trustworthy.

Main questions:

- whether the World Date / As-Of control surface is structurally clean and authoritative
- whether direct date changes and `+1 Day` both route through one clear mutation owner
- whether the visible date truth matches what is actually persisted
- whether any silent no-op, fallback, stale-display, or weaker update paths still exist
- whether the As-Of date tells one coherent persistence story overall

---

## Executive Verdict

**RISK**

The world date / as-of seam is mostly structurally clean, but the correct verdict is still **RISK** rather than **PASS**.

The strongest parts of the seam are now clean:

- `GMDashboard.tsx` only renders `WorldTimeControls.tsx` when the dashboard is in world-backed mode
- `WorldTimeControls.tsx` acts as a control surface rather than writing metadata directly
- both direct date input and `+1 Day` route through the hook-owned `worldTimeOwner`
- `useArchitectState.ts` owns the real mutation path through `updateAsOfDate(...)` and `advanceByOneDay(...)`
- persisted world metadata is reloaded back into hook state during world load / reload

The remaining risks are:

- `WorldTimeControls.tsx` displays a synthetic system date when no persisted `asOfDate` exists yet
- `advanceByOneDay()` also seeds from that same system-date fallback when `worldAsOfDate` is null
- control-surface failure handling is console-only, so mutation failures can behave like soft no-ops from the user’s perspective
- `updateWorldMetadata(...)` still exposes a broader generic metadata write surface with weak `asOfDate` typing / validation compared with the stricter hook-owned path

Those seams are not active proof of breakage, but they are enough to keep the right verdict at **RISK**.

---

## World Date / As-Of Control Map

### 1. User-facing control surface

`WorldTimeControls.tsx` is the live user-facing surface for world date operations:

- direct date edits through the `type="date"` input
- `+1 Day` advancement through the button control
- visible display of the current date value
- surfacing the `(System)` fallback badge when no persisted world date exists

This component is structurally a control surface, not the true persistence owner.

### 2. Dashboard handoff / visibility boundary

`GMDashboard.tsx` owns the visibility and handoff boundary around the controls:

- it renders `WorldTimeControls` only when `worldModeBoundary.kind === 'world'`
- it passes the hook-owned `worldTimeOwner` into the control surface
- it also passes `worldAsOfDate` into downstream surfaces such as `TradeSection`

That means the dashboard is the visibility / propagation boundary, not the mutation owner.

### 3. State owner

`useArchitectState.ts` is the real state owner for the as-of seam:

- `worldAsOfDate` state lives here
- `updateAsOfDate(...)` owns direct date mutation
- `advanceByOneDay(...)` owns the `+1 Day` flow
- `worldTimeOwner` is constructed here and exported upward to the dashboard/control surface
- world metadata reload paths also restore persisted `asOfDate` into state here

This is the cleanest owner seam in the current design.

### 4. Persistence owner

`worldManager.ts` owns the actual Firestore metadata write via:

- `updateWorldMetadata(worldId, { asOfDate: nextAsOfDate })`

So the main chain reads:

**dashboard visibility boundary (`GMDashboard`) → control surface (`WorldTimeControls`) → state owner (`useArchitectState`) → persistence owner (`worldManager.updateWorldMetadata`)**

That is broadly a coherent control / state / persistence model.

---

## Input / +1 Day / Persistence / Visible-State Analysis

### Direct input mutation path

The direct-input path is structurally clean.

`WorldTimeControls.tsx` handles the input change, extracts `event.target.value`, and routes it through `worldTimeOwner.updateAsOfDate(...)` rather than writing metadata directly.

`useArchitectState.ts` then:

- validates that `worldId` exists
- validates that the next date value is non-empty
- persists through `updateWorldMetadata(worldId, { asOfDate: nextAsOfDate })`
- updates `worldAsOfDate` state after the write succeeds

That is one clear mutation owner path.

### `+1 Day` mutation path

This path is also structurally clean.

`WorldTimeControls.tsx` routes the button through `worldTimeOwner.advanceByOneDay()`.

`useArchitectState.ts` then:

- computes a new `Date` from `worldAsOfDate || getIsoDateString()`
- increments the day by one
- routes the final string through `updateAsOfDate(...)`

So `+1 Day` does not create a second metadata mutation owner; it still funnels through the same hook-owned mutation path.

### Visible-state truth after successful persistence

When persistence succeeds, visible-state truth is broadly coherent.

- the write happens through `updateWorldMetadata(...)`
- hook state is updated with the same new date string
- world load / reload flows re-read `meta?.asOfDate || null` from metadata into hook state
- `WorldTimeControls.tsx` displays `asOfDate` when it exists

So after a successful explicit mutation, the visible date and persisted date tell the same story.

### Visible-state truth when no world date has been persisted yet

This is the main structural weakness.

`WorldTimeControls.tsx` computes:

- `const displayDate = asOfDate || new Date().toISOString().slice(0, 10)`

and separately shows a `(System)` badge when `!asOfDate`.

That means the visible control can show a date that is not yet persisted world metadata. It is signposted, but it is still not the same thing as authoritative world date truth.

### `+1 Day` behavior before first explicit date write

This is the second main weakness.

`advanceByOneDay()` computes from:

- `new Date(worldAsOfDate || getIsoDateString())`

and `getIsoDateString()` also returns `toISOString().slice(0, 10)`.

So before a real world date exists in metadata, the first increment is based on current system / UTC date rather than previously persisted world truth.

That is a coherent fallback policy, but it is still a fallback rather than a pure persisted-truth model.

---

## Misleading, Duplicated, or Weakly Owned Date-Update Paths

### What is clean

- the inspected live control surface does not write metadata directly
- both input changes and `+1 Day` share one hook-owned mutation owner
- the dashboard only exposes the control surface when a world is active
- persisted metadata is reloaded back into state through the hook layer

### Real weakness 1: synthetic visible-date fallback

The control surface shows a synthetic system date whenever `asOfDate` is missing. That means the visible date is not always authoritative persisted world metadata.

### Real weakness 2: synthetic `+1 Day` base before first persistence

The `+1 Day` flow uses the same fallback source when no persisted date exists yet. So the first increment is not anchored in stored world metadata.

### Real weakness 3: console-only failure handling

`WorldTimeControls.tsx` catches failures for both input edits and `+1 Day`, but only logs them with `console.error(...)`. That creates a real soft no-op risk at the user-facing layer because mutation failure does not surface a focused control-level error state.

### Real weakness 4: generic metadata helper is broader than the control contract

`updateWorldMetadata(...)` still accepts `asOfDate?: unknown` as part of a generic update surface and does not validate date format / shape before writing. The main owner path is narrower and cleaner, but the persistence helper itself remains broader than the intended as-of contract.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- the live mutation chain is easy to trace
- direct input and `+1 Day` share one clear hook-owned mutation owner
- the dashboard visibility boundary is explicit
- persisted metadata is restored back into visible hook state

### Why this is not PASS

- visible date truth is synthetic when no persisted `asOfDate` exists yet
- `+1 Day` can seed from system / UTC fallback rather than stored world metadata
- user-facing failure handling is too soft
- the generic metadata persistence surface remains weaker than the hook-owned owner contract

---

## Files Reviewed

- `src/features/architect/GMDashboard/components/WorldTimeControls.tsx`
- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/utils/worldManager.ts`

---

## Exact File + Function Anchors

### `src/features/architect/GMDashboard/components/WorldTimeControls.tsx`

- `WorldTimeControls`
- `handleDateChange`
- `handleAdvanceDay`
- `displayDate` fallback logic

### `src/features/architect/GMDashboard/GMDashboard.tsx`

- `GMDashboard`
- render path that passes `worldTimeOwner` into `WorldTimeControls`
- render path that gates controls on `worldModeBoundary.kind === 'world'`
- handoff of `worldAsOfDate` into downstream dashboard surfaces

### `src/features/architect/GMDashboard/hooks/useArchitectState.ts`

- `useArchitectState`
- `updateAsOfDate`
- `advanceByOneDay`
- `worldTimeOwner`
- world load / reload metadata handoff into `worldAsOfDate`

### `src/features/architect/utils/worldManager.ts`

- `updateWorldMetadata`

---

## Final Conclusion

The world date / as-of control seam is mostly correct and coherent, but it still contains enough fallback / visible-truth / durability weakness to keep the right Step 3 verdict at:

**RISK**
