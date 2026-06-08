# Architect Compare / Guide Follow-Through Contract

**Status:** Product / UX contract  
**Branch:** `feature/architect-cockpit-intelligence`  
**Date:** 2026-06-03  
**Parent map:** `ARCHITECT_UX_INTERCONNECTIVITY_MAP.md`  
**Parent slices:** `ARCHITECT_UX_INTERCONNECTIVITY_SLICES.md`  
**Related contracts:**  
- `ARCHITECT_ACTIVITY_RAIL_CONTRACT.md`  
- `ARCHITECT_PLAYER_ACTION_MENU_CONTRACT.md`  
- `ARCHITECT_TRADE_OVERLAY_ENTRY_CONTRACT.md`  
- `ARCHITECT_HISTORY_OUTBOUND_LINK_CONTRACT.md`  
**Slice:** Compare / Guide Follow-Through Contract  
**Scope:** How Compare and Guide are launched from receipts, warnings, pinned players, History events, cap posture, trade context, and other cockpit surfaces.  
**Non-scope:** Code implementation details, component edits, TypeScript shapes, Firestore schema changes, mutation-pipeline changes, AI recommendation engines, or test-command planning.

---

## Purpose

Compare and Guide are the cockpit’s follow-through rooms.

Compare answers:

> What changed?

Guide answers:

> What should I do next?

They should not feel like isolated tabs. They should be reachable from the exact moments when the user needs them: after a committed move, after a warning appears, after a player is pinned, after a History event is inspected, or while solving a cap/team-building problem.

---

## Core Decision

Compare and Guide should be **context receivers**, not hidden mutation engines.

They can carry player, team, world, warning, receipt, event, and local-planning context.

They should route the user to existing rooms and action owners.

They should not directly execute trades, signings, waives, extensions, offer-sheet actions, or season advancement.

---

## North Star

A user should not have to manually reconstruct context.

If they just completed a trade, Compare should know the trade context.  
If they are above the apron, Guide should know the cap warning context.  
If they pinned a player, Compare and Guide should know the player context.  
If they opened a History event, Compare and Guide should know the committed event context.

The user’s question should carry forward:

- What changed?
- Who changed?
- What problem am I solving?
- Which player/team/world/season is this about?
- Where should I inspect or act next?

---

# Compare Contract

## Compare UX Goal

Compare is the event/world/player/team delta room.

It should show what changed in a world/scenario using authority-labeled information.

Compare should not invent missing deltas. If a delta cannot be safely derived, it should say unavailable or deferred.

## Compare Launch Sources

Compare can be launched from:

| Source | Compare context carried |
| --- | --- |
| Current Receipt | Latest committed action/event. |
| Activity Rail Scenario Activity | Selected committed event. |
| History event detail | Committed event id/type/participants. |
| Pinned player | Player-specific context where available. |
| Cap warning | Cap/tax/apron posture context. |
| Trade overlay after apply | Trade receipt/event context. |
| Trade overlay local draft | Local preview context only, if clearly labeled. |
| Free Agency signing receipt | Signing/contract/cap context. |
| Offseason advance receipt | Multi-season transition context. |
| Guide recommendation | Problem/objective context. |

## Compare User-Facing Behavior

Compare should show:

- active world/scenario scope,
- active team scope,
- event count or selected event context,
- roster additions/removals/changed players where available,
- cap allocation delta where available,
- tax/apron posture delta where available,
- season crossing warning where relevant,
- unavailable/deferred fields where authority is missing,
- source links back to History, Cap Sheet, Roster, Trade, or Guide.

## Compare Authority Labels

Every meaningful Compare value should make its authority clear.

| Authority | Meaning | Label |
| --- | --- | --- |
| Committed world | Derived from saved world/event state. | `Committed world` |
| Event-derived | Derived from one or more committed events. | `Event-derived` |
| Current snapshot | Derived from current loaded team/world state. | `Current snapshot` |
| Local preview | Derived from unapplied local draft. | `Local preview` |
| Multi-season | Crosses season-advance boundary. | `Multi-season` |
| Unavailable | Cannot safely derive. | `Unavailable` |
| Deferred | Intentionally not modeled yet. | `Deferred` |

Hard rule:

