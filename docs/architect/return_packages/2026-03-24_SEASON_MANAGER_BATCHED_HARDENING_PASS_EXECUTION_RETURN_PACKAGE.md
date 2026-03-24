# SEASON_MANAGER_BATCHED_HARDENING_PASS — EXECUTION RETURN PACKAGE

**Date:** 2026-03-24
**Pass type:** Batched audit + execution (type quality)
**Primary file:** `src/features/architect/utils/seasonManager.ts`
**Total touched files:** 2

---

## 1. Summary

Pass completed fully. Runtime behavior unchanged. The exported/live season-advance boundaries are materially less dependent on placeholder typing:

- All five `unknown[]` / `unknown` / `LooseRecord[]` summary carrier fields in the live `advanceSeasonInWorld` path now have named, explicit contracts.
- `DAREResolutionReceipt` replaces `unknown` on the DARE receipt field — the first canonical external type to land on `SeasonAdvanceSummary`.
- Two conveyance result fields narrowed from `unknown` to their truthful source types.
- Two redundant unsafe casts removed from resolution function opts handling.
- 9/9 new behavioral tests pass; typecheck and build clean.

---

## 2. Files Changed

### `src/features/architect/utils/seasonManager.ts`

**New import (line 100):**

```ts
import type { DAREResolutionReceipt } from '@/features/architect/utils/entitlements/dare';
```

**3 new local boundary types (after `LooseRecord` alias):**

```ts
type StepienUpdate = { pickId: string; year: number; status: string; reason: string };
type ConveyanceResolutionEntry = { pickId?: string; year?: number; outcome?: string; position?: number };
type SwapResolutionEntry = { pickId?: string; year?: number; resolvedOwner?: string | null; resolvedPosition?: number | null };
```

**`SeasonManagerDraftPickConveyanceResult` narrowed:**

```ts
// Before
previousProtection?: unknown;
originalRound?: unknown;

// After
previousProtection?: string;
originalRound?: number | string;
```

Source: `previousProtection` ← `pick.protection: string | undefined`; `originalRound` ← `pick.round: number | string | undefined` (both from `DraftPickLike` / `SeasonManagerProjectedDraftPickView`).

**`SeasonAdvanceTeamSummary` narrowed:**

```ts
// Before
stepienUpdates: unknown[];
conveyanceResolutions: unknown[];
swapResolutions: unknown[];

// After
stepienUpdates: StepienUpdate[];
conveyanceResolutions: ConveyanceResolutionEntry[];
swapResolutions: SwapResolutionEntry[];
```

Push shapes confirmed: conveyance at lines 1345-1350, swap at lines 1392-1397, stepien at lines 1745-1750.

**`SeasonAdvanceSummary` narrowed:**

```ts
// Before
dareReceipt?: unknown;

// After
dareReceipt?: DAREResolutionReceipt;
```

Source: `summary.dareReceipt = dareResult.resolutionReceipt` where `dareResult: DAREOutput` and `DAREOutput.resolutionReceipt: DAREResolutionReceipt`.

**`updateDraftPicksWithStepien` local variable narrowed:**

```ts
// Before
const stepienUpdates: LooseRecord[] = [];

// After
const stepienUpdates: StepienUpdate[] = [];
```

**Redundant casts removed in both resolution functions (`resolveDraftPickSwapsForYear` and `resolveDraftPickConveyanceForYear`):**

```ts
// Before
const nowIso = opts.nowIso as string | undefined;
const method = (opts.method as string) || 'lottery';

// After
const nowIso = opts.nowIso;
const method = opts.method ?? 'lottery';
```

`opts` is already typed as `{ nowIso?: string; method?: string }` — the `as string` casts were no-ops or unsafe narrowings of `undefined` away.

---

### `src/tests/architect/seasonManager.batchedHardening.test.ts` *(new)*

9 behavioral tests across 3 describe blocks:

| Suite | Tests |
|---|---|
| `resolveDraftPickConveyanceForYear — no-op paths` | 3 tests: empty map, null map, no draftPicks |
| `resolveDraftPickConveyanceForYear — ConveyanceResolutionEntry shape` | 2 tests: conveys freely with correct shape + position; `nowIso` propagates without cast |
| `resolveDraftPickSwapsForYear — SwapResolutionEntry shape` | 4 tests: empty map no-op; resolves swap with correct winner/position; `nowIso` propagates without cast; non-swap picks pass through unchanged |

---

## 3. Deliberate Non-Changes

| Symbol | Location | Why still broad |
|---|---|---|
| `SeasonManagerDraftPick.resolutionMeta?: unknown` | `seasonManager.ts:236` | Audit-trail-only field. Set by `resolvePickSwap` in `swapResolution.ts` as `{ resolvedAt, method, positions }`. No business logic reads it. Narrowing requires a support edit in `swapResolution.ts` for near-zero gain. |
| `SeasonTransitionTeam.entitlements?: unknown[]` | `seasonManager.ts:251` | Hydration-only, never persisted. Holds mixed `EffectiveEntitlement` shapes from the entitlement projection pipeline. Intentionally loose boundary. |
| `LooseRecord` alias + 20+ cast sites | `seasonManager.ts:192` + throughout | Load-bearing. All cast sites access undeclared legacy fields on team/player/contract data (`teamData.players`, `player.contract`, `contract.salariesByYear`, etc.) not present on the canonical typed contracts. Removing requires redesigning the helper pipeline. |
| `PostStateTeamSnapshots` alias | `seasonManager.ts:254-256` | Correctly delegates to `Record<string, AnyRecord>` in `postStateCapValidator.ts`. Out of scope. |

---

## 4. Validation Results

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run test:node -- --reporter=dot src/tests/architect/seasonManager.batchedHardening.test.ts` | **PASS** — 9/9 tests |
| `npm run build` | **PASS** |

---

## 5. Standing Failures

None. Pre-existing build warnings (chunk size, dynamic import notices for `firebaseConfig.js`) were present before this pass and are unrelated to these changes.

---

## 6. Recommended Next Step

Fresh trio re-evaluation. The exported/live season-advance boundaries in `seasonManager.ts` are no longer the dominant blocker — remaining loose typing (`LooseRecord` cast sites, `resolutionMeta`, `entitlements`) is small, localized, and intentionally justified. Identify the next file with the highest concentration of fixable placeholder typing via the standard audit criteria.
