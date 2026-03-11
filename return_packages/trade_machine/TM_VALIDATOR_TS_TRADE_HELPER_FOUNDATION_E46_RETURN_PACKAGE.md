# TM_VALIDATOR_TS_TRADE_HELPER_FOUNDATION_E46 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the root trade-facing helper foundation to TypeScript by adding authoritative implementations for `tradeHelpers`, `hardCapUtils`, `faExceptionUtils`, and `capUtils`.
- Behavior was preserved across salary helpers, apron labels, hard-cap helpers, FA-exception helpers, pick-display formatting, currency/tooltip text, and legacy return shapes.
- No business logic had to remain in JS. The four original `.js` files remain only as shim-only compatibility re-exports to preserve current extensionless and `.js` import behavior.

## 2. Files Changed
- `src/features/architect/utils/tradeHelpers.ts` — added the authoritative TS implementation for the full root helper surface; safe because it is a direct behavior-preserving port of the prior JS logic with permissive local typing only.
- `src/features/architect/utils/hardCapUtils.ts` — added the authoritative TS hard-cap helper implementation; safe because it preserves current trigger sources, limit selection, reason strings, and fallback order.
- `src/features/architect/utils/faExceptionUtils.ts` — added the authoritative TS FA-exception helper implementation; safe because it preserves current bucket passthrough, expiry/apron gating, mutation behavior, and summary formatting.
- `src/features/architect/utils/capUtils.ts` — added the authoritative TS root cap/apron facade; safe because it continues delegating to tradeMachine SSOT and preserves legacy mapping behavior exactly.
- `src/features/architect/utils/tradeHelpers.js` — reduced to a pure compatibility shim re-exporting `./tradeHelpers.ts`; safe because consumer import paths stay stable while business logic moves to TS.
- `src/features/architect/utils/hardCapUtils.js` — reduced to a pure compatibility shim re-exporting `./hardCapUtils.ts`; safe because runtime API stays unchanged.
- `src/features/architect/utils/faExceptionUtils.js` — reduced to a pure compatibility shim re-exporting `./faExceptionUtils.ts`; safe because runtime API stays unchanged.
- `src/features/architect/utils/capUtils.js` — reduced to a pure compatibility shim re-exporting `./capUtils.ts`; safe because root imports still resolve and legacy helper names remain intact.
- `tests/tradeHelpers.test.js` — expanded direct helper coverage for object-style allowable incoming, FA-exception ceiling, TPE remainder, currency formatting, trade ID generation, and adjustment tooltip behavior; safe because it only adds parity assertions on existing behavior.
- `tests/hardCapUtils.test.ts` — added focused hard-cap helper coverage; safe because it verifies current trigger/status/reason behavior without changing runtime code.
- `tests/faExceptionUtils.test.ts` — added focused FA-exception helper coverage; safe because it verifies current bucket and summary behavior without changing runtime code.
- `tests/smoke/helperFoundationImports.smoke.test.ts` — added import compatibility smoke coverage for extensionless and `.js` helper paths; safe because it only proves preserved import behavior.
- `src/tests/architect/phase42_apron_derivation_consolidation.test.js` — added root `capUtils.getAllowableIncomingMargin()` compatibility assertions; safe because it locks current deprecated facade behavior.
- `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js` — updated shim/authoritative-file assertions and allowlist entries for TS-authoritative apron helpers; safe because it aligns existing guardrails with the new authoritative file locations.
- `docs/architect/TRADE_MACHINE_MASTER.md` — added the indexed E46 completion entry; safe because it documents the completed migration only.
- `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_HELPER_FOUNDATION_E46_RETURN_PACKAGE.md` — added this return package; safe because it is documentation only.

## 3. Types Introduced or Hardened
- `AllowableIncomingObjectParams` / `AllowableIncomingResult` — represent the object-style `calculateAllowableIncoming()` contract in `src/features/architect/utils/tradeHelpers.ts`; they harden the TS-authoritative path while preserving the existing overload behavior.
- `TradeCapSettingsLike`, `TradeExceptionLike`, `TradeHelperPlayer`, `TradeTeamEntry` — permissive local helper-input types in `src/features/architect/utils/tradeHelpers.ts`; they capture current loose caller shapes without narrowing runtime behavior.
- `HardCapTeamState`, `HardCapSettingsLike`, `HardCapBucketLike` — permissive hard-cap helper state shapes in `src/features/architect/utils/hardCapUtils.ts`; they now anchor the authoritative hard-cap helper path.
- `FaExceptionTeamContext`, `FaExceptionTeamSeasonState`, `FaExceptionBucketLike` — permissive FA-exception helper context shapes in `src/features/architect/utils/faExceptionUtils.ts`; they now anchor the authoritative FA-exception helper path.
- `ArchitectCapSettingsLike` / `ArchitectCapTeamLike` — permissive root cap facade shapes in `src/features/architect/utils/capUtils.ts`; they preserve legacy root helper inputs while the authoritative path is now TS-backed.

