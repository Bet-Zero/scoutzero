# ARCHITECT SYSTEM INTEGRATION — STEP 3 ACTION BREAKDOWN

## Step
Step 3 — Mutation, Reload, and Propagation Integrity

## Step Goal
Convert the Step 3 review findings into the smallest real execution lanes that make Architect’s post-mutation propagation model clearer, more uniform, and harder to drift across authoritative write paths, dashboard sync seams, and visible-state reload surfaces.

This step is not a broad architecture rewrite. It is about tightening the most important system-level propagation seams identified in the Step 3 review record.

---

## Summary of What Step 3 Found
The live repo now has a real mutation-to-visible-state propagation model.

The problem is not that the system lacks durability. The problem is that several of the most important post-mutation resync rules are still expressed through layered or mixed strategies:

- sometimes committed truth is reused directly
- sometimes committed truth is reloaded through the read stack
- sometimes both happen in sequence
- world mode and base/vacuum mode intentionally propagate differently
- season advancement uses committed aftermath plus optional broader reload
- async stale-drop protection is strong, but it also signals a propagation model that is still distributed and easy to underread

The most important Step 3 risks are:

1. committed mutation result → reload rules are still too mixed and indirect
2. the `useArchitectActions.ts` ↔ `useArchitectState.ts` durability contract is one of the densest seams in the system
3. season-advance aftermath vs broader reload is coherent but not yet explicit enough as one propagation contract
4. world-mode and base/vacuum-mode propagation boundaries are real but not uniformly expressed
5. stale-drop / async reload safety is meaningful, but its guardrail/durability story may still be too implicit

---

## Execution Substeps

### SI-3A — Normalize committed mutation result → reload contract language

#### Purpose
Make the mutation-result / committed-snapshot / reload-fallback chain easier to read and harder to misuse.

#### Why This Matters
The live repo currently uses a mixed propagation strategy after committed mutations:

- changed-team reuse when available
- committed snapshot resolution when needed
- read-stack reload fallback when direct committed state is unavailable
- partial pre-application of committed state before broader reload in some flows

That is workable, but too layered and easy to misread as one uniform rule.

#### Scope Focus
Prioritize the places where committed mutation aftermath is interpreted and forwarded, especially:

- `mutationPipeline.ts` result shape expectations
- `useArchitectActions.ts` committed snapshot resolution paths
- any directly relevant result-shape helpers that define how authoritative mutation aftermath is consumed

#### Desired Outcome
A contributor should be able to answer:

- when a mutation result may be reused directly
- when a committed snapshot must be resolved
- when a broader reload is required
- what the preferred propagation order is after authoritative world mutations

#### Completion Standard
Complete when the post-mutation propagation contract is materially easier to explain and less dependent on readers inferring the rules from several helper layers.

---

### SI-3B — Tighten `useArchitectActions.ts` ↔ `useArchitectState.ts` propagation contract

#### Purpose
Make the main action-to-visible-state durability seam clearer and more explicit.

#### Why This Matters
This is one of the densest cross-surface seams in Architect. It decides whether to:

- apply mutation results directly
- resolve committed snapshots
- patch metadata
- trigger world reloads
- refresh roster bundles
- drop stale async results

This seam is central to whether committed truth actually becomes visible truth cleanly.

#### Scope Focus
Prioritize the propagation contract across:

- `useArchitectActions.ts`
- `useArchitectState.ts`

and any immediately relevant types/helpers that define the handoff between them.

#### Desired Outcome
A contributor should be able to answer:

- what the action layer is responsible for after commit
- what the state layer is responsible for during resync
- where metadata patching belongs
- where stale-drop ownership belongs
- which layer decides direct reuse vs reload

#### Completion Standard
Complete when the main action/state propagation seam is materially easier to read and less likely to drift.

---

### SI-3C — Clarify season-advance aftermath vs broader world reload contract

#### Purpose
Make the season-transition propagation model more explicit and durable.

#### Why This Matters
The season-advance flow is healthier than before, but it still uses a layered propagation strategy:

- committed aftermath payloads are applied immediately
- broader world reload may run afterward
- the UI must remain honest if reload fails after the season advance already committed

This is coherent, but it is not yet expressed clearly enough as one contract.

#### Scope Focus
Prioritize the propagation seam across:

- `seasonManager.ts`
- `OffseasonSection.tsx`
- any directly relevant reload helper or season-advance aftermath shape used by the dashboard

