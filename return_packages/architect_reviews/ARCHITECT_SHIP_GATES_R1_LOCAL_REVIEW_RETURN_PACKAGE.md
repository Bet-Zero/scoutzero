# ARCHITECT_SHIP_GATES_R1_LOCAL — Review Return Package

**Date:** 2026-03-04
**Mode:** REVIEW (docs-only; NO product code changes)
**Scope:** Ship Readiness gates for Architect world mode (Trade, Cap Sheet, Free Agency, Team History, Offseason)
**Overall Verdict:** **CONDITIONAL PASS** (all functional gates PASS; Gate F requires pre-ship security checklist — documented in Master Doc)

---

## Commands Run + Outcomes (Required Order)

| # | Command | Result |
|---|---------|--------|
| 1 | `npm run validate:project` | **PASS** — All validations passed |
| 2 | `npm run build` | **PASS** — Built in 33.92s (non-blocking warnings only: chunk size, browserslist, dynamic import) |
| 3 | `npm run test:trade -- --reporter=dot` | **PASS** — 58 files; 532 passed, 1 skipped, 3 todo |
| 4 | `npm run test:architect -- --reporter=dot` | **PASS** — 167 files; 2,449 passed, 1 skipped, 3 todo |

---

## Gate A: World Lifecycle (Critical)

### A1: Create World Flow — **PASS**

**Evidence:**
- `src/features/architect/utils/worldManager.js:65-126` — `createWorld()` generates unique worldId, creates metadata doc at `architect_worlds/{worldId}`, optionally links parent world via `arrayUnion`.
- Documents produced: world metadata (name, createdBy, createdAt, currentSeason), parent link. Team snapshots created lazily on first mutation.
- World-scoped isolation confirmed: all paths use `architect_worlds/{worldId}/...`.

### A2: Select World + Load Team State — **PASS**

**Evidence:**
- `src/features/architect/utils/worldTeamData.ts:81-106` — `loadWorldTeamData()` implements deterministic fallback chain:
  1. World snapshot at `architect_worlds/{worldId}/teams/{teamCode}`
  2. Parent world snapshot (recursive)
  3. Base team at `architect_baseTeams/{teamCode}`
- No null-crash surfaces: fallback chain guarantees a result or explicit error.

### A3: Refresh Shows Persisted State — **PASS**

**Evidence:**
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:895-923` — `syncTeamFromMutationResult()`:
  - Checks `result.changedTeams` for in-memory update.
  - If unavailable AND worldId exists, calls `loadWorldTeamData(worldId, teamCode)` for Firestore read.
  - Calls `refreshWorldRosterIndex()` to sync global state.
- No reliance on local-only state for committed actions.

---

## Gate B: Production Surface Hygiene

### B4: DEV-Only UI Paths Are Gated — **PASS**

**Evidence:**
- **Offseason Preview** (`src/features/architect/GMDashboard/sections/OffseasonSection.jsx:51-54`):
  - Gate: `import.meta.env.DEV` + `localStorage['hz.dev.offseasonPreview'] === 'true'`
  - Label: "DEV: single-team offseason preview" (line 186)
  - Warning: "Preview only — does not persist" (line 194)
  - Render gate: `{showDevPreview && (...)}` (line 178)
- **Team History Fixtures** (`src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx:199-202`):
  - Gate: `import.meta.env.DEV` + `localStorage['hz.dev.teamHistoryFixtures'] === 'true'`
  - Label: "Team History Fixtures (DEV)" (line 239)
  - Disclaimer: "Injects deterministic in-memory history entries only (no Firestore writes)" (lines 242-243)
- Both gates are tree-shaken in production builds (`import.meta.env.DEV` is `false`).

### B5: Preview UI Explicitly Labeled — **PASS**

**Evidence:**
- Offseason single-team preview: "Preview only — does not persist" banner + "Preview computed — not saved" success language.
- Team History fixtures: "in-memory history entries only (no Firestore writes)" disclaimer.
- No non-persisted UI can be confused with real committed actions.

---

## Gate C: Persistence Truth UX

### C6: Success Only on Persistence; Failure Shows Error — **PASS**

**Evidence:**
- **Truth evaluation** (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:750-801`):
  - `evaluateMutationTruth()` requires ALL THREE:
    - `eventsWritten > 0` (world event logged)
    - `worldMetadataPatched > 0` (world doc updated)
    - `teamsPatched > 0` (at least one team written)
  - `persistedToWorld` is `true` ONLY when all three conditions met.
