# Salary Engine Audit & Integration Plan

**Created**: 2025-12-12
**Status**: Analysis Complete
**Scope**: Audit existing salary-related logic, design consolidation layer

---

## Executive Summary

After a comprehensive audit of the Architect salary-related logic, the existing codebase is **already well-organized** around the `playerRulesProfile` module. Rather than building a new "Salary Engine" from scratch, the recommended approach is to:

1. **Promote `playerRulesProfile` as the canonical Salary Engine**
2. **Add missing RuleContext integration to a few remaining functions**
3. **Deprecate redundant legacy functions**
4. **Create thin wrapper exports for ergonomic access**

---

## Step 1: Inventory of Existing Salary-Related Logic

### Core Salary Module: `playerRulesProfile/`
**Location**: `src/features/architect/utils/playerRulesProfile/`

| File | Function(s) | Purpose | Season Handling | Centrality |
|------|-------------|---------|-----------------|------------|
| `index.js` | Re-exports | Entry point | N/A | **High** |
| `computeProfile.js` | `computePlayerRulesProfile()` | Main orchestrator | Uses `leagueContext.currentYear`, normalizes via `getCurrentSeasonId()` | **High** |
| `maxSalaryRules.js` | `computeMaxSalary()`, `computeMaxSalaryFromRuleContext()` | Max salary by YOS | **Supports both legacy (player, leagueContext) and RuleContext** | **High** |
| `minimumSalaryRules.js` | `computeMinimumSalary()`, `computeMinimumSalaryFromRuleContext()`, `getMinimumCapHit()` | Min salary scales | **Supports both legacy and RuleContext** | **High** |
| `birdRightsRules.js` | `computeBirdRights()` | Bird rights classification | Uses `leagueContext.currentYear`, warns on missing | **High** |
| `extensionRules.js` | `computeExtensionEligibility()`, `computeExtensionTerms()` | Extension rules | Uses `leagueContext.currentYear`, `simulationDate` | **High** |
| `rfaRules.js` | `computeRFAStatus()`, `computeQualifyingOffer()` | RFA/QO logic | Uses `leagueContext.currentYear` | **High** |
| `types.js` | Type definitions | JSDoc types | N/A | Reference |

### Supporting Infrastructure

| File | Function(s) | Purpose | Season Handling |
|------|-------------|---------|-----------------|
| `data/minimumSalaryScales.ts` | `MINIMUM_SALARY_SCALES` | Min salary data | SeasonId keyed |
| `utils/capHelpers.ts` | `getCapForSeason()`, `getMinimumSalaryScale()` | Cap data lookups | SeasonId based |
| `utils/seasonHelpers.ts` | `SeasonId` type, parsing, normalization | Season utilities | Canonical format |
| `utils/capProjections.js` | `capProjections` | Multi-year cap data | SeasonId keyed |
| `utils/buildRuleContext.ts` | `buildRuleContextForPlayerMove()` | RuleContext builder | Full timing model |

### Legacy/Duplicate Functions

| File | Function(s) | Purpose | Season Handling | Issue |
|------|-------------|---------|-----------------|-------|
| `utils/extensionRules.js` | `isExtensionEligible()`, `getExtensionMaxDetails()` | Extension rules (legacy) | Uses `new Date()` directly | **DUPLICATE** - overlaps with `playerRulesProfile/extensionRules.js` |
| `utils/contractUtils.js` | `getMinimumSalary()`, `createMaxContract()` | Contract generation | Hard-coded values | **LEGACY** - uses hard-coded scales |
| `utils/freeAgentLogic.js` | `canSignFreeAgent()` | FA signing rules | Uses year parameter | **SIMPLE** - needs RuleContext |

### Hooks Using Profile Logic

| File | Function(s) | Purpose | Uses RuleContext? |
|------|-------------|---------|-------------------|
| `hooks/usePlayerRulesProfiles.js` | `usePlayerRulesProfiles()` | React hook for profiles | No - uses leagueContext |
| `hooks/useCapValidation.js` | `useCapValidation()` | Contract validation | No - calls both new and legacy |

---

## Step 2: Function Classification

