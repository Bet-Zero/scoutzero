# TM_VALIDATOR_TS_CAP_LEGALITY_VALIDATOR_HUB_E62 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the validator-hub portion of the non-trade cap-legality boundary to authoritative TypeScript through `src/features/architect/utils/capLegalityValidation.ts`.
- Behavior was preserved across named exports, rule arrays/constants, default-export object member order, validator output shapes, issue/reason/warning text, fallback/default behavior, and the existing `contractNormalization` plus `capHoldTransitionHelpers` interactions.
- No validator business logic had to remain JS. `src/features/architect/utils/capLegalityValidation.js` remains only as an intentional pure compatibility shim so direct-path, extensionless, and explicit `.js` imports stay intact.

## 2. Files Changed
- `src/features/architect/utils/capLegalityValidation.ts`
  - What changed: Added the authoritative TS implementation by directly porting the existing validator hub and adding only local permissive types/casts needed for TypeScript acceptance.
  - Why it was safe: The runtime logic, export order, rule arrays/constants, default-export members, strings, and helper interactions were preserved rather than redesigned.
- `src/features/architect/utils/capLegalityValidation.js`
  - What changed: Replaced the prior JS implementation with a pure compatibility shim re-exporting the TS authority and its default export.
  - Why it was safe: Existing extensionless and explicit `.js` consumers keep resolving the same public surface without consumer rewrites.
- `src/tests/architect/offerSheets_closure.gate.test.ts`
  - What changed: Retargeted the source-scan authority check for `validateOfferSheetResolution` from the JS path to `capLegalityValidation.ts`.
  - Why it was safe: The test still guards the same validator behavior while reflecting that the authoritative implementation moved to TS.
- `src/tests/architect/phase74_room_exception_mvp_guardrails.test.js`
  - What changed: Retargeted the source-scan room-exception implementation check from the JS path to `capLegalityValidation.ts`.
  - Why it was safe: The behavioral guard remains unchanged; only the implementation-authority file path changed.
- `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`
  - What changed: Retargeted implementation checks to `capLegalityValidation.ts` and added an explicit shim-only check for `capLegalityValidation.js`.
  - Why it was safe: The test now distinguishes authoritative logic from compatibility behavior, which matches the E62 migration design.
- `tests/smoke/capLegalityValidationImports.smoke.test.ts`
  - What changed: Added focused smoke coverage for extensionless imports, explicit `.js` imports, named-export parity, default-export parity, and shim-only JS content.
  - Why it was safe: It verifies compatibility behavior without changing any production logic.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - What changed: Added the indexed E62 execution entry.
  - Why it was safe: The update records the completed migration state and follow-up status only.

## 3. Types Introduced or Hardened
- `AnyRecord`
  - Represents: permissive local record shape for dynamic hub inputs and intermediate values.
  - Applies in: dead-cap validation, cap-hold amount handling, and other dynamic object reads inside `capLegalityValidation.ts`.
- `SigningTerms`
  - Represents: the local permissive shape for canonical signing-terms data used by the authoritative validator hub.
  - Applies in: `normalizeSigningTerms()` and `getSigningTermsForPlayer()` inside the TS authority path.
- `NormalizeSigningTermsOptions`
  - Represents: the local options shape for fallback mechanism handling during signing-terms normalization.
  - Applies in: `normalizeSigningTerms()` inside the authoritative validator path.
- `ValidateOptionDecisionParams`
  - Represents: the local permissive parameter shape for `validateOptionDecision()` that preserves all current caller patterns.
  - Applies in: the authoritative option-decision validator path, including the existing offseason caller that does not pass both `team` and `player`.

## 4. Migration Work Completed
- `src/features/architect/utils/capLegalityValidation.js`
  - What changed: Moved the authoritative implementation into `capLegalityValidation.ts` and converted the `.js` file into a shim-only compatibility surface.
  - How authoritative behavior was preserved: The port kept the current named exports, export ordering, default-export object member ordering, rule arrays/constants, validator result shapes, issue/reason/warning text, fallback/default behavior, and helper interactions intact.
  - Minimal contract correction required by typing: Removed `.ts` suffixes from TS-only import specifiers, added local permissive types/casts, and explicitly typed `validateOptionDecision()` so existing callers continue compiling unchanged without editing out-of-scope consumers.

## 5. JS Holdouts
- `src/features/architect/utils/capLegalityValidation.js`
  - Remains JS only as a pure compatibility shim.
  - Exact reason: preserving direct-path, extensionless, and explicit `.js` import behavior is required in this phase, and deletion was not warranted by the current importer/test state.
- No JS business-logic holdout remains inside the E62 validator-hub boundary.

## 6. Regression Coverage Run
- `npm run test:node -- --reporter=dot tests/architect/capLegalityValidation.test.js src/tests/architect/capLegalityValidation.test.js tests/architect/offerSheetResolution.test.js tests/architect/offerSheetPersistence.test.js tests/architect/overrideBypass.test.js src/tests/architect/deadCapManagement.test.js src/tests/architect/exceptionManagement.test.js src/tests/architect/worldTime.test.js src/tests/architect/capLegality/exceptionBlocking.test.js src/tests/architect/phase39_drift_guardrails.test.js src/tests/architect/phase40_secondApron_drift_guardrails.test.js src/tests/architect/phase74_room_exception_mvp_guardrails.test.js src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js src/tests/architect/offerSheets_closure.gate.test.ts tests/smoke/capLegalityValidationImports.smoke.test.ts`
  - What it proved: direct validator-hub behavior, offer-sheet validation, dead-cap/exception validation, warning/rule exports, room-exception guardrails, TS-authority source-scan behavior, extensionless import compatibility, explicit `.js` import compatibility, default export parity, and shim-only JS content.
  - Result: PASS (`15` files, `455` tests).
- `npm run typecheck`
  - What it proved: the new TS authority compiles cleanly and current consumers continue to type-resolve the hub surface without consumer rewrites.
  - Result: PASS.
- `npm run validate:project`
  - What it proved: repo structure remains valid after adding the new TS authority and focused smoke coverage.
  - Result: PASS.
- Commands intentionally skipped
  - `npm run build`
  - Why skipped: no UI/routes/components changed in this pass.
  - `npm run test:diff -- --reporter=dot`
  - Why skipped: the focused node proof set exercised the exact migrated surface and compatibility boundary more directly.
  - broader suites such as `npm run test:architect -- --reporter=dot`
  - Why skipped: no targeted uncertainty remained after the focused proof set passed.

## 7. Post-E62 Status
- The validator-hub phase is effectively complete.
- No small follow-up is recommended inside the non-trade cap-legality boundary beyond optional future compatibility-shim removal if importer state ever makes that safe.
- The grouped phase succeeded cleanly.
- The broader non-trade cap-legality arc is now effectively complete.

## 8. Master Doc Update
- Added `### Validator TS Cap Legality Validator Hub E62 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that:
  - `capLegalityValidation` is now TS-backed through authoritative `src/features/architect/utils/capLegalityValidation.ts`
  - behavior remained unchanged across named exports, rule arrays/constants, default-export object member order, validator outputs, strings, fallback/default behavior, and helper interactions
  - `capLegalityValidation.js` now remains only as a pure compatibility shim
  - no immediate follow-up remains inside the validator-hub phase
  - the validator-hub phase completed cleanly
  - the broader non-trade cap-legality arc is now effectively complete
