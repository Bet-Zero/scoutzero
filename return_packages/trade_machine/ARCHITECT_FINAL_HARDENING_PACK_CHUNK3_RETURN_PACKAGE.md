# ARCHITECT_FINAL_HARDENING_PACK — Chunk 3 Return Package

**Date:** 2026-03-22
**Status:** ✅ COMPLETE

---

## 1. Summary

Chunk 3 is the final polish pass of the Architect Final Hardening Pack. All major remaining weak spots documented in Chunks 1 and 2 have been addressed or classified as deliberate non-changes with clear rationale. The five primary files have been reviewed; no major placeholder typing now dominates any of them, and every remaining broad type has a documented justification.

---

## 2. Files Changed

| File | Change Type |
|------|-------------|
| `src/features/architect/utils/tradeMachine/constants/types.ts` | Import added; `capHolds` narrowed |
| `src/features/architect/utils/mutationPipeline.ts` | Import added; return types improved; filter callbacks tightened; double-casts removed |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Double-cast reduced to single cast |
| `src/tests/architect/architectFinalHardeningPack.chunk3.test.ts` | New — 12 regression tests |

---

## 3. Hardening Changes Completed

### `constants/types.ts`

- Added import: `CapHold` from `../../capHolds`
- `NormalizedTeam.team.capHolds?: unknown[]` → `CapHold[]`
- `TradeTeam.team.capHolds?: unknown[]` → `CapHold[]`
- Added comment documenting `standardRoster`/`twoWayRoster` as deliberate non-changes (only `.length` accessed in pipeline)

### `mutationPipeline.ts`

- Added import: `CapHold` from `@/features/architect/utils/capHolds`
- `extractTeamsByCodeFromCurrentState` return type: `LooseRecord` → `Record<string, LooseRecord>`
- `extractTeamsByCodeFromComputeResult` return type: `LooseRecord` → `Record<string, LooseRecord>`
- Both functions' local `teamsByCode` variable: `LooseRecord` → `Record<string, LooseRecord>`
- `beforeTeamsByCode` / `afterTeamsByCode` double-casts at `validatePostStateCapLegality` call site: **removed** (types are now structurally compatible without a cast — `Record<string, LooseRecord>` = `Record<string, AnyRecord>`)
- `(hold: any)` at line ~2834 (signFreeAgent capHolds filter): removed explicit annotation; TypeScript infers `hold: LooseRecord`
- `(hold: any)` at line ~3324 (computeRenounce capHolds filter): removed explicit annotation; TypeScript infers `hold: LooseRecord`

### `useArchitectActions.ts`

- Lines 801–802 double-cast (`as unknown as Record<string, Record<string, unknown>>`): reduced to single cast (`as Record<string, Record<string, unknown>>`). Valid because `CapSheet` extends `Record<string, unknown>` making the cast a structural downcast, not a type evasion.

---

## 4. Types Improved

| Type / Field | Before | After |
|---|---|---|
| `NormalizedTeam.team.capHolds` | `unknown[]` | `CapHold[]` |
| `TradeTeam.team.capHolds` | `unknown[]` | `CapHold[]` |
| `extractTeamsByCodeFromCurrentState` return | `LooseRecord` | `Record<string, LooseRecord>` |
| `extractTeamsByCodeFromComputeResult` return | `LooseRecord` | `Record<string, LooseRecord>` |
| `beforeTeamsByCode` / `afterTeamsByCode` at validator | `as unknown as ...` (double-cast) | no cast |
| `beforeTeamsByCode` / `afterTeamsByCode` in `useArchitectActions` | `as unknown as ...` (double-cast) | `as ...` (single cast) |
| `(hold: any)` callbacks (2 sites) | `any` | inferred `LooseRecord` (no `any`) |

---

## 5. Deliberate Non-Changes (documented)

**Carried from Chunk 1:**
- `NormalizedTeam.team.standardRoster?: unknown[]` and `twoWayRoster?: unknown[]` — only `.length` is accessed anywhere in the pipeline (confirmed by global search). No field-level element access. Low value to narrow; comment added.
- `beforeTotalsByTeam` / `afterTotalsByTeam` at `validatePostStateCapLegality` in `mutationPipeline.ts` — retain double-cast. `buildTotalsByTeam` returns `LooseRecord`, and a single-cast to `Record<string, AnyRecord>` fails TypeScript's type checking (value types incompatible). Narrowing `buildTotalsByTeam` would require knowing `computeTeamCapTotals` return type precisely — out of scope.

