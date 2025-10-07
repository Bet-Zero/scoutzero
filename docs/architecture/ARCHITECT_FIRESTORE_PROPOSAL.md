# Architect Firestore Schema Proposal

## 📋 Executive Summary

This document proposes a scalable, efficient Firestore schema for the **HoopZero Architect** feature that supports:
- **Isolated GM Worlds**: Each user's plan operates in its own sandbox
- **Data Efficiency**: Transaction log approach minimizes storage
- **Performance**: Fast reads for active worlds, lazy loading for history
- **Scalability**: Supports multiple users, teams, and simultaneous worlds

---

## 🌐 Core Concept: Worlds as Transaction Logs

Instead of duplicating entire team cap sheets for every plan, we use a **transaction log pattern**:

1. **Baseline Data** (`/teams/{teamId}`) remains immutable - the real NBA state
2. **User Worlds** store only the **delta** - the transactions they execute
3. **Current State** is computed: `Baseline + Transactions = World State`

### Benefits:
- **Storage**: ~95% reduction vs. full cap sheet duplication
- **Speed**: Transaction lists are small, quick to read/write
- **Audit Trail**: Complete history of every move
- **Branching**: Easy to fork worlds from any point
- **Sync-Safe**: Real NBA updates never conflict with user worlds

---

## 🗂️ Proposed Firestore Structure

### Collection Tree

```
/teams/{teamId}                              # Real NBA baseline (READ-ONLY)
  └── capSheet: {...}                        # Current real-world roster
  └── meta: {...}                            # Team metadata

/worlds/{worldId}                            # User GM worlds
  └── metadata: {                            # World configuration
       userId: string
       worldName: string
       teamId: string
       baselineSnapshot: string              # Which NBA snapshot this forked from
       createdAt: timestamp
       lastModified: timestamp
       seasonYear: number
       isActive: boolean
     }
  └── /transactions (subcollection)          # All moves in chronological order
       └── {transactionId}: {
            type: 'trade' | 'signing' | 'release' | 'extension' | 'waive' | 'stretch'
            timestamp: timestamp
            executedAt: timestamp
            details: {...}                   # Type-specific transaction data
          }
  
/users/{userId}                              # User profile and world index
  └── /worldsIndex (subcollection)           # Quick lookup of user's worlds
       └── {worldId}: {
            worldName: string
            teamId: string
            lastAccessed: timestamp
            isFavorite: boolean
          }

/freeAgents/{year}                           # Global free agent pool per season
  └── agents: [...]                          # Available FAs (shared across all worlds)
```

---

## 📦 Detailed Schema Definitions

### 1. World Document (`/worlds/{worldId}`)

```javascript
{
  // Core Identity
  worldId: "w_user123_lal_2025_v1",          // Unique world identifier
  userId: "user123",                          // Owner of this world
  worldName: "Lakers Dynasty 2025",           // User-defined name
  teamId: "lal",                              // Team being managed
  
  // Baseline Reference
  baselineSnapshot: "teams/lal/2025-03-15",   // NBA state at fork time
  forkDate: Timestamp(2025-03-15),            // When world was created
  seasonYear: 2025,                           // Active season
  
  // State
  isActive: true,                             // User actively working on it
  isArchived: false,                          // Archived but kept for history
  
  // Metadata
  createdAt: Timestamp,
  lastModified: Timestamp,
  lastAccessed: Timestamp,
  
  // Quick Stats (denormalized for UI)
  stats: {
    totalTransactions: 12,
    currentSalaryCap: 136021000,
    currentTeamSalary: 142530000,
    rosterCount: 15,
    draftPicksOwned: 7,
    lastTransactionType: "trade"
  }
}
```

### 2. Transaction Document (`/worlds/{worldId}/transactions/{transactionId}`)

#### Base Transaction Structure
```javascript
{
  transactionId: "tx_20250315_143022",        // Unique ID (timestamp-based)
  type: "trade" | "signing" | "release" | "extension" | "waive" | "stretch",
  timestamp: Timestamp,                       // When executed
  seasonYear: 2025,                           // Which season
  status: "completed" | "pending" | "reversed", // Transaction state
  
  // Type-specific details stored in 'details' object
  details: {...}                              // See type-specific schemas below
}
```

