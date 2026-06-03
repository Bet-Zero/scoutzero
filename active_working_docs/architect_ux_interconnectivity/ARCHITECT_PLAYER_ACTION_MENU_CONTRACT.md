# Architect Player Action Menu Contract

**Status:** Product / UX contract  
**Branch:** `feature/architect-cockpit-intelligence`  
**Date:** 2026-06-02  
**Parent map:** `ARCHITECT_UX_INTERCONNECTIVITY_MAP.md`  
**Parent slices:** `ARCHITECT_UX_INTERCONNECTIVITY_SLICES.md`  
**Related contract:** `ARCHITECT_ACTIVITY_RAIL_CONTRACT.md`  
**Slice:** Player Action Menu Contract  
**Scope:** Cross-room player behavior, player action vocabulary, source/destination surfaces, carried player context, highlight rules, pinning rules, and acceptance criteria.  
**Non-scope:** Code implementation details, component file edits, TypeScript shapes, Firestore schema changes, mutation-pipeline changes, or test-command planning.

---

## Purpose

The Player Action Menu defines how a player remains usable across the Architect cockpit.

Architect has many surfaces that show players:

- Roster,
- Cap Sheet,
- Full Cap,
- Trade Machine,
- Free Agency,
- History,
- Compare,
- Guide,
- Current Receipt,
- Activity Rail pinned players.

The user should not have to remember which room they found a player in. A player should carry cleanly across the GM desk.

This contract defines what the user should be able to do with a player from any compatible surface.

---

## North Star

A player should never be a dead-end visual object.

When the user sees a player, they should be able to answer:

1. Who is this player?
2. What is their contract/cap situation?
3. Can I pin them for later?
4. Can I trade them?
5. Can I find them on the roster?
6. Can I find them on the cap sheet?
7. Can I see their history in this world?
8. Can I compare or guide around this player?

The player action model should make Architect feel like one connected GM desk instead of separate rooms that each happen to show player names.

---

## Core Rule

Clicking a player should usually **inspect/open** the player.

Pinning should be explicit.

Trading should be explicit.

Mutations should still happen only through existing action owners such as the contract modal, Trade Machine, Free Agency, offer-sheet lifecycle, or Offseason flows.

---

## Player States

Architect should distinguish these player states:

| State | Meaning | UX behavior |
| --- | --- | --- |
| **Viewed player** | User clicked/opened a player for inspection. | Opens player/contract surface. Does not auto-pin. |
| **Focused player** | User is currently carrying player context across rooms. | Highlight where present. Session-level only. |
| **Pinned player** | User intentionally saved player to the Activity Rail. | Persists in rail until unpinned or scope clears. |
| **Changed player** | Player was affected by latest committed action. | Temporary receipt-driven highlight and next-step links. |
| **Staged player** | Player is included/requested in a local trade draft. | Local draft state only until applied. |
| **Unavailable player** | Player id/name exists but current surface cannot resolve full identity. | Show conservative label and avoid fake links. |

---

## Universal Player Actions

Every player surface does not need to expose every action at once, but the action vocabulary should stay consistent.

| Action | User-facing meaning | Expected destination |
| --- | --- | --- |
| **Open** | Inspect player and contract/action context. | Player/contract modal or future player profile surface. |
| **Pin** | Keep player on the Activity Rail board. | Activity Rail pinned players. |
| **Unpin** | Remove player from Activity Rail board. | Activity Rail only. |
| **Trade** | Start or resume a trade involving this player. | Trade Machine overlay. |
| **View on Roster** | Show the player on visual roster. | Roster with highlight. |
| **View on Cap Sheet** | Show the player’s cap/contract row. | Cap Sheet with highlight. |
| **View in Full Cap** | Show multi-year player/contract context. | Full Cap with highlight. |
| **Find in History** | Show committed events involving the player. | History root/filter/detail when available. |
| **Compare impact** | Review player’s effect in scenario/change context. | Compare. |
| **Guide next move** | Use player as input to guided planning. | Guide. |

