# Architect History / Activity Deep-Link Discovery - Stage 2D

## Executive Summary

Stage 2D should make committed History events deep-linkable from the activity
rail and the post-action handoff without adding any mutation behavior or new
event authority.

The smallest safe implementation is a one-shot "open this committed event in
History" request owned by `GMDashboard`, passed through `HistorySection` and
`TeamHistoryTab`, and consumed by `WorldEventsTimeline` after the requested
event is present in the already-authoritative world-event query. The request
should open `HistoryDetailModal`; it should not navigate to affected players,
contracts, picks, exceptions, cap deltas, or baseline comparison surfaces in
Stage 2D.

The current code already has the right ingredients:

- `GMDashboard` owns `activeTab`, post-action receipts, and receipt-scoped
  highlight state.
- `ScenarioMoveRail` renders committed world events through
  `useScenarioActivityRail` and already receives `highlightEventId`.
- `TeamHistoryTab` owns `selectedEntry` and opens `HistoryDetailModal`.
- `WorldEventsTimeline` already has normalized committed event rows loaded from
  `useWorldTeamEvents`.
- normalized event rows already carry safe event identity, team codes, player
  ids, before/after totals, and display sections.

## Current History / Activity Flow Map

### Committed Mutation To Handoff And Rail

1. A world-backed mutation succeeds through the existing Architect mutation
   owners.
2. The successful result includes committed-world event data for most mutation
   flows.
3. `useArchitectPostActionReceipt` stores a session-scoped receipt and bumps
   `generation`.
4. `ArchitectPostActionHandoff` renders the receipt with navigation-only
   buttons for Cap Sheet, Roster, and History.
5. `ScenarioMoveRail` receives `refreshKey={postActionReceipt.generation}` and
   `highlightEventId={postActionReceipt.receipt?.eventId ?? null}`.
6. `useScenarioActivityRail` calls `useWorldTeamEvents`, normalizes the latest
   committed world events, and renders the first five rows.
7. The rail highlights a row only if the committed row id equals the receipt
   event id.

### Activity Rail To History Today

1. The rail has one "Full History" button.
2. The button calls `onOpenHistory`.
3. `GMDashboard` handles that as `setActiveTab('history')`.
4. No event id is passed.
5. `TeamHistoryTab` opens the History tab root with no selected entry.

Rail rows are visually clickable in spirit but are not action targets today:
the `li` entries do not call a selection or navigation callback.

### Post-Action Handoff To History Today

1. `ArchitectPostActionHandoff` receives `receipt`.
2. The "View History" button calls `onNavigateToHistory`.
3. `GMDashboard` handles that as `setActiveTab('history')`.
4. The receipt's `eventId` is not passed into History.
5. `HistoryDetailModal` remains closed until the user manually clicks a
   timeline row.

### History Timeline To Detail Today

1. `TeamHistoryTab` decides whether the active timeline is world events,
   local/dev fixture timeline entries, or synthesized section-derived rows.
2. In world-event mode, `TeamHistoryTab` renders `WorldEventsTimeline`.
3. `WorldEventsTimeline` fetches events with `useWorldTeamEvents`, normalizes
   them with `normalizeWorldEventsForTeamHistory`, and renders rows.
4. Clicking a row calls `onSelectEntry(entry)`.
5. `TeamHistoryTab` wraps the row with `buildSelectedHistoryEntry` and stores it
   in local `selectedEntry` state.
6. `HistoryDetailModal` opens from that local `selectedEntry`.

## State Ownership Map

