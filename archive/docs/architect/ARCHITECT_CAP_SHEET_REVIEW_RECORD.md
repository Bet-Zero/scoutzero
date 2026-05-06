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

# STEP 3 — Full Cap Table / Multi-Year Truth

## Scope

Cap Sheet — Step 3: Full Cap Table / Multi-Year Truth

**Date:** 2026-03-28  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether the Full Cap Table / multi-year cap view is accurate and structurally aligned with the Cap Sheet system.

Main questions:

- whether the multi-year view uses canonical totals correctly for each year
- whether future-year contract rows, option years, free-agency years, and cap holds are represented correctly
- whether total rows in the full cap table align with canonical yearly totals
- whether the multi-year view still contains independent logic that could drift from the current-year Cap Sheet
- whether this layer is structurally trustworthy or still has future-year drift risk

---

## Executive Verdict

**RISK**

The multi-year Cap Table has a strong canonical total-row foundation, but the per-player future-year display still contains enough custom logic that it is not clean enough for a PASS yet.

The strongest part of the screen is the yearly total row:

- `CapSheetFull.tsx` computes `yearTotals` by calling `computeTeamCapTotals(...)` for each displayed year
- the final `Total Cap` row renders `result.totalCapAllocations` rather than a local salary-summing loop
- the existing multi-year SSOT guardrail file explicitly protects this total-row behavior, including dead money, cap holds, incomplete roster charges, and the separation between player-only math and canonical totals

However, the per-player future-year cells still render custom values from `getContractYearSlice(...)` using `salary ?? capHit`, rather than the shared cap-hit helper used by the current-year Cap Sheet and canonical totals.

In addition, the multi-year player list is anchored to **current-year** contract presence, which creates risk that future-only rows could be omitted from the table body even while future-year totals still include them.

So the correct conclusion is:

**The Full Cap Table has a trustworthy canonical totals backbone, but the custom multi-year row logic still creates future-year display drift risk.**

---

## Multi-Year Cap-Table Truth Map

### 1. Canonical Yearly Total Path

`CapSheetFull.tsx` builds `yearTotals` inside `useMemo` by looping over all displayed years and calling `computeTeamCapTotals(...)` for each year.

The final `Total Cap` row then renders `yearTotals[year]`, which comes from `result.totalCapAllocations`.

This is the strongest source-of-truth path in the entire multi-year surface.

---

### 2. Player-Row Future-Year Path

The player-row year cells do **not** use canonical totals.

For each player and year, the table:

- calls `getContractYearSlice(player, year)`
- derives `salaryValue = entry?.salary ?? entry?.capHit ?? 0`
- renders that value directly into the cell

That means the row body uses a custom contract-row display path rather than the canonical yearly cap-counting path used by `computeTeamCapTotals(...)`.

---

### 3. Future-Year Annotations / Action Surface

The multi-year table also contains custom logic for:

- player option years
- team option years
- restricted / unrestricted free-agency years
- extension-season highlighting
- extension-eligibility badges
- bird-rights / qualifying-offer decorations

These are legitimate display concerns, but they make the body of the table a highly custom future-year surface rather than a pure projection of canonical totals.

---

### 4. Cap Holds Surface

Cap holds are rendered in a separate multi-year table below the main player grid.

This cap-holds table is built from `teamCapSheet.capHolds`, filtered to unsigned holds, then plotted into future-year columns by season match.

Meanwhile, canonical yearly totals include cap holds through `computeTeamCapTotals(...)`.

So the final multi-year screen asks the user to reconcile:

- player rows
- a separate cap-holds table
- a canonical yearly total row

This is structurally valid, but still increases complexity and future drift risk.

---

## Canonical vs Custom Logic Breakdown

### Canonical / Trustworthy Surfaces

The following are clearly grounded in canonical truth:

- yearly `Total Cap` row
- inclusion of dead money in yearly totals
- inclusion of cap holds in yearly totals
- inclusion of incomplete roster charges in yearly totals
- separation between canonical totals and player-only helper math

This is not just a code-reading assumption — the existing guardrail suite explicitly checks these behaviors.

---

### Custom / Drift-Prone Surfaces

The following remain custom and therefore more drift-prone:

- row-cell salary rendering via `salary ?? capHit`
- current-year-based player inclusion filter
- future-year free-agency / option / extension labeling logic
- separate cap-holds table grouping and ordering logic
- row-body reliance on `isTwoWayContract(...)` for badges/styling rather than a shared future-year cap-hit helper

These surfaces are not necessarily wrong, but they are not yet as tightly tied to canonical future-year cap truth as the total row is.

---

## Future-Year Drift Risks / Duplicated Paths

### 1. Row-Value vs Total-Row Drift

This is the biggest risk found in Step 3.

The current-year Cap Sheet already fixed this problem by centralizing row-level cap-hit logic through a shared helper.

The multi-year table has **not** done the same thing.

Current multi-year row cells still render:

- `entry?.salary ?? entry?.capHit ?? 0`

rather than using the shared cap-hit helper used by canonical totals.

This means future-year row display can drift from the yearly canonical totals path in cases involving:

- veteran-min cap-hit treatment
- two-way treatment
- any future cap-hit-vs-salary distinction added later

