# TM_VALIDATOR_TS_VALIDATION_ISSUE_TEXT_E14 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical validation issue normalization / text helper surface into TypeScript via `src/features/architect/utils/tradeMachine/utils/validationIssueText.ts`.
- Preserved current normalization behavior for raw strings, legacy object issue shapes, and canonical `ValidationIssue` objects, along with current direct/first/summary text helper behavior.
- `src/features/architect/utils/tradeMachine/utils/validationIssueText.js` is now a pure compatibility re-export shim only, with no remaining business logic.
- No authoritative issue-text helper area had to remain JS in this pass.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/validationIssueText.ts`
  - Added the authoritative TS-backed issue normalization and text helper implementation.
- `src/features/architect/utils/tradeMachine/utils/validationIssueText.js`
  - Reduced to a pure compatibility re-export shim so existing `.js` imports remain stable.
- `src/tests/tradeMachine/validationIssueText.contract.test.ts`
  - Added direct helper contract coverage for normalization, text derivation, fallback behavior, meta extraction, and string coercion.
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`
  - Added the minimal engine-facing TS-safe envelope casts/string handling needed for the typed helper to be consumed without changing behavior.
- `tests/trade/validatorContractCleanup.test.js`
  - Added an explicit engine-facing parity assertion proving top-level `reason` still matches first normalized issue text on a fail-fast path.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E14 indexed migration entry and recorded the post-E14 state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATION_ISSUE_TEXT_E14_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `ValidationIssueDefaults`
  - Narrow fallback/defaults shape used by `createValidationIssue()` and `normalizeValidationIssues()`.
  - Applies at the authoritative helper boundary for fallback `message`, `severity`, `rule`, `code`, `details`, and `meta`.
- `LegacyValidationIssueObject`
  - Local legacy input shape accepted by the helper for pre-canonical issue payloads.
  - Applies to legacy object normalization in `validationIssueText.ts`.
- `ValidationIssueInput`
  - Local helper-boundary union for canonical issues, legacy issue objects, raw strings, current scalar fallbacks (`number` / `boolean`), and nullish inputs.
  - Applies to all authoritative normalization/text helper entrypoints without widening shared validator result types.

## 4. Migration Work Completed
- `validationIssueText.ts`
  - Ported the live helper into TypeScript while preserving:
    - canonical issue detection requirements (`message` + `rule` + `code`)
    - raw string trimming and scalar stringification behavior
    - legacy message derivation order (`message` → `reason` → string `details` → `code` → `type`)
    - severity/rule/code fallback behavior
    - `details` passthrough behavior
    - default-meta + issue-meta + extra-field merge semantics
    - non-enumerable `toString` / `valueOf` / `Symbol.toPrimitive` string coercion hooks
    - direct issue text, first issue text, and summary text helper behavior
- `validationIssueText.js`
  - Converted to a shim-only compatibility export.
  - No business logic remains in the JS file after E14.
- `validationIssueText.contract.test.ts`
  - Added direct helper-only regressions for canonical passthrough, raw/legacy normalization, fallback semantics, meta extraction, null filtering, text helpers, and string coercion.
- `tradeValidator.ts`
  - Kept the authoritative engine consuming the same helper surface while making the existing generic rule-envelope reads TS-safe.
  - Preserved behavior by only narrowing `rawResult.message` to string and explicitly typing `rawResult.violations` / `rawResult.warnings` at the helper call boundary.
- `validatorContractCleanup.test.js`
  - Added a focused parity lock proving engine top-level `reason` still resolves from the first normalized violation text on fail-fast routing output.
- Minimal contract correction required by typing:
  - None. Shared validator issue/result semantics did not need to change; the broader accepted legacy-input typing stayed local to `validationIssueText.ts`.

## 5. JS Holdouts
- None in the authoritative issue-text / normalization helper surface.
- Existing JS consumer files such as `src/features/architect/utils/tradeContext/tradeContext.js` and UI consumer components remain JS by design because E14 was limited to the canonical helper surface and preserved import-path compatibility instead of broadening into consumer migration.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot src/tests/tradeMachine/validationIssueText.contract.test.ts tests/trade/validatorContractCleanup.test.js src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`
  - `npm run test:ui -- --reporter=dot src/tests/trade/validatorContractConsumers.test.jsx`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS-backed helper compiles cleanly against the live TS engine/rule graph while preserving current `.js` import compatibility.
  - `validationIssueText.contract.test.ts` is helper-only coverage proving canonical issue detection, raw/legacy normalization, fallback semantics, meta extraction, text helpers, and string coercion behavior.
  - `validatorContractCleanup.test.js` proves canonical engine result shaping remains unchanged and now explicitly locks top-level `reason` parity with first normalized issue text.
  - `signAndTrade.failClosed.guardrail.test.ts`, `hardCap_reasonParity.guardrail.test.ts`, and `tradeApply_timingWarnings.behavior.test.ts` prove live engine/rule/apply consumers still render the same issue text and summary/reason-facing behavior.
  - `validatorContractConsumers.test.jsx` proves the JS consumer surface still renders canonical blocker/warning text through the shim-backed helper path.
- Results:
  - PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason:
  - E14 was a narrow helper migration. The targeted node/UI regressions plus `typecheck` and `validate:project` directly covered the authoritative issue normalization/text path, engine `reason` parity, and live consumer compatibility more precisely than broader suites.

## 7. Remaining TS Migration Queue
- Next best slice should be chosen from the actual post-E14 state rather than hardcoded in advance.
- `src/features/architect/utils/tradeMachine/engine/validationUtils.js` is a likely next candidate because it remains an engine-adjacent authoritative helper holdout after E14.
- Other remaining engine-adjacent holdouts should still be compared from the real post-E14 graph before committing the next slice.

## 8. Master Doc Update
- Added `Validator TS Validation Issue Text E14 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the canonical issue-text / normalization helper surface now lives in `utils/validationIssueText.ts`.
- Recorded that `utils/validationIssueText.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator issue/result semantics remained unchanged, including top-level `reason` derivation and helper text behavior.
- Recorded that the next slice should be chosen from the actual post-E14 state, with `engine/validationUtils.js` noted as a likely but not mandatory candidate.
