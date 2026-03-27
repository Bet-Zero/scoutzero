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

---

# STEP 3 — APPLY PIPELINE AUTHORITY (TRUE EXECUTION SOURCE OF TRUTH)

## Scope

Trade Machine — Step 3: Apply Pipeline Authority (True Execution Source of Truth)

**Date:** 2026-03-26  
**Source:** Direct code inspection (no prior docs trusted)

---

## Purpose of this Step

Trace the full execution path of a trade from Apply click to persistence, and determine whether there is a true single source of truth for execution legality.

This step answers:

- What the exact apply chain is
- In what order validation stages run
- Where `validateTrade(...)` is reused
- Where new rules are introduced after it
- Whether execution authority is centralized or fragmented

---

## Executive Verdict

**FUNCTIONALLY AUTHORITATIVE, STRUCTURALLY FRAGMENTED**

There is a real authoritative execution path, but it is **not represented by one clean single function**.

The actual apply-time legality chain is spread across:

1. UI gate / user click in `TradeEditor.tsx`
2. exported trade payload via `useTradeMachine.ts`
3. trade snapshot + validation context in `tradeContext.ts`
4. mutation pipeline orchestration in `mutationPipeline.ts`
5. additional apply-only world invariant gates
6. post-state validation

So the system **does have a real authority path**, but that authority is layered rather than centralized.

The correct classification is:

- **PASS** for existence of a real authoritative path
- **RISK** for authority clarity / single-source-of-truth readability

---

## What Was Reviewed

- `src/features/architect/tradeMachine/TradeEditor.tsx`
- `src/features/architect/hooks/useTradeMachine.ts`
- `src/features/architect/utils/tradeContext/tradeContext.ts`

---

## Apply Pipeline Diagram (Step-by-Step)

### 1. UI Apply button gate

In `TradeEditor.tsx`, Apply is enabled only when:

- `hasCurrentValidation`
- `result?.legal === true`
- `!fullPreviewBlocked`

Where:

- `fullPreviewBlocked = fullLegalityResult != null && fullLegalityResult.legal === false`
- `canApplyTrade = hasCurrentValidation && result?.legal === true && !fullPreviewBlocked` :contentReference[oaicite:0]{index=0}

This is the final UI-side boolean gate before apply is allowed.

---

### 2. User clicks Apply

Still in `TradeEditor.tsx`, clicking Apply does the following:

- rechecks `hasCurrentValidation`
- rechecks `result?.legal`
- exports the current trade via `exportCurrentTrade()`
- passes that payload into `onApplyTrade(...)` if provided :contentReference[oaicite:1]{index=1}

This means the Trade Machine UI does **not** itself persist the trade. It hands off execution to the downstream apply surface.

---

### 3. Preview-side apply-path simulation already exists

Before apply, `useTradeMachine.ts` runs two preview layers when Validate is clicked:

- `validateTrade(...)` via `validateCurrentTrade()`
- `getFullLegalityPreview(...)` via `handleValidate()` :contentReference[oaicite:2]{index=2}

`getFullLegalityPreview(...)` is a reduced apply-path legality preview that:

- builds the post-trade snapshot
- validates the snapshot
- runs post-state cap legality
- intentionally excludes world-state gates that require broader reads :contentReference[oaicite:3]{index=3}

This matters because it mirrors much of the eventual apply authority path, but it is still only a preview.

---

### 4. Snapshot builder

In `tradeContext.ts`, the first real execution-logic building block is:

- `buildPostTradeTeamsSnapshot(...)` :contentReference[oaicite:4]{index=4}

This function is explicitly documented as:

- pure
- deterministic
- no validator calls
- responsible for applying roster / player / entitlement / pick movement into a post-trade state

This is the first major stage in real execution logic.

---

### 5. Snapshot validation context

Then `tradeContext.ts` uses:

- `validatePostTradeSnapshotForContext(...)` :contentReference[oaicite:5]{index=5}

This function:

- asserts snapshot shape
- constructs validation input
- calls `validateTrade(...)` exactly once on the **post-trade snapshot**
- returns a validated context object

This is the main place where `validateTrade(...)` is reused in the apply path.

---

### 6. Post-state legality

Still in `tradeContext.ts`, `getFullLegalityPreview(...)` shows that post-state cap legality is a separate layer:

- `validatePostStateCapLegality(...)` is run after the snapshot validation context
- its result is merged with the post-trade snapshot validation result :contentReference[oaicite:6]{index=6}

This means even within the apply-like path, `validateTrade(...)` is not the final authority alone.

---

## Where `validateTrade(...)` Is Reused vs Where New Rules Enter

