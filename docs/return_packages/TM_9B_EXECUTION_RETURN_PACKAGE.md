# TM-9B Execution Return Package

**Date:** 2026-02-10  
**Assignee:** Claude (GitHub Copilot)  
**Scope:** Draft v2 test fix for Pick Right Wizard

## Executive Summary

Successfully fixed 2 failing unit tests in `pickRightWizardDraft.test.ts` by updating test fixtures and assertions to match the current v2 draft envelope format. All 11 tests now pass, with no changes to production code behavior.

## Files Changed

### Modified

1. **`src/tests/architect/pickRightWizardDraft.test.ts`**
   - Added import for `createDefaultWizardModel`
   - Created `mockWizardModel` fixture for v2 envelope testing
   - Updated all `saveDraft()` calls to include `wizardModel` parameter (4-param signature)
   - Updated `loadDraft()` assertions to expect v2 envelope shape: `{ wizardModel, formState }`
   - Added test for v1→v2 auto-migration behavior
   - Updated direct localStorage assertions to validate v2 envelope structure

## Root Cause Analysis

### Why Tests Failed

The tests were written for the v1 draft format (raw `EntitlementFormState` JSON) but the production code had already been upgraded to v2 envelopes during TM-9 implementation.

**v1 behavior (expected by old tests):**

```javascript
saveDraft(worldId, entId, formState);  // 3 params

localStorage: { holderTeam: "BOS", kind: "pick_ownership", ... }
loadDraft() returns: raw formState
```

**v2 behavior (actual production code):**

```javascript
saveDraft(worldId, entId, wizardModel, formState);  // 4 params
localStorage: { version: 2, wizardModel: {...}, formState: {...} }
loadDraft() returns: { wizardModel, formState }
```

The tests were calling `saveDraft()` with only 3 parameters (missing `wizardModel`) and expecting `loadDraft()` to return raw `formState` instead of the v2 envelope shape.

## Updated Test Coverage

### saveDraft (2 tests)

- ✅ Stores v2 envelope with correct localStorage key
- ✅ Validates envelope contains `version: 2`, `wizardModel`, and `formState`
- ✅ Uses "new" suffix for create mode

### loadDraft (5 tests)

- ✅ Retrieves v2 envelope with both `wizardModel` and `formState` properties
- ✅ Returns `null` for missing drafts

- ✅ Returns `null` for corrupt JSON
- ✅ Returns `null` for invalid data (missing required fields)
- ✅ **NEW:** Auto-migrates v1 legacy drafts (raw formState format)

### clearDraft (1 test)

- ✅ Removes draft from localStorage

### hasDraft (3 tests)

- ✅ Returns `true` when draft exists
- ✅ Returns `false` when no draft exists
- ✅ Returns `false` after clearing a draft

## Validation Results

### Primary Test Suite

```bash
npm test -- --run src/tests/architect/pickRightWizardDraft.test.ts
```

**Result:** ✅ **11/11 tests pass** (was 8/10 before fix)

```
 ✓ src/tests/architect/pickRightWizardDraft.test.ts (11)
   ✓ pickRightWizardDraft (11)
     ✓ saveDraft (2)
       ✓ stores draft to localStorage with correct key and v2 envelope format
       ✓ uses "new" suffix for create mode
     ✓ loadDraft (5)
       ✓ retrieves a previously saved draft as v2 envelope
       ✓ returns null when no draft exists
       ✓ returns null for corrupt data in localStorage
       ✓ returns null for valid JSON missing required fields
       ✓ auto-migrates v1 legacy drafts (raw formState)
     ✓ clearDraft (1)

       ✓ removes a saved draft from localStorage
     ✓ hasDraft (3)
       ✓ returns true when draft exists

       ✓ returns false when no draft exists
       ✓ returns false after clearing a draft

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  3.68s
```

### Related Test Suites

```bash
npm test -- --run src/tests/architect/wizardTranslation.test.ts src/tests/architect/pickRightWizard.test.tsx

```

**Result:** ✅ **60/60 tests pass** (no regressions)

```
 ✓ src/tests/architect/wizardTranslation.test.ts (37)
 ✓ src/tests/architect/pickRightWizard.test.tsx (23)


 Test Files  2 passed (2)
      Tests  60 passed (60)
   Duration  6.74s
```

### Production Build

```bash
npm run build
```

**Result:** ✅ Build succeeds (30.79s, 2.1MB main chunk with expected warnings)

## Technical Details

### v2 Envelope Structure

The production code now persists drafts in this format:

```typescript
type DraftEnvelope = {
  version: 2;
  wizardModel: WizardModel; // Wizard UI state
  formState: EntitlementFormState; // Schema-layer form state
};
```

**localStorage key format:** `pickrightdraft:{worldId}:{entitlementId}`

### Test Fixture Changes

```typescript
// ADDED: Mock wizard model for v2 testing
const mockWizardModel = createDefaultWizardModel({
  intent: 'protect_pick',
  pick: { team: 'BOS', year: 2027, round: 1 },
  description: 'Boston 2027 1st',
});

// EXISTING: Mock form state (unchanged)
const mockFormState = {
  /* EntitlementFormState */
};
```

### Key Assertion Updates

**Before (v1 expectations):**

```typescript
saveDraft('world-1', 'new', mockFormState); // ❌ 3 params

const loaded = loadDraft('world-1', 'new');
expect(loaded).toEqual(mockFormState); // ❌ Expects raw formState
```

**After (v2 expectations):**

```typescript
saveDraft('world-1', 'new', mockWizardModel, mockFormState); // ✅ 4 params

const loaded = loadDraft('world-1', 'new');
expect(loaded).toHaveProperty('wizardModel'); // ✅ Expects envelope
expect(loaded).toHaveProperty('formState');
```

## No Production Code Changes

✅ Zero changes to production draft persistence logic

✅ Runtime behavior unchanged  
✅ Existing v1→v2 migration logic continues to work  
✅ All wizard UI functionality preserved

## Coverage Gaps Identified

None. The test suite now fully covers:

- v2 envelope persistence
- v2 envelope loading
- v1 legacy draft auto-migration
- Corruption handling
- Draft existence checks
- Draft clearing

## Recommendations

1. **Archive v1 test expectations** — Document that v1 format is legacy-only
2. **Monitor v1 migration telemetry** — If no v1 drafts are encountered in production, consider removing migration code in future cleanup
3. **Consider adding v2 version assertion** — Add a runtime check that rejects any `version !== 2` envelopes (currently only validates presence of fields)

## Master Audit Update

Entry added to `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md` under TM-9B.

## Sign-Off

- [x] All validation commands pass
- [x] No production code modified
- [x] Return package written
- [x] Master audit updated
- [x] Git status clean (only test file + docs changed)

**Status:** ✅ **COMPLETE**
