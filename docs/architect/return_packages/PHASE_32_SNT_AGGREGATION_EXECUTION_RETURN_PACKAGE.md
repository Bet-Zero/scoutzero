# Phase 32: Sign-and-Trade Incoming Aggregation — Execution Return Package

**DATE:** 2026-01-23  
**MODE:** EXECUTION  
**MASTER DOC (SSOT):** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`  
**GAP REFERENCE:** Phase 30 Preflight identified this as P0-2

---

## 1. Summary

Phase 32 closes P0-2 by enforcing **incoming aggregation prohibition** for Sign-and-Trade (S&T) transactions:

- **NEW Rule 1.6:** When a team receives an S&T player, it cannot also receive any other players in the same trade (from any team).
- **Preserved Rule 1.5:** Origin team cannot send S&T player + other players (unchanged).
- **Picks allowed:** Draft picks are explicitly allowed alongside S&T players (picks ≠ player salary aggregation).

---

## 2. Files Changed

| File                                                                                  | Change Type | Description                                                             |
| ------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`             | MODIFIED    | Added Rule 1.6 incoming aggregation check (lines 41-55)                 |
| `tests/signAndTradeAggregation.test.js`                                               | CREATED     | 9 new tests covering aggregation prohibition scenarios                  |
| `tests/tradeValidator.test.js`                                                        | MODIFIED    | Updated existing test to expect Team B violation (incoming aggregation) |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`                         | MODIFIED    | Added Phase 32 history entry                                            |
| `docs/architect/return_packages/PHASE_32_SNT_AGGREGATION_EXECUTION_RETURN_PACKAGE.md` | CREATED     | This file                                                               |

---

## 3. Rule Definition

### Rule 1.5 (EXISTING — Outgoing Aggregation)

```
IF team sends S&T player AND team.sends.length > 1
THEN violation: "Sign-and-trade player must be traded alone."
```

### Rule 1.6 (NEW — Incoming Aggregation)

```
IF team receives S&T player(s) (incomingSignAndTradePlayers.length > 0)
AND (
  otherIncomingPlayers.length > 0  // receives non-S&T players too
  OR incomingSignAndTradePlayers.length > 1  // receives multiple S&T players
)
THEN violation: "Cannot aggregate other players with sign-and-trade player."
```

### Picks Explicitly Allowed

Draft picks are NOT included in `incomingPlayers` — they are tracked separately in `picksIn`/`picksOut`. Therefore, sending/receiving picks alongside an S&T player does NOT trigger the aggregation rule.

---

## 4. Exact Violation String

```javascript
'Cannot aggregate other players with sign-and-trade player.';
```

This string is pushed to `violations[]` in `validateSignAndTrade()` and surfaces in:

- `teamResults[n].violations[]`
- `teamResults[n].rules.signAndTrade.violations[]`
- Trade Validation Panel UI

---

## 5. Test List

### New Test File: `tests/signAndTradeAggregation.test.js`

| #   | Test Name                                                                 | Result  |
| --- | ------------------------------------------------------------------------- | ------- |
| 1   | allows valid S&T where receiving team gets only the S&T player            | ✅ PASS |
| 2   | blocks origin team sending S&T player + another player                    | ✅ PASS |
| 3   | blocks receiving team getting S&T + another player from same origin team  | ✅ PASS |
| 4   | blocks receiving team getting S&T + another player in same inbound        | ✅ PASS |
| 5   | blocks receiving team getting S&T + player from a different team (3-team) | ✅ PASS |
| 6   | allows S&T with draft picks alongside (picks are not players)             | ✅ PASS |
| 7   | allows non-S&T multi-player trade (control case)                          | ✅ PASS |
| 8   | blocks receiving team in 3-team trade that gets S&T + any other player    | ✅ PASS |
| 9   | allows third party team to receive multiple non-S&T players               | ✅ PASS |

### Updated Existing Test: `tests/tradeValidator.test.js`

| Test                                   | Change                                                               |
| -------------------------------------- | -------------------------------------------------------------------- |
| `enforces sign-and-trade restrictions` | Updated to expect Team B also fails (incoming aggregation violation) |

---

## 6. Test Output

```
 ✓ tests/signAndTradeAggregation.test.js (9 tests) 781ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

---

## 7. Build Output

```
✓ 2941 modules transformed.
dist/assets/index-bb23a29c.js  1,963.85 kB │ gzip: 570.55 kB
✓ built in 3m 49s
```

**Build status:** ✅ PASS

---

## 8. Pre-Existing Test Failure (Not Phase 32)

One test in `tests/tradeValidator.test.js` fails due to a pre-existing issue:

```
FAIL  tests/tradeValidator.test.js > tradeValidator > flags trades that would violate a hard cap
AssertionError: expected 'Incoming salary exceeds...' to contain '1st Apron hard cap violation'
```

This failure was verified to exist **before** Phase 32 changes by running `git stash` and testing. It is unrelated to the S&T aggregation implementation.

---

## 9. Acceptance Criteria Checklist

- [x] `validateSignAndTrade.js` blocks receiving-team aggregation when S&T player is incoming alongside any other incoming player
- [x] Picks alongside S&T do not trigger the aggregation rule
- [x] Existing outgoing "traded alone" rule remains unchanged and still passes its existing tests
- [x] All new tests pass (9/9)
- [x] `npm run build` passes
- [x] Master Doc updated with Phase 32 history entry
- [x] Phase 32 Return Package created

---

## 10. Code Changes

### validateSignAndTrade.js — Added Rule 1.6

```javascript
// Rule 1.5: Sign-and-trade players must be traded alone (outgoing)
if (outgoingSignAndTradePlayers.length > 0 && (team.sends || []).length > 1) {
  violations.push('Sign-and-trade player must be traded alone.');
}

// Rule 1.6: Receiving team cannot aggregate other players with S&T player (incoming)
// This applies when a team receives an S&T player - they cannot also receive other players
if (incomingSignAndTradePlayers.length > 0) {
  const otherIncomingPlayers = (team.incomingPlayers || []).filter(
    (player) => player.signAndTrade !== true
  );

  if (otherIncomingPlayers.length > 0) {
    violations.push(
      'Cannot aggregate other players with sign-and-trade player.'
    );
  }

  // Also block receiving multiple S&T players in same trade (edge case safety)
  if (incomingSignAndTradePlayers.length > 1) {
    violations.push(
      'Cannot aggregate other players with sign-and-trade player.'
    );
  }
}
```

---

## 11. Stop Conditions Result

| Condition                        | Result                                                |
| -------------------------------- | ----------------------------------------------------- |
| violations are NOT strings       | ✅ CLEAR — violations are strings, no refactor needed |
| incomingPlayers not available    | ✅ CLEAR — already computed and passed to validator   |
| Picks mixed into incomingPlayers | ✅ CLEAR — picks are separate (picksIn/picksOut)      |

All stop conditions passed. Implementation completed successfully.

---

**END PHASE 32**