| State | Current owner | Stage 2D recommendation |
|---|---|---|
| Active dashboard tab | `GMDashboard` via `useArchitectState` | Keep in `GMDashboard`; deep-link triggers call `setActiveTab('history')`. |
| Post-action receipt | `useArchitectPostActionReceipt` in `GMDashboard` | Keep unchanged; use `receipt.eventId` only as a request input. |
| Rail refresh/highlight | `GMDashboard` passes `generation` and `eventId` into `ScenarioMoveRail` | Keep unchanged; add row click/open callback for committed rows only. |
| Rail event rows | `useScenarioActivityRail` inside `ScenarioMoveRail` | Keep read-only and committed-only. Expose the row `id` only through a click callback. |
| History selected entry | `TeamHistoryTab` local `selectedEntry` | Keep selected entry ownership in `TeamHistoryTab`; add a one-shot external request to select an entry after it loads. |
| World-event fetch and normalized rows | `WorldEventsTimeline` | Keep there for the smallest implementation; let it consume a requested id and call existing `onSelectEntry`. |
| History detail modal open/close | `TeamHistoryTab` through `HistoryDetailModal` props | Keep unchanged; external requests should only set the same `selectedEntry` manual clicks set. |
| Missing requested event feedback | Not present | Add a small non-authoritative status note or silently fall back to the timeline root; do not synthesize a row. |

## Surface-By-Surface Findings

### 1. ScenarioMoveRail To History

`ScenarioMoveRail` can navigate to the History tab today through
`onOpenHistory`, but it cannot request a specific event detail.

It can safely pass a committed event id because every rendered rail entry is
derived from `useWorldTeamEvents` through `useScenarioActivityRail`. The rail
entry id is `TeamHistoryWorldEventRow.id`, which is normalized from
`raw.eventId`, `raw.id`, `operationId`, or a fallback built by the normalizer.
For canonical world events, `eventId` and `id` are stable and match the
Firestore event document id.

Smallest safe change:

- keep the existing "Full History" button as tab-root navigation.
- add an optional `onOpenHistoryEntry(eventId: string)` callback.
- make each committed rail entry a button or otherwise accessible click target.
- pass `entry.id` to the callback.
- in `GMDashboard`, translate that into a one-shot History detail request plus
  `setActiveTab('history')`.

Do not add local/pending entries to the rail. The existing
`localPendingDeferred: true` signal should stay separate.

### 2. Post-Action Handoff To History

The current "View History" button only switches tabs. For receipts with a
non-null `eventId`, it can also request opening the just-written event detail.

The safest request shape is one-shot, scoped, and repeatable even when the same
event is clicked more than once:

```ts
type RequestedHistoryEventDetail = {
  requestKey: number;
  requestedSelectedEntryId: string;
  worldId: string;
  teamCode: string;
  source: 'post-action-handoff' | 'activity-rail';
};
```

`requestKey` should be a monotonically increasing session counter owned by
`GMDashboard`, not a timestamp requirement. `worldId` and `teamCode` make stale
requests ignorable. `source` is diagnostic only and should not change behavior.

Clear behavior:

- clear the request when `worldId` or `teamCode` changes.
- clear the request after `TeamHistoryTab` reports it has handled the matching
  request.
- if `receipt.eventId` is null, fall back to `setActiveTab('history')` with no
  detail request.

Important current limitation: season advance writes a world event in
`seasonManager`, but `WorldAdvanceAftermath` does not expose that event id to
`deriveSeasonAdvanceReceipt`; season-advance receipts currently have
`eventId: null`. Stage 2D should not invent that id. It can either leave season
advance as History-root navigation or separately surface the already-committed
season-advance event id through the existing aftermath type in a later small
slice.

### 3. TeamHistoryTab

`TeamHistoryTab` owns `selectedEntry` today:

- manual local/synthesized rows set `selectedEntry` directly.
- world-event rows are selected through `WorldEventsTimeline.onSelectEntry`.
- `HistoryDetailModal` opens when `selectedEntry` is non-null.

It can accept a one-shot `requestedSelectedEntryId` request without moving
modal ownership out of the History tab. The lowest-risk version passes the
request down to `WorldEventsTimeline`, because that component already owns the
normalized world-event rows.

Recommended behavior:

- only honor requests while the active timeline uses world events.
- match the request against `entry.eventId` and `entry.id`.
- when found, call the same `onSelectEntry(entry)` path used by manual clicks.
- auto-open `HistoryDetailModal` by setting `selectedEntry`.
- call `onRequestedSelectedEntryHandled(requestKey)` once after match.
- if the initial loaded page resolves and the event is missing, do not create a
  synthetic entry. Show a small "requested event was not found in the loaded
  history feed" note or simply leave the timeline root visible, then clear the
  request.

Stage 2D should not require loading every paginated History page to find an old
event. The two Stage 2D sources are fresh post-action receipts and visible rail
entries; both should normally be inside the already loaded first page.

### 4. History Event To Affected Surfaces

Normalized history events currently include:

- safe event identity: `id`, `eventId`, and `operationId`.
- team scope: `teamCodes` and `teamsInvolved`.
- affected player ids: `playerIds` from top-level event fields or metadata.
- cap context: `beforeTotalsByTeam`, `afterTotalsByTeam`, and derived
  `capDelta`.
- display sections for players, picks, contracts, exceptions, teams, and cap
  allocation when the payload has enough display data.
- raw payload for inspection in `HistoryDetailModal`.

They do not currently expose stable, typed navigation targets for:

- entitlement documents or entitlement ids in the normalized row.
- pick entitlement ids or pick inventory row ids.
- contract ids.
- specific cap-table row coordinates.
- baseline or scenario comparison deltas.

Safe now:

- open the committed event detail by event id.
- display teams, players, totals, and raw event payload already carried by the
  selected row.

Defer to Stage 3/4:

- History event to affected player row on Roster or Cap Sheet.
- History event to contract modal.
- History event to entitlement, pick, exception, or cap-hold row.
- History event to Trade Machine draft reconstruction.
- any baseline/cap delta comparison beyond the current detail modal's
  before/after total display.

Stage 2C created a dashboard-level `focusedPlayerId` sink for receipt-derived
player highlighting, but Stage 2D should not combine event-detail opening with
player-surface navigation yet. The authority-safe slice is event detail only.

### 5. Activity Rail Refresh / Highlight

Stage 2B's highlight is enough for freshness: it marks the just-committed
entry only when a committed row matching the receipt event id appears in the
refetched rail. That protects the rail from showing local preview state as
committed truth.

Clicking the highlighted row should open full History detail, but this should
not be special-cased to highlighted rows. Every committed rail entry should use
the same `onOpenHistoryEntry(entry.id)` behavior. The highlight remains a
visual freshness state; row clicks remain read-only navigation.

Local and pending state should remain deferred:

- no local draft rows.
- no optimistic post-action rows.
- no pending activity merged into committed rows.
- no fallback row if Firestore has not returned the event yet.

### 6. Authority Risks

| Risk | Stage 2D constraint |
|---|---|
| New event source sneaks in | Only consume `useWorldTeamEvents` rows and receipt event ids returned by committed mutations. |
| Synthetic History entry appears | Missing requests must fall back to the timeline root or a status note; never create a fake row. |
| Local preview is shown as committed | Keep `localPendingDeferred` separate and do not add pending rail rows. |
| History or rail becomes a mutation surface | New callbacks are navigation/detail-selection only. No mutation callbacks enter rail or History detail. |
| Baseline/cap deltas become overclaimed | Keep existing `HistoryDetailModal` display only; no new delta computation or comparison surface. |
| Player navigation outruns authority | Do not use `playerIds` to open player surfaces in Stage 2D. |
| Request leaks across teams/worlds | Scope requests with `worldId` and `teamCode`; clear on either change. |
| Same event cannot be opened twice | Include `requestKey` so repeated clicks on the same event re-trigger. |
| Requested event is not loaded | Do not paginate indefinitely or synthesize; report missing and clear the one-shot request. |

## Existing Reusable Seams

