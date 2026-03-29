# STEP 1 — Cap Totals Source of Truth

## Scope

Cap Sheet — Step 1: Cap Totals Source of Truth

**Date:** 2026-03-28  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether the Cap Sheet has a real single source of truth for team cap totals, and identify any duplicate, legacy, or drift-risk totals paths.

Main questions:

- whether `computeTeamCapTotals(...)` is truly the canonical totals engine
- what the canonical totals engine includes and excludes
- whether current-year and multi-year Cap Sheet surfaces still compute totals independently
- whether the totals math appears complete
- whether any alternate or legacy totals paths still exist

---

## Executive Verdict

**RISK**

`computeTeamCapTotals(...)` is mostly the real single source of truth for Cap Sheet totals, and the primary Cap Sheet display surfaces are wired to it correctly.

However, this is not a full PASS yet because there is at least one meaningful internal drift risk inside the canonical totals model itself:

- the current-year Cap Sheet row display explicitly treats two-way contracts as zero cap hit
- the canonical totals function does not appear to exclude two-way salaries from `playersTotal`

That means the source-of-truth architecture is largely in place, but not fully airtight yet.

---

## Exact Cap-Totals Source-of-Truth Map

### 1. Current-Year Cap Sheet Surface

The Cap Sheet tab routes through `CapSheetSection`, which renders `CapSheet` and passes in the current team cap sheet plus mutation handlers.

Inside `CapSheet.tsx`, totals are computed once with `computeTeamCapTotals(...)` inside `useMemo`, then reused across the full current-year surface.

That `totals` object drives:

- `CapSummaryTiles`
- the cap breakdown rows
- the total cap hit footer
- the cap-space percentage denominator

This is the clearest current-year SSOT surface.

---

### 2. Cap Summary Tile Surface

`CapSummaryTiles.tsx` does not compute totals independently.

It receives `totals` from `CapSheet` and uses that object for:

- total cap allocations
- cap space
- luxury tax space
- first apron space
- second apron space

This is clean source-of-truth consumption.

---

### 3. Multi-Year Full Cap Table Surface

`CapSheetFull.tsx` computes totals for each displayed year by calling `computeTeamCapTotals(...)` inside a memoized loop.

Its “Total Cap” row comes from `result.totalCapAllocations` for each year.

This means the multi-year total row is also grounded in the same canonical totals engine rather than maintaining its own separate total formula.

---

### 4. Cap Sheet–Adjacent Exception Eligibility Surface

`ManageExceptionsModal.tsx` uses `canUseRoomException(...)`, which is exported from the same `capTotals` module as `computeTeamCapTotals(...)`.

This means at least one exception-eligibility decision is intentionally tied back to the same totals engine.

---

### 5. Mutation / Audit Totals Surface

`useArchitectActions.ts` uses `computeTeamCapTotals(...)` when building before/after totals for cap-audit evaluation.

This means the totals engine is not only a display helper. It is also part of the mutation-time cap-state audit path.

---

## What the Canonical Totals Function Includes

`computeTeamCapTotals(...)` currently includes the following:

### Included

#### Player Salaries

Calculated through `computePlayersTotal(...)`, which sums `getContractYearSlice(player, year)` salary/capHit values across players.

#### Cap Holds

Calculated through `getActiveUnsignedCapHoldsTotalByEndYear(...)`.

#### Dead Money

Calculated through `computeDeadMoneyForYear(...)`, which supports:

- canonical `deadCap`
- legacy `waivedContracts`
- legacy `stretchHistory`
- legacy flat `deadMoney`

#### Incomplete Roster Charges

Calculated using:

- standard roster count
- minimum roster threshold
- rookie-min charge per missing slot

#### Cap Thresholds

Loaded through `getCapRulesForYear(...)`, including:

- salary cap
- luxury tax
- first apron
- second apron

#### Threshold Deltas

Calculated for:

- vsCap
- vsLuxuryTax
- vsFirstApron
- vsSecondApron

These drive space/overage displays.

---

## What the Canonical Totals Function Excludes

The totals engine does **not** directly include:

- exception usage state
- TPE display state
- hard-cap trigger reason text
- action-specific contract validation logic

Those live in adjacent systems, which is acceptable as long as totals ownership remains clear.

---

## Duplicate / Legacy / Alternate Totals Paths

### Clean Findings

The main Cap Sheet display surfaces do not appear to maintain separate final-totals math.

Specifically:

- `CapSummaryTiles.tsx` consumes totals from parent
- `CapSheetFull.tsx` uses `computeTeamCapTotals(...)` for yearly totals
- `CapSheet.tsx` shows evidence of intentionally removing local totals math in favor of the canonical `totals` object

So the main display architecture is mostly consolidated.

---

### Legacy Compatibility Still Present Inside the Canonical Engine

`computeTeamCapTotals(...)` still contains compatibility branches for multiple dead-money representations:

- `deadCap`
- `waivedContracts`
- `stretchHistory`
- flat `deadMoney`

