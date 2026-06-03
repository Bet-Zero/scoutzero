# Architect UX Interconnectivity Map

**Status:** Product / UX planning map  
**Branch:** `feature/architect-cockpit-intelligence`  
**Date:** 2026-06-02  
**Scope:** Front-end behavior, product flow, and cross-surface UX interconnectivity only.  
**Non-scope:** Code implementation details, mutation-pipeline changes, Firestore schema changes, or test execution planning.

---

## Purpose

This document captures the first-pass UX interconnectivity map for **The Architect**.

The goal is to make Architect feel less like a group of separate tabs and more like one continuous GM operating desk. The underlying world/mutation/interconnectivity systems already exist or are mostly in place. This map focuses on how the user should experience those connected systems from the front end.

The core product direction:

> I am running one team inside one world. I always know the world, season, date, cap posture, mode, and recent activity. I can pin players or targets and carry them across rooms. I can move from Roster to Cap to Trade to Free Agency to History to Compare to Guide without losing the player, action, or scenario context. Every committed action gives me a receipt. Every local draft is clearly local until applied. Every committed event is clearly committed world truth.

---

## Current Branch Baseline

The current branch has already moved beyond the older flat tab model.

Architect now has a cockpit-style shell with these major surfaces:

| Surface | UX role |
| --- | --- |
| `CockpitShell` | Full GM operating desk. |
| `TopBar` | Persistent identity, world, season, mode, and last receipt. |
| `NavRail` | Room navigation. |
| `Workbench` | Active room display. |
| `ActivityRail` | Right-side activity, receipts, pinned players, warnings, and local drafts. |
| `TradeOverlay` | Full-screen Trade Machine overlay that preserves draft state. |
| `TeamStatusStrip`, `ModePill`, `WorldMenu` | Persistent operating context and truth/mode presentation. |

The final UX should be built around this cockpit model, not around a classic tabbed page.

---

## Product Rule

Every Architect interaction should do one of five things:

1. **Set operating context** — team, world, season, selected room, selected player, current action thread.
2. **Inspect an object** — player, contract, exception, pick, offer sheet, trade, world event.
3. **Start or resume a local draft** — trade draft, FA target, offer sheet, offseason prep, guide objective.
4. **Commit through the existing owner** — trade apply, signing, waive, extend, option, renounce, offer sheet action, season advance.
5. **Navigate to the source of truth** — Cap Sheet, Roster, History, Trade Machine, Free Agency, Compare, or Guide.

Anything that does not fit one of those jobs should be questioned as possible dead UI.

---

## Persistent Cockpit State

### Workspace Context

The cockpit should always keep the user oriented.

Always visible or one click away:

| Signal | Desired UX |
| --- | --- |
| Active team | Top-left identity chip. |
| Active world/scenario | World menu chip. |
| World date | Visible in world menu/status. |
| Authoritative world season | Visible in world menu/season area. |
| Selected viewing season | Visible separately from world season. |
| Truth mode | Committed world / sandbox / local draft / pending / DEV-only. |
| Save/loading/error state | Always surfaced in cockpit chrome. |
| Roster count | Persistent posture signal. |
| Cap/tax/apron | Persistent posture signal. |
| Exceptions/TPE | Persistent posture signal. |
| Draft assets | Conservative summary or “see Trade/History.” |
| Recent committed moves | Activity Rail. |
| Current local drafts | Activity Rail. |

### Player Focus

Architect needs one player-continuity model.

There are three player states:

| State | Meaning | UX behavior |
| --- | --- | --- |
| **Focused player** | The player the user is inspecting or just acted on. | Highlight across Roster / Cap / Full Cap / History where present. |
| **Pinned players** | Explicit user watchlist. | Show in Activity Rail with actions. |
| **Changed players** | Produced by a committed action receipt. | Temporary highlight plus receipt links. |

Important rule: **pinning must be explicit.**

Clicking a player should inspect/open that player. Pinning should be a deliberate action from a player menu or pin button.

