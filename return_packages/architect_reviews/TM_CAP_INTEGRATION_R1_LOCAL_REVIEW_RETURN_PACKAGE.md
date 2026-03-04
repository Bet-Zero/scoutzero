# TM_CAP_INTEGRATION_R1_LOCAL — REVIEW RETURN PACKAGE

**Date:** 2026-03-03  
**Status:** FAIL (11 PASS / 1 FAIL / 0 BLOCKED)

> **Superseded by E1 execution closure:** `return_packages/architect_fixes/TM_CAP_INTEGRATION_E1_EXECUTION_RETURN_PACKAGE.md`  
> Checklist #12 is closed by deterministic automated proof added in E1.

## Executive Summary

- Pass count: **11**
- Fail count: **1**
- Blocked count: **0**
- Critical outcome: Trade Machine -> world mutation pipeline -> Cap Sheet/Team History integration is implemented with fail-closed world persistence checks (`teamsPatched > 0`, `eventsWritten > 0`, `worldMetadataPatched > 0`) and world-only write paths.
- Top failure: **Checklist #12 (Tests)** is FAIL due missing deterministic end-to-end UI coverage that proves Trade Machine apply updates Cap Sheet UI and Team History event stream in one integrated test path.

## Scope Inventory

### A) UI surfaces + entry paths

- Primary route path:
  - `/gm/:teamId` from `src/App.jsx` -> `src/pages/GmDashboardView.jsx` -> `src/features/architect/GMDashboard/GMDashboard.jsx`.
- Tab/click path to Trade Machine:
  - GM Dashboard tab button `setActiveTab('trade')` -> `TradeSection` (`src/features/architect/GMDashboard/sections/TradeSection.jsx`) -> `TradeEditor` (`src/features/architect/tradeMachine/TradeEditor.jsx`).
- Tab/click path to Cap Sheet:
  - GM Dashboard tab button `setActiveTab('cap')` -> `CapSheetSection` (`src/features/architect/GMDashboard/sections/CapSheetSection.jsx`) -> `CapSheet` + `ExceptionTracker`.
- Apply/commit control:
  - `Apply Trade` button in `src/features/architect/tradeMachine/TradeEditor.jsx` (`disabled={!canApplyTrade}`; calls `onApplyTrade(tradeData)` only after legal validation).
- Post-apply Cap Sheet refresh path:
  - `onApplyTrade` -> `applyTradeToCapSheet` in `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` -> world path `runAuthoritativeFAMutation('executeTrade', ...)` -> `syncTeamFromMutationResult` -> `setTeamCapSheet(...)` (same state consumed by Cap Sheet surfaces).

### B) Code surfaces (primary files + key functions)

