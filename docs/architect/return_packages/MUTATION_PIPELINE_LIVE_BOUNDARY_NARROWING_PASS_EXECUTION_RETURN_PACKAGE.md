# MUTATION_PIPELINE_LIVE_BOUNDARY_NARROWING_PASS — EXECUTION RETURN PACKAGE

**Date:** 2026-03-25
**Files changed:** 4 (`mutationPipeline.ts`, `tradeContext/types.ts`, `tradeContext/tradeContext.ts`, new focused node test)

---

## 1. Summary

Pass completed fully. The remaining high-value live mutation boundaries in `mutationPipeline.ts` were narrowed without changing runtime behavior, orchestration order, or persistence order.

This pass did **not** force a universal `CurrentStateLike` replacement. Shared ingress/aggregation surfaces remain broad where they still truthfully span multiple mutation families, while branch-specific compute paths and the live trade bridge now use narrower state slices.

Primary outcomes:

- narrowed the live player/team/payload contracts that still fed compute/apply through broad carriers
- tightened the exact trade-context bridge surfaces this file actually uses
- kept object-shaped player `source` support because current mutation flow still preserves it
- localized numeric normalization for cap-hold computation instead of pretending all live player bio inputs are already canonical
- added one focused behavioral test file covering signing, trade metadata preservation, and routed 3-team trade behavior

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/features/architect/utils/mutationPipeline.ts` | Narrowed live mutation contracts, localized cap-hold normalization, split broad vs narrow current-state usage |
| `src/features/architect/utils/tradeContext/types.ts` | Narrowed only the live trade bridge surfaces touched by this pass |
| `src/features/architect/utils/tradeContext/tradeContext.ts` | Switched routing bridge to a narrow routing-player slice |
| `src/tests/architect/mutationPipeline.liveBoundaryNarrowing.test.ts` | New focused node test file using public/exported behavior only |

---

## 3. Root Cause / Main Live Boundaries Addressed

### `CurrentStateLike`

The broad state carrier was doing two different jobs:

- shared public ingress/aggregation across multiple mutation families
- mutation-specific compute/apply logic that only needs a smaller truthful slice

This pass split those responsibilities instead of replacing everything with one new union. The broad public carrier remains only where it is still load-bearing; narrower state slices are used in mutation-specific helpers and the internal trade bridge.

### `ArchitectMutationPlayerRecord`

Several player fields were still broad even though the live path already knew more:

- `bio`
- `draft`
- `representation`
- `source`
- `lastUpdated`
- `version`
- `signAndTradeContract`

The key constraint was that current producers are not perfectly canonical. In particular:

- player `source` can still be an object-shaped legacy payload and is preserved in current mutation flow
- dashboard/runtime player bio inputs still carry mixed experience fields, so the boundary had to stay truthful to those producers

### `ArchitectMutationTeamRecord`

The remaining team-level broadness was concentrated in fields such as `source` and legacy TPE overlap. `totals` was intentionally left alone because that is a separate dual-shape boundary and out of scope for this pass.

### `ArchitectMutationPayload`

The live trade path was still carrying broad payload fields, especially in `tradeCtx` and `capProjections`. This pass narrowed those fields only to the shapes mutationPipeline actually consumes.

### Trade-context bridge points

The remaining trade bridge issue was not the validator-output blobs. It was the fact that routing/public trade payload surfaces still accepted broader record-like shapes than the live bridge needed. This pass narrowed only those exact surfaces.

---

## 4. Stronger Contracts Applied

### In `mutationPipeline.ts`

- `ArchitectMutationPlayerRecord.bio` now uses a narrower truthful bio slice rather than a generic record
- `ArchitectMutationPlayerRecord.draft` is narrowed to `Partial<PlayerDraft> | null`
- `ArchitectMutationPlayerRecord.representation` is narrowed to `BasePlayerDoc['representation'] | null`
- `ArchitectMutationPlayerRecord.source` is narrowed to `ArchitectSource | BasePlayerDoc['source'] | Record<string, unknown> | string | null`
- `ArchitectMutationPlayerRecord.lastUpdated` and `version` are narrowed to `string | null`
- `ArchitectMutationPlayerRecord.signAndTradeContract` is narrowed to `ArchitectMutationContract | SignAndTradeContractLike | null`
- `ArchitectMutationTeamRecord.source` is narrowed to `ArchitectSource`/legacy string support rather than a broad record
- `ArchitectMutationTeamRecord.tradeExceptions` now truthfully overlaps hydrated legacy TPE entries via a small compatibility extension instead of breaking existing cap-sheet consumers
- `ArchitectMutationPayload.capProjections` is narrowed to `TradeValidatorCapProjections | null`
- `ArchitectMutationPayload.tradeCtx` is narrowed to the actual live bridge slice used here, while keeping `seasonId` as a compatibility passthrough because existing callers still send it

### Current-state narrowing model

- `MutationCurrentState` remains as the broad public carrier for shared ingress/aggregation sites
- `TradeStateSlice` narrows the live trade state path to `teams`
- mutation-specific `require*State` helpers now narrow into smaller truthful branch slices instead of relying on one broad bag all the way through

### Local normalization boundary

`toCapHoldComputationPlayer()` was added in `mutationPipeline.ts` to normalize only the fields needed by cap-hold computation (`yearsExperience`, draft info, bird-rights shape, salary rows). This keeps the player boundary truthful to real producers while still satisfying the numeric helper contract at the single compute site that requires it.

### In `tradeContext/types.ts`

- `TradeContextPayload` no longer inherits a generic `AnyRecord`
- `TradeContextCurrentState` no longer inherits a generic `AnyRecord`
- `OutgoingTradeRouteLike` isolates only the routing keys used by destination resolution
- validator-output blobs such as `ValidatedTradeContext` and `_rawValidation` remain permissive

### In `tradeContext/tradeContext.ts`

- `resolveOutgoingTradeDestinationTeamCode()` now accepts `OutgoingTradeRouteLike` instead of a generic record
- sign-and-trade preflight/apply paths still behave the same, but now move through narrower routing inputs

---

## 5. Deliberate Non-Changes

| Boundary | Decision | Why |
|---|---|---|
| Broad public current-state carrier | Kept in limited places | Shared compute/apply ingress and validation still aggregate multiple mutation families truthfully |
| `_validatedTradeContext` / `_rawValidation` | Left permissive | Still mirror mixed validator output; no truthful producer-contract narrowing was available in this pass |
| `picksOut` / `picksIn` | Left permissive | Trade pick payload remains an intentionally unstable passthrough input surface |
| `totals` | Left unchanged | Separate dual-shape boundary; not part of this live boundary narrowing pass |
| `rfaContext` | Left localized and permissive | Current flow only preserves/deletes it; no stronger authoritative producer contract exists yet |

---

## 6. Validation Results

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run test:node -- --reporter=dot src/tests/architect/mutationPipeline.liveBoundaryNarrowing.test.ts` | PASS (3/3) |
| `npm run build` | PASS |
| `npm run validate:project` | PASS |

Observed non-blocking warnings:

- `test:node` emitted the existing projected-cap warning from trade validation
- `build` emitted existing Vite warnings about `fs` externalization, dynamic/static import overlap, stale Browserslist data, and large chunks

Commands intentionally skipped:

- `npm run lint` was not run because repo guidance says lint has many pre-existing errors and it was not requested
- full-suite test commands were not run because the prompt did not authorize `RUN FULL SUITE`
- schema/doc generation commands were not run because no schema surface changed

---

## 7. Standing Failures

None.

---

## 8. Recommended Next Step

The clean next step is a separate pass on the remaining validator-driven mixed blobs and legacy TPE compatibility surfaces outside `mutationPipeline.ts`.

That follow-up should target:

- validator-output blob truth narrowing, if a stronger producer contract can be extracted
- remaining legacy TPE overlap paths outside the live mutation boundary
- any future `totals` narrowing as its own dedicated dual-shape contract pass
