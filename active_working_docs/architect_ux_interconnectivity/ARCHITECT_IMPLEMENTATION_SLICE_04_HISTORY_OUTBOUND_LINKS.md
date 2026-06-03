# Slice 04 — History Outbound Links

**Status:** Implementation spec (slice 4 of 5)
**Branch:** `feature/architect-cockpit-intelligence`
**Date:** 2026-06-03
**Source contract:** `ARCHITECT_HISTORY_OUTBOUND_LINK_CONTRACT.md` (+ Map §History, Slices §Slice 4)
**Master:** `ARCHITECT_IMPLEMENTATION_MASTER_SPEC.md`
**Depends on:** Slice 2 (`PlayerActionMenu`), Slice 3 (`TradeOpenRequest` related-event context), Slice 1 (`authorityLabel.ts`)
**Ships independently:** yes (but needs Slices 2–3 for player/trade routing)

---

## 1. Goal

Make committed History events navigable. Each event detail should route the user to the affected
players, rooms, and consequences — with clear "committed event vs current result" labeling and
honest "unavailable/deferred" messaging instead of fake links.

---

## 2. Current code state (do not rebuild)

- `history/TeamHistoryTab/TeamHistoryTab.tsx` renders the timeline; selecting a row sets
  `TeamHistorySelectedEntry`; detail shows in `HistoryDetailModal.tsx` (**read-only, dead-end**).
- Event shape (`history/TeamHistoryTab/types.ts`, `TeamHistoryLooseTimelineEntry`) already carries:
  `id`, `category`, `type`, `timestamp`, `teamsInvolved[]`, `playerIds[]`, `mutationType`
  (e.g. `executeTrade`, `waivePlayer`), `operationId`, `primaryDeltas`, `capDelta`,
  `beforeTotalsByTeam` / `afterTotalsByTeam`, `detailSections`.
- Timeline sources: world events (Firestore), local committed cap-sheet timeline, DEV fixtures
  (in-memory; never persisted — must not render as committed links).
- Scenario Activity (`ScenarioMoveRail`) and the receipt's "View in History" already open History;
  receipt carries `eventId`.

---

## 3. Gap to close

1. **Event-type-aware outbound links** in `HistoryDetailModal`, driven by `mutationType`/`type`,
   per the contract's per-event tables:

   | Event type | Outbound links (route to existing rooms/owners) |
   | --- | --- |
   | Trade | View on Roster, View on Cap Sheet, View in Full Cap, Compare trade, Guide next move, Open Trade context (related-event, no clone) |
   | Signing / Re-signing | View player, View on Roster, View on Cap Sheet, View in Full Cap, View FA context, Compare, Guide |
   | Sign-and-trade | View player, Cap Sheet, Roster, Open Trade context, Compare, Guide |
   | Waive / Stretch | View player, Cap Sheet (dead-cap), Full Cap, Compare, Guide |
   | Extension | View player, Cap Sheet, Full Cap (preferred), Compare, Guide |
   | Option decision | View player, Cap Sheet, Full Cap, Compare, Guide |
   | Renounce / cap hold | Cap Sheet (cap-hold area), Full Cap, Compare, Guide |
   | Offer sheet | Free Agency lifecycle, View player, Cap Sheet, Roster, Compare, Guide |
   | Season advance | Offseason, new-season Cap Sheet, Roster, Compare, Guide |
   | Draft pick / asset movement | History detail, Open Trade context, asset view (only if canonical summary), Compare (only if safe), Guide |

   Cap a detail panel at ~3–5 primary buttons; the rest go in an overflow.