### ✅ KEEP_AND_WRAP (Already canonical, minor adjustments needed)

| Function | Location | Assessment |
|----------|----------|------------|
| `computePlayerRulesProfile()` | `playerRulesProfile/computeProfile.js` | **Core orchestrator** - already uses normalized context, queries capHelpers |
| `computeMaxSalary()` | `playerRulesProfile/maxSalaryRules.js` | **Already dual-mode** - supports both (player, leagueContext) and RuleContext |
| `computeMinimumSalary()` | `playerRulesProfile/minimumSalaryRules.js` | **Already dual-mode** - supports both calling conventions |
| `getMinimumCapHit()` | `playerRulesProfile/minimumSalaryRules.js` | **Trade-specific** - correct 2-year veteran rule |
| `computeBirdRights()` | `playerRulesProfile/birdRightsRules.js` | **Good** - uses currentYear from context, warns on missing |
| `computeExtensionEligibility()` | `playerRulesProfile/extensionRules.js` | **Good** - uses leagueContext properly |
| `computeExtensionTerms()` | `playerRulesProfile/extensionRules.js` | **Good** - respects capSettings |
| `computeRFAStatus()` | `playerRulesProfile/rfaRules.js` | **Good** - validates currentYear presence |
| `computeQualifyingOffer()` | `playerRulesProfile/rfaRules.js` | **Good** - uses min salary scale correctly |
| `getCapForSeason()` | `utils/capHelpers.ts` | **Infrastructure** - returns CapContext |
| `buildRuleContextForPlayerMove()` | `utils/buildRuleContext.ts` | **Infrastructure** - full RuleContext builder |

### 🔧 REFINE_IN_PLACE (Small fixes needed)

| Function | Location | Issue | Fix |
|----------|----------|-------|-----|
| `computeBirdRights()` | `playerRulesProfile/birdRightsRules.js` | No RuleContext variant | Add `computeBirdRightsFromRuleContext()` |
| `computeExtensionEligibility()` | `playerRulesProfile/extensionRules.js` | No RuleContext variant | Add `computeExtensionFromRuleContext()` |
| `computeRFAStatus()` | `playerRulesProfile/rfaRules.js` | No RuleContext variant | Add `computeRFAFromRuleContext()` |
| `useCapValidation()` | `hooks/useCapValidation.js` | Mixes legacy and new APIs | Unify on rulesProfile |

### ❌ DEPRECATE_OR_REPLACE

| Function | Location | Issue | Action |
|----------|----------|-------|--------|
| `isExtensionEligible()` | `utils/extensionRules.js` | **Duplicate** of `playerRulesProfile/extensionRules.js` | Mark deprecated, redirect callers |
| `getExtensionEligibilityReason()` | `utils/extensionRules.js` | **Duplicate** | Mark deprecated |
| `getExtensionMaxDetails()` | `utils/extensionRules.js` | **Duplicate** | Mark deprecated |
| `getMinimumSalary()` | `utils/contractUtils.js` | **Hard-coded values** | Replace with `getMinimumSalaryScale()` |
| `createMaxContract()` | `utils/contractUtils.js` | **Hard-coded percentages** | Update to use `computeMaxSalary()` |

---

## Step 3: Salary Engine Design

### Design Philosophy

The "Salary Engine" is **NOT a new parallel system**. It is:
1. A **thin organizational layer** exposing the existing `playerRulesProfile` functions
2. A **single entry point** for all salary-related calculations
3. A **RuleContext-aware facade** that handles context building internally

### Module Location

```plaintext
src/features/architect/utils/salaryEngine/
├── index.ts           # Main exports (re-exports from submodules)
├── salaryEngine.ts    # Thin wrappers that handle context building
├── types.ts           # Re-export RuleContext types
└── README.md          # Module documentation
```

### Proposed Exports

