# Return Package: P2 TradeSalaryCalculator Non-Misleading Behavior

**Date**: 2026-01-01  
**Scope**: TradeSalaryCalculator capSettings normalization + sandbox disable + misleading green state removal  
**Status**: ✅ COMPLETE

---

## 1. Summary of Changes

### Cap Settings Normalization
Added a `normalizeCapSettings` helper function to `TradeSalaryCalculator.jsx` that handles various upstream cap setting shapes:
- `{ salaryCap, firstApron, secondApron }` (canonical)
- `{ cap, firstApron, secondApron }` (alternative field name)
- `{ salaryCap, firstApronLine, secondApronLine }` (internal naming)
- Nested year-keyed forms (detects and picks current yearKey if present)

Returns canonical shape with `hasValidCapSettings` boolean indicating if salaryCap > 0.

### Sandbox Disabled Behavior
Implemented `sandboxDisabledReason` logic:
- If `!hasValidCapSettings` → "Missing or invalid cap settings"
- If `validatorSkipReason` truthy → "Salary matching not applicable (${validatorSkipReason})"
- When sandboxDisabledReason is non-null: renders neutral "Sandbox Disabled" panel, no green result

### Non-Misleading Label Change
- **Before**: "Valid Trade (Sandbox)" / "Invalid Trade (Sandbox)"
- **After**: "Sandbox Result (salary matching only)" (for both valid/invalid states)
- Updated success message: "Test incoming salary passes salary matching check"

---

## 2. Files Changed

| File | Change Type |
|------|-------------|
| `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx` | Modified - Added normalizeCapSettings helper, updated labels |
| `src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx` | Modified - Added 5 new test cases |
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` | Modified - Updated Section 3.4, bumped to v1.2.4 |

---

## 3. Cap Settings Normalization Logic (Code Excerpt)

```javascript
/**
 * Normalize cap settings into the canonical shape used by the calculator.
 * Handles various upstream shapes:
 *   - { salaryCap, firstApron, secondApron }
 *   - { cap, firstApron, secondApron }
 *   - { salaryCap, firstApronLine, secondApronLine }
 *   - Nested year-keyed forms (picks current yearKey if present)
 * 
 * Returns: { salaryCap, firstApron, secondApron } as numbers, plus hasValidCapSettings boolean.
 */
function normalizeCapSettings(rawCapSettings, yearKey = null) {
  // Handle null/undefined
  if (!rawCapSettings || typeof rawCapSettings !== 'object') {
    return { salaryCap: 0, firstApron: 0, secondApron: 0, hasValidCapSettings: false };
  }

  let settings = rawCapSettings;

  // Handle nested year-keyed forms (e.g., { '2024-25': { cap: ... } })
  if (yearKey && typeof settings[yearKey] === 'object' && settings[yearKey] !== null) {
    settings = settings[yearKey];
  } else if (yearKey) {
    // Try season string format (e.g., yearKey=2025 -> check '2024-25')
    const seasonKey = typeof yearKey === 'number' ? `${yearKey - 1}-${String(yearKey).slice(-2)}` : yearKey;
    if (typeof settings[seasonKey] === 'object' && settings[seasonKey] !== null) {
      settings = settings[seasonKey];
    }
  }

  // Normalize field names to canonical shape
  const salaryCap = Number(settings.salaryCap) || Number(settings.cap) || 0;
  const firstApron = Number(settings.firstApron) || Number(settings.firstApronLine) || 0;
  const secondApron = Number(settings.secondApron) || Number(settings.secondApronLine) || 0;

  // Cap settings are valid if salaryCap is positive
  const hasValidCapSettings = salaryCap > 0;

  return { salaryCap, firstApron, secondApron, hasValidCapSettings };
}
```

---

## 4. Before/After Strings

### Labels Changed
| Location | Before | After |
|----------|--------|-------|
| Valid sandbox result | "Valid Trade (Sandbox)" | "Sandbox Result (salary matching only)" |
| Invalid sandbox result | "Invalid Trade (Sandbox)" | "Sandbox Result (salary matching only)" |
| Valid result message | "This salary combination complies with CBA rules" | "Test incoming salary passes salary matching check" |

### Sandbox Disabled State
- Now shows neutral "Sandbox Disabled" panel when:
  - Cap settings missing or invalid (salaryCap = 0)
  - Validator skip reason exists

---

## 5. Test Outputs

### Guardrail Tests
```
npm run test src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx -- --run

 ✓ src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx  (19 tests) 162ms

 Test Files  1 passed (1)
      Tests  19 passed (19)
```

### All Trade Tests
```
npm run test tests/trade/ -- --run

 Test Files  28 passed (28)
      Tests  149 passed (149)
```

### Build Output
```
npm run build

✓ 2914 modules transformed.
✓ built in 9.51s
```

---

## 6. Screenshots Note

Not captured in agent environment. UI changes should be visually verified:
- Sandbox shows "Sandbox Result (salary matching only)" instead of "Valid Trade (Sandbox)"
- Missing/invalid cap settings shows "Sandbox Disabled" panel
- Validator skip reason shows "Sandbox Disabled" with reason explanation

---

## 7. No-Scope Confirmation

**Validator math untouched** ✅
- No changes to `salaryMatchingRules.js`
- No changes to `validateSalaryMatching.js`
- No changes to `useTradeMachineSnapshot.js`
- Only prop naming/wiring verified in `TradeEditor.jsx` (unchanged, already correct)

---

## 8. Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| Cap settings missing/zero → "Sandbox Disabled" + NO green result | ✅ |
| validatorSkipReason present → "Sandbox Disabled" + NO green result | ✅ |
| Valid cap settings → sandbox result with non-misleading label | ✅ |
| "Exploratory tool — validator is authoritative" disclaimer visible | ✅ |
| All guardrail tests pass | ✅ (19/19) |
| All trade tests pass | ✅ (149/149) |
| Build passes | ✅ |

---

*Return package generated: 2026-01-01*
