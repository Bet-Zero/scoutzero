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

# STEP 5 — ACTION BREAKDOWN

## Free Agency Offer-Sheet Creation Flow

---

## FA-5A — Tighten Offer-Sheet Initiation Truth Across Pool, Modal, and World-Only Availability

### Problem

Outgoing offer-sheet creation is world-only, but its visible initiation still depends on several surfaces staying aligned:

- section-level world gating
- pool-level modal launch wiring
- modal-visible Offer Sheet toggle availability
- `signNew` branch selection plus offer-sheet staging

That means the creation path is coherent today, but still a multi-layer initiation seam.

### Why It Matters

- A contributor can accidentally make the Offer Sheet toggle appear in the wrong context
- The visible UI can suggest offer-sheet creation is available while owner-level world truth says otherwise
- Offer-sheet creation is not supposed to have a vacuum-mode fallback, so initiation drift matters more here

### Goal

Make outgoing offer-sheet initiation easier to trace and less likely to drift across section, pool, and modal surfaces.

### Success Criteria

- Offer-sheet creation is more clearly offered only in the correct world-backed contexts
- Modal launch and Offer Sheet toggle truth read more clearly as one world-only action path
- Contributors are less likely to introduce a misleading visible initiation seam

---

## FA-5B — Align Authoritative Offer-Sheet Preflight with Store-Time Payload Truth

### Problem

Outgoing offer-sheet creation currently uses authoritative preflight and authoritative store, and both share the same signing-preparation seam.

That is strong, but they are still two separate evaluations of the same creation path.

### Why It Matters

- Preflight can approve one offer-sheet story while store later evaluates or commits a slightly different one
- Contract markers like `rfaOfferSheet`, `rfaOfferSheetOnly`, `rfaOfferSheetStatus`, signing mechanism truth, or action-season context can drift if the shared seam weakens
- Offer-sheet creation is too sensitive to rely on “probably still aligned”

### Goal

Make preflight and store easier to verify as one coherent offer-sheet creation system.

### Success Criteria

- The prepared offer-sheet payload truth is easier to identify and compare across preflight and store
- Offer-sheet contract markers, action-season context, and signing mechanism truth are less likely to drift between preflight and store
- Contributors are less likely to evolve one path without the other

---

## FA-5C — Clarify and Harden Pending-State, Sync, and Reload Truth for Created Offer Sheets

### Problem

An outgoing offer sheet is not complete when store succeeds.

It still has to end correctly in:

- persisted pending offer-sheet truth
- synced local/dashboard state
- outgoing pending-offer list visibility
- reloaded/hydrated world truth after creation

Right now, outgoing offer-sheet storage still appears more indirect than ideal because it runs through the more generic authoritative mutation helper path.

### Why It Matters

- Offer-sheet creation can look correct at store time but still land in the wrong pending visible state
- Pending-state truth can drift away from what authoritative preflight implied
- Created offer sheets are stateful objects, so hidden final-state assumptions matter more than in a one-shot action

### Goal

Make outgoing offer-sheet pending-state, sync, and reload truth easier to trace and less dependent on indirect generic handling.

### Success Criteria

- Final created/reloaded pending-state truth is easier to follow
- Contributors are less likely to introduce a preflight/store/pending-state mismatch without detection
- Visible pending-offer-sheet truth is more directly tied to committed creation results

---

## FA-5D — Add Focused Guardrails for Offer-Sheet Preflight, Store, and Pending-State Truth

### Problem

Even if outgoing offer-sheet creation is coherent today, its correctness still depends on several boundaries continuing to hold:

- world-only initiation staying world-only
- authoritative preflight staying authoritative
- preflight and store staying aligned
- pending created-state and reload truth staying faithful to stored offer-sheet results

These are high-value seams and still vulnerable to future drift.

### Why It Matters

- A contributor can accidentally reopen a weaker or alternate offer-sheet creation path
- Preflight/store drift is easy to miss without focused protection
- Generic sync helpers can hide offer-sheet-specific regressions unless something explicitly guards them

### Goal

Add focused protection so offer-sheet creation truth stays durable instead of just currently coherent.

### Success Criteria

- Offer-sheet creation regressions are easier to detect
- Preflight, store, and pending-state seams are better protected
- The feature is guarded as a world-only pending-state creation system, not just a modal toggle branch

---

## Step 5 Summary

This step focuses on:

- tightening outgoing offer-sheet initiation truth across section, pool, and modal surfaces
- aligning authoritative preflight with store-time offer-sheet payload truth
- clarifying and hardening pending-state, sync, and reload truth for created offer sheets
- adding focused guardrails for offer-sheet preflight, store, and pending-state durability

This is an **offer-sheet creation correctness and coherence step**, not a broad Free Agency rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **FA-5A + FA-5B** may be executed together if visible initiation truth and authoritative preflight/store payload truth are owned by the same launch/preparation seam
- **FA-5C + FA-5D** may be executed together if pending-state/sync/reload truth and guardrail hardening share the same authoritative mutation/sync seam

