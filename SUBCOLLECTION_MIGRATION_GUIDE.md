# Firestore Subcollection Migration Guide

## Overview

The migration script has been updated to create **Firestore subcollections** instead of nested objects. This provides better data organization and query performance.

## What Changed

### Before (PR #259 - Nested Objects)
```
/players/{playerId}
  ├── bio: {...}
  ├── contracts: { std_202425: {...} }    ❌ nested object
  ├── seasons: { 2025-26: {...} }         ❌ nested object
  └── evaluations: {...}                   ❌ nested object
```

### After (Current - Subcollections)
```
/players/{playerId}
  ├── bio: {...}                           ✅ main document
  └── /contracts/{contractId}              ✅ subcollection
  └── /seasons/{seasonId}                  ✅ subcollection
  └── /evaluations/current                 ✅ subcollection
```

## Why Subcollections?

1. **Better Organization**: Data is logically separated into subcollections
2. **Scalability**: Each subcollection can grow independently without affecting the main document size
3. **Query Performance**: Can query subcollections independently
4. **Firestore Best Practices**: Recommended pattern for related but distinct data

## Migration Script Changes

### Key Updates

1. **`mapDoc()` Function**
   - Now detects paths starting with `contracts.`, `seasons.`, or `evaluations.`
   - Routes them to separate subcollection objects
   - Returns `{ targetDoc, subcollections, warnings }`

2. **`processBatch()` Function**
   - Writes main document to `/players/{playerId}`
   - Writes contracts to `/players/{playerId}/contracts/{contractId}`
   - Writes seasons to `/players/{playerId}/seasons/{seasonId}`
   - Writes evaluations to `/players/{playerId}/evaluations/current`

3. **Batch Size Adjustment**
   - Changed from `BATCH_SIZE = 450` to `PLAYERS_PER_BATCH = 75`
   - Each player generates ~4-6 operations (main + subcollections)
   - Safely processes 75 players per batch (75 × 6 = 450 operations)

## Data Structure

### Main Document: `/players/{playerId}`
Contains only biographical information:
```json
{
  "bio": {
    "displayName": "Wendell Carter Jr",
    "position": "Center-Forward",
    "age": 26,
    "height": 82,
    "weight": 270,
    "agent": { "name": "...", "agency": "..." },
    "draft": { "year": 2018, "round": 1, "pick": 7 },
    "display": {
      "team": "ORL",
      "yearsPro": 7,
      "averageAnnualValue": 5950000,
      "freeAgentYear": 2026,
      "freeAgentType": "UFA"
    }
  }
}
```

### Contracts Subcollection: `/players/{playerId}/contracts/{contractId}`
Each contract is a separate document:
```json
{
  "signingTeam": "ORL",
  "contractType": "Standard Contract",
  "signedUsing": "Bird Exception",
  "contractValue": 11900000,
  "contractLength": 2,
  "averageAnnualValue": 5950000,
  "guaranteedValue": 11900000,
  "salariesByYear": [...],
  "options": [],
  "incentives": { "likely": 0, "unlikely": 0 },
  "freeAgency": {
    "freeAgentYear": 2026,
    "freeAgentType": "UFA",
    "capHold": 20615000
  }
}
```

### Seasons Subcollection: `/players/{playerId}/seasons/{seasonId}`
Each season is a separate document:
```json
{
  "team": "ORL",
  "age": 26,
  "stats": {
    "PTS": 9.1,
    "AST": 2,
    "REB": 7.2,
    "FG%": 0.46,
    "3PT%": 0.234,
    "FT%": 0.737
  },
  "contractView": {
    "salary": 5950000,
    "averageAnnualValue": 5950000,
    "freeAgentYear": 2026
  },
  "evaluationView": {
    "overallGrade": 81,
    "shootingProfile": "Willing",
    "twoWay": 63,
    "badges": [...]
  }
}
```

