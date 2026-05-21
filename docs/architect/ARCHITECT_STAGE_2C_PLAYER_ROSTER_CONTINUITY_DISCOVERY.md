# Architect Player / Roster Continuity Discovery — Stage 2C

**Status:** Discovery (read-only pass)
**Branch:** `feature/architect-operating-experience-stage-2c-discovery`
**Stage 1 base:** PR #466 — `useArchitectModePresentation`,
`useArchitectWorkspaceContext`, `ArchitectWorkspaceHeader`,
`useScenarioActivityRail`, `ScenarioMoveRail`
**Stage 2A base:** `onAfterTradeApplied`, `onAfterSigningComplete`,
`onNavigateToCapSheet`, `onNavigateToOffseason`, offseason summary
close-and-navigate
**Stage 2B base:** `ArchitectPostActionReceipt`, `ArchitectPostActionHandoff`,
`useArchitectPostActionReceipt`, rail `refreshKey` + `highlightEventId`,
`deriveSeasonAdvanceReceipt`

---

## Executive Summary

Stage 1 made Architect visually continuous (the workspace header and
move rail keep team/world/mode/recent activity in front of the user at
all times). Stage 2A made it navigationally continuous (post-action
tab switches + cockpit chips that deep-link into the surfaces where
the relevant action lives). Stage 2B made *commit moments* continuous
(a receipt strip that says *what just changed*, tied to
`ArchitectMutationResult` / `WorldAdvanceAftermath` truth, plus a rail
refresh seam keyed off the just-committed event id).