| Seam | File | Reuse |
|---|---|---|
| `setActiveTab('history')` | `src/features/architect/GMDashboard/GMDashboard.tsx` | Existing navigation authority. |
| `postActionReceipt.receipt?.eventId` | `src/features/architect/GMDashboard/GMDashboard.tsx` | Source for post-action History detail requests when non-null. |
| `postActionReceipt.generation` | `src/features/architect/GMDashboard/GMDashboard.tsx` | Existing rail refresh key. |
| `ScenarioMoveRail.highlightEventId` | `src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx` | Existing committed-row freshness signal. |
| `useScenarioActivityRail` | `src/features/architect/GMDashboard/hooks/useScenarioActivityRail.ts` | Committed-only rail rows; no new fetch source needed. |
| `useWorldTeamEvents.refreshKey` | `src/features/architect/history/hooks/useWorldTeamEvents.ts` | Existing fetch re-run seam. |
| `WorldEventsTimeline.onSelectEntry` | `src/features/architect/history/TeamHistoryTab/WorldEventsTimeline.tsx` | Existing row-to-selected-entry path. |
| `buildSelectedHistoryEntry` | `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.helpers.ts` | Existing truth-kind wrapper for selected rows. |
| `TeamHistoryTab.selectedEntry` | `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx` | Existing modal ownership. |
| `HistoryDetailModal` | `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx` | Existing authoritative detail display. |

## Recommended Stage 2D Implementation Slice

### Slice 1 - Add A Dashboard-Owned History Detail Request

Add a small request state to `GMDashboard`:

- `RequestedHistoryEventDetail | null`.
- a session counter for `requestKey`.
- `requestHistoryEventDetail(eventId, source)` helper.
- an effect that clears the request on `worldId` or `teamCode` changes.

Use this helper from:

- `ArchitectPostActionHandoff` "View History" when `receipt.eventId` exists.
- `ScenarioMoveRail` row clicks when `entry.id` exists.

Fallback to `setActiveTab('history')` when no committed event id is available.

### Slice 2 - Thread The Request Through HistorySection

Add optional props to `HistorySection` and `TeamHistoryTab`:

- `requestedHistoryEventDetail?: RequestedHistoryEventDetail | null`
- `onRequestedHistoryEventDetailHandled?: (requestKey: number) => void`

Keep the prop names local to History if preferred, but preserve the semantics:
one-shot, scoped, and acknowledged after handling.

### Slice 3 - Consume The Request In WorldEventsTimeline

Add request props to `WorldEventsTimeline` and a guarded effect:

- wait until the timeline is not in its initial loading state.
- find a row where `entry.eventId === requestedSelectedEntryId` or
  `entry.id === requestedSelectedEntryId`.
- call `onSelectEntry(entry)` for the match.
- acknowledge the request once.
- if no match exists after the first loaded page, acknowledge and leave the
  timeline root visible.

Do not add broad pagination search for Stage 2D.

### Slice 4 - Make Rail Rows Open History Detail

Add `onOpenHistoryEntry` to `ScenarioMoveRail`.

Render each committed entry with an accessible click target. Keep "Full
History" as the root-history action. The row click should not mutate receipt
state, clear highlights, or alter pending/local activity behavior.

### Suggested Validation For Implementation PR

For the later implementation PR, add targeted tests around:

- post-action handoff passes `receipt.eventId` and opens the detail modal after
  History loads.
- rail entry click requests the matching History detail.
- a missing requested id does not create a synthetic row.
- request clears on world/team switch.
- `eventId: null` falls back to History root.

## Explicit Non-Goals

- No product code in this discovery pass.
- No Firestore writes.
- No new event collection, query contract, or event source.
- No synthetic History entries.
- No local or pending rail entries.
- No mutation callbacks from History, History detail, or the rail.
- No baseline comparison, cap-delta recomputation, or new cap authority.
- No player-focused navigation from History to Roster, Cap Sheet, Cap Table, or
  contract modal.
