# ARCHITECT_TM_REVIEW_RECORD

## Scope

Trade Machine — Step 1: Validator Core Truth Review

**Date:** 2026-03-25  
**Source:** Direct code inspection (no prior docs trusted)

---

# STEP 1 — TRADE MACHINE VALIDATOR CORE

## Purpose of this Step

Establish a true understanding of how trade legality actually works in the system.

This step answers:

- What determines if a trade is legal?
- What the UI thinks determines legality
- What the backend actually enforces
- Where those differ

This is the foundation for all future TM work.

---

# SYSTEM ARCHITECTURE (HIGH LEVEL)

The Trade Machine is not a single validator.

It is a multi-layer legality system.

## Layer 1 — Preview Validator (UI)

- Entry: `useTradeMachine.ts` → `validateCurrentTrade()`
- Core engine: `validateTrade(...)`
- Output: `result.legal`

This is what drives:

- UI green/red state
- Apply button enablement

## Layer 2 — Apply-Time Validation (Mutation Pipeline)

- Entry: `mutationPipeline.ts` → `computeWorldMutation('executeTrade')`
- Uses:
  - `buildPostTradeTeamsSnapshot(...)`
  - `validatePostTradeSnapshotForContext(...)` (reuses `validateTrade`)
  - `validateMutation(...)`

This is where real trade execution legality begins.

## Layer 3 — World / Invariant Gates (Apply-Only)

Runs after validator core:

- `validateMutationLeagueInvariants(...)`
- `validateMutationEntitlementInvariants(...)`
- `validateTradeApplyExclusivity(...)`

These do not run in preview.

## Layer 4 — Post-State Legality

Final enforcement layer:

- `validatePostStateCapLegality(...)`

Re-checks:

- cap legality
- roster constraints
- schema integrity

Also not part of preview.

---

# CORE INSIGHT

Trade legality is not determined by a single function.

It is determined by:

- `validateTrade(...)`
- post-trade snapshot validation
- world invariants
- post-state legality

The UI only reflects the first part.

---

# SUBSTEP FINDINGS

## TM-1A — Preview vs Apply Truth Gap

### What this area is

The relationship between:

- UI preview legality (`result.legal`)
- actual apply-time legality

### What was reviewed

- `useTradeMachine.ts`
- `TradeEditor.tsx`
- `tradeValidator.ts`
- `tradeContext.ts`
- `mutationPipeline.ts`
- `postStateCapValidator.ts`
- `leagueInvariants.ts`

### What Chat concluded

- UI uses:
  - fresh validation
  - `result.legal === true`

- Apply path:
  - reuses validator core
  - but adds additional gates after

- Therefore:

> A trade can be green in UI but fail in apply.

### Why it matters

This is a system trust issue:

- Users see green and assume valid
- System can still reject

This creates:

- confusion
- poor UX
- incorrect mental model of system

### Priority judgment

Highest-priority issue in Trade Machine.

This is not cosmetic — it affects correctness perception.

### Action taken

Spawned execution:

- `ARCHITECT_TM_1A_PREVIEW_APPLY_TRUTH_ALIGNMENT`

### Related deferred issues

- TM-1B — Roster Validation Split
- TM-1C — Hard Cap Distribution

---

## TM-1B — Roster Validation Split

### What this area is

Roster rules are enforced in multiple places:

- `computeRosterValidation(...)` (validator core)
- `validatePostStateCapLegality(...)` (post-state)

### What Chat concluded

- Preview:
  - enforces roster constraints via validator core

- Apply:
  - re-checks roster again in post-state

- These are:
  - separate implementations
  - separate timing
  - potentially different rule scopes

### Why it matters

This creates drift risk:

- preview says legal
- post-state rejects

Also creates:

- duplication
- maintenance risk

### Priority judgment

Medium priority.

Important, but secondary to TM-1A.

### Action taken

Deferred until after TM-1A.

---

## TM-1C — Hard Cap / Apron Distribution

### What this area is

Hard cap + apron rules are enforced across:

- `validateHardCap(...)`
- `validateSalaryMatching(...)`
- aggregation rules
- post-state cap validator

### What Chat concluded

- Some checks happen in validator
- Some checks happen post-state
- There are overlapping implementations

Also found:

- multiple hard-cap-related modules exist
- unclear single SSOT

### Why it matters

This is a consistency risk:

- same rule enforced in multiple places
- potential mismatch over time

### Priority judgment

Medium priority.

Important for long-term correctness.

### Action taken

Deferred until after TM-1A.

---

## TM-1D — Alternate Execution Path Risk

### What this area is

Alternate trade execution path:

- `tradeManager.executeTrade()`
- exported via `architectCore.ts`

### What Chat concluded

- This path:
  - is not the main TM path
  - but is still callable
- It can:
  - bypass mutation pipeline protections

### Why it matters

This is a future risk, not current breakage:

- could be accidentally used
- could bypass authoritative validation chain

### Priority judgment

Medium risk (preventative).

### Action taken

Deferred.

---

# GLOBAL CONCLUSIONS

## 1. The system is structurally strong

- Core validator (`validateTrade`) is well centralized
- Apply path reuses validator core
- Major rule families are covered

## 2. The system is layered (not unified)

- Preview does not equal Apply
- Apply includes additional gates

This is intentional, but not properly surfaced to the user.

## 3. The biggest issue is not missing rules

It is:

> Misalignment between what the UI shows and what the system enforces.

## 4. No evidence of missing major CBA rule families

- Salary matching — covered
- BYC — covered
- Stepien — covered
- Aggregation — covered
- TPE — covered
- S&T — covered

The issue is distribution and layering, not absence.

---

# PRIORITY ORDER (FROM STEP 1)

1. TM-1A — Preview vs Apply Truth Alignment (**ACTIVE**)
2. TM-1B — Roster Validation Consolidation
3. TM-1C — Hard Cap / Apron Consolidation
4. TM-1D — Alternate Execution Path Cleanup

---

# WHAT THIS ENABLES NEXT

With this understanding, we can now:

- Fix system trust (1A)
- Then unify rule enforcement (1B / 1C)
- Then remove structural risks (1D)

---

# FINAL NOTE

This document is the SSOT for Step 1 understanding.

All future TM work should reference this before making:

- validation changes
- UI changes
- pipeline changes

If a future change contradicts this document, it must be re-reviewed against live code.
