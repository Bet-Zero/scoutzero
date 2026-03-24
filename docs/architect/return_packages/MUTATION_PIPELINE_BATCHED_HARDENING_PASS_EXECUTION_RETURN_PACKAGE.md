# MUTATION_PIPELINE_BATCHED_HARDENING_PASS — EXECUTION RETURN PACKAGE

**Date:** 2026-03-24
**Scope:** `src/features/architect/utils/mutationPipeline.ts` (post Chunks 1–3)
**Type:** Type quality pass — no runtime behavior changes

---

## 1. Summary

Full audit of `mutationPipeline.ts` (6,676 lines) for all weak-typing patterns. Pass completed fully. Runtime behavior is unchanged — all edits are type-only declarations in the type-definition section.

**Key finding:** The three primary audit targets were already strongly typed from previous chunks:

- `CurrentStateLike` — explicit typed fields, no passthrough
- `TeamLike` = `ArchitectMutationTeamRecord` — 26 explicit fields
- `PlayerLike` = `ArchitectMutationPlayerRecord` — 25+ explicit fields

Zero `any` in live code. Zero `as unknown as` bridge casts. All remaining `LooseRecord` usage confirmed load-bearing and intentional.

Four genuine narrowing opportunities were identified and applied.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/features/architect/utils/mutationPipeline.ts` | +1 import, 4 type narrowings |
| `src/tests/architect/mutationPipeline.batchedHardening.test.ts` | New — 6 behavioral proofs |
| `src/tests/architect/architectCoreLogicBlockerTrio.test.ts` | `draftPicks: [] as Array<Record<string, unknown>>` → `draftPicks: []` |
| `src/tests/architect/architectCoreTrioPassR2.test.ts` | Same |
| `src/tests/architect/architectCoreTrioPassR3.test.ts` | Same |

---

## 3. Stronger Contracts Applied

### Import added

```typescript
// mutationPipeline.ts line ~119
import type { DraftPick } from '@/schemas/architect';
```

### Type narrowings

| Location | Before | After | Source of truth |
|---|---|---|---|
| `ArchitectMutationTeamRecord.draftPicks` (line 333) | `Record<string, unknown>[]` | `DraftPick[]` | `src/schemas/architect.ts:441` |
| `ArchitectMutationResult.warnings` (line 526) | `unknown[]` | `(string \| LooseRecord)[]` | Line 2513 already expressed this shape internally |
| `ArchitectMutationPayload.deadCapChanges` (line 459) | `unknown[] \| null` | `string[] \| null` | Lines 6670–6671 always consume as string array |
| `ArchitectMutationPayload.exceptionChanges` (line 461) | `unknown[] \| null` | `string[] \| null` | Lines 5077–5079 always consume as string array |

### Side effect: 3 test `makeTeam` helpers updated

The `draftPicks` narrowing exposed 3 existing test helpers using `[] as Array<Record<string, unknown>>`. The cast was dropped — an untyped `[]` is assignable to `DraftPick[]` and requires no import. These were the only call sites affected.

---

## 4. Deliberate Non-Changes

| Symbol | Location | Reason |
|---|---|---|
| `LooseRecord` (28 usages) | Throughout | Event/metadata/history carrier — shape varies per mutation type; world patch fields are dynamic; history context is extensible by design |
| `ArchitectMutationContract[key: string]: unknown` | Line 202 | Load-bearing: `contract.years` / `contractYears` are accessed but undeclared; removing the catchall breaks dynamic field access |
| `totals: Record<string, unknown> \| null` | Line 332 | Stores two incompatible shapes: Firestore `TeamTotals` (`totalSalary`, `capHit`, etc.) and computed `TeamCapTotals` (`yearKey`, `playersTotal`, `salaryCap`, `deltas`, `_meta`). No common narrower type. See Next Steps. |
| `capProjections: Record<string, unknown> \| null` | Line 438 | Never accessed in the pipeline; passes through to trade machine. `CapProjectionEntry` exists only as local interfaces in 3 trade-machine files with no shared export. |
| `MutationMetadataLike = Record<string, unknown>` | Line 497 | `metadata` shape varies across 14 mutation types — no stable union. |
| `bio: unknown` | Line 289 | Cast defensively at use site (line 3063); incoming bio shape varies by data source. |
| `ArchitectMutationExceptions & Record<string, unknown>` | Line 248 | Intentional extensibility for exception types beyond 6 known variants. |
| `picksOut / picksIn: Record<string, unknown>[]` | Lines 372–373 | Trade payload picks are UI-originated; shape not guaranteed to match canonical `DraftPick`. |

---

## 5. Validation Results

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run test:node -- --reporter=dot src/tests/architect/mutationPipeline.batchedHardening.test.ts` | PASS — 6/6 |
| `npm run build` | PASS |

Build warnings (dynamic import overlap, chunk size) are pre-existing and unrelated to this pass.

---

## 6. Standing Failures

None.

---

## 7. Next Steps

### Step 1 — Export `TeamCapTotals` from `capTotals/` *(prerequisite)*

**File:** `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`

`TeamCapTotals` (the computed result shape with `yearKey`, `playersTotal`, `salaryCap`, `deltas`, `_meta`, etc.) is currently a private local interface. Export it from `src/features/architect/utils/capTotals/index.ts`.

This is required before Step 2 can be done.

### Step 2 — Narrow `ArchitectMutationTeamRecord.totals` *(highest-value remaining target)*

**File:** `src/features/architect/utils/mutationPipeline.ts` line 332

Currently: `totals?: Record<string, unknown> | null`

`totals` stores two incompatible shapes depending on whether the team was freshly loaded from Firestore or has already been through a compute pass:

- Firestore shape: `TeamTotals` from `src/schemas/architect.ts` (`totalSalary`, `capHit`, `guaranteedSalary`, etc.)
- Computed shape: `TeamCapTotals` from `capTotals/` (`yearKey`, `playersTotal`, `salaryCap`, `deltas`, `_meta`)

Once `TeamCapTotals` is exported (Step 1), narrow to:

```typescript
totals?: TeamTotals | TeamCapTotals | null;
```

### Step 3 — Consolidate `CapProjectionEntry` *(lower priority)*

`CapProjectionEntry` is defined independently in 3 trade-machine files with slightly different shapes:

- `capSettingsProvider.ts` (lines 21–40)
- `normalizeTradeInput.ts` (lines 103–115)
- `validateInput.ts` (lines 38–42)

Extract a shared `CapProjectionEntry` to `src/features/architect/utils/tradeMachine/constants/types.ts`, export it, and narrow `ArchitectMutationPayload.capProjections` from `Record<string, unknown> | null` to `Record<string, CapProjectionEntry | null | undefined> | null`.
