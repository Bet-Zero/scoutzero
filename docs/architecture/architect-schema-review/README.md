# Architect Firestore Schema v2 - Review Package

This folder contains a comprehensive review of the proposed Firestore schema v2 for the HoopZero Architect feature.

## 📁 Documents in This Review

### [01-SUMMARY.md](./01-SUMMARY.md)
- **Goal**: What the schema aims to accomplish
- **Plan**: High-level architectural approach
- **Purpose**: Problems being solved and benefits

### [02-SAMPLE-SCHEMAS.md](./02-SAMPLE-SCHEMAS.md)
- **Base Team Schema**: Real NBA team structure
- **Base Player Schema**: Real NBA player structure  
- **World Team Document**: Team-level overrides
- **World Player Override**: Player-level contract changes
- **Worked Examples**: Trade and extension scenarios

### [03-FILE-TREE.md](./03-FILE-TREE.md)
- **Complete Firestore Hierarchy**: Full collection structure
- **Document Existence Rules**: When docs are created
- **Storage Efficiency Examples**: Real-world scenarios
- **Read Path Examples**: Code samples for data access
- **Migration Path**: Converting from current structure

### [04-COMPREHENSIVE-REVIEW.md](./04-COMPREHENSIVE-REVIEW.md)
- **Executive Summary**: Does it work? Is it good? Is there better?
- **Critical Analysis**: Issues, concerns, and risks
- **Performance Analysis**: Read/write/storage metrics
- **Recommended Improvements**: Hybrid snapshot approach
- **Alternative Approaches**: Other designs considered
- **Implementation Roadmap**: Phased rollout plan
- **Final Verdict**: Detailed conclusion with success criteria

### [05-VISUAL-DIAGRAMS.md](./05-VISUAL-DIAGRAMS.md)
- **System Architecture**: High-level component diagram
- **Read Flow Comparison**: Proposed vs recommended approaches
- **Write Flow**: Trade execution with snapshot generation
- **Data Layer Structure**: Complete Firestore hierarchy visual
- **Storage Comparison**: Real-world scenarios with metrics
- **Query Complexity**: Side-by-side performance analysis
- **Snapshot Regeneration**: Background process flow

## 🎯 Quick Answers

### Does it accomplish the stated goal?
**✅ YES** - The schema successfully creates isolated "world" scenarios with diff-based storage against an immutable baseline.

### Is it a good way to accomplish it?
**⚠️ PARTIALLY** - Strong architectural foundation with notable performance concerns (read complexity, cached totals fragility).

### Is there a better way?
**💡 YES** - Hybrid approach recommended:
- **Diffs** as source of truth (storage efficient)
- **Snapshots** for reads (performance)
- **Metadata** for UX (world management)
- **Action logs** for features (undo, audit trail)

## 🔑 Key Findings

### Strengths ✅
1. **Immutable base layer** - Excellent data safety
2. **Diff-only storage** - Very storage efficient (86% reduction)
3. **Clear separation** - Base vs world isolation is clean
4. **Scalable design** - Supports multiple worlds elegantly

### Concerns 🔴
1. **Read performance** - Up to 900 queries for league view (vs 30 currently)
2. **Cached totals** - Risk of staleness and calculation errors
3. **Migration complexity** - Diff extraction is non-trivial
4. **Missing metadata** - No world creator, name, branching info

### Recommended Solution 💡

```
/architect/worlds/{worldId}
  ├── metadata              # World info (NEW)
  ├── snapshot/             # Denormalized state for fast reads (NEW)
  │   ├── teams/           
  │   └── players/         
  ├── diffs/                # Source of truth (from proposal)
  │   └── teams/
  │       └── {teamCode}/
  │           ├── teamDoc
  │           └── players/
  └── actions/              # Action history (NEW)
      └── {actionId}
```

**Benefits**:
- Fast reads (1 query per team, like current system)
- Efficient storage (diffs are small)
- Clear audit trail (diffs + action log)
- Easy to rebuild (snapshot from base + diffs)

## 📊 Performance Comparison

| Metric | Current | Proposed | Recommended |
|--------|---------|----------|-------------|
| **League View Reads** | 30 queries | ~900 queries | 30 queries |
| **Team View Reads** | 1 query | ~30 queries | 1 query |
| **Storage per World** | 15 MB | 80 KB | 2.1 MB |
| **Write Latency** | Fast | Fast | Medium |
| **Read Latency** | Fast | Slow | Fast |

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- Create base collections
- Implement world metadata
- Build diff extraction
- Create snapshot generation

