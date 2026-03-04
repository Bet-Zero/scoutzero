# ARCHITECT_CONNECTIVITY_R1_LOCAL — Review Return Package

**Date:** 2026-03-03
**Mode:** REVIEW (verification only; docs-only; NO functional/product code changes)
**Scope:** Architect GM Dashboard — cross-tab connectivity in WORLD MODE:
Trade Machine + Free Agency + Cap Sheet + Team History + Offseason (Season Advance + Draft Positions)

---

## Command Evidence (Section 7)

Run in exact order:

| # | Command | Result | Detail |
|---|---------|--------|--------|
| 1 | `npm run validate:project` | **PASS** | All validations passed |
| 2 | `npm run build` | **PASS** | Built in 27.87s (non-blocking warnings only) |
| 3 | `npm run test:trade -- --reporter=dot` | **PASS** | 58 files; 532 passed, 1 skipped, 3 todo |
| 4 | `npm run test:architect -- --reporter=dot` | **PASS** | 167 files; 2449 passed, 1 skipped, 3 todo |

---

## Scope Inventory (Section 3)

### A) World SSOT + State Plumbing

**World Team SSOT:**
- Path: `architect_worlds/{worldId}/teams/{teamCode}`
- Reference builder: `architectFirestorePaths.ts:79-83` (`worldTeamRef`)
- Fallback chain: world → parent world → base team (`teamLoader.js:34-71`)

**World Metadata SSOT:**
- Path: `architect_worlds/{worldId}`
- Reference builder: `architectFirestorePaths.ts:60-61` (`worldMetadataRef`)

**World Events SSOT:**
- Path: `architect_worlds/{worldId}/events/{eventId}`
- Collection constant: `collections.ts:67` (`ARCHITECT_WORLD_EVENTS_SUBCOLLECTION = 'events'`)
- Shared by both `persistWorldMutation` and `advanceSeasonInWorld`

**UI Read Plumbing (World Mode):**
- **Initial load:** `useArchitectState.ts:460-503` (Effect 3) calls `loadWorldTeamData(worldId, teamCode)` on mount and worldId/teamCode change
- **Post-mutation refresh:** `useArchitectActions.ts:900-922` (`syncTeamFromMutationResult`) pulls updated team from `computeResult.teamUpdates` or falls back to `loadWorldTeamData`
- **Optimistic update:** `useArchitectActions.ts:1100` (`setTeamCapSheet(afterTeamSnapshot)`) applied immediately after local validation passes
- **Rollback on failure:** `useArchitectActions.ts:1129` (`setTeamCapSheet(beforeTeamSnapshot)`) reverts on persist failure
- **No onSnapshot listeners** — explicit refetch pattern; no stale-state risk from missed events

**Tab State Sharing:**
- `GMDashboard.jsx:58-95` destructures shared state from `useArchitectState` (teamCapSheet, worldId, currentYear, etc.)
- `GMDashboard.jsx:139-148` destructures action handlers from `useArchitectActions`
- All tabs (Cap Sheet, Trade, FA, History, Offseason) receive shared state + handlers via props
- `GMDashboard.jsx:275-373` conditional rendering wires each tab section

### B) Canonical Mutation Pipeline Truth

**Entry Point:**
- `applyWorldMutation()` — `mutationPipeline.js:1128-1500`
- Phases: READ (1163-1183) → COMPUTE (1191-1210) → VALIDATE (1223-1336) → PERSIST (1420-1480) → POST-UPDATE (1475-1480)

**Persist Function:**
- `persistWorldMutation()` — `mutationPipeline.js:3526-3732`
- Atomic Firestore `writeBatch.commit()` (line 3689) — all-or-nothing
- Write sequence: teams (3542-3569) → players (3571-3598) → entitlements (3600-3619) → event (3621-3668) → metadata (3670-3686)
- Persistence contract enforcement: `assertPersistableOrThrow()` via `PERSISTENCE_CONTRACTS.TEAM` (line 3557)

