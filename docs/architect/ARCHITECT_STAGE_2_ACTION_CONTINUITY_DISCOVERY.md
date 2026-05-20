# Architect Action Continuity Discovery — Stage 2

**Status:** Discovery (read-only pass)
**Branch:** `feature/architect-operating-experience-stage-2-discovery`
**Stage 1 base:** PR #466 — `useArchitectModePresentation`, `useArchitectWorkspaceContext`,
`ArchitectWorkspaceHeader`, `useScenarioActivityRail`, `ScenarioMoveRail`

---

## Executive Summary

Stage 1 made the Architect workspace visually continuous: the cockpit strip and
activity rail give users a persistent sense of where they are (world, team,
season, mode) and what just happened (committed events). What Stage 1 did not
do is make the user's _next action_ easier to reach.

Today the dashboard is a flat tab system. After noticing a problem (a cap
warning in the cockpit strip, an expiring contract in the cap sheet, a
completed trade in the activity rail) the user must navigate manually to the
relevant tab, locate the player or exception, and open the correct modal. There
are no deep links, no one-click jumps, and no cross-surface result previews.
The information is there — the continuity of action is not.

Stage 2 should add _navigational_ continuity: the ability to jump from a
finding on one surface to the relevant action surface on another surface,
without adding any new mutation authority or bypassing existing action owners.

The available seam is `setActiveTab`, already called from the cockpit strip and
the activity rail. No new Firestore writes are needed. No new mutation pipeline
routes are needed. The work is wiring navigation callbacks through to surfaces
that currently dead-end.

---

## Current Cross-Surface Flow Map

```
ArchitectWorkspaceHeader (cockpit strip)
  │  cap warning → no link to Cap Sheet
  │  apron status → no link to Cap Sheet
  │  exception count → no link to Cap Sheet
  │  season mismatch → no link to Offseason
  └─ onOpenHistory → setActiveTab('history')  ← only navigation seam (Stage 1)

ScenarioMoveRail (activity rail)
  │  entry (signing, trade, waive…) → read-only label, no deep link
  └─ onOpenHistory → setActiveTab('history')  ← only navigation seam (Stage 1)

Cap Sheet tab
  │  player row → onOpenPlayerContractModal (opens EditContractModal)
  │  EditContractModal → waive / extend / option / renounce / sign-and-trade
  │  ManageDeadMoneyModal → manual dead cap entry
  │  ManageExceptionsModal → manual exception entry
  └─ no link back to Trade Machine, Roster, or History after action

Full Cap Table tab
  │  player row → onOpenPlayerContractModal
  │  cap hold row → onRenounceCapHold
  │  contract action row → onLaunchContractAction
  └─ no link back to Trade Machine, Roster, or History after action

Trade Machine tab
  │  onApplyTrade → applyTradeToCapSheet (mutationPipeline commit)
  │  onEditContract → opens EditContractModal for player in trade
  └─ no navigation to Cap Sheet, History, or Roster after trade applied

Free Agency tab
  │  sign / resign → dualPathSigning.signFreeAgent
  │  sign-and-trade → worldOnly.signAndTrade
  │  offer sheet → worldOnly.storeOfferSheet / matchOfferSheet / declineOfferSheet
  └─ no navigation to Cap Sheet or Roster after signing

Offseason tab
  │  season advance → SeasonAdvanceModal → applyCommittedWorldAdvanceAftermath
  │  draft positions → saveDraftPositions (worldManager)
  └─ after advance: offseason summary modal shown, but no navigation to
     History, Cap Sheet (new season), or Roster

Roster tab
  │  RosterVisual → read-only grid
  └─ no link to Cap Sheet, Trade Machine, or contract modal from roster row

History tab
  │  WorldEventsTimeline → onSelectEntry → HistoryDetailModal
  │  WaiveStretchTracker → read-only
  │  ExceptionHistoryTracker → read-only
  │  DraftPickTracker → read-only
  └─ no link from history entry back to affected player on Cap Sheet or Roster
```

---

## Surface-by-Surface Findings

### 1. Cap Sheet / Full Cap Table

**What is currently shown:** Player salary rows with cap hit, option flags,
extension eligibility. Summary tiles (cap space, tax space, apron status).
Dead cap section. Exception tracker.

**Natural next actions from visible data:**

