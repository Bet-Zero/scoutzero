# TM_VALIDATOR_TS_CAP_SHEET_DISPLAY_CORE_E88 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the 4 counted Cap Sheet display-core authorities to TypeScript:
  - `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
  - `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`
  - `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`
  - `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`
- Behavior was preserved across the display-core surface: visible ordering stayed unchanged, totals/cap-hold/rules-profile/TPE display stayed unchanged, year selection stayed unchanged, and action wiring into the existing modal pair stayed unchanged.
- Narrow JS/JSX remains by design:
  - the same-path `.jsx` files remain shim-only compatibility surfaces by E88 rule
  - the top-level wrappers and dashboard section shells remain pass-through JS/JSX compatibility surfaces
  - the modal pair remains JS/JSX because it is the explicit follow-up sub-arc and stayed out of scope for E88

## 2. Files Changed
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
  - Added the authoritative TSX Cap Sheet implementation with permissive local typing around player rows, cap holds, rules-profile notes, totals, and modal triggers.
  - Safe because the render tree, visible row ordering, year-toggle behavior, totals memoization, cap-hold toggle block, breakdown rows, and modal open/save wiring were preserved.
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`
  - Added the authoritative TSX summary-tile implementation.
  - Safe because tile ordering, value formatting, hard-cap status behavior, badge placement, and tooltip output were preserved.
- `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`
  - Added the authoritative TSX multi-year cap-table implementation with permissive typing for players, cap holds, action callbacks, and rules-profile reads.
  - Safe because player/column ordering, year-total memoization, option/free-agency click wiring, cap-hold grouping/order, and fallback rendering were preserved.
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`
  - Added the authoritative TSX exception/TPE tracker implementation.
  - Safe because canonical-then-legacy exception reads, exception-card ordering, hard-cap logic, TPE expiry fallback order, and empty-state behavior were preserved.
- `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
  - Replaced the prior JSX authority with a shim-only default re-export of `CapSheet.tsx`.
  - Safe because the same path remains importable while logic moved entirely to the TSX authority.
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
  - Replaced the prior JSX authority with a shim-only default re-export of `CapSummaryTiles.tsx`.
  - Safe because the same path remains importable while logic moved entirely to the TSX authority.
- `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`
  - Replaced the prior JSX authority with a shim-only default re-export of `CapSheetFull.tsx`.
  - Safe because the same path remains importable while logic moved entirely to the TSX authority.
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - Replaced the prior JSX authority with a shim-only default re-export of `ExceptionTracker.tsx`.
  - Safe because the same path remains importable while logic moved entirely to the TSX authority.
- `src/tests/architect/capSheet_closure.gate.test.ts`
  - Retargeted the Cap Sheet and ExceptionTracker source-scan paths from `.jsx` to `.tsx`.
  - Safe because the gate intent is unchanged; it now inspects the authoritative implementation paths.
- `src/tests/architect/capSheet_capPct_ssot.behavior.test.jsx`
  - Retargeted the Cap Sheet source-scan path from `.jsx` to `.tsx`.
  - Safe because the guardrail intent is unchanged; it now inspects the authoritative implementation path.
- `src/tests/architect/capSheetFull_ssot_parity_guardrails.test.js`
  - Retargeted the CapSheetFull source-scan path from `.jsx` to `.tsx` and updated the inline scan description accordingly.
  - Safe because the SSOT guardrail behavior is unchanged; it now points at the authoritative implementation path.
- `src/tests/architect/capSheet.displayCore.e88.behavior.test.tsx`
  - Added focused E88 UI proof for CapSummaryTiles ordering/output and CapTableSection pass-through compatibility into CapSheetFull callbacks/rules-profile rendering.
  - Safe because it exercises the migrated display-core surface without widening into modal internals or dashboard hubs.
- `src/tests/architect/capSheet.uiFlows.integration.test.tsx`
  - Made a minimal assertion correction from singular fixture-player queries to plural queries.
  - Safe because the harness intentionally renders both `CapSheet` and `CapSheetFull`; the test now matches the existing dual-surface behavior instead of assuming a unique text node.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E88 execution entry.
  - Safe because it documents executed scope only.
