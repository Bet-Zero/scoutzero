# PHASE 43 — Apron Drift Prevention Guardrails — PREFLIGHT RETURN PACKAGE

**Date:** 2026-01-28  
**Status:** PREFLIGHT COMPLETE  
**Phase Type:** Discovery-only (no code changes)

---

## Executive Summary

Phase 42 consolidated apron derivation logic to delegate to the SSOT in `src/features/architect/utils/tradeMachine/utils/capUtils.js`. This preflight analyzed the remaining apron-related comparisons outside the canonical surface and assessed import patterns to identify potential drift vectors.

### Key Findings

| Category                             | Count          | Risk Level         |
| ------------------------------------ | -------------- | ------------------ |
| Raw comparators outside tradeMachine | 8 occurrences  | 🟡 MEDIUM          |
| Import bypasses to tradeMachine SSOT | 2 (both tests) | 🟢 LOW             |
| Non-canonical import patterns        | 2 files        | 🟡 MEDIUM          |
| UI-only/warning usages               | 5+ occurrences | 🟢 LOW (OK inline) |

**Bottom line:** The main drift risk is in `useCapValidation.js` which has 6 raw apron comparisons used for **UI warnings** (not gating/derivation). These are lower-risk but should be consolidated for consistency. Two files bypass the canonical Architect-level surface by importing directly from tradeMachine, but they are test files so the risk is acceptable.

---

## 1. Direct Comparator Scan Results

### Files with raw apron comparisons OUTSIDE `tradeMachine/`

