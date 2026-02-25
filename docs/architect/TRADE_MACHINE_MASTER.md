# TRADE_MACHINE_MASTER

Last updated: 2026-02-25

## Trade Machine Overview

`validateTrade` is the canonical legality gate for Trade Machine proposals. It guarantees:

- Deterministic validation for each participating team using the same routed asset view used by apply-time flows.
- Routing legality for outgoing assets (players, entitlements, and cash where modeled): assets must have valid destination teams in multi-team contexts.
- Ownership and structural legality checks before trade commit (including entitlement routing and linkage checks).
- Salary/cap/apron rule evaluation using computed incoming/outgoing values per team.
- Fail-closed behavior: unresolved invariant/routing errors block legality.

## Test Gates

Primary gate:

- `npm run test:trade -- --reporter=dot`

Secondary confidence gates for this area:

- `npm run test:architect -- --reporter=dot`
- `npm run build`
- `npm run validate:project`

## Known Baseline Failures

None.

## E1 — Trade Test Gate Stabilization

### What Was Fixed

1. Repaired 3+ team route-aware incoming player and salary calculations in `tradeValidator` so validation no longer treats incoming assets as broadcast from all other teams.
2. Standardized team identity and player destination resolution (`tradeTo` / `toTeamId` / `destTeamId`) across route checks, salary matching, summary generation, and entitlement-routing-adjacent team identity usage.
3. Updated stale 3-team fixtures to include explicit player destinations so pre-validation routing checks do not mask downstream rule evaluation.
4. Added a targeted regression test ensuring second-apron incoming-salary restrictions in 3-team trades use routed incoming values rather than broadcast assumptions.

### Clarified Rules

- In 3+ team trades, outgoing players must have explicit destination routing.
- In 2-team trades, missing player destination still uses backward-compatible fallback behavior.
- Second apron incoming-vs-outgoing salary restriction is evaluated from routed incoming salary, including in multi-team scenarios.
- Entitlement invariants remain fail-closed (league claim uniqueness, linked package completeness, resolver invariant protections).

### Current Test Gate Status

- `npm run test:trade -- --reporter=dot`: PASS
- `npm run test:architect -- --reporter=dot`: PASS
- `npm run build`: PASS
- `npm run validate:project`: PASS
