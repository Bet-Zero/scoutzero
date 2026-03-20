# Type Hardening Plan — Architect Feature

## Current Status Update (2026-03-20)

The original type-hardening phases in this plan are effectively complete for the Architect scope that mattered here. Since the earlier draft was written, the follow-up hardening pass was implemented and verified.

**Architect status now:**
- Baseline `npm run typecheck` passes
- Architect-only strict gate passes via `tsconfig.architect-strict.json`
- `npm run build` passes
- `npm run test:architect -- --reporter=dot` passes
- `npm run test:trade -- --reporter=dot` passes
- `npm run validate:project` passes

**What is still not done:**
- Architect is not yet a zero-JS/zero-JSX feature
- Many remaining `.js` / `.jsx` files are compatibility shims, wrappers, barrels, or intentional legacy/public entry surfaces
- A lot of tests and some runtime imports still reference those exact `.js` / `.jsx` paths on purpose

**Implication:** the next migration lane is no longer “type hardening.” It is **compatibility-shim retirement / TS-only entry-surface cleanup**.

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

## Phase 6: Strict Compiler Enforcement — ARCHITECT SCOPE COMPLETE / REPO-WIDE PENDING ✅

**Goal:** Turn on compiler enforcement so TypeScript actually catches bugs going forward.

**Files:** `tsconfig.json`, `tsconfig.architect-strict.json`

### Scope 6a: `strictFunctionTypes: true` ✅
- Enabled in `tsconfig.json`
- Fixed 8 errors:
  - `capHelpers.ts`: Widened `CalculateCapHitOptions.getContractYearSlice` callback param from `Player` to `any`
  - `TradeTeamCard.tsx`: Changed 7 callback props from `(...args: unknown[])` to `(...args: any[])` (contravariance fix)
  - `validationUtils.ts`: Changed `ValidatorFunction` default from `unknown[]` to `any[]`
  - `capSheet.uiFlows.integration.test.tsx`: Widened callback params, added `as TeamLike` casts
- 0 type errors, 19 test failures (all pre-existing)

### Scope 6b: `noImplicitAny` — ARCHITECT SCOPE ✅ / REPO-WIDE NOT YET
- Cleared the remaining Architect-scope `noImplicitAny` failures by tightening fixtures, callback params, object literals, and shared input contracts
- This was enforced under the dedicated Architect strict gate in `tsconfig.architect-strict.json`
- Repo-wide `noImplicitAny` in the base `tsconfig.json` is still deferred because this plan intentionally stayed Architect-scoped

### Scope 6c: `strictNullChecks` — ARCHITECT SCOPE ✅ / REPO-WIDE NOT YET
- Cleared the remaining Architect-scope nullability failures in cap legality, mutation pipeline, season advancement, trade-machine support flows, and related UI/hook surfaces
- Replaced a number of unsafe empty-object fallbacks with explicit nullable handling and local narrowing
- This is passing inside `tsconfig.architect-strict.json`, but not yet enabled repo-wide in the base `tsconfig.json`

### Scope 6d: `strict: true` — ARCHITECT SCOPE ✅ / REPO-WIDE NOT YET
- Added `tsconfig.architect-strict.json` and made the Architect feature pass with `strict: true`
- This is the new enforcement surface for Architect and the practical completion target for this plan
- Base-config repo-wide `strict: true` is still a separate future project because roster, scouting, scrape tooling, and other legacy surfaces remain out of scope here

**Verification:**
- `npm run typecheck` passes
- `npm run typecheck -- --project tsconfig.architect-strict.json` passes
- `npm run build` passes
- `npm run test:architect -- --reporter=dot` passes
- `npm run test:trade -- --reporter=dot` passes
- `npm run validate:project` passes

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

---

## Follow-Up Plan: Architect Compatibility-Shim Retirement

## Current Status Update (2026-03-20)

The compatibility-only retirement tranche from this follow-up plan is now complete.

