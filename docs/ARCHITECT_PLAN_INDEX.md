# Architect Plan Documentation Index

> **One-stop reference for all Architect feature planning and implementation**

---

## 🎯 What is Architect?

Architect is a **multi-season NBA roster scenario planning system** that enables users to:

- Create and manage multiple "what-if" scenarios with **branching decision trees**
- Simulate roster decisions across **multiple seasons** with full CBA accuracy
- Track contract changes, cap space evolution, and player moves over time
- Compare different decision paths side-by-side without losing work

---

## 📍 Quick Navigation

### For Understanding the Vision

📁 **`docs/architect-teams-plan/`** → Full planning documentation

- Start with `01-GOALS.md` or `README.md`

### For Implementation

📁 **`architect-plan-summary/EXECUTION-PROMPT.md`** ⭐

- Start here for immediate tasks and checklists

### For Current Status

📁 **`docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md`** ⭐

- See what's done, what's next, what's missing

### For Schema Reference

📁 **Canonical**: `src/schemas/architect.ts`  
📁 **Generated Docs**: `docs/schema/architect.md`  
📁 **Detailed Examples**: `docs/architect-teams-plan/03-TARGET-SCHEMA.md`

### For Concise Overview

📁 **`architect-plan-summary/COMBINED-SUMMARY.md`**

- All 7 planning documents synthesized

---

## 📚 Documentation Structure

### Main Planning Folder

**Location**: `docs/architect-teams-plan/`

| File                            | Purpose                                       | When to Read                  |
| ------------------------------- | --------------------------------------------- | ----------------------------- |
| **00-IMPLEMENTATION-STATUS.md** | Current status, what's implemented vs planned | **First** - Know where we are |
| README.md                       | Overview and navigation                       | Start here for orientation    |
| **01-GOALS.md**                 | What we're building and why                   | Understand the vision         |
| 02-CURRENT-STATUS.md            | What exists today                             | Context for migration         |
| 03-TARGET-SCHEMA.md             | Complete schema examples                      | Reference for structure       |
| 04-HOW-IT-WORKS.md              | Architecture patterns                         | Understand the design         |
| 05-SAVE-LOAD-LOGIC.md           | Implementation patterns                       | Before coding                 |
| 06-COMPREHENSIVE-SUMMARY.md     | Everything in one place                       | Deep dive                     |
| 07-IMPLEMENTATION-PLAN.md       | Step-by-step guide                            | During implementation         |

### Summary Folder

**Location**: `architect-plan-summary/`

| File                              | Purpose                | When to Read           |
| --------------------------------- | ---------------------- | ---------------------- |
| **EXECUTION-PROMPT.md**           | Implementation tasks   | **When starting work** |
| COMBINED-SUMMARY.md               | All docs condensed     | Quick overview         |
| 01-GOALS-SUMMARY.md               | Goals condensed        | Quick goals review     |
| 02-CURRENT-STATUS-SUMMARY.md      | Status condensed       | Quick context          |
| 03-TARGET-SCHEMA-SUMMARY.md       | Schema condensed       | Quick schema ref       |
| 04-HOW-IT-WORKS-SUMMARY.md        | Architecture condensed | Quick architecture     |
| 05-SAVE-LOAD-LOGIC-SUMMARY.md     | Logic condensed        | Quick patterns         |
| 06-COMPREHENSIVE-SUMMARY.md       | Reference condensed    | Quick reference        |
| 07-IMPLEMENTATION-PLAN-SUMMARY.md | Plan condensed         | Quick roadmap          |

---

## 🏗️ Architecture Overview

### Collections Structure

```
/architect/                         # ALL Architect data lives here
  baseTeams/{teamCode}             # 30 teams, ~1.5 MB (immutable baseline)
  basePlayers/{playerId}           # 530 players, ~2.65 MB (immutable baseline)
  worlds/{worldId}/metadata        # World management (~2 KB per world)
  worlds/{worldId}/snapshot/teams/{teamCode}  # Only modified teams (~50 KB each)
```

### Key Innovation: Hybrid Snapshot Architecture

**Core Concept**:

```
Immutable Base (Real NBA Data)
      ↓
User Worlds (Scenarios)
      ↓
Team Snapshots (Modified Teams Only)
      ↓
Player Overrides (Contract Changes Only)
```

**Storage Efficiency**: Only snapshot what changes

- 2-team trade = 2 snapshots (100 KB)
- Other 28 teams = read from base (zero storage)
- **Result: 93% storage savings**

**Read Pattern**: Fallback chain

1. Try world snapshot
2. Try parent world (if branched)
3. Fall back to base

---

## 📊 Current Implementation Status

### ✅ What's Complete

**Phase 1: Foundation & Planning**

- [x] All 7 planning documents written
- [x] Schema defined in `src/schemas/architect.ts`
- [x] Architecture fully designed

**Supporting Infrastructure**

