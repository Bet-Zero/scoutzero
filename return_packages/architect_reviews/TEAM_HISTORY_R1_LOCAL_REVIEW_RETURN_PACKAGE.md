# TEAM_HISTORY_R1_LOCAL — REVIEW RETURN PACKAGE
**Date:** 2026-03-01  
**Status:** FAIL (4 PASS / 4 FAIL / 1 BLOCKED)

## Executive Summary
- PASS count: **4**
- FAIL count: **4**
- BLOCKED count: **1**
- Top critical failures:
  1. Trade apply cannot complete in world mode (`Apply Trade` remains disabled; trade blocked by expired TPE guard).
  2. Cap-sheet history-driving actions do not persist (`Waive & Stretch`/`Waive` save path fails).
  3. Exception/entitlement edits fail to persist from `Manage Exceptions`.
  4. Free Agency signing workflow cannot be completed in tested path (`Confirm Action` remains disabled for surfaced flow).
  5. Team History remains empty after attempted major actions; no event entries written for tested worlds.

## A) Scope Inventory

### UI Surfaces (and how to reach)
- Route path: `/gm` -> click `Manage Team` -> `/gm/:teamId` -> click `Team History`.
- Primary UI files:
  - `src/App.jsx`
  - `src/pages/GmLeagueView.jsx`
  - `src/pages/GmDashboardView.jsx`
  - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - `src/features/architect/GMDashboard/sections/HistorySection.jsx`
  - `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`
- Team History sections rendered:
  - `Waived & Stretched Contracts`
  - `Trade Exception Activity`
  - `MLE Usage History`
  - `Draft Pick Trade Log`
  - `Current Pick Inventory`
- Controls discovered in Team History:
  - No filter/search/sort controls.
  - No detail/expand/export controls.
  - Runtime evidence: `DETAIL_EXPAND_EXPORT_BUTTON_COUNT: 0`.
- Empty states verified:
  - `No waived contracts.`
  - `No dead money on the books.`
  - `No TPE activity logged.`
  - `No MLE activity logged.`
  - `No draft pick trades logged.`
  - `No picks currently owned.`

### Data Surfaces (reads + writes)
- Team History reads only from `teamCapSheet` props in `TeamHistoryTab`:
  - `waivedContracts`
  - `exceptionHistory`
  - `mleHistory`
  - `pickLog`
  - `currentPicks`
- World/base data loading chain:
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
  - `src/features/architect/utils/worldTeamData.ts`
  - `src/features/architect/utils/teamLoader.js`
  - Fallback behavior: world snapshot -> parent world -> base collection.
- Firestore read paths involved in Team History source state:
  - `architect_worlds/{worldId}/teams/{teamCode}`
  - `architect_worlds/{worldId}`
  - `architect_baseTeams/{teamCode}`
  - `architect_basePlayers/{playerId}`
- Storage keys observed/used in Team History context:
  - `architect.activeWorldId.${userId}`
  - `hz.currentSeasonEndYear`
  - debug-local keys (`architect_base_capAuditEvents_v1`, `architect_world_preview_capAuditEvents_v1`) in cap-audit local log path.
- Team History tab itself does not write to Firestore/local storage.
- Mutation pipeline write destinations (when mutations succeed):
  - `architect_worlds/{worldId}/teams/{teamCode}`
  - `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`
  - `architect_worlds/{worldId}/entitlements/{entitlementId}`
  - `architect_worlds/{worldId}/events/{eventId}`
  - `architect_worlds/{worldId}` metadata

### Event SSOT + Schema Summary
- Canonical event-log SSOT: **`architect_worlds/{worldId}/events/{eventId}`**.
- Event writing evidence:
  - `src/features/architect/utils/mutationPipeline.js` (`persistWorldMutation`)
  - `src/features/architect/utils/seasonManager.js` (`advanceSeasonInWorld`)
- Event envelope fields (writer + allowlist contract):
  - Legacy envelope: `eventId`, `type`, `timestamp`, `seasonId`, `metadata`, `teamsAffected`
  - CapAuditEventV1 envelope: `schemaVersion`, `validatorVersion`, `operationId`, `mutationType`, `occurredAt`, `worldId`, `teamCodes`, `playerIds`, `beforeTotalsByTeam`, `afterTotalsByTeam`, `valid`, `violations`, `warnings`, `diffSummary`, `mutationMetadata`
  - Contract source: `src/features/architect/utils/persistenceContracts/contracts.js`
- Ordering fields:
  - `occurredAt` and `timestamp` (ISO strings)
  - `eventId` includes `mutationType + timestamp + randomSuffix`
  - No separate monotonic sequence field found.

## B) PASS/FAIL Checklist (1–9)

### 1) UI Wiring
- **Status:** PASS
- **Evidence:** Team History route/tab is reachable and renders all intended sections with stable empty states. Runtime route evidence captured on `/gm/hawks?season=2026` with `Team History` tab visible and active.