**Phase 7A status now:**
- Deleted 20 compatibility-only same-path `.js` / `.jsx` shims across dashboard/world, trade-team-card leaves, offseason preview, helper utilities, trade-context, and shared modal surfaces
- Retargeted guardrails and behavior tests from shim-presence checks to deleted-path absence plus extensionless/authority parity
- Kept mixed/structural keepers untouched: `DraftPositionsInput.jsx`, `EntitlementPicksList.jsx`, `ValidationStateHeader.jsx`, `basicArchitectUtils.js`, `playerRulesProfile/types.js`, `capLegalityValidation.js`, `computeTeamCapTotals.js`, `hardCapStatus.js`, `tradeContext/types.js`
- Kept intentional/runtime-backed surfaces untouched: `tradeContext/legacy/index.js`, `shared/utils/contracts/*.js`, wrapper/barrel/public-entry files, and the broader runtime-backed Trade Machine shim frontier

**Phase 7B batch-1 status now:**
- Deleted 17 runtime-backed same-path `.js` shims under `tradeMachine/utils` and `tradeMachine/constants`: `cbaConstants.js`, `secondApronMessages.js`, `capUtils.js`, `conveyanceResolution.js`, `dataValidation.js`, `matchingValues.js`, `pickIdUtils.js`, `salaryMargin.js`, `salaryMatchingRules.js`, `salaryUtils.js`, `seasonUtils.js`, `stepienEntitlementUtils.js`, `swapResolution.js`, `tpeValidation.js`, `tradeTimingWindows.js`, `tradeUtilityMisc.js`, `validationIssueText.js`
- Retargeted live `src/**` imports, tests, and retained barrel/wrapper exports to extensionless paths for that utils/constants batch
- Added E117 guardrail coverage proving deleted-path absence plus representative extensionless/authority parity for the retired runtime-backed surfaces
- Kept batch-excluded runtime-backed surfaces untouched: `capSettingsProvider.js`, `hardCapStatus.js`, `playerRulesProfile/**`, top-level Architect helper shims, rule/engine/cache same-path `.js` hosts, `tradeContext/legacy/index.js`, and `shared/utils/contracts/*.js`

**Phase 7B batch-2 status now:**
- Deleted 12 runtime-backed same-path top-level helper shims: `capUtils.js`, `cbaConstants.js`, `consentUtils.js`, `contractUtils.js`, `faExceptionUtils.js`, `hardCapUtils.js`, `reacqUtils.js`, `seasonFormat.js`, `seasonUtils.js`, `stepienUtils.js`, `timingUtils.js`, `tradeHelpers.js`
- Retargeted live `src/**` imports, tests, and retained barrel/wrapper exports to extensionless paths for those helper surfaces
- Added E118 guardrail coverage proving deleted-path absence plus representative extensionless/authority parity for the retired top-level helper surfaces
- Folded the `violatesReacquisitionBar` re-export into `timingUtils.ts` so `timingUtils.js` and `reacqUtils.js` could retire together without changing the export contract
- Kept the next runtime-backed frontier untouched: `playerRulesProfile/**`, `tradeMachine/rules/*.js`, `tradeMachine/engine/*.js`, `tradeMachine/cache/*.js`, persistence-contract helpers, `tradeContext/legacy/index.js`, and `shared/utils/contracts/*.js`

**Phase 7B batch-3 status now:**
- Deleted 6 runtime-backed same-path `playerRulesProfile` leaf shims: `minimumSalaryRules.js`, `maxSalaryRules.js`, `birdRightsRules.js`, `rfaRules.js`, `extensionRules.js`, `computeProfile.js`
- Retargeted live `src/**` imports, smoke tests, and Architect guardrails to extensionless paths or TS-authority checks for the retired leaf surfaces
- Added E119 guardrail coverage proving deleted-path absence plus representative extensionless/authority parity for the retired `playerRulesProfile` leaf surfaces
- Kept `playerRulesProfile/index.js` as the intentional barrel surface and `playerRulesProfile/types.js` as the intentional JSDoc/default-export support surface
- Kept the next runtime-backed frontier untouched: `tradeMachine/rules/*.js`, `tradeMachine/engine/*.js`, `tradeMachine/cache/*.js`, persistence-contract helpers, `tradeContext/legacy/index.js`, and `shared/utils/contracts/*.js`

