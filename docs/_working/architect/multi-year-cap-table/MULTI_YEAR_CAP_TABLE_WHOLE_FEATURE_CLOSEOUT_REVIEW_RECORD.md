# MULTI-YEAR CAP TABLE — WHOLE-FEATURE CLOSEOUT REVIEW RECORD

## Scope

Whole-feature closeout review for the Multi-Year Cap Table feature.

**Date:** 2026-04-07  
**Source:** Direct live-code inspection plus connected guardrail remediation follow-up

---

## Purpose of this Review

Perform a fresh whole-feature closeout review of the Multi-Year Cap Table after completion of Steps 1–6, and determine whether the feature now holds one coherent end-to-end truth contract across:

- shell ownership
- canonical totals
- player-year contract slicing and cap-hit logic
- selected-year consumer surfaces
- manual edit serialization
- DEV fixture isolation
- closeout guardrail coverage

This review is based on live repo state, not on prior step records alone.

---

## Executive Verdict

**PASS**

The Multi-Year Cap Table now holds one coherent end-to-end truth model across the core feature seams.

The product code path is internally aligned:

- `CapSheetSection.tsx` owns selected-year shell handoff and year-truth signaling
- `CapSheet.tsx` remains the selected-year composition owner
- `computeTeamCapTotals.ts` remains the canonical totals SSOT
- `contractUtils.ts` remains the player-year money and cap-hit owner feeding the totals engine
- `ExceptionTracker.tsx` remains current-season-only adjacent authority and fails closed for future selected years
- manual dead-money and exception edit surfaces serialize back into canonical feature truth cleanly enough to trust
- DEV cap-sheet fixtures remain local-only, synthetic, bounded seam probes rather than authoritative feature truth
- dedicated closeout guardrails now protect the intended feature contract across all six steps

A connected closeout-level guardrail drift was found during the first whole-feature closeout review in `src/tests/architect/capTotals/leagueViewSsot.test.js`, where a stale veteran-minimum expectation still encoded the 2024-25 two-year minimum instead of the selected-season 2025-26 value. That drift was then remediated in a follow-up fix, aligning the connected LeagueView SSOT guardrail with the same live selected-season player-year truth used by the feature.

With that connected guardrail now aligned, the whole-feature closeout result is a clean **PASS**.

---

## Current Status Verification

Verified directly from live working docs before writing this record:

- `docs/_working/architect/multi-year-cap-table/MULTI_YEAR_CAP_TABLE_REVIEW_TRACKER.md`
  - Steps 1–6 all marked `DONE`
- `docs/_working/architect/multi-year-cap-table/MULTI_YEAR_CAP_TABLE_ISSUE_LOG.md`
  - MYCT-1 through MYCT-6 issues all marked `RESOLVED`

These docs were treated as status inputs only, then checked against live feature source and guardrail coverage.

---

## Whole-Feature Truth Map

### 1. Shell Ownership / Year-Truth Contract

`CapSheetSection.tsx` now acts as the top-level shell owner for the feature truth boundary.

It owns:

- `selectedYear`
- reset from `currentYear`
- shell-level year-truth messaging
- the split between:
  - the primary selected-year cap-table surface
  - the adjacent current-season authority surface
  - the DEV fixture support surface

The shell now clearly tells the user:

- what season the cap table is showing
- what season adjacent exception / hard-cap / TPE authority still belongs to
- that DEV fixtures are separate support scaffolding rather than authoritative feature truth

### 2. Canonical Totals SSOT

`computeTeamCapTotals.ts` remains the single canonical totals owner.

It owns:

- player totals
- dead money totals
- cap holds totals
- incomplete roster charges
- salary cap / tax / apron thresholds
- deltas vs those thresholds

It explicitly does **not** own:

- exception usage presentation
- TPE presentation
- hard-cap human-readable presentation state
- action-specific validation/projection math

Snapshot shaping and room-exception derivation now clearly consume canonical totals rather than competing with them.

### 3. Player-Year Contract / Cap-Hit Truth

`contractUtils.ts` remains the player-year money seam.

It now clearly owns:

- contract-row normalization
- `playerContract` / `primaryContract` / `futureContract` precedence
- selected-year contract slicing
- row-first years-remaining logic
- selected-year cap-hit calculation
- season-aware veteran-minimum reimbursement through the shared minimum-salary rules helper

The totals engine consumes this selected-year player cap-hit seam rather than re-owning contract logic itself.

### 4. Selected-Year Consumer Surfaces / Current-Year-Only Adjacent Authority

The consumer layer now tells an honest story:

- `CapSheet.tsx` is the selected-year composition surface
- `CapSummaryTiles.tsx` is a canonical totals consumer
- supporting detail and totals breakdown surfaces read as consumers of the same selected-year totals authority
- the dead-money control surface is clearly selected-year-oriented
- the exception / hard-cap / TPE adjacent surface remains current-season-only
- `ExceptionTracker.tsx` fails closed when selected year moves outside the current season

The UI now makes the split between selected-year viewing and current-year-only adjacent authority explicit instead of only implying it through scattered notes.

### 5. Manual Edit Serialization

The manual edit seam is now aligned with canonical feature truth:

#### Dead money

`ManageDeadMoneyModal.tsx` still acts as a full replacement ledger editor, but source-grouped canonical rows now preserve grouped multi-season dead-cap shape on save.

That means:

- grouped source rows rebuild as one canonical `amountByYear[]` entry
- metadata such as `originalSalary`, `waiveDate`, and `notes` is preserved where available
- unrelated manual rows remain distinct

#### Exceptions

`ManageExceptionsModal.tsx` remains explicitly current-season-only and now saves through an owned current-season canonical snapshot for the managed non-TPE exception buckets.

