# Trade Machine — Scenario Suite V1

**Created:** 2026-02-14  
**Purpose:** Human-runnable QA checklist for trade machine PASS validation  
**Usage:** Run before shipping major changes or periodically on main branch

---

## How to Use This Suite

1. Start the dev server: `npm run dev`
2. Navigate to GM Tools → Trade Machine
3. Execute each scenario in order
4. Mark PASS/FAIL for each
5. If any scenario fails, stop and document in TM_AUDIT_WORKBOOK.md

**Pass Criteria:** All scenarios must PASS for release approval.

---

## A) Salary Matching

### Scenario A1: Simple Legal 1-for-1

**Objective:** Verify basic salary matching works for a straightforward trade.

| Step | Action                                                            |
| ---- | ----------------------------------------------------------------- |
| 1    | Select any two teams                                              |
| 2    | Add one player from Team A (salary ~$10M)                         |
| 3    | Add one player from Team B with similar salary (within 125%+100K) |
| 4    | Click Validate                                                    |

**Expected Results:**

- [ ] Trade shows "✅ Trade is CBA Legal"
- [ ] Allowable incoming shows >= incoming salary for both teams
- [ ] No failure messages in "Why it fails" section

**Common Failure Signals:**

- Trade marked illegal despite salaries matching
- Allowable incoming < actual incoming (calculation bug)
- "NaN" or "$undefined" displayed anywhere

---

### Scenario A2: Illegal Salary Matching (Over Allowable)

**Objective:** Verify illegal trades are correctly flagged.

