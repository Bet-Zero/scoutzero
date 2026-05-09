# Documentation Structure Standard

This standard defines where every type of documentation belongs in the ScoutZero repository.

---

## The Fundamental Rule

`docs/` contains permanent project documents only — things that describe the project as it exists now and are meant to remain indefinitely.

Temporary, in-progress, and execution-record material lives outside `docs/`.

---

## docs/ — The Permanent Library

Four pillars. Every document in `docs/` belongs in exactly one of them.

### `docs/reference/`

**What it is:** Everything that describes how the system works.

- `docs/reference/architect/` — Architect GM Dashboard feature docs, trade machine, type hardening
- `docs/reference/schema/` — Firestore schema docs (generated from Zod schemas)
- `docs/reference/PROJECT_SCHEMA.md` — Repo-wide structure, naming conventions, data contracts

**When to add here:** A new feature gets its own subfolder under `reference/` when it needs persistent behavioral documentation that agents or developers will return to repeatedly.

### `docs/guides/`

**What it is:** How to work with and build the system.

- Developer guide, user guide, contributing guidelines
- Testing strategy, scripts reference
- Tool-specific references (e.g., Firestore diagnostic component)

**When to add here:** A new guide covering setup, patterns, or usage that any developer would need over time.

### `docs/operations/`

**What it is:** How to run and maintain the system.

- Data scrape runbook (player + team pipeline)
- Prod sync runbook, draft picks commands
- Fix procedures for recurring operational issues
- Post-push verification checklists

**When to add here:** A procedure you will run more than once. If it is a one-time action it goes in `work/` not here.

### `docs/standards/`

**What it is:** Rules governing how the project is built and documented.

- This document
- Workspace guardrails, return package standard
- Communication rules, contributing conventions
- Contract normalization rules

**When to add here:** A new rule or convention that applies project-wide and agents must follow.

---

## Root `docs/` Files

Only three things belong at `docs/` root:

- `docs/INDEX.md` — the navigation entry point
- `docs/COMPONENT_INDEX.md` and `docs/FILE_MAP.md` — auto-generated on every commit, do not edit manually

---

## work/ — Active In-Progress Material

`work/` lives at the repo root (not inside `docs/`).

```
work/
└── <initiative-slug>/
    ├── plan.md              # Main planning/tracking doc
    ├── preflight.md         # Pre-execution assessment (optional)
    ├── return_package.md    # Delivery evidence (created on completion)
    └── notes/               # Any other working docs (optional)
```

**Lifecycle:** When an initiative is complete, the entire `work/<initiative>/` folder moves to `archive/work/<initiative>/`. One move, everything archives together.

**Return packages live here**, not in `docs/`. The return package for an initiative is part of that initiative's working folder.

---

## archive/ — Historical Material

```
archive/
├── docs/        # Historical versions of permanent docs
└── work/        # Completed working-doc clusters
```

Archive is for material that has reference value but should not live beside active docs. Once something is in archive, it stays there.

---

## Generated Docs

`docs/components/` and `docs/reference/schema/` contain auto-generated files. Do not edit them manually — update them through their source commands (`npm run docs`, `npm run schema:generate`).

---

## Placement Quick Reference

| What | Where |
|------|-------|
| Feature behavioral docs | `docs/reference/<feature>/` |
| Firestore schema docs | `docs/reference/schema/` |
| Repo structure reference | `docs/reference/PROJECT_SCHEMA.md` |
| Developer / user guides | `docs/guides/` |
| Recurring operational procedures | `docs/operations/` |
| Project rules and conventions | `docs/standards/` |
| Working docs, preflights, return packages | `work/<initiative>/` |
| Completed initiatives | `archive/work/<initiative>/` |
| Historical docs | `archive/docs/` |

---

## What Never Goes in `docs/`

- Execution evidence (preflights, return packages, phase reports)
- Plans, trackers, or in-progress notes
- One-time audit records or certification snapshots
- Anything with a completion date that makes it historical rather than current

If you are unsure, ask: "Will someone need this two years from now to understand how the system works?" If no, it belongs in `work/` or `archive/`, not `docs/`.
