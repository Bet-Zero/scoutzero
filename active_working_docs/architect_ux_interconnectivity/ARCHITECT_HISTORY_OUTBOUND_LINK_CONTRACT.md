# Architect History Outbound Link Contract

**Status:** Product / UX contract  
**Branch:** `feature/architect-cockpit-intelligence`  
**Date:** 2026-06-03  
**Parent map:** `docs/architect/ARCHITECT_UX_INTERCONNECTIVITY_MAP.md`  
**Parent slices:** `docs/architect/ARCHITECT_UX_INTERCONNECTIVITY_SLICES.md`  
**Related contracts:**  
- `docs/architect/ARCHITECT_ACTIVITY_RAIL_CONTRACT.md`  
- `docs/architect/ARCHITECT_PLAYER_ACTION_MENU_CONTRACT.md`  
- `docs/architect/ARCHITECT_TRADE_OVERLAY_ENTRY_CONTRACT.md`  
**Slice:** History Outbound Link Contract  
**Scope:** How committed History events route users back to affected players, teams, rooms, receipts, comparison, and guide context.  
**Non-scope:** Code implementation details, component edits, TypeScript shapes, Firestore schema changes, mutation-pipeline changes, event-schema rewrites, or test-command planning.

---

## Purpose

History is the committed-truth hub of Architect.

Today, History can show what happened. The final UX needs History to also answer:

- Who did this affect?
- Where can I inspect the current result?
- What room should I open next?
- Can I compare the move?
- Can I use this as context for the next decision?

This contract defines how History should route outward to the rest of the cockpit.

---

## North Star

History should not be a dead-end log.

A committed event should be a navigable object. When a user opens a History event, they should be able to move from the event to the affected surface without manually hunting through tabs/rooms.

The core rule:

> History remains committed truth. It can route outward, but it must not synthesize local drafts, invent missing player/asset state, or execute mutations.

---

## Authority Model

History entries are committed world events.

Outbound links from History can carry committed event context, but they must clearly distinguish:

| Context | Meaning | UX rule |
| --- | --- | --- |
| **Committed event** | Saved historical event from active world. | Safe to show as History truth. |
| **Current roster/cap result** | Current loaded team state after event and later changes. | Label as current result, not necessarily event snapshot. |
| **Event participant** | Player/team/asset referenced by event. | Link only if identity is resolvable. |
| **Unavailable target** | Event implies an object but current UI cannot resolve it. | Show unavailable/deferred; do not guess. |
| **Local draft from event** | A possible future draft inspired by a History event. | Must require explicit user action; not automatic. |

Hard rule:

> History can point to current surfaces, but it must not imply those surfaces are exact frozen snapshots of the event unless that snapshot authority exists.

---

## History Detail Should Answer

Each History event detail should try to answer:

1. What happened?
2. When did it happen?
3. Which team(s) changed?
4. Which player(s) changed?
5. Which contracts, cap rows, exceptions, picks, offer sheets, or seasons were affected where available?
6. What current surface can inspect the result?
7. What follow-up actions make sense?

---

## Event-Type Outbound Links

### Trade Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View affected player | Opens player context/action menu if resolvable. |
| View on Roster | Opens Roster and highlights affected players currently present. |
| View on Cap Sheet | Opens Cap Sheet and highlights affected player/contract rows where present. |
| View in Full Cap | Opens Full Cap and highlights affected players where present. |
| Compare trade | Opens Compare with event context. |
| Guide next move | Opens Guide with trade/team/player context. |
| Open Trade context | Opens Trade overlay with related-event context only. |

Rules:

- Do not auto-rebuild the old trade into a new local draft.
- A future “Build similar trade” action must be explicit.
- If players moved away from the active team, label that clearly.

---

### Signing / Re-Signing Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View player | Opens player/contract context. |
| View on Roster | Opens Roster and highlights player if currently present. |
| View on Cap Sheet | Opens Cap Sheet and highlights active contract/cap row. |
| View in Full Cap | Opens Full Cap and highlights contract years where present. |
| View FA context | Opens Free Agency if the event ties back to FA workflow. |
| Compare signing | Opens Compare with signing impact where available. |
| Guide next move | Opens Guide with team/player/cap context. |

Rules:

- Do not imply the player remains on roster if later moves removed them.
- If the player is no longer present, show event participant but do not fake current roster/cap rows.

---

### Sign-And-Trade Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View signed/traded player | Opens player context if resolvable. |
| View on Cap Sheet | Opens Cap Sheet and highlights affected rows where present. |
| View on Roster | Opens Roster and highlights current affected players where present. |
| Open Trade context | Opens Trade overlay with related-event context only. |
| Compare impact | Opens Compare with event context. |
| Guide next move | Opens Guide with sign-and-trade context. |

