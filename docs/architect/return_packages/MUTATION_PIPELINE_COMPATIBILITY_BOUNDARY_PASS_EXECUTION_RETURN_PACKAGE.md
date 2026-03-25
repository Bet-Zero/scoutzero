# MUTATION_PIPELINE_COMPATIBILITY_BOUNDARY_PASS — EXECUTION RETURN PACKAGE

**Date:** 2026-03-25  
**Files changed:** 2 (`mutationPipeline.ts` + new focused node test)

---

## 1. Summary

Pass completed fully. The remaining dominant live compatibility boundary in `src/features/architect/utils/mutationPipeline.ts` was audited and narrowed without changing runtime behavior, orchestration order, or persistence order.

Primary outcomes:

- replaced raw current-state casts with explicit team/player normalization at the live mutation boundary
- narrowed the live team/player contracts only where current compute/apply flow actually reads, writes, or must preserve fields
- narrowed the trade payload team boundary where the live path actually consumes it
- removed the `mergePlayerOverride(... as any)` seam in the offer-sheet authority path
- added one focused node test file proving the hardened boundary through public mutation behavior only

This pass did **not** attempt a generic cleanup of `mutationPipeline.ts`. It stayed on the exact compatibility boundary requested.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/features/architect/utils/mutationPipeline.ts` | Hardened current-state normalization, narrowed live player/team/payload contracts, removed offer-sheet `as any` merge seam, stripped compute-only `teamTotalSalary` before persistence |
| `src/tests/architect/mutationPipeline.compatibilityBoundary.test.ts` | New focused node test file covering `signFreeAgent`, `executeTrade`, and `storeOfferSheet` through public/exported behavior |

---

## 3. Root Cause / Main Compatibility Boundary Addressed

The remaining blocker was that loaded team/player data still entered the live mutation path through broad cast-based adapters:

- `toCurrentStateTeam()`
- `toCurrentStatePlayer()`

That let loader and lineage compatibility baggage flow directly into:

- compute paths
- trade snapshot / validation bridge
- offer-sheet authority resolution
- player/team persistence preparation

The same boundary still had one raw escape hatch in `resolveStoreOfferSheetAuthority()` via:

- `mergePlayerOverride(... as any)`

This pass fixed the boundary by making the current-state adapters explicit, narrowing the live contracts only to current runtime usage, and isolating the remaining mixed producer truth behind small documented boundaries instead of raw cast/`any` seams.

---

## 4. Stronger Contracts Applied

### `toCurrentStateTeam()`

`toCurrentStateTeam()` is no longer a raw cast. It now explicitly normalizes only the live-consumed team fields:

- `id`
- `teamCode`
- `teamName`
- `players`
- `roster`
- `twoWayPlayers`
- `capHolds`
- `deadCap`
- `exceptions`
- `tradeExceptions`
- `offerSheets`
- `incomingOfferSheets`
- `exceptionHistory`
- `totals`
- `draftPicks`
- `entitlementIds`
- `source`
- `hardCapped`
- `hardCapLevel`
- `hardCapReason`
- `hardCapTriggeredBy`
- `teamTotalSalary`

`teamTotalSalary` handling is conservative and truthful to current live trade usage:

- preserve explicit top-level `teamTotalSalary` when present
- otherwise synthesize from `totals.totalSalary`
- do **not** derive from `totals.capHit`
- do **not** synthesize a top-level `totalSalary`

Because `teamTotalSalary` is needed for live trade validation but is not part of the persisted team contract, this pass strips it before Firestore team writes.

### `toCurrentStatePlayer()`

`toCurrentStatePlayer()` is no longer a raw cast. It now explicitly normalizes only the player fields the current live mutation path actually reads, writes, or must preserve for identity/history correctness:

- player identity fields
- display/name fields
- `teamCode`
- `teamName`
- `bio`
- `contract`
- `futureContract`
- `draft`
- `representation`
- `source`
- `salary`
- `currentSalary`
- `renounced`
- `freeAgentYear`
- `rightsRenounced`
- `renouncedAt`
- `rfaOfferSheet`
- `rfaOfferSheetOnly`
- `rfaContext`
- `lastUpdated`
- `version`
- `isTwoWay`
- `signedDate`
- `isNewlySignedFA`
- `originTeamId`

Trade-only routing, TPE, and matching fields were intentionally **not** reintroduced through this loaded-player adapter.

### `ArchitectMutationPlayerRecord`

The live player contract was strengthened by adding only fields confirmed as part of current live mutation behavior:

- `freeAgentYear`
- `rightsRenounced`
- `renouncedAt`
- `isTwoWay`
- `signedDate`
- `isNewlySignedFA`
- `originTeamId`

These are all currently read or written in active option, renounce, trade-context, timing, or sign-and-trade paths.

`rfaContext` remains opaque and documented because current runtime still only preserves/deletes it.

### `ArchitectMutationTeamRecord`

The live team contract was strengthened by adding:

- `teamTotalSalary`
- `exceptionHistory`

`teamTotalSalary` is part of the live trade-validation boundary.

`exceptionHistory` is part of the live team contract because `computeTradeResult()` preserves existing entries and appends TPE lifecycle history. However, it remains intentionally typed as an opaque array because authoritative producers elsewhere in the repo still emit mixed shapes at this boundary.

### `ArchitectTradePayloadTeam`

The trade payload team contract was narrowed where current live usage supported it:

- `team` now uses a small team-ref slice instead of an inline broad bag
- `picksOut` is narrowed to `NormalizedTeamPick[]`
- `picksIn` remains passthrough (`unknown[]`) because the live path forwards it but does not inspect item shape

### Offer-sheet merge seam

The former `mergePlayerOverride(... as any)` path was removed. The home-team authoritative merge now:

1. normalizes snapshot and override players into the smallest truthful merge-input slice
2. calls `mergePlayerOverride()` without `any`
3. re-normalizes the merged result back through `toCurrentStatePlayer()`

This removed the raw seam without widening the main live player boundary.

---

## 5. Deliberate Non-Changes

| Boundary | Decision | Why |
|---|---|---|
| `ArchitectMutationExceptions` open-ended shape | Kept | Live exception usage still indexes dynamic buckets by computed key |
| `rfaContext` | Kept opaque | Repo still provides no stable producer schema; live path only preserves/deletes it |
| `exceptionHistory` internal shape | Kept opaque | Current authoritative producers still emit mixed shapes outside this file |
| `picksIn` | Left broad | Live mutation path forwards but does not inspect item shape |
| `usedTaxpayerMLEThisSeason` | Not added to narrowed team boundary | No current authoritative producer evidence at this boundary |
| Legacy hard-cap cleanup outside this seam | Not touched | Out of scope for this targeted compatibility pass |

---

## 6. Validation Results

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run test:node -- --reporter=dot src/tests/architect/mutationPipeline.compatibilityBoundary.test.ts` | PASS (3/3) |
| `npm run build` | PASS |

Observed non-blocking build warnings:

- stale Browserslist data warning
- existing Vite warning about `fs` browser externalization
- existing dynamic/static import chunk warnings
- existing large chunk-size warning

Commands intentionally skipped:

- `npm run lint` was not run because repo guidance says lint has many pre-existing errors and it was not requested
- full-suite test commands were not run because the prompt did not authorize `RUN FULL SUITE`
- `npm run validate:project` was not run because this pass did not make structural export/layout changes

---

## 7. Standing Failures

None.

---

## 8. Recommended Next Step

The clean next step is a separate hardening pass on the remaining hard-cap compatibility residue outside this exact boundary, especially the scattered interaction between:

- `hardCapTriggered`
- `hardCapped`
- `hardCapLevel`

That work should determine whether those fields can be collapsed behind one authoritative normalization boundary instead of being read opportunistically across multiple trade-validation utilities.

---

**END OF RETURN PACKAGE**