> Local preview and committed comparison must never look the same.

## Compare Context Types

### Receipt-Focused Compare

When launched from a receipt:

- focus the just-committed action,
- show affected players/teams where available,
- link to History event detail,
- link to Cap Sheet/Roster for current result,
- offer Guide next steps.

### Event-Focused Compare

When launched from History:

- focus the selected committed event,
- label it as event-derived,
- show what Compare can safely infer,
- show unavailable/deferred for unsupported fields,
- preserve route back to History.

### Player-Focused Compare

When launched from a pinned player or player action menu:

- carry player id/label,
- show player-related changes where supported,
- route to Roster/Cap Sheet/Full Cap/History,
- say unavailable if player-specific delta is not implemented safely.

### Warning-Focused Compare

When launched from cap/tax/apron warning:

- show current cap posture and relevant deltas where available,
- explain if Compare cannot identify the move that caused the posture,
- route to Cap Sheet and Guide.

### Season-Advance Compare

When launched from season-advance receipt/history:

- show multi-season warning,
- distinguish old season, new world season, and selected viewing season,
- show offseason effects only where authority exists,
- route to Offseason, Cap Sheet, Roster, and History.

## Compare Non-Goals

- Do not invent roster/cap/asset deltas from incomplete data.
- Do not treat local trade draft preview as committed comparison.
- Do not replace History as the committed event log.
- Do not become a mutation surface.
- Do not claim exact event-time snapshots unless snapshot authority exists.
- Do not imply league-wide comparison is complete before league/world authority is defined.

## Compare Acceptance Criteria

- Compare can launch from Current Receipt.
- Compare can launch from History event detail.
- Compare can launch from Activity Rail Scenario Activity where event context exists.
- Compare can launch from pinned/player context where supported.
- Compare can launch from cap/tax/apron warnings where useful.
- Compare clearly labels committed/event/current/local/unavailable authority.
- Compare shows unavailable/deferred rather than guessing.
- Compare links back to History when event context exists.
- Compare links to Cap Sheet/Roster when current result inspection is useful.
- Compare offers Guide follow-through when the user likely needs a next step.

---

# Guide Contract

## Guide UX Goal

Guide is the planning and routing room.

Guide should help the user decide what to do next, then route them into the correct existing Architect surface.

Guide should not silently execute moves.

## Guide Launch Sources

Guide can be launched from:

| Source | Guide context carried |
| --- | --- |
| Current Receipt | What just happened and affected players/teams. |
| Activity Rail Watchlist | Active warning/problem. |
| Activity Rail Pinned Players | Player/team context. |
| Cap Sheet warning | Cap/tax/apron/exception problem. |
| Roster player action | Player/team-building context. |
| Free Agency target | Signing path/player/cap context. |
| Trade overlay | Trade objective or failed validation context. |
| History event detail | Committed event context. |
| Compare result | Delta/problem context. |
| Offseason season mismatch | World/viewing season alignment context. |

## Guide User-Facing Behavior

Guide should open with a concrete objective when context exists.

Examples:

| Context | Guide objective |
| --- | --- |
| Above second apron | `Solve second-apron restrictions.` |
| Hard cap active | `Work around hard-cap limit.` |
| Pinned player | `Explore moves involving this player.` |
| Trade receipt | `Decide next move after this trade.` |
| Signing receipt | `Review cap/roster impact after signing.` |
| Failed trade validation | `Fix trade validation issue.` |
| FA target | `Find a legal signing path.` |
| Season mismatch | `Align viewing season with world season.` |
| Offer sheet warning | `Resolve offer-sheet lifecycle action.` |

## Guide Output Types

Guide should provide routes, not hidden actions.

| Output | Behavior |
| --- | --- |
| Open Cap Sheet | Route to cap/context inspection. |
| Open Trade Machine | Route to Trade overlay with objective/player context. |
| Open Free Agency | Route to FA pool/offer sheet context. |
| Open Roster | Route to roster/player context. |
| Open Offseason | Route to season-alignment/advance context. |
| Open History | Route to committed event context. |
| Open Compare | Route to delta review. |
| Pin player | If supported, route through explicit player pin action. |

Guide should not directly apply a trade, sign a player, match an offer sheet, waive/extend, renounce, or advance season.

