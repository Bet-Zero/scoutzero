# Architect Schema Documentation Index

## 📚 Documentation Overview

This directory contains the complete Firestore schema proposal for the **HoopZero Architect** feature. The documentation is organized into focused documents for different audiences and purposes.

---

## 🎯 Start Here

### New to Architect?
**→ Read: [ARCHITECT_SCHEMA_SUMMARY.md](./ARCHITECT_SCHEMA_SUMMARY.md)**

Executive summary with:
- Core principle (transaction log architecture)
- Collection structure overview
- Storage comparison
- Key advantages
- Quick start examples

---

## 📖 Detailed Documentation

### 1. Complete Schema Specification
**→ Read: [ARCHITECT_FIRESTORE_PROPOSAL.md](./ARCHITECT_FIRESTORE_PROPOSAL.md)**

Comprehensive schema design including:
- Detailed collection structures
- Transaction type schemas (trade, signing, extension, waive)
- Security rules
- Performance optimizations
- Migration strategy
- Sample queries

### 2. Visual Diagrams & Data Flow
**→ Read: [ARCHITECT_DATA_FLOW.md](./ARCHITECT_DATA_FLOW.md)**

Visual representations of:
- Collection structure trees
- World creation flow
- Trade execution flow
- World loading flow
- Transaction application logic
- Storage efficiency comparisons

### 3. Implementation Guide
**→ Read: [ARCHITECT_IMPLEMENTATION.md](./ARCHITECT_IMPLEMENTATION.md)**

Practical code examples:
- Core helper functions (worldHelpers.js, transactionHelpers.js, stateHelpers.js)
- GMDashboard integration example
- Migration script from old structure
- Complete working code samples

---

## 🏗️ Product Context

### Product Vision & Roadmap
**→ Read: [ARCHITECT_REVIEW.md](./ARCHITECT_REVIEW.md)**

Product design document covering:
- Architect feature vision (GM simulator)
- Saved worlds concept
- Phase roadmap (Solo → Tools → Multiplayer → AI)
- Realism vs. fun stance
- Data sync strategy

### Agent Instructions
**→ Read: [ARCHITECT_AGENTS.md](./ARCHITECT_AGENTS.md)**

Rules for AI agents and contributors:
- Worlds/universe principles
- Firestore safety rules
- CBA compliance requirements
- MVP scope
- Safety and rollback guidelines

---

## 🗂️ General Firestore Schema

### Current Schema Reference
**→ Read: [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md)**

Complete schema for all collections:
- `/players_v2/{playerId}` - Player data with subcollections
- `/teams/{teamId}` - Team cap sheets (NBA baseline)
- `/worlds/{worldId}` - Architect GM worlds (NEW)
- `/users/{userId}` - User profiles and indices
- Other collections (lists, tierLists, etc.)

---

## 🚀 Quick Reference

### Key Concepts

| Concept | Description |
|---------|-------------|
| **World** | Independent GM sandbox with isolated transaction log |
| **Baseline** | Immutable real NBA data in `/teams/` (read-only) |
| **Transaction** | Single GM move (trade, signing, extension, waive) |
| **Current State** | Computed: `baseline + apply(transactions)` |
| **Transaction Log** | Chronological record of all moves in a world |

### File Size Guide

- **Baseline (shared)**: ~500KB per team
- **World metadata**: ~5KB
- **Transaction**: ~5-10KB each
- **Full plan (old)**: ~500KB (duplicated)
- **Transaction log plan (new)**: ~70KB (10 transactions)

### Storage Efficiency

| Plans | Old Approach | New Approach | Savings |
|-------|--------------|--------------|---------|
| 5 plans | 2.5MB | 850KB | **66%** |
| 10 plans | 5.0MB | 1.2MB | **76%** |
| 100 plans | 50MB | 6.5MB | **87%** |

---

## 🔄 Migration Path

1. **Phase 1 - Dual Write**: Write to both old and new structures
2. **Phase 2 - Dual Read**: Read from new, fallback to old
3. **Phase 3 - Full Migration**: Deprecate old structure

**Migration Script**: See [ARCHITECT_IMPLEMENTATION.md](./ARCHITECT_IMPLEMENTATION.md#migration-script)

---

## 📋 Document Checklist

Use this checklist when implementing the Architect schema:

- [ ] Read [ARCHITECT_SCHEMA_SUMMARY.md](./ARCHITECT_SCHEMA_SUMMARY.md) for overview
- [ ] Review [ARCHITECT_FIRESTORE_PROPOSAL.md](./ARCHITECT_FIRESTORE_PROPOSAL.md) for detailed schema
- [ ] Study [ARCHITECT_DATA_FLOW.md](./ARCHITECT_DATA_FLOW.md) for data flow patterns
- [ ] Reference [ARCHITECT_IMPLEMENTATION.md](./ARCHITECT_IMPLEMENTATION.md) for code examples
- [ ] Understand [ARCHITECT_REVIEW.md](./ARCHITECT_REVIEW.md) product vision
- [ ] Follow [ARCHITECT_AGENTS.md](./ARCHITECT_AGENTS.md) safety rules
- [ ] Update [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md) when implementing

---

## 🎯 Implementation Priority

### Phase 1: Core Infrastructure (Week 1-2)
1. Implement helper functions (worldHelpers, transactionHelpers, stateHelpers)
2. Create world management UI
3. Test with sample data
4. Deploy in dual-write mode

### Phase 2: Transaction Types (Week 3-4)
1. Trade transactions
2. Free agent signing transactions
3. Extension transactions
4. Waive/release transactions

### Phase 3: Migration (Week 5-6)
1. Write migration script
2. Test migration with sample users
3. Deploy dual-read mode
4. Complete migration
5. Deprecate old structure

### Phase 4: Advanced Features (Week 7+)
1. Undo/redo functionality
2. World branching
3. Comparison tools
4. Export/import worlds

---

## 💡 Best Practices

### When Creating Worlds
- Use descriptive names: "Lakers 2025 - Championship Run"
- Tag worlds for organization: ["playoff-run", "rebuild"]
- Archive old worlds instead of deleting (preserve history)

### When Executing Transactions
- Always validate before executing
- Store validation results in transaction details
- Include timestamps for debugging

### When Computing State
- Cache baseline data (1 hour TTL)
- Use snapshots for worlds with 100+ transactions
- Implement pagination for transaction history

### Security
- Never expose other users' worlds
- Validate userId matches auth.uid in all operations
- Keep baseline data read-only

---

## 🐛 Troubleshooting

### World Not Loading?
1. Check worldId exists in `/worlds/`
2. Verify userId matches world owner
3. Ensure baseline team data exists
4. Check Firestore security rules

### State Not Updating?
1. Verify transaction was written successfully
2. Check transaction status is "completed"
3. Ensure applyTransaction() handles the type correctly
4. Validate baseline data is correct

### Performance Issues?
1. Enable Firestore offline persistence
2. Implement caching for baseline data
3. Create snapshots for large transaction logs
4. Paginate transaction history loads

---

## 📞 Support

- **Questions**: Check [ARCHITECT_SCHEMA_SUMMARY.md FAQ](./ARCHITECT_SCHEMA_SUMMARY.md#faq)
- **Implementation Help**: See [ARCHITECT_IMPLEMENTATION.md](./ARCHITECT_IMPLEMENTATION.md)
- **Product Questions**: Refer to [ARCHITECT_REVIEW.md](./ARCHITECT_REVIEW.md)

---

**Last Updated**: 2025  
**Status**: ✅ Proposal Complete - Ready for Implementation
