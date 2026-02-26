# TRADE_MACHINE_MASTER

Last updated: 2026-02-26

## Trade Machine Overview

`validateTrade` is the canonical legality gate for Trade Machine proposals. It guarantees:

- Deterministic validation for each participating team using the same routed asset view used by apply-time flows.
- Routing legality for outgoing assets (players, entitlements, and cash where modeled):
  - In multi-team trades (3+ teams), every outgoing asset must have an explicit destination team.
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

1. Repaired 3+ team route-aware incoming player and salary calculations in `tradeValidator` so validation does not treat incoming assets as broadcast from all other teams.
2. Standardized team identity and player destination resolution across:
   - route checks
   - salary matching
   - summary generation
   - entitlement-routing-adjacent team identity usage
3. Updated stale 3-team fixtures to include explicit player destinations so pre-validation routing checks do not mask downstream rule evaluation.
4. Added a targeted regression test ensuring second-apron incoming-salary restrictions in 3-team trades use routed incoming values rather than broadcast assumptions.

### Clarified Rules (LOCKED)

#### A) Multi-team routing requirement (3+ teams)

- In 3+ team trades, **outgoing players must have explicit destination routing**.
- **Definition:** every outgoing player must specify a destination team via the canonical destination field.
- Trades that violate this fail early with routing legality errors (by design), and downstream rules (salary/apron/etc.) must not be expected to run if routing is incomplete.

#### B) Canonical destination field (and supported aliases)

- **Canonical destination field:** `toTeamId`
- Supported aliases (backward compatibility only): `tradeTo`, `destTeamId`
- New call sites and new fixtures should use `toTeamId`. Aliases exist only to tolerate older shapes.

#### C) Two-team routing legacy fallback (2 teams only)

- In 2-team trades, missing player destination uses a **legacy backward-compatible fallback** behavior.
- This fallback is **not** valid for 3+ team trades and must not be expanded to multi-team behavior.
- New code and fixtures should still supply `toTeamId` for clarity even in 2-team cases.

#### C.1) Apply-time fail-closed routing invariant (3+ teams)

- Apply-time snapshot building now enforces the same 3+ destination requirement as validator routing.
- If any outgoing player in a 3+ team trade has missing/invalid destination routing, apply fails loudly with `TRADE_APPLY_ROUTING_ERROR`.
- No partial apply writes are committed when this invariant fails.

#### D) Second apron incoming salary restriction (route-aware)

- The “second apron team cannot receive more salary than it sends” restriction is evaluated using **routed incoming salary**.
- In 3+ team trades, only explicitly routed incoming players count toward incoming salary. There is no broadcast/implicit incoming behavior.

#### E) Entitlement legality remains fail-closed

- Entitlement invariants remain fail-closed and are not bypassed by trade validation:
  - league claim uniqueness protections
  - linked package completeness enforcement
  - resolver invariant violation protections

### Current Test Gate Status

- `npm run test:trade -- --reporter=dot`: PASS
- `npm run test:architect -- --reporter=dot`: PASS
- `npm run build`: PASS
- `npm run validate:project`: PASS
