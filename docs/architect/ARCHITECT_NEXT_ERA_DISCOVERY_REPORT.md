# Architect Next Era Discovery Report

Discovery pass for the next Architect product phase. This report is
intentionally observational. It does not claim any implementation is complete,
and it does not recommend product code changes in this pass.

## Executive Summary

Architect already has the hard part of a franchise operating system: persistent
worlds, committed mutation pipelines, season advancement, cap and trade
validation, free agency actions, roster views, offseason workflow, and history.
The next gap is not another isolated feature. The missing layer is visible
operating continuity.

Today, the application preserves world state, but most orientation signals are
section-local. The user can move between cap sheet, full cap table, trade, free
agency, offseason, roster, and history, but the persistent shell does not yet
act like a franchise cockpit. It exposes world selection, world date, selected
season, Firebase target mode, save state, and errors. It does not continuously
expose active team identity, world scenario identity, roster count, cap/tax/apron
state, exception state, pick/assets state, pending or committed move context,
validation status, or baseline-to-world deltas.

The safest Stage 1 boundary is a read-only World Operating Experience layer
inside the Architect dashboard shell. It should compose existing authoritative
state and event sources, label truth boundaries clearly, and avoid creating any
new write path. The main risk is truth confusion: world-committed state,
base/sandbox state, vacuum/local-validated previews, optimistic world previews,
and DEV-only offseason previews are all real but have different authority.

## Current-State Map

### Route and Shell Composition

- `src/App.tsx` routes `/gm` to the league view and `/gm/:teamId` to the team
  dashboard.
- `src/pages/GmLeagueView.tsx` and `src/pages/GmDashboardView.tsx` are page
  wrappers around Architect feature views.
- `src/features/architect/GMDashboard/GMDashboard.tsx` is the main team
  operating shell. It composes state from `useArchitectState`, actions from
  `useArchitectActions`, and section tabs for roster, cap sheet, cap table,
  trade, free agency, offseason, and history.

The persistent dashboard header currently shows:

- product title: `HoopZero Architect - GM Dashboard`
- Firebase target mode badge
- `WorldSelector`
- `WorldTimeControls`
- selected season control
- save and error messages

The persistent header does not currently show:

- active team summary
- world scenario summary beyond selector control
- world current season compared with selected viewing season
- roster count
- cap, tax, or apron status
- exception/TPE status
- draft assets/picks
- pending or recently committed moves
- validation/legal status
- baseline versus active-world deltas

### State and Action Owners

`useArchitectState` is the dashboard-facing state adapter. It owns team cap sheet
state, free agents, selected season, selected rules year, active tab, selected
player, world id, world date, world current season, world roster/player overlay
state, metadata loading, and active-world reload behavior.

Important UI-facing state seams:

- `worldId`: active world identity, or `null` for no active world.
- `worldAsOfDate`: active world date when a world is selected.
- `worldCurrentSeason`: authoritative world season from world metadata.
- `currentYear`: selected dashboard viewing season, persisted in URL and local
  storage.
- `activeWorldOwner`: setter/control surface for active world selection.
- `worldTimeOwner`: read/write control surface for world date.
- `worldModeBoundary`: currently normalized to `sandbox` or `world`.

`useArchitectActions` is the dashboard action orchestration adapter. It chooses
the correct execution route for trades, signings, waivers, offer sheets, and
other mutations. It routes committed world writes through the mutation pipeline,
while preserving local-validated and optimistic-preview behavior where the
product already supports it.

Important action authority seams:

- committed world mutations use `applyWorldMutation`.
- base/no-world actions use local validated application when supported.
- standard signings can execute in world or vacuum mode.
- sign-and-trade and offer-sheet flows are world-only.
- committed world reloads prefer `changedTeams` snapshots from mutation results,
  then fall back to a world team reload.

### Active World and Mode Representation

Architect has multiple internal mode concepts. They are mostly correct in code,
but not unified as one user-facing mode system.

- `WorldSelector` presents `World` versus `Sandbox`.
- `WorldTimeControls` is enabled only for active worlds.
- `useArchitectState` returns a `worldModeBoundary` of `sandbox` or `world`.
- Trade Machine treats no-world operation as vacuum mode.
- Free agency standard signing uses world mode or vacuum mode.
- Local cap audit events distinguish `baseLocalValidated` and
  `worldOptimisticPreview`.
- Offseason has a DEV-only `dev-local-preview` authority that is explicitly
  non-authoritative and non-persistent.
- History labels timeline truth as world events, local timeline, fixture
  override, or section-derived fallback.

This means the system has the raw data to explain mode truth. The missing part
is a single presentation layer that turns these terms into consistent operator
language.

