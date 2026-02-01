/\*\*

- FILE: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
- PURPOSE: Canonical reference for Cap Sheet mutation and validation architecture.
- OWNERSHIP: Feature: architect/cap-sheet validation
-
- HISTORY:
- - 2026-01-16: Created (initial master doc)
- - 2026-01-17: Added Phase 4 signing terms/raises wiring details (plan `plans/_archive/cap-sheet-contract-rules-phase-4-signing-terms-2026-01-17/plan.md`, chunk_n/a)
- - 2026-01-18: Phase 7.3 option invariants + canonical multiplier owner (plan `plans/cap-sheet-contract-rules-phase-7-3/plan.md`, chunk_n/a)
- - 2026-01-22: Phase 26 S&T Audit - fixed build errors, audited workflow, extended tests 2→20
- - 2026-01-21: Phase 27 Manual Exception Management - added setExceptions mutation, validateExceptions, ManageExceptionsModal
- - 2026-01-21: Phase 29 LeagueView SSOT Fix - replaced inline salary computation with `computeTeamCapTotals()`, added 8 regression tests
- - 2026-01-23: Phase 31 Max Salary Enforcement - added `max_salary_violation` hard block to prevent contracts exceeding YOS-based max (25%/30%/35% of cap), 16 new tests
- - 2026-01-23: Phase 32 S&T Incoming Aggregation - added Rule 1.6 to block receiving team from aggregating other players with S&T player, 9 new tests (P0-2 closure)
- - 2026-01-23: Phase 33 Hard Cap Test Drift Fix - test assertion moved to `rules.hardCap.violations` to avoid violation order dependency
- - 2026-01-23: Phase 34 Second Apron Threshold Boundary Bug (PREFLIGHT) - identified `>=` vs `>` comparator bug in 8 files; CBA Art VII Sec 2(f) specifies `>` for second apron team classification; execution pending
- - 2026-01-23: Phase 34 Second Apron Threshold Boundary Bug (EXECUTION) - fixed `>=` → `>` comparator in 7 files for second apron classification; added 5 boundary tests; teams at threshold no longer incorrectly treated as second apron
- - 2026-01-27: Phase 38 Architect Second Apron Semantics Unification (EXECUTION) - unified legacy `capUtils.js` and `tradeHelpers.js` to strictly use `>` for second apron classification, aligning with Trade Machine SSOT; fixed `capLegalityValidation.js` hard cap check to allow landing exactly on apron; added guardrail tests.
- - 2026-01-27: Phase 39 Second Apron Drift Scan (PREFLIGHT) - Confirmed partial drift in `capLegalityValidation.js` (uses `>=` for exception blocking) and `tradeHelpers.js`. Strict semantics (`>`) confirmed for hard cap status. Return package at `docs/architect/return_packages/PHASE_39_SECOND_APRON_DRIFT_SCAN_PREFLIGHT_RETURN_PACKAGE.md`.
- - 2026-01-27: Phase 39 Second Apron Drift Fix (EXECUTION) - Eliminated `>=` drift in `capLegalityValidation.js` (exception blocking) and `tradeHelpers.js`. Added strict boundary guardrail tests (`phase39_drift_guardrails.test.js`).
- - 2026-01-27: Phase 40 Second Apron Drift Scan (Architect-wide) (PREFLIGHT) - Preflight completed. Identified 3 logic drift locations and 1 interface drift. Return package: `docs/architect/return_packages/PHASE_40_SECOND_APRON_DRIFT_SCAN_PREFLIGHT_RETURN_PACKAGE.md`.
- - 2026-01-27: Phase 40 Second Apron Drift Fix (Architect-wide) (EXECUTION) - Eliminated remaining `>=` drift in `buildRuleContext.ts`, `capLegalityValidation.js` (Rule 1.8), and `faExceptionUtils.js`. Renamed `teamIsAtOrAboveSecondApron` to `teamIsSecondApron` in `draftPickUtils.js`. Added 9 strict boundary guardrail tests (`phase40_secondApron_drift_guardrails.test.js`).
- - 2026-01-28: Phase 41A Draft Pick Utils Back-Compat Removal Readiness (PREFLIGHT) - Confirmed safety of removing `teamIsAtOrAboveSecondApron` fallback in `draftPickUtils.js`. Only 1 production caller (`validateStepien.ts`) exists and uses the new key. Return package: `docs/architect/return_packages/PHASE_41A_DRAFT_PICK_BACKCOMPAT_PREFLIGHT_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 41B Draft Pick Utils Back-Compat Removal (EXECUTION) - Removed `teamIsAtOrAboveSecondApron` parameter support from `draftPickUtils.js`. Legacy key is now ignored. Updated `phase40_secondApron_drift_guardrails.test.js` to verify strictness.
- - 2026-01-28: Phase 42 Apron Derivation Consolidation (EXECUTION) - Consolidated apron derivation in `tradeHelpers.getApronStatus`, `usePlayerRulesProfiles.deriveApronStatus`, `buildRuleContext.deriveApronLevel`, and `faExceptionUtils.canUseFaException` to delegate to tradeMachine SSOT; fixed first apron boundary drift in `usePlayerRulesProfiles` (`>` → `>=`); added 19 guardrail tests; deferred `useCapValidation` (warning-only, low risk). Return package: `docs/architect/return_packages/PHASE_42_APRON_DERIVATION_CONSOLIDATION_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 43 Apron Drift Prevention Guardrails (EXECUTION) - Added ESLint rule blocking direct imports from `tradeMachine/utils/capUtils.js` outside tradeMachine folder; fixed `buildRuleContext.ts` and `tradeHelpers.js` to use canonical import path `@/features/architect/utils/capUtils`; updated deprecated `getAllowableIncomingMargin` to delegate to `isSecondApronTeam`; confirmed S&T eligibility check uses correct `>` semantics; added 5 guardrail tests. Return package: `docs/architect/return_packages/PHASE_43_APRON_DRIFT_PREVENTION_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 44 Architect Status Snapshot (PREFLIGHT) - Produced current state map confirming Phases 35-43 complete; no blocking work remains; identified low-priority polish items (TPE usage pipeline, roster charge UI, doc cleanup). Return package: `docs/architect/return_packages/PHASE_44_ARCHITECT_STATUS_SNAPSHOT_PREFLIGHT_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 46 TPE Usage Pipeline Status & Gaps (PREFLIGHT) - Mapped TPE lifecycle (create → store → show → validate → consume → expire); identified critical gaps: no persistence for TPE creation (G-TPE-2) or consumption (G-TPE-1); expiration works via seasonManager; validation works for trades. Return package: `docs/architect/return_packages/PHASE_46_TPE_USAGE_PIPELINE_PREFLIGHT_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 47 TPE Persistence (EXECUTION) - Closed G-TPE-1 and G-TPE-2 gaps; added TPE creation and consumption persistence to `computeTradeResult()` in `mutationPipeline.js`; created TPEs now added to `team.tradeExceptions[]`; consumed TPEs have `remainingAmount` decremented and `isUsed` set; 14 guardrail tests added. Return package: `docs/architect/return_packages/PHASE_47_TPE_PERSISTENCE_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 47B TPE Persistence SSOT Alignment (EXECUTION) - Eliminated drift vectors in Phase 47: removed hardcoded `SALARY_CAP = 141_000_000` constant (now uses `capSettings.salaryCap` from provider); TPE creation now persists validator output (`teamResult.createdTPE`) instead of recomputing; TPE consumption uses validated `matchIncoming` values; fixed pre-existing dead cap function scope bug; 207/209 architect tests passing. Return package: `docs/architect/return_packages/PHASE_47B_TPE_PERSISTENCE_SSOT_ALIGNMENT_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 47C TPE Persistence Hardening (EXECUTION) - Hardened Phase 47B: removed salary fallback for TPE consumption (uses `matchIncoming` only with explicit warnings); added dedupe logic merging `tradeExceptions` + `exceptions.tpe` sources; implemented idempotent creation with signature-based duplicate detection; preserved validator-provided TPE ids; 16 new guardrail tests; 223/225 architect tests passing (2 pre-existing failures unchanged). Return package: `docs/architect/return_packages/PHASE_47C_TPE_PERSISTENCE_HARDENING_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 48 Sign-and-Trade Validation Order Fix (EXECUTION) - Fixed S&T validation order: added `validateSigning()` call in `computeSignAndTradeResult()` before `computeTradeResult()` is invoked, ensuring signing validation failure short-circuits before trade validator runs; fixed 2 failing SAT14 tests; 225/225 architect tests now passing. Return package: `docs/architect/return_packages/PHASE_48_SIGN_AND_TRADE_VALIDATION_ORDER_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-29: Phase 49 TPE Exception History Logging (EXECUTION) - Added `exceptionHistory[]` persistence to Architect trade results with deterministic `historyKey` dedupe. `computeTradeResult()` now generates durable `TPE_CREATED` + `TPE_CONSUMED` entries (world-aware, timestamped) via `historyHelpers.js`, and `appendExceptionHistory()` prevents retries from duplicating records. Added Phase 49 guardrail tests covering creation, consumption (partial/full), idempotency, and no-op scenarios. Return package: `docs/architect/return_packages/PHASE_49_TPE_EXCEPTION_HISTORY_LOGGING_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-29: Phase 50 ExecuteTrade Integration Persistence Tests (EXECUTION) - Added integration-level tests for `executeTrade` mutation pipeline verifying TPE creation/consumption persistence and `exceptionHistory[]` durability. Fixed bug in `mutationPipeline.js` line 1189 where TPE consumption was blocked when `tradeExceptionsResult.details` was empty string (falsy). Tests verify: (1) over-cap trades create TPEs with `TPE_CREATED` history entries, (2) TPE consumption updates `remainingAmount`/`usedAmount` with `TPE_CONSUMED` history entries (partial and full), (3) idempotent behavior on retry (no duplicate TPEs or history entries). 5 integration tests, 235 architect tests passing. Return package: `docs/architect/return_packages/PHASE_50_EXECUTETRADE_INTEGRATION_PERSISTENCE_TESTS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-29: Phase 51 Season Advance TPE Expiry Integration (EXECUTION) - Added integration-level tests for season advance TPE expiry flow verifying: (1) expired TPEs removed when `expiresOn < boundary` (July 1 of toSeason start year), (2) active TPEs kept when `expiresOn >= boundary`, (3) boundary condition: TPE at exact boundary (e.g., 2026-07-01T00:00:00.000Z for 2026-27 season) is ACTIVE (kept), (4) dual-source "no ghost" dedupe merging `tradeExceptions[]` + `exceptions.tpe[]` with id-based preference for canonical fields, (5) idempotency: running twice produces identical results. 18 integration tests, 253 architect tests passing. Return package: `docs/architect/return_packages/PHASE_51_SEASON_ADVANCE_TPE_EXPIRY_INTEGRATION_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-29: Phase 52 Roster Spot Charges UI Wiring (EXECUTION) - Verified G2-3 gap already resolved in Phase 25. (1) `incompleteChargesTotal` computed in SSOT (`computeTeamCapTotals.js` L216). (2) UI display implemented in `CapSheet.jsx` L431-451 with conditional "Incomplete Roster Charge" row, slot count annotation, and proper formatting. (3) 7 UI tests in `rosterChargeDisplay.test.jsx` (RC1-RC6) all passing. (4) Updated Master Doc §3.2 and §7.3 to mark G2-3 as RESOLVED. Return package: `docs/architect/return_packages/PHASE_52_ROSTER_SPOT_CHARGES_UI_WIRING_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-29: Phase 53 TPE Expiry Exception History Logging (EXECUTION) - Closed "TPEs disappear with no audit trail" gap during season advance. (1) Added `TPE_EXPIRED` entry type to `historyHelpers.js` with `createTpeExpiryHistoryEntry()` and `buildExpiryHistoryKey()` helpers. (2) Season advance now emits durable `TPE_EXPIRED` entries to `team.exceptionHistory[]` for each expired TPE via `processTeamSeasonTransitionWithOptions()`. (3) Entries are idempotent and deduped by deterministic `historyKey` (format: `seasonAdvance:{worldId}:{teamCode}:{tpeId}:expired:{signature}`). (4) Boundary semantics unchanged: `expiresOn == boundary` stays ACTIVE (no expiry history). (5) Dual-source merge produces no ghost expiry logs. (6) 17 new guardrail tests in `phase53_seasonAdvance_tpe_expiry_history_integration.test.js`. 270 architect tests passing. Return package: `docs/architect/return_packages/PHASE_53_TPE_EXPIRY_EXCEPTION_HISTORY_LOGGING_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 55 Trade Validation Separation (EXECUTION) - Eliminated duplicate `validateTrade()` calls in trade mutation paths. (1) Added `validateTradeForContext()` export for building validated trade contexts. (2) `computeTradeResult()` now attaches `_validatedTradeContext` to its result with `_isValidatedTradeContext: true` flag. (3) `validateMutation()` for `executeTrade` and `signAndTrade` now checks for pre-validated context and reuses it instead of re-calling `validateTradeForPipeline()`. (4) Trade validation runs exactly once per mutation (inside `computeTradeResult()` after roster updates, required for correct TPE absorption context). (5) Phase 48 invariant preserved: signing validation runs before trade validation in S&T path. (6) 5 new guardrail tests in `phase55_trade_validation_separation_guardrails.test.js`. 275 architect tests passing. Return package: `docs/architect/return_packages/PHASE_55_TRADE_VALIDATION_SEPARATION_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 56 Pure computeTradeResult + Post-Trade Snapshot Validation (EXECUTION) - Made `computeTradeResult()` a **pure function** (no internal `validateTrade()` calls). (1) Added `buildPostTradeTeamsSnapshot()` pure helper that applies roster moves without calling validators. (2) Added `validatePostTradeSnapshotForContext()` that validates the post-trade snapshot exactly once and returns `validatedContext`. (3) Refactored `computeTradeResult()` to require `postTradeSnapshot` and `validatedContext` parameters - throws if missing. (4) Updated `computeWorldMutation` executeTrade case to: build snapshot → validate snapshot → compute with context. (5) Updated `computeSignAndTradeResult()` to: validate signing → build post-trade snapshot → validate trade → compute with context. (6) Trade validation sees POST-TRADE roster state (required for correct TPE absorption). (7) Legacy `validateTradeForContext()` retained as convenience wrapper. (8) 7 new guardrail tests in `phase56_pure_computeTradeResult_guardrails.test.js`. 282 architect tests passing. Return package: `docs/architect/return_packages/PHASE_56_POST_TRADE_SNAPSHOT_VALIDATION_PURE_COMPUTE_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 57 Trade Validation Separation Cleanup + Anti-Regression Guardrails (EXECUTION) - Finalized Phase 56 by: (1) Removing Phase 55-era fallback paths in `validateMutation()` - `executeTrade` and `signAndTrade` now throw hard errors if pre-validated context is missing instead of falling back to `validateTradeForPipeline()`. (2) Marked `validateTradeForContext()` as legacy convenience wrapper with clear docstring warning not to use for mutation gating. (3) Added anti-regression test (`phase57_forbid_validateTrade_in_compute_guardrail.test.js`) that reads source files and enforces `validateTrade(` does not appear in compute/persist regions - 7 guardrail tests. (4) Trade pipeline is now cleanly `snapshot → validate → compute/persist` with no fallback paths. Return package: `docs/architect/return_packages/PHASE_57_TRADE_VALIDATION_CLEANUP_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 58 Trade Context Extraction + Shape Hardening (EXECUTION) - Extracted Phase 56/57 trade snapshot/context helpers to dedicated module for maintainability. (1) Created `src/features/architect/utils/tradeContext/` module with: `tradeContext.js` (snapshot + validation context builders), `assertions.js` (runtime shape assertions), `types.js` (canonical JSDoc typedefs), `index.js` (public API). (2) Defined canonical shapes: `PostTradeSnapshot` (sentinel: `_isPostTradeSnapshot`), `ValidatedTradeContext` (sentinel: `_isValidatedTradeContext`). (3) Added runtime assertions: `assertPostTradeSnapshot()`, `assertValidatedTradeContext()`, `assertTradeComputeInputs()` - used in `computeTradeResult()`. (4) Updated Phase 57 guardrail tests to cover new module paths with allowlist enforcement. (5) Marked `validateTradeForPipeline()` as `@deprecated`. (6) `mutationPipeline.js` re-exports for backward compatibility. Return package: `docs/architect/return_packages/PHASE_58_TRADE_CONTEXT_EXTRACTION_SHAPE_HARDENING_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 59 Legacy Trade Validation Retirement + Anti-Regression Guardrails (EXECUTION) - Removed/quarantined legacy trade validation helpers to prevent regression to pre-Phase 56 architecture. (1) Deleted `validateTradeForPipeline()` function from `mutationPipeline.js` (dead code, no callers). (2) Created `tradeContext/legacy/` namespace with loud naming (`legacy_validateTradeForContext`). (3) Moved `validateTradeForContext` from main exports to legacy namespace (re-exported from `tradeContext/index.js` for backward compat). (4) Removed `validateTradeForContext` re-export from `mutationPipeline.js`. (5) Added 13 guardrail tests in `phase59_legacy_import_guardrail.test.js` enforcing: mutation modules cannot import from legacy namespace, `validateTradeForPipeline` is removed, legacy namespace has loud warnings. (6) Updated Phase 57 guardrail tests to reflect Phase 59 changes. (7) Documented `calculateTeamTotals` duplication as intentional (avoid circular deps). 313 architect tests passing. Return package: `docs/architect/return_packages/PHASE_59_LEGACY_TRADE_VALIDATION_RETIREMENT_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 60 Mutation Persistence Sanitization + No-Leak Guardrails (EXECUTION) - Ensured transient compute/validation artifacts never persist to Firestore. (1) Added `FORBIDDEN_TRANSIENT_KEYS` constant and `sanitizeTransientFieldsForPersistence()` function to `mutationPipeline.js`. (2) Forbidden keys: `_validatedTradeContext`, `_signingValidation`, `_isPostTradeSnapshot`, `_isValidatedTradeContext`, `_rawValidation`. (3) `_meta` explicitly preserved (used by UI for computed totals display). (4) Applied sanitization in `persistWorldMutation()` for team, player, and event writes before `removeUndefinedDeep()`. (5) Added 17 guardrail tests in `phase60_mutation_persist_no_internal_leaks_guardrail.test.js`: unit tests for sanitizer, deep-scan tests for forbidden key detection, source-scan tests verifying sanitizer usage at persistence boundary. 330 architect tests passing. Return package: `docs/architect/return_packages/PHASE_60_MUTATION_PERSIST_SANITIZATION_NO_LEAK_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 61 Persistence Contract Allowlist Guardrails (EXECUTION) - Prevented schema drift at mutation persistence boundary via allowlist-based contracts. (1) Created `src/features/architect/utils/persistenceContracts/` module with: `contracts.js` (frozen allowlists for team/player/event docs + nested arrays), `validatePersistableShape.js` (path-reporting validator), `enforcement.js` (test-on/prod-off gating), `index.js` (public API). (2) Allowlists: `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST`, `PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST`, `EVENT_TOP_LEVEL_ALLOWLIST`, `EVENT_METADATA_TOP_LEVEL_ALLOWLIST`, plus deep rules for `tradeExceptions[]` and `exceptionHistory[]` items. (3) Wired `assertPersistableOrThrow()` in `persistWorldMutation()` for team, player, event, and event.metadata writes. (4) Enforcement order: sanitize → validate contract → removeUndefined. (5) Enforcement enabled by default in test env (`NODE_ENV=test`), disabled in production. (6) 34 guardrail tests in `phase61_persistence_contract_allowlist_guardrails.test.js`. Return package: `docs/architect/return_packages/PHASE_61_PERSISTENCE_CONTRACT_ALLOWLIST_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 62 Persistence Contract Deep-Rules + Fixture-Based Drift Guardrails (EXECUTION) - Hardened Phase 61 contracts with deep rules for drift-prone nested structures. (1) Added `DEAD_CAP_ITEM_ALLOWLIST` for `team.deadCap[]` items. (2) Added `DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST` for 3-level nested `team.deadCap[].amountByYear[]` items. (3) Added `CAP_HOLD_ITEM_ALLOWLIST` for `team.capHolds[]` items. (4) Extended `validatePersistableShape.js` to support 3-level nesting via propagated deep rules. (5) Updated `TEAM_DEEP_RULES` with 3 new entries: `deadCap`, `deadCap.amountByYear`, `capHolds`. (6) Created fixture-based drift guardrails with keyset snapshot tests that detect new/removed fields. (7) 33 new guardrail tests in `phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js`. Return package: `docs/architect/return_packages/PHASE_62_PERSISTENCE_CONTRACT_DEEP_RULES_FIXTURES_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 63 Sign-and-Trade Test Restoration + Anti-Regression Guardrails (EXECUTION) - Fixed 6 failing S&T tests caused by incomplete Phase 61 persistence contract allowlists. Root cause: Category C (state assembly regression) - allowlists missed legitimately persisted fields `players`, `tradeExceptions`, `sourceTeam`, `destinationTeam`, `contract`. (1) Added `players` and `tradeExceptions` to `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST`. (2) Added `tradeExceptions` deep rule (same allowlist as `exceptions.tpe`). (3) Added `sourceTeam`, `destinationTeam`, `contract` to `EVENT_METADATA_TOP_LEVEL_ALLOWLIST`. (4) 13 new guardrail tests in `phase63_signAndTrade_restoration_guardrails.test.js` covering: allowlist completeness, validation order (Phase 48 invariant), signing failure short-circuit, Phase 56 architecture pattern. (5) All 410 architect tests passing. Return package: `docs/architect/return_packages/PHASE_63_SIGN_AND_TRADE_TEST_RESTORATION_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 64 TPE Schema Canonicalization + No-Legacy-Persist Guardrails (EXECUTION) - Removed dual-schema ambiguity for Trade Player Exceptions by making `team.exceptions.tpe[]` the only canonical persisted location. (1) Created `normalizeTeamTpeSchema()` helper that merges legacy `tradeExceptions[]` into canonical `exceptions.tpe[]` and removes the legacy field. (2) Created `getTeamTpeList()` read helper for backward-compatible reads from old worlds. (3) Added normalization step in `persistWorldMutation()` between sanitization and contract validation: sanitize → normalize TPE → validate contract → removeUndefined → write. (4) Removed `tradeExceptions` from `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST` and `TEAM_DEEP_RULES`. (5) Updated Phase 63 tests to reflect Phase 64 changes. (6) 26 new guardrail tests in `phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js` covering: normalization behavior, deduplication, read helper fallback, source-scan enforcement, contract validation. (7) All 436 architect tests passing. Return package: `docs/architect/return_packages/PHASE_64_TPE_CANONICALIZATION_NO_LEGACY_PERSIST_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-30: Phase 65 TPE Read-Path Canonicalization + No-Direct-tradeExceptions Guardrails (EXECUTION) - Made `team.tradeExceptions` read-only legacy compatibility and eliminated direct reads across production code. (1) Refactored 11 production files to use `getTeamTpeList(team)` instead of direct `.tradeExceptions` access: `TradeTeamCard.jsx`, `TradeExceptionDashboard.jsx`, `ValidationDetailsPanel.jsx`, `useTradeMachine.js`, `tradeExceptions.js`, `basicRules.js`, `validateSalaryMatching.js`, `runOffseason.js`, `SeasonAdvanceModal.jsx`, `seasonManager.js`. (2) Identified and hardened 2 team persistence boundaries outside `mutationPipeline`: `seasonManager.js` L119 and L598 now call `normalizeTeamTpeSchema()` before `batch.set()`. (3) Added 18 guardrail tests in `phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` with source-scan enforcement and tight 9-file allowlist. (4) All 454 architect tests passing. Return package: `docs/architect/return_packages/PHASE_65_TPE_READ_PATH_CANONICALIZATION_FORBID_DIRECT_TRADEEXCEPTIONS_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-31: Phase 66 Legacy tradeExceptions Migration + Type Removal + Telemetry (EXECUTION) - Completed TPE canonicalization by creating migration tooling and adding telemetry for legacy fallback detection. (1) Created `scripts/migrations/phase66_migrate_tradeExceptions.js` migration script to scan `architect_worlds/{worldId}/teams/{teamCode}` docs, call `normalizeTeamTpeSchema()` to merge legacy → canonical, remove `tradeExceptions`, and write back. Script supports `DRY_RUN=true` mode, single worldId targeting, and produces JSON + markdown reports. (2) Added legacy fallback telemetry to `getTeamTpeList()` in `normalizeTeamTpe.js`: dev-only `console.warn` and in-memory counter when falling back to `team.tradeExceptions`, gated via `LOG_LEGACY_TPE_FALLBACK` env var (defaults true in dev, false in prod). Telemetry intended for removal in Phase 67/68. (3) Updated `normalizeTradeInput.js` to use `getTeamTpeList(raw)` canonical accessor instead of direct `raw.tradeExceptions` read. (4) Updated `NormalizedTeam` interface in `types.ts` with deprecation comment clarifying it's internal compute only, not persisted shape. (5) Verified Zod schema in `architect.ts` already correct (no `tradeExceptions` field). (6) 17 new guardrail tests in `phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js` covering: Zod schema exclusion, normalization behavior, telemetry firing, persistence contract exclusion, migration script existence. (7) All 471 architect tests passing. Return package: `docs/architect/return_packages/PHASE_66_LEGACY_TRADEEXCEPTIONS_MIGRATION_TYPE_REMOVAL_TELEMETRY_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-02-01: Phase 67 Migration Execution + Telemetry Wind-Down (EXECUTION) - Executed TPE migration and produced zero-legacy proof. (1) Hardened migration script CLI with new flags: `--dry-run`, `--write`, `--verify-only`, `--output-dir`. Script now uses ESM imports instead of CommonJS. (2) Added `--verify-only` mode that scans for legacy occurrences and exits with code 1 if any found, code 0 if clean. (3) Deterministic report filenames: `phase67_<mode>_<date>.{json,md}`. (4) Ran migration against Firebase emulator in dry-run mode - 0 worlds with legacy data found. (5) Telemetry wind-down: `getTeamTpeList()` now quiet-by-default. Only logs when `LOG_LEGACY_TPE_FALLBACK=true` env var is explicitly set. Counter still increments silently for programmatic access via `getLegacyTpeFallbackCount()`. (6) 18 new guardrail tests in `phase67_migration_execution_guardrails.test.js` covering: CLI options, verify-only exit codes, deterministic filenames, telemetry quiet-by-default, documentation headers. (7) All 176 Phase 60-67 tests passing (35 from Phase 66+67). Build passes. Return package: `docs/architect/return_packages/PHASE_67_MIGRATION_EXECUTION_TELEMETRY_WIND_DOWN_RETURN_PACKAGE.md`.
- - 2026-02-01: Phase 68 Verify-Only Empty-Scan Fail-Safe + CI Hook (EXECUTION) - Made verify-only mode CI-trustworthy by failing on empty scans. (1) Added empty-scan fail logic: if `worldsScanned === 0` OR `teamDocsScanned === 0`, verify-only now exits with code 1 and prints `[VERIFY FAILED] Empty scan (0 worlds or 0 team docs)`. (2) Added `--allow-empty` escape hatch CLI flag that bypasses empty-scan fail with loud warning (not recommended for CI). (3) Added explicit environment targeting output at script start: prints projectId, emulator host status, and Firestore instance type (EMULATOR vs PRODUCTION). (4) Fixed ESM compatibility: replaced `require()` with `JSON.parse(fs.readFileSync())` for service account loading. (5) Verified empty-scan fail-safe works: 0 worlds → exit 1. Verified `--allow-empty` escape hatch: 0 worlds + warning → exit 0. (6) 27 new guardrail tests in `phase68_verify_only_empty_scan_must_fail_guardrails.test.js` covering: empty-scan fail logic, `--allow-empty` flag, scan count output, environment targeting, Phase 67 regression checks. (7) All 516 architect tests passing. Build passes. Return package: `docs/architect/return_packages/PHASE_68_VERIFY_ONLY_REAL_DATASET_PROOF_EMPTY_SCAN_FAILSAFE_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-02-01: Phase 69 Seeded Emulator Proof: Non-Empty Verify-Only + End-to-End Legacy Removal (EXECUTION) - Completed non-empty scan proof with deterministic seed harness. (1) Created `scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js` seed script: writes deterministic worldId `phase69_seed_world`, creates 3 team docs (BOS with legacy tradeExceptions, LAL with canonical exceptions.tpe, MIA with both for merge testing), idempotent overwrites, refuses to run against production. (2) Created `scripts/seed/phase69_run_tpe_migration_proof.js` end-to-end proof runner: runs seed → verify-only (expected fail) → write → verify-only (expected pass), validates exit codes and scan counts. (3) Executed proof loop on emulator: first verify-only FAILED with worldsScanned=1, teamDocsScanned=3, docsWithLegacy=2, exit code 1; write migration completed with docsMigrated=2; second verify-only PASSED with worldsScanned=1, teamDocsScanned=3, docsWithLegacy=0, exit code 0. (4) 28 new guardrail tests in `phase69_seeded_verify_only_nonempty_proof_guardrails.test.js` covering: seed script structure, deterministic IDs, legacy field presence, proof runner execution order, Phase 68 regression checks. (5) All 544 architect tests passing. Build passes. Return package: `docs/architect/return_packages/PHASE_69_SEEDED_VERIFY_ONLY_NONEMPTY_PROOF_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-02-01: Phase 70 CI Proof Job + Production Verify-Only Safety Rails (EXECUTION) - Made Phase 69 proof harness runnable in CI and added production-safe verify-only workflow. (1) Created `scripts/ci/run_phase69_tpe_migration_proof.js` CI entrypoint: wraps Phase 69 proof runner, validates exit codes (first verify-only=1, second verify-only=0), confirms nonzero scan counts in output, refuses to run without `FIRESTORE_EMULATOR_HOST`. (2) Added `ci:phase69-proof` npm script for CI pipelines. (3) Added production write safety latch in `phase66_migrate_tradeExceptions.js`: `--write` is REFUSED against production Firestore unless `FIRESTORE_EMULATOR_HOST` is set OR `ALLOW_PROD_MIGRATION_WRITE=true` is in environment. Does not affect `--verify-only` mode. (4) Updated help text documenting `ALLOW_PROD_MIGRATION_WRITE` environment variable. (5) 27 new guardrail tests in `phase70_ci_proof_and_prod_write_safety_guardrails.test.js` covering: CI entrypoint existence, npm script presence, production write latch, verify-only path unaffected, Phase 68 empty-scan regression, Phase 69 proof runner regression. (6) All architect tests passing. Build passes. Return package: `docs/architect/return_packages/PHASE_70_CI_PROOF_AND_PROD_WRITE_SAFETY_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-02-01: Phase 71 Cap Sheet MVP Gap Audit (PREFLIGHT) - Comprehensive audit of Cap Sheet MVP readiness. (1) SSOT confirmed: `computeTeamCapTotals()` is canonical totals function at `src/features/architect/utils/capTotals/computeTeamCapTotals.js`. (2) Identified 3 competing legacy functions: `calculateTeamTotals()` in mutationPipeline.js and tradeContext.js (missing incompleteChargesTotal), `updateTeamCapTotals()` in tradeManager.js (simplified). (3) Mapped 6 UI surfaces - all use SSOT except `CapImpactTiles` which lacks memoization. (4) Mapped 13 mutation entrypoints - all trigger refresh and persist. (5) Exceptions MVP requirements MET (tracking, validation, hard cap sources); gaps in Room Exception, BAE cooldown. (6) Top 5 staleness risks identified with evidence. (7) Proposed 4 execution chunks: SSOT Unification, Tile Reactivity Hardening, Exceptions MVP Completion, Persistence/Workflow Polish. (8) No stop conditions triggered. Return package: `docs/architect/return_packages/PHASE_71_CAP_SHEET_MVP_GAP_AUDIT_PREFLIGHT_RETURN_PACKAGE.md`.
-
- LINKS:
- - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
- - Trade Context Module: src/features/architect/utils/tradeContext/
- - Latest Chunk: n/a (no chunks used)
    \*/

# Cap Sheet Mutations & Validation Master Doc

**Created:** 2026-01-16  
**Purpose:** Canonical reference for Cap Sheet mutation and validation architecture  
**Scope:** Cap Sheet / Cap Table only (excludes Trade Machine implementation details)

---

## 1. Purpose & Scope

This document maps the complete Cap Sheet mutation and validation architecture to ensure:

1. All mutations flow through doctrine-compliant pipelines
2. CBA enforcement is applied consistently
3. Gaps between current implementation and required behavior are tracked

### Data Doctrine Alignment

```
BASE (Read-Only) → WORLDS (Writable Overlay) → COMPUTED (Ephemeral)
```

- **Base:** Firestore `teams/`, `players/` collections (real-world contracts, salaries)
- **Worlds:** `architect_worlds/{worldId}/teams/` overlay (user modifications)
- **Computed:** Runtime totals via `computeTeamCapTotals()` and validation results

> **Critical Violation:** Any direct write to base collections is a doctrine violation.

---

## 2. Mutation Architecture

### 2.1 Entry Points (Two Tiers)

| Tier         | Entry Point                                     | Persistence        | Use Case             |
| ------------ | ----------------------------------------------- | ------------------ | -------------------- |
| **Pipeline** | `applyWorldMutation()` in `mutationPipeline.js` | Firestore worlds   | Production mutations |
| **Local**    | `useCapSheetState.js`                           | Session state only | UI experimentation   |

### 2.2 Canonical Mutation Pipeline

**File:** `src/features/architect/utils/mutationPipeline.js`

The pipeline enforces a 5-phase flow:

```
READ → COMPUTE (PURE) → VALIDATE → PERSIST → POST-UPDATE
```

#### Supported Mutation Types

| MutationType        | Compute Function                   | Validation Function              |
| ------------------- | ---------------------------------- | -------------------------------- |
| `executeTrade`      | `computeTradeResult()`             | `validateTrade()`                |
| `signFreeAgent`     | `computeSigningResult()`           | `validateSigning()`              |
| `waivePlayer`       | `computeWaiveResult()`             | `validateWaive()`                |
| `extendPlayer`      | `computeExtensionResult()`         | `validateExtension()`            |
| `optionDecision`    | `computeOptionResult()`            | `validateOptionDecision()`       |
| `renounceRights`    | `computeRenounceResult()`          | `validateRenounceRights()`       |
| `storeOfferSheet`   | `computeStoreOfferSheetResult()`   | `validateStoreOnlyInvariants()`  |
| `matchOfferSheet`   | `computeMatchOfferSheetResult()`   | `validateOfferSheetResolution()` |
| `declineOfferSheet` | `computeDeclineOfferSheetResult()` | `validateOfferSheetResolution()` |

### 2.3 UI Action Handlers

**File:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

| Handler                  | Calls Pipeline? | Notes                     |
| ------------------------ | --------------- | ------------------------- |
| `handleSignFreeAgent()`  | ✅ Yes          | Uses `applyWorldMutation` |
| `handleWaiveContract()`  | ✅ Yes          | Uses `applyWorldMutation` |
| `handleExtendContract()` | ✅ Yes          | Uses `applyWorldMutation` |
| `handleOptionDecision()` | ✅ Yes          | Uses `applyWorldMutation` |
| `handleRenounceRights()` | ✅ Yes          | Uses `applyWorldMutation` |
| `handleTradeActions()`   | ✅ Yes          | Trade flow uses pipeline  |

### 2.4 Local State Hook (Session Only)

**File:** `src/features/architect/hooks/useCapSheetState.js`

This hook provides session-only experimentation without Firestore persistence:

| Action                | Function           | Persists?    |
| --------------------- | ------------------ | ------------ |
| Option Accept/Decline | `exerciseOption()` | Session only |
| Extend                | `extendContract()` | Session only |
| Sign/Re-sign          | `signPlayer()`     | Session only |
| Waive/Stretch/Buyout  | `waivePlayer()`    | Session only |
| Renounce              | `renounceRights()` | Session only |

---

## 3. Mutations Inventory

### 3.1 Production Mutations (Pipeline)

| Mutation                | UI Surface                       | Handler                   | Data Written                                                                                      | Uses Pipeline? |
| ----------------------- | -------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- | -------------- |
| Sign Free Agent         | EditContractModal → GMDashboard  | `handleSignFreeAgent`     | `teams/{code}.players`, `teams/{code}.roster`, `teams/{code}.capHolds`, `teams/{code}.exceptions` | ✅ Yes         |
| Waive Player            | EditContractModal → GMDashboard  | `handleWaiveContract`     | `teams/{code}.players`, `teams/{code}.deadCap`, `teams/{code}.roster`                             | ✅ Yes         |
| Waive & Stretch         | EditContractModal → GMDashboard  | `handleWaiveContract`     | Same as waive + stretched `deadCap.amountByYear`                                                  | ✅ Yes         |
| Buyout                  | EditContractModal → GMDashboard  | `handleWaiveContract`     | Same as waive with reduced `deadCap.amount`                                                       | ✅ Yes         |
| Extend Contract         | EditContractModal → GMDashboard  | `handleExtendContract`    | `players/{id}.contract.salariesByYear`, `players/{id}.futureContract`                             | ✅ Yes         |
| Option Decision         | EditContractModal → GMDashboard  | `handleOptionDecision`    | `players/{id}.contract.salariesByYear[n].optionUsed`, `teams/{code}.capHolds`                     | ✅ Yes         |
| Renounce Rights         | EditContractModal → GMDashboard  | `handleRenounceRights`    | `teams/{code}.capHolds` (removal), `players/{id}.contract.birdRights`                             | ✅ Yes         |
| Store Offer Sheet       | EditContractModal → GMDashboard  | `handleStoreOfferSheet`   | `teams/{offering}.offerSheets`, `teams/{home}.incomingOfferSheets`                                | ✅ Yes         |
| Match Offer Sheet       | OfferSheetList                   | `handleMatchOfferSheet`   | `offerSheets[].status`, `incomingOfferSheets[].status`                                            | ✅ Yes         |
| Decline Offer Sheet     | OfferSheetList                   | `handleDeclineOfferSheet` | `offerSheets[].status`, `incomingOfferSheets[].status`                                            | ✅ Yes         |
| Execute Trade           | TradeMachine → TradeEditor       | Via `applyWorldMutation`  | Multiple team player arrays, roster, draft picks, exceptions                                      | ✅ Yes         |
| Sign-and-Trade          | EditContractModal → GMDashboard  | `handleSignAndTrade`      | Source: rights lost; Dest: player gained (signed)                                                 | ✅ Yes         |
| Set Dead Cap (Manual)   | ManageDeadMoneyModal → CapSheet  | `handleSetDeadCap`        | `teams/{code}.deadCap` (full replacement)                                                         | ✅ Yes         |
| Set Exceptions (Manual) | ManageExceptionsModal → CapSheet | `handleSetExceptions`     | `teams/{code}.exceptions` (full replacement)                                                      | ✅ Yes         |

### 3.2 Missing / Incomplete Mutations

| Mutation                         | Status                    | Gap Description                                            |
| -------------------------------- | ------------------------- | ---------------------------------------------------------- |
| Exception Create/Expire (Manual) | ✅ Implemented (Phase 27) | Manual exception management now available                  |
| TPE Usage Tracking               | Partial                   | TPEs tracked but no formal usage pipeline                  |
| Roster Spot Charges              | ✅ Implemented (Phase 25) | Incomplete roster charges displayed in Cap Sheet breakdown |

---

## 4. Data Paths & Shapes

### 4.1 World Overlay Structure

**Collection:** `architect_worlds/{worldId}/teams/{teamCode}`

```typescript
{
  players: ArchitectPlayer[],      // Overlay player data
  roster: string[],                // Player IDs on roster
  capHolds: CapHold[],             // Active cap holds
  exceptions: TeamExceptions,      // Exception usage (Phase 27 schema)
  deadCap: DeadCapEntry[],         // Dead money (NEW schema)
  waivedContracts: LegacyWaive[],  // Dead money (LEGACY schema)
  stretchHistory: LegacyStretch[], // Dead money (LEGACY schema)
  source: { type, lastModifiedAt }
}
```

### 4.2 Exceptions Schema (Phase 27)

**Location:** `teams/{code}.exceptions`

```typescript
type TeamExceptions = {
  mle?: ExceptionUsage; // Mid-Level Exception
  tpmle?: ExceptionUsage; // Taxpayer Mid-Level Exception
  bae?: ExceptionUsage; // Bi-Annual Exception
  room?: ExceptionUsage; // Room Exception
  // Note: TPE is NOT managed in Phase 27; explicit future work
};