### Action Thread

The cockpit should preserve the user’s current work thread across room changes.

Examples:

| Action thread | Where it should live |
| --- | --- |
| Trade draft | Trade overlay plus Activity Rail “In Progress.” |
| Pinned player trade idea | Pinned Players board. |
| FA target list | Activity Rail / FA room. |
| Offer sheet pending action | FA room plus Activity Rail. |
| Season advance aftermath | Offseason plus receipt plus History. |
| Guide objective | Guide room plus Activity Rail. |
| Comparison target | Compare room plus receipt/event context. |

The user should not lose action context when switching rooms.

### Receipt / Event Context

After any committed action, the cockpit should show a persistent confirmation.

A receipt should answer:

| Question | Example |
| --- | --- |
| What happened? | “Trade applied.” |
| Who changed? | Players and teams. |
| What state changed? | Cap, roster, exception, picks, season. |
| Is it committed? | Committed-world chip. |
| Where can I inspect it? | Cap Sheet / Roster / History / Compare / Guide. |

---

## Final Shell Behavior

### TopBar

The TopBar is the operating identity layer.

Expected behavior:

| Area | Final behavior |
| --- | --- |
| Left | Architect logo / Exit to League / active team. |
| Center | Breathing space or compact high-priority warnings only. |
| Right | World menu, season selector, mode pill, last receipt. |
| Receipt click | Expands Activity Rail. |
| World menu | Deliberate world/date controls, not a casual dropdown. |
| Mode pill | Committed / sandbox / local / pending / DEV state. |

### NavRail

Final rooms:

| Room | Role |
| --- | --- |
| Roster | Visual team composition and player entry point. |
| Cap Sheet | Current/selected-season cap truth and contract actions. |
| Full Cap | Multi-year contract/cap view. |
| Free Agency | Targets, signings, offer sheets. |
| Offseason | World-season advancement. |
| History | Committed transaction/event truth. |
| Compare | What changed in this world/scenario. |
| Guide | Guided franchise questions and next-step workflows. |

**Trade Machine should stay an overlay, not a normal room.** It needs full viewport width and should preserve its draft when closed/reopened.

### Workbench

The Workbench is the active room body.

Rules:

| Rule | Reason |
| --- | --- |
| Active room swaps inside Workbench. | Keeps cockpit fixed. |
| Room body owns its own scroll. | Prevents page-level layout mess. |
| Room header should not duplicate TopBar context. | Avoids visual clutter. |
| Room-specific actions belong inside the room or Activity Rail. | Keeps shell clean. |

### ActivityRail

The Activity Rail should become the right-side operating memory.

Final sections:

| Section | Purpose |
| --- | --- |
| Cap Posture | Cap/tax/apron/hard-cap warning. |
| Current Receipt | Last committed action. |
| Pinned Players | Explicit player board. |
| In Progress | Local trade draft / FA target / guide objective. |
| Watchlist | Season mismatch, no exceptions, over-apron, roster count issue. |
| Scenario Activity | Recent committed events. |
| Next Steps | Compare move, guide next steps, view history. |

---

## Player Interconnectivity Map

A player should never feel trapped in one room.

### Universal Player Actions

Any player shown in Architect should eventually support this action family:

| Action | Meaning |
| --- | --- |
| **Open** | Inspect player / contract modal. |
| **Pin** | Add to persistent Activity Rail board. |
| **View on Roster** | Switch to Roster and highlight. |
| **View on Cap Sheet** | Switch to Cap Sheet and highlight. |
| **View in Full Cap** | Switch to Full Cap and highlight. |
| **Trade** | Open Trade overlay and stage player. |
| **Find in History** | Open History filtered/focused to player events. |
| **Compare impact** | Show player in Compare when relevant. |
| **Guide next move** | Add player to guided objective. |

Not every surface needs every action as a visible button. But the player action menu should feel consistent.

### Roster

Roster should be the visual team board, not a dead end.