```typescript
// src/features/architect/utils/salaryEngine/index.ts

// ============= Profile Functions (delegated to playerRulesProfile) =============
export { computePlayerRulesProfile } from '../playerRulesProfile';
export { computeMaxSalary, computeMaxSalaryFromRuleContext, MAX_SALARY_TIERS } from '../playerRulesProfile';
export { computeMinimumSalary, computeMinimumSalaryFromRuleContext, getMinimumCapHit, getYearsOfService } from '../playerRulesProfile';
export { computeBirdRights, BIRD_RIGHTS_TYPES } from '../playerRulesProfile';
export { computeExtensionEligibility, computeExtensionTerms, EXTENSION_TYPES } from '../playerRulesProfile';
export { computeRFAStatus, computeQualifyingOffer, RFA_STATUS } from '../playerRulesProfile';

// ============= Context Builders =============
export { buildRuleContextForPlayerMove, buildMinimalRuleContext } from '../buildRuleContext';

// ============= Cap Data Lookups =============
export { getCapForSeason, getMinimumSalaryScale, hasCapDataForSeason } from '../capHelpers';

// ============= Types =============
export type { RuleContext, PlayerContext, TeamContext, TimingContext, CapContext } from '../../types/ruleContext';
export type { SeasonId } from '../seasonHelpers';

// ============= Convenience Wrappers (new) =============

/**
 * Get complete salary profile for a player using RuleContext
 */
export function getSalaryProfile(ctx: RuleContext): SalaryProfile;

/**
 * Get max salary for a player using RuleContext
 */
export function getMaxSalaryProfile(ctx: RuleContext): MaxSalaryInfo;

/**
 * Get minimum salary for a player using RuleContext
 */
export function getMinSalaryProfile(ctx: RuleContext): MinSalaryInfo;

/**
 * Get Bird rights profile for a player using RuleContext
 */
export function getBirdRightsProfile(ctx: RuleContext): BirdRightsInfo;

/**
 * Get extension eligibility and terms using RuleContext
 */
export function getExtensionProfile(ctx: RuleContext): ExtensionProfile;
```

### Implementation: Thin Wrappers

```typescript
// src/features/architect/utils/salaryEngine/salaryEngine.ts

import { computeMaxSalaryFromRuleContext } from '../playerRulesProfile/maxSalaryRules';
import { computeMinimumSalaryFromRuleContext } from '../playerRulesProfile/minimumSalaryRules';
// ... other imports

export interface SalaryProfile {
  maxSalary: MaxSalaryInfo;
  minSalary: MinSalaryInfo;
  birdRights: BirdRightsInfo;
  extension: ExtensionProfile | null;
  rfa: RFAInfo;
}

/**
 * Get complete salary profile using RuleContext
 * This is the primary entry point for Salary Engine consumers.
 */
export function getSalaryProfile(ctx: RuleContext): SalaryProfile {
  return {
    maxSalary: computeMaxSalaryFromRuleContext(ctx),
    minSalary: computeMinimumSalaryFromRuleContext(ctx),
    birdRights: computeBirdRightsFromRuleContext(ctx), // needs to be added
    extension: computeExtensionFromRuleContext(ctx),   // needs to be added
    rfa: computeRFAFromRuleContext(ctx),               // needs to be added
  };
}

// Individual profile getters delegate directly
export const getMaxSalaryProfile = computeMaxSalaryFromRuleContext;
export const getMinSalaryProfile = computeMinimumSalaryFromRuleContext;
// ... etc
```

---

## Step 4: Integration Plan for Architect Flows

### Current Call Sites

| Component/Hook | Current Usage | Proposed Change |
|----------------|---------------|-----------------|
| `usePlayerRulesProfiles.js` | Calls `computePlayerRulesProfile()` | **No change** - already uses canonical function |
| `useCapValidation.js` | Mixes legacy and new | **Update**: Remove legacy `getExtensionEligibilityReason()` calls, use `rulesProfile` exclusively |
| `GMDashboard.jsx` | Uses `usePlayerRulesProfiles` | **No change** |
| `EditContractModal.jsx` | Uses `computePlayerRulesProfile` | **No change** |
| `CapSheet*.jsx` | Uses hooks | **No change** |

### Integration Points

1. **playerRulesProfile** → Already the canonical source, will be re-exported via salaryEngine
2. **Cap Manager flows** → Should call `getSalaryProfile(ctx)` instead of building contexts manually
3. **Trade Machine** → Uses `getMinimumCapHit()` correctly, no change needed
4. **FA Signing** → `canSignFreeAgent()` should be updated to use RuleContext internally

