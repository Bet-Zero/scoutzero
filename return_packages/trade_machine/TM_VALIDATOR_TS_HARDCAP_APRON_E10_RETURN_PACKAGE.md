# TM_VALIDATOR_TS_HARDCAP_APRON_E10 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative hard-cap/apron rule surface into TypeScript via `src/features/architect/utils/tradeMachine/rules/hardCapValidation.ts`.
- Migrated the authoritative hard-cap status helper surface into TypeScript via `src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts`.
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js` and `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js` are now pure compatibility re-export shims only, with no remaining business logic.
- Authoritative behavior was preserved in the live validator path: hard-cap legality, apron boundary handling, UNKNOWN fail-closed behavior, canonical `rules.hardCap` envelope compatibility, and the S&T-owned receiver hard-cap consequence all remained unchanged.
- Related business-logic JS remains only where this slice explicitly stopped: `tradeValidator.js` and `validateSalaryMatching.js`.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.ts`
  - New authoritative TS implementation of the live hard-cap/apron validator rule surface.
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
  - Reduced to a pure compatibility re-export shim.
- `src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts`
  - New authoritative TS implementation of the live hard-cap status helper surface.
- `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js`
  - Reduced to a pure compatibility re-export shim.
- `src/features/architect/utils/tradeMachine/constants/types.ts`
  - Hardened the minimal shared hard-cap status/result contracts needed by the authoritative TS path.
- `tests/trade/salaryMatching.test.js`
  - Added a targeted assertion proving the live salary-matching path still receives the same hard-cap status source/reason/ceiling metadata.
- `tests/validators/hardCap.test.js`
  - Refreshed helper-only legacy-surface assertions to canonical issue-text access.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E10 indexed migration entry.
- `return_packages/trade_machine/TM_VALIDATOR_TS_HARDCAP_APRON_E10_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `HardCapStatusResult`
  - Canonical hard-cap status metadata: source, reason, hard-cap type, ceiling, ceiling label, and fail-closed flag.
  - Applies to `getHardCapStatus()` and the live salary-matching/hard-cap rule path.
- `AuthoritativeHardCapResult`
  - Authoritative hard-cap rule result contract for the live validator path, including `hardCapStatus`, canonical/legacy hard-cap type fields, warnings, and cap limits.
  - Applies to `validateHardCap()` in `hardCapValidation.ts`.
- `HardCapCapLimits`
  - Typed first-/second-apron limit payload returned by the authoritative hard-cap rule.
  - Applies to `rules.hardCap` details passed through the live validator path.
- `ValidationIssueLike`
  - Narrow union allowing the authoritative hard-cap rule surface to remain behavior-preserving while still typing legacy string issue payloads.
  - Applies only to the authoritative hard-cap result contract.
- `CapSettings.apron` and `TeamContext.capSettings.apron`
  - Hardened optional alias for the existing first-apron fallback input already used by the hard-cap rule path.

## 4. Migration Work Completed
- `hardCapValidation.ts`
  - Ported the authoritative hard-cap/apron logic 1:1 into TS.
  - Preserved missing-cap-settings warnings, hard-cap legality, fail-closed UNKNOWN handling, cap-limit payload, legacy helper exports, and the existing second-apron incoming-S&T violation.
- `hardCapValidation.js`
  - Converted to a pure re-export shim only.
- `hardCapStatus.ts`
  - Ported the authoritative hard-cap status helper logic 1:1 into TS.
  - Preserved worldless-mode string-ignore behavior, source/reason labels, ceiling resolution, fail-closed semantics, and the default export shape.
- `hardCapStatus.js`
  - Converted to a pure re-export shim only.
- `constants/types.ts`
  - Added a dedicated authoritative hard-cap result type instead of reusing the older `HardCapResult` contract tied to the non-authoritative duplicate `validateHardCap.ts`.
  - This was the only minimal contract correction required by typing, and it avoided broadening the slice into that legacy duplicate surface.
- `tests/trade/salaryMatching.test.js`
  - Added a live-path assertion proving salary matching still receives `source`, `reason`, `hardCapCeiling`, `hardCapCeilingType`, and `hardCapCeilingLabel` from the typed helper.
- `tests/validators/hardCap.test.js`
  - Treated as helper-/legacy-surface evidence only.
  - Updated only the issue access style to canonical issue text; no behavior being proven was weakened.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Remains JS because this pass only required typed consumption of the hard-cap/apron rule/helper surfaces; no engine refactor was needed.
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
  - Remains JS because it is the next adjacent live consumer of `hardCapStatus` metadata and ceiling labels, but migrating that rule was explicitly out of scope for E10.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/tradeValidator.test.js tests/trade/salaryMatching.test.js tests/trade/secondApronBoundary.test.js src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js src/tests/trade/hardCap_salaryMatching.guardrail.test.js src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
  - `npm run test:node -- --reporter=dot tests/validators/hardCap.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS hard-cap rule/helper modules interoperate with the live validator path and the narrowed shared contracts.
  - The authoritative node suite proves live hard-cap legality, apron boundary behavior, UNKNOWN fail-closed handling, `rules.hardCap` reason parity, worldless hard-cap status behavior, salary-matching consumption of hard-cap metadata, and unchanged S&T receiver hard-cap consequence parity with apply.
  - `tests/validators/hardCap.test.js` is helper-only legacy-surface evidence; it does not gate authoritative live-path behavior for this pass.
  - `validate:project` proves the added TS files and shim structure remain project-schema compliant.
- Results:
  - PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
  - Reason: E10 was a narrow authoritative hard-cap/apron migration slice, and the targeted live-path suite already covered the touched validator/apply surfaces more directly than broader suites.

## 7. Remaining TS Migration Queue
- Next best slice: `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
- Reason: after E10, the remaining adjacent live JS consumer of hard-cap/apron status metadata and ceiling logic is salary matching, while the engine can continue consuming typed rule/helper modules through the shim paths.

## 8. Master Doc Update
- Added `Validator TS Hard-Cap Apron E10 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the active authoritative hard-cap/apron rule logic now lives in `rules/hardCapValidation.ts`.
- Recorded that the active authoritative hard-cap status helper now lives in `utils/hardCapStatus.ts`.
- Recorded that `hardCapValidation.js` and `hardCapStatus.js` are now pure compatibility re-export shims with no remaining business logic.
- Reaffirmed that the S&T-owned receiver hard-cap consequence remains unchanged in `rules/validateSignAndTrade.ts`.
- Recorded that the next migration slice should be `rules/validateSalaryMatching.js`.
