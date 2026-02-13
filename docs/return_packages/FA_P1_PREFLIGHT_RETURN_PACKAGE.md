# FA P1 PREFLIGHT RETURN PACKAGE

## Executive Summary

- **Preflight scope:** discovery-only audit of Architect Free Agency wiring, with no functional code changes.
- **PREFLIGHT acceptance status:** **PASS** (all required discovery questions were answered with file-level evidence).
- **Execution readiness (ship wiring):** **NO**.
- **What is wired:** Free Agency is live in the Architect tab chain and uses shared dashboard state/hooks (`useArchitectState` + `useArchitectActions`) with the same mutation pipeline used by Cap Sheet and Trade Machine.
- **What is not fully wired/correct:**
  - Live FA pool is derived from `architect_basePlayers` contracts, **not world-overlaid player state**, so world-specific player overrides are not reflected in the list.
  - `loadFreeAgents()` (`freeAgents` collection) is still called but result is unused.
  - `handleSign` optimistic state path does not mirror all pipeline-side cap mechanics (cap-hold removal, exception usage tracking, hard-cap flags), causing local-state divergence risk.
  - Offer-sheet finalize buttons call handler with wrong signature, so finalize can no-op from the live list.
  - Vacuum/worldless behavior is inconsistent across FA operations.

---

## File Map

