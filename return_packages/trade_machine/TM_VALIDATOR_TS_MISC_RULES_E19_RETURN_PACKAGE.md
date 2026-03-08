# TM_VALIDATOR_TS_MISC_RULES_E19 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical `miscRules` rule/helper surface into TypeScript via `src/features/architect/utils/tradeMachine/rules/miscRules.ts`.
- Preserved current runtime behavior for `validateBYC`, `validatePlayerConsent`, `enforceTradeKicker`, and the legacy `validateAllNewRules` composition.
- `src/features/architect/utils/tradeMachine/rules/miscRules.js` now contains no remaining business logic and is a pure compatibility re-export shim only.
- No directly related area had to remain JS as a blocker for the `miscRules` surface itself.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/miscRules.ts`
  - Added the TS-backed authoritative `miscRules` implementation with narrow file-local types.
- `src/features/architect/utils/tradeMachine/rules/miscRules.js`
  - Reduced to a pure compatibility re-export shim so existing `.js` imports remain stable and no business logic remains in JS.
- `tests/trade/miscRules.test.ts`
  - Added focused direct helper-surface coverage for BYC mutation, fallback salary lookup behavior, consent message text, trade-kicker behavior, and `.js` shim-path compatibility.
- `tests/tradeValidator.test.js`
  - Added a validator-facing BYC parity assertion proving the live `validateTrade()` path still sees unchanged `validateBYC`-driven `previousSalary` / `matchOutgoing` downstream salary effects.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E19 indexed migration entry and recorded the post-E19 state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_MISC_RULES_E19_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `MiscRulesContext`
  - Represents the narrow context shape read by `miscRules`, including `currentYear`, `yearKey`, `normalizedYear`, and trade-kicker timing fields.
  - Applies across the authoritative TS-backed `validateBYC`, `validateAllNewRules`, and `enforceTradeKicker` path.
- `MiscRulesPlayer`
  - Represents the exact player fields read or mutated by `miscRules`, including BYC, consent, and trade-kicker properties.
  - Applies to `validateBYC`, `validatePlayerConsent`, and `enforceTradeKicker`.
- `MiscRulesTeam`
  - Represents the narrow team shape consumed by `miscRules`, including `sends[]` and `teamId`.
  - Applies across the authoritative `miscRules` exports without widening broader validator contracts.
- `MiscRulesValidationResult`
  - Represents the object-shaped BYC result emitted by `validateBYC`.
  - Applies to the authoritative BYC helper surface that mutates outgoing player matching values.

## 4. Migration Work Completed
- `miscRules.ts`
  - Ported the live `miscRules` behavior 1:1 from JS to TS.
  - Preserved:
    - `validateBYC()` year normalization priority and salary lookup fallback order
    - in-place BYC mutation of `matchOutgoing`, `isBYC`, and `previousSalary`
    - `validatePlayerConsent()` duplicate-message behavior and exact message text
    - `enforceTradeKicker()` salary base, proration behavior, and guaranteed-money cap
    - `validateAllNewRules()` legacy mixed composition without normalizing or modernizing it
- `miscRules.js`
  - Converted to a shim-only compatibility export.
  - No business logic remains in the JS file after E19.
- Minimal contract correction required by typing:
  - `miscRules` previously referenced nonexistent `./validateDraftPicks.js`; E19 now imports the canonical `./draftRules.js` source directly from the TS implementation so the migrated `miscRules` surface can load and execute without widening the slice.
  - `validateAllNewRules()` required a fully local TS compatibility assertion for its legacy mixed spread composition. The emitted runtime behavior remains unchanged, including the legacy mixed iterable/non-iterable contract.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/draftRules.js`
  - Remained JS because E19 only needed the existing canonical draft-pick rule implementation as an immediate dependency of `miscRules`; migrating the draft-rule family here would broaden the slice.
- `src/features/architect/utils/tradeMachine/rules/basicRules.js`
  - Remained JS because E19 preserved the existing second-apron dependency surface instead of reopening broader apron-rule migration.
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
  - Remained JS because E19 only consumed its existing `validateCash` compatibility surface and did not broaden into the broader eligibility-rule family.
- `src/features/architect/utils/tradeHelpers.js`
  - Remained JS because E19 preserved the existing salary fallback helper dependency needed by BYC lookup behavior rather than broadening into shared helper migration.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/miscRules.test.ts tests/trade/byc_outgoing_max.test.js tests/trade/tradeKicker_proration.test.js tests/trade/tradeKicker_zeroGuarantee.test.js tests/tradeValidator.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS-backed `miscRules` surface compiles cleanly against the existing JS/TS consumer graph and preserves the stable `.js` import surface.
  - `tests/trade/miscRules.test.ts` is helper-level coverage proving direct `miscRules` behavior remains unchanged for BYC mutation, fallback salary lookup behavior, consent strings, trade-kicker math, and shim-based `.js` import compatibility.
  - `tests/trade/byc_outgoing_max.test.js` is helper-level coverage proving downstream BYC outgoing matching values remain `max(previousSalary, 50% of newSalary)`.
  - `tests/trade/tradeKicker_proration.test.js` and `tests/trade/tradeKicker_zeroGuarantee.test.js` are helper-level coverage proving trade-kicker proration and guaranteed-money cap behavior remain unchanged in the canonical matching-values path.
  - `tests/tradeValidator.test.js` is authoritative live-path coverage proving `validateTrade()` still sees unchanged BYC-driven downstream salary behavior, including `validateBYC`-mutated `previousSalary` / `matchOutgoing` effects feeding later salary calculations.
- Results:
  - PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason:
  - E19 was a narrow validator-adjacent rule-family migration. The targeted helper and live validator-path tests provided more direct proof of behavior preservation for the `miscRules` slice than broader suites.

## 7. Remaining TS Migration Queue
- The next best TS slice should be chosen from the actual post-E19 holdouts rather than hardcoded in advance.
- `src/features/architect/utils/tradeMachine/utils/dataValidation.js` is a likely candidate because it remains live JS business logic consumed directly by typed `matchingValues.ts`.
- This is not mandatory:
  - another remaining holdout should be chosen instead if the actual post-E19 dependency graph or risk profile makes it the better next step.

## 8. Master Doc Update
- Added `Validator TS Misc Rules E19 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the `miscRules` surface now lives in `rules/miscRules.ts`.
- Recorded that `rules/miscRules.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent misc-rule semantics remained unchanged, including BYC behavior, consent message text, trade-kicker behavior, and legacy `validateAllNewRules()` composition.
- Recorded that the next best slice should be selected from the actual post-E19 state, with `utils/dataValidation.js` noted as a likely but not mandatory candidate.
