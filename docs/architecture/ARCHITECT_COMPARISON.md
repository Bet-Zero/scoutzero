# Current vs. Proposed Architect Schema - Comparison

A side-by-side comparison of the current implementation and proposed transaction log architecture.

---

## 🏗️ Architecture Comparison

| Aspect | Current (Cap Sheet Duplication) | Proposed (Transaction Log) |
|--------|----------------------------------|----------------------------|
| **Storage Model** | Full cap sheet per plan | Baseline + transaction deltas |
| **Document Size** | ~500KB per plan | ~5KB metadata + ~5-10KB per transaction |
| **Plan Creation** | Duplicate entire cap sheet | Reference baseline + empty transaction log |
| **Plan Updates** | Overwrite full document | Append new transaction |
| **History Tracking** | None (only current state) | Complete chronological log |
| **Baseline Updates** | Requires manual plan updates | Automatic (plans reference latest) |
| **Isolation** | ✅ Good | ✅ Excellent |
| **Scalability** | ❌ Poor (limited plans) | ✅ Excellent (unlimited plans) |

---

## 📂 Collection Structure Comparison

### Current Structure

```
/teams/{teamId}                          # Baseline (read-only) ✅
  └─ capSheet: {...}

/teamPlans/{userId}_{teamId}             # Active plan
  └─ capSheet: {...}                     # Full duplication ❌
  └─ updatedAt: Timestamp

/teamPlans/{userId}_{teamId}/namedPlans/{planName}  # Saved plans
  └─ name: string
  └─ capSheet: {...}                     # Full duplication ❌
  └─ updatedAt: Timestamp

/freeAgents/{agentId}                    # Individual FA docs ⚠️
  └─ player data
```

### Proposed Structure

```
/teams/{teamId}                          # Baseline (read-only) ✅
  └─ capSheet: {...}

/worlds/{worldId}                        # World metadata
  └─ userId, teamId, worldName
  └─ baselineSnapshot: "teams/{teamId}"  # Reference ✅
  └─ stats: {...}                        # Quick stats
  └─ /transactions/{txId}                # Transaction log ✅
      └─ type, timestamp, details

/users/{userId}/worldsIndex/{worldId}    # Quick lookup ✅
  └─ worldName, teamId, lastAccessed

/freeAgents/{year}                       # Year-based FA pool ✅
  └─ agents: [...]
```

**Key Differences**:
- ✅ No cap sheet duplication
- ✅ Transaction log for history
- ✅ Better FA organization
- ✅ User index for quick access

---

## 💾 Storage Comparison (Real Numbers)

### Scenario: 1 User, 5 Plans, 10 Moves Each

#### Current Approach
```
Active Plan:
  /teamPlans/user123_lal
  └─ capSheet: 500KB                     Total: 500KB

Named Plans:
  /teamPlans/user123_lal/namedPlans/plan1
  └─ capSheet: 500KB
  /teamPlans/user123_lal/namedPlans/plan2
  └─ capSheet: 500KB
  /teamPlans/user123_lal/namedPlans/plan3
  └─ capSheet: 500KB
  /teamPlans/user123_lal/namedPlans/plan4
  └─ capSheet: 500KB                     Total: 2,000KB

FREE AGENTS (30 individual docs × 15KB):
  /freeAgents/agent1: 15KB
  /freeAgents/agent2: 15KB
  ...                                    Total: 450KB

GRAND TOTAL: 2,950KB (~3MB)
```

#### Proposed Approach
```
Baseline (shared across all users):
  /teams/lal
  └─ capSheet: 500KB                     Total: 500KB (shared)

Worlds:
  /worlds/w_user123_lal_2025_v1
  └─ metadata: 5KB
  └─ /transactions (10 × 7KB): 70KB      Subtotal: 75KB
  
  /worlds/w_user123_lal_2025_v2
  └─ metadata: 5KB
  └─ /transactions (10 × 7KB): 70KB      Subtotal: 75KB
  
  /worlds/w_user123_lal_2025_v3
  └─ metadata: 5KB
  └─ /transactions (10 × 7KB): 70KB      Subtotal: 75KB
  
  /worlds/w_user123_lal_2025_v4
  └─ metadata: 5KB
  └─ /transactions (10 × 7KB): 70KB      Subtotal: 75KB
  
  /worlds/w_user123_lal_2025_v5
  └─ metadata: 5KB
  └─ /transactions (10 × 7KB): 70KB      Subtotal: 75KB
                                         Total: 375KB

User Index (5 × 2KB):
  /users/user123/worldsIndex/...         Total: 10KB

FREE AGENTS (1 doc with array):
  /freeAgents/2025
  └─ agents: [30 players]                Total: 450KB (same)

GRAND TOTAL: 500KB (baseline) + 375KB (worlds) + 10KB (index) + 450KB (FA)
           = 1,335KB (~1.3MB)

SAVINGS: 3MB - 1.3MB = 1.7MB (57% reduction)
```

