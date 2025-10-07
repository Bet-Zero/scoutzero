# Architect Data Flow Diagrams

This document provides visual representations of data flow in the Architect feature using the proposed transaction log structure.

---

## 📊 Collection Structure Overview

```
Firestore Database
│
├── /teams (READ-ONLY NBA Baseline)
│   ├── /lal
│   │   └── capSheet: { players: [...], picks: [...], meta: {...} }
│   ├── /gsw
│   └── /bos
│
├── /worlds (User GM Worlds)
│   ├── /w_user123_lal_2025_v1
│   │   ├── metadata: { userId, teamId, worldName, ... }
│   │   └── /transactions
│   │       ├── /tx_001: { type: "trade", details: {...} }
│   │       ├── /tx_002: { type: "signing", details: {...} }
│   │       └── /tx_003: { type: "extension", details: {...} }
│   │
│   └── /w_user123_lal_2025_v2
│       ├── metadata: {...}
│       └── /transactions
│           └── /tx_001: {...}
│
├── /users (User Profiles)
│   └── /user123
│       └── /worldsIndex
│           ├── /w_user123_lal_2025_v1: { worldName, lastAccessed, ... }
│           └── /w_user123_lal_2025_v2: { worldName, lastAccessed, ... }
│
└── /freeAgents (Global FA Pool)
    ├── /2025: { agents: [...] }
    └── /2026: { agents: [...] }
```

---

## 🔄 World Creation Flow

```
User Action: "Create New World"
│
├─ 1. Generate World ID
│   worldId = w_user123_lal_2025_v1
│
├─ 2. Load NBA Baseline
│   GET /teams/lal
│   └─ Returns: { capSheet: {...}, meta: {...} }
│
├─ 3. Create World Document
│   SET /worlds/w_user123_lal_2025_v1
│   └─ {
│       userId: "user123",
│       teamId: "lal",
│       worldName: "Lakers Championship Run",
│       baselineSnapshot: "teams/lal",
│       seasonYear: 2025,
│       stats: {
│         totalTransactions: 0,
│         currentSalaryCap: 136021000,
│         currentTeamSalary: 142530000,
│         rosterCount: 15
│       }
│     }
│
├─ 4. Add to User Index
│   SET /users/user123/worldsIndex/w_user123_lal_2025_v1
│   └─ {
│       worldId: "w_user123_lal_2025_v1",
│       worldName: "Lakers Championship Run",
│       teamId: "lal",
│       createdAt: Timestamp,
│       transactionCount: 0
│     }
│
└─ 5. Return World ID
    └─ Navigate to /architect/lal?world=w_user123_lal_2025_v1
```

---

## 💱 Trade Execution Flow

```
User Action: "Execute Trade"
│
├─ 1. Validate Trade
│   ├─ Load current world state
│   │   ├─ GET /teams/lal (baseline)
│   │   └─ GET /worlds/{worldId}/transactions (all transactions)
│   │
│   ├─ Compute current roster
│   │   └─ currentState = baseline + apply(transactions)
│   │
│   └─ Run CBA validation
│       └─ salaryMatching ✓, hardCap ✓, rosterSize ✓
│
├─ 2. Create Transaction Document
│   SET /worlds/{worldId}/transactions/tx_20250315_143022
│   └─ {
│       transactionId: "tx_20250315_143022",
│       type: "trade",
│       timestamp: Timestamp,
│       status: "completed",
│       details: {
│         tradePartners: ["lal", "gsw"],
│         outgoing: {
│           players: [{ playerId: "p123", name: "Player A", salary: 25M }],
│           picks: [{ year: 2026, round: 1 }]
│         },
│         incoming: {
│           players: [{ playerId: "p456", name: "Player B", salary: 30M }]
│         },
│         tradeException: { generated: 5M, expires: "2026-03-15" }
│       }
│     }
│
├─ 3. Update World Stats
│   UPDATE /worlds/{worldId}
│   └─ {
│       stats.totalTransactions: +1,
│       stats.lastTransactionType: "trade",
│       lastModified: Timestamp
│     }
│
├─ 4. Update User Index
│   UPDATE /users/{userId}/worldsIndex/{worldId}
│   └─ {
│       transactionCount: +1,
│       lastModified: Timestamp
│     }
│
└─ 5. Recompute UI State
    ├─ Apply new transaction to current state
    └─ Render updated roster, cap sheet, exceptions
```

---

## 📖 World Loading Flow

