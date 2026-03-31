# STEP 1 — ACTION BREAKDOWN

## Free Agency Action Ownership and Source of Truth

---

## FA-1A — Clarify the Primary Free Agency Action Owner Across UI Wiring, Modal Dispatch, and Mutation Execution

### Problem

Free Agency has a real centralized action layer in `useArchitectActions.ts`, but the feature still spreads meaningful action responsibility across:

- dashboard wiring in `FreeAgencySection.tsx`
- interaction and payload-building logic in `FreeAgentPool.tsx`
- shared modal dispatch behavior in `EditContractModal.tsx`
- mutation execution in `useArchitectActions.ts`

That means the feature is not fragmented, but the primary ownership boundary is still not fully explicit.

### Why It Matters

- Contributors can misread which layer truly owns Free Agency behavior
- UI-layer files can quietly accumulate mutation-adjacent logic
- The feature is easier to extend incorrectly when the primary owner is real in practice but not explicit enough in structure

### Goal

Make it clearer that Free Agency has one primary action owner, with the surrounding UI layers acting as wiring/dispatch surfaces rather than competing owners.

### Success Criteria

- The central Free Agency action owner is easier to identify
- Dashboard/pool/modal layers are easier to distinguish from final mutation ownership
- Contributors are less likely to add new action truth into the wrong layer

---

## FA-1B — Tighten the Ownership Boundary Between UI Payload Construction and Authoritative Signing Truth

### Problem

`FreeAgentPool.tsx` builds meaningful contract/signing payload structure before control reaches the authoritative action layer.

That means Free Agency contract truth is currently shared between:

- UI-layer payload construction
- action-layer normalization and mutation logic

This is not a total correctness failure, but it is an ownership split.

### Why It Matters

- Contract-shape truth is easier to duplicate or drift
- UI surfaces can end up owning business logic they should only stage
- Later reviewers may struggle to tell whether the pool is just a UI surface or a real rules-bearing surface

### Goal

Make the boundary between UI payload staging and authoritative signing truth more explicit and less drift-prone.

### Success Criteria

- It is clearer what the pool is allowed to construct versus what the action layer truly owns
- Contributors are less likely to treat the UI payload builder as the final source of signing truth
- The signing flow has a cleaner ownership story end to end

---

## FA-1C — Clarify and Fence the Dual-Path Ownership Model for World Mode vs Vacuum Mode

### Problem

Standard signings do not follow the same execution model as world-only Free Agency actions.

The current feature uses:

- authoritative world mutation for some actions
- local compute/audit/state update for vacuum-mode standard signings

That means one Free Agency feature contains two different action-truth models.

### Why It Matters

- The feature can look more singular than it really is
- Contributors can accidentally extend a world-only path as if it also has a vacuum-mode local equivalent
- Reviewers can confuse one-handler ownership with one-execution-path ownership

### Goal

Make the world-mode vs vacuum-mode ownership split more explicit, cleaner, and harder to misuse.

### Success Criteria

- It is easier to tell which actions are authoritative-world-only
- It is easier to tell which actions still have vacuum/base-mode local execution
- The feature’s dual-path behavior is more understandable and less risky to extend

---

## FA-1D — Add Guardrails for Free Agency Ownership Boundaries and Alternate Paths

### Problem

Even though Free Agency is fairly centralized already, its current ownership cleanliness depends on several boundaries continuing to hold:

- dashboard wiring vs action ownership
- pool payload staging vs authoritative signing truth
- world-only authoritative flows vs vacuum-mode local flows
- modal dispatch vs mutation ownership

Those boundaries are important, but they are still vulnerable to future drift.

### Why It Matters

- A contributor can accidentally push more business logic into UI surfaces
- A second mutation path can quietly appear without breaking obvious UI behavior
- Ownership regressions are easy to miss if no focused guardrail protects them

### Goal

Add focused protection so Free Agency ownership boundaries stay durable instead of just being “currently true.”

### Success Criteria

- Ownership regressions are easier to detect
- Alternate/fallback execution paths are less likely to quietly spread
- The feature is protected as an action-ownership system, not just as a set of handlers

---

## Step 1 Summary

This step focuses on:

- clarifying the real primary action owner for Free Agency
- tightening the boundary between UI payload staging and authoritative signing truth
- making the world-mode vs vacuum-mode ownership split more explicit
- adding focused guardrails for Free Agency ownership boundaries and alternate paths

This is an **ownership-boundary and action-source-of-truth step**, not a broad Free Agency rewrite.

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---

# STEP 3 — ACTION BREAKDOWN

## Free Agency Standard Signing Flow

---

