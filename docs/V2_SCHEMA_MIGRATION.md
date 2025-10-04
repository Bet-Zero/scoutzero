# V2 Schema Migration Guide

## Overview

This document describes the migration from the legacy player schema to the new V2 schema with subcollections and standardized field naming.

## What Changed

### 1. Collection Architecture

**Old (Legacy):**
```javascript
collection(db, 'players')  // Flat structure with all data in one doc
```

**New (V2):**
```javascript
import { PLAYERS_COLLECTION } from '@/constants/collections';

collection(db, PLAYERS_COLLECTION)  // Main docs (defaults to 'players_v2')
collection(db, PLAYERS_COLLECTION, playerId, 'contracts')    // Subcollection
collection(db, PLAYERS_COLLECTION, playerId, 'seasons')      // Subcollection
collection(db, PLAYERS_COLLECTION, playerId, 'evaluations')  // Subcollection
```

### 2. Field Name Changes

| Legacy Field | V2 Field | Notes |
|-------------|----------|-------|
| `AAV` | `averageAnnualValue` | Full name for clarity |
| `overall_grade` | `overallGrade` | camelCase convention |
| `freeAgencyType` | `freeAgentType` | Shortened for consistency |
| `freeAgencyYear` | `freeAgentYear` | Shortened for consistency |
| `display_name` | `bio.displayName` | Nested under bio object |

### 3. Data Structure

**Old (Legacy):**
```javascript
{
  id: 'player123',
  display_name: 'John Doe',
  overall_grade: 'A+',
  // ... all data in one doc
}
```

**New (V2):**
```javascript
// Main doc
{
  id: 'player123',
  bio: {
    displayName: 'John Doe',
    // ... other bio fields
  },
  overallGrade: 'A+',
  contractView: {
    // Denormalized view for list performance
  }
}

// Subcollection: contracts/{contractId}
{
  averageAnnualValue: 10000000,
  // ... contract details
}

// Subcollection: seasons/{seasonId}
{
  stats: { /* ... */ },
  // ... season details
}

// Subcollection: evaluations/{evaluationId}
{
  grade: 'A+',
  // ... evaluation details
}
```

## Migration Strategy

### List Views (Fast Queries)

Use `useSimplePlayerData` for list views - fetches only main documents:

```javascript
import useSimplePlayerData from '@/hooks/useSimplePlayerData';

const MyListComponent = () => {
  const { players, loading, error } = useSimplePlayerData();
  
  return (
    <div>
      {players.map(player => (
        <div key={player.id}>
          {player.bio?.displayName}  {/* V2 field */}
          {player.overallGrade}       {/* V2 field */}
        </div>
      ))}
    </div>
  );
};
```

### Detail Views (Lazy Loading)

Use `usePlayerDetail` for detail views - fetches main doc + subcollections:

```javascript
import usePlayerDetail from '@/hooks/usePlayerDetail';

const PlayerDetailView = ({ playerId }) => {
  const { player, loading, error } = usePlayerDetail(playerId);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{player.bio?.displayName}</h1>
      <p>Grade: {player.overallGrade}</p>
      
      {/* Contracts from subcollection */}
      {player.contracts?.map(contract => (
        <div key={contract.id}>
          AAV: ${contract.averageAnnualValue?.toLocaleString()}
        </div>
      ))}
      
      {/* Seasons from subcollection */}
      {player.seasons?.map(season => (
        <div key={season.id}>
          {/* Season stats */}
        </div>
      ))}
    </div>
  );
};
```

## Environment Configuration

Override the collection name via environment variable:

```bash
# .env
PLAYERS_COLLECTION=players_v2  # Default
# or
PLAYERS_COLLECTION=players_test  # For testing
```

## Legacy Code Detection

Run the legacy scanner to ensure no old patterns remain:

```bash
npm run check:legacy
```

This scans for:
- ❌ `AAV` (use `averageAnnualValue`)
- ❌ `overall_grade` (use `overallGrade`)
- ❌ `freeAgencyType/Year` (use `freeAgentType/Year`)
- ❌ `display_name` (use `bio.displayName`)
- ❌ Direct `collection(db, 'players')` (use `PLAYERS_COLLECTION`)

## Testing

V2 schema validation tests are in `tests/v2SchemaValidation.test.js`:

```bash
npm run test tests/v2SchemaValidation.test.js -- --run
```

## Incremental Adoption

1. ✅ Collection constant created (`PLAYERS_COLLECTION`)
2. ✅ Legacy field names replaced across app
3. ✅ List hook updated (`useSimplePlayerData`)
4. ✅ Detail hook created (`usePlayerDetail`)
5. ✅ Legacy scanner added to CI
6. ⏳ Components migrated to v2 fields
7. ⏳ Data pipeline updated to write v2 format

## Troubleshooting

### Build Errors

If you see undefined property errors:
- Check field names match v2 conventions
- Ensure `bio.displayName` instead of `display_name`
- Use `player?.bio?.displayName` for safety

### Missing Data

If player data is missing:
- Verify `PLAYERS_COLLECTION` points to correct collection
- Check that detail views use `usePlayerDetail` for subcollections
- Ensure Firebase security rules allow reads

### Performance Issues

- List views should ONLY use `useSimplePlayerData` (no subcollections)
- Detail views should lazy-load with `usePlayerDetail`
- Consider adding indexes for common queries

## Future Work

- [ ] Complete data migration to v2 format
- [ ] Remove legacy `normalizePlayerData` utility
- [ ] Add v2 schema validation to Firebase rules
- [ ] Update data pipeline scripts to use v2
