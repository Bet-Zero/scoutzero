# PHASE 41B — Draft Pick Back-Compat Removal — EXECUTION RETURN PACKAGE

**DATE:** 2026-01-28
**EXECUTOR:** Assistant
**STATUS:** SUCCESS

---

## 1. SUMMARY

Successfully removed backward compatibility for the legacy `teamIsAtOrAboveSecondApron` parameter in `draftPickUtils.js`. The function now strictly relies on `teamIsSecondApron`. The legacy parameter is ignored if passed.

---

## 2. CHANGES

### Source Code: `src/features/architect/utils/draftPickUtils.js`

- Removed `teamIsAtOrAboveSecondApron` from function signature destructuring.
- Removed destructuring fallback (`const isApron = teamIsSecondApron ?? teamIsAtOrAboveSecondApron;`).
- Updated logic to strictly use `const isApron = teamIsSecondApron;`.
- Removed logging of legacy parameter.

### Tests: `src/tests/architect/phase40_secondApron_drift_guardrails.test.js`

- Removed test case checking that legacy parameter works.
- Added test case asserting that legacy parameter `teamIsAtOrAboveSecondApron: true` is ignored and results in no frozen pick (unless `teamIsSecondApron: true` is also passed).

---

## 3. VALIDATION OUTPUTS

### A. Guardrail Test (`phase40_secondApron_drift_guardrails`)

**Command:** `npm run test -- phase40_secondApron_drift_guardrails`
**Result:** PASSED (8/8 tests)

```text
 ✓ src/tests/architect/phase40_secondApron_drift_guardrails.test.js (8)
   ✓ Phase 40: Second Apron Strict Drift Guardrails (8)
     ✓ buildRuleContext.ts: deriveApronLevel (2)
       ✓ should classify team as FIRST_APRON (not SECOND) when salary is EXACTLY equal to second apron
       ✓ should classify team as SECOND_APRON when salary is > second apron
     ✓ capLegalityValidation.js: validateSigning (Rule 1.8) (2)
       ✓ should ALLOW signing above minimum when projected salary is EXACTLY at second apron
       ✓ should BLOCK signing above minimum when projected salary is > second apron
     ✓ faExceptionUtils.js: canUseFaException (2)
       ✓ should ALLOW use when salary is EXACTLY at second apron
       ✓ should BLOCK use when salary is > second apron
     ✓ draftPickUtils.js: isFrozenPick (2)
       ✓ should IGNORE legacy parameter teamIsAtOrAboveSecondApron
       ✓ should support new parameter teamIsSecondApron
                              
 Test Files  1 passed (1)     
      Tests  8 passed (8)
   Start at  01:03:18         
   Duration  29.62s
```

### B. Sanity Check (`capLegalityValidation`)

**Command:** `npm run test -- capLegalityValidation`
**Result:** PASSED (242/242 tests)

```text
 ✓ src/tests/architect/capLegalityValidation.test.js (38)
 ✓ tests/architect/capLegalityValidation.test.js (204)
                              
 Test Files  2 passed (2)     
      Tests  242 passed (242)
   Start at  01:03:18
   Duration  33.90s
```

---

## 4. NEXT STEPS

- None. Back-compat removal is complete.
