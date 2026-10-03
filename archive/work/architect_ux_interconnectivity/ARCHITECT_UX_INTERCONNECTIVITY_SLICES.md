# Architect UX Interconnectivity Slices

**Status:** Product / UX planning slices  
**Branch:** `feature/architect-cockpit-intelligence`  
**Date:** 2026-06-02  
**Source map:** `ARCHITECT_UX_INTERCONNECTIVITY_MAP.md`  
**Scope:** Front-end behavior, UX contracts, cross-surface handoffs, and acceptance criteria.  
**Non-scope:** Code implementation details, TypeScript shapes, file edit instructions, Firestore schema changes, mutation-pipeline changes, or test-command planning.

---

## Purpose

This document converts the high-level Architect UX interconnectivity map into scoped, shippable UX slices.

The goal is to prevent random UI churn. Each slice should define what the final product should do from a user standpoint before any implementation prompt is written.

The guiding product model:

> Architect is one continuous GM operating desk. The user should keep team, world, season, player, action, local draft, receipt, and committed event context while moving between Roster, Cap Sheet, Full Cap, Trade Machine, Free Agency, Offseason, History, Compare, and Guide.

---

## Slice Order

Recommended sequence:

1. **Activity Rail Contract**
2. **Player Action Menu Contract**
3. **Trade Overlay Entry Contract**
4. **History Outbound Link Contract**
5. **Compare / Guide Follow-Through Contract**

Reasoning:

- The Activity Rail is the operating memory. It should be defined first because receipts, pinned players, warnings, local drafts, and next steps all flow through it.
- Player actions come second because player continuity is the main cross-room object model.
- Trade overlay entries come third because Trade Machine is the highest-risk workspace and already has special overlay behavior.
- History outbound links come fourth because History becomes the committed-truth hub after receipts and player focus are stable.
- Compare / Guide follow-through comes fifth because those rooms depend on the earlier context and receipt contracts.

---

# Slice 1 — Activity Rail Contract

## UX Goal

Make the Activity Rail the cockpit’s persistent operating memory.

The rail should tell the user:

- what just happened,
- what is pinned,
- what is still local/in progress,
- what needs attention,
- what committed events recently occurred,
- and what the next useful move is.

It should not become a mutation surface. It should route the user to existing rooms and existing action owners.

## User-Facing Behavior

The rail should be organized into predictable sections:

| Section | Behavior |
| --- | --- |
| **Cap Posture** | Shows compact cap/tax/apron/hard-cap posture. Clicking relevant warnings should route to the right room. |
| **Current Receipt** | Shows the most recent committed action. Includes clear committed-world language and direct links to inspect results. |
| **Pinned Players** | Shows explicitly pinned players. Supports open, unpin, trade one, and trade all. |
| **In Progress** | Shows local drafts such as Trade draft, FA target list, offer-sheet prep, or Guide objective. Clearly says local until applied. |
| **Watchlist** | Shows state warnings: season mismatch, over apron, no active exceptions, offer sheet action needed, roster count issues. |
| **Scenario Activity** | Shows recent committed world events only. Does not visually merge local drafts with committed events. |
| **Next Steps** | Offers context-aware links like Compare move, Guide next steps, View History, View Cap Sheet, View Roster. |

## Source Surfaces

The Activity Rail can receive context from:

- workspace context,
- latest post-action receipt,
- pinned player board,
- local trade draft state,
- free-agency selection/target state,
- offer-sheet lifecycle state,
- season mismatch state,
- committed world events,
- cap/tax/apron posture,
- Compare availability,
- Guide availability.

## Destination Surfaces

The rail should route to:

- Roster,
- Cap Sheet,
- Full Cap where relevant,
- Trade Machine overlay,
- Free Agency,
- Offseason,
- History,
- Compare,
- Guide.

## State / Context Carried Across

| Context | Carried behavior |
| --- | --- |
| Pinned player id(s) | Highlight/open across Roster, Cap Sheet, Full Cap, and Trade overlay. |
| Receipt player id(s) | Temporary changed-player highlight across destination surfaces. |
| Receipt event id | Opens History detail when supported. |
| Trade draft state | Survives overlay close/reopen and appears as local in-progress work. |
| Cap warning type | Routes to Cap Sheet, Trade, FA, or Guide with the warning preserved as context. |
| Season mismatch | Routes to Offseason with clear world-season/viewing-season framing. |
| Offer sheet action needed | Routes to Free Agency offer-sheet section. |
| Compare target | Opens Compare with move/event/world context. |
| Guide target | Opens Guide with current problem/player/team context. |