- `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_SHEET_DISPLAY_CORE_E88_RETURN_PACKAGE.md`
  - Added the E88 execution return package documenting the scope, validation, holdouts, and completion status.
  - Safe because it is execution documentation only.

## 3. Types Introduced or Hardened
- `CapSheetProps`, `TeamCapSheetLike`, and `CapSheetPlayerLike`
  - Internal prop and data-shape aliases for the authoritative current-year Cap Sheet path.
  - Applied in `src/features/architect/capSheet/CapSheet/CapSheet.tsx`.
- `RulesProfileLike`
  - Narrow local rules-profile display shape used for extension-eligibility badge/note rendering.
  - Applied in `src/features/architect/capSheet/CapSheet/CapSheet.tsx` and `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`.
- `CapSummaryTilesProps`
  - Internal prop contract for canonical totals plus hard-cap status display.
  - Applied in `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`.
- `CapSheetFullProps`, `CapSheetFullPlayerLike`, `CapHoldLike`, and `FreeAgencyLike`
  - Internal permissive shapes for the multi-year grid, free-agency cells, and cap-hold sections.
  - Applied in `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`.
- `ExceptionTrackerProps`, `NormalizedExceptionLike`, `ExceptionCardProps`, `HardCapCardProps`, and `TeamTpeLike`
  - Internal prop/data aliases for exception normalization, hard-cap display, and TPE row rendering.
  - Applied in `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`.

## 4. Migration Work Completed
- `CapSheet`
  - Migrated the authoritative current-year display coordinator to TSX.
  - Preserved the exact visible ordering of header, year selector, summary tiles, player rows, cap-hold section, manage-actions row, breakdown rows, total row, and modal mounts.
  - Minimal typing correction only: `capHolds` stayed permissive (`unknown[] | null`) at the prop boundary so existing callers and fixtures with loose cap-hold arrays continue to compile unchanged.
- `CapSummaryTiles`
  - Migrated the authoritative totals tile strip to TSX.
  - Preserved exact tile order, hard-cap indicator behavior, empty/fallback behavior, and all observable JSX ordering.
  - No contract correction was required beyond internal prop typing.
- `CapSheetFull`
  - Migrated the authoritative multi-year cap table to TSX.
  - Preserved exact player ordering, year/column ordering, option and free-agency click wiring, cap-hold ordering/grouping, and fallback behavior.
  - Minimal typing correction only: `capHolds` stayed permissive (`unknown[] | null`) at the prop boundary so existing callers and tests with loose cap-hold arrays continue to compile unchanged.
- `ExceptionTracker`
  - Migrated the authoritative exception/TPE tracker to TSX.
  - Preserved exact exception-card ordering, hard-cap rendering, TPE block structure, row ordering, and empty-state behavior.
  - Minimal typing correction only: unknown TPE display fields are stringified at render time so TypeScript accepts the existing loose persistence payload shapes without changing displayed output.

## 5. JS/JSX Holdouts
- `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
  - Remains JS/JSX as a shim-only compatibility surface by explicit E88 rule.
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
  - Remains JS/JSX as a shim-only compatibility surface by explicit E88 rule.
- `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`
  - Remains JS/JSX as a shim-only compatibility surface by explicit E88 rule.
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - Remains JS/JSX as a shim-only compatibility surface by explicit E88 rule.
- `src/features/architect/CapSheet.jsx`
  - Remains JS/JSX as the top-level pass-through compatibility wrapper; E88 did not broaden its role.
- `src/features/architect/CapSummaryTiles.jsx`
  - Remains JS/JSX as the top-level pass-through compatibility wrapper; E88 did not broaden its role.
- `src/features/architect/CapSheetFull.jsx`
  - Remains JS/JSX as the top-level pass-through compatibility wrapper; E88 did not broaden its role.
- `src/features/architect/ExceptionTracker.jsx`
  - Remains JS/JSX as the top-level pass-through compatibility wrapper; E88 did not broaden its role.
- `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`
  - Remains JS/JSX as a dashboard section shell; it stayed pass-through only.
- `src/features/architect/GMDashboard/sections/CapTableSection.jsx`
  - Remains JS/JSX as a dashboard section shell; it stayed pass-through only.
- `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - Remains JS/JSX because the modal/editor pair was explicitly out of scope for E88 and remains the higher-risk follow-up sub-arc.
- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
  - Remains JS/JSX because the modal/editor pair was explicitly out of scope for E88 and remains the higher-risk follow-up sub-arc.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the 4 new TSX authorities, shim files, and updated tests compile cleanly.
  - Result: PASS.
