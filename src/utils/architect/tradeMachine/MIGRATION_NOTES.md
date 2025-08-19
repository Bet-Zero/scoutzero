# TradeMachine Reorganization - Migration Notes

This document outlines the reorganization of the trade validation system in `src/utils/tradeMachine/` and provides guidance for updating imports and understanding the new structure.

## Overview

The trade validation system has been reorganized from a flat structure with mixed concerns into a clean, domain-based hierarchy that separates validation rules, utilities, caching, and orchestration.

## New Directory Structure

```
src/utils/tradeMachine/
├── engine/               # Core validation pipeline and orchestration
│   ├── tradeValidator.js  # Main validation entry point
│   ├── debug.js          # Debug utilities
│   ├── tradeDebug.js     # Trade-specific debugging
│   └── index.js          # Engine exports
├── rules/                # Business validation rules organized by domain
│   ├── salary/           # Salary cap and matching rules
│   ├── roster/           # Roster size and eligibility rules
│   ├── picks/            # Draft pick rules (Stepien, protections)
│   ├── timing/           # Trade timing and consent rules
│   ├── apron/            # Luxury tax apron restrictions
│   └── index.js          # All rules exports
├── utils/                # Pure helper functions
│   ├── calculations/     # Mathematical computations
│   ├── guards/           # Input validation and type checking
│   └── index.js          # All utilities exports
├── constants/            # Static data and CBA thresholds
├── cache/                # Performance and caching utilities
├── validators/           # Legacy compatibility layer
└── index.js              # Main public API
```

## Migration Guide

### 1. Main API Changes

**Before:**
```javascript
import { validateTrade } from '@/utils/architect/tradeMachine/tradeValidator';
```

**After (Recommended):**
```javascript
import { validateTrade } from '@/utils/architect/tradeMachine';
// OR for explicit engine import:
import { validateTrade } from '@/utils/architect/tradeMachine/engine';
```

### 2. Individual Validator Imports

**Before:**
```javascript
import { validateSalaryMatching } from '@/utils/architect/tradeMachine/validators/validateSalaryMatching';
import { validateStepien } from '@/utils/architect/tradeMachine/validators/validateStepien';
import { validateHardCap } from '@/utils/architect/tradeMachine/validators/validateHardCap';
```

**After (Option 1 - Barrel imports):**
```javascript
import { validateSalaryMatching, validateStepien, validateHardCap } from '@/utils/architect/tradeMachine';
```

**After (Option 2 - Direct domain imports):**
```javascript
import { validateSalaryMatching } from '@/utils/architect/tradeMachine/rules/salary';
import { validateStepien } from '@/utils/architect/tradeMachine/rules/picks';
import { validateHardCap } from '@/utils/architect/tradeMachine/rules/salary';
```

### 3. Utility Function Imports

**Before:**
```javascript
import { toNum, normalizeCaps } from '@/utils/architect/tradeMachine/validators/capUtils';
import { hasStepienViolation } from '@/utils/architect/tradeMachine/validators/stepienRule';
import { computeMatchingValues } from '@/utils/architect/tradeMachine/computeMatchingValues';
```

**After:**
```javascript
import { toNum, normalizeCaps, hasStepienViolation, computeMatchingValues } from '@/utils/architect/tradeMachine';
// OR domain-specific:
import { toNum, normalizeCaps } from '@/utils/architect/tradeMachine/utils/calculations';
```

### 4. Constants and Configuration

**Before:**
```javascript
import { CBA_THRESHOLDS } from '@/utils/architect/tradeMachine/cbaConstants';
```

**After:**
```javascript
import { CBA_THRESHOLDS } from '@/utils/architect/tradeMachine/constants';
```

### 5. Cache and Performance Utilities

**Before:**
```javascript
import { validationCache } from '@/utils/architect/tradeMachine/validators/validationCache';
import { performanceMonitor } from '@/utils/architect/tradeMachine/validators/validationPerformanceMonitor';
```

**After:**
```javascript
import { validationCache, performanceMonitor } from '@/utils/architect/tradeMachine/cache';
```

## File Mapping

### Moved Files

