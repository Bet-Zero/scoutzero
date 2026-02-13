# VALIDATION TIERS — Master Policy

**Last Updated**: 2026-02-13  
**Status**: Active  
**Owner**: Repo-wide (Architect-focused, applicable to all features)

## Purpose

This document defines the **tiered validation system** for ScoutZero/HoopZero. The goal is to make validation **fast by default** while ensuring comprehensive coverage when necessary.

## Discovery Summary

**Test Runner**: Vitest  
**Test Locations**:

- `tests/` — Root-level tests (trade, cap utils, contracts, etc.)
- `src/tests/` — Feature-organized tests (architect, tradeMachine, roster, scouting, entitlements)

**CI**: `.github/workflows/ci.yml` runs full test suite on PRs and pushes  
**Other Validation Tools**:

- `npm run typecheck` — TypeScript type checking
- `npm run validate:project` — Project schema validation
- `npm run build` — Production build (Vite)

## Validation Tiers

### Tier 1: Fast (Default)

**Purpose**: Catch obvious breakage quickly (< 30 seconds)  
**Command**: `npm run test:fast`  
**What it runs**:

- Smoke tests only (`tests/smoke/**`)
- Quick sanity checks for core utilities
- Component render tests (no crashing)

**Test count**: 14 tests (3 files)  
**Duration**: ~5-6 seconds

**When to use**:

- Default pre-commit check
- Quick validation during active development
- Iterating on isolated features

**Exit criteria**: All smoke tests pass

---

### Tier 2: Feature-Scoped (Architect, Trade, Roster, etc.)

**Purpose**: Validate a specific feature domain (< 2 minutes)  
**Commands**:

- `npm run test:architect` — Architect feature tests
- `npm run test:trade` — Trade machine tests
- `npm run test:roster` — Roster tests
- `npm run test:scouting` — Scouting tests

**What each runs**:

- `test:architect` → `tests/architect/**` + `src/tests/architect/**` + `src/tests/tradeMachine/**`
- `test:trade` → `tests/trade/**` + core trade validation tests
- `test:roster` → `src/tests/roster/**`
- `test:scouting` → `src/tests/scouting/**`

**When to use**:

- Working on a specific feature
- Pre-PR validation for feature changes
- After modifying feature-specific utilities

**Exit criteria**: All tests in the feature scope pass

---

### Tier 3: Full Suite (Comprehensive)

**Purpose**: Complete validation before merging critical changes  
**Command**: `npm run test:full`  
**What it runs**:

- All tests in `tests/**` and `src/tests/**`
- Includes emulator tests (if `*.emulator.test.*` files exist and emulator is running)

**When to use** (Tier 3 Triggers):

- Changes in shared/global code:
  - `src/components/shared/**`
  - `src/lib/**`
  - `src/hooks/**` (global hooks)
  - `src/stores/**` (global state)
- Schema/type changes:
  - `src/schemas/**`
  - `src/types/**`
  - Any `*.d.ts` files
- Config changes:
  - `vite.config.js`
  - `vitest.config.js`
  - `tsconfig.json`
  - `package.json` (dependencies)
- Build/CI changes:
  - `.github/workflows/**`
  - Any build scripts
- Before merging to `main`
- Nightly/scheduled CI runs

**Exit criteria**: All tests pass (including any baseline-allowed failures documented elsewhere)

---

## Diff-Based Test Runner

**Command**: `npm run test:diff`  
**Purpose**: Automatically select the appropriate tier based on changed files

**How it works**:

1. Reads changed files from git:
   - `git diff --name-only origin/main...HEAD`
   - Fallback: `git diff --name-only --cached`
2. Maps paths to test commands using the trigger rules above
3. Executes the appropriate tier

**Mapping Rules**:

- **Tier 3 (Full)** if any file matches Tier 3 triggers (see above)
- **Tier 2 (Architect)** if any file under:
  - `src/features/architect/**`
  - `src/tests/architect/**`
  - `tests/architect/**`
  - `src/tests/tradeMachine/**`
- **Tier 2 (Trade)** if any file under:
  - `src/features/trade/**`
  - `src/tests/trade/**`
  - `tests/trade/**`
- **Tier 2 (Roster)** if any file under:
  - `src/features/roster/**`
  - `src/tests/roster/**`
- **Tier 2 (Scouting)** if any file under:
  - `src/features/scouting/**`
  - `src/tests/scouting/**`
- **Tier 1 (Fast)** — default fallback for all other changes

---

## Additional Validation Commands

These are **not part of the tier system** but should be run in combination:

### Type Checking

**Command**: `npm run typecheck`  
**What**: TypeScript type checking (no emit)  
**When**: Always run before committing (or use in CI)

### Project Schema Validation

**Command**: `npm run validate:project`  
**What**: Validates project structure against `project.schema.json`  
**When**: After structural changes (new files/folders)

### Build Validation

**Command**: `npm run build`  
**What**: Production build (Vite)  
**When**: Before PRs, after significant changes

### Lint

**Command**: `npm run lint`  
**What**: ESLint (note: ~1888 baseline errors exist)  
**When**: On changed files only (not repo-wide)

---

## CI/CD Integration

### Current CI (`.github/workflows/ci.yml`)

- Runs on PRs and pushes to `main`
- Executes: `npm run test -- --run` (full suite)
- Continues on typecheck errors (known baseline issues)

