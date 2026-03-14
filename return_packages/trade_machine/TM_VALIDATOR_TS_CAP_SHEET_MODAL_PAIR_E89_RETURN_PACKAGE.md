# TM_VALIDATOR_TS_CAP_SHEET_MODAL_PAIR_E89 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the 2 counted Cap Sheet modal authorities to TypeScript:
  - `src/features/architect/capSheet/modals/ManageExceptionsModal.tsx`
  - `src/features/architect/capSheet/modals/ManageDeadMoneyModal.tsx`
- Behavior was preserved across the modal pair: visible field order, row order, button order, warning/error placement, payload assembly, row editing behavior, save/cancel timing, and close-after-success behavior remained unchanged.
- Narrow JS/JSX remains by rule only:
  - `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
  - both are now shim-only compatibility surfaces

## 2. Files Changed
- `src/features/architect/capSheet/modals/ManageExceptionsModal.tsx`
  - Added the authoritative TSX implementation for the exceptions modal with permissive local typing around props, cap settings, editable rows, and room-exception gating.
  - Safe because the modal structure, exception row ordering, field ordering, warning placement, save lifecycle, and canonical exception payload assembly were preserved exactly.
- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.tsx`
  - Added the authoritative TSX implementation for the dead-money modal with permissive local typing around source entries, flattened UI rows, and save payload rows.
  - Safe because the modal structure, column ordering, add/remove/update behavior, flattening logic, row-to-payload mapping, and save lifecycle were preserved exactly.
- `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - Replaced the prior JSX authority with a shim-only default re-export of `ManageExceptionsModal.tsx`.
  - Safe because the same path remains importable while runtime logic moved entirely to the TSX authority.
- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
  - Replaced the prior JSX authority with a shim-only default re-export of `ManageDeadMoneyModal.tsx`.
  - Safe because the same path remains importable while runtime logic moved entirely to the TSX authority.
- `src/tests/architect/capSheet_closure.gate.test.ts`
  - Retargeted modal source-scan guardrails from `.jsx` to `.tsx`.
  - Safe because the gate intent is unchanged; it now scans the authoritative modal implementations.
- `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`
  - Retargeted the room-exception modal source scans from `.jsx` to `.tsx`.
  - Safe because the guardrail intent is unchanged; it now inspects the authoritative modal implementation.
- `src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js`
  - Retargeted the dead-money modal source scan from `.jsx` to `.tsx`.
  - Safe because the schema-parity guardrail intent is unchanged; it now scans the authoritative modal implementation.
- `src/tests/architect/capSheet_exception_wiring.behavior.test.jsx`
  - Added focused modal-pair assertions for visible order, exact payload assembly, thrown-error handling, and cancel-without-save behavior.
  - Safe because it exercises the migrated direct surface without widening into display-core or orchestration hubs.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E89 execution entry.
  - Safe because it documents executed scope only.
- `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_SHEET_MODAL_PAIR_E89_RETURN_PACKAGE.md`
  - Added the E89 execution return package documenting scope, validation, shims, and completion status.
  - Safe because it is execution documentation only.

## 3. Types Introduced or Hardened
- `ExceptionType`, `CapSettingsLike`, `EditableException`, `ExceptionsState`, and `ManageExceptionsModalProps`
  - Internal local types for the authoritative exceptions modal path.
  - Applied in `src/features/architect/capSheet/modals/ManageExceptionsModal.tsx`.
- `DeadCapAmountByYearArrayEntry`, `DeadCapAmountByYearObjectValue`, `DeadCapSourceEntry`, `FlatDeadMoneyEntry`, and `ManageDeadMoneyModalProps`
  - Internal local types for the authoritative dead-money modal path, including flatten-read support for both canonical array and legacy object-map shapes.
  - Applied in `src/features/architect/capSheet/modals/ManageDeadMoneyModal.tsx`.

## 4. Migration Work Completed
- `ManageExceptionsModal`
  - Migrated the authoritative exceptions modal to TSX.
  - Preserved exact header/body/footer ordering, exception row order (`mle`, `tpmle`, `bae`, `room`), column order, room-warning placement, summary block ordering, and footer button ordering.
  - Preserved canonical exception payload assembly exactly: only enabled rows or rows with non-zero `usedAmount` persist, numeric fields still use `Number(...) || 0`, `seasonKey` still falls back to the current season, and falsy `notes` are still omitted.
  - Preserved save/cancel behavior exactly: save awaits `onSave`, stays open on `false` or thrown error, shows inline errors in the same footer area, and cancel still closes without saving.
- `ManageDeadMoneyModal`
  - Migrated the authoritative dead-money modal to TSX.
  - Preserved exact header/body/footer ordering, column order, empty-state placement, add-button placement, footer button ordering, and inline error placement.
  - Preserved flatten-read behavior exactly for both `amountByYear` array input and legacy object-map input.
  - Preserved canonical dead-cap payload assembly exactly: one output item per UI row, no regrouping, existing `playerId` reuse when present, fallback `manual_*` ID generation when absent, `playerName: e.label`, one `amountByYear` row per payload item, and `notes: 'Manual Adjustment'`.
  - Preserved save/cancel behavior exactly: save awaits `onSave`, stays open on `false` or thrown error, and cancel still closes without saving.

## 5. JS/JSX Holdouts
- `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - Remains JS/JSX as a shim-only compatibility surface by explicit E89 rule.
- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
  - Remains JS/JSX as a shim-only compatibility surface by explicit E89 rule.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the 2 new TSX authorities, shim files, and updated tests compile cleanly.
  - Result: PASS.