| Trigger | Natural next action | Currently reachable? |
|---|---|---|
| Player row in warning state (near max, expiring option) | Open contract modal | Yes — `onOpenPlayerContractModal` |
| Cap warning (over first apron) | Navigate to Trade Machine to shed salary | No |
| Cap warning (available MLE) | Navigate to Free Agency to sign a player | No |
| TPE in exception tracker | Navigate to Trade Machine to use TPE | No |
| Dead cap entry | Navigate to History to see the waive event | No |
| Year selector changed | See same-player data in Full Cap Table | Partial — tab bar exists but no sync |
| After waive/extend/renounce | See updated cap totals | Yes — reloads via mutationPipeline |
| After waive/extend/renounce | Navigate to History | No |

**Missing continuity:** Cap Sheet is a find-and-act surface with no outbound
links. Once a user notices a problem (apron violation, available exception,
expiring option) they must manually switch tabs to take action.

---

### 2. Trade Machine

**What is currently shown:** Multi-team trade builder with real-time salary
matching validation, cap impact tiles, and an apply button.

**Natural next actions after trade applied:**

| Trigger | Natural next action | Currently reachable? |
|---|---|---|
| Trade applied (success toast) | See updated cap sheet for primary team | No |
| Trade applied | See updated roster | No |
| Trade applied | See trade event in History | No |
| Trade applied | See activity rail update | Partial — rail polls committed events |
| Trade fails (over hard cap) | Navigate to Cap Sheet to find which contract to move | No |
| Player listed in trade card | Open contract modal | Yes — `onEditContract` |

**Missing continuity:** After `applyTradeToCapSheet` succeeds, the user is left
staring at the Trade Machine with no signal of where to go next. The toast
confirms success but there is no navigation offered.

**The `onApplyTrade` callback** in `TradeSection.tsx` forwards directly to
`actions.applyTradeToCapSheet`. The action already triggers a reload via
`reloadActiveWorldTeamData`. The only missing piece is a post-apply navigation
callback. No new mutations are required.

---

### 3. Free Agency

**What is currently shown:** FA pool grid with filter controls and signing
modal access. Offer sheet lifecycle list.

**Natural next actions after signing:**

| Trigger | Natural next action | Currently reachable? |
|---|---|---|
| FA signed (standard) | See player on Cap Sheet | No |
| FA signed | See player on Roster | No |
| FA signed | See cap impact (new total) | No — must switch to Cap Sheet |
| Sign-and-trade completed | See updated Cap Sheet | No |
| Sign-and-trade completed | See updated History | No |
| Offer sheet stored | See offer sheet in outgoing list | Yes — section re-renders |
| Offer sheet matched | See player on Cap Sheet | No |
| After any action | See activity rail | Partial — rail polls committed events |

**Missing continuity:** Free Agency completes the action but offers no path to
verify the result. Users must manually navigate to Cap Sheet or Roster to
confirm the signing had the expected effect.

---

### 4. Roster

**What is currently shown:** Read-only roster grid via `RosterVisual`. No
action callbacks are passed. No `onOpenPlayerContractModal` equivalent.

**Natural next actions from visible data:**

| Trigger | Natural next action | Currently reachable? |
|---|---|---|
| Player row (any player) | See contract on Cap Sheet | No |
| Player row (expiring) | Open contract modal to extend/renounce | No |
| Roster count warning (>15) | Navigate to Trade Machine or FA to shed a player | No |
| Two-way / G-League slot | Open contract modal | No |

**Missing continuity:** Roster is completely read-only with no outbound
navigation. It is the most isolated surface in the dashboard. Users can see
roster composition but cannot act from it or navigate deeper from it.

---

### 5. Offseason

**What is currently shown:** World season advance button + `SeasonAdvanceModal`.
Draft positions input. DEV-only preview surface (gated by localStorage flag).

**Natural next actions after season advance:**

| Trigger | Natural next action | Currently reachable? |
|---|---|---|
| Season advanced (offseason summary modal shown) | Navigate to new season's Cap Sheet | No |
| Season advanced | Navigate to History to see the advance event | No |
| Season advanced | Navigate to Roster to see which players expired | No |
| Viewing season ≠ world season (mismatch state) | Advance season to align | Partial — button is there |
| Viewing season ≠ world season | Navigate to Offseason from cockpit strip mismatch indicator | No |

**Missing continuity:** The offseason summary modal (`showOffseasonModal` in
`GMDashboard.tsx:577`) lists expired contracts and declined options but has no
"Go to Cap Sheet" or "Go to Roster" link. Closing the modal returns the user
to whatever tab was last active, not to the most useful next view.

---

### 6. History / ScenarioMoveRail

