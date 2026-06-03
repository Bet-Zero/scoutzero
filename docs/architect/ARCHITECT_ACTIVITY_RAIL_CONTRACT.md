# Architect Activity Rail Contract

**Status:** Product / UX contract  
**Branch:** `feature/architect-cockpit-intelligence`  
**Date:** 2026-06-02  
**Parent map:** `docs/architect/ARCHITECT_UX_INTERCONNECTIVITY_MAP.md`  
**Parent slices:** `docs/architect/ARCHITECT_UX_INTERCONNECTIVITY_SLICES.md`  
**Slice:** Activity Rail Contract  
**Scope:** Right-side Activity Rail behavior, ordering, labels, cross-room links, state boundaries, empty states, and acceptance criteria.  
**Non-scope:** Code implementation details, component file edits, TypeScript shapes, Firestore schema changes, mutation-pipeline changes, or test-command planning.

---

## Purpose

The Activity Rail is the right-side operating memory of the Architect cockpit.

It should answer these user questions:

- What just happened?
- What am I watching?
- What is still local or in progress?
- What needs attention?
- What committed scenario activity recently occurred?
- Where should I go next?

The Activity Rail should make Architect feel like one continuous GM workspace instead of a set of separate rooms.

It should route the user to the correct surface. It should not become a second dashboard, a hidden mutation surface, or a place where local draft state is confused with committed world truth.

---

## Simple Definition

A rail is a sidebar.

Architect has two main rails:

| Rail | Location | Job |
| --- | --- | --- |
| **Nav Rail** | Left side | Where do I want to go? |
| **Activity Rail** | Right side | What am I working on, what just happened, and what needs attention? |

This document is about the **right-side Activity Rail**.

---

## North Star

The Activity Rail should feel like the GM desk’s working memory.

A user should be able to look at the rail and understand:

1. The team’s current operating posture.
2. The latest committed move.
3. The players or targets they intentionally pinned.
4. The local work they have not committed yet.
5. The warnings or mismatches they should care about.
6. The most recent committed world activity.
7. The next useful places to go.

---

## Authority Model

The Activity Rail can display several kinds of state. These must stay visually distinct.

| Authority | Meaning | Rail label |
| --- | --- | --- |
| **Committed World** | Saved world truth from committed actions/events. | `Committed` / `World event` |
| **Sandbox** | No active world / base exploration. | `Sandbox` |
| **Local Draft** | User work that has not been applied. | `Local draft` |
| **Pending Commit** | Optimistic/persistence in progress. | `Pending` |
| **Failed / Rolled Back** | Attempted but not committed. | `Failed` |
| **DEV Preview** | Development-only, not real world truth. | `DEV preview` |
| **Unavailable / Deferred** | Data not safely available yet. | `Unavailable` / `See [surface]` |

Hard rule:

> Local drafts, pending attempts, failed attempts, sandbox state, and DEV previews must never visually merge with committed world events.

---

## Rail Sections

Recommended section order:

1. **Cap Posture**
2. **Current Receipt**
3. **Pinned Players**
4. **In Progress**
5. **Watchlist**
6. **Scenario Activity**
7. **Next Steps**

This order prioritizes orientation first, then latest outcome, then user-selected objects, then unfinished work, then warnings, then history, then suggestions.

---

# 1. Cap Posture Section

## Goal

Give the user a compact picture of the team’s current cap/tax/apron/hard-cap posture from anywhere in the cockpit.

## User-Facing Behavior

The section should show a compact posture summary, such as:

- cap status,
- tax status,
- first apron status,
- second apron status,
- hard-cap status when known,
- exception/TPE availability when reliable,
- current selected viewing season basis.

The section should not attempt to show a full cap sheet.

## Link Behavior

| Trigger | Destination | Behavior |
| --- | --- | --- |
| Click cap/tax/apron posture | Cap Sheet | Opens Cap Sheet with cap posture context. |
| Click hard-cap warning | Cap Sheet or Trade Machine | Cap Sheet first if user needs explanation; Trade if user is trying to solve it. |
| Click exception/TPE summary | Cap Sheet | Opens exception/TPE detail area where available. |
| Click “use TPE” or equivalent future action | Trade Machine overlay | Opens Trade overlay with use-exception context, if such context is supported. |

