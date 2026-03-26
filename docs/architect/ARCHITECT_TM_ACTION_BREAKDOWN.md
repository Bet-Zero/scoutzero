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