| Old Location | New Location | Notes |
|--------------|--------------|-------|
| `tradeValidator.js` | `engine/tradeValidator.js` | Main validation engine |
| `debug.js` | `engine/debug.js` | Debug utilities |
| `tradeDebug.js` | `engine/tradeDebug.js` | Trade debugging |
| `cbaConstants.js` | `constants/cbaThresholds.js` | CBA configuration |
| `validators/validateSalaryMatching.js` | `rules/salary/salaryMatching.js` | Salary matching rules |
| `validators/validateHardCap.js` | `rules/salary/hardCap.js` | Hard cap validation |
| `validators/validateCash.js` | `rules/salary/validateCash.js` | Cash validation |
| `validators/validateBYC.js` | `rules/salary/validateBYC.js` | Base Year Compensation |
| `validators/validateRoster.js` | `rules/roster/rosterLimits.js` | Roster size limits |
| `validators/validateEligibility.js` | `rules/roster/eligibility.js` | Player eligibility |
| `validators/validateStepien.js` | `rules/picks/stepien.js` | Stepien Rule validation |
| `validators/validateDraftPicks.js` | `rules/picks/draftPicks.js` | Draft pick validation |
| `validators/validateTiming.js` | `rules/timing/tradeWindows.js` | Trade timing rules |
| `validators/validateConsent.js` | `rules/timing/consent.js` | Player consent rules |
| `validators/validateSignAndTrade.js` | `rules/timing/validateSignAndTrade.js` | Sign-and-trade rules |
| `validators/validateSecondApronRules.js` | `rules/apron/secondApron.js` | Second apron restrictions |
| `validators/validateTradeExceptions.js` | `rules/apron/exceptions.js` | Trade exception validation |
| `validators/validateFaExceptionUsage.js` | `rules/apron/validateFaExceptionUsage.js` | FA exception usage |
| `validators/validateAggregation.js` | `rules/apron/validateAggregation.js` | Aggregation rules |
| `validators/capUtils.js` | `utils/calculations/capUtils.js` | Cap calculations |
| `salaryCalculations.js` | `utils/calculations/salaryCalculations.js` | Salary math |
| `computeMatchingValues.js` | `utils/calculations/computeMatchingValues.js` | Matching value calculation |
| `matchingValues.js` | `utils/calculations/matchingValues.js` | Matching utilities |
| `validators/salaryMargin.js` | `utils/calculations/salaryMargin.js` | Salary margin calculations |
| `salaryUtils.js` | `utils/calculations/salaryUtils.js` | Salary utilities |
| `validators/stepienRule.js` | `utils/calculations/stepienRule.js` | Stepien calculation helpers |
| `validators/validateInput.js` | `utils/guards/validateInput.js` | Input validation |
| `validators/normalizeTradeInput.js` | `utils/guards/normalizeTradeInput.js` | Input normalization |
| `validators/validateAllNewRules.js` | `utils/guards/validateAllNewRules.js` | Aggregate validation |
| `validators/validationCache.js` | `cache/validationCache.js` | Validation caching |
| `validators/validationCacheService.js` | `cache/validationCacheService.js` | Cache service |
| `validators/performanceMonitor.js` | `cache/performanceMonitor.js` | Performance monitoring |
| `validators/validationPerformanceMonitor.js` | `cache/validationPerformanceMonitor.js` | Validation performance |
| `validators/validationDecorator.js` | `cache/validationDecorator.js` | Validation decorators |
| `validators/cacheInvalidationManager.js` | `cache/cacheInvalidationManager.js` | Cache invalidation |

### Compatibility Layer

The old `validators/index.js` has been updated to re-export from the new locations, maintaining backward compatibility for most imports. A legacy compatibility file at `tradeValidator.js` redirects to the new engine location.

## New Entry Points

### Recommended Imports

For new code, use these clean import patterns:

```javascript
// Main validation engine
import { validateTrade } from '@/utils/architect/tradeMachine';

// Domain-specific rules
import { validateSalaryMatching } from '@/utils/architect/tradeMachine/rules/salary';
import { validateStepien } from '@/utils/architect/tradeMachine/rules/picks';

// Utilities
import { computeMatchingValues } from '@/utils/architect/tradeMachine/utils/calculations';

// Constants
import { CBA_THRESHOLDS } from '@/utils/architect/tradeMachine/constants';

// Cache utilities (for advanced use)
import { validationCache } from '@/utils/architect/tradeMachine/cache';
```

### Domain Organization

Each rule domain now has its own subdirectory with focused responsibilities:

- **salary/**: Salary cap compliance, matching rules, cash validation
- **roster/**: Roster size limits, player eligibility 
- **picks/**: Draft pick rules, Stepien compliance, protections
- **timing/**: Trade windows, moratorium, player consent
- **apron/**: Luxury tax apron restrictions, trade exceptions

## Breaking Changes

### Minimal Breaking Changes

The reorganization was designed to minimize breaking changes:

1. **Main API unchanged**: `validateTrade` import still works
2. **Backward compatibility**: `validators/index.js` re-exports preserve most imports
3. **Legacy redirects**: Key files have compatibility redirects

### Potential Issues

1. **Direct file imports**: Imports pointing directly to moved files will break
2. **Relative imports**: Internal relative imports within the module were updated
3. **TypeScript files**: Some `.ts` files were not moved and may have broken imports

## Benefits of New Structure

1. **Clear separation of concerns**: Rules, utilities, caching, and orchestration are distinct
2. **Domain-based organization**: Related validation logic is grouped together
3. **Improved discoverability**: Developers can easily find relevant validation rules
4. **Reduced coupling**: Utils are separated from business rules
5. **Better testing**: Domain-specific rules can be tested in isolation
6. **Maintainability**: Easier to add new rules in the appropriate domain

## Deprecations

### Files Deprecated

- Direct imports to files in old `validators/` directory (use barrel exports instead)
- `cbaConstants.js` filename (use `constants/cbaThresholds.js`)

### Recommended Migration Timeline

1. **Immediate**: Existing code continues to work through compatibility layer
2. **Short term**: Update direct file imports to use barrel exports from main index
3. **Long term**: Consider using domain-specific imports for better organization

## Testing

The reorganization maintains full test compatibility. All existing tests should continue to pass with the updated import paths.

**Test Import Updates:**
- Tests importing directly from moved files have been updated
- Compatibility layer ensures most test imports continue working
- Performance impact is minimal due to efficient re-exports

## Support

For questions about the migration or issues with imports:

1. Check the compatibility layer in `validators/index.js` 
2. Use barrel imports from main `index.js` for most use cases
3. Refer to this migration guide for file location mappings
4. Consider domain-specific imports for new code organization

## Validation

After migration, verify:
- [ ] All tests pass
- [ ] Build succeeds without import errors  
- [ ] Trade validation functionality works correctly
- [ ] Performance is not degraded
- [ ] External API consumers are not broken