# Architect Post-Action Handoff Discovery — Stage 2B

**Status:** Discovery (read-only pass)
**Branch:** `feature/architect-operating-experience-stage-2b-discovery`
**Stage 1 base:** PR #466 — `useArchitectModePresentation`,
`useArchitectWorkspaceContext`, `ArchitectWorkspaceHeader`,
`useScenarioActivityRail`, `ScenarioMoveRail`
**Stage 2A base:** `onAfterTradeApplied`, `onAfterSigningComplete`,
`onNavigateToCapSheet`, `onNavigateToOffseason`, offseason summary
close-and-navigate

---

## Executive Summary

Stage 1 made Architect visually continuous. Stage 2A made it navigationally
continuous: after a successful trade apply or free-agent signing the user
is dropped on the Cap Sheet, and cockpit chips deep-link the user back to
the surfaces where the relevant action lives. What Stage 2A did **not** do
is explain to the user *what just happened*.

Today the post-action feedback model is uniformly thin: a single generic
`toast.success('Saved changes')` for the trade and signing flows, a thrown
toast on failure, and an asynchronous reload of `teamCapSheet`. The trade
machine clears its own preview state. The activity rail is supposed to be
the running record of committed activity, but `useWorldTeamEvents` is a
fire-once fetch with no refetch trigger and no external invalidation —
after a successful commit the rail still shows the pre-action timeline
until the user manually unmounts and remounts the dashboard (e.g. world or
team switch).

Stage 2B should explore whether a compact, post-action *handoff* surface
can close that gap **without** inventing new event truth, duplicating
mutation receipts, or shifting authority into UI. The opportunity is
real: `mutationPipeline` already returns a structured
`{ changedTeams, changedPlayers, event, worldPatch, writesSummary }` on
success, and the offseason flow already builds a structured
`offseasonSummary`. None of that data is currently surfaced as a unified
operating signal — it is either consumed silently to refresh state or
shown inside a one-shot modal that disappears the moment the user
dismisses it.

The intended Stage 2B shape is therefore: read existing committed receipts
that the action layer already produces, render a compact post-action
*confirmation strip* (changed teams, primary affected players,
authoritative event id) that links to Cap Sheet, Roster, and History, and
add a single explicit *refresh seam* so the activity rail reflects the
just-committed event without inventing its own event source.

---

## Current Post-Action Flow Map

```
Trade apply (TradeEditor → onApplyTrade → applyTradeToCapSheet)
  │ mutationPipeline.applyWorldMutation → returns {success, changedTeams,
  │   changedPlayers, event, worldPatch, eventWritten, writesSummary}
  │ persistenceHelpers → toast.success('Saved changes')   ← only feedback
  │ reloadActiveWorldTeamData → refreshes teamCapSheet asynchronously
  │ TradeEditor catch-block on throw → toast.error(...)
  │ Stage 2A: onAfterTradeApplied → setActiveTab('cap')   ← nav only
  └─ ScenarioMoveRail does NOT refetch (useWorldTeamEvents is fire-once)

Free-agent signing (FreeAgencySection → dualPathSigning.signFreeAgent)
  │ handleSign → mutationPipeline → returns {success, message, …}
  │ persistenceHelpers → toast.success('Saved changes')   ← only feedback
  │ teamCapSheet reload via committed snapshot resolution
  │ Stage 2A: result.success → onAfterSigningComplete → setActiveTab('cap')
  └─ ScenarioMoveRail does NOT refetch

Offseason season advance (OffseasonSection → SeasonAdvanceModal)
  │ committed via mutationPipeline; returns SeasonAdvanceResult with
  │   worldAdvanceAftermath: {nextWorldSeason, nextViewingYear,
  │   offseasonSummary, committedTeamCapSheet}
  │ applyCommittedWorldAdvanceAftermath →
  │   setTeamCapSheet, setCurrentYear, setOffseasonRun(true),
  │   setOffseasonSummary, setShowOffseasonModal(true)
  │ GMDashboard renders inline offseasonSummary modal (declined options,
  │   expired contracts, expired TPEs, ongoing dead cap, MLE reset flag)
  │ Stage 2A: Close → closeOffseasonModal + setActiveTab('cap')
  └─ ScenarioMoveRail does NOT refetch the season-advance event

Other contract actions (waive, extend, option decision, renounce,
sign-and-trade, store/match/decline offer sheet, manual exception/dead-cap)
  │ all go through persistenceHelpers.persistMutationWithSync →
  │   toast.success('Saved changes') on truth.ok, toast.error otherwise
  │ teamCapSheet reload follows
  └─ No post-action handoff; user remains on the surface that initiated
     the action.
```