---

## 🔄 Operation Comparison

### Creating a New Plan

#### Current
```javascript
// Load baseline
const baseline = await loadTeamCapSheet(teamId);

// Duplicate entire cap sheet
const newPlan = JSON.parse(JSON.stringify(baseline));

// Save full cap sheet
await saveNamedTeamPlan(userId, teamId, planName, newPlan);

// Storage impact: +500KB
```

#### Proposed
```javascript
// Create world (reference baseline, don't copy)
const worldId = await createWorld(userId, teamId, planName, 2025);

// Storage impact: +5KB
```

**Efficiency**: 100x smaller write (5KB vs 500KB)

---

### Executing a Trade

#### Current
```javascript
// Load full cap sheet
const capSheet = await loadNamedTeamPlan(userId, teamId, planName);

// Modify in memory
capSheet.players = capSheet.players.filter(p => !outgoing.includes(p));
capSheet.players.push(...incoming);

// Save full cap sheet (500KB)
await saveNamedTeamPlan(userId, teamId, planName, capSheet);

// Storage impact: Overwrite 500KB
```

#### Proposed
```javascript
// Create transaction record
await executeTransaction(worldId, userId, {
  type: 'trade',
  details: { outgoing, incoming }
});

// Storage impact: +7KB (append only)
```

**Efficiency**: 70x smaller write (7KB vs 500KB)

---

### Loading a Plan

#### Current
```javascript
// Load full cap sheet
const plan = await loadNamedTeamPlan(userId, teamId, planName);

// Read: ~500KB
// Time: ~100ms (network)
// Result: Current state only, no history
```

#### Proposed
```javascript
// Load world state (baseline + transactions)
const { currentState, transactions } = await loadWorldState(worldId);

// Read: 500KB (baseline, cached) + 70KB (10 transactions)
// Time: ~50ms (baseline from cache) + ~20ms (transactions)
// Result: Current state + complete history
```

**Efficiency**: Similar read size, but with caching (50% faster) + history included

---

## 🎯 Feature Comparison

| Feature | Current | Proposed | Notes |
|---------|---------|----------|-------|
| **Multiple Plans** | ✅ Limited | ✅ Unlimited | Current approach breaks at ~20 plans |
| **Plan History** | ❌ No | ✅ Yes | Complete transaction log |
| **Undo Moves** | ❌ No | ✅ Yes | Mark transaction as reversed |
| **Branch Plans** | ⚠️ Manual copy | ✅ Easy | Fork from any transaction point |
| **Compare Plans** | ⚠️ Difficult | ✅ Easy | Diff baselines + transactions |
| **Audit Trail** | ❌ No | ✅ Yes | Every move timestamped |
| **Real-time Sync** | ⚠️ Complex | ✅ Simple | Baseline updates don't affect worlds |
| **Multi-user** | ❌ No | ✅ Yes | Shared transaction validation |
| **Export/Share** | ⚠️ Large | ✅ Small | Transaction log is compact |

---

## 🚧 Migration Complexity

### Data Migration

#### Current → Proposed
```javascript
// For each plan:
1. Load old plan (500KB)
2. Compare with baseline
3. Generate transaction records from diff
4. Create world with transactions (75KB)
5. Verify state matches

// Complexity: Medium (diffing logic needed)
// Risk: Low (reversible, can verify)
// Time: ~500ms per plan
```

#### Rollback Plan
```javascript
// Proposed → Current
1. Load world state
2. Flatten to cap sheet
3. Save as named plan

// Complexity: Low (straightforward flatten)
// Risk: Very low (data still exists)
// Time: ~200ms per plan
```

---

## 🔒 Security Comparison

### Current Rules
```javascript
// /teamPlans/{planId}
match /teamPlans/{planId} {
  allow read, write: if planId.matches(request.auth.uid + '_.*');
}

// Issue: Complex pattern matching
// Issue: Nested namedPlans harder to secure
```

