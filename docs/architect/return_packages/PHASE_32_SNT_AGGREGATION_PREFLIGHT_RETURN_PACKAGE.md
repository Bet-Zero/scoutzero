# Phase 32: Sign-and-Trade Aggregation Prohibition — Preflight Return Package

**DATE:** 2026-01-23  
**MODE:** PREFLIGHT (review-only; NO code changes)  
**MASTER DOC (SSOT):** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`  
**GAP REFERENCE:** Phase 30 Preflight identified this as P0-2

---

## Summary

This preflight documents the exact rule definition, code-path map, data shape, and test plan for enforcing **Sign-and-Trade Aggregation Prohibition** in Phase 32. The analysis confirms the rule can be implemented without re-architecting trade data flow.

---

## A) Rule Definition (Project-Specific)

### Current Enforcement (EXISTING)

**File:** [validateSignAndTrade.js](src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js#L38-L40)

```javascript
// Rule 1.5: Sign-and-trade players must be traded alone
if (outgoingSignAndTradePlayers.length > 0 && (team.sends || []).length > 1) {
  violations.push('Sign-and-trade player must be traded alone.');
}
```

**What this enforces:**

- ✅ Origin team cannot send S&T player + other players in the same trade
- ❌ Does NOT check if receiving team is also receiving other players alongside S&T player

### Missing Enforcement (THE GAP)

**The gap identified in P0-2:** When a trade includes a sign-and-traded player, the **receiving team** must not also receive any other player(s) in the same transaction from ANY team.

### Complete Rule Definition for Phase 32

> **S&T Aggregation Prohibition (Project Rule):**
>
> 1. **Outgoing Aggregation (EXISTING):** The team sending an S&T player cannot send any other players in the same trade.
> 2. **Incoming Aggregation (NEW):** The team receiving an S&T player cannot receive any other players in the same trade from ANY source (including other teams in multi-team trades).
>
> **Rationale:** CBA prevents "aggregating" salary in S&T deals — the S&T player must be the sole player changing hands on both sides of the transaction. This prevents teams from using S&T as a vehicle for complex multi-player deals.

### Multi-Team Trade Behavior

In 3+ team trades:

- If Team A sends an S&T player to Team B:
  - Team A cannot send any other players (to any team)
  - Team B cannot receive any other players (from any team)
  - Team C can send/receive other players as long as they don't involve the S&T transaction leg

**Note:** Multi-team trades with S&T are rare but legally possible. The key constraint is that the S&T player transaction is isolated.

### Draft Picks Alongside S&T

Based on CBA intent and project convention:

- **Draft picks ARE allowed** alongside an S&T player (picks are not "players" for aggregation purposes)
- The aggregation prohibition applies to **player salaries only**, not asset types like picks or cash

---

## B) Code-Path Map (Where to Enforce)

### Validation Entry Point

| File                                                                                               | Function                               | Purpose                       |
| -------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------- |
| [validateSignAndTrade.js](src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js) | `validateSignAndTrade(team, tradeCtx)` | S&T-specific rule enforcement |

### Current Check Location

**Lines 10-17:** Identifies S&T players in incoming/outgoing lists

```javascript
const incomingSignAndTradePlayers = (team.incomingPlayers || []).filter(
  (player) => player.signAndTrade === true
);

