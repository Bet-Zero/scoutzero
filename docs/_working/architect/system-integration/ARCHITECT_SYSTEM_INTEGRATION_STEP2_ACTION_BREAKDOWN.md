# ARCHITECT SYSTEM INTEGRATION — STEP 2 ACTION BREAKDOWN

## Step

Step 2 — Cross-Surface Handoff Integrity

## Step Goal

Convert the Step 2 review findings into the smallest real execution lanes that make Architect’s major feature-to-feature handoff contracts clearer, more explicit, and harder to misread.

This step is not a broad architecture rewrite. It is about tightening the most important cross-surface handoff seams identified in the Step 2 review record.

---

## Summary of What Step 2 Found

The live repo’s major feature surfaces mostly connect correctly.

The problem is not that the system is secretly disconnected.
The problem is that some of the most important feature-to-feature contracts are expressed too unevenly:

- some handoff seams are explicit and easy to reason about
- some are structurally thin and underexplained
- some rely on dense upstream routing contracts that are easy to underread
- some world-only / preview-only boundaries are honest, but distributed across multiple surfaces

The most important Step 2 risks are:

1. wrapper-level handoff clarity is uneven across major dashboard sections
2. Free Agency depends on a dense upstream `actionOwner` contract that is coherent but too indirect
3. Trade Machine ↔ authoritative apply/mutation result handoff remains the highest-risk cross-surface seam
4. world-only / preview-only gating is honest, but expressed across too many separate surfaces and assumptions

---

## Execution Substeps

### SI-2A — Normalize shell-to-section handoff clarity across major wrappers

#### Purpose

Make the handoff contract between the dashboard shell and major section wrappers more explicit and more consistent across the major feature surfaces.

#### Why This Matters

Right now the repo expresses wrapper-level contracts unevenly.
Some wrappers are very explicit about what they own and what they forward.
Others are mostly prop tunnels.

That unevenness makes it harder to understand cross-feature contracts consistently.

#### Scope Focus

Prioritize the wrapper-level seams between:

- `GMDashboard.tsx`
- major `GMDashboard/sections/*` wrappers
- the immediate feature surfaces they feed

The goal is not to add generic comments everywhere.
The goal is to make the most important wrapper-level handoff contracts clearer and more consistent.

#### Desired Outcome

A contributor should be able to see, from the shell and section layer:

- what a section owns
- what a section only forwards
- what truth a section should treat as upstream
- what mutations or side effects a section should never appear to own locally

#### Completion Standard

Complete when the major section-wrapper contracts are materially more consistent and easier to understand across the dashboard surface.

---

### SI-2B — Clarify Free Agency ↔ `actionOwner` contract boundaries

#### Purpose

Make the Free Agency handoff contract easier to understand and safer to consume.

#### Why This Matters

`FreeAgencySection.tsx` looks relatively simple, but it depends on a dense upstream `actionOwner` contract that bundles:

- dual-path signing
- world-only actions
- modal availability
- offer-sheet lifecycle availability
- disabled reasons
- lifecycle action ownership

That contract is coherent, but it is too easy for downstream surfaces to over-assume or misread.

#### Scope Focus

Prioritize the handoff seam between:

- `useArchitectActions.ts`
- `FreeAgencySection.tsx`
- directly relevant free-agency consumers such as `FreeAgentPool` / offer-sheet surfaces if needed

The goal is to make the contract more explicit, not to redesign Free Agency broadly.

#### Desired Outcome

A contributor should be able to answer:

- what the `actionOwner` contract actually guarantees
- which actions are world-only
- which actions are available in vacuum/base mode
- which layer owns lifecycle action routing vs visual rendering vs gating

#### Completion Standard

Complete when the Free Agency cross-surface action contract is materially easier to read and less likely to be misused.

---

### SI-2C — Clarify Trade Machine ↔ authoritative apply/mutation result handoff

#### Purpose