```
User Action: "Load World"
│
├─ 1. Fetch World Metadata
│   GET /worlds/w_user123_lal_2025_v1
│   └─ Returns: { userId, teamId, worldName, stats, ... }
│
├─ 2. Load Baseline (Cached)
│   GET /teams/lal
│   └─ Returns: { capSheet: { players: [...], picks: [...] } }
│
├─ 3. Load Transactions (Ordered)
│   GET /worlds/{worldId}/transactions?orderBy=timestamp
│   └─ Returns: [
│       { type: "trade", timestamp: T1, details: {...} },
│       { type: "signing", timestamp: T2, details: {...} },
│       { type: "extension", timestamp: T3, details: {...} }
│     ]
│
├─ 4. Compute Current State (Client-Side)
│   currentState = baseline
│   for each transaction:
│     currentState = applyTransaction(currentState, transaction)
│   
│   └─ Result: {
│       players: [...],      // Modified roster
│       picks: [...],         // Modified pick assets
│       teamSalary: 157M,    // Updated cap number
│       exceptions: [...]    // Active TPEs, MLEs, etc.
│     }
│
└─ 5. Render UI
    ├─ Roster Visual (15 players)
    ├─ Cap Sheet (157M / 136M cap)
    ├─ Transaction History (3 moves)
    └─ Available Tools (Trade, Sign, Extend)
```

---

## 🔀 Multi-World Comparison Flow

```
User Action: "Compare Two Worlds"
│
├─ World A: "Lakers - Trade for Superstar"
│   └─ Load state (baseline + 5 transactions)
│       └─ Result: {
│           players: [Player X, Player Y, ...],
│           teamSalary: 165M,
│           picks: [2025-1st, 2027-1st]
│         }
│
├─ World B: "Lakers - Build Through Draft"
│   └─ Load state (baseline + 3 transactions)
│       └─ Result: {
│           players: [Player A, Player B, ...],
│           teamSalary: 145M,
│           picks: [2025-1st, 2026-1st, 2027-1st, 2028-1st]
│         }
│
└─ Compute Diff
    ├─ Roster Changes:
    │   ├─ World A has: Player X (+30M)
    │   └─ World B has: Player A, Player B (+15M total)
    │
    ├─ Cap Situation:
    │   ├─ World A: Over cap by 29M
    │   └─ World B: Over cap by 9M
    │
    └─ Draft Assets:
        ├─ World A: 2 future 1sts
        └─ World B: 4 future 1sts

    Display side-by-side comparison UI
```

---

## 🔄 Transaction Application Logic

### Example: Applying a Trade Transaction

```javascript
function applyTradeTransaction(currentState, transaction) {
  const { outgoing, incoming } = transaction.details;
  
  // 1. Remove outgoing players
  currentState.players = currentState.players.filter(p => 
    !outgoing.players.find(out => out.playerId === p.player_id)
  );
  
  // 2. Remove outgoing picks
  currentState.picks = currentState.picks.filter(pick =>
    !outgoing.picks.find(out => 
      out.year === pick.year && out.round === pick.round
    )
  );
  
  // 3. Add incoming players
  incoming.players.forEach(player => {
    currentState.players.push({
      player_id: player.playerId,
      name: player.name,
      contract_clean: player.contract,
      // ... other player data
    });
  });
  
  // 4. Add incoming picks
  incoming.picks.forEach(pick => {
    currentState.picks.push(pick);
  });
  
  // 5. Update trade exceptions
  if (transaction.details.tradeException?.generated) {
    currentState.exceptions = currentState.exceptions || [];
    currentState.exceptions.push({
      type: 'TPE',
      amount: transaction.details.tradeException.generated,
      expires: transaction.details.tradeException.expires,
      acquiredFrom: transaction.transactionId
    });
  }
  
  // 6. Recalculate team salary
  currentState.teamSalary = currentState.players.reduce((sum, p) => 
    sum + (p.contract_clean?.salaries_by_year?.[currentYear]?.salary || 0), 
    0
  );
  
  return currentState;
}
```

### Example: Applying a Signing Transaction

```javascript
function applySigningTransaction(currentState, transaction) {
  const { playerId, playerName, contract, capImpact } = transaction.details;
  
  // 1. Add player to roster
  currentState.players.push({
    player_id: playerId,
    name: playerName,
    contract_clean: {
      years: contract.years,
      total_value: contract.totalValue,
      salaries_by_year: contract.salariesByYear,
      options: contract.options,
      bird_rights: contract.signedUsing === 'Bird Rights' ? 'Full' : 'None'
    }
  });
  
  // 2. Update exception usage
  if (contract.signedUsing === 'MLE') {
    const mleException = currentState.exceptions?.find(e => e.type === 'MLE');
    if (mleException) {
      mleException.remaining = capImpact.exceptionRemaining;
    }
  }
  
  // 3. Recalculate team salary
  currentState.teamSalary = currentState.players.reduce((sum, p) => 
    sum + (p.contract_clean?.salaries_by_year?.[currentYear]?.salary || 0), 
    0
  );
  
  return currentState;
}
```

---

## 📊 Storage Efficiency Visualization

### Scenario: User creates 10 worlds for Lakers

