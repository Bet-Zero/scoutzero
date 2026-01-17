# 2026-01-17_CAP_RULES_PROFILE_PHASE_3_MIN_SALARY_SYSTEM

## 1. Preflight Findings

### What min salary scale data exists today?

- **Full YOS Scales**: `src/features/architect/data/minimumSalaryScales.ts` contains full Years-of-Service (0-10+) scales for **2024-25** and **2025-26** only.
- **Rookie Minimums**: `src/features/architect/utils/capProjections.js` contains `rookieMin` (0 YOS) values for **2024-25 through 2031-32** (now modified).

### Which seasons are real vs missing?

- **Real (Confirmed)**:
  - **2024-25**: Full scale in `minimumSalaryScales.ts`, confirmed `rookieMin` in `capProjections.js`.
  - **2025-26**: Full scale in `minimumSalaryScales.ts` (projected ~4%), `rookieMin` in `capProjections.js`.
- **Projected (Dynamic)**:
  - **2026-27+**: Previously had hardcoded "magic 4%" values. These have been removed from `capProjections.js` to enforce the new deterministic projection policy.

### Is there any existing cap-growth projection function we can reuse?

- Removed hardcoded values in favor of a dynamic projection rule implemented in `capRulesProfile.ts`.

## 2. Implementation Execution

### A) Min Salary Resolution Policy

- **Provenance Fields**: Added `rookieMinSource: 'real'` to `capProjections.js` for known years.
- **Deterministic Projection**: Implemented in `capRulesProfile.ts`.
  - **Logic**: If `rookieMin` is missing, it is calculated by applying the Salary Cap YoY growth ratio to the previous year's rookie minimum.
  - **Formula**: `RookieMin(Y) = RookieMin(Y-1) * (Cap(Y) / Cap(Y-1))`
  - **Recursive**: Can verify projection chains across multiple missing years.

### B) Scale Integration

- **New Interface**: Added `salaries.getMinimumForYOS(yos)` to `CapRulesProfile`.
- **Logic**:
  1. Checks `minimumSalaryScales.ts` for an explicit scale for the season.
  2. If found, returns exact value (capped at 10 YOS).
  3. If missing (future years), falls back to the resolved `rookieMin` (0 YOS) and logs a warning for non-rookie YOS requests (to prevent silent invention of veteran scales).

### C) Validation

- **Unit Tests**: Updated `src/tests/architect/utils/capRulesProfile.test.ts`.
  - Verified `rookieMinSource` is 'real' for 2024-25.
  - Verified `rookieMinSource` is 'projected' for 2026-27.
  - Verified projection value matches Cap Growth (approx 7% for 2026-27) rather than fixed 4%.
  - Verified recursive projection for 2028-29.
- **Build**: `npm run build` passed.
- **Tests**: `npx vitest` passed.

## 3. Master Doc Updates

- Updated `docs/architect/CAP_RULES_PROFILE_MASTER_DOC.md`:
  - Recorded resolution of Conflict 3 (Min Salary Missing).
  - Defined new `SalaryScales` interface.
  - Documented Projection Policy.

## 4. Next Steps

- Monitor CBA updates for official scales for 2026-27+.
- Future Phase: Populate `minimumSalaryScales.ts` with real data as it becomes available to replace projections.
