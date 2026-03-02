# FREE_AGENCY_R1_LOCAL — REVIEW RETURN PACKAGE
**Date:** 2026-03-01  
**Status:** FAIL (5 PASS / 7 FAIL / 0 BLOCKED)

## Executive Summary
- Pass count: **5**
- Fail count: **7**
- Blocked count: **0**
- Top 5 critical failures:
  1. World-mode signing reports `"Saved"` but produces no roster/cap/event change and no world team/event writes.
  2. Sign-and-trade destination selection passes slug-style IDs and fails with `"Base team celtics not found"`.
  3. Cap-hold renounce (`Absolve`) confirms but shows no hold-count/totals impact.
  4. Exception selection changes UI guardrails but exception usage is not observably consumed in runtime.
  5. Legality gating is inconsistent for over-limit signing attempts (warning shown but action remains confirmable).

## A) Scope Inventory

### UI surfaces list
- Navigation path:
  - `/` -> `Tools` -> `GM Tools` -> `/gm` -> `Manage Team` (ATL) -> `/gm/hawks?season=2026` -> `Free Agency` tab.
- Architect routes/tabs:
  - `src/App.jsx` (`/gm`, `/gm/:teamId`)
  - `src/features/architect/GMDashboard/GMDashboard.jsx` (`activeTab === 'fa'`)
- Free Agency section shell:
  - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`
  - World-required banner in base mode: `"Offer sheets and sign-and-trade require an active world to commit."`
- Offer sheet panels (conditional):
  - `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
  - Hidden when no sheets (`if (!offerSheets || offerSheets.length === 0) return null`)
  - Actions: `Match`, `Decline`, `Finalize Match`, `Finalize Signing`
- Free agent pool:
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
  - Header: `Free Agent Pool`
  - Controls from `FreeAgencyFilterBar.tsx`: search, `Position`, `Age`, `Salary`, sort, `Clear`, results count
  - Empty state: `"No matches"`
- Free agent row/menu/card surfaces:
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx` (`•••`, `Sign Free Agent`, `View Profile`)
  - `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx` (`Sign Player`, remove `✕`)
- Contract/action modal:
  - `src/shared/components/EditContractModal.jsx`
  - Actions observed: `Sign Free Agent` (base), plus `Sign & Trade` and `Offer Sheet` (world mode)
  - Editor fields observed: contract type, years, salary inputs, rights/exception selector, destination team selector, confirm/cancel
- Cap holds/rights/renounce + exceptions surfaces:
  - `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx` (cap holds + `Absolve`)
  - `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - `src/features/architect/GMDashboard/components/WorldSelector.jsx` for world toggle

### Data surfaces list

#### Reads
- Player pool source:
  - `src/features/architect/hooks/useArchitectPlayerData.js`
  - `src/features/architect/utils/subscribeArchitectPlayerData.ts` (`architect_basePlayers`)
- Team/world state:
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
  - `src/features/architect/utils/worldTeamData.ts` -> `loadWorldTeamData(worldId, teamId)`
  - `src/features/architect/utils/teamLoader.js` (`getTeam` world -> parent world -> base)
- Free agency derivation:
  - `useArchitectState.ts` Effect 7 derives `freeAgents` from `worldAwarePlayers` + contract/rules state.
- Cap and legality helpers:
  - `src/features/architect/hooks/useCapValidation.js` (`buildSigningGuardrails`)
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/entitlements/entitlementResolver.ts`

#### Local/browser storage
- `architect-free-agency-filters-v1` via `src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts`
- `hz.currentSeasonEndYear` via `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `architect.activeWorldId.{userId}` via `src/features/architect/GMDashboard/components/WorldSelector.jsx`

