# V2 Schema Quick Reference

## 🎯 Quick Start

### Collection Access
```javascript
import { PLAYERS_COLLECTION } from '@/constants/collections';
import { playerRef, contractsCol, seasonsCol, evalsCol } from '@/data/firestorePaths';

// Get player doc reference
const docRef = playerRef(db, playerId);

// Get subcollections
const contracts = await contractsCol(db, playerId).get();
const seasons = await seasonsCol(db, playerId).get();
```

### Hook Usage

#### List Views (Fast)
```javascript
import useSimplePlayerData from '@/hooks/useSimplePlayerData';

function PlayerList() {
  const { players, loading, error } = useSimplePlayerData();
  
  return players.map(player => (
    <div key={player.id}>
      {player.bio?.displayName}
      {player.contractView?.averageAnnualValue}
    </div>
  ));
}
```

#### Detail Views (Complete)
```javascript
import usePlayerDetail from '@/hooks/usePlayerDetail';

function PlayerProfile({ playerId }) {
  const { player, loading, error } = usePlayerDetail(playerId);
  
  if (loading) return <Loading />;
  
  return (
    <div>
      <h1>{player.bio?.displayName}</h1>
      <p>Grade: {player.overallGrade}</p>
      
      {/* Contracts subcollection */}
      {Object.entries(player.contracts || {}).map(([id, contract]) => (
        <div key={id}>
          AAV: {contract.averageAnnualValue}
        </div>
      ))}
      
      {/* Seasons subcollection */}
      {Object.entries(player.seasons || {}).map(([id, season]) => (
        <div key={id}>
          Team: {season.team}
        </div>
      ))}
    </div>
  );
}
```

## 📝 Field Names (V2 Canonical)

### Bio Fields
```javascript
player.bio?.displayName      // ✅ CORRECT (never display_name)
player.bio?.position
player.bio?.age
player.bio?.height           // inches (number)
```

### Contract Fields
```javascript
player.contractView?.averageAnnualValue  // ✅ CORRECT (never AAV)
player.contractView?.signingTeam

// In contract subcollection docs:
contract.averageAnnualValue   // ✅ CORRECT
contract.contractValue
contract.contractLength
contract.startSeason          // "2024-25" format
contract.endSeason
```

### Evaluation Fields
```javascript
player.overallGrade          // ✅ CORRECT (never overall_grade)
player.badges
player.traits
player.roles
```

### Free Agency Fields
```javascript
contract.freeAgency?.freeAgentType   // ✅ CORRECT (never freeAgencyType)
contract.freeAgency?.freeAgentYear   // ✅ CORRECT (never freeAgencyYear)
contract.freeAgency?.qualifyingOffer
contract.freeAgency?.capHold
contract.freeAgency?.birdRights
```

## 🚫 Forbidden Patterns

Never use these (will fail `npm run check:legacy`):
- ❌ `AAV` → use `averageAnnualValue`
- ❌ `overall_grade` → use `overallGrade`
- ❌ `display_name` → use `bio.displayName`
- ❌ `freeAgencyType` → use `freeAgentType`
- ❌ `freeAgencyYear` → use `freeAgentYear`
- ❌ `collection('players')` → use `PLAYERS_COLLECTION`

## 🏗️ Data Structure

### Main Document
```javascript
{
  id: "player123",
  bio: {
    displayName: "John Doe",
    position: "SG",
    age: 25,
    height: 78  // inches
  },
  contractView: {
    averageAnnualValue: 15000000,
    signingTeam: "LAL"
  },
  overallGrade: 85,
  // ... other root fields
}
```

### Contracts Subcollection
```javascript
// players_v2/{playerId}/contracts/{contractId}
{
  contractValue: 60000000,
  contractLength: 4,
  averageAnnualValue: 15000000,
  signingTeam: "LAL",
  startSeason: "2024-25",
  endSeason: "2027-28",
  freeAgency: {
    freeAgentType: "UFA",
    freeAgentYear: 2028,
    birdRights: "Full"
  },
  salariesByYear: [
    { season: "2024-25", salary: 14000000 },
    { season: "2025-26", salary: 15000000 }
  ]
}
```

### Seasons Subcollection
```javascript
// players_v2/{playerId}/seasons/{seasonId}
{
  team: "LAL",
  stats: { PTS: 22.5, AST: 4.2, ... },
  evaluationView: {
    overallGrade: 85,
    badges: ["3PT Shooter", "Defender"]
  },
  contractView: {
    averageAnnualValue: 15000000,
    signingTeam: "LAL"
  }
}
```

### Evaluations Subcollection
```javascript
// players_v2/{playerId}/evaluations/{evalId}
{
  traits: { Shooting: 80, Defense: 75, ... },
  roles: { offense1: "Shooter", defense1: "Wing" },
  overallGrade: 85,
  badges: ["3PT Shooter", "Defender"],
  blurbs: { ... }
}
```

## 🔍 Filtering & Sorting

```javascript
import { filterPlayers, sortPlayers } from '@/utils/filtering/playerFilterUtils';

// Apply filters
const filtered = filterPlayers(players, {
  freeAgentYear: 2025,           // ✅ CORRECT
  freeAgentType: 'UFA',          // ✅ CORRECT
  minSalary: 10000000,
  position: 'SG'
});

// Sort by canonical fields
const sorted = sortPlayers(filtered, {
  sortBy: 'overallGrade',        // ✅ CORRECT
  sortAsc: false
});
```

## 📦 Type Safety

```typescript
import type { PlayerV2, ContractDoc, SeasonDoc } from '@/types/player';

function processPlayer(player: PlayerV2) {
  // TypeScript knows about bio.displayName, overallGrade, etc.
  console.log(player.bio?.displayName);
  console.log(player.overallGrade);
  
  // Access subcollections
  Object.entries(player.contracts || {}).forEach(([id, contract]: [string, ContractDoc]) => {
    console.log(contract.averageAnnualValue);
  });
}
```

## 🧪 Testing

Run the legacy scanner to ensure compliance:
```bash
npm run check:legacy
# ✅ No legacy tokens found! Codebase is clean.
```

## 📚 Related Files

- `firestore-complete.json` - Canonical v2 schema
- `mapping_phase1_FINAL.json` - Field rename mappings
- `RENAMES.md` - Complete rename documentation
- `IMPLEMENTATION_SUMMARY.md` - Implementation details