## Section Composition Map

### Roster

`RosterSection` is a thin wrapper over `RosterVisual`.

Current visible context:

- team identity and roster grouping
- players grouped by position

Missing persistent context:

- world identity
- season/date context
- roster count as a workspace signal
- cap, asset, validation, or delta context

### Cap Sheet

`CapSheetSection` wraps `CapSheet` and preserves selected-year versus
current-season boundaries. `CapSheet` shows selected-year cap sheet detail,
confidence status, cap summary tiles, cap holds, dead money, and exception
controls.

Current visible context:

- selected season
- cap allocations, cap space, tax space, first apron space, second apron space
- hard cap, exceptions, and TPEs for current-season authority
- selected-year future cap sheet detail

Missing persistent context:

- cap/tax/apron state outside this tab
- whether displayed totals are base/sandbox/world/preview truth
- recent move effects or baseline deltas as a global signal

### Full Cap Table

`CapTableSection` wraps `CapSheetFull`.

Current visible context:

- multi-year cap table
- player rows, FA/option actions, yearly totals, cap holds

Missing persistent context:

- active world/scenario context beyond shell controls
- cross-surface move or validation status

### Trade Machine

`TradeSection` wraps `TradeEditor` and passes world id, world date, user id, and
the apply-trade callback. `TradeEditor` and trade hooks maintain draft trade
state, validation status, entitlement operations, pick changes, and preview
authority.

Current visible context:

- trade validation status
- team cards with rosters, salaries, allowable incoming, picks, exceptions, and
  TPEs
- validator result details
- optional debug receipt when the trade receipt flag is enabled
- vacuum session pick-change controls when no world is active

Missing persistent context:

- a global mode label explaining whether this trade is world-backed or
  local/vacuum
- global pending move context
- global legal status after switching away from the tab
- a committed move rail after successful apply

### Free Agency

`FreeAgencySection` wraps offer-sheet lists and `FreeAgentPool`.

Current visible context:

- free agent pool filters and player rows/cards
- incoming and outgoing offer sheets when available
- disabled messaging for world-only offer-sheet actions
- standard signing and sign-and-trade action availability through owner props

Missing persistent context:

- cap/exception status that explains signing constraints before opening modals
- global pending offer or recently committed signing summary
- unified mode language for world-only versus vacuum/local standard signing

### Offseason

`OffseasonSection` owns the world-backed season advancement surface and a
DEV-only preview surface. `SeasonAdvanceModal` executes committed season
advancement through `seasonManager`.

Current visible context:

- world-only gating
- authoritative world season
- selected viewing season mismatch
- draft positions input
- committed season advancement modal
- DEV-only preview boundary when enabled

Missing persistent context:

- world current season outside the offseason tab
- cross-surface notice when selected viewing season differs from world current
  season
- persistent event summary after a season advance

### History

`HistorySection` wraps `TeamHistoryTab`.

Current visible context:

- transaction history
- source banner for world, local, fixture, or section-derived timeline
- world events when active
- section-derived waiver, exception, and draft pick history

This is one of the strongest existing continuity patterns. It already explains
source truth to the user and can serve as a model for the future operating
layer.

### League View

`LeagueView` is the `/gm` league-level surface. It is base/read-only oriented
today and has its own truth panel.

Current visible context:

- season
- read-only base team snapshot source
- loaded/unavailable rows
- league standings-style cap table

Fragmentation risk:

- the league view does not currently act as a world-aware franchise workspace
  entry point.
- dashboard active world restoration happens in the team dashboard, not in the
  league view shell.

## UI Visibility Matrix

| Signal | Always visible in dashboard shell? | Section-local visibility |
| --- | --- | --- |
| Active team | No | Roster, route context, section headings/cards |
| Selected viewing season | Yes | Cap, cap table, trade, offseason |
| Authoritative world season | No | Offseason |
| Active world/scenario | Partially | World selector and world-only section gates |
| Base/sandbox/world mode | Partially | World selector, trade vacuum controls, debug/audit |
| Local preview status | No | Trade/apply warnings, cap audit debug, DEV preview |
| Roster count | No | Roster and trade team cards indirectly |
| Cap/tax/apron status | No | Cap Sheet and Trade Machine |
| Exceptions/TPEs | No | Cap Sheet and Trade Machine |
| Draft picks/assets | No | Trade, Offseason draft positions, History |
| Pending moves | No | Trade draft, offer sheets, local audit/debug |
| Committed moves | No | History/world events, section aftermath |
| Validation/legal status | No | Trade validation, cap audit/debug |
| Baseline vs active-world deltas | No | History/events and local audit sources indirectly |