### 2) History Actually Loads
- **Status:** FAIL
- **Evidence:** Fresh-world/base empty states are sane, but world-mode action attempts did not produce entries. In worlds created for action probes, Team History stayed empty and world `events` remained `0`.
  - Firestore probe examples: `THR1CAPWAIVE3_*`, `THR1TRADEMODE_*`, `THR1ENT2_*` each showed `actionCount: 0`, `events: 0`.

### 3) World Scoping
- **Status:** PASS
- **Evidence:** Switching world selector changed Team History context line deterministically:
  - `World: base-mode | Base events: 0 | Preview events: 0`
  - `World: world_...bp4m0848a | Base events: 0 | Preview events: 0`
  - `World: world_...ititlnl8u | Base events: 0 | Preview events: 0`
  - Switching back restored prior world context.
- **Base mode behavior:** explicitly defined and observable as `World: base-mode` with Team History empty-state rendering.

### 4) Completeness Coverage (Trade / FA / Cap / Entitlements)
- **Status:** FAIL
- **Evidence by required action class:**
  - **Trade apply:** attempted two-team trade assembly (ATL/BOS) with player routing; validation returns blocker and `Apply Trade` remains disabled. Observed message: `Trade blocked: Trade exception TPE-ATL-Feb 6, 2026-1 is expired`.
  - **FA sign / sign-and-trade / offer-sheet finalize:** surfaced flow opened with `Sign Free Agent` and `Sign & Trade`, but `Confirm Action` remained disabled in tested path; no `Offer Sheet`/`Finalize` control discovered in scanned free-agency controls.
  - **Cap actions:**
    - **Extend:** blocked in modal (`Contract must be 3+ years to be eligible for extension`), confirm disabled.
    - **Waive / Waive & Stretch:** confirm enabled and attempted; persisted result failed with `Failed to save waive/buyout action. Please try again.`
    - **Buyout:** action shown, but confirm disabled in tested path.
    - **Renounce:** no renounce control surfaced in tested `Cap Sheet`/`Full Cap Table` runtime paths.
  - **Entitlement changes (`Manage Exceptions`):** save attempt returned `Failed to save exceptions. Please fix issues and try again.`

### 5) Accuracy (3 entries: roster/cap delta/timestamps)
- **Status:** BLOCKED
- **Evidence:** No successful history/event entries were produced in tested worlds (events subcollection size stayed `0`), so roster delta/cap delta/timestamp ordering could not be validated on real entries.
- **Blocking dependency:** successful mutation persistence for at least 3 audited actions in one world.

### 6) Detail View Quality
- **Status:** FAIL
- **Evidence:** Team History has no row-level detail interaction (`view details`/`expand`/`export` absent). Observed control scan returned `DETAIL_EXPAND_EXPORT_BUTTON_COUNT: 0`.
- **Minimum viable detail surface required:** click a history row to view category, teams, player/asset deltas, cap delta, event timestamp, and source mutation ID/event ID.

### 7) Forbidden Writes Rule (CRITICAL)
- **Status:** PASS
- **Evidence:**
  - Write paths in mutation pipeline are world-scoped (`architect_worlds/...`) in `src/features/architect/utils/mutationPipeline.js`.
  - Runtime Firestore check: root collection `/teams` had `0` docs in test environment.
  - No write path found targeting `architect_base*`; base collections present as expected:
    - `architect_baseTeams: 30`
    - `architect_basePlayers: 660`
    - `architect_baseEntitlements: 540`
    - `architect_basePickRules: 125`

### 8) Performance Footguns
- **Status:** PASS (with risk)
- **Evidence:**
  - Team History itself does not create event-stream subscriptions (no load-all-events loop in Team History path).
  - No Team History pagination implementation required yet because event stream is not consumed directly by Team History.
- **Risk noted:** architect player data uses full realtime collection subscription without filter/limit:
  - `src/features/architect/utils/subscribeArchitectPlayerData.ts` (`query(basePlayersCol())` + `onSnapshot`).

### 9) Tests
- **Status:** FAIL
- **Evidence:**
  - Existing world/event/mutation tests are substantial (`npm run test:architect -- --reporter=dot` passed 159 files), but no direct Team History UI/component tests found.
  - Search over `src/tests` for `TeamHistoryTab|WaiveStretchTracker|DraftPickTracker|ExceptionHistoryTracker|Team History` returned no matches.
- **Missing test targets (minimum):**
  - `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`
  - `src/features/architect/offseason/WaiveStretchTracker/WaiveStretchTracker.jsx`
  - `src/features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.jsx`
  - `src/features/architect/offseason/DraftPickTracker/DraftPickTracker.jsx`
  - Integration test path: `src/tests/architect/*` for world switching + action -> history render assertions.

## C) Evidence Appendix

