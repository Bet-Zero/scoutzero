# TM_VALIDATOR_RULE_FIXES_E4 — EXECUTION RETURN PACKAGE

## 1. Summary
- Fixed the three blocker-level P2 rule defects in the authoritative validator path:
  - `P2-F001`: TPE expiry now uses the validator's canonical `tradeDate`, not machine time.
  - `P2-F002`: live TPE restrictions now run from one canonical internal TPE-usage representation built from player assignments plus optional compatibility input.
  - `P2-F003`: seasonal cash-limit enforcement now reads the authoritative live/apply field shape, `cashSent`.
- No target was left partial in the reviewed authoritative preview/apply path.
- Outcome: the authoritative validator now enforces the reviewed TPE expiry, live-path TPE restriction, and seasonal cash-limit rules correctly enough to close the P2 substantive blockers.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Added canonical TPE normalization/usage helpers and preserved compatibility-object mutation where the direct helper tests still expect it.
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
  - Switched expiry to canonical `tradeDate` and moved TPE restriction enforcement onto the canonical normalized TPE-usage path.
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
  - Unified cash validation on `cashSent` and restored the canonical second-apron cash message.
- `tests/trade/tpe_creation_expiry_usage.test.js`
  - Reworked TPE expiry/aggregation coverage around authoritative live `validateTrade()` input instead of injected `appliedTPEs`.
- `tests/trade/tpe_absorption_fail_closed.test.js`
  - Added live-path fail-closed coverage for missing, unknown, stale, and valid team-held `tpeId` resolution.
- `tests/trade/secondApron_tpeBan.test.js`
  - Reworked second-apron TPE tests to use team-held TPE data plus live-path player `tpeId` assignments.
- `tests/trade/cashLedger_season_tracking.test.js`
  - Added the required live `validateTrade()` seasonal cash-limit proof using `cashSent`.
- `tests/trade/validatorTrustFixes.test.js`
  - Added authoritative apply-path regressions through `computeWorldMutation()`.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E4 return-package index entry and the dated status note for the P2 blocker closure.
- `return_packages/trade_machine/TM_VALIDATOR_RULE_FIXES_E4_RETURN_PACKAGE.md`
  - Added this return package.

## 3. Implemented Rule Fixes
### `P2-F001`
- What changed:
  - `validateTradeExceptions()` now reads `context.tradeDate` as the single rule-level expiry date source and no longer calls `new Date()` to decide TPE legality.
- Exact authoritative path now used:
  - Preview: `validateTrade()` -> canonical `tradeDate` -> `validateTradeExceptions()`.
  - Apply: `computeWorldMutation()` -> `validatePostTradeSnapshotForContext()` -> `validateTrade()` -> canonical `tradeDate` -> `validateTradeExceptions()`.
- Why this is the correct substantive fix:
  - The validator entrypoint already normalizes `tradeDate`; making the rule consume that same canonical field fixes historical and future-dated worlds without splitting behavior by machine clock.
- Follow-up still remaining:
  - None in the reviewed authoritative rule path.

### `P2-F002`
- What changed:
  - Added `buildCanonicalTeamTpeUsage()` to normalize player-assigned live TPE usage and optional `appliedTPEs` into one canonical internal representation before restriction checks run.
  - `validateTradeExceptions()` now uses that unified representation for:
    - missing/unknown `tpeId` fail-closed checks
    - second-apron prior-year TPE blocking
    - TPE-plus-outgoing-salary blocking
    - expiry and capacity checks
- Exact authoritative path now used:
  - `validateTrade()` builds routed `incomingPlayers` from live sends, `buildCanonicalTeamTpeUsage()` resolves those players against `getTeamTpeList(team.team)` plus optional compatibility input, and `validateTradeExceptions()` enforces all blocker rules from that single `usedTpes` set.
  - Apply uses the exact same rule path through `computeWorldMutation()` -> `validatePostTradeSnapshotForContext()` -> `validateTrade()`.
- Why this is the correct substantive fix:
  - The blocker was not lack of TPE data in the engine; it was rule branches depending on `usingAppliedTPEs`. The new path makes actual attempted TPE use the enforcement trigger and leaves `appliedTPEs` as compatibility input only.
- Follow-up still remaining:
  - No browser-level click-through test proves the exact TPE-selector UI interaction itself, but the authoritative preview/apply validator path is runtime-covered.

