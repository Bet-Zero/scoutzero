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
