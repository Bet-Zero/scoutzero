# ARCHITECT_TM_ACTION_BREAKDOWN

## Scope

Trade Machine — Step 1 Execution Plan  
Derived from: ARCHITECT_TM_REVIEW_RECORD

---

# TM-1A — Preview vs Apply Truth Alignment

## Problem

The UI determines trade validity using:

- `result.legal` from `validateTrade(...)`
- validation freshness checks

However, the actual apply path includes additional layers:

- world invariant validation
- entitlement validation
- trade exclusivity checks
- post-state cap legality

These layers are NOT represented in preview.

Result:

> A trade can appear valid in UI but fail during execution.

---

## Why It Matters

This creates a system trust failure:

- Users interpret green as "valid"
- System can still reject at apply time
- UI communicates incomplete truth

This is the highest-priority issue because it affects:

- correctness perception
- UX reliability
- system credibility

---

## Goal

Ensure that:

> Preview legality accurately represents full apply-time legality  
> OR  
> Preview clearly communicates that it is not authoritative

---

## Success Criteria

At least one of the following must be true:

1. Preview includes ALL apply-time gates  
   OR
2. UI explicitly distinguishes:
   - "preview valid"
   - "guaranteed valid"

AND:

- No scenario exists where:
  - UI = green
  - apply = reject  
    without clear explanation

---

## Expected Work Areas

- `useTradeMachine.ts`
- `TradeEditor.tsx`
- `mutationPipeline.ts`
- `tradeContext.ts`
- `postStateCapValidator.ts`
- `leagueInvariants.ts`

---

## Execution Direction

Options to evaluate:

- Inject apply-time gates into preview
- Create unified "full legality" surface
- Add explicit UI state distinction
- Expose apply-time failure reasons pre-apply

Final solution should prioritize:

- correctness over simplicity
- clarity over silent failure

---

# TM-1B — Roster Validation Consolidation

## Problem

Roster rules are enforced in multiple places:

- validator core (`computeRosterValidation`)
- post-state (`validatePostStateCapLegality`)

These are:

- separate implementations
- separate execution stages
- potentially different rule scopes

---

## Why It Matters

This creates:

- duplication risk
- drift risk over time
- inconsistent legality outcomes between preview and apply

---

## Goal

Establish a **single source of truth for roster validation** that is:

- reused in preview
- reused in apply
- reused in post-state

---

## Success Criteria

- Only ONE implementation defines roster legality
- All layers call into that implementation
- No duplicate rule logic exists

---

## Expected Work Areas

- `tradeValidator.ts`
- `validateRoster.ts`
- `rosterValidation.ts`
- `postStateCapValidator.ts`

---

## Execution Direction

- Identify canonical roster validator
- Remove or redirect duplicate implementations
- Ensure consistent rule timing across layers

---

# TM-1C — Hard Cap / Apron Rule Consolidation

## Problem

Hard cap and apron rules are enforced across multiple modules:

- `validateHardCap(...)`
- salary matching logic
- aggregation logic
- post-state cap validator

There is no clearly defined SSOT.

---

## Why It Matters

This creates:

- fragmented rule ownership
- potential inconsistencies
- maintenance complexity

---

## Goal

Centralize hard cap / apron logic into a clearly defined authority.

---

## Success Criteria

- One module owns hard cap logic
- All other modules delegate to it
- No duplicated rule enforcement remains

---

## Expected Work Areas

- `validateHardCap.ts`
- `hardCapValidation.ts`
- `validateSalaryMatching.ts`
- `postStateCapValidator.ts`

---

## Execution Direction

- Identify overlapping logic
- Define canonical rule owner
- remove or redirect duplicates

---

# TM-1D — Alternate Execution Path Removal / Containment

## Problem

An alternate execution path exists:

- `tradeManager.executeTrade()`
- exposed via `architectCore.ts`

This path may bypass:

- mutation pipeline validation
- world invariants
- post-state legality

---

