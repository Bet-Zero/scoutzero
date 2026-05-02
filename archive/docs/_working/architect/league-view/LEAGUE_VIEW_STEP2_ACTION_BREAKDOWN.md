# LEAGUE VIEW — STEP 2 ACTION BREAKDOWN

## Canonical Totals Consumption, Display Contract, Sorting, and Navigation Truth

---

## LV-2A — Tighten League View Display Contract So Visible Totals Labels Match The Canonical `computeTeamCapTotals(...).totalCapAllocations` Truth Being Shown

### Problem

League View now consumes canonical totals cleanly, but its visible display contract still tells a softer story than the underlying SSOT model.

Examples:

- `LeagueViewTruthPanel.tsx` explicitly says totals come from `computeTeamCapTotals totalCapAllocations`
- `LeagueConferenceTable.tsx` still labels the visible value as `Total Salary`
- `computeTeamCapTotals.ts` produces canonical total cap allocations, which include more than just raw salary

That means the feature is precise in one place and softer in another.

### Why It Matters

- a league-wide consumer surface should not relabel canonical cap-allocation truth into a more casual or narrower-looking value
- users and future developers should be able to tell exactly what league summary value is being displayed
- Step 2 should tighten the display contract before later steps review feature-level guardrail completeness and closeout readiness

### Goal

Make the visible League View totals contract match the canonical totals truth it actually consumes.

### Success Criteria

- visible totals labeling is easier to reason about directly from source and UI
- League View no longer tells two different stories about what number it is showing
- no broader totals-engine rewrite is required

---

## LV-2B — Tighten Sort / Group / Navigation Boundary Truth So League-Level Presentation And Team Handoff Read More Explicitly As Honest Consumer Behavior

### Problem

Conference grouping and alphabetical sorting are structurally simple, and the team handoff is valid, but the consumer boundary is still softer than ideal.

Examples:

- conference grouping/sorting currently lives in League View’s consumer model and should stay clearly consumer-only
- unavailable rows now remain visibly unavailable, but sorting/grouping still need to remain transparent and non-destructive
- `Manage Team` navigation is team-true, but season continuity between League View and `GMDashboard.tsx` remains implicit rather than explicit

The surface is close, but the presentation and handoff contract are still not fully explicit.

### Why It Matters

- League View should read as a transparent league-level summary surface, not as a place where presentation transforms quietly soften the truth
- navigation handoff into the team dashboard should be clearly understandable in terms of what identity and season truth are being carried forward and what is re-owned by the destination surface
- Step 2 should tighten these boundaries before later steps move on to guardrail coverage and whole-feature closeout work

### Goal

Make grouping, sorting, and team navigation read more clearly as bounded consumer behavior with an explicit and honest handoff contract.

### Success Criteria

- grouping/sorting behavior is easier to reason about directly from source and UI
- the team handoff is clearer about what it does and does not carry forward
- no broader dashboard or cap-sheet redesign is required

---

## LV-2C — Add Focused Guardrails For Display-Contract Truth, Consumer Presentation Boundaries, And Team-Handoff Honesty

### Problem

The Step 2 risk is largely about League View now being structurally cleaner, but still soft in the exact semantic places where consumer drift can happen quietly.

Examples of drift risk:

- visible totals labels could soften again while canonical totals consumption stays correct
- grouping/sorting could widen into more opinionated or less transparent presentation behavior without loud failure
- unavailable row handling could stay visually present but become semantically muddier
- navigation handoff could remain underexplained or drift into a less honest contract without any direct guardrail around it

### Why It Matters

- League View is a compact feature, so a few soft display/consumer choices can shape the whole user-facing truth story quickly
- if Step 2 drift goes unguarded, later closeout work may see a feature that is numerically correct but semantically inconsistent
- Step 2 should leave behind durable display-contract and consumer-boundary guardrails, not only a one-time review result

### Goal

Add focused guardrails that pin visible totals truth, transparent consumer presentation behavior, and honest team-handoff semantics.

### Success Criteria

- focused tests/guardrails protect the intended League View display contract
- grouping/sorting/handoff boundaries are less likely to drift silently
- future consumer-surface softening is more likely to fail loudly

---

## Step 2 Summary

This step focuses on:

- tightening the visible totals/display contract
- tightening sort/group/navigation boundary honesty
- adding focused guardrails around League View consumer/display truth

This is a **canonical-totals consumer / display-contract / grouping-navigation honesty** step, not a totals-engine or contract-year ownership step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **LV-2A + LV-2B** may be executed together if the needed work concentrates in `leagueViewModel.ts`, `LeagueViewTruthPanel.tsx`, `LeagueConferenceTable.tsx`, and the `GMDashboard.tsx` handoff boundary
- **LV-2C** can then close the step by pinning the intended display-contract / consumer-boundary / team-handoff contract with focused guardrails

Validation can stay tiered:

- use targeted League View consumer/display tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
