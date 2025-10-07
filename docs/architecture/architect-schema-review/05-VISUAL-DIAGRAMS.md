# Architect Schema v2 - Visual Architecture Diagrams

## 1. Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARCHITECT SYSTEM                          │
│                                                                   │
│  ┌──────────────────┐              ┌──────────────────────────┐ │
│  │  IMMUTABLE BASE  │              │    USER WORLDS (DIFFS)   │ │
│  │   (Real NBA)     │              │   (What-If Scenarios)    │ │
│  │                  │              │                          │ │
│  │  ┌────────────┐  │              │  ┌────────────────────┐ │ │
│  │  │ baseTeams  │  │              │  │ worlds/{worldId}   │ │ │
│  │  │  (30 docs) │  │──────reads───▶  │                    │ │ │
│  │  └────────────┘  │   fallback   │  │ - metadata         │ │ │
│  │                  │              │  │ - diffs/           │ │ │
│  │  ┌────────────┐  │              │  │ - snapshot/        │ │ │
│  │  │basePlayers │  │              │  │ - actions/         │ │ │
│  │  │ (~530 docs)│  │──────reads───▶  │                    │ │ │
│  │  └────────────┘  │   fallback   │  └────────────────────┘ │ │
│  │                  │              │                          │ │
│  │  Updated weekly  │              │  Updated on user action  │ │
│  │  or on NBA events│              │  (trades, extensions)    │ │
│  └──────────────────┘              └──────────────────────────┘ │
│                                                                   │
│         ▲                                      │                 │
│         │                                      │                 │
│         │                                      ▼                 │
│  ┌─────────────────┐                  ┌─────────────────┐       │
│  │  NBA Data Sync  │                  │   User Actions  │       │
│  │   (Pipeline)    │                  │  (GM Interface) │       │
│  └─────────────────┘                  └─────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Read Flow - Proposed Pure Diff Approach

```
User requests LAL team in World A
           │
           ▼
    ┌──────────────────────────┐
    │ Get World Team Doc?      │
    │ /worlds/A/teams/LAL      │
    └──────────────────────────┘
           │
      ┌────┴─────┐
      │  Exists? │
      └────┬─────┘
           │
     ┌─────┴──────┐
     │            │
   YES           NO
     │            │
     ▼            ▼
 Use world    Use base
 team doc     team doc
     │            │
     └─────┬──────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Get roster: [player IDs] │
    └──────────────────────────┘
           │
           ▼
    For each player ID:
           │
           ▼
    ┌──────────────────────────────────┐
    │ Check world player override?     │
    │ /worlds/A/teams/LAL/players/{id} │
    └──────────────────────────────────┘
           │
      ┌────┴─────┐
      │  Exists? │
      └────┬─────┘
           │
     ┌─────┴──────┐
     │            │
   YES           NO
     │            │
     ▼            ▼
 Get override  Get base
 player doc    player doc
     │            │
     └─────┬──────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Merge override with base │
    │ if override exists       │
    └──────────────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Return complete player   │
    └──────────────────────────┘

❌ PROBLEM: For 15 players, this is 30+ queries!
```

## 3. Read Flow - Recommended Snapshot Approach

```
User requests LAL team in World A
           │
           ▼
    ┌──────────────────────────────┐
    │ Get Team from Snapshot       │
    │ /worlds/A/snapshot/teams/LAL │
    └──────────────────────────────┘
           │
      ┌────┴─────┐
      │  Exists? │
      └────┬─────┘
           │
     ┌─────┴──────┐
     │            │
   YES           NO
     │            │
     ▼            ▼
 Return      Get base team
 snapshot    /baseTeams/LAL
 (complete)       │
     │            ▼
     │      Return base
     │            │
     └─────┬──────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Get roster: [player IDs] │
    └──────────────────────────┘
           │
           ▼
    For each player ID:
           │
           ▼
    ┌──────────────────────────────────┐
    │ Get Player from Snapshot         │
    │ /worlds/A/snapshot/players/{id}  │
    └──────────────────────────────────┘
           │
      ┌────┴─────┐
      │  Exists? │
      └────┬─────┘
           │
     ┌─────┴──────┐
     │            │
   YES           NO
     │            │
     ▼            ▼
 Return      Get base player
 snapshot    /basePlayers/{id}
     │            │
     └─────┬──────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Return complete player   │
    └──────────────────────────┘

✅ IMPROVEMENT: For 15 players, this is 16 queries (1 team + 15 players)
   Even better: Batch get all 15 players in 1 query!
```

## 4. Write Flow - Trade Example

