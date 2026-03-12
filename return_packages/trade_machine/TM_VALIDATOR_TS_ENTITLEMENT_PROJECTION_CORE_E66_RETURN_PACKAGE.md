# TM_VALIDATOR_TS_ENTITLEMENT_PROJECTION_CORE_E66 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the entitlement projection-core boundary by moving `src/features/architect/utils/entitlements/entitlementPickRowProjection.js` to authoritative TypeScript in `src/features/architect/utils/entitlements/entitlementPickRowProjection.ts`.
- Behavior was preserved across the projection surface: the three named exports, fallback/default behavior, projection field assembly, ladder-summary handling, `termsShort` precedence/fallback, null placeholders, and label/secondary-text strings remained unchanged.
- No area had to remain JS inside the migrated projection helper. The original `.js` file remains only as an intentional compatibility shim for explicit `.js` and extensionless imports.

## 2. Files Changed
- `src/features/architect/utils/entitlements/entitlementPickRowProjection.ts`
  - Added the authoritative TS implementation for the projection helper.
  - Safe because it is a direct port of the existing logic with local typing only; no semantic redesign or adjacent-helper widening was introduced.
- `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
  - Replaced the legacy business-logic file with a pure re-export shim to `./entitlementPickRowProjection.ts`.
  - Safe because current consumers continue resolving through the same import path while the business logic now lives in the TS authority.
- `tests/entitlements/entitlementPickRowProjection.test.js`
  - Added focused assertions for ladder-summary assembly and `termsShort` override/fallback behavior.
  - Safe because the new cases lock existing projection behavior rather than changing runtime logic.
- `src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts`
  - Added guardrails proving the `.js` file is shim-only and that explicit `.js` imports and extensionless imports expose the same named API with no default export.
  - Safe because it verifies compatibility behavior without changing production code.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E66 execution entry.
  - Safe because it documents the completed migration boundary and the intended next follow-up phase.
- `return_packages/trade_machine/TM_VALIDATOR_TS_ENTITLEMENT_PROJECTION_CORE_E66_RETURN_PACKAGE.md`
  - Added the E66 execution return package.
  - Safe because it records the implementation and validation results only.

## 3. Types Introduced or Hardened
- `PickRowProtectionMeta`
  - Represents structured protection metadata (`type`, `protectedRange`, `appliesToYears`) returned by the projection helper.
  - Applies inside the authoritative TS projection path for parsed description protections and pick-rule-derived protections.
- `ProjectionOptions`
  - Represents the optional `teamCode` and `pickRulesById` inputs accepted by `projectEntitlementToPickRow()`.
  - Applies at the public TS authority boundary for the helper's existing options object.
- `PickRow`
  - Represents the projected pick-row output consumed by label/secondary-text helpers and existing UI readers.
  - Applies at the TS authority return boundary without changing the runtime field set.
- `ProjectionEntitlement`
  - Local overlay type over `EffectiveEntitlement` for the exact optional fields the projection helper reads.
  - Applies only inside `entitlementPickRowProjection.ts` so the migration could stay local instead of hardening shared entitlement authorities.
- `ProtectionLadderTierLike`, `ProtectionDetails`, and `LadderProtectionDetails`
  - Narrow local helper types for ladder normalization and protection derivation.
  - Apply only within the authoritative projection implementation to express current internal branches safely in TS.

## 4. Migration Work Completed
- `src/features/architect/utils/entitlements/entitlementPickRowProjection.js` -> `src/features/architect/utils/entitlements/entitlementPickRowProjection.ts`
  - Ported the existing projection helper into TypeScript as the new authority.
  - Preserved authoritative behavior by keeping the same internal helper flow: original-team parsing, via-team derivation, description parsing, pick-rule overrides, ladder override precedence, conditions assembly, `termsShort` fallback, and display helper formatting.
  - No contract correction was required beyond a local TS-only ladder filter annotation fix during typecheck; runtime behavior did not change.
- `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
  - Converted to a pure compatibility shim.
  - Preserved behavior for direct-path, explicit `.js`, and extensionless imports without changing runtime consumers.

## 5. JS Holdouts
- `src/features/architect/utils/entitlements/formatEntitlement.js`
  - Remains JS because it is explicitly out of scope for E66 and no blocker required widening into the formatting phase.
- `src/features/architect/tradeMachine/utils/entitlementWarnings.js`
  - Remains JS because it is explicitly out of scope for E66 and no blocker required widening into the warnings phase.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the new TS authority and new guardrail test type-check cleanly against the repo.
  - Result: PASS.
- `npm run validate:project`
  - Proved the added TS file, guardrail test, and return package still satisfy repo structural validation.
  - Result: PASS.
- `npm run test:node -- --reporter=dot tests/entitlements/entitlementPickRowProjection.test.js src/tests/architect/entitlementPickRowProjection.compatibility.guardrail.test.ts`
  - Proved the projection helper behavior stayed intact and the `.js` shim/API compatibility contract holds.
  - Result: PASS (`2` files, `38` tests).
- `npm run test:ui -- --reporter=dot src/tests/architect/entitlementPickRowDisplay.test.jsx`
  - Proved downstream UI rendering still receives the same ladder, swap, and conveyance projection behavior through existing consumers.
  - Result: PASS (`1` file, `3` tests).
- Commands intentionally skipped:
  - `npm run test:ui -- --reporter=dot src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx`
  - Skipped because it was designated as fallback-only and the primary node/UI proof set already passed without shim-resolution uncertainty.

## 7. Post-E66 Status
- The projection-core phase is effectively complete.
- No immediate follow-up is required inside `entitlementPickRowProjection`; the remaining follow-up is the already-planned adjacent helper phase.
- The grouped entitlement presentation arc succeeded cleanly for the projection-core slice and does not need another E66 pass.
- `formatEntitlement.js` and `entitlementWarnings.js` remain the intended next follow-up phase unless new evidence later proves otherwise.

## 8. Master Doc Update
- Added `### Validator TS Entitlement Projection Core E66 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Documented that the projection core is now TS-backed through `src/features/architect/utils/entitlements/entitlementPickRowProjection.ts`, behavior remained unchanged, the `.js` file is retained only as a compatibility shim, the projection-core phase completed cleanly, and `formatEntitlement.js` plus `entitlementWarnings.js` remain the intended next follow-up phase.