This is not a second public totals engine, but it is still internal compatibility complexity inside the canonical engine.

That creates some cleanliness and future-maintenance risk even though ownership remains centralized.

---

### Parallel Cap-Math Surface Outside Main Cap Sheet Totals

`useCapValidation.ts` still performs cap-related calculations using `calculateTeamCapHit(...)` and `getCapSettings(...)` rather than `computeTeamCapTotals(...)`.

This is not automatically a Cap Sheet display bug, but it is a separate cap-math surface elsewhere in Architect and should be treated as future review material.

---

## Main Drift-Risk Finding

### Two-Way Cap Treatment May Be Inconsistent

This is the most important issue found in Step 1.

#### Current-Year Row Display Behavior

`CapSheet.tsx` explicitly treats two-way contracts as zero cap hit in its row-level `getCapHit(...)` helper.

#### Canonical Totals Behavior

`computeTeamCapTotals.ts` does not appear to exclude two-way players from `computePlayersTotal(...)`.

It does exclude two-ways when counting standard roster size for incomplete roster charges, but not when summing `playersTotal`.

#### Why This Matters

If two-way players ever carry non-zero salary/capHit values in contract-year slices, then:

- row display logic will show them as non-cap-counting
- canonical totals may still include them in total player salary

That is a real SSOT cleanliness risk.

This may be harmless if all two-way rows always store zero cap hit in practice, but the code itself does not guarantee that consistency.

---

## PASS / RISK / FAIL

### Result: RISK

### Why This Is Not FAIL

- there is a real canonical totals engine
- the main current-year Cap Sheet surface uses it
- summary tiles use it
- full cap table total rows use it
- mutation/audit surfaces also reuse it

This is meaningful consolidation, not fake SSOT language.

### Why This Is Not PASS

- two-way cap treatment appears potentially inconsistent between display and canonical totals math
- the canonical totals engine still contains legacy dead-money compatibility complexity
- broader Architect still has at least one parallel cap-math path outside the Cap Sheet totals engine

---

## Final Conclusion

The Cap Sheet does appear to have a real main totals engine, and the core display surfaces are mostly wired to it correctly.

However, the totals-source-of-truth story is not fully clean yet.

The main unresolved concern is whether two-way contracts are treated consistently between:

- row-level Cap Sheet display logic
- canonical totals math

So the correct Step 1 conclusion is:

**Mostly consolidated, but not yet clean enough to declare fully trustworthy single-source-of-truth totals without follow-up work.**

---

# STEP 2 — Cap Sheet Display Truth

## Scope

Cap Sheet — Step 2: Cap Sheet Display Truth

**Date:** 2026-03-28  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether the current-year Cap Sheet UI accurately reflects canonical cap truth.

Main questions:

- whether the current-year Cap Sheet UI is using canonical totals consistently
- whether summary tiles, player rows, cap holds, dead money, incomplete charges, and total cap hit all align
- whether any displayed values are computed separately from the canonical totals source
- whether the current-year Cap Sheet could show misleading or partial truth
- whether the display layer is structurally clean or still has drift risk

---

## Executive Verdict

**RISK**

The current-year Cap Sheet is mostly wired to canonical truth correctly, but it is not clean enough for a PASS yet.

The main totals surfaces are strong:

- `CapSheet.tsx` computes canonical totals once
- `CapSummaryTiles.tsx` consumes those totals
- the lower breakdown rows and total cap hit footer also use the same canonical totals object

However, the row display layer still contains at least one meaningful local-display rule that can drift from canonical totals:

- row-level `Cap Hit` display applies veteran-min cap-hit logic locally through `getCapHit(...)`
- canonical `playersTotal` in `computeTeamCapTotals(...)` still sums contract-year `capHit` / `salary` directly

That means the screen is largely coherent, but not yet fully guaranteed to be row-to-total airtight in every data shape.

---

## Current-Year Cap Sheet UI Truth Map

### 1. Section Entrypoint

`CapSheetSection.tsx` is the current-year display entrypoint.

It renders:

- `CapSheet`
- `ExceptionTracker`

This means the main cap-allocation display truth lives in `CapSheet`, while exception / TPE / hard-cap presentation lives in a separate adjacent surface.

---

### 2. Main Current-Year Cap Sheet Surface

Inside `CapSheet.tsx`, the file computes `canonicalTotals` once with `computeTeamCapTotals(...)` inside `useMemo`.

That canonical totals object is then used for:

- `CapSummaryTiles`
- the cap breakdown rows
- the total cap hit footer
- the denominator for cap-percentage display

This is the main canonical display surface for current-year cap allocations.

---

### 3. Summary Strip Surface

`CapSummaryTiles.tsx` does not recompute totals independently.

It consumes `canonicalTotals` from `CapSheet` and derives:

- total cap allocations
- cap space
- luxury tax space
- first apron space
- second apron space

from the canonical totals fields and deltas.

