# PICK_WIZARD_ADVANCED_HANDOFF_EXECUTION_E1_2.md

**Date:** 2026-02-20  
**Mode:** EXECUTION  
**Master Doc:** `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`  
**Status:** PASS

---

## Summary

Implemented the Pick Wizard → Advanced Editor handoff to ensure the Advanced button reliably opens `EntitlementEditorModal` with the **current wizard form state**, with proper error handling for conversion failures and vacuum mode guards.

---

## Files Changed

### 1. `src/features/architect/tradeMachine/TradeEditor.jsx`

- **Change:** Added try/catch wrapper around `buildEntitlementDocument(formState)` in the `onOpenAdvanced` handler
- **Purpose:** Guard against conversion failures with user-friendly toast error message
- **Lines affected:** ~527-542

### 2. `src/features/architect/admin/EntitlementEditorSwapTab.tsx`

- **Change:** Fixed truncated file — added missing closing tags (`</div>`, `);`, `};`)
- **Purpose:** Pre-existing bug fix required for build to pass
- **Lines affected:** End of file (lines 163-167)

### 3. `src/features/architect/admin/EntitlementEditorBasicsTab.tsx`

- **Change:** Fixed truncated file — added missing closing tags (`</div>`, `);`, `};`)
- **Purpose:** Pre-existing bug fix required for build to pass
- **Lines affected:** End of file (lines 264-268)

### 4. `src/tests/architect/pickRightWizard.test.tsx`

- **Change:** Added test "passes current formState to onOpenAdvanced after user modifications"
- **Purpose:** Verify wizard passes **current** (not stale) formState after user changes
- **Lines affected:** ~243-264

### 5. `src/tests/architect/advancedEditorHandoff.test.ts` (NEW)

- **Change:** Created new test file with 7 tests covering:
  - Protection ladder preservation through conversion
  - EntitlementId preservation in edit mode
  - Swap_right kind handling
  - Malformed state error handling
  - Edit vs create semantics verification
  - Full roundtrip data integrity
- **Purpose:** Comprehensive handoff validation tests

---

## Validation Commands + Results

### 1. New handoff tests (advancedEditorHandoff.test.ts)

```
npx vitest run src/tests/architect/advancedEditorHandoff.test.ts --reporter=verbose
```

**Result:** ✅ 7 passed (7 tests)

### 2. PickRightWizard tests

```
npx vitest run src/tests/architect/pickRightWizard.test.tsx --reporter=verbose
```

**Result:** ✅ 23 passed, 7 failed (pre-existing failures), 2 skipped  
**New test "passes current formState to onOpenAdvanced after user modifications":** ✅ PASSED

### 3. WizardTranslation tests

```
npx vitest run src/tests/architect/wizardTranslation.test.ts
```

**Result:** 41 passed, 4 failed (pre-existing template failures)

### 4. Production build

```
npm run build
```

**Result:** ✅ Built successfully in 43.03s

---

## Task Verification

| Task | Requirement                                                     | Status                                                                                                                                                                             |
| ---- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Wizard emits current formState on "Advanced"                    | ✅ Already implemented via `handleOpenAdvanced` callback using `useCallback` with `[formState, onOpenAdvanced]` deps                                                               |
| 2    | TradeEditor handler with vacuum guard                           | ✅ `isVacuumMode` check shows toast and returns early                                                                                                                              |
| 2    | TradeEditor handler with try/catch                              | ✅ Added try/catch around `buildEntitlementDocument(formState)`                                                                                                                    |
| 2    | TradeEditor handler passes correct entitlementId                | ✅ Uses `entitlementEditorState.entitlementId \|\| undefined`                                                                                                                      |
| 2    | TradeEditor closes wizard before opening advanced               | ✅ `setEntitlementEditorState(null)` called before `setAdvancedEditorState(...)`                                                                                                   |
| 3    | EntitlementEditorModal supports initialDocument + entitlementId | ✅ `useEntitlementEditorState` initializes from `initialDocument` via `createEntitlementFormState(initialDocument, entitlementId)` and re-initializes on prop change via useEffect |
| 4    | Tests added                                                     | ✅ 8 new tests total (1 in pickRightWizard.test.tsx, 7 in advancedEditorHandoff.test.ts)                                                                                           |

---

## Implementation Details

### Error Handling (Task 2)

```jsx
onOpenAdvanced={(formState) => {
  if (isVacuumMode) {
    toast.error('Advanced editor requires saving to a world first');
    return;
  }
  // E1.2: Wrap in try/catch to guard against conversion failures
  let document;
  try {
    document = buildEntitlementDocument(formState);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(`Unable to open Advanced editor: ${message}`);
    return;
  }
  setAdvancedEditorState({
    entitlementId: entitlementEditorState.entitlementId || undefined,
    initialDocument: document,
  });
  setEntitlementEditorState(null);
}}
```

### Modal Initialization (Task 3)

```typescript
// useEntitlementEditorState.ts
const [formState, setFormState] = useState(() =>
  createEntitlementFormState(initialDocument, entitlementId)
);

useEffect(() => {
  setFormState(createEntitlementFormState(initialDocument, entitlementId));
  setErrors([]);
  setLastPath(null);
  setActiveTab('basics');
}, [initialDocument, entitlementId]);
```

---

## Known Issues / Follow-ups

1. **Pre-existing test failures (7 in pickRightWizard.test.tsx, 4 in wizardTranslation.test.ts):** Unrelated to this change; involve UI label checks and template application that were broken before this execution.

2. **Fixed truncated files:** `EntitlementEditorSwapTab.tsx` and `EntitlementEditorBasicsTab.tsx` were truncated and missing closing tags. Fixed as part of this execution to enable build.

3. **Vacuum mode → Advanced:** Currently blocked by design (toast shown). This is correct per scope — "Adding vacuum support to EntitlementEditorModal" is explicitly out of scope.

---

## PASS/FAIL Checklist

| Criterion                                            | Result                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Advanced opens with latest wizard edits (world mode) | ✅ PASS                                                        |
| No accidental fork on edit existing                  | ✅ PASS — `entitlementId` correctly passed from wizard context |
| Vacuum shows toast and does not open                 | ✅ PASS                                                        |
| Conversion failure shows toast                       | ✅ PASS — try/catch with error message                         |
| Build passes                                         | ✅ PASS                                                        |
| Targeted tests pass                                  | ✅ PASS (new tests, pre-existing failures unrelated)           |

**OVERALL: PASS**
