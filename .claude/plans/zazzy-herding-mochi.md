# Type Hardening Plan — Architect Feature

## Context

The TypeScript migration (E1-E111) ported all JS/JSX files to TS/TSX but used permissive "...Like" types with `any`, optional everything, and `[key: string]: any` catch-alls. This means TypeScript currently can't catch real bugs (wrong field names, missing props, type mismatches). The goal of this plan is to replace those loose types with real ones so the compiler actually enforces correctness.

**Current state:**
- ~299 `...Like` permissive type definitions
- 379 `: any` annotations
- 81 `as any` casts (78 concentrated in 5 files)
- 93 `Record<string, any>` patterns
- 44 `[key: string]: any` catch-all index signatures
- `tsconfig.json` has `strict: false` (all strict flags disabled)

**Key advantage:** Canonical Zod schemas already exist in `src/schemas/architect.ts` (16 schemas, only 3 export inferred types) and `src/schemas/players_v2.ts` (17 schemas, 9 export inferred types). The real types are already defined — they just aren't being used.

---

## Phase 1: Export canonical types from Zod schemas (1 scope) ✅ DONE

**Goal:** Make all Zod-inferred types importable so they can replace `...Like` copies.

**Files to edit:**

`src/schemas/architect.ts` — Add inferred type exports for the 13 schemas that lack them:
```
export type EntitlementAsset = z.infer<typeof EntitlementAssetZ>;
export type WorldEntitlementOverride = z.infer<typeof WorldEntitlementOverrideZ>;
export type DeadCapItem = z.infer<typeof DeadCapItemZ>;
export type CapHoldItem = z.infer<typeof CapHoldItemZ>;
export type Exceptions = z.infer<typeof ExceptionsZ>;
export type ProtectionMeta = z.infer<typeof ProtectionMetaZ>;
export type DraftPick = z.infer<typeof DraftPickZ>;
export type TeamTotals = z.infer<typeof TeamTotalsZ>;
export type ArchitectSource = z.infer<typeof ArchitectSourceZ>;
export type GuaranteeScheduleEntry = z.infer<typeof GuaranteeScheduleEntryZ>;
export type BasePlayerContractYear = z.infer<typeof BasePlayerContractYearZ>;
export type BasePlayerContract = z.infer<typeof BasePlayerContractZ>;
export type TradeException = z.infer<typeof TradeExceptionZ>;
```
(BaseTeamDoc, BasePlayerDoc, WorldTeamSnapshot already exported)

`src/schemas/players_v2.ts` — Add inferred type exports for remaining schemas:
```
export type PlayerAgent = z.infer<typeof PlayerAgentZ>;
export type PlayerDraft = z.infer<typeof PlayerDraftZ>;
export type PlayerDisplay = z.infer<typeof PlayerDisplayZ>;
export type PlayerBio = z.infer<typeof PlayerBioZ>;
export type ContractMetadata = z.infer<typeof ContractMetadataZ>;
export type VideoExample = z.infer<typeof VideoExampleZ>;
export type VideoExamples = z.infer<typeof VideoExamplesZ>;
export type SeasonStats = z.infer<typeof SeasonStatsZ>;
export type EvaluationTraits = z.infer<typeof EvaluationTraitsZ>;
```

`src/features/architect/types/index.ts` — Add re-exports:
```
export * from './ruleContext';
export type { BaseTeamDoc, BasePlayerDoc, BasePlayerContract, BasePlayerContractYear,
  Exceptions, TradeException, DraftPick, EntitlementAsset, DeadCapItem, CapHoldItem,
  TeamTotals, WorldTeamSnapshot, ProtectionMeta } from '../../../schemas/architect';
export type { PlayerMainDoc, ContractDoc, PlayerBio } from '../../../schemas/players_v2';
```

**Verification:** `npm run typecheck` — should pass with zero changes to consumers (additive only).

---

## Phase 2: Replace core ...Like types with canonical types (4 scopes) ✅ DONE

**Goal:** Fix the 5 worst files that contain 78 of 81 `as any` casts. For each file, replace file-local `...Like` types with imports of the canonical types, then fix the type errors the compiler reveals.

### Scope 2a: `src/features/architect/utils/contractUtils.ts`
- **Problem:** 30 `as any` casts, 15 `...Like` types
- **Replace:** `ContractLike` → `BasePlayerContract`, `ContractYearLike` → `BasePlayerContractYear`, `SalaryByYearLike` → proper type
- **Fix:** Each `as any` is a place where the loose type forced a cast — with real types, these become direct property access

