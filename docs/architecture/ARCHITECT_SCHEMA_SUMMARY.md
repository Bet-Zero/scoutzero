# Architect Firestore Schema - Executive Summary

## 📋 Overview

This document summarizes the proposed Firestore architecture for the **HoopZero Architect** feature. The complete proposal includes:

1. [ARCHITECT_FIRESTORE_PROPOSAL.md](./ARCHITECT_FIRESTORE_PROPOSAL.md) - Detailed schema design and rationale
2. [ARCHITECT_DATA_FLOW.md](./ARCHITECT_DATA_FLOW.md) - Visual diagrams and data flow
3. [ARCHITECT_IMPLEMENTATION.md](./ARCHITECT_IMPLEMENTATION.md) - Implementation code and migration

---

## 🎯 Core Principle: Transaction Log Architecture

### The Problem
Current implementation duplicates entire cap sheets for each plan:
- **5 plans** = **5 × 500KB** = **2.5MB per user**
- Does not scale beyond handful of plans
- Difficult to audit, branch, or undo changes

### The Solution
Store only the **delta** (changes) as a transaction log:
- **Baseline** (shared): 500KB (real NBA data)
- **Each plan**: ~70KB (metadata + 10 transactions)
- **5 plans** = **500KB + 5 × 70KB** = **850KB per user** (**66% reduction**)

---

## 🗂️ Proposed Collections

### 1. `/teams/{teamId}` - Immutable NBA Baseline
**Purpose**: Real-world NBA data (READ-ONLY)

```javascript
{
  capSheet: {
    players: [...],      // Current roster
    picks: [...],        // Draft picks
    teamSalary: 142M,
    salaryCap: 136M
  },
  meta: {
    teamName: "Los Angeles Lakers",
    // ...
  }
}
```

### 2. `/worlds/{worldId}` - User GM Worlds
**Purpose**: Each user's independent sandbox plan

```javascript
{
  worldId: "w_user123_lal_2025_v1",
  userId: "user123",
  worldName: "Lakers Championship Run",
  teamId: "lal",
  baselineSnapshot: "teams/lal",
  seasonYear: 2025,
  isActive: true,
  stats: {
    totalTransactions: 12,
    currentSalaryCap: 136021000,
    currentTeamSalary: 157000000,
    rosterCount: 15
  },
  createdAt: Timestamp,
  lastModified: Timestamp
}
```

### 3. `/worlds/{worldId}/transactions/{txId}` - Transaction Log
**Purpose**: Chronological record of all GM moves

#### Trade Transaction
```javascript
{
  transactionId: "tx_20250315_143022",
  type: "trade",
  timestamp: Timestamp,
  status: "completed",
  details: {
    tradePartners: ["lal", "gsw"],
    outgoing: {
      players: [{ playerId, name, salary }],
      picks: [{ year: 2026, round: 1 }]
    },
    incoming: {
      players: [{ playerId, name, salary, contract }],
      picks: []
    },
    tradeException: {
      generated: 5000000,
      expires: "2026-03-15"
    }
  }
}
```

#### Free Agent Signing
```javascript
{
  transactionId: "tx_20250316_090000",
  type: "signing",
  timestamp: Timestamp,
  status: "completed",
  details: {
    playerId: "p789",
    playerName: "Free Agent X",
    contract: {
      years: 3,
      totalValue: 45000000,
      salariesByYear: {
        2025: 15000000,
        2026: 15000000,
        2027: 15000000
      },
      signedUsing: "MLE"
    }
  }
}
```

#### Contract Extension
```javascript
{
  transactionId: "tx_20250317_110000",
  type: "extension",
  timestamp: Timestamp,
  status: "completed",
  details: {
    playerId: "p321",
    playerName: "Player C",
    extension: {
      additionalYears: 4,
      additionalValue: 120000000,
      salariesByYear: {
        2026: 28000000,
        2027: 30000000,
        2028: 32000000,
        2029: 30000000
      },
      maxExtension: true
    }
  }
}
```