- Trade Machine UI/state:
  - `src/features/architect/tradeMachine/TradeEditor.jsx` (`canApplyTrade`, `Apply Trade`, `onApplyTrade`)
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx` (team salary snapshot display, TPE selection/usage UI)
  - `src/features/architect/GMDashboard/sections/TradeSection.jsx`
- Trade validation + salary matching/hard cap:
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` (`validateTrade`)
  - `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
  - `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
  - `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
- Apply/commit mutation path:
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (`applyTradeToCapSheet`, `runAuthoritativeFAMutation`, `evaluateMutationTruth`)
  - `src/features/architect/utils/mutationPipeline.js` (`applyWorldMutation`, `persistWorldMutation`, `computeWorldMutation`)
- Cap Sheet totals compute/render:
  - `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
  - `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
  - `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`
  - `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`
- TPE create/consume/storage/display:
  - `src/features/architect/utils/mutationPipeline.js` (apply-time TPE creation/consumption)
  - `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js` (`normalizeTeamTpeSchema`, `getTeamTpeList`)
  - `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` (`createTPE`, expiry)
  - `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx`
- World persistence + event write:
  - `src/features/architect/utils/mutationPipeline.js` (`persistWorldMutation`, `buildWorldMutationEventPayload`)
  - `src/features/architect/utils/architectFirestorePaths.ts` (`worldTeamRef`, `worldPlayerRef`, `worldMetadataRef`)
  - `src/features/architect/history/hooks/useWorldTeamEvents.ts` (world events SSOT read)
- Forbidden writes protection surfaces:
  - `src/features/architect/utils/mutationPipeline.js` (`sanitizeTransientFieldsForPersistence`, world-path-only writes)
  - `src/constants/collections.ts` (`ARCHITECT_WORLDS_COLLECTION`, `ARCHITECT_WORLD_EVENTS_SUBCOLLECTION`)

## PASS/FAIL Checklist (1–12)

### 1) UI wiring (Trade Machine -> Apply -> Cap Sheet reflects)

- **Status:** PASS
- **Evidence:**
  - Trade tab wiring exists (`activeTab === 'trade'`) and renders `TradeSection`.
  - `Apply Trade` is hard-gated by `canApplyTrade` and legal validation in `TradeEditor`.
  - Apply callback is connected: `onApplyTrade={actions.applyTradeToCapSheet}` in `GMDashboard`.
  - Post-apply state refresh path is present: `runAuthoritativeFAMutation` -> `syncTeamFromMutationResult` -> `setTeamCapSheet` (Cap Sheet reads same team state).

### 2) World scoping (no base persistence)

- **Status:** PASS
- **Evidence:**
  - World mode only commit branch in `applyTradeToCapSheet`: `if (worldId) runAuthoritativeFAMutation('executeTrade', ...)`.
  - Base-mode branch executes authoritative compute only (`computeWorldMutation` with `worldId: null`) and sets local state; no persistence call.
  - Generic persistence helper in `useArchitectActions` short-circuits when `!worldId` (`{ success: true, skipped: true }`), preventing base persistence.

### 3) Persistence truth (writes + event)

- **Status:** PASS
- **Evidence:**
  - Chain: `TradeEditor Apply` -> `applyTradeToCapSheet` -> `runAuthoritativeFAMutation` -> `applyWorldMutation` -> `persistWorldMutation` -> batch commit.
  - `applyWorldMutation` fail-closes unless canonical world persistence is complete:
    - `writesSummary.teamsPatched > 0`
    - `writesSummary.eventsWritten > 0`
    - `writesSummary.worldMetadataPatched > 0`
  - `evaluateMutationTruth` in `useArchitectActions` further requires persistence summary and marks mutation failure if world writes/event conditions are not satisfied.
  - `persistWorldMutation` writes teams, optional players/entitlements, event document, world metadata in one batch, then commits atomically.
  - Test support:
    - `src/tests/architect/teamHistory.eventEmissionMatrix.guardrail.test.ts`
    - `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts`

### 4) Cap Sheet delta accuracy

- **Status:** PASS
- **Evidence:**
  - Trade apply updates team roster payload in pipeline compute and returns changed team snapshots.
  - Cap totals SSOT recomputation function is centralized in `computeTeamCapTotals` (players, dead money, cap holds, incomplete charges, deltas vs cap/tax/aprons).
  - Cap Sheet UI reads SSOT totals directly (`computeTeamCapTotals(...)` in `CapSheet.jsx`, and per-year totals in `CapSheetFull.jsx`).
  - `CapSheetSection` also renders `ExceptionTracker`, which reads current team exception/TPE state via canonical accessor.
  - Post-trade persist/reload parity and totals SSOT guardrails are covered in `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.js`.

### 5) Salary matching vs hard cap alignment

- **Status:** PASS
- **Evidence:**
  - `validateSalaryMatching` computes `hardCapIncomingCeiling` and `effectiveAllowableIncoming` (min of salary-matching ceiling and hard-cap ceiling).
  - `validateHardCap` separately enforces hard-cap incoming ceiling violations using projected salary and incoming ceiling math.
  - `validateTrade` executes both rules and reports reason parity when hard-cap ceiling is active limiter.
  - Regression coverage:
    - `src/tests/trade/hardCap_salaryMatching.guardrail.test.js`
    - `src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts`

### 6) TPE truth (create/consume/display)

- **Status:** PASS
- **Evidence:**
  - Creation + expiry: `createTPE` sets amount + one-year expiry (`expiresOn`/`expirationDate`).
  - Apply-time consumption: `mutationPipeline` uses validator-produced routing and `matchIncoming` fail-closed checks, updates `remainingAmount`/`usedAmount`/`isUsed`.
  - Storage canonicalization: `normalizeTeamTpeSchema` merges to canonical `exceptions.tpe` and removes legacy `tradeExceptions` before persistence.
  - Read canonicalization: `getTeamTpeList` provides normalized fields to UI and validator consumers.
  - UI display:
    - Cap Sheet side (`ExceptionTracker`) lists active trade exceptions.
    - Trade Machine side (`TradeTeamCard`, `TradeExceptionDashboard`) shows available/used exceptions.
  - Coverage:
    - `src/tests/architect/phase47_tpe_persistence_guardrails.test.js`
    - `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
    - `src/tests/trade/tpe_perPlayer.guardrail.test.js` (in suite run)

