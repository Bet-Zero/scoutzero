# Architect Firestore Schema v2 - File Tree Structure

## Complete Firestore Collection Hierarchy

```
/architect                                    # Root collection for all Architect data
│
├── baseTeams/                                # Immutable real-life NBA teams (30 documents)
│   ├── ATL                                   # Atlanta Hawks
│   ├── BOS                                   # Boston Celtics  
│   ├── BKN                                   # Brooklyn Nets
│   ├── CHA                                   # Charlotte Hornets
│   ├── CHI                                   # Chicago Bulls
│   ├── CLE                                   # Cleveland Cavaliers
│   ├── DAL                                   # Dallas Mavericks
│   ├── DEN                                   # Denver Nuggets
│   ├── DET                                   # Detroit Pistons
│   ├── GSW                                   # Golden State Warriors
│   ├── HOU                                   # Houston Rockets
│   ├── IND                                   # Indiana Pacers
│   ├── LAC                                   # LA Clippers
│   ├── LAL                                   # Los Angeles Lakers
│   ├── MEM                                   # Memphis Grizzlies
│   ├── MIA                                   # Miami Heat
│   ├── MIL                                   # Milwaukee Bucks
│   ├── MIN                                   # Minnesota Timberwolves
│   ├── NOP                                   # New Orleans Pelicans
│   ├── NYK                                   # New York Knicks
│   ├── OKC                                   # Oklahoma City Thunder
│   ├── ORL                                   # Orlando Magic
│   ├── PHI                                   # Philadelphia 76ers
│   ├── PHX                                   # Phoenix Suns
│   ├── POR                                   # Portland Trail Blazers
│   ├── SAC                                   # Sacramento Kings
│   ├── SAS                                   # San Antonio Spurs
│   ├── TOR                                   # Toronto Raptors
│   ├── UTA                                   # Utah Jazz
│   └── WAS                                   # Washington Wizards
│
├── basePlayers/                              # Immutable real-life NBA players (~530 documents)
│   ├── aaron_gordon
│   ├── austin_reaves
│   ├── anthony_davis
│   ├── bam_adebayo
│   ├── brandon_ingram
│   ├── devin_booker
│   ├── giannis_antetokounmpo
│   ├── jayson_tatum
│   ├── joel_embiid
│   ├── jordan_poole
│   ├── karl_anthony_towns
│   ├── kawhi_leonard
│   ├── kevin_durant
│   ├── lebron_james
│   ├── luka_doncic
│   ├── nikola_jokic
│   ├── stephen_curry
│   ├── trae_young
│   ├── zion_williamson
│   └── ... (~511 more players)
│
└── worlds/                                   # User-created scenario worlds
    │
    ├── world_A/                              # Example: "2025 Lakers Rebuild" 
    │   └── teams/                            # Only teams modified in this world
    │       │
    │       ├── LAL/                          # Lakers touched in this world
    │       │   ├── teamDoc                   # Team-level overrides + roster
    │       │   └── players/                  # Player-specific overrides
    │       │       ├── jordan_poole          # Poole's contract modified
    │       │       └── dangelo_russell       # Russell's contract modified
    │       │
    │       └── NOP/                          # Pelicans touched (trade partner)
    │           ├── teamDoc                   # Team-level overrides + roster
    │           └── players/                  # Player-specific overrides
    │               └── austin_reaves         # Reaves contract modified
    │
    ├── world_B/                              # Example: "2025 Warriors All-In"
    │   └── teams/
    │       │
    │       ├── GSW/                          # Warriors touched
    │       │   ├── teamDoc
    │       │   └── players/
    │       │       ├── stephen_curry
    │       │       └── andrew_wiggins
    │       │
    │       └── UTA/                          # Jazz touched (trade partner)
    │           ├── teamDoc
    │           └── players/
    │               └── lauri_markkanen
    │
    ├── world_C/                              # Example: "2026 Heat Championship Push"
    │   └── teams/
    │       │
    │       ├── MIA/                          # Heat touched
    │       │   ├── teamDoc
    │       │   └── players/
    │       │       ├── jimmy_butler
    │       │       └── tyler_herro
    │       │
    │       ├── POR/                          # Blazers touched (3-team trade)
    │       │   ├── teamDoc
    │       │   └── players/
    │       │       └── anfernee_simons
    │       │
    │       └── ATL/                          # Hawks touched (3-team trade)
    │           ├── teamDoc
    │           └── players/
    │               └── dejounte_murray
    │
    └── world_D/                              # Example: Empty world (no changes yet)
        └── teams/                            # Empty - no teams modified
            # (directory exists but contains no documents)
```

---

## Document Existence Rules

### Base Collections (Always Exist)
- **`/architect/baseTeams`**: All 30 NBA teams, always present
- **`/architect/basePlayers`**: All ~530 active NBA players, always present

### World Collections (Sparse/Diff-Only)
- **`/architect/worlds/{worldId}`**: Only created when user creates a world
- **`/architect/worlds/{worldId}/teams/{teamCode}`**: Only exists if that team was modified in this world
- **`/architect/worlds/{worldId}/teams/{teamCode}/players/{playerId}`**: Only exists if that player's personal data (contract, rights) changed