#### Waive/Release
```javascript
{
  transactionId: "tx_20250318_140000",
  type: "waive",
  timestamp: Timestamp,
  status: "completed",
  details: {
    playerId: "p654",
    playerName: "Player D",
    waiveType: "stretch",
    capImpact: {
      stretchYears: 5,
      annualCapHit: 3600000,
      deadCapByYear: {
        2025: 3600000,
        2026: 3600000,
        // ...
      }
    }
  }
}
```

### 4. `/users/{userId}/worldsIndex/{worldId}` - Quick Lookup
**Purpose**: Fast access to user's worlds

```javascript
{
  worldId: "w_user123_lal_2025_v1",
  worldName: "Lakers Championship Run",
  teamId: "lal",
  seasonYear: 2025,
  lastAccessed: Timestamp,
  isFavorite: true,
  transactionCount: 12
}
```

### 5. `/freeAgents/{year}` - Global FA Pool
**Purpose**: Available free agents (shared across worlds)

```javascript
{
  agents: [
    {
      playerId: "p999",
      name: "Free Agent Name",
      position: "SG",
      age: 27,
      // ...
    }
  ]
}
```

---

## 🔄 How It Works

### Computing Current World State

```javascript
// 1. Load baseline (immutable NBA data)
const baseline = await loadTeamCapSheet('lal');

// 2. Load all transactions for the world
const transactions = await loadTransactions(worldId);

// 3. Apply transactions sequentially
let currentState = JSON.parse(JSON.stringify(baseline));

for (const tx of transactions) {
  currentState = applyTransaction(currentState, tx);
}

// currentState now represents the current roster/cap situation
```

### Example: Applying a Trade

```javascript
function applyTradeTransaction(state, transaction) {
  const { outgoing, incoming } = transaction.details;
  
  // Remove outgoing players
  state.players = state.players.filter(p => 
    !outgoing.players.find(out => out.playerId === p.player_id)
  );
  
  // Add incoming players
  incoming.players.forEach(player => {
    state.players.push({
      player_id: player.playerId,
      name: player.name,
      contract_clean: player.contract
    });
  });
  
  // Recalculate team salary
  state.teamSalary = state.players.reduce((sum, p) => 
    sum + (p.contract_clean?.salaries_by_year?.['2025']?.salary || 0),
    0
  );
  
  return state;
}
```

---

## 📊 Storage Comparison

| Scenario | Current Approach | Proposed Approach | Savings |
|----------|-----------------|-------------------|---------|
| **1 user, 5 worlds** | 2.5MB | 850KB | 66% |
| **1000 users, 5 worlds each** | 2.5GB | 850MB | 66% |
| **1 user, 100 transactions** | N/A (breaks) | 3.1MB | Scales |

**Key Insight**: The transaction log approach scales linearly with activity, while full duplication scales exponentially.

---

## ✅ Key Advantages

### 1. **Isolation**
- Each world is completely independent
- No risk of cross-contamination
- Real NBA data never modified

### 2. **Efficiency**
- 66%+ storage reduction
- Faster writes (5KB vs 500KB)
- Shared baseline across all worlds

### 3. **Auditability**
- Complete history of every move
- Easy to debug issues
- Can replay to any point

### 4. **Scalability**
- Supports unlimited worlds per user
- No document size limits concerns
- Efficient pagination of history

### 5. **Features Enabled**
- ✅ Undo/Redo (reverse transactions)
- ✅ World branching (fork from any point)
- ✅ Comparison tools (diff two worlds)
- ✅ Multi-user leagues (shared validation)
- ✅ Trade proposals (pending transactions)

---

## 🚀 Migration Path

### Phase 1: Dual-Write (Safe)
- Write to both old and new structures
- Read from old structure (no breaking changes)
- Validate new structure works

### Phase 2: Dual-Read (Transition)
- Write only to new structure
- Read from new, fallback to old
- Convert old plans on access

### Phase 3: Full Migration (Complete)
- Batch convert all old plans
- Deprecate old structure
- Clean up legacy data

### Migration Script Approach
```javascript
1. Load old plan from /teamPlans/{userId}_{teamId}
2. Create new world in /worlds/
3. Compute diff between baseline and plan
4. Generate transaction records for each change
5. Verify computed state matches original plan
6. Mark old plan as migrated
```

---