## Explicit Non-Goals

- Do not let the rail directly execute trades, signings, waives, extensions, option decisions, renounces, offer-sheet actions, or season advancement.
- Do not show local drafts as committed activity.
- Do not synthesize committed events from local state.
- Do not persist new receipt truth independent of existing committed action results.
- Do not turn the rail into a second full dashboard.
- Do not hide the difference between sandbox, local draft, pending commit, failed commit, and committed world truth.

## Acceptance Criteria

- The user can identify the latest committed action from the rail.
- The user can identify pinned players from the rail.
- The user can resume an in-progress trade draft from the rail.
- The user can distinguish local drafts from committed events.
- The user can navigate from receipt to Cap Sheet, Roster, History, Compare, and Guide where relevant.
- The user can navigate from cap/tax/apron/season warnings to the relevant room.
- The user can trade one pinned player or all pinned players from the rail.
- The user can unpin players without changing roster/cap/world state.
- The rail does not add mutation authority.
- The rail does not mix DEV preview, local draft, pending, failed, and committed states under one visual label.

## Open Questions

1. Should FA targets live under **Pinned Players**, under a separate **Targets** section, or both?
2. Should Watchlist warnings appear above or below Current Receipt?
3. Should a local trade draft appear even if no players are staged yet?
4. Should Compare/Guide links appear only after a receipt, or also from warnings and pinned players?
5. How long should a dismissed receipt stay dismissed when the user changes rooms, worlds, or teams?

---

# Slice 2 — Player Action Menu Contract

## UX Goal

Make player identity continuous across Architect.

Any player shown in the cockpit should be inspectable, pinnable, and navigable to the relevant source-of-truth surface without creating new mutation authority.

## User-Facing Behavior

Every player surface should follow the same product pattern:

- click or primary action opens/inspects the player,
- secondary actions expose cross-room navigation,
- pinning is explicit,
- trade entry is available where appropriate,
- committed action receipts can highlight changed players across rooms.

## Universal Player Actions

| Action | Behavior |
| --- | --- |
| **Open** | Opens player/contract inspection surface. |
| **Pin** | Adds player to Activity Rail. |
| **Unpin** | Removes player from Activity Rail. |
| **Trade** | Opens Trade Machine overlay with this player staged or requested for staging. |
| **View on Roster** | Opens Roster and highlights player if present. |
| **View on Cap Sheet** | Opens Cap Sheet and highlights player if present. |
| **View in Full Cap** | Opens Full Cap and highlights player if present. |
| **Find in History** | Opens player-relevant committed events when available. |
| **Compare impact** | Opens Compare with player/event context when available. |
| **Guide next move** | Opens Guide with player/team/problem context when available. |

## Source Surfaces

Player actions can start from:

- Roster player cards,
- Cap Sheet rows,
- Full Cap rows/cells,
- Trade Machine player cards,
- Free Agency player cards,
- History event detail player lines,
- Current Receipt changed-player lines,
- Activity Rail pinned players,
- Compare roster-delta entries,
- Guide recommendation entries.

## Destination Surfaces

Player actions can route to:

- player/contract modal,
- Roster,
- Cap Sheet,
- Full Cap,
- Trade Machine overlay,
- Free Agency,
- History,
- Compare,
- Guide.

## State / Context Carried Across

| Context | Carried behavior |
| --- | --- |
| Player id | Primary identity for highlight/navigation. |
| Player display label | Used in pins, receipts, and action menus. |
| Source room | Lets overlay/modal return user to prior context when closed. |
| Target year | Needed when player action starts from Full Cap future-year view. |
| Receipt event id | Allows changed-player links to point back to committed event. |
| Pin state | Player remains in Activity Rail until explicitly unpinned. |
| Multi-player set | Trade receipts and trade staging should support more than one player. |

## Explicit Non-Goals

- Do not auto-pin players when clicked.
- Do not add direct waive/extend/option/renounce buttons to Roster cards outside the existing modal/action owner.
- Do not make player focus persistent world data.
- Do not create a new player identity source independent of existing team/player data.
- Do not require every surface to expose every action visually at once.
- Do not make History/player links depend on local draft state.

## Acceptance Criteria