const outgoingSignAndTradePlayers = (team.sends || []).filter(
  (player) => player.signAndTrade === true
);
```

**Lines 38-40:** Existing outgoing aggregation check

```javascript
if (outgoingSignAndTradePlayers.length > 0 && (team.sends || []).length > 1) {
  violations.push('Sign-and-trade player must be traded alone.');
}
```

### New Check Location (to be added in Phase 32)

Insert after Line 40, as a new "Rule 1.6":

```javascript
// Rule 1.6: Teams receiving S&T player cannot aggregate with other incoming players
if (incomingSignAndTradePlayers.length > 0) {
  // Get all incoming players (excluding the S&T player(s) themselves)
  const otherIncomingPlayers = (team.incomingPlayers || []).filter(
    (player) => player.signAndTrade !== true
  );

  if (otherIncomingPlayers.length > 0) {
    violations.push(
      'Cannot aggregate other players with sign-and-trade player.'
    );
  }
}
```

### Calling Code

| File                                                                                         | Function                                | Calls `validateSignAndTrade`                                                              |
| -------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| [tradeValidator.js](src/features/architect/utils/tradeMachine/engine/tradeValidator.js#L434) | `validateTrade()`                       | ✅ Line 434: `const signAndTradeResult = validators.validateSignAndTrade(team, context);` |
| [mutationPipeline.js](src/features/architect/utils/mutationPipeline.js#L1875)                | `validateMutation()` for `signAndTrade` | ✅ Calls `validateTradeForPipeline()` which invokes trade validator                       |

### Rule ID for Violations

**Proposed:** `snt_incoming_aggregation_prohibited`

Violation message: `"Cannot aggregate other players with sign-and-trade player."`

---

## C) Data Shape Truth Table

### Trade Context (`tradeCtx`)

| Field            | Type      | Source                      | Description                                             |
| ---------------- | --------- | --------------------------- | ------------------------------------------------------- |
| `offseason`      | `boolean` | Trade Machine UI / Pipeline | Whether trade is during offseason (S&T requires `true`) |
| `currentYear`    | `number`  | Pipeline                    | End year (e.g., 2026)                                   |
| `capProjections` | `object`  | Pipeline / Cap Settings     | Cap thresholds by year                                  |
| `capSettings`    | `object`  | `capSettingsProvider.js`    | Resolved cap/apron values                               |
| `tradeDate`      | `string`  | UI payload                  | ISO date of trade                                       |

### Team Object in Validation

| Field             | Type       | Source                        | Description                                           |
| ----------------- | ---------- | ----------------------------- | ----------------------------------------------------- |
| `team`            | `object`   | `teamsWithAssets`             | Full team document                                    |
| `sends`           | `Player[]` | Trade payload                 | Players this team is sending out                      |
| `incomingPlayers` | `Player[]` | Computed in `validateTrade()` | Players this team is receiving (from ALL other teams) |
| `outgoingPlayers` | `Player[]` | Computed (alias for `sends`)  | Same as `sends`                                       |
| `salaryIn`        | `number`   | Computed                      | Total incoming matching salary                        |
| `salaryOut`       | `number`   | Computed                      | Total outgoing matching salary                        |
| `teamTotalSalary` | `number`   | `team.teamTotalSalary`        | Pre-trade team salary                                 |
| `projectedSalary` | `number`   | Computed                      | Post-trade projected salary                           |

### Player Object Shape (for S&T identification)

| Field                 | Type      | Source                | Description                                 |
| --------------------- | --------- | --------------------- | ------------------------------------------- |
| `signAndTrade`        | `boolean` | UI payload / contract | `true` if player is being sign-and-traded   |
| `id` / `player_id`    | `string`  | Player doc            | Player identifier                           |
| `name` / `playerName` | `string`  | Player doc            | Display name                                |
| `contractYears`       | `number`  | Contract              | Length of contract (S&T requires 3-4)       |
| `firstYearGuaranteed` | `boolean` | Contract              | Whether first year is guaranteed            |
| `originTeamId`        | `string`  | Context               | Team that held Bird rights (for validation) |

### How `incomingPlayers` is Populated

**File:** [tradeValidator.js#L332-L337](src/features/architect/utils/tradeMachine/engine/tradeValidator.js#L332-L337)

```javascript
// Populate incoming players (what this team is receiving from other teams)
const incomingPlayers = otherTeams.reduce((players, otherTeam) => {
  return players.concat(otherTeam.sends || []);
}, []);
```

**Key insight:** `incomingPlayers` aggregates ALL `sends` from ALL other teams. This is exactly what we need to check for incoming aggregation — if `incomingPlayers.length > 1` and one of them is S&T, that's a violation.

---

## D) Test Plan (Minimum 6 Tests)

### Test File Location

Create or extend: `tests/signAndTradeAggregation.test.js`

(Alternatively, add to existing `tests/tradeValidator.test.js` or `src/tests/architect/signAndTrade.test.js`)

### Test Cases

| #     | Test Name                                                              | Scenario                                                                      | Expected Result | Rule ID                               |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------- | ------------------------------------- |
| **1** | `allows valid S&T player traded alone`                                 | Team A sends S&T player, Team B sends regular player in return                | ✅ PASS         | Baseline                              |
| **2** | `blocks origin team sending S&T + another player (existing)`           | Team A sends S&T player + regular player                                      | ❌ BLOCK        | `snt_outgoing_aggregation` (existing) |
| **3** | `blocks receiving team getting S&T + another player (NEW)`             | Team A sends S&T player; Team A also sends regular player to same destination | ❌ BLOCK        | `snt_incoming_aggregation_prohibited` |
| **4** | `blocks receiving team getting S&T + player from different team (NEW)` | 3-team: A→B (S&T player), C→B (regular player)                                | ❌ BLOCK        | `snt_incoming_aggregation_prohibited` |
| **5** | `allows S&T with draft picks alongside`                                | Team A sends S&T player + 1st round pick                                      | ✅ PASS         | Picks allowed                         |
| **6** | `allows non-S&T multi-player trade (control)`                          | Team A sends 2 regular players, Team B sends 2 regular players                | ✅ PASS         | Control case                          |
| **7** | `blocks receiving team in 3-team trade getting S&T + regular player`   | Complex 3-team where B receives S&T from A and regular from C                 | ❌ BLOCK        | Multi-team edge                       |
| **8** | `third party in S&T trade can receive multiple players`                | 3-team: A→B (S&T), A→C (regular) — C not affected                             | ✅ PASS         | Third party unaffected                |

### Test Helper Functions

```javascript
const makePlayer = (name, salary, isSignAndTrade = false, years = 4) => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  salary,
  signAndTrade: isSignAndTrade,
  contractYears: years,
  firstYearGuaranteed: true,
  contract: {
    salariesByYear: [{ season: '2025-26', salary, capHit: salary }],
  },
});