- **Success toast** (lines 847-849): Only fires when `truth.ok === true` (which requires `persistedToWorld === true`).
- **Failure toast** (lines 851-862): Shows `toast.error()` with descriptive message. Does NOT update local state on failure.
- **Pipeline source** (`src/features/architect/utils/mutationPipeline.js:1420-1460`): `applyWorldMutation` returns `persistedToWorld: true` ONLY after `persistWorldMutation()` succeeds. Fails closed otherwise.

**Action family coverage:**
| Action | Pipeline Path | Toast Gated | Event Emitted |
|--------|--------------|-------------|---------------|
| Trade | `applyWorldMutation('executeTrade')` | Yes | Yes |
| Sign FA | `applyWorldMutation('signFreeAgent')` | Yes | Yes |
| Sign & Trade | `applyWorldMutation('signAndTrade')` | Yes | Yes |
| Waive | `applyWorldMutation('waivePlayer')` | Yes | Yes |
| Renounce | `applyWorldMutation('renounceRights')` | Yes | Yes |
| Extend | `applyWorldMutation('extendPlayer')` | Yes | Yes |
| Set Exceptions | `applyWorldMutation('setExceptions')` | Yes | Yes |
| Use TPE | `applyWorldMutation('useTradeException')` | Yes | Yes |
| Season Advance | `advanceSeasonInWorld()` (separate path) | Yes | Yes |

---

## Gate D: History Auditability

### D7: Every Action Emits World Event with Required Fields — **PASS**

**Evidence:**
- **Event emission** (`src/features/architect/utils/mutationPipeline.js:3621-3668`):
  - Event ID: `${mutationType}_${timestamp}_${randomSuffix}`
  - Collection path: `architect_worlds/{worldId}/events/`
  - Atomic: event written in same `writeBatch` as team/player/entitlement changes.
- **Event payload** (`mutationPipeline.js:1031-1113` — `buildWorldMutationEventPayload()`):
  - `occurredAt`: ISO timestamp
  - `teamCodes` / `teamsAffected`: involved teams
  - `playerIds`: involved players
  - `diffSummary`: picksMoved, playersMoved, etc.
  - `mutationMetadata`: contract summaries, rights/exception usage, waive flags
  - `capDeltas`: beforeTotalsByTeam / afterTotalsByTeam
- **Rendering** (`src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`):
  - Timeline rows: timestamp (line 142), category (144), type (145), summary (146)
  - Detail modal (lines 361-364): structured detail sections + raw payload
  - Pagination: load-more button (lines 176-185) with `hasMore` tracking
- **Normalization** (`src/features/architect/history/normalizeWorldEventsForTeamHistory.ts`):
  - All mutation families mapped: trade (227-405), FA (407-439), waive/renounce (441-484), exceptions (486-517)
  - Format labels in `formatMutationLabel()` (mutationPipeline.js:124-153)
- **Season advance** (`src/features/architect/utils/seasonManager.js`): emits `seasonAdvance` event with Team History-compatible fields.

---

## Gate E: Data Safety Boundaries (Critical)

### E8: No Write Path Touches `/teams` Root or `architect_base*` — **PASS**

**Evidence:**
- **Mutation pipeline** (`mutationPipeline.js:3526` — `persistWorldMutation()`):
  - `architect_worlds/{worldId}/teams/{teamCode}` — batch.set()
  - `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` — batch.set()
  - `architect_worlds/{worldId}/entitlements/{entitlementId}` — batch.set() (merge=true)
  - `architect_worlds/{worldId}/events/{eventId}` — batch.set()
  - `architect_worlds/{worldId}` metadata — batch.update()