## 🛡️ Security

### Firestore Rules
```javascript
// Users can only access their own worlds
match /worlds/{worldId} {
  allow read, write: if request.auth != null 
    && resource.data.userId == request.auth.uid;
}

// Baseline is read-only
match /teams/{teamId} {
  allow read: if true;
  allow write: if false;  // Admin only
}
```

---

## 🎯 Recommendation

**Adopt the Transaction Log Architecture** for the following reasons:

1. ✅ **Proven Pattern**: Used by banking, version control, event sourcing
2. ✅ **Scalable**: Supports the unlimited worlds vision
3. ✅ **Efficient**: 66%+ storage reduction, faster performance
4. ✅ **Feature-Rich**: Enables undo, branching, comparison, multiplayer
5. ✅ **Safe**: Complete isolation, audit trail, rollback capability
6. ✅ **Migration-Friendly**: Can adopt incrementally without breaking changes

---

## 📚 Additional Resources

### Detailed Documentation
- **[ARCHITECT_FIRESTORE_PROPOSAL.md](./ARCHITECT_FIRESTORE_PROPOSAL.md)** - Complete schema specification, transaction types, queries, and optimization strategies
- **[ARCHITECT_DATA_FLOW.md](./ARCHITECT_DATA_FLOW.md)** - Visual diagrams, data flow examples, and security patterns
- **[ARCHITECT_IMPLEMENTATION.md](./ARCHITECT_IMPLEMENTATION.md)** - Code examples, helper functions, integration guide, and migration scripts

### Existing Documentation
- **[ARCHITECT_REVIEW.md](./ARCHITECT_REVIEW.md)** - Product vision and feature roadmap
- **[ARCHITECT_AGENTS.md](./ARCHITECT_AGENTS.md)** - Rules for AI agents and contributors
- **[FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md)** - Current Firestore schema reference

---

## 💡 Quick Start

### 1. Create a World
```javascript
const worldId = await createWorld(
  userId, 
  teamId, 
  "My Championship Plan",
  2025
);
```

### 2. Execute a Trade
```javascript
await executeTransaction(worldId, userId, {
  type: 'trade',
  details: {
    outgoing: { players: [...] },
    incoming: { players: [...] }
  }
});
```

### 3. Load World State
```javascript
const { currentState, transactions } = await loadWorldState(worldId);
// currentState = baseline + all transactions applied
```

### 4. Display to User
```javascript
<RosterVisual capSheet={currentState} />
<CapSheet capSheet={currentState} />
<TransactionHistory transactions={transactions} />
```

---

## 🔮 Future Enhancements

Once the base architecture is in place, we can easily add:

- **Snapshot Caching**: Periodic full-state snapshots for worlds with 100+ transactions
- **Shared Worlds**: Multi-user league mode with cross-world trade proposals
- **AI Simulation**: Projected transactions and outcome predictions
- **Export/Import**: Share worlds with other users
- **Time Travel**: View world state at any point in history

---

## ❓ FAQ

### Q: What happens when real NBA data updates?
**A:** The baseline updates, but existing worlds are unaffected. Users can create new worlds from the updated baseline.

### Q: Can users branch a world?
**A:** Yes! Fork from any transaction point. Copy world metadata and transactions up to that point.

### Q: What if Firestore goes down?
**A:** Firestore offline persistence caches data locally. Users can continue working; changes sync when back online.

### Q: How do we handle conflicts in multi-team trades?
**A:** Each team has its own transaction record. Validation ensures all parties' transactions are compatible.

### Q: Can we undo a transaction?
**A:** Yes! Mark transaction as "reversed" and recompute state without it.

---

## 📞 Next Steps

1. **Review** this proposal with the team
2. **Prototype** core helper functions (worldHelpers.js, transactionHelpers.js)
3. **Test** with sample data to validate approach
4. **Implement** Phase 1 migration (dual-write)
5. **Deploy** gradually with feature flags
6. **Monitor** performance and storage metrics
7. **Complete** migration to new structure

---

**Status**: ✅ Proposal Complete - Ready for Implementation

**Author**: GitHub Copilot  
**Date**: 2025  
**Version**: 1.0
