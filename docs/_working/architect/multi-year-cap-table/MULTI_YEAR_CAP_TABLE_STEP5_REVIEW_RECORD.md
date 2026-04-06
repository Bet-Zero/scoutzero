# MULTI-YEAR CAP TABLE — STEP 5 REVIEW RECORD

## Scope

Multi-Year Cap Table Truth Pass — Step 5: Manual Mutation / Edit Surface Truth for Dead Money and Exceptions

**Date:** 2026-04-05  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the manual cap-sheet edit surfaces to determine whether dead-money and exception edits serialize back into canonical multi-year truth cleanly and honestly.

Main questions:

- whether the dead-money modal’s flat editing model reconstructs canonical multi-year shape truthfully
- whether the exception modal’s editable state and saved payload align with canonical exception ownership
- whether current-year-only editing boundaries are structurally honest
- whether manual edits can create shape drift versus what the totals engine expects
- whether save paths and modal copy tell an honest story about replacement vs partial mutation behavior
- whether any edit surface can silently undermine multi-year cap-table truth

---

## Executive Verdict

**RISK**

The edit surfaces are usable and fairly honest, but not yet clean enough for PASS.

The strongest clean part:

- `ManageDeadMoneyModal.tsx` explicitly says it is manual override mode and that saving will replace the team’s entire dead money ledger
- `ManageExceptionsModal.tsx` explicitly says it updates the team’s live current-season exception state and that future-year cap-sheet views are read-only for exception editing
- the user-facing copy is unusually direct about scope and authority

The main risk:

- both modals still use lossy UI editing models relative to ideal canonical shape preservation
- the dead-money modal flattens canonical/legacy shapes into one UI row per season and then saves back one canonical entry per UI row, which is safe against accidental merging but can lose original grouping/shape fidelity
- the exceptions modal is cleaner, but still saves a narrow current-season state object rather than a fine-grained patch model, and only includes entries that are enabled or have non-zero usage

The seam is usable and mostly honest, but still not fully lossless.

---

## Manual Edit-Surface / Payload-Shaping Map

### 1. Dead-money editor

`ManageDeadMoneyModal.tsx` does three things:

- reads `teamCapSheet.deadCap`
- flattens canonical/legacy shapes into editable UI rows
- reconstructs a canonical dead-cap payload on save

It supports:

- canonical array shape: `amountByYear: [{ season, amount, isStretched? }]`
- legacy object-map shape: `{ "2025-26": { amount } }`

The UI model is:

- `{ id, label, seasonKey, amount, stretched, originalEntry }` per row

### 2. Exception editor

`ManageExceptionsModal.tsx` does three parallel things:

- reads canonical exception entries through `getCanonicalExceptionEntry(...)`
- builds one editable state object per exception type
- saves a canonical exceptions payload for the current season

Scope is explicitly limited to:

- `mle`
- `tpmle`
- `bae`
- `room`

TPE is explicitly out of scope in this modal.

### 3. Save-path posture

Both modals are layered on top of the cap-sheet SSOT through callback save paths:

- dead money: `onSave(deadCapPayload)`
- exceptions: `onSave(exceptionsPayload)`

That is structurally fine. They are UI serializers, not competing compute owners.

---

## Dead-Money / Exception Modal Truth Analysis

### Dead-money flat editing model is honest, but lossy

This is the biggest Step 5 risk.

The good part:

- the modal explicitly says it is a manual override
- it explicitly says changes will replace the team’s entire dead money ledger

So the copy is not hiding that this is a replacement-style editor.

The soft part:

- flattening turns each season slice into an independent UI row
- saving turns each UI row back into its own canonical dead-cap entry with a one-element `amountByYear` array
- `notes` are replaced with `'Manual Adjustment'`
- grouping across seasons for a single original dead-cap entry is not preserved
- richer original metadata beyond `playerId` / `playerName` / per-row season amount is not really preserved

That means the modal is truthful about replacement, but not shape-preserving.

### Dead-money reconstruction is safe in one narrow sense

There is one real positive here.

By saving one entry per UI row, the modal avoids accidental regrouping or accidental merge logic. That is a defensive choice.

So this is not chaotic serialization. It is conservative serialization.

The problem is just that conservative here also means structurally lossy.

### Exception editable state aligns fairly well with canonical exception ownership

This seam is cleaner than dead money.

The modal:

- loads each exception through `getCanonicalExceptionEntry(teamCapSheet, type)`
- defaults total amounts from cap settings when missing
- computes room-exception eligibility through `canUseRoomException(teamCapSheet, currentYear)`
- saves back a canonical object keyed by exception type

That is a pretty good match for owned current-season exception truth.

### Exception editing boundary is structurally honest

This is one of the strongest positives in Step 5.

The modal copy says:

- changes update the team’s live current-season exception state
- future-year cap-sheet views are read-only for exception editing

And the modal itself is built around:

- `currentYear`
- `seasonKey` derived from `currentYear`
- `getCapSettingsForYear(currentYear)`

So this is not pretending to be multi-year exception editing.

### Exception save payload is narrow, but slightly replacement-flavored

On save, it builds a canonical object only for exception types where:

- `enabled` is true
- or `usedAmount > 0`

That is reasonable.

But it also means:

- disabled zeroed entries are omitted
- the payload is not clearly framed as “patch just this changed field”
- it reads more like “here is the modal’s canonical current-season exception state to save”

That is not necessarily wrong. It just means the serializer is state-shaped, not patch-shaped.

### Manual edits can create shape drift versus the pure canonical ideals

This is the core Step 5 issue.

For dead money:

- yes, definitely, because the original grouped canonical shape can be broken into one-entry-per-row replacements

For exceptions:

- less severe, but still possible if downstream logic expects broader preserved structure than the modal currently emits
- the save payload only carries a subset of exception-entry fields, mostly:
  - `enabled`
  - `totalAmount`
  - `usedAmount`
  - `seasonKey`
  - optional `notes`

That is probably enough for canonical ownership here, but still not a full-fidelity editor.

### Modal copy is more honest than average

This deserves credit.

The dead-money modal tells the user:

- this is manual override mode
- this replaces the whole ledger

The exceptions modal tells the user:

- this is current-season state
- future-year views are read-only for exception editing

So the user-facing story is better than the underlying serialization purity.

---

## Any Misleading, Lossy, or Weakly Aligned Serialization Paths

### 1. Dead-money serialization is intentionally lossy

Biggest Step 5 risk.

The modal preserves season amounts, labels, and stretch flags per row, but not the full original multi-season grouping/origin contract identity of dead-cap entries.

### 2. Dead-money replacement semantics are honest, but blunt

Because save replaces the whole ledger, any omitted nuance in the flattened UI model becomes real data loss, not just display loss.

### 3. Exception serializer is narrow, but scope-bound

This is acceptable, but still a seam to note:

- only four exception types are editable here
- payload only includes a narrow set of canonical fields
- omitted entries are effectively treated as not part of the edited state

### 4. Room exception gating is honest and structurally aligned

This is a positive, not a risk:

- room exception is disabled when not under the cap
- tooltip/warning copy explains why
- eligibility is computed from SSOT-style room exception logic for the current year

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- both modals are unusually honest about their scope and replacement behavior
- exception editing is clearly current-year-only
- exception payload shaping aligns reasonably well with canonical exception ownership
- dead-money serialization is deliberate rather than sloppy

### Why this is not PASS

- dead-money editing is structurally lossy
- dead-money save reconstructs a replacement ledger in a flattened one-row-per-entry style
- exception editing is state-shaped rather than clearly patch-shaped
- these edit surfaces can preserve operational truth while still softening canonical structure

---

## Files Reviewed

- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.tsx`
- `src/features/architect/capSheet/modals/ManageExceptionsModal.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/capSheet/modals/ManageDeadMoneyModal.tsx`

- `ManageDeadMoneyModal`
- dead-cap flattening logic inside the initialization `useEffect`
- canonical reconstruction in `handleSave`
- replacement-copy warning in modal body
- `handleAdd`, `handleChange`, `handleDelete` row editing model

### `src/features/architect/capSheet/modals/ManageExceptionsModal.tsx`

- `ManageExceptionsModal`
- `EXCEPTION_TYPES`
- room-exception eligibility via `canUseRoomException(...)`
- initialization `useEffect` using `getCanonicalExceptionEntry(...)`
- `handleSave`
- current-season-only editing copy in modal body
- room-exception disabled-state logic

---

## Final Conclusion

The manual edit layer is usable and fairly honest, but Step 5 lands at **RISK**.

The main reason is:

**the exception editor is reasonably aligned, but the dead-money editor achieves safety through a flattened full-replacement model that can lose canonical structure on save.**