### 7) Trade validation correctness (major CBA gates)

- **Status:** PASS
- **Evidence:**
  - `validateTrade` composes salary matching, hard cap, Stepien, cash, trade exceptions, sign-and-trade, consent, reacquisition, aggregation, second-apron enforcement, roster validation, entitlement routing/exclusivity.
  - Test suites executed successfully:
    - `npm run test:trade -- --reporter=dot` (58 files PASS)
    - `npm run test:architect -- --reporter=dot` (166 files PASS)
  - Representative guards observed in logs/tests: hard-cap parity, Stepien, second-apron restrictions, entitlement linkage/exclusivity fail-closed behavior.

### 8) Event payload quality for trade

- **Status:** PASS
- **Evidence:**
  - `buildWorldMutationEventPayload` includes:
    - `mutationType` / `type`
    - `occurredAt` / `timestamp`
    - `teamCodes` / `teamsAffected`
    - `playerIds`
    - `beforeTotalsByTeam` / `afterTotalsByTeam`
    - `mutationMetadata` and `diffSummary`
  - Trade-specific metadata enrichment:
    - `buildTeamHistoryMutationMetadata` includes `picksMoved` derived from `picksTraded` / `entitlementsTraded` metadata.
    - `buildTeamHistoryDiffSummary` includes `playersMoved` and `picksMoved` for `executeTrade`.
  - Guardrail test matrix verifies required fields and fail-closed missing-team behavior:
    - `src/tests/architect/teamHistory.eventEmissionMatrix.guardrail.test.ts`.

### 9) Forbidden writes rule (CRITICAL)

- **Status:** PASS
- **Evidence:**
  - Mutation write sink (`persistWorldMutation`) writes only world-scoped paths:
    - `architect_worlds/{worldId}/teams/{teamCode}`
    - `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`
    - `architect_worlds/{worldId}/entitlements/{entitlementId}`
    - `architect_worlds/{worldId}/events/{eventId}`
    - world metadata patch at `architect_worlds/{worldId}`
  - `mutationPipeline.js` imports world collection constants only; no base/root team collection constants are used for writes in this flow.
  - Guardrail evidence for fail-closed no-write on invalid apply path:
    - `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts` asserts `writeBatch`/`commit` are not called when routing is invalid.

### 10) Error handling / edge cases (fail-closed)

- **Status:** PASS
- **Evidence:**
  - `applyWorldMutation` input validation fail-closed (missing user/world/season/mutation/payload).
  - Fail-closed branches for invalid compute, validation, league invariants, entitlement invariants, post-state cap legality.
  - TPE fail-closed checks in apply-time processing block mutation on invalid TPE state (missing `tpeId`/`matchIncoming` for `absorptionMode='TPE'`).
  - Authoritative base-state trade path requires validated context and legal flag before local state update.

### 11) Performance footguns (no unbounded listeners)

- **Status:** PASS
- **Evidence:**
  - Trade apply path is command-style (`applyWorldMutation` + batch commit), not listener-based.
  - Team History events hook performs paged query fetch (`limit`, `loadMore`) rather than unbounded subscription stream.
  - No new listener introduction observed in reviewed apply/persist path.

### 12) Tests (coverage exists; gaps listed if not)

- **Status:** FAIL
- **Evidence:**
  - Strong unit/integration guardrails exist for persistence/event/TPE/hard-cap/totals parity.
  - Missing deterministic integrated UI test that proves one full path in a single test run:
    - legal trade apply from Trade Machine in world mode,
    - Cap Sheet totals/roster reflect update,
    - Team History world events query shows emitted event.
  - Missing targeted regression asserting no writes ever target root `/teams` or `architect_base*` for executeTrade persistence via mocked Firestore path capture.