Rules:

- Treat as both signing-related and trade-related for navigation.
- Preserve committed-event label.
- Do not auto-stage the sign-and-trade in Trade Machine.

---

### Waive / Stretch Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View player | Opens player context if resolvable. |
| View Cap Sheet | Opens Cap Sheet and highlights dead-cap/waived-contract area if available. |
| View Full Cap | Opens Full Cap multi-year dead-cap impact where available. |
| Compare impact | Opens Compare with cap/roster impact. |
| Guide next move | Opens Guide with roster/cap cleanup context. |

Rules:

- Player may not be on current roster.
- Dead-cap rows should only be highlighted if the current surface can resolve them safely.
- Do not re-create waived players as active roster members.

---

### Extension Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View player | Opens player/contract context. |
| View Cap Sheet | Opens Cap Sheet and highlights contract row. |
| View Full Cap | Opens Full Cap and highlights future contract years. |
| Compare extension | Opens Compare with contract/cap impact. |
| Guide next move | Opens Guide with future cap/team-building context. |

Rules:

- Full Cap is usually the most useful destination for extension events.
- Current Cap Sheet may show less useful detail if extension impact starts in future years.

---

### Option Decision Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View player | Opens player/contract context. |
| View Cap Sheet | Opens Cap Sheet and highlights row/cap hold where present. |
| View Full Cap | Opens Full Cap and highlights affected year. |
| Compare decision | Opens Compare with roster/cap impact. |
| Guide next move | Opens Guide with option/FA/cap context. |

Rules:

- If a declined option caused free agency/cap hold behavior, show current result conservatively.
- Do not imply current-year active contract if only a cap hold remains.

---

### Renounce / Cap Hold Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View Cap Sheet | Opens Cap Sheet and highlights cap hold area if available. |
| View Full Cap | Opens Full Cap where relevant. |
| Compare impact | Opens Compare with cap-space impact. |
| Guide next move | Opens Guide with cap-space/free-agency context. |

Rules:

- Renounced players may not be active roster members.
- Cap Sheet link should prefer cap hold section over active roster row when applicable.

---

### Offer Sheet Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View Free Agency | Opens Free Agency offer-sheet lifecycle section. |
| View player | Opens player/FA context if resolvable. |
| View Cap Sheet | Opens Cap Sheet if offer-sheet result affected active cap state. |
| View Roster | Opens Roster if player is currently present. |
| Compare impact | Opens Compare when match/decline/finalize changed world state. |
| Guide next move | Opens Guide with offer-sheet context. |

Rules:

- Pending offer-sheet lifecycle should not be treated as a completed signing unless committed result says so.
- Incoming and outgoing offer-sheet roles should be clear.

---

### Season Advance Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View Offseason | Opens Offseason room with season-advance context. |
| View new-season Cap Sheet | Opens Cap Sheet in the advanced/current viewing season where supported. |
| View Roster | Opens Roster after advance. |
| Compare transition | Opens Compare with multi-season warning/context. |
| Guide next move | Opens Guide with offseason/new-season planning context. |

Rules:

- Season-advance History should distinguish old season, new world season, and selected viewing season.
- Compare must warn if impact crosses seasons.

---

### Draft Pick / Asset Movement Event

Expected outbound links:

| Link | Behavior |
| --- | --- |
| View History detail | Opens committed event detail. |
| View Trade context | Opens Trade overlay with related-event context only. |
| View asset summary | Opens asset view only when canonical asset summary exists. |
| Compare impact | Opens Compare only where event-derived asset summary is safe. |
| Guide next move | Opens Guide with asset/team-building context. |

Rules:

- Do not invent draft asset truth if the current UI has no canonical summary.
- If asset summary is unavailable, say unavailable/deferred.

---

## Source Surfaces Into History

History may be opened from:

| Source | Desired behavior |
| --- | --- |
| Activity Rail Scenario Activity | Opens History root or event detail. |
| Current Receipt | Opens committed event detail when event id exists. |
| Compare | Opens source event detail. |
| Guide | Opens referenced event context. |
| Player action menu | Opens player-related committed events when supported. |
| TopBar/last receipt | Expands rail or opens receipt/history context. |

---

## Destination Surfaces From History

History can route to:

- Roster,
- Cap Sheet,
- Full Cap,
- Trade Machine overlay,
- Free Agency,
- Offseason,
- Compare,
- Guide,
- player/contract modal or future player profile.

History should not directly execute mutations.

---

## Context Carried From History

