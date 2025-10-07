# Architect Firestore Schema - Visual Quick Reference

A one-page visual guide to the proposed Firestore schema for Architect.

---

## 🏗️ Architecture at a Glance

```
                    ┌─────────────────────────────┐
                    │   Real NBA Data (Baseline)  │
                    │   /teams/{teamId}           │
                    │   READ-ONLY                 │
                    └──────────────┬──────────────┘
                                   │
                                   │ fork from baseline
                                   ▼
            ┌──────────────────────────────────────────────┐
            │         User's GM Worlds                      │
            │         /worlds/{worldId}                    │
            ├──────────────────────────────────────────────┤
            │  • World 1: "Lakers - Championship Run"      │
            │    └─ /transactions: [trade, sign, extend]   │
            │  • World 2: "Lakers - Rebuild Plan"          │
            │    └─ /transactions: [trade, waive, draft]   │
            │  • World 3: "Warriors - Dynasty v2"          │
            │    └─ /transactions: [trade, sign, sign]     │
            └──────────────────────────────────────────────┘
                                   │
                                   │ quick lookup
                                   ▼
                    ┌─────────────────────────────┐
                    │   User World Index          │
                    │   /users/{userId}/          │
                    │   worldsIndex/{worldId}     │
                    └─────────────────────────────┘
```

---

## 📊 Data Flow: From Baseline to Current State

```
Step 1: Load Baseline               Step 2: Load Transactions
┌────────────────────┐              ┌────────────────────┐
│  /teams/lal        │              │  /worlds/{worldId}/│
│                    │              │  transactions/     │
│  capSheet: {       │              │                    │
│    players: [15],  │              │  tx_001: {         │
│    picks: [7],     │              │    type: "trade",  │
│    salary: 142M    │              │    outgoing: [...],│
│  }                 │              │    incoming: [...]  │
└────────────────────┘              │  }                 │
                                    │  tx_002: {         │
                                    │    type: "signing",│
                                    │    player: {...}   │
                                    │  }                 │
                                    └────────────────────┘
           │                                   │
           └───────────────┬───────────────────┘
                           │
                           ▼ Apply transactions sequentially
                           
                    ┌─────────────────────────────┐
                    │   Current World State       │
                    │                             │
                    │   currentState = baseline   │
                    │     + apply(tx_001)         │
                    │     + apply(tx_002)         │
                    │     + ...                   │
                    │                             │
                    │   Result: {                 │
                    │     players: [14],          │
                    │     picks: [6],             │
                    │     salary: 157M            │
                    │   }                         │
                    └─────────────────────────────┘
```

---

## 🔄 Transaction Types Supported

### 1. Trade 🔀
```
┌─────────────────────────────────────────┐
│ type: "trade"                           │
├─────────────────────────────────────────┤
│ outgoing:                               │
│   • players: [Player A]                 │
│   • picks: [2026 1st round]             │
│                                         │
│ incoming:                               │
│   • players: [Player B, Player C]       │
│   • picks: []                           │
│                                         │
│ result:                                 │
│   • TPE: 5M (generated)                 │
│   • Salary: +5M                         │
└─────────────────────────────────────────┘
```

### 2. Free Agent Signing ✍️
```
┌─────────────────────────────────────────┐
│ type: "signing"                         │
├─────────────────────────────────────────┤
│ player: "Free Agent X"                  │
│                                         │
│ contract:                               │
│   • years: 3                            │
│   • total: 45M                          │
│   • salaryByYear: {                     │
│       2025: 15M,                        │
│       2026: 15M,                        │
│       2027: 15M                         │
│     }                                   │
│   • signedUsing: "MLE"                  │
│                                         │
│ result:                                 │
│   • MLE remaining: 2.5M                 │
│   • Salary: +15M                        │
└─────────────────────────────────────────┘
```

### 3. Extension 📝
```
┌─────────────────────────────────────────┐
│ type: "extension"                       │
├─────────────────────────────────────────┤
│ player: "Player C"                      │
│                                         │
│ current: 1 year, 20M                    │
│                                         │
│ extension:                              │
│   • additionalYears: 4                  │
│   • additionalValue: 120M               │
│   • salaryByYear: {                     │
│       2026: 28M,                        │
│       2027: 30M,                        │
│       2028: 32M,                        │
│       2029: 30M                         │
│     }                                   │
│                                         │
│ result:                                 │
│   • Total contract: 5 years, 140M       │
└─────────────────────────────────────────┘
```

### 4. Waive/Release 🔻
```
┌─────────────────────────────────────────┐
│ type: "waive"                           │
├─────────────────────────────────────────┤
│ player: "Player D"                      │
│                                         │
│ waiveType: "stretch"                    │
│                                         │
│ capImpact:                              │
│   • remaining: 18M                      │
│   • stretchYears: 5                     │
│   • annualHit: 3.6M                     │
│   • deadCap: {                          │
│       2025: 3.6M,                       │
│       2026: 3.6M,                       │
│       ...                               │
│     }                                   │
└─────────────────────────────────────────┘
```

---

## 💾 Storage Efficiency Visualization

### Old Approach: Full Duplication
```
User creates 5 worlds:

World 1: [████████████████████████] 500KB (full cap sheet)
World 2: [████████████████████████] 500KB (full cap sheet)
World 3: [████████████████████████] 500KB (full cap sheet)
World 4: [████████████████████████] 500KB (full cap sheet)
World 5: [████████████████████████] 500KB (full cap sheet)
                                    ─────────────────────
                                    Total: 2.5MB
```

