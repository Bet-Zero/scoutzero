# LEAGUE VIEW — STEP 2 REVIEW RECORD

## Scope

League View Truth Pass — Step 2: Canonical Totals Consumption, Display Contract, Sorting, and Navigation Truth

**Date:** 2026-04-07  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the League View consumer/display layer to determine whether league-wide totals, labels, grouping, sorting, and navigation handoff tell an honest story about what the feature is actually showing.

Main questions:

- whether League View consumes canonical totals cleanly without widening into competing totals ownership
- whether displayed summary values are labeled truthfully relative to what `computeTeamCapTotals(...)` actually returns
- whether grouping/sorting/display transforms preserve rather than soften underlying cap truth
- whether any conference split, ordering, or summary shaping can mislead the user
- whether the feature tells an honest user-facing story about what season and what kind of total it is displaying
- whether the “Manage Team” navigation handoff is structurally truthful relative to the team-level cap-sheet surface it opens

---

## Executive Verdict

**RISK**

League View is now a clean canonical totals consumer, and its grouping/sorting transforms are simple and mostly honest. But the consumer/display contract is still too soft to earn PASS.

The strongest clean part:

- `leagueViewModel.ts` consumes `computeTeamCapTotals(...)` directly and reduces that canonical result into a league summary field without introducing a competing totals owner
- conference grouping/sorting only filters and alphabetizes already-shaped summaries; it does not recompute or normalize away loaded-vs-unavailable truth
- the feature now surfaces season/source/totals boundaries in the truth panel and keeps unavailable rows visibly distinct from loaded rows

The main risk:

- the truth panel explicitly says totals come from `computeTeamCapTotals totalCapAllocations`
- the visible conference table column is still labeled `Total Salary`
- those two stories are not the same in the feature’s SSOT model, because `totalCapAllocations` includes more than raw salary
- the “Manage Team” navigation handoff is team-true but still season-implicit; League View does not carry its displayed season through the navigation seam into the destination dashboard

So the feature’s consumer architecture is now cleaner than before, but the semantic display contract remains slightly softer than the underlying truth model.

---

## Canonical Totals Consumption / Display-Contract / Sort-Group-Nav Map

### 1. Canonical totals consumption

League View now consumes totals through the extracted model layer:

- `loadLeagueTeamSummary(...)` in `leagueViewModel.ts`
- reads a team through `loadTeamCapSheet(...)`
- computes totals through `computeTeamCapTotals(capSheet, season.endYear)`
- stores `capTotals.totalCapAllocations` into `totalSalary` for loaded rows

That means League View is not widening into a competing totals owner.

### 2. Display contract

The visible display contract now splits across two surfaces:

- `LeagueViewTruthPanel.tsx` explicitly says the totals boundary is `computeTeamCapTotals totalCapAllocations`
- `LeagueConferenceTable.tsx` still renders the visible column header `Total Salary`

That mismatch is the biggest Step 2 issue.

### 3. Grouping and sorting

Grouping and sorting live in `groupLeagueTeamSummaries(...)`:

- split rows by `conference === 'East'`
- split rows by `conference === 'West'`
- sort within each conference by `teamName.localeCompare(...)`

This is a simple consumer transform. It preserves loaded/unavailable state because it only filters and sorts already-shaped summaries.

### 4. Navigation handoff

`LeagueView.tsx` navigates into the team dashboard through:

- `navigate(`/gm/${teamSlug}`)`

`GMDashboard.tsx` then:

- reads `teamId` from the route
- owns its own `currentYear`
- renders a season selector in the dashboard header
- passes `currentYear` into team-level surfaces such as `CapSheetSection`

So the handoff is structurally valid for team identity, but not explicit about season continuity.

---

## Totals-Consumer / Labeling / Grouping / Navigation Analysis

### League View consumes canonical totals cleanly

This is a strong positive.

The model layer explicitly computes:

- `computeTeamCapTotals(...)`
- then takes `totalCapAllocations` as the displayed summary number

It does not recompute totals through any separate League View helper or inline math.

### Displayed summary values are not labeled fully truthfully

This is the main Step 2 risk.

The truth panel is honest:

- it names the totals boundary explicitly as `computeTeamCapTotals totalCapAllocations`

But the visible table still says:

- `Total Salary`

Those are not the same thing in the feature’s SSOT model. `computeTeamCapTotals.ts` includes player totals, dead money, cap holds, incomplete roster charges, and produces `totalCapAllocations` as the canonical aggregate.