### Evaluations Subcollection: `/players/{playerId}/evaluations/current`
Current evaluation stored as document ID `current`:
```json
{
  "traits": {
    "Shooting": 56,
    "Passing": 54,
    "Defense": 54,
    "IQ": 59
  },
  "roles": {
    "offense1": "Versatile Big",
    "defense1": "Mobile Big"
  },
  "overallGrade": 81,
  "shootingProfile": "Willing",
  "twoWay": 63,
  "badges": ["bully", "chess_piece", "high_iq"],
  "blurbs": {...},
  "meta": {
    "methodVersion": "v1.0",
    "updatedAt": "2025-10-02T00:00:00Z"
  }
}
```

## Running the Migration

### 1. Dry Run (Test Transformation)
```bash
node scripts/migrate_phase1_enhanced.cjs --dry-run --limit 5
```
- Tests transformation logic without writing
- Validates mapping configuration
- Shows what will be created

### 2. Shadow Collection Test
```bash
node scripts/migrate_phase1_enhanced.cjs --shadow --limit 10
```
- Writes to `players_v2_shadow` collection
- Creates all subcollections
- Safe to test without affecting production

### 3. Full Migration
```bash
node scripts/migrate_phase1_enhanced.cjs --backup
```
- Creates backup before migrating
- Writes to `players_v2` collection
- Processes all players in batches of 75

## Verifying Results in Firebase Console

1. Navigate to Firestore in Firebase Console
2. Open `players_v2` (or `players_v2_shadow`) collection
3. Click on any player document
4. You should see:
   - **Fields tab**: Only `bio` object
   - **Subcollections tab**: Shows `contracts`, `seasons`, `evaluations`
5. Click into each subcollection to see documents

### Expected Subcollections

For player `wendell_carter_jr`:
- `/players/wendell_carter_jr/contracts/std_202425` - Contract document
- `/players/wendell_carter_jr/seasons/2025-26` - Season document
- `/players/wendell_carter_jr/evaluations/current` - Evaluation document

## Frontend Query Updates

When querying subcollections from the frontend, use Firestore subcollection queries:

```javascript
// Get main player document
const playerDoc = await db.collection('players_v2').doc(playerId).get();

// Get contracts subcollection
const contractsSnapshot = await db.collection('players_v2')
  .doc(playerId)
  .collection('contracts')
  .get();

// Get specific season
const seasonDoc = await db.collection('players_v2')
  .doc(playerId)
  .collection('seasons')
  .doc('2025-26')
  .get();

// Get current evaluation
const evalDoc = await db.collection('players_v2')
  .doc(playerId)
  .collection('evaluations')
  .doc('current')
  .get();
```

## Batch Operation Safety

The migration script processes **75 players per batch** to stay within Firestore's 500 operations limit:

- 1 main document write
- 1-3 contract writes (avg 1)
- 1 season write
- 1 evaluation write
- **Total: ~4-6 operations per player**
- **75 players × 6 ops = 450 operations (safe margin)**

## Troubleshooting

### Issue: Too many operations per batch
If you see errors about batch size:
- Reduce `PLAYERS_PER_BATCH` in the script (line 16)
- Recommended: 50-75 players per batch

### Issue: Subcollections not appearing
- Check that mapping paths start with `contracts.`, `seasons.`, or `evaluations.`
- Verify Firebase Console shows subcollections tab
- Ensure data exists for those fields in source documents

### Issue: Validation errors
- Main document validation only checks `bio` fields
- Subcollection data is not validated by `validateTarget()`
- Review warnings in migration output

## Migration Checklist

- [ ] Run dry-run test: `--dry-run --limit 5`
- [ ] Test in shadow collection: `--shadow --limit 10`
- [ ] Verify subcollections in Firebase Console
- [ ] Check sample contracts, seasons, evaluations
- [ ] Run full migration with backup: `--backup`
- [ ] Update frontend to query subcollections
- [ ] Test frontend data loading
- [ ] Monitor for 48 hours before removing old collection

## Support Files Updated

- ✅ `scripts/migrate_phase1_enhanced.cjs` - Main migration script
- ✅ `scripts/validate_target.js` - Validation logic
- ✅ `docs/FIRESTORE_SCHEMA.md` - Schema documentation
- ✅ `MIGRATION_QUICK_START.md` - Quick start guide
- ✅ `SUBCOLLECTION_MIGRATION_GUIDE.md` - This guide