**What is currently shown:** `WorldEventsTimeline` with `onSelectEntry` →
`HistoryDetailModal`. `WaiveStretchTracker`, `ExceptionHistoryTracker`,
`DraftPickTracker` (all read-only). Activity rail shows 5 most recent events.

**Navigation analysis:**

| Trigger | Natural next action | Currently reachable? |
|---|---|---|
| Rail entry (any event) | Navigate to History tab for full detail | Yes — `onOpenHistory → setActiveTab('history')` |
| History event row clicked | See `HistoryDetailModal` | Yes — `onSelectEntry` |
| History entry for a trade | Navigate to Trade Machine to build related trade | No |
| History entry for a signing | See player on Cap Sheet | No |
| History entry for a waive | See dead cap entry on Cap Sheet | No |
| WaiveStretchTracker entry | See dead cap entry on Cap Sheet | No |
| DraftPickTracker pick | See trade that produced the pick in History | No |

**Safe for Stage 2:** Adding a callback from `HistoryDetailModal` or the
timeline to navigate to Cap Sheet or Trade Machine tab is safe — it is
`setActiveTab` only.

**Not safe for Stage 2:** Any enrichment of the history entry that requires
reconstructing mutation state or showing a "preview before commit" view.

---

## Existing Reusable Action / Navigation Seams

These are already wired and available. Stage 2 should consume them rather than
creating new ones.

### Navigation (no mutation authority)

| Seam | File | Notes |
|---|---|---|
| `setActiveTab` | `GMDashboard.tsx:146` | State setter, already used by rail and cockpit |
| `onOpenHistory` prop | `ScenarioMoveRail.tsx:13` | Calls `setActiveTab('history')` |
| Tab bar buttons | `GMDashboard.tsx:443–515` | All tabs reachable by direct `setActiveTab` call |

### Action owners (mutation authority — do not bypass)

| Seam | File | Notes |
|---|---|---|
| `handleEditContract` | `useArchitectActions.ts:479` | Opens `EditContractModal` for any player |
| `handleWaiveContract` | `useArchitectActions.ts:482` | Waive via mutationPipeline |
| `handleExtendContract` | `useArchitectActions.ts:481` | Extend via mutationPipeline |
| `handleOptionDecision` | `useArchitectActions.ts:484` | Option accept/decline via mutationPipeline |
| `handleRenounceRights` | `useArchitectActions.ts:485` | Renounce cap hold via mutationPipeline |
| `handleSign` | `useArchitectActions.ts:653` | Standard signing via mutationPipeline |
| `handleSignAndTrade` | `useArchitectActions.ts:654` | SNT via mutationPipeline |
| `applyTradeToCapSheet` | `useArchitectActions.ts:652` | Trade apply via mutationPipeline |
| `handleSetDeadCap` | `useArchitectActions.ts:664` | Manual dead cap entry |
| `handleSetExceptions` | `useArchitectActions.ts:667` | Manual exception entry |

### Read-only data seams (safe to consume anywhere)

| Seam | File | Notes |
|---|---|---|
| `workspaceContext` | `GMDashboard.tsx:152` | Full cap/roster/exception summary |
| `computeTeamCapTotals` | `utils/capTotals/computeTeamCapTotals.ts` | Canonical cap totals |
| `useWorldTeamEvents` | `history/hooks/useWorldTeamEvents.ts` | Committed world events |
| `useScenarioActivityRail` | `GMDashboard/hooks/useScenarioActivityRail.ts` | Recent events derived |

---

## Missing Continuity Points

Listed in priority order by user impact.

### P1 — Post-action navigation (highest impact, zero mutation risk)

1. **After trade applied:** offer navigation to Cap Sheet and/or History.
   Currently the `onApplyTrade` callback returns but offers no next step.
   `TradeSection` → `TradeEditor` already receives `onApplyTrade`. A
   `onAfterTradeApplied` callback could call `setActiveTab('cap')`.

2. **After signing (FA or resign):** offer navigation to Cap Sheet or Roster.
   `dualPathSigning.signFreeAgent` and `handleSign` complete and show a toast
   but do not navigate. A `onAfterSigningComplete` callback (navigation only)
   would close the gap.

3. **After offseason summary modal is dismissed:** navigate to Cap Sheet for
   the new season. Currently `closeOffseasonModal` in `useArchitectModals` just
   closes the modal. Adding `setActiveTab('cap')` after close would provide
   orientation.

### P2 — Cockpit strip outbound links (visual continuity → action continuity)

1. **Cap warning chip → Cap Sheet tab:** `ArchitectWorkspaceHeader` shows
   apron status and cap space. These chips have no `onClick`. Adding an
   `onNavigateToCapSheet` callback (calling `setActiveTab('cap')`) would make
   them navigable.