## Evidence Appendix

### Required command outputs (run in exact order)

1. `npm run validate:project` -> **PASS**
   - Summary: `All validations passed!`
2. `npm run build` -> **PASS**
   - Summary: `✓ built in 1m 6s`
   - Notes: non-blocking Vite warnings (chunk size + dynamic import notices).
3. `npm run test:trade -- --reporter=dot` -> **PASS**
   - `Test Files 58 passed (58)`
   - `Tests 532 passed | 1 skipped | 3 todo (536)`
   - Duration: `54.65s`
4. `npm run test:architect -- --reporter=dot` -> **PASS**
   - `Test Files 166 passed (166)`
   - `Tests 2447 passed | 1 skipped | 3 todo (2451)`
   - Duration: `141.72s`

### Key code pointers

- Route + tabs + apply wiring:
  - `src/App.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- Mutation + persistence + event emission:
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/architectFirestorePaths.ts`
  - `src/constants/collections.ts`
- Cap totals + UI rendering:
  - `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
  - `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
  - `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`
  - `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
- Validation/TPE rules:
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
  - `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
  - `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
  - `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`

### Key test pointers

- Persistence + fail-closed no-write:
  - `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts`
  - `src/tests/architect/phase50_executeTrade_integration_persistence.test.js`
- Event emission + payload:
  - `src/tests/architect/teamHistory.eventEmissionMatrix.guardrail.test.ts`
- Cap totals recompute/parity:
  - `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.js`
- TPE behavior/read-path:
  - `src/tests/architect/phase47_tpe_persistence_guardrails.test.js`
  - `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
  - `src/tests/trade/tpe_perPlayer.guardrail.test.js`
- Hard cap vs salary matching:
  - `src/tests/trade/hardCap_salaryMatching.guardrail.test.js`
  - `src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts`

### Stop Conditions Evaluation

- 1. Action claims success but no world persistence: **NOT DETECTED** (truth checks enforce persistence summary and fail close).
- 2. Writes touch root `/teams` or `architect_base*`: **NOT DETECTED** in reviewed executeTrade persistence path.
- 3. Base mode apply persists canonical state: **NOT DETECTED** (base path compute-only; no world write call).
- 4. Trade apply emits no world event: **NOT DETECTED** (event write is required for persisted success contract).
- 5. Dead functional UI controls: **NOT DETECTED** in reviewed Trade apply control path.

## Fix Punchlist (NO FIXES IMPLEMENTED)

1. Add deterministic integration test: Trade Machine legal apply in world mode -> assert Cap Sheet totals delta + roster movement + Team History world event visible.
2. Add write-path guardrail test that captures Firestore `doc/collection` path arguments during executeTrade persist and asserts all writes are under `architect_worlds/{worldId}/...` (explicitly rejecting root `/teams` and any `architect_base*`).
3. Add targeted integration test for TPE lifecycle across apply + UI surfaces:
   - create on outgoing>incoming over-cap trade,
   - consume via `absorptionMode='TPE'` and `matchIncoming`,
   - verify `ExceptionTracker` and Trade Machine exception displays reflect updated amounts/expiry.

## Closure Criteria

- Checklist #12 must move to PASS by adding the deterministic integrated coverage above.
- Re-run required command sequence in same order and update this package with final counts.
- Preserve world-only persistence + event fail-closed contract (`eventsWritten > 0` and canonical world patches required for success).

## AGENTS Return Package Metadata

- **Files changed:**
  - `return_packages/architect_reviews/TM_CAP_INTEGRATION_R1_LOCAL_REVIEW_RETURN_PACKAGE.md`
  - `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- **Validation commands run (exact order):**
  1. `npm run validate:project`
  2. `npm run build`
  3. `npm run test:trade -- --reporter=dot`
  4. `npm run test:architect -- --reporter=dot`
- **Commands skipped:**
  - `npm run test:full` (not requested; explicitly disallowed unless prompt contains `RUN FULL SUITE`)
  - `npm run dev` / emulator/manual walkthrough commands (not required by this review prompt)