| User action | Result |
| --- | --- |
| Click player card | Open player/contract modal. |
| Pin player | Add to Activity Rail. |
| Trade player | Pin/open Trade overlay staged with player. |
| View cap details | Jump to Cap Sheet with highlight. |
| After signing/trade | Changed player card highlights. |
| Multi-player trade | All affected players highlight where present. |

### Cap Sheet

Cap Sheet should be the main contract/action truth surface.

| User sees | Natural next UX |
| --- | --- |
| Player row | Open modal. |
| Player row menu | Pin, trade, view roster, view history. |
| Cap warning | Link to Trade / FA / Guide. |
| Exception/TPE | Link to Trade or FA target search. |
| Dead cap | Link to History event. |
| Recent receipt | Highlight changed rows. |
| Selected-year mismatch | Clearly label current-season authority. |

### Full Cap Table

Full Cap should be the multi-year planning room.

| User action | Result |
| --- | --- |
| Click player row | Open modal for correct year/context. |
| Hover/focus player | Same player highlighted across years. |
| View on Roster | Jump to roster and highlight. |
| View current cap | Jump to Cap Sheet. |
| Pin | Add to Activity Rail. |
| Future option/FA row | Route into existing modal/action owner. |
| Compare years | Explain contract/cap changes over time. |

Full Cap should not become a new action authority. It should route into existing modal/action owners.

### Trade Machine

Trade Machine should feel connected but still remain its own full-screen workspace.

| Entry point | Result |
| --- | --- |
| Activity Rail “Trade” on pinned player | Opens overlay and stages player. |
| “Trade all pinned” | Opens overlay with all pinned players staged. |
| Cap warning → Trade | Opens overlay with context note: “solve cap/tax/apron issue.” |
| TPE/exception → Trade | Opens overlay with relevant exception context. |
| History trade event → Trade | Opens overlay with “related prior trade” context, not auto-mutated. |
| Close overlay | Returns to previous room; draft survives. |
| Draft exists | Activity Rail shows “Trade draft — local until applied.” |
| Apply success | Receipt appears; rail refreshes; Cap/Roster/History links. |
| Apply failure | Failure stays in overlay; rail shows no committed event. |

### Free Agency

Free Agency should act like a target board plus signing surface.

| User action | Result |
| --- | --- |
| Click FA player | Open FA/player modal. |
| Pin FA target | Add to Activity Rail “Targets” or Pinned Players. |
| Compare to roster player | Route to Compare / Guide. |
| Sign player | Commit through existing signing owner. |
| Signing success | Receipt + Cap Sheet jump + Roster/Cap highlight. |
| Offer sheet created | Outgoing offer appears in FA and Activity Rail. |
| Incoming offer action required | Activity Rail watch item. |
| Match/decline/finalize | Receipt + History link. |

### History

History should become the committed-truth hub, not just a log.

| History object | Links out to |
| --- | --- |
| Trade event | Affected players, teams, Cap Sheet, Roster, Compare. |
| Signing event | Player, Cap Sheet, Roster, FA context. |
| Waive/stretch | Dead cap entry, player history. |
| Option decision | Full Cap / Cap Sheet. |
| Season advance | Offseason summary, new-season Cap Sheet. |
| Pick movement | Trade Machine / draft asset detail. |
| Offer sheet | FA offer sheet lifecycle. |

History events should answer: **what happened, who changed, where can I inspect the result, and what did it affect?**

### Compare

Compare should be the “what changed?” room.

| Source | Compare behavior |
| --- | --- |
| Current world | Compare committed scenario changes. |
| Last receipt | “Compare move” opens focused comparison. |
| Player focus | Show player-specific changes. |
| Team focus | Show roster/cap/asset deltas. |
| Multi-season world | Warn that comparison crosses seasons. |
| Missing authority | Say unavailable instead of inventing a diff. |

### Guide

Guide should be the “what should I do next?” room.

