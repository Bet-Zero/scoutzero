# TM_VALIDATOR_TS_USE_TRADE_MACHINE_E78 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the `useTradeMachine` hook boundary to authoritative TypeScript through `src/features/architect/hooks/useTradeMachine.ts`.
- Public hook behavior was preserved at the boundary: named exports, returned object shape and key order, dependency arrays, initialization/loading flow, stale-validation handling, entitlement/pick-rule hydration, DEV synthetic S&T wiring, export-payload assembly, and fallback/error behavior remained intact.
- `src/features/architect/hooks/useTradeMachine.js` remains only as an intentional shim-only compatibility surface for direct-path, explicit `.js`, and extensionless imports. No hook business logic remains in JS.
- Two tiny compatibility-preserving corrections were required and proved by repo/runtime evidence:
  - restored base-team lookup fallback for slug/code inputs such as `LAL`
  - added a redundant same-input init no-op guard so the unchanged `useTradeMachine.devSntInjector.test.tsx` surface passes without changing the existing `useEffect` dependency array

## 2. Files Changed
- `src/features/architect/hooks/useTradeMachine.ts`
  - Added the authoritative TypeScript implementation for the full hook.
  - Safe because the TS file is a near-textual translation of the prior JS body, with the same dependency arrays, return-key ordering, helper ordering, and runtime flow.
- `src/features/architect/hooks/useTradeMachine.js`
  - Reduced to `export * from './useTradeMachine.ts';`.
  - Safe because all existing import styles remain intact and the JS file no longer carries business logic.
- `src/tests/architect/phase16_3_trade_machine_init_guardrail.test.js`
  - Retargeted the source-reading assertions from the JS shim to the TS authority.
  - Safe because the assertions themselves did not change; only the authoritative source path changed.
- `src/tests/architect/useTradeMachine.compatibility.guardrail.test.ts`
  - Added E78 guardrails for shim parity, explicit `.js` import compatibility, no-default-export behavior, exact hook return-key ordering, stale-validation invalidation, and export payload assembly.
  - Safe because it verifies the existing hook contract without changing production behavior.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E78 entry documenting the TS-backed hook boundary, compatibility notes, and validation results.
  - Safe because it updates migration tracking only.
- `return_packages/trade_machine/TM_VALIDATOR_TS_USE_TRADE_MACHINE_E78_RETURN_PACKAGE.md`
  - Added the E78 execution return package.
  - Safe because it is documentation only.

## 3. Types Introduced or Hardened
- `UnknownRecord`
  - Loose record helper for preserving JS-like object access in the TS authority.
  - Applies throughout `useTradeMachine.ts` where the hook already accepts broad runtime shapes.
- `TradeMachinePlayer`
  - Loose player-like shape for outgoing/incoming trade arrays and DEV injector interaction.
  - Applies to `teams[].sends`, incoming asset assembly, and export payload construction.
- `TradeMachineEntitlement`
  - Loose entitlement-like shape for baseline team entitlements and `entitlementsOut`.
  - Applies to entitlement selection, hydration, override updates, and export payload assembly.
- `TradeMachineTeam`
  - Loose team-like shape for loaded team data merged from `TeamMap` / `TeamCodeMap` plus world/base snapshots.
  - Applies to the authoritative hook’s init/select logic, cap totals wiring, and validation/export inputs.
- `TradeMachineTeamSlot`
  - Current hook slot shape: `{ team, sends, entitlementsOut }` with optional legacy `entitlements`.
  - Applies to authoritative hook state, incoming asset derivation, reset behavior, and validation/export assembly.
- `TradeMachineValidationResult`
  - Loose validation result wrapper for the hook’s stored `result`.
  - Applies to stale-validation tracking and returned hook state.
- `EntitlementOverrideDocument`
  - Loose override/update document shape for `applyEntitlementOverrideUpdate`.
  - Applies to the authoritative entitlement refresh path in the hook.

