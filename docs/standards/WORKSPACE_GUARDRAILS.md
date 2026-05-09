# Workspace Guardrails

This checklist keeps ScoutZero documentation, plans, and return-package routing aligned with the workspace cleanup standards.

Use this doc as the quick reference. Use the linked standards when a change needs the full placement model or return-package rules.

## Canonical Paths

| Material               | Canonical Location          | Notes                                                                     |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------- |
| Return packages        | `work/<initiative>/`        | Alongside plan.md; moves to `archive/work/<initiative>/` when done.       |
| Temporary working docs | `work/<initiative>/`        | In-flight plans, preflights, notes — never in `docs/`.                    |
| Historical docs        | `archive/docs/<area>/`      | Archive docs are retained reference material, not active source of truth.  |

## Do

- Put return packages and execution evidence under `work/<initiative>/`.
- Put temporary planning, review, and draft docs under `work/<initiative>/`.
- Move or graduate completed working docs after review; do not let `_working` become a permanent evidence store.
- Keep evergreen feature docs in feature roots such as `docs/reference/architect/`, `archive/docs/team-scrape/`, `archive/docs/tradeMachine/`, and `archive/docs/scouting/`.
- Keep main routing docs truthful: `README.md`, `docs/INDEX.md`, `AGENTS.md`, `docs/standards/*.md`, and `docs/reference/PROJECT_SCHEMA.md` should not knowingly point at missing files.

## Don't

- Do not put return packages or execution evidence in `docs/` — it's a permanent library, not an evidence store.
- Do not create `return_packages/` or `return-packages/` paths anywhere in `docs/`.
- Do not add `*RETURN_PACKAGE*.md` files directly under feature-doc roots.
- Do not put active working docs in `docs/` — `docs/` is a permanent reference library, not a workspace.

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