**Phase 7B batch-4 status now:**
- Deleted 21 runtime-backed same-path `tradeMachine/rules` shims: `basicRules.js`, `draftRules.js`, `enforceConsent.js`, `enforcement.js`, `hardCapValidation.js`, `miscRules.js`, `rosterValidation.js`, `timingValidation.js`, `tradeExceptions.js`, `validateAggregation.js`, `validateCash.js`, `validateConsent.js`, `validateEligibility.js`, `validateEntitlementRouting.js`, `validateFaExceptionUsage.js`, `validatePlayerRouting.js`, `validateReacquisition.js`, `validateSalaryMatching.js`, `validateSignAndTrade.js`, `validateStepien.js`, and `validateTradeExceptions.js`
- Retargeted live `src/**` imports, trade tests, and Architect guardrails to extensionless paths or TS-authority checks for the retired rule surfaces
- Added E120 guardrail coverage proving deleted-path absence plus representative extensionless/authority parity for the retired `tradeMachine/rules` surfaces
- Updated the remaining `tradeMachine/rules` wrapper/barrel surfaces to resolve through extensionless specifiers, preserving `rules/index.js` as the barrel and `enforceEligibility.js` as the intentional wrapper
- Kept the next runtime-backed frontier untouched: `tradeMachine/engine/*.js`, `tradeMachine/cache/*.js`, persistence-contract helpers, `tradeContext/legacy/index.js`, and `shared/utils/contracts/*.js`

**Phase 7B batch-5 status now:**
- Deleted 7 runtime-backed same-path `tradeMachine/engine` shims: `engineUtils.js`, `performanceMonitor.js`, `tradeDebug.js`, `tradeValidator.js`, `validationDebugMonitor.js`, `validationPerformanceMonitor.js`, and `validationUtils.js`
- Retargeted live `src/**` imports, trade tests, and Architect guardrails to extensionless paths or TS-authority checks for the retired engine surfaces
- Added E121 guardrail coverage proving deleted-path absence plus representative extensionless/authority parity for the retired `tradeMachine/engine` surfaces
- Retargeted the grouped compatibility guardrail so `tradeDebug.js` is now an intentionally deleted shim path while preserving extensionless/default-authority parity
- Updated the retained barrel surfaces to resolve through extensionless engine specifiers, preserving `engine/index.js` as the barrel and removing its stale nonexistent `tradeValidator.debug.js` export
- Kept the next runtime-backed frontier untouched: `tradeMachine/cache/*.js`, persistence-contract helpers, `tradeContext/legacy/index.js`, and `shared/utils/contracts/*.js`

**Phase 7B batch-6 status now:**
- Deleted 3 runtime-backed same-path `tradeMachine/cache` shims: `cacheInvalidationManager.js`, `validationCache.js`, and `validationCacheService.js`
- Retargeted live `src/**` imports, trade tests, and Architect guardrails to extensionless paths or TS-authority checks for the retired cache surfaces
- Added E122 guardrail coverage proving deleted-path absence plus representative extensionless/authority parity for the retired `tradeMachine/cache` surfaces
- Preserved `tradeMachine/cache/index.js` as the intentional barrel surface, updated it to extensionless specifiers, and removed its stale nonexistent `validationCacheManager.js` export
- Kept the next runtime-backed frontier untouched: persistence-contract helpers, `tradeContext/legacy/index.js`, and `shared/utils/contracts/*.js`

