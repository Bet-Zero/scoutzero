# ARCHITECT SYSTEM INTEGRATION — STEP 3 REVIEW RECORD

## Step

Step 3 — Mutation, Reload, and Propagation Integrity

## Purpose

Review whether authoritative actions propagate cleanly and consistently through Architect after real mutations occur.

This step is not a local feature correctness pass. It is a system-level durability review focused on what happens **after** authoritative mutations commit, how committed truth gets reused or re-entered, and whether dashboard-visible state stays aligned with the authoritative read/write model.

## Executive Verdict

**RISK**

Architect now has a real mutation-to-visible-state propagation model.

That is the good news.

The reason this step is not an automatic PASS is that the propagation model is still somewhat distributed and layered across multiple authorities and adapters. The live repo shows a serious, intentional durability structure, but it still expresses some of the most important post-mutation resync rules indirectly:

- sometimes committed truth is reused directly
- sometimes it is reloaded through the read stack
- sometimes both happen in sequence
- world mode and base/vacuum mode intentionally propagate differently
- season advancement uses a committed aftermath surface plus optional broader reload

This is not evidence of a broken system.
It is evidence that the system still has durability seams that deserve structural tightening before whole-feature closeout.

---

## Scope Reviewed

This review focused on the system-level propagation model after authoritative actions, including:

- mutation pipeline committed-write flow
- season/world transition committed-write flow
- changedTeams / reload / fallback behavior
- dashboard-visible resync after committed actions
- world-manager / team-loader / dashboard read-stack re-entry
- world-mode committed propagation vs base/vacuum-mode local propagation
- fail-closed behavior when authoritative post-state cannot be trusted

## Live Files Reviewed