type ExceptionUsage = {
  enabled: boolean; // if false, treat as "unused/unavailable"
  totalAmount: number; // total exception size for the season (USD)
  usedAmount: number; // used so far (USD)
  seasonKey: string; // e.g. "2025-26"
  notes?: string; // optional user text
};
```

**Schema Rules (P0 Hard Blocks):**

- `team.exceptions` must be an object if present
- For each supported exception key (mle, tpmle, bae, room):
  - `enabled` is boolean
  - `totalAmount` and `usedAmount` are finite numbers ≥ 0
  - `usedAmount <= totalAmount`
  - `seasonKey` is non-empty string
- Unknown keys: hard-block (`exceptions_unknown_key`) to be audit-grade

### 4.3 DeadCap Schema (Canonical)

**Location:** `teams/{code}.deadCap`

```typescript
// NEW SCHEMA (canonical when present)
interface DeadCapEntry {
  playerId: string;
  playerName: string;
  amountByYear: { [yearKey: string]: { amount: number } };
  stretched: boolean;
  buyout: boolean;
  reason?: string;
}

// LEGACY SCHEMA (fallback)
interface LegacyWaivedContract {
  playerId: string;
  playerName: string;
  amountByYear: { [year: string]: number };
  isStretched?: boolean;
}
```

**Precedence Rule:** `deadCap` array takes precedence if non-empty for the requested year; otherwise fallback to `waivedContracts`/`stretchHistory`.

### 4.3 Cap Holds Schema

```typescript
interface CapHold {
  playerId: string;
  playerName: string;
  amount: number;
  season: string; // e.g., "2025-26"
  type: string; // "FA Cap Hold", "Draft Pick Hold", etc.
  active: boolean;
  isSigned: boolean;
  reason?: string;
}
```

---

## 5. Validation Architecture

### 5.1 Validation Entry Points

| Validator File             | Scope               | Used By                              |
| -------------------------- | ------------------- | ------------------------------------ |
| `capLegalityValidation.js` | Non-trade mutations | `mutationPipeline.js`                |
| `tradeValidator.js`        | Trade validation    | `mutationPipeline.js`, Trade Machine |
| `useCapValidation.js`      | Real-time UI hints  | `EditContractModal.jsx`              |

### 5.2 Validation Map

| Rule / Check                                  | Location                                                | Trigger     | Block Type     | Data Inputs                                                                        |
| --------------------------------------------- | ------------------------------------------------------- | ----------- | -------------- | ---------------------------------------------------------------------------------- |
| Roster Size (>15)                             | `capLegalityValidation.js:validateSigning`              | Pre-persist | Hard Block     | `team.players`                                                                     |
| Two-Way Limit (>3)                            | `capLegalityValidation.js:validateSigning`              | Pre-persist | Hard Block     | `team.players`                                                                     |
| Hard Cap Ceiling                              | `capLegalityValidation.js:validateSigning`              | Pre-persist | Hard Block     | `team.totals`, `capSettings`                                                       |
| **Exception Blocked**                         | `capLegalityValidation.js:validateExceptionEligibility` | Pre-persist | **Hard Block** | `team.totals`, `capSettings`, `signedUsing`                                        |
| **Min Salary Violation**                      | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `player` (YOS), `contract.salariesByYear[0]`, `capRulesProfile`                    |
| **Contract Years Invalid**                    | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.contractLength` OR `salariesByYear.length`, `signedUsing`                |
| **Signing Terms Invalid**                     | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.contractLength` OR `salariesByYear.length`, Salary Engine signing terms  |
| **Signing Raise Invalid**                     | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.salariesByYear[].salary`/`capHit`, Salary Engine raise percentage        |
| **First Year Max Invalid**                    | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.salariesByYear[0]`, `signedUsing`, `capRulesProfile.exceptions`          |
| **Signing First Year Engine Max Invalid**     | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.salariesByYear[0]`, Salary Engine `maxFirstYearSalary`, Bird rights type |
| **Second Apron Minimum Only**                 | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `team.totals`, `contract.salariesByYear[0]`, `player` (YOS), `capRulesProfile`     |
| Roster Minimum (<14)                          | `capLegalityValidation.js:validateWaive`                | Pre-persist | Warning        | `team.players`                                                                     |
| Dead Cap Creation                             | `capLegalityValidation.js:validateWaive`                | Pre-persist | Info           | `player.contract`                                                                  |
| Option Timing                                 | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | Hard Block     | `targetYear`, `currentYear`                                                        |
| No Contract to Extend                         | `capLegalityValidation.js:validateExtension`            | Pre-persist | Hard Block     | `player.contract`                                                                  |
| **Extension Ineligible**                      | `capLegalityValidation.js:validateExtension`            | Pre-persist | **Hard Block** | `player.contract.contractType`                                                     |
| **Extension Years Invalid**                   | `capLegalityValidation.js:validateExtension`            | Pre-persist | **Hard Block** | `extension.salariesByYear.length` OR `extension.contractLength`                    |
| **Extension First Year Max Invalid**          | `capLegalityValidation.js:validateExtension`            | Pre-persist | **Hard Block** | `player.contract.salariesByYear[-1].salary`, `extension.salariesByYear[0].salary`  |
| **Extension Raise Invalid**                   | `capLegalityValidation.js:validateExtension`            | Pre-persist | **Hard Block** | `extension.salariesByYear[].salary` (consecutive years)                            |
| **Contract Row Schema Invalid**               | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.salariesByYear[]` (negative salary/capHit, missing season)               |
| **Contract Guarantee Invalid**                | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `salariesByYear[].guaranteed`, `guaranteedAmount` (contradictory values)           |
| **Contract Option Invalid**                   | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `salariesByYear[].option` (invalid enum value)                                     |
| **Free Agency State Invalid**                 | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.freeAgency` (string format or invalid year type)                         |
| **Cap Hold Transition Invalid**               | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | Enforces correct cap hold creation/removal and freeAgency state on option decline  |
| **Option Accept Player Not Rostered**         | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedTeam.roster`, `playerId`                                                   |
| **Option Accept Option Row Invalid**          | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedPlayer.contract.salariesByYear` (option row + optionUsed)                  |
| **Option Decline Player Still Rostered**      | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedTeam.roster`, `playerId`                                                   |
| **Option Decline Contract Row Still Present** | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedPlayer.contract.salariesByYear` (declined season row)                      |
| **Option Decline Free Agency Year Mismatch**  | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedPlayer.contract.freeAgency.year`, derived option year                      |
| First Apron Warning                           | `capLegalityValidation.js:validateSigning`              | Pre-persist | Warning        | `projectedCapHit`, `capSettings.firstApron`                                        |
| Second Apron Warning                          | `capLegalityValidation.js:validateSigning`              | Pre-persist | Warning        | `projectedCapHit`, `capSettings.secondApron`                                       |
| Cap Hold Info                                 | `capLegalityValidation.js:validateRenounceRights`       | Pre-persist | Info           | `team.capHolds`                                                                    |
| **World Time Defaulted**                      | `mutationPipeline.js:validateMutation`                  | Pre-persist | Warning        | `dateDefaulted`                                                                    |
| **Offer Sheet Window Expired**                | `capLegalityValidation.js:validateOfferSheetResolution` | Pre-persist | Warning        | `asOfDate`, `offerSheet.createdAt` (48h window)                                    |
| **Stretch Timing Suspicious**                 | `capLegalityValidation.js:validateWaive`                | Pre-persist | Warning        | `asOfDate`, Season Start Date (stretch after start)                                |
| **Stretch Timing Unknown**                    | `capLegalityValidation.js:validateWaive`                | Pre-persist | Warning        | `asOfDate`, Season Code (missing start date)                                       |
| **Dead Cap Schema Invalid**                   | `mutationPipeline.js:validateMutation`                  | Pre-persist | **Hard Block** | `deadCap` array structure, amounts, season keys                                    |
| **Exceptions Schema Invalid**                 | `mutationPipeline.js:validateMutation`                  | Pre-persist | **Hard Block** | `exceptions` object structure, amounts, seasonKey, enabled boolean                 |
| **Exceptions Unknown Key**                    | `mutationPipeline.js:validateMutation`                  | Pre-persist | **Hard Block** | Unknown exception keys (only mle, tpmle, bae, room allowed)                        |

**Note:** Signing guardrails (max years, raises, first-year max) now use Salary Engine signing terms when available. Phase 2/2.5 exception tables remain the fallback when engine terms are unavailable.

#### 5.2.1 Canonical Cap Hold Multipliers (Single Source)

- Canonical multiplier table: `src/features/architect/utils/capHolds.ts` (`CAP_HOLD_MULTIPLIERS`)
- All cap hold computations must import this table (option decline expectations, cap hold creation, Bird rights references)
- Duplicate multiplier tables are not allowed; references must defer to `capHolds.ts`

#### 5.2.2 Option Transition Invariants (Phase 7.3)

**Option Accept (Pipeline-Authoritative):**

- No cap hold created for the player
- `optionUsed === true` on the option year row
- Player remains on the team roster (no roster removal)
- `salariesByYear` remains coherent (option row present for target year)

**Option Decline (Pipeline-Authoritative):**

- Cap hold created when expected and amount matches canonical multipliers (Phase 7.2)
- Player is not rostered as a signed player for the declined option year
- `freeAgency` is canonical object and year matches derived option year
- Option year row removed (no contract entry for declined season)

### 5.3 Hard Block vs Override Rules

**Hard Block Rules (NEVER overridable):**

- `roster_size` - >15 players
- `hard_cap` - Over hard cap ceiling
- `two_way_limit` - >3 two-way contracts
- `option_timing` - Wrong season for option
- `no_contract` - Extension without contract
- `exception_blocked` - Exception usage blocked by apron status
- `unverified_cap_inputs` - Cap data is unknown OR projected in STRICT mode
- `min_salary_violation` - First-year salary/capHit below CBA minimum for player's YOS
- `contract_years_invalid` - Contract length outside allowed min/max for signing mechanism
- `signing_terms_invalid` - Salary Engine max years exceeded for signing mechanism
- `signing_raise_invalid` - Salary Engine raise percentage exceeded for signing
- `first_year_max_invalid` - First-year salary exceeds mechanism max OR MINIMUM contract above min salary
- `signing_first_year_engine_max_invalid` - First-year salary/capHit exceeds Salary Engine max (Bird rights/cap space)
- `second_apron_minimum_only` - Teams above second apron can only sign to minimum salary
- `extension_ineligible` - Two-way contracts cannot be extended (must convert first)
- `extension_years_invalid` - Extension length outside 1-4 years (baseline; designated vet allows 5)
- `extension_first_year_max_invalid` - Extension first-year salary exceeds 120% baseline (Salary Engine overrides when available)
- `extension_raise_invalid` - Extension year-over-year raises exceed 8%
- `contract_row_schema_invalid` - Salary row has negative salary/capHit or missing season
- `contract_guarantee_invalid` - Guarantee fields contradictory (e.g., `guaranteedAmount` > `salary`)
- `contract_option_invalid` - Option field has invalid enum value (must be "Team Option", "Player Option", or null)
- `free_agency_state_invalid` - freeAgency is legacy string format or has invalid year type
- `cap_hold_transition_invalid` - Cap hold creation/removal contradicts option decision (reserved)
- `option_accept_player_not_rostered` - Accepted option but player is missing from roster
- `option_accept_option_row_invalid` - Accepted option but option row missing or not marked used
- `option_decline_player_still_rostered` - Declined option but player remains on roster
- `option_decline_contract_row_still_present_for_declined_season` - Declined option but contract still includes declined season
- `option_decline_free_agency_year_mismatch` - Declined option freeAgency.year mismatch
- `rfa_state_invalid` - RFA freeAgency.year is not a plausible integer (2020-2040)
- `rfa_missing_qualifying_offer` - RFA freeAgency.type but qualifyingOffer not finite > 0
- `rfa_offer_sheet_not_supported` - Phase 10: Signing RFA player from non-home team (offer sheet matching not implemented)
- `rfa_team_identity_unverifiable` - Phase 10: RFA signing where team identity cannot be verified
- `resigning_ineligible` - Re-signing player without team eligibility (no Bird rights)
- `rfa_offer_sheet_resolution_required` - Phase 12/13: Offer sheet in PENDING_MATCH when finalizing
- `rfa_offer_sheet_invalid_terms` - Phase 12: Offer sheet years/raises outside bounds
- `rfa_offer_sheet_declined` - Phase 13: Offer sheet in DECLINED state (dead)
- `rfa_offer_sheet_store_only_invalid` - Phase 14: Store-only flag used with invalid shape (missing rfaOfferSheet or MATCHED status)
- `rfa_offer_sheet_matched_offering_team_cannot_finalize` - Phase 17: Offering team cannot finalize a MATCHED offer sheet
- `rfa_offer_sheet_declined_home_team_cannot_finalize` - Phase 18.1: Home team cannot finalize a DECLINED offer sheet
- `cap_hold_signing_violation` - Phase 19: Cap-space signing exceeds salary cap when cap holds are included
- `dead_cap_schema_invalid` - Phase 24: Dead cap entry has invalid schema (missing season, invalid amount, etc.)
- `exceptions_schema_invalid` - Phase 27: Exception entry has invalid schema (non-object, negative amounts, usedAmount > totalAmount, etc.)
- `exceptions_unknown_key` - Phase 27: Unknown exception key provided (audit-grade: hard-block unknown keys)

**Soft Warning Rules (Overridable in dev mode via `VITE_ENABLE_CBA_OVERRIDE=true`):**

- `roster_minimum`, `dead_cap`, `first_apron`, `second_apron`
- `rfa_qualifying_offer_suspicious` - Phase 10: QO > 3x last year salary (may indicate data issue)
- `rfa_offer_sheet_store_only_flag_in_use` - Phase 14: Store-only mode is active for offer sheet (info)

### 5.4 Exception Blocking Rules (G0-2 Implementation)

**Location:** `capLegalityValidation.js:validateExceptionEligibility`

| Team Position                       | MLE (Non-Taxpayer) | Taxpayer MLE | BAE        | TPE        |
| ----------------------------------- | ------------------ | ------------ | ---------- | ---------- |
| Below First Apron                   | ✅ Allowed         | ✅ Allowed   | ✅ Allowed | ✅ Allowed |
| Above First Apron (not hard-capped) | ❌ BLOCKED         | ✅ Allowed   | ❌ BLOCKED | ✅ Allowed |
| Hard-Capped at First Apron          | ✅ Allowed\*       | ✅ Allowed   | ❌ BLOCKED | ✅ Allowed |
| Above Second Apron                  | ❌ BLOCKED         | ❌ BLOCKED   | ❌ BLOCKED | ❌ BLOCKED |

\* Team is already hard-capped if they used NTMLE previously.

---

## 6. Trade Machine Comparison

### 6.1 Validator Reuse Status

| Component                  | Shared with Cap Sheet? | Notes                               |
| -------------------------- | ---------------------- | ----------------------------------- |
| `tradeValidator.js`        | ✅ Yes (for trades)    | Trade-specific; imports by pipeline |
| `validateSalaryMatching`   | ❌ Trades only         | Cap Sheet uses different patterns   |
| `enforceRosterWindow`      | ❌ Trades only         | Roster validation separate          |
| `validateFaExceptionUsage` | ❌ Trades only         | Exception usage tracked differently |
| `capSettingsProvider.js`   | ✅ Yes                 | Shared cap/apron values             |
| `computeTeamCapTotals.js`  | ✅ Yes (SSOT)          | Single source of truth              |

### 6.2 Architecture Differences

| Aspect            | Trade Machine                                      | Cap Sheet                                        |
| ----------------- | -------------------------------------------------- | ------------------------------------------------ |
| Validation Engine | Full rules engine with 10+ validators              | 5 basic validators in `capLegalityValidation.js` |
| Rule Context      | Builds rich `TradeContext` with player-level rules | No rule context; basic team-level checks         |
| Salary Matching   | BYC, poison pill, trade kicker adjustments         | N/A (no salary matching for signings)            |
| Override Support  | `forceTrade` flag                                  | `overrideUsed` flag                              |

---

## 7. Gap Analysis (Ranked)

### 7.1 P0 — Can Produce Incorrect Cap Totals / Silent Illegal States

| Gap  | Description                                         | Impact                                                              | Status                  |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------- | ----------------------- |
| G0-1 | ~~No incomplete roster charge validation~~          | Teams at <14 players now have cap charge                            | ✅ RESOLVED             |
| G0-2 | ~~Exception usage not enforced post-hard-cap~~      | Exceptions now hard-blocked when prohibited                         | ✅ RESOLVED             |
| G0-3 | TPE expiration not automated                        | TPEs may appear available past 1-year window                        | ✅ Phase 1 Implemented  |
| G0-4 | ~~Min salary by YOS not enforced in pipeline~~      | Under-minimum contracts now hard-blocked                            | ✅ RESOLVED (Phase 1)   |
| G0-5 | ~~First-year max by mechanism not enforced~~        | Over-exception contracts now hard-blocked                           | ✅ RESOLVED (Phase 2.5) |
| G0-6 | ~~Second apron minimum-only not enforced~~          | Above-minimum signings at second apron now blocked                  | ✅ RESOLVED (Phase 2.5) |
| G0-7 | ~~Extension terms/raises not enforced in pipeline~~ | Illegal extensions now hard-blocked (years, first-year max, raises) | ✅ RESOLVED (Phase 3)   |

### 7.1.1 Incomplete Roster Charge (G0-1 Resolution)

**Location:** `computeTeamCapTotals.js`

**Rule:** Teams must have at least 14 standard roster players. For each missing slot, the team is charged MIN_SALARY_ROOKIE (currently $1,119,563 for 2024-25).

**Implementation:**

- `countStandardRoster()` - Counts non-two-way players
- `getMinSalaryForYear()` - Gets minimum salary from `CBA_THRESHOLDS`
- Charge = `max(0, 14 - standardRosterCount) * MIN_SALARY_ROOKIE`
- Included in `TeamCapTotals.incompleteChargesTotal` and `totalCapAllocations`
- NOT stored in Firestore - computed at runtime

**Tests:** `src/tests/architect/capTotals/incompleteRosterCharge.test.js` (9 tests)

### 7.1.2 TPE Expiration Automation (G0-3 Resolution)

**Strategy:** Option 1 (On-Advance Cleanup)

**Location:** `seasonManager.js` -> `advanceSeasonInWorld()`

**Rule:**

- TPEs have a 1-year lifespan (typically expiring `createdSeason + 1`).
- Upon season advance, any TPEs expiring _before or on_ the new season start date (July 1st) must be removed.
- **Strictness:** Removed TPEs are physically deleted from `team.tradeExceptions` array in the World overlay.
- **Lifecycle:** TPEs are cleaned during season advance; no on-read filtering required for correctness.

**Schema:**

- Canonical: `expiresOn` (ISO string)
- Implementation: `expiryISO` (ISO string)
- Logic checks both during migration phase.

**Implementation (Phase 2):**

- **Backfill:** `expiresOn` is backfilled from `expiryISO` during season transition if missing.
- **UI Alignment:** `SeasonAdvanceModal` uses shared `processTradeExceptions` logic for preview.
- **Canonicalization:** `tpeLifecycle.js` provides `getTpeExpiryISO` helper for consistent reads.

**Tests:**

- Unit: `seasonManager.tpe.test.js` (advance season, check TPE removal, check backfill)
- Integration: UI Preview matches backend removal logic.

### 7.2 P1 — Allows Illegal Action but Visible/Warned

| Gap  | Description                                    | Impact                                                      |
| ---- | ---------------------------------------------- | ----------------------------------------------------------- |
| G1-1 | Stretch provision legality not fully validated | Stretch timing rules (e.g., only before season) not checked |
| G1-2 | Bird rights eligibility UI hints incomplete    | May show signing options that aren't CBA-compliant          |
| G1-3 | No cap hold validation for FA signings         | Can sign FA even if cap hold + contract > cap space         |

### 7.3 P2 — Feature Missing / Polish

| Gap  | Description                                         | Impact                                    |
| ---- | --------------------------------------------------- | ----------------------------------------- | ------------------------- |
| G2-1 | Manual dead money entry UI missing                  | Users cannot correct data errors          |
| G2-2 | Exception create/expire UI missing                  | Must rely on automated tracking           |
| G2-3 | ~~Roster spot charges not displayed~~               | Now displayed in Cap Sheet breakdown      | ✅ RESOLVED (Phase 25/52) |
| G2-4 | ~~Contract years min/max not enforced in pipeline~~ | Contract years now validated by mechanism | ✅ RESOLVED (Phase 2)     |

### 7.4 Phase 71 MVP Gap Summary

**Audit Date:** 2026-02-01
**Full Report:** `docs/architect/return_packages/PHASE_71_CAP_SHEET_MVP_GAP_AUDIT_PREFLIGHT_RETURN_PACKAGE.md`

**SSOT Status:** `computeTeamCapTotals()` confirmed as canonical totals function.

**Key Gaps Identified:**

| Gap | Description | Severity | Proposed Chunk |
|-----|-------------|----------|----------------|
| Legacy `calculateTeamTotals()` | 2 functions in mutationPipeline.js and tradeContext.js missing `incompleteChargesTotal` | HIGH | Chunk 1: SSOT Unification |
| `CapImpactTiles` no memoization | Recalculates `computeTeamCapTotals()` on every render | MEDIUM | Chunk 2: Tile Reactivity Hardening |
| Room Exception incomplete | Not fully tracked or validated | LOW | Chunk 3: Exceptions MVP Completion |
| BAE cooldown not enforced | 2-year waiting period not implemented | LOW | Chunk 3: Exceptions MVP Completion |

**Exceptions MVP Status:** Core requirements MET (tracking, validation, hard cap sources).

**Proposed Execution Chunks:**

1. SSOT Unification
2. Tile Reactivity Hardening
3. Exceptions MVP Completion
4. Persistence/Workflow Polish

---

## 8. File Map (Top 10)

| File                                                                    | Purpose                               |
| ----------------------------------------------------------------------- | ------------------------------------- |
| `src/features/architect/utils/mutationPipeline.js`                      | Canonical mutation pipeline           |
| `src/features/architect/utils/capLegalityValidation.js`                 | Non-trade validation rules            |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`       | UI action handlers                    |
| `src/features/architect/hooks/useCapSheetState.js`                      | Local session state                   |
| `src/features/architect/hooks/useCapValidation.js`                      | Real-time UI hints                    |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js`        | SSOT computation                      |
| `src/features/architect/capSheet/CapSheet/CapSheet.jsx`                 | Main Cap Sheet component              |
| `src/shared/components/EditContractModal.jsx`                           | Contract action modal                 |
| `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx` | Exception display                     |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`    | Trade validation (reference)          |
| `src/features/architect/utils/contractNormalization.js`                 | Contract schema normalization helpers |