| Question | Guide should connect to |
| --- | --- |
| Can we duck the tax? | Cap Sheet, Trade Machine, Compare. |
| Can we sign this FA? | FA, Cap Sheet, exceptions. |
| What trade solves this? | Trade Machine, pinned players, cap posture. |
| What happens after season advance? | Offseason, Cap, Roster, History. |
| Which players should I move? | Roster, Cap, Trade, Compare. |

Guide should not execute hidden changes. It should route the user into existing rooms and action owners.

---

## Action Lifecycle Flows

### Flow A — Pinned Player to Trade

1. User pins one or more players from Roster / Cap / Full Cap / History.
2. Activity Rail shows them under **Pinned Players**.
3. User clicks **Trade** or **Trade all**.
4. Trade overlay opens full-screen.
5. Player(s) are staged into the draft.
6. Draft is marked **Local until applied**.
7. Closing overlay leaves an **In Progress: Trade draft** card.
8. Applying trade produces a committed receipt.
9. Receipt links to Cap Sheet, Roster, History, Compare, Guide.
10. Changed players highlight across rooms.

### Flow B — Free Agent Signing

1. User filters FA pool.
2. User pins/targets FA.
3. Activity Rail shows target.
4. User signs player.
5. On success, Cap Sheet opens or is offered as primary next step.
6. Receipt says what changed: player, team, contract, exception/cap method if known.
7. Roster and Cap Sheet highlight the signed player.
8. History receives committed event link.
9. Compare can show cap/roster impact.

### Flow C — Contract Action

1. User clicks player from Roster, Cap, or Full Cap.
2. Existing player/contract modal opens.
3. User waives, extends, options, renounces, etc.
4. Commit routes through existing authority.
5. Receipt appears.
6. Cap Sheet / Full Cap / Roster / History links appear.
7. Affected player highlights.
8. Activity Rail updates.

### Flow D — Offseason Advance

1. Season mismatch chip or Offseason room guides user to advance.
2. User runs world-backed season advance.
3. Summary appears.
4. Closing summary should not drop context.
5. Receipt persists in rail: season advanced, expired contracts, declined options, TPEs lapsed, MLE reset.
6. Cap Sheet opens in new season.
7. Roster shows post-advance roster.
8. History has event.
9. Compare can show pre/post season transition.

### Flow E — History Back to Action

1. User opens History.
2. User clicks an event.
3. Event detail opens.
4. Detail links to affected player(s), Cap Sheet, Roster, Compare.
5. If trade-related, it can open Trade overlay with context.
6. If signing-related, it can open player/contract modal.
7. If season-related, it can open Offseason or new-season Cap Sheet.

History should not be a dead end.

---

## Truth / Mode Language

The UX should use a small, consistent vocabulary.

| User-facing term | Meaning |
| --- | --- |
| **Committed World** | Saved world truth. |
| **Sandbox** | No active world / base exploration. |
| **Local Draft** | Not committed yet. |
| **Pending Commit** | Optimistic/persistence in progress. |
| **Failed / Rolled Back** | Attempted but not committed. |
| **DEV Preview** | Dev-only, never real world truth. |
| **Base Snapshot** | Read-only base data reference. |

Avoid showing internal words like `vacuum`, `baseLocalValidated`, or `worldOptimisticPreview` as primary user-facing labels.

Hard rule: **local drafts, vacuum overlays, and DEV previews must never visually merge with committed world events.**

---

## Room-to-Room Interconnectivity Table

