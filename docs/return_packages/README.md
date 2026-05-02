# Return Packages

This directory is the canonical future home for new ScoutZero return packages.

## Phase 1 Status

- New return packages go under `docs/return_packages/<area>/`.
- Root `return_packages/` remains legacy historical evidence until a later consolidation phase.
- No historical return-package files were moved in Phase 1.
- Use underscore naming only; do not create `return-packages` paths.

## Folder Model

Area folders are created when needed. Expected areas include:

- `workspace-cleanup/`
- `architect/`
- `scouting/`
- `tradeMachine/`
- `team-scrape/`
- `docs/`
- `typescript/`
- `general/`

Only create the area folders that are required for active work.

## Naming And Content Rules

- Use the rules in `../workspace-rules/RETURN_PACKAGE_STANDARD.md`.
- Every return package must include files changed, commands run, commands skipped, and validation results.
- Return packages are delivery evidence, not permanent feature docs and not working docs.

## Current Contents

- `workspace-cleanup/` - return packages for the workspace cleanup initiative