#### Trade Transaction
```javascript
{
  type: "trade",
  details: {
    tradePartners: ["lal", "gsw", "bos"],     // All teams involved
    
    // For this team (the world owner)
    outgoing: {
      players: [
        { playerId: "p123", name: "Player A", salary: 25000000 }
      ],
      picks: [
        { year: 2026, round: 1, protection: "top-3" }
      ],
      cash: 5000000
    },
    
    incoming: {
      players: [
        { playerId: "p456", name: "Player B", salary: 30000000, contract: {...} }
      ],
      picks: [
        { year: 2027, round: 2 }
      ]
    },
    
    // Trade metadata
    tradeException: {
      generated: 5000000,                     // TPE created
      expires: "2026-03-15"
    },
    
    validation: {
      salaryMatching: true,
      hardCap: "none",
      rosterSize: 14,
      cbcaCompliant: true
    }
  }
}
```

#### Free Agent Signing Transaction
```javascript
{
  type: "signing",
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
      options: {
        2027: "player"
      },
      guaranteed: 30000000,
      signedUsing: "MLE",                     // Exception used
      isMinimum: false
    },
    
    capImpact: {
      exception: "MLE",
      exceptionRemaining: 2500000,
      teamSalaryBefore: 142000000,
      teamSalaryAfter: 157000000
    }
  }
}
```

#### Contract Extension Transaction
```javascript
{
  type: "extension",
  details: {
    playerId: "p321",
    playerName: "Player C",
    
    originalContract: {
      yearsRemaining: 1,
      salariesByYear: { 2025: 20000000 }
    },
    
    extension: {
      additionalYears: 4,
      additionalValue: 120000000,
      salariesByYear: {
        2026: 28000000,
        2027: 30000000,
        2028: 32000000,
        2029: 30000000
      },
      maxExtension: true,
      eligibleUnder: "Designated Veteran Extension"
    }
  }
}
```

#### Release/Waive Transaction
```javascript
{
  type: "waive",
  details: {
    playerId: "p654",
    playerName: "Player D",
    
    contract: {
      yearsRemaining: 2,
      remainingGuaranteed: 18000000
    },
    
    waiveType: "standard" | "stretch",
    
    capImpact: {
      immediateHit: 9000000,              // If stretched
      stretchYears: 5,
      annualCapHit: 3600000,
      deadCapByYear: {
        2025: 3600000,
        2026: 3600000,
        2027: 3600000,
        2028: 3600000,
        2029: 3600000
      }
    }
  }
}
```

### 3. User World Index (`/users/{userId}/worldsIndex/{worldId}`)

```javascript
{
  worldId: "w_user123_lal_2025_v1",
  worldName: "Lakers Dynasty 2025",
  teamId: "lal",
  teamName: "Los Angeles Lakers",
  seasonYear: 2025,
  
  // Quick access metadata
  createdAt: Timestamp,
  lastAccessed: Timestamp,
  lastModified: Timestamp,
  
  // User organization
  isFavorite: true,
  isArchived: false,
  tags: ["playoff-run", "championship"],
  
  // Quick stats for list view
  transactionCount: 12,
  currentRecord: "45-20",                   // If simulated
  playoffStatus: "projected-5-seed"
}
```

---

## 🔄 Data Flow & Operations

### Creating a New World

```javascript
async function createWorld(userId, teamId, worldName, seasonYear) {
  // 1. Generate unique world ID
  const worldId = `w_${userId}_${teamId}_${seasonYear}_${Date.now()}`;
  
  // 2. Load baseline snapshot
  const baseline = await loadTeamCapSheet(teamId);
  
  // 3. Create world document
  await setDoc(doc(db, 'worlds', worldId), {
    worldId,
    userId,
    worldName,
    teamId,
    baselineSnapshot: `teams/${teamId}`,
    forkDate: serverTimestamp(),
    seasonYear,
    isActive: true,
    createdAt: serverTimestamp(),
    lastModified: serverTimestamp(),
    stats: {
      totalTransactions: 0,
      currentSalaryCap: baseline.salaryCap,
      currentTeamSalary: baseline.teamSalary,
      rosterCount: baseline.players.length,
      draftPicksOwned: baseline.picks?.length || 7
    }
  });
  
  // 4. Add to user's world index
  await setDoc(doc(db, 'users', userId, 'worldsIndex', worldId), {
    worldId,
    worldName,
    teamId,
    seasonYear,
    createdAt: serverTimestamp(),
    lastAccessed: serverTimestamp(),
    isFavorite: false,
    transactionCount: 0
  });
  
  return worldId;
}
```

