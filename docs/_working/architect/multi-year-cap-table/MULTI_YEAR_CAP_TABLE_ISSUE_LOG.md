# MULTI-YEAR CAP TABLE — ISSUE LOG

## Purpose

Problem-level issue history for the Multi-Year Cap Table Truth Pass.
Issues describe underlying system problems, not action task titles.
Status and resolution history are tracked per issue.

---

## STEP 1 — Top-Level Ownership, Year Selection, and Surface Boundary Truth

### MYCT-1-1 — The top-level cap-table shell mixes multi-year totals viewing with current-year-only adjacent authority in a way that can create year-truth ambiguity

**Status:** OPEN

**Problem:**
The Multi-Year Cap Table shell presents as one unified feature surface, but internally it carries two different kinds of truth simultaneously: multi-year cap-table viewing driven by `selectedYear`, and current-year-only adjacent authority for hard-cap, exception, and TPE truth. The boundary is disclosed via `ExceptionTracker`'s fail-closed panel, but the shell-level year-truth model is still split rather than unified. A user navigating to a future year encounters one cap-table shell where some parts remain authoritative and others deliberately stop being authoritative, without that distinction being clearly signaled at the top-level feature shell. This creates a year-truth ambiguity risk that lives above the component level.

**Files implicated:**

- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`

---

### MYCT-1-2 — Top-level ownership boundaries between `CapSheetSection.tsx`, `CapSheet.tsx`, and adjacent surfaces are broader and less explicit than ideal

**Status:** OPEN

**Problem:**
`CapSheetSection.tsx` functions as the dashboard handoff but owns more than a thin passthrough: it holds `selectedYear` state, manages the sync reset from `currentYear`, controls DEV fixture panel exposure, and defines the split between the primary cap-sheet surface and the adjacent exception surface. `CapSheet.tsx` is the true main composition/control surface, but because `CapSheetSection` retains these responsibilities, the ownership contract between the two layers is broad rather than minimal. The story of "who owns what" at the top level is understandable but not as explicit as it needs to be — meaning future changes may widen the wrong layer without a clear structural signal.

**Files implicated:**

- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`

---

### MYCT-1-3 — There are no focused guardrails pinning selected-year handoff behavior or current-year-only adjacent surface boundary truth at the top-level shell

**Status:** OPEN

**Problem:**
The top-level shell contract is honest but has no durable guardrails protecting it from silent drift. Specific failure modes exist with no dedicated coverage: future-year viewing could stop presenting current-year-only authority limits clearly; section-level `selectedYear` ownership could drift; `ExceptionTracker` could gradually act as a multi-year authoritative surface without loud test failures; DEV fixture panel wiring or handoff boundaries could shift in ways that weaken the intended shell contract. Because this shell defines how every deeper cap-table seam is initially interpreted, undiscovered drift here risks invalidating assumptions across all later Multi-Year Cap Table truth-pass steps.

**Files implicated:**

- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`

---

_Issue log tracks problem-level root causes. Execution substeps and status tracking live in MULTI_YEAR_CAP_TABLE_REVIEW_TRACKER.md._
