# Slice 05 — Compare / Guide Follow-Through

**Status:** Implementation spec (slice 5 of 5)
**Branch:** `feature/architect-cockpit-intelligence`
**Date:** 2026-06-03
**Source contract:** `ARCHITECT_COMPARE_GUIDE_FOLLOW_THROUGH_CONTRACT.md` (+ Map §Compare/§Guide, Slices §Slice 5)
**Master:** `ARCHITECT_IMPLEMENTATION_MASTER_SPEC.md`
**Depends on:** Slice 1 (`authorityLabel.ts`), Slice 2 (`PlayerActionContext`), Slice 3 (`TradeOpenRequest`), Slice 4 (event context)
**Ships independently:** yes (but its value comes from the context payloads finalized in 1–4)

---

## 1. Goal

Turn the existing Compare and Guide rooms from isolated panels into **context receivers**. They
already render; the gap is that they don't reliably *receive and focus on* the receipt/event/player/
warning/season context the user carried in. Add a shared follow-through context payload, focused
views, authority labels, and honest empty/unavailable states.

---

## 2. Current code state (do not rebuild)

- **Compare** (`GMDashboard/sections/ComparisonSection.tsx` + `useArchitectComparisonViewModel`) is
  fully implemented: reads committed scenario deltas; navigates to History/Cap/Roster via
  `onNavigate*` (read-only).
- **Guide** (`GMDashboard/sections/GuideSection.tsx`) is fully implemented: answers grouped by
  family (team-status, constraints, scenario, post-action, navigation); routes via `onNavigate`
  (read-only).
- The Activity Rail's **Current Receipt already exposes "Compare move" and "Guide next steps"
  buttons** (`onNavigateToCompare` / `onNavigateToGuide`), but they navigate without carrying the
  receipt/event/player/warning context into a focused view.

---

## 3. Gap to close

1. **Define `FollowThroughContext`** — one payload carrying the launch context, consumed by both
   rooms. Seeded by the rail receipt, Watchlist warnings, pinned players, and History events
   (Slices 1/4) and by the player menu (Slice 2).
2. **Compare context-focused views** per the contract:
   - Receipt-focused: focus the just-committed action; show affected players/teams; link to History
     detail + Cap/Roster; offer Guide.
   - Event-focused (from History): focus the selected committed event; label `Event-derived`; show
     only safely inferable fields; preserve a route back to History.
   - Player-focused (from pinned/menu): carry player id/label; show player-related changes where
     supported, else `Unavailable`.
   - Warning-focused (cap/tax/apron): show current posture + relevant deltas; explain if the causing
     move can't be identified; route to Cap Sheet + Guide.
   - Season-advance: show `Multi-season` warning; distinguish old/new world season vs viewing
     season; route to Offseason/Cap/Roster/History.