### `P2-F003`
- What changed:
  - `validateCash()` now uses `team.cashSent` as the single validator cash field and computes seasonal cash usage from `team.team.cashLedger.totalOut + team.cashSent`.
  - The canonical second-apron cash message was preserved so the existing live cash blocker keeps the same wording.
- Exact authoritative path now used:
  - Preview: `validateTrade()` -> `validateCash(teamForValidation, context)` with `cashSent`.
  - Apply: `computeWorldMutation()` -> `validatePostTradeSnapshotForContext()` -> `validateTrade()` -> `validateCash()` with `cashSent`.
- Why this is the correct substantive fix:
  - The engine and apply wrappers already carry `cashSent`; moving the rule onto that shape closes the helper/live split without introducing a parallel path.
- Follow-up still remaining:
  - None in the reviewed authoritative validator/apply path.

## 4. Regression Coverage Added or Updated
- `tests/trade/tpe_creation_expiry_usage.test.js`
  - Proves historical TPE legality before expiry, future-date TPE expiry illegality, and live-path TPE-plus-outgoing-salary blocking.
  - Hits authoritative `validateTrade()` directly.
- `tests/trade/tpe_absorption_fail_closed.test.js`
  - Proves fail-closed behavior for missing `tpeId`, unknown `tpeId`, stale assigned `tpeId` that does not resolve against team-held TPEs, and a valid team-held `tpeId`.
  - Hits authoritative `validateTrade()` directly; direct helper cases remain as supporting coverage only.
- `tests/trade/secondApron_tpeBan.test.js`
  - Proves second-apron prior-year TPE blocking and below-apron allowance using team-held TPE data plus live-path player assignments.
  - Hits authoritative `validateTrade()` directly.
- `tests/trade/cashLedger_season_tracking.test.js`
  - Proves the seasonal cash-limit rule through live `validateTrade()` with `cashSent`; the helper-only `validateCash()` case remains supporting evidence only.
  - Hits authoritative `validateTrade()` directly.
- `tests/trade/validatorTrustFixes.test.js`
  - Proves apply-path rejection for prior-year TPE use and seasonal cash-limit overflow through `computeWorldMutation()` and `_validatedTradeContext`.
  - Hits the authoritative apply path directly.

## 5. Remaining Gaps
- No browser-level UI interaction test was added for manually selecting a TPE or entering cash in the editor. The authoritative proof in this pass is at the validator/apply boundary:
  - preview/runtime: `validateTrade()`
  - apply/runtime: `computeWorldMutation()` -> `validatePostTradeSnapshotForContext()` -> `validateTrade()`

## 6. Validation Run
- Commands run:
  - `npm run test:node -- --reporter=dot tests/trade/tpe_creation_expiry_usage.test.js tests/trade/tpe_absorption_fail_closed.test.js tests/trade/secondApron_tpeBan.test.js tests/trade/cashLedger_season_tracking.test.js tests/trade/validatorTrustFixes.test.js tests/tradeValidatorEdgeCases.test.js`
  - `npm run test:node -- --reporter=dot tests/tradeValidator.test.js`
  - `npm run test:node -- --reporter=dot tests/tradeExceptions.test.js`
  - `npm run test:trade -- --reporter=dot`
  - `npm run typecheck`
- Result:
  - Targeted E4 validator/apply regression suite passed: `6` files, `28` tests.
  - Focused trade-validator rerun passed: `1` file, `14` tests.
  - Focused helper regression rerun passed: `1` file, `7` tests.
  - Full trade suite passed: `61` files, `550` tests.
  - `typecheck` passed.
- Intentionally not run:
  - `npm run build`
    - Not necessary after validator-rule, test, and doc changes once full trade coverage plus `typecheck` passed.
  - `npm run validate:project`
    - No source-folder structural/export changes were made; this pass only changed validator logic, tests, docs, and return packages.
  - `npm run lint`
    - Repo policy says lint runs only when requested because of known pre-existing lint noise.

## 7. Master Doc Update
- Added `return_packages/trade_machine/TM_VALIDATOR_RULE_FIXES_E4_RETURN_PACKAGE.md` to the indexed Trade Machine return-package list in `docs/architect/TRADE_MACHINE_MASTER.md`.
- Added a new dated entry, `Validator Rule Fixes E4 (2026-03-08)`, stating:
  - the P2 substantive rule blockers were fixed in the authoritative preview/apply path
  - `tradeDate` is now the rule-level TPE expiry source of truth
  - targeted validator rule-module TS migration may resume, but should stay scoped and behavior-first
