# OFFSEASON_R1_LOCAL — REVIEW RETURN PACKAGE

**Date:** 2026-03-03
**Status:** FAIL (10 PASS / 2 FAIL / 0 BLOCKED)

---

## Executive Summary

The Offseason tab has **two distinct operational pathways** — a critical architectural finding:

1. **World-wide path** (SeasonAdvanceModal -> `advanceSeasonInWorld()` in `seasonManager.js`): Full Firestore persistence via `writeBatch`, world event emission, post-state cap legality validation, OSTE computation, TPE normalization, DARE entitlement lifecycle. **This path is production-ready.**
   [text](vscode-webview://0nrob4mbnoh5d84kuqligt3cfkl3s1ljud1ffnshfke9t023msme/return_packages/architect_reviews/OFFSEASON_R1_LOCAL_REVIEW_RETURN_PACKAGE.md)
2. **Single-team path** (OffseasonTab -> `runOffseason()` -> `resolveOffseasonTransition()`): Computes correct offseason state via OSTE but **only updates React state**. No Firestore write. No event emission. Changes are lost on refresh. **This is STOP CONDITION #1: actions claim success but do not persist.**

### STOP CONDITIONS Detected

| #   | Condition                                             | Detected?                                        |
| --- | ----------------------------------------------------- | ------------------------------------------------ |
| 1   | Actions claim success but do not persist              | **YES** — Single-team OffseasonTab path          |
| 2   | Write path touches root `/teams` or `architect_base*` | No                                               |
| 3   | Actions reachable in base mode that mutate/persist    | No (world controls gated by `worldId`)           |
| 4   | Actions that should be logged have no event emission  | **YES** — Single-team path has no event emission |
| 5   | UI controls exist but do nothing / are dead           | No (all controls are functional)                 |

---

## A) Scope Inventory

### Tab Routing

- **GMDashboard.jsx:253-262** — `Offseason` tab button with `setActiveTab('offseason')`.
- **GMDashboard.jsx:342-358** — Renders `OffseasonSection` when `activeTab === 'offseason'`.

### Components

| Component           | File                                                                    | Purpose                                                                  |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| OffseasonSection    | `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`      | Wrapper: world-wide season advance + draft positions + single-team tools |
| OffseasonTab        | `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`        | Single-team offseason workflow (option decisions -> advance)             |
| OptionManager       | `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`       | Collects player/team option exercise/decline decisions                   |
| SeasonAdvanceModal  | `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`  | 5-step wizard for world-wide season advance                              |
| DraftPositionsInput | `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx` | JSON input for real draft positions (Phase 5)                            |

### Utilities

| Utility                                | File                                                                   | Purpose                                         |
| -------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| runOffseason                           | `src/features/architect/utils/runOffseason.js`                         | Thin wrapper calling OSTE (no persistence)      |
| resolveOffseasonTransition             | `src/features/architect/utils/offseason/resolveOffseasonTransition.ts` | OSTE engine (1,060 lines) — pure computation    |
| advanceSeasonInWorld                   | `src/features/architect/utils/seasonManager.js:613`                    | World-wide season advance with full persistence |
| processTeamSeasonTransitionWithOptions | `src/features/architect/utils/seasonManager.js`                        | Per-team transition within world advance        |

### Related Mutation Handlers (via useArchitectActions.ts)

| Handler              | Line | Mutation Type    | Notes                                                              |
| -------------------- | ---- | ---------------- | ------------------------------------------------------------------ |
| handleOptionDecision | 2765 | `optionDecision` | Exercise/decline via individual action (not batch offseason)       |
| handleWaiveContract  | 2601 | `waivePlayer`    | Waive/stretch/buyout (reachable from cap sheet, not offseason tab) |
| handleRenounceRights | 2951 | `renounceRights` | Renounce Bird rights (reachable from cap sheet, not offseason tab) |

---

## B) PASS/FAIL Checklist

### 1) UI Wiring (No dead UI) — PASS

**Evidence:**

- **Offseason tab button**: `GMDashboard.jsx:253-262` — renders clickable button, toggles `activeTab` state.
- **OffseasonSection renders**: `GMDashboard.jsx:342-358` — passes all required props.
- **World Season Advance button**: `OffseasonSection.jsx:142-148` — gated by `worldId`, opens `SeasonAdvanceModal`.
- **SeasonAdvanceModal wizard**: 5 steps (SUMMARY -> OPTIONS -> CONFIRMATION -> PROCESSING -> COMPLETE) with Back/Next/Advance/Done buttons — all wired to state transitions.
- **OptionManager table**: `OptionManager.jsx:90-140` — renders player rows with toggle buttons ("Accept"/"Decline") and "Confirm Decisions" submit button.
- **DraftPositionsInput**: `DraftPositionsInput.jsx` — Validate, Save, Reset to Template buttons, all wired to handlers.
- **Single-team "Advance to {year}" button**: `OffseasonTab.jsx:86-91` — appears after options confirmed, calls `handleAdvanceYear`.
- **Offseason summary modal**: `GMDashboard.jsx:377-435` — renders declined options, expired contracts, TPEs, dead cap, MLE reset.

All controls are stateful and trigger real handler functions. No dead UI detected.

### 2) Purpose & SSOT — PASS

**Purpose** (determined from code):

The Offseason tab serves two functions:

1. **Season advance**: Transition the world (all 30 teams) or a single team from one season to the next. This processes contract expirations, option decisions, cap hold creation, exception lifecycle (MLE/TPE/BAE/DPE reset/expiry), hard cap clearing, dead money advancement, draft pick updates, and totals recomputation.
2. **Draft positions input** (Phase 5): Enter real-world draft positions to enable auto-resolution of pick swaps and conveyance during season advance via DARE (Draft Asset Resolution Engine).

**SSOT**:

- **World team state**: `architect_worlds/{worldId}/teams/{teamCode}` — team cap sheets post-transition.
- **World events**: `architect_worlds/{worldId}/events/{eventId}` — `seasonAdvance` mutation event with full audit payload.
- **World metadata**: `architect_worlds/{worldId}` — `currentSeason` field updated on advance.
- **Draft positions**: `architect_worlds/{worldId}` subpath — `draftPositionsByYear.{year}` (written by `DraftPositionsInput`).

### 3) World Gating & Boundary — PASS

**Evidence:**

- World-wide controls (Advance Season button, DraftPositionsInput) gated by `{worldId && (...)}` at `OffseasonSection.jsx:116,154`.
- SeasonAdvanceModal checks `if (!worldId)` at line 338 and shows explicit error message.
- Single-team OffseasonTab always renders (no world gate) but only updates local React state — no Firestore writes in base mode.
- `advanceSeasonInWorld()` at `seasonManager.js:614` returns `{ success: false, error: 'worldId is required' }` if worldId missing.
- Season mismatch guard at `seasonManager.js:638-656` prevents desync between UI year and world metadata.

No base-mode mutations that persist state.

### 4) Transactions / Mutations Reachability — FAIL

**World-wide path mutations:**

| Action                 | UI Trigger                                 | Handler Chain                                                                                                                                      | Persists? | Event?                |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------- |
| Season Advance (world) | SeasonAdvanceModal "Advance Season" button | `handleAdvanceSeason()` -> dynamic import `advanceSeasonInWorld()` -> `processTeamSeasonTransitionWithOptions()` per team -> `writeBatch.commit()` | YES       | YES (`seasonAdvance`) |
| Draft Positions Save   | DraftPositionsInput "Save" button          | `saveDraftPositions(worldId, year, map)`                                                                                                           | YES       | N/A (config data)     |

**Single-team path mutations:**

| Action                  | UI Trigger                              | Handler Chain                                                                                      | Persists? | Event? |
| ----------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- | --------- | ------ |
| Season Advance (single) | OffseasonTab "Advance to {year}" button | `handleAdvanceYear()` -> `runOffseason()` -> `resolveOffseasonTransition()` -> `setTeamCapSheet()` | **NO**    | **NO** |

**FAIL reason**: `OffseasonTab.jsx:42-63` — `handleAdvanceYear()` calls `runOffseason()` which returns `{ updatedCapSheet, summary }`. The component then calls `setTeamCapSheet(updatedCapSheet)` — pure React state update. No `persistWorldMutation`, no `advanceSeasonInWorld`, no Firestore batch write. The UI shows "Offseason Complete!" but nothing is saved.

```javascript
// OffseasonTab.jsx:42-63 — THE NON-PERSISTING PATH
const handleAdvanceYear = async () => {
  setIsLoading(true);
  try {
    setLastCapSheet(JSON.parse(JSON.stringify(teamCapSheet)));
    const { updatedCapSheet, summary } = runOffseason(
      teamCapSheet, currentYear, capProjections, optionDecisions || {}
    );
    setTeamCapSheet(updatedCapSheet);  // <-- React state only!
    setCurrentYear(currentYear + 1);
    setOffseasonSummary(summary);
    setShowOffseasonModal(true);
    setOffseasonRun(true);  // <-- Shows "Offseason Complete!" with no persistence
  } catch (err) { ... }
};
```

### 5) Persistence Truth — FAIL

**World-wide path** (PASS):

- `seasonManager.js:675` — `writeBatch(db)` created.
- `seasonManager.js:746-758` — Per team: `stripHydrationOnlyFields` -> `sanitizeTransientFieldsForPersistence` -> `normalizeTeamTpeSchema` -> `assertPersistableOrThrow` -> `removeUndefinedDeep` -> `batch.set(snapshotRef, safeTeam)`.
- `seasonManager.js:877-883` — World metadata updated: `currentSeason`, `lastModifiedAt`, `lastModifiedTeams`, `actionCount`.
- `seasonManager.js:893-943` — Event document written with full `CapAuditEventV1` payload.
- `seasonManager.js:945` — `batch.commit()` — atomic commit.
- Write targets: `architect_worlds/{worldId}/teams/{teamCode}`, `architect_worlds/{worldId}` (metadata), `architect_worlds/{worldId}/events/{eventId}`.

**Single-team path** (FAIL):

- `runOffseason.js:25-34` — Pure computation via `resolveOffseasonTransition()`. Returns `{ updatedCapSheet, summary }`.
- `OffseasonTab.jsx:53` — `setTeamCapSheet(updatedCapSheet)` — React state only.
- No `writeBatch`, no `setDoc`, no `updateDoc`, no `batch.commit()` in the call chain.
- No event emission.

**FAIL reason**: Single-team path produces a "saved-on-no-op" behavior — shows success UI ("Offseason Complete!") without any Firestore write.

### 6) Cap/Rules Effects — PASS

**OSTE (resolveOffseasonTransition.ts) handles all cap transitions:**

| Effect                 | Implementation                                                                 | Lines                    |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------ |
| Option exercise        | Marks `optionUsed: true`, keeps player on roster                               | 637-797                  |
| Option decline         | Removes future years, creates cap hold, removes from roster                    | 637-797                  |
| Contract expiration    | Removes expired players from roster/players arrays                             | 799-840                  |
| Cap hold creation      | `calculateCapHold()` for expired/declined players with Bird rights multipliers | 842-881                  |
| Contract advancement   | Decrements `yearsRemaining`, filters salary rows                               | 885-903                  |
| Dead money advancement | Increments dead cap years forward                                              | 905-908                  |
| MLE/BAE/TPMLE reset    | `resetTeamNonTpeExceptionsForNewSeason()`                                      | 910-1001                 |
| TPE expiration         | Checks 1-year expiry window, removes expired                                   | 910-1001                 |
| DPE clearing           | Resets disabled player exception                                               | 910-1001                 |
| Hard cap clearing      | Clears hard cap state for new season                                           | Post-exception           |
| Totals recompute       | `computeTeamCapTotals()` with `toYear` year key                                | seasonManager.js:336-337 |

Both paths use the same OSTE engine for computation. The world-wide path additionally runs `computeTeamCapTotals()` at `seasonManager.js:743-744` and persists the result.

### 7) Team History Compatibility — PASS

**Evidence**: World-wide `advanceSeasonInWorld()` emits a `seasonAdvance` event at `seasonManager.js:901-935` with full CapAuditEventV1 envelope:

```javascript
const eventPayload = {
  eventId,
  type: 'seasonAdvance',
  timestamp: occurredAt,
  seasonId: toSeason,
  metadata: {
    type: 'seasonAdvance',
    timestamp: occurredAt,
    fromSeason,
    toSeason,
    teamsInvolved: teamCodes,
  },
  teamsAffected: teamCodes,
  schemaVersion: 'cap-audit-event-v1',
  validatorVersion: POST_STATE_CAP_VALIDATOR_VERSION,
  operationId,
  mutationType: 'seasonAdvance',
  occurredAt,
  worldId,
  teamCodes,
  playerIds: [],
  beforeTotalsByTeam,
  afterTotalsByTeam,
  valid: postStateValidation.valid,
  violations: postStateValidation.violations,
  warnings: postStateValidation.warnings,
  diffSummary,
  mutationMetadata: {
    mutationType: 'seasonAdvance',
    category: 'offseason',
    worldId,
    teams: teamCodes,
    players: [],
  },
};
```

Team History's `useWorldTeamEvents` hook filters by `teamCodes` array, and `seasonAdvance` is a recognized mutation type in the display normalizer (confirmed in TEAM_HISTORY_E4/E5 work).

### 8) Safety Gates / Validation — PASS

**Evidence:**

| Gate                       | Location                              | Behavior                                                               |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| worldId required           | `seasonManager.js:614`                | Returns `{ success: false }`                                           |
| Season mismatch guard      | `seasonManager.js:638-656`            | Returns error if caller's fromSeason/toSeason conflicts with worldMeta |
| Post-state cap legality    | `seasonManager.js:763-783`            | `validatePostStateCapLegality()` — blocks advance on violations        |
| Persistence contracts      | `seasonManager.js:752-756`            | `assertPersistableOrThrow()` — throws if team doc fails contract       |
| Event persistence contract | `seasonManager.js:937-941`            | `assertPersistableOrThrow()` for event doc                             |
| OSTE violations            | `resolveOffseasonTransition.ts:1002+` | Violations block (`success: false`), warnings pass through             |
| DARE gated persistence     | `seasonManager.js:823-835`            | Entitlement invariant violations block season advance                  |
| Single-team OSTE errors    | `runOffseason.js:36-43`               | Throws error with `result.violations[0].message`                       |

All gates are fail-closed (block on failure, not warn-only).

### 9) Forbidden Writes Rule — PASS (CRITICAL)

**Evidence:**

```
grep -r "architect_base" seasonManager.js → No matches
grep -r '"teams"' seasonManager.js → No matches
```

All write operations in `seasonManager.js`:

- `worldTeamRef(worldId, teamCode)` -> `architect_worlds/{worldId}/teams/{teamCode}` (line 746)
- `worldMetadataRef(worldId)` -> `architect_worlds/{worldId}` (line 877)
- Event ref -> `architect_worlds/{worldId}/events/{eventId}` (line 894-900)

All write operations in `runOffseason.js`: **None** (pure computation).

All write operations in `resolveOffseasonTransition.ts`: **None** (pure computation).

`architectFirestorePaths.ts` confirms:

- `worldTeamRef` -> `doc(db, ARCHITECT_WORLDS_COLLECTION, worldId, 'teams', teamCode)`
- `worldMetadataRef` -> `doc(db, ARCHITECT_WORLDS_COLLECTION, worldId)`

No root `/teams` or `architect_base*` writes anywhere in the Offseason code paths.

### 10) Error Handling / Edge Cases — PASS

| Scenario                     | Behavior                                                                    | Location                         |
| ---------------------------- | --------------------------------------------------------------------------- | -------------------------------- |
| worldId missing (world path) | Returns `{ success: false, error: 'worldId is required' }`                  | `seasonManager.js:614-616`       |
| worldId missing (modal)      | Shows "No world selected" error in UI                                       | `SeasonAdvanceModal.jsx:338-342` |
| currentSeason missing        | Returns `{ success: false, error: 'World metadata missing currentSeason' }` | `seasonManager.js:629-631`       |
| Season mismatch              | Returns error with both attempted and actual season                         | `seasonManager.js:638-656`       |
| OSTE validation failure      | Throws error with violation message                                         | `runOffseason.js:36-43`          |
| Post-state cap violation     | Returns `{ success: false, violations }` — blocks batch commit              | `seasonManager.js:776-783`       |
| Persistence contract failure | Throws — blocks batch commit                                                | `seasonManager.js:752-756`       |
| DARE failure (non-blocking)  | Logs warning, continues advance                                             | `seasonManager.js:850-854`       |
| DARE invariant violation     | Throws — blocks season advance                                              | `seasonManager.js:862-868`       |
| Single-team error            | Catches, sets `error` state, displays in UI                                 | `OffseasonTab.jsx:58-60`         |

### 11) Performance Footguns — PASS

**World-wide path:**

- `getLeague(worldId)` loads all 30 teams once (single query).
- Teams processed sequentially in a `for...of` loop (no parallel Firestore reads per team).
- Single `writeBatch` for all 30 teams + metadata + event — one atomic commit.
- No unbounded subscriptions (this is a one-shot operation triggered by button click).

**Single-team path:**

- Processes one team's cap sheet in memory. No Firestore operations.

**DraftPositionsInput:**

- Single `getDoc` on load, single `setDoc` on save. No subscriptions.

**OffseasonSection:**

- `useEffect` fetches `worldMetadata` on `worldId` change — single read, not a subscription.

No unbounded queries, no expensive loops, no recompute churn detected.

### 12) Tests — PASS

**Dedicated offseason test files:**

| Test File                                                              | Lines | Coverage                                                                                 |
| ---------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts` | 241   | OSTE core: option exercise/decline, expirations, cap holds, exception resets, TPE expiry |
| `src/tests/architect/oste_validation_unification_e1_1.test.js`         | ~100  | Hard cap ordering fix, contract row validation                                           |
| `tests/trade/jan15_offseason_timing.test.js`                           | ~50   | Jan 15 gate on offseason S&T timing                                                      |

**Season advance / integration test files (16 files touching offseason):**

| Test File                                                                           | Coverage                       |
| ----------------------------------------------------------------------------------- | ------------------------------ |
| `tests/architect/seasonManager.test.js`                                             | Season advance core logic      |
| `phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.js` | Exception lifecycle in advance |
| `phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.js`       | Totals recompute parity        |
| `seasonAdvance_postStateValidator_failClose.behavior.test.ts`                       | Post-state validation blocks   |
| `dare/phaseD_e2e_trade_then_advance_smoke.test.js`                                  | Trade + advance e2e            |
| `dare/phaseB_dare_world_persistence_integration.test.js`                            | DARE entitlement persistence   |
| `worldOptimistic_postStateValidator_blocks_violation.behavior.test.ts`              | Optimistic lock + validation   |
| `contractOptionUsed.test.js`                                                        | Option exercise mechanics      |
| `renounceRights.test.js`                                                            | Renounce rights mutation       |

**Test results:**

- `npm run test:architect -- --reporter=dot` -> PASS (165 files; 2437 passed, 1 skipped, 3 todo)
- `npm run test:trade -- --reporter=dot` -> PASS (58 files; 532 passed, 1 skipped, 3 todo)

---

## C) Evidence Appendix

### C1: Tab Rendering Proof

`GMDashboard.jsx:253-262`:

```jsx
<button
  onClick={() => setActiveTab('offseason')}
  className={`px-4 py-2 rounded-md text-sm font-semibold ${
    activeTab === 'offseason'
      ? 'bg-lakers/90 text-black'
      : 'bg-white/10 hover:bg-white/20'
  }`}
>
  Offseason
</button>
```

### C2: Single-Team Non-Persistence Proof

`OffseasonTab.jsx:42-63`:

```javascript
const handleAdvanceYear = async () => {
  setIsLoading(true);
  setError('');
  try {
    setLastCapSheet(JSON.parse(JSON.stringify(teamCapSheet)));
    const { updatedCapSheet, summary } = runOffseason(
      teamCapSheet,
      currentYear,
      capProjections,
      optionDecisions || {}
    );
    setTeamCapSheet(updatedCapSheet); // React state only
    setCurrentYear(currentYear + 1); // React state only
    setOffseasonSummary(summary);
    setShowOffseasonModal(true);
    setOffseasonRun(true);
  } catch (err) {
    console.error('Failed to advance offseason', err);
    setError(err?.message || 'Failed to advance offseason');
  } finally {
    setIsLoading(false);
  }
};
```

`runOffseason.js` — full file (no Firestore imports, no write calls):

```javascript
import { resolveOffseasonTransition } from '@/features/architect/utils/offseason';
export function runOffseason(
  teamCapSheet,
  currentYear,
  capProjections,
  optionDecisions = {}
) {
  const result = resolveOffseasonTransition({
    teamCapSheet,
    fromYear: currentYear,
    toYear: currentYear + 1,
    optionDecisions,
    context: { capProjections, teamCode: teamCapSheet?.teamCode },
  });
  if (!result.success) {
    throw error;
  }
  return {
    updatedCapSheet: result.nextTeamCapSheet,
    summary: result.appliedChangesSummary,
  };
}
```

### C3: World-Wide Persistence Proof

`seasonManager.js:675,746-758,877-883,893-943,945`:

```javascript
const batch = writeBatch(db);                    // line 675
// Per team:
batch.set(snapshotRef, safeTeam);                // line 758
// Metadata:
batch.update(metadataRef, { currentSeason, ... });  // line 878
// Event:
batch.set(eventRef, safeEvent);                  // line 943
// Commit:
await batch.commit();                            // line 945
```

### C4: Forbidden Writes Search

```
$ rg "architect_base" src/features/architect/utils/seasonManager.js
(no results)

$ rg "architect_base" src/features/architect/utils/runOffseason.js
(no results)

$ rg "architect_base" src/features/architect/utils/offseason/resolveOffseasonTransition.ts
(no results)

$ rg '"teams"' src/features/architect/utils/seasonManager.js
(no results)

$ rg 'setDoc|updateDoc|deleteDoc' src/features/architect/utils/runOffseason.js
(no results)

$ rg 'setDoc|updateDoc|deleteDoc' src/features/architect/offseason/
(no results)
```

### C5: Validation Commands

```
$ npm run validate:project
✅ All validations passed!

$ npm run build
✓ built in 25.54s (non-blocking warnings only)

$ npm run test:architect -- --reporter=dot
Test Files  165 passed (165)
     Tests  2437 passed | 1 skipped | 3 todo (2441)

$ npm run test:trade -- --reporter=dot
Test Files  58 passed (58)
     Tests  532 passed | 1 skipped | 3 todo (536)
```

---

## D) Fix Punchlist (NO FIXES IMPLEMENTED)

### FAIL #4/#5: Single-team OffseasonTab has no persistence or event emission

**Symptom**: `OffseasonTab.jsx:42-63` calls `runOffseason()` -> `resolveOffseasonTransition()` which computes correct offseason state via OSTE. The component then calls `setTeamCapSheet(updatedCapSheet)` (React state only). UI shows "Offseason Complete!" but nothing is written to Firestore. Changes are lost on page refresh.

**Root cause**: `runOffseason.js` is a pure computation wrapper over OSTE. It was designed for local preview/computation but was never wired to any Firestore persistence path (`persistWorldMutation` or `advanceSeasonInWorld`).

**Where in code**:

- `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx:42-63`
- `src/features/architect/utils/runOffseason.js` (entire file — no Firestore imports)

**Fix options**:

1. **Remove single-team path** — Consolidate into SeasonAdvanceModal only. Remove OffseasonTab + OptionManager from OffseasonSection, or hide them behind a "preview" label.
2. **Wire single-team path through advanceSeasonInWorld** — Pass `worldId` to OffseasonTab and call `advanceSeasonInWorld(worldId, { optionDecisions })` instead of `runOffseason()`.

**Recommended**: Option 1 (remove single-team path). The SeasonAdvanceModal already provides the same option-decision workflow with proper persistence, and having two paths creates confusion about which one is authoritative.

**Acceptance criteria**:

- Offseason season advance must either persist to Firestore AND emit a world event, OR the non-persisting UI path must be removed/disabled.
- No "Offseason Complete!" message should appear without successful Firestore persistence.

---

## E) Closure Criteria

| #   | Criterion                           | Status                  |
| --- | ----------------------------------- | ----------------------- |
| 1   | All UI controls verified functional | PASS                    |
| 2   | Purpose and SSOT documented         | PASS                    |
| 3   | World gating verified               | PASS                    |
| 4   | All mutations traced to persistence | FAIL — single-team path |
| 5   | Persistence truth verified          | FAIL — single-team path |
| 6   | Cap/rules effects verified          | PASS                    |
| 7   | Team History compatibility verified | PASS                    |
| 8   | Safety gates verified               | PASS                    |
| 9   | Forbidden writes verified           | PASS                    |
| 10  | Error handling verified             | PASS                    |
| 11  | Performance footguns checked        | PASS                    |
| 12  | Test coverage verified              | PASS                    |

**To close**: Fix items in Fix Punchlist (FAIL #4/#5), then re-review as OFFSEASON_R2_LOCAL.

---

## F) AGENTS Return Package Metadata

### Files Changed

- `return_packages/architect_reviews/OFFSEASON_R1_LOCAL_REVIEW_RETURN_PACKAGE.md` (created)
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md` (appended)

### Commands Run

| Command                                    | Result                                           |
| ------------------------------------------ | ------------------------------------------------ |
| `npm run validate:project`                 | PASS                                             |
| `npm run build`                            | PASS (non-blocking warnings)                     |
| `npm run test:architect -- --reporter=dot` | PASS (165 files; 2437 passed, 1 skipped, 3 todo) |
| `npm run test:trade -- --reporter=dot`     | PASS (58 files; 532 passed, 1 skipped, 3 todo)   |

### Commands Skipped

| Command                       | Reason                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run emu` / `npm run dev` | Not needed — all findings derived from deterministic code trace. Single-team non-persistence is provable from source (no Firestore imports in `runOffseason.js`). World path persistence is proven by `writeBatch`/`batch.commit()` chain. |
| `npm run lint`                | Per AGENTS.md: "Only if asked"                                                                                                                                                                                                             |
