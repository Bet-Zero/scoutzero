# TM_VALIDATOR_TS_INPUT_HELPERS_E35 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical legacy input-helper surfaces from `src/features/architect/utils/tradeMachine/utils/validateInput.js` to `src/features/architect/utils/tradeMachine/utils/validateInput.ts` and from `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js` to `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts`.
- Behavior was preserved: both TS files are line-faithful ports of the legacy helper contracts, keeping the current validation strings/order, normalization defaults, fallback ordering, canonicalization behavior, and validator-adjacent consumer compatibility.
- No directly related business logic had to remain JS. `validateInput.js` and `normalizeTradeInput.js` remain JS only as required pure compatibility re-export shims.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/validateInput.ts`
  - Added the authoritative TS-backed port of the legacy `validateTradeInput()` helper surface.
- `src/features/architect/utils/tradeMachine/utils/validateInput.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts`
  - Added the authoritative TS-backed port of the legacy `normalizeTradeInput()` helper surface.
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `tests/validators/validateInput.test.ts`
  - Added direct shim-backed parity coverage for `validateInput.js`, including validator compatibility-barrel identity.
- `tests/validators/normalizeTradeInput.test.ts`
  - Added direct shim-backed parity coverage for `normalizeTradeInput.js`, including validator compatibility-barrel identity.
- `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js`
  - Made the Phase 66 source-scan guardrail shim-aware so it still inspects the authoritative `normalizeTradeInput` implementation after the JS file became a pure re-export.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E35 migration entry and updated the post-E35 queue note from the actual same-scope inventory.
- `return_packages/trade_machine/TM_VALIDATOR_TS_INPUT_HELPERS_E35_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `ValidateTradeInputParams`
  - Represents the authoritative `validateTradeInput()` entry shape for this helper surface: raw `teams`, `capProjections`, and `currentYear`.
  - Applies in `src/features/architect/utils/tradeMachine/utils/validateInput.ts`.
- `RawTradeInputPlayer`
  - Represents the broad legacy player payload accepted by `normalizeTradeInput()`, including the deprecated `getMatchingValue()` fallback path and existing alias fields.
  - Applies in `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts`.
- `NormalizedTradeTeam`
  - Represents the normalized team wrapper produced by `normalizeTradeInput()`, including canonicalized salary fields, `tradeExceptions`, `hardCapped`, and `appliedTPEs`.
  - Applies in `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts`.
- `NormalizedTradeInputResult`
  - Represents the authoritative normalized return shape from `normalizeTradeInput()`: normalized teams, normalized cap settings, `yearKey`, and defaulted `tradeCtx.tradeDate`.
  - Applies in `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts`.

## 4. Migration Work Completed
- `utils/validateInput.ts`
  - Ported the live JS helper logic into TS without changing runtime behavior.
  - Preserved:
    - exact validation message text, including the current `"must have either"` string
    - current team-count gates and control-flow order
    - current salary-data and pick-data validation behavior
    - current cap-projection lookup order and current-year validation order
  - Minimal contract correction required by typing:
    - none at runtime; the TS file keeps the legacy permissive raw-input behavior through local helper types and compatibility casts only.
- `utils/normalizeTradeInput.ts`
  - Ported the live JS helper logic into TS without changing runtime behavior.
  - Preserved:
    - `player.salary || getMatchingValue(...)` fallback semantics
    - canonical `getTeamTpeList(raw)` TPE reads
    - current team/player name defaults
    - current hard-cap marker passthrough behavior
    - current `tradeCtx.tradeDate || new Date().toISOString()` defaulting
    - current filtering of teams without a `team` object
  - Minimal contract correction required by typing:
    - a local compatibility cast was added only at the deprecated `getMatchingValue()` boundary because `normalizeTradeInput()` intentionally accepts broader raw payloads than the stricter `MatchingValuePlayer` TS signature models. Runtime behavior was not changed.
- `utils/validateInput.js` and `utils/normalizeTradeInput.js`
  - Converted to shim-only compatibility exports.
  - Hard rule satisfied: both JS files contain no remaining business logic after E35.