| File | Responsibility | Live vs Legacy | Evidence |
|---|---|---|---|
| `src/App.jsx` | Route entry for GM dashboard (`/gm/:teamId`). | Live | `src/App.jsx:35` |
| `src/pages/GmDashboardView.jsx` | Page wrapper that mounts `GMDashboard`. | Live | `src/pages/GmDashboardView.jsx:7` |
| `src/features/architect/GMDashboard/GMDashboard.jsx` | Architect tab switcher and FA tab prop wiring. | Live | `src/features/architect/GMDashboard/GMDashboard.jsx:241`, `src/features/architect/GMDashboard/GMDashboard.jsx:317` |
| `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx` | FA section container; renders incoming/outgoing offer lists + `FreeAgentPool`. | Live | `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:33`, `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:42`, `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:49` |
| `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx` | Main FA pool UI; selection + modal-based sign flow. | Live | `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:7`, `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:75` |
| `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx` | FA row rendering (rights/type/salary) and per-row action menu. | Live | `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx:84`, `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx:204` |
| `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx` | Selected-player card used before signing. | Live | `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx:5` |
| `src/features/architect/GMDashboard/components/OfferSheetList.jsx` | Incoming/outgoing offer-sheet action UI (match/decline/finalize buttons). | Live | `src/features/architect/GMDashboard/components/OfferSheetList.jsx:65`, `src/features/architect/GMDashboard/components/OfferSheetList.jsx:81`, `src/features/architect/GMDashboard/components/OfferSheetList.jsx:89` |
| `src/shared/components/EditContractModal.jsx` | Signing/offer-sheet/sign-and-trade modal with exception selector and guardrails preview. | Live | `src/shared/components/EditContractModal.jsx:995`, `src/shared/components/EditContractModal.jsx:1011`, `src/shared/components/EditContractModal.jsx:1122` |
| `src/features/architect/FreeAgentPool.jsx` | Re-export shim to moved FA folder. | Legacy compatibility stub | `src/features/architect/FreeAgentPool.jsx:3`, `src/features/architect/FreeAgentPool.jsx:13` |
| `src/features/architect/FreeAgentRow.jsx` | Re-export shim to moved FA folder. | Legacy compatibility stub | `src/features/architect/FreeAgentRow.jsx:3`, `src/features/architect/FreeAgentRow.jsx:13` |
| `src/features/architect/FreeAgentCard.jsx` | Re-export shim to moved FA folder. | Legacy compatibility stub | `src/features/architect/FreeAgentCard.jsx:3`, `src/features/architect/FreeAgentCard.jsx:13` |
| `src/features/architect/GMDashboard/hooks/useArchitectState.ts` | Shared dashboard read/state layer; derives `freeAgents`, loads team data. | Live SSOT read layer | `src/features/architect/GMDashboard/hooks/useArchitectState.ts:268`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:420` |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Shared dashboard action/write layer; wraps persistence via mutation pipeline. | Live SSOT write layer | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:358`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:392` |
| `src/features/architect/utils/worldTeamData.ts` | World-aware team read helper (`world -> parent -> base`). | Live | `src/features/architect/utils/worldTeamData.ts:81`, `src/features/architect/utils/worldTeamData.ts:100` |
| `src/features/architect/utils/teamLoader.js` | Canonical fallback loader + world player override resolution. | Live | `src/features/architect/utils/teamLoader.js:25`, `src/features/architect/utils/teamLoader.js:204` |
| `src/features/architect/utils/mutationPipeline.js` | Canonical world mutation entrypoint + persist path. | Live | `src/features/architect/utils/mutationPipeline.js:447`, `src/features/architect/utils/mutationPipeline.js:2425` |
| `src/features/architect/utils/capLegalityValidation.js` | Core FA/cap legality validators for signings/options/renounce/offer sheets. | Live | `src/features/architect/utils/capLegalityValidation.js:2029`, `src/features/architect/utils/capLegalityValidation.js:3425`, `src/features/architect/utils/capLegalityValidation.js:3758`, `src/features/architect/utils/capLegalityValidation.js:3819` |
| `src/features/architect/utils/firebaseTeamPlanHelpers.js` | Contains legacy `freeAgents` collection loader/saver. | Parallel/legacy data source | `src/features/architect/utils/firebaseTeamPlanHelpers.js:243`, `src/features/architect/utils/firebaseTeamPlanHelpers.js:255` |

---

## SSOT Map

### 1) Primary state container used by Cap Sheet + Trade Machine + Free Agency

- `GMDashboard` creates shared state via `useArchitectState` and shared handlers via `useArchitectActions`, then passes the same state/actions into all tab sections.
- Evidence:
  - State hook mount: `src/features/architect/GMDashboard/GMDashboard.jsx:62`
  - Actions hook mount: `src/features/architect/GMDashboard/GMDashboard.jsx:138`
  - Cap tab uses shared `teamCapSheet`: `src/features/architect/GMDashboard/GMDashboard.jsx:282`
  - Trade tab uses shared `teamCapSheet` (`primaryTeamData`) + actions: `src/features/architect/GMDashboard/GMDashboard.jsx:304`
  - FA tab uses shared `freeAgents`, `teamCapSheet`, and handlers: `src/features/architect/GMDashboard/GMDashboard.jsx:318`

### 2) Canonical team/player shape

- Team shape (roster, cap holds, exceptions, picks, totals) is defined in `BaseTeamDocZ`.
- Player contract shape (salariesByYear, birdRights, freeAgency) is defined in `BasePlayerContractZ`.
- World team snapshot extends base team shape.
- Evidence:
  - `src/schemas/architect.ts:260`
  - `src/schemas/architect.ts:325`
  - `src/schemas/architect.ts:417`

### 3) Canonical read path

- Dashboard/team read path:
  - `useArchitectState` -> `loadWorldTeamData(worldId, teamId)`.
  - `loadWorldTeamData` uses `getTeam(worldId, teamCode)` for world mode, fallback to base loader when `worldId` is null.
  - `teamLoader.getTeam` fallback chain: world snapshot -> parent world -> base.
- Player read path for FA pool:
  - `useArchitectState` gets players from `useArchitectPlayerData`.
  - `useArchitectPlayerData` subscribes via `subscribeArchitectPlayerData` to `basePlayersCol()` (`architect_basePlayers`).
- Evidence:
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:335`
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:382`
  - `src/features/architect/utils/worldTeamData.ts:93`
  - `src/features/architect/utils/worldTeamData.ts:100`
  - `src/features/architect/utils/teamLoader.js:25`
  - `src/features/architect/hooks/useArchitectPlayerData.js:27`
  - `src/features/architect/utils/subscribeArchitectPlayerData.ts:77`

### 4) Canonical write path + persistence target

- Dashboard write path:
  - handlers call `persistMutation`.
  - `persistMutation` calls `applyWorldMutation` when `worldId` and `userId` exist.
- Mutation pipeline write path:
  - `applyWorldMutation` executes READ -> COMPUTE -> VALIDATE -> PERSIST.
  - `persistWorldMutation` writes team snapshots and player overrides under `architect_worlds` and appends event entries.
- Collection/path constants:
  - Base read collections: `architect_baseTeams`, `architect_basePlayers`.
  - Writable world collection: `architect_worlds`.
- Evidence:
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:392`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:407`
  - `src/features/architect/utils/mutationPipeline.js:447`
  - `src/features/architect/utils/mutationPipeline.js:588`
  - `src/features/architect/utils/mutationPipeline.js:2425`
  - `src/features/architect/utils/mutationPipeline.js:2458`
  - `src/features/architect/utils/mutationPipeline.js:2483`
  - `src/features/architect/utils/mutationPipeline.js:2492`
  - `src/constants/collections.ts:26`
  - `src/constants/collections.ts:34`
  - `src/constants/collections.ts:58`

### 5) Vacuum/worldless mode behavior (as-found)

- `persistMutation` hard-returns when `worldId` is null.
- Therefore only operations with optimistic local state updates function in vacuum mode; persist-only operations are no-op.
- Evidence:
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:398`

