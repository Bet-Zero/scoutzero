# STEP 1 — ACTION BREAKDOWN

## Cap Totals Source of Truth

---

## CS-1A — Align Two-Way Cap Treatment Between Row Display and Canonical Totals

### Problem

The current-year Cap Sheet row display explicitly treats two-way contracts as zero cap hit, but `computeTeamCapTotals(...)` does not appear to exclude two-way salaries from `playersTotal`.

### Why It Matters

- The Cap Sheet can present one truth at the row level and another truth in the totals layer
- This undermines the whole “single source of truth” claim
- Even if current data usually stores two-way rows as zero, the code itself does not guarantee that consistency

### Goal

Make two-way contract treatment fully consistent between:

- current-year row display logic
- canonical totals math

### Success Criteria

- Two-ways are handled identically in row display and canonical totals
- There is no path where row display shows zero cap hit while totals still count two-way salary
- The canonical totals engine remains the real source of truth for this rule

---

## CS-1B — Clarify Canonical Ownership of Included vs Excluded Cap Categories

### Problem

`computeTeamCapTotals(...)` is the main totals engine, but the exact ownership boundary between:

- included totals categories
- adjacent cap-rule surfaces

is still implicit rather than fully explicit.

### Why It Matters

- Future contributors could incorrectly push exception/TPE/hard-cap display logic into the totals engine
- Or they could duplicate totals logic in those other surfaces
- The Cap Sheet needs a clear “this function owns X, not Y” boundary

### Goal

Make the canonical totals boundary explicit and durable.

### Success Criteria

- It is obvious what `computeTeamCapTotals(...)` includes
- It is obvious what it does not own
- Adjacent surfaces do not blur that boundary

---

## CS-1C — Reduce Internal Legacy Compatibility Drift Risk Inside the Canonical Totals Engine

### Problem

The canonical totals engine still carries multiple dead-money compatibility branches:

- `deadCap`
- `waivedContracts`
- `stretchHistory`
- flat `deadMoney`

### Why It Matters

- The function is still the canonical owner, but internal compatibility handling increases drift and maintenance risk
- Legacy support inside the totals engine can make it harder to reason about what the live canonical input contract really is
- This kind of compatibility complexity can quietly preserve outdated assumptions

### Goal

Tighten and clarify the canonical totals engine so legacy support does not weaken source-of-truth cleanliness.

### Success Criteria

- Legacy branches are clearly bounded, normalized, or reduced
- The live canonical input shape is easier to identify
- The totals engine is easier to reason about without hidden compatibility ambiguity

---

## CS-1D — Identify and Fence Parallel Cap-Math Surfaces That Could Drift from Cap Sheet Totals

### Problem

The broader Architect system still contains at least one parallel cap-math surface outside the main Cap Sheet totals engine, especially in validation-related paths.

### Why It Matters

- Even if the Cap Sheet display is mostly consolidated, parallel cap-math surfaces can still drift over time
- Future work could accidentally treat those parallel calculations as interchangeable with canonical Cap Sheet totals
- This weakens long-term source-of-truth discipline

### Goal

Identify which parallel cap-math surfaces should remain separate, and which need fencing or clearer ownership boundaries so they do not become silent alternate totals systems.

### Success Criteria

- Parallel cap-math surfaces are identified and classified
- It is clear which are valid separate systems versus drift-risk alternates
- The Cap Sheet totals engine remains the obvious canonical owner for Cap Sheet totals

---

## Step 1 Summary

This step focuses on:

- fully aligning two-way cap treatment across display and totals
- clarifying the ownership boundary of the canonical totals engine
- reducing internal legacy compatibility risk inside the totals engine
- identifying and fencing parallel cap-math surfaces that could drift from Cap Sheet totals

This is a **source-of-truth and totals-cleanliness step**, not a broad Cap Sheet rewrite.

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---
