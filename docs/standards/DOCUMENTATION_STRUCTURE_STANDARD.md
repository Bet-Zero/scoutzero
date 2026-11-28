# Documentation Structure Standard

Where documentation belongs in the ScoutZero repository, and when to write it.

## The rule

`docs/` holds permanent documents that describe the project as it is now.
Plans in progress live in `work/`; finished or retired material lives in
`archive/`. The pull request is the record of what a piece of work changed and
how it was checked.

Prefer updating the existing doc, README, contract or code comment over
creating a new file. A new file, component, folder or script doesn't by itself
need a README, header, plan or evidence document. Create a new document only
when it has a long-lived audience that no existing home serves.

## `docs/`: the permanent library

| Pillar | What goes there |
| --- | --- |
| `docs/reference/` | How the system works: Architect feature docs (`reference/architect/`), Firestore schema (`reference/schema/`), repository structure (`reference/PROJECT_SCHEMA.md`), the pinned rulebook notes (`reference/cba/`) |
| `docs/guides/` | How to work with and build the system: developer, user, contributing, testing and scripts guides |
| `docs/operations/` | Procedures you will run more than once: data refreshes, production sync, recurring fixes |
| `docs/standards/` | Project-wide rules: this page, the Architect visual standard, contract normalization rules, the workflow-change record |
| `docs/agent-guides/` | The Architect V1 contract and Architect boundary |

At the `docs/` root: `INDEX.md` (the map), and the generated `COMPONENT_INDEX.md`,
`FILE_MAP.md` and `components/`.

Never put in `docs/`: plans, trackers, status reports, audit or certification
snapshots, or execution evidence. Ask: "Will someone need this two years from
now to understand how the system works?" If not, it belongs in the pull request,
`work/` or `archive/`.

## `work/` and `archive/`

A plan that several pull requests share lives in `work/<initiative>/`. Ordinary
tasks need no plan file. When an initiative finishes, its folder moves to
`archive/work/<initiative>/`, unless tests or workflows still read its files.
`archive/docs/` holds retired versions of permanent docs. Archived material is
history, not instructions.

## Keeping docs current

- Update a doc when behavior, data shape or a workflow changes in a way its
  reader needs to know. A styling fix or a local bug fix usually needs none.
- When guidance is superseded, change it where it lives instead of adding a
  new rule elsewhere.
- Generated docs are never edited by hand. Regenerate schema docs
  (`npm run schema:generate`) when a schema changes, and component docs
  (`npm run docs`) only when asked.
- Check changed Markdown with `npm run lint:md`.