### Scope 2b: `src/features/architect/tradeMachine/TradeTeamCard.tsx` + `TradeEditor.tsx`
- **Problem:** 27 `as any` casts combined, 18 `...Like` types
- **Replace:** `PlayerLike` → `BasePlayerDoc`, `TeamLike` → `BaseTeamDoc`, `EntitlementLike` → `EntitlementAsset`, `TradeTeamSlotLike` / `TradeDataEntryLike` → proper interfaces
- **Note:** Some component-specific props types (e.g. `TradeTeamCardProps`) will remain as interfaces but reference canonical types instead of `any`

### Scope 2c: `src/features/architect/utils/tradeHelpers.ts` + `hardCapUtils.ts`
- **Problem:** 21 `as any` casts combined
- **Replace:** `TradeHelperTeamLike` → `BaseTeamDoc`, `HardCapStatusTeamLike` → `BaseTeamDoc` (or a `Pick<>` subset)
- **Replace:** `HardCapCapSettingsLike` → real cap settings type from `capSettingsProvider.ts`

### Scope 2d: `src/features/architect/utils/mutationPipeline.ts` + `GMDashboard/GMDashboard.tsx`
- **Problem:** 15 + 12 `...Like` types, 5 `as any` casts
- **Replace:** `TeamLike` → `BaseTeamDoc`, `PlayerLike` → `BasePlayerDoc`, various state types with canonical versions

**Verification per scope:** `npm run typecheck && npm run build`. Run targeted tests for the affected area.

---

## Phase 3: Validation/presentation type hierarchy (2 scopes) ✅ DONE

**Goal:** The validation pipeline's `...Like` types don't map to Zod schemas — they represent computed results. These need new proper types (not Zod, just clean interfaces).

### Scope 3a: `src/features/architect/tradeMachine/validationPresentationTypes.ts` + `tradePreviewExportTypes.ts`
- **Problem:** 28 `...Like` types with `[key: string]: any`, used by ~15 files
- **Action:** Rewrite as proper interfaces with explicit fields, no catch-alls
- **Types to harden:** `ValidationResultLike` → `ValidationResult`, `ValidationRuleLike` → `ValidationRule`, `TeamResultLike` → `TeamResult`, `TradeReceiptLike` → `TradeReceipt`, etc.
- **Remove:** All `[key: string]: any` index signatures from these types

### Scope 3b: Trade machine rules and engine types
- **Files:** `utils/tradeMachine/engine/validationUtils.ts`, `utils/tradeMachine/utils/normalizeTradeInput.ts`, rule files across `utils/tradeMachine/rules/`
- **Problem:** ~45 files with `extends UnknownRecord` patterns
- **Action:** Replace `UnknownRecord` base types with real interfaces that use canonical types
- **Example:** `TradeInputLike extends UnknownRecord` → `TradeInput { teams: TradeInputTeam[]; capSettings: CapSettings; ... }`

**Verification:** `npm run typecheck && npm run build && npm run test:node -- --reporter=dot src/tests/architect/tradeMachine/`

---

## Phase 4: Component prop types (2 scopes) ✅ DONE

**Goal:** Replace per-file `PlayerLike`/`TeamLike` copies in component files with shared imports.

### Scope 4a: tradeMachine components (~20 files)
- **Files:** All `.tsx` files in `src/features/architect/tradeMachine/`
- **Action:** Delete file-local `PlayerLike`, `TeamLike`, `EntitlementLike` etc. Replace with imports from `src/features/architect/types/`
- **Pattern:** Each file currently defines its own 5-10 line `PlayerLike` type — these all become `import { BasePlayerDoc } from '../../types'`

### Scope 4b: capSheet + GMDashboard + shared + other components (~20 files)
- **Files:** All `.tsx` in `capSheet/`, `GMDashboard/`, `shared/`, `contract/`, `freeAgency/`, `offseason/`, `history/`
- **Action:** Same pattern — replace `TeamCapSheetLike`, `RulesProfileLike`, `CapDataLike` etc. with canonical imports
- **Note:** Some component-specific prop interfaces will remain but their fields will reference real types

**Verification:** `npm run typecheck && npm run build && npm run test:ui -- --reporter=dot`

---

## Phase 5: Kill remaining `any` patterns (1-2 scopes) ✅ DONE

