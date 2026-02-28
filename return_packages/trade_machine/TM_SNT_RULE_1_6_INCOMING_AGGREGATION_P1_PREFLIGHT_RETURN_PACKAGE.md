# TM_SNT_RULE_1_6_INCOMING_AGGREGATION_P1 — PREFLIGHT RETURN PACKAGE

Date: 2026-02-28  
Mode: PREFLIGHT (Discovery Packet, finalized for implementation handoff)

## 1) Executive Summary

Rule 1.6 incoming aggregation was already present in runtime validation at preflight time:

- Implemented in `validateSignAndTrade()` under existing key `team.rules.signAndTrade`
- Wired through `validateTrade()` and apply-time re-validation (`validatePostTradeSnapshotForContext()`)

The gap was documentation/test drift: docs and deferred tests still treated Rule 1.6 as unimplemented.

## 2) Current-State Map (Validator / Apply / UI / Data Model)

### Validator

- Entry: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- Rule callsite: `validators.validateSignAndTrade(team, context)`
- Incoming S&T detection: `incomingPlayers.filter((player) => player.signAndTrade === true)`
- Rule 1.6 violation string: `Cannot aggregate other players with sign-and-trade player.`

### Apply-Time

- Snapshot builder: `src/features/architect/utils/tradeContext/tradeContext.js`
- Re-validation gate: `validatePostTradeSnapshotForContext() -> validateTrade()`
- Receives-S&T compute: `incomingPlayers.some((p) => p.signAndTrade === true)`

### UI Surface

- Compliance row key: `team.rules.signAndTrade` in `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
- S&T capture flow writes:
  - `signAndTrade: true`
  - `signAndTradeContract`
  - destination (`tradeTo` / destination id from modal flow)

### Routing Constraints

- 3+ team trades require explicit player routing (`tradeTo`/alias), otherwise routing guards fail before Rule 1.6 checks.

## 3) Test Intent Table (1.5 vs 1.6 vs Fixture Issues)

| Test Intent | Classification | Notes |
|---|---|---|
| Origin sends S&T + extra player | Rule 1.5 | Existing outgoing aggregation block |
| Receiver gets S&T + any additional player | Rule 1.6 | Applies regardless of sender team |
| 3-team receiver gets S&T + player from another team | Rule 1.6 | Requires explicit routing fixture |
| Third-party team receives multiple non-S&T players | Rule 1.6 boundary | Should remain allowed |
| Prior deferred cases | Fixture/doc drift | Not runtime-rule absence |

## 4) Final Rule 1.6 Spec (Allowed / Blocked)

Decision for this repo:

- If a team receives an S&T player, that team may not receive any additional players in the same transaction.

Allowed:

- Receiver gets exactly one S&T player
- Picks/cash alongside S&T (subject to other rules)
- Third-party non-S&T aggregation when that team is not the S&T receiver

Blocked:

- Receiver gets S&T + any non-S&T player
- Receiver gets multiple S&T players
- Origin sends S&T + another player (Rule 1.5)

## 5) Wiring Recommendation

Recommended and retained:

- **Option A:** keep a single SSOT rule key `team.rules.signAndTrade`
- No new public rule key
- Preserve output shape:
  - `passed`
  - `violations`
  - `message`
  - `hardCapped`
  - `details`

## 6) 3-Team Fixture / Routing Requirements Checklist

1. All outgoing players in 3-team fixtures must include explicit destination routing.
2. Use `tradeCtx.offseason = true` unless testing offseason failure.
3. Keep roster deltas within 14–15 unless testing roster violations.
4. Ensure valid S&T contract assumptions (3-4 years, guaranteed first year, active season row).
5. Avoid unrelated blockers (e.g., taxpayer MLE flags) in Rule 1.6 tests.

## 7) Draft EXECUTION Prompt (Delivered and Applied)

Execution scope from this preflight:

1. Reactivate deferred Rule 1.6 tests with routed fixtures.
2. Keep SSOT on `team.rules.signAndTrade`.
3. Reconcile stale docs (`TRADE_MACHINE_MASTER`, `SHIP_GATES_MASTER`).
4. Validate with:
   - `npm run test:node -- --reporter=dot tests/signAndTradeAggregation.test.js`
   - `npm run test:trade -- --reporter=dot`

Implementation record:

- `return_packages/trade_machine/TM_SNT_RULE_1_6_INCOMING_AGGREGATION_E1_EXECUTION_RETURN_PACKAGE.md`