What Stage 2A/2B did **not** do is make *player and roster objects*
feel continuous across surfaces. The Cap Sheet and Full Cap Table
already treat a player row as an *actionable* identity — clicking
opens [EditContractModal](src/shared/components/EditContractModal.tsx)
through [`handleEditContract`](src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts#L235-L248)
or [`handleCapTableModalAction`](src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts#L430-L452).
Every other surface treats the player as a *visual* identity only:

- [RosterVisual](src/features/architect/shared/RosterVisual/RosterVisual.tsx)
  renders `StarterCard`/`RotationCard`/`BenchCard` with
  `isExport: true` so even the legacy roster mutation controls
  (`onRemove`/`onAdd`) are explicitly suppressed. There is no
  contract-modal opener, no Cap Sheet jump, no Trade Machine handoff.
- The post-action handoff strip points the user at "View Roster" but
  Roster does not highlight, scroll-to, or otherwise acknowledge the
  player that was just signed/traded.
- The Trade Machine has rich internal player composition
  (`setPlayerTrade`/`useTradeMachine`) but no entry seam for
  initialising a draft with a specific player; the only way in is to
  open Trade Machine, select teams, and find the player inside the
  team card.
- History events already carry `playerIds` and a normalised
  `playerNameLookup` — the modal renders them — but there is no
  inverse direction from a player on roster/cap sheet back into the
  history detail for that player.

Stage 2C should make a *player identity* legible and reachable from
every surface where the dashboard already knows about that player,
**without** adding any new mutation authority, any new Firestore
read/write path, or any trade prefill that would require expanding
`useTradeMachine`'s init contract. The expected shape is: route the
existing contract-modal opener from Roster, surface a session-scoped
`focusedPlayerId` so the post-action handoff can highlight the
just-changed player on Roster and Cap Sheet, and confirm that the
remaining seams (trade prefill, history → player deep link) stay
deferred until after Stage 2C ships.

---

## Current Player / Roster Continuity Map

```
Roster tab
  RosterVisual → RosterSection (isExport: true)
    StarterCard / RotationCard / BenchCard
      visual only — no onClick, no onOpenPlayerContractModal,
        no onNavigate
  → DEAD-END for player action / navigation

Cap Sheet tab (selected-year view)
  CapSheetSection → CapSheet
    onOpenPlayerContractModal = handleEditContract
      → openPlayerContractModalRoute → EditContractModal
  → ACTIONABLE: contract modal opens with full identity context

Full Cap Table tab (multi-year view)
  CapTableSection → CapSheetFull
    onOpenPlayerContractModal = handleEditContract
    onLaunchContractAction   = handleCapTableModalAction
      → option | freeAgent context, future-year aware
    onRenounceCapHold        = handleCapHoldRenounce
  → ACTIONABLE: all current-row + future-row identity actions reach
     useArchitectActions through dashboard-owned callbacks

Trade Machine tab
  TradeSection → TradeEditor → useTradeMachine
    setPlayerTrade(index, player, 'trade' | 'signAndTrade' | …)
    onEditContract = handleEditContract (already wired)
  → ACTIONABLE from inside trade card, but ZERO entry seam for
    initialising a trade from elsewhere

Free Agency tab
  FreeAgencySection → FreeAgentPool
    actionOwner.dualPathSigning.signFreeAgent (wrapped to trigger
       Stage 2A onAfterSigningComplete + Stage 2B post-action receipt)
  → POST-SIGN handoff hands the user to Cap Sheet via Stage 2A and
    publishes a receipt with primaryPlayerIds via Stage 2B, but
    neither Cap Sheet nor Roster *highlight* the signed player

Offseason tab
  OffseasonSection → SeasonAdvanceModal
    aftermath → applyCommittedWorldAdvanceAftermath
    Stage 2B receipt derived via deriveSeasonAdvanceReceipt
  → seasonAdvance receipt carries no playerIds today (intentional —
    expired/declined/option-lapsed players are listed only in
    offseasonSummary modal, not in the receipt)

History tab
  TeamHistoryTab → WorldEventsTimeline → HistoryDetailModal
    normalized entries already carry playerIds + playerName lookup
    HistoryDetailModal lists "Players: J. Doe (id)" lines
  → DEAD-END: there is no "View on Roster" / "View on Cap Sheet"
    link from a history entry's player line

ArchitectPostActionHandoff strip
  receipt.primaryPlayerIds   ← changedPlayers from mutationPipeline
  receipt.changedTeamCodes   ← changedTeams from mutationPipeline
  View Cap Sheet / View Roster / View History buttons
  → navigation only; no player-focus state is carried into the
    destination surface
```

---

## Surface-by-Surface Findings

### 1. Roster surface

**Is Roster currently display-only?** Yes — completely. The dashboard
passes only `teamCapSheet`, `playersMap`, and `teamId` to
[`RosterSection`](src/features/architect/GMDashboard/sections/RosterSection.tsx)
(no action callbacks), and that wrapper forwards into
[`RosterVisual`](src/features/architect/shared/RosterVisual/RosterVisual.tsx),
which composes the legacy
[`@/features/roster/RosterSection`](src/features/roster/RosterSection/index.tsx)
with `LEGACY_ROSTER_DISPLAY_ONLY_PROPS = { isExport: true }`. That
flag suppresses the legacy roster's own `onRemove`/`onAdd` controls,
so even the *legacy* mutation surface is silenced.

The card components themselves
([`StarterCard`](src/features/roster/RosterSection/StarterCard.tsx),
`RotationCard`, `BenchCard`) currently render the headshot, position
chip, and `PlayerNameMini` with no `onClick`, no anchor wrapping, and
no callback prop for "open this player's contract."

**Can a user open the existing contract/action modal from a roster
player?** Not today. `handleEditContract` is already constructed in
`GMDashboard` and threaded into `CapSheetSection` /
`CapTableSection`, but the dashboard does not pass it through
`RosterSection`, and the card primitives don't accept a click
callback.

**Can a user navigate from a roster player to Cap Sheet or Full Cap
Table context?** No. There is no `setActiveTab('cap')`-with-player
seam. The handoff strip's "View Roster" button (Stage 2B) goes one
way only.

**What player identity fields are available and reliable?** From the
`RosterVisual` lookup helpers and `mergeRosterMemberDetails`:

| Field | Notes | Reliability |
|---|---|---|
| `member.id` / `member.player_id` / `member.bio.playerId` | Canonical player id from cap sheet snapshot. RosterVisual deduplicates across keys via `getDetailLookupKeys`. | Reliable when present, but at least one of the three is always present on roster members |
| `member.name` / `member.displayName` / `member.bio.displayName` | Display name resolution falls back across all three, plus the players-map detail bio | Reliable |
| `member.bio.position` / `member.formattedPosition` | Position label resolution via `getPlayerPositionLabel` | Reliable for display only |
| `member.contract.contractType` / `signedUsing` | Used downstream to flag two-way contracts; not needed for navigation | Reliable for filtering |

The `getDetailLookupKeys` helper already returns a normalised set of
keys per player; the same helper is what Stage 2C should reuse if the
post-action receipt's `primaryPlayerIds` needs to be matched against a
rendered card.

### 2. Cap Sheet

**What player-row actions already exist?**
[`CapSheet`](src/features/architect/capSheet/CapSheet/CapSheet.tsx)
forwards a single `onOpenPlayerContractModal` callback to its rows.
The dashboard binds it to `handleEditContract`, which calls
`openPlayerContractModalRoute` (in `useArchitectActions.persistenceHelpers.ts`).
That route owns the modal open/close, target-year and action-context
defaults, and selected-player state.

**Can users open contract modal, waive, extend, option, renounce,
etc. through existing owners?** Yes — but only by going through the
modal. The dashboard does not expose the underlying mutation handlers
(`handleWaiveContract`, `handleExtendContract`, `handleOptionDecision`,
`handleRenounceRights`) directly to Cap Sheet rows; they are reached
*via* the contract modal's action selector. This is the right
authority shape and Stage 2C must preserve it: roster/cap-sheet clicks
open the modal; the modal owns the action commit.

**Where does the user dead-end after inspecting a player?** Today,
clicking a Cap Sheet row opens the modal; cancelling the modal
returns to Cap Sheet. The user has no way to say "show this same
player on Roster" or "show this same player on Full Cap Table." That
is the asymmetry Stage 2C should close (Roster needs *inbound* modal
access; Cap Sheet/CapTable need *no new action authority* but could
benefit from highlighting the post-action player).

### 3. Full Cap Table

**What player-row actions already exist?**
[`CapSheetFull`](src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx)
exposes three callbacks already wired by `GMDashboard`:

- `onOpenPlayerContractModal` → `handleEditContract`
- `onLaunchContractAction(player, action, year)` → `handleCapTableModalAction`
  (routes to the modal with target-year + `actionContext`
  `option`/`freeAgent`)
- `onRenounceCapHold(capHold)` → `handleCapHoldRenounce` (confirms
  and routes to `confirmAndRenounceRights` mutation)

**Can users launch existing contract actions?** Yes, for the
multi-year future view. Future-year cells launch the modal with the
correct `targetYear`/`actionContext`, so option decisions and FA
context (UFA/RFA) carry properly through `useArchitectModals` →
`EditContractModal`.

**Is player identity continuous between future-year rows and current
roster state?** It is *visually* identical (same player object,
same id), but it is *not yet handoff-aware*: a player visible on a
future-year row in Full Cap Table has no link back to either Roster
or current-year Cap Sheet. Stage 2C should treat this as in-scope
because the seams are already accepting callbacks (just none for
"navigate to roster/cap with player focus").

### 4. Trade Machine

**Can a user start a trade from a player context safely?** Not from
outside Trade Machine. The
[`useTradeMachine`](src/features/architect/hooks/useTradeMachine.ts)
hook owns the team-slot state. Trade composition happens through
`setPlayerTrade(index, player, action, destTeamId)` in
[`useTradeMachinePlayerOps`](src/features/architect/hooks/useTradeMachinePlayerOps.ts),
which is internal to `TradeEditor`. There is no exported imperative
seam such as `addPlayerToTrade(playerId)` or initialState/prefill
prop on `TradeEditor`.

**Are there existing callbacks or selectors for adding a player to a
trade?** No outward-facing seam. Adding a player from outside Trade
Machine would require either:

1. Lifting `setPlayerTrade` (or a wrapper) out of `useTradeMachine`,
   which expands the hook's authority surface and forces every
   consumer to think about init-vs-imperative state.
2. Adding an `initialPlayerTokens` prop to `TradeEditor` consumed by
   `useTradeMachineInit`, which would couple init to a one-shot
   prefill and bring its own race conditions against
   `lastInitInputsRef`.

Both are non-trivial surgery and would touch the validated trade
preview authority. The Stage 2 discovery already deferred trade
prefill (see [ARCHITECT_STAGE_2_ACTION_CONTINUITY_DISCOVERY.md
#open-questions](ARCHITECT_STAGE_2_ACTION_CONTINUITY_DISCOVERY.md)),
and Stage 2C should remain consistent with that deferral.

**If not, should Stage 2C defer trade prefill?** Yes. Stage 2C
explicitly defers trade prefill from a player context. The Stage 2A
seam — clicking the cap-warning chip lands the user on Trade Machine
— remains the supported continuity path.

### 5. Free Agency

**After signing, can the user identify the signed player on
roster/cap sheet?** Partially. Stage 2A drops the user on Cap Sheet
after signing; Stage 2B publishes a receipt with `primaryPlayerIds`
extracted from `ArchitectMutationResult.changedPlayers` and
`writesSummary.playerIds`
([postActionHandoff/types.ts:97-119](src/features/architect/GMDashboard/postActionHandoff/types.ts#L97-L119)).
The receipt is visible at the top of the dashboard. However:

- Cap Sheet doesn't scroll to or highlight the player row.
- Roster doesn't highlight the player card.
- The "View Roster" button in the strip is navigation-only; the
  Roster surface re-renders identically whether the user just signed
  someone or not.

**What player-specific post-signing continuity is missing after Stage
2B?** A *destination-side* highlight. The receipt carries the
`primaryPlayerIds`; the missing seam is consumers (Roster cards, Cap
Sheet rows) reading that focus id and rendering a non-mutating "just
changed" highlight that matches the rail's `Just now` treatment.

### 6. History / Activity

**Do events include affected player ids/names in a way that could
support player-focused navigation later?** Yes.
[`normalizeWorldEventsForTeamHistory`](src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts)
extracts a unique `playerIds` list per event and a
`playerNameLookup` is threaded through to
`HistoryDetailModal`. The Detail modal already renders
"Players: J. Doe (id)" lines and even surfaces raw `playerIds`
under a debug summary.

**Should Stage 2C defer history-player deep links to Stage 2D?**
Yes. The Stage 2B discovery already calls out Slice 4 ("History
deep-link entry") as a one-shot selection prop that would require
[`TeamHistoryTab`](src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx)
to accept `requestedSelectedEntryId`. Adding *player*-keyed
selection on top of that — "open the history entry for a specific
player" or "from a history player line, jump to Roster/Cap Sheet"
— is reasonable but multiplies the surface area and is best handled
as a follow-up to Stage 2C's smaller scope. Stage 2C should make the
player-focus state *available* on the dashboard so Stage 2D can plug
into it without redesigning identity flow.

### 7. Existing action owners

The following seams already exist and Stage 2C must reuse them
without introducing parallel mutation paths:

| Seam | File | Notes |
|---|---|---|
| `handleEditContract(player)` | [contractActions.ts:235](src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts#L235-L248) | Opens contract modal at `currentYear`; safe to call from any surface |
| `handleCapTableModalAction(player, action, year)` | [contractActions.ts:430](src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts#L430-L452) | Opens modal at `targetYear` with `option`/`freeAgent` context |
| `handleCapHoldRenounce(capHold)` | [contractActions.ts:454](src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts#L454-L459) | Confirms and renounces a cap hold |
| `handleWaiveContract`, `handleExtendContract`, `handleOptionDecision`, `handleRenounceRights` | [useArchitectActions.ts:482-488](src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L482-L488) | Modal-only owners; never called from row clicks today and Stage 2C must not change that |
| `openPlayerContractModalRoute({ player, rulesYear, initialAction, targetYear, actionContext })` | [persistenceHelpers.ts:143](src/features/architect/GMDashboard/hooks/useArchitectActions.persistenceHelpers.ts#L143) | Canonical modal entry route; consumed by `handleEditContract` + `handleCapTableModalAction` |
| `setActiveTab(tabId)` | [GMDashboard.tsx:148](src/features/architect/GMDashboard/GMDashboard.tsx#L148) | Stage 1/2A/2B navigation seam; safe for any surface |
| `postActionReceipt.publish/dismiss/receipt/generation` | [useArchitectPostActionReceipt.ts](src/features/architect/GMDashboard/hooks/useArchitectPostActionReceipt.ts), wired in [GMDashboard.tsx:212-214](src/features/architect/GMDashboard/GMDashboard.tsx#L212-L214) | Stage 2B receipt store; already carries `primaryPlayerIds` and is the natural source for player focus |
| `getDetailLookupKeys(member)` (private) | [RosterVisual.tsx:101](src/features/architect/shared/RosterVisual/RosterVisual.tsx#L101-L123) | Roster identity key reconciliation; useful internally if Roster needs to match a focus id against a card |

What can be reused **without** new mutation authority:

- Roster cards can take an optional `onClick` that calls
  `handleEditContract` exactly the way Cap Sheet rows do.
- The dashboard can derive a `focusedPlayerId` from
  `postActionReceipt.receipt?.primaryPlayerIds[0]` and pass it to
  Roster + CapSheet + CapTable as a *visual* highlight prop.
- The same `focusedPlayerId` can clear on tab change, receipt
  dismiss, or next committed mutation — mirroring Stage 2B receipt
  lifetime.

---

## Missing Continuity Points

Listed in priority order by user impact and risk-to-author ratio.

### P1 — Roster → contract modal (highest impact, lowest risk)

Roster's card components have no `onClick`. Threading
`handleEditContract` from the dashboard through `RosterSection` →
`RosterVisual` → the legacy `RosterSection` →
`StarterCard`/`RotationCard`/`BenchCard` (as an opt-in `onSelect`
prop that does *not* require flipping `isExport`) gives the user the
same player-row affordance that Cap Sheet already offers. The
existing `LEGACY_ROSTER_DISPLAY_ONLY_PROPS` constant should remain
true for the legacy `onRemove`/`onAdd` mutation controls; only a new,
narrow `onSelect`-style hook is added.

### P2 — Post-action player highlight on Roster + Cap Sheet

The receipt already carries `primaryPlayerIds`. The dashboard can
publish a `focusedPlayerId` (deriving from the active receipt) and
pass it to:

- `RosterSection` → `RosterVisual` → cards, which can match using the
  same `getDetailLookupKeys` reconciliation logic and render a
  non-mutating green border.
- `CapSheetSection` → `CapSheet`, which already renders rows keyed by
  player id and can apply the same highlight.
- `CapTableSection` → `CapSheetFull`, same treatment.

Lifetime mirrors the receipt: clears on dismiss, next commit, or
team/world switch.

### P3 — Full Cap Table → Roster cross-link from player row

Full Cap Table rows already have `onOpenPlayerContractModal`. A
sibling `onNavigateToRoster(playerId)` callback (calling
`setActiveTab('roster')` and publishing a focus id) would close the
loop where a user spots a player on a future-year row and wants to
see them on the visual roster *before* opening the contract modal.
This is optional for the first slice — if scope grows, defer to
Stage 2C.1.

### P4 — Cap Sheet ⇄ Full Cap Table same-player continuity

When the user opens a player on Cap Sheet and then jumps to Full Cap
Table (or vice versa) the destination doesn't scroll/highlight that
player. With the Stage 2C focus seam in place, the user clicking a
row could set the focus id locally (without going through a
receipt). Defer this to a follow-up if needed; the P1+P2 slice
already gives the major win.

### Deferred — Trade prefill from a player context

Out of scope. Requires expanding `useTradeMachine`'s init contract or
exposing imperative seams. Stage 2 already deferred. Stage 2C
explicitly confirms the deferral.

### Deferred — History event → roster/cap-sheet player jump

Out of scope. Requires history-tab outbound navigation and a
`focusedPlayerId` consumer at the destination. Stage 2C makes the
*destination* side available (focus id consumed by Roster + Cap
Sheet); a Stage 2D slice can add the *source* link from
`HistoryDetailModal` once the focus id sink exists.

---

## Existing Reusable Action / Navigation Seams

### Navigation (no mutation authority)

| Seam | File | Notes |
|---|---|---|
| `setActiveTab(tabId)` | [GMDashboard.tsx:148](src/features/architect/GMDashboard/GMDashboard.tsx#L148) | Used by header chips, rail entry, post-action strip |
| `postActionReceipt.receipt` | [useArchitectPostActionReceipt.ts](src/features/architect/GMDashboard/hooks/useArchitectPostActionReceipt.ts) | Carries `primaryPlayerIds`, scoped per world/team |
| `postActionReceipt.dismiss` / `publish` | same | Lifetime management |
| `postActionReceipt.generation` | same | Rail refresh counter; Stage 2C can reuse for highlight lifetime if needed |

### Action owners (mutation authority — do not bypass)

| Seam | File | Notes |
|---|---|---|
| `handleEditContract` | [contractActions.ts:235](src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts#L235-L248) | Modal opener; safe for Roster click |
| `handleCapTableModalAction` | [contractActions.ts:430](src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts#L430-L452) | Modal opener with target-year/context |
| `handleWaiveContract` / `handleExtendContract` / `handleOptionDecision` / `handleRenounceRights` | [useArchitectActions.ts:482-488](src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L482-L488) | Modal-only; Stage 2C must not invoke directly from Roster/CapSheet rows |
| `handleSign` / `handleSignAndTrade` / offer-sheet executors | various sub-hooks | Free-agency-only mutation authority; unchanged |

### Read-only data seams (safe to consume anywhere)

| Seam | File | Notes |
|---|---|---|
| `teamCapSheet.players` | dashboard state | Membership truth for Roster + CapSheet |
| `playersMap` | dashboard state | Display-detail enrichment |
| `getDetailLookupKeys(member)` | [RosterVisual.tsx:101](src/features/architect/shared/RosterVisual/RosterVisual.tsx#L101-L123) | Identity reconciliation across `id`/`player_id`/`bio.playerId`/`displayName` |
| `ArchitectPostActionReceipt.primaryPlayerIds` | [postActionHandoff/types.ts](src/features/architect/GMDashboard/postActionHandoff/types.ts#L97-L119) | Already derived from `changedPlayers`/`writesSummary.playerIds` |

---

## Recommended Stage 2C Implementation Slice

**Goal:** Make a player identity legible and actionable across
Roster, Cap Sheet, and Full Cap Table without adding new mutation
authority, new Firestore reads/writes, or new trade prefill.

### Slice 1 — Roster row opens contract modal

Thread `handleEditContract` from `GMDashboard` to `RosterSection` to
`RosterVisual`. Add an `onSelectPlayer` (or `onOpenPlayerContractModal`
to mirror Cap Sheet) prop chain to `RosterVisual` → the legacy
`RosterSection` (without flipping `isExport`) → card components. Each
card calls `onSelectPlayer?.(player)` from the existing card root
element wrapped in a non-disruptive button or a click handler. The
modal opener is already authority-correct; this only adds a click
seam.

Scope: roughly 5 files, prop threading + a button/click wrapper on
each card. No mutation logic, no `isExport` regression.

### Slice 2 — Dashboard-level `focusedPlayerId` seam

Derive `focusedPlayerId` from `postActionReceipt.receipt`:

```ts
const focusedPlayerId =
  postActionReceipt.receipt?.primaryPlayerIds?.[0] ?? null;
```

Pass `focusedPlayerId` to `RosterSection`, `CapSheetSection`, and
`CapTableSection` as an optional `highlightPlayerId` prop. Consumers
compare against their own per-row identity helpers
(`getDetailLookupKeys` for Roster, the row key for Cap Sheet rows)
and apply a non-mutating "just changed" outline.

Lifetime:

- Clears with the receipt (existing
  `postActionReceipt.dismiss`/generation behaviour).
- Clears on world/team switch (already true because the receipt is
  scoped via `postActionReceiptScopeKey`).
- Optionally clears when the user clicks a different player (Slice
  1's `onSelectPlayer` can publish a *manual* focus id; defer to
  Slice 4 if scope grows).

Scope: ~3-4 files, prop addition + visual outline.

### Slice 3 — Optional "View on Roster" jump from CapSheetFull row

Add a sibling callback `onNavigateToRoster(player)` to
`CapSheetFull` that the dashboard binds to a closure calling
`setActiveTab('roster')` and publishing a manual focus id. The row
exposes it as a small icon/text next to the existing actions.

Scope: ~2 files. Defer if Slice 2 ships first and the rail/highlight
already covers the most common flow.

### Slice 4 — Manual focus publication

Make the `focusedPlayerId` mutable beyond the post-action receipt:
either expose a thin `setFocusedPlayerId` from a new
`useArchitectPlayerFocus` hook *or* extend
`useArchitectPostActionReceipt` with a dedicated focus channel. Prefer
the standalone hook so the receipt remains a strict "committed truth
echo" surface.

Defer to a follow-up slice if Slices 1+2 are sufficient.

### Scope check

- Slices 1 and 2 are the core Stage 2C candidate (Roster modal seam
  + receipt-driven highlight).
- Slice 3 is small additive; may bundle if the contract-action row
  ergonomics allow.
- Slice 4 is a polish/lifetime improvement; defer unless reviewers
  ask for it.
- All four slices are navigation/UI only. None of them invent new
  event truth, new mutation routes, or new Firestore reads/writes.

---

## Explicit Non-Goals

- Do **not** add `onWaive` / `onExtend` / `onOptionDecision` /
  `onRenounce` callbacks to Roster cards. Those mutations belong
  inside `EditContractModal`; Roster clicks open the modal and stop
  there.
- Do **not** flip `LEGACY_ROSTER_DISPLAY_ONLY_PROPS.isExport` to
  `false`. The legacy roster's `onRemove`/`onAdd` mutation controls
  are intentionally suppressed — re-enabling them would create a
  parallel mutation surface that bypasses `useArchitectActions`.
- Do **not** prefill the Trade Machine from a player context.
  `useTradeMachine` init must remain owner of the trade slot state.
- Do **not** wire history events to a player deep link in Stage 2C.
  The history → player jump depends on `TeamHistoryTab` accepting an
  external selection prop, which is itself a deferred Stage 2B/2D
  item.
- Do **not** treat the post-action receipt's `primaryPlayerIds` as
  authoritative roster/cap membership. The receipt is a UI echo;
  Roster + Cap Sheet always render from `teamCapSheet.players`.
- Do **not** introduce any new mutation receipt fields. The focus
  highlight only consumes `primaryPlayerIds` that the receipt already
  derives.
- Do **not** persist `focusedPlayerId` outside React state. Session-
  scoped only.
- Do **not** modify `mutationPipeline`, `seasonManager`, or
  `worldManager`. The slice should consume what they already return.
- Do **not** invent a new Firestore collection read for "player
  identity" — `teamCapSheet.players` + `playersMap` are sufficient.

---

## Authority Risks

| Risk | Mitigation |
|---|---|
| Roster click bypasses modal-owned mutation gating | Roster's `onSelectPlayer` calls `handleEditContract` only; the modal continues to enforce world-mode gating and route mutations through `useArchitectActions` |
| Roster card click becomes a "delete player" affordance | Card components must **not** receive a remove/onRemove callback in Stage 2C — keep `isExport: true` for legacy controls, add `onSelectPlayer` as a *new* prop, not a replacement |
| `focusedPlayerId` matches the wrong player due to id-vs-name mismatch | Use `getDetailLookupKeys` for Roster reconciliation; on Cap Sheet rows, compare against the same canonical id used by `handleEditContract`'s argument (player.id || player_id || bio.playerId) |
| Focus highlight persists after team/world switch | Receipt is already scoped via `postActionReceiptScopeKey` (worldId:teamId). The derived `focusedPlayerId` follows automatically. |
| Manual focus (Slice 4) drifts from receipt | If Slice 4 lands, the manual focus must clear on next committed mutation just like the receipt — implement as a single derivation with both sources, never as two competing pieces of state |
| `setActiveTab('roster')` lands on a roster that doesn't contain the focused player (e.g. trade just moved them out) | Roster simply renders without a highlight match; the receipt's headline + team chips still tell the truth. Do not synthesise a "missing player" placeholder card. |
| Stage 2C becomes an action surface | Roster + cap-sheet highlight callbacks must be navigation/visual only. No mutation owners are added to Roster's component tree. |

---

## Open Questions

1. **Roster card click target.** Should the entire card become a
   button (largest hit target, but interferes with the headshot focus
   ring) or should the player name area receive the click handler? A
   small visual cue (cursor-pointer + subtle scale on hover) is
   probably enough; design language choice belongs to the
   implementation slice.

2. **Highlight visual.** The Stage 2B rail uses a faint green tint
   (`bg-green-500/[0.06]`) and a "Just now" pill. The Roster /
   CapSheet highlight should match the same tone family but not
   compete with the headshot art — a thin green outline is probably
   correct.

3. **Focus lifetime when navigating between Roster and CapSheet.**
   If a user clicks player A on Roster (manual focus), then clicks
   the post-action receipt's "View Cap Sheet" button, should the
   destination highlight A (manual) or the just-committed player
   (receipt)? Probably the receipt — receipts trump manual selection
   while they are alive.

4. **Two-way contract players.** RosterVisual currently fills bench
   slots with two-way players when standard count is < 15. Should
   two-way cards also open the modal? Yes — `handleEditContract`
   handles all contract types, and the modal's action selector hides
   inapplicable actions. No extra gating in Roster.

5. **Cap-hold rows in Full Cap Table.** Cap-hold rows are not
   "players" in the contract-modal sense. The existing
   `onRenounceCapHold` callback already handles them. Stage 2C's
   focus highlight should match a player's `playerId` against
   cap-hold `playerId`s when relevant, but a cap-hold row alone is
   not a navigation target for the Roster jump.

6. **Receipt with multiple `primaryPlayerIds` (trade, sign-and-trade).**
   A trade can affect several players. Should the highlight cover
   all of them, only the first, or all-matching cards on Roster?
   Default to all matching — `primaryPlayerIds.includes(rowId)` —
   so a multi-player trade highlights both sides of the trade where
   they land on roster/cap sheet.

7. **Manual focus from Roster click vs. modal lifecycle.** Opening
   the contract modal from Roster currently does not require any
   focus-id publication — the modal owns its own `selectedPlayer`
   state through `openPlayerContractModalRoute`. Stage 2C can let
   the modal-open path *also* set the focus id so that when the user
   cancels the modal and lands back on Roster, the player they
   inspected is briefly highlighted. Treat as nice-to-have; defer if
   it complicates the slice.

8. **`PlayerNameMini` and accessible click target.** The roster card
   currently renders `PlayerNameMini` inside a `<div>`. Wrapping the
   card in a `<button>` is the cleanest a11y move; alternatively, an
   `onClick` on the outer `<div>` plus `role="button"` /
   `tabIndex={0}` works. Implementation choice.

9. **Stage 2D scope coupling.** History → player deep link needs a
   `requestedSelectedEntryId` *and* a `focusedPlayerId` sink. Stage
   2C builds the sink. Confirm that Stage 2D plans align before
   freezing the `focusedPlayerId` prop name.

---

## Files Inspected

| File | Purpose in this discovery |
|---|---|
| `docs/architect/ARCHITECT_NEXT_ERA_MASTER_PLAN.md` | Staged roadmap; Stage 2/2A/2B framing |
| `docs/architect/ARCHITECT_STAGE_2_ACTION_CONTINUITY_DISCOVERY.md` | Stage 2A boundaries; trade-prefill deferral context |
| `docs/architect/ARCHITECT_STAGE_2B_POST_ACTION_HANDOFF_DISCOVERY.md` | Receipt model; history deep-link deferral |
| `src/features/architect/GMDashboard/GMDashboard.tsx` | Composition shell; Stage 2A/2B wiring; receipt + handoff strip mounting |
| `src/features/architect/GMDashboard/sections/RosterSection.tsx` | Roster wrapper — passes only data, no callbacks |
| `src/features/architect/GMDashboard/sections/CapSheetSection.tsx` | Cap sheet handoff — `onOpenPlayerContractModal` plumbing |
| `src/features/architect/GMDashboard/sections/CapTableSection.tsx` | Full cap table handoff — modal/launch/renounce callbacks |
| `src/features/architect/GMDashboard/sections/TradeSection.tsx` | Trade handoff — Stage 2A `onAfterTradeApplied` plumbing |
| `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx` | FA handoff — Stage 2A `onAfterSigningComplete` wrapping |
| `src/features/architect/GMDashboard/components/ArchitectWorkspaceHeader.tsx` | Stage 1/2A header; cap-posture + season-mismatch nav chips |
| `src/features/architect/GMDashboard/components/ArchitectPostActionHandoff.tsx` | Stage 2B strip; navigation-only consumer of receipt |
| `src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx` | Stage 1D rail; Stage 2B `refreshKey` + `highlightEventId` |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Action handlers map; modal openers; available identity-safe seams |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts` | `handleEditContract`, `handleCapTableModalAction`, `handleCapHoldRenounce` |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.persistenceHelpers.ts` | `openPlayerContractModalRoute`; receipt publish path |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.signingExecution.ts` | Receipt publish for signing flow |
| `src/features/architect/GMDashboard/hooks/useArchitectPostActionReceipt.ts` | Stage 2B receipt store; scoped per world/team |
| `src/features/architect/GMDashboard/postActionHandoff/types.ts` | Receipt derivation; `primaryPlayerIds` extraction |
| `src/features/architect/shared/RosterVisual/RosterVisual.tsx` | Roster display composition; `getDetailLookupKeys` identity helper; `LEGACY_ROSTER_DISPLAY_ONLY_PROPS` |
| `src/features/roster/RosterSection/index.tsx` | Legacy roster section; `isExport` suppresses mutation controls |
| `src/features/roster/RosterSection/StarterCard.tsx` | Card primitive — no current click seam |
| `src/features/architect/capSheet/CapSheet/CapSheet.tsx` | Cap sheet row → modal opener |
| `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx` | Future cap table row → modal opener / launch action / renounce |
| `src/features/architect/tradeMachine/TradeEditor.tsx` | Trade composition — `setPlayerTrade` is internal-only |
| `src/features/architect/hooks/useTradeMachine.ts` | Trade hook ownership; no external player prefill seam |
| `src/features/architect/hooks/useTradeMachinePlayerOps.ts` | `setPlayerTrade` internal — not exposed |
| `src/features/architect/history/hooks/useWorldTeamEvents.ts` | Event fetch; `refreshKey` consumed by Stage 2B rail |
| `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts` | Events already carry `playerIds` + `playerName` lookup |
| `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx` | Detail modal renders player ids/names — outbound deep-link absent |
| `src/shared/components/EditContractModal.tsx` | Contract modal — Stage 2C target of all Roster row clicks |