#### Desired Outcome
A contributor should be able to answer:

- what the committed aftermath guarantees
- when broader reload is still needed
- what should happen if aftermath exists but reload fails
- which layer owns visible-state reconciliation after season advance

#### Completion Standard
Complete when the season-advance propagation contract is materially clearer and less likely to drift between aftermath handling and reload handling.

---

### SI-3D — Clarify world-mode vs base/vacuum-mode propagation boundaries

#### Purpose
Make the difference between committed-world propagation and validated local propagation more explicit.

#### Why This Matters
This distinction is real and intentional:

- world mode commits and then re-enters through committed snapshot/reload paths
- base/vacuum mode computes, validates, and applies local next state directly

That distinction is valid, but it is still not expressed as clearly or uniformly as it should be.

#### Scope Focus
Prioritize the highest-value propagation seams where this distinction matters, especially:

- `useArchitectActions.ts`
- trade / signing / mutation apply paths that branch world vs base mode
- directly relevant dashboard-visible state application helpers

#### Desired Outcome
A contributor should be able to tell:

- what counts as committed-world propagation
- what counts as validated local propagation
- what guarantees differ between those modes
- which layer owns the mode boundary

#### Completion Standard
Complete when the world-mode vs base/vacuum-mode propagation distinction is materially easier to understand and less likely to blur across features.

---

### SI-3E — Pressure-test stale-drop / async reload durability guards

#### Purpose
Evaluate whether the current anti-stale machinery is adequately protecting the propagation model and whether its ownership is explicit enough.

#### Why This Matters
The dashboard state layer has serious async safety machinery:

- request IDs
- active-world identity tokens
- mutation request IDs
- stale-drop outcomes
- guarded bundle application

That is good, but Step 3 needs to confirm whether the current guard system is:
- a clear durability contract
- or mostly implicit safety glue readers must discover manually

#### Scope Focus
Prioritize the stale-protection surfaces in:

- `useArchitectState.ts`
- any directly relevant action/state bridge helpers that depend on stale-drop semantics
- targeted guardrails/tests if needed

#### Desired Outcome
A contributor should be able to answer:

- what stale-drop protects against
- which layer owns stale-drop enforcement
- what a caller should expect when async propagation loses identity freshness
- whether the current guard model is sufficiently explicit and durable

#### Completion Standard
Complete when the anti-stale durability contract is more explicit and the repo is less dependent on readers reverse-engineering the async safety rules.

---

## Suggested Execution Batching

### Preferred first execution batch
**SI-3A + SI-3B together**

Why:
- both are centered on the general mutation-result → visible-state propagation model
- both tighten the most important non-season propagation seam in Architect
- both help define the shared contract language before handling the more specialized season/base-vs-world distinctions

### Preferred second execution batch
**SI-3C + SI-3D together**

Why:
- both deal with mode-specific propagation distinctions
- both are easier to tighten once the general committed-mutation propagation language is clearer
- both are likely to benefit from the first-batch contract normalization

### Preferred third execution batch
**SI-3E**

Why:
- stale-drop / async durability cuts across the previous batches
- it may be best judged after the core propagation contracts are clarified
- it may require targeted guardrails rather than only code-comment clarity

### Alternative
If live overlap during execution is stronger than expected, SI-3D and SI-3E may partially overlap and be batched together.
That should only happen if the work remains tightly focused on propagation durability rather than broad cleanup.

---

## Non-Goals for Step 3 Execution
The following should NOT become Step 3 execution work:

- reopening local feature correctness reviews already completed in prior steps
- broad refactors across all action/state files
- opportunistic performance cleanup unrelated to propagation durability
- generalized documentation work that does not materially improve post-mutation propagation clarity
- mutation-logic correctness rewrites outside the propagation contract
- rewriting the entire world/base architecture

Step 3 execution should remain tightly scoped to mutation, reload, and visible-state propagation integrity.

---

## Step 3 Success Condition
Step 3 will be considered structurally successful when all of the following are true:

1. the general committed mutation result → reload contract is clearer and more uniform
2. the `useArchitectActions.ts` ↔ `useArchitectState.ts` seam is easier to understand and less likely to drift
3. the season-advance aftermath vs reload contract is clearer
4. the world-mode vs base/vacuum-mode propagation distinction is easier to understand
5. the stale-drop / async durability contract is more explicit and better guarded

If those conditions are met, Step 4 can move on to whole-system closeout with a much stronger propagation foundation.