## Guide Context Types

### Receipt-Focused Guide

When launched from receipt:

- summarize what just happened,
- identify likely next inspection surfaces,
- suggest routes to Cap Sheet/Roster/History/Compare,
- do not create new mutation suggestions as commands without user action.

### Warning-Focused Guide

When launched from Watchlist/Cap Posture:

- state the problem plainly,
- show relevant current posture,
- route to Cap Sheet for inspection,
- route to Trade/FA when action makes sense,
- route to Compare if useful to understand how the problem emerged.

### Player-Focused Guide

When launched from player/pinned player:

- carry player id/label/team context,
- route to Roster/Cap Sheet/Full Cap/Trade/Compare/History,
- support “what can I do with this player?” without auto-mutating.

### Trade-Focused Guide

When launched from Trade Machine or failed trade validation:

- explain the trade objective or failure context,
- route back to Trade Machine to edit,
- route to Cap Sheet for contract/cap inspection,
- route to Compare only for committed or clearly labeled preview context.

### Free-Agency-Focused Guide

When launched from FA target/signing/offer-sheet context:

- carry player/cap/team context,
- route to Free Agency, Cap Sheet, Roster, or Compare,
- distinguish target/pending/offered/signed states.

### Offseason-Focused Guide

When launched from season mismatch or season advance:

- distinguish selected viewing season vs authoritative world season,
- route to Offseason, Cap Sheet, Roster, History, or Compare,
- do not advance the season directly.

## Guide Non-Goals

- Do not execute hidden mutations.
- Do not replace validators.
- Do not pretend uncertain recommendations are guaranteed legal moves.
- Do not generate fake cap/roster/asset truth.
- Do not bypass Trade Machine, Free Agency, contract modal, offer-sheet lifecycle, or Offseason action owners.
- Do not become a generic chatbot panel with no preserved Architect context.

## Guide Acceptance Criteria

- Guide can launch from Current Receipt with receipt context.
- Guide can launch from Watchlist/cap warning with problem context.
- Guide can launch from pinned player/player action with player context.
- Guide can launch from History event with committed-event context.
- Guide can launch from Compare with delta/problem context.
- Guide routes to existing rooms/actions instead of mutating directly.
- Guide distinguishes committed, local, pending, failed, sandbox, and unavailable context.
- Guide preserves the active team/world/season/player/problem context while open.

---

# Cross-Room Follow-Through Rules

## From Receipt

Receipt should be able to offer:

- View Cap Sheet,
- View Roster,
- View History,
- Compare move,
- Guide next steps.

Compare receives event/change context.  
Guide receives next-decision context.

## From Warning

Warning should be able to offer:

- View Cap Sheet,
- Open Trade Machine,
- Open Free Agency where relevant,
- Guide next steps,
- Compare posture/history where useful.

## From Pinned Player

Pinned player should be able to offer:

- Open player,
- Trade,
- View Cap Sheet,
- View Roster,
- Compare impact,
- Guide next move.

## From History

History event should be able to offer:

- Compare event,
- Guide next move,
- route to affected rooms.

## From Compare

Compare should be able to offer:

- View source History event,
- View Cap Sheet/Roster current result,
- Guide next steps.

## From Guide

Guide should be able to offer:

- Open the correct room,
- preserve context,
- return to Compare/History/source room where useful.

---

## State / Context Payloads At UX Level

This document does not define TypeScript shapes. It defines the UX-level context that should be preserved.

| Context | Used by Compare | Used by Guide |
| --- | --- | --- |
| Team code | Scope comparison. | Scope recommendation. |
| World id | Committed scenario basis. | Scenario/problem basis. |
| Viewing season | Cap/season comparison. | Season-aware guidance. |
| World season | Multi-season warning. | Season-alignment guidance. |
| Player ids | Player delta/focus. | Player planning context. |
| Event id | Source event focus. | Event follow-up context. |
| Receipt kind | Move-specific comparison. | Next-step framing. |
| Warning type | Posture/problem comparison. | Problem objective. |
| Local draft flag | Local preview label. | Draft editing guidance. |
| Unavailable reason | Explain missing delta. | Explain limitation/route elsewhere. |

---

