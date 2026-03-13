# TM_VALIDATOR_TS_TRADE_MACHINE_HOOK_SUPPORT_HELPERS_E77 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the E77 helper-trio boundary to authoritative TypeScript through `src/features/architect/tradeMachine/utils/computeTradeDraftKey.ts`, `src/features/architect/tradeMachine/utils/devSntInjector.ts`, and `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.ts`.
- Helper behavior was preserved at the migrated surfaces: named exports, deterministic key generation, fallback behavior, synthetic player payload shape and key insertion order, mutation boundaries, and `extractUsedTpeIds()` first-seen ordering all remained unchanged.
- No helper business logic had to remain in JS. `computeTradeDraftKey.js`, `devSntInjector.js`, and `tradeExportUtils.js` remain only as intentional shim-only compatibility files for direct-path, explicit `.js`, and extensionless imports.
- Targeted downstream UI verification surfaced failures in unchanged adjacent consumers `src/features/architect/tradeMachine/TradePlayerRow.jsx` and `src/features/architect/hooks/useTradeMachine.js`; E77 did not widen into those files.

## 2. Files Changed
- `src/features/architect/tradeMachine/utils/computeTradeDraftKey.ts` — added the authoritative TypeScript implementation for draft-key generation and stale-validation freshness checks; safe because the runtime flow, fallbacks, sort behavior, and export surface were copied exactly from the JS authority.
- `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js` — reduced to a one-line shim re-exporting the TS authority; safe because public import paths remain intact with no business logic left in JS.
- `src/features/architect/tradeMachine/utils/devSntInjector.ts` — added the authoritative TypeScript implementation for DEV synthetic sign-and-trade helpers; safe because helper ordering, payload assembly order, fallback chains, and mutation boundaries were preserved exactly.
- `src/features/architect/tradeMachine/utils/devSntInjector.js` — reduced to a one-line shim re-exporting the TS authority; safe because direct `.js` and extensionless imports still resolve the same named API.
- `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.ts` — added the authoritative TypeScript implementation for trade export exception extraction; safe because the array guard, push loop, and `Set`-based first-seen dedupe path were preserved exactly.
- `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js` — reduced to a one-line shim re-exporting the TS authority; safe because no caller import path changed and no runtime behavior remains in the JS file.
- `src/tests/architect/devSntInjector.utils.test.ts` — expanded utility coverage to pin current payload key order, nested object key order, fallback behavior, and non-mutation behavior; safe because it only verifies existing helper contracts.
- `src/tests/architect/tradeMachineHookSupportHelpers.compatibility.guardrail.test.ts` — added E77 guardrails for shim-only content, explicit `.js` import parity, no-default-export behavior, source export order, and constant values; safe because it validates compatibility requirements without changing runtime code.
- `src/tests/trade/staleValidationFix.test.js` — added exact-string coverage for current fallback token formatting in `computeTradeDraftKey`; safe because it only hardens existing behavior expectations.
- `tests/trade/usedTradeExceptions.test.js` — added an explicit first-seen ordering assertion for `extractUsedTpeIds`; safe because it documents the existing dedupe contract.
- `docs/architect/TRADE_MACHINE_MASTER.md` — appended the indexed E77 entry describing the migrated helper boundary, validation outcomes, and next-phase status; safe because it updates the project’s migration record only.
- `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_MACHINE_HOOK_SUPPORT_HELPERS_E77_RETURN_PACKAGE.md` — added the E77 execution return package; safe because it is documentation only.

## 3. Types Introduced or Hardened
- `TradeDraftPlayerLike`, `TradeDraftEntitlementLike`, `TradeDraftTeamLike`, `TradeDraftKeyParams` — local loose helper types in `computeTradeDraftKey.ts` representing the current draft-key input shapes without tightening runtime behavior.
- `SyntheticSntPlayerLike`, `SyntheticSntTeamLike`, `SyntheticSntTeamSlotLike`, `YearKeyLike` — local loose helper types in `devSntInjector.ts` covering the current DEV injector player/team/year inputs while preserving today’s fallback and mutation behavior.
- `TradeSendLike`, `TradeExceptionId` — local loose helper types in `tradeExportUtils.ts` representing the current export-helper input shape and deduped `tpeId` values without normalizing the output.

## 4. Migration Work Completed
- `computeTradeDraftKey`
  - Moved the authoritative implementation into `computeTradeDraftKey.ts`.
  - Preserved the exact `teams = []` destructuring behavior, current filter/map/sort/join flow, current fallback tokens, and exact ``${yearKey}|${teamParts}`` formatting.
  - Preserved `isValidationCurrent()` unchanged.
  - Minimal contract correction required by typing: none.