```
User trades Austin Reaves (LAL) for Jordan Poole (NOP)
                     │
                     ▼
          ┌──────────────────────┐
          │ Validate Trade       │
          │ - Salary matching    │
          │ - Roster limits      │
          │ - Apron rules        │
          └──────────────────────┘
                     │
                ┌────┴────┐
                │  Valid? │
                └────┬────┘
                     │
              ┌──────┴───────┐
              │              │
             YES            NO
              │              │
              ▼              ▼
       ┌──────────┐    ┌──────────┐
       │ Proceed  │    │  Reject  │
       └──────────┘    └──────────┘
              │              │
              ▼              ▼
       ┌──────────────────────────┐
       │ Write to DIFFS           │
       │                          │
       │ 1. /worlds/A/diffs/      │
       │    teams/LAL/teamDoc     │
       │    - update roster       │
       │                          │
       │ 2. /worlds/A/diffs/      │
       │    teams/NOP/teamDoc     │
       │    - update roster       │
       └──────────────────────────┘
              │
              ▼
       ┌──────────────────────────┐
       │ Regenerate SNAPSHOTS     │
       │                          │
       │ 1. Merge LAL diff +      │
       │    base → snapshot       │
       │                          │
       │ 2. Merge NOP diff +      │
       │    base → snapshot       │
       │                          │
       │ 3. Update affected       │
       │    player snapshots      │
       └──────────────────────────┘
              │
              ▼
       ┌──────────────────────────┐
       │ Log Action               │
       │                          │
       │ /worlds/A/actions/       │
       │  trade_001               │
       │                          │
       │ - timestamp              │
       │ - teams: [LAL, NOP]      │
       │ - players swapped        │
       │ - validation results     │
       └──────────────────────────┘
              │
              ▼
          ┌────────┐
          │  Done  │
          └────────┘
```

## 5. Data Layer Architecture - Hybrid Approach

```
┌─────────────────────────────────────────────────────────────────┐
│                          /architect/                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  BASE LAYER (Immutable - Source of Truth for Real NBA)          │
│  ═══════════════════════════════════════════════════════════    │
│                                                                   │
│  ┌────────────────┐          ┌──────────────────┐               │
│  │  baseTeams/    │          │  basePlayers/    │               │
│  │                │          │                  │               │
│  │  ├─ LAL        │          │  ├─ lebron_james │               │
│  │  ├─ NOP        │          │  ├─ austin_reaves│               │
│  │  ├─ GSW        │          │  ├─ jordan_poole │               │
│  │  └─ ...        │          │  └─ ...          │               │
│  └────────────────┘          └──────────────────┘               │
│                                                                   │
│  Updated: Weekly or on NBA events                                │
│  Access: Public read, no writes                                  │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  WORLD LAYER (User Scenarios - What-If Mode)                     │
│  ════════════════════════════════════════════════                │
│                                                                   │
│  worlds/{worldId}/                                               │
│                                                                   │
│    ├─ metadata (document)                                        │
│    │    ├─ worldId                                               │
│    │    ├─ name: "2025 Lakers Rebuild"                           │
│    │    ├─ createdBy: "user123"                                  │
│    │    ├─ createdAt                                             │
│    │    ├─ branchPoint: {season, date}                           │
│    │    └─ teamsTouched: [LAL, NOP]                              │
│    │                                                              │
│    ├─ diffs/ (SOURCE OF TRUTH - what changed)                    │
│    │    └─ teams/                                                │
│    │         ├─ LAL/                                             │
│    │         │    ├─ teamDoc (roster, overrides)                 │
│    │         │    └─ players/                                    │
│    │         │         └─ jordan_poole (contract override)       │
│    │         └─ NOP/                                             │
│    │              └─ teamDoc (roster, overrides)                 │
│    │                                                              │
│    ├─ snapshot/ (DENORMALIZED - for fast reads)                  │
│    │    ├─ teams/                                                │
│    │    │    ├─ LAL (complete team = base + diff)               │
│    │    │    └─ NOP (complete team = base + diff)               │
│    │    └─ players/                                              │
│    │         ├─ lebron_james (complete = base)                   │
│    │         ├─ jordan_poole (complete = base + override)        │
│    │         └─ austin_reaves (complete = base)                  │
│    │                                                              │
│    └─ actions/ (AUDIT TRAIL - what happened)                     │
│         ├─ trade_001                                             │
│         │    ├─ type: "trade"                                    │
│         │    ├─ timestamp                                        │
│         │    ├─ teams: [LAL, NOP]                                │
│         │    └─ validation: {...}                                │
│         └─ extend_002                                            │
│              ├─ type: "extension"                                │
│              └─ ...                                              │
│                                                                   │
│  Access: Owner read/write on diffs+actions, server-gen snapshots │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 6. Storage Comparison - Real World Example

### Scenario: User creates 3 worlds, each with 1 trade

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT SYSTEM (Full Copy)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  World 1: /teamPlans/user123_LAL                                 │
│           └─ Complete LAL team data: ~500 KB                     │
│                                                                   │
│  World 2: /teamPlans/user123_GSW                                 │
│           └─ Complete GSW team data: ~500 KB                     │
│                                                                   │
│  World 3: /teamPlans/user123_MIA                                 │
│           └─ Complete MIA team data: ~500 KB                     │
│                                                                   │
│  TOTAL: 1,500 KB (1.5 MB)                                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 PROPOSED SYSTEM (Pure Diff)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  World 1: /architect/worlds/w1/diffs/teams/                      │
│           ├─ LAL/teamDoc: ~10 KB (roster changes)               │
│           └─ NOP/teamDoc: ~10 KB (roster changes)               │
│                                                                   │
│  World 2: /architect/worlds/w2/diffs/teams/                      │
│           ├─ GSW/teamDoc: ~10 KB                                 │
│           └─ UTA/teamDoc: ~10 KB                                 │
│                                                                   │
│  World 3: /architect/worlds/w3/diffs/teams/                      │
│           ├─ MIA/teamDoc: ~10 KB                                 │
│           └─ POR/teamDoc: ~10 KB                                 │
│                                                                   │
│  TOTAL: 60 KB                                                    │
│  SAVINGS: 96% 🎉                                                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            RECOMMENDED SYSTEM (Hybrid Snapshot + Diff)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  World 1: /architect/worlds/w1/                                  │
│           ├─ diffs/teams/LAL+NOP: ~20 KB                         │
│           ├─ snapshot/teams/LAL: ~500 KB                         │
│           └─ snapshot/teams/NOP: ~500 KB                         │
│                                                                   │
│  World 2: /architect/worlds/w2/                                  │
│           ├─ diffs/teams/GSW+UTA: ~20 KB                         │
│           ├─ snapshot/teams/GSW: ~500 KB                         │
│           └─ snapshot/teams/UTA: ~500 KB                         │
│                                                                   │
│  World 3: /architect/worlds/w3/                                  │
│           ├─ diffs/teams/MIA+POR: ~20 KB                         │
│           ├─ snapshot/teams/MIA: ~500 KB                         │
│           └─ snapshot/teams/POR: ~500 KB                         │
│                                                                   │
│  TOTAL: 3,060 KB (~3 MB)                                         │
│  SAVINGS: 50% vs current 💪                                      │
│  READ PERFORMANCE: Same as current ⚡                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 7. Query Complexity Comparison

### Reading Full League (30 teams)

```
┌─────────────────────────────────────────────────────────────────┐
│ CURRENT SYSTEM                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Query 1: Get all teams (1 query)                                │
│           ├─ /teamPlans/user123_*                                │
│           └─ Returns: 30 team documents                          │
│                                                                   │
│  TOTAL: 1 query (with pagination: 30 queries)                    │
│  LATENCY: ~100ms                                                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PROPOSED SYSTEM (Pure Diff)                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  For each of 30 teams:                                           │
│    Query 1: Check world team doc (30 queries)                    │
│    Query 2: If not found, get base team (up to 30 more)          │
│    Query 3-17: For each of ~15 players:                          │
│         - Check world player override (15 queries)               │
│         - If not found, get base player (up to 15 more)          │
│                                                                   │
│  TOTAL: 30 + 30 + (30 × 15) + (30 × 15) = 960 queries ❌         │
│  LATENCY: ~5-10 seconds (unacceptable)                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ RECOMMENDED SYSTEM (Snapshot)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Query 1: Get world team snapshot (or base) for each team        │
│           └─ 30 queries (can be batched to ~3-4 queries)         │
│                                                                   │
│  Query 2: Get players (lazy load, or batch per team)             │
│           └─ Loaded on-demand when user expands team             │
│                                                                   │
│  TOTAL: 30 queries for initial load ✅                           │
│  LATENCY: ~100-200ms (acceptable)                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 8. Snapshot Regeneration Flow

