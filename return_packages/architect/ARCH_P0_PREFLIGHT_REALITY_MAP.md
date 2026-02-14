# ARCH P0 Preflight Reality Map

## Executive Summary
- Architect entry is route-anchored at `/gm` and `/gm/:teamId` and renders through `LeagueView` and `GMDashboard` (`src/App.jsx` `App`, lines 34-35; `src/pages/GmLeagueView.jsx` `GmLeagueView`, lines 4-8; `src/pages/GmDashboardView.jsx` `GmDashboardView`, lines 4-8).
- Canonical dashboard state lives in `useArchitectState` and canonical mutation handlers live in `useArchitectActions`; world persistence is centralized in `applyWorldMutation` -> `persistWorldMutation` (`src/features/architect/GMDashboard/hooks/useArchitectState.ts` `useArchitectState`, lines 269-683; `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` `useArchitectActions`, lines 381-1932; `src/features/architect/utils/mutationPipeline.js` `applyWorldMutation`, lines 450-652; `persistWorldMutation`, lines 2447-2606).
- Data truth is mostly base read + world overlay write, but player sourcing remains base-centric in key paths, creating world-overlay drift risk for free agency and player contract displays (`src/features/architect/hooks/useArchitectPlayerData.js` lines 1-30; `src/features/architect/utils/subscribeArchitectPlayerData.ts` lines 73-121; `src/features/architect/utils/loadArchitectBasePlayer.ts` lines 48-80).
- No direct writes to base teams/players were found in Architect mutation paths; writes target world metadata, world team snapshots, world player overrides, world entitlement overrides, and events (`src/features/architect/utils/mutationPipeline.js` lines 2480-2589; `src/features/architect/utils/seasonManager.js` lines 664-734; `src/features/architect/utils/worldManager.js` lines 82-124, 257-287).
- Deceptive wiring/silent no-op risks exist in trade apply gating freshness, duplicated validation switch branches, dead prop wiring, and stale type contracts (documented below with line evidence).

## Architect Scope and Entrypoints
| Entrypoint | Route / File | Component Chain | Evidence |
| --- | --- | --- | --- |
| League shell | `/gm` in `src/App.jsx` | `GmLeagueView` -> `LeagueView` | `src/App.jsx` `App` lines 34-35; `src/pages/GmLeagueView.jsx` lines 4-8 |
| Team dashboard | `/gm/:teamId` in `src/App.jsx` | `GmDashboardView` -> `GMDashboard` | `src/App.jsx` `App` lines 34-35; `src/pages/GmDashboardView.jsx` lines 4-8 |
| Team selection handoff | `LeagueView` manage button | `navigate('/gm/${teamSlug}')` | `src/features/architect/shared/LeagueView/LeagueView.jsx` `goToTeam` lines 55-57, button lines 91-96 |

## Feature Tree Diagram
```text
/gm (LeagueView)
└── LeagueView
    ├── loadTeamCapSheet(team) [base team read]
    ├── computeTeamCapTotals(capSheet)
    └── navigate -> /gm/:teamId

/gm/:teamId (GMDashboard)
└── GMDashboard
    ├── useArchitectState(teamId, userId)
    ├── useArchitectActions(...)
    ├── WorldSelector
    ├── WorldTimeControls
    ├── Tabs
    │   ├── roster -> RosterSection -> RosterVisual
    │   ├── cap -> CapSheetSection -> CapSheet + ExceptionTracker
    │   ├── capfull -> CapTableSection -> CapSheetFull
    │   ├── trade -> TradeSection -> TradeEditor -> useTradeMachine
    │   ├── fa -> FreeAgencySection -> OfferSheetList + FreeAgentPool
    │   ├── offseason -> OffseasonSection -> OffseasonTab + SeasonAdvanceModal + DraftPositionsInput
    │   └── history -> HistorySection -> TeamHistoryTab
    └── EditContractModal (action commit modal)
```
Evidence: `src/features/architect/GMDashboard/GMDashboard.jsx` tab bar and section branches lines 199-356; modal wiring lines 419-441.

