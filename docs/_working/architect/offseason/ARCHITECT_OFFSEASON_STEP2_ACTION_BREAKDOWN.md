# STEP 2 — ACTION BREAKDOWN

## Season Advance Modal UI Truth and Wizard Wiring

---

## OS-2A — Make the Season Advance Wizard Flow More Explicit and Durable

### Problem

`SeasonAdvanceModal.tsx` already has a real wizard flow, but the visible season-advance experience still depends on several internal assumptions holding together:

- summary step truth
- option-decision step truth
- confirmation step truth
- processing state truth
- complete state truth

The modal reads cleanly today, but wizard-flow clarity can still drift if the internal step contract or step-transition assumptions change without focused protection.

### Why It Matters

- Contributors can accidentally weaken the step flow while keeping the modal superficially functional
- Offseason season advancement is a high-trust action, so visible step truth matters more than in a low-stakes modal
- A wizard that is only implicitly correct is vulnerable to regressions in step order, gating, or post-success state

### Goal

Make the Season Advance wizard flow easier to trace and harder to drift.

### Success Criteria

- The visible step model stays explicit and easier to verify
- Step progression and regression rules are clearer
- Contributors are less likely to weaken wizard truth without obvious friction
- Focused protections make step-flow regressions easier to catch

---

## OS-2B — Tighten Option-Decision Staging and Validation Truth

### Problem

The modal correctly stages option decisions locally today, but that staging truth still needs to stay clearly separate from authoritative execution truth.

The most important seam is:

- local option staging should remain UI state only
- validation should remain real and enforceable before advancement
- option decisions should not become partially finalized or misleading before authoritative execution

### Why It Matters

- Player/team option decisions are one of the most visible and trust-sensitive parts of the offseason flow
- If option staging drifts, the confirmation step can become misleading even if the underlying season manager remains correct
- This is a classic place where a modal can start to over-own business truth instead of just staging it

### Goal

Keep option-decision staging truthful, well-bounded, and clearly owned by the modal as UI staging only.

### Success Criteria

- Option staging remains clearly local/staged rather than authoritative
- Validation remains clear and enforced before advancement
- Confirmation accurately reflects staged decisions
- Contributors are less likely to blur staged option state with finalized execution truth

---

## OS-2C — Align Modal Result Truth with Actual World-Advance Truth

### Problem

The modal now normalizes one `worldAdvanceAftermath` payload, which is a strong improvement, but that normalization layer is now part of the core UI truth seam.

That means the modal’s result contract must stay tightly aligned with:

- real world-backed advance results
- real season/year truth
- real offseason summary truth
- wrapper aftermath expectations

If that seam drifts, the modal can remain structurally clean while still reporting partial or misleading post-success truth.

### Why It Matters

- The modal is now the bridge between the authoritative executor and wrapper aftermath state
- If this normalized result contract drifts, the wrapper will faithfully apply the wrong thing
- This is one of the most important UI-to-execution seams in Offseason

### Goal

Protect the modal’s normalized world-backed success contract so it remains trustworthy and clearly tied to authoritative world-advance results.

### Success Criteria

- Modal success payload remains easier to trace back to authoritative world results
- Season/year/summary normalization remains clear and justified
- Wrapper aftermath continues to depend on normalized authoritative result truth, not fallback invention
- Contributors are less likely to weaken this bridge silently

---

## OS-2D — Add Focused Guardrails for SeasonAdvanceModal UI Truth

### Problem

Even with the current clean structure, the modal’s UI truth still depends on several seams continuing to hold:

- wizard step order and gating
- local option staging boundaries
- single authoritative dispatch path
- explicit blocked behavior when world context is missing
- normalized success payload shape

These are all high-value seams and should not rely only on current readability.

### Why It Matters

- The modal is a central user-trust surface in Offseason
- UI drift can happen gradually even when the feature continues to “work” at a basic level
- Focused guardrails reduce the chance that future changes quietly make the modal less truthful

### Goal

Add focused protection so the Season Advance modal remains a trustworthy UI surface instead of only a currently clean implementation.

### Success Criteria

- Wizard-flow regressions are easier to detect
- Missing-world blocked behavior stays explicit
- Dispatch path remains singular and authoritative
- Success normalization and confirmation truth stay protected

---

## Step 2 Summary

This step focuses on:

- making the Season Advance wizard flow more explicit and durable
- tightening option-decision staging and validation truth
- aligning modal result truth with actual world-advance truth
- adding focused guardrails for SeasonAdvanceModal UI truth

This is a **SeasonAdvanceModal UI-truth step**, not a deep season-manager correctness review.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **OS-2A + OS-2B** may be executed together if wizard-flow structure and option-staging truth are enforced through the same modal-state seam
- **OS-2C + OS-2D** may be executed together if normalized success truth and modal guardrails share the same follow-up seam

Validation can stay tiered:

- use targeted SeasonAdvanceModal UI/wizard/option-staging tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for blocker follow-up or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution
