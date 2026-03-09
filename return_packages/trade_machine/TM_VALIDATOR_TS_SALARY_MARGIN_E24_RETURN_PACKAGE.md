# TM_VALIDATOR_TS_SALARY_MARGIN_E24 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative `salaryMargin` helper surface from `src/features/architect/utils/tradeMachine/utils/salaryMargin.js` to `src/features/architect/utils/tradeMachine/utils/salaryMargin.ts`.
- Behavior was preserved: post-trade apron clamp order, under-cap cap-room handling, over-cap margin delegation through `calculateAllowableIncoming`, used-TPE and FA-exception add-on behavior, incoming-ceiling branch order, numeric fallback behavior, and debug `console.log` payloads remained unchanged.
- `src/features/architect/utils/tradeMachine/utils/salaryMargin.js` remains JS only as a pure compatibility shim so existing `.js` imports stay stable. `src/features/architect/utils/tradeHelpers.js` also remains JS because it is the direct dependency for `calculateAllowableIncoming` and migrating it here would broaden the slice beyond `salaryMargin`.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/salaryMargin.ts`
  - Added the authoritative TS implementation for the live `salaryMargin` helper surface.
- `src/features/architect/utils/tradeMachine/utils/salaryMargin.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `src/features/architect/utils/tradeMachine/validators/index.js`
  - Corrected stale compatibility export paths (`validateHardCap.js` → `hardCapValidation.js`, `validateTiming.js` / `enforceTiming.js` → `timingValidation.js`) so the validator compatibility index remains importable while `salaryMargin.js` stays on a shim path.
- `tests/salaryMargin.test.js`
  - Expanded direct helper coverage for wrapper extraction, payroll-resolution priority, post-trade apron clamps, and used-TPE / FA-exception additive margin behavior.
- `tests/smoke/imports.smoke.test.js`
  - Added `.js` import-stability coverage for direct `salaryMargin.js`, the Trade Machine public index, and the validator compatibility index.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E24 migration entry and updated the master timestamp.
- `return_packages/trade_machine/TM_VALIDATOR_TS_SALARY_MARGIN_E24_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `NumericLike`
  - Represents the existing number-or-string inputs already accepted by `salaryMargin`.
  - Applies across cap-settings, payroll, outgoing-salary, and incoming-bucket fields in `salaryMargin.ts`.
- `SalaryMarginIncomingPlayer`
  - Represents the narrow incoming-player shape consumed by `salaryMargin`, including `absorptionMode`, `matchIncoming`, and `tpeAmount`.
  - Applies to the used-TPE and FA-exception additive-margin logic.
- `SalaryMarginCapSettings`
  - Represents the narrow cap-settings fields consumed by the helper.
  - Applies to cap-room and apron-clamp calculation inside the authoritative `salaryMargin` path.
- `SalaryMarginPostTradeStatus`
  - Represents the post-trade status flags and projected payroll field read by the helper.
  - Applies to the `isAtOrAboveFirstApron` / `isAtOrAboveSecondApron` clamp path and payroll resolution.
- `SalaryMarginTeamData` / `SalaryMarginTeamWrapper`
  - Represent the direct team shape and wrapped team-like inputs accepted by `getAllowableIncomingMargin`.
  - Apply to wrapper extraction, payroll resolution, and ceiling calculation without widening broader validator contracts.

## 4. Migration Work Completed
- `utils/salaryMargin.ts`
  - Ported the live helper logic 1:1 from JS to TS with narrow local types only.
  - Preserved:
    - current `getTeamObject()` extraction behavior
    - current `resolvePayroll()` usage and candidate priority
    - current post-trade apron clamp precedence
    - current under-cap cap-room behavior
    - current over-cap margin delegation to `calculateAllowableIncoming(...)`
    - current used-TPE and FA-exception additive behavior
    - current `getIncomingCeilingForTeam()` branch order and return behavior
    - current debug log payload keys and values
  - Minimal contract correction required by typing:
    - None in the authoritative helper logic itself.
- `utils/salaryMargin.js`
  - Converted to a shim-only compatibility export.
  - Preserved `.js` import-path stability for remaining JS and TS consumers.
- Immediate compatibility touchpoint
  - `validators/index.js` required a minimal correction after the new smoke coverage exposed stale exports to non-existent files.
  - This was not a semantic redesign; it restored the existing compatibility layer so the validator-adjacent `.js` import path remains loadable alongside the new `salaryMargin` shim.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/salaryMargin.js`
  - Remains JS only as the required pure shim for stable `.js` imports.