That means:

- persisted entries are shaped as canonical current-season exception state
- stale stored season keys are rewritten to the active current season
- omitted disabled zero-usage managed buckets act as explicit clears
- non-editable buckets remain outside this modal’s ownership boundary

### 6. DEV Fixture Isolation

The DEV fixture seam is now clearly bounded and non-authoritative.

`devCapSheetFixtures.ts` owns:

- fixture IDs/markers
- local owner metadata
- bounded coverage metadata
- synthetic `futureContract` probe and control player creation
- inject/clear/hasInjected logic

`useArchitectActions.ts` now owns local application through a grouped DEV tool surface and a DEV-gated local apply helper that writes only to the local dashboard `teamCapSheet` snapshot.

`CapSheetSection.tsx` renders the fixture controls as a DEV-only support surface and explicitly says:

- who owns the local fixture state
- what scope it lives in
- that persistence does not occur
- what the fixture pair does and does not model
- that active fixtures should be cleared before evaluating real-data behavior

### 7. Guardrail Coverage

Dedicated closeout guardrails now protect the intended contract across the feature:

- Step 1 — shell ownership / year-truth / support-surface separation
- Step 2 — canonical totals SSOT / threshold provenance / bounded compatibility
- Step 3 — player-year contract merge / futureContract precedence / cap-hit truth
- Step 4 — consumer boundaries / current-year-only adjacent authority / UI signaling
- Step 5 — dead-money shape preservation / exception save semantics / edit-boundary honesty
- Step 6 — DEV-local fixture ownership / reversible inject-clear behavior / synthetic-boundary honesty

A connected LeagueView SSOT guardrail drift was also remediated so the broader validation layer now agrees with the live selected-season veteran-minimum cap-hit truth.

---

## End-to-End Closeout Analysis

The live source now forms one coherent feature truth model.

### Ownership chain

- shell owns selected-year handoff and top-level truth signaling
- primary cap-sheet surface owns selected-year composition
- canonical totals engine owns selected-year total math
- player-year contract seam owns selected-year player money truth
- adjacent surface owns current-season-only exception / hard-cap / TPE authority
- edit modals serialize back into canonical dead-cap and current-season exception truth
- DEV fixtures stay outside authoritative product truth and remain explicitly synthetic/local

### Cross-seam consistency

I did not find a live-code contradiction where:

- consumer surfaces compete with canonical totals ownership
- future-year selected viewing silently claims current-season-only authority
- manual edit surfaces reshape data in a way that breaks downstream totals expectations
- DEV fixtures leak into authoritative persistence/mutation paths
- dedicated closeout guardrails protect a different model than the live source actually implements

### Closeout-level guardrail alignment

The only whole-feature risk surfaced during the initial closeout review was a stale connected LeagueView SSOT guardrail expectation for the 2025-26 veteran-minimum cap-hit case. That was a test-only drift, not a product contradiction, and it was remediated in a narrow follow-up fix.

Because that connected guardrail now agrees with the live selected-season truth path, the whole feature no longer has a meaningful closeout-level contradiction remaining.

---

## Remaining Risks / Caveats

No blocking whole-feature truth risk remains for closeout.

Non-blocking note:

- the 2025-26 minimum salary scale source remains projected data in the shared scale file, but that is the live source of truth currently used by the feature and tests. It is a data-source caveat, not a contradiction inside the feature truth model.

---

## Final Verdict

### Result: PASS

### Why this is PASS

- all six feature step tracks are closed in live repo state
- the product source now reflects one coherent end-to-end truth contract
- connected guardrail coverage now matches the intended feature model
- the earlier whole-feature `RISK` cause (stale LeagueView SSOT veteran-minimum expectation) was remediated without exposing any product-code contradiction

---

## Files Reviewed

### Working docs

- `docs/_working/architect/multi-year-cap-table/MULTI_YEAR_CAP_TABLE_REVIEW_TRACKER.md`
- `docs/_working/architect/multi-year-cap-table/MULTI_YEAR_CAP_TABLE_ISSUE_LOG.md`

### Shell / ownership / consumer surfaces

- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`

### Canonical totals / yearly rules

- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
- `src/features/architect/utils/capTotals/deadMoneyForYear.ts`
- `src/features/architect/utils/capTotals/hardCapSnapshotOverlay.ts`
- `src/features/architect/utils/capRulesProfile/capRulesProfile.ts`

### Player-year money seam

- `src/features/architect/utils/contractUtils.ts`
- `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.ts`
- `src/features/architect/data/minimumSalaryScales.ts`

### Manual edit seam

- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.tsx`
- `src/features/architect/capSheet/modals/ManageExceptionsModal.tsx`

### DEV fixture seam

- `src/features/architect/capSheet/devCapSheetFixtures.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/GMDashboard.tsx`

### Dedicated and connected guardrails

- `src/tests/architect/capSheet.topLevelShell.guardrail.test.tsx`
- `src/tests/architect/capSheet_closure.gate.test.ts`
- `src/tests/architect/myct_step2_guardrails.test.ts`
- `src/tests/architect/myct_step3_guardrails.test.ts`
- `src/tests/architect/myct_step4_guardrails.test.tsx`
- `src/tests/architect/myct_step5_guardrails.test.tsx`
- `src/tests/architect/myct_step6_guardrails.test.tsx`
- `src/tests/architect/capTotals/leagueViewSsot.test.js`

---

## Final Conclusion

The Multi-Year Cap Table feature is now closeout-grade.

It holds one coherent end-to-end truth contract across shell ownership, canonical totals, player-year cap-hit logic, consumer surfaces, manual edit serialization, DEV fixture isolation, and connected guardrail validation.

**Whole-feature closeout verdict: PASS.**
