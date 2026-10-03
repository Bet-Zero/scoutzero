# Slice 02 — Unified Player Action Menu

**Status:** Implementation spec (slice 2 of 5)
**Branch:** `feature/architect-cockpit-intelligence`
**Date:** 2026-06-03
**Source contract:** `ARCHITECT_PLAYER_ACTION_MENU_CONTRACT.md` (+ Map §Player Interconnectivity, Slices §Slice 2)
**Master:** `ARCHITECT_IMPLEMENTATION_MASTER_SPEC.md`
**Depends on:** Slice 1 (`authorityLabel.ts`)
**Reused by:** Slice 3 (player→trade), Slice 4 (History player names), Slice 5 (player→compare/guide)
**Ships independently:** yes (foundational — build this before 3/4/5)

---

## 1. Goal

Give every player surface in the cockpit the same consistent action vocabulary, via one reusable
`PlayerActionMenu` component and one shared player-context payload. This is the **largest gap** and
the backbone of cross-room player continuity.

---

## 2. Current code state (do not rebuild)

- **Full Cap** (`capSheet/CapSheetFull/CapSheetFull.tsx`) already has an **inline** kebab menu:
  `actionMenuIndex` state, `data-testid="cap-sheet-full-player-row-kebab"` /
  `"cap-sheet-full-player-row-action-menu"`, driven by `onLaunchPlayerAction?(player, action)` and
  `onTogglePin?(player)` props. This is the only existing menu and it is **not reusable**.
- **Roster** (`shared/RosterVisual/RosterVisual.tsx`) opens `EditContractModal` on card click via
  `onSelectPlayer`. No menu, no pin/trade/navigate.
- **Cap Sheet** (current season, `capSheet/CapSheet*`) opens `EditContractModal` on row click. No
  menu.
- **Pinned rail rows** (`cockpit/ActivityRail.tsx`) expose open/trade/unpin inline.
- **Receipt changed players**: `ArchitectPostActionReceipt.primaryPlayerIds` feeds
  `focusedPlayerIds` for highlight, but there is no per-player action affordance on the receipt.
- Player identity utilities exist: `GMDashboard/postActionHandoff/playerFocus.ts`
  (`resolvePrimaryPlayerFocusId`, `playerMatchesFocus`).
- Pins: `pinnedPlayerIds` + `addPin`/`removePin`/`togglePin` in `GMDashboard.tsx`.
- Navigation: `useArchitectDeskNavigation.ts` (`?room=`, `?player=`); `setActiveTab`.

---

## 3. Gap to close

1. **Build a reusable `PlayerActionMenu`** implementing the universal action vocabulary, with
   surface-aware visible subsets and a consistent overflow menu.
2. **Define a `PlayerActionContext` payload** carried by every invocation so destinations can
   highlight/return correctly.
3. **Wire navigation intents** (`view-on-roster`, `view-on-cap`, `view-in-full-cap`,
   `find-in-history`, `compare-impact`, `guide-next-move`, `trade`, `open`, `pin`/`unpin`) once in
   `GMDashboard.tsx` and pass them down. These handlers set `activeTab` + focus and reuse the
   existing pin/trade plumbing — **no new mutation authority**.
4. **Adopt the menu** on Roster, Cap Sheet, pinned-rail rows, and receipt changed-player rows; and
   **refactor Full Cap** to use the shared component (removing the bespoke inline menu while keeping
   its existing test ids working, or updating tests).
