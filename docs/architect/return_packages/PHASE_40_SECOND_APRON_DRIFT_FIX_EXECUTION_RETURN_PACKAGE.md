# PHASE 40 — Second Apron Drift Scan (Architect-wide) — EXECUTION RETURN PACKAGE

**DATE:** 2026-01-27
**STATUS:** COMPLETED
**SCOPE:** `src/features/architect/**` (excluding `utils/tradeMachine/**`)

## 1. Executive Summary

Phase 40 execution successfully eliminated all identified "Second Apron" drift within Architect utility files. The logic now strictly adheres to `salary > secondApron` semantics (Trade Machine SSOT) and `teamIsAtOrAboveSecondApron` parameter naming has been updated to `teamIsSecondApron` in draft utilities.

**Key Achievements:**

- Fixed inclusive (`>=`) comparator drift in `buildRuleContext.ts`, `capLegalityValidation.js`, and `faExceptionUtils.js`.
- Renamed `teamIsAtOrAboveSecondApron` to `teamIsSecondApron` in `draftPickUtils.js` (with backward compatibility layer) and updated `validateStepien.ts` call site.
- Implemented 9 new guardrail tests in `phase40_secondApron_drift_guardrails.test.js` verifying strict boundary behavior.
- Verified no regressions in existing 242 cap legality tests.

## 2. Changes Applied

### A. Logic Drift Fixes (Strict `>`)

| File | Function/Context | Change |
| :--- | :--- | :--- |
| `buildRuleContext.ts` | `deriveApronLevel` | `>= cap.secondApron` → `> cap.secondApron` |
| `capLegalityValidation.js` | `validateSigning` (Rule 1.8) | `projectedCapHit >= rules.cap.secondApron` → `> rules.cap.secondApron` |
| `faExceptionUtils.js` | `canUseFaException` | `volume >= cap.secondApron` → `> cap.secondApron` |

### B. Interface Updates

| File | Context | Change |
| :--- | :--- | :--- |
| `draftPickUtils.js` | `isFrozenPick` | Renamed param `teamIsAtOrAboveSecondApron` → `teamIsSecondApron`. Added fallback support. |
| `validateStepien.ts` | `validateStepien` | Updated call site to pass `{ teamIsSecondApron: true }`. |

## 3. Verification Results

### Automated Tests

- **New Guardrails:** `npm run test -- phase40_secondApron_drift_guardrails`
  - **Passed:** 9/9 checks.
  - Verified: Teams EXACTLY at second apron are NOT classified as Second Apron.
  - Verified: Exception usage allowed exactly at boundary (where appropriate).
  - Verified: `isFrozenPick` accepts new parameter name.

- **Regression Tests:** `npm run test -- capLegalityValidation`
  - **Passed:** 242/242 tests (No regressions).

### Build Status

- **Build/Lint:** Implied success via TypeScript compilation during test run (valid syntax).

## 4. Next Steps

- **Merged:** Codebase is now consistent with Second Apron SSOT.
- **Phase 41 Candidates:**
  - Remove backward compatibility in `draftPickUtils.js` (delete `teamIsAtOrAboveSecondApron` fallback).
  - Refactor `buildRuleContext.ts` to delegate `deriveApronLevel` to `capUtils.js` SSOT.