#### Writes
- Canonical world mutation sink:
  - `src/features/architect/utils/mutationPipeline.js` -> `persistWorldMutation()`
  - Targets:
    - `architect_worlds/{worldId}/teams/{teamCode}`
    - `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`
    - `architect_worlds/{worldId}/entitlements/{entitlementId}`
    - `architect_worlds/{worldId}/events/{eventId}`
    - world metadata patch on `architect_worlds/{worldId}`
- Post-mutation stats update:
  - `src/features/architect/utils/worldManager.js` -> `updateWorldStats()`
- Action handlers:
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
  - `handleSign`, `handleSignAndTrade`, `handleStoreOfferSheet`, `handleMatchOfferSheet`, `handleDeclineOfferSheet`, `handleFinalizeOfferSheet`, `handleRenounceRights`, `handleWaiveContract`, `handleOptionDecision`, `handleExtendContract`, `handleSetDeadCap`, `handleSetExceptions`
- Safety gates:
  - UI gate (`actionsDisabled={!worldId}` in `FreeAgencySection`)
  - runtime gate (`runAuthoritativeFAMutation`: requires `worldId` and `userId`)
  - pipeline validation gate (`validateMutation`, invariants, `validatePostStateCapLegality`)
  - persistence sanitization/contract gates (`guardAgainstUndefined`, `sanitizeTransientFieldsForPersistence`, `assertPersistableOrThrow`, `removeUndefinedDeep`)