**Goal:** Eliminate the remaining escape hatches after Phases 2-4 have replaced the structural types.

### Scope 5a: `Record<string, any>` → `Record<string, unknown>` ✅
- Replaced 72 instances across 31 files
- Fixed 125 downstream type errors (unknown-access narrowing, spread casts, return type annotations)
- Kept `mutationPipeline.ts` as `Record<string, any>` — needs dedicated deep-typing pass (233 errors alone)
- Removed all `[key: string]: any` index signatures (2 remaining were in tradeContext/types.ts and ValidationDetailsPanel.tsx)

### Scope 5b: Deferred
- 223 `[key: string]: unknown` index signatures remain across utility files
- These were already addressed in Phases 3-4 for component/presentation types
- Remaining ones are in utility files where `LooseRecord = Record<string, unknown>` is used structurally — removing them would require canonical typing of every field, which is a Phase 6+ concern

**Results:**
- `Record<string, any>`: 93 → 1 (only `mutationPipeline.ts:123`)
- `[key: string]: any`: 44 → 0
- 0 type errors, 19 test failures (all pre-existing)

**Verification:** `npm run typecheck` passes. Tests: 4362 passed, 23 failed (all pre-existing).

---

## Phase 6: Enable strict tsconfig (1 scope) — PARTIAL ✅

**Goal:** Turn on compiler enforcement so TypeScript actually catches bugs going forward.

**File:** `tsconfig.json`

### Scope 6a: `strictFunctionTypes: true` ✅
- Enabled in `tsconfig.json`
- Fixed 8 errors:
  - `capHelpers.ts`: Widened `CalculateCapHitOptions.getContractYearSlice` callback param from `Player` to `any`
  - `TradeTeamCard.tsx`: Changed 7 callback props from `(...args: unknown[])` to `(...args: any[])` (contravariance fix)
  - `validationUtils.ts`: Changed `ValidatorFunction` default from `unknown[]` to `any[]`
  - `capSheet.uiFlows.integration.test.tsx`: Widened callback params, added `as TeamLike` casts
- 0 type errors, 19 test failures (all pre-existing)

### Scope 6b: `noImplicitAny` — NOT YET (1,046 errors)
- Mostly `: any` callback params in `.map()`, `.filter()`, `.forEach()` across all files
- Requires annotating every unannotated function parameter — mechanical but massive
- Recommended: tackle per-directory (tradeMachine/ first, then utils/, then GMDashboard/)

### Scope 6c: `strictNullChecks` — NOT YET (677 errors)
- Mostly nullable property access without `?.` or `!` guards
- Many are in mutation pipeline and context files that deal with optional data
- Recommended: tackle after `noImplicitAny` since some null errors are masked by `any`

### Scope 6d: `strict: true` — NOT YET (1,006 errors)
- Enables all strict flags simultaneously
- After 6b + 6c, residual count should be minimal (mostly `strictBindCallApply` and `strictPropertyInitialization`)

**Verification:** `npm run typecheck` passes with `strictFunctionTypes: true`. Tests: 4362 passed, 23 failed (all pre-existing).

---

## Summary

| Phase | Scopes | Files | What |
|-------|--------|-------|------|
| 1. Export canonical types | 1 | 3 | Wire up existing Zod schemas |
| 2. Replace core ...Like types | 4 | ~10 | Fix 5 worst files (78/81 `as any` casts) |
| 3. Validation type hierarchy | 2 | ~50 | Real types for computed results |
| 4. Component props | 2 | ~40 | Shared imports replace local copies |
| 5. Kill remaining any | 1-2 | sweep | Remove escape hatches |
| 6. Strict tsconfig | 1 | 1 | Compiler enforcement |
| **Total** | **~12** | | |

## Key Files

- `src/schemas/architect.ts` — Zod schemas for team/player/entitlement/exception data
- `src/schemas/players_v2.ts` — Zod schemas for player collection
- `src/features/architect/types/index.ts` — Type barrel (currently only exports RuleContext)
- `src/features/architect/types/ruleContext.ts` — Already properly typed (94 refs)
- `src/features/architect/utils/contractUtils.ts` — Worst offender (30 `as any` casts)
- `src/features/architect/tradeMachine/TradeTeamCard.tsx` — Second worst (23 `as any` casts)
- `src/features/architect/tradeMachine/validationPresentationTypes.ts` — 20 `...Like` types with catch-alls