### UI Components Doing Business Logic

| Component | Issue | Fix |
|-----------|-------|-----|
| `FreeAgentCard.jsx` | May have inline Bird logic | Should call `getBirdRightsProfile()` |
| `OffseasonTab.jsx` | May compute salaries inline | Should use `getSalaryProfile()` |

---

## Step 5: Conflicts & Duplication Risks

### Critical Duplication

| Risk | Files Involved | Resolution |
|------|----------------|------------|
| **Two extension rule systems** | `utils/extensionRules.js` vs `playerRulesProfile/extensionRules.js` | Deprecate `utils/extensionRules.js`, update `useCapValidation` |
| **Two min salary functions** | `contractUtils.getMinimumSalary()` vs `minimumSalaryRules.computeMinimumSalary()` | Deprecate `contractUtils.getMinimumSalary()` |
| **Hard-coded values** | `contractUtils.js` has hard-coded scales | Update to use centralized `MINIMUM_SALARY_SCALES` |

### Landmines to Resolve

1. **`useCapValidation` mixed paths**: Currently calls both `rulesProfile.extensionEligibility` AND `getExtensionEligibilityReason()` depending on whether profile exists
   - **Fix**: Always use rulesProfile, fall back gracefully if not provided

2. **`contractUtils.js` hard-coded scales**: `rookieScale` and `getMinimumSalary()` use hard-coded 2024 values
   - **Fix**: Update to use `getMinimumSalaryScale(season)` from `data/minimumSalaryScales.ts`

3. **Date-based vs context-based timing**: Some functions use `new Date()` directly
   - **Fix**: Ensure all functions accept timing from context, not system clock

---

## Step 6: Phased Implementation Plan

### Phase 1: Create Salary Engine Module (Wrapping)
**Scope**: ~2-3 hours
**Goal**: Create thin wrapper layer without changing any logic

1. Create `src/features/architect/utils/salaryEngine/` directory
2. Create `index.ts` re-exporting all existing functions from `playerRulesProfile`
3. Create `salaryEngine.ts` with convenience wrappers
4. Create `README.md` documenting module purpose
5. Add TypeScript types for wrapper functions
6. **No behavioral changes** - purely organizational

### Phase 2: Add RuleContext Variants
**Scope**: ~3-4 hours
**Goal**: Add `*FromRuleContext` variants to remaining functions

1. Add `computeBirdRightsFromRuleContext()` to `birdRightsRules.js`
2. Add `computeExtensionFromRuleContext()` to `extensionRules.js`
3. Add `computeRFAFromRuleContext()` to `rfaRules.js`
4. Update salaryEngine exports to include new variants
5. Add tests for new variants

### Phase 3: Update Consumers & Deprecate Legacy
**Scope**: ~2-3 hours
**Goal**: Unify on new API, mark legacy deprecated

1. Update `useCapValidation.js` to use rulesProfile exclusively
2. Add `@deprecated` JSDoc to functions in `utils/extensionRules.js`
3. Update `contractUtils.js` to use centralized scales
4. Add deprecation warnings to legacy function calls

### Deprecation & Migration

| Deprecated Function | Location | Deprecated In | Removal Target | Migration Path |
|---------------------|----------|---------------|----------------|----------------|
| `isExtensionEligible()` | `utils/extensionRules.js` | Phase 3 | v2.0 or 6 months | Use `rulesProfile.extensionEligibility.isEligible` |
| `getExtensionEligibilityReason()` | `utils/extensionRules.js` | Phase 3 | v2.0 or 6 months | Use `rulesProfile.extensionEligibility.reason` |
| `getExtensionMaxDetails()` | `utils/extensionRules.js` | Phase 3 | v2.0 or 6 months | Use `rulesProfile.extensionTerms` |
| `getMinimumSalary()` | `utils/contractUtils.js` | Phase 3 | v2.0 or 6 months | Use `computeMinimumSalary()` from `playerRulesProfile` |
| `createMaxContract()` (hard-coded) | `utils/contractUtils.js` | Phase 3 | v2.0 or 6 months | Update internally to use `computeMaxSalary()` |

