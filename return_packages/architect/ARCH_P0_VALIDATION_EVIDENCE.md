# ARCH P0 Validation Evidence

## Executive Summary
- Validation command suite was executed on commit `0cb0b53c` with logs captured under `return_packages/architect/_logs/` and indexed in `return_packages/architect/_logs/p0_validation_runs_20260213_235433_finish.tsv`.
- `build` and full `test` passed; `lint` and `typecheck` failed; `validate:project` failed in this sandbox due `tsx` IPC `EPERM` but the same validator script passed via `node --import tsx` fallback.
- Architect impact: runtime build/test coverage is strong, but static quality gates are not clean; one Architect source type error exists in `src/features/architect/utils/entitlements/entitlementResolver.ts:97`.

## Environment and Commit Baseline
- Repository: `/Users/brenthibbitts/Desktop/ScoutZero`
- Commit (audit head): `0cb0b53c` (`git rev-parse --short HEAD`)
- Audit timestamp (UTC): `2026-02-14T00:05:46Z`
- Worktree snapshot (`git status --short` at audit time):
  - `M return_packages/architect/_logs/p0_validation_runs_20260213_1352.tsv`
  - `?? return_packages/architect/ARCH_P0_PREFLIGHT_REALITY_MAP.md`
  - `?? return_packages/architect/_logs/p0_validation_runs_20260213_235433_finish.tsv`

## Command Run Log
Source index: `return_packages/architect/_logs/p0_validation_runs_20260213_235433_finish.tsv`

| Command | Start UTC | End UTC | Duration (s) | Exit Code | Result | Log |
| --- | --- | --- | --- | --- | --- | --- |
| `npm run validate:project` | 2026-02-13T23:54:39Z | 2026-02-13T23:54:39Z | 0 | 1 | `FAIL` (`tsx` IPC EPERM in sandbox) | `return_packages/architect/_logs/p0_validate_project_20260213_235433_finish.log` |
| `npm run build` | 2026-02-13T23:54:46Z | 2026-02-13T23:55:13Z | 27 | 0 | `PASS` | `return_packages/architect/_logs/p0_build_20260213_235433_finish.log` |
| `npm run test -- --run` | 2026-02-13T23:55:20Z | 2026-02-13T23:58:13Z | 173 | 0 | `PASS` | `return_packages/architect/_logs/p0_test_20260213_235433_finish.log` |
| `npm run lint` | 2026-02-13T23:58:19Z | 2026-02-13T23:59:02Z | 43 | 1 | `FAIL` (`2968` errors, `9` warnings) | `return_packages/architect/_logs/p0_lint_20260213_235433_finish.log` |
| `npm run typecheck` | 2026-02-13T23:59:09Z | 2026-02-13T23:59:20Z | 11 | 2 | `FAIL` (TS errors in source + tests) | `return_packages/architect/_logs/p0_typecheck_20260213_235433_finish.log` |
| `node --import tsx scripts/validate-project-schema.ts` | 2026-02-13T23:59:27Z | 2026-02-13T23:59:28Z | 1 | 0 | `PASS` (fallback validator run) | `return_packages/architect/_logs/p0_validate_project_20260213_235433_finish_node_import_tsx.log` |

## Failure Details and Severity Classification

### 1) `npm run validate:project` (`SEV-3`)
- Status: `FAIL` (environment/sandbox execution issue)
- Error excerpt (log): `listen EPERM: operation not permitted ... /tmp/tsx-...pipe`
- Evidence: `return_packages/architect/_logs/p0_validate_project_20260213_235433_finish.log`
- Severity rationale: does not indicate Architect product logic failure; script succeeded via fallback command in same workspace.

### 2) `npm run lint` (`SEV-3`)
- Status: `FAIL`
- Summary: `✖ 2977 problems (2968 errors, 9 warnings)`
- Evidence: `return_packages/architect/_logs/p0_lint_20260213_235433_finish.log`
- Severity rationale: repository-wide lint debt (expected in project guidance), not a direct “cannot run/build” blocker.

### 3) `npm run typecheck` (`SEV-2`)
- Status: `FAIL`
- Architect-relevant source error:
  - `src/features/architect/utils/entitlements/entitlementResolver.ts(97,22): TS2556` (spread argument tuple typing)
- Additional failures include multiple typed test files and non-Architect staging scripts.
- Evidence: `return_packages/architect/_logs/p0_typecheck_20260213_235433_finish.log`
- Severity rationale: partial break in static correctness gates; runtime build still passes, but typed release confidence is reduced.

## Architect-Specific Impact Assessment

### Build/Test Health
- `npm run build` passed, including Architect modules (with non-fatal warnings).
- `npm run test -- --run` passed with:
  - `Test Files: 230 passed`
  - `Tests: 3014 passed | 1 skipped | 3 todo`
- Architect trade/cap validations have broad test presence in this run output (trade, hard-cap, entitlement, offseason suites).

### Ship-Risk Interpretation
- `SEV-0` (cannot run/build) from validation suite: **none found**.
- `SEV-1` core unusable based on command outcomes: **none directly from build/test commands**.
- `SEV-2` static-type gate issue present (`entitlementResolver.ts` + typed tests).
- `SEV-3` environment/tooling noise includes lint debt and sandbox `tsx` IPC behavior.

### Command-Level Evidence Links
- Build pass: `return_packages/architect/_logs/p0_build_20260213_235433_finish.log`
- Test pass: `return_packages/architect/_logs/p0_test_20260213_235433_finish.log`
- Lint fail: `return_packages/architect/_logs/p0_lint_20260213_235433_finish.log`
- Typecheck fail: `return_packages/architect/_logs/p0_typecheck_20260213_235433_finish.log`
- Validator fallback pass: `return_packages/architect/_logs/p0_validate_project_20260213_235433_finish_node_import_tsx.log`

## Required Unblocker Changes
- Code changes required to run validation: **none**.
- Operational unblocker used:
  - Ran `node --import tsx scripts/validate-project-schema.ts` after `npm run validate:project` failed with sandbox-specific `tsx` IPC `EPERM`.
  - This was a command-level workaround only; no repository files were modified for the workaround.

## Residual Validation Gaps
- `UNKNOWN`: Browser-interactive validation for export image capture (trade download) was not executed in this pass.
- `UNKNOWN`: Whether project CI treats `npm run typecheck` as mandatory release gate for Architect ship.
- `UNKNOWN`: Full lint triage specific to Architect production files vs tests-only lint noise.
