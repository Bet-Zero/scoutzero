# ARCHITECT_FINAL_HARDENING_PACK — Chunk 2 Return Package

**Date:** 2026-03-22
**Status:** COMPLETE

---

## 1. Summary

Chunk 2 completed the type-quality pass on `useArchitectState.ts` and `useArchitectActions.ts`. Two catch-all `[key: string]: unknown` signatures were removed from types whose fields are fully enumerated, and five `unknown` / `unknown[]` fields in the `ArchitectPlayer` local shape were narrowed to specific types. All changes are type-only (zero runtime behavior change).

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/features/architect/GMDashboard/hooks/useArchitectState.ts` | 2 catch-all removals |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | 5 field narrowings |
| `src/tests/architect/architectFinalHardeningPack.chunk2.test.ts` | New regression test (11 tests) |

---

## 3. Hardening Changes Completed

### `useArchitectState.ts`

**`SalaryByYear[key: string]: unknown` → removed**
- All 6 explicitly-named fields (`season`, `salary`, `option`, `optionType`, `capHit`, `guaranteed`) cover every field accessed in the free-agent derivation loops
- The underlying `MleExceptionZ` and salary row schemas do not use `.passthrough()`, so no runtime data carries extra keys

**`ArchitectExceptionEntryLike[key: string]: unknown` → removed**
- All 11 fields (`type`, `enabled`, `available`, `totalAmount`, `usedAmount`, `remainingAmount`, `createdFrom`, `createdOn`, `expiresOn`, `notes`, `seasonKey`) are explicitly named
- Individual exception schemas (`MleExceptionZ`, `BaeExceptionZ`, `DpeExceptionZ`) do not use `.passthrough()`; extra fields like `seasonKey` and `enabled` are already named here

### `useArchitectActions.ts`

**`ArchitectPlayer.yearsPro?: unknown` → `number | string | null`**

**`ArchitectPlayer.experience?: unknown` → `number | string | null`**

**`ArchitectPlayer['Years Pro']?: unknown` → `number | string | null`**

**`ArchitectPlayer.draftPick?: unknown` → `number | string | null`**

**`ArchitectPlayer.ntcTeamList?: unknown[] | null` → `(string | number)[] | null`**
- These are identity/numeric player attributes. Runtime evidence: `yearsOfService?: number | string | null` on the same type, and peer fields elsewhere in the codebase confirm the pattern. `ntcTeamList` holds team ID strings/numbers, consistent with `limitedNTCTeamIds?: (string | number)[] | null` already typed on the same interface.

---

## 4. Types Improved

| Type | Before | After |
|------|--------|-------|
| `SalaryByYear` | 6 fields + `[key: string]: unknown` | 6 explicit fields only |
| `ArchitectExceptionEntryLike` | 11 fields + `[key: string]: unknown` | 11 explicit fields only |
| `ArchitectPlayer.yearsPro` | `unknown` | `number \| string \| null` |
| `ArchitectPlayer.experience` | `unknown` | `number \| string \| null` |
| `ArchitectPlayer['Years Pro']` | `unknown` | `number \| string \| null` |
| `ArchitectPlayer.draftPick` | `unknown` | `number \| string \| null` |
| `ArchitectPlayer.ntcTeamList` | `unknown[] \| null` | `(string \| number)[] \| null` |

---

## 5. Validation / Regression Coverage Run

```
npm run typecheck       ✅ 0 errors
npm run test:node -- --reporter=dot src/tests/architect/architectFinalHardeningPack.chunk2.test.ts
                        ✅ 11/11 tests pass