### Command Outputs (required set)
- `npm run validate:project` -> **PASS**
- `npm run build` -> **PASS** (non-blocking warnings: dynamic-import chunking + chunk size)
- `npm run emu` -> **PASS** (`All emulators ready!` with auth/functions/firestore/extensions)
- `npm run dev` -> **PASS** (`http://localhost:5173/`)
- `npm run test:architect -- --reporter=dot` -> **PASS** (`159 passed`, `2410 passed | 1 skipped | 3 todo`)
- `npm run test:trade -- --reporter=dot` -> **PASS** (`58 passed`, `532 passed | 1 skipped | 3 todo`)

### Key Runtime Logs / Values
- Trade attempt blocker:
  - `Trade blocked: Trade exception TPE-ATL-Feb 6, 2026-1 is expired`
  - `Apply Trade` rendered disabled.
- Cap mutation blocker:
  - `Failed to save waive/buyout action. Please try again.`
- Exception save blocker:
  - `Failed to save exceptions. Please fix issues and try again.`
- World scope evidence:
  - Base: `World: base-mode | Base events: 0 | Preview events: 0`
  - World A/B: `World: world_<id> | Base events: 0 | Preview events: 0` (changes on selector switch)
- Firestore state evidence for attempted action worlds:
  - `actionCount: 0`, `events: 0` for tested worlds (`THR1*` action-probe worlds).

## D) Fix Punchlist (NO FIXES IMPLEMENTED)

1. **Critical** — Trade apply blocked in world mode for tested flow
   - **Files:** `src/features/architect/GMDashboard/GMDashboard.jsx`, trade validation/persistence path rooted in `src/features/architect/utils/mutationPipeline.js`
   - **Acceptance criteria:** At least one legal two-team trade can be validated and applied in world mode; Team History shows corresponding entry and world `events` increments by 1+.

2. **Critical** — Waive / Waive&Stretch persistence fails
   - **Files:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
   - **Acceptance criteria:** Waive and Waive&Stretch both persist successfully (no failure toast/message), update world team snapshot, and create auditable history/event records.

3. **High** — Exception/entitlement save path fails in `Manage Exceptions`
   - **Files:** `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
   - **Acceptance criteria:** `Save Changes` succeeds for valid exception edits, persists in world scope, and emits history/event evidence for audited entitlement change.

4. **High** — Team History does not receive complete action coverage
   - **Files:** `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`, `src/features/architect/offseason/WaiveStretchTracker/WaiveStretchTracker.jsx`, `src/features/architect/offseason/DraftPickTracker/DraftPickTracker.jsx`, `src/features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.jsx`
   - **Acceptance criteria:** Trade, FA, cap actions, and entitlement edits each produce visible Team History entries with expected fields.

5. **High** — Free Agency completion path incomplete in tested flow
   - **Files:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`, `src/shared/components/EditContractModal.jsx` (action confirmation UX), FA surface components under `src/features/architect/freeAgency/`
   - **Acceptance criteria:** Sign Free Agent, Sign-and-Trade, and Offer Sheet Finalize each present executable confirmation flow and persist to world with history/event evidence.

6. **Medium** — Renounce action discoverability in tested UI path
   - **Files:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`, cap-sheet/full-cap UI components
   - **Acceptance criteria:** Renounce is discoverable from cap-hold/rights surfaces and can be executed end-to-end with persisted history/event output.

7. **Medium** — Team History detail-view UX missing
   - **Files:** `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx` + tracker components
   - **Acceptance criteria:** Clicking a history row opens usable detail with category, teams, key deltas, and timestamp/event reference.

8. **High** — Team History test coverage gap
   - **Files:** `src/tests/architect/*` (new tests), plus direct component test files for history trackers
   - **Acceptance criteria:** Add deterministic tests covering: world scoping, empty vs populated states, per-action history rendering, and no-regression checks for Team History fields.

9. **Low** — Architect full-player realtime subscription is unbounded
   - **Files:** `src/features/architect/utils/subscribeArchitectPlayerData.ts`
   - **Acceptance criteria:** Subscription strategy documented and performance-budgeted, or constrained/paginated where applicable.

## E) Closure Criteria
- TEAM_HISTORY can be marked `REVIEW_COMPLETE` only when all are true:
  1. Checklist items 1–9 are PASS (or explicitly accepted waivers documented).
  2. At least one successful example exists for each required action family:
     - trade apply
     - FA sign / sign-and-trade / offer sheet finalize
     - cap actions (extend, waive/stretch/buyout, renounce)
     - entitlement changes
  3. Team History shows non-empty, world-scoped entries with accurate deltas and ordering.
  4. Forbidden writes remain absent (`/teams` root and `architect_base*` not mutated).
  5. Team History-specific tests are added and passing.

---

### Return Package Metadata (AGENTS.md requirement)
- **Files changed:**  
  - `return_packages/architect_reviews/TEAM_HISTORY_R1_LOCAL_REVIEW_RETURN_PACKAGE.md`  
  - `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- **Validation commands actually run:**  
  - `npm run validate:project`  
  - `npm run build`  
  - `npm run emu`  
  - `npm run dev`  
  - `npm run test:architect -- --reporter=dot`  
  - `npm run test:trade -- --reporter=dot`
- **Commands intentionally skipped:**  
  - none
