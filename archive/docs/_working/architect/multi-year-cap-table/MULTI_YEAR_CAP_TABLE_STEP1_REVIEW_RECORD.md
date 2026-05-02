# MULTI-YEAR CAP TABLE — STEP 1 REVIEW RECORD

## Scope

Multi-Year Cap Table Truth Pass — Step 1: Top-Level Ownership, Year Selection, and Surface Boundary Truth

**Date:** 2026-04-04  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the Multi-Year Cap Table feature at the top-level ownership/composition layer to determine whether year selection, dashboard handoff, and surface boundaries are structurally clean and truthful.

Main questions:

- whether the feature has one coherent top-level ownership story
- whether `CapSheetSection.tsx` is just a thin handoff or accidentally owns feature truth
- whether `CapSheet.tsx` is the true composition/control surface for the multi-year cap table
- whether `currentYear` vs `selectedYear` ownership is structurally clean
- whether the primary cap-sheet surface and adjacent exception surface are separated honestly
- whether the top-level feature shell creates any misleading current-year vs future-year truth signals

---

## Executive Verdict

**RISK**

The top-level feature shell is mostly clean and intentionally structured, but not yet clean enough for PASS.

The strongest clean part:

- there is a real ownership hierarchy
- `CapSheetSection.tsx` is the dashboard handoff and selected-year boundary
- `CapSheet.tsx` is the main multi-year composition surface
- `ExceptionTracker.tsx` is explicitly treated as an adjacent current-year-only presentation surface
- the DEV fixture panel is separated from the primary cap-table display

The main risk:

- the feature still asks one shell to carry two different kinds of truth
- a multi-year cap-table view driven by `selectedYear`
- and a current-year-only exception / hard-cap / TPE truth surface that deliberately stops being authoritative once the user moves off the current year

That boundary is stated honestly, but it is still a feature-level complexity seam.

---

## Multi-Year Cap Table Top-Level Feature Map

### 1. Dashboard handoff layer

`CapSheetSection.tsx` is the top-level section boundary.

It:

- receives `teamCapSheet`
- owns `selectedYear`
- resets `selectedYear` to `currentYear` whenever `currentYear` changes
- passes both years to `CapSheet`
- passes the same year context to `ExceptionTracker`
- exposes the DEV fixture panel separately from the main cap-sheet surface

This is a real owner, not just a wrapper.

### 2. Main cap-table composition surface

`CapSheet.tsx` is the real feature composition/control surface.

It:

- accepts `currentYear` and `selectedYear`
- computes canonical totals once via `computeTeamCapTotals(...)`
- builds the year selector
- renders summary tiles, roster detail, cap-hold detail, totals breakdown, and control surfaces
- controls modal launching for dead money and exceptions
- applies future-year gating for exception editing

This is clearly the main cap-table shell.

### 3. Adjacent current-year-only boundary surface

`ExceptionTracker.tsx` is not pretending to be multi-year truth.

When `selectedYear !== currentYear`, it fail-closes into a boundary panel that explicitly says:

- hard-cap, exception, and TPE truth stays on the current season
- future-year cap-sheet totals can still be viewed, but those adjacent truths are not authoritative there

That is a strong honesty signal.

### 4. DEV fixture control surface

`CapSheetSection.tsx` hosts a DEV-only fixture panel, and `devCapSheetFixtures.ts` injects synthetic cap-sheet players/roster entries for future-contract testing.

That is a distinct top-level surface, not mixed invisibly into the main cap-table UI.

---

## Dashboard Handoff / Year-Selection / Surface-Boundary Analysis

### The feature has one coherent top-level ownership story

This is the strongest positive.

The top-level structure reads cleanly:

- `CapSheetSection` owns section-level year selection and handoff
- `CapSheet` owns the main cap-table surface
- `ExceptionTracker` owns adjacent exception/TPE/hard-cap presentation
- the DEV fixture panel is clearly separate

That is a good starting architecture.

### `CapSheetSection.tsx` is mostly a thin handoff, but not purely passive

It is more than a trivial passthrough because it owns:

- `selectedYear`
- sync of `selectedYear <- currentYear`
- DEV fixture panel visibility and button wiring
- the split between primary cap sheet and adjacent exception surface

That is fine, but it means Step 1 ownership is shared between:

- section shell ownership in `CapSheetSection`
- feature composition ownership in `CapSheet`

So the shell is thin-ish, not fully thin.

### `CapSheet.tsx` is the true composition/control surface

This part is strong.

`CapSheet.tsx` clearly owns:

- selected-year rendering
- canonical totals consumption
- year selector
- roster/cap-hold/totals breakdown surfaces
- current-year-only manage-exceptions gate
- dead-money modal visibility
- exception modal visibility

So there is no real ambiguity about where the main feature lives.

### `currentYear` vs `selectedYear` ownership is mostly clean

The ownership model is understandable:

- `CapSheetSection` initializes and resets `selectedYear`
- `CapSheet` can operate controlled or uncontrolled, but here it is effectively controlled by the section
- `selectedYear` drives the multi-year cap-table view
- `currentYear` remains the authority for certain current-season-only controls and truths

That is structurally reasonable.

### The primary cap-sheet surface and adjacent exception surface are separated honestly

This is another major positive.

`CapSheetSection.tsx` literally documents the split:

- primary current-year cap-sheet surface
- adjacent exception presentation surface

`ExceptionTracker.tsx` reinforces that it does not own or redefine canonical totals and that future-year exception/hard-cap/TPE truth is not authoritative.

So the separation is real, not just implied.

### The shell still creates a feature-level truth split the user has to understand

This is the main source of risk.

The visible feature is called and experienced as one cap-sheet / cap-table area, but inside it:

- the main cap-table can move across future years
- the exception / hard-cap / TPE surface only tells the truth for the current year
- the control surface allows dead-money editing more broadly, while exception editing is explicitly current-year-only

That is honest, but still not as clean as a single unified year-truth model.

---

## Any Misleading, Duplicated, or Weakly Owned Top-Level Seams

### 1. The feature is unified visually, but not fully unified in authority

This is the biggest top-level risk.

The user can switch years inside one cap-table shell, but some adjacent surfaces and controls are no longer authoritative once they do. That boundary is disclosed, but still creates a split-truth experience.

### 2. `CapSheetSection` owns meaningful state, not just rendering delegation

This is not inherently bad, but it does mean top-level ownership is shared:

- section-level year ownership in `CapSheetSection`
- feature composition in `CapSheet`

So the handoff is clean, but not fully minimal.

### 3. Current-year-only controls are embedded inside a multi-year surface

`CapSheet.tsx` keeps:

- year selector
- multi-year totals
- current-year-only exception management gating
- dead-money controls

inside one main frame.

This is workable, but it is a boundary seam worth tightening later if UI truth ever gets fuzzy.

### 4. DEV fixture controls live at the same top-level shell

The DEV fixture panel is clearly labeled and DEV-gated, which is good, but it still lives in the same section shell as the authoritative feature surface.

That is acceptable for dev tooling, but still a top-level seam.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- there is a real ownership hierarchy
- `CapSheetSection` clearly owns selected-year handoff
- `CapSheet` is clearly the main cap-table surface
- `ExceptionTracker` explicitly fail-closes for future-year authority
- the DEV fixture surface is separate and labeled

### Why this is not PASS

- one visible feature shell still contains mixed authority:
  - multi-year totals viewing
  - current-year-only exception / hard-cap / TPE truth
  - mixed current-year vs future-year control availability
- the handoff is good, but not fully minimal
- the feature shell is honest, but still not fully unified in year-truth posture

---

## Files Reviewed

- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`
- `src/features/architect/capSheet/devCapSheetFixtures.ts`

---

## Exact File + Function Anchors

### `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`

- `CapSheetSection`
- `selectedYear` state
- `useEffect` reset from `currentYear`
- handoff into `CapSheet`
- handoff into `ExceptionTracker`
- DEV fixture panel wiring

### `src/features/architect/capSheet/CapSheet/CapSheet.tsx`

- `CapSheet`
- `selectedYear` controlled/uncontrolled handling
- `handleSelectYear`
- `canonicalTotals` memo
- year selector
- current-year-only exception edit boundary
- modal/control surfaces

### `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`

- `CapSummaryTiles`
- direct canonical totals consumer posture

### `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`

- `ExceptionTracker`
- future-year fail-closed boundary panel
- current-year-only hard-cap / exception / TPE truth posture

### `src/features/architect/capSheet/devCapSheetFixtures.ts`

- `DEV_CAP_SHEET_FIXTURE_FLAG`
- fixture inject / clear / detect helpers
- synthetic future-contract fixture ownership

---

## Final Conclusion

The top-level Multi-Year Cap Table feature is well organized enough to keep moving, but Step 1 lands at **RISK**.

The main reason is:

**the ownership is mostly clean, but the shell still carries a split year-truth model between multi-year totals viewing and current-year-only adjacent authority.**