- `src/features/architect/utils/tradeHelpers.js`
  - Remains JS because `salaryMargin` still delegates to `calculateAllowableIncoming` there; migrating that helper family would broaden E24 beyond the requested slice.
- `src/features/architect/utils/tradeMachine/utils/index.js`
  - Remains JS because it is only a public barrel and did not need logic changes; the shim preserves export stability.
- `src/features/architect/utils/tradeMachine/index.js`
  - Remains JS because it is the Trade Machine public barrel; no migration was required once the shim path was stable.
- `src/features/architect/utils/tradeMachine/validators/index.js`
  - Remains JS because it is a deprecated compatibility barrel; only minimal stale-path corrections were needed to preserve importability.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/salaryMargin.test.js tests/trade/firstApron_100pct.test.js tests/capUtils.test.js tests/smoke/imports.smoke.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the new TS-backed `salaryMargin` helper compiles cleanly against the current JS/TS consumer graph.
  - `tests/salaryMargin.test.js`
    - Helper-only coverage proving unchanged direct `salaryMargin` behavior for apron clamps, cap-room margin, over-cap band delegation, wrapper extraction, payroll-resolution priority, and used-bucket additive margin semantics.
  - `tests/trade/firstApron_100pct.test.js`
    - Helper-only coverage proving the direct `.js` path still clamps first- and second-apron incoming ceilings to outgoing salary.
  - `tests/capUtils.test.js`
    - Proves the adjacent TS-backed `capUtils` dependency still provides unchanged apron thresholds, wrapper extraction, and payroll helpers consumed by `salaryMargin`.
  - `tests/smoke/imports.smoke.test.js`
    - Proves `.js` import stability through the direct helper path, the Trade Machine public index, and the validator compatibility index.
  - `npm run validate:project`
    - Proves the final file layout still satisfies repo structural validation after adding `salaryMargin.ts`.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot tests/salaryMargin.test.js tests/trade/firstApron_100pct.test.js tests/capUtils.test.js tests/smoke/imports.smoke.test.js`: PASS (4 files, 36 tests)
  - `npm run validate:project`: PASS
- Notes:
  - The first run of the targeted node command surfaced stale compatibility exports in `src/features/architect/utils/tradeMachine/validators/index.js`; after the minimal path corrections described above, the exact same command passed without further changes.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - any full-suite command
- Reason skipped:
  - E24 is a narrow helper migration slice. The targeted helper, adjacent-helper, and smoke coverage provided direct proof of behavior preservation and import stability without broadening into unrelated suites.

## 7. Remaining TS Migration Queue
- The next best TS migration slice after E24 is `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js`.
- Why it is the best next slice:
  - it remains live JS rule logic imported directly by `tradeValidator.ts`
  - it is already part of the public Trade Machine validator graph
  - it is narrower and closer to the authoritative validator path than broader barrel or utility families

## 8. Master Doc Update
- Added `Validator TS Salary Margin E24 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `salaryMargin` helper surface now lives in `utils/salaryMargin.ts`.
- Recorded that `utils/salaryMargin.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent `salaryMargin` semantics remained unchanged, including clamp order, cap-room handling, used-bucket additions, incoming-ceiling behavior, and debug payloads.
- Recorded that targeted parity now includes expanded direct helper coverage plus smoke assertions proving unchanged `.js` import compatibility through the direct helper path, the public index, and the validator compatibility index.
- Recorded that `rules/validateFaExceptionUsage.js` is the best likely next TS slice after E24.
