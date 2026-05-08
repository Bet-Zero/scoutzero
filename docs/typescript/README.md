# TypeScript Documentation Status

TypeScript migration, hardening, and zero-exception hardening are complete in this repository.

Treat TypeScript as a maintenance gate, not as an active campaign. Do not reopen unless a gate regresses — see [AGENTS.md](../../AGENTS.md) for the reopen rule.

All campaign docs (baseline, completion contract, zero-exception hardening, post-migration audit) are archived to `archive/docs/typescript/`.

## Return-Package Evidence Archives

Use these archives when you need execution evidence rather than current routing rules.

- [../return_packages/typescript/](../return_packages/typescript/) - TypeScript hardening and zero-exception execution evidence archive.
- [../return_packages/docs/POST_TYPESCRIPT_DOC_STABILIZATION_2026-05-02.md](../return_packages/docs/POST_TYPESCRIPT_DOC_STABILIZATION_2026-05-02.md) - bounded documentation stabilization evidence for this cleanup pass.

## Reopen Rule

Reopen TypeScript campaign work only if one of these conditions becomes true:

- the completion contract gates fail again
- zero-exception invariants regress
- a new TypeScript regression creates fresh maintenance debt that the completion contract does not already classify as closed

If that happens, start from the maintenance gate docs above and create a new bounded plan for the regression. Do not resume the old campaign plans by default.