| Step | Action                                                                                       |
| ---- | -------------------------------------------------------------------------------------------- |
| 1    | Select two over-cap teams                                                                    |
| 2    | From Team A, add a player with salary ~$5M                                                   |
| 3    | From Team B, add a player with salary ~$20M (significantly exceeds 125%+100K of $5M = $6.35M |
| 4    | Click Validate                                                                               |

**Expected Results:**

- [ ] Trade shows "❌ Trade is NOT CBA Legal"
- [ ] Failure message lists salary matching violation
- [ ] Failure message shows: incoming ($X) > allowable ($Y)
- [ ] Allowable incoming correctly reflects 125%+100K ceiling

**Common Failure Signals:**

- Trade incorrectly passes as legal
- Missing or vague failure reason
- Allowable incoming shows inflated value

---

### Scenario A3: Under-Cap (Cap Room) Trade

**Objective:** Verify cap room acquisition works correctly.

| Step | Action                                                      |
| ---- | ----------------------------------------------------------- |
| 1    | Select one under-cap team (cap room > $10M) as Team A       |
| 2    | Select one over-cap team as Team B                          |
| 3    | From Team B, add a player with salary ~$8M                  |
| 4    | From Team A, add nothing OR minimal salary (under cap room) |
| 5    | Click Validate                                              |

**Expected Results:**

- [ ] Trade shows "✅ Trade is CBA Legal" (if Team A uses cap room)
- [ ] Team A shows "Cap Room" or appropriate matching tier indicator
- [ ] Incoming salary <= available cap room

**Common Failure Signals:**

- Cap room not calculated correctly
- Under-cap team forced to use 125%+100K instead of cap room
- Cap room shows negative or inflated value

---

## B) Hard Cap / Aprons

### Scenario B1: Hard-Capped Team — Effective Allowable Display

**Objective:** Verify effective allowable shows the LOWER of salary-match ceiling and hard-cap ceiling.

| Step | Action                                                    |
| ---- | --------------------------------------------------------- |
| 1    | Select a team that is hard-capped at the first apron      |
| 2    | Add a player from that team (salary ~$15M)                |
| 3    | Select second team and add player to trade                |
| 4    | Click Validate                                            |
| 5    | Check the hard-capped team's allowable incoming breakdown |

**Expected Results:**

- [ ] Hard-capped team shows lock icon or "Hard Capped" indicator
- [ ] Effective allowable shows TWO ceilings:
  - Salary Match Ceiling (125%+100K)
  - Hard Cap Ceiling (outgoing + room to first apron)
- [ ] Effective allowable = MIN of the two ceilings
- [ ] Limiter clearly indicated (which ceiling applies)

**Common Failure Signals:**

- Only one ceiling shown
- Effective allowable exceeds hard-cap room
- No hard-cap indicator visible

---

### Scenario B2: Hard-Capped Team Trade That Passes

**Objective:** Verify hard-capped team can complete legal trade when under ceiling.

| Step | Action                                                                 |
| ---- | ---------------------------------------------------------------------- |
| 1    | Select a team that is hard-capped at the first apron                   |
| 2    | Add a player from that team                                            |
| 3    | From second team, add player such that incoming <= effective allowable |
| 4    | Ensure post-trade salary would NOT exceed hard-cap apron               |
| 5    | Click Validate                                                         |

**Expected Results:**

- [ ] Trade shows "✅ Trade is CBA Legal"
- [ ] Post-trade projected salary shown < hard-cap apron
- [ ] All hard-cap specific validation passes

**Common Failure Signals:**

- Trade rejected despite being under effective allowable
- Post-trade projection calculation error
- Phantom hard-cap violation message

---

### Scenario B3: Second Apron 100% Matching Display

**Objective:** Verify teams at/above second apron show 100% matching requirement.

| Step | Action                                     |
| ---- | ------------------------------------------ |
| 1    | Select a team at or above the second apron |
| 2    | Add a player from that team (salary ~$10M) |
| 3    | Click Validate                             |
| 4    | Check allowable incoming display           |

**Expected Results:**

- [ ] Allowable incoming = outgoing (100% matching, no cushion)
- [ ] Second apron status clearly indicated
- [ ] No 125% tier displayed for this team

**Common Failure Signals:**

- Allowable shows 125%+100K instead of 100%
- Second apron status not visible
- Matching tier mismatch with apron status

---

## C) Picks / Entitlements

### Scenario C1: Simple Pick Trade (2-Team)

**Objective:** Verify picks appear correctly in summary and export.

| Step | Action                                    |
| ---- | ----------------------------------------- |
| 1    | Select two teams                          |
| 2    | From Team A, toggle a draft pick to trade |
| 3    | From Team B, add a player or pick         |
| 4    | Click Validate                            |
| 5    | Check Summary panel                       |
| 6    | Click Export (if available)               |

**Expected Results:**

- [ ] Pick appears in Team A's "Sends" section
- [ ] Pick appears in Team B's "Receives" section
- [ ] Pick details show: year, round, original owner, protection terms
- [ ] Export includes the pick with same details

**Common Failure Signals:**

- Pick missing from summary
- Pick shows wrong team ownership
- Export missing pick details
- Protection terms not visible

---

### Scenario C2: Protected Pick Edit via Wizard

**Objective:** Verify protection editing persists and updates everywhere.

| Step | Action                                        |
| ---- | --------------------------------------------- |
| 1    | Select a team with tradeable picks            |
| 2    | Toggle a first-round pick to include in trade |
| 3    | Click Edit/Wizard on that pick                |
| 4    | Add protection (e.g., "Top 10 Protected")     |
| 5    | Save and return to trade editor               |
| 6    | Check Summary and Export                      |

**Expected Results:**

- [ ] Protection shows in pick row ("Top 10 Protected")
- [ ] `termsShort` updated in UI (e.g., "1st-10")
- [ ] Summary shows protection terms in pick line
- [ ] Export shows protection terms
- [ ] Re-editing pick shows saved protection

**Common Failure Signals:**

- Protection not persisted after closing wizard
- `termsShort` shows "Unprotected" despite edit
- Protection lost on page navigation
- Export shows different terms than UI

---

### Scenario C3: Stepien Violation Attempt

**Objective:** Verify Stepien rule prevents illegal pick trades.

| Step | Action                                                       |
| ---- | ------------------------------------------------------------ |
| 1    | Select a team                                                |
| 2    | Add consecutive first-round picks (e.g., 2026 and 2027)      |
| 3    | If team already missing a 1st in adjacent year, trigger rule |
| 4    | Click Validate                                               |

**Expected Results:**

- [ ] Validation fails with Stepien violation error
- [ ] Error message clearly references Stepien rule
- [ ] Affected picks or years identified in message
- [ ] Trade shows "❌ Trade is NOT CBA Legal"

**Common Failure Signals:**

- Stepien not enforced (trade passes as legal)
- Vague error without Stepien reference
- Error blocks wrong picks

---

## D) Multi-Team Player Routing

### Scenario D1: 3-Team Trade — Missing tradeTo Error

**Objective:** Verify validation catches missing destination in 3+ team trades.

| Step | Action                                            |
| ---- | ------------------------------------------------- |
| 1    | Click "Add Team" twice to create 3-team trade     |
| 2    | From Team A, add a player WITHOUT setting tradeTo |
| 3    | From Team B, add a player WITHOUT setting tradeTo |
| 4    | Click Validate                                    |

**Expected Results:**

- [ ] Validation fails
- [ ] Error message: "Player [X] has no destination" or similar
- [ ] Each player needing routing is identified
- [ ] Trade does NOT appear in any team's incoming until routed

**Common Failure Signals:**

- Trade passes without tradeTo (broadcast fallback)
- Player appears in ALL teams' incoming (incorrect)
- Silent failure with no message

---

### Scenario D2: 3-Team Trade — Correct Routing

**Objective:** Verify explicit routing works correctly for all players.

| Step | Action                                          |
| ---- | ----------------------------------------------- |
| 1    | Create 3-team trade (Teams A, B, C)             |
| 2    | From Team A, add player and set tradeTo: Team C |
| 3    | From Team B, add player and set tradeTo: Team A |
| 4    | From Team C, add player and set tradeTo: Team B |
| 5    | Click Validate                                  |
| 6    | Check Summary for each team                     |

**Expected Results:**

- [ ] Team A: Sends player, Receives from Team B
- [ ] Team B: Sends player, Receives from Team C
- [ ] Team C: Sends player, Receives from Team A
- [ ] Summary shows correct routing for each team
- [ ] Export shows correct destinations

**Common Failure Signals:**

- Player shows in wrong team's incoming
- Circular routing not resolved
- Summary mismatch with routing settings

---

### Scenario D3: Duplicate Player Attempt

**Objective:** Verify same player cannot be in multiple teams' sends.

| Step | Action                                                  |
| ---- | ------------------------------------------------------- |
| 1    | Create 2-team trade                                     |
| 2    | From Team A, add Player X                               |
| 3    | Attempt to add same Player X from Team B (if UI allows) |
| 4    | OR: Modify state/URL to inject duplicate                |
| 5    | Click Validate                                          |

**Expected Results:**

- [ ] Duplicate prevented at UI level (player already selected), OR
- [ ] Validation catches duplicate and shows error
- [ ] Error message identifies the duplicate player

**Common Failure Signals:**

- Duplicate allowed with no error
- Silent filter removes one instance
- Trade appears legal with duplicate

---

## E) Team Removal Cleanup

### Scenario E1: Remove Team — Orphan Routes Cleared

**Objective:** Verify removing a team cleans up assets routed to it.

| Step | Action                                                 |
| ---- | ------------------------------------------------------ |
| 1    | Create 3-team trade (Teams A, B, C)                    |
| 2    | From Team A, route player to Team C (tradeTo: C)       |
| 3    | From Team B, route pick/player to Team C (toTeamId: C) |
| 4    | Remove Team C from the trade                           |
| 5    | Check remaining Team A and B's routed assets           |
| 6    | Click Validate                                         |

**Expected Results:**

- [ ] After removal, Team A's player tradeTo is cleared OR re-prompted
- [ ] After removal, Team B's asset toTeamId is cleared OR re-prompted
- [ ] Validation either:
  - Passes (if cleanup auto-cleared routes), OR
  - Fails with clear "missing destination" message
- [ ] No orphan references to removed team

**Common Failure Signals:**

- Assets still reference removed team (Team C)
- Validation passes with stale routes
- UI shows ghost incoming for nonexistent team

---

## F) World Apply Trade (Immutability)

### Scenario F1: Apply Trade — World-Scoped Writes Only

**Objective:** Verify Apply Trade writes ONLY to world collections, never base.

| Step | Action                                                     |
| ---- | ---------------------------------------------------------- |
| 1    | Create a valid trade (any legal trade)                     |
| 2    | Ensure you are in a World context (worldId present)        |
| 3    | Click Apply Trade                                          |
| 4    | Note any success/error messages                            |
| 5    | Open Firebase Console (if accessible) OR check network tab |

**Expected Results:**

- [ ] Apply Trade succeeds (if worldId present)
- [ ] Writes go to: `architect_worlds/{worldId}/teams/{teamCode}`
- [ ] Writes go to: `architect_worlds/{worldId}/teams/{teamCode}/players/...`
- [ ] NO writes to: `/teams`, `architect_baseTeams`, `players_v2`
- [ ] Success message indicates world was updated

**Manual Verification Notes:**

```text
Target collections (SHOULD see writes):
- architect_worlds/{worldId}/teams/{teamCode}
- architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
- architect_worlds/{worldId}/entitlements/{entitlementId}

Forbidden collections (MUST NOT see writes):
- /teams
- architect_baseTeams
- architect_basePlayers
- architect_baseEntitlements
- players_v2
```

**Common Failure Signals:**

- Apply Trade writes to base collections
- Success without worldId (should be prevented)
- Network shows forbidden collection paths
- Base collection data changes after apply

---

## G) Eligibility Rules

### Scenario G1: Two-Way Player Trade Block

**Objective:** Verify two-way contract players cannot be included in trades.

| Step | Action                                                |
| ---- | ----------------------------------------------------- |
| 1    | Select any two teams                                  |
| 2    | From Team A, attempt to add a two-way contract player |
| 3    | Click Validate                                        |

**Expected Results:**

- [ ] Trade shows "❌ Trade is NOT CBA Legal"
- [ ] Error message specifically mentions two-way contracts
- [ ] Message indicates: "Two-way players must be waived, not traded"
- [ ] Validation clearly identifies which player caused the block

**Common Failure Signals:**

- Trade passes as legal with two-way player
- No specific error message for two-way violation
- Two-way player treated as standard contract

**CBA Reference:** Two-way contract rules prohibit trading two-way players between teams. Teams must waive the player if they wish to move them.

**Automated Test:** `npm run test src/tests/architect/batchB_cbaRules.test.js -- --run`

---

## H) Data Quality Warnings

### Scenario DW1: BYC Player Missing Previous Salary

**Objective:** Verify WARNING severity data warnings display for BYC players missing previous salary.

| Step | Action                                                                            |
| ---- | --------------------------------------------------------------------------------- |
| 1    | Select two teams                                                                  |
| 2    | Add a BYC player to the trade (player with `isBYC: true` but no `previousSalary`) |
| 3    | Click "Validate Trade"                                                            |
| 4    | Scroll to Data Warnings section (below top status, above rule explanations)       |

**Expected Results:**

- [ ] WARNING section appears with yellow background
- [ ] Message shows player name and "missing previousSalary"
- [ ] Message mentions "outgoing matching value may be inaccurate"
- [ ] Trade can still be validated (non-blocking warning)
- [ ] Section positioned below "✅/❌ Trade Legal" banner

**Common Failure Signals:**

- Warning section doesn't appear
- Wrong severity (should be WARNING, not ERROR)
- Missing player name in message
- Trade blocked (should be non-blocking)

---

### Scenario DW2: Player Missing Salary Data

**Objective:** Verify WARNING severity data warnings display for players with no salary data.

| Step | Action                                                                          |
| ---- | ------------------------------------------------------------------------------- |
| 1    | Select two teams                                                                |
| 2    | Add a player with no salary data (no `contract.salariesByYear` and no fallback) |
| 3    | Click "Validate Trade"                                                          |
| 4    | Check Data Warnings section                                                     |

**Expected Results:**

- [ ] WARNING section appears with yellow background
- [ ] Message shows player name and "has no salary data for year [YEAR]"
- [ ] Specific year is mentioned in message
- [ ] Trade validation proceeds (non-blocking)

**Common Failure Signals:**

- Warning section doesn't appear
- Wrong severity level
- Message doesn't specify which year
- Generic error message instead of player-specific

---

### Scenario DW3: Salary Fallback (INFO)

**Objective:** Verify INFO severity warnings are collapsed by default and expandable.

| Step | Action                                                                                 |
| ---- | -------------------------------------------------------------------------------------- |
| 1    | Select two teams                                                                       |
| 2    | Add a player using fallback salary field (has `player.salary` but not canonical field) |
| 3    | Click "Validate Trade"                                                                 |
| 4    | Look for collapsed INFO section with blue background                                   |
| 5    | Click on INFO section to expand                                                        |

**Expected Results:**

- [ ] INFO section appears collapsed with blue background
- [ ] Section shows "ℹ️ Data Info (1)" with chevron-down icon
- [ ] Click expands to show player name and "using fallback salary source"
- [ ] No visual alarm (informational only, not yellow/red)
- [ ] Trade validates normally

**Common Failure Signals:**

- INFO section shown expanded by default
- Wrong color (should be blue, not yellow/red)
- Missing fallback source in message
- Cannot expand/collapse section

---

### Scenario DW4: No Data Issues (Clean Trade)

**Objective:** Verify no warnings section appears when all data is complete and canonical.

| Step | Action                                                     |
| ---- | ---------------------------------------------------------- |
| 1    | Select two teams                                           |
| 2    | Add players with complete, canonical salary data           |
| 3    | Verify all players have `contract.salariesByYear[].capHit` |
| 4    | Click "Validate Trade"                                     |

**Expected Results:**

- [ ] No data warnings section appears at all
- [ ] Clean validation result display
- [ ] Only CBA rule results shown (if any violations exist)
- [ ] No empty warning boxes or placeholder text

**Common Failure Signals:**

- Empty warning section still visible
- Placeholder text displayed ("No warnings")
- UI spacing issues where warnings section would be
- Section header visible but empty

---

### Scenario DW5: Multiple Warning Types

**Objective:** Verify multiple warning types display correctly with proper severity separation.

| Step | Action                                               |
| ---- | ---------------------------------------------------- |
| 1    | Select two teams                                     |
| 2    | Add 1 BYC player (missing previous salary) → WARNING |
| 3    | Add 1 player with fallback salary → INFO             |
| 4    | Add 1 player missing salary data → WARNING           |
| 5    | Click "Validate Trade"                               |
| 6    | Review Data Warnings section structure               |

**Expected Results:**

- [ ] WARNING section shows 2 items (BYC + missing salary) — always visible, yellow
- [ ] INFO section shows 1 item (fallback) — collapsed by default, blue
- [ ] Each warning message is clear with player name
- [ ] Summary line shows statistics (e.g., "3 players checked • 1 BYC players (1 missing previous salary) • 1 using fallback salary fields • 1 missing salary data")
- [ ] Can expand INFO section independently

**Common Failure Signals:**

- Warnings mixed together (severity not separated)
- Summary counts incorrect or missing
- Messages unclear or missing player names
- Cannot distinguish WARNING from INFO visually
- INFO section expanded by default (should be collapsed)

---

## Results Summary Table

| #   | Scenario                     | Category        | Pass? | Notes |
| --- | ---------------------------- | --------------- | ----- | ----- |
| A1  | Simple Legal 1-for-1         | Salary Matching | [ ]   |       |
| A2  | Illegal Salary Matching      | Salary Matching | [ ]   |       |
| A3  | Under-Cap (Cap Room) Trade   | Salary Matching | [ ]   |       |
| B1  | Hard-Cap Effective Allowable | Hard Cap/Aprons | [ ]   |       |
| B2  | Hard-Cap Trade Passes        | Hard Cap/Aprons | [ ]   |       |
| B3  | Second Apron 100% Matching   | Hard Cap/Aprons | [ ]   |       |
| C1  | Simple Pick Trade            | Picks           | [ ]   |       |
| C2  | Protected Pick Edit          | Picks           | [ ]   |       |
| C3  | Stepien Violation            | Picks           | [ ]   |       |
| D1  | 3-Team Missing tradeTo       | Multi-Team      | [ ]   |       |
| D2  | 3-Team Correct Routing       | Multi-Team      | [ ]   |       |
| D3  | Duplicate Player             | Multi-Team      | [ ]   |       |
| E1  | Team Removal Cleanup         | Team Removal    | [ ]   |       |
| F1  | Apply Trade Immutability     | World Apply     | [ ]   |       |
| G1  | Two-Way Player Trade Block   | Eligibility     | [ ]   |       |
| DW1 | BYC Missing Previous Salary  | Data Warnings   | [ ]   |       |
| DW2 | Missing Salary Data          | Data Warnings   | [ ]   |       |
| DW3 | Salary Fallback (INFO)       | Data Warnings   | [ ]   |       |
| DW4 | No Data Issues               | Data Warnings   | [ ]   |       |
| DW5 | Multiple Warning Types       | Data Warnings   | [ ]   |       |

---

## Pass Threshold

| Criteria                     | Requirement       |
| ---------------------------- | ----------------- |
| All scenarios pass           | 20/20 (100%)      |
| Zero HIGH severity failures  | Required          |
| Document any MEDIUM failures | In workbook notes |

---

## Revision History

| Version | Date       | Author | Changes                                                  |
| ------- | ---------- | ------ | -------------------------------------------------------- |
| V1      | 2026-02-14 | Agent  | Initial creation                                         |
| V1.1    | 2026-02-15 | Agent  | Added G1: Two-Way Player Trade Block (Batch B)           |
| V1.2    | 2026-02-15 | Agent  | Added DW1-DW5: Data Quality Warnings (TM_DATAWARN_UI_E1) |
