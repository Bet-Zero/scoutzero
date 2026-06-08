# Architect Trade Overlay Entry Contract

**Status:** Product / UX contract  
**Branch:** `feature/architect-cockpit-intelligence`  
**Date:** 2026-06-03  
**Parent map:** `ARCHITECT_UX_INTERCONNECTIVITY_MAP.md`  
**Parent slices:** `ARCHITECT_UX_INTERCONNECTIVITY_SLICES.md`  
**Related contracts:**  
- `ARCHITECT_ACTIVITY_RAIL_CONTRACT.md`  
- `ARCHITECT_PLAYER_ACTION_MENU_CONTRACT.md`  
**Slice:** Trade Overlay Entry Contract  
**Scope:** All user-facing ways the Trade Machine opens, resumes, receives context, preserves local draft state, and hands off after apply.  
**Non-scope:** Code implementation details, component edits, TypeScript shapes, mutation-pipeline changes, Firestore schema changes, or test-command planning.

---

## Purpose

The Trade Machine is the highest-risk workspace in Architect because it is large, stateful, multi-team, and mutation-capable.

This contract defines how Trade Machine should connect to the cockpit without becoming a squeezed Workbench room or a hidden mutation shortcut.

The core decision:

> Trade Machine stays overlay-first. It opens as a full-viewport workspace, preserves local draft state when closed, and only creates committed world truth when the user applies a valid trade through the existing Trade Machine flow.

---

## North Star

The user should be able to enter Trade Machine from anywhere it naturally makes sense:

- a pinned player,
- multiple pinned players,
- a roster player,
- a cap/apron warning,
- a TPE/exception opportunity,
- a History trade event,
- a receipt,
- a Guide recommendation,
- or the global Trade command.

But every entry must preserve the same truth boundary:

> Before apply, this is a local trade draft. After apply, it is committed world truth with a receipt/history event.

---

## Overlay Rules

| Rule | UX requirement |
| --- | --- |
| Full viewport | Trade Machine opens over the entire cockpit, including nav/activity rails. |
| Return context | Closing returns the user to the room they were in before opening. |
| Draft preservation | Closing does not clear the trade draft. |
| Local authority | Draft state is labeled local until applied. |
| Existing validation | Trade validation remains inside Trade Machine. |
| Apply authority | Trades are applied only through the existing Trade Machine apply flow. |
| Failed apply | Failed apply remains in Trade Machine and does not create a committed receipt. |
| Successful apply | Successful apply creates a receipt and routes user to inspect results. |

---

## Entry Points

### 1. Global Trade Command

**Source:** NavRail / global Trade button / top-level Trade command.

**Behavior:**

- Opens Trade overlay.
- If a meaningful draft exists, resumes it.
- If no meaningful draft exists, opens clean Trade Machine state.
- Does not stage players automatically.

**Acceptance:**

- User can open Trade Machine without selecting a player first.
- Existing local draft is not lost.

---

### 2. Pinned Player → Trade

**Source:** Activity Rail pinned player row.

**Behavior:**

- Opens Trade overlay.
- Stages or requests staging for that pinned player.
- Keeps draft labeled local until applied.
- Does not unpin the player automatically.

**Acceptance:**

- User can click Trade on one pinned player and land in Trade Machine with that player context carried in.
- Player remains pinned unless explicitly unpinned.

---

### 3. Trade All Pinned

**Source:** Activity Rail Pinned Players section.

**Behavior:**

- Opens Trade overlay.
- Stages or requests staging for all currently pinned players.
- If some pinned players cannot be staged, show conservative unavailable messaging.
- Does not auto-apply anything.

**Acceptance:**

- Multiple pinned players can be sent to Trade Machine as one local draft context.
- Missing/unresolvable players do not create fake trade rows.

---

### 4. Roster Player → Trade

**Source:** Roster player card/action menu.

**Behavior:**

- Opens Trade overlay.
- Carries player id/label/team context.
- Stages or requests staging for that player.
- Keeps Roster as return context when overlay closes.

**Acceptance:**

- User can start trade exploration from the visual roster.
- Normal roster click still opens/inspects player; trade remains explicit.

---

### 5. Cap Sheet Player → Trade

**Source:** Cap Sheet player row/action menu.

**Behavior:**

- Opens Trade overlay.
- Carries player id/label/contract/cap context where available.
- Stages or requests staging for that player.
- Keeps Cap Sheet as return context.

**Acceptance:**

- User can go from a contract/cap problem directly into trade exploration.
- Cap Sheet does not apply trade directly.

---

### 6. Cap / Tax / Apron Warning → Trade

**Source:** Activity Rail Watchlist, Cap Posture, Cap Sheet warning, Guide recommendation.

**Behavior:**

- Opens Trade overlay with an objective/context note such as:
  - solve cap issue,
  - reduce tax,
  - clear first apron posture,
  - clear second apron posture,
  - avoid/resolve hard-cap issue.
- Does not stage a player unless one is also explicitly selected/pinned.
- Keeps warning context visible or recoverable inside the draft experience.

**Acceptance:**

- User can enter Trade Machine to solve a cap/apron problem.
- The warning context does not imply any trade has been validated or applied.

