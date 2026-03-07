# ARCHITECT AUDIT V3 90+ IMPLEMENTATION PLAN

## Purpose

This plan describes the most realistic path from the current live score of `86.30 / 100` to a `90+` score under the existing Stage G blueprint.

It is not a repeat of the historical blocker-removal work. That work is already reflected in the live scorecard. This document focuses on the remaining actions that can raise the score further through a mix of product hardening, better runtime proof, and stronger operational confidence.

## Current Starting Point

- Current live score: `86.30 / 100`
- Current live verdict: `Conditionally Ready`
- Current confirmed live ship blockers: `0`
- Main score drag areas:
  - `Operational readiness` (`80`)
  - `Functional flows` (`84`)
  - `UX truthfulness` (`84`)
  - `Rules correctness` (`86`)

## What Has To Happen To Reach 90+

The shortest path is not a large rewrite. It is a targeted hardening pass in three areas:

1. Improve operational confidence by widening regression coverage and stabilizing the review-mode test harness.
2. Add broader runtime proof for important Architect workflows that are currently supported by focused evidence but not yet by wider replay.
3. Fix any medium-quality issues uncovered by that wider proof pass instead of treating them as acceptable drift.

If those three areas are executed cleanly, a move from `86.30` into the low `90s` is realistic.

## Scoring Strategy

The most efficient scoring gains are expected here:

- `Operational readiness`: biggest upside because it is currently the weakest category and is held down mainly by verification posture, not a known product blocker.
- `Functional flows`: moderate upside if wider end-to-end flows stay green after the latest fixes.
- `UX truthfulness`: moderate upside if additional real workflows are proven against persisted world state.
- `Rules correctness`: smaller upside if broader rules-adjacent coverage remains clean.

`Security/boundaries` and `Persistence/data integrity` are already relatively strong, so they are not the highest-yield place to focus first.

## Phase 1 - Stabilize The Verification Harness

### Goal

Raise confidence in the automation itself so score improvements are supported by repeatable evidence rather than one-off successful runs.

### Work items

1. Harden review-mode startup around stale emulator processes and port conflicts.
2. Make the Playwright review-mode path reliably self-cleaning before startup.
3. Preserve the manual fallback path, but treat it as backup rather than the preferred proof route.

### Likely implementation targets

- `scripts/emu/runReviewMode.ts`
- `playwright.config.ts`
- any helper scripts that launch emulators or Vite for review mode

### Success criteria

- review mode starts reliably without manual cleanup
- targeted Architect Playwright rows can run from a cold start more than once in a row
- startup failures from stale port collisions are eliminated or explicitly preflighted with actionable errors

### Expected score impact

- Primary: `Operational readiness`
- Secondary: slight overall confidence lift across all runtime-backed categories

## Phase 2 - Run A Broader Architect Regression

### Goal

Convert the current targeted confidence into wider release confidence.

### Work items

1. Run `npm run test:architect -- --reporter=dot` on the post-fix state.
2. Run `npm run test:diff -- --reporter=dot` if there are still local changes affecting adjacent areas.
3. Record failures as either:
   - real regressions to fix
   - flaky infrastructure problems to isolate
   - known non-Architect noise to explicitly exclude from scoring discussion

### Success criteria

- Architect scoped regression completes cleanly
- no new high-severity regressions appear in offseason, free agency, entitlement, contract, or trade-machine-adjacent flows
- results are recorded in a follow-up audit note or appended live delta artifact

### Expected score impact

- Primary: `Operational readiness`
- Secondary: `Functional flows`, `Rules correctness`, and `UX truthfulness`

## Phase 3 - Expand Runtime Workflow Proof

### Goal

Broaden the number of real user-facing flows that are proven against persisted world state.

### Candidate proof targets

1. Additional entitlement authoring variants beyond the currently proven conflict case.
2. At least one more free-agency or roster-management flow that writes world state and then rehydrates correctly.
3. One broader offseason progression sequence that crosses multiple UI surfaces and confirms persisted state stays truthful.
4. One trade-machine-adjacent save/load path that confirms world consistency after a multi-step action.

### Likely implementation targets

- `e2e/architect-qa.spec.ts`
- supporting review-mode fixtures and seed data
- any targeted helpers used by persisted world-state checks

### Success criteria

- each added proof covers a real user workflow, not just a shallow UI click path
- each proof confirms persisted data and UI truth agree after reload or re-entry where relevant
- no proof relies on hidden debug shortcuts that bypass the real product path

### Expected score impact

- Primary: `Functional flows`
- Primary: `UX truthfulness`
- Secondary: `Persistence/data integrity`

## Phase 4 - Fix Medium-Quality Issues Found By The Wider Pass

### Goal

Use the regression and proof expansion work to remove medium-grade friction instead of just documenting it.

### Work items

1. Triage anything uncovered by Phases 2 and 3 into real defects versus low-value noise.
2. Fix issues that affect user trust, persisted state correctness, or cross-screen consistency.
3. Add focused tests for each real fix so the score gain is durable.

### Decision rule

If a newly found issue would make a user doubt whether Architect saved the correct thing, displayed the correct thing, or enforced the correct rule, it should be fixed before rescoring.

### Expected score impact

- depends on what is found
- this phase is the main route for lifting categories out of the mid-80s if wider proof exposes real edge-case weaknesses

## Phase 5 - Re-Score With Updated Evidence

### Goal

Issue a new live readiness score only after the evidence base has materially improved.

### Work items

1. Update the live delta with new regression and proof results.
2. Recalculate the weighted Stage G score using the same blueprint thresholds.
3. Preserve prior live score artifacts and publish a new additive re-score artifact rather than rewriting history.

### Exit criteria For 90+

The most realistic shape of a `90+` outcome is:

- `Operational readiness` moves materially upward from `68`
- `Functional flows` and `UX truthfulness` each gain a few more points from broader runtime proof
- no new Critical findings appear
- no new High findings remain open without explicit mitigation

## Recommended Execution Order

If the goal is the fastest credible path upward, use this order:

1. Stabilize review-mode startup.
2. Run the broader Architect regression.
3. Fix whatever real issues that run exposes.
4. Add 2-4 more high-value persisted workflow proofs.
5. Re-score.

## What Not To Do

To avoid wasting time, do not do these first:

1. Chase `100 / 100` as a planning target.
2. Rewrite healthy Architect subsystems without evidence of a scoring gain.
3. Inflate the score based on targeted proofs alone if broader regression still shows instability.
4. Spend time polishing low-impact internals before stabilizing the test harness.

## Practical Interpretation

This plan does not assume major missing core functionality remains.

It assumes the remaining path upward is mostly this:

- make the automation more dependable
- prove more real workflows
- fix the medium-grade issues that wider proof reveals
- then re-score with a stronger evidence base

That is the shortest realistic path from `86.30` to `90+`.