- No Trade Machine draft reconstruction from a history event.
- No entitlement, pick, contract, exception, or cap-hold deep-linking.
- No changes to source data collections.

## Open Questions

1. Should a missing requested event show a visible note in the History tab, or
   should Stage 2D silently fall back to the timeline root?
2. Should season-advance aftermath expose the already-written event id now, or
   should season-advance History detail opening remain a later follow-up?
3. Should row clicks acknowledge and clear the post-action highlight, or should
   highlight lifetime remain tied only to receipt dismissal/replacement?
4. Should the request type live under `GMDashboard` because it is shell-owned,
   or under History because it is consumed by History?
5. If a request is missing from the first loaded page, should a later Stage 3/4
   slice add an event-id-specific Firestore lookup instead of paginating?

## Files Inspected

| File | Purpose |
|---|---|
| `docs/architect/ARCHITECT_NEXT_ERA_MASTER_PLAN.md` | Staged roadmap and Stage 2/3/4 boundaries. |
| `docs/architect/ARCHITECT_STAGE_2_ACTION_CONTINUITY_DISCOVERY.md` | Prior History/rail deferrals and navigation-only boundaries. |
| `docs/architect/ARCHITECT_STAGE_2B_POST_ACTION_HANDOFF_DISCOVERY.md` | Receipt model, rail refresh/highlight seam, and deferred History deep-link slice. |
| `docs/architect/ARCHITECT_STAGE_2C_PLAYER_ROSTER_CONTINUITY_DISCOVERY.md` | Player-focus sink and explicit Stage 2D coupling notes. |
| `src/features/architect/GMDashboard/GMDashboard.tsx` | Dashboard composition, active tab owner, receipt state, handoff and rail wiring. |
| `src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx` | Rail rendering, refresh/highlight props, committed-only row display. |
| `src/features/architect/GMDashboard/components/ArchitectPostActionHandoff.tsx` | Current History button and receipt display. |
| `src/features/architect/GMDashboard/hooks/useScenarioActivityRail.ts` | Rail state derivation from committed world events. |
| `src/features/architect/GMDashboard/hooks/useArchitectPostActionReceipt.ts` | Receipt lifetime, generation, and world/team scope clearing. |
| `src/features/architect/GMDashboard/postActionHandoff/types.ts` | Receipt event id and player id derivation. |
| `src/features/architect/GMDashboard/sections/HistorySection.tsx` | Pass-through layer from dashboard to `TeamHistoryTab`. |
| `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx` | `selectedEntry` ownership and timeline/detail composition. |
| `src/features/architect/history/TeamHistoryTab/WorldEventsTimeline.tsx` | World-event loading, normalization, and row selection callback. |
| `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx` | Existing authoritative detail display and rendered identifiers. |
| `src/features/architect/history/TeamHistoryTab/types.ts` | Current `TeamHistoryTabProps` and selected-entry types. |
| `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.helpers.ts` | `buildSelectedHistoryEntry` and truth-kind selection wrapper. |
| `src/features/architect/history/hooks/useWorldTeamEvents.ts` | Authoritative/legacy-compatible event fetch and refresh seam. |
| `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts` | Normalized event identity, team/player ids, and display sections. |
| `src/features/architect/utils/mutationPipeline.ts` | Committed mutation result and event return path. |
| `src/features/architect/utils/mutationPipeline.read.persistence.ts` | Canonical event payload shape. |
| `src/features/architect/utils/mutationPipeline.types.result.ts` | World mutation event and writes summary types. |
| `src/features/architect/utils/persistenceContracts/contracts.ts` | Event persistence allowlist. |
| `src/features/architect/utils/seasonManager.ts` | Season advance event write and current event id availability. |
| `src/features/architect/GMDashboard/components/SeasonAdvanceModal.types.ts` | `WorldAdvanceAftermath` currently omits event id. |
| `src/features/architect/GMDashboard/sections/OffseasonSection.tsx` | Season advance aftermath handoff to dashboard receipt derivation. |