Make the Trade Machine handoff into the authoritative apply/mutation path clearer, tighter, and easier to reason about.

#### Why This Matters

This is the highest-risk Step 2 handoff seam.

The dashboard shell passes context into the trade surface, while `useArchitectActions.ts` transforms that surface-level trade data into mutation payloads, resolves mode differences, performs authoritative compute/apply, and resyncs state.

That is a powerful seam, and it needs more explicit contract clarity.

#### Scope Focus

Prioritize the handoff path across:

- `TradeSection.tsx`
- the dashboard shell inputs feeding Trade Machine
- `useArchitectActions.ts` trade-apply routing
- any directly relevant authoritative result/reload seam needed to make the handoff truthful

The goal is not to reopen Trade Machine as a full feature review.
It is to tighten this specific cross-surface contract.

#### Desired Outcome

A contributor should be able to answer:

- what the trade surface is allowed to hand off
- what the action layer transforms or guarantees
- where mode branching actually occurs
- how committed trade results get back into dashboard-visible state

#### Completion Standard

Complete when the Trade Machine → authoritative apply/reload contract is materially clearer and less likely to be misread.

---

### SI-2D — Tighten world-only / preview-only gating contracts across section surfaces

#### Purpose

Make world-only, preview-only, and unavailable-action boundaries more consistent across major feature sections.

#### Why This Matters

The repo is trying to be honest about what requires an active world and what is only a preview, but that truth is spread across:

- section wrappers
- action-owner contracts
- disable messaging
- lifecycle availability surfaces
- preview banners and modal routes

That distribution is workable, but it is easier than it should be for one surface to drift from another.

#### Scope Focus

Prioritize the highest-value section surfaces where this distinction matters most, especially:

- Free Agency lifecycle actions
- Offseason world advancement vs DEV preview
- any other directly relevant section-level gating seam discovered during execution

#### Desired Outcome

A contributor should be able to tell:

- what persists only in active-world mode
- what is preview-only / local-only
- what is intentionally unavailable without a world
- where those decisions are owned

#### Completion Standard

Complete when the repo presents these gating contracts more consistently across the section layer and immediate action surfaces.

---

## Suggested Execution Batching

### Preferred first execution batch

**SI-2A + SI-2B together**

Why:

- both are primarily contract-clarity tasks at the shell / section / action-owner boundary
- both improve readability of the major dashboard-to-feature handoff layer
- both help create a clearer shared contract language before tackling the highest-risk trade seam

### Preferred second execution batch

**SI-2C + SI-2D together**

Why:

- both touch higher-risk, higher-consequence handoff durability seams
- both are easier to tighten once wrapper-level and Free Agency contract language are clearer
- both are likely to require more careful guardrail thinking than the first batch

### Alternative

If live repo overlap during execution is stronger than expected, SI-2B and SI-2D may partially overlap and be batched differently.
That should only happen if the work remains tightly focused on cross-surface handoff integrity rather than broad cleanup.

---

## Non-Goals for Step 2 Execution

The following should NOT become Step 2 execution work:

- reopening local feature correctness reviews already completed in prior features
- broad refactors across every dashboard section
- opportunistic UI cleanup unrelated to handoff clarity
- generalized documentation work that does not materially improve handoff integrity
- trade-machine deep correctness work outside the specific shell ↔ apply/reload contract
- free-agency product-behavior redesign

Step 2 execution should remain tightly scoped to feature-to-feature handoff contracts.

---

## Step 2 Success Condition

Step 2 will be considered structurally successful when all of the following are true:

1. major shell-to-section handoff contracts are more consistent
2. the Free Agency `actionOwner` contract is easier to understand and safer to consume
3. the Trade Machine ↔ authoritative apply/mutation result seam is easier to reason about
4. world-only / preview-only gating contracts are more consistent across the relevant section surfaces

If those conditions are met, Step 3 can move on to mutation, reload, and propagation integrity with a stronger system-level handoff foundation.
