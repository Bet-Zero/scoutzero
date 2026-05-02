# TypeScript Gate 3/4/6/7 Classification

> Historical status: completed TypeScript campaign record.
> Current status: TypeScript migration and hardening are complete in this repo.
> Reopen only if a TypeScript maintenance gate regresses.
> Current entry point: [docs/typescript/README.md](README.md)

Date: 2026-04-25

Verdict: Gates 3, 4, 6, and 7 pass by current scan evidence, cleanup, and
classification. Full TypeScript hardening is still incomplete until Gate 5 and
Gate 8 pass.

## Gate 3 Declaration Honesty

Command:

```bash
rg -n "declare module|\bany\b|as any|Record<string, any>" src -g '*.d.ts'
```

Result: 2 hits, 0 `any` declarations.

| File | Lines | Classification | Reason | Follow-up |
| --- | ---: | --- | --- | --- |
| `src/types/vendor-ui.d.ts` | 1-19 | JUSTIFIED VENDOR DECLARATION | Local declaration for `lodash.debounce`; it defines concrete tuple args, cancel, and flush without `any`. | Replace only if upstream package types are added. |
| `src/types/vendor-ui.d.ts` | 22-46 | JUSTIFIED VENDOR DECLARATION | Local declaration for `react-window`; it defines concrete list props and component methods without `any`. | Replace only if upstream package types are added. |

## Gate 4 Runtime Boundary Honesty

Command:

```bash
rg -n "doc\.data\(\) as|JSON\.parse|localStorage|sessionStorage|searchParams|URLSearchParams|useSearchParams|params" src/features/architect src/firebase src/shared/hooks src/data src/pages -g '*.ts' -g '*.tsx'
```

Result: 307 candidate hits. The command intentionally overmatches `params`
JSDoc and ordinary function parameter names; those are false positives. The
true runtime boundaries are classified below.

