# STEP 5 — World vs No-World / Sandbox Boundary Behavior

## Scope

League / World Time / As-Of — Step 5: World vs No-World / Sandbox Boundary Behavior

**Date:** 2026-04-03  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review how Architect behaves differently when a world is selected versus when no world is selected, and determine whether that boundary is structurally clean and truthful.

Main questions:

- which League / World Time behaviors are world-only
- which behaviors are allowed without a world selected
- whether UI truth matches actual action/state truth across world vs no-world behavior
- whether any action can silently no-op or behave inconsistently depending on whether `worldId` exists
- whether the world vs no-world / sandbox boundary is structurally clean
- whether no-world behavior can leak into authoritative world assumptions or vice versa

---

## Executive Verdict

**PASS WITH MINOR RISKS**

The world-vs-no-world / sandbox boundary is mostly clean and truthful in live code.

The strongest parts of the seam are clean:

- `useArchitectState.ts` exposes an explicit discriminated world boundary instead of leaving sandbox-vs-world behavior implicit
- `WorldSelector.tsx` tells the user directly that no world means quick sandbox mode and that a world is needed to save changes
- `GMDashboard.tsx` gates world-only controls off the same state-owned boundary instead of recreating the policy ad hoc in each surface
- `useArchitectActions.ts` uses action-layer world-only guards for sensitive world-backed flows such as sign-and-trade and offer-sheet actions
- sandbox-capable actions do not simply no-op when `worldId` is missing; several of them deliberately route through base/vacuum execution paths instead

The remaining risks are minor rather than structural blockers:

- the phrase “quick sandbox” is directionally true, but broader than the exact capability matrix because some features remain world-only while others are intentionally allowed in sandbox mode
- world-only enforcement is implemented through a mix of UI hiding, null owner availability, and action-layer refusal, which is acceptable defense in depth but not perfectly uniform from a UX perspective
- shared mutation surfaces that branch into world vs vacuum mode are structurally correct now, but still deserve continued guardrails because the same handler family can represent both authorities depending on `worldId`

These seams are not strong enough to keep the correct verdict at RISK. The correct verdict is **PASS WITH MINOR RISKS**.

---

## World vs No-World / Sandbox Behavior Map

### 1. State-owned boundary contract

`useArchitectState.ts` is the core owner of the world-vs-no-world policy boundary.

It exposes a discriminated `worldModeBoundary` surface:

- sandbox mode: no active world, no world-backed reload owner
- world mode: active `worldId` plus the hook-owned `onReloadWorldData` seam

That means the dashboard and downstream surfaces can consume one named policy contract rather than inferring the world state ad hoc.

### 2. World selection control surface

`WorldSelector.tsx` is the main user-facing control surface for the boundary.

It explicitly provides:

- `No World Selected`
- helper copy that says: `Select a world to save changes. No world = quick sandbox.`

It also conditionally shows world actions only when a world is active.

### 3. Dashboard fan-out boundary

`GMDashboard.tsx` fans the state-owned boundary into downstream UI behavior.

Important examples:

- `WorldSelector` always renders for signed-in users
- `WorldTimeControls` only renders when `worldModeBoundary.kind === 'world'`
- `OffseasonSection` receives `onReloadWorldData={worldModeBoundary.onReloadWorldData}`
- world metadata fan-out only exists when the main hook surface provides it

### 4. Action-layer boundary enforcement

`useArchitectActions.ts` is the key action-layer enforcement seam.

It includes:

- explicit world-only requirement tables/messages
- world-only commit guards for sign-and-trade and offer-sheet actions
- world-only preview guards for sign-and-trade and offer-sheet preflights
- dual-path execution for some actions that intentionally support both sandbox and world modes

This is the layer that prevents UI truth from drifting into false authority assumptions.

---

## Which Behaviors Are World-Only

The following behaviors are clearly world-backed only in the current design:

### World management

`WorldSelector.tsx` world actions such as:

- branch
- rename
- archive
- delete

only exist when a world is actually active.

### World date / as-of controls

`WorldTimeControls.tsx` is world-only:

- it returns `null` if `!worldId`
- `GMDashboard.tsx` only renders it when `worldModeBoundary.kind === 'world'`

### World season advancement surface

`OffseasonSection.tsx` world-backed season advancement depends on:

- `worldId`
- loaded authoritative world season context

Without a world, the world-backed advancement surface is absent.

### Free-agency world-only flows

`useArchitectActions.ts` explicitly makes these world-only:

- sign-and-trade preview / commit
- offer-sheet preview / commit
- offer-sheet lifecycle actions

These are not merely hidden; they are protected at the action layer.

---

## Which Behaviors Are Allowed Without a World Selected

The current system intentionally allows a meaningful sandbox path.

### Base / sandbox dashboard state

`useArchitectState.ts` supports a sandbox-mode coordinated load path without an active `worldId`.

### Base / sandbox trade application

`useArchitectActions.ts` allows trade application without a world by running authoritative compute in base/vacuum mode instead of requiring world persistence.

### Base / sandbox standard signing

`useArchitectActions.ts` chooses between:

- `executeWorldModeStandardSigning`
- `executeVacuumModeStandardSigning`

through `resolveStandardSigningExecutionRoute()`.

That means standard signing is intentionally allowed in both modes, but through different authority paths.

### Other local cap-sheet mutation flows

Several cap-sheet / contract mutation flows operate against local team state and only persist when a world exists. That is part of the intended quick sandbox behavior.

---

## UI Truth vs Action/State Truth Analysis

### What aligns well

UI truth and actual state/action truth align well in several important places:

- `WorldSelector.tsx` tells the user that no world means sandbox and that selecting a world enables saved changes
- `useArchitectState.ts` encodes that same distinction structurally through the discriminated world boundary
- `GMDashboard.tsx` uses the boundary directly when rendering world-only surfaces
- `WorldTimeControls.tsx` fail-closes by not rendering at all without a world
- `useArchitectActions.ts` reinforces the UI truth by refusing world-only actions at runtime if no active world exists

### Where the UX is a little less uniform

Not every world-only feature is enforced in the same visible style:

- some world-only features are hidden entirely in UI
- some are represented by world-only owner objects that become unavailable in sandbox mode
- some still rely on runtime refusal at the action layer with explicit messages

That is acceptable and generally safe, but it is not perfectly uniform from the user’s perspective.

### Silent no-op analysis

The live design mostly avoids silent no-ops:

- `WorldTimeControls.tsx` is not rendered in sandbox mode instead of pretending to work
- world-only free-agency actions explicitly report that they require an active world
- sandbox-supported actions have explicit vacuum/base-mode execution paths instead of simply returning early

This is one of the strongest parts of the current boundary behavior.

---

## Any Misleading, Duplicate, or Weakly Enforced Boundaries

### Minor weakness 1: “quick sandbox” wording is broader than the exact matrix

The selector helper text is directionally correct, but it simplifies a more nuanced truth:

- some features are available in sandbox mode
- some are completely world-only
- some use dual-path authority depending on `worldId`

The wording is not false, but it is broader than the exact behavior map.

### Minor weakness 2: mixed hide-vs-block enforcement pattern

The current design uses a mix of:

- render gating
- null owner availability
- action-layer refusal

That is mostly good defense in depth, but it means the boundary is enforced through multiple patterns rather than one totally uniform UX strategy.

### Minor weakness 3: shared handlers branch by authority mode

Some mutation families support both sandbox and world mode through one shared action surface that branches internally based on `worldId`.

That is structurally valid today, but it means the world-vs-no-world policy still depends on continued discipline inside those handlers.

---

## PASS / RISK / FAIL

### Result: PASS WITH MINOR RISKS

### Why this is not RISK

- the boundary is named and state-owned, not informal
- the main selector UI truth broadly matches the actual persistence model
- world-only controls are properly gated at the dashboard/section level
- world-only sensitive actions are also protected at the action layer
- sandbox-capable actions have real non-world execution routes rather than silent early returns

### Why this is not full PASS

- the “quick sandbox” copy is slightly broader than the exact supported-feature matrix
- enforcement style is mixed across hiding, null-owner availability, and explicit refusal
- shared dual-path handlers still deserve guardrails because they sit directly on the authority boundary

---

## Files Reviewed

- `src/features/architect/GMDashboard/components/WorldSelector.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/components/WorldTimeControls.tsx`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

---

## Exact File + Function Anchors

### `src/features/architect/GMDashboard/components/WorldSelector.tsx`

- `WorldSelector`
- `commitActiveWorldSelection`
- no-world option / helper copy
- world-action visibility when a world is active

### `src/features/architect/GMDashboard/hooks/useArchitectState.ts`

- `ArchitectWorldModeBoundary`
- `worldModeBoundary`
- `activeWorldOwner`
- `worldTimeOwner`
- coordinated sandbox-vs-world load bundle behavior

### `src/features/architect/GMDashboard/GMDashboard.tsx`

- render path for `WorldSelector`
- render path for `WorldTimeControls`
- `onReloadWorldData={worldModeBoundary.onReloadWorldData}`
- world metadata fan-out to `OffseasonSection`

### `src/features/architect/GMDashboard/components/WorldTimeControls.tsx`

- `WorldTimeControls`
- early `if (!worldId) return null`
- world-only date / `+1 Day` controls

### `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`

- `WorldBackedOffseasonSurface`
- `canAdvanceWorldSeason`
- world-backed season-advance surface gating

### `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

- `FREE_AGENCY_WORLD_ONLY_REQUIREMENTS`
- `requireActiveWorldForFreeAgencyWorldOnlyCommit`
- `resolveStandardSigningExecutionRoute`
- `executeWorldModeStandardSigning`
- `executeVacuumModeStandardSigning`
- world-only offer-sheet / sign-and-trade action ownership

---

## Final Conclusion

The world-vs-no-world / sandbox boundary is structurally clean and mostly truthful in live code. It is not perfect, but it is clearly beyond RISK territory.

The correct Step 5 verdict is:

**PASS WITH MINOR RISKS**