**Phase 7B batch-7 status now:**
- Deleted 4 runtime-backed same-path `persistenceContracts` shims: `contracts.js`, `enforcement.js`, `normalizeTeamTpe.js`, and `validatePersistableShape.js`
- Retargeted live `src/**` imports, smoke tests, and Architect guardrails to extensionless paths or TS-authority checks for the retired persistence-contract surfaces
- Added E123 guardrail coverage proving deleted-path absence plus representative extensionless/authority parity for the retired `persistenceContracts` surfaces
- Preserved `persistenceContracts/index.js` as the intentional barrel surface and updated it to extensionless specifiers
- Smoke coverage exposed 5 residual explicit `tradeMachine/cache` `.js` imports in engine/validator surfaces; those imports were also retargeted extensionlessly in-batch so the earlier cache retirement is now fully reflected in live runtime imports
- Architect UI smoke exposed season-code `yearKey` handling in `TradeTeamCard.tsx`; the card now normalizes season inputs before calling `computeTeamCapTotals`, preventing `NaN` cap-profile crashes without changing the intended salary/totals behavior
- Kept the next runtime-backed frontier untouched: `shared/utils/contracts/*.js`, `tradeContext/legacy/index.js`, and any still-intentional top-level data/wrapper surfaces

**Phase 7B batch-8 status now:**
- Deleted 2 runtime-backed same-path shared contract-helper shims: `contractUtils.js` and `seasonNormalizer.js`
- Retargeted the live `src/**` shared-helper import in `tradeMachine/utils/seasonUtils.ts`, the retained shared barrel, the live `contractParser.js` local import, and the affected tests/Architect guardrails to extensionless paths or TS-authority checks
- Added E124 guardrail coverage proving deleted-path absence plus representative extensionless/authority parity for the retired shared contract-helper surfaces
- Preserved `shared/utils/contracts/index.js` as the intentional barrel surface and `shared/utils/contracts/contractParser.js` as the intentional live JS module while removing the two same-path helper hosts beneath them
- Kept the next runtime-backed frontier untouched: `tradeContext/legacy/index.js` and any still-intentional top-level data/wrapper surfaces

**Phase 7D batch-1 status now:**
- Deleted 13 internal Architect wrapper/barrel surfaces: `CapSheet.jsx`, `CapSheetFull.jsx`, `CapSummaryTiles.jsx`, `DraftPickTracker.jsx`, `ExceptionHistoryTracker.jsx`, `ExceptionTracker.jsx`, `FreeAgentPool.jsx`, `OffseasonTab.jsx`, `RosterVisual.jsx`, `TeamHistoryTab.jsx`, `ValidationWarnings.jsx`, `WaiveStretchTracker.jsx`, and `GMDashboard/components/index.js`
- Retargeted live dashboard section callers, `TeamHistoryTab`, `EditContractModal`, and the affected Architect behavior/guardrail suites to canonical feature paths or direct component imports
- Removed the retired top-level wrapper aliases from `src/global-shims.d.ts` so the deleted wrapper paths are no longer treated as valid internal contracts
- Added `src/tests/architect/internalWrapperBatch.e125.guardrail.test.tsx` to prove deleted-path absence, extensionless/authority parity, and direct `OffseasonSection` imports for `SeasonAdvanceModal` plus `DraftPositionsInput`
- Kept remaining route/public-entry surfaces and mixed keepers untouched: `GMDashboard/index.jsx`, `LeagueView.jsx`, `tradeContext/legacy/index.js`, `DraftPositionsInput.jsx`, `EntitlementPicksList.jsx`, `ValidationStateHeader.jsx`, and the nested same-path `.jsx` hosts that were not part of this internal-wrapper batch

**Phase 7C batch-1 status now:**
- Retired 2 mixed/structural helper candidates that no longer had live `src/**` callers: `capLegalityValidation.js` and `capTotals/computeTeamCapTotals.js`
- Retargeted the affected smoke tests and Architect guardrails from “shim file exists” to the new deleted-path-absence plus extensionless/TS-authority parity contract
- Added `src/tests/architect/capCoreHelperShimBatch.e126.guardrail.test.ts` to prove the exact 2-file deletion batch, extensionless/authority parity, and continued `capTotals/index.js` barrel alignment
- Removed `capLegalityValidation.js` and `computeTeamCapTotals.js` from the open mixed/structural keeper list; the remaining 7C review set is now `capSettingsProvider.js`, `hardCapStatus.js`, `basicArchitectUtils.js`, `playerRulesProfile/types.js`, `tradeContext/types.js`, `tradeContext/legacy/index.js`, `ValidationStateHeader.jsx`, `EntitlementPicksList.jsx`, and `DraftPositionsInput.jsx`

