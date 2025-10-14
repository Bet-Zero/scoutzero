# Architect Schema v2 - Executive Summary

## TL;DR

**Should you implement the proposed schema?** ✅ **YES, with modifications**

**Main Issue:** Pure diff-based reads are 30× slower than current system  
**Solution:** Add snapshot layer for performance while keeping diffs as source of truth  
**Timeline:** 6-8 weeks with staged rollout  
**Storage Savings:** 50% vs current (with snapshots) or 96% (pure diffs)

---

## The Proposal in 60 Seconds

### What It Does
Creates a lean Firestore schema where:
- Real NBA data is **immutable** (`/architect/baseTeams`, `/architect/basePlayers`)
- User "worlds" store only **diffs** from the base (`/architect/worlds/{id}/diffs`)
- Each world represents a "what-if" GM scenario (trades, extensions, etc.)

### Why It's Good
1. **Data Safety** - Can't corrupt real NBA data
2. **Storage Efficient** - Only stores what changes
3. **Clean Separation** - Clear boundary between real and simulated
4. **Scalable** - Easy to sync real NBA updates without breaking user worlds

### The Problem
Reading data requires:
- Check world for overrides → if not found → fallback to base
- **For 30 teams × 15 players = ~900 queries** (vs 30 currently)
- Result: Slow UI, high Firestore costs, complex merge logic

---

## The Recommended Fix

### Hybrid Snapshot + Diff System

```
/architect/worlds/{worldId}/
  ├── metadata          # World info (name, creator, date)
  ├── diffs/            # SOURCE OF TRUTH (what changed)
  ├── snapshot/         # DENORMALIZED (for fast reads)
  └── actions/          # AUDIT LOG (what happened)
```

**How It Works:**
1. **Writes** → Update diffs (source of truth)
2. **Writes** → Regenerate snapshot (complete merged state)
3. **Reads** → Use snapshot (fast, 1 query per team)
4. **NBA Updates** → Update base → Regenerate snapshots

**Benefits:**
- ✅ Reads as fast as current system (1 query per team)
- ✅ Storage 50% smaller than current (vs 86% with pure diffs)
- ✅ Clear audit trail (diffs show exactly what changed)
- ✅ Resilient (can rebuild snapshots from base + diffs)

**Trade-offs:**
- ⚠️ Writes are slower (need to regenerate snapshot)
- ⚠️ More storage than pure diffs (but way less than current)
- ⚠️ Background process needed (regenerate on NBA updates)

---

## Key Metrics Comparison

### Read Performance (League View - 30 Teams)
- **Current System:** 30 queries → ~100ms ✅
- **Proposed Pure Diff:** 960 queries → ~5-10 seconds ❌
- **Recommended Hybrid:** 30 queries → ~100ms ✅

### Storage per World (Typical: 1 trade affecting 2 teams)
- **Current System:** 1.5 MB (full copies) 📦
- **Proposed Pure Diff:** 20 KB (diffs only) 📦✨
- **Recommended Hybrid:** 1 MB (snapshots + diffs) 📦✅

### Write Performance (Single Trade)
- **Current System:** 2 writes → fast ⚡
- **Proposed Pure Diff:** 2 writes → fast ⚡
- **Recommended Hybrid:** 4+ writes → medium ⏱️

**Winner:** Hybrid approach balances read speed with storage efficiency.

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Migrate teams/players to base collections
- [ ] Create world metadata structure
- [ ] Build diff extraction utilities
- [ ] Implement snapshot generation logic

### Phase 2: Core Functionality (Week 3-4)
- [ ] World CRUD operations (create, read, update, delete)
- [ ] Read logic (snapshot-based with base fallback)
- [ ] Write logic (update diffs + regenerate snapshot)
- [ ] Action logging system

### Phase 3: Migration (Week 5-6)
- [ ] Shadow deploy (write to both old and new)
- [ ] Validation (compare old vs new results)
- [ ] Batch migrate existing user worlds
- [ ] Cutover to new schema

### Phase 4: Optimization (Week 7-8)
- [ ] Performance tuning (caching, batching)
- [ ] Optimize snapshot regeneration
- [ ] Background sync for NBA updates
- [ ] Monitoring and alerting

---

## Critical Warnings

### ❌ DO NOT Implement Pure Diff Reads
The proposal's read approach will cause:
- 30× more Firestore queries (expensive)
- 5-10 second load times (poor UX)
- Complex client-side merge logic (error-prone)

### ✅ DO Implement These Changes
1. **Add snapshot layer** for read performance
2. **Add world metadata** for UX (world name, creator, date)
3. **Add action history** for audit trail and features
4. **Compute totals on-demand** (avoid cached totals initially)
5. **Test diff extraction** extensively before migration

---

## Decision Checklist

Before implementing, validate:

- [ ] **Snapshot generation performance** (<1s per team)
- [ ] **Diff extraction correctness** (handles all edge cases)
- [ ] **Migration safety** (tested on sample data, rollback plan ready)
- [ ] **Security rules** (prevent client writes to base collections)
- [ ] **Background job** (snapshot regen on NBA updates)

---

## Success Criteria

The new schema succeeds if:

1. ✅ **Read performance** matches current system (<200ms p95 for team view)
2. ✅ **Storage efficiency** achieves 50%+ reduction per world
3. ✅ **Data integrity** - Zero corruption of real NBA data
4. ✅ **Migration success** - 100% of user worlds migrate correctly
5. ✅ **Maintainability** - Clear separation, well-documented, testable

---

## Quick Links

- **Full Review:** [04-COMPREHENSIVE-REVIEW.md](./04-COMPREHENSIVE-REVIEW.md)
- **Visual Diagrams:** [05-VISUAL-DIAGRAMS.md](./05-VISUAL-DIAGRAMS.md)
- **Schema Samples:** [02-SAMPLE-SCHEMAS.md](./02-SAMPLE-SCHEMAS.md)
- **File Tree:** [03-FILE-TREE.md](./03-FILE-TREE.md)
- **Navigation:** [README.md](./README.md)

---

## Final Recommendation

**Proceed with implementation** using the hybrid snapshot + diff approach.

The proposed schema's **core concept is excellent** (immutable base + diff worlds), but requires the **snapshot layer for production performance**. With this modification, you get:

- ✅ Data safety and clean separation (proposal's strength)
- ✅ Read performance matching current system (fixes proposal's weakness)
- ✅ Significant storage savings (50% reduction)
- ✅ Clear audit trail and extensibility (action logs, metadata)

**Risk Level:** Medium (requires careful migration testing)  
**Reward Level:** High (enables multi-world scenarios, preserves NBA data integrity)  
**Timeline:** Realistic for 6-8 week delivery with proper planning

---

**Questions?** See the [comprehensive review](./04-COMPREHENSIVE-REVIEW.md) for detailed technical analysis, performance metrics, and alternative approaches.
