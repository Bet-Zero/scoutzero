# PHASE 43 — Apron Drift Prevention Guardrails — EXECUTION RETURN PACKAGE

**Date:** 2026-01-28  
**Status:** EXECUTION COMPLETE ✅  
**Phase Type:** Implementation  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## Executive Summary

Phase 43 implemented guardrails to prevent future apron-logic drift by:

1. Enforcing canonical imports via ESLint rule
2. Fixing remaining import bypasses to use `@/features/architect/utils/capUtils`
3. Delegating deprecated helper to canonical SSOT
4. Confirming S&T eligibility check semantics are correct (no change needed)
5. Adding test guardrails to detect future drift

---

## Changes Made

### Task A: Fix Canonical Import Bypass ✅

**File:** [buildRuleContext.ts](src/features/architect/utils/buildRuleContext.ts#L42)

**Before:**

```typescript
import { getTeamApronStatus } from './tradeMachine/utils/capUtils.js';
```

**After:**

```typescript
import { getTeamApronStatus } from '@/features/architect/utils/capUtils';
```

**Rationale:** Routes through canonical Architect surface instead of bypassing directly to tradeMachine SSOT.

---

**File:** [tradeHelpers.js](src/features/architect/utils/tradeHelpers.js#L291)

**Before:**

```javascript
import { getTeamApronStatus as getTeamApronStatusSSoT } from './tradeMachine/utils/capUtils.js';
```

**After:**

```javascript
import { getTeamApronStatus as getTeamApronStatusSSoT } from '@/features/architect/utils/capUtils';
```

**Rationale:** Same - routes through canonical Architect surface.

---

### Task B: Fix Derivation Drift in capUtils.js ✅

**File:** [capUtils.js](src/features/architect/utils/capUtils.js#L43-L67)

**Before:**

```javascript
export function getAllowableIncomingMargin(team, capSettings) {
  const { teamTotalSalary = 0 } = team;
  const { secondApron = 0, salaryCap = 0 } = capSettings;

  // Use strict > for second apron classification per Phase 38 SSOT alignment
  const isSecondApronTeam = teamTotalSalary > secondApron;
  // ...
}
```

**After:**

```javascript
export function getAllowableIncomingMargin(team, capSettings) {
  const { teamTotalSalary = 0 } = team;
  const { salaryCap = 0 } = capSettings;

  // Phase 43: Delegate to canonical SSOT helper instead of inline comparison
  // Per CBA Art VII Sec 2(f): strict > for second apron classification
  const teamObj = { totalSalary: teamTotalSalary };
  if (isSecondApronTeam(teamObj, capSettings)) {
    // Second apron teams must match 100%
    return 0;
  }
  // ...
}
```

**Rationale:** Deprecated function now delegates to canonical `isSecondApronTeam()` helper, eliminating inline `> secondApron` comparison.

---

### Task C: S&T Eligibility Boundary Check ✅ (No Change Needed)

**File:** [useCapValidation.js](src/features/architect/hooks/useCapValidation.js#L475)

**Current Code:**

```javascript
if (currentYearCapHit > currentCapSettings.firstApron) {
  errors.push({
    severity: 'error',
    message: 'Team over First Apron - cannot execute sign-and-trade',
  });
}
```

**Analysis:**

- The check uses `>` (strictly greater than), which is **correct**
- Per CBA: A team at exactly the first apron CAN receive an S&T
- Only teams **over** the first apron are blocked
- The tradeMachine's `validateSignAndTrade.js` uses the same semantics
- **No change required** - semantics are already correct

---

### Task D1: ESLint Guardrail ✅

**File:** [.eslintrc.cjs](/.eslintrc.cjs)

**Added Rule:**

```javascript
// ============================================================
// Phase 43: Prevent apron logic drift by blocking direct imports
// from tradeMachine/utils/capUtils.js outside tradeMachine folder.
// Use @/features/architect/utils/capUtils instead.
// ============================================================
{
  files: ['src/features/architect/**/*.{js,jsx,ts,tsx}'],
  excludedFiles: [
    'src/features/architect/utils/tradeMachine/**',
    'src/features/architect/utils/capUtils.js', // Canonical facade delegates to SSOT
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              './tradeMachine/utils/capUtils*',
              '../tradeMachine/utils/capUtils*',
              '../../tradeMachine/utils/capUtils*',
              '**/tradeMachine/utils/capUtils*',
            ],
            message:
              'Import apron helpers from @/features/architect/utils/capUtils instead of directly from tradeMachine.',
          },
        ],
      },
    ],
  },
},
```

**Verified:** Rule correctly catches bypassing imports and provides actionable error message.

---

### Task D2: Test Guardrail ✅

**File:** [phase43_apron_drift_prevention_guardrails.test.js](src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js)

**Tests Added (5 total):**

| Test                                                   | Purpose                                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `no raw apron derivation patterns outside allowlist`   | Scans Architect files for raw apron comparisons, fails if found outside allowlist |
| `allowlist files exist`                                | Ensures allowlist entries are valid (prevents stale entries)                      |
| `canonical capUtils.js delegates to tradeMachine SSOT` | Verifies facade structure                                                         |
| `buildRuleContext.ts uses canonical import path`       | Enforces canonical import                                                         |
| `tradeHelpers.js uses canonical import path`           | Enforces canonical import                                                         |

**Allowlist (8 entries):**

- `src/features/architect/utils/tradeMachine/utils/capUtils.js`
- `src/features/architect/utils/tradeMachine/utils/salaryMargin.js`
- `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.js`
- `src/features/architect/utils/tradeMachine/rules/basicRules.js`
- `src/features/architect/hooks/useCapValidation.js` (UI-only warnings)
- `src/features/architect/utils/hardCapUtils.js` (threshold-based, not apron derivation)

---

## Files Changed

| File                                                                    | Change Type    | Description                                                     |
| ----------------------------------------------------------------------- | -------------- | --------------------------------------------------------------- |
| `src/features/architect/utils/buildRuleContext.ts`                      | Import fix     | Canonical import path                                           |
| `src/features/architect/utils/tradeHelpers.js`                          | Import fix     | Canonical import path                                           |
| `src/features/architect/utils/capUtils.js`                              | Delegation fix | `getAllowableIncomingMargin` delegates to `isSecondApronTeam()` |
| `.eslintrc.cjs`                                                         | Rule addition  | Blocks tradeMachine capUtils bypass imports                     |
| `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js` | New file       | Drift prevention guardrail tests                                |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`           | Changelog      | Added Phase 43 entry                                            |

---

## Validation Results

### Test Results

```
✓ phase43_apron_drift_prevention_guardrails.test.js (5 tests) - PASS
✓ phase42_apron_derivation_consolidation.test.js (19 tests) - PASS
✓ secondApron_SSOT_guardrail.test.js (4 tests) - PASS
✓ capUtils.test.js (12 tests) - PASS
```

### ESLint Verification

```bash
$ echo "import { getTeamApronStatus } from './tradeMachine/utils/capUtils.js';" | \
  npx eslint --stdin --stdin-filename src/features/architect/test.js

1:1  error  './tradeMachine/utils/capUtils.js' import is restricted from being used
     by a pattern. Import apron helpers from @/features/architect/utils/capUtils
     instead of directly from tradeMachine  no-restricted-imports
```

**Result:** ESLint rule correctly catches bypassing imports ✅

---

## Deferred Items

None. All tasks completed.

---

## Follow-Up Recommendations

1. **Monitor CI:** Ensure ESLint rule runs in CI pipeline to catch future violations
2. **Document pattern:** Add note to DEVELOPER_GUIDE.md about canonical apron import path
3. **Consider deprecation removal:** `getAllowableIncomingMargin` is deprecated - schedule for removal in future cleanup phase

---

## Master Doc Changelog Entry

```markdown
- - 2026-01-28: Phase 43 Apron Drift Prevention Guardrails (EXECUTION) - Added ESLint rule blocking direct imports from `tradeMachine/utils/capUtils.js` outside tradeMachine folder; fixed `buildRuleContext.ts` and `tradeHelpers.js` to use canonical import path `@/features/architect/utils/capUtils`; updated deprecated `getAllowableIncomingMargin` to delegate to `isSecondApronTeam`; confirmed S&T eligibility check uses correct `>` semantics; added 5 guardrail tests. Return package: `docs/architect/return_packages/PHASE_43_APRON_DRIFT_PREVENTION_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
```

---

**End of Execution Return Package**