## Empty / Unavailable State

If cap posture cannot be derived safely, show:

> Cap posture unavailable. View Cap Sheet for details.

Do not invent cap posture from incomplete data.

## Non-Goals

- Do not show full cap table details here.
- Do not let the rail directly change contracts, exceptions, or cap state.
- Do not summarize future-year hard-cap authority unless the source is explicit.
- Do not show exception/TPE availability if authority is unclear.

## Acceptance Criteria

- User can see cap/tax/apron posture from any room.
- User can navigate to Cap Sheet from posture warnings.
- Unavailable cap posture is labeled honestly.
- Section does not create new write/mutation behavior.

---

# 2. Current Receipt Section

## Goal

Show the most recent committed action and give the user clean next steps.

A receipt is not just a success toast. It is the bridge from “something committed” to “where do I inspect what changed?”

## Receipt Types

The rail should support receipts for committed actions including:

- trade applied,
- standard signing,
- re-signing,
- sign-and-trade,
- offer sheet stored/matched/declined/finalized,
- waive/stretch,
- extension,
- option decision,
- renounce rights/cap hold,
- manual cap entry where supported,
- season advance.

## User-Facing Receipt Content

Each receipt should show, where available:

| Field | Purpose |
| --- | --- |
| Authority chip | Shows committed-world status. |
| Headline | Plain-English action summary. |
| Affected teams | Team chips or compact labels. |
| Affected players | Player names/ids where available. |
| Event time | When the action occurred. |
| Event id/detail link | History entry target when available. |
| Key impact | Optional cap/apron/exception/season impact if safely derived. |
| Next links | Cap Sheet, Roster, History, Compare, Guide where relevant. |

## Required Receipt Links

| Link | Behavior |
| --- | --- |
| **View Cap Sheet** | Opens Cap Sheet and highlights affected rows where possible. |
| **View Roster** | Opens Roster and highlights affected players where present. |
| **View History** | Opens History, ideally to the committed event detail when event id exists. |
| **Compare move** | Opens Compare with event/receipt context where available. |
| **Guide next steps** | Opens Guide with receipt/team/player context where useful. |

## Dismiss Behavior

Dismissing a receipt should hide that current receipt from the rail until a new committed action appears or the scope changes in a way that resets receipt state.

Receipt dismissal should not delete committed History events.

## Empty State

If there is no current receipt:

> No recent committed actions.

## Non-Goals

- Do not use receipts as a replacement for History.
- Do not synthesize receipts from local draft state.
- Do not show a receipt for failed actions as if they committed.
- Do not allow receipt actions to directly mutate world state.
- Do not persist a separate receipt truth independent of committed action results.

## Acceptance Criteria

- Latest committed action appears in the rail.
- Receipt clearly labels committed-world authority.
- Receipt links to Cap Sheet, Roster, History, Compare, and Guide where relevant.
- Receipt can be dismissed without affecting committed history.
- Failed/local actions do not appear as committed receipts.

---

# 3. Pinned Players Section

## Goal

Give the user an explicit working board for players they care about.

Pinned players are intentional. They are not the same thing as clicked players, viewed players, or players affected by the latest receipt.

## User-Facing Behavior

Pinned player rows should show:

- player name/label,
- open action,
- trade action,
- unpin action.

When more than one player is pinned, show a group action:

- **Trade all**

## Pinning Rules

- Pinning is explicit.
- Clicking a player does not auto-pin them.
- Pinned players stay pinned until unpinned or until scope rules clear them.
- Pinned players can be highlighted across compatible rooms.
- Pinned players can carry into Trade Machine staging.

## Link Behavior