2. **Exception count chip → Cap Sheet tab:** Same pattern as cap warning.

3. **Season mismatch warning → Offseason tab:** When
   `seasons.viewingSeasonDiffersFromWorldSeason` is true, the cockpit strip
   shows a warning. An `onNavigateToOffseason` callback would guide the user.

### P3 — Roster outbound navigation (currently fully isolated)

1. **Roster player row → Cap Sheet:** Add `onNavigateToCapSheet` to
   `RosterSection`. `RosterVisual` would need the callback passed through, but
   no mutation authority change is needed.

2. **Roster player row → contract modal:** `handleEditContract` is already
   available in `GMDashboard`. Passing it to `RosterSection` (as it is already
   passed to `CapSheetSection`) adds action continuity without new authority.

### P4 — History outbound links (deferred unless trivially safe)

1. **History event → related surface:** A history entry for a signing could
   link to Cap Sheet; a trade entry could link to Trade Machine. This is safe
   if implemented as `setActiveTab` only. The `HistoryDetailModal` would need
   an `onNavigate` callback. This is low risk but lower priority than P1–P3.

2. **Activity rail entry → History detail:** Rail entries currently navigate
   to the History tab root. A future step could deep-link to the specific event
   row, but this requires `TeamHistoryTab` to accept a `selectedEntryId` prop.
   Deferred to Stage 2B or later.

---

## Recommended Stage 2 Boundaries

### In scope — Stage 2

- Navigation-only callbacks passed through existing prop chains.
- `setActiveTab` calls triggered by post-action results or cockpit chip clicks.
- Passing existing action owners (e.g., `handleEditContract`) to surfaces that
  currently receive no action callbacks (Roster).
- `onAfterApplied` / `onAfterSigned` callback props in Trade Machine and Free
  Agency sections — these call `setActiveTab` only, no mutation logic.

### Out of scope — Stage 2

- Any new Firestore writes or reads.
- New mutation pipeline routes or new action kinds.
- Bypassing `useArchitectActions` for any mutation shortcut.
- Showing local-preview state as committed state (e.g., optimistic cap sheet
  before trade is confirmed).