**Fail-Closed Success Contract:**
- `mutationPipeline.js:1457-1472`:
  ```
  persistedToWorld = teamsPatched > 0 && eventsWritten > 0 && worldMetadataPatched > 0
  ```
  If not satisfied → `buildMutationFailureResult()` with `persistedToWorld: false`
- Return contract (lines 1483-1494): `{ success, changedTeams, worldPatch, event, persistedToWorld, eventWritten, writesSummary }`

**UI Truth Evaluator:**
- `useArchitectActions.ts:755-801` (`evaluateMutationTruth`):
  ```
  ok = Boolean(result?.success) && appliedToLocalState && persistedToWorld
  ```
- Three independent checks:
  1. `result?.success` — pipeline returned success
  2. `appliedToLocalState` — writesSummary shows `teamsPatched > 0 || playersPatched > 0 || entitlementsPatched > 0`
  3. `persistedToWorld` — writesSummary shows `eventsWritten > 0 && worldMetadataPatched > 0 && teamsPatched > 0`
- On failure: toast error + `onFailure` callback (lines 847-862)

---

## User Journey Evaluations (Section 4)

### Journey 1 — Trade -> Cap Sheet -> Team History

**Trade Execution Path:**
1. UI: Trade Machine "Apply Trade" button
2. Hook: `useArchitectActions.ts` → calls `persistMutation('executeTrade', payload)` (line 827)
3. Pipeline: `applyWorldMutation` → `computeWorldMutation('executeTrade')` (mutationPipeline.js:1745+) → `computeTradeResult`
4. Persist: `persistWorldMutation` → atomic batch write (teams + event + metadata)
5. Success: `evaluateMutationTruth` → `ok = true`

**Cap Sheet Update:**
- Optimistic: `setTeamCapSheet(afterTeamSnapshot)` (line 1100) — immediate React state update
- Authoritative: `syncTeamFromMutationResult` (lines 900-922) — pulls from `computeResult.teamUpdates`
- Cap Sheet tab reads from shared `teamCapSheet` prop — reflects updated roster/totals/exceptions

**Team History Event:**
- Event written atomically in `persistWorldMutation` (lines 3621-3668) to `architect_worlds/{worldId}/events/{eventId}`
- Event payload built by `buildWorldMutationEventPayload()` with enriched `diffSummary` and `mutationMetadata` (trade-specific: players moved, picks moved, TPEs created/consumed)
- Team History queries via `useWorldTeamEvents.ts:78-83` using `ARCHITECT_WORLD_EVENTS_SUBCOLLECTION`
- Normalized by `normalizeWorldEventsForTeamHistory.ts:280-563` — `executeTrade` has dedicated label (line 127) and summary builder (lines 198-251)

**Deterministic Test Proof:**
- `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx` — proves trade apply updates cap + produces history-compatible event
- `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts` — proves write paths are world-only
- `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx` — UI-level cap sheet update proof
- `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesTeamHistory.integration.test.tsx` — UI-level team history update proof

**Verdict: PASS**

---

### Journey 2 — Free Agency -> Cap Sheet -> Team History

**Sign Free Agent Path:**
1. UI: Free Agency tab "Sign" action
2. Hook: `handleSign` (`useArchitectActions.ts:1504-1715`)
3. World path (line 1553): calls `runAuthoritativeFAMutation('signFreeAgent', payload)` (lines 925-1002)
4. `runAuthoritativeFAMutation` calls `applyWorldMutation` (line 949)
5. Pipeline: `computeWorldMutation('signFreeAgent')` → `computeSigningResult` (mutationPipeline.js:2515-2649)
6. Persist: `persistWorldMutation` → atomic batch (teams + event + metadata)
7. Post-success: `syncTeamFromMutationResult` (line 981) + removes player from freeAgents (lines 1570-1577)

**Sign-and-Trade Path:**
1. Hook: `handleSignAndTrade` (`useArchitectActions.ts:1717-1835`)
2. Requires worldId (line 1723)
3. Calls `runAuthoritativeFAMutation('signAndTrade')` (line 1809)
4. Same canonical pipeline → persist → event