### Reused

`validateTrade(...)` is reused in the apply-related path through:

- `validatePostTradeSnapshotForContext(...)` :contentReference[oaicite:7]{index=7}

This is important: the apply path does **not** invent an entirely separate legality engine. It reuses the canonical trade validator on the **post-trade snapshot**.

### New layers added after `validateTrade(...)`

After that reuse, new rule layers are introduced:

- `validatePostStateCapLegality(...)` :contentReference[oaicite:8]{index=8}
- world-only gates (as documented in the hook):
  - duplicate player world check
  - duplicate entitlement world check
  - entitlement exclusivity world check :contentReference[oaicite:9]{index=9}

So `validateTrade(...)` is necessary, but not sufficient, for final execution authority.

---

## True Execution Authority — Is There a Single Source?

### Strict answer

**No single function fully represents final execution authority.**

### Practical answer

There is a **single authoritative pipeline**, but it is composed of multiple layers:

- post-trade snapshot construction
- snapshot validation via `validateTrade(...)`
- post-state legality
- world invariant / exclusivity checks

So the source of truth is not one function. It is a **chain**.

---

## Authority Clarity Assessment

### PASS — There is a real authoritative path

The system is not ad hoc. It has a real execution chain with defined stages, and `validateTrade(...)` is reused inside that chain rather than bypassed.

### RISK — Authority is fragmented

A developer could still incorrectly assume:

- `validateTrade(...)` alone is final truth
- or `getFullLegalityPreview(...)` alone is final truth

But the code shows the final truth is broader than either of those, because additional apply-only world gates still exist.

### FAIL?

No. This is not a failure of authority existence. It is a readability / ownership clarity issue.

---

## Final Classification

### Execution authority

**PASS**

There is a real, layered authoritative apply path.

### Single-function authority clarity

**RISK**

There is no single clearly named function that a reader can point to and say:

> “This alone is the final trade execution authority.”

### Overall Step 3 verdict

**Functionally authoritative, structurally fragmented**

---

## Conclusion

The apply path is not missing authority.

The real issue is that authority is distributed across a chain rather than embodied in one obvious surface.

That means Step 3 should likely produce follow-up work focused on one or both of:

- making the authoritative chain easier to understand / expose
- reducing ambiguity around what actually counts as “final authority”

---

## Recommendation

This step **does justify Action Breakdown work**.

The likely follow-up theme is:

- execution authority clarity
- explicit ownership of final legality
- possibly exposing or naming the true final authority chain more clearly

---

## Final Note

`validateTrade(...)` remains the core validator, but it is not the final authority by itself.

The final authority is the layered apply chain that includes:

- snapshot construction
- snapshot validation
- post-state legality
- world invariant checks

That is the true execution truth model today.

---

# STEP 4 — DUPLICATE / LEGACY / ALTERNATE PATHS AUDIT

## Scope

Trade Machine — Step 4: Duplicate / Legacy / Alternate Paths Audit

**Date:** 2026-03-26  
**Source:** Direct code inspection (no prior docs trusted)

---

## Purpose of this Step

Identify whether any remaining alternate, legacy, compatibility, or duplicate surfaces still exist that could:

- confuse future development
- create drift risk
- expose non-canonical trade validation / authority entrypoints
- preserve duplicate helper implementations

This step re-checks the system **after** Step 1 removed the obvious trade execution bypass and **after** Step 3 clarified the canonical authority surfaces.

---

## Executive Verdict

**NO CURRENT DANGEROUS ALTERNATE EXECUTION PATH FOUND**

The obvious dangerous execution bypass has been removed.

What remains is mostly:

- compatibility barrels
- legacy wrappers
- broad public helper exports
- retained duplicate helper modules whose drift risk has been reduced but not eliminated

So Step 4 is **not** uncovering a new severe execution-authority bug.

Instead, it identifies a smaller set of **cleanup / drift-risk surfaces** that should be treated as either:

- harmless compatibility
- dormant cleanup debt
- future drift risk

---

## What Was Reviewed