## Why It Matters

Even if unused today, this creates:

- future misuse risk
- bypass of authoritative system
- inconsistent execution behavior

---

## Goal

Ensure ALL trade execution flows through:

> mutationPipeline authoritative path

---

## Success Criteria

- No callable execution path bypasses mutation pipeline
- Alternate paths are:
  - removed  
    OR
  - hard-routed into mutation pipeline

---

## Expected Work Areas

- `tradeManager.ts`
- `architectCore.ts`

---

## Execution Direction

- Audit all call sites
- Deprecate or remove alternate path
- enforce mutation pipeline usage

---

# EXECUTION ORDER

1. TM-1A — Preview vs Apply Truth Alignment (CRITICAL)
2. TM-1B — Roster Validation Consolidation
3. TM-1C — Hard Cap / Apron Consolidation
4. TM-1D — Alternate Execution Path Cleanup

---

# FINAL NOTE

This Action Breakdown is derived directly from the Step 1 Review Record and must remain aligned with it.

If Review Record changes, this document must be regenerated.

---

## STEP 2 — Preview vs Apply Truth Gap (UI Trust Layer)

Result:

- Review completed
- No execution substeps created

Reason:

- Step 1 resolved the practical local/UI trust gap
- Remaining mismatch is limited to world-state gates that are explicitly disclosed and not locally previewable

Status:

- No action required at this time
- Future enhancement only if world-state preflight becomes a priority

---

# STEP 3 — ACTION BREAKDOWN

## Apply Pipeline Authority (True Execution Source of Truth)

---

## TM-3A — Define Explicit Execution Authority Surface

### Problem

There is no single function or surface that clearly represents “final trade execution authority.”  
Authority exists across a chain (snapshot → validation → post-state → world checks), but is not explicitly named or exposed.

### Why It Matters

- Developers cannot easily identify the true source of execution truth
- Increases risk of incorrect assumptions (e.g. treating `validateTrade()` as final authority)
- Makes future changes to execution logic more error-prone

### Goal

Define a clear, explicit **execution authority surface** that represents the full apply pipeline legality.

### Success Criteria

- A single function (or clearly defined entry surface) represents full execution legality
- That surface is:
  - discoverable
  - documented by structure (not just comments)
- No ambiguity remains about what constitutes “final legality”

---

## TM-3B — Centralize Apply Pipeline Legality Chain

### Problem

Execution legality is currently spread across multiple layers:

- snapshot building
- `validateTrade(...)` reuse
- post-state validation
- world invariant checks

There is no unified orchestration layer that clearly composes these.

### Why It Matters

- Logic is harder to trace and reason about
- Risk of future drift between layers
- Hard to guarantee ordering and completeness

### Goal

Create or refactor into a **single orchestrated apply legality chain** that:

- explicitly runs all required stages
- preserves correct ordering
- clearly defines inputs/outputs between stages

### Success Criteria

- All execution legality stages are composed in one place
- Order of operations is explicit and enforced
- No validation stage exists outside the orchestrated flow

---

## TM-3C — Clarify Ownership of Each Validation Layer

### Problem

Validation responsibilities are split across:

- `validateTrade(...)`
- post-state validation
- world invariant checks

But ownership boundaries are not clearly defined.

### Why It Matters

- Makes it unclear where new rules should be added
- Increases duplication risk
- Blurs responsibility between preview and apply

### Goal

Define clear ownership for each layer:

- trade-level validation
- post-state validation
- world-state validation

### Success Criteria

- Each rule category has one clear owner
- No rule is duplicated across layers
- Adding a new rule has an obvious destination

---

## TM-3D — Align Preview with Execution Authority Model

### Problem

Preview uses:

- `validateTrade(...)`
- `getFullLegalityPreview(...)`

Execution uses a broader authority chain.

Even after Step 1, preview is still a partial mirror, not a direct representation of execution authority.

### Why It Matters