- Cross-team navigation (viewing another team's cap sheet from within a trade).
- Deep-linking from history event to a specific player row on Cap Sheet
  (requires player-highlight state that does not exist yet).
- Adding a "draft assets" summary to the workspace context (currently deferred
  with `deferralHint: 'see-trade-history'` in `useArchitectWorkspaceContext`).

---

## Recommended Stage 2A First Implementation Slice

**Goal:** Wire post-action navigation for the two highest-traffic flows (Trade
and FA), and add cockpit strip outbound links.

**Deliverables (no new mutation authority):**

1. **`TradeSection` / `TradeEditor`: `onAfterTradeApplied` callback**
   - `GMDashboard` passes `onAfterTradeApplied={() => setActiveTab('cap')}` to
     `TradeSection`.
   - `TradeSection` forwards it to `TradeEditor`.
   - `TradeEditor` calls it after a successful `onApplyTrade` resolve.
   - Scope: 3 files, prop threading only.

2. **`FreeAgencySection`: `onAfterSigningComplete` callback**
   - `GMDashboard` passes `onAfterSigningComplete={() => setActiveTab('cap')}`.
   - `FreeAgencySection` calls it after `dualPathSigning.signFreeAgent` resolves.
   - Scope: 2 files, callback wrap only.

3. **`ArchitectWorkspaceHeader`: outbound navigation props**
   - Add optional `onNavigateToCapSheet`, `onNavigateToOffseason` callbacks to
     `ArchitectWorkspaceHeader` props.
   - `GMDashboard` passes `() => setActiveTab('cap')` and
     `() => setActiveTab('offseason')`.
   - Cap warning chips and season mismatch indicator become clickable.
   - Scope: 2 files, prop addition + onClick wiring only.

4. **Offseason summary modal: navigate after dismiss**
   - `closeOffseasonModal` in `GMDashboard.tsx:633` → add
     `setActiveTab('cap')` after close.
   - Scope: 1 line in GMDashboard.

**Stage 2A total scope:** 4 surgical changes. Zero new mutation authority.
Zero new Firestore writes. All changes are `setActiveTab` wiring through
existing prop chains.

**Validation:** `npm run test:architect` scoped suite. Typecheck only after
prop additions (`npm run typecheck`).

---

## Explicit Non-Goals

- No new mutation actions. Stage 2 adds navigation — not write authority.
- No local preview state presented as committed. All cap totals remain derived
  from `computeTeamCapTotals` on the committed `teamCapSheet`.
- No shortcut that executes a mutation directly from the cockpit strip or
  activity rail. The rail and header are read-only surfaces.
- No new Firestore collection reads. Navigation is derived from state already
  owned by `useArchitectState`.
- No deep-linking from rail entry to a specific player row or cap sheet line.
  Player-highlight state does not exist and should not be added in Stage 2.
- No cross-team navigation from Trade Machine to another team's cap sheet tab.
- No reconstruction of trade or signing history for preview purposes.

---

## Authority Risks

| Risk | Mitigation |
|---|---|
| Navigation callback triggers before mutation is committed | Callbacks must be called inside the `await` resolution of `onApplyTrade` / `signFreeAgent`, not optimistically before the pipeline completes |
| `setActiveTab` called before reload completes, showing stale data | Accept this — the reload is already in flight; the cap sheet will update reactively once `teamCapSheet` state updates |
| `onNavigateToCapSheet` added to `ArchitectWorkspaceHeader` makes the header feel like an action owner | The header must only call `setActiveTab`; it must not receive or call any mutation callback |
| Roster receives `handleEditContract` and user treats Roster as a mutation surface | The modal itself enforces world-mode gating; Roster only dispatches the open event |
| Stage 2A scope creep into "show what the cap sheet will look like after trade" | This requires optimistic state — explicitly deferred; do not add any preview cap sheet that is not derived from committed `teamCapSheet` |

---

## Open Questions

1. **Tab after trade:** Should `onAfterTradeApplied` navigate to Cap Sheet
   (`'cap'`) or History (`'history'`)?  Cap Sheet shows the immediate impact;
   History shows the event. A user option (or defaulting to Cap Sheet with a
   "View in History" link in the success toast) could serve both needs.

2. **Tab after signing:** Same question. Is Cap Sheet or Roster the better
   landing after a signing?

3. **Cockpit strip chips:** Should cap warning chips navigate to Cap Sheet on
   single click, or should they show a tooltip first to avoid accidental
   navigation? The rail entries are click-to-navigate; the chips may warrant the
   same treatment.

4. **Offseason dismiss → Cap Sheet:** After season advance, the new cap sheet
   may be for a different season than what was previously viewed. The user
   should land on the correct season. `applyCommittedWorldAdvanceAftermath` sets
   `setCurrentYear(nextViewingYear)` — so navigating to Cap Sheet after dismiss
   should be safe. Confirm that `currentYear` is updated before the modal
   closes.

5. **Roster action delegation:** Should `RosterSection` receive
   `handleEditContract` in Stage 2A, or defer to Stage 2B? Depends on whether
   the Roster visual renders player rows in a form that makes an
   `onOpenPlayerContractModal` prop natural. `RosterVisual` should be inspected
   before committing.

6. **History deep-link:** If a history entry includes a `playerId`, should
   Stage 2A add a "View on Cap Sheet" link to `HistoryDetailModal`? This is
   navigation-only and safe — but requires Cap Sheet to accept a
   `highlightPlayerId` prop it does not currently have. Defer to Stage 2B.

---

## Files Inspected

| File | Purpose |
|---|---|
| `src/features/architect/GMDashboard/GMDashboard.tsx` | Dashboard composition shell, prop chains, tab routing |
| `src/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext.ts` | Stage 1 workspace context view model |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Action orchestration; all mutation handler names |
| `src/features/architect/GMDashboard/hooks/useArchitectModePresentation.ts` | Mode label derivation |
| `src/features/architect/GMDashboard/hooks/useScenarioActivityRail.ts` | Activity rail state |
| `src/features/architect/GMDashboard/components/ArchitectWorkspaceHeader.tsx` | Cockpit strip rendering |
| `src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx` | Activity rail rendering |
| `src/features/architect/GMDashboard/sections/CapSheetSection.tsx` | Cap sheet section handoff |
| `src/features/architect/GMDashboard/sections/TradeSection.tsx` | Trade section handoff |
| `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx` | Free agency section handoff |
| `src/features/architect/GMDashboard/sections/OffseasonSection.tsx` | Offseason section + season advance |
| `src/features/architect/GMDashboard/sections/RosterSection.tsx` | Roster section (read-only wrapper) |
| `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx` | History tab, timeline, modals |
| `src/features/architect/ARCHITECT_FEATURE_README.md` | Feature ownership map |
