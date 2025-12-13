# Salary Engine

The Salary Engine is the canonical entry point for all salary-related calculations in the Architect feature. It provides a unified API that wraps the existing `playerRulesProfile` module and adds RuleContext-based entry points for consistent timing and cap handling.

## Overview

The Salary Engine consolidates salary logic that was previously scattered across multiple files. It follows these design principles:

1. **No Duplication**: All calculation logic lives in `playerRulesProfile` - this module wraps, not reimplements
2. **RuleContext-first**: New entry points accept `RuleContext` for consistent timing and cap data
3. **Backward Compatible**: Legacy functions are still accessible via re-exports
4. **Single Source of Truth**: UI and feature code should use Salary Engine instead of calling scattered helpers directly

## Rules of the road

- **For new code: ALWAYS import from `salaryEngine`**:
  - ✅ `import { getMaxSalaryProfile } from '@/features/architect/utils/salaryEngine'`
  - ❌ `import { computeMaxSalary } from '@/features/architect/utils/playerRulesProfile'`
- **`playerRulesProfile` is internal implementation**. It can change without notice; the stable surface is `salaryEngine`.
- **Prefer RuleContext-based entry points when timing matters** (trade vs signing vs in-season, cap season vs reference season, etc.). Build a `RuleContext` and use `get*Profile(ctx)` functions.

### Example: max salary

```typescript
import {
  buildRuleContextForPlayerMove,
  getMaxSalaryProfile,
} from '@/features/architect/utils/salaryEngine';

const ctx = buildRuleContextForPlayerMove({
  player,
  teamState,
  operationType: 'UFA_SIGNING',
  operationSeasonId: '2026-27',
});

const maxInfo = getMaxSalaryProfile(ctx);
console.log(maxInfo.maxSalary, maxInfo.supermaxEligible);
```

### Example: Bird rights

```typescript
import {
  buildRuleContextForPlayerMove,
  getBirdRightsProfile,
} from '@/features/architect/utils/salaryEngine';

const ctx = buildRuleContextForPlayerMove({
  player,
  teamState,
  operationType: 'UFA_SIGNING',
  operationSeasonId: '2026-27',
});

const bird = getBirdRightsProfile(ctx);
console.log(bird.type);
```

### Example: extension eligibility

```typescript
import {
  buildRuleContextForPlayerMove,
  getExtensionProfile,
} from '@/features/architect/utils/salaryEngine';

const ctx = buildRuleContextForPlayerMove({
  player,
  teamState,
  operationType: 'VETERAN_EXTENSION',
  operationSeasonId: '2026-27',
});

const extension = getExtensionProfile(ctx);
console.log(extension.eligibility.isEligible, extension.eligibility.reason);
```

## Quick Start

```typescript
import {
  getSalaryProfile,
  buildRuleContextForPlayerMove,
} from '@/features/architect/utils/salaryEngine';

// Build a RuleContext for the operation
const ctx = buildRuleContextForPlayerMove({
  player: playerData,
  teamState: teamState,
  operationType: 'UFA_SIGNING',
  operationSeasonId: '2026-27',
});

// Get complete salary profile
const profile = getSalaryProfile(ctx);

console.log(profile.maxSalary.maxSalary); // Max salary amount
console.log(profile.birdRights.type); // 'Full Bird', 'Early Bird', etc.
console.log(profile.extension.eligibility); // Extension eligibility info
console.log(profile.rfa.isRFA); // RFA status
```

## API Reference

### Primary Entry Points

| Function                    | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `getSalaryProfile(ctx)`     | Get complete salary profile (max, min, bird, extension, rfa) |
| `getMaxSalaryProfile(ctx)`  | Get max salary based on YOS and supermax eligibility         |
| `getMinSalaryProfile(ctx)`  | Get minimum salary based on YOS and season                   |
| `getBirdRightsProfile(ctx)` | Get Bird rights classification and signing abilities         |
| `getExtensionProfile(ctx)`  | Get extension eligibility and terms                          |
| `getRFAProfile(ctx)`        | Get RFA status and qualifying offer info                     |

### Context Builders