- Conceptual mismatch still exists between preview and execution
- Makes reasoning about UI trust harder
- Limits long-term maintainability

### Goal

Align preview structure with execution authority model where possible.

This does NOT require full parity, but requires:

- structural alignment
- shared mental model

### Success Criteria

- Preview flow mirrors execution flow conceptually
- Differences between preview and apply are:
  - minimal
  - explicitly defined
- No hidden divergence remains

---

## TM-3E — Expose and Document Execution Authority Boundary

### Problem

The true execution boundary (what happens after UI and before persistence) is not clearly exposed.

### Why It Matters

- Hard to onboard new contributors
- Hard to debug execution issues
- Hard to verify correctness of future changes

### Goal

Make the execution authority boundary explicit through:

- code structure
- naming
- minimal documentation (in-code clarity first)

### Success Criteria

- A developer can easily locate:
  - where execution begins
  - where final legality is determined
- No ambiguity remains about where authority lives

---

## Step 3 Summary

This step focuses on:

- making execution authority explicit
- reducing fragmentation
- aligning mental model across preview and apply

This is a **clarity + architecture alignment step**, not just a bug-fix step.

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---

# STEP 4 — ACTION BREAKDOWN

## Duplicate / Legacy / Alternate Paths Audit

---

## TM-4A — Retire or Fence Deprecated Validation Compatibility Barrel

### Problem

`tradeMachine/validators/index.ts` remains as a broad deprecated compatibility barrel that exports many legacy-style validator and helper surfaces.

### Why It Matters

- Encourages future imports from non-canonical locations
- Preserves a wide legacy surface area
- Creates long-term drift risk even if current behavior is safe

### Goal

Narrow, fence, or retire the deprecated validator compatibility barrel so it no longer acts as an attractive alternate import path.

### Success Criteria

- The deprecated barrel is either:
  - removed
  - narrowed significantly
  - or clearly fenced to compatibility-only use
- Future developers are steered toward canonical surfaces by code structure
- No active code path depends on the broad legacy barrel without clear justification

---

## TM-4B — Separate Canonical vs Legacy Trade Context Exports

### Problem

`tradeContext/index.ts` still exposes both canonical surfaces and legacy compatibility wrappers from one barrel.

### Why It Matters

- Mixes canonical and deprecated paths in one import surface
- Makes it easier to accidentally use old wrappers
- Weakens the clarity established in Step 3

### Goal

Make canonical trade-context imports clearly distinct from legacy compatibility exports.

### Success Criteria

- Canonical surfaces remain easy to discover
- Legacy wrappers are:
  - removed from the main barrel
  - or clearly isolated behind a compatibility namespace
- Future import ambiguity is reduced

---

## TM-4C — Prune or Fence Dormant Secondary Helper Modules

### Problem

Secondary helper modules such as `rosterValidation.ts` and `enforcement.ts` still retain multiple dormant or legacy-style helper variants.

### Why It Matters

- Preserves duplicate-ish helper surfaces
- Creates future misuse risk
- Makes the validation landscape look broader than the real canonical model

### Goal

Prune, narrow, or clearly fence dormant secondary helper modules so they no longer look like first-class validation entrypoints.

### Success Criteria

- Non-canonical dormant helpers are either:
  - removed if safe
  - narrowed
  - or clearly marked as compatibility / legacy-only
- Canonical validation ownership remains unchanged
- Future drift risk is reduced

---

## TM-4D — Review Broad Public TradeMachine Barrel for Drift Risk

### Problem

`tradeMachine/index.ts` is a very broad public barrel that exports canonical surfaces alongside many lower-level rule and enforcement helpers.

### Why It Matters

- Broad export surfaces encourage inconsistent import patterns
- Makes it easier to bypass the intended canonical model conceptually
- Can preserve long-term cleanup debt even when behavior is correct

### Goal

Determine whether the public `tradeMachine/index.ts` barrel should be narrowed, reorganized, or left alone with clearer intent.

### Success Criteria

