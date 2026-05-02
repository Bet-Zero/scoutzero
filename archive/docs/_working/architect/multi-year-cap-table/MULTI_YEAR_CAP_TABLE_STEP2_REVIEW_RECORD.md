# MULTI-YEAR CAP TABLE — STEP 2 REVIEW RECORD

## Scope

Multi-Year Cap Table Truth Pass — Step 2: Canonical Multi-Year Totals Engine and Threshold Source Truth

**Date:** 2026-04-04  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the canonical multi-year cap totals engine to determine whether total cap allocations and yearly thresholds are structurally clean, coherent, and trustworthy across seasons.

Main questions:

- whether `computeTeamCapTotals.ts` is truly the one authoritative multi-year totals owner
- whether yearly threshold sourcing from `capRulesProfile.ts` is coherent and trustworthy
- whether dead money / cap holds / incomplete roster charge logic is structurally correct across years
- whether bounded legacy compatibility paths are safe and clearly contained
- whether snapshot helpers and derived helpers preserve SSOT rather than widening ownership
- whether any current-year assumptions leak into future-year totals truth

---

## Executive Verdict

**RISK**

The canonical totals core is stronger than average and clearly meant to be the SSOT, but not yet clean enough for PASS.

The strongest clean part:

- `computeTeamCapTotals.ts` is explicit about being the canonical totals owner
- it computes player totals, dead money, cap holds, incomplete roster charges, thresholds, and deltas in one place
- `CapSheet.tsx` consumes that result once and fans it into summary/detail consumers instead of recomputing totals independently

The main risk:

- the compute chain still relies on mixed-trust inputs and bounded compatibility branches
- yearly threshold truth flows through `capRulesProfile.ts`, which blends cap-settings data, constants, `capProjections`, and recursive rookie-min projection logic
- dead money truth is canonical-first, but still falls back to legacy ledgers (`waivedContracts`, `stretchHistory`, flat `deadMoney`) when canonical `deadCap` has no coverage
- that is controlled and intentional, but it means the totals engine still carries compatibility debt inside the authority seam

The system is coherent and mostly trustworthy, but not fully clean.

---

## Canonical Multi-Year Totals / Threshold-Source Map

### 1. Canonical totals owner

`computeTeamCapTotals.ts` is the real compute authority.

It owns:

- `playersTotal`
- `deadMoneyTotal`
- `capHoldsTotal`
- `incompleteChargesTotal`
- `totalCapAllocations`
- `salaryCap`
- `luxuryTax`
- `firstApron`
- `secondApron`
- threshold deltas
- metadata about rules sources and incomplete roster-charge provenance

It also provides:

- `createCanonicalTeamTotalsSnapshot(...)`
- `synchronizeTeamTotalsSnapshot(...)`
- `canUseRoomException(...)`
- divergence warning helpers

That is a real SSOT seam, not just a helper.

### 2. Yearly threshold source

`capRulesProfile.ts` is the gateway for yearly rules.

It claims to be the only allowed source for:

- salary cap
- luxury tax
- aprons
- exceptions
- roster requirements
- rookie minimum / minimum salary scale access

Inside `getCapRulesForYear(...)`, it pulls from:

- `getCapSettingsForYear(...)`
- CBA constants
- `capProjections`
- minimum salary scales
- recursive rookie-min fallback logic when direct values are missing

### 3. Cap-hold source

Cap holds are deliberately separate from totals ownership, but totals consume them through one shared utility:

- `getActiveUnsignedCapHoldsTotalByEndYear(...)`
- which wraps end-year to start-year conversion
- and filters by active, unsigned holds only

That is a clean dependency seam.

### 4. Dead-money source

Dead money resolution is layered inside the totals owner:

1. canonical `team.deadCap[]`
2. compatibility support for legacy `deadCap.amountByYear` object maps
3. fallback to older ledgers:
   - `waivedContracts`
   - `stretchHistory`
   - flat `deadMoney` map

This is bounded and explicit, but still a compatibility seam inside the SSOT.

---

## Totals-Engine / Yearly-Rules / Compatibility Analysis

### `computeTeamCapTotals.ts` is truly the main totals authority

This is the strongest positive.

The file is explicit about:

- what it owns
- what it excludes
- and where narrower derived helpers are allowed to exist

That is good architecture.

And `CapSheet.tsx` backs that up in practice by memoizing `canonicalTotals` once and passing it down to consumers.

### Yearly threshold sourcing is coherent, but not perfectly clean

`capRulesProfile.ts` is coherent enough to function as a gateway, but it is still doing a bit too much.

It combines:

- direct yearly cap settings
- constants
- imported projections
- rookie-min projection fallback
- source-tag reporting

That is workable, but it means threshold truth is not just “read one authoritative year table.” It is a resolution engine.

The biggest soft spot is `_meta.sourcesSummary`:

- it defaults to a single `defaultSource`
- while rookie-min can separately resolve as projected
- so the top-level summary can under-describe mixed-source reality

### Dead money logic is structurally careful, but still compatibility-heavy

This is the biggest compute-side risk.

The totals owner is trying to be canonical-first:

- prefer `deadCap`
- only fall back to legacy ledgers if canonical coverage is absent