**Caller Migration Steps:**

1. **For `utils/extensionRules.js` callers:**
   - Replace `isExtensionEligible(player, year)` with `computePlayerRulesProfile(player, {}, leagueContext).extensionEligibility.isEligible`
   - Replace `getExtensionMaxDetails(player, capSettings)` with `computePlayerRulesProfile(player, {}, leagueContext).extensionTerms`

2. **For `useCapValidation.js`:**
   - Remove fallback to `getExtensionEligibilityReason()` when `rulesProfile` is missing
   - Always require `rulesProfile` parameter OR gracefully return empty validation when missing
   - Fallback behavior: If `rulesProfile` is null/undefined, return `{ warnings: [], errors: [], isValid: true }` with a console warning

3. **For `contractUtils.js` hard-coded scales:**
   - Migration will be **atomic** (single commit) since the function internals change but signature stays the same
   - Rollback: If issues arise, revert the single commit; no phased rollback needed
   - The hard-coded `rookieScale` object stays but `getMinimumSalary()` will delegate to centralized `MINIMUM_SALARY_SCALES`

### Test Coverage Strategy

| Phase | Tests to Add/Modify |
|-------|---------------------|
| Phase 1 | **No new tests** - purely re-exports, existing tests cover underlying functions |
| Phase 2 | **Unit tests for each `*FromRuleContext` variant**: `birdRightsRules.test.js` (add `computeBirdRightsFromRuleContext` tests), `extensionRules.test.js` (add `computeExtensionFromRuleContext` tests), `rfaRules.test.js` (add `computeRFAFromRuleContext` tests) |
| Phase 3 | **Update `useCapValidation.test.js`**: Assert rulesProfile-only behavior, test fallback when rulesProfile is null/undefined returns empty validation, remove tests for legacy code paths |
| Phase 4 | **Integration tests**: Add `salaryEngine.integration.test.ts` testing full `getSalaryProfile()` flow with mock player data |

**Test Assertions for Phase 3 (`useCapValidation`):**
- When `rulesProfile` provided: validation uses profile values exclusively
- When `rulesProfile` missing: returns `{ warnings: [], errors: [], isValid: true }` (no blocking validation)
- No calls to legacy `getExtensionEligibilityReason()` in any code path

### Phase 4: Tests & Documentation
**Scope**: ~2 hours
**Goal**: Ensure coverage and document API

1. Add unit tests for `salaryEngine` wrappers
2. Test RuleContext integration in existing test files
3. Update `DEVELOPER_GUIDE.md` with salaryEngine usage
4. Create `docs/api/salaryEngine.md` API reference

---

## Files to Create/Modify

### New Files
- `src/features/architect/utils/salaryEngine/index.ts`
- `src/features/architect/utils/salaryEngine/salaryEngine.ts`
- `src/features/architect/utils/salaryEngine/types.ts`
- `src/features/architect/utils/salaryEngine/README.md`

### Modified Files (Phase 2-3)
- `src/features/architect/utils/playerRulesProfile/birdRightsRules.js` - add RuleContext variant
- `src/features/architect/utils/playerRulesProfile/extensionRules.js` - add RuleContext variant
- `src/features/architect/utils/playerRulesProfile/rfaRules.js` - add RuleContext variant
- `src/features/architect/hooks/useCapValidation.js` - unify on rulesProfile
- `src/features/architect/utils/extensionRules.js` - mark deprecated
- `src/features/architect/utils/contractUtils.js` - use centralized scales

---

## Summary

The existing `playerRulesProfile` module is **already a well-designed Salary Engine**. The work needed is:

1. **Organizational**: Create a `salaryEngine/` facade for cleaner imports
2. **Completion**: Add RuleContext variants to 3 functions (Bird, Extension, RFA)
3. **Cleanup**: Deprecate legacy duplicates and hard-coded values
4. **Integration**: Update `useCapValidation` to use unified API

This approach:
- ✅ Reuses all existing correct logic
- ✅ Avoids parallel/competing implementations
- ✅ Maintains backward compatibility
- ✅ Provides clean RuleContext-based API
- ✅ Minimal code changes, maximum consolidation