**Carried from Chunk 2:**
- `ArchitectContract[key: string]: unknown` in `useArchitectState.ts` — confirmed load-bearing. `p.contract.years` and `p.contract.contractYears` are accessed in `useArchitectActions.ts:1439–1444` but are not declared in `ArchitectContract`. Removing the catch-all would require a full audit of all undeclared contract field accesses. Out of scope.
- `TeamLike.capHolds?: LooseRecord[]` in `mutationPipeline.ts` — cannot narrow to `CapHold[]` because `TeamLike` participates in casts to `ComputeMutationResult.teamUpdates` in `useArchitectActions.ts`. `CapHold` (strict fields, no index signature) is not comparable to `CapHoldLike` (used in `CapSheet`) required by those casts. Changing would break multiple existing cast sites.

**Confirmed intentional (all chunks):**
- `MutationPayloadLike[key: string]: unknown` — genuine; 6+ mutation types share one input shape
- `ComputeResultLike[key: string]: unknown` — genuine; pipeline callers iterate keys generically
- `CapSheet[key: string]: unknown` — genuine; broad Firestore document compatibility layer
- `AuditContextLike[key: string]: unknown` — genuine; cross-mutation audit type

---

## 6. Validation / Regression Coverage

```
npm run typecheck   → ✅ 0 errors
npm run test:node -- --reporter=dot src/tests/architect/architectFinalHardeningPack.chunk3.test.ts
                    → ✅ 12 tests, 12 passed
npm run build       → ✅ built in 28.14s (0 errors)
npm run validate:project → ✅ All validations passed
```

**Regression tests added:** `src/tests/architect/architectFinalHardeningPack.chunk3.test.ts`

Covers:
1. `CapHold` canonical field shape (2 tests)
2. `NormalizedTeam.team.capHolds` accepts `CapHold[]` without assertion (2 tests)
3. `capHolds` filter pattern with typed callback — playerId filter, playerId+playerName OR filter, no-match case (3 tests)
4. `getActiveUnsignedCapHolds` with typed `CapHold[]` parameter — year filtering, empty result, null/undefined input (3 tests)
5. `getActiveUnsignedCapHoldsTotal` — accumulation, empty array (2 tests)

---

## 7. Remaining Weak Areas

### Polish-level (acceptable, not lane-level)
- `standardRoster`/`twoWayRoster: unknown[]` — element shape not evidenced; only `.length` used
- `beforeTotalsByTeam`/`afterTotalsByTeam` double-cast in `mutationPipeline.ts` — safe but not ideal; fixing requires narrowing `buildTotalsByTeam` and `computeTeamCapTotals` return types
- `TeamLike.capHolds?: LooseRecord[]` — cast compatibility constraint with `CapSheet`; resolving requires aligning `CapHold`/`CapHoldLike` across pipeline and dashboard types
- `ArchitectContract[key: string]: unknown` — genuine undeclared field access; enumerating all contract fields is a standalone task

### Not in scope (confirmed)
- `MutationPayloadLike` catch-all
- `ComputeResultLike` catch-all
- `CapSheet` catch-all
- `AuditContextLike` catch-all

---

## 8. Pack Progress Status

| Chunk | Status | Date |
|-------|--------|------|
| Chunk 1: core trade pipeline | ✅ COMPLETE | 2026-03-22 |
| Chunk 2: dashboard hooks | ✅ COMPLETE | 2026-03-22 |
| Chunk 3: final polish | ✅ COMPLETE | 2026-03-22 |
| Final audit | ⬜ NOT STARTED | — |

---

## 9. Recommended Next Actions

1. **Run Final Audit** — verify Architect now passes the quality standard per `ARCHITECT_FINAL_HARDENING_PACK_MASTER.md` "What done means" criteria
2. **Optional follow-up (post-audit)**: Align `CapHold`/`CapHoldLike` types across pipeline and dashboard to unlock `TeamLike.capHolds?: CapHold[]`
3. **Optional follow-up**: Add `years`, `contractYears`, and other accessed fields to `ArchitectContract` to remove its catch-all