- Clicking a Roster player opens the existing inspection/action surface.
- A player can be pinned explicitly from player-facing surfaces.
- Pinned players appear in the Activity Rail.
- A pinned player can be opened from the Activity Rail.
- A pinned player can be sent to Trade Machine from the Activity Rail.
- A player can be navigated to Roster, Cap Sheet, and Full Cap where relevant.
- After a committed action, affected players can highlight across relevant rooms.
- Multi-player committed actions can highlight multiple players.
- Player actions do not bypass existing action owners.
- Player focus remains visual/session-level, not new committed world data.

## Open Questions

1. Should the default click on a player open the contract/action modal or a future player profile panel?
2. Should Free Agency players use the same pin board as roster players, or a separate target board?
3. Should player menu actions be identical across surfaces or surface-aware subsets?
4. Should the user be able to pin players from History event detail?
5. Should player focus survive page reload through the `?player=` URL param only for pinned players, or also for manual focus?

---

# Slice 3 — Trade Overlay Entry Contract

## UX Goal

Make Trade Machine feel connected to the cockpit while preserving it as a full-screen overlay with its own draft state.

Trade Machine should open from many sources, but it should not lose local draft state or become a hidden mutation shortcut.

## User-Facing Behavior

Trade Machine opens as a full-screen overlay.

Entry points:

| Source | Desired behavior |
| --- | --- |
| NavRail / Trade command | Open empty Trade overlay or resume existing draft. |
| Pinned player “Trade” | Open overlay and stage/request that player. |
| “Trade all pinned” | Open overlay and stage/request all pinned players. |
| Cap warning | Open overlay with context that the user is solving a cap/tax/apron issue. |
| TPE/exception | Open overlay with context that the user may use an exception/TPE. |
| History trade event | Open overlay with related-event context, not as a pre-committed clone. |
| Current receipt | Open related trade context when the receipt is trade-related. |
| In-progress draft card | Resume exactly where the draft was left. |

Close behavior:

- Closing the overlay returns the user to the prior cockpit room.
- Closing does not clear the draft.
- If the draft has meaningful local work, Activity Rail should show it under **In Progress**.

Apply behavior:

- Successful apply produces a committed receipt.
- Successful apply updates/refreshes committed activity.
- Failed apply stays in the overlay and produces no committed event.

## Source Surfaces

Trade overlay can be opened from:

- NavRail / global Trade command,
- Activity Rail pinned players,
- Activity Rail in-progress draft,
- Activity Rail cap warning,
- Cap Sheet warning or exception/TPE rows,
- Roster player action menu,
- Full Cap player action menu,
- History event detail,
- Current Receipt,
- Compare / Guide recommendations.

## Destination Surfaces

After trade activity, the user may be routed to:

- Trade overlay itself,
- Cap Sheet,
- Roster,
- History,
- Compare,
- Guide.

## State / Context Carried Across

| Context | Behavior |
| --- | --- |
| Prior room | Returned to when overlay closes. |
| Staged player ids | Used to seed/request player inclusion in the trade draft. |
| Pinned player ids | Can be staged individually or as a group. |
| Cap warning type | Preserved as trade objective context. |
| Exception/TPE context | Preserved as potential trade tool context. |
| Existing draft | Survives close/reopen. |
| Receipt event id | Links successful trade to History/Compare. |
| Changed player ids | Highlights affected players across rooms after commit. |

## Explicit Non-Goals

- Do not render Trade Machine as a squeezed Workbench room.
- Do not clear a local draft just because the overlay closes.
- Do not treat a local trade draft as committed activity.
- Do not apply a trade from Activity Rail without opening/confirming through Trade Machine.
- Do not auto-clone a History trade into a new draft unless the user explicitly chooses to build from it.
- Do not hide failed validation by navigating away too early.

## Acceptance Criteria

- Trade Machine can open from global navigation.
- Trade Machine can open from a pinned player.
- Trade Machine can open from “Trade all pinned.”
- Trade Machine can resume an existing draft from Activity Rail.
- Closing Trade Machine preserves draft state.
- An in-progress trade draft is labeled local until applied.
- Successful trade apply produces a committed receipt.
- Failed trade apply remains in Trade Machine and does not create committed activity.
- Receipt links let the user inspect the result on Cap Sheet, Roster, History, Compare, and Guide where relevant.
- Trade overlay does not become an alternate mutation authority.

## Open Questions