---

## Primary Click Behavior

Different surfaces may use different primary click affordances, but the default rule should be stable.

| Surface | Primary player click should do |
| --- | --- |
| Roster | Open player/contract inspection. |
| Cap Sheet | Open player/contract inspection. |
| Full Cap | Open player/contract inspection for relevant year/context. |
| Trade Machine | Open player/contract inspection or trade-specific player detail, depending on local UI. |
| Free Agency | Open FA/player signing detail. |
| History | Open player action menu or player-related event context. |
| Compare | Open player action menu or source-room link. |
| Guide | Open player action menu or recommendation detail. |
| Activity Rail pinned player | Open player context. |
| Current Receipt player | Open affected-player context or source-room link. |

Pinning and trading should not be hidden side effects of the primary click.

---

## Source Surfaces

### Roster

Roster is the visual team board.

Expected player actions:

| Action | Behavior |
| --- | --- |
| Open | Opens player/contract inspection. |
| Pin | Adds player to Activity Rail. |
| Trade | Opens Trade Machine overlay with player staged/requested. |
| View on Cap Sheet | Opens Cap Sheet with player highlight. |
| View in Full Cap | Opens Full Cap with player highlight. |
| Find in History | Opens player-related committed events when supported. |
| Compare impact | Opens Compare with player context when supported. |
| Guide next move | Opens Guide with player/team context. |

Roster should not expose direct waive/extend/option/renounce buttons outside the existing modal/action owner.

### Cap Sheet

Cap Sheet is the primary contract/cap action surface.

Expected player actions:

| Action | Behavior |
| --- | --- |
| Open | Opens existing contract/action modal. |
| Pin | Adds player to Activity Rail. |
| Trade | Opens Trade Machine overlay with player staged/requested. |
| View on Roster | Opens Roster with highlight. |
| View in Full Cap | Opens Full Cap with highlight. |
| Find in History | Opens committed player events when supported. |
| Compare impact | Opens Compare with player/cap context. |
| Guide next move | Opens Guide with player/cap problem context. |

Cap Sheet remains the surface where contract/cap context is most actionable, but actual mutations still belong to existing action owners.

### Full Cap

Full Cap is the multi-year planning surface.

Expected player actions:

| Action | Behavior |
| --- | --- |
| Open | Opens player/contract modal with year/context when relevant. |
| Pin | Adds player to Activity Rail. |
| Trade | Opens Trade overlay with player staged/requested. |
| View on Roster | Opens Roster with highlight. |
| View on Cap Sheet | Opens selected/current Cap Sheet with highlight. |
| Find in History | Opens committed player events. |
| Compare impact | Opens Compare with player/multi-year context. |
| Guide next move | Opens Guide with player planning context. |

Full Cap should preserve selected-year context when the player action starts from a future-year cell or future contract row.

### Trade Machine

Trade Machine is a local draft workspace until a trade is applied.

Expected player actions:

| Action | Behavior |
| --- | --- |
| Open | Opens player/contract inspection from inside trade context. |
| Pin | Adds player to Activity Rail. |
| Remove from draft | Local trade-draft action inside Trade Machine only. |
| View on Cap Sheet | Opens Cap Sheet with player highlight, if user leaves overlay. |
| View on Roster | Opens Roster with player highlight, if user leaves overlay. |
| Find in History | Opens committed player events. |
| Compare impact | Only for committed moves or safely derived local preview, with clear authority label. |

Trade Machine should not make local staged players appear as committed player changes until applied.

### Free Agency

Free Agency includes players who may not currently be on the active roster.

Expected player actions:

| Action | Behavior |
| --- | --- |
| Open | Opens FA/player signing detail. |
| Pin / Target | Saves the player as a target in Activity Rail or target section. |
| Sign | Uses existing signing owner. |
| Sign-and-trade | Uses existing world-only action owner. |
| Offer sheet | Uses existing offer-sheet lifecycle owner. |
| Compare fit/impact | Opens Compare or Guide where relevant. |
| Guide signing path | Opens Guide with player/team/cap context. |