| Context | Purpose |
| --- | --- |
| Event id | Reopen/highlight event detail. |
| Event type | Determines relevant outbound links. |
| Occurred at | User-facing time/reference context. |
| Team codes | Scope routing and changed-team labels. |
| Player ids/labels | Highlight/open affected players. |
| Asset ids/labels | Future asset routing when canonical summary exists. |
| Season/year | Route to correct season context or show mismatch. |
| Source room | Allows return/fallback behavior. |
| Authority label | Clarifies committed event vs current result. |

---

## Current Result vs Event Snapshot

History event detail is committed event truth.

Destination surfaces usually show the current loaded team/world result.

The UX should not imply that current Roster/Cap/Full Cap is the exact event-time snapshot unless event-time snapshot authority exists.

Recommended label patterns:

- `Committed event`
- `Current roster result`
- `Current cap sheet result`
- `Event participant no longer on active roster`
- `Current row unavailable`
- `Asset summary unavailable`

---

## Missing / Unresolvable Targets

When History cannot resolve an outbound target, it should show conservative messaging.

Examples:

| Case | Message pattern |
| --- | --- |
| Player id unavailable | `Player link unavailable for this event.` |
| Player no longer on active roster | `Player is not currently on this roster.` |
| Cap row unavailable | `Current cap row unavailable. View event details instead.` |
| Asset summary unavailable | `Draft asset summary is not available yet.` |
| Event id unavailable | `History detail link unavailable.` |

Do not create fake rows, fake players, or fake asset summaries.

---

## Interaction Patterns

### Timeline Row Click

Primary behavior:

- Opens event detail.

Optional future behavior:

- Shows compact quick actions if event type is obvious and links are safe.

### Event Detail Link Buttons

Event detail should expose the most useful outbound links.

Recommended maximum primary buttons: 3–5.

Example for trade:

- View Cap Sheet
- View Roster
- Compare Trade
- Open Trade Context
- Guide Next Steps

### Player Names Inside Event Detail

Player names can either:

- open a player action menu,
- open player context directly,
- or link to current surface if there is a clear best destination.

Recommendation: player action menu is safest long-term because player availability differs by event type.

---

## Non-Goals

- Do not make History execute trades, signings, waives, extensions, options, renounces, offer-sheet actions, or season advances.
- Do not synthesize local drafts from History events.
- Do not auto-clone a trade event into Trade Machine.
- Do not invent player links when identity is unavailable.
- Do not invent asset truth when draft asset summary is unavailable.
- Do not imply current roster/cap is an exact event-time snapshot unless that authority exists.
- Do not turn History into a full replacement for Compare.
- Do not show DEV/local/pending activity as committed History events.

---

## Acceptance Checklist

- History event detail exposes outbound links where event type supports them.
- Trade events can route to Roster, Cap Sheet, Compare, Guide, and Trade context without auto-cloning.
- Signing events can route to player, Roster, Cap Sheet, Free Agency, Compare, and Guide where relevant.
- Waive/stretch events can route to Cap Sheet dead-cap/current result where safely available.
- Extension/option events can route to Full Cap and Cap Sheet where relevant.
- Offer-sheet events can route to Free Agency lifecycle context.
- Season-advance events can route to Offseason, new-season Cap Sheet, Roster, Compare, and Guide.
- Draft/asset movement events do not invent unavailable asset summaries.
- History labels committed event vs current result clearly.
- Missing targets show unavailable/deferred messaging instead of fake links.
- History does not add mutation authority.

---

## Open Questions

1. Should event detail be a modal, side panel, or full room detail in the final product?
2. Should timeline rows expose quick links, or should all outbound links live inside event detail?
3. Should player names inside History open a player action menu or jump directly to a default destination?
4. Should History support player filtering from pinned players in the first implementation slice?
5. Should event detail show current result status next to each affected player?
6. Should History eventually support explicit “Build similar trade” from trade events?
7. Should season-advance events preserve the dismissed offseason summary as a retrievable detail?
8. Should History route to inactive/other teams when a player left the active team?
9. How should History represent assets before the canonical draft asset summary is ready?
10. Should receipt dismissal affect History event highlighting? Recommendation: no.

---

## Next Step

The final UX contract before implementation planning is:

`docs/architect/ARCHITECT_COMPARE_GUIDE_FOLLOW_THROUGH_CONTRACT.md`

After that document is created, stop writing UX contracts and create:

`docs/architect/ARCHITECT_IMPLEMENTATION_SLICE_01_ACTIVITY_RAIL_PLAYER_ACTIONS.md`

That implementation slice should use the completed contracts as guardrails and should focus only on the first buildable cut of Activity Rail + Player Actions + Trade Entry behavior.