So the feature currently tells a more precise story in one place and a softer story in another.

### Grouping/sorting/display transforms mostly preserve cap truth

The grouping/sorting seam is simple enough that it does not look like a serious truth hazard:

- no recomputation
- no numeric normalization
- no ranking by totals that could bury unavailable rows
- no conference-specific reshaping of totals
- loaded/unavailable state survives the transform intact

The transforms are consumer-only and structurally transparent.

### Conference split and ordering are mostly honest

Conference split is basic metadata partitioning and alphabetical ordering. That is not inherently misleading.

The more meaningful display risk is not the ordering itself, but the semantic label on the displayed value.

Unavailable rows remain included in conference grouping, but that is acceptable because they are now visibly marked unavailable rather than being flattened into `$0` truth.

### Season truth is more honest now, but total-type truth is still inconsistent

Season story:

- the truth panel explicitly shows the season code and default current-season source label

That is good.

Total-type story:

- truth panel says `computeTeamCapTotals totalCapAllocations`
- table says `Total Salary`

So season truth is now fairly explicit, but total-type truth is still split-brain.

### “Manage Team” navigation is structurally valid, but season-implicit

The navigation seam is team-true:

- League View sends the user to the right team dashboard route by slug/id only
- `GMDashboard.tsx` clearly owns team-level season state once the user arrives there

The soft part:

- League View’s displayed season is not explicitly carried through navigation
- navigation does not encode season continuity
- the destination dashboard may align in practice, but that contract is still implicit rather than enforced in the handoff

---

## Any Misleading, Duplicate, or Weakly Enforced Consumer-Display Boundaries

### 1. Label mismatch between truth panel and conference table

This is the biggest Step 2 issue.

- truth panel: `computeTeamCapTotals totalCapAllocations`
- table header: `Total Salary`

### 2. Navigation is team-true but season-implicit

The route handoff is honest about team identity, but not explicit about season continuity between League View and the destination dashboard.

### 3. Consumer architecture itself is now clean

To balance the above, the shell/hook/model/panel/table split is now much easier to reason about. The remaining risk is more about semantic honesty than architectural confusion.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- canonical totals consumption is clean and direct
- grouping/sorting does not appear to distort the underlying summary truth
- unavailable rows are now visibly differentiated from loaded rows
- navigation handoff is structurally valid at the team level

### Why this is not PASS

- the displayed value is still labeled `Total Salary` while the feature explicitly says it is showing `totalCapAllocations`
- the navigation seam still leaves season continuity implicit rather than explicit

---

## Files Reviewed

- `src/features/architect/shared/LeagueView/LeagueView.tsx`
- `src/features/architect/shared/LeagueView/leagueViewModel.ts`
- `src/features/architect/shared/LeagueView/LeagueViewTruthPanel.tsx`
- `src/features/architect/shared/LeagueView/LeagueConferenceTable.tsx`
- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
- `src/features/architect/GMDashboard/GMDashboard.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/shared/LeagueView/leagueViewModel.ts`

- `resolveLeagueViewSeason`
- `loadLeagueTeamSummary`
- `loadLeagueTeamSummaries`
- `groupLeagueTeamSummaries`

### `src/features/architect/shared/LeagueView/LeagueView.tsx`

- `LeagueView`
- `goToTeam`
- handoff into `LeagueViewTruthPanel`
- handoff into `LeagueConferenceTable`
- navigation to `/gm/:teamSlug`

### `src/features/architect/shared/LeagueView/LeagueViewTruthPanel.tsx`

- `LeagueViewTruthPanel`
- season/source/totals boundary presentation

### `src/features/architect/shared/LeagueView/LeagueConferenceTable.tsx`

- `LeagueConferenceTable`
- `formatSalary`
- `Total Salary` column header
- loaded vs unavailable row rendering

### `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`

- file-level ownership contract for canonical totals
- `computeTeamCapTotals`
- canonical `totalCapAllocations` output

### `src/features/architect/GMDashboard/GMDashboard.tsx`

- `GMDashboard`
- route param consumption
- season selector / `currentYear`
- handoff into team-level surfaces including `CapSheetSection`

---

## Final Conclusion

League View now has a cleaner consumer architecture and a more explicit season/source truth panel, but Step 2 still lands at **RISK**.

The main reason is:

**the feature consumes canonical totals correctly, but still labels that value too softly as `Total Salary`, and the team handoff remains season-implicit rather than season-explicit.**