3. **Guide objective-focused launches** per the contract: open with a concrete objective string
   keyed off the context (e.g. "Solve second-apron restrictions.", "Explore moves involving this
   player.", "Fix trade validation issue.", "Find a legal signing path.", "Align viewing season with
   world season."). Guide **routes only** — to Cap Sheet / Trade (via `TradeOpenRequest`) / FA /
   Roster / Offseason / History / Compare — and never mutates.
4. **Authority labels** (Slice 1 `authorityLabel.ts`) on every meaningful Compare value:
   `Committed world` / `Event-derived` / `Current snapshot` / `Local preview` / `Multi-season` /
   `Unavailable` / `Deferred`. Local preview must never look like committed comparison.
5. **Empty / unavailable states** per the contract: Compare empty ("Comparison requires committed
   world activity…"), Compare unavailable ("This comparison field is unavailable from the current
   event data."), Guide empty ("Choose a player, warning, receipt, or event…"), Guide unavailable
   ("Guide needs more context to make this actionable…").

---

## 4. Target files

- `src/features/architect/cockpit/followThroughContext.ts` — **new** `FollowThroughContext` type +
  builders; export from `cockpit/index.ts`.
- `src/features/architect/GMDashboard/GMDashboard.tsx` — hold the current follow-through context
  (session state); set it when the user clicks Compare/Guide from receipt/warning/pinned/History/
  menu; pass it into the Compare/Guide room descriptors.
- `src/features/architect/GMDashboard/sections/ComparisonSection.tsx` +
  `useArchitectComparisonViewModel` — accept `FollowThroughContext`; render the focused view + the
  authority labels + unavailable states.
- `src/features/architect/GMDashboard/sections/GuideSection.tsx` — accept `FollowThroughContext`;
  render the objective + routing outputs (including `openTradeWithRequest`).
- Reuse: `authorityLabel.ts` (Slice 1), `PlayerActionContext` (Slice 2), `TradeOpenRequest`
  (Slice 3), History event context (Slice 4).
- Tests: `tests/architect` — context plumbing into both rooms; authority labels; empty/unavailable
  states; Guide-routes-not-mutates.

---

## 5. Data / shape changes

`FollowThroughContext` (new) — names indicative, mirrors the contract's UX-level payload table:

```
FollowThroughContext = {
  origin: 'receipt' | 'warning' | 'pinned-player' | 'history-event' | 'fa-target' | 'season-advance' | 'trade' | 'manual';
  teamCode?: string;
  worldId?: string | null;
  viewingSeason?: string;
  worldSeason?: string;
  playerIds?: string[];
  eventId?: string | null;
  receiptKind?: ArchitectPostActionReceipt['kind'];
  warningType?: TradeObjective | 'season-mismatch' | 'offer-sheet-action' | 'roster-count' | 'no-exceptions';
  localDraft?: boolean;
  unavailableReason?: string;
}
```

No change to the receipt model or mutation hooks. Guide-objective persistence is **session-only**
(open-question #11) — store the active context in `GMDashboard` state, not localStorage/Firestore.

---

## 6. Resolved open questions (this slice)

| # | Decision |
| --- | --- |
| 11 | Guide objective persists session-only; per-world persistence deferred. |
| 12 | Compare is committed-only for v1; local preview is labeled `Local preview` and otherwise deferred. |
| 13 | Compare player-level deltas deferred; v1 is event/team-level + authority labels (player-focused Compare shows `Unavailable` when a player delta can't be safely derived). |
| 14 | Compare is **not** the default post-commit landing; it stays an optional receipt link. |
| — | Both rooms route to existing owners only; neither mutates. |

---

## 7. Acceptance criteria

- [ ] Compare launches with context from Current Receipt, History event, Scenario Activity, pinned
      player, and cap warning.
- [ ] Compare renders the correct focused view per origin and labels every value's authority via
      `authorityLabel.ts`.
- [ ] Compare shows `Unavailable`/`Deferred` instead of guessing; never shows a local preview as
      committed.
- [ ] Compare links back to History when event context exists, and to Cap Sheet/Roster for current
      result.
- [ ] Guide launches with a concrete objective from receipt/warning/pinned/FA/trade/season contexts.
- [ ] Guide routes to Cap Sheet/Trade/FA/Roster/Offseason/History/Compare and **never** executes a
      mutation.
- [ ] Guide preserves the active team/world/season/player/problem context while open (session).
- [ ] Multi-season context is labeled `Multi-season`.
- [ ] Empty/unavailable states match the contract copy.

---

## 8. Verification

- `npm run typecheck`
- `npm run test:architect --reporter=dot` (context plumbing, labels, empty states, no-mutation)
- `npm run build`
- `npm run dev` walkthrough:
  1. Commit a trade → rail receipt → "Compare move" → Compare opens focused on that trade with
     `Committed world` labels + a link back to History.
  2. From the same receipt → "Guide next steps" → Guide opens with "Decide next move after this
     trade." and routing buttons (no mutation).
  3. Trigger an over-second-apron warning → Watchlist → Guide → "Solve second-apron restrictions."
     → Open Trade routes via `TradeOpenRequest` with the objective.
  4. Open a History event → Compare → `Event-derived` labels; unsupported fields show `Unavailable`.
  5. Advance a season → Compare from the season-advance receipt → `Multi-season` warning with the
     season distinction.
  6. Open Guide with no context → the "Choose a player, warning, receipt, or event…" empty state.

---

## 9. Non-goals / guardrails

- Neither room executes mutations or replaces a validator.
- Compare never invents deltas or shows local preview as committed.
- Compare does not replace History; Guide is not an unconstrained chatbot.
- No per-world Guide persistence in v1.
- No league-wide comparison (deferred until league/world authority is defined).