- Non-active/legacy-adjacent write helper detected:
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js` `saveFreeAgents()` writes to `freeAgents/{id}` (not in active FA mutation pipeline)

## B) PASS/FAIL Checklist (1–12)

### 1) UI Wiring (No dead UI)
- **Status:** FAIL
- **Evidence:**
  - Working controls: search/filter/sort/clear and row menu do respond.
  - Dead/no-op behavior observed:
    - Cap-hold `Absolve` prompt appears and is accepted (`"Are you sure you want to renounce rights to Kristaps Porzingis? This will clear their cap hold."`), but cap-hold count and row content do not visibly change.
    - Signing flow can show `"Saved"` with no visible downstream change.
  - Code pointers: `CapSheetFull.jsx` (`onActionClick?.(h, 'renounce')`), `useArchitectActions.ts` (`confirmAndRenounceRights`), `FreeAgentPool.jsx` + `EditContractModal.jsx` sign action chain.

### 2) FA Pool Loads and Is Stable
- **Status:** PASS
- **Evidence:**
  - Pool renders with `"427 results"` / `"172 results"` in walkthroughs.
  - Filters work with observable row changes:
    - Search `zzzz_nonexistent_player` -> `"No matches"`.
    - `Clear` restores list and result count.
    - Position/sort changes reorder first row.
  - Key fields render per row: position, name, age, rights tag, FA type, height/weight, salary ask.
  - Fetch/derive pointers: `useArchitectState.ts` (Effect 7 free-agent derivation), `subscribeArchitectPlayerData.ts`, `FreeAgentRow.jsx`.

### 3) Contract Offer Flow Is Real
- **Status:** FAIL
- **Evidence:**
  - Modal opens and contract fields are editable (`1yr`, salary, exception, etc.).
  - World-mode attempts:
    - Multiple submissions, including one returning `"Saved"`, show no measurable state transition:
      - list count unchanged (`"172 results"` before/after),
      - attempted players remain in list,
      - cap totals unchanged,
      - world debug counters unchanged (`Base events: 0 | Preview events: 0`).
  - Emulator verification:
    - Latest test world had `teams_docs 0`, `events_docs 0`.
  - Code pointers: `EditContractModal.jsx` (`handleConfirm`), `useArchitectActions.ts` (`handleSign`), `mutationPipeline.js` (`persistWorldMutation`).

### 4) Cap Holds / Rights Are Connected
- **Status:** FAIL
- **Evidence:**
  - Cap holds are visible (`Cap Holds 20`) and renounce confirm appears.
  - After confirming `Absolve`, no visible hold/totals delta:
    - cap holds count stayed `20`,
    - same first hold row persisted,
    - cap totals/debug unchanged.
  - Rights rule messaging does trigger in sign modal (e.g., `"Cannot re-sign player using FULL BIRD rights. Player's team (POR) does not match signing team (ATL)."`), so rights checks are partially wired.
  - Required renounce impact proof failed.
  - Code pointers: `CapSheetFull.jsx` (`Absolve`), `useArchitectActions.ts` (`confirmAndRenounceRights`), `mutationPipeline.js` (`renounceRights` load/compute path).

### 5) Exceptions Are Actually Used (not cosmetic)
- **Status:** FAIL
- **Evidence:**
  - Exception selection affects guardrail text:
    - `"Rights/Exception: Full MLE"`
    - `"First-year range: $0 - $14,104,000"`
  - Runtime usage consumption not demonstrated:
    - Manage Exceptions MLE remained unchanged before/after attempt:
      - `usedAmountRaw="11000000"`
      - `remainingDisplay="$3,104,000"`
  - No successful mutation evidence (world events/team docs remained zero), so exception lifecycle impact not proven.
  - Code pointers: `EditContractModal.jsx` (exception selector), `useCapValidation.js` (`buildSigningGuardrails`), `useArchitectActions.ts` + `mutationPipeline.js`.

### 6) Legality / Validation Enforcement
- **Status:** FAIL
- **Evidence:**
  - Illegal attempt #1 blocked with visible reason:
    - `"Year 2 exceeds allowed raise (5% max)"` + button `"Action Blocked"` disabled.
  - Illegal attempt #2 blocked:
    - Sign-and-trade without destination keeps confirm disabled.
  - Over-limit case inconsistency:
    - oversized salary showed warning `"Signing puts team over Second Apron - limited flexibility"` but confirm remained enabled.
  - Hard-cap/apron block behavior for illegal signing not conclusively enforced in runtime walkthrough.
  - Code pointers: `EditContractModal.jsx` (`disableConfirm`), `useCapValidation.js`, `capLegalityValidation.js`, `useArchitectActions.ts`.

### 7) Base vs World Boundary
- **Status:** PASS
- **Evidence:**
  - Runtime base-mode proof:
    - world selector shows `No World Selected`
    - base-mode warning: `"Offer sheets and sign-and-trade require an active world to commit."`
  - Runtime world-mode proof:
    - world debug line shows concrete `world_...` active ID.
  - Write boundary proof:
    - code routes persistence through world-only paths (`architect_worlds/...`) in `persistWorldMutation`.
    - base-mode persistence skip in `persistMutation` (`if (!worldId) return { success: true, skipped: true }`).
  - Firestore safety snapshot:
    - `root_teams_docs 0` in emulator.

### 8) Write Paths & Safety Gates (MAP ALL)
- **Status:** PASS
- **Evidence:**
  - Mapped write paths and gates:
    - sign/re-sign: `handleSign` -> `signFreeAgent`
    - sign-and-trade: `handleSignAndTrade` -> `signAndTrade`
    - offer sheets: `store/match/decline/finalize*`
    - renounce: `handleRenounceRights` -> `renounceRights`
    - waive/stretch/buyout path: `handleWaiveContract` -> `waivePlayer`
    - option decision: `handleOptionDecision` -> `optionDecision`
    - exceptions/dead cap: `setExceptions` / `setDeadCap`
    - contract editor save-only path: `handleSaveContract` local-only (no Firestore write)
    - plan save/load: removed from active architect flow; legacy references only
  - Destinations and guards documented in sections A/B with file/function references.

### 9) Forbidden Writes Rule (CRITICAL)
- **Status:** PASS
- **Evidence:**
  - Static scan in `src/` found no root `teams` writes:
    - no `doc(db, 'teams', ...)`
    - no `collection(db, 'teams')`
    - no `db.collection('teams')`
  - `functions/` only has `worldRef.collection('teams')` under world subtree (expected for purge path).
  - Runtime emulator query confirmed `root_teams_docs 0`.

### 10) Error Handling / Edge Cases
- **Status:** FAIL
- **Evidence:**
  - Covered:
    - invalid contract raise path -> blocked with explicit message
    - wrong exception constraints visible in guardrails
    - destination-missing sign-and-trade -> disabled submit
  - Missing deterministic runtime proof for required set:
    - insufficient cap-space blocking (with explicit block reason) not reproduced deterministically,
    - missing/undefined player fields edge case not reachable through current UI walkthrough.
  - Gap is a FAIL item per review rules.

### 11) Performance Footguns
- **Status:** PASS
- **Evidence:**
  - No runaway fetch loop/listener symptoms observed during walkthrough (no crash/hang/reload thrash).
  - Code inspection found no obvious repeated listener leak in row menu path (`FreeAgentRow.jsx` cleanup present).
  - Residual risk to monitor:
    - no virtualization for large free-agent lists,
    - per-player contract sorting during derivation in `useArchitectState.ts` Effect 7.

### 12) Tests
- **Status:** FAIL
- **Evidence:**
  - Ran relevant suites:
    - `npm run test:architect -- --reporter=dot` -> PASS (158 files, 2408 passed, 1 skipped, 3 todo)
    - `npm run test:trade -- --reporter=dot` -> PASS (58 files, 532 passed, 1 skipped, 3 todo)
  - Inventory includes broad FA/cap/offer-sheet/exception/hard-cap coverage.
  - Deterministic coverage gap remains for core runtime path:
    - UI-to-world signing success path is not currently catching observed no-op behavior (`"Saved"` without state/persistence change).
    - renounce/cap-hold UI integration and sign-and-trade destination ID/code mismatch are not adequately guarded by end-to-end integration coverage.

## C) Evidence Appendix

### Command outputs
- `npm run validate:project` -> PASS (`All validations passed`)
- `npm run build` -> PASS (`✓ built in 41.86s`)
- `npm run emu` -> PASS
  - import detected: `prior emulator export found ... will import`
  - seed checks skipped:
    - `base entitlements present ... skipping`
    - `base teams entitlementIds present ... skipping`
    - `architect_basePlayers present ... skipping seed`
    - `players_v2 present ... skipping seed`
    - `base pick rules present ... skipping`
  - ready: `All emulators ready!`
- `npm run dev` -> PASS (`http://localhost:5173/`)
- `npm run test:architect -- --reporter=dot` -> PASS
  - `Test Files 158 passed (158)`
  - `Tests 2408 passed | 1 skipped | 3 todo (2412)`