## Feature Mapping Table
| Feature | Route / Entry | Top component(s) | State source (hook/store) | Data source (base vs plan vs world overlay) | Save/load touchpoints | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| League View | `/gm` | `LeagueView` | Local `useState` (`teamSummaries`) | Base team load via `loadTeamCapSheet`; totals derived by `computeTeamCapTotals` | Read-only load on mount; navigation to dashboard | No world selection at this layer (`src/features/architect/shared/LeagueView/LeagueView.jsx` lines 15-53, 55-57) |
| Dashboard Shell | `/gm/:teamId` | `GMDashboard` | `useArchitectState`; `useArchitectActions`; `useArchitectModals` | Team data via `loadWorldTeamData(worldId, teamId)` fallback chain world->parent->base | Team reload on `worldId`/`teamId`; mutation handlers persist via pipeline | Central orchestration (`src/features/architect/GMDashboard/GMDashboard.jsx` lines 62, 138-147) |
| Worlds Selector | Dashboard header | `WorldSelector` | Local component state + parent `worldId` setter | `architect_worlds` metadata scoped by `createdBy` | `createWorld`, `branchWorld`, `updateWorldMetadata`, `purgeWorld`; worldId persisted to localStorage | User-owned world list query (`src/features/architect/GMDashboard/components/WorldSelector.jsx` lines 16-24, 72-99, 105-144, 184-295, 336-360) |
| World Time | Dashboard header | `WorldTimeControls` | Local `isSubmitting`, parent `asOfDate` | World metadata `asOfDate` | `updateWorldMetadata(worldId, {asOfDate})` | Drives timing validators (`src/features/architect/GMDashboard/components/WorldTimeControls.jsx` lines 34-35, 49-50) |
| Roster | Tab `roster` | `RosterSection` -> `RosterVisual` | `teamCapSheet`, `playersMap` from `useArchitectState` | Team roster from world/base cap sheet; player map from base players subscription | None directly in section | Render-only section wrapper (`src/features/architect/GMDashboard/sections/RosterSection.jsx` lines 15-20) |
| Cap Sheet | Tab `cap` | `CapSheetSection` -> `CapSheet`, `ExceptionTracker` | `teamCapSheet`, action handlers from `useArchitectActions` | Team sheet from world/base; cap totals derived in children | `handleSetDeadCap`, `handleSetExceptions`, edit actions -> mutation handlers | Optimistic local updates for dead cap/exceptions (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts` lines 1251-1288) |
| Full Cap Table | Tab `capfull` | `CapTableSection` -> `CapSheetFull` | Same as above + rules profile | Team sheet + derived rule profiles | Cap action clicks route to modal/action handlers | `handleCapSheetAction` opens modal context (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts` lines 1393-1417) |
| Trade Machine | Tab `trade` | `TradeSection` -> `TradeEditor` -> `useTradeMachine` | `useTradeMachine` internal state (`teams`, `result`, `hasCurrentValidation`) + dashboard `onApplyTrade` | Team snapshots via `loadWorldTeamData`; entitlements via resolver (base + world overrides + vacuum overlay); trade validator derived outputs | `onApplyTrade` -> `applyTradeToCapSheet`; world persistence via `executeTrade`; vacuum transfer overlay localStorage | Draft assets are entitlements-only (`src/features/architect/hooks/useTradeMachine.js` lines 261-295, 595-640, 929-953) |
| Free Agency | Tab `fa` | `FreeAgencySection` -> `OfferSheetList`, `FreeAgentPool`, `EditContractModal` | `freeAgents` from `useArchitectState`; action handlers from `useArchitectActions` | Free-agent pool derived from base players + world roster index; team cap sheet from world/base | World mode: authoritative pipeline for sign/S&T/offer-sheet ops; vacuum mode: local compute+set for `handleSign` | Offer sheet + S&T explicitly world-gated (`src/features/architect/GMDashboard/sections/FreeAgencySection.jsx` lines 33-63) |
| Offseason | Tab `offseason` | `OffseasonSection` -> `OffseasonTab`, `SeasonAdvanceModal`, `DraftPositionsInput` | Section local state + dashboard state setters | Team/world via `teamCapSheet`; world metadata via `getWorldMetadata`; league via `getLeague` in season manager | `advanceSeasonInWorld` writes world team snapshots + metadata; draft positions save to world metadata | World season is SSOT for advancement (`src/features/architect/utils/seasonManager.js` lines 585-590, 664-734) |
| Team History | Tab `history` | `HistorySection` -> `TeamHistoryTab` | `teamCapSheet` prop | Current loaded sheet | None in section | Read-only wrapper (`src/features/architect/GMDashboard/sections/HistorySection.jsx` lines 15-17) |

