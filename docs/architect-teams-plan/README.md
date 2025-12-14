# Architect Teams Plan Documentation

This folder contains the complete planning documentation for the Architect Teams Plan feature.

## 🎯 What is Architect?

Architect is a **multi-season NBA roster scenario planning system** that enables users to:
- Create and manage multiple "what-if" scenarios with branching decision trees
- Simulate roster decisions across multiple seasons with full CBA accuracy
- Track contract changes, cap space evolution, and player moves over time
- Compare different decision paths side-by-side

## 📚 Documentation Structure

### Start Here
1. **`00-IMPLEMENTATION-STATUS.md`** ⭐ - **Current status and what to do next**
2. **`01-GOALS.md`** - Project goals, requirements, and success criteria
3. **`02-CURRENT-STATUS.md`** - What exists today vs what we're building
4. **`03-TARGET-SCHEMA.md`** - Complete Firestore schema with examples
5. **`04-HOW-IT-WORKS.md`** - How the architecture achieves each goal
6. **`05-SAVE-LOAD-LOGIC.md`** - Implementation patterns for reading/writing data
7. **`06-COMPREHENSIVE-SUMMARY.md`** - Consolidated reference
8. **`07-IMPLEMENTATION-PLAN.md`** - Step-by-step implementation guide

### Quick Access

**For Implementation**:
- Read `architect-plan-summary/EXECUTION-PROMPT.md` for implementation tasks
- Follow Phase 2-4 in `07-IMPLEMENTATION-PLAN.md`

**For Understanding**:
- Read `01-GOALS.md` for the vision
- Read `04-HOW-IT-WORKS.md` for architecture
- Read `06-COMPREHENSIVE-SUMMARY.md` for the full picture

**For Schema Reference**:
- Canonical: `src/schemas/architect.ts` (Zod definitions)
- Generated docs: `docs/schema/architect.md`
- Detailed examples: `03-TARGET-SCHEMA.md`

## 🏗️ Architecture Overview

### Collections Structure
```
/architect/                         # ALL Architect data
  baseTeams/{teamCode}             # 30 teams, immutable baseline
  basePlayers/{playerId}           # 530 players, immutable baseline
  worlds/{worldId}/metadata        # World management
  worlds/{worldId}/snapshot/teams/{teamCode}  # Only modified teams
```

### Key Principles
- **Immutable base**: Real NBA data never modified
- **Copy-on-write**: Only snapshot what changes (93% storage savings)
- **Fallback chain**: World → Parent → Base for reads
- **Atomic operations**: All-or-nothing commits

## 📊 Current Status

**Phase 1**: Foundation & Planning ✅ **COMPLETE**  
**Phase 2**: Data Migration - **Ready to start**  
**Phase 3**: Core Implementation - Not started  
**Phase 4**: UI & Polish - Not started

See `00-IMPLEMENTATION-STATUS.md` for detailed status.

## 🔗 Related Documentation

- **Summaries**: `architect-plan-summary/` - Agent-friendly condensed versions
- **Schemas**: `src/schemas/architect.ts` - Canonical Zod schemas
- **Schema Docs**: `docs/schema/architect.md` - Architect schema documentation
- **Current State**: `docs/schema/CURRENT_FIRESTORE_SCHEMA.md` - Active collections

---

**Last Updated**: November 1, 2025  
**Status**: Planning Complete, Implementation In Progress