npm run build           ✅ clean (pre-existing chunk-size warnings only)
npm run validate:project ✅ All validations passed
```

---

## 6. Remaining Weak Areas (Deliberate Non-Changes)

### `useArchitectState.ts`

**`ArchitectContract[key: string]: unknown` — retained**
- `ArchitectContract` participates in the `ContractLike & ... & ArchitectContract` intersection that flows into `ArchitectPlayer.contract`. `ContractLike` (from `playerRulesProfiles`) has `[key: string]: unknown`, and TypeScript requires the intersection to maintain index signature compatibility.
- Removing this catch-all breaks assignability to `PlayerLike.contract` (used in `GMDashboard.tsx` and the pipeline cast at `useArchitectActions.ts:1803`). Would require updating `ContractLike` and `PlayerLike` — out of scope.

**`WorldLeagueTeamLike.roster?: unknown[]` — retained**
- `getLeague()` returns `TeamLike[]` where `TeamLike.roster` is `unknown[]`. Narrowing `WorldLeagueTeamLike.roster` to `(string | null | undefined)[]` causes a TS2345 assignability error in the `league.forEach` callback. The runtime guard `typeof rawId === 'string'` already handles correctness; the type constraint is imposed externally.

**`ArchitectExceptionsLike[key: string]: unknown` — retained**
- The canonical `ExceptionsZ` schema uses `.passthrough()` at the top-level exceptions object. Runtime Firestore data legitimately carries extra keys here.

**`CapSheet[key: string]: unknown` (both files) — retained**
- `CapSheet` is a broad dashboard-local compatibility type wrapping raw Firestore team documents. Team docs accumulate mutation-specific fields not enumerable at this level. The catch-all is the correct choice.

### `useArchitectActions.ts`

**`ArchitectPlayer.representation?: unknown` — retained**
- Used nowhere in the file body; present only for structural compatibility. No runtime evidence of a stable shape.

**`ArchitectPlayer.options?: Record<string, unknown>` (×3 types) — retained**
- Year-keyed contract option data (e.g., `{ '2025-26': 'Player Option' }`). Narrowing to `Record<string, string>` would require runtime evidence; no key access found in the file.

**`CapSheet.waivedContracts/tradeExceptions/exceptionHistory/mleHistory/pickLog?: unknown[]` — retained**
- Opaque audit/history arrays with evolving shapes. No field access in the file; narrowing not safe without evidence.

**`CapSheet.currentPicks?: Record<string, unknown>` — retained**
- Season-keyed pick map with variable shapes per year.

**`PersistMutationResult.worldPatch?: Record<string, unknown>` — retained**
- Opaque pipeline output; shape varies by mutation type.

**`persistMutation` / `runAuthoritativeFAMutation` `payload: Record<string, unknown>` — retained**
- `MutationPayloadLike` (the pipeline's payload type) also has `[key: string]: unknown`, so changing `Record<string, unknown>` to it would be a mild alignment but not a meaningfully stronger type. Additionally, `architectContract as unknown as Record<string, unknown>` at line 1729 would still be required regardless, because `MutationPayloadLike.contract` is `LooseRecord = Record<string, unknown>`.

**Lines 801–802 double-cast (`as unknown as Record<string, Record<string, unknown>>`)** — retained
- `validatePostStateCapLegality` expects `Record<string, Record<string, unknown>>` but receives `Record<string, CapSheet>`. Fixing requires changing `validatePostStateCapLegality`'s parameter types — out of scope.

---

## 7. Pack Progress Status

| Chunk | Status | Date |
|-------|--------|------|
| Chunk 1: core trade pipeline | ✅ COMPLETE | 2026-03-22 |
| Chunk 2: dashboard hooks | ✅ COMPLETE | 2026-03-22 |
| Chunk 3: final polish | ⬜ NOT STARTED | — |
| Final audit | ⬜ NOT STARTED | — |

---

## 8. Recommended Next Actions

### Chunk 3 candidates (from documented non-changes in Chunks 1 & 2)

1. **`ArchitectContract[key: string]: unknown`** (useArchitectState.ts)
   Requires updating `ContractLike` in `playerRulesProfiles.ts` to remove its `[key: string]: unknown`, OR decoupling `ArchitectContract` from the `PlayerLike` intersection. Investigation needed.

2. **`NormalizedTeam.team.capHolds?: unknown[]`** (mutationPipeline.ts, from Chunk 1)
   Needs a `CapHoldLike` type definition in `constants/types.ts`.

3. **`NormalizedTeam.team.standardRoster/twoWayRoster: unknown[]`** (mutationPipeline.ts)
   Needs runtime evidence check to determine if these are `string[]` (player IDs) or structured objects.

4. **Line 1580 double-cast** in `mutationPipeline.ts`
   `extractTeamsByCodeFromComputeResult` return type needs investigation.

5. **`(hold: any)` callbacks** at lines 2833, 3323 of `mutationPipeline.ts`
   Should be `CapHoldLike` once that type is defined.

6. **Lines 801–802 double-cast** in `useArchitectActions.ts`
   `validatePostStateCapLegality` parameter types need widening to accept `Record<string, CapSheet>`.