## FA-3A — Centralize and Clarify Standard Signing Payload Finalization

### Problem

Standard signing still passes through several payload-shaping layers:

- modal input staging
- pool/modal dispatch handoff
- action-layer preparation/finalization

Even after earlier ownership cleanup, this path is still a high-risk seam because the final signing payload must remain correct for:

- salary rows
- action year
- total value
- signing mechanism / exception usage
- contract metadata

### Why It Matters

- Standard signing is the most common and most foundational Free Agency action
- If payload truth is even slightly split or re-derived inconsistently, the rest of the signing system can look correct while still encoding the wrong contract truth
- Contributors can quietly reintroduce duplicated signing-shape logic if the finalization boundary is not explicit enough

### Goal

Make standard signing payload finalization easier to trace and harder to duplicate or drift.

### Success Criteria

- The final standard-sign payload owner is easier to identify
- Salary years, action year, total value, and signing mechanism are finalized through one clearly authoritative path
- Contributors are less likely to spread signing-shape truth back into UI staging surfaces

---

## FA-3B — Align Standard Signing Legality Validation with Final Mutation Truth

### Problem

Standard signing must remain coherent not just at the payload layer, but at the legality layer:

- signing mechanism / exception usage
- cap legality
- action-year interpretation
- mutation-time contract truth

If legality validation and final mutation truth are not using the same assumptions, the feature can approve one signing story and commit another.

### Why It Matters

- Standard signing is the path most likely to expose cap-rule drift early
- A feature can appear correct in UI and still be wrong if legality checks and mutation truth do not fully agree
- Exception-backed signings are especially vulnerable to this kind of subtle split

### Goal

Make legality validation and final mutation truth easier to verify as one coherent standard-signing system.

### Success Criteria

- Validation assumptions and committed signing truth are easier to compare directly
- Signing mechanism / exception usage is less likely to drift between legality and mutation paths
- Contributors are less likely to add local validation logic that does not match final action truth

---

## FA-3C — Fence the Standard Signing World-Mode vs Vacuum-Mode Dual Path

### Problem

Standard signing is the one major Free Agency action that still intentionally supports both:

- world-mode authoritative execution
- vacuum/base-mode local compute execution

That makes it the biggest dual-path correctness seam in the feature.

### Why It Matters

- The same signing action can quietly diverge across execution modes
- A contributor can fix or extend one signing path and leave the other behind
- Step 1 clarified that this dual-path model exists; Step 3 must determine whether it is still behaviorally coherent

### Goal

Make the world-mode vs vacuum-mode standard-signing boundary easier to trace and less likely to silently diverge.

### Success Criteria

- It is easier to compare the two standard-signing execution paths
- Their action-year, legality, and payload assumptions are easier to verify as aligned
- Contributors are less likely to accidentally evolve one path without the other

---

## FA-3D — Protect Final-State, Persistence, and Reload Truth for Standard Signings

### Problem

A standard signing is not complete when it is merely accepted by the action layer.

It still has to end correctly in:

- team state
- free-agent pool removal/update
- saved world state where applicable
- reloaded/hydrated state
- visible post-sign truth

That full final-state path still needs explicit protection.

### Why It Matters

- A signing flow can look correct at mutation time and still land in the wrong final visible state
- World-mode and vacuum-mode can appear aligned while persistence/reload behavior still differs
- Standard signing is too central to leave this to assumption

### Goal

Make final-state truth for standard signings more durable across mutation, persistence, reload, and visible post-sign surfaces.

### Success Criteria

- Final-state and post-reload standard-sign truth is easier to trace
- World-mode and vacuum-mode end states are easier to compare
- Contributors are less likely to introduce a mutation/persist/reload mismatch without detection

---

## Step 3 Summary

This step focuses on:

- centralizing and clarifying standard signing payload finalization
- aligning legality validation with final mutation truth
- fencing the world-mode vs vacuum-mode standard-signing dual path
- protecting final-state, persistence, and reload truth for standard signings

This is a **standard-signing correctness and coherence step**, not a broad Free Agency rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **FA-3A + FA-3B** may be executed together if payload finalization and legality alignment are owned by the same signing-preparation path
- **FA-3C + FA-3D** may be executed together if world/vacuum coherence and final-state persistence/reload truth share the same mutation/persist seam

Validation can also be tiered:

- use targeted tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for step-close, blocker follow-up, or whole-feature closeout where possible

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---

# STEP 4 — ACTION BREAKDOWN

## Free Agency Sign-and-Trade Initiation, Preflight, and Commit Truth

---

## FA-4A — Tighten Sign-and-Trade Initiation Truth Across Pool, Modal, and World-Only Availability