- Public trade-machine exports are reviewed through the lens of canonical vs convenience
- Any narrowing or fencing preserves valid consumers
- If no change is made, the reason is explicit and justified

---

## Step 4 Summary

This step focuses on:

- removing or fencing non-canonical import surfaces
- reducing long-term drift risk
- cleaning up legacy / compatibility exposure
- preserving the canonical authority model established in Steps 1 and 3

This is a **surface-area cleanup and canonical-entrypoint protection step**, not a business-rules rewrite.

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---

# STEP 5 — ACTION BREAKDOWN

## Rule Ownership & Consolidation Audit

---

## TM-5A — Clarify TPE / Trade-Exception Lifecycle Ownership

### Problem

TPE and trade-exception logic is still split across phases:

- legality is validated in the trade validator
- creation / consumption / history application happens later in `computeTradeResult()` inside `mutationPipeline.ts`

### Why It Matters

- This is one of the clearest remaining staged rule families
- Future changes could touch legality without updating lifecycle application, or vice versa
- Drift risk is higher here than in the more centralized rule families

### Goal

Make TPE / trade-exception ownership boundaries more explicit and durable so legality and lifecycle application stay aligned.

### Success Criteria

- The ownership split is either tightened or made structurally explicit
- Future contributors can clearly tell:
  - where TPE legality is decided
  - where TPE lifecycle effects are applied
  - where history entries are generated
- The family no longer feels like an accidental cross-phase split

---

## TM-5B — Clarify Sign-and-Trade Ownership Across Signing vs Trade Phases

### Problem

Sign-and-trade remains a staged family:

- signing legality is validated in one path
- trade legality is validated in another
- the combined mutation path still requires multiple prevalidated contexts

### Why It Matters

- Sign-and-trade is more complex than most other rule families
- The current structure is mostly correct, but still easier to misunderstand than simpler rule families
- Future edits could accidentally weaken the relationship between signing validation and trade validation

### Goal

Make sign-and-trade ownership and staging boundaries clearer and more durable.

### Success Criteria

- It is obvious which layer owns:
  - signing legality
  - trade legality
  - the staged handoff between them
- The staged design looks intentional, not improvised
- Future changes are less likely to update only one half of the flow

---

## TM-5C — Separate Non-Trade Mutation Validation Ownership from Pipeline Orchestration

### Problem

Trade now has an explicit authority model, but non-trade mutation validation is still routed through a large switch inside `validateMutation()` in `mutationPipeline.ts`.

### Why It Matters

- The current setup works, but it is less structurally clean than the trade path
- As more non-trade mutation logic grows, the pipeline risks becoming both orchestration layer and rule-ownership layer at once
- This creates long-term maintainability risk even if current behavior is correct

### Goal

Reduce ambiguity around whether `mutationPipeline.ts` is merely dispatching non-trade validation or actually owning those rule families.

### Success Criteria

- Non-trade validation ownership is clearer
- Pipeline orchestration and rule ownership are less entangled
- Future contributors can tell whether a non-trade rule belongs:
  - in mutation orchestration
  - in a dedicated validator
  - or in a separate authority/dispatch layer

---

## TM-5D — Preserve Intentional Staging and Leave Safe Ownership Boundaries Alone

### Problem

Some rule families are staged by design and should not be “consolidated” just for the sake of consolidation.

### Why It Matters

- Not every multi-stage flow is a problem
- Snapshot → authority → post-state and world-state-only apply gates are intentional and currently safe
- Over-consolidation could blur legitimate separation of concerns

### Goal

Protect the ownership boundaries that are already correct while tightening only the staged families that still carry real drift risk.

### Success Criteria

- Safe staged boundaries are explicitly recognized as intentional
- Cleanup work does not collapse layers that should remain separate
- Step 5 execution focuses only on real ownership risks, not cosmetic consolidation

---

## Step 5 Summary

This step focuses on:

- tightening ownership around the remaining staged rule families
- reducing future drift risk where legality and lifecycle are split
- improving durability of complex staged flows
- preserving the ownership boundaries that are already correct

This is an **ownership-clarity and consolidation step**, not a business-rules rewrite.

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---

# STEP 6 — ACTION BREAKDOWN

## Post-State Validation Layer Review

---

## TM-6A — Separate True Post-State-Only Checks from Mirrored Final-State Re-Checks

### Problem

`validatePostStateCapLegality(...)` currently mixes two different categories of validation in one layer:

- checks that are genuinely post-state-only
- checks that re-verify legality already enforced earlier using final snapshots

### Why It Matters

- Makes the layer harder to reason about
- Blurs the difference between:
  - final artifact sanity
  - final-state schema validity
  - mirrored legality enforcement
- Increases the chance that future contributors misunderstand what should or should not be duplicated earlier

### Goal

Make the internal structure of the post-state layer clearly distinguish:

- true post-state-only validation
- mirrored final-state legality re-checks

### Success Criteria

- A future contributor can quickly tell which checks only belong here
- The duplicated/re-check families are explicitly identifiable as such
- The layer no longer reads like one undifferentiated “everything after apply” validator

---

## TM-6B — Clarify Hard-Cap Re-Check Ownership Across Trade-Time vs Post-State Validation

### Problem

Hard-cap legality is enforced earlier in trade validation and then re-checked again post-state against final totals and derived hard-cap status.

### Why It Matters

- The duplication appears intentional, but the ownership boundary could still drift over time
- Future changes could update trade-time logic without updating post-state verification, or vice versa
- Hard-cap is one of the clearest “projection vs final-state” duplicated rule families

### Goal

Make the relationship between:

- trade-time hard-cap validation
- post-state hard-cap re-check validation

more explicit and durable.

### Success Criteria

- It is obvious why both checks exist
- The earlier layer is clearly about projected legality
- The later layer is clearly about validating final post-state artifacts
- Future hard-cap changes are less likely to create drift between the two layers

---

## TM-6C — Clarify Roster Re-Check Ownership Across Projection vs Final Player Snapshots

### Problem

Roster limits are enforced earlier during trade validation and then re-checked again post-state using actual final `team.players` arrays.

### Why It Matters

- This is another intentional duplication family, but one that can still be misread as unnecessary redundancy
- Projection-based roster validation and final-snapshot roster validation serve different purposes
- Future edits could accidentally weaken one side or create inconsistent thresholds/assumptions

### Goal

Make the ownership and reason for roster re-check staging explicit and durable.

### Success Criteria

- The difference between projected roster legality and final roster-snapshot legality is clear
- Future contributors can tell why both layers exist
- Drift risk between projection logic and final-state re-check logic is reduced

---

## TM-6D — Preserve the Shared Post-State Layer Role Across Mutation Families

### Problem

The post-state validator is shared across trade and non-trade mutation families, but its mixed responsibilities can make it tempting to over-specialize it around trade-only concerns or over-consolidate it into earlier validators.

### Why It Matters

- The shared post-state layer is one of the few places that validates actual final mutation outputs across mutation families
- Moving too much out of it could weaken final-state artifact protection
- Over-specializing it around trade could reduce reuse and clarity for non-trade paths

### Goal

Protect the post-state layer’s correct shared role while tightening only the parts that create real duplication/confusion.

### Success Criteria

- The layer remains clearly post-state-focused and mutation-family-agnostic
- Cleanup does not collapse truly post-state-only validation into earlier rule layers
- Shared authoritative final-state validation remains intact across mutation types

---

## Step 6 Summary

This step focuses on:

- separating true post-state-only validation from mirrored final-state legality re-checks
- tightening ownership clarity around duplicated hard-cap and roster enforcement
- protecting the correct shared role of the post-state layer
- reducing future drift without removing justified final-state validation

This is a **post-state ownership and staging clarity step**, not a business-rules rewrite.

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---