| Action | Destination | Behavior |
| --- | --- | --- |
| Open pinned player | Current/player inspection surface | Opens or focuses player context. |
| Trade pinned player | Trade Machine overlay | Opens Trade overlay with that player staged/requested. |
| Trade all pinned | Trade Machine overlay | Opens Trade overlay with all pinned players staged/requested. |
| Unpin | Rail only | Removes player from pinned board. No world/cap/roster mutation. |

## Empty State

If no players are pinned, either hide the section or show a compact empty state:

> No pinned players. Pin players from Roster, Cap Sheet, Free Agency, or History to keep them here.

Recommendation: hide the section by default unless onboarding/empty-state clarity is needed.

## Non-Goals

- Do not auto-pin players from receipts.
- Do not auto-pin players just because they are clicked.
- Do not unpin players when a trade draft closes unless user explicitly unpins.
- Do not let pinned-player actions bypass Trade Machine or contract modal ownership.
- Do not treat pinned players as committed world data.

## Acceptance Criteria

- User can see pinned players in the rail.
- User can open a pinned player.
- User can trade one pinned player.
- User can trade all pinned players when multiple are pinned.
- User can unpin a player without changing world state.
- Pinned players do not appear as committed events.

---

# 4. In Progress Section

## Goal

Show local work that has not yet been committed.

This section prevents users from losing track of drafts when they move between rooms.

## Supported In-Progress Items

Initial and future candidates:

| Item | Meaning |
| --- | --- |
| Trade draft | Trade Machine has local staged work that is not applied. |
| FA target list | User selected or targeted free agents but has not signed them. |
| Offer-sheet prep | Offer-sheet work exists but has not completed lifecycle. |
| Guide objective | User has an active planning objective. |
| Compare focus | User is reviewing a move/event/world delta. |

## User-Facing Behavior

Each in-progress item should show:

- item label,
- local/pending authority label,
- short explanation,
- resume/open action,
- optional clear action if the owning surface supports it safely.

Example:

> Trade draft · Local until applied. Click to resume.

## Link Behavior

| Item | Destination | Behavior |
| --- | --- | --- |
| Trade draft | Trade Machine overlay | Reopens draft exactly where left. |
| FA target list | Free Agency | Opens FA with selected targets preserved where supported. |
| Offer-sheet prep | Free Agency | Opens offer-sheet section. |
| Guide objective | Guide | Reopens objective. |
| Compare focus | Compare | Reopens focused comparison. |

## Empty State

If there is no local/in-progress work, hide the section.

## Non-Goals

- Do not show in-progress items as committed receipts.
- Do not show stale drafts that no longer exist.
- Do not clear local work unless the owning room/action supports it and the user explicitly chooses to clear.
- Do not invent local draft state just because a room was opened.

## Acceptance Criteria

- Trade draft appears as local until applied when meaningful draft work exists.
- Trade draft can be resumed from the rail.
- Closing Trade Machine does not erase draft state.
- Local work is visually separate from Current Receipt and Scenario Activity.
- Empty In Progress section does not clutter the rail.

---

# 5. Watchlist Section

## Goal

Surface important operating warnings without forcing the user to hunt through rooms.

The Watchlist should answer:

> What needs my attention right now?

## Watchlist Candidates

| Warning | Meaning | Destination |
| --- | --- | --- |
| Season mismatch | Selected viewing season differs from authoritative world season. | Offseason / season controls. |
| Over cap | Team is above salary cap. | Cap Sheet / Guide. |
| Over tax | Team is above luxury tax. | Cap Sheet / Guide. |
| At/above first apron | Team is restricted by first apron posture. | Cap Sheet / Trade / Guide. |
| Above second apron | Team is in severe apron restriction posture. | Cap Sheet / Trade / Guide. |
| Hard cap active | Team has active hard-cap restriction. | Cap Sheet / Trade. |
| No active exceptions | Team has no active exception tools. | Cap Sheet. |
| Offer sheet action required | Incoming/outgoing offer sheet requires lifecycle action. | Free Agency. |
| Roster count issue | Roster too full, too empty, or roster count unavailable. | Roster / Cap Sheet. |
| Draft asset unavailable | Draft summary cannot be safely shown. | Trade / History. |

## User-Facing Behavior

