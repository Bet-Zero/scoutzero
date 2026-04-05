# MULTI-YEAR CAP TABLE — STEP 3 REVIEW RECORD

## Scope

Multi-Year Cap Table Truth Pass — Step 3: Contract-Year Slicing, FutureContract Integration, and Player-Year Cap Hit Truth

**Date:** 2026-04-05  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the player-year contract slicing layer to determine whether contract rows, future contracts, extension seasons, and cap-hit logic stay truthful across multiple years.

Main questions:

- whether contract-year slicing has one coherent ownership story
- whether `futureContract` integration is structurally clean and truthful
- whether extension-season precedence and year merging are correct
- whether cap hit vs base salary behavior is correct across multiple years
- whether years-remaining and contract display helpers align with the same year model
- whether any future-year player-money path can silently drift from canonical totals expectations

---

## Executive Verdict

**RISK**

`contractUtils.ts` is clearly the owner of the player-year money seam, and the overall model is coherent. But the seam is not yet clean enough for PASS.

The strongest clean part:

- one file really does own the core year-slicing and cap-hit logic
- `computeTeamCapTotals.ts` consumes player-year cap hits through that seam rather than inventing its own contract-year math
- the contract-year and cap-hit model is therefore structurally aligned with the canonical totals engine

The main risk:

- `futureContract` rows can overwrite primary-contract rows for the same year purely because they are marked extension/future rows
- years-remaining fallback logic can still drop from row-based truth back to legacy/free-agency-year heuristics
- minimum-contract cap-hit logic is still hardcoded enough that it reads more like a compatibility rule than a year-aware cap-rules consumer

The seam is good and mostly trustworthy, but still not fully clean.

---

## Contract-Year Slicing / FutureContract / Player-Year Cap-Hit Map

### 1. Core owner

`contractUtils.ts` is the real owner of the contract-year seam.

It normalizes contract rows, merges contract sources, picks one row per year, derives years remaining, and computes cap-hit-adjusted year slices for the cap sheet.

That ownership is clear.

### 2. Merge model

The merge pipeline is:

- normalize `player.contract.salariesByYear`
- normalize optional `primaryContract.salariesByYear`
- normalize `player.futureContract.salariesByYear`
- combine them into one year-keyed map
- for each year, prefer the extension/future row over a non-extension row when both exist

That is a clean model structurally, but it is also the main risk seam.

### 3. Slice model

`getContractYearSlice(...)` takes an end year and returns the selected row for that year from the merged display stream, plus:

- `isExtensionSeason`
- `source: 'extension' | 'contract'`

That matches the selected/end-year model used by the totals engine.

### 4. Cap-hit model

`getPlayerCapSheetAmountsForYear(...)` starts from the selected contract slice, then adjusts cap hit for:

- two-ways → cap hit becomes `0`
- minimum contracts with 3+ years of service → cap hit becomes `getMinimumCapHit(...)`
- otherwise cap hit stays at slice cap hit / salary

Then `getPlayerCapHitForYear(...)` just returns that adjusted cap hit.

### 5. Downstream totals usage

`computeTeamCapTotals.ts` uses `getPlayerCapHitForYear(...)` for player totals, so the canonical totals engine is downstream of this seam rather than competing with it.

That is a strong structural positive.

---

## Merge / Precedence / Cap-Hit / Years-Remaining Analysis

### Contract-year slicing has one coherent ownership story

This is the biggest positive.

There are not multiple files trying to own:

- contract-year merge logic
- extension precedence
- cap-hit adjustment
- years-remaining display logic

That ownership is concentrated in `contractUtils.ts`.

### `futureContract` integration is structurally clean, but not fully low-risk

The structure is understandable:

- current contract rows come first
- future contract rows are marked `isExtension`
- per-year dedupe chooses the extension/future row over the non-extension row when both exist

That is clean as a model.

The risk is that this precedence is binary and implicit:

- if a future row exists for a year, it wins
- there is no stronger rule surface here for ambiguous overlap cases beyond “extension beats non-extension”

That may be correct for the current data model, but it is still a soft spot.

### Extension-season precedence and year merging are probably correct, but thinly justified

The logic is simple and probably intentional:

- same-year conflict
- extension row wins over base row

The issue is not obvious wrong math. The issue is that the rule is encoded as a very small precedence heuristic, not as a more explicit contract model explaining overlap semantics.

That is enough for RISK, not FAIL.

### Cap hit vs base salary behavior is mostly coherent

This part is reasonably solid.

The helper clearly separates:

- base salary
- cap hit
- cap-hit adjustment flag

That is good.

Two-way handling is very clear:

- cap hit becomes `0`

Minimum-contract handling is also explicit, but this is where the seam gets softer:

- if `player.isMinimum && yearsOfService >= 3`, cap hit uses `getMinimumCapHit(...)`
- and `getMinimumCapHit(...)` is still hardcoded around one veteran-minimum reimbursement rule rather than tied into the year-specific cap-rules profile

So the model is coherent, but not as year-aware as the rest of the multi-year system.

### Years-remaining and contract display helpers mostly align with the same year model

This part is better than average.

`getYearsRemainingDisplay(...)` first uses merged row truth:

- count rows where `entry.year >= currentYear`

Only if that fails does it fall back to:

- legacy `yearsRemaining`
- free-agency-year math from contract/bio fields

That is a reasonable ordering.

The risk is that those fallback paths are still looser and can drift from row-based truth if the row data is incomplete but the legacy metadata is stale.

### Future-year player-money truth is aligned with canonical totals expectations

This is a real positive.

`computeTeamCapTotals.ts` gets player totals by calling `getPlayerCapHitForYear(...)`, so the totals engine is downstream of this seam and uses the same end-year slice model.

That reduces the risk of silent disagreement between player-year display logic and totals logic.

---

## Any Misleading, Duplicated, or Weakly Grounded Player-Year Money Paths

### 1. Future-contract precedence is compact, but under-explained

This is the biggest Step 3 risk.

The overlap rule is effectively:

- extension/future row beats non-extension row for the same year

That may be correct, but it is still a thin rule for a high-impact seam.

### 2. Years-remaining still has legacy fallback escape hatches

The helper does the right thing by preferring row-based truth first.

But if rows do not answer the question, it falls back to:

- `yearsRemaining`
- free-agency-year arithmetic from contract/bio fields

That is a compatibility seam and keeps this out of PASS.

### 3. Minimum-contract cap-hit logic is not fully year-aware

The cap-hit adjustment is explicit, but it still depends on:

- `player.isMinimum`
- years of service
- a hardcoded minimum cap-hit helper

It does not read as fully integrated with the newer yearly rules gateway the way Step 2’s totals engine does.

### 4. Primary-contract override support exists, but broadens the seam

`getContractYearsForDisplay(...)` can also take an optional `primaryContract` parameter in addition to `player.contract` and `futureContract`.

That is useful, but it also means there are multiple possible “current contract” inputs entering the merge seam.

Not broken, just broader than ideal.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- ownership is concentrated in one file
- the merge model is coherent
- cap-hit adjustments are explicit
- years-remaining prefers row-based truth before legacy fallbacks
- canonical totals consume this seam instead of competing with it

### Why this is not PASS

- futureContract overlap precedence is still a thin heuristic
- years-remaining still falls back to legacy/free-agency-year metadata
- minimum-contract cap-hit logic is explicit but not fully year-aware
- the seam is trustworthy, but not yet fully clean or fully self-explaining

---

## Files Reviewed

- `src/features/architect/utils/contractUtils.ts`
- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`

---

## Exact File + Function Anchors

### `src/features/architect/utils/contractUtils.ts`

- `normalizeContractYears(...)`
- `getContractYearsForDisplay(...)`
- `getYearsRemainingDisplay(...)`
- `getContractYearSlice(...)`
- `getPlayerCapSheetAmountsForYear(...)`
- `getPlayerCapHitForYear(...)`
- `getMinimumCapHit(...)`
- `isTwoWayContract(...)`

### `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`

- `computePlayersTotal(...)`
- `computeTeamCapTotals(...)`
- downstream use of `getPlayerCapHitForYear(...)` for canonical totals

---

## Final Conclusion

The contract-year seam is real, centralized, and mostly trustworthy, but Step 3 lands at **RISK**.

The main reason is:

**the ownership is good, but future-contract overlap precedence, legacy years-remaining fallback, and minimum-contract cap-hit handling still leave the player-year money seam a little softer than the totals SSOT around it.**