| Source | Trigger | Destination | Expected result |
| --- | --- | --- | --- |
| TopBar world chip | Open world menu | World controls | Change/inspect world deliberately. |
| TopBar last receipt | Click | Activity Rail | Expands receipt/activity. |
| Activity Rail cap warning | Click | Cap Sheet | Opens relevant cap posture context. |
| Activity Rail season mismatch | Click | Offseason | Opens season alignment surface. |
| Activity Rail pinned player | Open | Player modal / current room highlight | Inspect player. |
| Activity Rail pinned player | Trade | Trade overlay | Stage player. |
| Activity Rail trade draft | Resume | Trade overlay | Restore draft. |
| Roster player | Click | Player/contract modal | Inspect/action through modal. |
| Roster player menu | View Cap | Cap Sheet | Highlight player row. |
| Roster player menu | Trade | Trade overlay | Stage player. |
| Cap Sheet player | Click | Player/contract modal | Inspect/action. |
| Cap Sheet cap warning | Trade | Trade overlay | Solve cap issue. |
| Cap Sheet exception/TPE | Use | Trade or FA | Route to use exception. |
| Full Cap player | View Roster | Roster | Highlight player. |
| Full Cap future cell | Action | Modal | Correct target-year context. |
| FA player | Sign | Cap/Roster/Receipt | Committed signing flow. |
| Offer sheet | Lifecycle action | FA/Receipt/History | Committed lifecycle flow. |
| Trade apply | Success | Receipt + Cap/Roster/History | Show result. |
| Trade apply | Failure | Trade overlay | Show failure, no committed event. |
| Offseason advance | Success | Receipt + Cap/History | Show new season aftermath. |
| History event | Click | Detail modal | Event truth. |
| History player | View Cap/Roster | Cap/Roster | Highlight affected player. |
| Receipt | Compare move | Compare | Event-derived delta. |
| Receipt | Guide next steps | Guide | Next action suggestions. |

---

## Product Decisions To Lock In

1. **Trade Machine stays overlay-first.** Do not squeeze it into the Workbench.
2. **Pinning is explicit.** Clicking a player opens/inspects; pinning is a separate menu/button action.
3. **Activity Rail is the operating memory.** Pinned players, receipts, local drafts, warnings, and scenario activity belong there.
4. **Receipt is the bridge after commits.** After every committed action, the receipt should tell the user what changed and where to inspect it.
5. **Player focus supports multiple players.** Trades and sign-and-trades often affect multiple players; highlight all affected players where present.
6. **History becomes bidirectional.** Every room can send the user to History, and History can send the user back to affected rooms/objects.
7. **Compare and Guide are follow-through rooms.** They should be reachable from receipts, warnings, and pinned objects.
8. **League view is later.** Stabilize the team cockpit first before making league view world-aware.

---

## Biggest Remaining UX Gaps

| Gap | Desired final behavior |
| --- | --- |
| History → object links | History event detail routes to affected players, cap rows, roster, compare. |
| FA targets in rail | FA candidates are pinnable/targetable like roster players. |
| Cap warning → action | Cap/tax/apron/TPE warnings route to Trade/FA/Guide. |
| Draft asset summary | Persistent asset summary waits for canonical authority before display. |
| World/scenario name | TopBar shows friendly world name, not just id fallback. |
| Multi-player focus | All affected trade players highlight. |
| Player Profile vs Contract Modal | Long-term, separate scouting/player profile from contract-action modal. |
| Guide objective persistence | Guide preserves target/team/problem across room changes. |
| No-world vocabulary | Standardize on “Sandbox” plus secondary truth labels. |
| Local vs committed activity rail | Rail clearly separates local drafts from committed events. |

---

## Suggested Next Planning Pass

The next pass should turn this map into scoped slices and acceptance criteria.

Recommended first slices:

1. **Activity Rail contract** — define exactly what belongs in receipts, pinned players, local drafts, warnings, and scenario activity.
2. **Player action menu contract** — define universal player actions and which surfaces expose which actions.
3. **Trade overlay entry contract** — define how pinned players, cap warnings, TPEs, and history events open/stage Trade Machine context.
4. **History outbound-link contract** — define how committed events route back to player/cap/roster/compare surfaces.
5. **Guide/Compare follow-through contract** — define when receipts and warnings should offer “Compare move” or “Guide next steps.”

Do not start with implementation details. First lock the UX contract, then convert it into code-safe slices.