---

## Free Agent Pool Lineage

### Definitive answer

- **Displayed FA pool source:** derived at runtime from Architect player contracts loaded from `architect_basePlayers` subscription.
- **Not sourced from:** `freeAgents` Firestore collection for the live UI.
- **Schema alignment:** derivation uses architect contract fields (`contract.salariesByYear`, `option`, `birdRights`), so it is architect-schema based.
- **Important mismatch:** derivation does **not** apply world player overrides (`architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`), so world-specific FA state can drift from displayed pool.

### Data lineage trace

1. `useArchitectState` reads `players` from `useArchitectPlayerData` (`src/features/architect/GMDashboard/hooks/useArchitectState.ts:335`).
2. `useArchitectPlayerData` subscribes to base players via `subscribeArchitectPlayerData` (`src/features/architect/hooks/useArchitectPlayerData.js:27`).
3. `subscribeArchitectPlayerData` queries `basePlayersCol()` and maps data from `architect_basePlayers` (`src/features/architect/utils/subscribeArchitectPlayerData.ts:77`, `src/features/architect/utils/subscribeArchitectPlayerData.ts:87`).
4. `useArchitectState` computes `upcomingFreeAgents` by filtering contract state:
   - no contract / empty salaries,
   - expired/expiring contracts,
   - option-year candidates,
   - derives `previousSalary`, `birdRights`, `freeAgentType`.
   - Evidence: `src/features/architect/GMDashboard/hooks/useArchitectState.ts:420`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:430`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:473`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:497`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:532`.
5. `FreeAgencySection` passes derived list into `FreeAgentPool` (`src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:49`).

### Parallel/legacy pool loader (mismatch risk)

- `useArchitectState` still calls `loadFreeAgents()` but discards its result.
- `loadFreeAgents()` reads `collection(db, 'freeAgents')`.
- Evidence:
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:16`
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:384`
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js:255`
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js:257`

### Fields relied on by pool derivation

- `player.contract.salariesByYear[]`
- `lastYearEntry.season`
- `lastYearEntry.option || optionType`
- `player.contract.birdRights.status`
- `player.name`, `player.id/player_id`, `teamCode/teamName`
- Evidence: `src/features/architect/GMDashboard/hooks/useArchitectState.ts:433`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:450`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:463`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:498`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:527`

---

## Rules Coverage Matrix

