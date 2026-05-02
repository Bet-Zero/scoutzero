# MULTI-YEAR CAP TABLE — STEP 4 REVIEW RECORD

## Scope

Multi-Year Cap Table Truth Pass — Step 4: Multi-Year Consumer Surfaces and Current-Year-Only Boundary Truth

**Date:** 2026-04-05  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the multi-year consumer surfaces to determine whether the UI tells an honest story about what is truly multi-year versus what remains current-year-only.

Main questions:

- whether canonical totals consumers stay tied to the SSOT without recomputing
- whether roster detail / totals breakdown / cap-hold detail surfaces tell one coherent multi-year story
- whether current-year-only exception / hard-cap / TPE truth is clearly and honestly separated from future-year viewing
- whether the feature’s UI can mislead the user about future-year authority
- whether current-year badges, notes, and disabled states match actual action/state truth
- whether any consumer surface quietly widens beyond its intended ownership boundary

---

## Executive Verdict

**RISK**

The UI consumer layer is mostly honest and better separated than average, but not yet clean enough for PASS.

The strongest clean part:

- `CapSheet.tsx` computes `canonicalTotals` once and passes it into summary / breakdown consumers rather than letting each surface recompute totals independently
- `CapSummaryTiles.tsx` is explicitly a direct canonical-totals consumer surface, not a competing totals owner
- `ExceptionTracker.tsx` explicitly fail-closes for future-year viewing and says hard-cap / exception / TPE truth stays on the current season only

The main risk:

- the feature still asks one visible cap-sheet experience to carry two authority classes at once
- selected-year canonical cap-table viewing
- adjacent current-year-only exception / TPE / hard-cap authority

That split is honestly disclosed, but the feature still relies on notes, disabled controls, and an adjacent boundary panel to keep the user from overreading future-year authority. That is good architecture, but still not perfectly clean.

---

## Multi-Year Consumer-Surface Map

### 1. Main selected-year surface owner

`CapSheet.tsx` is the central consumer/composition surface.

It renders:

- year selector
- canonical totals summary
- roster detail rows
- cap-hold detail rows
- canonical totals breakdown
- control surface for dead money / exceptions
- modals for dead money and exceptions

It also computes `canonicalTotals` once with `computeTeamCapTotals(...)` and then reuses that result through the surface.

### 2. Canonical totals summary consumer

`CapSummaryTiles.tsx` consumes:

- `canonicalTotals`
- `currentYear`
- `selectedYear`
- `teamCapSheet` only for adjacent hard-cap presentation via `getHardCapStatus(...)`

It does not recompute totals and is explicitly labeled as a canonical totals consumer surface.

### 3. Selected-year supporting detail consumers

Inside `CapSheet.tsx`, the selected-year supporting details are:

- roster detail table
- cap holds detail disclosure
- total cap hit breakdown rows

These surfaces mostly explain or decompose the selected-year totals rather than redefining them.

### 4. Current-year-only adjacent authority surface

`ExceptionTracker.tsx` is a separate adjacent surface.

It:

- fail-closes entirely when `selectedYear !== currentYear`
- only renders live exception / hard-cap / TPE cards when viewing the current season
- uses `currentYear` for cap settings, hard-cap status, and room exception eligibility

That boundary is very explicit.

---

## Canonical-Consumer / Current-Year-Boundary / UI-Truth Analysis

### Canonical totals consumers stay tied to the SSOT

This is the strongest positive.

`CapSheet.tsx` computes `canonicalTotals` one time, and then:

- passes it to `CapSummaryTiles`
- uses it directly for totals breakdown rows
- uses `canonicalTotals.salaryCap` for player cap percentage display
- uses canonical totals metadata for the “Official / Reported / Projected / Unknown” confidence badge

`CapSummaryTiles.tsx` then derives display values like cap space and apron space from the passed-in canonical totals rather than recomputing them from raw team data.

That is a real SSOT consumer pattern.

### Roster detail / totals breakdown / cap-hold detail tell one mostly coherent multi-year story

This part is good.

The feature is explicit that:

- player rows show player salaries only
- total cap hit also includes dead money, cap holds, and incomplete roster charges
- cap holds detail explains included cap holds without becoming a totals owner

That is honest and easy to follow.

### Current-year-only exception / hard-cap / TPE truth is clearly separated

This is also strong.

`ExceptionTracker.tsx` does not try to fake future-year exception truth.
It literally stops and shows a boundary panel when you are not on the current year.

And inside `CapSheet.tsx`:

- “Manage Exceptions” is disabled outside the current season
- a boundary note appears saying exception editing is only available for the current season
- the modal is auto-closed if the user leaves the current year while it is open

That is good UI honesty.

### The feature can still be slightly misleading about future-year authority if the user reads it too casually