- `devSntInjector`
  - Moved the authoritative implementation into `devSntInjector.ts`.
  - Preserved the exact constant values, helper order, payload assembly order, nested object key insertion order, fallback chains, and array/object mutation boundaries.
  - Preserved the exact `sharedFields` key order and spread position in both synthetic player payloads.
  - Minimal contract correction required by typing: none.
- `tradeExportUtils`
  - Moved the authoritative implementation into `tradeExportUtils.ts`.
  - Preserved the exact array guard, absorption filter, push loop, and `return [...new Set(ids)]` first-seen ordering behavior.
  - Minimal contract correction required by typing: none.

## 5. JS Holdouts
- `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js` — intentionally remains JS only as a shim-only compatibility surface so direct-path, explicit `.js`, and extensionless imports stay stable; no business logic remains in the file.
- `src/features/architect/tradeMachine/utils/devSntInjector.js` — intentionally remains JS only as a shim-only compatibility surface so direct-path, explicit `.js`, and extensionless imports stay stable; no business logic remains in the file.
- `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js` — intentionally remains JS only as a shim-only compatibility surface so direct-path, explicit `.js`, and extensionless imports stay stable; no business logic remains in the file.
- `src/features/architect/hooks/useTradeMachine.js` — remained JS intentionally because E77 was limited to the helper trio; no blocker required widening into the hook, and it remains the intended next follow-up phase.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the new TS authorities, shims, and tests typecheck cleanly in the current repo.
  - Result: PASS.
- `npm run validate:project`
  - Proved the new TS files and guardrail test fit the project structure rules.
  - Result: PASS.
- `npm run test:node -- --reporter=dot tests/trade/usedTradeExceptions.test.js src/tests/trade/staleValidationFix.test.js src/tests/architect/devSntInjector.utils.test.ts src/tests/architect/tradeEditor.devSntInjectorGate.guardrail.test.ts src/tests/architect/tradeMachineHookSupportHelpers.compatibility.guardrail.test.ts`
  - Proved direct helper behavior, fallback formatting, payload key order, shim-only compatibility, explicit `.js` import parity, constant stability, and unchanged DEV injector gate usage.
  - Result: PASS. `5` test files, `45` tests passed.
- `npm run test:ui -- --reporter=dot src/tests/architect/tradePlayerRow.signAndTradeInjector.test.tsx src/tests/architect/useTradeMachine.devSntInjector.test.tsx`
  - Proved the filtered UI command narrowed correctly to the intended downstream surfaces.
  - Result: FAIL in unchanged adjacent consumers. `tradePlayerRow.signAndTradeInjector.test.tsx` still shows `Sign-and-Trade` for the ineligible synthetic player, and `useTradeMachine.devSntInjector.test.tsx` still fails waiting for initial team players in unchanged `useTradeMachine.js`.
- Commands intentionally skipped:
  - `npm run test:trade -- --reporter=dot` and `npm run test:architect -- --reporter=dot` were skipped because the requested filtered `test:node` command narrowed correctly and did not require broader fallback coverage.
  - `npm run build` was skipped because E77 changed helper modules, tests, and docs only; no UI/component implementation was modified in scope.
  - Full-suite commands were skipped because the prompt did not include `RUN FULL SUITE`.

## 7. Post-E77 Status
- The helper-trio phase is effectively complete: all three helper authorities are now TS-backed, all helper-local compatibility requirements were met, and the remaining JS is narrow and intentionally shim-only.
- No additional helper-local follow-up is recommended for `computeTradeDraftKey`, `devSntInjector`, or `tradeExportUtils`.
- The grouped mini-arc succeeded cleanly at the helper boundary. The only red validation came from unchanged adjacent UI consumers outside E77 scope, so another helper-trio pass is not recommended.
- This helper-trio sub-arc is now effectively complete.
- `useTradeMachine.js` remains the intended next follow-up phase.

## 8. Master Doc Update
- Added `### Validator TS Trade Machine Hook-Support Helpers E77 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the helper-trio boundary is now TS-backed through `computeTradeDraftKey.ts`, `devSntInjector.ts`, and `tradeExportUtils.ts`.
- Recorded that helper behavior remained unchanged, including payload key insertion order and `extractUsedTpeIds()` first-seen ordering.
- Recorded that the kept `.js` files are now shim-only compatibility surfaces.
- Recorded that the grouped helper-trio phase completed cleanly at the helper boundary, that the helper-trio sub-arc is now effectively complete, and that `useTradeMachine.js` remains the intended next follow-up phase.
- Recorded the targeted validation results, including the two unchanged adjacent UI test failures that were not addressed inside E77.
