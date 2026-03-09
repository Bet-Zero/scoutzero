# TM_VALIDATOR_TS_TRADE_UTILITY_MISC_E31 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical `tradeUtilityMisc` helper surface from `src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js` to `src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.ts`.
- Behavior was preserved: the TS file is a line-faithful port of the live helper logic, keeping the same exports, date handling, formatting quirks, coercion quirks, fallback quirks, protection detection, pick-option ordering, and normalization behavior.
- No directly related business-logic area had to remain JS for this surface itself. `src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js` remains JS only as the required pure compatibility re-export shim, and `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` remains the existing JS compatibility barrel by design.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.ts`
  - Added the authoritative TypeScript implementation for the live `tradeUtilityMisc` helper surface.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `tests/trade/tradeUtilityMisc_surface.test.js`
  - Added direct surface coverage proving helper identity and representative behavior through both `tradeUtilityMisc.js` and `tradeUtilities.js`.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E31 migration entry and recorded the post-E31 helper state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_UTILITY_MISC_E31_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `TradeUtilityMiscProtectionMetaLike`
  - Represents the narrow `protectionMeta` shape actually read by `isMeaningfulProtection`.
  - Applies in `tradeUtilityMisc.ts` when evaluating structured protection metadata without widening the helper contract.
- `TradeUtilityMiscProtectionCarrierLike`
  - Represents the narrow object shape that may carry `protectionMeta` and/or `protection`.
  - Applies in `tradeUtilityMisc.ts` for the current object-or-string fallback behavior used by `isMeaningfulProtection`.
- `TradeUtilityMiscPickOption`
  - Represents the concrete `{ label, value }` row shape returned by `getPickOptions`.
  - Applies in `tradeUtilityMisc.ts` to the canonical pick-option helper path re-exported through `tradeUtilities.js`.

## 4. Migration Work Completed
- `utils/tradeUtilityMisc.ts`
  - Ported the live JS helper surface line-faithfully into TS with file-local types only.
  - Preserved:
    - current falsy handling in `isExpired`, `formatDate`, `formatSalary`, and `normalizeProtectionValue`
    - current `Date` construction and comparison behavior, including awkward edge behavior
    - current `formatDate(...).toLocaleDateString('en-US', ...)` output behavior
    - current `formatSalary((amount || 0).toLocaleString())` coercion behavior
    - current `protectionMeta` precedence and string fallback behavior in `isMeaningfulProtection`
    - current swap-string handling in `isMeaningfulProtection` and `normalizeProtectionValue`
    - current `getPickOptions()` values and ordering
  - Minimal contract correction required by typing:
    - kept all new types local to `tradeUtilityMisc.ts` so the live helper surface could be typed safely without redesigning shared types or downstream helper semantics.
- `utils/tradeUtilityMisc.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E31.
- Direct/barrel compatibility proof
  - Added a focused surface test proving the same exported helper identity and the same representative helper behavior through both `tradeUtilityMisc.js` and `tradeUtilities.js`, not just the direct shim path.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js`
  - Remains JS only as the required pure compatibility re-export shim for stable `.js` imports.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Remains JS because E31 only migrates the canonical `tradeUtilityMisc` business logic. The barrel is already a thin compatibility layer spanning mixed helper families, and migrating it in this pass would broaden scope without changing runtime behavior.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/tradeUtilityMisc_surface.test.js src/tests/tradeMachine/conveyancePreflight.test.js src/tests/tradeMachine/draftPicksPreflight.test.js tests/validators/stepien.test.js tests/hasStepienViolation.test.js tests/tradeValidator.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the TS-backed helper surface compiles cleanly against the existing JS/TS validator-adjacent graph while preserving `.js` import stability.
  - `tests/trade/tradeUtilityMisc_surface.test.js`
    - Direct helper-surface coverage proving export identity and representative behavior parity through both `tradeUtilityMisc.js` and `tradeUtilities.js` for `isExpired`, `formatDate`, `formatSalary`, `normalizeProtectionValue`, `isMeaningfulProtection`, and `getPickOptions`.
  - `src/tests/tradeMachine/conveyancePreflight.test.js`
    - Direct helper-adjacent coverage proving unchanged `isMeaningfulProtection` and `getPickOptions` behavior on the live barrel-backed conveyance path, including `protectionMeta` handling and swap-string treatment.
  - `src/tests/tradeMachine/draftPicksPreflight.test.js`
    - Direct Stepien-adjacent coverage proving unchanged string-protection handling through the live `validateStepien.js` path.
  - `tests/validators/stepien.test.js`
    - Direct rule coverage proving unchanged Stepien legality behavior when protected picks rely on `isMeaningfulProtection`.
  - `tests/hasStepienViolation.test.js`
    - Validator-adjacent helper coverage proving unchanged `hasStepienViolation()` behavior through `draftRules.js`, which still consumes the barrel-backed protection helper path.
  - `tests/tradeValidator.test.js`
    - Authoritative validator-path coverage proving unchanged top-level trade legality behavior when protected picks flow through `validateTrade()`.
  - `npm run validate:project`
    - Proves the final file layout still satisfies repo structural validation after adding `tradeUtilityMisc.ts`.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot ...`: PASS
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E31 is a narrow helper migration slice. The direct helper-surface test, existing conveyance/Stepien/validator-adjacent suites, typecheck, and project-structure validation provide direct proof of behavior preservation without broadening into unrelated validation areas.

## 7. Remaining TS Migration Queue
- Based on the actual post-E31 state, the next TS slice should be selected from the remaining live JS validator-adjacent holdouts rather than hardcoded in advance.
- `src/features/architect/utils/tradeMachine/rules/draftRules.js` is a likely next candidate because it still contains live JS business logic, is consumed by validator-adjacent paths, and still depends on the now-TS-backed protection helper surface.
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the actual post-E31 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS Trade Utility Misc E31 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `tradeUtilityMisc` surface now lives in `utils/tradeUtilityMisc.ts`.
- Recorded that `utils/tradeUtilityMisc.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that `utils/tradeUtilities.js` remains the JS compatibility barrel for the mixed helper surface.
- Recorded that validator-adjacent helper semantics remained unchanged, including current date/formatting quirks, protection detection, pick-option ordering, and protection normalization/coercion/fallback behavior.
- Recorded that targeted parity now includes direct-vs-barrel assertions proving the same helper identity and representative helper behavior through both `tradeUtilityMisc.js` and `tradeUtilities.js`.
- Recorded that the next best TS slice should be selected from the actual post-E31 holdouts, with `rules/draftRules.js` noted as a likely candidate rather than a hardcoded requirement.