### Computing Current World State

```javascript
async function loadWorldState(worldId) {
  // 1. Load world metadata
  const worldDoc = await getDoc(doc(db, 'worlds', worldId));
  const world = worldDoc.data();
  
  // 2. Load baseline (immutable real NBA data)
  const baseline = await loadTeamCapSheet(world.teamId);
  
  // 3. Load all transactions
  const transactionsSnap = await getDocs(
    collection(db, 'worlds', worldId, 'transactions')
      .orderBy('timestamp', 'asc')
  );
  
  const transactions = transactionsSnap.docs.map(doc => doc.data());
  
  // 4. Apply transactions to baseline
  let currentState = JSON.parse(JSON.stringify(baseline));
  
  for (const tx of transactions) {
    currentState = applyTransaction(currentState, tx);
  }
  
  return {
    world,
    baseline,
    currentState,
    transactions
  };
}
```

### Executing a Transaction

```javascript
async function executeTransaction(worldId, transaction) {
  const txId = `tx_${Date.now()}`;
  
  // 1. Save transaction
  await setDoc(doc(db, 'worlds', worldId, 'transactions', txId), {
    transactionId: txId,
    timestamp: serverTimestamp(),
    status: 'completed',
    ...transaction
  });
  
  // 2. Update world metadata stats
  const worldRef = doc(db, 'worlds', worldId);
  await updateDoc(worldRef, {
    'stats.totalTransactions': increment(1),
    'stats.lastTransactionType': transaction.type,
    lastModified: serverTimestamp()
  });
  
  // 3. Update user index
  const world = await getDoc(worldRef);
  await updateDoc(
    doc(db, 'users', world.data().userId, 'worldsIndex', worldId),
    {
      lastModified: serverTimestamp(),
      transactionCount: increment(1)
    }
  );
  
  return txId;
}
```

---

## 🚀 Performance Optimizations

### 1. Snapshot Caching
```javascript
// Cache computed world state in world document for quick loads
{
  worldId: "...",
  // ... other fields ...
  
  cachedState: {
    lastComputed: Timestamp,
    teamSalary: 142530000,
    rosterCount: 15,
    capSpace: -6509000,
    // Lightweight summary only, not full roster
  }
}
```

### 2. Transaction Batching
Group related transactions (multi-team trades) into a single atomic write:

```javascript
{
  type: "trade",
  batchId: "trade_batch_123",
  participants: ["lal", "gsw", "bos"],
  
  transactions: [
    // All team-specific moves in one atomic unit
  ]
}
```

### 3. Pagination for History
Load transactions in chunks:

```javascript
// Recent transactions for quick load
const recentTx = await getDocs(
  query(
    collection(db, 'worlds', worldId, 'transactions'),
    orderBy('timestamp', 'desc'),
    limit(20)
  )
);

// Full history on demand
```

---

## 📊 Storage Comparison

### Current Approach (Full Cap Sheet Duplication)
```
User has 5 worlds for Lakers:
- Each stores complete cap sheet: ~500KB
- Total: 5 × 500KB = 2.5MB per user

With 1000 users: 2.5GB
```

### Proposed Approach (Transaction Log)
```
User has 5 worlds for Lakers:
- Baseline (shared): 500KB
- Each world: ~20KB metadata + (10 transactions × 5KB) = 70KB
- Total: 500KB + (5 × 70KB) = 850KB per user

With 1000 users: 850MB (66% reduction)

With 100 transactions: 500KB + (5 × 520KB) = 3.1MB per user
Still shared baseline, no duplication
```

---

## 🔀 Migration Path from Current Structure

### Phase 1: Dual-Write Mode
- Keep existing `/teamPlans/{userId}_{teamId}` structure
- Also write to new `/worlds/` structure
- Read from old structure (fallback compatible)

### Phase 2: Dual-Read Mode
- Write only to new `/worlds/` structure
- Read from new structure, fallback to old if needed
- Convert old plans to transactions on access

### Phase 3: Full Migration
- Batch convert all old plans to worlds
- Deprecate old structure
- Clean up legacy documents

