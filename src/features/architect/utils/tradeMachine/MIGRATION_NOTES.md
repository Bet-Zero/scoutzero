# Trade Validation Architecture Migration Notes

## Overview

The trade validation logic has been reorganized into a clean, layered architecture. This document outlines the changes, new structure, and migration guide.

## New Directory Structure

```
src/utils/architect/tradeMachine/
├── engine/           # Orchestration, performance monitoring, debug
│   ├── tradeValidator.ts         # Main validateTrade function
│   ├── engineUtils.ts           # Debug utilities
│   ├── tradeDebug.ts            # Trade-specific debug
│   ├── performanceMonitor.ts    # Performance tracking
│   ├── validationPerformanceMonitor.ts
│   ├── validationDecorator.js     # Caching decorators
│   ├── validationDebugMonitor.ts # Debug monitoring
│   ├── validatorFactory.js       # Validator factories
│   ├── templateValidator.js      # Template validator
│   ├── tradeKicker.js            # Trade kicker logic
│   └── index.ts                  # Engine barrel exports
├── rules/            # Pure validation functions
│   ├── validateSalaryMatching.ts  # Salary matching rules
│   ├── validateHardCap.ts         # Hard cap rules
│   ├── validateStepien.ts         # Stepien rule validation
│   ├── validateRoster.ts          # Roster validation
│   ├── validateCash.ts            # Cash validation
│   ├── validateTradeExceptions.ts # TPE validation
│   ├── validateEligibility.ts     # Player eligibility
│   ├── validateConsent.ts         # Player consent
│   ├── timingValidation.ts        # Timing restrictions
│   ├── validateSignAndTrade.ts    # Sign-and-trade rules
│   ├── enforce*.ts                # Enforcement functions
│   └── index.ts                  # Rules barrel exports
├── utils/            # Helper functions and utilities
│   ├── capUtils.js               # Cap calculations
│   ├── salaryMargin.js           # Salary margin utilities
│   ├── salaryCalculations.js     # Salary calculations
│   ├── tradeUtils.js             # Trade utilities
│   ├── matchingValues.js         # Matching value calculations
│   ├── pickUtils.js              # Draft pick utilities
│   ├── tpeUtils.js               # Trade exception utilities
│   ├── validateInput.js          # Input validation
│   ├── normalizeTradeInput.js    # Input normalization
│   └── index.ts                  # Utils barrel exports
├── constants/        # Shared constants and types
│   ├── cbaConstants.js           # CBA constants
│   ├── types.ts                  # Type definitions
│   └── index.js                  # Constants barrel exports
├── cache/            # Caching functionality (engine-only)
│   ├── validationCache.js        # Main cache implementation
│   ├── validationCacheService.js # Cache service
│   ├── validationCacheManager.js # Cache manager
│   ├── cacheInvalidationManager.js # Cache invalidation
│   └── index.ts                  # Cache barrel exports
├── validators/       # Compatibility layer (DEPRECATED)
│   └── index.ts                  # Re-exports for backwards compatibility
└── index.ts          # Public API
```

## Path Migration Mapping

### Major Moves

| Old Path | New Path | Notes |
|----------|----------|-------|
| `validators/validateSalaryMatching` | `rules/validateSalaryMatching` | Now pure function |
| `validators/validateHardCap` | `rules/validateHardCap` | Cache removed |
| `validators/validateStepien` | `rules/validateStepien` | Cache removed |
| `validators/validateRoster` | `rules/validateRoster` | Cache removed |
| `validators/capUtils` | `utils/capUtils` | Helper utilities |
| `validators/salaryMargin` | `utils/salaryMargin` | Helper utilities |
| `validators/validationCache` | `cache/validationCache` | Engine-only |
| `validators/performanceMonitor` | `engine/performanceMonitor` | Engine-only |
| `tradeValidator` | `engine/tradeValidator` | Main orchestrator |
| `debug` | `engine/tradeDebug` | Debug utilities |
| `cbaConstants` | `constants/cbaConstants` | Shared constants |

### Removed Files

The following files were moved from `validators/` and consolidated:
- `validationCacheService.js` → `cache/`
- `validationCacheManager.js` → `cache/`
- `validationDecorator.js` → `engine/`
- `validationPerformanceMonitor.js` → `engine/`