- `src/features/architect/utils/tradeContext/index.ts`
- `src/features/architect/utils/tradeContext/legacy/index.ts`
- `src/features/architect/utils/tradeMachine/validators/index.ts`
- `src/features/architect/utils/tradeMachine/index.ts`
- `src/features/architect/utils/tradeManager.ts`
- `src/features/architect/utils/architectCore.ts`
- `src/features/architect/utils/tradeMachine/rules/rosterValidation.ts`
- `src/features/architect/utils/tradeMachine/rules/enforcement.ts`
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.ts`

---

## 1. Alternate Execution Paths — Current State

### Finding

No reviewed live surface currently exposes a direct alternate **trade execution** path comparable to the old `tradeManager.executeTrade()` risk.

### Evidence

`tradeManager.ts` is now explicitly a **read-only roster transaction helper** module for non-trade helpers like:

- `signFreeAgent`
- `waivePlayer`
- `extendPlayer`

and it explicitly says persistence must be handled through mutation-pipeline authority. :contentReference[oaicite:0]{index=0}

`architectCore.ts` no longer re-exports trade execution. It only re-exports those read-only roster helpers from `tradeManager.ts`. :contentReference[oaicite:1]{index=1}

### Classification

**No dangerous alternate trade execution surface found in reviewed files.**

---

## 2. Remaining Legacy / Compatibility / Duplicate Surfaces

---

### A. `tradeContext/legacy/index.ts`

#### What it is

A deprecated legacy wrapper namespace containing:

- `legacy_validateTradeForContext(...)`
- `validateTradeForContext` (alias)

The file explicitly warns it is:

- deprecated
- not for mutation pipeline use
- kept for backward compatibility, legacy test compatibility, and quick UI previews / external tooling :contentReference[oaicite:2]{index=2}

#### Why it matters

This is not a dangerous execution surface now, but it is still a **non-canonical validation wrapper** that could be imported incorrectly later.

#### Classification

**Harmless Compatibility / Drift Risk**

---

### B. `tradeContext/index.ts` legacy barrel exposure

#### What it is

The canonical `tradeContext` barrel now exports:

- canonical surfaces such as:
  - `buildTradeApplyPreparation`
  - `getTradePreviewAuthority`
  - `validateTradeExecutionAuthority`

but it also still barrel-exports:

- `legacy_validateTradeForContext`
- `validateTradeForContext` from `./legacy` :contentReference[oaicite:3]{index=3}

It also exposes:

- `getFullLegalityPreview` as a compatibility alias for preview authority callers :contentReference[oaicite:4]{index=4}

#### Why it matters

The barrel is much better than before, but it still exposes both canonical and legacy paths from one import surface. That keeps some future confusion alive even though the file comments clearly separate them.

#### Classification

**Harmless Compatibility / Drift Risk**

---

### C. `tradeMachine/validators/index.ts`

#### What it is

A deprecated compatibility barrel that exports a large set of trade-machine validators and helpers, including:

- `validateTradeExceptions`
- `validateSalaryMatching`
- `validateRoster`
- `validateHardCap`
- `validateSecondApronRules`
- `computeMatchingValues`
- `validationCache`
- and more :contentReference[oaicite:5]{index=5}

The file explicitly calls itself:

> `COMPATIBILITY LAYER - DEPRECATED` :contentReference[oaicite:6]{index=6}

#### Why it matters

This is not necessarily wrong by itself, but it preserves a very broad old-style import surface that can bypass the newer, clearer canonical trade authority mental model.

It is unlikely to be a dangerous runtime path by itself, but it is a strong **future drift risk** because it makes it easy to import pieces from legacy-style locations instead of the intended canonical surfaces.

#### Classification

**Drift Risk**

---

### D. `tradeMachine/index.ts` broad public barrel

#### What it is

The public trade-machine barrel exports:

- canonical `validateTrade`
- many individual rule helpers
- many enforcement helpers
- matching utilities
- cap utilities
- swap / conveyance utilities
- helper exports such as `enforceRosterWindow`, `enforceSecondApronHandcuffs`, etc. :contentReference[oaicite:7]{index=7}

#### Why it matters

This is an **active** public API and not inherently wrong. But it is broad enough that it still exposes many lower-level rule / enforcement surfaces to consumers, which can encourage non-canonical usage patterns later.

This is less of a legacy problem and more of a **public API breadth / drift risk** problem.

#### Classification

**Active / Mild Drift Risk**

---

### E. `rosterValidation.ts`

#### What it is

This file retains multiple roster helper variants, including:

- `validateRosterWindow(...)`
- `enforceRosterWindow(...)`
- `enforceRosterRules(...)`
- `enforceRosterWindowAdvanced(...)`
- legacy compatibility exports at the bottom :contentReference[oaicite:8]{index=8}

It now imports shared `ROSTER_LIMITS` from `validateRoster`, which reduces constant drift. :contentReference[oaicite:9]{index=9}

#### Why it matters

This is no longer the same high-risk drift surface it once was, because the limits are shared.

But it still preserves multiple secondary roster helper shapes, including clearly legacy-facing exports, which makes the roster surface broader than the canonical ownership model really needs.

#### Classification

**Dormant / Drift Risk**

---

### F. `enforcement.ts`

#### What it is

This file still exports secondary enforcement helpers like:

- `enforceConsent`
- `enforceTiming`
- `enforceEligibility`
- `enforceRosterWindow`
- re-export of `enforceSecondApronHandcuffs` from `basicRules` :contentReference[oaicite:10]{index=10}

It also now imports shared `ROSTER_LIMITS`, so roster constant drift is reduced. :contentReference[oaicite:11]{index=11}

#### Why it matters

This file looks more like a retained helper surface than an active canonical validation authority surface.

It is not dangerous by itself, but it is another example of a broad duplicate-ish enforcement layer that could be misused if future code imports from convenience surfaces rather than canonical ones.

#### Classification

**Dormant / Drift Risk**

---

### G. `hardCapValidation.ts` compatibility exports

#### What it is

This file is explicitly marked as the **canonical trade-time hard cap validator** through `validateHardCap(...)`. :contentReference[oaicite:12]{index=12}

However, it also still exports additional secondary surfaces:

- `validateHardCapLegacy(...)`
- `wouldExceedHardCapAfterTrade(...)`
- `getActiveHardCapLimit(...)`
- aliases:
  - `hardCapValidation`
  - `hardCapValidationLegacy` :contentReference[oaicite:13]{index=13}

#### Why it matters

This is not a duplicate active implementation problem in the old sense, because the canonical function is clearly identified in the file.

But the retained legacy and alias exports still widen the surface area and preserve some compatibility debt.

#### Classification

**Harmless Compatibility / Drift Risk**

---

## 3. Classification Summary

### Active

- `tradeMachine/index.ts` public barrel — active broad public API surface :contentReference[oaicite:14]{index=14}

### Dormant

- `rosterValidation.ts` retained secondary roster helpers / legacy exports :contentReference[oaicite:15]{index=15}
- `enforcement.ts` retained secondary enforcement helper layer :contentReference[oaicite:16]{index=16}

### Harmless Compatibility

- `tradeContext/legacy/index.ts` deprecated wrapper namespace :contentReference[oaicite:17]{index=17}
- `tradeContext/index.ts` compatibility alias exports such as `getFullLegalityPreview` and legacy barrel exposure :contentReference[oaicite:18]{index=18}
- `hardCapValidation.ts` legacy / alias exports around canonical `validateHardCap` :contentReference[oaicite:19]{index=19}

### Drift Risk

- `tradeMachine/validators/index.ts` deprecated compatibility barrel :contentReference[oaicite:20]{index=20}
- broad `tradeMachine/index.ts` public export surface :contentReference[oaicite:21]{index=21}
- retained secondary roster / enforcement modules (`rosterValidation.ts`, `enforcement.ts`)
- mixed canonical + legacy exposure in `tradeContext/index.ts`

### Dangerous

- **None confirmed in reviewed files**

---

## 4. Recommendations

### Should become Step 4 execution work

#### 1. Narrow or fence compatibility barrels

Highest-value target:

- `tradeMachine/validators/index.ts`

Reason:

- explicitly deprecated
- very broad
- strong future drift risk
- likely the cleanest Step 4 execution target

#### 2. Reduce mixed canonical + legacy exposure in `tradeContext/index.ts`

Reason:

- canonical barrel still exposes deprecated wrapper paths
- future confusion risk remains even though comments are clear

#### 3. Prune or fence dormant roster / enforcement helper surfaces if safe

Reason:

- not dangerous
- but they preserve secondary non-canonical helper shapes

This is lower priority than the barrel cleanup.

---

### Should probably be documented and left alone for now

#### 1. `tradeManager.ts`

It no longer exposes trade execution authority and is explicitly read-only. :contentReference[oaicite:24]{index=24}

#### 2. `architectCore.ts`

Its current role is not a trade execution bypass risk anymore. :contentReference[oaicite:25]{index=25}

#### 3. `hardCapValidation.ts` legacy aliases

These are compatibility debt, but much less urgent than the broader deprecated barrels because the canonical owner is now clearly identified in-file. :contentReference[oaicite:26]{index=26}

---

## Final Conclusion

Step 4 does **not** reveal a remaining dangerous alternate trade execution path.

The major execution-risk cleanup appears to have been accomplished in Step 1.

What remains now is mostly **surface-area cleanup**:

- deprecated barrels
- legacy wrappers
- retained secondary helper modules
- broad compatibility exports

So Step 4 is likely an execution arc about:

- reducing drift risk
- narrowing non-canonical entry surfaces
- cleaning up legacy compatibility layers

—not about fixing a live dangerous execution bypass.

---
