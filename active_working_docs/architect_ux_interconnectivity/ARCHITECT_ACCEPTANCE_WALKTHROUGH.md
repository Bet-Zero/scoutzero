# Architect Interconnectivity — Simple Manual Test Walkthrough

Follow these in order. For each step: **do the action**, then **check** what you should see, then move to the next. If a check fails, jot down the step number.

You do not need to do anything technical except the one start command in Setup.

---

## Setup (do once)

**Step 0a — Start the app.**
In the project terminal, type this and press Enter:

```
npm run dev
```

Wait until you see a line containing `http://localhost:5173`.
**Check:** that line appeared with no big red error.

**Step 0b — Open it.**
Open `http://localhost:5173` in your browser (Chrome is fine).
**Check:** the app loads.

**Step 0c — Open a team's GM Dashboard.**
Go into the GM area and pick a team (the cockpit screen).
**Check:** you see three zones — a **left** menu strip (Roster, Cap Sheet, Trade, etc.), a **middle** work area, and a **right-side panel** (this is the "Activity rail" — Cap Posture, Current Receipt, Pinned Players, Watchlist, World Events).

**Step 0d — Select a world.**
Near the top, use the world selector to pick or create a world.
**Check:** it shows an active world (not "Sandbox"). Several checks below need this.

> Quick vocabulary: "the rail" = the right-side panel. "⋯ menu" = the small three-dots button on a player. "Receipt" = the little summary box that appears in the rail after you commit an action.

---

## A. Right-side rail basics

**Step A1.** Look at the right-side panel.
**Check:** you see labeled sections (at least Cap Posture, Watchlist, World Events).

**Step A2.** Click the `»` button at the top of the right panel.
**Check:** the panel shrinks to a thin strip. Click `«` to expand it back.

---

## B. The player menu (the main new feature)

**Step B1.** Go to **Roster** (left menu). Click a player card.
**Check:** a contract editor pops up. Close it.
**Check:** that player did **not** get added to "Pinned Players" on the right. (Clicking only opens — it never pins.)

**Step B2.** On a player, find the small **⋯** button (hover the card/row if it's hidden) and click it.
**Check:** a small menu opens with options like Pin, Trade, View on Cap Sheet, and more.

**Step B3.** Click **Pin**.
**Check:** that player now shows under **Pinned Players** in the right rail.

**Step B4.** Open the **⋯** menu again → **View on Cap Sheet**.
**Check:** the app switches to the Cap Sheet screen and that player's row is highlighted.

**Step B5.** On the Cap Sheet, open a player's **⋯** menu → **Trade**.
**Check:** the Trade screen opens with that player already loaded in.

**Step B6.** Go to **Full Cap Table**. Hover a player row and click its **⋯**.
**Check:** you see Pin / Trade / navigation options **and** Waive / Extend / Stretch. Click **Waive**.
**Check:** the contract editor opens (these still work exactly as before).

**Step B7.** Go to **Free Agency**. On a free agent, open **⋯** → **Pin**.
**Check:** they appear in the right rail with a small **"Target"** badge next to their name.

---

## C. Pinned players & "Trade all"

**Step C1.** Pin **3 players** total (from any screens).
**Check:** all three are listed under Pinned Players.

**Step C2.** In Pinned Players, click **Trade all**.
**Check:** a confirmation pop-up asks whether to trade all 3. (This confirmation only appears when more than 2 are pinned.)

**Step C3.** Confirm it.
**Check:** the Trade screen opens with them staged.

**Step C4.** On one pinned row, open its menu → **Unpin**.
**Check:** it disappears from the rail and nothing else changes.

---

## D. Trade screen context & drafts

**Step D1.** Open **Trade** from the left menu with nothing staged.
**Check:** the trade screen is empty, and the right rail does **not** show an "In Progress" card.

**Step D2.** Stage a player (use a pinned player's Trade, or add one in the trade screen). Then close the trade screen (X or the Esc key).
**Check:** the right rail now shows an **In Progress** trade-draft card, marked as local / not committed.

**Step D3.** Click that In Progress card (or reopen Trade).
**Check:** your draft is exactly as you left it (nothing lost).

**Step D4.** In the rail **Watchlist**, if there's a cap/tax/apron warning, click its **Open Trade** link.
**Check:** the Trade screen opens with a banner at the top stating an objective (e.g. "Reduce luxury tax") and a **"Planning context"** tag — and **no** player was auto-added.

**Step D5.** Build and **apply a valid trade** (your normal apply button).
**Check:** the trade screen closes, a **"Committed"** receipt appears in the right rail, and the changed players are highlighted.

**Step D6 (optional).** Build a deliberately invalid trade and try to apply it.
**Check:** it stays on the trade screen and **no** receipt appears in the rail.

---

## E. Receipt follow-ups

**Step E1.** After your committed trade (D5), look at **Current Receipt** in the right rail.
**Check:** it has a "Committed" tag and buttons: **Compare move**, **Guide next steps**, and **Open Trade Machine**.

**Step E2.** Just below the receipt.
**Check:** each changed player is listed with its own **⋯** menu (View on Roster / Cap, etc.) — and none of them got auto-pinned.

---

## F. History

**Step F1.** Open **Team History** (left menu).

**Step F2.** Click a committed event (e.g. the trade you just made) to open its detail pop-up.

**Step F3.** Near the top of the pop-up.
**Check:** there's a **"Go to —"** row of buttons (View on Roster, View on Cap Sheet, Compare, Guide, and for a trade, **Open Trade context**).

**Step F4.** Click **Open Trade context**.
**Check:** the Trade screen opens with a banner saying it **references a committed event** — and it did **not** copy the old trade in.

**Step F5.** Back in an event's detail, find the **Players** list and click a player's **⋯** menu.
**Check:** the same player menu opens; picking an option navigates and closes the History pop-up.

**Step F6 (if you can find a draft-pick event).** Open it.
**Check:** instead of a link it plainly says **"Draft asset summary is not available yet."**

---

## G. Compare & Guide

**Step G1.** From a committed receipt in the rail, click **Compare move**.
**Check:** the Compare screen opens with a banner like "Comparing the latest committed move" and a **"Committed world"** tag.

**Step G2.** From the same receipt, click **Guide next steps**.
**Check:** the Guide screen opens with an **Objective** banner (e.g. "Decide the next move after this trade.").

**Step G3.** Cause a cap/apron warning (e.g. over the 2nd apron) so it shows in the Watchlist, then click its **Guide** link.
**Check:** Guide opens with the objective "Solve second-apron restrictions." and an **Open Trade** button. Click **Open Trade**.
**Check:** the trade screen opens with that objective banner.

**Step G4.** Open any player's **⋯** menu → **Compare impact**.
**Check:** Compare opens with a "Player-focused comparison" banner labeled **"Unavailable"** (player-level detail is intentionally turned off for now) — the committed team view still shows below it.

---

## Skip these (known not wired yet — don't worry if you can't find them)

- A button to open Trade specifically to "use a TPE / exception."
- Getting an "Event-derived" Compare from a History event's own Compare link — use a **player name** in the event instead.
- A dedicated "season advance → Compare (Multi-season)" button.

---

## Done

If every **Check** passed, the interconnectivity work is behaving as intended. Note any step numbers that failed and send them back.
