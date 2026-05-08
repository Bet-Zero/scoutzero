# ScoutZero Documentation

---

## Start Here

| Role | Entry point |
|------|-------------|
| Users | [Simple User Guide](guides/SIMPLE_USER_GUIDE.md) |
| Developers | [Developer Guide](guides/DEVELOPER_GUIDE.md) |
| AI Agents | [AGENTS.md](../AGENTS.md) |
| Contributors | [Contributing Guide](guides/CONTRIBUTING.md) |

---

## Docs Structure

Everything in `docs/` is a permanent project document. Active work-in-progress lives in `work/` at the repo root.

```
docs/
├── reference/          # What the system IS and how it works
│   ├── architect/      # Architect GM Dashboard feature
│   │   ├── trade-machine/
│   │   └── type-hardening/
│   ├── schema/         # Firestore schema docs
│   └── PROJECT_SCHEMA.md  # Repo structure and conventions
│
├── guides/             # How to work WITH the system
│   ├── DEVELOPER_GUIDE.md
│   ├── SIMPLE_USER_GUIDE.md
│   ├── CONTRIBUTING.md
│   ├── TESTING.md
│   ├── SCRIPTS.md
│   └── FIRESTORE_DIAGNOSTIC.md
│
├── operations/         # How to RUN and MAINTAIN the system
│   ├── data-scrape.md
│   ├── DRAFT_PICKS_COMMANDS.md
│   ├── PROD_SYNC_RUNBOOK.md
│   ├── FIX_PLAYER_NOT_FOUND.md
│   └── MANUAL_SMOKE_TEST_CHECKLIST.md
│
├── standards/          # Rules that govern the project
│   ├── DOCUMENTATION_STRUCTURE_STANDARD.md
│   ├── RETURN_PACKAGE_STANDARD.md
│   ├── WORKSPACE_GUARDRAILS.md
│   ├── COMMUNICATION_RULES.md
│   ├── CREATING_PERMANENT_DOCS.md
│   ├── DOCUMENTATION_UPDATE_RULES.md
│   └── CONTRACT_NORMALIZATION_RULES.md
│
└── INDEX.md            # This file
```

Generated files (`COMPONENT_INDEX.md`, `FILE_MAP.md`, `components/`) live at `docs/` root — auto-updated by `npm run docs` on each commit.

---

## Reference

### Architect GM Dashboard

- [Architect README](reference/architect/README.md) — entry point for all Architect docs
- [Trade Machine](reference/architect/trade-machine/README.md) — validator behavior, runtime reference, test gates
- [Type Hardening](reference/architect/type-hardening/README.md) — cast gate protocol and ledger

### Schema & Architecture

- [Current Firestore Schema](reference/schema/CURRENT_FIRESTORE_SCHEMA.md) — canonical collection layout
- [Architect Schema](reference/schema/architect.md) — generated Architect document schema
- [Players v2 Schema](reference/schema/players_v2.md) — generated player data schema
- [Project Schema](reference/PROJECT_SCHEMA.md) — repo structure, naming conventions, data contracts

---

## Guides

- [Developer Guide](guides/DEVELOPER_GUIDE.md) — setup, architecture, patterns, file structure
- [Simple User Guide](guides/SIMPLE_USER_GUIDE.md) — user-facing feature documentation
- [Contributing](guides/CONTRIBUTING.md) — contribution guidelines
- [Testing Guide](guides/TESTING.md) — testing strategy and commands
- [Scripts Reference](guides/SCRIPTS.md) — npm scripts reference
- [Firestore Diagnostic](guides/FIRESTORE_DIAGNOSTIC.md) — diagnostic component reference

---

## Operations

- [Data Scrape Runbook](operations/data-scrape.md) — player + team pipeline, Firestore push
- [Draft Picks Commands](operations/DRAFT_PICKS_COMMANDS.md) — draft picks pipeline command reference
- [Scouting Prod Sync](operations/PROD_SYNC_RUNBOOK.md) — sync scouting data to production
- [Fix Player Not Found](operations/FIX_PLAYER_NOT_FOUND.md) — SalarySwish slug mismatch fixes
- [Manual Smoke Test](operations/MANUAL_SMOKE_TEST_CHECKLIST.md) — post-push verification checklist

---

## Standards

- [Documentation Structure Standard](standards/DOCUMENTATION_STRUCTURE_STANDARD.md)
- [Return Package Standard](standards/RETURN_PACKAGE_STANDARD.md)
- [Workspace Guardrails](standards/WORKSPACE_GUARDRAILS.md)
- [Communication Rules](standards/COMMUNICATION_RULES.md)
- [Creating Permanent Docs](standards/CREATING_PERMANENT_DOCS.md)
- [Documentation Update Rules](standards/DOCUMENTATION_UPDATE_RULES.md)
- [Contract Normalization Rules](standards/CONTRACT_NORMALIZATION_RULES.md)

---

## Working Docs & Archive

- **Active work**: `work/<initiative>/` at repo root (plans, preflights, return packages)
- **Completed work**: `archive/work/<initiative>/` — moves there when done
- **Docs archive**: `archive/docs/` — historical versions of permanent docs

---

**Last Updated**: May 2026