## Where Architect Already Feels Continuous

- `GMDashboard` composes every major operating surface in one route-level shell.
- `useArchitectState` centralizes dashboard-visible world state and reload
  behavior.
- `useArchitectActions` centralizes mutation routing and separates committed
  world writes from local validated application.
- World loaders can resolve base, world, parent-world, and player override
  fallback state.
- Mutation pipeline persistence centralizes committed world writes and event
  generation.
- Season advancement uses world metadata as the authoritative season source.
- History has a strong source-truth banner and world-event timeline.
- Free agency, trade, and offseason already gate world-only operations rather
  than pretending no-world mode can do everything.

## UX Fragmentation Findings

1. Operating identity is split across controls.

   The shell has world selection, world date, and selected season, but it does
   not combine them into a human-readable operating identity such as active
   franchise, active world, world season, viewing season, and truth mode.

2. Important franchise state is tab-local.

   Cap/tax/apron state, exceptions, TPEs, roster count, draft assets, validation
   state, and recent moves disappear when the user leaves the relevant tab.

3. Mode language is internally precise but product-fragmented.

   The code distinguishes sandbox, base, world, vacuum, local validated,
   optimistic preview, and DEV preview states. The user sees pieces of this
   vocabulary in different places, but there is no unified operator-facing mode
   model.

4. World season and viewing season can drift without a persistent warning.

   `currentYear` is the dashboard viewing season. `worldCurrentSeason` is
   authoritative world metadata. Offseason handles this distinction, but the
   rest of the shell does not continuously explain it.

5. There is no cross-surface move rail.

   Trade drafts, offer sheets, local audit events, committed world events, and
   season advancement aftermath are not presented as one activity stream.

6. Baseline deltas are not yet an operator concept.

   The system has sources that can support deltas, including world events,
   loaded base/world snapshots, changed-team mutation results, and local audit
   events. It does not yet provide a stable dashboard-level answer to "what has
   changed in this scenario?"

7. League-level context is base-first.

   The league view is useful, but it is not yet a world-aware entry point into an
   active franchise workspace.

## Backend and State Authority Constraints

- Source collections remain read-only. The future operating layer must never
  write to `players_v2`, `architect_basePlayers`, `architect_baseTeams`,
  `architect_baseEntitlements`, or `architect_basePickRules`.
- User-created world content is the writeable authority for scenario state.
- Point-in-time committed world mutations must continue through
  `mutationPipeline`.
- Season advancement must continue through `seasonManager`.
- `mutationPipeline.persist` is the committed mutation write boundary for world
  mutations.
- `worldTeamData` and `teamLoader` are the existing read seams for base/world
  team state.
- `localCapAuditLog` events are explicitly non-authoritative unless linked to a
  committed world transition.
- The vacuum entitlement overlay is local storage only and must not be treated
  as committed world truth.
- DEV offseason preview state is explicitly non-authoritative, non-persistent,
  and must not drive dashboard/world state.
- `baselineCapSheet` and `teamCapSheet` should not be assumed to represent a
  complete original-base versus active-world delta without confirming the load
  point. World events are a better first source for committed scenario history.

## Recommended Stage 1 Boundaries

Stage 1 should be a read-only operating experience layer inside the Architect
dashboard shell.

Recommended scope:

- Add a persistent workspace header or status strip fed by existing
  dashboard state.
- Add an active-world cockpit/summary component that shows active team,
  active world, world date, world season, viewing season, save/loading state,
  and truth mode.
- Add read-only franchise state indicators for roster count, cap/tax/apron
  status, exception/TPE counts, and draft asset summary where reliable data
  already exists.
- Add a read-only scenario/move rail powered first by world events, with local
  audit/preview entries clearly labeled as local or pending.
- Add a presentation seam that translates internal mode concepts into one
  user-facing mode language.
- Compose this layer from `useArchitectState`, existing section-safe selectors,
  world events, local audit events, and canonical cap/roster helpers.

Recommended implementation constraints for the future pass:

- No new mutation authority.
- No new Firestore write path.
- No schema changes for Stage 1 unless a later design explicitly requires them.
- No product redesign of existing tabs before the shell continuity problem is
  solved.
- No attempt to make local preview state look committed.
- No assumption that selected viewing season equals authoritative world season.

Likely future seams:

- `ArchitectWorkspaceHeader` or `ArchitectStatusStrip` in `GMDashboard`.
- `ArchitectWorldCockpit` near the existing world controls.
- `useArchitectWorkspaceContext` or read-only selector helpers under
  `GMDashboard/hooks`.
