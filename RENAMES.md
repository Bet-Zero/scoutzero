# Field Renames - V2 Schema Migration

This document lists all identifier renames applied during the Pure V2 Schema Refactor.

## Core Renames

These are the primary field renames driven by `mapping_phase1_FINAL.json`:

| Legacy Name | V2 Name | Notes |
|-------------|---------|-------|
| `AAV` | `averageAnnualValue` | Contract average annual value |
| `overall_grade` | `overallGrade` | Player overall grade/rating |
| `display_name` | `bio.displayName` | Player display name (moved to bio object) |
| `freeAgencyType` | `freeAgentType` | Free agent type (UFA/RFA) |
| `freeAgencyYear` | `freeAgentYear` | Year player becomes free agent |
| `fa_type` | `freeAgentType` | Legacy free agent type field |
| `fa_year` | `freeAgentYear` | Legacy free agent year field |
| `free_agency_year` | `freeAgentYear` | Alternative legacy field |

## Schema Structure Changes

### Collections

- Main collection: `players` → `players_v2` (via `PLAYERS_COLLECTION` constant)
- Subcollections added:
  - `players_v2/{playerId}/contracts/{contractId}`
  - `players_v2/{playerId}/seasons/{seasonId}`
  - `players_v2/{playerId}/evaluations/{evaluationId}`

### Data Access Patterns

- **List Views**: Use `useSimplePlayerData()` - main docs only, no subcollections
- **Detail Views**: Use `usePlayerDetail(playerId)` - full data with all subcollections

### Path Helpers

All Firestore paths centralized in `src/data/firestorePaths.ts`:

```js
import { playerRef, contractsCol, seasonsCol, evalsCol } from "@/data/firestorePaths";

// Get player document
const docRef = playerRef(db, playerId);

// Get contracts subcollection
const contracts = contractsCol(db, playerId);
```

## Implementation Notes

1. **No Legacy Adapters**: All normalizer/flatten functions removed
2. **Canonical Names Only**: Code uses only v2 field names
3. **Type Safety**: TypeScript types in `src/types/player.d.ts`
4. **Validation**: `npm run check:legacy` enforces no forbidden tokens

## Migration Checklist

- [x] Created v2 type definitions
- [x] Created collection constants
- [x] Created path helpers
- [x] Created usePlayerDetail hook
- [x] Updated useSimplePlayerData
- [ ] Renamed all legacy field references
- [ ] Removed legacy adapters
- [ ] All tests passing
- [ ] Legacy scanner clean