### Problem

Sign-and-trade is a world-only Free Agency action, but its visible initiation still depends on several surfaces staying aligned:

- section-level world gating
- pool-level modal launch
- modal-visible action availability
- destination-team entry requirements

That means the initiation path is coherent today, but it is still a multi-layer staging seam.

### Why It Matters

- A contributor can accidentally make sign-and-trade appear available in the wrong context
- The modal can look authoritative while still being launched from a partially misleading visible state
- World-only action truth is especially sensitive because sign-and-trade is not supposed to have a vacuum-mode fallback

### Goal

Make sign-and-trade initiation easier to trace and less likely to drift across section, pool, and modal surfaces.

### Success Criteria

- Sign-and-trade is more clearly offered only in the correct world-backed contexts
- Modal launch and destination-team initiation read more clearly as one truthful world-only action path
- Contributors are less likely to introduce a misleading visible initiation seam

---

## FA-4B — Align Authoritative Preflight with Commit-Time Sign-and-Trade Payload Truth

### Problem

Sign-and-trade currently uses authoritative preflight and authoritative commit, and both share the same contract-preparation seam.

That is strong, but they are still two separate evaluations of the same transaction.

### Why It Matters

- Preflight can approve one transaction story while commit later evaluates or executes a slightly different one
- Destination-team handling, signing mechanism truth, or action-season context can drift if the shared seam weakens
- Sign-and-trade is too consequential to rely on “probably still aligned”

### Goal

Make preflight and commit easier to verify as one coherent sign-and-trade transaction system.

### Success Criteria

- The prepared sign-and-trade payload truth is easier to identify and compare across preflight and commit
- Destination-team routing, action-season context, and signing mechanism truth are less likely to drift between preflight and commit
- Contributors are less likely to evolve one path without the other

---

## FA-4C — Clarify and Harden Final Commit, Sync, and Reload Truth for Sign-and-Trade

### Problem

A sign-and-trade is not complete when commit succeeds.
It still has to end correctly in:

- committed mutation truth
- synced local/dashboard team state
- persisted world state
- reloaded/hydrated post-transaction truth

Right now, sign-and-trade final-state handling still appears more indirect than ideal because it relies on the more generic authoritative mutation/sync path.

### Why It Matters

- A transaction can look correct at commit time but still land in the wrong visible final state
- Final-state truth can drift away from what preflight implied
- Sign-and-trade is a multi-team action, so hidden final-state assumptions are riskier here than in simpler flows

### Goal

Make sign-and-trade final commit, sync, and reload truth easier to trace and less dependent on indirect generic handling.

### Success Criteria

- Final committed/reloaded sign-and-trade truth is easier to follow
- Contributors are less likely to introduce a preflight/commit/final-state mismatch without detection
- Visible post-transaction truth is more directly tied to committed sign-and-trade results

---

## FA-4D — Add Focused Guardrails for Sign-and-Trade Preflight, Commit, and Final-State Truth

### Problem

Even if sign-and-trade is coherent today, its correctness still depends on several boundaries continuing to hold:

- world-only initiation staying world-only
- authoritative preflight staying authoritative
- preflight and commit staying aligned
- final commit/reload truth staying faithful to the transaction

Those are high-value seams, and they are still vulnerable to future drift.

### Why It Matters

- A contributor can accidentally reopen a weaker or alternate sign-and-trade path
- Preflight/commit drift is easy to miss without focused protection
- Generic sync helpers can hide sign-and-trade-specific regressions unless something explicitly guards them

### Goal

Add focused protection so sign-and-trade truth stays durable instead of just currently coherent.

### Success Criteria

- Sign-and-trade regressions are easier to detect
- Preflight, commit, and final-state seams are better protected
- The feature is guarded as a world-only transaction system, not just a modal action branch

---

## Step 4 Summary

This step focuses on:

- tightening sign-and-trade initiation truth across section, pool, and modal surfaces
- aligning authoritative preflight with commit-time sign-and-trade payload truth
- clarifying and hardening final commit, sync, and reload truth
- adding focused guardrails for sign-and-trade preflight, commit, and final-state durability

This is a **sign-and-trade correctness and coherence step**, not a broad Free Agency rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **FA-4A + FA-4B** may be executed together if visible initiation truth and authoritative preflight/commit payload truth are owned by the same launch/preparation seam
- **FA-4C + FA-4D** may be executed together if final commit/sync/reload truth and guardrail hardening share the same authoritative mutation/sync seam

Validation can also stay tiered:

- use targeted sign-and-trade tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for step-close, blocker follow-up, or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---