## 4. Migration Work Completed
- `useTradeMachine`
  - Moved the authoritative implementation into `src/features/architect/hooks/useTradeMachine.ts`.
  - Preserved current named-export behavior, return shape, return key insertion order, memoization boundaries, initialization order, validation flow, hydration flow, DEV injector integration, and export assembly.
  - Preserved all existing `useMemo`, `useCallback`, and `useEffect` dependency arrays exactly.
  - Converted `src/features/architect/hooks/useTradeMachine.js` into a pure compatibility shim.
  - Minimal contract corrections required:
    - restored base-team lookup fallback for slug/code inputs (`TeamMap` plus `TeamCodeMap` fallback), which current repo tests and live route usage already rely on
    - added a same-input init no-op guard inside the existing init effect body so unchanged callers that pass a fresh `capProjections` object each render do not spin the init loop; the dependency array itself was not changed

## 5. JS Holdouts
- `src/features/architect/hooks/useTradeMachine.js`
  - Intentionally remains JS only as a shim-only compatibility surface.
  - Exact reason: preserve direct-path, explicit `.js`, and extensionless imports without rewriting consumers.
- Adjacent JS UI consumers such as `src/features/architect/tradeMachine/TradeEditor.jsx` and `src/features/architect/tradeMachine/TradePlayerRow.jsx`
  - Intentionally remained untouched because E78 was locked to the hook boundary only.
  - Exact reason: they were not blockers for migrating `useTradeMachine` itself.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the new TS authority, shim, and guardrail test compile cleanly.
  - Result: PASS.
- `npm run validate:project`
  - Proved the added TS/test/doc files remain consistent with project structure rules.
  - Result: PASS.
- `npm run test:node -- --reporter=dot tests/trade/useTradeMachine.validatorTrust.test.ts src/tests/architect/phase16_3_trade_machine_init_guardrail.test.js src/tests/architect/useTradeMachine.compatibility.guardrail.test.ts`
  - Proved validator-trust behavior, shim parity, no-default-export behavior, exact hook return-key ordering, stale-validation invalidation, export payload assembly, and the retargeted Phase 16.3 source guardrail.
  - Result: PASS. `3` test files, `13` tests passed.
- `npm run test:ui -- --reporter=dot src/tests/architect/useTradeMachine.devSntInjector.test.tsx`
  - Proved slot-0 init with `primaryTeam='LAL'`, DEV synthetic S&T injection, and `resetTrade()` cleanup work unchanged on the hook surface.
  - Result: PASS. `1` test file, `1` test passed.
- Commands intentionally skipped:
  - `npm run test:ui -- --reporter=dot src/tests/architect/tradePlayerRow.signAndTradeInjector.test.tsx`
  - Reason: locked E78 scope remained hook-only; E77 already showed that test is a separate UI/eligibility issue outside the `useTradeMachine` boundary.
  - `npm run build`
  - Reason: E78 changed the hook, compatibility test coverage, and migration docs only; the requested validation set did not require a build.
  - Broader suites such as `npm run test:diff`, `npm run test:architect`, and `npm run test:trade`
  - Reason: the requested narrow proof set already covered the migrated boundary directly.
  - Full-suite commands
  - Reason: the prompt did not include `RUN FULL SUITE`.

## 7. Post-E78 Status
- The `useTradeMachine` phase is effectively complete.
- No additional hook-local follow-up is recommended.
- The single-hook phase succeeded cleanly without widening into closed arcs or adjacent UI/validator/orchestration files.
- The broader Trade Machine hook-support boundary is now effectively complete.
- The separate `tradePlayerRow.signAndTradeInjector` UI/eligibility issue remains outside the hook-support boundary and was not reopened by E78.

## 8. Master Doc Update
- Added `### Validator TS Use Trade Machine E78 (2026-03-13)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the `useTradeMachine` hook boundary is now TS-backed through `src/features/architect/hooks/useTradeMachine.ts`.
- Recorded that the returned hook surface, dependency arrays, hydration flow, stale-validation handling, DEV injector wiring, and export payload assembly remained unchanged at the boundary.
- Recorded that `useTradeMachine.js` is now a shim-only compatibility surface.
- Recorded the two compatibility-preserving corrections: slug/code base-team fallback restoration and the same-input init no-op guard required by the unchanged hook UI test.
- Recorded the E78 validation results and the intentional skip of `tradePlayerRow.signAndTradeInjector.test.tsx`.
- Recorded that the single-hook phase completed cleanly and that the broader Trade Machine hook-support boundary is now effectively complete.