---

## Surface-by-Surface Findings

### 1. Trade apply — post-action feedback

**What the user sees today:**

- A single generic `toast.success('Saved changes')` from
  `persistenceHelpers.persistMutationWithSync` ([persistenceHelpers.ts:402](src/features/architect/GMDashboard/hooks/useArchitectActions.persistenceHelpers.ts#L402)).
- After Stage 2A: the active tab switches to Cap Sheet.
- The cap sheet eventually reflects the trade once `reloadActiveWorldTeamData`
  resolves.
- TradeEditor still holds the *pre-apply* validation/preview panel until
  the user manually resets or re-validates; the validation header shows
  "Validated" against a draft that is no longer the latest world truth.

**What the user does not see:**

- Which teams changed.
- Which players moved or which entitlements transferred.
- A pointer back to the just-written world event in History.
- A confirmation that the rail/timeline now contains the new entry (it
  does not, until the rail's `useWorldTeamEvents` hook is unmounted or
  its inputs change).
- The post-commit `event.id` returned by the mutation pipeline, which
  would be the natural deep-link target for "View in History".

**Reusable signals already produced:**

- `ArchitectMutationResult.changedTeams` (committed team snapshots keyed
  by team code) — produced by `applyWorldMutation`, currently consumed
  only to drive the dashboard state reload.
- `ArchitectMutationResult.changedPlayers` — same provenance.
- `ArchitectMutationResult.event` — the committed world event, including
  its id, type, summary, and occurredAt.
- `writesSummary` — `{ teamsWritten, eventsWritten, worldStatsUpdated, … }`.

These already exist on the success path. They are simply not threaded
back through `applyTradeToCapSheet`'s `Promise<void>` signature; the
TradeEditor only sees that the await resolved.

### 2. Free-agent signing — post-action feedback

**What the user sees today:**

- Same `toast.success('Saved changes')` as the trade flow.
- After Stage 2A: active tab switches to Cap Sheet.
- Cap sheet rerenders with the signed player.

**What the user does not see:**

- Which exception was used (MLE / BAE / Room / TPE / cap space) — this is
  high-value information the cap sheet itself only renders implicitly
  through cap totals delta.
- The contract terms as committed (years, total, cap holds resolved).
- Whether the signing pushed the team across a tax / apron line. The
  workspace header reflects this on next render, but there is no flagged
  "you crossed first apron" callout.
- A pointer back to the signing event in History.

**Reusable signals already produced:**

- `handleSign` returns `MutationActionResult` (`{ success, message,
  propagationMode, committedTeam, … }`) and the wider
  `applyWorldMutation` result contains the same `changedTeams` /
  `changedPlayers` / `event` payload as the trade flow.
- The workspace cap context already exposes apron-crossing flags
  (`isAtOrAboveFirstApron`, `isAboveSecondApron`) — what is missing is
  the *delta* against pre-action posture.

### 3. Offseason season advance — post-action feedback

**What the user sees today:**

- `OffseasonSummary` modal: declined options, expired contracts, expired
  TPEs, ongoing dead cap rows, and an "MLE reset for new season" flag.
- After Stage 2A close: navigates to Cap Sheet of the new season.
- Workspace header shows the new season label; season-mismatch chip
  resolves because viewing season was advanced to match world.

**What the user does not see after dismissal:**

- The summary is consumed and gone. There is no persistent badge on the
  workspace header saying "this team just advanced to 2027 — *N* expired,
  *M* declined, *K* TPEs lapsed".
- The activity rail does not show a "Season Advanced" entry until the
  next remount of `useWorldTeamEvents`.
- The new-season cap sheet does not differentiate "this is new because of
  the advance" rows from baseline rows.

**Reusable signals already produced:**

- `WorldAdvanceAftermath` carries the full summary, `nextWorldSeason`,
  `nextViewingYear`, and `committedTeamCapSheet`. The pipeline persists a
  `seasonAdvanced` (or analogous) world event that is fetchable via
  `useWorldTeamEvents`.
- `setOffseasonRun(true)` is already raised — it could feed a sticky
  "season advance just completed" indicator on the workspace header.

### 4. ScenarioMoveRail — update timing

**Current behaviour:**

- `useWorldTeamEvents` runs a single `fetchWorldTeamEvents` call inside
  a `useEffect` keyed only on `worldId`, `teamCode`, `limit`, and
  `enabled` ([useWorldTeamEvents.ts:505-563](src/features/architect/history/hooks/useWorldTeamEvents.ts#L505-L563)).
- There is no `refetch` callback exposed, no realtime subscription, and
  no external invalidation seam. `loadMore` only appends pages — it does
  not refresh the head of the timeline.
- Consequence: after a successful commit, the rail's `entries` array is
  the snapshot taken *before* the action. The user moves to Cap Sheet
  (Stage 2A), sees updated cap, returns to the rail, and the entry they
  just produced is still missing.
- The only way to see the new entry on the rail today is to switch the
  world or the team in the selector, which unmounts the rail.

**Safe-without-inventing-truth options:**

- Add a `refetch()` to `useWorldTeamEvents` and expose it through
  `useScenarioActivityRail` so the dashboard can trigger a re-read after
  a successful commit. Truth source is unchanged — still
  `fetchWorldTeamEvents`.
- Optionally bump a `worldMutationGeneration` counter on
  `useArchitectState` whenever a committed mutation resolves
  successfully; thread it as an extra effect dependency. This is
  authority-neutral — the counter only triggers a reread, it does not
  add new event data.
- Highlight the *most recent* rail entry (visual freshness) only when its
  `event.id` matches the just-committed event id returned by the
  pipeline. No new event truth is invented; the highlight is derived
  from data the pipeline already provided.

**Not safe:**

- Synthesising a "pending" rail entry from local trade/signing payloads
  before the world event is confirmed. This would directly violate the
  authority risk noted in the Stage 2 discovery
  ([authority risks](#authority-risks)).

### 5. Existing receipt / success surfaces

| Surface | Path | Purpose | Authority |
|---|---|---|---|
| `TradeReceiptPanel` | `tradeMachine/TradeReceiptPanel.tsx` | DEV-only diagnostic inside the *pre-apply* `ValidationDetailsPanel` | Pre-commit local preview; not a post-apply receipt |
| `toast.success('Saved changes')` | `persistenceHelpers.ts:402, 719`, `signingExecution.ts:256`, `offerSheetExecutors.ts:269, 493`, `tradeActions.ts:646` | Generic save confirmation | Generic — no per-action detail |
| `toast.error(...)` | same files | Failure feedback | OK; already routed through `reportMutationError` |
| `ArchitectMutationResult` | `mutationPipeline.ts:764-775` | Structured post-commit receipt: `changedTeams`, `changedPlayers`, `event`, `worldPatch`, `writesSummary`, `warnings` | Authoritative post-commit; **not surfaced to UI today** |
| `WorldAdvanceAftermath` | `OffseasonSection.tsx:223-234`, `SeasonAdvanceModal` | Season advance summary + next-state pointers | Authoritative; consumed transiently in modal then discarded |
| Inline offseason summary modal | `GMDashboard.tsx:583-650` | Lists declined options, expired contracts, expired TPEs, dead cap, MLE flag | Authoritative; modal-only, no persistence |
| `ScenarioMoveRail` | `components/ScenarioMoveRail.tsx` | Committed world events for the active team | Authoritative; but stale post-commit (see §4) |
| `WorldEventsTimeline` (History tab) | `history/TeamHistoryTab/WorldEventsTimeline.tsx` | Full committed event timeline | Authoritative; only visible inside the History tab |
| `HistoryDetailModal` | `history/TeamHistoryTab/HistoryDetailModal.tsx` | Per-event detail view | Authoritative; reachable only by clicking a timeline row |
| `CapAuditDebugPanel` | `GMDashboard/components/CapAuditDebugPanel.tsx` | DEV-only audit log | Local audit; not a user-facing receipt |
| `console.log('✅ Saved …')` | `persistenceHelpers.ts:401` | Developer diagnostic | Not user-facing |

The Architect already produces authoritative, structured post-commit
receipts at every committed write path. They are simply not threaded
into the UI as a coherent post-action handoff.

---

## Recommended Stage 2B Implementation Slice

**Goal:** Give the user a compact, authority-respecting confirmation
of *what just changed* immediately after a successful committed
mutation, with direct links to Cap Sheet, Roster, and History — and
keep the activity rail honest by re-reading committed events after a
commit.

### Slice 1 — Threading the existing receipt to the dashboard

Make `applyTradeToCapSheet`, `handleSign`, `handleSignAndTrade`, the
offer-sheet executors, and `applyCommittedWorldAdvanceAftermath` return
or publish a small `ArchitectPostActionReceipt` shape derived from
data the pipeline already produced:

```
type ArchitectPostActionReceipt = {
  kind: 'trade' | 'signing' | 'signAndTrade' | 'offerSheet' |
        'contractAction' | 'seasonAdvance' | 'manualCapEntry';
  eventId: string | null;          // from result.event.id
  occurredAt: string | null;       // from result.event.occurredAt
  changedTeamCodes: string[];      // keys of result.changedTeams
  primaryTeamCode: string | null;  // active team this dashboard runs
  primaryPlayerIds: string[];      // subset of changedPlayers tied to action
  headline: string;                // 'Trade applied', 'Signed J. Doe', …
  capDelta?: { … } | null;         // derived from changedTeams[primary]
                                   //   capTotals snapshot vs prior
  apronCrossing?: 'firstApron' | 'secondApron' | null;
  exceptionConsumed?: 'MLE'|'BAE'|'Room'|'TPE'|'capSpace'|'minSalary'|null;
};
```

No new mutation authority; all fields are pure derivations of the
pipeline result. The receipt lives on the dashboard, not on per-section
state.

### Slice 2 — `ArchitectPostActionHandoff` strip

A single-row banner anchored under `ArchitectWorkspaceHeader`, rendered
only when the dashboard holds the most recent `ArchitectPostActionReceipt`
and the user has not yet dismissed it.

Contents (compact, max one line on desktop):

- a small "Committed" tone chip (re-using the existing mode tone palette)
- the headline (`Trade applied` / `Signed J. Doe (Non-Tax MLE)`)
- changed-team chips (max 3, "+N" if more)
- a `View on Cap Sheet` link (`setActiveTab('cap')`)
- a `View on Roster` link (`setActiveTab('roster')`)
- a `View in History` link (`setActiveTab('history')` + emit a
  `selectedEntryId` request — see Slice 4)
- a dismiss `×`

The strip auto-dismisses on the next route change or after a successful
follow-on commit, and is replaced (not stacked) by newer receipts.

### Slice 3 — Activity rail refresh seam

Extend `useWorldTeamEvents` with a `refetch()` callback (no API
surface change to the truth source). Expose it through
`useScenarioActivityRail`. Have `useArchitectActions` invoke it (or
bump a generation counter that the rail listens to) after any
successful commit. Highlight the rail entry whose `event.id` matches
`ArchitectPostActionReceipt.eventId` until the receipt is dismissed.

### Slice 4 — History deep-link entry

Add an optional `requestedSelectedEntryId` prop to `HistorySection` /
`TeamHistoryTab` so the post-action handoff's "View in History" link can
auto-open `HistoryDetailModal` for the just-written event. The Stage 2
discovery already lists this as a deferred Stage 2A/2B item.

### Slice 5 — Offseason aftermath sticky badge

After the offseason summary modal is dismissed, retain the
`offseasonSummary` until the user takes another action. Render a small
"Season Advanced — N expired, M declined, MLE reset" chip on the
workspace header (next to the season indicators) that re-opens the
summary modal on click. Clears when the next committed mutation lands
or when the user explicitly dismisses it.

### Scope check

- Slices 1, 2, and 3 are the core Stage 2B candidate.
- Slice 4 is a small additive deep-link; safe to bundle.
- Slice 5 may be deferred to a Stage 2B follow-up if it complicates the
  initial PR.
- All five slices are derivations of existing committed data. None of
  them create new event sources, new mutation routes, new Firestore
  reads/writes, or new schema.

---

## Explicit Non-Goals

- Do **not** synthesise pending or optimistic rail entries from local
  trade/signing payloads before world commit.
- Do **not** present pre-apply `TradeReceiptPanel` data as a committed
  receipt. Its scope is the *draft*; reusing it as a post-commit surface
  would conflate authorities.
- Do **not** create a separate "Architect Activity Stream" collection or
  any new Firestore write. The post-action handoff is purely a UI
  derivation.
- Do **not** add a per-section banner. The handoff lives once, on the
  dashboard shell, beneath the workspace header.
- Do **not** persist `ArchitectPostActionReceipt` outside React state.
  It is intentionally session-scoped and clears on world/team switch.
- Do **not** modify `mutationPipeline`, `seasonManager`, or `worldManager`
  to add fields. The slice should consume what they already return.
- Do **not** add a new toast pattern. The compact strip *replaces* the
  generic "Saved changes" toast as the primary post-commit confirmation
  for the targeted flows; the toast can remain for contract-action
  detail flows that do not yet have a handoff entry.
- Do **not** introduce a new history-tab selection state seam without
  first confirming `TeamHistoryTab` can accept and clear the prop
  cleanly. If it cannot, defer Slice 4.
- Do **not** change validation, legality, or apron-crossing computation.
  Apron-crossing in the receipt is read from `changedTeams[primary]` cap
  totals — no recomputation in the UI.

---

## Authority Risks

| Risk | Mitigation |
|---|---|
| Receipt strip drifts out of sync with committed truth | Receipt id == `result.event.id`; the strip is hidden if the next render shows no matching event in the rail / history within a small grace window |
| Treating local trade preview as committed receipt | Slice 1 explicitly derives the receipt from `ArchitectMutationResult`, not from local trade state; the strip never renders for failed/throwing applies |
| Activity rail refetch races with the just-written event being fully indexed | Refetch on a small debounce after commit, retain the prior result, and prefer the refetched list only when it contains `result.event.id`. Otherwise keep showing the prior list — never blank the rail. |
| Apron-crossing or exception-consumed claim is wrong | Derive only from canonical fields on `changedTeams[primary]` cap totals (`isAtOrAboveFirstApron`, `isAboveSecondApron`) compared to the pre-action snapshot the dashboard already held in `teamCapSheet`. Do not compute apron thresholds in UI. |
| Offseason badge persists across season switches | Tie the badge to `worldCurrentSeason`; clear it whenever `worldCurrentSeason` changes again or another committed event lands |
| History deep-link state leaks across worlds/teams | Clear `requestedSelectedEntryId` whenever `worldId` or `teamCode` changes, before `TeamHistoryTab` consumes it |
| Duplicate receipts on a sign-and-trade (both signing and trade events) | Coalesce by `event.id`. Sign-and-trade returns a single event from `applyWorldMutation`; if a future flow emits multiple, prefer the latest by `occurredAt`. |
| Stage 2B accidentally becomes an action surface | The handoff strip has no mutation callbacks. Its only callbacks are `setActiveTab(...)` and a dismiss. Match Stage 2A's prop discipline. |

---

## Open Questions

1. **Receipt source-of-truth threading.** Should `applyTradeToCapSheet`
   change its signature from `Promise<void>` to
   `Promise<ArchitectPostActionReceipt | null>`, or should the receipt be
   published via a dashboard state setter held inside `useArchitectActions`?
   The setter approach avoids touching the action signatures that the
   guardrail test pins.

2. **Per-action handoff vs. universal strip.** Should *every* committed
   mutation produce a handoff strip, or only the high-traffic five
   (trade, FA signing, sign-and-trade, season advance, offer-sheet
   match)? A universal strip is simpler but may feel noisy for waive /
   extend / option-decision flows that already land the user back on the
   Cap Sheet where the result is visible.

3. **Strip placement.** Beneath `ArchitectWorkspaceHeader` (compact,
   one row) vs. as a sticky toast in the activity rail's first row. The
   header-anchored option keeps post-action signal close to identity /
   mode signal; the rail-anchored option keeps activity in one spatial
   region.

4. **Cap-delta scope.** Cap-delta in the receipt should show the team's
   cap-space, tax-space, and apron-state delta. Should it also show
   exception-pool delta (MLE/BAE/Room remaining)? Those values live on
   the team cap sheet and would be authority-safe; the question is
   density.

5. **Rail-refetch implementation.** Refetch via a new `refetch()`
   callback vs. invalidating via a generation counter on
   `useArchitectState`. The counter is less invasive to
   `useWorldTeamEvents` but requires every consumer of the rail hook to
   be aware of it.

6. **Receipt lifetime.** Auto-dismiss after the next route change,
   after a follow-on commit, or only on explicit dismiss? Auto-dismiss
   on tab change conflicts with the Stage 2A flow (the handoff itself
   triggers a tab change to Cap Sheet). The safer default is
   *auto-dismiss on the next committed mutation* and *manual dismiss*
   otherwise.

7. **Offseason aftermath persistence.** Should the offseason summary
   modal be reopenable from the workspace badge for the rest of the
   session, or only until the next committed mutation? The latter is
   consistent with the rest of the handoff lifetime.

8. **History-tab selection seam.** `TeamHistoryTab` currently owns
   `selectedEntry` via local state. Accepting an outside-requested
   entry id requires either lifting state up or treating the prop as a
   one-shot trigger. Which is preferred?

9. **Toast deprecation strategy.** When the handoff strip ships for the
   trade and signing flows, should `toast.success('Saved changes')`
   still fire alongside, fire only for non-handoff flows, or be removed
   entirely? Removing it for handoff flows avoids duplicate confirmation
   but may surprise users who rely on the corner toast as the standard
   "ack".

---

## Files Inspected

| File | Purpose in this discovery |
|---|---|
| `docs/architect/ARCHITECT_NEXT_ERA_MASTER_PLAN.md` | Staged roadmap and Stage 2 framing |
| `docs/architect/ARCHITECT_STAGE_2_ACTION_CONTINUITY_DISCOVERY.md` | Prior discovery, Stage 2A boundaries, deferred items |
| `src/features/architect/GMDashboard/GMDashboard.tsx` | Composition shell, Stage 2A wiring, offseason summary modal |
| `src/features/architect/GMDashboard/components/ArchitectWorkspaceHeader.tsx` | Stage 1B/1C header, Stage 2A nav affordances |
| `src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx` | Stage 1D rail rendering |
| `src/features/architect/GMDashboard/hooks/useScenarioActivityRail.ts` | Rail state derivation; loads via `useWorldTeamEvents` |
| `src/features/architect/history/hooks/useWorldTeamEvents.ts` | Confirms fire-once fetch, no refetch seam |
| `src/features/architect/GMDashboard/sections/TradeSection.tsx` | Stage 2A `onAfterTradeApplied` plumbing |
| `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx` | Stage 2A `onAfterSigningComplete` plumbing |
| `src/features/architect/GMDashboard/sections/OffseasonSection.tsx` | `applyCommittedWorldAdvanceAftermath`, summary handoff shape |
| `src/features/architect/tradeMachine/TradeEditor.tsx` | Apply-trade try/catch, post-apply hook point |
| `src/features/architect/tradeMachine/TradeReceiptPanel.tsx` | Confirms it is a pre-apply diagnostic, **not** a post-commit receipt |
| `src/features/architect/tradeMachine/ValidationDetailsPanel.tsx` | Hosts `TradeReceiptPanel` under a `DEBUG` section header |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.tradeActions.ts` | `applyTradeToCapSheet` signature, post-commit toast |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.persistenceHelpers.ts` | Centralised success/error toasts, mutation truth resolution |
| `src/features/architect/utils/mutationPipeline.ts` | Confirms `changedTeams`, `changedPlayers`, `event`, `writesSummary` already returned |
| `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx` | History selection state shape; deep-link feasibility |
