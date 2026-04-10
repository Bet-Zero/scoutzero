# ARCHITECT SYSTEM INTEGRATION — STEP 4 REVIEW RECORD

## Step
Step 4 — Preview vs Committed-State Consistency

## Purpose
Review whether Architect consistently distinguishes preview/local-only state from committed world state across its major integrated surfaces.

This step is not a local feature correctness pass. It is a system-level consistency review focused on whether non-authoritative state stays honestly labeled, bounded, and separated from committed truth.

## Executive Verdict
**RISK**

Architect now contains several genuinely honest preview/local-only seams.

That is the good news.

The reason this step is not an automatic PASS is that the repo still expresses preview-vs-committed behavior through several different patterns rather than one legible system-wide contract. The live repo shows strong individual seams, but they are distributed across action orchestration, local audit storage, DEV preview surfaces, fixture injection utilities, and base/vacuum local application paths.

The main Step 4 conclusion is:

> Preview/local-only behavior is mostly identified honestly, but the repo still does not read as one fully uniform preview-vs-committed-state model.

This is not evidence that Architect is lying about committed truth.
It is evidence that the remaining consistency work is about making the boundary easier to understand across the full system rather than only inside isolated surfaces.

---

## Scope Reviewed
This review focused on system-level preview/local-only vs committed-state seams, including:

- committed-world action orchestration vs local/base-mode application
- optimistic preview and rollback behavior around persistence
- preview/local audit logging vs authoritative event linkage
- DEV-only preview surfaces vs committed world flows
- DEV-only fixture/state injection vs authoritative persistence surfaces
- preview/gating language used by integrated dashboard sections

## Live Files Reviewed
- `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md`
- `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/utils/capLegality/localCapAuditLog.ts`
- `src/features/architect/capSheet/devCapSheetFixtures.ts`

---

## Exact Preview-vs-Committed System Map Reviewed

### 1. Action-layer world-committed vs local-validated branching
`useArchitectActions.ts` is the largest preview/commit boundary seam reviewed in Step 4.

It now explicitly distinguishes:
- `world-committed`
- `local-validated`

and also hosts several related boundary patterns:
- local validated base/vacuum application
- authoritative world commit plus reload planning
- optimistic local preview before persistence completion
- local preview rollback on persist failure
- local DEV fixture application
- world-only vs non-world action availability

This is the main system-level boundary seam where preview-ish and committed behavior meet.

### 2. World-backed offseason progression vs DEV-only preview
`OffseasonSection.tsx` is one of the clearest preview-vs-committed seams in Architect.

It explicitly separates:
- world-backed committed season advancement
- committed aftermath + follow-up reload reconciliation
- DEV-only offseason preview
- a visible preview-only banner stating that the preview does not persist and is lost on refresh

This is a strong example of a surface that remains honest about preview status.

### 3. Local cap-audit preview state vs authoritative event linkage
`localCapAuditLog.ts` is a dedicated local-only storage seam for:
- base-mode audit events
- optimistic preview flows
- preview/event linkage state

It distinguishes:
- base-mode local storage
- world-preview local storage
- preview markers
- authoritative-event linkage markers
- persist-failed markers

This is not a committed storage authority. It is intentionally local.

### 4. DEV cap-sheet fixture injection vs authoritative state
`devCapSheetFixtures.ts` is a clearly labeled local-only seam.

It explicitly publishes:
- local state owner
- local write path
- `persistence: 'none'`
- `authoritative: false`
- modeled vs not-modeled seam lists

This is one of the more honest non-authoritative surfaces in the repo.

---

## What Is Coherent

### 1. Some major preview surfaces are already very honest
The clearest example is `OffseasonSection.tsx`.

The wrapper keeps:
- committed world advancement
- committed aftermath
- broader reload reconciliation
- DEV preview

as clearly different concepts.

The preview surface is explicitly labeled as preview-only and non-persisting.

### 2. DEV fixture state is clearly non-authoritative
`devCapSheetFixtures.ts` does not pretend to be real data.
It explicitly says:
- local in-memory dashboard state
- no persistence
- non-authoritative intent

That is exactly the kind of honesty Step 4 wants.

### 3. Local cap-audit preview logging is intentionally separate from authoritative event truth
`localCapAuditLog.ts` gives the repo an explicit local stream for preview/base-mode audit history instead of letting those records masquerade as committed world events.