| Boundary family | Files / evidence | Classification | Reason safe | Follow-up |
| --- | --- | --- | --- | --- |
| Tier Maker route/query params | `src/pages/TierMakerView.tsx` | VALIDATED | `mode` query param is narrowed by `isValidViewMode`; route id is used as an opaque Firestore id and error state is typed. | None. |
| Architect season query/local storage | `src/features/architect/GMDashboard/hooks/useArchitectState.ts` | VALIDATED | URL/localStorage season values are parsed as numbers and accepted only when present in `availableYears`. Active world id is treated as an opaque string. | None. |
| Free-agency filter localStorage | `src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts` | VALIDATED | JSON parse is wrapped in try/catch and passed through `parseFreeAgencyFilterState`, which validates all enum-like fields. | None. |
| Cap audit local log storage | `src/features/architect/utils/capLegality/localCapAuditLog.ts` | VALIDATED | JSON parse is wrapped in try/catch and normalized through `normalizeEvents`; corrupt storage returns an empty list. | Consider stronger event-field validation only if audit log becomes cross-session authority. |
| Pick-right wizard drafts | `src/features/architect/admin/pickRightWizardDraft.ts` | LEGACY COMPATIBILITY EXCEPTION | JSON parse is try/caught and shape-checked for v2 envelope or v1 legacy markers before returning typed data. | Future schema could replace the legacy casts, but current guards fail closed to `null`. |
| Vacuum entitlement overlay | `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | LEGACY COMPATIBILITY EXCEPTION | JSON parse is try/caught; version and object markers are checked before using overlay state; corrupt storage returns an empty envelope. | Future schema could narrow nested overlay values. |
| Entitlement advanced JSON editor | `src/features/architect/admin/EntitlementEditorAdvancedTab.tsx` | USER-EDITED JSON EXCEPTION | JSON parse is inside user action handling; parsed JSON is reserialized and routed to `onApplyJson`, and errors remain local UI state. | Boundary is acceptable as a JSON editor surface. |
| Draft positions JSON editor | `src/features/architect/GMDashboard/components/DraftPositionsInput.tsx` | VALIDATED | JSON parse result is validated with `validateDraftPositionsMap` before save; invalid input returns errors and no typed value. | None. |
| Deep-clone JSON round trips | `useArchitectActions.ts`, `useArchitectState.ts`, `seasonManager.ts`, `mutationPipeline.ts`, `resolveOffseasonTransition.ts` | INTERNAL CLONE EXCEPTION | `JSON.parse(JSON.stringify(...))` is used on already-internal state for clone/sanitize behavior, not untrusted ingress. | Prefer `structuredClone` in a future compatibility cleanup if browser/runtime support is sufficient. |
| Architect dev/debug localStorage flags | `TradeEditor.tsx`, `TeamHistoryTab.tsx`, `CapSheetSection.tsx`, `OffseasonSection.tsx`, `CapAuditDebugPanel.tsx` | BOOLEAN FLAG EXCEPTION | Values are compared to fixed string literals like `'true'` or `'1'`; they do not create typed object ingress. | None. |
| Entitlement world writes and Firestore helpers | `entitlementWriter.ts`, `moveWorldEntitlement.ts`, `saveEntitlementFromFormState.ts`, Architect loader families | VALIDATED BY EXISTING OWNERS | These hits are parameter-name/JSDoc matches from already-typed write parameter objects. No `doc.data() as X` hit remains in the command output. | Gate 5 still needs test/mock integrity review around these surfaces. |
| JSDoc/function `params` matches | Many Architect utility files | FALSE POSITIVE | The scan pattern intentionally matches `params`; these are not runtime boundary reads. | None. |

## Gate 6 JS/CJS/MJS Classification

Command after cleanup:

```bash
rg --files -g '*.js' -g '*.jsx' -g '*.cjs' -g '*.mjs' -g '!node_modules/**' -g '!dist/**' -g '!archive/**'
```

Result: 38 files after deleting three tracked zero-byte Vitest timestamp files.

Deleted generated/temp files:

- `vitest.config.js.timestamp-1771853757615-9eb2e002e2571.mjs`
- `vitest.config.js.timestamp-1771853822365-208c81ad7fb7a.mjs`
- `vitest.node.config.js.timestamp-1771853831532-d0a3682959268.mjs`

| Classification | Files | Reason |
| --- | --- | --- |
| INTENTIONAL CONFIG | `vite.config.js`, `vitest.config.js`, `vitest.node.config.js`, `vitest.ui.config.js`, `vitest.smoke.config.js`, `vitest.emulator.config.js`, `vitest.rules.config.js`, `postcss.config.js`, `tailwind.config.js`, `.eslintrc.cjs` | Tooling config stays JS/CJS for ecosystem compatibility. |
| INTENTIONAL NODE SCRIPT | `scripts/generateDocs.cjs`, `scripts/run-tests-by-diff.mjs`, `scripts/run-scouting-tests.mjs`, `scripts/analyze-test-performance.mjs`, `scripts/architect-cast-gate.mjs`, `scripts/generate-architect-cast-ledger.mjs`, `scripts/toggleView.cjs`, `scripts/check-old-collections.js`, `scripts/check-emulator-data.js`, `scripts/firebaseConfig.node.js` | Node/CLI utilities outside runtime app code. |
| INTENTIONAL NODE SCRIPT | `scripts/schema-tools/probe_players_schema.js`, `scripts/firebase-utils/inspect-firestore.js`, `scripts/firebase-utils/export-sanitized-snapshot.js`, `scripts/firebase-utils/pull-firestore.js`, `scripts/firebase-utils/scan-architect-usage.js` | Firestore/schema inspection and data tooling scripts, not bundled runtime. |
| INTENTIONAL NODE SCRIPT | `scripts/ci/run_architect_smoke_e1.mjs`, `scripts/ci/run_architect_ship_gates.mjs`, `scripts/ci/run_rules_integration_tests.mjs`, `scripts/ci/run_phaseD3_true_e2e_gate.js`, `scripts/ci/run_phase80_cap_sheet_e2e_proof.js`, `scripts/ci/run_phaseD2_true_e2e_trade_to_advance_gate.js`, `scripts/ci/run_phase69_tpe_migration_proof.js` | CI wrappers intentionally remain executable Node scripts. |
| INTENTIONAL NODE SCRIPT | `scripts/seed/phase69_run_tpe_migration_proof.js`, `scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js`, `scripts/migrations/phase66_migrate_tradeExceptions.js`, `scripts/migrations/phase2y_backfill_optionsByYear.js` | Seed/migration scripts are operational Node utilities, not runtime app code. |
| INTENTIONAL NODE SCRIPT | `tests/validate-fanspo-fix.cjs`, `cursor_work/add-player-ids/merge_ids.js` | Manual validation/one-off workspace utilities; they are outside runtime app code and do not block TypeScript app hardening. |

## Gate 7 Schema Escape Classification

Command:

```bash
rg -n "z\.any\(|z\.unknown\(|passthrough\(|catchall\(" src -g '*.ts' -g '*.tsx'
```

Result: 36 hits, all classified.

| Files / lines | Classification | Reason safe | Follow-up |
| --- | --- | --- | --- |
| `src/firebase/rankerHelpers.ts:32-67`, `src/firebase/listHelpers.ts:37-91`, `src/firebase/rosterHelpers.ts:24-39` | FIRESTORE TIMESTAMP / DOCUMENT PASSTHROUGH | Helpers validate required timestamp/document fields and preserve Firebase metadata needed for round-trip compatibility. | None unless these helper schemas become public API contracts. |
| `src/schemas/players_v2.ts:91-313` | LEGACY PLAYER SOURCE SCHEMA | `players_v2` contains hierarchical legacy player records with extra source fields; passthrough and `z.any` are localized to the canonical schema. | Narrow the `z.any` fields when source-data shape is fully frozen. |
| `src/schemas/architect.ts:63-260` | ARCHITECT LEGACY / FIRESTORE COMPATIBILITY SCHEMA | Architect world/team/entitlement schemas preserve known fields while allowing legacy and admin metadata to round trip. | Gate 4 runtime boundary review should keep validating known fields before typed use. |
| `src/tests/architect/mutationPipeline.catchallNarrowing.test.ts:144` | FALSE POSITIVE TEST COMMENT | Comment references `.passthrough()` but is not runtime schema code. | None. |