### New Approach: Transaction Log
```
Baseline (shared):   [████████████████████████] 500KB
World 1 (10 tx):     [███] 70KB
World 2 (8 tx):      [██] 56KB
World 3 (12 tx):     [████] 84KB
World 4 (6 tx):      [██] 42KB
World 5 (9 tx):      [███] 63KB
                     ─────────────────────────────
                     Total: 815KB (67% savings!)
```

---

## 🔒 Security Model

```
                    ┌─────────────────┐
                    │  User logs in   │
                    │  Firebase Auth  │
                    └────────┬────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │  request.auth.uid = "user123"  │
            └────────────────┬───────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐        ┌──────────┐        ┌──────────┐
   │ /teams/ │        │ /worlds/ │        │ /worlds/ │
   │         │        │ (own)    │        │ (other)  │
   └─────────┘        └──────────┘        └──────────┘
        │                    │                    │
        ▼                    ▼                    ▼
    ✅ READ             ✅ READ/WRITE         ❌ DENIED
   (public)          (userId matches)      (not owner)
```

---

## 📈 Scalability

### Small User (5 worlds, 10 transactions each)
```
Baseline:     500KB  (shared)
Worlds:       350KB  (5 × 70KB)
Total:        850KB  ✅ Very efficient
```

### Active User (20 worlds, 25 transactions avg)
```
Baseline:     500KB  (shared)
Worlds:       2.5MB  (20 × 125KB)
Total:        3.0MB  ✅ Still efficient
```

### Power User (100 worlds, 50 transactions avg)
```
Baseline:     500KB  (shared)
Worlds:       25MB   (100 × 250KB)
Total:        25.5MB ✅ Manageable

Old approach: 100 × 500KB = 50MB ❌
```

### With Snapshots (100+ transactions)
```
Every 100 transactions, create snapshot:

Snapshot:     500KB  (full state at tx_100)
New tx:       250KB  (50 more transactions)
Load time:    Fast!  (snapshot + 50 tx vs. 150 tx)
```

---

## 🚀 Migration Strategy

```
┌────────────────────────────────────────────────────────────┐
│  Phase 1: Dual-Write (2 weeks)                             │
├────────────────────────────────────────────────────────────┤
│  Write:  Old structure ✓  AND  New structure ✓             │
│  Read:   Old structure ✓                                   │
│  Status: Safe, no breaking changes                         │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  Phase 2: Dual-Read (2 weeks)                              │
├────────────────────────────────────────────────────────────┤
│  Write:  New structure ✓                                   │
│  Read:   New structure ✓, fallback to Old structure ✓      │
│  Status: Transition, converts old on access                │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  Phase 3: Full Migration (1 week)                          │
├────────────────────────────────────────────────────────────┤
│  Write:  New structure ✓                                   │
│  Read:   New structure ✓                                   │
│  Action: Batch convert all old plans, deprecate old        │
│  Status: Complete                                          │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Benefits Summary

| Benefit | Description | Impact |
|---------|-------------|--------|
| **💾 Storage** | 66%+ reduction | 2.5MB → 850KB for 5 plans |
| **⚡ Performance** | Faster writes | 5KB vs 500KB per save |
| **🔍 Auditability** | Complete history | Every move recorded |
| **🌳 Branching** | Fork any world | Create variations easily |
| **↩️ Undo/Redo** | Reverse transactions | Mistakes are recoverable |
| **🔒 Isolation** | Independent worlds | No cross-contamination |
| **👥 Multiplayer** | Shared validation | Enables league mode |
| **📊 Comparison** | Diff two worlds | Side-by-side analysis |

---

## 🏁 Quick Start Code

### Create a World
```javascript
const worldId = await createWorld(
  "user123",           // userId
  "lal",               // teamId
  "Lakers Dynasty",    // worldName
  2025                 // seasonYear
);
// worldId = "w_user123_lal_2025_1234567890"
```

### Execute a Trade
```javascript
await executeTransaction(worldId, "user123", {
  type: 'trade',
  details: {
    outgoing: { players: [...], picks: [...] },
    incoming: { players: [...], picks: [...] }
  }
});
```

### Load World State
```javascript
const { currentState, transactions } = await loadWorldState(worldId);

// currentState = baseline + all transactions applied
// Ready to display in UI!
```

---

## 📚 Documentation Links

- **📋 Summary**: [ARCHITECT_SCHEMA_SUMMARY.md](./ARCHITECT_SCHEMA_SUMMARY.md)
- **📖 Full Proposal**: [ARCHITECT_FIRESTORE_PROPOSAL.md](./ARCHITECT_FIRESTORE_PROPOSAL.md)
- **🔄 Data Flow**: [ARCHITECT_DATA_FLOW.md](./ARCHITECT_DATA_FLOW.md)
- **💻 Implementation**: [ARCHITECT_IMPLEMENTATION.md](./ARCHITECT_IMPLEMENTATION.md)
- **📍 Navigation**: [ARCHITECT_README.md](./ARCHITECT_README.md)

---

**Status**: ✅ Ready for Implementation  
**Recommendation**: Adopt transaction log architecture  
**Next Step**: Prototype core helper functions
