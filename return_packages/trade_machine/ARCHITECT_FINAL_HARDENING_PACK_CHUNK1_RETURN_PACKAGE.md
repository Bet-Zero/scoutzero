# ARCHITECT_FINAL_HARDENING_PACK_CHUNK1 — EXECUTION RETURN PACKAGE

## 1. Summary

This is **Chunk 1** of the three-chunk ARCHITECT_FINAL_HARDENING_PACK.

Chunk 1 completed **fully**. All three primary files were hardened: `constants/types.ts`, `normalizeTradeInput.ts`, and `mutationPipeline.ts`. Runtime behavior was **unchanged** — no logic was modified, only type signatures and one incidental cast site caused by the `roster: string[]` narrowing.

The pack remains on track. Chunk 2 (`useArchitectState.ts` + `useArchitectActions.ts`) is the expected next step.

---

## 2. Files Changed

### Runtime files edited

| File | Change Type |
|------|-------------|
| `src/features/architect/utils/tradeMachine/constants/types.ts` | Type narrowing |
| `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts` | Type narrowing, cast elimination |
| `src/features/architect/utils/mutationPipeline.ts` | Type narrowing, `any` elimination |

### Tests added

| File | Purpose |
|------|---------|
| `src/tests/architect/architectFinalHardeningPack.chunk1.test.ts` | Chunk 1 regression proof (5 tests) |

### Return package

- `return_packages/trade_machine/ARCHITECT_FINAL_HARDENING_PACK_CHUNK1_RETURN_PACKAGE.md`

### Support edits

None required. No support files were modified.

---

## 3. Hardening Changes Completed

### `constants/types.ts`

- **`NormalizedTeam.team.picks` (line 275)**: `Array<Record<string, unknown>>` → `NormalizedTeamPick[]`
  `NormalizedTeamPick` was already defined in the same file (line 232-241) and describes the correct shape.
- **`TradeTeam.team.picks` (line 489)**: Same narrowing applied to the `TradeTeam` inner team shape for consistency.

**Deliberate non-changes:**
- `capHolds?: unknown[]`: Runtime evidence shows cap holds are objects with `playerId`/`playerName` fields, NOT string IDs. Narrowing to `string[]` would be wrong. Left as `unknown[]`.
- `standardRoster?: unknown[]`, `twoWayRoster?: unknown[]`: No usage found in `mutationPipeline.ts`. Cannot confirm ID-only shape. Left as `unknown[]`.

### `normalizeTradeInput.ts`

**New CapProjectionEntry interface** (replaced `[key: string]: unknown` entirely):
- Added explicit optional fields: `salaryCap`, `firstApron`, `secondApron`, `taxLine`, `fullMLE`, `roomMLE`, `bae`, `taxpayerMLE`, `minimumSalary`, `averageSalary` (all `number | null`)
- Retained `[key: string]: unknown` for forward-compat with raw Firestore data

**`RawTeamRecord` field narrowing** (lines 81-88):
- `players?: unknown` → `players?: Array<RawTradeInputPlayer | null | undefined> | null`
- `twoWayPlayers?: unknown` → `twoWayPlayers?: Array<RawTradeInputPlayer | null | undefined> | null`
- `hardCapped?: unknown` → `hardCapped?: boolean | string | number | null`
- `hardCapLevel?: unknown` → `hardCapLevel?: string | number | null`
- `totals.hardCapLevel?: unknown` → `totals.hardCapLevel?: string | number | null`

**`RawTradeTeam` field narrowing** (lines 94-99):
- `sends?: unknown` → `sends?: Array<RawTradeInputPlayer | null | undefined> | null`
- `appliedTPEs?: unknown` → `appliedTPEs?: Array<RawTradeException | null | undefined> | null`
- `hardCapped?: unknown` → `hardCapped?: boolean | string | number | null`
- `hardCapLevel?: unknown` → `hardCapLevel?: string | number | null`
- `picksOut?: unknown` → `picksOut?: unknown[]` (pick shapes are unstable — deliberately kept loose)

**`NormalizedTeamRecord.twoWayPlayers`** (line 120):
- `unknown` → `Array<NormalizedTradeInputPlayer | null>` — completes the Raw→Normalized refinement

**`NormalizedTradeTeam` field completion** (lines 127-130):
- `picksOut: unknown` → `picksOut: unknown[]`
- `hardCapped: unknown` → `hardCapped: boolean | string | number | null`
- `hardCapLevel: unknown` → `hardCapLevel: string | number | null`

**`NormalizeTradeInputParams.teams`** (line 144):
- `teams?: unknown` → `teams?: Array<RawTradeTeam | null | undefined> | null`