### 8.1 Anti-Regression Guardrails (Phase 56/57/59)

**Added:** Phase 57 (2026-01-30), Updated Phase 59 (2026-01-30)

The trade mutation pipeline enforces a strict `snapshot → validate → compute/persist` pattern to prevent duplicate validation calls and ensure compute functions remain pure.

#### Trade Validation Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRADE MUTATION PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. BUILD SNAPSHOT                                                          │
│     └─ buildPostTradeTeamsSnapshot() — PURE, applies roster moves           │
│                                                                              │
│  2. VALIDATE                                                                 │
│     └─ validatePostTradeSnapshotForContext() — calls validateTrade() ONCE   │
│                                                                              │
│  3. COMPUTE                                                                  │
│     └─ computeTradeResult() — PURE, requires validatedContext (throws if    │
│        missing), uses pre-validated TPE/rule results                        │
│                                                                              │
│  4. PERSIST                                                                  │
│     └─ persistWorldMutation() — writes to Firestore (no validation calls)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Guardrail Enforcement

| Rule                                                | Description                                                                                    | Test File                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **No validateTrade in computeTradeResult**          | `computeTradeResult()` must not call `validateTrade()` - it receives pre-validated context     | `phase57_forbid_validateTrade_in_compute_guardrail.test.js` |
| **No validateTrade in persistWorldMutation**        | Persistence layer must not call validators                                                     | `phase57_forbid_validateTrade_in_compute_guardrail.test.js` |
| **No validateTrade in buildPostTradeTeamsSnapshot** | Snapshot builder is pure, no validation calls                                                  | `phase57_forbid_validateTrade_in_compute_guardrail.test.js` |
| **No fallback validation in validateMutation**      | `validateMutation()` for trade mutations throws if pre-validated context is missing (Phase 57) | `phase57_forbid_validateTrade_in_compute_guardrail.test.js` |