### Example Storage Efficiency

#### Scenario: LAL trades Austin Reaves for Jordan Poole
**Documents written**: 2
1. `/architect/worlds/world_A/teams/LAL/teamDoc`
2. `/architect/worlds/world_A/teams/NOP/teamDoc`

**Documents NOT written**: ~558
- 28 unchanged teams = 0 docs
- All 530 player contracts unchanged = 0 docs

#### Scenario: LAL trades + extends Poole
**Documents written**: 3
1. `/architect/worlds/world_A/teams/LAL/teamDoc`
2. `/architect/worlds/world_A/teams/NOP/teamDoc`
3. `/architect/worlds/world_A/teams/LAL/players/jordan_poole`

---

## Read Path Examples

### Reading LAL in Default Mode (no world)
```javascript
// Read from base
const lalTeam = await getDoc(doc(db, 'architect/baseTeams/LAL'));
const lalRoster = lalTeam.data().roster;

// For each player in roster, read from base
const players = await Promise.all(
  lalRoster.map(playerId => 
    getDoc(doc(db, 'architect/basePlayers', playerId))
  )
);
```

### Reading LAL in World A (with overrides)
```javascript
// Try world first, fallback to base
let lalTeam = await getDoc(doc(db, 'architect/worlds/world_A/teams/LAL/teamDoc'));
if (!lalTeam.exists()) {
  lalTeam = await getDoc(doc(db, 'architect/baseTeams/LAL'));
}

const lalRoster = lalTeam.data().roster;

// For each player, try world override first
const players = await Promise.all(
  lalRoster.map(async playerId => {
    // Try world-specific player override
    let playerData = await getDoc(
      doc(db, 'architect/worlds/world_A/teams/LAL/players', playerId)
    );
    
    if (!playerData.exists()) {
      // Fallback to base player
      playerData = await getDoc(
        doc(db, 'architect/basePlayers', playerId)
      );
    }
    
    // Merge if override exists
    if (playerData.data()?.overrides) {
      const basePlayer = await getDoc(
        doc(db, 'architect/basePlayers', playerId)
      );
      return mergeOverrides(basePlayer.data(), playerData.data().overrides);
    }
    
    return playerData.data();
  })
);
```

---

## Migration Path from Current Structure

### Current Structure
```
/teams/{teamCode}                     # Real NBA teams (mutable)
/teamPlans/{userId}_{teamCode}        # User plans (mixed with base data)
  └── namedPlans/{planName}           # Named saves
/players/{playerId}                   # Player data (global)
```

### Migration Steps

1. **Copy teams → baseTeams**
   ```javascript
   // Copy all 30 teams to architect/baseTeams
   const teams = await getDocs(collection(db, 'teams'));
   for (const team of teams.docs) {
     await setDoc(
       doc(db, 'architect/baseTeams', team.id),
       team.data()
     );
   }
   ```

2. **Copy players → basePlayers**
   ```javascript
   // Copy all players to architect/basePlayers
   const players = await getDocs(collection(db, 'players'));
   for (const player of players.docs) {
     await setDoc(
       doc(db, 'architect/basePlayers', player.id),
       player.data()
     );
   }
   ```

3. **Convert teamPlans → worlds**
   ```javascript
   // Convert existing plans to world format
   const plans = await getDocs(collection(db, 'teamPlans'));
   for (const plan of plans.docs) {
     const [userId, teamCode] = plan.id.split('_');
     const worldId = `${userId}_${Date.now()}`;
     
     // Create world team doc with diff logic
     await setDoc(
       doc(db, 'architect/worlds', worldId, 'teams', teamCode, 'teamDoc'),
       extractDiff(plan.data(), baseTeams[teamCode])
     );
   }
   ```

4. **Update application code**
   - Change all reads to use fallback pattern
   - Update writes to target world paths
   - Implement override merge logic

5. **Deprecate old collections** (after validation period)
   - Mark `/teams` as read-only reference
   - Archive `/teamPlans` for rollback safety
   - Monitor for any remaining writes

---

## Access Patterns & Queries

### Common Queries

#### List all worlds for a user
```javascript
const worlds = await getDocs(
  query(
    collection(db, 'architect/worlds'),
    where('createdBy', '==', userId)
  )
);
```

#### Get all modified teams in a world
```javascript
const modifiedTeams = await getDocs(
  collection(db, 'architect/worlds', worldId, 'teams')
);
```

#### Get all player overrides for a team in a world
```javascript
const playerOverrides = await getDocs(
  collection(db, 'architect/worlds', worldId, 'teams', teamCode, 'players')
);
```

#### Get complete roster (base + overrides)
```javascript
// 1. Get team (world or base)
const teamDoc = await getWorldOrBase('teams', worldId, teamCode);
const roster = teamDoc.roster;

// 2. Get players (check overrides first)
const players = await Promise.all(
  roster.map(playerId => getWorldOrBase('players', worldId, teamCode, playerId))
);
```
