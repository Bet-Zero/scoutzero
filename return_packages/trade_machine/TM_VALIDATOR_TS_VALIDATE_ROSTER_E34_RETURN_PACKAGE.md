# TM_VALIDATOR_TS_VALIDATE_ROSTER_E34 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical legacy `validateRoster` helper surface from `src/features/architect/utils/tradeMachine/rules/validateRoster.js` to `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`.
- Behavior was preserved: the TS file is a line-faithful port of the legacy helper contract, keeping legacy `string[]` violations, exact message/details text, the current `rosterCounts` payload, the current `warningsOnly` `null | true` behavior, and the current `enforceRosterWindow()` callback and grace-mode behavior, including its existing falsey invalid non-grace `passed` result.
- No directly related roster business logic had to remain JS. `src/features/architect/utils/tradeMachine/rules/validateRoster.js` remains JS only as the required pure compatibility re-export shim.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`
  - Replaced the prior non-faithful TS duplicate with the authoritative TS-backed port of the legacy `validateRoster` and `enforceRosterWindow` surface.
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `src/features/architect/utils/tradeMachine/constants/types.ts`
  - Hardened the shared roster helper types so `RosterResult` now matches the actual legacy helper contract instead of structured validator issues.
- `tests/validators/roster.test.js`
  - Added direct parity coverage for the shim-backed `.js` surface, the validator compatibility barrel path, exact result-shape quirks, and `enforceRosterWindow()` behavior.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E34 migration entry and updated the post-E34 queue note from the actual repo state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_ROSTER_E34_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `RosterResult`
  - Represents the exact legacy `validateRoster()` helper return shape: `string[]` violations, required string `details`, `warningsOnly: boolean | null`, and legacy roster counts.
  - Applies in `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`.
- `RosterCounts`
  - Represents the exact legacy `rosterCounts` payload for this helper surface: `standard`, `twoWay`, `projected`, and `current`.
  - Applies inside `src/features/architect/utils/tradeMachine/constants/types.ts` and `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`.
- `RosterValidationTeamLike`
  - File-local input type for the authoritative `validateRoster()` / `enforceRosterWindow()` TS surface, including the legacy optional `postTradeTeam` branch used by `enforceRosterWindow()`.
  - Applies in `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`.
- `EnforceRosterWindowResult`
  - File-local result type for the legacy `enforceRosterWindow()` surface, preserving `warnings: []` and the existing falsey invalid non-grace `passed` behavior.
  - Applies in `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`.

## 4. Migration Work Completed
- `rules/validateRoster.ts`
  - Ported the live JS helper logic into TS without changing runtime behavior.
  - Preserved:
    - legacy `string[]` violations
    - exact `validateRoster()` message text and `details`
    - exact `rosterCounts` payload shape
    - exact `warningsOnly` `null | true` behavior
    - exact `enforceRosterWindow()` violation text, callback routing, and grace-mode handling
    - the existing falsey invalid non-grace `passed` behavior in `enforceRosterWindow()`
  - Minimal contract correction required by typing:
    - the shared `RosterResult` type no longer claims this helper returns structured `ValidationIssue[]`; it now matches the actual legacy helper contract.
- `rules/validateRoster.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E34.
- Direct parity coverage
  - Added focused assertions proving the same helper identity through both `rules/validateRoster.js` and `validators/index.js`, plus exact result-shape parity for `validateRoster()` and `enforceRosterWindow()`.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
  - Remains JS only as the required pure compatibility re-export shim for stable `.js` imports.
- `src/features/architect/utils/tradeMachine/validators/index.js`
  - Remains JS because it is the existing validator compatibility barrel; it contains no roster business logic and changing it is unnecessary for this slice.
- `src/features/architect/utils/tradeMachine/index.js`
  - Remains JS because it is the public Trade Machine API barrel; it contains no roster business logic and changing it is unnecessary for this slice.
