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

# STEP 2 — ACTION BREAKDOWN

## Cap Sheet Display Truth

---

## CS-2A — Align Row-Level Cap Hit Display with Canonical Player Salary Math

### Problem

The current-year Cap Sheet row display still applies local `Cap Hit` rules in `CapSheet.tsx`, including veteran-min treatment, while canonical aggregate player salary totals come from `computeTeamCapTotals(...)`.

### Why It Matters

- The screen can show one truth at the row level and another truth in aggregate totals
- Even if most current data happens to line up, the code still preserves a row-to-total drift seam
- This weakens trust in the current-year Cap Sheet as a fully coherent display surface

### Goal

Make row-level `Cap Hit` display and canonical aggregate player salary truth use clearly aligned rules.

### Success Criteria

- Row-level cap-hit display no longer depends on local-only math that can diverge from canonical totals
- Veteran-min and other cap-hit rules are either centralized or clearly shared
- The player table and aggregate player salary truth cannot silently disagree on cap-counting logic

---

## CS-2B — Clarify Which Current-Year Display Elements Are Canonical Totals Consumers vs Adjacent Detail Views

### Problem

The current-year Cap Sheet mixes:

- canonical totals consumers
- adjacent detail views
- separate presentation sections

without making that display structure fully explicit.

### Why It Matters

- Future contributors could mistake detail views for alternate truth surfaces
- UI layers can quietly drift when some values are canonical totals and others are parallel detail renderings
- The display surface should make it obvious what is a totals-driven summary versus what is a supporting breakdown/detail list

### Goal

Make the current-year display hierarchy clearer so a contributor can tell which sections are:

- direct canonical totals consumers
- supporting detail views
- adjacent presentation surfaces

### Success Criteria

- The current-year Cap Sheet reads as one coherent display system
- Canonical totals consumers are clearly identifiable
- Detail surfaces do not read like shadow owners of totals truth

---

## CS-2C — Reduce Partial-Truth Risk in the Current-Year Cap Sheet Layout

### Problem

The player table shows only player contract rows, while total cap allocations also include:

- dead money
- cap holds
- incomplete roster charges

Those additional categories live lower on the screen in the breakdown section.

### Why It Matters

- A user scanning only the table can walk away with an incomplete understanding of the real total cap hit
- The screen is technically truthful, but still risks being only partially legible as a full cap-allocation surface
- Layout clarity matters when the goal is trustworthy display truth

### Goal

Tighten the current-year Cap Sheet so the relationship between:

- player rows
- breakdown categories
- total cap hit

is more immediately understandable.

### Success Criteria

- The user can quickly understand that total cap hit is broader than just the visible player rows
- The layout more clearly signals how lower breakdown categories contribute to the total
- Partial-truth risk from the visual structure is reduced

---

## CS-2D — Guard the Current-Year Display Against Future Local Recalculation Drift

### Problem

The current-year display is mostly grounded in canonical totals, but local display helpers and per-row rendering logic still create opportunities for future drift.

### Why It Matters

- Even a mostly clean display layer can regress if future changes reintroduce local calculations
- Row display logic, summary tiles, and breakdown sections need guardrails to stay aligned
- Without focused protection, the display could slowly drift back toward mixed ownership

### Goal

Add or strengthen focused guardrails so the current-year Cap Sheet remains a canonical-totals-driven display surface.

### Success Criteria

- Future local recalculation drift is easier to detect
- Summary, breakdown, and row display relationships are protected by focused tests/guardrails
- The current-year Cap Sheet stays structurally clean over time

---

## Step 2 Summary

This step focuses on:

- aligning row-level display rules with canonical totals truth
- clarifying which current-year UI sections are totals consumers versus detail views
- reducing the layout’s partial-truth risk
- guarding the display layer against future local recalculation drift

This is a **display-truth and UI-alignment step**, not a broad Cap Sheet rewrite.

---

## Status

- Substeps defined
- Ready for bootstrap + execution