- `npm run test:node -- --reporter=dot src/tests/architect/capSheet_closure.gate.test.ts src/tests/architect/capSheet_capPct_ssot.behavior.test.jsx src/tests/architect/capSheetFull_ssot_parity_guardrails.test.js`
  - Proved the retargeted Cap Sheet/ExceptionTracker source scans and the CapSheetFull SSOT parity guardrails still pass against the authoritative `.tsx` files.
  - Result: PASS for the node-config-executed files. Vitest's node config executed `capSheet_closure.gate.test.ts` and `capSheetFull_ssot_parity_guardrails.test.js`; the `.jsx` cap-percent guardrail did not execute under that config and was run separately below.
- `npm run test:ui -- --reporter=dot src/tests/architect/capSheet_capPct_ssot.behavior.test.jsx`
  - Proved the Cap Sheet cap-percent SSOT guardrail against `CapSheet.tsx`.
  - Result: PASS.
- `npm run test:ui -- --reporter=dot src/tests/architect/capSheet.uiFlows.integration.test.tsx src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx src/tests/architect/rosterChargeDisplay.test.jsx src/tests/architect/capSheet_exception_wiring.behavior.test.jsx tests/architect/CapSheetFull.rules.test.jsx tests/architect/ExceptionTracker.tpe.test.jsx src/tests/architect/capSheet.displayCore.e88.behavior.test.tsx`
  - Proved current display-core UI behavior remained intact: Cap Sheet fixture flows, modal-trigger wiring, trade-apply Cap Sheet refresh behavior, incomplete-roster-charge display, exception/TPE rendering, CapSheetFull rules-profile indicators, ExceptionTracker TPE reads, and the new E88 CapSummaryTiles/CapTableSection compatibility coverage.
  - Result: PASS.
- `npm run build`
  - Proved the TS-backed display-core surface still bundles successfully in production.
  - Result: PASS with pre-existing Vite warnings about stale Browserslist data, browser externalization of `fs`, mixed static/dynamic imports, and large chunks outside the E88 surface.
- `npm run validate:project`
  - Proved the new authoritative files and test file satisfy project structure validation.
  - Result: PASS.
- Commands intentionally skipped:
  - `npm run test:diff` was skipped because the targeted node/UI proof set directly covered the migrated display-core surface.
  - Broader suites such as `npm run test:architect` were skipped because they exceed the validation scope needed for this surface-only migration.
  - `npm run test:full` was skipped because the prompt did not include `RUN FULL SUITE`.
  - `npm run docs` was skipped because E88 did not require doc-generation workflows beyond the explicit Trade Machine master-doc update.

## 7. Post-E88 Status
- The grouped Cap Sheet display-core pass succeeded cleanly.
- The Cap Sheet display-core phase is now effectively complete.
- No additional display-core migration pass is recommended.
- The intended follow-up remains the separate modal pair sub-arc:
  - `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`

## 8. Master Doc Update
- Added `### Validator TS Cap Sheet Display-Core E88 (2026-03-14)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The E88 entry states that:
  - the 4 counted Cap Sheet display-core files are now TS-backed
  - behavior remained unchanged, including visible ordering, totals/cap-hold/rules-profile/TPE display, and action wiring into the existing modal pair
  - the same-path `.jsx` files remain shim-only compatibility surfaces by rule
  - the top-level wrappers and dashboard section shells remained pass-through only
  - the grouped display-core pass completed cleanly
  - the Cap Sheet display-core sub-arc is now effectively complete
  - the modal pair remains the intended follow-up sub-arc