## Canonical State and Initialization
- Canonical dashboard state fields include `teamCapSheet`, `baselineCapSheet`, `freeAgents`, `currentYear`, `worldId`, and `worldAsOfDate` in `useArchitectState` (`src/features/architect/GMDashboard/hooks/useArchitectState.ts` lines 275-335).
- Year initialization priority: URL `?season` -> localStorage `hz.currentSeasonEndYear` -> default season resolved against available cap projection years (`src/features/architect/GMDashboard/hooks/useArchitectState.ts` lines 289-315).
- Team initialization pipeline: `loadWorldTeamData(worldId, teamId)` + deep clone to `teamCapSheet`; fallback chain delegates to team loader world->parent->base (`src/features/architect/GMDashboard/hooks/useArchitectState.ts` lines 414-430; `src/features/architect/utils/worldTeamData.ts` lines 72-101; `src/features/architect/utils/teamLoader.js` lines 44-71).
- Free-agent derivation is computed in-state and depends on base player pool plus world roster index filtering when `worldId` is active (`src/features/architect/GMDashboard/hooks/useArchitectState.ts` lines 363-399, 461-581).
- World ID persistence for selection is in `WorldSelector` localStorage key `architect.activeWorldId.{userId}` (`src/features/architect/GMDashboard/components/WorldSelector.jsx` lines 30-31, 105-144).

## Mutation Spine and Sequence Diagrams