Validation can stay tiered:

- use targeted offer-sheet creation tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for step-close, blocker follow-up, or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---

# STEP 6 — ACTION BREAKDOWN

## Free Agency Incoming and Outgoing Offer-Sheet Lifecycle

---

## FA-6A — Tighten Incoming vs Outgoing Offer-Sheet Surface Truth

### Problem

The offer-sheet lifecycle is currently shown through two separate visible surfaces:

- incoming offer sheets
- outgoing offer sheets

That separation is correct today, but the lifecycle still depends on several layers staying aligned:

- section-level incoming/outgoing routing
- list-level role-aware action visibility
- lifecycle handler injection
- disabled-state / world-only gating

### Why It Matters

- A contributor can accidentally blur home-team and offering-team responsibilities
- The UI can become misleading even if the hook-level actions are still technically correct
- Offer-sheet lifecycle actions are role-sensitive, so visible surface drift matters more than in simpler flows

### Goal

Make incoming vs outgoing lifecycle truth easier to trace and less likely to drift across section and list surfaces.

### Success Criteria

- Incoming and outgoing offer-sheet surfaces are more clearly tied to the correct team roles
- Visible lifecycle actions are less likely to drift from hook-owned role truth
- Contributors are less likely to introduce misleading surface behavior

---

## FA-6B — Align Match / Decline / Finalize Routing with Team-Role Truth

### Problem

The lifecycle currently uses separate handlers for:

- match
- decline
- finalize

That is workable, but role correctness is still partly distributed between:

- list visibility
- section routing
- hook-level branching
- finalize status/team checks

### Why It Matters

- Match / decline / finalize can quietly evolve unevenly
- Team-role truth can be preserved in one layer but weakened in another
- Finalize is especially sensitive because it is outcome-aware and role-aware

### Goal

Make lifecycle routing easier to verify as one coherent role-aware offer-sheet action system.

### Success Criteria

- Match / decline / finalize routing is easier to compare directly
- Team-role assumptions are less likely to drift across layers
- Contributors are less likely to evolve one lifecycle action path without the others

---

## FA-6C — Clarify and Harden Final Lifecycle-State, Sync, and Reload Truth

### Problem

Offer-sheet lifecycle actions are not complete when the handler fires.

They still have to end correctly in:

- committed mutation truth
- local/dashboard state
- persisted world truth
- reloaded/hydrated offer-sheet truth
- visible lifecycle-state surfaces after match / decline / finalize

Right now, that final lifecycle-state truth still appears more indirect than ideal because it depends on the broader authoritative mutation/sync path.

### Why It Matters

- A lifecycle action can look correct at handler time but still land in the wrong post-action state
- Final saved/reloaded truth can drift away from what the lifecycle action logically implied
- Lifecycle actions are state transitions, so post-action truth matters just as much as action routing

### Goal

Make final lifecycle-state, sync, and reload truth easier to trace and less dependent on indirect generic handling.

### Success Criteria

- Post-action lifecycle truth is easier to follow
- Contributors are less likely to introduce a routing/final-state mismatch without detection
- Visible incoming/outgoing offer-sheet truth is more directly tied to committed lifecycle results

---

## FA-6D — Add Focused Guardrails for Offer-Sheet Lifecycle Role and Final-State Truth

### Problem

Even if the lifecycle is coherent today, its correctness still depends on several boundaries continuing to hold:

- incoming/outgoing surfaces staying role-correct
- match / decline / finalize staying role-aware
- finalize staying aligned with outcome/team-role truth
- final lifecycle-state and reload truth staying faithful to committed results

These are high-value seams and still vulnerable to future drift.

### Why It Matters

- A contributor can accidentally reopen a weaker or alternate lifecycle path
- Role-truth drift is easy to miss without focused protection
- Generic mutation helpers can hide lifecycle-specific regressions unless something explicitly guards them

### Goal

Add focused protection so offer-sheet lifecycle truth stays durable instead of just currently coherent.

### Success Criteria

- Lifecycle regressions are easier to detect
- Role-aware routing and final-state seams are better protected
- The feature is guarded as a team-role-sensitive lifecycle system, not just a few list buttons and handler calls

---

## Step 6 Summary

This step focuses on:

- tightening incoming vs outgoing offer-sheet surface truth
- aligning match / decline / finalize routing with team-role truth
- clarifying and hardening final lifecycle-state, sync, and reload truth
- adding focused guardrails for offer-sheet lifecycle role and final-state durability

This is an **offer-sheet lifecycle correctness and coherence step**, not a broad Free Agency rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **FA-6A + FA-6B** may be executed together if visible incoming/outgoing separation and role-aware lifecycle routing are owned by the same section/list/action seam
- **FA-6C + FA-6D** may be executed together if lifecycle final-state/sync/reload truth and guardrail hardening share the same authoritative mutation/sync seam

