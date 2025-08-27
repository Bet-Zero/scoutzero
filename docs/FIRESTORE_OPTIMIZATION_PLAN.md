# 🗂️ FIRESTORE OPTIMIZATION PLAN

## Executive Summary

After comprehensive analysis of the current Firestore structure and the scripts pipeline described in `repomix-output-scripts.xml`, the current data organization is **excellently designed** and should be locked in as the foundation. The primary work needed is implementing the missing scripts pipeline and enhancing virtual world capabilities.

---

## 📊 Current Data Structure Analysis

### ✅ EXCELLENT - Keep As-Is

#### `/players` Collection - Universal Player Records
**Usage**: ScoutZero, HoopZero public site, Rankings, Clip Tagger
**Structure**: One document per player (`player_id`)

```javascript
{
  bio: { AGE, HT, WT, Team, Position, Years_Pro },
  traits: { Shooting, Defense, IQ, Athleticism, etc. },
  roles: { offense1, defense1, etc. },
  blurbs: { traits, roles, subroles, shootingProfile },
  subRoles: { offense: [], defense: [] },
  badges: ["Rising Star", "Defensive Specialist"],
  overall_grade: "B+",
  system: { stats: { PTS, AST, FG%, eFG%, etc. } },
  contract: { /* raw scraped data */ },
  contract_summary: { /* cleaned structure */ },
  draft: { year, round, pick, team },
  agent: { name, agency },
  status: "Signed|FA|2-Way"
}
```

#### `/teams` Collection - Cap Sheet & Roster Info  
**Usage**: Architect tools (Cap Manager, Trade Machine, FA System)
**Structure**: One document per team (`teamId`)

```javascript
{
  capSheet: {
    lastUpdated: timestamp,
    players: [
      {
        name, player_id, position, age, height, weight,
        contract_clean: {
          years, total_value, average_value,
          bird_rights, fa_type, fa_year, has_extension,
          salaries_by_year: {
            "2025": { salary: number, guaranteed: number, option: "Team|Player|null", source: string }
          }
        }
      }
    ]
  }
}
```

#### User-Generated Content Collections
- `/lists` - Ranking lists for ScoutZero
- `/tierLists` - Tier maker data  
- `/rosterProjects` - Custom roster builds
- `/freeAgents` - Free agent pool
- `/meta` - System metadata

### ⚠️ NEEDS ENHANCEMENT - Virtual Worlds

#### `/teamPlans` Collection - Current Implementation
```javascript
// Current structure - basic but functional
/teamPlans/{userId}_{teamId}/namedPlans/{planName}
{
  name: string,
  capSheet: { /* same as teams structure */ },
  updatedAt: timestamp
}
```

#### `/teamPlans` Collection - Recommended Enhancement
```javascript
// Enhanced structure with plan inheritance and versioning
/teamPlans/{userId}_{teamId}
{
  activePlan: "real_world",
  baseTeam: "lakers", // reference to /teams/{teamId}
  plans: {
    "real_world": {
      capSheet: { /* current team state */ },
      isBase: true,
      lastSyncedWith: "/teams/lakers",
      lastUpdated: timestamp
    },
    "lebron_trade_experiment": {
      capSheet: { /* modified state */ },
      basedOn: "real_world",
      changes: [
        { type: "trade", players: ["lebron"], details: {...} },
        { type: "signing", player: "free_agent_x", contract: {...} }
      ],
      lastUpdated: timestamp,
      description: "What if we trade LeBron for picks?"
    },
    "championship_run": {
      capSheet: { /* another modified state */ },
      basedOn: "lebron_trade_experiment", 
      changes: [...],
      lastUpdated: timestamp
    }
  }
}
```

---

## 🚀 Scripts Pipeline Implementation Plan

### Missing Scripts Structure (from XML analysis)

#### Priority 1: Core Data Pipeline
```
scripts/
├── contracts/
│   ├── scrape_all_contracts.py     # NBA contract data scraping
│   └── parse_contract_data.py      # Clean and structure contracts
├── merge/
│   └── merge_universal_player_data.py  # Combine all data sources
├── upload/
│   ├── push_bio_and_contract.py   # Upload to /players collection
│   ├── push_stat_data.py         # Upload stats data
│   └── firebaseHelpers.node.js   # Firebase utilities
└── capsheets/
    └── generateCapSheets.js       # Generate /teams collection data
```

#### Priority 2: Data Maintenance
```
scripts/
├── audit/
│   ├── firestore_schema_audit.mjs    # Monitor schema changes
│   ├── scan_repo_for_firestore_paths.sh  # Track Firestore usage
│   └── make_usage_map.sh            # Generate usage documentation
├── utils/
│   ├── scan_malformed_players.js    # Data quality checks
│   ├── dumpFieldStructure.js       # Schema analysis
│   └── push_selected_players.py    # Selective data updates
└── names/
    ├── groupNameAliases.cjs         # Handle player name variants
    └── scanAllDataNames.cjs         # Name consistency checks
```

### Implementation Commands
```bash
# Main data update workflows
npm run update-contracts   # Scrape → Parse → Merge → Upload contracts
npm run update-stats       # Update player statistics  
npm run generate-capsheets # Rebuild team cap sheets
npm run audit-data         # Check data integrity
```

---

## 🎯 Virtual World Enhancement Specification

### Core Requirements
1. **Multiple Saved States**: Users can create and switch between different "what-if" scenarios
2. **Plan Inheritance**: Changes build on previous states without data duplication
3. **Real-World Sync**: Virtual plans can be updated when real team data changes
4. **Change Tracking**: Clear audit trail of what was modified in each plan

### Technical Implementation