| File                                                                                                  | Line(s)            | Snippet                                                                                                   | Intent                                         | Recommendation                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| [useCapValidation.js](src/features/architect/hooks/useCapValidation.js#L212-L217)                     | 212, 217           | `if (projectedCap > secondApron) {...} else if (projectedCap > firstApron)`                               | Warning/UI only                                | OK inline (optional consolidate)                  |
| [useCapValidation.js](src/features/architect/hooks/useCapValidation.js#L413-L427)                     | 413, 417, 422, 427 | `if (projectedCap > currentCapSettings.firstApron)`, `if (projectedCap > currentCapSettings.secondApron)` | Warning/UI only                                | OK inline (optional consolidate)                  |
| [useCapValidation.js](src/features/architect/hooks/useCapValidation.js#L475)                          | 475                | `if (currentYearCapHit > currentCapSettings.firstApron)`                                                  | Gating (S&T eligibility)                       | **MUST delegate**                                 |
| [capUtils.js (Architect)](src/features/architect/utils/capUtils.js#L46)                               | 46                 | `teamTotalSalary > secondApron`                                                                           | Derivation (legacy getAllowableIncomingMargin) | **MUST delegate**                                 |
| [hardCapUtils.js](src/features/architect/utils/hardCapUtils.js#L62)                                   | 62                 | `projectedTotalSalary > hardCapLimit`                                                                     | Gating (hard cap check)                        | OK inline (threshold-based, not apron derivation) |
| [ExceptionTracker.jsx](src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx#L52-L56) | 52-56              | `capData.firstApron`, `capData.secondApron`                                                               | UI display                                     | OK inline (value access, not comparison)          |

### Files with raw comparisons INSIDE `tradeMachine/` (expected - canonical)

These are the SSOT locations and are correct:

| File                                        | Function                 | Comparison                       | Status                      |
| ------------------------------------------- | ------------------------ | -------------------------------- | --------------------------- |
| `tradeMachine/utils/capUtils.js`            | `isFirstApronTeam()`     | `>= firstApron`                  | ✅ SSOT                     |
| `tradeMachine/utils/capUtils.js`            | `isSecondApronTeam()`    | `> secondApron`                  | ✅ SSOT                     |
| `tradeMachine/utils/capUtils.js`            | `getTeamApronStatus()`   | `> secondApron`, `>= firstApron` | ✅ SSOT                     |
| `tradeMachine/utils/salaryMargin.js`        | Multiple                 | Various                          | ✅ Internal to tradeMachine |
| `tradeMachine/utils/salaryMatchingRules.js` | `getSalaryTierBracket()` | `> secondApron`, `>= firstApron` | ✅ Internal to tradeMachine |
| `tradeMachine/rules/*.js`                   | Various validators       | Various                          | ✅ Internal to tradeMachine |

---

## 2. Import Bypass Scan Results

### Direct imports from `tradeMachine/utils/capUtils.js` OUTSIDE tradeMachine

| File                                                                                        | Import                                                                                            | Risk                                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [secondApron_SSOT_guardrail.test.js](src/tests/trade/secondApron_SSOT_guardrail.test.js#L2) | `import { isSecondApronTeam } from '@/features/architect/utils/tradeMachine/utils/capUtils.js'`   | 🟢 LOW (test file, intentionally testing SSOT)     |
| [capUtils.test.js](tests/capUtils.test.js#L8)                                               | `import {...} from '@/features/architect/utils/tradeMachine/utils/capUtils.js'`                   | 🟢 LOW (test file, intentionally testing SSOT)     |
| [buildRuleContext.ts](src/features/architect/utils/buildRuleContext.ts#L42)                 | `import { getTeamApronStatus } from './tradeMachine/utils/capUtils.js'`                           | 🟡 MEDIUM (should route through canonical surface) |
| [tradeHelpers.js](src/features/architect/utils/tradeHelpers.js#L291)                        | `import { getTeamApronStatus as getTeamApronStatusSSoT } from './tradeMachine/utils/capUtils.js'` | 🟢 LOW (explicitly aliased as SSoT, acceptable)    |

### Assessment

- **Test files** (2): Acceptable - they are testing the SSOT directly.
- **buildRuleContext.ts**: Should import from `@/features/architect/utils/capUtils` instead for consistency.
- **tradeHelpers.js**: Already explicitly marks it as SSOT, acceptable pattern.

---

## 3. Canonical Surface Compliance

### Top Importers of Apron Helpers

| File                        | Import Source                             | Canonical?                |
| --------------------------- | ----------------------------------------- | ------------------------- |
| `usePlayerRulesProfiles.js` | `@/features/architect/utils/capUtils`     | ✅ Yes                    |
| `faExceptionUtils.js`       | `@/features/architect/utils/capUtils.js`  | ✅ Yes                    |
| `CapSummaryTiles.jsx`       | `@/features/architect/utils/hardCapUtils` | ✅ Yes (hard cap helpers) |
| `CapImpactTiles.jsx`        | `@/features/architect/utils/hardCapUtils` | ✅ Yes (hard cap helpers) |
| `buildRuleContext.ts`       | `./tradeMachine/utils/capUtils.js`        | ❌ Bypasses canonical     |
| `tradeHelpers.js`           | `./tradeMachine/utils/capUtils.js`        | ⚠️ Intentional SSOT alias |

### Top Non-Canonical Patterns

1. **Direct tradeMachine imports from Architect utils**: `buildRuleContext.ts`
2. **Raw apron comparisons in hooks**: `useCapValidation.js`
3. **Legacy `getAllowableIncomingMargin`**: Still uses inline comparison in `capUtils.js`

---

## 4. Guardrail Options Proposal

### Option A: Test-Based File Content Scanner

**Mechanism:**
Create a Vitest test that scans file contents for apron derivation patterns outside allowlisted files.

```javascript
// Example: src/tests/architect/apron_drift_guardrail.test.js
const ALLOWLIST = [
  'src/features/architect/utils/tradeMachine/utils/capUtils.js',
  'src/features/architect/utils/tradeMachine/utils/salaryMargin.js',
  'src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js',
  'src/features/architect/utils/tradeMachine/rules/',
];

// Scan for: teamSalary > secondApron, >= firstApron patterns
// Fail if found outside allowlist
```

| Attribute             | Assessment                                        |
| --------------------- | ------------------------------------------------- |
| Enforcement mechanism | CI test failure                                   |
| Blast radius risk     | 🟢 LOW (fails build, doesn't break runtime)       |
| Maintenance cost      | 🟡 MEDIUM (allowlist needs updates if SSOT moves) |
| What it catches       | Raw derivation comparisons added outside SSOT     |
| What it misses        | Logic duplication that doesn't use exact patterns |

---

### Option B: ESLint no-restricted-imports for tradeMachine Bypass

**Mechanism:**
Add ESLint rule blocking direct imports from `tradeMachine/utils/capUtils.js` outside tradeMachine folder.

```javascript
// .eslintrc.cjs addition
{
  files: ['src/features/architect/**/*.{js,jsx,ts,tsx}'],
  excludedFiles: ['src/features/architect/utils/tradeMachine/**'],
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              './tradeMachine/utils/capUtils*',
              '../tradeMachine/utils/capUtils*',
              '**/tradeMachine/utils/capUtils*',
            ],
            message: 'Import apron helpers from @/features/architect/utils/capUtils instead.',
          },
        ],
      },
    ],
  },
},
```

| Attribute             | Assessment                                         |
| --------------------- | -------------------------------------------------- |
| Enforcement mechanism | Lint error (IDE + CI)                              |
| Blast radius risk     | 🟢 LOW (won't break runtime)                       |
| Maintenance cost      | 🟢 LOW (stable rule)                               |
| What it catches       | Bypass imports to tradeMachine SSOT                |
| What it misses        | Inline raw comparisons, doesn't enforce delegation |

---

### Option C: Comment-Based Warning Markers + Test Scan

**Mechanism:**
Add `// APRON_DRIFT_ALLOWED: <reason>` markers to intentionally inline usages (UI warnings). Test scans for unmarked raw comparisons.

```javascript
// useCapValidation.js
// APRON_DRIFT_ALLOWED: UI warning only, not derivation
if (projectedCap > secondApron) { ... }
```

Test then scans for patterns WITHOUT the marker and fails.

| Attribute             | Assessment                                           |
| --------------------- | ---------------------------------------------------- |
| Enforcement mechanism | CI test failure                                      |
| Blast radius risk     | 🟢 LOW                                               |
| Maintenance cost      | 🟡 MEDIUM (requires adding markers to existing code) |
| What it catches       | Unmarked derivation patterns                         |
| What it misses        | Nothing if markers are consistently applied          |

---

## 5. Flagged Semantic Drift Risks

### 🚨 Sign-and-Trade Eligibility Check

**File:** [useCapValidation.js#L475](src/features/architect/hooks/useCapValidation.js#L475)

```javascript
if (currentYearCapHit > currentCapSettings.firstApron) {
  errors.push({
    severity: 'error',
    message: 'Team over First Apron - cannot execute sign-and-trade',
  });
}
```

**Issue:** This is **gating logic** (not UI-only) and uses `>` comparison. Per CBA, S&T receiving team cannot be **at or above** the first apron hard cap. This may need to be `>=` or should delegate to a canonical helper.

**Status:** Flagged for review in execution phase. DO NOT FIX in preflight.

---

### 🟡 Legacy `getAllowableIncomingMargin` in capUtils.js

**File:** [capUtils.js#L46](src/features/architect/utils/capUtils.js#L46)

```javascript
const isSecondApronTeam = teamTotalSalary > secondApron;
```

**Issue:** This deprecated function still has inline comparison. Should be removed or delegate to `isSecondApronTeam()` helper.

**Status:** Flagged for cleanup. Low priority since function is deprecated.

---

## 6. Recommended Next Execution Scope

### HIGH PRIORITY

1. **Fix S&T eligibility check** in `useCapValidation.js` - verify correct boundary semantics (`>` vs `>=` for first apron hard cap gating)
2. **Route `buildRuleContext.ts`** through canonical Architect surface instead of bypassing to tradeMachine

### MEDIUM PRIORITY

1. **Implement Option B** (ESLint no-restricted-imports) - low maintenance, catches bypass imports
2. **Implement Option A** (test scanner) - catches raw comparisons in new code

### LOW PRIORITY (OPTIONAL)

1. Clean up deprecated `getAllowableIncomingMargin` in capUtils.js
2. Consolidate UI warning comparisons in `useCapValidation.js` to use a helper (nice-to-have for consistency)

---

## Appendix: File Inventory

### Canonical Apron Surface (DO NOT TOUCH)

- `src/features/architect/utils/tradeMachine/utils/capUtils.js` - SSOT for `isSecondApronTeam`, `isFirstApronTeam`, `getTeamApronStatus`
- `src/features/architect/utils/capUtils.js` - Architect-level re-export facade

### Files with Apron Comparisons (Outside tradeMachine)

| File                      | Status           | Action                                |
| ------------------------- | ---------------- | ------------------------------------- |
| `useCapValidation.js`     | 🟡 UI + 1 gating | Review S&T check                      |
| `capUtils.js` (Architect) | 🟡 Deprecated fn | Clean up                              |
| `hardCapUtils.js`         | 🟢 OK            | Threshold check, not apron derivation |
| `ExceptionTracker.jsx`    | 🟢 OK            | Value display only                    |

### Import Bypass Files

| File                  | Status    | Action                  |
| --------------------- | --------- | ----------------------- |
| `buildRuleContext.ts` | 🟡 Bypass | Route through canonical |
| `tradeHelpers.js`     | 🟢 OK     | Explicit SSOT alias     |
| Test files (2)        | 🟢 OK     | Testing SSOT directly   |

---

**End of Preflight Return Package**