This is the main Step 4 risk.

The selected-year cap sheet still shows:

- cap space
- tax space
- apron space
- full totals breakdown
- control surfaces in the same visual frame

The boundary is there, but it is still possible for a user to experience the whole area as one “future-year cap management” surface even though:

- exception authority is current-year-only
- hard-cap badge truth is only shown when viewing the current year
- TPE truth is only live on the current year surface

So the UI is honest, but still depends on the user noticing the boundary signals.

### Current-year badges, notes, and disabled states mostly match actual truth

This part is solid.

Examples:

- `CapSummaryTiles.tsx` suppresses hard-cap lock badges unless `selectedYear === currentYear`
- `ExceptionTracker.tsx` renders the future-year boundary panel instead of pseudo-live cards when not on the current year
- `CapSheet.tsx` disables exception editing outside the current season and leaves dead-money management available separately

That all lines up with the intended truth model.

### No major consumer surface appears to quietly widen into a competing owner

Another strong positive.

- `CapSummaryTiles.tsx` consumes canonical totals
- player rows consume contract helpers and canonical salary cap for cap %
- cap-hold detail uses the shared cap-holds utility
- `ExceptionTracker` owns adjacent presentation only and does not compute canonical totals

There is no second hidden totals owner here.

---

## Any Misleading, Duplicated, or Weakly Enforced Consumer Boundaries

### 1. One visual feature still spans two authority classes

This is the biggest Step 4 risk.

The selected-year cap-table UI and the current-year-only adjacent authority surface still live in one overall experience. The feature tells the truth, but the truth split is still a split.

### 2. Hard-cap presentation in summary tiles is intentionally partial for future years

This is probably correct, but still a consumer-boundary subtlety.

`CapSummaryTiles.tsx` still renders 1st/2nd apron space in all years, but hard-cap lock indicators only appear in the current year.

That is honest, but a user could still overread future-year apron space as future-year hard-cap tooling unless they also absorb the adjacent boundary messaging.

### 3. The control surface mixes broad and current-year-only actions in one row

This is another mild risk.

Inside `CapSheet.tsx`:

- dead-money management remains available when mutation authority exists
- exception management is current-year-only
- both sit in the same control strip

The boundary note helps, but this is still a mixed-authority control area.

### 4. `ExceptionTracker` is honest, but still built from several adjacent utilities

Not a failure, just a seam to note.

It combines:

- `getCapSettingsForYear(currentYear)`
- `getHardCapStatus(...)`
- `canUseRoomException(...)`
- `getCanonicalExceptionAvailability(...)`
- `getTeamTpeList(...)`

That is okay for an adjacent presentation surface, but it does mean the current-year-only truth boundary depends on several utilities staying aligned.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- canonical totals consumers are clearly downstream of the SSOT
- roster detail, cap holds, and totals breakdown mostly tell one coherent selected-year story
- current-year-only exception / hard-cap / TPE truth is clearly fail-closed
- disabled states and notes generally match the actual authority model
- there is no competing totals owner in the consumer layer

### Why this is not PASS

- one visible feature still spans selected-year canonical viewing and current-year-only adjacent authority
- the UI is honest, but still relies on boundary notes, badges, and disabled states to prevent misreading
- the mixed-authority control strip and partial future-year apron presentation keep the consumer layer slightly softer than ideal

---

## Files Reviewed

- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/capSheet/CapSheet/CapSheet.tsx`

- `CapSheet`
- `canonicalTotals` memo using `computeTeamCapTotals(...)`
- year selector
- player row rendering with `getContractYearSlice(...)` / `getPlayerCapHitForYear(...)`
- cap-hold detail via `getActiveUnsignedCapHoldsByEndYear(...)`
- totals breakdown using canonical totals
- future-year exception-edit boundary note
- `ManageDeadMoneyModal` / `ManageExceptionsModal` wiring

### `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`

- `CapSummaryTiles`
- direct canonical totals consumption
- cap / tax / apron space display
- hard-cap badge gating with `selectedYear === currentYear`
- adjacent use of `getHardCapStatus(...)`

### `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`

- `ExceptionTracker`
- future-year fail-closed boundary panel
- current-year-only `getCapSettingsForYear(currentYear)`
- `getHardCapStatus(...)`
- `canUseRoomException(...)`
- `getCanonicalExceptionAvailability(...)`
- `getTeamTpeList(...)`

---

## Final Conclusion

The consumer layer is well structured and mostly honest, but Step 4 lands at **RISK**.

The main reason is:

**the surfaces do a good job telling the truth, but the feature still asks one visible cap-sheet experience to carry both selected-year canonical viewing and current-year-only adjacent authority, which keeps the UI-boundary model a little softer than ideal.**