The presence of:
- `preview`
- `authoritativeEventLinked`
- `authoritativeOperationId`
- `persistFailed`

shows the repo is attempting to model the preview-to-authoritative distinction rather than blur it.

### 4. The action layer now explicitly distinguishes world-committed vs local-validated propagation
This is important because it means the repo is not pretending base/vacuum local application is the same as authoritative world commit.

That distinction is one of the strongest foundations for Step 4.

---

## What Is Weak / Risky

### 1. Preview/local-only behavior is still distributed across several different seam types
The repo currently expresses non-authoritative or preview-ish behavior through multiple patterns:

- local validated base/vacuum apply
- optimistic local preview before persistence outcome resolves
- local cap-audit preview logging
- DEV preview surfaces
- DEV fixture injection
- world-only action gating and world-backed commit routing

Each of these seams may be individually honest, but the system still does not read as one unified preview-vs-committed contract.

### 2. `useArchitectActions.ts` carries too much of the boundary burden
The hook is doing many good things, but it is also where several preview/commit distinctions converge:

- local-validated apply
- world-committed reload planning
- optimistic preview and rollback
- local audit preview linkage
- world-only action gating
- DEV fixture dev-tools surfaces

This makes it a likely Step 4 execution pressure point.

### 3. The word “preview” still effectively means different things in different parts of the repo
At least four distinct concepts are present:

- DEV preview that never persists
- local validated base/vacuum apply that is real local state but not committed world truth
- optimistic preview that may later be linked to authoritative persistence or rolled back
- fixture state that is intentionally synthetic and local-only

These are not the same thing, but the repo does not yet present them as one system-wide taxonomy.

That is the most important conceptual Step 4 risk found in the live review.

### 4. Preview-to-authoritative linkage semantics are promising but still easy to underread
The local cap-audit layer captures preview-to-authoritative linkage well enough structurally, but the repo still needs a clearer integrated answer to:

- when preview is allowed
- when preview becomes authoritative
- when preview is rolled back
- when preview is merely diagnostic and should never be read as committed truth

This is not a local utility problem alone. It is a system-integration consistency problem.

---

## Strongest Step 4 Surfaces

### A. Offseason DEV preview vs committed world season advancement
This is the strongest preview-vs-committed seam reviewed in Step 4.

### B. DEV cap-sheet fixtures clearly marked local-only and non-authoritative
This seam is unusually explicit about what it is and what it is not.

### C. Local cap-audit preview log vs authoritative event linkage markers
This seam is structurally honest even if it still needs better system-wide readability.

### D. Explicit world-committed vs local-validated distinction in the action layer
This distinction is one of the key foundations for Step 4 execution.

---

## Highest-Risk Step 4 Surfaces

### A. `useArchitectActions.ts` as the overloaded preview/commit boundary owner
This is the densest and highest-risk Step 4 seam.

### B. Mixed meanings of “preview” across integrated surfaces
This is the biggest conceptual consistency risk found in the live review.

### C. Preview/local-only caller expectations across the full system
The repo still needs a more unified answer to what callers should assume about preview/local-only state depending on the seam.

---

## Preliminary Decomposition Read for Execution
The live Step 4 seams suggest the following likely execution lanes:

### SI-4A — Normalize preview-type vocabulary and ownership markers
Focus on making the different kinds of preview/local-only state easier to distinguish as system concepts.

### SI-4B — Tighten `useArchitectActions.ts` preview vs committed-state contract
Focus on the largest boundary owner in the system.

### SI-4C — Clarify local audit / optimistic preview / persistence outcome semantics
Focus on when preview links forward, when it rolls back, and when it is purely diagnostic.

### SI-4D — Tighten DEV-only / fixture-only / non-authoritative surface boundaries
Focus on keeping synthetic/local-only seams visibly separate from committed truth surfaces.

---

## Final Conclusion
Architect is not failing Step 4 because preview/local-only seams are hidden.

Architect is failing to PASS cleanly because the repo still expresses preview-vs-committed behavior through several different patterns that are individually honest but not yet systemically uniform.

The main Step 4 conclusion is:

> The repo has multiple honest preview/local-only seams, but it still needs structural tightening before those seams read as one coherent preview-vs-committed-state model across Architect.

That is why this step is **RISK**, not **FAIL**.

The system is close.
But the repo is not yet uniform enough in its preview vocabulary, ownership language, and caller expectations to close this step without execution follow-through.