- `useArchitectModePresentation` to unify world/sandbox/vacuum/preview labels.
- `ScenarioMoveRail` backed by world events and local audit events.
- Delta helpers that start narrow: current team roster/cap deltas and recent
  committed events, not a full league-wide scenario diff.

## Explicit Non-Goals

- Do not implement features as part of this discovery pass.
- Do not refactor `GMDashboard`, hooks, sections, or mutation code in this pass.
- Do not add another mutation pipeline.
- Do not change Firestore schema or collection behavior.
- Do not make the league view world-aware until the dashboard operating layer is
  defined.
- Do not run broad test suites for this docs-only pass.
- Do not treat debug fixtures, DEV preview output, local audit entries, or
  vacuum overlays as committed world truth.

## Open Questions

1. What should the user-facing vocabulary be for no-world operation?

   Current code uses sandbox, base, and vacuum in different places. Stage 1
   needs one product term and a small number of secondary labels.

2. Should the cockpit show world name, branch/source world, and description?

   `useArchitectState` currently exposes world id/date/season. `WorldSelector`
   owns world list metadata. A future cockpit should avoid duplicating metadata
   fetches or creating a competing world metadata owner.

3. What is the minimum reliable draft asset summary for the persistent strip?

   Picks are visible in trade, offseason draft positions, and history, but the
   first version should only summarize data that is already canonical for the
   active world/team.

4. How should pending local actions be represented?

   Trade drafts, offer sheets, optimistic world previews, and local validated
   base/vacuum actions have different lifecycles. A move rail needs explicit
   labels for draft, local-only, pending persistence, committed, and failed.

5. What counts as a baseline delta?

   World events are the safest first source. Snapshot diffing against original
   base, parent world, or latest loaded baseline needs a precise authority
   decision before it appears in a persistent cockpit.

6. Should league view participate in the active-world operating workspace?

   Today it is base/read-only. If the product direction is one continuous
   franchise workspace, league-level world awareness may become a later stage.

## Files Inspected

Primary shell and routing:

- `src/App.tsx`
- `src/pages/GmLeagueView.tsx`
- `src/pages/GmDashboardView.tsx`
- `src/features/architect/GMDashboard/GMDashboard.tsx`

World controls and dashboard components:

- `src/features/architect/GMDashboard/components/WorldSelector.tsx`
- `src/features/architect/GMDashboard/components/WorldTimeControls.tsx`
- `src/features/architect/GMDashboard/components/CapAuditDebugPanel.tsx`
- `src/features/architect/GMDashboard/components/OfferSheetList.tsx`
- `src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx`

Dashboard state and actions:

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.types.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.helpers.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.worldLoader.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.worldTracker.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.types.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.helpers.signing.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.persistenceHelpers.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.tradeActions.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.signingExecution.ts`

Dashboard sections:

- `src/features/architect/GMDashboard/sections/RosterSection.tsx`
- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/GMDashboard/sections/CapTableSection.tsx`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`
- `src/features/architect/GMDashboard/sections/TradeSection.tsx`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/GMDashboard/sections/HistorySection.tsx`

Roster, cap, and free agency:

- `src/features/architect/shared/RosterVisual/RosterVisual.tsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`
- `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPoolHeader.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.tsx`

Trade machine:

- `src/features/architect/tradeMachine/TradeEditor.tsx`
- `src/features/architect/tradeMachine/ValidationStateHeader.tsx`
- `src/features/architect/tradeMachine/ValidationDetailsPanel.tsx`
- `src/features/architect/tradeMachine/TradeReceiptPanel.tsx`
- `src/features/architect/hooks/useTradeMachine.ts`
- `src/features/architect/hooks/useTradeMachineInit.ts`
- `src/features/architect/hooks/useTradeMachineValidation.ts`
- `src/features/architect/hooks/useTradeMachineEntitlementOps.ts`
- `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts`

Offseason and history:

- `src/features/architect/offseason/OffseasonTab/types.ts`
- `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx`
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.helpers.ts`
- `src/features/architect/history/hooks/useWorldTeamEvents.ts`
- `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts`

League view and shared surfaces:

- `src/features/architect/shared/LeagueView/LeagueView.tsx`
- `src/features/architect/shared/LeagueView/LeagueViewTruthPanel.tsx`
- `src/features/architect/shared/LeagueView/leagueViewModel.ts`

State, persistence, and authority:

- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/utils/teamLoader.ts`
- `src/features/architect/utils/worldManager.ts`
- `src/features/architect/utils/worldManager.core.ts`
- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/mutationPipeline.persist.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/utils/capLegality/localCapAuditLog.ts`