### Migration Script Pseudo-code
```javascript
async function migratePlanToWorld(userId, teamId, planName) {
  // 1. Load old plan
  const oldPlan = await loadNamedTeamPlan(userId, teamId, planName);
  
  // 2. Create world
  const worldId = await createWorld(userId, teamId, planName, 2025);
  
  // 3. Compute diff between baseline and plan
  const baseline = await loadTeamCapSheet(teamId);
  const transactions = computeDiff(baseline, oldPlan);
  
  // 4. Create transaction records
  for (const tx of transactions) {
    await executeTransaction(worldId, tx);
  }
  
  // 5. Verify state matches
  const worldState = await loadWorldState(worldId);
  assert(deepEqual(worldState.currentState, oldPlan));
  
  return worldId;
}
```

---

## 🛡️ Security Rules

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Base team data - read-only for all
    match /teams/{teamId} {
      allow read: if true;
      allow write: if false;  // Admin only via backend
    }
    
    // Worlds - user can only access their own
    match /worlds/{worldId} {
      allow read: if request.auth != null 
        && resource.data.userId == request.auth.uid;
      
      allow create: if request.auth != null 
        && request.resource.data.userId == request.auth.uid;
      
      allow update: if request.auth != null 
        && resource.data.userId == request.auth.uid;
      
      allow delete: if request.auth != null 
        && resource.data.userId == request.auth.uid;
      
      // Transactions subcollection
      match /transactions/{txId} {
        allow read, write: if request.auth != null 
          && get(/databases/$(database)/documents/worlds/$(worldId)).data.userId == request.auth.uid;
      }
    }
    
    // User indices
    match /users/{userId}/worldsIndex/{worldId} {
      allow read, write: if request.auth != null 
        && userId == request.auth.uid;
    }
    
    // Free agents - global read
    match /freeAgents/{year} {
      allow read: if true;
      allow write: if false;  // Admin only
    }
  }
}
```

---

## 🎯 Key Advantages

### 1. **Isolation**
- Each world completely independent
- No cross-contamination between plans
- Real NBA data never touched

### 2. **Efficiency**
- 66%+ storage reduction
- Faster writes (small transactions vs. large documents)
- Shared baseline across all worlds

### 3. **Auditability**
- Complete transaction history
- Easy to debug issues
- Can replay to any point in time

### 4. **Scalability**
- Supports unlimited worlds per user
- Supports unlimited users
- Firestore document size limits not a concern

### 5. **Feature Enablement**
- Easy world branching (fork from any transaction)
- Undo/redo functionality (reverse transactions)
- Comparison tools (diff two worlds)
- Trade proposals (pending transactions)
- Multi-user leagues (shared transaction validation)

---

## 🔮 Future Enhancements

### 1. Compressed Snapshots
For worlds with 100+ transactions, create periodic snapshots:
```
/worlds/{worldId}/snapshots/{snapshotId}
  └── state: {...}                    # Full state at this point
  └── afterTransaction: "tx_123"     # Last tx included
```

### 2. Shared Worlds (League Mode)
```
/leagues/{leagueId}
  └── worlds: {...}                   # Maps teamId -> worldId
  └── trades: {...}                   # Cross-world trade proposals
```

### 3. AI Simulation
```
/worlds/{worldId}/simulations/{simId}
  └── projectedTransactions: [...]    # AI-suggested moves
  └── outcomeProjection: {...}        # Predicted results
```

---

## 📝 Sample Queries

### Get All User's Active Worlds
```javascript
const worldsSnap = await getDocs(
  query(
    collection(db, 'users', userId, 'worldsIndex'),
    where('isArchived', '==', false),
    orderBy('lastAccessed', 'desc')
  )
);
```

### Get World Transaction History
```javascript
const txSnap = await getDocs(
  query(
    collection(db, 'worlds', worldId, 'transactions'),
    orderBy('timestamp', 'desc'),
    limit(50)
  )
);
```

### Find Worlds by Team
```javascript
const lakersWorldsSnap = await getDocs(
  query(
    collection(db, 'users', userId, 'worldsIndex'),
    where('teamId', '==', 'lal')
  )
);
```

---

## ✅ Recommendation

**Adopt the Transaction Log approach** with the proposed `/worlds/` structure for the following reasons:

1. **Scalability**: Supports the vision of unlimited GM plans
2. **Efficiency**: Dramatically reduces storage and improves performance  
3. **Features**: Enables advanced functionality (undo, branching, comparison)
4. **Safety**: Isolates user data from real NBA baseline
5. **Migration**: Can be adopted incrementally without breaking changes

The current cap sheet duplication approach will not scale beyond a handful of plans per user. The transaction log is industry-standard for this type of simulation/planning software and aligns perfectly with the "saved worlds" vision.
