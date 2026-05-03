# Return Packages

This directory is the canonical home for ScoutZero return packages.

## Phase 2 Status

- New return packages go under `docs/return_packages/<area>/`.
- Tracked markdown evidence from legacy root `return_packages/` has been consolidated here.
- Root `return_packages/` is no longer the active evidence location.
- Root `return_packages/` remains available only for ignored/local artifacts such as local logs, if they exist.
- No root local-log artifacts were consolidated into `docs/` during Phase 2.
- Use underscore naming only; do not create `return-packages` paths.
- Phase 4 separated mixed feature-root evidence by moving return packages from `docs/architect/` and `docs/team-scrape/` into this canonical root.

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

- `docs/` - consolidated docs-only return-package evidence from the legacy root archive
- `typescript/` - consolidated TypeScript evidence from the legacy root archive
- `workspace-cleanup/` - return packages for the workspace cleanup initiative
- `architect/` - architect execution evidence moved from previously mixed feature-doc roots
- `team-scrape/` - team-scrape execution evidence moved from previously mixed feature-doc roots
- `general/` - reserved for future cross-cutting return packages that do not fit a narrower area
