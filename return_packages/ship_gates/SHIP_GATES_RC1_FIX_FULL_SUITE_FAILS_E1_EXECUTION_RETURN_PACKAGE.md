# SHIP_GATES_RC1_FIX_FULL_SUITE_FAILS_E1 — EXECUTION RETURN PACKAGE

Date: 2026-02-26
Mode: EXECUTION

---

## Summary

Resolved the 3 pre-existing node-layer test failures identified in the RC1 preflight. All P0 scoped gates and the full node-layer test suite are now green. No trade logic was changed.

Additionally discovered that the UI test layer (`vitest.ui.config.js`) has 6 pre-existing failing files (27 tests) that were previously masked because the node-layer failures caused the sequential `npm run test` to stop before reaching UI tests. These UI failures are unrelated to trade/architect shipped scope and pre-date the 5-pack closure.

---

## Changes by Task

### Task A — Fix entitlement pick-row formatting (implementation-first)

**File changed:** `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`

**`getPickRowDisplayLabel`** — Rewrote to include year, round, via team, and kind suffix in the label string:
- `"2029 1st"` / `"2026 2nd"` from year + round
- `"2029 1st via MIA"` when `via` is set
- `"2028 1st (Swap)"` for `swap_right` asset type
- `"2029 1st via MIA (Cond.)"` for `conditional_right` asset type
- `"Unknown Pick"` for null input or missing year (was `"Unknown"`)

**Why this is truthful:** The previous implementation intentionally excluded year/round/suffix (treated as separate UI elements rendered by the row component). The test spec represents the canonical display intent. Aligning the helper to the spec means the label is self-contained and usable in any rendering context (trade receipts, summaries, exports).

**`getPickRowSecondaryText`** — Simplified to stop stripping "Swap option" from protection text and stop stripping "swap" from conditions text:
- `protectionText: 'Swap option'` is now included (was filtered out)
- `conditionsText` is passed through verbatim (was aggressively stripped of "swap" substrings, causing `"Can swap for LAL_2027_1st"` → `"Can  for LAL_2027_1st"`)
- Removed `termsShort` pre-check to avoid double-reporting

**Why this is truthful:** The swap-stripping was intended to avoid redundancy with kind badges, but it mutilated condition strings. The test expectations represent correct user-facing output.

**Acceptance:** `tests/entitlements/entitlementPickRowProjection.test.js` — all 38 tests pass, 0 skipped.

---

### Task B — Make validationPerformance tests opt-in

**File changed:** `tests/validationPerformance.test.js`

**Change:** Added `RUN_PERF_TESTS` env flag gating. The top-level `describe` block uses `describe.skip` when `process.env.RUN_PERF_TESTS !== '1'`. When the flag is set, tests run as before and assert meaningful cache/performance metrics.

**Why this is truthful:** The performance tests depend on validation cache infrastructure that is not wired in the test environment. Rather than removing the tests or faking the metrics, gating them as opt-in preserves the harness for when the cache is properly wired. The tests are not silently removed — they show as "skipped" in test output with a clear skip reason.

**Acceptance:** Default `npm run test:node` passes with 1 skipped file (this one). Setting `RUN_PERF_TESTS=1` would re-enable the tests.

---

### Task C — Defuse speculative S&T aggregation tests

**File changed:** `tests/signAndTradeAggregation.test.js`

**Changes:**
1. Converted 5 failing tests to `it.todo()` with descriptive labels:
   - 2 incoming aggregation tests (Rule 1.6 — 2-team scenarios)
   - 1 3-team incoming aggregation test (Rule 1.6 + missing routing fixtures)
   - 1 complex 3-team S&T aggregation test (Rule 1.6 + missing routing fixtures)
   - 1 third-party 3-team test (missing routing fixtures)

2. Fixed the 2-team control test fixture: reduced `rosterSize` from 14 to 13 (adding 2 players gave 16, exceeding MAX_ROSTER=15), added `tradeCtx: { offseason: true }`.

3. Active tests retained (4 passing):
   - Baseline valid S&T (1-for-1)
   - Outgoing aggregation Rule 1.5 (blocks origin sending S&T + other)
   - S&T with picks alongside (allowed)
   - Non-S&T multi-player control (legal — now with correct roster counts)

4. Added "Future / Deferred" section to `TRADE_MACHINE_MASTER.md` documenting Rule 1.6 TODO.

