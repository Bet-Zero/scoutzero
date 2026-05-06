# Workspace Cleanup Phase 6 Return Package

## Baseline Validation

- `git status --short`: clean before Phase 6 edits.
- `npm run lint:md`: passed before Phase 6 edits.

## Guardrails Added

| Guardrail                          | Location                                                                                                                                                              | Purpose                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace guardrail checklist      | `docs/workspace-rules/WORKSPACE_GUARDRAILS.md`                                                                                                                        | Provide the short do/don't list and validation workflow for future agents.                                                                   |
| Lightweight docs guardrail command | `scripts/docs/checkWorkspaceGuardrails.mjs`                                                                                                                           | Scan active routing docs, plans visibility rules, forbidden feature-root return-package surfaces, and deprecated return-package directories. |
| npm entrypoint                     | `package.json`                                                                                                                                                        | Make the guardrail scan runnable as `npm run docs:guardrails`.                                                                               |
| Repo workflow reinforcement        | `AGENTS.md`                                                                                                                                                           | Add concise workspace hygiene bullets for return packages, plans, feature-doc roots, and validation.                                         |
| Standards cross-links              | `docs/workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md`, `docs/workspace-rules/RETURN_PACKAGE_STANDARD.md`, `docs/INDEX.md`, `docs/architecture/PROJECT_SCHEMA.md` | Keep the new checklist and current workspace model discoverable from the active standards and routing docs.                                  |

## Files Created

- `docs/workspace-rules/WORKSPACE_GUARDRAILS.md`
- `scripts/docs/checkWorkspaceGuardrails.mjs`
- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE6_RETURN_PACKAGE.md`

## Files Updated

- `.claudeignore`
- `AGENTS.md`
- `docs/INDEX.md`
- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`
- `docs/architecture/PROJECT_SCHEMA.md`
- `docs/workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md`
- `docs/workspace-rules/RETURN_PACKAGE_STANDARD.md`
- `package.json`

## Optional Script Decision

- Script added: yes.
- Script path: `scripts/docs/checkWorkspaceGuardrails.mjs`.
- npm script name: `docs:guardrails`.
- What it scans: active routing docs (`README.md`, `docs/INDEX.md`) for deprecated/misplaced routing targets, `.claudeignore` for the active-plans rule, forbidden return-package directory surfaces under active feature-doc roots, and `*RETURN_PACKAGE*.md` files under `docs/architect/`, `docs/team-scrape/`, `docs/tradeMachine/`, and `docs/scouting/`.

## Commands Run

- `git status --short`: baseline clean.
- `npm run lint:md`: baseline pass.
- `npm run docs:guardrails`: failed once because the initial script check did not accept the escaped underscore form of `plans/_archive/` in `.claudeignore`; passed after the regex fix.
- `npm run lint:md` after the core policy/script edits: passed.
- `git status --short` after the full Phase 6 changes: modified `.claudeignore`, `AGENTS.md`, `docs/INDEX.md`, `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`, `docs/architecture/PROJECT_SCHEMA.md`, `docs/workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md`, `docs/workspace-rules/RETURN_PACKAGE_STANDARD.md`, `package.json`; added `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_PHASE6_RETURN_PACKAGE.md`, `docs/workspace-rules/WORKSPACE_GUARDRAILS.md`, and `scripts/docs/checkWorkspaceGuardrails.mjs`.
- `npm run lint:md` after the final Phase 6 documentation updates: passed.
- `npm run docs:guardrails` after the final Phase 6 documentation updates: passed.
- `npm run validate:project`: passed after the structural Phase 6 additions.
- `git status --short` after marking Phase 6 complete: same modified/added file set as above.
- `npm run lint:md` after marking Phase 6 complete: passed.
- `npm run docs:guardrails` after marking Phase 6 complete: passed.

## Commands Skipped

- `npm run build`: skipped because the phase is docs/tooling guardrails only and the prompt explicitly disallowed builds.
- `npm run typecheck`: skipped because the phase is docs/tooling guardrails only and the prompt explicitly disallowed typecheck.
- `npm run test`: skipped because the phase is docs/tooling guardrails only and the prompt explicitly disallowed test suites.
- `npm run test:full`: skipped because the prompt explicitly disallowed the full suite.
- Raw `vitest` commands: skipped because AGENTS.md forbids raw Vitest usage.

## Acceptance Criteria Check

- [x] A workspace guardrails doc exists.
- [x] AGENTS.md includes concise workspace hygiene rules.
- [x] Documentation structure/return-package standards link to or align with the guardrails.
- [x] Project schema reflects the current docs/archive/return-package/plan split reality.
- [x] `docs/INDEX.md` links to the new guardrails.
- [x] `.gitignore` and `.claudeignore` do not contradict the cleanup standard.
- [x] Cleanup master marks Phase 6 complete only after validation passes.
- [x] Cleanup master records final cleanup status and carried-forward human-review items.
- [x] No source/app code was changed.
- [x] No files were moved.
- [x] No files were deleted.
- [x] `npm run lint:md` passes after the final Phase 6 documentation updates.
- [x] If a docs guardrail script was added, it runs successfully after the final Phase 6 documentation updates.

## Follow-Up Work

- Workspace cleanup execution is complete once Phase 6 validation passes.
- The only carried-forward follow-up is a separate human-review pass for ambiguous or no-clear-replacement historical docs in older architect and trade-machine surfaces.