Open question: FA players may need a **Target** action distinct from **Pin**, or the product can treat FA targets as a specialized pinned-player type.

### History

History is committed truth.

Expected player actions from event detail:

| Action | Behavior |
| --- | --- |
| Open player | Opens player context if resolvable. |
| View on Roster | Opens Roster with highlight if player is present. |
| View on Cap Sheet | Opens Cap Sheet with highlight if row exists. |
| View in Full Cap | Opens Full Cap with highlight if row exists. |
| Compare event impact | Opens Compare with event/player context. |
| Guide next move | Opens Guide with event/player context. |

History should label when a player is no longer on the active team or cannot be resolved on the current roster/cap sheet.

### Compare

Compare is an authority-labeled “what changed?” room.

Expected player actions:

| Action | Behavior |
| --- | --- |
| Open player | Opens player context where resolvable. |
| View source event | Opens History event detail. |
| View on Roster | Opens Roster with highlight if present. |
| View on Cap Sheet | Opens Cap Sheet with highlight if present. |
| Guide next move | Opens Guide with comparison/player context. |

Compare should not invent player deltas where authority is unclear.

### Guide

Guide is a planning and routing surface.

Expected player actions:

| Action | Behavior |
| --- | --- |
| Open player | Opens player context. |
| Pin | Adds player to Activity Rail. |
| Trade | Opens Trade overlay with player context. |
| View on Cap Sheet | Opens Cap Sheet with highlight. |
| View on Roster | Opens Roster with highlight. |
| Compare impact | Opens Compare with guide objective context. |

Guide should suggest and route. It should not silently mutate player/team/world state.

### Activity Rail Pinned Players

Pinned players are explicit user selections.

Expected actions:

| Action | Behavior |
| --- | --- |
| Open | Opens player context or current best source-room link. |
| Trade | Opens Trade overlay with that player staged/requested. |
| Trade all | Opens Trade overlay with all pinned players staged/requested. |
| Unpin | Removes from pinned board only. |
| View on Roster | Optional secondary route. |
| View on Cap Sheet | Optional secondary route. |

Pinned-player actions should not mutate world state directly.

### Current Receipt Players

Changed players from the latest committed receipt should support:

| Action | Behavior |
| --- | --- |
| View on Roster | Opens Roster with highlight where present. |
| View on Cap Sheet | Opens Cap Sheet with highlight where present. |
| View in History | Opens committed event detail. |
| Compare impact | Opens Compare with receipt/event context. |
| Guide next move | Opens Guide with receipt/player context. |

Changed players should not automatically become pinned players.

---

## Destination Behavior

### Open Player / Contract Context

Opening a player should inspect the player through the current authoritative inspection surface.

For now, this is generally the existing player/contract modal or the existing FA signing modal.

Long-term, Architect may separate:

- **Player Profile** — scouting/bio/stats context,
- **Contract Modal** — cap/contract action context.

Until that separation exists, “Open” can route to the existing modal/action surface.

### View on Roster

Expected behavior:

- Switch to Roster room.
- Highlight the player if present.
- If player is not on the current roster, show no fake placeholder.
- Optional future behavior: show a small message explaining the player is not currently on this roster.

### View on Cap Sheet

Expected behavior:

- Switch to Cap Sheet room.
- Highlight the player row if present.
- If player is represented as cap hold/dead cap instead of active contract, highlight the correct row only if authority is clear.
- If not present, do not invent a row.

### View in Full Cap

Expected behavior:

- Switch to Full Cap room.
- Highlight the player across years where present.
- Preserve target-year context when launched from a year-specific action.

### Trade

Expected behavior:

- Open Trade Machine overlay.
- Stage or request player inclusion in trade draft.
- Show local draft authority until applied.
- Preserve draft when overlay closes.

### Find in History

Expected behavior:

- Open History.
- Filter/focus/select player-related committed events when supported.
- If no player-specific History focus exists yet, open History root and preserve player context where possible.

