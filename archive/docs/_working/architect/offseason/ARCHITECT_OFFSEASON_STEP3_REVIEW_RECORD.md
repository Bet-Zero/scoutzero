# STEP 3 — World Season Advancement Flow

## Scope

Offseason — Step 3: World Season Advancement Flow

**Date:** 2026-04-02  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the real world-backed Offseason season-advancement flow from modal confirmation to final world/team state.

Main questions:

- how world season-advance payloads are built and finalized
- whether option decisions, season/year truth, and summary/result handling are constructed correctly
- whether modal dispatch and authoritative world mutation truth are aligned
- whether final saved/reloaded state after season advancement is trustworthy
- whether any duplicate, fallback, or weaker season-advance paths still exist
- whether Offseason advancement tells one coherent world-backed execution story

---

## Executive Verdict

**RISK**

The real world-backed path is coherent and mostly authoritative, but it still has one meaningful weakness: there are **two season-advance engines in `seasonManager.ts`**, and only one is the real authoritative path used by Offseason.

The main world-backed execution story is strong, but the file still carries an older parallel path that makes the whole season-advance surface less clean than it should be. `SeasonAdvanceModal.tsx` clearly dispatches only through `advanceSeasonInWorld(...)`, and `OffseasonSection.tsx` clearly applies post-success state only from normalized modal aftermath, but the season manager itself still contains both the older `advanceSeason(...)` / `processSeasonTransition(...)` path and the newer `advanceSeasonInWorld(...)` / `processTeamSeasonTransitionWithOptions(...)` path.

---

## World Season-Advancement Flow Map

### 1. Modal confirm is the real UI entry

`SeasonAdvanceModal.tsx` owns the user-facing confirmation and dispatch path.

Its real confirm flow is:

- validate `worldId`
- validate staged option decisions
- import and call `advanceSeasonInWorld(...)`
- convert the executor result into a normalized `SeasonAdvanceSuccessResult`
- pass that normalized result to the wrapper through `onWorldAdvanceComplete(...)`

This is clean. There is **one** actual world-backed dispatch path in the modal.

### 2. `advanceSeasonInWorld(...)` is the real authoritative path

Inside `seasonManager.ts`, `advanceSeasonInWorld(...)` is the real world-backed execution engine Offseason uses.

It does the important authoritative work:

- load world metadata
- treat `worldMeta.currentSeason` as the single source of truth
- reject mismatched caller `fromSeason` / `toSeason`
- derive `fromSeason`, `toSeason`, and `draftYear` from world state
- load draft positions
- load all teams in the world
- process each team through `processTeamSeasonTransitionWithOptions(...)`
- aggregate a world-level summary
- run post-state cap validation
- persist updated team snapshots + world metadata + audit event in one batch
- return a success/failure result with `toSeason`, `updatedTeams`, and `summary`

That is the real execution center.

### 3. Team-level transition truth is concentrated in one path

Per-team offseason transition runs through `processTeamSeasonTransitionWithOptions(...)`.

That function owns:

- season field update
- entitlement-derived draft-pick view setup
- conveyance resolution
- swap resolution
- offseason transition through `resolveOffseasonTransition(...)`
- Stepien recalculation
- SSOT totals recompute through `computeTeamCapTotals(...)`

That is a strong authoritative team-level seam.

### 4. Wrapper aftermath is downstream only

`OffseasonSection.tsx` no longer invents world aftermath.
It just:

- unwraps `worldAdvanceAftermath`
- updates `currentYear`
- updates `worldSeason`
- sets `offseasonRun`
- sets `offseasonSummary`
- shows the offseason modal
- triggers optional reload callback

So the wrapper is now a downstream application layer, not a second season-advance owner.

---

## Payload / Dispatch / Mutation / Final-State Analysis

### Payload construction

The modal builds the actual dispatch payload as:

- `optionDecisions: buildAdvanceOptionDecisions(...)`

That means explicit option decisions are staged in the UI, then converted into authoritative payload shape only at dispatch time.

This part is solid.

### Season/year truth

This is one of the strongest parts of the flow now.

