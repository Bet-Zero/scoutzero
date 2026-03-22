# ARCHITECT_FINAL_HARDENING_PACK — Master Plan

## Purpose

Post-migration type **quality** pass for the Architect feature. The TypeScript migration is complete (0 live JS/JSX files). This pack replaces placeholder/bag typing with specific, meaningful contracts in the highest-value remaining areas.

This is **not** a migration pass. Do not reopen TS migration, shim deletion, wrapper cleanup, barrel cleanup, or unrelated shared refactors.

---

## What "done" means

Architect is done by this standard when the important flows in the remaining weak files are no longer dominated by:

- `any`
- `unknown[]`
- `Record<string, unknown>`
- `[key: string]: unknown`
- vague local `...Like` bags
- broad compatibility bridges
- cast-based type forcing in core flows

A small amount of looseness may remain only where the runtime is genuinely dynamic — but it must be small, localized, intentional, and clearly explained.

---

## Target Files

| File | Path |
|------|------|
| `mutationPipeline.ts` | `src/features/architect/utils/mutationPipeline.ts` |
| `normalizeTradeInput.ts` | `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts` |
| `constants/types.ts` | `src/features/architect/utils/tradeMachine/constants/types.ts` |
| `useArchitectState.ts` | `src/features/architect/GMDashboard/hooks/useArchitectState.ts` |
| `useArchitectActions.ts` | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` |

Support edits (other files) are allowed only if a concrete type blocker makes one of the five primary files impossible to harden cleanly. Keep support edits minimal — no more than one small support edit per chunk unless absolutely necessary.

---

## Hard Rules (apply to every chunk)

- Do not redesign any flow, pipeline, or orchestration
- Do not change runtime behavior
- Do not widen into shim/barrel/wrapper cleanup
- Prefer narrowing existing shapes over inventing new type architectures
- If one improvement would require runtime restructuring, stop and document it instead
- Edits are limited to the explicitly named types, fields, and cast sites in each chunk plan
- Do not opportunistically harden adjacent fields just because they are visible during editing

---

## Chunks

### ✅ Chunk 1 — COMPLETE (2026-03-22)

**Files:** `mutationPipeline.ts`, `normalizeTradeInput.ts`, `constants/types.ts`

**What was done:**

`constants/types.ts`

- `NormalizedTeam.team.picks` and `TradeTeam.team.picks`: `Array<Record<string, unknown>>` → `NormalizedTeamPick[]`

`normalizeTradeInput.ts`

- `CapProjectionEntry`: replaced all-unknown catch-all with 10 explicit cap fields (`salaryCap`, `firstApron`, `secondApron`, `taxLine`, `fullMLE`, `roomMLE`, `bae`, `taxpayerMLE`, `minimumSalary`, `averageSalary`) + retained catch-all for raw Firestore data
- `RawTeamRecord.players`, `twoWayPlayers`: `unknown` → `Array<RawTradeInputPlayer | null | undefined> | null`
- `RawTeamRecord.hardCapped`, `hardCapLevel`, `totals.hardCapLevel`: `unknown` → specific types
- `RawTradeTeam.sends`, `appliedTPEs`, `hardCapped`, `hardCapLevel`, `picksOut`: `unknown` → specific types
- `NormalizedTeamRecord.twoWayPlayers`: `unknown` → `Array<NormalizedTradeInputPlayer | null>`
- `NormalizedTradeTeam.picksOut`, `hardCapped`, `hardCapLevel`: `unknown` → specific types
- `NormalizeTradeInputParams.teams`: `unknown` → `Array<RawTradeTeam | null | undefined> | null`
- Eliminated 4 assumption casts in function bodies; added proper `twoWayPlayers` normalization

`mutationPipeline.ts`

- Added import: `TradeExceptionRecord` from `./tradeMachine/constants/types`
- `getTpeRemaining(tpe: any)` → `(tpe: TradeExceptionRecord)`
- Multi-team routing loop: `(t: any)`, `(s: any)` → `(t: LooseRecord)`, `(s: LooseRecord)`
- `teamUpdates.forEach((teamUpdate: any, ...)` → `(teamUpdate: TeamUpdateLike, ...)`
- `WritesSummaryLike`: removed `[key: string]: unknown` catch-all (all 13 fields are explicitly enumerated; confirmed no dynamic key access anywhere)
- `TeamLike.roster`: `unknown[]` → `string[]`; one incidental cast added at `offerSheet.playerId as string`

**Deliberate non-changes (documented):**

- `MutationPayloadLike[key: string]: unknown` — genuine; 6+ mutation types share one input shape
- `ComputeResultLike.metadata?: LooseRecord` — genuine; accumulates different shapes per mutation type
- `ComputeResultLike[key: string]: unknown` — genuine; pipeline callers iterate keys generically
- `AuditContextLike[key: string]: unknown` — genuine; cross-mutation type
- `NormalizedTeam.team.capHolds?: unknown[]` — holds are objects with `playerId`/`playerName`, not strings
- `NormalizedTeam.team.standardRoster/twoWayRoster: unknown[]` — no runtime evidence in pipeline
- `NormalizedTradeTeam.picksOut: unknown[]` — pick shapes unstable across contexts
- Line 1580 double-cast (`as unknown as Record<string, AnyRecord>`) — `extractTeamsByCodeFromComputeResult` return type is structurally incompatible with `Record<string, Record<string, unknown>>`; fixing requires out-of-scope changes

**Return package:** `return_packages/trade_machine/ARCHITECT_FINAL_HARDENING_PACK_CHUNK1_RETURN_PACKAGE.md`

**Regression test:** `src/tests/architect/architectFinalHardeningPack.chunk1.test.ts` (5 tests, all pass)

---

### ✅ Chunk 2 — COMPLETE (2026-03-22)

**Files:** `useArchitectState.ts`, `useArchitectActions.ts`

**What was done:**

`useArchitectState.ts`

- `SalaryByYear[key: string]: unknown` → removed (all 6 fields explicitly named; underlying schema has no passthrough at row level)
- `ArchitectExceptionEntryLike[key: string]: unknown` → removed (all 11 fields explicitly named; `MleExceptionZ`/`BaeExceptionZ` do not use passthrough)

`useArchitectActions.ts`

- `ArchitectPlayer.yearsPro?: unknown` → `number | string | null`
- `ArchitectPlayer.experience?: unknown` → `number | string | null`
- `ArchitectPlayer['Years Pro']?: unknown` → `number | string | null`
- `ArchitectPlayer.draftPick?: unknown` → `number | string | null`
- `ArchitectPlayer.ntcTeamList?: unknown[] | null` → `(string | number)[] | null`

**Deliberate non-changes (documented):**

- `ArchitectContract[key: string]: unknown` — load-bearing; intersection with `ContractLike` (which has catch-all) requires it
- `WorldLeagueTeamLike.roster?: unknown[]` — `getLeague()` returns `TeamLike.roster: unknown[]`; narrowing causes TS2345
- `ArchitectExceptionsLike[key: string]: unknown` — `ExceptionsZ` uses `.passthrough()` at top level
- `CapSheet[key: string]: unknown` (both files) — genuine; broad Firestore document compatibility layer
- `ArchitectPlayer.representation?: unknown` — no runtime evidence of stable shape
- `ArchitectPlayer.options?: Record<string, unknown>` — year-keyed option data, no field access in file
- `persistMutation`/`runAuthoritativeFAMutation` `payload: Record<string, unknown>` — `MutationPayloadLike` also has catch-all; no clean win
- Lines 801–802 double-cast — `validatePostStateCapLegality` signature change required; out of scope

**Return package:** `return_packages/trade_machine/ARCHITECT_FINAL_HARDENING_PACK_CHUNK2_RETURN_PACKAGE.md`

**Regression test:** `src/tests/architect/architectFinalHardeningPack.chunk2.test.ts` (11 tests, all pass)

---

### ✅ Chunk 3 — COMPLETE (2026-03-22)

**Files:** Only the same five primary files (unless one tiny support edit is truly required)

**Goal:** Remove the remaining highest-value weak spots left after Chunks 1 and 2.

**Success criteria:**

- No major placeholder typing dominates any of the five files
- Any remaining broad types are clearly justified
- No major bridge cast is still carrying an important flow
- Remaining weak areas are polish-level, not lane-level

Known candidates going into Chunk 3 (from Chunk 1 documented non-changes):

From Chunk 1:

- `NormalizedTeam.team.capHolds?: unknown[]` — needs `CapHoldLike` type definition
- `NormalizedTeam.team.standardRoster/twoWayRoster: unknown[]` — needs runtime evidence check
- Line 1580 double-cast — needs investigation of `extractTeamsByCodeFromComputeResult` return type
- Remaining `(hold: any)` callbacks in capHolds filters (lines 2833, 3323 of `mutationPipeline.ts`)

From Chunk 2:

- `ArchitectContract[key: string]: unknown` (useArchitectState.ts) — requires updating `ContractLike` in `playerRulesProfiles.ts` to drop its own catch-all, or decoupling `ArchitectContract` from the `PlayerLike` intersection
- Lines 801–802 double-cast in `useArchitectActions.ts` — `validatePostStateCapLegality` parameter types need widening to accept `Record<string, CapSheet>`

**What was done:**

`constants/types.ts`

- `NormalizedTeam.team.capHolds?: unknown[]` → `CapHold[]` (canonical `CapHold` interface from `capHolds.ts`)
- `TradeTeam.team.capHolds?: unknown[]` → `CapHold[]`
- Added comment documenting `standardRoster`/`twoWayRoster` as deliberate non-changes (only `.length` accessed)

`mutationPipeline.ts`

- `extractTeamsByCodeFromCurrentState` return type: `LooseRecord` → `Record<string, LooseRecord>`
- `extractTeamsByCodeFromComputeResult` return type: `LooseRecord` → `Record<string, LooseRecord>`
- `beforeTeamsByCode`/`afterTeamsByCode` at `validatePostStateCapLegality` call site: double-cast removed (types now structurally compatible)
- `(hold: any)` callbacks at lines ~2834 and ~3324: explicit `any` annotation removed; TypeScript infers `LooseRecord`

`useArchitectActions.ts`

- Lines 801–802: `as unknown as Record<string, Record<string, unknown>>` → `as Record<string, Record<string, unknown>>` (double-cast reduced to single cast)

**Deliberate non-changes (documented):**

- `NormalizedTeam.team.standardRoster/twoWayRoster: unknown[]` — only `.length` accessed; no element field access in pipeline
- `TeamLike.capHolds?: LooseRecord[]` in `mutationPipeline.ts` — cast compatibility constraint with `CapHoldLike` in `CapSheet`; narrowing to `CapHold[]` breaks existing pipeline casts in `useArchitectActions.ts`
- `beforeTotalsByTeam`/`afterTotalsByTeam` double-casts retained — `buildTotalsByTeam` returns `LooseRecord`; single-cast fails TypeScript type check
- `ArchitectContract[key: string]: unknown` — `contract.years` and `contract.contractYears` accessed at `useArchitectActions.ts:1439–1444` but not declared; full audit out of scope

**Return package:** `return_packages/trade_machine/ARCHITECT_FINAL_HARDENING_PACK_CHUNK3_RETURN_PACKAGE.md`

**Regression test:** `src/tests/architect/architectFinalHardeningPack.chunk3.test.ts` (12 tests, all pass)

---

### ⬜ Final Audit — AFTER CHUNK 3

Run one final closeout audit verifying whether Architect now passes the quality standard, not just the migration standard.

Do **not** run this after every chunk — run it once at the end unless a chunk reveals a severe unexpected blocker.

---

## Validation Commands

Run in this order after each chunk:

```bash
npm run typecheck
npm run test:node -- --reporter=dot src/tests/architect/architectFinalHardeningPack.chunk<N>.test.ts
npm run build
npm run validate:project
```

Do **not** run unless a true blocker forces it:

- `npm run test:full`
- `npm run test:architect`
- `npm run test:trade`
- `npm run test:diff`

---

## Return Package Format

Each chunk creates one return package at `return_packages/trade_machine/ARCHITECT_FINAL_HARDENING_PACK_CHUNK<N>_RETURN_PACKAGE.md` using this structure:

1. Summary
2. Files Changed
3. Hardening Changes Completed
4. Types Improved
5. Validation / Regression Coverage Run
6. Remaining Weak Areas
7. Pack Progress Status
8. Recommended Next Actions

---

## Pack Status

| Chunk | Status | Date |
|-------|--------|------|
| Chunk 1: core trade pipeline | ✅ COMPLETE | 2026-03-22 |
| Chunk 2: dashboard hooks | ✅ COMPLETE | 2026-03-22 |
| Chunk 3: final polish | ✅ COMPLETE | 2026-03-22 |
| Final audit | ⬜ NOT STARTED | — |
