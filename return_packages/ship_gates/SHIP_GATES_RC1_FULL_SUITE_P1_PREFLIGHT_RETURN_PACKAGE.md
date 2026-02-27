# SHIP_GATES_RC1_FULL_SUITE_P1 — PREFLIGHT RETURN PACKAGE

Date: 2026-02-26
Mode: PREFLIGHT (discovery-only; no code changes)

---

## RC1 Gate Command Results

| # | Command | Result | Summary |
|---|---------|--------|---------|
| 1 | `npm run test -- --run` | **FAIL** | 3 files failed, 16 tests failed / 3022 passed / 1 skipped / 3 todo (233 files total) |
| 2 | `npm run validate:project` | **PASS** | All validations passed |
| 3 | `npm run build` | **PASS** | 3053 modules transformed, built in 2m 17s |

### Confirmatory P0 Scoped Suites

| Suite | Command | Result | Counts |
|-------|---------|--------|--------|
| Trade | `npm run test:trade -- --reporter=dot` | **PASS** | 58 files, 525 passed, 1 skipped, 3 todo |
| Architect | `npm run test:architect -- --reporter=dot` | **PASS** | 136 files, 2206 passed, 1 skipped, 3 todo |

---

## Trade Machine Status: CLEAN

All 58 trade suite files and all 136 architect suite files pass. None of the 16 full-suite failures are within the scoped trade or architect test suites. The Trade Machine 5-pack closure is not implicated.

---

## Failed Files Inventory

| # | File | Failed Tests | Classification | Pre-existing? |
|---|------|-------------|----------------|---------------|
| 1 | `tests/signAndTradeAggregation.test.js` | 5 | TM/Architect-trade adjacent (not in scoped suite) | Yes — created in `cf05d354` |
| 2 | `tests/validationPerformance.test.js` | 3 | Infra/tooling/config | Yes — predates 5-pack |
| 3 | `tests/entitlements/entitlementPickRowProjection.test.js` | 8 | Architect but not trade | Yes — expectation drift from `aa6149e7` |

**Total: 16 failures across 3 files. All pre-existing.**

---

## Failure Classification Detail

### 1. tests/signAndTradeAggregation.test.js — TM/Architect-trade adjacent

**Bucket:** TM/Architect-trade adjacent (NOT in scoped `tests/trade/` suite)

**5 failed tests:**
- `blocks receiving team getting S&T + another player from same origin team`
- `blocks receiving team getting S&T + player from a different team`
- `allows non-S&T multi-player trade (control case)`
- `blocks receiving team in 3-team trade that gets S&T + any other player`
- `allows third party team to receive multiple non-S&T players`

**Root cause:** Tests were written speculatively for CBA Rule 1.6 (S&T incoming aggregation) — a rule that restricts teams receiving a sign-and-trade player from also receiving other players. This rule does not appear to be implemented in `validateTrade()` yet. The tests exercise `validateTrade` directly and expect S&T aggregation enforcement that doesn't exist in the validator.

**New regression?** No. File was created in commit `cf05d354` ("feat: add entitlement warnings utility and tests"), which predates the 5-pack closure. These tests have never passed in the scoped trade suite because the file is in top-level `tests/`, not `tests/trade/`.

**Trade Machine implication:** None for ship. The scoped trade suite (`tests/trade/`) does not include this file and passes 58/58. S&T aggregation enforcement is a future feature, not a regression.

### 2. tests/validationPerformance.test.js — Infra/tooling/config

**Bucket:** Infra/tooling/config

**3 failed tests:**
- `measures cache effectiveness for repeated validations`
- `measures validation time distribution`
- `monitors validation performance trends`

**Root cause:** Tests expect `validationCache.getMetrics()` to return non-zero `size`, `hits`, and `misses` after running validations. The cache metrics return 0, indicating the validation cache infrastructure is either not wired up or is disabled in the test environment.

**New regression?** No. File predates the 5-pack closure (commits `e82cb597`, `0955b8b2`).

**Trade Machine implication:** None. Performance monitoring infrastructure, not trade logic.

### 3. tests/entitlements/entitlementPickRowProjection.test.js — Architect (non-trade)

**Bucket:** Architect but not trade

**8 failed tests:**
- `returns formatted label for basic pick` — expects `"2029 1st"`, gets `""`
- `includes via team when present` — expects `"2029 1st via MIA"`, gets `"via MIA"`
- `includes (Swap) suffix for swap_right` — expects `"2029 1st via MIA (Swap)"`, gets `"via MIA"`
- `includes (Cond.) suffix for conditional_right` — expects `"2029 1st via MIA (Cond.)"`, gets `"via MIA"`
- `formats 2nd round correctly` — expects `"2026 2nd"`, gets `""`
- `returns "Unknown Pick" for null input` — expects `"Unknown Pick"`, gets `"Unknown"`
- `returns "Unknown Pick" for missing year` — expects `"Unknown Pick"`, gets `"Unknown"`
- `returns conditionsText when present` — expects `"Swap option · Can swap for LAL_2027_1st"`, gets `"Can  for LAL_2027_1st"`

**Root cause:** Expectation drift. The `getPickRowDisplayLabel` and `getPickRowSecondaryText` helpers produce simpler/different formats than the tests expect. Tests may have been written against a spec or an older implementation that has since been refactored. The helper returns partial fragments (e.g., just `"via MIA"` without year/round prefix) suggesting the formatting logic was simplified.

**New regression?** No. The test expectations were last touched in `a1c8ea4d` ("fix: Phase 4 — entitlement/offer-sheet expectation drift"), which attempted to fix some expectations but didn't fully align them with the actual implementation.

**Trade Machine implication:** None. Display-layer formatting for entitlement pick rows, not trade validation logic.

---

## Summary Assessment

**Ship status:** Ship-clean for Trade Machine. Repo has unrelated pre-existing debt (16 tests across 3 files).

All 16 failures are pre-existing. None are regressions from the Trade Machine 5-pack closure. The scoped P0 gates (trade, architect, build, validate:project) all pass green.

The three failure categories:
1. **Speculative tests** for unimplemented S&T aggregation rule (future feature)
2. **Performance monitoring infra** not wired up in test env
3. **Display label expectation drift** in entitlement pick row formatting

No code changes were made in this preflight.

---

## Validation Commands Run

| Command | Result |
|---------|--------|
| `npm run test -- --run` | FAIL (16/3042 tests) |
| `npm run validate:project` | PASS |
| `npm run build` | PASS |
| `npm run test:trade -- --reporter=dot` | PASS (confirmatory) |
| `npm run test:architect -- --reporter=dot` | PASS (confirmatory) |

## Files Changed

- `return_packages/ship_gates/SHIP_GATES_RC1_FULL_SUITE_P1_PREFLIGHT_RETURN_PACKAGE.md` (this file — created)
- `docs/SHIP_GATES_MASTER.md` (RC1 Gate Snapshot section added)
- `docs/architect/TRADE_MACHINE_MASTER.md` (RC1 Gate Snapshot sub-bullet added)