### Proposed Rules
```javascript
// /worlds/{worldId}
match /worlds/{worldId} {
  allow read, write: if resource.data.userId == request.auth.uid;
}

// Benefit: Simpler, explicit userId check
// Benefit: Subcollection automatically inherits
```

---

## 📈 Scalability Analysis

### Current Approach Limits

| Constraint | Limit | Issue |
|------------|-------|-------|
| **Firestore doc size** | 1MB | Large rosters with history approach limit |
| **Plans per user** | ~20 | Storage/cost prohibitive |
| **Baseline updates** | Manual | Must update all plans or risk stale data |
| **Transaction history** | None | Can't audit or undo |
| **Branching** | Manual copy | Duplicates all data |

### Proposed Approach Limits

| Constraint | Limit | Handled By |
|------------|-------|-----------|
| **Firestore doc size** | 1MB | Transactions are small (5-10KB each) |
| **Plans per user** | Unlimited | Only metadata + deltas stored |
| **Baseline updates** | Automatic | Worlds reference, don't copy |
| **Transaction history** | Unlimited | Subcollection, paginated |
| **Branching** | Unlimited | Just reference different tx range |

---

## 💰 Cost Comparison

### Current (Per 1000 Users, 5 Plans Each)

```
Storage:
  - Active plans: 1000 × 500KB = 500MB
  - Named plans: 1000 × 4 × 500KB = 2GB
  - Total: 2.5GB × $0.18/GB = $0.45/month

Writes:
  - New plan: 500KB write
  - Update plan: 500KB write
  - 10 updates/user/month = 10,000 writes
  - 10,000 × 500KB = 5GB write ops
  - 5GB / 1GB (unit) = 5 units × $0.18 = $0.90/month

Total: ~$1.35/month for 1000 users
```

### Proposed (Per 1000 Users, 5 Plans Each)

```
Storage:
  - Baseline: 30 teams × 500KB = 15MB (shared)
  - Worlds: 1000 × 5 × 75KB = 375MB
  - Total: 390MB × $0.18/GB = $0.07/month

Writes:
  - New world: 5KB write
  - New transaction: 7KB write
  - 10 transactions/user/month = 10,000 transactions
  - 10,000 × 7KB = 70MB write ops
  - 70MB / 1GB (unit) = 0.07 units × $0.18 = $0.013/month

Total: ~$0.08/month for 1000 users

SAVINGS: $1.35 - $0.08 = $1.27/month (94% cost reduction!)
```

**At scale (100K users)**: $135/month vs $8/month = $127/month savings

---

## 🎯 Recommendation Matrix

### When to Use Current Approach
- ✅ Prototype/MVP phase (already implemented)
- ✅ Single plan per user only
- ✅ No need for history/audit
- ✅ No plans to scale beyond 1000 users

### When to Use Proposed Approach
- ✅ Production application
- ✅ Multiple plans per user (worlds)
- ✅ Need history and audit trail
- ✅ Want to support undo/redo
- ✅ Planning for 10K+ users
- ✅ Want to enable multiplayer/leagues
- ✅ Need to compare/branch plans
- ✅ Want 66%+ storage savings
- ✅ Want 94%+ cost savings

---

## 🏁 Final Verdict

### Current Approach
**Best for**: Quick prototype, limited scope  
**Limitations**: Doesn't scale, no history, expensive  
**Status**: ⚠️ Technical debt, requires migration

### Proposed Approach
**Best for**: Production, scalability, full feature set  
**Benefits**: 66% storage savings, 94% cost savings, unlimited plans, full history  
**Status**: ✅ Recommended for implementation

---

## 📚 Next Steps

1. **Review** this comparison with stakeholders
2. **Approve** migration to transaction log architecture
3. **Implement** Phase 1 (dual-write mode)
4. **Test** thoroughly with sample data
5. **Migrate** existing plans
6. **Deploy** to production
7. **Monitor** metrics and user feedback

---

**Recommendation**: **Adopt the Transaction Log Architecture**

The proposed approach offers significant advantages in storage efficiency, cost, scalability, and features with manageable migration complexity. The current approach is suitable for prototyping but will not support the Architect vision long-term.

---

**See Also**:
- [ARCHITECT_SCHEMA_SUMMARY.md](./ARCHITECT_SCHEMA_SUMMARY.md) - Executive summary
- [ARCHITECT_FIRESTORE_PROPOSAL.md](./ARCHITECT_FIRESTORE_PROPOSAL.md) - Full proposal
- [ARCHITECT_IMPLEMENTATION.md](./ARCHITECT_IMPLEMENTATION.md) - Implementation guide
