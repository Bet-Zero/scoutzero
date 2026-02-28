# TM_SNT_RULE_1_6_INCOMING_AGGREGATION_E1 — EXECUTION RETURN PACKAGE

Date: 2026-02-28  
Mode: EXECUTION

## Summary

Implemented the Rule 1.6 closure plan by reactivating deferred incoming-aggregation tests with routing-correct fixtures and reconciling stale docs that said Rule 1.6 was unimplemented.

No runtime validator logic changes were required. Rule 1.6 remains enforced under existing key `team.rules.signAndTrade` in `validateSignAndTrade()`.

## Files Changed

1. `tests/signAndTradeAggregation.test.js`
2. `docs/architect/TRADE_MACHINE_MASTER.md`
3. `docs/SHIP_GATES_MASTER.md`
4. `return_packages/trade_machine/TM_SNT_RULE_1_6_INCOMING_AGGREGATION_P1_PREFLIGHT_RETURN_PACKAGE.md`
5. `return_packages/trade_machine/TM_SNT_RULE_1_6_INCOMING_AGGREGATION_E1_EXECUTION_RETURN_PACKAGE.md`

## What Changed

### 1) Reactivated Rule 1.6 tests with explicit routing fixtures

Updated `tests/signAndTradeAggregation.test.js`:

1. Converted 5 deferred `it.todo()` cases into active tests.
2. Added explicit `tradeTo` routing on all outgoing players in 3-team scenarios.
3. Used roster-safe fixture sizes so failures reflect Rule 1.6 intent instead of roster overflow.
4. Preserved existing Rule 1.5 and control coverage.

### 2) Documented current Rule 1.6 SSOT status

Updated `docs/architect/TRADE_MACHINE_MASTER.md`:

1. Replaced stale “Future / Deferred” claim that Rule 1.6 was unimplemented.
2. Added section: `Rule 1.6 — S&T Incoming Aggregation (Implemented)`.
3. Explicitly documented SSOT key (`team.rules.signAndTrade`), behavior boundaries, apply-time parity, and this return package link.

### 3) Added manual smoke guidance for Rule 1.6

Updated `docs/SHIP_GATES_MASTER.md`:

1. Added Scenario 1A (2-team S&T incoming aggregation violation).
2. Added Scenario 1B (3-team routed S&T incoming aggregation violation).
3. Reworded RC1/RC1.1 references so historical text no longer reads like current-state “Rule 1.6 is unimplemented”.

## Reactivated Test Mapping (Rule Intent)

| Test | Classification | Expected |
|---|---|---|
| allows valid S&T where receiving team gets only the S&T player | Baseline | Allow |
| blocks origin team sending S&T player + another player | Rule 1.5 | Block |
| blocks receiving team getting S&T + another player from same origin team | Rule 1.6 (plus 1.5 at origin) | Block |
| blocks receiving team getting S&T + another player in same inbound (3-team routed fixture) | Rule 1.6 | Block |
| blocks receiving team getting S&T + player from a different team | Rule 1.6 | Block |
| allows S&T with draft picks alongside (picks are not players) | Rule 1.6 boundary | Allow |
| allows non-S&T multi-player trade (control case) | Control | Allow |
| blocks receiving team in 3-team trade that gets S&T + any other player | Rule 1.6 | Block |
| allows third party team to receive multiple non-S&T players with routed fixture | Rule 1.6 boundary | Allow |

## Validation Commands Run

1. `npm run test:node -- --reporter=dot tests/signAndTradeAggregation.test.js`  
   Result: PASS (`9 passed`, `0 failed`, `0 todo`)
2. `npm run test:trade -- --reporter=dot`  
   Result: PASS (`525 passed`, `1 skipped`, `3 todo`)

## Commands Intentionally Skipped

1. `npm run test:architect -- --reporter=dot`  
   Reason: no runtime validator/pipeline logic changes; scope was test fixture activation + docs.
2. `npm run build`  
   Reason: no production code path changes.
3. `npm run validate:project`  
   Reason: no structural file-layout/export changes.

## Acceptance Check

1. Rule 1.6 coverage is active (no deferred TODO tests in `tests/signAndTradeAggregation.test.js`).
2. 3-team routing fixtures are explicit and reach Rule 1.6 checks.
3. Docs no longer present Rule 1.6 as currently unimplemented.
4. SSOT remains `team.rules.signAndTrade` (no new public rule key added).
