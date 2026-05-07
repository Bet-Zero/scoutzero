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

- [TypeScript Documentation Status](typescript/README.md) - current required docs, completed historical TypeScript campaign docs, and return-package evidence archives
- [TypeScript Hardening Completion Contract](typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md) - current maintenance gate for regressions
- [TypeScript return-package evidence archive](return_packages/typescript/) - execution evidence for the closed hardening campaign
- Do not reopen TypeScript hardening unless a documented gate regresses.

## Workspace Cleanup Standards

- [Documentation Structure Standard](workspace-rules/DOCUMENTATION_STRUCTURE_STANDARD.md) - canonical placement rules for permanent docs, working docs, archives, generated docs, and prompts.
- [Return Package Standard](workspace-rules/RETURN_PACKAGE_STANDARD.md) - canonical rules for new return packages under `docs/return_packages/`.
- [Workspace Guardrails](workspace-rules/WORKSPACE_GUARDRAILS.md) - concise do/don't checklist and validation commands for routing, return packages, working docs, and plans.
- [Workspace Cleanup Master](./_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md) - living tracker for cleanup phases and stale-link follow-up work.
- [Return Packages README](return_packages/README.md) - canonical return-package root.
- Stale-link cleanup is tracked by the workspace cleanup master doc; Phase 2 updated only return-package routing references.

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
- [Historical Architect Planning Bundle Router](architect-teams-plan/README.md) - points to the archived Architect planning/design bundle
- [Architect Gap Analysis](architect/ARCHITECT_GAP_ANALYSIS.md) - System analysis and improvements
- [Architect Schema Migration Review](architecture/ARCHITECT_SCHEMA_MIGRATION_REVIEW.md)
- [Schema Migration Guide](architecture/SCHEMA_MIGRATION_GUIDE.md) - Old-to-new Architect schema guidance and compatibility patterns
- [Contract Normalization Rules](CONTRACT_NORMALIZATION_RULES.md)

**Migration Documentation:**

- [Teams to Architect Migration](migrations/teams-to-architect/TARGET_SCHEMA.md)
- [Players v1 to v2 Migration](migrations/players-v1-to-v2/README.md)
- [Firestore Schema V2](migrations/players-v1-to-v2/FIRESTORE_SCHEMA_V2.md)

### 🛠️ Development Guides

Information for developers working on the codebase:

- [Developer Guide](guides/DEVELOPER_GUIDE.md) - Setup, architecture, patterns
- [Codebase Audit (Feb 2026)](CODEBASE_AUDIT_2026-02.md) - Structural improvements
- [Testing Guide](TESTING.md) - Testing strategy and commands
- [Scripts Reference](SCRIPTS.md) - npm and workflow scripts

**Directory Structure:**

- `/docs/guides/` - Additional development guides
- `/docs/components/` - Component-specific documentation
- `/docs/architecture/` - System architecture details

### 📋 Runbooks & Operations

Step-by-step operational procedures:

- [Data Scrape Runbook](runbooks/data-scrape.md)
- [Manual Smoke Test Checklist](runbooks/MANUAL_SMOKE_TEST_CHECKLIST.md)
- [Fix Player Not Found](runbooks/FIX_PLAYER_NOT_FOUND.md)
- [Verify Before Delete](runbooks/VERIFY_BEFORE_DELETE.md)
- [Cutover Cleanup](runbooks/cutover-cleanup.md)
- [Application Integration Notes](runbooks/application-integration-notes.md)
- [Application Integration Verification](runbooks/application-integration-verification.md)

### 🎮 Features

Feature-specific documentation:

- [Roster Builder Quick Master](features/roster_builder_quick_MASTER.md)
- [Lists Master](features/lists_MASTER.md)
- [Tiermaker Tieramid Master](features/tiermaker_tieramid_MASTER.md)

### 🏀 Trade Machine

Trade machine implementation and audits:

- [Trade Machine Audit](TRADE_MACHINE_AUDIT.md) - Comprehensive system audit (Jan 2026)
- [Trade Machine Docs Router](tradeMachine/README.md) - Current cross-feature trade-machine docs and mixed historical carry-forwards
- [Return Packages README](return_packages/README.md) - Canonical routing for current return-package deliverables

