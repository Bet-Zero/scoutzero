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

- Keep detailed task evidence in the PR. When a file-based return package is
  explicitly needed, put it under `work/<initiative>/`.
- Put temporary planning, review, and draft docs under `work/<initiative>/`.
- Move or graduate completed working docs after review; do not let `_working` become a permanent evidence store.
- Keep evergreen feature docs in feature roots such as `docs/reference/architect/`, `archive/docs/team-scrape/`, `archive/docs/tradeMachine/`, and `archive/docs/scouting/`.
- Keep main routing docs truthful: `README.md`, `docs/INDEX.md`, `AGENTS.md`, `docs/standards/*.md`, and `docs/reference/PROJECT_SCHEMA.md` should not knowingly point at missing files.

## Don't

- Do not put return packages or execution evidence in `docs/` — it's a permanent library, not an evidence store.
- Do not create `return_packages/` or `return-packages/` paths anywhere in `docs/`.
- Do not add `*RETURN_PACKAGE*.md` files directly under feature-doc roots.
- Do not put active working docs in `docs/` — `docs/` is a permanent reference library, not a workspace.

## Agent Judgment and Owner Boundaries

- Resolve mixed evergreen/historical content from its intended use; prefer the existing home.
- Inspect a stale link when it affects the task; record an unresolved reference without unrelated cleanup.
- Do not move, rename or delete historical files outside the authorized scope.
- Agents decide routine archive/permanent placement; ask only for a genuine owner-reserved decision.

## Validation

For docs-routing or workspace-rule changes, run the applicable checks once; reuse unaffected evidence:

```bash
git status --short
node scripts/run-tests-by-diff.mjs --docs
```

## Related Standards

- `DOCUMENTATION_STRUCTURE_STANDARD.md` - full placement and lifecycle model
- `RETURN_PACKAGE_STANDARD.md` - return-package naming, placement, and content rules