Watchlist items should be compact and action-oriented.

Each item should include:

- warning label,
- short explanation,
- authority/mode where relevant,
- destination action.

Examples:

- `Viewing 2026-27 — world is at 2025-26. Go to Offseason.`
- `Above 2nd Apron — trade/signing restrictions active. View Cap Sheet.`
- `Incoming offer sheet needs action. Open Free Agency.`

## Empty State

If there are no warnings, either hide the section or show:

> No active watch items.

Recommendation: hide the section unless the rail needs balance or onboarding.

## Non-Goals

- Do not show noisy low-priority facts as warnings.
- Do not warn without a useful destination.
- Do not duplicate full Cap Sheet or Offseason explanations.
- Do not treat unavailable data as a violation unless a source explicitly says so.

## Acceptance Criteria

- Season mismatch appears when viewing season differs from world season.
- Cap/tax/apron warnings appear when posture supports them.
- Offer-sheet action warnings route to Free Agency.
- Watchlist warnings have clear destinations.
- No warning should imply committed truth if the source is local/preview/unavailable.

---

# 6. Scenario Activity Section

## Goal

Show recent committed world events without requiring the user to open History.

Scenario Activity is the rail’s compact committed timeline.

## User-Facing Behavior

Each entry should show:

- committed/world-event authority,
- event type,
- event summary/headline,
- affected players/teams where available,
- event date/time where available,
- link to History root or event detail.

## Authority Rules

Scenario Activity must show committed world events only.

It must not include:

- local trade drafts,
- uncommitted FA targets,
- DEV previews,
- failed mutations,
- pending optimistic state unless explicitly labeled outside Scenario Activity.

## Link Behavior

| Action | Destination | Behavior |
| --- | --- | --- |
| Click event | History | Opens History, ideally event detail. |
| View all | History | Opens History root. |
| Event player link, future | Player/cap/roster | Routes through History outbound-link contract when supported. |

## Empty State

If no committed events exist:

> No committed world events yet.

If no world is active:

> Scenario activity requires an active world.

## Non-Goals

- Do not synthesize event entries from local drafts.
- Do not use Scenario Activity as a replacement for full History.
- Do not show base/sandbox events as committed world events.
- Do not bury local/pending/failed entries inside Scenario Activity.

## Acceptance Criteria

- Recent committed world events appear when available.
- No-world/sandbox state is labeled clearly.
- Clicking an event opens History or event detail when available.
- Local draft and DEV preview entries do not appear as committed scenario activity.

---

# 7. Next Steps Section

## Goal

Give the user useful follow-through actions based on current context.

This section should answer:

> What is the next useful thing I can do from here?

## Next-Step Candidates

| Context | Suggested next steps |
| --- | --- |
| Current receipt | Compare move, Guide next steps, View History. |
| Pinned player | Trade, View Cap Sheet, Guide next move. |
| Cap warning | Open Guide, Open Trade, View Cap Sheet. |
| Season mismatch | Open Offseason. |
| Trade draft | Resume Trade Machine. |
| No active world | Select/create world or continue sandbox. |
| No committed activity | Make a move or view Cap Sheet/Roster. |
| Compare unavailable item | View source room or Guide explanation. |

## User-Facing Behavior

Next Steps should be small and contextual, not a generic button dump.

Recommended maximum visible actions: 2–4.

Examples:

- `Compare move`
- `Guide next steps`
- `View History`
- `Open Trade Machine`
- `Go to Offseason`

## Empty State

If there is no useful next step, hide the section.

## Non-Goals

- Do not show generic links already covered by NavRail.
- Do not make suggestions that execute mutations directly.
- Do not suggest Compare/Guide when the context cannot be carried meaningfully.
- Do not overcrowd the rail with every possible destination.

## Acceptance Criteria

- Latest receipt can offer Compare and Guide where useful.
- Cap warnings can offer Guide or Cap Sheet/Trade destinations.
- Season mismatch can offer Offseason.
- Next Steps hides when no useful contextual action exists.
- Suggestions route to existing rooms/actions and do not mutate directly.

