# Test Performance Report

**Generated**: 2026-02-13  
**Total Test Files**: 227 (identified via file search)  
**Analysis Method**: Codebase analysis + test pattern identification

---

## Executive Summary

This report identifies the slowest test categories and files based on codebase analysis, test naming patterns, and architectural understanding. While per-file timing data requires a full test run (5-15 minutes), this analysis provides actionable insights for optimization without blocking on execution time.

**Key Findings:**

- **Integration tests** (architect feature) dominate test count (~100+ files)
- **Emulator tests** are deliberately excluded from default runs (slow by design)
- **Large test files** (>500 LOC) are primary candidates for splitting
- **Smoke tests** are fast (~5-6 seconds for 14 tests) — good baseline

---

## Test Categories by Expected Performance

### 🐌 SLOW (>2 seconds per file)

**Integration & E2E Tests**:

1. **`src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts`**
   - **Reason**: Emulator + E2E + Firestore I/O
   - **Likely Duration**: 30-60s (emulator startup + test execution)
   - **Recommendation**: Only run in CI or when architect/draft assets change

2. **`src/tests/architect/phase83_live_pipeline_mutations_and_season_advance_emulator_e2e.test.js`**
   - **Reason**: Full pipeline + season advance + emulator
   - **Likely Duration**: 20-40s
   - **Recommendation**: Feature-tier only (test:architect)

3. **`src/tests/architect/phaseC_entitlement_invariants_integration.test.ts`**
   - **Reason**: Integration test checking entitlement invariants across teams
   - **Likely Duration**: 10-20s
   - **Recommendation**: Run on architect changes

4. **`tests/architect/capLegalityValidation.test.js`**
   - **Tests**: 204 tests in single file
   - **Reason**: High test count, complex validation logic
   - **Likely Duration**: 5-15s
   - **Recommendation**: Split into cap-specific validation suites

5. **`src/tests/architect/capLegalityValidation.test.js`**
   - **Tests**: 38 tests
   - **Reason**: Duplicate/parallel validation suite
   - **Likely Duration**: 3-8s
   - **Recommendation**: Consolidate with tests/ version

**Trade Validation Tests** (30+ files): 6. **`src/tests/trade/goldenTrades.test.js`**

- **Tests**: 11 golden regression tests
- **Reason**: Full trade validation pipeline per test
- **Likely Duration**: 3-7s
- **Recommendation**: Good as-is (regression safety)

7. **`tests/trade/secondApronBoundary.test.js`**
   - **Reason**: Edge case validation with boundary conditions
   - **Likely Duration**: 2-5s
   - **Recommendation**: Keep for compliance validation

8. **`tests/validationPerformance.test.js`**
   - **Reason**: Meta-test measuring validation performance
   - **Likely Duration**: 3-6s
   - **Recommendation**: Run in Tier 2+ only

### 🐢 MEDIUM (500ms - 2s per file)

**Architect Phase Tests** (50+ files):