That is the right direction.

But the fact that the canonical totals engine still has to resolve:

- array-based canonical deadCap
- object-map deadCap compatibility
- waived contracts
- stretch history
- flat deadMoney maps

inside the same authority seam means the SSOT is still carrying migration debt.

### Cap holds look structurally correct across years

This seam is pretty clean.

`capHolds.ts`:

- stores cap holds by season string
- parses start year
- exposes end-year wrappers for consumers that track selected year as end year

That matches how `computeTeamCapTotals(...)` calls cap-hold totals by selected end year.

There is no clear year-key mismatch visible here.

### Incomplete roster charge logic is coherent

Inside `computeTeamCapTotals(...)`, incomplete roster charges are derived from:

- standard roster count
- `minStandard`
- rookie minimum per rules profile
- missing slots × charge per slot

That is structurally clean for a multi-year totals engine.

### Snapshot helpers mostly preserve SSOT

This part is better than expected.

`createCanonicalTeamTotalsSnapshot(...)` and `synchronizeTeamTotalsSnapshot(...)` are clearly downstream of `computeTeamCapTotals(...)`, not alternative owners.

Likewise `canUseRoomException(...)` consumes canonical totals instead of recomputing cap room manually.

That preserves the SSOT boundary.

### There is no strong current-year leak inside the totals engine itself

This is an important positive.

`computeTeamCapTotals(...)` keys off `selectedYear`:

- not `currentYear`
- and calls yearly rules / cap holds / dead money by that selected year

The main current-year-only truth split appears in adjacent surfaces like `ExceptionTracker`, not in the canonical totals engine itself.

---

## Any Misleading, Duplicated, or Weakly Enforced Compute Paths

### 1. `capRulesProfile.ts` is a gateway, but still a mixed resolver

This is the biggest threshold-source risk.

It is authoritative in intent, but still built from multiple underlying sources and fallback behaviors, especially for rookie minimum resolution and source metadata summary.

### 2. Canonical totals still carry legacy dead-money compatibility

This is the biggest compute-side risk.

The SSOT is real, but it is not purely canonical yet because it still has to recover from older dead-money representations.

### 3. Hard-cap overlay snapshot logic is adjacent to totals, not pure totals truth

This is a smaller concern.

`resolveHardCapOverlay(...)` lives in the same file and reads existing team/totals overlay state to produce snapshot output.

That is fine for snapshot shaping, but it is another sign the file is carrying both:

- pure canonical totals ownership
- and adjacent totals-adapter concerns

### 4. The source-summary metadata can over-simplify mixed-source resolution

`capRulesProfile.ts` exposes detailed source maps, which is good, but the summary field can flatten that nuance.

That is not a math bug, but it is a truth-reporting weakness.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- there is a real SSOT
- totals ownership is explicit
- the main cap-sheet surface consumes canonical totals correctly
- cap holds and incomplete roster charges look structurally coherent
- snapshot helpers and derived helpers mostly preserve the compute boundary
- there is no major current-year leak inside the totals engine itself

### Why this is not PASS

- threshold sourcing is coherent, but still resolver-heavy rather than purely declarative
- source-summary metadata can flatten mixed-source truth
- the canonical totals engine still carries bounded legacy dead-money compatibility inside the authority seam
- the feature is strong, but not yet fully clean at the compute-authority level

---

## Files Reviewed

- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
- `src/features/architect/utils/capRulesProfile/capRulesProfile.ts`
- `src/features/architect/utils/capHolds.ts`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`

- `computeTeamCapTotals(...)`
- `createCanonicalTeamTotalsSnapshot(...)`
- `synchronizeTeamTotalsSnapshot(...)`
- `canUseRoomException(...)`
- `computeDeadMoneyForYear(...)`
- `resolveDeadCapFieldForYear(...)`
- `computeLegacyDeadMoneyCompatibilityTotalForYear(...)`
- `computePlayersTotal(...)`
- `computeCanonicalTotalCapAllocations(...)`
- `resolveHardCapOverlay(...)`

### `src/features/architect/utils/capRulesProfile/capRulesProfile.ts`

- `getCapRulesForYear(...)`
- yearly cap / exceptions / rookie-min resolution
- `_meta.sourcesSummary`
- `_meta.sources`
- rookie-min projection fallback logic

### `src/features/architect/utils/capHolds.ts`

- `getActiveUnsignedCapHolds(...)`
- `getActiveUnsignedCapHoldsTotal(...)`
- `endYearToStartYear(...)`
- `getActiveUnsignedCapHoldsByEndYear(...)`
- `getActiveUnsignedCapHoldsTotalByEndYear(...)`
- `calculateCapHold(...)`

### `src/features/architect/capSheet/CapSheet/CapSheet.tsx`

- `canonicalTotals` memo
- selected-year cap-sheet consumption of `computeTeamCapTotals(...)`

---

## Final Conclusion

The canonical multi-year totals engine is real and mostly trustworthy, but Step 2 lands at **RISK**.

The main reason is:

**the SSOT is strong, but it still carries mixed-source threshold resolution and bounded legacy dead-money compatibility inside the authority seam.**