---

### 7. Exception / TPE → Trade

**Source:** Cap Sheet exception/TPE area, Activity Rail posture/watchlist, Guide recommendation.

**Behavior:**

- Opens Trade overlay with use-exception/use-TPE context.
- Does not imply the TPE/exception is usable unless validation confirms it.
- Should route user toward trade construction, not directly consume exception.

**Acceptance:**

- User can begin trade exploration from an exception/TPE opportunity.
- The UI does not promise exception usage before validation.

---

### 8. History Trade Event → Trade

**Source:** History event detail or Scenario Activity entry.

**Behavior:**

- Opens Trade overlay with related committed-event context.
- Does not automatically recreate or clone the old trade unless the user explicitly chooses a future “build from this” action.
- Keeps History/event id available as context.

**Acceptance:**

- User can use History as a reference point for new trade exploration.
- No committed event is converted into a local draft without explicit user action.

---

### 9. Receipt → Trade

**Source:** Current Receipt section.

**Behavior:**

- If receipt is trade-related, can reopen related trade context or route to History/Compare.
- If receipt indicates a cap issue after another action, can offer “Open Trade Machine” as next step.
- Does not mutate from receipt directly.

**Acceptance:**

- Receipt can point the user back to trade context when useful.
- Receipt remains a post-commit bridge, not an action executor.

---

### 10. Guide Recommendation → Trade

**Source:** Guide room or Activity Rail Guide next-step card.

**Behavior:**

- Opens Trade overlay with the guide objective carried in.
- May carry player ids, warning type, team code, and world context.
- Does not auto-stage unsupported players or bypass validation.

**Acceptance:**

- Guide can route user into Trade Machine with useful context.
- Trade Machine remains the validation/apply owner.

---

## Local Draft Behavior

A trade draft is local until applied.

The user should be able to:

- open a draft,
- close overlay,
- see an In Progress card in Activity Rail if meaningful local work exists,
- resume the draft,
- clear/reset draft only through a safe explicit action,
- apply only through Trade Machine.

## Meaningful Draft Threshold

A draft should count as meaningful when at least one of these exists:

- staged player,
- staged pick/asset,
- selected second team/opponent,
- changed trade construction field,
- explicit objective context from warning/Guide/pinned player.

Simply opening Trade Machine with no edits should not necessarily clutter the rail.

---

## Post-Apply Behavior

### Successful Apply

After a successful trade apply:

- create/update Current Receipt,
- refresh/re-read committed scenario activity where supported,
- show affected team/player context,
- offer links to Cap Sheet, Roster, History, Compare, Guide,
- changed players should highlight on relevant rooms,
- local draft should no longer be presented as unapplied work unless Trade Machine intentionally preserves a new separate draft.

### Failed Apply

After a failed trade apply:

- keep user in Trade Machine,
- show failure in the trade surface,
- do not create committed receipt,
- do not add committed scenario activity,
- do not route user away automatically.

---

## Authority Labels

| State | Required label |
| --- | --- |
| Open draft | Local draft |
| Validation running | Pending / validating |
| Validation failed | Invalid / failed validation |
| Apply running | Pending commit |
| Apply failed | Failed, not committed |
| Apply success | Committed |
| History reference | Committed event reference |
| Guide objective | Planning context |

---

## Non-Goals

- Do not render Trade Machine as a normal Workbench room.
- Do not clear drafts on overlay close.
- Do not apply trades from Activity Rail, Roster, Cap Sheet, History, Receipt, Compare, or Guide.
- Do not treat staged players as committed changes.
- Do not clone History events into drafts without explicit user intent.
- Do not promise TPE/exception usage before validation.
- Do not hide failed validation by navigating away.
- Do not create fake receipt/event data from local draft state.

---

## Acceptance Checklist

- Trade opens from global command.
- Trade opens from one pinned player.
- Trade opens from Trade all pinned.
- Trade opens from Roster player action.
- Trade opens from Cap Sheet player action.
- Trade opens from cap/tax/apron warning context.
- Trade opens from TPE/exception context.
- Trade opens from History event context without auto-cloning.
- Trade opens from receipt/Guide context where relevant.
- Overlay close preserves draft.
- Meaningful draft appears as local In Progress work.
- Apply success creates committed receipt and inspection links.
- Apply failure creates no committed receipt/event.
- Local/committed labels stay distinct.

---

## Open Questions

1. Should “Trade all pinned” require confirmation above a certain player count?
2. Should warning-context entry show a banner inside Trade Machine or only appear in Activity Rail?
3. Should user be able to clear a trade draft from Activity Rail, or only inside Trade Machine?
4. Should History eventually support “Build similar trade” as an explicit future action?
5. Should a draft with only objective context but no player/team edits appear in Activity Rail?

---

## Next Step

After this contract, the remaining UX contracts are:

1. `ARCHITECT_HISTORY_OUTBOUND_LINK_CONTRACT.md`
2. `ARCHITECT_COMPARE_GUIDE_FOLLOW_THROUGH_CONTRACT.md`

After those are complete, stop writing contracts and create the first implementation prompt for the Activity Rail + Player Action + Trade Entry minimum slice.
