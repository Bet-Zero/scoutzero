# LEAGUE VIEW — STEP 1 REVIEW RECORD

## Scope

League View Truth Pass — Step 1: Top-Level Ownership, Data Loading, and Season / Source Boundary Truth

**Date:** 2026-04-07  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the League View feature at the top-level ownership and data-loading layer to determine whether the feature has a clean shell/data-flow story and whether its season/source boundaries are structurally honest.

Main questions:

- whether League View has one coherent top-level ownership story
- whether `LeagueView.tsx` is acting as a reasonable thin feature owner or an overgrown mixed surface
- whether season choice is structurally clear and honest
- whether the feature’s data source / hydration path is clearly bounded and read-only
- whether load failure / missing-data behavior is structurally honest or quietly flattened
- whether the feature clearly distinguishes loaded league truth from fallback/default UI truth

---

## Executive Verdict

**RISK**

League View has a coherent top-level story, but it is still too soft to earn PASS.

The strongest clean part:

- `LeagueView.tsx` is the clear real feature entry point
- the feature reads team data through a bounded read-only hydration seam in `firebaseTeamPlanHelpers.ts`
- the surface consumes canonical totals through `computeTeamCapTotals(...)` rather than inventing its own league-total math

The main risk:

- `LeagueView.tsx` still owns too many responsibilities inline at once:
  - season resolution
  - league-wide team loading
  - summary shaping
  - conference grouping
  - sorting
  - inline rendering
  - navigation handoff
- the season boundary is real but mostly implicit in the UI
- failed team loads are flattened into valid-looking zero-value rows rather than explicitly degraded truth
- loaded league truth and fallback/default UI truth are not clearly distinguished in the surface contract

So the feature is understandable, but the shell/data-flow contract is broader and softer than ideal.

---

## League View Top-Level Feature Map

### 1. Primary feature entry point

The real live feature surface is:

- `src/features/architect/shared/LeagueView/LeagueView.tsx`

### 2. What the feature currently owns directly

`LeagueView.tsx` currently owns:

- local `teamSummaries` state
- season resolution through `getDefaultSeasonEndYear()`
- `useEffect` boot-time load of all teams
- per-team summary shaping
- conference partitioning
- alphabetical sorting within conferences
- inline table rendering
- navigation handoff into `/gm/:teamSlug`

So the current feature contract is: one top-level file loads base team data, computes current-season league summary rows, groups them by conference, renders both tables, and hands off to the team-management surface.

### 3. Data-loading / source seam

League View reads team data through:

- `loadTeamCapSheet(teamCode)` in `src/features/architect/utils/firebaseTeamPlanHelpers.ts`

That helper file explicitly describes itself as read-only for base data / free agents and says mutations go elsewhere.

### 4. Shared truth dependency

After loading each team cap sheet, League View consumes canonical totals through:

- `computeTeamCapTotals(capSheet, currentYear)`
- then reads `capTotals.totalCapAllocations` into `totalSalary`

That means League View is primarily a league-wide consumer of shared SSOT rather than an alternate totals owner.

### 5. Season boundary

League View resolves season once at load time using:

- `getDefaultSeasonEndYear()` from `seasonUtils.ts`

The selected season is therefore structurally real in code, but it is not surfaced clearly as a user-facing feature boundary.

---

## Ownership / Data-Loading / Season-Source-Boundary Analysis

### League View has one coherent top-level ownership story, but it is too compressed

The feature is coherent in the sense that one surface owns the whole league-level read/render flow. That makes the feature easy to locate and understand quickly.

But `LeagueView.tsx` owns too many different responsibilities at once. It is not acting like a thin shell over clearer sub-seams; it is acting like the full feature contract in one inline file.

### `LeagueView.tsx` is an overgrown mixed surface, not a thin owner

There is no visible dedicated:

- League View loading hook
- summary adapter/helper
- row/table component
- season/source truth component
- failure-state abstraction

That makes the top-level surface broader than ideal and easier to widen incorrectly later.

### Season choice is structurally real, but not clearly signaled

Internally, the season boundary is simple:

- League View picks one end year via `getDefaultSeasonEndYear()` and uses that for all team totals.