- [x] Comprehensive CBA rule engine (`src/utils/architect/tradeMachine/`)
- [x] Team scraper (`team-scrape/scripts/parse_team.ts`)
- [x] Draft picks scraper (`team-scrape/scripts/realgm_draft_picks.ts`)
- [x] Merge script (`team-scrape/review_and_merge/scripts/merge_team_outputs.ts`)
- [x] Sample outputs for 5 teams
- [x] Basic UI components (GMDashboard, Cap Sheet, Trade Machine)

### ❌ What's Missing

**Phase 2: Data Migration** (Next Phase)

- [ ] Populate `/architect/baseTeams` collection
- [ ] Populate `/architect/basePlayers` collection
- [ ] Create Firestore upload scripts

**Phase 3: Core Implementation**

- [ ] World management (`worldManager.js`)
- [ ] Team data loader with fallback chain (`teamLoader.js`)
- [ ] Trade execution with snapshots (`tradeManager.js`)
- [ ] Season advancement logic
- [ ] Branching/forking system

**Phase 4: UI & Polish**

- [ ] World selector component
- [ ] Branch button
- [ ] Season navigator
- [ ] Decision tree visualization

---

## 🎯 Key Concepts

### Worlds

A "world" is a user's scenario - a parallel universe where NBA roster changes are simulated.

**Example**: User creates "Lakers 2026 Strategy" world, trades for a player, advances to next season, then branches into "Keep Him" and "Cut Him" scenarios.

### Branching (Copy-on-Write)

When a user creates a branch:

1. New world created with `parentWorldId`
2. No snapshots copied yet (zero storage)
3. First modification creates snapshots for affected teams only
4. Unaffected teams read from parent or base

**Efficiency**: Branch with one change = 50 KB (not 150 KB)

### Immutable Base

Real NBA data lives in `/architect/baseTeams` and `/architect/basePlayers` and is NEVER modified by users.

- `/players_v2` - Player scouting data (separate, immutable)
- `/teams` - Current team data (separate, immutable)
- `/architect/baseTeams` - Architect's immutable baseline
- `/architect/basePlayers` - Architect's immutable baseline

### Authoritative Paths

- **ONLY** Architect data lives under `/architect/`
- `/players_v2` and `/teams` are **NOT** part of Architect
- Legacy `/Teams` (Architect v1) is deprecated and will be removed

---

## 🔗 Related Documentation

### Migration Context

- **Players**: `players` → `players_v2` ✅ Complete
- **Teams**: `teams` → `/architect/` collections 🚧 Planned

See `docs/schema/CURRENT_FIRESTORE_SCHEMA.md` for full migration status.

### Supporting Docs

- `AGENTS.md` - Project conventions and coding standards
- `PROJECT_SCHEMA.md` - Repository structure and organization
- `team-scrape/README.md` - Data scraping documentation
- `docs/migrations/teams-to-architect/` - Teams migration details

---

## 🚀 Getting Started

### For Product Managers / Stakeholders

1. Read `docs/architect-teams-plan/01-GOALS.md`
2. Review `docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md`

### For Developers Starting Implementation

1. Read `architect-plan-summary/EXECUTION-PROMPT.md`
2. Check `docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md`
3. Follow Phase 2 in `docs/architect-teams-plan/07-IMPLEMENTATION-PLAN.md`

### For Developers Understanding the System

1. Read `architect-plan-summary/COMBINED-SUMMARY.md`
2. Deep dive into `docs/architect-teams-plan/06-COMPREHENSIVE-SUMMARY.md`
3. Reference `docs/architect-teams-plan/03-TARGET-SCHEMA.md` for details

### For Architects / Technical Leads

1. Read all 7 planning documents in order
2. Review `src/schemas/architect.ts` (canonical schema)
3. Understand fallback chain and copy-on-write patterns

---

## 📝 Quick Reference

### Schema Definitions

- **Canonical**: `src/schemas/architect.ts` (Zod)
- **Generated**: `docs/schema/architect.md`
- **Examples**: `docs/architect-teams-plan/03-TARGET-SCHEMA.md`

### Data Scraping

- **Team data**: `team-scrape/scripts/parse_team.ts`
- **Draft picks**: `team-scrape/scripts/realgm_draft_picks.ts`
- **Merge**: `team-scrape/review_and_merge/scripts/merge_team_outputs.ts`

### Trade Validation

- **Engine**: `src/utils/architect/tradeMachine/engine/`
- **Rules**: `src/utils/architect/tradeMachine/rules/`
- **Utils**: `src/utils/architect/tradeMachine/utils/`

---

## 🤝 Support

**Questions?** Check these in order:

1. This index
2. `docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md`
3. `architect-plan-summary/COMBINED-SUMMARY.md`
4. Full planning docs in `docs/architect-teams-plan/`

---

**Last Updated**: November 1, 2025  
**Status**: Planning Complete ✅ | Phase 2 (Data Migration) Ready to Start