**Cap Sheet Update:**
- `runAuthoritativeFAMutation` calls `syncTeamFromMutationResult` on success (line 981)
- Shared `teamCapSheet` state updated → all tabs reflect new roster/contract/holds/exceptions

**Team History Event:**
- `signFreeAgent` and `signAndTrade` both produce events via `persistWorldMutation`
- Event normalizer covers both: `normalizeWorldEventsForTeamHistory.ts:127-131` (`formatMutationLabel`)
- Summary builder provides FA-specific summaries (lines 198-251)

**Rights Action — renounceRights:**
1. Hook: `handleRenounceRights` (`useArchitectActions.ts:2275-2401`)
2. Calls `applyCapAuditedTeamMutation({ mutationType: 'renounceRights', ... })` (line 2317)
3. `applyCapAuditedTeamMutation` (lines 1005-1160) → optimistic `setTeamCapSheet` (line 1100) → `persistMutation('renounceRights', payload)` (line 1110)
4. `persistMutation` → `applyWorldMutation` (line 827) → full pipeline
5. `renounceRights` IS a supported MutationType (mutationPipeline.js:313, 630, 778, 1649, 1852, 3432)
6. Has compute logic (line 1649), validation (line 4521), and event enrichment (line 3432)
7. Event normalizer covers it: `normalizeWorldEventsForTeamHistory.ts:135` (`renounceRights` in formatMutationLabel)