#### Current Approach (Full Duplication)
```
/teamPlans/
  └─ user123_lal/
      ├─ namedPlans/
      │   ├─ plan1: 500KB (full cap sheet)
      │   ├─ plan2: 500KB (full cap sheet)
      │   ├─ plan3: 500KB (full cap sheet)
      │   ├─ plan4: 500KB (full cap sheet)
      │   ├─ plan5: 500KB (full cap sheet)
      │   ├─ plan6: 500KB (full cap sheet)
      │   ├─ plan7: 500KB (full cap sheet)
      │   ├─ plan8: 500KB (full cap sheet)
      │   ├─ plan9: 500KB (full cap sheet)
      │   └─ plan10: 500KB (full cap sheet)
      
Total: 10 × 500KB = 5MB
```

#### Proposed Approach (Transaction Log)
```
/teams/lal: 500KB (shared baseline)

/worlds/
  ├─ w_user123_lal_2025_v1/
  │   ├─ metadata: 5KB
  │   └─ transactions/ (5 trades × 8KB): 40KB
  │   Total: 45KB
  │
  ├─ w_user123_lal_2025_v2/
  │   ├─ metadata: 5KB
  │   └─ transactions/ (3 signings × 6KB): 18KB
  │   Total: 23KB
  │
  ├─ w_user123_lal_2025_v3/
  │   ├─ metadata: 5KB
  │   └─ transactions/ (8 moves × 7KB): 56KB
  │   Total: 61KB
  │
  └─ ... (7 more worlds, ~40KB each): 280KB

Total: 500KB (baseline) + 45KB + 23KB + 61KB + 280KB = 909KB

Savings: 5MB - 909KB = 4.1MB (82% reduction)
```

---

## 🔐 Security & Access Control

```
User Authentication Flow
│
├─ User logs in → Firebase Auth
│   └─ request.auth.uid = "user123"
│
├─ Request: Load My Worlds
│   GET /users/user123/worldsIndex
│   
│   Security Rule:
│   allow read: if request.auth.uid == userId
│   
│   ✓ ALLOWED (user123 === user123)
│
├─ Request: Load Specific World
│   GET /worlds/w_user123_lal_2025_v1
│   
│   Security Rule:
│   allow read: if resource.data.userId == request.auth.uid
│   
│   ✓ ALLOWED (world.userId === user123)
│
├─ Request: Create Transaction
│   SET /worlds/w_user123_lal_2025_v1/transactions/tx_001
│   
│   Security Rule:
│   allow write: if get(/worlds/w_user123_lal_2025_v1).data.userId == request.auth.uid
│   
│   ✓ ALLOWED (world owner matches auth user)
│
└─ Request: Load Someone Else's World
    GET /worlds/w_user999_gsw_2025_v1
    
    Security Rule:
    allow read: if resource.data.userId == request.auth.uid
    
    ✗ DENIED (world.userId !== user123)
```

---

## 🚀 Performance Optimization Strategies

### 1. Client-Side Caching
```
Browser Memory
├─ Baseline Cache (1 hour TTL)
│   └─ /teams/lal → { capSheet: {...} }
│
├─ World State Cache (5 min TTL)
│   └─ w_user123_lal_2025_v1 → { computed state }
│
└─ Transaction Cache (1 min TTL)
    └─ w_user123_lal_2025_v1/transactions → [...]
```

### 2. Firestore Offline Persistence
```javascript
// Enable offline persistence
enableIndexedDbPersistence(db);

// Subsequent loads are instant from local cache
const world = await getDoc(doc(db, 'worlds', worldId));
// ↑ Returns immediately from cache if available
```

### 3. Computed State Snapshots
```
For worlds with 100+ transactions:

/worlds/{worldId}/snapshots/
  ├─ snapshot_tx_100
  │   └─ {
  │       state: { ...computed state at tx 100 },
  │       afterTransaction: "tx_100"
  │     }
  │
  └─ snapshot_tx_200
      └─ {
          state: { ...computed state at tx 200 },
          afterTransaction: "tx_200"
        }

Load strategy:
1. Load latest snapshot (tx_200)
2. Load transactions after tx_200 (only 15 new ones)
3. Apply 15 transactions to snapshot
4. Result: Full state with minimal computation
```

---

## 🎯 Key Takeaways

1. **Worlds are isolated**: Each world has its own transaction log, no cross-contamination
2. **Baseline is shared**: Single source of truth for real NBA data
3. **Transactions are lightweight**: 5-10KB each vs. 500KB full cap sheets
4. **State is computed**: Current roster = baseline + apply(transactions)
5. **Scalability is built-in**: Unlimited worlds per user, minimal storage growth
6. **Performance is optimized**: Caching, snapshots, offline persistence
7. **Security is enforced**: Users can only access their own worlds

This architecture supports the vision of Architect as a true GM simulator where users can manage unlimited alternate universes efficiently and safely.
