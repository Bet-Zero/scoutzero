# Trade Machine Manual QA Test Plan

## Context

This is a step-by-step manual testing guide for you (the user) to verify all Trade Machine functionality by hand. Each scenario is designed to exercise a distinct feature area. Combined, they cover: trade construction, salary matching, validation, cap impact, TPEs, entitlements, sign-and-trade, multi-team trades, apron/hard-cap rules, FA exceptions, the preview/export modal, and edge cases.

---

## Scenario 1: Basic 2-Team Trade (Happy Path)

**Goal:** Confirm the core trade flow works end-to-end.

**Steps:**

1. Open the Trade Machine. One empty team slot should be pre-populated.
2. Select **Team A** (pick a team with multiple rostered players, e.g. Boston Celtics).
3. Click **Add Team**. Select **Team B** (e.g. Brooklyn Nets).
4. On Team A's card, go to the **Players** tab.
5. Find a mid-salary player (~$10-15M). Click the **"..."** menu on that player.
6. Select **"Trade to Brooklyn Nets"**. The player row should turn green and show trade arrows.
7. On Team B's card, find a player of similar salary. Click **"..."** → **"Trade to Boston Celtics"**.
8. Click **"Validate Trade"** in the top toolbar.

**Expected Results:**

- Before validation: salary tiles show **"Estimate"** amber badges; Apply Trade button is disabled.
- After validation: the **Trade Preview Modal** opens showing both teams' received players, cap impact deltas, and a green **"Trade Passed"** footer bar.
- Close the modal. The validation pill in the header shows **"Validated at HH:MM"** (green dot).
- The **Validation Details** panel (expand it) shows a green **"Trade is CBA Legal"** banner, per-team Matching In / Allowed values, and a green **Salary Matching** rule in the Rule Compliance grid.
- The **Apply Trade** button is now enabled.

---

## Scenario 2: Validation Staleness Guard

**Goal:** Confirm that modifying the trade after validation resets the validation state.

**Steps:**

1. Starting from a validated trade (Scenario 1 end state).
2. On Team A, click **"..."** on a different player and select **"Trade to Brooklyn Nets"** (add a second player).
3. Observe the validation pill and the Apply Trade button.

**Expected Results:**

- The validation pill reverts to **"Not validated"** (gray dot).
- The Apply Trade button becomes **disabled** again.
- Salary tiles revert to showing **"Estimate"** badges.
- You must click **Validate Trade** again before you can apply.

---

## Scenario 3: Illegal Trade (Salary Mismatch)

**Goal:** Verify that an unbalanced trade is correctly flagged.

**Steps:**

1. Reset the trade (click the **rotate/reset** icon in the toolbar).
2. Select two teams.
3. Trade a **high-salary star** ($30M+) from Team A to Team B.
4. Trade only a **minimum-salary player** (~$2M) from Team B to Team A.
5. Click **Validate Trade**.

**Expected Results:**

- The Preview Modal shows a red **"Trade Failed"** footer bar.
- Close the modal. The Validation Details panel shows a red **"Trade is NOT CBA Legal"** banner.
- A **"Why it fails"** red box lists the salary matching violation.
- The team receiving the star shows **"Over by [amount]"** in red.
- The **Salary Matching** rule in the Rule Compliance grid is **red** for that team.
- Apply Trade remains **disabled**.

---

## Scenario 4: Undo / Cancel Trade Actions

**Goal:** Confirm players can be removed from trades.

**Steps:**

1. From Scenario 3 (or any trade with assigned players).
2. On the player you traded, click **"..."** → **"Undo Trade"** (or **"Cancel Trade"**).
3. Observe the player row and the salary sections.

**Expected Results:**

- The player row returns to its default state (no green tint, no trade arrows).
- The **Outgoing Salary** section for that team updates (collapse/expand it to verify the player is no longer listed).
- The **Incoming Salary** section on the receiving team no longer lists that player.
- Validation state resets to **"Not validated"**.

---

## Scenario 5: Entitlements (Draft Picks) in a Trade

**Goal:** Test adding draft pick entitlements to a trade.

**Steps:**

1. Set up a 2-team trade (any two teams).
2. On Team A, click the **Picks** tab ("Draft Assets (Entitlements)").
3. You should see entitlements grouped by year. Click the **checkbox** on a 1st-round pick to include it.
4. The row should turn blue indicating it's selected.
5. Optionally trade a player alongside the pick to make the trade legal.
6. Click **Validate Trade**.

**Expected Results:**

- The selected entitlement row turns **blue** when checked.
- In the Preview Modal and Validation Details, the pick appears under **"Entitlements Received"** for Team B with the correct year, round, kind badge ("Own" / "Conditional" / "Swap Option"), and any protection text.
- The **Entitlements Traded** section on Team A's summary card lists the outgoing pick.
- If the pick is **encumbered**, an amber **AlertTriangle** icon appears on the row, and an **Entitlement Warning** may appear in the summary.

---

## Scenario 6: Stepien Rule Violation