#### Key Files

| File                                                       | Role                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `mutationPipeline.js::buildPostTradeTeamsSnapshot`         | Pure snapshot builder (re-export from tradeContext)     |
| `mutationPipeline.js::validatePostTradeSnapshotForContext` | Single validation point (re-export from tradeContext)   |
| `mutationPipeline.js::computeTradeResult`                  | Pure compute (requires `validatedContext`)              |
| `tradeContext/tradeContext.js`                             | Primary snapshot + validation context builders          |
| `tradeContext/legacy/index.js`                             | ⚠️ Legacy namespace - NOT for mutation modules          |
| `tradeContext/legacy/legacy_validateTradeForContext`       | ⚠️ Legacy convenience wrapper - NOT for mutation gating |

#### Phase 59 Legacy Import Guardrails

**Added:** Phase 59 (2026-01-30)

| Rule                                            | Description                                                                                 | Test File                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Mutation modules cannot import from legacy/** | `mutationPipeline.js` and utils must not import from `tradeContext/legacy/`                 | `phase59_legacy_import_guardrail.test.js` |
| **validateTradeForPipeline removed**            | Dead function deleted, no references allowed in mutation pipeline                           | `phase59_legacy_import_guardrail.test.js` |
| **Legacy namespace has loud warnings**          | `tradeContext/legacy/index.js` must contain warning emojis and explicit deprecation notices | `phase59_legacy_import_guardrail.test.js` |
| **Phase 59 markers in source files**            | Modified files must document Phase 59 changes                                               | `phase59_legacy_import_guardrail.test.js` |

#### Phase 60 Persistence No-Leak Guardrails

**Added:** Phase 60 (2026-01-30)

The mutation pipeline uses internal transient fields during the `snapshot → validate → compute` phase that must NOT be persisted to Firestore. Phase 60 added surgical sanitization at the persistence boundary.

##### Forbidden Transient Keys

| Key                        | Purpose                              | Created By                            |
| -------------------------- | ------------------------------------ | ------------------------------------- |
| `_validatedTradeContext`   | Pre-validated trade context (dedup)  | `validatePostTradeSnapshotForContext` |
| `_signingValidation`       | Pre-validated signing result (S&T)   | `computeSignAndTradeResult`           |
| `_isPostTradeSnapshot`     | Sentinel flag for snapshot detection | `buildPostTradeTeamsSnapshot`         |
| `_isValidatedTradeContext` | Sentinel flag for validated context  | `validatePostTradeSnapshotForContext` |
| `_rawValidation`           | Raw validation result for debugging  | `validatePostTradeSnapshotForContext` |

**Note:** `_meta` is NOT forbidden - it's legitimately used for computed totals display (UI).

##### Sanitization Enforcement

| Location                    | What Gets Sanitized                    | Sanitizer Function                        |
| --------------------------- | -------------------------------------- | ----------------------------------------- |
| `persistWorldMutation` (L1) | Team snapshots                         | `sanitizeTransientFieldsForPersistence()` |
| `persistWorldMutation` (L2) | Player overrides                       | `sanitizeTransientFieldsForPersistence()` |
| `persistWorldMutation` (L3) | Event metadata                         | `sanitizeTransientFieldsForPersistence()` |
| `persistWorldMutation` (L4) | Entire event object (defense-in-depth) | `sanitizeTransientFieldsForPersistence()` |

##### Guardrail Tests

| Test       | Description                                                                  |
| ---------- | ---------------------------------------------------------------------------- |
| TEST 1-6   | `sanitizeTransientFieldsForPersistence()` unit tests (keys, nesting, \_meta) |
| TEST 7-9   | `findForbiddenKeyPaths()` deep-scan helper tests                             |
| TEST 10-11 | executeTrade/signAndTrade compute result sanitization verification           |
| TEST 12-13 | Source-scan: sanitizer called for team/player writes                         |
| TEST 14-15 | `FORBIDDEN_TRANSIENT_KEYS` export, immutability, completeness                |
| TEST 16-17 | Event metadata sanitization verification                                     |

**Test File:** `phase60_mutation_persist_no_internal_leaks_guardrail.test.js`

#### Phase 61 Persistence Contract Boundary Guardrails

**Added:** Phase 61 (2026-01-30)

In addition to stripping known transient keys (Phase 60), Phase 61 added allowlist-based contracts that catch unknown/unexpected fields before they persist to Firestore.

##### Enforcement Order

```
sanitizeTransientFieldsForPersistence()  ← Phase 60: strip known transient keys
         ↓
assertPersistableOrThrow()               ← Phase 61: validate against allowlist
         ↓
removeUndefinedDeep()                    ← Strip undefined values
         ↓
batch.set()                              ← Write to Firestore
```

##### Allowlists

| Allowlist                             | Scope                         |
| ------------------------------------- | ----------------------------- |
| `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST`    | Team overlay documents        |
| `PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST` | Player override documents     |
| `EVENT_TOP_LEVEL_ALLOWLIST`           | Event documents               |
| `EVENT_METADATA_TOP_LEVEL_ALLOWLIST`  | Event metadata objects        |
| `TRADE_EXCEPTION_ITEM_ALLOWLIST`      | Items in `exceptions.tpe[]`   |
| `EXCEPTION_HISTORY_ITEM_ALLOWLIST`    | Items in `exceptionHistory[]` |

**Test File:** `phase61_persistence_contract_allowlist_guardrails.test.js`

#### Phase 62 Fixture-Based Persistence Drift Guardrails

**Added:** Phase 62 (2026-01-30)

Phase 62 extended Phase 61 contracts with deep rules for additional drift-prone nested arrays and introduced fixture-based keyset snapshot tests.

##### Additional Deep Rules (Phase 62)

| Deep Rule Path         | Allowlist                                | Purpose                       |
| ---------------------- | ---------------------------------------- | ----------------------------- |
| `deadCap`              | `DEAD_CAP_ITEM_ALLOWLIST`                | Dead cap item validation      |
| `deadCap.amountByYear` | `DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST` | 3-level nested year breakdown |
| `capHolds`             | `CAP_HOLD_ITEM_ALLOWLIST`                | Cap hold item validation      |

##### Fixture-Based Drift Detection

Phase 62 tests create representative fixture objects that mirror real persisted shapes, then:

1. **Contract validation:** Fixtures validate against `PERSISTENCE_CONTRACTS`
2. **Keyset snapshots:** Sorted key lists compared against explicit expected arrays
3. **Drift detection:** New fields trigger test failure before reaching production

##### Test Categories

| Test Range | Description                                      |
| ---------- | ------------------------------------------------ |
| TEST 1-4   | Deep rules for `deadCap[]` items (incl. 3-level) |
| TEST 5-7   | Deep rules for `capHolds[]` items                |
| TEST 8-12  | Fixture-based contract validation                |
| TEST 13-19 | Keyset snapshot drift guardrails (deterministic) |
| TEST 20-24 | Actionable error messages for nested violations  |
| TEST 25-33 | Contract structure validation for new allowlists |

**Test File:** `phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js`

---

#### Phase 63 Sign-and-Trade Restoration Guardrails

**Added:** Phase 63 (2026-01-30)

Phase 63 restored 6 failing S&T tests by completing the Phase 61 persistence contract allowlists and added targeted anti-regression guardrails.

##### Root Cause (Category C: State Assembly Regression)

The Phase 61 allowlists were incomplete - they missed legitimately persisted fields:

| Missing Field     | Allowlist                            | Purpose                           |
| ----------------- | ------------------------------------ | --------------------------------- |
| `players`         | `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST`   | Full player objects array         |
| `tradeExceptions` | `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST`   | Legacy TPE array (Phase 47)       |
| `sourceTeam`      | `EVENT_METADATA_TOP_LEVEL_ALLOWLIST` | S&T origin team in event metadata |
| `destinationTeam` | `EVENT_METADATA_TOP_LEVEL_ALLOWLIST` | S&T receiving team                |
| `contract`        | `EVENT_METADATA_TOP_LEVEL_ALLOWLIST` | Signed contract details           |

##### Guardrail Categories

| Category               | Tests | Description                                              |
| ---------------------- | ----- | -------------------------------------------------------- |
| Allowlist completeness | 9     | Verifies S&T-required fields are on allowlists           |
| Validation order       | 1     | Phase 48 invariant: signing before trade validation      |
| Short-circuit          | 1     | Signing failure prevents trade validation                |
| Architecture pattern   | 2     | Phase 56 pattern (snapshot → validate → compute/persist) |

**Test File:** `phase63_signAndTrade_restoration_guardrails.test.js`

---

## 9. Canonical Contract Schema (World)

**Status:** Phase 0 Complete (2026-01-17)

This section defines the canonical contract schema that all world mutation writers must produce. Phase 0 standardized field names and types to enable Phase 1+ CBA rule enforcement.

### 9.1 salariesByYear[] Entry (Per Year)

| Field              | Type              | Required | Notes                                                                          |
| ------------------ | ----------------- | -------- | ------------------------------------------------------------------------------ |
| `season`           | `string`          | Yes      | Format: `"YYYY-YY"` (e.g., `"2025-26"`)                                        |
| `salary`           | `number`          | Yes      | Base salary in dollars                                                         |
| `capHit`           | `number`          | Yes      | Defaults to `salary` if not specified                                          |
| `guaranteed`       | `boolean`         | Yes      | Whether year is guaranteed                                                     |
| `guaranteedAmount` | `number`          | No       | Partial guarantee amount                                                       |
| `option`           | `string \| null`  | No       | `"Team Option"`, `"Player Option"`, or `null`                                  |
| `optionUsed`       | `boolean \| null` | No       | **CANONICAL: boolean** (`true`=accepted, `false`=declined, `null`=no decision) |
| `tradeBonus`       | `number \| null`  | No       | Trade bonus amount                                                             |

**IMPORTANT:** `optionUsed` must be a boolean, NOT a string. Legacy values (`'accepted'`, `'declined'`, `'exercised'`) are normalized to boolean by `contractNormalization.js`.

### 9.2 Contract Metadata

| Field            | Type      | Required | Notes                                                                         |
| ---------------- | --------- | -------- | ----------------------------------------------------------------------------- |
| `startSeason`    | `string`  | Yes      | Format: `"YYYY-YY"`                                                           |
| `endSeason`      | `string`  | Yes      | Format: `"YYYY-YY"`                                                           |
| `contractLength` | `number`  | Yes      | Total years                                                                   |
| `yearsRemaining` | `number`  | Yes      | Years left on contract                                                        |
| `signingDate`    | `string`  | No       | **CANONICAL field name** (ISO format). NOT `signedAt` or `extensionSignedAt`. |
| `isExtension`    | `boolean` | No       | **CANONICAL field name**. NOT `extension`.                                    |
| `signingTeam`    | `string`  | No       | Team code that signed the player                                              |

### 9.3 freeAgency Object

| Field             | Type             | Required | Notes                                  |
| ----------------- | ---------------- | -------- | -------------------------------------- |
| `type`            | `string \| null` | No       | `"UFA"`, `"RFA"`, `"TO"`, `"PO"`, etc. |
| `year`            | `number`         | No       | End year (e.g., `2026`)                |
| `capHold`         | `number`         | No       | Cap hold amount                        |
| `qualifyingOffer` | `number \| null` | No       | QO amount for RFAs                     |

**IMPORTANT:** `freeAgency` must be an object, NOT a string. Legacy string values (e.g., `"2027 (UFA)"`) are normalized to object format by `contractNormalization.js`.

### 9.4 Normalization Helpers

**File:** `src/features/architect/utils/contractNormalization.js`

| Function                              | Purpose                                             |
| ------------------------------------- | --------------------------------------------------- |
| `normalizeContractForWorld(contract)` | Normalize full contract object                      |
| `normalizeSalaryRow(row)`             | Normalize single salariesByYear entry               |
| `normalizeFreeAgency(freeAgency)`     | Normalize freeAgency to object                      |
| `normalizeOptionUsed(value)`          | Convert string optionUsed to boolean                |
| `isOptionAccepted(value)`             | Check if option was accepted (handles both formats) |
| `isOptionDeclined(value)`             | Check if option was declined (handles both formats) |

### 9.5 Backward Compatibility

- **Read path:** Normalization helpers accept both legacy and canonical formats
- **Write path:** Mutation writers always produce canonical format
- **Existing Worlds:** Continue to work; new mutations produce clean data

---

## 9.6 Signing Terms Shape (Phase 6)

This section defines the canonical shape for signing terms used in validation.

### Canonical SigningTerms Type

```typescript
type SigningTerms = {
  source: 'salary_engine' | 'baseline';
  mechanism:
    | 'FULL_MLE'
    | 'TPMLE'
    | 'ROOM_MLE'
    | 'BAE'
    | 'MINIMUM'
    | 'UNKNOWN'
    | string;
  rightsType?:
    | 'FULL_BIRD'
    | 'EARLY_BIRD'
    | 'NON_BIRD'
    | 'CAP_SPACE'
    | 'NONE'
    | null;
  maxYears?: number | null;
  minYears?: number | null;
  raisePercentage?: number | null;
  maxFirstYearSalary?: number | null;
  minFirstYearSalary?: number | null;
  notes?: string;
};
```

### Field Definitions

| Field                | Type                              | Description                                                                                                 |
| -------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `source`             | `'salary_engine'` \| `'baseline'` | Origin of terms data (engine-computed vs fallback)                                                          |
| `mechanism`          | `string`                          | **Exception bucket** (e.g., `FULL_MLE`, `TPMLE`, `ROOM_MLE`, `BAE`, `MINIMUM`, `UNKNOWN`). NOT Bird rights. |
| `rightsType`         | `string` \| `null`                | **Bird rights type** (e.g., `FULL_BIRD`, `EARLY_BIRD`, `NON_BIRD`, `CAP_SPACE`, `NONE`). NOT exception.     |
| `maxYears`           | `number` \| `null`                | Maximum contract length                                                                                     |
| `minYears`           | `number` \| `null`                | Minimum contract length                                                                                     |
| `raisePercentage`    | `number` \| `null`                | Max year-over-year raise (e.g., `0.05` for 5%, `0.08` for 8%)                                               |
| `maxFirstYearSalary` | `number` \| `null`                | Maximum first-year salary                                                                                   |
| `notes`              | `string`                          | Additional context                                                                                          |

### Backward Compatibility

**Location:** `capLegalityValidation.js:normalizeSigningTerms()`

The `normalizeSigningTerms(rawTerms, options)` adapter:

- Accepts any legacy terms object
- If `mechanism` contains Bird rights keywords (e.g., "Full Bird"), moves value to `rightsType`
- Sets `mechanism` to `options.fallbackMechanism` or `'UNKNOWN'` when recovering
- Normalizes raw `rightsType` strings to canonical enum values

**Example:**

```javascript
// Legacy (pre-Phase 6)
const legacy = { mechanism: 'Full Bird', maxYears: 4 };

// Canonical (Phase 6)
const canonical = normalizeSigningTerms(legacy, {
  fallbackMechanism: 'FULL_MLE',
});
// => { mechanism: 'FULL_MLE', rightsType: 'FULL_BIRD', maxYears: 4, ... }
```

---

## 9.7 Cap Hold Amount Rules (Phase 7.2)

- **Rights-based multipliers:** FULL_BIRD = 190%, EARLY_BIRD = 130%, NON_BIRD = 120%.
- **Fallback:** CAP_SPACE/NONE/UNKNOWN uses the legacy 150% multiplier **with explicit warning** (`cap_hold_transition_inputs_missing`).
- **Rounding:** Expected amount uses `Math.round(lastSalary * multiplier)`; validation enforces ≤ $1 tolerance.
- **FA year derivation:** From option season string (`"YYYY-YY"` → start year). Example: `"2025-26"` → `2025`.

## 9.8 World Time SSOT (Phase 20)

Phase 20 introduces a canonical "world time" (`asOfDate`) field for timing-based CBA rules.

### Field Location

**World metadata:** `architect_worlds/{worldId}.asOfDate`

### Resolution Precedence

| Priority | Source                    | Example                                |
| -------- | ------------------------- | -------------------------------------- |
| 1        | `payload.asOfDate`        | Mutation provides explicit date        |
| 2        | World metadata `asOfDate` | Date stored on world document          |
| 3        | System fallback           | `new Date().toISOString().slice(0,10)` |

### Helper Function

**File:** `src/features/architect/utils/mutationPipeline.js`

```javascript
resolveWorldAsOfDate({ payloadAsOfDate, worldAsOfDate });
// Returns: { asOfDate: string, defaulted: boolean }
```

### Persistence Policy

- **Only update** world metadata `asOfDate` when payload explicitly includes it
- **Never overwrite** silently (prevents accidental time advancement)
- Mutations can reference a date without advancing world time

### Warning Rule

| Rule ID                | Type    | Trigger                                                |
| ---------------------- | ------- | ------------------------------------------------------ |
| `world_time_defaulted` | Warning | Neither payload nor world metadata provided `asOfDate` |

### Phase 21 Enablement

Phase 20 provides the infrastructure for Phase 21 to implement:

- `stretch_timing_invalid` - Stretch provision timing enforcement
- 48-hour offer sheet window enforcement
- Other timing-based CBA rules

---

## 9.92 Phase 21: Timing Warnings

Phase 21 introduces soft warning enforcement for timing-critical CBA rules using the `asOfDate` SSOT.

### Philosophy: Warnings vs Blocks

Given the complexity of retroactive data entry (e.g., entering a July transaction in October), timing rules are enforced as **WARNINGS ONLY**. This preserves user agency while creating awareness of potential CBA violations.

### 48-Hour Offer Sheet Window

- **Rule:** An offer sheet can only be matched within 48 hours of receipt.
- **Validator:** `rfa_offer_sheet_window_expired`
- **Logic:** `asOfDate > offerSheet.createdAt + 48 hours`
- **Trigger:** Attempting `matchOfferSheet` mutation.

### Stretch Provision Timing

- **Rule:** A waive-and-stretch is generally only allowed before the season starts (for full current season relief). Stretches after season start have complex pro-ration rules often distinct from simple cap relief.
- **Validator:** `stretch_timing_suspicious`
- **Logic:** `asOfDate > getSeasonStartDate(seasonCode)`
- **Trigger:** Attempting `waivePlayer` with `stretch: true`.

### Season Boundaries (Phase 21 MVP)

Hardcoded helper `getSeasonStartDate(seasonCode)` provides boundaries for `stretch_timing_suspicious`:

- 2024-25: 2024-10-22
- 2025-26: 2025-10-21 (Estimated)
- 2026-27: 2026-10-20 (Estimated)
- Unknown: 2026-10-?? (Returns null -> `stretch_timing_not_enforced_missing_season_boundary`)

---

## 10. Change Log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-16 | Initial creation with mutations inventory and validation map                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-17 | **Phase A P0:** Implemented G0-1 (incomplete roster charge) and G0-2 (post-apron exception blocking). Added `exception_blocked` to HARD_BLOCK_RULES. Updated validation map.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-17 | **Phase 1 P0:** Implemented G0-3 (TPE Expiration) Phase 1 Core Logic. Added `processTradeExceptions` to season transition.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-01-17 | **Phase 2 P0:** Completed TPE Phase 2. Canonicalized `expiresOn`. Backfill in season advance. UI Drift eliminated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-01-17 | **Contract Schema Phase 0:** Standardized contract schema for world mutations. Created `contractNormalization.js`. Updated `computeSigningResult`, `computeExtensionResult`, `computeOptionResult` to use canonical field names/types (`signingDate`, `isExtension`, boolean `optionUsed`). Updated consumers (`useCapSheetState`, `useArchitectActions`, `seasonManager`). Added 52 unit tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-17 | **Contract Rules Phase 1:** Implemented G0-4 (Minimum Salary Enforcement). Added `min_salary_violation` to HARD_BLOCK_RULES. `validateSigning` now rejects contracts where first-year salary/capHit is below CBA minimum for player's YOS. Two-way contracts excluded. 8 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-01-17 | **Contract Rules Phase 2:** Implemented G2-4 (Contract Years Enforcement). Added `contract_years_invalid` to HARD_BLOCK_RULES. `validateSigning` now validates contract length against mechanism-specific limits (MINIMUM: 1-2yr, FULL_MLE: 1-4yr, TPMLE/ROOM_MLE/BAE: 1-2yr). Added `resolveSigningMechanism()`, `getSigningYearsLimits()` helpers. Two-way contracts excluded. 9 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-01-17 | **Contract Rules Phase 2.5:** Implemented G0-5 (First-Year Max by Mechanism) and G0-6 (Second Apron Minimum-Only). Added `first_year_max_invalid` and `second_apron_minimum_only` to HARD_BLOCK_RULES. `validateSigning` now enforces exception amount caps (FULL_MLE/TPMLE/ROOM_MLE/BAE) and MINIMUM exactness. Teams above second apron blocked from above-minimum signings. Added `getSigningFirstYearMax()` helper. Fixed UI TPMLE maxYears (3→2). Two-way contracts excluded. 14 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-01-17 | **Phase 2.5 Patch:** Fixed second apron projected cap hit calculation to use `capHit` (not `salary`) when the two differ. Ensures incentive-laden or deferred contracts are correctly evaluated against second apron threshold. 1 new test added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-01-17 | **Contract Rules Phase 3:** Implemented G0-7 (Extension Terms/Raises Enforcement). Added `extension_ineligible`, `extension_years_invalid`, `extension_first_year_max_invalid`, `extension_raise_invalid` to HARD_BLOCK_RULES. `validateExtension` now blocks: (1) two-way contract extensions, (2) extensions > 4 years, (3) first-year exceeds baseline max, (4) raises > 8%. Added helper functions: `getContractLastYearSalary()`, `getExtensionFirstYearSalary()`, `getExtensionYears()`, `validateExtensionTermsAndRaises()`. Added `EXTENSION_YEARS_LIMITS`, `EXTENSION_FIRST_YEAR_MAX_PERCENT`, `EXTENSION_MAX_RAISE_PERCENT` constants. 8 new tests added.                                                                                                                                                                                                                                                                                                                 |
| 2026-01-17 | **Contract Rules Phase 3.25:** Fixed extension first-year max baseline (140%→120%). Wired Salary Engine `extensionTerms` into `validateExtension`. Engine-computed terms now override baseline for type-specific rules (rookie/designated vet/veteran). Added `getExtensionTermsForPlayer()` helper. Updated tests (constant check, 125% blocking test, engine override test).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-01-17 | **Contract Rules Phase 4:** Wired Salary Engine signing terms into `validateSigning` for max years + raise caps. Added `signing_terms_invalid` and `signing_raise_invalid` to HARD_BLOCK_RULES. Salary Engine max first-year is now enforced as an additional cap when available. Added signing terms helper + raise validation helper, updated tests, and documented pipeline authority for signing guardrails.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-18 | **Contract Rules Phase 4.5:** Added distinct `signing_first_year_engine_max_invalid` rule for engine-derived first-year max violations. Separates Bird rights/cap space enforcement from fallback exception cap enforcement (`first_year_max_invalid`). Includes rights info in violation messages. 6 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-01-18 | **Contract Rules Phase 5:** Added contract row schema validation. 3 new HARD_BLOCK rules: `contract_row_schema_invalid` (negative salary/capHit, missing season), `contract_guarantee_invalid` (guaranteedAmount > salary, guaranteed=false + positive amount), `contract_option_invalid` (invalid option enum). Added `validateContractRows()` aggregator wired into `validateSigning`. Policy: normalize `optionUsed` to null when option is null; hard-block other violations. 14 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-01-18 | **Contract Rules Phase 6:** Separated `mechanism` (exception bucket) from `rightsType` (Bird rights type). Added canonical `SigningTerms` shape documentation. Created `normalizeSigningTerms()` backward-compat adapter. Updated `buildBaseSigningTerms()` and `buildExceptionSigningTerms()` to use proper field separation. Violation payloads now include both `mechanism` and `rightsType`. Re-signing (Bird rights) is now pipeline-authoritative. 13 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-18 | **Contract Rules Phase 7:** Added canonical freeAgency state validation. 2 new HARD_BLOCK rules: `free_agency_state_invalid` (blocks legacy string format, invalid year type), `cap_hold_transition_invalid` (reserved for option accept/decline contradictions). Created `validateFreeAgencyState()` in `contractNormalization.js`. Wired into `validateSigning()`. Warns on RFA missing QO and UFA with QO set. 10 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-01-18 | **Contract Rules Phase 7.1:** Enforced `cap_hold_transition_invalid`. `validateOptionDecision` now blocks option accept if cap hold created, and decline if missing hold. Created `capHoldTransitionHelpers.js`. Adopted simplified 150% cap hold model (superseded by Phase 7.2). Fixed `freeAgentYear` bug in pipeline. 5 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-18 | **Contract Rules Phase 7.2:** Added rights-based cap hold amounts (190/130/120), fallback warnings for missing rightsType, and season-derived FA year on option decline. Updated validation + option mutation paths. Added new tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-01-18 | **Contract Rules Phase 7.3:** Enforced option accept/decline state invariants (roster presence, option row coherence, declined season removal) and hard-blocked freeAgency year mismatch. Declared `capHolds.ts` as the canonical multiplier source and wired remaining references. Added new tests for invariants + canonical source usage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-18 | **Contract Rules Phase 8:** RFA/QO Correctness + Re-Signing (Bird Rights) Guardrails. Upgraded RFA missing QO from warning to hard-block (`rfa_missing_qualifying_offer`). Added year plausibility check for RFA/UFA (`rfa_state_invalid`). Blocked signing RFA players (`rfa_signing_not_supported`) until offer sheet matching is implemented. Added re-signing eligibility check (`resigning_ineligible`) that verifies player.teamId matches team and birdRights.status is valid. 13 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-01-18 | **Contract Rules Phase 9:** Eligibility ID Correctness + FA Plausibility Centralization. (1) Added `normalizeTeamRef()` and `normalizePlayerTeamRef()` helpers to handle format mismatches (e.g., "NBA:LAL" vs "LAL"). Re-signing eligibility now uses canonical normalization to avoid false-blocks. (2) Added `resigning_eligibility_unverifiable` warning rule for cases where team identity cannot be verified. (3) Centralized FA year plausibility policy via `isPlausibleFreeAgencyYear(year, contextYear)` replacing hardcoded 2020-2040 range. Policy: [contextYear - 5, contextYear + 10]. (4) Added explicit `rightsRenounced === true` check for ineligibility. 9 new tests added.                                                                                                                                                                                                                                                                                      |
| 2026-01-18 | **Contract Rules Phase 10:** RFA Workflow Guardrails (Home-Team vs Offer Sheet). Replaced blunt `rfa_signing_not_supported` block with differentiated logic: (1) `rfa_offer_sheet_not_supported` hard-blocks non-home team RFA signings (offer sheet matching required). (2) `rfa_team_identity_unverifiable` hard-blocks when team identity cannot be normalized. (3) Home-team RFA signings allowed through normal validation (QO still enforced). Added `rfa_qualifying_offer_suspicious` warning when QO > 3x last salary. Uses Phase 9 team normalizers for identity comparison. 15 new tests added.                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-01-18 | **Contract Rules Phase 11:** Year Coverage & Rookie Scale Enforcement. (1) Eliminated silent fallback to 2024-25 cap settings. Defined `REAL` (authoritative) vs `PROJECTED` (explicit warning) year policies. `getCapSettings()` now warns on projected years and hard-blocks invalid inputs (`invalid_year_input_fallback`). (2) Created canonical Rookie Scale table source (`rookieScale.ts`). (3) Added `rookie_scale_invalid` hard-block rule enforcing 80%-120% salary band for first-round picks (1-30). Only processes when pick metadata is present and authoritative scale data exists. 10 new tests added.                                                                                                                                                                                                                                                                                                                                                              |
| 2026-01-19 | **Contract Rules Phase 12:** RFA Offer Sheet Matching (Stub). (1) Replaced blanket `rfa_offer_sheet_not_supported` block with differentiated logic: offer sheets allowed if `contract.rfaOfferSheet === true`. (2) Added `rfa_offer_sheet_resolution_required` hard-block for PENDING_MATCH attempts (no resolution). (3) Added `rfa_offer_sheet_invalid_terms` hard-block for years/raises outside bounds (1-4 years, ≤8% raises). (4) Added `rfa_offer_sheet_stub_active` warning for UI awareness. (5) Created `validateOfferSheetTerms()` helper. (6) Phase 11 hygiene fixes applied. 14 new tests added.                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-01-19 | **Contract Rules Phase 13:** Offer Sheet Pending State + Finalization Gate. (1) Added `isFinalizingSigning()` helper for finalization detection via `contract.rfaOfferSheetOnly` flag. (2) Modified `rfa_offer_sheet_resolution_required` to only block when finalizing AND status !== MATCHED. (3) PENDING_MATCH now allowed when `rfaOfferSheetOnly === true` (storing only). (4) Added `rfa_offer_sheet_declined` hard-block for DECLINED status. (5) Updated stub warning with status/finalizing info. 13 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-01-19 | **Contract Rules Phase 14:** Offer Sheet Store-Only Invariants. (1) Added `rfa_offer_sheet_store_only_invalid` hard-block for invalid store-only configurations (missing `rfaOfferSheet` or MATCHED status). (2) Added `rfa_offer_sheet_store_only_flag_in_use` warning when store-only mode is active. (3) Created `validateStoreOnlyInvariants()` helper. (4) Store-only invariants checked before offer sheet validation to catch misuse. 16 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-19 | **Contract Rules Phase 15 (Preflight):** Offer Sheet Persistence + Workflow Design. Designed persistence model for RFA offer sheets. Decision: store as `offerSheets[]` array on team overlay (`architect_worlds/{worldId}/teams/{teamCode}`). Defined canonical `OfferSheet` schema with required fields (`id`, `playerId`, `offeringTeamCode`, `homeTeamCode`, `status`, `salariesByYear`). Mapped workflow actions: Store (new `storeOfferSheet` mutation), Match/Decline (home team actions), Finalize (reuse `signFreeAgent` with MATCHED status). Identified UI surfaces: FreeAgencySection, FreeAgentPool, EditContractModal. Created Phase 16 execution checklist. No code changes (preflight only).                                                                                                                                                                                                                                                                        |
| 2026-01-19 | **Contract Rules Phase 18:** Audit-Grade Return Package + End-to-End Invariants. (1) Verified all offer sheet mutations (store/match/decline/finalizeMatched) use atomic Firestore batch writes. (2) Confirmed canonical storage paths: offering team `offerSheets[]`, home team `incomingOfferSheets[]`. (3) Validated mirroring and deduplication logic in compute functions. (4) Confirmed authority rules via `validateOfferSheetResolution()` with HARD_BLOCK rules. (5) All tests pass (6/6 offerSheetResolution, 204/204 capLegalityValidation). Build succeeds.                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-01-20 | **Contract Rules Phase 18.1:** Offer Sheet Audit-Grade Patch. (1) Added deterministic `dedupKey` for idempotency (`os:{worldId}:{offeringTeamCode}:{playerId}:{seasonKey}`). Dedup now checks both `id` and `dedupKey`. (2) Fixed DECLINED rule scope: added `rfa_offer_sheet_declined_home_team_cannot_finalize` to block home team. Offering team remains allowed. (3) Added `finalizeDeclinedOfferSheet` mutation with explicit cleanup (removes from both teams' arrays, signs player to offering team). (4) 19 new tests added. Build succeeds.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-01-20 | **Contract Rules Phase 18.2:** Offer Sheet Audit-Grade Lock. (1) Idempotency proof tests now execute `computeStoreOfferSheetResult` twice and verify no duplicate entries (store twice with different ID → 1 entry, store twice with no ID → 1 entry). (2) `worldId` now required for `storeOfferSheet` - missing worldId fails fast with error. (3) `computeFinalizeDeclinedOfferSheetResult` cleanup now removes by `id` OR `dedupKey`, fixing mirrored array divergence. (4) UI wiring: DECLINED finalization now calls `finalizeDeclinedOfferSheet` mutation instead of `signFreeAgent`, with `dedupKey` in payload. 13 new tests added. Build succeeds.                                                                                                                                                                                                                                                                                                                        |
| 2026-01-20 | **Contract Rules Phase 19:** Cap Hold / Cap Space Enforcement. (1) Added `cap_hold_signing_violation` HARD_BLOCK rule to prevent cap-space signings that exceed salary cap when cap holds are included. (2) Added `isCapSpaceSigning()` helper to detect signings without exception or Bird rights. (3) Cap hold replacement logic: re-signings replace player's existing cap hold. (4) Added `cap_hold_renounce_required` warning when specific holds block signing. (5) **DEFERRED:** `stretch_timing_invalid` - no canonical world date/season phase exists (stop condition). (6) 22 new tests added. Build succeeds.                                                                                                                                                                                                                                                                                                                                                            |
| 2026-01-20 | **Contract Rules Phase 20:** World Time SSOT. (1) Added `resolveWorldAsOfDate()` helper as single source of truth for world time. Resolution priority: payload `asOfDate` → world metadata `asOfDate` → system fallback. (2) Threaded `asOfDate` through mutation pipeline: `applyWorldMutation` → `computeWorldMutation` → `validateMutation` → `persistWorldMutation`. (3) Added `world_time_defaulted` warning rule (emitted when date is defaulted). (4) Persist policy: only write `asOfDate` to world metadata when payload explicitly includes it (no silent overwrites). (5) 14 new tests added. Build succeeds.                                                                                                                                                                                                                                                                                                                                                            |
| 2026-01-20 | **Contract Rules Phase 21:** Timing Warnings. (1) Added World Time Controls to GMDashboard (`WorldTimeControls.jsx`). (2) Implemented `offer_sheet_window_expired` warning: warns if matching >48 hours after creation relative to `asOfDate`. (3) Implemented `stretch_timing_suspicious` warning: warns if stretching after season start date relative to `asOfDate`. (4) Added `getSeasonStartDate` helper with MVP boundaries. (5) 10 new tests demonstrating warnings (non-blocking).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-01-22 | **Contract Rules Phase 23:** Sign & Trade Execution. (1) Implemented compound mutation `signAndTrade` in `mutationPipeline.js`. (2) Atomic persistence: single validation and write operation ensures both signing and trade succeed or fail together. (3) Validation: orchestrates `validateSigning` (for contract legality) followed by `validateTrade` (for trade rules). (4) Updates `EditContractModal` to support destination team selection. (5) Verified atomic updates: player moves to destination roster with new contract, source team gets no player but loses rights cleanly.                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-01-22 | **Contract Rules Phase 24:** Manual Dead Money Management. (1) Implemented `ManageDeadMoneyModal` for full CRUD on dead cap entries. (2) Created `setDeadCap` mutation for atomic array replacement. (3) Added `dead_cap_schema_invalid` validation rule to enforce canonical schema (seasonKey, positive amount). (4) Wired UI entry point in Cap Sheet footer. (5) Verified persistence and validation via new test suite `deadCapManagement.test.js` (5 tests).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-01-22 | **Contract Rules Phase 25:** Incomplete Roster Charge Visibility. (1) Added Cap Breakdown section to CapSheet footer with itemized display of: Player Salaries, Dead Money (when > 0), Cap Holds (when > 0), and Incomplete Roster Charge (when > 0). (2) Incomplete Roster Charge row shows amount and "(N open slots)" annotation from SSOT `_meta.incompleteRosterCharge`. (3) All breakdown values derived from `computeTeamCapTotals()` output (no re-computation). (4) Row conditionally hidden when charge is 0 to keep UI clean. (5) Added `rosterChargeDisplay.test.jsx` with 7 tests (RC1-RC6). Completes Group 1 cap sheet usability.                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-22 | **Contract Rules Phase 26:** Sign-and-Trade Legality Audit. (1) Fixed build-blocking parse errors in `mutationPipeline.js` (duplicate import + duplicate try/catch). (2) Audited S&T workflow: UI → EditContractModal → handleSignAndTrade → applyWorldMutation(signAndTrade) → validateSigning + validateTrade → persistWorldMutation. (3) Confirmed MVP constraints enforced: A) Signing validated first via validateSigning() B) Trade validated second via validateTrade() C) Atomic operation - both teams updated or neither D) Missing source/dest/player blocked at load phase. (4) Verified S&T-specific trade rules in `validateSignAndTrade.js`: 3-4 year minimum, first year guaranteed, hard cap trigger at first apron, taxpayer MLE restriction, offseason-only. (5) Extended test suite from 2 → 20 tests (SAT1-SAT15). (6) Documented constraints checklist: A-D enforced, BYC handled by trade validator's computeMatchingValues(), hard cap trigger implemented. |
| 2026-01-26 | **Phase 35 (Execution):** Second Apron SSOT + Emitter Consolidation. (1) Verified deletion of unused files (validateSecondApronRules.js, aggregationValidator.js, salaryMatching.js). (2) Confirmed strict `>` semantics for second apron classification in SSOT (`salaryMatchingRules.js`). (3) Verified consolidation of "Second apron team cannot receive more salary than sent" emitter to `validateSalaryMatching`. (4) All tests passed (14 validator, 5 boundary, 4 handcuffs). Build passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-01-26 | **Phase 36 (Execution):** Second Apron SSOT Guardrails. (1) Refactored 7 key validator files (`basicRules.js`, `hardCapValidation.js`, `validateAggregation.js`, `validateSalaryMatching.js`, `validateStepien.js`, `validateTradeExceptions.js`, `salaryMargin.js`) to use `isSecondApronTeam` SSOT helper from `capUtils.js`. (2) Cleaned up zombie references in `TRADE_MACHINE_AUDIT.md`. (3) Added `secondApron_SSOT_guardrail.test.js` ensuring strict `>` semantics and integration rule compliance. (4) Hardened `isSecondApronTeam` helper to robustly handle wrapped team objects. All 4 guardrail tests passed.                                                                                                                                                                                                                                                                                                                                                          |
| 2026-01-28 | **Phase 45 Docs Hygiene Sweep (EXECUTION):** Unified return package directory structure. Moved 36 files from `docs/architect/return-packages/` to `docs/architect/return_packages/`. Archived duplicate `Phase_35_Return_Package.md` to `_archive/` subfolder. Updated 18 internal path references. Zero `return-packages` references remain. Return package: `docs/architect/return_packages/PHASE_45_DOCS_HYGIENE_SWEEP_EXECUTION_RETURN_PACKAGE.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-01-29 | **Phase 52 Roster Spot Charges UI Wiring (EXECUTION):** Verified G2-3 gap already resolved in Phase 25. Confirmed: (1) SSOT computes `incompleteChargesTotal` in `computeTeamCapTotals.js` L216, (2) UI displays "Incomplete Roster Charge" row in `CapSheet.jsx` L431-451 with slot count and formatted amount, (3) 7 UI tests in `rosterChargeDisplay.test.jsx` pass. Updated Master Doc §3.2 and §7.3 to mark G2-3 as RESOLVED. Return package: `docs/architect/return_packages/PHASE_52_ROSTER_SPOT_CHARGES_UI_WIRING_EXECUTION_RETURN_PACKAGE.md`.                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## 9.8 Team Identity for Re-Signing Eligibility (Phase 9)

Re-signing eligibility requires verifying that the player "belongs" to the signing team. Due to format inconsistencies across data sources, team identity is normalized before comparison.

### Normalization Helpers

**File:** `src/features/architect/utils/contractNormalization.js`

| Function                         | Purpose                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `normalizeTeamRef(teamOrCode)`   | Normalizes team object or string to canonical uppercase code (e.g., "NBA:LAL" → "LAL")                    |
| `normalizePlayerTeamRef(player)` | Extracts and normalizes player's team ref from `teamId`, `team_id`, `teamCode`, or `contract.signingTeam` |

### Format Handling

- Prefixed formats: `"NBA:LAL"` → `"LAL"`
- Case normalization: `"lal"` → `"LAL"`
- Object extraction: `{ teamCode: "LAL" }` → `"LAL"`

### Verification Policy

- If both sides normalize → compare for exact match
- If either side cannot normalize → produce `resigning_eligibility_unverifiable` warning (NOT hard-block)
- Explicit `rightsRenounced === true` → always ineligible (hard-block)

---

## 9.9 Free Agency Year Plausibility Policy (Phase 9)

FA year plausibility is enforced using a centralized policy function instead of hardcoded ranges.

### Policy Function

**File:** `src/features/architect/utils/contractNormalization.js`

```javascript
isPlausibleFreeAgencyYear(year, (contextYear = 2026));
// Returns: { plausible: boolean, minYear: number, maxYear: number }
```

### Range Calculation

- **minYear** = contextYear - 5 (e.g., 2026 → 2021)
- **maxYear** = contextYear + 10 (e.g., 2026 → 2036)

### Context Year Sources (Priority Order)

1. `context.year` passed to validator
2. `context.contextYear` passed to validator
3. `DEFAULT_CONTEXT_YEAR` constant (2026)

### Violation Payload

When year is implausible, the violation includes:

- `contextYear` - the reference year used
- `minYear` - computed minimum
- `maxYear` - computed maximum

---

## 9.10 Rookie Scale Enforcement (Phase 11)

Rookie Scale contracts are strictly regulated by the CBA (Article VIII).

### Canonical Data Source

**File:** `src/features/architect/data/rookieScale.ts`

- Contains 100% Scale amounts for known seasons (e.g., 2024-25).
- Amounts derived from authoritative sources (CBA / RealGM).
- **Policy:** Only enforce for seasons where we have explicit scale data.

### Validation Rule (`rookie_scale_invalid`)

- **Scope:** First Round Picks (1-30).
- **Band:** Salary must be between **80% and 120%** of the 100% scale amount.
- **Tolerance:** $1 tolerance for rounding differences.
- **Cap Usage:** First-year salary is used. If Cap Hit differs significantly (rare), it is also checked.
- **Trigger:** Contract or Player object contains valid `draftPick` metadata (`{ pick: number, year: number }`).

---

## 9.11 Year Coverage Policy (Phase 11)

To prevent silent errors, year-based cap settings lookups must be explicit about data confidence.

### Classification

1. **REAL:** Authoritative data exists (e.g., 2024-25 confirmed cap). use `isRealSeason(year)`.
2. **PROJECTED:** Valid future year, but data is estimated. `getCapSettings` returns explicit warning.
3. **INVALID:** Null, undefined, or malformed year input.

### Behavior Changes

- **Legacy:** Silently fell back to 2024-25 settings for any unknown year.
- **New (Phase 11):**
  - **Valid Future Year:** Returns settings with `source: 'projected'` and warning. (Does NOT silently use 2024 constants without flagging).
  - **Invalid Input:** Returns emergency fallback settings with `source: 'invalid_year_input_fallback'` and CRITICAL warning.
  - **Strict Mode:** Throws error on invalid/missing input.

---

## 9.12 RFA Offer Sheet Schema (Phase 12)

Phase 12 introduces a minimally-correct RFA offer sheet matching stub.

### Contract Fields

| Field                 | Type                                         | Description                            |
| --------------------- | -------------------------------------------- | -------------------------------------- |
| `rfaOfferSheet`       | `boolean`                                    | Signals this is an offer sheet attempt |
| `rfaOfferSheetStatus` | `'PENDING_MATCH' \| 'MATCHED' \| 'DECLINED'` | Resolution state                       |

### Status Values

- **PENDING_MATCH:** Default after offer sheet creation. Hard-blocked from finalization.
- **MATCHED:** Home team has matched. Signing proceeds normally (future: player stays with home team).
- **DECLINED:** Home team declined. (Future: player signs with offering team).

### Validation Rules

| Rule ID                               | Type       | Trigger                                                    |
| ------------------------------------- | ---------- | ---------------------------------------------------------- |
| `rfa_offer_sheet_not_supported`       | HARD_BLOCK | Non-home team RFA signing without `rfaOfferSheet === true` |
| `rfa_offer_sheet_resolution_required` | HARD_BLOCK | Offer sheet in PENDING_MATCH state (no resolution)         |
| `rfa_offer_sheet_invalid_terms`       | HARD_BLOCK | Years outside 1-4 OR raises exceed 8%                      |
| `rfa_offer_sheet_stub_active`         | WARNING    | Any processed offer sheet (UI informational)               |

### Term Bounds

- **Years:** 1-4 (per CBA offer sheet rules)
- **Raises:** ≤ 8% year-over-year

### Phase 12 Stub Behavior

Only `PENDING_MATCH` is naturally produced. Attempts to finalize without explicit `MATCHED` status trigger `rfa_offer_sheet_resolution_required`. Full match/decline workflow is NOT implemented in Phase 12.

### Phase 13 Finalization Gate (Updated)

Phase 13 introduces the distinction between "storing" an offer sheet and "finalizing" it:

| Action     | rfaOfferSheetOnly | Status          | Result                                   |
| ---------- | ----------------- | --------------- | ---------------------------------------- |
| Store only | `true`            | `PENDING_MATCH` | ✅ Allowed                               |
| Finalize   | `false`/missing   | `PENDING_MATCH` | ❌ `rfa_offer_sheet_resolution_required` |
| Any        | any               | `DECLINED`      | ❌ `rfa_offer_sheet_declined`            |
| Finalize   | any               | `MATCHED`       | ✅ Allowed                               |

**Finalization Detection:**

- Default: `signFreeAgent` mutation is a finalizing action (adds player to roster)
- Opt-out: `contract.rfaOfferSheetOnly === true` signals non-finalizing intent

**Helper:** `isFinalizingSigning({ contract })` - Returns `true` if finalizing, `false` if storing only.

### Phase 14 Store-Only Invariants (Updated)

Phase 14 hardens store-only mode to prevent misuse:

**Store-Only Invariants:**

When `rfaOfferSheetOnly === true`, the following must hold:

| Invariant | Requirement                                 | Violation Rule                       |
| --------- | ------------------------------------------- | ------------------------------------ |
| A         | `rfaOfferSheet === true`                    | `rfa_offer_sheet_store_only_invalid` |
| B         | Status must be `PENDING_MATCH` (or missing) | `rfa_offer_sheet_store_only_invalid` |
| C         | Status cannot be `MATCHED`                  | `rfa_offer_sheet_store_only_invalid` |

**Rationale:** MATCHED status indicates the finalization path—home team matched the offer. Using store-only mode with MATCHED is contradictory.

**Helper:** `validateStoreOnlyInvariants({ contract })` - Returns `{ valid, violations }`.

## Phase 16: Offer Sheet Persistence & Workflow

Phase 16 implements the MVP workflows for store-only RFA offer sheets.

### Offer Sheet Lifecycle

1. **Creation (Store-Only):**
   - **Mutation:** `storeOfferSheet`
   - **Trigger:** Offering team "signs" RFA with "Offer Sheet" intent.
   - **Effects:**
     - Creates `OfferSheet` object.
     - Persisted to Offering Team's `offerSheets` array.
     - Mirrored to Home Team's `incomingOfferSheets` array (for visibility).
   - **Validation:** Must pass `validateStoreOnlyInvariants` and `validateOfferSheetTerms`.

2. **Resolution (Home Team):**
   - **Mutations:** `matchOfferSheet` or `declineOfferSheet`.
   - **Trigger:** Home team reviews Incoming Offer Sheet.
   - **Effects:**
     - Updates status to `MATCHED` or `DECLINED` on both teams (via cleanup/mirroring update).

3. **Finalization (Offering Team):**
   - **Mutation:** `signFreeAgent` (via `handleFinalizeOfferSheet`).
   - **Trigger:** Offering team finalizes a `DECLINED` offer sheet.
   - **Effects:**
     - Executes signing logic (adds to roster, removes cap hold on home team).
     - **Constraint:** Can only finalize if `DECLINED` (or if system allows un-matched hostile signing).
     - **Constraint:** Attempts to finalize `MATCHED` offer sheets will stick with Home Team (logic TBD in future phases, currently blocked or results in home team retention).

### Logic Updates (Phase 16)

- **Mirroring:** Offer sheets are now dual-written (to offering team and home team overlay) to ensure immediate visibility without waiting for parent world propagation.
- **Declined Offers:** Policy update allows `DECLINED` status to pass `rfa_offer_sheet_declined` rule IF `isFinalizingSigning()` is true (acquisition by offering team).

## Phase 17: Offer Sheet Resolution Logic (Updated)

Phase 17 standardizes the workflow for resolving `MATCHED` and `DECLINED` offer sheets, enforcing strict separation of powers between the Home Team and the Offering Team.

### Resolution Invariants

| Status          | Actor     | Action        | Valid? | Logic                                                            |
| --------------- | --------- | ------------- | ------ | ---------------------------------------------------------------- |
| `PENDING_MATCH` | Home      | Match/Decline | ✅     | `matchOfferSheet` / `declineOfferSheet`                          |
| `PENDING_MATCH` | Any       | Finalize      | ❌     | Violated `rfa_offer_sheet_resolution_required`                   |
| `MATCHED`       | Home      | Finalize      | ✅     | `finalizeMatchedOfferSheet`                                      |
| `MATCHED`       | Offeering | Finalize      | ❌     | Violated `rfa_offer_sheet_matched_offering_team_cannot_finalize` |
| `DECLINED`      | Offfering | Finalize      | ✅     | `signFreeAgent` (Acquisition)                                    |

### New Rules (Phase 17)

| Rule ID                                                 | Type       | Trigger                                                  | Description                  |
| ------------------------------------------------------- | ---------- | -------------------------------------------------------- | ---------------------------- |
| `rfa_offer_sheet_matched_offering_team_cannot_finalize` | HARD_BLOCK | Offering team attempts cleanup/finalize on MATCHED offer | Player stays with home team. |

---

## Phase 58: Trade Context Module + Canonical Shapes

Phase 58 extracted the Phase 56/57 trade snapshot and validation context helpers into a dedicated module for improved maintainability and shape enforcement.

### Module Location

```
src/features/architect/utils/tradeContext/
├── index.js          # Public API re-exports
├── tradeContext.js   # Snapshot + validation context builders
├── assertions.js     # Runtime shape assertions
└── types.js          # Canonical JSDoc typedefs
```

### Canonical Shapes

#### PostTradeSnapshot

```javascript
/**
 * @typedef {Object} PostTradeSnapshot
 * Result from buildPostTradeTeamsSnapshot(). Contains POST-TRADE team state
 * AFTER roster moves but BEFORE validation.
 *
 * @property {Array<{teamCode, team}>} teamUpdates - Teams with roster changes applied
 * @property {Array} validationTeams - Teams in format expected by validateTrade
 * @property {Array} payloadTeams - Original payload.teams for reference
 * @property {boolean} _isPostTradeSnapshot - Sentinel flag (Phase 58)
 */
