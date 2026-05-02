# Workspace Cleanup Phase 1 Return Package

## Files Created

- `docs/workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md`
- `docs/workspace-rules/RETURN_PACKAGE_STANDARD.md`
- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`
- `docs/return_packages/README.md`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md`

## Files Updated

- `AGENTS.md`
- `docs/INDEX.md`
- `.gitignore`
- `.claudeignore`
- `docs/RETURN_PACKAGES_CONSOLIDATION.md`

## Canonical Decisions Recorded

- Future return-package path: `docs/return_packages/`
- Working-doc policy: active temporary docs belong under `docs/_working/<initiative>/`
- Archive policy: completed working docs must be reviewed and then archived, graduated, or deleted
- Generated-doc policy: generated docs stay in their generated surfaces and are not used as policy or evidence dumping grounds
- Legacy root `return_packages/` status: legacy historical evidence only until a later consolidation phase

## Commands Run

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && git check-ignore --no-index -v docs/return_packages/README.md docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md
```

Result:

- Before Phase 1 edits, both `docs/return_packages/...` paths were ignored by `.gitignore`.
- The legacy root `return_packages/...` path was also ignored, confirming the need for a narrow canonical-path unignore rule.

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && { git check-ignore --no-index -v docs/return_packages/README.md || echo 'NOT_IGNORED docs/return_packages/README.md'; } && { git check-ignore --no-index -v docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md || echo 'NOT_IGNORED docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md'; } && git check-ignore --no-index -v return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md
```

Result:

- `docs/return_packages/README.md` matched the unignore rule `!docs/return_packages/**`.
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md` matched the same unignore rule.
- `return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md` still matched the legacy root ignore rule `return_packages/`.

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && git status --short
```

Result:

- Modified: `.claudeignore`
- Modified: `.gitignore`
- Modified: `AGENTS.md`
- Modified: `docs/INDEX.md`
- Modified: `docs/RETURN_PACKAGES_CONSOLIDATION.md`
- New: `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`
- New: `docs/return_packages/`
- New: `docs/workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md`
- New: `docs/workspace-rules/RETURN_PACKAGE_STANDARD.md`

```bash
cd '/Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero' && npm run lint:md
```

Result:

- First run failed in a touched file: `docs/RETURN_PACKAGES_CONSOLIDATION.md` had one `MD012/no-multiple-blanks` issue.
- The extra blank line was removed.
- The same command then passed cleanly.

## Commands Skipped

- `npm run build` was skipped because Phase 1 is documentation-only and the prompt explicitly disallowed builds.
- `npm run typecheck` was skipped because Phase 1 makes no source-code changes and the prompt explicitly disallowed typecheck.
- `npm run test`, `npm run test:full`, and raw `vitest` commands were skipped because the prompt explicitly disallowed test execution for this phase.
- No move, delete, archive, or rename commands were run because Phase 1 establishes standards only.

## Acceptance Criteria Check

- [x] `docs/workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md` exists and defines the doc placement standard.
- [x] `docs/workspace-rules/RETURN_PACKAGE_STANDARD.md` exists and defines `docs/return_packages/` as canonical.
- [x] `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md` exists and tracks future cleanup phases.
- [x] `docs/return_packages/README.md` exists.
- [x] `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md` exists.
- [x] `docs/INDEX.md` links to the new standards.
- [x] `AGENTS.md` contains a concise workspace hygiene rule.
- [x] `.gitignore` allows the new canonical `docs/return_packages/` path to be tracked.
- [x] `.claudeignore` does not hide the new canonical `docs/return_packages` README or workspace-cleanup return package.
- [x] No historical return packages were moved.
- [x] No docs were deleted.
- [x] No source code was changed.

## Follow-Up Work

- Next recommended execution phase: Return-package consolidation

## Stop Conditions

- Not triggered. `docs/return_packages/` was safely unignored with narrow rules, the `AGENTS.md` update stayed concise, no historical docs were moved/deleted/renamed, and the only lint failure was a touched-file formatting issue that was fixed in scope.
