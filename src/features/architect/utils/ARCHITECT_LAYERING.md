# Architect Layering Rules

## Overview

The Architect feature uses a **layered architecture** for salary and CBA rule calculations. This document defines the boundaries between public APIs and internal implementation details.

## Public API: `salaryEngine`

**All feature code, UI components, and hooks MUST import from `salaryEngine`:**

```typescript
import {
  getSalaryProfile,
  getMaxSalaryProfile,
  getMinSalaryProfile,
  getBirdRightsProfile,
  getExtensionProfile,
  getRFAProfile,
  computePlayerRulesProfile,
  computeMaxSalary,
  computeMinimumSalary,
  computeBirdRights,
  buildRuleContextForPlayerMove,
  // ... all other exports
} from '@/features/architect/utils/salaryEngine';
```

The Salary Engine provides:

- RuleContext-based entry points for consistent timing and cap handling
- Re-exports of all `playerRulesProfile` functions for backward compatibility
- Context builders (`buildRuleContextForPlayerMove`, `buildMinimalRuleContext`)
- Cap data lookups and season utilities
- Type exports for TypeScript consumers

## Internal Implementation: `playerRulesProfile`

**The `playerRulesProfile` module is INTERNAL implementation.**

Direct imports from `playerRulesProfile` are **forbidden** except for:

1. The `salaryEngine` wrapper itself (`utils/salaryEngine/*.ts`)
2. The `buildRuleContext.ts` file (part of engine internals, avoids circular deps)
3. Internal cross-imports within `playerRulesProfile/*`
4. Unit tests specifically testing the internal module (`tests/architect/playerRulesProfile.test.js`)

## Why This Matters

1. **Single Entry Point**: All consumers use one import path, making refactoring easier
2. **API Stability**: Internal implementation can change without breaking consumers
3. **Consistent Context**: New code uses RuleContext for proper timing/cap handling
4. **Discoverability**: One place to find all salary-related functions

## ESLint Enforcement

This boundary is enforced by ESLint using `@typescript-eslint/no-restricted-imports`.

It blocks **both**:

- Alias imports (example: `@/features/architect/utils/playerRulesProfile/...`)
- Relative/path imports (example: `./playerRulesProfile/...`, `../playerRulesProfile/...`, or any path containing `playerRulesProfile`)

**If you see a restricted import error:** replace the import with the equivalent export from:
`@/features/architect/utils/salaryEngine`

```text
Import from @/features/architect/utils/salaryEngine instead. See ARCHITECT_LAYERING.md.
```

### What to do when you hit the lint error

1. **Do not “work around” the lint** (no relative imports, no deep-path imports into `playerRulesProfile/**`).
2. **Import the same symbol from `salaryEngine` instead**:

```typescript
// Before (forbidden)
import { computeBirdRights } from '@/features/architect/utils/playerRulesProfile';

// After (allowed)
import { computeBirdRights } from '@/features/architect/utils/salaryEngine';
```

3. **If the symbol you need isn’t exported yet**, add a re-export to:
   `src/features/architect/utils/salaryEngine/index.ts` (no logic changes) so all consumers keep a single import path.

## Whitelisted Files

The following files are allowed to import directly from `playerRulesProfile`:

| File/Pattern                                 | Reason                                               |
| -------------------------------------------- | ---------------------------------------------------- |
| `utils/salaryEngine/**`                      | The public wrapper itself                            |
| `utils/buildRuleContext.ts`                  | Part of engine internals, exported from salaryEngine |
| `utils/playerRulesProfile/**`                | Internal cross-imports                               |
| `tests/architect/playerRulesProfile.test.js` | Unit tests for internal module                       |

## Migration Guide

If you have code importing from `playerRulesProfile`:

**Before:**

```typescript
import { computeMaxSalary } from '@/features/architect/utils/playerRulesProfile';
```

**After:**

```typescript
import { computeMaxSalary } from '@/features/architect/utils/salaryEngine';
```

All functions are re-exported with identical signatures - no code changes needed beyond the import path.