- **Path helpers** (`src/features/architect/utils/architectFirestorePaths.ts:79-159`): All helpers produce `architect_worlds/{worldId}/...` paths. No root `/teams` or `architect_base*` paths in write operations.
- **Collection constants** (`src/constants/collections.ts:32-67`): Centralized; no hardcoded collection strings.

### E9: All Reads from Base Are Read-Only by Convention — **PASS**

**Evidence:**
- Base collections (`architect_basePlayers`, `architect_baseTeams`, `architect_baseEntitlements`, `architect_basePickRules`) used only as fallback read sources in `worldTeamData.ts` fallback chain.
- AGENTS.md explicitly prohibits writes: "agents must never write to these."
- No `setDoc`/`updateDoc`/`addDoc` calls target base collection paths.

### E10: Non-Pipeline Write Paths Justified — **PASS**

**Evidence:**
- **Season advance** (`src/features/architect/utils/seasonManager.js:219-268`):
  - Uses `writeBatch()` with same world-scoped paths as mutation pipeline.
  - Applies `normalizeTeamTpeSchema()` before batch.set() (same sanitization chain).
  - Emits world event atomically in same batch.
  - **Justified**: season advance changes ALL 30 teams simultaneously — cannot use single-mutation pipeline pattern.
- **Entitlement writer** (`src/features/architect/utils/entitlements/entitlementWriter.ts`):
  - Feature-gated by `VITE_FEATURE_ENTITLEMENT_AUTHORING`.
  - ONLY writes to `architect_worlds/{worldId}/entitlements/{entitlementId}`.
  - **Justified**: Admin tool for direct entitlement CRUD; atomic per-document operations.
- **World manager** (`src/features/architect/utils/worldManager.js:14-260`):
  - Only writes world metadata (`architect_worlds/{worldId}`) and parent childWorlds array.
  - **Justified**: Metadata-only operations (create, rename, link).
- **Pre-persistence sanitization** (`mutationPipeline.js:3541-3668`): Multi-layer chain (sanitizeTransientFields → normalizeTeamTpeSchema → assertPersistableOrThrow → removeUndefinedDeep) applied before ALL writes.

---

## Gate F: Security Readiness

### F11: Firestore Rules Status — **CONDITIONAL PASS**

**Evidence:**
- **Current state**: DEV-OPEN (`firestore.rules:66-69`):
  ```
  match /{document=**} {
    allow read, write: if true;
  }
  ```
- **Planned secure rules** (lines 18-64): Ownership-scoped rules for `lists` and `tierLists` exist but are commented out. Rules check `resource.data.ownerUid == request.auth.uid` with auto-claim for missing ownerUid.
- **Prerequisites documented** (lines 6-16):
  1. Anonymous auth (or real auth) enabled in Firebase console
  2. All existing list/tierList docs have ownerUid set
  3. Deploy with: `firebase deploy --only firestore:rules`
- **Auth patterns in codebase**: `useAuth()` hook present; userId extracted and used in mutations. However, rules do NOT currently enforce ownership.

**Verdict**: CONDITIONAL PASS — DEV-open is acceptable per review spec because:
1. Prerequisites are documented in-file (lines 6-16)
2. Secure rules are architecturally ready (lines 18-64)
3. **Pre-ship security checklist created in ARCHITECT_SHIP_GATES_MASTER.md** with exact steps required before launch

**Missing (addressed in Master Doc)**:
- `architect_worlds` collection rules (not yet drafted — needs world-level ownership scoping)
- ownerUid migration verification
- Rate limiting consideration

---

## Gate G: Performance Sanity

### G12: No Unbounded Listeners on Core Tabs — **PASS**

**Evidence:**
- **Team History**: Uses `getDocs` with `limit()`, not `onSnapshot`. No unbounded listeners.
- **World events** (`src/features/architect/history/hooks/useWorldTeamEvents.ts:85-87`): `limitTo(queryLimit)` injected into query.
- **Trade/Cap/FA/Offseason tabs**: Load team data via `loadWorldTeamData()` (one-time reads), not real-time listeners.
- `subscribeArchitectPlayerData.ts`: One-time full query of `architect_basePlayers` — acceptable for initialization, not looped.

