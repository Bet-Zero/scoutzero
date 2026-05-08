# ScoutZero Documentation Index

**Welcome to the ScoutZero documentation!** This index provides navigation to all project documentation organized by topic and role.

---

## 🚀 Start Here

**New to the project?** Start with these documents based on your role:

- **👤 Users**: [Simple User Guide](guides/SIMPLE_USER_GUIDE.md)
- **👨‍💻 Developers**: [Developer Guide](guides/DEVELOPER_GUIDE.md)
- **🤖 AI Agents**: [Agents Documentation](../AGENTS.md)
- **🏗️ Contributors**: [Contributing Guide](CONTRIBUTING.md) _(coming soon)_

**Want the big picture?**

- [README](../README.md) - Project overview
- [Project Schema](architecture/PROJECT_SCHEMA.md) - Complete data model and architecture
- [Architect Runtime Reference](architect/README.md) - Current Architect runtime and feature routing

## TypeScript Status

- [TypeScript Documentation Status](typescript/README.md) - TypeScript is complete; campaign docs archived; do not reopen unless a gate regresses.

## Workspace Cleanup Standards

- [Documentation Structure Standard](workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md) - canonical placement rules for permanent docs, working docs, archives, generated docs, and prompts.
- [Return Package Standard](workspace-rules/RETURN_PACKAGE_STANDARD.md) - naming and placement rules for new return packages.
- [Workspace Guardrails](workspace-rules/WORKSPACE_GUARDRAILS.md) - concise do/don't checklist and validation commands.
- Workspace cleanup initiative (all 6 phases) complete; all historical return packages removed from active repo.

## Historical Archives

- [Docs Archive](../archive/docs/README.md) - historical docs moved out of the active docs root.
- [TypeScript Archive](../archive/docs/typescript/README.md) - archived TypeScript campaign bundle preserved as evidence.
- [Reviews Archive](../archive/docs/reviews/README.md) - one-off review docs moved out of active routing.

---

## 📚 Documentation Categories

### 🏗️ Architecture & Schema

Core system architecture and data models:

- [Project Schema](architecture/PROJECT_SCHEMA.md) - Complete data structures and relationships
- [Architect Runtime Reference](architect/README.md) - Active runtime documentation for Architect save/load flow, world behavior, persistence, and Firestore routing
- [Contract Normalization Rules](CONTRACT_NORMALIZATION_RULES.md)

**Schema:**

- [Current Firestore Schema](schema/CURRENT_FIRESTORE_SCHEMA.md) — canonical active schema
- All migration docs archived to `archive/docs/migrations/` — migrations complete.

### 🛠️ Development Guides

Information for developers working on the codebase:

- [Developer Guide](guides/DEVELOPER_GUIDE.md) - Setup, architecture, patterns
- [Testing Guide](TESTING.md) - Testing strategy and commands
- [Scripts Reference](SCRIPTS.md) - npm and workflow scripts

**Directory Structure:**

- `/docs/guides/` - Additional development guides
- `/docs/components/` - Component-specific documentation
- `/docs/architecture/` - System architecture details

### 📋 Runbooks & Operations

Step-by-step operational procedures:

- [Data Scrape Runbook](runbooks/data-scrape.md) — player + team pipeline commands, Firestore push
- [Fix Player Not Found](runbooks/FIX_PLAYER_NOT_FOUND.md) — SalarySwish slug mismatch fixes
- [Manual Smoke Test Checklist](runbooks/MANUAL_SMOKE_TEST_CHECKLIST.md) — post-push verification
- [Scouting Prod Sync Runbook](scouting/PROD_SYNC_RUNBOOK.md) — scouting data sync to prod
- One-time historical runbooks (cutover, collection cleanup, Nov 2025 audits) archived to `archive/docs/runbooks/`.

### 🎮 Features

Feature-specific documentation lives with the feature code in `src/features/`. Feature schema notes archived to `archive/docs/features/`.

### 🏀 Trade Machine

Trade machine implementation and audits:

- [Trade Machine Docs Router](tradeMachine/README.md) - Current cross-feature trade-machine docs
- [Return Packages README](return_packages/README.md) - Canonical routing for current return-package deliverables

### 📜 Compliance & CBA Rules

NBA Collective Bargaining Agreement implementation:

- `/docs/compliance/` - CBA compliance matrix (`COMPLIANCE_MATRIX.csv`); historical audit certificates archived to `archive/docs/compliance/`

### 🤖 AI & Cursor Prompts

Prompts and instructions for AI-assisted development:

- [Cursor Commands Overview](cursor-prompts/cursor-commands-overview.md)
- [Apex Audit Prompt](cursor-prompts/ApexAuditPrompt.md)
- [Audit Review Prompt](cursor-prompts/AuditReviewPrompt.md)
- [Apply Critical Prompt](cursor-prompts/ApplyCriticalPrompt.md)
- [Cleanup Prompt](cursor-prompts/CleanupPrompt.md)
- [Doc Sync Prompt](cursor-prompts/DocSyncPrompt.md)
- [Explain Prompt](cursor-prompts/ExplainPrompt.md)
- [Fix All Prompt](cursor-prompts/FixAllPrompt.md)
- [Group By Feature Refactor](cursor-prompts/GroupByFeatureRefactor.md)
- [Relevance Prompt](cursor-prompts/RelevancePrompt.md)

### 📦 Return Packages

If you need to create a return package for completed work:

- [Return Packages README](return_packages/README.md) — where to put them and how to name them
- [Return Package Standard](workspace-rules/RETURN_PACKAGE_STANDARD.md) — naming and content rules

All historical return packages have been removed from the repo; they're in git history if ever needed.

### 📊 Data Pipelines

Data scraping and pipeline documentation:

- `/docs/team-scrape/` - Team data scraping documentation
- `/archive/docs/team-scrape/` - Historical team scrape audits moved out of active feature docs

### 🔧 Templates

Reusable templates for documentation and development:

- `/docs/templates/` - Document templates

### 🎯 Scouting Features

Scouting and player evaluation features:

- `/docs/scouting/` - Scouting feature documentation

---

## 📁 Directory Structure

```
/docs
├── INDEX.md (this file)
├── CONTRIBUTING.md             # Contribution guidelines
├── TESTING.md                  # Testing strategy
├── SCRIPTS.md                  # npm scripts reference
├── architect/                  # Active Architect runtime reference
├── architecture/               # System architecture
├── commands/                   # CLI commands (draft picks pipeline)
├── compliance/                 # CBA compliance matrix
├── components/                 # Generated component hierarchy docs
├── cursor-prompts/             # AI assistant prompts
├── guides/                     # Development guides
├── return_packages/            # Placement guide for new return packages
├── runbooks/                   # Operational procedures
├── schema/                     # Schema documentation
├── scouting/                   # Scouting feature docs
├── tradeMachine/               # Trade machine router (→ architect/trade-machine)
├── typescript/                 # TypeScript status (campaign complete)
├── tradeMachine/               # Cross-feature trade-machine docs + router
└── workspace-rules/            # Workspace configuration
```

---

## 🔍 Quick Links by Topic

### For Bug Fixes

1. Check relevant runbooks in `/docs/runbooks/`
2. Review [Trade Machine Audit](tradeMachine/TRADE_MACHINE_AUDIT.md) for known issues
3. Check return packages for similar fixes

### For New Features

1. Review [Project Schema](architecture/PROJECT_SCHEMA.md) for data model
2. Check [Developer Guide](guides/DEVELOPER_GUIDE.md) for patterns
3. Review feature docs in `/docs/features/`

### For Architect Runtime Questions

1. Start with [Architect Runtime Reference](architect/README.md)
2. Use the feature routers under `/docs/architect/` for cap sheet, trade machine, entitlements, free agency, and type hardening
3. Use [Project Schema](architecture/PROJECT_SCHEMA.md) and [Current Firestore Schema](schema/CURRENT_FIRESTORE_SCHEMA.md) for data-shape questions

### For Data Issues

1. [Scouting Prod Sync Runbook](scouting/PROD_SYNC_RUNBOOK.md)
2. Team scrape docs in `/docs/team-scrape/`

### For Deployment

1. [Scouting Prod Sync Runbook](scouting/PROD_SYNC_RUNBOOK.md) for data pushes
2. [Manual Smoke Test Checklist](archive/docs/runbooks/MANUAL_SMOKE_TEST_CHECKLIST.md) — archived reference

---

## 🆘 Need Help?

- **Can't find what you're looking for?** Use your IDE's search (Cmd/Ctrl+Shift+F) to search all markdown files
- **Unclear documentation?** Check [Developer Guide](guides/DEVELOPER_GUIDE.md) or [Project Schema](architecture/PROJECT_SCHEMA.md)
- **Need to understand the codebase?** Start with [Developer Guide](guides/DEVELOPER_GUIDE.md) or [Project Schema](architecture/PROJECT_SCHEMA.md)

---

## 📝 Documentation Conventions

- **Root-level docs**: High-level guides, audits, and entry-point routers
- **`/docs` subdirectories**: Organized by topic and subsystem
- **`/archive/docs`**: Historical docs retained for audit and provenance
- **Return packages**: Historical deliverables with execution details
- **Runbooks**: Step-by-step operational procedures
- **MASTER suffix**: Authoritative feature documentation

---

**Last Updated**: May 7, 2026
**Maintainers**: See [CONTRIBUTING.md](CONTRIBUTING.md)