So the yearly total row and the visible player row values are not yet guaranteed to tell the same future-year cap story.

---

### 2. Future-Only Player Omission Risk

The displayed player list is built from:

- players who have a contract slice in the **current year**

Specifically, players are filtered by `getContractYearSlice(p, currentYear)` before being included in `sortedPlayers`.

That means a player who has no current-year row but **does** have a future-year contract row could still affect future-year totals while being omitted from the visible table body.

This is a real future-year truth seam.

---

### 3. Separate Cap Holds Detail vs Total-Row Truth

The separate cap-holds table is not automatically a bug, but it does increase reconciliation burden:

- one canonical yearly total row
- one custom player-row table
- one separate cap-holds table

The yearly totals may be correct while the visible row/detail composition remains harder to verify or easier to drift.

---

### 4. Existing Guardrails Protect Totals More Than Row Semantics

The existing multi-year guardrail file is strong, but it is mainly protecting:

- total-row SSOT
- inclusion of dead money / cap holds / incomplete charges
- separation from player-only cap math

It does **not** appear to equally protect the future-year semantics of the visible player-row cells.

So the screen is well-protected where totals are concerned, but not yet equally protected where visible row semantics are concerned.

---

## PASS / RISK / FAIL

### Result: RISK

### Why This Is Not FAIL

- the yearly total row is genuinely canonical
- the old local salary-sum total path is gone
- meaningful guardrails already protect total-row SSOT behavior
- the canonical totals backbone is real, not cosmetic

---

### Why This Is Not PASS

- future-year player cells still use custom row rendering rather than shared canonical cap-hit logic
- current-year player filtering can hide future-only rows
- body rows and total rows are not yet fully guaranteed to tell the same future-year story
- existing tests protect totals better than they protect row semantics

---

## Final Conclusion

The Full Cap Table is currently **half-strong**:

- **strong** at the yearly total-row level
- **still risky** at the per-player future-year row level

So the correct Step 3 conclusion is:

**The Full Cap Table has a trustworthy canonical totals backbone, but the custom multi-year row logic still creates future-year display drift risk.**

---

# STEP 4 — Exceptions / TPE / Hard-Cap Display and Accounting

## Scope

Cap Sheet — Step 4: Exceptions / TPE / Hard-Cap Display and Accounting

**Date:** 2026-03-29  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether the Cap Sheet exception / TPE / hard-cap layer is displayed and accounted for correctly.

Main questions:

- whether MLE / TPMLE / BAE / Room exception display is based on correct underlying state
- whether TPE display is based on the right normalized source
- whether hard-cap status and hard-cap reasons are displayed correctly
- whether any of these surfaces are using stale, duplicate, or misleading logic
- whether exception / TPE / hard-cap ownership is clean or drift-prone

---

## Executive Verdict

**FAIL**

This layer contains one clean surface and two real problems:

- TPE display is mostly clean and based on the right normalized read helper
- exception display / accounting has a concrete state-key mismatch across UI surfaces
- hard-cap display bypasses the canonical hard-cap resolver and can show simplified or misleading reasons

So this is not merely a general drift-risk review result. There is at least one direct accounting mismatch in live code, plus a duplicated hard-cap status path.

The correct conclusion is:

**The exception / TPE / hard-cap layer is not clean enough to trust as-is. TPE normalization is solid, but exception defaults and hard-cap display ownership are currently split across stale / duplicate logic paths.**

---

## Exception / TPE / Hard-Cap Ownership and Display Map

### 1. Exception Presentation Surface

`ExceptionTracker.tsx` is the adjacent presentation surface for:

- MLE
- TPMLE
- BAE
- Room exception
- TPEs
- hard-cap state

It explicitly states that it owns exception / TPE / hard-cap presentation for the Cap Sheet surface, and that it does **not** compute or redefine canonical cap totals.

This is the correct architectural boundary.

Inside `ExceptionTracker.tsx`, exception cards are built from:

- `normalizeExceptionForTracker(...)`
- `getCapSettingsForYear(currentYear)`

The tracker reads canonical `teamCapSheet.exceptions[...]` first, falls back to legacy root keys where needed, and uses cap-settings defaults for display amounts.

So the exception tracker is intended to be the main read/display owner for exception cards.

---

### 2. TPE Read / Display Surface

TPE display is driven by:

- `getTeamTpeList(teamCapSheet)` from `normalizeTeamTpe.ts`
- `CompactTradeExceptionRow` in `ExceptionTracker.tsx`

This is the cleanest part of the layer.

`getTeamTpeList(...)`:

- prefers canonical `team.exceptions.tpe`
- falls back to legacy `team.tradeExceptions`
- normalizes UI field aliases through `normalizeTpeFields(...)`

That means downstream TPE consumers can read:

- `amount`
- `remaining`
- `expiresOn` / `expirationDate`
- `createdFrom` / `name`

without having to know which persisted schema the data originally came from.

This is a clean normalized read path.

---

### 3. Exception Editing Surface

`ManageExceptionsModal.tsx` is the manual exception edit / save surface.

It uses:

- `getCapSettingsForYear(currentYear)`
- `canUseRoomException(teamCapSheet, currentYear)`

The modal allows editing:

- MLE
- TPMLE
- BAE
- Room exception

and saves canonical exception entries under `teamCapSheet.exceptions[...]`.

This is the main exception-write / edit surface.

However, its default-amount logic does **not** match the normalized cap-settings keys used elsewhere.

This is one of the main failure findings in Step 4.

---

### 4. Canonical Hard-Cap Detection Surface

The repo already contains a canonical shared hard-cap resolver in:

- `getHardCapStatus(...)`
- `resolveHardCapCeiling(...)`

inside `hardCapStatus.ts`.

That resolver owns:

- structured hard-cap flag detection
- legacy/ambiguous hard-cap flag interpretation
- hard-cap source labeling
- ceiling selection and fail-closed fallback behavior

So the project does already have a real canonical hard-cap status owner.

However, the Cap Sheet exception tracker UI does **not** consume that resolver.

This is the second major failure finding in Step 4.

---

## Detailed Findings

### A. MLE / TPMLE / BAE / Room Exception Display

#### What is correct

`ExceptionTracker.tsx` reads exception state through `normalizeExceptionForTracker(...)`.

That helper:

- prefers canonical `teamCapSheet.exceptions[canonicalKey]`
- falls back to legacy top-level keys
- computes `remainingAmount`
- uses `getCapSettingsForYear(...)` default totals when needed

For the tracker surface itself, that is a reasonable read/display strategy.

The defaults used by the tracker come from the normalized cap-settings contract:

- `fullMLE`
- `taxpayerMLE`
- `bae`
- `roomMLE` / `room`

So the tracker exception cards are at least aligned to the modern cap-settings provider contract.

---

#### What is wrong

`ManageExceptionsModal.tsx` uses a different default-amount contract.

Its `getDefaultTotalAmount(...)` reads:

- `nonTaxMLE` or `mle`
- `taxMLE` or `tpmle`
- `bae`
- `roomMLE` or `room`

But `getCapSettingsForYear(...)` returns normalized settings shaped as:

- `fullMLE`
- `taxpayerMLE`
- `bae`
- `roomMLE`

That means the modal’s default logic for:

- MLE
- TPMLE

can resolve to zero or stale values even while the tracker is using the correct normalized cap-settings defaults.

This is a real cross-surface accounting mismatch.

It means the display/edit layer is not using one clean shared exception-default contract.

---

#### Additional room-exception drift seam

`ManageExceptionsModal.tsx` uses `canUseRoomException(teamCapSheet, currentYear)` to determine eligibility and can disable the Room Exception UI when the team is not under the cap.

But `ExceptionTracker.tsx` does **not** appear to use that same eligibility path for display.

Instead, it simply renders Room exception remaining amount from exception state/defaults.

So the edit path and the display path are not using the same room-eligibility logic.

This is another smaller but real seam inside the exception layer.

---

### B. TPE Display

This is the strongest part of the Step 4 layer.

`getTeamTpeList(...)` in `normalizeTeamTpe.ts` cleanly handles:

- canonical `exceptions.tpe`
- legacy `tradeExceptions`
- field normalization for:
  - `amount` / `totalAmount`
  - `remaining` / `remainingAmount`
  - `expiresOn` / `expirationDate`
  - `createdFrom` / `name`

Then `ExceptionTracker.tsx` renders the compact TPE list from that normalized read helper.

This means TPE display is based on the correct normalized source.

The only remaining caution is that legacy fallback still exists, which means read-side compatibility complexity remains in the system.

But that looks like intentional backward-compatible read support rather than a hidden duplicate display owner.

So this surface is the closest thing to a PASS in Step 4.

---

### C. Hard-Cap Status and Reason Display

This is the other major failure finding.

#### Canonical hard-cap owner exists

`hardCapStatus.ts` already provides a real shared hard-cap detection path through:

- `getHardCapStatus(...)`
- `resolveHardCapCeiling(...)`

That code supports:

- structured `hardCapFirstApron.active`
- structured `hardCapSecondApron.active`
- `hardCapType`
- `hardCapLevel`
- `hardCapTriggered`
- legacy / ambiguous `hardCapped`
- source labeling
- fail-closed ceiling selection

So the repo already has a canonical shared hard-cap interpretation layer.

---

#### ExceptionTracker does not use it

`ExceptionTracker.tsx` does **not** call `getHardCapStatus(...)`.

Instead, it reconstructs hard-cap display locally by:

- reading `hardCapped`
- computing `usedNTPMLE`
- computing `usedBAE`
- computing `usedTPMLE`
- mutating displayed exception availability locally
- synthesizing a local `hardCapReason`
- passing `hardCapped || (usedNTPMLE || usedBAE ? 1 : 0)` into `HardCapCard`

This is a duplicate hard-cap logic path.

---

#### Why this matters

Because the UI hard-cap display can now diverge from canonical hard-cap truth.

Specifically, it can:

- ignore structured hard-cap reasons already present in canonical state
- collapse different hard-cap causes into simplified generic text
- bypass the canonical hard-cap source-labeling logic
- bypass the shared ceiling/fail-closed interpretation contract

So even though the repo already has a shared hard-cap status owner, the Cap Sheet tracker UI is not actually using it.

That is a real ownership failure, not just a stylistic issue.

---

