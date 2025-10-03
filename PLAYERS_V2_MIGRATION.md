# Players v2 Migration Documentation

## Overview

The frontend has been migrated from the flat `players` collection to the new `players_v2` collection with subcollections. This migration maintains backward compatibility with all existing components while using the new structured data format.

## What Changed

### Database Structure

**Old Structure (Flat):**
```javascript
players/player_id: {
  display_name: "LeBron James",
  bio: { age: 40, position: "SF" },
  traits: { Shooting: 85, Defense: 75 },
  contract: { total_value: 50000000 },
  system: { stats: { PTS: 25.7, AST: 7.3 } }
  // All data in one flat document
}
```

**New Structure (Subcollections):**
```javascript
// Main document
players_v2/player_id: {
  bio: { displayName: "LeBron James", age: 40, position: "SF" }
}

// Contract subcollection
players_v2/player_id/contracts/std_202425: {
  contractValue: 50000000,
  annual_salaries: [...],
  bird_rights: "Early Bird"
}

// Season stats subcollection
players_v2/player_id/seasons/2025-26: {
  stats: { PTS: 25.7, AST: 7.3 },
  team: "LAL"
}

// Evaluation subcollection
players_v2/player_id/evaluations/current: {
  traits: { Shooting: 85, Defense: 75 },
  roles: { offense1: "...", defense1: "..." },
  shootingProfile: "Elite"
}
```

### Field Mapping

Key field mappings from old to new structure:

| Old Field | New Field Location |
|-----------|-------------------|
| `display_name` | `bio.displayName` (main doc) |
| `traits.Shooting` | `evaluations.traits.Shooting` (subcollection) |
| `system.stats.PTS` | `seasons.{season_id}.stats.PTS` (subcollection) |
| `contract.total_value` | `contracts.{contract_id}.contractValue` (subcollection) |
| `roles.offense1` | `evaluations.roles.offense1` (subcollection) |
| `shootingProfile` | `evaluations.shootingProfile` (subcollection) |

## Updated Files

### Core Data Fetching
- **`src/hooks/useSimplePlayerData.js`** - Main data fetching hook
  - Now fetches from `players_v2` collection
  - Fetches subcollections (contracts, seasons, evaluations)
  - Normalizes data back to flat structure for compatibility
  - Uses batching (50 players at a time) for performance

- **`src/hooks/usePlayerData.js`** - Wrapper hook
  - Updated diagnostics to reflect new data source
  - No breaking changes to API

- **`src/hooks/useSeasonPlayerData.js`** - Legacy hook (deprecated)
  - Updated fallback to use `players_v2`

### Helper Functions
- **`src/firebaseHelpers.js`** - Firebase helper functions
  - Updated to use `players_v2` collection
  - `savePlayerData()`, `loadPlayerData()`, `getAllPlayers()` all updated

## How It Works

### Data Fetching Flow

1. **Main Documents**: Hook listens to `players_v2` collection for real-time updates
2. **Subcollections**: For each player, fetch data from 3 subcollections in parallel:
   - `contracts/{contract_id}` - Contract data
   - `seasons/{season_id}` - Season stats
   - `evaluations/{eval_id}` - Evaluation data
3. **Normalization**: Combine all data into a flat structure matching the old format
4. **Sorting**: Sort players by display name client-side

### Batching Strategy

To avoid overwhelming Firestore with 630+ concurrent requests, subcollections are fetched in batches:
- Batch size: 50 players
- Within each batch: 3 subcollections fetched in parallel per player
- Total: 3 subcollection fetches × 50 players = 150 concurrent requests max

### Error Handling

- Missing subcollections are handled gracefully with empty defaults
- Individual subcollection fetch errors don't break the entire load
- Players without subcollection data still appear with default values

### Data Normalization

The `normalizePlayerV2Data()` function ensures:
- All expected fields are present
- Both old (`display_name`) and new (`bio.displayName`) fields are available
- Missing data gets sensible defaults (empty objects, `'—'` for missing strings)
- Spread operator order preserves enhanced bio object

## Performance Considerations

### Initial Load
- Main documents: 1 query (all players)
- Subcollections: ~630 players × 3 subcollections = ~1890 queries (batched)
- First load may take a few seconds to fetch all subcollections

### Real-time Updates
- Firestore listener updates main documents in real-time
- Subcollections are re-fetched when main document changes

### Optimization Opportunities (Future)
- Cache subcollection data in localStorage
- Only fetch subcollections for visible players (lazy loading)
- Use Firestore collection group queries (requires index setup)

## Testing

### Unit Tests
- **`tests/useSimplePlayerData.test.js`** - Data normalization tests
  - Verifies correct field mapping from subcollections
  - Tests handling of missing subcollections
  - Validates backward compatibility

### Integration Testing
To test with real data:
1. Ensure Firebase is configured (`.env` file)
2. Run dev server: `npm run dev`
3. Navigate to player pages
4. Verify player data loads correctly

## Backward Compatibility

All existing components continue to work without changes because:
1. **Same data shape**: Normalized data matches the old flat structure
2. **Same field names**: `display_name`, `contract`, `system.stats`, etc. are preserved
3. **Same hook API**: `usePlayerData()` returns `{ players, loading, error }`

## Migration Checklist

- [x] Update `useSimplePlayerData.js` to fetch from `players_v2`
- [x] Add subcollection fetching logic
- [x] Implement data normalization
- [x] Update `firebaseHelpers.js` 
- [x] Add batching for performance
- [x] Add error handling for missing subcollections
- [x] Create unit tests for normalization
- [x] Verify build succeeds
- [ ] Test with live Firebase data (requires Firebase credentials)
- [ ] Monitor performance with 630 players
- [ ] Document any performance issues

## Known Limitations

1. **Initial Load Time**: First load fetches ~1890 subcollection documents, which may take a few seconds
2. **No Fallback**: Does not fall back to old `players` collection (by design)
3. **Real-time Updates**: Main document changes trigger re-fetch of all subcollections for that player

## Future Improvements

1. **Caching**: Cache subcollection data in localStorage to reduce fetches
2. **Lazy Loading**: Only fetch subcollections for visible/active players
3. **Collection Group Queries**: Use Firestore collection group queries to fetch all subcollections in fewer queries (requires index setup)
4. **Denormalization**: Consider denormalizing frequently accessed fields back into main document for performance