- `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md`
- `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`
- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/utils/teamLoader.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`

---

## Exact Propagation Model Reviewed

### 1. General point-in-time world mutations

`mutationPipeline.ts` remains the general committed-write authority for point-in-time Architect world mutations.

Its live flow is explicitly staged:

- READ current state
- COMPUTE pure result
- VALIDATE legality and post-state durability
- PERSIST canonical world writes + event log + metadata patch
- return changed team/player surfaces for post-commit consumers

This is the primary system-level mutation authority for:

- trades
- signings
- waives
- extensions
- option decisions
- renouncements
- offer-sheet lifecycle mutations
- dead-cap / exceptions world mutations

### 2. Season/world transitions

`seasonManager.ts` remains a sibling committed-write authority rather than a subordinate helper of `mutationPipeline.ts`.

It owns season/world transition persistence, including:

- season advancement
- offseason transition application
- DARE persistence path
- post-state cap validation for the season-advance result
- committed world metadata + event aftermath

This is a distinct mutation authority with a different scope, which is structurally correct.

### 3. Dashboard-side committed mutation orchestration

`useArchitectActions.ts` is the main action-layer propagation seam.

It does not own low-level persistence itself, but it does own the handoff between:

- section/UI intent
- authoritative mutation authorities
- committed aftermath handling
- visible-state sync / reload routing

This is the main place where committed write results are translated back into dashboard-visible state.

### 4. Dashboard reload / visible-state adapter

`useArchitectState.ts` owns the dashboard-visible reload and bundle-application path.

It coordinates:

- world team reloads
- committed snapshot application
- metadata patch application
- roster/index refresh
- stale-drop protection for async world loads

It is the key visible-state durability seam on the dashboard side.

### 5. Read-stack re-entry after commit

The dashboard reload path re-enters through the explicit read stack:

- `useArchitectState.ts`
- `worldTeamData.ts`
- `teamLoader.ts`
- base hydration helpers below that

This matters because Step 3 is not just about successful writes. It is about whether the visible system re-enters through the same truth stack after mutations instead of inventing a parallel local truth path.

---

## What Is Coherent

### 1. `mutationPipeline.ts` is a real fail-closed committed-write authority

The live pipeline still reads as one serious mutation authority rather than a loose collection of helpers.

Important strengths:

- pure compute boundary remains explicit
- persistence remains centralized in `persistWorldMutation(...)`
- post-state validation happens before persistence
- canonical world writes must succeed or the mutation fails
- some mutation families explicitly fail closed when no trustworthy state delta exists

This is strong Step 3 infrastructure.

### 2. Dashboard resync intentionally re-enters through the read stack

`useArchitectState.ts` does not appear to rebuild world/base truth locally.

Instead, post-mutation reload goes back through:

- `loadCoordinatedWorldBundle(...)`
- `loadWorldTeamData(...)`
- `teamLoader.ts`

That is one of the strongest Step 3 qualities in the repo. After authoritative world mutations, the visible system is trying to re-read through the same read stack instead of trusting scattered UI-local reconstruction.

### 3. The repo explicitly distinguishes world-mode propagation from base/vacuum-mode propagation

This distinction is real and coherent:

- world mode: commit authoritative state, then resync visible state through committed snapshot / reload paths
- base/vacuum mode: compute authoritative local next state, validate locally, apply directly without committed world reload

That is not a bug. It is an intentional system distinction.

### 4. Season advancement has a real committed aftermath contract

`seasonManager.ts` returns committed aftermath information rather than only mutating the backend and stopping.

The season-advance path now exposes:

- committed metadata
- committed event identity
- optional focus-team committed snapshot
- post-state validation-backed result shape

This makes the season transition flow act like a real committed authority with a visible aftermath contract.

### 5. Stale-drop / identity-token protection is real and serious

`useArchitectState.ts` has non-trivial durability guards around world reloads:

- request IDs
- world identity tokens
- world-date mutation request IDs
- stale-drop outcomes
- guarded bundle application only when identity/request still match

That shows the repo is correctly treating post-mutation async reload drift as a first-class risk.

---

## What Is Weak / Risky

### 1. The mutation-to-visible-state propagation model is still distributed across many seams

The full durable path currently spans:

- committed write authority (`mutationPipeline.ts` / `seasonManager.ts`)
- action-layer commit orchestration (`useArchitectActions.ts`)
- dashboard reload/state application (`useArchitectState.ts`)
- read-stack re-entry (`worldTeamData.ts` / `teamLoader.ts`)

This distribution is understandable, but it makes the durability story harder to read and easier to drift.

Step 3 exists exactly because a system can be logically correct while still being too distributed to audit confidently.

### 2. Committed propagation currently uses a mixed strategy

The repo visibly uses multiple post-commit propagation patterns:

- reuse `changedTeams` directly when available
- resolve committed snapshot from mutation result first, reload if missing
- pass committed team snapshots into reload helpers as part of a larger resync flow
- for some flows, apply committed aftermath immediately and then optionally perform a broader reload

This is not inherently wrong, but it means the repo still does not express one uniformly obvious propagation rule.

That mixed strategy is the strongest Step 3 risk found in the live review.

### 3. Base-mode propagation still relies on local reconstruction rather than committed re-read

This is intentionally different from world mode.

That is acceptable, but it means the system must be especially clear about the distinction between:

- authoritative committed-world propagation
- authoritative local-base propagation

Right now the distinction is real, but not yet as explicit and uniform as it could be.

### 4. Season aftermath and broader reload are layered together

The season-advance flow uses:

- committed aftermath payloads
- optional broader `onReloadWorldData(...)` resync afterward

That is honest and sensible, but it also means the season transition durability contract is a two-stage handoff rather than a single obvious re-entry rule.

### 5. Some durability confidence depends heavily on guard machinery

The stale-drop and identity-token system is a strength, but it also suggests the propagation model is complicated enough that it needs substantial async safety machinery.

That is not itself a blocker.
But it is a sign that Step 3 execution should probably focus on making the propagation model easier to follow and less dependent on readers mentally composing multiple layers.

---

## Strongest Step 3 Surfaces

### A. General world mutation authority → fail-closed persistence

`mutationPipeline.ts` remains the strongest single committed mutation surface in the system.

### B. Dashboard reload re-entry through the explicit read stack

The `useArchitectState.ts` → `worldTeamData.ts` → `teamLoader.ts` path is one of the strongest and most systemically correct parts of the repo.

### C. Season advance committed aftermath contract

`seasonManager.ts` now exposes enough committed aftermath structure to participate honestly in system-level propagation.

### D. Async stale-drop protection in dashboard state

The dashboard reload owner has a meaningful stale-request protection model.

---

## Highest-Risk Step 3 Surfaces

### A. Mixed post-commit propagation strategy

This is the biggest Step 3 risk.

The repo still uses a combination of:

- changed-team direct reuse
- committed snapshot reuse
- reload fallback
- aftermath + reload layering

That mixed strategy works, but it is the seam most likely to produce future drift.

### B. `useArchitectActions.ts` ↔ `useArchitectState.ts` durability contract

This handoff is real, but it is still one of the densest integration seams in the repo because it decides whether to:

- apply mutation results directly
- resolve committed snapshots
- trigger reloads
- patch metadata first
- drop stale results

### C. Season advancement aftermath ↔ dashboard reload consistency

This seam is healthier than before, but still deserves structural tightening because it uses both aftermath payload truth and broader reload truth.

### D. World-mode vs base-mode propagation clarity

The distinction is valid but still not yet expressed with maximum clarity as a system-level propagation rule.

---

## Preliminary Decomposition Read for Execution

The live Step 3 seams suggest the following likely execution lanes:

### SI-3A — Normalize committed mutation result → reload contract language

Focus on making the mutation-result / committed-snapshot / reload-fallback chain easier to read and harder to misuse.

### SI-3B — Tighten `useArchitectActions.ts` ↔ `useArchitectState.ts` propagation contract

Focus on the main action-to-visible-state durability seam.

### SI-3C — Clarify season-advance aftermath vs broader world reload contract

Focus on making the season-transition propagation model more explicit and durable.

### SI-3D — Clarify world-mode vs base/vacuum-mode propagation boundaries

Focus on expressing the difference between committed-world propagation and validated local propagation more clearly.

### SI-3E — Pressure-test stale-drop / async reload durability guards

Focus on whether the current anti-stale machinery is adequately protecting the propagation model or only compensating for unclear structure.

---

## Final Conclusion

Architect now has a real mutation/reload/propagation system.

That means Step 3 is not discovering the absence of a durability model.
It is discovering that the durability model is now advanced enough to require structural tightening at the integration level.

The main Step 3 conclusion is:

> The post-mutation propagation model is mostly coherent, but it is still expressed through too many layered seams and too many mixed resync strategies to pass cleanly without follow-up work.

That is why this step is **RISK**, not **FAIL**.

The system is not breaking apart.
But the repo is not yet simple enough, uniform enough, or explicit enough in its propagation contracts to treat the durability layer as fully closed without execution follow-through.