**Goal:** Verify the Stepien Rule (can't trade 1st-round picks in consecutive years) is enforced.

**Steps:**

1. Set up a 2-team trade.
2. On Team A, go to the **Picks** tab.
3. Select **two 1st-round picks in consecutive years** (e.g. 2026 and 2027) to trade out.
4. Add enough salary to make the trade otherwise balanced.
5. Click **Validate Trade**.

**Expected Results:**

- The trade should fail validation.
- The **Stepien Rule** in the Rule Compliance grid should show **red** for Team A.
- The "Why it fails" section should mention the Stepien violation.
- If only one of the two picks is selected, the Stepien rule should show **green** (deselect one and re-validate to confirm).

---

## Scenario 7: Sign-and-Trade

**Goal:** Test the sign-and-trade flow for unsigned/free-agent players.

**Steps:**

1. Set up a 2-team trade.
2. On Team A, in the **Players** tab, find a player who is **unsigned** (no current salary — these are free agents or expiring players). Look for players without a salary figure.
3. Click **"..."** on that player → **"Sign-and-Trade"** should appear as a menu option.
4. Select **"Sign-and-Trade"**. Then select the destination team.
5. Trade a player back from Team B to balance salary.
6. Click **Validate Trade**.

**Expected Results:**

- The player row shows an **"S&T"** indicator instead of regular trade arrows.
- The **Sign-and-Trade** rule in the Rule Compliance grid should appear and show green (if valid) or red (if the S&T violates CBA rules).
- Only **one** S&T per team is allowed — if you try to S&T a second player on the same team, the menu option should not appear or should be blocked.
- In the Trade Summary, the S&T player should be listed with their signed salary.

---

## Scenario 8: TPE (Trade Player Exception) Usage

**Goal:** Test absorbing an incoming player into a Trade Player Exception.

**Steps:**

1. Set up a 2-team trade where Team A has **active TPEs** (check the **Exceptions** tab on Team A's card — look for green TPE cards with amounts and expiry dates).
2. Trade a player from Team B to Team A whose salary **fits within** one of Team A's TPEs.
3. On Team A's card, the incoming player section should show an **absorption mode selector**. Change it to **"TPE"**.
4. A **TPE selector dropdown** should appear. Select the appropriate TPE.
5. Do NOT send a player back from Team A (the TPE absorbs the salary instead of matching).
6. Click **Validate Trade**.

**Expected Results:**

- The incoming player shows a **purple "TPE" badge** if eligible.
- The TPE selector dropdown only enables TPEs whose amount is >= the player's salary. Smaller TPEs show **"Insufficient for player salary"** and are disabled.
- After validation, the **Trade Exception Analysis** section in Validation Details shows the TPE usage (yellow panel) listing the absorbed player.
- Salary matching shows **"N/A"** with a tooltip explaining TPE absorption skip.
- The trade should pass validation without Team A sending salary back.

---

## Scenario 9: 3-Team Trade with Entitlement Routing

**Goal:** Test multi-team trades and pick destination routing.

**Steps:**

1. Reset the trade. Add **3 teams** (click Add Team twice).
2. Select three different teams (e.g. LAL, BOS, MIA).
3. Trade Player X from Team A → Team B (via "..." menu → "Trade to Team B").
4. Trade Player Y from Team B → Team C.
5. Trade Player Z from Team C → Team A. (Create a circular trade.)
6. On Team A, go to the **Picks** tab. Select a draft pick entitlement.
7. A **"Send to:"** dropdown should appear below the selected entitlement row. Select the destination team.
8. Click **Validate Trade**.

**Expected Results:**

- The "Send to:" dropdown appears **only in 3+ team trades** (not in 2-team).
- If you select the entitlement but do NOT set a destination, the row turns **amber** with an amber "Send to:" label warning.
- Once a destination is set, the row turns **blue**.
- The Preview Modal shows the correct routing: each team's "Players Received" and "Entitlements Received" sections reflect who gets what from whom.
- The origin team logos appear on received player cards showing where each player came from.

---

## Scenario 10: Cap Impact and Apron Tile Behavior

**Goal:** Verify cap impact tiles update correctly and apron hard-cap indicators work.

**Steps:**

1. Set up a trade involving a team that is **near or above the first apron** (a big-spending team like Golden State, Phoenix, etc.).
2. Note the 4 cap impact tiles: **TOTAL CAP, CAP SPACE, 1ST APRON, 2ND APRON**.
3. Before validation, tiles should show estimated values with "Estimate" badges.
4. Click **Validate Trade**.
5. Check if any apron tiles show a **Lock icon**.

**Expected Results:**

- After validation, "Estimate" badges disappear and values use the validated snapshot.
- Negative values (over cap/apron) display in **red**; positive values in **green**.
- If a team is **hard-capped** (e.g. from prior FA exception usage), a **Lock icon** appears on the 1st or 2nd Apron tile.
- Hovering over the Lock shows a tooltip: **"Hard Capped at 1st Apron — [reason]"** or similar.
- In the Trade Summary, hard-capped teams show a **Hard Cap Ceiling breakdown** with the limiting ceiling marked with "←".

---

## Scenario 11: Trade Preview Modal and Export

**Goal:** Test the preview graphic and download functionality.

**Steps:**

1. Complete a valid trade and click **Validate Trade**.
2. The **Trade Preview Modal** should open automatically.
3. Review the modal contents: team cards, player headshots, salary info, entitlements, cap impact deltas.
4. Click the **"Download"** button.
5. Click the **backdrop** (dark area outside the modal) or the **X button** to close.

**Expected Results:**

- The modal renders a clean trade graphic at up to 1200px wide, scaled to fit your viewport.
- Each team card shows: team logo, received players with headshots/salary/years and origin team logo, received entitlements with year/round/kind/terms, and a cap impact delta.
- The footer shows green **"Trade Passed"** or red **"Trade Failed"**.
- A disclaimer about BYC/trade kicker/poison pill adjustments appears at the bottom.
- Clicking **Download** saves a **trade.png** file (2x resolution) to your downloads folder.
- Clicking backdrop or X closes the modal without side effects.

---

## Scenario 12: Validation Details — Rule Compliance Grid

**Goal:** Verify all 12 CBA rules render correctly in the compliance overview.

**Steps:**

1. From any validated trade, expand the **Validation Details** panel.
2. Open the **"Validation Results"** accordion.
3. Find the **"Rule Compliance Overview"** section (TradeLegalChecker).

**Expected Results:**

- A 3-column grid shows **12 rules** per team:
  - Salary Matching, Hard Cap, Stepien Rule
  - Sign-and-Trade, 2nd Apron Rules, Roster Count
  - Player Consent, Reacquisition, Salary Aggregation
  - Trade Exceptions, Cash Inclusion, Timing Restrictions
- Each rule is colored: **green** (pass), **red** (fail), or **gray** (N/A).
- Rules have detail text where applicable.
- The legend reads: "Compliant / Violation / Not Applicable".
- For a legal trade, all applicable rules should be green.

---

## Scenario 13: Add and Remove Team Slots

**Goal:** Test team slot management (up to 5 teams).

**Steps:**

1. Start fresh (reset trade).
2. One empty slot should be pre-populated. Select a team.
3. Click **Add Team** repeatedly until you have **5 team slots**.
4. Try to click **Add Team** again.
5. Click the **X button** on one of the team cards to remove it.
6. Verify you can add a team again after removing one.

**Expected Results:**

- You can add up to **5 team slots** total.
- After 5, the **Add Team** button should be disabled or hidden.
- Clicking X on a team card removes it and any players/picks associated with that team from the trade.
- After removing a team, you can add a new one again.
- If you remove a team that had players traded to/from it, those assignments should be cleaned up.

---

## Scenario 14: Development Tools — Salary Calculator

**Goal:** Test the sandbox salary calculator in the dev tools panel.

**Steps:**

1. Validate any trade, then expand **Validation Details** → **"Development Tools"** accordion.
2. Find the **Salary Calculator** section (marked with amber "Exploratory" tag).
3. Note the **Official Validator Result** box (blue) showing the authoritative allowable incoming.
4. In the **"Test Incoming Salary"** input field, enter a value **below** the allowable incoming.
5. Then enter a value **above** the allowable incoming.

**Expected Results:**

- The Official Validator Result box shows the validated allowable incoming amount and rule applied.
- Entering a value below the limit: green result — **"Test incoming salary passes salary matching check"**.
- Entering a value above the limit: red result — **"Exceeds allowable incoming by [amount]"**.
- If there's a mismatch between sandbox and validator, an amber warning appears noting which is authoritative.
- The sandbox section shows the full formula breakdown (outgoing salary, base, TPEs, min exception).

---

## Scenario 15: Apply Trade

**Goal:** Confirm the trade application flow and gating.

**Steps:**

1. Construct a **legal** 2-team trade and validate it.
2. Confirm the **Apply Trade** button is now enabled.
3. Click **Apply Trade**.

**Expected Results:**

- The trade is applied to the world state (rosters update, entitlements transfer).
- If there's an error, a toast appears: **"Failed to apply trade: [error]"**.
- If the validation is stale (you modified the trade after validating), clicking Apply should show a toast: **"Re-validate trade before applying."** and NOT apply.
- If the trade was illegal (e.g. forced), clicking Apply should show an alert: **"Cannot apply trade: [reason]"**.

---

## Quick Reference: Coverage Matrix

| Feature                                 | Scenarios |
| --------------------------------------- | --------- |
| Trade construction (add/remove players) | 1, 3, 4   |
| Validation flow                         | 1, 2, 3   |
| Salary matching                         | 1, 3, 14  |
| Entitlements / draft picks              | 5, 9      |
| Stepien rule                            | 6         |
| Sign-and-trade                          | 7         |
| TPE usage                               | 8         |
| Multi-team trades                       | 9         |
| Cap impact / apron / hard cap           | 10        |
| Preview modal / export                  | 11        |
| Rule compliance grid                    | 12        |
| Team slot management                    | 13        |
| Dev tools / salary calculator           | 14        |
| Apply trade gating                      | 2, 15     |
| Undo / cancel actions                   | 4         |