- Direct parity coverage
  - Added explicit direct shim-backed behavior assertions for both helper files and compatibility-barrel identity assertions through `validators/index.js`.
  - Preserved the broader shared helper coverage in `tests/trade/input_validation.test.js`.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/validateInput.js`
  - Remains JS only as the required pure compatibility re-export shim for stable `.js` imports.
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
  - Remains JS only as the required pure compatibility re-export shim for stable `.js` imports.
- `src/features/architect/utils/tradeHelpers.js`
  - Remains JS because it is a broader shared architect utility outside this narrow validator-adjacent slice; E35 only consumes its existing `getSalaryForYear()` contract unchanged.
- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
  - Remains JS because it is the canonical architect-wide persistence-contract helper outside this narrow validator-adjacent slice; E35 only consumes its existing `getTeamTpeList()` contract unchanged.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/validators/validateInput.test.ts tests/validators/normalizeTradeInput.test.ts tests/trade/input_validation.test.js src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the new TS-backed helper surfaces compile cleanly in the mixed JS/TS Trade Machine graph.
  - `tests/validators/validateInput.test.ts`
    - Proves direct `validateInput.js` shim behavior and validator compatibility-barrel identity remain unchanged.
  - `tests/validators/normalizeTradeInput.test.ts`
    - Proves direct `normalizeTradeInput.js` shim behavior and validator compatibility-barrel identity remain unchanged.
  - `tests/trade/input_validation.test.js`
    - Proves the existing direct helper behavior remains unchanged for validation errors, normalization output, deprecated `getMatchingValue()` fallback behavior, and adjacent `validateTrade()` invalid-input handling.
  - `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
    - Proves the existing canonical TPE read-path guardrail remains intact.
  - `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js`
    - Proves the `normalizeTradeInput` source-scan guardrail still verifies the authoritative implementation uses `getTeamTpeList(raw)` and avoids direct `raw.tradeExceptions` reads after the JS file became a shim.
  - `npm run validate:project`
    - Proves the updated TS/helper/test/doc files remain valid against the project schema.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot ...`: PASS (5 files, 48 tests)
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E35 is a narrow validator-adjacent helper migration slice. Direct shim-backed helper assertions, shared helper coverage, normalization guardrails, typecheck, and project validation provide targeted proof without broadening into unrelated rule families or guarded full-suite execution.

## 7. Remaining TS Migration Queue
- Post-E35 inventory used the same validator-adjacent Trade Machine migration scope used in E34/E35. The scope was not narrowed or redefined.
- Next best migration slice after E35:
  - No live JS business-logic files remain in this scope.
  - If reducing JS export surfaces is still desired, the next best slice is optional non-business-logic cleanup of the remaining public entrypoint barrels `src/features/architect/utils/tradeMachine/utils/index.js` + `src/features/architect/utils/tradeMachine/validators/index.js`.
- Remaining live JS business-logic holdouts in this validator-adjacent scope: 0
- Remaining JS files in the same scope by classification:
  - Business-logic holdouts:
    - none
  - Shim-only compatibility files:
    - `src/features/architect/utils/tradeMachine/utils/validateInput.js`
    - `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
    - `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
    - `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
    - `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
    - `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js`
  - Barrels / public entrypoints:
    - `src/features/architect/utils/tradeMachine/index.js`
    - `src/features/architect/utils/tradeMachine/validators/index.js`
    - `src/features/architect/utils/tradeMachine/rules/index.js`
    - `src/features/architect/utils/tradeMachine/utils/index.js`
  - Constants / config / message surfaces:
    - `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
    - `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`

## 8. Master Doc Update
- Added `Validator TS Input Helpers E35 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative legacy `validateInput` and `normalizeTradeInput` helper surfaces now live in `utils/validateInput.ts` and `utils/normalizeTradeInput.ts`.
- Recorded that `utils/validateInput.js` and `utils/normalizeTradeInput.js` are now pure compatibility re-export shims with no remaining business logic.
- Recorded that validator-adjacent input-helper semantics remained unchanged, including exact validation strings/order, current normalization defaults, deprecated `getMatchingValue()` fallback behavior, canonical `getTeamTpeList(raw)` reads, and current `tradeDate` defaulting.
- Recorded that targeted parity now includes explicit direct shim-backed behavior assertions for both helper files plus shim-aware normalization guardrails.
- Recorded that the actual post-E35 remaining live JS business-logic count in the same validator-adjacent scope used in E34/E35 is 0.
- Recorded that the next best slice is optional non-business-logic cleanup of `utils/index.js` + `validators/index.js` if reducing JS export surfaces remains a goal.