### Recommended Enhancements

1. **PR Workflow**: Use `npm run test:diff` instead of full suite
2. **Nightly Workflow**: Run `npm run test:full` on a schedule
3. **Lint**: Run only on changed files in PRs

---

## Smoke Test Suite Guidelines

**Location**: `tests/smoke/` and `src/tests/smoke/`  
**Size**: 5–15 tests max  
**Execution Time**: < 30 seconds total

**What to include**:

- Key routes/components render without crashing
- Core utility functions (cap calculations, contract parsing)
- Critical data transformations
- Basic validation rules

**What to exclude**:

- Edge cases (belong in feature tests)
- Integration tests (belong in feature tests)
- Slow tests (> 2 seconds per test)

---

## Usage Examples

### During Development

```bash
# Quick check while coding
npm run test:fast

# Feature-specific validation
npm run test:architect

# Before committing
npm run test:diff
npm run typecheck
npm run build
```

### Pre-PR Checklist

```bash
# Automatic tier selection
npm run test:diff

# Type checking
npm run typecheck

# Schema validation (if structural changes)
npm run validate:project

# Build validation
npm run build
```

### Full Validation (CI or critical changes)

```bash
npm run test:full
npm run typecheck
npm run validate:project
npm run build
```

---

## Profiling & Speed

### Test Performance Analysis

**Command**: `npm run test:profile`  
**Purpose**: Identify slowest test files to guide optimization efforts

**What it does**:

- Runs full test suite with verbose output
- Parses per-file timing information
- Generates performance report

**Output**:

- **Console**: Top 30 slowest test files with durations and percentages
- **File**: `test-performance-results.json` (detailed machine-readable data)

**Duration**: 5-15 minutes (full suite)

**When to run**:

- After major refactors (verify no performance regression)
- Monthly (catch gradual slowdowns)
- When adding new features (ensure new tests are appropriately fast)

**Interpreting results**:

- **>10s per file**: Emulator or E2E tests — consider mocking or splitting
- **5-10s per file**: Integration tests — check for redundant setup
- **2-5s per file**: Acceptable for integration tests
- **<1s per file**: Good unit test performance
- **<200ms per file**: Excellent — pure unit tests

**Performance report**: See `return_packages/testing/TEST_PERF_REPORT.md` for analysis and optimization recommendations.

### Optimization Guidance

**High-ROI improvements**:

1. Split large test files (>200 tests in one file)
2. Consolidate duplicate test suites
3. Cache test fixtures (reduce redundant data setup)
4. Add more smoke tests (expand fast tier coverage)

See performance report for detailed recommendations.

---

## P2: Smoke Cleanup + Profiling (2026-02-13)

**Phase 2 deliverables**:

1. **Canonicalized smoke suite location**:
   - All smoke tests now in `tests/smoke/**` only (removed redundant `src/tests/smoke` path reference)
   - `npm run test:fast` now points to single canonical directory

2. **Test profiler added**:
   - New command: `npm run test:profile`
   - Implementation: `scripts/analyze-test-performance.mjs`
   - Outputs: Console summary + `test-performance-results.json`

3. **Performance report generated**:
   - File: `return_packages/testing/TEST_PERF_REPORT.md`
   - Contains: Top 20 slowest files (estimated), optimization recommendations, test distribution analysis

**Files modified**:

- `package.json` — Fixed `test:fast`, added `test:profile`
- `scripts/analyze-test-performance.mjs` — New profiler script
- `docs/testing/VALIDATION_TIERS_MASTER.md` — This file (added P2 section + profiling guidance)

**Validation**:

- `npm run test:fast` — ✅ Passes (5.16s, 14 tests)
- `npm run test:profile` — ✅ Script implemented (requires full run for timing data)
- Performance report delivered with recommendations

---

## Maintenance

### Adding New Feature Tests

1. Create feature directory: `src/tests/<feature>/`
2. Add feature-specific command to `package.json`: `"test:<feature>": "vitest run src/tests/<feature>"`
3. Update mapping rules in `scripts/run-tests-by-diff.mjs`
4. Update this doc with the new tier 2 command

### Adjusting Tier 3 Triggers

- Edit the "Tier 3 Triggers" list above
- Update `scripts/run-tests-by-diff.mjs` trigger patterns
- Document the change in this file

---

## Files Modified/Created by This System

### Created

- `docs/testing/VALIDATION_TIERS_MASTER.md` (this file)
- `scripts/run-tests-by-diff.mjs`
- `tests/smoke/` (if needed)
- `src/tests/smoke/` (if needed)

### Modified

- `package.json` (added test:fast, test:architect, test:full, test:diff, etc.)
- `.github/workflows/ci.yml` (optional - use test:diff for PRs)

---

## Known Issues / Baseline State

- **TypeScript**: ~baseline type errors exist (CI continues on error)
- **ESLint**: ~1888 baseline lint errors exist (do not attempt repo-wide fixes)
- **Emulator Tests**: `*.emulator.test.*` files excluded by default (require Firestore emulator)

---

## Questions / Issues

If validation behavior is unclear:

1. Check this doc for tier definitions
2. Run `npm run test:diff` to see what would be selected
3. Consult `scripts/run-tests-by-diff.mjs` for exact mapping logic

---

END.
