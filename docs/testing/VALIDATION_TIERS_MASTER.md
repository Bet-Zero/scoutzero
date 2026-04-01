# VALIDATION TIERS — Master Policy

**Last Updated**: 2026-04-01  
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
**Purpose**: Automatically select the narrowest safe validation scope based on changed files

**How it works**:

1. Reads changed files from git:
   - `git diff --name-only origin/main...HEAD`
   - Fallback: `git diff --name-only --cached`
   - Optional diagnostics: `--files <comma-separated-paths>` overrides git diff
   - Optional diagnostics: `--dry-run` prints the selected commands without running them
2. Ignores support-only markdown / return-package changes when selecting execution scope
3. Tries explicit narrow slices where the repo has a known audited boundary
4. Checks for Tier 3 triggers next (shared code, config, scripts, schemas)
5. Tries inferred related test files and splits them across `test:node` / `test:ui`
6. Falls back to feature suites only when targeted inference is weak
7. Executes the selected command plan

**Mapping Rules**:

- **Tier 3 (Full)** if any file matches Tier 3 triggers (see above)
- **Tier 2 (Targeted)** if changed executable files have strong related test matches
  - Runs explicit test-file lists via `npm run test:node -- ...` and/or `npm run test:ui -- ...`
  - This is now the preferred path for narrow changes inside larger domains
- **Tier 2 (Explicit Slice)** if all executable changes stay inside a mapped audited seam
  - Current explicit examples:
    - Cap Sheet mutation-boundary/dashboard action slice
    - Free Agency world/vacuum publication and gating slice
- **Tier 2 (Architect)** if inference is weak and any file under:
  - `src/features/architect/**`
  - `src/tests/architect/**`
  - `tests/architect/**`
  - `src/tests/tradeMachine/**`
- **Tier 2 (Trade)** if inference is weak and any file under:
  - `src/features/trade/**`
  - `src/tests/trade/**`
  - `tests/trade/**`
- **Tier 2 (Roster)** if inference is weak and any file under:
  - `src/features/roster/**`
  - `src/tests/roster/**`
- **Tier 2 (Scouting)** if inference is weak and any file under:
  - `src/features/scouting/**`
  - `src/tests/scouting/**`
- **Tier 1 (Fast)** — default fallback for all other changes or support-only changes

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

- Runs full test suite using Vitest's JSON reporter (`--reporter=json`)
- Parses machine-readable JSON output for reliable per-file timing
- Computes per-file duration from `startTime` / `endTime` fields
- Generates a console summary and a JSON artifact

**Output**:

- **Console**: Top 20 slowest test files with durations and percentages
- **File**: `test-performance-results.json` (saved in the project root, git-ignored)
  - `summary` — totalFiles, totalTests, totalDurationMs, avgDurationMs, medianDurationMs
  - `top20` — the 20 slowest files with `{ file, testCount, durationMs }`
  - `allFiles` — every test file with its timing data

**Duration**: 1-5 minutes (full suite)

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

### Optimization Guidance

**High-ROI improvements**:

1. Split large test files (>200 tests in one file)
2. Consolidate duplicate test suites
3. Cache test fixtures (reduce redundant data setup)
4. Add more smoke tests (expand fast tier coverage)

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

## P3: Node vs Browser Test Split (2026-02-13)

**Phase 3 deliverables**:

### What Changed

The test suite is now split into two environments to avoid loading jsdom/React for pure-logic tests:

| Command             | Environment | What it runs                                                                                       | Config file             |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------------- | ----------------------- |
| `npm run test:node` | Node        | All `.test.js` and `.test.ts` files (~197 files, ~2698 tests)                                      | `vitest.node.config.js` |
| `npm run test:ui`   | jsdom       | All `.test.jsx` / `.test.tsx` files + 6 localStorage-dependent `.ts` files (~32 files, ~306 tests) | `vitest.ui.config.js`   |
| `npm run test:full` | Both        | Runs `test:node` then `test:ui` sequentially                                                       | Both configs            |

### How Tests Are Classified

- **File extension** determines environment:
  - `.test.js` / `.test.ts` → Node (pure logic)
  - `.test.jsx` / `.test.tsx` → jsdom (component/UI)
- **Exception**: 6 `.ts` files that use `localStorage` are explicitly routed to the UI suite:
  - `src/tests/architect/wizardTranslation.test.ts`
  - `src/tests/architect/pickRightWizardDraft.test.ts`
  - `src/tests/architect/utils/freeAgencyFilterPersistence.test.ts`
  - `src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts`
  - `src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts`
  - `tests/entitlements/vacuumTradeTransfer.test.ts`
- No tests were moved or renamed — classification is purely config-based

### Tier Integration

- **Tier 1 (Fast)**: `npm run test:fast` — unchanged (smoke tests)
- **Tier 2 (Feature)**: Feature commands unchanged (`test:architect`, `test:trade`, etc.)
- **Tier 3 (Full)**: `npm run test:full` now runs node suite first, then UI suite
- **New**: `npm run test:node` can be used as a fast comprehensive check during development

### When to Use `test:node`

- Working on validators, utils, trade logic, cap calculations, contract parsing
- Quick pre-commit check (covers ~90% of tests without jsdom overhead)
- CI fast-path before running UI tests

### Performance Results

| Metric                 | Before                   | After                                      |
| ---------------------- | ------------------------ | ------------------------------------------ |
| `test:full` total time | 629.91s                  | 340.87s (208.76s + 132.11s)                |
| `test:node` time       | N/A                      | 208.76s                                    |
| `test:ui` time         | N/A                      | 132.11s                                    |
| Environment setup time | 1168.65s (jsdom for all) | 0.49s (node) + 173.13s (jsdom for UI only) |
| Total test files       | 226                      | 229 (197 node + 32 UI)                     |
| Total tests            | 2975                     | 3004 (2698 node + 306 UI)                  |
| **Speedup**            | —                        | **~46% faster**                            |

> Note: File/test count is slightly higher because the split configs pick up 6 localStorage `.ts` files
> that the baseline config collected but ran with partial failures (silently).

### Files Created/Modified

- `vitest.node.config.js` — Node-only Vitest config (new)
- `vitest.ui.config.js` — jsdom-only Vitest config (new)
- `package.json` — Added `test:node`, `test:ui`, updated `test:full`
- `docs/testing/VALIDATION_TIERS_MASTER.md` — This section

---

## Maintenance

### Adding New Feature Tests

1. Create feature directory: `src/tests/<feature>/`
2. Add feature-specific command to `package.json`: `"test:<feature>": "vitest run src/tests/<feature>"`
3. Update mapping rules in `scripts/run-tests-by-diff.mjs`
   - prefer improving inferred token/path matching first
   - add an explicit slice only when the boundary is stable and audited
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