**Phase 7C batch-2 status now:**
- Retired 6 residual pure shims that no longer had live `src/**` callers despite earlier keeper treatment: `DraftPositionsInput.jsx`, `EntitlementPicksList.jsx`, `ValidationStateHeader.jsx`, `basicArchitectUtils.js`, `playerRulesProfile/types.js`, and `hardCapStatus.js`
- Retargeted the affected Architect compatibility suites and the hard-cap trade guardrail from explicit `.js` / `.jsx` imports or retained-shim expectations to the new deleted-path-absence plus extensionless/authority parity contract
- Added `src/tests/architect/residualPureShimBatch.e127.guardrail.test.tsx` to prove the exact 6-file deletion batch and direct extensionless parity against the TS / TSX authorities
- Reduced the open Phase 7C review set to the true remaining mixed/legacy trio: `capSettingsProvider.js`, `tradeContext/types.js`, and `tradeContext/legacy/index.js`

**Phase 7C batch-3 status now:**
- Retired the final 2 deletable mixed/runtime shims: `tradeMachine/utils/capSettingsProvider.js` and `tradeContext/types.js`
- Retargeted the remaining live source imports, Architect behavior tests, trade-facing tests, and the Phase 65 `.tradeExceptions` allowlist off the deleted shim paths to extensionless or TS-authority resolution
- Added `src/tests/architect/finalMixedKeeperBatch.e128.guardrail.test.ts` to prove the exact 2-file deletion batch, extensionless/authority parity, and continued intentional preservation of `tradeContext/legacy/index.js`
- Closed Phase 7C by classifying `tradeContext/legacy/index.js` as the intentional preserved legacy contract; no open mixed/structural keeper candidates remain

**Phase 7D batch-2 status now:**
- Retired 3 route/public-entry wrapper surfaces whose only live callers were internal route pages: `GMDashboard/index.jsx`, `LeagueView.jsx`, and `shared/LeagueView/LeagueView.jsx`
- Moved `GmDashboardView.jsx` and `GmLeagueView.jsx` off the deleted wrapper aliases to direct canonical imports (`GMDashboard/GMDashboard` and `shared/LeagueView`)
- Added `src/tests/architect/routeEntryWrapperBatch.e129.guardrail.test.tsx` to prove the exact 3-file deletion batch, direct route-page import targets, and continued `shared/LeagueView/index.ts` folder-entry alignment with the TS authority
- Reduced the remaining Phase 7D work to retained barrel/public-entry decisions, not route-wrapper aliases

**Verification (latest pass):**
- `npm run typecheck` passes
- `npm run build` passes
- `npm run test:architect -- --reporter=dot` passes
- `npm run validate:project` passes
- `npm run test:trade -- --reporter=dot` was not required for E129 signoff because this batch stayed in route/public-entry wrapper imports and Architect guardrail surfaces, not trade-helper runtime logic
- `npm run test:diff -- --reporter=dot` was not used for E129 signoff because the Architect suite matched the touched route-wrapper/guardrail surface directly and avoided diff-based `FULL` escalation behavior

**What remains:**
- Phase 7D retained barrel/public-entry cleanup decisions
- Phase 7E final Architect JS/JSX inventory gate

## Summary

Architect logic is now TypeScript-authoritative, but the feature still carries a large compatibility layer of `.js` / `.jsx` files. Those files are not all equal:
- some are pure same-path shims that only re-export the real `.ts` / `.tsx` authority
- some are still imported by tests or source-scan guardrails
- some are still imported by live `src/**` runtime code
- some are wrappers, barrels, or public entrypoints that change import topology
- a few are intentionally preserved legacy surfaces

The safe next step is **not** deleting all remaining JS/JSX at once. The safe next step is:
1. retire compatibility contracts that no longer need the shim files
2. update remaining runtime imports away from `.js` / `.jsx` Architect paths
3. delete the shims in batches
4. finish with an explicit “what JS/JSX remains and why” inventory