### Compare Impact

Expected behavior:

- Open Compare.
- Use event/player/team context when authority is available.
- Show unavailable/deferred if player-specific comparison cannot be safely derived.

### Guide Next Move

Expected behavior:

- Open Guide.
- Carry player/team/problem context.
- Guide suggests routes to existing rooms/actions.
- Guide does not directly mutate world state.

---

## Context Carried Across Rooms

| Context | Purpose |
| --- | --- |
| Player id | Primary identity for highlight/routing. |
| Player label | Display in menus, pins, receipts, and fallback states. |
| Source room | Return/fallback context after modal/overlay closes. |
| Target year | Needed for Full Cap/future-year actions. |
| Team code | Needed for active-team scoping. |
| World id | Needed for committed-world/history/compare context. |
| Event id | Needed when player comes from a committed receipt or History event. |
| Action intent | Open, pin, trade, compare, guide, etc. |
| Authority label | Committed world, local draft, sandbox, unavailable, etc. |
| Multi-player set | Needed for trades and multi-player receipts. |

---

## Highlight Rules

Highlights are visual orientation only.

They do not change world state.

### Highlight Sources

| Source | Highlight lifetime |
| --- | --- |
| Pinned player | Until unpinned or scope clears. |
| Current receipt changed player | Until receipt dismissed/replaced/scope clears. |
| Manual navigation focus | Session-level; may clear on room change or next focus. |
| History event player focus | Session-level or until History target clears. |
| Compare/Guide player focus | Session-level or until objective changes. |

### Multi-Player Highlight

Multi-player actions should highlight every relevant player where present.

Examples:

- multi-player trade,
- sign-and-trade involving multiple changed players,
- receipt with multiple changed player ids,
- “Trade all pinned.”

If a highlighted player is not present on a destination surface, do not create fake rows or cards.

### Highlight Authority

Highlights should not imply committed truth by themselves.

A pinned player highlight means “user pinned this player.”

A receipt highlight means “this player was affected by the latest committed action.”

A local draft highlight means “this player is part of local work.”

Those should be visually distinguishable where needed.

---

## Pinning Rules

Pinning is explicit.

### Allowed Pin Sources

Players should eventually be pinnable from:

- Roster,
- Cap Sheet,
- Full Cap,
- Trade Machine,
- Free Agency,
- History event detail,
- Compare,
- Guide,
- Current Receipt.

### Pin Behavior

- Add player to Activity Rail pinned board.
- Do not duplicate the same player if already pinned.
- Keep pinned players visible until unpinned or scope clears.
- Pinned players may carry into Trade overlay.
- Pinning should not create committed world data.

### Unpin Behavior

- Removes player from pinned board only.
- Does not remove player from roster, trade draft, receipt, history, or world state.

### Scope Questions

Potential clearing rules:

| Scope change | Possible behavior |
| --- | --- |
| Team change | Clear pins or keep only if player belongs to new team/context. |
| World change | Clear pins or keep with sandbox/world label. |
| Page reload | Restore first pinned player from URL only, or persist all pins in session/local storage. |
| Receipt dismissal | Does not affect pins. |

Recommendation for first version: pins are session-level and active-team scoped unless URL behavior already supports a specific pinned player.

---

## Local vs Committed Player Context

A player can appear in different authority states.

| Context | Meaning | UX rule |
| --- | --- | --- |
| Roster/Cap current data | Current loaded team state. | Treat as current surface truth. |
| Pinned player | User-selected object. | Not committed activity. |
| Trade staged player | Local draft. | Label as local until applied. |
| Receipt changed player | Committed action result. | Label through receipt/event context. |
| History player | Committed event participant. | Label as event-derived/committed. |
| FA target | Target/local planning object. | Not roster/cap truth until signed. |
| DEV preview player | Dev-only preview. | Never committed world truth. |

---

## Player Action Menu Layout

This contract does not prescribe exact UI design, but recommends grouping actions by job.

Suggested grouping:

### Primary

- Open
- Pin / Unpin

### Move / Planning

- Trade
- Compare impact
- Guide next move

### Locate

- View on Roster
- View on Cap Sheet
- View in Full Cap
- Find in History

### Source-specific

- Sign / offer sheet actions in Free Agency only
- Remove from trade draft in Trade Machine only
- Cap-hold/renounce actions through existing Cap Sheet / modal owners only

Avoid huge menus. Surface the most common actions first and keep deeper actions behind a consistent menu.

---

## Surface-Specific Minimums For First Implementation Slice

If implementation starts after this contract, the minimum useful slice should cover:

1. Roster player open/pin/trade/view-cap behavior.
2. Cap Sheet player pin/trade/view-roster behavior.
3. Activity Rail pinned player open/trade/unpin behavior.
4. Receipt changed-player highlight behavior.
5. Trade overlay entry from pinned player and trade-all pinned.
6. No auto-pin on normal player click.
7. No new mutation authority.

Future slices can add:

- Full Cap deep player navigation,
- History outbound player links,
- FA targets vs pinned-player distinction,
- Compare player-specific routing,
- Guide objective player persistence.

---

## Non-Goals

- Do not auto-pin players when clicked.
- Do not treat player focus as committed world data.
- Do not add direct Roster mutation controls outside existing owners.
- Do not bypass the contract/action modal for waive/extend/option/renounce behavior.
- Do not bypass Trade Machine for trade apply behavior.
- Do not make FA target selection look like a completed signing.
- Do not make local trade-staged players look committed.
- Do not invent History links where no committed event/player identity exists.
- Do not require every surface to show every action at once.
- Do not solve future Player Profile vs Contract Modal architecture in this slice.

---

## Acceptance Checklist

- Player action vocabulary is defined.
- Player states are defined: viewed, focused, pinned, changed, staged, unavailable.
- Primary click behavior is defined by surface.
- Pinning is explicit.
- Pinned players appear in Activity Rail.
- Pinned players can be opened from Activity Rail.
- Pinned players can be traded from Activity Rail.
- Multiple pinned players can support Trade all.
- Changed players from receipts can highlight across rooms.
- Multi-player actions can highlight multiple players.
- Roster player actions do not add direct mutation authority.
- Cap Sheet player actions route through existing owners.
- Trade player context remains local until applied.
- History player links are committed-event based.
- Compare uses authority labels and does not invent deltas.
- Guide routes/suggests but does not silently mutate.
- Missing/unresolved players are labeled conservatively.

---

## Open Questions

1. Should **Open** eventually route to a true Player Profile instead of the contract/action modal?
2. Should Free Agency use **Pin**, **Target**, or both?
3. Should pinned players be scoped by team, world, browser session, or URL?
4. Should player focus survive page reload beyond the existing URL player param pattern?
5. Should History event player names open a player action menu or jump straight to Cap Sheet/Roster?
6. Should Trade Machine show staged pinned players with a different visual label than manually added players?
7. Should Compare support player-level context in the first implementation pass?
8. Should Guide store an active player objective in the Activity Rail?
9. Should multi-player highlight use one visual treatment for all players or distinguish primary/secondary affected players?
10. Should unpinning a player also clear their highlight, or should receipt/manual focus still highlight them if independently active?

---

## Recommended Next Step

After this contract is accepted, there are two reasonable paths:

### Path A — Continue contracts first

Create:

`ARCHITECT_TRADE_OVERLAY_ENTRY_CONTRACT.md`

This is useful if the goal is to finish the key UX contracts before implementation.

### Path B — Start implementation planning

Create an implementation prompt for the first combined slice:

- Activity Rail contract compliance,
- Player Action Menu minimums,
- pinned player open/trade/unpin,
- no auto-pin on click,
- clear local-vs-committed labels.

Recommendation: **create the Trade Overlay Entry Contract next**, because pinned-player trade behavior depends heavily on how Trade Machine opens, stages, resumes, and preserves local draft state.
