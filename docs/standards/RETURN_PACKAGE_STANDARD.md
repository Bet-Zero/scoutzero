# Return Package Standard

This standard defines the canonical location, naming, and minimum content requirements for new ScoutZero return packages.

Use `WORKSPACE_GUARDRAILS.md` for the short checklist and validation commands that reinforce this standard in day-to-day work.

## Canonical Rule

- The canonical future return-package root is `docs/return_packages/`.
- Use underscore naming only: `return_packages`.
- Do not create or recreate `return-packages` paths.
- Root `return_packages/` is legacy historical evidence until a later consolidation phase.
- Do not place new return packages in the legacy root path.

## Folder Model

Create new return packages under `docs/return_packages/<area>/`.

Recommended area folders:

- `docs/return_packages/workspace-cleanup/` for workspace cleanup work
- `docs/return_packages/architect/` for architect work
- `docs/return_packages/scouting/` for scouting work
- `docs/return_packages/tradeMachine/` for trade-machine work
- `docs/return_packages/team-scrape/` for team-scrape work
- `docs/return_packages/docs/` for docs-only infrastructure work
- `docs/return_packages/typescript/` for TypeScript maintenance evidence when new work is explicitly reopened
- `docs/return_packages/general/` for cross-cutting work that does not fit a more specific area

Only create an area folder when there is active work for that area.

## File Naming

- Use uppercase filenames with underscores.
- End all return-package filenames with `_RETURN_PACKAGE.md`.
- Use `_PREFLIGHT_RETURN_PACKAGE.md` for preflight evidence.
- Keep the area in the folder path, not in multiple competing folder names.
- Add a date suffix only when it improves disambiguation.

Examples:

- `WORKSPACE_CLEANUP_PHASE1_RETURN_PACKAGE.md`
- `TRADE_MACHINE_RULES_PREFLIGHT_RETURN_PACKAGE.md`
- `SCOUTING_PROFILE_FIX_2026-05-02_RETURN_PACKAGE.md`

## Required Contents

Every return package must include, at minimum:

- clear title and scope
- files created and files updated
- commands run, with actual results
- commands skipped, with reasons
- validation performed and outcome
- acceptance criteria check when the phase/request defines one
- follow-up work or next recommended phase

When applicable, also include:

- canonical decisions recorded during the phase
- blockers or stop conditions encountered
- notes on any failures that were outside the touched files

## Placement Rules

- New return packages belong only under `docs/return_packages/<area>/`.
- Return-package files must not be mixed into active feature-root folders like `docs/architect/` or `docs/team-scrape/` going forward.
- Return packages are evidence artifacts, not permanent feature docs and not working docs.

## Legacy Handling

- Root `return_packages/` remains in place as legacy historical evidence until consolidation.
- Phase 1 does not move, rename, or delete legacy root return-package files.
- Historical hyphenated `return-packages` paths are deprecated and must not be recreated.

## Relationship To Other Standards

- Use `DOCUMENTATION_STRUCTURE_STANDARD.md` for the overall document-placement model.
- Use `AGENTS.md` for the repo-wide workflow rule that points new return packages to `docs/return_packages/<area>/`.