```

#### ValidatedTradeContext

```javascript
/**
 * @typedef {Object} ValidatedTradeContext
 * Result from validatePostTradeSnapshotForContext(). Contains validation
 * results after running validateTrade() exactly ONCE on the snapshot.
 *
 * @property {boolean} legal - Is the trade legal?
 * @property {boolean} _isValidatedTradeContext - Sentinel flag (MUST be true)
 * @property {Array} teamResults - Per-team results (createdTPE, violations)
 * @property {Array} validationTeams - Validated teams with matchIncoming populated
 */
```

### Runtime Assertions

| Function                        | Call Site                           | Purpose                             |
| ------------------------------- | ----------------------------------- | ----------------------------------- |
| `assertPostTradeSnapshot()`     | validatePostTradeSnapshotForContext | Validate snapshot before validation |
| `assertValidatedTradeContext()` | computeTradeResult                  | Validate context before compute     |
| `assertTradeComputeInputs()`    | computeTradeResult (entry)          | Combined assertion for both shapes  |

### Architecture Diagram (Updated)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRADE MUTATION PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐ │
│  │ buildPostTrade      │───▶│ validatePostTrade   │───▶│ computeTrade    │ │
│  │ TeamsSnapshot       │    │ SnapshotForContext  │    │ Result          │ │
│  │ (PURE)              │    │ (calls validateTrade│    │ (PURE)          │ │
│  │                     │    │  exactly ONCE)      │    │                 │ │
│  │ [tradeContext/]     │    │ [tradeContext/]     │    │ [mutationPipe]  │ │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘ │
│           │                          │                          │          │
│           ▼                          ▼                          ▼          │
│   PostTradeSnapshot         ValidatedTradeContext        Compute Result    │
│   (has roster changes)      (has teamResults,            (team/player      │
│   (_isPostTradeSnapshot)     matchIncoming, createdTPE)   updates)         │
│                             (_isValidatedTradeContext)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

GUARDRAILS:
- validateTrade() calls ONLY in validatePostTradeSnapshotForContext
- buildPostTradeTeamsSnapshot: NO validation calls (PURE)
- computeTradeResult: NO validation calls (PURE)
- Runtime assertions at pipeline boundaries
```