```
NBA Data Updates (Weekly Sync)
           │
           ▼
    ┌──────────────────────────┐
    │ Update Base Collections  │
    │                          │
    │ /architect/baseTeams     │
    │ /architect/basePlayers   │
    └──────────────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Trigger Cloud Function   │
    │ "regenerateSnapshots"    │
    └──────────────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ For each active world:   │
    └──────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │ For each team in world.teamsTouched: │
    └──────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ 1. Load base team        │
    │ 2. Load team diff        │
    │ 3. Merge: base + diff    │
    │ 4. Save to snapshot/     │
    └──────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │ For each player in team.roster:      │
    └──────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ 1. Load base player      │
    │ 2. Load player override  │
    │    (if exists)           │
    │ 3. Merge: base + override│
    │ 4. Save to snapshot/     │
    └──────────────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Mark snapshot as fresh   │
    │ (timestamp)              │
    └──────────────────────────┘
           │
           ▼
       ┌────────┐
       │  Done  │
       └────────┘

Frequency: After base updates, or on-demand
Latency: ~1-2 seconds per world
Cost: Moderate (runs server-side, infrequent)
```

---

## Summary

The visual diagrams show:

1. **Architecture**: Clear separation between immutable base (real NBA) and mutable worlds (user scenarios)

2. **Read Performance**: Proposed pure diff approach requires 30× more queries; snapshot hybrid matches current performance

3. **Write Flow**: Trades update diffs (source of truth) then regenerate snapshots (for reads)

4. **Storage**: Hybrid approach saves 50% storage while maintaining fast reads (vs 96% savings but slow reads)

5. **Regeneration**: Background process rebuilds snapshots when base data updates

**Recommendation**: Use the hybrid snapshot + diff approach shown in diagrams 3, 5, and 8 for production implementation.