- `src/features/architect/utils/tradeMachine/rules/index.js`
  - Remains JS because it is the rules barrel; it contains no roster business logic and changing it is unnecessary for this slice.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/validators/roster.test.js tests/trade/rosterLegality_validateTrade.test.js tests/trade/roster_twoWay_enforcement.test.js tests/trade/rosterWindow_softEnforcement.test.js tests/trade/rosterValidation_surface.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the TS-backed legacy `validateRoster` surface compiles cleanly in the mixed JS/TS rule graph.
  - `npm run test:node -- --reporter=dot ...`
    - Proves the direct helper surface imported through `validateRoster.js`, the validator compatibility barrel re-export path, the unchanged authoritative `validateTrade()` roster-count behavior, and the separate `rosterValidation.ts` surface all remain intact.
  - `tests/validators/roster.test.js`
    - Direct surface coverage proving unchanged `.js` shim behavior, validator compatibility export identity, exact legacy result shapes, exact `warningsOnly` quirks, exact `enforceRosterWindow()` callback routing, and grace-mode behavior.
  - `tests/trade/rosterLegality_validateTrade.test.js`
    - Proves `validateTrade()` `team.rules.rosterCount` behavior remains unchanged and was not rerouted by E34.
  - `tests/trade/roster_twoWay_enforcement.test.js`
    - Proves unchanged validator-adjacent roster enforcement behavior through the trade-validator export path.
  - `tests/trade/rosterWindow_softEnforcement.test.js`
    - Proves the separate `rosterValidation.ts` soft-enforcement surface remains unchanged.
  - `tests/trade/rosterValidation_surface.test.js`
    - Proves the separate `rosterValidation.ts` surface still preserves its own exact message/order/alias contract after E34.
  - `npm run validate:project`
    - Proves the updated TS/helper/test/doc files keep the repo within the project schema.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot ...`: PASS (5 files, 25 tests)
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E34 is a narrow validator-adjacent TS migration slice. The direct helper parity test, validator compatibility-path assertion, `validateTrade()` roster legality coverage, `rosterValidation.ts` regression coverage, typecheck, and project validation provide targeted proof without broadening into unrelated rule families or guarded full-suite execution.

## 7. Remaining TS Migration Queue
- Post-E34 graph inspection was based on the actual repo state after implementation, using a static import/classification pass across `src/features/architect/utils/tradeMachine` plus in-repo `src/` and `tests/` importers.
- Next best TS slice after E34:
  - `src/features/architect/utils/tradeMachine/utils/validateInput.js` + `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
  - These are the remaining live JS business-logic helpers in the validator-adjacent Trade Machine rule/helper slice, and they already share direct regression coverage.
- Remaining live JS business-logic holdouts in the validator-adjacent Trade Machine migration scope: 2
  - `src/features/architect/utils/tradeMachine/utils/validateInput.js`
  - `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
- Remaining JS surfaces in the same validator-adjacent slice that are not business-logic holdouts:
  - Shim-only compatibility files:
    - `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
    - `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
    - `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
    - `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js`
  - Barrels / public compatibility entry points:
    - `src/features/architect/utils/tradeMachine/index.js`
    - `src/features/architect/utils/tradeMachine/validators/index.js`
    - `src/features/architect/utils/tradeMachine/rules/index.js`
    - `src/features/architect/utils/tradeMachine/utils/index.js`
  - Shared constant / message surfaces:
    - `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
    - `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`

## 8. Master Doc Update
- Added `Validator TS Validate Roster E34 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative legacy `validateRoster` helper surface now lives in `rules/validateRoster.ts`.
- Recorded that `rules/validateRoster.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent roster semantics remained unchanged, including legacy `string[]` violations, exact message/details text, the current `rosterCounts` payload, the current `warningsOnly` behavior, and the current `enforceRosterWindow()` callback and grace-mode behavior.
- Recorded that targeted parity now includes direct `.js` helper assertions plus validator compatibility-barrel identity/behavior assertions.
- Recorded that the next best TS slice is the paired input-helper surface `utils/validateInput.js` + `utils/normalizeTradeInput.js`, chosen from the actual post-E34 repo state.
- Recorded that the actual post-E34 remaining live JS business-logic count in this validator-adjacent slice is 2.
