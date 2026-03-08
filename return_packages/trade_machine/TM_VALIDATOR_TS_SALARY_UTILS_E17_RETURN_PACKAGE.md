# TM_VALIDATOR_TS_SALARY_UTILS_E17 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the salary-utils compatibility surface into TypeScript via `src/features/architect/utils/tradeMachine/utils/salaryUtils.ts`.
- Preserved authoritative behavior for `computeMatchingValues` passthrough, `getCapHitForSeason` passthrough, and the legacy `getIncomingCeilingForTeam` wrapper semantics adjacent to the typed matching-values and salary-matching surfaces.
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js` now contains no remaining business logic and is a pure compatibility re-export shim only.
- Directly related helper families still remained JS where E17 could consume them safely without broadening the slice.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.ts`
  - Added the TS-backed salary-utils wrapper implementation.
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js`
  - Reduced to a pure compatibility re-export shim so existing `.js` imports remain stable and no business logic remains in JS.
- `tests/salaryUtils.test.js`
  - Added focused helper-surface coverage for wrapper delegation, passthrough behavior, and legacy ceiling compatibility semantics.
- `tests/tradeValidator.test.js`
  - Strengthened the existing engine-facing BYC parity assertion so the authoritative validator path explicitly proves unchanged salary-utils-mediated matching-value behavior after E17.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E17 indexed migration entry and recorded the post-E17 state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_SALARY_UTILS_E17_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `SalaryUtilsPlayer`
  - Represents the compatibility-wrapper player shape for `sends[]`, including `matchOutgoing`.
  - Applies to `getIncomingCeilingForTeam()` in the TS-backed salary-utils path.
- `SalaryUtilsCapSettings`
  - Represents the wrapper cap-settings shape, including legacy `cap` alias support alongside `salaryCap`.
  - Applies to `getIncomingCeilingForTeam()` when preserving the existing cap-settings fallback chain.
- `SalaryUtilsTeamData`
  - Represents the nested `team` shape read by the wrapper, including `isOverCap` and `totalSalary`.
  - Applies to the legacy under-cap short-circuit and nested salary fallback behavior in `getIncomingCeilingForTeam()`.
- `SalaryUtilsTeam`
  - Represents the compatibility-wrapper team input carrying `sends`, `context.capSettings`, `team`, and `teamTotalSalary`.
  - Applies to the exported `getIncomingCeilingForTeam()` helper surface.

## 4. Migration Work Completed
- `salaryUtils.ts`
  - Ported the live wrapper behavior 1:1 from JS to TS.
  - Preserved:
    - canonical `computeMatchingValues()` delegation
    - direct `getCapHitForSeason()` passthrough to `seasonUtils.js`
    - `getIncomingCeilingForTeam()` behavior for missing input, `sends[].matchOutgoing` summation, `Number.MAX_SAFE_INTEGER` under-cap compatibility path, `teamTotalSalary -> team.totalSalary` fallback, and `salaryCap -> cap` fallback before delegating to `getSalaryMatchingResult()`
  - Typing was kept file-local and narrow; no shared validator contract changes were required.
- `salaryUtils.js`
  - Converted to a shim-only compatibility export.
  - No business logic remains in the JS file after E17.
- `tests/salaryUtils.test.js`
  - Added explicit helper-surface locks proving:
    - wrapper delegation still matches canonical `matchingValues`
    - `getCapHitForSeason` still mirrors `seasonUtils`
    - legacy `getIncomingCeilingForTeam` compatibility semantics remain unchanged
- `tests/tradeValidator.test.js`
  - Preserved and strengthened the authoritative validator-path parity lock:
    - BYC recomputation still occurs through `salaryUtils.js` before salary-matching legality runs
    - the live engine still receives `matchOutgoing = 10_000_000` and `matchIncoming = 20_000_000`
    - downstream `salaryOut`, `salaryIn`, and salary-matching legality remain unchanged
- Minimal contract correction required by typing:
  - None at the runtime contract level.
  - E17 only hardened the wrapper-local input types needed to port the existing behavior safely.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js`
  - Remains JS only as the required compatibility import surface; it is now shim-only and contains no business logic.
- `src/features/architect/utils/tradeMachine/utils/seasonUtils.js`
  - Remained JS because `salaryUtils.ts` can consume it safely as-is, and migrating it here would broaden E17 into the shared season-helper family.
- `src/features/architect/utils/tradeMachine/utils/salaryMargin.js`
  - Remained JS because it is a separate helper family with different inputs and semantics; E17 intentionally preserved `salaryUtils.getIncomingCeilingForTeam()` rather than folding it into `salaryMargin`.
- `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js`
  - Remained JS because it is already a pure compatibility wrapper only and was not a business-logic blocker for E17.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/salaryUtils.test.js tests/newSchemaValidation.test.js tests/tradeValidator.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS-backed salary-utils wrapper compiles cleanly against the existing JS/TS consumer graph and keeps the stable `.js` import surface.
  - `tests/salaryUtils.test.js` is helper-level coverage proving the salary-utils wrapper still delegates to canonical matching-values logic, still mirrors `seasonUtils`, and still preserves the legacy incoming-ceiling wrapper semantics.
  - `tests/newSchemaValidation.test.js` is helper-level compatibility coverage proving salary extraction and matching-value mutation behavior still work through the migrated salary-utils-adjacent path.
  - `tests/tradeValidator.test.js` is authoritative live-path coverage proving the validator still sees unchanged salary-utils-mediated BYC recomputation and unchanged downstream `salaryOut` / `salaryIn` salary-matching effects.
- Results:
  - PASS.
  - `npm run test:node ...`: 3 files passed, 34 tests passed.
  - `npm run validate:project`: PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason:
  - E17 was a narrow wrapper-surface migration. The targeted helper and engine-facing node gates provided more direct proof of salary-utils behavior preservation than broader suites for this slice.

## 7. Remaining TS Migration Queue
- Based on the actual post-E17 state, `src/features/architect/utils/tradeMachine/utils/seasonUtils.js` is the likely next best TS migration slice.
- Why it is the likely next slice now:
  - `salaryUtils.ts` and `matchingValues.ts` both still consume it directly.
  - It still owns year normalization and cap-hit lookup under the validator-adjacent salary helper path.
- This is not hardcoded as mandatory:
  - another remaining holdout should be chosen instead if the actual post-E17 dependency graph or risk profile makes it the better next step.

## 8. Master Doc Update
- Added `Validator TS Salary Utils E17 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the salary-utils surface now lives in `utils/salaryUtils.ts`.
- Recorded that `utils/salaryUtils.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent salary helper semantics remained unchanged, including `computeMatchingValues` passthrough, `getCapHitForSeason` passthrough, legacy `getIncomingCeilingForTeam` behavior, and downstream validator salary effects.
- Recorded that the next best slice should be chosen from the actual post-E17 holdouts, with `utils/seasonUtils.js` noted as a likely but not mandatory candidate.
