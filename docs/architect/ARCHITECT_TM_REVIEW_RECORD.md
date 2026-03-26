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

# STEP 2 — PREVIEW VS APPLY TRUTH GAP (UI TRUST LAYER)

## Scope

Trade Machine — Step 2: Preview vs Apply Truth Gap (UI Trust Layer)

**Date:** 2026-03-26  
**Source:** Direct code inspection (no prior docs trusted)

---

## Purpose of this Step

Re-evaluate the Trade Machine UI trust model **after** Step 1 execution work.

This step answers:

- What exact logic now enables the Apply button
- What conditions the UI currently treats as “valid”
- Which apply-time checks are now represented in preview
- Which apply-time checks still remain outside preview
- Whether the current UI trust model is now acceptable

---

## Executive Verdict

**MOSTLY ACCURATE BUT LIMITED**

The old silent mismatch was materially reduced by Step 1.

The UI now blocks Apply using three layers:

1. validation freshness via `hasCurrentValidation`
2. preview legality via `result.legal === true`
3. apply-preview legality via `fullLegalityResult.legal !== false`

This means the old state where the UI looked fully green while a locally-previewable apply-path check would later reject the trade has been significantly reduced.

However, the UI still does **not** account for three apply-only world-state gates:

- duplicate player world check
- duplicate entitlement world check
- entitlement exclusivity world check :contentReference[oaicite:1]{index=1}

Those remaining limits are now **explicitly disclosed** in the UI rather than hidden. So the trust model is no longer misleading in the original sense, but it is still architecturally limited.

---

## What Was Reviewed

- `src/features/architect/hooks/useTradeMachine.ts`
- `src/features/architect/tradeMachine/TradeEditor.tsx`

---

## Exact UI Truth Chain

### 1. Validation freshness

`hasCurrentValidation` is computed in `useTradeMachine.ts` and only becomes true when:

- `result.teamResults` exists and is non-empty
- the validated draft key still matches the current draft key via `isValidationCurrent(...)` :contentReference[oaicite:2]{index=2}

This means stale validation results no longer count as active truth.

---

### 2. Preview legality

`validateCurrentTrade()` still runs `validateTrade(...)` and stores the output in `result`. That remains the base preview legality layer. :contentReference[oaicite:3]{index=3}

---

### 3. Apply-preview legality

When the user clicks Validate, `handleValidate()` builds the same kind of trade context payload/current state needed for apply-path preview and calls `getFullLegalityPreview(...)`. The result is stored in `fullLegalityResult`. :contentReference[oaicite:4]{index=4}

---

### 4. Apply button gate

In `TradeEditor.tsx`:

- `fullPreviewBlocked = fullLegalityResult != null && fullLegalityResult.legal === false`
- `canApplyTrade = hasCurrentValidation && result?.legal === true && !fullPreviewBlocked` :contentReference[oaicite:5]{index=5}

So the exact boolean path to Apply enabled is:

- validation is current
- preview legality passed
- apply-preview legality did not fail

This is materially stronger than the pre-Step-1 state.

---

## What the UI Now Accounts For

### Accounted for in preview

#### 1. Base preview CBA legality

Still represented by `validateTrade(...)` and `result.legal`. :contentReference[oaicite:6]{index=6}

#### 2. Post-state cap validation

The hook explicitly documents that `validatePostStateCapLegality` now runs in preview via `getFullLegalityPreview(...)`, and no longer remains an apply-only gap. :contentReference[oaicite:7]{index=7}

#### 3. Apply-preview failure messaging

If `fullLegalityResult` is not legal, the UI shows:

- `Apply blocked (post-trade check): ...` :contentReference[oaicite:8]{index=8}

That means the UI now surfaces locally-previewable apply-path failures before execution.

---

## What the UI Still Does NOT Account For

The hook explicitly identifies three remaining apply-only gates:

- `validateMutationLeagueInvariants`
- `validateMutationEntitlementInvariants`
- `validateTradeApplyExclusivity` :contentReference[oaicite:9]{index=9}

These remain outside preview because they depend on broader world-state checks rather than only local trade state.

The UI warning next to Apply now says exactly that:

> “All local checks passed. World-state checks (duplicate players, entitlement conflicts, exclusivity) run at apply time and may still reject this trade.” :contentReference[oaicite:10]{index=10}

So the limitation is real, but it is now disclosed.

---

## Remaining Preview = Legal / Apply = Rejected Scenarios

Yes, these still exist.

A trade can still be:

- preview-valid
- apply-preview-valid
- rejected at apply time

if the rejection comes from one of the three remaining world-state gates:

1. duplicate player world check
2. duplicate entitlement world check
3. entitlement exclusivity world check :contentReference[oaicite:11]{index=11}

This is the remaining architectural boundary.

---

## Trust Classification

### Not Dangerous

Because the UI no longer silently represents preview truth as full execution truth. It blocks on the local apply-preview layer and explicitly discloses remaining world-only gates.

### Not Misleading

Because the UI warning matches the actual remaining gap.

### Final Classification

**Mostly Accurate but Limited**

The current trust model is acceptable for now because:

- all locally-previewable legality layers are represented
- the remaining gap is narrow
- the remaining gap is clearly disclosed to the user

---

## Conclusion

Step 1 appears to have solved the practical trust problem.

Step 2 does **not** uncover a new major UI truth failure. Instead, it confirms that the remaining mismatch is now:

- explicit
- narrow
- architectural

This is no longer the same class of problem as the original Preview vs Apply trust gap.

---

## Recommendation

### Do not open a major execution arc for Step 2 right now

This step is best treated as:

- a confirmation review
- a documentation checkpoint
- a boundary-definition step

### Possible future enhancement (optional)

If desired later, a future architecture investigation could ask:

- whether any of the three remaining world-state gates can be partially surfaced pre-apply using cached world snapshots or cheap read models

But that is a future enhancement, not a current trust failure.

---

## Final Note

The Trade Machine UI still does not equal full execution truth.

But after Step 1, it now appears to represent **all local previewable truth** and clearly communicates the remaining world-state limitations.

That is a meaningful difference.

```

```