5. **No auto-pin on click** (already true; preserve it). Click = Open (inspect); Pin is explicit.
6. **FA targets (open-question #1):** treat as a pinned-player subtype — the menu's Pin action on a
   free agent adds a pin flagged as a "Target" (badge), reusing the one pinned board. No separate
   target board in v1.

### Universal action vocabulary (from the contract)

| Action | Destination / behavior |
| --- | --- |
| Open | `EditContractModal` (open-question #2; Player Profile deferred) |
| Pin / Unpin | Activity Rail pinned board (explicit) |
| Trade | Trade overlay, stage/request player (Slice 3 consumes the request) |
| View on Roster | `activeTab='roster'` + highlight if present |
| View on Cap Sheet | `activeTab='cap'` + highlight row if present |
| View in Full Cap | `activeTab='capfull'` + highlight (preserve target year) |
| Find in History | `activeTab='history'` + player-focused events when supported (Slice 4 deepens) |
| Compare impact | `activeTab='compare'` + player context (Slice 5 deepens) |
| Guide next move | `activeTab='guide'` + player context (Slice 5 deepens) |

### Surface-aware visible subsets (primary vs overflow)

| Surface | Primary (visible) | In overflow |
| --- | --- | --- |
| Roster card | Open, Pin/Unpin, Trade | View on Cap Sheet, View in Full Cap, Find in History, Compare, Guide |
| Cap Sheet row | Open, Pin/Unpin, Trade | View on Roster, View in Full Cap, Find in History, Compare, Guide |
| Full Cap row | Open, Pin/Unpin, Trade | View on Roster, View on Cap Sheet, Find in History, Compare, Guide; existing contract-action launchers (waive/extend/stretch/option/renounce) remain **Full-Cap-only** and continue to route to `EditContractModal`/`onLaunchContractAction` |
| Pinned rail row | Open, Trade, Unpin | View on Roster, View on Cap Sheet |
| Receipt changed player | View on Roster, View on Cap Sheet | Find in History, Compare, Guide (no auto-pin) |
| Free Agency card | Open, Pin (as Target) | Compare fit, Guide path; Sign / Offer-sheet remain **FA-only** via `EditContractModal` |

Mutation-bearing actions (waive/extend/option/renounce/sign/sign-and-trade/offer-sheet) are
**source-specific** and continue to route to their existing owners. The shared menu must not add
direct mutation buttons to Roster/Cap rows.

---

## 4. Target files

- `src/features/architect/cockpit/PlayerActionMenu.tsx` — **new** reusable component; export from
  `cockpit/index.ts`.
- `src/features/architect/cockpit/playerActionContext.ts` — **new** `PlayerActionContext` type +
  small builder helpers (e.g. `buildPlayerActionContext`). Export from `cockpit/index.ts`.
- `src/features/architect/shared/RosterVisual/RosterVisual.tsx` — add menu affordance (keep
  card-click = Open).
- `src/features/architect/capSheet/CapSheet*` (current-season cap sheet component) — add menu.
- `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx` — replace inline kebab with the
  shared menu; preserve/adjust `data-testid`s and the Full-Cap-only contract-action launchers.
- `src/features/architect/cockpit/ActivityRail.tsx` — pinned rows + receipt rows use the menu.
- `src/features/architect/GMDashboard/GMDashboard.tsx` — define the navigation-intent handlers and
  pass them through `CockpitShell`/room descriptors; route Pin/Trade through existing
  `addPin`/`togglePin` + open-trade plumbing.
- `src/features/architect/GMDashboard/hooks/useArchitectDeskNavigation.ts` — if a new focus signal
  (beyond `?player=`) is needed for non-pinned manual focus; otherwise unchanged.
- Reuse: `GMDashboard/postActionHandoff/playerFocus.ts` for id resolution/matching — do not
  duplicate identity logic.
- Tests: `tests/architect` / `src/tests` — menu rendering per surface, no-auto-pin, navigation
  intents, FA-target badge.

---

## 5. Data / shape changes

`PlayerActionContext` (new) — UX-level payload, names indicative:

```
PlayerActionContext = {
  playerId: string;
  playerLabel: string;
  sourceRoom: ActiveTab | 'rail' | 'receipt' | 'history' | 'fa';
  teamCode?: string;
  worldId?: string | null;
  targetYear?: number;        // for Full Cap future-year actions
  eventId?: string | null;    // when player comes from a receipt/History event
  isFreeAgentTarget?: boolean; // FA pin subtype (open-question #1)
}
```

`PlayerActionMenu` props (new) — `context`, `visibleActions`/`overflowActions` (surface subset),
and a single `onAction(action, context)` callback (plus optional `isPinned` to toggle Pin/Unpin
label). The component renders **no business logic** — it only emits intents.

No changes to `ArchitectPostActionReceipt`, `pinnedPlayerIds` shape (still `string[]`; the
FA-target flag can live in a parallel `Set`/map in `GMDashboard` keyed by id, or as a small
`{id, isTarget}` upgrade — implementer's choice, but keep it session/visual-only).

---

## 6. Resolved open questions (this slice)

| # | Decision |
| --- | --- |
| 1 | FA targets are a pinned-player subtype with a "Target" badge; one board. |
| 2 | Open routes to `EditContractModal`; Player Profile split deferred. |
| 3 | Pins session + active-team scoped; `?player=` preserved; clear on team/world change. |
| 4 | No auto-pin on click; Open inspects. |
| — | Menu actions are identical in vocabulary but surface-aware in visibility. |
| — | Multi-player highlight: receipt/`Trade all` highlight every present player; no fake rows for absent players. |

---

## 7. Acceptance criteria

- [ ] A single `PlayerActionMenu` component is used by Roster, Cap Sheet, Full Cap, pinned-rail
      rows, and receipt rows (Full Cap's bespoke menu removed).
- [ ] Primary player click on Roster/Cap/Full Cap opens `EditContractModal` (inspect), never pins.
- [ ] Pin is explicit from any player surface; pinned players appear in the rail; no duplicate pins.
- [ ] Unpin removes from the board only — no roster/cap/world change.
- [ ] View-on-Roster/Cap/Full-Cap switches room and highlights the player when present; shows no
      fake row/card when absent.
- [ ] Trade opens the overlay with the player staged/requested (consumed by Slice 3 plumbing) and
      does not unpin.
- [ ] Full Cap actions preserve target-year context.
- [ ] FA Pin adds a pin badged "Target"; signing/offer-sheet remain in `EditContractModal`.
- [ ] Receipt changed-players expose View-on-Roster/Cap + History/Compare/Guide, and do **not**
      auto-pin.
- [ ] No mutation authority added: the menu emits intents only; world writes still flow through
      `useArchitectActions`.
- [ ] Unresolved/absent players are labeled conservatively (no fake links).

---

## 8. Verification

- `npm run typecheck`
- `npm run test:architect --reporter=dot` (add per-surface menu tests; update Full Cap kebab tests)
- `npm run validate:project` (new component + exports)
- `npm run build`
- `npm run dev` walkthrough:
  1. Roster: click a card → modal opens (not pinned). Open menu → Pin → appears in rail.
  2. From the menu choose View on Cap Sheet → room switches, row highlighted.
  3. Cap Sheet: menu → Trade → overlay opens with player staged.
  4. Full Cap: confirm waive/extend/stretch still launch the contract modal; menu navigation works
     and preserves the year.
  5. Free Agency: Pin a FA → appears in rail with a "Target" badge.
  6. Commit a multi-player trade → receipt changed-players each offer View-on-Roster/Cap with
     highlight; none auto-pin.

---

## 9. Non-goals / guardrails

- No Player Profile surface (Open = contract modal for now).
- No direct waive/extend/option/renounce/sign buttons on Roster or current-season Cap rows.
- No second "Targets" board.
- No new identity source — reuse `playerFocus.ts`.
- Menu emits intents only; it must not import `useArchitectActions`/`mutationPipeline`.