### Phase 2: Core Functionality (Week 3-4)
- World CRUD operations
- Read logic (snapshot-based)
- Write logic (diff + snapshot)
- Action logging

### Phase 3: Migration (Week 5-6)
- Shadow deploy (parallel write)
- Validation testing
- Batch migrate worlds
- Cutover to new schema

### Phase 4: Optimization (Week 7-8)
- Add caching if needed
- Optimize snapshot regen
- Background NBA sync
- Performance tuning

## ⚠️ Critical Warnings

### Do NOT Implement As-Is
The pure diff-based read approach will cause:
- **30× more Firestore reads** (expensive $$)
- **Slow UI** (network latency compounds)
- **Complex client code** (error-prone merge logic)
- **Cache fragility** (pre-computed totals can drift)

### DO Implement These Changes
1. Add **snapshot layer** for reads
2. Add **world metadata** document
3. Add **action history** collection
4. **Compute totals on-demand** (no cache initially)
5. Test **diff extraction** extensively

## 📝 How to Use This Review

### For Product/Design
- Read: [01-SUMMARY.md](./01-SUMMARY.md) for goals and purpose
- Read: [04-COMPREHENSIVE-REVIEW.md](./04-COMPREHENSIVE-REVIEW.md) executive summary
- View: [05-VISUAL-DIAGRAMS.md](./05-VISUAL-DIAGRAMS.md) for architecture overview

### For Engineering
- Read: [03-FILE-TREE.md](./03-FILE-TREE.md) for structure
- Read: [02-SAMPLE-SCHEMAS.md](./02-SAMPLE-SCHEMAS.md) for examples
- Read: [04-COMPREHENSIVE-REVIEW.md](./04-COMPREHENSIVE-REVIEW.md) sections 2-6 for technical analysis
- View: [05-VISUAL-DIAGRAMS.md](./05-VISUAL-DIAGRAMS.md) for read/write flows

### For Implementation
- Start with: [04-COMPREHENSIVE-REVIEW.md](./04-COMPREHENSIVE-REVIEW.md) section 9 (recommendations)
- Reference: [03-FILE-TREE.md](./03-FILE-TREE.md) migration steps
- Follow: Implementation roadmap in section 9
- Understand: [05-VISUAL-DIAGRAMS.md](./05-VISUAL-DIAGRAMS.md) snapshot regeneration

## 🤔 Decision Points

### Should We Adopt This Schema?
**YES**, with modifications:
- ✅ Core architecture (base + worlds) is excellent
- ⚠️ Must add snapshot layer for performance
- ✅ Metadata and action logs are essential
- ⚠️ Migration needs careful testing

### When Should We Implement?
**After validating**:
- [ ] Snapshot generation performance (< 1s per team)
- [ ] Diff extraction correctness (all edge cases)
- [ ] Migration path (test on sample worlds)
- [ ] Security rules (prevent base data writes)

### What Are the Risks?
1. **Performance**: Snapshot regen could be slow (mitigate: Cloud Functions)
2. **Complexity**: More moving parts (mitigate: extensive testing)
3. **Migration**: Could corrupt data (mitigate: shadow deploy, rollback plan)

## 📚 Additional Resources

- [Current Architect Implementation](../ARCHITECT_REVIEW.md)
- [Architect Agent Guidelines](../ARCHITECT_AGENTS.md)
- [Current Firebase Helpers](/home/runner/work/scoutzero/scoutzero/src/utils/architect/firebaseTeamPlanHelpers.js)
- [Existing Team Plans Schema](/home/runner/work/scoutzero/scoutzero/src/utils/architect/)

---

## Final Recommendation

**Proceed with a hybrid snapshot + diff implementation**. The proposed schema's core concept (immutable base + diff worlds) is sound, but needs performance-oriented modifications. The recommended approach maintains the proposal's data integrity benefits while achieving production-ready read performance.

**Priority**: Validate snapshot generation performance before full commitment. If snapshot regen is slow (>2s per team), consider alternative optimizations (selective denormalization, aggressive caching, or different read patterns).

**Timeline**: 6-8 weeks to production-ready with staged rollout and validation.

**Success Criteria**:
- ✅ Read performance matches current system
- ✅ Storage efficiency achieves 80%+ reduction
- ✅ Zero corruption of real NBA data
- ✅ All user worlds migrate successfully