- `npm run test:node -- --reporter=dot src/tests/architect/capSheet_closure.gate.test.ts src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`
  - Proved the retargeted modal source-scan guardrails and dead-money schema-parity guardrails still pass against the authoritative `.tsx` files.
  - Result: PASS.
- `npm run test:ui -- --reporter=dot src/tests/architect/capSheet_exception_wiring.behavior.test.jsx src/tests/architect/capSheet.uiFlows.integration.test.tsx src/tests/architect/capSheet.transactionMatrix.behavior.test.tsx`
  - Proved the modal pair still preserves direct UI behavior, exact payload assembly expectations, close-after-success timing, stay-open-on-failure behavior, cancel-without-save behavior, Cap Sheet totals behavior, and downstream action wiring.
  - Result: PASS.
- `npm run build`
  - Proved the TS-backed modal pair still bundles successfully in production.
  - Result: PASS with pre-existing Vite warnings about stale Browserslist data, browser externalization of `fs`, mixed static/dynamic imports, and large chunks outside the E89 surface.
- `npm run validate:project`
  - Proved the new authoritative files satisfy project structure validation.
  - Result: PASS.
- Commands intentionally skipped:
  - `npm run test:diff` was skipped because the targeted node/UI proof set directly covered the migrated modal-pair surface.
  - Broader suites such as `npm run test:architect` were skipped because they exceed the validation scope needed for this two-file migration.
  - `npm run test:full` was skipped because the prompt did not include `RUN FULL SUITE`.
  - `npm run docs` was skipped because E89 only required the explicit Trade Machine master-doc update.

## 7. Post-E89 Status
- The Cap Sheet modal-pair phase is effectively complete.
- The paired higher-risk follow-up sub-arc succeeded cleanly.
- No additional modal-pair follow-up is recommended.
- The broader Cap Sheet family is now effectively complete because the remaining Cap Sheet JS/JSX files are compatibility or pass-through wrappers rather than live display/modal authorities.

## 8. Master Doc Update
- Added `### Validator TS Cap Sheet Modal Pair E89 (2026-03-14)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The E89 entry states that:
  - the 2 counted Cap Sheet modal files are now TS-backed
  - behavior remained unchanged, including visible order, warning/error placement, payload assembly, and save/cancel lifecycle timing
  - the same-path `.jsx` files remain shim-only compatibility surfaces by rule
  - the paired sub-arc completed cleanly
  - the broader Cap Sheet family is now effectively complete