---

## Collapsed Rail Behavior

The Activity Rail may collapse to save horizontal space.

When collapsed, it should still indicate important state.

## Collapsed Indicators

| State | Collapsed behavior |
| --- | --- |
| Current receipt exists | Show receipt/new activity dot. |
| Watchlist danger exists | Show warning/danger dot. |
| Local draft exists | Show in-progress dot. |
| Pinned players exist | Optional pin/count indicator. |

## Expand Behavior

Clicking the collapsed rail should expand it.

If the user clicks a collapsed indicator, the expanded rail should reveal the relevant section in view where possible.

## Non-Goals

- Do not hide critical errors only in collapsed state.
- Do not make collapsed indicators ambiguous if multiple severe states exist.
- Do not force the rail open for every receipt unless the UX specifically chooses that pattern.

## Acceptance Criteria

- Rail can collapse without losing awareness of important activity.
- Receipt/watch/draft indicators are visible in collapsed state.
- Expanding rail returns to full section layout.

---

## Empty Rail State

If the rail has no receipt, no pinned players, no local work, no warnings, and no committed events, it should not feel broken.

Recommended empty state:

> Activity will appear here as you pin players, build trades, commit moves, or enter an active world.

Optional supporting links:

- Pin a player from Roster.
- Open Cap Sheet.
- Select a world.

Do not show fake activity.

---

## Cross-Room Navigation Rules

The Activity Rail can navigate the user. It should not mutate world state.

Allowed rail navigation:

| Rail action | Allowed destination |
| --- | --- |
| View Cap Sheet | Cap Sheet room. |
| View Roster | Roster room. |
| View Full Cap | Full Cap room. |
| Open Trade | Trade Machine overlay. |
| Open Free Agency | Free Agency room. |
| Open Offseason | Offseason room. |
| View History | History room or detail. |
| Compare move | Compare room. |
| Guide next steps | Guide room. |

Disallowed rail behavior:

- applying a trade,
- signing a player,
- waiving/extending/options/renouncing directly,
- matching/declining offer sheet directly,
- advancing season directly,
- writing to Firestore directly,
- modifying committed world state directly.

---

## Section Priority Rules

When space is tight, prioritize sections in this order:

1. Critical error / saving / pending commit state.
2. Current Receipt.
3. In Progress local draft.
4. Watchlist danger.
5. Pinned Players.
6. Cap Posture.
7. Scenario Activity.
8. Next Steps.

Rationale:

- Critical state and latest committed action matter most.
- Uncommitted work should be easy to resume.
- Warnings should not be buried.
- Pinned players are important but user-managed.
- Scenario Activity is useful but not as urgent as current work.

---

## Labeling Rules

Use short labels that match operator intent.

Recommended labels:

| Internal concept | User-facing label |
| --- | --- |
| world event | Committed |
| no world | Sandbox |
| local trade state | Local draft |
| optimistic/pending write | Pending |
| failed write | Failed |
| dev preview | DEV preview |
| unavailable canonical summary | Unavailable |
| selected season differs from world season | Season mismatch |

Avoid showing internal mode words as primary labels unless they are already established user-facing language.

---

## Failure / Error Behavior

Failures should be visible but not confused with committed activity.

| Failure type | Rail behavior |
| --- | --- |
| Failed trade apply | Keep user in Trade overlay; optional failed/pending item outside Scenario Activity. |
| Failed signing | Show failure near source; no committed receipt. |
| Failed rail event reload | Scenario Activity shows unable-to-load state, not fake empty state. |
| World metadata unavailable | Workspace/status area shows unavailable world state. |
| Cap posture derivation failure | Cap Posture says unavailable and links to Cap Sheet. |

Do not create committed receipts for failed actions.

---

## Relationship To Other Rooms

### Roster

The rail can:

- highlight pinned/changed players on Roster,
- navigate to Roster,
- open pinned player context,
- route trade actions into Trade overlay.

The rail should not mutate roster membership directly.

### Cap Sheet

The rail can:

- navigate to Cap Sheet,
- highlight changed/pinned player rows,
- point to cap/tax/apron/exception/TPE context,
- offer Guide/Trade next steps from warnings.

The rail should not modify cap sheet data directly.

### Full Cap

The rail can:

- navigate to Full Cap,
- highlight player context,
- route player planning to modal/Guide/Compare where relevant.

### Trade Machine

The rail can:

- open/resume Trade overlay,
- stage/request pinned players,
- show local trade draft as in-progress,
- show committed trade receipt after apply.

The rail should not apply a trade directly.

### Free Agency

The rail can:

- route to FA targets/offer sheets,
- show offer-sheet action-needed warnings,
- show signing receipt after commit.

The rail should not sign or finalize offer sheets directly.

### Offseason

The rail can:

- route season mismatch to Offseason,
- show season-advance receipt,
- link to new-season Cap Sheet/History.

The rail should not advance season directly.

### History

The rail can:

- show recent committed events,
- link to History root/detail,
- link receipt to committed event.

The rail should not replace full History.

### Compare

The rail can:

- offer Compare move after receipts,
- route warnings/receipts/pinned players to Compare when context is meaningful.

The rail should not invent comparison deltas.

### Guide

The rail can:

- offer Guide next steps from receipts, warnings, or pinned players.

The rail should not execute Guide recommendations directly.

---

## Minimum Ship-Ready Contract For First Implementation Slice

A first implementation slice should be considered complete when the Activity Rail has a clear contract for:

1. Current Receipt.
2. Pinned Players.
3. In Progress Trade Draft.
4. Watchlist warnings for cap posture and season mismatch.
5. Scenario Activity with committed-only authority.
6. Next-step links for receipt and warnings.
7. Collapsed-state indicators.
8. Empty states.
9. Local-vs-committed visual separation.

This does not mean every future warning, every FA target flow, or every History outbound link must ship in the first implementation slice.

---

## Acceptance Checklist

- Activity Rail is understood as the right-side operating memory.
- Rail sections have a defined order.
- Current Receipt behavior is defined.
- Pinned Players behavior is defined.
- In Progress local draft behavior is defined.
- Watchlist warning behavior is defined.
- Scenario Activity committed-only behavior is defined.
- Next Steps behavior is defined.
- Collapsed rail behavior is defined.
- Empty states are defined.
- Authority labels are defined.
- Rail navigation is allowed.
- Rail mutation authority is disallowed.
- Local drafts cannot appear as committed events.
- Failed actions cannot appear as committed receipts.
- DEV preview cannot appear as committed world truth.
- Compare/Guide links are contextual, not generic clutter.

---

## Open Questions

1. Should FA targets live in **Pinned Players**, a separate **Targets** section, or both?
2. Should Watchlist appear above or below Pinned Players in the final layout?
3. Should the rail auto-expand after a committed action or simply show a collapsed receipt indicator?
4. Should dismissed receipts stay dismissed after room changes, world changes, or page reloads?
5. Should a trade draft appear in In Progress as soon as Trade Machine opens, or only after meaningful draft content exists?
6. Should “Trade all pinned” require confirmation when more than two players are pinned?
7. Should Cap Posture sit at the very top even when there is a fresh receipt?
8. Should Scenario Activity always show, or hide when Current Receipt exists to reduce duplication?
9. Should Guide next-step suggestions appear inside the rail, inside the Guide room only, or both?
10. Should collapsed rail indicators show counts for pinned players and warnings?

---

## Recommended Next Step

After this contract is accepted, the next planning step should be:

`docs/architect/ARCHITECT_PLAYER_ACTION_MENU_CONTRACT.md`

However, if the Activity Rail contract feels sufficiently clear, it is also reasonable to pause contract writing and create the first implementation prompt for the Activity Rail slice.

Recommended choice:

1. Review and adjust this Activity Rail contract if needed.
2. Then create the Player Action Menu Contract before coding if the goal is to fully define cross-player behavior first.
3. Or begin an Activity Rail implementation slice if the goal is to make visible product progress immediately.
