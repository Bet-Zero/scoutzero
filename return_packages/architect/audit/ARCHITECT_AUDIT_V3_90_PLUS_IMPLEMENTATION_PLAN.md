# ARCHITECT AUDIT V3 90+ IMPLEMENTATION PLAN

## Purpose

This plan describes the most realistic path from the current live score of `86.30 / 100` to a `90+` score under the existing Stage G blueprint.

It is not a repeat of the historical blocker-removal work. That work is already reflected in the live scorecard. This document focuses on the remaining actions that can raise the score further through a mix of product hardening, better runtime proof, and stronger operational confidence.

It is not a mandate to keep working forever. The practical project goal is to finish one bounded post-audit closure cycle, re-score once, and then stop score-specific work unless a new product issue appears.

## Practical Project Decision

Use the score as a decision aid, not as an endless optimization target.

For this project, the recommended stopping rule is:

1. Keep the current live state as the baseline release candidate because there are no confirmed live ship blockers.
2. Complete one bounded follow-up cycle aimed at raising confidence in the heaviest-weight categories.
3. Re-score once after that cycle.
4. Stop score-specific work after that re-score and return to normal product backlog work, even if the score is still below `100 / 100`.

The reason is simple: the blueprint can always reward more proof, more hardening, and more regression coverage. That does not mean the project should stay trapped in audit-mode indefinitely.

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

## Required vs Optional

### Required for this closure cycle

1. Keep the review-mode harness stable enough that Playwright-managed proof can run without leaving stale listeners behind.
2. Add a small number of additional persisted-world proofs in the highest-yield workflow areas.
3. Fix only the real product issues those proofs expose.
4. Re-score once with the updated evidence.

### Optional after this closure cycle

1. Any further score maximization after the next re-score.
2. Chasing `100 / 100` as an audit target.
3. Broader polish work that is not required for release confidence or product correctness.

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

### Current status

Completed on March 7, 2026.

Evidence now includes:

- hardened teardown and child-process cleanup in `scripts/emu/runReviewMode.ts`
- explicit graceful shutdown in `playwright.config.ts` for review-mode `webServer`
- successful managed proof run: `PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npm run test:e2e -- e2e/architect-qa.spec.ts --grep "D-MQ-002:" --reporter=line`
- post-run port check confirmed review-mode listeners were cleaned up after the Playwright-managed run

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

1. One legal trade execution flow that proves world writes, cap/history updates, and post-action truth across multiple surfaces.
2. One team-history or event-backed flow that proves persisted world events rehydrate truthfully in the UI.
3. Optional only if needed after those two: one broader offseason progression sequence that crosses multiple UI surfaces and confirms persisted state stays truthful.
4. Optional only if needed after those two: one additional entitlement or free-agency variant beyond the already-proven conflict/save cases.

### Likely implementation targets

- `e2e/architect-qa.spec.ts`
- supporting review-mode fixtures and seed data
- any targeted helpers used by persisted world-state checks

### Success criteria

- each added proof covers a real user workflow, not just a shallow UI click path
- each proof confirms persisted data and UI truth agree after reload or re-entry where relevant
- no proof relies on hidden debug shortcuts that bypass the real product path

### Scope cap for this audit cycle

Do not add an unlimited number of proofs.

The recommended cap is:

1. Add 2 high-value new persisted proofs.
2. Fix any real product issues those 2 proofs expose.
3. Re-score.

If those 2 proofs do not produce enough evidence to cross `90`, stop the score-focused cycle anyway and treat the remaining gap as backlog, not as a reason to stay in permanent audit mode.

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

## Concrete Stop Condition

This plan is complete when all of the following are true:

1. Phase 1 remains green and repeatable.
2. Exactly 2 additional high-value persisted proofs have been attempted.
3. Any real defects uncovered by those proofs are either fixed or explicitly documented as backlog.
4. The live score has been recomputed one more time.
5. A final recommendation is issued: either `Ready`, `Conditionally Ready`, or `Stop score work and move on`.

Do not continue score work past that point unless a new product regression appears or the user explicitly requests another audit cycle.

## Closure Status

Completed on March 8, 2026.

The stop condition is now satisfied:

1. Phase 1 remained green.
2. Exactly 2 additional high-value persisted proofs were added and are green (`D-MQ-003`, `D-MQ-008`).
3. The real issues those proofs exposed were fixed in the review-world proof path.
4. The live score was recomputed.
5. The final live recommendation is now `Ready` under the existing Stage G threshold.

## Recommended Execution Order

If the goal is the fastest credible path upward, use this order:

1. Treat review-mode startup stabilization as complete unless it regresses.
2. Add 2 high-value persisted workflow proofs.
3. Fix whatever real issues those proofs expose.
4. Re-score once.
5. Stop the audit cycle.

## What Not To Do

To avoid wasting time, do not do these first:

1. Chase `100 / 100` as a planning target.
2. Rewrite healthy Architect subsystems without evidence of a scoring gain.
3. Inflate the score based on targeted proofs alone if broader regression still shows instability.
4. Spend time polishing low-impact internals before stabilizing the test harness.
5. Treat `100 / 100` as the definition of project completion.

## Practical Interpretation

This plan does not assume major missing core functionality remains.

It assumes the remaining path upward is mostly this:

- make the automation more dependable
- prove more real workflows
- fix the medium-grade issues that wider proof reveals
- then re-score with a stronger evidence base

That is the shortest realistic path from `86.30` to `90+`.

It is also the recommended end of the current audit cycle. After that, the project should return to normal engineering priorities instead of staying in score-maximization mode.
