# LEAGUE VIEW — ISSUE LOG

## Purpose

Problem-level issue history for the League View Truth Pass.
Issues describe underlying system problems, not action task titles.
Status and resolution history are tracked per issue.

---

## STEP 1 — Top-Level Ownership, Data Loading, and Season / Source Boundary Truth

### LV-1-1 — League View top-level ownership is too mixed and inline rather than reading cleanly as a thin league consumer shell

**Status:** OPEN
**Substep:** LV-1A

**Problem:**
The League View top level carries a mix of data wiring, display logic, and conditional rendering inline rather than distributing that responsibility to clearly scoped consumer sections. As a result it reads as one combined feature surface rather than a thin shell that delegates to specialized downstream consumers. The composition seam between data loading, league-level state management, and UI rendering is not clearly drawn at the top level, making the boundary between "what the shell owns" and "what each consumer section owns" harder to identify and harder to keep stable as the feature grows. Inline presence of loading branches, fallback representations, and display logic that belongs in sub-surfaces is the root of the ownership ambiguity.

**Resolution:**
_Not yet resolved._

**Files implicated:**

- _(to be identified during LV-1A execution)_

---

### LV-1-2 — Season / source boundary and failed-load behavior are too implicit, allowing degraded or fallback UI state to present as authoritative loaded league truth

**Status:** OPEN
**Substep:** LV-1B

**Problem:**
When League View data has not fully loaded, is loading from a fallback source, or has encountered a partial failure, the surface does not clearly distinguish that degraded or uncertain state from fully loaded authoritative league truth. The season or source in use may not be clearly signed to the viewer, and failure-state or fallback-state rendering can too easily look like normal authoritative output. This creates a class of silent truthiness risk: a user sees league view content that appears canonical, but the data behind it may be stale, partial, or sourced from a fallback rather than the expected current-season league source. The failure-to-signal problem applies to both the data layer and the UI rendering: neither layer makes the boundary between loaded truth and degraded truth sufficiently explicit.

**Resolution:**
_Not yet resolved._

**Files implicated:**

- _(to be identified during LV-1B execution)_

---

### LV-1-3 — No focused guardrails exist to protect top-level ownership, season-boundary signaling, or loaded-vs-fallback truth

**Status:** OPEN
**Substep:** LV-1C

**Problem:**
The structural contracts that hold top-level League View ownership together — the boundary between shell and consumer sections, the season/source boundary signal, and the distinction between loaded truth and fallback/degraded truth — currently depend on informal convention rather than structural enforcement. There are no focused tests or source guardrails that pin the shell-as-thin-consumer behavior, the season-boundary signal contract, or the loaded-vs-fallback truth policy. This means drift in any of these seams can occur silently as new data sources, season transitions, or feature additions touch the top-level wiring, without any test surface detecting that the intended boundaries have shifted.

**Resolution:**
_Not yet resolved._

**Files implicated:**

- _(to be identified during LV-1C execution)_