### G13: Pagination Exists for History — **PASS**

**Evidence:**
- `useWorldTeamEvents.ts:20` — `DEFAULT_LIMIT = 50`
- `TeamHistoryTab.jsx:176-185` — Load More button with `hasMore` flag
- `useWorldTeamEvents.ts:261-293` — `startAfter` pagination using last document cursor

---

## Gate H: Deterministic Evidence

### H14: Each Gate Cites File/Function Pointers and/or Tests — **PASS**

**Evidence summary:**

| Gate | File Pointers | Test Coverage |
|------|---------------|---------------|
| A (World Lifecycle) | worldManager.js, worldTeamData.ts, useArchitectActions.ts | phase83 E2E emulator, phaseD DARE integration |
| B (Prod Surface) | OffseasonSection.jsx:51-54, TeamHistoryTab.jsx:199-202 | OFFSEASON_E1 source-level guardrail test |
| C (Persistence Truth) | useArchitectActions.ts:750-862, mutationPipeline.js:1420-1460 | phase50, 60, 79, 80, 83 (persist-reload parity) |
| D (History) | mutationPipeline.js:1031-1113, 3621-3668, TeamHistoryTab.jsx | E3 matrix guardrail, E4/E5 enrichment tests |
| E (Data Safety) | mutationPipeline.js:3526+, architectFirestorePaths.ts, collections.ts | phase60 (no-leak), AC2 (write-path guardrail) |
| F (Security) | firestore.rules:1-69 | N/A (pre-ship checklist documented) |
| G (Performance) | useWorldTeamEvents.ts:20,85-87, TeamHistoryTab.jsx:176-185 | N/A (query structure verified by code review) |

**Test totals (this run):**
- `test:trade`: 58 files, 532 passed, 1 skipped, 3 todo
- `test:architect`: 167 files, 2,449 passed, 1 skipped, 3 todo
- **14 completed prior review cycles** with return packages

---

## STOP Conditions

| # | Condition | Verdict | Evidence |
|---|----------|---------|----------|
| 1 | Any success shown without world persistence | **PASS** | `evaluateMutationTruth()` enforces 3-part contract (events + metadata + teams). Toast only on `persistedToWorld === true` |
| 2 | Any write touches root `/teams` or `architect_base*` | **PASS** | All write paths verified world-scoped via `architectFirestorePaths.ts` helpers. No base collection writes found |
| 3 | Any DEV-only tool visible in production surface | **PASS** | Offseason preview + TeamHistory fixtures gated by `import.meta.env.DEV` (tree-shaken in prod) + localStorage flags |
| 4 | Any committed action lacks world event emission | **PASS** | All mutation families emit events atomically in same `writeBatch`. Fail-closed contract requires `eventsWritten > 0` |
| 5 | Any world lifecycle step is broken/null-crashy | **PASS** | Create (worldManager.js), select (worldTeamData.ts fallback chain), refresh (syncTeamFromMutationResult) all verified |

---

## Overall Verdict

**CONDITIONAL PASS**

All functional ship gates (A through E, G, H) **PASS** with deterministic evidence.

Gate F (Security Readiness) is a **CONDITIONAL PASS**: Firestore rules are DEV-OPEN, which is acceptable per the review spec provided that:
1. The dev-open state is explicitly documented (it is — `firestore.rules:6-16`)
2. An explicit pre-ship checklist exists (created in `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`)

**Ship-blocking action items** are documented in the Master Doc's Pre-Ship Security Checklist.

---

## Files Changed

- `return_packages/architect_reviews/ARCHITECT_SHIP_GATES_R1_LOCAL_REVIEW_RETURN_PACKAGE.md` (this file — CREATED)
- `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md` (CREATED)
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md` (APPENDED)

## Validation Commands Run

- `npm run validate:project` — PASS
- `npm run build` — PASS
- `npm run test:trade -- --reporter=dot` — PASS (532 passed)
- `npm run test:architect -- --reporter=dot` — PASS (2,449 passed)

## Commands Intentionally Skipped

- None. All 4 required commands were run in specified order.