2. **Player names → `PlayerActionMenu`** (open-question #9) using Slice 2's component, with a
   `PlayerActionContext` carrying `eventId` and `sourceRoom: 'history'`.
3. **Current-result vs event-snapshot labels** (use Slice 1 `authorityLabel.ts`): `Committed event`
   for the event; `Current roster result` / `Current cap sheet result` for destinations;
   `Event participant no longer on active roster`, `Current row unavailable`, `Asset summary
   unavailable` where applicable.
4. **Unavailable/deferred messaging** instead of fake links — the contract's message patterns:
   `Player link unavailable for this event.`, `Player is not currently on this roster.`,
   `Current cap row unavailable. View event details instead.`, `Draft asset summary is not available
   yet.`, `History detail link unavailable.`
5. **No auto-clone** of trades (reuse Slice 3 `TradeOpenRequest` with `relatedEventId` +
   `authority: 'committed-event-reference'`).
6. **DEV/local entries** must not expose committed-only links; label non-committed sources clearly.

---

## 4. Target files

- `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx` — render event-type
  outbound links + player-name menus + authority labels + unavailable messaging.
- `src/features/architect/history/TeamHistoryTab/historyOutboundLinks.ts` — **new** resolver:
  `resolveHistoryOutboundLinks(entry): HistoryOutboundLink[]` mapping `mutationType`/`type` to the
  link set, and resolving target availability (player on roster? cap row present? asset summary
  available?) conservatively. Pure function, well unit-tested.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx` — pass navigation-intent +
  trade-open-request + player-menu callbacks down to the modal.
- `src/features/architect/GMDashboard/GMDashboard.tsx` / `sections/HistorySection.tsx` — wire the
  History room's outbound callbacks to the shared navigation intents (Slice 2) and
  `openTradeWithRequest` (Slice 3).
- Reuse: `PlayerActionMenu` + `PlayerActionContext` (Slice 2); `TradeOpenRequest` (Slice 3);
  `authorityLabel.ts` (Slice 1).
- Tests: `tests/architect` — `historyOutboundLinks` resolver unit tests per event type;
  modal renders correct links; unavailable messaging; no-clone.

---

## 5. Data / shape changes

`HistoryOutboundLink` (new) — names indicative:

```
HistoryOutboundLink = {
  id: string;
  label: string;                 // "View on Cap Sheet", "Compare trade", ...
  kind: 'nav' | 'trade-context' | 'player-menu' | 'unavailable';
  intent?: PlayerNavigationIntent | { room: ActiveTab };
  tradeRequest?: TradeOpenRequest;     // for trade-context links
  unavailableReason?: string;          // contract message pattern
  authority: 'committed-event' | 'current-result' | 'unavailable' | 'deferred';
}
```

No change to the History event shape, the receipt model, or mutation hooks. The resolver reads the
existing `TeamHistoryLooseTimelineEntry` fields only.

---

## 6. Resolved open questions (this slice)

| # | Decision |
| --- | --- |
| 8 | Event detail stays a **modal** (`HistoryDetailModal`); side-panel deferred. |
| 9 | Player names open the `PlayerActionMenu`. |
| 10 | No "build similar trade"/auto-clone; related-event context only. |
| — | Outbound links live in event detail (not timeline rows) for v1. |
| — | Players who left the active team: show "Event participant no longer on active roster"; do not fake current rows. |

---

## 7. Acceptance criteria

- [ ] Trade events route to Roster, Cap Sheet, Full Cap, Compare, Guide, and Trade context without
      auto-cloning.
- [ ] Signing/sign-and-trade events route to player, Roster, Cap Sheet, FA, Compare, Guide.
- [ ] Waive/stretch route to dead-cap/current result only when resolvable; no resurrected roster
      rows.
- [ ] Extension/option route to Full Cap and Cap Sheet (Full Cap preferred for extensions).
- [ ] Offer-sheet events route to the Free Agency lifecycle section.
- [ ] Season-advance events route to Offseason, new-season Cap Sheet, Roster, Compare, Guide, and
      distinguish old/new world season vs viewing season.
- [ ] Draft/asset events never invent an unavailable asset summary; show "deferred/unavailable".
- [ ] Every destination is labeled committed-event vs current-result via `authorityLabel.ts`.
- [ ] Missing targets show the contract's unavailable messages, not fake links.
- [ ] Player names open the `PlayerActionMenu` with `eventId` context.
- [ ] History adds no mutation authority.

---

## 8. Verification

- `npm run typecheck`
- `npm run test:architect --reporter=dot` (resolver unit tests + modal link tests)
- `npm run build`
- `npm run dev` walkthrough:
  1. Commit a trade → open it in History → detail shows Roster/Cap/Full Cap/Compare/Guide/Trade-
     context links; Open Trade context shows a related-event banner, no auto-stage.
  2. Waive a player, then trade them away → History waive event labels them "no longer on active
     roster"; no fake cap row.
  3. Advance a season → season-advance event routes to Offseason + new-season Cap Sheet with the
     season distinction visible.
  4. A draft-pick event shows "Draft asset summary is not available yet." rather than a fake link.
  5. Click a player name in any event detail → `PlayerActionMenu` opens.

---

## 9. Non-goals / guardrails

- History never executes a mutation.
- No synthesizing drafts or asset truth from events.
- No auto-clone of trade events.
- No fake rows/players/asset summaries.
- DEV/local entries never render as committed links.
- No timeline-row inline links in v1 (detail only).
