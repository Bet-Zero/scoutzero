# TRADE_TESTS_FIX_E1 — EXECUTION RETURN PACKAGE

**Execution ID:** TRADE_TESTS_FIX_E1  
**Date:** 2026-02-25  
**Master Doc:** `docs/architect/TRADE_MACHINE_MASTER.md`

## Scope

Stabilize `npm run test:trade` baseline by fixing:

1. 3-team routing correctness in validator paths.
2. Second apron incoming-salary restriction behavior in multi-team trades.
3. Stale 3-team fixtures that no longer matched enforced routing requirements.

## Root-Cause Analysis (Original 3 Failures)

### 1) `tests/tradeValidator.test.js` — `handles 3-team trades correctly`

- Expected: legal result.
- Actual: illegal (`PLAYER_ROUTING_ERROR`).
- Failing assertion: `expect(result.legal).toBe(true)`.
- Responsible code path: `validateTrade` early return after `validatePlayerRouting` rejected missing player destinations in 3-team context.
- Minimal fix strategy: make fixture route-complete and ensure validator incoming/salary computation is route-aware for 3+ teams.

### 2) `tests/tradeValidatorEdgeCases.test.js` — `allows 3-team trade mixing players, picks and cash when below aprons`

- Expected: legal result.
- Actual: illegal (`PLAYER_ROUTING_ERROR`).
- Failing assertion: `expect(result.legal).toBe(true)`.
- Responsible code path: same early `validatePlayerRouting` failure because outgoing players had no destination in 3-team fixture.
- Minimal fix strategy: add explicit destinations per outgoing player and keep mixed-asset intent unchanged.

### 3) `tests/tradeValidatorEdgeCases.test.js` — `blocks second apron teams receiving more salary than sent`

- Expected: blocked for apron/salary reason.
- Actual: blocked for routing reason before apron logic executed.
- Failing assertion: reason intent mismatch (routing failure masked salary rule).
- Responsible code path: `validatePlayerRouting` precheck short-circuited `validateSalaryMatching`.
- Minimal fix strategy: make fixture route-complete, then enforce route-aware salary-in computation so second-apron rule evaluates correct incoming totals in 3-team trades.

## Exact Code Changes

### `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`

- Added canonical team identity resolution and destination helpers:
  - `normalizeTeamCodeLike`
  - `resolveTeamIdentity`
  - `resolvePlayerDestinationTeamId`
  - `shouldRoutePlayerToTeam`
- Updated incoming player construction in `validateTrade`:
  - 2-team: preserve fallback when destination missing.
  - 3+ team: only include explicitly routed players.
  - attach consistent `fromTeamId` on incoming entries.
- Updated salary-in computation to use the same route-aware destination logic (no 3+ team broadcast behavior).
- Standardized team identity usage in team result generation and entitlement-routing-adjacent identity resolution.
- Removed hardcoded 3-team summary behavior and derived `summaryByTeamIndex.playersIn` directly from actual routed incoming players.
- Updated receipt generation identity usage for team and incoming entitlement attribution consistency.

### `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js`

- Added deterministic team identity resolver (`resolveTeamId`) with fallback `team-${index}`.
- Added destination alias resolver (`resolvePlayerDestination`) supporting `tradeTo`, `toTeamId`, `destTeamId`.
- Switched active-team and routing checks to resolved team identities so route validation and downstream validator/apply paths align.

### `tests/tradeValidator.test.js`

- Added `id` and `teamCode` to local `makeTeam` helper for explicit fixture identity.
- Updated failing 3-team test to provide explicit `tradeTo` destinations for all outgoing players.

### `tests/tradeValidatorEdgeCases.test.js`

- Added `id` and `teamCode` to local `makeTeam` helper for explicit fixture identity.
- Updated both failing 3-team fixtures to include explicit `tradeTo` routes for each outgoing player.
- Strengthened second-apron failure test with:
  - `expect(result.reason).not.toContain('no destination')`
  - retains apron/salary reason assertion.
- Added regression:
  - `does not trigger second apron incoming salary violation when routed incoming equals outgoing in 3-team trade`
  - verifies no false second-apron violation when routing is legal and salary-in is route-correct.

## Test Changes + Rationale

- Fixture updates were required because enforced 3+ team routing prechecks are now a documented baseline rule in this codebase.
- These tests were stale relative to current legality rules (missing destinations in 3-team trades).
- Assertions were adjusted to preserve original intent:
  - legal mixed-asset 3-team trade remains legal when route-complete,
  - second-apron block is now asserted for salary/apron reason rather than routing precheck.
- No test weakening, skipping, or entitlement invariant bypassing was introduced.

## Validation Outputs

### 1) `npm run test:trade -- --reporter=dot`

- PASS
- `Test Files 51 passed`
- `Tests 499 passed | 1 skipped | 3 todo (503)`

### 2) `npm run test:architect -- --reporter=dot`

- PASS
- `Test Files 129 passed`
- `Tests 2192 passed | 1 skipped | 3 todo (2196)`

### 3) `npm run build`

- PASS
- Production build completed successfully.

### 4) `npm run validate:project`

- PASS

## Commands Intentionally Skipped

- `npm run test:full` / `npm test` / raw `vitest`:
  - skipped because AGENTS.md policy requires explicit `RUN FULL SUITE` phrase, which was not requested.
- `npm run lint`:
  - skipped because not requested and outside this stabilization scope.
- `npm run typecheck`:
  - skipped per prompt guidance to avoid unrelated type-debt work in this pass.
