# ARCHITECT_TS_HARDENING_AND_POLISH_E3 — EXECUTION RETURN PACKAGE

## 1. Summary

This pass completed **fully**. Runtime behavior remained **unchanged**. The work stayed **inside scope**: the four requested runtime files were updated, one focused regression file was added, and no broad cleanup/refactor lane was opened.

The highest-value remaining cross-file alignment weakness between `EditContractModal.tsx` and `useCapValidation.ts` was **removed**, not just reduced:

- the `as unknown` bridge at the `useCapValidation(...)` call boundary is gone
- the casted validation result object is gone
- the Cap Sheet section wrappers no longer expose `(...args: any[]) => any`

The remaining weak areas are now smaller and lower-value than the pre-pass modal/hook mismatch.

## 2. Files Changed

### In-scope runtime files edited
- `src/shared/components/EditContractModal.tsx`
- `src/features/architect/hooks/useCapValidation.ts`
- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/GMDashboard/sections/CapTableSection.tsx`

### Focused tests added
- `src/tests/architect/architectHardeningE3.polish.test.ts`

### Return package
- `return_packages/trade_machine/ARCHITECT_TS_HARDENING_AND_POLISH_E3_RETURN_PACKAGE.md`

## 3. Hardening Changes Completed

### `EditContractModal.tsx`
- Derived hook-facing aliases directly from `Parameters<typeof useCapValidation>[0]` and `ReturnType<typeof buildSigningGuardrails>`.
- Rebuilt modal-local `ContractSalaryRowLike`, `ContractLike`, `PlayerLike`, and `TeamCapSheetLike` as additive hook-compatible shapes instead of parallel local-only shapes.
- Typed `contractDataForValidation` directly as the hook’s `contractData` shape.
- Removed the `useCapValidation({...} as unknown) as {...}` boundary entirely.

### `useCapValidation.ts`
- Kept the E2 hardening intact.
- Relaxed only `SalaryByYearLike.season` from required `string` to the already-tolerated runtime shape: `string | number | null | undefined`.
- Did not broaden helper contracts, validation flow, or message behavior.

### `CapSheetSection.tsx`
- Replaced wrapper-local callback `any` signatures with a narrow `Pick<Parameters<typeof CapSheet>[0], ...>` for only the exact forwarded props:
  - `teamCapSheet`
  - `onSelectPlayer`
  - `onSetDeadCap`
  - `onSetExceptions`

### `CapTableSection.tsx`
- Replaced wrapper-local callback `any` signatures with a narrow `Pick<Parameters<typeof CapSheetFull>[0], ...>` for only the exact forwarded props:
  - `teamCapSheet`
  - `onSelectPlayer`
  - `onActionClick`
  - `getRulesProfileForYear`

### Deliberate non-changes
- Did not touch `GMDashboard.tsx`, `useArchitectActions.ts`, or `playerRulesProfiles.ts`.
- Did not redesign modal flow, validation flow, or cap-sheet workflows.
- Kept `capHolds` / `deadCap` on the modal’s local cap-sheet type as partial canonical record-backed shapes to preserve compatibility with broader existing callers outside scope.

## 4. Types Improved

- Removed the remaining `EditContractModal -> useCapValidation` `as unknown` bridge.
- Removed the casted validation result object after `useCapValidation(...)`.
- Replaced modal-local signing guardrail looseness with `ReturnType<typeof buildSigningGuardrails> | null`.
- Aligned modal salary-row / contract / player / cap-sheet shapes to the hook boundary through additive structural typing.
- Relaxed only the hook salary-row `season` field, and only to the already-supported runtime shape.
- Eliminated `(...args: any[]) => any` from `CapSheetSection.tsx`.
- Eliminated `(...args: any[]) => any` from `CapTableSection.tsx`.
- Added focused regression coverage proving:
  - modal-compatible player/team-cap-sheet fixtures now flow directly into `useCapValidation`
  - Cap Sheet section wrapper callbacks forward payloads unchanged
  - Cap Table section wrapper callbacks forward payloads unchanged

## 5. Validation / Regression Coverage Run

### Commands actually run
- `npm run typecheck` — **PASS**
- `npm run test:node -- --reporter=dot src/tests/architect/architectHardeningE3.polish.test.ts` — **PASS**
- `npm run build` — **PASS**
- `npm run validate:project` — **PASS**

### Focused regression result
- `src/tests/architect/architectHardeningE3.polish.test.ts` passed `3 / 3` tests.

### Build warnings observed
- Browserslist warning: local `caniuse-lite` data is 7 months old.
- Existing Vite browser-compat warning for `fs` imported via `tradeDebug.ts`.
- Existing Vite chunking warnings about mixed dynamic/static imports involving `firebaseConfig.js`, `entitlementResolver.ts`, and `leagueInvariants.ts`.
- Existing large chunk size warning for the production bundle.

### Intentionally skipped
- `npm run test:full` — explicitly not allowed by prompt
- `npm run test:architect` — explicitly not allowed by prompt
- `npm run test:trade` — explicitly not allowed by prompt
- `npm run test:diff` — explicitly not allowed by prompt

### Test stabilization required
- No existing tests needed retargeting.
- The new focused regression stayed at the exact required `.test.ts` filename by using `React.createElement(...)` instead of JSX.

## 6. Remaining Weak Areas

- `EditContractModal.tsx` still uses partially aligned `capHolds` / `deadCap` collection shapes (`Partial<CapHoldItem>` / `Partial<DeadCapItem>` plus record fields) to remain compatible with broader existing callers outside this pass.
- `useCapValidation.ts` still only meaningfully consumes `teamCapSheet.players`; cap holds and dead cap remain unused by the hook boundary today.
- Broader Architect action surfaces outside this pass, especially `GMDashboard.tsx` and `useArchitectActions.ts`, still contain looser handler/state typing patterns.

The major hardening blemish from before this pass is **now gone**. What remains is finish-line cleanup territory, not the same obvious modal/hook mismatch.

## 7. Post-Pass Status

Architect materially advanced again in this pass. The most visible remaining cross-file type-alignment blemish is removed, and the cap-sheet wrapper surfaces are cleaner and more obviously bounded.

The next likely lane is **final hardening / closeout polish**, not shim cleanup, wrapper cleanup, or broad architecture cleanup.

## 8. Recommended Next Actions

1. Run one final Architect hardening/closeout pass on the broader dashboard action/state typing surfaces outside this pass, especially `GMDashboard.tsx` and `useArchitectActions.ts`.
2. If desired, narrow shared team-cap-sheet collection types later so `capHolds` / `deadCap` can move from partial compatibility bags to fully canonical item arrays.
3. After that, move to closeout audit/polish rather than another cleanup lane.
