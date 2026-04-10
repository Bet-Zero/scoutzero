# ARCHITECT SYSTEM INTEGRATION — STEP 4 ACTION BREAKDOWN

## Step

Step 4 — Preview vs Committed-State Consistency

## Step Goal

Convert the Step 4 review findings into the smallest real execution lanes that make Architect’s preview/local-only behavior easier to distinguish from committed world state across the integrated system.

This step is not a broad architecture rewrite. It is about tightening the most important preview-vs-committed consistency seams identified in the Step 4 review record.

---

## Summary of What Step 4 Found

The live repo now contains several genuinely honest preview/local-only seams.

The problem is not that Architect hides preview state or pretends every surface is authoritative.
The problem is that the repo still expresses preview-vs-committed behavior through several different patterns rather than one legible system-wide contract.

The most important Step 4 risks are:

1. preview/local-only behavior is still distributed across several seam types
2. `useArchitectActions.ts` carries too much of the preview/commit boundary burden
3. the word “preview” effectively means different things in different parts of the repo
4. preview-to-authoritative linkage semantics are promising but still too easy to underread

The key Step 4 need is not to invent new behavior.
It is to make existing non-authoritative behavior easier to identify, classify, and reason about as one connected system.

---

## Execution Substeps

### SI-4A — Normalize preview-type vocabulary and ownership markers

#### Purpose

Make the different kinds of preview/local-only state easier to distinguish as system concepts.

#### Why This Matters

The repo currently contains several distinct non-authoritative seam types:

- DEV preview that never persists
- local validated base/vacuum application
- optimistic preview that may later link to authoritative persistence or roll back
- synthetic fixture state that is explicitly local-only
- local preview/audit records that should never be mistaken for committed world events

These are not the same thing, but the repo does not yet present them as one clear preview taxonomy.

#### Scope Focus

Prioritize the integrated surfaces where preview/local-only meaning is published or implied, especially:

- `useArchitectActions.ts`
- `OffseasonSection.tsx`
- `localCapAuditLog.ts`
- `devCapSheetFixtures.ts`

The goal is not to add generic comments everywhere.
The goal is to make the different non-authoritative seam types materially easier to distinguish.

#### Desired Outcome

A contributor should be able to tell:

- what counts as preview-only
- what counts as local validated apply
- what counts as optimistic local preview
- what counts as synthetic DEV-only state
- what counts as committed world state

#### Completion Standard

Complete when the repo is materially more consistent in how it names and frames the different preview/local-only seam types.

---

### SI-4B — Tighten `useArchitectActions.ts` preview vs committed-state contract

#### Purpose

Make the main action-layer preview/commit boundary easier to understand and less overloaded.

#### Why This Matters

`useArchitectActions.ts` is the densest Step 4 seam. It currently contains multiple overlapping boundary patterns:

- local validated apply
- world committed reload planning
- optimistic local preview and rollback
- local audit preview linkage
- world-only action gating
- local DEV fixture tooling

This is a real integration seam, but it needs clearer contract framing so contributors do not have to reverse-engineer which layer owns which kind of non-authoritative state.

#### Scope Focus

Prioritize the preview/commit contract inside:

- `useArchitectActions.ts`

and any immediately relevant local helper/type surfaces only if truly needed to make the contract truthful.

#### Desired Outcome

A contributor should be able to answer:

- what kinds of non-authoritative state the action layer may own
- what it must never present as committed world truth
- where optimistic preview begins and ends
- where rollback responsibility lives
- where committed-state ownership resumes

#### Completion Standard

Complete when `useArchitectActions.ts` is materially easier to read as a preview/commit boundary owner and less likely to blur those concepts.

---

### SI-4C — Clarify local audit / optimistic preview / persistence outcome semantics

#### Purpose

Make the relationship between local preview logging, optimistic apply, persistence success, authoritative linkage, and rollback easier to follow.

#### Why This Matters

The repo already has the right building blocks:

- preview markers
- authoritative linkage markers
- persist-failed markers
- separate local storage streams

But the integrated system still needs a clearer answer to:

- when preview is allowed
- when preview links forward to authoritative persistence
- when preview rolls back
- when preview is diagnostic-only and must never be read as committed truth

#### Scope Focus

Prioritize the semantics across:

- `localCapAuditLog.ts`
- directly relevant optimistic preview / persistence helper logic in `useArchitectActions.ts`

#### Desired Outcome

A contributor should be able to tell:

- what local audit records represent
- when they are only preview records
- when they are linked to authoritative commit
- when they represent failed persistence and rollback
- what caller expectations should be around those records

#### Completion Standard

Complete when the preview-to-authoritative linkage semantics are materially easier to understand and less likely to be misread.

---

### SI-4D — Tighten DEV-only / fixture-only / non-authoritative surface boundaries

#### Purpose

Keep synthetic/local-only seams visibly separate from committed truth surfaces.

#### Why This Matters

The repo already does a decent job here, especially in:

- `OffseasonSection.tsx`
- `devCapSheetFixtures.ts`

But Step 4 still needs to make sure those boundaries read consistently enough at the system level, not only inside isolated files.

#### Scope Focus

Prioritize the clearest local/non-authoritative surfaces, especially:

- DEV offseason preview
- DEV cap-sheet fixtures
- any directly relevant wrapper/action publication surfaces that expose those seams to the dashboard

#### Desired Outcome

A contributor should be able to tell:

- what is DEV-only
- what is synthetic/fixture-only
- what never persists
- what should never be confused with committed truth

#### Completion Standard

Complete when the repo presents these non-authoritative surfaces more consistently and more durably as intentionally separate from committed world state.

---

## Suggested Execution Batching

### Preferred first execution batch

**SI-4A + SI-4B together**

Why:

- both are centered on the main preview/commit vocabulary and boundary owner in the system
- both strengthen the highest-value conceptual seam before going deeper into linkage semantics
- both help define the shared language needed for the rest of Step 4

### Preferred second execution batch

**SI-4C + SI-4D together**

Why:

- both are easier to tighten once preview-type vocabulary and action-layer ownership are clearer
- both focus on supporting seams that should follow the language established in the first batch
- both can likely be completed narrowly if the first batch lands cleanly

### Alternative

If live overlap during execution is stronger than expected, SI-4C may partially overlap with SI-4B.
That should only happen if the work remains tightly focused on preview-vs-committed consistency rather than broad cleanup.

---

## Non-Goals for Step 4 Execution

The following should NOT become Step 4 execution work:

- reopening Step 1 / Step 2 / Step 3 work except for tiny contradiction fixes strictly required by this step
- broad action-layer refactors unrelated to preview-vs-committed consistency
- product behavior redesign of offseason, free agency, or trade flows
- generalized documentation work that does not materially improve preview/commit consistency
- broad reload-stack redesign
- broad dev-tooling expansion

Step 4 execution should remain tightly scoped to preview/local-only vs committed-state consistency.

---

## Step 4 Success Condition

Step 4 will be considered structurally successful when all of the following are true:

1. the repo is more consistent in how it distinguishes different preview/local-only seam types
2. `useArchitectActions.ts` is easier to read as a preview/commit boundary owner
3. local audit / optimistic preview / persistence outcome semantics are easier to follow
4. DEV-only / fixture-only / non-authoritative surfaces are more consistently and durably separated from committed truth

If those conditions are met, whole-feature closeout can evaluate Architect System Integration as one connected system with a much stronger boundary between preview/local-only state and committed world state.