**Cast eliminations in function bodies:**
- Removed `as Array<RawTradeInputPlayer | null>` casts on lines 205, 219 (now typed at source)
- Removed `as Array<RawTradeException>` cast on line 232 (now typed at source)
- Removed `as Array<RawTradeTeam | null>` cast on line 259 (now typed at source)
- Removed `(tpe as RawTradeException).amount` casts in TPE mapper — `TradeExceptionLike` already has `amount?: unknown` so `toNum(tpe.amount)` works without a cast
- Added `twoWayPlayers` normalization to `normalizeTeam` — previously raw twoWayPlayers were passed through without normalization

### `mutationPipeline.ts`

**New import:**
```ts
import type { TradeExceptionRecord } from '@/features/architect/utils/tradeMachine/constants/types';
```

**Line 2182 — fixed raw `any`:**
```ts
// Before
const getTpeRemaining = (tpe: any) =>
// After
const getTpeRemaining = (tpe: TradeExceptionRecord) =>
```

**Lines 2206/2208 — fixed `any` in multi-team trade routing check:**
```ts
// Before
payload.teams.some((t: any) => (t.sends || []).some((s: any) =>
// After
payload.teams.some((t: LooseRecord) => ((t.sends || []) as LooseRecord[]).some((s: LooseRecord) =>
```

**Line 2228 — fixed `any` in `teamUpdates.forEach`:**
```ts
// Before
teamUpdates.forEach((teamUpdate: any, idx: number) =>
// After
teamUpdates.forEach((teamUpdate: TeamUpdateLike, idx: number) =>
```

**`WritesSummaryLike` catch-all removal:**
- Removed `[key: string]: unknown` from `WritesSummaryLike`.
- Evidence: `cloneWritesSummary()` returns exactly the 13 enumerated fields. All write paths in `persistWorldMutation` create WritesSummary objects using only those 13 fields. No dynamic key access on `writesSummary` exists anywhere in the codebase (`grep writesSummary\[` → no results).

**`TeamLike.roster` narrowing:**
- `roster?: unknown[]` → `roster?: string[]`
- Rosters are player ID string arrays throughout the pipeline.
- Required one incidental cast at line 4502 to bridge `offerSheet.playerId` (from `LooseRecord` → `unknown`) to `string`: `const playerId = offerSheet.playerId as string;`

**Deliberate non-changes:**
- `MutationPayloadLike[key: string]: unknown` — kept; used across 6+ mutation types (executeTrade, signFreeAgent, waivePlayer, extendPlayer, optionDecision, renounceRights)
- `metadata?: LooseRecord` in `ComputeResultLike` — kept; accumulates different field shapes per mutation type
- `ComputeResultLike[key: string]: unknown` — kept; pipeline callers iterate keys generically
- `AuditContextLike[key: string]: unknown` — kept; cross-mutation type
- Line 1580 double-cast (`as unknown as Record<string, AnyRecord>`): The `extractTeamsByCodeFromComputeResult` return type is structurally incompatible with `Record<string, Record<string, unknown>>` due to TypeScript index signature covariance constraints. Fixing requires changing either the validator's input type or the extractor's return type — both out of Chunk 1 scope. Documented for Chunk 3.
- Remaining `(hold: any)` callbacks in `capHolds.filter()` (lines 2833, 3323): Not in the named edit sites. Left for Chunk 3 or a future cleanup pass.

---

## 4. Types Improved