## Stale, Duplicate, or Misleading Logic

### 1. Exception modal and tracker use different cap-settings contracts

This is the clearest concrete bug in Step 4.

- `ExceptionTracker.tsx` uses normalized cap-settings keys like `fullMLE` and `taxpayerMLE`
- `ManageExceptionsModal.tsx` still looks for older-style keys like `nonTaxMLE`, `mle`, `taxMLE`, and `tpmle`

This means different UI surfaces can derive different default exception totals from the same year settings.

That is stale / duplicate accounting logic.

---

### 2. Hard-cap display duplicates canonical hard-cap status detection

The repo already has `getHardCapStatus(...)` as the shared hard-cap resolver.

But `ExceptionTracker.tsx` reconstructs hard-cap display logic locally.

That is duplicate status detection and duplicate reason derivation.

This is one of the main reasons the step is FAIL.

---

### 3. Room-exception eligibility is split between edit path and display path

The modal uses `canUseRoomException(...)` for eligibility.

The tracker display does not appear to use that same eligibility path.

So Room exception can be edit-restricted in one surface while still being displayed through a different state/default path in another.

This is drift-prone display ownership.

---

### 4. TPE reads are compatibility-heavy but still structurally acceptable

TPE display still carries dual-source compatibility:

- canonical `exceptions.tpe`
- legacy `tradeExceptions`

That is a real complexity cost, but it is clearly centralized inside `normalizeTeamTpe.ts`.

So it is better classified as bounded compatibility debt than as an active ownership failure.

---

## PASS / RISK / FAIL

### Result: FAIL

### Why This Is Not PASS

- exception default accounting is not using one clean shared cap-settings contract across read/edit surfaces
- hard-cap display bypasses the canonical hard-cap resolver
- room-exception eligibility logic is split across surfaces

These are real correctness / ownership issues, not just theoretical drift concerns.

---

### Why This Is Not Only RISK

This is stronger than a generic “could drift later” result because one live mismatch already exists:

- the exception modal is using key names that do not match the normalized cap-settings provider contract

So the layer already contains at least one concrete accounting seam today.

That justifies FAIL.

---

## Final Conclusion

The exception / TPE / hard-cap layer is mixed:

- **TPE normalization and display are mostly solid**
- **exception accounting is not fully unified across surfaces**
- **hard-cap display ownership is duplicated and bypasses the canonical resolver**

So the correct Step 4 conclusion is:

**The exception / TPE / hard-cap layer is not clean enough to trust as-is. TPE normalization is solid, but exception defaults and hard-cap display ownership are currently split across stale / duplicate logic paths.**

---

# STEP 5 — Cap Sheet Mutation Paths, Save/Persist, and Final Validation

## Scope

Cap Sheet — Step 5: Cap Sheet Mutation Paths, Save/Persist, and Final Validation

**Date:** 2026-03-29  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether manual Cap Sheet edits follow the correct authoritative mutation path.

Main questions:

- the exact path for dead money and exceptions edits from UI → compute → validation → persistence
- whether local update, audit generation, final validation, and persistence are aligned
- whether the Cap Sheet mutation layer has one clear authoritative flow
- whether post-state validation is correctly protecting these mutations
- whether any alternate or weaker paths still exist

---

## Executive Verdict

**RISK**

For the two manual Cap Sheet edit flows in scope here — **dead money** and **exceptions** — the mutation path is actually strong and mostly well-disciplined.

Those two paths currently have:

- one UI entry path
- one centralized action-hook handler path
- one shared audited mutation helper
- post-state validation before local apply
- authoritative world mutation + final validation before persistence

So this is not a broken or chaotic mutation layer.

However, this step is not a PASS because the broader Cap Sheet mutation area still contains nearby **weaker local-only mutation paths** elsewhere in the same action hook. That means dead money and exceptions are on a strong audited path, but the wider Cap Sheet mutation story is still not fully single-flow clean.

So the correct conclusion is:

**Dead money and exceptions edits follow a real authoritative audited path, but the broader Cap Sheet mutation surface still contains nearby weaker local-only paths, so overall mutation truth is strong-but-not-fully-clean.**

---

## Exact Cap Sheet Mutation-Path Diagram

### 1. Dead Money Edit Path

The dead money flow starts in `ManageDeadMoneyModal.tsx`.

Inside the modal:

- the UI edits flattened rows
- `handleSave()` reconstructs canonical `deadCap`
- the modal calls `onSave(canonicalDeadCap)`

That means the modal is acting as a payload-building/edit surface, not as the mutation authority.

From there the path is:

- `ManageDeadMoneyModal.tsx`
- `CapSheet.tsx` → `onSave={(deadCap) => onSetDeadCap?.(deadCap)}`
- `CapSheetSection.tsx` → forwards `onSetDeadCap`
- `GMDashboard.tsx` → wires `onSetDeadCap={actions.handleSetDeadCap}`
- `useArchitectActions.ts` → `handleSetDeadCap(...)`
- `useArchitectActions.ts` → `applyCapAuditedTeamMutation(...)`

So for dead money, there is one clean UI → handler → audited helper chain.

---

### 2. Exception Edit Path

The exceptions flow is parallel.

Inside `ManageExceptionsModal.tsx`:

- the UI edits canonical exception entries
- `handleSave()` builds the canonical `exceptions` object
- the modal calls `onSave(exceptions)`

Then the path is:

- `ManageExceptionsModal.tsx`
- `CapSheet.tsx` → `onSave={(exceptions) => onSetExceptions?.(exceptions)}`
- `CapSheetSection.tsx` → forwards `onSetExceptions`
- `GMDashboard.tsx` → wires `onSetExceptions={actions.handleSetExceptions}`
- `useArchitectActions.ts` → `handleSetExceptions(...)`
- `useArchitectActions.ts` → `applyCapAuditedTeamMutation(...)`

So exceptions also converge into the same audited helper rather than taking a second custom save path.

---

## Source-of-Truth and Final-Validation Map

### 1. UI Surfaces Are Payload Builders, Not Mutation Owners

The modals are clearly edit/payload surfaces:

- `ManageDeadMoneyModal.tsx` reconstructs canonical `deadCap`
- `ManageExceptionsModal.tsx` reconstructs canonical `exceptions`

They do not own persistence, legality, or authoritative mutation sequencing.

That is correct.

---

### 2. Central Mutation Owner for These Flows

For the two manual Cap Sheet mutations in scope, the real local mutation owner is:

- `handleSetDeadCap(...)`
- `handleSetExceptions(...)`

inside `useArchitectActions.ts`, both of which flow through:

- `applyCapAuditedTeamMutation(...)`

This helper is the true convergence point for:

- before/after snapshot construction
- preview cap-audit event generation
- post-state validation
- local optimistic apply
- authoritative persistence handoff
- local rollback on persistence failure

This is the strongest architectural finding in Step 5.

---

### 3. Final Validation Owner

The final validation owner is:

- `validatePostStateCapLegality(...)` in `postStateCapValidator.ts`

That validator explicitly owns late-stage post-state legality and artifact checks.

Its coverage includes:

- totals sanity checks
- hard-cap recheck
- roster recheck
- contract-row validity
- dead-cap validity
- exception validity
- cap-hold validity

So dead money and exceptions are not just “saved and hoped for.” They are run through the shared post-state legality layer before they are allowed to persist as authoritative results.

---

### 4. World Persistence Owner

In world mode, `applyCapAuditedTeamMutation(...)` hands persistence to:

- `persistMutation(...)`
- which calls `applyWorldMutation(...)`

The cap-audit closure gate also explicitly pins that:

- `useArchitectActions.ts` must call `validatePostStateCapLegality(...)`
- `mutationPipeline.ts` must also call `validatePostStateCapLegality(...)`

So the design is not “preview validation only.” The authoritative mutation path is also expected to run through the same final-state validation family before commit.

This is a strong defense-in-depth pattern rather than a suspicious duplicate path.

---

## Whether Local Update, Audit Generation, Final Validation, and Persistence Are Aligned

### Result: Mostly Yes

For both `setDeadCap` and `setExceptions`, the same shared helper performs the following sequence:

1. clone the current team snapshot
2. compute the proposed next team snapshot with `computeNextTeam(...)`
3. generate a cap-audit evaluation through `buildCapAuditEvaluation(...)`
4. run `validatePostStateCapLegality(...)`
5. block invalid mutations before local apply
6. apply the proposed team state locally if valid
7. persist through `persistMutation(...)` in world mode
8. revert local state if persistence fails

That is a coherent mutation contract.

---

### Important Implementation Nuance

For these two flows, the local preview stage does **not** use `computeWorldMutation(...)`.

Instead, the helper computes the next team directly with simple field replacement:

- `deadCap`
- `exceptions`

This is acceptable here because:

- these are straightforward full-field mutation shapes
- the proposed after-state still goes through the shared post-state validator
- world-mode persistence still goes through `applyWorldMutation(...)`

So there is no obvious preview/persist mismatch for the dead-money and exceptions flows themselves.

---

## Whether the Cap Sheet Mutation Layer Has One Clear Authoritative Flow

### For Dead Money and Exceptions

Yes, mostly.

For these two edit surfaces, the flow is clear:

- modal
- Cap Sheet handoff
- section/dashboard wiring
- centralized handler
- `applyCapAuditedTeamMutation(...)`
- final validation
- persistence handoff

That is a real authoritative path.

---

### For the Broader Cap Sheet Mutation Area

Not fully.

The broader `useArchitectActions.ts` file still contains weaker local-only paths nearby, for example:

- `handleSaveContract(...)` explicitly updates local state only and acts as an editor/preview path
- `handleUpdateRoster(...)` directly updates local team state
- `handleResetCapSheet(...)` directly resets local team state

Those are not the dead money / exceptions modal flows, but they do matter for this step because they weaken the broader claim that the entire Cap Sheet mutation surface already converges on one audited authoritative flow.

That is the main reason this step stays at **RISK** instead of PASS.

---

## Whether Post-State Validation Is Correctly Protecting These Mutations

### Yes

The shared helper runs `buildCapAuditEvaluation(...)`, which invokes `validatePostStateCapLegality(...)` before the mutation is allowed to stand locally.

If validation fails:

- the mutation is blocked
- the error is reported
- no valid local state transition is committed