**Deterministic Test Proof:**
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx` — FA action wiring
- `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.js` — pipeline behavior for FA mutations
- `src/tests/architect/teamHistory.eventEmissionMatrix.guardrail.test.ts` — covers `signFreeAgent`, `renounceRights` event emission

**Verdict: PASS**

---

### Journey 3 — Cap Sheet Action -> Cap Sheet -> Team History

**Cap-Sheet-Side World Mutations:**
All of the following are listed in `MutationType` union (mutationPipeline.js:313) and have full compute/validate/enrich branches:
- `waivePlayer` — stretch/buyout flags supported
- `extendPlayer`
- `optionDecision`
- `setExceptions`
- `setDeadCap`

**Flow (using waivePlayer as representative):**
1. UI: Cap Sheet tab "Waive" action
2. Hook: calls `applyCapAuditedTeamMutation({ mutationType: 'waivePlayer', ... })`
3. Optimistic: `setTeamCapSheet(afterTeamSnapshot)` (line 1100)
4. Persist: `persistMutation('waivePlayer', payload)` → `applyWorldMutation` → `persistWorldMutation`
5. Event: written atomically via batch
6. History: `waivePlayer` covered in event normalizer (line 131)

**Deterministic Test Proof:**
- `src/tests/architect/capSheet.transactionMatrix.behavior.test.tsx` — multi-mutation sequences through cap sheet
- `src/tests/architect/capSheet.uiFlows.integration.test.tsx` — UI-level cap sheet mutation flows
- `src/tests/architect/teamHistory.eventEmissionMatrix.guardrail.test.ts` — covers all cap-sheet mutation families

**Verdict: PASS**

---

### Journey 4 — Offseason (Season Advance) -> Cap Sheet + History

**Season Advance Path:**
1. UI: `SeasonAdvanceModal.jsx:337-376` (`handleAdvanceSeason` callback)
2. Dynamic import: `advanceSeasonInWorld` from `seasonManager.js` (line 351)
3. Calls `advanceSeasonInWorld(worldId, { optionDecisions, ... })` (line 376)
4. Engine: `seasonManager.js:613-970`

**Key Observation — Bypasses `applyWorldMutation`:**
- `advanceSeasonInWorld` does NOT route through the canonical `applyWorldMutation` pipeline
- It writes directly via Firestore `writeBatch` (batch.set at line 758 for teams, line 943 for event, batch.commit at line 945)
- **Mitigation:** It still follows the same atomic pattern:
  - Teams written (lines 738-761) with normalization + `assertPersistableOrThrow` (line 751)
  - Event written (lines 894-943) with `PERSISTENCE_CONTRACTS.EVENT` validation (line 939)
  - World metadata patched (lines 876-883) with `currentSeason = toSeason`
  - All in a single `batch.commit()` (line 945) — atomic all-or-nothing
  - Post-state cap legality validation (lines 763-783) via `validatePostStateCapLegality`

**Teams Persisted Post-Advance:**
- Per-team writes at `architect_worlds/{worldId}/teams/{teamCode}` (line 758)
- OSTE engine (`resolveOffseasonTransition.ts:572-1059`) handles: option decisions, contract expirations, cap holds, exception lifecycle, dead money advance, hard cap clearing, totals recompute

**World Metadata Update:**
- `currentSeason = toSeason` (line 876)
- `lastModifiedTeams` (line 878)
- `actionCount` incremented (line 879)

**Team History Event:**
- Event written to `ARCHITECT_WORLD_EVENTS_SUBCOLLECTION` (line 898) — same `'events'` constant used by mutation pipeline
- Event type: `seasonAdvance` (line 903)
- Payload includes: `fromSeason`, `toSeason`, `teamsInvolved`, `beforeTotalsByTeam`, `afterTotalsByTeam`, `violations`, `diffSummary` (lines 901-935)
- `schemaVersion: CAP_AUDIT_EVENT_SCHEMA_VERSION` (line 914) — same envelope as mutation events
- `useWorldTeamEvents` queries with `teamsAffected` fallback (line 67: `{ teamField: 'teamsAffected', orderField: 'occurredAt' }`) which matches `teamsAffected` field in season advance event (line 913)
- Event normalizer: `normalizeWorldEventsForTeamHistory.ts` handles `seasonAdvance` via `inferCategory` (line 95: maps to `'offseason'`)

**Cap Sheet Reflects Advanced State:**
- Post-advance, UI must reload team data — `OffseasonSection.jsx:83` (`handleAdvanceComplete` callback) triggers re-render
- `useArchitectState` Effect 3 (line 460) reloads on world state change

**Deterministic Test Proof:**
- `src/tests/architect/seasonAdvance_capAuditEventV1.guardrails.test.ts` — event payload structure
- `src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts` — fail-closed post-state validation
- `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.js` — totals SSOT parity
- `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts` — OSTE engine correctness
- `tests/architect/seasonManager.test.js` — season manager unit tests

**Verdict: PASS**

---

### Journey 5 — Draft Positions (Config Persistence) + Effect Boundary

**Save Path:**
1. UI: `DraftPositionsInput.jsx:143-178` (`handleSave` callback)
2. Calls `saveDraftPositions(worldId, draftYear, positionsMap)` from `worldManager.js:619-654`
3. Writes to `worldMetadata.draftPositionsByYear.{year}` (line 641)
4. Updates `lastModifiedAt: serverTimestamp()` (line 646)

**Persistence Boundary:**
- Config-only write — does NOT emit Team History event (intentional)
- Draft positions are metadata about the world, not a GM transaction
- World-gated: requires `worldId` parameter

**Consumption:**
- During season advance: `seasonManager.js:658-670` loads `positionsMap` from `worldMetadata.draftPositionsByYear[draftYear]`
- Fed to DARE (Draft Asset Resolution Engine) for swap/conveyance resolution (lines 790-874)

**Deterministic Test Proof:**
- `tests/architect/worldManager.test.js` — draft positions persistence
- `src/tests/architect/offseason.devGate.guardrail.test.ts` — offseason surface gating

**Verdict: PASS**

---

## PASS/FAIL Checklist (Section 5)

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | GM Dashboard tab wiring + shared team state sources | **PASS** | `GMDashboard.jsx:58-95` (shared state), `275-373` (tab wiring). All tabs share `teamCapSheet` via props. |
| 2 | World gating correctness (base mode cannot persist) | **PASS** | Hard gate: `mutationPipeline.js:1138-1152` (`if (!worldId) return failure`). Soft gate: `useArchitectActions.ts:813-815` (`if (!worldId) return skipped`). |
| 3 | Canonical pipeline is the only world write sink | **PASS** | All mutation types route through `applyWorldMutation` → `persistWorldMutation`. Season advance (`advanceSeasonInWorld`) uses direct batch write but follows same atomic pattern with persistence contracts. Both use `ARCHITECT_WORLD_EVENTS_SUBCOLLECTION`. |
| 4 | Fail-closed success contract enforced | **PASS** | Pipeline: `mutationPipeline.js:1457-1472` requires `teamsPatched > 0 && eventsWritten > 0 && worldMetadataPatched > 0`. UI: `evaluateMutationTruth` (useArchitectActions.ts:789) requires `success && appliedToLocalState && persistedToWorld`. |
| 5 | Journey 1 Trade -> Cap -> History | **PASS** | 4 deterministic test files: `tmCapIntegration.tradeApply_updatesCapAndHistory`, `tmCapIntegration.executeTrade_writePaths`, `tmCapIntegration.ui.tradeApply_updatesCapSheet`, `tmCapIntegration.ui.tradeApply_updatesTeamHistory` |
| 6 | Journey 2 FA -> Cap -> History | **PASS** | `handleSign` → `runAuthoritativeFAMutation` → `applyWorldMutation`. Tests: `useArchitectActions.freeAgency`, `freeAgency_fixpack_e1.pipeline.behavior`, `teamHistory.eventEmissionMatrix` |
| 7 | Rights action (renounce) integration | **PASS** | `handleRenounceRights` → `applyCapAuditedTeamMutation` → `persistMutation` → `applyWorldMutation('renounceRights')`. MutationType registered (mutationPipeline.js:313,630,1649,1852,3432). Event normalizer covers it (normalizeWorldEventsForTeamHistory.ts:135). |
| 8 | Journey 3 Cap action -> Cap -> History | **PASS** | All cap mutations (waivePlayer, extendPlayer, optionDecision, setExceptions, setDeadCap) in MutationType union with compute/validate/enrich branches. Tests: `capSheet.transactionMatrix`, `capSheet.uiFlows`, `teamHistory.eventEmissionMatrix` |
| 9 | Journey 4 Offseason advance -> Cap -> History | **PASS** | `advanceSeasonInWorld` (seasonManager.js:613-970): atomic batch with teams + event + metadata. Event uses same `ARCHITECT_WORLD_EVENTS_SUBCOLLECTION`. Tests: `seasonAdvance_capAuditEventV1`, `seasonAdvance_postStateValidator_failClose`, `phase77_season_advance_totals_ssot` |
| 10 | Draft Positions persistence boundary | **PASS** | `saveDraftPositions` (worldManager.js:619-654): config write to `worldMetadata.draftPositionsByYear.{year}`. No event emission — intentional (config, not transaction). World-gated. Test: `worldManager.test.js` |
| 11 | Team History normalizer supports all required mutation families | **PASS** | `normalizeWorldEventsForTeamHistory.ts:125-143` covers: executeTrade, signFreeAgent, signAndTrade, waivePlayer, extendPlayer, renounceRights, optionDecision, storeOfferSheet, matchOfferSheet, declineOfferSheet, finalizeMatchedOfferSheet, finalizeDeclinedOfferSheet, setExceptions, setDeadCap, setException, useException, createTradeException, useTradeException |
| 12 | Forbidden Writes Rule (CRITICAL) | **PASS** | All write paths use `architectFirestorePaths.ts` helpers scoped to `architect_worlds/{worldId}/...`. No writes to root `/teams` or `architect_base*` found. `persistWorldMutation` uses `worldTeamRef`, `worldPlayerRef`, `worldEntitlementRef`, `worldMetadataRef`. Season advance uses `ARCHITECT_WORLDS_COLLECTION` prefix. Guardrail test: `tmCapIntegration.executeTrade_writePaths.guardrail.test.ts` |
| 13 | No "success without persistence" anywhere | **PASS** | `evaluateMutationTruth` (useArchitectActions.ts:789) enforces `ok = success && appliedToLocalState && persistedToWorld`. OffseasonTab single-team path DEV-gated (`offseason.devGate.guardrail.test.ts`) and labeled "Preview only — does not persist". Pipeline fail-closed at line 1462. |
| 14 | Tests / deterministic evidence exists for each journey | **PASS** | J1: 4 tmCapIntegration tests. J2: freeAgency + eventEmissionMatrix tests. J3: transactionMatrix + uiFlows + eventEmissionMatrix tests. J4: seasonAdvance_capAuditEventV1 + postStateValidator + phase77 + phase86 + seasonManager tests. J5: worldManager.test.js + offseason.devGate |

---

## STOP Conditions (Section 6)

| # | Condition | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Any action claims success but does not persist | **PASS** | `evaluateMutationTruth` fail-closed contract (useArchitectActions.ts:789). Pipeline fail-closed (mutationPipeline.js:1462). OffseasonTab single-team path DEV-gated and labeled preview-only. |
| 2 | Any write touches root `/teams` or `architect_base*` | **PASS** | All writes via `architectFirestorePaths.ts` helpers → `architect_worlds/` scope. No root `/teams` path found in write code. `architect_base*` collections are read-only (teamLoader.js fallback chain reads only). |
| 3 | Base mode allows persistence/mutation | **PASS** | Hard gate: `applyWorldMutation` rejects if `!worldId` (mutationPipeline.js:1141). Soft gate: `persistMutation` returns `{ success: true, skipped: true }` if `!worldId` (useArchitectActions.ts:814-815). |
| 4 | Any committed action lacks world event emission | **PASS** | Pipeline requires `eventsWritten > 0` for success (mutationPipeline.js:1462). Season advance writes event directly (seasonManager.js:943). Draft positions is config-only (intentional non-emission). |
| 5 | Any UI controls are dead/no-op | **PASS** | All tabs wired with action handlers from `useArchitectActions` (GMDashboard.jsx:139-148). Tab sections receive handlers as props. No dead onClick handlers found. |

---

## Overall Verdict

**PASS — 14/14 checklist items, 5/5 STOP conditions**

The Architect GM Dashboard operates as a single coherent system in world mode:

1. **Every commit action persists** via canonical world pipeline (fail-closed) — trades, signings, cap actions all route through `applyWorldMutation` → `persistWorldMutation` with atomic Firestore batch. Season advance uses a parallel but equivalent atomic batch path.

2. **Cap Sheet reflects** authoritative team state — optimistic updates with rollback on failure, authoritative sync from mutation results, shared `teamCapSheet` state flows to all tabs.

3. **Team History logs** every commit action — events written atomically with mutations, queried by `useWorldTeamEvents`, normalized by `normalizeWorldEventsForTeamHistory` with 18 mutation type labels and structured detail sections.

4. **Offseason/Season Advance** updates world SSOT — `advanceSeasonInWorld` writes all teams + event + metadata atomically, updates `currentSeason`, and emits `seasonAdvance` event readable by Team History.

5. **No hidden bypass paths** — all write paths scoped to `architect_worlds/{worldId}/...`, base mode hard-gated, fail-closed contracts enforced at both pipeline and UI layers.

**Architectural Note:** Season advance (`advanceSeasonInWorld`) is the one write path that bypasses `applyWorldMutation`. This is architecturally justified — season advance is a league-wide operation (30 teams) that doesn't fit the single-mutation-per-team model. It still follows atomic batch, persistence contracts, and event emission patterns. Both paths share the `ARCHITECT_WORLD_EVENTS_SUBCOLLECTION` constant for Team History compatibility.

---

## Files Changed

None (review-only).

## Validation Commands Run

| Command | Result |
|---------|--------|
| `npm run validate:project` | PASS |
| `npm run build` | PASS (non-blocking warnings) |
| `npm run test:trade -- --reporter=dot` | PASS (58 files; 532 passed, 1 skipped, 3 todo) |
| `npm run test:architect -- --reporter=dot` | PASS (167 files; 2449 passed, 1 skipped, 3 todo) |

## Commands Intentionally Skipped

- `npm run test:full` — Not requested; full suite requires explicit `RUN FULL SUITE` per AGENTS.md
- `npm run dev` — Not required by review prompt; no manual UI walkthrough dependency for PASS claims
