# Workspace Guardrails

This checklist keeps ScoutZero documentation, plans, and return-package routing aligned with the workspace cleanup standards.

Use this doc as the quick reference. Use the linked standards when a change needs the full placement model or return-package rules.

## Canonical Paths

| Material               | Canonical Location             | Notes                                                                                   |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| New return packages    | `docs/return_packages/<area>/` | Do not create new return packages under root `return_packages/` or any hyphenated path. |
| Temporary working docs | `docs/_working/<initiative>/`  | `_working` is for in-flight material only.                                              |
| Historical docs        | `archive/docs/<area>/`         | Archive docs are retained reference material, not active source of truth.               |
| Active plans           | `plans/<active-plan>/`         | Keep active plans visible to agents.                                                    |
| Archived plans         | `plans/_archive/`              | Completed plan material belongs here.                                                   |

## Do

- Put new execution evidence under `docs/return_packages/<area>/`.
- Put temporary planning, review, and draft docs under `docs/_working/<initiative>/`.
- Move or graduate completed working docs after review; do not let `_working` become a permanent evidence store.
- Keep evergreen feature docs in feature roots such as `docs/architect/`, `docs/team-scrape/`, `docs/tradeMachine/`, and `docs/scouting/`.
- Keep main routing docs truthful: `README.md`, `docs/INDEX.md`, `AGENTS.md`, `docs/workspace-rules/*.md`, and `docs/architecture/PROJECT_SCHEMA.md` should not knowingly point at missing files.

## Don't

- Do not create `return-packages` paths.
- Do not create new markdown evidence under the legacy root `return_packages/` path.
- Do not create `docs/<feature>/return_packages/` or `docs/<feature>/return-packages/` folders.
- Do not add new `*RETURN_PACKAGE*.md` execution evidence files directly under active feature-doc roots.
- Do not hide all of `plans/` in ignore rules; only archived plan material should be hidden by default.

## Human Review Required

- A doc looks partly evergreen and partly historical.
- A stale link has no clear replacement.
- A change would move, rename, or delete historical files.
- A working-doc cluster needs archive vs permanent-doc judgment.

## Validation

Before and after docs-routing or workspace-rule changes, run:

```bash
git status --short
npm run lint:md
npm run docs:guardrails
```

## Related Standards

- `DOCUMENTATION_STRUCTURE_STANDARD.md` - full placement and lifecycle model
- `RETURN_PACKAGE_STANDARD.md` - return-package naming, placement, and content rules