| Type / Site | Before | After |
|-------------|--------|-------|
| `NormalizedTeam.team.picks` | `Array<Record<string, unknown>>` | `NormalizedTeamPick[]` |
| `TradeTeam.team.picks` | `Array<Record<string, unknown>>` | `NormalizedTeamPick[]` |
| `CapProjectionEntry` | `{ [key: string]: unknown }` | 10 explicit cap fields + catch-all |
| `RawTeamRecord.players` | `unknown` | `Array<RawTradeInputPlayer \| null \| undefined> \| null` |
| `RawTeamRecord.twoWayPlayers` | `unknown` | `Array<RawTradeInputPlayer \| null \| undefined> \| null` |
| `RawTeamRecord.hardCapped` | `unknown` | `boolean \| string \| number \| null` |
| `RawTeamRecord.hardCapLevel` | `unknown` | `string \| number \| null` |
| `RawTeamRecord.totals.hardCapLevel` | `unknown` | `string \| number \| null` |
| `RawTradeTeam.sends` | `unknown` | `Array<RawTradeInputPlayer \| null \| undefined> \| null` |
| `RawTradeTeam.appliedTPEs` | `unknown` | `Array<RawTradeException \| null \| undefined> \| null` |
| `RawTradeTeam.hardCapped` | `unknown` | `boolean \| string \| number \| null` |
| `RawTradeTeam.hardCapLevel` | `unknown` | `string \| number \| null` |
| `RawTradeTeam.picksOut` | `unknown` | `unknown[]` |
| `NormalizedTeamRecord.twoWayPlayers` | `unknown` | `Array<NormalizedTradeInputPlayer \| null>` |
| `NormalizedTradeTeam.picksOut` | `unknown` | `unknown[]` |
| `NormalizedTradeTeam.hardCapped` | `unknown` | `boolean \| string \| number \| null` |
| `NormalizedTradeTeam.hardCapLevel` | `unknown` | `string \| number \| null` |
| `NormalizeTradeInputParams.teams` | `unknown` | `Array<RawTradeTeam \| null \| undefined> \| null` |
| `WritesSummaryLike` | has `[key: string]: unknown` catch-all | enumerated fields only |
| `TeamLike.roster` | `unknown[]` | `string[]` |
| `getTpeRemaining` parameter | `any` | `TradeExceptionRecord` |
| `teamUpdates.forEach` callback | `(teamUpdate: any)` | `(teamUpdate: TeamUpdateLike)` |
| Multi-team routing loop | `(t: any)`, `(s: any)` | `(t: LooseRecord)`, `(s: LooseRecord)` |

---

## 5. Validation / Regression Coverage Run

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS (0 errors) |
| `npm run test:node -- --reporter=dot src/tests/architect/architectFinalHardeningPack.chunk1.test.ts` | PASS (5/5 tests) |
| `npm run build` | PASS (pre-existing chunk size warning only — not introduced by this change) |
| `npm run validate:project` | PASS |

**Intentionally skipped:**
- `npm run test:full` — not permitted without explicit RUN FULL SUITE authorization
- `npm run test:architect`, `npm run test:trade`, `npm run test:diff` — not forced by any test failure

**Build warnings:** Pre-existing dynamic/static import mixing warnings for `firebaseConfig.js`, `entitlementResolver.ts`, `leagueInvariants.ts`. Not introduced by this chunk.

**Test stabilization:** None required. All 5 new tests passed on first run.

---

## 6. Remaining Weak Areas

### In Chunk 1 scope (not yet addressed)

- `CapProjectionEntry` catch-all is retained (intentional — raw Firestore data)
- `NormalizedTradeTeam.picksOut: unknown[]` is still loose (pick shapes are unstable)
- `NormalizedTeam.team.capHolds?: unknown[]` — left because cap holds are objects, not string IDs; requires defining a proper `CapHoldLike` type to narrow
- `NormalizedTeam.team.standardRoster/twoWayRoster: unknown[]` — no runtime evidence available for these fields in `mutationPipeline.ts`
- Line 1580 double-cast (`as unknown as Record<string, AnyRecord>`) — structural incompatibility requires out-of-scope changes
- `ComputeResultLike[key: string]: unknown` — kept intentionally; legitimate open accumulator
- `MutationPayloadLike[key: string]: unknown` — kept intentionally; 6+ mutation types
- Remaining `(hold: any)` callbacks in capHolds filters (lines 2833, 3323) — not in named edit sites

### Already justified (deliberate)
- `CapProjectionEntry` catch-all
- `picksOut: unknown[]`
- `ComputeResultLike.metadata?: LooseRecord`
- `AuditContextLike[key: string]: unknown`

---

## 7. Pack Progress Status

**Chunk 1: COMPLETE**

The finish pack remains on track:

- ✅ Chunk 1: `mutationPipeline.ts`, `normalizeTradeInput.ts`, `constants/types.ts`
- ⬜ Chunk 2: `useArchitectState.ts`, `useArchitectActions.ts`
- ⬜ Chunk 3: Final polish of all five files
- ⬜ Final audit: One closeout pass after Chunk 3

---

## 8. Recommended Next Actions

Execute **Chunk 2**: harden `useArchitectState.ts` and `useArchitectActions.ts`.

These hooks should now be able to reference the tighter contracts from Chunk 1 (especially the `WritesSummaryLike` without catch-all, and the cleaner `ComputeResultLike` fields) rather than defining broad local compatibility shapes. The primary goals:

- Dashboard-facing state slices more specifically typed
- Action payloads/results more specifically typed
- Action/state contracts aligned with the pipeline/contracts from Chunk 1
- Broad local compatibility typing materially reduced
