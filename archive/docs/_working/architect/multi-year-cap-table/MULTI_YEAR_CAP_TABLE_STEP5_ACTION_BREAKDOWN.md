# MULTI-YEAR CAP TABLE — STEP 5 ACTION BREAKDOWN

## Manual Mutation / Edit Surface Truth for Dead Money and Exceptions

---

## MYCT-5A — Tighten Dead-Money Edit Serialization So Manual Override Editing Preserves Canonical Multi-Year Shape More Faithfully And More Explicitly

### Problem

`ManageDeadMoneyModal.tsx` is honest that it is a manual override tool and that saving replaces the team’s entire dead money ledger, but its UI model still flattens dead-cap entries into one row per season and then saves back one canonical entry per row.

That approach is safe against accidental merging, but it is still structurally lossy:

- original multi-season grouping is not preserved
- richer original entry structure is not preserved cleanly
- replacement behavior can turn a canonical grouped ledger into a flatter one-row-per-entry ledger after save

### Why It Matters

- dead money feeds the canonical totals engine directly
- a manual correction surface should not quietly soften canonical structure more than necessary
- Step 5 should reduce shape drift risk at the edit seam before later steps review persistence/mutation path truth more broadly

### Goal

Make dead-money edit serialization preserve canonical multi-year shape more faithfully and make its replacement behavior more explicitly legible from source and UI.

### Success Criteria

- dead-money flattening/reconstruction is easier to reason about directly from source
- canonical grouped multi-season truth is preserved more faithfully where possible
- replacement semantics remain honest without unnecessary structural loss
- no broader cap-sheet totals-engine rewrite is required

---

## MYCT-5B — Tighten Exception Edit Ownership And Save Semantics So Current-Season Manual Edits Read More Clearly As Canonical Exception State, Not A Soft Partial Serializer

### Problem

`ManageExceptionsModal.tsx` is cleaner than the dead-money editor, but it still behaves more like a narrow current-season state serializer than a tightly explained canonical exception editor.

Examples:

- only a subset of exception types are editable in this surface
- save payloads include only enabled or used entries
- saved state is narrow and replacement-flavored rather than obviously patch-shaped
- modal scope is honest, but the saved ownership contract is still somewhat implicit

### Why It Matters

- exception editing is intentionally current-year-only, so its ownership model should be especially explicit and clean
- users and future developers should be able to reason clearly about whether the modal is replacing canonical current-season state or partially mutating it
- Step 5 should tighten this seam before broader persistence-path review work continues

### Goal

Make current-season exception editing read more clearly as owned canonical exception state with bounded scope and clearer save semantics.

### Success Criteria

- the exception modal’s state model and save payload are easier to reason about directly from source
- current-season-only authority remains explicit and structurally honest
- payload shaping feels more intentionally aligned to canonical exception ownership
- no broader redesign of exception tooling is required

---

## MYCT-5C — Add Focused Guardrails For Dead-Money Shape Preservation, Exception Save Semantics, And Edit-Boundary Honesty

### Problem

The Step 5 risk is largely about these modals being honest enough to use, but still soft in the places where manual editing can quietly drift away from canonical structure.

Examples of drift risk:

- dead-money editing could become more lossy without a loud failure
- dead-money replacement behavior could stop matching the warning copy
- exception save payloads could drift away from the intended canonical current-season ownership model
- current-year-only exception boundaries could soften in source or UI without obvious breakage
- modal save semantics could become harder to reason about without direct serialization guardrails

### Why It Matters

- these edit surfaces sit directly on top of the cap-sheet SSOT and can undermine truth even if the compute layer itself remains correct
- if Step 5 drifts silently, later work may be validating canonical totals against edit surfaces that are subtly reshaping data on save
- Step 5 should leave behind durable serialization and boundary guardrails, not only a one-time review result

### Goal

Add focused guardrails that pin dead-money shape preservation, exception save semantics, replacement-vs-scope honesty, and current-season-only edit boundaries.

### Success Criteria

- focused tests/guardrails protect dead-money serialization behavior and replacement semantics
- focused tests/guardrails protect exception save payload shaping and current-season ownership boundaries
- focused tests/guardrails protect the modal copy/signaling that explains replacement vs current-season-only behavior
- future drift in the manual edit seam is more likely to fail loudly

---

## Step 5 Summary

This step focuses on:

- tightening dead-money manual serialization and shape preservation
- tightening exception edit ownership and save semantics
- adding focused guardrails around manual mutation/edit-surface truth

This is a **manual edit surface / serialization / current-season edit-boundary** step, not a canonical totals engine, consumer-surface, or contract-year slicing step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **MYCT-5A + MYCT-5B** may be executed together if the needed work concentrates in `ManageDeadMoneyModal.tsx`, `ManageExceptionsModal.tsx`, and focused modal serialization tests
- **MYCT-5C** can then close the step by pinning the intended dead-money / exception edit contract with focused guardrails

Validation can stay tiered:

- use targeted modal/edit-surface tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