That is the correct control point for these mutations.

---

### And Yes Again in World Mode

The cap-audit closure gate explicitly pins validator invocation in both:

- `useArchitectActions.ts`
- `mutationPipeline.ts`

So there is clear evidence that the project intends these authoritative paths to run through the shared post-state validator contract both for preview/base-mode evaluation and for world-mutation persistence.

This is a meaningful strength.

---

## Any Preview / Persist / Path Mismatches or Alternate Paths

### 1. No Alternate Dead Money Save Path Found

For the current Cap Sheet dead money UI, the path appears singular:

- modal
- `CapSheet`
- `CapSheetSection`
- `GMDashboard`
- `useArchitectActions`
- `applyCapAuditedTeamMutation(...)`

No competing dead-money mutation path was found in the active current Cap Sheet surface.

---

### 2. No Alternate Exceptions Save Path Found

The same is true for exceptions.

The current Cap Sheet exception UI also appears to use one singular save path into the same audited helper.

---

### 3. Nearby Weaker Local-Only Paths Still Exist

Even though dead money and exceptions are cleanly routed, the action hook still contains weaker Cap Sheet-related mutation paths outside this exact flow.

That includes:

- local-only contract editor updates
- direct roster updates
- direct reset behavior

So the dead money / exceptions mutation truth is stronger than the overall Cap Sheet mutation landscape.

This is the main remaining structural risk.

---

## PASS / RISK / FAIL

### Result: RISK

### Why This Is Not FAIL

- dead money and exceptions both use one centralized handler path
- both flow through the same audited mutation helper
- both use post-state validation before apply
- both use authoritative world persistence handoff in world mode
- both support rollback when persistence fails

That is a strong mutation design for the actual flows reviewed here.

---

### Why This Is Not PASS

- the broader Cap Sheet mutation area still includes nearby local-only mutation paths
- not all Cap Sheet-related mutations converge on the same audited helper
- that weakens the broader “one authoritative Cap Sheet mutation flow” story even though the dead-money and exceptions paths themselves are strong

---

## Final Conclusion

For the two Cap Sheet edit flows in scope — **manual dead money** and **manual exceptions** — the mutation system is substantially better than average:

- the UI builds canonical payloads
- dashboard wiring is clean
- mutation ownership is centralized in `useArchitectActions.ts`
- `applyCapAuditedTeamMutation(...)` owns the preview audit + final validation + persistence handoff
- the shared post-state validator is a real late-stage protection layer

However, the broader Cap Sheet mutation area still contains other weaker local-only mutation paths nearby, which means the feature is not yet fully clean enough to claim one total authoritative mutation flow across the entire Cap Sheet surface.

So the correct Step 5 conclusion is:

**Dead money and exceptions edits follow a real authoritative audited path, but the broader Cap Sheet mutation surface still contains nearby weaker local-only paths, so overall mutation truth is strong-but-not-fully-clean.**

---

# STEP 6 — Contract-Action / Modal Integration with Cap Sheet

## Scope

Cap Sheet — Step 6: Contract-Action / Modal Integration with Cap Sheet

**Date:** 2026-03-29  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether Cap Sheet state stays aligned with contract-action flows driven by:

- Cap Sheet / Full Cap Table action clicks
- Edit Contract modal actions
- dashboard handler wiring
- contract-action validation logic
- cap-state mutation handlers

Main questions:

- how Cap Sheet and Full Cap Table actions feed into contract/modal flows
- whether `useCapValidation` and Cap Sheet mutation behavior are aligned
- whether option, renounce, waive/stretch, sign, extend, and related actions update Cap Sheet truth correctly
- whether the integration between UI actions and cap-state mutation paths is clean
- whether there are ownership or staging risks in this integration layer

---

## Executive Verdict

**RISK**

This layer is mostly working and is clearly better than a fragmented or ad-hoc integration setup.

Key strengths:

- `GMDashboard.tsx` acts as a centralized wiring hub
- Full Cap Table action clicks are routed through shared dashboard actions
- `EditContractModal.tsx` dispatches to explicit action callbacks instead of mutating Cap Sheet state directly
- most cap-affecting actions ultimately land in shared action-hook mutation paths
- sign-and-trade / offer-sheet flows are especially aligned because they use authoritative preflight callbacks before confirm

However, this step is not a PASS because the integration layer still contains a meaningful ownership split between:

- UI-layer action validation in `useCapValidation.ts`
- actual Cap Sheet mutation truth in `useArchitectActions.ts` and authoritative/audited mutation paths

That split is not hidden — it is partly declared in code — but it still means the modal can present a simpler or more advisory cap picture than the actual mutation path enforces.

So the correct conclusion is:

**Cap Sheet contract-action integration is mostly functional and mutation truth is usually routed through the right action layer, but the validation/ownership boundary is still split enough that this layer remains risky rather than fully clean.**

---

## Cap Sheet Contract-Action Integration Map

### 1. Dashboard Is the Integration Hub

`GMDashboard.tsx` is the main integration surface.

It combines:

- state from `useArchitectState`
- action handlers from `useArchitectActions`
- modal state from `useArchitectModals`
- rules-profile context from `usePlayerRulesProfiles`

It then wires those into:

- current-year Cap Sheet
- Full Cap Table
- Free Agency
- Edit Contract modal

This is the main reason the integration layer is not chaotic.

---

### 2. Current-Year Cap Sheet Integration

`CapSheetSection.tsx` forwards:

- `onSelectPlayer`
- `manualCapSheetMutationAuthority`

into `CapSheet`

That means the current-year Cap Sheet mainly owns:

- player selection → open contract modal
- dead-cap / exception edit handoff through the separate manual mutation authority

It is **not** the main source of option / FA / renounce action-click logic.

---

### 3. Full Cap Table Integration

`CapTableSection.tsx` is a thin forwarding wrapper into `CapSheetFull.tsx`, passing:

- `onSelectPlayer`
- `onActionClick`
- `getRulesProfileForYear`

`CapSheetFull.tsx` is where the action-aware Cap Sheet UI actually lives.

It sends:

- player-row name clicks through `onSelectPlayer`
- PO / TO contract cells through `onActionClick(player, 'po' | 'to', year)`
- UFA / RFA tags through `onActionClick(player, 'ufa' | 'rfa', year)`
- cap-hold “Absolve” clicks through `onActionClick(hold, 'renounce')`

So the Full Cap Table is the main Cap Sheet-side action launcher for modal-driven contract actions.

---

### 4. Full Cap Table Action Click → Dashboard Action Flow

In `useArchitectActions.ts`, `handleCapSheetAction(...)` maps Full Cap Table interactions into dashboard modal flow.

The live action routing is:

- `po` / `to` → open modal in option context
- `ufa` / `rfa` → open modal in free-agent context
- `renounce` → immediate renounce handler path

For non-renounce cases, the action hook sets:

- selected player
- selected rules year
- modal action context
- target year

and then opens the contract modal.

So the Full Cap Table → modal integration is real and centralized, not a loose chain of local callbacks.

---

### 5. Edit Contract Modal as Action Dispatcher

`EditContractModal.tsx` is the main contract-action UI surface.

It uses:

- `useCapValidation(...)`
- sign-and-trade preflight callback
- offer-sheet preflight callback

Then `handleConfirm()` dispatches to the supplied action callbacks:

- `onOptionDecision`
- `onSignFreeAgent`
- `onResign`
- `onSignAndTrade`
- `onStoreOfferSheet`
- `onExtend`
- `onWaive`
- `onRenounce`

So the modal does not own mutation truth. It owns:

- action selection
- local payload assembly
- real-time UI validation
- preflight checks for selected action types
- final dispatch into the action layer

---

### 6. Actual Mutation Owner

The actual mutation owner remains `useArchitectActions.ts`.

That file owns the action handlers wired into the modal and dashboard, including:

- `handleSign`
- `handleSignAndTrade`
- `handleStoreOfferSheet`
- `handleExtendContract`
- `handleWaiveContract`
- `handleOptionDecision`
- `handleRenounceRights`

The mutation layer is therefore centralized, even if the validation layer is not identical to it.

This is one of the strongest architectural positives in Step 6.

---

## Validation / Mutation / UI Alignment Analysis

### What Is Aligned Well

#### A. Top-Level Wiring Is Centralized

`GMDashboard.tsx` wires contract actions through one shared action hook rather than spreading separate mutation callbacks across multiple tabs or views.

That is clean.

---

#### B. Full Cap Table Action Context Is Year-Aware

`CapSheetFull.tsx` passes the clicked year to `onActionClick(...)`, and the action layer carries that into modal action context / target-year state.

That means option / FA modal flows are tied to the clicked contract year rather than acting as generic player-level actions.

This is a real integration strength.

---

#### C. Sign-and-Trade / Offer-Sheet Flows Are Better Than Average

`EditContractModal.tsx` requests authoritative preflight legality for:

- sign-and-trade
- offer sheets

before allowing those actions to proceed.

That gives those flows a stronger relationship between:

- UI validation
- real mutation legality
- world-aware action execution

than the more general local warning flows.

---

#### D. Most Actual Cap-State Changes Reach Shared Mutation Paths

Option, renounce, waive/stretch, extend, sign, offer-sheet, and sign-and-trade actions are mostly dispatched into the centralized action layer.

That means this integration layer is not mutating Cap Sheet state directly from the modal.

---

## Whether `useCapValidation` and Cap Sheet Mutation Behavior Are Aligned

### Not Fully

This is the main Step 6 risk.

`useCapValidation.ts` explicitly states that it owns **action-specific UI validation math only**.

It also explicitly states that its internal cap math helper is:

- player-only
- not the canonical Cap Sheet totals owner

and that canonical totals should come from `computeTeamCapTotals(...)` when that full truth matters.

That means the modal’s validation layer is intentionally advisory / UI-oriented rather than fully canonical.

---

### What This Means in Practice

For several actions — especially sign / re-sign style flows — the modal can warn based on a simplified cap picture using player-only cap hit math.

But the actual mutation truth is enforced later in the action hook and authoritative mutation path.

So the real model is:

- `useCapValidation.ts` = advisory validation + UX guidance
- `useArchitectActions.ts` + audited/authoritative mutation paths = actual cap-state truth

That is not inherently wrong, but it is a real ownership split.

It creates a risk that:

- contributors assume modal validation is authoritative when it is not
- a UI warning path and mutation path drift apart over time
- a modal flow appears cleaner or simpler than the true mutation layer

This is the biggest reason Step 6 is RISK.

---

## Whether Contract Actions Update Cap Sheet Truth Correctly

### Option Decisions

Options originate from Full Cap Table action clicks and end up in the modal via action context / target year.

The modal dispatches to `onOptionDecision`, and dashboard wiring sends that into `handleOptionDecision(...)`.

This is structurally aligned with shared mutation ownership and does not look like a rogue local path.

**Assessment:** mostly good

---

### Renounce

Renounce can be triggered in two different UI ways:

- directly from the Full Cap Table cap-hold row
- through the modal free-agent action set

Both routes converge on the shared renounce handler path in the action layer.

So mutation truth is not obviously split, but the staging is less uniform than other modal-driven actions.

**Assessment:** mutation truth good, staging slightly mixed

---

### Waive / Waive Stretch / Buyout

The modal dispatches all waive-family actions through `onWaive`, which the dashboard wires to `handleWaiveContract(...)`.

This is structurally aligned with centralized mutation ownership.

**Assessment:** good

---

### Extend

The modal dispatches extension actions through `onExtend`, and dashboard wiring sends them to `handleExtendContract(...)`.

Again, this is centralized in the action layer rather than owned by the modal itself.

**Assessment:** good

---

### Sign / Re-sign

The modal uses separate callback names:

- `onSignFreeAgent`
- `onResign`

But `GMDashboard.tsx` wires both of those to the same underlying `actions.handleSign`.

That means the distinction is mainly a modal/UI distinction, not a separate mutation-owner distinction.

This is acceptable, but it slightly reduces clarity about whether those actions are actually separate at the mutation layer.

**Assessment:** functionally good, ownership clarity only moderate

---

### Sign-and-Trade / Offer Sheet

These are the most aligned actions in the integration layer because the modal depends on authoritative preflights and world-aware action callbacks.

These flows are less likely to drift between UI legality and actual mutation legality than the more general signing / warning flows.

**Assessment:** strongest integration in Step 6

---

## Ownership, Staging, and Wiring Risks

### 1. Validation Ownership Is Split

This is the central risk.

The modal validation hook is not the authoritative Cap Sheet mutation truth owner.
It is a UI-layer validator with intentionally limited cap-math ownership.

That is workable, but risky.

---

### 2. `EditContractModal.tsx` Still Carries a Broader Fallback Surface Than the Active Dashboard Flow Uses

Even after prior cleanup, the modal still supports:

- `onSave`
- `onSignFreeAgent || onSave`
- `onResign || onSave`

In the active `GMDashboard.tsx` flow, `onSave` is not being used for these contract actions.

So the live integration path is cleaner than the modal API surface suggests.

That means the active dashboard integration is cleaner than the reusable component contract itself, which is a component-level ownership risk.

---

### 3. Renounce Is Structurally Split Across Immediate and Modal Paths

Renounce can happen:

- directly from Full Cap Table cap-hold UI
- from the modal action set

Even though the underlying mutation owner is shared, the UI staging is less unified than other contract actions.

That is not a correctness failure, but it is a staging / integration cleanliness risk.

---

### 4. Current-Year Cap Sheet and Full Cap Table Are Not Symmetric Action Surfaces

The current-year Cap Sheet mostly opens the generic contract modal through player selection and handles dead-cap / exception edits through separate manual mutation authority.

The Full Cap Table is the place where explicit PO / TO / UFA / RFA / renounce contract actions are surfaced.

This is not inherently wrong, but it means contract-action integration is concentrated more heavily in one Cap Sheet surface than the other.

That asymmetry increases integration complexity.

---

## PASS / RISK / FAIL

### Result: RISK

### Why This Is Not FAIL

- dashboard wiring is centralized
- Full Cap Table action launch paths are real and not ad-hoc
- the modal dispatches into explicit action callbacks
- most actual cap-state mutations flow through the shared action hook
- sign-and-trade / offer-sheet flows are especially well-aligned

This layer is clearly functioning and is structurally better than a fragmented setup.

---

### Why This Is Not PASS

- `useCapValidation.ts` is not the authoritative Cap Sheet truth owner
- modal validation and actual mutation truth are intentionally split
- `EditContractModal.tsx` still exposes a broader fallback callback surface than the active dashboard flow uses
- renounce staging is less uniform than other contract actions
- the integration is good enough to function, but not ownership-clean enough to call fully hardened

---

## Final Conclusion

Cap Sheet contract-action integration is substantially functional:

- Cap Table actions feed into shared modal context cleanly
- dashboard wiring is centralized
- modal actions are dispatched into the shared action layer
- most cap-affecting actions update Cap Sheet truth through the right mutation owner

However, the integration layer still has a meaningful validation/ownership split between:

- advisory modal validation
- actual authoritative mutation truth

That split, plus a few remaining staging / fallback-surface risks, makes the correct Step 6 conclusion:

**Cap Sheet contract-action integration is mostly working and mutation truth is usually routed through the right action layer, but the validation/ownership boundary is still split enough that this layer remains risky rather than fully clean.**

---