| Function                               | Description                                       |
| -------------------------------------- | ------------------------------------------------- |
| `buildRuleContextForPlayerMove(input)` | Build complete RuleContext for a player operation |
| `buildMinimalRuleContext(seasonId)`    | Build cap-only context for quick lookups          |

### Legacy Functions (Re-exported)

For backward compatibility, all `playerRulesProfile` functions are re-exported:

- `computeMaxSalary`, `computeMaxSalaryFromRuleContext`
- `computeMinimumSalary`, `computeMinimumSalaryFromRuleContext`
- `computeBirdRights`, `computeBirdRightsFromRuleContext`
- `computeExtensionEligibility`, `computeExtensionTerms`, `computeExtensionFromRuleContext`
- `computeRFAStatus`, `computeQualifyingOffer`, `computeRFAFromRuleContext`
- `computePlayerRulesProfile`

## RuleContext

The `RuleContext` object provides all necessary context for salary calculations:

```typescript
interface RuleContext {
  timing: {
    operationSeasonId: SeasonId; // Season the operation applies to
    referenceSeasonId: SeasonId; // Season for prior salary lookups
    capSeasonId: SeasonId; // Season for cap thresholds
    phase: LeaguePhase; // 'offseason', 'regular', etc.
    operationDate: Date; // Date/time of operation
  };
  player: {
    playerId: string;
    yearsOfServiceAtOperation: number;
    birdTypeAtOperation: BirdType;
    priorSeasonSalary: number | null;
    maxPercentBucket: 0.25 | 0.3 | 0.35;
    isRookieScale: boolean;
    // ... more fields
  };
  team: TeamContext;
  operation: OperationContext;
  cap: CapContext;
}
```

## Migration Guide

### From Direct `playerRulesProfile` Calls

Before:

```typescript
import { computeMaxSalary } from '@/features/architect/utils/playerRulesProfile';

const maxInfo = computeMaxSalary(player, leagueContext);
```

After:

```typescript
import {
  getMaxSalaryProfile,
  buildRuleContextForPlayerMove,
} from '@/features/architect/utils/salaryEngine';

const ctx = buildRuleContextForPlayerMove({
  player,
  teamState,
  operationType: 'UFA_SIGNING',
  operationSeasonId: '2026-27',
});
const maxInfo = getMaxSalaryProfile(ctx);
```

### From Legacy `extensionRules.js`

The functions in `src/features/architect/utils/extensionRules.js` are **deprecated**. Use the Salary Engine instead:

| Deprecated                                    | Replacement                                       |
| --------------------------------------------- | ------------------------------------------------- |
| `isExtensionEligible(player, year)`           | `getExtensionProfile(ctx).eligibility.isEligible` |
| `getExtensionEligibilityReason(player, year)` | `getExtensionProfile(ctx).eligibility.reason`     |
| `getExtensionMaxDetails(player, caps)`        | `getExtensionProfile(ctx).terms`                  |

## File Structure

```text
src/features/architect/utils/salaryEngine/
├── index.ts           # Main exports (re-exports from submodules)
├── salaryEngine.ts    # Thin wrappers that handle RuleContext
├── types.ts           # TypeScript type definitions
└── README.md          # This file
```

## Related Modules

- `playerRulesProfile/` - Contains the actual calculation logic (wrapped by Salary Engine)
- `buildRuleContext.ts` - RuleContext builder
- `capHelpers.ts` - Cap data lookups
- `seasonHelpers.ts` - Season ID utilities

## Deprecated Functions

The following functions are deprecated and should not be used for new code:

| Function                          | Location                  | Migration                   |
| --------------------------------- | ------------------------- | --------------------------- |
| `isExtensionEligible()`           | `utils/extensionRules.js` | Use `getExtensionProfile()` |
| `getExtensionEligibilityReason()` | `utils/extensionRules.js` | Use `getExtensionProfile()` |
| `getExtensionMaxDetails()`        | `utils/extensionRules.js` | Use `getExtensionProfile()` |
| `getMinimumSalary()`              | `utils/contractUtils.js`  | Use `getMinSalaryProfile()` |
