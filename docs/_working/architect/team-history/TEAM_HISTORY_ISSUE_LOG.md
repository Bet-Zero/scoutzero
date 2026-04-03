# TEAM HISTORY — ISSUE LOG

Problem-level issues surfaced during the Team History review. Each issue describes an underlying system problem, not an action task title.

---

## STEP 1 — Top-Level Ownership, Composition, and Source-Selection Truth

---

### TH-1-1 — The top-level Team History UI under-describes which history source is actually active

**Status:** OPEN  
**Substep:** TH-1A  

**Problem:**

`TeamHistoryTab` can render from four materially different truth paths — world-event timeline, explicit local `historyTimeline`, section-derived synthesized timeline, and DEV fixture-injected history — but the UI only communicates a coarse "World mode" vs "Base mode" banner. The banner does not indicate whether the user is viewing authoritative world-event history, a local fallback timeline, or synthetic fixture data. This means the user-facing source signal is weaker than the actual source-selection logic, making the feature appear more authoritative than it may be.

---

### TH-1-2 — World / base / fixture source-selection at the top level reads as incidental branching rather than an explicit contract

**Status:** OPEN  
**Substep:** TH-1B  

**Problem:**

The top-level source-selection chain (`worldId + no fixtures → world events; else historyTimeline; else synthesize`) is functional but is not expressed as an intentional, structurally owned contract. The fixture injection path is particularly significant: it suppresses the world-event timeline entirely even when `worldId` is present, but this behavior is not surfaced as a first-class ownership decision. The four truth paths feel loosely stacked rather than explicitly ordered, which increases the risk of drift as the feature evolves.

---

### TH-1-3 — Top-level source-selection behavior has no focused guardrails and can drift silently

**Status:** OPEN  
**Substep:** TH-1C  

**Problem:**

Nothing in the current test surface pins the intended Team History shell behavior — specifically, the priority ordering of world-event vs local-timeline vs synthesized vs fixture paths, and the rule that fixture injection suppresses the world path even when `worldId` exists. Without guardrails, future contributors can weaken source-selection clarity, change fallback ordering, or expand the fixture override scope without any test failing. The risk is compounded by the fact that Team History composes multiple sub-surfaces (`WaiveStretchTracker`, `ExceptionHistoryTracker`, `DraftPickTracker`), so top-level shell drift affects the integrity of all of those composed views.

---