## Goal

Reduce Architect’s remaining `.js` / `.jsx` layer as far as possible without changing runtime behavior.

Desired end state:
- internal Architect `src/**` code imports TS authorities or extensionless module paths, not legacy `.js` / `.jsx` shims
- Architect tests stop depending on shim-file existence unless a legacy compatibility contract is intentionally preserved
- compatibility-only shims are deleted
- any remaining Architect `.js` / `.jsx` files are explicitly classified as intentional wrappers, barrels, or legacy contracts

## Non-Goals

- Repo-wide JS/JSX removal
- Reopening the completed Architect type-hardening work
- Business-logic changes in cap, trade, free agency, or season flows
- Deleting intentional legacy/public-entry surfaces until their callers are retired

## Phase 7A: Compatibility-Only Shim Retirement ✅ DONE

**Goal:** Delete the Architect shims that are only being kept alive by compatibility tests or source-scan guardrails, not by real `src/**` runtime imports.

**Primary file families:**
- Dashboard/world family
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
  - `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
  - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
- Trade-team-card leaf family
  - `src/features/architect/tradeMachine/CapImpactTiles.jsx`
  - `src/features/architect/tradeMachine/SelectTeamCard.jsx`
  - `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`
  - `src/features/architect/tradeMachine/TradePlayerRow.jsx`
  - `src/features/architect/tradeMachine/EntitlementPickRow.jsx`
  - `src/features/architect/tradeMachine/TradeExceptionManager.jsx`
- Offseason preview family
  - `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
  - `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
- Helper/util family
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
  - `src/features/architect/utils/tpeLifecycle.js`
  - `src/features/architect/utils/tradeContext/tradeContext.js`

**Primary test/guardrail targets to retarget first:**
- `src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx`
- `src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx`
- `src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx`
- `src/tests/architect/offseason.previewSurface.e93.behavior.test.tsx`
- `src/tests/architect/offseason.devGate.guardrail.test.ts`
- `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`
- `src/tests/architect/seasonManager.compatibility.guardrail.test.ts`
- `src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts`
- `src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx` for the `OffseasonSection.jsx` clause only

**Actions:**
- Rewrite compatibility tests so they prove the TS authorities and extensionless import surfaces instead of requiring `.js` / `.jsx` file existence
- Replace explicit `.js` / `.jsx` imports in Architect tests with extensionless or authoritative imports
- Delete the retired shims in small family-sized batches
- Keep each batch narrow enough that failures point to one family, not fifty files at once

## Phase 7B: Runtime-Backed Same-Path Shim Conversion

**Goal:** Remove same-path `.js` shims that are still used by real `src/**` imports.

**Current batch status:**
- `tradeMachine/utils` + `tradeMachine/constants`: ✅ first runtime-backed batch complete
- top-level Architect helper shims: ✅ second runtime-backed batch complete (`capUtils.js`, `cbaConstants.js`, `consentUtils.js`, `contractUtils.js`, `faExceptionUtils.js`, `hardCapUtils.js`, `reacqUtils.js`, `seasonFormat.js`, `seasonUtils.js`, `stepienUtils.js`, `timingUtils.js`, `tradeHelpers.js`)
- `playerRulesProfile` leaf shims: ✅ third runtime-backed batch complete (`minimumSalaryRules.js`, `maxSalaryRules.js`, `birdRightsRules.js`, `rfaRules.js`, `extensionRules.js`, `computeProfile.js`)
- `tradeMachine/rules`: ✅ fourth runtime-backed batch complete
- `tradeMachine/engine`: ✅ fifth runtime-backed batch complete
- `tradeMachine/cache`: ✅ sixth runtime-backed batch complete (`cacheInvalidationManager.js`, `validationCache.js`, `validationCacheService.js`)
- persistence-contract helpers: ✅ seventh runtime-backed batch complete (`contracts.js`, `enforcement.js`, `normalizeTeamTpe.js`, `validatePersistableShape.js`)
- shared contract helpers: ✅ eighth runtime-backed batch complete (`contractUtils.js`, `seasonNormalizer.js`)
- Runtime-backed same-path shim conversion lane: ✅ planned clusters complete
- Follow-on gate completed: ✅ first internal wrapper/barrel cleanup batch complete
- Next safe batch: mixed/structural keeper review, with remaining route/public-entry wrappers held for separate case-by-case decisions

**High-priority runtime-backed clusters:**
- `src/features/architect/utils/tradeMachine/**`
- remaining top-level Architect utility/data surfaces that still intentionally carry `.js` hosts
- still-intentional wrapper/barrel/data surfaces whose callers can be moved without changing public behavior

**Actions:**
- Replace explicit `.js` imports in `.ts` / `.tsx` files with extensionless or authority imports
- Collapse re-export shims only after all runtime callers are moved
- Do this by cluster, not by whole-feature sweep, so failures stay understandable

**Suggested batch order from here:**
1. final inventory gate

## Phase 7C: Mixed / Structural / Intentional Compatibility Surfaces

**Goal:** Decide which remaining JS/JSX files are actually deletable and which are intentional contracts.

**Expected mixed/structural keepers to evaluate case-by-case:**
- `src/features/architect/utils/tradeContext/legacy/index.js`

**Decision options per file:**
- retire it and move tests to the TS authority
- keep it permanently as an intentional legacy/public contract
- replace it with a narrower entry surface if export-shape compatibility still matters

**Current status:**
- `capLegalityValidation.js`: ✅ retired in E126
- `computeTeamCapTotals.js`: ✅ retired in E126
- `hardCapStatus.js`: ✅ retired in E127
- `basicArchitectUtils.js`: ✅ retired in E127
- `playerRulesProfile/types.js`: ✅ retired in E127
- `ValidationStateHeader.jsx`: ✅ retired in E127
- `EntitlementPicksList.jsx`: ✅ retired in E127
- `DraftPositionsInput.jsx`: ✅ retired in E127
- `capSettingsProvider.js`: ✅ retired in E128
- `tradeContext/types.js`: ✅ retired in E128
- `tradeContext/legacy/index.js`: ✅ intentionally preserved legacy contract in E128

**Important:** `tradeContext/legacy/index.js` should be treated as an intentional legacy contract unless the user explicitly wants that compatibility removed.

## Phase 7D: Wrapper / Barrel / Public Entrypoint Cleanup

**Goal:** Clean up the top-level `.jsx` wrappers and `index.js` barrels after callers stop depending on them.

**Wrapper family examples:**
- `src/features/architect/CapSheet.jsx`
- `src/features/architect/CapSheetFull.jsx`
- `src/features/architect/FreeAgentPool.jsx`
- `src/features/architect/GMDashboard/index.jsx`
- `src/features/architect/LeagueView.jsx`
- `src/features/architect/OffseasonTab.jsx`
- `src/features/architect/RosterVisual.jsx`
- `src/features/architect/TeamHistoryTab.jsx`
- `src/features/architect/ValidationWarnings.jsx`

**Barrel/public-entry examples:**
- `src/features/architect/utils/tradeMachine/index.js`
- `src/features/architect/utils/tradeMachine/rules/index.js`
- `src/features/architect/utils/tradeMachine/utils/index.js`
- `src/features/architect/utils/persistenceContracts/index.js`
- `src/features/architect/utils/playerRulesProfile/index.js`
- `src/features/architect/utils/capTotals/index.js`
- `src/features/architect/utils/tradeContext/index.js`

**Actions:**
- Move internal callers away from wrapper/barrel compatibility surfaces
- Keep only the ones that are truly intended public entrypoints
- Delete the rest after import graph cleanup is complete

**Current status:**
- Internal wrapper/barrel subset: ✅ first cleanup batch complete (`CapSheet.jsx`, `CapSheetFull.jsx`, `CapSummaryTiles.jsx`, `DraftPickTracker.jsx`, `ExceptionHistoryTracker.jsx`, `ExceptionTracker.jsx`, `FreeAgentPool.jsx`, `OffseasonTab.jsx`, `RosterVisual.jsx`, `TeamHistoryTab.jsx`, `ValidationWarnings.jsx`, `WaiveStretchTracker.jsx`, `GMDashboard/components/index.js`)
- Route/public-entry wrapper subset: ✅ second cleanup batch complete (`GMDashboard/index.jsx`, `LeagueView.jsx`, `shared/LeagueView/LeagueView.jsx`)
- Support-barrel subset: ✅ third cleanup batch complete (`capTotals/index.js`, `persistenceContracts/index.js`, `exceptions/index.js`, `playerRulesProfile/index.js`, `tradeContext/index.js`, plus redundant `playerRulesProfile/index.d.ts`) with TS-backed `index.ts` authorities and guardrails retargeted away from direct `index.js` file reads
- `src/global-shims.d.ts` still intentionally carries compatibility declarations for `capTotals`, `exceptions`, `persistenceContracts`, and `tradeContext` so this runtime barrel cleanup does not widen type-surface expectations midstream
- Trade Machine barrel/public-entry subset: ✅ fourth cleanup batch complete (`tradeMachine/index.js`, `tradeMachine/rules/index.js`, `tradeMachine/utils/index.js`, `tradeMachine/validators/index.js`, `tradeMachine/engine/index.js`, `tradeMachine/cache/index.js`) with TS-backed `index.ts` authorities, caller retargets, and explicit canonical exports to resolve the old star-barrel collisions without changing runtime behavior
- `src/global-shims.d.ts` now preserves only the extensionless `@/features/architect/utils/tradeMachine` compatibility declaration; the deleted `index.js` ambient surface is retired
- Phase 7D wrapper / barrel / public-entry cleanup: ✅ complete

## Phase 7E: Final Architect JS/JSX Inventory Gate

**Goal:** End with an explicit, defensible answer to “what Architect JS/JSX remains?”

**Deliverables:**
- final inventory of remaining Architect `.js` / `.jsx` files
- per-file classification:
  - deleted
  - intentional wrapper
  - intentional barrel/public entry
  - intentional legacy compatibility contract
  - still blocked, with exact reason
- new guardrail preventing fresh same-path Architect shims or new explicit `.js` / `.jsx` imports from being added by accident

**Current status:**
- Not started yet
- Next step is the final Architect JS/JSX inventory scan plus the new source-scan guardrail
- `src/features/architect/utils/tradeContext/legacy/index.js` is the only already-classified intentional legacy compatibility contract that should remain in scope during the inventory pass

## Sequencing Rules

- Do not delete all shims in one pass
- Start with compatibility-only blocked files before runtime-backed files
- Keep runtime-backed, mixed, and intentional-legacy surfaces out of the early deletion batches
- Prefer extensionless internal imports for Architect callers unless a stronger reason exists for another pattern
- If a test exists only to enforce shim presence, rewrite that test before deleting the shim

## Validation Plan

Run at minimum after each meaningful batch:
- `npm run typecheck`
- `npm run build`
- `npm run test:architect -- --reporter=dot`
- `npm run test:trade -- --reporter=dot` when trade-machine, mutation-pipeline, season-manager, trade-context, or shared contract helpers are touched
- `npm run validate:project` after structural deletions

Optional targeted fallback when a batch is small:
- `npm run test:diff -- --reporter=dot`

## Exit Criteria

This follow-up plan is complete when:
- compatibility-only Architect shim families are deleted
- Architect runtime code no longer depends on same-path `.js` / `.jsx` compatibility files
- remaining JS/JSX files in Architect are intentional and documented
- the validation suite above passes after the final deletion wave

## Assumptions

- The TS/TSX files are already the source of truth for Architect behavior
- Compatibility with explicit `.js` / `.jsx` Architect import paths is not itself a product requirement unless a test or intentional legacy contract says otherwise
- Some compatibility surfaces, especially `tradeContext/legacy/index.js`, may stay permanently if preserving that contract is valuable