1. What should the overlay show when opened from a cap warning: a context banner, a preselected objective, or both?
2. Should “Trade all pinned” require confirmation if more than two players are pinned?
3. Should opening Trade from a History event offer “build similar trade” later, or only show context in the first version?
4. Should the Activity Rail show a trade draft if the draft is opened but no player/team has been changed?
5. Should there be a visible “clear draft” action in the Activity Rail, or only inside Trade Machine?

---

# Slice 4 — History Outbound Link Contract

## UX Goal

Make History bidirectional.

History should remain the committed-truth hub, but it should no longer be a dead end. A committed event should point the user back to the affected players, rooms, and consequences.

## User-Facing Behavior

History event detail should show:

- what happened,
- when it happened,
- which teams changed,
- which players changed,
- what assets/contracts/exceptions changed where available,
- where to inspect the current result.

Event detail should expose relevant outbound links.

| Event type | Useful outbound links |
| --- | --- |
| Trade | Roster, Cap Sheet, Trade overlay context, Compare. |
| Signing | Player, Cap Sheet, Roster, Free Agency context, Compare. |
| Sign-and-trade | Player, Cap Sheet, Roster, Trade overlay context, Compare. |
| Waive/stretch | Player, Cap Sheet dead cap, History detail, Compare. |
| Extension | Player, Cap Sheet, Full Cap, Compare. |
| Option decision | Player, Full Cap, Cap Sheet, Compare. |
| Renounce | Cap Sheet, Full Cap, Compare. |
| Offer sheet | Free Agency, player, History lifecycle. |
| Season advance | Offseason, new-season Cap Sheet, Roster, Compare. |
| Draft pick movement | Trade Machine context, History detail, asset view when available. |

## Source Surfaces

History outbound links start from:

- History timeline row,
- History detail modal,
- Activity Rail scenario activity entry,
- Current Receipt “View in History,”
- Compare event-derived entries.

## Destination Surfaces

History can route to:

- Roster,
- Cap Sheet,
- Full Cap,
- Trade Machine overlay,
- Free Agency,
- Offseason,
- Compare,
- Guide,
- player/contract modal.

## State / Context Carried Across

| Context | Behavior |
| --- | --- |
| Event id | Opens or highlights the committed event. |
| Player ids | Highlight affected players in Roster/Cap/Full Cap. |
| Team codes | Route/label changed teams. |
| Event type | Determines relevant outbound links. |
| Season/date | Helps open the correct viewing season or explain mismatch. |
| Asset/pick ids | Future asset-detail routing when canonical summary exists. |

## Explicit Non-Goals

- Do not reconstruct uncommitted drafts from History.
- Do not invent current asset truth from partial event details.
- Do not make History responsible for mutation execution.
- Do not require History to know every possible future destination before first slice ships.
- Do not treat local audit/debug events as committed History links.

## Acceptance Criteria

- A History event can link to affected player(s) where player ids are available.
- A History event can route to Cap Sheet when the event affects cap/contract state.
- A History event can route to Roster when the event affects roster membership.
- A trade-related History event can open Trade overlay with related context without auto-applying anything.
- A season-advance event can route to Offseason and/or the new-season Cap Sheet.
- History links preserve authority language: committed event, current result, or unavailable.
- If a link target cannot be resolved, the UI says unavailable instead of guessing.

## Open Questions

1. Should History event detail open as a modal, side panel, or full room detail in the final product?
2. Should clicking a player name inside History open the player modal or a player action menu?
3. Should History support filtering by pinned player?
4. Should History links open the exact event first, then let the user navigate out, or should outbound links be visible directly in the timeline row?
5. How should History handle players no longer on the active team after a trade?

---

# Slice 5 — Compare / Guide Follow-Through Contract

## UX Goal

Make Compare and Guide feel like natural next-step rooms, not isolated expert panels.

Compare answers “what changed?”  
Guide answers “what should I do next?”

Both should be reachable from receipts, warnings, pinned players, and relevant room states.

## User-Facing Behavior

### Compare

Compare should open with meaningful context when launched from:

| Source | Compare context |
| --- | --- |
| Current world | Overall committed scenario changes. |
| Current receipt | The move/action that just changed. |
| Pinned player | Player-specific scenario impact where available. |
| Cap warning | Cap/tax/apron posture delta where available. |
| History event | Event-derived change summary. |
| Season advance | Multi-season transition warning and summary. |

Compare should clearly label authority:

- committed-world,
- event-derived,
- snapshot-derived,
- unavailable/deferred.

### Guide

