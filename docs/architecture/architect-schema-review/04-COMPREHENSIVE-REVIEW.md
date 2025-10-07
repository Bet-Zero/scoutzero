# Architect Firestore Schema v2 - Comprehensive Review

## Executive Summary

**Would this accomplish the stated goal?** ✅ **YES**

**Is this a good way to accomplish it?** ⚠️ **PARTIALLY** - Strong foundation with notable concerns

**Is there a better way?** 💡 **YES** - Refinements recommended (detailed below)

---

## 1. Interpretation & Key Understanding

### What This Proposal Does Well

#### 1.1 Immutable Base Layer ✅
The separation of real NBA data (`baseTeams`, `basePlayers`) from user modifications (`worlds`) is **excellent architecture**. This:
- Prevents corruption of source-of-truth data
- Enables clean updates to real NBA data without affecting user scenarios
- Provides clear audit trail of changes
- Aligns with the stated "alternate universe" concept

#### 1.2 Diff-Only Storage ✅
Storing only what changes is storage-efficient and conceptually clean:
- Typical trade affects 2-4 teams (2-4 docs vs 30)
- Player overrides are surgical (1 doc vs 530)
- Scales well as users create more worlds
- Clear signal-to-noise ratio (what changed vs what didn't)

#### 1.3 Hierarchical Organization ✅
The nested structure (`worlds → teams → players`) mirrors the logical hierarchy:
- Intuitive navigation
- Natural scoping (player overrides belong to team context)
- Supports team-level and player-level operations cleanly

### What This Proposal Attempts

The schema aims to create a **sandbox GM simulator** where:
- Users can create isolated "what-if" scenarios
- Each world stores only deltas from reality
- Reads merge world data with base data on-the-fly
- Writes update only affected entities

---

## 2. Critical Analysis - Issues & Concerns

### 2.1 🔴 MAJOR: Read Performance & Complexity

#### Problem: O(n) Player Lookups Per Roster
Every team read requires:
1. Get team doc (1 query)
2. For each of ~15 roster players:
   - Check world override (1 query)
   - If not found, get base (1 query)
   - Merge if needed

**For a single team**: 1 + (15 × 2) = **~30 queries** worst case

**For league view (30 teams)**: 30 × 30 = **~900 queries**

#### Impact
- Firestore billing scales with reads
- Latency compounds with network round-trips
- Client-side merge logic is complex and error-prone
- Cache invalidation becomes critical (and tricky)

#### Why This Happens
The schema optimizes for **write sparsity** at the cost of **read complexity**. But NBA rosters are read far more than written (viewing cap sheets, building trades, browsing teams).

### 2.2 🟡 MODERATE: Cached Totals Fragility

#### Problem: `totalsCache` Can Drift
The proposal stores pre-computed aggregates (`totalSalary`, `capSpace`, etc.) on team docs:
```json
"totalsCache": {
  "totalSalary": 192200000,
  "isFirstApron": true
}
```

But these depend on:
- Current roster (team doc)
- Each player's contract (mix of base + overrides)
- League cap settings (external)
- Current NBA season rules

#### Risks
- **Stale cache**: If cap rules change or external data updates
- **Calculation errors**: If recompute logic has bugs
- **Inconsistency**: Team doc shows one total, but live calc shows another
- **Hard to debug**: Cached value may not match reality

#### Why This Is Concerning
Cap calculations are **complex** (BYC, apron rules, luxury tax). Pre-caching assumes perfect recompute logic, but bugs here would silently corrupt the UI/validation.

### 2.3 🟡 MODERATE: Player Override Scoping Ambiguity

#### Problem: Player Can Be on Multiple Rosters
The schema stores player overrides under a team path:
```
/architect/worlds/world_A/teams/LAL/players/jordan_poole
```

But what if a world has bugs and Poole appears on both LAL and NOP rosters?
- Which override applies?
- How do you enforce uniqueness?
- What happens during trades (move override doc)?

#### Current Proposal's Answer
> "Optional convenience if your logic wants a world-local team hint"
```json
"teamCode": "LAL"
```

This is a **hint**, not a constraint. Firestore won't enforce roster uniqueness.

### 2.4 🟡 MODERATE: Migration Complexity

#### Problem: Diff Extraction Is Non-Trivial
To convert existing `/teamPlans` to the new schema, you must:
1. Load current plan data
2. Load corresponding base team data
3. Compute diff (which fields changed?)
4. Store only the diff as overrides

But what constitutes a "change"?
- Empty array vs missing field?
- Reordered roster (functionally same)?
- Float precision differences in salaries?

#### Risk
Migration scripts could:
- Over-store (not computing diffs correctly)
- Under-store (missing critical overrides)
- Corrupt data (bad merge logic)

### 2.5 🟠 MINOR: No World Metadata

The proposal doesn't specify:
- World creation timestamp
- World creator (userId)
- World name/description
- World branching point (which NBA date?)
- World type (rebuild, championship push, etc.)

These are **critical for UX**:
- Listing "my worlds"
- Sorting by recency
- Understanding world context
- Multi-user permissions (future)

### 2.6 🟠 MINOR: No Trade/Action History

Worlds store the **current state** but not the **sequence of actions**:
- Which trades happened?
- What was the order?
- Can you undo/replay?

For GM simulation, the **journey matters**:
- "How did I get here?"
- "What if I didn't make that trade?"
- Audit trail for multiplayer

---

## 3. Comparison to Current Architecture

### Current System
```
/teams/{teamCode}              # Base teams (read-only in practice)
/teamPlans/{userId}_{teamCode} # User plans (full copy)
  └── namedPlans/{planName}    # Named saves (full copy)
```

**Pros of Current**:
- Simple reads (one doc has everything)
- No merge logic needed
- Easy to understand

**Cons of Current**:
- Storage waste (full copies)
- No clear base/world separation
- Risk of base data corruption
- Hard to sync real NBA updates

### Proposed v2 System
**Pros**:
- Storage efficient (diffs only)
- Clear separation of concerns
- Supports multiple worlds elegantly
- Enables clean NBA data updates

**Cons**:
- Complex reads (fallback + merge)
- Performance concerns (many queries)
- Fragile cached totals
- Migration complexity

---

## 4. Recommended Improvements

### 4.1 ✅ Hybrid Approach: Denormalized World Snapshots

Instead of pure diff-based reads, **snapshot the complete world state** at write time:

```
/architect/worlds/{worldId}
  ├── metadata                    # World info (creator, created, name)
  ├── snapshot/                   # Denormalized complete state
  │   ├── teams/
  │   │   └── {teamCode}          # Full team doc (base + overrides merged)
  │   └── players/
  │       └── {playerId}          # Full player doc (base + overrides merged)
  └── diffs/                      # Source of truth (diffs only)
      └── teams/
          └── {teamCode}/
              ├── teamDoc
              └── players/
                  └── {playerId}
```

**How It Works**:
- **Writes**: Update diffs (source of truth), then regenerate snapshot
- **Reads**: Use snapshot (1 query per team, no merging)
- **NBA Updates**: Regenerate snapshots from updated base + existing diffs

**Benefits**:
- Fast reads (same as current system)
- Efficient storage (diffs are small)
- Clear audit (diffs show what changed)
- Resilient (can rebuild snapshots from base + diffs)

**Trade-offs**:
- Write is slower (compute + store snapshot)
- More storage than pure diff (but less than current full copy)
- Snapshot freshness (must trigger rebuild on base updates)

### 4.2 ✅ Explicit World Metadata

Add world-level document:
```json
// /architect/worlds/{worldId}/metadata
{
  "worldId": "world_A",
  "name": "2025 Lakers Rebuild",
  "description": "Trade for young core, extend AD",
  "createdBy": "user123",
  "createdAt": "2025-10-01T00:00:00Z",
  "branchPoint": {
    "season": "2025-26",
    "date": "2025-10-01",
    "source": "opening_night"
  },
  "teamsTouched": ["LAL", "NOP"],
  "lastModified": "2025-10-07T15:30:00Z",
  "status": "active"
}
```

**Benefits**:
- Easy to list user's worlds
- Context for understanding scenario
- Foundation for sharing/multiplayer
- Audit trail

### 4.3 ✅ Action History Log

Add world action log:
```json
// /architect/worlds/{worldId}/actions/{actionId}
{
  "actionId": "trade_001",
  "type": "trade",
  "timestamp": "2025-10-07T14:30:00Z",
  "teams": ["LAL", "NOP"],
  "playersOut": {
    "LAL": ["austin_reaves"],
    "NOP": ["jordan_poole"]
  },
  "playersIn": {
    "LAL": ["jordan_poole"],
    "NOP": ["austin_reaves"]
  },
  "validation": {
    "salaryMatch": true,
    "rosterLimits": true,
    "apronImpact": { ... }
  }
}
```

**Benefits**:
- Replay/undo capability
- Audit trail for debugging
- Foundation for "explain my cap" feature
- Multiplayer approval flows

### 4.4 ⚠️ Compute Totals On-Demand (No Cache)

Instead of `totalsCache`, compute on read:
```javascript
function computeTotals(teamData, playerData, capSettings) {
  const totalSalary = playerData.reduce((sum, p) => sum + p.salary, 0);
  const capSpace = capSettings.salaryCap - totalSalary;
  const isFirstApron = totalSalary > capSettings.firstApron;
  // ... more calculations
  return { totalSalary, capSpace, isFirstApron, ... };
}
```

**Why?**
- Always accurate (no staleness)
- Simpler writes (no cache to maintain)
- Easier to debug (see calculation inputs)

**When to Cache?**
Only if performance testing shows it's critical. Then:
- Cache with TTL (expire after 5 minutes)
- Include cache key (base version + override versions)
- Provide "recalculate" button in UI

### 4.5 ✅ Player Override as Global (Not Team-Scoped)

Alternative structure for player overrides:
```
/architect/worlds/{worldId}/playerOverrides/{playerId}
```

Instead of:
```
/architect/worlds/{worldId}/teams/{teamCode}/players/{playerId}
```

**Benefits**:
- Easier to enforce uniqueness (one override per player)
- Simpler queries (get all overrides for world)
- Clear ownership (player override includes teamCode)

**Trade-offs**:
- Slightly less hierarchical
- Need to filter by team when rendering

**Recommendation**: Keep team-scoped for now, but add validation to prevent duplicate rosters.

### 4.6 ✅ Robust Diff Algorithm

For migration and ongoing operations, use a principled diff library:
```javascript
import { diff } from 'deep-object-diff';

const overrides = diff(baseTeam, worldTeam);
// Only stores actual changes
```

**Key principles**:
- Semantic equality (ignore order, formatting)
- Deep comparison (nested objects)
- Null vs undefined normalization
- Array element matching (not just index)

---

## 5. Alternative Approaches Considered

### Alternative A: Event Sourcing
Store all actions as events, rebuild state on read:
```
/architect/worlds/{worldId}/events/
  ├── 001_trade_reaves_for_poole
  ├── 002_extend_poole
  └── 003_waive_vanderbilt
```

**Pros**: Full audit, replay, undo  
**Cons**: Slow reads (rebuild state), complex queries  
**Verdict**: Overkill for v1, consider for v2

### Alternative B: Copy-On-Write Worlds
Full copy on world creation, diff on NBA updates:
```
/architect/worlds/{worldId}/teams/{teamCode}  # Full copy
```

**Pros**: Fast reads, simple logic  
**Cons**: Storage waste, harder to sync NBA updates  
**Verdict**: Current system with world isolation

### Alternative C: Shared Player Pool
Players stored globally, teams just reference them:
```
/architect/basePlayers/{playerId}           # Global
/architect/worlds/{worldId}/players/{playerId}  # Overrides
/architect/worlds/{worldId}/teams/{teamCode}    # Just roster IDs
```

**Pros**: DRY, clear ownership  
**Cons**: Similar complexity to proposal  
**Verdict**: Equivalent to proposed, six of one

---

## 6. Migration Strategy Recommendation

### Phase 1: Shadow Deploy (Parallel Operation)
1. Deploy new schema alongside existing
2. Write to both old and new on user actions
3. Read from new, validate against old
4. Monitor discrepancies

### Phase 2: Gradual Cutover
1. Set new schema as primary read
2. Keep old as fallback/validation
3. Stop writing to old schema
4. Mark old collections read-only

### Phase 3: Migration & Cleanup
1. Batch migrate old worlds to new schema
2. Validate migrations (sample check)
3. Archive old collections
4. Remove old code paths

### Critical Migration Checklist
- [ ] Diff extraction tested on all edge cases
- [ ] Snapshot generation validated
- [ ] Read fallback logic tested (world → base)
- [ ] Override merge logic tested (nested objects)
- [ ] Cap calculations match between old/new
- [ ] All existing user worlds migrated successfully
- [ ] Rollback plan prepared (restore from archive)

---

## 7. Security & Rules Considerations

### Firestore Security Rules Needed

```javascript
// Base data: read-only
match /architect/baseTeams/{teamCode} {
  allow read: if true;
  allow write: if false; // Never allow client writes
}

match /architect/basePlayers/{playerId} {
  allow read: if true;
  allow write: if false;
}

// Worlds: owner-only
match /architect/worlds/{worldId} {
  allow read: if resource.data.createdBy == request.auth.uid;
  allow write: if resource.data.createdBy == request.auth.uid;
  
  match /snapshot/{document=**} {
    allow read: if get(/databases/$(database)/documents/architect/worlds/$(worldId)).data.createdBy == request.auth.uid;
    allow write: if false; // Server-side only
  }
  
  match /diffs/{document=**} {
    allow read: if get(/databases/$(database)/documents/architect/worlds/$(worldId)).data.createdBy == request.auth.uid;
    allow write: if get(/databases/$(database)/documents/architect/worlds/$(worldId)).data.createdBy == request.auth.uid;
  }
}
```

**Key points**:
- Base data is public read, no writes
- World data requires auth + ownership
- Snapshots are server-generated (Cloud Function)
- Diffs can be client-written (with validation)

---

## 8. Performance Analysis

### Read Performance

#### Current System
- **League View**: 30 queries (1 per team)
- **Team View**: 1 query
- **Player View**: 1 query

#### Proposed Pure Diff System
- **League View**: ~900 queries (30 teams × 30 player lookups)
- **Team View**: ~30 queries (1 team + 15 player overrides + 15 base fallbacks)
- **Player View**: 2 queries (override check + base)

#### Recommended Snapshot Hybrid
- **League View**: 30 queries (1 per team from snapshot)
- **Team View**: 1 query (from snapshot)
- **Player View**: 1 query (from snapshot)

**Winner**: Snapshot hybrid matches current performance while gaining storage efficiency.

### Write Performance

#### Current System
- **Trade**: 2 writes (2 team docs)
- **Extension**: 1 write (1 team doc)

#### Proposed Pure Diff System
- **Trade**: 2 writes (2 team docs)
- **Extension**: 2 writes (1 team doc + 1 player override)

#### Recommended Snapshot Hybrid
- **Trade**: 4+ writes (2 diffs + 2 snapshots + affected player snapshots)
- **Extension**: 3+ writes (1 diff + 1 snapshot + player snapshot)

**Trade-off**: Writes are 2-3× slower, but reads are 30× faster. Given read-heavy workload (browsing >> editing), this is acceptable.

### Storage Analysis

#### Current System (Full Copy)
- 30 teams × 500 KB = **15 MB per world**
- 10 worlds = **150 MB**

#### Proposed Pure Diff System
- Average world touches 4 teams
- 4 teams × 20 KB (diff) = **80 KB per world**
- 10 worlds = **800 KB**

#### Recommended Snapshot Hybrid
- 4 teams × 500 KB (snapshot) = **2 MB per world**
- 4 teams × 20 KB (diff) = **80 KB per world**
- **Total: ~2.1 MB per world**
- 10 worlds = **21 MB**

**Savings**: 86% storage reduction vs current, with no read performance penalty.

---

## 9. Final Recommendations

### ✅ What to Keep from Proposal
1. **Immutable base layer** - This is the strongest part
2. **Diff-only source of truth** - Conceptually sound
3. **Hierarchical world organization** - Clean structure
4. **Team-scoped player overrides** - Works for single-user

### ⚠️ What to Modify
1. **Add snapshot layer** - Denormalize for read performance
2. **Add world metadata** - Essential for UX
3. **Add action history** - Foundation for features
4. **Remove cached totals** - Compute on-demand initially
5. **Strengthen migration plan** - Test diff extraction thoroughly

### 🔴 What to Avoid
1. **Pure diff-based reads** - Too slow for production
2. **Client-side merge logic** - Error-prone and slow
3. **Untested cached totals** - High risk of staleness
4. **Naive migration** - Could corrupt user data

---

## 10. Conclusion

### Is This How I Would Approach It?

**No, but it's close.** The pure diff-based approach is elegant architecturally but impractical for read performance. I would use a **hybrid snapshot + diff system**:

- **Diffs** as source of truth (storage efficient, audit trail)
- **Snapshots** for reads (performance, simplicity)
- **Metadata** for UX (world management)
- **Action log** for features (undo, explain, multiplayer)

### Implementation Roadmap

**Phase 1: Foundation (Week 1-2)**
- [ ] Create base collections (migrate teams/players)
- [ ] Implement world metadata structure
- [ ] Build diff extraction utilities
- [ ] Create snapshot generation logic

**Phase 2: Core Functionality (Week 3-4)**
- [ ] Implement world CRUD operations
- [ ] Build read logic (snapshot-based)
- [ ] Build write logic (diff + snapshot update)
- [ ] Add action logging

**Phase 3: Migration (Week 5-6)**
- [ ] Shadow deploy (parallel write)
- [ ] Validation testing (old vs new)
- [ ] Batch migrate existing worlds
- [ ] Cutover to new schema

**Phase 4: Optimization (Week 7-8)**
- [ ] Add selective caching (if needed)
- [ ] Optimize snapshot regeneration
- [ ] Add background sync for NBA updates
- [ ] Performance monitoring and tuning

### Success Criteria

The new schema succeeds if:
- ✅ Reads are as fast as current system (<200ms for team view)
- ✅ Storage is <20% of current system (per world)
- ✅ NBA updates don't corrupt user worlds (100% isolation)
- ✅ All existing user worlds migrate successfully (0 data loss)
- ✅ Code is maintainable (clear separation, testable)

### Risk Mitigation

- **Performance**: Benchmark snapshot reads early
- **Correctness**: Extensive diff/merge testing
- **Migration**: Staged rollout with rollback plan
- **Complexity**: Document extensively, automate snapshot regen
- **Scale**: Plan for Cloud Functions to handle snapshot updates

---

## Appendix: Quick Reference

### When to Use This Schema
✅ Multiple user-created "what-if" scenarios  
✅ Need to preserve real NBA data integrity  
✅ Storage efficiency is important  
✅ Read-heavy workload (browsing > editing)  

### When NOT to Use This Schema
❌ Simple single-user app (current system is fine)  
❌ Write-heavy workload (too much snapshot overhead)  
❌ Need real-time collaborative editing (conflict resolution needed)  
❌ Can't afford snapshot rebuild latency  

### Key Metrics to Monitor
- Read latency (target: <200ms p95)
- Write latency (target: <1s p95)
- Storage per world (target: <5 MB)
- Snapshot freshness (target: <5 min)
- Cache hit rate (if implemented, target: >80%)

---

**Final Verdict**: The proposal is **fundamentally sound but needs refinements**. The hybrid snapshot + diff approach addresses performance concerns while preserving the excellent architectural separation. With the recommended modifications, this becomes a production-ready design. ✅