Validation can stay tiered:

- use targeted lifecycle tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for step-close, blocker follow-up, or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---

# STEP 7 — ACTION BREAKDOWN

## Free Agency World-Mode Gating vs Vacuum-Mode Behavior

---

## FA-7A — Make the World-Only vs Dual-Path Free Agency Action Map More Explicit

### Problem

Free Agency currently has two different behavior classes:

- actions allowed in both world mode and vacuum/base mode
- actions allowed only when an active world exists

That split is real, but it is still represented indirectly through:

- grouped owner shape
- modal-availability fields
- per-handler world guards
- section-level user-facing gating

### Why It Matters

- A contributor can easily misunderstand which actions are intentionally dual-path versus world-only
- The behavior map is currently coherent, but still too easy to infer incorrectly
- Mode-policy drift is especially dangerous in Free Agency because some actions are local-safe while others are persistence-dependent

### Goal

Make the Free Agency world-only vs dual-path action map easier to trace and less likely to drift across owner publication, UI gating, and handler logic.

### Success Criteria

- It is easier to identify which actions are truly dual-path and which are truly world-only
- Contributors are less likely to evolve one action’s mode behavior without updating the broader boundary
- The system reads more clearly as one explicit mode-policy model rather than several implied ones

---

## FA-7B — Align UI Gating Truth with Actual Mutation / Action Truth

### Problem

The user-facing world-only message in `FreeAgencySection.tsx` is accurate, and modal-visible action truth is owner-derived, but the full behavior model is still spread across UI and hook layers.

That means UI truth and mutation truth are aligned today, but not yet protected as one clearly unified contract.

### Why It Matters

- A contributor can accidentally make the UI more or less permissive than the actual handler logic
- The section can remain “correct enough” while deeper handler truth evolves differently
- Users should not have to rely on trial and error to learn which actions require a world

### Goal

Make UI gating truth easier to verify directly against actual Free Agency action truth.

### Success Criteria

- User-facing gating and modal-visible action availability are less likely to drift from handler-level mode truth
- Contributors are less likely to introduce misleading no-world UI behavior
- The visible boundary reads more clearly as a direct projection of actual action capability

---

## FA-7C — Harden Dual-Path Standard Signing vs World-Only Action Behavior

### Problem

Standard signing intentionally supports both:

- world-mode authoritative execution
- vacuum/base-mode local execution

Other major Free Agency actions are intentionally world-only.

That split is correct, but it still relies on a mix of:

- grouped owner publication
- handler-level branching
- separate helper paths for world and vacuum execution

### Why It Matters

- Standard signing can drift away from the broader world/vacuum contract if its dual-path behavior evolves independently
- World-only actions can accidentally gain weak local behavior if their guards are not structurally strong enough
- The dual-path vs world-only boundary is one of the most important behavioral rules in the feature

### Goal

Make the distinction between intentional dual-path behavior and intentional world-only behavior easier to trace and harder to weaken.

### Success Criteria

- Standard signing’s dual-path status is more clearly protected
- World-only actions are less likely to grow inconsistent local behavior
- Contributors are less likely to blur the world-only vs dual-path boundary

---

## FA-7D — Add Focused Guardrails for World/Vacuum Boundary Truth

### Problem

Even if the world/vacuum boundary is coherent today, its correctness still depends on several conditions continuing to hold:

- world-only actions staying truly world-only
- dual-path actions staying intentionally dual-path
- UI gating staying aligned with actual action capability
- no-world behavior failing closed where appropriate
- no action silently no-oping or partially working in the wrong mode

These are high-value seams and still vulnerable to future drift.

### Why It Matters

- A contributor can accidentally weaken or blur the boundary without noticing
- Mode-policy regressions are easy to miss if they only show up in one layer
- Guardrails are especially important when the behavior model is split across UI, owner shape, and handlers

### Goal

Add focused protection so world/vacuum behavior truth stays durable instead of just currently coherent.

### Success Criteria

- World-only vs dual-path regressions are easier to detect
- UI gating and handler truth are better protected as one boundary
- The feature is guarded as a clear mode-policy system rather than a collection of separate guards

---

## Step 7 Summary

This step focuses on:

- making the world-only vs dual-path Free Agency action map more explicit
- aligning UI gating truth with actual mutation/action truth
- hardening dual-path standard signing vs world-only action behavior
- adding focused guardrails for world/vacuum boundary durability

This is a **world/vacuum boundary correctness and coherence step**, not a broad Free Agency rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **FA-7A + FA-7B** may be executed together if the action-map publication and UI gating truth are owned by the same owner/availability seam
- **FA-7C + FA-7D** may be executed together if dual-path/world-only behavior hardening and guardrail coverage share the same handler/policy seam

Validation can stay tiered:

- use targeted world/vacuum behavior tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for step-close, blocker follow-up, or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---
