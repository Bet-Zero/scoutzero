# TEAM HISTORY — STEP 2 ACTION BREAKDOWN

## World Event Loading, Query Compatibility, and Pagination Truth

---

## TH-2A — Tighten The World-Event Query Contract So Team History Is Less Compatibility-Driven And More Explicitly Owned

### Problem

The Team History world-event loading seam currently works through runtime compatibility fallback across multiple schema combinations:

- `teamCodes` vs `teamsAffected`
- `occurredAt` vs `timestamp`

This is practical, but it means the feature does not yet have one explicit authoritative query contract for world-event retrieval. The loading seam is still compatibility-driven rather than contract-driven.

### Why It Matters

- an "authoritative world events" label is strongest when the query contract itself is explicit and stable
- fallback-driven retrieval can silently mask schema drift rather than forcing the feature to own one real event contract
- Step 2 should leave Team History with a stronger world-event retrieval story before deeper normalization review happens

### Goal

Make the Team History world-event retrieval contract more explicit so the loading seam reads as intentionally owned rather than as a set of runtime guesses.

### Success Criteria

- the world-event query contract is easier to understand directly from the source
- compatibility behavior is more clearly intentional and bounded
- schema drift is less likely to feel like normal retrieval truth
- the authoritative world-event path becomes stronger without requiring a broad event-system rewrite

---

## TH-2B — Tighten Query Compatibility, Dedupe, Empty-State, and Pagination Behavior So Retrieval Truth Is More Durable

### Problem

The world-event loading seam currently combines:

- compatibility fallback
- dedupe by event id
- heuristic `hasMore`
- empty/error/loading state handling
- load-more pagination using a previously selected query config

These pieces are workable, but together they still create a soft retrieval contract.

### Why It Matters

- pagination should remain tied to the same contract as initial load and not drift subtly over time
- empty-state truth should not become ambiguous because compatibility exhaustion and true emptiness look identical internally
- dedupe and ordering behavior should be durable enough that the world-event timeline does not silently flatten or repeat history rows
- Step 2 should leave the load seam more structurally trustworthy before later steps focus on normalization and detail rendering

### Goal

Tighten the retrieval behavior around compatibility, dedupe, empty-state interpretation, and pagination so the Team History world-event load path is more durable and easier to reason about.

### Success Criteria

- load-more remains explicitly tied to the initial winning query contract
- dedupe/order behavior is more clearly intentional and guarded
- empty/error/loading behavior better reflects real retrieval outcomes
- the retrieval seam is less vulnerable to silent drift in pagination or compatibility behavior

---

## TH-2C — Add Focused Guardrails For World-Event Query Compatibility And Pagination Truth

### Problem

The Step 2 risk is largely about the fact that the world-event loading seam has meaningful internal complexity but does not yet appear strongly pinned at the compatibility-matrix level.

Examples of drift risk:

- query priority order could change silently
- a compatibility path could stop working without loud targeted failures
- load-more could drift away from the initial query contract
- empty/error semantics could weaken while still producing superficially acceptable UI behavior

### Why It Matters

- Team History world-event retrieval is the intake seam for authoritative history mode
- if this seam drifts silently, later steps like normalization and detail truth are built on weaker ground
- Step 2 should leave behind a durable retrieval contract, not just a one-time review result

### Goal

Add focused guardrails that pin the intended Team History world-event query compatibility and pagination behavior.

### Success Criteria

- focused tests/guardrails protect the intended compatibility priority order
- focused tests/guardrails protect pagination reuse of the initial winning query config
- important empty/error/loading and dedupe behaviors are easier to verify directly from test coverage
- future retrieval drift is more likely to fail loudly

---

## Step 2 Summary

This step focuses on:

- tightening the world-event query contract
- tightening compatibility / dedupe / pagination / retrieval-truth behavior
- adding focused guardrails around Team History world-event loading

This is a **world-event retrieval / compatibility / pagination** step, not a normalization or detail-rendering pass.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **TH-2A + TH-2B** may be executed together if the needed work concentrates in `useWorldTeamEvents.ts` and the `WorldEventsTimeline` consumption seam
- **TH-2C** can then close the step by pinning the intended query compatibility and pagination contract with focused guardrails

Validation can stay tiered:

- use targeted Team History world-event loading tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