| Mechanic | UI Exposed? | Logic Implemented? | SSOT Read/Write Wired? | Persisted? | Tested? | Evidence |
|---|---|---|---|---|---|---|
| Cap holds impact on signings (cap-space + renounce implications) | Y (modal validation surface) | Y | **Partial** (pipeline handles; local `handleSign` path does not remove hold) | Y (world mode) | Y | `src/features/architect/utils/capLegalityValidation.js:2503`, `src/features/architect/utils/mutationPipeline.js:1534`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:632`, `src/tests/architect/capLegalityValidation.test.js:143` |
| Bird / Early Bird / Non-Bird eligibility | Y (rights shown + guardrails) | Y | **Partial** (validator/pipeline yes; FA pool source is base-only, not world-overlaid) | Y (world mode) | Y | `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx:84`, `src/shared/components/EditContractModal.jsx:1091`, `src/features/architect/utils/capLegalityValidation.js:2438`, `src/features/architect/GMDashboard/hooks/useArchitectState.ts:335` |
| Exceptions (MLE/TPMLE/Room/BAE/Minimum) + usage tracking | Y | Y | **Partial** (pipeline updates exception usage; local `handleSign` optimistic path does not) | Y (world mode) | Y | `src/shared/components/EditContractModal.jsx:1001`, `src/features/architect/utils/capLegalityValidation.js:2029`, `src/features/architect/utils/mutationPipeline.js:1476`, `src/tests/architect/phase74_room_exception_mvp_guardrails.test.js:265` |
| Apron / hard-cap restrictions | Y (validation warnings/errors) | Y | Y (via shared validator path) | Y (as validation gate before persist) | Y | `src/features/architect/utils/capLegalityValidation.js:2078`, `src/features/architect/utils/capLegalityValidation.js:3038`, `src/features/architect/utils/capLegalityValidation.js:3090`, `tests/architect/capLegalityValidation.test.js:1483` |
| Roster size limits | Y (validation) | Y | Y | Y (validated prior to persist) | Y | `src/features/architect/utils/capLegalityValidation.js:2640`, `tests/architect/capLegalityValidation.test.js:83` |
| Renounce rights | Y | Y | Y (optimistic local + mutation pipeline) | Y (world mode) | Y | `src/shared/components/EditContractModal.jsx:714`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:921`, `src/features/architect/utils/mutationPipeline.js:1968`, `tests/architect/renounceRights.test.js:390` |
| Option decision (accept/decline) + cap-hold transition | Y | Y | Y (optimistic local + mutation pipeline) | Y (world mode) | Y | `src/shared/components/EditContractModal.jsx:658`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1277`, `src/features/architect/utils/mutationPipeline.js:1808`, `src/features/architect/utils/capLegalityValidation.js:3425`, `tests/architect/capLegalityValidation.test.js:3011` |
| Offer-sheet store / match / decline / finalize | Y | Y | **Partial** (persist-only for most actions; finalize UI handler mismatch) | Y (world mode; store requires `worldId`) | Y (pipeline-level) | `src/shared/components/EditContractModal.jsx:637`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:745`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:800`, `src/features/architect/GMDashboard/components/OfferSheetList.jsx:83`, `src/features/architect/utils/mutationPipeline.js:2591`, `tests/architect/offerSheetPersistence.test.js:397`, `tests/architect/offerSheetResolution.test.js:3` |
| Sign-and-trade | Y (modal destination selector) | Y | **Partial** (persist-only from dashboard action) | Y (world mode) | Y | `src/shared/components/EditContractModal.jsx:1122`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:713`, `src/features/architect/utils/mutationPipeline.js:3169`, `src/tests/architect/signAndTrade.test.js:67` |
| Withdraw QO / explicit QO workflow | N | N (no dedicated mutation/UI found) | N | N | N | No dedicated handler/mutation route found in `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` and `src/features/architect/utils/mutationPipeline.js` for QO withdraw flow. |

---

## Wiring Truth Table

| Operation | Reads from SSOT? | Writes to SSOT? | Cap Sheet reflects change immediately? | Persisted to correct writable target? | Notes |
|---|---|---|---|---|---|
| Sign player (`signFreeAgent`) | Y | Y | **N** | Y* | Local write adds player/contract and removes FA row, but does not mirror full pipeline side-effects (cap-hold removal, exception usage, hard-cap flags). Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:632`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:686`, `src/features/architect/utils/mutationPipeline.js:1476`, `src/features/architect/utils/mutationPipeline.js:1534`. |
| Sign-and-trade (`signAndTrade`) | Y | N | N | Y* | Handler is persist-only; no optimistic local state update. Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:713`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:731`. |
| Store offer sheet (`storeOfferSheet`) | Y | N | N | Y* (requires `worldId`) | Persist-only; local optimistic path explicitly not implemented. Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:757`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:769`, `src/features/architect/utils/mutationPipeline.js:2591`. |
| Match offer sheet (`matchOfferSheet`) | Y | N | N | Y* | Persist-only action from dashboard. Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:774`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:778`. |
| Decline offer sheet (`declineOfferSheet`) | Y | N | N | Y* | Persist-only action from dashboard. Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:787`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:791`. |
| Finalize offer sheet (`finalizeMatchedOfferSheet` / `finalizeDeclinedOfferSheet`) | **N (live path)** | **N (live path)** | N | **N (live path)** | `OfferSheetList` calls `onFinalize(os)` but handler expects `(playerObj, offerSheet)` and returns if missing one arg. Evidence: `src/features/architect/GMDashboard/components/OfferSheetList.jsx:83`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:800`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:802`. |
| Renounce rights (`renounceRights`) | Y | Y | Y | Y* | Optimistic local update removes hold + clears rights, then persists mutation. Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:921`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:977`, `src/features/architect/utils/mutationPipeline.js:1968`. |
| Option decision (`optionDecision`) | Y | Y | Y | Y* | Optimistic local update modifies contract/cap holds, then persists. Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1277`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1429`, `src/features/architect/utils/mutationPipeline.js:1808`. |

