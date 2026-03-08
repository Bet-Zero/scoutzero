# TM_VALIDATOR_TS_CONSENT_ELIGIBILITY_E6 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative consent validator/enforcer surface to TS via `validateConsent.ts` and `enforceConsent.ts`.
- Migrated the authoritative eligibility surface to TS via `validateEligibility.ts`.
- Added `validateReacquisition.ts` as the single authoritative reacquisition owner required to keep reacquisition logic out of duplicated JS/TS implementations and to let `validateEligibility.ts` delegate reacquisition checks explicitly.
- Behavior was preserved across the authoritative validator path and the helper enforcer path.
- Directly related JS files remain only as compatibility shims; all E6-touched JS files are pure re-export-only modules.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/constants/types.ts`
  - Added `ConsentValidationResult`, `EligibilityValidationResult`, and `ReacquisitionValidationResult`.
- `src/features/architect/utils/tradeMachine/rules/validateConsent.ts`
  - Added the sole TS consent validator implementation with canonical `ValidationIssue[]`.
- `src/features/architect/utils/tradeMachine/rules/enforceConsent.ts`
  - Added the sole TS consent enforcement implementation while preserving the plain-string helper contract.
- `src/features/architect/utils/tradeMachine/rules/validateEligibility.ts`
  - Added the sole TS eligibility implementation and delegated reacquisition checks to `validateReacquisition.ts`.
- `src/features/architect/utils/tradeMachine/rules/validateReacquisition.ts`
  - Added the sole authoritative reacquisition implementation for this slice.
- `src/features/architect/utils/tradeMachine/rules/validateConsent.js`
  - Replaced legacy logic with a pure re-export shim for `validateConsent.ts` and `enforceConsent.ts`.
- `src/features/architect/utils/tradeMachine/rules/enforceConsent.js`
  - Replaced legacy logic with a pure re-export shim for `enforceConsent.ts`.
- `src/features/architect/utils/tradeMachine/rules/validateEligibility.js`
  - Replaced legacy logic with a pure re-export shim for `validateEligibility.ts`.
- `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js`
  - Kept as a pure re-export shim pointing at `validateEligibility.ts`.
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
  - Narrowed to a pure compatibility host that only re-exports `validateCash`, `validateReacquisition`, and `enforceEligibility`.
- `src/features/architect/utils/tradeMachine/rules/validateReacquisition.js`
  - Added a pure re-export shim to keep `.js` import compatibility for the new TS reacquisition module.
- `tests/trade/consent_and_reacq.test.js`
  - Added direct canonical `validateConsent()` coverage and explicit `rules.consent` / `rules.reacquisition` assertions through `validateTrade()`.
- `tests/trade/consent_and_birdVeto.test.js`
  - Added explicit helper-contract assertions proving `enforceConsent()` still returns plain strings and still routes strings to `reject` / `warn`.
- `tests/trade/reacquisition_bar.test.js`
  - Added direct canonical `validateEligibility()` coverage plus helper-contract assertions proving `enforceEligibility()` still returns plain strings and still routes strings to `reject` / `warn`.
- `src/tests/architect/batchB_cbaRules.test.js`
  - Updated direct eligibility assertions to read canonical issue text and added a canonical rule/code assertion for the two-way blocker.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E6 entry and updated the return-package list.
- `return_packages/trade_machine/TM_VALIDATOR_TS_CONSENT_ELIGIBILITY_E6_RETURN_PACKAGE.md`
  - Added this return package.

## 3. Types Introduced or Hardened
- `ConsentValidationResult`
  - Canonical typed result for the authoritative consent validator path.
  - Applies in `validateConsent.ts` and the `teamResults.rules.consent` envelope.
- `EligibilityValidationResult`
  - Canonical typed result for the authoritative eligibility validator path.
  - Applies in `validateEligibility.ts` and the `teamResults.rules.eligibilityEnforcement` normalization path after string-helper conversion.
- `ReacquisitionValidationResult`
  - Canonical typed result for the authoritative reacquisition validator path.
  - Applies in `validateReacquisition.ts` and the `teamResults.rules.reacquisition` envelope.
- `ValidationIssue`
  - Reused as the canonical issue item for consent, eligibility, and reacquisition validators.
  - Now carries explicit issue codes for this slice:
    - `CONSENT__FULL_NTC_REQUIRED`
    - `CONSENT__LIMITED_NTC_REQUIRED`
    - `CONSENT__BIRD_VETO_REQUIRED`
    - `ELIGIBILITY__TWO_WAY_PLAYER_BLOCKED`
    - `ELIGIBILITY__REACQUISITION_TRADE_BACK_BLOCKED`
    - `ELIGIBILITY__REACQUISITION_WAIVER_BLOCKED`
    - `REACQUISITION__ONE_YEAR_TRADE_BACK_BLOCKED`

## 4. Migration Work Completed
- `validateConsent`
  - Moved to TS with explicit team/player/context typing and canonical issues.
  - Preserved the existing destination-resolution order, exact consent messages, and exact top-level result messages.
- `enforceConsent`
  - Moved to TS as the sole enforcement implementation.
  - Preserved the existing outgoing/incoming checks, exact helper message text, `string[]` return shape, and `warn` / `reject` callback behavior.
- `validateEligibility`
  - Moved to TS as the sole eligibility implementation.
  - Preserved exact two-way detection behavior and exact top-level result messages.
  - Reacquisition logic was removed from inline duplication and delegated to `validateReacquisition.ts`.
- `validateReacquisition`
  - Added in TS as the single authoritative owner for reacquisition logic in this slice.
  - Preserved the current authoritative engine-facing `validateTrade()` reacquisition behavior.
  - Also exports the typed collector used by `validateEligibility.ts` so the eligibility surface can reuse reacquisition checks without re-implementing them.
- JS shim conversion
  - All E6-touched JS files are now pure re-export-only shims.
  - No business logic remains duplicated between JS and TS copies in this slice.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
  - Remains JS only as a compatibility host because the live engine and compatibility exports still consume that path.
  - It now contains no business logic; it is re-export-only.
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Remains JS because E6 was explicitly limited to typed rule-surface migration plus minimal typed consumption compatibility.
- Other E6-touched JS files
  - `validateConsent.js`, `enforceConsent.js`, `validateEligibility.js`, `enforceEligibility.js`, and `validateReacquisition.js` remain JS only as import-path shims.
  - Exact blocker/reason: preserving existing `.js` import paths without broadening this pass into engine/barrel migration.

## 6. Regression Coverage Run
- Commands run:
  - `npm run test:node -- --reporter=dot tests/trade/consent_and_reacq.test.js tests/trade/consent_and_birdVeto.test.js tests/trade/reacquisition_bar.test.js tests/trade/validatorTrustFixes.test.js src/tests/architect/batchB_cbaRules.test.js`
  - `npm run typecheck`
  - `npm run validate:project`
- What real behavior they prove:
  - `consent_and_reacq.test.js`
    - Direct canonical `validateConsent()` issue output.
    - Authoritative `validateTrade()` consent blocking and authoritative `rules.reacquisition` blocking.
  - `consent_and_birdVeto.test.js`
    - `enforceConsent()` still returns plain strings and still routes the same strings to `reject` and `warn`.
  - `reacquisition_bar.test.js`
    - Direct canonical `validateEligibility()` reacquisition issue output.
    - `enforceEligibility()` still returns plain strings and still routes the same strings to `reject` and `warn`.
  - `validatorTrustFixes.test.js`
    - Existing authoritative `validateTrade()` / apply-path regression coverage around the live validator contract remains green after the TS migration.
  - `batchB_cbaRules.test.js`
    - Two-way eligibility blocking still works after the validator moved to canonical issues.
  - `typecheck`
    - The new TS rule modules and shim boundaries compile cleanly.
  - `validate:project`
    - The repo structure remains schema-valid after adding the new TS and shim files.
- Results:
  - All five targeted test files passed: 38 tests passed.
  - `npm run typecheck` passed.
  - `npm run validate:project` passed.
- Commands intentionally skipped:
  - Full suite commands were intentionally skipped because the prompt did not contain `RUN FULL SUITE`, and repo policy blocks full-suite execution without that exact phrase.

## 7. Remaining TS Migration Queue
- Next best slice: the generic timing validation/enforcement cluster.
- Recommended follow-up targets:
  - `validateTiming` / timing enforcement surfaces only after separate behavior re-validation confirms the current generic-timing boundary is still stable after the earlier S&T ownership changes.

## 8. Master Doc Update
- Added `return_packages/trade_machine/TM_VALIDATOR_TS_CONSENT_ELIGIBILITY_E6_RETURN_PACKAGE.md` to the indexed return-package list in `docs/architect/TRADE_MACHINE_MASTER.md`.
- Added a new `Validator TS Consent Eligibility E6 (2026-03-08)` entry stating:
  - authoritative consent is now in TS via `validateConsent.ts` and `enforceConsent.ts`
  - authoritative eligibility is now in TS via `validateEligibility.ts`
  - reacquisition ownership for this cluster is now consolidated in `validateReacquisition.ts`
  - all E6-touched JS files are pure re-export compatibility shims
  - the next slice should be the generic timing validation/enforcement cluster after separate behavior re-validation