const makeTeam = (name, totalSalary, rosterCount = 14) => ({
  teamId: name,
  teamName: name,
  teamCode: name,
  totalSalary,
  teamTotalSalary: totalSalary,
  players: [],
  roster: [],
  rosterSize: rosterCount,
});
```

### Expected Violation Surfaces

| Violation                             | Where Returned               | UI Display             |
| ------------------------------------- | ---------------------------- | ---------------------- |
| `snt_incoming_aggregation_prohibited` | `teamResults[].violations[]` | Trade Validation Panel |
| `snt_outgoing_aggregation` (existing) | `teamResults[].violations[]` | Trade Validation Panel |

---

## E) Master Doc Entry Draft (Planned)

**Location:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` — HISTORY header

```markdown
- 2026-01-XX: Phase 32 S&T Aggregation Prohibition - added `snt_incoming_aggregation_prohibited` hard block to prevent receiving team from aggregating other players with S&T player, 8 new tests
```

**Location:** Gap Analysis table (Section 7.1)

```markdown
| G0-X | ~~S&T Aggregation Prohibition Incomplete~~ | S&T player aggregated with other incoming players | ✅ RESOLVED (Phase 32) |
```

---

## F) Stop Conditions Result

### Stop Condition 1: Cannot determine the intended project rule (repo ambiguity)

**Result:** ✅ CLEAR

The rule is unambiguous:

- Existing code at L38-40 clearly intends to prevent aggregation on outgoing side
- Phase 30 Preflight explicitly identified the incoming aggregation gap as P0-2
- CBA reference docs confirm S&T players must be traded "alone"

### Stop Condition 2: Trade context does not provide enough info

**Result:** ✅ SUFFICIENT

- `team.incomingPlayers` is already computed and contains ALL incoming players from ALL other teams
- `player.signAndTrade === true` flag is already present and checked
- No additional instrumentation required

### Stop Condition 3: Enforcing requires re-architecting trade data flow

**Result:** ✅ SMALL CHANGE

- Implementation requires adding ~8 lines to `validateSignAndTrade.js`
- No changes to trade data flow, context building, or other validators
- Can be completed within Phase 32 scope

---

## G) Implementation Summary

### Effort Estimate

| Task                           | Effort      | Files                                          |
| ------------------------------ | ----------- | ---------------------------------------------- |
| Add incoming aggregation check | 10 min      | `validateSignAndTrade.js`                      |
| Add 8 unit tests               | 30 min      | `tests/signAndTradeAggregation.test.js`        |
| Update Master Doc              | 5 min       | `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` |
| **Total**                      | **~45 min** | **3 files**                                    |

### Risk Assessment

| Risk                                  | Likelihood | Mitigation                                                 |
| ------------------------------------- | ---------- | ---------------------------------------------------------- |
| False positives blocking valid trades | LOW        | Rule logic is straightforward; test coverage will validate |
| Multi-team trade edge cases           | MEDIUM     | Tests 7-8 specifically cover 3-team scenarios              |
| UI doesn't display new violation      | LOW        | Uses existing `violations[]` array — no UI changes needed  |

---

## H) Conclusion

**PROCEED TO EXECUTION:** All preflight conditions are satisfied. The rule definition is clear, the code path is identified, the data shapes are documented, and the test plan is comprehensive. Phase 32 can proceed with implementation.

---

**END PREFLIGHT**