## New Import Patterns

### Engine (Main Entry Point)
```javascript
// Main validation function
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';

// Or use public API
import { validateTrade } from '@/features/architect/utils/tradeMachine';
```

### Rules (Pure Validation Functions)
```javascript
// Individual rules
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching';
import { validateHardCap } from '@/features/architect/utils/tradeMachine/rules/validateHardCap';

// Or use barrel import
import { 
  validateSalaryMatching, 
  validateHardCap 
} from '@/features/architect/utils/tradeMachine/rules';
```

### Utilities
```javascript
// Cap utilities
import { toNum, getTeamObject } from '@/features/architect/utils/tradeMachine/utils/capUtils';

// Or use barrel import
import { toNum, getTeamObject } from '@/features/architect/utils/tradeMachine/utils';
```

### Constants
```javascript
// CBA constants
import { SALARY_CAP_2025 } from '@/features/architect/utils/tradeMachine/constants/cbaConstants';

// Or use barrel import
import { SALARY_CAP_2025 } from '@/features/architect/utils/tradeMachine/constants';
```

## Layering Rules

The new architecture enforces strict layering:

### ✅ Allowed Imports

- **engine/** → rules/, utils/, constants/, cache/
- **rules/** → utils/, constants/ (ONLY)
- **utils/** → constants/ (ONLY)
- **constants/** → (no internal imports)
- **cache/** → constants/ (ONLY)

### ❌ Prohibited Imports

- **rules/** → engine/, cache/, validators/
- **utils/** → engine/, rules/, cache/, validators/
- **constants/** → any internal modules
- **cache/** → engine/, rules/, validators/

## Breaking Changes

### 1. Rules Are Now Pure Functions

All validation rules no longer use caching or performance monitoring internally. They are pure functions that:
- Take input parameters
- Return validation results
- Have no side effects
- Don't import cache or debug modules

**Before:**
```javascript
export function validateSalaryMatching(team, context) {
  const cached = validationCache.getCachedSalaryMatch(team, yearKey);
  if (cached) return cached;
  
  const result = { /* validation logic */ };
  validationCache.cacheSalaryMatch(team, yearKey, result);
  return result;
}
```

**After:**
```javascript
export function validateSalaryMatching(team, context) {
  // Pure validation logic only
  return { /* validation result */ };
}
```

### 2. Caching Moved to Engine

Caching and performance monitoring are now handled by the engine layer through decorators:

```javascript
// In engine/tradeValidator.ts
import { wrapCommonValidators } from './validationDecorator.js';
const validators = wrapCommonValidators(baseValidators);
```

### 3. Debug Removed from Rules

Rules no longer have debug statements. Debug functionality is handled at the engine level.

## Canonical Import Surfaces

The deprecated `validators/index.ts` compatibility barrel has been removed. Use
the canonical Trade Machine surfaces directly:

```javascript
import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules';
import { normalizeTradeInput } from '@/features/architect/utils/tradeMachine/utils';
```

## Dependency Checking

To maintain the layered architecture, run the dependency checker:

```bash
npm run deps:check
```

This will verify:
- No circular dependencies
- Rules don't import engine/cache/validators
- Utils/constants don't import upward
- Only engine imports cache

## Test Updates

Test imports should use canonical rule and helper files directly. Reserve the
public Trade Machine entrypoint for `validateTrade`.
For example:

```javascript
import { validateHardCap } from '@/features/architect/utils/tradeMachine/rules/hardCapValidation';
```

## Public API

The root public API is intentionally narrow:

```javascript
import { validateTrade } from '@/features/architect/utils/tradeMachine';
```

## Migration Checklist

- [ ] Update imports to use new paths
- [ ] Remove direct cache imports from business logic
- [ ] Remove debug calls from rules
- [ ] Use engine layer for orchestration
- [ ] Run `npm run deps:check` to verify layering
- [ ] Update tests to use new import paths

## Benefits

1. **Clear Separation of Concerns**: Engine handles orchestration, rules handle validation logic
2. **Pure Functions**: Rules are now testable pure functions without side effects  
3. **Performance**: Caching is centralized and optimized in the engine
4. **Maintainability**: Clear dependency boundaries prevent coupling
5. **Testability**: Pure rules are easier to test and reason about