**Why this is truthful:** Rule 1.6 (S&T incoming aggregation restriction) is not implemented in the validator. The tests were speculative — written ahead of the rule. Converting to `test.todo()` preserves the intent and makes it machine-discoverable. The 3-team fixtures also had missing `toTeamId` routing, which is a separate fixture bug. The control test roster overflow was a genuine fixture bug (14 base + 2 pushed = 16 > MAX_ROSTER 15).

**Acceptance:** File contributes 4 passed + 5 todo + 0 failed to the test run.

---

### Task D — Doc sync

**Files changed:**
- `docs/SHIP_GATES_MASTER.md` — Added "RC1.1 Gate Snapshot — 2026-02-26" section with all command results, explanation of newly-discovered UI test debt, and perf test opt-in note.
- `docs/architect/TRADE_MACHINE_MASTER.md` — Added "RC1.1 Gate Snapshot" sub-bullet confirming no trade logic changes, and "Future / Deferred" section documenting S&T Rule 1.6 TODO.

---

## Validation Outputs

### Node layer (all green)

```
npm run test:node -- --reporter=dot
  Test Files  232 passed | 1 skipped (233)
       Tests  3025 passed | 9 skipped | 8 todo (3042)
```

### Trade suite

```
npm run test:trade -- --reporter=dot
  Test Files  58 passed (58)
       Tests  525 passed | 1 skipped | 3 todo (529)
```

### Architect suite

```
npm run test:architect -- --reporter=dot
  Test Files  136 passed (136)
       Tests  2206 passed | 1 skipped | 3 todo (2210)
```

### Build

```
npm run build
  ✓ 3053 modules transformed
  ✓ built in 2m 20s
```

### Validate project

```
npm run validate:project
  ✅ All validations passed!
```

### Full suite (node + UI combined)

```
npm run test -- --run
  Node:  232 passed | 1 skipped (233) — GREEN
  UI:    6 failed | 28 passed (34) — 6 pre-existing failures
  Combined: FAIL (UI layer debt)
```

---

## Newly Discovered: UI Test Layer Debt (6 files, 27 tests)

The `npm run test` script runs `vitest.node.config.js` then `vitest.ui.config.js` sequentially. The RC1 preflight's node-layer failures caused the second command to never run. Fixing node tests revealed these pre-existing UI failures:

| File | Failed | Classification |
|------|--------|----------------|
| `src/tests/architect/wizardTranslation.test.ts` | 4 | Architect UI — wizard label/preset mismatches |
| `src/tests/architect/pickRightWizard.test.tsx` | 6 | Architect UI — wizard `data-testid` changes |
| `src/tests/architect/pickRightWizard.vacuumApply.test.tsx` | 10 | Architect UI — vacuum mode apply test mismatches |
| `src/tests/architect/quickBuilder.test.tsx` | 4 | Architect UI — quick builder `data-testid` changes |
| `src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx` | 2 | Architect UI — vacuum badge text not rendering (mocks projection module; unaffected by Task A) |
| `tests/RankingSetup.test.jsx` | 1 | Non-Architect — missing `data-testid="top-tier"` |

**Trade Machine implication:** None. These are UI component rendering tests, not trade validation logic. The `entitlementPickRow.vacuumBadges.test.jsx` mocks the projection module entirely (lines 14-24) so my changes to `getPickRowDisplayLabel`/`getPickRowSecondaryText` have zero effect on it.

**Recommendation:** These should be addressed in a follow-up UI test cleanup pass. They do not block shipping per SHIP_GATES_MASTER triage rules (P1 failures not touching shipped scope).

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/architect/utils/entitlements/entitlementPickRowProjection.js` | Task A: fixed `getPickRowDisplayLabel` and `getPickRowSecondaryText` |
| `tests/validationPerformance.test.js` | Task B: gated behind `RUN_PERF_TESTS=1` env flag |
| `tests/signAndTradeAggregation.test.js` | Task C: 5 tests → `test.todo()`, control test fixture fixed |
| `docs/SHIP_GATES_MASTER.md` | Task D: RC1.1 snapshot added |
| `docs/architect/TRADE_MACHINE_MASTER.md` | Task D: RC1.1 bullet + Future/Deferred section added |
| `return_packages/ship_gates/SHIP_GATES_RC1_FIX_FULL_SUITE_FAILS_E1_EXECUTION_RETURN_PACKAGE.md` | This file |

**Trade Machine status: CLEAN — no trade logic changes made.**