#### Enhanced TeamPlan Service
```javascript
// src/utils/architect/firebaseTeamPlanHelpers.js

export const createVirtualPlan = async (userId, teamId, planName, basePlan = "real_world") => {
  const planId = `${userId}_${teamId}`;
  const basePlanData = await getNamedPlan(userId, teamId, basePlan);
  
  const newPlan = {
    capSheet: basePlanData.capSheet,
    basedOn: basePlan,
    changes: [],
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp()
  };
  
  await setDoc(doc(db, 'teamPlans', planId, 'plans', planName), newPlan);
};

export const applyTradeToVirtualPlan = async (userId, teamId, planName, tradeData) => {
  const planRef = doc(db, 'teamPlans', planId, 'plans', planName);
  const plan = await getDoc(planRef);
  
  // Apply trade logic to capSheet
  const updatedCapSheet = applyTrade(plan.data().capSheet, tradeData);
  
  // Track the change
  const change = {
    type: 'trade',
    timestamp: serverTimestamp(),
    details: tradeData,
    playersOut: tradeData.outgoing,
    playersIn: tradeData.incoming
  };
  
  await updateDoc(planRef, {
    capSheet: updatedCapSheet,
    changes: arrayUnion(change),
    lastUpdated: serverTimestamp()
  });
};

export const syncPlanWithRealWorld = async (userId, teamId, planName) => {
  // Update base real-world data and propagate changes through plan inheritance
  const realWorldData = await loadTeamCapSheet(teamId);
  const planRef = doc(db, 'teamPlans', planId, 'plans', 'real_world');
  
  await updateDoc(planRef, {
    capSheet: realWorldData,
    lastSyncedWith: `/teams/${teamId}`,
    lastUpdated: serverTimestamp()
  });
  
  // Optionally propagate changes to dependent plans
  // This would reapply changes on top of the new base data
};
```

#### Trade Machine Integration
```javascript
// Enhanced trade validation that works with virtual plans
export const validateTradeInVirtualPlan = (userId, teamId, planName, tradeData) => {
  // Load virtual plan state instead of real team data
  const virtualTeamData = await getVirtualPlanState(userId, teamId, planName);
  
  // Run existing trade validation logic
  return validateTrade({
    teams: virtualTeamData.teams,
    capProjections: virtualTeamData.capProjections,
    currentYear: 2025,
    tradeCtx: { virtualPlan: true }
  });
};
```

---

## 📈 Performance Optimizations

### Read Optimization
- **Cache frequently accessed player combinations** in Trade Machine
- **Lazy load player details** in table views
- **Pre-compute common queries** (team rosters, free agents by position)

### Write Optimization  
- **Batch operations** for bulk data updates
- **Incremental sync** between real-world and virtual plans
- **Change deltas** instead of full document overwrites

### Storage Optimization
- **Plan inheritance** prevents data duplication in virtual worlds
- **Compressed change logs** for audit trails
- **Archive old plans** after user-defined periods

---

## 🔒 Data Security & Consistency

### Access Control
```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read access for players data
    match /players/{playerId} {
      allow read: if true;
      allow write: if false; // Only scripts can write
    }
    
    // Team data read-only for users
    match /teams/{teamId} {
      allow read: if true;
      allow write: if false; // Only scripts can write  
    }
    
    // User plans - private to user
    match /teamPlans/{userId}_{teamId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
    
    // User-generated content
    match /lists/{listId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Data Validation
```javascript
// Ensure data consistency in virtual plans
export const validatePlanConsistency = async (userId, teamId, planName) => {
  const plan = await getNamedPlan(userId, teamId, planName);
  
  // Verify cap sheet mathematics
  const calculatedTotal = plan.capSheet.players.reduce((sum, p) => 
    sum + (p.contract_clean?.salaries_by_year?.['2025']?.salary || 0), 0);
  
  // Verify roster size constraints  
  const activePlayers = plan.capSheet.players.filter(p => 
    !p.contract_clean?.fa_year || p.contract_clean.fa_year > 2025);
    
  return {
    capMath: calculatedTotal === plan.capSheet.totalSalary,
    rosterSize: activePlayers.length <= 15,
    twoWayCount: activePlayers.filter(p => p.status === '2-Way').length <= 3
  };
};
```

---

## ✅ Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Create scripts folder structure
- [ ] Implement basic contract scraping pipeline
- [ ] Enhance virtual plan data structure
- [ ] Update Trade Machine to work with virtual plans

### Phase 2: Data Pipeline (Week 3-4)  
- [ ] Implement stats update pipeline
- [ ] Add data audit and validation tools
- [ ] Create plan inheritance system
- [ ] Add real-world sync capabilities

### Phase 3: Optimization (Week 5-6)
- [ ] Performance optimizations and caching
- [ ] Enhanced change tracking and audit trails
- [ ] Data export/import utilities
- [ ] Comprehensive documentation

### Phase 4: Polish (Week 7-8)
- [ ] Advanced virtual plan features (branching, merging)
- [ ] Historical data archiving
- [ ] Enhanced security rules
- [ ] User interface improvements

---

## 🎯 Success Metrics

### Technical Metrics
- [ ] **100% data consistency** between collections
- [ ] **<2s load times** for complex Trade Machine scenarios  
- [ ] **99.9% uptime** for data pipeline
- [ ] **Zero data loss** during virtual plan operations

### User Experience Metrics  
- [ ] **Seamless switching** between virtual plans
- [ ] **Instant preview** of trade consequences
- [ ] **Reliable data** always matches real NBA information
- [ ] **Intuitive workflow** for creating and managing plans

This optimization plan maintains the excellent current structure while adding the missing pieces for a complete, production-ready data management system.