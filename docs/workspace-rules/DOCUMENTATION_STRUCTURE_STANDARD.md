# Documentation Structure Standard

This standard defines where ScoutZero documentation belongs before any cleanup move, archive pass, or deletion is executed.

## Scope

This standard applies to permanent docs, working docs, return packages, archived docs, generated docs, feature docs, runbooks, and agent prompts.

Use `WORKSPACE_GUARDRAILS.md` for the concise do/don't checklist and validation commands that sit on top of this placement model.

## Core Rules

- Keep one documentation type per surface whenever possible.
- Keep active guidance in visible, stable documentation locations.
- Keep historical evidence out of active feature roots and out of `_working` once review is complete.
- Keep generated docs in their generated surfaces and do not use them as policy-doc dumping grounds.
- Use underscore naming for `return_packages`; do not create `return-packages` paths.

## Canonical Placement

| Material Type           | Canonical Location                                                     | Purpose                                                   | Notes                                                                                     |
| ----------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Permanent repo docs     | `docs/` topic folders and repo entry docs                              | Evergreen guidance and reference docs                     | Use root-level docs only for repo-wide entry points and durable cross-cutting references. |
| Working docs            | `docs/_working/<initiative>/`                                          | Temporary planning, review, preflight, and draft material | `_working` is a staging area, not a permanent evidence store.                             |
| Return packages         | `docs/return_packages/<area>/`                                         | Execution evidence and delivery records                   | See `RETURN_PACKAGE_STANDARD.md` for naming and content rules.                            |
| Archived docs           | `archive/docs/<area>/` or `plans/_archive/` for plan-specific material | Historical docs retained after review                     | Phase 1 defines the destination standard; later phases perform the moves.                 |
| Generated docs          | `docs/components/` and `docs/schema/`                                  | Tool-generated references                                 | Do not manually edit generated outputs except through their source generators.            |
| Feature docs            | `docs/<feature>/` or `docs/features/`                                  | Evergreen feature overviews, masters, and references      | Do not mix return packages or closeout evidence into the feature root going forward.      |
| Runbooks                | `docs/runbooks/`                                                       | Operator procedures and recurring workflows               | Runbooks are not archives and are not return packages.                                    |
| Agent prompts and rules | `AGENTS.md`, `docs/workspace-rules/`, and `docs/cursor-prompts/`       | Stable operating rules and prompts                        | Keep personal or local-only agent context out of permanent docs.                          |

## Working-Doc Lifecycle

- Create active temporary documentation only under `docs/_working/<initiative>/`.
- Working docs may include preflight inventories, temporary trackers, draft standards, comparison notes, and review checklists.
- Working docs must not become the final home for completed closeout records, historical return packages, or evergreen policy docs.
- When an initiative or working-doc cluster closes, review it and choose one outcome:
  - graduate the durable content to permanent docs;
  - move retained historical material to the archive surface; or
  - delete clearly redundant drafts after review.
- Completed working docs cannot remain in `_working` indefinitely.

## Permanent-Doc Rules

- Put evergreen repo guidance in `docs/` topic folders.
- Keep repo-wide routing in `README.md`, `docs/INDEX.md`, and other durable entry docs only.
- Do not place temporary audits, phase trackers, or return packages in permanent feature roots when a working or return-package surface exists.

## Generated-Doc Rules

- Treat `docs/components/` and `docs/schema/` as generated-reference surfaces.
- Update generated docs through their source commands, not by manual cleanup passes.
- Do not mix policy standards, return packages, or draft plans into generated-doc folders.

## Feature-Doc Rules

- Keep evergreen feature references in the nearest stable feature-doc surface.
- Keep execution evidence, closeout records, and transient review material out of feature roots going forward.
- If a feature needs both evergreen docs and delivery evidence, place the evidence in `docs/return_packages/<area>/` and cross-link from the feature doc only when helpful.

## Archive Rules

- Use archive surfaces for completed documentation that still has reference value but should no longer live beside active docs.
- Keep archive docs separate from active docs and separate from generated docs.
- Keep plan-specific archive material under `plans/_archive/`; keep general historical docs under the archive-doc surface defined above.

## Guardrails

- Do not create `return-packages` paths.
- Do not create new return-package files under the legacy root `return_packages/` path.
- Do not treat `docs/_working/` as a permanent evidence store.
- Do not place new execution evidence directly in `docs/architect/`, `docs/team-scrape/`, or other active feature roots when a canonical return-package path exists.