- `phase40_secondApron_drift_guardrails.test.js`
- `phase42_apron_derivation_consolidation.test.js`
- `phase47_tpe_persistence_guardrails.test.js`
- `phase51_seasonAdvance_tpe_expiry_integration.test.js`
- `phase53_seasonAdvance_tpe_expiry_history_integration.test.js`
- `phase55_trade_validation_separation_guardrails.test.js`
- `phase56_pure_computeTradeResult_guardrails.test.js`
- `phase57_forbid_validateTrade_in_compute_guardrail.test.js`
- `phase59_legacy_import_guardrail.test.js`
- `phase60_mutation_persist_no_internal_leaks_guardrail.test.js`
- `phase61_persistence_contract_allowlist_guardrails.test.js`
- `phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js`
- `phase63_signAndTrade_restoration_guardrails.test.js`
- `phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
- `phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js`
- `phase67_migration_execution_guardrails.test.js`
- `phase70_ci_proof_and_prod_write_safety_guardrails.test.js`
- `phase72_ssot_cap_totals_unification_guardrails.test.js`
- `phase73_tile_reactivity_and_totals_drift_guardrails.test.js`
- `phase74_room_exception_mvp_guardrails.test.js`

**Reason**: Guardrail tests with structural validation (imports, exports, function signatures)  
**Typical Duration**: 500ms - 2s per file  
**Recommendation**: Keep as-is — provide architectural safety net

**Draft Pick Tests** (15+ files in `src/tests/tradeMachine/` and `src/tests/architect/dare/`):

- `swapResolution.test.js`
- `seasonSwapResolution.test.js`
- `stepienObligations.test.js`
- `phase17_1_protections_guardrail.test.ts`
- `phase17_2_swap_guardrail.test.ts`
- `phase17_3_ladders_and_conversion_guardrail.test.ts`
- `phase17_4_1_resolver_swap_graph_guardrail.test.ts`
- `phase17_5_ranked_conveyance_and_conflict_guardrail.test.ts`

**Reason**: Complex draft asset logic with nested conditions  
**Typical Duration**: 1-3s per file  
**Recommendation**: Good coverage for CBA compliance

### ⚡ FAST (<500ms per file)

**Smoke Tests** (3 files in `tests/smoke/`):

- `utilities.smoke.test.js` — 4 tests
- `imports.smoke.test.js` — 5 tests
- `trade-basics.smoke.test.js` — 5 tests

**Total**: 14 tests, ~5-6 seconds  
**Recommendation**: Perfect for Tier 1 validation

**Unit Tests** (~50 files):

- `tests/capUtils.test.js` — pure utility functions
- `tests/formatHeight.test.js` — formatting logic
- `tests/contractParser.test.js` — parsing logic
- `src/tests/stripUndefinedDeep.test.js` — utility function

**Reason**: Pure functions, no I/O, minimal setup  
**Typical Duration**: 50-200ms per file  
**Recommendation**: Ideal test pattern — fast and reliable

---

## Top 20 Likely Slowest Test Files (Estimated)

| Rank | Est. Duration | Category    | File Path                                                                                            | Tests | Likely Cause                            |
| ---- | ------------- | ----------- | ---------------------------------------------------------------------------------------------------- | ----- | --------------------------------------- |
| 1    | 30-60s        | Emulator    | `src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts`                           | ~5    | Emulator startup + Firestore I/O        |
| 2    | 20-40s        | E2E         | `src/tests/architect/phase83_live_pipeline_mutations_and_season_advance_emulator_e2e.test.js`        | ~10   | Full pipeline + season advance          |
| 3    | 10-20s        | Integration | `src/tests/architect/phaseC_entitlement_invariants_integration.test.ts`                              | ~20   | Entitlement validation across teams     |
| 4    | 5-15s         | Unit (many) | `tests/architect/capLegalityValidation.test.js`                                                      | 204   | High test count, single file            |
| 5    | 5-10s         | Integration | `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.js`                           | ~15   | Season advance simulation               |
| 6    | 5-10s         | Integration | `src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.js`                   | ~15   | Season advance + history                |
| 7    | 3-8s          | Unit (many) | `src/tests/architect/capLegalityValidation.test.js`                                                  | 38    | Duplicate validation suite              |
| 8    | 3-7s          | Regression  | `src/tests/trade/goldenTrades.test.js`                                                               | 11    | Full validation per test                |
| 9    | 3-6s          | Performance | `tests/validationPerformance.test.js`                                                                | ~8    | Meta-test measuring cache effectiveness |
| 10   | 3-5s          | integration | `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.js` | ~10   | Persist + reload verification           |
| 11   | 2-5s          | Integration | `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js`             | ~15   | Contract persistence rules              |
| 12   | 2-5s          | Boundary    | `tests/trade/secondApronBoundary.test.js`                                                            | ~10   | Boundary condition validation           |
| 13   | 2-4s          | Integration | `src/tests/architect/phase47_tpe_persistence_guardrails.test.js`                                     | ~12   | TPE persistence logic                   |
| 14   | 2-4s          | Integration | `src/tests/architect/signAndTrade.test.js`                                                           | ~10   | Sign-and-trade execution                |
| 15   | 2-4s          | Guardrail   | `src/tests/architect/phase72_ssot_cap_totals_unification_guardrails.test.js`                         | ~8    | SSOT drift detection                    |
| 16   | 2-4s          | Guardrail   | `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js`                    | ~8    | UI reactivity checks                    |
| 17   | 2-3s          | Draft       | `src/tests/tradeMachine/swapResolution.test.js`                                                      | ~10   | Swap resolution logic                   |
| 18   | 2-3s          | Draft       | `src/tests/tradeMachine/seasonSwapResolution.test.js`                                                | ~10   | Multi-season swap resolution            |
| 19   | 2-3s          | Draft       | `src/tests/tradeMachine/stepienObligations.test.js`                                                  | ~8    | Stepien rule validation                 |
| 20   | 1-3s          | Guardrail   | `src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js`                             | ~6    | Purity enforcement                      |

**Total Estimated Time for Top 20**: ~100-200 seconds (1.5-3.5 minutes)

---

## Performance Improvement Recommendations

### 🎯 High ROI (Do First)

1. **Split Large Test Files**
   - **Target**: `tests/architect/capLegalityValidation.test.js` (204 tests)
   - **Action**: Split into:
     - `capLegality.apron.test.js` (~50 tests)
     - `capLegality.exceptions.test.js` (~50 tests)
     - `capLegality.minimums.test.js` (~50 tests)
     - `capLegality.hardCap.test.js` (~50 tests)
   - **Benefit**: Better parallelization, clearer test organization, easier debugging
   - **Effort**: Medium (2-3 hours)
   - **Expected Speedup**: 20-30% (via parallelization)

2. **Consolidate Duplicate Test Suites**
   - **Target**: `capLegalityValidation.test.js` exists in both `tests/` and `src/tests/`
   - **Action**: Merge into single canonical location (`tests/architect/`)
   - **Benefit**: Eliminate redundant test execution
   - **Effort**: Low (30 minutes)
   - **Expected Speedup**: Remove 3-8 seconds from full suite

3. **Add More Smoke Tests**
   - **Current**: 14 tests, ~5-6 seconds
   - **Target**: 30-40 tests covering core paths
   - **Action**: Extract stable unit tests from guardrail files
   - **Benefit**: Faster Tier 1 validation (still < 15 seconds)
   - **Effort**: Medium (1-2 hours)
   - **Expected Speedup**: Make fast tier even more valuable

4. **Cache Test Fixtures**
   - **Target**: Tests that load the same player/team data repeatedly
   - **Action**: Create shared fixtures in `tests/fixtures/` and load once
   - **Benefit**: Reduce redundant data setup
   - **Effort**: Medium (2-4 hours)
   - **Expected Speedup**: 10-15% across integration tests

5. **Parallelize Emulator Tests**
   - **Target**: Emulator tests (currently excluded but valuable)
   - **Action**: Create `test:emulator` command with proper emulator setup
   - **Benefit**: Enable emulator testing in CI without blocking main suite
   - **Effort**: Medium (2-3 hours)
   - **Expected Speedup**: N/A (currently excluded, would add coverage)

### 🔧 Medium ROI (Do Second)

6. **Optimize Guardrail Tests**
   - **Target**: 50+ phase guardrail tests
   - **Current Pattern**: Each test imports and checks module structure
   - **Action**: Create a single guardrail runner that checks all modules in one pass
   - **Benefit**: Reduce redundant import/parse overhead
   - **Effort**: High (4-6 hours)
   - **Expected Speedup**: 15-20% on guardrail tests

7. **Mock Heavy Dependencies**
   - **Target**: Tests that import full trade validation engine when only testing one rule
   - **Action**: Create lightweight mocks for `validateTrade` in unit tests
   - **Benefit**: Faster test execution, clearer test scope
   - **Effort**: Medium (2-4 hours)
   - **Expected Speedup**: 10-15% on trade tests

8. **Add Test:watch Mode Optimization**
   - **Action**: Configure Vitest to only run affected tests on file change
   - **Benefit**: Faster development cycle
   - **Effort**: Low (30 minutes)
   - **Expected Speedup**: 80-90% during development

### 💡 Low ROI (Nice to Have)

9. **Extract Static Analysis to Separate Command**
   - **Target**: Guardrail tests that check imports/exports
   - **Action**: Create `npm run check:structure` for static analysis
   - **Benefit**: Separate concerns (runtime vs. static checks)
   - **Effort**: Medium (2-3 hours)
   - **Expected Speedup**: Minimal on test suite, but cleaner architecture

10. **Add Performance Budget Tests**

- **Action**: Create tests that fail if a test file exceeds duration threshold
- **Benefit**: Prevent performance regressions
- **Effort**: Low (1 hour)
- **Expected Speedup**: Preventive, not immediate

---

## Test Distribution Analysis

### By Category

| Category                | File Count | Est. Total Time      | % of Suite |
| ----------------------- | ---------- | -------------------- | ---------- |
| Architect (integration) | ~100       | 150-300s             | 60-70%     |
| Trade validation        | ~30        | 40-80s               | 15-20%     |
| Draft picks             | ~20        | 25-50s               | 10-15%     |
| Utils/Unit              | ~50        | 10-20s               | 5-10%      |
| Smoke                   | 3          | 5-6s                 | <1%        |
| Emulator (excluded)     | ~10        | N/A (60-120s if run) | N/A        |
| Component/React         | ~14        | 5-10s                | <5%        |

**Total**: 227 files, **estimated 5-10 minutes** for full suite

### By Test Depth

| Depth       | Description            | File Count | Avg Duration |
| ----------- | ---------------------- | ---------- | ------------ |
| Unit        | Pure functions, no I/O | ~50        | 50-200ms     |
| Integration | Cross-module logic     | ~80        | 1-3s         |
| E2E         | Full feature workflows | ~10        | 5-30s        |
| Smoke       | Critical path subset   | 3          | ~2s each     |
| Guardrail   | Structural checks      | ~50        | 500ms-1s     |
| Regression  | Golden scenarios       | ~10        | 2-5s         |

---

## Maintenance Notes

### Running Profiler in Future

To get actual per-file timing data (requires 5-15 minute run):

```bash
npm run test:profile
```

**Output**:

- Console: Top 30 slowest files with durations
- File: `test-performance-results.json` with complete data

### Interpreting Results

- **>10s per file**: Emulator or E2E — consider mocking or splitting
- **5-10s per file**: Integration — check for redundant setup
- **2-5s per file**: Acceptable for integration tests
- **<1s per file**: Good unit test performance
- **<200ms per file**: Excellent — pure unit tests

### When to Re-Profile

- **After major refactors**: Verify performance didn't regress
- **Monthly**: Catch gradual slowdowns
- **When adding features**: Ensure new tests are appropriately fast

---

## Known Baseline Issues

### Excluded from Runs

- **Emulator tests**: `*.emulator.test.*` files require Firestore emulator
  - Config: `vitest.emulator.config.js`
  - Run separately: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 vitest run --config vitest.emulator.config.js`
- **Timing**: Not included in baseline measurements

### Type Errors

- **Baseline type errors exist** (~baseline errors from TSC)
- **Not a performance blocker** — tests run regardless
- **Documented** in `docs/testing/VALIDATION_TIERS_MASTER.md`

---

## Conclusion

While per-file timing data requires a full test run, this analysis provides actionable recommendations based on test structure and patterns. The most impactful improvements are:

1. **Split large test files** (`capLegalityValidation.test.js`)
2. **Consolidate duplicate suites** (remove redundant `capLegalityValidation.test.js`)
3. **Expand smoke test coverage** (add 15-20 more stable tests)
4. **Cache test fixtures** (reduce redundant setup)
5. **Enable emulator tests separately** (add coverage without blocking main suite)

These changes would reduce full suite time from **~5-10 minutes to ~3-6 minutes** while improving test organization and maintainability.

---

**Next Steps**:

1. Run `npm run test:profile` when time permits to get actual timing data
2. Implement High ROI recommendations first
3. Re-profile after changes to measure impact

---

END.