## 4. Migration Work Completed
- `src/features/architect/utils/tradeHelpers.js`
  - Moved the authoritative implementation to `tradeHelpers.ts` and converted the original file to a shim.
  - Preserved salary fallback order, apron-label mapping, pick/swap formatting, TPE helpers, currency formatting, trade ID generation, and adjustment-tooltip text exactly.
  - Minimal contract correction required by typing: none.
- `src/features/architect/utils/hardCapUtils.js`
  - Moved the authoritative implementation to `hardCapUtils.ts` and converted the original file to a shim.
  - Preserved hard-cap trigger detection, status helpers, cap-limit selection, and exact reason/fallback strings.
  - Minimal contract correction required by typing: none.
- `src/features/architect/utils/faExceptionUtils.js`
  - Moved the authoritative implementation to `faExceptionUtils.ts` and converted the original file to a shim.
  - Preserved bucket passthrough, eligibility gating, expiry checks, in-place allocation mutation, and summary text formatting.
  - Minimal contract correction required by typing: none.
- `src/features/architect/utils/capUtils.js`
  - Moved the authoritative implementation to `capUtils.ts` and converted the original file to a shim.
  - Preserved the legacy root facade over tradeMachine SSOT, including return-label mapping and the simplified deprecated `getAllowableIncomingMargin()` behavior.
  - Minimal contract correction required by typing: none.

## 5. JS Holdouts
- `src/features/architect/utils/tradeHelpers.js` — remains JS only as a shim-only compatibility surface so current extensionless and `.js` imports keep working; no business logic remains.
- `src/features/architect/utils/hardCapUtils.js` — remains JS only as a shim-only compatibility surface so current extensionless and `.js` imports keep working; no business logic remains.
- `src/features/architect/utils/faExceptionUtils.js` — remains JS only as a shim-only compatibility surface so current extensionless and `.js` imports keep working; no business logic remains.
- `src/features/architect/utils/capUtils.js` — remains JS only as a shim-only compatibility surface so current extensionless and `.js` imports keep working; no business logic remains.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the new TS-authoritative helper files and targeted TS test additions compile cleanly inside the existing project.
  - Result: PASS.
- `npm run test:node -- --reporter=dot tests/tradeHelpers.test.js tests/tradeSalaryMatching.test.js tests/newSchemaValidation.test.js tests/trade/hardCap_trigger_faException.test.js tests/hardCapUtils.test.ts tests/faExceptionUtils.test.ts tests/smoke/helperFoundationImports.smoke.test.ts src/tests/architect/apronSemantics.test.js src/tests/architect/phase40_secondApron_drift_guardrails.test.js src/tests/architect/phase42_apron_derivation_consolidation.test.js src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js src/tests/tradeMachine/displayFix.test.js src/tests/tradeMachine/draftPicksSmokeCheck.test.js src/tests/tradeMachine/swapResolution.test.js`
  - Proved the migrated helper surfaces preserve direct helper behavior, trade-facing strings/labels/formatting, hard-cap/apron/FA-exception gating, updated guardrails, and stable extensionless/`.js` import paths.
  - Result: PASS (`14` files, `135` tests).
- `npm run validate:project`
  - Proves the new TS helper files and added tests/doc files fit the project structure rules after the grouped migration.
  - Result: PASS.

## 7. Post-E46 Status
- The trade-facing helper foundation arc is effectively complete.
- No immediate follow-up is recommended inside this grouped arc beyond any future importer-state decision to retire the kept JS shims.
- The grouped execution succeeded cleanly: all four targeted helper surfaces are now materially TS-backed, behavior stayed unchanged, and remaining JS is narrow and intentional shim-only compatibility surface area.

## 8. Master Doc Update
- Added `### Validator TS Trade Helper Foundation E46 (2026-03-11)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the root trade-facing helper foundation is now TS-backed via `tradeHelpers.ts`, `hardCapUtils.ts`, `faExceptionUtils.ts`, and `capUtils.ts`.
- Recorded that runtime behavior and current helper output text/formatting remained unchanged.
- Recorded that the four original `.js` files now remain only as shim-only compatibility re-exports.
- Recorded that the grouped arc completed cleanly with no immediate follow-up required.
