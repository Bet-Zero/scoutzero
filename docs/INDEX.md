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

## TypeScript Status

- [TypeScript Documentation Status](typescript/README.md) - current TypeScript routing, maintenance rules, and historical document map
- [TypeScript Hardening Completion Contract](typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md) - current maintenance gate for regressions
- Historical TypeScript campaign docs remain in the repo as evidence and should not be resumed unless one of the maintenance gates regresses.

---

## 📚 Documentation Categories

### 🏗️ Architecture & Schema

Core system architecture and data models:

- [Project Schema](architecture/PROJECT_SCHEMA.md) - Complete data structures and relationships
- [Architect Gap Analysis](ARCHITECT_GAP_ANALYSIS.md) - System analysis and improvements
- [Architect Schema Migration Review](architecture/ARCHITECT_SCHEMA_MIGRATION_REVIEW.md)
- [Contract Normalization Rules](CONTRACT_NORMALIZATION_RULES.md)
- [New Schema Validator Review](new-schema-validator-review.md)

**Migration Documentation:**

- [Teams to Architect Migration](migrations/teams-to-architect/TARGET_SCHEMA.md)
- [Players v1 to v2 Migration](migrations/players-v1-to-v2/README.md)
- [Firestore Schema V2](migrations/players-v1-to-v2/FIRESTORE_SCHEMA_V2.md)

### 🛠️ Development Guides

Information for developers working on the codebase:

- [Developer Guide](guides/DEVELOPER_GUIDE.md) - Setup, architecture, patterns
- [Codebase Audit (Feb 2026)](CODEBASE_AUDIT_2026-02.md) - Structural improvements
- [Architect Phase 5 Hardening](ARCHITECT_PHASE5_HARDENING.md)
- [Stats Scraper Fix](STATS_SCRAPER_FIX.md)

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

- [Trade Machine Audit](audits/TRADE_MACHINE_AUDIT.md) - Comprehensive system audit (Jan 2026)
- [Trade Machine Fix Plan](audits/TRADE_MACHINE_FIX_PLAN.md) - Implementation plan
- `/docs/tradeMachine/` - Additional trade machine docs
- `/docs/tradeMachine/return-packages/` - Trade machine deliverables

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

**📂 Main Location**: `/docs/return_packages/` - See [Return Packages README](return_packages/README.md)

**Organized by Subsystem:**

- `/docs/return_packages/` - General deliverables (165+ packages)
- `/docs/return_packages/architect/` - GM dashboard & trade machine (107 packages)
- `/docs/return_packages/scouting/` - Player scouting features (33 packages)
- `/docs/return_packages/tradeMachine/` - Trade machine specific (15 packages)
- `/docs/team-scrape/return_packages/` - Team data pipeline (46 packages)

**Recent Highlights:**

- [Draft Asset Trading Closure](return_packages/DRAFT_ASSET_TRADING_CLOSURE_EXECUTION_RETURN_PACKAGE.md)
- [Phase D4 True E2E Emulator Gate](return_packages/PHASE_D4_TRUE_E2E_EMULATOR_GATE_RETURN_PACKAGE.md)
- [Offseason Transition Engine](return_packages/OFFSEASON_TRANSITION_ENGINE_EXECUTION_RETURN_PACKAGE.md)
- [Draft Picks DAL Swap Controller Fix](return_packages/DRAFT_PICKS_DAL_SWAP_CONTROLLER_FIX__EXECUTION__2026-01-10.md)

**See**: [Return Packages README](return_packages/README.md) for naming conventions, templates, and how to create new packages.

**Note**: Consolidated February 12, 2026 from multiple locations into single underscore-named structure.

### 🚀 Launch & Deployment

Production deployment documentation:

- [Firestore Rules Flip Checklist](launch/FIRESTORE_RULES_FLIP_CHECKLIST.md)

### 📊 Data Pipelines

Data scraping and pipeline documentation:

- `/docs/team-scrape/` - Team data scraping documentation
- `/docs/team-scrape/audits/` - Team scrape audits

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
├── architect/                  # Architect subsystem docs
├── architecture/               # System architecture
├── capSheet/                   # Cap sheet documentation
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
├── tradeMachine/               # Trade machine docs
└── workspace-rules/            # Workspace configuration
```

---

## 🔍 Quick Links by Topic

### For Bug Fixes

1. Check relevant runbooks in `/docs/runbooks/`
2. Review [Trade Machine Audit](audits/TRADE_MACHINE_AUDIT.md) for known issues
3. Check return packages for similar fixes

### For New Features

1. Review [Project Schema](architecture/PROJECT_SCHEMA.md) for data model
2. Check [Developer Guide](guides/DEVELOPER_GUIDE.md) for patterns
3. Review feature docs in `/docs/features/`

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

- **Root-level docs**: High-level guides and entry points
- **`/docs` subdirectories**: Organized by topic and subsystem
- **Return packages**: Historical deliverables with execution details
- **Runbooks**: Step-by-step operational procedures
- **MASTER suffix**: Authoritative feature documentation

---

**Last Updated**: May 2, 2026
**Maintainers**: See [CONTRIBUTING.md](CONTRIBUTING.md)
