# Phase 37 Preflight Return Package

## 1. Test Runner Identification

- **Runner:** `vitest`
- **Command:** `npm run test` executes `vitest`
- **Configuration:** `vitest.config.js` uses default inclusion settings.
- **Wiring:** `package.json` maps `"test": "vitest"`.

## 2. Test Discovery Matrix

- **Included Directories:** Both `tests/` and `src/tests/` are included by default `vitest` behavior (no explicit `include` pattern in config implies `**/*.{test,spec}.{js,ts,...}`).
- **Guardrail Discovery:** AUTOMATIC. The file `src/tests/trade/secondApron_SSOT_guardrail.test.js` is picked up by `vitest` without extra configuration.

## 3. Guardrail Execution Proof

- **File Path:** `src/tests/trade/secondApron_SSOT_guardrail.test.js`
- **Command Run:** `npm run test -- secondApron`
- **Output Snippet:**

  ```text
  > scoutzero-final2@0.0.1 test
  > vitest secondApron
  
  ...
   ✓ src/tests/trade/secondApron_SSOT_guardrail.test.js (4)
   ✓ tests/trade/secondApronBoundary.test.js (5)
   ✓ tests/trade/secondApron_handcuffs.test.js (4)
   ✓ tests/trade/secondApron_tpeBan.test.js (3)
  
   Test Files  4 passed (4)
        Tests  16 passed (16)
  ```

- **Conclusion:** Guardrail tests are actively running and passing.

## 4. Second Apron SSOT Drift Scan Results

**Critical Findings: Drift Identified in Legacy Utils**

While the Trade Machine logic (`salaryMatchingRules.js`) is compliant, other parts of the application still use the incorrect `>= secondApron` logic.

### A) `>= secondApron` Violations (Should be Strict `>`)

The following files still use inclusive comparison:

1. **`src/features/architect/utils/tradeHelpers.js` (Lines 283)**

    ```javascript
    if (secondApron && salary >= secondApron) return '2nd Apron';
    ```

2. **`src/features/architect/utils/capLegalityValidation.js` (Line 439)**

    ```javascript
    if (currentCapHit >= secondApron) { return { isHardCapped: true, ... } }
    ```

3. **`src/features/architect/utils/capUtils.js` (Lines 7, 28)**
    - Note: This is NOT the Trade Machine `capUtils.js`, but a separate one in `features/architect/utils/`.

    ```javascript
    if (teamSalary >= secondApron) { return 'ABOVE_SECOND_APRON'; }
    const isAtOrAboveSecondApron = teamTotalSalary >= secondApron;
    ```

### B) Inline `> secondApron` Checks (Candidates for `isSecondApronTeam`)

These are functionally correct (strict `>`) but should ideally use the SSOT helper:

1. `src/features/architect/hooks/useCapValidation.js`

    ```javascript
    if (projectedCap > secondApron) {
    ```

2. `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js`

    ```javascript
    if (secondApron && salary > secondApron) {
    ```

    *(Note: This file correctly cites CBA Art VII Sec 2(f) but effectively re-implements the logic inline).*

## 5. Docs Accuracy Check

- **Master Doc:** `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` correctly lists "Phase 36 (Execution): Second Apron SSOT Guardrails" in the Change Log (2026-01-26).
- **Zombie References:** None found in the reviewed sections.

## 6. Recommendations

1. **Prioritize Drift Fix:** The findings in Section 4A are critical. `capLegalityValidation.js` and the legacy `capUtils.js` are enforcing incorrect logic (Comparison `>=` instead of `>`). This means teams *exactly on* the apron line are incorrectly treated as being *above* it in non-trade contexts (hard cap checks).
2. **Consolidate `capUtils.js`:** There are two files named `capUtils.js` (`features/architect/utils/capUtils.js` vs `features/architect/utils/tradeMachine/utils/capUtils.js`). This is a source of confusion and logic divergence.
