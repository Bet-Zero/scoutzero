# Trade Validation Architecture Migration Notes

## Overview

The trade validation logic has been reorganized into a clean, layered architecture. This document outlines the changes, new structure, and migration guide.

## New Directory Structure

```
src/utils/architect/tradeMachine/
├── engine/           # Orchestration, performance monitoring, debug
│   ├── tradeValidator.js          # Main validateTrade function
│   ├── debug.js                   # Debug utilities  
│   ├── tradeDebug.js             # Trade-specific debug
│   ├── performanceMonitor.js      # Performance tracking
│   ├── validationPerformanceMonitor.js
│   ├── validationDecorator.js     # Caching decorators
│   ├── validationDebugMonitor.js  # Debug monitoring
│   ├── validatorFactory.js       # Validator factories
│   ├── templateValidator.js      # Template validator
│   ├── tradeKicker.js            # Trade kicker logic
│   └── index.js                  # Engine barrel exports
├── rules/            # Pure validation functions
│   ├── validateSalaryMatching.js  # Salary matching rules
│   ├── validateHardCap.js         # Hard cap rules
│   ├── validateStepien.js         # Stepien rule validation
│   ├── validateRoster.js          # Roster validation
│   ├── validateCash.js            # Cash validation
│   ├── validateTradeExceptions.js # TPE validation
│   ├── validateEligibility.js     # Player eligibility
│   ├── validateConsent.js         # Player consent
│   ├── validateTiming.js          # Timing restrictions
│   ├── validateSignAndTrade.js    # Sign-and-trade rules
│   ├── enforce*.js               # Enforcement functions
│   └── index.js                  # Rules barrel exports
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
│   └── index.js                  # Utils barrel exports
├── constants/        # Shared constants and types
│   ├── cbaConstants.js           # CBA constants
│   ├── types.ts                  # Type definitions
│   └── index.js                  # Constants barrel exports
├── cache/            # Caching functionality (engine-only)
│   ├── validationCache.js        # Main cache implementation
│   ├── validationCacheService.js # Cache service
│   ├── validationCacheManager.js # Cache manager
│   ├── cacheInvalidationManager.js # Cache invalidation
│   └── index.js                  # Cache barrel exports
├── validators/       # Compatibility layer (DEPRECATED)
│   └── index.js                  # Re-exports for backwards compatibility
└── index.js          # Public API
```

## Path Migration Mapping

### Major Moves

| Old Path | New Path | Notes |
|----------|----------|-------|
| `validators/validateSalaryMatching.js` | `rules/validateSalaryMatching.js` | Now pure function |
| `validators/validateHardCap.js` | `rules/validateHardCap.js` | Cache removed |
| `validators/validateStepien.js` | `rules/validateStepien.js` | Cache removed |
| `validators/validateRoster.js` | `rules/validateRoster.js` | Cache removed |
| `validators/capUtils.js` | `utils/capUtils.js` | Helper utilities |
| `validators/salaryMargin.js` | `utils/salaryMargin.js` | Helper utilities |
| `validators/validationCache.js` | `cache/validationCache.js` | Engine-only |
| `validators/performanceMonitor.js` | `engine/performanceMonitor.js` | Engine-only |
| `tradeValidator.js` | `engine/tradeValidator.js` | Main orchestrator |
| `debug.js` | `engine/debug.js` | Debug utilities |
| `cbaConstants.js` | `constants/cbaConstants.js` | Shared constants |

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
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';

// Or use public API
import { validateTrade } from '@/utils/architect/tradeMachine';
```

### Rules (Pure Validation Functions)
```javascript
// Individual rules
import { validateSalaryMatching } from '@/utils/architect/tradeMachine/rules/validateSalaryMatching.js';
import { validateHardCap } from '@/utils/architect/tradeMachine/rules/validateHardCap.js';

// Or use barrel import
import { 
  validateSalaryMatching, 
  validateHardCap 
} from '@/utils/architect/tradeMachine/rules';
```

### Utilities
```javascript
// Cap utilities
import { toNum, getTeamObject } from '@/utils/architect/tradeMachine/utils/capUtils.js';

// Or use barrel import
import { toNum, getTeamObject } from '@/utils/architect/tradeMachine/utils';
```

### Constants
```javascript
// CBA constants
import { SALARY_CAP_2025 } from '@/utils/architect/tradeMachine/constants/cbaConstants.js';

// Or use barrel import
import { SALARY_CAP_2025 } from '@/utils/architect/tradeMachine/constants';
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
// In engine/tradeValidator.js
import { wrapCommonValidators } from './validationDecorator.js';
const validators = wrapCommonValidators(baseValidators);
```

### 3. Debug Removed from Rules

Rules no longer have debug statements. Debug functionality is handled at the engine level.

## Compatibility Layer

The `validators/index.js` file provides backwards compatibility for existing imports, but is deprecated:

```javascript
// DEPRECATED - use new paths
import { validateSalaryMatching } from '@/utils/architect/tradeMachine/validators';

// PREFERRED - use new structure  
import { validateSalaryMatching } from '@/utils/architect/tradeMachine/rules';
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

Test imports have been updated to use the new structure:

**Before:**
```javascript
import { validateHardCap } from '@/utils/architect/tradeMachine/validators/validateHardCap.js';
```

**After:**
```javascript
import { validateHardCap } from '@/utils/architect/tradeMachine/rules/validateHardCap.js';
```

## Public API

The main public API remains unchanged:

```javascript
import { 
  validateTrade,          // Main entry point
  validateSalaryMatching, // Individual rules
  validateHardCap,
  debug                   // Debug utilities
} from '@/utils/architect/tradeMachine';
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