# Teams Collection Migration (Current → Target)

## Migration Status

- **Status**: 🚧 IN PROGRESS
- **Current Schema**: Flattened structure with `capSheet.players[]`
- **Target Schema**: Normalized structure referencing `players_v2`
- **Migration Date**: [TBD]

## Current Schema (What Exists Now)

### `/teams/{teamId}`

```javascript
{
  capSheet: {
    lastUpdated: timestamp,
    players: [
      {
        // Flattened player data with contract_clean
        name: "Player Name",
        player_id: "player123",
        position: "PG",
        contract_clean: {
          salary: 25000000,
          years: 3,
          // ... other contract fields
        }
        // ... other flattened fields
      }
    ]
  }
}
```

## Target Schema (Migration Goal)

### `/teams/{teamId}` - Normalized Structure

```javascript
{
  roster: {
    lastUpdated: timestamp,
    season: "2025-26",
    players: [
      {
        playerId: "player123",        // Reference to players_v2
        contractId: "std_202425",     // Reference to specific contract
        rosterStatus: "active",       // active, inactive, assigned
        // Minimal denormalized data for performance
        displayName: "Player Name",
        position: "PG",
        salary: 25000000
      }
    ]
  },
  capSheet: {
    // Computed cap data, no duplicate player info
    totalSalary: 150000000,
    availableCap: 20000000,
    // ... other cap calculations
  }
}
```

## Migration Benefits

- **Eliminates duplication**: Player data lives only in `players_v2`
- **Maintains data consistency**: Single source of truth for player info
- **Improves performance**: Smaller team documents
- **Enables real-time sync**: Changes to players auto-reflect in teams

## Code Migration Patterns

### BEFORE (Current Code)

```javascript
// Getting team roster - current pattern
const team = await getDoc(doc(db, 'teams', teamId));
const players = team.data().capSheet.players;
const playerName = players[0].name;
const playerSalary = players[0].contract_clean.salary;
```

### AFTER (Target Code)

```javascript
// Getting team roster - target pattern
const team = await getDoc(doc(db, 'teams', teamId));
const roster = team.data().roster.players;

// Get full player data when needed
const player = await getDoc(doc(db, 'players_v2', roster[0].playerId));
const playerName = player.data().bio.displayName;
const playerSalary = roster[0].salary; // or get from contract subcollection
```

## Important Notes for AI

- **Use CURRENT schema** for all code generation until migration complete
- **Don't implement TARGET patterns** until migration is executed
- **Reference this doc** to understand the migration direction
- **Keep migration context** when suggesting code changes

---
*This is migration planning documentation*
*For current working schema, use: docs/CURRENT_FIRESTORE_SCHEMA.md*