\* `persistMutation` no-ops when `worldId` is null (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:398`), so persistence is world-mode only.

---

## Top 5 Risks / Unknowns

1. **FA pool is not world-aware**: list derives from base players subscription, not world-overlaid players.
   - Evidence: `src/features/architect/GMDashboard/hooks/useArchitectState.ts:335`, `src/features/architect/utils/teamLoader.js:229`.
2. **Legacy parallel pool source still called**: `loadFreeAgents()` (`freeAgents` collection) is invoked but unused, which can mislead future maintenance and hide drift.
   - Evidence: `src/features/architect/GMDashboard/hooks/useArchitectState.ts:384`, `src/features/architect/utils/firebaseTeamPlanHelpers.js:255`.
3. **Sign flow local-vs-pipeline divergence**: optimistic sign path does not apply full cap mechanics used in compute pipeline.
   - Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:632`, `src/features/architect/utils/mutationPipeline.js:1476`, `src/features/architect/utils/mutationPipeline.js:1534`.
4. **Offer-sheet finalize UI wiring bug**: finalize buttons pass wrong argument signature, causing effective no-op from live list.
   - Evidence: `src/features/architect/GMDashboard/components/OfferSheetList.jsx:83`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:800`.
5. **Vacuum mode incoherent for FA operations**: some actions work via optimistic state in worldless mode (sign/option/renounce), while persist-only flows (offer sheets/sign-and-trade) do nothing.
   - Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:398`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:713`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:745`.

---

## Ready for Execution? Checklist

### Preflight completion gates

- [x] Exact SSOT layer for Cap Sheet + Trade Machine identified (files + flow).
- [x] Exact Free Agency route entry + major file surface mapped.
- [x] Free-agent pool source and lineage explained definitively.
- [x] Rules Coverage Matrix produced with evidence.
- [x] Wiring Truth Table produced with evidence.
- [x] Stop conditions evaluated and not triggered.

### Validation surface (what can be run today)

- Existing commands:
  - `npm run test -- --run` (`package.json:20`)
  - `npm run build` (`package.json:13`)
  - `npm run validate:project` (`package.json:8`)
- Existing relevant coverage (examples):
  - Offer-sheet persistence/idempotency: `tests/architect/offerSheetPersistence.test.js:397`
  - Offer-sheet resolution validator: `tests/architect/offerSheetResolution.test.js:3`
  - Renounce rights persistence: `tests/architect/renounceRights.test.js:390`
  - Sign-and-trade mutation coverage: `src/tests/architect/signAndTrade.test.js:67`
  - Cap legality (exceptions/apron/cap holds/options): `tests/architect/capLegalityValidation.test.js:1483`, `tests/architect/capLegalityValidation.test.js:3011`
  - GMDashboard UI smoke (tab-level, not deep FA mutation wiring): `src/tests/architect/GMDashboard.smoke.test.tsx:176`

### Minimal manual verification script (post-implementation, high-level)

1. Open `/gm/:teamId` with no world selected; verify which FA actions mutate in-memory and which no-op.
2. Open with world selected; perform sign, renounce, option decision, offer-sheet store/match/decline/finalize, sign-and-trade.
3. After each action, confirm same-state reflection in Cap Sheet tab without full reload.
4. Reload page and confirm persisted state was read from `architect_worlds/{worldId}/...`, with no writes to base collections.
5. Cross-check FA pool membership against updated world player state (especially option declines/renounce outcomes).

### Ready for Execution verdict

- **Ready for execution?** **NO**
- **Why:** discovery is complete, but key wiring defects and SSOT alignment gaps remain (world-aware FA pool, finalize handler mismatch, optimistic-vs-pipeline divergence, vacuum-mode inconsistency).

---

## PASS/FAIL Determination

- **PREFLIGHT Discovery Pass/Fail:** **PASS**
- **Product Wiring Readiness Pass/Fail:** **FAIL (not ready yet)**