## Authority / Labeling Rules

Compare and Guide must use consistent labels.

| Context | Label |
| --- | --- |
| Saved event/result | `Committed` |
| No active world | `Sandbox` |
| Unapplied trade/work | `Local draft` |
| Write in progress | `Pending` |
| Failed write/validation | `Failed` |
| Dev-only path | `DEV preview` |
| Cannot derive safely | `Unavailable` |
| Not modeled yet | `Deferred` |
| Cross-season result | `Multi-season` |

---

## Empty / Unavailable States

### Compare Empty State

If no active world or no committed events exist:

> Comparison requires committed world activity. Make a move in an active world or open History to inspect existing events.

### Compare Unavailable State

If specific deltas cannot be derived:

> This comparison field is unavailable from the current event data.

### Guide Empty State

If Guide opens without context:

> Choose a player, warning, receipt, or event to guide a specific next step.

### Guide Unavailable State

If context is incomplete:

> Guide needs more context to make this actionable. Open Cap Sheet, Roster, History, or Trade Machine to inspect the source first.

---

## Non-Goals Across Both Rooms

- Do not execute mutations.
- Do not invent missing deltas.
- Do not treat local draft context as committed result.
- Do not replace History as the source of committed events.
- Do not replace Cap Sheet as the source of cap inspection.
- Do not replace Trade Machine as the trade validation/apply surface.
- Do not replace Free Agency as the signing/offer-sheet surface.
- Do not replace Offseason as the season-advance surface.
- Do not treat Guide as an unconstrained chat panel divorced from cockpit state.

---

## Acceptance Checklist

- Compare launch points are defined.
- Guide launch points are defined.
- Compare authority labels are defined.
- Guide authority labels are defined.
- Receipt follow-through to Compare/Guide is defined.
- Warning follow-through to Compare/Guide is defined.
- Pinned-player follow-through to Compare/Guide is defined.
- History event follow-through to Compare/Guide is defined.
- Compare can route to History/Cap/Roster/Guide.
- Guide can route to Cap/Roster/Trade/FA/Offseason/History/Compare.
- Neither Compare nor Guide executes hidden mutations.
- Both rooms show unavailable/deferred instead of guessing.
- Multi-season context is labeled clearly.

---

## Open Questions

1. Should Guide objectives persist in Activity Rail as an In Progress item?
2. Should Compare support player-specific deltas in the first implementation slice or only event/team-level deltas?
3. Should every receipt offer Guide, or only receipts with obvious follow-up decisions?
4. Should every warning offer Compare, or only warnings tied to a known committed event/change?
5. Should Guide recommendations appear in the Activity Rail, Guide room, or both?
6. Should local trade previews ever be allowed inside Compare, or should Compare stay committed-only for v1?
7. Should Guide support multiple pinned players as one objective, especially for “Trade all pinned” workflows?
8. Should Compare be the default landing after a commit, or only an optional receipt link?

---

## Contract Phase Closure

This is the final UX contract in the Architect interconnectivity planning set.

Completed contract set:

1. `ARCHITECT_UX_INTERCONNECTIVITY_MAP.md`
2. `ARCHITECT_UX_INTERCONNECTIVITY_SLICES.md`
3. `ARCHITECT_ACTIVITY_RAIL_CONTRACT.md`
4. `ARCHITECT_PLAYER_ACTION_MENU_CONTRACT.md`
5. `ARCHITECT_TRADE_OVERLAY_ENTRY_CONTRACT.md`
6. `ARCHITECT_HISTORY_OUTBOUND_LINK_CONTRACT.md`
7. `ARCHITECT_COMPARE_GUIDE_FOLLOW_THROUGH_CONTRACT.md`

Do not add more broad UX contracts before implementation.

Next artifact:

`ARCHITECT_IMPLEMENTATION_SLICE_01_ACTIVITY_RAIL_PLAYER_ACTIONS.md`

That implementation slice should convert the contracts into the first buildable agent prompt/spec, focused on:

- Activity Rail minimum contract compliance,
- Player Action Menu minimums,
- pinned player open/trade/unpin,
- Trade overlay entry from pinned players,
- local-vs-committed rail labeling,
- receipt/changed-player highlight basics,
- no new mutation authority.