### Spine Overview (UI -> Actions -> Pipeline -> Persistence)
| Action family | UI trigger | Payload shape evidence | Validation location | State update style | Persistence path |
| --- | --- | --- | --- | --- | --- |
| Trade propose/validate | `TradeEditor` Validate button | `validateTrade({teams[], capProjections, currentYear, tradeCtx})` (`src/features/architect/hooks/useTradeMachine.js` lines 862-882) | Trade engine validators (`tradeValidator.js` lines 591-632) | Validation result local only (`setResult`) | None until apply |
| Trade apply | `TradeEditor` Apply Trade | `persistMutation('executeTrade',{teams:[{teamCode,sends,picksOut,entitlementsOut}]})` (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts` lines 747-760, 775) | Pipeline `validateMutation` prevalidated trade context (`mutationPipeline.js` lines 2155-2173) | Optimistic `setTeamCapSheet(updated)` before persist (`useArchitectActions.ts` line 742) | `persistWorldMutation` writes world team/player/entitlement/event/metadata (`mutationPipeline.js` lines 2480-2589) |
| Sign free agent | FreeAgency modal save | `signingPayload {teamCode, playerId, contract, signedUsing}` (`useArchitectActions.ts` lines 814-819) | World: `validateMutation` -> `validateSigning` (`mutationPipeline.js` lines 2200-2214); Vacuum: `validateSigning` in hook (`useArchitectActions.ts` lines 860-879) | World: authoritative reload via `syncTeamFromMutationResult`; Vacuum: local compute result apply (`useArchitectActions.ts` lines 906-922) | World only via `applyWorldMutation('signFreeAgent',...)` (`useArchitectActions.ts` lines 821-829) |
| Sign-and-trade | Modal action | `signAndTrade` payload with `destinationTeamCode` (`useArchitectActions.ts` lines 1005-1013) | Pipeline `validateMutation` signAndTrade branch (`mutationPipeline.js` lines 2366-2401) | No local optimistic path (world required) | World only |
| Offer sheet (store/match/decline/finalize) | OfferSheetList + modal | Store/match/decline/finalize payloads in `useArchitectActions` (`lines 1070-1234`) | `validateMutation` branches for offer-sheet actions (`mutationPipeline.js` lines 2275-2351) | World authoritative mutation path | World team/player/event updates |
| Waive/extend/option/renounce | Modal action buttons | `waivePlayer`, `extendPlayer`, `optionDecision`, `renounceRights` payloads (`useArchitectActions.ts` lines 1571-1577, 1666-1672, 1836-1841, 1384-1387) | `validateMutation` uses non-trade validators (`mutationPipeline.js` lines 2217-2364) | Local optimistic mutation then async persist | World only if `worldId`; vacuum remains local |
| Dead cap / exceptions | Cap sheet management modals | `setDeadCap` and `setExceptions` payloads (`useArchitectActions.ts` lines 1262-1265, 1282-1285) | `validateDeadCap` and `validateExceptions` (`mutationPipeline.js` lines 2180-2198) | Optimistic local set then async persist | World writes when `worldId` |
| Season advance + draft resolution | Offseason modal advance | `advanceSeasonInWorld(worldId,{optionDecisions})` (`SeasonAdvanceModal.jsx` lines 351-378) | Internal season transition + DARE resolution | Batch updates after compute | `seasonManager` batch set world team snapshots + metadata (`seasonManager.js` lines 664-734) |

### Sequence Diagram: Trade Flow End-to-End
```text
User clicks Validate Trade (TradeEditor)
  -> useTradeMachine.handleValidate()
     -> validateCurrentTrade()
        -> validateTrade() [trade engine]
        -> setResult(validation)
        -> record lastValidatedDraftKey

User clicks Apply Trade (TradeEditor)
  -> exportCurrentTrade()
  -> (vacuum mode) applyVacuumTransfer() for outgoing entitlements
  -> onApplyTrade(tradeData) from GMDashboard
     -> useArchitectActions.applyTradeToCapSheet()
        -> local roster/contracts mutation
        -> setTeamCapSheet(updated)   [optimistic]
        -> persistMutation('executeTrade', {teams})
           -> applyWorldMutation()
              -> loadStateForMutation('executeTrade')
              -> computeWorldMutation('executeTrade')
              -> validateMutation(prevalidated trade context)
              -> persistWorldMutation(batch world writes)
```
Evidence: `src/features/architect/tradeMachine/TradeEditor.jsx` lines 372-403; `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` lines 567-777; `src/features/architect/utils/mutationPipeline.js` lines 450-652, 667-690, 905-934, 2447-2606.

### Sequence Diagram: Free Agency Sign Flow End-to-End
```text
User opens EditContractModal from FreeAgentPool
  -> modal confirm action (signNew/resign)
     -> onSave(...) in FreeAgentPool
        -> onSign(player, contract) from GMDashboard
           -> useArchitectActions.handleSign()
              if worldId:
                -> runAuthoritativeFAMutation('signFreeAgent', payload)
                   -> applyWorldMutation()
                   -> validateMutation(validateSigning)
                   -> persistWorldMutation()
                   -> syncTeamFromMutationResult() + refreshWorldRosterIndex()
              else (vacuum):
                -> validateSigning()
                -> computeWorldMutation('signFreeAgent', currentState)
                -> setTeamCapSheet(updatedTeam)
```
Evidence: `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx` lines 73-111, 172-186; `src/shared/components/EditContractModal.jsx` lines 664-693; `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` lines 782-944; `src/features/architect/utils/mutationPipeline.js` lines 2200-2214.

### Sequence Diagram: Draft Pick Move Flow End-to-End (Supported via Entitlements)
```text
User toggles entitlement out / destination in TradeTeamCard
  -> useTradeMachine.toggleEntitlement() / setEntitlementDestination()
  -> validateTrade() consumes entitlementsOut + validationEntitlements

On apply:
  -> exportCurrentTrade() includes outgoingEntitlements/incomingEntitlements
  -> vacuum mode: applyVacuumTransfer(entitlementId, fromTeam, toTeam)
  -> world mode trade persist:
       useArchitectActions.applyTradeToCapSheet() -> executeTrade payload includes entitlementsOut
       mutationPipeline.computeTradeResult() builds entitlementsTraded + entitlementUpdates
       persistWorldMutation() batch.set world entitlements holderTeam merge
```
Evidence: `src/features/architect/hooks/useTradeMachine.js` lines 595-660, 862-874, 929-947; `src/features/architect/tradeMachine/TradeEditor.jsx` lines 386-395; `src/features/architect/utils/mutationPipeline.js` lines 1359-1440, 2510-2525.

### Sequence Diagram: Save/Load Flow End-to-End
```text
World selection:
  WorldSelector loads listUserWorlds(createdBy == userId)
  -> restore worldId from localStorage key architect.activeWorldId.{userId}
  -> setWorldId in dashboard

Data load:
  useArchitectState effect on teamId/worldId/authLoading
  -> loadWorldTeamData(worldId, teamId)
     -> teamLoader.getTeam(world->parent->base)
  -> setBaselineCapSheet + setTeamCapSheet

Mutation save:
  useArchitectActions.persistMutation()/runAuthoritativeFAMutation
  -> applyWorldMutation -> persistWorldMutation

Reload consistency:
  refreshWorldRosterIndex + optional loadWorldTeamData on next state change
```
Evidence: `src/features/architect/GMDashboard/components/WorldSelector.jsx` lines 72-144; `src/features/architect/GMDashboard/hooks/useArchitectState.ts` lines 414-457; `src/features/architect/utils/worldTeamData.ts` lines 81-101; `src/features/architect/utils/teamLoader.js` lines 34-71.

## Data Source Classification by Feature
| Feature | Base source usage | World overlay usage | TeamPlans usage | Derived/computed source | Evidence |
| --- | --- | --- | --- | --- | --- |
| Team sheet views (roster/cap/capfull/history) | Base fallback via `loadTeamCapSheet`/`getBaseTeam` | Yes, world snapshot + parent fallback via `getTeam` | None found in runtime | Cap totals and rules profiles are computed client-side | `useArchitectState.ts` lines 414-430; `teamLoader.js` lines 44-71 |
| Free-agent pool | Base players subscription (`architect_basePlayers`) | Indirect world roster exclusion via world roster index | None | `freeAgents` derived from contracts + roster index | `useArchitectPlayerData.js` lines 1-30; `subscribeArchitectPlayerData.ts` lines 73-121; `useArchitectState.ts` lines 461-581 |
| Trade machine players | Base team/player reads for fallback and load helper | World team data for slots; world entitlement overrides resolved | None | `incomingAssets`, `hasCurrentValidation`, salary matching derived | `useTradeMachine.js` lines 315-445, 816-927; `entitlementResolver.ts` lines 142-285 |
| Draft assets | Base entitlement docs and base team entitlementIds | World entitlement override docs + world team entitlementIds | None | Decorated entitlement terms and pick rule projection | `entitlementResolver.ts` lines 112-140, 189-215; `useTradeMachine.js` lines 595-640 |
| Offseason/draft positions | Base league fallback when needed | World metadata and world team snapshots | None | Season transition + DARE computed | `seasonManager.js` lines 599-734; `worldManager.js` lines 619-647 |
| Legacy teamPlans | Removed from core Architect | N/A | `UNKNOWN/REMOVED` in current code | N/A | `mutationPipeline.js` header line 8; `firebaseTeamPlanHelpers.js` header line 7 |

## Deceptive Wiring / Silent No-Ops
1. `TradeEditor` computes local `incomingAssets` while also destructuring hook `incomingAssets` as `hookIncomingAssets`, but never uses the hook value.
- Risk: dual source drift between hook-calculated and component-calculated incoming assets.
- Evidence: `src/features/architect/tradeMachine/TradeEditor.jsx` line 50 (hookIncomingAssets), lines 96-125 (local recompute), lines 347-350/431 (local use).

2. Trade apply gating does not enforce validation freshness (`hasCurrentValidation`), only current `result.legal`.
- Risk: user can apply with stale validator output after draft changes.
- Evidence: `src/features/architect/tradeMachine/TradeEditor.jsx` lines 374-379, 405-410; freshness signal exists at lines 55-57 and header usage lines 295-299.

3. Trade apply is optimistic and persistence call is not awaited.
- Risk: local roster/cap can diverge from persisted world state if pipeline fails or lags.
- Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` line 742 (`setTeamCapSheet(updated)`), line 775 (`persistMutation('executeTrade', { teams })`).

4. `validateMutation` contains duplicate `storeOfferSheet` switch cases and redundant `matchOfferSheet/declineOfferSheet` fallthrough returning `{valid:true}`.
- Risk: misleading code path, maintenance bug surface.
- Evidence: `src/features/architect/utils/mutationPipeline.js` lines 2275-2291 and 2331-2345 (duplicate), lines 2347-2351 (redundant fallthrough).

5. Active tab TypeScript union is stale versus runtime tab IDs.
- Risk: typed contract drift (`'capTable'/'freeAgency'` vs `'cap'/'capfull'/'fa'`).
- Evidence: `src/features/architect/GMDashboard/hooks/useArchitectState.ts` lines 143-149; `src/features/architect/GMDashboard/GMDashboard.jsx` lines 211-243.

6. `GMDashboard` passes `onSign` prop to `EditContractModal`, but modal props do not accept/use `onSign`.
- Risk: dead wiring and expectation mismatch for signing path ownership.
- Evidence: `src/features/architect/GMDashboard/GMDashboard.jsx` line 430; `src/shared/components/EditContractModal.jsx` props lines 119-140.

7. Hook-level `previewOpen` state in `useTradeMachine` is returned but ignored by `TradeEditor`, which uses separate local modal state.
- Risk: partial dead state in hook.
- Evidence: `src/features/architect/hooks/useTradeMachine.js` lines 242, 1124-1126; `src/features/architect/tradeMachine/TradeEditor.jsx` line 74, lines 439-441.

8. `firebaseTeamPlanHelpers` claims read-only responsibilities but still includes Firestore write function `saveFreeAgents` (unused in current repo scan).
- Risk: policy drift and accidental write path.
- Evidence: `src/features/architect/utils/firebaseTeamPlanHelpers.js` lines 10-12 and 239-247; repo call-site search found none for `saveFreeAgents/loadFreeAgents`.

## Persistence Paths and Ownership
| Path / Collection | Read/Write | Writer(s) | Key fields / ownership | Evidence |
| --- | --- | --- | --- | --- |
| `architect_worlds/{worldId}` (metadata) | R/W | `worldManager`, `mutationPipeline`, `seasonManager` | `createdBy`, `currentSeason`, `lastModifiedAt`, `asOfDate`, stats | `worldManager.js` lines 82-106, 176-181, 257-287; `mutationPipeline.js` lines 2573-2589; `seasonManager.js` lines 728-734 |
| `architect_worlds/{worldId}/teams/{teamCode}` | R/W | `mutationPipeline`, `seasonManager`, `entitlementWriter` (team entitlementIds) | Team snapshot doc, `entitlementIds` updates | `mutationPipeline.js` lines 2458-2482; `seasonManager.js` lines 664-667; `entitlementWriter.ts` lines 420-432, 475-487 |
| `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` | R/W | `mutationPipeline` | Player override snapshot | `mutationPipeline.js` lines 2484-2507 |
| `architect_worlds/{worldId}/entitlements/{entitlementId}` | R/W | `mutationPipeline`, `entitlementWriter`, DARE mutator | World entitlement override; manual authoring metadata `_lastModifiedBy`; holder transfer patches | `mutationPipeline.js` lines 2510-2525; `entitlementWriter.ts` lines 273-327; `entitlementMutator.ts` lines 63-89 |
| `architect_worlds/{worldId}/events/{eventId}` | W | `mutationPipeline` | `eventId`, `type`, `timestamp`, `seasonId`, metadata payload | `mutationPipeline.js` lines 2528-2571 |
| Base teams/players/entitlements (`architect_baseTeams`, `architect_basePlayers`, `architect_baseEntitlements`) | Read-only in Architect runtime | loaders/resolvers only | Base source of truth for fallback and entitlement definitions | `teamLoader.js` lines 79-88, 216-236; `subscribeArchitectPlayerData.ts` lines 77-83; `entitlementResolver.ts` lines 147-176 |
| Legacy `freeAgents` collection | R/W helper only | `firebaseTeamPlanHelpers.saveFreeAgents/loadFreeAgents` | No ownership fields; ad-hoc IDs | `firebaseTeamPlanHelpers.js` lines 239-247, 255-259 |

### Data Truth Doctrine Check
- Base teams/players are read through `baseTeamRef/basePlayerRef` paths and no direct base write call sites were found in Architect mutation stack.
- Team plan equivalent in current architecture is world-scoped snapshots under `architect_worlds/*` (teamPlans collection removed from core runtime comments).
- World overlay behavior is explicit in loaders and resolver seams: base -> world override -> derived computed (`teamLoader.js` lines 44-71; `entitlementResolver.ts` lines 147-215).

### Base-Write Risk Check
- Scan of Architect write calls returned world-scoped writes and one legacy `freeAgents` helper write; no base-team/base-player writes detected.
- Evidence: write call scan matches `worldManager.js`, `seasonManager.js`, `mutationPipeline.js`, `entitlementWriter.ts`, `entitlementMutator.ts`, and `firebaseTeamPlanHelpers.js` (`saveFreeAgents` only).
- `SEV-0 base write blocker`: **Not found** in audited paths.

## Unknowns and Next Discovery Steps
| Unknown | Why unknown | Smallest next discovery step |
| --- | --- | --- |
| Runtime UX of export on real browser canvas/fonts | Discovery used static code + test/build runs; no interactive browser execution in this pass | Run `npm run dev`, open trade preview modal, perform one download, verify PNG contents and sizing |
| Whether product requires explicit `/teamPlans` collection parity vs worlds-only architecture | Codebase indicates worlds-only removal, but product requirement may still expect teamPlans naming | Confirm product-level persistence contract and update doctrine docs if worlds are accepted equivalent |
| Whether legacy `saveFreeAgents` helper is truly dead in external scripts | Repo scan found no in-repo call sites | Add one grep gate in CI discovery docs or remove/flag helper in execution phase |