### Guardrail Test Coverage

| Test       | Coverage                                          |
| ---------- | ------------------------------------------------- |
| Test 1-2   | computeTradeResult, persistWorldMutation purity   |
| Test 3     | buildPostTradeTeamsSnapshot purity (tradeContext) |
| Test 8     | tradeContext module structure                     |
| Test 9     | validateTrade allowlist (only in validator)       |
| Test 10    | assertions.js purity                              |
| Test 11-12 | mutationPipeline imports/uses shared assertions   |

### Phase 61 Persistence Contract Allowlist Guardrails

**Purpose:** Prevent Firestore schema drift at the mutation persistence boundary by enforcing allowlist-based persistence contracts for all written documents.

**What is enforced:**

| Document Type   | Path Pattern                                                     | Allowlist Constant                              |
| --------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| Team Overlay    | `architect_worlds/{worldId}/teams/{teamCode}`                    | `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST` + deep rules |
| Player Override | `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` | `PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST`           |
| Event           | `architect_worlds/{worldId}/events/{eventId}`                    | `EVENT_TOP_LEVEL_ALLOWLIST`                     |
| Event Metadata  | `event.metadata` object                                          | `EVENT_METADATA_TOP_LEVEL_ALLOWLIST`            |

**Nested allowlists (deep rules for TEAM):**

- `exceptions.tpe[]` items → `TRADE_EXCEPTION_ITEM_ALLOWLIST`
- `exceptionHistory[]` items → `EXCEPTION_HISTORY_ITEM_ALLOWLIST`

**Where enforced:** `persistWorldMutation()` in `mutationPipeline.js`

**Enforcement order:** sanitize → validate contract → removeUndefined

**How enabled:**

- Test environment (`NODE_ENV=test`): **ENABLED by default**
- Production: **DISABLED by default**
- Explicit override: `ENFORCE_PERSIST_CONTRACTS=true` env var

**What to do when it fails:**

1. Review the violation paths in the error message
2. If the field is intentional, add it to the appropriate allowlist in `src/features/architect/utils/persistenceContracts/contracts.js`
3. Document the addition in the contracts doc (`docs/architect/contracts/PERSISTENCE_CONTRACTS.md`)
4. If the field should NOT persist, remove it at the source or add to Phase 60 `FORBIDDEN_TRANSIENT_KEYS`

**Reference:** `docs/architect/contracts/PERSISTENCE_CONTRACTS.md`