- `npm run test:trade -- --reporter=dot` -> PASS
  - `Test Files 58 passed (58)`
  - `Tests 532 passed | 1 skipped | 3 todo (536)`
- `npm run test:diff -- --reporter=dot` -> PASS fallback
  - `No changed files detected`
  - fallback `npm run test:fast` passed (3 files / 14 tests)

### Runtime snippets (manual walkthrough)
- Base mode warning: `"Offer sheets and sign-and-trade require an active world to commit."`
- Illegal signing block:
  - `"Year 2 exceeds allowed raise (5% max)"`
  - button `"Action Blocked"` disabled
- Wrong exception guardrail:
  - `"Rights/Exception: Full MLE"`
  - `"First-year range: $0 - $14,104,000"`
- Rights mismatch failure:
  - `"Cannot re-sign player using FULL BIRD rights. Player's team (POR) does not match signing team (ATL)."`
- Sign-and-trade failure:
  - `"Base team celtics not found"`
- Renounce confirm:
  - `"Are you sure you want to renounce rights to Kristaps Porzingis? This will clear their cap hold."`
  - no visible hold/totals change afterward.

### Firestore emulator verification
- Latest world metadata sample:
  - `actionCount 0`, `lastModifiedTeams []`
- Latest test world:
  - `teams_docs 0`
  - `events_docs 0`