Guide should open with a concrete problem or objective when launched from:

| Source | Guide objective |
| --- | --- |
| Cap warning | Solve cap/tax/apron issue. |
| Pinned player | Explore trade/contract/free-agency options involving player. |
| Receipt | Decide next move after committed action. |
| FA target | Determine signing path. |
| Season mismatch | Align world/viewing season or advance. |
| Compare result | Explain recommended next step based on change. |

Guide should route users into existing rooms. It should not secretly execute actions.

## Source Surfaces

Compare/Guide can be launched from:

- Activity Rail receipt,
- Activity Rail watchlist warning,
- Activity Rail pinned players,
- Cap Sheet warnings,
- Roster player menu,
- Free Agency target cards,
- Trade overlay result/failure states,
- History event detail,
- Compare unavailable/deferred entries,
- Guide recommendations.

## Destination Surfaces

Compare/Guide should route to:

- Roster,
- Cap Sheet,
- Full Cap,
- Trade Machine overlay,
- Free Agency,
- Offseason,
- History.

## State / Context Carried Across

| Context | Behavior |
| --- | --- |
| World id | Required for committed scenario comparison. |
| Team code | Scope for Compare/Guide. |
| Receipt id/event id | Focuses Compare and Guide after committed actions. |
| Player ids | Enables player-specific comparison/guidance. |
| Cap warning type | Focuses Guide on cap/tax/apron solution. |
| Season mismatch | Focuses Guide on season alignment. |
| Pinned player set | Lets Guide suggest trade/contract direction around user-selected players. |
| Unavailable reason | Lets Guide explain what data is missing or deferred. |

## Explicit Non-Goals

- Do not let Guide execute hidden mutations.
- Do not let Compare invent deltas where authority is unclear.
- Do not imply a local draft is a committed comparison.
- Do not make Guide responsible for validating actions outside existing validators.
- Do not make Compare a replacement for History.
- Do not show broad league/world comparison as complete until authority is defined.

## Acceptance Criteria

- Current receipt can offer “Compare move.”
- Current receipt can offer “Guide next steps.”
- Cap/tax/apron warnings can route to Guide with a clear objective.
- Pinned players can route to Guide as explicit user-selected context.
- History events can route to Compare with event-derived context.
- Compare shows authority labels for displayed values.
- Compare says unavailable/deferred when it cannot safely show a delta.
- Guide routes the user to existing rooms/actions instead of executing directly.
- Guide preserves the problem context while the user moves between rooms.

## Open Questions

1. Should Guide objectives be session-only or persisted per world?
2. Should Compare support player-level focus in the first slice or only team-level/event-level focus?
3. Should “Guide next steps” appear for every receipt or only receipts with actionable consequences?
4. Should Guide recommendations appear in the Activity Rail, the Guide room, or both?
5. Should Compare become the default destination after every committed action, or only an optional link?

---

## Cross-Slice Rules

These rules apply to every slice.

1. **No new mutation authority from planning alone.**
   UX interconnectivity should route to existing action owners.

2. **Local and committed states must stay visually distinct.**
   Local drafts, pending commits, failed commits, DEV previews, and committed world events need different labels.

3. **Pinning is explicit.**
   Clicking a player opens/inspects; pinning is deliberate.

4. **Receipts are post-commit bridges.**
   They explain what changed and where to inspect the result.

5. **History is committed truth.**
   It can route outward, but it should not synthesize local drafts.

6. **Trade Machine is overlay-first.**
   It should preserve draft state and use the full viewport.

7. **Compare is authority-labeled.**
   It should show unavailable/deferred instead of guessing.

8. **Guide suggests and routes.**
   It should not silently mutate state.

9. **World/viewing season distinction remains visible.**
   Selected viewing season must not imply authoritative world season.

10. **League view is deferred.**
    Stabilize the team cockpit first.

---

## Recommended Next Implementation Planning Step

After this slices doc is accepted, the next planning artifact should be:

`ARCHITECT_ACTIVITY_RAIL_CONTRACT.md`

That doc should fully specify Slice 1 before any implementation begins.

It should include:

- exact Activity Rail sections,
- ordering and collapsed behavior,
- receipt behavior,
- pinned player behavior,
- in-progress draft behavior,
- watchlist behavior,
- scenario activity authority rules,
- next-step link rules,
- empty states,
- authority labels,
- acceptance criteria.

Only after that contract is locked should an implementation prompt be written for the Activity Rail slice.