The modal computes its local target season from `authoritativeSeasonEndYear`, but the authoritative executor still re-anchors on world metadata:

- `worldMeta.currentSeason` is required
- mismatched caller `fromSeason` / `toSeason` is rejected
- executor derives the real `fromSeason` and `toSeason` itself

That is the right truth hierarchy.

### Summary/result handling

The executor builds a real world-level `summary` while processing teams, including:

- exercised / declined options
- expired contracts
- transitioned exceptions
- Stepien updates
- expired TPEs
- conveyance/swap resolutions
- DARE receipt/error info when applicable

Then the modal normalizes that into `worldAdvanceAftermath` for wrapper consumption through:

- `buildDashboardOffseasonSummary(...)`
- `buildWorldAdvanceAftermath(...)`
- `buildSeasonAdvanceSuccessResult(...)`

That is a coherent execution-to-UI bridge.

### Final saved/reloaded state

The authoritative write path is respectable:

- processed teams are written back to world team docs
- world metadata is updated with new `currentSeason`
- a season-advance event is written
- post-state cap legality is validated before batch commit
- wrapper aftermath applies only from normalized modal result
- optional `onReloadWorldData?.()` lets the dashboard reload after success

That makes final state broadly trustworthy.

---

## Drift Risks, Duplicate Paths, and Weak Ownership Seams

### 1. Real duplicate season-advance engine still exists

This is the main reason the verdict is **RISK**, not PASS.

`seasonManager.ts` still contains an older season-advance path:

- `advanceSeason(...)`
- `processSeasonTransition(...)`
- `processTeamSeasonTransition(...)`

Those functions still perform their own season transition logic, including:

- contract expirations
- options
- empty roster charges
- cap holds
- draft-pick updates
- totals recompute

But Offseason’s actual world-backed path is the newer:

- `advanceSeasonInWorld(...)`
- `processTeamSeasonTransitionWithOptions(...)`

So the feature’s real runtime path is coherent, but the module still presents **two season-advance models**.

That is the biggest structural cleanliness problem left.

### 2. Legacy helper logic still coexists with OSTE-driven path

The newer path clearly centers on `resolveOffseasonTransition(...)`, but the file still retains older direct helpers like:

- `processOptions(...)`
- `processContractExpirations(...)`
- `updateCapHolds(...)`
- `updateDraftPicks(...)`

Some of those belong to the old flow, not the current authoritative Offseason flow.
That is another maintainability/drift seam.

### 3. Wrapper fallback to viewing year still exists at modal prop edge

`OffseasonSection.tsx` passes:

- `authoritativeSeasonEndYear={worldSeasonEndYear ?? viewingYear}`

That is reasonable as a UI fallback when world season is still loading, but it does mean the modal’s initial target season can still temporarily depend on dashboard viewing year until metadata resolves. The executor does re-anchor to world truth, so this is not a correctness break, but it is still a mild seam.

### 4. Reload is optional, not structurally guaranteed

The wrapper calls `onReloadWorldData?.()` only if the callback exists.

That is fine architecturally, but it means the “saved/reloaded state” story depends partly on surrounding dashboard wiring rather than being fully sealed inside the season-advance path.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- the modal dispatch path is singular and authoritative
- `advanceSeasonInWorld(...)` correctly treats world metadata as source of truth
- option decisions are explicit, not silently defaulted
- post-state validation exists
- persistence is batched and world metadata is updated
- wrapper aftermath is downstream-only and no longer invents its own result truth

### Why this is not PASS

- `seasonManager.ts` still carries a **second season-advance engine**
- old helper-driven transition logic still coexists beside the newer OSTE-based authoritative path
- that leaves a real duplicate-path / maintenance drift risk inside the core execution layer itself

---

## Files Reviewed

- `src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`

---

## Final Conclusion

Offseason world season advancement now has one real runtime path from modal confirm to world batch write to wrapper aftermath, but the authoritative execution layer still contains an older parallel season-advance engine.

The live flow is trustworthy enough to avoid FAIL, but not yet clean enough for PASS.

The correct Step 3 verdict is:

**RISK**