- Root collection safety:
  - `root_teams_docs 0`

## D) Fix Punchlist (NO FIXES IMPLEMENTED)

1) **Critical** — Free-agency sign flow can report success without state/persistence effect  
- **Files/functions:** `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx` (`handleSign`), `src/shared/components/EditContractModal.jsx` (`handleConfirm`), `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (`handleSign`, `runAuthoritativeFAMutation`)  
- **Acceptance criteria:** submitting a legal sign in active world must (a) remove player from FA list or update row status, (b) update team cap totals, (c) create world team/event documents, and (d) increment world action stats.

2) **High** — Sign-and-trade destination ID/code mismatch  
- **Files/functions:** `src/shared/components/TeamSelectDropdown.jsx` (`value={team.id}`), `src/shared/components/EditContractModal.jsx` (`destinationTeamId`), `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (`handleSignAndTrade`), `src/features/architect/utils/mutationPipeline.js` (`getTeam(worldId, destinationTeamCode)`)  
- **Acceptance criteria:** destination passed from UI must match canonical team code expected by mutation pipeline (or be normalized before dispatch). Selecting Boston must not produce `"Base team celtics not found"`.

3) **Critical** — Cap-hold renounce (`Absolve`) no visible impact  
- **Files/functions:** `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx` (`onActionClick(..., 'renounce')`), `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (`confirmAndRenounceRights`)  
- **Acceptance criteria:** after confirming renounce, cap hold row is removed, hold count decrements, cap totals delta is visible, and (in world mode) persistence/event evidence is produced.

4) **High** — Exception lifecycle not provably connected end-to-end in runtime  
- **Files/functions:** `src/shared/components/EditContractModal.jsx`, `src/features/architect/hooks/useCapValidation.js`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`, `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`  
- **Acceptance criteria:** choosing an exception must deterministically change legality and, after successful sign, update used/remaining amounts in exception surfaces.

5) **High** — Legality gating inconsistency for over-limit signing states  
- **Files/functions:** `src/shared/components/EditContractModal.jsx` (`disableConfirm`, validation rendering), `src/features/architect/hooks/useCapValidation.js`, `src/features/architect/utils/capLegalityValidation.js`  
- **Acceptance criteria:** illegal cap/apron/hard-cap states must block confirm with explicit user-facing reason; warning-only states must be clearly non-blocking and consistent with final mutation outcome.

6) **Medium** — Required edge-case coverage incomplete in runtime review harness  
- **Files/functions:** `src/shared/components/EditContractModal.jsx`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`  
- **Acceptance criteria:** deterministic QA path exists for:
  - insufficient-space blocked signing,
  - wrong-exception blocked signing,
  - missing/undefined player identity blocked path with visible error.

7) **High** — Deterministic integration tests missing for UI->mutation->persistence signing closure  
- **Files/tests target:** add/extend tests near `src/tests/architect/useArchitectActions.freeAgency.test.tsx`, `src/tests/architect/freeAgency_closure.gate.test.ts`, and a new integration suite covering modal submit + world persistence evidence  
- **Acceptance criteria:** tests must fail if:
  - sign shows success but no world team/event updates occur,
  - renounce action confirms but does not change cap holds/totals,
  - sign-and-trade destination identifier is not canonicalized correctly.

## E) Closure Criteria
- Free Agency can execute at least one legal signing in world mode with verifiable roster/cap/event persistence.
- Cap-hold renounce produces deterministic before/after hold and totals deltas.
- Exception selection both gates legality and updates usage after successful commit.
- Illegal signing attempts (including insufficient-space and missing-field cases) are visibly blocked with explicit reasons.
- No writes to root `/teams/`; world writes remain scoped to `architect_worlds/{worldId}/...`.
- Deterministic integration tests cover the full signing/renounce/sign-and-trade closure path and prevent regression.