But the feature does not visibly tell the user:

- what season League View is displaying
- why that season was chosen
- whether the season is fixed or changeable

Additionally, `seasonUtils.ts` is a deprecated compatibility module that simply re-exports the canonical season helper from `seasonFormat`, which makes the import boundary softer than ideal even though the underlying helper remains valid.

### Data source / hydration path is clearly bounded and read-only

This is one of the strongest Step 1 positives.

`firebaseTeamPlanHelpers.ts` explicitly says:

- team mutations go through another path
- this file handles read operations for base data and free agents

That makes the source boundary honest:

- League View is not mutating
- League View is reading base/hydrated team truth
- League View then consumes shared totals logic

### Load failure / missing-data behavior is not fully honest

When a team fails to load, League View still returns a summary row with:

- team identity preserved
- `totalSalary: 0`

That is convenient for rendering but weak from a truth perspective, because a failed load and a real zero are not the same thing.

The feature quietly flattens a degraded data state into a valid-looking league-summary row instead of marking it as failed/unavailable/fallback truth.

### Loaded truth and fallback/default UI truth are not clearly distinguished

Loaded team rows and fallback rows share the same summary shape. There is no status field or explicit UI distinction that separates:

- loaded league truth
- fallback/default UI truth created after load failure

So the surface does not currently make that boundary visible.

---

## Any Misleading, Duplicate, or Weakly Owned Top-Level Seams

### 1. Monolithic top-level ownership

`LeagueView.tsx` owns too much of the feature contract inline:

- loading
- season resolution
- summary shaping
- grouping/sorting
- rendering
- navigation

This is the biggest structural weakness in Step 1.

### 2. Implicit season-truth contract

League View computes a season boundary internally, but does not expose that truth clearly in the user-facing surface. The deprecated `seasonUtils.ts` import path adds a small additional softness at the source boundary.

### 3. Failed-data flattening into zero-value truth

Load failures are currently converted into zero-value summary rows, which can be misread as real league truth rather than degraded/fallback truth.

### 4. No explicit loaded-vs-fallback state contract

The surface does not clearly distinguish between:

- successfully loaded team summaries
- fallback summary rows created after load failure

### 5. Source boundary itself is clean

To balance the above, the read/hydration seam is stronger than the feature shell contract. `loadTeamCapSheet(...)` is part of an explicitly read-only helper surface, which keeps League View from owning mutation truth.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- there is one understandable live feature entry point
- the data source / hydration seam is clearly bounded and read-only
- League View consumes canonical totals from `computeTeamCapTotals(...)` rather than computing league totals ad hoc

### Why this is not PASS

- `LeagueView.tsx` is too mixed and inline at the top level
- season truth is implicit rather than clearly surfaced
- failed loads are quietly flattened into zero-value rows
- loaded truth and fallback/default UI truth are not clearly distinguished

---

## Files Reviewed

- `src/features/architect/shared/LeagueView/LeagueView.tsx`
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts`
- `src/features/architect/utils/seasonUtils.ts`
- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`

---

## Exact File + Function Anchors

### `src/features/architect/shared/LeagueView/LeagueView.tsx`

- `LeagueView`
- `loadAllTeams`
- `goToTeam`
- inline `renderTable`
- `getDefaultSeasonEndYear()` usage
- `loadTeamCapSheet(...)` usage
- `computeTeamCapTotals(...)` usage
- fallback `totalSalary: 0` behavior

### `src/features/architect/utils/firebaseTeamPlanHelpers.ts`

- file-level read-only ownership note
- `hydrateBaseTeam`
- `loadTeamCapSheet`

### `src/features/architect/utils/seasonUtils.ts`

- deprecation note
- re-export of `getDefaultSeasonEndYear`

### `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`

- file-level ownership contract for canonical totals
- `computeTeamCapTotals`

---

## Final Conclusion

League View’s top-level story is understandable, but still too soft to earn PASS.

It is currently best described as:

**a single-file league-wide consumer surface with a clean read-only source seam, but weak season signaling and weak fallback-truth honesty.**

**Step 1 verdict: RISK.**
