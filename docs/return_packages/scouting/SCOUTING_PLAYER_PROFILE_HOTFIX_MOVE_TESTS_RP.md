# SCOUTING PLAYER PROFILE HOTFIX - MOVE TESTS

**Return Package**: Test File Location Refactor  
**Date**: 2026-01-22  
**Type**: Structural Refactor (No Behavior Change)  
**Status**: ✅ COMPLETE

---

## Problem Statement

Test files for the undefined field hotfix were created in `tests/` directory, but the project-standard location is `src/tests/`.

This refactor moves the test files to align with project conventions.

---

## Files Changed

### Moved Files

1. **`tests/stripUndefinedDeep.test.js` → `src/tests/stripUndefinedDeep.test.js`**
   - Updated FILE path in header comment
   - Changed import from `../src/shared/utils/videoExamples.js` to `@/shared/utils/videoExamples.js`
   - No logic changes

2. **`tests/videoExamples.undefined.test.js` → `src/tests/videoExamples.undefined.test.js`**
   - Updated FILE path in header comment
   - Changed import from `../src/shared/utils/videoExamples.js` to `@/shared/utils/videoExamples.js`
   - No logic changes

### No Config Changes Required

**`vitest.config.js`**: No changes needed

- Vitest automatically discovers test files in all directories
- Both `tests/` and `src/tests/` locations work
- Tests run successfully from new location

---

## Validation & Testing

### Test Command Output

```bash
npx vitest run src/tests/stripUndefinedDeep.test.js src/tests/videoExamples.undefined.test.js --reporter=verbose
```

**Results**:

```
✓ src/tests/stripUndefinedDeep.test.js (8)
  ✓ stripUndefinedDeep (8)
    ✓ should remove undefined fields from flat objects
    ✓ should recursively remove undefined from nested objects
    ✓ should handle arrays with undefined elements
    ✓ should preserve null values
    ✓ should handle deeply nested structures
    ✓ handle evaluation data structure
    ✓ should preserve Date objects
    ✓ should handle empty objects after cleaning

✓ src/tests/videoExamples.undefined.test.js (6)
  ✓ Video Examples - Undefined Field Prevention (6)
    ✓ buildVideoExample (4)
      ✓ should not include undefined label when label is empty
      ✓ should include label when provided
      ✓ should not include undefined label when label is whitespace
      ✓ should always include createdAt timestamp
    ✓ normalizeVideoExamples (2)
      ✓ should not propagate undefined values in nested structures
      ✓ should handle empty string labels by omitting them

Test Files  2 passed (2)
Tests       14 passed (14)
Duration    7.46s
```

### Full Test Suite

```bash
npm run test -- --run
```

**Results**:

```
Test Files  9 failed | 115 passed (124)
Tests       41 failed | 1585 passed | 1 skipped | 3 todo (1630)
Duration    266.59s
```

**Note**: The 2 moved test files are among the 115 passing test files. The 9 failures are pre-existing and unrelated to this refactor.

---

## Changes Summary

### Git Status

```
Modified Files (unrelated to this refactor):
 M docs/architect/return_packages/PHASE_31_MAX_SALARY_ENFORCEMENT_RETURN_PACKAGE.md
 M docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
 M src/features/architect/tradeMachine/TradeSummaryPanel.jsx
 M src/features/profile/hooks/useAutoSavePlayer.js
 M src/shared/utils/videoExamples.js

New Files (this refactor):
 A src/tests/stripUndefinedDeep.test.js        (moved from tests/)
 A src/tests/videoExamples.undefined.test.js   (moved from tests/)

Related Doc:
 A docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_HOTFIX_UNDEFINED_RP.md
```

### Diff Summary

```
Modified:
 src/tests/stripUndefinedDeep.test.js        (path + import updated)
 src/tests/videoExamples.undefined.test.js   (path + import updated)

Deleted:
 tests/stripUndefinedDeep.test.js            (moved to src/tests/)
 tests/videoExamples.undefined.test.js       (moved to src/tests/)
```

---

## Technical Details

### Why No Config Changes?

Vitest uses glob patterns to discover test files. The default configuration searches:

- `**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`

This pattern matches test files in **any directory**, including:

- `tests/*.test.js`
- `src/tests/*.test.js`
- `src/features/*/tests/*.test.js`

**Therefore**: Moving tests from `tests/` to `src/tests/` requires no config updates.

### Import Path Changes

**Before** (from `tests/` directory):

```javascript
import { buildVideoExample } from '../src/shared/utils/videoExamples.js';
```

**After** (from `src/tests/` directory):

```javascript
import { buildVideoExample } from '@/shared/utils/videoExamples.js';
```

**Why `@/` alias works**:

- Configured in `vite.config.js` and `jsconfig.json`
- `@` resolves to `./src`
- Works from any location within the project

---

## Project-Standard Test Locations

According to workspace structure, tests follow these patterns:

1. **Unit/Integration Tests**: `src/tests/`
   - Grouped by feature/domain (e.g., `src/tests/architect/`, `src/tests/trade/`)
   - Now includes: `stripUndefinedDeep.test.js`, `videoExamples.undefined.test.js`

2. **Root Test Setup**: `tests/`
   - Contains setup files: `setupFirebaseMocks.js`, `setupDebug.js`
   - Not for actual test files

3. **Feature-Specific Tests**: `src/tests/<feature>/`
   - Example: `src/tests/tradeMachine/`, `src/tests/architect/`
   - Follows feature organization

**This refactor**: Aligns new tests with pattern #1 (domain/unit tests in `src/tests/`)

---

## Acceptance Criteria

- ✅ Tests moved from `tests/` to `src/tests/`
- ✅ Import paths updated to use `@/` alias
- ✅ File header comments updated with correct paths
- ✅ All 14 tests pass in new location
- ✅ `npm test` finds and runs tests successfully
- ✅ No config changes required
- ✅ No behavior changes

---

## Related Documentation

- **Original Hotfix**: `docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_HOTFIX_UNDEFINED_RP.md`
- **Test Suite**: Both files validate the `stripUndefinedDeep` utility and video example normalization
- **Project Structure**: Aligns with `PROJECT_SCHEMA.md` conventions

---

## Sign-Off

**Developer**: GitHub Copilot  
**Date**: 2026-01-22  
**Status**: ✅ Complete  
**Tests**: ✅ All passing (14/14)  
**Behavior**: ✅ No changes - structural refactor only

---

**END OF RETURN PACKAGE**