### 🧭 Legacy Routed Areas

These paths exist mainly as compatibility routers after cleanup passes:

- [Cap Sheet Docs Router](capSheet/README.md) - routes older cap-sheet links to the active Architect cap-sheet docs
- [Historical Architect Planning Router](architect-teams-plan/README.md) - routes to archived Architect planning material

### 📜 Compliance & CBA Rules

NBA Collective Bargaining Agreement implementation:

- `/docs/compliance/` - CBA rule documentation and implementation

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

### 📦 Return Packages (Deliverables)

Historical project deliverables and execution documentation.

**Canonical location**: `/docs/return_packages/` - See [Return Packages README](return_packages/README.md)

**Phase 2 status:**

- New return packages belong under `/docs/return_packages/<area>/`.
- Legacy root return-package markdown evidence was consolidated into `/docs/return_packages/docs/` and `/docs/return_packages/typescript/` in Phase 2.
- The legacy root evidence location is no longer the active evidence location.
- Current cleanup initiative return packages live in `/docs/return_packages/workspace-cleanup/`.

**See**:

- [Return Packages README](return_packages/README.md) for canonical routing.
- [Return Package Standard](workspace-rules/RETURN_PACKAGE_STANDARD.md) for naming and content rules.
- [Workspace Cleanup Master](./_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md) for deferred consolidation and stale-link repair work.
- [Architect Return Packages](return_packages/architect/) and [Team-Scrape Return Packages](return_packages/team-scrape/) for feature-specific execution evidence moved out of active feature roots.

### 🚀 Launch & Deployment

Production deployment documentation:

- [Firestore Rules Flip Checklist](launch/FIRESTORE_RULES_FLIP_CHECKLIST.md)

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
├── CODEBASE_AUDIT_2026-02.md
├── CONTRIBUTING.md             # Contribution guidelines
├── TESTING.md                  # Testing strategy
├── SCRIPTS.md                  # npm scripts reference
├── architect/                  # Active Architect runtime + feature routers
├── architecture/               # System architecture
├── capSheet/                   # Legacy Cap Sheet router
├── commands/                   # CLI commands
├── compliance/                 # CBA rules and compliance
├── components/                 # Component docs
├── cursor-prompts/             # AI assistant prompts
├── features/                   # Feature documentation
├── guides/                     # Development guides
├── launch/                     # Deployment docs
├── migrations/                 # Data migration docs
├── project/                    # Project management
├── return_packages/            # Deliverables (consolidated)
├── runbooks/                   # Operational procedures
├── schema/                     # Schema documentation
├── scouting/                   # Scouting features
├── team-scrape/                # Team scraping pipeline
├── templates/                  # Document templates
├── tradeMachine/               # Cross-feature trade-machine docs + router
└── workspace-rules/            # Workspace configuration
```

---

## 🔍 Quick Links by Topic

### For Bug Fixes

1. Check relevant runbooks in `/docs/runbooks/`
2. Review [Trade Machine Audit](TRADE_MACHINE_AUDIT.md) for known issues
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

1. [Fix Player Not Found](runbooks/FIX_PLAYER_NOT_FOUND.md)
2. [Data Scrape Runbook](runbooks/data-scrape.md)
3. Team scrape docs in `/docs/team-scrape/`

### For Deployment

1. [Launch Checklist](launch/FIRESTORE_RULES_FLIP_CHECKLIST.md)
2. [Manual Smoke Test](runbooks/MANUAL_SMOKE_TEST_CHECKLIST.md)
3. [Verify Before Delete](runbooks/VERIFY_BEFORE_DELETE.md)

---

## 🆘 Need Help?

- **Can't find what you're looking for?** Use your IDE's search (Cmd/Ctrl+Shift+F) to search all markdown files
- **Unclear documentation?** Check [Developer Guide](guides/DEVELOPER_GUIDE.md) or [Project Schema](architecture/PROJECT_SCHEMA.md)
- **Need to understand the codebase?** Start with [Codebase Audit](CODEBASE_AUDIT_2026-02.md)

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