This is clean consumer behavior rather than parallel totals ownership.

---

### 4. Cap Holds Surface

`CapSheet.tsx` renders the cap-holds detail list using `getActiveUnsignedCapHoldsByEndYear(...)`.

This is a sibling utility path to the canonical totals engine, which uses `getActiveUnsignedCapHoldsTotalByEndYear(...)` inside `computeTeamCapTotals(...)`.

So the cap-holds detail list is not literally reusing the precomputed total field, but it is still tied to the same underlying cap-holds utility family.

---

### 5. Exception / TPE / Hard-Cap Surface

`ExceptionTracker.tsx` is intentionally separate from canonical totals ownership.

It explicitly says it:

- owns exception, TPE, and hard-cap presentation
- does **not** compute or redefine canonical cap totals

This means the Cap Sheet tab includes multiple cap-related surfaces, but their ownership boundary is intentionally separated rather than silently duplicated.

---

## Alignment Analysis Between Displayed Values and Canonical Totals

### Summary Tiles

The summary strip is aligned with canonical truth.

`CapSummaryTiles.tsx` destructures canonical totals directly and derives display-space values from canonical deltas rather than recomputing total allocations locally.

This is clean.

---

### Lower Breakdown Rows and Footer

The lower Cap Sheet breakdown is aligned with canonical truth.

`CapSheet.tsx` uses `canonicalTotals` directly for:

- Player Salaries
- Dead Money
- Cap Holds
- Incomplete Roster Charge
- Total Cap Hit

So the aggregate display layer is properly grounded in the canonical totals engine.

---

### Cap Holds Detail List

The cap-holds detail list appears reasonably aligned with canonical truth, but through a sibling utility path rather than the exact same precomputed field.

This is acceptable as long as both utilities remain behaviorally aligned.

No obvious independent total-row calculation is being maintained here.

---

### Player Row Display

This is the main remaining risk surface.

Each player row computes:

- `salary` from `getContractYearSlice(...)`
- `capHit` from local `getCapHit(...)`

The local `getCapHit(...)` helper applies row-level rules:

- two-way contracts return zero
- veteran minimum players with 3+ years can get `getMinimumCapHit(...)`

That means row-level displayed cap hit is not just “whatever canonical totals used.”

By contrast, canonical `playersTotal` in `computeTeamCapTotals.ts` uses `computePlayersTotal(...)`, which:

- excludes two-ways
- then sums season slice `capHit` or `salary` directly

So the screen still contains a row-level local cap-hit rule surface that is not obviously shared with canonical totals math.

This is the main reason the step stays at RISK.

---

## Any Misleading, Duplicated, or Partial Display Surfaces

### Not Broadly Misleading

The current-year Cap Sheet is not broadly misleading.

The major aggregate totals are clearly anchored to canonical totals.

There is no obvious second aggregate totals system hidden inside the current-year display layer.

---

### Somewhat Partial by Layout

The table only shows players who have a contract slice for the selected year.

But total cap allocations also include:

- dead money
- cap holds
- incomplete roster charges

Those live below the player table in the breakdown section.

So a user who only scans the player rows does **not** see the entire composition of total cap hit without also reading the lower breakdown area.

This is more of a presentation limitation than a source-of-truth bug.

---

### Remaining Row-to-Total Drift Seam

The real remaining drift seam is narrower:

- row-level `Cap Hit` uses local display math
- aggregate `playersTotal` uses canonical totals math

Specifically, veteran-min cap-hit handling is still a local display rule in `CapSheet.tsx` rather than an obviously shared canonical rule.

That means row display and aggregate totals could diverge in certain data conditions.

---

## PASS / RISK / FAIL

### Result: RISK

### Why This Is Not FAIL

- `CapSheet.tsx` computes canonical totals once and reuses them
- `CapSummaryTiles.tsx` consumes canonical totals
- the lower breakdown rows use canonical totals
- the footer total uses canonical totals
- `ExceptionTracker.tsx` explicitly fences itself away from canonical totals ownership

So the current-year Cap Sheet is mostly grounded in one real truth source.

---

### Why This Is Not PASS

- row-level `Cap Hit` still contains local display logic not obviously shared with canonical totals
- veteran-min cap-hit treatment is the clearest remaining row-to-total drift seam
- the player table itself shows only part of total cap allocations, with other categories living in a lower breakdown section

So the screen is mostly coherent, but not yet fully display-truth-clean.

---

## Final Conclusion

The current-year Cap Sheet display is mostly truthful and mostly clean.

The important aggregate numbers are grounded in the canonical totals engine.

However, Step 2 remains **RISK** because the row-display layer is not yet fully guaranteed to use the exact same rule set as canonical aggregate totals, especially around veteran-min cap-hit treatment.

So the correct conclusion is:

**Current-year Cap Sheet display truth is mostly aligned, but still has a meaningful row-to-total drift seam that should be tightened before this surface can be considered fully clean.**

---
