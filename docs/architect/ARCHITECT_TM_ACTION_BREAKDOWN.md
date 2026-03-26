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
