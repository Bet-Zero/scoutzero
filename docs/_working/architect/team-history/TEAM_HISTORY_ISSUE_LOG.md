# TEAM HISTORY — ISSUE LOG

Problem-level issues surfaced during the Team History review. Each issue describes an underlying system problem, not an action task title.

---

## STEP 1 — Top-Level Ownership, Composition, and Source-Selection Truth

---

### TH-1-1 — The top-level Team History UI under-describes which history source is actually active

**Status:** RESOLVED  
**Substep:** TH-1A  

**Problem:**

`TeamHistoryTab` can render from four materially different truth paths — world-event timeline, explicit local `historyTimeline`, section-derived synthesized timeline, and DEV fixture-injected history — but the UI only communicates a coarse "World mode" vs "Base mode" banner. The banner does not indicate whether the user is viewing authoritative world-event history, a local fallback timeline, or synthetic fixture data. This means the user-facing source signal is weaker than the actual source-selection logic, making the feature appear more authoritative than it may be.

**Resolution:**

`TeamHistoryTab` now resolves and surfaces one explicit active timeline source at the top-level banner: `Authoritative world events`, `DEV fixture override`, `Explicit local timeline`, or `Section-derived fallback`. The top-level Team History shell now tells the user which truth path is active instead of only reporting coarse world/base scope.

---

### TH-1-2 — World / base / fixture source-selection at the top level reads as incidental branching rather than an explicit contract

**Status:** RESOLVED  
**Substep:** TH-1B  

**Problem:**

The top-level source-selection chain (`worldId + no fixtures → world events; else historyTimeline; else synthesize`) is functional but is not expressed as an intentional, structurally owned contract. The fixture injection path is particularly significant: it suppresses the world-event timeline entirely even when `worldId` is present, but this behavior is not surfaced as a first-class ownership decision. The four truth paths feel loosely stacked rather than explicitly ordered, which increases the risk of drift as the feature evolves.

**Resolution:**

`TeamHistoryTab` now routes source ownership through one explicit resolver contract with a named priority order:

1. DEV fixture override owns the timeline while active.
2. Otherwise, an active world owns the timeline through authoritative world events.
3. Outside world-event mode, explicit local `historyTimeline` rows take priority.
4. Section-derived synthesis is the final fallback.

The fixture override path also now fail-closes from the actual team data, so injected fixture markers still suppress the world-event path even if an upstream boolean is missing or stale.

---

### TH-1-3 — Top-level source-selection behavior has no focused guardrails and can drift silently

**Status:** RESOLVED  
**Substep:** TH-1C  

**Problem:**

Nothing in the current test surface pins the intended Team History shell behavior — specifically, the priority ordering of world-event vs local-timeline vs synthesized vs fixture paths, and the rule that fixture injection suppresses the world path even when `worldId` exists. Without guardrails, future contributors can weaken source-selection clarity, change fallback ordering, or expand the fixture override scope without any test failing. The risk is compounded by the fact that Team History composes multiple sub-surfaces (`WaiveStretchTracker`, `ExceptionHistoryTracker`, `DraftPickTracker`), so top-level shell drift affects the integrity of all of those composed views.

**Resolution:**

This execution added a dedicated top-level source-selection guardrail matrix that now protects the intended shell contract directly:

1. fixture override wins when active
2. otherwise world-event mode wins when `worldId` exists
3. otherwise explicit local `historyTimeline` wins
4. otherwise synthesized fallback is used

The new guardrails also pin banner/path alignment and fixture-marker override safety, including the fail-closed rule that actual fixture markers in team data still suppress world-event mode even when an upstream boolean is false or stale.

---

## STEP 2 — World Event Loading, Query Compatibility, and Pagination Truth

---

### TH-2-1 — The world-event query seam is compatibility-driven rather than contract-driven

**Status:** OPEN
**Substep:** TH-2A

**Problem:**

`useWorldTeamEvents.ts` owns world-event retrieval for Team History but does not operate on one explicit authoritative query contract. Instead, it tries four schema combinations at runtime — `teamCodes` vs `teamsAffected` crossed with `occurredAt` vs `timestamp` — until one returns results. This means the loading seam is performing schema repair at runtime rather than executing a known stable world-event contract. The "authoritative world events" label applied by the Team History shell is therefore stronger than the actual retrieval mechanics. Schema drift can propagate silently because the compatibility fallback loop absorbs it rather than surfacing it.

---

### TH-2-2 — Retrieval truth around compatibility fallback, dedupe, empty-state, and pagination is softer than the feature's authoritative claim warrants

**Status:** OPEN
**Substep:** TH-2B

**Problem:**

Several retrieval behaviors in the world-event loading seam combine to produce a contract that is workable but structurally softer than expected for an authoritative history mode. Empty-state results are ambiguous — compatibility exhaustion and true event absence produce identical output. Dedupe is id-only rather than semantically grounded. `hasMore` is heuristic (`docs.length >= limit`) rather than explicit. Load-more pagination correctly reuses the initially selected query config, but there is no structural enforcement preventing that config from drifting subtly as the hook evolves. Together these behaviors mean retrieval truth is a reasonable approximation rather than a durable contract.

---

### TH-2-3 — The world-event compatibility matrix and pagination contract have no focused guardrails

**Status:** OPEN
**Substep:** TH-2C

**Problem:**

The internal complexity of `useWorldTeamEvents.ts` — query priority order, compatibility fallback chain, pagination reuse of the selected config, empty/error state semantics — is not pinned by focused tests targeting these behaviors directly. Higher-level integration tests exercise world-boundary behavior at the shell level but do not guard the compatibility matrix itself. This means the intended query priority order can change silently, a compatibility path can stop working without a targeted failure, and load-more can drift away from the initial winning contract without any test catching it.

---
