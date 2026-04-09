# ARCHITECT SYSTEM INTEGRATION — STEP 1 ACTION BREAKDOWN

## Step
Step 1 — Global Ownership and Truth Boundaries

## Step Goal
Convert the Step 1 review findings into the smallest real execution lanes that make Architect-wide truth ownership clearer, easier to audit, and harder to misread.

This step is not about broad feature cleanup. It is about tightening the ownership map and the highest-value global truth boundaries identified in the Step 1 review record.

---

## Summary of What Step 1 Found
The live repo already has strong real authorities.

The problem is not lack of ownership.
The problem is that Architect’s ownership model is distributed across several powerful files and layers, which makes the overall system harder to read than it should be.

The most important Step 1 risks are:

1. the top-level ownership map is too implicit
2. the base/world read stack is coherent but not explicit enough as one contract
3. `mutationPipeline.ts` and `seasonManager.ts` are both major authorities but their relationship is too easy to misread
4. shared cap/contract SSOT boundaries are strong but still need stronger system-level durability

---

## Execution Substeps

### SI-1A — Make the top-level Architect ownership map explicit

#### Purpose
Make the global ownership model visible in code/docs at the Architect-wide level so contributors can quickly identify:

- authorities
- adapters
- wrappers
- display consumers

#### Why This Matters
This is the foundation for all later system-integration work.
If this stays implicit, later cross-surface review work will keep starting from the wrong assumptions.

#### Scope Focus
Prioritize the highest-level ownership seams:

- dashboard/world shell ownership
- state/action orchestration boundaries
- world lifecycle authority
- read authority
- mutation authority
- season-transition authority
- shared SSOT authorities

#### Desired Outcome
A contributor should be able to answer the following without reading half the repo:

- Where does world truth live?
- Where do world-aware reads live?
- Where do committed writes live?
- What files are only orchestration/adapters?

#### Completion Standard
Complete when the repo makes the global ownership model materially easier to identify and harder to confuse.

---

### SI-1B — Clarify world/base read ownership boundaries

#### Purpose
Tighten the distinction between:

- base hydration truth
- world-aware fallback-chain read truth
- dashboard-facing consumer adapters

#### Why This Matters
This is one of the most foundational Architect seams.
The layering is coherent, but it is still too easy to misread where team/player truth actually comes from.

#### Scope Focus
Review and tighten the contract between:

- `firebaseTeamPlanHelpers.ts`
- `teamLoader.ts`
- `worldTeamData.ts`
- any directly relevant dashboard-facing read adapters

#### Desired Outcome
The repo should make it clear that:

- base data hydration is one thing
- world-aware read resolution is another
- dashboard-friendly consumer loading is another

These layers should not feel interchangeable.

#### Completion Standard
Complete when the read stack is easier to explain as one explicit contract and downstream surfaces are less likely to bypass or misinterpret it.

---

### SI-1C — Clarify mutation/apply vs season-transition authority

#### Purpose
Make the relationship between:

- `mutationPipeline.ts`
- `seasonManager.ts`

clearer at the ownership level.

#### Why This Matters
This is the biggest Step 1 ambiguity.
Both are major authorities, but the repo does not yet express their relationship clearly enough at the Architect-wide level.

#### Scope Focus
Clarify the distinction between:

- general mutation/apply authority
- season/world transition authority
- when one authority should call or defer to the other
- what downstream surfaces should treat as committed truth

#### Desired Outcome
The repo should be clearer about:

- which authority owns what
- what their overlap is and is not
- how contributors should reason about their relationship

#### Completion Standard
Complete when the mutation-vs-season boundary is materially less ambiguous and no local/dashboard surface appears to own committed mutation truth.

---

### SI-1D — Guard shared cap/contract SSOT boundaries

#### Purpose
Reinforce that canonical cap totals and shared contract shaping are upstream shared authorities, not optional helpers.

#### Why This Matters
Multiple major Architect features depend on these seams.
System integration will drift if downstream surfaces bypass them, partially reconstruct them, or silently fork their logic.

#### Scope Focus
Prioritize:

- `computeTeamCapTotals.ts`
- `contractUtils.ts`
- directly relevant shared contract/cap consumers
- any lightweight guardrail or clarity improvements that make SSOT expectations more explicit

#### Desired Outcome
The repo should communicate more clearly that:

- canonical cap totals come from one place
- shared contract shaping/lookups come from one place
- downstream consumers are expected to rely on those surfaces rather than reinterpret them

#### Completion Standard
Complete when the shared SSOT role of cap totals / contract helpers is more explicit and more durable across feature boundaries.

---

## Suggested Execution Batching

### Preferred first execution batch
**SI-1A + SI-1B together**

Why:
- both are ownership-clarity tasks
- both operate near the global read / orchestration map
- both help establish the system-level model before mutation/season refinement

### Possible second execution batch
**SI-1C + SI-1D together**

Why:
- both are deeper authority-boundary durability tasks
- both touch higher-risk shared system seams
- both are easier to do once the top-level map is clearer

### Alternative
If the live repo suggests strong overlap, all four may be batched into one narrow Step 1 execution pass.
That should only happen if the changes remain tightly focused on ownership clarity and SSOT durability, not broad cleanup.

---

## Non-Goals for Step 1 Execution
The following should NOT become Step 1 execution work:

- broad feature refactors
- local UI cleanup unrelated to ownership boundaries
- reopening already-closed feature reviews
- opportunistic bug fixing outside the ownership/truth seam
- generic doc writing that does not materially clarify authority boundaries

Step 1 execution should remain tightly scoped to ownership clarity and global truth-boundary durability.

---

## Step 1 Success Condition
Step 1 will be considered structurally successful when all of the following are true:

1. the top-level Architect ownership model is easier to identify
2. the world/base read stack is easier to explain and harder to misuse
3. mutation/apply vs season-transition authority is less ambiguous
4. shared cap/contract SSOT expectations are clearer and more durable

If those conditions are met, Step 2 can move on to cross-surface handoff integrity with a much stronger foundation.
